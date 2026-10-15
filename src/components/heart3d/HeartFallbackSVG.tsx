"use client";

import React from "react";

// ColorBrewer RdYlBu color ramp stops
function getSvgColor(p: number): string {
  if (p < 0.25) return "#4575b4";
  if (p < 0.5) return "#91bfdb";
  if (p < 0.75) return "#fee090";
  if (p < 0.9) return "#fc8d59";
  return "#d73027";
}

interface HeartFallbackSVGProps {
  targets: Record<string, { p: number; band: string }>;
  selectedTarget: string | null;
  onSelectTarget: (target: string | null) => void;
}

export default function HeartFallbackSVG({
  targets,
  selectedTarget,
  onSelectTarget,
}: HeartFallbackSVGProps) {
  const ladProb = targets.LAD?.p ?? 0.5;
  const lcxProb = targets.LCX?.p ?? 0.5;
  const rcaProb = targets.RCA?.p ?? 0.5;

  const ladColor = getSvgColor(ladProb);
  const lcxColor = getSvgColor(lcxProb);
  const rcaColor = getSvgColor(rcaProb);

  return (
    <div className="w-full h-full min-h-[420px] flex flex-col items-center justify-center p-6 bg-[#0e1420] rounded-xl relative select-none">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-teal-400" />
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
          Schematic 2D Coronary Tree (SVG Fallback)
        </span>
      </div>

      <svg
        viewBox="0 0 400 400"
        className="w-full max-w-[360px] h-auto drop-shadow-2xl"
      >
        {/* Heart Silhouette */}
        <path
          d="M 200,80 C 140,20 60,60 60,150 C 60,250 160,330 200,360 C 240,330 340,250 340,150 C 340,60 260,20 200,80 Z"
          fill="#1c1618"
          stroke="#2a2226"
          strokeWidth="3"
          opacity="0.75"
        />

        {/* Aorta Arch */}
        <path
          d="M 190,110 C 190,40 230,40 230,110"
          fill="none"
          stroke="#442222"
          strokeWidth="18"
          strokeLinecap="round"
        />

        {/* Left Main Stem */}
        <path
          d="M 210,120 L 230,140"
          fill="none"
          stroke="#666666"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* RCA (Right Coronary Artery) */}
        <g
          className="cursor-pointer transition-transform hover:scale-[1.02]"
          onClick={() => onSelectTarget(selectedTarget === "RCA" ? null : "RCA")}
        >
          <path
            d="M 185,130 C 150,150 130,200 140,260 C 145,290 170,320 185,340"
            fill="none"
            stroke={rcaColor}
            strokeWidth={selectedTarget === "RCA" ? "10" : "6"}
            strokeLinecap="round"
          />
          {/* RCA Branch */}
          <path
            d="M 140,220 L 110,250"
            fill="none"
            stroke={rcaColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <text
            x="100"
            y="200"
            fill="#e2e8f0"
            fontSize="11"
            fontFamily="Inter, sans-serif"
            fontWeight="bold"
          >
            RCA: {(rcaProb * 100).toFixed(0)}%
          </text>
        </g>

        {/* LCX (Left Circumflex Artery) */}
        <g
          className="cursor-pointer transition-transform hover:scale-[1.02]"
          onClick={() => onSelectTarget(selectedTarget === "LCX" ? null : "LCX")}
        >
          <path
            d="M 230,140 C 265,155 295,190 290,240 C 285,270 260,300 240,320"
            fill="none"
            stroke={lcxColor}
            strokeWidth={selectedTarget === "LCX" ? "9" : "5.5"}
            strokeLinecap="round"
          />
          {/* Obtuse Marginal Branch */}
          <path
            d="M 275,190 L 310,225"
            fill="none"
            stroke={lcxColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <text
            x="290"
            y="170"
            fill="#e2e8f0"
            fontSize="11"
            fontFamily="Inter, sans-serif"
            fontWeight="bold"
          >
            LCX: {(lcxProb * 100).toFixed(0)}%
          </text>
        </g>

        {/* LAD (Left Anterior Descending Artery) */}
        <g
          className="cursor-pointer transition-transform hover:scale-[1.02]"
          onClick={() => onSelectTarget(selectedTarget === "LAD" ? null : "LAD")}
        >
          <path
            d="M 230,140 C 220,180 210,240 200,345"
            fill="none"
            stroke={ladColor}
            strokeWidth={selectedTarget === "LAD" ? "10" : "6.5"}
            strokeLinecap="round"
          />
          {/* Diagonal Branches */}
          <path
            d="M 222,190 L 250,230"
            fill="none"
            stroke={ladColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 213,245 L 235,280"
            fill="none"
            stroke={ladColor}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text
            x="215"
            y="310"
            fill="#e2e8f0"
            fontSize="11"
            fontFamily="Inter, sans-serif"
            fontWeight="bold"
          >
            LAD: {(ladProb * 100).toFixed(0)}%
          </text>
        </g>
      </svg>

      <div className="mt-2 text-center">
        <span className="text-[10px] text-gray-500 font-mono">
          Click any vessel to inspect individual SHAP feature attributions
        </span>
      </div>
    </div>
  );
}
