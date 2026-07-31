// src/lib/api/courses.ts
// All course-related database operations with intelligent caching

import { supabase } from "@/lib/supabase";
import CacheManager from "@/lib/cache";
import type { Course, Material } from "@/lib/types";

export type { Course, Material };

const COURSES_CACHE_KEY = "courses_all";
const COURSES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function fetchCourses(useCache = true): Promise<Course[]> {
  // Try cache first — only trust non-empty cached results
  if (useCache) {
    const cached = await CacheManager.get<Course[]>(COURSES_CACHE_KEY, COURSES_CACHE_TTL);
    if (cached && cached.length > 0) {
      console.log("[Courses] From cache - instant load!");
      return cached;
    }
  }

  console.log("[Courses] Fetching from database...");
  const startTime = performance.now();

  const { data, error } = await supabase
    .from("courses")
    .select("*, materials(id), enrollments(id)")
    .order("created_at", { ascending: true });
  console.log("[Courses] Supabase response:", data, error);

  if (error) {
    // If the join fails, fallback to simple select
    console.warn("Falling back to simple select due to error:", error);
    const fallback = await supabase.from("courses").select("*").order("created_at", { ascending: true });
    if (fallback.error) throw fallback.error;
    
    const result = (fallback.data ?? []) as Course[];
    
    // Default 0 for fallback
    result.forEach((c: any) => {
       c.materials = [];
       c.enrolled_count = 0;
    });
    
    if (result.length > 0) {
      await CacheManager.set(COURSES_CACHE_KEY, result, COURSES_CACHE_TTL);
    }
    return result;
  }

  const result = (data ?? []).map((course: any) => ({
    ...course,
    enrolled_count: course.enrollments ? course.enrollments.length : 0,
  })) as Course[];
  
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

export async function fetchCourseById(courseId: string): Promise<Course | null> {
  const cacheKey = `course_${courseId}`;

  // Try cache first — only trust if it has materials populated
  const cached = await CacheManager.get<Course>(cacheKey, 10 * 60 * 1000);
  if (cached && cached.materials && cached.materials.length > 0) {
    console.log(`[Course] ${courseId} from cache - instant load!`);
    return cached;
  }

  console.log(`[Course] Fetching ${courseId} from database...`);

  // Try joined query first (requires FK relationship in Supabase)
  let { data, error } = await supabase
    .from("courses")
    .select("*, materials(*), enrollments(id)")
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

    data = { ...(courseData as Record<string, unknown>), materials: materialsData ?? [], enrollments: [] } as typeof data;
    error = null;
  }

  if (error) throw error;
  
  if (data) {
    (data as any).enrolled_count = (data as any).enrollments ? (data as any).enrollments.length : 0;
  }

  // Cache the result
  await CacheManager.set(cacheKey, data, 10 * 60 * 1000);

  return data as Course;
}

export async function fetchMaterialById(materialId: string): Promise<Material | null> {
  const cacheKey = `material_${materialId}`;

  const cached = await CacheManager.get<Material>(cacheKey, 10 * 60 * 1000);
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

  return data as Material;
}

// Invalidate all courses-related cache entries (both list and individual records)
export async function invalidateCoursesCache() {
  await CacheManager.clear(COURSES_CACHE_KEY);   // clear the full list cache
  await CacheManager.clear("course_");            // clear per-course detail caches
  console.log("[Courses] Cache invalidated (all)");
}
