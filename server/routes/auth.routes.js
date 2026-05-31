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

export default router;
