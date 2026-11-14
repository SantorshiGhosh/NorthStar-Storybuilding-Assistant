from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.services.graph_service import graph_service
from app.services.vector_service import vector_service

router = APIRouter(tags=["Projects"])

@router.post("/projects", response_model=s_models.ProjectOut)
def create_project(data: s_models.ProjectCreate, db: Session = Depends(get_db)):
    try:
        project = models.Project(
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
            user_id=data.user_id if data.user_id else None
        )
        db.add(project)
        db.commit()
        db.refresh(project)

        return s_models.ProjectOut(
            id=str(project.id),
            user_id=str(project.user_id) if project.user_id else None,
            name=project.name,
            description=project.description,
            chapter_count=0,
            character_count=0,
            unresolved_issues_count=0,
            manuscript_title=None,
            created_at=project.created_at,
            updated_at=project.updated_at
        )
    except Exception as e:
        db.rollback()
        import traceback
        print(f"[ERROR in create_project]: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Database error creating project: {str(e)}")

@router.get("/projects", response_model=List[s_models.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(models.Project).order_by(models.Project.updated_at.desc()).all()
    out = []
    for p in projects:
        ch_count = db.query(models.Chapter).filter(models.Chapter.project_id == p.id).count()
        char_count = db.query(models.Entity).filter(
            models.Entity.project_id == p.id,
            models.Entity.entity_type == "character"
        ).count()
        issues_count = db.query(models.ContinuityIssue).filter(
            models.ContinuityIssue.project_id == p.id,
            models.ContinuityIssue.status.in_(["unresolved", "open"])
        ).count()
        manu = db.query(models.Manuscript).filter(models.Manuscript.project_id == p.id).first()

        out.append(s_models.ProjectOut(
            id=p.id,
            user_id=p.user_id,
            name=p.name,
            description=p.description,
            chapter_count=ch_count,
            character_count=char_count,
            unresolved_issues_count=issues_count,
            manuscript_title=manu.filename if manu else None,
            created_at=p.created_at,
            updated_at=p.updated_at
        ))
    return out

@router.get("/projects/{project_id}", response_model=s_models.ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    ch_count = db.query(models.Chapter).filter(models.Chapter.project_id == p.id).count()
    char_count = db.query(models.Entity).filter(
        models.Entity.project_id == p.id,
        models.Entity.entity_type == "character"
    ).count()
    issues_count = db.query(models.ContinuityIssue).filter(
        models.ContinuityIssue.project_id == p.id,
        models.ContinuityIssue.status.in_(["unresolved", "open"])
    ).count()
    manu = db.query(models.Manuscript).filter(models.Manuscript.project_id == p.id).first()

    return s_models.ProjectOut(
        id=p.id,
        user_id=p.user_id,
        name=p.name,
        description=p.description,
        chapter_count=ch_count,
        character_count=char_count,
        unresolved_issues_count=issues_count,
        manuscript_title=manu.filename if manu else None,
        created_at=p.created_at,
        updated_at=p.updated_at
    )

@router.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    # Clear vectors
    vector_service.clear_project(project_id)

    db.delete(p)
    db.commit()
    return {"status": "deleted", "project_id": project_id}

@router.get("/projects/{project_id}/graph", response_model=s_models.GraphDataOut)
def get_project_graph(project_id: str, db: Session = Depends(get_db)):
    entities = db.query(models.Entity).filter(models.Entity.project_id == project_id).all()
    relationships = db.query(models.Relationship).filter(models.Relationship.project_id == project_id).all()

    return graph_service.build_react_flow_graph(entities, relationships)

@router.get("/projects/{project_id}/timeline", response_model=List[s_models.TimelineEventOut])
def get_project_timeline(project_id: str, db: Session = Depends(get_db)):
    events = db.query(models.TimelineEvent).filter(
        models.TimelineEvent.project_id == project_id
    ).order_by(models.TimelineEvent.chronology_order.asc()).all()
    return events

@router.get("/projects/{project_id}/issues", response_model=List[s_models.ContinuityIssueOut])
def get_project_issues(
    project_id: str,
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.ContinuityIssue).filter(models.ContinuityIssue.project_id == project_id)
    if status and status != "all":
        s = status.lower().strip()
        if s in ["open", "unresolved"]:
            query = query.filter(models.ContinuityIssue.status.in_(["unresolved", "open"]))
        else:
            query = query.filter(models.ContinuityIssue.status == s)
    if severity and severity != "all":
        query = query.filter(models.ContinuityIssue.severity == severity.lower().strip())
    if issue_type and issue_type != "all":
        query = query.filter(models.ContinuityIssue.issue_type == issue_type.lower().strip())

    return query.order_by(models.ContinuityIssue.created_at.desc()).all()
