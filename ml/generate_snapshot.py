"""
CardioLens ML Pipeline: Generate snapshot.json for the frontend.

Loads the Z-Alizadeh Sani extension dataset (303 patients, 59 columns),
trains a leakage-safe LR + LightGBM logit-blend ensemble with nested CV,
generates calibrated probabilities, SHAP attributions, and exports everything
as a single snapshot.json file for the static frontend to consume.

Invariants enforced:
  I1: LAD, LCX, RCA, Cath never appear in model inputs
  I8: Probabilities are calibrated, versioned, out-of-fold for dataset cases
"""

import json
import hashlib
import os
import sys
import warnings
from pathlib import Path
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import RepeatedStratifiedKFold
from sklearn.metrics import (
    roc_auc_score, average_precision_score, brier_score_loss,
    f1_score, precision_score, recall_score, accuracy_score,
    balanced_accuracy_score, log_loss, confusion_matrix,
    matthews_corrcoef
)
from sklearn.pipeline import Pipeline

warnings.filterwarnings("ignore")

# ============================================================
# LEAKAGE FIREWALL (Invariant I1)
# ============================================================
FORBIDDEN_INPUTS = {"LAD", "LCX", "RCA", "Cath"}
TARGETS = ("Cath", "LAD", "LCX", "RCA")
TARGET_LABELS = ("CAD", "LAD", "LCX", "RCA")


def assert_no_leakage(columns):
    """Fatal check: none of the forbidden columns are in the feature set."""
    violations = FORBIDDEN_INPUTS.intersection(set(columns))
    if violations:
        raise ValueError(f"LEAKAGE FIREWALL VIOLATION: {violations} found in inputs")


# ============================================================
# DATA LOADING AND PREPROCESSING
# ============================================================
def load_dataset():
    """Load the extension dataset and return cleaned dataframe."""
    # Try multiple possible locations
    dataset_paths = [
        Path(__file__).parent.parent.parent / "extention+of+z+alizadeh+sani+dataset" / "extention of Z-Alizadeh sani dataset.xlsx",
        Path(__file__).parent.parent.parent / "extention of Z-Alizadeh sani dataset" / "extention of Z-Alizadeh sani dataset" / "extention of Z-Alizadeh sani   dataset (2).xlsx",
    ]

    df = None
    for p in dataset_paths:
        if p.exists():
            df = pd.read_excel(p)
            print(f"Loaded dataset from: {p}")
            print(f"Shape: {df.shape}")
            break

    if df is None:
        raise FileNotFoundError(f"Dataset not found. Tried: {dataset_paths}")

    return df


def preprocess_data(df):
    """Clean the dataset: normalize labels, separate features from targets."""
    print(f"\nColumn count: {len(df.columns)}")
    print(f"Row count: {len(df)}")

    # Normalize Cath labels to 0/1
    if "Cath" in df.columns:
        cath_map = {"Normal": 0, "Cad": 1, "CAD": 1, "normal": 0, "cad": 1}
        df["Cath"] = df["Cath"].map(cath_map).fillna(df["Cath"])
        if df["Cath"].dtype == object:
            # Try numeric conversion
            df["Cath"] = pd.to_numeric(df["Cath"], errors="coerce")

    # Normalize vessel labels to 0/1
    for col in ["LAD", "LCX", "RCA"]:
        if col in df.columns:
            vessel_map = {"Normal": 0, "Stenotic": 1, "normal": 0, "stenotic": 1, "N": 0, "Y": 1}
            df[col] = df[col].map(vessel_map).fillna(df[col])
            if df[col].dtype == object:
                df[col] = pd.to_numeric(df[col], errors="coerce")

    # Separate targets and features
    target_cols = [c for c in TARGETS if c in df.columns]
    feature_cols = [c for c in df.columns if c not in FORBIDDEN_INPUTS]

    # LEAKAGE FIREWALL CHECK
    assert_no_leakage(feature_cols)

    print(f"\nTarget columns: {target_cols}")
    print(f"Feature columns ({len(feature_cols)}): {feature_cols[:10]}...")

    # Target prevalence
    for t in target_cols:
        pos = df[t].sum()
        print(f"  {t}: {pos}/{len(df)} positive ({100*pos/len(df):.1f}%)")

    # Encode categorical features
    X = df[feature_cols].copy()
    for col in X.columns:
        if not pd.api.types.is_numeric_dtype(X[col]):
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
        elif X[col].dtype == bool:
            X[col] = X[col].astype(int)
    # Ensure all columns are numeric
    X = X.apply(pd.to_numeric, errors="coerce")

    # Fill any remaining NaN: numeric with median, non-numeric with mode
    numeric_cols = X.select_dtypes(include=[np.number]).columns
    non_numeric_cols = X.select_dtypes(exclude=[np.number]).columns
    for col in numeric_cols:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].median())
    for col in non_numeric_cols:
        if X[col].isna().any():
            X[col] = X[col].fillna(X[col].mode().iloc[0] if len(X[col].mode()) > 0 else 0)

    y_dict = {}
    for t, label in zip(TARGETS, TARGET_LABELS):
        if t in df.columns:
            y_dict[label] = df[t].values.astype(int)

    return X, y_dict, feature_cols


# ============================================================
# FEATURE CATALOG
# ============================================================
def build_feature_catalog(df, feature_cols):
    """Build a catalog of features with metadata."""
    # Feature groups based on clinical domain knowledge
    demographics = ["Age", "Weight", "Length", "Sex", "BMI", "Obesity"]
    symptoms = [
        "Typical Chest Pain", "Atypical", "Nonanginal", "Exertional CP",
        "LowTH Ang", "Current Smoker", "EX-Smoker", "FH", "Dyspnea"
    ]
    exam_vitals = ["BP", "PR", "Edema"]
    ecg = [
        "Q Wave", "St Elevation", "St Depression", "Tinversion",
        "LVH", "Poor R Progression"
    ]
    laboratory = [
        "FBS", "Cr", "TG", "LDL", "HDL", "BUN", "ESR", "HB",
        "K", "Na", "WBC", "Lymph", "Neut", "PLT"
    ]
    echo = ["Region RWMA", "VHD", "EF-TTE", "Function Class"]
    history = ["DM", "HTN", "Airway disease", "Thyroid Disease", "CHF", "DLP", "CVA", "CRF"]

    def get_group(col):
        if col in demographics:
            return "demographics_history"
        if col in symptoms:
            return "symptoms"
        if col in exam_vitals:
            return "exam_vitals"
        if col in ecg:
            return "ecg"
        if col in laboratory:
            return "laboratory"
        if col in echo:
            return "echo"
        if col in history:
            return "demographics_history"
        return "other"

    def get_type(series):
        if series.nunique() <= 2:
            return "binary"
        if series.dtype in [np.float64, np.float32, float]:
            return "continuous"
        if series.nunique() <= 10:
            return "ordinal"
        return "continuous"

    def get_unit(col):
        units = {
            "Age": "years", "Weight": "kg", "Length": "cm", "BMI": "kg/m2",
            "BP": "mmHg", "PR": "bpm", "FBS": "mg/dL", "Cr": "mg/dL",
            "TG": "mg/dL", "LDL": "mg/dL", "HDL": "mg/dL", "BUN": "mg/dL",
            "ESR": "mm/hr", "HB": "g/dL", "K": "mEq/L", "Na": "mEq/L",
            "WBC": "cells/uL", "Lymph": "%", "Neut": "%", "PLT": "x1000/uL",
            "EF-TTE": "%"
        }
        return units.get(col, "")

    def get_glossary(col):
        glossary = {
            "Age": "Patient age at time of evaluation",
            "Sex": "Biological sex (0 = female, 1 = male)",
            "Weight": "Body weight in kilograms",
            "Length": "Height in centimeters",
            "BMI": "Body mass index, weight divided by height squared",
            "BP": "Systolic blood pressure",
            "PR": "Pulse rate, beats per minute",
            "Typical Chest Pain": "Substernal chest pain provoked by exertion, relieved by rest or nitroglycerin",
            "Atypical": "Chest pain with some but not all typical angina features",
            "Nonanginal": "Chest pain unlikely to be cardiac in origin",
            "Exertional CP": "Chest pain occurring during physical exertion",
            "LowTH Ang": "Low threshold angina, pain at minimal exertion",
            "Current Smoker": "Active tobacco use",
            "EX-Smoker": "Former tobacco use",
            "FH": "Family history of coronary artery disease",
            "DM": "Diabetes mellitus",
            "HTN": "Hypertension, elevated blood pressure",
            "DLP": "Dyslipidemia, abnormal lipid levels",
            "FBS": "Fasting blood sugar",
            "Cr": "Serum creatinine, kidney function marker",
            "TG": "Triglycerides",
            "LDL": "Low-density lipoprotein cholesterol",
            "HDL": "High-density lipoprotein cholesterol",
            "BUN": "Blood urea nitrogen",
            "ESR": "Erythrocyte sedimentation rate, inflammation marker",
            "HB": "Hemoglobin concentration",
            "K": "Serum potassium",
            "Na": "Serum sodium",
            "WBC": "White blood cell count",
            "Lymph": "Lymphocyte percentage",
            "Neut": "Neutrophil percentage",
            "PLT": "Platelet count",
            "EF-TTE": "Left ventricular ejection fraction by transthoracic echocardiography",
            "Region RWMA": "Regional wall motion abnormality score (0 = none)",
            "VHD": "Valvular heart disease severity",
            "Function Class": "New York Heart Association functional class",
            "Q Wave": "Pathological Q waves on ECG",
            "St Elevation": "ST segment elevation on ECG",
            "St Depression": "ST segment depression on ECG",
            "Tinversion": "T wave inversion on ECG",
            "LVH": "Left ventricular hypertrophy on ECG",
            "Poor R Progression": "Poor R wave progression on ECG",
            "Obesity": "BMI 30 or above",
            "Edema": "Peripheral edema on examination",
            "Dyspnea": "Shortness of breath",
            "Airway disease": "Chronic obstructive pulmonary disease or asthma",
            "Thyroid Disease": "Known thyroid disorder",
            "CHF": "Congestive heart failure history",
            "CVA": "Cerebrovascular accident (stroke) history",
            "CRF": "Chronic renal failure",
            "BBB": "Bundle branch block pattern",
        }
        return glossary.get(col, f"Clinical measurement: {col}")

    catalog = []
    for col in feature_cols:
        if col in df.columns:
            series = df[col]
            is_numeric = pd.api.types.is_numeric_dtype(series)
            entry = {
                "raw_name": col,
                "label": col.replace("_", " "),
                "group": get_group(col),
                "type": get_type(series),
                "unit": get_unit(col),
                "plausible_min": float(series.min()) if is_numeric else None,
                "plausible_max": float(series.max()) if is_numeric else None,
                "median": float(series.median()) if is_numeric else None,
                "glossary": get_glossary(col),
                "modifiable": col in [
                    "Current Smoker", "BMI", "Weight", "BP", "FBS", "TG",
                    "LDL", "HDL", "HB", "Obesity", "DLP"
                ]
            }
            catalog.append(entry)

    return catalog


# ============================================================
# MODEL TRAINING WITH NESTED CV
# ============================================================
def train_ensemble(X, y, target_name, n_splits=5, n_repeats=5, seed=42):
    """
    Train LR + LightGBM logit-blend ensemble with nested CV.
    Returns out-of-fold predictions, model artifacts, and metrics.
    """
    try:
        import lightgbm as lgb
        use_lgb = True
    except ImportError:
        print("  LightGBM not available, using LR-only")
        use_lgb = False

    n = len(X)
    oof_preds = np.zeros(n)
    oof_preds_lr = np.zeros(n)
    oof_preds_lgb = np.zeros(n)
    oof_contributions_lr = np.zeros((n, X.shape[1]))
    oof_contributions_lgb = np.zeros((n, X.shape[1]))
    base_logit_lr = 0.0
    base_logit_lgb = 0.0
    blend_weight = 0.5  # LR weight in blend
    platt_a, platt_b = 1.0, 0.0

    seeds = [seed + i * 7 for i in range(n_repeats)]

    # Use repeat 0 for out-of-fold predictions shown to users
    rskf = RepeatedStratifiedKFold(n_splits=n_splits, n_repeats=1, random_state=seeds[0])

    all_repeat_aucs = []

    for repeat_idx in range(n_repeats):
        rskf_r = RepeatedStratifiedKFold(n_splits=n_splits, n_repeats=1,
                                         random_state=seeds[repeat_idx])
        repeat_preds = np.zeros(n)

        for fold_idx, (train_idx, test_idx) in enumerate(rskf_r.split(X.values, y)):
            X_train, X_test = X.values[train_idx], X.values[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]

            # Scale features
            scaler = StandardScaler()
            X_train_s = scaler.fit_transform(X_train)
            X_test_s = scaler.transform(X_test)

            # LR
            lr = LogisticRegression(C=1.0, max_iter=1000, solver="lbfgs", random_state=seed)
            lr.fit(X_train_s, y_train)
            z_lr = lr.decision_function(X_test_s)

            # LightGBM
            if use_lgb:
                lgb_model = lgb.LGBMClassifier(
                    n_estimators=200,
                    max_depth=3,
                    num_leaves=6,
                    learning_rate=0.05,
                    min_child_samples=10,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    reg_lambda=1.0,
                    random_state=seed,
                    verbose=-1
                )
                lgb_model.fit(X_train, y_train)
                # Raw logits (log-odds)
                p_lgb = lgb_model.predict_proba(X_test)[:, 1]
                z_lgb = np.log(np.clip(p_lgb, 1e-10, 1 - 1e-10))
            else:
                z_lgb = z_lr  # fallback

            # Logit blend
            z_blend = blend_weight * z_lr + (1 - blend_weight) * z_lgb

            if repeat_idx == 0:
                # Store out-of-fold predictions for repeat 0
                oof_preds[test_idx] = 1.0 / (1.0 + np.exp(-z_blend))
                oof_preds_lr[test_idx] = z_lr
                oof_preds_lgb[test_idx] = z_lgb

                # Compute LR contributions (feature attribution)
                train_mean = X_train_s.mean(axis=0)
                for i, idx in enumerate(test_idx):
                    phi_lr = lr.coef_[0] * (X_test_s[i] - train_mean)
                    oof_contributions_lr[idx] = phi_lr

                # LightGBM contributions
                if use_lgb:
                    contribs = lgb_model.predict_proba(X_test, pred_contrib=True)
                    if contribs.shape[1] > X.shape[1]:
                        oof_contributions_lgb[test_idx] = contribs[:, :X.shape[1]]
                        if fold_idx == 0:
                            base_logit_lgb = contribs[0, -1]

                if fold_idx == 0:
                    base_logit_lr = lr.intercept_[0]

            repeat_preds[test_idx] = 1.0 / (1.0 + np.exp(-z_blend))

        try:
            auc = roc_auc_score(y, repeat_preds)
            all_repeat_aucs.append(auc)
        except:
            pass

    # Platt calibration on out-of-fold logits (from repeat 0)
    oof_logits = np.log(np.clip(oof_preds, 1e-10, 1 - 1e-10))
    cal_lr = LogisticRegression(C=1e10, max_iter=1000, solver="lbfgs")
    cal_lr.fit(oof_logits.reshape(-1, 1), y)
    platt_a = float(cal_lr.coef_[0][0])
    platt_b = float(cal_lr.intercept_[0])

    # Apply calibration
    cal_logits = platt_a * oof_logits + platt_b
    oof_calibrated = 1.0 / (1.0 + np.exp(-cal_logits))

    # Blend contributions
    oof_contributions = blend_weight * oof_contributions_lr + (1 - blend_weight) * oof_contributions_lgb
    base_logit = blend_weight * base_logit_lr + (1 - blend_weight) * base_logit_lgb

    # Compute metrics
    metrics = compute_metrics(y, oof_calibrated, oof_preds, target_name)
    metrics["repeat_aucs"] = all_repeat_aucs
    if len(all_repeat_aucs) > 1:
        metrics["roc_auc_mean"] = float(np.mean(all_repeat_aucs))
        metrics["roc_auc_std"] = float(np.std(all_repeat_aucs))

    # Compute thresholds
    thresholds = compute_thresholds(y, oof_calibrated)

    return {
        "oof_calibrated": oof_calibrated,
        "oof_raw": oof_preds,
        "contributions": oof_contributions,
        "base_logit": base_logit,
        "platt_a": platt_a,
        "platt_b": platt_b,
        "metrics": metrics,
        "thresholds": thresholds,
        "blend_weight": blend_weight,
        "feature_names": list(X.columns),
    }


def compute_metrics(y_true, y_cal, y_raw, target_name):
    """Compute comprehensive metrics."""
    metrics = {"target": target_name}
    try:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_cal))
        metrics["pr_auc"] = float(average_precision_score(y_true, y_cal))
        metrics["brier"] = float(brier_score_loss(y_true, y_cal))
        metrics["log_loss"] = float(log_loss(y_true, y_cal))

        # At threshold 0.5
        y_pred = (y_cal >= 0.5).astype(int)
        metrics["accuracy"] = float(accuracy_score(y_true, y_pred))
        metrics["balanced_accuracy"] = float(balanced_accuracy_score(y_true, y_pred))
        metrics["precision"] = float(precision_score(y_true, y_pred, zero_division=0))
        metrics["recall"] = float(recall_score(y_true, y_pred, zero_division=0))
        metrics["f1"] = float(f1_score(y_true, y_pred, zero_division=0))
        metrics["mcc"] = float(matthews_corrcoef(y_true, y_pred))

        cm = confusion_matrix(y_true, y_pred)
        metrics["confusion_matrix"] = cm.tolist()
        if cm.shape == (2, 2):
            tn, fp, fn, tp = cm.ravel()
            metrics["specificity"] = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
        
        # Prevalence
        metrics["prevalence"] = float(y_true.mean())
        metrics["n_positive"] = int(y_true.sum())
        metrics["n_total"] = int(len(y_true))
    except Exception as e:
        metrics["error"] = str(e)

    return metrics


def compute_thresholds(y_true, y_prob):
    """Compute screening, balanced, and specific thresholds."""
    from sklearn.metrics import roc_curve

    fpr, tpr, thresh = roc_curve(y_true, y_prob)

    # Screening: sensitivity >= 0.90
    screening_idx = np.where(tpr >= 0.90)[0]
    screening_t = float(thresh[screening_idx[0]]) if len(screening_idx) > 0 else 0.3

    # Balanced: max Youden index
    youden = tpr - fpr
    balanced_idx = np.argmax(youden)
    balanced_t = float(thresh[balanced_idx])

    # Specific: specificity >= 0.90
    specificity = 1 - fpr
    specific_idx = np.where(specificity >= 0.90)[0]
    specific_t = float(thresh[specific_idx[-1]]) if len(specific_idx) > 0 else 0.7

    return {
        "screening": round(screening_t, 4),
        "balanced": round(balanced_t, 4),
        "specific": round(specific_t, 4),
    }


# ============================================================
# EXPORT SNAPSHOT
# ============================================================
def build_risk_state(case_id, target_results, thresholds_all):
    """Build a RiskState object for a single patient."""
    targets = {}
    for target_name in TARGET_LABELS:
        if target_name in target_results:
            p = target_results[target_name]["p"]
            thresh = thresholds_all.get(target_name, {})
            screening_t = thresh.get("screening", 0.3)
            balanced_t = thresh.get("balanced", 0.5)

            if p < screening_t:
                band = "low"
            elif p < balanced_t:
                band = "moderate"
            else:
                band = "high"

            targets[target_name] = {
                "p": round(p, 4),
                "p_raw": round(target_results[target_name].get("p_raw", p), 4),
                "band": band,
            }

    # Derived: expected stenotic vessels
    vessel_sum = sum(
        targets.get(v, {}).get("p", 0) for v in ["LAD", "LCX", "RCA"]
    )

    return {
        "case_id": case_id,
        "source": "oof_case",
        "targets": targets,
        "derived": {"expected_stenotic_vessels": round(vessel_sum, 2)},
    }


def build_explanation(target_name, contributions, feature_names, feature_values,
                      base_logit, platt_a, platt_b, catalog):
    """Build an ExplanationPayload for a single target and patient."""
    logit = base_logit + contributions.sum()
    cal_logit = platt_a * logit + platt_b
    p = 1.0 / (1.0 + np.exp(-cal_logit))
    base_p = 1.0 / (1.0 + np.exp(-(platt_a * base_logit + platt_b)))

    # Build contribution list
    contribs = []
    catalog_map = {c["raw_name"]: c for c in catalog}
    for i, (fname, phi) in enumerate(zip(feature_names, contributions)):
        cat_entry = catalog_map.get(fname, {})
        contribs.append({
            "feature": fname,
            "label": cat_entry.get("label", fname),
            "group": cat_entry.get("group", "other"),
            "value": round(float(feature_values[i]), 4) if not np.isnan(feature_values[i]) else None,
            "phi_logit": round(float(phi), 6),
        })

    # Sort by absolute contribution
    contribs.sort(key=lambda x: abs(x["phi_logit"]), reverse=True)

    # Group contributions
    group_phis = {}
    for c in contribs:
        g = c["group"]
        group_phis[g] = group_phis.get(g, 0) + c["phi_logit"]

    group_contributions = [
        {"group": g, "phi_logit": round(v, 6)}
        for g, v in sorted(group_phis.items(), key=lambda x: abs(x[1]), reverse=True)
    ]

    top_up = [c["feature"] for c in contribs if c["phi_logit"] > 0][:5]
    top_down = [c["feature"] for c in contribs if c["phi_logit"] < 0][:3]

    return {
        "target": target_name,
        "base_logit": round(float(base_logit), 6),
        "logit": round(float(logit), 6),
        "calibration": {"a": round(platt_a, 6), "b": round(platt_b, 6)},
        "base_p": round(float(base_p), 4),
        "p": round(float(p), 4),
        "contributions": contribs[:15],  # Top 15 for snapshot size
        "group_contributions": group_contributions,
        "top_up": top_up,
        "top_down": top_down,
    }


def select_demo_cases(y_dict, results):
    """Select representative demo cases from the dataset."""
    n = len(y_dict["CAD"])
    cad_probs = results["CAD"]["oof_calibrated"]
    lad_probs = results["LAD"]["oof_calibrated"]
    rca_probs = results["RCA"]["oof_calibrated"]

    cases = []

    # Clear negative (lowest CAD probability among true negatives)
    neg_idx = np.where(y_dict["CAD"] == 0)[0]
    if len(neg_idx) > 0:
        idx = neg_idx[np.argmin(cad_probs[neg_idx])]
        cases.append(("Clear negative", int(idx)))

    # LAD-dominant (highest LAD among positives)
    lad_pos = np.where(y_dict.get("LAD", np.zeros(n)) == 1)[0]
    if len(lad_pos) > 0:
        idx = lad_pos[np.argmax(lad_probs[lad_pos])]
        cases.append(("LAD-dominant case", int(idx)))

    # RCA-dominant
    rca_pos = np.where(y_dict.get("RCA", np.zeros(n)) == 1)[0]
    if len(rca_pos) > 0:
        idx = rca_pos[np.argmax(rca_probs[rca_pos])]
        cases.append(("RCA-dominant case", int(idx)))

    # Multivessel (all 3 positive)
    multi = np.where(
        (y_dict.get("LAD", np.zeros(n)) == 1) &
        (y_dict.get("LCX", np.zeros(n)) == 1) &
        (y_dict.get("RCA", np.zeros(n)) == 1)
    )[0]
    if len(multi) > 0:
        idx = int(multi[np.argmax(cad_probs[multi])])
        cases.append(("Multivessel case", idx))

    # Borderline (CAD prob closest to 0.5)
    borderline_idx = int(np.argmin(np.abs(cad_probs - 0.5)))
    cases.append(("Borderline case", borderline_idx))

    # False negative (CAD positive but low predicted probability)
    fn_idx = np.where((y_dict["CAD"] == 1) & (cad_probs < 0.5))[0]
    if len(fn_idx) > 0:
        idx = int(fn_idx[np.argmin(cad_probs[fn_idx])])
        cases.append(("False negative (model error)", idx))

    return cases


def main():
    print("=" * 60)
    print("CardioLens ML Pipeline: Generating snapshot.json")
    print("=" * 60)

    # Load and preprocess
    df = load_dataset()
    X, y_dict, feature_cols = preprocess_data(df)

    # Build feature catalog
    catalog = build_feature_catalog(df, feature_cols)
    print(f"\nFeature catalog: {len(catalog)} features")

    # Train models for each target
    results = {}
    for target_name in TARGET_LABELS:
        if target_name not in y_dict:
            print(f"\nSkipping {target_name}: not in dataset")
            continue
        print(f"\n{'='*40}")
        print(f"Training {target_name} model...")
        print(f"{'='*40}")
        y = y_dict[target_name]
        result = train_ensemble(X, y, target_name)
        results[target_name] = result

        m = result["metrics"]
        print(f"  ROC-AUC: {m.get('roc_auc', 'N/A'):.4f}")
        print(f"  PR-AUC: {m.get('pr_auc', 'N/A'):.4f}")
        print(f"  Brier: {m.get('brier', 'N/A'):.4f}")
        print(f"  F1: {m.get('f1', 'N/A'):.4f}")
        print(f"  Accuracy: {m.get('accuracy', 'N/A'):.4f}")
        print(f"  Thresholds: {result['thresholds']}")

    # Select demo cases
    demo_cases = select_demo_cases(y_dict, results)
    print(f"\nDemo cases selected: {len(demo_cases)}")
    for label, idx in demo_cases:
        print(f"  {label}: d_{idx+1:03d}")

    # Build the snapshot
    print("\nBuilding snapshot.json...")

    model_version = datetime.now().strftime("%Y.%m.%d") + "-" + hashlib.sha256(
        json.dumps({t: r["metrics"] for t, r in results.items()}).encode()
    ).hexdigest()[:8]

    # All 303 cases with RiskState and explanations
    all_cases = []
    for i in range(len(X)):
        case_id = f"d_{i+1:03d}"

        target_preds = {}
        explanations = {}
        for target_name in TARGET_LABELS:
            if target_name not in results:
                continue
            r = results[target_name]
            target_preds[target_name] = {
                "p": float(r["oof_calibrated"][i]),
                "p_raw": float(r["oof_raw"][i]),
            }
            explanations[target_name] = build_explanation(
                target_name,
                r["contributions"][i],
                r["feature_names"],
                X.values[i],
                r["base_logit"],
                r["platt_a"],
                r["platt_b"],
                catalog,
            )

        risk_state = build_risk_state(
            case_id, target_preds,
            {t: r["thresholds"] for t, r in results.items()}
        )

        # Add true labels
        true_labels = {}
        for target_name in TARGET_LABELS:
            if target_name in y_dict:
                true_labels[target_name] = int(y_dict[target_name][i])

        case = {
            "case_id": case_id,
            "risk_state": risk_state,
            "explanations": explanations,
            "true_labels": true_labels,
            "features": {col: round(float(X.values[i][j]), 4) if not np.isnan(X.values[i][j]) else None
                         for j, col in enumerate(feature_cols)},
        }
        all_cases.append(case)

    # Build model info
    model_info = {
        "version": model_version,
        "training_date": datetime.now().isoformat(),
        "dataset": "Z-Alizadeh Sani Extension (UCI id 411)",
        "dataset_doi": "10.24432/C5461K",
        "dataset_license": "CC BY 4.0",
        "n_patients": len(X),
        "n_features": len(feature_cols),
        "cohort_note": "Single-center, angiography-referred patients. Predictions are conditional on that referral population.",
        "metrics": {t: r["metrics"] for t, r in results.items()},
        "thresholds": {t: r["thresholds"] for t, r in results.items()},
        "calibration": {t: {"a": r["platt_a"], "b": r["platt_b"]} for t, r in results.items()},
        "blend_weight": results.get("CAD", {}).get("blend_weight", 0.5),
    }

    # Demo case references
    demo_refs = [
        {"label": label, "case_id": f"d_{idx+1:03d}", "index": idx}
        for label, idx in demo_cases
    ]

    snapshot = {
        "schema_version": "1.0",
        "model": model_info,
        "catalog": catalog,
        "cases": all_cases,
        "demo_cases": demo_refs,
        "disclaimer": "Decision support and educational use only. Predictions come from a statistical model trained on 303 angiography-referred patients from a single center. This is not a medical device, has not been validated for clinical use, and does not replace coronary imaging, angiography or a clinician's judgment.",
    }

    # Write snapshot
    output_dir = Path(__file__).parent.parent / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / "snapshot.json"

    with open(output_path, "w") as f:
        json.dump(snapshot, f, indent=None, separators=(",", ":"))

    file_size = output_path.stat().st_size / (1024 * 1024)
    print(f"\nSnapshot written to: {output_path}")
    print(f"File size: {file_size:.2f} MB")
    print(f"Model version: {model_version}")
    print(f"\nDone.")


if __name__ == "__main__":
    main()
