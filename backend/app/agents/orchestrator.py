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
        ent_ids = db.query(models.Entity.id).filter(models.Entity.project_id == project_id)
        db.query(models.EntityAttachmentLink).filter(models.EntityAttachmentLink.entity_id.in_(ent_ids)).delete(synchronize_session=False)
        db.query(models.CanvasNode).filter(models.CanvasNode.entity_id.in_(ent_ids)).delete(synchronize_session=False)
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

        # 7. High-performance batch ingestion of narrative memory & continuity analysis
        self._batch_ingest_manuscript_memory(db, project_id, db_chapters, fast_mode=fast_mode)

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

            self._batch_ingest_manuscript_memory(bg_db, project_id, chapters, fast_mode=False)
            logger.info(f"Background AI enrichment complete for project {project_id}")
        except Exception as e:
            logger.warning(f"Background AI enrichment warning: {e}")
        finally:
            bg_db.close()

    def _batch_ingest_manuscript_memory(
        self,
        db: Session,
        project_id: str,
        db_chapters: List[models.Chapter],
        fast_mode: bool = True
    ):
        """
        High-performance, single-pass batch persistence for manuscript ingestion.
        Eliminates hundreds of sequential remote database round-trips by:
          1. Aggregating entities, facts, relationships, timeline events across all chapters in memory.
          2. Batch-flushing entities in a single round-trip to resolve all IDs.
          3. Batch-inserting facts, relationships, timeline events, and detected continuity issues.
          4. Committing once, reducing ingestion time from minutes down to seconds.
        """
        if not db_chapters:
            return

        # 1. Load existing entities for this project to handle deduplication in memory
        existing_ents = db.query(models.Entity).filter(models.Entity.project_id == project_id).all()
        entity_name_to_id: Dict[str, str] = {e.name.strip().lower(): e.id for e in existing_ents}
        entity_name_to_obj: Dict[str, models.Entity] = {e.name.strip().lower(): e for e in existing_ents}

        new_entities: List[models.Entity] = []
        raw_chapter_extractions = []

        # 2. Extract memory from each chapter (deterministic / heuristic in fast_mode)
        for chapter in db_chapters:
            if fast_mode:
                ext_res = extraction_agent._heuristic_extraction(
                    content=chapter.content,
                    chapter_number=chapter.chapter_number,
                    chapter_title=chapter.title
                )
            else:
                ext_res = extraction_agent.extract_from_chapter(
                    chapter_content=chapter.content,
                    chapter_number=chapter.chapter_number,
                    chapter_title=chapter.title
                )
            raw_chapter_extractions.append((chapter, ext_res))

            # Register entities in memory
            for ent_data in ext_res.get("entities", []):
                clean_name = ent_data.get("name", "").strip()
                if not clean_name:
                    continue
                key = clean_name.lower()
                traits = list(set(ent_data.get("traits", [])))
                desc = ent_data.get("description", "")

                if key in entity_name_to_obj:
                    # Update existing entity in memory
                    existing = entity_name_to_obj[key]
                    if desc and not existing.description:
                        existing.description = desc
                    if traits:
                        merged = set(existing.traits or [])
                        merged.update(traits)
                        existing.traits = list(merged)
                else:
                    new_id = models.gen_uuid()
                    new_ent = models.Entity(
                        id=new_id,
                        project_id=project_id,
                        name=clean_name,
                        entity_type=ent_data.get("entity_type", "character").lower().strip(),
                        description=desc,
                        traits=traits,
                        first_appearance_chapter=chapter.chapter_number,
                        first_appearance_chapter_id=chapter.id,
                        meta_info={}
                    )
                    db.add(new_ent)
                    new_entities.append(new_ent)
                    entity_name_to_id[key] = new_id
                    entity_name_to_obj[key] = new_ent

        # Flush entities once to guarantee foreign key IDs exist
        if new_entities:
            db.flush()

        # 3. Batch persist facts and relationships
        seen_fact_keys = set()
        seen_rel_keys = set()

        for chapter, ext_res in raw_chapter_extractions:
            for ent_data in ext_res.get("entities", []):
                clean_name = ent_data.get("name", "").strip().lower()
                ent_id = entity_name_to_id.get(clean_name)
                if not ent_id:
                    continue

                for fact_data in ent_data.get("facts", []):
                    f_text = fact_data.get("fact", "").strip()
                    if not f_text:
                        continue
                    f_key = (ent_id, f_text.lower())
                    if f_key in seen_fact_keys:
                        continue
                    seen_fact_keys.add(f_key)

                    quote = fact_data.get("source_quote") or ""
                    if not quote.strip():
                        for sent in chapter.content.split(". "):
                            if clean_name in sent.lower():
                                quote = sent.strip() + "."
                                break
                        if not quote.strip():
                            quote = chapter.content[:150]

                    db.add(models.StoryFact(
                        id=models.gen_uuid(),
                        project_id=project_id,
                        entity_id=ent_id,
                        fact=f_text,
                        category=fact_data.get("category", "general"),
                        fact_category=fact_data.get("category", "general"),
                        source_chapter_id=chapter.id,
                        source_chapter_number=chapter.chapter_number,
                        source_quote=quote.strip(),
                        confidence=fact_data.get("confidence", 1.0),
                        is_active=True
                    ))

            for rel_data in ext_res.get("relationships", []):
                src_key = rel_data.get("source_name", "").strip().lower()
                tgt_key = rel_data.get("target_name", "").strip().lower()
                src_id = entity_name_to_id.get(src_key)
                tgt_id = entity_name_to_id.get(tgt_key)

                if src_id and tgt_id and src_id != tgt_id:
                    rel_type = rel_data.get("relation_type", "associated_with")
                    rel_key = (src_id, tgt_id, rel_type)
                    if rel_key in seen_rel_keys:
                        continue
                    seen_rel_keys.add(rel_key)

                    rel_quote = rel_data.get("source_quote") or ""
                    if not rel_quote.strip():
                        for sent in chapter.content.split(". "):
                            if rel_data.get("source_name", "").lower() in sent.lower() and rel_data.get("target_name", "").lower() in sent.lower():
                                rel_quote = sent.strip() + "."
                                break
                        if not rel_quote.strip():
                            rel_quote = chapter.content[:150]

                    db.add(models.Relationship(
                        id=models.gen_uuid(),
                        project_id=project_id,
                        source_entity_id=src_id,
                        target_entity_id=tgt_id,
                        relation_type=rel_type,
                        source_chapter_id=chapter.id,
                        source_quote=rel_quote.strip(),
                        description=rel_data.get("description", "")
                    ))

            # 4. Timeline Events
            tl_events = timeline_agent.extract_events_from_chapter(
                chapter_content=chapter.content,
                chapter_number=chapter.chapter_number,
                chapter_title=chapter.title
            )
            for ev in tl_events:
                db.add(models.TimelineEvent(
                    id=models.gen_uuid(),
                    project_id=project_id,
                    title=ev.get("title", f"Events in Chapter {chapter.chapter_number}"),
                    description=ev.get("description", ""),
                    chapter_id=chapter.id,
                    chapter_number=chapter.chapter_number,
                    chronology_order=chapter.chapter_number,
                    date_or_time_label=ev.get("date_or_time_label"),
                    participants=ev.get("participants", []),
                    location=ev.get("location")
                ))

            for ev_data in ext_res.get("timeline_events", []):
                db.add(models.TimelineEvent(
                    id=models.gen_uuid(),
                    project_id=project_id,
                    title=ev_data.get("title", f"Event in Chapter {chapter.chapter_number}"),
                    description=ev_data.get("description", ""),
                    chapter_id=chapter.id,
                    chapter_number=chapter.chapter_number,
                    chronology_order=chapter.chapter_number,
                    location=ev_data.get("location"),
                    participants=ev_data.get("participants", [])
                ))

        # 5. Fast-path Continuity Guardian analysis across all chapters
        all_chs_data = [
            {
                "id": str(c.id),
                "chapter_number": c.chapter_number,
                "title": c.title,
                "content": c.content
            }
            for c in db_chapters
        ]

        # In-memory facts for continuity verification
        in_memory_facts = []
        for chapter, ext_res in raw_chapter_extractions:
            for ent_data in ext_res.get("entities", []):
                for fact_data in ent_data.get("facts", []):
                    in_memory_facts.append({
                        "fact": fact_data.get("fact", ""),
                        "category": fact_data.get("category", "general"),
                        "source_chapter_number": chapter.chapter_number,
                        "source_quote": fact_data.get("source_quote", ""),
                        "entity_name": ent_data.get("name", "")
                    })

        for chapter in db_chapters:
            detected_issues = continuity_agent.analyze_chapter_continuity(
                new_chapter_number=chapter.chapter_number,
                new_content=chapter.content,
                established_facts=in_memory_facts,
                all_chapters=all_chs_data,
                skip_llm=fast_mode
            )
            for issue_dict in detected_issues:
                conf = float(issue_dict.get("confidence", 0.90))
                db.add(models.ContinuityIssue(
                    id=models.gen_uuid(),
                    project_id=project_id,
                    chapter_id=chapter.id,
                    issue_type=issue_dict.get("issue_type", "continuity_issue"),
                    severity=issue_dict.get("severity", "high"),
                    confidence=conf,
                    explanation=issue_dict.get("explanation", ""),
                    earlier_passage=issue_dict.get("earlier_passage"),
                    new_passage=issue_dict.get("new_passage"),
                    earlier_chapter_number=issue_dict.get("earlier_chapter_number"),
                    new_chapter_number=chapter.chapter_number,
                    suggestions=issue_dict.get("suggestions", []),
                    classification=issue_dict.get("classification", "likely_conflict"),
                    evidence=issue_dict.get("evidence"),
                    status="unresolved"
                ))

        # Single batch commit for all narrative memory
        db.commit()

    def _extract_and_persist_chapter_memory(
        self,
        db: Session,
        project_id: str,
        chapter: models.Chapter,
        fast_mode: bool = False
    ):
        """
        Runs Narrative Extraction Agent and stores entities, facts, relationships, and timeline events
        using memory_service with strict source evidence.
        """
        from app.services.memory_service import memory_service

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

        entity_name_to_id: Dict[str, str] = {}

        # 1. Persist Entities & Facts via memory_service
        for ent_data in extraction_result.get("entities", []):
            db_entity = memory_service.save_or_update_entity(
                db=db,
                project_id=project_id,
                name=ent_data["name"].strip(),
                entity_type=ent_data.get("entity_type", "character"),
                description=ent_data.get("description", ""),
                traits=ent_data.get("traits", []),
                first_appearance_chapter=chapter.chapter_number,
                first_appearance_chapter_id=chapter.id
            )
            entity_name_to_id[db_entity.name.lower()] = db_entity.id

            # Persist facts strictly requiring source evidence
            for fact_data in ent_data.get("facts", []):
                quote = fact_data.get("source_quote") or ""
                if not quote.strip():
                    # Fallback to first sentence mentioning the entity
                    for sent in chapter.content.split(". "):
                        if db_entity.name.lower() in sent.lower():
                            quote = sent.strip() + "."
                            break
                    if not quote.strip():
                        quote = chapter.content[:150]

                memory_service.save_story_fact(
                    db=db,
                    project_id=project_id,
                    entity_id=db_entity.id,
                    fact=fact_data["fact"],
                    source_chapter_id=chapter.id,
                    source_quote=quote,
                    source_chapter_number=chapter.chapter_number,
                    category=fact_data.get("category", "general"),
                    confidence=fact_data.get("confidence", 1.0)
                )

        # 2. Persist Relationships via memory_service
        all_ents = memory_service.get_entities(db, project_id)
        for e in all_ents:
            entity_name_to_id[e.name.lower()] = e.id

        for rel_data in extraction_result.get("relationships", []):
            src_key = rel_data.get("source_name", "").strip().lower()
            tgt_key = rel_data.get("target_name", "").strip().lower()

            src_id = entity_name_to_id.get(src_key)
            tgt_id = entity_name_to_id.get(tgt_key)

            if src_id and tgt_id and src_id != tgt_id:
                rel_quote = rel_data.get("source_quote") or ""
                if not rel_quote.strip():
                    for sent in chapter.content.split(". "):
                        if rel_data.get("source_name", "").lower() in sent.lower() and rel_data.get("target_name", "").lower() in sent.lower():
                            rel_quote = sent.strip() + "."
                            break
                    if not rel_quote.strip():
                        rel_quote = chapter.content[:150]

                memory_service.save_relationship(
                    db=db,
                    project_id=project_id,
                    source_entity_id=src_id,
                    target_entity_id=tgt_id,
                    relation_type=rel_data.get("relation_type", "associated_with"),
                    source_chapter_id=chapter.id,
                    source_quote=rel_quote,
                    description=rel_data.get("description", "")
                )

        # 3. Persist Timeline Events via timeline_agent & memory_service
        tl_events = timeline_agent.extract_events_from_chapter(
            chapter_content=chapter.content,
            chapter_number=chapter.chapter_number,
            chapter_title=chapter.title
        )
        for ev in tl_events:
            memory_service.save_timeline_event(
                db=db,
                project_id=project_id,
                title=ev.get("title", f"Events in Chapter {chapter.chapter_number}"),
                description=ev.get("description", ""),
                chapter_id=chapter.id,
                chapter_number=chapter.chapter_number,
                chronology_order=chapter.chapter_number,
                date_or_time_label=ev.get("date_or_time_label"),
                participants=ev.get("participants", []),
                location=ev.get("location")
            )

        for ev_data in extraction_result.get("timeline_events", []):
            memory_service.save_timeline_event(
                db=db,
                project_id=project_id,
                title=ev_data.get("title", f"Event in Chapter {chapter.chapter_number}"),
                description=ev_data.get("description", ""),
                chapter_id=chapter.id,
                chapter_number=chapter.chapter_number,
                chronology_order=chapter.chapter_number,
                location=ev_data.get("location"),
                participants=ev_data.get("participants", [])
            )

    def analyze_chapter_continuity(
        self,
        db: Session,
        project_id: str,
        chapter_id: str,
        skip_llm: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Executes Continuity Guardian analysis for a specific chapter against established canon.
        Fetches all chapters for project from database, auto-extracts if canon memory is empty,
        and runs hybrid cross-chapter continuity analysis.
        """
        from app.services.memory_service import memory_service

        chapter = memory_service.get_chapter(db, project_id, chapter_id)
        if not chapter:
            return []

        # 1. Fetch all chapters for this project directly from database
        all_chs = memory_service.get_chapters(db, project_id)
        all_chs_data = [
            {
                "id": str(c.id),
                "chapter_number": c.chapter_number,
                "title": c.title,
                "content": c.content
            }
            for c in all_chs
        ]

        # 2. Check if project currently has 0 entities or 0 facts in DB; auto-extract if needed
        existing_facts = memory_service.get_story_facts(db, project_id)
        existing_ents = memory_service.get_entities(db, project_id)
        if len(existing_facts) == 0 or len(existing_ents) == 0:
            logger.info(f"Project {project_id} has no extracted memory. Running extraction across {len(all_chs)} chapters...")
            for ch_item in all_chs:
                try:
                    self._extract_and_persist_chapter_memory(db, project_id, ch_item, fast_mode=True)
                except Exception as e:
                    logger.warning(f"Auto-extraction for chapter {ch_item.chapter_number} failed: {e}")
            existing_facts = memory_service.get_story_facts(db, project_id)
            existing_ents = memory_service.get_entities(db, project_id)

        established_facts = [
            {
                "id": str(getattr(f, "id", "") or f.get("id")),
                "fact": getattr(f, "fact", "") or f.get("fact", ""),
                "category": getattr(f, "category", "general") or f.get("category", "general"),
                "source_chapter_number": getattr(f, "source_chapter_number", 1) or f.get("source_chapter_number", 1),
                "source_quote": getattr(f, "source_quote", "") or f.get("source_quote", ""),
                "entity_name": getattr(f, "entity", None).name if getattr(f, "entity", None) else ""
            }
            for f in existing_facts
        ]

        # 3. Retrieve relevant earlier passages from vector search (or SQL fallback)
        retrieved_passages = vector_service.search_similar_passages(
            project_id=project_id,
            query=chapter.content[:500],
            n_results=5,
            exclude_chapter_number=chapter.chapter_number
        )

        # 4. Continuity Guardian analysis with full cross-chapter text comparison
        detected_issues = continuity_agent.analyze_chapter_continuity(
            new_chapter_number=chapter.chapter_number,
            new_content=chapter.content,
            established_facts=established_facts,
            retrieved_passages=retrieved_passages,
            all_chapters=all_chs_data,
            entities=existing_ents,
            skip_llm=skip_llm
        )

        # 5. Save detected issues using schema-safe memory_service
        saved_db_issues = []
        for issue_dict in detected_issues:
            db_issue = memory_service.save_continuity_issue(
                db=db,
                project_id=project_id,
                chapter_id=chapter.id,
                issue_type=issue_dict.get("issue_type", "continuity_issue"),
                severity=issue_dict.get("severity", "high"),
                confidence=issue_dict.get("confidence", 0.90),
                explanation=issue_dict.get("explanation", ""),
                earlier_passage=issue_dict.get("earlier_passage"),
                new_passage=issue_dict.get("new_passage"),
                earlier_chapter_number=issue_dict.get("earlier_chapter_number"),
                new_chapter_number=chapter.chapter_number,
                suggestions=issue_dict.get("suggestions", []),
                classification=issue_dict.get("classification", "likely_conflict"),
                evidence=issue_dict.get("evidence"),
                status="unresolved"
            )
            if db_issue:
                saved_db_issues.append(db_issue)

        return saved_db_issues

orchestrator = CentralAIOrchestrator()

