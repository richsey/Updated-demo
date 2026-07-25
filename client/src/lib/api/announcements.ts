// src/lib/api/announcements.ts
// Announcements management — course-level and platform-wide
//
// NOTE: announcements.author_id references auth.users (not public.profiles),
// so PostgREST cannot auto-join profiles. We select without that join to avoid
// the PGRST200 "no relationship found" error.

import { supabase } from "@/lib/supabase";
import type { Announcement } from "@/lib/types";

export type { Announcement };

/** Fetch all platform-wide announcements (course_id = null) */
export async function fetchPlatformAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*, courses(title)")
    .is("course_id", null)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch announcements failed: ${error.message}`);
  return (data as Announcement[]) ?? [];
}

/** Fetch announcements for a specific course */
export async function fetchCourseAnnouncements(courseId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*, courses(title)")
    .eq("course_id", courseId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch course announcements failed: ${error.message}`);
  return (data as Announcement[]) ?? [];
}

/** Fetch all announcements visible to a student (platform-wide + enrolled courses) */
export async function fetchStudentAnnouncements(userId: string): Promise<Announcement[]> {
  // Get enrolled course IDs first
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId);

  const courseIds = (enrollments ?? []).map((e) => e.course_id);

  const { data, error } = await supabase
    .from("announcements")
    .select("*, courses(title)")
    .or(
      courseIds.length > 0
        ? `course_id.is.null,course_id.in.(${courseIds.join(",")})`
        : "course_id.is.null"
    )
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch student announcements failed: ${error.message}`);
  return (data as Announcement[]) ?? [];
}

/** Create an announcement (lecturer or admin) */
export async function createAnnouncement(
  announcement: Pick<Announcement, "author_id" | "title" | "body" | "is_pinned"> & {
    course_id?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("announcements")
    // @ts-expect-error announcements insert type strictness for extended fields
    .insert([announcement]);

  if (error) throw new Error(`Create announcement failed: ${error.message}`);
}

/** Delete an announcement */
export async function deleteAnnouncement(announcementId: string): Promise<void> {
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", announcementId);

  if (error) throw new Error(`Delete announcement failed: ${error.message}`);
}

/** Fetch all announcements authored by a lecturer */
export async function fetchLecturerAnnouncements(lecturerId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("announcements")
    .select("*, courses(title)")
    .eq("author_id", lecturerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch lecturer announcements failed: ${error.message}`);
  return (data as Announcement[]) ?? [];
}
