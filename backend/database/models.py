"""
SQLAlchemy 2.0 ORM models — full CHD clinical data schema.
UUIDs as PKs, soft-delete, full timestamps, JSONB for flexible data.
"""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum, JSON, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship, Mapped, mapped_column
from sqlalchemy.sql import func
import enum


class Base(DeclarativeBase):
    pass


# ── Enums ─────────────────────────────────────────────────────────────────
class SexEnum(str, enum.Enum):
    male = "male"
    female = "female"
    other = "other"

class SmokingStatus(str, enum.Enum):
    never = "never"
    former = "former"
    current = "current"

class DiabetesType(str, enum.Enum):
    none = "none"
    type1 = "type1"
    type2 = "type2"
    gestational = "gestational"

class VitalSource(str, enum.Enum):
    clinic = "clinic"
    wearable = "wearable"
    home = "home"

class ImagingModality(str, enum.Enum):
    CT = "CT"
    IVUS = "IVUS"
    Echo = "Echo"
    MRI = "MRI"
    PET = "PET"
    Xray = "Xray"

class StenosisSeverity(str, enum.Enum):
    none = "none"
    minimal = "minimal"
    mild = "mild"
    moderate = "moderate"
    severe = "severe"
    critical = "critical"

class PlaqueType(str, enum.Enum):
    none = "none"
    calcified = "calcified"
    fibrous = "fibrous"
    lipid_rich = "lipid_rich"
    mixed = "mixed"

class RiskTier(str, enum.Enum):
    low = "low"
    intermediate = "intermediate"
    high = "high"
    very_high = "very_high"

class PlanStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"
    active = "active"
    superseded = "superseded"

class ReportType(str, enum.Enum):
    full_assessment = "full_assessment"
    quick_screen = "quick_screen"
    follow_up = "follow_up"
    emergency = "emergency"


# ── Models ────────────────────────────────────────────────────────────────

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mrn: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    dob: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    sex: Mapped[SexEnum] = mapped_column(SAEnum(SexEnum), nullable=False)
    ethnicity: Mapped[Optional[str]] = mapped_column(String(50))
    height_cm: Mapped[Optional[float]] = mapped_column(Float)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float)
    bmi: Mapped[Optional[float]] = mapped_column(Float)
    smoking_status: Mapped[SmokingStatus] = mapped_column(SAEnum(SmokingStatus), default=SmokingStatus.never)
    diabetes_type: Mapped[DiabetesType] = mapped_column(SAEnum(DiabetesType), default=DiabetesType.none)
    hypertension: Mapped[bool] = mapped_column(Boolean, default=False)
    family_chd_history: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    biomarker_panels = relationship("BiomarkerPanel", back_populates="patient")
    vital_signs = relationship("VitalSign", back_populates="patient")
    ecg_recordings = relationship("ECGRecording", back_populates="patient")
    imaging_studies = relationship("ImagingStudy", back_populates="patient")
    risk_assessments = relationship("RiskAssessment", back_populates="patient")


class BiomarkerPanel(Base):
    __tablename__ = "biomarker_panels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    lab_id: Mapped[Optional[str]] = mapped_column(String(100))
    # Lipids
    ldl_cholesterol: Mapped[Optional[float]] = mapped_column(Float)
    hdl_cholesterol: Mapped[Optional[float]] = mapped_column(Float)
    total_cholesterol: Mapped[Optional[float]] = mapped_column(Float)
    triglycerides: Mapped[Optional[float]] = mapped_column(Float)
    # Inflammatory
    crp_hs: Mapped[Optional[float]] = mapped_column(Float)
    fibrinogen: Mapped[Optional[float]] = mapped_column(Float)
    homocysteine: Mapped[Optional[float]] = mapped_column(Float)
    # Cardiac
    troponin_i: Mapped[Optional[float]] = mapped_column(Float)
    troponin_t: Mapped[Optional[float]] = mapped_column(Float)
    bnp: Mapped[Optional[float]] = mapped_column(Float)
    nt_pro_bnp: Mapped[Optional[float]] = mapped_column(Float)
    # Advanced lipid
    lp_a: Mapped[Optional[float]] = mapped_column(Float)
    apob: Mapped[Optional[float]] = mapped_column(Float)
    apo_a1: Mapped[Optional[float]] = mapped_column(Float)
    # Metabolic
    hba1c: Mapped[Optional[float]] = mapped_column(Float)
    fasting_glucose: Mapped[Optional[float]] = mapped_column(Float)
    insulin_resistance_homa: Mapped[Optional[float]] = mapped_column(Float)
    creatinine: Mapped[Optional[float]] = mapped_column(Float)
    egfr: Mapped[Optional[float]] = mapped_column(Float)
    uric_acid: Mapped[Optional[float]] = mapped_column(Float)
    # Coagulation
    d_dimer: Mapped[Optional[float]] = mapped_column(Float)
    # Meta
    raw_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="biomarker_panels")


class VitalSign(Base):
    __tablename__ = "vital_signs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[VitalSource] = mapped_column(SAEnum(VitalSource), default=VitalSource.clinic)
    systolic_bp: Mapped[Optional[float]] = mapped_column(Float)
    diastolic_bp: Mapped[Optional[float]] = mapped_column(Float)
    heart_rate: Mapped[Optional[float]] = mapped_column(Float)
    oxygen_saturation: Mapped[Optional[float]] = mapped_column(Float)
    temperature: Mapped[Optional[float]] = mapped_column(Float)
    respiratory_rate: Mapped[Optional[float]] = mapped_column(Float)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float)

    patient = relationship("Patient", back_populates="vital_signs")


class ECGRecording(Base):
    __tablename__ = "ecg_recordings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float)
    file_path: Mapped[Optional[str]] = mapped_column(String(500))
    leads: Mapped[Optional[dict]] = mapped_column(JSONB)
    sample_rate_hz: Mapped[Optional[int]] = mapped_column(Integer)
    ai_interpretation: Mapped[Optional[dict]] = mapped_column(JSONB)
    rhythm: Mapped[Optional[str]] = mapped_column(String(100))
    pr_interval_ms: Mapped[Optional[float]] = mapped_column(Float)
    qrs_duration_ms: Mapped[Optional[float]] = mapped_column(Float)
    qt_interval_ms: Mapped[Optional[float]] = mapped_column(Float)
    qtc_interval_ms: Mapped[Optional[float]] = mapped_column(Float)
    st_changes: Mapped[bool] = mapped_column(Boolean, default=False)
    t_wave_inversion: Mapped[bool] = mapped_column(Boolean, default=False)
    afib_detected: Mapped[bool] = mapped_column(Boolean, default=False)
    lvh_criteria: Mapped[bool] = mapped_column(Boolean, default=False)

    patient = relationship("Patient", back_populates="ecg_recordings")


class ImagingStudy(Base):
    __tablename__ = "imaging_studies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    study_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    modality: Mapped[ImagingModality] = mapped_column(SAEnum(ImagingModality), nullable=False)
    file_path: Mapped[Optional[str]] = mapped_column(String(500))
    dicom_series_uid: Mapped[Optional[str]] = mapped_column(String(200))
    ai_findings: Mapped[Optional[dict]] = mapped_column(JSONB)
    stenosis_severity: Mapped[Optional[StenosisSeverity]] = mapped_column(SAEnum(StenosisSeverity))
    plaque_burden_percent: Mapped[Optional[float]] = mapped_column(Float)
    plaque_type: Mapped[Optional[PlaqueType]] = mapped_column(SAEnum(PlaqueType))
    left_main_stenosis: Mapped[Optional[float]] = mapped_column(Float)
    lad_stenosis: Mapped[Optional[float]] = mapped_column(Float)
    lcx_stenosis: Mapped[Optional[float]] = mapped_column(Float)
    rca_stenosis: Mapped[Optional[float]] = mapped_column(Float)
    calcium_score_agatston: Mapped[Optional[float]] = mapped_column(Float)
    ef_percent: Mapped[Optional[float]] = mapped_column(Float)
    radiologist_report: Mapped[Optional[str]] = mapped_column(Text)

    patient = relationship("Patient", back_populates="imaging_studies")


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    assessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    framingham_10yr_risk: Mapped[Optional[float]] = mapped_column(Float)
    pooled_cohort_10yr_risk: Mapped[Optional[float]] = mapped_column(Float)
    grace_score: Mapped[Optional[int]] = mapped_column(Integer)
    timi_score: Mapped[Optional[int]] = mapped_column(Integer)
    reynolds_risk: Mapped[Optional[float]] = mapped_column(Float)
    score2_risk: Mapped[Optional[float]] = mapped_column(Float)
    who_ish_risk_category: Mapped[Optional[str]] = mapped_column(String(50))
    overall_risk_tier: Mapped[RiskTier] = mapped_column(SAEnum(RiskTier), default=RiskTier.low)
    composite_ml_risk_score: Mapped[Optional[float]] = mapped_column(Float)
    confidence_interval_lower: Mapped[Optional[float]] = mapped_column(Float)
    confidence_interval_upper: Mapped[Optional[float]] = mapped_column(Float)
    driving_factors: Mapped[Optional[dict]] = mapped_column(JSONB)
    gemini_reasoning: Mapped[Optional[str]] = mapped_column(Text)
    model_version: Mapped[Optional[str]] = mapped_column(String(50))

    patient = relationship("Patient", back_populates="risk_assessments")
    intervention_plans = relationship("InterventionPlan", back_populates="risk_assessment")
    clinical_reports = relationship("ClinicalReport", back_populates="risk_assessment")


class InterventionPlan(Base):
    __tablename__ = "intervention_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    risk_assessment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("risk_assessments.id"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    lifestyle_modifications: Mapped[Optional[dict]] = mapped_column(JSONB)
    pharmacological_recommendations: Mapped[Optional[dict]] = mapped_column(JSONB)
    procedural_referrals: Mapped[Optional[dict]] = mapped_column(JSONB)
    monitoring_schedule: Mapped[Optional[dict]] = mapped_column(JSONB)
    dietary_plan: Mapped[Optional[dict]] = mapped_column(JSONB)
    exercise_prescription: Mapped[Optional[dict]] = mapped_column(JSONB)
    clinical_trial_matches: Mapped[Optional[dict]] = mapped_column(JSONB)
    guideline_citations: Mapped[Optional[dict]] = mapped_column(JSONB)
    status: Mapped[PlanStatus] = mapped_column(SAEnum(PlanStatus), default=PlanStatus.draft)
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    risk_assessment = relationship("RiskAssessment", back_populates="intervention_plans")


class ClinicalReport(Base):
    __tablename__ = "clinical_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    risk_assessment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("risk_assessments.id"), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    report_type: Mapped[ReportType] = mapped_column(SAEnum(ReportType), default=ReportType.full_assessment)
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500))
    narrative_summary: Mapped[Optional[str]] = mapped_column(Text)
    executive_summary: Mapped[Optional[str]] = mapped_column(Text)
    physician_notes: Mapped[Optional[str]] = mapped_column(Text)
    report_version: Mapped[int] = mapped_column(Integer, default=1)
    signed_by: Mapped[Optional[str]] = mapped_column(String(200))
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    risk_assessment = relationship("RiskAssessment", back_populates="clinical_reports")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[str]] = mapped_column(String(200))
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource: Mapped[Optional[str]] = mapped_column(String(200))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    details: Mapped[Optional[dict]] = mapped_column(JSONB)

    __table_args__ = (
        Index("idx_audit_patient", "patient_id"),
        Index("idx_audit_timestamp", "timestamp"),
    )
