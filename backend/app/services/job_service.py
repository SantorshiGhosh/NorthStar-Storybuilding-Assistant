import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import models

logger = logging.getLogger("job_service")

class JobService:
    """
    Manages persistent background processing jobs for manuscript ingestion,
    entity resolution, indexing, and continuity analysis.
    Survives worker restarts and provides fine-grained stage reporting.
    """

    STAGES = [
        ("uploaded", 5, "Manuscript uploaded and encrypted in vault storage"),
        ("validating", 10, "Validating document signatures, encoding, and integrity"),
        ("extracting", 20, "Extracting reading-order text, tables, and sections"),
        ("segmenting", 30, "Segmenting chapters and scene boundaries"),
        ("extracting_entities", 45, "Running hybrid entity recognition across characters and lore"),
        ("resolving_identities", 60, "Resolving character aliases, epithets, and canonical identities"),
        ("building_narrative_memory", 75, "Constructing versioned facts and temporal state models"),
        ("indexing_passages", 85, "Indexing passages into project-isolated semantic vector memory"),
        ("running_continuity_checks", 95, "Evaluating cross-chapter continuity and evidence citations"),
        ("completed", 100, "Narrative intelligence processing successfully complete")
    ]

    def create_job(
        self,
        db: Session,
        project_id: str,
        manuscript_id: Optional[str] = None
    ) -> models.ProcessingJob:
        """
        Creates a new persistent processing job.
        Cancels any prior pending/processing jobs for this project to maintain idempotency.
        """
        prior_active = db.query(models.ProcessingJob).filter(
            models.ProcessingJob.project_id == project_id,
            models.ProcessingJob.status.in_(["pending", "processing"])
        ).all()
        for pj in prior_active:
            pj.status = "cancelled"
            pj.message = "Superseded by newer processing job."

        job = models.ProcessingJob(
            id=models.gen_uuid(),
            project_id=project_id,
            manuscript_id=manuscript_id,
            stage="uploaded",
            status="processing",
            progress=5,
            message="Manuscript uploaded to secure vault storage.",
            meta_info={"start_time": datetime.utcnow().isoformat()}
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job

    def update_job_stage(
        self,
        db: Session,
        job_id: str,
        stage: str,
        progress: Optional[int] = None,
        message: Optional[str] = None,
        meta_info: Optional[Dict[str, Any]] = None
    ) -> Optional[models.ProcessingJob]:
        """
        Updates the progress, stage, and user-facing message of a persistent job.
        """
        job = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
        if not job:
            return None

        job.stage = stage
        if progress is not None:
            job.progress = min(100, max(0, progress))
        if message:
            job.message = message
        if meta_info:
            current_meta = dict(job.meta_info or {})
            current_meta.update(meta_info)
            job.meta_info = current_meta

        job.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

    def complete_job(
        self,
        db: Session,
        job_id: str,
        message: str = "Analysis complete.",
        warnings: Optional[List[str]] = None
    ) -> Optional[models.ProcessingJob]:
        """
        Marks the job as successfully completed.
        """
        job = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
        if not job:
            return None

        job.stage = "completed"
        job.status = "completed_with_warnings" if warnings else "completed"
        job.progress = 100
        job.message = message
        if warnings:
            current_meta = dict(job.meta_info or {})
            current_meta["warnings"] = warnings
            job.meta_info = current_meta

        job.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

    def fail_job(
        self,
        db: Session,
        job_id: str,
        error_message: str,
        error_details: Optional[str] = None
    ) -> Optional[models.ProcessingJob]:
        """
        Marks the job as failed with actionable error information.
        """
        job = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
        if not job:
            return None

        job.status = "failed"
        job.message = error_message
        job.error_details = error_details
        job.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

    def get_job(self, db: Session, job_id: str) -> Optional[models.ProcessingJob]:
        return db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()

    def get_latest_project_job(self, db: Session, project_id: str) -> Optional[models.ProcessingJob]:
        return db.query(models.ProcessingJob).filter(
            models.ProcessingJob.project_id == project_id
        ).order_by(models.ProcessingJob.created_at.desc()).first()

    def list_jobs_for_project(self, db: Session, project_id: str, limit: int = 10) -> List[models.ProcessingJob]:
        return db.query(models.ProcessingJob).filter(
            models.ProcessingJob.project_id == project_id
        ).order_by(models.ProcessingJob.created_at.desc()).limit(limit).all()

    def job_to_dict(self, job: Optional[models.ProcessingJob]) -> Optional[Dict[str, Any]]:
        if not job:
            return None
        return {
            "id": str(job.id),
            "project_id": str(job.project_id),
            "manuscript_id": str(job.manuscript_id) if job.manuscript_id else None,
            "stage": job.stage,
            "status": job.status,
            "progress": job.progress,
            "message": job.message,
            "error_details": job.error_details,
            "meta_info": job.meta_info or {},
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "updated_at": job.updated_at.isoformat() if job.updated_at else None
        }

job_service = JobService()
