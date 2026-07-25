import { supabase } from "@/lib/supabase";

export const MIN_QUIZ_TIME = 5; // seconds
export const COOLDOWN_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function detectGuessing(timeTaken: number) {
  return timeTaken < MIN_QUIZ_TIME;
}

/**
 * Records a quiz cooldown start for the user in Supabase.
 */
export async function startCooldown(userId: string, quizId: string) {
  // @ts-expect-error Supabase schema divergence
  await supabase.from("telemetry").insert({
    user_id: userId,
    event_type: "quiz_cooldown_start",
    entity_id: quizId,
    metadata: { startedAt: Date.now() },
  });
}

/**
 * Returns true if the user is still in cooldown for the given quiz.
 */
export async function isQuizLocked(userId: string, quizId: string): Promise<boolean> {
  const { data } = await supabase
    .from("telemetry")
    .select("metadata, created_at")
    .eq("user_id", userId)
    .eq("event_type", "quiz_cooldown_start")
    .eq("entity_id", quizId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return false;
  const elapsed = Date.now() - new Date((data as unknown as { created_at: string }).created_at).getTime();
  return elapsed < COOLDOWN_DURATION_MS;
}