// src/lib/api/progress.ts
// Unified student progress tracking — stored in Supabase
// Tables: user_course_progress and user_material_progress

import { supabase } from "@/lib/supabase";

/**
 * Get progress for all courses for a user.
 */
export async function fetchUserProgress(userId: string) {
  const { data, error } = await (supabase.from("user_course_progress") as any)
    .select("*, courses(title)")
    .eq("user_id", userId)
    .order("last_updated", { ascending: false });

  if (error) throw error;
  return (data as any[]) || [];
}

/**
 * Get progress for a specific course.
 */
export async function fetchCourseProgress(userId: string, courseId: string) {
  const { data } = await (supabase.from("user_course_progress") as any)
    .select("progress")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  return (data as any)?.progress ?? 0;
}

/**
 * Upsert course-level progress (0–100).
 */
export async function updateCourseProgress(
  userId: string,
  courseId: string,
  progress: number,
  completedMaterials?: number,
  totalMaterials?: number
) {
  let finalCompleted = completedMaterials;
  let finalTotal = totalMaterials;

  if (finalCompleted === undefined || finalTotal === undefined) {
    const { data: materials } = await supabase
      .from("materials")
      .select("id")
      .eq("course_id", courseId);
    
    if (materials && materials.length > 0) {
      finalTotal = materials.length;
      const materialIds = materials.map((m: any) => m.id);
      const { count } = await (supabase.from("user_material_progress") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("completed", true)
        .in("material_id", materialIds);
      finalCompleted = count || 0;
    } else {
      finalCompleted = 0;
      finalTotal = 0;
    }
  }

  const { error } = await (supabase.from("user_course_progress") as any).upsert(
    {
      user_id: userId,
      course_id: courseId,
      progress: Math.min(100, Math.max(0, progress)),
      completed_materials: finalCompleted,
      total_materials: finalTotal,
      last_updated: new Date().toISOString(),
    },
    { onConflict: "user_id,course_id" }
  );

  if (error) throw error;
}

// ─── Material-level progress ─────────────────────────────────────────────────

/**
 * Get progress percentage for a single material.
 */
export async function fetchMaterialProgress(userId: string, materialId: string) {
  const { data } = await (supabase.from("user_material_progress") as any)
    .select("completed")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .maybeSingle();

  return (data as any)
    ? { progress_pct: (data as any).completed ? 100 : 0, completed: (data as any).completed ?? false }
    : { progress_pct: 0, completed: false };
}

/**
 * Update material progress (Supabase direct).
 */
export async function updateMaterialProgress(
  userId: string,
  materialId: string,
  progressPct: number,
  _timeSpentSeconds: number
) {
  const isCompleted = progressPct >= 90;

  const { error } = await (supabase.from("user_material_progress") as any).upsert(
    {
      user_id: userId,
      material_id: materialId,
      completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,material_id" }
  );

  if (error) throw error;
}

/**
 * Force recompute/sync course progress via unified logic.
 */
export async function syncCourseProgress(userId: string, courseId: string) {
  const { data: materials } = await supabase
    .from("materials")
    .select("id")
    .eq("course_id", courseId);
  if (!materials?.length) return { progress: 0 };

  const materialIds = (materials as any[]).map((m) => m.id);

  const { count } = await (supabase.from("user_material_progress") as any)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true)
    .in("material_id", materialIds);

  const completedCount = count || 0;
  const progress = Math.round((completedCount / materialIds.length) * 100);

  await updateCourseProgress(userId, courseId, progress, completedCount, materialIds.length);

  return { progress, completed_materials: completedCount, total_materials: materialIds.length };
}

/**
 * Unified calculation formula: (completed / total) * 100
 */
export async function computeCourseProgress(
  userId: string,
  materials: { id: string; type: string }[]
): Promise<number> {
  const trackable = materials.filter((m) => m.type === "video" || m.type === "tutorial");
  if (trackable.length === 0) return 0;

  const { data } = await (supabase.from("user_material_progress") as any)
    .select("material_id, completed")
    .eq("user_id", userId)
    .eq("completed", true)
    .in("material_id", trackable.map((m) => m.id));

  const completedCount = (data as any[])?.length || 0;
  return Math.round((completedCount / trackable.length) * 100);
}
