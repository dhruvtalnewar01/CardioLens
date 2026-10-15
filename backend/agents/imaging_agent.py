"""Imaging Analysis Agent — uses gemini-1.5-pro for multimodal image analysis."""
import json
import base64
from utils.gemini_client import generate_structured_response

IMAGING_SCHEMA = """{
  "has_obstructive_cad": bool,
  "max_stenosis_percent": float,
  "most_affected_vessel": "LAD|LCx|RCA|Left_Main|None",
  "calcium_score_agatston": float,
  "calcium_percentile_for_age_sex": float,
  "plaque_burden_percent": float,
  "dominant_plaque_type": "calcified|fibrous|lipid_rich|mixed|none",
  "vulnerable_plaque_detected": bool,
  "left_ventricular_ef": float,
  "imaging_risk_contribution": 0.0-1.0,
  "findings_narrative": string,
  "urgent_catheterization_indicated": bool
}"""

AGATSTON_RISK = {
    0: "No identifiable plaque — very low risk",
    10: "Minimal plaque — low risk",
    100: "Mild plaque — mild-moderate risk",
    400: "Moderate plaque — moderate risk",
    999999: "Extensive plaque — high risk",
}


def classify_calcium_score(score: float) -> str:
    for threshold in sorted(AGATSTON_RISK.keys()):
        if score <= threshold:
            return AGATSTON_RISK[threshold]
    return "Extensive plaque — high risk"


async def analyze_imaging_report(report_text: str, modality: str) -> dict:
    """Analyze textual radiology report using Gemini Flash."""
    prompt = f"""Analyze this {modality} radiology report for cardiovascular findings:

REPORT:
{report_text}

Extract all coronary stenosis data, plaque characteristics, calcium scoring,
and ventricular function metrics."""

    return await generate_structured_response(prompt, IMAGING_SCHEMA, use_pro=False)


async def analyze_imaging_with_gemini(image_bytes: bytes, modality: str) -> dict:
    """Multimodal image analysis using Gemini 1.5 Pro (direct image input)."""
    image_part = {
        "inline_data": {
            "mime_type": "image/png",
            "data": base64.b64encode(image_bytes).decode(),
        }
    }

    prompt = f"""You are a board-certified radiologist analyzing a {modality} image.
Identify stenosis severity, plaque characteristics, calcium burden,
and ventricular function. Output JSON matching the ImagingAnalysisResult schema."""

    return await generate_structured_response(
        prompt=prompt, schema_description=IMAGING_SCHEMA,
        use_pro=True, image_parts=[image_part],
    )
