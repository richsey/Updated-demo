-- =============================================================
-- DataFlow AI — Seed Data 002 (Complete)
-- Run AFTER 001_schema.sql. Uses fixed IDs and duration_minutes.
-- =============================================================

-- ─── COURSES ──────────────────────────────────────────────────
INSERT INTO public.courses (id, title, description, category, difficulty, format, duration_minutes, thumbnail, instructor, rating, enrolled_count)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'React Fundamentals',
   'Master React building blocks: components, props, state, lifecycle.',
   'Frontend', 'beginner', 'video', 120,
   'https://images.unsplash.com/photo-1633356122544-f134324a6cee?auto=format&fit=crop&w=800&q=80',
   'Sarah Chen', 4.8, 2340),

  ('a0000000-0000-0000-0000-000000000002', 'State Management with Hooks',
   'Deep dive into useState, useEffect, useContext, useReducer, custom hooks.',
   'Frontend', 'intermediate', 'interactive', 90,
   'https://images.unsplash.com/photo-1555099962-4199c345e5dd?auto=format&fit=crop&w=800&q=80',
   'Marcus Johnson', 4.6, 1820),

  ('a0000000-0000-0000-0000-000000000003', 'Advanced React Patterns',
   'Compound components, render props, HOCs, performance optimization.',
   'Frontend', 'advanced', 'article', 150,
   'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
   'Elena Rodriguez', 4.9, 980),

  ('a0000000-0000-0000-0000-000000000004', 'TypeScript for React Developers',
   'TypeScript fundamentals and typing React components, hooks, context.',
   'Languages', 'intermediate', 'video', 100,
   'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?auto=format&fit=crop&w=800&q=80',
   'David Kim', 4.7, 1560),

  ('a0000000-0000-0000-0000-000000000005', 'CSS & Tailwind Mastery',
   'CSS fundamentals to advanced Tailwind patterns for modern UI.',
   'Styling', 'beginner', 'interactive', 80,
   'https://images.unsplash.com/photo-1507721999472-8ed4421c4af2?auto=format&fit=crop&w=800&q=80',
   'Aisha Patel', 4.5, 3100),

  ('a0000000-0000-0000-0000-000000000006', 'REST API Design',
   'Design robust REST APIs: auth, error handling, documentation.',
   'Backend', 'intermediate', 'article', 110,
   'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
   'James Wright', 4.4, 1200)

ON CONFLICT (id) DO NOTHING;

-- ─── MATERIALS ────────────────────────────────────────────────
INSERT INTO public.materials (id, course_id, title, type, url, duration_minutes, order_index)
VALUES
  -- React Fundamentals
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'What is React?', 'video', 'https://www.youtube.com/watch?v=N3AkSS5hXMA', 10, 1),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'JSX in 2 Minutes', 'video', 'https://www.youtube.com/watch?v=7fPXI_MnBOY', 8, 2),

  -- State Management
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'useState Deep Dive', 'tutorial', 'https://react.dev/reference/react/useState', 20, 1),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', 'useEffect Patterns', 'video', 'https://www.youtube.com/watch?v=0ZJgIjIuY7U', 25, 2),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000002', 'Custom Hooks Guide', 'tutorial', 'https://react.dev/learn/reusing-logic-with-custom-hooks', 15, 3),

  -- Advanced Patterns
  ('b0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'Compound Components', 'tutorial', 'https://react.dev/learn/passing-data-deeply-with-context#before-we-start', 30, 1),
  ('b0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000003', 'Performance Optimization', 'video', 'https://www.youtube.com/watch?v=keTcXT145CI', 35, 2),

  -- TypeScript
  ('b0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000004', 'TypeScript Basics', 'video', 'https://www.youtube.com/watch?v=zQnBQ4tB3ZA', 20, 1),
  ('b0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000004', 'Typing React Components', 'tutorial', 'https://react.dev/learn/typescript', 18, 2),

  -- CSS & Tailwind
  ('b0000000-0000-0000-0000-000000000010', 'a0000000-0000-0000-0000-000000000005', 'CSS Grid & Flexbox', 'tutorial', 'https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Flexbox', 25, 1),
  ('b0000000-0000-0000-0000-000000000011', 'a0000000-0000-0000-0000-000000000005', 'Tailwind Utility Patterns', 'video', 'https://www.youtube.com/watch?v=UBOj6rqRUME', 20, 2),

  -- REST API
  ('b0000000-0000-0000-0000-000000000012', 'a0000000-0000-0000-0000-000000000006', 'API Design Principles', 'tutorial', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods', 15, 1),
  ('b0000000-0000-0000-0000-000000000013', 'a0000000-0000-0000-0000-000000000006', 'Authentication Patterns', 'video', 'https://www.youtube.com/watch?v=mbsmsi7pe3s', 28, 2)

ON CONFLICT (id) DO NOTHING;

-- ─── QUIZZES ──────────────────────────────────────────────────
INSERT INTO public.quizzes (id, course_id, title)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'React Fundamentals Quiz'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'State Management Quiz'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'Advanced React Patterns Quiz'),
  ('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000004', 'TypeScript Quiz'),
  ('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000005', 'CSS Mastery Quiz'),
  ('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000006', 'REST API Quiz')

ON CONFLICT (id) DO NOTHING;

-- ─── QUESTIONS ────────────────────────────────────────────────
INSERT INTO public.questions (quiz_id, text, options, correct_index, explanation, order_index)
VALUES
  -- React Fundamentals (Quiz 1)
  ('d0000000-0000-0000-0000-000000000001', 'What is JSX?', ARRAY['JS library', 'Syntax extension for JS/HTML', 'CSS framework', 'DB language'], 1, 'JSX = JavaScript XML syntax extension.', 1),
  ('d0000000-0000-0000-0000-000000000001', 'Pass data parent → child?', ARRAY['state', 'props', 'context', 'refs'], 1, 'Props pass data down.', 2),
  ('d0000000-0000-0000-0000-000000000001', 'Local state hook?', ARRAY['useEffect', 'useContext', 'useState', 'useRef'], 2, 'useState() for local state.', 3),
  ('d0000000-0000-0000-0000-000000000001', 'Triggers re-render?', ARRAY['function call', 'var change', 'state/props update', 'console.log'], 2, 'State/prop changes trigger re-renders.', 4),

  -- State Management (Quiz 2)
  ('d0000000-0000-0000-0000-000000000002', 'useEffect deps control?', ARRAY['style', 're-run timing', 'children', 'props'], 1, 'Deps array determines effect re-runs.', 1),
  ('d0000000-0000-0000-0000-000000000002', 'useReducer vs useState?', ARRAY['toggles', 'complex state', 'styling', 'API'], 1, 'Complex logic → useReducer.', 2),
  ('d0000000-0000-0000-0000-000000000002', 'Custom hook?', ARRAY['built-in', 'reusable hook logic', 'CSS', 'test'], 1, 'Custom hooks reuse hook logic.', 3),

  -- Add 1 question per other quiz for completeness
  ('d0000000-0000-0000-0000-000000000003', 'Compound pattern benefit?', ARRAY['speed', 'shared state', 'auto-style', 'replaces Redux'], 1, 'Implicit state sharing.', 1),
  ('d0000000-0000-0000-0000-000000000004', 'Type React props?', ARRAY['interface/type', 'React auto', 'PropTypes', 'any'], 0, 'Use Interface/Type alias.', 1),
  ('d0000000-0000-0000-0000-000000000005', 'Tailwind flex-col?', ARRAY['color', 'flex-direction:column', 'border', 'center'], 1, 'Sets column flex direction.', 1),
  ('d0000000-0000-0000-0000-000000000006', 'Update entire resource?', ARRAY['GET', 'POST', 'PUT', 'PATCH'], 2, 'PUT = full replace.', 1)

ON CONFLICT (id) DO NOTHING;

-- ─── AI CONTENT ───────────────────────────────────────────────
INSERT INTO public.content (id, title, category)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'React Basics', 'frontend'),
  ('c0000000-0000-0000-0000-000000000002', 'Node.js API', 'backend'),
  ('c0000000-0000-0000-0000-000000000003', 'AI Introduction', 'ai'),
  ('c0000000-0000-0000-0000-000000000004', 'Machine Learning', 'ai'),
  ('c0000000-0000-0000-0000-000000000005', 'Advanced CSS', 'frontend')

ON CONFLICT (id) DO NOTHING;

SELECT 'SEED COMPLETE: 6 courses, 13 materials, 6 quizzes w/ questions, 5 AI content' AS status;

