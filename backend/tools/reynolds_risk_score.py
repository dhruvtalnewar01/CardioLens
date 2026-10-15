"""Reynolds Risk Score — Ridker et al. 2007/2008."""
import math


def compute_reynolds_risk(
    age: int, sex: str, sbp: float, total_chol: float, hdl: float,
    crp_hs: float, hba1c: float = None, family_hx_premature_mi: bool = False
) -> float:
    """Returns 10-year CVD risk as percentage."""
    if sex == "female":
        b = (0.0799 * age + 3.137 * math.log(sbp) + 0.180 * math.log(crp_hs)
             + 1.382 * math.log(total_chol) - 1.172 * math.log(hdl)
             + (0.818 if family_hx_premature_mi else 0))
        risk = 1 - 0.98634 ** math.exp(b - 22.325)
    else:
        b = (0.0605 * age + 0.357 * math.log(sbp) + 0.270 * math.log(crp_hs)
             + 0.935 * math.log(total_chol) - 0.772 * math.log(hdl)
             + (0.443 if family_hx_premature_mi else 0)
             + (0.373 * math.log(hba1c if hba1c and hba1c > 0 else 5.0)))
        risk = 1 - 0.8990 ** math.exp(b - 8.281)

    return round(max(0, min(risk * 100, 100)), 1)
