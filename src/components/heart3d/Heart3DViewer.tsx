"use client";

import React, { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import HeartFallbackSVG from "./HeartFallbackSVG";

// ============================================================
// COLOR RAMP: ColorBrewer RdYlBu (CVD-Safe Diverging Palette)
// ============================================================
const RISK_STOPS = [
  { t: 0.0, color: new THREE.Color("#3b82f6") }, // Low risk (Blue)
  { t: 0.35, color: new THREE.Color("#60a5fa") },
  { t: 0.5, color: new THREE.Color("#f59e0b") }, // Moderate (Amber)
  { t: 0.7, color: new THREE.Color("#f97316") }, // Elevated (Orange)
  { t: 1.0, color: new THREE.Color("#ef4444") }, // High risk (Red)
];

function colorForProbability(p: number): THREE.Color {
  const clamped = Math.max(0, Math.min(1, p));
  for (let i = 0; i < RISK_STOPS.length - 1; i++) {
    if (clamped <= RISK_STOPS[i + 1].t) {
      const frac =
        (clamped - RISK_STOPS[i].t) /
        (RISK_STOPS[i + 1].t - RISK_STOPS[i].t);
      return new THREE.Color().lerpColors(
        RISK_STOPS[i].color,
        RISK_STOPS[i + 1].color,
        frac
      );
    }
  }
  return RISK_STOPS[RISK_STOPS.length - 1].color;
}

// ============================================================
// ULTRA-REALISTIC PROCEDURAL MYOCARDIAL ANATOMY
// ============================================================
interface HeartAnatomyProps {
  isAngioMode: boolean;
}

function HeartAnatomy({ isAngioMode }: HeartAnatomyProps) {
  const heartGroupRef = useRef<THREE.Group>(null);
  const ventriclesRef = useRef<THREE.Mesh>(null);
  const leftAtriumRef = useRef<THREE.Mesh>(null);
  const rightAtriumRef = useRef<THREE.Mesh>(null);

  // Anatomical Heartbeat Contraction (Wiggers Cycle dual-beat pulse with apex torsion)
  useFrame((state) => {
    const t = state.clock.elapsedTime * 1.2 * Math.PI * 2; // ~72 BPM
    // Dual systolic ventricular contraction
    const s1 = Math.pow(Math.max(0, Math.sin(t)), 4) * 0.045;
    const s2 = Math.pow(Math.max(0, Math.sin(t + 0.35)), 6) * 0.02;
    const beat = 1 + (s1 + s2);

    if (ventriclesRef.current) {
      ventriclesRef.current.scale.set(beat, 1 + s1 * 1.2, beat);
      ventriclesRef.current.rotation.y = Math.sin(t) * 0.025; // Apical torsion
    }
    if (leftAtriumRef.current && rightAtriumRef.current) {
      const atrialBeat = 1 - (s1 * 0.6);
      leftAtriumRef.current.scale.set(atrialBeat, atrialBeat, atrialBeat);
      rightAtriumRef.current.scale.set(atrialBeat, atrialBeat, atrialBeat);
    }
  });

  // Ventricular myocardium material
  const myoMaterial = useMemo(() => {
    if (isAngioMode) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#08101a"),
        roughness: 0.8,
        metalness: 0.2,
        transparent: true,
        opacity: 0.25,
        wireframe: true,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#4a171e"), // Deep anatomical myocardium
      roughness: 0.45,
      metalness: 0.15,
      bumpScale: 0.05,
      side: THREE.DoubleSide,
    });
  }, [isAngioMode]);

  // Atria material (slightly darker, thinner wall)
  const atriaMaterial = useMemo(() => {
    if (isAngioMode) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#050b12"),
        transparent: true,
        opacity: 0.2,
        wireframe: true,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#3d141a"),
      roughness: 0.55,
      metalness: 0.1,
    });
  }, [isAngioMode]);

  // Epicardial adipose tissue material (Warm anatomical sulcus cushions)
  const fatMaterial = useMemo(() => {
    if (isAngioMode) {
      return new THREE.MeshBasicMaterial({ visible: false });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#6b5334"),
      roughness: 0.7,
      metalness: 0.05,
      transparent: true,
      opacity: 0.8,
    });
  }, [isAngioMode]);

  // Great vessels material (Aorta / Pulmonary Artery / Vena Cava)
  const vesselMaterial = useMemo(() => {
    if (isAngioMode) {
      return new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0b1724"),
        transparent: true,
        opacity: 0.3,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color("#5a1e24"),
      roughness: 0.4,
      metalness: 0.2,
    });
  }, [isAngioMode]);

  // Aorta arch curve
  const aortaCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0.0, 0.4, 0.15),
        new THREE.Vector3(-0.02, 0.75, 0.2),
        new THREE.Vector3(-0.08, 1.05, 0.05),
        new THREE.Vector3(-0.18, 1.0, -0.15),
        new THREE.Vector3(-0.25, 0.6, -0.25),
      ],
      false
    );
  }, []);

  // Pulmonary trunk curve
  const pulmonaryCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0.12, 0.35, 0.32),
        new THREE.Vector3(0.1, 0.65, 0.25),
        new THREE.Vector3(0.16, 0.8, 0.05),
      ],
      false
    );
  }, []);

  // Superior vena cava curve
  const svcCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-0.35, 0.95, -0.05),
        new THREE.Vector3(-0.34, 0.6, -0.05),
        new THREE.Vector3(-0.3, 0.4, -0.05),
      ],
      false
    );
  }, []);

  return (
    <group ref={heartGroupRef} position={[0, -0.05, 0]}>
      {/* 1. Ventricular Myocardium Body (Tilted conical apex) */}
      <mesh
        ref={ventriclesRef}
        position={[-0.03, -0.2, 0.02]}
        rotation={[0.15, 0.1, -0.2]}
        material={myoMaterial}
      >
        <sphereGeometry args={[0.78, 64, 64]} />
      </mesh>

      {/* 2. Left Atrium */}
      <mesh
        ref={leftAtriumRef}
        position={[0.3, 0.45, -0.12]}
        material={atriaMaterial}
      >
        <sphereGeometry args={[0.38, 32, 32]} />
      </mesh>

      {/* 3. Right Atrium */}
      <mesh
        ref={rightAtriumRef}
        position={[-0.32, 0.42, 0.02]}
        material={atriaMaterial}
      >
        <sphereGeometry args={[0.42, 32, 32]} />
      </mesh>

      {/* 4. Ascending Aorta Arch */}
      <mesh material={vesselMaterial}>
        <tubeGeometry args={[aortaCurve, 32, 0.11, 16, false]} />
      </mesh>

      {/* Aortic Arch Head & Neck Branches (Brachiocephalic, Carotid, Subclavian) */}
      <mesh position={[-0.05, 1.08, 0.08]} material={vesselMaterial}>
        <cylinderGeometry args={[0.03, 0.032, 0.18, 12]} />
      </mesh>
      <mesh position={[-0.11, 1.07, 0.0]} material={vesselMaterial}>
        <cylinderGeometry args={[0.024, 0.026, 0.16, 12]} />
      </mesh>
      <mesh position={[-0.16, 1.03, -0.08]} material={vesselMaterial}>
        <cylinderGeometry args={[0.024, 0.026, 0.15, 12]} />
      </mesh>

      {/* 5. Pulmonary Trunk */}
      <mesh material={vesselMaterial}>
        <tubeGeometry args={[pulmonaryCurve, 24, 0.09, 14, false]} />
      </mesh>

      {/* 6. Superior Vena Cava */}
      <mesh material={vesselMaterial}>
        <tubeGeometry args={[svcCurve, 20, 0.08, 12, false]} />
      </mesh>

      {/* Left Main (LM) Coronary Trunk */}
      <mesh position={[0.12, 0.4, 0.52]} rotation={[0.2, 0.4, -0.1]}>
        <cylinderGeometry args={[0.042, 0.045, 0.14, 12]} />
        <meshStandardMaterial
          color="#8b252d"
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      {/* 7. Anterior Sulcus Epicardial Fat Cushion */}
      {!isAngioMode && (
        <mesh position={[0.01, 0.0, 0.69]} rotation={[0.12, 0.1, -0.18]} material={fatMaterial}>
          <cylinderGeometry args={[0.065, 0.045, 0.95, 16]} />
        </mesh>
      )}

      {/* 8. Atrioventricular Groove Adipose Pad */}
      {!isAngioMode && (
        <mesh position={[0.0, 0.32, 0.0]} rotation={[Math.PI / 2, 0, 0]} material={fatMaterial}>
          <torusGeometry args={[0.62, 0.045, 12, 32, Math.PI * 1.5]} />
        </mesh>
      )}

      {/* 9. Inferior Vena Cava (IVC) */}
      <mesh position={[-0.32, -0.15, -0.05]} material={vesselMaterial}>
        <cylinderGeometry args={[0.075, 0.075, 0.35, 16]} />
      </mesh>

      {/* 10. Pulmonary Veins (Posterior Left Atrium) */}
      <mesh position={[0.42, 0.48, -0.18]} rotation={[0, 0.4, 0.2]} material={vesselMaterial}>
        <cylinderGeometry args={[0.035, 0.035, 0.18, 12]} />
      </mesh>
      <mesh position={[0.38, 0.38, -0.22]} rotation={[0, 0.4, -0.2]} material={vesselMaterial}>
        <cylinderGeometry args={[0.032, 0.032, 0.16, 12]} />
      </mesh>
    </group>
  );
}

// ============================================================
// CORONARY ARTERIES WITH FLOW PARTICLES & PERFUSION GLOW
// ============================================================
interface ArteryProps {
  points: THREE.Vector3[];
  probability: number;
  name: string;
  territory: string;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (h: boolean) => void;
  radius?: number;
  truthLabel?: number;
  isAngioMode: boolean;
}

function CoronaryArteryTube({
  points,
  probability,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  radius = 0.035,
  isAngioMode,
}: ArteryProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const color = useMemo(() => colorForProbability(probability), [probability]);

  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  }, [points]);

  const geometry = useMemo(() => {
    return new THREE.TubeGeometry(
      curve,
      48,
      isSelected ? radius * 1.45 : radius,
      14,
      false
    );
  }, [curve, radius, isSelected]);

  // Animated blood flow particles along the artery curve
  const particleCount = 18;
  const particlePositions = useMemo(() => {
    const arr = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const pt = curve.getPoint(i / particleCount);
      arr[i * 3] = pt.x;
      arr[i * 3 + 1] = pt.y;
      arr[i * 3 + 2] = pt.z;
    }
    return arr;
  }, [curve]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Emissive pulse based on risk level
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const basePulse = 0.2 + 0.15 * Math.sin(t * 3.0);
      const activePulse = 0.55 + 0.3 * Math.sin(t * 5.0);
      mat.emissiveIntensity = isSelected ? activePulse : isHovered ? 0.45 : basePulse;
    }

    // Move blood flow particles along curve
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.attributes.position;
      const speed = 0.35 + probability * 0.25;
      for (let i = 0; i < particleCount; i++) {
        const u = ((i / particleCount) + (t * speed * 0.15)) % 1.0;
        const pt = curve.getPoint(u);
        posAttr.setXYZ(i, pt.x, pt.y, pt.z);
      }
      posAttr.needsUpdate = true;
    }
  });

  const arteryMaterial = useMemo(() => {
    if (isAngioMode) {
      return new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: isSelected ? 0.9 : 0.6,
        roughness: 0.2,
        metalness: 0.4,
      });
    }
    return new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: isSelected ? 0.65 : 0.2,
      roughness: 0.3,
      metalness: 0.25,
      transparent: true,
      opacity: isSelected || isHovered ? 1.0 : 0.88,
    });
  }, [color, isSelected, isHovered, isAngioMode]);

  return (
    <group>
      {/* 1. Main Artery Mesh */}
      <mesh
        ref={meshRef}
        geometry={geometry}
        material={arteryMaterial}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerLeave={() => onHover(false)}
      />

      {/* 2. Large Invisible Raycast Proxy for effortless clicking */}
      <mesh
        geometry={new THREE.TubeGeometry(curve, 24, radius * 3.0, 6, false)}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerEnter={(e) => {
          e.stopPropagation();
          onHover(true);
        }}
        onPointerLeave={() => onHover(false)}
        visible={false}
      >
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* 3. Glowing Selection Halo */}
      {isSelected && (
        <mesh geometry={new THREE.TubeGeometry(curve, 48, radius * 1.85, 12, false)}>
          <meshBasicMaterial
            color="#2dd4bf"
            transparent
            opacity={0.25}
            wireframe
          />
        </mesh>
      )}

      {/* 4. Animated Blood Perfusion Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.03}
          color={color}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

// ============================================================
// ANATOMICAL CORONARY PATHWAYS
// ============================================================
const ARTERY_PATHS = {
  LAD: [
    new THREE.Vector3(0.12, 0.4, 0.52),
    new THREE.Vector3(0.1, 0.28, 0.68),
    new THREE.Vector3(0.04, 0.12, 0.74),
    new THREE.Vector3(-0.03, -0.06, 0.73),
    new THREE.Vector3(-0.09, -0.28, 0.65),
    new THREE.Vector3(-0.12, -0.52, 0.52),
    new THREE.Vector3(-0.1, -0.72, 0.35),
  ],
  LAD_D1: [
    new THREE.Vector3(0.04, 0.12, 0.74),
    new THREE.Vector3(0.2, 0.04, 0.66),
    new THREE.Vector3(0.34, -0.08, 0.52),
  ],
  LAD_D2: [
    new THREE.Vector3(-0.03, -0.06, 0.73),
    new THREE.Vector3(0.12, -0.16, 0.62),
    new THREE.Vector3(0.26, -0.26, 0.45),
  ],
  LCX: [
    new THREE.Vector3(0.12, 0.4, 0.52),
    new THREE.Vector3(0.3, 0.35, 0.52),
    new THREE.Vector3(0.52, 0.24, 0.36),
    new THREE.Vector3(0.64, 0.06, 0.14),
    new THREE.Vector3(0.58, -0.12, -0.12),
    new THREE.Vector3(0.42, -0.25, -0.28),
  ],
  LCX_OM: [
    new THREE.Vector3(0.52, 0.24, 0.36),
    new THREE.Vector3(0.58, 0.08, 0.46),
    new THREE.Vector3(0.54, -0.14, 0.42),
  ],
  RCA: [
    new THREE.Vector3(-0.04, 0.42, 0.54),
    new THREE.Vector3(-0.24, 0.4, 0.48),
    new THREE.Vector3(-0.46, 0.34, 0.34),
    new THREE.Vector3(-0.62, 0.18, 0.14),
    new THREE.Vector3(-0.66, -0.04, -0.08),
    new THREE.Vector3(-0.55, -0.26, -0.25),
    new THREE.Vector3(-0.35, -0.42, -0.22),
  ],
  RCA_PDA: [
    new THREE.Vector3(-0.35, -0.42, -0.22),
    new THREE.Vector3(-0.2, -0.58, -0.1),
    new THREE.Vector3(-0.08, -0.68, 0.08),
  ],
};

// Camera Angle Presets Controller
interface CameraControllerProps {
  viewPreset: "anterior" | "left" | "posterior" | "inferior" | "spider";
}

function CameraController({ viewPreset }: CameraControllerProps) {
  const { camera } = useThree();

  useEffect(() => {
    const coords: Record<string, [number, number, number]> = {
      anterior: [0, 0, 3.2],
      left: [2.9, 0.2, 1.3],
      posterior: [0, 0.3, -3.2],
      inferior: [0.3, -2.8, 1.6],
      spider: [1.8, -1.2, 2.2],
    };
    const target = coords[viewPreset] || coords.anterior;
    camera.position.set(target[0], target[1], target[2]);
    camera.lookAt(0, -0.1, 0);
  }, [viewPreset, camera]);

  return null;
}

// Scene Inner
interface HeartSceneProps {
  riskState: {
    targets: Record<string, { p: number; band: string }>;
  } | null;
  selectedTarget: string | null;
  onSelectTarget: (target: string | null) => void;
  trueLabels?: Record<string, number>;
  viewPreset: "anterior" | "left" | "posterior" | "inferior" | "spider";
  isAngioMode: boolean;
  onHoverTarget: (target: string | null) => void;
}

function HeartScene({
  riskState,
  selectedTarget,
  onSelectTarget,
  trueLabels,
  viewPreset,
  isAngioMode,
  onHoverTarget,
}: HeartSceneProps) {
  const [hoveredVessel, setHoveredVessel] = useState<string | null>(null);

  const getProb = useCallback(
    (target: string) => riskState?.targets?.[target]?.p ?? 0.5,
    [riskState]
  );

  const handleSelect = useCallback(
    (target: string) => {
      onSelectTarget(selectedTarget === target ? null : target);
    },
    [selectedTarget, onSelectTarget]
  );

  const handleHover = useCallback(
    (target: string | null) => {
      setHoveredVessel(target);
      onHoverTarget(target);
    },
    [onHoverTarget]
  );

  return (
    <>
      <CameraController viewPreset={viewPreset} />

      {/* Lighting Studio */}
      <ambientLight intensity={isAngioMode ? 0.2 : 0.65} />
      <directionalLight position={[4, 6, 5]} intensity={isAngioMode ? 0.4 : 1.2} color="#fff1e6" />
      <directionalLight position={[-4, 4, -4]} intensity={0.4} color="#a0c4ff" />
      <pointLight position={[0, -1, 2.5]} intensity={0.5} color="#2dd4bf" />
      <pointLight position={[0, 2, -2]} intensity={0.3} color="#f59e0b" />

      {/* Heart Anatomy Shell */}
      <HeartAnatomy isAngioMode={isAngioMode} />

      {/* LAD Conduits */}
      <CoronaryArteryTube
        points={ARTERY_PATHS.LAD}
        probability={getProb("LAD")}
        name="LAD"
        territory="Anterior Wall & Septum"
        isSelected={selectedTarget === "LAD" || selectedTarget === "CAD"}
        isHovered={hoveredVessel === "LAD"}
        onSelect={() => handleSelect("LAD")}
        onHover={(h) => handleHover(h ? "LAD" : null)}
        radius={0.042}
        truthLabel={trueLabels?.LAD}
        isAngioMode={isAngioMode}
      />
      <CoronaryArteryTube
        points={ARTERY_PATHS.LAD_D1}
        probability={getProb("LAD")}
        name="D1 (LAD)"
        territory="Anterolateral Myocardium"
        isSelected={selectedTarget === "LAD" || selectedTarget === "CAD"}
        isHovered={hoveredVessel === "LAD"}
        onSelect={() => handleSelect("LAD")}
        onHover={(h) => handleHover(h ? "LAD" : null)}
        radius={0.024}
        isAngioMode={isAngioMode}
      />
      <CoronaryArteryTube
        points={ARTERY_PATHS.LAD_D2}
        probability={getProb("LAD")}
        name="D2 (LAD)"
        territory="Diagonal Myocardium"
        isSelected={selectedTarget === "LAD" || selectedTarget === "CAD"}
        isHovered={hoveredVessel === "LAD"}
        onSelect={() => handleSelect("LAD")}
        onHover={(h) => handleHover(h ? "LAD" : null)}
        radius={0.022}
        isAngioMode={isAngioMode}
      />

      {/* LCX Conduits */}
      <CoronaryArteryTube
        points={ARTERY_PATHS.LCX}
        probability={getProb("LCX")}
        name="LCX"
        territory="Lateral & Postero-Lateral"
        isSelected={selectedTarget === "LCX" || selectedTarget === "CAD"}
        isHovered={hoveredVessel === "LCX"}
        onSelect={() => handleSelect("LCX")}
        onHover={(h) => handleHover(h ? "LCX" : null)}
        radius={0.038}
        truthLabel={trueLabels?.LCX}
        isAngioMode={isAngioMode}
      />
      <CoronaryArteryTube
        points={ARTERY_PATHS.LCX_OM}
        probability={getProb("LCX")}
        name="OM (LCX)"
        territory="Obtuse Marginal"
        isSelected={selectedTarget === "LCX" || selectedTarget === "CAD"}
        isHovered={hoveredVessel === "LCX"}
        onSelect={() => handleSelect("LCX")}
        onHover={(h) => handleHover(h ? "LCX" : null)}
        radius={0.024}
        isAngioMode={isAngioMode}
      />

      {/* RCA Conduits */}
      <CoronaryArteryTube
        points={ARTERY_PATHS.RCA}
        probability={getProb("RCA")}
        name="RCA"
        territory="Inferior Wall & RV"
        isSelected={selectedTarget === "RCA" || selectedTarget === "CAD"}
        isHovered={hoveredVessel === "RCA"}
        onSelect={() => handleSelect("RCA")}
        onHover={(h) => handleHover(h ? "RCA" : null)}
        radius={0.038}
        truthLabel={trueLabels?.RCA}
        isAngioMode={isAngioMode}
      />
      <CoronaryArteryTube
        points={ARTERY_PATHS.RCA_PDA}
        probability={getProb("RCA")}
        name="PDA (RCA)"
        territory="Posterior Descending"
        isSelected={selectedTarget === "RCA" || selectedTarget === "CAD"}
        isHovered={hoveredVessel === "RCA"}
        onSelect={() => handleSelect("RCA")}
        onHover={(h) => handleHover(h ? "RCA" : null)}
        radius={0.026}
        isAngioMode={isAngioMode}
      />

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        minDistance={1.6}
        maxDistance={5.5}
        minPolarAngle={Math.PI * 0.05}
        maxPolarAngle={Math.PI * 0.95}
        makeDefault
      />
    </>
  );
}

// WebGL Error Boundary
interface WebGLErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface WebGLErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends React.Component<WebGLErrorBoundaryProps, WebGLErrorBoundaryState> {
  constructor(props: WebGLErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("WebGL 3D Context Error caught by boundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ============================================================
// MAIN 3D VIEWER EXPORT
// ============================================================
interface Heart3DViewerProps {
  riskState: {
    targets: Record<string, { p: number; band: string }>;
  } | null;
  selectedTarget: string | null;
  onSelectTarget: (target: string | null) => void;
  trueLabels?: Record<string, number>;
}

export default function Heart3DViewer({
  riskState,
  selectedTarget,
  onSelectTarget,
  trueLabels,
}: Heart3DViewerProps) {
  const [viewPreset, setViewPreset] = useState<"anterior" | "left" | "posterior" | "inferior" | "spider">("anterior");
  const [useFallback2D, setUseFallback2D] = useState(false);
  const [isAngioMode, setIsAngioMode] = useState(false);
  const [hoveredVessel, setHoveredVessel] = useState<string | null>(null);

  const activeInspectVessel = hoveredVessel || (selectedTarget !== "CAD" ? selectedTarget : null);

  const inspectData = useMemo(() => {
    if (!activeInspectVessel) return null;
    const p = riskState?.targets?.[activeInspectVessel]?.p ?? 0.5;
    const band = riskState?.targets?.[activeInspectVessel]?.band ?? "moderate";
    const truth = trueLabels?.[activeInspectVessel];

    const territories: Record<string, string> = {
      LAD: "Anterior Interventricular Wall, Apex, & Septum",
      LCX: "Lateral and Postero-Lateral Left Ventricle",
      RCA: "Inferior Wall, Sinoatrial Node & Right Ventricle",
    };

    return {
      name: activeInspectVessel,
      p: (p * 100).toFixed(1),
      band,
      truth,
      territory: territories[activeInspectVessel] || "Epicardial Conduit",
    };
  }, [activeInspectVessel, riskState, trueLabels]);

  if (useFallback2D) {
    return (
      <div className="relative w-full h-full min-h-[580px]">
        <button
          onClick={() => setUseFallback2D(false)}
          className="absolute top-4 left-4 z-20 text-xs bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 px-3.5 py-1.5 rounded-lg border border-teal-500/30 font-medium transition-all"
        >
          Return to 3D Anatomy
        </button>
        <HeartFallbackSVG
          targets={riskState?.targets || {}}
          selectedTarget={selectedTarget}
          onSelectTarget={onSelectTarget}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[580px] select-none bg-gradient-to-b from-[#060a12] via-[#09101c] to-[#060a12] rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      {/* 1. Top Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between flex-wrap gap-3 pointer-events-auto">
        {/* Left: View Presets */}
        <div className="flex items-center gap-1.5 bg-[#06080c]/80 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
          <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider px-2 font-semibold">
            PROJECTION:
          </span>
          {(
            [
              { id: "anterior", label: "Anterior (RAO)" },
              { id: "left", label: "Lateral (LAO)" },
              { id: "spider", label: "Spider (LAO Caudal)" },
              { id: "posterior", label: "Posterior" },
              { id: "inferior", label: "Apical" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => setViewPreset(v.id)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all font-mono font-medium ${
                viewPreset === v.id
                  ? "bg-teal-500/25 text-teal-300 border border-teal-400/40 shadow-[0_0_12px_rgba(45,212,191,0.25)]"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Right: Mode Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAngioMode(!isAngioMode)}
            className={`text-xs px-3.5 py-1.5 rounded-xl transition-all font-mono font-semibold flex items-center gap-2 border ${
              isAngioMode
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : "bg-[#06080c]/80 text-gray-300 hover:text-white border-white/10 backdrop-blur-md"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isAngioMode ? "bg-cyan-400 animate-pulse" : "bg-gray-500"}`} />
            {isAngioMode ? "CT Angiogram: ON" : "Anatomical Tissue"}
          </button>

          <button
            onClick={() => setUseFallback2D(true)}
            className="text-xs px-3 py-1.5 rounded-xl bg-[#06080c]/80 text-gray-300 hover:text-amber-300 border border-white/10 backdrop-blur-md transition-all font-mono"
            title="Switch to 2D SVG Schematic"
          >
            2D Mode
          </button>
        </div>
      </div>

      {/* Real-time Hemodynamics & Lead-II Telemetry Monitor */}
      <div className="absolute top-20 right-4 z-10 hidden sm:flex flex-col items-end gap-1.5 p-3.5 bg-[#06080c]/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
            LEAD-II TELEMETRY • SINUS RHYTHM
          </span>
        </div>
        {/* Dynamic ECG waveform SVG */}
        <div className="w-44 h-7 overflow-hidden relative">
          <svg className="w-full h-full" viewBox="0 0 200 40" fill="none">
            <path
              d="M0 20 L30 20 L35 15 L40 25 L45 5 L50 35 L55 18 L60 20 L95 20 L100 15 L105 25 L110 5 L115 35 L120 18 L125 20 L160 20 L165 15 L170 25 L175 5 L180 35 L185 18 L190 20 L200 20"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-90"
            />
          </svg>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400">
          <span>HR: <strong className="text-white">72 bpm</strong></span>
          <span>MAP: <strong className="text-white">94 mmHg</strong></span>
          <span>CPP: <strong className="text-teal-300">68 mmHg</strong></span>
        </div>
      </div>

      {/* 2. Focused Single Vessel HUD Badge (NO overlapping tags!) */}
      {inspectData && (
        <div className="absolute top-20 left-4 z-10 max-w-xs p-3.5 bg-[#06080c]/90 backdrop-blur-xl border border-teal-400/30 rounded-xl shadow-2xl pointer-events-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-teal-300 tracking-wide">
              {inspectData.name} ARTERY
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                inspectData.band === "high"
                  ? "bg-red-500/20 text-red-300 border-red-500/40"
                  : inspectData.band === "moderate"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-blue-500/20 text-blue-300 border-blue-500/40"
              }`}
            >
              {inspectData.band} RISK
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-bold font-mono text-white">
              {inspectData.p}%
            </span>
            <span className="text-[11px] text-gray-400">calibrated stenosis probability</span>
          </div>
          <p className="text-[11px] text-gray-300 leading-snug">
            {inspectData.territory}
          </p>
          {inspectData.truth !== undefined && (
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-mono">
              <span className="text-gray-400">Angiography Cath Truth:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded ${
                  inspectData.truth === 1
                    ? "bg-red-500/20 text-red-400"
                    : "bg-green-500/20 text-green-400"
                }`}
              >
                {inspectData.truth === 1 ? "STENOTIC (>50%)" : "NORMAL"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 3. 3D Canvas with WebGL Error Boundary */}
      <WebGLErrorBoundary
        fallback={
          <HeartFallbackSVG
            targets={riskState?.targets || {}}
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
          />
        }
      >
        <Canvas
          camera={{ position: [0, 0, 3.2], fov: 42 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        >
          <HeartScene
            riskState={riskState}
            selectedTarget={selectedTarget}
            onSelectTarget={onSelectTarget}
            trueLabels={trueLabels}
            viewPreset={viewPreset}
            isAngioMode={isAngioMode}
            onHoverTarget={setHoveredVessel}
          />
        </Canvas>
      </WebGLErrorBoundary>

      {/* 4. Bottom Color Legend & Interaction Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center justify-between flex-wrap gap-3 pointer-events-none">
        {/* Color Ramp */}
        <div className="flex items-center gap-3 p-2.5 bg-[#06080c]/85 backdrop-blur-md rounded-xl border border-white/10 pointer-events-auto">
          <div className="h-2 w-36 rounded-full bg-gradient-to-r from-[#3b82f6] via-[#f59e0b] to-[#ef4444]" />
          <div className="flex gap-3 text-[11px] font-mono text-gray-300 font-medium">
            <span className="text-blue-400">0% Low</span>
            <span className="text-amber-400">50% Mod</span>
            <span className="text-red-400">100% High</span>
          </div>
        </div>

        {/* Interaction Guide */}
        <div className="text-xs font-mono text-gray-400 bg-[#06080c]/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 pointer-events-auto">
          Drag to rotate  •  Scroll to zoom  •  Click vessel to isolate
        </div>
      </div>
    </div>
  );
}
