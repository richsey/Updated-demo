// src/lib/api/courses.ts
// All course-related database operations with intelligent caching

import { supabase } from "@/lib/supabase";
import CacheManager from "@/lib/cache";

const COURSES_CACHE_KEY = "courses_all";
const COURSES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchCourses(useCache = true) {
  // Try cache first — only trust non-empty cached results
  if (useCache) {
    const cached = await CacheManager.get<any[]>(COURSES_CACHE_KEY, COURSES_CACHE_TTL);
    if (cached && cached.length > 0) {
      console.log("[Courses] From cache - instant load!");
      return cached;
    }
  }

  console.log("[Courses] Fetching from database...");
  const startTime = performance.now();

  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: true });
  console.log("[Courses] Supabase response:", data, error);

  if (error) throw error;

  const result = data ?? [];
  const duration = performance.now() - startTime;

  console.log(
    `[Courses] Fetched ${result.length} courses in ${duration.toFixed(0)}ms`,
  );

  // Only cache non-empty results so a transient failure never poisons the cache
  if (result.length > 0) {
    await CacheManager.set(COURSES_CACHE_KEY, result, COURSES_CACHE_TTL);
  }

  return result;
}

export async function fetchCourseById(courseId: string) {
  const cacheKey = `course_${courseId}`;

  // Try cache first — only trust if it has materials populated
  const cached = await CacheManager.get<any>(cacheKey, 10 * 60 * 1000);
  if (cached && cached.materials && cached.materials.length > 0) {
    console.log(`[Course] ${courseId} from cache - instant load!`);
    return cached;
  }

  console.log(`[Course] Fetching ${courseId} from database...`);

  // Try joined query first (requires FK relationship in Supabase)
  let { data, error } = await supabase
    .from("courses")
    .select("*, materials(*)")
    .eq("id", courseId)
    .single();

  // If the join fails (e.g. no FK defined), fall back to two separate queries
  if (error) {
    console.warn("[Course] Join query failed, falling back to separate queries:", error.message);
    const { data: courseData, error: courseError } = await supabase
      .from("courses")
      .select("*")
      .eq("id", courseId)
      .single();

    if (courseError) throw courseError;

    const { data: materialsData } = await supabase
      .from("materials")
      .select("*")
      .eq("course_id", courseId)
      .order("order_index", { ascending: true });

    data = { ...(courseData as Record<string, unknown>), materials: materialsData ?? [] } as typeof data;
    error = null;
  }

  if (error) throw error;

  // Cache the result
  await CacheManager.set(cacheKey, data, 10 * 60 * 1000);

  return data;
}

export async function fetchMaterialById(materialId: string) {
  const cacheKey = `material_${materialId}`;

  const cached = await CacheManager.get(cacheKey, 10 * 60 * 1000);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from("materials")
    .select("*, courses(*)")
    .eq("id", materialId)
    .single();

  if (error) throw error;

  await CacheManager.set(cacheKey, data, 10 * 60 * 1000);

  return data;
}

// Invalidate courses cache when needed
export async function invalidateCoursesCache() {
  await CacheManager.clear("course_");
  console.log("[Courses] Cache invalidated");
}
