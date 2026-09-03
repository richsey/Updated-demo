from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
import os
import json
import time
import random
from typing import Any, cast
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(dotenv_path=str(Path(__file__).resolve().parent / ".env"))

app = FastAPI()

# Explicit origins required — browsers reject allow_origins=["*"] when
# allow_credentials=True is set (CORS spec disallows the combination).
origins = [
    "https://updated-demo.vercel.app",  # Production (Vercel)
    "http://localhost:5173",             # Vite dev server
    "http://localhost:3000",             # Alt local port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) must be set in `ai-service/.env`."
    )

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

from services.gemini_service import generate_with_gemini, get_gemini_status

@app.get("/")
def home():
    return {"message": "AI Service Connected to Supabase 🚀"}


# ─── Gemini Status ────────────────────────────────────────────────────────────

@app.get("/gemini/status")
async def gemini_status():
    """
    Health-check for the Google Gemini integration.
    Returns configured status, ready status, and test error if any.
    """
    return get_gemini_status()


from services.recommendation_engine import RecommendationEngine, build_index as build_rag_index
from typing import List

class RecommendRequest(BaseModel):
    user_id: str
    interests: List[str] = []


@app.post("/recommend")
async def recommend(payload: RecommendRequest):
    engine = RecommendationEngine(supabase)
    return engine.get_recommendations(payload.user_id, payload.interests)


# ─── Progress-based Recommendation ────────────────────────────────────────────

class ProgressRecommendRequest(BaseModel):
    user_id: str
    course_id: str
    progress: float
    completed_materials: int
    total_materials: int


def classify_level(progress: float) -> str:
    """Classify user difficulty level based on progress percentage."""
    if progress <= 30:
        return "beginner"
    elif progress <= 70:
        return "intermediate"
    else:
        return "advanced"


def get_level_message(level: str, progress: float) -> str:
    """Generate a motivational message based on level."""
    messages = {
        "beginner": f"You're just getting started ({progress:.0f}%)! Keep going — every lesson counts.",
        "intermediate": f"Great progress at {progress:.0f}%! You're building solid understanding.",
        "advanced": f"Almost there at {progress:.0f}%! You're mastering this course.",
    }
    return messages.get(level, f"You're at {progress:.0f}% progress.")


@app.post("/recommend/progress")
async def recommend_progress(payload: ProgressRecommendRequest):
    """
    Accept user progress data, classify level, and recommend next material.
    """
    level = classify_level(payload.progress)
    message = get_level_message(level, payload.progress)

    # Find uncompleted materials for this course
    recommended_next_material = None
    try:
        # Get all materials for the course
        materials_resp = (
            supabase.table("materials")
            .select("id, title, type, duration_minutes")
            .eq("course_id", payload.course_id)
            .order("created_at", desc=False)
            .execute()
        )
        all_materials = materials_resp.data or []

        # Get user's completed material IDs for this course
        completed_resp = (
            supabase.table("user_material_progress")
            .select("material_id")
            .eq("user_id", payload.user_id)
            .eq("completed", True)
            .execute()
        )
        completed_ids = {r["material_id"] for r in (completed_resp.data or [])}

        # Find first uncompleted material
        for mat in all_materials:
            if mat["id"] not in completed_ids:
                recommended_next_material = {
                    "id": mat["id"],
                    "title": mat["title"],
                    "type": mat.get("type", "unknown"),
                    "duration_minutes": mat.get("duration_minutes", 0),
                }
                break
    except Exception as e:
        print(f"[AI] Error fetching next material: {e}")

    return {
        "recommended_next_material": recommended_next_material,
        "difficulty_level": level,
        "message": message,
        "progress": payload.progress,
        "completed_materials": payload.completed_materials,
        "total_materials": payload.total_materials,
    }


# ─── RAG Recommendation Engine ────────────────────────────────────────────────

class RAGRequest(BaseModel):
    user_id: str


@app.post("/recommend/rag")
async def recommend_rag(payload: RAGRequest):
    """
    RAG-powered recommendation endpoint.
    Uses sentence-transformers + FAISS retrieval + Ollama/LLM
    to produce personalized, context-aware material recommendations.

    Input:  { "user_id": "uuid" }
    Output: { "recommendations": [...], "metadata": {...} }
    """
    try:
        engine = RecommendationEngine(supabase)
        result = engine.get_rag_recommendations(payload.user_id)
        return result
    except Exception as e:
        return {
            "recommendations": [],
            "metadata": {
                "user_id": payload.user_id,
                "error": str(e),
                "pipeline": "rag",
                "message": "An error occurred during recommendation generation.",
            },
        }


@app.post("/recommend/rag/rebuild")
async def rebuild_rag_index():
    """
    Admin endpoint to force-rebuild the embedding index.
    Call this after adding/updating course materials.

    Input:  (none)
    Output: { "status": "rebuilt", "material_count": N, "built_at": timestamp }
    """
    try:
        result = build_rag_index(supabase)
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ─── AI Quiz Generator ────────────────────────────────────────────────────────

class QuizGenerateRequest(BaseModel):
    course_id: str
    num_questions: int = 5
    difficulty: str = "intermediate"  # beginner | intermediate | advanced


# Curated fallback questions per category (used when no OpenAI key)
_FALLBACK_QUESTIONS = {
    "Frontend": [
        {"text": "What is the virtual DOM in React?", "options": ["A direct copy of the real DOM", "A lightweight in-memory representation of the real DOM", "A CSS framework", "A database layer"], "correct_index": 1, "explanation": "The virtual DOM is a lightweight JavaScript representation of the real DOM that React uses to efficiently determine what needs to update."},
        {"text": "Which hook is used to manage side effects in React?", "options": ["useState", "useEffect", "useRef", "useMemo"], "correct_index": 1, "explanation": "useEffect is the React hook designed for handling side effects like fetching data, subscriptions, and DOM manipulation."},
        {"text": "What does JSX stand for?", "options": ["JavaScript XML", "JavaScript Extension", "Java Syntax Extension", "JSON XML Schema"], "correct_index": 0, "explanation": "JSX stands for JavaScript XML — it allows writing HTML-like syntax in JavaScript files."},
        {"text": "Which method is used to update state in a functional component?", "options": ["this.setState()", "useState() setter function", "setState()", "updateState()"], "correct_index": 1, "explanation": "In functional components, the setter function returned by useState() is used to update state."},
        {"text": "What is the purpose of React.memo()?", "options": ["To memorize user inputs", "To prevent unnecessary re-renders by memoizing component output", "To store data in memory", "To create memos in the app"], "correct_index": 1, "explanation": "React.memo() is a higher-order component that memoizes a component's output to skip re-renders when props haven't changed."},
    ],
    "Styling": [
        {"text": "What does the 'flex' property do in CSS?", "options": ["Makes an element invisible", "Enables flexible box layout", "Adds a border", "Changes font size"], "correct_index": 1, "explanation": "display: flex enables the Flexible Box Layout model, allowing items to be aligned and distributed within a container."},
        {"text": "Which CSS property controls the space between grid items?", "options": ["margin", "gap", "padding", "spacing"], "correct_index": 1, "explanation": "The gap property (formerly grid-gap) sets the spacing between rows and columns in a grid or flex container."},
        {"text": "In Tailwind CSS, what does 'p-4' mean?", "options": ["Padding of 4rem", "Padding of 1rem (16px)", "Padding of 4px", "Position 4"], "correct_index": 1, "explanation": "In Tailwind, p-4 applies padding of 1rem (16px) on all sides. Each unit is 0.25rem."},
        {"text": "What is the CSS box model order from inside out?", "options": ["Margin, border, padding, content", "Content, padding, border, margin", "Padding, content, margin, border", "Content, margin, padding, border"], "correct_index": 1, "explanation": "The CSS box model goes: content (innermost), then padding, then border, then margin (outermost)."},
        {"text": "What does 'position: sticky' do?", "options": ["Fixes element forever", "Toggles between relative and fixed based on scroll position", "Makes element invisible", "Removes element from flow"], "correct_index": 1, "explanation": "position: sticky makes an element act as relative until it reaches a scroll threshold, then it becomes fixed."},
    ],
    "Languages": [
        {"text": "What is the main benefit of TypeScript over JavaScript?", "options": ["Faster execution", "Static type checking at compile time", "Smaller file sizes", "Better styling"], "correct_index": 1, "explanation": "TypeScript adds static type checking, catching type errors during development before runtime."},
        {"text": "What does the 'interface' keyword do in TypeScript?", "options": ["Creates a class", "Defines a contract for object shapes", "Imports a module", "Declares a variable"], "correct_index": 1, "explanation": "An interface in TypeScript defines a contract specifying what properties and methods an object should have."},
        {"text": "What is a union type in TypeScript?", "options": ["A type that combines two arrays", "A type that can be one of several types", "A special number type", "A CSS type"], "correct_index": 1, "explanation": "A union type (using |) allows a value to be one of several types, e.g., string | number."},
        {"text": "What does 'readonly' modifier do in TypeScript?", "options": ["Makes a property optional", "Prevents a property from being modified after creation", "Makes a property private", "Adds validation"], "correct_index": 1, "explanation": "The readonly modifier prevents a property from being reassigned after the object is created."},
        {"text": "What is a generic type in TypeScript?", "options": ["A type that works with any data type", "A type for numbers only", "A CSS class", "A React component"], "correct_index": 0, "explanation": "Generics allow creating reusable components that work with multiple types while maintaining type safety, e.g., Array<T>."},
    ],
    "Backend": [
        {"text": "What is middleware in Express.js?", "options": ["A database layer", "Functions that execute during the request-response cycle", "A CSS framework", "A frontend library"], "correct_index": 1, "explanation": "Middleware functions have access to the request and response objects and can modify them or end the cycle."},
        {"text": "What HTTP method is typically used to create a new resource?", "options": ["GET", "POST", "PUT", "DELETE"], "correct_index": 1, "explanation": "POST is the standard HTTP method for creating new resources on a server."},
        {"text": "What does CORS stand for?", "options": ["Cross-Origin Resource Sharing", "Create Origin Resource System", "Client Object Request Service", "Central Origin Response Server"], "correct_index": 0, "explanation": "CORS (Cross-Origin Resource Sharing) is a security mechanism that allows or restricts resource requests from different origins."},
        {"text": "What is the purpose of environment variables?", "options": ["To style the app", "To store configuration outside the codebase", "To create animations", "To format code"], "correct_index": 1, "explanation": "Environment variables store sensitive configuration (API keys, DB URLs) outside the code, keeping them secure."},
        {"text": "What status code indicates a successful POST request that created a resource?", "options": ["200", "201", "404", "500"], "correct_index": 1, "explanation": "HTTP 201 (Created) indicates that a request was successful and a new resource was created as a result."},
    ],
    "General": [
        {"text": "What does API stand for?", "options": ["Application Programming Interface", "Advanced Program Integration", "Automated Processing Input", "Application Process Integration"], "correct_index": 0, "explanation": "API stands for Application Programming Interface — a set of rules for building and interacting with software."},
        {"text": "What is the difference between let and const in JavaScript?", "options": ["No difference", "let can be reassigned, const cannot", "const is faster", "let is deprecated"], "correct_index": 1, "explanation": "let declares a reassignable variable while const declares a constant that cannot be reassigned after initialization."},
        {"text": "What is a Promise in JavaScript?", "options": ["A guarantee of performance", "An object representing the eventual completion of an async operation", "A type of loop", "A CSS property"], "correct_index": 1, "explanation": "A Promise represents an asynchronous operation that will eventually resolve with a value or reject with an error."},
        {"text": "What does JSON stand for?", "options": ["JavaScript Object Notation", "Java Standard Object Network", "JavaScript Online Notation", "Java Serialized Object Network"], "correct_index": 0, "explanation": "JSON (JavaScript Object Notation) is a lightweight data interchange format used for structured data."},
        {"text": "What is version control used for?", "options": ["Controlling app speed", "Tracking and managing changes to code", "Managing CSS versions", "Controlling API versions"], "correct_index": 1, "explanation": "Version control (like Git) tracks changes to files over time, enabling collaboration and history management."},
    ],
}


@app.post("/quiz/generate")
async def generate_quiz(payload: QuizGenerateRequest):
    """
    AI-Powered Quiz Generator.
    Generates practice quiz questions based on course materials using GPT-4o-mini.
    Falls back to curated questions if no OpenAI key is available.

    Input:  { "course_id": "uuid", "num_questions": 5, "difficulty": "intermediate" }
    Output: { "questions": [...], "metadata": {...} }
    """
    t_start = time.time()
    metadata: dict[str, Any] = {
        "course_id": payload.course_id,
        "difficulty": payload.difficulty,
        "num_questions": payload.num_questions,
    }

    # 1. Fetch course + materials info from Supabase
    try:
        course_resp = (
            supabase.table("courses")
            .select("title, category, difficulty")
            .eq("id", payload.course_id)
            .single()
            .execute()
        )
        course = course_resp.data
    except Exception as e:
        return {
            "questions": [],
            "metadata": {**metadata, "error": f"Course not found: {e}"},
        }

    if not course:
        return {
            "questions": [],
            "metadata": {**metadata, "error": "Course not found"},
        }

    metadata["course_title"] = course["title"]
    metadata["course_category"] = course.get("category", "General")

    # Fetch material titles for context
    try:
        mat_resp = (
            supabase.table("materials")
            .select("title, type")
            .eq("course_id", payload.course_id)
            .order("order_index", desc=False)
            .execute()
        )
        materials = mat_resp.data or []
    except Exception:
        materials = []

    material_list = ", ".join(m["title"] for m in materials) if materials else "general course content"
    metadata["material_count"] = len(materials)

    # Build the shared quiz prompt (used by both Ollama and Gemini)
    quiz_prompt = f"""Generate exactly {payload.num_questions} multiple-choice quiz questions for a {payload.difficulty}-level student.

Course: {course['title']}
Category: {course.get('category', 'General')}
Topics covered: {material_list}

RULES:
- Each question must have exactly 4 options
- Only ONE correct answer per question
- Include a clear explanation for the correct answer
- Questions should test understanding, not just memorization
- Difficulty level: {payload.difficulty}
  * beginner: basic concepts and definitions
  * intermediate: application and understanding
  * advanced: analysis, edge cases, and best practices

You MUST respond with ONLY valid JSON in this exact format:
{{
  "questions": [
    {{
      "text": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Why this answer is correct..."
    }}
  ]
}}"""

    questions = None
    # 2. Try Google Gemini first
    try:
        raw = generate_with_gemini(
            prompt=quiz_prompt,
            system_instruction="You are a quiz generator API. Generate educational multiple-choice questions. Respond with valid JSON only, no markdown code fences.",
            json_mode=True,
            temperature=0.8,
        )
        if raw:
            parsed = json.loads(raw)
            questions = parsed.get("questions", [])
            if questions:
                metadata["generation_method"] = "llm_gemini"
                print(f"[QuizGen] Gemini generated {len(questions)} questions")
            else:
                questions = None
    except Exception as e:
        print(f"[QuizGen] Gemini error: {e}")
        questions = None

    # 3. Fallback to curated questions
    if not questions:
        category = course.get("category", "General")
        pool = _FALLBACK_QUESTIONS.get(category, _FALLBACK_QUESTIONS["General"])
        # Shuffle and pick requested number
        shuffled = random.sample(pool, min(payload.num_questions, len(pool)))
        questions = shuffled
        metadata["generation_method"] = "curated_fallback"

    # 4. Ensure correct format with order_index
    for i, q in enumerate(questions):
        q["order_index"] = i

    elapsed = time.time() - t_start
    metadata["elapsed_seconds"] = round(elapsed, 3)

    return {"questions": questions, "metadata": metadata}