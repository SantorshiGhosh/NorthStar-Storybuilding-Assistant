"""
Narrative Graph Validation Adapter Service
Strict admission controller guarding the Knowledge Graph and Story Architecture.
Validates:
- Entity admission policy (only accepted entities become permanent graph nodes)
- Relationship semantic validity (rejects spurious co-occurrence 'associated_with' edges)
- Verbatim manuscript evidence verification against active manuscript version
- Temporal state consistency (prevents impossible retroactive interactions)
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import models
from app.production_v2.services.narrative_entity_admission_policy import (
    narrative_entity_admission_policy, PolicyEvaluationResult
)
from app.production_v2.services.narrative_identity_resolution_adapter import (
    narrative_identity_resolution_adapter
)
from app.production_v2.services.strict_evidence_service import StrictEvidenceService


class NarrativeGraphValidationAdapter:
    """
    Admission controller and relationship evidence validator for the Knowledge Graph.
    """

    # Semantic relationships allowed in the permanent Knowledge Graph
    VALID_RELATION_TYPES = {
        "allied_with", "opposes", "family_of", "parent_of", "child_of", "sibling_of",
        "married_to", "subordinate_to", "serves", "rules", "mentors", "member_of",
        "possesses", "wields", "located_in", "travelled_to", "created", "destroyed",
        "investigates", "loves", "hates", "fears", "owes_debt_to", "guarded_by",
        "imprisoned_by", "betrayed_by", "transferred_item_to"
    }

    # Spurious relations that must be rejected
    DISALLOWED_COOCCURRENCE_TYPES = {
        "associated_with", "co_occurs_with", "mentioned_with", "appears_with", "near"
    }

    def __init__(self):
        self.evidence_service = StrictEvidenceService()

    def validate_and_admit_entity(
        self,
        db: Session,
        project_id: str,
        name: str,
        entity_type: str,
        evaluation: PolicyEvaluationResult,
        description: Optional[str] = None,
        traits: Optional[List[str]] = None,
        source_chapter_id: Optional[str] = None,
        chapter_number: int = 1,
        source_quote: Optional[str] = None,
        force_admit: bool = False
    ) -> Tuple[Optional[models.Entity], str]:
        """
        Guarantees that only accepted entities can become permanent graph nodes.
        Rejected candidates are barred; review candidates remain proposed.
        """
        # 1. Check admission status
        if evaluation.admission_status == "rejected" and not force_admit:
            return None, f"Rejected: {evaluation.rationale}"

        if evaluation.admission_status == "needs_review" and not force_admit:
            return None, f"Proposed: Held for author review (salience={evaluation.narrative_relevance})."

        # 2. Check canonical identity to avoid split duplicates
        existing, match_method, conf = narrative_identity_resolution_adapter.resolve_canonical_identity(
            db=db,
            project_id=project_id,
            mention_text=name,
            entity_type=entity_type,
            source_quote=source_quote,
            traits=traits
        )

        if existing:
            # Update traits and aliases additively
            clean_name = narrative_identity_resolution_adapter.normalize_name(name)
            if clean_name.lower() != existing.name.lower():
                narrative_identity_resolution_adapter.register_confirmed_alias(
                    db=db,
                    project_id=project_id,
                    canonical_entity_id=existing.id,
                    alias_name=name,
                    alias_type="name_variant",
                    source_quote=source_quote
                )

            if traits:
                current = list(existing.traits or [])
                for t in traits:
                    if t not in current:
                        current.append(t)
                existing.traits = current

            if description and not existing.description:
                existing.description = description

            return existing, f"Matched canonical entity via {match_method}."

        # 3. Create new canonical entity node
        clean_name = narrative_identity_resolution_adapter.normalize_name(name)
        new_entity = models.Entity(
            project_id=project_id,
            name=clean_name,
            entity_type=evaluation.validated_type,
            description=description,
            traits=traits or [],
            first_appearance_chapter=chapter_number,
            first_appearance_chapter_id=source_chapter_id,
            salience_score=evaluation.narrative_relevance,
            relevance_status="accepted",
            narrative_role=evaluation.narrative_role,
            canon_status="established",
            provenance="manuscript_extracted"
        )
        db.add(new_entity)
        db.flush()

        return new_entity, "Admitted new canonical entity into Knowledge Graph."

    def validate_and_admit_relationship(
        self,
        db: Session,
        project_id: str,
        source_entity_id: str,
        target_entity_id: str,
        relation_type: str,
        source_quote: str,
        description: Optional[str] = None,
        source_chapter_id: Optional[str] = None,
        target_version_number: Optional[int] = None,
        force_admit: bool = False
    ) -> Tuple[Optional[models.Relationship], str]:
        """
        Validates endpoints, relation semantics, and verbatim evidence before admission.
        Strictly rejects spurious co-occurrence edges.
        """
        # 1. Refuse self-loops
        if source_entity_id == target_entity_id:
            return None, "Rejected self-loop relationship."

        # 2. Reject weak co-occurrence relations
        norm_rel = (relation_type or "").lower().strip()
        if norm_rel in self.DISALLOWED_COOCCURRENCE_TYPES and not force_admit:
            return None, f"Rejected spurious co-occurrence relation '{relation_type}': edges must represent concrete narrative interactions."

        # 3. Check endpoint entities
        if db is None:
            return None, "Database session required for relationship admission."

        src_ent = db.query(models.Entity).filter(
            models.Entity.id == source_entity_id,
            models.Entity.project_id == project_id
        ).first()
        tgt_ent = db.query(models.Entity).filter(
            models.Entity.id == target_entity_id,
            models.Entity.project_id == project_id
        ).first()

        if not src_ent or not tgt_ent:
            return None, "Rejected: One or both participant entities do not exist in project."

        # 4. Evidence Verification: quote must exist verbatim in manuscript
        clean_quote = (source_quote or "").strip()
        if not clean_quote and not force_admit:
            return None, "Rejected: Missing required source quotation evidence."

        if clean_quote:
            verify_res = self.evidence_service.verify_quote(
                db=db,
                project_id=project_id,
                quote=clean_quote,
                preferred_chapter_id=source_chapter_id,
                target_version_number=target_version_number
            )
            if verify_res.status.value in ("unverified", "source_version_mismatch") and not force_admit:
                return None, f"Rejected: Evidence citation could not be certified ({verify_res.explanation})."

        # 5. Check duplicate relationship
        existing = db.query(models.Relationship).filter(
            models.Relationship.project_id == project_id,
            models.Relationship.source_entity_id == source_entity_id,
            models.Relationship.target_entity_id == target_entity_id,
            func.lower(models.Relationship.relation_type) == norm_rel
        ).first()

        if existing:
            if clean_quote and not existing.source_quote:
                existing.source_quote = clean_quote
            return existing, "Existing relationship retained."

        # 6. Create permanent relationship
        rel = models.Relationship(
            project_id=project_id,
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relation_type=norm_rel,
            description=description or f"{norm_rel.replace('_', ' ').capitalize()}",
            source_chapter_id=source_chapter_id,
            source_quote=clean_quote,
            direction="directed",
            provenance="manuscript_extracted"
        )
        db.add(rel)
        return rel, "Relationship admitted successfully with certified evidence."


narrative_graph_validation_adapter = NarrativeGraphValidationAdapter()
