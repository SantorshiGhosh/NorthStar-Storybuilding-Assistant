"""
Production V2 Pydantic Schemas
Strictly typed data transfer objects for V2 endpoints.
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class EvidenceStatusEnum(str, Enum):
    EXACT_VERIFIED = "EXACT_VERIFIED"
    NORMALIZED_VERIFIED = "NORMALIZED_VERIFIED"
    CANDIDATE_MATCH = "CANDIDATE_MATCH"
    SOURCE_VERSION_MISMATCH = "SOURCE_VERSION_MISMATCH"
    UNVERIFIED = "UNVERIFIED"


class VerifyQuoteRequest(BaseModel):
    project_id: str
    quote: str
    chapter_id: Optional[str] = None
    version_number: Optional[int] = None


class VerifyQuoteResponse(BaseModel):
    status: EvidenceStatusEnum
    confidence: float
    matched_text: Optional[str] = None
    chapter_id: Optional[str] = None
    chapter_number: Optional[int] = None
    start_char: Optional[int] = None
    end_char: Optional[int] = None
    version_number: Optional[int] = None
    explanation: str


class ManuscriptVersionOut(BaseModel):
    version_number: int
    manuscript_id: str
    filename: str
    is_active: bool
    created_at: str
    chapter_count: int
    word_count: int
    fact_count: int
    change_summary: Optional[str] = None


class VersionRollbackRequest(BaseModel):
    reason: Optional[str] = "Manual author rollback"


class VersionRollbackResponse(BaseModel):
    status: str
    active_version_number: int
    message: str


class ChapterDiffOut(BaseModel):
    chapter_number: int
    title: str
    status: str  # "identical", "modified", "added", "removed"
    old_word_count: int
    new_word_count: int
    diff_summary: Optional[str] = None


class VersionCompareResponse(BaseModel):
    base_version: int
    target_version: int
    chapter_diffs: List[ChapterDiffOut]
    added_entities: List[str]
    removed_entities: List[str]
    word_count_delta: int


class DurableJobOut(BaseModel):
    job_id: str
    project_id: str
    manuscript_id: Optional[str] = None
    status: str
    current_stage: str
    progress_percent: float
    stages_completed: List[str]
    error: Optional[str] = None
    created_at: str
    updated_at: str
    stage_durations: Dict[str, float] = {}


class JobRetryResponse(BaseModel):
    job_id: str
    status: str
    resumed_from_stage: str
    message: str


class CanonReviewItem(BaseModel):
    fact_id: str
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    claim: str
    source_quote: Optional[str] = None
    chapter_number: Optional[int] = None
    canon_tier: str
    uncertainty_level: str
    status: str  # "pending_review", "author_confirmed", "rejected"


class CanonReviewRequest(BaseModel):
    fact_id: str
    action: str  # "confirm", "reject", "update"
    corrected_claim: Optional[str] = None


class CanonReviewResponse(BaseModel):
    fact_id: str
    updated_tier: str
    is_negated: bool
    message: str


class SystemHealthV2Out(BaseModel):
    status: str
    operational_mode: str
    database: Dict[str, Any]
    vector_store: Dict[str, Any]
    encryption_vault: Dict[str, Any]
    ai_service: Dict[str, Any]
    timestamp: str
