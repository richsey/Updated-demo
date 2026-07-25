-- =============================================================
-- DataFlow AI — Supabase Schema Migration 003
-- Adds: lecturer role, enrollments, notifications, announcements,
--       bookmarks, certificates, badges, user_badges, feedback,
--       activity_logs; extends profiles and courses tables.
-- Run in Supabase SQL Editor after migration 001.
-- =============================================================

-- ─── 1. EXTEND PROFILES TABLE ─────────────────────────────────
-- Update role CHECK to allow 'lecturer'
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'lecturer', 'admin'));

-- Add extra profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url       TEXT,
  ADD COLUMN IF NOT EXISTS bio              TEXT,
  ADD COLUMN IF NOT EXISTS phone            TEXT,
  ADD COLUMN IF NOT EXISTS interests        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS learning_goals   TEXT,
  ADD COLUMN IF NOT EXISTS is_suspended     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Update the auto-create trigger to keep role as 'student' only (admin assigns lecturer)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    CASE WHEN NEW.email LIKE '%+admin%' THEN 'admin' ELSE 'student' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── 2. EXTEND COURSES TABLE ──────────────────────────────────
-- Add publication workflow columns
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS lecturer_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'pending_approval', 'published', 'rejected', 'archived')),
  ADD COLUMN IF NOT EXISTS is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tags          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS rejection_note TEXT,
  ADD COLUMN IF NOT EXISTS approved_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Update existing courses to be published (they were already live)
UPDATE public.courses SET status = 'published', is_published = TRUE
  WHERE status = 'published' OR is_published IS NULL;

-- RLS: Lecturers can manage their own courses
DROP POLICY IF EXISTS "Lecturers can manage own courses" ON public.courses;
CREATE POLICY "Lecturers can manage own courses"
  ON public.courses FOR ALL
  USING (auth.uid() = lecturer_id);

-- ─── 3. ENROLLMENTS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can manage own enrollments"
  ON public.enrollments FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Lecturers can view enrollments for their courses"
  ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all enrollments"
  ON public.enrollments FOR ALL USING (public.is_admin());

CREATE INDEX IF NOT EXISTS enrollments_user_id ON public.enrollments (user_id);
CREATE INDEX IF NOT EXISTS enrollments_course_id ON public.enrollments (course_id);

-- ─── 4. NOTIFICATIONS ─────────────────────────────────────────
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

CREATE POLICY "Users can manage own notifications"
  ON public.notifications FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all notifications"
  ON public.notifications FOR ALL USING (public.is_admin());

CREATE INDEX IF NOT EXISTS notifications_user_unread ON public.notifications (user_id, is_read);

-- ─── 5. ANNOUNCEMENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   UUID REFERENCES public.courses(id) ON DELETE CASCADE, -- NULL = platform-wide
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read announcements"
  ON public.announcements FOR SELECT USING (true);

CREATE POLICY "Lecturers can manage own announcements"
  ON public.announcements FOR ALL USING (auth.uid() = author_id);

CREATE POLICY "Admins can manage all announcements"
  ON public.announcements FOR ALL USING (public.is_admin());

-- ─── 6. BOOKMARKS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, material_id)
);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
  ON public.bookmarks FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bookmarks_user_id ON public.bookmarks (user_id);

-- ─── 7. CERTIFICATES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  certificate_uid TEXT NOT NULL UNIQUE DEFAULT 'CERT-' || upper(substring(gen_random_uuid()::text, 1, 8)),
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own certificates"
  ON public.certificates FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert certificates"
  ON public.certificates FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all certificates"
  ON public.certificates FOR ALL USING (public.is_admin());

-- ─── 8. BADGES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon        TEXT NOT NULL DEFAULT '🏆',
  color       TEXT NOT NULL DEFAULT 'primary',
  criteria    JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are publicly readable" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Admins can manage badges" ON public.badges FOR ALL USING (public.is_admin());

-- Seed default badges
INSERT INTO public.badges (name, description, icon, color, criteria) VALUES
  ('First Step',      'Completed your first course material',      '🎯', 'primary',  '{"type": "material_complete", "count": 1}'),
  ('Quiz Ace',        'Scored 100% on a quiz',                     '⭐', 'amber',    '{"type": "quiz_perfect_score"}'),
  ('Fast Learner',    'Completed 5 materials in one day',          '⚡', 'yellow',   '{"type": "daily_materials", "count": 5}'),
  ('Course Champion', 'Completed your first full course',          '🏆', 'emerald',  '{"type": "course_complete", "count": 1}'),
  ('Scholar',         'Completed 5 full courses',                  '📚', 'blue',     '{"type": "course_complete", "count": 5}'),
  ('Quiz Master',     'Completed 10 quizzes with 80%+ score',      '🎓', 'violet',   '{"type": "quiz_high_score", "count": 10, "min_score": 80}'),
  ('Dedicated',       'Studied for 10+ hours total',               '💪', 'rose',     '{"type": "study_time_hours", "count": 10}'),
  ('Streak Hero',     'Maintained a 7-day learning streak',        '🔥', 'orange',   '{"type": "study_streak_days", "count": 7}')
ON CONFLICT (name) DO NOTHING;

-- ─── 9. USER BADGES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_badges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id   UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own badges"
  ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert user badges"
  ON public.user_badges FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user badges"
  ON public.user_badges FOR ALL USING (public.is_admin());

-- ─── 10. FEEDBACK ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback"
  ON public.feedback FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Lecturers can read feedback for their courses"
  ON public.feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.lecturer_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all feedback"
  ON public.feedback FOR SELECT USING (public.is_admin());

-- ─── 11. ACTIVITY LOGS (Audit Trail) ──────────────────────────
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

CREATE POLICY "Admins can read all activity logs"
  ON public.activity_logs FOR SELECT USING (public.is_admin());

CREATE POLICY "System can insert activity logs"
  ON public.activity_logs FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS activity_logs_actor ON public.activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS activity_logs_created ON public.activity_logs (created_at DESC);

-- ─── 12. REALTIME SUBSCRIPTIONS ───────────────────────────────
ALTER PUBLICATION supabase_realtime
  ADD TABLE public.notifications, public.announcements, public.enrollments;

-- ─── 13. HELPER RPCs ──────────────────────────────────────────

-- Admin RPC: Get user growth by day
CREATE OR REPLACE FUNCTION public.get_user_growth(days_back INTEGER DEFAULT 30)
RETURNS TABLE(day DATE, new_users BIGINT, total_users BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    (p.created_at AT TIME ZONE 'utc')::DATE AS day,
    COUNT(*)::BIGINT AS new_users,
    SUM(COUNT(*)) OVER (ORDER BY (p.created_at AT TIME ZONE 'utc')::DATE)::BIGINT AS total_users
  FROM public.profiles p
  WHERE p.created_at >= (NOW() - (days_back || ' days')::INTERVAL)
  GROUP BY 1 ORDER BY 1;
$$;

-- Admin RPC: Get platform overview stats
CREATE OR REPLACE FUNCTION public.get_platform_overview()
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_students',   (SELECT COUNT(*) FROM public.profiles WHERE role = 'student'),
    'total_lecturers',  (SELECT COUNT(*) FROM public.profiles WHERE role = 'lecturer'),
    'total_admins',     (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin'),
    'total_courses',    (SELECT COUNT(*) FROM public.courses),
    'published_courses',(SELECT COUNT(*) FROM public.courses WHERE is_published = TRUE),
    'total_enrollments',(SELECT COUNT(*) FROM public.enrollments),
    'total_quizzes',    (SELECT COUNT(*) FROM public.quiz_attempts),
    'total_certificates',(SELECT COUNT(*) FROM public.certificates)
  ) INTO result;
  RETURN result;
END;
$$;

-- Lecturer RPC: Get stats for a specific lecturer's courses
CREATE OR REPLACE FUNCTION public.get_lecturer_stats(p_lecturer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_courses',    (SELECT COUNT(*) FROM public.courses WHERE lecturer_id = p_lecturer_id),
    'total_students',   (SELECT COUNT(DISTINCT e.user_id) FROM public.enrollments e
                          JOIN public.courses c ON c.id = e.course_id
                          WHERE c.lecturer_id = p_lecturer_id),
    'total_quizzes',    (SELECT COUNT(DISTINCT qa.id) FROM public.quiz_attempts qa
                          JOIN public.quizzes q ON q.id = qa.quiz_id
                          JOIN public.courses c ON c.id = q.course_id
                          WHERE c.lecturer_id = p_lecturer_id),
    'avg_score',        (SELECT COALESCE(AVG((qa.score::FLOAT / qa.total_questions) * 100), 0)::INTEGER
                          FROM public.quiz_attempts qa
                          JOIN public.quizzes q ON q.id = qa.quiz_id
                          JOIN public.courses c ON c.id = q.course_id
                          WHERE c.lecturer_id = p_lecturer_id)
  ) INTO result;
  RETURN result;
END;
$$;
