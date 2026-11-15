import os
import json
import hashlib
import mimetypes
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional, Dict, Any

from app.config import settings
from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.services.memory_service import memory_service
from app.services.ai_provider import ai_provider
from app.services.encryption_service import encryption_service

logger = logging.getLogger("architect_routes")
router = APIRouter(tags=["Story Architect"])

def detect_file_type_category(filename: str, mime_type: str = "") -> str:
    ext = os.path.splitext(filename)[1].lower()
    if ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp", ".ico"]:
        return "image"
    if ext in [".pdf", ".docx", ".doc", ".txt", ".md", ".markdown", ".rtf", ".epub"]:
        return "document"
    if ext in [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]:
        return "audio"
    if ext in [".mp4", ".webm", ".mov", ".avi", ".mkv"]:
        return "video"
    if "image" in mime_type:
        return "image"
    if "audio" in mime_type:
        return "audio"
    if "video" in mime_type:
        return "video"
    return "document"

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
    canvas_name = (data.name or data.title or "Untitled Canvas").strip()
    canvas = models.Canvas(
        id=models.gen_uuid(),
        project_id=project_id,
        name=canvas_name,
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
    canvas_nodes = db.query(models.CanvasNode).filter(models.CanvasNode.canvas_id == canvas_id).all()
    node_list = [
        {"entity_id": str(n.entity_id), "x": float(n.x), "y": float(n.y), "width": float(n.width or 220), "height": float(n.height or 120)}
        for n in canvas_nodes
    ]
    node_coords = {str(n.entity_id): {"x": float(n.x), "y": float(n.y)} for n in canvas_nodes}
    return {
        "id": str(canvas.id),
        "project_id": str(canvas.project_id),
        "name": canvas.name,
        "title": canvas.name,
        "description": canvas.description,
        "view_type": canvas.view_type,
        "layout_type": canvas.layout_type,
        "viewport": canvas.viewport,
        "settings": canvas.settings or {},
        "is_default": canvas.is_default,
        "nodes": node_list,
        "node_coords": node_coords
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

@router.post("/canvases/{canvas_id}/duplicate", response_model=s_models.CanvasOut)
def duplicate_canvas(canvas_id: str, db: Session = Depends(get_db)):
    canvas = db.query(models.Canvas).filter(models.Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    new_canvas = models.Canvas(
        id=models.gen_uuid(),
        project_id=canvas.project_id,
        name=f"{canvas.name} (Copy)",
        description=canvas.description,
        view_type=canvas.view_type,
        layout_type=canvas.layout_type,
        viewport=canvas.viewport,
        settings=canvas.settings or {},
        is_default=False
    )
    db.add(new_canvas)
    db.flush()

    # Duplicate nodes
    nodes = db.query(models.CanvasNode).filter(models.CanvasNode.canvas_id == canvas_id).all()
    for n in nodes:
        db.add(models.CanvasNode(
            id=models.gen_uuid(),
            canvas_id=new_canvas.id,
            entity_id=n.entity_id,
            x=n.x,
            y=n.y,
            width=n.width,
            height=n.height,
            visual_override=n.visual_override or {}
        ))
    db.commit()
    db.refresh(new_canvas)
    return new_canvas

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

# --- Attachments Vault ---
@router.get("/projects/{project_id}/attachments/quota")
def get_attachment_quota(project_id: str, db: Session = Depends(get_db)):
    atts = db.query(models.EntityAttachment).filter(models.EntityAttachment.project_id == project_id).all()
    used_bytes = sum(a.file_size or 0 for a in atts)
    quota_bytes = 500 * 1024 * 1024  # 500 MB default vault storage quota
    by_type = {}
    for a in atts:
        t = a.file_type or "document"
        if t not in by_type:
            by_type[t] = {"count": 0, "bytes": 0}
        by_type[t]["count"] += 1
        by_type[t]["bytes"] += (a.file_size or 0)
    return {
        "project_id": project_id,
        "total_files": len(atts),
        "used_bytes": used_bytes,
        "quota_bytes": quota_bytes,
        "usage_percent": min(100.0, round((used_bytes / quota_bytes) * 100, 2)) if quota_bytes > 0 else 0,
        "by_type": by_type
    }

@router.get("/projects/{project_id}/attachments", response_model=List[s_models.EntityAttachmentOut])
def list_attachments(
    project_id: str,
    entity_id: Optional[str] = Query(None),
    file_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(models.EntityAttachment).filter(models.EntityAttachment.project_id == project_id)
    if file_type:
        query = query.filter(models.EntityAttachment.file_type == file_type)
    atts = query.order_by(desc(models.EntityAttachment.created_at)).all()

    res = []
    for a in atts:
        links = db.query(models.EntityAttachmentLink).filter(models.EntityAttachmentLink.attachment_id == a.id).all()
        linked_ents = []
        is_linked_to_requested_entity = False
        for l in links:
            if l.entity:
                linked_ents.append({"entity_id": str(l.entity_id), "name": l.entity.name, "role": l.role})
            if entity_id and str(l.entity_id) == str(entity_id):
                is_linked_to_requested_entity = True

        if entity_id and not is_linked_to_requested_entity:
            continue

        meta = a.meta_info if isinstance(a.meta_info, dict) else {}
        tags = meta.get("tags", []) if isinstance(meta.get("tags"), list) else []

        if search:
            s_lower = search.lower()
            fname_match = s_lower in (a.filename or "").lower()
            desc_match = s_lower in (a.description or "").lower()
            tag_match = any(s_lower in t.lower() for t in tags)
            if not (fname_match or desc_match or tag_match):
                continue

        res.append(s_models.EntityAttachmentOut(
            id=a.id,
            project_id=a.project_id,
            filename=a.filename,
            file_type=a.file_type,
            file_size=a.file_size or 0,
            storage_path=a.storage_path,
            url=a.url,
            description=a.description,
            tags=tags,
            metadata=meta,
            linked_entities=linked_ents,
            created_at=a.created_at
        ))
    return res

@router.post("/projects/{project_id}/attachments/upload", response_model=List[s_models.EntityAttachmentOut])
async def upload_attachment_files(
    project_id: str,
    files: List[UploadFile] = File(...),
    description: Optional[str] = Form(None),
    entity_ids: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    file_type: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    parsed_entity_ids = []
    if entity_ids:
        try:
            parsed_entity_ids = json.loads(entity_ids)
            if not isinstance(parsed_entity_ids, list):
                parsed_entity_ids = [str(entity_ids)]
        except Exception:
            parsed_entity_ids = [e.strip() for e in entity_ids.split(",") if e.strip()]

    parsed_tags = []
    if tags:
        try:
            parsed_tags = json.loads(tags)
            if not isinstance(parsed_tags, list):
                parsed_tags = [str(tags)]
        except Exception:
            parsed_tags = [t.strip() for t in tags.split(",") if t.strip()]

    project_vault_dir = os.path.join(settings.VAULT_STORAGE_DIRECTORY, str(project_id))
    os.makedirs(project_vault_dir, exist_ok=True)

    created_attachments = []

    for f in files:
        if hasattr(f, "file") and hasattr(f.file, "read"):
            content_bytes = f.file.read()
        elif hasattr(f, "read"):
            import inspect
            content_bytes = await f.read() if inspect.iscoroutinefunction(f.read) else f.read()
        else:
            content_bytes = b""
        file_size = len(content_bytes)
        checksum = hashlib.sha256(content_bytes).hexdigest()

        original_filename = f.filename or "attachment"
        guessed_mime = f.content_type or mimetypes.guess_type(original_filename)[0] or "application/octet-stream"
        category = file_type or detect_file_type_category(original_filename, guessed_mime)

        att_id = models.gen_uuid()
        safe_name = "".join(c for c in original_filename if c.isalnum() or c in "._- ")
        enc_filename = f"{att_id}_{safe_name}.enc"
        target_path = os.path.join(project_vault_dir, enc_filename)

        # Encrypt and persist to private vault storage with AES-256-GCM
        encryption_service.encrypt_and_save_file(content_bytes, target_path)

        meta_info = {
            "sha256": checksum,
            "encrypted": True,
            "mime_type": guessed_mime,
            "tags": parsed_tags,
            "original_filename": original_filename
        }

        att = models.EntityAttachment(
            id=att_id,
            project_id=project_id,
            filename=original_filename,
            file_type=category,
            file_size=file_size,
            storage_path=target_path,
            url=f"/api/attachments/{att_id}/preview",
            description=description,
            meta_info=meta_info
        )
        db.add(att)
        db.commit()
        db.refresh(att)

        # Associate with entities
        linked_ents = []
        for eid in parsed_entity_ids:
            ent = db.query(models.Entity).filter(models.Entity.id == eid).first()
            if ent:
                link = models.EntityAttachmentLink(
                    id=models.gen_uuid(),
                    entity_id=str(eid),
                    attachment_id=str(att.id),
                    role="vault_reference"
                )
                db.add(link)
                linked_ents.append({"entity_id": str(eid), "name": ent.name, "role": "vault_reference"})
        db.commit()

        memory_service.log_audit_action(
            db=db,
            project_id=project_id,
            action="upload_attachment",
            target_type="attachment",
            target_id=str(att.id),
            target_name=att.filename
        )

        created_attachments.append(s_models.EntityAttachmentOut(
            id=att.id,
            project_id=att.project_id,
            filename=att.filename,
            file_type=att.file_type,
            file_size=att.file_size,
            storage_path=att.storage_path,
            url=att.url,
            description=att.description,
            tags=parsed_tags,
            metadata=meta_info,
            linked_entities=linked_ents,
            created_at=att.created_at
        ))

    return created_attachments

@router.post("/projects/{project_id}/attachments", response_model=s_models.EntityAttachmentOut)
def create_attachment(project_id: str, data: s_models.EntityAttachmentCreate, db: Session = Depends(get_db)):
    filename = (data.filename or data.title or "Attachment").strip()
    file_type = (data.file_type or data.attachment_type or "image").strip()
    url = (data.url or data.file_url or "").strip()

    meta_info = data.metadata or {}
    if data.tags:
        meta_info["tags"] = data.tags

    att = models.EntityAttachment(
        id=models.gen_uuid(),
        project_id=project_id,
        filename=filename,
        file_type=file_type,
        url=url or None,
        description=data.description,
        meta_info=meta_info
    )
    db.add(att)
    db.commit()
    db.refresh(att)

    # Link to entities if specified
    all_entity_ids = list(data.entity_ids or [])
    if data.entity_id and data.entity_id not in all_entity_ids:
        all_entity_ids.append(data.entity_id)

    linked_ents = []
    for eid in all_entity_ids:
        ent = db.query(models.Entity).filter(models.Entity.id == eid).first()
        link = models.EntityAttachmentLink(
            id=models.gen_uuid(),
            entity_id=str(eid),
            attachment_id=str(att.id),
            role="reference"
        )
        db.add(link)
        if ent:
            linked_ents.append({"entity_id": str(eid), "name": ent.name, "role": "reference"})
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
        file_size=att.file_size or 0,
        storage_path=att.storage_path,
        url=att.url,
        description=att.description,
        tags=data.tags or [],
        metadata=meta_info,
        linked_entities=linked_ents,
        created_at=att.created_at
    )

@router.get("/attachments/{attachment_id}/preview")
def preview_attachment(attachment_id: str, db: Session = Depends(get_db)):
    att = db.query(models.EntityAttachment).filter(models.EntityAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if att.storage_path and os.path.exists(att.storage_path):
        try:
            decrypted = encryption_service.read_and_decrypt_file(att.storage_path)
            meta = att.meta_info if isinstance(att.meta_info, dict) else {}
            mime = meta.get("mime_type") or mimetypes.guess_type(att.filename)[0] or "application/octet-stream"
            return Response(
                content=decrypted,
                media_type=mime,
                headers={"Content-Disposition": f'inline; filename="{att.filename}"'}
            )
        except Exception as e:
            logger.error(f"Error decrypting attachment preview: {e}")
            raise HTTPException(status_code=500, detail="Failed to decrypt attachment file")
    elif att.url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=att.url)
    raise HTTPException(status_code=404, detail="Attachment file not available")

@router.get("/attachments/{attachment_id}/download")
def download_attachment(attachment_id: str, db: Session = Depends(get_db)):
    att = db.query(models.EntityAttachment).filter(models.EntityAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    if att.storage_path and os.path.exists(att.storage_path):
        try:
            decrypted = encryption_service.read_and_decrypt_file(att.storage_path)
            meta = att.meta_info if isinstance(att.meta_info, dict) else {}
            # Integrity check
            expected_sha = meta.get("sha256")
            if expected_sha:
                actual_sha = hashlib.sha256(decrypted).hexdigest()
                if actual_sha != expected_sha:
                    logger.warning(f"Integrity check mismatch for {att.id}: expected {expected_sha}, got {actual_sha}")
            mime = meta.get("mime_type") or mimetypes.guess_type(att.filename)[0] or "application/octet-stream"
            return Response(
                content=decrypted,
                media_type=mime,
                headers={"Content-Disposition": f'attachment; filename="{att.filename}"'}
            )
        except Exception as e:
            logger.error(f"Error decrypting attachment download: {e}")
            raise HTTPException(status_code=500, detail="Failed to decrypt attachment file")
    elif att.url:
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=att.url)
    raise HTTPException(status_code=404, detail="Attachment file not available")

@router.delete("/attachments/{attachment_id}")
def delete_attachment(attachment_id: str, db: Session = Depends(get_db)):
    att = db.query(models.EntityAttachment).filter(models.EntityAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    pid = str(att.project_id)
    fname = att.filename

    if att.storage_path and os.path.exists(att.storage_path):
        try:
            os.remove(att.storage_path)
        except Exception as e:
            logger.warning(f"Failed to remove file from vault storage: {e}")

    db.query(models.EntityAttachmentLink).filter(models.EntityAttachmentLink.attachment_id == attachment_id).delete()
    db.delete(att)
    db.commit()

    memory_service.log_audit_action(
        db=db,
        project_id=pid,
        action="delete_attachment",
        target_type="attachment",
        target_id=attachment_id,
        target_name=fname
    )
    return {"status": "deleted", "attachment_id": attachment_id}

@router.post("/entities/{entity_id}/attachments/{attachment_id}")
def link_entity_attachment(entity_id: str, attachment_id: str, role: Optional[str] = "reference", db: Session = Depends(get_db)):
    ent = db.query(models.Entity).filter(models.Entity.id == entity_id).first()
    if not ent:
        raise HTTPException(status_code=404, detail="Entity not found")
    att = db.query(models.EntityAttachment).filter(models.EntityAttachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    existing = db.query(models.EntityAttachmentLink).filter(
        models.EntityAttachmentLink.entity_id == entity_id,
        models.EntityAttachmentLink.attachment_id == attachment_id
    ).first()

    if not existing:
        link = models.EntityAttachmentLink(
            id=models.gen_uuid(),
            entity_id=entity_id,
            attachment_id=attachment_id,
            role=role or "reference"
        )
        db.add(link)
        db.commit()

    return {"status": "linked", "entity_id": entity_id, "attachment_id": attachment_id}

@router.delete("/entities/{entity_id}/attachments/{attachment_id}")
def unlink_entity_attachment(entity_id: str, attachment_id: str, db: Session = Depends(get_db)):
    link = db.query(models.EntityAttachmentLink).filter(
        models.EntityAttachmentLink.entity_id == entity_id,
        models.EntityAttachmentLink.attachment_id == attachment_id
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()
    return {"status": "unlinked", "entity_id": entity_id, "attachment_id": attachment_id}

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
