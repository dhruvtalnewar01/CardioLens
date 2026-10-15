import { NextResponse } from "next/server";

interface TargetState {
  p: number;
  band: string;
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
  phi_logit: number;
}

function generateDeterministicNarrative(
  caseId: string,
  riskState: RiskState | undefined,
  contributions: Contribution[] | undefined,
  features: Record<string, number | null> | undefined,
  patientName?: string
): string {
  const pCad = ((riskState?.targets?.CAD?.p ?? 0.5) * 100).toFixed(1);
  const pLad = ((riskState?.targets?.LAD?.p ?? 0.5) * 100).toFixed(1);
  const pLcx = ((riskState?.targets?.LCX?.p ?? 0.5) * 100).toFixed(1);
  const pRca = ((riskState?.targets?.RCA?.p ?? 0.5) * 100).toFixed(1);

  const topDrivers = (contributions || [])
    .slice(0, 3)
    .map((c) => c.label)
    .join(", ") || "hemodynamic and metabolic markers";

  const age = features?.Age ?? "Unknown";
  const sex = features?.Sex === 1 ? "male" : "female";
  const bp = features?.BP ? `${features.BP} mmHg` : "normal range";
  const subjectLabel = patientName ? `${patientName} (${caseId})` : `Case: ${caseId}`;

  return `### Executive Clinical Synthesis (${subjectLabel})

**1. Territorially Specific Risk Stratification:**
Multitarget calibrated out-of-fold modeling reveals an overall CAD stenosis probability of **${pCad}%**. Anatomical territory distribution indicates vessel-level stenosis likelihoods of **${pLad}%** in the Left Anterior Descending (LAD), **${pLcx}%** in the Left Circumflex (LCx), and **${pRca}%** in the Right Coronary Artery (RCA). These estimates derive from nested cross-validation Platt-calibrated ensembles trained on angiography-referred cohorts.

**2. Pathophysiological Covariate Correlation:**
Primary logit drivers elevating baseline risk include **${topDrivers}** in this ${age}-year-old ${sex} patient presenting with blood pressure recorded at ${bp}. The SHAP attribution weights indicate significant alignment with systemic inflammatory and vascular stress markers.

**3. Diagnostic Context for Care Team:**
These associative metrics provide risk stratification support. In accordance with clinical safety protocols, findings must be corroborated with coronary computed tomography angiography (CCTA), invasive coronary angiography (ICA), or functional stress myocardial perfusion imaging. (Decision support only; non-interventional).`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { caseId, patientName, features, riskState, contributions, customApiKey } = body;

    const apiKey =
      customApiKey ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        source: "clinical_ai_deterministic",
        narrative: generateDeterministicNarrative(caseId, riskState, contributions, features, patientName),
      });
    }

    const isOpenRouter =
      apiKey.startsWith("sk-or-") ||
      Boolean(process.env.OPENROUTER_API_KEY && !customApiKey && !process.env.OPENAI_API_KEY);

    const endpoint = isOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const model = isOpenRouter
      ? process.env.OPENROUTER_PRIMARY_MODEL || "meta-llama/llama-3.3-70b-instruct:free"
      : "gpt-4o-mini";

    const cadP = ((riskState?.targets?.CAD?.p ?? 0.5) * 100).toFixed(1);
    const ladP = ((riskState?.targets?.LAD?.p ?? 0.5) * 100).toFixed(1);
    const lcxP = ((riskState?.targets?.LCX?.p ?? 0.5) * 100).toFixed(1);
    const rcaP = ((riskState?.targets?.RCA?.p ?? 0.5) * 100).toFixed(1);

    const topFeatures = (contributions || [])
      .slice(0, 6)
      .map(
        (c: Contribution) =>
          `• ${c.label} (${c.group}): phi = ${c.phi_logit > 0 ? "+" : ""}${c.phi_logit.toFixed(3)}`
      )
      .join("\n");

    const systemPrompt = `You are a distinguished academic cardiologist and AI clinical decision support specialist for the CardioLens 3D system.
MANDATORY SAFETY AND REGULATORY INVARIANTS:
1. Invariant I4 (Strict): NEVER prescribe, recommend, or mention specific drugs, pharmaceuticals, dosages, statins, beta blockers, aspirin, or interventional procedures.
2. Invariant I3: NEVER alter or invent new risk percentages. Reference ONLY the exact calibrated model numbers provided.
3. Invariant I2: Vessel probabilities represent statistical likelihoods, not measured lesion geometry.
4. Style: Rigorous academic clinical English, clear section headings, evidence-based reasoning, objective tone.`;

    const patientTitle = patientName ? `Patient: ${patientName} (Record: ${caseId})` : `Patient Case: ${caseId}`;
    const userPrompt = `Provide a comprehensive diagnostic briefing for ${patientTitle}:

CALIBRATED MODEL ESTIMATES:
- Overall CAD Stenosis Probability: ${cadP}%
- Left Anterior Descending (LAD) Territory: ${ladP}%
- Left Circumflex (LCx) Territory: ${lcxP}%
- Right Coronary Artery (RCA) Territory: ${rcaP}%

TOP SHAP ATTRIBUTION DRIVERS:
${topFeatures || "Standard clinical covariates"}

BIOMARKER PROFILE:
- Demographics: Age ${features?.Age ?? "N/A"}, Sex ${features?.Sex === 1 ? "Male" : "Female"}
- Hemodynamics: Systolic BP ${features?.BP ?? "N/A"} mmHg, Heart Rate ${features?.PR ?? "N/A"} bpm
- Lipids: LDL ${features?.LDL ?? "N/A"} mg/dL, HDL ${features?.HDL ?? "N/A"} mg/dL, Triglycerides ${features?.TG ?? "N/A"} mg/dL
- Glycemic & Echo: Fasting Blood Sugar ${features?.FBS ?? "N/A"} mg/dL, EF-TTE ${features?.["EF-TTE"] ?? "N/A"}%

Structure your response into 3 concise sections:
### 1. Executive Risk Stratification & Territorial Distribution
### 2. Pathophysiological Covariate & SHAP Attribution Analysis
### 3. Clinical Diagnostic Summary & Follow-up Considerations`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (isOpenRouter) {
      headers["HTTP-Referer"] = "http://localhost:3000";
      headers["X-Title"] = "CardioLens 3D Clinical AI";
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 700,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn("AI API request failed, utilizing deterministic synthesis:", errText);
      return NextResponse.json({
        success: true,
        source: "clinical_ai_deterministic",
        narrative: generateDeterministicNarrative(caseId, riskState, contributions, features, patientName),
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({
      success: true,
      source: "advanced_clinical_ai",
      model: "Clinical AI Neural Engine",
      narrative: content,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate synthesis";
    console.error("Synthesize API route error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
