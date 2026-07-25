// src/lib/types.ts
// Central domain type definitions — derived from the Supabase schema and API
// layer interfaces.  Import from here instead of scattering inline types.

import type { Database } from "@/lib/database.types";

// ─── Table row shorthands ────────────────────────────────────────────────────

export type CourseRow    = Database["public"]["Tables"]["courses"]["Row"];
export type MaterialRow  = Database["public"]["Tables"]["materials"]["Row"];
export type QuizRow      = Database["public"]["Tables"]["quizzes"]["Row"];
export type QuestionRow  = Database["public"]["Tables"]["questions"]["Row"];
export type QuizAttemptRow = Database["public"]["Tables"]["quiz_attempts"]["Row"];
export type StudentProgressRow = Database["public"]["Tables"]["student_progress"]["Row"];
export type UserMaterialProgressRow = Database["public"]["Tables"]["user_material_progress"]["Row"];
export type UserCourseProgressRow   = Database["public"]["Tables"]["user_course_progress"]["Row"];

// ─── Extended domain types (DB row + optional joined fields) ─────────────────

/** A course as returned from the DB, optionally with materials attached. */
export interface Course extends CourseRow {
  materials?: Material[];
  // Joined profile for admin course-approval view
  profiles?: { full_name: string | null; email: string } | null;
}

/** A course material. */
export interface Material extends MaterialRow {
  courses?: Pick<CourseRow, "id" | "title"> | null;
}

/** A quiz with its questions attached. */
export interface Quiz extends QuizRow {
  questions?: Question[];
}

/** A single quiz question. */
export type Question = QuestionRow;

/** A user profile. */
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "student" | "lecturer" | "admin";
  avatar_url?: string | null;
  bio?: string | null;
  phone?: string | null;
  interests?: string[];
  learning_goals?: string | null;
  is_suspended?: boolean;
  suspended_at?: string | null;
  created_at: string;
}

/** An enrollment record. */
export interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  enrolled_at: string;
  courses?: {
    id: string;
    title: string;
    description: string;
    category: string;
    difficulty: string;
    thumbnail: string;
    instructor: string;
    rating: number;
    duration_minutes: number;
    enrolled_count: number;
    status?: string;
    is_published?: boolean;
  };
}

/** An announcement. */
export interface Announcement {
  id: string;
  author_id: string;
  course_id: string | null;
  title: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  courses?: { title: string } | null;
}

/** A course bookmark for a student. */
export interface Bookmark {
  id: string;
  user_id: string;
  material_id: string;
  created_at: string;
  materials?: {
    id: string;
    title: string;
    type: string;
    url: string;
    duration_minutes: number;
    course_id: string;
    courses?: { id: string; title: string; category: string };
  };
}

/** A completion certificate. */
export interface Certificate {
  id: string;
  user_id: string;
  course_id: string;
  certificate_uid: string;
  issued_at: string;
  courses?: {
    title: string;
    category: string;
    instructor: string;
    difficulty: string;
    duration_minutes: number;
    lecturer_id?: string | null;
  };
  profiles?: {
    full_name: string | null;
    email: string;
  };
}

/** Feedback submitted by a student for a course. */
export interface Feedback {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  comment: string | null;
  is_read: boolean;
  created_at: string;
  profiles?: { full_name: string | null; email: string };
  courses?: { title: string };
}

/** In-app notification. */
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type:
    | "info"
    | "success"
    | "warning"
    | "error"
    | "quiz"
    | "enrollment"
    | "certificate"
    | "announcement";
  is_read: boolean;
  link?: string | null;
  created_at: string;
}

/** User progress for a single course. */
export interface CourseProgress {
  id?: string;
  user_id: string;
  course_id: string;
  progress: number;
  completed_materials?: number | null;
  total_materials?: number | null;
  last_updated?: string | null;
  courses?: { title: string } | null;
}

/** User progress for a single material. */
export interface MaterialProgress {
  progress_pct: number;
  completed: boolean;
}

/** A quiz attempt record. */
export interface QuizAttempt extends QuizAttemptRow {
  quizzes?: Pick<QuizRow, "id" | "title" | "course_id"> | null;
}
