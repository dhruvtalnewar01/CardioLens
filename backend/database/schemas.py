"""Pydantic request/response schemas for all API endpoints."""
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ── Patient Schemas ───────────────────────────────────────────────────────
class PatientCreate(BaseModel):
    mrn: str = Field(..., max_length=50)
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    dob: datetime
    sex: str = Field(..., pattern="^(male|female|other)$")
    ethnicity: Optional[str] = None
    height_cm: Optional[float] = Field(None, ge=30, le=250)
    weight_kg: Optional[float] = Field(None, ge=1, le=400)
    smoking_status: str = "never"
    diabetes_type: str = "none"
    hypertension: bool = False
    family_chd_history: bool = False

class PatientResponse(BaseModel):
    id: uuid.UUID
    mrn: str
    first_name: str
    last_name: str
    dob: datetime
    sex: str
    bmi: Optional[float]
    smoking_status: str
    diabetes_type: str
    hypertension: bool
    family_chd_history: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Biomarker Schemas ─────────────────────────────────────────────────────
class BiomarkerPanelCreate(BaseModel):
    collected_at: datetime
    lab_id: Optional[str] = None
    ldl_cholesterol: Optional[float] = Field(None, ge=10, le=500)
    hdl_cholesterol: Optional[float] = Field(None, ge=5, le=150)
    total_cholesterol: Optional[float] = Field(None, ge=50, le=600)
    triglycerides: Optional[float] = Field(None, ge=20, le=5000)
    crp_hs: Optional[float] = Field(None, ge=0, le=200)
    troponin_i: Optional[float] = Field(None, ge=0)
    troponin_t: Optional[float] = Field(None, ge=0)
    bnp: Optional[float] = Field(None, ge=0)
    nt_pro_bnp: Optional[float] = Field(None, ge=0)
    homocysteine: Optional[float] = None
    lp_a: Optional[float] = None
    apob: Optional[float] = None
    apo_a1: Optional[float] = None
    fibrinogen: Optional[float] = None
    d_dimer: Optional[float] = None
    hba1c: Optional[float] = Field(None, ge=3, le=20)
    fasting_glucose: Optional[float] = Field(None, ge=20, le=800)
    insulin_resistance_homa: Optional[float] = None
    creatinine: Optional[float] = None
    egfr: Optional[float] = None
    uric_acid: Optional[float] = None

class BiomarkerPanelResponse(BiomarkerPanelCreate):
    id: uuid.UUID
    patient_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ── Analysis Schemas ──────────────────────────────────────────────────────
class AnalysisRequest(BaseModel):
    patient_id: uuid.UUID
    biomarker_panel_id: Optional[uuid.UUID] = None
    imaging_study_ids: Optional[List[uuid.UUID]] = None
    ecg_recording_id: Optional[uuid.UUID] = None
    analysis_type: str = Field("full", pattern="^(full|quick|emergency)$")

class AnalysisResponse(BaseModel):
    session_id: str
    status: str
    message: str


class InlineAnalysisRequest(BaseModel):
    """Accepts raw patient + biomarker data directly from the frontend form."""
    # Demographics
    firstName: str = ""
    lastName: str = ""
    dob: str = ""
    sex: str = "male"
    ethnicity: str = ""
    height: str = ""
    weight: str = ""
    smoking: str = "never"
    diabetes: str = "none"
    hypertension: bool = False
    familyHistory: bool = False
    # Biomarkers
    ldl: str = ""
    hdl: str = ""
    totalChol: str = ""
    triglycerides: str = ""
    crpHs: str = ""
    troponinI: str = ""
    hba1c: str = ""
    fastingGlucose: str = ""

class RiskAssessmentResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    assessed_at: datetime
    overall_risk_tier: str
    composite_ml_risk_score: Optional[float]
    framingham_10yr_risk: Optional[float]
    pooled_cohort_10yr_risk: Optional[float]
    grace_score: Optional[int]
    timi_score: Optional[int]
    reynolds_risk: Optional[float]
    score2_risk: Optional[float]
    confidence_interval_lower: Optional[float]
    confidence_interval_upper: Optional[float]
    driving_factors: Optional[Dict[str, Any]]
    gemini_reasoning: Optional[str]

    class Config:
        from_attributes = True


# ── Intervention Schemas ──────────────────────────────────────────────────
class InterventionPlanResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    status: str
    lifestyle_modifications: Optional[Dict[str, Any]]
    pharmacological_recommendations: Optional[Dict[str, Any]]
    procedural_referrals: Optional[Dict[str, Any]]
    monitoring_schedule: Optional[Dict[str, Any]]
    exercise_prescription: Optional[Dict[str, Any]]
    guideline_citations: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True


# ── Health Check ──────────────────────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str
    database: str
    redis: str
    gemini: str
    timestamp: datetime
