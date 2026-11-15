-- ==============================================================================
-- IMMEDIATE SUPABASE FIX FOR USERS & CORE EXTENSION COLUMNS
-- Run this directly in your Supabase SQL Editor.
-- It is 100% idempotent and safe to run multiple times.
-- ==============================================================================

-- 1. Ensure all columns exist on the 'users' table
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS is_superuser BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2. Backfill safe defaults for any existing rows that had NULL
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;
UPDATE users SET is_superuser = FALSE WHERE is_superuser IS NULL;

-- 3. Ensure critical project isolation columns & foreign key reference public.users
ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS projects ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
ALTER TABLE IF EXISTS public.projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Ensure manuscript security and architecture columns exist
ALTER TABLE IF EXISTS manuscripts ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS manuscripts ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT TRUE;

-- 5. Ensure entity & relationship Story Architect columns exist
ALTER TABLE IF EXISTS entities ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE IF EXISTS entities ADD COLUMN IF NOT EXISTS canon_status VARCHAR(50) DEFAULT 'established';
ALTER TABLE IF EXISTS entities ADD COLUMN IF NOT EXISTS protection_level INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS entities ADD COLUMN IF NOT EXISTS provenance VARCHAR(50) DEFAULT 'manual';
ALTER TABLE IF EXISTS entities ADD COLUMN IF NOT EXISTS custom_properties JSONB DEFAULT '{}';
ALTER TABLE IF EXISTS entities ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS entities ADD COLUMN IF NOT EXISTS first_appearance_chapter_id UUID;

ALTER TABLE IF EXISTS relationships ADD COLUMN IF NOT EXISTS direction VARCHAR(50) DEFAULT 'directed';
ALTER TABLE IF EXISTS relationships ADD COLUMN IF NOT EXISTS custom_properties JSONB DEFAULT '{}';
ALTER TABLE IF EXISTS relationships ADD COLUMN IF NOT EXISTS provenance VARCHAR(50) DEFAULT 'manual';
ALTER TABLE IF EXISTS relationships ADD COLUMN IF NOT EXISTS protection_level INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS relationships ADD COLUMN IF NOT EXISTS source_quote TEXT;

ALTER TABLE IF EXISTS story_facts ADD COLUMN IF NOT EXISTS canon_status VARCHAR(50) DEFAULT 'established';
ALTER TABLE IF EXISTS story_facts ADD COLUMN IF NOT EXISTS protection_level INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS story_facts ADD COLUMN IF NOT EXISTS provenance VARCHAR(50) DEFAULT 'manuscript_extracted';
ALTER TABLE IF EXISTS story_facts ADD COLUMN IF NOT EXISTS fact_category VARCHAR(50) DEFAULT 'general';

ALTER TABLE IF EXISTS timeline_events ADD COLUMN IF NOT EXISTS canon_status VARCHAR(50) DEFAULT 'established';
ALTER TABLE IF EXISTS continuity_issues ADD COLUMN IF NOT EXISTS classification VARCHAR(50) DEFAULT 'likely_conflict';
ALTER TABLE IF EXISTS continuity_issues ADD COLUMN IF NOT EXISTS evidence JSONB DEFAULT '[]';
ALTER TABLE IF EXISTS sensitive_approvals ADD COLUMN IF NOT EXISTS decided_by_id UUID;

-- Return confirmation
SELECT 'Supabase schema successfully updated with all columns and defaults!' AS status;
