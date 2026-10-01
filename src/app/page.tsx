"use client";

import dynamic from "next/dynamic";

import UIOverlay from "@/components/UIOverlay";

// WebGL has no server-rendered equivalent, so the canvas is client-only.
const Canvas3D = dynamic(() => import("@/components/Canvas3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-[#04060d]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/25 border-t-cyan-400" />
    </div>
  ),
});

export default function Page() {
  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#04060d]">
      <Canvas3D />
      <UIOverlay />
    </main>
  );
}
