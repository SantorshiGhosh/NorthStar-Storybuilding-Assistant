"""
Narrative Evaluation Service
Provides an automated evaluation benchmark suite for Narrative Intelligence accuracy:
- Relevance Filtering (rejection of incidental nouns, acceptance of plot-critical items)
- Coreference Resolution (gender agreement, syntactic binding, discourse recency)
- Ambiguity Detection (refusal to blindly guess same-gender antecedents)
- Alias & Canonical Identity Integrity (preventing split duplicates and false merges)
- Graph Admission Purity (filtering spurious co-occurrences)
"""
from typing import Dict, Any, List
from dataclasses import dataclass, field

from app.production_v2.services.narrative_relevance_service import narrative_relevance_service
from app.production_v2.services.coreference_resolution_service import (
    coreference_resolution_service, EntityProfile
)
from app.production_v2.services.narrative_mention_classifier import narrative_mention_classifier
from app.production_v2.services.graph_admission_service import graph_admission_service


@dataclass
class BenchmarkResult:
    test_id: str
    category: str
    description: str
    passed: bool
    details: Dict[str, Any] = field(default_factory=dict)


class NarrativeEvaluationService:
    """
    Automated evaluation harness for narrative intelligence accuracy and graph integrity.
    """

    def __init__(self):
        pass

    def run_all_benchmarks(self) -> Dict[str, Any]:
        """
        Runs comprehensive test suite covering all required accuracy test cases.
        Returns detailed summary with quantitative accuracy metrics.
        """
        results: List[BenchmarkResult] = []

        # -------------------------------------------------------------
        # Category A: Incidental Noun Rejection (Problem A)
        # -------------------------------------------------------------
        incidental_cases = [
            ("chair", "object", "He sat on a wooden chair.", False),
            ("cup", "object", "She drank a warm cup of tea.", False),
            ("table", "object", "The documents lay on the table.", False),
            ("door", "object", "He closed the door behind him.", False),
            ("window", "object", "Rain tapped against the window.", False),
            ("bread", "object", "He ate a crust of stale bread.", False),
            ("hallway", "location", "They walked down the quiet hallway.", False),
        ]
        for name, ent_type, ctx, should_accept in incidental_cases:
            ev = narrative_relevance_service.evaluate_entity(
                name=name,
                entity_type=ent_type,
                context_sentences=[ctx]
            )
            passed = (ev.relevance_status == "rejected" and ev.salience_score < 0.40)
            results.append(BenchmarkResult(
                test_id=f"INCIDENTAL_REJECTION_{name.upper()}",
                category="Incidental Rejection",
                description=f"Reject incidental noun '{name}' from becoming a permanent graph node.",
                passed=passed,
                details={"name": name, "score": ev.salience_score, "status": ev.relevance_status}
            ))

        # -------------------------------------------------------------
        # Category B: Plot-Critical Artifact Acceptance (Problem A)
        # -------------------------------------------------------------
        critical_cases = [
            (
                "The Silver Key",
                "object",
                "The Silver Key was the only artifact that could unlock the vault of Valoria.",
                True,
                True  # custody
            ),
            (
                "The Poisoned Chalice",
                "object",
                "The king drank from the poisoned chalice and collapsed, dead within seconds.",
                True,
                False
            ),
            (
                "Excalibur",
                "object",
                "He wielded Excalibur, the ancient blade forged by the Lady of the Lake.",
                True,
                False
            ),
            (
                "The Chronos Talisman",
                "object",
                "She smuggled the Chronos Talisman across enemy lines to reverse time.",
                True,
                True
            )
        ]
        for name, ent_type, ctx, should_accept, has_custody in critical_cases:
            ev = narrative_relevance_service.evaluate_entity(
                name=name,
                entity_type=ent_type,
                context_sentences=[ctx],
                involves_custody=has_custody
            )
            passed = (ev.relevance_status == "accepted" and ev.salience_score >= 0.65)
            results.append(BenchmarkResult(
                test_id=f"CRITICAL_OBJECT_{name.replace(' ', '_').upper()}",
                category="Critical Object Acceptance",
                description=f"Accept plot-critical object '{name}' into permanent graph.",
                passed=passed,
                details={"name": name, "score": ev.salience_score, "status": ev.relevance_status}
            ))

        # -------------------------------------------------------------
        # Category C: Character & Location High Salience (Problem A)
        # -------------------------------------------------------------
        named_entities = [
            ("Arin Vance", "character", "Arin Vance inspected the crime scene."),
            ("Mira", "character", "Mira drew her bow."),
            ("Valoria", "location", "The city of Valoria stood atop the silver cliffs."),
            ("The Iron Syndicate", "faction", "The Iron Syndicate controlled the eastern ports.")
        ]
        for name, ent_type, ctx in named_entities:
            ev = narrative_relevance_service.evaluate_entity(
                name=name,
                entity_type=ent_type,
                context_sentences=[ctx]
            )
            passed = (ev.relevance_status == "accepted" and ev.salience_score >= 0.70)
            results.append(BenchmarkResult(
                test_id=f"NAMED_ENTITY_{name.replace(' ', '_').upper()}",
                category="Named Entity Acceptance",
                description=f"Ensure major named entity '{name}' receives high salience.",
                passed=passed,
                details={"name": name, "score": ev.salience_score, "status": ev.relevance_status}
            ))

        # -------------------------------------------------------------
        # Category D: Coreference Resolution — Gender & Number (Problem B)
        # -------------------------------------------------------------
        # Case 1: Single character pronouns
        arin_prof = EntityProfile(id="e-arin", name="Arin Vance", entity_type="character", gender="male", titles=["inspector"], traits=["detective"])
        mira_prof = EntityProfile(id="e-mira", name="Mira", entity_type="character", gender="female", titles=[], traits=["archer", "woman"])
        key_prof = EntityProfile(id="e-key", name="The Silver Key", entity_type="object", gender="inanimate", traits=["key", "artifact"])

        passage_1 = "Arin drew his sword. He stepped forward into the darkness."
        res_1 = coreference_resolution_service.resolve_text_mentions(passage_1, [arin_prof])
        he_mentions = [r for r in res_1 if r.mention_span.lower() in ("he", "his")]
        p1_passed = all(m.resolved_entity_id == "e-arin" and m.resolution_status == "resolved" for m in he_mentions)
        results.append(BenchmarkResult(
            test_id="COREFERENCE_SINGLE_MALE",
            category="Coreference Resolution",
            description="Resolve 'he' and 'his' to single male character Arin.",
            passed=p1_passed,
            details={"mentions_found": len(he_mentions), "resolved": p1_passed}
        ))

        # Case 2: Multi-gender interaction
        passage_2 = "Arin met Mira at the gate. He handed her the letter."
        res_2 = coreference_resolution_service.resolve_text_mentions(passage_2, [arin_prof, mira_prof])
        he_p2 = [r for r in res_2 if r.mention_span.lower() == "he"]
        her_p2 = [r for r in res_2 if r.mention_span.lower() == "her"]
        p2_passed = (
            len(he_p2) >= 1 and he_p2[0].resolved_entity_id == "e-arin" and
            len(her_p2) >= 1 and her_p2[0].resolved_entity_id == "e-mira"
        )
        results.append(BenchmarkResult(
            test_id="COREFERENCE_MULTI_GENDER",
            category="Coreference Resolution",
            description="Resolve 'he' -> Arin and 'her' -> Mira in same sentence.",
            passed=p2_passed,
            details={"he_resolved_to": he_p2[0].resolved_entity_id if he_p2 else None, "her_resolved_to": her_p2[0].resolved_entity_id if her_p2 else None}
        ))

        # Case 3: Inanimate 'it' resolution
        passage_3 = "Arin unlocked the vault with The Silver Key. It gleamed in the moonlight."
        res_3 = coreference_resolution_service.resolve_text_mentions(passage_3, [arin_prof, key_prof])
        it_p3 = [r for r in res_3 if r.mention_span.lower() == "it"]
        p3_passed = (len(it_p3) >= 1 and it_p3[0].resolved_entity_id == "e-key")
        results.append(BenchmarkResult(
            test_id="COREFERENCE_INANIMATE_IT",
            category="Coreference Resolution",
            description="Resolve 'it' to inanimate artifact 'The Silver Key' rather than human character.",
            passed=p3_passed,
            details={"it_resolved_to": it_p3[0].resolved_entity_id if it_p3 else None}
        ))

        # -------------------------------------------------------------
        # Category E: Genuine Ambiguity Handling (Problem B)
        # -------------------------------------------------------------
        # When two characters of the same gender have equal/near-equal recency without decisive cues, DO NOT GUESS!
        julian_prof = EntityProfile(id="e-julian", name="Julian", entity_type="character", gender="male")
        stephen_prof = EntityProfile(id="e-stephen", name="Stephen", entity_type="character", gender="male")

        passage_ambiguous = "Julian confronted Stephen. He pulled out a dagger."
        res_ambig = coreference_resolution_service.resolve_text_mentions(passage_ambiguous, [julian_prof, stephen_prof])
        he_ambig = [r for r in res_ambig if r.mention_span.lower() == "he"]
        ambig_passed = (
            len(he_ambig) >= 1 and
            he_ambig[0].is_ambiguous is True and
            he_ambig[0].resolution_status == "ambiguous" and
            set(he_ambig[0].candidate_entity_ids) == {"e-julian", "e-stephen"}
        )
        results.append(BenchmarkResult(
            test_id="AMBIGUITY_SAME_GENDER_DETECTION",
            category="Ambiguity Detection",
            description="Strictly flag ambiguous pronoun between Julian and Stephen without blind guessing.",
            passed=ambig_passed,
            details={
                "is_ambiguous": he_ambig[0].is_ambiguous if he_ambig else None,
                "status": he_ambig[0].resolution_status if he_ambig else None,
                "candidates": he_ambig[0].candidate_entity_ids if he_ambig else None
            }
        ))

        # -------------------------------------------------------------
        # Category F: Descriptive Reference & Alias Resolution (Problem B)
        # -------------------------------------------------------------
        passage_desc = "Inspector Vance walked down the alley. The detective noticed strange footprints."
        res_desc = coreference_resolution_service.resolve_text_mentions(passage_desc, [arin_prof])
        desc_matches = [r for r in res_desc if "detective" in r.mention_span.lower()]
        p_desc_passed = (len(desc_matches) >= 1 and desc_matches[0].resolved_entity_id == "e-arin")
        results.append(BenchmarkResult(
            test_id="DESCRIPTIVE_REF_RESOLUTION",
            category="Descriptive Reference",
            description="Resolve 'the detective' to Arin Vance based on traits/role.",
            passed=p_desc_passed,
            details={"resolved_to": desc_matches[0].resolved_entity_id if desc_matches else None}
        ))

        # Surname match
        passage_surname = "Vance entered the archive."
        res_surname = coreference_resolution_service.resolve_text_mentions(passage_surname, [arin_prof])
        vance_matches = [r for r in res_surname if r.mention_span.lower() == "vance"]
        p_sur_passed = (len(vance_matches) >= 1 and vance_matches[0].resolved_entity_id == "e-arin")
        results.append(BenchmarkResult(
            test_id="SURNAME_ALIAS_RESOLUTION",
            category="Alias Resolution",
            description="Resolve surname 'Vance' to canonical entity 'Arin Vance'.",
            passed=p_sur_passed,
            details={"resolved_to": vance_matches[0].resolved_entity_id if vance_matches else None}
        ))

        # -------------------------------------------------------------
        # Category G: Non-Merging of Distinct Characters (Problem B)
        # -------------------------------------------------------------
        # Characters sharing a title/rank must remain separate
        captain_miller = EntityProfile(id="e-miller", name="Captain Miller", entity_type="character", titles=["captain"])
        captain_davis = EntityProfile(id="e-davis", name="Captain Davis", entity_type="character", titles=["captain"])

        passage_captains = "Captain Miller met Captain Davis at dawn."
        res_caps = coreference_resolution_service.resolve_text_mentions(passage_captains, [captain_miller, captain_davis])
        cap_results = [r for r in res_caps if r.mention_type == "proper_name"]
        caps_passed = (
            len(cap_results) >= 2 and
            {r.resolved_entity_id for r in cap_results} == {"e-miller", "e-davis"}
        )
        results.append(BenchmarkResult(
            test_id="DISTINCT_TITLE_NON_MERGE",
            category="Canonical Identity",
            description="Ensure 'Captain Miller' and 'Captain Davis' are distinct entities without false merge.",
            passed=caps_passed,
            details={"distinct_resolved_count": len({r.resolved_entity_id for r in cap_results})}
        ))

        # -------------------------------------------------------------
        # Category H: Graph Admission Boundary (Problem C)
        # -------------------------------------------------------------
        # Verify spurious relation rejection
        _, rej_reason = graph_admission_service.admit_relationship(
            db=None,  # Not hit when relation_type is disallowed
            project_id="p-test",
            source_entity_id="e-1",
            target_entity_id="e-2",
            relation_type="associated_with",
            force_admit=False
        )
        spurious_passed = "Rejected weak relation type" in rej_reason
        results.append(BenchmarkResult(
            test_id="GRAPH_ADMISSION_REJECT_SPURIOUS",
            category="Graph Admission Boundary",
            description="Strictly reject spurious co-occurrence 'associated_with' edges.",
            passed=spurious_passed,
            details={"rejection_reason": rej_reason}
        ))

        # Self loop rejection
        _, loop_reason = graph_admission_service.admit_relationship(
            db=None,
            project_id="p-test",
            source_entity_id="e-1",
            target_entity_id="e-1",
            relation_type="allied_with"
        )
        loop_passed = "Rejected self-loop" in loop_reason
        results.append(BenchmarkResult(
            test_id="GRAPH_ADMISSION_REJECT_SELF_LOOP",
            category="Graph Admission Boundary",
            description="Strictly reject self-loop relationship edges.",
            passed=loop_passed,
            details={"rejection_reason": loop_reason}
        ))

        # -------------------------------------------------------------
        # Calculate Metrics
        # -------------------------------------------------------------
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.passed)
        pass_rate = round((passed_tests / total_tests) * 100, 2) if total_tests > 0 else 0.0

        categories = {}
        for r in results:
            categories.setdefault(r.category, {"total": 0, "passed": 0})
            categories[r.category]["total"] += 1
            if r.passed:
                categories[r.category]["passed"] += 1

        return {
            "total_benchmarks": total_tests,
            "passed_benchmarks": passed_tests,
            "pass_rate_percentage": pass_rate,
            "categories": categories,
            "results": [
                {
                    "test_id": r.test_id,
                    "category": r.category,
                    "description": r.description,
                    "passed": r.passed,
                    "details": r.details
                }
                for r in results
            ]
        }


narrative_evaluation_service = NarrativeEvaluationService()
