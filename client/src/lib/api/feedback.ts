// src/lib/api/feedback.ts
// Course feedback — submit and view student feedback

import { supabase } from "@/lib/supabase";
import type { Feedback } from "@/lib/types";

export type { Feedback };

/** Submit feedback for a course (one per student per course) */
export async function submitFeedback(
  userId: string,
  courseId: string,
  rating: number,
  comment?: string
): Promise<void> {
  const { error } = await supabase
    .from("feedback")
    // @ts-expect-error feedback upsert type strictness for extended fields
    .upsert(
      [{ user_id: userId, course_id: courseId, rating, comment: comment ?? null }],
      { onConflict: "user_id,course_id" }
    );

  if (error) throw new Error(`Submit feedback failed: ${error.message}`);
}

/** Get feedback the user has submitted for a course */
export async function getUserFeedbackForCourse(
  userId: string,
  courseId: string
): Promise<Feedback | null> {
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) return null;
  return data as Feedback | null;
}

/** Get all feedback for courses taught by a lecturer */
export async function fetchLecturerFeedback(lecturerId: string): Promise<Feedback[]> {
  // First get the courses for this lecturer
  const { data: courses } = await supabase
    .from("courses")
    .select("id")
    .eq("lecturer_id", lecturerId);

  if (!courses || courses.length === 0) return [];

  const courseIds = (courses as unknown as Array<{ id: string }>).map((c) => c.id);
  const { data: fb, error } = await supabase
    .from("feedback")
    .select(
      "id, user_id, course_id, rating, comment, is_read, created_at, profiles(full_name, email), courses(title)"
    )
    .in("course_id", courseIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch lecturer feedback failed: ${error.message}`);
  return (fb as Feedback[]) ?? [];
}

/** Mark feedback as read (lecturer action) */
export async function markFeedbackRead(feedbackId: string): Promise<void> {
  const { error } = await supabase
    .from("feedback")
    // @ts-expect-error feedback update type strictness
    .update({ is_read: true })
    .eq("id", feedbackId);

  if (error) throw new Error(`Mark feedback read failed: ${error.message}`);
}
