"""Clinical value validators — physiologically plausible ranges."""
from pydantic import field_validator
from typing import Optional


# Physiologically plausible ranges for clinical values
CLINICAL_RANGES = {
    "age": (0, 120),
    "height_cm": (30, 250),
    "weight_kg": (1, 400),
    "bmi": (8, 80),
    "systolic_bp": (40, 300),
    "diastolic_bp": (20, 200),
    "heart_rate": (20, 300),
    "oxygen_saturation": (50, 100),
    "temperature": (30, 45),
    "respiratory_rate": (4, 60),
    # Lipids (mg/dL)
    "total_cholesterol": (50, 600),
    "ldl_cholesterol": (10, 500),
    "hdl_cholesterol": (5, 150),
    "triglycerides": (20, 5000),
    # Inflammatory
    "crp_hs": (0, 200),
    "fibrinogen": (50, 1000),
    "homocysteine": (1, 100),
    # Cardiac markers
    "troponin_i": (0, 100),
    "troponin_t": (0, 50),
    "bnp": (0, 50000),
    "nt_pro_bnp": (0, 100000),
    # Metabolic
    "hba1c": (3, 20),
    "fasting_glucose": (20, 800),
    "creatinine": (0.1, 30),
    "egfr": (0, 200),
    "uric_acid": (0, 25),
    # Scores
    "calcium_score_agatston": (0, 10000),
    "ef_percent": (5, 85),
}


def validate_clinical_value(name: str, value: Optional[float]) -> Optional[float]:
    """Validate a clinical value is within physiologically plausible range."""
    if value is None:
        return None
    if name in CLINICAL_RANGES:
        low, high = CLINICAL_RANGES[name]
        if not (low <= value <= high):
            raise ValueError(
                f"{name}={value} is outside plausible range [{low}, {high}]"
            )
    return value


def compute_bmi(height_cm: float, weight_kg: float) -> float:
    """BMI = weight(kg) / height(m)^2."""
    if height_cm <= 0:
        raise ValueError("Height must be positive")
    height_m = height_cm / 100.0
    return round(weight_kg / (height_m ** 2), 1)


def compute_pulse_pressure(systolic: float, diastolic: float) -> float:
    """Pulse pressure = SBP - DBP. Normal: 30-60 mmHg."""
    return systolic - diastolic
