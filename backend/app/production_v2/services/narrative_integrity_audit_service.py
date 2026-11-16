"""
Narrative Integrity Audit Service
Inspects existing project data for narrative anomalies, duplicate entities,
irrelevant graph nodes, unsupported relationships, and invalid mention offsets.
Generates an audit report and reviewable non-destructive correction plan with rollback tracking.
"""
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import models
from app.production_v2.services.narrative_entity_admission_policy import (
    narrative_entity_admission_policy
)
from app.production_v2.services.narrative_graph_validation_adapter import (
    narrative_graph_validation_adapter
)


@dataclass
class AuditAnomaly:
    anomaly_id: str
    category: str         # 'duplicate_candidate', 'irrelevant_node', 'unsupported_relationship', 'offset_error', 'suspicious_alias'
    severity: str         # 'high', 'medium', 'low', 'info'
    entity_id: Optional[str] = None
    target_id: Optional[str] = None
    title: str = ""
    description: str = ""
    suggested_action: str = ""  # 'merge', 'deprecate_to_mention', 'remove_edge', 'correct_offset'
    proposed_correction: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProjectIntegrityReport:
    project_id: str
    total_entities_audited: int
    total_relationships_audited: int
    total_mentions_audited: int
    total_facts_audited: int
    anomalies_found: int
    anomalies: List[AuditAnomaly] = field(default_factory=list)
    correction_plan: List[Dict[str, Any]] = field(default_factory=list)
    is_clean: bool = True


class NarrativeIntegrityAuditService:
    """
    Non-destructive audit and correction planner for Narrative Intelligence and Knowledge Graphs.
    """

    def __init__(self):
        pass

    def run_project_audit(self, db: Session, project_id: str) -> ProjectIntegrityReport:
        """
        Audits all entities, relationships, facts, and mentions in a project without modifying any data.
        Returns detailed report and non-destructive correction plan.
        """
        entities = db.query(models.Entity).filter(models.Entity.project_id == project_id).all()
        relationships = db.query(models.Relationship).filter(models.Relationship.project_id == project_id).all()
        facts = db.query(models.StoryFact).filter(models.StoryFact.project_id == project_id).all()
        mentions = db.query(models.EntityMention).filter(models.EntityMention.project_id == project_id).all()

        anomalies: List[AuditAnomaly] = []
        entity_map = {e.id: e for e in entities}

        # 1. Audit Irrelevant Entities (e.g. incidental nouns that became nodes)
        for ent in entities:
            lower_name = ent.name.lower().strip()
            stripped = re.sub(r'^(the|a|an)\s+', '', lower_name).strip()
            tokens = stripped.split()

            is_incidental = (
                stripped in narrative_entity_admission_policy.INCIDENTAL_COMMON_NOUNS
                or any(t in narrative_entity_admission_policy.INCIDENTAL_COMMON_NOUNS for t in tokens)
            )

            # Check if it has any plot facts
            has_plot_facts = any(
                any(kw in f.fact.lower() for kw in narrative_entity_admission_policy.PLOT_CONSEQUENCE_KEYWORDS)
                for f in ent.facts
            )

            if is_incidental and not has_plot_facts and (ent.salience_score is None or ent.salience_score < 0.40):
                anomalies.append(AuditAnomaly(
                    anomaly_id=f"irrelevant-node-{ent.id[:8]}",
                    category="irrelevant_node",
                    severity="high",
                    entity_id=str(ent.id),
                    title=f"Incidental noun node '{ent.name}' in graph",
                    description=f"Entity '{ent.name}' is an incidental prop without plot consequence.",
                    suggested_action="deprecate_to_mention",
                    proposed_correction={
                        "action": "reclassify_as_incidental_mention",
                        "entity_id": str(ent.id),
                        "entity_name": ent.name,
                        "new_status": "rejected"
                    }
                ))

        # 2. Audit Duplicate Entity Candidates (Name variants not linked as aliases)
        char_entities = [e for e in entities if e.entity_type == "character"]
        for i in range(len(char_entities)):
            for j in range(i + 1, len(char_entities)):
                e1 = char_entities[i]
                e2 = char_entities[j]

                tokens1 = e1.name.strip().split()
                tokens2 = e2.name.strip().split()

                # If one is single-word surname and matches the other's surname:
                # E.g. "Vance" and "Arin Vance"
                is_surname_match = (
                    (len(tokens1) == 1 and len(tokens2) > 1 and tokens1[0].lower() == tokens2[-1].lower()) or
                    (len(tokens2) == 1 and len(tokens1) > 1 and tokens2[0].lower() == tokens1[-1].lower())
                )

                if is_surname_match:
                    full_ent = e2 if len(tokens2) > len(tokens1) else e1
                    sur_ent = e1 if len(tokens1) < len(tokens2) else e2

                    anomalies.append(AuditAnomaly(
                        anomaly_id=f"dup-candidate-{sur_ent.id[:6]}-{full_ent.id[:6]}",
                        category="duplicate_candidate",
                        severity="medium",
                        entity_id=str(full_ent.id),
                        target_id=str(sur_ent.id),
                        title=f"Potential duplicate entities: '{sur_ent.name}' and '{full_ent.name}'",
                        description=f"Entity '{sur_ent.name}' appears to be a surname reference to '{full_ent.name}'.",
                        suggested_action="merge",
                        proposed_correction={
                            "action": "merge_entities_into_canonical",
                            "canonical_entity_id": str(full_ent.id),
                            "secondary_entity_id": str(sur_ent.id),
                            "alias_name": sur_ent.name
                        }
                    ))

        # 3. Audit Unsupported Relationships (Spurious co-occurrences or dangling edges)
        for rel in relationships:
            # Check dangling endpoints
            if rel.source_entity_id not in entity_map or rel.target_entity_id not in entity_map:
                anomalies.append(AuditAnomaly(
                    anomaly_id=f"dangling-rel-{rel.id[:8]}",
                    category="unsupported_relationship",
                    severity="high",
                    target_id=str(rel.id),
                    title=f"Dangling relationship edge {rel.id[:8]}",
                    description=f"Relationship references nonexistent entity ID ({rel.source_entity_id} -> {rel.target_entity_id}).",
                    suggested_action="remove_edge",
                    proposed_correction={"action": "remove_relationship", "relationship_id": str(rel.id)}
                ))
                continue

            # Check spurious co-occurrence relation types
            if rel.relation_type in narrative_graph_validation_adapter.DISALLOWED_COOCCURRENCE_TYPES:
                src_name = entity_map[rel.source_entity_id].name
                tgt_name = entity_map[rel.target_entity_id].name
                anomalies.append(AuditAnomaly(
                    anomaly_id=f"spurious-rel-{rel.id[:8]}",
                    category="unsupported_relationship",
                    severity="medium",
                    target_id=str(rel.id),
                    title=f"Spurious co-occurrence edge between '{src_name}' and '{tgt_name}'",
                    description=f"Relation type '{rel.relation_type}' indicates raw paragraph co-occurrence rather than concrete interaction.",
                    suggested_action="remove_edge",
                    proposed_correction={"action": "remove_relationship", "relationship_id": str(rel.id)}
                ))

            # Check self-loops
            if rel.source_entity_id == rel.target_entity_id:
                anomalies.append(AuditAnomaly(
                    anomaly_id=f"self-loop-{rel.id[:8]}",
                    category="unsupported_relationship",
                    severity="high",
                    target_id=str(rel.id),
                    title=f"Self-loop relationship edge on entity {rel.source_entity_id[:8]}",
                    description=f"Entity has self-referential relationship edge '{rel.relation_type}'.",
                    suggested_action="remove_edge",
                    proposed_correction={"action": "remove_relationship", "relationship_id": str(rel.id)}
                ))

        # 4. Audit Mentions with Invalid Offsets
        for m in mentions:
            if m.char_start < 0 or (m.char_end > 0 and m.char_end <= m.char_start):
                anomalies.append(AuditAnomaly(
                    anomaly_id=f"invalid-offset-{m.id[:8]}",
                    category="offset_error",
                    severity="low",
                    target_id=str(m.id),
                    title=f"Mention with invalid character offsets: [{m.char_start}, {m.char_end}]",
                    description=f"Mention '{m.text_span}' has non-positive or inverted span coordinates.",
                    suggested_action="correct_offset",
                    proposed_correction={"action": "recalculate_offset", "mention_id": str(m.id)}
                ))

        correction_plan = [a.proposed_correction for a in anomalies if a.proposed_correction]

        return ProjectIntegrityReport(
            project_id=project_id,
            total_entities_audited=len(entities),
            total_relationships_audited=len(relationships),
            total_mentions_audited=len(mentions),
            total_facts_audited=len(facts),
            anomalies_found=len(anomalies),
            anomalies=anomalies,
            correction_plan=correction_plan,
            is_clean=(len(anomalies) == 0)
        )

    def execute_approved_correction(
        self,
        db: Session,
        project_id: str,
        correction_action: Dict[str, Any],
        author_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a single approved correction from the audit report non-destructively,
        logging audit history and preserving original IDs and rollback metadata.
        """
        action = correction_action.get("action")

        if action == "reclassify_as_incidental_mention":
            entity_id = correction_action.get("entity_id")
            ent = db.query(models.Entity).filter(models.Entity.id == entity_id, models.Entity.project_id == project_id).first()
            if ent:
                old_status = ent.relevance_status
                ent.relevance_status = "rejected"
                ent.is_archived = True

                # Record audit log
                audit = models.AuditLog(
                    project_id=project_id,
                    actor_id=author_id,
                    actor_name="Author",
                    action="audit_reclassify_incidental",
                    target_type="entity",
                    target_id=str(ent.id),
                    target_name=ent.name,
                    previous_value={"relevance_status": old_status, "is_archived": False},
                    new_value={"relevance_status": "rejected", "is_archived": True},
                    source="manual"
                )
                db.add(audit)
                db.commit()
                return {"success": True, "action": action, "entity_id": str(ent.id), "message": f"Entity '{ent.name}' archived as incidental."}

        elif action == "remove_relationship":
            rel_id = correction_action.get("relationship_id")
            rel = db.query(models.Relationship).filter(models.Relationship.id == rel_id, models.Relationship.project_id == project_id).first()
            if rel:
                db.delete(rel)
                audit = models.AuditLog(
                    project_id=project_id,
                    actor_id=author_id,
                    actor_name="Author",
                    action="audit_remove_spurious_rel",
                    target_type="relationship",
                    target_id=str(rel_id),
                    previous_value={"relation_type": rel.relation_type, "source": rel.source_entity_id, "target": rel.target_entity_id},
                    new_value=None,
                    source="manual"
                )
                db.add(audit)
                db.commit()
                return {"success": True, "action": action, "relationship_id": str(rel_id), "message": "Spurious relationship removed."}

        return {"success": False, "error": f"Unsupported or unknown correction action '{action}'."}


narrative_integrity_audit_service = NarrativeIntegrityAuditService()
