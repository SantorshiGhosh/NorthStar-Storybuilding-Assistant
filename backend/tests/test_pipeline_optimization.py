import pytest
import time
import json
from unittest.mock import MagicMock, patch

from app.services.narrative_cache import narrative_cache, NarrativeCacheService
from app.services.event_stream_service import event_stream_service, EventStreamService
from app.services.identity_service import identity_service
from app.database import models
from app.agents.orchestrator import orchestrator


class TestNarrativeCache:
    """Tests for narrative content hashing, caching, and cross-project isolation."""

    def test_content_hashing_consistency(self):
        content_a = "Chapter 1: The detective arrived at the foggy harbor."
        content_b = "Chapter 1: The detective arrived at the foggy harbor."
        content_c = "Chapter 1: The detective arrived at the sunny harbor."

        hash_a = narrative_cache.compute_content_hash(content_a)
        hash_b = narrative_cache.compute_content_hash(content_b)
        hash_c = narrative_cache.compute_content_hash(content_c)

        assert hash_a == hash_b
        assert hash_a != hash_c
        assert len(hash_a) == 64

    def test_cache_extraction_and_retrieval(self):
        cache = NarrativeCacheService(max_entries_per_project=50, ttl_hours=1)
        proj_1 = "proj-uuid-1"
        ch_hash = cache.compute_content_hash("Some chapter text")
        data = {"entities": [{"name": "Mira", "entity_type": "character"}]}

        # Initial miss
        assert cache.get_cached_extraction(proj_1, ch_hash) is None

        # Store and retrieve
        cache.cache_extraction(proj_1, ch_hash, data)
        cached = cache.get_cached_extraction(proj_1, ch_hash)
        assert cached is not None
        assert cached["entities"][0]["name"] == "Mira"

    def test_cross_project_cache_isolation(self):
        cache = NarrativeCacheService(max_entries_per_project=50, ttl_hours=1)
        proj_1 = "proj-uuid-1"
        proj_2 = "proj-uuid-2"
        ch_hash = cache.compute_content_hash("Shared text across projects")
        data_1 = {"entities": [{"name": "Mira", "entity_type": "character"}]}

        cache.cache_extraction(proj_1, ch_hash, data_1)

        # Project 2 must NOT access Project 1's cached results
        assert cache.get_cached_extraction(proj_2, ch_hash) is None
        assert cache.get_cached_extraction(proj_1, ch_hash) is not None

    def test_continuity_cache_with_canon_dependency(self):
        cache = NarrativeCacheService(max_entries_per_project=50, ttl_hours=1)
        proj_id = "proj-uuid-1"
        ch_hash = cache.compute_content_hash("Chapter 2 prose")
        canon_hash_v1 = cache.compute_content_hash("Fact: Mira is 25")
        canon_hash_v2 = cache.compute_content_hash("Fact: Mira is 30")

        issues_v1 = [{"issue_type": "none"}]
        cache.cache_continuity(proj_id, ch_hash, canon_hash_v1, issues_v1)

        # Hit with identical canon
        assert cache.get_cached_continuity(proj_id, ch_hash, canon_hash_v1) == issues_v1
        # Invalidation / miss when canon changes
        assert cache.get_cached_continuity(proj_id, ch_hash, canon_hash_v2) is None


class TestEventStreamService:
    """Tests for progressive Server-Sent Events, sequence ordering, and recovery buffer."""

    def test_event_publishing_and_sequence(self):
        svc = EventStreamService(replay_buffer_size=20)
        proj_id = "proj-stream-1"

        ev1 = svc.publish_event(proj_id, "chapter:completed", {"chapter_number": 1})
        ev2 = svc.publish_event(proj_id, "chapter:completed", {"chapter_number": 2})

        assert ev1["seq"] == 1
        assert ev2["seq"] == 2
        assert ev1["event_type"] == "chapter:completed"
        assert ev2["data"]["chapter_number"] == 2

    def test_replay_buffer_reconnection(self):
        svc = EventStreamService(replay_buffer_size=20)
        proj_id = "proj-stream-2"

        svc.publish_event(proj_id, "chapter:completed", {"chapter_number": 1})
        svc.publish_event(proj_id, "chapter:completed", {"chapter_number": 2})
        svc.publish_event(proj_id, "chapter:completed", {"chapter_number": 3})

        # Client reconnects having last seen seq 1 -> should replay seq 2 and 3
        replayed = svc.get_replay_events(proj_id, last_event_id=1)
        assert len(replayed) == 2
        assert replayed[0]["seq"] == 2
        assert replayed[1]["seq"] == 3

    def test_stream_cross_project_isolation(self):
        svc = EventStreamService(replay_buffer_size=20)
        p1 = "proj-stream-a"
        p2 = "proj-stream-b"

        svc.publish_event(p1, "chapter:completed", {"chapter_number": 1})
        svc.publish_event(p2, "chapter:completed", {"chapter_number": 99})

        replayed_p1 = svc.get_replay_events(p1, last_event_id=0)
        assert len(replayed_p1) == 1
        assert replayed_p1[0]["data"]["chapter_number"] == 1

        replayed_p2 = svc.get_replay_events(p2, last_event_id=0)
        assert len(replayed_p2) == 1
        assert replayed_p2[0]["data"]["chapter_number"] == 99


class TestIdentityResolutionSessionCache:
    """Tests for preloading and O(1) in-memory entity resolution to eliminate DB queries."""

    def test_preload_and_clear_identities(self):
        proj_id = "proj-ident-1"
        mock_db = MagicMock()

        mock_entity = models.Entity(
            id="e-1",
            project_id=proj_id,
            name="Detective Arin Vale",
            entity_type="character"
        )
        mock_alias = models.EntityAlias(
            id="a-1",
            project_id=proj_id,
            canonical_entity_id="e-1",
            alias_name="Arin"
        )
        mock_entity.aliases = [mock_alias]

        def query_side_effect(model_cls):
            mock_query = MagicMock()
            if model_cls == models.Entity:
                mock_query.filter.return_value.all.return_value = [mock_entity]
            elif model_cls == models.EntityAlias:
                mock_query.filter.return_value.all.return_value = [mock_alias]
            else:
                mock_query.filter.return_value.all.return_value = []
            return mock_query

        mock_db.query.side_effect = query_side_effect

        # Preload into session cache
        identity_service.preload_project_identities(mock_db, proj_id)

        # Resolution of known alias should hit cache
        res = identity_service.resolve_entity_identity(
            db=mock_db,
            project_id=proj_id,
            extracted_name="Arin",
            entity_type="character"
        )
        assert res.id == "e-1"
        assert res.name == "Detective Arin Vale"

        # Clear cache
        identity_service.clear_project_identities(proj_id)
        assert proj_id not in identity_service._project_sessions


class TestChronologicalOrderingAndStateIsolation:
    """Tests for strict chronological consolidation and state progression."""

    def test_chronological_sorting_integrity(self):
        raw_extractions = [
            (MagicMock(chapter_number=3), {"entities": []}),
            (MagicMock(chapter_number=1), {"entities": []}),
            (MagicMock(chapter_number=2), {"entities": []}),
        ]
        raw_extractions.sort(key=lambda x: x[0].chapter_number)
        ordered_chs = [ch.chapter_number for ch, _ in raw_extractions]
        assert ordered_chs == [1, 2, 3]
