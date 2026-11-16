"""
Canonical Entity Registry Service
Maintains a 1-to-1 mapping of real narrative identities to database Entity records.
Prevents duplicate entity nodes for name variations (e.g. Arin vs Inspector Vance),
while strictly preventing false merges of distinct individuals (e.g. Captain Miller vs Captain Davis).
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.database import models
from app.production_v2.services.narrative_relevance_service import narrative_relevance_service


class CanonicalEntityRegistry:
    """
    Guarantees canonical identity integrity across manuscripts and chapters.
    """

    HONORIFIC_TITLES = {
        "inspector", "detective", "captain", "sergeant", "doctor", "dr.", "dr", "prof.", "professor",
        "lord", "lady", "king", "queen", "prince", "princess", "duke", "duchess", "count", "countess",
        "sir", "madam", "master", "father", "mother", "officer", "agent"
    }

    def __init__(self):
        pass

    def _clean_name(self, name: str) -> str:
        """Strips leading articles and extra whitespace."""
        clean = (name or "").strip()
        return re.sub(r'^(the|a|an)\s+', '', clean, flags=re.IGNORECASE).strip()

    def _split_title_and_name(self, name: str) -> Tuple[Optional[str], str]:
        """Separates honorific title from name (e.g. 'Inspector Vance' -> ('Inspector', 'Vance'))."""
        tokens = name.strip().split()
        if len(tokens) > 1 and tokens[0].lower() in self.HONORIFIC_TITLES:
            return tokens[0], " ".join(tokens[1:])
        return None, name.strip()

    def find_canonical_match(
        self,
        db: Session,
        project_id: str,
        name: str,
        entity_type: str,
        traits: Optional[List[str]] = None
    ) -> Optional[models.Entity]:
        """
        Searches existing canonical entities and aliases for a genuine match.
        Prevents merging distinct characters with different surnames or conflicting traits.
        """
        raw_name = (name or "").strip()
        cleaned = self._clean_name(raw_name)
        if not cleaned:
            return None

        # 1. Exact match on canonical Entity.name (case-insensitive)
        exact_match = db.query(models.Entity).filter(
            models.Entity.project_id == project_id,
            func.lower(models.Entity.name) == cleaned.lower()
        ).first()
        if exact_match:
            return exact_match

        # Also check with original name
        if raw_name.lower() != cleaned.lower():
            exact_raw = db.query(models.Entity).filter(
                models.Entity.project_id == project_id,
                func.lower(models.Entity.name) == raw_name.lower()
            ).first()
            if exact_raw:
                return exact_raw

        # 2. Check EntityAlias table
        alias_match = db.query(models.EntityAlias).filter(
            models.EntityAlias.project_id == project_id,
            func.lower(models.EntityAlias.alias_name) == cleaned.lower()
        ).first()
        if alias_match and alias_match.canonical_entity:
            return alias_match.canonical_entity

        # 3. Check title + surname resolution
        # If input is "Inspector Vance", check if there is an entity named "Arin Vance" or "Jonathan Vance"
        title, base_name = self._split_title_and_name(raw_name)
        existing_entities = db.query(models.Entity).filter(
            models.Entity.project_id == project_id,
            models.Entity.entity_type == entity_type
        ).all()

        for ent in existing_entities:
            ent_name = ent.name.strip()
            ent_title, ent_base = self._split_title_and_name(ent_name)

            # Check if surnames match
            ent_tokens = ent_base.split()
            cand_tokens = base_name.split()

            # Prevent false merge: "Captain Miller" vs "Captain Davis"
            if len(cand_tokens) == 1 and len(ent_tokens) == 1 and cand_tokens[0].lower() != ent_tokens[0].lower():
                continue

            # If cand has surname and ent has full name: e.g. "Vance" and "Arin Vance"
            if len(cand_tokens) == 1 and len(ent_tokens) > 1:
                if cand_tokens[0].lower() == ent_tokens[-1].lower():
                    # If title was present (e.g. "Inspector Vance" matching "Arin Vance")
                    if title:
                        ent_traits = [t.lower() for t in (ent.traits or [])]
                        if title.lower() in ent_traits or (ent.description and title.lower() in ent.description.lower()):
                            return ent
                    # High confidence surname match if only 1 character with this surname exists in project
                    same_surname_count = sum(1 for e in existing_entities if e.name.strip().split()[-1].lower() == cand_tokens[0].lower())
                    if same_surname_count == 1:
                        return ent

            # If cand has full name and ent has first name or surname
            if len(cand_tokens) > 1 and len(ent_tokens) > 1:
                # First and last name must both match
                if cand_tokens[0].lower() == ent_tokens[0].lower() and cand_tokens[-1].lower() == ent_tokens[-1].lower():
                    return ent

        return None

    def register_or_get_canonical_entity(
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
        salience_score: float = 0.5,
        relevance_status: str = "accepted",
        narrative_role: Optional[str] = None
    ) -> Tuple[models.Entity, bool]:
        """
        Finds existing canonical entity or creates a new one, registering aliases safely.
        Returns (canonical_entity, is_newly_created).
        """
        clean_name = self._clean_name(name)
        existing = self.find_canonical_match(db, project_id, clean_name, entity_type, traits)

        if existing:
            # Add alias if the candidate name is different from the canonical name
            if clean_name.lower() != existing.name.lower():
                self.register_alias(
                    db=db,
                    project_id=project_id,
                    canonical_entity_id=existing.id,
                    alias_name=name.strip(),
                    alias_type="name_variant",
                    source_quote=source_quote
                )

            # Update traits and description additively
            if traits:
                current_traits = list(existing.traits or [])
                for t in traits:
                    if t not in current_traits:
                        current_traits.append(t)
                existing.traits = current_traits

            if description and not existing.description:
                existing.description = description

            return existing, False

        # Create new canonical entity
        new_entity = models.Entity(
            project_id=project_id,
            name=clean_name,
            entity_type=entity_type,
            description=description,
            traits=traits or [],
            first_appearance_chapter=chapter_number,
            first_appearance_chapter_id=source_chapter_id,
            salience_score=salience_score,
            relevance_status=relevance_status,
            narrative_role=narrative_role,
            canon_status="established",
            provenance="manuscript_extracted"
        )
        db.add(new_entity)
        db.flush()  # assign ID

        # If the original raw name had a title (e.g. "Inspector Vance" -> clean="Vance"), register original as alias
        if name.strip().lower() != clean_name.lower():
            self.register_alias(
                db=db,
                project_id=project_id,
                canonical_entity_id=new_entity.id,
                alias_name=name.strip(),
                alias_type="title_form",
                source_quote=source_quote
            )

        return new_entity, True

    def register_alias(
        self,
        db: Session,
        project_id: str,
        canonical_entity_id: str,
        alias_name: str,
        alias_type: str = "nickname",
        source_quote: Optional[str] = None
    ) -> models.EntityAlias:
        """Registers a name alias for a canonical entity if not already present."""
        clean_alias = alias_name.strip()
        existing_alias = db.query(models.EntityAlias).filter(
            models.EntityAlias.project_id == project_id,
            models.EntityAlias.canonical_entity_id == canonical_entity_id,
            func.lower(models.EntityAlias.alias_name) == clean_alias.lower()
        ).first()

        if existing_alias:
            return existing_alias

        alias = models.EntityAlias(
            project_id=project_id,
            canonical_entity_id=canonical_entity_id,
            alias_name=clean_alias,
            alias_type=alias_type,
            confidence=0.95,
            source_quote=source_quote,
            is_author_confirmed=False
        )
        db.add(alias)
        return alias


canonical_entity_registry = CanonicalEntityRegistry()
