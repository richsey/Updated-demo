// src/lib/api/quizzes.ts
// All quiz-related database operations

import { supabase } from "@/lib/supabase";
import type { Quiz, Question, QuizRow, QuizAttempt } from "@/lib/types";

export type { Quiz, Question, QuizAttempt };

// ─── Helper: fetch questions for one or more quiz IDs ─────────────────────────
// Using separate queries instead of PostgREST join syntax (questions(*))
// because the join requires a foreign key constraint in Supabase which may
// not be set up — a 500 error is returned when it's missing.

async function fetchQuestionsForQuiz(quizId: string): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("quizzes_id", quizId);

  if (error) {
    console.warn("[Quizzes] Could not load questions for quiz", quizId, error.message);
    return [];
  }
  return (data ?? []) as Question[];
}

async function fetchQuestionsForQuizzes(quizIds: string[]): Promise<Question[]> {
  if (quizIds.length === 0) return [];
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .in("quizzes_id", quizIds);

  if (error) {
    console.warn("[Quizzes] Could not load questions batch:", error.message);
    return [];
  }
  return (data ?? []) as Question[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchQuizzes(): Promise<Quiz[]> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  const quizzes = (data ?? []) as QuizRow[];

  // Attach questions to each quiz
  const questions = await fetchQuestionsForQuizzes(quizzes.map((q) => q.id));
  return quizzes.map((quiz) => ({
    ...quiz,
    questions: questions.filter((q) => q.quizzes_id === quiz.id),
  }));
}

export async function fetchQuizById(quizId: string): Promise<Quiz | null> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("id", quizId)
    .single();

  if (error) throw error;
  if (!data) return null;

  const questions = await fetchQuestionsForQuiz(quizId);
  return { ...(data as QuizRow), questions };
}

export async function fetchQuizByCourseId(courseId: string): Promise<Quiz | null> {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const quiz = data as QuizRow;
  const questions = await fetchQuestionsForQuiz(quiz.id);
  return { ...quiz, questions };
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
    // @ts-expect-error quiz_attempts insert type strictness
    .insert(attempt)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchUserQuizAttempts(userId: string): Promise<QuizAttempt[]> {
  // Fetch attempts first
  const { data: attempts, error } = await supabase
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!attempts || attempts.length === 0) return [];

  // Fetch related quizzes separately to avoid join issues
  const quizIds = [...new Set(attempts.map((a) => (a as unknown as { quiz_id: string }).quiz_id))];
  const { data: quizzes } = await supabase
    .from("quizzes")
    .select("id, title, course_id")
    .in("id", quizIds);

  const quizMap = Object.fromEntries((quizzes ?? []).map((q) => [(q as unknown as { id: string }).id, q]));

  return attempts.map((attempt) => ({
    ...(attempt as unknown as Omit<QuizAttempt, "quizzes">),
    quizzes: quizMap[(attempt as unknown as { quiz_id: string }).quiz_id] ?? null,
  })) as QuizAttempt[];
}