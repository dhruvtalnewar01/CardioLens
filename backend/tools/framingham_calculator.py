"""Framingham 10-year CVD Risk Score — Wilson et al. 1998."""
import math


def compute_framingham_score(
    age: int, sex: str, total_chol: float, hdl: float,
    sbp: float, bp_treatment: bool, smoker: bool, diabetic: bool
) -> float:
    """Returns 10-year CVD risk as percentage (e.g., 15.0 = 15%)."""
    if sex == "male":
        coeffs = {
            "log_age": 3.06117, "log_tc": 1.12370, "log_hdl": -0.93263,
            "log_sbp_t": 1.99881, "log_sbp_u": 1.93303,
            "smoker": 0.65451, "diabetes": 0.57367,
        }
        mean_coeff = 23.9802
        baseline_survival = 0.88936
    else:
        coeffs = {
            "log_age": 2.32888, "log_tc": 1.20904, "log_hdl": -0.70833,
            "log_sbp_t": 2.76157, "log_sbp_u": 2.82263,
            "smoker": 0.52873, "diabetes": 0.69154,
        }
        mean_coeff = 26.1931
        baseline_survival = 0.95012

    log_sbp_key = "log_sbp_t" if bp_treatment else "log_sbp_u"
    individual_sum = (
        coeffs["log_age"] * math.log(age)
        + coeffs["log_tc"] * math.log(total_chol)
        + coeffs["log_hdl"] * math.log(hdl)
        + coeffs[log_sbp_key] * math.log(sbp)
        + (coeffs["smoker"] if smoker else 0)
        + (coeffs["diabetes"] if diabetic else 0)
    )
    risk = 1 - baseline_survival ** math.exp(individual_sum - mean_coeff)
    return round(max(0, min(risk * 100, 100)), 1)
