"""
Production V2 Durable Background Task Worker
Provides robust, database-backed asynchronous job execution:
- Polls for queued/retrying manuscript ingestion tasks.
- Recovers stalled jobs after worker restarts.
- Invokes ProductionPipelineCoordinator through all 14 stages.
- Updates heartbeats and persists stage transitions.
"""
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.database.connection import get_db
from app.database import models
from app.production_v2.services.durable_job_service import durable_job_service, ProcessingStage
from app.production_v2.services.vault_key_management import vault_key_manager
from app.production_v2.pipelines.production_pipeline import production_pipeline_coordinator

logger = logging.getLogger("durable_task_worker")


class DurableTaskWorker:
    """
    Background worker processing manuscript ingestion pipelines.
    Supports in-process async execution and standalone worker daemons.
    """

    def __init__(self, heartbeat_interval: int = 15):
        self.heartbeat_interval = heartbeat_interval
        self._running = False

    def recover_stalled_jobs(self, db: Session, stall_timeout_seconds: int = 300) -> int:
        """
        Detects jobs stuck in 'processing' status after an unexpected worker crash.
        Resets them to 'queued' or 'failed' depending on retry count.
        """
        threshold = datetime.now(timezone.utc) - timedelta(seconds=stall_timeout_seconds)
        stalled_jobs = db.query(models.ProcessingJob).filter(
            models.ProcessingJob.status == "processing",
            models.ProcessingJob.updated_at < threshold
        ).all()

        recovered_count = 0
        for job in stalled_jobs:
            meta = job.meta_info or {}
            retries = meta.get("retry_count", 0)
            if retries < 3:
                job.status = "queued"
                meta["recovered_from_crash"] = True
                meta["last_crash_recovery_at"] = datetime.now(timezone.utc).isoformat()
                meta["retry_count"] = retries + 1
                flag_modified(job, "meta_info")
                recovered_count += 1
            else:
                job.status = "failed"
                job.error_message = f"Job stalled and exceeded max crash recovery retries ({retries})."
            db.commit()

        return recovered_count

    def process_job_by_id(self, db: Session, job_id: str) -> bool:
        """
        Executes pipeline for a specific job directly.
        Returns True on success, False on failure.
        """
        job = db.query(models.ProcessingJob).filter(models.ProcessingJob.id == job_id).first()
        if not job:
            logger.error(f"Worker cannot find job {job_id}")
            return False

        # Acquire lock
        job.status = "processing"
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        try:
            meta = job.meta_info or {}
            project_id = str(job.project_id)
            manuscript_id = meta.get("manuscript_id")

            if not manuscript_id:
                raise ValueError(f"Job {job_id} metadata missing manuscript_id.")

            manuscript = db.query(models.Manuscript).filter(models.Manuscript.id == manuscript_id).first()
            if not manuscript:
                raise ValueError(f"Manuscript {manuscript_id} not found.")

            vault_path = manuscript.storage_path
            if not vault_path:
                raise ValueError(f"Manuscript {manuscript_id} has no storage_path recorded.")

            # Decrypt file from vault
            file_bytes = vault_key_manager.read_and_decrypt_file(vault_path)
            file_ext = manuscript.file_type or "txt"

            # Execute full narrative pipeline
            production_pipeline_coordinator.execute_pipeline(
                db=db,
                project_id=project_id,
                manuscript_id=str(manuscript.id),
                job_id=str(job.id),
                file_bytes=file_bytes,
                file_ext=file_ext,
                vault_file_path=vault_path
            )
            return True

        except Exception as exc:
            logger.error(f"Worker failed processing job {job_id}: {exc}", exc_info=True)
            db.rollback()
            durable_job_service.mark_failed(db, job_id, str(exc))
            return False

    def process_next_job(self, db: Session) -> Optional[str]:
        """
        Pulls the next queued job, locks it, and runs it to completion.
        Returns job_id if a job was processed, None if queue was empty.
        """
        # Recover any stalled jobs first
        self.recover_stalled_jobs(db)

        # Pull next queued job
        job = db.query(models.ProcessingJob).filter(
            models.ProcessingJob.status.in_(["queued", "retrying"])
        ).order_by(models.ProcessingJob.created_at.asc()).first()

        if not job:
            return None

        job_id = str(job.id)
        self.process_job_by_id(db, job_id)
        return job_id

    def run_worker_loop(self, poll_interval: float = 2.0, max_iterations: Optional[int] = None):
        """
        Continuous polling loop for worker daemon.
        """
        self._running = True
        iterations = 0
        logger.info("DurableTaskWorker loop started.")

        while self._running:
            if max_iterations is not None and iterations >= max_iterations:
                break

            iterations += 1
            db = next(get_db())
            try:
                processed_id = self.process_next_job(db)
                if not processed_id:
                    time.sleep(poll_interval)
            except Exception as e:
                logger.error(f"Error in worker loop iteration: {e}", exc_info=True)
                time.sleep(poll_interval)
            finally:
                db.close()

    def stop(self):
        self._running = False


task_worker = DurableTaskWorker()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    task_worker.run_worker_loop()
