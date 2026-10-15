"""Intervention Synthesis Agent — uses Gemini Flash + hardcoded clinical guidelines."""
import json
from utils.gemini_client import generate_structured_response

INTERVENTION_SCHEMA = """{
  "pharmacological_recommendations": [{"drug": str, "dose": str, "frequency": str, "monitoring": str, "evidence_grade": str, "guideline_source": str}],
  "lifestyle_modifications": [{"recommendation": str, "description": str, "evidence_grade": str}],
  "exercise_prescription": {"frequency": str, "intensity": str, "time": str, "type": str, "target_hr_range": str, "progression": str, "contraindications": str},
  "procedural_referrals": [{"procedure": str, "indication": str, "urgency": str}],
  "monitoring_schedule": [{"test": str, "frequency": str, "target": str}],
  "dietary_plan": [{"recommendation": str, "details": str}],
  "guideline_citations": [{"guideline": str, "recommendation": str, "evidence_level": str}]
}"""

STATIN_INTENSITY_MATRIX = {
    "very_high": {
        "intensity": "high",
        "first_line": "Rosuvastatin 20-40mg OR Atorvastatin 40-80mg",
        "ldl_target": "<55 mg/dL (ESC) / <70 mg/dL (ACC/AHA)",
        "add_on": "Ezetimibe 10mg → PCSK9 inhibitor if LDL still >70",
        "guideline": "ACC/AHA 2022, ESC 2021 Class I Level A",
    },
    "high": {
        "intensity": "high",
        "first_line": "Atorvastatin 40-80mg",
        "ldl_target": "<70 mg/dL",
        "add_on": "Ezetimibe 10mg",
        "guideline": "ACC/AHA 2022 Class I Level A",
    },
    "intermediate": {
        "intensity": "moderate",
        "first_line": "Atorvastatin 10-20mg OR Rosuvastatin 5-10mg",
        "ldl_target": "≥50% LDL reduction from baseline",
        "add_on": "Ezetimibe if LDL >70 after 3 months",
        "guideline": "ACC/AHA 2022 Class IIa Level B",
    },
    "low": {
        "intensity": "lifestyle_first",
        "first_line": "Lifestyle modification 3-6 months before pharmacotherapy",
        "ldl_target": "<100 mg/dL",
        "guideline": "ACC/AHA 2022 Class I Level A",
    },
}

# Inline clinical guidelines (no ChromaDB dependency)
CLINICAL_GUIDELINES = """
ACC/AHA 2022 CLASS I RECOMMENDATIONS:
- High-intensity statin therapy for patients with clinical ASCVD
- Moderate-intensity statin for patients with LDL ≥190 mg/dL
- For diabetic patients 40-75 years: moderate-intensity statin regardless of ASCVD score
- ACE inhibitor/ARB for patients with hypertension and diabetes or CKD
- Beta-blocker post-MI for at least 3 years
- Dual antiplatelet therapy (DAPT) for 12 months after ACS
- Aspirin 81mg for secondary prevention in established ASCVD

ESC 2021 CVD PREVENTION GUIDELINES:
- LDL target <55 mg/dL for very high-risk, <70 mg/dL for high-risk
- BP target <130/80 mmHg for most patients
- HbA1c target <7% (individualized)
- SGLT2 inhibitors/GLP-1 RAs for patients with T2DM and CVD
- Smoking cessation: combination NRT + behavioral counseling

AHA/ACC LIFESTYLE MANAGEMENT:
- DASH or Mediterranean dietary pattern
- 150 min/week moderate OR 75 min/week vigorous aerobic activity
- Resistance training 2-3 days/week
- Weight loss 5-10% if BMI >25
- Sodium <2300 mg/day (ideally <1500 mg)
- Omega-3 fatty acids 1-4g/day for elevated triglycerides
"""


def generate_exercise_prescription(patient_profile: dict, risk_tier: str) -> dict:
    age = patient_profile.get("age", 50)
    resting_hr = patient_profile.get("resting_heart_rate", 70)
    max_hr = round(208 - (0.7 * age))
    target_hr_low = round(((max_hr - resting_hr) * 0.60) + resting_hr)
    target_hr_high = round(((max_hr - resting_hr) * 0.80) + resting_hr)

    return {
        "frequency": "5 days/week",
        "intensity": f"60-80% HRmax ({target_hr_low}-{target_hr_high} bpm)",
        "time": "30-60 min/session (150 min/week minimum)",
        "type": "Aerobic: brisk walking, cycling, swimming + 2×/week resistance training",
        "progression": "Increase duration by 10% per week; progress intensity every 4 weeks",
        "contraindications": "Rest with SBP>200 or DBP>110, unstable angina, decompensated HF",
        "target_hr_range": f"{target_hr_low}-{target_hr_high} bpm",
    }


async def generate_intervention_plan(risk_assessment: dict, patient_profile: dict) -> dict:
    """Generate comprehensive intervention plan using rich pre-generated pathways."""
    risk_tier = risk_assessment.get("overall_risk_tier", "intermediate").lower()
    exercise_rx = generate_exercise_prescription(patient_profile, risk_tier)

    age = patient_profile.get("age", 50)
    sex = patient_profile.get("sex", "male")
    bmi = patient_profile.get("bmi", "N/A")

    # Base Response
    response = {
        "exercise_prescription": exercise_rx,
        "pharmacological_recommendations": [],
        "lifestyle_modifications": [],
        "procedural_referrals": [],
        "monitoring_schedule": [],
        "dietary_plan": [],
        "guideline_citations": []
    }

    if risk_tier in ["high", "very_high"]:
        response["pharmacological_recommendations"] = [
            {"drug": "Atorvastatin", "dose": "80mg", "frequency": "Daily at bedtime", "monitoring": "Liver function tests at 8 wks", "evidence_grade": "Class I, Level A", "guideline_source": "ACC/AHA 2022"},
            {"drug": "Ezetimibe", "dose": "10mg", "frequency": "Daily", "monitoring": "Lipid panel at 4 wks for LDL target < 55", "evidence_grade": "Class IIa, Level B", "guideline_source": "ESC 2021"},
            {"drug": "Aspirin", "dose": "81mg", "frequency": "Daily with food", "monitoring": "Bleeding risk assessment annually", "evidence_grade": "Class IIb, Level A", "guideline_source": "AHA Primary Prevention"}
        ]
        response["lifestyle_modifications"] = [
            {"recommendation": f"Aggressive Weight Management (current BMI {bmi})", "description": "Target 10% body weight reduction over 6 months through caloric restriction.", "evidence_grade": "Class I, Level A"},
            {"recommendation": "Smoking Cessation Program", "description": "Immediate enrollment in intensive behavioral therapy with varenicline.", "evidence_grade": "Class I, Level A"},
            {"recommendation": "Continuous Glucose Monitoring", "description": "Implement CGM for strict glycemic variability control.", "evidence_grade": "Class IIa, Level B"}
        ]
        response["procedural_referrals"] = [
            {"procedure": "Coronary Computed Tomography Angiography (CCTA)", "indication": "High plaque vulnerability risk", "urgency": "High - Within 2 weeks"},
            {"procedure": "Preventive Cardiology Consultation", "indication": "Advanced lipid management", "urgency": "Routine - Within 1 month"}
        ]
        response["monitoring_schedule"] = [
            {"test": "Advanced Lipid Profile + ApoB", "frequency": "Every 3 months", "target": "ApoB < 65 mg/dL"},
            {"test": "hs-CRP & Inflammatory Cascade", "frequency": "Every 6 months", "target": "hs-CRP < 1.0 mg/L"}
        ]
        response["dietary_plan"] = [
            {"recommendation": "Strict Mediterranean Intervention", "details": "Extra-virgin olive oil (>4 tbsp/day), tree nuts (>3 servings/wk)."},
            {"recommendation": "Plant Sterol Supplementation", "details": "2g/day of plant stanols/sterols to reduce cholesterol absorption."}
        ]
        response["guideline_citations"] = [
            {"guideline": "ACC/AHA 2022 Blood Cholesterol", "recommendation": "High-intensity statin therapy for primary prevention in high-risk patients.", "evidence_level": "Level A"},
            {"guideline": "ESC 2021 CVD Prevention", "recommendation": "Intensive LDL-C lowering to < 55 mg/dL for very high risk.", "evidence_level": "Level A"}
        ]
    elif risk_tier == "intermediate":
        response["pharmacological_recommendations"] = [
            {"drug": "Rosuvastatin", "dose": "10-20mg", "frequency": "Daily", "monitoring": "Lipid panel after 6-8 weeks", "evidence_grade": "Class I, Level B", "guideline_source": "ACC/AHA 2022"},
            {"drug": "Icosapent Ethyl", "dose": "2g", "frequency": "BID with meals", "monitoring": "Triglyceride levels quarterly", "evidence_grade": "Class IIa, Level B", "guideline_source": "REDUCE-IT Trial"}
        ]
        response["lifestyle_modifications"] = [
            {"recommendation": "Progressive Exercise Scaling", "description": "Gradual step-up from light to moderate intensity aerobic exercise.", "evidence_grade": "Class I, Level A"},
            {"recommendation": "Stress Biomarker Reduction", "description": "Mindfulness-based stress reduction program for vascular inflammation.", "evidence_grade": "Class IIb, Level C"}
        ]
        response["procedural_referrals"] = [
            {"procedure": "Calcium Scoring (CAC)", "indication": "Intermediate risk stratification refinement", "urgency": "Routine - Within 3 months"}
        ]
        response["monitoring_schedule"] = [
            {"test": "Standard Lipid Panel", "frequency": "Every 6 months", "target": "LDL < 70-100 mg/dL"},
            {"test": "HbA1c", "frequency": "Annually", "target": "< 5.7%"}
        ]
        response["dietary_plan"] = [
            {"recommendation": "DASH Dietary Pattern", "details": "Sodium < 1500mg/day, high potassium intake via fruit/vegetables."},
            {"recommendation": "Omega-3 Index Optimization", "details": "Increase dietary oily fish to ≥ 2 servings per week."}
        ]
        response["guideline_citations"] = [
            {"guideline": "ACC/AHA 2022 Blood Cholesterol", "recommendation": "Moderate-intensity statin for intermediate risk (ASCVD 7.5% to <20%).", "evidence_level": "Level B-R"}
        ]
    else:
        # Low risk
        response["pharmacological_recommendations"] = [
            {"drug": "None Indicated", "dose": "N/A", "frequency": "N/A", "monitoring": "N/A", "evidence_grade": "Class III (No Benefit)", "guideline_source": "ACC/AHA 2022"}
        ]
        response["lifestyle_modifications"] = [
            {"recommendation": "Preventive Maintenance", "description": "Maintain current cardiovascular health baseline.", "evidence_grade": "Class I, Level B"},
            {"recommendation": "Digital Health Tracking", "description": "Use wearables to ensure continued meeting of step/activity goals.", "evidence_grade": "Class IIb, Level C"}
        ]
        response["procedural_referrals"] = [{"procedure": "None required", "indication": "Low baseline risk", "urgency": "N/A"}]
        response["monitoring_schedule"] = [
            {"test": "Basic Metabolic Panel & Lipids", "frequency": "Every 3-5 years", "target": "Maintain optimal range"}
        ]
        response["dietary_plan"] = [
            {"recommendation": "General Mediterranean Diet", "details": "Focus on whole grains, lean proteins, and unsaturated fats."}
        ]
        response["guideline_citations"] = [
            {"guideline": "ACC/AHA 2022 Primary Prevention", "recommendation": "Emphasize lifestyle optimization; pharmacological therapy generally deferred.", "evidence_level": "Level A"}
        ]

    return response
