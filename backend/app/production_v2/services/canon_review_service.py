"""
Production V2 Canon Review Service
Provides human-in-the-loop validation for narrative facts, canon tiers, and entity associations.
"""
from typing import List, Optional
from sqlalchemy.orm import Session

from app.database import models
from app.production_v2.schemas.v2_schemas import CanonReviewItem, CanonReviewResponse


class CanonReviewService:
    """
    Manages author review workflows to solidify canon and suppress spurious AI inferences.
    """

    def list_pending_facts(self, db: Session, project_id: str) -> List[CanonReviewItem]:
        """
        Retrieves all story facts requiring author review or confirmation.
        """
        facts = db.query(models.StoryFact).join(
            models.Entity, models.StoryFact.entity_id == models.Entity.id
        ).filter(
            models.Entity.project_id == project_id,
            models.StoryFact.canon_tier.in_(["pending_review", "inferred", "speculation"])
        ).all()

        items = []
        for f in facts:
            ch_num = f.source_chapter_number or f.valid_from_chapter
            claim_text = getattr(f, "fact", getattr(f, "claim", "")) or ""

            items.append(CanonReviewItem(
                fact_id=str(f.id),
                entity_id=str(f.entity_id) if f.entity_id else None,
                entity_name=f.entity.name if f.entity else None,
                claim=claim_text,
                source_quote=f.source_quote,
                chapter_number=ch_num,
                canon_tier=f.canon_tier or "inferred",
                uncertainty_level=f.uncertainty_level or "inferred",
                status="pending_review" if not f.is_negated else "rejected"
            ))
        return items

    def process_review(
        self,
        db: Session,
        fact_id: str,
        action: str,
        corrected_claim: Optional[str] = None
    ) -> CanonReviewResponse:
        """
        Processes author decision: confirm, reject, or update.
        """
        fact = db.query(models.StoryFact).filter(models.StoryFact.id == fact_id).first()
        if not fact:
            raise ValueError(f"StoryFact {fact_id} not found.")

        act = action.lower().strip()
        if act == "confirm":
            fact.canon_tier = "author_confirmed"
            fact.uncertainty_level = "factual"
            fact.is_negated = False
            message = "Fact confirmed by author as established canon."
        elif act == "reject":
            fact.canon_tier = "rejected"
            fact.is_negated = True
            message = "Fact rejected and marked as negated/non-canonical."
        elif act == "update":
            if corrected_claim:
                fact.fact = corrected_claim.strip()
            fact.canon_tier = "author_confirmed"
            fact.uncertainty_level = "factual"
            fact.is_negated = False
            message = "Fact updated and confirmed as established canon."
        else:
            raise ValueError(f"Unsupported review action '{action}'. Must be 'confirm', 'reject', or 'update'.")

        db.commit()
        db.refresh(fact)

        return CanonReviewResponse(
            fact_id=str(fact.id),
            updated_tier=fact.canon_tier,
            is_negated=bool(fact.is_negated),
            message=message
        )


canon_review_service = CanonReviewService()
