"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

import Backdrop from "@/components/scene/Backdrop";
import CameraRig from "@/components/scene/CameraRig";
import SchemaScene from "@/components/scene/SchemaScene";
import { useSchemaStore } from "@/state/useSchemaStore";

export default function Canvas3D() {
  const selectTable = useSchemaStore((state) => state.selectTable);
  const highlightRelation = useSchemaStore((state) => state.highlightRelation);

  return (
    <Canvas
      className="absolute inset-0"
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      camera={{ position: [24, 18, 34], fov: 48, near: 0.1, far: 4000 }}
      onPointerMissed={() => {
        // Clicking empty space clears the current selection.
        selectTable(null);
        highlightRelation(null);
      }}
    >
      <Suspense fallback={null}>
        <Backdrop />
        <SchemaScene />
        <CameraRig />
      </Suspense>
    </Canvas>
  );
}
