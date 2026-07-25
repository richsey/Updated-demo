// src/lib/telemetry/studentTracker.ts
// All telemetry events are now stored in Supabase instead of localStorage.
// The functions maintain the same signatures for easy drop-in replacement.

import { supabase } from "@/lib/supabase";
import { updateMaterialProgress } from "@/lib/api/progress";

async function logEvent(
  userId: string,
  eventType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) {
  // @ts-expect-error Supabase schema divergence
  await supabase.from("telemetry").insert({
    user_id: userId,
    event_type: eventType,
    entity_id: entityId,
    metadata,
  });
}

// ─── 1. Track Video Replays ──────────────────────────────────────────────────
export async function trackVideoReplay(userId: string, videoId: string) {
  await logEvent(userId, "video_replay", videoId);

  // Count replays from Supabase to decide whether to surface a warning
  const { count } = await supabase
    .from("telemetry")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "video_replay")
    .eq("entity_id", videoId);

  if ((count ?? 0) >= 3) {
    console.warn(`[Telemetry] Student is struggling with video ${videoId}.`);
    return true;
  }
  return false;
}

// ─── 2. Track Quiz Failures ──────────────────────────────────────────────────
export async function trackQuizFailure(userId: string, quizId: string) {
  await logEvent(userId, "quiz_failure", quizId);

  const { count } = await supabase
    .from("telemetry")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "quiz_failure")
    .eq("entity_id", quizId);

  if ((count ?? 0) >= 2) {
    console.warn(`[Telemetry] Student failed quiz ${quizId} twice.`);
    return true;
  }
  return false;
}

// ─── 3. Track Lesson Abandonment ─────────────────────────────────────────────
export async function trackLessonAbandonment(
  userId: string,
  lessonId: string,
  timeSpentSeconds: number,
  hasFinished: boolean
) {
  if (!hasFinished && timeSpentSeconds < 60) {
    await logEvent(userId, "lesson_abandoned", lessonId, { timeSpentSeconds });
    return true;
  }
  return false;
}

// ─── 4. Track Course Drop-off ────────────────────────────────────────────────
export async function trackCourseDropoff(userId: string, courseId: string) {
  await logEvent(userId, "course_dropoff", courseId);
  return true;
}

// ─── 5. Track Tutorial Ignored ────────────────────────────────────────────────
export async function trackPdfIgnored(userId: string, lessonId: string) {
  await logEvent(userId, "tutorial_ignored", lessonId);
}

// ─── 6. Track Tutorial Opened ─────────────────────────────────────────────────
export async function trackPdfOpen(userId: string, lessonId: string) {
  await logEvent(userId, "tutorial_opened", lessonId);
}

// ─── 7. Track Tutorial Reading Time ──────────────────────────────────────────
export async function trackPdfReadingTime(
  userId: string,
  lessonId: string,
  durationSeconds: number
) {
  await logEvent(userId, "tutorial_time", lessonId, { durationSeconds });

  // Fetch existing time and update material_progress
  const { data } = await supabase
    .from("material_progress")
    .select("time_spent_seconds")
    .eq("user_id", userId)
    .eq("material_id", lessonId)
    .single();

  const totalTime = ((data as unknown as { time_spent_seconds: number })?.time_spent_seconds ?? 0) + durationSeconds;
  // Goal: 60 seconds of reading = "done"
  const progressPct = Math.min(100, Math.floor((totalTime / 60) * 100));
  await updateMaterialProgress(userId, lessonId, progressPct, totalTime);

  if (durationSeconds < 10) {
    await logEvent(userId, "tutorial_skipped", lessonId, { durationSeconds });
  }
}

// ─── 8. Track Video Progress ─────────────────────────────────────────────────
export async function trackVideoProgress(
  userId: string,
  materialId: string,
  progressPct: number,
  timeSpentSeconds: number
) {
  await updateMaterialProgress(userId, materialId, progressPct, timeSpentSeconds);
}

// ─── 9. getCourseProgress — now use computeCourseProgress from api/progress ──
// Kept for backward compat; just re-exports the async version.
export { computeCourseProgress as getCourseProgress } from "@/lib/api/progress";