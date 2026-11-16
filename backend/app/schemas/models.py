from pydantic import BaseModel, Field, field_serializer
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

# Helper type for IDs that can be UUID or string
IdType = Union[str, UUID]

# --- Users & Authentication ---
class UserRegister(BaseModel):
    email: str = Field(..., example="author@storybible.ai")
    password: str = Field(..., min_length=6, example="SecretPassword123")
    confirm_password: Optional[str] = Field(None, min_length=6)
    full_name: Optional[str] = Field(None, example="Author Name")

class UserLogin(BaseModel):
    email: str = Field(..., example="author@storybible.ai")
    password: str = Field(..., example="SecretPassword123")

class FirebaseLoginRequest(BaseModel):
    id_token: str
    email: Optional[str] = None
    full_name: Optional[str] = None

class UserOut(BaseModel):
    id: IdType
    email: str
    full_name: Optional[str] = None
    is_active: bool = True
    is_superuser: bool = False
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True

class AuthResponse(BaseModel):
    user: UserOut
    token: str
    token_type: str = "bearer"
    message: Optional[str] = None

class ProjectMemberOut(BaseModel):
    id: IdType
    project_id: IdType
    user_id: IdType
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    role: str = "editor"
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', 'user_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True

# --- Projects ---
class ProjectCreate(BaseModel):
    name: str = Field(..., example="The Last Kingdom")
    description: Optional[str] = Field(None, example="High fantasy epic about Eldoria")
    user_id: Optional[str] = None
    is_demo: Optional[bool] = False

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_demo: Optional[bool] = None

class ProjectOut(BaseModel):
    id: IdType
    user_id: Optional[IdType] = None
    name: str
    description: Optional[str] = None
    is_demo: bool = False
    role: str = "owner"
    chapter_count: int = 0
    character_count: int = 0
    unresolved_issues_count: int = 0
    manuscript_title: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @field_serializer('id', 'user_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True

# --- Chapters ---
class ChapterCreate(BaseModel):
    chapter_number: int
    title: str
    content: str

class ChapterUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class ChapterOut(BaseModel):
    id: IdType
    project_id: IdType
    manuscript_id: Optional[IdType] = None
    chapter_number: int
    title: str
    content: str
    word_count: int
    created_at: datetime
    updated_at: datetime

    @field_serializer('id', 'project_id', 'manuscript_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True

# --- Entity Categories ---
class EntityCategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    icon: Optional[str] = "Box"
    color: Optional[str] = "#3B82F6"
    is_default: Optional[bool] = False
    default_properties: Optional[List[Dict[str, Any]]] = []

class EntityCategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    default_properties: Optional[List[Dict[str, Any]]] = None

class EntityCategoryOut(BaseModel):
    id: IdType
    project_id: IdType
    name: str
    slug: str
    icon: str = "Box"
    color: str = "#3B82F6"
    is_default: bool = False
    default_properties: List[Dict[str, Any]] = []
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Entities ---
class EntityCreate(BaseModel):
    name: str
    entity_type: str = "character"  # character, location, object, rule, faction, family, plot, organization, etc.
    category_id: Optional[IdType] = None
    description: Optional[str] = None
    traits: List[str] = []
    first_appearance_chapter: Optional[int] = 1
    canon_status: Optional[str] = "established"  # draft, planned, established, retired
    protection_level: Optional[int] = 1  # 1: unlocked, 2: protected, 3: locked, 4: immutable
    provenance: Optional[str] = "manual"
    custom_properties: Optional[Dict[str, Any]] = {}

class EntityUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None
    category_id: Optional[IdType] = None
    description: Optional[str] = None
    traits: Optional[List[str]] = None
    first_appearance_chapter: Optional[int] = None
    canon_status: Optional[str] = None
    protection_level: Optional[int] = None
    provenance: Optional[str] = None
    custom_properties: Optional[Dict[str, Any]] = None
    is_archived: Optional[bool] = None

class StoryFactOut(BaseModel):
    id: IdType
    fact: str
    category: Optional[str] = "general"
    fact_category: Optional[str] = "general"
    source_chapter_id: Optional[IdType] = None
    source_chapter_number: Optional[int] = None
    source_quote: str = ""
    confidence: float = 1.0
    is_active: bool = True
    canon_status: Optional[str] = "established"
    protection_level: Optional[int] = 1
    provenance: Optional[str] = "manuscript_extracted"
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'source_chapter_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

class EntityOut(BaseModel):
    id: IdType
    project_id: IdType
    category_id: Optional[IdType] = None
    name: str
    entity_type: str = "character"
    description: Optional[str] = None
    traits: List[str] = []
    first_appearance_chapter: Optional[int] = 1
    first_appearance_chapter_id: Optional[IdType] = None
    canon_status: str = "established"
    protection_level: int = 1
    provenance: str = "manual"
    custom_properties: Dict[str, Any] = {}
    is_archived: bool = False
    facts: List[StoryFactOut] = []
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', 'category_id', 'first_appearance_chapter_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Relationships ---
class RelationshipCreate(BaseModel):
    source_entity_id: IdType
    target_entity_id: IdType
    relation_type: str
    description: Optional[str] = None
    source_chapter_id: Optional[IdType] = None
    source_quote: Optional[str] = None
    direction: Optional[str] = "directed"
    custom_properties: Optional[Dict[str, Any]] = {}
    provenance: Optional[str] = "manual"
    protection_level: Optional[int] = 1

class RelationshipUpdate(BaseModel):
    relation_type: Optional[str] = None
    description: Optional[str] = None
    source_quote: Optional[str] = None
    direction: Optional[str] = None
    custom_properties: Optional[Dict[str, Any]] = None
    protection_level: Optional[int] = None

class RelationshipOut(BaseModel):
    id: IdType
    project_id: IdType
    source_entity_id: IdType
    target_entity_id: IdType
    source_name: Optional[str] = None
    target_name: Optional[str] = None
    relation_type: str
    description: Optional[str] = None
    source_chapter_id: Optional[IdType] = None
    source_quote: Optional[str] = None
    direction: str = "directed"
    custom_properties: Dict[str, Any] = {}
    provenance: str = "manual"
    protection_level: int = 1
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', 'source_entity_id', 'target_entity_id', 'source_chapter_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Canvases ---
class CanvasCreate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    view_type: Optional[str] = "relationship"  # relationship, family_tree, plot, timeline
    layout_type: Optional[str] = "manual"
    settings: Optional[Dict[str, Any]] = {}
    is_default: Optional[bool] = False

class CanvasUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    view_type: Optional[str] = None
    layout_type: Optional[str] = None
    viewport: Optional[Dict[str, Any]] = None
    settings: Optional[Dict[str, Any]] = None
    is_default: Optional[bool] = None

class CanvasNodeUpdate(BaseModel):
    entity_id: IdType
    x: float
    y: float
    width: Optional[float] = 220.0
    height: Optional[float] = 120.0
    visual_override: Optional[Dict[str, Any]] = None

class CanvasOut(BaseModel):
    id: IdType
    project_id: IdType
    name: str
    title: Optional[str] = None
    description: Optional[str] = None
    view_type: str = "relationship"
    layout_type: str = "manual"
    viewport: Dict[str, Any] = {"x": 0, "y": 0, "zoom": 1}
    settings: Dict[str, Any] = {}
    is_default: bool = False
    nodes_count: Optional[int] = 0
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    @field_serializer('title', check_fields=False)
    def serialize_title(self, v: Any, _info):
        return v or self.name

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Narrative Groups ---
class NarrativeGroupCreate(BaseModel):
    name: str
    parent_group_id: Optional[IdType] = None
    group_type: Optional[str] = "general"
    description: Optional[str] = None
    color: Optional[str] = "#6B7280"

class NarrativeGroupUpdate(BaseModel):
    name: Optional[str] = None
    parent_group_id: Optional[IdType] = None
    group_type: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None

class NarrativeGroupOut(BaseModel):
    id: IdType
    project_id: IdType
    parent_group_id: Optional[IdType] = None
    name: str
    group_type: str = "general"
    description: Optional[str] = None
    color: str = "#6B7280"
    members_count: Optional[int] = 0
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', 'parent_group_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Attachments ---
class EntityAttachmentCreate(BaseModel):
    filename: Optional[str] = None
    title: Optional[str] = None
    file_type: Optional[str] = "image"
    attachment_type: Optional[str] = None
    url: Optional[str] = None
    file_url: Optional[str] = None
    description: Optional[str] = None
    entity_id: Optional[IdType] = None
    entity_ids: Optional[List[IdType]] = []
    tags: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = None

    class Config:
        extra = "ignore"

class EntityAttachmentOut(BaseModel):
    id: IdType
    project_id: IdType
    filename: str
    file_type: str = "image"
    file_size: int = 0
    storage_path: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = []
    metadata: Optional[Dict[str, Any]] = None
    linked_entities: Optional[List[Dict[str, Any]]] = []
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Audit Logs ---
class AuditLogOut(BaseModel):
    id: IdType
    project_id: IdType
    actor_id: Optional[IdType] = None
    actor_name: str = "Author"
    action: str
    target_type: str
    target_id: Optional[IdType] = None
    target_name: Optional[str] = None
    previous_value: Optional[Any] = None
    new_value: Optional[Any] = None
    source: str = "manual"
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', 'actor_id', 'target_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Project Snapshots ---
class ProjectSnapshotCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_milestone: Optional[bool] = False

class ProjectSnapshotOut(BaseModel):
    id: IdType
    project_id: IdType
    name: str
    description: Optional[str] = None
    is_milestone: bool = False
    entities_count: Optional[int] = 0
    relationships_count: Optional[int] = 0
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Entity Matching ---
class EntityMatchingCandidateOut(BaseModel):
    id: IdType
    project_id: IdType
    chapter_id: Optional[IdType] = None
    chapter_number: Optional[int] = None
    extracted_name: str
    extracted_type: str
    candidate_entity_id: Optional[IdType] = None
    candidate_entity_name: Optional[str] = None
    similarity_score: float = 0.85
    context_quote: Optional[str] = None
    status: str = "pending"  # pending, merged, kept_separate, linked, dismissed
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', 'chapter_id', 'candidate_entity_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

class EntityMatchingDecision(BaseModel):
    decision: str  # merge, keep_separate, link, dismiss
    target_entity_id: Optional[IdType] = None
    notes: Optional[str] = None

# --- Graph ---
class GraphNode(BaseModel):
    id: str
    type: str = "custom"
    data: Dict[str, Any]
    position: Dict[str, float]

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    label: str
    animated: bool = False
    data: Optional[Dict[str, Any]] = None

class GraphDataOut(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

# --- Continuity Issues ---
class ContinuityIssueUpdate(BaseModel):
    status: str  # open, unresolved, resolved, intentional, dismissed, review_later
    author_notes: Optional[str] = None

class ContinuityIssueOut(BaseModel):
    id: IdType
    project_id: IdType
    chapter_id: Optional[IdType] = None
    issue_type: str = "continuity_issue"
    classification: Optional[str] = "likely_conflict"
    severity: str = "high"
    confidence: float = 0.88
    explanation: str = ""
    evidence: List[Dict[str, Any]] = []
    earlier_passage: Optional[str] = None
    new_passage: Optional[str] = None
    earlier_chapter_number: Optional[int] = None
    new_chapter_number: Optional[int] = None
    suggestions: List[str] = []
    status: str = "unresolved"
    author_notes: Optional[str] = None
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', 'chapter_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Timeline ---
class TimelineEventOut(BaseModel):
    id: IdType
    project_id: IdType
    title: str
    description: Optional[str] = None
    chapter_number: Optional[int] = None
    chronology_order: int = 0
    date_or_time_label: Optional[str] = None
    participants: List[str] = []
    location: Optional[str] = None
    canon_status: Optional[str] = "established"
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Analysis ---
class AnalyzeChapterRequest(BaseModel):
    chapter_id: Optional[str] = None
    content: Optional[str] = None
    chapter_number: Optional[int] = None

    class Config:
        extra = "ignore"

class AnalyzeChapterResponse(BaseModel):
    status: str = "analyzed"
    chapter_id: Optional[IdType] = None
    chapter_number: int = 1
    issues_found: int = 0
    new_issues_count: Optional[int] = 0
    issues: List[Any] = []
    entities_extracted: int = 0

    @field_serializer('chapter_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Bundle ---
class ProjectBundleOut(BaseModel):
    project: Optional[Any] = None
    chapters: List[Any] = []
    issues: List[Any] = []
    entities_count: int = 0

    class Config:
        from_attributes = True
        extra = "ignore"

# --- Help & Support ---
class ContactSupportCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255, example="Jane Author")
    email: str = Field(..., min_length=5, max_length=255, example="jane@example.com")
    subject: str = Field(..., min_length=3, max_length=255, example="Continuity Analysis Question")
    category: Optional[str] = Field(default="General Inquiry", max_length=100, example="Technical Issue")
    description: Optional[str] = Field(default=None, max_length=5000, example="Detailed description of problem...")
    message: Optional[str] = Field(default=None, max_length=5000, example="Hello NorthStar support team...")

    class Config:
        extra = "ignore"

class SupportQueryOut(BaseModel):
    id: IdType
    user_id: Optional[IdType] = None
    full_name: str
    email: str
    subject: str
    category: str = "General Inquiry"
    description: str
    status: str = "Pending"
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'user_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

class SupportMessageOut(BaseModel):
    id: IdType
    user_id: Optional[IdType] = None
    full_name: str
    email: str
    subject: str
    message: str
    status: str = "delivered"
    delivery_status: str = "stored_in_support_inbox"
    created_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'user_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True
        extra = "ignore"

class ContactSupportResponse(BaseModel):
    status: str
    message: str
    ticket_id: str
    delivery_status: str = "stored_in_support_inbox"
    category: Optional[str] = None
