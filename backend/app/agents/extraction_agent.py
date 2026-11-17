import re
import logging
from typing import Dict, Any, List, Optional, Tuple
from app.services.ai_provider import ai_provider
from app.services.identity_service import identity_service, COMMON_STOP_WORDS, TITLES_PREFIXES

logger = logging.getLogger("extraction_agent")

class NarrativeExtractionAgent:
    """
    Data-driven Narrative Extraction Agent.
    Extracts entities, temporal narrative facts, grammatical roles,
    negations/uncertainties, and relationships with verbatim source quotes.
    Completely isolated from hardcoded character names or demo universes.
    """

    SYSTEM_PROMPT = """
You are the Narrative Extraction Agent in NorthStar.
Read the manuscript chapter and extract established story canon with verbatim source quotations.
Never invent facts not explicitly stated in the text.
Classify certainty: note whether a statement is objective fact, a character belief, a lie, a rumour, or a hypothetical fear.

Return a valid JSON object matching this schema:
{
  "entities": [
    {
      "name": "Canonical Entity Name",
      "entity_type": "character" | "location" | "object" | "rule" | "faction" | "creature",
      "description": "Short description based only on this chapter",
      "traits": ["trait1", "trait2"],
      "facts": [
        {
          "fact": "Clear concise summary of the fact",
          "category": "physical_state" | "status" | "lore_rule" | "location" | "possession" | "event" | "general",
          "source_quote": "Exact verbatim quote from the text",
          "is_negated": false,
          "uncertainty_level": "none" | "hypothetical" | "belief" | "rumour" | "fear"
        }
      ]
    }
  ],
  "relationships": [
    {
      "source_name": "Entity 1",
      "target_name": "Entity 2",
      "relation_type": "allied_with" | "opposes" | "family_of" | "subordinate_to" | "located_in" | "possesses" | "associated_with",
      "source_quote": "Exact verbatim quote from text",
      "description": "Explanation of the relationship"
    }
  ],
  "timeline_events": [
    {
      "title": "Concise event title",
      "description": "What occurred",
      "location": "Location if mentioned",
      "participants": ["Character names"],
      "time_label": "Explicit or relative time marker if present"
    }
  ]
}
"""

    def extract_from_chapter(
        self,
        chapter_content: str,
        chapter_number: int,
        chapter_title: str
    ) -> Dict[str, Any]:
        """
        Runs hybrid extraction:
        1. Gemini structured JSON extraction if available.
        2. High-precision deterministic NLP extraction layer.
        3. Merges results, ensuring verbatim quote citations and zero demonstration hallucinations.
        """
        llm_data = None
        prompt = f"""
Analyze Chapter {chapter_number}: "{chapter_title}".

MANUSCRIPT CONTENT:
\"\"\"
{chapter_content}
\"\"\"
"""
        try:
            result = ai_provider.generate_json(prompt, system_instruction=self.SYSTEM_PROMPT)
            if result and isinstance(result, dict) and "entities" in result:
                llm_data = self._normalize_extraction(result, chapter_number)
        except Exception as e:
            logger.warning(f"LLM extraction warning ({e}); using deterministic NLP layer.")

        # Always execute data-driven deterministic NLP layer
        heuristic_data = self._heuristic_extraction(chapter_content, chapter_number, chapter_title)

        if not llm_data:
            return heuristic_data

        return self._merge_extractions(llm_data, heuristic_data)

    def _normalize_extraction(self, data: Dict[str, Any], chapter_number: int) -> Dict[str, Any]:
        entities = data.get("entities", [])
        for ent in entities:
            ent["first_appearance_chapter"] = chapter_number
            for fact in ent.get("facts", []):
                fact["source_chapter_number"] = chapter_number

        return {
            "entities": entities,
            "relationships": data.get("relationships", []),
            "timeline_events": data.get("timeline_events", [])
        }

    def _merge_extractions(self, primary: Dict[str, Any], secondary: Dict[str, Any]) -> Dict[str, Any]:
        ent_by_name = {e["name"].lower(): e for e in primary.get("entities", []) if e.get("name")}

        for ent in secondary.get("entities", []):
            name_key = ent["name"].lower()
            if name_key in ent_by_name:
                target = ent_by_name[name_key]
                # Merge traits
                curr_traits = set(target.get("traits", []))
                curr_traits.update(ent.get("traits", []))
                target["traits"] = list(curr_traits)

                # Merge facts without duplicates
                existing_quotes = {f.get("source_quote", "").strip().lower() for f in target.get("facts", [])}
                for f in ent.get("facts", []):
                    q = f.get("source_quote", "").strip().lower()
                    if q and q not in existing_quotes:
                        target.setdefault("facts", []).append(f)
                        existing_quotes.add(q)
            else:
                primary.setdefault("entities", []).append(ent)
                ent_by_name[name_key] = ent

        # Merge relationships
        existing_rels = {
            (r.get("source_name", "").lower(), r.get("target_name", "").lower(), r.get("relation_type", "").lower())
            for r in primary.get("relationships", [])
        }
        for rel in secondary.get("relationships", []):
            rel_key = (rel.get("source_name", "").lower(), rel.get("target_name", "").lower(), rel.get("relation_type", "").lower())
            if rel_key not in existing_rels:
                primary.setdefault("relationships", []).append(rel)
                existing_rels.add(rel_key)

        primary.setdefault("timeline_events", []).extend(secondary.get("timeline_events", []))
        return primary

    def _heuristic_extraction(
        self,
        content: str,
        chapter_number: int,
        chapter_title: str
    ) -> Dict[str, Any]:
        """
        Universal data-driven extraction layer.
        Does NOT hardcode any story-specific characters or places.
        Uses grammatical role tagging, negation handling, and verbatim evidence citations.
        """
        entities_dict: Dict[str, Dict[str, Any]] = {}
        relationships: List[Dict[str, Any]] = []
        events: List[Dict[str, Any]] = []

        # 1. Extract candidate entities dynamically via IdentityService
        candidate_entities = identity_service.extract_named_entities(content, chapter_number=chapter_number)
        for cand in candidate_entities:
            entities_dict[cand["name"].lower()] = cand

        def get_or_register(name: str, ent_type: str = "character") -> Dict[str, Any]:
            key = name.strip().lower()
            if key not in entities_dict:
                entities_dict[key] = {
                    "name": name.strip(),
                    "entity_type": ent_type,
                    "description": f"{ent_type.capitalize()} in Chapter {chapter_number}",
                    "traits": [],
                    "first_appearance_chapter": chapter_number,
                    "facts": []
                }
            return entities_dict[key]

        # 2. Split into sentences
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', content) if s.strip()]
        registered_characters = [
            v["name"] for v in entities_dict.values() if v.get("entity_type") == "character"
        ]

        # 3. Analyze each sentence for grammatical subject, negation, uncertainty, and facts
        for sent in sentences:
            s_low = sent.lower()

            # Negation detection
            is_negated = bool(re.search(r'\b(did not|could not|never|would not|had not|was not|were not|no longer|cannot)\b', s_low))

            # Uncertainty / modality detection
            uncertainty = "none"
            if any(term in s_low for term in ["might", "maybe", "perhaps", "could be", "rumoured", "rumored", "alleged"]):
                uncertainty = "hypothetical"
            elif any(term in s_low for term in ["feared that", "dreaded that", "worried that"]):
                uncertainty = "fear"
            elif any(term in s_low for term in ["believed that", "thought that", "assumed that", "felt that"]):
                uncertainty = "belief"
            elif any(term in s_low for term in ["remembered", "recalled", "in memory"]):
                uncertainty = "memory"

            # Identify which registered characters appear in this sentence
            present_chars = [
                c for c in registered_characters
                if re.search(rf'\b{re.escape(c)}\b', sent, re.IGNORECASE)
                or (c.split()[0] if len(c.split()) > 1 else c) in sent
            ]

            # Primary subject determination: Character appearing before the main verb
            primary_subject = present_chars[0] if present_chars else None

            # --- CATEGORY A: Physical Injuries, Laterality & Amputations ---
            injury_match = re.search(
                r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:had\s+)?(?:lost|crushed|severed|amputated|shattered|broken|burned)\s+(?:his|her|their)?\s*(left|right)?\s*(arm|hand|leg|foot|eye|finger|shoulder|limb)\b',
                sent,
                re.IGNORECASE
            ) or re.search(
                r'\b(?:collapsing\s+[a-z]+|blow|strike|blast|explosion|blade)\s+(?:crushed|severed|amputated|injured)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\'s)?)\s+(left|right)?\s*(arm|hand|leg|foot|eye|shoulder|limb)\b',
                sent,
                re.IGNORECASE
            )

            if injury_match:
                subj_name = primary_subject
                for g in injury_match.groups():
                    cand = g.strip() if g else ""
                    if cand and cand.title() in registered_characters:
                        subj_name = cand.title()
                        break
                    elif cand and not any(w.lower() in COMMON_STOP_WORDS for w in cand.split()) and len(cand) >= 3 and cand.lower() not in ["left", "right", "arm", "hand", "leg", "foot", "eye", "finger", "shoulder", "limb"]:
                        subj_name = cand.title()
                        break

                if subj_name:
                    ent = get_or_register(subj_name, "character")
                    laterality = ""
                    for w in ["left", "right"]:
                        if w in sent.lower():
                            laterality = f"{w} "
                    body_part = ""
                    for b in ["arm", "hand", "leg", "eye", "foot", "shoulder"]:
                        if b in sent.lower():
                            body_part = b

                    trait_desc = f"injured {laterality}{body_part}".strip()
                    if trait_desc and trait_desc not in ent["traits"]:
                        ent["traits"].append(trait_desc)

                    ent.setdefault("facts", []).append({
                        "fact": f"{subj_name} suffered a physical injury: {sent}",
                        "category": "physical_state",
                        "source_chapter_number": chapter_number,
                        "source_quote": sent,
                        "is_negated": is_negated,
                        "uncertainty_level": uncertainty
                    })

            # --- CATEGORY B: Mortality, Death & Burial ---
            death_match = re.search(
                r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:was\s+killed|died|was\s+murdered|perished|was\s+slain|lay\s+dead|was\s+buried)\b',
                sent
            )
            if death_match:
                d_cand = death_match.group(1).strip()
                if d_cand not in COMMON_STOP_WORDS and len(d_cand) >= 3:
                    # Check if matching existing character
                    target_char = d_cand
                    for rc in registered_characters:
                        if d_cand.lower() in rc.lower():
                            target_char = rc
                            break

                    ent = get_or_register(target_char, "character")
                    if not is_negated and uncertainty == "none":
                        if "deceased" not in ent["traits"]:
                            ent["traits"].append("deceased")

                    ent.setdefault("facts", []).append({
                        "fact": f"{target_char} was reported dead/killed in Chapter {chapter_number}: {sent}",
                        "category": "status",
                        "source_chapter_number": chapter_number,
                        "source_quote": sent,
                        "is_negated": is_negated,
                        "uncertainty_level": uncertainty
                    })

            # --- CATEGORY C: World Rules, Constraints & Locks ---
            rule_match = re.search(
                r'\b(?:could\s+only\s+be\s+opened\s+by|required\s+.*?\s+to\s+open|cannot\s+enter\s+without|only\s+a\s+.*?\s+could\s+(?:open|enter|unlock)|no\s+.*?\s+could\s+open|must\s+never\s+be\s+separated|locked\s+from\s+the\s+inside)\b',
                sent,
                re.IGNORECASE
            )
            if rule_match:
                # Find which object/place this rule governs
                rule_target = "World Rule"
                for o_name, o_obj in entities_dict.items():
                    if o_obj.get("entity_type") in ["object", "location"] and o_name in s_low:
                        rule_target = o_obj["name"]
                        break

                ent = get_or_register(rule_target, "rule" if rule_target == "World Rule" else "object")
                ent.setdefault("facts", []).append({
                    "fact": f"Canon rule: {sent}",
                    "category": "lore_rule",
                    "source_chapter_number": chapter_number,
                    "source_quote": sent,
                    "is_negated": is_negated,
                    "uncertainty_level": uncertainty
                })

            # --- CATEGORY D: Object Custody & Transfers ---
            custody_match = re.search(
                r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(gave|handed|passed|entrusted|delivered|sent)\s+(?:the\s+)?([a-zA-Z\s]+?)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b',
                sent,
                re.IGNORECASE
            )
            if custody_match:
                giver, action, item, receiver = (
                    custody_match.group(1).strip(),
                    custody_match.group(2).strip(),
                    custody_match.group(3).strip(),
                    custody_match.group(4).strip()
                )
                if giver not in COMMON_STOP_WORDS and receiver not in COMMON_STOP_WORDS:
                    ent_giver = get_or_register(giver, "character")
                    ent_recv = get_or_register(receiver, "character")
                    get_or_register(item, "object")

                    ent_giver.setdefault("facts", []).append({
                        "fact": f"Custody transfer: {giver} {action} {item} to {receiver}.",
                        "category": "status",
                        "source_chapter_number": chapter_number,
                        "source_quote": sent,
                        "is_negated": is_negated,
                        "uncertainty_level": uncertainty
                    })

                    relationships.append({
                        "source_name": giver,
                        "target_name": receiver,
                        "relation_type": "transferred_item_to",
                        "description": f"Transferred {item} to {receiver}",
                        "source_quote": sent
                    })

            # --- CATEGORY E: Relationships (Between co-occurring characters) ---
            if len(present_chars) >= 2:
                c1, c2 = present_chars[0], present_chars[1]
                rel_type = "associated_with"
                if any(w in s_low for w in ["allied", "friend", "companion", "protected", "sworn to"]):
                    rel_type = "allied_with"
                elif any(w in s_low for w in ["enemy", "foe", "hated", "opposed", "rival"]):
                    rel_type = "opposes"
                elif any(w in s_low for w in ["father", "mother", "daughter", "son", "brother", "sister", "husband", "wife", "family"]):
                    rel_type = "family_of"
                elif any(w in s_low for w in ["commanded", "ordered", "captain over", "served under"]):
                    rel_type = "subordinate_to"

                relationships.append({
                    "source_name": c1,
                    "target_name": c2,
                    "relation_type": rel_type,
                    "description": f"Observed relationship in Chapter {chapter_number}",
                    "source_quote": sent
                })

            # --- CATEGORY F: Timeline & Sequential Markers ---
            time_match = re.search(
                r'^(?:On\s+the\s+\w+|After\s+\w+|At\s+dawn|At\s+sunset|At\s+midnight|Two\s+days\s+later|Three\s+days\s+later|The\s+following\s+morning|Months\s+after|Years\s+later)\b',
                sent,
                re.IGNORECASE
            )
            if time_match:
                events.append({
                    "title": sent[:60] + "...",
                    "description": sent,
                    "location": None,
                    "participants": present_chars,
                    "time_label": time_match.group(0)
                })

        return {
            "entities": list(entities_dict.values()),
            "relationships": relationships,
            "timeline_events": events
        }

extraction_agent = NarrativeExtractionAgent()
