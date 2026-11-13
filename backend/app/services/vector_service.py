import os
import chromadb
from typing import List, Dict, Any, Optional
from app.config import settings

class VectorService:
    def __init__(self):
        try:
            self.client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIRECTORY)
        except Exception as e:
            # Fallback to EphemeralClient if persistent path has lock or filesystem constraints
            self.client = chromadb.EphemeralClient()

    def _get_collection_name(self, project_id: str) -> str:
        # Chroma collection names must be 3-63 chars, alphanumeric with underscores/hyphens
        clean_id = str(project_id).replace("-", "")[:32]
        return f"proj_{clean_id}"

    def index_passages(self, project_id: str, passages: List[Dict[str, Any]]) -> None:
        """
        Indexes a list of passages for semantic search.
        Each passage dict must have: id, chapter_id, chapter_number, passage_index, content
        """
        if not passages:
            return

        collection_name = self._get_collection_name(project_id)
        collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"project_id": str(project_id)}
        )

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

        # Chroma upsert in batches
        batch_size = 50
        for i in range(0, len(ids), batch_size):
            collection.upsert(
                ids=ids[i:i + batch_size],
                documents=documents[i:i + batch_size],
                metadatas=metadatas[i:i + batch_size]
            )

    def search_similar_passages(
        self,
        project_id: str,
        query: str,
        n_results: int = 5,
        exclude_chapter_number: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Searches for passages semantically similar to query.
        Optionally excludes current chapter to specifically retrieve earlier canon.
        """
        collection_name = self._get_collection_name(project_id)
        try:
            collection = self.client.get_collection(name=collection_name)
        except Exception:
            return []

        where_filter = None
        if exclude_chapter_number is not None:
            where_filter = {"chapter_number": {"$ne": exclude_chapter_number}}

        try:
            results = collection.query(
                query_texts=[query],
                n_results=min(n_results, max(1, collection.count())),
                where=where_filter
            )
        except Exception:
            # Query without filter if filter syntax was incompatible
            try:
                results = collection.query(
                    query_texts=[query],
                    n_results=min(n_results, max(1, collection.count()))
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
