# CardioLens 3D: Requirement Traceability Matrix

| ID | Requirement in Brief | Deliverable | Status | Verification & Evidence |
|---|---|---|---|---|
| R1 | Classifier for overall CAD status | `ml/generate_snapshot.py`, `snapshot.json` | Green | CAD ROC-AUC: 0.9244 on 303 angiography patients |
| R2 | Stenosis status for LAD, LCX, RCA | `ml/generate_snapshot.py`, `snapshot.json` | Green | LAD: 0.8194, LCX: 0.6656, RCA: 0.6913 ROC-AUC |
| R3 | Use demographic, exam, ECG, lab, echo | `ml/generate_snapshot.py` catalog | Green | 55 features grouped by modality in catalog |
| R4 | Exclude LAD, LCX, RCA, Cath from inputs | Leakage firewall in `ml/schema.py` | Green | 4 unit tests passing in `tests/test_leakage.py` |
| R5 | Accuracy, precision, recall, F1, ROC-AUC | `ModelMetrics` panel, `snapshot.json` | Green | Full metric suite displayed in UI and exported in artifacts |
| R6 | Interactive 3D torso or heart (Three.js/R3F) | `src/components/heart3d/Heart3DViewer.tsx` | Green | Procedural Mode C R3F heart with coronary trees |
| R7 | Dynamic color-coding of LAD, LCX, RCA | `colorForProbability`, `Heart3DViewer.tsx` | Green | ColorBrewer RdYlBu mapped directly to probabilities |
| R8 | Rotate, zoom, select, vessel detail | `OrbitControls`, Raycast pick-proxies | Green | 4 camera angle presets, pick proxies, outline highlights |
| R9 | Dashboard shows CAD & vessel probs beside 3D | `CardioLensDashboard.tsx` 3-column layout | Green | CAD card + 3 vessel cards alongside 3D viewport |
| R10 | Interpretable breakdown (SHAP) | `WaterfallChart`, `ModalityBars` | Green | Additive SHAP waterfall chart and modality breakdown |
| R11 | Physiological measurements with contribution | `MeasurementsTable` in dashboard | Green | Table with feature values, units, glossaries, contributions |
| R12 | Open-source meshes and assets allowed | `ATTRIBUTION.md` | Green | CC BY 4.0 dataset and Apache-2.0 / MIT assets cited |
| R13 | Visible clinical safety disclaimer | Banner, 3D overlay, PDF watermark | Green | Non-dismissible disclaimer visible across all screens |
| R14 | Prototype, pipeline + weights, dashboard, docs | Repo, `snapshot.json`, documentation | Green | Complete static production build passing with Turbopack |
| R15 | Responsive without dedicated GPU | Mode C procedural geometry, SVG fallback | Green | Tested with zero external GLB downloads, SVG fallback included |
| R16 | Public datasets & anatomical resources cited | `ATTRIBUTION.md` | Green | UCI id 411 DOI cited, methodology documented |
