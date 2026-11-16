"""
Production V2 REST API Router
Strictly additive production routes mounted under /api/v2/production.
"""
import os
import re
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database import models
from app.config import settings
from app.routes.auth import get_optional_user, require_project_access
from app.services.document_parser import document_parser
from app.agents.orchestrator import orchestrator

from app.production_v2.config import v2_settings
from app.production_v2.schemas.v2_schemas import (
    SystemHealthV2Out,
    ManuscriptVersionOut,
    VersionRollbackRequest,
    VersionRollbackResponse,
    VersionCompareResponse,
    DurableJobOut,
    JobRetryResponse,
    VerifyQuoteRequest,
    VerifyQuoteResponse,
    CanonReviewItem,
    CanonReviewRequest,
    CanonReviewResponse,
    EvidenceStatusEnum
)
from app.production_v2.services.vault_key_management import vault_key_manager
from app.production_v2.services.version_repository import version_repository
from app.production_v2.services.strict_evidence_service import strict_evidence_service
from app.production_v2.services.durable_job_service import durable_job_service, ProcessingStage
from app.production_v2.services.canon_review_service import canon_review_service
from app.production_v2.services.hybrid_retrieval_service import hybrid_retrieval_service
from app.production_v2.services.production_health_service import production_health_service
from app.production_v2.services.version_activation_service import version_activation_service
from app.production_v2.pipelines.production_pipeline import production_pipeline_coordinator
from app.production_v2.services.narrative_evaluation_service import narrative_evaluation_service
from app.production_v2.services.graph_admission_service import graph_admission_service
from app.production_v2.services.coreference_resolution_service import coreference_resolution_service
from app.production_v2.services.canonical_entity_registry import canonical_entity_registry
from app.production_v2.services.narrative_relevance_service import narrative_relevance_service
from app.production_v2.services.narrative_integrity_audit_service import narrative_integrity_audit_service
from app.production_v2.services.narrative_extraction_orchestrator import narrative_extraction_orchestrator


router = APIRouter(tags=["Production V2 Narrative Architecture"])


# 1. Health & Architecture Diagnostics
@router.get("/health", response_model=SystemHealthV2Out)
def get_production_system_health(db: Session = Depends(get_db)):
    """Live diagnostic endpoint verifying database, vault, vector store, and AI readiness."""
    return production_health_service.check_system_health(db)


# 2. Manuscript Upload with Non-Destructive Versioning & Durable Ingestion
@router.post("/manuscripts/upload")
async def upload_manuscript_v2(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Production V2 Non-Destructive Ingestion:
    - Validates magic signature
    - Increments manuscript version without deleting historical drafts
    - Encrypts via AES-256-GCM Vault V2 format
    - Tracks granular 14-stage durable job execution
    """
    # Enforce authorization
    require_project_access(project_id, user, db, require_write=True)

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    filename = file.filename or "manuscript.txt"
    file_ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

    # Validate document magic signature
    try:
        document_parser.validate_file_signature(file_bytes, file_ext)
    except Exception as val_err:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Security verification failed: {val_err}"
        )

    # 1. Prepare pending version (keeps prior active version intact and operational)
    safe_filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)
    vault_file_path = os.path.join(
        settings.VAULT_STORAGE_DIRECTORY,
        f"{project_id}_pending_{safe_filename}.vault"
    )
    pending_manuscript, new_version_num = version_activation_service.prepare_pending_version(
        db=db,
        project_id=project_id,
        filename=filename,
        file_type=file_ext,
        vault_path=vault_file_path,
        file_size=len(file_bytes)
    )

    # 2. Create durable processing job
    job = durable_job_service.create_job(
        db=db,
        project_id=project_id,
        manuscript_id=str(pending_manuscript.id),
        job_type="manuscript_narrative_ingestion_v2"
    )

    # 3. Execute 14-stage narrative intelligence coordinator
    try:
        coord_res = production_pipeline_coordinator.execute_pipeline(
            db=db,
            project_id=project_id,
            manuscript_id=str(pending_manuscript.id),
            job_id=str(job.id),
            file_bytes=file_bytes,
            file_ext=file_ext,
            vault_file_path=vault_file_path
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Manuscript ingestion failed: {exc}")

    return {
        "status": "success",
        "project_id": project_id,
        "manuscript_id": str(pending_manuscript.id),
        "version_number": new_version_num,
        "chapters_created": coord_res.get("chapters_count", 0),
        "passages_created": coord_res.get("passages_count", 0),
        "entities_extracted": coord_res.get("entities_count", 0),
        "facts_extracted": coord_res.get("facts_count", 0),
        "issues_detected": coord_res.get("issues_count", 0),
        "job_id": str(job.id),
        "message": f"Manuscript processed and activated atomically as Version {new_version_num}."
    }


# 3. Manuscript Version Lifecycle Endpoints
@router.get("/manuscripts/{manuscript_id}/versions", response_model=List[ManuscriptVersionOut])
def get_manuscript_versions(
    manuscript_id: str,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Lists all historical and active versions for a manuscript."""
    manuscript = db.query(models.Manuscript).filter(models.Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found.")

    require_project_access(str(manuscript.project_id), user, db)
    return version_repository.list_versions(db, str(manuscript.project_id))


@router.post("/manuscripts/{manuscript_id}/rollback/{target_version_number}", response_model=VersionRollbackResponse)
def rollback_manuscript_version(
    manuscript_id: str,
    target_version_number: int,
    payload: VersionRollbackRequest,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Rolls back project to a historical version without data loss."""
    manuscript = db.query(models.Manuscript).filter(models.Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found.")

    require_project_access(str(manuscript.project_id), user, db, require_write=True)
    try:
        return version_repository.rollback_to_version(db, str(manuscript.project_id), target_version_number)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/manuscripts/{manuscript_id}/compare", response_model=VersionCompareResponse)
def compare_manuscript_versions(
    manuscript_id: str,
    base_version: int = Query(..., description="Base version number to compare from"),
    target_version: int = Query(..., description="Target version number to compare to"),
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Computes structured chapter and word-count differences between two manuscript versions."""
    manuscript = db.query(models.Manuscript).filter(models.Manuscript.id == manuscript_id).first()
    if not manuscript:
        raise HTTPException(status_code=404, detail="Manuscript not found.")

    require_project_access(str(manuscript.project_id), user, db)
    try:
        return version_repository.compare_versions(db, str(manuscript.project_id), base_version, target_version)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 4. Durable Job Progress and Resumption Endpoints
@router.get("/jobs/{job_id}", response_model=DurableJobOut)
def get_durable_job_status(
    job_id: str,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Retrieves 14-stage progress and completed stages for a background job with tenant verification."""
    job_record = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
    if not job_record:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    require_project_access(str(job_record.project_id), user, db)
    job = durable_job_service.get_job_status(db, job_id)
    return job


@router.post("/jobs/{job_id}/retry", response_model=JobRetryResponse)
def retry_failed_job(
    job_id: str,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Resumes a failed or stalled processing job from its last completed stage with write authorization."""
    job_record = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
    if not job_record:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    require_project_access(str(job_record.project_id), user, db, require_write=True)
    try:
        return durable_job_service.retry_job(db, job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# 5. Strict Evidence Verification Endpoint
@router.post("/evidence/verify", response_model=VerifyQuoteResponse)
def verify_evidence_quote(
    request: VerifyQuoteRequest,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Certifies citation authenticity with mathematical precision:
    EXACT_VERIFIED, NORMALIZED_VERIFIED, CANDIDATE_MATCH, SOURCE_VERSION_MISMATCH, or UNVERIFIED.
    """
    require_project_access(request.project_id, user, db)
    return strict_evidence_service.verify_quote(
        db=db,
        project_id=request.project_id,
        quote=request.quote,
        preferred_chapter_id=request.chapter_id,
        target_version_number=request.version_number
    )


# 6. Human-in-the-Loop Canon Review Endpoints
@router.get("/canon/{project_id}/pending", response_model=List[CanonReviewItem])
def get_pending_canon_reviews(
    project_id: str,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Lists narrative facts and entity links awaiting author confirmation."""
    require_project_access(project_id, user, db)
    return canon_review_service.list_pending_facts(db, project_id)


@router.post("/canon/review", response_model=CanonReviewResponse)
def submit_canon_review_decision(
    request: CanonReviewRequest,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Author decision: confirm as canon, reject (suppress false alarms), or edit claim."""
    fact = db.query(models.StoryFact).filter(models.StoryFact.id == request.fact_id).first()
    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found.")

    # Strictly verify project write access directly on fact.project_id
    require_project_access(str(fact.project_id), user, db, require_write=True)

    try:
        response = canon_review_service.process_review(
            db=db,
            fact_id=request.fact_id,
            action=request.action,
            corrected_claim=request.corrected_claim
        )
        
        # Add audit log record
        action_str = request.action.lower() if isinstance(request.action, str) else str(request.action).lower()
        audit_entry = models.AuditLog(
            project_id=fact.project_id,
            actor_id=user.id if user else None,
            actor_name=user.full_name if (user and user.full_name) else "Author",
            action=f"canon_review_{action_str}",
            target_type="fact",
            target_id=fact.id,
            target_name=fact.fact[:255] if fact.fact else None,
            previous_value={"old_fact": fact.fact},
            new_value={
                "fact_id": str(fact.id),
                "action": action_str,
                "corrected_claim": request.corrected_claim
            },
            source="manual"
        )
        db.add(audit_entry)
        db.commit()

        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# 7. Enhanced V2 Continuity Report with Exact Evidence Certifications
@router.get("/continuity/{project_id}")
def get_v2_continuity_report(
    project_id: str,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Returns continuity issues enhanced with exact evidence verification status chips.
    Suppresses negated or rejected facts.
    """
    require_project_access(project_id, user, db)

    # Fetch active issues for project
    raw_issues = db.query(models.ContinuityIssue).filter(
        models.ContinuityIssue.project_id == project_id
    ).all()

    enriched_issues = []
    for issue in raw_issues:
        evidence_quote = getattr(issue, "evidence_quote", None) or getattr(issue, "new_passage", None) or getattr(issue, "earlier_passage", None) or ""
        evidence_result = None
        if evidence_quote:
            evidence_result = strict_evidence_service.verify_quote(
                db=db,
                project_id=project_id,
                quote=evidence_quote,
                preferred_chapter_id=str(issue.chapter_id) if issue.chapter_id else None
            )

        suggestions = getattr(issue, "suggestions", [])
        suggested_fix = suggestions[0] if suggestions else getattr(issue, "suggested_fix", "")

        enriched_issues.append({
            "id": str(issue.id),
            "project_id": str(issue.project_id),
            "chapter_id": str(issue.chapter_id) if issue.chapter_id else None,
            "issue_type": issue.issue_type,
            "severity": issue.severity,
            "status": issue.status,
            "description": getattr(issue, "explanation", None) or getattr(issue, "description", ""),
            "evidence_quote": evidence_quote,
            "evidence_status": evidence_result.status.value if evidence_result else EvidenceStatusEnum.UNVERIFIED.value,
            "evidence_confidence": evidence_result.confidence if evidence_result else 0.0,
            "evidence_explanation": evidence_result.explanation if evidence_result else "No citation provided.",
            "suggested_fix": suggested_fix,
            "created_at": issue.created_at.isoformat() if issue.created_at else None
        })

    return {
        "project_id": project_id,
        "total_issues": len(enriched_issues),
        "issues": enriched_issues
    }


# 8. Narrative Intelligence Accuracy Overhaul Endpoints
@router.get("/accuracy/{project_id}/mentions")
def get_project_entity_mentions(
    project_id: str,
    mention_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Lists all entity mentions, pronoun resolutions, and candidate tracking for a project."""
    require_project_access(project_id, user, db)
    query = db.query(models.EntityMention).filter(models.EntityMention.project_id == project_id)
    if mention_type:
        query = query.filter(models.EntityMention.mention_type == mention_type)
    if status:
        query = query.filter(models.EntityMention.resolution_status == status)

    mentions = query.order_by(models.EntityMention.chapter_number.asc(), models.EntityMention.char_start.asc()).all()
    return {
        "project_id": project_id,
        "total_mentions": len(mentions),
        "mentions": [
            {
                "id": str(m.id),
                "text_span": m.text_span,
                "mention_type": m.mention_type,
                "chapter_number": m.chapter_number,
                "char_start": m.char_start,
                "char_end": m.char_end,
                "grammatical_role": m.grammatical_role,
                "resolved_entity_id": str(m.resolved_entity_id) if m.resolved_entity_id else None,
                "resolution_status": m.resolution_status,
                "is_ambiguous": m.is_ambiguous,
                "candidate_entity_ids": m.candidate_entity_ids or [],
                "confidence": m.confidence,
                "rejection_reason": m.rejection_reason,
                "context_sentence": m.context_sentence
            }
            for m in mentions
        ]
    }


@router.get("/accuracy/{project_id}/graph-audit")
def audit_project_graph(
    project_id: str,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Audits current project Knowledge Graph for dangling nodes, spurious edges, and low-salience nodes."""
    require_project_access(project_id, user, db)
    return graph_admission_service.audit_graph_integrity(db, project_id)


@router.post("/accuracy/{project_id}/evaluate")
def run_accuracy_benchmarks(
    project_id: str,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Executes the complete 22-benchmark narrative intelligence evaluation test suite."""
    require_project_access(project_id, user, db)
    return narrative_evaluation_service.run_all_benchmarks()


@router.post("/accuracy/mentions/{mention_id}/resolve")
def resolve_ambiguous_mention(
    mention_id: str,
    resolved_entity_id: str = Form(...),
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Allows author to manually resolve an ambiguous pronoun or descriptive mention."""
    mention = db.query(models.EntityMention).filter(models.EntityMention.id == mention_id).first()
    if not mention:
        raise HTTPException(status_code=404, detail="Mention not found.")

    require_project_access(str(mention.project_id), user, db, require_write=True)

    target_entity = db.query(models.Entity).filter(
        models.Entity.id == resolved_entity_id,
        models.Entity.project_id == mention.project_id
    ).first()
    if not target_entity:
        raise HTTPException(status_code=400, detail="Target canonical entity does not exist in project.")

    mention.resolved_entity_id = target_entity.id
    mention.resolution_status = "resolved"
    mention.is_ambiguous = False
    mention.confidence = 1.0
    mention.rejection_reason = "Author confirmed manual resolution"
    db.commit()

    return {
        "success": True,
        "mention_id": str(mention.id),
        "resolved_entity_id": str(target_entity.id),
        "entity_name": target_entity.name
    }


# 9. Narrative Integrity Audit & Reviewable Correction Endpoints
@router.get("/integrity/{project_id}/audit")
def audit_project_narrative_integrity(
    project_id: str,
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Non-destructive integrity inspection of project entities, relationships, and mentions.
    Identifies duplicate candidates, incidental nodes, and unsupported relationships,
    returning an author-reviewable correction plan.
    """
    require_project_access(project_id, user, db)
    report = narrative_integrity_audit_service.run_project_audit(db, project_id)
    return {
        "project_id": report.project_id,
        "total_entities_audited": report.total_entities_audited,
        "total_relationships_audited": report.total_relationships_audited,
        "total_mentions_audited": report.total_mentions_audited,
        "total_facts_audited": report.total_facts_audited,
        "anomalies_found": report.anomalies_found,
        "is_clean": report.is_clean,
        "anomalies": [
            {
                "anomaly_id": a.anomaly_id,
                "category": a.category,
                "severity": a.severity,
                "entity_id": a.entity_id,
                "target_id": a.target_id,
                "title": a.title,
                "description": a.description,
                "suggested_action": a.suggested_action,
                "proposed_correction": a.proposed_correction
            }
            for a in report.anomalies
        ],
        "correction_plan": report.correction_plan
    }


@router.post("/integrity/{project_id}/correct")
def execute_integrity_correction(
    project_id: str,
    action: str = Form(...),
    entity_id: Optional[str] = Form(None),
    relationship_id: Optional[str] = Form(None),
    user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Executes an author-approved non-destructive correction from the integrity audit plan.
    Preserves audit history and entity integrity.
    """
    require_project_access(project_id, user, db, require_write=True)
    correction_payload = {
        "action": action,
        "entity_id": entity_id,
        "relationship_id": relationship_id
    }
    author_id = str(user.id) if user else None
    result = narrative_integrity_audit_service.execute_approved_correction(
        db=db,
        project_id=project_id,
        correction_action=correction_payload,
        author_id=author_id
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Correction failed."))
    return result
