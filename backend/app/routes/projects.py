from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from typing import List, Optional, Dict, Any
import logging

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.services.graph_service import graph_service
from app.services.vector_service import vector_service
from app.services.memory_service import memory_service
from app.agents.orchestrator import orchestrator
from app.routes.auth import get_current_user, get_optional_user, require_project_access

logger = logging.getLogger("projects_route")

router = APIRouter(tags=["Projects"])

@router.post("/projects", response_model=s_models.ProjectOut)
def create_project(
    data: s_models.ProjectCreate,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to create a project. Please sign in."
        )

    try:
        user_id = current_user.id
        project = models.Project(
            id=models.gen_uuid(),
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
            user_id=user_id,
            is_demo=bool(data.is_demo) if current_user.is_superuser else False
        )
        db.add(project)
        db.flush()

        # Add creator as owner in ProjectMember
        member = models.ProjectMember(
            id=models.gen_uuid(),
            project_id=project.id,
            user_id=user_id,
            role="owner"
        )
        db.add(member)

        db.commit()
        db.refresh(project)

        return s_models.ProjectOut(
            id=str(project.id),
            user_id=str(project.user_id) if project.user_id else None,
            name=project.name,
            description=project.description,
            is_demo=bool(project.is_demo),
            role="owner",
            chapter_count=0,
            character_count=0,
            unresolved_issues_count=0,
            manuscript_title=None,
            created_at=project.created_at,
            updated_at=project.updated_at
        )
    except Exception as e:
        db.rollback()
        logger.error(f"[ERROR in create_project]: {e}")
        raise HTTPException(status_code=500, detail=f"Database error creating project: {str(e)}")

@router.get("/projects", response_model=List[s_models.ProjectOut])
def list_projects(
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Lists projects strictly isolated by authenticated user.
    - Superusers see all projects for administrative oversight.
    - An authenticated user strictly sees:
      1. Projects they created / own (project.user_id == current_user.id)
      2. Projects they are explicitly granted membership in (via project_members)
    - A guest demo user sees their own created projects + official demo projects.
    - Unauthenticated visitors see only official demo projects (empty if none).
    """
    query = db.query(models.Project)

    if current_user:
        if current_user.is_superuser:
            pass  # superuser sees all
        else:
            member_project_subquery = db.query(models.ProjectMember.project_id).filter(
                models.ProjectMember.user_id == current_user.id
            )
            query = query.filter(
                or_(
                    models.Project.user_id == current_user.id,
                    models.Project.id.in_(member_project_subquery)
                )
            )
    else:
        return []

    projects = query.order_by(models.Project.updated_at.desc()).all()
    if not projects:
        return []

    proj_ids = [p.id for p in projects]

    # Batch 1: chapter counts grouped by project_id
    ch_rows = (
        db.query(models.Chapter.project_id, func.count(models.Chapter.id))
        .filter(models.Chapter.project_id.in_(proj_ids))
        .group_by(models.Chapter.project_id)
        .all()
    )
    ch_counts = {str(r[0]): r[1] for r in ch_rows}

    # Batch 2: character counts grouped by project_id
    char_rows = (
        db.query(models.Entity.project_id, func.count(models.Entity.id))
        .filter(models.Entity.project_id.in_(proj_ids), models.Entity.entity_type == "character")
        .group_by(models.Entity.project_id)
        .all()
    )
    char_counts = {str(r[0]): r[1] for r in char_rows}

    # Batch 3: unresolved issues grouped by project_id
    issue_rows = (
        db.query(models.ContinuityIssue.project_id, func.count(models.ContinuityIssue.id))
        .filter(models.ContinuityIssue.project_id.in_(proj_ids), models.ContinuityIssue.status.in_(["unresolved", "open"]))
        .group_by(models.ContinuityIssue.project_id)
        .all()
    )
    issue_counts = {str(r[0]): r[1] for r in issue_rows}

    # Batch 4: latest manuscript per project
    manuscripts = (
        db.query(models.Manuscript)
        .filter(models.Manuscript.project_id.in_(proj_ids))
        .order_by(models.Manuscript.created_at.desc())
        .all()
    )
    manu_by_proj = {}
    for m in manuscripts:
        pid_str = str(m.project_id)
        if pid_str not in manu_by_proj:
            manu_by_proj[pid_str] = m.filename

    # Determine user role per project
    member_roles = {}
    if current_user:
        memberships = db.query(models.ProjectMember).filter(
            models.ProjectMember.user_id == current_user.id,
            models.ProjectMember.project_id.in_(proj_ids)
        ).all()
        for m in memberships:
            member_roles[str(m.project_id)] = m.role

    out = []
    for p in projects:
        pid = str(p.id)
        user_role = "owner"
        if current_user:
            if str(p.user_id) == str(current_user.id):
                user_role = "owner"
            elif pid in member_roles:
                user_role = member_roles[pid]
            elif p.is_demo:
                user_role = "viewer"
        elif p.is_demo:
            user_role = "viewer"

        out.append(s_models.ProjectOut(
            id=p.id,
            user_id=p.user_id,
            name=p.name,
            description=p.description,
            is_demo=bool(p.is_demo),
            role=user_role,
            chapter_count=ch_counts.get(pid, 0),
            character_count=char_counts.get(pid, 0),
            unresolved_issues_count=issue_counts.get(pid, 0),
            manuscript_title=manu_by_proj.get(pid),
            created_at=p.created_at,
            updated_at=p.updated_at
        ))
    return out

@router.get("/projects/{project_id}", response_model=s_models.ProjectOut)
def get_project(
    project_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user:
        require_project_access(project_id, current_user, db)
    elif not p.is_demo and p.user_id is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required to access private project.")

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
        is_demo=bool(p.is_demo),
        role="owner" if current_user and str(p.user_id) == str(current_user.id) else "viewer",
        chapter_count=ch_count,
        character_count=char_count,
        unresolved_issues_count=issues_count,
        manuscript_title=manu.filename if manu else None,
        created_at=p.created_at,
        updated_at=p.updated_at
    )

@router.get("/projects/{project_id}/bundle")
def get_project_bundle(
    project_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user:
        require_project_access(project_id, current_user, db)
    elif not p.is_demo and p.user_id is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")

    project_dict = {
        "id": str(p.id),
        "user_id": str(p.user_id) if p.user_id else None,
        "name": p.name,
        "description": p.description or "",
        "is_demo": bool(p.is_demo),
        "chapter_count": 0,
        "character_count": 0,
        "unresolved_issues_count": 0,
        "manuscript_title": None,
        "created_at": p.created_at,
        "updated_at": p.updated_at
    }

    # Chapters list
    chapters_out = []
    try:
        chs = db.query(models.Chapter).filter(
            models.Chapter.project_id == project_id
        ).order_by(models.Chapter.chapter_number.asc()).all()
        for ch in chs:
            chapters_out.append({
                "id": str(ch.id),
                "project_id": str(ch.project_id),
                "manuscript_id": str(ch.manuscript_id) if ch.manuscript_id else None,
                "chapter_number": ch.chapter_number,
                "title": ch.title,
                "content": ch.content,
                "word_count": ch.word_count or len(ch.content.split()),
                "created_at": ch.created_at,
                "updated_at": ch.updated_at
            })
    except Exception as e:
        logger.error(f"[bundle] Chapters query failed: {e}")
        db.rollback()

    # Continuity issues
    issues_out = []
    try:
        issues_out = memory_service.get_continuity_issues(db=db, project_id=project_id)
    except Exception as e:
        logger.error(f"[bundle] Issues query failed: {e}")
        db.rollback()

    # Entities count
    entities_count = 0
    char_count = 0
    try:
        ents = memory_service.get_entities(db=db, project_id=project_id)
        entities_count = len(ents)
        for ent in ents:
            ent_type = getattr(ent, "entity_type", None) or (ent.get("entity_type") if isinstance(ent, dict) else "")
            if str(ent_type).lower() == "character":
                char_count += 1
    except Exception as e:
        logger.error(f"[bundle] Entities query failed: {e}")
        db.rollback()

    # Manuscript title
    try:
        manu = db.query(models.Manuscript).filter(models.Manuscript.project_id == project_id).first()
        if manu:
            project_dict["manuscript_title"] = manu.filename
    except Exception as e:
        logger.error(f"[bundle] Manuscript query failed: {e}")
        db.rollback()

    project_dict["chapter_count"] = len(chapters_out)
    project_dict["character_count"] = char_count
    project_dict["unresolved_issues_count"] = sum(1 for i in issues_out if i.get("status") in ["unresolved", "open"])

    return {
        "project": project_dict,
        "chapters": chapters_out,
        "issues": issues_out,
        "entities_count": entities_count
    }

@router.delete("/projects/{project_id}")
def delete_project(
    project_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    p = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user:
        require_project_access(project_id, current_user, db, require_write=True)
        # Only owner or superuser can delete
        if p.user_id is not None and str(p.user_id) != str(current_user.id) and not current_user.is_superuser:
            raise HTTPException(status_code=403, detail="Only project owner can delete this project.")

    try:
        vector_service.clear_project(project_id)
    except Exception as e:
        logger.warning(f"Failed clearing vector storage for {project_id}: {e}")

    db.delete(p)
    db.commit()
    return {"status": "deleted", "project_id": project_id}

@router.get("/projects/{project_id}/graph")
def get_project_graph(
    project_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    if current_user:
        require_project_access(project_id, current_user, db)
    try:
        entities = memory_service.get_entities(db=db, project_id=project_id)
        relationships = memory_service.get_relationships(db=db, project_id=project_id)
        return graph_service.build_react_flow_graph(entities, relationships)
    except Exception as e:
        logger.error(f"Error in get_project_graph: {e}")
        return {"nodes": [], "edges": []}

@router.get("/projects/{project_id}/timeline")
def get_project_timeline(
    project_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    if current_user:
        require_project_access(project_id, current_user, db)
    try:
        return memory_service.get_timeline_events(db=db, project_id=project_id)
    except Exception as e:
        logger.error(f"Error in get_project_timeline: {e}")
        return []

@router.get("/projects/{project_id}/issues")
def get_project_issues(
    project_id: str,
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    issue_type: Optional[str] = Query(None),
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    if current_user:
        require_project_access(project_id, current_user, db)
    try:
        return memory_service.get_continuity_issues(
            db=db,
            project_id=project_id,
            severity=severity,
            issue_type=issue_type,
            status=status
        )
    except Exception as e:
        logger.error(f"Error in get_project_issues: {e}")
        return []

@router.post("/projects/{project_id}/continuity/analyze")
def analyze_project_continuity(
    project_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    Runs full Continuity Guardian evaluation across all chapters in the project.
    Evaluates chapters chronologically against prior established canon.
    """
    require_project_access(project_id, current_user, db, require_write=True)
    chapters = db.query(models.Chapter).filter(
        models.Chapter.project_id == project_id
    ).order_by(models.Chapter.chapter_number.asc()).all()

    if not chapters:
        return {"status": "success", "issues_found": 0, "issues": []}

    new_detected = []
    # Evaluate all chapters chronologically (checking both intra-chapter and prior-chapter canon)
    for ch in chapters:
        ch_issues = orchestrator.analyze_chapter_continuity(
            db=db,
            project_id=project_id,
            chapter_id=ch.id,
            skip_llm=False
        )
        new_detected.extend(ch_issues)

    all_issues = memory_service.get_continuity_issues(db=db, project_id=project_id)
    return {
        "status": "success",
        "issues_found": len(all_issues),
        "new_issues_count": len(new_detected),
        "issues": all_issues
    }
