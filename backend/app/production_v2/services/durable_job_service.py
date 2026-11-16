"""
Production V2 Durable Job Service
Persistent task tracker surviving worker restarts with 14 granular processing stages.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict
from sqlalchemy.orm import Session

from app.database import models
from app.production_v2.schemas.v2_schemas import DurableJobOut, JobRetryResponse
from app.production_v2.config import v2_settings


class ProcessingStage:
    STAGE_1_VALIDATING_DOCUMENT = "VALIDATING_DOCUMENT"
    STAGE_2_ENCRYPTING_VAULT = "ENCRYPTING_VAULT"
    STAGE_3_CHUNKING_PASSAGES = "CHUNKING_PASSAGES"
    STAGE_4_EXTRACTING_ENTITIES = "EXTRACTING_ENTITIES"
    STAGE_5_RESOLVING_IDENTITIES = "RESOLVING_IDENTITIES"
    STAGE_6_BUILDING_TEMPORAL_MEMORY = "BUILDING_TEMPORAL_MEMORY"
    STAGE_7_TRACKING_CHARACTER_STATES = "TRACKING_CHARACTER_STATES"
    STAGE_8_TRACKING_OBJECT_CUSTODY = "TRACKING_OBJECT_CUSTODY"
    STAGE_9_INDEXING_HYBRID_VECTORS = "INDEXING_HYBRID_VECTORS"
    STAGE_10_UPDATING_KNOWLEDGE_GRAPH = "UPDATING_KNOWLEDGE_GRAPH"
    STAGE_11_RUNNING_CONTINUITY_GUARDIAN = "RUNNING_CONTINUITY_GUARDIAN"
    STAGE_12_VERIFYING_EVIDENCE_SPANS = "VERIFYING_EVIDENCE_SPANS"
    STAGE_13_PREPARING_CANON_PROPOSALS = "PREPARING_CANON_PROPOSALS"
    STAGE_14_COMPLETED = "COMPLETED"

    ALL_STAGES = [
        STAGE_1_VALIDATING_DOCUMENT,
        STAGE_2_ENCRYPTING_VAULT,
        STAGE_3_CHUNKING_PASSAGES,
        STAGE_4_EXTRACTING_ENTITIES,
        STAGE_5_RESOLVING_IDENTITIES,
        STAGE_6_BUILDING_TEMPORAL_MEMORY,
        STAGE_7_TRACKING_CHARACTER_STATES,
        STAGE_8_TRACKING_OBJECT_CUSTODY,
        STAGE_9_INDEXING_HYBRID_VECTORS,
        STAGE_10_UPDATING_KNOWLEDGE_GRAPH,
        STAGE_11_RUNNING_CONTINUITY_GUARDIAN,
        STAGE_12_VERIFYING_EVIDENCE_SPANS,
        STAGE_13_PREPARING_CANON_PROPOSALS,
        STAGE_14_COMPLETED
    ]

    STAGE_PERCENTAGES = {
        STAGE_1_VALIDATING_DOCUMENT: 5.0,
        STAGE_2_ENCRYPTING_VAULT: 10.0,
        STAGE_3_CHUNKING_PASSAGES: 20.0,
        STAGE_4_EXTRACTING_ENTITIES: 35.0,
        STAGE_5_RESOLVING_IDENTITIES: 45.0,
        STAGE_6_BUILDING_TEMPORAL_MEMORY: 55.0,
        STAGE_7_TRACKING_CHARACTER_STATES: 65.0,
        STAGE_8_TRACKING_OBJECT_CUSTODY: 72.0,
        STAGE_9_INDEXING_HYBRID_VECTORS: 80.0,
        STAGE_10_UPDATING_KNOWLEDGE_GRAPH: 85.0,
        STAGE_11_RUNNING_CONTINUITY_GUARDIAN: 92.0,
        STAGE_12_VERIFYING_EVIDENCE_SPANS: 96.0,
        STAGE_13_PREPARING_CANON_PROPOSALS: 98.0,
        STAGE_14_COMPLETED: 100.0,
    }


class DurableJobService:
    """
    Manages persistent execution state for narrative processing pipelines.
    """

    def create_job(
        self,
        db: Session,
        project_id: str,
        manuscript_id: Optional[str] = None,
        job_type: str = "manuscript_narrative_ingestion"
    ) -> models.ProcessingJob:
        """Initializes a new durable processing job."""
        job = models.ProcessingJob(
            project_id=project_id,
            manuscript_id=manuscript_id,
            status="queued",
            stage=ProcessingStage.STAGE_1_VALIDATING_DOCUMENT,
            progress=0,
            message=f"Job initialized ({job_type})",
            meta_info={"stages_completed": []}
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def update_stage(
        self,
        db: Session,
        job_id: str,
        stage: str,
        details: Optional[Dict] = None
    ) -> Optional[models.ProcessingJob]:
        """Advances job to a new stage, calculates progress percentage, and touches updated_at."""
        job = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
        if not job:
            return None

        job.stage = stage
        job.status = "processing"
        job.progress = int(ProcessingStage.STAGE_PERCENTAGES.get(stage, job.progress or 0))
        job.updated_at = datetime.now(timezone.utc)

        from sqlalchemy.orm.attributes import flag_modified
        meta = dict(job.meta_info or {})
        completed_stages = list(meta.get("stages_completed", []))
        if stage not in completed_stages:
            completed_stages.append(stage)
        meta["stages_completed"] = completed_stages
        if details:
            meta.update(details)
        job.meta_info = meta
        flag_modified(job, "meta_info")

        if stage == ProcessingStage.STAGE_14_COMPLETED:
            job.status = "completed"
            job.progress = 100

        db.commit()
        db.refresh(job)
        return job

    def mark_failed(self, db: Session, job_id: str, error_message: str) -> Optional[models.ProcessingJob]:
        """Records failure reason and preserves completed stages."""
        job = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
        if not job:
            return None
        job.status = "failed"
        job.error_details = error_message
        job.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(job)
        return job

    def get_job_status(self, db: Session, job_id: str) -> Optional[DurableJobOut]:
        """Returns formatted job progress."""
        job = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
        if not job:
            return None

        meta = job.meta_info or {}
        stages_done = meta.get("stages_completed", [])

        return DurableJobOut(
            job_id=str(job.id),
            project_id=str(job.project_id),
            manuscript_id=str(job.manuscript_id) if job.manuscript_id else None,
            status=job.status or "unknown",
            current_stage=job.stage or ProcessingStage.STAGE_1_VALIDATING_DOCUMENT,
            progress_percent=float(job.progress or 0.0),
            stages_completed=stages_done,
            error=job.error_details,
            created_at=job.created_at.isoformat() if job.created_at else "",
            updated_at=job.updated_at.isoformat() if job.updated_at else ""
        )

    def recover_stalled_jobs(self, db: Session, timeout_seconds: int = 300) -> List[str]:
        """
        Scans for stalled 'processing' jobs without heartbeat updates and flags them.
        """
        threshold = datetime.now(timezone.utc) - timedelta(seconds=timeout_seconds)
        stalled = db.query(models.ProcessingJob).filter(
            models.ProcessingJob.status == "processing",
            models.ProcessingJob.updated_at < threshold
        ).all()

        recovered_ids = []
        for job in stalled:
            job.status = "failed"
            job.error_details = f"Worker heartbeat timeout ({timeout_seconds}s). Job eligible for retry."
            job.updated_at = datetime.now(timezone.utc)
            recovered_ids.append(str(job.id))

        if recovered_ids:
            db.commit()
        return recovered_ids

    def retry_job(self, db: Session, job_id: str) -> JobRetryResponse:
        """Resets a failed or stalled job for resumption."""
        job = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
        if not job:
            raise ValueError(f"Job {job_id} not found.")

        # Determine last completed stage
        meta = job.meta_info or {}
        stages_done = meta.get("stages_completed", [])
        resume_stage = stages_done[-1] if stages_done else ProcessingStage.STAGE_1_VALIDATING_DOCUMENT

        job.status = "queued"
        job.error_details = None
        job.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(job)

        return JobRetryResponse(
            job_id=str(job.id),
            status="queued",
            resumed_from_stage=resume_stage,
            message=f"Job {job_id} queued for resumption from stage {resume_stage}."
        )


durable_job_service = DurableJobService()
