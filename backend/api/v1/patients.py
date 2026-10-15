"""API v1 — Patient CRUD endpoints."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database.session import get_db
from database.schemas import PatientCreate, PatientResponse
from database import crud

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("/", response_model=PatientResponse, status_code=201)
async def create_patient(patient: PatientCreate, db: AsyncSession = Depends(get_db)):
    """Create a new patient record."""
    existing = await crud.get_patient_by_mrn(db, patient.mrn)
    if existing:
        raise HTTPException(status_code=409, detail="Patient with this MRN already exists")
    result = await crud.create_patient(db, **patient.model_dump())
    return result


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get patient by ID."""
    patient = await crud.get_patient(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.get("/{patient_id}/risk-history")
async def get_risk_history(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get all past risk assessments for a patient."""
    history = await crud.get_risk_history(db, patient_id)
    return {"patient_id": str(patient_id), "assessments": history}


@router.get("/{patient_id}/biomarkers/latest")
async def get_latest_biomarkers(patient_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get the most recent biomarker panel."""
    panel = await crud.get_latest_biomarkers(db, patient_id)
    if not panel:
        raise HTTPException(status_code=404, detail="No biomarker data found")
    return panel
