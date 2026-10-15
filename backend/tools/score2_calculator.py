"""ESC SCORE2 / SCORE2-OP Calculator."""
import math


def compute_score2(
    age: int, sex: str, sbp: float, total_chol: float,
    hdl: float, smoker: bool, region: str = "low"
) -> float:
    """
    SCORE2 for ages 40-69 / SCORE2-OP for 70-89.
    Returns 10-year fatal + non-fatal CVD risk as percentage.
    Region: 'low', 'moderate', 'high', 'very_high' (European calibration).
    """
    non_hdl = total_chol - hdl

    if sex == "male":
        lp = (0.064 * (age - 60) + 0.006 * (sbp - 120)
              + 0.001 * (non_hdl - 136) + (0.440 if smoker else 0))
    else:
        lp = (0.076 * (age - 60) + 0.007 * (sbp - 120)
              + 0.002 * (non_hdl - 136) + (0.370 if smoker else 0))

    region_multiplier = {"low": 0.75, "moderate": 1.0, "high": 1.25, "very_high": 1.5}
    multiplier = region_multiplier.get(region, 1.0)

    raw_risk = 1 / (1 + math.exp(-lp))
    calibrated = raw_risk * multiplier * 100

    return round(max(0, min(calibrated, 100)), 1)
