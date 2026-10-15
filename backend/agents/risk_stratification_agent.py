"""Risk Stratification Agent — pure mathematical computation, NO LLM calls."""
from tools.framingham_calculator import compute_framingham_score
from tools.pooled_cohort_equations import compute_pooled_cohort_equations
from tools.grace_score import compute_grace_score
from tools.timi_score import compute_timi_score
from tools.reynolds_risk_score import compute_reynolds_risk
from tools.score2_calculator import compute_score2


async def compute_all_risk_scores(patient_data: dict, biomarker_data: dict, vitals: dict) -> dict:
    """Compute all validated clinical risk scores. No LLM — pure math."""
    age = patient_data.get("age", 50)
    sex = patient_data.get("sex", "male")
    sbp = vitals.get("systolic_bp", 120)
    tc = biomarker_data.get("total_cholesterol", 200)
    hdl = biomarker_data.get("hdl_cholesterol", 50)
    smoker = patient_data.get("smoking_status") == "current"
    diabetic = patient_data.get("diabetes_type", "none") != "none"
    bp_treated = patient_data.get("hypertension", False)
    crp = biomarker_data.get("crp_hs", 1.0)
    hba1c = biomarker_data.get("hba1c", 5.5)
    family_hx = patient_data.get("family_chd_history", False)
    race = patient_data.get("race", "white")

    framingham = compute_framingham_score(age, sex, tc, hdl, sbp, bp_treated, smoker, diabetic)
    pce = compute_pooled_cohort_equations(age, sex, race, tc, hdl, sbp, bp_treated, diabetic, smoker)
    reynolds = compute_reynolds_risk(age, sex, sbp, tc, hdl, crp, hba1c, family_hx)
    score2 = compute_score2(age, sex, sbp, tc, hdl, smoker)

    # GRACE + TIMI only if ACS data is available
    grace = None
    timi = None
    if vitals.get("heart_rate"):
        grace = compute_grace_score(
            age, vitals["heart_rate"], sbp,
            biomarker_data.get("creatinine", 1.0),
        )
    if patient_data.get("acs_presentation"):
        timi = compute_timi_score(
            age >= 65, patient_data.get("cad_risk_factors_gte_3", False),
            patient_data.get("known_cad", False), patient_data.get("aspirin_7days", False),
            patient_data.get("angina_24hrs_gte_2", False),
            patient_data.get("st_deviation", False),
            patient_data.get("elevated_markers", False),
        )

    return {
        "framingham_10yr_risk": framingham,
        "pooled_cohort_10yr_risk": pce,
        "reynolds_risk": reynolds,
        "score2_risk": score2,
        "grace_score": grace["score"] if grace else None,
        "grace_details": grace,
        "timi_score": timi["score"] if timi else None,
        "timi_details": timi,
    }
