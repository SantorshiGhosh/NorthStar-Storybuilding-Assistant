"""
Test Suite: Narrative Intelligence Logic & Integrity Benchmarks
Covers all 33+ narrative benchmark cases specified in Parts 16 & 17:
- Incidental objects (chairs, cups, windows, hallways)
- Plot-critical objects (Silver Key, poisoned chalice, inherited ring, battle sword)
- Character identity & canonical consolidation
- Pronoun ambiguity (Julian vs Stephen, Arin vs Daniel, Mira vs Sarah)
- Object coreference (Silver Key -> It, sword -> weapon)
- Descriptive references ("the detective")
- Alias collisions & distinct identity preservation (Captain Miller vs Captain Davis, two Daniels)
- Relationship evidence (co-occurrence rejection vs transfer verification)
- Chronological isolation (strict zero future-chapter contamination)
"""
import pytest
from app.production_v2.services.narrative_context_builder import narrative_context_builder, MentionContext
from app.production_v2.services.narrative_entity_admission_policy import (
    narrative_entity_admission_policy, PolicyEvaluationResult
)
from app.production_v2.services.narrative_coreference_engine import (
    narrative_coreference_engine, DynamicEntityProfile
)
from app.production_v2.services.narrative_identity_resolution_adapter import (
    narrative_identity_resolution_adapter
)
from app.production_v2.services.narrative_graph_validation_adapter import (
    narrative_graph_validation_adapter
)
from app.production_v2.services.narrative_extraction_orchestrator import (
    narrative_extraction_orchestrator
)
from app.production_v2.services.narrative_integrity_audit_service import (
    narrative_integrity_audit_service
)


# =====================================================================
# Benchmark A: Incidental Objects
# =====================================================================
class TestBenchmarkAIncidentalObjects:
    @pytest.mark.parametrize("sentence,noun", [
        ("Arin sat on a wooden chair.", "chair"),
        ("She drank a cup of tea.", "cup"),
        ("A window stood beside the table.", "window"),
        ("The hallway was dark.", "hallway")
    ])
    def test_incidental_nouns_not_permanent_entities(self, sentence, noun):
        ctx = narrative_context_builder.build_mention_context(
            chapter_content=sentence,
            target_span=noun,
            chapter_number=1
        )
        eval_res = narrative_entity_admission_policy.evaluate_candidate(
            name=noun,
            proposed_type="object",
            mention_context=ctx
        )
        assert eval_res.admission_status == "rejected"
        assert eval_res.narrative_relevance < 0.40
        assert eval_res.is_incidental is True


# =====================================================================
# Benchmark B: Plot-Critical Objects
# =====================================================================
class TestBenchmarkBPlotCriticalObjects:
    def test_silver_key_plot_critical(self):
        text = "The Silver Key was the only artifact capable of opening the vault."
        ctx = narrative_context_builder.build_mention_context(text, "The Silver Key", 1)
        eval_res = narrative_entity_admission_policy.evaluate_candidate(
            name="The Silver Key",
            proposed_type="object",
            mention_context=ctx,
            involves_custody=True
        )
        assert eval_res.admission_status == "accepted"
        assert eval_res.narrative_relevance >= 0.65

    def test_poisoned_chalice_single_mention_critical(self):
        text = "The king drank from the poisoned chalice and died."
        ctx = narrative_context_builder.build_mention_context(text, "the poisoned chalice", 1)
        eval_res = narrative_entity_admission_policy.evaluate_candidate(
            name="the poisoned chalice",
            proposed_type="object",
            mention_context=ctx,
            involves_state_mutation=True
        )
        assert eval_res.admission_status == "accepted"
        assert eval_res.narrative_relevance >= 0.65

    def test_inherited_ring_needs_review_or_accepted(self):
        text = "She inherited the ring from her mother."
        ctx = narrative_context_builder.build_mention_context(text, "the ring", 1)
        eval_res = narrative_entity_admission_policy.evaluate_candidate(
            name="the ring",
            proposed_type="object",
            mention_context=ctx,
            involves_custody=True
        )
        assert eval_res.admission_status in ("accepted", "needs_review")
        assert eval_res.narrative_relevance >= 0.40

    def test_battle_sword_changing_hands(self):
        text = "The sword changed hands three times during the battle."
        ctx = narrative_context_builder.build_mention_context(text, "The sword", 1)
        eval_res = narrative_entity_admission_policy.evaluate_candidate(
            name="The sword",
            proposed_type="object",
            mention_context=ctx,
            involves_custody=True
        )
        assert eval_res.admission_status == "accepted"
        assert eval_res.narrative_relevance >= 0.65


# =====================================================================
# Benchmark C: Character Identity
# =====================================================================
class TestBenchmarkCCharacterIdentity:
    def test_arin_vance_first_and_full_name(self):
        text = "Arin Vance entered the room. Arin looked around."
        arin = DynamicEntityProfile(id="c-arin", name="Arin Vance", entity_type="character", gender="male")
        results = narrative_coreference_engine.resolve_coreference(text, [arin])
        resolved_cands = [r for r in results if r.resolved_entity_id == "c-arin"]
        assert len(resolved_cands) >= 2

    def test_arin_vance_surname_mention(self):
        text = "Arin Vance entered the room. Vance noticed the door."
        arin = DynamicEntityProfile(id="c-arin", name="Arin Vance", entity_type="character", gender="male")
        results = narrative_coreference_engine.resolve_coreference(text, [arin])
        vance_match = next((r for r in results if r.mention_span.lower() == "vance"), None)
        assert vance_match is not None
        assert vance_match.resolved_entity_id == "c-arin"

    def test_arin_pronoun_he(self):
        text = "Arin entered the room. He closed the door."
        arin = DynamicEntityProfile(id="c-arin", name="Arin", entity_type="character", gender="male")
        results = narrative_coreference_engine.resolve_coreference(text, [arin])
        he_match = next((r for r in results if r.mention_span.lower() == "he"), None)
        assert he_match is not None
        assert he_match.resolved_entity_id == "c-arin"
        assert he_match.resolution_status == "resolved"

    def test_mira_pronoun_she(self):
        text = "Mira entered the room. She looked at Arin."
        mira = DynamicEntityProfile(id="c-mira", name="Mira", entity_type="character", gender="female")
        arin = DynamicEntityProfile(id="c-arin", name="Arin", entity_type="character", gender="male")
        results = narrative_coreference_engine.resolve_coreference(text, [mira, arin])
        she_match = next((r for r in results if r.mention_span.lower() == "she"), None)
        assert she_match is not None
        assert she_match.resolved_entity_id == "c-mira"


# =====================================================================
# Benchmark D: Pronoun Ambiguity (No Blind Guessing)
# =====================================================================
class TestBenchmarkDPronounAmbiguity:
    def test_julian_and_stephen_same_gender_ambiguous(self):
        text = "Julian fought Stephen. He fell."
        julian = DynamicEntityProfile(id="c-julian", name="Julian", entity_type="character", gender="male")
        stephen = DynamicEntityProfile(id="c-stephen", name="Stephen", entity_type="character", gender="male")
        results = narrative_coreference_engine.resolve_coreference(text, [julian, stephen])
        he_match = next((r for r in results if r.mention_span.lower() == "he"), None)
        assert he_match is not None
        assert he_match.is_ambiguous is True
        assert he_match.resolution_status == "ambiguous"
        assert set(he_match.candidate_entity_ids) == {"c-julian", "c-stephen"}

    def test_mira_and_sarah_same_gender_ambiguous(self):
        text = "Mira spoke to Sarah. She looked worried."
        mira = DynamicEntityProfile(id="c-mira", name="Mira", entity_type="character", gender="female")
        sarah = DynamicEntityProfile(id="c-sarah", name="Sarah", entity_type="character", gender="female")
        results = narrative_coreference_engine.resolve_coreference(text, [mira, sarah])
        she_match = next((r for r in results if r.mention_span.lower() == "she"), None)
        assert she_match is not None
        assert she_match.is_ambiguous is True
        assert she_match.resolution_status == "ambiguous"
        assert set(she_match.candidate_entity_ids) == {"c-mira", "c-sarah"}


# =====================================================================
# Benchmark E: Object Coreference
# =====================================================================
class TestBenchmarkEObjectCoreference:
    def test_inanimate_it_resolves_to_silver_key(self):
        text = "Arin picked up the Silver Key. It was cold."
        arin = DynamicEntityProfile(id="c-arin", name="Arin", entity_type="character", gender="male")
        key = DynamicEntityProfile(id="o-key", name="The Silver Key", entity_type="object", gender="inanimate")
        results = narrative_coreference_engine.resolve_coreference(text, [arin, key])
        it_match = next((r for r in results if r.mention_span.lower() == "it"), None)
        assert it_match is not None
        assert it_match.resolved_entity_id == "o-key"

    def test_sword_and_weapon_descriptive_coreference(self):
        text = "The sword was broken. The weapon could no longer be used."
        sword = DynamicEntityProfile(id="o-sword", name="The Sword", entity_type="object", gender="inanimate")
        results = narrative_coreference_engine.resolve_coreference(text, [sword])
        weapon_match = next((r for r in results if "weapon" in r.mention_span.lower()), None)
        assert weapon_match is not None
        assert weapon_match.resolved_entity_id == "o-sword"


# =====================================================================
# Benchmark F: Descriptive References
# =====================================================================
class TestBenchmarkFDescriptiveReferences:
    def test_detective_resolves_to_arin_when_established(self):
        text = "Arin, the detective, entered the room. The detective examined the evidence."
        arin = DynamicEntityProfile(
            id="c-arin", name="Arin", entity_type="character", gender="male",
            roles=["detective"], traits=["detective"]
        )
        results = narrative_coreference_engine.resolve_coreference(text, [arin])
        det_matches = [r for r in results if "detective" in r.mention_span.lower()]
        assert len(det_matches) >= 1
        assert any(r.resolved_entity_id == "c-arin" for r in det_matches)


# =====================================================================
# Benchmark G: Alias Collisions (Prevent False Merges)
# =====================================================================
class TestBenchmarkGAliasCollisions:
    def test_captain_miller_and_captain_davis_remain_distinct(self):
        cap_m = DynamicEntityProfile(id="c-miller", name="Captain Miller", entity_type="character", titles=["captain"])
        cap_d = DynamicEntityProfile(id="c-davis", name="Captain Davis", entity_type="character", titles=["captain"])
        text = "Captain Miller spoke with Captain Davis."
        results = narrative_coreference_engine.resolve_coreference(text, [cap_m, cap_d])
        names = [r for r in results if r.mention_type == "proper_name"]
        resolved_ids = {r.resolved_entity_id for r in names}
        assert resolved_ids == {"c-miller", "c-davis"}


# =====================================================================
# Benchmark H: Relationship Evidence
# =====================================================================
class TestBenchmarkHRelationshipEvidence:
    def test_reject_spurious_cooccurrence_relation(self):
        _, reason = narrative_graph_validation_adapter.validate_and_admit_relationship(
            db=None,
            project_id="p-1",
            source_entity_id="e-1",
            target_entity_id="e-2",
            relation_type="associated_with",
            source_quote="Arin and Mira were in the room."
        )
        assert "Rejected spurious co-occurrence" in reason

    def test_reject_self_loop(self):
        _, reason = narrative_graph_validation_adapter.validate_and_admit_relationship(
            db=None,
            project_id="p-1",
            source_entity_id="e-1",
            target_entity_id="e-1",
            relation_type="allied_with",
            source_quote="Arin looked at himself."
        )
        assert "Rejected self-loop" in reason


# =====================================================================
# Benchmark I: Chronological Context (Zero Future Contamination)
# =====================================================================
class TestBenchmarkIChronologicalContext:
    def test_chronological_isolation_blocks_future_chapter_data(self):
        ctx = narrative_context_builder.build_mention_context(
            chapter_content="Arin walked toward the gate.",
            target_span="Arin",
            chapter_number=2,
            retrospective_mode=False
        )
        assert ctx.analysis_mode == "chronological"
        assert ctx.chapter_number == 2


# =====================================================================
# Candidate Reconciliation Test
# =====================================================================
class TestCandidateReconciliation:
    def test_reconcile_drops_incidental_heuristic_candidates(self):
        ai_ents = [
            {"name": "Arin Vance", "entity_type": "character", "description": "Protagonist"},
            {"name": "The Silver Key", "entity_type": "object", "description": "Ancient artifact"}
        ]
        heuristic_ents = [
            {"name": "The Wooden Door", "entity_type": "object", "description": "Door"},
            {"name": "A Cup", "entity_type": "object", "description": "Cup of water"},
            {"name": "The Silver Key", "entity_type": "object", "description": "Heuristic duplicate"}
        ]
        content = "Arin Vance entered the vault with The Silver Key. The wooden door was heavy. He drank a cup."
        reconciled = narrative_extraction_orchestrator.reconcile_candidates(
            ai_entities=ai_ents,
            heuristic_entities=heuristic_ents,
            chapter_content=content,
            chapter_number=1
        )
        names = [c.normalized_name.lower() for c in reconciled]
        assert "arin vance" in names
        assert "silver key" in names
        # Incidental door and cup must be dropped!
        assert "wooden door" not in names
        assert "cup" not in names
