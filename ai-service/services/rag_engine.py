"""
RAG Recommendation Engine for DataFlow AI
==========================================
Production-ready Retrieval-Augmented Generation pipeline that:
1. Retrieves user progress, quiz scores, and telemetry from Supabase
2. Embeds all course materials using sentence-transformers (all-MiniLM-L6-v2)
3. Identifies weak areas from quiz performance and incomplete materials
4. Retrieves top-k relevant materials via FAISS cosine similarity
5. Generates personalized recommendations via:
     a) Ollama Gemma (local LLM — no API key, runs offline)
     b) Curated rule-based fallback (always available)

Embedding Strategy:
  - Embeddings: sentence-transformers/all-MiniLM-L6-v2 (384-dim, CPU-friendly)
  - Singleton embedding model — loaded once, reused across all requests
  - Singleton FAISS index — built once, cached in memory
  - LLM Generation: Ollama Gemma → curated rule-based fallback
  - Response Cache: per-user TTL cache (30 min) to avoid redundant LLM calls
"""

import os
import json
import time
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

import numpy as np
import faiss

logger = logging.getLogger("rag_engine")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
    logger.addHandler(handler)

# ─── Configuration ────────────────────────────────────────────────────────────

SENTENCE_TRANSFORMER_MODEL = "all-MiniLM-L6-v2"    # 384-dim, fast, CPU-friendly
EMBEDDING_DIM = 384
TOP_K_RETRIEVAL = 5                                  # Max candidates to retrieve
WEAK_SCORE_THRESHOLD = 60                            # Quiz score % below this = weak
MAX_RECOMMENDATIONS = 3                              # Final recommendations to return
RAG_CACHE_TTL_SECONDS = 1800                         # Cache per-user results for 30 min
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3")   # Local Ollama model (Gemma 3)

# Import Ollama service (graceful — won't crash if package missing)
try:
    from services.ollama_service import generate as _ollama_generate
except ImportError:
    try:
        from ollama_service import generate as _ollama_generate
    except ImportError:
        _ollama_generate = None  # type: ignore


# ─── Data Models ──────────────────────────────────────────────────────────────

@dataclass
class MaterialRecord:
    """A single learning material with its parent course metadata."""
    id: str
    title: str
    type: str                         # 'video' | 'tutorial'
    url: str
    duration_minutes: int
    order_index: int
    course_id: str
    course_title: str
    course_category: str
    course_difficulty: str
    # Constructed text used for embedding
    embedding_text: str = ""

    def __post_init__(self):
        """Build a rich text representation for semantic embedding."""
        self.embedding_text = (
            f"{self.title}. "
            f"Course: {self.course_title}. "
            f"Category: {self.course_category}. "
            f"Difficulty: {self.course_difficulty}. "
            f"Format: {self.type}."
        )


@dataclass
class UserData:
    """Aggregated user learning data from Supabase."""
    user_id: str
    course_progress: List[Dict[str, Any]] = field(default_factory=list)
    material_progress: List[Dict[str, Any]] = field(default_factory=list)
    quiz_attempts: List[Dict[str, Any]] = field(default_factory=list)
    telemetry_events: List[Dict[str, Any]] = field(default_factory=list)
    completed_material_ids: set = field(default_factory=set)


@dataclass
class RAGContext:
    """The augmentation context passed to the LLM."""
    user_level: str
    weak_topics: List[str]
    completed_materials: List[str]
    recommended_candidates: List[Dict[str, Any]]
    content_type_preference: Optional[str] = None


# ─── Embedding Cache (Singleton) ─────────────────────────────────────────────

class EmbeddingCache:
    """
    In-memory singleton that caches material embeddings and the FAISS index.
    Embeddings are built once on first request and reused.

    Embedding backend (auto-detected at runtime):
      1. sentence-transformers/all-MiniLM-L6-v2 (384-dim) — if PyTorch available
      2. scikit-learn TF-IDF (512-dim fallback)            — works on Python 3.14+
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._index: Optional[faiss.IndexFlatIP] = None
        self._materials: List[MaterialRecord] = []
        self._embeddings: Optional[np.ndarray] = None
        self._dimension: int = 0
        self._backend: str = "unknown"
        self._built_at: Optional[float] = None
        # Embedding state
        self._st_model = None
        self._tfidf_vectorizer = None
        logger.info("[AI] EmbeddingCache singleton created")

    @property
    def is_ready(self) -> bool:
        return self._index is not None and len(self._materials) > 0

    # ── sentence-transformers path ──

    def _try_load_st(self) -> bool:
        if self._st_model is not None:
            return True
        try:
            from sentence_transformers import SentenceTransformer
            logger.info("[AI] Loading embeddings... (sentence-transformers)")
            self._st_model = SentenceTransformer(SENTENCE_TRANSFORMER_MODEL)
            self._backend = "sentence-transformers"
            logger.info(f"sentence-transformers model '{SENTENCE_TRANSFORMER_MODEL}' loaded")
            return True
        except Exception as exc:
            logger.info(
                f"sentence-transformers unavailable ({exc.__class__.__name__}); "
                "falling back to TF-IDF"
            )
            return False

    def _encode_st(self, texts: List[str]) -> np.ndarray:
        embeddings = self._st_model.encode(
            texts, normalize_embeddings=True, show_progress_bar=False, batch_size=32
        )
        return np.array(embeddings, dtype=np.float32)

    # ── TF-IDF fallback path ──

    def _encode_tfidf(self, texts: List[str], fit: bool = False) -> np.ndarray:
        from sklearn.feature_extraction.text import TfidfVectorizer
        if fit or self._tfidf_vectorizer is None:
            logger.info(f"[AI] Loading embeddings... (TF-IDF/{TFIDF_MAX_FEATURES}-dim)")
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
        norms = np.linalg.norm(emb, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        return emb / norms

    # ── Unified encode ──

    def _embed(self, texts: List[str], fit_tfidf: bool = False) -> np.ndarray:
        """Encode texts using whichever backend is available."""
        if self._try_load_st():
            return self._encode_st(texts)
        return self._encode_tfidf(texts, fit=fit_tfidf)

    # ── Build Index ──

    def build(self, materials: List[MaterialRecord]) -> Dict[str, Any]:
        """
        Build embeddings for all materials and create a FAISS index.
        Uses cosine similarity via L2-normalised vectors + inner product index.
        """
        if not materials:
            logger.warning("No materials to embed")
            return {"status": "no_materials", "count": 0}

        texts = [m.embedding_text for m in materials]
        embeddings = self._embed(texts, fit_tfidf=True)

        dim = embeddings.shape[1]
        self._dimension = dim

        # Build FAISS index (inner product = cosine on unit vectors)
        index = faiss.IndexFlatIP(dim)
        index.add(embeddings)

        # Store in cache
        self._materials = materials
        self._embeddings = embeddings
        self._index = index
        self._built_at = time.time()

        logger.info(
            f"Built FAISS index: {len(materials)} materials, "
            f"dim={dim}, backend={self._backend}"
        )

        return {
            "status": "built",
            "material_count": len(materials),
            "dimension": dim,
            "backend": self._backend,
            "built_at": self._built_at,
        }

    # ── Search ──

    def search(self, query_text: str, top_k: int = TOP_K_RETRIEVAL) -> List[Tuple[MaterialRecord, float]]:
        """
        Encode the query and search FAISS for the top-k most similar materials.
        Returns list of (MaterialRecord, similarity_score) tuples.
        """
        if not self.is_ready:
            logger.warning("Index not built yet")
            return []

        # Encode query with same backend (no refit for TF-IDF)
        query_emb = self._embed([query_text], fit_tfidf=False).astype(np.float32)

        # Search FAISS
        k = min(top_k, len(self._materials))
        scores, indices = self._index.search(query_emb, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:  # FAISS returns -1 for empty slots
                continue
            results.append((self._materials[idx], float(score)))

        return results


# Global singleton instance
_cache = EmbeddingCache()


# ─── Per-User Response Cache ──────────────────────────────────────────────────
# Stores (result_dict, expiry_timestamp) keyed by user_id.
# Prevents repeated Gemini calls when the client polls the endpoint rapidly.
_response_cache: Dict[str, tuple] = {}


# ─── Data Loading ─────────────────────────────────────────────────────────────

def load_user_data(supabase, user_id: str) -> UserData:
    """
    Fetch all relevant user data from Supabase.
    Uses the service role key, so no RLS restrictions apply.
    Includes robustness with fallback table names.
    """
    user_data = UserData(user_id=user_id)

    # 1. Course-level progress
    for table in ("user_course_progress", "student_progress"):
        try:
            resp = supabase.table(table).select("*").eq("user_id", user_id).execute()
            user_data.course_progress = resp.data or []
            if user_data.course_progress:
                break
        except Exception as e:
            logger.debug(f"Table '{table}' fetch failed: {e}")

    # 2. Material-level progress
    for table in ("user_material_progress", "material_progress"):
        try:
            resp = supabase.table(table).select("*").eq("user_id", user_id).execute()
            user_data.material_progress = resp.data or []
            user_data.completed_material_ids = {
                r["material_id"]
                for r in user_data.material_progress
                if r.get("completed", False)
            }
            if user_data.material_progress:
                break
        except Exception as e:
            logger.debug(f"Table '{table}' fetch failed: {e}")

    # 3. Quiz attempts — try with joined course data first
    try:
        resp = (
            supabase.table("quiz_attempts")
            .select("*, quizzes(title, course_id, courses(title, category))")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        user_data.quiz_attempts = resp.data or []
    except Exception:
        try:
            resp = (
                supabase.table("quiz_attempts")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
            user_data.quiz_attempts = resp.data or []
        except Exception as e:
            logger.warning(f"quiz_attempts fetch failed: {e}")

    # 4. Telemetry — for personalization (non-critical)
    try:
        resp = (
            supabase.table("telemetry")
            .select("event_type, entity_id, metadata, created_at")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
        user_data.telemetry_events = resp.data or []
    except Exception as e:
        logger.debug(f"Telemetry fetch failed (non-critical): {e}")

    logger.info(
        f"User data loaded: user={user_id[:8]}... | "
        f"courses={len(user_data.course_progress)} "
        f"materials={len(user_data.material_progress)} "
        f"quizzes={len(user_data.quiz_attempts)} "
        f"telemetry={len(user_data.telemetry_events)} "
        f"completed={len(user_data.completed_material_ids)}"
    )
    return user_data


def load_all_materials(supabase) -> List[MaterialRecord]:
    """
    Load all materials joined with their parent course.
    This is called once to build the embedding index.
    """
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
    except Exception as e:
        logger.error(f"Failed to fetch materials: {e}")
        return []

    materials = []
    for row in rows:
        course = row.get("courses", {}) or {}
        materials.append(MaterialRecord(
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
        ))

    logger.info(
        f"Loaded {len(materials)} materials from "
        f"{len(set(m.course_id for m in materials))} courses"
    )
    return materials


# ─── Analysis Functions ───────────────────────────────────────────────────────

def identify_weak_areas(user_data: UserData) -> List[str]:
    """
    Analyze quiz scores and incomplete materials to identify weak areas.

    Weak area criteria:
      - Quiz score < 60% on any quiz → that quiz's course/topic is weak
      - Courses with progress between 0-50% → partially started but struggling

    Returns a list of topic description strings suitable for embedding as a query.
    """
    weak_topics = []

    # 1. Low quiz scores
    for attempt in user_data.quiz_attempts:
        score = attempt.get("score", 0)
        total = attempt.get("total_questions", 1)
        pct = (score / max(total, 1)) * 100

        if pct < WEAK_SCORE_THRESHOLD:
            # Extract course/quiz info from joined data
            quiz_info = attempt.get("quizzes", {}) or {}
            quiz_title = quiz_info.get("title", "")
            course_info = quiz_info.get("courses", {}) or {}
            course_title = course_info.get("title", "")
            category = course_info.get("category", "")

            if course_title:
                weak_topics.append(f"{course_title} - {category}")
            elif quiz_title:
                weak_topics.append(quiz_title)

    # 2. Courses with low progress (started but < 50%)
    for progress in user_data.course_progress:
        pct = progress.get("progress", 0)
        if 0 < pct < 50:
            course_id = progress.get("course_id", "")
            weak_topics.append(f"incomplete course {course_id}")

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for topic in weak_topics:
        if topic not in seen:
            seen.add(topic)
            unique.append(topic)

    logger.info(f"Identified {len(unique)} weak areas")
    return unique


def classify_user_level(user_data: UserData) -> str:
    """
    Classify user as beginner/intermediate/advanced based on:
      - Average course progress percentage
      - Average quiz score percentage
      - Number of completed materials
    Uses a weighted composite score.
    """
    # Average course progress
    if user_data.course_progress:
        avg_progress = sum(
            p.get("progress", 0) for p in user_data.course_progress
        ) / len(user_data.course_progress)
    else:
        avg_progress = 0

    # Average quiz score
    if user_data.quiz_attempts:
        scores = [
            (a.get("score", 0) / max(a.get("total_questions", 1), 1)) * 100
            for a in user_data.quiz_attempts
        ]
        avg_quiz = sum(scores) / len(scores)
    else:
        avg_quiz = 0

    # Completed material count (capped contribution)
    completed_count = len(user_data.completed_material_ids)

    # Weighted composite: 40% progress + 40% quiz + 20% completion volume
    composite = (avg_progress * 0.4) + (avg_quiz * 0.4) + (min(completed_count, 10) * 2)

    if composite >= 70:
        return "advanced"
    elif composite >= 35:
        return "intermediate"
    else:
        return "beginner"


def analyze_telemetry_preferences(user_data: UserData) -> Optional[str]:
    """
    Analyze telemetry to detect content-type preferences.
    If a user spends significantly more time on videos → preference = "video"
    If more on tutorials → preference = "tutorial"
    Returns the preferred content type, or None if no clear preference.
    """
    if not user_data.telemetry_events:
        return None

    type_time: Dict[str, float] = {"video": 0.0, "tutorial": 0.0}

    for event in user_data.telemetry_events:
        metadata = event.get("metadata", {}) or {}
        event_type = event.get("event_type", "")

        # Look for time-spent or material-view events
        if event_type in ("material_view", "time_spent", "focus_gained", "page_view"):
            content_type = metadata.get("material_type") or metadata.get("type", "")
            duration = metadata.get("duration_seconds", 0) or metadata.get("time_spent", 0)

            if content_type in type_time:
                type_time[content_type] += float(duration) if duration else 1.0

    total = sum(type_time.values())
    if total == 0:
        return None

    # Preference threshold: a type needs > 65% of total time
    for content_type, time_spent in type_time.items():
        if time_spent / total > 0.65:
            logger.info(f"Telemetry preference: '{content_type}' ({time_spent/total:.0%})")
            return content_type

    return None


# ─── Retrieval ────────────────────────────────────────────────────────────────

def build_embeddings(supabase) -> Dict[str, Any]:
    """
    Load all materials and build/rebuild the FAISS embedding index.
    Returns status info about the build.
    """
    materials = load_all_materials(supabase)
    if not materials:
        return {"status": "no_materials", "count": 0}
    return _cache.build(materials)


def retrieve_materials(
    weak_topics: List[str],
    completed_ids: set,
    top_k: int = TOP_K_RETRIEVAL,
    content_type_preference: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Convert weak topics into a query embedding, search FAISS, and return
    the top-k most relevant materials that the user hasn't completed yet.
    Optionally boosts materials matching the user's content-type preference.
    """
    if not _cache.is_ready:
        logger.warning("Embedding cache not ready — cannot retrieve")
        return []

    # Build query string from weak topics
    if weak_topics:
        query = "Learning materials for: " + ", ".join(weak_topics)
    else:
        query = "general learning material for continued progress and skill improvement"

    logger.info(f"Retrieval query: '{query[:100]}...' | top_k={top_k}")

    # Retrieve more than needed to allow filtering out completed materials
    raw_results = _cache.search(query, top_k=top_k * 3)

    candidates = []
    for material, score in raw_results:
        # Skip already-completed materials
        if material.id in completed_ids:
            continue

        # Boost score if material type matches user preference (15% boost)
        adjusted_score = score
        if content_type_preference and material.type == content_type_preference:
            adjusted_score *= 1.15

        candidates.append({
            "material_id": material.id,
            "title": material.title,
            "type": material.type,
            "duration_minutes": material.duration_minutes,
            "course_title": material.course_title,
            "course_category": material.course_category,
            "course_difficulty": material.course_difficulty,
            "similarity_score": round(adjusted_score, 4),
        })

        if len(candidates) >= top_k:
            break

    # Re-sort by adjusted score
    candidates.sort(key=lambda c: c["similarity_score"], reverse=True)

    logger.info(f"Retrieved {len(candidates)} candidates (from {len(raw_results)} raw results)")
    return candidates


# ─── Context Building ────────────────────────────────────────────────────────

def build_context(
    user_data: UserData,
    candidates: List[Dict[str, Any]],
    weak_topics: List[str],
) -> RAGContext:
    """Construct the augmentation context for the LLM."""
    user_level = classify_user_level(user_data)
    content_pref = analyze_telemetry_preferences(user_data)

    # Completed material IDs (truncated for readability)
    completed_list = [mid[:12] + "..." for mid in user_data.completed_material_ids]

    return RAGContext(
        user_level=user_level,
        weak_topics=weak_topics,
        completed_materials=completed_list,
        recommended_candidates=candidates,
        content_type_preference=content_pref,
    )


# ─── Generation (LLM + Fallback) ─────────────────────────────────────────────

def _build_prompt(context: RAGContext) -> str:
    """
    Build the prompt for the LLM.
    Asks the LLM to recommend EXTERNAL resources (YouTube, blogs, free courses)
    based on the student's weak areas and learning context.
    The in-system materials serve as topic context, not as the recommendation pool.
    """
    # Show what topics the student is working on (from FAISS retrieval)
    topics_text = "\n".join(
        f"  - \"{c['title']}\" (Course: \"{c['course_title']}\", "
        f"Category: {c['course_category']}, Difficulty: {c['course_difficulty']})"
        for c in context.recommended_candidates
    )

    pref_note = ""
    if context.content_type_preference:
        pref_note = (
            f"\nThe student prefers '{context.content_type_preference}' content. "
            f"Prioritize that format (e.g., YouTube videos if they prefer video)."
        )

    return f"""You are an AI tutor for an adaptive learning platform. Based on the student's learning progress and weak areas, recommend EXTERNAL learning resources from the internet that will help them improve.

User Level: {context.user_level}
Weak Areas: {', '.join(context.weak_topics) if context.weak_topics else 'None identified — recommend for general growth'}
Completed Material Count: {len(context.completed_materials)}
{pref_note}

Topics the student is currently studying (for context):
{topics_text}

INSTRUCTIONS:
- Recommend {MAX_RECOMMENDATIONS} EXTERNAL resources that are NOT already in our system.
- These should be real, well-known resources: YouTube videos, blog posts, free online courses, documentation pages, etc.
- Provide a real URL for each resource (YouTube links, MDN docs, freeCodeCamp, official docs, etc.).
- For each, explain WHY this external resource will help the student based on their weak areas.
- Assign a difficulty level (beginner, intermediate, or advanced) appropriate for the student's current level.
- If the student is a beginner, recommend beginner-friendly content. If advanced, recommend challenging deep-dives.
- Prefer high-quality, free resources (YouTube tutorials, official documentation, freeCodeCamp, etc.).

You MUST respond with ONLY valid JSON in this exact format, no other text:
{{
  "recommendations": [
    {{
      "title": "...",
      "url": "https://...",
      "source": "YouTube|Blog|Documentation|FreeCodeCamp|Udemy|Other",
      "reason": "...",
      "difficulty": "beginner|intermediate|advanced"
    }}
  ]
}}"""


def generate_recommendations_llm(context: RAGContext) -> Optional[Dict[str, Any]]:
    """
    Generate personalized external resource recommendations using Ollama Gemma.

    Priority chain:
      1. Ollama Gemma (local LLM — no API key, offline)
      2. Returns None → caller uses curated rule-based fallback
    """
    prompt = _build_prompt(context)

    # ─── Try Ollama Gemma (local) ─────────────────────────────────────────────
    if _ollama_generate is not None:
        try:
            logger.info(f"[AI] Calling Ollama model='{OLLAMA_MODEL}' for RAG recommendations...")
            t0 = time.time()

            raw = _ollama_generate(
                prompt=prompt,
                model=OLLAMA_MODEL,
                system="You are a JSON-only API. Recommend real external learning resources. Respond with valid JSON only. No markdown, no explanation.",
                temperature=0.5,
            )

            if raw:
                result = json.loads(raw)
                if "recommendations" in result and result["recommendations"]:
                    elapsed = time.time() - t0
                    logger.info(
                        f"[AI] Recommendations generated. "
                        f"Ollama response in {elapsed:.2f}s ({len(raw)} chars)"
                    )
                    return result
                else:
                    logger.warning("Ollama response missing 'recommendations' key or empty list")

        except json.JSONDecodeError as e:
            logger.warning(f"Ollama JSON parse error: {e}")
        except Exception as e:
            logger.warning(f"Ollama RAG generation error: {e}")
    else:
        logger.debug("ollama_service not available — skipping Ollama")

    logger.info("Ollama unavailable — will use curated fallback")
    return None


# ─── Curated External Resources (Fallback) ────────────────────────────────────
# These are real, high-quality, free learning resources organized by topic.
# Used when no OpenAI API key is available.

_EXTERNAL_RESOURCES = {
    "Frontend": [
        {
            "title": "React Full Course for Beginners — Bro Code",
            "url": "https://www.youtube.com/watch?v=CgkZ7MvWUAA",
            "source": "YouTube",
            "difficulty": "beginner",
        },
        {
            "title": "React Hooks Tutorial — Codevolution",
            "url": "https://www.youtube.com/watch?v=cF2lQ_gZeA8&list=PLC3y8-rFHvwisvxhZ135pogtX7_Oe3Q3A",
            "source": "YouTube",
            "difficulty": "intermediate",
        },
        {
            "title": "Advanced React Patterns — Kent C. Dodds",
            "url": "https://www.youtube.com/watch?v=WV0UUcSPk-0",
            "source": "YouTube",
            "difficulty": "advanced",
        },
        {
            "title": "React Official Tutorial — Tic-Tac-Toe",
            "url": "https://react.dev/learn/tutorial-tic-tac-toe",
            "source": "Documentation",
            "difficulty": "beginner",
        },
        {
            "title": "React Full Course 2024 — freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=x4rFhThSX04",
            "source": "YouTube",
            "difficulty": "beginner",
        },
    ],
    "Styling": [
        {
            "title": "CSS Flexbox & Grid — Complete Guide",
            "url": "https://www.youtube.com/watch?v=phWxA89Dy94",
            "source": "YouTube",
            "difficulty": "beginner",
        },
        {
            "title": "Tailwind CSS Full Course — Net Ninja",
            "url": "https://www.youtube.com/watch?v=bxmDnn7lrnk&list=PL4cUxeGkcC9gpXORlEHjc5bgnIi5HEGhw",
            "source": "YouTube",
            "difficulty": "beginner",
        },
        {
            "title": "Modern CSS Techniques — Kevin Powell",
            "url": "https://www.youtube.com/watch?v=1PnVor36_40",
            "source": "YouTube",
            "difficulty": "intermediate",
        },
    ],
    "Languages": [
        {
            "title": "TypeScript Full Course — Dave Gray",
            "url": "https://www.youtube.com/watch?v=gieEQFIfgYc",
            "source": "YouTube",
            "difficulty": "beginner",
        },
        {
            "title": "TypeScript for React — Matt Pocock",
            "url": "https://www.youtube.com/watch?v=TPACABQTHvM",
            "source": "YouTube",
            "difficulty": "intermediate",
        },
        {
            "title": "TypeScript Official Handbook",
            "url": "https://www.typescriptlang.org/docs/handbook/intro.html",
            "source": "Documentation",
            "difficulty": "intermediate",
        },
    ],
    "Backend": [
        {
            "title": "Node.js & Express Full Course — freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=Oe421EPjeBE",
            "source": "YouTube",
            "difficulty": "beginner",
        },
        {
            "title": "REST API Design Best Practices",
            "url": "https://www.youtube.com/watch?v=-MTSQjw5DrM",
            "source": "YouTube",
            "difficulty": "intermediate",
        },
        {
            "title": "MDN HTTP Reference",
            "url": "https://developer.mozilla.org/en-US/docs/Web/HTTP",
            "source": "Documentation",
            "difficulty": "beginner",
        },
    ],
    "General": [
        {
            "title": "JavaScript Full Course for Beginners — Bro Code",
            "url": "https://www.youtube.com/watch?v=lfmg-EJ8gm4",
            "source": "YouTube",
            "difficulty": "beginner",
        },
        {
            "title": "Web Development Full Course — freeCodeCamp",
            "url": "https://www.youtube.com/watch?v=zJSY8tbf_ys",
            "source": "YouTube",
            "difficulty": "beginner",
        },
        {
            "title": "The Odin Project — Full Stack Curriculum",
            "url": "https://www.theodinproject.com/",
            "source": "FreeCodeCamp",
            "difficulty": "beginner",
        },
    ],
}


def generate_recommendations_fallback(context: RAGContext) -> Dict[str, Any]:
    """
    Rule-based fallback when LLM is unavailable.
    Selects curated external resources based on the student's topic areas
    and difficulty level.
    """
    logger.info("Using rule-based fallback for external resource recommendations")

    # Determine which categories to pull from based on FAISS-retrieved topics
    relevant_categories = set()
    for candidate in context.recommended_candidates:
        cat = candidate.get("course_category", "General")
        relevant_categories.add(cat)

    if not relevant_categories:
        relevant_categories = {"General"}

    # Collect candidate resources from relevant categories
    pool = []
    for cat in relevant_categories:
        pool.extend(_EXTERNAL_RESOURCES.get(cat, []))
    # Always include some General resources as filler
    pool.extend(_EXTERNAL_RESOURCES.get("General", []))

    # Filter by difficulty — match to user level
    level = context.user_level
    level_priority = {
        "beginner": ["beginner", "intermediate"],
        "intermediate": ["intermediate", "beginner", "advanced"],
        "advanced": ["advanced", "intermediate"],
    }
    preferred = level_priority.get(level, ["beginner", "intermediate", "advanced"])

    # Sort pool: preferred difficulty first, then deduplicate by URL
    seen_urls = set()
    sorted_pool = []
    for pref_level in preferred:
        for res in pool:
            if res["url"] not in seen_urls and res["difficulty"] == pref_level:
                seen_urls.add(res["url"])
                sorted_pool.append(res)

    # Pick top N
    recommendations = []
    for res in sorted_pool[:MAX_RECOMMENDATIONS]:
        # Build a reason
        weak_str = ", ".join(context.weak_topics[:2]) if context.weak_topics else "your current topics"
        reasons = [f"Helps strengthen your understanding of {weak_str}"]
        if context.content_type_preference and res["source"] == "YouTube" and context.content_type_preference == "video":
            reasons.append("Matches your preferred video format")

        recommendations.append({
            "title": res["title"],
            "url": res["url"],
            "source": res["source"],
            "reason": ". ".join(reasons) + ".",
            "difficulty": res["difficulty"],
        })

    return {"recommendations": recommendations}


# ─── Main Entry Point ────────────────────────────────────────────────────────

def get_rag_recommendations(supabase, user_id: str) -> Dict[str, Any]:
    """
    Main entry point — orchestrates the full RAG pipeline.

    Pipeline:
      1. Ensure embedding index is built (lazy initialization)
      2. Load user data from Supabase
      3. Identify weak areas from quiz scores and progress
      4. Retrieve relevant materials via FAISS similarity search
      5. Build augmentation context
      6. Generate recommendations via LLM (or rule-based fallback)
      7. Return structured response

    Args:
        supabase: Supabase client instance
        user_id: UUID of the student

    Returns:
        Dict with 'recommendations' list and 'metadata' dict

    Example response:
    {
        "recommendations": [
            {
                "title": "React Hooks Tutorial — Codevolution",
                "url": "https://www.youtube.com/watch?v=cF2lQ_gZeA8",
                "source": "YouTube",
                "reason": "Helps strengthen your understanding of State Management...",
                "difficulty": "intermediate"
            }
        ],
        "metadata": {
            "user_id": "...",
            "pipeline": "rag",
            "user_level": "beginner",
            "weak_topics": ["State Management - Frontend"],
            "candidates_retrieved": 5,
            "generation_method": "llm",
            "elapsed_seconds": 1.234
        }
    }
    """
    if not user_id or not user_id.strip():
        return {
            "recommendations": [],
            "metadata": {"error": "user_id is required", "pipeline": "rag"},
        }

    t_start = time.time()
    metadata: Dict[str, Any] = {"user_id": user_id, "pipeline": "rag"}

    # ── Cache check: return cached result if still fresh ──
    cached = _response_cache.get(user_id)
    if cached is not None:
        result_dict, expiry = cached
        if time.time() < expiry:
            remaining = int(expiry - time.time())
            logger.info(f"Cache HIT for user={user_id[:8]}... (expires in {remaining}s)")
            return result_dict
        else:
            # Expired — evict
            del _response_cache[user_id]

    # ── Step 1: Ensure embeddings are built (lazy init on first request) ──
    if not _cache.is_ready:
        logger.info("First request — building embedding index...")
        build_result = build_embeddings(supabase)
        metadata["embedding_build"] = build_result

        if not _cache.is_ready:
            elapsed = time.time() - t_start
            return {
                "recommendations": [],
                "metadata": {
                    **metadata,
                    "elapsed_seconds": round(elapsed, 3),
                    "error": "Failed to build embedding index — no materials found in database.",
                },
            }

    # ── Step 2: Load user data ──
    user_data = load_user_data(supabase, user_id)
    metadata["data_loaded"] = {
        "courses": len(user_data.course_progress),
        "materials": len(user_data.material_progress),
        "quizzes": len(user_data.quiz_attempts),
        "completed": len(user_data.completed_material_ids),
    }

    # ── Step 3: Identify weak areas ──
    weak_topics = identify_weak_areas(user_data)
    metadata["weak_topics"] = weak_topics

    # ── Step 4: Retrieve relevant materials via FAISS ──
    content_pref = analyze_telemetry_preferences(user_data)
    candidates = retrieve_materials(
        weak_topics=weak_topics,
        completed_ids=user_data.completed_material_ids,
        top_k=TOP_K_RETRIEVAL,
        content_type_preference=content_pref,
    )
    metadata["candidates_retrieved"] = len(candidates)

    # Edge case: all materials completed
    if not candidates:
        elapsed = time.time() - t_start
        return {
            "recommendations": [],
            "metadata": {
                **metadata,
                "elapsed_seconds": round(elapsed, 3),
                "message": "No uncompleted materials found. You may have completed all available content!",
            },
        }

    # ── Step 5: Build augmentation context ──
    context = build_context(user_data, candidates, weak_topics)
    metadata["user_level"] = context.user_level
    metadata["content_type_preference"] = context.content_type_preference

    # ── Step 6: Generate recommendations (Ollama Gemma → curated fallback) ──
    result = generate_recommendations_llm(context)
    if result is not None:
        metadata["generation_method"] = "llm_ollama_gemma"
    else:
        result = generate_recommendations_fallback(context)
        metadata["generation_method"] = "rule_based_fallback"

    # ── Step 7: Build, cache, and return structured response ──
    elapsed = time.time() - t_start
    metadata["elapsed_seconds"] = round(elapsed, 3)

    logger.info(
        f"Pipeline complete in {elapsed:.3f}s | "
        f"method={metadata['generation_method']} | "
        f"recs={len(result.get('recommendations', []))}"
    )

    final_response = {
        "recommendations": result.get("recommendations", []),
        "metadata": metadata,
    }

    # Store in per-user cache (only cache successful LLM or fallback results)
    _response_cache[user_id] = (final_response, time.time() + RAG_CACHE_TTL_SECONDS)
    logger.info(f"Cached result for user={user_id[:8]}... (TTL={RAG_CACHE_TTL_SECONDS}s)")

    return final_response
