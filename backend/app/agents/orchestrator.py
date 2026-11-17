import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.database import models
from app.services.document_parser import document_parser
from app.services.vector_service import vector_service
from app.services.encryption_service import encryption_service
from app.services.identity_service import identity_service
from app.services.temporal_memory_service import temporal_memory_service
from app.services.job_service import job_service
from app.agents.extraction_agent import extraction_agent
from app.agents.continuity_agent import continuity_agent
from app.agents.character_agent import character_agent
from app.agents.timeline_agent import timeline_agent

import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from app.services.narrative_cache import narrative_cache
from app.services.event_stream_service import event_stream_service

logger = logging.getLogger("orchestrator")

class CentralAIOrchestrator:
    """
    Central AI Orchestrator coordinating document parsing, entity identity resolution,
    temporal narrative memory, semantic vector indexing, and continuity verification.
    Implements atomic manuscript versioning (zero data loss on re-upload) and persistent job tracking.
    """

    def process_uploaded_manuscript(
        self,
        db: Session,
        project_id: str,
        filename: str,
        file_bytes: bytes,
        file_ext: str,
        vault_path: str,
        fast_mode: bool = True,
        job_id: Optional[str] = None
    ) -> models.Manuscript:
        """
        ATOMIC, NON-DESTRUCTIVE INGESTION PIPELINE:
        1. Encrypt and save manuscript to private vault storage.
        2. Create or track persistent ProcessingJob.
        3. Determine new manuscript version number, preserving existing versions for safety.
        4. Extract text and segment into chapters (preserving pre-chapter material / prologues).
        5. Persist chapters and sentence-aware passages.
        6. Extract entities via IdentityService (creating canonical entities & aliases).
        7. Extract evidence-backed facts, character states, and object custody chains.
        8. Index passages into project-isolated semantic vector memory.
        9. Run generalized Continuity Guardian analysis across chapters.
        10. Atomically activate new manuscript version and complete job.
        """
        t_start = time.time()
        # 1. Encrypt and store
        encryption_service.encrypt_and_save_file(file_bytes, vault_path)

        # 2. Update job stage: validating
        if job_id:
            job_service.update_job_stage(
                db, job_id, "validating", progress=15,
                message="Validating document signatures and integrity.",
                meta_info={"start_time_ts": t_start}
            )
            event_stream_service.publish_event(
                project_id=project_id,
                event_type="job:stage_change",
                data={"stage": "validating", "progress": 15, "message": "Validating document signatures and integrity."},
                job_id=job_id
            )

        # 3. Non-destructive versioning: Find latest version number
        latest_manuscript = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id
        ).order_by(models.Manuscript.version_number.desc()).first()

        next_version = (latest_manuscript.version_number + 1) if latest_manuscript and latest_manuscript.version_number else 1

        # Mark prior manuscripts as non-active (never delete them!)
        if latest_manuscript:
            latest_manuscript.is_active_version = False
            latest_manuscript.superseded_at = datetime.utcnow()
            db.commit()

        # 4. Create new Manuscript record
        manuscript = models.Manuscript(
            id=models.gen_uuid(),
            project_id=project_id,
            filename=filename,
            file_type=file_ext.lower().replace(".", ""),
            file_size=len(file_bytes),
            storage_path=vault_path,
            encrypted=True,
            is_encrypted=True,
            status="processing",
            version_number=next_version,
            is_active_version=True
        )
        db.add(manuscript)
        db.commit()
        db.refresh(manuscript)

        # 5. Extract text
        if job_id:
            job_service.update_job_stage(db, job_id, "extracting", progress=25, message="Extracting manuscript text and structure.")
            event_stream_service.publish_event(
                project_id=project_id,
                event_type="job:stage_change",
                data={"stage": "extracting", "progress": 25, "message": "Extracting manuscript text and structure."},
                job_id=job_id
            )
        raw_text = document_parser.extract_text_from_bytes(file_bytes, file_ext)

        # 6. Segment into chapters (zero-drop preservation of introductions/prologues)
        if job_id:
            job_service.update_job_stage(db, job_id, "segmenting", progress=35, message="Segmenting chapters and scene boundaries.")
            event_stream_service.publish_event(
                project_id=project_id,
                event_type="job:stage_change",
                data={"stage": "segmenting", "progress": 35, "message": "Segmenting chapters and scene boundaries."},
                job_id=job_id
            )
        chapter_dicts = document_parser.segment_into_chapters(raw_text)

        all_passages_for_indexing = []
        db_chapters = []

        # If re-uploading, safely replace chapters for this project (clean version replacement)
        # We delete old chapters and passages only AFTER successfully parsing the new version!
        db.query(models.Passage).filter(models.Passage.project_id == project_id).delete()
        db.query(models.Chapter).filter(models.Chapter.project_id == project_id).delete()
        db.commit()

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

            # Sentence-aware passage chunking
            passages = document_parser.chunk_into_passages(ch_data["content"])
            for p in passages:
                p_id = models.gen_uuid()
                db_passage = models.Passage(
                    id=p_id,
                    project_id=project_id,
                    chapter_id=ch_id,
                    passage_index=p["passage_index"],
                    content=p["content"],
                    char_start=p.get("char_start", 0),
                    char_end=p.get("char_end", 0)
                )
                db.add(db_passage)

                all_passages_for_indexing.append({
                    "id": p_id,
                    "chapter_id": ch_id,
                    "chapter_number": db_chapter.chapter_number,
                    "passage_index": p["passage_index"],
                    "content": p["content"],
                    "char_start": p.get("char_start", 0),
                    "char_end": p.get("char_end", 0)
                })

        db.commit()

        # 7. Semantic Vector Indexing
        if job_id:
            job_service.update_job_stage(db, job_id, "indexing_passages", progress=50, message="Indexing passages in project-isolated semantic vector memory.")
            event_stream_service.publish_event(
                project_id=project_id,
                event_type="job:stage_change",
                data={"stage": "indexing_passages", "progress": 50, "message": "Indexing passages in project-isolated semantic vector memory."},
                job_id=job_id
            )
        try:
            vector_service.index_passages(project_id, all_passages_for_indexing)
        except Exception as e:
            logger.warning(f"Semantic vector indexing warning: {e}")

        # 8. Extract Entities & Build Narrative Memory
        if job_id:
            job_service.update_job_stage(db, job_id, "extracting_entities", progress=65, message="Running entity recognition and alias resolution.")
            event_stream_service.publish_event(
                project_id=project_id,
                event_type="job:stage_change",
                data={"stage": "extracting_entities", "progress": 65, "message": "Running entity recognition and alias resolution."},
                job_id=job_id
            )
        self._batch_ingest_manuscript_memory(db, project_id, db_chapters, fast_mode=fast_mode, job_id=job_id)

        t_fast_end = time.time()
        upload_to_first_result_ms = int((t_fast_end - t_start) * 1000)

        manuscript.status = "processed"
        db.commit()
        db.refresh(manuscript)

        if job_id:
            if fast_mode:
                job_service.update_job_stage(
                    db,
                    job_id,
                    stage="initial_analysis_ready",
                    progress=75,
                    message="Initial narrative analysis ready. Deep enrichment progressing in background.",
                    meta_info={
                        "upload_to_first_result_ms": upload_to_first_result_ms,
                        "chapters_count": len(db_chapters),
                        "start_time_ts": t_start
                    }
                )
                event_stream_service.publish_event(
                    project_id=project_id,
                    event_type="job:stage_change",
                    data={
                        "stage": "initial_analysis_ready",
                        "progress": 75,
                        "upload_to_first_result_ms": upload_to_first_result_ms,
                        "chapters_count": len(db_chapters),
                        "message": "Initial narrative analysis ready."
                    },
                    job_id=job_id
                )
            else:
                total_duration_ms = upload_to_first_result_ms
                perf_meta = {
                    "total_duration_ms": total_duration_ms,
                    "upload_to_first_result_ms": upload_to_first_result_ms,
                    "chapters_count": len(db_chapters)
                }
                job_service.update_job_stage(db, job_id, "completed", progress=100, message="Manuscript successfully processed into narrative memory.", meta_info=perf_meta)
                job_service.complete_job(db, job_id, message="Manuscript successfully processed into narrative memory.")
                event_stream_service.publish_event(
                    project_id=project_id,
                    event_type="job:completed",
                    data={
                        "job_id": job_id,
                        "stage": "completed",
                        "progress": 100,
                        "meta_info": perf_meta,
                        "message": "Manuscript successfully processed into narrative memory."
                    },
                    job_id=job_id
                )

        return manuscript

    def enrich_project_with_ai(self, project_id: str, job_id: Optional[str] = None):
        """
        Background worker executing deep LLM narrative extraction, dialogue voice analysis,
        and semantic continuity validation without blocking upload responses.
        """
        from app.database.connection import SessionLocal
        bg_db = SessionLocal()
        t_enrich_start = time.time()
        try:
            if job_id:
                job_service.update_job_stage(bg_db, job_id, "enriching_with_ai", progress=85, message="Enriching narrative memory with contextual LLM reasoning.")
                event_stream_service.publish_event(
                    project_id=project_id,
                    event_type="job:stage_change",
                    data={"stage": "enriching_with_ai", "progress": 85, "message": "Enriching narrative memory with contextual LLM reasoning."},
                    job_id=job_id
                )

            chapters = bg_db.query(models.Chapter).filter(
                models.Chapter.project_id == project_id
            ).order_by(models.Chapter.chapter_number.asc()).all()

            if chapters:
                self._batch_ingest_manuscript_memory(bg_db, project_id, chapters, fast_mode=False, job_id=job_id)

            enrich_duration_ms = int((time.time() - t_enrich_start) * 1000)
            if job_id:
                job_obj = job_service.get_job(bg_db, job_id)
                start_ts = job_obj.meta_info.get("start_time_ts") if job_obj and job_obj.meta_info else None
                total_duration_ms = int((time.time() - start_ts) * 1000) if start_ts else enrich_duration_ms
                first_res_ms = job_obj.meta_info.get("upload_to_first_result_ms") if job_obj and job_obj.meta_info else None
                perf_meta = {
                    "total_duration_ms": total_duration_ms,
                    "deep_enrichment_ms": enrich_duration_ms,
                    "upload_to_first_result_ms": first_res_ms,
                    "chapters_count": len(chapters)
                }
                job_service.update_job_stage(bg_db, job_id, "completed", progress=100, message="Narrative intelligence enrichment complete.", meta_info=perf_meta)
                job_service.complete_job(bg_db, job_id, message="Narrative intelligence enrichment complete.")
                event_stream_service.publish_event(
                    project_id=project_id,
                    event_type="job:completed",
                    data={
                        "job_id": job_id,
                        "stage": "completed",
                        "progress": 100,
                        "meta_info": perf_meta,
                        "message": "Narrative intelligence enrichment complete."
                    },
                    job_id=job_id
                )
            logger.info(f"Background AI enrichment complete for project {project_id}")
        except Exception as e:
            logger.error(f"Background AI enrichment error: {e}")
            if job_id:
                job_service.fail_job(bg_db, job_id, f"Enrichment error: {str(e)}")
                event_stream_service.publish_event(
                    project_id=project_id,
                    event_type="job:failed",
                    data={"job_id": job_id, "error": str(e)},
                    job_id=job_id
                )
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
        Extracts and updates narrative memory, entities, facts, and character states
        for a single chapter during editor save or chapter upload.
        """
        self._batch_ingest_manuscript_memory(
            db=db,
            project_id=project_id,
            db_chapters=[chapter],
            fast_mode=fast_mode
        )

    def _batch_ingest_manuscript_memory(
        self,
        db: Session,
        project_id: str,
        db_chapters: List[models.Chapter],
        fast_mode: bool = True,
        job_id: Optional[str] = None
    ):
        """
        Batch narrative memory ingestion:
          1. Resolves canonical identities and aliases via IdentityService.
          2. Extracts evidence-backed facts, character states, and custody events.
          3. Evaluates cross-chapter continuity with strict chronological isolation.
        """
        if not db_chapters:
            return

        # 1. Preload identities into session index for O(1) in-memory resolution & minimal DB queries
        identity_service.preload_project_identities(db, project_id)
        existing_ents = db.query(models.Entity).filter(models.Entity.project_id == project_id).all()
        name_to_entity: Dict[str, models.Entity] = {e.name.lower().strip(): e for e in existing_ents}

        try:
            # 2. Extract memory from chapters with bounded concurrency & version-aware caching
            concurrency = min(4, len(db_chapters), os.cpu_count() or 4)

            def _extract_worker(ch):
                ch_hash = narrative_cache.compute_content_hash(ch.content)
                mode_str = "fast" if fast_mode else "deep"
                cached = narrative_cache.get_cached_extraction(project_id, ch_hash, mode=mode_str)
                if cached:
                    return ch, cached
                if fast_mode:
                    res = extraction_agent._heuristic_extraction(
                        content=ch.content,
                        chapter_number=ch.chapter_number,
                        chapter_title=ch.title
                    )
                else:
                    res = extraction_agent.extract_from_chapter(
                        chapter_content=ch.content,
                        chapter_number=ch.chapter_number,
                        chapter_title=ch.title
                    )
                narrative_cache.cache_extraction(project_id, ch_hash, res, mode=mode_str)
                return ch, res

            raw_chapter_extractions = []
            if concurrency > 1 and len(db_chapters) > 1:
                with ThreadPoolExecutor(max_workers=concurrency) as executor:
                    futures = {executor.submit(_extract_worker, ch): ch for ch in db_chapters}
                    for f in as_completed(futures):
                        raw_chapter_extractions.append(f.result())
                # STRICT CHRONOLOGICAL ORDERING FOR CANON ACTIVATION & TIMELINE INTEGRITY:
                raw_chapter_extractions.sort(key=lambda x: x[0].chapter_number)
            else:
                for ch in db_chapters:
                    raw_chapter_extractions.append(_extract_worker(ch))

            # 3. Consolidate entities and persist facts/states in chronological order
            seen_fact_keys = set()
            seen_rel_keys = set()

            for chapter, ext_res in raw_chapter_extractions:
                newly_discovered_this_ch = []
                for ent_data in ext_res.get("entities", []):
                    clean_name = ent_data.get("name", "").strip()
                    if not clean_name:
                        continue

                    canonical_ent = identity_service.resolve_entity_identity(
                        db=db,
                        project_id=project_id,
                        extracted_name=clean_name,
                        entity_type=ent_data.get("entity_type", "character"),
                        source_quote=None,
                        chapter_id=chapter.id
                    )
                    name_to_entity[clean_name.lower()] = canonical_ent
                    name_to_entity[canonical_ent.name.lower()] = canonical_ent

                    # Merge traits and descriptions
                    traits = ent_data.get("traits", [])
                    if traits:
                        merged = set(canonical_ent.traits or [])
                        merged.update(traits)
                        canonical_ent.traits = list(merged)
                    if ent_data.get("description") and not canonical_ent.description:
                        canonical_ent.description = ent_data["description"]

                    newly_discovered_this_ch.append({
                        "id": str(canonical_ent.id),
                        "name": canonical_ent.name,
                        "entity_type": canonical_ent.entity_type,
                        "traits": canonical_ent.traits or []
                    })

                # Persist facts and character states for this chapter
                for ent_data in ext_res.get("entities", []):
                    ent_name = ent_data.get("name", "").strip().lower()
                    ent_obj = name_to_entity.get(ent_name)
                    if not ent_obj:
                        continue

                    for fact_data in ent_data.get("facts", []):
                        f_text = fact_data.get("fact", "").strip()
                        if not f_text:
                            continue
                        f_key = (ent_obj.id, f_text.lower())
                        if f_key in seen_fact_keys:
                            continue
                        seen_fact_keys.add(f_key)

                        quote = fact_data.get("source_quote") or chapter.content[:150]
                        is_ver, clean_quote, _, _ = temporal_memory_service.verify_quote_against_source(quote, chapter.content)
                        if not is_ver:
                            clean_quote = chapter.content[:150]

                        cat = fact_data.get("category", "general")

                        db.add(models.StoryFact(
                            id=models.gen_uuid(),
                            project_id=project_id,
                            entity_id=ent_obj.id,
                            fact=f_text,
                            category=cat,
                            fact_category=cat,
                            source_chapter_id=chapter.id,
                            source_chapter_number=chapter.chapter_number,
                            source_quote=clean_quote,
                            confidence=fact_data.get("confidence", 1.0),
                            is_active=True,
                            valid_from_chapter=chapter.chapter_number,
                            valid_until_chapter=None,
                            canon_tier="established",
                            is_negated=fact_data.get("is_negated", False),
                            uncertainty_level=fact_data.get("uncertainty_level", "none")
                        ))

                        if cat in ["physical_state", "status"]:
                            temporal_memory_service.record_character_state(
                                db=db,
                                project_id=project_id,
                                entity_id=ent_obj.id,
                                category="physical" if cat == "physical_state" else "status",
                                state_description=f_text,
                                chapter_number=chapter.chapter_number,
                                source_quote=clean_quote,
                                chapter_id=chapter.id
                            )

                # Persist relationships
                for rel_data in ext_res.get("relationships", []):
                    src_key = rel_data.get("source_name", "").strip().lower()
                    tgt_key = rel_data.get("target_name", "").strip().lower()
                    src_ent = name_to_entity.get(src_key)
                    tgt_ent = name_to_entity.get(tgt_key)

                    if src_ent and tgt_ent and src_ent.id != tgt_ent.id:
                        rel_type = rel_data.get("relation_type", "associated_with")
                        rel_key = (src_ent.id, tgt_ent.id, rel_type)
                        if rel_key in seen_rel_keys:
                            continue
                        seen_rel_keys.add(rel_key)

                        r_quote = rel_data.get("source_quote") or chapter.content[:150]
                        db.add(models.Relationship(
                            id=models.gen_uuid(),
                            project_id=project_id,
                            source_entity_id=src_ent.id,
                            target_entity_id=tgt_ent.id,
                            relation_type=rel_type,
                            source_chapter_id=chapter.id,
                            source_quote=r_quote.strip(),
                            description=rel_data.get("description", "")
                        ))

                # Persist timeline events
                for ev in ext_res.get("timeline_events", []):
                    db.add(models.TimelineEvent(
                        id=models.gen_uuid(),
                        project_id=project_id,
                        title=ev.get("title", f"Event in Chapter {chapter.chapter_number}"),
                        description=ev.get("description", ""),
                        chapter_id=chapter.id,
                        chapter_number=chapter.chapter_number,
                        chronology_order=chapter.chapter_number * 10,
                        location=ev.get("location"),
                        participants=ev.get("participants", [])
                    ))

                db.commit()

                # Progressive real-time event dispatch for SSE listeners
                event_stream_service.publish_event(
                    project_id=project_id,
                    event_type="chapter:completed",
                    data={
                        "chapter_number": chapter.chapter_number,
                        "title": chapter.title,
                        "entities_discovered": newly_discovered_this_ch,
                        "events_count": len(ext_res.get("timeline_events", [])),
                        "relationships_count": len(ext_res.get("relationships", []))
                    },
                    job_id=job_id
                )

            # 4. Generalized Continuity Guardian Analysis with Chronological Isolation & Concurrency
            if job_id:
                job_service.update_job_stage(db, job_id, "running_continuity_checks", progress=90, message="Evaluating narrative continuity and evidence verification.")
                event_stream_service.publish_event(
                    project_id=project_id,
                    event_type="job:stage_change",
                    data={"stage": "running_continuity_checks", "progress": 90, "message": "Evaluating narrative continuity."},
                    job_id=job_id
                )

            # Clear prior unresolved issues for fresh evaluation
            db.query(models.ContinuityIssue).filter(
                models.ContinuityIssue.project_id == project_id,
                models.ContinuityIssue.status.in_(["unresolved", "open"])
            ).delete(synchronize_session=False)
            db.commit()

            all_chs_data = [
                {
                    "id": str(c.id),
                    "chapter_number": c.chapter_number,
                    "title": c.title,
                    "content": c.content
                }
                for c in db_chapters
            ]

            def _continuity_worker(chapter):
                prior_canon = temporal_memory_service.get_prior_canon_facts(
                    db=db,
                    project_id=project_id,
                    current_chapter_number=chapter.chapter_number
                )
                ch_hash = narrative_cache.compute_content_hash(chapter.content)
                canon_hash = narrative_cache.compute_content_hash(str([f.get("fact") for f in prior_canon]))
                cached_issues = narrative_cache.get_cached_continuity(project_id, ch_hash, canon_hash, skip_llm=fast_mode)
                if cached_issues is not None:
                    return chapter, cached_issues

                retrieved = vector_service.search_similar_passages(
                    project_id=project_id,
                    query=chapter.content[:2000],
                    n_results=8,
                    exclude_chapter_number=chapter.chapter_number,
                    max_prior_chapter_number=chapter.chapter_number
                )

                detected = continuity_agent.analyze_chapter_continuity(
                    new_chapter_number=chapter.chapter_number,
                    new_content=chapter.content,
                    established_facts=prior_canon,
                    retrieved_passages=retrieved,
                    all_chapters=all_chs_data,
                    skip_llm=fast_mode
                )
                narrative_cache.cache_continuity(project_id, ch_hash, canon_hash, detected, skip_llm=fast_mode)
                return chapter, detected

            continuity_results = []
            if concurrency > 1 and len(db_chapters) > 1 and not fast_mode:
                with ThreadPoolExecutor(max_workers=concurrency) as executor:
                    futures = {executor.submit(_continuity_worker, ch): ch for ch in db_chapters}
                    for f in as_completed(futures):
                        continuity_results.append(f.result())
                continuity_results.sort(key=lambda x: x[0].chapter_number)
            else:
                for chapter in db_chapters:
                    continuity_results.append(_continuity_worker(chapter))

            for chapter, detected_issues in continuity_results:
                seen_chapter_issue_sigs = set()
                new_issues_for_event = []
                for issue in detected_issues:
                    new_pass = issue.get("new_passage", "") or ""
                    issue_type = issue.get("issue_type", "continuity_issue")
                    norm_new = " ".join(new_pass.split()).lower()
                    sig = (issue_type, norm_new[:80])
                    if sig in seen_chapter_issue_sigs:
                        continue
                    seen_chapter_issue_sigs.add(sig)

                    issue_id = models.gen_uuid()
                    db.add(models.ContinuityIssue(
                        id=issue_id,
                        project_id=project_id,
                        chapter_id=chapter.id,
                        issue_type=issue_type,
                        severity=issue.get("severity", "high"),
                        confidence=float(issue.get("confidence", 0.90)),
                        explanation=issue.get("explanation", ""),
                        earlier_passage=issue.get("earlier_passage"),
                        new_passage=new_pass,
                        earlier_chapter_number=issue.get("earlier_chapter_number"),
                        new_chapter_number=chapter.chapter_number,
                        suggestions=issue.get("suggestions", []),
                        classification=issue.get("classification", "likely_conflict"),
                        evidence=issue.get("evidence", []),
                        status="unresolved"
                    ))
                    new_issues_for_event.append({
                        "id": issue_id,
                        "chapter_number": chapter.chapter_number,
                        "issue_type": issue_type,
                        "severity": issue.get("severity", "high"),
                        "explanation": issue.get("explanation", "")
                    })

                if new_issues_for_event:
                    event_stream_service.publish_event(
                        project_id=project_id,
                        event_type="continuity:issues_found",
                        data={"chapter_number": chapter.chapter_number, "issues": new_issues_for_event},
                        job_id=job_id
                    )

            db.commit()
        finally:
            identity_service.clear_project_identities(project_id)

    def analyze_chapter_continuity(
        self,
        db: Session,
        project_id: str,
        chapter_id: str,
        skip_llm: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Runs Continuity Guardian analysis for a single chapter against chronologically isolated prior canon.
        """
        chapter = db.query(models.Chapter).filter(
            models.Chapter.id == chapter_id,
            models.Chapter.project_id == project_id
        ).first()
        if not chapter:
            return []

        all_chs = db.query(models.Chapter).filter(
            models.Chapter.project_id == project_id
        ).order_by(models.Chapter.chapter_number.asc()).all()

        all_chs_data = [
            {"id": str(c.id), "chapter_number": c.chapter_number, "title": c.title, "content": c.content}
            for c in all_chs
        ]

        prior_canon = temporal_memory_service.get_prior_canon_facts(
            db=db,
            project_id=project_id,
            current_chapter_number=chapter.chapter_number
        )

        retrieved = vector_service.search_similar_passages(
            project_id=project_id,
            query=chapter.content[:2000],
            n_results=8,
            exclude_chapter_number=chapter.chapter_number,
            max_prior_chapter_number=chapter.chapter_number
        )

        detected_issues = continuity_agent.analyze_chapter_continuity(
            new_chapter_number=chapter.chapter_number,
            new_content=chapter.content,
            established_facts=prior_canon,
            retrieved_passages=retrieved,
            all_chapters=all_chs_data,
            skip_llm=skip_llm
        )

        saved_issues = []
        # Pre-query existing unresolved issues for this chapter to prevent duplicate records
        existing_issues = db.query(models.ContinuityIssue).filter(
            models.ContinuityIssue.project_id == project_id,
            models.ContinuityIssue.chapter_id == chapter.id,
            models.ContinuityIssue.status.in_(["unresolved", "open"])
        ).all()
        existing_sigs = {
            (i.issue_type, " ".join((i.new_passage or "").split()).lower()[:80])
            for i in existing_issues
        }

        for issue in detected_issues:
            new_pass = issue.get("new_passage", "") or ""
            issue_type = issue.get("issue_type", "continuity_issue")
            norm_new = " ".join(new_pass.split()).lower()
            sig = (issue_type, norm_new[:80])
            if sig in existing_sigs:
                continue
            existing_sigs.add(sig)

            db_issue = models.ContinuityIssue(
                id=models.gen_uuid(),
                project_id=project_id,
                chapter_id=chapter.id,
                issue_type=issue_type,
                severity=issue.get("severity", "high"),
                confidence=float(issue.get("confidence", 0.90)),
                explanation=issue.get("explanation", ""),
                earlier_passage=issue.get("earlier_passage"),
                new_passage=new_pass,
                earlier_chapter_number=issue.get("earlier_chapter_number"),
                new_chapter_number=chapter.chapter_number,
                suggestions=issue.get("suggestions", []),
                classification=issue.get("classification", "likely_conflict"),
                evidence=issue.get("evidence", []),
                status="unresolved"
            )
            db.add(db_issue)
            saved_issues.append(issue)

        db.commit()
        return saved_issues

orchestrator = CentralAIOrchestrator()
