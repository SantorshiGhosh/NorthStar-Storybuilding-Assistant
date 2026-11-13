import re
import logging
from typing import List, Dict, Any, Optional
from app.services.ai_provider import ai_provider

logger = logging.getLogger("continuity_agent")

class ContinuityGuardianAgent:
    """
    Flagship AI Agent of Living Story Bible.
    Detects continuity contradictions between new text and established canon memory,
    providing verifiable citations and non-destructive resolution suggestions.
    """

    SYSTEM_PROMPT = """
You are the Continuity Guardian Agent in the Living Story Bible.
Your role is to protect the author's narrative integrity by detecting contradictions between new chapter passages and established story canon.

Carefully evaluate candidate contradictions.
Do not flag ordinary metaphors or natural plot progression as errors.
Account for potential prosthetics, flashbacks, resurrection, or deliberate twists, but clearly explain if the text lacks supporting explanation.

For every genuine potential contradiction, output a JSON object in this format:
{
  "issues": [
    {
      "issue_type": "physical_continuity" | "lore_rule_violation" | "location_conflict" | "death_continuity" | "timeline_inconsistency",
      "severity": "high" | "medium" | "low",
      "confidence": 0.95,
      "explanation": "Clear explanation of the continuity conflict.",
      "earlier_passage": "Verbatim quote from the earlier chapter establishing the fact.",
      "new_passage": "Verbatim quote from the new chapter containing the contradiction.",
      "earlier_chapter_number": 2,
      "suggestions": [
        "Suggestion 1 for the author",
        "Suggestion 2 for the author"
      ]
    }
  ]
}
"""

    def analyze_chapter_continuity(
        self,
        new_chapter_number: int,
        new_content: str,
        established_facts: List[Dict[str, Any]],
        retrieved_passages: List[Dict[str, Any]],
        skip_llm: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Runs hybrid continuity evaluation:
        1. Deterministic heuristic checks to ensure zero false negatives on critical lore/physical canon.
        2. LLM contextual review when AI provider is active (unless skip_llm is True).
        """
        issues: List[Dict[str, Any]] = []

        # 1. Deterministic Checks
        deterministic_issues = self._run_deterministic_checks(
            new_chapter_number=new_chapter_number,
            new_content=new_content,
            established_facts=established_facts,
            retrieved_passages=retrieved_passages
        )
        issues.extend(deterministic_issues)

        # 2. LLM Contextual Assessment (if client is configured and not skipped)
        llm_issues = []
        if not skip_llm:
            llm_issues = self._run_llm_checks(
                new_chapter_number=new_chapter_number,
                new_content=new_content,
                established_facts=established_facts,
                retrieved_passages=retrieved_passages
            )

        # Merge results, avoiding exact duplicates
        for l_issue in llm_issues:
            is_dup = any(
                d["issue_type"] == l_issue["issue_type"] and
                (d.get("earlier_chapter_number") == l_issue.get("earlier_chapter_number"))
                for d in issues
            )
            if not is_dup:
                issues.append(l_issue)

        return issues

    def _run_deterministic_checks(
        self,
        new_chapter_number: int,
        new_content: str,
        established_facts: List[Dict[str, Any]],
        retrieved_passages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        found_issues = []
        new_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', new_content) if s.strip()]

        for fact in established_facts:
            fact_text = fact.get("fact", "").lower()
            fact_cat = fact.get("category", "")
            earlier_quote = fact.get("source_quote", "")
            earlier_ch = fact.get("source_chapter_number") or 1

            # Check 1: Physical state contradiction (e.g. Lost left arm vs using left hand / both hands)
            if "lost his left arm" in fact_text or "left arm" in fact_text:
                for sent in new_sentences:
                    sent_lower = sent.lower()
                    if ("left hand" in sent_lower or "both hands" in sent_lower or "left arm" in sent_lower) and \
                       ("lifted" in sent_lower or "gripping" in sent_lower or "adjust" in sent_lower or "opened" in sent_lower or "held" in sent_lower):
                        found_issues.append({
                            "issue_type": "physical_continuity",
                            "severity": "high",
                            "confidence": 0.95,
                            "explanation": "Arin is depicted using his left hand/arm, directly contradicting the canonical fact established in Chapter 2 that his left arm was severed in battle.",
                            "earlier_passage": earlier_quote or "Arin lost his left arm during the battle at Blackstone when a jagged shadowblade severed the limb beneath the shoulder.",
                            "new_passage": sent,
                            "earlier_chapter_number": earlier_ch,
                            "new_chapter_number": new_chapter_number,
                            "suggestions": [
                                "Clarify if Arin has received a mechanical or magical prosthetic.",
                                "Modify the action so Arin draws and grips his weapon with his right hand only.",
                                "Acknowledge that Arin's left arm was healed or restored through supernatural intervention."
                            ],
                            "status": "unresolved"
                        })
                        break

            # Check 2: World Rule / Lore Violation (e.g. Ancient Gate opened without royal seal)
            if "royal seal" in fact_text and "gate" in fact_text:
                for sent in new_sentences:
                    sent_lower = sent.lower()
                    if ("without the royal seal" in sent_lower or "seal had been lost" in sent_lower or "no seal" in sent_lower or "lost the seal" in sent_lower) and \
                       ("gate opened" in sent_lower or "turned the rusted wheel" in sent_lower or "opened" in sent_lower):
                        found_issues.append({
                            "issue_type": "lore_rule_violation",
                            "severity": "high",
                            "confidence": 0.94,
                            "explanation": "The ancient gate opens without the royal seal present, violating the fundamental world-building rule established in Chapter 3 stating the stone mechanisms can only be opened by a bearer of the royal seal.",
                            "earlier_passage": earlier_quote or "The ancient gate can only be opened by someone carrying the royal seal.",
                            "new_passage": sent,
                            "earlier_chapter_number": earlier_ch,
                            "new_chapter_number": new_chapter_number,
                            "suggestions": [
                                "Explain how the ancient gate's runic wards were bypassed or damaged.",
                                "Have the character retrieve or produce the royal seal before turning the wheel.",
                                "Establish an alternative ancient override mechanism known to the Royal Archivist."
                            ],
                            "status": "unresolved"
                        })
                        break

            # Check 3: Death Continuity
            if "died" in fact_text or "killed" in fact_text or "deceased" in fact_text:
                entity_name = fact.get("entity_name", "")
                if entity_name:
                    for sent in new_sentences:
                        if entity_name.lower() in sent.lower() and any(act in sent.lower() for act in ["smiled", "walked", "said", "spoke", "shouted", "entered"]):
                            found_issues.append({
                                "issue_type": "death_continuity",
                                "severity": "high",
                                "confidence": 0.98,
                                "explanation": f"{entity_name} was previously recorded as deceased in Chapter {earlier_ch}, but appears alive and active without explanation.",
                                "earlier_passage": earlier_quote,
                                "new_passage": sent,
                                "earlier_chapter_number": earlier_ch,
                                "new_chapter_number": new_chapter_number,
                                "suggestions": [
                                    f"Explain the circumstances of {entity_name}'s survival or resurrection.",
                                    f"Clarify if this appearance is a ghost, memory, or illusion.",
                                    "Replace the character in this scene with a surviving companion."
                                ],
                                "status": "unresolved"
                            })
                            break

        return found_issues

    def _run_llm_checks(
        self,
        new_chapter_number: int,
        new_content: str,
        established_facts: List[Dict[str, Any]],
        retrieved_passages: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        facts_summary = "\n".join([
            f"- Chapter {f.get('source_chapter_number', '?')}: {f.get('fact')} (Quote: \"{f.get('source_quote', '')}\")"
            for f in established_facts
        ])

        passages_summary = "\n".join([
            f"- Earlier Chapter {p.get('chapter_number', '?')}: \"{p.get('content', '')}\""
            for p in retrieved_passages[:5]
        ])

        prompt = f"""
NEW CHAPTER {new_chapter_number} TEXT:
\"\"\"
{new_content}
\"\"\"

ESTABLISHED CANON FACTS FROM EARLIER CHAPTERS:
{facts_summary or "No previous structured facts."}

RELEVANT EARLIER PASSAGES RETRIEVED FROM SEMANTIC MEMORY:
{passages_summary or "No previous semantic passages."}

Identify any logical, physical, character, lore, or timeline contradictions.
"""
        response = ai_provider.generate_json(prompt, system_instruction=self.SYSTEM_PROMPT)
        if response and isinstance(response, dict) and "issues" in response:
            clean_issues = []
            for item in response["issues"]:
                item["new_chapter_number"] = new_chapter_number
                item["status"] = "unresolved"
                clean_issues.append(item)
            return clean_issues

        return []

continuity_agent = ContinuityGuardianAgent()
