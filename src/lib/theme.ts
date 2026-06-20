import Cookies from "js-cookie";

export type Theme = "day" | "night";

const THEME_COOKIE = "theme";

function applyTheme(theme: Theme) {
  if (theme === "night") {
    document.documentElement.classList.add("night");
  } else {
    document.documentElement.classList.remove("night");
  }
}

export function getTheme(): Theme {
  const stored = Cookies.get(THEME_COOKIE);
  return stored === "night" ? "night" : "day";
}

export function setTheme(theme: Theme) {
  Cookies.set(THEME_COOKIE, theme, { expires: 365, path: "/" });
  applyTheme(theme);
}

export function toggleTheme(): Theme {
  const next = getTheme() === "night" ? "day" : "night";
  setTheme(next);
  return next;
}

export function initTheme() {
  applyTheme(getTheme());
}
