from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.services.memory_service import memory_service

router = APIRouter(tags=["Entities & Relationships"])

@router.get("/projects/{project_id}/entities", response_model=List[s_models.EntityOut])
def list_entities(
    project_id: str,
    entity_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.Entity).filter(models.Entity.project_id == project_id)
    if entity_type and entity_type != "all":
        query = query.filter(models.Entity.entity_type.ilike(entity_type.strip()))
    if search and search.strip():
        q = f"%{search.strip()}%"
        query = query.filter(or_(
            models.Entity.name.ilike(q),
            models.Entity.description.ilike(q)
        ))
    return query.order_by(models.Entity.name.asc()).all()

@router.post("/projects/{project_id}/entities", response_model=s_models.EntityOut)
def create_entity(project_id: str, data: s_models.EntityCreate, db: Session = Depends(get_db)):
    entity = memory_service.save_or_update_entity(
        db=db,
        project_id=project_id,
        name=data.name,
        entity_type=data.entity_type,
        description=data.description,
        traits=data.traits,
        first_appearance_chapter=data.first_appearance_chapter or 1
    )
    return entity

@router.get("/entities/{entity_id}", response_model=s_models.EntityOut)
def get_entity(entity_id: str, db: Session = Depends(get_db)):
    entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity

@router.patch("/entities/{entity_id}", response_model=s_models.EntityOut)
def update_entity(entity_id: str, data: s_models.EntityUpdate, db: Session = Depends(get_db)):
    entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if data.name is not None and data.name.strip():
        entity.name = data.name.strip()
    if data.entity_type is not None and data.entity_type.strip():
        entity.entity_type = data.entity_type.strip()
    if data.description is not None:
        entity.description = data.description
    if data.traits is not None:
        entity.traits = data.traits
    if data.first_appearance_chapter is not None:
        entity.first_appearance_chapter = data.first_appearance_chapter

    db.commit()
    db.refresh(entity)
    return entity

# --- Relationships Endpoints (Roadmap Section 10) ---

@router.get("/projects/{project_id}/relationships", response_model=List[s_models.RelationshipOut])
def list_relationships(project_id: str, db: Session = Depends(get_db)):
    rels = db.query(models.Relationship).filter(models.Relationship.project_id == project_id).all()
    # Enrich source_name and target_name for clean client presentation
    for r in rels:
        if r.source_entity:
            r.source_name = r.source_entity.name
        if r.target_entity:
            r.target_name = r.target_entity.name
    return rels

@router.post("/projects/{project_id}/relationships", response_model=s_models.RelationshipOut)
def create_relationship(
    project_id: str,
    data: s_models.RelationshipCreate,
    db: Session = Depends(get_db)
):
    src = db.query(models.Entity).filter(models.Entity.id == data.source_entity_id, models.Entity.project_id == project_id).first()
    tgt = db.query(models.Entity).filter(models.Entity.id == data.target_entity_id, models.Entity.project_id == project_id).first()
    if not src or not tgt:
        raise HTTPException(status_code=400, detail="Invalid source or target entity ID for this project")

    # If source_quote not provided, generate default evidence
    source_quote = data.source_quote or f"Established relationship between {src.name} and {tgt.name}."
    source_ch_id = data.source_chapter_id or src.first_appearance_chapter_id

    rel = memory_service.save_relationship(
        db=db,
        project_id=project_id,
        source_entity_id=str(data.source_entity_id),
        target_entity_id=str(data.target_entity_id),
        relation_type=data.relation_type,
        source_chapter_id=str(source_ch_id) if source_ch_id else "",
        source_quote=source_quote,
        description=data.description
    )
    if not rel:
        raise HTTPException(status_code=400, detail="Failed to save relationship with valid evidence")

    rel.source_name = src.name
    rel.target_name = tgt.name
    return rel

@router.patch("/relationships/{relationship_id}", response_model=s_models.RelationshipOut)
def update_relationship(
    relationship_id: str,
    data: s_models.RelationshipUpdate,
    db: Session = Depends(get_db)
):
    rel = db.query(models.Relationship).filter(models.Relationship.id == relationship_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")

    if data.relation_type is not None and data.relation_type.strip():
        rel.relation_type = data.relation_type.strip()
    if data.description is not None:
        rel.description = data.description
    if data.source_quote is not None and data.source_quote.strip():
        rel.source_quote = data.source_quote.strip()

    db.commit()
    db.refresh(rel)
    if rel.source_entity:
        rel.source_name = rel.source_entity.name
    if rel.target_entity:
        rel.target_name = rel.target_entity.name
    return rel

