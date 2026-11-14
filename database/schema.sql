-- ==============================================================================
-- LIVING STORY BIBLE — AI CONTINUITY GUARDIAN
-- PostgreSQL / Supabase Schema with Row Level Security (RLS)
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for user query performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- 2. MANUSCRIPTS TABLE
CREATE TABLE IF NOT EXISTS manuscripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'docx', 'txt', 'md', 'pdf'
    file_size INTEGER DEFAULT 0,
    storage_path TEXT,
    encrypted BOOLEAN DEFAULT TRUE,
    is_encrypted BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'processed', -- 'uploaded', 'processing', 'processed', 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_manuscripts_project_id ON manuscripts(project_id);

-- 3. CHAPTERS TABLE
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    manuscript_id UUID REFERENCES manuscripts(id) ON DELETE SET NULL,
    chapter_number INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chapters_project_id ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_manuscript_id ON chapters(manuscript_id);
CREATE INDEX IF NOT EXISTS idx_chapters_order ON chapters(project_id, chapter_number);

-- 4. PASSAGES TABLE (Fine-grained narrative chunks for evidence tracing)
CREATE TABLE IF NOT EXISTS passages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    passage_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    char_start INTEGER DEFAULT 0,
    char_end INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_passages_project_id ON passages(project_id);
CREATE INDEX IF NOT EXISTS idx_passages_chapter_id ON passages(chapter_id);

-- 5. ENTITIES TABLE (Characters, Locations, Objects, World Rules, Events)
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'character', 'location', 'object', 'rule', 'event', 'faction'
    description TEXT,
    traits JSONB DEFAULT '[]'::jsonb, -- array of strings e.g. ["brave", "missing left arm"]
    first_appearance_chapter INTEGER DEFAULT 1,
    first_appearance_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entities_project_id ON entities(project_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(project_id, entity_type);

-- 6. RELATIONSHIPS TABLE (Knowledge Graph Edges)
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL, -- 'allied_with', 'visited', 'located_in', 'opposes', etc.
    description TEXT,
    source_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    source_quote TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relationships_project_id ON relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);

-- 7. STORY FACTS TABLE (Evidence-backed Canon Memory)
CREATE TABLE IF NOT EXISTS story_facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general', -- 'status', 'physical', 'location', 'date', 'rule', 'physical_state', 'lore_rule'
    fact_category VARCHAR(50) DEFAULT 'general',
    source_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    source_chapter_number INTEGER,
    source_quote TEXT NOT NULL,
    confidence NUMERIC(4, 2) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_story_facts_project_id ON story_facts(project_id);
CREATE INDEX IF NOT EXISTS idx_story_facts_entity_id ON story_facts(entity_id);

-- 8. STORY / TIMELINE EVENTS TABLE
CREATE TABLE IF NOT EXISTS timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    chapter_number INTEGER,
    chronology_order INTEGER DEFAULT 0,
    date_or_time_label VARCHAR(100),
    participants JSONB DEFAULT '[]'::jsonb,
    location VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_project ON timeline_events(project_id, chronology_order);

-- 9. CONTINUITY ISSUES TABLE (Flagged Discrepancies with Evidence)
CREATE TABLE IF NOT EXISTS continuity_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
    issue_type VARCHAR(100) NOT NULL, -- 'physical_continuity', 'lore_rule_violation', 'location_conflict', 'death_continuity', 'timeline_inconsistency'
    classification VARCHAR(50) DEFAULT 'likely_conflict', -- 'likely_conflict', 'possible_conflict', 'intentional_or_explainable', 'insufficient_evidence'
    severity VARCHAR(50) DEFAULT 'high', -- 'high', 'medium', 'low'
    confidence NUMERIC(4, 2) DEFAULT 0.90,
    explanation TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'unresolved', -- 'open', 'unresolved', 'resolved', 'intentional', 'dismissed', 'review_later'
    evidence JSONB DEFAULT '[]'::jsonb, -- array of {chapter, chapter_id, quote}
    earlier_passage TEXT,
    new_passage TEXT,
    earlier_chapter_number INTEGER,
    new_chapter_number INTEGER,
    suggestions JSONB DEFAULT '[]'::jsonb,
    author_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_continuity_issues_project ON continuity_issues(project_id, status);
CREATE INDEX IF NOT EXISTS idx_continuity_issues_chapter ON continuity_issues(chapter_id);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE
-- ==============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuity_issues ENABLE ROW LEVEL SECURITY;

-- 1. Projects RLS
CREATE POLICY "Users can manage their own projects"
ON projects FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. Manuscripts RLS
CREATE POLICY "Users can access manuscripts in their projects"
ON manuscripts FOR ALL
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = manuscripts.project_id AND projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = manuscripts.project_id AND projects.user_id = auth.uid()));

-- 3. Chapters RLS
CREATE POLICY "Users can access chapters in their projects"
ON chapters FOR ALL
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = chapters.project_id AND projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = chapters.project_id AND projects.user_id = auth.uid()));

-- 4. Passages RLS
CREATE POLICY "Users can access passages in their projects"
ON passages FOR ALL
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = passages.project_id AND projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = passages.project_id AND projects.user_id = auth.uid()));

-- 5. Entities RLS
CREATE POLICY "Users can access entities in their projects"
ON entities FOR ALL
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = entities.project_id AND projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = entities.project_id AND projects.user_id = auth.uid()));

-- 6. Relationships RLS
CREATE POLICY "Users can access relationships in their projects"
ON relationships FOR ALL
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = relationships.project_id AND projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = relationships.project_id AND projects.user_id = auth.uid()));

-- 7. Story Facts RLS
CREATE POLICY "Users can access story facts in their projects"
ON story_facts FOR ALL
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = story_facts.project_id AND projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = story_facts.project_id AND projects.user_id = auth.uid()));

-- 8. Timeline Events RLS
CREATE POLICY "Users can access timeline events in their projects"
ON timeline_events FOR ALL
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = timeline_events.project_id AND projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = timeline_events.project_id AND projects.user_id = auth.uid()));

-- 9. Continuity Issues RLS
CREATE POLICY "Users can access continuity issues in their projects"
ON continuity_issues FOR ALL
USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = continuity_issues.project_id AND projects.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM projects WHERE projects.id = continuity_issues.project_id AND projects.user_id = auth.uid()));
