import type { Language } from "@/lib/language";
import { getLanguage } from "@/lib/language";

const STORAGE_KEY = "presentation-filename";

export const DEFAULT_PRESENTATION_FILENAME = {
  en: "Untitled presentation",
  zh: "未命名演示文稿",
} as const;

const listeners = new Set<() => void>();

export function getDefaultPresentationFilename(
  language: Language = getLanguage(),
): string {
  return DEFAULT_PRESENTATION_FILENAME[language];
}

export function getPresentationFilename(
  language: Language = getLanguage(),
): string {
  if (typeof window === "undefined") {
    return DEFAULT_PRESENTATION_FILENAME[language];
  }
  const stored = window.localStorage.getItem(STORAGE_KEY)?.trim();
  return stored || DEFAULT_PRESENTATION_FILENAME[language];
}

export function setPresentationFilename(name: string): void {
  const trimmed = name.trim();
  if (trimmed) {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  listeners.forEach((listener) => listener());
}

export function subscribePresentationFilename(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function normalizePresentationFilename(
  name: string,
  language: Language = getLanguage(),
): string {
  const trimmed = name.trim();
  return trimmed || DEFAULT_PRESENTATION_FILENAME[language];
}

export function getExportBasename(
  name: string,
  language: Language = getLanguage(),
): string {
  const normalized = normalizePresentationFilename(name, language);
  const sanitized = normalized
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 120);
  return sanitized || "presentation";
}
