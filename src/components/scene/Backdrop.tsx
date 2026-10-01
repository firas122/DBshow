"use client";

import { useMemo } from "react";
import { Grid, Stars } from "@react-three/drei";

import { layoutBounds } from "@/lib/graph/layouts";
import { useSchemaStore } from "@/state/useSchemaStore";

export default function Backdrop() {
  const positions = useSchemaStore((state) => state.positions);
  const bounds = useMemo(() => layoutBounds(positions), [positions]);
  const floorY = bounds.center[1] - bounds.radius * 1.15;

  return (
    <>
      <color attach="background" args={["#0a0e1a"]} />
      <fogExp2 attach="fog" args={["#0a0e1a", 0.0075]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#67e8f9", "#0b1220", 0.45]} />
      <directionalLight position={[18, 26, 14]} intensity={1.1} color="#dbeafe" />
      <pointLight position={[-24, -8, -18]} intensity={180} distance={120} color="#22d3ee" />
      <pointLight position={[22, 14, 20]} intensity={140} distance={120} color="#a855f7" />

      <Stars radius={180} depth={80} count={2600} factor={5} saturation={0} fade speed={0.35} />

      <Grid
        position={[bounds.center[0], floorY, bounds.center[2]]}
        args={[bounds.radius * 6, bounds.radius * 6]}
        cellSize={2.5}
        cellThickness={0.6}
        cellColor="#14304a"
        sectionSize={12.5}
        sectionThickness={1.1}
        sectionColor="#1e5f80"
        fadeDistance={bounds.radius * 7}
        fadeStrength={1.6}
        infiniteGrid
        followCamera={false}
      />
    </>
  );
}
