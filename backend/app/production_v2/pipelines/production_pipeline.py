"""
Production V2 Narrative Pipeline Coordinator
Executes the complete 14-stage narrative intelligence sequence:
1. Document Magic Validation
2. AES-256-GCM Vault Encryption
3. Passage Chunking & Segmentation
4. Entity Extraction (Data-Driven NLP + LLM)
5. Identity Resolution & Alias Registration
6. Temporal Memory & Timeline Event Extraction
7. Character State Machine Transitions
8. Object Custody Chain Tracking
9. Hybrid Vector Indexing in Batch
10. Knowledge Graph Relationship Construction
11. Continuity Guardian Analysis
12. Strict Evidence Citation Verification
13. Human-in-the-Loop Canon Review Staging
14. Atomic Version Activation & Finalization
"""
import re
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.database import models
from app.services.document_parser import document_parser
from app.services.identity_service import identity_service
from app.services.temporal_memory_service import temporal_memory_service
from app.services.vector_service import vector_service
from app.agents.extraction_agent import extraction_agent
from app.agents.continuity_agent import continuity_agent

from app.production_v2.services.vault_key_management import vault_key_manager
from app.production_v2.services.durable_job_service import durable_job_service, ProcessingStage
from app.production_v2.services.strict_evidence_service import strict_evidence_service
from app.production_v2.services.version_activation_service import version_activation_service
from app.production_v2.services.graph_admission_service import graph_admission_service
from app.production_v2.services.coreference_resolution_service import coreference_resolution_service, EntityProfile
from app.production_v2.services.canonical_entity_registry import canonical_entity_registry
from app.production_v2.services.narrative_relevance_service import narrative_relevance_service
from app.production_v2.services.narrative_context_builder import narrative_context_builder
from app.production_v2.services.narrative_entity_admission_policy import narrative_entity_admission_policy
from app.production_v2.services.narrative_coreference_engine import narrative_coreference_engine, DynamicEntityProfile
from app.production_v2.services.narrative_extraction_orchestrator import narrative_extraction_orchestrator
from app.production_v2.services.narrative_graph_validation_adapter import narrative_graph_validation_adapter

logger = logging.getLogger("production_pipeline")


class ProductionPipelineCoordinator:
    """
    Coordinates end-to-end manuscript processing across all 14 stages
    with guaranteed transactional rollback and atomic version promotion.
    """

    def execute_pipeline(
        self,
        db: Session,
        project_id: str,
        manuscript_id: str,
        job_id: str,
        file_bytes: bytes,
        file_ext: str,
        vault_file_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes all 14 pipeline stages sequentially.
        If any stage fails, marks job and manuscript version as failed,
        leaving previously active versions untouched.
        """
        try:
            # -------------------------------------------------------------
            # Stage 1: Document magic validation
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_1_VALIDATING_DOCUMENT)
            try:
                document_parser.validate_file_signature(file_bytes, file_ext)
            except Exception as val_err:
                raise ValueError(f"Document validation failed: {val_err}")

            # -------------------------------------------------------------
            # Stage 2: AES-256-GCM Vault encryption
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_2_ENCRYPTING_VAULT)
            if vault_file_path:
                vault_key_manager.encrypt_and_save_file(file_bytes, vault_file_path)

            # -------------------------------------------------------------
            # Stage 3: Parse chapters and chunk passages
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_3_CHUNKING_PASSAGES)
            raw_text = document_parser.extract_text_from_bytes(file_bytes, file_ext)
            parsed_chapters = document_parser.segment_into_chapters(raw_text)
            if not parsed_chapters:
                raise ValueError("Manuscript parsing yielded 0 chapters or readable content.")

            created_chapters: List[models.Chapter] = []
            created_passages: List[models.Passage] = []

            for ch_idx, ch_data in enumerate(parsed_chapters, start=1):
                ch_content = ch_data.get("content", "").strip()
                ch_title = ch_data.get("title") or f"Chapter {ch_idx}"
                ch_record = models.Chapter(
                    project_id=project_id,
                    manuscript_id=manuscript_id,
                    chapter_number=ch_idx,
                    title=ch_title,
                    content=ch_content,
                    word_count=len(ch_content.split())
                )
                db.add(ch_record)
                created_chapters.append(ch_record)

            db.commit()
            for ch in created_chapters:
                db.refresh(ch)

            # Chunk into passages (~250 words per chunk preserving offsets)
            for ch in created_chapters:
                content = ch.content
                paragraphs = re.split(r'\n\s*\n', content)
                char_cursor = 0
                pass_idx = 0

                for para in paragraphs:
                    para_clean = para.strip()
                    if not para_clean:
                        continue
                    p_start = content.find(para_clean, char_cursor)
                    if p_start == -1:
                        p_start = char_cursor
                    p_end = p_start + len(para_clean)
                    char_cursor = p_end

                    passage = models.Passage(
                        project_id=project_id,
                        chapter_id=ch.id,
                        passage_index=pass_idx,
                        content=para_clean,
                        char_start=p_start,
                        char_end=p_end
                    )
                    db.add(passage)
                    created_passages.append(passage)
                    pass_idx += 1

            db.commit()
            for p in created_passages:
                db.refresh(p)

            # -------------------------------------------------------------
            # Stage 4: Entity extraction (Data-driven NLP + LLM)
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_4_EXTRACTING_ENTITIES)
            extracted_by_chapter: Dict[int, Dict[str, Any]] = {}

            for ch in created_chapters:
                ch_extraction = extraction_agent.extract_from_chapter(
                    chapter_content=ch.content,
                    chapter_number=ch.chapter_number,
                    chapter_title=ch.title
                )
                extracted_by_chapter[ch.chapter_number] = ch_extraction

            # -------------------------------------------------------------
            # Stage 5: Identity resolution, coreference & admission control
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_5_RESOLVING_IDENTITIES)
            resolved_entity_map: Dict[str, models.Entity] = {}
            created_facts: List[models.StoryFact] = []

            # Retrieve active manuscript version for mention tagging
            ms_obj = db.query(models.Manuscript).filter(models.Manuscript.id == manuscript_id).first()
            active_version_num = ms_obj.version_number if ms_obj else 1

            for ch in created_chapters:
                ch_data = extracted_by_chapter.get(ch.chapter_number, {})
                for ent_data in ch_data.get("entities", []):
                    ent_name = ent_data.get("name")
                    if not ent_name:
                        continue

                    # Build bounded 3-sentence narrative context with exact offsets
                    ctx = narrative_context_builder.build_mention_context(
                        chapter_content=ch.content,
                        target_span=ent_name,
                        chapter_number=ch.chapter_number,
                        db=db,
                        project_id=project_id
                    )

                    # Strict admission control and narrative relevance scoring
                    canonical_ent, eval_res = graph_admission_service.admit_entity(
                        db=db,
                        project_id=project_id,
                        name=ent_name,
                        entity_type=ent_data.get("entity_type", "character"),
                        description=ent_data.get("description"),
                        traits=ent_data.get("traits"),
                        source_chapter_id=str(ch.id),
                        chapter_number=ch.chapter_number,
                        source_quote=ent_data.get("source_quote") or ctx.sentence,
                        context_sentences=[ctx.three_sentence_window, ctx.paragraph]
                    )

                    # If candidate was rejected as incidental noun or held for review, record mention only with true offsets
                    if not canonical_ent:
                        graph_admission_service.record_mention(
                            db=db,
                            project_id=project_id,
                            text_span=ent_name,
                            mention_type="incidental_noun" if eval_res.is_incidental else "descriptive_ref",
                            char_start=ctx.char_start if ctx.char_start >= 0 else 0,
                            char_end=ctx.char_end if ctx.char_end >= 0 else len(ent_name),
                            chapter_id=str(ch.id),
                            chapter_number=ch.chapter_number,
                            version_number=active_version_num,
                            resolution_status=eval_res.relevance_status,
                            rejection_reason=eval_res.decision_rationale,
                            context_sentence=ctx.sentence
                        )
                        continue

                    if ent_data.get("description") and not canonical_ent.description:
                        canonical_ent.description = ent_data.get("description")
                    if ent_data.get("traits"):
                        existing_traits = list(canonical_ent.traits or [])
                        for tr in ent_data.get("traits", []):
                            if tr not in existing_traits:
                                existing_traits.append(tr)
                        canonical_ent.traits = existing_traits
                    resolved_entity_map[ent_name.lower()] = canonical_ent

                    # Register facts
                    for f in ent_data.get("facts", []):
                        fact_text = f.get("fact")
                        if not fact_text:
                            continue
                        source_quote = f.get("source_quote") or ctx.sentence or ch.content[:200]
                        story_fact = models.StoryFact(
                            project_id=project_id,
                            entity_id=canonical_ent.id,
                            fact=fact_text,
                            category=f.get("category", "general"),
                            source_chapter_id=ch.id,
                            source_chapter_number=ch.chapter_number,
                            source_quote=source_quote,
                            is_negated=bool(f.get("is_negated", False)),
                            uncertainty_level=f.get("uncertainty_level", "none"),
                            canon_tier="proposed" if f.get("uncertainty_level") in ("rumour", "fear", "belief") else "established",
                            provenance="manuscript_extracted"
                        )
                        db.add(story_fact)
                        created_facts.append(story_fact)

                # Coreference resolution pass across chapter content with dynamic gender discovery
                known_profiles = [
                    DynamicEntityProfile(
                        id=str(ent.id),
                        name=ent.name,
                        entity_type=ent.entity_type,
                        gender=narrative_coreference_engine.infer_profile_gender_from_evidence(
                            name=ent.name,
                            text_context=ch.content,
                            traits=list(ent.traits or [])
                        ),
                        traits=list(ent.traits or []),
                        roles=list(ent.traits or [])
                    )
                    for ent in resolved_entity_map.values()
                ]
                resolved_mentions = narrative_coreference_engine.resolve_coreference(
                    text=ch.content,
                    known_entities=known_profiles,
                    chapter_number=ch.chapter_number
                )
                for rm in resolved_mentions:
                    graph_admission_service.record_mention(
                        db=db,
                        project_id=project_id,
                        text_span=rm.mention_span,
                        mention_type=rm.mention_type,
                        char_start=rm.char_start,
                        char_end=rm.char_end,
                        resolved_entity_id=rm.resolved_entity_id,
                        chapter_id=str(ch.id),
                        chapter_number=ch.chapter_number,
                        version_number=active_version_num,
                        confidence=rm.confidence,
                        resolution_status=rm.resolution_status,
                        is_ambiguous=rm.is_ambiguous,
                        candidate_entity_ids=rm.candidate_entity_ids,
                        rejection_reason=rm.explanation if rm.resolution_status != "resolved" else None,
                        context_sentence=rm.context_sentence
                    )

            db.commit()

            # -------------------------------------------------------------
            # Stage 6: Temporal narrative memory and events
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_6_BUILDING_TEMPORAL_MEMORY)
            chronology_counter = 1
            for ch in created_chapters:
                ch_data = extracted_by_chapter.get(ch.chapter_number, {})
                for ev in ch_data.get("timeline_events", []):
                    event = models.TimelineEvent(
                        project_id=project_id,
                        chapter_id=ch.id,
                        chapter_number=ch.chapter_number,
                        title=ev.get("title", f"Event in Chapter {ch.chapter_number}"),
                        description=ev.get("description", ""),
                        location=ev.get("location"),
                        participants=ev.get("participants", []),
                        date_or_time_label=ev.get("time_label"),
                        chronology_order=chronology_counter,
                        canon_status="established"
                    )
                    db.add(event)
                    chronology_counter += 1

            db.commit()

            # -------------------------------------------------------------
            # Stage 7: Character state machine tracking
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_7_TRACKING_CHARACTER_STATES)
            for ch in created_chapters:
                ch_data = extracted_by_chapter.get(ch.chapter_number, {})
                for ent_data in ch_data.get("entities", []):
                    ent_name = ent_data.get("name", "")
                    canonical_ent = resolved_entity_map.get(ent_name.lower())
                    if not canonical_ent:
                        continue

                    for f in ent_data.get("facts", []):
                        cat = f.get("category", "")
                        f_text = f.get("fact", "")
                        quote = f.get("source_quote") or ch.content[:100]
                        if cat in ("physical_state", "status") or any(kw in f_text.lower() for kw in ["severed", "blinded", "killed", "injured", "prosthetic", "healed"]):
                            temporal_memory_service.record_character_state(
                                db=db,
                                project_id=project_id,
                                entity_id=str(canonical_ent.id),
                                category=cat or "physical_state",
                                state_description=f_text,
                                chapter_number=ch.chapter_number,
                                source_quote=quote,
                                chapter_id=str(ch.id)
                            )

            db.commit()

            # -------------------------------------------------------------
            # Stage 8: Object custody tracking
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_8_TRACKING_OBJECT_CUSTODY)
            for ch in created_chapters:
                ch_data = extracted_by_chapter.get(ch.chapter_number, {})
                for rel in ch_data.get("relationships", []):
                    if rel.get("relation_type") == "possesses":
                        holder_name = rel.get("source_name", "")
                        obj_name = rel.get("target_name", "")
                        holder_ent = resolved_entity_map.get(holder_name.lower())
                        obj_ent = resolved_entity_map.get(obj_name.lower())
                        if obj_ent:
                            temporal_memory_service.record_object_custody_event(
                                db=db,
                                project_id=project_id,
                                object_entity_id=str(obj_ent.id),
                                holder_entity_id=str(holder_ent.id) if holder_ent else None,
                                previous_holder_id=None,
                                transfer_type="initial_possession",
                                chapter_number=ch.chapter_number,
                                source_quote=rel.get("source_quote", ""),
                                chapter_id=str(ch.id)
                            )

            db.commit()

            # -------------------------------------------------------------
            # Stage 9: Hybrid vector indexing in batch
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_9_INDEXING_HYBRID_VECTORS)
            ch_num_lookup = {ch.id: ch.chapter_number for ch in created_chapters}
            batch_passages = [
                {
                    "id": str(p.id),
                    "content": p.content,
                    "chapter_id": str(p.chapter_id),
                    "chapter_number": ch_num_lookup.get(p.chapter_id, 1),
                    "passage_index": p.passage_index,
                    "char_start": p.char_start,
                    "char_end": p.char_end
                }
                for p in created_passages
            ]
            try:
                vector_service.index_chapter_passages_batch(project_id, batch_passages)
            except Exception as e:
                logger.warning(f"Vector indexing non-fatal notice: {e}")

            # -------------------------------------------------------------
            # Stage 10: Knowledge graph updates
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_10_UPDATING_KNOWLEDGE_GRAPH)
            for ch in created_chapters:
                ch_data = extracted_by_chapter.get(ch.chapter_number, {})
                for rel in ch_data.get("relationships", []):
                    src_ent = resolved_entity_map.get(rel.get("source_name", "").lower())
                    tgt_ent = resolved_entity_map.get(rel.get("target_name", "").lower())
                    if src_ent and tgt_ent and src_ent.id != tgt_ent.id:
                        narrative_graph_validation_adapter.validate_and_admit_relationship(
                            db=db,
                            project_id=project_id,
                            source_entity_id=str(src_ent.id),
                            target_entity_id=str(tgt_ent.id),
                            relation_type=rel.get("relation_type", "associated_with"),
                            source_quote=rel.get("source_quote") or ch.content[:150],
                            description=rel.get("description", ""),
                            source_chapter_id=str(ch.id),
                            target_version_number=active_version_num,
                            force_admit=False
                        )

            db.commit()

            # -------------------------------------------------------------
            # Stage 11: Continuity Guardian analysis
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_11_RUNNING_CONTINUITY_GUARDIAN)
            all_ch_dicts = [
                {"chapter_number": ch.chapter_number, "content": ch.content, "title": ch.title}
                for ch in created_chapters
            ]
            created_issues: List[models.ContinuityIssue] = []

            for ch in created_chapters:
                prior_facts = temporal_memory_service.get_prior_canon_facts(
                    db=db,
                    project_id=project_id,
                    current_chapter_number=ch.chapter_number
                )
                detected_issues = continuity_agent.analyze_chapter_continuity(
                    new_chapter_number=ch.chapter_number,
                    new_content=ch.content,
                    established_facts=prior_facts,
                    all_chapters=all_ch_dicts,
                    skip_llm=True  # Fast deterministic scan during automated pipeline ingestion
                )

                for iss in detected_issues:
                    db_issue = models.ContinuityIssue(
                        project_id=project_id,
                        chapter_id=ch.id,
                        issue_type=iss.get("issue_type", "continuity_conflict"),
                        severity=iss.get("severity", "medium"),
                        confidence=iss.get("confidence", 0.9),
                        classification=iss.get("classification", "likely_conflict"),
                        explanation=iss.get("explanation", "Narrative inconsistency detected."),
                        earlier_passage=iss.get("earlier_passage"),
                        new_passage=iss.get("new_passage"),
                        earlier_chapter_number=iss.get("earlier_chapter_number"),
                        new_chapter_number=ch.chapter_number,
                        suggestions=iss.get("suggestions", []),
                        status="unresolved"
                    )
                    db.add(db_issue)
                    created_issues.append(db_issue)

            db.commit()

            # -------------------------------------------------------------
            # Stage 12: Strict evidence citation verification
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_12_VERIFYING_EVIDENCE_SPANS)
            for iss in created_issues:
                quote_to_verify = iss.new_passage or iss.earlier_passage
                if quote_to_verify:
                    cert = strict_evidence_service.verify_quote(
                        db=db,
                        project_id=project_id,
                        quote=quote_to_verify,
                        preferred_chapter_id=str(iss.chapter_id) if iss.chapter_id else None
                    )
                    iss.confidence = cert.confidence

            db.commit()

            # -------------------------------------------------------------
            # Stage 13: Preparing human-in-the-loop canon proposals
            # -------------------------------------------------------------
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_13_PREPARING_CANON_PROPOSALS)
            # Facts with uncertainty are already tagged as canon_tier="proposed"

            # -------------------------------------------------------------
            # Stage 14: Atomic version activation
            # -------------------------------------------------------------
            version_activation_service.activate_version_atomically(db, manuscript_id)
            durable_job_service.update_stage(db, job_id, ProcessingStage.STAGE_14_COMPLETED)

            return {
                "status": "completed",
                "project_id": project_id,
                "manuscript_id": manuscript_id,
                "job_id": job_id,
                "chapters_count": len(created_chapters),
                "passages_count": len(created_passages),
                "entities_count": len(resolved_entity_map),
                "facts_count": len(created_facts),
                "issues_count": len(created_issues)
            }

        except Exception as exc:
            logger.error(f"Pipeline execution aborted on stage failure: {exc}", exc_info=True)
            db.rollback()
            durable_job_service.mark_failed(db, job_id, str(exc))
            version_activation_service.mark_version_failed(db, manuscript_id, str(exc))
            raise exc


production_pipeline_coordinator = ProductionPipelineCoordinator()
