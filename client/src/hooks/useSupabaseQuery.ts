// src/hooks/useSupabaseQuery.ts
// Reusable React Query hooks for all Supabase data with optimized caching

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCourses,
  fetchCourseById,
  fetchMaterialById,
} from "@/lib/api/courses";
import {
  fetchQuizzes,
  fetchQuizById,
  fetchQuizByCourseId,
  saveQuizAttempt,
  fetchUserQuizAttempts,
} from "@/lib/api/quizzes";
import {
  fetchUserProgress,
  fetchCourseProgress,
  updateCourseProgress,
  fetchMaterialProgress,
  updateMaterialProgress,
} from "@/lib/api/progress";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

// ─── Courses ─────────────────────────────────────────────────
export function useCourses(options?: { skip?: boolean }) {
  return useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchCourses(true),
    staleTime: 10 * 60 * 1000, // 10 min - longer cache, fewer DB hits
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 min even if unused
    enabled: !options?.skip,
  });
}

export function useCourse(
  courseId: string | undefined,
  options?: { skip?: boolean },
) {
  return useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourseById(courseId!),
    enabled: !!courseId && !options?.skip,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

export function useMaterial(
  materialId: string | undefined,
  options?: { skip?: boolean },
) {
  return useQuery({
    queryKey: ["material", materialId],
    queryFn: () => fetchMaterialById(materialId!),
    enabled: !!materialId && !options?.skip,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// ─── Quizzes ─────────────────────────────────────────────────
export function useQuizzes(options?: { skip?: boolean }) {
  return useQuery({
    queryKey: ["quizzes"],
    queryFn: fetchQuizzes,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !options?.skip,
    retry: 1, // surface errors quickly rather than retrying 3x (~30s spinner)
  });
}

export function useQuiz(
  quizId: string | undefined,
  options?: { skip?: boolean },
) {
  return useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => fetchQuizById(quizId!),
    enabled: !!quizId && !options?.skip,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1, // surface errors quickly rather than retrying 3x (~30s spinner)
  });
}

export function useQuizByCourse(
  courseId: string | undefined,
  options?: { skip?: boolean },
) {
  return useQuery({
    queryKey: ["quiz-by-course", courseId],
    queryFn: () => fetchQuizByCourseId(courseId!),
    enabled: !!courseId && !options?.skip,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

// ─── Progress ─────────────────────────────────────────────────
export function useUserProgress(options?: { skip?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-progress", user?.id],
    queryFn: () => fetchUserProgress(user!.id),
    enabled: !!user && !options?.skip,
    staleTime: 2 * 60 * 1000, // 2 min - progress changes more frequently
    gcTime: 10 * 60 * 1000,
  });
}

export function useCourseProgress(
  courseId: string | undefined,
  options?: { skip?: boolean },
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["course-progress", user?.id, courseId],
    queryFn: () => fetchCourseProgress(user!.id, courseId!),
    enabled: !!user && !!courseId && !options?.skip,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useMaterialProgress(materialId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["material-progress", user?.id, materialId],
    queryFn: () => fetchMaterialProgress(user!.id, materialId!),
    enabled: !!user && !!materialId,
  });
}

export function useUpdateMaterialProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      materialId,
      progressPct,
      timeSpentSeconds,
    }: {
      materialId: string;
      progressPct: number;
      timeSpentSeconds: number;
    }) =>
      updateMaterialProgress(
        user!.id,
        materialId,
        progressPct,
        timeSpentSeconds,
      ),
    onSuccess: (_, { materialId }) => {
      queryClient.invalidateQueries({
        queryKey: ["material-progress", user?.id, materialId],
      });
      queryClient.invalidateQueries({ queryKey: ["user-progress", user?.id] });
    },
  });
}

export function useUpdateCourseProgress() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      courseId,
      progress,
    }: {
      courseId: string;
      progress: number;
    }) => updateCourseProgress(user!.id, courseId, progress),
    onSuccess: (_, { courseId }) => {
      queryClient.invalidateQueries({
        queryKey: ["course-progress", user?.id, courseId],
      });
      queryClient.invalidateQueries({ queryKey: ["user-progress", user?.id] });
    },
  });
}

// ─── Quiz Attempts ────────────────────────────────────────────
export function useUserQuizAttempts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["quiz-attempts", user?.id],
    queryFn: () => fetchUserQuizAttempts(user!.id),
    enabled: !!user,
    staleTime: 60 * 1000, // 1 min
  });
}

export function useSaveQuizAttempt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attempt: {
      quiz_id: string;
      score: number;
      total_questions: number;
      duration_seconds: number;
    }) => saveQuizAttempt({ ...attempt, user_id: user!.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quiz-attempts", user?.id] });
    },
  });
}

// ─── Prefetch Utility ─────────────────────────────────────────
/**
 * Preload critical data on app startup for instant UI rendering
 * Call this in App.tsx or main layout after user auth is confirmed
 */
export function usePrefetchCriticalData() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const prefetch = useCallback(async () => {
    try {
      console.log("[Prefetch] Loading critical data...");
      const startTime = performance.now();

      // Prefetch courses (most critical for student dashboard)
      await queryClient.prefetchQuery({
        queryKey: ["courses"],
        queryFn: () => fetchCourses(true),
        staleTime: 10 * 60 * 1000,
      });

      // Prefetch quizzes if needed
      await queryClient.prefetchQuery({
        queryKey: ["quizzes"],
        queryFn: fetchQuizzes,
        staleTime: 10 * 60 * 1000,
      });

      // Prefetch user progress if authenticated
      if (user) {
        await queryClient.prefetchQuery({
          queryKey: ["user-progress", user.id],
          queryFn: () => fetchUserProgress(user.id),
          staleTime: 2 * 60 * 1000,
        });
      }

      const duration = performance.now() - startTime;
      console.log(
        `[Prefetch] Critical data loaded in ${duration.toFixed(0)}ms`,
      );
    } catch (err) {
      console.error("[Prefetch] Error prefetching data:", err);
    }
  }, [queryClient, user]);

  return { prefetch };
}
