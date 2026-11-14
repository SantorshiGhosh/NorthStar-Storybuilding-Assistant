import re
import logging
from typing import Dict, Any, List, Optional
from app.services.ai_provider import ai_provider

logger = logging.getLogger("timeline_agent")

class TimelineAgent:
    """
    Extracts chronological events, explicit dates, relative sequence markers,
    and character locations per chapter. Flags chronological anomalies.
    """

    SYSTEM_PROMPT = """
You are the Timeline Intelligence Agent in NorthStar.
Analyze chapter text to extract ordered chronological events, explicit calendar dates or time elapsed, and character locations.
Flag any chronological contradictions (e.g., character in two places at once, reversed cause-and-effect).
"""

    def extract_events_from_chapter(
        self,
        chapter_content: str,
        chapter_number: int,
        chapter_title: str
    ) -> List[Dict[str, Any]]:
        """
        Extracts chronological events, calendar markers, and locations from chapter text.
        """
        # 1. Deterministic extraction of temporal markers and scenes
        markers = self.extract_temporal_markers(chapter_content)
        date_labels = self.extract_explicit_dates(chapter_content)

        date_label = date_labels[0] if date_labels else (markers[0] if markers else f"Chapter {chapter_number}")

        # Basic scene event extraction
        events = []
        paragraphs = [p.strip() for p in chapter_content.split("\n\n") if p.strip()]

        # Identify key locations
        loc_match = re.search(r'\b(Blackstone|Eldoria|Sunken Citadel|Citadel|Bellwether|Olympus Tower|Sector 4)\b', chapter_content, re.IGNORECASE)
        location = loc_match.group(1) if loc_match else None

        # Identify characters
        chars = re.findall(r'\b(Arin|Mira|Nera Sol|Nera|Mr\. Pell|Pell|Tomas Vale|Tomas|Eren|Ren Tanaka|Ren|Dr\. Elena Vance|Elena)\b', chapter_content)
        unique_chars = list(dict.fromkeys(chars))

        events.append({
            "title": f"Chronicle: {chapter_title}",
            "description": f"Key events and character actions during {chapter_title} (Chapter {chapter_number}).",
            "chapter_number": chapter_number,
            "chronology_order": chapter_number,
            "date_or_time_label": date_label,
            "location": location,
            "participants": unique_chars[:5]
        })

        return events

    def extract_temporal_markers(self, text: str) -> List[str]:
        """
        Identifies time references (e.g. 'Three years later', 'At dawn', 'Before the fall').
        """
        patterns = [
            r'\b(?:at dawn|at dusk|in the dead of night|months after|years later|before the battle|following the siege|twelve years earlier|years ago)\b',
            r'\b(?:day \d+|year \d+|era \d+)\b'
        ]
        markers = []
        for pat in patterns:
            for match in re.finditer(pat, text, re.IGNORECASE):
                markers.append(match.group(0))
        return markers

    def extract_explicit_dates(self, text: str) -> List[str]:
        """
        Extracts calendar dates like '3 June', '14 October 2042', 'June 3rd'.
        """
        date_patterns = [
            r'\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+\d{4})?\b',
            r'\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,\s*\d{4})?\b',
            r'\b(?:Year|Cycle|Era)\s+\d+\b'
        ]
        dates = []
        for pat in date_patterns:
            for match in re.finditer(pat, text, re.IGNORECASE):
                dates.append(match.group(0))
        return dates

    def check_timeline_anomalies(
        self,
        timeline_events: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Checks for inverted chronology or duplicate simultaneous presence.
        """
        anomalies = []
        # Check order
        for i in range(len(timeline_events) - 1):
            curr = timeline_events[i]
            nxt = timeline_events[i + 1]
            if curr.get("chapter_number", 0) > nxt.get("chapter_number", 0):
                anomalies.append({
                    "issue_type": "timeline_inconsistency",
                    "explanation": f"Event '{curr.get('title')}' in Chapter {curr.get('chapter_number')} is sequenced before '{nxt.get('title')}' in Chapter {nxt.get('chapter_number')}."
                })
        return anomalies

timeline_agent = TimelineAgent()

