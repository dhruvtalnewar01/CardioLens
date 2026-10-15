"""
CardioLens 3D: ML Schema & Leakage Firewall (Invariant I1)

Enforces strict exclusion of LAD, LCX, RCA, and Cath from all feature sets,
both during training and during serving.
"""

from typing import Iterable, Set, Dict, Any, Optional, List
from pydantic import BaseModel, Field, ConfigDict

FORBIDDEN_INPUTS: Set[str] = {"LAD", "LCX", "RCA", "Cath"}
TARGETS = ("CAD", "LAD", "LCX", "RCA")
LABEL_UNION_HOLDS = True

class LeakageFirewallViolation(ValueError):
    """Raised when any forbidden target column is present in feature inputs."""
    pass

def assert_no_leakage(columns: Iterable[str]) -> None:
    """
    Assert that none of the forbidden columns appear in the provided feature list.
    Enforces Invariant I1.
    """
    col_set = set(columns)
    leaked = col_set.intersection(FORBIDDEN_INPUTS)
    if leaked:
        raise LeakageFirewallViolation(
            f"Leakage Firewall Violation: Forbidden target column(s) detected in inputs: {sorted(list(leaked))}"
        )

class PatientInput(BaseModel):
    """
    Pydantic request model with strict extra='forbid' validation to prevent
    unrecognized or forbidden fields from entering the model.
    """
    model_config = ConfigDict(extra="forbid")

    case_id: Optional[str] = Field(default=None, description="De-identified random case identifier")
    features: Dict[str, Any] = Field(..., description="Feature key-value pairs matching catalog")

    def validate_firewall(self) -> None:
        assert_no_leakage(self.features.keys())

class TargetRisk(BaseModel):
    p: float = Field(..., ge=0.0, le=1.0)
    p_raw: Optional[float] = None
    band: str
    interval: Optional[List[float]] = None
    conformal_set: Optional[List[int]] = None
    coherence_adjusted: bool = False

class RiskState(BaseModel):
    schema_version: str = "1.0"
    model_version: str
    case_id: str
    source: str
    targets: Dict[str, TargetRisk]
    derived: Optional[Dict[str, float]] = None
