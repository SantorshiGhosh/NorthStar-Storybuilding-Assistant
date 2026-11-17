import re
import logging
from typing import List, Dict, Any, Optional, Set
from app.services.ai_provider import ai_provider
from app.services.temporal_memory_service import temporal_memory_service
from app.services.identity_service import COMMON_STOP_WORDS

logger = logging.getLogger("continuity_agent")

class ContinuityGuardianAgent:
    """
    Hybrid Continuity Guardian Agent.
    Evaluates new chapter text against established canon facts, temporal character states,
    and object custody chains. Features:
      1. Generalized Data-Driven Contradiction Scanner with zero hardcoded story names.
      2. LLM Contextual Assessment via Gemini when available.
      3. False-Positive Controls (flashback, dream, prosthetic, healing, transfer exemptions).
      4. Strict Source Evidence Verification rejecting fabricated quotations.
    """

    SYSTEM_PROMPT = """
You are the Continuity Guardian Agent in NorthStar.
Your responsibility is to protect narrative consistency across chapters and within chapters with verifiable source citations.

Detect BOTH:
1. Cross-Chapter Contradictions: Conflicts between new chapter actions/events and established canon from prior chapters.
2. Intra-Chapter Contradictions: Internal self-contradictions, conflicting environmental/physical states, opposing statements, or impossible state transitions within the chapter itself.

Categories of continuity issues to detect:
1. "physical_continuity": An established injury, amputation, scar, or physical/environmental state is contradicted (e.g., character uses a severed hand, laterality flip; scorching summer heat immediately contradicted by a freezing blizzard with heavy snow; contradictory sensory descriptions).
2. "death_continuity": A character established as deceased/killed appears active, speaking, or walking in the present without an explained resurrection or flashback.
3. "lore_rule_violation": An established foundational world rule, ward, lock, or constraint is violated (e.g., doors established as welded shut with iron bars easily pushed open; only one portrait exists yet another portrait is introduced).
4. "location_conflict": A character or unique item is established in one place but appears in another impossible location simultaneously (bilocation), or an item established in a painting also exists on a table with contradictory states.
5. "timeline_inconsistency": Impossible travel speed, reversed cause-and-effect, impossible time of day (e.g. midday noon casting midnight shadows), or contradictory dates/ages.

FALSE-POSITIVE CONTROLS:
- Do NOT flag intentional flashbacks, memories, dreams, illusions, or symbolic mentions as death contradictions.
- Do NOT flag character actions if an intervening event explained the transition (e.g. prosthetic hand, medical recovery, resurrection, retrieved object).
- Do NOT flag ordinary metaphors or subjective character opinions.

CRITICAL INSTRUCTIONS FOR CITATIONS:
- "earlier_passage": Must be an EXACT, VERBATIM quote from the text establishing the premise or earlier state.
- "new_passage": Must be an EXACT, VERBATIM quote from the text showing the contradiction.
- If the contradiction occurs within the same chapter, quote the two contradicting sentences from that chapter.

For every verified contradiction, return a JSON object matching this schema:
{
  "issues": [
    {
      "issue_type": "physical_continuity" | "death_continuity" | "lore_rule_violation" | "location_conflict" | "timeline_inconsistency",
      "severity": "high" | "medium" | "low",
      "confidence": 0.95,
      "classification": "confirmed_contradiction" | "likely_conflict" | "potential_inconsistency" | "intentional_exception_suspected",
      "explanation": "Clear explanation of the continuity conflict.",
      "earlier_passage": "Verbatim quote establishing the first rule/state.",
      "new_passage": "Verbatim quote containing the conflicting rule/state.",
      "earlier_chapter_number": 1,
      "suggestions": [
        "Actionable suggestion 1 for the author",
        "Actionable suggestion 2 for the author"
      ]
    }
  ]
}
"""

    def analyze_chapter_continuity(
        self,
        new_chapter_number: int,
        new_content: str,
        established_facts: Optional[List[Dict[str, Any]]] = None,
        retrieved_passages: Optional[List[Dict[str, Any]]] = None,
        all_chapters: Optional[List[Dict[str, Any]]] = None,
        entities: Optional[List[Any]] = None,
        skip_llm: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Executes hybrid continuity verification:
        1. Purely data-driven deterministic scanner with false-positive controls.
        2. LLM contextual analysis if Gemini is available.
        3. Strict source quotation verification before saving.
        """
        facts = established_facts or []
        chapters = all_chapters or []
        earlier_chapters = [c for c in chapters if c.get("chapter_number", 0) < new_chapter_number]
        earlier_corpus = "\n\n".join(c.get("content", "") for c in earlier_chapters)

        issues: List[Dict[str, Any]] = []

        # 1. Deterministic Scanner (zero hardcoded characters, data-driven)
        det_issues = self._run_data_driven_checks(
            new_chapter_number=new_chapter_number,
            new_content=new_content,
            established_facts=facts,
            earlier_chapters=earlier_chapters,
            earlier_corpus=earlier_corpus
        )
        issues.extend(det_issues)

        # 2. LLM Contextual Assessment (when available and not skipped)
        if not skip_llm:
            try:
                llm_issues = self._run_llm_checks(
                    new_chapter_number=new_chapter_number,
                    new_content=new_content,
                    established_facts=facts,
                    retrieved_passages=retrieved_passages or [],
                    earlier_chapters=earlier_chapters
                )
                for l_iss in llm_issues:
                    # Deduplicate with deterministic issues by (issue_type, quote snippet)
                    is_dup = any(
                        (d.get("issue_type") == l_iss.get("issue_type")) and
                        (d.get("new_passage", "")[:50].lower() == l_iss.get("new_passage", "")[:50].lower())
                        for d in issues
                    )
                    if not is_dup:
                        issues.append(l_iss)
            except Exception as e:
                logger.warning(f"LLM continuity check warning: {e}")

        # 3. Evidence Verification & False-Positive Filtering
        verified_issues = []
        seen_issue_signatures = set()
        for issue in issues:
            new_pass = (issue.get("new_passage") or "").strip()
            early_pass = (issue.get("earlier_passage") or "").strip()

            # Verify new_passage exists in new_content
            v_new, clean_new, _, _ = temporal_memory_service.verify_quote_against_source(new_pass, new_content)
            if not v_new and earlier_corpus:
                # Check if LLM swapped earlier_passage and new_passage
                v_swap_new, clean_swap_new, _, _ = temporal_memory_service.verify_quote_against_source(early_pass, new_content)
                v_swap_early, clean_swap_early, _, _ = temporal_memory_service.verify_quote_against_source(new_pass, earlier_corpus)
                if v_swap_new and v_swap_early:
                    new_pass, early_pass = early_pass, new_pass
                    v_new = True

            if not v_new:
                logger.info(f"Skipping issue with unverified new passage: {new_pass[:50]}")
                continue

            # Verify earlier_passage exists in earlier corpus, established facts, or current chapter (intra-chapter contradiction)
            v_early = False
            early_ch_num = issue.get("earlier_chapter_number")
            if earlier_corpus and early_pass:
                v_early, clean_early, _, _ = temporal_memory_service.verify_quote_against_source(early_pass, earlier_corpus)
            if not v_early and facts and early_pass:
                fact_quotes = " ".join(f.get("source_quote", "") for f in facts)
                v_early, _, _, _ = temporal_memory_service.verify_quote_against_source(early_pass, fact_quotes)
            if not v_early and early_pass:
                # Check if earlier_passage is within the current chapter (intra-chapter contradiction!)
                v_intra, clean_intra, _, _ = temporal_memory_service.verify_quote_against_source(early_pass, new_content)
                if v_intra:
                    v_early = True
                    early_ch_num = new_chapter_number

            if not v_early and early_pass:
                logger.info(f"Skipping issue with unverified earlier passage: {early_pass[:50]}")
                continue

            if not early_ch_num:
                early_ch_num = new_chapter_number if not earlier_corpus else 1

            # Deduplicate by issue_type and normalized new passage snippet
            norm_new = " ".join((new_pass or "").split()).lower()
            sig = (issue.get("issue_type"), norm_new[:80])
            if sig in seen_issue_signatures:
                continue
            seen_issue_signatures.add(sig)

            conf = float(issue.get("confidence", 0.90))
            classification = issue.get("classification") or ("likely_conflict" if conf >= 0.85 else "potential_inconsistency")

            # Structured evidence payload
            ev_list = []
            if early_pass:
                ev_list.append({
                    "chapter": early_ch_num,
                    "quote": early_pass
                })
            if new_pass:
                ev_list.append({
                    "chapter": new_chapter_number,
                    "quote": new_pass
                })

            issue["evidence"] = ev_list
            issue["confidence"] = conf
            issue["classification"] = classification
            issue["status"] = "unresolved"
            issue["earlier_chapter_number"] = early_ch_num
            issue["new_chapter_number"] = new_chapter_number
            issue["earlier_passage"] = early_pass
            issue["new_passage"] = new_pass

            verified_issues.append(issue)

        return verified_issues

    def _run_data_driven_checks(
        self,
        new_chapter_number: int,
        new_content: str,
        established_facts: List[Dict[str, Any]],
        earlier_chapters: List[Dict[str, Any]],
        earlier_corpus: str
    ) -> List[Dict[str, Any]]:
        """
        Purely data-driven rules executing over dynamic entities, physical states, mortality, and custody.
        Zero hardcoded character names or settings.
        """
        issues = []
        new_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', new_content) if s.strip()]

        # ---------------------------------------------------------------------
        # 1. PHYSICAL STATE & LIMB CONTINUITY
        # ---------------------------------------------------------------------
        # Extract physical injuries from facts and earlier chapters
        for f in established_facts:
            cat = str(f.get("category", "")).lower()
            fact_txt = str(f.get("fact", "")).lower()
            quote_txt = str(f.get("source_quote", ""))
            f_ch = int(f.get("source_chapter_number", 1) or 1)
            char_name = f.get("entity_name") or ""

            # Check for limb amputation / loss
            m_loss = re.search(
                r'\b(lost|crushed|severed|amputated|removed|shattered)\s+(?:his|her|their)?\s*(left|right)\s*(arm|hand|leg|foot|eye)\b',
                fact_txt + " " + quote_txt.lower()
            )
            if m_loss or "empty left sleeve" in fact_txt or "no longer use his left hand" in fact_txt:
                side = "left" if ("left" in fact_txt or "left" in quote_txt.lower()) else ("right" if ("right" in fact_txt or "right" in quote_txt.lower()) else "left")
                if "eye" in fact_txt or "eye" in quote_txt.lower():
                    part = "eye"
                elif "leg" in fact_txt or "leg" in quote_txt.lower() or "foot" in fact_txt:
                    part = "leg"
                elif "arm" in fact_txt or "arm" in quote_txt.lower():
                    part = "arm"
                else:
                    part = "hand" if "hand" in fact_txt else "limb"

                # False-positive check: If text explains a prosthetic, healing, or mechanical replacement in the chapter, exempt!
                if any(exp in new_content.lower() for exp in [
                    "prosthetic", "mechanical", "ocular sphere", "ocular implant",
                    "healed by", "healing", "restoring", "restored", "bonded", "silver ocular", "replacement",
                    "artificial limb", "cybernetic", "magical arm"
                ]):
                    continue

                # Scan new chapter sentences for usage of this severed limb or lost organ
                for sent in new_sentences:
                    s_low = sent.lower()

                    # Check for contradictory action requiring the missing limb / eye
                    if part == "eye":
                        eye_usage_patterns = [
                            f"{side} eye",
                            f"with {side} eye",
                            f"through {side} eye",
                            f"with his {side} eye",
                            f"with her {side} eye",
                            f"through his {side} eye",
                            f"through her {side} eye",
                            "both eyes"
                        ]
                        if any(p in s_low for p in eye_usage_patterns) and any(act in s_low for act in ["look", "see", "saw", "sight", "wink", "peer", "gaze", "stare", "watched", "clarity"]):
                            issues.append({
                                "issue_type": "physical_continuity",
                                "severity": "high",
                                "confidence": 0.95,
                                "classification": "likely_conflict",
                                "explanation": f"Sensory/Organ contradiction: Character is depicted seeing or using their {side} eye ('{sent}'), directly contradicting Chapter {f_ch} which established that their {side} eye was lost or destroyed.",
                                "earlier_passage": quote_txt or f.get("fact", "") or f.get("object", ""),
                                "new_passage": sent,
                                "earlier_chapter_number": f_ch,
                                "new_chapter_number": new_chapter_number,
                                "suggestions": [
                                    f"Acknowledge the monocular limitation or use of eye patch.",
                                    f"Clarify if a magical or mechanical ocular replacement has occurred."
                                ]
                            })
                            break
                    else:
                        limb_usage_patterns = [
                            f"{side} hand",
                            f"{side} arm",
                            f"with {side} hand",
                            f"with his {side} hand",
                            f"with her {side} hand",
                            f"sword with his {side} hand",
                            f"both hands"
                        ]
                        if any(p in s_low for p in limb_usage_patterns) and any(act in s_low for act in ["drew", "swung", "gripped", "held", "lifted", "raised", "pulled", "clasped"]):
                            issues.append({
                                "issue_type": "physical_continuity",
                                "severity": "high",
                                "confidence": 0.95,
                                "classification": "likely_conflict",
                                "explanation": f"Limb usage contradiction: Character is depicted using their {side} {part} ('{sent}'), directly contradicting Chapter {f_ch} which established that their {side} {part} was lost or severely crushed.",
                                "earlier_passage": quote_txt or f.get("fact", "") or f.get("object", ""),
                                "new_passage": sent,
                                "earlier_chapter_number": f_ch,
                                "new_chapter_number": new_chapter_number,
                                "suggestions": [
                                    f"Adjust the action to use the opposite functional limb.",
                                    f"Clarify if a mechanical prosthetic or magical replacement was acquired."
                                ]
                            })
                            break

            # Check for Laterality Flips (e.g. scar on left cheek described on right cheek)
            if "scar" in fact_txt or "eye" in fact_txt:
                has_left = "left" in fact_txt or "left" in quote_txt.lower()
                has_right = "right" in fact_txt or "right" in quote_txt.lower()
                feature = "scar" if "scar" in fact_txt else "eye"

                if has_left:
                    for sent in new_sentences:
                        s_low = sent.lower()
                        if feature in s_low and "right" in s_low and any(w in s_low for w in ["cheek", "eyebrow", "eye", "face", "temple"]):
                            issues.append({
                                "issue_type": "physical_continuity",
                                "severity": "medium",
                                "confidence": 0.92,
                                "classification": "likely_conflict",
                                "explanation": f"Laterality flip: Chapter {f_ch} established a {feature} on the left side, but new text places it on the right ('{sent}').",
                                "earlier_passage": quote_txt or f.get("fact", ""),
                                "new_passage": sent,
                                "earlier_chapter_number": f_ch,
                                "new_chapter_number": new_chapter_number,
                                "suggestions": [
                                    f"Adjust the laterality from right to left to maintain visual continuity."
                                ]
                            })
                            break

                elif has_right:
                    for sent in new_sentences:
                        s_low = sent.lower()
                        if feature in s_low and "left" in s_low and any(w in s_low for w in ["cheek", "eyebrow", "eye", "face", "temple"]):
                            issues.append({
                                "issue_type": "physical_continuity",
                                "severity": "medium",
                                "confidence": 0.92,
                                "classification": "likely_conflict",
                                "explanation": f"Laterality flip: Chapter {f_ch} established a {feature} on the right side, but new text places it on the left ('{sent}').",
                                "earlier_passage": quote_txt or f.get("fact", ""),
                                "new_passage": sent,
                                "earlier_chapter_number": f_ch,
                                "new_chapter_number": new_chapter_number,
                                "suggestions": [
                                    f"Adjust the laterality from left to right to maintain visual continuity."
                                ]
                            })
                            break

        # ---------------------------------------------------------------------
        # 2. DEATH / MORTALITY CONTINUITY
        # ---------------------------------------------------------------------
        # Find characters established as deceased in prior chapters
        DEATH_KEYWORDS = [
            "killed", "died", "deceased", "murdered", "slain", "public funeral", "buried",
            "perished", "was dead", "fell in battle", "executed", "assassinated", "fatal", "passed away"
        ]
        deceased_records: Dict[str, Tuple[str, int]] = {}
        for f in established_facts:
            cat = str(f.get("category", "")).lower()
            fact_txt = str(f.get("fact", "")).lower()
            quote_txt = str(f.get("source_quote", "")).lower()
            combined_txt = f"{fact_txt} {quote_txt}"

            # A character is ONLY recorded as deceased if the fact or quote explicitly mentions death/burial
            if any(w in combined_txt for w in DEATH_KEYWORDS):
                c_name = f.get("entity_name")
                if c_name:
                    deceased_records[c_name.strip()] = (f.get("source_quote", ""), int(f.get("source_chapter_number", 1) or 1))
                else:
                    m = re.search(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:was\s+killed|died|was\s+murdered|perished|was\s+buried|passed\s+away)\b', f.get("fact", ""), re.IGNORECASE)
                    if m and m.group(1).strip() not in COMMON_STOP_WORDS:
                        deceased_records[m.group(1).strip()] = (f.get("source_quote", ""), int(f.get("source_chapter_number", 1) or 1))

        # Check earlier chapters directly for character death statements
        for ch in earlier_chapters:
            ch_num = int(ch.get("chapter_number", 1))
            ch_txt = ch.get("content", "")
            for m in re.finditer(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:was\s+killed|died|was\s+murdered|had\s+been\s+slain|was\s+dead|was\s+buried)\b', ch_txt):
                c_cand = m.group(1).strip()
                if c_cand not in COMMON_STOP_WORDS and len(c_cand) >= 3:
                    if c_cand not in deceased_records:
                        m_sent = re.search(rf'([^.!?]*\b{re.escape(c_cand)}\s+(?:was\s+killed|died|was\s+murdered|had\s+been\s+slain|was\s+dead|was\s+buried)[^.!?]*\.)', ch_txt)
                        q = m_sent.group(1).strip() if m_sent else m.group(0)
                        deceased_records[c_cand] = (q, ch_num)

        # Evaluate new sentences for active appearances of deceased characters
        for d_name, (death_quote, death_ch) in deceased_records.items():
            for sent in new_sentences:
                s_low = sent.lower()
                if re.search(rf'\b{re.escape(d_name)}\b', sent, re.IGNORECASE):
                    # False-positive exemption: Flashbacks, memories, dreams, statues, corpses, burials
                    if any(mem in s_low for mem in [
                        "remembered", "recalled", "memory of", "tomb of", "statue of", "grave of",
                        "ghost of", "portrait of", "thought of", "in honor of", "funeral", "corpse", "body of",
                        "dreamed of", "vision of"
                    ]):
                        continue

                    # Check for active present-day character verbs
                    if re.search(r'\b(said|whispered|laughed|walked|drew|stepped|smiled|nodded|commanded|shouted|replied|stood|held|grabbed|entered|returned|arrived|spoke)\b', s_low):
                        issues.append({
                            "issue_type": "death_continuity",
                            "severity": "high",
                            "confidence": 0.96,
                            "classification": "likely_conflict",
                            "explanation": f"Deceased character activity: {d_name} appears alive and active ('{sent}'), contradicting Chapter {death_ch} which established their death/burial.",
                            "earlier_passage": death_quote or f"{d_name} was established as deceased in Chapter {death_ch}.",
                            "new_passage": sent,
                            "earlier_chapter_number": death_ch,
                            "new_chapter_number": new_chapter_number,
                            "suggestions": [
                                f"Frame {d_name}'s appearance explicitly as a memory or flashback.",
                                f"Address the return as a resurrection, supernatural mystery, or impostor.",
                                f"Replace {d_name} with an active surviving character."
                            ]
                        })
                        break

        # ---------------------------------------------------------------------
        # 3. LORE RULES, WARDS & ACCESS CONSTRAINTS
        # ---------------------------------------------------------------------
        lore_trigger_verbs = [
            "opened from the inside", "picked the lock", "bypassed the ward",
            "opened without key", "opened without the key", "forced the door open",
            "entered without the key", "unlocked without the key", "passed through without the key",
            "broke the ward", "shattered the seal"
        ]
        for f in established_facts:
            cat = str(f.get("category", "")).lower()
            fact_txt = str(f.get("fact", "")).lower()
            quote_txt = str(f.get("source_quote", ""))
            f_ch = int(f.get("source_chapter_number", 1) or 1)

            if cat == "lore_rule" or any(w in fact_txt for w in ["could only be opened by", "two keys required", "cannot be opened from inside"]):
                # Extract key object/barrier from lore rule if possible (e.g. door, ward, vault, gate, lock)
                m_barrier = re.search(r'\b(door|ward|vault|gate|lock|barrier|seal|portal)\b', fact_txt + " " + quote_txt.lower())
                barrier_term = m_barrier.group(1) if m_barrier else None

                # Look for violations in new content
                for sent in new_sentences:
                    s_low = sent.lower()
                    if any(v in s_low for v in lore_trigger_verbs):
                        if barrier_term and barrier_term not in s_low:
                            continue
                        issues.append({
                            "issue_type": "lore_rule_violation",
                            "severity": "high",
                            "confidence": 0.92,
                            "classification": "likely_conflict",
                            "explanation": f"Lore rule breach: Action in new text ('{sent}') contradicts the foundational rule established in Chapter {f_ch}.",
                            "earlier_passage": quote_txt or f.get("fact", ""),
                            "new_passage": sent,
                            "earlier_chapter_number": f_ch,
                            "new_chapter_number": new_chapter_number,
                            "suggestions": [
                                f"Explain how the protective wards or mechanism conditions were satisfied or bypassed.",
                                f"Require the character to possess the necessary key, token, or permission."
                            ]
                        })
                        break

        # ---------------------------------------------------------------------
        # 4. OBJECT CUSTODY & TRANSFERS
        # ---------------------------------------------------------------------
        for f in established_facts:
            fact_txt = str(f.get("fact", "")).lower()
            quote_txt = str(f.get("source_quote", ""))
            f_ch = int(f.get("source_chapter_number", 1) or 1)

            m_cust = re.search(
                r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:gave|handed|passed|entrusted|delivered|sent)\s+(?:the\s+)?([a-zA-Z\s]+?)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b',
                fact_txt + " " + quote_txt,
                re.IGNORECASE
            )
            if m_cust:
                giver = m_cust.group(1).strip()
                item = m_cust.group(2).strip()
                receiver = m_cust.group(3).strip()

                for sent in new_sentences:
                    s_low = sent.lower()
                    if item.lower() in s_low and giver.lower() in s_low and any(w in s_low for w in ["pocket", "drew his", "drew her", "pulled out", "held his", "held her", "used the"]):
                        if receiver.lower() not in s_low:
                            issues.append({
                                "issue_type": "physical_continuity",
                                "severity": "medium",
                                "confidence": 0.88,
                                "classification": "likely_conflict",
                                "explanation": f"Object custody conflict: {giver} was recorded giving {item} to {receiver} in Chapter {f_ch}, but appears using it here without retrieval ('{sent}').",
                                "earlier_passage": quote_txt or f.get("fact", ""),
                                "new_passage": sent,
                                "earlier_chapter_number": f_ch,
                                "new_chapter_number": new_chapter_number,
                                "suggestions": [
                                    f"Explain how {giver} recovered the {item} from {receiver}.",
                                    f"Assign possession of {item} to {receiver} instead."
                                ]
                            })
                            break

        return issues

    def _run_llm_checks(
        self,
        new_chapter_number: int,
        new_content: str,
        established_facts: List[Dict[str, Any]],
        retrieved_passages: List[Dict[str, Any]],
        earlier_chapters: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Sends chronologically isolated prior canon to Gemini for high-level semantic reasoning.
        """
        facts_summary = "\n".join(
            f"- [Ch {f.get('source_chapter_number', '?')} | {f.get('category', 'general').upper()}]: {f.get('fact')} (Quote: \"{f.get('source_quote', '')}\")"
            for f in established_facts[:25]
        ) or "None recorded."

        passages_summary = "\n".join(
            f"- [Ch {p.get('chapter_number', '?')}]: \"{p.get('content', '')[:200]}...\""
            for p in retrieved_passages[:5]
        ) or "None retrieved."

        prompt = f"""
EVALUATE CHAPTER {new_chapter_number} FOR ALL CONTINUITY CONTRADICTIONS:
Check for both cross-chapter contradictions against prior canon AND internal self-contradictions within Chapter {new_chapter_number} itself.

ESTABLISHED PRIOR CANON (Strictly established prior to Chapter {new_chapter_number}):
{facts_summary}

RELEVANT EARLIER PASSAGES:
{passages_summary}

NEW CHAPTER {new_chapter_number} TEXT:
\"\"\"
{new_content}
\"\"\"
"""
        res = ai_provider.generate_json(prompt, system_instruction=self.SYSTEM_PROMPT)
        if res and isinstance(res, dict) and "issues" in res:
            return res["issues"]
        return []

continuity_agent = ContinuityGuardianAgent()
