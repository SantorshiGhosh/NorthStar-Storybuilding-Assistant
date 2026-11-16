"""
Production V2 Hybrid Retrieval Service
Combines dense semantic vectors and lexical token scoring with strict chronological isolation.
"""
import math
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.database import models
from app.production_v2.config import v2_settings


class HybridRetrievalService:
    """
    Ranks narrative passages and facts using hybrid scoring while guaranteeing chronological isolation.
    """

    def __init__(self):
        self._embedder = None
        self._embedder_attempted = False

    def _get_embedder(self):
        if not self._embedder_attempted:
            self._embedder_attempted = True
            try:
                from sentence_transformers import SentenceTransformer
                self._embedder = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception:
                self._embedder = None
        return self._embedder

    @staticmethod
    def _lexical_score(query: str, text: str) -> float:
        """Computes normalized term overlap score."""
        q_tokens = set(re.findall(r'\w+', query.lower()))
        t_tokens = set(re.findall(r'\w+', text.lower()))
        if not q_tokens or not t_tokens:
            return 0.0
        intersection = q_tokens.intersection(t_tokens)
        return len(intersection) / len(q_tokens)

    def search_prior_context(
        self,
        db: Session,
        project_id: str,
        query: str,
        max_prior_chapter_number: Optional[int] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Retrieves passages and facts strictly preceding max_prior_chapter_number.
        Prevents future events from leaking into earlier narrative analysis.
        """
        # Fetch active manuscript
        active_m = db.query(models.Manuscript).filter(
            models.Manuscript.project_id == project_id,
            models.Manuscript.is_active_version == True
        ).first()

        if not active_m:
            active_m = db.query(models.Manuscript).filter(
                models.Manuscript.project_id == project_id
            ).order_by(models.Manuscript.version_number.desc()).first()

        if not active_m:
            return []

        # Fetch chapters respecting chronological boundary
        ch_query = db.query(models.Chapter).filter(models.Chapter.manuscript_id == active_m.id)
        if max_prior_chapter_number is not None:
            ch_query = ch_query.filter(models.Chapter.chapter_number < max_prior_chapter_number)
        
        allowed_chapters = ch_query.order_by(models.Chapter.chapter_number.asc()).all()
        if not allowed_chapters:
            return []

        allowed_ch_ids = [ch.id for ch in allowed_chapters]
        ch_map = {ch.id: ch for ch in allowed_chapters}

        # Query story facts in allowed chapters
        facts = db.query(models.StoryFact).filter(
            models.StoryFact.source_chapter_id.in_(allowed_ch_ids),
            models.StoryFact.is_negated == False
        ).all()

        candidates = []
        for f in facts:
            ch = ch_map.get(f.source_chapter_id)
            ch_num = f.source_chapter_number or (ch.chapter_number if ch else 0)
            fact_val = getattr(f, "fact", getattr(f, "claim", "")) or ""
            text_rep = f"{fact_val} {f.source_quote or ''}".strip()
            candidates.append({
                "type": "fact",
                "id": str(f.id),
                "text": text_rep,
                "chapter_number": ch_num,
                "source_quote": f.source_quote,
                "fact_claim": fact_val
            })

        # Also extract sentence passages from allowed chapters
        for ch in allowed_chapters:
            sentences = re.split(r'(?<=[.!?])\s+', ch.content or "")
            for s in sentences:
                s_clean = s.strip()
                if len(s_clean.split()) >= 6:
                    candidates.append({
                        "type": "passage",
                        "id": f"ch{ch.chapter_number}_{len(candidates)}",
                        "text": s_clean,
                        "chapter_number": ch.chapter_number,
                        "source_quote": s_clean,
                        "fact_claim": None
                    })

        if not candidates:
            return []

        # Dense Vector Scoring
        embedder = self._get_embedder()
        q_emb = None
        if embedder:
            try:
                import numpy as np
                q_emb = embedder.encode([query])[0]
            except Exception:
                q_emb = None

        scored_results = []
        for c in candidates:
            # Lexical score
            lex_score = self._lexical_score(query, c["text"])
            
            # Dense score
            dense_score = 0.0
            if q_emb is not None and embedder:
                try:
                    import numpy as np
                    c_emb = embedder.encode([c["text"][:200]])[0]
                    dot_prod = np.dot(q_emb, c_emb)
                    norm_q = np.linalg.norm(q_emb)
                    norm_c = np.linalg.norm(c_emb)
                    if norm_q > 0 and norm_c > 0:
                        dense_score = float(dot_prod / (norm_q * norm_c))
                except Exception:
                    dense_score = 0.0

            # Hybrid weighted combination
            combined_score = (
                v2_settings.VECTOR_DENSE_WEIGHT * max(0.0, dense_score) +
                v2_settings.BM25_LEXICAL_WEIGHT * lex_score
            )

            if combined_score > 0.05:
                scored_results.append({
                    "score": round(combined_score, 4),
                    "dense_score": round(dense_score, 4),
                    "lexical_score": round(lex_score, 4),
                    "chapter_number": c["chapter_number"],
                    "type": c["type"],
                    "text": c["text"],
                    "source_quote": c["source_quote"],
                    "fact_claim": c["fact_claim"]
                })

        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return scored_results[:top_k]


hybrid_retrieval_service = HybridRetrievalService()
