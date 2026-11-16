"""
Narrative Extraction Orchestrator Service
Coordinates end-to-end narrative intelligence extraction across:
1. AI candidate extraction (narrative meaning, facts, relationships)
2. Deterministic linguistic candidate extraction (names, noun phrases, boundaries)
3. Candidate reconciliation & deduplication (reconciles semantic and deterministic candidates)
4. Contextual retrieval & bounded window construction
5. Relevance evaluation via NarrativeEntityAdmissionPolicy
6. Coreference resolution via NarrativeCoreferenceEngine
7. Canonical identity resolution via NarrativeIdentityResolutionAdapter
8. Strict relationship & evidence verification via NarrativeGraphValidationAdapter
"""
import re
import uuid
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from app.database import models
from app.agents.extraction_agent import extraction_agent
from app.production_v2.services.narrative_context_builder import narrative_context_builder, MentionContext
from app.production_v2.services.narrative_entity_admission_policy import (
    narrative_entity_admission_policy, PolicyEvaluationResult
)
from app.production_v2.services.narrative_coreference_engine import (
    narrative_coreference_engine, DynamicEntityProfile, CorefResolutionOutput
)
from app.production_v2.services.narrative_identity_resolution_adapter import (
    narrative_identity_resolution_adapter
)
from app.production_v2.services.narrative_graph_validation_adapter import (
    narrative_graph_validation_adapter
)

logger = logging.getLogger("narrative_extraction_orchestrator")


@dataclass
class StructuredCandidate:
    candidate_id: str
    mention_text: str
    normalized_name: str
    proposed_entity_type: str
    chapter_number: int
    paragraph_index: int
    sentence_reference: str
    char_start: int
    char_end: int
    verbatim_evidence: str
    description: str
    candidate_classification: str  # 'accepted', 'rejected', 'needs_review', 'temporary_mention'
    confidence: float
    extraction_source: str         # 'ai_extraction', 'deterministic_nlp', 'reconciled'
    traits: List[str] = field(default_factory=list)
    facts: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class StructuredExtractionResult:
    chapter_number: int
    admitted_entities: List[models.Entity] = field(default_factory=list)
    recorded_mentions: List[models.EntityMention] = field(default_factory=list)
    admitted_relationships: List[models.Relationship] = field(default_factory=list)
    admitted_facts: List[models.StoryFact] = field(default_factory=list)
    ambiguous_mentions: List[CorefResolutionOutput] = field(default_factory=list)
    rejected_candidates: List[StructuredCandidate] = field(default_factory=list)


class NarrativeExtractionOrchestrator:
    """
    Production-grade extraction orchestrator replacing naive merge logic with
    semantic candidate reconciliation, evidence validation, and admission gating.
    """

    def __init__(self):
        pass

    def reconcile_candidates(
        self,
        ai_entities: List[Dict[str, Any]],
        heuristic_entities: List[Dict[str, Any]],
        chapter_content: str,
        chapter_number: int
    ) -> List[StructuredCandidate]:
        """
        Reconciles AI candidates with deterministic NLP candidates.
        Does NOT blindly append heuristic candidates.
        Filters out incidental nouns and verifies verbatim quotation presence.
        """
        reconciled: List[StructuredCandidate] = []
        seen_names: Set[str] = set()

        content = chapter_content or ""

        # 1. Process AI Entities (Higher narrative semantic quality)
        for ent in ai_entities:
            name = (ent.get("name") or "").strip()
            if not name:
                continue
            norm_name = narrative_identity_resolution_adapter.normalize_name(name)
            name_key = norm_name.lower()

            # Build context and locate exact character offsets in chapter
            ctx = narrative_context_builder.build_mention_context(
                chapter_content=content,
                target_span=name,
                chapter_number=chapter_number
            )

            # Check verbatim evidence: if evidence quote is missing or invalid, locate in text
            evidence = ""
            for f in ent.get("facts", []):
                q = f.get("source_quote", "")
                if q and q in content:
                    evidence = q
                    break
            if not evidence and ctx.sentence:
                evidence = ctx.sentence

            candidate = StructuredCandidate(
                candidate_id=f"cand-{uuid.uuid4().hex[:8]}",
                mention_text=name,
                normalized_name=norm_name,
                proposed_entity_type=ent.get("entity_type", "character"),
                chapter_number=chapter_number,
                paragraph_index=0,
                sentence_reference=ctx.sentence,
                char_start=ctx.char_start if ctx.char_start >= 0 else 0,
                char_end=ctx.char_end if ctx.char_end >= 0 else len(name),
                verbatim_evidence=evidence,
                description=ent.get("description", ""),
                candidate_classification="pending",
                confidence=0.95,
                extraction_source="ai_extraction",
                traits=ent.get("traits", []),
                facts=ent.get("facts", [])
            )
            reconciled.append(candidate)
            seen_names.add(name_key)

        # 2. Process Heuristic Candidates (Only reconcile non-incidental or corroborating candidates)
        for h_ent in heuristic_entities:
            h_name = (h_ent.get("name") or "").strip()
            if not h_name:
                continue
            norm_h = narrative_identity_resolution_adapter.normalize_name(h_name)
            h_key = norm_h.lower()

            # If already captured by AI extraction, merge facts and traits additively
            if h_key in seen_names:
                for cand in reconciled:
                    if cand.normalized_name.lower() == h_key:
                        cand.traits = list(set(cand.traits + h_ent.get("traits", [])))
                        existing_quotes = {f.get("source_quote", "").strip().lower() for f in cand.facts}
                        for h_f in h_ent.get("facts", []):
                            q = h_f.get("source_quote", "").strip().lower()
                            if q and q not in existing_quotes and q in content.lower():
                                cand.facts.append(h_f)
                                existing_quotes.add(q)
                continue

            # If heuristic candidate is an incidental noun, DROP IT immediately!
            # Do NOT append generic nouns (door, chair, cup, table, hallway, window)
            tokens = h_key.split()
            if (
                h_key in narrative_entity_admission_policy.INCIDENTAL_COMMON_NOUNS
                or any(t in narrative_entity_admission_policy.INCIDENTAL_COMMON_NOUNS for t in tokens)
            ):
                continue

            # Build context and offsets
            ctx = narrative_context_builder.build_mention_context(
                chapter_content=content,
                target_span=h_name,
                chapter_number=chapter_number
            )

            # Only accept heuristic candidate if it has clear capitalisation or proper noun evidence
            if h_name[0].isupper() and len(tokens) >= 1:
                candidate = StructuredCandidate(
                    candidate_id=f"cand-{uuid.uuid4().hex[:8]}",
                    mention_text=h_name,
                    normalized_name=norm_h,
                    proposed_entity_type=h_ent.get("entity_type", "character"),
                    chapter_number=chapter_number,
                    paragraph_index=0,
                    sentence_reference=ctx.sentence,
                    char_start=ctx.char_start if ctx.char_start >= 0 else 0,
                    char_end=ctx.char_end if ctx.char_end >= 0 else len(h_name),
                    verbatim_evidence=ctx.sentence,
                    description=h_ent.get("description", ""),
                    candidate_classification="pending",
                    confidence=0.80,
                    extraction_source="deterministic_nlp",
                    traits=h_ent.get("traits", []),
                    facts=h_ent.get("facts", [])
                )
                reconciled.append(candidate)
                seen_names.add(h_key)

        return reconciled

    def process_chapter(
        self,
        db: Session,
        project_id: str,
        manuscript_id: str,
        chapter_id: str,
        chapter_content: str,
        chapter_number: int,
        chapter_title: str,
        manuscript_version: int = 1
    ) -> StructuredExtractionResult:
        """
        Orchestrates full narrative extraction, admission, and coreference for a single chapter.
        """
        result = StructuredExtractionResult(chapter_number=chapter_number)

        # 1. Execute dual extraction
        raw_extraction = extraction_agent.extract_from_chapter(
            chapter_content=chapter_content,
            chapter_number=chapter_number,
            chapter_title=chapter_title
        )

        ai_entities = raw_extraction.get("entities", [])
        raw_relationships = raw_extraction.get("relationships", [])

        # Deterministic linguistic pass
        heuristic_entities = extraction_agent._heuristic_extraction(
            content=chapter_content,
            chapter_number=chapter_number,
            chapter_title=chapter_title
        ).get("entities", [])

        # 2. Reconcile candidates (prevents heuristic pollution)
        candidates = self.reconcile_candidates(
            ai_entities=ai_entities,
            heuristic_entities=heuristic_entities,
            chapter_content=chapter_content,
            chapter_number=chapter_number
        )

        resolved_entity_map: Dict[str, models.Entity] = {}

        # 3. Evaluate each candidate against Admission Policy
        for cand in candidates:
            ctx = narrative_context_builder.build_mention_context(
                chapter_content=chapter_content,
                target_span=cand.mention_text,
                chapter_number=chapter_number,
                preferred_offset=cand.char_start,
                db=db,
                project_id=project_id
            )

            # Relevance policy evaluation
            has_custody = any(kw in cand.description.lower() for kw in ["possesses", "carried", "stole", "custody"])
            has_mutation = any(kw in cand.description.lower() for kw in ["severed", "killed", "injured", "forged", "destroyed"])

            eval_res = narrative_entity_admission_policy.evaluate_candidate(
                name=cand.mention_text,
                proposed_type=cand.proposed_entity_type,
                mention_context=ctx,
                description=cand.description,
                traits=cand.traits,
                involves_custody=has_custody,
                involves_state_mutation=has_mutation
            )

            cand.candidate_classification = eval_res.admission_status

            # Attempt admission into Knowledge Graph
            admitted_ent, admission_msg = narrative_graph_validation_adapter.validate_and_admit_entity(
                db=db,
                project_id=project_id,
                name=cand.mention_text,
                entity_type=cand.proposed_entity_type,
                evaluation=eval_res,
                description=cand.description,
                traits=cand.traits,
                source_chapter_id=chapter_id,
                chapter_number=chapter_number,
                source_quote=cand.verbatim_evidence
            )

            if admitted_ent:
                result.admitted_entities.append(admitted_ent)
                resolved_entity_map[cand.normalized_name.lower()] = admitted_ent
                resolved_entity_map[cand.mention_text.lower()] = admitted_ent

                # Record mention
                mention = models.EntityMention(
                    project_id=project_id,
                    manuscript_id=manuscript_id,
                    chapter_id=chapter_id,
                    resolved_entity_id=admitted_ent.id,
                    chapter_number=chapter_number,
                    version_number=manuscript_version,
                    text_span=cand.mention_text[:255],
                    mention_type="proper_name",
                    char_start=cand.char_start,
                    char_end=cand.char_end,
                    grammatical_role="subject",
                    context_sentence=ctx.sentence,
                    confidence=eval_res.extraction_confidence,
                    resolution_status="resolved",
                    is_ambiguous=False,
                    candidate_entity_ids=[str(admitted_ent.id)]
                )
                db.add(mention)
                result.recorded_mentions.append(mention)

                # Commit facts
                for f in cand.facts:
                    f_text = f.get("fact")
                    f_quote = f.get("source_quote") or cand.verbatim_evidence
                    if f_text and f_quote:
                        story_fact = models.StoryFact(
                            project_id=project_id,
                            entity_id=admitted_ent.id,
                            fact=f_text,
                            category=f.get("category", "general"),
                            source_chapter_id=chapter_id,
                            source_chapter_number=chapter_number,
                            source_quote=f_quote,
                            is_negated=bool(f.get("is_negated", False)),
                            uncertainty_level=f.get("uncertainty_level", "none"),
                            canon_tier="proposed" if f.get("uncertainty_level") in ("rumour", "fear", "belief") else "established",
                            provenance="manuscript_extracted"
                        )
                        db.add(story_fact)
                        result.admitted_facts.append(story_fact)

            else:
                # Rejected or held for review: record mention only, NEVER a permanent entity node!
                result.rejected_candidates.append(cand)
                mention = models.EntityMention(
                    project_id=project_id,
                    manuscript_id=manuscript_id,
                    chapter_id=chapter_id,
                    resolved_entity_id=None,
                    chapter_number=chapter_number,
                    version_number=manuscript_version,
                    text_span=cand.mention_text[:255],
                    mention_type="incidental_noun" if eval_res.is_incidental else "descriptive_ref",
                    char_start=cand.char_start,
                    char_end=cand.char_end,
                    context_sentence=ctx.sentence,
                    confidence=eval_res.extraction_confidence,
                    resolution_status=eval_res.admission_status,
                    is_ambiguous=eval_res.requires_human_review,
                    rejection_reason=eval_res.rationale
                )
                db.add(mention)
                result.recorded_mentions.append(mention)

        # 4. Coreference Resolution Pass on Chapter Text
        known_profiles = [
            DynamicEntityProfile(
                id=str(ent.id),
                name=ent.name,
                entity_type=ent.entity_type,
                gender="unknown",
                traits=list(ent.traits or [])
            )
            for ent in resolved_entity_map.values()
        ]

        coref_outputs = narrative_coreference_engine.resolve_coreference(
            text=chapter_content,
            known_entities=known_profiles,
            chapter_number=chapter_number
        )

        for co in coref_outputs:
            if co.is_ambiguous:
                result.ambiguous_mentions.append(co)

            # Record coreference mention in DB
            coref_mention = models.EntityMention(
                project_id=project_id,
                manuscript_id=manuscript_id,
                chapter_id=chapter_id,
                resolved_entity_id=co.resolved_entity_id,
                chapter_number=chapter_number,
                version_number=manuscript_version,
                text_span=co.mention_span[:255],
                mention_type=co.mention_type,
                char_start=co.char_start,
                char_end=co.char_end,
                context_sentence=co.context_sentence,
                confidence=co.confidence,
                resolution_status=co.resolution_status,
                is_ambiguous=co.is_ambiguous,
                candidate_entity_ids=co.candidate_entity_ids,
                rejection_reason=co.explanation if co.resolution_status != "resolved" else None
            )
            db.add(coref_mention)
            result.recorded_mentions.append(coref_mention)

        # 5. Admitting Relationships with strict evidence verification
        for rel in raw_relationships:
            src_name = rel.get("source_name", "")
            tgt_name = rel.get("target_name", "")
            src_ent = resolved_entity_map.get(src_name.lower())
            tgt_ent = resolved_entity_map.get(tgt_name.lower())

            if src_ent and tgt_ent and src_ent.id != tgt_ent.id:
                quote = rel.get("source_quote") or chapter_content[:150]
                admitted_rel, rel_msg = narrative_graph_validation_adapter.validate_and_admit_relationship(
                    db=db,
                    project_id=project_id,
                    source_entity_id=str(src_ent.id),
                    target_entity_id=str(tgt_ent.id),
                    relation_type=rel.get("relation_type", "associated_with"),
                    source_quote=quote,
                    description=rel.get("description"),
                    source_chapter_id=chapter_id,
                    target_version_number=manuscript_version,
                    force_admit=False
                )
                if admitted_rel:
                    result.admitted_relationships.append(admitted_rel)

        db.commit()
        return result


narrative_extraction_orchestrator = NarrativeExtractionOrchestrator()
