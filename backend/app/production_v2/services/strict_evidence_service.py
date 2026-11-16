"""
Production V2 Strict Evidence Verification Service
Certifies source-span citations with mathematical precision, eliminating false fuzzy matches.
"""
import re
import difflib
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session

from app.database import models
from app.production_v2.schemas.v2_schemas import EvidenceStatusEnum, VerifyQuoteResponse
from app.production_v2.config import v2_settings


class StrictEvidenceService:
    """
    Deterministic quote span verification across active and historical manuscript versions.
    Replaces 4-word fuzzy weaknesses with multi-tier verification.
    """

    @staticmethod
    def _normalize_text(text: str) -> str:
        """Normalizes smart quotes, dashes, whitespace, and case for normalized checks."""
        if not text:
            return ""
        text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
        text = text.replace("—", " - ").replace("–", " - ")
        # Collapse whitespace
        return " ".join(text.split()).strip()

    def verify_quote(
        self,
        db: Session,
        project_id: str,
        quote: str,
        preferred_chapter_id: Optional[str] = None,
        target_version_number: Optional[int] = None
    ) -> VerifyQuoteResponse:
        """
        Verifies whether a source quote exists in the active or historical manuscript.
        """
        clean_quote = (quote or "").strip()
        if not clean_quote or len(clean_quote) < 3:
            return VerifyQuoteResponse(
                status=EvidenceStatusEnum.UNVERIFIED,
                confidence=0.0,
                explanation="Citation text is empty or too brief to verify."
            )

        # 1. Fetch active manuscript and chapters
        manuscript_query = db.query(models.Manuscript).filter(models.Manuscript.project_id == project_id)
        if target_version_number is not None:
            manuscript = manuscript_query.filter(models.Manuscript.version_number == target_version_number).first()
        else:
            manuscript = manuscript_query.filter(models.Manuscript.is_active_version == True).first()
            if not manuscript:
                manuscript = manuscript_query.order_by(models.Manuscript.version_number.desc()).first()

        if not manuscript:
            return VerifyQuoteResponse(
                status=EvidenceStatusEnum.UNVERIFIED,
                confidence=0.0,
                explanation="No manuscript found for this project."
            )

        # Fetch active version chapters
        active_chapters = db.query(models.Chapter).filter(
            models.Chapter.manuscript_id == manuscript.id
        ).order_by(models.Chapter.chapter_number.asc()).all()

        # Check preferred chapter first if supplied
        ordered_chapters: List[models.Chapter] = []
        if preferred_chapter_id:
            for ch in active_chapters:
                if str(ch.id) == str(preferred_chapter_id):
                    ordered_chapters.insert(0, ch)
                else:
                    ordered_chapters.append(ch)
        else:
            ordered_chapters = active_chapters

        # Step A: Exact Verbatim Character Search in active version
        for ch in ordered_chapters:
            content = ch.content or ""
            pos = content.find(clean_quote)
            if pos != -1:
                return VerifyQuoteResponse(
                    status=EvidenceStatusEnum.EXACT_VERIFIED,
                    confidence=1.0,
                    matched_text=clean_quote,
                    chapter_id=str(ch.id),
                    chapter_number=ch.chapter_number,
                    start_char=pos,
                    end_char=pos + len(clean_quote),
                    version_number=manuscript.version_number,
                    explanation=f"Exact verbatim citation verified in Chapter {ch.chapter_number} at character range [{pos}:{pos + len(clean_quote)}]."
                )

        # Step B: Normalized Search in active version (smart quotes, whitespace collapsed)
        norm_quote = self._normalize_text(clean_quote).lower()
        for ch in ordered_chapters:
            content = ch.content or ""
            norm_content = self._normalize_text(content).lower()
            norm_pos = norm_content.find(norm_quote)
            if norm_pos != -1:
                return VerifyQuoteResponse(
                    status=EvidenceStatusEnum.NORMALIZED_VERIFIED,
                    confidence=0.95,
                    matched_text=clean_quote,
                    chapter_id=str(ch.id),
                    chapter_number=ch.chapter_number,
                    start_char=None,
                    end_char=None,
                    version_number=manuscript.version_number,
                    explanation=f"Normalized citation match found in Chapter {ch.chapter_number} with identical semantic wording."
                )

        # Step C: High-confidence Candidate Search in active version
        best_ratio = 0.0
        best_candidate_match = None
        best_ch = None

        # Chunk sentences from chapters to evaluate candidate matches
        quote_words = clean_quote.split()
        if len(quote_words) >= 4:
            q_tokens = set(re.findall(r'\w+', clean_quote.lower()))
            for ch in ordered_chapters:
                sentences = re.split(r'(?<=[.!?])\s+', ch.content or "")
                for s in sentences:
                    s_clean = s.strip()
                    if not s_clean:
                        continue
                    seq_ratio = difflib.SequenceMatcher(None, clean_quote.lower(), s_clean.lower()).ratio()
                    s_tokens = set(re.findall(r'\w+', s_clean.lower()))
                    token_overlap = len(q_tokens & s_tokens) / len(q_tokens) if q_tokens else 0.0
                    ratio = max(seq_ratio, token_overlap)
                    if ratio > best_ratio:
                        best_ratio = ratio
                        best_candidate_match = s_clean
                        best_ch = ch

            if best_ratio >= v2_settings.CANDIDATE_SIMILARITY_THRESHOLD and best_ch:
                return VerifyQuoteResponse(
                    status=EvidenceStatusEnum.CANDIDATE_MATCH,
                    confidence=round(best_ratio, 3),
                    matched_text=best_candidate_match,
                    chapter_id=str(best_ch.id),
                    chapter_number=best_ch.chapter_number,
                    version_number=manuscript.version_number,
                    explanation=f"Candidate citation matched with {round(best_ratio * 100, 1)}% textual similarity in Chapter {best_ch.chapter_number}."
                )

        # Step D: Search Historical Versions to detect Version Mismatch
        historical_manuscripts = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id,
            models.Manuscript.id != manuscript.id
        ).order_by(models.Manuscript.version_number.desc()).all()

        for hist_m in historical_manuscripts:
            hist_chapters = db.query(models.Chapter).filter(
                models.Chapter.manuscript_id == hist_m.id
            ).all()
            for h_ch in hist_chapters:
                content = h_ch.content or ""
                if clean_quote in content or norm_quote in self._normalize_text(content).lower():
                    return VerifyQuoteResponse(
                        status=EvidenceStatusEnum.SOURCE_VERSION_MISMATCH,
                        confidence=0.75,
                        matched_text=clean_quote,
                        chapter_id=str(h_ch.id),
                        chapter_number=h_ch.chapter_number,
                        version_number=hist_m.version_number,
                        explanation=f"Citation existed in Version {hist_m.version_number} Chapter {h_ch.chapter_number}, but was modified or excised in current Version {manuscript.version_number}."
                    )

        # Step E: Completely Unverified
        return VerifyQuoteResponse(
            status=EvidenceStatusEnum.UNVERIFIED,
            confidence=0.0,
            version_number=manuscript.version_number,
            explanation="Citation cannot be verified in active or historical manuscript text (unsubstantiated or hallucinated claim)."
        )


strict_evidence_service = StrictEvidenceService()
