"""
Production V2 Comprehensive Test Suite
Validates AES-256-GCM key rotation, non-destructive versioning, strict evidence certification,
durable job recovery, canon review, and chronological isolation.
"""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database import models
from app.main import app

from app.production_v2.services.vault_key_management import (
    VaultKeyManager,
    VaultIntegrityError,
    VaultConfigurationError,
    vault_key_manager
)
from app.production_v2.services.version_repository import version_repository
from app.production_v2.services.version_activation_service import version_activation_service
from app.production_v2.services.strict_evidence_service import strict_evidence_service
from app.production_v2.services.durable_job_service import (
    durable_job_service,
    ProcessingStage
)
from app.production_v2.services.canon_review_service import canon_review_service
from app.production_v2.services.hybrid_retrieval_service import hybrid_retrieval_service
from app.production_v2.services.production_health_service import production_health_service
from app.production_v2.pipelines.production_pipeline import production_pipeline_coordinator
from app.production_v2.workers.task_worker import task_worker
from app.production_v2.schemas.v2_schemas import (
    EvidenceStatusEnum,
    CanonReviewRequest
)
from app.production_v2.routes.production_router import (
    get_production_system_health,
    get_pending_canon_reviews,
    get_durable_job_status,
    retry_failed_job,
    submit_canon_review_decision
)


@pytest.fixture(scope="function")
def db_session():
    db = next(get_db())
    try:
        yield db
    finally:
        db.rollback()
        db.close()


def test_vault_aes_256_gcm_rotation_and_tamper_detection():
    """Validates AES-256-GCM encryption, key rotation, and cryptographic tamper resistance."""
    plaintext = b"Classified Manuscript Content: Eldoria must not fall."

    # 1. Standard V2 encryption roundtrip
    encrypted = vault_key_manager.encrypt_bytes(plaintext)
    assert encrypted.startswith(b"\x02"), "V2 encrypted payload must start with magic byte 0x02"
    assert len(encrypted) >= 1 + 12 + len(plaintext) + 16

    decrypted, was_rotated = vault_key_manager.decrypt_bytes(encrypted)
    assert decrypted == plaintext
    assert was_rotated is False

    # 2. Tamper detection: modifying a single byte in ciphertext must fail tag validation
    tampered = bytearray(encrypted)
    tampered[15] ^= 0xFF  # Flip bit in ciphertext
    with pytest.raises(VaultIntegrityError):
        vault_key_manager.decrypt_bytes(bytes(tampered))

    # 3. Key rotation test: payload encrypted with older secondary key
    old_key_hex = "a" * 64
    mgr_with_rotation = VaultKeyManager()
    mgr_with_rotation.rotation_keys.append(bytes.fromhex(old_key_hex))

    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    old_cipher = AESGCM(bytes.fromhex(old_key_hex))
    old_nonce = b"\x01" * 12
    old_payload = old_nonce + old_cipher.encrypt(old_nonce, plaintext, None)

    # Mgr decrypts using rotation key fallback
    recovered, used_rotation = mgr_with_rotation.decrypt_bytes(old_payload)
    assert recovered == plaintext
    assert used_rotation is True


def test_non_destructive_manuscript_versioning_and_rollback(db_session: Session):
    """Verifies that new manuscript revisions never delete prior drafts, chapters, or facts."""
    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Chronicles of Vance", description="Test Project")
    db_session.add(project)
    db_session.commit()

    # Create Manuscript Version 1
    m1_id = models.gen_uuid()
    m1 = models.Manuscript(
        id=m1_id,
        project_id=project_id,
        filename="vance_draft1.md",
        file_type="md",
        version_number=1,
        is_active_version=True,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(m1)
    ch1_v1 = models.Chapter(
        id=models.gen_uuid(),
        project_id=project_id,
        manuscript_id=m1_id,
        chapter_number=1,
        title="Chapter 1: The Departure",
        content="Katherine Vance stepped onto the airship with her golden compass.",
        word_count=10
    )
    db_session.add(ch1_v1)
    db_session.commit()

    # Create Manuscript Version 2 (Non-destructive upload)
    m1.is_active_version = False
    m1.superseded_at = datetime.now(timezone.utc)

    m2_id = models.gen_uuid()
    m2 = models.Manuscript(
        id=m2_id,
        project_id=project_id,
        filename="vance_draft2.md",
        file_type="md",
        version_number=2,
        is_active_version=True,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(m2)
    ch1_v2 = models.Chapter(
        id=models.gen_uuid(),
        project_id=project_id,
        manuscript_id=m2_id,
        chapter_number=1,
        title="Chapter 1: The Departure",
        content="Katherine Vance stepped onto the silver zeppelin with her brass chronometer.",
        word_count=10
    )
    ch2_v2 = models.Chapter(
        id=models.gen_uuid(),
        project_id=project_id,
        manuscript_id=m2_id,
        chapter_number=2,
        title="Chapter 2: Skies Over Eldoria",
        content="The skies roared with tempestuous lightning as the zeppelin surged forward.",
        word_count=11
    )
    db_session.add_all([ch1_v2, ch2_v2])
    db_session.commit()

    # 1. Verify both versions exist intact in database
    versions = version_repository.list_versions(db_session, project_id)
    assert len(versions) == 2
    assert versions[0].version_number == 2 and versions[0].is_active is True
    assert versions[1].version_number == 1 and versions[1].is_active is False

    # Historical chapters still exist in DB
    v1_chapters = db_session.query(models.Chapter).filter(models.Chapter.manuscript_id == m1_id).all()
    assert len(v1_chapters) == 1, "Historical Chapter 1 must remain preserved"

    # 2. Version Comparison
    diff = version_repository.compare_versions(db_session, project_id, base_version_number=1, target_version_number=2)
    assert diff.base_version == 1
    assert diff.target_version == 2
    assert len(diff.chapter_diffs) == 2
    # Chapter 1 was modified
    ch1_diff = next(d for d in diff.chapter_diffs if d.chapter_number == 1)
    assert ch1_diff.status == "modified"
    # Chapter 2 was added
    ch2_diff = next(d for d in diff.chapter_diffs if d.chapter_number == 2)
    assert ch2_diff.status == "added"

    # 3. Rollback to Version 1
    rollback_res = version_repository.rollback_to_version(db_session, project_id, target_version_number=1)
    assert rollback_res.status == "success"
    assert rollback_res.active_version_number == 1

    active_after = version_repository.get_active_version(db_session, project_id)
    assert active_after.version_number == 1
    assert str(active_after.id) == str(m1_id)


def test_strict_evidence_verification_statuses(db_session: Session):
    """Certifies exact, normalized, candidate, version-mismatch, and unverified citation statuses."""
    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Evidence Test Realm")
    db_session.add(project)

    # Version 1 (Historical)
    m1 = models.Manuscript(
        id=models.gen_uuid(),
        project_id=project_id,
        filename="draft1.txt",
        file_type="txt",
        version_number=1,
        is_active_version=False
    )
    ch_v1 = models.Chapter(
        id=models.gen_uuid(),
        project_id=project_id,
        manuscript_id=m1.id,
        chapter_number=1,
        title="Prologue",
        content="The ancient crystal artifact was shattered into twelve pieces."
    )
    db_session.add_all([m1, ch_v1])

    # Version 2 (Active)
    m2 = models.Manuscript(
        id=models.gen_uuid(),
        project_id=project_id,
        filename="draft2.txt",
        file_type="txt",
        version_number=2,
        is_active_version=True
    )
    ch_v2 = models.Chapter(
        id=models.gen_uuid(),
        project_id=project_id,
        manuscript_id=m2.id,
        chapter_number=1,
        title="Prologue",
        content="Lord Malakor drew his obsidian blade—a weapon forged in dragon fire—and raised it high."
    )
    db_session.add_all([m2, ch_v2])
    db_session.commit()

    # Case A: EXACT_VERIFIED
    res_exact = strict_evidence_service.verify_quote(
        db_session,
        project_id,
        quote="Lord Malakor drew his obsidian blade"
    )
    assert res_exact.status == EvidenceStatusEnum.EXACT_VERIFIED
    assert res_exact.confidence == 1.0
    assert res_exact.chapter_number == 1
    assert res_exact.start_char == 0
    assert res_exact.end_char == 36

    # Case B: NORMALIZED_VERIFIED (smart quotes / normalized dashes)
    res_norm = strict_evidence_service.verify_quote(
        db_session,
        project_id,
        quote="Lord Malakor drew his obsidian blade - a weapon forged in dragon fire - and raised it high."
    )
    assert res_norm.status in (EvidenceStatusEnum.NORMALIZED_VERIFIED, EvidenceStatusEnum.EXACT_VERIFIED)

    # Case C: CANDIDATE_MATCH (high similarity)
    res_cand = strict_evidence_service.verify_quote(
        db_session,
        project_id,
        quote="Lord Malakor drew his obsidian blade forged in dragon fire"
    )
    assert res_cand.status in (EvidenceStatusEnum.CANDIDATE_MATCH, EvidenceStatusEnum.EXACT_VERIFIED, EvidenceStatusEnum.NORMALIZED_VERIFIED)

    # Case D: SOURCE_VERSION_MISMATCH (real in v1, gone in v2)
    res_mismatch = strict_evidence_service.verify_quote(
        db_session,
        project_id,
        quote="The ancient crystal artifact was shattered into twelve pieces."
    )
    assert res_mismatch.status == EvidenceStatusEnum.SOURCE_VERSION_MISMATCH
    assert res_mismatch.version_number == 1

    # Case E: UNVERIFIED (hallucinated / non-existent)
    res_unver = strict_evidence_service.verify_quote(
        db_session,
        project_id,
        quote="Aliens from outer space arrived in a flying saucer above the Citadel."
    )
    assert res_unver.status == EvidenceStatusEnum.UNVERIFIED
    assert res_unver.confidence == 0.0


def test_durable_job_stage_progression_and_recovery(db_session: Session):
    """Validates 14-stage progression, timeout recovery, and resumption."""
    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Job Realm")
    db_session.add(project)
    db_session.commit()

    job = durable_job_service.create_job(db_session, project_id=project_id)
    assert job.status == "queued"

    # Progress through stages
    durable_job_service.update_stage(db_session, str(job.id), ProcessingStage.STAGE_1_VALIDATING_DOCUMENT)
    durable_job_service.update_stage(db_session, str(job.id), ProcessingStage.STAGE_5_RESOLVING_IDENTITIES)

    status_out = durable_job_service.get_job_status(db_session, str(job.id))
    assert status_out.current_stage == ProcessingStage.STAGE_5_RESOLVING_IDENTITIES
    assert status_out.progress_percent == 45.0
    assert ProcessingStage.STAGE_1_VALIDATING_DOCUMENT in status_out.stages_completed

    # Stalled recovery
    stalled = durable_job_service.recover_stalled_jobs(db_session, timeout_seconds=0)
    assert str(job.id) in stalled

    refreshed_job = durable_job_service.get_job_status(db_session, str(job.id))
    assert refreshed_job.status == "failed"

    # Resumption
    retry_res = durable_job_service.retry_job(db_session, str(job.id))
    assert retry_res.status == "queued"
    assert retry_res.resumed_from_stage == ProcessingStage.STAGE_5_RESOLVING_IDENTITIES


def test_canon_review_workflow(db_session: Session):
    """Validates author review transitions (pending -> author_confirmed / rejected)."""
    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Canon Realm")
    db_session.add(project)

    entity = models.Entity(id=models.gen_uuid(), project_id=project_id, name="Lady Vivienne", entity_type="character")
    db_session.add(entity)
    db_session.commit()

    fact_pending = models.StoryFact(
        id=models.gen_uuid(),
        project_id=project_id,
        entity_id=entity.id,
        fact="Lady Vivienne harbors secret allegiances with the Shadow Guild.",
        source_quote="Vivienne met the guildmaster in secret shadows.",
        canon_tier="pending_review",
        uncertainty_level="inferred",
        is_negated=False
    )
    db_session.add(fact_pending)
    db_session.commit()

    # 1. Fetch pending
    pending_list = canon_review_service.list_pending_facts(db_session, project_id)
    assert len(pending_list) >= 1
    assert any(item.fact_id == str(fact_pending.id) for item in pending_list)

    # 2. Author confirms
    conf_res = canon_review_service.process_review(db_session, str(fact_pending.id), action="confirm")
    assert conf_res.updated_tier == "author_confirmed"
    assert conf_res.is_negated is False

    # 3. Author rejects another fact
    fact_reject = models.StoryFact(
        id=models.gen_uuid(),
        project_id=project_id,
        entity_id=entity.id,
        fact="Lady Vivienne was born in Blackstone Fortress.",
        source_quote="Born in the high towers of Blackstone.",
        canon_tier="pending_review",
        uncertainty_level="speculation",
        is_negated=False
    )
    db_session.add(fact_reject)
    db_session.commit()

    rej_res = canon_review_service.process_review(db_session, str(fact_reject.id), action="reject")
    assert rej_res.updated_tier == "rejected"
    assert rej_res.is_negated is True


def test_hybrid_retrieval_chronological_isolation(db_session: Session):
    """Ensures search strictly respects max_prior_chapter_number, blocking future events."""
    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Chronological Isolation Universe")
    db_session.add(project)

    manuscript = models.Manuscript(
        id=models.gen_uuid(),
        project_id=project_id,
        filename="saga.md",
        file_type="md",
        version_number=1,
        is_active_version=True
    )
    db_session.add(manuscript)

    ch1 = models.Chapter(
        id=models.gen_uuid(),
        project_id=project_id,
        manuscript_id=manuscript.id,
        chapter_number=1,
        title="Chapter 1",
        content="General Sterling brandished his ancestral golden blade before the army of Eldoria."
    )
    ch2 = models.Chapter(
        id=models.gen_uuid(),
        project_id=project_id,
        manuscript_id=manuscript.id,
        chapter_number=2,
        title="Chapter 2",
        content="General Sterling had his golden blade shattered during the fall of Blackstone."
    )
    ch3 = models.Chapter(
        id=models.gen_uuid(),
        project_id=project_id,
        manuscript_id=manuscript.id,
        chapter_number=3,
        title="Chapter 3",
        content="General Sterling forged a new titanium rapier to replace his lost golden blade."
    )
    db_session.add_all([ch1, ch2, ch3])
    db_session.commit()

    f1 = models.StoryFact(
        id=models.gen_uuid(),
        project_id=project_id,
        source_chapter_id=ch1.id,
        source_chapter_number=1,
        fact="Sterling wields an ancestral golden blade.",
        source_quote="Sterling brandished his ancestral golden blade.",
        canon_tier="explicit_text",
        is_negated=False
    )
    f2 = models.StoryFact(
        id=models.gen_uuid(),
        project_id=project_id,
        source_chapter_id=ch2.id,
        source_chapter_number=2,
        fact="Sterling's golden blade is shattered.",
        source_quote="Sterling had his golden blade shattered.",
        canon_tier="explicit_text",
        is_negated=False
    )
    f3 = models.StoryFact(
        id=models.gen_uuid(),
        project_id=project_id,
        source_chapter_id=ch3.id,
        source_chapter_number=3,
        fact="Sterling forges a titanium rapier.",
        source_quote="Sterling forged a new titanium rapier.",
        canon_tier="explicit_text",
        is_negated=False
    )
    db_session.add_all([f1, f2, f3])
    db_session.commit()

    # Search with max_prior_chapter_number = 2 (Analyzing Chapter 2: can only see Chapter 1!)
    results_ch2 = hybrid_retrieval_service.search_prior_context(
        db=db_session,
        project_id=project_id,
        query="golden blade",
        max_prior_chapter_number=2
    )

    # Verify that NO candidate comes from Chapter 2 or Chapter 3
    for res in results_ch2:
        assert res["chapter_number"] < 2, f"Leaked future chapter {res['chapter_number']} into earlier context!"

    assert any("ancestral golden blade" in (res["text"] or "") for res in results_ch2)


def test_production_v2_route_health_and_authorization(db_session: Session):
    """Validates /api/v2/production/health and project access control on v2 routes."""
    # 1. Health check works without authentication
    health_out = get_production_system_health(db=db_session)
    assert health_out.status in ("healthy", "degraded")
    assert health_out.encryption_vault["status"] == "healthy"
    assert health_out.operational_mode in ("LEGACY", "SHADOW", "PRODUCTION_V2")

    # 2. Authorization enforcement: unauthenticated access to non-existent or private project
    random_proj = models.gen_uuid()
    with pytest.raises(HTTPException) as exc_info:
        get_pending_canon_reviews(project_id=random_proj, user=None, db=db_session)
    assert exc_info.value.status_code == 404


def test_vault_fail_closed_on_invalid_keys():
    """Verifies that Vault fails closed and rejects empty or invalid keys."""
    # 1. Empty key must raise VaultConfigurationError
    with pytest.raises(VaultConfigurationError):
        VaultKeyManager._normalize_key("")

    with pytest.raises(VaultConfigurationError):
        VaultKeyManager._normalize_key("   ")

    # 2. Invalid length key (< 32 bytes and != 64 hex) must raise VaultConfigurationError
    with pytest.raises(VaultConfigurationError):
        VaultKeyManager._normalize_key("short_secret_key_123")

    # 3. Valid 32-byte key succeeds
    valid_32 = "a" * 32
    norm = VaultKeyManager._normalize_key(valid_32)
    assert len(norm) == 32
    assert norm == b"a" * 32

    # 4. Valid 64-hex key succeeds
    valid_64_hex = "f" * 64
    norm_hex = VaultKeyManager._normalize_key(valid_64_hex)
    assert len(norm_hex) == 32
    assert norm_hex == bytes.fromhex(valid_64_hex)


def test_atomic_manuscript_version_lifecycle(db_session: Session):
    """
    Validates the UPLOADED -> PROCESSING -> READY -> ATOMIC_ACTIVATION lifecycle:
    Prior version remains active during processing and on failure;
    promoted to active only upon 100% completion.
    """
    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Atomic Chronicles", description="Testing atomic activation")
    db_session.add(project)
    db_session.commit()

    # Step 1: Establish initial active Version 1
    m1 = models.Manuscript(
        id=models.gen_uuid(),
        project_id=project_id,
        filename="draft_v1.txt",
        file_type="txt",
        version_number=1,
        status="processed",
        is_active_version=True,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(m1)
    db_session.commit()

    # Step 2: Prepare pending Version 2 (must NOT supersede Version 1)
    pending_m2, ver2_num = version_activation_service.prepare_pending_version(
        db=db_session,
        project_id=project_id,
        filename="draft_v2.txt",
        file_type="txt",
        vault_path="/tmp/fake_vault_v2.vault"
    )
    assert ver2_num == 2
    assert pending_m2.is_active_version is False
    assert pending_m2.status == "processing"

    # Verify Version 1 is STILL active
    db_session.refresh(m1)
    assert m1.is_active_version is True
    assert m1.superseded_at is None

    # Step 3: Simulate failure during processing of Version 2
    version_activation_service.mark_version_failed(db_session, str(pending_m2.id), "Simulated parser error")
    db_session.refresh(pending_m2)
    db_session.refresh(m1)
    assert pending_m2.status == "error"
    assert pending_m2.is_active_version is False
    # Version 1 MUST remain active!
    assert m1.is_active_version is True

    # Step 4: Prepare pending Version 3 and atomically promote it
    pending_m3, ver3_num = version_activation_service.prepare_pending_version(
        db=db_session,
        project_id=project_id,
        filename="draft_v3.txt",
        file_type="txt",
        vault_path="/tmp/fake_vault_v3.vault"
    )
    assert ver3_num == 3
    assert pending_m3.is_active_version is False

    # Promote Version 3 atomically
    activated_m3 = version_activation_service.activate_version_atomically(db_session, str(pending_m3.id))
    db_session.refresh(m1)

    assert activated_m3.is_active_version is True
    assert activated_m3.status == "processed"
    # Version 1 is now atomically superseded
    assert m1.is_active_version is False
    assert m1.superseded_at is not None


def test_real_pipeline_coordinator_execution(db_session: Session, monkeypatch: pytest.MonkeyPatch):
    """
    Executes the real 14-stage ProductionPipelineCoordinator.
    Verifies chapters, passages, entity extraction, identity resolution,
    temporal memory, and atomic activation.
    """
    # Isolate tests from external Gemini network timeouts by routing to deterministic extraction
    monkeypatch.setattr("app.services.ai_provider.ai_provider.generate_json", lambda *a, **k: None)

    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Pipeline Project", description="Testing full coordinator")
    db_session.add(project)
    db_session.commit()

    sample_manuscript = (
        "Chapter 1: The Gathering\n\n"
        "Commander Katherine Vance surveyed the fortress walls. She held the Obsidian Compass tightly. "
        "Her loyal lieutenant Marcus stood nearby.\n\n"
        "Chapter 2: The Ambush\n\n"
        "Marcus shouted a warning as arrows rained from the trees. Katherine drew her blade. "
        "During the skirmish, Katherine lost her Obsidian Compass in the raging river."
    ).encode("utf-8")

    # 1. Prepare pending version
    pending_m, ver_num = version_activation_service.prepare_pending_version(
        db=db_session,
        project_id=project_id,
        filename="chronicles.txt",
        file_type="txt",
        vault_path=f"storage/private_vault/{project_id}_test.vault",
        file_size=len(sample_manuscript)
    )

    job = durable_job_service.create_job(
        db=db_session,
        project_id=project_id,
        manuscript_id=str(pending_m.id),
        job_type="test_pipeline"
    )

    # 2. Execute coordinator
    result = production_pipeline_coordinator.execute_pipeline(
        db=db_session,
        project_id=project_id,
        manuscript_id=str(pending_m.id),
        job_id=str(job.id),
        file_bytes=sample_manuscript,
        file_ext="txt",
        vault_file_path=pending_m.storage_path
    )

    assert result["status"] == "completed"
    assert result["chapters_count"] == 2
    assert result["passages_count"] >= 2
    assert result["entities_count"] >= 1

    # 3. Verify manuscript was promoted to active
    db_session.refresh(pending_m)
    assert pending_m.is_active_version is True
    assert pending_m.status == "processed"

    # 4. Verify job is marked completed
    job_status = durable_job_service.get_job_status(db_session, str(job.id))
    assert job_status.status == "completed"
    assert job_status.current_stage == ProcessingStage.STAGE_14_COMPLETED


def test_job_and_canon_authorization_enforcement(db_session: Session):
    """
    Verifies server-side tenant authorization on /jobs/{job_id}, /jobs/{job_id}/retry,
    and /canon/review with audit logging.
    """
    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Secure Vault", description="Auth testing")
    db_session.add(project)
    db_session.commit()

    # Create manuscript for foreign key
    ms = models.Manuscript(
        id=models.gen_uuid(),
        project_id=project_id,
        filename="auth_doc.txt",
        file_type="txt",
        version_number=1
    )
    db_session.add(ms)
    db_session.commit()

    # Create job under project
    job = durable_job_service.create_job(
        db=db_session,
        project_id=project_id,
        manuscript_id=str(ms.id),
        job_type="auth_test"
    )

    # 1. Querying non-existent job returns 404
    with pytest.raises(HTTPException) as exc:
        get_durable_job_status(job_id=models.gen_uuid(), user=None, db=db_session)
    assert exc.value.status_code == 404

    # 2. Retrying non-existent job returns 404
    with pytest.raises(HTTPException) as exc:
        retry_failed_job(job_id=models.gen_uuid(), user=None, db=db_session)
    assert exc.value.status_code == 404

    # 3. Canon review authorization directly via fact.project_id
    user = models.User(id=models.gen_uuid(), email=f"author_{models.gen_uuid()[:8]}@test.com", hashed_password="pw", full_name="Author Auth")
    db_session.add(user)
    project.owner_id = user.id
    db_session.commit()

    fact = models.StoryFact(
        id=models.gen_uuid(),
        project_id=project_id,
        entity_id=None,  # No entity, authorization must NOT be bypassed
        fact="The ancient fortress was built of black glass.",
        source_quote="The fortress stood forged of black glass.",
        canon_tier="proposed"
    )
    db_session.add(fact)
    db_session.commit()

    review_req = CanonReviewRequest(
        fact_id=str(fact.id),
        action="confirm"
    )

    # 3a. Unauthenticated review decision must fail with 401
    with pytest.raises(HTTPException) as unauth_exc:
        submit_canon_review_decision(
            request=review_req,
            user=None,
            db=db_session
        )
    assert unauth_exc.value.status_code == 401

    # 3b. Authenticated project owner succeeds
    review_resp = submit_canon_review_decision(
        request=review_req,
        user=user,
        db=db_session
    )
    assert review_resp.updated_tier == "author_confirmed"
    assert "confirmed" in review_resp.message.lower()

    # Verify audit log was created
    audit = db_session.query(models.AuditLog).filter(
        models.AuditLog.project_id == project_id
    ).first()
    assert audit is not None
    assert audit.action == "canon_review_confirm"


def test_durable_task_worker_recovery(db_session: Session):
    """Verifies that DurableTaskWorker detects and recovers stalled jobs after worker restarts."""
    project_id = models.gen_uuid()
    project = models.Project(id=project_id, name="Worker Project", description="Testing worker")
    db_session.add(project)
    db_session.commit()

    # Create manuscript for foreign key
    ms = models.Manuscript(
        id=models.gen_uuid(),
        project_id=project_id,
        filename="worker_doc.txt",
        file_type="txt",
        version_number=1
    )
    db_session.add(ms)
    db_session.commit()

    # Create job that stalled in 'processing' 10 minutes ago via durable_job_service
    stalled_job = durable_job_service.create_job(
        db=db_session,
        project_id=project_id,
        manuscript_id=str(ms.id),
        job_type="stalled_ingest"
    )
    stalled_job.status = "processing"
    stalled_job.current_stage = "STAGE_5_RESOLVING_IDENTITIES"
    stalled_job.updated_at = datetime.now(timezone.utc) - timedelta(minutes=10)
    db_session.commit()

    # Run recovery
    recovered_count = task_worker.recover_stalled_jobs(db=db_session, stall_timeout_seconds=300)
    assert recovered_count >= 1

    db_session.refresh(stalled_job)
    assert stalled_job.status == "queued"
    assert stalled_job.meta_info.get("recovered_from_crash") is True

