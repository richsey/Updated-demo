// src/lib/api/bookmarks.ts
// Bookmark management — save and remove material bookmarks

import { supabase } from "@/lib/supabase";
import type { Bookmark } from "@/lib/types";

export type { Bookmark };

/** Fetch all bookmarks for a user with material + course info */
export async function fetchBookmarks(userId: string): Promise<Bookmark[]> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select(
      "id, user_id, material_id, created_at, materials(id, title, type, url, duration_minutes, course_id, courses(id, title, category))"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch bookmarks failed: ${error.message}`);
  return (data as Bookmark[]) ?? [];
}

/** Check if a material is bookmarked by the user */
export async function isBookmarked(userId: string, materialId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .eq("material_id", materialId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/** Add a bookmark */
export async function addBookmark(userId: string, materialId: string): Promise<void> {
  const { error } = await supabase
    .from("bookmarks")
    // @ts-expect-error bookmarks insert type strictness
    .insert([{ user_id: userId, material_id: materialId }]);

  if (error && error.code !== "23505") {
    throw new Error(`Add bookmark failed: ${error.message}`);
  }
}

/** Remove a bookmark */
export async function removeBookmark(userId: string, materialId: string): Promise<void> {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("material_id", materialId);

  if (error) throw new Error(`Remove bookmark failed: ${error.message}`);
}
