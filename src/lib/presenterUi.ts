import type { Language } from "@/lib/language";
import type { Theme } from "@/lib/theme";

export const presenterUiCopy = {
  en: {
    exit: "Exit",
    previous: "Previous",
    next: "Next",
    hint: "← → or Space to navigate · Esc to exit",
    help: "Keyboard shortcuts",
    settings: "Settings",
    themeLabel: "Theme",
    themeDay: "Day",
    themeNight: "Night",
    languageEn: "English",
    languageZh: "中文",
  },
  zh: {
    exit: "退出",
    previous: "上一页",
    next: "下一页",
    hint: "← → 或空格切换 · Esc 退出",
    help: "键盘快捷键",
    settings: "设置",
    themeLabel: "主题",
    themeDay: "日间",
    themeNight: "夜间",
    languageEn: "English",
    languageZh: "中文",
  },
} as const;

export function getPresenterThemeLabel(language: Language, theme: Theme): string {
  const t = presenterUiCopy[language];
  return theme === "night" ? t.themeNight : t.themeDay;
}

export function getPresenterLanguageLabel(language: Language): string {
  return language === "en"
    ? presenterUiCopy.en.languageEn
    : presenterUiCopy.zh.languageZh;
}
