from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.agents.orchestrator import orchestrator
from app.services.document_parser import document_parser
from app.services.vector_service import vector_service
from app.routes.auth import get_optional_user, require_project_access

router = APIRouter(tags=["Chapters"])

@router.get("/projects/{project_id}/chapters", response_model=List[s_models.ChapterOut])
def list_chapters(
    project_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    require_project_access(project_id, current_user, db, require_write=False)
    chapters = db.query(models.Chapter).filter(
        models.Chapter.project_id == project_id
    ).order_by(models.Chapter.chapter_number.asc()).all()
    return chapters

@router.post("/projects/{project_id}/chapters", response_model=s_models.ChapterOut)
def create_chapter(
    project_id: str,
    data: s_models.ChapterCreate,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    require_project_access(project_id, current_user, db, require_write=True)
    chapter = models.Chapter(
        project_id=project_id,
        chapter_number=data.chapter_number,
        title=data.title,
        content=data.content,
        word_count=len(data.content.split())
    )
    db.add(chapter)
    db.commit()
    db.refresh(chapter)

    # Chunk passages and index
    passages = document_parser.chunk_into_passages(chapter.content)
    all_p = []
    for p in passages:
        db_p = models.Passage(
            project_id=project_id,
            chapter_id=chapter.id,
            passage_index=p["passage_index"],
            content=p["content"],
            char_start=p["char_start"],
            char_end=p["char_end"]
        )
        db.add(db_p)
        db.commit()
        db.refresh(db_p)
        all_p.append({
            "id": db_p.id,
            "chapter_id": chapter.id,
            "chapter_number": chapter.chapter_number,
            "passage_index": p["passage_index"],
            "content": p["content"]
        })

    vector_service.index_passages(project_id, all_p)
    return chapter

@router.get("/chapters/{chapter_id}", response_model=s_models.ChapterOut)
def get_chapter(
    chapter_id: str,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    require_project_access(ch.project_id, current_user, db, require_write=False)
    return ch

@router.put("/chapters/{chapter_id}", response_model=s_models.ChapterOut)
@router.patch("/chapters/{chapter_id}", response_model=s_models.ChapterOut)
def update_chapter(
    chapter_id: str,
    data: s_models.ChapterUpdate,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    require_project_access(ch.project_id, current_user, db, require_write=True)

    if data.title is not None:
        ch.title = data.title
    if data.content is not None:
        ch.content = data.content
        ch.word_count = len(data.content.split())

        # Update passages
        db.query(models.Passage).filter(models.Passage.chapter_id == ch.id).delete()
        passages = document_parser.chunk_into_passages(ch.content)
        all_p = []
        for p in passages:
            db_p = models.Passage(
                project_id=ch.project_id,
                chapter_id=ch.id,
                passage_index=p["passage_index"],
                content=p["content"],
                char_start=p["char_start"],
                char_end=p["char_end"]
            )
            db.add(db_p)
            db.commit()
            db.refresh(db_p)
            all_p.append({
                "id": db_p.id,
                "chapter_id": ch.id,
                "chapter_number": ch.chapter_number,
                "passage_index": p["passage_index"],
                "content": p["content"]
            })
        vector_service.index_passages(ch.project_id, all_p)

    db.commit()
    db.refresh(ch)
    return ch

from app.services.memory_service import memory_service
import logging

logger = logging.getLogger("chapters_route")

@router.post("/chapters/{chapter_id}/analyze")
def analyze_chapter(
    chapter_id: str,
    body: Optional[s_models.AnalyzeChapterRequest] = None,
    current_user: Optional[models.User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    require_project_access(ch.project_id, current_user, db, require_write=True)

    # If updated content was sent in request body, persist it
    if body and body.content is not None and body.content.strip():
        ch.content = body.content
        ch.word_count = len(body.content.split())
        db.commit()
        db.refresh(ch)

        # Re-chunk passages and re-index in vector service
        try:
            passages = document_parser.chunk_into_passages(ch.content)
            db.query(models.Passage).filter(
                models.Passage.project_id == ch.project_id,
                models.Passage.chapter_id == ch.id
            ).delete()
            all_p = []
            for p in passages:
                db_p = models.Passage(
                    project_id=ch.project_id,
                    chapter_id=ch.id,
                    passage_index=p["passage_index"],
                    content=p["content"],
                    char_start=p["char_start"],
                    char_end=p["char_end"]
                )
                db.add(db_p)
                db.flush()
                all_p.append({
                    "id": db_p.id,
                    "chapter_id": ch.id,
                    "chapter_number": ch.chapter_number,
                    "passage_index": p["passage_index"],
                    "content": p["content"]
                })
            db.commit()
            vector_service.index_passages(ch.project_id, all_p)
        except Exception as e:
            logger.warning(f"Re-indexing edited chapter passages error: {e}")

    # Delete existing "unresolved" / "open" models.ContinuityIssue rows for chapter_id == ch.id
    try:
        db.query(models.ContinuityIssue).filter(
            models.ContinuityIssue.project_id == ch.project_id,
            models.ContinuityIssue.chapter_id == ch.id,
            models.ContinuityIssue.status.in_(["unresolved", "open"])
        ).delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        logger.warning(f"Clearing prior unresolved issues error: {e}")

    # 1. Extract and update canon facts for this chapter
    try:
        orchestrator._extract_and_persist_chapter_memory(db, ch.project_id, ch, fast_mode=False)
    except Exception as e:
        logger.warning(f"Chapter memory extraction error (non-fatal): {e}")

    # 2. Run Continuity Guardian analysis for this chapter
    new_detected = orchestrator.analyze_chapter_continuity(
        db=db,
        project_id=ch.project_id,
        chapter_id=ch.id,
        skip_llm=False
    )

    # If this is Chapter 1 and project has subsequent chapters, evaluate subsequent chapters against Chapter 1 canon
    # so that contradictions across the story are immediately revealed to the author
    if ch.chapter_number == 1:
        subsequent_chapters = db.query(models.Chapter).filter(
            models.Chapter.project_id == ch.project_id,
            models.Chapter.chapter_number > 1
        ).order_by(models.Chapter.chapter_number.asc()).all()
        for sub_ch in subsequent_chapters:
            sub_issues = orchestrator.analyze_chapter_continuity(
                db=db,
                project_id=ch.project_id,
                chapter_id=sub_ch.id,
                skip_llm=False
            )
            new_detected.extend(sub_issues)

    # Fetch all project issues from memory_service to update the full Guardian panel
    all_project_issues = memory_service.get_continuity_issues(db=db, project_id=ch.project_id)
    entities = memory_service.get_entities(db=db, project_id=ch.project_id)

    return {
        "status": "analyzed",
        "chapter_id": str(ch.id),
        "chapter_number": ch.chapter_number,
        "issues_found": len(all_project_issues),
        "new_issues_count": len(new_detected),
        "issues": all_project_issues,
        "entities_extracted": len(entities)
    }
