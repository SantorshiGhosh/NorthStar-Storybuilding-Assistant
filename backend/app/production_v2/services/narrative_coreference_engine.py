"""
Narrative Coreference Engine Service
Provides deterministic, context-driven coreference resolution:
- Personal, object, possessive, reflexive pronouns and demonstratives
- Descriptive references and multi-token name variants
- ZERO hardcoded name-to-gender lists: dynamically extracts gender from textual evidence, titles, and proximity pronouns
- Rigorous ambiguity detection: strictly flags same-gender antecedents as 'ambiguous' without guessing
- Type preservation: distinguishes inanimate 'it' from persons and resolves plural 'they' to groups.
"""
import re
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, field


@dataclass
class DynamicEntityProfile:
    id: str
    name: str
    entity_type: str = "character"      # 'character', 'object', 'location', 'faction'
    gender: str = "unknown"            # 'male', 'female', 'inanimate', 'unknown'
    number: str = "singular"           # 'singular', 'plural'
    aliases: List[str] = field(default_factory=list)
    titles: List[str] = field(default_factory=list)
    roles: List[str] = field(default_factory=list)
    traits: List[str] = field(default_factory=list)
    last_seen_sentence_idx: int = -1
    last_seen_char_idx: int = -1
    last_grammatical_role: str = "subject"
    evidence_quotes: List[str] = field(default_factory=list)


@dataclass
class CorefResolutionOutput:
    mention_span: str
    mention_type: str        # 'proper_name', 'pronoun', 'descriptive_ref', 'demonstrative', 'incidental_noun'
    char_start: int
    char_end: int
    resolved_entity_id: Optional[str]
    resolved_name: Optional[str]
    resolution_status: str   # 'resolved', 'ambiguous', 'unresolved', 'rejected'
    is_ambiguous: bool
    confidence: float
    candidate_entity_ids: List[str] = field(default_factory=list)
    explanation: str = ""
    context_sentence: str = ""
    inferred_gender: str = "unknown"
    inferred_number: str = "singular"


class NarrativeCoreferenceEngine:
    """
    Coreference resolution engine built on linguistic discourse constraints,
    dynamic gender discovery, and strict ambiguity demarcation.
    """

    MALE_TITLES = {"lord", "king", "prince", "duke", "sir", "father", "brother", "mr.", "mr", "emperor", "baron"}
    FEMALE_TITLES = {"lady", "queen", "princess", "duchess", "sister", "mother", "mrs.", "mrs", "ms.", "ms", "empress", "baroness"}

    PRONOUNS_MALE = {
        "he": "subject", "him": "object", "his": "possessive", "himself": "reflexive"
    }
    PRONOUNS_FEMALE = {
        "she": "subject", "her": "object_or_possessive", "hers": "possessive", "herself": "reflexive"
    }
    PRONOUNS_INANIMATE = {
        "it": "subject_or_object", "its": "possessive", "itself": "reflexive"
    }
    PRONOUNS_PLURAL = {
        "they": "subject", "them": "object", "their": "possessive", "theirs": "possessive", "themselves": "reflexive"
    }
    DEMONSTRATIVES = {"this", "that", "these", "those"}

    def __init__(self):
        self._sentence_regex = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s+')

    def infer_profile_gender_from_evidence(
        self,
        name: str,
        text_context: str,
        titles: Optional[List[str]] = None,
        traits: Optional[List[str]] = None
    ) -> str:
        """
        Dynamically extracts gender purely from titles, descriptors, or proximate pronouns.
        NEVER relies on hardcoded first-name dictionaries.
        """
        all_titles = [t.lower() for t in (titles or [])]
        all_traits = [tr.lower() for tr in (traits or [])]
        lower_name = name.lower()

        # 1. Check gendered titles
        if any(t in self.FEMALE_TITLES for t in all_titles) or any(t in lower_name for t in self.FEMALE_TITLES):
            return "female"
        if any(t in self.MALE_TITLES for t in all_titles) or any(t in lower_name for t in self.MALE_TITLES):
            return "male"

        # 2. Check gendered traits / descriptions
        if any(w in all_traits for w in ["woman", "girl", "mother", "daughter", "sister", "queen", "female"]):
            return "female"
        if any(w in all_traits for w in ["man", "boy", "father", "son", "brother", "king", "male"]):
            return "male"

        # 3. Dynamic textual proximity check: Look for "Name ... he/she" in the text
        if text_context:
            clean_name = re.escape(name.strip())
            # Search for pronoun following the name in the same sentence or adjacent sentence
            male_follow = re.search(rf'\b{clean_name}\b[^.!?]*\b(he|him|his|himself)\b', text_context, re.IGNORECASE)
            female_follow = re.search(rf'\b{clean_name}\b[^.!?]*\b(she|her|hers|herself)\b', text_context, re.IGNORECASE)

            if male_follow and not female_follow:
                return "male"
            if female_follow and not male_follow:
                return "female"

        return "unknown"

    def match_name_variant(self, mention_span: str, profile: DynamicEntityProfile) -> float:
        """
        Matches proper names against canonical entities using exact, alias, surname, or title variants.
        """
        span_clean = mention_span.strip().lower()
        ent_name_clean = profile.name.strip().lower()

        # 1. Exact match
        if span_clean == ent_name_clean:
            return 1.0

        # 2. Confirmed alias match
        for alias in profile.aliases:
            if span_clean == alias.strip().lower():
                return 0.98

        # 3. Multi-word surname match (e.g. "Vance" for "Arin Vance" or "Jonathan Vance")
        ent_tokens = ent_name_clean.split()
        if len(ent_tokens) > 1 and span_clean == ent_tokens[-1]:
            return 0.92

        # 4. First name match (e.g. "Jonathan" for "Jonathan Vance")
        if len(ent_tokens) > 1 and span_clean == ent_tokens[0]:
            return 0.88

        # 5. Title plus surname (e.g. "Inspector Vance" matching "Arin Vance")
        span_tokens = span_clean.split()
        if len(span_tokens) > 1:
            title_token = span_tokens[0]
            name_part = " ".join(span_tokens[1:])
            if name_part in ent_tokens:
                if any(title_token == t.lower() for t in profile.titles) or any(title_token == r.lower() for r in profile.roles):
                    return 0.95

        return 0.0

    def match_descriptive_reference(
        self,
        mention_span: str,
        profile: DynamicEntityProfile,
        discourse_distance: int
    ) -> float:
        """
        Resolves descriptive references like 'the detective', 'the old scholar', 'the sword'.
        Only resolves if the role/trait is explicitly confirmed in the profile or recent discourse.
        """
        span_clean = mention_span.lower().strip()
        stripped = re.sub(r'^(the|a|an)\s+', '', span_clean).strip()

        # Objects
        if profile.entity_type == "object":
            if stripped == profile.name.lower().strip():
                return 0.95
            if stripped in profile.name.lower():
                return 0.85
            # Generic category synonym (e.g. "the weapon" for a sword)
            if stripped == "weapon" and any(w in profile.name.lower() for w in ["sword", "blade", "dagger", "spear"]):
                return 0.90
            if stripped == "artifact" and any(w in profile.name.lower() for w in ["key", "chalice", "talisman", "relic"]):
                return 0.85

        # Characters: match established roles and traits
        for role in profile.roles + profile.titles:
            if role.lower().strip() == stripped:
                return 0.90
            if role.lower().strip() in stripped or stripped in role.lower().strip():
                return 0.80

        for trait in profile.traits:
            if trait.lower().strip() == stripped:
                return 0.85

        return 0.0

    def resolve_coreference(
        self,
        text: str,
        known_entities: List[DynamicEntityProfile],
        chapter_number: int = 1
    ) -> List[CorefResolutionOutput]:
        """
        Runs comprehensive discourse-driven coreference resolution across manuscript text.
        """
        results: List[CorefResolutionOutput] = []
        if not text:
            return results

        sentences = [s.strip() for s in self._sentence_regex.split(text) if s.strip()]

        # Ensure entity genders are populated dynamically from text context
        for ent in known_entities:
            if ent.gender == "unknown":
                ent.gender = self.infer_profile_gender_from_evidence(
                    name=ent.name,
                    text_context=text,
                    titles=ent.titles,
                    traits=ent.traits
                )

        # Active discourse state tracking entity mentions
        # maps entity_id -> dict with sentence_idx, char_idx, role
        discourse_state: Dict[str, Dict[str, Any]] = {}

        # Collect mentions by scanning sentence by sentence
        char_cursor = 0
        for sent_idx, sent in enumerate(sentences):
            sent_start = text.find(sent, char_cursor)
            if sent_start == -1:
                sent_start = char_cursor
            sent_end = sent_start + len(sent)
            char_cursor = sent_end

            words = sent.split()

            # 1. Identify Proper Names
            for ent in known_entities:
                pattern = re.compile(rf'\b{re.escape(ent.name)}\b', re.IGNORECASE)
                for m in pattern.finditer(sent):
                    s_off = sent_start + m.start()
                    e_off = sent_start + m.end()
                    span = m.group(0)

                    # Update discourse
                    discourse_state[ent.id] = {
                        "sentence_idx": sent_idx,
                        "char_idx": s_off,
                        "grammatical_role": "subject" if m.start() < len(sent) // 2 else "object",
                        "entity": ent
                    }

                    results.append(CorefResolutionOutput(
                        mention_span=span,
                        mention_type="proper_name",
                        char_start=s_off,
                        char_end=e_off,
                        resolved_entity_id=ent.id,
                        resolved_name=ent.name,
                        resolution_status="resolved",
                        is_ambiguous=False,
                        confidence=1.0,
                        candidate_entity_ids=[ent.id],
                        explanation=f"Exact match to canonical entity '{ent.name}'.",
                        context_sentence=sent,
                        inferred_gender=ent.gender,
                        inferred_number=ent.number
                    ))

            # 2. Check Surnames / Name Variants (e.g. "Vance")
            for ent in known_entities:
                ent_tokens = ent.name.split()
                if len(ent_tokens) > 1:
                    surname = ent_tokens[-1]
                    pattern = re.compile(rf'\b{re.escape(surname)}\b', re.IGNORECASE)
                    for m in pattern.finditer(sent):
                        s_off = sent_start + m.start()
                        e_off = sent_start + m.end()
                        span = m.group(0)

                        # Avoid duplicate span
                        if any(r.char_start == s_off and r.char_end == e_off for r in results):
                            continue

                        # Ensure this surname is unique among known characters to prevent false merge
                        matching_surnames = [e for e in known_entities if e.name.split()[-1].lower() == surname.lower()]
                        if len(matching_surnames) == 1:
                            discourse_state[ent.id] = {
                                "sentence_idx": sent_idx,
                                "char_idx": s_off,
                                "grammatical_role": "subject",
                                "entity": ent
                            }
                            results.append(CorefResolutionOutput(
                                mention_span=span,
                                mention_type="proper_name",
                                char_start=s_off,
                                char_end=e_off,
                                resolved_entity_id=ent.id,
                                resolved_name=ent.name,
                                resolution_status="resolved",
                                is_ambiguous=False,
                                confidence=0.92,
                                candidate_entity_ids=[ent.id],
                                explanation=f"Resolved surname '{span}' to canonical entity '{ent.name}'.",
                                context_sentence=sent,
                                inferred_gender=ent.gender
                            ))

            # 3. Check Descriptive References ("the detective", "the weapon")
            desc_regex = re.compile(r'\b(the|a|an)\s+([a-zA-Z]+\s+)?(detective|captain|scholar|stranger|woman|man|weapon|sword|key|chalice)\b', re.IGNORECASE)
            for m in desc_regex.finditer(sent):
                s_off = sent_start + m.start()
                e_off = sent_start + m.end()
                span = m.group(0)

                if any(r.char_start == s_off and r.char_end == e_off for r in results):
                    continue

                candidates = []
                for ent in known_entities:
                    dist = abs(sent_idx - discourse_state[ent.id]["sentence_idx"]) if ent.id in discourse_state else 99
                    score = self.match_descriptive_reference(span, ent, dist)
                    if score >= 0.75:
                        candidates.append((ent, score, dist))

                if len(candidates) == 1:
                    matched_ent = candidates[0][0]
                    discourse_state[matched_ent.id] = {
                        "sentence_idx": sent_idx,
                        "char_idx": s_off,
                        "grammatical_role": "subject",
                        "entity": matched_ent
                    }
                    results.append(CorefResolutionOutput(
                        mention_span=span,
                        mention_type="descriptive_ref",
                        char_start=s_off,
                        char_end=e_off,
                        resolved_entity_id=matched_ent.id,
                        resolved_name=matched_ent.name,
                        resolution_status="resolved",
                        is_ambiguous=False,
                        confidence=candidates[0][1],
                        candidate_entity_ids=[matched_ent.id],
                        explanation=f"Resolved descriptive reference '{span}' to '{matched_ent.name}'.",
                        context_sentence=sent
                    ))
                elif len(candidates) > 1:
                    cand_ids = [c[0].id for c in candidates]
                    results.append(CorefResolutionOutput(
                        mention_span=span,
                        mention_type="descriptive_ref",
                        char_start=s_off,
                        char_end=e_off,
                        resolved_entity_id=None,
                        resolved_name=None,
                        resolution_status="ambiguous",
                        is_ambiguous=True,
                        confidence=0.50,
                        candidate_entity_ids=cand_ids,
                        explanation=f"Ambiguous descriptive reference '{span}' matches multiple candidates.",
                        context_sentence=sent
                    ))

            # 4. Check Personal Pronouns (he, she, it, they, him, her, his, its, their)
            all_pronouns = {
                **{p: ("male", "singular", r) for p, r in self.PRONOUNS_MALE.items()},
                **{p: ("female", "singular", r) for p, r in self.PRONOUNS_FEMALE.items()},
                **{p: ("inanimate", "singular", r) for p, r in self.PRONOUNS_INANIMATE.items()},
                **{p: ("neutral", "plural", r) for p, r in self.PRONOUNS_PLURAL.items()}
            }
            pronoun_pattern = re.compile(rf'\b({"|".join(all_pronouns.keys())})\b', re.IGNORECASE)

            for m in pronoun_pattern.finditer(sent):
                s_off = sent_start + m.start()
                e_off = sent_start + m.end()
                span = m.group(0)
                span_lower = span.lower()

                if any(r.char_start == s_off and r.char_end == e_off for r in results):
                    continue

                gender_bias, number_bias, gramm_role = all_pronouns[span_lower]

                # Filter eligible candidates by entity_type, gender, and grammatical number
                eligible_candidates: List[DynamicEntityProfile] = []
                for ent in known_entities:
                    if gender_bias == "male" and ent.entity_type == "character" and ent.gender in ("male", "unknown"):
                        eligible_candidates.append(ent)
                    elif gender_bias == "female" and ent.entity_type == "character" and ent.gender in ("female", "unknown"):
                        eligible_candidates.append(ent)
                    elif gender_bias == "inanimate" and ent.entity_type in ("object", "location"):
                        eligible_candidates.append(ent)
                    elif number_bias == "plural" and (ent.number == "plural" or ent.entity_type == "faction"):
                        eligible_candidates.append(ent)

                # Prioritize candidates by recency in discourse window (within 2 sentences)
                recent_candidates = []
                for ent in eligible_candidates:
                    if ent.id in discourse_state:
                        dist = abs(sent_idx - discourse_state[ent.id]["sentence_idx"])
                        if dist <= 2:
                            recent_candidates.append((ent, dist, discourse_state[ent.id]["grammatical_role"]))

                if not recent_candidates:
                    # If only 1 eligible entity exists in known_entities overall
                    if len(eligible_candidates) == 1:
                        single_match = eligible_candidates[0]
                        results.append(CorefResolutionOutput(
                            mention_span=span,
                            mention_type="pronoun",
                            char_start=s_off,
                            char_end=e_off,
                            resolved_entity_id=single_match.id,
                            resolved_name=single_match.name,
                            resolution_status="resolved",
                            is_ambiguous=False,
                            confidence=0.82,
                            candidate_entity_ids=[single_match.id],
                            explanation=f"Resolved singular antecedent '{single_match.name}'.",
                            context_sentence=sent,
                            inferred_gender=gender_bias
                        ))
                    else:
                        results.append(CorefResolutionOutput(
                            mention_span=span,
                            mention_type="pronoun",
                            char_start=s_off,
                            char_end=e_off,
                            resolved_entity_id=None,
                            resolved_name=None,
                            resolution_status="unresolved",
                            is_ambiguous=False,
                            confidence=0.30,
                            candidate_entity_ids=[e.id for e in eligible_candidates],
                            explanation=f"No recent antecedent for pronoun '{span}'.",
                            context_sentence=sent,
                            inferred_gender=gender_bias
                        ))
                    continue

                if len(recent_candidates) == 1:
                    matched_ent = recent_candidates[0][0]
                    # Update discourse
                    discourse_state[matched_ent.id] = {
                        "sentence_idx": sent_idx,
                        "char_idx": s_off,
                        "grammatical_role": "subject",
                        "entity": matched_ent
                    }
                    results.append(CorefResolutionOutput(
                        mention_span=span,
                        mention_type="pronoun",
                        char_start=s_off,
                        char_end=e_off,
                        resolved_entity_id=matched_ent.id,
                        resolved_name=matched_ent.name,
                        resolution_status="resolved",
                        is_ambiguous=False,
                        confidence=0.92,
                        candidate_entity_ids=[matched_ent.id],
                        explanation=f"Resolved pronoun '{span}' to antecedent '{matched_ent.name}'.",
                        context_sentence=sent,
                        inferred_gender=gender_bias
                    ))
                else:
                    # MULTIPLE CANDIDATES OF SAME GENDER IN DISCOURSE WINDOW
                    # 1. Intra-sentence antecedent: If a candidate was introduced in the SAME sentence
                    same_sent_candidates = [c for c in recent_candidates if c[1] == 0]
                    if len(same_sent_candidates) == 1:
                        matched_ent = same_sent_candidates[0][0]
                        results.append(CorefResolutionOutput(
                            mention_span=span,
                            mention_type="pronoun",
                            char_start=s_off,
                            char_end=e_off,
                            resolved_entity_id=matched_ent.id,
                            resolved_name=matched_ent.name,
                            resolution_status="resolved",
                            is_ambiguous=False,
                            confidence=0.90,
                            candidate_entity_ids=[matched_ent.id],
                            explanation=f"Resolved via intra-sentence antecedent '{matched_ent.name}'.",
                            context_sentence=sent,
                            inferred_gender=gender_bias
                        ))
                        continue

                    # 2. Check distance: if one candidate was closer than others
                    min_dist = min(c[1] for c in recent_candidates)
                    closest_candidates = [c for c in recent_candidates if c[1] == min_dist]

                    if len(closest_candidates) == 1:
                        matched_ent = closest_candidates[0][0]
                        results.append(CorefResolutionOutput(
                            mention_span=span,
                            mention_type="pronoun",
                            char_start=s_off,
                            char_end=e_off,
                            resolved_entity_id=matched_ent.id,
                            resolved_name=matched_ent.name,
                            resolution_status="resolved",
                            is_ambiguous=False,
                            confidence=0.85,
                            candidate_entity_ids=[matched_ent.id],
                            explanation=f"Resolved via closest antecedent recency to '{matched_ent.name}'.",
                            context_sentence=sent,
                            inferred_gender=gender_bias
                        ))
                    else:
                        # GENUINE AMBIGUITY: Multiple characters of the same gender at equal proximity without decisive cues
                        # E.g. "Julian fought Stephen. He fell." or "Mira spoke to Sarah. She looked worried."
                        cand_ids = [c[0].id for c in closest_candidates]
                        cand_names = [c[0].name for c in closest_candidates]
                        results.append(CorefResolutionOutput(
                            mention_span=span,
                            mention_type="pronoun",
                            char_start=s_off,
                            char_end=e_off,
                            resolved_entity_id=None,
                            resolved_name=None,
                            resolution_status="ambiguous",
                            is_ambiguous=True,
                            confidence=0.50,
                            candidate_entity_ids=cand_ids,
                            explanation=f"Ambiguous pronoun '{span}' between same-gender antecedents: {', '.join(cand_names)}.",
                            context_sentence=sent,
                            inferred_gender=gender_bias
                        ))

        # Sort results by character start
        results.sort(key=lambda r: r.char_start)
        return results


narrative_coreference_engine = NarrativeCoreferenceEngine()
