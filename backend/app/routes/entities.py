from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models

router = APIRouter(tags=["Entities"])

@router.get("/projects/{project_id}/entities", response_model=List[s_models.EntityOut])
def list_entities(project_id: str, db: Session = Depends(get_db)):
    entities = db.query(models.Entity).filter(
        models.Entity.project_id == project_id
    ).order_by(models.Entity.name.asc()).all()
    return entities

@router.post("/projects/{project_id}/entities", response_model=s_models.EntityOut)
def create_entity(project_id: str, data: s_models.EntityCreate, db: Session = Depends(get_db)):
    entity = models.Entity(
        project_id=project_id,
        name=data.name,
        entity_type=data.entity_type,
        description=data.description,
        traits=data.traits,
        first_appearance_chapter=data.first_appearance_chapter or 1
    )
    db.add(entity)
    db.commit()
    db.refresh(entity)
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

    if data.name is not None:
        entity.name = data.name
    if data.entity_type is not None:
        entity.entity_type = data.entity_type
    if data.description is not None:
        entity.description = data.description
    if data.traits is not None:
        entity.traits = data.traits
    if data.first_appearance_chapter is not None:
        entity.first_appearance_chapter = data.first_appearance_chapter

    db.commit()
    db.refresh(entity)
    return entity
