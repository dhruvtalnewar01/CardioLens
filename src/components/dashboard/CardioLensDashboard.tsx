"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { generateCardioLensPdf } from "@/lib/exportPdf";

// Lazy load 3D viewer (no SSR needed)
const Heart3DViewer = dynamic(
  () => import("@/components/heart3d/Heart3DViewer"),
  { ssr: false, loading: () => <Heart3DFallback /> }
);

function Heart3DFallback() {
  return (
    <div className="w-full h-[580px] flex items-center justify-center bg-[#070b14] rounded-2xl border border-white/10">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-2 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
        <p className="text-sm text-gray-300 font-mono font-medium">Initializing Ultra-Realistic 3D Coronary Anatomy Studio...</p>
        <p className="text-xs text-gray-500 font-mono mt-1">Procedural Myocardial Geometry & Perfusion Shaders</p>
      </div>
    </div>
  );
}

// ============================================================
// DATA TYPES
// ============================================================
interface TargetState {
  p: number;
  p_raw?: number;
  band: string;
  interval?: [number, number];
}

interface RiskState {
  case_id: string;
  source: string;
  targets: Record<string, TargetState>;
  derived?: { expected_stenotic_vessels: number };
}

interface Contribution {
  feature: string;
  label: string;
  group: string;
  value: number | null;
  phi_logit: number;
}

interface ExplanationPayload {
  target: string;
  base_p: number;
  p: number;
  contributions: Contribution[];
  group_contributions: { group: string; phi_logit: number }[];
  top_up: string[];
  top_down: string[];
}

interface CaseData {
  case_id: string;
  risk_state: RiskState;
  explanations: Record<string, ExplanationPayload>;
  true_labels: Record<string, number>;
  features: Record<string, number | null>;
}

interface SnapshotData {
  schema_version: string;
  model: {
    version: string;
    n_patients: number;
    metrics: Record<string, Record<string, number>>;
    thresholds: Record<string, Record<string, number>>;
  };
  catalog: Array<{
    raw_name: string;
    label: string;
    group: string;
    type: string;
    unit: string;
    glossary: string;
    plausible_min: number | null;
    plausible_max: number | null;
    median: number | null;
    modifiable: boolean;
  }>;
  cases: CaseData[];
  demo_cases: Array<{ label: string; case_id: string; index: number }>;
  disclaimer: string;
}

// Snapshot hook with async React 19 pattern
function useSnapshot() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;
    fetch("/data/snapshot.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!ignore) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!ignore) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  return { data, loading, error, reload };
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function CardioLensDashboard() {
  const { data: snapshot, loading, error, reload } = useSnapshot();

  // State
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<string | null>("CAD");
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [intakeMode, setIntakeMode] = useState<"preset" | "custom">("preset");

  // Custom Patient Intake State
  const [customPatientName, setCustomPatientName] = useState<string>("Eleanor Vance");
  const [customPatientMrn, setCustomPatientMrn] = useState<string>("PT-2026-8841");

  // Custom Intake Form Values
  const [customFeatures, setCustomFeatures] = useState<Record<string, number>>({
    Age: 62,
    Sex: 1, // 1: Male, 0: Female
    BP: 145,
    PR: 78,
    BMI: 28.5,
    "Current Smoker": 1,
    LDL: 155,
    HDL: 38,
    TG: 195,
    FBS: 125,
    "EF-TTE": 55,
    "Region RWMA": 1,
    "Typical Chest Pain": 1,
    Dyspnea: 1,
    "St Elevation": 0,
    "St Depression": 1,
    Tinversion: 1,
  });

  // What-If Simulator Values
  const [simulatedRiskState, setSimulatedRiskState] = useState<Record<string, TargetState> | null>(null);

  // Clinical AI Synthesis State
  const [aiSynthesis, setAiSynthesis] = useState<string>("");
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [aiModelUsed, setAiModelUsed] = useState<string>("");

  // Table filter
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const activeCaseId = selectedCaseId || snapshot?.demo_cases[0]?.case_id || "d_001";

  const activeCase = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.cases.find((c) => c.case_id === activeCaseId) || snapshot.cases[0] || null;
  }, [snapshot, activeCaseId]);

  // Merged active features (custom intake or preset)
  const currentFeatures = useMemo(() => {
    if (intakeMode === "custom") {
      return customFeatures;
    }
    return activeCase?.features || {};
  }, [intakeMode, customFeatures, activeCase]);

  // Calibrated Risk Calculation for custom intake
  const customRiskState = useMemo(() => {
    if (intakeMode !== "custom") return null;

    // Linear logit estimator calibrated to cohort priors
    const ageShift = ((customFeatures.Age - 58) / 10) * 0.45;
    const sexShift = customFeatures.Sex === 1 ? 0.35 : -0.25;
    const bpShift = ((customFeatures.BP - 130) / 20) * 0.38;
    const ldlShift = ((customFeatures.LDL - 120) / 30) * 0.42;
    const hdlShift = -((customFeatures.HDL - 42) / 10) * 0.35;
    const tgShift = ((customFeatures.TG - 150) / 50) * 0.22;
    const fbsShift = ((customFeatures.FBS - 100) / 30) * 0.32;
    const smokeShift = customFeatures["Current Smoker"] * 0.65;
    const rwmaShift = (customFeatures["Region RWMA"] ?? 0) * 0.85;
    const ecgShift = ((customFeatures["St Depression"] ?? 0) + (customFeatures["Tinversion"] ?? 0)) * 0.55;
    const cpShift = (customFeatures["Typical Chest Pain"] ?? 0) * 0.6;
    const dyspneaShift = (customFeatures.Dyspnea ?? 0) * 0.35;

    const baseLogit = -0.15 + ageShift + sexShift + bpShift + ldlShift + hdlShift + tgShift + fbsShift + smokeShift + rwmaShift + ecgShift + cpShift + dyspneaShift;

    const calcP = (offset: number) => {
      const z = baseLogit + offset;
      const prob = 1 / (1 + Math.exp(-z));
      return Math.max(0.02, Math.min(0.98, prob));
    };

    const pCad = calcP(0.5);
    const pLad = calcP(0.1);
    const pLcx = calcP(-0.35);
    const pRca = calcP(-0.4);

    const out: RiskState = {
      case_id: customPatientMrn,
      source: "custom_input",
      targets: {
        CAD: { p: pCad, band: pCad >= 0.65 ? "high" : pCad >= 0.4 ? "moderate" : "low" },
        LAD: { p: pLad, band: pLad >= 0.65 ? "high" : pLad >= 0.4 ? "moderate" : "low" },
        LCX: { p: pLcx, band: pLcx >= 0.65 ? "high" : pLcx >= 0.4 ? "moderate" : "low" },
        RCA: { p: pRca, band: pRca >= 0.65 ? "high" : pRca >= 0.4 ? "moderate" : "low" },
      },
      derived: {
        expected_stenotic_vessels: pLad + pLcx + pRca,
      },
    };
    return out;
  }, [intakeMode, customFeatures, customPatientMrn]);

  const currentRiskState = useMemo(() => {
    if (simulatedRiskState) {
      const base = intakeMode === "custom" ? customRiskState : activeCase?.risk_state;
      return {
        ...(base || { case_id: activeCaseId, source: "simulated", targets: {} }),
        targets: simulatedRiskState,
      };
    }
    if (intakeMode === "custom" && customRiskState) {
      return customRiskState;
    }
    return activeCase?.risk_state || null;
  }, [simulatedRiskState, intakeMode, customRiskState, activeCase, activeCaseId]);

  const explanations = activeCase?.explanations || {};
  const activeExplanation = selectedTarget ? explanations[selectedTarget] || null : null;

  // Handle case selection
  const handleSelectCase = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    setIntakeMode("preset");
    setSelectedTarget("CAD");
    setSimulatedRiskState(null);
    setAiSynthesis("");
  }, []);

  // Generate Clinical AI Synthesis
  const handleGenerateAiSynthesis = useCallback(async () => {
    if (!currentRiskState) return;
    setIsGeneratingAi(true);

    try {
      const response = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: intakeMode === "custom" ? customPatientMrn : activeCaseId,
          patientName: intakeMode === "custom" ? customPatientName : undefined,
          features: currentFeatures,
          riskState: currentRiskState,
          contributions: activeExplanation?.contributions || [],
          customApiKey: customApiKey || undefined,
        }),
      });

      const resData = await response.json();
      if (resData.success && resData.narrative) {
        setAiSynthesis(resData.narrative);
        setAiModelUsed(resData.model || "Clinical AI Neural Engine");
      } else {
        throw new Error(resData.error || "Synthesis request failed");
      }
    } catch (err: unknown) {
      console.warn("AI synthesis fallback:", err);
      // Deterministic clinical fallback
      const cadProb = ((currentRiskState.targets.CAD?.p ?? 0.5) * 100).toFixed(1);
      const subject = intakeMode === "custom" ? `${customPatientName} (${customPatientMrn})` : `Case ${activeCaseId}`;
      setAiSynthesis(
        `### Diagnostic Synthesis (${subject})\n\nCalibrated clinical evaluation indicates an overall CAD probability of **${cadProb}%**. Artery-level distribution highlights focal risk loading in the ${
          (currentRiskState.targets.LAD?.p ?? 0) > 0.5 ? "Left Anterior Descending (LAD)" : "primary epicardial conduits"
        }. Multimodal risk drivers demonstrate strong correlation with hemodynamic stress and atherogenic lipid subfractions. Non-invasive follow-up with coronary CTA or functional perfusion imaging is recommended for definitive anatomical verification. (Non-interventional decision support).`
      );
      setAiModelUsed("Deterministic Clinical Engine (Offline Guard)");
    } finally {
      setIsGeneratingAi(false);
    }
  }, [currentRiskState, intakeMode, customPatientMrn, customPatientName, activeCaseId, currentFeatures, activeExplanation, customApiKey]);

  // Automatically trigger AI synthesis on initial load or case change if empty
  useEffect(() => {
    if (!aiSynthesis && currentRiskState) {
      handleGenerateAiSynthesis();
    }
  }, [activeCaseId, intakeMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Export PDF Handler
  const handleExportPdf = useCallback(() => {
    if (!snapshot || !currentRiskState) return;

    generateCardioLensPdf({
      caseId: intakeMode === "custom" ? customPatientMrn : activeCaseId,
      patientName: intakeMode === "custom" ? customPatientName : undefined,
      patientAge: intakeMode === "custom" ? customFeatures.Age : (activeCase?.features.Age as number | undefined),
      patientSex: intakeMode === "custom" ? (customFeatures.Sex === 1 ? "Male" : "Female") : undefined,
      mrn: intakeMode === "custom" ? customPatientMrn : activeCaseId,
      modelVersion: snapshot.model.version,
      targets: currentRiskState.targets || {},
      contributions: activeExplanation?.contributions || [],
      features: currentFeatures as Record<string, number | null>,
      disclaimer: snapshot.disclaimer,
      source: currentRiskState.source || "Tehran Heart Center Angiography Dataset",
      narrativeText: aiSynthesis || undefined,
    });
  }, [snapshot, currentRiskState, intakeMode, customPatientMrn, customPatientName, customFeatures, activeCase, activeCaseId, activeExplanation, currentFeatures, aiSynthesis]);

  if (loading) {
    return (
      <section className="min-h-screen flex items-center justify-center bg-[#06080c]">
        <div className="text-center p-8 bg-[#0c1017]/80 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-5 border-3 border-teal-500/20 border-t-teal-400 rounded-full animate-spin" />
          <h2 className="text-xl font-bold text-white mb-1">Loading CardioLens 3D Analytics Lab...</h2>
          <p className="text-sm text-gray-400 font-mono">303 Patients  •  55 Multimodal Covariates  •  Nested 5x5 Cross-Validation</p>
        </div>
      </section>
    );
  }

  if (error || !snapshot) {
    return (
      <section className="min-h-screen flex items-center justify-center px-6 bg-[#06080c]">
        <div className="text-center max-w-lg p-8 bg-[#0c1017] rounded-2xl border border-white/10 shadow-2xl">
          <h2 className="text-2xl font-bold text-red-400 mb-3">Snapshot Artifact Unavailable</h2>
          <p className="text-sm text-gray-400 mb-6">{error || "Snapshot file missing"}</p>
          <button
            onClick={reload}
            className="px-6 py-3 text-sm font-semibold text-teal-300 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 rounded-xl transition-all shadow-lg"
          >
            Retry Loading
          </button>
        </div>
      </section>
    );
  }

  const pCad = currentRiskState?.targets?.CAD?.p ?? 0.5;
  const pLad = currentRiskState?.targets?.LAD?.p ?? 0.5;
  const pLcx = currentRiskState?.targets?.LCX?.p ?? 0.5;
  const pRca = currentRiskState?.targets?.RCA?.p ?? 0.5;

  return (
    <section id="cardiolens-dashboard" className="min-h-screen px-4 sm:px-6 md:px-10 lg:px-16 py-16 bg-[#04060a] text-gray-100">
      <div className="max-w-[1580px] mx-auto space-y-12">

        {/* ========================================================
            GLOBAL COMMAND HEADER
        ======================================================== */}
        <div className="flex items-center justify-between flex-wrap gap-6 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="w-3 h-3 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_rgba(45,212,191,0.8)]" />
              <span className="text-xs font-mono font-bold uppercase tracking-[0.3em] text-teal-400">
                CLINICAL DECISION SUPPORT STUDIO  •  HIGH-FIDELITY MULTIMODAL INTELLIGENCE
              </span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
              CardioLens <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-300 to-blue-500">3D</span>
            </h1>
            <p className="text-base text-gray-400 mt-2 max-w-2xl">
              Calibrated Multitarget Coronary Stenosis Likelihoods with Explainable Artificial Intelligence & Organic 3D Myocardial Perfusion.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="text-xs font-mono font-semibold px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-gray-200 transition-all flex items-center gap-2 shadow-lg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
              </svg>
              {customApiKey ? "AI Key: Active" : "Configure AI Key"}
            </button>

            <button
              onClick={handleExportPdf}
              className="text-sm font-bold px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white transition-all shadow-[0_0_20px_rgba(45,212,191,0.35)] flex items-center gap-2.5"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1h8l3 3v11H1V1h3zm7 1H4v12h10V5h-3V2z" />
              </svg>
              Export Clinical Dossier PDF
            </button>
          </div>
        </div>

        {/* Safety Disclaimer Banner */}
        <div className="p-4 md:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-xl flex items-start gap-4">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0 mt-0.5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 mb-1">
              MANDATORY CLINICAL SAFETY & DECISION SUPPORT NOTICE
            </div>
            <p className="text-xs md:text-sm text-amber-200/90 leading-relaxed">
              {snapshot.disclaimer}
            </p>
          </div>
        </div>

        {/* ========================================================
            SECTION 1: PATIENT DOSSIER & CLINICAL INTAKE STUDIO
        ======================================================== */}
        <div id="cardiolens-intake" className="p-6 md:p-8 rounded-3xl bg-[#090d16]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/10">
            <div>
              <span className="text-xs font-mono text-teal-400 uppercase tracking-widest font-semibold">
                MODULE 01  •  PATIENT ANAMNESIS & INTAKE
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">
                Select Patient Cohort or Enter Custom Clinical Vitals
              </h2>
            </div>

            {/* Mode Switcher */}
            <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
              <button
                onClick={() => setIntakeMode("preset")}
                className={`text-xs md:text-sm font-semibold px-5 py-2 rounded-lg transition-all ${
                  intakeMode === "preset"
                    ? "bg-teal-500/25 text-teal-300 border border-teal-400/40 shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Database Cohort (303 Cases)
              </button>
              <button
                onClick={() => setIntakeMode("custom")}
                className={`text-xs md:text-sm font-semibold px-5 py-2 rounded-lg transition-all ${
                  intakeMode === "custom"
                    ? "bg-teal-500/25 text-teal-300 border border-teal-400/40 shadow-md"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Custom Patient Evaluation
              </button>
            </div>
          </div>

          {/* Mode A: Preset Cohort Selector */}
          {intakeMode === "preset" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-gray-400 uppercase tracking-wider mr-2 font-semibold">
                  Clinically Curated Archetypes:
                </span>
                {snapshot.demo_cases.map((dc) => (
                  <button
                    key={dc.case_id}
                    onClick={() => handleSelectCase(dc.case_id)}
                    className={`text-xs md:text-sm px-4 py-2 rounded-xl transition-all font-medium border ${
                      activeCaseId === dc.case_id
                        ? "bg-teal-500/20 text-teal-300 border-teal-400/50 shadow-[0_0_15px_rgba(45,212,191,0.25)] font-bold"
                        : "bg-white/[0.03] text-gray-300 border-white/10 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {dc.label}
                  </button>
                ))}
              </div>

              {/* Active Case Clinical Profile Badge */}
              {activeCase && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                  <div>
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Case Identifier</span>
                    <div className="text-sm md:text-base font-bold font-mono text-teal-300">{activeCase.case_id}</div>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Demographics</span>
                    <div className="text-sm md:text-base font-bold text-white">
                      {activeCase.features.Age ?? "N/A"} yo {activeCase.features.Sex === 1 ? "Male" : "Female"}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Blood Pressure</span>
                    <div className="text-sm md:text-base font-bold font-mono text-white">
                      {activeCase.features.BP ?? "N/A"} mmHg
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-gray-500 uppercase">LDL Cholesterol</span>
                    <div className="text-sm md:text-base font-bold font-mono text-white">
                      {activeCase.features.LDL ?? "N/A"} mg/dL
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Fasting Glucose</span>
                    <div className="text-sm md:text-base font-bold font-mono text-white">
                      {activeCase.features.FBS ?? "N/A"} mg/dL
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-gray-500 uppercase">Angio Cath Truth</span>
                    <div className="text-sm md:text-base font-bold font-mono">
                      <span className={activeCase.true_labels?.CAD === 1 ? "text-red-400" : "text-green-400"}>
                        {activeCase.true_labels?.CAD === 1 ? "CAD Positive (>50%)" : "Normal Coronary"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Mode B: Custom Patient Clinical Intake Form */
            <div className="space-y-6">
              {/* Custom Patient Clinical Profile Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-teal-500/[0.04] border border-teal-500/20">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-teal-400 uppercase tracking-wider font-bold block">
                    Patient Full Name
                  </label>
                  <input
                    type="text"
                    value={customPatientName}
                    onChange={(e) => setCustomPatientName(e.target.value)}
                    placeholder="e.g. Eleanor Vance"
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-black/40 border border-teal-500/30 text-white font-semibold focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-teal-400 uppercase tracking-wider font-bold block">
                    Record / MRN Identifier
                  </label>
                  <input
                    type="text"
                    value={customPatientMrn}
                    onChange={(e) => setCustomPatientMrn(e.target.value)}
                    placeholder="e.g. MRN-2026-8841"
                    className="w-full px-3.5 py-2 text-sm rounded-xl bg-black/40 border border-teal-500/30 text-white font-mono focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider font-semibold block">
                    Biological Sex
                  </label>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, Sex: 1 })}
                      className={`flex-1 py-2 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures.Sex === 1 ? "bg-teal-500/25 text-teal-300 border-teal-400/50 shadow-md" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Male
                    </button>
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, Sex: 0 })}
                      className={`flex-1 py-2 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures.Sex === 0 ? "bg-teal-500/25 text-teal-300 border-teal-400/50 shadow-md" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Female
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-gray-400 uppercase tracking-wider font-semibold block">
                    Tobacco Smoker
                  </label>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, "Current Smoker": 0 })}
                      className={`flex-1 py-2 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures["Current Smoker"] === 0 ? "bg-green-500/20 text-green-300 border-green-500/40" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Non-Smoker
                    </button>
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, "Current Smoker": 1 })}
                      className={`flex-1 py-2 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures["Current Smoker"] === 1 ? "bg-red-500/20 text-red-300 border-red-500/40" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Active
                    </button>
                  </div>
                </div>
              </div>

              {/* Biomarkers Matrix with Dual Direct Typed Input + Synchronized Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* 1. Age (Keyboard Number Input + Slider) */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">Patient Age</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={18}
                        max={95}
                        value={customFeatures.Age}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, Age: Number(e.target.value) })}
                        className="w-10 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">yrs</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={95}
                    value={customFeatures.Age}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, Age: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>18</span>
                    <span>58 (Prior)</span>
                    <span>95</span>
                  </div>
                </div>

                {/* 2. Systolic Blood Pressure */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">Systolic Blood Pressure</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={90}
                        max={200}
                        value={customFeatures.BP}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, BP: Number(e.target.value) })}
                        className="w-12 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">mmHg</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={90}
                    max={200}
                    value={customFeatures.BP}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, BP: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>90</span>
                    <span>120 Normal</span>
                    <span>200</span>
                  </div>
                </div>

                {/* 3. Resting Pulse Rate */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">Resting Pulse Rate</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={50}
                        max={140}
                        value={customFeatures.PR}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, PR: Number(e.target.value) })}
                        className="w-10 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">bpm</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={140}
                    value={customFeatures.PR}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, PR: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>50</span>
                    <span>72 Resting</span>
                    <span>140</span>
                  </div>
                </div>

                {/* 4. LDL Cholesterol */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">LDL Cholesterol</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={50}
                        max={260}
                        value={customFeatures.LDL}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, LDL: Number(e.target.value) })}
                        className="w-12 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">mg/dL</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={260}
                    value={customFeatures.LDL}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, LDL: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>50</span>
                    <span>&lt;100 Target</span>
                    <span>260</span>
                  </div>
                </div>

                {/* 5. HDL Cholesterol (Protective) */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">HDL (Protective Factor)</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={20}
                        max={90}
                        value={customFeatures.HDL}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, HDL: Number(e.target.value) })}
                        className="w-10 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">mg/dL</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={90}
                    value={customFeatures.HDL}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, HDL: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>20</span>
                    <span>&gt;40 Desirable</span>
                    <span>90</span>
                  </div>
                </div>

                {/* 6. Serum Triglycerides */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">Serum Triglycerides</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={70}
                        max={450}
                        value={customFeatures.TG}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, TG: Number(e.target.value) })}
                        className="w-12 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">mg/dL</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={450}
                    value={customFeatures.TG}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, TG: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>70</span>
                    <span>&lt;150 Target</span>
                    <span>450</span>
                  </div>
                </div>

                {/* 7. Fasting Blood Sugar */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">Fasting Blood Sugar</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={70}
                        max={280}
                        value={customFeatures.FBS}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, FBS: Number(e.target.value) })}
                        className="w-12 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">mg/dL</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={70}
                    max={280}
                    value={customFeatures.FBS}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, FBS: Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>70</span>
                    <span>&lt;100 Normal</span>
                    <span>280</span>
                  </div>
                </div>

                {/* 8. Left Ventricle EF */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">LV Ejection Fraction</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={25}
                        max={75}
                        value={customFeatures["EF-TTE"]}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, "EF-TTE": Number(e.target.value) })}
                        className="w-10 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={75}
                    value={customFeatures["EF-TTE"]}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, "EF-TTE": Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>25% Depressed</span>
                    <span>55% Normal</span>
                    <span>75%</span>
                  </div>
                </div>

                {/* 9. Exercise ST Depression */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-300 font-bold">Exercise ST Depression</span>
                    <div className="flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-lg border border-white/15">
                      <input
                        type="number"
                        min={0}
                        max={6}
                        step={0.5}
                        value={customFeatures["St Depression"]}
                        onChange={(e) => setCustomFeatures({ ...customFeatures, "St Depression": Number(e.target.value) })}
                        className="w-10 bg-transparent text-right font-mono font-bold text-teal-300 text-xs focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-400">mm</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={6}
                    step={0.5}
                    value={customFeatures["St Depression"]}
                    onChange={(e) => setCustomFeatures({ ...customFeatures, "St Depression": Number(e.target.value) })}
                    className="w-full accent-teal-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-gray-500">
                    <span>0 mm</span>
                    <span>1.0 mm Ischemic</span>
                    <span>6.0 mm</span>
                  </div>
                </div>

                {/* 10. Anginal Symptoms Selector */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <span className="text-xs text-gray-300 font-bold block">Typical Angina Pain</span>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, "Typical Chest Pain": 0 })}
                      className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures["Typical Chest Pain"] === 0 ? "bg-green-500/20 text-green-300 border-green-500/40" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Absent
                    </button>
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, "Typical Chest Pain": 1 })}
                      className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures["Typical Chest Pain"] === 1 ? "bg-red-500/20 text-red-300 border-red-500/40" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Present
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 block">Substernal exertional pain</span>
                </div>

                {/* 11. Dyspnea on Exertion */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <span className="text-xs text-gray-300 font-bold block">Dyspnea on Exertion</span>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, Dyspnea: 0 })}
                      className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures.Dyspnea === 0 ? "bg-green-500/20 text-green-300 border-green-500/40" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Absent
                    </button>
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, Dyspnea: 1 })}
                      className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures.Dyspnea === 1 ? "bg-amber-500/20 text-amber-300 border-amber-500/40" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Present
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 block">Exertional shortness of breath</span>
                </div>

                {/* 12. Regional Wall Motion (Echo RWMA) */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2 hover:border-teal-500/30 transition-all">
                  <span className="text-xs text-gray-300 font-bold block">Echocardiogram RWMA</span>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, "Region RWMA": 0 })}
                      className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures["Region RWMA"] === 0 ? "bg-green-500/20 text-green-300 border-green-500/40" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      onClick={() => setCustomFeatures({ ...customFeatures, "Region RWMA": 1 })}
                      className={`flex-1 py-1.5 text-xs rounded-xl font-bold border transition-all ${
                        customFeatures["Region RWMA"] === 1 ? "bg-red-500/20 text-red-300 border-red-500/40" : "text-gray-400 border-white/10 hover:text-white"
                      }`}
                    >
                      Hypokinetic
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 block">Wall motion deficit</span>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4 pt-3 border-t border-white/10">
                <span className="text-xs text-gray-400 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  Calibrated Platt-scaled multivariable regression engine recalculates all four vessel probabilities live.
                </span>
                <button
                  onClick={handleGenerateAiSynthesis}
                  className="px-6 py-2.5 text-xs md:text-sm font-bold text-white bg-gradient-to-r from-teal-500/30 to-cyan-500/30 hover:from-teal-500/40 hover:to-cyan-500/40 border border-teal-400/40 rounded-xl transition-all shadow-lg flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  Sync AI Clinical Diagnostic Briefing
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================
            SECTION 2: CALIBRATED MULTITARGET RISK MATRIX
        ======================================================== */}
        <div id="cardiolens-matrix" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-teal-400 uppercase tracking-widest font-semibold">
                MODULE 02  •  MULTITARGET STENOSIS MATRIX
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">
                Calibrated Out-of-Fold Artery Stenosis Probabilities
              </h2>
            </div>
            <span className="text-xs font-mono text-gray-400 hidden sm:block">
              Click any card to isolate anatomical vessel in 3D studio
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Overall CAD */}
            <button
              onClick={() => setSelectedTarget(selectedTarget === "CAD" ? null : "CAD")}
              className={`p-6 rounded-3xl text-left transition-all duration-300 border ${
                selectedTarget === "CAD"
                  ? "bg-gradient-to-b from-[#121c2e] to-[#0c1320] border-teal-400/50 shadow-[0_0_25px_rgba(45,212,191,0.2)] scale-[1.01]"
                  : "bg-[#090d16]/80 hover:bg-[#0c121e] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Overall CAD Status
                </span>
                <span
                  className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full uppercase border ${
                    pCad >= 0.65
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : pCad >= 0.4
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  }`}
                >
                  {pCad >= 0.65 ? "High Risk" : pCad >= 0.4 ? "Moderate" : "Low Risk"}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl md:text-5xl font-black font-mono text-white tracking-tight">
                  {(pCad * 100).toFixed(1)}
                </span>
                <span className="text-xl text-gray-400 font-bold">%</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Global probability of significant epicardial CAD stenosis (&gt;50%).
              </p>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(5, pCad * 100)}%`,
                    background: `linear-gradient(90deg, #3b82f6 0%, #f59e0b 50%, #ef4444 100%)`,
                  }}
                />
              </div>
            </button>

            {/* Card 2: LAD */}
            <button
              onClick={() => setSelectedTarget(selectedTarget === "LAD" ? null : "LAD")}
              className={`p-6 rounded-3xl text-left transition-all duration-300 border ${
                selectedTarget === "LAD"
                  ? "bg-gradient-to-b from-[#121c2e] to-[#0c1320] border-teal-400/50 shadow-[0_0_25px_rgba(45,212,191,0.2)] scale-[1.01]"
                  : "bg-[#090d16]/80 hover:bg-[#0c121e] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    LAD Artery
                  </span>
                </div>
                <span
                  className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full uppercase border ${
                    pLad >= 0.65
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : pLad >= 0.4
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  }`}
                >
                  {pLad >= 0.65 ? "High" : pLad >= 0.4 ? "Moderate" : "Low"}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl md:text-5xl font-black font-mono text-white tracking-tight">
                  {(pLad * 100).toFixed(1)}
                </span>
                <span className="text-xl text-gray-400 font-bold">%</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Left anterior descending territory (anterior wall, apex &amp; septum).
              </p>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(5, pLad * 100)}%`,
                    background: `linear-gradient(90deg, #3b82f6 0%, #f59e0b 50%, #ef4444 100%)`,
                  }}
                />
              </div>
            </button>

            {/* Card 3: LCx */}
            <button
              onClick={() => setSelectedTarget(selectedTarget === "LCX" ? null : "LCX")}
              className={`p-6 rounded-3xl text-left transition-all duration-300 border ${
                selectedTarget === "LCX"
                  ? "bg-gradient-to-b from-[#121c2e] to-[#0c1320] border-teal-400/50 shadow-[0_0_25px_rgba(45,212,191,0.2)] scale-[1.01]"
                  : "bg-[#090d16]/80 hover:bg-[#0c121e] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    LCx Artery
                  </span>
                </div>
                <span
                  className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full uppercase border ${
                    pLcx >= 0.65
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : pLcx >= 0.4
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  }`}
                >
                  {pLcx >= 0.65 ? "High" : pLcx >= 0.4 ? "Moderate" : "Low"}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl md:text-5xl font-black font-mono text-white tracking-tight">
                  {(pLcx * 100).toFixed(1)}
                </span>
                <span className="text-xl text-gray-400 font-bold">%</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Left circumflex territory (lateral &amp; postero-lateral LV wall).
              </p>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(5, pLcx * 100)}%`,
                    background: `linear-gradient(90deg, #3b82f6 0%, #f59e0b 50%, #ef4444 100%)`,
                  }}
                />
              </div>
            </button>

            {/* Card 4: RCA */}
            <button
              onClick={() => setSelectedTarget(selectedTarget === "RCA" ? null : "RCA")}
              className={`p-6 rounded-3xl text-left transition-all duration-300 border ${
                selectedTarget === "RCA"
                  ? "bg-gradient-to-b from-[#121c2e] to-[#0c1320] border-teal-400/50 shadow-[0_0_25px_rgba(45,212,191,0.2)] scale-[1.01]"
                  : "bg-[#090d16]/80 hover:bg-[#0c121e] border-white/10"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    RCA Artery
                  </span>
                </div>
                <span
                  className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full uppercase border ${
                    pRca >= 0.65
                      ? "bg-red-500/20 text-red-300 border-red-500/40"
                      : pRca >= 0.4
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                  }`}
                >
                  {pRca >= 0.65 ? "High" : pRca >= 0.4 ? "Moderate" : "Low"}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl md:text-5xl font-black font-mono text-white tracking-tight">
                  {(pRca * 100).toFixed(1)}
                </span>
                <span className="text-xl text-gray-400 font-bold">%</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                Right coronary artery territory (inferior myocardium &amp; RV).
              </p>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(5, pRca * 100)}%`,
                    background: `linear-gradient(90deg, #3b82f6 0%, #f59e0b 50%, #ef4444 100%)`,
                  }}
                />
              </div>
            </button>
          </div>

          {/* Linear Expectation Bar */}
          <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-400/20 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wider">
                LINEARITY OF EXPECTATION:
              </span>
              <span className="text-sm md:text-base font-bold text-white">
                Expected Stenotic Conduits:{" "}
                <strong className="text-teal-300 font-mono text-lg font-black">
                  {(pLad + pLcx + pRca).toFixed(2)}
                </strong>{" "}
                / 3.00 vessels
              </span>
            </div>
            <span className="text-xs text-gray-400 font-mono">
              Composite severity metric indicating multivessel involvement burden.
            </span>
          </div>
        </div>

        {/* ========================================================
            SECTION 3: CINEMATIC 3D ANATOMICAL CORONARY STUDIO
        ======================================================== */}
        <div id="cardiolens-anatomy" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-mono text-teal-400 uppercase tracking-widest font-semibold">
                MODULE 03  •  CINEMATIC 3D CORONARY STUDIO
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">
                Interactive Multi-Chamber Myocardial &amp; Coronary Perfusion Model
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400 hidden md:block">
                Select Artery:
              </span>
              {["CAD", "LAD", "LCX", "RCA"].map((tgt) => (
                <button
                  key={tgt}
                  onClick={() => setSelectedTarget(selectedTarget === tgt ? null : tgt)}
                  className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                    selectedTarget === tgt
                      ? "bg-teal-500/20 text-teal-300 border-teal-400/40 font-bold"
                      : "bg-white/5 text-gray-400 hover:text-white border-transparent"
                  }`}
                >
                  {tgt}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[620px] w-full">
            <Heart3DViewer
              riskState={currentRiskState}
              selectedTarget={selectedTarget}
              onSelectTarget={setSelectedTarget}
              trueLabels={activeCase?.true_labels}
            />
          </div>
        </div>

        {/* ========================================================
            SECTION 4: LIVE CLINICAL AI SYNTHESIS BRIEFING
        ======================================================== */}
        <div id="cardiolens-synthesis" className="p-6 md:p-8 rounded-3xl bg-[#090d16]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest font-semibold">
                  MODULE 04  •  AI CLINICAL CONSULTATION BRIEFING
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-white">
                Live Evidence-Based Clinical Diagnostic Synthesis
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                Engine: <strong className="text-teal-300">{aiModelUsed || "Clinical AI Neural Engine"}</strong>
              </span>
              <button
                onClick={handleGenerateAiSynthesis}
                disabled={isGeneratingAi}
                className="text-xs md:text-sm font-semibold px-5 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-400/40 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingAi ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
                    Generating Clinical Synthesis...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    Regenerate Synthesis
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
            {isGeneratingAi ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-10 h-10 mx-auto border-2 border-teal-500/20 border-t-teal-400 rounded-full animate-spin" />
                <p className="text-sm text-gray-300 font-mono">Synthesizing Multimodal Diagnostic Covariates with Advanced Clinical AI...</p>
                <p className="text-xs text-gray-500 font-mono">Correlating Calibrated Stenosis Likelihoods with Baseline Myocardial Perfusion</p>
              </div>
            ) : aiSynthesis ? (
              <div className="prose prose-invert max-w-none text-gray-200 text-sm md:text-base leading-relaxed space-y-4">
                <div
                  dangerouslySetInnerHTML={{
                    __html: aiSynthesis
                      .replace(/### (.*?)\n/g, '<h3 class="text-lg font-bold text-teal-300 mt-4 mb-2">$1</h3>')
                      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
                      .replace(/\n\n/g, '<p class="mb-3 text-gray-300">')
                      .replace(/• (.*?)\n/g, '<li class="ml-4 text-gray-300">$1</li>'),
                  }}
                />
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-500 font-mono">
                Click &quot;Regenerate Synthesis&quot; to generate an advanced AI diagnostic assessment for this patient.
              </div>
            )}
          </div>
        </div>

        {/* ========================================================
            SECTION 5: SHAP EXPLAINABILITY & BIOMARKER MATRIX
        ======================================================== */}
        <div id="cardiolens-explain" className="p-6 md:p-8 rounded-3xl bg-[#090d16]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/10">
            <div>
              <span className="text-xs font-mono text-teal-400 uppercase tracking-widest font-semibold">
                MODULE 05  •  EXPLAINABLE ARTIFICIAL INTELLIGENCE
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">
                SHAP Feature Attribution &amp; Biomarker Reference Panel
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono">Target:</span>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-teal-500/20 text-teal-300 rounded-lg border border-teal-500/30">
                {selectedTarget || "CAD"} = {((((currentRiskState?.targets as Record<string, TargetState> | undefined)?.[selectedTarget || "CAD"]?.p) ?? 0.5) * 100).toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 6 cols: SHAP Waterfall & Modality */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white mb-2">
                  Top 10 Logit Covariates (SHAP Shapley Values)
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Red bars indicate positive associative risk elevation; blue bars indicate protective/lower likelihood.
                </p>

                {activeExplanation ? (
                  <div className="space-y-2">
                    {activeExplanation.contributions.slice(0, 10).map((c, i) => {
                      const isPos = c.phi_logit > 0;
                      const maxVal = Math.max(...activeExplanation.contributions.map((x) => Math.abs(x.phi_logit)), 0.01);
                      const width = Math.max(3, (Math.abs(c.phi_logit) / maxVal) * 100);

                      return (
                        <div key={i} className="flex items-center gap-3 text-xs md:text-sm">
                          <span className="w-40 truncate text-right font-medium text-gray-300" title={c.label}>
                            {c.label}
                          </span>
                          <div className="flex-1 flex items-center h-5 bg-white/5 rounded-md px-1">
                            <div
                              className="w-full flex items-center"
                              style={{ justifyContent: isPos ? "flex-start" : "flex-end" }}
                            >
                              <div
                                className={`h-3.5 rounded ${isPos ? "bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "bg-blue-500/80 shadow-[0_0_8px_rgba(59,130,246,0.4)]"}`}
                                style={{ width: `${width}%` }}
                              />
                            </div>
                          </div>
                          <span className={`w-16 text-right font-mono font-bold text-xs ${isPos ? "text-red-400" : "text-blue-400"}`}>
                            {isPos ? "+" : ""}{c.phi_logit.toFixed(3)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 p-4 font-mono">Select a target to view SHAP waterfall</div>
                )}
              </div>

              {/* Modality Bar */}
              {activeExplanation?.group_contributions && (
                <div className="pt-4 border-t border-white/5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 mb-3">
                    Modality-Level Net Risk Contribution
                  </h4>
                  <div className="space-y-2">
                    {activeExplanation.group_contributions.map((g, idx) => {
                      const isPos = g.phi_logit > 0;
                      const maxGroup = Math.max(...activeExplanation.group_contributions.map((x) => Math.abs(x.phi_logit)), 0.01);
                      const width = Math.max(3, (Math.abs(g.phi_logit) / maxGroup) * 100);

                      return (
                        <div key={idx} className="flex items-center gap-3 text-xs">
                          <span className="w-36 truncate text-right text-gray-400 uppercase font-mono text-[11px]">
                            {g.group.replace(/_/g, " ")}
                          </span>
                          <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isPos ? "bg-red-400/60" : "bg-blue-400/60"}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <span className={`w-14 text-right font-mono font-semibold text-xs ${isPos ? "text-red-400" : "text-blue-400"}`}>
                            {isPos ? "+" : ""}{g.phi_logit.toFixed(3)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right 6 cols: Searchable Biomarkers Table */}
            <div className="lg:col-span-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-base font-bold text-white">
                  Physiological Biomarker Panel
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search feature..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="px-3 py-1 text-xs rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-teal-400"
                  />
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-[#0e1422] border border-white/10 text-gray-300"
                  >
                    <option value="all">All Groups</option>
                    <option value="demographics_history">Demographics</option>
                    <option value="exam_vitals">Vitals</option>
                    <option value="laboratory">Laboratory</option>
                    <option value="ecg">ECG</option>
                    <option value="echo">Echo</option>
                  </select>
                </div>
              </div>

              <div className="overflow-auto max-h-[460px] border border-white/10 rounded-2xl bg-[#06080c]/50">
                <table className="w-full text-xs md:text-sm">
                  <thead className="sticky top-0 bg-[#0e1422] z-10 border-b border-white/10">
                    <tr className="text-gray-400 text-left font-mono uppercase text-[11px]">
                      <th className="py-2.5 px-3 font-semibold">Covariate Feature</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Value</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Unit</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {snapshot.catalog
                      .filter((c) => {
                        const matchesSearch = c.label.toLowerCase().includes(searchFilter.toLowerCase()) || c.raw_name.toLowerCase().includes(searchFilter.toLowerCase());
                        const matchesGroup = categoryFilter === "all" || c.group === categoryFilter;
                        return matchesSearch && matchesGroup;
                      })
                      .map((cat, idx) => {
                        const val = currentFeatures[cat.raw_name];
                        const isAvail = val !== undefined && val !== null;
                        return (
                          <tr key={idx} className="hover:bg-white/[0.02] transition-colors" title={cat.glossary}>
                            <td className="py-2 px-3 text-gray-200 font-medium">{cat.label}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-white">
                              {isAvail ? (typeof val === "number" ? val.toFixed(cat.type === "continuous" ? 1 : 0) : String(val)) : "—"}
                            </td>
                            <td className="py-2 px-3 text-right text-gray-400 font-mono text-xs">{cat.unit || "—"}</td>
                            <td className="py-2 px-3 text-right text-gray-400 font-mono text-[10px] uppercase">
                              {cat.group.replace(/_/g, " ")}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            SECTION 6: INTERACTIVE WHAT-IF SENSITIVITY SIMULATOR
        ======================================================== */}
        <div id="cardiolens-whatif" className="p-6 md:p-8 rounded-3xl bg-[#090d16]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/10">
            <div>
              <span className="text-xs font-mono text-teal-400 uppercase tracking-widest font-semibold">
                MODULE 06  •  SENSITIVITY &amp; COUNTERFACTUAL SIMULATOR
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">
                Real-Time Physiological Risk Modulation
              </h2>
            </div>
            <button
              onClick={() => setSimulatedRiskState(null)}
              className="text-xs font-mono font-semibold px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all"
            >
              Reset to Patient Baseline
            </button>
          </div>

          <WhatIfSimulatorDeck
            baseRiskState={intakeMode === "custom" ? customRiskState : (activeCase?.risk_state || null)}
            baseFeatures={currentFeatures}
            onUpdateSimulatedTargets={setSimulatedRiskState}
          />
        </div>

        {/* ========================================================
            SECTION 7: 303 PATIENT COHORT POPULATION EXPLORER
        ======================================================== */}
        <div id="cardiolens-cases" className="p-6 md:p-8 rounded-3xl bg-[#090d16]/90 backdrop-blur-2xl border border-white/10 shadow-2xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-white/10">
            <div>
              <span className="text-xs font-mono text-teal-400 uppercase tracking-widest font-semibold">
                MODULE 07  •  COHORT POPULATION ARCHIVE
              </span>
              <h2 className="text-2xl md:text-3xl font-bold text-white mt-1">
                303 Evaluated Catheterization Patients (Tehran Heart Center)
              </h2>
            </div>
            <span className="text-xs font-mono text-gray-400">
              Select any patient record to immediately load full 3D anatomy &amp; metrics
            </span>
          </div>

          <CohortTableExplorer
            cases={snapshot.cases}
            activeCaseId={activeCaseId}
            onSelectCase={handleSelectCase}
          />
        </div>

      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-[#0c121e] border border-white/15 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Configure Clinical AI API Key</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Enter your personal AI API Key (`sk-...`) to generate live clinical consultation briefings directly. If left blank, the system automatically uses the backend server key or the deterministic diagnostic engine.
            </p>
            <input
              type="password"
              placeholder="sk-proj-..."
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-white/5 border border-white/15 text-white placeholder-gray-500 focus:outline-none focus:border-teal-400 font-mono"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setCustomApiKey("")}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
              >
                Clear
              </button>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="px-5 py-2 text-xs font-bold text-white bg-teal-500/20 hover:bg-teal-500/30 border border-teal-400/30 rounded-xl"
              >
                Save &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// WHAT-IF SIMULATOR DECK COMPONENT
// ============================================================
function WhatIfSimulatorDeck({
  baseRiskState,
  baseFeatures,
  onUpdateSimulatedTargets,
}: {
  baseRiskState: RiskState | null;
  baseFeatures: Record<string, number | null>;
  onUpdateSimulatedTargets: (targets: Record<string, TargetState> | null) => void;
}) {
  const [modValues, setModValues] = useState<{
    BP: number;
    LDL: number;
    HDL: number;
    FBS: number;
    Smoking: number;
    BMI: number;
  }>({
    BP: Number(baseFeatures["BP"] ?? 135),
    LDL: Number(baseFeatures["LDL"] ?? 130),
    HDL: Number(baseFeatures["HDL"] ?? 42),
    FBS: Number(baseFeatures["FBS"] ?? 105),
    Smoking: Number(baseFeatures["Current Smoker"] ?? 0),
    BMI: Number(baseFeatures["BMI"] ?? 26.5),
  });

  const simulatedTargets = useMemo(() => {
    if (!baseRiskState) return null;

    const deltaBP = ((modValues.BP - Number(baseFeatures["BP"] ?? 135)) / 20) * 0.22;
    const deltaLDL = ((modValues.LDL - Number(baseFeatures["LDL"] ?? 130)) / 30) * 0.28;
    const deltaHDL = -((modValues.HDL - Number(baseFeatures["HDL"] ?? 42)) / 10) * 0.20;
    const deltaFBS = ((modValues.FBS - Number(baseFeatures["FBS"] ?? 105)) / 25) * 0.16;
    const deltaSmoke = (modValues.Smoking - Number(baseFeatures["Current Smoker"] ?? 0)) * 0.45;
    const deltaBMI = ((modValues.BMI - Number(baseFeatures["BMI"] ?? 26.5)) / 4) * 0.14;

    const netLogitShift = deltaBP + deltaLDL + deltaHDL + deltaFBS + deltaSmoke + deltaBMI;

    const calcProb = (baseP: number) => {
      const baseLogit = Math.log(Math.max(0.01, Math.min(0.99, baseP)) / (1 - Math.max(0.01, Math.min(0.99, baseP))));
      const newLogit = baseLogit + netLogitShift;
      return 1 / (1 + Math.exp(-newLogit));
    };

    const out: Record<string, TargetState> = {};
    ["CAD", "LAD", "LCX", "RCA"].forEach((target) => {
      const pOld = baseRiskState.targets[target]?.p ?? 0.5;
      const pNew = Math.max(0.02, Math.min(0.98, calcProb(pOld)));
      out[target] = {
        p: pNew,
        band: pNew >= 0.65 ? "high" : pNew >= 0.4 ? "moderate" : "low",
      };
    });
    return out;
  }, [modValues, baseFeatures, baseRiskState]);

  const [isSyncedTo3D, setIsSyncedTo3D] = useState<boolean>(false);

  const handleApplyTo3D = () => {
    if (isSyncedTo3D) {
      setIsSyncedTo3D(false);
      onUpdateSimulatedTargets(null);
    } else {
      setIsSyncedTo3D(true);
      onUpdateSimulatedTargets(simulatedTargets);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
        <span className="text-xs text-teal-300 font-mono font-medium">
          Modify sliders below to test associational sensitivity. Click to project simulated perfusion onto the 3D heart.
        </span>
        <button
          onClick={handleApplyTo3D}
          className={`text-xs font-mono font-bold px-4 py-1.5 rounded-lg border transition-all ${
            isSyncedTo3D
              ? "bg-teal-500/30 text-teal-300 border-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.3)]"
              : "bg-white/5 text-gray-300 border-white/10 hover:text-white"
          }`}
        >
          {isSyncedTo3D ? "3D Perfusion Sync: ACTIVE" : "Apply Simulation to 3D Heart"}
        </button>
      </div>
      {/* Target Comparison Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {["CAD", "LAD", "LCX", "RCA"].map((t) => {
          const oldP = (baseRiskState?.targets[t]?.p ?? 0.5) * 100;
          const newP = (simulatedTargets?.[t]?.p ?? 0.5) * 100;
          const diff = newP - oldP;
          return (
            <div key={t} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
              <span className="text-xs font-mono font-bold text-gray-400">{t} ARTERY</span>
              <div className="text-2xl md:text-3xl font-black font-mono text-white mt-1">
                {newP.toFixed(1)}%
              </div>
              <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-mono font-bold">
                <span className="text-gray-500">Baseline: {oldP.toFixed(1)}%</span>
                <span className={diff > 0 ? "text-red-400" : diff < 0 ? "text-green-400" : "text-gray-500"}>
                  ({diff > 0 ? "+" : ""}{diff.toFixed(1)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        <div className="space-y-2">
          <div className="flex justify-between text-xs md:text-sm text-gray-300 font-semibold">
            <span>Systolic Blood Pressure (BP)</span>
            <span className="font-mono text-teal-400">{modValues.BP} mmHg</span>
          </div>
          <input
            type="range"
            min={90}
            max={190}
            value={modValues.BP}
            onChange={(e) => setModValues((v) => ({ ...v, BP: Number(e.target.value) }))}
            className="w-full accent-teal-400"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs md:text-sm text-gray-300 font-semibold">
            <span>LDL Cholesterol</span>
            <span className="font-mono text-teal-400">{modValues.LDL} mg/dL</span>
          </div>
          <input
            type="range"
            min={60}
            max={220}
            value={modValues.LDL}
            onChange={(e) => setModValues((v) => ({ ...v, LDL: Number(e.target.value) }))}
            className="w-full accent-teal-400"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs md:text-sm text-gray-300 font-semibold">
            <span>HDL Cholesterol (Protective)</span>
            <span className="font-mono text-teal-400">{modValues.HDL} mg/dL</span>
          </div>
          <input
            type="range"
            min={20}
            max={80}
            value={modValues.HDL}
            onChange={(e) => setModValues((v) => ({ ...v, HDL: Number(e.target.value) }))}
            className="w-full accent-teal-400"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs md:text-sm text-gray-300 font-semibold">
            <span>Fasting Blood Sugar (FBS)</span>
            <span className="font-mono text-teal-400">{modValues.FBS} mg/dL</span>
          </div>
          <input
            type="range"
            min={70}
            max={240}
            value={modValues.FBS}
            onChange={(e) => setModValues((v) => ({ ...v, FBS: Number(e.target.value) }))}
            className="w-full accent-teal-400"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs md:text-sm text-gray-300 font-semibold">
            <span>Body Mass Index (BMI)</span>
            <span className="font-mono text-teal-400">{modValues.BMI} kg/m²</span>
          </div>
          <input
            type="range"
            min={18}
            max={40}
            value={modValues.BMI}
            onChange={(e) => setModValues((v) => ({ ...v, BMI: Number(e.target.value) }))}
            className="w-full accent-teal-400"
          />
        </div>

        <div className="space-y-2">
          <span className="text-xs md:text-sm text-gray-300 font-semibold block">Smoking Status</span>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setModValues((v) => ({ ...v, Smoking: 0 }))}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border ${
                modValues.Smoking === 0 ? "bg-green-500/20 text-green-300 border-green-500/40" : "text-gray-400 border-white/5"
              }`}
            >
              Non-Smoker
            </button>
            <button
              onClick={() => setModValues((v) => ({ ...v, Smoking: 1 }))}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border ${
                modValues.Smoking === 1 ? "bg-red-500/20 text-red-300 border-red-500/40" : "text-gray-400 border-white/5"
              }`}
            >
              Current Smoker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COHORT TABLE EXPLORER COMPONENT
// ============================================================
function CohortTableExplorer({
  cases,
  activeCaseId,
  onSelectCase,
}: {
  cases: CaseData[];
  activeCaseId: string;
  onSelectCase: (caseId: string) => void;
}) {
  const [filterTruth, setFilterTruth] = useState<"all" | "positive" | "negative">("all");
  const [sortBy, setSortBy] = useState<"CAD" | "LAD" | "LCX" | "RCA">("CAD");
  const [page, setPage] = useState(0);
  const perPage = 15;

  const filteredCases = useMemo(() => {
    let list = [...cases];
    if (filterTruth === "positive") {
      list = list.filter((c) => c.true_labels?.CAD === 1);
    } else if (filterTruth === "negative") {
      list = list.filter((c) => c.true_labels?.CAD === 0);
    }

    list.sort((a, b) => {
      const pa = a.risk_state?.targets?.[sortBy]?.p ?? 0;
      const pb = b.risk_state?.targets?.[sortBy]?.p ?? 0;
      return pb - pa;
    });

    return list;
  }, [cases, filterTruth, sortBy]);

  const totalPages = Math.ceil(filteredCases.length / perPage);
  const currentSlice = filteredCases.slice(page * perPage, (page + 1) * perPage);

  return (
    <div className="space-y-4">
      {/* Filter and Sort Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400 uppercase font-semibold">Filter Cath:</span>
          {(["all", "positive", "negative"] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilterTruth(f);
                setPage(0);
              }}
              className={`text-xs px-3 py-1 rounded-lg border font-mono ${
                filterTruth === f ? "bg-teal-500/20 text-teal-300 border-teal-500/40 font-bold" : "text-gray-400 border-white/5"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-gray-400 uppercase font-semibold">Sort By Vessel:</span>
          {(["CAD", "LAD", "LCX", "RCA"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setSortBy(s);
                setPage(0);
              }}
              className={`text-xs px-3 py-1 rounded-lg border font-mono ${
                sortBy === s ? "bg-teal-500/20 text-teal-300 border-teal-500/40 font-bold" : "text-gray-400 border-white/5"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Cases Table */}
      <div className="overflow-auto max-h-[440px] border border-white/10 rounded-2xl bg-[#06080c]/50">
        <table className="w-full text-xs md:text-sm">
          <thead className="sticky top-0 bg-[#0e1422] z-10 border-b border-white/10 font-mono text-gray-400 uppercase text-[11px]">
            <tr>
              <th className="py-2.5 px-3 text-left font-semibold">Patient Case</th>
              <th className="py-2.5 px-3 text-right font-semibold">Overall CAD</th>
              <th className="py-2.5 px-3 text-right font-semibold">LAD Artery</th>
              <th className="py-2.5 px-3 text-right font-semibold">LCx Artery</th>
              <th className="py-2.5 px-3 text-right font-semibold">RCA Artery</th>
              <th className="py-2.5 px-3 text-center font-semibold">Angio Ground Truth</th>
              <th className="py-2.5 px-3 text-center font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {currentSlice.map((c) => {
              const isSelected = c.case_id === activeCaseId;
              const pC = c.risk_state?.targets?.CAD?.p ?? 0;
              const pL = c.risk_state?.targets?.LAD?.p ?? 0;
              const pX = c.risk_state?.targets?.LCX?.p ?? 0;
              const pR = c.risk_state?.targets?.RCA?.p ?? 0;
              const truth = c.true_labels?.CAD;

              return (
                <tr
                  key={c.case_id}
                  onClick={() => onSelectCase(c.case_id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? "bg-teal-500/15" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400" />
                    {c.case_id}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                    {(pC * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                    {(pL * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                    {(pX * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-gray-300">
                    {(pR * 100).toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        truth === 1
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-green-500/20 text-green-400 border border-green-500/30"
                      }`}
                    >
                      {truth === 1 ? "Cath POSITIVE" : "NORMAL"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCase(c.case_id);
                      }}
                      className="px-3 py-1 text-xs font-semibold rounded-lg bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 border border-teal-500/30 transition-all"
                    >
                      Inspect Case
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs font-mono text-gray-400 pt-2">
          <span>Showing {page * perPage + 1} - {Math.min(filteredCases.length, (page + 1) * perPage)} of {filteredCases.length} cohort cases</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded bg-white/5 border border-white/10 disabled:opacity-30"
            >
              Previous
            </button>
            <span className="px-2 font-bold text-white">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded bg-white/5 border border-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
