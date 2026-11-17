import json
import asyncio
import logging
import threading
from typing import Dict, Any, Optional, Set, List, AsyncGenerator
from datetime import datetime

logger = logging.getLogger("event_stream")

class EventStreamService:
    """
    Thread-safe, project-isolated Server-Sent Events (SSE) event distribution system.
    Supports:
      - Project-specific event routing.
      - Monotonically increasing event sequence numbers.
      - Sliding-window replay buffer for seamless reconnection recovery (via Last-Event-ID).
      - Thread-safe publishing from background threads or workers.
      - Heartbeat ping to prevent reverse-proxy timeouts.
    """

    def __init__(self, max_buffer_size: int = 100, replay_buffer_size: Optional[int] = None):
        self._lock = threading.RLock()
        self._listeners: Dict[str, Set[asyncio.Queue]] = {}  # {project_id: set(queues)}
        self._replay_buffers: Dict[str, List[Dict[str, Any]]] = {}  # {project_id: list of events}
        self._seq_counters: Dict[str, int] = {}  # {project_id: current_seq}
        self._max_buffer_size = replay_buffer_size if replay_buffer_size is not None else max_buffer_size

    def get_replay_events(self, project_id: str, last_event_id: int) -> List[Dict[str, Any]]:
        """
        Retrieves buffered events with sequence numbers strictly greater than last_event_id.
        """
        pid = str(project_id)
        with self._lock:
            if pid not in self._replay_buffers:
                return []
            return [
                ev for ev in self._replay_buffers[pid]
                if ev.get("seq", 0) > int(last_event_id)
            ]

    def publish_event(
        self,
        project_id: str,
        event_type: str,
        data: Dict[str, Any],
        job_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Publishes a typed event to all active SSE subscribers for the given project.
        Safe to call from synchronous background worker threads.
        """
        pid = str(project_id)
        with self._lock:
            cur_seq = self._seq_counters.get(pid, 0) + 1
            self._seq_counters[pid] = cur_seq

            event_payload = {
                "seq": cur_seq,
                "event_type": event_type,
                "project_id": pid,
                "job_id": str(job_id) if job_id else None,
                "timestamp": datetime.utcnow().isoformat(),
                "data": data
            }

            # Add to replay buffer
            if pid not in self._replay_buffers:
                self._replay_buffers[pid] = []
            buf = self._replay_buffers[pid]
            buf.append(event_payload)
            if len(buf) > self._max_buffer_size:
                buf.pop(0)

            # Copy active listener queues
            queues = list(self._listeners.get(pid, set()))

        # Distribute to listener queues thread-safely
        for q in queues:
            try:
                loop = getattr(q, "_loop", None)
                if loop and loop.is_running():
                    loop.call_soon_threadsafe(q.put_nowait, event_payload)
                else:
                    q.put_nowait(event_payload)
            except Exception as e:
                logger.debug(f"Queue delivery notice for project {pid}: {e}")

        return event_payload

    async def subscribe(
        self,
        project_id: str,
        last_event_id: Optional[int] = None
    ) -> AsyncGenerator[str, None]:
        """
        Async generator yielding SSE formatted messages for a specific project.
        Replays missed events if last_event_id is provided.
        """
        pid = str(project_id)
        queue: asyncio.Queue = asyncio.Queue()

        with self._lock:
            if pid not in self._listeners:
                self._listeners[pid] = set()
            self._listeners[pid].add(queue)

            # Replay missed events if requested
            missed_events = []
            if last_event_id is not None and pid in self._replay_buffers:
                missed_events = [
                    ev for ev in self._replay_buffers[pid]
                    if ev["seq"] > int(last_event_id)
                ]

        try:
            # First send replayed events
            for ev in missed_events:
                yield self._format_sse(ev)

            # Then continuously stream live events or heartbeat
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield self._format_sse(event)
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep connection alive
                    yield ": ping\n\n"
        finally:
            with self._lock:
                if pid in self._listeners and queue in self._listeners[pid]:
                    self._listeners[pid].remove(queue)
                    if not self._listeners[pid]:
                        self._listeners.pop(pid, None)

    def _format_sse(self, event: Dict[str, Any]) -> str:
        seq = event.get("seq", 0)
        etype = event.get("event_type", "message")
        payload = json.dumps(event)
        return f"id: {seq}\nevent: {etype}\ndata: {payload}\n\n"

    def clear_project_events(self, project_id: str) -> None:
        """
        Clears buffers for a project.
        """
        pid = str(project_id)
        with self._lock:
            self._replay_buffers.pop(pid, None)
            self._seq_counters.pop(pid, None)

event_stream_service = EventStreamService()
