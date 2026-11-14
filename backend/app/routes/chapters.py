from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database.connection import get_db
from app.database import models
from app.schemas import models as s_models
from app.agents.orchestrator import orchestrator
from app.services.document_parser import document_parser
from app.services.vector_service import vector_service

router = APIRouter(tags=["Chapters"])

@router.get("/projects/{project_id}/chapters", response_model=List[s_models.ChapterOut])
def list_chapters(project_id: str, db: Session = Depends(get_db)):
    chapters = db.query(models.Chapter).filter(
        models.Chapter.project_id == project_id
    ).order_by(models.Chapter.chapter_number.asc()).all()
    return chapters

@router.post("/projects/{project_id}/chapters", response_model=s_models.ChapterOut)
def create_chapter(project_id: str, data: s_models.ChapterCreate, db: Session = Depends(get_db)):
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
def get_chapter(chapter_id: str, db: Session = Depends(get_db)):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return ch

@router.put("/chapters/{chapter_id}", response_model=s_models.ChapterOut)
@router.patch("/chapters/{chapter_id}", response_model=s_models.ChapterOut)
def update_chapter(chapter_id: str, data: s_models.ChapterUpdate, db: Session = Depends(get_db)):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

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

@router.post("/chapters/{chapter_id}/analyze", response_model=s_models.AnalyzeChapterResponse)
def analyze_chapter(chapter_id: str, db: Session = Depends(get_db)):
    ch = db.query(models.Chapter).filter(models.Chapter.id == chapter_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # 1. Extract and update canon facts for this chapter with AI
    orchestrator._extract_and_persist_chapter_memory(db, ch.project_id, ch, fast_mode=False)

    # 2. Run Continuity Guardian analysis for this chapter
    issues = orchestrator.analyze_chapter_continuity(
        db=db,
        project_id=ch.project_id,
        chapter_id=ch.id,
        skip_llm=False
    )

    entities_count = db.query(models.Entity).filter(models.Entity.project_id == ch.project_id).count()

    return s_models.AnalyzeChapterResponse(
        chapter_id=ch.id,
        chapter_number=ch.chapter_number,
        issues_found=len(issues),
        issues=issues,
        entities_extracted=entities_count
    )
