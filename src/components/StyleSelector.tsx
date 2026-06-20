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
  label,
  onClick,
}: {
  selected: boolean;
  swatch: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className="group relative overflow-visible rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "block size-6 rounded-md border border-gray-300/80 shadow-sm transition-transform group-hover:scale-105 dark:border-gray-600",
          selected && "ring-2 ring-ring ring-offset-1 ring-offset-background",
        )}
        style={{ backgroundColor: swatch }}
      />
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

  return (
    <div className="relative z-30 shrink-0 space-y-2 overflow-visible border-b border-gray-300 px-4 py-2 dark:border-gray-700">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground">
        {t.label}
      </span>
      <div className="flex flex-wrap items-center gap-2.5 overflow-visible">
        {SLIDE_THEMES.map((theme) => (
          <ThemeSwatch
            key={theme.id}
            selected={value === theme.id}
            swatch={theme.swatch}
            label={theme.name[language]}
            onClick={() => onChange(theme.id)}
          />
        ))}
      </div>
    </div>
  );
}
