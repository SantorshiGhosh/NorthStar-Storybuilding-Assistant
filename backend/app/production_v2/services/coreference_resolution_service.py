"""
Coreference Resolution Service
Resolves pronouns, descriptive references, and name variations to canonical entities.
Maintains discourse memory with gender, number, and syntactic binding constraints.
Strictly flags genuine ambiguities as 'ambiguous' rather than hallucinating or guessing.
"""
from typing import List, Dict, Any, Optional, Set
from dataclasses import dataclass, field
from app.production_v2.services.narrative_mention_classifier import TextMention, narrative_mention_classifier


@dataclass
class EntityProfile:
    id: str
    name: str
    entity_type: str = "character"       # character, object, location, faction
    gender: str = "unknown"             # male, female, inanimate, unknown
    number: str = "singular"            # singular, plural
    aliases: List[str] = field(default_factory=list)
    titles: List[str] = field(default_factory=list)
    roles: List[str] = field(default_factory=list)
    traits: List[str] = field(default_factory=list)
    last_seen_sentence_idx: int = -1
    last_seen_char_idx: int = -1
    salience_score: float = 0.5


@dataclass
class ResolutionResult:
    mention_span: str
    mention_type: str
    char_start: int
    char_end: int
    resolved_entity_id: Optional[str]
    resolved_name: Optional[str]
    resolution_status: str       # resolved, ambiguous, unresolved, rejected
    is_ambiguous: bool
    confidence: float
    candidate_entity_ids: List[str] = field(default_factory=list)
    explanation: str = ""
    context_sentence: str = ""


class CoreferenceResolutionService:
    """
    Deterministic discourse-aware coreference resolution engine.
    """

    MALE_INDICATOR_TITLES = {"lord", "king", "prince", "duke", "sir", "father", "brother", "mr.", "mr", "emperor"}
    FEMALE_INDICATOR_TITLES = {"lady", "queen", "princess", "duchess", "sister", "mother", "mrs.", "mrs", "ms.", "ms", "empress"}

    MALE_PRONOUNS = {"he", "him", "his", "himself"}
    FEMALE_PRONOUNS = {"she", "her", "hers", "herself"}
    INANIMATE_PRONOUNS = {"it", "its", "itself"}
    PLURAL_PRONOUNS = {"they", "them", "their", "theirs", "themselves"}

    def __init__(self):
        pass

    def infer_gender_from_profile(self, name: str, titles: List[str], traits: List[str]) -> str:
        """Infers male/female/inanimate/unknown based on name, titles, and traits."""
        lower_tokens = set(name.lower().split() + [t.lower() for t in titles] + [tr.lower() for tr in traits])

        if any(t in self.FEMALE_INDICATOR_TITLES for t in lower_tokens):
            return "female"
        if any(t in self.MALE_INDICATOR_TITLES for t in lower_tokens):
            return "male"

        # Well-known gendered names heuristic for fallback
        common_female = {"mira", "sarah", "catherine", "elizabeth", "elena", "maria", "anna", "lyra", "clara", "jane", "mary"}
        common_male = {"arin", "marcus", "julian", "stephen", "john", "jonathan", "edward", "arthur", "vance", "thomas", "william", "robert"}

        first_word = name.lower().split()[0] if name.split() else ""
        if first_word in common_female:
            return "female"
        if first_word in common_male:
            return "male"

        return "unknown"

    def match_name_variant(self, mention_span: str, profile: EntityProfile) -> float:
        """
        Determines if a proper name span matches an entity profile (exact, alias, surname, nickname).
        Returns a confidence score between 0.0 and 1.0.
        """
        span_clean = mention_span.strip().lower()
        ent_name_clean = profile.name.strip().lower()

        # 1. Exact match
        if span_clean == ent_name_clean:
            return 1.0

        # 2. Alias match
        for alias in profile.aliases:
            if span_clean == alias.strip().lower():
                return 0.98

        # 3. Surname match (e.g. "Vance" for "Jonathan Vance" or "Inspector Vance")
        ent_tokens = ent_name_clean.split()
        if len(ent_tokens) > 1 and span_clean == ent_tokens[-1]:
            return 0.92

        # 4. First name match (e.g. "Jonathan" for "Jonathan Vance")
        if len(ent_tokens) > 1 and span_clean == ent_tokens[0]:
            return 0.90

        # 5. Title + surname match (e.g. "Inspector Vance" matching "Arin Vance" if title is Inspector)
        span_tokens = span_clean.split()
        if len(span_tokens) > 1:
            title_part = span_tokens[0]
            name_part = " ".join(span_tokens[1:])
            if name_part in ent_tokens and (title_part in [t.lower() for t in profile.titles] or title_part in [r.lower() for r in profile.roles]):
                return 0.95

        return 0.0

    def match_descriptive_ref(self, mention_span: str, profile: EntityProfile) -> float:
        """
        Matches descriptive references like 'the detective', 'the old healer', 'the silver key'.
        """
        span_clean = mention_span.lower().strip()
        # Remove leading articles
        import re
        stripped = re.sub(r'^(the|a|an)\s+', '', span_clean).strip()

        # Check titles & roles
        for role in profile.roles + profile.titles:
            if role.lower().strip() == stripped:
                return 0.90
            if role.lower().strip() in stripped or stripped in role.lower().strip():
                return 0.80

        # Check traits
        for trait in profile.traits:
            if trait.lower().strip() == stripped:
                return 0.85

        # Check object name
        if profile.entity_type == "object":
            if stripped == profile.name.lower().strip():
                return 0.95
            if stripped in profile.name.lower():
                return 0.85

        return 0.0

    def resolve_text_mentions(
        self,
        text: str,
        known_entities: List[EntityProfile],
        chapter_number: int = 1
    ) -> List[ResolutionResult]:
        """
        Parses text and resolves all mentions to known entities with discourse awareness.
        """
        known_names = [e.name for e in known_entities]
        mentions = narrative_mention_classifier.extract_mentions_from_text(text, known_canonical_names=known_names)
        sentences = narrative_mention_classifier.split_sentences(text)

        # Map character offsets to sentence index
        def get_sentence_idx(char_offset: int) -> int:
            for s_idx, (s_text, s_start, s_end) in enumerate(sentences):
                if s_start <= char_offset < s_end:
                    return s_idx
            return 0

        # Active discourse entity stack: tracks recently mentioned entities
        # maps entity_id -> dict of last appearance info
        discourse_state: Dict[str, Dict[str, Any]] = {}

        results: List[ResolutionResult] = []

        for m in mentions:
            sent_idx = get_sentence_idx(m.char_start)
            span_clean = m.text_span.strip()
            span_lower = span_clean.lower()

            # Case 1: Incidental Noun
            if m.mention_type == "incidental_noun":
                results.append(ResolutionResult(
                    mention_span=span_clean,
                    mention_type="incidental_noun",
                    char_start=m.char_start,
                    char_end=m.char_end,
                    resolved_entity_id=None,
                    resolved_name=None,
                    resolution_status="rejected",
                    is_ambiguous=False,
                    confidence=m.confidence,
                    candidate_entity_ids=[],
                    explanation=f"Incidental noun '{span_clean}' rejected from graph admission.",
                    context_sentence=m.context_sentence
                ))
                continue

            # Case 2: Proper Name
            if m.mention_type == "proper_name":
                best_match = None
                best_score = 0.0

                for ent in known_entities:
                    score = self.match_name_variant(span_clean, ent)
                    if score > best_score:
                        best_score = score
                        best_match = ent

                if best_match and best_score >= 0.80:
                    # Update discourse state
                    discourse_state[best_match.id] = {
                        "sentence_idx": sent_idx,
                        "char_idx": m.char_start,
                        "grammatical_role": m.grammatical_role,
                        "entity": best_match
                    }
                    results.append(ResolutionResult(
                        mention_span=span_clean,
                        mention_type="proper_name",
                        char_start=m.char_start,
                        char_end=m.char_end,
                        resolved_entity_id=best_match.id,
                        resolved_name=best_match.name,
                        resolution_status="resolved",
                        is_ambiguous=False,
                        confidence=best_score,
                        candidate_entity_ids=[best_match.id],
                        explanation=f"Resolved proper name to canonical entity '{best_match.name}' (score={best_score}).",
                        context_sentence=m.context_sentence
                    ))
                else:
                    # Unrecognized proper name
                    results.append(ResolutionResult(
                        mention_span=span_clean,
                        mention_type="proper_name",
                        char_start=m.char_start,
                        char_end=m.char_end,
                        resolved_entity_id=None,
                        resolved_name=None,
                        resolution_status="unresolved",
                        is_ambiguous=False,
                        confidence=0.5,
                        candidate_entity_ids=[],
                        explanation=f"New or unregistered proper name '{span_clean}'.",
                        context_sentence=m.context_sentence
                    ))
                continue

            # Case 3: Descriptive Reference (e.g. "the detective", "the silver key")
            if m.mention_type == "descriptive_ref":
                candidates = []
                for ent in known_entities:
                    score = self.match_descriptive_ref(span_clean, ent)
                    if score >= 0.75:
                        candidates.append((ent, score))

                if len(candidates) == 1:
                    matched_ent, score = candidates[0]
                    discourse_state[matched_ent.id] = {
                        "sentence_idx": sent_idx,
                        "char_idx": m.char_start,
                        "grammatical_role": m.grammatical_role,
                        "entity": matched_ent
                    }
                    results.append(ResolutionResult(
                        mention_span=span_clean,
                        mention_type="descriptive_ref",
                        char_start=m.char_start,
                        char_end=m.char_end,
                        resolved_entity_id=matched_ent.id,
                        resolved_name=matched_ent.name,
                        resolution_status="resolved",
                        is_ambiguous=False,
                        confidence=score,
                        candidate_entity_ids=[matched_ent.id],
                        explanation=f"Resolved descriptive reference '{span_clean}' to '{matched_ent.name}'.",
                        context_sentence=m.context_sentence
                    ))
                elif len(candidates) > 1:
                    # Check discourse recency
                    recent_matches = [
                        (ent, score) for ent, score in candidates
                        if ent.id in discourse_state and abs(discourse_state[ent.id]["sentence_idx"] - sent_idx) <= 2
                    ]
                    if len(recent_matches) == 1:
                        matched_ent, score = recent_matches[0]
                        results.append(ResolutionResult(
                            mention_span=span_clean,
                            mention_type="descriptive_ref",
                            char_start=m.char_start,
                            char_end=m.char_end,
                            resolved_entity_id=matched_ent.id,
                            resolved_name=matched_ent.name,
                            resolution_status="resolved",
                            is_ambiguous=False,
                            confidence=score * 0.9,
                            candidate_entity_ids=[matched_ent.id],
                            explanation=f"Resolved descriptive reference via discourse recency to '{matched_ent.name}'.",
                            context_sentence=m.context_sentence
                        ))
                    else:
                        cand_ids = [c[0].id for c in candidates]
                        results.append(ResolutionResult(
                            mention_span=span_clean,
                            mention_type="descriptive_ref",
                            char_start=m.char_start,
                            char_end=m.char_end,
                            resolved_entity_id=None,
                            resolved_name=None,
                            resolution_status="ambiguous",
                            is_ambiguous=True,
                            confidence=0.5,
                            candidate_entity_ids=cand_ids,
                            explanation=f"Ambiguous descriptive reference '{span_clean}' matches multiple candidates.",
                            context_sentence=m.context_sentence
                        ))
                else:
                    results.append(ResolutionResult(
                        mention_span=span_clean,
                        mention_type="descriptive_ref",
                        char_start=m.char_start,
                        char_end=m.char_end,
                        resolved_entity_id=None,
                        resolved_name=None,
                        resolution_status="unresolved",
                        is_ambiguous=False,
                        confidence=0.4,
                        candidate_entity_ids=[],
                        explanation=f"Unresolved descriptive reference '{span_clean}'.",
                        context_sentence=m.context_sentence
                    ))
                continue

            # Case 4: Pronoun Resolution
            if m.mention_type == "pronoun":
                target_gender = m.gender_bias
                is_plural = (m.number_bias == "plural")

                # Find candidate entities matching gender & number
                eligible_candidates: List[EntityProfile] = []
                for ent in known_entities:
                    ent_gender = ent.gender
                    if ent_gender == "unknown":
                        ent_gender = self.infer_gender_from_profile(ent.name, ent.titles, ent.traits)

                    if target_gender == "male" and ent_gender == "male" and ent.entity_type == "character":
                        eligible_candidates.append(ent)
                    elif target_gender == "female" and ent_gender == "female" and ent.entity_type == "character":
                        eligible_candidates.append(ent)
                    elif target_gender == "inanimate" and ent.entity_type in ("object", "location", "prop"):
                        eligible_candidates.append(ent)
                    elif is_plural and (ent.number == "plural" or ent.entity_type == "faction"):
                        eligible_candidates.append(ent)

                # Filter by discourse recency (within last 3 sentences or same sentence)
                recent_candidates = []
                for ent in eligible_candidates:
                    if ent.id in discourse_state:
                        last_s = discourse_state[ent.id]["sentence_idx"]
                        s_distance = abs(sent_idx - last_s)
                        if s_distance <= 3:
                            recent_candidates.append((ent, s_distance, discourse_state[ent.id]["grammatical_role"]))

                if not recent_candidates:
                    # Fallback to any eligible entity if only 1 exists in the entire chapter
                    if len(eligible_candidates) == 1:
                        single_ent = eligible_candidates[0]
                        results.append(ResolutionResult(
                            mention_span=span_clean,
                            mention_type="pronoun",
                            char_start=m.char_start,
                            char_end=m.char_end,
                            resolved_entity_id=single_ent.id,
                            resolved_name=single_ent.name,
                            resolution_status="resolved",
                            is_ambiguous=False,
                            confidence=0.80,
                            candidate_entity_ids=[single_ent.id],
                            explanation=f"Resolved singular unambiguous antecedent '{single_ent.name}'.",
                            context_sentence=m.context_sentence
                        ))
                    else:
                        results.append(ResolutionResult(
                            mention_span=span_clean,
                            mention_type="pronoun",
                            char_start=m.char_start,
                            char_end=m.char_end,
                            resolved_entity_id=None,
                            resolved_name=None,
                            resolution_status="unresolved",
                            is_ambiguous=False,
                            confidence=0.3,
                            candidate_entity_ids=[c.id for c in eligible_candidates],
                            explanation=f"No recent antecedent found for pronoun '{span_clean}'.",
                            context_sentence=m.context_sentence
                        ))
                    continue

                if len(recent_candidates) == 1:
                    matched_ent, _, _ = recent_candidates[0]
                    # Update discourse
                    discourse_state[matched_ent.id] = {
                        "sentence_idx": sent_idx,
                        "char_idx": m.char_start,
                        "grammatical_role": m.grammatical_role,
                        "entity": matched_ent
                    }
                    results.append(ResolutionResult(
                        mention_span=span_clean,
                        mention_type="pronoun",
                        char_start=m.char_start,
                        char_end=m.char_end,
                        resolved_entity_id=matched_ent.id,
                        resolved_name=matched_ent.name,
                        resolution_status="resolved",
                        is_ambiguous=False,
                        confidence=0.92,
                        candidate_entity_ids=[matched_ent.id],
                        explanation=f"Resolved pronoun '{span_clean}' to unambiguous antecedent '{matched_ent.name}'.",
                        context_sentence=m.context_sentence
                    ))
                else:
                    # Multiple candidates of the same gender in discourse window!
                    # 1. Check intra-sentence subject binding:
                    # In compound sentence "Arin entered and he spoke...", if one candidate is in the SAME sentence as subject:
                    same_sent_subjects = [
                        (ent, dist, role) for ent, dist, role in recent_candidates
                        if dist == 0 and role == "subject"
                    ]
                    if len(same_sent_subjects) == 1:
                        matched_ent = same_sent_subjects[0][0]
                        results.append(ResolutionResult(
                            mention_span=span_clean,
                            mention_type="pronoun",
                            char_start=m.char_start,
                            char_end=m.char_end,
                            resolved_entity_id=matched_ent.id,
                            resolved_name=matched_ent.name,
                            resolution_status="resolved",
                            is_ambiguous=False,
                            confidence=0.88,
                            candidate_entity_ids=[c[0].id for c in recent_candidates],
                            explanation=f"Resolved via intra-sentence subject binding to '{matched_ent.name}'.",
                            context_sentence=m.context_sentence
                        ))
                        continue

                    # 2. Check sentence distance: if one candidate was in distance 0 or 1, and others were further:
                    min_dist = min(c[1] for c in recent_candidates)
                    closest_candidates = [c for c in recent_candidates if c[1] == min_dist]

                    if len(closest_candidates) == 1:
                        matched_ent = closest_candidates[0][0]
                        results.append(ResolutionResult(
                            mention_span=span_clean,
                            mention_type="pronoun",
                            char_start=m.char_start,
                            char_end=m.char_end,
                            resolved_entity_id=matched_ent.id,
                            resolved_name=matched_ent.name,
                            resolution_status="resolved",
                            is_ambiguous=False,
                            confidence=0.85,
                            candidate_entity_ids=[c[0].id for c in recent_candidates],
                            explanation=f"Resolved via closest antecedent recency to '{matched_ent.name}'.",
                            context_sentence=m.context_sentence
                        ))
                    else:
                        # GENUINE AMBIGUITY: Multiple characters of same gender in same or adjacent sentence
                        # E.g. "Julian struck Stephen. He collapsed."
                        cand_ids = [c[0].id for c in closest_candidates]
                        cand_names = [c[0].name for c in closest_candidates]
                        results.append(ResolutionResult(
                            mention_span=span_clean,
                            mention_type="pronoun",
                            char_start=m.char_start,
                            char_end=m.char_end,
                            resolved_entity_id=None,
                            resolved_name=None,
                            resolution_status="ambiguous",
                            is_ambiguous=True,
                            confidence=0.50,
                            candidate_entity_ids=cand_ids,
                            explanation=f"Ambiguous pronoun '{span_clean}' between candidates: {', '.join(cand_names)}.",
                            context_sentence=m.context_sentence
                        ))

        return results


coreference_resolution_service = CoreferenceResolutionService()
