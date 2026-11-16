import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.database.connection import get_db
from app.database import models
from app.services.memory_service import memory_service
from app.schemas import models as s_models
from app.routes.auth import get_optional_user, require_project_access

logger = logging.getLogger("continuity_routes")
router = APIRouter(tags=["Continuity"])

@router.get("/projects/{project_id}/issues")
def get_project_issues_continuity(
    project_id: str,
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    require_project_access(project_id, current_user, db, require_write=False)
    try:
        issues = memory_service.get_continuity_issues(
            db=db,
            project_id=project_id,
            severity=severity,
            issue_type=issue_type,
            status=status
        )
        return issues
    except Exception as e:
        logger.error(f"Error in get_project_issues_continuity: {e}")
        return []

@router.patch("/issues/{issue_id}")
def update_issue_status(
    issue_id: str,
    data: s_models.ContinuityIssueUpdate,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    issue = db.query(models.ContinuityIssue).filter(models.ContinuityIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Continuity issue not found")

    require_project_access(issue.project_id, current_user, db, require_write=True)

    allowed_statuses = {"open", "unresolved", "resolved", "intentional", "dismissed", "review_later"}
    new_status = data.status.lower().strip()
    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{data.status}'. Allowed: {', '.join(allowed_statuses)}"
        )

    try:
        updated = memory_service.update_issue_status(
            db=db,
            project_id=str(issue.project_id),
            issue_id=issue_id,
            status=new_status,
            author_notes=data.author_notes
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Continuity issue not found")
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_issue_status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update issue status: {str(e)}")
