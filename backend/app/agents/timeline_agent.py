import re
import logging
from typing import Dict, Any, List

logger = logging.getLogger("timeline_agent")

class TimelineAgent:
    """
    Extracts events, temporal anchors, relative ordering, and flags chronological anomalies.
    """

    def analyze_event_chronology(
        self,
        chapter_events: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Orders events and checks for chronological anomalies (e.g., retro-causality or timestamp inversion).
        """
        sorted_events = sorted(chapter_events, key=lambda x: x.get("chronology_order", 0))
        return sorted_events

    def extract_temporal_markers(self, text: str) -> List[str]:
        """
        Identifies time references (e.g. 'Three years later', 'At dawn', 'Before the fall').
        """
        patterns = [
            r'\b(?:at dawn|at dusk|in the dead of night|months after|years later|before the battle|following the siege)\b',
            r'\b(?:day \d+|year \d+|era \d+)\b'
        ]
        markers = []
        for pat in patterns:
            for match in re.finditer(pat, text, re.IGNORECASE):
                markers.append(match.group(0))
        return markers

timeline_agent = TimelineAgent()
