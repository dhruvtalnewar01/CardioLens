"""CRUD operations for all database models."""
import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import (
    Patient, BiomarkerPanel, VitalSign, ECGRecording,
    ImagingStudy, RiskAssessment, InterventionPlan, ClinicalReport, AuditLog
)


# ── Patient CRUD ──────────────────────────────────────────────────────────
async def create_patient(db: AsyncSession, **kwargs) -> Patient:
    patient = Patient(**kwargs)
    if patient.height_cm and patient.weight_kg:
        patient.bmi = round(patient.weight_kg / ((patient.height_cm / 100) ** 2), 1)
    db.add(patient)
    await db.flush()
    return patient


async def get_patient(db: AsyncSession, patient_id: uuid.UUID) -> Optional[Patient]:
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def get_patient_by_mrn(db: AsyncSession, mrn: str) -> Optional[Patient]:
    result = await db.execute(
        select(Patient).where(Patient.mrn == mrn, Patient.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


# ── Biomarker CRUD ────────────────────────────────────────────────────────
async def create_biomarker_panel(db: AsyncSession, patient_id: uuid.UUID, **kwargs) -> BiomarkerPanel:
    panel = BiomarkerPanel(patient_id=patient_id, **kwargs)
    db.add(panel)
    await db.flush()
    return panel


async def get_latest_biomarkers(db: AsyncSession, patient_id: uuid.UUID) -> Optional[BiomarkerPanel]:
    result = await db.execute(
        select(BiomarkerPanel)
        .where(BiomarkerPanel.patient_id == patient_id)
        .order_by(BiomarkerPanel.collected_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


# ── Risk Assessment CRUD ──────────────────────────────────────────────────
async def create_risk_assessment(db: AsyncSession, patient_id: uuid.UUID, **kwargs) -> RiskAssessment:
    assessment = RiskAssessment(patient_id=patient_id, **kwargs)
    db.add(assessment)
    await db.flush()
    return assessment


async def get_risk_history(db: AsyncSession, patient_id: uuid.UUID) -> List[RiskAssessment]:
    result = await db.execute(
        select(RiskAssessment)
        .where(RiskAssessment.patient_id == patient_id)
        .order_by(RiskAssessment.assessed_at.desc())
        .limit(20)
    )
    return list(result.scalars().all())


# ── Intervention CRUD ─────────────────────────────────────────────────────
async def create_intervention_plan(db: AsyncSession, **kwargs) -> InterventionPlan:
    plan = InterventionPlan(**kwargs)
    db.add(plan)
    await db.flush()
    return plan


# ── Audit Logging ─────────────────────────────────────────────────────────
async def log_audit(
    db: AsyncSession,
    action: str,
    resource: str = None,
    user_id: str = None,
    patient_id: uuid.UUID = None,
    ip_address: str = None,
    success: bool = True,
    details: dict = None,
) -> AuditLog:
    log = AuditLog(
        action=action,
        resource=resource,
        user_id=user_id,
        patient_id=patient_id,
        ip_address=ip_address,
        success=success,
        details=details,
    )
    db.add(log)
    await db.flush()
    return log
