/** Local editor / autosave preferences (persisted in localStorage). */

export type AutosaveDelayMs =
  | 3000
  | 5000
  | 10000
  | 20000
  | 30000
  | 60000
  | 300000
  | 0;

export type EditorFontSize = "sm" | "md" | "lg" | "xl";
export type EditorFontFamily = "mono" | "sans" | "serif";

export const AUTOSAVE_OPTIONS: ReadonlyArray<{
  value: AutosaveDelayMs;
  label: { en: string; zh: string };
}> = [
  { value: 3000, label: { en: "3 seconds", zh: "3 秒" } },
  { value: 5000, label: { en: "5 seconds", zh: "5 秒" } },
  { value: 10000, label: { en: "10 seconds", zh: "10 秒" } },
  { value: 20000, label: { en: "20 seconds", zh: "20 秒" } },
  { value: 30000, label: { en: "30 seconds", zh: "30 秒" } },
  { value: 60000, label: { en: "1 minute", zh: "1 分钟" } },
  { value: 300000, label: { en: "5 minutes", zh: "5 分钟" } },
  { value: 0, label: { en: "Never", zh: "从不" } },
];

export const EDITOR_FONT_SIZE_OPTIONS: ReadonlyArray<{
  value: EditorFontSize;
  label: { en: string; zh: string };
  className: string;
}> = [
  { value: "sm", label: { en: "Small", zh: "小" }, className: "text-xs" },
  { value: "md", label: { en: "Medium", zh: "中" }, className: "text-sm" },
  { value: "lg", label: { en: "Large", zh: "大" }, className: "text-base" },
  { value: "xl", label: { en: "Extra large", zh: "特大" }, className: "text-lg" },
];

export const EDITOR_FONT_FAMILY_OPTIONS: ReadonlyArray<{
  value: EditorFontFamily;
  label: { en: string; zh: string };
  className: string;
}> = [
  {
    value: "mono",
    label: { en: "Monospace", zh: "等宽" },
    className:
      "[font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace]",
  },
  {
    value: "sans",
    label: { en: "Sans serif", zh: "无衬线" },
    className:
      "[font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif]",
  },
  {
    value: "serif",
    label: { en: "Serif", zh: "衬线" },
    className: "[font-family:ui-serif,Georgia,Cambria,Times New Roman,serif]",
  },
];

const AUTOSAVE_KEY = "quick-slides.autosave-delay-ms";
const FONT_SIZE_KEY = "quick-slides.editor-font-size";
const FONT_FAMILY_KEY = "quick-slides.editor-font-family";

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeEditorSettings(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
  notify();
}

export function getAutosaveDelayMs(): AutosaveDelayMs {
  const raw = readStorage(AUTOSAVE_KEY);
  const parsed = raw == null ? NaN : Number(raw);
  if (AUTOSAVE_OPTIONS.some((option) => option.value === parsed)) {
    return parsed as AutosaveDelayMs;
  }
  return 3000;
}

export function setAutosaveDelayMs(delay: AutosaveDelayMs) {
  writeStorage(AUTOSAVE_KEY, String(delay));
}

export function getEditorFontSize(): EditorFontSize {
  const raw = readStorage(FONT_SIZE_KEY);
  if (EDITOR_FONT_SIZE_OPTIONS.some((option) => option.value === raw)) {
    return raw as EditorFontSize;
  }
  return "md";
}

export function setEditorFontSize(size: EditorFontSize) {
  writeStorage(FONT_SIZE_KEY, size);
}

export function getEditorFontFamily(): EditorFontFamily {
  const raw = readStorage(FONT_FAMILY_KEY);
  if (EDITOR_FONT_FAMILY_OPTIONS.some((option) => option.value === raw)) {
    return raw as EditorFontFamily;
  }
  return "mono";
}

export function setEditorFontFamily(family: EditorFontFamily) {
  writeStorage(FONT_FAMILY_KEY, family);
}

export function editorFontSizeClass(size: EditorFontSize): string {
  return (
    EDITOR_FONT_SIZE_OPTIONS.find((option) => option.value === size)?.className ??
    "text-sm"
  );
}

export function editorFontFamilyClass(family: EditorFontFamily): string {
  return (
    EDITOR_FONT_FAMILY_OPTIONS.find((option) => option.value === family)
      ?.className ??
    "[font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace]"
  );
}
