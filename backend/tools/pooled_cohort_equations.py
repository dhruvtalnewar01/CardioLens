"""ACC/AHA Pooled Cohort Equations — Goff et al. 2014. 10-year ASCVD risk."""
import math


def compute_pooled_cohort_equations(
    age: int, sex: str, race: str, total_chol: float, hdl: float,
    sbp: float, bp_treatment: bool, diabetes: bool, smoker: bool
) -> float:
    """Returns 10-year ASCVD risk as percentage. Race: 'white' or 'aa'."""
    ln_age = math.log(age)
    ln_tc = math.log(total_chol)
    ln_hdl = math.log(hdl)
    ln_sbp = math.log(sbp)

    if sex == "male" and race == "white":
        s = (12.344 * ln_age + 11.853 * ln_tc - 2.664 * ln_hdl
             + (1.764 if bp_treatment else 1.797) * ln_sbp
             + (0.658 if smoker else 0) + (0.661 if diabetes else 0))
        baseline = 0.9144
        mean_coeff = 61.18
    elif sex == "male" and race == "aa":
        s = (2.469 * ln_age + 0.302 * ln_tc - 0.307 * ln_hdl
             + (1.916 if bp_treatment else 1.809) * ln_sbp
             + (0.549 if smoker else 0) + (0.645 if diabetes else 0))
        baseline = 0.8954
        mean_coeff = 19.54
    elif sex == "female" and race == "white":
        s = (-29.799 * ln_age + 4.884 * (ln_age ** 2) + 13.540 * ln_tc
             - 3.114 * ln_hdl + (2.019 if bp_treatment else 1.957) * ln_sbp
             + (7.574 if smoker else 0) + (0.661 if diabetes else 0)
             + (-1.665 * ln_age * (1 if smoker else 0)))
        baseline = 0.9665
        mean_coeff = -29.18
    else:  # female, aa
        s = (17.114 * ln_age + 0.940 * ln_tc - 18.920 * ln_hdl
             + 4.475 * (math.log(hdl) if hdl > 0 else 0)
             + (29.291 if bp_treatment else 27.820) * ln_sbp
             + (-6.432 if bp_treatment else -6.087) * ln_sbp * ln_age
             + (0.874 if smoker else 0) + (0.874 if diabetes else 0))
        baseline = 0.9533
        mean_coeff = 86.61

    risk = 1 - baseline ** math.exp(s - mean_coeff)
    return round(max(0, min(risk * 100, 100)), 1)
