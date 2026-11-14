from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models

router = APIRouter(tags=["Continuity"])

@router.patch("/issues/{issue_id}", response_model=s_models.ContinuityIssueOut)
def update_issue_status(
    issue_id: str,
    data: s_models.ContinuityIssueUpdate,
    db: Session = Depends(get_db)
):
    issue = db.query(models.ContinuityIssue).filter(models.ContinuityIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Continuity issue not found")

    allowed_statuses = {"open", "unresolved", "resolved", "intentional", "dismissed", "review_later"}
    if data.status.lower() not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{data.status}'. Allowed: {', '.join(allowed_statuses)}"
        )

    issue.status = data.status.lower()
    if data.author_notes is not None:
        issue.author_notes = data.author_notes

    db.commit()
    db.refresh(issue)
    return issue
