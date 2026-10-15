"""API v1 — Analysis endpoints (full pipeline + inline analysis + PDF)."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from database.session import get_db
from database.schemas import AnalysisRequest, AnalysisResponse, InlineAnalysisRequest
from agents.orchestrator import run_full_analysis, CHDOrchestrationState

router = APIRouter(prefix="/analysis", tags=["analysis"])

# In-memory session store (use Redis in production)
_sessions: dict = {}


def _safe_float(val: str, default=None):
    """Safely parse a string to float."""
    try:
        return float(val) if val else default
    except (ValueError, TypeError):
        return default


def _compute_age(dob_str: str) -> int:
    """Compute age from DOB string (YYYY-MM-DD or DD-MM-YYYY)."""
    if not dob_str:
        return 50
    try:
        for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m-%d-%Y", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                dob = datetime.strptime(dob_str, fmt)
                today = datetime.now()
                return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            except ValueError:
                continue
        return 50
    except Exception:
        return 50


@router.post("/analyze")
async def analyze_inline(req: InlineAnalysisRequest):
    """
    Stateless analysis endpoint — accepts raw patient form data,
    runs the full 6-agent Gemini pipeline, returns all results.
    No database required.
    """
    age = _compute_age(req.dob)
    height = _safe_float(req.height)
    weight = _safe_float(req.weight)
    bmi = round(weight / ((height / 100) ** 2), 1) if height and weight and height > 0 else None

    # Build biomarker data dict
    biomarker_data = {}
    field_map = {
        'ldl': 'ldl_cholesterol', 'hdl': 'hdl_cholesterol',
        'totalChol': 'total_cholesterol', 'triglycerides': 'triglycerides',
        'crpHs': 'crp_hs', 'troponinI': 'troponin_i',
        'hba1c': 'hba1c', 'fastingGlucose': 'fasting_glucose',
    }
    for form_key, data_key in field_map.items():
        val = _safe_float(getattr(req, form_key, ''))
        if val is not None:
            biomarker_data[data_key] = val

    # Build patient history dict
    patient_history = {
        "age": age,
        "sex": req.sex,
        "ethnicity": req.ethnicity or "white",
        "height_cm": height,
        "weight_kg": weight,
        "bmi": bmi,
        "smoking_status": req.smoking,
        "diabetes_type": req.diabetes,
        "hypertension": req.hypertension,
        "family_chd_history": req.familyHistory,
        "first_name": req.firstName,
        "last_name": req.lastName,
        "dob": req.dob,
    }

    # Build vitals (systolic/diastolic BP not in form, use defaults)
    vitals = {
        "systolic_bp": 140 if req.hypertension else 120,
        "diastolic_bp": 90 if req.hypertension else 80,
        "heart_rate": 72,
    }

    # Build orchestration state
    state: CHDOrchestrationState = {
        "patient_id": str(uuid.uuid4()),
        "session_id": str(uuid.uuid4()),
        "analysis_type": "full",
        "biomarker_data": biomarker_data if biomarker_data else None,
        "imaging_data": None,
        "ecg_data": None,
        "patient_history": patient_history,
        "vitals": vitals,
        "biomarker_analysis": None,
        "imaging_analysis": None,
        "ecg_analysis": None,
        "clinical_scores": None,
        "risk_assessment": None,
        "intervention_plan": None,
        "clinical_report": None,
        "current_step": "queued",
        "errors": [],
        "agent_trace": [],
    }

    # Run the full pipeline synchronously
    try:
        result = await run_full_analysis(state)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {str(e)}")

    return {
        "status": result.get("current_step", "complete"),
        "biomarker_analysis": result.get("biomarker_analysis"),
        "imaging_analysis": result.get("imaging_analysis"),
        "ecg_analysis": result.get("ecg_analysis"),
        "clinical_scores": result.get("clinical_scores"),
        "risk_assessment": result.get("risk_assessment"),
        "intervention_plan": result.get("intervention_plan"),
        "clinical_report": result.get("clinical_report"),
        "errors": result.get("errors", []),
        "agent_trace": result.get("agent_trace", []),
        "patient_info": patient_history,
    }


@router.post("/generate-pdf")
async def generate_pdf(req: InlineAnalysisRequest):
    """
    Run the analysis and generate a downloadable PDF report.
    Re-uses the /analyze logic, then passes results to PDF generator.
    """
    # First run the full analysis
    analysis_response = await analyze_inline(req)

    # Generate PDF — merge raw form data with patient_info for complete demographics
    from utils.pdf_generator import generate_report_pdf
    raw_form = {
        "firstName": req.firstName, "lastName": req.lastName, "dob": req.dob,
        "sex": req.sex, "ethnicity": req.ethnicity, "height": req.height,
        "weight": req.weight, "smoking": req.smoking, "diabetes": req.diabetes,
        "hypertension": req.hypertension, "familyHistory": req.familyHistory,
        "ldl": req.ldl, "hdl": req.hdl, "totalChol": req.totalChol,
        "triglycerides": req.triglycerides, "crpHs": req.crpHs,
        "troponinI": req.troponinI, "hba1c": req.hba1c, "fastingGlucose": req.fastingGlucose,
    }
    # Merge raw form fields into patient_info (raw form takes priority for names/measurements)
    merged_patient = {**analysis_response.get("patient_info", {}), **raw_form}
    try:
        pdf_bytes = generate_report_pdf(analysis_response, merged_patient)
    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab is not installed. Run: pip install reportlab")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    patient_name = f"{req.firstName}_{req.lastName}".strip('_') or "patient"
    filename = f"CHD_Report_{patient_name}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


# ── Legacy endpoints (kept for compatibility) ──────────────────────────────

@router.post("/full", response_model=AnalysisResponse)
async def trigger_full_analysis(req: AnalysisRequest, db: AsyncSession = Depends(get_db)):
    """Trigger full CHD analysis pipeline (DB-dependent). Returns session_id for polling."""
    session_id = str(uuid.uuid4())

    state: CHDOrchestrationState = {
        "patient_id": str(req.patient_id),
        "session_id": session_id,
        "analysis_type": req.analysis_type,
        "biomarker_data": None, "imaging_data": None, "ecg_data": None,
        "patient_history": None, "vitals": None,
        "biomarker_analysis": None, "imaging_analysis": None, "ecg_analysis": None,
        "clinical_scores": None, "risk_assessment": None, "intervention_plan": None,
        "clinical_report": None, "current_step": "queued",
        "errors": [], "agent_trace": [],
    }
    _sessions[session_id] = state

    import asyncio
    asyncio.create_task(_run_pipeline(session_id, state))

    return AnalysisResponse(session_id=session_id, status="started", message="Analysis pipeline initiated")


async def _run_pipeline(session_id: str, state: CHDOrchestrationState):
    try:
        result = await run_full_analysis(state)
        _sessions[session_id] = result
    except Exception as e:
        _sessions[session_id]["current_step"] = "error"
        _sessions[session_id]["errors"].append(str(e))


@router.get("/result/{session_id}")
async def get_analysis_result(session_id: str):
    """Get full analysis result by session ID."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    state = _sessions[session_id]
    return {
        "session_id": session_id,
        "status": state["current_step"],
        "risk_assessment": state.get("risk_assessment"),
        "intervention_plan": state.get("intervention_plan"),
        "clinical_report": state.get("clinical_report"),
        "clinical_scores": state.get("clinical_scores"),
        "errors": state.get("errors", []),
        "agent_trace": state.get("agent_trace", []),
    }


@router.get("/status/{session_id}")
async def get_analysis_status(session_id: str):
    """Check the current pipeline step."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "session_id": session_id,
        "current_step": _sessions[session_id]["current_step"],
        "errors": _sessions[session_id].get("errors", []),
    }
