-- =============================================================
-- DataFlow AI — Supabase Schema Migration 001 (Fixed & Complete)
-- PREREQUISITE: Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
-- Run this entire script in Supabase SQL Editor AFTER extension.
-- =============================================================

-- ─── 1. PROFILES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  full_name  TEXT,
  role       TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Admin helper function to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.is_admin());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    CASE WHEN NEW.email LIKE '%admin%' THEN 'admin' ELSE 'student' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── 2. COURSES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  category          TEXT NOT NULL,
  difficulty        TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  format            TEXT NOT NULL CHECK (format IN ('video', 'article', 'interactive')),
  duration_minutes  INTEGER NOT NULL DEFAULT 0,
  thumbnail         TEXT NOT NULL,
  instructor        TEXT NOT NULL,
  rating            NUMERIC(3,1) NOT NULL DEFAULT 4.5,
  enrolled_count    INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Courses are publicly readable" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Admins can manage courses" ON public.courses FOR ALL USING (public.is_admin());

-- ─── 3. MATERIALS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.materials (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id        UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('video', 'tutorial')),
  url              TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  order_index      INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Materials are publicly readable" ON public.materials FOR SELECT USING (true);
CREATE POLICY "Admins can manage materials" ON public.materials FOR ALL USING (public.is_admin());

-- ─── 4. QUIZZES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quizzes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Quizzes are publicly readable" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "Admins can manage quizzes" ON public.quizzes FOR ALL USING (public.is_admin());

-- ─── 5. QUESTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  options       TEXT[] NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation   TEXT NOT NULL,
  order_index   INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Questions are publicly readable" ON public.questions FOR SELECT USING (true);
CREATE POLICY "Admins can manage questions" ON public.questions FOR ALL USING (public.is_admin());

-- ─── 6. QUIZ ATTEMPTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id          UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score            INTEGER NOT NULL,
  total_questions  INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read/insert own quiz attempts" ON public.quiz_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all quiz attempts" ON public.quiz_attempts FOR SELECT USING (public.is_admin());

-- ─── 7. STUDENT PROGRESS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_progress (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id     UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  progress      INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own progress" ON public.student_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all progress" ON public.student_progress FOR SELECT USING (public.is_admin());

-- ─── 8. MATERIAL PROGRESS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.material_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id        UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  progress_pct       INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  completed          BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, material_id)
);

ALTER TABLE public.material_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own material progress" ON public.material_progress FOR ALL USING (auth.uid() = user_id);

-- ─── 9. TELEMETRY ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.telemetry (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  entity_id  TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own telemetry" ON public.telemetry FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all telemetry" ON public.telemetry FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS telemetry_user_event_entity ON public.telemetry (user_id, event_type, entity_id);

-- ─── 10. AI RECOMMENDATIONS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.content (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title     TEXT NOT NULL,
  category  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Content public read" ON public.content FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_interactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id  UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  action_type TEXT,
  rating      INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own interactions" ON public.user_interactions FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.recommendations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.content(id) ON DELETE CASCADE,
  score      DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own recommendations" ON public.recommendations FOR SELECT USING (auth.uid() = user_id);

-- ─── 11. REALTIME SUBSCRIPTIONS ───────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_progress, public.material_progress, public.quiz_attempts, public.telemetry;

-- ─── 12. ADMIN RPC (used by admin.ts) ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_daily_engagement(days_back INTEGER DEFAULT 8)
RETURNS TABLE(day DATE, count BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT
    (t.created_at AT TIME ZONE 'utc')::DATE AS day,
    COUNT(*)::BIGINT AS count
  FROM public.telemetry t
  WHERE t.event_type = 'focus_gained'
    AND t.created_at >= (NOW() - (days_back || ' days')::INTERVAL)
  GROUP BY 1 ORDER BY 1;
$$;


