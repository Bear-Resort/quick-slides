import Cookies from "js-cookie";

/** Resolved appearance applied to the document. */
export type Theme = "day" | "night";

/** User preference — may follow the OS. */
export type ThemePreference = "day" | "night" | "system";

const THEME_COOKIE = "theme";
const ENERGY_COOKIE = "energy-save";

const themeListeners = new Set<() => void>();

function notifyThemeListeners() {
  themeListeners.forEach((listener) => listener());
}

export function subscribeTheme(callback: () => void) {
  themeListeners.add(callback);
  return () => {
    themeListeners.delete(callback);
  };
}

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "day";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

export function getThemePreference(): ThemePreference {
  const stored = Cookies.get(THEME_COOKIE);
  if (stored === "night" || stored === "system" || stored === "day") return stored;
  return "day";
}

export function getEnergySaveMode(): boolean {
  return Cookies.get(ENERGY_COOKIE) === "1";
}

/** Resolved day/night used for rendering (energy save forces night). */
export function getTheme(): Theme {
  if (getEnergySaveMode()) return "night";
  const preference = getThemePreference();
  if (preference === "system") return getSystemTheme();
  return preference;
}

function applyResolvedTheme() {
  const theme = getTheme();
  const energy = getEnergySaveMode();
  document.documentElement.classList.toggle("night", theme === "night");
  document.documentElement.classList.toggle("energy-save", energy);
  notifyThemeListeners();
}

export function setThemePreference(preference: ThemePreference) {
  if (getEnergySaveMode() && preference !== "night") {
    // Energy save locks dark; still persist preference for when energy save turns off.
  }
  Cookies.set(THEME_COOKIE, preference, { expires: 365, path: "/" });
  applyResolvedTheme();
}

/** @deprecated Prefer setThemePreference — kept for callers that want day/night only. */
export function setTheme(theme: Theme) {
  setThemePreference(theme);
}

export function setEnergySaveMode(enabled: boolean) {
  Cookies.set(ENERGY_COOKIE, enabled ? "1" : "0", { expires: 365, path: "/" });
  applyResolvedTheme();
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "night" ? "day" : "night";
  setThemePreference(next);
  return next;
}

export function initTheme() {
  applyResolvedTheme();

  if (typeof window === "undefined") return;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getThemePreference() === "system" && !getEnergySaveMode()) {
      applyResolvedTheme();
    }
  };
  media.addEventListener("change", onChange);
}
