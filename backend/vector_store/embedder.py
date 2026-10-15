"""Gemini embedding pipeline for ChromaDB vector store — lazy initialization."""
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

# Lazy singletons — created on first use to avoid crashing at import time
_embedding_function = None
_query_embedding_function = None
_text_splitter = None


def _get_embedding_function():
    global _embedding_function
    if _embedding_function is None:
        _embedding_function = GoogleGenerativeAIEmbeddings(
            model=settings.gemini_embedding_model,
            google_api_key=settings.google_api_key,
            task_type="retrieval_document",
        )
    return _embedding_function


def _get_query_embedding_function():
    global _query_embedding_function
    if _query_embedding_function is None:
        _query_embedding_function = GoogleGenerativeAIEmbeddings(
            model=settings.gemini_embedding_model,
            google_api_key=settings.google_api_key,
            task_type="retrieval_query",
        )
    return _query_embedding_function


def get_text_splitter():
    global _text_splitter
    if _text_splitter is None:
        _text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=800, chunk_overlap=80,
            separators=["\n\n", "\n", ". ", "! ", "? "],
        )
    return _text_splitter


def get_guidelines_vectorstore() -> Chroma:
    return Chroma(
        collection_name=settings.chroma_collection_guidelines,
        embedding_function=_get_embedding_function(),
        persist_directory=settings.chroma_persist_dir,
    )


def get_pubmed_vectorstore() -> Chroma:
    return Chroma(
        collection_name=settings.chroma_collection_pubmed,
        embedding_function=_get_embedding_function(),
        persist_directory=settings.chroma_persist_dir,
    )


def get_drug_vectorstore() -> Chroma:
    return Chroma(
        collection_name=settings.chroma_collection_drugs,
        embedding_function=_get_embedding_function(),
        persist_directory=settings.chroma_persist_dir,
    )
