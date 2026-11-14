import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from app.database import models

logger = logging.getLogger("memory_service")

class NarrativeMemoryService:
    """
    Manages all persistent structured narrative memory in PostgreSQL.
    Strictly partitions all read/write operations by `project_id` to prevent cross-project leakage.
    Ensures that every story_fact and relationship maintains its source_chapter_id and source_quote.
    """

    # --- Projects ---
    def get_project(self, db: Session, project_id: str) -> Optional[models.Project]:
        return db.query(models.Project).filter(models.Project.id == project_id).first()

    # --- Chapters & Passages ---
    def get_chapters(self, db: Session, project_id: str) -> List[models.Chapter]:
        return db.query(models.Chapter).filter(
            models.Chapter.project_id == project_id
        ).order_by(models.Chapter.chapter_number.asc()).all()

    def get_chapter(self, db: Session, project_id: str, chapter_id: str) -> Optional[models.Chapter]:
        return db.query(models.Chapter).filter(
            models.Chapter.id == chapter_id,
            models.Chapter.project_id == project_id
        ).first()

    def create_or_update_chapter(
        self,
        db: Session,
        project_id: str,
        chapter_number: int,
        title: str,
        content: str,
        manuscript_id: Optional[str] = None,
        chapter_id: Optional[str] = None
    ) -> models.Chapter:
        chapter = None
        if chapter_id:
            chapter = db.query(models.Chapter).filter(
                models.Chapter.id == chapter_id,
                models.Chapter.project_id == project_id
            ).first()

        if not chapter:
            chapter = db.query(models.Chapter).filter(
                models.Chapter.project_id == project_id,
                models.Chapter.chapter_number == chapter_number
            ).first()

        if chapter:
            chapter.title = title
            chapter.content = content
            chapter.word_count = len(content.split())
            if manuscript_id:
                chapter.manuscript_id = manuscript_id
        else:
            chapter = models.Chapter(
                id=chapter_id or models.gen_uuid(),
                project_id=project_id,
                manuscript_id=manuscript_id,
                chapter_number=chapter_number,
                title=title,
                content=content,
                word_count=len(content.split())
            )
            db.add(chapter)

        db.commit()
        db.refresh(chapter)
        return chapter

    def save_passages(
        self,
        db: Session,
        project_id: str,
        chapter_id: str,
        passages_data: List[Dict[str, Any]]
    ) -> List[models.Passage]:
        # Delete existing passages for this chapter to prevent duplicate indexing
        db.query(models.Passage).filter(
            models.Passage.project_id == project_id,
            models.Passage.chapter_id == chapter_id
        ).delete()

        saved_passages = []
        for p in passages_data:
            passage = models.Passage(
                id=p.get("id") or models.gen_uuid(),
                project_id=project_id,
                chapter_id=chapter_id,
                passage_index=p.get("passage_index", 0),
                content=p["content"],
                char_start=p.get("char_start", 0),
                char_end=p.get("char_end", len(p["content"]))
            )
            db.add(passage)
            saved_passages.append(passage)

        db.commit()
        return saved_passages

    # --- Entities ---
    def get_entities(
        self,
        db: Session,
        project_id: str,
        entity_type: Optional[str] = None,
        search_query: Optional[str] = None
    ) -> List[models.Entity]:
        query = db.query(models.Entity).filter(models.Entity.project_id == project_id)
        if entity_type:
            query = query.filter(models.Entity.entity_type.ilike(entity_type.strip()))
        if search_query:
            q = f"%{search_query.strip()}%"
            query = query.filter(or_(
                models.Entity.name.ilike(q),
                models.Entity.description.ilike(q)
            ))
        return query.order_by(models.Entity.name.asc()).all()

    def get_entity(self, db: Session, project_id: str, entity_id: str) -> Optional[models.Entity]:
        return db.query(models.Entity).filter(
            models.Entity.id == entity_id,
            models.Entity.project_id == project_id
        ).first()

    def save_or_update_entity(
        self,
        db: Session,
        project_id: str,
        name: str,
        entity_type: str = "character",
        description: Optional[str] = None,
        traits: Optional[List[str]] = None,
        first_appearance_chapter: int = 1,
        first_appearance_chapter_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> models.Entity:
        name_clean = name.strip()
        entity = db.query(models.Entity).filter(
            models.Entity.project_id == project_id,
            models.Entity.name.ilike(name_clean)
        ).first()

        if entity:
            if description and not entity.description:
                entity.description = description
            if traits:
                current_traits = set(entity.traits or [])
                current_traits.update(traits)
                entity.traits = list(current_traits)
            if first_appearance_chapter_id and not entity.first_appearance_chapter_id:
                entity.first_appearance_chapter_id = first_appearance_chapter_id
            if metadata:
                meta = dict(entity.meta_info or {})
                meta.update(metadata)
                entity.meta_info = meta
        else:
            entity = models.Entity(
                id=models.gen_uuid(),
                project_id=project_id,
                name=name_clean,
                entity_type=entity_type.lower().strip(),
                description=description or "",
                traits=list(set(traits or [])),
                first_appearance_chapter=first_appearance_chapter,
                first_appearance_chapter_id=first_appearance_chapter_id,
                meta_info=metadata or {}
            )
            db.add(entity)

        db.commit()
        db.refresh(entity)
        return entity

    def update_entity(
        self,
        db: Session,
        project_id: str,
        entity_id: str,
        update_data: Dict[str, Any]
    ) -> Optional[models.Entity]:
        entity = self.get_entity(db, project_id, entity_id)
        if not entity:
            return None

        if "name" in update_data and update_data["name"]:
            entity.name = update_data["name"].strip()
        if "entity_type" in update_data and update_data["entity_type"]:
            entity.entity_type = update_data["entity_type"].strip()
        if "description" in update_data:
            entity.description = update_data["description"]
        if "traits" in update_data and update_data["traits"] is not None:
            entity.traits = update_data["traits"]
        if "first_appearance_chapter" in update_data:
            entity.first_appearance_chapter = update_data["first_appearance_chapter"]

        db.commit()
        db.refresh(entity)
        return entity

    # --- Story Facts (Mandatory Source Evidence) ---
    def save_story_fact(
        self,
        db: Session,
        project_id: str,
        entity_id: Optional[str],
        fact: str,
        source_chapter_id: str,
        source_quote: str,
        source_chapter_number: Optional[int] = None,
        category: str = "general",
        confidence: float = 1.0
    ) -> Optional[models.StoryFact]:
        """
        Persists an evidence-backed story fact.
        Strictly requires source_chapter_id and verbatim source_quote as guaranteed by the specification.
        """
        if not source_chapter_id or not source_quote or not source_quote.strip():
            logger.warning(f"Rejected story fact without source evidence: '{fact}'")
            return None

        # Check for duplicate fact under same project and entity
        existing = db.query(models.StoryFact).filter(
            models.StoryFact.project_id == project_id,
            models.StoryFact.entity_id == entity_id,
            models.StoryFact.fact == fact.strip()
        ).first()

        if existing:
            existing.source_quote = source_quote.strip()
            existing.source_chapter_id = source_chapter_id
            existing.confidence = confidence
            existing.is_active = True
            db.commit()
            db.refresh(existing)
            return existing

        fact_record = models.StoryFact(
            id=models.gen_uuid(),
            project_id=project_id,
            entity_id=entity_id,
            fact=fact.strip(),
            category=category,
            fact_category=category,
            source_chapter_id=source_chapter_id,
            source_chapter_number=source_chapter_number,
            source_quote=source_quote.strip(),
            confidence=confidence,
            is_active=True
        )
        db.add(fact_record)
        db.commit()
        db.refresh(fact_record)
        return fact_record

    def get_story_facts(
        self,
        db: Session,
        project_id: str,
        entity_id: Optional[str] = None,
        active_only: bool = True
    ) -> List[models.StoryFact]:
        query = db.query(models.StoryFact).filter(models.StoryFact.project_id == project_id)
        if entity_id:
            query = query.filter(models.StoryFact.entity_id == entity_id)
        if active_only:
            query = query.filter(models.StoryFact.is_active == True)
        return query.order_by(models.StoryFact.source_chapter_number.asc()).all()

    # --- Relationships (Mandatory Source Evidence) ---
    def save_relationship(
        self,
        db: Session,
        project_id: str,
        source_entity_id: str,
        target_entity_id: str,
        relation_type: str,
        source_chapter_id: str,
        source_quote: str,
        description: Optional[str] = None
    ) -> Optional[models.Relationship]:
        """
        Persists a relationship edge.
        Requires source_chapter_id and source_quote.
        """
        if not source_chapter_id or not source_quote or not source_quote.strip():
            logger.warning("Rejected relationship without source evidence")
            return None

        # Verify source and target entities belong to this project
        src = self.get_entity(db, project_id, source_entity_id)
        tgt = self.get_entity(db, project_id, target_entity_id)
        if not src or not tgt:
            logger.warning(f"Invalid entities for relationship in project {project_id}")
            return None

        existing = db.query(models.Relationship).filter(
            models.Relationship.project_id == project_id,
            models.Relationship.source_entity_id == source_entity_id,
            models.Relationship.target_entity_id == target_entity_id,
            models.Relationship.relation_type == relation_type.strip()
        ).first()

        if existing:
            existing.description = description or existing.description
            existing.source_chapter_id = source_chapter_id
            existing.source_quote = source_quote.strip()
            db.commit()
            db.refresh(existing)
            return existing

        rel = models.Relationship(
            id=models.gen_uuid(),
            project_id=project_id,
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relation_type=relation_type.strip(),
            description=description or "",
            source_chapter_id=source_chapter_id,
            source_quote=source_quote.strip()
        )
        db.add(rel)
        db.commit()
        db.refresh(rel)
        return rel

    def get_relationships(self, db: Session, project_id: str) -> List[models.Relationship]:
        return db.query(models.Relationship).filter(
            models.Relationship.project_id == project_id
        ).all()

    # --- Timeline Events ---
    def save_timeline_event(
        self,
        db: Session,
        project_id: str,
        title: str,
        description: str,
        chapter_id: Optional[str] = None,
        chapter_number: Optional[int] = None,
        chronology_order: int = 0,
        date_or_time_label: Optional[str] = None,
        participants: Optional[List[str]] = None,
        location: Optional[str] = None
    ) -> models.TimelineEvent:
        event = models.TimelineEvent(
            id=models.gen_uuid(),
            project_id=project_id,
            title=title.strip(),
            description=description.strip(),
            chapter_id=chapter_id,
            chapter_number=chapter_number,
            chronology_order=chronology_order,
            date_or_time_label=date_or_time_label,
            participants=participants or [],
            location=location
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    def get_timeline_events(self, db: Session, project_id: str) -> List[models.TimelineEvent]:
        return db.query(models.TimelineEvent).filter(
            models.TimelineEvent.project_id == project_id
        ).order_by(models.TimelineEvent.chronology_order.asc(), models.TimelineEvent.chapter_number.asc()).all()

    # --- Continuity Issues ---
    def save_continuity_issue(
        self,
        db: Session,
        project_id: str,
        chapter_id: str,
        issue_type: str,
        severity: str,
        confidence: float,
        explanation: str,
        earlier_passage: Optional[str] = None,
        new_passage: Optional[str] = None,
        earlier_chapter_number: Optional[int] = None,
        new_chapter_number: Optional[int] = None,
        suggestions: Optional[List[str]] = None,
        classification: str = "likely_conflict",
        evidence: Optional[List[Dict[str, Any]]] = None,
        status: str = "unresolved"
    ) -> models.ContinuityIssue:
        existing = db.query(models.ContinuityIssue).filter(
            models.ContinuityIssue.project_id == project_id,
            models.ContinuityIssue.chapter_id == chapter_id,
            models.ContinuityIssue.issue_type == issue_type,
            models.ContinuityIssue.status.in_(["unresolved", "open"])
        ).first()

        if existing:
            existing.severity = severity
            existing.confidence = confidence
            existing.explanation = explanation
            existing.earlier_passage = earlier_passage or existing.earlier_passage
            existing.new_passage = new_passage or existing.new_passage
            existing.suggestions = suggestions or existing.suggestions
            existing.classification = classification
            if evidence:
                existing.evidence = evidence
            db.commit()
            db.refresh(existing)
            return existing

        # Build evidence JSON array if not provided
        if not evidence:
            evidence = []
            if earlier_passage:
                evidence.append({
                    "chapter": earlier_chapter_number or 0,
                    "quote": earlier_passage
                })
            if new_passage:
                evidence.append({
                    "chapter": new_chapter_number or 0,
                    "quote": new_passage
                })

        issue = models.ContinuityIssue(
            id=models.gen_uuid(),
            project_id=project_id,
            chapter_id=chapter_id,
            issue_type=issue_type,
            classification=classification,
            severity=severity,
            confidence=confidence,
            explanation=explanation,
            evidence=evidence,
            earlier_passage=earlier_passage,
            new_passage=new_passage,
            earlier_chapter_number=earlier_chapter_number,
            new_chapter_number=new_chapter_number,
            suggestions=suggestions or [],
            status=status
        )
        db.add(issue)
        db.commit()
        db.refresh(issue)
        return issue

    def get_continuity_issues(
        self,
        db: Session,
        project_id: str,
        severity: Optional[str] = None,
        issue_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[models.ContinuityIssue]:
        query = db.query(models.ContinuityIssue).filter(models.ContinuityIssue.project_id == project_id)
        if severity:
            query = query.filter(models.ContinuityIssue.severity.ilike(severity.strip()))
        if issue_type:
            query = query.filter(models.ContinuityIssue.issue_type.ilike(issue_type.strip()))
        if status:
            if status.lower() == "open":
                query = query.filter(models.ContinuityIssue.status.in_(["open", "unresolved"]))
            else:
                query = query.filter(models.ContinuityIssue.status.ilike(status.strip()))
        return query.order_by(desc(models.ContinuityIssue.confidence), desc(models.ContinuityIssue.created_at)).all()

    def update_issue_status(
        self,
        db: Session,
        project_id: str,
        issue_id: str,
        status: str,
        author_notes: Optional[str] = None
    ) -> Optional[models.ContinuityIssue]:
        issue = db.query(models.ContinuityIssue).filter(
            models.ContinuityIssue.id == issue_id,
            models.ContinuityIssue.project_id == project_id
        ).first()

        if not issue:
            return None

        issue.status = status.lower().strip()
        if author_notes is not None:
            issue.author_notes = author_notes

        db.commit()
        db.refresh(issue)
        return issue

    # --- Full Project Memory Cleanup ---
    def clear_project_narrative_memory(self, db: Session, project_id: str) -> None:
        """
        Cleans up derived narrative memory when re-uploading a manuscript.
        Preserves the project and manuscript record.
        """
        db.query(models.ContinuityIssue).filter(models.ContinuityIssue.project_id == project_id).delete()
        db.query(models.TimelineEvent).filter(models.TimelineEvent.project_id == project_id).delete()
        db.query(models.Relationship).filter(models.Relationship.project_id == project_id).delete()
        db.query(models.StoryFact).filter(models.StoryFact.project_id == project_id).delete()
        db.query(models.Entity).filter(models.Entity.project_id == project_id).delete()
        db.query(models.Passage).filter(models.Passage.project_id == project_id).delete()
        db.query(models.Chapter).filter(models.Chapter.project_id == project_id).delete()
        db.commit()

memory_service = NarrativeMemoryService()
