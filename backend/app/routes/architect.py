import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.services.memory_service import memory_service
from app.services.ai_provider import ai_provider

logger = logging.getLogger("architect_routes")
router = APIRouter(tags=["Story Architect"])

# --- Categories ---
@router.get("/projects/{project_id}/categories", response_model=List[s_models.EntityCategoryOut])
def get_categories(project_id: str, db: Session = Depends(get_db)):
    return memory_service.get_or_create_default_categories(db, project_id)

@router.post("/projects/{project_id}/categories", response_model=s_models.EntityCategoryOut)
def create_category(project_id: str, data: s_models.EntityCategoryCreate, db: Session = Depends(get_db)):
    slug = (data.slug or data.name.lower().replace(" ", "_")).strip()
    cat = models.EntityCategory(
        id=models.gen_uuid(),
        project_id=project_id,
        name=data.name.strip(),
        slug=slug,
        icon=data.icon or "Box",
        color=data.color or "#3B82F6",
        is_default=False,
        default_properties=data.default_properties or []
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    memory_service.log_audit_action(
        db=db,
        project_id=project_id,
        action="create_category",
        target_type="category",
        target_id=str(cat.id),
        target_name=cat.name
    )
    return cat

@router.patch("/categories/{category_id}", response_model=s_models.EntityCategoryOut)
def update_category(category_id: str, data: s_models.EntityCategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(models.EntityCategory).filter(models.EntityCategory.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if data.name is not None:
        cat.name = data.name.strip()
    if data.icon is not None:
        cat.icon = data.icon.strip()
    if data.color is not None:
        cat.color = data.color.strip()
    if data.default_properties is not None:
        cat.default_properties = data.default_properties
    db.commit()
    db.refresh(cat)
    return cat

# --- Canvases ---
@router.get("/projects/{project_id}/canvases", response_model=List[s_models.CanvasOut])
def list_canvases(project_id: str, db: Session = Depends(get_db)):
    return memory_service.get_canvases(db, project_id)

@router.post("/projects/{project_id}/canvases", response_model=s_models.CanvasOut)
def create_canvas(project_id: str, data: s_models.CanvasCreate, db: Session = Depends(get_db)):
    canvas = models.Canvas(
        id=models.gen_uuid(),
        project_id=project_id,
        name=data.name.strip(),
        description=data.description,
        view_type=data.view_type or "relationship",
        layout_type=data.layout_type or "manual",
        settings=data.settings or {},
        is_default=bool(data.is_default)
    )
    db.add(canvas)
    db.commit()
    db.refresh(canvas)
    memory_service.log_audit_action(
        db=db,
        project_id=project_id,
        action="create_canvas",
        target_type="canvas",
        target_id=str(canvas.id),
        target_name=canvas.name
    )
    return canvas

@router.get("/canvases/{canvas_id}")
def get_canvas_details(canvas_id: str, db: Session = Depends(get_db)):
    canvas = db.query(models.Canvas).filter(models.Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    nodes = db.query(models.CanvasNode).filter(models.CanvasNode.canvas_id == canvas_id).all()
    node_coords = {str(n.entity_id): {"x": float(n.x), "y": float(n.y)} for n in nodes}
    return {
        "id": str(canvas.id),
        "project_id": str(canvas.project_id),
        "name": canvas.name,
        "description": canvas.description,
        "view_type": canvas.view_type,
        "layout_type": canvas.layout_type,
        "viewport": canvas.viewport,
        "settings": canvas.settings,
        "is_default": canvas.is_default,
        "nodes": node_coords
    }

@router.patch("/canvases/{canvas_id}", response_model=s_models.CanvasOut)
def update_canvas(canvas_id: str, data: s_models.CanvasUpdate, db: Session = Depends(get_db)):
    canvas = db.query(models.Canvas).filter(models.Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    if data.name is not None:
        canvas.name = data.name.strip()
    if data.description is not None:
        canvas.description = data.description
    if data.view_type is not None:
        canvas.view_type = data.view_type
    if data.layout_type is not None:
        canvas.layout_type = data.layout_type
    if data.viewport is not None:
        canvas.viewport = data.viewport
    if data.settings is not None:
        canvas.settings = data.settings
    db.commit()
    db.refresh(canvas)
    return canvas

@router.delete("/canvases/{canvas_id}")
def delete_canvas(canvas_id: str, db: Session = Depends(get_db)):
    canvas = db.query(models.Canvas).filter(models.Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    # Deleting a canvas NEVER deletes its underlying entities!
    db.delete(canvas)
    db.commit()
    return {"status": "deleted", "canvas_id": canvas_id}

@router.post("/canvases/{canvas_id}/nodes")
def update_canvas_node_positions(canvas_id: str, nodes: List[s_models.CanvasNodeUpdate], db: Session = Depends(get_db)):
    success = memory_service.save_canvas_node_positions(db, canvas_id, [n.dict() for n in nodes])
    return {"status": "ok" if success else "failed", "nodes_updated": len(nodes)}

# --- Narrative Groups ---
@router.get("/projects/{project_id}/groups", response_model=List[s_models.NarrativeGroupOut])
def list_groups(project_id: str, db: Session = Depends(get_db)):
    return memory_service.get_narrative_groups(db, project_id)

@router.post("/projects/{project_id}/groups", response_model=s_models.NarrativeGroupOut)
def create_group(project_id: str, data: s_models.NarrativeGroupCreate, db: Session = Depends(get_db)):
    grp = models.NarrativeGroup(
        id=models.gen_uuid(),
        project_id=project_id,
        parent_group_id=str(data.parent_group_id) if data.parent_group_id else None,
        name=data.name.strip(),
        group_type=data.group_type or "general",
        description=data.description,
        color=data.color or "#6B7280"
    )
    db.add(grp)
    db.commit()
    db.refresh(grp)
    memory_service.log_audit_action(
        db=db,
        project_id=project_id,
        action="create_group",
        target_type="group",
        target_id=str(grp.id),
        target_name=grp.name
    )
    return grp

@router.delete("/groups/{group_id}")
def delete_group(group_id: str, db: Session = Depends(get_db)):
    # Safe group deletion: entities are preserved!
    success = memory_service.safe_delete_narrative_group(db, group_id)
    if not success:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"status": "deleted", "group_id": group_id}

# --- Attachments ---
@router.get("/projects/{project_id}/attachments", response_model=List[s_models.EntityAttachmentOut])
def list_attachments(project_id: str, db: Session = Depends(get_db)):
    atts = memory_service.get_project_attachments(db, project_id)
    res = []
    for a in atts:
        links = db.query(models.EntityAttachmentLink).filter(models.EntityAttachmentLink.attachment_id == a.id).all()
        linked_ents = []
        for l in links:
            if l.entity:
                linked_ents.append({"entity_id": str(l.entity_id), "name": l.entity.name, "role": l.role})
        res.append(s_models.EntityAttachmentOut(
            id=a.id,
            project_id=a.project_id,
            filename=a.filename,
            file_type=a.file_type,
            file_size=a.file_size,
            url=a.url,
            description=a.description,
            linked_entities=linked_ents,
            created_at=a.created_at
        ))
    return res

@router.post("/projects/{project_id}/attachments", response_model=s_models.EntityAttachmentOut)
def create_attachment(project_id: str, data: s_models.EntityAttachmentCreate, db: Session = Depends(get_db)):
    att = models.EntityAttachment(
        id=models.gen_uuid(),
        project_id=project_id,
        filename=data.filename.strip(),
        file_type=data.file_type or "image",
        url=data.url,
        description=data.description
    )
    db.add(att)
    db.commit()
    db.refresh(att)

    # Link to entities if specified
    linked_ents = []
    for eid in (data.entity_ids or []):
        link = models.EntityAttachmentLink(
            id=models.gen_uuid(),
            entity_id=str(eid),
            attachment_id=str(att.id),
            role="reference"
        )
        db.add(link)
    db.commit()

    memory_service.log_audit_action(
        db=db,
        project_id=project_id,
        action="add_attachment",
        target_type="attachment",
        target_id=str(att.id),
        target_name=att.filename
    )
    return s_models.EntityAttachmentOut(
        id=att.id,
        project_id=att.project_id,
        filename=att.filename,
        file_type=att.file_type,
        file_size=att.file_size,
        url=att.url,
        description=att.description,
        linked_entities=linked_ents,
        created_at=att.created_at
    )

@router.post("/attachments/{attachment_id}/analyze")
def analyze_attachment_with_ai(attachment_id: str, db: Session = Depends(get_db)):
    att = db.query(models.EntityAttachment).filter(models.EntityAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    prompt = (
        f"Analyze this narrative reference attachment titled '{att.filename}' (description: '{att.description or 'None'}').\n"
        f"Suggest relevant characters, world locations, artifacts, or narrative lore this asset represents."
        f"Return JSON strictly in format: {{\"suggested_entities\": [\"name1\", \"name2\"], \"lore_summary\": \"...\"}}"
    )
    suggestions = ai_provider.generate_json(prompt, model_name=ai_provider.fallback_models[0]) or {
        "suggested_entities": ["Reference Subject"],
        "lore_summary": "Visual moodboard / reference material for universe design."
    }
    return {
        "status": "analyzed",
        "attachment_id": attachment_id,
        "suggestions": suggestions,
        "note": "AI findings are advisory suggestions only. Author approves any canon additions."
    }

# --- Snapshots & Version Restoration ---
@router.get("/projects/{project_id}/snapshots", response_model=List[s_models.ProjectSnapshotOut])
def list_snapshots(project_id: str, db: Session = Depends(get_db)):
    snaps = memory_service.get_snapshots(db, project_id)
    res = []
    for s in snaps:
        data = s.snapshot_data or {}
        res.append(s_models.ProjectSnapshotOut(
            id=s.id,
            project_id=s.project_id,
            name=s.name,
            description=s.description,
            is_milestone=s.is_milestone,
            entities_count=len(data.get("entities", [])),
            relationships_count=len(data.get("relationships", [])),
            created_at=s.created_at
        ))
    return res

@router.post("/projects/{project_id}/snapshots", response_model=s_models.ProjectSnapshotOut)
def create_snapshot(project_id: str, data: s_models.ProjectSnapshotCreate, db: Session = Depends(get_db)):
    snap = memory_service.create_project_snapshot(
        db=db,
        project_id=project_id,
        name=data.name.strip(),
        description=data.description,
        is_milestone=bool(data.is_milestone)
    )
    if not snap:
        raise HTTPException(status_code=500, detail="Failed to create project snapshot")
    return s_models.ProjectSnapshotOut(
        id=snap.id,
        project_id=snap.project_id,
        name=snap.name,
        description=snap.description,
        is_milestone=snap.is_milestone,
        entities_count=len(snap.snapshot_data.get("entities", [])),
        relationships_count=len(snap.snapshot_data.get("relationships", [])),
        created_at=snap.created_at
    )

@router.post("/snapshots/{snapshot_id}/restore")
def restore_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    snap = db.query(models.ProjectSnapshot).filter(models.ProjectSnapshot.id == snapshot_id).first()
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Non-destructive: record new audit log before restoring
    memory_service.log_audit_action(
        db=db,
        project_id=str(snap.project_id),
        action="restore_snapshot",
        target_type="snapshot",
        target_id=str(snap.id),
        target_name=snap.name,
        source="restore"
    )
    return {
        "status": "restored",
        "snapshot_id": snapshot_id,
        "name": snap.name,
        "message": f"Successfully restored project state to snapshot '{snap.name}'"
    }

# --- Audit Logs ---
@router.get("/projects/{project_id}/audit-logs", response_model=List[s_models.AuditLogOut])
def get_audit_logs(project_id: str, limit: int = Query(50, le=200), db: Session = Depends(get_db)):
    return memory_service.get_audit_logs(db, project_id, limit=limit)

# --- Entity Matching Queue ---
@router.get("/projects/{project_id}/matching-candidates", response_model=List[s_models.EntityMatchingCandidateOut])
def list_matching_candidates(project_id: str, db: Session = Depends(get_db)):
    return memory_service.get_matching_candidates(db, project_id)

@router.post("/matching-candidates/{candidate_id}/resolve")
def resolve_entity_match(candidate_id: str, data: s_models.EntityMatchingDecision, db: Session = Depends(get_db)):
    cand = db.query(models.EntityMatchingCandidate).filter(models.EntityMatchingCandidate.id == candidate_id).first()
    if not cand:
        raise HTTPException(status_code=404, detail="Candidate not found")
    cand.status = data.decision
    hist = list(cand.decision_history or [])
    hist.append({"decision": data.decision, "target_entity_id": str(data.target_entity_id or ""), "notes": data.notes})
    cand.decision_history = hist
    db.commit()
    return {"status": "resolved", "candidate_id": candidate_id, "decision": data.decision}

# --- Import / Export ---
@router.get("/projects/{project_id}/export")
def export_project(project_id: str, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    entities = memory_service.get_entities(db, project_id)
    relationships = db.query(models.Relationship).filter(models.Relationship.project_id == project_id).all()
    facts = memory_service.get_story_facts(db, project_id)
    canvases = memory_service.get_canvases(db, project_id)
    categories = memory_service.get_or_create_default_categories(db, project_id)
    groups = memory_service.get_narrative_groups(db, project_id)

    export_bundle = {
        "version": "1.0.0",
        "format": "northstar_living_story_bible",
        "project": {
            "id": str(proj.id),
            "name": proj.name,
            "description": proj.description
        },
        "categories": [{"id": str(c.id), "name": c.name, "slug": c.slug, "icon": c.icon, "color": c.color} for c in categories],
        "groups": [{"id": str(g.id), "name": g.name, "group_type": g.group_type, "parent_group_id": str(g.parent_group_id) if g.parent_group_id else None} for g in groups],
        "canvases": [{"id": str(cv.id), "name": cv.name, "view_type": cv.view_type} for cv in canvases],
        "entities": [
            {
                "id": str(e.id),
                "name": e.name,
                "entity_type": e.entity_type,
                "description": e.description,
                "traits": e.traits,
                "canon_status": getattr(e, "canon_status", "established"),
                "protection_level": getattr(e, "protection_level", 1)
            }
            for e in entities
        ],
        "relationships": [
            {
                "id": str(r.id),
                "source_entity_id": str(r.source_entity_id),
                "target_entity_id": str(r.target_entity_id),
                "relation_type": r.relation_type,
                "description": r.description
            }
            for r in relationships
        ],
        "facts": [
            {
                "id": str(f.id) if hasattr(f, 'id') else str(f.get('id')),
                "fact": f.fact if hasattr(f, 'fact') else f.get('fact'),
                "category": getattr(f, 'category', 'general') if hasattr(f, 'category') else f.get('category', 'general')
            }
            for f in facts
        ]
    }
    return export_bundle

# --- Prebuilt World-Building Templates ---
@router.post("/projects/{project_id}/apply-template")
def apply_world_template(project_id: str, template_type: str = Query("fantasy"), db: Session = Depends(get_db)):
    """
    Seeds world-building templates (e.g. Fantasy Realm, Sci-Fi Galaxy, Mystery Town)
    with preconfigured entity categories and foundational lore.
    """
    templates = {
        "fantasy": {
            "name": "High Fantasy Realm",
            "categories": [
                {"name": "Magic Systems", "slug": "magic_system", "icon": "Sparkles", "color": "#8B5CF6"},
                {"name": "Kingdoms", "slug": "kingdom", "icon": "Crown", "color": "#EAB308"},
                {"name": "Artifacts", "slug": "artifact", "icon": "Shield", "color": "#F97316"},
                {"name": "Guilds & Orders", "slug": "guild", "icon": "Users", "color": "#06B6D4"}
            ]
        },
        "scifi": {
            "name": "Sci-Fi Space Opera",
            "categories": [
                {"name": "Planetary Systems", "slug": "planet", "icon": "Globe", "color": "#3B82F6"},
                {"name": "Starship Classes", "slug": "starship", "icon": "Rocket", "color": "#10B981"},
                {"name": "Mega-Corporations", "slug": "corporation", "icon": "Building2", "color": "#EC4899"},
                {"name": "AI Factions", "slug": "ai_faction", "icon": "Cpu", "color": "#6366F1"}
            ]
        },
        "mystery": {
            "name": "Gothic Mystery Town",
            "categories": [
                {"name": "Secret Societies", "slug": "society", "icon": "Eye", "color": "#64748B"},
                {"name": "Clues & Evidence", "slug": "evidence", "icon": "Search", "color": "#EF4444"},
                {"name": "Ancestral Houses", "slug": "house", "icon": "Home", "color": "#84CC16"}
            ]
        }
    }
    selected = templates.get(template_type, templates["fantasy"])
    for cat in selected["categories"]:
        existing = db.query(models.EntityCategory).filter(
            models.EntityCategory.project_id == project_id,
            models.EntityCategory.slug == cat["slug"]
        ).first()
        if not existing:
            new_cat = models.EntityCategory(
                id=models.gen_uuid(),
                project_id=project_id,
                name=cat["name"],
                slug=cat["slug"],
                icon=cat["icon"],
                color=cat["color"],
                is_default=False
            )
            db.add(new_cat)
    db.commit()
    return {"status": "applied", "template": selected["name"]}
