import { supabase } from "../config/supabaseClient.js";
import { fetchProgressRecommendation } from "../services/progressAIService.js";

/**
 * POST /api/course-progress/material/complete
 * Mark a material as completed and recalculate course progress.
 */
export const markMaterialComplete = async (req, res) => {
  try {
    // Always derive userId from the validated JWT — never trust the request body.
    const userId = req.user?.id;
    const { materialId } = req.body;

    if (!userId || !materialId) {
      return res.status(400).json({ error: "userId and materialId are required" });
    }

    // 1. Upsert user_material_progress
    const { error: upsertError } = await supabase
      .from("user_material_progress")
      .upsert(
        {
          user_id: userId,
          material_id: materialId,
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,material_id" }
      );

    if (upsertError) throw upsertError;

    // 2. Get the course_id for this material
    const { data: material, error: matError } = await supabase
      .from("materials")
      .select("course_id")
      .eq("id", materialId)
      .single();

    if (matError || !material) {
      return res.status(404).json({ error: "Material not found" });
    }

    const courseId = material.course_id;

    // 3. Count total materials for the course
    const { count: totalMaterials, error: totalError } = await supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .eq("course_id", courseId);

    if (totalError) throw totalError;

    // 4. Count completed materials for this user in this course
    const { data: courseMaterials } = await supabase
      .from("materials")
      .select("id")
      .eq("course_id", courseId);

    const courseMaterialIds = (courseMaterials || []).map((m) => m.id);

    const { count: completedMaterials, error: completedError } = await supabase
      .from("user_material_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", true)
      .in("material_id", courseMaterialIds);

    if (completedError) throw completedError;

    // 5. Calculate progress
    const total = totalMaterials || 0;
    const completed = completedMaterials || 0;
    const progress = total > 0 ? Math.round((completed / total) * 100 * 100) / 100 : 0;

    // 6. Upsert user_course_progress
    const { error: courseError } = await supabase
      .from("user_course_progress")
      .upsert(
        {
          user_id: userId,
          course_id: courseId,
          progress,
          completed_materials: completed,
          total_materials: total,
          last_updated: new Date().toISOString(),
        },
        { onConflict: "user_id,course_id" }
      );

    if (courseError) throw courseError;

    // 7. Call AI service for recommendation (non-blocking — don't fail if AI is down)
    let aiRecommendation = null;
    try {
      aiRecommendation = await fetchProgressRecommendation({
        user_id: userId,
        course_id: courseId,
        progress,
        completed_materials: completed,
        total_materials: total,
      });
    } catch (aiErr) {
      console.warn("[CourseProgress] AI service unavailable:", aiErr.message);
    }

    res.json({
      success: true,
      progress,
      completed_materials: completed,
      total_materials: total,
      ai_recommendation: aiRecommendation,
    });
  } catch (err) {
    console.error("[CourseProgress] markMaterialComplete error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/course-progress/course/:courseId?userId=xxx
 * Get course progress for a user.
 */
export const getCourseProgress = async (req, res) => {
  try {
    // Always derive userId from the validated JWT — never trust query params.
    const userId = req.user?.id;
    const { courseId } = req.params;

    if (!userId || !courseId) {
      return res.status(400).json({ error: "userId and courseId are required" });
    }

    const { data, error } = await supabase
      .from("user_course_progress")
      .select("progress, completed_materials, total_materials, last_updated")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .single();

    if (error && error.code !== "PGRST116") throw error; // PGRST116 = no rows

    res.json({
      progress: data?.progress ?? 0,
      completed_materials: data?.completed_materials ?? 0,
      total_materials: data?.total_materials ?? 0,
      last_updated: data?.last_updated ?? null,
    });
  } catch (err) {
    console.error("[CourseProgress] getCourseProgress error:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/course-progress/material/status?userId=xxx&courseId=xxx
 * Get completion status of all materials in a course for a user.
 */
export const getMaterialCompletionStatus = async (req, res) => {
  try {
    // Always derive userId from the validated JWT — never trust query params.
    const userId = req.user?.id;
    const { courseId } = req.query;

    if (!userId || !courseId) {
      return res.status(400).json({ error: "userId and courseId are required" });
    }

    // Get all materials for the course
    const { data: materials } = await supabase
      .from("materials")
      .select("id")
      .eq("course_id", courseId);

    const materialIds = (materials || []).map((m) => m.id);

    if (materialIds.length === 0) {
      return res.json({ completed_material_ids: [] });
    }

    // Get completed ones
    const { data: completed } = await supabase
      .from("user_material_progress")
      .select("material_id")
      .eq("user_id", userId)
      .eq("completed", true)
      .in("material_id", materialIds);

    res.json({
      completed_material_ids: (completed || []).map((c) => c.material_id),
    });
  } catch (err) {
    console.error("[CourseProgress] getMaterialCompletionStatus error:", err);
    res.status(500).json({ error: err.message });
  }
};
