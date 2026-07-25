// src/lib/api/certificates.ts
// Certificate management — issue and fetch completion certificates

import { supabase } from "@/lib/supabase";
import type { Certificate } from "@/lib/types";

export type { Certificate };

/** Fetch all certificates for a user */
export async function fetchUserCertificates(userId: string): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from("certificates")
    .select(
      "id, user_id, course_id, certificate_uid, issued_at, courses(title, category, instructor, difficulty, duration_minutes, lecturer_id)"
    )
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });

  if (error) throw new Error(`Fetch certificates failed: ${error.message}`);
  return (data as Certificate[]) ?? [];
}

/** Check if a user has a certificate for a course */
export async function hasCertificate(userId: string, courseId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("certificates")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/** Issue a certificate for a completed course */
export async function issueCertificate(userId: string, courseId: string): Promise<Certificate> {
  // Check if already issued
  const { data: existing } = await supabase
    .from("certificates")
    .select("*")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (existing) return existing as Certificate;

  const { data, error } = await supabase
    .from("certificates")
    // @ts-expect-error certificates insert type strictness
    .insert([{ user_id: userId, course_id: courseId }])
    .select(
      "id, user_id, course_id, certificate_uid, issued_at, courses(title, category, instructor, difficulty, duration_minutes, lecturer_id)"
    )
    .single();

  if (error) throw new Error(`Issue certificate failed: ${error.message}`);
  return data as Certificate;
}

/** Verify a certificate by its UID (public verification) */
export async function verifyCertificate(certificateUid: string): Promise<Certificate | null> {
  const { data, error } = await supabase
    .from("certificates")
    .select(
      "id, user_id, course_id, certificate_uid, issued_at, courses(title, category, instructor, difficulty, duration_minutes), profiles(full_name, email)"
    )
    .eq("certificate_uid", certificateUid)
    .maybeSingle();

  if (error || !data) return null;
  return data as Certificate;
}
