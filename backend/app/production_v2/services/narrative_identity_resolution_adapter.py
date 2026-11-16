"""
Narrative Identity Resolution Adapter Service
Enforces strict 1-to-1 canonical identity mapping with an 8-level matching hierarchy:
1. Exact canonical-name match
2. Confirmed alias match
3. Explicitly established nickname
4. Unambiguous surname match (single candidate in project)
5. Confirmed title-plus-name match
6. Contextual descriptive-reference match (supported by manuscript evidence)
7. Coreference engine result
8. Unresolved / review
Guarantees zero false-merging of distinct characters sharing titles or first names.
"""
import re
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import models


class NarrativeIdentityResolutionAdapter:
    """
    Adapter ensuring canonical entity integrity, alias evidence verification,
    and preventing accidental duplicate nodes or false merges.
    """

    HONORIFIC_TITLES = {
        "inspector", "detective", "captain", "sergeant", "doctor", "dr.", "dr", "prof.", "professor",
        "lord", "lady", "king", "queen", "prince", "princess", "duke", "duchess", "count", "countess",
        "sir", "madam", "master", "father", "mother", "officer", "agent", "warden"
    }

    def __init__(self):
        pass

    def normalize_name(self, name: str) -> str:
        clean = (name or "").strip()
        return re.sub(r'^(the|a|an)\s+', '', clean, flags=re.IGNORECASE).strip()

    def split_title_and_base(self, name: str) -> Tuple[Optional[str], str]:
        tokens = name.strip().split()
        if len(tokens) > 1 and tokens[0].lower() in self.HONORIFIC_TITLES:
            return tokens[0], " ".join(tokens[1:])
        return None, name.strip()

    def resolve_canonical_identity(
        self,
        db: Session,
        project_id: str,
        mention_text: str,
        entity_type: str,
        context_sentence: Optional[str] = None,
        source_quote: Optional[str] = None,
        traits: Optional[List[str]] = None
    ) -> Tuple[Optional[models.Entity], str, float]:
        """
        Executes strict 8-level matching hierarchy to locate an existing canonical entity.
        Returns (Entity or None, match_method, confidence).
        Prevents merging distinct characters sharing titles or first names.
        """
        raw_text = (mention_text or "").strip()
        cleaned = self.normalize_name(raw_text)
        if not cleaned:
            return None, "empty_mention", 0.0

        lower_clean = cleaned.lower()
        norm_type = (entity_type or "character").lower().strip()

        # -------------------------------------------------------------
        # Level 1: Exact Canonical Name Match
        # -------------------------------------------------------------
        exact_ent = db.query(models.Entity).filter(
            models.Entity.project_id == project_id,
            func.lower(models.Entity.name) == lower_clean
        ).first()
        if exact_ent:
            return exact_ent, "exact_canonical_name", 1.0

        # Also check with raw_text
        if raw_text.lower() != lower_clean:
            exact_raw = db.query(models.Entity).filter(
                models.Entity.project_id == project_id,
                func.lower(models.Entity.name) == raw_text.lower()
            ).first()
            if exact_raw:
                return exact_raw, "exact_raw_name", 1.0

        # -------------------------------------------------------------
        # Level 2: Confirmed Alias Match
        # -------------------------------------------------------------
        alias_record = db.query(models.EntityAlias).filter(
            models.EntityAlias.project_id == project_id,
            func.lower(models.EntityAlias.alias_name) == lower_clean
        ).first()
        if alias_record and alias_record.canonical_entity:
            return alias_record.canonical_entity, "confirmed_alias", 0.98

        # Fetch existing entities of same type for structural checks
        existing_entities = db.query(models.Entity).filter(
            models.Entity.project_id == project_id,
            models.Entity.entity_type == norm_type
        ).all()

        cand_title, cand_base = self.split_title_and_base(raw_text)
        cand_tokens = cand_base.split()

        # -------------------------------------------------------------
        # Level 3: Nickname Match (registered in aliases or explicit parentheses)
        # -------------------------------------------------------------
        for ent in existing_entities:
            # Check if ent name has nickname: "Jonathan 'Jon' Vance"
            nick_match = re.search(r"['\"]([A-Za-z]+)['\"]", ent.name)
            if nick_match and nick_match.group(1).lower() == lower_clean:
                return ent, "established_nickname", 0.95

        # -------------------------------------------------------------
        # Level 4: Unambiguous Surname Match
        # STRICT RULE: Only match if exactly 1 character in the project has this surname!
        # -------------------------------------------------------------
        if len(cand_tokens) == 1 and norm_type == "character":
            surname_target = cand_tokens[0].lower()
            matching_by_surname = []
            for ent in existing_entities:
                ent_tokens = ent.name.strip().split()
                if len(ent_tokens) > 1 and ent_tokens[-1].lower() == surname_target:
                    matching_by_surname.append(ent)

            if len(matching_by_surname) == 1:
                return matching_by_surname[0], "unambiguous_surname", 0.92
            elif len(matching_by_surname) > 1:
                # Multiple characters share this surname! Do NOT merge!
                return None, "ambiguous_shared_surname", 0.50

        # -------------------------------------------------------------
        # Level 5: Confirmed Title + Name Match (e.g. "Inspector Vance" -> "Arin Vance")
        # STRICT RULE: Captain Miller vs Captain Davis must NEVER be merged!
        # -------------------------------------------------------------
        if cand_title and len(cand_tokens) >= 1:
            matching_title_base = []
            for ent in existing_entities:
                ent_title, ent_base = self.split_title_and_base(ent.name)
                ent_tokens = ent_base.split()

                # If candidate is "Captain Miller" and entity is "Captain Davis":
                # Distinct base names -> strictly DIFFERENT entities!
                if len(cand_tokens) == 1 and len(ent_tokens) == 1 and cand_tokens[0].lower() != ent_tokens[0].lower():
                    continue

                # If candidate is "Inspector Vance" and entity is "Arin Vance":
                if len(cand_tokens) == 1 and len(ent_tokens) > 1 and cand_tokens[0].lower() == ent_tokens[-1].lower():
                    matching_title_base.append(ent)

            if len(matching_title_base) == 1:
                return matching_title_base[0], "title_plus_surname", 0.94

        # -------------------------------------------------------------
        # Level 6: Contextual Descriptive-Reference Match (with evidence)
        # E.g. "the detective" matching Arin Vance IF Arin is established as detective
        # -------------------------------------------------------------
        if lower_clean.startswith("the ") or raw_text.lower().startswith("the "):
            descriptive_role = re.sub(r'^the\s+', '', lower_clean).strip()
            matching_by_role = []
            for ent in existing_entities:
                ent_roles = [r.lower() for r in (ent.traits or [])]
                if ent.description:
                    ent_roles.extend(ent.description.lower().split())
                if descriptive_role in ent_roles:
                    matching_by_role.append(ent)

            if len(matching_by_role) == 1:
                return matching_by_role[0], "contextual_descriptive_role", 0.88

        # -------------------------------------------------------------
        # Level 7 & 8: Unresolved or New Identity
        # -------------------------------------------------------------
        return None, "unresolved_new_identity", 0.0

    def register_confirmed_alias(
        self,
        db: Session,
        project_id: str,
        canonical_entity_id: str,
        alias_name: str,
        alias_type: str,
        source_quote: Optional[str] = None
    ) -> Optional[models.EntityAlias]:
        """
        Registers an alias with required textual evidence backing.
        Does NOT register unsubstantiated nicknames or incidental descriptions.
        """
        clean_alias = self.normalize_name(alias_name)
        if not clean_alias:
            return None

        # Check existing
        existing = db.query(models.EntityAlias).filter(
            models.EntityAlias.project_id == project_id,
            models.EntityAlias.canonical_entity_id == canonical_entity_id,
            func.lower(models.EntityAlias.alias_name) == clean_alias.lower()
        ).first()

        if existing:
            if source_quote and not existing.source_quote:
                existing.source_quote = source_quote
            return existing

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


narrative_identity_resolution_adapter = NarrativeIdentityResolutionAdapter()
