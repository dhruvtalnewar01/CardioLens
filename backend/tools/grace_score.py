"""GRACE 2.0 Score — Fox et al. 2014. For ACS risk stratification."""


def compute_grace_score(
    age: int, heart_rate: int, sbp: int, creatinine: float,
    killip_class: int = 1, cardiac_arrest: bool = False,
    st_deviation: bool = False, elevated_cardiac_markers: bool = False
) -> dict:
    """Returns GRACE score (0-372), in-hospital mortality %, 6-month mortality %."""
    score = 0

    # Age points
    if age < 30:      score += 0
    elif age <= 39:    score += 8
    elif age <= 49:    score += 25
    elif age <= 59:    score += 41
    elif age <= 69:    score += 58
    elif age <= 79:    score += 75
    else:              score += 91

    # Heart rate
    if heart_rate < 50:     score += 0
    elif heart_rate <= 69:  score += 3
    elif heart_rate <= 89:  score += 9
    elif heart_rate <= 109: score += 15
    elif heart_rate <= 149: score += 24
    elif heart_rate <= 199: score += 38
    else:                   score += 46

    # Systolic BP
    if sbp < 80:       score += 58
    elif sbp <= 99:    score += 53
    elif sbp <= 119:   score += 43
    elif sbp <= 139:   score += 34
    elif sbp <= 159:   score += 24
    elif sbp <= 199:   score += 10
    else:              score += 0

    # Creatinine (mg/dL)
    if creatinine < 0.4:      score += 1
    elif creatinine <= 0.79:  score += 4
    elif creatinine <= 1.19:  score += 7
    elif creatinine <= 1.59:  score += 10
    elif creatinine <= 1.99:  score += 13
    elif creatinine <= 3.99:  score += 21
    else:                     score += 28

    # Killip class
    killip_points = {1: 0, 2: 20, 3: 39, 4: 59}
    score += killip_points.get(killip_class, 0)

    # Binary factors
    if cardiac_arrest:            score += 39
    if st_deviation:              score += 28
    if elevated_cardiac_markers:  score += 14

    # Mortality estimates
    if score <= 108:
        in_hospital = 0.5
        six_month = 2.0
        risk_level = "low"
    elif score <= 140:
        in_hospital = 2.0
        six_month = 5.0
        risk_level = "intermediate"
    else:
        in_hospital = 5.0
        six_month = 12.0
        risk_level = "high"

    return {
        "score": score,
        "in_hospital_mortality_pct": in_hospital,
        "six_month_mortality_pct": six_month,
        "risk_level": risk_level,
    }
