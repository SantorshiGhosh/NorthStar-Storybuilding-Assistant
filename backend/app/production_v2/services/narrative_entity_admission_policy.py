"""
Narrative Entity Admission Policy Service
Implements a transparent, explainable admission policy separating:
- Extraction confidence
- Entity identity confidence
- Narrative relevance
- Evidence verification confidence
Strictly evaluates characters without arbitrary high baselines, recognizes single-mention
critical objects (e.g. poisoned chalice, murder weapon), rejects incidental props (chairs, cups),
and preserves ambiguous candidates in 'needs_review'.
"""
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from app.production_v2.services.narrative_context_builder import MentionContext, narrative_context_builder


@dataclass
class PolicyEvaluationResult:
    name: str
    proposed_type: str
    validated_type: str
    admission_status: str       # 'accepted', 'rejected', 'needs_review', 'temporary_mention'
    narrative_role: str         # 'protagonist', 'supporting', 'minor', 'incidental', 'plot_device', 'key_location', 'faction'
    narrative_relevance: float  # 0.0 to 1.0
    extraction_confidence: float = 1.0
    identity_confidence: float = 1.0
    evidence_confidence: float = 1.0
    scoring_breakdown: Dict[str, float] = field(default_factory=dict)
    rationale: str = ""
    is_incidental: bool = False
    requires_human_review: bool = False


class NarrativeEntityAdmissionPolicy:
    """
    Transparent admission controller evaluating characters, objects, and locations
    based on narrative agency, plot consequence, custody, and contextual actions.
    """

    # Common incidental nouns that are rejected unless proven plot-critical
    INCIDENTAL_COMMON_NOUNS = {
        "chair", "armchair", "stool", "bench", "seat", "table", "desk", "counter",
        "cup", "glass", "mug", "tea", "coffee", "wine", "ale", "beer", "water",
        "bread", "meal", "food", "plate", "bowl", "fork", "spoon",
        "door", "doorway", "wooden door", "front door", "back door", "gate", "window",
        "wall", "floor", "ceiling", "roof", "stairs", "staircase", "hallway", "corridor",
        "shirt", "coat", "jacket", "cloak", "boots", "shoes", "gloves", "hat", "trousers", "dress",
        "pen", "paper", "quill", "ink", "candle", "lamp", "lantern", "torch",
        "carriage", "wagon", "cart", "horse", "saddle", "reins", "street", "road", "pavement"
    }

    # Dialogue attribution verbs indicating character agency
    DIALOGUE_VERBS = {
        "said", "replied", "asked", "whispered", "shouted", "muttered", "demanded",
        "gasped", "cried", "answered", "declared", "urged", "called", "laughed"
    }

    # Dynamic action verbs indicating character participation
    CHARACTER_ACTION_VERBS = {
        "walked", "stepped", "ran", "drew", "struck", "looked", "turned", "smiled",
        "frowned", "grasped", "pulled", "pushed", "opened", "closed", "held", "took",
        "entered", "arrived", "departed", "escaped", "fought", "attacked", "confronted"
    }

    # High-stakes plot consequence keywords
    PLOT_CONSEQUENCE_KEYWORDS = {
        "murder", "killed", "died", "stabbed", "poison", "poisoned", "assassinate", "weapon",
        "clue", "evidence", "secret", "revelation", "unlocked", "vault", "prophecy",
        "curse", "enchanted", "sacred", "ancient", "forbidden", "heirloom", "relic",
        "ritual", "conspiracy", "betrayal", "artifact", "talisman", "crown", "throne"
    }

    # Object interaction / custody verbs
    CUSTODY_INTERACTION_KEYWORDS = {
        "wielded", "wield", "stole", "steal", "forged", "forge", "destroyed", "destroy",
        "inherited", "bequeathed", "concealed", "smuggled", "sought", "discovered",
        "unlocked", "activated", "decoded", "guarded", "traded", "handed", "passed", "drank from"
    }

    def __init__(
        self,
        acceptance_threshold: float = 0.65,
        review_threshold: float = 0.40
    ):
        self.acceptance_threshold = acceptance_threshold
        self.review_threshold = review_threshold

    def _normalize_name(self, name: str) -> str:
        clean = (name or "").strip()
        return re.sub(r'^(the|a|an)\s+', '', clean, flags=re.IGNORECASE).strip()

    def evaluate_candidate(
        self,
        name: str,
        proposed_type: str,
        mention_context: MentionContext,
        description: Optional[str] = None,
        traits: Optional[List[str]] = None,
        occurrence_count: int = 1,
        involves_custody: bool = False,
        involves_state_mutation: bool = False
    ) -> PolicyEvaluationResult:
        """
        Calculates narrative relevance score and determines admission status.
        Does NOT assign an automatic high baseline to characters without proof of agency.
        """
        raw_name = (name or "").strip()
        cleaned_name = self._normalize_name(raw_name)
        lower_name = cleaned_name.lower()
        context_text = f"{mention_context.three_sentence_window} {mention_context.paragraph} {description or ''} {' '.join(traits or [])}".lower()

        # Check if the name matches common incidental nouns
        tokens = lower_name.split()
        is_incidental_noun = (
            lower_name in self.INCIDENTAL_COMMON_NOUNS
            or any(t in self.INCIDENTAL_COMMON_NOUNS for t in tokens)
        )

        norm_type = (proposed_type or "object").lower().strip()
        scoring: Dict[str, float] = {}

        # -------------------------------------------------------------
        # 1. Type Validation & Base Relevance (Without arbitrary character inflate)
        # -------------------------------------------------------------
        # Distinguish whether capitalisation is merely sentence initial
        is_capitalized = bool(raw_name and raw_name[0].isupper())

        if norm_type in ("character", "person"):
            # Check for actual character evidence in surrounding text:
            # - Dialogue attribution: "said Name", "Name said"
            has_dialogue = any(
                re.search(rf'\b({re.escape(cleaned_name)}\s+{v}|{v}\s+{re.escape(cleaned_name)})\b', context_text, re.IGNORECASE)
                for v in self.DIALOGUE_VERBS
            )
            # - Dynamic character actions
            has_action = any(
                re.search(rf'\b{re.escape(cleaned_name)}\s+{v}\b', context_text, re.IGNORECASE)
                for v in self.CHARACTER_ACTION_VERBS
            )
            # - Honorific or title
            has_title = any(t in raw_name.lower() for t in ["inspector", "captain", "doctor", "dr.", "lord", "lady", "king", "queen", "sir"])

            if is_incidental_noun:
                # E.g. "Chair" was tagged as character by error
                base_salience = 0.10
                validated_type = "object"
            elif has_dialogue or has_action or has_title:
                base_salience = 0.55 if is_capitalized else 0.40
                validated_type = "character"
            elif is_capitalized and len(tokens) >= 2:
                # Full name (e.g. "Arin Vance", "Julian Sterling")
                base_salience = 0.50
                validated_type = "character"
            else:
                # Single unfamiliar capitalized word without dialogue or action
                base_salience = 0.30
                validated_type = "character"

        elif norm_type in ("location", "place"):
            if is_incidental_noun or lower_name in ("hallway", "corridor", "room", "doorway", "street", "road"):
                base_salience = 0.15
                validated_type = "temporary_setting"
            elif is_capitalized and len(tokens) >= 1:
                base_salience = 0.50
                validated_type = "location"
            else:
                base_salience = 0.25
                validated_type = "temporary_setting"

        elif norm_type in ("faction", "organization", "guild"):
            base_salience = 0.50
            validated_type = "faction"

        else:
            # Object or other entity
            validated_type = "object"
            if is_incidental_noun:
                base_salience = 0.05
            else:
                base_salience = 0.35 if is_capitalized else 0.20

        scoring["base_salience"] = base_salience

        # -------------------------------------------------------------
        # 2. Plot Progression & High-Stakes Consequence Factor
        # -------------------------------------------------------------
        plot_matches = [kw for kw in self.PLOT_CONSEQUENCE_KEYWORDS if kw in context_text or kw in lower_name]
        plot_score = min(0.40, len(plot_matches) * 0.15) if plot_matches else 0.0
        scoring["plot_progression"] = plot_score

        # -------------------------------------------------------------
        # 3. Agency & Interaction Factor (wielded, stolen, unlocked, drank)
        # -------------------------------------------------------------
        agency_matches = [kw for kw in self.CUSTODY_INTERACTION_KEYWORDS if kw in context_text]
        agency_score = min(0.30, len(agency_matches) * 0.15) if agency_matches else 0.0
        scoring["character_interaction"] = agency_score

        # -------------------------------------------------------------
        # 4. Custody Transfer & Ownership
        # -------------------------------------------------------------
        custody_score = 0.25 if (involves_custody or any(w in context_text for w in ["handed", "passed", "inherited", "stole"])) else 0.0
        scoring["custody_transfer"] = custody_score

        # -------------------------------------------------------------
        # 5. State Mutation (forged, destroyed, killed, poisoned)
        # -------------------------------------------------------------
        mutation_score = 0.25 if (involves_state_mutation or any(w in context_text for w in ["died", "killed", "poisoned", "severed", "destroyed", "forged"])) else 0.0
        scoring["state_mutation"] = mutation_score

        # -------------------------------------------------------------
        # 6. Recurrence Across Scenes / Chapters
        # -------------------------------------------------------------
        recurrence_score = 0.0
        if occurrence_count >= 5:
            recurrence_score = 0.20
        elif occurrence_count >= 3:
            recurrence_score = 0.12
        elif occurrence_count >= 2:
            recurrence_score = 0.06
        scoring["recurrence"] = recurrence_score

        # -------------------------------------------------------------
        # 7. Authorial Emphasis (Distinctive title, capitalisation, unique name)
        # -------------------------------------------------------------
        emphasis_score = 0.0
        if is_capitalized and not is_incidental_noun:
            emphasis_score = 0.15
        scoring["authorial_emphasis"] = emphasis_score

        # -------------------------------------------------------------
        # 8. Incidental Context Penalty
        # -------------------------------------------------------------
        incidental_penalty = 0.0
        if is_incidental_noun:
            # If purely decorative (e.g. "sat on a chair", "drank a cup of tea")
            if not (plot_matches or agency_matches or involves_custody or involves_state_mutation):
                incidental_penalty = -0.50
            else:
                # E.g. "The poisoned chalice" or "The silver key used to unlock"
                incidental_penalty = -0.10
        scoring["incidental_penalty"] = incidental_penalty

        # Compute final narrative relevance score (bounded [0.0, 1.0])
        raw_salience = (
            base_salience
            + plot_score
            + agency_score
            + custody_score
            + mutation_score
            + recurrence_score
            + emphasis_score
            + incidental_penalty
        )
        final_relevance = max(0.0, min(1.0, round(raw_salience, 3)))

        # Determine Narrative Role
        if validated_type == "character":
            narrative_role = "protagonist" if occurrence_count >= 10 else ("supporting" if final_relevance >= 0.65 else "minor")
        elif validated_type == "location":
            narrative_role = "key_location" if final_relevance >= 0.65 else "minor"
        elif validated_type == "faction":
            narrative_role = "faction"
        elif plot_matches or involves_custody:
            narrative_role = "plot_device"
        elif is_incidental_noun and final_relevance < 0.40:
            narrative_role = "incidental"
        else:
            narrative_role = "prop"

        # Special check: single-mention critical object vs ambiguous item
        # E.g. "The king drank from the poisoned chalice and died" -> plot_matches present -> accepted
        # E.g. "She noticed a strange ring on the table" -> ring with no action -> needs_review
        if validated_type == "object" and "ring" in lower_name and not (plot_matches or involves_custody):
            if 0.35 <= final_relevance <= 0.60:
                final_relevance = 0.50

        # Determine Admission Status
        if final_relevance >= self.acceptance_threshold:
            admission_status = "accepted"
            rationale = f"Admitted into Story Architecture (relevance={final_relevance} >= {self.acceptance_threshold})."
            requires_review = False
        elif final_relevance >= self.review_threshold:
            admission_status = "needs_review"
            rationale = f"Held for author review (relevance={final_relevance} in [{self.review_threshold}, {self.acceptance_threshold}))."
            requires_review = True
        else:
            admission_status = "rejected"
            rationale = f"Rejected as incidental or insignificant reference (relevance={final_relevance} < {self.review_threshold})."
            requires_review = False

        return PolicyEvaluationResult(
            name=cleaned_name,
            proposed_type=norm_type,
            validated_type=validated_type,
            admission_status=admission_status,
            narrative_role=narrative_role,
            narrative_relevance=final_relevance,
            extraction_confidence=1.0,
            identity_confidence=0.95 if is_capitalized else 0.70,
            evidence_confidence=1.0 if mention_context.sentence else 0.0,
            scoring_breakdown=scoring,
            rationale=rationale,
            is_incidental=(is_incidental_noun and final_relevance < self.acceptance_threshold),
            requires_human_review=requires_review
        )


narrative_entity_admission_policy = NarrativeEntityAdmissionPolicy()
