"""
Narrative Relevance Service — Multi-factor Narrative Salience Scoring & Incidental Filtering
Eliminates clutter in the Story Architecture and Knowledge Graph by separating true narrative
entities from incidental props, descriptive nouns, and transient objects.
"""
import re
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class RelevanceEvaluation:
    name: str
    entity_type: str
    salience_score: float
    relevance_status: str  # accepted, rejected, needs_review, temporary_mention
    narrative_role: str    # protagonist, antagonist, supporting, minor, incidental, prop, plot_device, key_location, faction
    scoring_factors: Dict[str, float] = field(default_factory=dict)
    decision_rationale: str = ""
    is_incidental: bool = False


class NarrativeRelevanceService:
    """
    Evaluates entity candidates using multi-factor narrative salience scoring.
    Filters out ordinary nouns, incidental objects, and insignificant references.
    """

    # Common incidental nouns that should be rejected unless they exhibit high plot significance
    INCIDENTAL_NOUNS = {
        "chair", "armchair", "stool", "bench", "seat", "table", "desk", "counter",
        "cup", "glass", "mug", "chalice_incidental", "goblet_incidental", "tea", "coffee", "wine", "ale", "beer", "water",
        "bread", "meal", "food", "plate", "bowl", "fork", "knife_incidental", "spoon",
        "door", "doorway", "wooden door", "front door", "back door", "gate", "window",
        "wall", "floor", "ceiling", "roof", "stairs", "staircase", "hallway", "corridor",
        "shirt", "coat", "jacket", "cloak", "boots", "shoes", "gloves", "hat", "trousers", "dress",
        "pen", "paper", "quill", "ink", "candle", "lamp", "lantern", "torch",
        "carriage", "wagon", "cart", "horse", "saddle", "reins", "street", "road", "pavement"
    }

    # Salience keywords indicating plot consequence or character agency
    PLOT_CONSEQUENCE_KEYWORDS = {
        "murder", "killed", "stabbed", "poison", "poisoned", "assassinate", "weapon",
        "clue", "evidence", "secret", "revelation", "unlocked", "vault", "prophecy",
        "curse", "enchanted", "sacred", "ancient", "forbidden", "heirloom", "relic",
        "ritual", "conspiracy", "betrayal", "artifact", "talisman", "crown", "throne"
    }

    # Interaction / agency verbs
    AGENCY_KEYWORDS = {
        "wielded", "wield", "stole", "steal", "forged", "forge", "destroyed", "destroy",
        "inherited", "bequeathed", "concealed", "smuggled", "sought", "discovered",
        "unlocked", "activated", "decoded", "guarded", "traded"
    }

    # High salience entity types
    PERSON_TYPES = {"character", "person", "protagonist", "antagonist", "npc"}
    LOCATION_TYPES = {"location", "place", "city", "kingdom", "realm", "region"}
    FACTION_TYPES = {"faction", "organization", "guild", "clan", "family", "house", "order"}

    def __init__(
        self,
        acceptance_threshold: float = 0.65,
        review_threshold: float = 0.40
    ):
        self.acceptance_threshold = acceptance_threshold
        self.review_threshold = review_threshold

    def evaluate_entity(
        self,
        name: str,
        entity_type: str,
        description: Optional[str] = None,
        context_sentences: Optional[List[str]] = None,
        traits: Optional[List[str]] = None,
        occurrence_count: int = 1,
        is_proper_noun: Optional[bool] = None,
        involves_custody: bool = False,
        involves_state_mutation: bool = False
    ) -> RelevanceEvaluation:
        """
        Calculates multi-factor salience score and returns definitive relevance status.
        """
        clean_name = (name or "").strip()
        lower_name = clean_name.lower()
        sentences = context_sentences or []
        combined_text = " ".join(sentences + ([description] if description else []) + (traits or [])).lower()

        factors: Dict[str, float] = {}

        # 1. Base Type Salience
        norm_type = (entity_type or "").lower().strip()
        is_named_person = norm_type in self.PERSON_TYPES
        is_location = norm_type in self.LOCATION_TYPES
        is_faction = norm_type in self.FACTION_TYPES

        # Check whether the name is an incidental noun or contains one as head noun
        stripped_noun = re.sub(r'^(the|a|an)\s+', '', lower_name).strip()
        tokens = stripped_noun.split()
        is_incidental_noun = (
            stripped_noun in self.INCIDENTAL_NOUNS
            or any(t in self.INCIDENTAL_NOUNS for t in tokens)
        )

        if is_named_person:
            # Characters with proper names get high baseline
            base_score = 0.85 if clean_name and clean_name[0].isupper() else 0.65
        elif is_location:
            base_score = 0.75 if clean_name and clean_name[0].isupper() else 0.50
        elif is_faction:
            base_score = 0.80
        elif is_incidental_noun:
            base_score = 0.10
        else:
            # Generic object or other entity
            base_score = 0.45 if clean_name and clean_name[0].isupper() else 0.25

        factors["base_salience"] = base_score

        # 2. Plot Progression & Consequence Factor
        plot_score = 0.0
        plot_matches = [kw for kw in self.PLOT_CONSEQUENCE_KEYWORDS if kw in combined_text or kw in lower_name]
        if plot_matches:
            plot_score = min(0.35, len(plot_matches) * 0.15)
        factors["plot_progression"] = plot_score

        # 3. Character Agency & Interaction Factor
        agency_score = 0.0
        agency_matches = [kw for kw in self.AGENCY_KEYWORDS if kw in combined_text]
        if agency_matches:
            agency_score = min(0.25, len(agency_matches) * 0.12)
        factors["character_agency"] = agency_score

        # 4. Custody / Ownership Transfer Factor
        custody_score = 0.20 if involves_custody else 0.0
        factors["custody_tracking"] = custody_score

        # 5. State Mutation Factor (transformation, damage, forging, death)
        mutation_score = 0.20 if involves_state_mutation else 0.0
        factors["state_mutation"] = mutation_score

        # 6. Recurrence Factor
        recurrence_score = 0.0
        if occurrence_count >= 5:
            recurrence_score = 0.25
        elif occurrence_count >= 3:
            recurrence_score = 0.15
        elif occurrence_count >= 2:
            recurrence_score = 0.08
        factors["recurrence"] = recurrence_score

        # 7. Authorial Emphasis (Proper noun, unique artifact epithet)
        emphasis_score = 0.0
        if is_proper_noun is None:
            # Infer proper noun status: capitalized words not matching incidental pattern
            words = clean_name.split()
            if words and all(w[0].isupper() for w in words if w.lower() not in ("of", "the", "in", "and")):
                if not is_incidental_noun:
                    is_proper_noun = True
                else:
                    is_proper_noun = False
            else:
                is_proper_noun = False

        if is_proper_noun and not is_incidental_noun:
            emphasis_score = 0.15
        factors["authorial_emphasis"] = emphasis_score

        # 8. Incidental Penalty
        incidental_penalty = 0.0
        if is_incidental_noun:
            # If it has NO plot consequence, NO agency, NO custody, and NO mutation, penalize heavily
            if not (plot_matches or agency_matches or involves_custody or involves_state_mutation):
                incidental_penalty = -0.50
            else:
                # Plot-critical object (e.g. "The Silver Key", "The Poisoned Chalice")
                incidental_penalty = -0.10
        factors["incidental_penalty"] = incidental_penalty

        # Compute raw salience score
        raw_salience = (
            base_score
            + plot_score
            + agency_score
            + custody_score
            + mutation_score
            + recurrence_score
            + emphasis_score
            + incidental_penalty
        )
        final_salience = max(0.0, min(1.0, round(raw_salience, 3)))

        # Determine Narrative Role
        if is_named_person:
            if occurrence_count >= 5 or plot_matches:
                narrative_role = "protagonist" if occurrence_count >= 10 else "supporting"
            else:
                narrative_role = "minor"
        elif is_location:
            narrative_role = "key_location" if final_salience >= 0.65 else "minor_location"
        elif is_faction:
            narrative_role = "faction"
        elif plot_matches or involves_custody:
            narrative_role = "plot_device"
        elif is_incidental_noun and final_salience < 0.40:
            narrative_role = "incidental"
        else:
            narrative_role = "prop"

        # Determine Relevance Status
        if final_salience >= self.acceptance_threshold:
            relevance_status = "accepted"
            rationale = f"Admitted into Story Architecture (salience={final_salience} >= {self.acceptance_threshold})."
        elif final_salience >= self.review_threshold:
            relevance_status = "needs_review"
            rationale = f"Held for author review (salience={final_salience} in [{self.review_threshold}, {self.acceptance_threshold}))."
        else:
            relevance_status = "rejected"
            rationale = f"Filtered out as incidental reference (salience={final_salience} < {self.review_threshold})."

        return RelevanceEvaluation(
            name=clean_name,
            entity_type=norm_type or "object",
            salience_score=final_salience,
            relevance_status=relevance_status,
            narrative_role=narrative_role,
            scoring_factors=factors,
            decision_rationale=rationale,
            is_incidental=(is_incidental_noun and final_salience < self.acceptance_threshold)
        )

    def filter_extracted_entities(
        self,
        extracted_entities: List[Dict[str, Any]],
        chapter_content: Optional[str] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Splits a list of raw extracted entities into 'accepted', 'needs_review', and 'rejected'.
        """
        accepted = []
        needs_review = []
        rejected = []

        content = chapter_content or ""

        for ent in extracted_entities:
            name = ent.get("name", "")
            if not name:
                continue

            ent_type = ent.get("entity_type", "character")
            desc = ent.get("description", "")
            traits = ent.get("traits", [])

            # Extract sentence contexts from chapter content
            sentences = []
            if content:
                # Find sentences containing the entity name
                pattern = re.compile(rf'([^.!?\n]*\b{re.escape(name)}\b[^.!?\n]*[.!?])', re.IGNORECASE)
                sentences = [m.strip() for m in pattern.findall(content)][:5]

            # Check if involved in custody or state mutation
            has_custody = any(kw in (desc + " ".join(traits)).lower() for kw in ["possesses", "carried", "stole", "custody", "holder"])
            has_mutation = any(kw in (desc + " ".join(traits)).lower() for kw in ["severed", "blinded", "killed", "injured", "forged", "destroyed"])

            eval_res = self.evaluate_entity(
                name=name,
                entity_type=ent_type,
                description=desc,
                context_sentences=sentences,
                traits=traits,
                involves_custody=has_custody,
                involves_state_mutation=has_mutation
            )

            # Enrich dict with evaluation
            enriched = dict(ent)
            enriched["salience_score"] = eval_res.salience_score
            enriched["relevance_status"] = eval_res.relevance_status
            enriched["narrative_role"] = eval_res.narrative_role
            enriched["decision_rationale"] = eval_res.decision_rationale

            if eval_res.relevance_status == "accepted":
                accepted.append(enriched)
            elif eval_res.relevance_status == "needs_review":
                needs_review.append(enriched)
            else:
                rejected.append(enriched)

        return {
            "accepted": accepted,
            "needs_review": needs_review,
            "rejected": rejected
        }


narrative_relevance_service = NarrativeRelevanceService()
