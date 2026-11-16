import re
import logging
from typing import Dict, Any, List, Optional
from app.services.ai_provider import ai_provider
from app.services.identity_service import identity_service

logger = logging.getLogger("timeline_agent")

class TimelineAgent:
    """
    Advanced Timeline & Temporal Reasoning Agent in NorthStar.
    Extracts chronological events, calendar markers, relative sequences,
    flashbacks, and character locations. Separates narrative chronology from chapter order.
    """

    SYSTEM_PROMPT = """
You are the Timeline Intelligence Agent in NorthStar.
Extract ordered chronological events, calendar dates, relative time elapsed, and character locations.
Differentiate narrative flashbacks (events occurring in the past) from current chapter chronology.
"""

    def extract_events_from_chapter(
        self,
        chapter_content: str,
        chapter_number: int,
        chapter_title: str
    ) -> List[Dict[str, Any]]:
        """
        Extracts chronological events, calendar markers, locations, and participants dynamically.
        Detects flashbacks and calculates true chronological ordering separate from chapter order.
        """
        markers = self.extract_temporal_markers(chapter_content)
        date_labels = self.extract_explicit_dates(chapter_content)

        date_label = date_labels[0] if date_labels else (markers[0] if markers else f"Chapter {chapter_number}")

        # Extract dynamic characters and locations from chapter
        entities = identity_service.extract_named_entities(chapter_content, chapter_number=chapter_number)
        chars = [e["name"] for e in entities if e.get("entity_type") == "character"]
        locations = [e["name"] for e in entities if e.get("entity_type") == "location"]
        location = locations[0] if locations else None

        # Check for Flashback / Flash-forward context to decouple chronology from chapter order
        chronology_order = chapter_number * 10  # Base scale allowing interleaving
        s_low = chapter_content.lower()

        # Flashback / Historical events detection
        if any(term in s_low for term in ["twelve years earlier", "ten years ago", "years earlier", "in his youth", "in her youth", "years ago", "decades ago", "before the war"]):
            # Chronologically precedes chapter 1
            chronology_order = max(1, (chapter_number * 10) - 50)
        elif any(term in s_low for term in ["months earlier", "weeks earlier", "days earlier", "the previous year"]):
            chronology_order = max(1, (chapter_number * 10) - 15)
        elif any(term in s_low for term in ["ten years later", "years later", "flash forward", "decades later"]):
            chronology_order = (chapter_number * 10) + 100

        events = []
        events.append({
            "title": f"Chronicle: {chapter_title}",
            "description": f"Narrative events and character actions in {chapter_title} (Chapter {chapter_number}).",
            "chapter_number": chapter_number,
            "chronology_order": chronology_order,
            "date_or_time_label": date_label,
            "location": location,
            "participants": chars[:6]
        })

        # Scene-specific micro-events
        scene_markers = re.findall(
            r'(?:At\s+\d{1,2}:\d{2}|At\s+dawn|At\s+dusk|At\s+midnight|Two\s+days\s+later|Three\s+days\s+later|The\s+following\s+morning)[^.!?]*[.!?]',
            chapter_content,
            re.IGNORECASE
        )
        for s_idx, sm in enumerate(scene_markers[:3]):
            clean_sm = sm.strip()
            events.append({
                "title": clean_sm[:50] + ("..." if len(clean_sm) > 50 else ""),
                "description": clean_sm,
                "chapter_number": chapter_number,
                "chronology_order": chronology_order + s_idx + 1,
                "date_or_time_label": clean_sm.split()[0] + " " + (clean_sm.split()[1] if len(clean_sm.split()) > 1 else ""),
                "location": location,
                "participants": chars[:4]
            })

        return events

    def extract_temporal_markers(self, text: str) -> List[str]:
        """
        Identifies time references (e.g. 'Three years later', 'At dawn', '04:15').
        """
        patterns = [
            r'\b(?:at\s+\d{1,2}:\d{2}|at dawn|at dusk|in the dead of night|months after|years later|before the battle|following the siege|twelve years earlier|years ago)\b',
            r'\b(?:day \d+|year \d+|era \d+|cycle \d+)\b'
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
        Validates chronological order and flags impossible chronological inversions.
        """
        anomalies = []
        for i in range(len(timeline_events) - 1):
            curr = timeline_events[i]
            nxt = timeline_events[i + 1]
            if curr.get("chronology_order", 0) > nxt.get("chronology_order", 0):
                anomalies.append({
                    "issue_type": "timeline_inconsistency",
                    "explanation": f"Chronological inversion: '{curr.get('title')}' is ordered before '{nxt.get('title')}' despite having an earlier temporal position."
                })
        return anomalies

timeline_agent = TimelineAgent()
