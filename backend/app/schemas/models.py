from pydantic import BaseModel, Field, field_serializer
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from datetime import datetime

# Helper type for IDs that can be UUID or string
IdType = Union[str, UUID]

# --- Projects ---
class ProjectCreate(BaseModel):
    name: str = Field(..., example="The Last Kingdom")
    description: Optional[str] = Field(None, example="High fantasy epic about Eldoria")
    user_id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectOut(BaseModel):
    id: IdType
    user_id: Optional[IdType] = None
    name: str
    description: Optional[str] = None
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

# --- Entities ---
class EntityCreate(BaseModel):
    name: str
    entity_type: str = "character"  # character, location, object, rule, faction
    description: Optional[str] = None
    traits: List[str] = []
    first_appearance_chapter: Optional[int] = 1

class EntityUpdate(BaseModel):
    name: Optional[str] = None
    entity_type: Optional[str] = None
    description: Optional[str] = None
    traits: Optional[List[str]] = None
    first_appearance_chapter: Optional[int] = None

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
    name: str
    entity_type: str = "character"
    description: Optional[str] = None
    traits: List[str] = []
    first_appearance_chapter: Optional[int] = 1
    first_appearance_chapter_id: Optional[IdType] = None
    facts: List[StoryFactOut] = []
    created_at: Optional[Union[datetime, str]] = None
    updated_at: Optional[Union[datetime, str]] = None

    @field_serializer('id', 'project_id', 'first_appearance_chapter_id', check_fields=False)
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

class RelationshipUpdate(BaseModel):
    relation_type: Optional[str] = None
    description: Optional[str] = None
    source_quote: Optional[str] = None

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
    created_at: datetime

    @field_serializer('id', 'project_id', 'source_entity_id', 'target_entity_id', 'source_chapter_id', check_fields=False)
    def serialize_id(self, v: Any, _info):
        return str(v) if v is not None else None

    class Config:
        from_attributes = True

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
    classification: Optional[str] = "likely_conflict"  # likely_conflict, possible_conflict, intentional_or_explainable, insufficient_evidence
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

