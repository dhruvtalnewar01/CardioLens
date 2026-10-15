"""
Unit tests for CardioLens 3D Leakage Firewall (Invariant I1).
"""

import os
import json
import pytest
from ml.schema import assert_no_leakage, LeakageFirewallViolation, FORBIDDEN_INPUTS

def test_firewall_rejects_forbidden_inputs():
    """Verify that every forbidden target column triggers a LeakageFirewallViolation."""
    for col in FORBIDDEN_INPUTS:
        with pytest.raises(LeakageFirewallViolation):
            assert_no_leakage(["Age", "Sex", "BP", col])

def test_firewall_rejects_multiple_leaks():
    """Verify multiple leaks raise cleanly."""
    with pytest.raises(LeakageFirewallViolation) as exc_info:
        assert_no_leakage(["Age", "LAD", "LCX", "RCA", "Cath"])
    assert "Forbidden target column(s) detected" in str(exc_info.value)

def test_firewall_accepts_valid_inputs():
    """Verify that standard physiological and exam features pass without error."""
    valid_features = [
        "Age", "Weight", "Length", "BMI", "BP", "PR", "FBS", "CR", "TG",
        "LDL", "HDL", "BUN", "ESR", "HB", "K", "Na", "WBC", "Lymph", "Neut",
        "PLT", "EF-TTE", "Region RWMA", "Typical Chest Pain", "Dyspnea"
    ]
    # Should not raise
    assert_no_leakage(valid_features)

def test_snapshot_artifact_leakage_free():
    """Verify public/data/snapshot.json contains zero forbidden features in catalog or inputs."""
    snapshot_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "public", "data", "snapshot.json"
    )
    if not os.path.exists(snapshot_path):
        pytest.skip("snapshot.json not generated yet")

    with open(snapshot_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    catalog_names = {entry["raw_name"] for entry in data.get("catalog", [])}
    assert not catalog_names.intersection(FORBIDDEN_INPUTS), (
        f"Forbidden columns found in catalog: {catalog_names.intersection(FORBIDDEN_INPUTS)}"
    )

    for case in data.get("cases", []):
        feat_keys = set(case.get("features", {}).keys())
        assert not feat_keys.intersection(FORBIDDEN_INPUTS), (
            f"Forbidden columns found in case features: {feat_keys.intersection(FORBIDDEN_INPUTS)}"
        )
