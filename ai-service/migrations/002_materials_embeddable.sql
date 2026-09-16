-- ============================================================
-- Phase 3 Migration: add embeddable column to materials
-- Purpose: Cache per-row embeddability so the viewer knows
--          at render time whether to show iframe or fallback.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Forward migration
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS embeddable BOOLEAN DEFAULT NULL;

-- NULL means "not yet checked"
-- TRUE  means iframe is safe to show
-- FALSE means show fallback card (open-in-new-tab)

COMMENT ON COLUMN materials.embeddable IS
    'Cached result of the embeddability probe. '
    'NULL = not yet checked, TRUE = iframe-safe, FALSE = blocked.';

-- Index for the backfill query (find un-checked rows efficiently)
CREATE INDEX IF NOT EXISTS idx_materials_embeddable_null
    ON materials (id)
    WHERE embeddable IS NULL;

-- ============================================================
-- ROLLBACK (run to undo):
-- ============================================================
-- DROP INDEX IF EXISTS idx_materials_embeddable_null;
-- ALTER TABLE materials DROP COLUMN IF EXISTS embeddable;
