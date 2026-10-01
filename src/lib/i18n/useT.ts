"use client";

import { UI_STRINGS, type UiStrings } from "@/lib/i18n/ui";
import { useSchemaStore } from "@/state/useSchemaStore";

/** Current UI dictionary, reactive to the store's locale. */
export function useT(): UiStrings {
  const locale = useSchemaStore((state) => state.locale);
  return UI_STRINGS[locale];
}
