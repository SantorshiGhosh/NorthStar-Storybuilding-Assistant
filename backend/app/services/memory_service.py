import json
import logging
from typing import List, Dict, Any, Optional, Union
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc, text

from app.database import models
from app.config import settings

logger = logging.getLogger("memory_service")

# Optional Supabase client singleton
_supabase_client = None

def get_supabase_client():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    url = settings.SUPABASE_URL
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY or settings.SUPABASE_KEY
    if url and key:
        try:
            from supabase import create_client
            _supabase_client = create_client(url, key)
        except Exception as e:
            logger.debug(f"supabase-py client not initialized: {e}")
            _supabase_client = None
    return _supabase_client


class NarrativeMemoryService:
    """
    Manages all persistent structured narrative memory in PostgreSQL / Supabase.
    Strictly partitions all read/write operations by `project_id`.
    Includes universal schema-safe fallbacks for databases with legacy or partial column schemas.
    """

    # --- Safe Supabase Helpers ---
    @staticmethod
    def _safe_supabase_insert(table: str, data: Union[Dict[str, Any], List[Dict[str, Any]]]):
        """
        Universal helper to safely insert into Supabase via REST client if present,
        catching schema column mismatches and falling back gracefully.
        """
        client = get_supabase_client()
        if not client:
            return None
        try:
            res = client.table(table).insert(data).execute()
            return res.data
        except Exception as e:
            logger.warning(f"Supabase REST insert into {table} failed: {e}")
            return None

    @staticmethod
    def _safe_supabase_select(table: str, filter_col: str, filter_val: Any):
        """
        Universal helper to safely select from Supabase via REST client if present.
        """
        client = get_supabase_client()
        if not client:
            return None
        try:
            res = client.table(table).select("*").eq(filter_col, filter_val).execute()
            return res.data
        except Exception as e:
            logger.warning(f"Supabase REST select from {table} failed: {e}")
            return None

    # --- Projects ---
    def get_project(self, db: Session, project_id: str) -> Optional[models.Project]:
        try:
            return db.query(models.Project).filter(models.Project.id == project_id).first()
        except Exception as e:
            logger.error(f"Error fetching project {project_id}: {e}")
            db.rollback()
            return None

    # --- Chapters & Passages ---
    def get_chapters(self, db: Session, project_id: str) -> List[models.Chapter]:
        try:
            return db.query(models.Chapter).filter(
                models.Chapter.project_id == project_id
            ).order_by(models.Chapter.chapter_number.asc()).all()
        except Exception as e:
            logger.error(f"Error fetching chapters for {project_id}: {e}")
            db.rollback()
            return []

    def get_chapter(self, db: Session, project_id: str, chapter_id: str) -> Optional[models.Chapter]:
        try:
            return db.query(models.Chapter).filter(
                models.Chapter.id == chapter_id,
                models.Chapter.project_id == project_id
            ).first()
        except Exception as e:
            logger.error(f"Error fetching chapter {chapter_id}: {e}")
            db.rollback()
            return None

    def create_or_update_chapter(
        self,
        db: Session,
        project_id: str,
        chapter_number: int,
        title: str,
        content: str,
        manuscript_id: Optional[str] = None,
        chapter_id: Optional[str] = None
    ) -> Optional[models.Chapter]:
        try:
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
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving chapter {chapter_number}: {e}")
            return None

    def save_passages(
        self,
        db: Session,
        project_id: str,
        chapter_id: str,
        passages_data: List[Dict[str, Any]]
    ) -> List[models.Passage]:
        try:
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
        except Exception as e:
            db.rollback()
            logger.warning(f"Error saving passages: {e}")
            return []

    # --- Entities ---
    def get_entities(
        self,
        db: Session,
        project_id: str,
        entity_type: Optional[str] = None,
        search_query: Optional[str] = None
    ) -> List[Any]:
        try:
            query = db.query(models.Entity).filter(models.Entity.project_id == project_id)
            if entity_type and entity_type.lower() != "all":
                query = query.filter(models.Entity.entity_type.ilike(entity_type.strip()))
            if search_query:
                q = f"%{search_query.strip()}%"
                query = query.filter(or_(
                    models.Entity.name.ilike(q),
                    models.Entity.description.ilike(q)
                ))
            return query.order_by(models.Entity.name.asc()).all()
        except Exception as e:
            db.rollback()
            logger.warning(f"ORM get_entities failed ({e}); attempting raw select...")
            try:
                stmt = text("SELECT * FROM entities WHERE project_id = :pid ORDER BY name ASC")
                res = db.execute(stmt, {"pid": project_id}).fetchall()
                return [dict(r._mapping) for r in res]
            except Exception as e2:
                db.rollback()
                logger.error(f"Fallback get_entities failed: {e2}")
                return []

    def get_entity(self, db: Session, project_id: str, entity_id: str) -> Optional[Any]:
        try:
            return db.query(models.Entity).filter(
                models.Entity.id == entity_id,
                models.Entity.project_id == project_id
            ).first()
        except Exception as e:
            db.rollback()
            try:
                stmt = text("SELECT * FROM entities WHERE id = :id AND project_id = :pid")
                r = db.execute(stmt, {"id": entity_id, "pid": project_id}).first()
                return dict(r._mapping) if r else None
            except Exception:
                db.rollback()
                return None

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
    ) -> Any:
        name_clean = name.strip()
        traits_list = list(set(traits or []))
        desc_clean = description or ""

        # Try standard ORM save
        try:
            entity = db.query(models.Entity).filter(
                models.Entity.project_id == project_id,
                models.Entity.name.ilike(name_clean)
            ).first()

            if entity:
                if desc_clean and not entity.description:
                    entity.description = desc_clean
                if traits_list:
                    current_traits = set(entity.traits or [])
                    current_traits.update(traits_list)
                    entity.traits = list(current_traits)
                if first_appearance_chapter_id and not entity.first_appearance_chapter_id:
                    entity.first_appearance_chapter_id = first_appearance_chapter_id
                db.commit()
                db.refresh(entity)
                return entity
            else:
                new_entity = models.Entity(
                    id=models.gen_uuid(),
                    project_id=project_id,
                    name=name_clean,
                    entity_type=entity_type.lower().strip(),
                    description=desc_clean,
                    traits=traits_list,
                    first_appearance_chapter=first_appearance_chapter,
                    first_appearance_chapter_id=first_appearance_chapter_id,
                    meta_info=metadata or {}
                )
                db.add(new_entity)
                db.commit()
                db.refresh(new_entity)
                return new_entity
        except Exception as e:
            db.rollback()
            logger.warning(f"ORM save_or_update_entity failed ({e}); retrying with schema-safe base columns...")
            # Fallback raw SQL using ONLY base columns (project_id, name, entity_type, description)
            try:
                new_id = models.gen_uuid()
                # Encode traits into description if traits column might be missing
                full_desc = desc_clean
                if traits_list and not desc_clean:
                    full_desc = f"Traits: {', '.join(traits_list)}"
                elif traits_list and f"Traits:" not in full_desc:
                    full_desc += f" (Traits: {', '.join(traits_list)})"

                stmt = text("""
                    INSERT INTO entities (id, project_id, name, entity_type, description)
                    VALUES (:id, :project_id, :name, :entity_type, :description)
                    ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description
                """)
                db.execute(stmt, {
                    "id": new_id,
                    "project_id": project_id,
                    "name": name_clean,
                    "entity_type": entity_type.lower().strip(),
                    "description": full_desc
                })
                db.commit()
                return {
                    "id": new_id,
                    "project_id": project_id,
                    "name": name_clean,
                    "entity_type": entity_type.lower().strip(),
                    "description": full_desc,
                    "traits": traits_list
                }
            except Exception as e2:
                db.rollback()
                logger.error(f"Fallback entity insert failed: {e2}")
                return None

    # --- Story Facts (Mandatory Source Evidence & Column Fallback) ---
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
    ) -> Any:
        if not source_chapter_id or not source_quote or not source_quote.strip():
            logger.warning(f"Rejected story fact without source evidence: '{fact}'")
            return None

        fact_clean = fact.strip()
        quote_clean = source_quote.strip()

        # Try standard ORM save
        try:
            existing = None
            try:
                existing = db.query(models.StoryFact).filter(
                    models.StoryFact.project_id == project_id,
                    models.StoryFact.fact == fact_clean
                ).first()
            except Exception:
                db.rollback()
                if entity_id:
                    existing = db.query(models.StoryFact).filter(
                        models.StoryFact.entity_id == entity_id,
                        models.StoryFact.fact == fact_clean
                    ).first()

            if existing:
                existing.source_quote = quote_clean
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
                fact=fact_clean,
                category=category,
                fact_category=category,
                source_chapter_id=source_chapter_id,
                source_chapter_number=source_chapter_number,
                source_quote=quote_clean,
                confidence=confidence,
                is_active=True
            )
            db.add(fact_record)
            db.commit()
            db.refresh(fact_record)
            return fact_record
        except Exception as e:
            db.rollback()
            logger.warning(f"Full StoryFact insert failed ({e}); attempting schema-safe base column insert...")
            try:
                new_id = models.gen_uuid()
                # Base columns in Supabase: id, entity_id, fact, source_chapter_id, source_quote
                stmt = text("""
                    INSERT INTO story_facts (id, entity_id, fact, source_chapter_id, source_quote)
                    VALUES (:id, :entity_id, :fact, :source_chapter_id, :source_quote)
                """)
                db.execute(stmt, {
                    "id": new_id,
                    "entity_id": entity_id,
                    "fact": fact_clean,
                    "source_chapter_id": source_chapter_id,
                    "source_quote": quote_clean
                })
                db.commit()
                return {
                    "id": new_id,
                    "project_id": project_id,
                    "entity_id": entity_id,
                    "fact": fact_clean,
                    "source_chapter_id": source_chapter_id,
                    "source_chapter_number": source_chapter_number,
                    "source_quote": quote_clean,
                    "category": category,
                    "confidence": confidence,
                    "is_active": True
                }
            except Exception as e2:
                db.rollback()
                logger.error(f"Fallback StoryFact insert failed: {e2}")
                return None

    def get_story_facts(
        self,
        db: Session,
        project_id: str,
        entity_id: Optional[str] = None,
        active_only: bool = True
    ) -> List[Any]:
        # 1. Try querying directly by project_id
        try:
            query = db.query(models.StoryFact).filter(models.StoryFact.project_id == project_id)
            if entity_id:
                query = query.filter(models.StoryFact.entity_id == entity_id)
            if active_only:
                query = query.filter(models.StoryFact.is_active == True)
            return query.order_by(models.StoryFact.source_chapter_number.asc()).all()
        except Exception as e:
            logger.warning(f"Direct story_facts.project_id query failed ({e}); falling back via entity_ids...")
            db.rollback()

        # 2. Schema-safe fallback: query project's entity_ids first, then query story_facts where entity_id in (entity_ids)
        try:
            ents = self.get_entities(db, project_id)
            ent_ids = [e.id if hasattr(e, "id") else e["id"] for e in ents if e]
            if not ent_ids:
                return []

            query = db.query(models.StoryFact).filter(models.StoryFact.entity_id.in_(ent_ids))
            if entity_id:
                query = query.filter(models.StoryFact.entity_id == entity_id)
            if active_only:
                query = query.filter(models.StoryFact.is_active == True)
            return query.all()
        except Exception as e2:
            db.rollback()
            logger.warning(f"ORM entity_id.in_ query failed ({e2}); trying raw SQL...")
            try:
                ents = self.get_entities(db, project_id)
                ent_ids = [str(e.id if hasattr(e, "id") else e["id"]) for e in ents if e]
                if not ent_ids:
                    return []
                # Format IDs safely for SQL IN clause
                id_placeholders = ", ".join(f"'{i}'" for i in ent_ids)
                stmt = text(f"SELECT * FROM story_facts WHERE entity_id IN ({id_placeholders})")
                res = db.execute(stmt).fetchall()
                return [dict(r._mapping) for r in res]
            except Exception as e3:
                db.rollback()
                logger.error(f"Critical: all story_facts query attempts failed: {e3}")
                return []

    # --- Relationships ---
    def save_relationship(
        self,
        db: Session,
        project_id: str,
        source_entity_id: str,
        target_entity_id: str,
        relation_type: str,
        source_chapter_id: Optional[str] = None,
        source_quote: Optional[str] = None,
        description: Optional[str] = None,
        direction: Optional[str] = "directed",
        custom_properties: Optional[dict] = None,
        provenance: Optional[str] = "manual",
        protection_level: Optional[int] = 1
    ) -> Any:
        if not relation_type or not relation_type.strip():
            logger.warning("Rejected relationship without relation_type")
            return None

        rel_clean = relation_type.strip()
        quote_clean = (source_quote or "").strip() or f"Established relationship: {rel_clean}."
        desc_clean = description or ""
        ch_id = str(source_chapter_id).strip() if source_chapter_id and str(source_chapter_id).strip() else None

        try:
            existing = db.query(models.Relationship).filter(
                models.Relationship.project_id == project_id,
                models.Relationship.source_entity_id == source_entity_id,
                models.Relationship.target_entity_id == target_entity_id,
                models.Relationship.relation_type == rel_clean
            ).first()

            if existing:
                existing.description = desc_clean or existing.description
                if ch_id:
                    existing.source_chapter_id = ch_id
                if quote_clean:
                    existing.source_quote = quote_clean
                if direction:
                    existing.direction = direction
                if custom_properties:
                    existing.custom_properties = custom_properties
                if protection_level:
                    existing.protection_level = protection_level
                db.commit()
                db.refresh(existing)
                return existing

            rel = models.Relationship(
                id=models.gen_uuid(),
                project_id=project_id,
                source_entity_id=source_entity_id,
                target_entity_id=target_entity_id,
                relation_type=rel_clean,
                description=desc_clean,
                source_chapter_id=ch_id,
                source_quote=quote_clean,
                direction=direction or "directed",
                custom_properties=custom_properties or {},
                provenance=provenance or "manual",
                protection_level=protection_level or 1
            )
            db.add(rel)
            db.commit()
            db.refresh(rel)
            return rel
        except Exception as e:
            db.rollback()
            logger.warning(f"ORM save_relationship failed ({e}); attempting schema-safe base column insert...")
            try:
                new_id = models.gen_uuid()
                stmt = text("""
                    INSERT INTO relationships (id, project_id, source_entity_id, target_entity_id, relation_type)
                    VALUES (:id, :project_id, :source_entity_id, :target_entity_id, :relation_type)
                """)
                db.execute(stmt, {
                    "id": new_id,
                    "project_id": project_id,
                    "source_entity_id": source_entity_id,
                    "target_entity_id": target_entity_id,
                    "relation_type": rel_clean
                })
                db.commit()
                return {
                    "id": new_id,
                    "project_id": project_id,
                    "source_entity_id": source_entity_id,
                    "target_entity_id": target_entity_id,
                    "relation_type": rel_clean,
                    "source_quote": quote_clean,
                    "description": desc_clean
                }
            except Exception as e2:
                db.rollback()
                logger.error(f"Fallback relationship insert failed: {e2}")
                return None

    def get_relationships(self, db: Session, project_id: str) -> List[Any]:
        try:
            return db.query(models.Relationship).filter(
                models.Relationship.project_id == project_id
            ).all()
        except Exception as e:
            db.rollback()
            logger.warning(f"ORM get_relationships failed ({e}); trying raw select...")
            try:
                stmt = text("SELECT * FROM relationships WHERE project_id = :pid")
                res = db.execute(stmt, {"pid": project_id}).fetchall()
                return [dict(r._mapping) for r in res]
            except Exception:
                db.rollback()
                return []

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
    ) -> Any:
        try:
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
        except Exception as e:
            db.rollback()
            logger.warning(f"Error saving timeline event: {e}")
            return None

    def get_timeline_events(self, db: Session, project_id: str) -> List[Any]:
        try:
            return db.query(models.TimelineEvent).filter(
                models.TimelineEvent.project_id == project_id
            ).order_by(models.TimelineEvent.chronology_order.asc(), models.TimelineEvent.chapter_number.asc()).all()
        except Exception as e:
            db.rollback()
            logger.warning(f"Error querying timeline events: {e}")
            return []

    # --- Continuity Issues (Universal Normalization & Schema-Safe Insert) ---
    def normalize_issue(self, item: Any) -> Dict[str, Any]:
        """
        Normalizes any continuity issue row (SQLAlchemy model, dictionary, or row mapping)
        into a clean, fully-populated dictionary that strictly satisfies frontend expectations.
        """
        if not item:
            return {}

        if hasattr(item, "__dict__"):
            d = {k: v for k, v in item.__dict__.items() if not k.startswith("_")}
        elif hasattr(item, "_mapping"):
            d = dict(item._mapping)
        elif isinstance(item, dict):
            d = dict(item)
        else:
            return {}

        # Unpack evidence JSONB
        raw_evidence = d.get("evidence")
        parsed_evidence = []
        meta_data = {}

        if isinstance(raw_evidence, str):
            try:
                raw_evidence = json.loads(raw_evidence)
            except Exception:
                raw_evidence = []

        if isinstance(raw_evidence, dict):
            parsed_evidence = raw_evidence.get("items", [])
            meta_data = raw_evidence.get("meta", {})
        elif isinstance(raw_evidence, list):
            parsed_evidence = raw_evidence

        # Clean evidence items
        clean_evidence = []
        for ev in parsed_evidence:
            if isinstance(ev, dict):
                clean_evidence.append({
                    "chapter": ev.get("chapter", 0),
                    "quote": str(ev.get("quote", "")),
                    "chapter_id": str(ev.get("chapter_id")) if ev.get("chapter_id") else None
                })
            elif isinstance(ev, str):
                clean_evidence.append({"chapter": 0, "quote": ev})

        # Fallback evidence from passages if empty
        if not clean_evidence:
            if d.get("earlier_passage"):
                clean_evidence.append({
                    "chapter": d.get("earlier_chapter_number") or meta_data.get("earlier_chapter_number") or 1,
                    "quote": str(d.get("earlier_passage"))
                })
            if d.get("new_passage"):
                clean_evidence.append({
                    "chapter": d.get("new_chapter_number") or meta_data.get("new_chapter_number") or 1,
                    "quote": str(d.get("new_passage"))
                })

        # Suggestions
        suggestions = d.get("suggestions") or meta_data.get("suggestions") or []
        if isinstance(suggestions, str):
            try:
                suggestions = json.loads(suggestions)
            except Exception:
                suggestions = [suggestions]
        if not isinstance(suggestions, list):
            suggestions = []

        # Confidence
        confidence = d.get("confidence")
        try:
            confidence = float(confidence) if confidence is not None else 0.88
        except Exception:
            confidence = 0.88

        # Severity
        severity = str(d.get("severity") or "high").lower().strip()
        if severity not in ["high", "medium", "low"]:
            severity = "high"

        # Status
        status = str(d.get("status") or "unresolved").lower().strip()
        if status not in ["open", "unresolved", "resolved", "intentional", "dismissed", "review_later"]:
            status = "unresolved"

        # Classification
        classification = d.get("classification") or meta_data.get("classification") or "likely_conflict"

        # Chapter ID
        chapter_id = d.get("chapter_id") or meta_data.get("chapter_id")

        return {
            "id": str(d.get("id", "")),
            "project_id": str(d.get("project_id", "")),
            "chapter_id": str(chapter_id) if chapter_id else None,
            "issue_type": str(d.get("issue_type", "continuity_issue")),
            "classification": str(classification),
            "severity": severity,
            "confidence": confidence,
            "explanation": str(d.get("explanation", "")),
            "evidence": clean_evidence,
            "earlier_passage": d.get("earlier_passage") or meta_data.get("earlier_passage"),
            "new_passage": d.get("new_passage") or meta_data.get("new_passage"),
            "earlier_chapter_number": d.get("earlier_chapter_number") or meta_data.get("earlier_chapter_number"),
            "new_chapter_number": d.get("new_chapter_number") or meta_data.get("new_chapter_number"),
            "suggestions": suggestions,
            "status": status,
            "author_notes": d.get("author_notes"),
            "created_at": d.get("created_at") or datetime.utcnow(),
            "updated_at": d.get("updated_at") or datetime.utcnow()
        }

    def save_continuity_issue(
        self,
        db: Session,
        project_id: str,
        chapter_id: Optional[str],
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
    ) -> Dict[str, Any]:
        evidence_list = list(evidence) if evidence else []
        if earlier_passage and not any(e.get("quote") == earlier_passage for e in evidence_list):
            evidence_list.append({
                "chapter": earlier_chapter_number or 0,
                "quote": earlier_passage
            })
        if new_passage and not any(e.get("quote") == new_passage for e in evidence_list):
            evidence_list.append({
                "chapter": new_chapter_number or 0,
                "quote": new_passage
            })

        evidence_payload = {
            "items": evidence_list,
            "meta": {
                "chapter_id": chapter_id,
                "classification": classification,
                "suggestions": suggestions or [],
                "earlier_passage": earlier_passage,
                "new_passage": new_passage,
                "earlier_chapter_number": earlier_chapter_number,
                "new_chapter_number": new_chapter_number
            }
        }

        # 1. Try standard SQLAlchemy ORM insert/update
        try:
            existing = None
            if chapter_id and new_passage:
                existing = db.query(models.ContinuityIssue).filter(
                    models.ContinuityIssue.project_id == project_id,
                    models.ContinuityIssue.chapter_id == chapter_id,
                    models.ContinuityIssue.issue_type == issue_type,
                    models.ContinuityIssue.new_passage == new_passage,
                    models.ContinuityIssue.status.in_(["unresolved", "open"])
                ).first()
            elif chapter_id:
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
                existing.evidence = evidence_list
                db.commit()
                db.refresh(existing)
                return self.normalize_issue(existing)

            issue = models.ContinuityIssue(
                id=models.gen_uuid(),
                project_id=project_id,
                chapter_id=chapter_id,
                issue_type=issue_type,
                classification=classification,
                severity=severity,
                confidence=confidence,
                explanation=explanation,
                evidence=evidence_list,
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
            return self.normalize_issue(issue)
        except Exception as e:
            db.rollback()
            logger.warning(f"Standard ContinuityIssue ORM insert failed ({e}); attempting schema-safe base column fallback...")

        # 2. Schema-safe fallback: Insert with base columns present in live Supabase table
        try:
            new_id = models.gen_uuid()
            stmt = text("""
                INSERT INTO continuity_issues (id, project_id, chapter_id, issue_type, explanation, severity, confidence, status, evidence)
                VALUES (:id, :project_id, :chapter_id, :issue_type, :explanation, :severity, :confidence, :status, :evidence)
            """)
            db.execute(stmt, {
                "id": new_id,
                "project_id": project_id,
                "chapter_id": chapter_id,
                "issue_type": issue_type,
                "explanation": explanation,
                "severity": severity,
                "confidence": float(confidence),
                "status": status,
                "evidence": json.dumps(evidence_payload)
            })
            db.commit()
            return self.normalize_issue({
                "id": new_id,
                "project_id": project_id,
                "chapter_id": chapter_id,
                "issue_type": issue_type,
                "explanation": explanation,
                "severity": severity,
                "confidence": float(confidence),
                "status": status,
                "evidence": evidence_payload
            })
        except Exception as e2:
            db.rollback()
            logger.warning(f"Secondary ContinuityIssue insert failed ({e2}); trying minimal columns without chapter_id...")
            try:
                new_id = models.gen_uuid()
                stmt2 = text("""
                    INSERT INTO continuity_issues (id, project_id, issue_type, explanation, severity, confidence, status, evidence)
                    VALUES (:id, :project_id, :issue_type, :explanation, :severity, :confidence, :status, :evidence)
                """)
                db.execute(stmt2, {
                    "id": new_id,
                    "project_id": project_id,
                    "issue_type": issue_type,
                    "explanation": explanation,
                    "severity": severity,
                    "confidence": float(confidence),
                    "status": status,
                    "evidence": json.dumps(evidence_payload)
                })
                db.commit()
                return self.normalize_issue({
                    "id": new_id,
                    "project_id": project_id,
                    "chapter_id": chapter_id,
                    "issue_type": issue_type,
                    "explanation": explanation,
                    "severity": severity,
                    "confidence": float(confidence),
                    "status": status,
                    "evidence": evidence_payload
                })
            except Exception as e3:
                db.rollback()
                logger.error(f"Critical: all issue insertion attempts failed: {e3}")
                return self.normalize_issue({
                    "id": models.gen_uuid(),
                    "project_id": project_id,
                    "chapter_id": chapter_id,
                    "issue_type": issue_type,
                    "explanation": explanation,
                    "severity": severity,
                    "confidence": float(confidence),
                    "status": status,
                    "evidence": evidence_list,
                    "suggestions": suggestions or []
                })

    def get_continuity_issues(
        self,
        db: Session,
        project_id: str,
        severity: Optional[str] = None,
        issue_type: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        raw_issues = []
        try:
            query = db.query(models.ContinuityIssue).filter(models.ContinuityIssue.project_id == project_id)
            if severity and severity.lower() != "all":
                query = query.filter(models.ContinuityIssue.severity.ilike(severity.strip()))
            if issue_type and issue_type.lower() != "all":
                query = query.filter(models.ContinuityIssue.issue_type.ilike(issue_type.strip()))
            if status and status.lower() != "all":
                if status.lower() in ["open", "unresolved"]:
                    query = query.filter(models.ContinuityIssue.status.in_(["open", "unresolved"]))
                else:
                    query = query.filter(models.ContinuityIssue.status.ilike(status.strip()))
            raw_issues = query.order_by(desc(models.ContinuityIssue.created_at)).all()
        except Exception as e:
            db.rollback()
            logger.warning(f"ORM get_continuity_issues failed ({e}); falling back to raw select...")
            try:
                stmt = text("SELECT * FROM continuity_issues WHERE project_id = :project_id ORDER BY created_at DESC")
                res = db.execute(stmt, {"project_id": project_id}).fetchall()
                raw_issues = [dict(r._mapping) for r in res]
            except Exception as e2:
                db.rollback()
                logger.error(f"Fallback raw select on continuity_issues failed: {e2}")
                return []

        # Normalize every row so it never fails Pydantic schema validation or frontend consumption
        normalized = []
        for item in raw_issues:
            norm = self.normalize_issue(item)
            if norm:
                # Filter checks
                if status and status.lower() != "all":
                    s = status.lower().strip()
                    if s in ["open", "unresolved"] and norm["status"] not in ["open", "unresolved"]:
                        continue
                    elif s not in ["open", "unresolved"] and norm["status"] != s:
                        continue
                if severity and severity.lower() != "all":
                    if norm["severity"].lower() != severity.lower().strip():
                        continue
                if issue_type and issue_type.lower() != "all":
                    if norm["issue_type"].lower() != issue_type.lower().strip():
                        continue
                normalized.append(norm)

        return normalized

    def update_issue_status(
        self,
        db: Session,
        project_id: str,
        issue_id: str,
        status: str,
        author_notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        status_clean = status.lower().strip()
        try:
            issue = db.query(models.ContinuityIssue).filter(
                models.ContinuityIssue.id == issue_id
            ).first()

            if issue:
                issue.status = status_clean
                if author_notes is not None:
                    issue.author_notes = author_notes
                db.commit()
                db.refresh(issue)
                return self.normalize_issue(issue)
        except Exception as e:
            db.rollback()
            logger.warning(f"ORM update_issue_status failed ({e}); trying raw SQL update...")

        try:
            stmt = text("UPDATE continuity_issues SET status = :status WHERE id = :id")
            db.execute(stmt, {"status": status_clean, "id": issue_id})
            db.commit()
            return self.normalize_issue({"id": issue_id, "project_id": project_id, "status": status_clean})
        except Exception as e2:
            db.rollback()
            logger.error(f"Fallback update_issue_status failed: {e2}")
            return None

    # --- Story Architect: Activity Audit Logging ---
    def log_audit_action(
        self,
        db: Session,
        project_id: str,
        action: str,
        target_type: str,
        target_id: Optional[str] = None,
        target_name: Optional[str] = None,
        previous_value: Optional[Any] = None,
        new_value: Optional[Any] = None,
        actor_name: str = "Author",
        source: str = "manual",
        **kwargs
    ) -> Optional[models.AuditLog]:
        prev_val = previous_value if previous_value is not None else kwargs.get("prev_state")
        new_val = new_value if new_value is not None else kwargs.get("new_state")
        try:
            log_entry = models.AuditLog(
                id=models.gen_uuid(),
                project_id=project_id,
                actor_name=actor_name,
                action=action,
                target_type=target_type,
                target_id=target_id,
                target_name=target_name,
                previous_value=prev_val,
                new_value=new_val,
                source=source
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            return log_entry
        except Exception as e:
            db.rollback()
            logger.warning(f"Could not persist audit log: {e}")
            return None

    def get_audit_logs(self, db: Session, project_id: str, limit: int = 100) -> List[models.AuditLog]:
        try:
            return db.query(models.AuditLog).filter(
                models.AuditLog.project_id == project_id
            ).order_by(desc(models.AuditLog.created_at)).limit(limit).all()
        except Exception as e:
            db.rollback()
            logger.error(f"Error fetching audit logs: {e}")
            return []

    # --- Story Architect: Entity Categories ---
    def get_or_create_default_categories(self, db: Session, project_id: str) -> List[models.EntityCategory]:
        defaults = [
            {"name": "Characters", "slug": "character", "icon": "Users", "color": "#3B82F6"},
            {"name": "Families", "slug": "family", "icon": "Layers", "color": "#6366F1"},
            {"name": "Locations", "slug": "location", "icon": "MapPin", "color": "#10B981"},
            {"name": "Events", "slug": "event", "icon": "Calendar", "color": "#F59E0B"},
            {"name": "Plots", "slug": "plot", "icon": "GitBranch", "color": "#8B5CF6"},
            {"name": "Organisations", "slug": "organization", "icon": "Building2", "color": "#EC4899"},
        ]
        try:
            existing = db.query(models.EntityCategory).filter(models.EntityCategory.project_id == project_id).all()
            if not existing:
                created = []
                for cat in defaults:
                    new_cat = models.EntityCategory(
                        id=models.gen_uuid(),
                        project_id=project_id,
                        name=cat["name"],
                        slug=cat["slug"],
                        icon=cat["icon"],
                        color=cat["color"],
                        is_default=True,
                        default_properties=[]
                    )
                    db.add(new_cat)
                    created.append(new_cat)
                db.commit()
                return created
            return existing
        except Exception as e:
            db.rollback()
            logger.error(f"Error getting/creating default categories: {e}")
            return []

    # --- Story Architect: Multiple Canvases ---
    def get_canvases(self, db: Session, project_id: str) -> List[models.Canvas]:
        try:
            canvases = db.query(models.Canvas).filter(models.Canvas.project_id == project_id).order_by(models.Canvas.created_at.asc()).all()
            if not canvases:
                # Auto-initialize default canvas
                default_canvas = models.Canvas(
                    id=models.gen_uuid(),
                    project_id=project_id,
                    name="Universe Canon",
                    description="Primary master canvas of the fictional universe",
                    view_type="relationship",
                    layout_type="force_directed",
                    is_default=True
                )
                db.add(default_canvas)
                db.commit()
                db.refresh(default_canvas)
                return [default_canvas]
            return canvases
        except Exception as e:
            db.rollback()
            logger.error(f"Error fetching canvases: {e}")
            return []

    def save_canvas_node_positions(self, db: Session, canvas_id: str, nodes_data: List[Dict[str, Any]]) -> bool:
        try:
            for n in nodes_data:
                ent_id = str(n.get("entity_id") or n.get("id"))
                x = float(n.get("x", 0.0))
                y = float(n.get("y", 0.0))
                existing = db.query(models.CanvasNode).filter(
                    models.CanvasNode.canvas_id == canvas_id,
                    models.CanvasNode.entity_id == ent_id
                ).first()
                if existing:
                    existing.x = x
                    existing.y = y
                else:
                    new_node = models.CanvasNode(
                        id=models.gen_uuid(),
                        canvas_id=canvas_id,
                        entity_id=ent_id,
                        x=x,
                        y=y
                    )
                    db.add(new_node)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving canvas node positions: {e}")
            return False

    # --- Story Architect: Nested Narrative Groups ---
    def get_narrative_groups(self, db: Session, project_id: str) -> List[models.NarrativeGroup]:
        try:
            return db.query(models.NarrativeGroup).filter(models.NarrativeGroup.project_id == project_id).all()
        except Exception as e:
            db.rollback()
            logger.error(f"Error fetching narrative groups: {e}")
            return []

    def safe_delete_narrative_group(self, db: Session, group_id: str) -> bool:
        """
        Safely removes a group without ever cascade-deleting its child entities or subgroups.
        Child groups are promoted to parent_group_id = NULL.
        """
        try:
            grp = db.query(models.NarrativeGroup).filter(models.NarrativeGroup.id == group_id).first()
            if not grp:
                return False
            # Reparent children
            children = db.query(models.NarrativeGroup).filter(models.NarrativeGroup.parent_group_id == group_id).all()
            for ch in children:
                ch.parent_group_id = grp.parent_group_id
            db.delete(grp)
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            logger.error(f"Safe group deletion failed: {e}")
            return False

    # --- Story Architect: Attachments ---
    def get_project_attachments(self, db: Session, project_id: str) -> List[models.EntityAttachment]:
        try:
            return db.query(models.EntityAttachment).filter(models.EntityAttachment.project_id == project_id).all()
        except Exception as e:
            db.rollback()
            logger.error(f"Error fetching attachments: {e}")
            return []

    # --- Story Architect: Snapshots & Version Restoration ---
    def create_project_snapshot(
        self,
        db: Session,
        project_id: str,
        name: str,
        description: Optional[str] = None,
        is_milestone: bool = False
    ) -> Optional[models.ProjectSnapshot]:
        try:
            # Serialize complete universe state
            entities = self.get_entities(db, project_id)
            relationships = db.query(models.Relationship).filter(models.Relationship.project_id == project_id).all()
            facts = self.get_story_facts(db, project_id)
            canvases = self.get_canvases(db, project_id)

            snapshot_data = {
                "project_id": project_id,
                "timestamp": datetime.utcnow().isoformat(),
                "entities": [
                    {
                        "id": str(e.id),
                        "name": e.name,
                        "entity_type": e.entity_type,
                        "description": e.description,
                        "traits": e.traits,
                        "canon_status": getattr(e, "canon_status", "established"),
                        "protection_level": getattr(e, "protection_level", 1),
                        "custom_properties": getattr(e, "custom_properties", {})
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

            snap = models.ProjectSnapshot(
                id=models.gen_uuid(),
                project_id=project_id,
                name=name,
                description=description,
                is_milestone=is_milestone,
                snapshot_data=snapshot_data
            )
            db.add(snap)
            db.commit()
            db.refresh(snap)

            self.log_audit_action(
                db=db,
                project_id=project_id,
                action="create_snapshot",
                target_type="snapshot",
                target_id=str(snap.id),
                target_name=name,
                new_value={"is_milestone": is_milestone}
            )
            return snap
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating snapshot: {e}")
            return None

    def get_snapshots(self, db: Session, project_id: str) -> List[models.ProjectSnapshot]:
        try:
            return db.query(models.ProjectSnapshot).filter(
                models.ProjectSnapshot.project_id == project_id
            ).order_by(desc(models.ProjectSnapshot.created_at)).all()
        except Exception as e:
            db.rollback()
            logger.error(f"Error fetching snapshots: {e}")
            return []

    # --- Story Architect: Entity Matching Queue ---
    def get_matching_candidates(self, db: Session, project_id: str, status: str = "pending") -> List[models.EntityMatchingCandidate]:
        try:
            return db.query(models.EntityMatchingCandidate).filter(
                models.EntityMatchingCandidate.project_id == project_id,
                models.EntityMatchingCandidate.status == status
            ).all()
        except Exception as e:
            db.rollback()
            logger.error(f"Error fetching matching candidates: {e}")
            return []

    def clear_project_narrative_memory(self, db: Session, project_id: str) -> None:
        """
        Cleans up derived narrative memory when re-uploading a manuscript.
        """
        tables = [
            models.ContinuityIssue,
            models.TimelineEvent,
            models.Relationship,
            models.StoryFact,
            models.Entity,
            models.Passage,
            models.Chapter
        ]
        for tbl in tables:
            try:
                db.query(tbl).filter(tbl.project_id == project_id).delete()
                db.commit()
            except Exception:
                db.rollback()

memory_service = NarrativeMemoryService()
