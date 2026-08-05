import { useEffect, useState } from "react";
import { Moon, Palette, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogPortal } from "@/components/ui/dialog-portal";
import {
  SLIDE_THEMES,
  type SlideColorMode,
  type SlideThemeId,
} from "@/lib/slideThemes";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    theme: "Theme",
    dialogTitle: "Slide theme",
    style: "Style",
    color: "Color",
    slideLight: "Light",
    slideDark: "Dark",
    close: "Close",
  },
  zh: {
    theme: "主题",
    dialogTitle: "幻灯片主题",
    style: "样式",
    color: "颜色",
    slideLight: "浅色",
    slideDark: "深色",
    close: "关闭",
  },
} as const;

type StyleSelectorProps = {
  value: SlideThemeId;
  colorMode: SlideColorMode;
  /** Which markdown file this theme applies to. */
  fileLabel?: string;
  onChange: (themeId: SlideThemeId) => void;
  onColorModeChange: (mode: SlideColorMode) => void;
};

function ThemeSwatch({
  selected,
  swatch,
  iconSwatch,
  iconUrl,
  label,
  onClick,
}: {
  selected: boolean;
  swatch: string;
  iconSwatch?: string;
  iconUrl?: string;
  label: string;
  onClick: () => void;
}) {
  const swatchBackground = iconUrl && iconSwatch ? iconSwatch : swatch;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      title={label}
      onClick={onClick}
      className={cn(
        "theme-swatch group/swatch relative size-8 shrink-0 overflow-visible rounded-md p-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span
        className={cn(
          "theme-swatch-face absolute inset-0 overflow-hidden rounded-md border-2 transition-[box-shadow,border-color]",
          selected
            ? "border-foreground shadow-[0_0_0_1px_hsl(var(--background))]"
            : "border-transparent group-hover/swatch:border-foreground/35",
        )}
        style={{ backgroundColor: swatchBackground }}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-contain p-0.5"
          />
        ) : null}
      </span>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[70] -translate-x-1/2",
          "whitespace-nowrap rounded-md border border-white/15 bg-background/95 px-2 py-1",
          "text-[10px] font-medium text-foreground shadow-md backdrop-blur-sm",
          "opacity-0 transition-opacity duration-150",
          "group-hover/swatch:opacity-100 group-focus-visible/swatch:opacity-100",
        )}
      >
        {label}
      </span>
    </button>
  );
}

function ThemeDialog({
  open,
  onClose,
  value,
  colorMode,
  fileLabel,
  onChange,
  onColorModeChange,
}: StyleSelectorProps & { open: boolean; onClose: () => void }) {
  const language = useLanguage();
  const t = copy[language];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const colorModes: Array<{ id: SlideColorMode; label: string; icon: typeof Sun }> = [
    { id: "light", label: t.slideLight, icon: Sun },
    { id: "dark", label: t.slideDark, icon: Moon },
  ];

  const selectedTheme =
    SLIDE_THEMES.find((theme) => theme.id === value) ?? SLIDE_THEMES[0];
  const selectedName = selectedTheme?.name[language] ?? "";

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-slides-theme-title"
          className="glass-panel glass-panel-dialog flex w-full max-w-[380px] flex-col overflow-visible rounded-xl border shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="glass-divider relative z-[1] flex shrink-0 items-center justify-between border-b px-5 py-3.5">
            <div className="min-w-0">
              <h2 id="quick-slides-theme-title" className="text-base font-semibold">
                {t.dialogTitle}
              </h2>
              {fileLabel ? (
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                  {fileLabel}
                </p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onClose}
              aria-label={t.close}
              title={t.close}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="relative z-[1] space-y-5 px-5 py-4">
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                  {t.style}
                </p>
                <p className="truncate text-xs font-medium text-foreground">
                  {selectedName}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 overflow-visible pt-1">
                {SLIDE_THEMES.map((theme) => (
                  <ThemeSwatch
                    key={theme.id}
                    selected={value === theme.id}
                    swatch={theme.swatch}
                    iconSwatch={theme.iconSwatch}
                    iconUrl={theme.iconUrl}
                    label={theme.name[language]}
                    onClick={() => onChange(theme.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                {t.color}
              </p>
              <div
                role="radiogroup"
                aria-label={t.color}
                className="glass-seg-track relative grid h-10 w-full grid-cols-2 gap-1"
              >
                <div
                  aria-hidden
                  className="glass-seg-active pointer-events-none absolute top-[var(--glass-seg-pad)] bottom-[var(--glass-seg-pad)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  style={{
                    left: `calc(${(colorMode === "dark" ? 1 : 0) * 50}% + var(--glass-seg-pad))`,
                    width: "calc(50% - (2 * var(--glass-seg-pad)))",
                  }}
                />
                {colorModes.map(({ id, label, icon: Icon }) => {
                  const active = colorMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => onColorModeChange(id)}
                      className="relative z-[1] inline-flex items-center justify-center gap-1.5 px-2 text-xs font-medium text-muted-foreground"
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}

export function StyleSelector({
  value,
  colorMode,
  fileLabel,
  onChange,
  onColorModeChange,
}: StyleSelectorProps) {
  const language = useLanguage();
  const t = copy[language];
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.theme}
        title={t.theme}
        className="panel-chrome-action glass-toolbar-action inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-foreground"
      >
        <Palette className="size-3.5 shrink-0" aria-hidden />
        <span className="panel-chrome-action-label">{t.theme}</span>
      </button>
      <ThemeDialog
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        colorMode={colorMode}
        fileLabel={fileLabel}
        onChange={onChange}
        onColorModeChange={onColorModeChange}
      />
    </>
  );
}
