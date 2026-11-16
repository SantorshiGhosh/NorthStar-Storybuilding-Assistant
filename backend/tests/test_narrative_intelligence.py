import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Ensure backend directory is in python path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import models
from app.services.document_parser import document_parser
from app.services.identity_service import identity_service
from app.services.temporal_memory_service import temporal_memory_service
from app.agents.continuity_agent import continuity_agent
from app.routes.auth import require_project_access
from fastapi import HTTPException

# Test database setup (in-memory SQLite)
@pytest.fixture(scope="function")
def db_session():
    engine = create_engine("sqlite:///:memory:", echo=False)
    models.Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture(scope="session")
def synthetic_manuscript_text():
    fixture_path = os.path.join(BACKEND_DIR, "tests", "fixtures", "synthetic_regression_manuscript.md")
    with open(fixture_path, "r", encoding="utf-8") as f:
        return f.read()

# -------------------------------------------------------------
# 1. Document Ingestion & Chunking Tests
# -------------------------------------------------------------
def test_document_parser_magic_and_chunking(synthetic_manuscript_text):
    # Magic bytes validation
    with pytest.raises(ValueError):
        document_parser.validate_file_signature(b"NOT A REAL PDF", "pdf")

    # Segment synthetic manuscript
    chapters = document_parser.segment_into_chapters(synthetic_manuscript_text)
    assert len(chapters) == 5, f"Expected 5 sections (foreword + 4 chapters), got {len(chapters)}"
    assert chapters[0]["chapter_number"] == 0
    assert "Sunspire" in chapters[1]["title"]
    assert "Breach" in chapters[2]["title"]
    assert "Mist" in chapters[3]["title"]
    assert "Nyx" in chapters[4]["title"]

    # Sentence-aware chunking
    passages = document_parser.chunk_into_passages(chapters[1]["content"], target_chunk_size=150, overlap_sentences=1)
    assert len(passages) >= 2, "Expected multiple passages"
    for p in passages:
        assert p["char_end"] > p["char_start"]
        assert len(p["content"].strip()) > 0

# -------------------------------------------------------------
# 2. Character Identification & Alias Resolution Tests
# -------------------------------------------------------------
def test_identity_resolution_and_aliases(db_session):
    project_id = models.gen_uuid()
    ch1_id = models.gen_uuid()

    # Resolving primary canonical entity
    ent1 = identity_service.resolve_entity_identity(
        db=db_session,
        project_id=project_id,
        extracted_name="Commander Katherine Vance",
        entity_type="character",
        chapter_id=ch1_id
    )
    assert ent1 is not None

    # Resolving title variation
    ent2 = identity_service.resolve_entity_identity(
        db=db_session,
        project_id=project_id,
        extracted_name="Commander Vance",
        entity_type="character",
        chapter_id=ch1_id
    )
    assert ent2.id == ent1.id, "Commander Vance should resolve to canonical Katherine Vance"

    # Resolving informal nickname 'Kit' with context
    ent3 = identity_service.resolve_entity_identity(
        db=db_session,
        project_id=project_id,
        extracted_name="Kit",
        entity_type="character",
        source_quote="Commander Katherine Vance, known to her closest friends simply as Kit",
        chapter_id=ch1_id
    )
    assert ent3.id == ent1.id, "'Kit' should resolve to canonical Katherine Vance"

    # Disambiguating similar names: Marcus Miller vs Marco Mills
    marcus = identity_service.resolve_entity_identity(
        db=db_session,
        project_id=project_id,
        extracted_name="Captain Marcus Miller",
        entity_type="character",
        chapter_id=ch1_id
    )
    marco = identity_service.resolve_entity_identity(
        db=db_session,
        project_id=project_id,
        extracted_name="Sergeant Marco Mills",
        entity_type="character",
        chapter_id=ch1_id
    )
    assert marcus.id != marco.id, "Marcus Miller and Marco Mills must be distinct entities"

    # Unnamed character resolution
    alchemist = identity_service.resolve_entity_identity(
        db=db_session,
        project_id=project_id,
        extracted_name="the scarred alchemist",
        entity_type="character",
        chapter_id=ch1_id
    )
    assert alchemist is not None
    assert "alchemist" in alchemist.name.lower()

# -------------------------------------------------------------
# 3. Temporal Narrative Memory & Chronological Isolation Tests
# -------------------------------------------------------------
def test_temporal_memory_and_chronological_isolation(db_session):
    project_id = models.gen_uuid()
    ch1_id = models.gen_uuid()
    ch2_id = models.gen_uuid()
    ch4_id = models.gen_uuid()

    # Register character
    kit = identity_service.resolve_entity_identity(
        db=db_session,
        project_id=project_id,
        extracted_name="Katherine Vance",
        entity_type="character",
        chapter_id=ch1_id
    )

    # Record Chapter 1 baseline fact
    db_session.add(models.StoryFact(
        id=models.gen_uuid(),
        project_id=project_id,
        entity_id=kit.id,
        source_chapter_id=ch1_id,
        source_chapter_number=1,
        fact=f"{kit.name} has the title Commander",
        source_quote="Commander Katherine Vance, known to her closest friends simply as Kit",
        category="status",
        valid_from_chapter=1,
        canon_tier="explicit_text"
    ))
    db_session.commit()

    # Record Chapter 2 physical injury
    temporal_memory_service.record_character_state(
        db=db_session,
        project_id=project_id,
        entity_id=kit.id,
        category="physical",
        state_description="lost left eye completely to crossbow bolt",
        chapter_number=2,
        source_quote="Commander Vance has lost her left eye!",
        chapter_id=ch2_id
    )

    # Record Chapter 4 prosthetic restoration
    temporal_memory_service.record_character_state(
        db=db_session,
        project_id=project_id,
        entity_id=kit.id,
        category="physical",
        state_description="fitted silver ocular sphere into left eye socket restoring sight",
        chapter_number=4,
        source_quote="fitted the silver ocular sphere into Katherine's empty left eye socket, magically bonding the nerves and restoring her bilateral sight",
        chapter_id=ch4_id
    )

    # Test chronological isolation at Chapter 2:
    # Querying facts strictly prior to Chapter 2 should contain Chapter 1 fact, but NOT future Chapter 2/4 states
    facts_prior_ch2 = temporal_memory_service.get_prior_canon_facts(
        db=db_session,
        project_id=project_id,
        current_chapter_number=2
    )
    assert len(facts_prior_ch2) == 1
    assert "Commander" in facts_prior_ch2[0]["fact"]

    # Querying states as of Chapter 2:
    states_ch2 = temporal_memory_service.get_character_active_state_at_chapter(
        db=db_session,
        project_id=project_id,
        entity_id=kit.id,
        target_chapter_number=2
    )
    assert len(states_ch2) == 1
    assert "lost left eye" in states_ch2[0].state_description

    # Querying states as of Chapter 4:
    states_ch4 = temporal_memory_service.get_character_active_state_at_chapter(
        db=db_session,
        project_id=project_id,
        entity_id=kit.id,
        target_chapter_number=4
    )
    assert any("silver ocular sphere" in s.state_description for s in states_ch4)

# -------------------------------------------------------------
# 4. Object Custody Tracking Across Transfers
# -------------------------------------------------------------
def test_object_custody_tracking(db_session):
    project_id = models.gen_uuid()
    ch1_id = models.gen_uuid()
    ch2_id = models.gen_uuid()

    compass = identity_service.resolve_entity_identity(
        db=db_session, project_id=project_id, extracted_name="Obsidian Compass", entity_type="object", chapter_id=ch1_id
    )
    kit = identity_service.resolve_entity_identity(
        db=db_session, project_id=project_id, extracted_name="Katherine Vance", entity_type="character", chapter_id=ch1_id
    )
    marcus = identity_service.resolve_entity_identity(
        db=db_session, project_id=project_id, extracted_name="Marcus Miller", entity_type="character", chapter_id=ch1_id
    )
    marco = identity_service.resolve_entity_identity(
        db=db_session, project_id=project_id, extracted_name="Marco Mills", entity_type="character", chapter_id=ch2_id
    )

    # Chapter 1: Katherine Vance transfers Obsidian Compass to Marcus Miller
    temporal_memory_service.record_object_custody_event(
        db=db_session,
        project_id=project_id,
        object_entity_id=compass.id,
        holder_entity_id=marcus.id,
        previous_holder_id=kit.id,
        transfer_type="transfer",
        chapter_number=1,
        source_quote="Katherine handed the Obsidian Compass to Marcus Miller while he prepared his horse.",
        chapter_id=ch1_id
    )
    db_session.commit()

    # Query holder at Chapter 1
    res1 = temporal_memory_service.get_current_object_holder(
        db=db_session,
        project_id=project_id,
        object_entity_id=compass.id,
        up_to_chapter_number=1
    )
    assert res1 is not None
    holder1, ch_num1 = res1
    assert holder1.id == marcus.id

    # Chapter 2: Marcus Miller transfers Obsidian Compass to Marco Mills
    temporal_memory_service.record_object_custody_event(
        db=db_session,
        project_id=project_id,
        object_entity_id=compass.id,
        holder_entity_id=marco.id,
        previous_holder_id=marcus.id,
        transfer_type="transfer",
        chapter_number=2,
        source_quote="Marcus Miller was ambushed and gave the Obsidian Compass to Sergeant Marco Mills.",
        chapter_id=ch2_id
    )
    db_session.commit()

    # Query holder at Chapter 2 and 3
    res2 = temporal_memory_service.get_current_object_holder(
        db=db_session,
        project_id=project_id,
        object_entity_id=compass.id,
        up_to_chapter_number=3
    )
    assert res2 is not None
    holder2, ch_num2 = res2
    assert holder2.id == marco.id

# -------------------------------------------------------------
# 5. Continuity Guardian Detection & False-Positive Suppression
# -------------------------------------------------------------
def test_continuity_guardian_detection_and_suppression(synthetic_manuscript_text):
    chapters = document_parser.segment_into_chapters(synthetic_manuscript_text)
    ch_map = {c["chapter_number"]: c for c in chapters}
    all_chs_data = [
        {"id": f"ch_{c['chapter_number']}", "chapter_number": c["chapter_number"], "title": c["title"], "content": c["content"]}
        for c in chapters
    ]

    # Prior canon facts establishing Kit lost her left eye in Chapter 2
    prior_canon = [
        {
            "id": "f_1",
            "subject": "Katherine Vance",
            "predicate": "lost_body_part",
            "object": "lost left eye completely to crossbow bolt",
            "source_quote": "Commander Vance has lost her left eye!",
            "valid_from_chapter": 2,
            "canon_tier": "explicit_text"
        }
    ]

    # TRUE POSITIVE TEST:
    # Erroneous text in Chapter 3 where Kit sees or winks with her destroyed left eye before any prosthetic
    erroneous_text = "Katherine looked through her left eye and sighted the distant enemy with perfect 20/20 clarity."
    issues = continuity_agent.analyze_chapter_continuity(
        new_chapter_number=3,
        new_content=erroneous_text,
        established_facts=prior_canon,
        retrieved_passages=[],
        all_chapters=all_chs_data,
        skip_llm=True
    )
    assert len(issues) > 0, "Continuity Guardian must detect Katherine seeing with her destroyed left eye"
    assert issues[0]["issue_type"] in ["physical_continuity", "physical_impossibility", "character_state_contradiction"]

    # FALSE POSITIVE SUPPRESSION TEST 1:
    # Chapter 4 legitimate prosthetic restoration must NOT trigger contradiction
    restoration_text = ch_map[4]["content"]  # Chapter 4 has ocular sphere installation
    issues_ch4 = continuity_agent.analyze_chapter_continuity(
        new_chapter_number=4,
        new_content=restoration_text,
        established_facts=prior_canon,
        retrieved_passages=[],
        all_chapters=all_chs_data,
        skip_llm=True
    )
    # Filter for false physical impossibility flags
    physical_issues = [i for i in issues_ch4 if i["issue_type"] in ["physical_continuity", "physical_impossibility"]]
    assert len(physical_issues) == 0, f"Legitimate ocular prosthetic restoration should not trigger physical contradiction: {physical_issues}"

    # FALSE POSITIVE SUPPRESSION TEST 2:
    # Chapter 3 Lord Evelyn revelation (rumour vs reality) must NOT trigger unsuppressed contradiction
    evelyn_canon = [
        {
            "id": "f_2",
            "subject": "Lord Evelyn",
            "predicate": "status",
            "object": "dead (rumour)",
            "source_quote": "Whispers spread among the soldiers that Lord Evelyn was dead",
            "valid_from_chapter": 2,
            "canon_tier": "explicit_text",
            "uncertainty_level": "rumour"
        }
    ]
    evelyn_ch3_content = ch_map[3]["content"]  # Chapter 3 explains false report / rumour
    evelyn_issues = continuity_agent.analyze_chapter_continuity(
        new_chapter_number=3,
        new_content=evelyn_ch3_content,
        established_facts=evelyn_canon,
        retrieved_passages=[],
        all_chapters=all_chs_data,
        skip_llm=True
    )
    mortality_issues = [i for i in evelyn_issues if i["issue_type"] == "mortality_violation"]
    assert len(mortality_issues) == 0, "Lord Evelyn feigning death / clarifying rumour must not trigger mortality contradiction"

# -------------------------------------------------------------
# 6. Security & Project Isolation Tests
# -------------------------------------------------------------
def test_security_authorization_enforcement(db_session):
    user_a_id = models.gen_uuid()
    user_b_id = models.gen_uuid()
    proj_priv_id = models.gen_uuid()
    proj_demo_id = models.gen_uuid()

    user_a = models.User(id=user_a_id, email="a@test.com", hashed_password="pwd")
    user_b = models.User(id=user_b_id, email="b@test.com", hashed_password="pwd")
    db_session.add_all([user_a, user_b])
    db_session.commit()

    proj_private = models.Project(id=proj_priv_id, name="Private Story", user_id=user_a_id, is_demo=False)
    proj_demo = models.Project(id=proj_demo_id, name="Demo Story", user_id=user_a_id, is_demo=True)
    db_session.add_all([proj_private, proj_demo])
    db_session.commit()

    # 1. Unauthenticated user accessing private project -> 401
    with pytest.raises(HTTPException) as exc1:
        require_project_access(proj_priv_id, user=None, db=db_session, require_write=False)
    assert exc1.value.status_code == 401

    # 2. Unauthorized user B accessing user A's private project -> 403
    with pytest.raises(HTTPException) as exc2:
        require_project_access(proj_priv_id, user=user_b, db=db_session, require_write=False)
    assert exc2.value.status_code == 403

    # 3. Owner user A accessing own project -> succeeds
    p_owned = require_project_access(proj_priv_id, user=user_a, db=db_session, require_write=True)
    assert p_owned.id == proj_priv_id

    # 4. Demo project read access allowed for unauthenticated user
    p_demo_read = require_project_access(proj_demo_id, user=None, db=db_session, require_write=False)
    assert p_demo_read.id == proj_demo_id

    # 5. Demo project write access forbidden for unauthorized user
    with pytest.raises(HTTPException) as exc3:
        require_project_access(proj_demo_id, user=user_b, db=db_session, require_write=True)
    assert exc3.value.status_code == 403
