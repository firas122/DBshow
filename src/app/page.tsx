"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

import UIOverlay from "@/components/UIOverlay";
import { useSchemaLoader } from "@/state/useSchemaLoader";

// WebGL has no server-rendered equivalent, so the canvas is client-only.
const Canvas3D = dynamic(() => import("@/components/Canvas3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-[#0a0e1a]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d99a3f]/25 border-t-[#d99a3f]" />
    </div>
  ),
});

export default function Page() {
  const { loadSample, loadUrl } = useSchemaLoader();
  const triedInitialLoad = useRef(false);

  // A shared link (?sample=… or ?url=…) reloads the same schema on open.
  // The matching ?table=… re-focus lives in UIOverlay, alongside the effect
  // that writes these params back out — keeping both in one component avoids
  // a cross-component race where the URL gets rewritten before the deep link
  // is applied.
  useEffect(() => {
    if (triedInitialLoad.current) return;
    triedInitialLoad.current = true;
    const params = new URLSearchParams(window.location.search);
    const sample = params.get("sample");
    const url = params.get("url");
    if (sample) loadSample(sample);
    else if (url) loadUrl(url);
  }, [loadSample, loadUrl]);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#0a0e1a]">
      <Canvas3D />
      <UIOverlay />
    </main>
  );
}
