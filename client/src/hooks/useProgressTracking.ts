// src/hooks/useProgressTracking.ts
// Hook for course progress tracking — mark materials complete, fetch progress, AI recommendations
// Uses DIRECT Supabase queries (same pattern as the rest of the app) to avoid backend dependency

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import type { UserMaterialProgressRow, UserCourseProgressRow } from "@/lib/types";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AIRecommendation {
  recommended_next_material: {
    id: string;
    title: string;
    type: string;
    duration_minutes: number;
  } | null;
  difficulty_level: "beginner" | "intermediate" | "advanced";
  message: string;
  progress: number;
  completed_materials: number;
  total_materials: number;
}

interface CourseProgressData {
  progress: number;
  completed_materials: number;
  total_materials: number;
  last_updated: string | null;
}

interface MarkCompleteResult {
  success: boolean;
  progress: number;
  completed_materials: number;
  total_materials: number;
  ai_recommendation: AIRecommendation | null;
}

// ─── Helper: Auth headers for backend API calls ───────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    ...(session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {}),
  };
}

// ─── Direct Supabase: Mark Material Complete ──────────────────────────────────

/**
 * Mark a material as complete DIRECTLY via Supabase and recalculate course progress.
 * This is the primary path — no backend server required.
 */
async function markMaterialCompleteViaSupabase(
  userId: string,
  materialId: string
): Promise<MarkCompleteResult> {
  // 1. Mark this material as completed
  const upsertPayload: Omit<UserMaterialProgressRow, "id" | "created_at"> = {
    user_id: userId,
    material_id: materialId,
    completed: true,
    completed_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("user_material_progress")
    // @ts-expect-error Supabase schema divergence
    .upsert(upsertPayload, { onConflict: "user_id,material_id" });

  if (upsertError) throw upsertError;

  // 2. Get the course_id for this material
  const { data: material } = await supabase
    .from("materials")
    .select("course_id")
    .eq("id", materialId)
    .single();

  if (!material) throw new Error("Material not found");
  const courseId = (material as unknown as { course_id: string }).course_id;

  // 3. Get ALL material IDs for this course
  const { data: courseMaterials } = await supabase
    .from("materials")
    .select("id")
    .eq("course_id", courseId);

  const materialIds = ((courseMaterials as unknown as { id: string }[]) ?? []).map((m) => m.id);
  const totalMaterials = materialIds.length;

  // 4. Count completed materials
  const { count } = await supabase
    .from("user_material_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true)
    .in("material_id", materialIds);

  const completedMaterials = count || 0;
  const progress = totalMaterials > 0 ? Math.round((completedMaterials / totalMaterials) * 100) : 0;

  const courseProgressPayload: Omit<UserCourseProgressRow, "id"> = {
    user_id: userId,
    course_id: courseId,
    progress,
    completed_materials: completedMaterials,
    total_materials: totalMaterials,
    last_updated: new Date().toISOString(),
  };

  try {
    await supabase
      .from("user_course_progress")
      // @ts-expect-error Supabase schema divergence
      .upsert(courseProgressPayload, { onConflict: "user_id,course_id" });
  } catch (err) {
    // non-critical — don't block if this fails
  }

  try {
    await supabase
      .from("student_progress")
      // @ts-expect-error student_progress upsert for non-standard fields
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          progress,
          last_accessed: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,course_id" }
      );
  } catch (err) {
    // non-critical — don't block if this fails
  }

  // 7. Find next material & recommendation
  let nextMaterial: AIRecommendation["recommended_next_material"] = null;
  try {
    const { data: allMats } = await supabase
      .from("materials")
      .select("id, title, type, duration_minutes")
      .eq("course_id", courseId)
      .order("created_at", { ascending: true });

    const { data: completedRows } = await supabase
      .from("user_material_progress")
      .select("material_id")
      .eq("user_id", userId)
      .eq("completed", true);

    const completedSet = new Set(
      (completedRows as Pick<UserMaterialProgressRow, "material_id">[] | null ?? []).map(
        (r) => r.material_id
      )
    );

    for (const mat of (allMats as unknown as { id: string, title: string, type: string, duration_minutes: number }[]) ?? []) {
      if (!completedSet.has(mat.id)) {
        nextMaterial = {
          id: mat.id,
          title: mat.title,
          type: mat.type || "unknown",
          duration_minutes: mat.duration_minutes || 0,
        };
        break;
      }
    }
  } catch {
    // intentionally silent — next material is a nice-to-have, not critical
  }

  const level: "beginner" | "intermediate" | "advanced" =
    progress <= 30 ? "beginner" : progress <= 70 ? "intermediate" : "advanced";

  return {
    success: true,
    progress,
    completed_materials: completedMaterials,
    total_materials: totalMaterials,
    ai_recommendation: {
      recommended_next_material: nextMaterial,
      difficulty_level: level,
      message: `Progress: ${progress}% complete. Keep it up!`,
      progress,
      completed_materials: completedMaterials,
      total_materials: totalMaterials,
    },
  };
}

// ─── Backend API helpers (secondary — used when server is available) ──────────

export async function markMaterialCompleteAPI(
  userId: string,
  materialId: string
): Promise<MarkCompleteResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${SERVER_URL}/api/course-progress/material/complete`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, materialId }),
    }
  );

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: "Request failed" })) as { error: string };
    throw new Error(err.error || "Failed to mark material complete");
  }

  return response.json();
}

export async function fetchCourseProgressAPI(
  userId: string,
  courseId: string
): Promise<CourseProgressData> {
  const { data } = await supabase
    .from("user_course_progress")
    .select("progress, completed_materials, total_materials, last_updated")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (data) {
    const row = data as Pick<
      UserCourseProgressRow,
      "progress" | "completed_materials" | "total_materials" | "last_updated"
    >;
    return {
      progress: row.progress ?? 0,
      completed_materials: row.completed_materials ?? 0,
      total_materials: row.total_materials ?? 0,
      last_updated: row.last_updated ?? null,
    };
  }

  return { progress: 0, completed_materials: 0, total_materials: 0, last_updated: null };
}

export async function fetchCompletedMaterialsAPI(
  userId: string,
  courseId: string
): Promise<string[]> {
  // Get all materials for the course
  const { data: materials } = await supabase
    .from("materials")
    .select("id")
    .eq("course_id", courseId);

  const materialIds = ((materials as unknown as { id: string }[]) ?? []).map((m) => m.id);
  if (materialIds.length === 0) return [];

  // Get completed ones from user_material_progress
  const { data: completed } = await supabase
    .from("user_material_progress")
    .select("material_id")
    .eq("user_id", userId)
    .eq("completed", true)
    .in("material_id", materialIds);

  return (completed as Pick<UserMaterialProgressRow, "material_id">[] | null ?? []).map(
    (c) => c.material_id
  );
}

// ─── React Hook ───────────────────────────────────────────────────────────────

export function useProgressTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isMarking, setIsMarking] = useState(false);
  const [aiRecommendation, setAiRecommendation] =
    useState<AIRecommendation | null>(null);

  const markComplete = useCallback(
    async (materialId: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      setIsMarking(true);
      try {
        // Use direct Supabase (always works, no server dependency)
        const result = await markMaterialCompleteViaSupabase(
          user.id,
          materialId
        );

        if (result.ai_recommendation) {
          setAiRecommendation(result.ai_recommendation);
        }

        // Also try the backend server (for AI service integration) — fire & forget
        markMaterialCompleteAPI(user.id, materialId).catch(() => {
          // Server might not be running — that's OK, Supabase already updated
        });

        // Invalidate relevant queries so the UI updates everywhere
        queryClient.invalidateQueries({ queryKey: ["user-progress"] });
        queryClient.invalidateQueries({ queryKey: ["course-progress"] });
        queryClient.invalidateQueries({ queryKey: ["material-progress"] });
        queryClient.invalidateQueries({ queryKey: ["courses"] });
        queryClient.invalidateQueries({ queryKey: ["course"] });

        return result;
      } finally {
        setIsMarking(false);
      }
    },
    [user?.id, queryClient]
  );

  const clearRecommendation = useCallback(() => {
    setAiRecommendation(null);
  }, []);

  return {
    markComplete,
    isMarking,
    aiRecommendation,
    clearRecommendation,
  };
}
