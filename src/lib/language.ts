export type Language = "en" | "zh";

const STORAGE_KEY = "language";

const listeners = new Set<() => void>();

export function getLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "zh" ? "zh" : "en";
}

export function setLanguage(language: Language) {
  window.localStorage.setItem(STORAGE_KEY, language);
  listeners.forEach((listener) => listener());
}

export function toggleLanguage(): Language {
  const next = getLanguage() === "en" ? "zh" : "en";
  setLanguage(next);
  return next;
}

export function subscribeLanguage(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
