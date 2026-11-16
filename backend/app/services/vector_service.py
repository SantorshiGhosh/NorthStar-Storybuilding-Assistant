import os
import re
import math
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

from app.config import settings

logger = logging.getLogger("vector_service")

class SemanticEmbeddingFunction(EmbeddingFunction):
    """
    Production semantic embedding provider using SentenceTransformers ('all-MiniLM-L6-v2').
    Produces 384-dimensional dense embeddings capturing synonymy, paraphrase, and intent.
    Implements lazy loading to ensure rapid FastAPI server startup.
    """
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None
        self._failed = False

    def name(self) -> str:
        return f"semantic_{self.model_name.replace('-', '_')}"

    def _get_model(self):
        if self._model is None and not self._failed:
            try:
                from sentence_transformers import SentenceTransformer
                self._model = SentenceTransformer(self.model_name)
                logger.info(f"Loaded semantic embedding model: {self.model_name}")
            except Exception as e:
                logger.warning(f"Could not load SentenceTransformer ({e}); using semantic TF-IDF fallback.")
                self._failed = True
        return self._model

    def __call__(self, input: Documents) -> Embeddings:
        model = self._get_model()
        if model is not None:
            try:
                vectors = model.encode(list(input), normalize_embeddings=True)
                return [v.tolist() for v in vectors]
            except Exception as e:
                logger.warning(f"SentenceTransformer encoding error ({e}); using fallback.")

        # High-precision semantic frequency fallback (384-dim normalized vector)
        dim = 384
        embeddings = []
        for text in input:
            vec = [0.0] * dim
            tokens = re.findall(r'\b[a-zA-Z0-9_-]+\b', str(text).lower())
            for idx, token in enumerate(tokens):
                # Hash token into vector
                h = hash(token) % dim
                # Position-aware weighting
                weight = 1.0 + (1.0 / (idx + 1))
                vec[h] += weight
                # N-gram sub-token hashing
                if len(token) >= 4:
                    for i in range(len(token) - 2):
                        h2 = hash(token[i:i+3]) % dim
                        vec[h2] += 0.4
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            embeddings.append([v / norm for v in vec])
        return embeddings


class VectorService:
    """
    Isolated vector memory service for NorthStar with project isolation,
    chronological filtering, and hybrid vector+keyword passage retrieval.
    """
    def __init__(self):
        self.embedding_function = SemanticEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        try:
            self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        except Exception as e:
            logger.warning(f"Chroma PersistentClient fallback to EphemeralClient: {e}")
            self.client = chromadb.EphemeralClient()

    def _get_collection_name(self, project_id: str) -> str:
        clean_id = str(project_id).replace("-", "")[:32]
        return f"proj_{clean_id}_v2"

    def get_or_create_collection(self, project_id: str):
        collection_name = self._get_collection_name(project_id)
        try:
            return self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=self.embedding_function,
                metadata={"project_id": str(project_id), "version": "2.0"}
            )
        except Exception as e:
            logger.warning(f"Collection initialization note: {e}")
            # In case of dimension conflict with previous index, recreate safely
            try:
                self.client.delete_collection(name=collection_name)
            except Exception:
                pass
            return self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=self.embedding_function,
                metadata={"project_id": str(project_id), "version": "2.0"}
            )

    def index_passages(self, project_id: str, passages: List[Dict[str, Any]]) -> None:
        """
        Indexes a list of passages for semantic search with strict project isolation.
        """
        if not passages:
            return

        collection = self.get_or_create_collection(project_id)
        if not collection:
            return

        try:
            ids = [str(p["id"]) for p in passages]
            documents = [str(p["content"]) for p in passages]
            metadatas = [
                {
                    "project_id": str(project_id),
                    "chapter_id": str(p.get("chapter_id", "")),
                    "chapter_number": int(p.get("chapter_number", 1)),
                    "passage_index": int(p.get("passage_index", 0)),
                    "char_start": int(p.get("char_start", 0)),
                    "char_end": int(p.get("char_end", 0))
                }
                for p in passages
            ]

            batch_size = 64
            for i in range(0, len(ids), batch_size):
                collection.upsert(
                    ids=ids[i:i + batch_size],
                    documents=documents[i:i + batch_size],
                    metadatas=metadatas[i:i + batch_size]
                )
        except Exception as e:
            logger.warning(f"Vector indexing error: {e}")

    def search_similar_passages(
        self,
        project_id: str,
        query: str,
        n_results: int = 5,
        exclude_chapter_number: Optional[int] = None,
        max_prior_chapter_number: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Searches for passages semantically similar to query.
        Supports CHRONOLOGICAL ISOLATION via `max_prior_chapter_number` or `exclude_chapter_number`.
        """
        collection = self.get_or_create_collection(project_id)
        if not collection:
            return self._fallback_sql_search(project_id, query, n_results, exclude_chapter_number, max_prior_chapter_number)

        # Build chronological metadata filter
        where_filter = None
        filters = []
        if exclude_chapter_number is not None:
            filters.append({"chapter_number": {"$ne": exclude_chapter_number}})
        if max_prior_chapter_number is not None:
            filters.append({"chapter_number": {"$lt": max_prior_chapter_number}})

        if len(filters) == 1:
            where_filter = filters[0]
        elif len(filters) > 1:
            where_filter = {"$and": filters}

        results = None
        try:
            count = collection.count()
            if count == 0:
                return self._fallback_sql_search(project_id, query, n_results, exclude_chapter_number, max_prior_chapter_number)

            results = collection.query(
                query_texts=[query],
                n_results=min(n_results, count),
                where=where_filter
            )
        except Exception:
            try:
                # Fallback query without where filter if collection schema doesn't support nested $and
                results = collection.query(
                    query_texts=[query],
                    n_results=min(n_results, count)
                )
            except Exception:
                return self._fallback_sql_search(project_id, query, n_results, exclude_chapter_number, max_prior_chapter_number)

        passages = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
            ids = results["ids"][0] if "ids" in results else [""] * len(docs)

            for doc, meta, doc_id in zip(docs, metas, ids):
                ch_num = int(meta.get("chapter_number", 0))
                # Post-filter for strict chronological isolation
                if exclude_chapter_number is not None and ch_num == exclude_chapter_number:
                    continue
                if max_prior_chapter_number is not None and ch_num >= max_prior_chapter_number:
                    continue

                passages.append({
                    "id": doc_id,
                    "content": doc,
                    "chapter_number": ch_num,
                    "chapter_id": meta.get("chapter_id", ""),
                    "passage_index": meta.get("passage_index", 0),
                    "char_start": meta.get("char_start", 0),
                    "char_end": meta.get("char_end", 0)
                })

        if not passages:
            return self._fallback_sql_search(project_id, query, n_results, exclude_chapter_number, max_prior_chapter_number)

        return passages

    def _fallback_sql_search(
        self,
        project_id: str,
        query: str,
        n_results: int = 5,
        exclude_chapter_number: Optional[int] = None,
        max_prior_chapter_number: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Database fallback: If ChromaDB storage is empty or rebuilding, searches passages
        directly in the SQL database using token relevance and chronological filtering.
        """
        try:
            from app.database.connection import SessionLocal
            from app.database.models import Passage, Chapter

            db = SessionLocal()
            try:
                query_tokens = [w.lower() for w in re.findall(r'\b[a-zA-Z0-9_-]{3,}\b', query) if len(w) > 2]
                if not query_tokens:
                    return []

                q = db.query(Passage, Chapter.chapter_number).join(Chapter, Passage.chapter_id == Chapter.id).filter(
                    Passage.project_id == project_id
                )
                if exclude_chapter_number is not None:
                    q = q.filter(Chapter.chapter_number != exclude_chapter_number)
                if max_prior_chapter_number is not None:
                    q = q.filter(Chapter.chapter_number < max_prior_chapter_number)

                rows = q.all()
                scored_passages = []
                for passage, ch_num in rows:
                    content_lower = passage.content.lower()
                    score = sum(content_lower.count(token) for token in query_tokens)
                    if score > 0:
                        scored_passages.append((
                            score,
                            {
                                "id": str(passage.id),
                                "content": passage.content,
                                "chapter_number": ch_num,
                                "chapter_id": str(passage.chapter_id),
                                "passage_index": passage.passage_index,
                                "char_start": passage.char_start,
                                "char_end": passage.char_end
                            }
                        ))

                scored_passages.sort(key=lambda x: x[0], reverse=True)
                return [item[1] for item in scored_passages[:n_results]]
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"SQL passage search fallback error: {e}")
            return []

    def clear_project(self, project_id: str) -> None:
        """
        Cleans up collections when a project is deleted or re-indexed.
        """
        collection_name = self._get_collection_name(project_id)
        try:
            self.client.delete_collection(name=collection_name)
        except Exception:
            pass

vector_service = VectorService()
