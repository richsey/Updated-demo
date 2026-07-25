// src/lib/api/lecturer.ts
// Lecturer-specific API calls — courses, materials, quizzes, students

import { supabase } from "@/lib/supabase";

export type CourseStatus = "draft" | "pending_approval" | "published" | "rejected" | "archived";

export interface LecturerCourse {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  format: "video" | "article" | "interactive";
  thumbnail: string;
  instructor: string;
  rating: number;
  enrolled_count: number;
  status: CourseStatus;
  is_published: boolean;
  tags: string[];
  rejection_note: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  _enrollment_count?: number;
  profiles?: { full_name: string | null; email: string } | null;
}

/** Fetch all courses created by a lecturer */
export async function fetchLecturerCourses(lecturerId: string): Promise<LecturerCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .eq("lecturer_id", lecturerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch lecturer courses failed: ${error.message}`);
  return (data as LecturerCourse[]) ?? [];
}

/** Create a new course (starts in 'draft' status) */
export async function createLecturerCourse(
  lecturerId: string,
  course: Pick<
    LecturerCourse,
    "title" | "description" | "category" | "difficulty" | "format" | "thumbnail" | "instructor" | "tags"
  >
): Promise<LecturerCourse> {
  const { data, error } = await supabase
    .from("courses")
    // @ts-expect-error courses insert type includes extra fields not in generated DB type
    .insert([
      {
        ...course,
        lecturer_id: lecturerId,
        status: "draft",
        is_published: false,
        rating: 4.5,
        enrolled_count: 0,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(`Create course failed: ${error.message}`);
  return data as LecturerCourse;
}

/** Update an existing lecturer course */
export async function updateLecturerCourse(
  courseId: string,
  lecturerId: string,
  updates: Partial<LecturerCourse>
): Promise<void> {
  const { error } = await supabase
    .from("courses")
    // @ts-expect-error courses update type includes extra fields not in generated DB type
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("lecturer_id", lecturerId);

  if (error) throw new Error(`Update course failed: ${error.message}`);
}

/** Submit a course for admin approval (draft → pending_approval) */
export async function submitCourseForApproval(courseId: string, lecturerId: string): Promise<void> {
  const { error } = await supabase
    .from("courses")
    // @ts-expect-error courses update type for status field
    .update({ status: "pending_approval", updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("lecturer_id", lecturerId);

  if (error) throw new Error(`Submit for approval failed: ${error.message}`);
}

/** Archive a course (lecturer action) */
export async function archiveCourse(courseId: string, lecturerId: string): Promise<void> {
  const { error } = await supabase
    .from("courses")
    // @ts-expect-error courses update type for status/is_published fields
    .update({ status: "archived", is_published: false, updated_at: new Date().toISOString() })
    .eq("id", courseId)
    .eq("lecturer_id", lecturerId);

  if (error) throw new Error(`Archive course failed: ${error.message}`);
}

interface LecturerStudentRow {
  user_id: string;
  full_name: string;
  email: string;
  course_id: string;
  course_title: string;
  course_category: string;
  progress: number;
  enrolled_at: string;
}

interface EnrollmentWithProfile {
  user_id: string;
  course_id: string;
  enrolled_at: string;
  profiles: { id: string; full_name: string | null; email: string } | null;
}

interface ProgressWithCourse {
  user_id: string;
  course_id: string;
  progress: number | null;
}

/** Fetch students enrolled in a lecturer's courses with their progress */
export async function fetchLecturerStudents(lecturerId: string): Promise<LecturerStudentRow[]> {
  // Step 1: get course IDs belonging to this lecturer
  const { data: courses, error: cErr } = await supabase
    .from("courses")
    .select("id, title, category")
    .eq("lecturer_id", lecturerId);

  if (cErr || !courses || courses.length === 0) return [];

  const courseIds = (courses as unknown as Array<{ id: string }>).map((c) => c.id);

  // Step 2: fetch enrollments for those courses
  const { data: enrollments, error: eErr } = await supabase
    .from("enrollments")
    .select("user_id, course_id, enrolled_at, profiles(id, full_name, email)")
    .in("course_id", courseIds);

  if (eErr) throw new Error(`Fetch lecturer students failed: ${eErr.message}`);

  // Step 3: fetch progress for those students in those courses
  const { data: progressData } = await supabase
    .from("student_progress")
    .select("user_id, course_id, progress")
    .in("course_id", courseIds);

  const progressMap: Record<string, Record<string, number>> = {};
  for (const p of (progressData ?? []) as ProgressWithCourse[]) {
    if (!progressMap[p.user_id]) progressMap[p.user_id] = {};
    progressMap[p.user_id][p.course_id] = p.progress ?? 0;
  }

  const courseMap: Record<string, { title: string; category: string }> = {};
  for (const c of (courses as unknown as Array<{ id: string; title: string; category: string }>)) courseMap[c.id] = { title: c.title, category: c.category };

  // Build result
  const seen = new Set<string>();
  const result: LecturerStudentRow[] = [];

  for (const e of (enrollments ?? []) as EnrollmentWithProfile[]) {
    const uid = e.user_id;
    if (!seen.has(`${uid}-${e.course_id}`)) {
      seen.add(`${uid}-${e.course_id}`);
      result.push({
        user_id: uid,
        full_name: e.profiles?.full_name ?? "Unknown",
        email: e.profiles?.email ?? "",
        course_id: e.course_id,
        course_title: courseMap[e.course_id]?.title ?? "Unknown",
        course_category: courseMap[e.course_id]?.category ?? "",
        progress: progressMap[uid]?.[e.course_id] ?? 0,
        enrolled_at: e.enrolled_at,
      });
    }
  }

  return result;
}

/** Admin: approve a pending course */
export async function adminApproveCourse(courseId: string, adminId: string): Promise<void> {
  const { error } = await supabase
    .from("courses")
    // @ts-expect-error courses update type for approval fields
    .update({
      status: "published",
      is_published: true,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      rejection_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw new Error(`Approve course failed: ${error.message}`);
}

/** Admin: reject a pending course */
export async function adminRejectCourse(
  courseId: string,
  adminId: string,
  rejectionNote: string
): Promise<void> {
  const { error } = await supabase
    .from("courses")
    // @ts-expect-error courses update type for rejection fields
    .update({
      status: "rejected",
      is_published: false,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      rejection_note: rejectionNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);

  if (error) throw new Error(`Reject course failed: ${error.message}`);
}

/** Fetch all pending-approval courses (admin use) */
export async function fetchPendingCourses(): Promise<LecturerCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*, profiles!courses_lecturer_id_fkey(full_name, email)")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch pending courses failed: ${error.message}`);
  return (data as LecturerCourse[]) ?? [];
}

/** Admin: change a user's role via the backend server (bypasses RLS, updates auth metadata) */
export async function adminChangeUserRole(
  targetUserId: string,
  newRole: "student" | "lecturer" | "admin"
): Promise<void> {
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5001";
  const res = await fetch(`${SERVER_URL}/api/auth/change-role`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: targetUserId, newRole }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || "Failed to change role");
  }
}

/** Admin: suspend a user */
export async function adminSuspendUser(targetUserId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    // @ts-expect-error profiles update type for suspension fields
    .update({ is_suspended: true, suspended_at: new Date().toISOString() })
    .eq("id", targetUserId);

  if (error) throw new Error(`Suspend user failed: ${error.message}`);
}

/** Admin: activate (unsuspend) a user */
export async function adminActivateUser(targetUserId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    // @ts-expect-error profiles update type for suspension fields
    .update({ is_suspended: false, suspended_at: null })
    .eq("id", targetUserId);

  if (error) throw new Error(`Activate user failed: ${error.message}`);
}

/** Admin: fetch all users with optional role filter */
export async function fetchAllUsers(role?: "student" | "lecturer" | "admin") {
  let query = supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (role) query = query.eq("role", role);

  const { data, error } = await query;
  if (error) throw new Error(`Fetch users failed: ${error.message}`);
  return (data as unknown as Array<{
    id: string;
    email: string;
    full_name: string | null;
    role: "student" | "lecturer" | "admin";
    avatar_url: string | null;
    is_suspended: boolean;
  }>) ?? [];
}

export interface CreateUserPayload {
  fullName: string;
  email: string;
  password: string;
  role: string;
}

/** Admin: create a new user via backend API */
export async function adminCreateUser(payload: CreateUserPayload) {
  const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:5001";
  const res = await fetch(`${SERVER_URL}/api/auth/create-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || "Failed to create user");
  }
  return res.json();
}
