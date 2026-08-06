import type { Language } from "@/lib/language";
import type { SlideColorMode } from "@/lib/slideThemes";
import type { Theme } from "@/lib/theme";

export const presenterUiCopy = {
  en: {
    exit: "Exit",
    previous: "Previous",
    next: "Next",
    annotateToolbar: "Annotation tools",
    showAnnotate: "Show annotation tools",
    hideAnnotate: "Hide annotation tools",
    pointer: "Red pointer",
    penBlue: "Blue pen",
    penRed: "Red pen",
    penBlack: "Black pen",
    penWhite: "White pen",
    eraser: "Eraser",
    clearPage: "Clear drawings on this slide",
    hint: "← → or Space to navigate · Esc to exit",
    help: "Keyboard shortcuts",
    settings: "Settings",
    themeLabel: "Slides",
    themeDay: "Day",
    themeNight: "Night",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    languageEn: "English",
    languageZh: "中文",
  },
  zh: {
    exit: "退出",
    previous: "上一页",
    next: "下一页",
    annotateToolbar: "批注工具",
    showAnnotate: "显示批注工具",
    hideAnnotate: "隐藏批注工具",
    pointer: "红色指针",
    penBlue: "蓝色笔",
    penRed: "红色笔",
    penBlack: "黑色笔",
    penWhite: "白色笔",
    eraser: "橡皮",
    clearPage: "清除本页批注",
    hint: "← → 或空格切换 · Esc 退出",
    help: "键盘快捷键",
    settings: "设置",
    themeLabel: "幻灯片",
    themeDay: "日间",
    themeNight: "夜间",
    themeLight: "浅色",
    themeDark: "深色",
    themeSystem: "系统",
    languageEn: "English",
    languageZh: "中文",
  },
} as const;

export function getPresenterThemeLabel(language: Language, theme: Theme): string {
  const t = presenterUiCopy[language];
  return theme === "night" ? t.themeNight : t.themeDay;
}

export function getPresenterSlideColorLabel(
  language: Language,
  colorMode: SlideColorMode,
): string {
  const t = presenterUiCopy[language];
  return colorMode === "dark" ? t.themeDark : t.themeLight;
}

export function getPresenterLanguageLabel(language: Language): string {
  return language === "en"
    ? presenterUiCopy.en.languageEn
    : presenterUiCopy.zh.languageZh;
}
