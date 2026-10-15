"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";

export default function CHDTextOverlay() {
    const containerRef = useRef<HTMLDivElement>(null);

    // Section refs for orbital GSAP drift
    const sec1 = useRef<HTMLDivElement>(null);
    const sec2 = useRef<HTMLDivElement>(null);
    const sec3 = useRef<HTMLDivElement>(null);
    const sec4 = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Elegant slow orbital drift
        const elements = [sec1.current, sec2.current, sec3.current, sec4.current];
        elements.forEach((el, index) => {
            if (el) {
                gsap.to(el, {
                    y: "+=12",
                    x: index % 2 === 0 ? "+=4" : "-=4",
                    duration: 3 + Math.random() * 2,
                    yoyo: true,
                    repeat: -1,
                    ease: "sine.inOut"
                });
            }
        });
    }, []);

    return (
        <div ref={containerRef} className="absolute inset-0 w-full h-[400vh] pointer-events-none z-20 font-mono">

            {/* 0-100vh: Intro */}
            <div className="absolute top-0 left-0 w-full h-screen flex items-start justify-start px-8 md:px-24 pt-36">
                <div ref={sec1} className="max-w-xl">
                    <h1 className="text-3xl md:text-5xl font-bold text-white tracking-[0.1em] uppercase mb-6 leading-tight drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">
                        ARTERIAL INTEGRITY <br />
                        <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500">
                            PROTOCOLS
                        </span>
                    </h1>
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="h-[1px] w-12 bg-cyan-400 opacity-80" />
                        <span className="text-cyan-400 text-xs tracking-[0.3em] font-medium uppercase drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                            QUANTIFYING SUB-CLINICAL CHD RISK.
                        </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-200 tracking-[0.15em] uppercase leading-loose border-l border-gray-500 pl-6 drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]">
                        Integrating Multi-Variate Diagnostic Indices: Biomarker Synthesis, Symptom Analysis, Electrocardiography, and Calibrated Coronary Modeling.
                    </p>
                </div>
            </div>

            {/* 100vh-200vh: Data Aggregation */}
            <div className="absolute top-[100vh] left-0 w-full h-screen flex items-center justify-end px-8 md:px-24">
                <div ref={sec2} className="max-w-lg text-right translate-y-[10vh]">
                    <div className="flex items-center space-x-4 mb-4 justify-end">
                        <span className="text-[10px] text-amber-500/90 tracking-[0.3em] uppercase drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">
                            AGENT SUBROUTINE 01: ARTERIAL WALL INTEGRITY ANALYSIS
                        </span>
                        <div className="w-8 h-[1px] bg-amber-500/80" />
                    </div>

                    <p className="text-sm text-white font-medium leading-loose mb-8 pl-12 drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]">
                        <span className="text-white font-bold">CLINICAL DATA AGGREGATION ENGINE:</span> <br />
                        Non-invasive assessment of Intimal-Media Thickness (IMT), Calcium Scoring, and Inflammatory Biomarkers.
                    </p>

                    {/* Minimalist JSON Readout */}
                    <div className="inline-block relative">
                        <div className="absolute -inset-4 bg-gradient-to-br from-cyan-900/10 to-transparent blur-md -z-10" />
                        <pre className="text-xs text-left text-cyan-300/90 font-mono tracking-widest leading-loose py-4 px-6 border border-cyan-500/20 bg-black/40 backdrop-blur-md rounded-md shadow-2xl">
                            {`{
  patient_id: "ANON_8392X",
  calcium_score: 185,
  carotid_imt: 1.25,
  hs_crp: 3.2,
  risk_probability: 0.78
}`}
                        </pre>
                        <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,1)]" />
                    </div>
                </div>
            </div>

            {/* 200vh-300vh: Risk Engine */}
            <div className="absolute top-[200vh] left-0 w-full h-screen flex items-center justify-start px-8 md:px-24">
                <div ref={sec3} className="max-w-lg translate-y-[5vh]">
                    <div className="flex items-center space-x-4 mb-4">
                        <div className="w-8 h-[1px] bg-red-500/80" />
                        <span className="text-[10px] text-red-400 tracking-[0.3em] uppercase">
                            Predictive Modeling Matrix
                        </span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-[0.1em] uppercase mb-8 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">
                        HIGH-DIMENSIONAL <br />
                        <span className="font-black text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]">RISK ENGINE OUTCOME.</span>
                    </h2>

                    <div className="pl-6 border-l border-red-500/30">
                        <p className="text-sm font-bold font-mono text-white leading-relaxed mb-6 drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]">
                            Analyzed vector set yields alarming structural degradation trajectory.
                        </p>
                        <div className="mt-6 flex flex-col items-start">
                            <span className="text-[10px] text-gray-500 mb-2 tracking-[0.3em]">PROBABILISTIC CHD RISK</span>
                            <span className="text-6xl text-red-500 font-light tracking-tighter drop-shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                                78.4<span className="text-3xl opacity-50">%</span>
                            </span>
                            <div className="w-64 h-[1px] bg-gray-800 mt-4 relative overflow-hidden">
                                <div className="absolute top-0 left-0 h-full bg-red-500 w-[78.4%] shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 300vh-400vh: Synthesis */}
            <div className="absolute top-[300vh] left-0 w-full h-screen flex items-center justify-end px-8 md:px-24">
                <div ref={sec4} className="max-w-xl text-right translate-y-[-5vh]">
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-[0.15em] uppercase mb-8 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">
                        SYNTHESIZING <span className="font-bold text-white block mt-2 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)]">ANATOMICAL LOCALIZATION</span>
                    </h2>
                    <div className="border-r border-teal-500/40 pr-6">
                        <p className="text-[10px] text-teal-400 font-bold tracking-[0.3em] mb-4 uppercase drop-shadow-[0_0_8px_rgba(45,212,191,0.3)]">
                            VESSEL-SPECIFIC RISK PROFILES
                        </p>
                        <p className="text-sm font-semibold text-white leading-loose tracking-[0.1em] uppercase drop-shadow-[0_4px_6px_rgba(0,0,0,0.9)]">
                            Mapping Calibrated Stenosis Likelihoods to Primary Coronary Territories (LAD, LCX, RCA) with Modality-Level Feature Attribution for Clinical Decision Support.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
}
