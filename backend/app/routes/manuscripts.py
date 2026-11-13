import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database import models
from app.config import settings
from app.agents.orchestrator import orchestrator

router = APIRouter(tags=["Manuscripts"])

ALLOWED_EXTENSIONS = {"docx", "txt", "md", "pdf"}
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

@router.post("/projects/{project_id}/upload")
async def upload_manuscript(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Verify project exists
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

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

    try:
        manuscript = orchestrator.process_uploaded_manuscript(
            db=db,
            project_id=project_id,
            filename=filename,
            file_bytes=file_bytes,
            file_ext=ext,
            vault_path=vault_path,
            fast_mode=True
        )
        # Detached background thread so HTTP response returns immediately without proxy timeout
        import threading
        threading.Thread(
            target=orchestrator.enrich_project_with_ai,
            args=(project_id,),
            daemon=True
        ).start()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process manuscript: {str(e)}")

    # Fetch stats
    chapter_count = db.query(models.Chapter).filter(models.Chapter.project_id == project_id).count()
    entities_count = db.query(models.Entity).filter(models.Entity.project_id == project_id).count()
    issues_count = db.query(models.ContinuityIssue).filter(
        models.ContinuityIssue.project_id == project_id,
        models.ContinuityIssue.status == "unresolved"
    ).count()

    return {
        "status": "success",
        "manuscript_id": manuscript.id,
        "filename": manuscript.filename,
        "chapters_extracted": chapter_count,
        "entities_identified": entities_count,
        "unresolved_issues": issues_count
    }
