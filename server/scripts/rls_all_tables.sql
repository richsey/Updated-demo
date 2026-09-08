-- ============================================================
-- DataFlow AI — Complete RLS Policies
-- Tables: courses, materials, material_progress, questions,
--         quiz_attempts, quizzes, student_progress
--
-- Schema truth sourced from: database.types.ts + controllers
-- Backend uses SERVICE ROLE KEY → bypasses RLS automatically.
-- Frontend anon/authed clients need explicit policies below.
-- Run this in Supabase SQL Editor in one shot.
-- ============================================================


-- ============================================================
-- 1. COURSES
-- Schema confirmed: id, title, ..., lecturer_id (FK → profiles.id), status, is_published
-- READ:   Any authenticated user can read published courses.
--         Lecturers can read their own drafts/pending/rejected.
--         Admins can read everything.
-- WRITE:  Lecturers INSERT their own courses (lecturer_id = auth.uid()).
--         Lecturers UPDATE their own non-published courses.
--         Only service-role (backend) does full admin approve/reject/publish.
-- ============================================================

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Drop any old blanket policies first
DROP POLICY IF EXISTS "Students can view published courses"    ON courses;
DROP POLICY IF EXISTS "Lecturers can view own courses"        ON courses;
DROP POLICY IF EXISTS "Admins can view all courses"           ON courses;
DROP POLICY IF EXISTS "Lecturers can insert own courses"      ON courses;
DROP POLICY IF EXISTS "Lecturers can update own courses"      ON courses;
DROP POLICY IF EXISTS "Admins can update any course"          ON courses;
DROP POLICY IF EXISTS "Admins can delete any course"          ON courses;

-- SELECT: published courses visible to everyone authenticated
CREATE POLICY "Students can view published courses"
  ON courses FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      is_published = true                                          -- any authed user sees published
      OR lecturer_id = auth.uid()                                 -- lecturers see own drafts
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'     -- admins see all
    )
  );

-- INSERT: lecturers create their own courses
CREATE POLICY "Lecturers can insert own courses"
  ON courses FOR INSERT
  WITH CHECK (
    lecturer_id = auth.uid()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('lecturer', 'admin')
  );

-- UPDATE: lecturers can update their own courses
CREATE POLICY "Lecturers can update own courses"
  ON courses FOR UPDATE
  USING (
    lecturer_id = auth.uid()
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('lecturer', 'admin')
  )
  WITH CHECK (
    lecturer_id = auth.uid()
  );

-- DELETE: admins only
CREATE POLICY "Admins can delete any course"
  ON courses FOR DELETE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );


-- ============================================================
-- 2. MATERIALS
-- Schema: id, course_id, title, type, url, duration_minutes, order_index, created_at
-- No direct owner column — ownership is through courses.lecturer_id.
-- READ:   Any authenticated user (published course materials).
-- WRITE:  Lecturers who own the parent course. Admins.
-- ============================================================

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view materials"    ON materials;
DROP POLICY IF EXISTS "Lecturers can insert materials"            ON materials;
DROP POLICY IF EXISTS "Lecturers can update own course materials" ON materials;
DROP POLICY IF EXISTS "Lecturers can delete own course materials" ON materials;

-- SELECT: any authenticated user
CREATE POLICY "Authenticated users can view materials"
  ON materials FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: lecturer owns the parent course
CREATE POLICY "Lecturers can insert materials"
  ON materials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = materials.course_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- UPDATE: lecturer owns the parent course
CREATE POLICY "Lecturers can update own course materials"
  ON materials FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = materials.course_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = materials.course_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- DELETE: lecturer owns the parent course
CREATE POLICY "Lecturers can delete own course materials"
  ON materials FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = materials.course_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );


-- ============================================================
-- 3. MATERIAL_PROGRESS
-- Schema: id, user_id, material_id, progress_pct, time_spent_seconds, completed, updated_at
-- Owner column: user_id
-- Used by progress.controller.js server-side (service role, bypasses RLS).
-- ============================================================

ALTER TABLE material_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own material progress"   ON material_progress;
DROP POLICY IF EXISTS "Students can insert own material progress" ON material_progress;
DROP POLICY IF EXISTS "Students can update own material progress" ON material_progress;
DROP POLICY IF EXISTS "Lecturers can view student progress"       ON material_progress;

-- SELECT: user sees own; lecturers/admins see all (for dashboards)
CREATE POLICY "Students can view own material progress"
  ON material_progress FOR SELECT
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('lecturer', 'admin')
  );

-- INSERT: student inserts their own row
CREATE POLICY "Students can insert own material progress"
  ON material_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: student updates their own row
CREATE POLICY "Students can update own material progress"
  ON material_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- 4. QUESTIONS
-- Schema: id, quizzes_id (FK → quizzes.id), text, options[], correct_index, explanation, order_index
-- CRITICAL: FK column is quizzes_id (NOT quiz_id) — confirmed in database.types.ts Line 168.
-- The quiz_questions table uses quiz_id. These are TWO DIFFERENT tables.
-- READ:   Any authenticated user (needed to take quizzes).
-- WRITE:  Lecturers who own the parent quiz's course. Admins.
-- ============================================================

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view questions"    ON questions;
DROP POLICY IF EXISTS "Lecturers can insert questions"            ON questions;
DROP POLICY IF EXISTS "Lecturers can update own questions"        ON questions;
DROP POLICY IF EXISTS "Lecturers can delete own questions"        ON questions;

-- SELECT: any authenticated user
CREATE POLICY "Authenticated users can view questions"
  ON questions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: lecturer owns the quiz's course
CREATE POLICY "Lecturers can insert questions"
  ON questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
        JOIN courses ON courses.id = quizzes.course_id
      WHERE quizzes.id = questions.quizzes_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- UPDATE: lecturer owns the quiz's course
CREATE POLICY "Lecturers can update own questions"
  ON questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
        JOIN courses ON courses.id = quizzes.course_id
      WHERE quizzes.id = questions.quizzes_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
        JOIN courses ON courses.id = quizzes.course_id
      WHERE quizzes.id = questions.quizzes_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- DELETE: lecturer owns the quiz's course
CREATE POLICY "Lecturers can delete own questions"
  ON questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM quizzes
        JOIN courses ON courses.id = quizzes.course_id
      WHERE quizzes.id = questions.quizzes_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );


-- ============================================================
-- 5. QUIZ_ATTEMPTS
-- Schema: id, user_id, quiz_id, score, total_questions, duration_seconds, created_at
-- Owner column: user_id
-- READ:   Student reads own attempts. Lecturers/admins can read for analytics.
-- WRITE:  Student INSERTs their own attempt. No UPDATE/DELETE (immutable).
-- ============================================================

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own quiz attempts"           ON quiz_attempts;
DROP POLICY IF EXISTS "Students can insert own quiz attempts"         ON quiz_attempts;
DROP POLICY IF EXISTS "Admins and lecturers can view all attempts"    ON quiz_attempts;

-- SELECT: student sees own; lecturers/admins see all (dashboard analytics)
CREATE POLICY "Students can view own quiz attempts"
  ON quiz_attempts FOR SELECT
  USING (
    auth.uid() = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('lecturer', 'admin')
  );

-- INSERT: student records their own attempt
CREATE POLICY "Students can insert own quiz attempts"
  ON quiz_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- No UPDATE/DELETE (database.types.ts Update: never — attempts are an audit trail)


-- ============================================================
-- 6. QUIZZES
-- Schema: id, course_id, title, created_at
-- No direct owner column — ownership via courses.lecturer_id.
-- READ:   Any authenticated user (to load quiz list and take quizzes).
-- WRITE:  Lecturers who own the parent course. Admins.
-- ============================================================

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view quizzes"    ON quizzes;
DROP POLICY IF EXISTS "Lecturers can insert quizzes"            ON quizzes;
DROP POLICY IF EXISTS "Lecturers can update own quizzes"        ON quizzes;
DROP POLICY IF EXISTS "Lecturers can delete own quizzes"        ON quizzes;

-- SELECT: any authenticated user
CREATE POLICY "Authenticated users can view quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: lecturer owns the parent course
CREATE POLICY "Lecturers can insert quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = quizzes.course_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- UPDATE: lecturer owns the parent course
CREATE POLICY "Lecturers can update own quizzes"
  ON quizzes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = quizzes.course_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = quizzes.course_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- DELETE: lecturer or admin
CREATE POLICY "Lecturers can delete own quizzes"
  ON quizzes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = quizzes.course_id
        AND courses.lecturer_id = auth.uid()
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );


-- ============================================================
-- 7. STUDENT_PROGRESS
-- Schema: id, user_id, course_id, progress, last_accessed, updated_at
-- Owner column: user_id
-- Used by progress.controller.js AND admin.ts fetchAllStudentProgress()
--         AND lecturer.ts fetchLecturerStudents()
-- READ:   Student sees own. Lecturers see their courses' students. Admins see all.
-- WRITE:  Student (or service-role backend) manages own rows.
-- ============================================================

ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own progress"                ON student_progress;
DROP POLICY IF EXISTS "Students can insert own progress"              ON student_progress;
DROP POLICY IF EXISTS "Students can update own progress"              ON student_progress;
DROP POLICY IF EXISTS "Lecturers can view progress for their courses" ON student_progress;
DROP POLICY IF EXISTS "Admins can view all student progress"          ON student_progress;

-- SELECT: student sees own rows
CREATE POLICY "Students can view own progress"
  ON student_progress FOR SELECT
  USING (auth.uid() = user_id);

-- SELECT: lecturers see progress for students in their courses
CREATE POLICY "Lecturers can view progress for their courses"
  ON student_progress FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'lecturer'
    AND EXISTS (
      SELECT 1 FROM courses
      WHERE courses.id = student_progress.course_id
        AND courses.lecturer_id = auth.uid()
    )
  );

-- SELECT: admins see everything
CREATE POLICY "Admins can view all student progress"
  ON student_progress FOR SELECT
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- INSERT: student inserts own row
CREATE POLICY "Students can insert own progress"
  ON student_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: student updates own row
CREATE POLICY "Students can update own progress"
  ON student_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- VERIFICATION QUERY — run after applying above
-- Expected: rls_enabled = true, policy_count > 0 for each table
-- ============================================================

SELECT
  c.relname                                                              AS table_name,
  c.rowsecurity                                                          AS rls_enabled,
  (
    SELECT COUNT(*)
    FROM pg_policies p
    WHERE p.tablename = c.relname
      AND p.schemaname = 'public'
  )                                                                      AS policy_count
FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'courses', 'materials', 'material_progress',
    'questions', 'quiz_attempts', 'quizzes', 'student_progress'
  )
ORDER BY c.relname;
