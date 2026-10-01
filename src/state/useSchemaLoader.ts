"use client";

import { useCallback } from "react";

import { parseFile, parseFromUrl, parseTextSchema } from "@/lib/parsers";
import { ECOMMERCE_SAMPLE_SQL } from "@/lib/samples/ecommerce";
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
    () => run(async () => parseTextSchema(ECOMMERCE_SAMPLE_SQL, "Neon Commerce (sample)")),
    [run],
  );

  const loadFile = useCallback((file: File) => run(() => parseFile(file)), [run]);

  const loadText = useCallback(
    (content: string, name = "Pasted schema") => run(async () => parseTextSchema(content, name)),
    [run],
  );

  const loadUrl = useCallback((url: string) => run(() => parseFromUrl(url)), [run]);

  return { loadSample, loadFile, loadText, loadUrl };
}
