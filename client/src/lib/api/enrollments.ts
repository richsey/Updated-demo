// src/lib/api/enrollments.ts
// Enrollment management — explicit enroll/unenroll for courses

import { supabase } from "@/lib/supabase";
import type { Enrollment } from "@/lib/types";

export type { Enrollment };

/** Check if the current user is enrolled in a specific course */
export async function isEnrolled(userId: string, courseId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) {
    console.error("[Enrollments] isEnrolled check failed:", error);
    return false;
  }
  return !!data;
}

/** Enroll the current user in a course */
export async function enrollInCourse(userId: string, courseId: string): Promise<void> {
  const { error } = await supabase
    .from("enrollments")
    // @ts-expect-error enrollments insert type strictness
    .insert([{ user_id: userId, course_id: courseId }]);

  if (error && error.code !== "23505") {
    // 23505 = unique constraint (already enrolled) — treat as no-op
    throw new Error(`Enrollment failed: ${error.message}`);
  }
}

/** Unenroll the current user from a course */
export async function unenrollFromCourse(userId: string, courseId: string): Promise<void> {
  const { error } = await supabase
    .from("enrollments")
    .delete()
    .eq("user_id", userId)
    .eq("course_id", courseId);

  if (error) throw new Error(`Unenroll failed: ${error.message}`);
}

/** Get all courses a user is enrolled in */
export async function fetchUserEnrollments(userId: string): Promise<Enrollment[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select(
      "id, user_id, course_id, enrolled_at, courses(id, title, description, category, difficulty, thumbnail, instructor, rating, duration_minutes, enrolled_count, status, is_published)"
    )
    .eq("user_id", userId)
    .order("enrolled_at", { ascending: false });

  if (error) throw new Error(`Fetch enrollments failed: ${error.message}`);
  return (data as Enrollment[]) ?? [];
}

/** Get the count of students enrolled in a specific course */
export async function fetchCourseEnrollmentCount(courseId: string): Promise<number> {
  const { count, error } = await supabase
    .from("enrollments")
    .select("*", { count: "exact", head: true })
    .eq("course_id", courseId);

  if (error) return 0;
  return count ?? 0;
}
