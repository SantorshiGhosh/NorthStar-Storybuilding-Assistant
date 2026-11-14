import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from app.database.connection import get_db
from app.services.memory_service import memory_service
from app.schemas import models as s_models

logger = logging.getLogger("continuity_routes")
router = APIRouter(tags=["Continuity"])

@router.get("/projects/{project_id}/issues")
def get_project_issues_continuity(
    project_id: str,
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
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
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
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
            project_id="",
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
