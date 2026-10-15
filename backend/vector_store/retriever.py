"""Semantic search retriever over clinical guidelines and drug references."""
from typing import List
from vector_store.embedder import get_guidelines_vectorstore, get_drug_vectorstore


async def retrieve_guidelines(query: str, n_results: int = 8, collections: List[str] = None) -> str:
    """Retrieve relevant guideline chunks for RAG context injection."""
    results = []
    try:
        vs = get_guidelines_vectorstore()
        docs = vs.similarity_search(query, k=n_results)
        results.extend([d.page_content for d in docs])
    except Exception:
        pass

    if collections and "drug_database" in collections:
        try:
            vs = get_drug_vectorstore()
            docs = vs.similarity_search(query, k=min(n_results, 4))
            results.extend([d.page_content for d in docs])
        except Exception:
            pass

    return "\n\n---\n\n".join(results) if results else "No guideline context available."
