export type Locale = "en" | "fr";

export const LOCALES: Locale[] = ["en", "fr"];

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "EN",
  fr: "FR",
};

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "fr" : "en";
}

/** Browser language, falling back to English for anything that isn't French. */
export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}
