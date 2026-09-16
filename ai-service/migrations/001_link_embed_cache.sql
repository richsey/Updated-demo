-- ============================================================
-- Phase 2 Migration: link_embed_cache
-- Purpose: Cache embeddability probe results per-host so the
--          same domain is not re-checked on every request.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS link_embed_cache (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    host        TEXT        NOT NULL UNIQUE,       -- e.g. "www.youtube.com"
    embeddable  BOOLEAN     NOT NULL,
    reason      TEXT        NOT NULL,
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by host (the primary query pattern)
CREATE INDEX IF NOT EXISTS idx_link_embed_cache_host
    ON link_embed_cache (host);

-- Allow the AI service (service-role key) full access
ALTER TABLE link_embed_cache ENABLE ROW LEVEL SECURITY;

-- Service role bypass (backend uses the service role key, which bypasses RLS
-- automatically in Supabase, so this policy is a belt-and-suspenders guard
-- for any future authenticated reads):
CREATE POLICY "Service role full access"
    ON link_embed_cache FOR ALL
    USING (true)
    WITH CHECK (true);

-- Authenticated frontend users can read cache entries (read-only)
-- so the client can also call this table directly if needed.
CREATE POLICY "Authenticated users can read cache"
    ON link_embed_cache FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- ============================================================
-- ROLLBACK (run to undo the migration):
-- ============================================================
-- DROP TABLE IF EXISTS link_embed_cache;
