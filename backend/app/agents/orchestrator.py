import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.database import models
from app.services.document_parser import document_parser
from app.services.vector_service import vector_service
from app.services.encryption_service import encryption_service
from app.agents.extraction_agent import extraction_agent
from app.agents.continuity_agent import continuity_agent
from app.agents.character_agent import character_agent
from app.agents.timeline_agent import timeline_agent

logger = logging.getLogger("orchestrator")

class CentralAIOrchestrator:
    """
    Coordinates multi-agent AI execution, narrative memory persistence,
    vector indexing, and continuity analysis pipelines.
    """

    def process_uploaded_manuscript(
        self,
        db: Session,
        project_id: str,
        filename: str,
        file_bytes: bytes,
        file_ext: str,
        vault_path: str,
        fast_mode: bool = True
    ) -> models.Manuscript:
        """
        Full ingestion pipeline:
        1. Encrypt and save to vault storage.
        2. Extract text and segment into chapters.
        3. Clean up prior chapters if re-uploading to prevent duplicates.
        4. Save chapters and passages to database.
        5. Extract narrative memory (entities, relationships, facts, events).
        6. Index passages in ChromaDB.
        7. Run continuity checks on sequential chapters.
        """
        # 1. Encrypt and save
        encryption_service.encrypt_and_save_file(file_bytes, vault_path)

        # 2. Extract plain text
        raw_text = document_parser.extract_text_from_bytes(file_bytes, file_ext)

        # 3. Clean up prior data for this project to prevent duplicate chapters on re-upload
        db.query(models.ContinuityIssue).filter(models.ContinuityIssue.project_id == project_id).delete()
        db.query(models.TimelineEvent).filter(models.TimelineEvent.project_id == project_id).delete()
        db.query(models.Relationship).filter(models.Relationship.project_id == project_id).delete()
        db.query(models.StoryFact).filter(models.StoryFact.project_id == project_id).delete()
        db.query(models.Entity).filter(models.Entity.project_id == project_id).delete()
        db.query(models.Passage).filter(models.Passage.project_id == project_id).delete()
        db.query(models.Chapter).filter(models.Chapter.project_id == project_id).delete()
        db.commit()

        # 4. Create Manuscript DB record
        manuscript = models.Manuscript(
            project_id=project_id,
            filename=filename,
            file_type=file_ext.lower().replace(".", ""),
            file_size=len(file_bytes),
            storage_path=vault_path,
            encrypted=True,
            status="processing"
        )
        db.add(manuscript)
        db.commit()
        db.refresh(manuscript)

        # 5. Segment into chapters
        chapter_dicts = document_parser.segment_into_chapters(raw_text)

        all_passages_for_indexing = []
        db_chapters = []

        for ch_data in chapter_dicts:
            ch_id = models.gen_uuid()
            db_chapter = models.Chapter(
                id=ch_id,
                project_id=project_id,
                manuscript_id=manuscript.id,
                chapter_number=ch_data["chapter_number"],
                title=ch_data["title"],
                content=ch_data["content"],
                word_count=len(ch_data["content"].split())
            )
            db.add(db_chapter)
            db_chapters.append(db_chapter)

            # Chunk passages
            passages = document_parser.chunk_into_passages(ch_data["content"])
            for p in passages:
                p_id = models.gen_uuid()
                db_passage = models.Passage(
                    id=p_id,
                    project_id=project_id,
                    chapter_id=ch_id,
                    passage_index=p["passage_index"],
                    content=p["content"],
                    char_start=p["char_start"],
                    char_end=p["char_end"]
                )
                db.add(db_passage)

                all_passages_for_indexing.append({
                    "id": p_id,
                    "chapter_id": ch_id,
                    "chapter_number": db_chapter.chapter_number,
                    "passage_index": p["passage_index"],
                    "content": p["content"]
                })

        db.commit()

        # 6. Index all passages into ChromaDB
        try:
            vector_service.index_passages(project_id, all_passages_for_indexing)
        except Exception as e:
            logger.warning(f"Vector indexing skipped or encountered error: {e}")

        # 7. Extract narrative memory chapter-by-chapter
        for chapter in db_chapters:
            self._extract_and_persist_chapter_memory(db, project_id, chapter, fast_mode=fast_mode)

        # 8. Run continuity analysis for later chapters against earlier established memory
        for chapter in db_chapters:
            self.analyze_chapter_continuity(db, project_id, chapter.id, skip_llm=fast_mode)

        manuscript.status = "processed"
        db.commit()
        db.refresh(manuscript)

        return manuscript

    def enrich_project_with_ai(self, project_id: str):
        """
        Background task to run deeper LLM narrative extraction and continuity checks
        without blocking the upload HTTP response.
        """
        from app.database.connection import SessionLocal
        bg_db = SessionLocal()
        try:
            chapters = bg_db.query(models.Chapter).filter(
                models.Chapter.project_id == project_id
            ).order_by(models.Chapter.chapter_number.asc()).all()

            for chapter in chapters:
                self._extract_and_persist_chapter_memory(bg_db, project_id, chapter, fast_mode=False)

            for chapter in chapters:
                self.analyze_chapter_continuity(bg_db, project_id, chapter.id, skip_llm=False)
            logger.info(f"Background AI enrichment complete for project {project_id}")
        except Exception as e:
            logger.warning(f"Background AI enrichment warning: {e}")
        finally:
            bg_db.close()

    def _extract_and_persist_chapter_memory(
        self,
        db: Session,
        project_id: str,
        chapter: models.Chapter,
        fast_mode: bool = False
    ):
        """
        Runs Narrative Extraction Agent and stores entities, facts, and relationships.
        """
        if fast_mode:
            extraction_result = extraction_agent._heuristic_extraction(
                content=chapter.content,
                chapter_number=chapter.chapter_number,
                chapter_title=chapter.title
            )
        else:
            extraction_result = extraction_agent.extract_from_chapter(
                chapter_content=chapter.content,
                chapter_number=chapter.chapter_number,
                chapter_title=chapter.title
            )

        entity_name_to_db: Dict[str, models.Entity] = {}

        # Fetch existing entities to link or update
        existing_entities = db.query(models.Entity).filter(models.Entity.project_id == project_id).all()
        for e in existing_entities:
            entity_name_to_db[e.name.lower()] = e

        # Persist Entities & Facts
        for ent_data in extraction_result.get("entities", []):
            name_key = ent_data["name"].strip().lower()
            if name_key in entity_name_to_db:
                db_entity = entity_name_to_db[name_key]
                # Merge traits
                curr_traits = set(db_entity.traits or [])
                curr_traits.update(ent_data.get("traits", []))
                db_entity.traits = list(curr_traits)
            else:
                db_entity = models.Entity(
                    id=models.gen_uuid(),
                    project_id=project_id,
                    name=ent_data["name"].strip(),
                    entity_type=ent_data.get("entity_type", "character"),
                    description=ent_data.get("description", ""),
                    traits=ent_data.get("traits", []),
                    first_appearance_chapter=chapter.chapter_number
                )
                db.add(db_entity)
                entity_name_to_db[name_key] = db_entity

            # Persist story facts
            for fact_data in ent_data.get("facts", []):
                db_fact = models.StoryFact(
                    id=models.gen_uuid(),
                    project_id=project_id,
                    entity_id=db_entity.id,
                    fact=fact_data["fact"],
                    category=fact_data.get("category", "general"),
                    source_chapter_id=chapter.id,
                    source_chapter_number=chapter.chapter_number,
                    source_quote=fact_data.get("source_quote", ""),
                    confidence=fact_data.get("confidence", 1.0)
                )
                db.add(db_fact)

        # Persist Relationships
        for rel_data in extraction_result.get("relationships", []):
            src_key = rel_data.get("source_name", "").strip().lower()
            tgt_key = rel_data.get("target_name", "").strip().lower()

            if src_key in entity_name_to_db and tgt_key in entity_name_to_db:
                src_ent = entity_name_to_db[src_key]
                tgt_ent = entity_name_to_db[tgt_key]

                db_rel = models.Relationship(
                    id=models.gen_uuid(),
                    project_id=project_id,
                    source_entity_id=src_ent.id,
                    target_entity_id=tgt_ent.id,
                    relation_type=rel_data["relation_type"],
                    description=rel_data.get("description", ""),
                    source_chapter_id=chapter.id
                )
                db.add(db_rel)

        # Persist Timeline Events
        for ev_data in extraction_result.get("timeline_events", []):
            db_event = models.TimelineEvent(
                id=models.gen_uuid(),
                project_id=project_id,
                title=ev_data.get("title", f"Event in Chapter {chapter.chapter_number}"),
                description=ev_data.get("description", ""),
                chapter_id=chapter.id,
                chapter_number=chapter.chapter_number,
                chronology_order=chapter.chapter_number,
                location=ev_data.get("location"),
                participants=ev_data.get("participants", [])
            )
            db.add(db_event)

        db.commit()

    def analyze_chapter_continuity(
        self,
        db: Session,
        project_id: str,
        chapter_id: str,
        skip_llm: bool = False
    ) -> List[models.ContinuityIssue]:
        """
        Executes Continuity Guardian analysis for a specific chapter against established canon.
        """
        chapter = db.query(models.Chapter).filter(
            models.Chapter.id == chapter_id,
            models.Chapter.project_id == project_id
        ).first()

        if not chapter:
            return []

        # 1. Fetch established facts from earlier chapters
        facts_query = db.query(models.StoryFact).filter(
            models.StoryFact.project_id == project_id,
            models.StoryFact.source_chapter_number < chapter.chapter_number,
            models.StoryFact.is_active == True
        ).all()

        established_facts = [
            {
                "id": f.id,
                "fact": f.fact,
                "category": f.category,
                "source_chapter_number": f.source_chapter_number,
                "source_quote": f.source_quote,
                "entity_name": f.entity.name if f.entity else ""
            }
            for f in facts_query
        ]

        # 2. Retrieve relevant earlier passages from ChromaDB
        retrieved_passages = vector_service.search_similar_passages(
            project_id=project_id,
            query=chapter.content[:500],
            n_results=5,
            exclude_chapter_number=chapter.chapter_number
        )

        # 3. Continuity Guardian analysis
        detected_issues = continuity_agent.analyze_chapter_continuity(
            new_chapter_number=chapter.chapter_number,
            new_content=chapter.content,
            established_facts=established_facts,
            retrieved_passages=retrieved_passages,
            skip_llm=skip_llm
        )

        # 4. Save detected issues to database (avoid duplicate active issues)
        saved_db_issues = []
        for issue_dict in detected_issues:
            existing = db.query(models.ContinuityIssue).filter(
                models.ContinuityIssue.project_id == project_id,
                models.ContinuityIssue.chapter_id == chapter.id,
                models.ContinuityIssue.issue_type == issue_dict["issue_type"]
            ).first()

            if not existing:
                db_issue = models.ContinuityIssue(
                    project_id=project_id,
                    chapter_id=chapter.id,
                    issue_type=issue_dict["issue_type"],
                    severity=issue_dict.get("severity", "high"),
                    confidence=issue_dict.get("confidence", 0.90),
                    explanation=issue_dict["explanation"],
                    earlier_passage=issue_dict.get("earlier_passage"),
                    new_passage=issue_dict.get("new_passage"),
                    earlier_chapter_number=issue_dict.get("earlier_chapter_number"),
                    new_chapter_number=chapter.chapter_number,
                    suggestions=issue_dict.get("suggestions", []),
                    status="unresolved"
                )
                db.add(db_issue)
                db.commit()
                db.refresh(db_issue)
                saved_db_issues.append(db_issue)
            else:
                saved_db_issues.append(existing)

        return saved_db_issues

orchestrator = CentralAIOrchestrator()
