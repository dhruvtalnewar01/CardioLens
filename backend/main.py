"""FastAPI application entry point — CHD Predictor AI Backend."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from config import settings

app = FastAPI(
    title="CHD Predictor AI",
    description="Early Coronary Heart Disease Prediction & Clinical Decision Support System",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────
from api.v1.patients import router as patients_router
from api.v1.analysis import router as analysis_router

app.include_router(patients_router, prefix=settings.api_v1_prefix)
app.include_router(analysis_router, prefix=settings.api_v1_prefix)


@app.get("/api/v1/health")
async def health_check():
    """Health check: basic API status."""
    return {
        "status": "healthy",
        "database": "configured",
        "redis": "configured",
        "gemini": "configured",
        "timestamp": datetime.utcnow().isoformat(),
    }


CLINICAL_DISCLAIMER = (
    "This AI-assisted analysis is intended to support clinical decision-making and does not "
    "constitute a medical diagnosis. All risk assessments, recommendations, and reports require "
    "review, clinical correlation, and approval by a licensed physician before any treatment "
    "decisions are made."
)


@app.get("/")
async def root():
    return {
        "service": "CHD Predictor AI",
        "version": "2.0.0",
        "disclaimer": CLINICAL_DISCLAIMER,
    }
