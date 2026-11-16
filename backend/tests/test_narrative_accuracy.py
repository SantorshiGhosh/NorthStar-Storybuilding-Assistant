"""
Test Suite: Narrative Intelligence Accuracy Overhaul
Tests:
- Narrative Relevance & Incidental Filtering (Problem A)
- Coreference Resolution & Discourse Memory (Problem B)
- Ambiguity Detection for Same-Gender Antecedents (Problem B)
- Canonical Entity Integrity & Alias Resolution (Problem B)
- Knowledge Graph Admission Control Boundary (Problem C)
"""
import pytest
from app.production_v2.services.narrative_relevance_service import narrative_relevance_service
from app.production_v2.services.narrative_mention_classifier import narrative_mention_classifier
from app.production_v2.services.coreference_resolution_service import (
    coreference_resolution_service, EntityProfile
)
from app.production_v2.services.canonical_entity_registry import canonical_entity_registry
from app.production_v2.services.graph_admission_service import graph_admission_service
from app.production_v2.services.narrative_evaluation_service import narrative_evaluation_service


class TestNarrativeRelevance:
    """Tests for eliminating incidental nouns and admitting true story elements."""

    @pytest.mark.parametrize("noun", [
        "chair", "wooden chair", "cup", "cup of tea", "table", "door", "window", "hallway", "bread"
    ])
    def test_incidental_nouns_rejected(self, noun):
        evaluation = narrative_relevance_service.evaluate_entity(
            name=noun,
            entity_type="object",
            context_sentences=[f"He placed it next to the {noun}."]
        )
        assert evaluation.relevance_status == "rejected"
        assert evaluation.salience_score < 0.40
        assert evaluation.is_incidental is True

    @pytest.mark.parametrize("artifact,context", [
        ("The Silver Key", "The Silver Key was the only artifact that could unlock the vault."),
        ("The Poisoned Chalice", "The king drank from the poisoned chalice and collapsed dead."),
        ("Excalibur", "Arthur drew Excalibur from the stone and wielded it in battle."),
        ("The Chronos Talisman", "She stole the Chronos Talisman to alter the timeline.")
    ])
    def test_plot_critical_artifacts_accepted(self, artifact, context):
        evaluation = narrative_relevance_service.evaluate_entity(
            name=artifact,
            entity_type="object",
            context_sentences=[context],
            involves_custody=True
        )
        assert evaluation.relevance_status == "accepted"
        assert evaluation.salience_score >= 0.65
        assert evaluation.narrative_role in ("plot_device", "prop")

    def test_major_characters_high_salience(self):
        ev = narrative_relevance_service.evaluate_entity(
            name="Arin Vance",
            entity_type="character",
            context_sentences=["Arin Vance examined the evidence carefully."]
        )
        assert ev.relevance_status == "accepted"
        assert ev.salience_score >= 0.80

    def test_major_locations_high_salience(self):
        ev = narrative_relevance_service.evaluate_entity(
            name="Valoria",
            entity_type="location",
            context_sentences=["The towers of Valoria gleamed in the twilight."]
        )
        assert ev.relevance_status == "accepted"
        assert ev.salience_score >= 0.70


class TestCoreferenceResolution:
    """Tests for pronouns, descriptive references, and ambiguity detection."""

    def test_single_male_character_pronouns(self):
        arin = EntityProfile(id="e-arin", name="Arin Vance", entity_type="character", gender="male", titles=["inspector"])
        passage = "Arin drew his sword. He stepped forward into the darkness."
        results = coreference_resolution_service.resolve_text_mentions(passage, [arin])
        
        pronoun_results = [r for r in results if r.mention_span.lower() in ("he", "his")]
        assert len(pronoun_results) >= 2
        for r in pronoun_results:
            assert r.resolved_entity_id == "e-arin"
            assert r.resolution_status == "resolved"
            assert r.is_ambiguous is False

    def test_multi_gender_paragraph_resolution(self):
        arin = EntityProfile(id="e-arin", name="Arin Vance", entity_type="character", gender="male")
        mira = EntityProfile(id="e-mira", name="Mira", entity_type="character", gender="female")
        passage = "Arin met Mira at the gate. He handed her the key."
        results = coreference_resolution_service.resolve_text_mentions(passage, [arin, mira])

        he = next(r for r in results if r.mention_span.lower() == "he")
        her = next(r for r in results if r.mention_span.lower() == "her")

        assert he.resolved_entity_id == "e-arin"
        assert her.resolved_entity_id == "e-mira"

    def test_inanimate_it_pronoun_resolution(self):
        arin = EntityProfile(id="e-arin", name="Arin Vance", entity_type="character", gender="male")
        key = EntityProfile(id="e-key", name="The Silver Key", entity_type="object", gender="inanimate")
        passage = "Arin held The Silver Key. It unlocked the inner sanctum."
        results = coreference_resolution_service.resolve_text_mentions(passage, [arin, key])

        it_mention = next(r for r in results if r.mention_span.lower() == "it")
        assert it_mention.resolved_entity_id == "e-key"

    def test_same_gender_ambiguity_no_guessing(self):
        """Strict requirement: when two same-gender characters are equally plausible, return ambiguous."""
        julian = EntityProfile(id="e-julian", name="Julian", entity_type="character", gender="male")
        stephen = EntityProfile(id="e-stephen", name="Stephen", entity_type="character", gender="male")
        passage = "Julian attacked Stephen. He fell to the ground."
        results = coreference_resolution_service.resolve_text_mentions(passage, [julian, stephen])

        he = next(r for r in results if r.mention_span.lower() == "he")
        assert he.is_ambiguous is True
        assert he.resolution_status == "ambiguous"
        assert set(he.candidate_entity_ids) == {"e-julian", "e-stephen"}

    def test_descriptive_reference_resolution(self):
        arin = EntityProfile(
            id="e-arin",
            name="Arin Vance",
            entity_type="character",
            gender="male",
            roles=["detective"],
            traits=["detective", "investigator"]
        )
        passage = "The detective searched the study for clues."
        results = coreference_resolution_service.resolve_text_mentions(passage, [arin])
        desc_ref = next(r for r in results if "detective" in r.mention_span.lower())
        assert desc_ref.resolved_entity_id == "e-arin"
        assert desc_ref.resolution_status == "resolved"

    def test_surname_alias_resolution(self):
        arin = EntityProfile(id="e-arin", name="Arin Vance", entity_type="character", gender="male")
        passage = "Vance entered the building."
        results = coreference_resolution_service.resolve_text_mentions(passage, [arin])
        surname_match = next(r for r in results if r.mention_span.lower() == "vance")
        assert surname_match.resolved_entity_id == "e-arin"
        assert surname_match.resolution_status == "resolved"


class TestCanonicalIdentityIntegrity:
    """Tests preventing duplicate split nodes and avoiding false merges."""

    def test_distinct_characters_with_shared_title_not_merged(self):
        cap_miller = EntityProfile(id="e-miller", name="Captain Miller", entity_type="character", titles=["captain"])
        cap_davis = EntityProfile(id="e-davis", name="Captain Davis", entity_type="character", titles=["captain"])
        passage = "Captain Miller spoke with Captain Davis."
        results = coreference_resolution_service.resolve_text_mentions(passage, [cap_miller, cap_davis])
        proper_names = [r for r in results if r.mention_type == "proper_name"]
        resolved_ids = {r.resolved_entity_id for r in proper_names}
        assert resolved_ids == {"e-miller", "e-davis"}


class TestGraphAdmissionBoundary:
    """Tests Knowledge Graph admission control and relation verification."""

    def test_reject_spurious_cooccurrence_edges(self):
        _, reason = graph_admission_service.admit_relationship(
            db=None,
            project_id="test-proj",
            source_entity_id="e-1",
            target_entity_id="e-2",
            relation_type="associated_with",
            force_admit=False
        )
        assert "Rejected weak relation type" in reason

    def test_reject_self_loops(self):
        _, reason = graph_admission_service.admit_relationship(
            db=None,
            project_id="test-proj",
            source_entity_id="e-1",
            target_entity_id="e-1",
            relation_type="allied_with"
        )
        assert "Rejected self-loop" in reason


class TestNarrativeEvaluationSuite:
    """Verifies that the automated evaluation benchmark achieves 100% pass rate."""

    def test_all_benchmarks_pass(self):
        benchmark_results = narrative_evaluation_service.run_all_benchmarks()
        assert benchmark_results["total_benchmarks"] >= 20
        assert benchmark_results["pass_rate_percentage"] == 100.0
        assert benchmark_results["passed_benchmarks"] == benchmark_results["total_benchmarks"]
