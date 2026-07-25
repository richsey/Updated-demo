// src/lib/api/profiles.ts
// Profile management with explicit creation

import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import CacheManager from "@/lib/cache";

export type { Profile };

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
      // @ts-expect-error Supabase schema divergence
      .insert([
        {
          id: userId,
          email,
          full_name: fullName,
          // All new users are students; admin promotes to lecturer/admin
          role: "student" as const,
        },
      ])
      .select()
      .single();

    if (!createError && created) {
      console.log("[Profile] Profile created successfully");
      await CacheManager.set(`profile_${userId}`, created, 5 * 60 * 1000);
      return created as Profile;
    }

    // If creation failed (likely already exists), fetch it
    console.log("[Profile] Fetching existing profile...");
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (fetchError) {
      throw new Error(
        `Could not create or fetch profile: ${fetchError.message}`,
      );
    }

    console.log("[Profile] Profile found/ensured");
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
      .single();

    if (!error && data) {
      console.log("[Profile] Fetched from DB, role:", (data as Profile).role);
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

      const role: "student" | "lecturer" | "admin" =
        appMeta.role === "admin" || meta.role === "admin"
          ? "admin"
          : appMeta.role === "lecturer" || meta.role === "lecturer"
          ? "lecturer"
          : "student";

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
    const updatePayload: Record<string, unknown> = {};

    if (updates.email !== undefined) updatePayload.email = updates.email;
    if (updates.full_name !== undefined) updatePayload.full_name = updates.full_name;
    if (updates.role !== undefined) updatePayload.role = updates.role;
    if (updates.avatar_url !== undefined) updatePayload.avatar_url = updates.avatar_url;
    if (updates.bio !== undefined) updatePayload.bio = updates.bio;
    if (updates.phone !== undefined) updatePayload.phone = updates.phone;
    if (updates.interests !== undefined) updatePayload.interests = updates.interests;
    if (updates.learning_goals !== undefined) updatePayload.learning_goals = updates.learning_goals;

    const { error } = await supabase
      .from("profiles")
      // @ts-expect-error Supabase schema divergence
      .update(updatePayload as Parameters<ReturnType<typeof supabase.from<"profiles">>['update']>[0])
      .eq("id", userId);

    if (error) throw error;

    // Invalidate cache
    await CacheManager.clear(`profile_${userId}`);
    console.log("[Profile] Updated and cache cleared");
  } catch (err) {
    console.error("[Profile] Update error:", err);
    throw err;
  }
}
