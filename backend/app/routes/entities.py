from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.services.memory_service import memory_service

router = APIRouter(tags=["Entities & Relationships"])

@router.get("/projects/{project_id}/entities")
def list_entities(
    project_id: str,
    entity_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        return memory_service.get_entities(
            db=db,
            project_id=project_id,
            entity_type=entity_type,
            search_query=search
        )
    except Exception as e:
        logger.error(f"Error in list_entities: {e}")
        return []

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
    if data.category_id is not None:
        entity.category_id = str(data.category_id) if data.category_id else None
    if data.description is not None:
        entity.description = data.description
    if data.traits is not None:
        entity.traits = data.traits
    if data.first_appearance_chapter is not None:
        entity.first_appearance_chapter = data.first_appearance_chapter
    if data.canon_status is not None:
        entity.canon_status = data.canon_status
    if data.protection_level is not None:
        entity.protection_level = data.protection_level
    if data.provenance is not None:
        entity.provenance = data.provenance
    if data.custom_properties is not None:
        entity.custom_properties = data.custom_properties
    if data.is_archived is not None:
        entity.is_archived = data.is_archived

    db.commit()
    db.refresh(entity)

    memory_service.log_audit_action(
        db=db,
        project_id=str(entity.project_id),
        action="update_entity",
        target_type="entity",
        target_id=str(entity.id),
        target_name=entity.name,
        new_value={"canon_status": entity.canon_status, "protection_level": entity.protection_level}
    )
    return entity

@router.delete("/entities/{entity_id}")
def delete_entity(entity_id: str, db: Session = Depends(get_db)):
    entity = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    if entity.protection_level >= 3:
        raise HTTPException(status_code=403, detail="Entity is Locked or Immutable. Unlock before deletion.")

    pid = str(entity.project_id)
    name = entity.name
    db.delete(entity)
    db.commit()

    memory_service.log_audit_action(
        db=db,
        project_id=pid,
        action="delete_entity",
        target_type="entity",
        target_id=entity_id,
        target_name=name
    )
    return {"status": "deleted", "entity_id": entity_id}

@router.get("/entities/{entity_id}/resolved-properties")
def get_resolved_entity_properties(entity_id: str, db: Session = Depends(get_db)):
    ent = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")

    own_props = dict(ent.custom_properties) if isinstance(ent.custom_properties, dict) else {}

    # Check parent via custom_properties._parent_id or hierarchical relationship
    parent_id = own_props.get("_parent_id")
    if not parent_id:
        parent_rel = db.query(models.Relationship).filter(
            models.Relationship.target_entity_id == entity_id,
            models.Relationship.relation_type.in_([
                "Parent", "Part of", "Located in", "Sub-location of",
                "Sub-faction of", "Branch of", "Member of", "Child of"
            ])
        ).first()
        if parent_rel:
            parent_id = str(parent_rel.source_entity_id)

    inherited_props = {}
    parent_name = None
    if parent_id:
        parent_ent = db.query(models.Entity).filter(models.Entity.id == parent_id).first()
        if parent_ent and isinstance(parent_ent.custom_properties, dict):
            parent_name = parent_ent.name
            for k, v in parent_ent.custom_properties.items():
                # Skip internal meta keys
                if not str(k).startswith("_"):
                    inherited_props[k] = v

    merged = dict(inherited_props)
    merged.update(own_props)

    return {
        "entity_id": entity_id,
        "entity_name": ent.name,
        "parent_id": parent_id,
        "parent_name": parent_name,
        "own_properties": own_props,
        "inherited_properties": inherited_props,
        "merged_properties": merged
    }

# --- Relationships Endpoints (Roadmap Section 10) ---

@router.get("/projects/{project_id}/relationships")
def list_relationships(project_id: str, db: Session = Depends(get_db)):
    try:
        rels = db.query(models.Relationship).filter(models.Relationship.project_id == project_id).all()
        for r in rels:
            if getattr(r, "source_entity", None):
                r.source_name = r.source_entity.name
            if getattr(r, "target_entity", None):
                r.target_name = r.target_entity.name
        return rels
    except Exception as e:
        logger.error(f"Error in list_relationships: {e}")
        return []

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
        source_chapter_id=str(source_ch_id) if source_ch_id else None,
        source_quote=source_quote,
        description=data.description,
        direction=data.direction or "directed",
        custom_properties=data.custom_properties or {},
        provenance=data.provenance or "manual",
        protection_level=data.protection_level or 1
    )
    if not rel:
        raise HTTPException(status_code=400, detail="Failed to save relationship")

    rel_id = getattr(rel, 'id', None) or (rel.get('id') if isinstance(rel, dict) else None)
    memory_service.log_audit_action(
        db=db,
        project_id=project_id,
        action="create_relationship",
        target_type="relationship",
        target_id=str(rel_id) if rel_id else None,
        target_name=f"{src.name} -> {tgt.name}",
        new_value={
            "relation_type": data.relation_type,
            "source": src.name,
            "target": tgt.name,
            "source_entity_id": str(data.source_entity_id),
            "target_entity_id": str(data.target_entity_id),
        }
    )

    if isinstance(rel, dict):
        rel["source_name"] = src.name
        rel["target_name"] = tgt.name
        return rel

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

@router.delete("/relationships/{relationship_id}")
def delete_relationship(relationship_id: str, db: Session = Depends(get_db)):
    rel = db.query(models.Relationship).filter(models.Relationship.id == relationship_id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    pid = str(rel.project_id)
    db.delete(rel)
    db.commit()
    memory_service.log_audit_action(
        db=db,
        project_id=pid,
        action="delete_relationship",
        target_type="relationship",
        target_id=relationship_id
    )
    return {"status": "deleted", "relationship_id": relationship_id}

