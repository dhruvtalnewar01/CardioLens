"""Drug interaction checker for cardiovascular pharmacotherapy."""
from typing import List, Dict

KNOWN_INTERACTIONS: Dict[str, Dict[str, str]] = {
    "atorvastatin": {
        "cyclosporine": "CONTRAINDICATED — rhabdomyolysis risk",
        "clarithromycin": "MAJOR — increased statin exposure via CYP3A4 inhibition",
        "gemfibrozil": "MAJOR — myopathy risk, prefer fenofibrate",
        "warfarin": "MODERATE — monitor INR, may increase anticoagulant effect",
        "diltiazem": "MODERATE — limit atorvastatin to 40mg max",
        "grapefruit": "MODERATE — CYP3A4 inhibition increases statin levels",
    },
    "rosuvastatin": {
        "cyclosporine": "CONTRAINDICATED — 7x exposure increase",
        "gemfibrozil": "MAJOR — myopathy risk",
        "warfarin": "MODERATE — monitor INR closely",
        "antacids": "MINOR — separate doses by 2 hours",
    },
    "clopidogrel": {
        "omeprazole": "MAJOR — CYP2C19 inhibition reduces clopidogrel efficacy",
        "aspirin": "EXPECTED — dual antiplatelet therapy (monitor bleeding)",
        "warfarin": "MAJOR — triple therapy bleeding risk",
    },
    "metoprolol": {
        "verapamil": "MAJOR — risk of severe bradycardia and heart block",
        "clonidine": "MAJOR — rebound hypertension on clonidine withdrawal",
        "fluoxetine": "MODERATE — CYP2D6 inhibition increases metoprolol levels",
    },
}


def check_drug_interactions(medications: List[str]) -> List[Dict[str, str]]:
    """Check all pairwise drug interactions from the known database."""
    interactions = []
    meds_lower = [m.lower().strip() for m in medications]

    for i, drug_a in enumerate(meds_lower):
        for drug_b in meds_lower[i + 1:]:
            if drug_a in KNOWN_INTERACTIONS and drug_b in KNOWN_INTERACTIONS[drug_a]:
                interactions.append({
                    "drug_a": drug_a, "drug_b": drug_b,
                    "severity": KNOWN_INTERACTIONS[drug_a][drug_b],
                })
            elif drug_b in KNOWN_INTERACTIONS and drug_a in KNOWN_INTERACTIONS[drug_b]:
                interactions.append({
                    "drug_a": drug_b, "drug_b": drug_a,
                    "severity": KNOWN_INTERACTIONS[drug_b][drug_a],
                })

    return interactions
