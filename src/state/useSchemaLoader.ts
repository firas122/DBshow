"use client";

import { useCallback } from "react";

import type { Locale } from "@/lib/i18n/locale";
import { parseFile, parseFromUrl, parseTextSchema } from "@/lib/parsers";
import { findSample } from "@/lib/samples";
import { useSchemaStore } from "@/state/useSchemaStore";

const GENERIC_ERROR: Record<Locale, string> = {
  en: "Something went wrong while reading that schema.",
  fr: "Une erreur est survenue pendant la lecture de ce schéma.",
};

const UNKNOWN_SAMPLE: Record<Locale, (key: string) => string> = {
  en: (key) => `Unknown sample "${key}".`,
  fr: (key) => `Exemple « ${key} » inconnu.`,
};

function messageFor(error: unknown, locale: Locale): string {
  if (error instanceof Error) return error.message;
  return GENERIC_ERROR[locale];
}

/** Shared entry points for getting a schema into the store. */
export function useSchemaLoader() {
  const locale = useSchemaStore((state) => state.locale);
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
        setError(messageFor(error, locale));
        return false;
      }
    },
    [locale, setError, setGraph, setLoading],
  );

  const loadSample = useCallback(
    async (key: string) => {
      const sample = findSample(key);
      if (!sample) {
        setError(UNKNOWN_SAMPLE[locale](key));
        return false;
      }
      const ok = await run(async () => parseTextSchema(sample.sql, sample.name, locale));
      if (ok) {
        setShareParams({ kind: "sample", key });
        setCompareBaseline(sample.compareBaseline ?? null);
      }
      return ok;
    },
    [locale, run, setCompareBaseline, setError, setShareParams],
  );

  const loadFile = useCallback(
    async (file: File) => {
      const ok = await run(() => parseFile(file, locale));
      if (ok) {
        setShareParams(null);
        setCompareBaseline(null);
      }
      return ok;
    },
    [locale, run, setCompareBaseline, setShareParams],
  );

  const loadText = useCallback(
    async (content: string, name?: string) => {
      const ok = await run(async () => parseTextSchema(content, name, locale));
      if (ok) {
        setShareParams(null);
        setCompareBaseline(null);
      }
      return ok;
    },
    [locale, run, setCompareBaseline, setShareParams],
  );

  const loadUrl = useCallback(
    async (url: string) => {
      const ok = await run(() => parseFromUrl(url, locale));
      if (ok) {
        setShareParams({ kind: "url", url });
        setCompareBaseline(null);
      }
      return ok;
    },
    [locale, run, setCompareBaseline, setShareParams],
  );

  return { loadSample, loadFile, loadText, loadUrl };
}
