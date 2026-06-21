export type LibraryPreference = "default" | "custom";

const STORAGE_KEY = "quick-slides-library-preference";

export function getLibraryPreference(): LibraryPreference {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(STORAGE_KEY) === "custom" ? "custom" : "default";
}

export function setLibraryPreference(preference: LibraryPreference): void {
  localStorage.setItem(STORAGE_KEY, preference);
}
