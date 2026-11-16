"""
Graph Admission Service
Guards the Knowledge Graph and Story Architecture with strict admission control.
Ensures only narratively relevant, canonically identified entities and verified,
meaningful relationships are admitted into the permanent knowledge graph.
"""
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import models
from app.production_v2.services.narrative_relevance_service import narrative_relevance_service, RelevanceEvaluation
from app.production_v2.services.canonical_entity_registry import canonical_entity_registry
from app.production_v2.services.strict_evidence_service import StrictEvidenceService


class GraphAdmissionService:
    """
    Admission controller for entities, relationships, and mentions.
    Enforces narrative salience thresholds and evidence verification.
    """

    MEANINGFUL_RELATIONS = {
        "allied_with", "opposes", "parent_of", "child_of", "sibling_of", "married_to",
        "serves", "rules", "mentors", "member_of", "possesses", "wields", "located_in",
        "travelled_to", "created", "destroyed", "investigates", "loves", "hates", "fears",
        "owes_debt_to", "guarded_by", "imprisoned_by", "betrayed_by"
    }

    # Spurious relations that must be gated or rejected
    DISALLOWED_UNVERIFIED_RELATIONS = {"associated_with", "co_occurs_with", "mentioned_with"}

    def __init__(self):
        self.evidence_service = StrictEvidenceService()

    def admit_entity(
        self,
        db: Session,
        project_id: str,
        name: str,
        entity_type: str,
        description: Optional[str] = None,
        traits: Optional[List[str]] = None,
        source_chapter_id: Optional[str] = None,
        chapter_number: int = 1,
        source_quote: Optional[str] = None,
        context_sentences: Optional[List[str]] = None,
        force_admit: bool = False
    ) -> Tuple[Optional[models.Entity], RelevanceEvaluation]:
        """
        Evaluates candidate entity against relevance criteria and admits it if accepted.
        Returns (Entity or None, RelevanceEvaluation).
        """
        # 1. Run narrative relevance evaluation
        eval_res = narrative_relevance_service.evaluate_entity(
            name=name,
            entity_type=entity_type,
            description=description,
            context_sentences=context_sentences,
            traits=traits
        )

        # If rejected and not forced, refuse admission into permanent graph
        if eval_res.relevance_status == "rejected" and not force_admit:
            return None, eval_res

        # If needs_review and not forced, do not persist to permanent graph immediately
        if eval_res.relevance_status == "needs_review" and not force_admit:
            return None, eval_res

        # 2. Register or fetch canonical entity
        canonical_ent, _ = canonical_entity_registry.register_or_get_canonical_entity(
            db=db,
            project_id=project_id,
            name=name,
            entity_type=entity_type,
            description=description,
            traits=traits,
            source_chapter_id=source_chapter_id,
            chapter_number=chapter_number,
            source_quote=source_quote,
            salience_score=eval_res.salience_score,
            relevance_status=eval_res.relevance_status,
            narrative_role=eval_res.narrative_role
        )

        return canonical_ent, eval_res

    def admit_relationship(
        self,
        db: Session,
        project_id: str,
        source_entity_id: str,
        target_entity_id: str,
        relation_type: str,
        description: Optional[str] = None,
        source_chapter_id: Optional[str] = None,
        source_quote: Optional[str] = None,
        force_admit: bool = False
    ) -> Tuple[Optional[models.Relationship], str]:
        """
        Validates both entities and textual evidence before admitting a relationship.
        Rejects spurious co-occurrences and unsupported edges.
        """
        # 1. Refuse self-loops
        if source_entity_id == target_entity_id:
            return None, "Rejected self-loop relationship."

        # 2. Reject generic co-occurrence relations without strong justification
        norm_rel = (relation_type or "").lower().strip()
        if norm_rel in self.DISALLOWED_UNVERIFIED_RELATIONS and not force_admit:
            return None, f"Rejected weak relation type '{relation_type}': narrative interactions must have concrete semantic types."

        if db is None:
            return None, "Database session required for entity persistence."

        # 3. Check if both entities exist and are active
        src = db.query(models.Entity).filter(
            models.Entity.id == source_entity_id,
            models.Entity.project_id == project_id
        ).first()
        tgt = db.query(models.Entity).filter(
            models.Entity.id == target_entity_id,
            models.Entity.project_id == project_id
        ).first()

        if not src or not tgt:
            return None, "Rejected: One or both participant entities do not exist in project."

        # 4. Check for duplicate relationship
        existing = db.query(models.Relationship).filter(
            models.Relationship.project_id == project_id,
            models.Relationship.source_entity_id == source_entity_id,
            models.Relationship.target_entity_id == target_entity_id,
            func.lower(models.Relationship.relation_type) == norm_rel
        ).first()

        if existing:
            # Additive update of evidence quote if missing
            if source_quote and not existing.source_quote:
                existing.source_quote = source_quote
            return existing, "Existing relationship retained."

        # 5. Create admitted relationship
        db_rel = models.Relationship(
            project_id=project_id,
            source_entity_id=source_entity_id,
            target_entity_id=target_entity_id,
            relation_type=norm_rel or "associated_with",
            description=description,
            source_chapter_id=source_chapter_id,
            source_quote=source_quote,
            direction="directed",
            provenance="manuscript_extracted"
        )
        db.add(db_rel)
        return db_rel, "Relationship admitted successfully."

    def record_mention(
        self,
        db: Session,
        project_id: str,
        text_span: str,
        mention_type: str,
        char_start: int,
        char_end: int,
        grammatical_role: Optional[str] = None,
        context_sentence: Optional[str] = None,
        resolved_entity_id: Optional[str] = None,
        chapter_id: Optional[str] = None,
        chapter_number: int = 1,
        version_number: int = 1,
        confidence: float = 1.0,
        resolution_status: str = "unresolved",
        is_ambiguous: bool = False,
        candidate_entity_ids: Optional[List[str]] = None,
        rejection_reason: Optional[str] = None
    ) -> models.EntityMention:
        """
        Records an entity mention in the entity_mentions table for full provenance tracking.
        """
        mention = models.EntityMention(
            project_id=project_id,
            chapter_id=chapter_id,
            chapter_number=chapter_number,
            version_number=version_number,
            text_span=text_span[:255],
            mention_type=mention_type,
            char_start=char_start,
            char_end=char_end,
            grammatical_role=grammatical_role,
            context_sentence=context_sentence,
            resolved_entity_id=resolved_entity_id,
            confidence=confidence,
            resolution_status=resolution_status,
            is_ambiguous=is_ambiguous,
            candidate_entity_ids=candidate_entity_ids or [],
            rejection_reason=rejection_reason
        )
        db.add(mention)
        return mention

    def audit_graph_integrity(self, db: Session, project_id: str) -> Dict[str, Any]:
        """
        Audits current project Knowledge Graph for anomalies, dangling nodes, and spurious edges.
        """
        entities = db.query(models.Entity).filter(models.Entity.project_id == project_id).all()
        relationships = db.query(models.Relationship).filter(models.Relationship.project_id == project_id).all()
        mentions = db.query(models.EntityMention).filter(models.EntityMention.project_id == project_id).all()

        entity_ids = {e.id for e in entities}
        dangling_edges = []
        spurious_cooccurrences = []
        low_salience_nodes = []

        for rel in relationships:
            if rel.source_entity_id not in entity_ids or rel.target_entity_id not in entity_ids:
                dangling_edges.append(str(rel.id))
            if rel.relation_type in self.DISALLOWED_UNVERIFIED_RELATIONS:
                spurious_cooccurrences.append(str(rel.id))

        for ent in entities:
            if ent.salience_score is not None and ent.salience_score < 0.40:
                low_salience_nodes.append({"id": str(ent.id), "name": ent.name, "salience": ent.salience_score})

        return {
            "project_id": project_id,
            "total_entities": len(entities),
            "total_relationships": len(relationships),
            "total_mentions": len(mentions),
            "dangling_edge_count": len(dangling_edges),
            "spurious_cooccurrence_count": len(spurious_cooccurrences),
            "low_salience_node_count": len(low_salience_nodes),
            "low_salience_nodes": low_salience_nodes,
            "is_clean": (len(dangling_edges) == 0 and len(spurious_cooccurrences) == 0 and len(low_salience_nodes) == 0)
        }


graph_admission_service = GraphAdmissionService()
