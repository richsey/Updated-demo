// src/lib/api/admin.ts
// Admin dashboard analytics — aggregated from Supabase

import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";

export async function fetchAdminStats() {
  // Run all queries in parallel
  const [
    { count: totalStudents },
    { count: totalCourses },
    { count: totalAttempts },
    engagementResult,
    quizPerfResult,
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "student"),
    supabase.from("courses").select("*", { count: "exact", head: true }),
    supabase.from("quiz_attempts").select("*", { count: "exact", head: true }),

    // Engagement: attempts per day over the last 8 days
    // TODO: Define RPC return type once function exists in Supabase
    supabase.rpc("get_daily_engagement" as any, { days_back: 8 } as any).select("*"),

  // Quiz performance: avg score grouped by course
  supabase
    .from("quiz_attempts")
    .select("quiz_id, score, total_questions, quizzes(title, course_id, courses(title))")
    .order("created_at", { ascending: false }),
  ]);

  type QuizAttemptWithJoins = {
    quiz_id: string;
    score: number;
    total_questions: number;
    quizzes: {
      course_id: string;
      title: string;
      courses: {
        title: string;
      } | null;
    } | null;
  };

  // Process quiz performance
  const perfMap: Record<string, { total: number; count: number; title: string }> = {};
  if (quizPerfResult.data) {
    for (const row of quizPerfResult.data as QuizAttemptWithJoins[]) {
      const courseTitle = row.quizzes?.courses?.title ?? "Unknown";
      const key = row.quizzes?.course_id ?? row.quiz_id;
      if (!perfMap[key]) perfMap[key] = { total: 0, count: 0, title: courseTitle };
      perfMap[key].total += (row.score / row.total_questions) * 100;
      perfMap[key].count += 1;
    }
  }

  const quizPerformance = Object.values(perfMap).map((v) => ({
    course: v.title,
    avgScore: Math.round(v.total / v.count),
    attempts: v.count,
  }));

  return {
    totalStudents: totalStudents ?? 0,
    activeCourses: totalCourses ?? 0,
    totalQuizAttempts: totalAttempts ?? 0,
    avgEngagement:
      quizPerformance.length > 0
        ? Math.round(quizPerformance.reduce((s, v) => s + v.avgScore, 0) / quizPerformance.length)
        : 0,
    quizPerformance,
    // Daily engagement will come from the RPC if set up, else empty
    studentEngagement: engagementResult.data ?? [],
  };
}

/**
 * Fetch all student progress for the admin view.
 */
export async function fetchAllStudentProgress() {
  const { data, error } = await supabase
    .from("student_progress")
    .select("*, profiles(full_name, email), courses(title)")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Fetch all telemetry events with student info.
 */
export async function fetchAllTelemetry(limit = 100) {
  const { data, error } = await supabase
    .from("telemetry")
    .select("*, profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ─── Student Detail ───────────────────────────────────────────────────────────

export interface StudentCourseEnrollment {
  courseId: string;
  courseTitle: string;
  category: string;
  progress: number; // 0-100
}

export interface StudentDetail {
  id: string;
  fullName: string;
  email: string;
  courses: StudentCourseEnrollment[];
}

/**
 * Fetch all students with the list of courses they're enrolled in and their progress.
 */
export async function fetchStudentsWithCourses(): Promise<StudentDetail[]> {
  // 1. Get all student profiles
  const { data: profiles, error: profErr } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("role", "student")
    .order("full_name", { ascending: true });

  if (profErr) throw profErr;
  if (!profiles || profiles.length === 0) return [];

  // 2. Get all progress records joined with course info
  const { data: progressRows, error: progErr } = await supabase
    .from("user_course_progress")
    .select("user_id, course_id, progress, courses(title, category)")
    .order("created_at", { ascending: false });

  // Fallback to student_progress table if user_course_progress doesn't exist
  const progressData = progressRows ?? [];
  const progressError = progErr;

  // If first table failed, try the other common table name
  let finalProgress: any[] = progressData;
  if (progressError || progressData.length === 0) {
    const { data: fallback } = await supabase
      .from("student_progress")
      .select("user_id, course_id, progress, courses(title, category)");
    finalProgress = fallback ?? [];
  }

  // 3. Build a map: userId → list of courses
  const progressByUser: Record<string, StudentCourseEnrollment[]> = {};
  for (const row of finalProgress as any[]) {
    const uid = row.user_id;
    if (!progressByUser[uid]) progressByUser[uid] = [];
    progressByUser[uid].push({
      courseId: row.course_id,
      courseTitle: row.courses?.title ?? "Unknown Course",
      category: row.courses?.category ?? "",
      progress: Math.round(row.progress ?? 0),
    });
  }

  // 4. Combine profiles with their courses
  return profiles.map((p: any) => ({
    id: p.id,
    fullName: p.full_name || p.email || "Unknown",
    email: p.email || "",
    courses: progressByUser[p.id] ?? [],
  }));
}

