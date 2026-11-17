import os
import threading
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status, Header
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database import models
from app.config import settings
from app.agents.orchestrator import orchestrator
from app.routes.auth import get_optional_user, require_project_access
from app.services.job_service import job_service
from app.services.event_stream_service import event_stream_service
from app.services.auth_service import auth_service

router = APIRouter(tags=["Manuscripts"])

ALLOWED_EXTENSIONS = {"docx", "txt", "md", "pdf"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

@router.post("/projects/{project_id}/upload")
async def upload_manuscript(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    # Verify project exists and user has write access
    project = require_project_access(project_id, current_user, db, require_write=True)

    filename = file.filename or "manuscript.txt"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 25MB")

    # Vault storage path
    vault_filename = f"{project_id}_{filename}.vault"
    vault_path = os.path.join(settings.VAULT_STORAGE_DIRECTORY, vault_filename)

    # 1. Create persistent tracking job
    job = job_service.create_job(db, project_id=project_id)
    job_service.update_job_stage(db, job.id, "uploading", progress=5, message="Receiving and validating file...")

    try:
        manuscript = orchestrator.process_uploaded_manuscript(
            db=db,
            project_id=project_id,
            filename=filename,
            file_bytes=file_bytes,
            file_ext=ext,
            vault_path=vault_path,
            fast_mode=False,
            job_id=job.id
        )
        job.manuscript_id = manuscript.id
        db.commit()
    except Exception as e:
        job_service.fail_job(db, job.id, f"Processing failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process manuscript: {str(e)}")

    # Fetch updated project statistics
    chapter_count = db.query(models.Chapter).filter(models.Chapter.project_id == project_id).count()
    entities_count = db.query(models.Entity).filter(models.Entity.project_id == project_id).count()
    issues_count = db.query(models.ContinuityIssue).filter(
        models.ContinuityIssue.project_id == project_id,
        models.ContinuityIssue.status.in_(["unresolved", "open"])
    ).count()

    return {
        "status": "success",
        "job_id": str(job.id),
        "manuscript_id": str(manuscript.id),
        "filename": manuscript.filename,
        "version_number": manuscript.version_number,
        "chapters_extracted": chapter_count,
        "entities_identified": entities_count,
        "unresolved_issues": issues_count
    }

@router.get("/projects/{project_id}/jobs/latest")
def get_latest_project_job(
    project_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Returns the latest background processing job for a project.
    """
    require_project_access(project_id, current_user, db, require_write=False)
    job = job_service.get_latest_project_job(db, project_id)
    if not job:
        return {"status": "none", "job": None}
    return {"status": "success", "job": job_service.job_to_dict(job)}

@router.get("/projects/{project_id}/jobs/{job_id}")
def get_job_status(
    project_id: str,
    job_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Returns the live progress, current stage, and messages for a specific job.
    """
    require_project_access(project_id, current_user, db, require_write=False)
    job = job_service.get_job(db, job_id)
    if not job or str(job.project_id) != str(project_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return {"status": "success", "job": job_service.job_to_dict(job)}

@router.get("/projects/{project_id}/jobs")
def list_project_jobs(
    project_id: str,
    limit: int = 10,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Lists recent processing jobs for a project.
    """
    require_project_access(project_id, current_user, db, require_write=False)
    jobs = job_service.list_jobs_for_project(db, project_id, limit=limit)
    return {
        "status": "success",
        "jobs": [job_service.job_to_dict(j) for j in jobs]
    }

@router.get("/projects/{project_id}/events")
async def stream_project_events(
    project_id: str,
    token: Optional[str] = None,
    last_event_id: Optional[str] = None,
    last_event_id_header: Optional[str] = Header(None, alias="Last-Event-ID"),
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Streams progressive Server-Sent Events (SSE) for manuscript processing,
    new entity discoveries, timeline events, and verified continuity warnings.
    Supports reconnection recovery via Last-Event-ID.
    """
    if not current_user and token:
        payload = auth_service.decode_access_token(token)
        if payload and "sub" in payload:
            current_user = auth_service.get_user_by_id(db, payload["sub"])

    require_project_access(project_id, current_user, db, require_write=False)
    raw_seq = last_event_id_header or last_event_id
    last_seq = int(raw_seq) if raw_seq and raw_seq.isdigit() else None

    return StreamingResponse(
        event_stream_service.subscribe(project_id, last_event_id=last_seq),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/projects/{project_id}/jobs/{job_id}/retry")
def retry_project_job(
    project_id: str,
    job_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Idempotent stage-based recovery: Resumes a failed or interrupted processing job
    without duplicating completed stages.
    """
    require_project_access(project_id, current_user, db, require_write=True)
    job = job_service.get_job(db, job_id)
    if not job or str(job.project_id) != str(project_id):
        raise HTTPException(status_code=404, detail="Job not found")

    job.status = "processing"
    job.message = "Resuming analysis from last completed stage..."
    db.commit()

    threading.Thread(
        target=orchestrator.enrich_project_with_ai,
        args=(project_id, job.id),
        daemon=True
    ).start()

    return {"status": "success", "job": job_service.job_to_dict(job)}
