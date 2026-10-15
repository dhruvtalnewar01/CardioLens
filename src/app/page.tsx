import AIPredictionHeader from "@/components/AIPredictionHeader";
import CHDMainHero from "@/components/CHDMainHero";
import CHDTextOverlay from "@/components/CHDTextOverlay";
import CardioLensDashboard from "@/components/dashboard/CardioLensDashboard";

export default function Home() {
  return (
    <>
      {/* Hero Zone: scroll-driven animation section */}
      <main className="relative bg-black w-full" style={{ height: "400vh" }}>
        {/* 1. Sticky/Fixed 3D and UI Header */}
        <AIPredictionHeader />

        {/* 2. Scroll-bound Video/Canvas Player */}
        <CHDMainHero />

        {/* 3. Scroll-bound Text Overlay */}
        <CHDTextOverlay />

        {/* Scroll indicator - localized strictly to hero opening frame */}
        <div className="absolute top-[88vh] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center pointer-events-none opacity-60">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-2">Scroll Sequence</span>
          <div className="w-[1px] h-10 bg-gradient-to-b from-cyan-400 to-transparent animate-pulse" />
        </div>
      </main>

      {/* 4. CardioLens 3D Production Application */}
      <CardioLensDashboard />
    </>
  );
}
