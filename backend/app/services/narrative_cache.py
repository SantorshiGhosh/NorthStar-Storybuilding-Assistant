import hashlib
import json
import logging
import threading
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta

logger = logging.getLogger("narrative_cache")

class NarrativeCacheService:
    """
    Project-isolated, version-aware, content-hash caching service for chapter extraction
    and continuity verification results. Eliminates redundant AI calls and repeated NLP passes
    when manuscripts or chapters are re-uploaded with identical or unchanged text.
    """

    def __init__(self, max_entries_per_project: int = 500, ttl_hours: int = 72):
        self._lock = threading.RLock()
        self._cache: Dict[str, Dict[str, Any]] = {}  # {project_id: {cache_key: (data, expiry)}}
        self._max_entries = max_entries_per_project
        self._ttl = timedelta(hours=ttl_hours)

    def compute_content_hash(self, text: str) -> str:
        """
        Computes SHA-256 fingerprint for text content, normalized for whitespace.
        """
        normalized = " ".join(str(text or "").split())
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def get_cached_extraction(self, project_id: str, chapter_hash: str, mode: str = "deep") -> Optional[Dict[str, Any]]:
        """
        Retrieves cached extraction result for a specific chapter content hash in a project.
        Guarantees strict project isolation and mode isolation (fast vs deep).
        """
        key = f"ext:{mode}:{chapter_hash}"
        with self._lock:
            proj_cache = self._cache.get(str(project_id))
            if not proj_cache:
                return None
            item = proj_cache.get(key)
            if not item:
                return None
            data, expiry = item
            if datetime.utcnow() > expiry:
                proj_cache.pop(key, None)
                return None
            # Return deepcopy or deserialized copy to prevent in-place mutation
            return json.loads(json.dumps(data))

    def cache_extraction(self, project_id: str, chapter_hash: str, data: Dict[str, Any], mode: str = "deep") -> None:
        """
        Stores chapter extraction result under project-isolated cache.
        """
        key = f"ext:{mode}:{chapter_hash}"
        expiry = datetime.utcnow() + self._ttl
        with self._lock:
            if str(project_id) not in self._cache:
                self._cache[str(project_id)] = {}
            proj_cache = self._cache[str(project_id)]
            # Prune if too large
            if len(proj_cache) >= self._max_entries:
                oldest_key = next(iter(proj_cache))
                proj_cache.pop(oldest_key, None)
            proj_cache[key] = (json.loads(json.dumps(data)), expiry)

    def get_cached_continuity(
        self,
        project_id: str,
        chapter_hash: str,
        prior_canon_hash: str,
        skip_llm: bool = False
    ) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieves cached continuity issues for a chapter given its content and prior canon hash.
        """
        mode = "fast" if skip_llm else "deep"
        key = f"cont:{mode}:{chapter_hash}:{prior_canon_hash}"
        with self._lock:
            proj_cache = self._cache.get(str(project_id))
            if not proj_cache:
                return None
            item = proj_cache.get(key)
            if not item:
                return None
            data, expiry = item
            if datetime.utcnow() > expiry:
                proj_cache.pop(key, None)
                return None
            return json.loads(json.dumps(data))

    def cache_continuity(
        self,
        project_id: str,
        chapter_hash: str,
        prior_canon_hash: str,
        issues: List[Dict[str, Any]],
        skip_llm: bool = False
    ) -> None:
        """
        Stores verified continuity issues in cache.
        """
        mode = "fast" if skip_llm else "deep"
        key = f"cont:{mode}:{chapter_hash}:{prior_canon_hash}"
        expiry = datetime.utcnow() + self._ttl
        with self._lock:
            if str(project_id) not in self._cache:
                self._cache[str(project_id)] = {}
            proj_cache = self._cache[str(project_id)]
            if len(proj_cache) >= self._max_entries:
                oldest_key = next(iter(proj_cache))
                proj_cache.pop(oldest_key, None)
            proj_cache[key] = (json.loads(json.dumps(issues)), expiry)

    def clear_project_cache(self, project_id: str) -> None:
        """
        Clears all cached entries for a project.
        """
        with self._lock:
            self._cache.pop(str(project_id), None)

narrative_cache = NarrativeCacheService()
