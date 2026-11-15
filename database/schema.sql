-- ==============================================================================
-- NORTHSTAR — AI CONTINUITY GUARDIAN & LIVING STORY BIBLE
-- Canonical Complete Database Schema (PostgreSQL / Supabase with RLS)
-- Covers all 23 database models & complete Story Architect extensions
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_superuser BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_demo BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_demo ON projects(is_demo);

-- 3. PROJECT MEMBERS TABLE (Multi-user Project Collaboration)
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'editor', -- 'owner', 'editor', 'viewer'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_members_proj ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);

-- 4. MANUSCRIPTS TABLE
CREATE TABLE IF NOT EXISTS manuscripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'docx', 'txt', 'md', 'pdf'
    file_size INTEGER DEFAULT 0,
    storage_path TEXT,
    encrypted BOOLEAN DEFAULT TRUE,
    is_encrypted BOOLEAN DEFAULT TRUE,
    status VARCHAR(50) DEFAULT 'processed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manuscripts_project_id ON manuscripts(project_id);

-- 5. CHAPTERS TABLE
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

-- 6. PASSAGES TABLE
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

-- 7. ENTITY CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS entity_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT 'Box',
    color VARCHAR(50) DEFAULT '#3B82F6',
    is_default BOOLEAN DEFAULT FALSE,
    default_properties JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_entity_categories_proj ON entity_categories(project_id);

-- 8. ENTITIES TABLE
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    category_id UUID REFERENCES entity_categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    description TEXT,
    traits JSONB DEFAULT '[]'::jsonb,
    first_appearance_chapter INTEGER DEFAULT 1,
    first_appearance_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    canon_status VARCHAR(50) DEFAULT 'established', -- draft, planned, established, retired
    protection_level INTEGER DEFAULT 1, -- 1: unlocked, 2: protected, 3: locked, 4: immutable
    provenance VARCHAR(50) DEFAULT 'manual', -- manual, manuscript_extracted, ai_suggested, imported
    custom_properties JSONB DEFAULT '{}'::jsonb,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_entities_project_id ON entities(project_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(project_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_canon ON entities(project_id, canon_status);

-- 9. RELATIONSHIPS TABLE
CREATE TABLE IF NOT EXISTS relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    source_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation_type VARCHAR(100) NOT NULL,
    description TEXT,
    source_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    source_quote TEXT,
    direction VARCHAR(50) DEFAULT 'directed',
    custom_properties JSONB DEFAULT '{}'::jsonb,
    provenance VARCHAR(50) DEFAULT 'manual',
    protection_level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_relationships_project_id ON relationships(project_id);
CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_entity_id);

-- 10. STORY FACTS TABLE
CREATE TABLE IF NOT EXISTS story_facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    fact TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    fact_category VARCHAR(50) DEFAULT 'general',
    source_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    source_chapter_number INTEGER,
    source_quote TEXT NOT NULL,
    confidence NUMERIC(4, 2) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    canon_status VARCHAR(50) DEFAULT 'established',
    protection_level INTEGER DEFAULT 1,
    provenance VARCHAR(50) DEFAULT 'manuscript_extracted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_story_facts_project_id ON story_facts(project_id);
CREATE INDEX IF NOT EXISTS idx_story_facts_entity_id ON story_facts(entity_id);

-- 11. TIMELINE EVENTS TABLE
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
    canon_status VARCHAR(50) DEFAULT 'established',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_timeline_events_project ON timeline_events(project_id, chronology_order);

-- 12. CONTINUITY ISSUES TABLE
CREATE TABLE IF NOT EXISTS continuity_issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
    issue_type VARCHAR(100) NOT NULL,
    classification VARCHAR(50) DEFAULT 'likely_conflict',
    severity VARCHAR(50) DEFAULT 'high',
    confidence NUMERIC(4, 2) DEFAULT 0.90,
    explanation TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'unresolved',
    evidence JSONB DEFAULT '[]'::jsonb,
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

-- 13. CANVASES TABLE
CREATE TABLE IF NOT EXISTS canvases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    view_type VARCHAR(50) DEFAULT 'relationship',
    layout_type VARCHAR(50) DEFAULT 'manual',
    viewport JSONB DEFAULT '{"x": 0, "y": 0, "zoom": 1}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_canvases_project ON canvases(project_id);

-- 14. CANVAS NODES TABLE
CREATE TABLE IF NOT EXISTS canvas_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    x NUMERIC(10, 2) DEFAULT 0.0,
    y NUMERIC(10, 2) DEFAULT 0.0,
    width NUMERIC(10, 2) DEFAULT 220.0,
    height NUMERIC(10, 2) DEFAULT 120.0,
    visual_override JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_canvas ON canvas_nodes(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_entity ON canvas_nodes(entity_id);

-- 15. NARRATIVE GROUPS TABLE
CREATE TABLE IF NOT EXISTS narrative_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_group_id UUID REFERENCES narrative_groups(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    group_type VARCHAR(100) DEFAULT 'general',
    description TEXT,
    color VARCHAR(50) DEFAULT '#6B7280',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_narrative_groups_project ON narrative_groups(project_id);

-- 16. GROUP MEMBERSHIPS TABLE
CREATE TABLE IF NOT EXISTS group_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES narrative_groups(id) ON DELETE CASCADE,
    entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    canvas_id UUID REFERENCES canvases(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);

-- 17. ENTITY ATTACHMENTS TABLE
CREATE TABLE IF NOT EXISTS entity_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER DEFAULT 0,
    storage_path TEXT,
    url TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_entity_attachments_project ON entity_attachments(project_id);

-- 18. ENTITY ATTACHMENT LINKS TABLE
CREATE TABLE IF NOT EXISTS entity_attachment_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    attachment_id UUID NOT NULL REFERENCES entity_attachments(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'reference',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attachment_links_entity ON entity_attachment_links(entity_id);
CREATE INDEX IF NOT EXISTS idx_attachment_links_attachment ON entity_attachment_links(attachment_id);

-- 19. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    actor_id UUID,
    actor_name VARCHAR(255) DEFAULT 'Author',
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id UUID,
    target_name VARCHAR(255),
    previous_value JSONB,
    new_value JSONB,
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id, created_at);

-- 20. PROJECT SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS project_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_milestone BOOLEAN DEFAULT FALSE,
    snapshot_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_snapshots_project ON project_snapshots(project_id);

-- 21. PROJECT ROLES TABLE
CREATE TABLE IF NOT EXISTS project_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    permissions JSONB DEFAULT '{"view": true, "edit": true, "canon": true, "immutable_override": false, "ai": true, "admin": false}'::jsonb,
    is_custom BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_project_roles_project ON project_roles(project_id);

-- 22. SENSITIVE APPROVALS TABLE
CREATE TABLE IF NOT EXISTS sensitive_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requester_id UUID,
    action_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    decision_notes TEXT,
    decided_by_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_sensitive_approvals_project ON sensitive_approvals(project_id, status);

-- 23. ENTITY MATCHING CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS entity_matching_candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    chapter_id UUID,
    chapter_number INTEGER,
    extracted_name VARCHAR(255) NOT NULL,
    extracted_type VARCHAR(50) NOT NULL,
    candidate_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
    similarity_score NUMERIC(4, 2) DEFAULT 0.85,
    context_quote TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    decision_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_entity_matching_project ON entity_matching_candidates(project_id, status);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR SUPABASE / POSTGRESQL
-- ==============================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE passages ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuity_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE canvas_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE narrative_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_attachment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensitive_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_matching_candidates ENABLE ROW LEVEL SECURITY;

-- Project Access Policy (Owner or Member)
CREATE POLICY "Users can access their own or shared projects"
ON projects FOR ALL
USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid()) OR
    is_demo = TRUE
)
WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM project_members WHERE project_members.project_id = projects.id AND project_members.user_id = auth.uid() AND role IN ('owner', 'editor'))
);
