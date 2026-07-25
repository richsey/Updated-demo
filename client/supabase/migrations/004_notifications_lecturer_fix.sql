-- =============================================================
-- DataFlow AI — Supabase Schema Migration 004
-- Notifications table + lecturer profile fixes
--
-- PREREQUISITES: 001_schema.sql and 003_missing_tables.sql must
-- already be applied in your Supabase project.
--
-- HOW TO RUN:
--   1. Go to Supabase Dashboard → SQL Editor
--   2. Paste this entire script and click "Run"
--   3. Verify the final SELECT returns "MIGRATION 004 COMPLETE"
-- =============================================================

-- ─── 1. NOTIFICATIONS TABLE ───────────────────────────────────
-- Safe to re-run: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT 'info'
    CHECK (type IN ('info', 'success', 'warning', 'error', 'quiz', 'enrollment', 'certificate', 'announcement')),
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  link       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop before recreate to avoid "policy already exists" errors
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications"
  ON public.notifications FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL USING (public.is_admin());

-- Index for fast unread-notification queries per user
CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON public.notifications (user_id, is_read);

-- Enable realtime so the frontend receives live notification pushes
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL; -- already in publication, skip
END $$;


-- ─── 2. LECTURER HELPER FUNCTION ──────────────────────────────
-- Mirrors is_admin() so we can write clean RLS policies for lecturers
-- without risking RLS recursion.

CREATE OR REPLACE FUNCTION public.is_lecturer()
RETURNS BOOLEAN SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'lecturer'
  );
END;
$$ LANGUAGE plpgsql;


-- ─── 3. PROFILES — fix role constraint & add missing columns ──
-- This is idempotent: ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS

-- Allow 'lecturer' as a valid role (001_schema only allowed student/admin)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'lecturer', 'admin'));

-- Extra fields required by the lecturer profile UI
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url     TEXT,
  ADD COLUMN IF NOT EXISTS bio            TEXT,
  ADD COLUMN IF NOT EXISTS phone          TEXT,
  ADD COLUMN IF NOT EXISTS interests      TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learning_goals TEXT,
  ADD COLUMN IF NOT EXISTS is_suspended   BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspended_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();


-- ─── 4. PROFILES — RLS POLICIES ───────────────────────────────
-- Lecturers need to be able to read all profiles so the student
-- progress page can display student names.

DROP POLICY IF EXISTS "Lecturers can read all profiles" ON public.profiles;
CREATE POLICY "Lecturers can read all profiles"
  ON public.profiles FOR SELECT USING (public.is_lecturer());

-- Allow INSERT for the signup trigger (already exists in 001 but
-- added here defensively in case it was dropped during debugging)
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT WITH CHECK (true);


-- ─── 5. COURSES — add lecturer columns & fix RLS ──────────────

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS lecturer_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status         TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'pending_approval', 'published', 'rejected', 'archived')),
  ADD COLUMN IF NOT EXISTS is_published   BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tags           TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rejection_note TEXT,
  ADD COLUMN IF NOT EXISTS approved_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Ensure pre-existing seed courses are marked published
UPDATE public.courses
  SET status = 'published', is_published = TRUE
  WHERE status IS NULL OR is_published IS NULL;

-- Lecturers can read, insert, update, and delete their own courses
DROP POLICY IF EXISTS "Lecturers can manage own courses" ON public.courses;
CREATE POLICY "Lecturers can manage own courses"
  ON public.courses FOR ALL
  USING (auth.uid() = lecturer_id);


-- ─── 6. ENROLLMENTS ───────────────────────────────────────────
-- Students enrol themselves; lecturers can view their own course enrolments;
-- admins can do everything.

CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can manage own enrollments" ON public.enrollments;
CREATE POLICY "Students can manage own enrollments"
  ON public.enrollments FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Lecturers can view enrollments for their courses" ON public.enrollments;
CREATE POLICY "Lecturers can view enrollments for their courses"
  ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can manage all enrollments" ON public.enrollments;
CREATE POLICY "Admins can manage all enrollments"
  ON public.enrollments FOR ALL USING (public.is_admin());

CREATE INDEX IF NOT EXISTS enrollments_user_id   ON public.enrollments (user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_id ON public.enrollments (course_id);


-- ─── 7. ANNOUNCEMENTS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.announcements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  UUID REFERENCES public.courses(id) ON DELETE CASCADE, -- NULL = platform-wide
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_pinned  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read announcements" ON public.announcements;
CREATE POLICY "Anyone can read announcements"
  ON public.announcements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lecturers can manage own announcements" ON public.announcements;
CREATE POLICY "Lecturers can manage own announcements"
  ON public.announcements FOR ALL USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Admins can manage all announcements" ON public.announcements;
CREATE POLICY "Admins can manage all announcements"
  ON public.announcements FOR ALL USING (public.is_admin());


-- ─── 8. BOOKMARKS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, material_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can manage own bookmarks"
  ON public.bookmarks FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bookmarks_user_id ON public.bookmarks (user_id);


-- ─── 9. CERTIFICATES ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.certificates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_uid TEXT NOT NULL UNIQUE
    DEFAULT 'CERT-' || upper(substring(gen_random_uuid()::text, 1, 8)),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own certificates" ON public.certificates;
CREATE POLICY "Users can read own certificates"
  ON public.certificates FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert certificates" ON public.certificates;
CREATE POLICY "System can insert certificates"
  ON public.certificates FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all certificates" ON public.certificates;
CREATE POLICY "Admins can manage all certificates"
  ON public.certificates FOR ALL USING (public.is_admin());


-- ─── 10. FEEDBACK ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own feedback" ON public.feedback;
CREATE POLICY "Users can manage own feedback"
  ON public.feedback FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Lecturers can read feedback for their courses" ON public.feedback;
CREATE POLICY "Lecturers can read feedback for their courses"
  ON public.feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.lecturer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can read all feedback" ON public.feedback;
CREATE POLICY "Admins can read all feedback"
  ON public.feedback FOR SELECT USING (public.is_admin());


-- ─── 11. ACTIVITY LOGS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can read all activity logs"
  ON public.activity_logs FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "System can insert activity logs" ON public.activity_logs;
CREATE POLICY "System can insert activity logs"
  ON public.activity_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS activity_logs_actor   ON public.activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS activity_logs_created ON public.activity_logs (created_at DESC);


-- ─── 12. BADGES & USER BADGES ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '🏆',
  color       TEXT NOT NULL DEFAULT 'primary',
  criteria    JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Badges are publicly readable" ON public.badges;
CREATE POLICY "Badges are publicly readable" ON public.badges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage badges" ON public.badges;
CREATE POLICY "Admins can manage badges" ON public.badges FOR ALL USING (public.is_admin());

INSERT INTO public.badges (name, description, icon, color, criteria) VALUES
  ('First Step',      'Completed your first course material',  '🎯', 'primary', '{"type":"material_complete","count":1}'),
  ('Quiz Ace',        'Scored 100% on a quiz',                 '⭐', 'amber',   '{"type":"quiz_perfect_score"}'),
  ('Fast Learner',    'Completed 5 materials in one day',      '⚡', 'yellow',  '{"type":"daily_materials","count":5}'),
  ('Course Champion', 'Completed your first full course',      '🏆', 'emerald', '{"type":"course_complete","count":1}'),
  ('Scholar',         'Completed 5 full courses',              '📚', 'blue',    '{"type":"course_complete","count":5}'),
  ('Quiz Master',     'Completed 10 quizzes with 80%+ score',  '🎓', 'violet',  '{"type":"quiz_high_score","count":10,"min_score":80}'),
  ('Dedicated',       'Studied for 10+ hours total',           '💪', 'rose',    '{"type":"study_time_hours","count":10}'),
  ('Streak Hero',     'Maintained a 7-day learning streak',    '🔥', 'orange',  '{"type":"study_streak_days","count":7}')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_badges (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id  UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own badges" ON public.user_badges;
CREATE POLICY "Users can read own badges"
  ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert user badges" ON public.user_badges;
CREATE POLICY "System can insert user badges"
  ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all user badges" ON public.user_badges;
CREATE POLICY "Admins can manage all user badges"
  ON public.user_badges FOR ALL USING (public.is_admin());


-- ─── 13. HELPER RPCs ──────────────────────────────────────────

-- Platform-wide overview stats (used by admin dashboard)
CREATE OR REPLACE FUNCTION public.get_platform_overview()
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_students',    (SELECT COUNT(*) FROM public.profiles WHERE role = 'student'),
    'total_lecturers',   (SELECT COUNT(*) FROM public.profiles WHERE role = 'lecturer'),
    'total_admins',      (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin'),
    'total_courses',     (SELECT COUNT(*) FROM public.courses),
    'published_courses', (SELECT COUNT(*) FROM public.courses WHERE is_published = TRUE),
    'total_enrollments', (SELECT COUNT(*) FROM public.enrollments),
    'total_quizzes',     (SELECT COUNT(*) FROM public.quiz_attempts),
    'total_certificates',(SELECT COUNT(*) FROM public.certificates)
  ) INTO result;
  RETURN result;
END;
$$;

-- Per-lecturer stats (used by lecturer dashboard analytics)
CREATE OR REPLACE FUNCTION public.get_lecturer_stats(p_lecturer_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE AS $$
DECLARE result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_courses',  (SELECT COUNT(*) FROM public.courses WHERE lecturer_id = p_lecturer_id),
    'total_students', (
      SELECT COUNT(DISTINCT e.user_id)
      FROM public.enrollments e
      JOIN public.courses c ON c.id = e.course_id
      WHERE c.lecturer_id = p_lecturer_id
    ),
    'total_quizzes',  (
      SELECT COUNT(DISTINCT qa.id)
      FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      JOIN public.courses c ON c.id = q.course_id
      WHERE c.lecturer_id = p_lecturer_id
    ),
    'avg_score',      (
      SELECT COALESCE(
        AVG((qa.score::FLOAT / NULLIF(qa.total_questions,0)) * 100), 0
      )::INTEGER
      FROM public.quiz_attempts qa
      JOIN public.quizzes q ON q.id = qa.quiz_id
      JOIN public.courses c ON c.id = q.course_id
      WHERE c.lecturer_id = p_lecturer_id
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- User-growth over time (used by admin analytics chart)
CREATE OR REPLACE FUNCTION public.get_user_growth(days_back INTEGER DEFAULT 30)
RETURNS TABLE(day DATE, new_users BIGINT, total_users BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    (p.created_at AT TIME ZONE 'utc')::DATE AS day,
    COUNT(*)::BIGINT AS new_users,
    SUM(COUNT(*)) OVER (
      ORDER BY (p.created_at AT TIME ZONE 'utc')::DATE
    )::BIGINT AS total_users
  FROM public.profiles p
  WHERE p.created_at >= (NOW() - (days_back || ' days')::INTERVAL)
  GROUP BY 1 ORDER BY 1;
$$;


-- ─── VERIFY ───────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM public.notifications)   AS notifications_rows,
  (SELECT COUNT(*) FROM public.enrollments)     AS enrollment_rows,
  (SELECT COUNT(*) FROM public.announcements)   AS announcement_rows,
  (SELECT COUNT(*) FROM public.bookmarks)       AS bookmark_rows,
  (SELECT COUNT(*) FROM public.certificates)    AS certificate_rows,
  (SELECT COUNT(*) FROM public.badges)          AS badge_rows,
  (SELECT COUNT(*) FROM public.feedback)        AS feedback_rows,
  (SELECT COUNT(*) FROM public.activity_logs)   AS activity_log_rows,
  'MIGRATION 004 COMPLETE' AS status;
