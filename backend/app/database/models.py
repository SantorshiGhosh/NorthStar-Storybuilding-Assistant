import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, Float, Boolean, DateTime, ForeignKey, JSON, Uuid, Numeric
from sqlalchemy.orm import relationship
from app.database.connection import Base

def gen_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.user_id", cascade="all, delete-orphan")
    memberships = relationship("ProjectMember", back_populates="user", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="editor")  # owner, editor, viewer
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="owned_projects", foreign_keys=[user_id])
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    manuscripts = relationship("Manuscript", back_populates="project", cascade="all, delete-orphan")
    chapters = relationship("Chapter", back_populates="project", cascade="all, delete-orphan")
    entities = relationship("Entity", back_populates="project", cascade="all, delete-orphan")
    relationships = relationship("Relationship", back_populates="project", cascade="all, delete-orphan")
    story_facts = relationship("StoryFact", back_populates="project", cascade="all, delete-orphan")
    timeline_events = relationship("TimelineEvent", back_populates="project", cascade="all, delete-orphan")
    continuity_issues = relationship("ContinuityIssue", back_populates="project", cascade="all, delete-orphan")
    canvases = relationship("Canvas", back_populates="project", cascade="all, delete-orphan")
    groups = relationship("NarrativeGroup", back_populates="project", cascade="all, delete-orphan")
    categories = relationship("EntityCategory", back_populates="project", cascade="all, delete-orphan")
    attachments = relationship("EntityAttachment", back_populates="project", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="project", cascade="all, delete-orphan")
    snapshots = relationship("ProjectSnapshot", back_populates="project", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="project", cascade="all, delete-orphan")
    entity_aliases = relationship("EntityAlias", back_populates="project", cascade="all, delete-orphan")
    character_states = relationship("CharacterState", back_populates="project", cascade="all, delete-orphan")
    object_custody_events = relationship("ObjectCustodyEvent", back_populates="project", cascade="all, delete-orphan")
    entity_mentions = relationship("EntityMention", back_populates="project", cascade="all, delete-orphan")


class Manuscript(Base):
    __tablename__ = "manuscripts"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # docx, txt, md, pdf
    file_size = Column(Integer, default=0)
    storage_path = Column(Text, nullable=True)
    encrypted = Column(Boolean, default=True)
    is_encrypted = Column(Boolean, default=True)
    status = Column(String(50), default="processed")  # uploaded, processing, processed, error
    version_number = Column(Integer, default=1)
    is_active_version = Column(Boolean, default=True)
    superseded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="manuscripts")
    chapters = relationship("Chapter", back_populates="manuscript")


class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    manuscript_id = Column(Uuid(as_uuid=False), ForeignKey("manuscripts.id", ondelete="SET NULL"), nullable=True)
    chapter_number = Column(Integer, nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="chapters")
    manuscript = relationship("Manuscript", back_populates="chapters")
    passages = relationship("Passage", back_populates="chapter", cascade="all, delete-orphan")
    issues = relationship("ContinuityIssue", back_populates="chapter", cascade="all, delete-orphan")


class Passage(Base):
    __tablename__ = "passages"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(Uuid(as_uuid=False), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=False)
    passage_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    char_start = Column(Integer, default=0)
    char_end = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    chapter = relationship("Chapter", back_populates="passages")


class EntityCategory(Base):
    __tablename__ = "entity_categories"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False)
    icon = Column(String(50), default="Box")
    color = Column(String(50), default="#3B82F6")
    is_default = Column(Boolean, default=False)
    default_properties = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="categories")
    entities = relationship("Entity", back_populates="category")


class Entity(Base):
    __tablename__ = "entities"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    category_id = Column(Uuid(as_uuid=False), ForeignKey("entity_categories.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    entity_type = Column(String(50), nullable=False)  # character, location, object, rule, event, faction, family, plot, organization, etc.
    description = Column(Text, nullable=True)
    traits = Column(JSON, default=list)  # list of strings
    first_appearance_chapter = Column(Integer, default=1)
    first_appearance_chapter_id = Column(Uuid(as_uuid=False), ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    meta_info = Column("metadata", JSON, default=dict)
    
    # Story Architect & Canon Management Extensions
    canon_status = Column(String(50), default="established")  # draft, planned, established, retired
    protection_level = Column(Integer, default=1)  # 1: unlocked, 2: protected, 3: locked, 4: immutable
    provenance = Column(String(50), default="manual")  # manual, manuscript_extracted, ai_suggested, imported
    custom_properties = Column(JSON, default=dict)
    is_archived = Column(Boolean, default=False)
    
    # Narrative Relevance & Accuracy Extensions
    salience_score = Column(Float, default=0.5)
    relevance_status = Column(String(50), default="accepted")  # accepted, rejected, needs_review, temporary_mention
    narrative_role = Column(String(50), nullable=True)  # protagonist, antagonist, supporting, minor, incidental, prop, mystery_object
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="entities")
    category = relationship("EntityCategory", back_populates="entities")
    facts = relationship("StoryFact", back_populates="entity", cascade="all, delete-orphan", foreign_keys="StoryFact.entity_id")
    canvas_nodes = relationship("CanvasNode", back_populates="entity", cascade="all, delete-orphan")
    attachment_links = relationship("EntityAttachmentLink", back_populates="entity", cascade="all, delete-orphan")
    aliases = relationship("EntityAlias", back_populates="canonical_entity", cascade="all, delete-orphan")
    character_states = relationship("CharacterState", back_populates="entity", cascade="all, delete-orphan")
    mentions = relationship("EntityMention", back_populates="resolved_entity", cascade="all, delete-orphan")


class Relationship(Base):
    __tablename__ = "relationships"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    source_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    target_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    relation_type = Column(String(100), nullable=False)  # father_of, allied_with, located_in, opposes, member_of, married_to, etc.
    description = Column(Text, nullable=True)
    source_chapter_id = Column(Uuid(as_uuid=False), nullable=True)
    source_quote = Column(Text, nullable=True)
    direction = Column(String(50), default="directed")  # directed, undirected, bidirectional
    custom_properties = Column(JSON, default=dict)
    provenance = Column(String(50), default="manual")
    protection_level = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="relationships")
    source_entity = relationship("Entity", foreign_keys=[source_entity_id])
    target_entity = relationship("Entity", foreign_keys=[target_entity_id])


class StoryFact(Base):
    __tablename__ = "story_facts"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=True)
    fact = Column(Text, nullable=False)
    category = Column(String(50), default="general")  # physical_state, lore_rule, location, status, event
    fact_category = Column(String(50), default="general")  # status, physical, location, date, rule
    source_chapter_id = Column(Uuid(as_uuid=False), nullable=True)
    source_chapter_number = Column(Integer, nullable=True)
    source_quote = Column(Text, nullable=False)
    confidence = Column(Float, default=1.0)
    is_active = Column(Boolean, default=True)
    canon_status = Column(String(50), default="established")  # draft, planned, established, retired
    protection_level = Column(Integer, default=1)  # 1: unlocked, 2: protected, 3: locked, 4: immutable
    provenance = Column(String(50), default="manuscript_extracted")
    valid_from_chapter = Column(Integer, default=1)
    valid_until_chapter = Column(Integer, nullable=True)
    canon_tier = Column(String(50), default="established")  # established, belief, rumour, unverified, proposed, rejected, superseded
    is_negated = Column(Boolean, default=False)
    uncertainty_level = Column(String(50), default="none")  # none, hypothetical, belief, rumour, question
    subject_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="SET NULL"), nullable=True)
    object_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="story_facts")
    entity = relationship("Entity", back_populates="facts", foreign_keys=[entity_id])


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    chapter_id = Column(Uuid(as_uuid=False), nullable=True)
    chapter_number = Column(Integer, nullable=True)
    chronology_order = Column(Integer, default=0)
    date_or_time_label = Column(String(100), nullable=True)
    participants = Column(JSON, default=list)
    location = Column(String(255), nullable=True)
    canon_status = Column(String(50), default="established")
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="timeline_events")


class ContinuityIssue(Base):
    __tablename__ = "continuity_issues"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(Uuid(as_uuid=False), ForeignKey("chapters.id", ondelete="CASCADE"), nullable=True)
    issue_type = Column(String(100), nullable=False)
    classification = Column(String(50), default="likely_conflict")
    severity = Column(String(50), default="high")
    confidence = Column(Float, default=0.90)
    explanation = Column(Text, nullable=False)
    evidence = Column(JSON, default=list)
    earlier_passage = Column(Text, nullable=True)
    new_passage = Column(Text, nullable=True)
    earlier_chapter_number = Column(Integer, nullable=True)
    new_chapter_number = Column(Integer, nullable=True)
    suggestions = Column(JSON, default=list)
    status = Column(String(50), default="unresolved")
    author_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="continuity_issues")
    chapter = relationship("Chapter", back_populates="issues")


class Canvas(Base):
    __tablename__ = "canvases"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    view_type = Column(String(50), default="relationship")  # relationship, family_tree, plot, timeline
    layout_type = Column(String(50), default="manual")  # manual, force_directed, hierarchical, circular, grid, family_tree
    viewport = Column(JSON, default=lambda: {"x": 0, "y": 0, "zoom": 1})
    settings = Column(JSON, default=dict)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="canvases")
    nodes = relationship("CanvasNode", back_populates="canvas", cascade="all, delete-orphan")


class CanvasNode(Base):
    __tablename__ = "canvas_nodes"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    canvas_id = Column(Uuid(as_uuid=False), ForeignKey("canvases.id", ondelete="CASCADE"), nullable=False)
    entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    x = Column(Float, default=0.0)
    y = Column(Float, default=0.0)
    width = Column(Float, default=220.0)
    height = Column(Float, default=120.0)
    visual_override = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    canvas = relationship("Canvas", back_populates="nodes")
    entity = relationship("Entity", back_populates="canvas_nodes")


class NarrativeGroup(Base):
    __tablename__ = "narrative_groups"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    parent_group_id = Column(Uuid(as_uuid=False), ForeignKey("narrative_groups.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    group_type = Column(String(100), default="general")  # universe, world, kingdom, faction, family
    description = Column(Text, nullable=True)
    color = Column(String(50), default="#6B7280")
    metadata_info = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="groups")
    memberships = relationship("GroupMembership", back_populates="group", cascade="all, delete-orphan")


class GroupMembership(Base):
    __tablename__ = "group_memberships"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    group_id = Column(Uuid(as_uuid=False), ForeignKey("narrative_groups.id", ondelete="CASCADE"), nullable=False)
    entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=True)
    canvas_id = Column(Uuid(as_uuid=False), ForeignKey("canvases.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    group = relationship("NarrativeGroup", back_populates="memberships")


class EntityAttachment(Base):
    __tablename__ = "entity_attachments"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False)  # image, pdf, docx, txt, audio, video, link
    file_size = Column(Integer, default=0)
    storage_path = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    meta_info = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="attachments")
    links = relationship("EntityAttachmentLink", back_populates="attachment", cascade="all, delete-orphan")


class EntityAttachmentLink(Base):
    __tablename__ = "entity_attachment_links"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    attachment_id = Column(Uuid(as_uuid=False), ForeignKey("entity_attachments.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), default="reference")  # portrait, map, document, reference, moodboard
    created_at = Column(DateTime, default=datetime.utcnow)

    entity = relationship("Entity", back_populates="attachment_links")
    attachment = relationship("EntityAttachment", back_populates="links")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(Uuid(as_uuid=False), nullable=True)
    actor_name = Column(String(255), default="Author")
    action = Column(String(100), nullable=False)  # create_entity, update_canon, change_protection, override_immutable, create_snapshot, restore_snapshot
    target_type = Column(String(100), nullable=False)  # entity, relationship, fact, canvas, group, snapshot
    target_id = Column(Uuid(as_uuid=False), nullable=True)
    target_name = Column(String(255), nullable=True)
    previous_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    source = Column(String(50), default="manual")  # manual, ai_guardian, import, restore
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="audit_logs")


class ProjectSnapshot(Base):
    __tablename__ = "project_snapshots"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_milestone = Column(Boolean, default=False)
    snapshot_data = Column(JSON, nullable=False)  # serialized project entities, relations, facts, canvases
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="snapshots")


class ProjectRole(Base):
    __tablename__ = "project_roles"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    permissions = Column(JSON, default=lambda: {
        "view": True,
        "edit": True,
        "canon": True,
        "immutable_override": False,
        "ai": True,
        "admin": False
    })
    is_custom = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SensitiveApproval(Base):
    __tablename__ = "sensitive_approvals"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    requester_id = Column(Uuid(as_uuid=False), nullable=True)
    action_type = Column(String(100), nullable=False)  # grant_admin, override_immutable, delete_universe
    payload = Column(JSON, nullable=False)
    status = Column(String(50), default="pending")  # pending, approved, rejected
    decision_notes = Column(Text, nullable=True)
    decided_by_id = Column(Uuid(as_uuid=False), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)


class EntityMatchingCandidate(Base):
    __tablename__ = "entity_matching_candidates"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    chapter_id = Column(Uuid(as_uuid=False), nullable=True)
    chapter_number = Column(Integer, nullable=True)
    extracted_name = Column(String(255), nullable=False)
    extracted_type = Column(String(50), nullable=False)
    candidate_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=True)
    similarity_score = Column(Float, default=0.85)
    context_quote = Column(Text, nullable=True)
    status = Column(String(50), default="pending")  # pending, merged, kept_separate, linked, dismissed
    decision_history = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


class SupportMessage(Base):
    __tablename__ = "support_messages"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    status = Column(String(50), default="delivered")  # delivered, pending, resolved
    delivery_status = Column(String(100), default="stored_in_support_inbox")  # delivered_via_smtp, stored_in_support_inbox
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


class SupportQuery(Base):
    __tablename__ = "support_queries"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    user_id = Column(Uuid(as_uuid=False), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default="General Inquiry")
    description = Column(Text, nullable=False)
    status = Column(String(50), default="Pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id])


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    manuscript_id = Column(Uuid(as_uuid=False), ForeignKey("manuscripts.id", ondelete="SET NULL"), nullable=True)
    stage = Column(String(50), default="queued")  # queued, validating, extracting, segmenting, extracting_entities, resolving_identities, building_memory, indexing_passages, running_continuity, enriching, completed, failed
    status = Column(String(50), default="pending")  # pending, processing, completed, completed_with_warnings, failed, cancelled
    progress = Column(Integer, default=0)  # 0 to 100
    message = Column(Text, nullable=True)
    error_details = Column(Text, nullable=True)
    meta_info = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="processing_jobs")
    manuscript = relationship("Manuscript")


class EntityAlias(Base):
    __tablename__ = "entity_aliases"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    canonical_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    alias_name = Column(String(255), nullable=False, index=True)
    alias_type = Column(String(50), default="nickname")  # full_name, nickname, title, former_name, disguise, typo
    confidence = Column(Float, default=1.0)
    source_quote = Column(Text, nullable=True)
    is_author_confirmed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="entity_aliases")
    canonical_entity = relationship("Entity", back_populates="aliases", foreign_keys=[canonical_entity_id])


class CharacterState(Base):
    __tablename__ = "character_states"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    category = Column(String(50), default="physical")  # physical, status, allegiance, identity, mental
    state_description = Column(Text, nullable=False)
    valid_from_chapter = Column(Integer, default=1)
    valid_until_chapter = Column(Integer, nullable=True)  # None = currently valid
    source_chapter_id = Column(Uuid(as_uuid=False), ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    source_quote = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="character_states")
    entity = relationship("Entity", back_populates="character_states", foreign_keys=[entity_id])


class ObjectCustodyEvent(Base):
    __tablename__ = "object_custody_events"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    object_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    holder_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="SET NULL"), nullable=True, index=True)
    previous_holder_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="SET NULL"), nullable=True)
    transfer_type = Column(String(50), default="transfer")  # initial_possession, transfer, theft, loss, discovery, destruction, creation
    chapter_number = Column(Integer, default=1)
    chapter_id = Column(Uuid(as_uuid=False), ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True)
    source_quote = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="object_custody_events")
    object_entity = relationship("Entity", foreign_keys=[object_entity_id])
    holder_entity = relationship("Entity", foreign_keys=[holder_entity_id])


class EntityMention(Base):
    __tablename__ = "entity_mentions"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(Uuid(as_uuid=False), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    manuscript_id = Column(Uuid(as_uuid=False), ForeignKey("manuscripts.id", ondelete="SET NULL"), nullable=True, index=True)
    chapter_id = Column(Uuid(as_uuid=False), ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True, index=True)
    passage_id = Column(Uuid(as_uuid=False), ForeignKey("passages.id", ondelete="SET NULL"), nullable=True, index=True)
    resolved_entity_id = Column(Uuid(as_uuid=False), ForeignKey("entities.id", ondelete="SET NULL"), nullable=True, index=True)
    
    chapter_number = Column(Integer, default=1)
    version_number = Column(Integer, default=1)
    
    text_span = Column(String(255), nullable=False)
    mention_type = Column(String(50), default="proper_name")  # proper_name, pronoun, descriptive_ref, incidental_noun
    char_start = Column(Integer, default=0)
    char_end = Column(Integer, default=0)
    grammatical_role = Column(String(50), nullable=True)  # subject, direct_object, indirect_object, prepositional, possessive
    context_sentence = Column(Text, nullable=True)
    
    confidence = Column(Float, default=1.0)
    resolution_status = Column(String(50), default="unresolved")  # resolved, ambiguous, unresolved, rejected
    is_ambiguous = Column(Boolean, default=False)
    candidate_entity_ids = Column(JSON, default=list)
    rejection_reason = Column(String(255), nullable=True)
    
    meta_info = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="entity_mentions")
    resolved_entity = relationship("Entity", back_populates="mentions", foreign_keys=[resolved_entity_id])

