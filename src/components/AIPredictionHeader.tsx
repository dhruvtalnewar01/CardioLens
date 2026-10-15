"use client";

import React, { useState, useEffect } from "react";

export default function AIPredictionHeader() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navItems = [
        { label: "Intake", target: "cardiolens-intake" },
        { label: "Risk Matrix", target: "cardiolens-matrix" },
        { label: "3D Anatomy", target: "cardiolens-anatomy" },
        { label: "AI Synthesis", target: "cardiolens-synthesis" },
        { label: "SHAP Explain", target: "cardiolens-explain" },
        { label: "What-If", target: "cardiolens-whatif" },
        { label: "303 Cohort", target: "cardiolens-cases" },
    ];

    const scrollToSection = (targetId: string) => {
        const el = document.getElementById(targetId);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    return (
        <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl transition-all duration-500">
            <div
                className={`flex items-center justify-between px-8 py-4 rounded-full border transition-all duration-500 shadow-2xl ${scrolled
                        ? "bg-[#06080c]/80 backdrop-blur-md border-white/10"
                        : "bg-[#06080c]/40 backdrop-blur-sm border-white/5"
                    }`}
            >
                {/* Left: Logo */}
                <div className="flex flex-col cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    <span className="text-white font-mono text-sm tracking-[0.2em] uppercase font-semibold">
                        CARDIOLENS <span className="text-teal-400">3D</span>
                    </span>
                    <span className="text-cyan-400/80 font-mono text-[9px] tracking-[0.25em] uppercase mt-0.5">
                        Calibrated Multitarget AI
                    </span>
                </div>

                {/* Center: Navigation Links */}
                <nav className="hidden md:flex space-x-8">
                    {navItems.map((item) => (
                        <button
                            key={item.label}
                            onClick={() => scrollToSection(item.target)}
                            className="text-gray-300 font-mono text-xs tracking-wider uppercase hover:text-teal-400 transition-all duration-300 relative group bg-transparent border-none cursor-pointer"
                        >
                            {item.label}
                            <span className="absolute -bottom-2 left-1/2 w-0 h-[1px] bg-teal-400 transition-all duration-300 group-hover:w-1/2 group-hover:left-1/4 opacity-0 group-hover:opacity-100" />
                        </button>
                    ))}
                </nav>

                {/* Right: CTA Button */}
                <div>
                    <button
                        onClick={() => scrollToSection("cardiolens-dashboard")}
                        className="relative overflow-hidden group px-5 py-2 rounded-full border border-teal-400/30 bg-teal-500/10 hover:bg-teal-500/20 transition-all duration-300 backdrop-blur-md cursor-pointer"
                    >
                        <span className="relative z-10 font-mono text-xs text-teal-300 tracking-wider uppercase">
                            Launch Analysis
                        </span>
                    </button>
                </div>
            </div>
        </header>
    );
}
