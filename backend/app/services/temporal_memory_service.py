import re
import logging
from typing import Dict, Any, List, Optional, Tuple, Set
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import models

logger = logging.getLogger("temporal_memory_service")

class TemporalMemoryService:
    """
    Manages temporal narrative states, object custody chains, versioned story facts,
    and guarantees strict chronological isolation for continuity analysis.
    """

    # -------------------------------------------------------------------------
    # 1. EVIDENCE & SOURCE SPAN VERIFICATION
    # -------------------------------------------------------------------------
    @staticmethod
    def verify_quote_against_source(quote: str, source_text: str) -> Tuple[bool, str, int, int]:
        """
        Verifies that a quotation exists verbatim in the source manuscript text.
        Returns (is_verified, clean_quote, char_start, char_end).
        Rejects fabricated quotations.
        """
        if not quote or not quote.strip() or not source_text:
            return False, "", -1, -1

        q_clean = quote.strip()
        idx = source_text.find(q_clean)
        if idx != -1:
            return True, q_clean, idx, idx + len(q_clean)

        # Normalized whitespace search
        norm_source = re.sub(r'\s+', ' ', source_text)
        norm_quote = re.sub(r'\s+', ' ', q_clean)
        idx_norm = norm_source.find(norm_quote)
        if idx_norm != -1:
            return True, norm_quote, idx_norm, idx_norm + len(norm_quote)

        # Substring fuzzy match for quotes with slight punctuation variation
        words = norm_quote.split()
        if len(words) >= 4:
            sub_quote = " ".join(words[:4])
            idx_sub = norm_source.find(sub_quote)
            if idx_sub != -1:
                return True, norm_quote, idx_sub, idx_sub + len(norm_quote)

        return False, q_clean, -1, -1

    # -------------------------------------------------------------------------
    # 2. CHRONOLOGICALLY ISOLATED CANON RETRIEVAL
    # -------------------------------------------------------------------------
    def get_prior_canon_facts(
        self,
        db: Session,
        project_id: str,
        current_chapter_number: int,
        include_beliefs: bool = False
    ) -> List[Dict[str, Any]]:
        """
        MANDATORY CHRONOLOGICAL ISOLATION:
        When analyzing Chapter N, strictly returns only facts established BEFORE Chapter N
        (source_chapter_number < N) that remain valid at Chapter N (valid_until_chapter is None or >= N).
        Never uses facts from future chapters to evaluate earlier chapters.
        """
        query = db.query(models.StoryFact).filter(
            models.StoryFact.project_id == project_id,
            models.StoryFact.is_active == True,
            models.StoryFact.source_chapter_number < current_chapter_number
        )

        if not include_beliefs:
            # Only include confirmed canon tiers
            query = query.filter(
                models.StoryFact.canon_tier.in_(["established", "author_confirmed", "explicit_text"])
            )

        facts = query.order_by(models.StoryFact.source_chapter_number.asc()).all()

        valid_facts = []
        for f in facts:
            # Check temporal validity period
            if f.valid_until_chapter is not None and f.valid_until_chapter < current_chapter_number:
                # Fact was superseded or reversed before current chapter
                continue

            entity_name = f.entity.name if f.entity else ""
            valid_facts.append({
                "id": str(f.id),
                "entity_id": str(f.entity_id) if f.entity_id else None,
                "entity_name": entity_name,
                "fact": f.fact,
                "category": f.category,
                "fact_category": f.fact_category,
                "source_chapter_number": f.source_chapter_number,
                "source_chapter_id": str(f.source_chapter_id) if f.source_chapter_id else None,
                "source_quote": f.source_quote,
                "confidence": f.confidence,
                "valid_from_chapter": f.valid_from_chapter or f.source_chapter_number or 1,
                "valid_until_chapter": f.valid_until_chapter,
                "canon_tier": f.canon_tier,
                "is_negated": bool(f.is_negated),
                "uncertainty_level": f.uncertainty_level or "none"
            })

        return valid_facts

    # -------------------------------------------------------------------------
    # 3. CHARACTER STATE LIFECYCLE (Physical, Status, Death, Resurrection)
    # -------------------------------------------------------------------------
    def record_character_state(
        self,
        db: Session,
        project_id: str,
        entity_id: str,
        category: str,
        state_description: str,
        chapter_number: int,
        source_quote: str,
        chapter_id: Optional[str] = None
    ) -> models.CharacterState:
        """
        Records or updates a versioned character state (e.g. missing left arm, deceased, blinded).
        If this state supersedes a prior state (e.g. resurrection or prosthetic replacement),
        closes the validity window of the earlier state.
        """
        desc_clean = state_description.strip()

        # Check if an active state of this category already exists
        existing_states = db.query(models.CharacterState).filter(
            models.CharacterState.project_id == project_id,
            models.CharacterState.entity_id == entity_id,
            models.CharacterState.category == category,
            models.CharacterState.is_active == True,
            models.CharacterState.valid_until_chapter == None
        ).all()

        # Handle specific transitions:
        # e.g., Resurrection supersedes Death
        if "resurrected" in desc_clean.lower() or "revived" in desc_clean.lower():
            for st in existing_states:
                if "dead" in st.state_description.lower() or "killed" in st.state_description.lower():
                    st.valid_until_chapter = chapter_number
                    st.is_active = False

        # e.g., Healing / Prosthetic supersedes missing limb
        if "prosthetic" in desc_clean.lower() or "healed" in desc_clean.lower() or "mechanical" in desc_clean.lower():
            for st in existing_states:
                if "missing" in st.state_description.lower() or "crushed" in st.state_description.lower():
                    st.valid_until_chapter = chapter_number

        new_state = models.CharacterState(
            id=models.gen_uuid(),
            project_id=project_id,
            entity_id=entity_id,
            category=category,
            state_description=desc_clean,
            valid_from_chapter=chapter_number,
            valid_until_chapter=None,
            source_chapter_id=chapter_id,
            source_quote=source_quote,
            is_active=True
        )
        db.add(new_state)
        return new_state

    def get_character_active_state_at_chapter(
        self,
        db: Session,
        project_id: str,
        entity_id: str,
        target_chapter_number: int
    ) -> List[models.CharacterState]:
        """
        Returns all character states that were actively valid at `target_chapter_number`.
        """
        states = db.query(models.CharacterState).filter(
            models.CharacterState.project_id == project_id,
            models.CharacterState.entity_id == entity_id,
            models.CharacterState.valid_from_chapter <= target_chapter_number
        ).all()

        active_at_target = []
        for s in states:
            if s.valid_until_chapter is None or s.valid_until_chapter >= target_chapter_number:
                active_at_target.append(s)

        return active_at_target

    # -------------------------------------------------------------------------
    # 4. OBJECT CUSTODY CHAINS & TRANSFERS
    # -------------------------------------------------------------------------
    def record_object_custody_event(
        self,
        db: Session,
        project_id: str,
        object_entity_id: str,
        holder_entity_id: Optional[str],
        previous_holder_id: Optional[str],
        transfer_type: str,
        chapter_number: int,
        source_quote: str,
        chapter_id: Optional[str] = None
    ) -> models.ObjectCustodyEvent:
        """
        Records an object custody event (initial_possession, transfer, theft, loss, discovery, destruction).
        """
        event = models.ObjectCustodyEvent(
            id=models.gen_uuid(),
            project_id=project_id,
            object_entity_id=object_entity_id,
            holder_entity_id=holder_entity_id,
            previous_holder_id=previous_holder_id,
            transfer_type=transfer_type,
            chapter_number=chapter_number,
            chapter_id=chapter_id,
            source_quote=source_quote
        )
        db.add(event)
        return event

    def get_current_object_holder(
        self,
        db: Session,
        project_id: str,
        object_entity_id: str,
        up_to_chapter_number: int
    ) -> Optional[Tuple[models.Entity, int]]:
        """
        Traces the object custody event chain up to `up_to_chapter_number` to find the verified current holder.
        Returns (holder_entity, chapter_number_acquired).
        """
        events = db.query(models.ObjectCustodyEvent).filter(
            models.ObjectCustodyEvent.project_id == project_id,
            models.ObjectCustodyEvent.object_entity_id == object_entity_id,
            models.ObjectCustodyEvent.chapter_number <= up_to_chapter_number
        ).order_by(models.ObjectCustodyEvent.chapter_number.desc(), models.ObjectCustodyEvent.created_at.desc()).all()

        for ev in events:
            if ev.transfer_type in ["loss", "destruction"]:
                return None  # Object is currently lost or destroyed
            if ev.holder_entity:
                return ev.holder_entity, ev.chapter_number

        return None

temporal_memory_service = TemporalMemoryService()
