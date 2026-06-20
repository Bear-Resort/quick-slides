import { useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleLanguage } from "@/lib/language";
import { presenterUiCopy } from "@/lib/presenterUi";
import { useLanguage } from "@/lib/useLanguage";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme";

type MenuProps = {
  /** Keep the menu inside fullscreen containers instead of portaling to body. */
  portalled?: boolean;
  contentSide?: "top" | "bottom";
};

export function Menu({ portalled = true, contentSide = "bottom" }: MenuProps) {
  const language = useLanguage();
  const [theme, setTheme] = useState<Theme>(() => getTheme());

  const t = {
    setting: presenterUiCopy[language].settings,
    themeLabel: presenterUiCopy[language].themeLabel,
    themeValue:
      theme === "night"
        ? presenterUiCopy[language].themeNight
        : presenterUiCopy[language].themeDay,
    languageToggle:
      language === "en"
        ? `Language: ${presenterUiCopy.en.languageEn}`
        : `语言: ${presenterUiCopy.zh.languageZh}`,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={t.setting}
          title={t.setting}
          className="slide-locate-btn"
        >
          <Settings />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side={contentSide} portalled={portalled}>
        <DropdownMenuLabel>{t.setting}</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={(event) => {
            event.preventDefault();
            setTheme(toggleTheme());
          }}
        >
          {t.themeLabel}: {t.themeValue}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(event) => {
            event.preventDefault();
            toggleLanguage();
          }}
        >
          {t.languageToggle}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
