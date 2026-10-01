"use client";

import { useCallback } from "react";

import { parseFile, parseFromUrl, parseTextSchema } from "@/lib/parsers";
import { findSample } from "@/lib/samples";
import { useSchemaStore } from "@/state/useSchemaStore";

function messageFor(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong while reading that schema.";
}

/** Shared entry points for getting a schema into the store. */
export function useSchemaLoader() {
  const setLoading = useSchemaStore((state) => state.setLoading);
  const setGraph = useSchemaStore((state) => state.setGraph);
  const setError = useSchemaStore((state) => state.setError);
  const setShareParams = useSchemaStore((state) => state.setShareParams);
  const setCompareBaseline = useSchemaStore((state) => state.setCompareBaseline);

  const run = useCallback(
    async (task: () => Promise<ReturnType<typeof parseTextSchema>>) => {
      setLoading();
      try {
        // Yield once so the loading state paints before parsing blocks the thread.
        await new Promise((resolve) => setTimeout(resolve, 16));
        setGraph(await task());
        return true;
      } catch (error) {
        setError(messageFor(error));
        return false;
      }
    },
    [setError, setGraph, setLoading],
  );

  const loadSample = useCallback(
    async (key: string) => {
      const sample = findSample(key);
      if (!sample) {
        setError(`Unknown sample "${key}".`);
        return false;
      }
      const ok = await run(async () => parseTextSchema(sample.sql, sample.name));
      if (ok) {
        setShareParams({ kind: "sample", key });
        setCompareBaseline(sample.compareBaseline ?? null);
      }
      return ok;
    },
    [run, setCompareBaseline, setError, setShareParams],
  );

  const loadFile = useCallback(
    async (file: File) => {
      const ok = await run(() => parseFile(file));
      if (ok) {
        setShareParams(null);
        setCompareBaseline(null);
      }
      return ok;
    },
    [run, setCompareBaseline, setShareParams],
  );

  const loadText = useCallback(
    async (content: string, name = "Pasted schema") => {
      const ok = await run(async () => parseTextSchema(content, name));
      if (ok) {
        setShareParams(null);
        setCompareBaseline(null);
      }
      return ok;
    },
    [run, setCompareBaseline, setShareParams],
  );

  const loadUrl = useCallback(
    async (url: string) => {
      const ok = await run(() => parseFromUrl(url));
      if (ok) {
        setShareParams({ kind: "url", url });
        setCompareBaseline(null);
      }
      return ok;
    },
    [run, setCompareBaseline, setShareParams],
  );

  return { loadSample, loadFile, loadText, loadUrl };
}
