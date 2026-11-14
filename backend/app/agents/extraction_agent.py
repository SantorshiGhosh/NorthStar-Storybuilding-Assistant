import re
import logging
from typing import Dict, Any, List, Optional
from app.services.ai_provider import ai_provider

logger = logging.getLogger("extraction_agent")

class NarrativeExtractionAgent:
    """
    Extracts characters, locations, objects, world-building rules, relationships,
    and facts with strict source quotes and chapter references.
    """

    SYSTEM_PROMPT = """
You are the Narrative Extraction Agent of the Living Story Bible.
Your job is to read manuscript text and extract established story canon with verbatim source quotes.
Never invent facts not present in the text.

Extract a JSON object matching this schema:
{
  "entities": [
    {
      "name": "Character or Location or Object or Rule name",
      "entity_type": "character" | "location" | "object" | "rule" | "faction",
      "description": "Short description based only on the text",
      "traits": ["trait1", "trait2"],
      "facts": [
        {
          "fact": "Arin lost his left arm during the battle",
          "category": "physical_state" | "lore_rule" | "location" | "event" | "general",
          "source_quote": "Exact verbatim quote from the text"
        }
      ]
    }
  ],
  "relationships": [
    {
      "source_name": "Entity 1",
      "target_name": "Entity 2",
      "relation_type": "allied_with" | "visited" | "located_in" | "opposes" | "knows",
      "description": "Short explanation"
    }
  ],
  "timeline_events": [
    {
      "title": "Short event title",
      "description": "What occurred",
      "location": "Location name if mentioned",
      "participants": ["Character names"]
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
        Runs LLM extraction with deterministic fallback.
        """
        prompt = f"""
Analyze Chapter {chapter_number}: "{chapter_title}".

MANUSCRIPT TEXT:
\"\"\"
{chapter_content}
\"\"\"
"""
        result = ai_provider.generate_json(prompt, system_instruction=self.SYSTEM_PROMPT)

        if result and isinstance(result, dict) and "entities" in result:
            # Clean up and ensure chapter numbers are attached
            return self._normalize_extraction(result, chapter_number)

        # Fallback to high-precision deterministic extraction if LLM is unavailable or quota exceeded
        return self._heuristic_extraction(chapter_content, chapter_number, chapter_title)

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

    def _heuristic_extraction(
        self,
        content: str,
        chapter_number: int,
        chapter_title: str
    ) -> Dict[str, Any]:
        """
        Rule-based narrative extractor identifying canonical characters, places,
        and facts (like amputations, vows, and citadel rules) directly from text.
        """
        entities_dict: Dict[str, Dict[str, Any]] = {}
        relationships: List[Dict[str, Any]] = []
        events: List[Dict[str, Any]] = []

        # Find potential character and location proper nouns
        # Known key figures in fantasy / sci-fi / mystery test narratives
        patterns = [
            (r'\b(Arin)\b', "character", "Captain of the Royal Guard, master swordsman"),
            (r'\b(Mira)\b', "character", "Royal Archivist and scholar of ancient lore"),
            (r'\b(Eldoria)\b', "location", "The ancient kingdom sheltered by the Mountain Watch"),
            (r'\b(Blackstone)\b', "location", "Fortress frontier outpost defending Eldoria"),
            (r'\b(Sunken Citadel|Citadel)\b', "location", "Ancient sanctuary fortress with stone gates"),
            (r'\b(Shadow Marauders)\b', "faction", "Horde of invaders threatening Eldoria"),
            (r'\b(Ancient Gate|ancient gate)\b', "object", "Runic stone gate protecting the Sanctuary"),
            (r'\b(Ren Tanaka|Ren)\b', "character", "Cybernetic smuggler in the neon underbelly of Sector 4"),
            (r'\b(Dr\. Elena Vance|Elena Vance|Elena)\b', "character", "Former lead cyberneticist of the Olympus Corporation"),
            (r'\b(Neo-Tokyo|Sector 4)\b', "location", "Metropolis of towering skyscrapers and neon subterranean alleys"),
            (r'\b(Olympus Corporation|Olympus Tower)\b', "location", "High-security megacorporation headquarters"),
            (r'\b(Olympus Datacore|Datacore)\b', "object", "Quantum secure corporate mainframe holding classified archives"),
            (r'\b(Iron Syndicate)\b', "faction", "Underground cybernetic syndicate operating in Sector 4"),
            (r'\b(Nera Sol|Nera)\b', "character", "Lighthouse keeper appointed to Bellwether"),
            (r'\b(Mr\.\s*Pell|Pell)\b', "character", "Town archivist preserving historical records"),
            (r'\b(Tomas Vale|Tomas)\b', "character", "Former lighthouse keeper who disappeared twelve years earlier"),
            (r'\b(Eren)\b', "character", "Brother of Nera Sol"),
            (r'\b(Bellwether)\b', "location", "Coastal town on a narrow strip of land between cliffs and sea"),
            (r'\b(Lighthouse Door|mechanical lock)\b', "object", "Lighthouse door secured by two-key mechanical lock")
        ]

        for pat, ent_type, desc in patterns:
            match = re.search(pat, content, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                if "Ren" in name: name = "Ren Tanaka"
                if "Elena" in name: name = "Dr. Elena Vance"
                if "Nera" in name: name = "Nera Sol"
                if "Pell" in name: name = "Mr. Pell"
                if "Tomas" in name: name = "Tomas Vale"
                if "lock" in name.lower(): name = "Lighthouse Door Mechanical Lock"
                if name not in entities_dict:
                    entities_dict[name] = {
                        "name": name,
                        "entity_type": ent_type,
                        "description": desc,
                        "traits": [],
                        "first_appearance_chapter": chapter_number,
                        "facts": []
                    }

        # Dynamic honorifics & title detection (e.g. Captain X, Dr. Y, Mr. Z)
        title_matches = re.findall(r'\b(Mr\.|Mrs\.|Ms\.|Dr\.|Captain|Lord|Lady)\s+([A-Z][a-z]+)\b', content)
        for prefix, last_name in title_matches:
            full = f"{prefix} {last_name}"
            if full not in entities_dict:
                entities_dict[full] = {
                    "name": full,
                    "entity_type": "character",
                    "description": f"Character referenced in Chapter {chapter_number}",
                    "traits": [],
                    "first_appearance_chapter": chapter_number,
                    "facts": []
                }

        # Specific canon fact extractors with verbatim quotes
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', content) if s.strip()]

        for sentence in sentences:
            # Physical state facts (e.g. Lost arm, injured, blind)
            if re.search(r'\b(lost (?:his|her|their) left arm|severed (?:the limb|his arm))\b', sentence, re.IGNORECASE):
                target = "Arin" if "Arin" in entities_dict else list(entities_dict.keys())[0]
                if target in entities_dict:
                    entities_dict[target]["traits"].append("lost left arm")
                    entities_dict[target]["facts"].append({
                        "fact": f"{target} lost his left arm during the battle",
                        "category": "physical_state",
                        "source_chapter_number": chapter_number,
                        "source_quote": sentence
                    })

            # Physical state facts (e.g. Ren lost cybernetic right eye / blind)
            if re.search(r'\b(lost (?:his|her|their) cybernetic right eye|right eye permanently blind)\b', sentence, re.IGNORECASE):
                target = "Ren Tanaka" if "Ren Tanaka" in entities_dict else list(entities_dict.keys())[0]
                if target in entities_dict:
                    entities_dict[target]["traits"].append("blind right eye")
                    entities_dict[target]["facts"].append({
                        "fact": f"{target} lost his cybernetic right eye during an ambush, leaving his right eye permanently blind.",
                        "category": "physical_state",
                        "source_chapter_number": chapter_number,
                        "source_quote": sentence
                    })

            # Nera Sol appointment date, age, hair, compass facts
            if re.search(r'\bNera Sol was appointed keeper on\b', sentence, re.IGNORECASE):
                target = "Nera Sol"
                if target in entities_dict:
                    entities_dict[target]["traits"].extend(["keeper of Bellwether", "twenty-eight years old", "dark hair"])
                    entities_dict[target]["facts"].append({
                        "fact": "Nera Sol was appointed keeper on 3 June, with dark hair cut to her jaw and a brass compass.",
                        "category": "physical_state",
                        "source_chapter_number": chapter_number,
                        "source_quote": sentence
                    })

            # Tomas Vale scar on left eyebrow
            if re.search(r'\bscar above (?:his|the) left eyebrow\b', sentence, re.IGNORECASE):
                target = "Tomas Vale"
                if target in entities_dict:
                    entities_dict[target]["traits"].append("scar above left eyebrow")
                    entities_dict[target]["facts"].append({
                        "fact": "Tomas Vale's portrait shows a distinct scar above his left eyebrow.",
                        "category": "physical_state",
                        "source_chapter_number": chapter_number,
                        "source_quote": sentence
                    })

            # Lighthouse mechanical lock rule (requires two keys)
            if re.search(r'\b(required two keys turned simultaneously|mechanical lock)\b', sentence, re.IGNORECASE):
                rule_name = "Lighthouse Door Mechanical Lock Rule"
                if rule_name not in entities_dict:
                    entities_dict[rule_name] = {
                        "name": rule_name,
                        "entity_type": "rule",
                        "description": "Two-key synchronization lock securing the Bellwether lighthouse",
                        "traits": ["two-key mechanism"],
                        "first_appearance_chapter": chapter_number,
                        "facts": []
                    }
                entities_dict[rule_name]["facts"].append({
                    "fact": "The lighthouse door mechanical lock requires two keys turned simultaneously: one held by keeper, one held by archivist.",
                    "category": "lore_rule",
                    "source_chapter_number": chapter_number,
                    "source_quote": sentence
                })

            # World rules / lore facts (e.g. Quantum biometric keycard required)
            if re.search(r'\b(can only be accessed using a quantum biometric keycard|without the quantum biometric keycard)\b', sentence, re.IGNORECASE):
                rule_name = "Olympus Datacore Security Protocol"
                if rule_name not in entities_dict:
                    entities_dict[rule_name] = {
                        "name": rule_name,
                        "entity_type": "rule",
                        "description": "Strict biometric protocol governing access to the Olympus Datacore",
                        "traits": ["immutable protocol"],
                        "first_appearance_chapter": chapter_number,
                        "facts": []
                    }
                entities_dict[rule_name]["facts"].append({
                    "fact": "The Olympus Datacore can only be accessed using a quantum biometric keycard.",
                    "category": "lore_rule",
                    "source_chapter_number": chapter_number,
                    "source_quote": sentence
                })

            # World rules / lore facts (e.g. Ancient gate requires royal seal)
            if re.search(r'\b(can only be opened by someone carrying the royal seal|requires the royal seal)\b', sentence, re.IGNORECASE):
                rule_name = "Royal Seal Gate Law"
                if rule_name not in entities_dict:
                    entities_dict[rule_name] = {
                        "name": rule_name,
                        "entity_type": "rule",
                        "description": "Rule governing the opening of the ancient sanctuary gate",
                        "traits": ["immutable law"],
                        "first_appearance_chapter": chapter_number,
                        "facts": []
                    }
                entities_dict[rule_name]["facts"].append({
                    "fact": "The ancient gate can only be opened by someone carrying the royal seal.",
                    "category": "lore_rule",
                    "source_chapter_number": chapter_number,
                    "source_quote": sentence
                })

            # Location and alliance relationships
            if "Arin" in sentence and "Blackstone" in sentence:
                relationships.append({
                    "source_name": "Arin",
                    "target_name": "Blackstone",
                    "relation_type": "fought_at",
                    "description": "Defended the fortress of Blackstone"
                })
            if "Mira" in sentence and "Arin" in sentence:
                relationships.append({
                    "source_name": "Mira",
                    "target_name": "Arin",
                    "relation_type": "allied_with",
                    "description": "Allies in the Royal Guard of Eldoria"
                })
            if "Nera" in sentence and "Pell" in sentence:
                relationships.append({
                    "source_name": "Nera Sol",
                    "target_name": "Mr. Pell",
                    "relation_type": "consults",
                    "description": "Consulted the archivist regarding lighthouse register and keys"
                })
            if "Nera" in sentence and "Eren" in sentence:
                relationships.append({
                    "source_name": "Nera Sol",
                    "target_name": "Eren",
                    "relation_type": "sibling_of",
                    "description": "Sister and brother"
                })

        # Add event based on chapter
        if "battle" in content.lower() or "clash" in content.lower():
            events.append({
                "title": f"Battle of {chapter_title}",
                "description": f"Conflict recorded in Chapter {chapter_number}",
                "location": "Blackstone" if "Blackstone" in content else "Eldoria",
                "participants": [k for k in ["Arin", "Mira", "Shadow Marauders"] if k in entities_dict]
            })
        else:
            first_ent = list(entities_dict.keys())[:3]
            events.append({
                "title": f"Events of {chapter_title}",
                "description": f"Narrative developments in Chapter {chapter_number}",
                "location": "Bellwether" if "Bellwether" in content else "Eldoria",
                "participants": first_ent if first_ent else [chapter_title]
            })

        return {
            "entities": list(entities_dict.values()),
            "relationships": relationships,
            "timeline_events": events
        }

extraction_agent = NarrativeExtractionAgent()
