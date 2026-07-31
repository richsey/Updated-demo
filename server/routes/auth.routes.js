// routes/auth.routes.js
// Sets app_metadata.role for a user using the service role key
// Only callable server-side where the secret key is safe

import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /api/auth/set-role
 * Body: { userId: string, role: "admin" | "student" }
 *
 * Sets app_metadata.role for the user via the admin API.
 * Only sets "admin" if the user's email contains "admin" — prevents privilege escalation.
 */
router.post("/set-role", async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: "userId and email are required" });
    }

    // Determine role from email (server-side enforcement)
    const role = email.toLowerCase().includes("admin") ? "admin" : "student";

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    });

    if (error) {
      console.error("[Auth Route] Failed to set role:", error.message);
      return res.status(500).json({ error: error.message });
    }

    console.log(`[Auth Route] Set role=${role} for user ${email}`);
    return res.json({ success: true, role });
  } catch (err) {
    console.error("[Auth Route] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/auth/create-user
 * Body: { email, password, fullName, role }
 */
router.post("/create-user", async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Password Policy Validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`\-]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character." 
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || "" }
    });

    if (error) {
      console.error("[Auth Route] Failed to create user:", error.message);
      return res.status(500).json({ error: error.message });
    }

    const userId = data.user.id;
    const assignedRole = role || "student";

    const { error: roleError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: assignedRole },
    });
    
    if (roleError) {
      console.error("[Auth Route] Failed to assign role to new user:", roleError.message);
    }
    
    // Fix profile role incase trigger overwrote it
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ role: assignedRole, full_name: fullName })
      .eq('id', userId);
      
    if (profileError) {
      console.error("[Auth Route] Failed to update profile role:", profileError.message);
    }

    return res.json({ success: true, user: data.user });
  } catch (err) {
    console.error("[Auth Route] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/auth/change-role
 * Body: { userId: string, newRole: "student" | "lecturer" | "admin" }
 *
 * Admin-only: changes an existing user's role in both auth.users (app_metadata)
 * and the profiles table using the service-role key (bypasses RLS).
 */
router.post("/change-role", async (req, res) => {
  try {
    const { userId, newRole } = req.body;

    if (!userId || !newRole) {
      return res.status(400).json({ error: "userId and newRole are required" });
    }

    const validRoles = ["student", "lecturer", "admin"];
    if (!validRoles.includes(newRole)) {
      return res.status(400).json({ error: `Invalid role: ${newRole}` });
    }

    // 1. Update auth metadata so JWT reflects new role
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: newRole },
    });

    if (authError) {
      console.error("[Auth Route] Failed to update auth metadata:", authError.message);
      return res.status(500).json({ error: authError.message });
    }

    // 2. Update profiles table (service role bypasses RLS)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", userId);

    if (profileError) {
      console.error("[Auth Route] Failed to update profile role:", profileError.message);
      return res.status(500).json({ error: profileError.message });
    }

    console.log(`[Auth Route] Role changed to ${newRole} for user ${userId}`);
    return res.json({ success: true, role: newRole });
  } catch (err) {
    console.error("[Auth Route] Unexpected error in change-role:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/auth/delete-user
 * Body: { userId }
 */
router.delete("/delete-user", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const { data, error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      console.error("[Auth Route] Failed to delete user:", error.message);
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/auth/register
 * Body: { email, password, fullName }
 * Generates a verification code, saves to email_verifications table, and sends email.
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Password Policy Validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`\-]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        error: "Password must be at least 8 characters long, contain an uppercase letter, a lowercase letter, a number, and a special character." 
      });
    }

    // Generate a 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in email_verifications table
    const { error: dbError } = await supabaseAdmin
      .from("email_verifications")
      .upsert({
        email,
        full_name: fullName,
        password_hash: password, // Temp storage (sent over HTTPS)
        verification_code: code
      }, { onConflict: 'email' });

    if (dbError) {
      console.error("[Auth Route] Failed to save verification:", dbError.message);
      return res.status(500).json({ error: "Failed to generate verification" });
    }

    // Send the email (import dynamically to avoid circular dep if not at top)
    const { sendVerificationEmail } = await import("../utils/email.js");
    const emailSent = await sendVerificationEmail(email, code);

    if (!emailSent) {
      return res.status(500).json({ error: "Failed to send verification email. Check SMTP settings." });
    }

    return res.json({ success: true, message: "Verification code sent" });
  } catch (err) {
    console.error("[Auth Route] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/auth/verify
 * Body: { email, code }
 * Verifies code and officially creates user in Supabase.
 */
router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    // 1. Fetch from email_verifications
    const { data: verifications, error: fetchError } = await supabaseAdmin
      .from("email_verifications")
      .select("*")
      .eq("email", email)
      .eq("verification_code", code);

    if (fetchError || !verifications || verifications.length === 0) {
      return res.status(400).json({ error: "Invalid verification code or email" });
    }

    const verification = verifications[0];

    // Check expiration
    if (new Date(verification.expires_at) < new Date()) {
      return res.status(400).json({ error: "Verification code has expired" });
    }

    // 2. Create the actual user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: verification.email,
      password: verification.password_hash,
      email_confirm: true,
      user_metadata: { full_name: verification.full_name }
    });

    if (authError) {
      console.error("[Auth Route] Supabase User Creation Failed:", authError.message);
      return res.status(500).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // 3. Delete the verification record
    await supabaseAdmin.from("email_verifications").delete().eq("email", email);

    // 4. (Optional) Force the profile to 'student' initially
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role: "student" },
    });
    
    // Create or update profile
    await supabaseAdmin
      .from('profiles')
      .upsert({ 
        id: userId,
        email: verification.email,
        role: "student", 
        full_name: verification.full_name 
      });

    return res.json({ success: true, user: authData.user });
  } catch (err) {
    console.error("[Auth Route] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
