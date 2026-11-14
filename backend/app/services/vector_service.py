import os
import re
import math
import hashlib
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

from app.config import settings

logger = logging.getLogger("vector_service")

class FastEmbeddingFunction(EmbeddingFunction):
    """
    Lightweight, deterministic, zero-dependency embedding function.
    Avoids loading heavy ONNX runtime models into memory, preventing
    out-of-memory (OOM) crashes on constrained host environments (e.g. Render 512MB RAM).
    """
    def __init__(self, dim: int = 128):
        self.dim = dim

    def name(self) -> str:
        return "fast_embedding_function"

    def __call__(self, input: Documents) -> Embeddings:
        embeddings = []
        for text in input:
            vec = [0.0] * self.dim
            tokens = re.findall(r'\b[a-zA-Z0-9_-]+\b', str(text).lower())
            for token in tokens:
                h = int(hashlib.md5(token.encode('utf-8')).hexdigest(), 16) % self.dim
                vec[h] += 1.0
                if len(token) >= 4:
                    for i in range(len(token) - 2):
                        tri = token[i:i+3]
                        h2 = int(hashlib.md5(tri.encode('utf-8')).hexdigest(), 16) % self.dim
                        vec[h2] += 0.5
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            embeddings.append([v / norm for v in vec])
        return embeddings

class VectorService:
    def __init__(self):
        self.embedding_function = FastEmbeddingFunction(dim=128)
        try:
            self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        except Exception as e:
            logger.warning(f"Chroma PersistentClient fallback to EphemeralClient: {e}")
            self.client = chromadb.EphemeralClient()

    def _get_collection_name(self, project_id: str) -> str:
        clean_id = str(project_id).replace("-", "")[:32]
        return f"proj_{clean_id}"

    def index_passages(self, project_id: str, passages: List[Dict[str, Any]]) -> None:
        """
        Indexes a list of passages for semantic search using lightweight fast embeddings.
        """
        if not passages:
            return

        collection_name = self._get_collection_name(project_id)
        collection = None

        try:
            collection = self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=self.embedding_function,
                metadata={"project_id": str(project_id)}
            )
        except Exception:
            # Handle collection config conflict (e.g. persisted with default ONNX vs new function)
            try:
                self.client.delete_collection(name=collection_name)
            except Exception:
                pass
            try:
                collection = self.client.get_or_create_collection(
                    name=collection_name,
                    embedding_function=self.embedding_function,
                    metadata={"project_id": str(project_id)}
                )
            except Exception as e:
                logger.warning(f"Vector collection recreate skipped: {e}")
                return

        try:
            ids = [str(p["id"]) for p in passages]
            documents = [str(p["content"]) for p in passages]
            metadatas = [
                {
                    "project_id": str(project_id),
                    "chapter_id": str(p.get("chapter_id", "")),
                    "chapter_number": int(p.get("chapter_number", 1)),
                    "passage_index": int(p.get("passage_index", 0))
                }
                for p in passages
            ]

            batch_size = 50
            for i in range(0, len(ids), batch_size):
                collection.upsert(
                    ids=ids[i:i + batch_size],
                    documents=documents[i:i + batch_size],
                    metadatas=metadatas[i:i + batch_size]
                )
        except Exception as e:
            logger.warning(f"Vector indexing error (non-fatal, passages preserved in SQL): {e}")

    def search_similar_passages(
        self,
        project_id: str,
        query: str,
        n_results: int = 5,
        exclude_chapter_number: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Searches for passages semantically similar to query.
        """
        collection_name = self._get_collection_name(project_id)
        collection = None

        try:
            collection = self.client.get_collection(
                name=collection_name,
                embedding_function=self.embedding_function
            )
        except Exception:
            try:
                collection = self.client.get_collection(name=collection_name)
            except Exception:
                return []

        where_filter = None
        if exclude_chapter_number is not None:
            where_filter = {"chapter_number": {"$ne": exclude_chapter_number}}

        results = None
        try:
            count = collection.count()
            if count == 0:
                return []
            results = collection.query(
                query_texts=[query],
                n_results=min(n_results, count),
                where=where_filter
            )
        except Exception:
            try:
                count = collection.count()
                if count > 0:
                    results = collection.query(
                        query_texts=[query],
                        n_results=min(n_results, count)
                    )
            except Exception:
                return []

        passages = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if "metadatas" in results else [{}] * len(docs)
            ids = results["ids"][0] if "ids" in results else [""] * len(docs)

            for doc, meta, doc_id in zip(docs, metas, ids):
                if exclude_chapter_number is not None and meta.get("chapter_number") == exclude_chapter_number:
                    continue
                passages.append({
                    "id": doc_id,
                    "content": doc,
                    "chapter_number": meta.get("chapter_number", 0),
                    "chapter_id": meta.get("chapter_id", ""),
                    "passage_index": meta.get("passage_index", 0)
                })

        return passages

    def clear_project(self, project_id: str) -> None:
        """
        Cleans up collection when a project is deleted.
        """
        collection_name = self._get_collection_name(project_id)
        try:
            self.client.delete_collection(name=collection_name)
        except Exception:
            pass

vector_service = VectorService()
