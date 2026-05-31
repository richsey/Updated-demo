// src/lib/api/profiles.ts
// Profile management with explicit creation

import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import CacheManager from "@/lib/cache";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: "student" | "admin";
  created_at: string;
}

/**
 * Create or ensure profile exists for a user
 * Solves the problem of profiles not being created after signup
 */
export async function ensureProfileExists(
  userId: string,
  email: string,
  fullName: string,
): Promise<Profile> {
  try {
    console.log("[Profile] Ensuring profile exists for:", email);

    // First, try to create the profile (in case trigger didn't work)
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert([
        {
          id: userId,
          email,
          full_name: fullName,
          role: email.toLowerCase().includes("admin") ? "admin" : "student",
        } as any,
      ])
      .select() // @ts-expect-error Supabase insert type strictness
      .single() as any;

    if (!createError && created) {
      console.log("[Profile] Profile created successfully");
      // Cache it
      await CacheManager.set(`profile_${userId}`, created, 5 * 60 * 1000);
      return created as Profile;
    }

    // If creation failed (likely already exists), fetch it
    console.log("[Profile] Fetching existing profile...");
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single() as { data: Profile | null; error: any };

    if (fetchError) {
      throw new Error(
        `Could not create or fetch profile: ${fetchError.message}`,
      );
    }

    console.log("[Profile] Profile found/ensured");
    // Cache it
    await CacheManager.set(`profile_${userId}`, profile, 5 * 60 * 1000);
    return profile as Profile;
  } catch (err) {
    console.error("[Profile] Error ensuring profile:", err);
    throw err;
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    // Check cache first
    const cached = await CacheManager.get<Profile>(
      `profile_${userId}`,
      5 * 60 * 1000,
    );
    if (cached) {
      console.log("[Profile] Fetched from cache");
      return cached;
    }

    // ── Primary path: fetch from the profiles DB table for accurate role ──
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single() as { data: Profile | null; error: any };

    if (!error && data) {
      console.log("[Profile] Fetched from DB, role:", data.role);
      await CacheManager.set(`profile_${userId}`, data, 5 * 60 * 1000);
      return data as Profile;
    }

    // ── Fallback: build profile from JWT session if DB query fails (e.g. 42P17 RLS) ──
    if (error) {
      // 42P17 = infinite recursion in RLS policy
      if (error.code === "42P17") {
        console.warn("[Profile] RLS infinite recursion detected – falling back to JWT profile.");
      } else {
        console.error("[Profile] DB fetch error:", error);
      }
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user && session.user.id === userId) {
      const u = session.user;
      const meta = u.user_metadata ?? {};
      const appMeta = u.app_metadata ?? {};

      // Role can live in app_metadata (set server-side) or user_metadata (set on signup)
      const role: "student" | "admin" =
        appMeta.role === "admin" || meta.role === "admin" ? "admin" : "student";

      const jwtProfile: Profile = {
        id: u.id,
        email: u.email ?? "",
        full_name: meta.full_name ?? meta.name ?? null,
        role,
        created_at: u.created_at ?? new Date().toISOString(),
      };

      // Cache briefly
      await CacheManager.set(`profile_${userId}`, jwtProfile, 2 * 60 * 1000);
      console.log("[Profile] Built from JWT session (DB fallback), role:", role);
      return jwtProfile;
    }

    return null;
  } catch (err) {
    console.error("[Profile] Unexpected error:", err);
    return null;
  }
}


export async function updateProfile(
  userId: string,
  updates: Partial<Profile>,
): Promise<void> {
  try {
    // Build a properly typed update object
    const updatePayload: Record<string, unknown> = {};

    if (updates.email !== undefined) updatePayload.email = updates.email;
    if (updates.full_name !== undefined)
      updatePayload.full_name = updates.full_name;
    if (updates.role !== undefined) updatePayload.role = updates.role;

    // Supabase type inference issue - wrap in try-catch and suppress type error
    const { error } = await supabase
      .from("profiles")
      // @ts-expect-error Supabase update payload typing
      .update(updatePayload)
      .eq("id", userId);

    if (error) throw error;

    // Invalidate cache
    await CacheManager.clear(`profile_${userId}`);
    console.log("[Profile] Updated and cached cleared");
  } catch (err) {
    console.error("[Profile] Update error:", err);
    throw err;
  }
}
