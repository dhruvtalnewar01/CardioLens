"""Biomarker Analysis Agent — uses gemini-1.5-flash for fast inference."""
import json
from utils.gemini_client import generate_structured_response

BIOMARKER_SCHEMA = """{
  "lipid_profile_grade": "optimal|near_optimal|borderline|high|very_high",
  "tc_hdl_ratio": float,
  "ldl_hdl_ratio": float,
  "inflammatory_risk_tier": "low|moderate|high",
  "metabolic_syndrome": bool,
  "metabolic_syndrome_criteria_met": 0-5,
  "cardiac_injury_pattern": "none|chronic_elevation|acute_elevation|acute_mi_pattern",
  "lpa_genetic_risk": "normal|intermediate|high|very_high",
  "top_abnormal_biomarkers": [{"name": str, "value": float, "unit": str, "severity": str, "clinical_significance": str}],
  "trend_direction": "improving|stable|worsening|insufficient_data",
  "biomarker_risk_contribution": 0.0-1.0,
  "narrative": "200-300 word clinical summary",
  "urgent_flags": ["list of critical values"]
}"""


def compute_lipid_ratios(ldl, hdl, total_chol, triglycerides):
    tc_hdl = round(total_chol / hdl, 2) if hdl else None
    ldl_hdl = round(ldl / hdl, 2) if hdl else None
    non_hdl = round(total_chol - hdl, 1) if hdl else None
    tg_hdl = round(triglycerides / hdl, 2) if hdl else None
    return {"tc_hdl_ratio": tc_hdl, "ldl_hdl_ratio": ldl_hdl, "non_hdl_cholesterol": non_hdl, "tg_hdl_ratio": tg_hdl}


def flag_inflammatory_cascade(crp_hs, fibrinogen, homocysteine):
    tier = "low"
    if crp_hs and crp_hs > 3.0: tier = "high"
    elif crp_hs and crp_hs > 1.0: tier = "moderate"
    flags = []
    if fibrinogen and fibrinogen > 400: flags.append("Elevated fibrinogen")
    if homocysteine and homocysteine > 15: flags.append("Hyperhomocysteinemia")
    return {"tier": tier, "flags": flags}


async def analyze_biomarkers(biomarker_data: dict, patient_age: int, patient_sex: str) -> dict:
    """Full biomarker analysis using Gemini Flash."""
    lipid_ratios = compute_lipid_ratios(
        biomarker_data.get("ldl_cholesterol", 0), biomarker_data.get("hdl_cholesterol", 1),
        biomarker_data.get("total_cholesterol", 0), biomarker_data.get("triglycerides", 0),
    )
    inflammatory = flag_inflammatory_cascade(
        biomarker_data.get("crp_hs"), biomarker_data.get("fibrinogen"),
        biomarker_data.get("homocysteine"),
    )

    prompt = f"""You are analyzing a cardiovascular biomarker panel for a {patient_age}yo {patient_sex} patient.

BIOMARKER VALUES: {json.dumps(biomarker_data, indent=2)}
COMPUTED RATIOS: {json.dumps(lipid_ratios, indent=2)}
INFLAMMATORY ASSESSMENT: {json.dumps(inflammatory, indent=2)}

Perform comprehensive biomarker analysis. Pay attention to:
1. TC/HDL ratio >5 is a stronger predictor than LDL alone
2. hs-CRP >3 mg/L is an independent cardiovascular risk marker
3. Lp(a) >100 nmol/L confers high genetic risk
4. HOMA-IR >2.5 indicates insulin resistance
5. Troponin elevation pattern changes management completely"""

    return await generate_structured_response(prompt, BIOMARKER_SCHEMA, use_pro=False)
