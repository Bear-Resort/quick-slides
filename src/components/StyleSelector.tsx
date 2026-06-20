import { SLIDE_THEMES, type SlideThemeId } from "@/lib/slideThemes";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    label: "Theme",
  },
  zh: {
    label: "主题",
  },
} as const;

type StyleSelectorProps = {
  value: SlideThemeId;
  onChange: (themeId: SlideThemeId) => void;
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
      onClick={onClick}
      className="group relative overflow-visible rounded-lg p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "relative block size-8 overflow-hidden rounded-md border border-gray-300/80 shadow-sm transition-transform group-hover:scale-105 dark:border-gray-600",
          selected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
        )}
        style={{ backgroundColor: swatchBackground }}
      >
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-contain p-1"
          />
        ) : null}
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-gray-300 bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-gray-700"
      >
        {label}
      </span>
    </button>
  );
}

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  const language = useLanguage();
  const t = copy[language];
  const activeTheme =
    SLIDE_THEMES.find((theme) => theme.id === value) ?? SLIDE_THEMES[0];
  const activeSwatchBackground =
    activeTheme.iconUrl && activeTheme.iconSwatch
      ? activeTheme.iconSwatch
      : activeTheme.swatch;

  return (
    <div className="relative z-30 shrink-0 space-y-2 overflow-visible border-b border-gray-300 px-4 py-2 dark:border-gray-700">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground">
          {t.label}
        </span>
        <span
          className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground"
          aria-live="polite"
        >
          <span
            className="relative block size-3.5 shrink-0 overflow-hidden rounded border border-gray-300/80 dark:border-gray-600"
            style={{ backgroundColor: activeSwatchBackground }}
            aria-hidden
          >
            {activeTheme.iconUrl ? (
              <img
                src={activeTheme.iconUrl}
                alt=""
                className="absolute inset-0 size-full object-contain p-px"
              />
            ) : null}
          </span>
          <span className="truncate">{activeTheme.name[language]}</span>
        </span>
      </div>
      <div className="flex min-h-10 flex-wrap items-center gap-3 overflow-visible py-0.5">
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
  );
}
