"""
Recommendation Engine — Ollama Gemma RAG Pipeline
===================================================
A true Retrieval-Augmented Generation engine that:

1. Fetches real user data from Supabase:
   - user_course_progress / student_progress
   - user_material_progress
   - quiz_attempts (with joined course/quiz data)
   - telemetry events

2. Detects:
   - Weak topics  (quiz score < 60%)
   - Strong topics (quiz score > 80%)
   - Completion percentage per course
   - Average quiz score

3. Builds sentence embeddings using:
   - Model: sentence-transformers/all-MiniLM-L6-v2
   - Singleton model — loaded once, reused across all requests

4. Uses FAISS for vector retrieval:
   - Singleton index — built once, cached in memory
   - Returns top-5 most relevant uncompleted materials

5. Builds a detailed prompt including:
   - Student level (beginner / intermediate / advanced)
   - Quiz performance summary
   - Weak and strong topics
   - Completed material count
   - Retrieved relevant materials

6. Sends prompt to Ollama Gemma via ollama_service.generate()

7. Returns structured recommendations:
   [{ "title", "reason", "difficulty", "priority" }]

Fallback: if Ollama is unavailable, returns rule-based recommendations
based on lowest quiz scores and most-incomplete materials.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
import faiss
from supabase import Client

# ── Logging ────────────────────────────────────────────────────────────────────

logger = logging.getLogger("recommendation_engine")
logger.setLevel(logging.INFO)
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
    logger.addHandler(_h)

# ── Configuration ──────────────────────────────────────────────────────────────

SENTENCE_TRANSFORMER_MODEL = "all-MiniLM-L6-v2"   # 384-dim (used if available)
TFIDF_MAX_FEATURES = 512                            # Fallback TF-IDF dim
TOP_K_RETRIEVAL = 5                                 # Top-k materials from FAISS
WEAK_SCORE_THRESHOLD = 60                           # Below this % = weak topic
STRONG_SCORE_THRESHOLD = 80                         # Above this % = strong topic
MAX_RECOMMENDATIONS = 5                             # Final recs to return


# ── Data Models ────────────────────────────────────────────────────────────────

@dataclass
class MaterialRecord:
    """A learning material with its parent course metadata."""
    id: str
    title: str
    type: str
    url: str
    duration_minutes: int
    order_index: int
    course_id: str
    course_title: str
    course_category: str
    course_difficulty: str
    # Rich text used as the embedding input
    embedding_text: str = ""

    def __post_init__(self) -> None:
        self.embedding_text = (
            f"{self.title}. "
            f"Course: {self.course_title}. "
            f"Category: {self.course_category}. "
            f"Difficulty: {self.course_difficulty}. "
            f"Format: {self.type}."
        )


@dataclass
class UserAnalysis:
    """Aggregated analysis of a user's learning state."""
    user_id: str
    weak_topics: List[str] = field(default_factory=list)
    strong_topics: List[str] = field(default_factory=list)
    avg_quiz_score: float = 0.0
    completion_pct: float = 0.0          # Overall material completion %
    completed_material_ids: Set[str] = field(default_factory=set)
    completed_material_count: int = 0
    total_material_count: int = 0
    user_level: str = "beginner"


# ── Adaptive Embedding Model (Singleton) ─────────────────────────────────────

class _AdaptiveEmbedder:
    """
    Singleton adaptive embedder.

    Priority:
      1. sentence-transformers/all-MiniLM-L6-v2 (384-dim)
         — best quality, requires PyTorch (Python ≤ 3.12)
      2. scikit-learn TF-IDF (up to 512-dim)
         — works offline, no PyTorch needed, compatible with Python 3.14+

    The backend is detected once at first encode() call and reused.
    The FAISS index dimension is set from the actual output dimension.
    """

    _instance: Optional["_AdaptiveEmbedder"] = None
    _backend: str = "unknown"
    _st_model = None                   # sentence-transformers model
    _tfidf_vectorizer = None           # scikit-learn TF-IDF vectorizer
    _dim: int = 0                      # actual embedding dimension (set on first build)

    def __new__(cls) -> "_AdaptiveEmbedder":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    # ── sentence-transformers path ──

    def _try_load_st(self) -> bool:
        """Attempt to load the sentence-transformers model. Returns True on success."""
        if self._st_model is not None:
            return True
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(
                f"[AI] Loading embeddings... "
                f"(sentence-transformers/{SENTENCE_TRANSFORMER_MODEL})"
            )
            self._st_model = SentenceTransformer(SENTENCE_TRANSFORMER_MODEL)
            self._backend = "sentence-transformers"
            logger.info(
                f"Embedding model '{SENTENCE_TRANSFORMER_MODEL}' loaded (dim=384)"
            )
            return True
        except Exception as exc:
            logger.info(
                f"sentence-transformers unavailable ({exc.__class__.__name__}: {exc}); "
                "falling back to TF-IDF embeddings"
            )
            return False

    def _encode_st(self, texts: List[str]) -> np.ndarray:
        embeddings = self._st_model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
            batch_size=32,
        )
        return np.array(embeddings, dtype=np.float32)

    # ── TF-IDF fallback path ──

    def _encode_tfidf(self, texts: List[str], fit: bool = False) -> np.ndarray:
        from sklearn.feature_extraction.text import TfidfVectorizer
        if fit or self._tfidf_vectorizer is None:
            logger.info(
                f"[AI] Loading embeddings... "
                f"(TF-IDF/{TFIDF_MAX_FEATURES}-dim, Python {__import__('sys').version.split()[0]})"
            )
            self._tfidf_vectorizer = TfidfVectorizer(
                max_features=TFIDF_MAX_FEATURES,
                stop_words="english",
                ngram_range=(1, 2),
                sublinear_tf=True,
            )
            self._backend = "tfidf"
            matrix = self._tfidf_vectorizer.fit_transform(texts)
        else:
            matrix = self._tfidf_vectorizer.transform(texts)
        emb = np.array(matrix.toarray(), dtype=np.float32)
        # L2-normalise for cosine similarity
        norms = np.linalg.norm(emb, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        return emb / norms

    # ── Public API ──

    def encode_corpus(self, texts: List[str]) -> np.ndarray:
        """
        Encode a corpus of texts (used when building the FAISS index).
        Automatically selects and locks in the backend.
        """
        t0 = time.time()
        if self._try_load_st():
            emb = self._encode_st(texts)
        else:
            emb = self._encode_tfidf(texts, fit=True)  # fits the vectorizer
        self._dim = emb.shape[1]
        elapsed = time.time() - t0
        logger.info(
            f"Encoded {len(texts)} texts in {elapsed:.2f}s "
            f"(backend={self._backend}, dim={self._dim})"
        )
        return emb

    def encode_query(self, text: str) -> np.ndarray:
        """Encode a single query using the same backend as the corpus."""
        if self._backend == "sentence-transformers" and self._st_model is not None:
            emb = self._encode_st([text])
        elif self._tfidf_vectorizer is not None:
            emb = self._encode_tfidf([text], fit=False)
        else:
            # Hasn't been initialised yet — encode as corpus
            emb = self.encode_corpus([text])
        return emb

    @property
    def dim(self) -> int:
        return self._dim

    @property
    def backend(self) -> str:
        return self._backend


_embedder = _AdaptiveEmbedder()


# ── Singleton FAISS Index ──────────────────────────────────────────────────────

class _FAISSIndex:
    """
    Singleton in-memory FAISS index for material embeddings.

    Built once on first RAG request (lazy init) and cached.
    Rebuilt on explicit /recommend/rag/rebuild call.
    Uses IndexFlatIP (inner product) on L2-normalised embeddings
    (equivalent to cosine similarity).
    """

    _instance: Optional["_FAISSIndex"] = None

    def __new__(cls) -> "_FAISSIndex":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._index: Optional[faiss.IndexFlatIP] = None
            cls._instance._materials: List[MaterialRecord] = []
            cls._instance._built_at: Optional[float] = None
            cls._instance._dim: int = 0
        return cls._instance

    @property
    def is_ready(self) -> bool:
        return self._index is not None and len(self._materials) > 0

    def build(self, materials: List[MaterialRecord]) -> Dict[str, Any]:
        """Encode all materials and populate the FAISS index."""
        if not materials:
            logger.warning("No materials — cannot build FAISS index")
            return {"status": "no_materials", "count": 0}

        texts = [m.embedding_text for m in materials]
        embeddings = _embedder.encode_corpus(texts)

        dim = embeddings.shape[1]
        self._dim = dim

        # Build cosine-similarity index
        index = faiss.IndexFlatIP(dim)
        index.add(embeddings)

        self._index = index
        self._materials = materials
        self._built_at = time.time()

        logger.info(
            f"FAISS index built: {len(materials)} materials, "
            f"dim={dim}, backend={_embedder.backend}"
        )
        return {
            "status": "built",
            "material_count": len(materials),
            "dimension": dim,
            "backend": _embedder.backend,
            "built_at": self._built_at,
        }

    def search(
        self, query_text: str, top_k: int = TOP_K_RETRIEVAL
    ) -> List[Tuple[MaterialRecord, float]]:
        """Return (MaterialRecord, cosine_score) for the top-k closest materials."""
        if not self.is_ready:
            logger.warning("FAISS index not built — cannot retrieve")
            return []

        query_emb = _embedder.encode_query(query_text)
        k = min(top_k, len(self._materials))
        scores, indices = self._index.search(query_emb, k)

        results: List[Tuple[MaterialRecord, float]] = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0:
                results.append((self._materials[idx], float(score)))
        return results


_faiss_index = _FAISSIndex()


# ── Supabase Data Loading ──────────────────────────────────────────────────────

def _load_all_materials(supabase: Client) -> List[MaterialRecord]:
    """Fetch all materials joined with their parent course from Supabase."""
    try:
        resp = (
            supabase.table("materials")
            .select(
                "id, title, type, url, duration_minutes, order_index, "
                "course_id, courses(title, category, difficulty)"
            )
            .order("order_index", desc=False)
            .execute()
        )
        rows = resp.data or []
    except Exception as exc:
        logger.error(f"Failed to load materials: {exc}")
        return []

    records: List[MaterialRecord] = []
    for row in rows:
        course = row.get("courses") or {}
        records.append(
            MaterialRecord(
                id=row["id"],
                title=row["title"],
                type=row.get("type", "tutorial"),
                url=row.get("url", ""),
                duration_minutes=row.get("duration_minutes", 0),
                order_index=row.get("order_index", 0),
                course_id=row["course_id"],
                course_title=course.get("title", "Unknown Course"),
                course_category=course.get("category", "General"),
                course_difficulty=course.get("difficulty", "beginner"),
            )
        )

    logger.info(
        f"Loaded {len(records)} materials from "
        f"{len(set(r.course_id for r in records))} courses"
    )
    return records


def _load_user_data(supabase: Client, user_id: str) -> Dict[str, Any]:
    """
    Fetch all user-specific data from Supabase:
      - user_course_progress / student_progress
      - user_material_progress
      - quiz_attempts (with joined quiz + course)
      - telemetry (non-critical)
    """
    data: Dict[str, Any] = {
        "course_progress": [],
        "material_progress": [],
        "quiz_attempts": [],
        "telemetry": [],
    }

    # 1. Course-level progress
    for table in ("user_course_progress", "student_progress"):
        try:
            resp = (
                supabase.table(table)
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            rows = resp.data or []
            if rows:
                data["course_progress"] = rows
                break
        except Exception as exc:
            logger.debug(f"Table '{table}' not accessible: {exc}")

    # 2. Material-level progress
    for table in ("user_material_progress", "material_progress"):
        try:
            resp = (
                supabase.table(table)
                .select("*")
                .eq("user_id", user_id)
                .execute()
            )
            rows = resp.data or []
            if rows:
                data["material_progress"] = rows
                break
        except Exception as exc:
            logger.debug(f"Table '{table}' not accessible: {exc}")

    # 3. Quiz attempts — try with joined course data first
    try:
        resp = (
            supabase.table("quiz_attempts")
            .select("*, quizzes(title, course_id, courses(title, category))")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        data["quiz_attempts"] = resp.data or []
    except Exception:
        try:
            resp = (
                supabase.table("quiz_attempts")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            data["quiz_attempts"] = resp.data or []
        except Exception as exc:
            logger.warning(f"quiz_attempts fetch failed: {exc}")

    # 4. Learning materials for total count
    try:
        resp = (
            supabase.table("materials")
            .select("id")
            .execute()
        )
        data["all_material_ids"] = {row["id"] for row in (resp.data or [])}
    except Exception:
        data["all_material_ids"] = set()

    # 5. Telemetry (non-critical)
    try:
        resp = (
            supabase.table("telemetry")
            .select("event_type, entity_id, metadata, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
        data["telemetry"] = resp.data or []
    except Exception as exc:
        logger.debug(f"Telemetry fetch failed (non-critical): {exc}")

    logger.info(
        f"User data loaded: user={user_id[:8]}… | "
        f"courses={len(data['course_progress'])} "
        f"materials={len(data['material_progress'])} "
        f"quizzes={len(data['quiz_attempts'])} "
        f"telemetry={len(data['telemetry'])}"
    )
    return data


# ── Analysis Functions ─────────────────────────────────────────────────────────

def _analyze_user(user_id: str, user_data: Dict[str, Any]) -> UserAnalysis:
    """
    Compute weak topics, strong topics, completion %, and user level
    from fetched Supabase data.
    """
    analysis = UserAnalysis(user_id=user_id)

    # ── Completed material IDs ──
    analysis.completed_material_ids = {
        row["material_id"]
        for row in user_data.get("material_progress", [])
        if row.get("completed", False)
    }
    analysis.completed_material_count = len(analysis.completed_material_ids)

    all_material_ids: Set[str] = user_data.get("all_material_ids", set())
    analysis.total_material_count = len(all_material_ids) or 1
    analysis.completion_pct = round(
        (analysis.completed_material_count / analysis.total_material_count) * 100, 1
    )

    # ── Quiz performance ──
    quiz_attempts = user_data.get("quiz_attempts", [])
    scores: List[float] = []
    weak: List[str] = []
    strong: List[str] = []

    for attempt in quiz_attempts:
        score_raw = attempt.get("score", 0)
        total = attempt.get("total_questions", 1)
        pct = (score_raw / max(total, 1)) * 100
        scores.append(pct)

        quiz_info = attempt.get("quizzes") or {}
        course_info = (quiz_info.get("courses") or {}) if isinstance(quiz_info, dict) else {}
        course_title = course_info.get("title", "") if isinstance(course_info, dict) else ""
        category = course_info.get("category", "") if isinstance(course_info, dict) else ""
        quiz_title = quiz_info.get("title", "") if isinstance(quiz_info, dict) else ""

        label = f"{course_title} — {category}" if course_title else quiz_title or "Unknown"

        if pct < WEAK_SCORE_THRESHOLD:
            weak.append(label)
        elif pct > STRONG_SCORE_THRESHOLD:
            strong.append(label)

    # Deduplicate preserving order
    def _dedup(lst: List[str]) -> List[str]:
        seen: Set[str] = set()
        return [x for x in lst if not (x in seen or seen.add(x))]  # type: ignore[func-returns-value]

    analysis.weak_topics = _dedup(weak)
    analysis.strong_topics = _dedup(strong)
    analysis.avg_quiz_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    # ── User level classification ──
    # Weighted composite: 40% avg quiz + 40% completion % + 20% material count (capped)
    composite = (
        analysis.avg_quiz_score * 0.4
        + analysis.completion_pct * 0.4
        + min(analysis.completed_material_count, 10) * 2
    )
    if composite >= 70:
        analysis.user_level = "advanced"
    elif composite >= 35:
        analysis.user_level = "intermediate"
    else:
        analysis.user_level = "beginner"

    logger.info(
        f"Analysis: level={analysis.user_level} "
        f"weak={len(analysis.weak_topics)} strong={len(analysis.strong_topics)} "
        f"avg_quiz={analysis.avg_quiz_score}% completion={analysis.completion_pct}%"
    )
    return analysis


# ── FAISS Retrieval ────────────────────────────────────────────────────────────

def _retrieve_materials(
    analysis: UserAnalysis,
    top_k: int = TOP_K_RETRIEVAL,
) -> List[Dict[str, Any]]:
    """
    Build a retrieval query from weak topics, search FAISS, and return
    the top-k uncompleted materials ranked by cosine similarity.
    """
    if not _faiss_index.is_ready:
        logger.warning("FAISS index not ready — skipping retrieval")
        return []

    logger.info("[AI] Retrieving materials...")

    query = (
        "Learning resources for: " + ", ".join(analysis.weak_topics)
        if analysis.weak_topics
        else "general learning material for continued skill development"
    )
    logger.info(f"Retrieval query: '{query[:120]}'")

    # Fetch more candidates than needed so we can filter out completed ones
    raw = _faiss_index.search(query, top_k=top_k * 3)

    candidates: List[Dict[str, Any]] = []
    for material, score in raw:
        if material.id in analysis.completed_material_ids:
            continue  # Skip already-completed materials
        candidates.append(
            {
                "material_id": material.id,
                "title": material.title,
                "type": material.type,
                "duration_minutes": material.duration_minutes,
                "course_title": material.course_title,
                "course_category": material.course_category,
                "course_difficulty": material.course_difficulty,
                "similarity_score": round(score, 4),
            }
        )
        if len(candidates) >= top_k:
            break

    logger.info(f"Retrieved {len(candidates)} candidate materials")
    return candidates


# ── Prompt Builder ─────────────────────────────────────────────────────────────

def _build_prompt(
    analysis: UserAnalysis,
    candidates: List[Dict[str, Any]],
) -> str:
    """
    Construct a detailed prompt for Ollama Gemma that includes:
      - Student level
      - Quiz performance stats
      - Weak and strong topics
      - Completed material count
      - Retrieved (FAISS) candidate materials
    """
    topics_text = "\n".join(
        f"  {i+1}. \"{c['title']}\" "
        f"(Course: \"{c['course_title']}\", "
        f"Category: {c['course_category']}, "
        f"Difficulty: {c['course_difficulty']}, "
        f"Type: {c['type']}, "
        f"Duration: {c['duration_minutes']}min)"
        for i, c in enumerate(candidates)
    )
    weak_str = (
        ", ".join(analysis.weak_topics[:5])
        if analysis.weak_topics
        else "None identified — recommend for general growth"
    )
    strong_str = (
        ", ".join(analysis.strong_topics[:5])
        if analysis.strong_topics
        else "None identified yet"
    )

    return f"""You are an AI learning advisor for an adaptive learning platform.
Analyze the student's learning data and recommend the most relevant materials from the list below.

STUDENT PROFILE:
- Level: {analysis.user_level}
- Average quiz score: {analysis.avg_quiz_score}%
- Materials completed: {analysis.completed_material_count} / {analysis.total_material_count} ({analysis.completion_pct}%)
- Weak areas (low quiz scores < 60%): {weak_str}
- Strong areas (high quiz scores > 80%): {strong_str}

AVAILABLE MATERIALS TO RECOMMEND FROM:
{topics_text if topics_text else "  (No materials retrieved — recommend general improvement)"}

INSTRUCTIONS:
- Select the {MAX_RECOMMENDATIONS} most valuable materials from the list above for this student.
- Prioritize materials that address weak areas and match the student's level.
- Do NOT recommend materials the student has already completed.
- For each recommendation provide:
  * title: exact material title from the list
  * reason: 1-2 sentence personalized explanation referencing their specific weak areas or level
  * difficulty: beginner | intermediate | advanced (match to student level: {analysis.user_level})
  * priority: integer 1-{MAX_RECOMMENDATIONS} (1 = most important)

You MUST respond with ONLY valid JSON in this exact format, no other text:
{{
  "recommendations": [
    {{
      "title": "exact title from the list above",
      "reason": "personalized explanation for this student",
      "difficulty": "beginner|intermediate|advanced",
      "priority": 1
    }}
  ]
}}"""


# ── LLM Generation ─────────────────────────────────────────────────────────────

def _generate_with_gemini(prompt: str) -> Optional[Dict[str, Any]]:
    """Send the prompt to Gemini 2.0 Flash and parse the JSON response."""
    try:
        from services.gemini_service import generate_with_gemini
    except ImportError:
        try:
            from gemini_service import generate_with_gemini
        except ImportError:
            logger.warning("gemini_service not importable — skipping LLM generation")
            return None

    logger.info("[AI] Calling Gemini...")
    t0 = time.time()

    raw = generate_with_gemini(
        prompt=prompt,
        system_instruction=(
            "You are a JSON-only API for an educational platform. "
            "Return valid JSON only. No markdown, no explanation, no code fences."
        ),
        json_mode=True,
        temperature=0.5,
    )

    if not raw:
        logger.warning("Gemini returned no content")
        return None

    elapsed = time.time() - t0
    logger.info(f"[AI] Gemini responded in {elapsed:.2f}s ({len(raw)} chars)")

    try:
        result = json.loads(raw)
        recs = result.get("recommendations", [])
        if not recs:
            logger.warning("Gemini JSON had no 'recommendations' key or empty list")
            return None
        # Ensure priority field is present and integer
        for i, rec in enumerate(recs):
            if "priority" not in rec or not isinstance(rec.get("priority"), int):
                rec["priority"] = i + 1
        logger.info(f"[AI] Recommendations generated. ({len(recs)} items)")
        return result
    except json.JSONDecodeError as exc:
        logger.warning(f"Gemini JSON parse error: {exc} | raw={raw[:200]}")
        return None


# ── Fallback — Rule-Based ──────────────────────────────────────────────────────

def _generate_fallback(
    analysis: UserAnalysis, candidates: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Fallback when Ollama is unavailable.
    Ranks candidates by:
      1. Whether they cover weak topic keywords (highest priority)
      2. Course difficulty matching user level
      3. Similarity score from FAISS
    Returns structured recommendations.
    """
    logger.info(
        "[AI] Ollama unavailable — using rule-based fallback "
        "(ranked by quiz weakness + difficulty match)"
    )

    level_difficulty_map = {
        "beginner": ["beginner", "intermediate"],
        "intermediate": ["intermediate", "beginner", "advanced"],
        "advanced": ["advanced", "intermediate"],
    }
    preferred_difficulties = level_difficulty_map.get(
        analysis.user_level, ["beginner", "intermediate"]
    )

    def _rank_score(c: Dict[str, Any]) -> float:
        score = c.get("similarity_score", 0.0)
        # Boost if difficulty matches user level
        diff = c.get("course_difficulty", "beginner")
        if diff == preferred_difficulties[0]:
            score += 0.3
        elif len(preferred_difficulties) > 1 and diff == preferred_difficulties[1]:
            score += 0.1
        # Boost if title/category overlaps with weak topics
        combined = (c.get("title", "") + " " + c.get("course_category", "")).lower()
        for topic in analysis.weak_topics:
            for word in topic.lower().split():
                if len(word) > 3 and word in combined:
                    score += 0.2
                    break
        return score

    ranked = sorted(candidates, key=_rank_score, reverse=True)[:MAX_RECOMMENDATIONS]

    recs = []
    for i, c in enumerate(ranked):
        weak_str = (
            ", ".join(analysis.weak_topics[:2]) if analysis.weak_topics else "key topics"
        )
        recs.append(
            {
                "title": c["title"],
                "reason": (
                    f"Recommended to strengthen your understanding of {weak_str}. "
                    f"This {c['type']} from '{c['course_title']}' matches your "
                    f"{analysis.user_level} level."
                ),
                "difficulty": c.get("course_difficulty", analysis.user_level),
                "priority": i + 1,
            }
        )

    return {"recommendations": recs}


# ── Public API: build_index ────────────────────────────────────────────────────

def build_index(supabase: Client) -> Dict[str, Any]:
    """
    (Re)build the FAISS embedding index from all materials in Supabase.
    Called by the /recommend/rag/rebuild admin endpoint.
    """
    materials = _load_all_materials(supabase)
    if not materials:
        return {"status": "no_materials", "count": 0}
    return _faiss_index.build(materials)


# ── Public API: RecommendationEngine ──────────────────────────────────────────

class RecommendationEngine:
    """
    High-level entry point for the Ollama Gemma RAG recommendation pipeline.

    Usage
    -----
    engine = RecommendationEngine(supabase_client)
    result = engine.get_rag_recommendations("user-uuid")
    # -> { "recommendations": [...], "metadata": {...} }
    """

    def __init__(self, supabase: Client) -> None:
        self.supabase = supabase

    # ── Legacy interface (kept for /recommend endpoint backward-compat) ──

    def get_recommendations(self, user_id: str, interests: List[str] = []) -> Dict[str, Any]:
        """Thin wrapper — delegates to get_rag_recommendations."""
        return self.get_rag_recommendations(user_id)

    # ── Main RAG pipeline ──

    def get_rag_recommendations(self, user_id: str) -> Dict[str, Any]:
        """
        Full RAG pipeline:
          1. Ensure FAISS index is built (lazy init)
          2. Load user data from Supabase
          3. Analyse weak/strong topics and user level
          4. Retrieve top-5 relevant materials via FAISS
          5. Build detailed prompt
          6. Call Ollama Gemma → parse JSON → fallback if needed
          7. Return structured response

        Returns
        -------
        {
          "recommendations": [
            { "title": str, "reason": str, "difficulty": str, "priority": int }
          ],
          "metadata": { ... }
        }
        """
        if not user_id or not user_id.strip():
            return {
                "recommendations": [],
                "metadata": {"error": "user_id is required", "pipeline": "rag"},
            }

        t_start = time.time()
        metadata: Dict[str, Any] = {"user_id": user_id, "pipeline": "rag"}

        # ── Step 1: Lazy-build FAISS index ──
        if not _faiss_index.is_ready:
            logger.info("[AI] Loading embeddings...")
            build_result = build_index(self.supabase)
            metadata["embedding_build"] = build_result

            if not _faiss_index.is_ready:
                elapsed = time.time() - t_start
                return {
                    "recommendations": [],
                    "metadata": {
                        **metadata,
                        "elapsed_seconds": round(elapsed, 3),
                        "error": (
                            "No materials found in database — "
                            "FAISS index could not be built."
                        ),
                    },
                }

        # ── Step 2: Load user data ──
        user_data = _load_user_data(self.supabase, user_id)
        metadata["data_loaded"] = {
            "courses": len(user_data.get("course_progress", [])),
            "materials": len(user_data.get("material_progress", [])),
            "quizzes": len(user_data.get("quiz_attempts", [])),
            "telemetry": len(user_data.get("telemetry", [])),
        }

        # ── Step 3: Analyse user ──
        analysis = _analyze_user(user_id, user_data)
        metadata["user_level"] = analysis.user_level
        metadata["weak_topics"] = analysis.weak_topics
        metadata["strong_topics"] = analysis.strong_topics
        metadata["avg_quiz_score"] = analysis.avg_quiz_score
        metadata["completion_pct"] = analysis.completion_pct

        # ── Step 4: Retrieve materials via FAISS ──
        logger.info("[AI] Retrieving materials...")
        candidates = _retrieve_materials(analysis)
        metadata["candidates_retrieved"] = len(candidates)

        if not candidates:
            elapsed = time.time() - t_start
            return {
                "recommendations": [],
                "metadata": {
                    **metadata,
                    "elapsed_seconds": round(elapsed, 3),
                    "message": (
                        "No uncompleted materials found. "
                        "You may have completed all available content!"
                    ),
                },
            }

        # ── Step 5 + 6: Build prompt → call Gemini → fallback ──
        prompt = _build_prompt(analysis, candidates)
        result = _generate_with_gemini(prompt)

        if result is not None:
            metadata["generation_method"] = "llm_gemini"
        else:
            # Fallback: rule-based ranking using lowest quiz scores + incomplete materials
            result = _generate_fallback(analysis, candidates)
            metadata["generation_method"] = "rule_based_fallback"

        # ── Step 7: Finalise response ──
        elapsed = time.time() - t_start
        metadata["elapsed_seconds"] = round(elapsed, 3)

        logger.info(
            f"Pipeline complete in {elapsed:.3f}s | "
            f"method={metadata['generation_method']} | "
            f"recs={len(result.get('recommendations', []))}"
        )

        return {
            "recommendations": result.get("recommendations", []),
            "metadata": metadata,
        }
