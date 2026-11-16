"""
Narrative Context Builder Service
Constructs bounded, chronologically isolated narrative context for candidate mentions:
- Sentence containing the mention
- Preceding and following sentences (sliding 3-sentence window)
- Surrounding paragraph
- Earlier mentions within the same chapter
- Established prior facts and entity profiles (strictly from Chapter 1 through Chapter N)
- Guaranteed zero future-chapter contamination.
"""
import re
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from sqlalchemy.orm import Session

from app.database import models


@dataclass
class MentionContext:
    target_span: str
    sentence: str
    preceding_sentence: str = ""
    following_sentence: str = ""
    three_sentence_window: str = ""
    paragraph: str = ""
    char_start: int = -1
    char_end: int = -1
    chapter_number: int = 1
    earlier_chapter_mentions: List[str] = field(default_factory=list)
    prior_canon_facts: List[str] = field(default_factory=list)
    analysis_mode: str = "chronological"  # 'chronological' or 'retrospective'


class NarrativeContextBuilder:
    """
    Builds bounded contextual windows around text spans while enforcing strict chronological isolation.
    """

    def __init__(self):
        # Sentence splitting pattern that preserves abbreviations
        self._sentence_regex = re.compile(r'(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|!)\s+')
        self._paragraph_regex = re.compile(r'\n\s*\n')

    def split_sentences_with_offsets(self, text: str) -> List[Tuple[str, int, int]]:
        """Returns list of (sentence_text, start_offset, end_offset)."""
        sentences = []
        start = 0
        raw_sents = self._sentence_regex.split(text)
        for s in raw_sents:
            s_clean = s.strip()
            if not s_clean:
                continue
            idx = text.find(s_clean, start)
            if idx == -1:
                idx = start
            end = idx + len(s_clean)
            sentences.append((s_clean, idx, end))
            start = end
        return sentences

    def build_mention_context(
        self,
        chapter_content: str,
        target_span: str,
        chapter_number: int,
        preferred_offset: Optional[int] = None,
        db: Optional[Session] = None,
        project_id: Optional[str] = None,
        retrospective_mode: bool = False
    ) -> MentionContext:
        """
        Builds a comprehensive, bounded MentionContext for a candidate mention.
        Strictly observes chronological isolation: if retrospective_mode is False,
        never pulls facts or events from chapter > chapter_number.
        """
        content = chapter_content or ""
        span = (target_span or "").strip()
        sentences = self.split_sentences_with_offsets(content)

        # 1. Locate the target sentence and exact offsets
        target_sent_idx = -1
        actual_start = -1
        actual_end = -1

        if preferred_offset is not None and preferred_offset >= 0:
            for idx, (s_text, s_start, s_end) in enumerate(sentences):
                if s_start <= preferred_offset < s_end:
                    target_sent_idx = idx
                    actual_start = preferred_offset
                    actual_end = preferred_offset + len(span)
                    break

        if target_sent_idx == -1 and span:
            # Search for the span in sentences
            pattern = re.compile(rf'\b{re.escape(span)}\b', re.IGNORECASE)
            for idx, (s_text, s_start, s_end) in enumerate(sentences):
                m = pattern.search(s_text)
                if m:
                    target_sent_idx = idx
                    actual_start = s_start + m.start()
                    actual_end = s_start + m.end()
                    break

        # Fallback if span not found with word boundary
        if target_sent_idx == -1 and span:
            span_lower = span.lower()
            for idx, (s_text, s_start, s_end) in enumerate(sentences):
                pos = s_text.lower().find(span_lower)
                if pos != -1:
                    target_sent_idx = idx
                    actual_start = s_start + pos
                    actual_end = actual_start + len(span)
                    break

        target_sentence = sentences[target_sent_idx][0] if target_sent_idx != -1 else ""
        preceding = sentences[target_sent_idx - 1][0] if target_sent_idx > 0 else ""
        following = sentences[target_sent_idx + 1][0] if target_sent_idx != -1 and target_sent_idx + 1 < len(sentences) else ""

        # Three-sentence sliding window
        window_parts = [p for p in [preceding, target_sentence, following] if p]
        three_sentence_window = " ".join(window_parts)

        # 2. Locate the surrounding paragraph
        paragraph = target_sentence
        if actual_start >= 0:
            paragraphs = self._paragraph_regex.split(content)
            cursor = 0
            for p in paragraphs:
                p_len = len(p)
                p_end = cursor + p_len
                if cursor <= actual_start <= p_end:
                    paragraph = p.strip()
                    break
                cursor = p_end + 2  # account for split whitespace

        # 3. Find earlier mentions in the same chapter
        earlier_mentions = []
        if target_sent_idx > 0 and span:
            span_lower = span.lower()
            for idx in range(target_sent_idx):
                s_prev = sentences[idx][0]
                if span_lower in s_prev.lower():
                    earlier_mentions.append(s_prev)

        # 4. Fetch prior canon facts strictly chronologically (Chapter <= chapter_number)
        prior_facts = []
        if db is not None and project_id:
            fact_query = db.query(models.StoryFact).filter(
                models.StoryFact.project_id == project_id,
                models.StoryFact.is_active == True
            )
            if not retrospective_mode:
                fact_query = fact_query.filter(models.StoryFact.source_chapter_number <= chapter_number)

            db_facts = fact_query.order_by(models.StoryFact.source_chapter_number.asc()).limit(15).all()
            for f in db_facts:
                if span.lower() in f.fact.lower():
                    prior_facts.append(f"Ch.{f.source_chapter_number}: {f.fact}")

        return MentionContext(
            target_span=span,
            sentence=target_sentence,
            preceding_sentence=preceding,
            following_sentence=following,
            three_sentence_window=three_sentence_window,
            paragraph=paragraph,
            char_start=actual_start,
            char_end=actual_end,
            chapter_number=chapter_number,
            earlier_chapter_mentions=earlier_mentions[:5],
            prior_canon_facts=prior_facts,
            analysis_mode="retrospective" if retrospective_mode else "chronological"
        )


narrative_context_builder = NarrativeContextBuilder()
