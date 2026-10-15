"""Report Generation Agent — uses Gemini Flash for narrative generation."""
import json
from utils.gemini_client import generate_structured_response

REPORT_NARRATIVE_SCHEMA = """{
  "executive_summary": "3-4 sentences, plain language for patient understanding",
  "clinical_background": "patient demographics, comorbidities, relevant history, 100-150 words",
  "biomarker_narrative": "detailed technical analysis of all biomarker results, 200-300 words for physician review",
  "risk_assessment_narrative": "synthesis of all clinical risk scores with interpretation, 200-250 words",
  "intervention_narrative": "comprehensive medication, lifestyle, and monitoring recommendations, 250-300 words",
  "recommendations": "prioritized list of 5-8 immediate action items",
  "monitoring_narrative": "12-month follow-up plan with specific milestones and targets",
  "disclaimer": "standard medical AI disclaimer"
}"""


async def generate_report_narrative(full_analysis: dict) -> dict:
    """Generate comprehensive clinical report narrative using Gemini Flash."""
    patient = full_analysis.get("patient_demographics", {})
    risk = full_analysis.get("risk_assessment", {})
    intervention = full_analysis.get("intervention_plan", {})

    age = patient.get("age", "N/A")
    sex = patient.get("sex", "N/A")
    name = f"{patient.get('first_name', '')} {patient.get('last_name', '')}".strip()

    prompt = f"""Generate a complete, highly professional clinical cardiovascular risk assessment report.

PATIENT: {name}, {age}-year-old {sex}
BMI: {patient.get("bmi", "N/A")}
Smoking: {patient.get("smoking_status", "N/A")}
Diabetes: {patient.get("diabetes_type", "N/A")}
Hypertension: {"Yes" if patient.get("hypertension") else "No"}
Family CHD History: {"Yes" if patient.get("family_chd_history") else "No"}

RISK TIER: {risk.get("overall_risk_tier", "unknown")}
COMPOSITE SCORE: {risk.get("composite_ml_risk_score", "N/A")}/100
10-YEAR MACE: {risk.get("ten_year_mace_probability", "N/A")}

KEY RISK DRIVERS:
{json.dumps(risk.get("modifiable_risk_drivers", [])[:5], indent=2)}

INTERVENTION PLAN SUMMARY:
{json.dumps(intervention, indent=2)[:2000]}

AI CLINICAL REASONING:
{risk.get("clinical_reasoning", "N/A")}

Generate ALL report sections with high clinical specificity:
1. executive_summary: Patient-friendly 3-4 sentence overview
2. clinical_background: Demographics, comorbidities, relevant history
3. biomarker_narrative: Technical analysis of biomarker findings for physician
4. risk_assessment_narrative: All clinical scores synthesized with clinical interpretation
5. intervention_narrative: Detailed medication, lifestyle, dietary, exercise plan
6. recommendations: 5-8 prioritized, actionable next steps
7. monitoring_narrative: 12-month follow-up plan with milestones
8. disclaimer: Standard AI medical disclaimer

Make this report HIGHLY SPECIFIC to this patient. Reference their exact values and risk factors.
Write as if presenting to a senior cardiologist for sign-off.
Always conclude with: 'This AI-assisted analysis requires physician review and clinical correlation before any treatment decisions are made.'"""

    return await generate_structured_response(prompt, REPORT_NARRATIVE_SCHEMA, use_pro=False)
