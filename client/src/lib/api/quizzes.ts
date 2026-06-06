// src/lib/api/quizzes.ts
// All quiz-related database operations

import { supabase } from "@/lib/supabase";

// ─── Helper: fetch questions for one or more quiz IDs ─────────────────────────
// Using separate queries instead of PostgREST join syntax (questions(*))
// because the join requires a foreign key constraint in Supabase which may
// not be set up — a 500 error is returned when it's missing.

async function fetchQuestionsForQuiz(quizId: string) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("quizzes_id", quizId);

  if (error) {
    console.warn("[Quizzes] Could not load questions for quiz", quizId, error.message);
    return [];
  }
  return data ?? [];
}

async function fetchQuestionsForQuizzes(quizIds: string[]) {
  if (quizIds.length === 0) return [];
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .in("quizzes_id", quizIds);

  if (error) {
    console.warn("[Quizzes] Could not load questions batch:", error.message);
    return [];
  }
  return data ?? [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchQuizzes() {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  const quizzes: any[] = data ?? [];

  // Attach questions to each quiz
  const questions = await fetchQuestionsForQuizzes(quizzes.map((q) => q.id));
  return quizzes.map((quiz) => ({
    ...quiz,
    questions: questions.filter((q: any) => q.quizzes_id === quiz.id),
  }));
}

export async function fetchQuizById(quizId: string) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .single();

  if (error) throw error;
  if (!data) return null;

  const questions = await fetchQuestionsForQuiz(quizId);
  return { ...(data as any), questions };
}

export async function fetchQuizByCourseId(courseId: string) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const questions = await fetchQuestionsForQuiz((data as any).id);
  return { ...(data as any), questions };
}

export async function saveQuizAttempt(attempt: {
  user_id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  duration_seconds: number;
}) {
  const { data, error } = await supabase
    .from("quiz_attempts")
    // Tell TS to trust us on the shape of this insert
    // since the DB will auto-generate 'id' and 'created_at'
    .insert(attempt as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchUserQuizAttempts(userId: string) {
  // Fetch attempts first
  const { data: attempts, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!attempts || attempts.length === 0) return [];

  // Fetch related quizzes separately to avoid join issues
  const quizIds = [...new Set(attempts.map((a: any) => a.quiz_id))];
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, course_id")
    .in("id", quizIds);

  const quizMap = Object.fromEntries((quizzes ?? []).map((q: any) => [q.id, q]));

  return (attempts as any[]).map((attempt: any) => ({
    ...attempt,
    quizzes: quizMap[attempt.quiz_id] ?? null,
  }));
}