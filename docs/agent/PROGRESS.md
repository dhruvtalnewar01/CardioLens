# CardioLens 3D: Agent Progress Log

## Phase: Production Integration & Core MVP Completion

### Done
1. **Data & ML Pipeline Verification**:
   - Analyzed the Z-Alizadeh Sani extension dataset (303 patients, 59 columns).
   - Executed `ml/generate_snapshot.py` with 5x5 nested stratified cross-validation and Platt calibration.
   - Generated `public/data/snapshot.json` (2.77 MB) with 303 out-of-fold patient cases, 4 targets (CAD, LAD, LCX, RCA), 55 input features, and additive SHAP attribution vectors.
   - Reached CAD ROC-AUC of 0.9244, LAD ROC-AUC of 0.8194, LCX ROC-AUC of 0.6656, and RCA ROC-AUC of 0.6913.

2. **Leakage Firewall (Invariant I1)**:
   - Defined `ml/schema.py` containing `FORBIDDEN_INPUTS = {"LAD", "LCX", "RCA", "Cath"}` and `assert_no_leakage`.
   - Built unit tests in `tests/test_leakage.py` testing rejection of leaked targets and verified zero leakage in `snapshot.json`.
   - All 4 pytest unit tests passed cleanly.

3. **3D Coronary Anatomy Viewer (Mode C)**:
   - Implemented `src/components/heart3d/Heart3DViewer.tsx` using React Three Fiber with procedural heart shell and coronary artery tubes (LAD with D1/D2 branches, LCX with OM branch, RCA with PDA branch).
   - Color mapping uses ColorBrewer RdYlBu color ramp.
   - Integrated camera angle presets (Anterior, Left Lateral, Posterior, Inferior/Apex).
   - Added `HeartFallbackSVG.tsx` for 2D schematic rendering when WebGL is unavailable.

4. **CardioLens 3D Production Dashboard**:
   - Built `src/components/dashboard/CardioLensDashboard.tsx` with responsive 3-column layout.
   - Risk summary cards for CAD, LAD, LCX, and RCA with ground truth catheterization indicators.
   - Interactive SHAP waterfall chart and modality-level net contribution bars.
   - Measurements table sorted by absolute contribution with feature units and glossary descriptions.
   - What-If Sensitivity Simulator with sliders for BP, LDL, HDL, Triglycerides, BMI, and Smoking status, updating probabilities in real-time and recoloring the 3D heart.
   - Grounded Clinical Narrative with Clinician View and Patient-Friendly View (strictly bounded by model payload numbers, Invariant I3).
   - 303-case Explorer with sorting by target probability and filtering by ground truth status.
   - Report Export via `jsPDF` (`src/lib/exportPdf.ts`) generating clinical summary PDF with mandatory clinical safety disclaimer watermark.

5. **Legacy Retirement & Invariant Compliance**:
   - Retired legacy `CHDScrollSections.tsx` (containing Framingham/GRACE/TIMI calculators, PHI collection, and drug dosing recommendations) to `src/legacy/CHDScrollSections.tsx`.
   - Updated `src/app/page.tsx` and `src/components/AIPredictionHeader.tsx` to mount CardioLens 3D seamlessly beneath the scroll-driven hero sequence.
   - Enforced zero em dashes and zero en dashes across active source files.

### Evidence
- `python -m pytest tests/test_leakage.py -v`: 4 passed in 0.49s.
- `npm run build`: Compiled successfully in 7.5s, static pages generated cleanly.

### Decisions
- Retained procedural 3D geometry (Mode C) as primary visual engine to guarantee 100% offline reliability without heavy external mesh assets or CDN dependencies.
- Standardized probability color ramp on ColorBrewer RdYlBu to ensure color-vision-deficiency accessibility.
- Embedded clinical safety disclaimer across the UI header, 3D canvas corner, and exported PDF reports.

### Next Steps
- Validate live user experience in browser preview.
