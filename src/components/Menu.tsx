import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Leaf, Monitor, Moon, Settings, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { setLanguage, type Language } from "@/lib/language";
import { presenterUiCopy } from "@/lib/presenterUi";
import { useLanguage } from "@/lib/useLanguage";
import {
  getEnergySaveMode,
  getThemePreference,
  setEnergySaveMode,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

type MenuProps = {
  /** Keep the dialog inside fullscreen containers instead of portaling to body. */
  portalled?: boolean;
};

type SettingsTab = "appearance" | "language";

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium tracking-wide">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="glass-toggle"
    >
      <span className="glass-toggle-thumb" />
    </button>
  );
}

function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  disabled,
}: {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{
    id: T;
    label: string;
    icon?: ComponentType<{ className?: string }>;
  }>;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  const count = options.length;

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "glass-seg-track relative grid h-10 w-full gap-1",
        disabled && "pointer-events-none opacity-50",
      )}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <div
        aria-hidden
        className="glass-seg-active pointer-events-none absolute top-[var(--glass-seg-pad)] bottom-[var(--glass-seg-pad)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          left: `calc(${(activeIndex / count) * 100}% + var(--glass-seg-pad))`,
          width: `calc(${100 / count}% - (2 * var(--glass-seg-pad)))`,
        }}
      />
      {options.map((option) => {
        const active = option.id === value;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-state={active ? "active" : "inactive"}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className="relative z-[1] flex items-center justify-center gap-1.5 px-2 text-xs font-medium text-muted-foreground"
          >
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const language = useLanguage();
  const t = presenterUiCopy[language];
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [preference, setPreference] = useState<ThemePreference>(() => getThemePreference());
  const [energySave, setEnergySave] = useState(() => getEnergySaveMode());

  useEffect(() => {
    if (!open) return;
    setPreference(getThemePreference());
    setEnergySave(getEnergySaveMode());
  }, [open]);

  useEffect(() => {
    return subscribeTheme(() => {
      setPreference(getThemePreference());
      setEnergySave(getEnergySaveMode());
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const tabs: Array<{ id: SettingsTab; label: string }> = [
    { id: "appearance", label: language === "zh" ? "外观" : "Appearance" },
    { id: "language", label: language === "zh" ? "语言" : "Language" },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-slides-settings-title"
        className="glass-panel glass-panel-dialog flex h-[min(420px,90vh)] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="glass-divider relative z-[1] flex shrink-0 items-center justify-between border-b px-5 py-3.5">
          <h2 id="quick-slides-settings-title" className="text-base font-semibold">
            {t.settings}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            aria-label={language === "zh" ? "关闭" : "Close"}
            title={language === "zh" ? "关闭" : "Close"}
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden px-5 pb-5 pt-3">
          <div
            role="tablist"
            aria-label={t.settings}
            className="glass-seg-track relative grid h-10 w-full shrink-0 gap-1"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            <div
              aria-hidden
              className="glass-seg-active pointer-events-none absolute top-[var(--glass-seg-pad)] bottom-[var(--glass-seg-pad)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                left: `calc(${(tabs.findIndex((item) => item.id === tab) / tabs.length) * 100}% + var(--glass-seg-pad))`,
                width: `calc(${100 / tabs.length}% - (2 * var(--glass-seg-pad)))`,
              }}
            />
            {tabs.map((item) => {
              const active = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-state={active ? "active" : "inactive"}
                  onClick={() => setTab(item.id)}
                  className="relative z-[1] flex items-center justify-center px-2 text-xs font-medium text-muted-foreground"
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {tab === "appearance" ? (
              <div className="space-y-5">
                <SettingRow
                  label={t.themeLabel}
                  description={
                    energySave
                      ? language === "zh"
                        ? "节能模式下锁定为夜间"
                        : "Locked to night while Energy Save Mode is on"
                      : preference === "system"
                        ? language === "zh"
                          ? "跟随系统外观"
                          : "Follow your system appearance"
                        : language === "zh"
                          ? "日间、夜间，或跟随系统"
                          : "Day, night, or match your system"
                  }
                >
                  <SegmentedControl
                    ariaLabel={t.themeLabel}
                    value={preference}
                    disabled={energySave}
                    onChange={(next) => {
                      setPreference(next);
                      setThemePreference(next);
                    }}
                    options={[
                      { id: "day", label: t.themeDay, icon: Sun },
                      { id: "night", label: t.themeNight, icon: Moon },
                      {
                        id: "system",
                        label: t.themeSystem,
                        icon: Monitor,
                      },
                    ]}
                  />
                </SettingRow>

                <SettingRow
                  label={language === "zh" ? "节能模式" : "Energy Save Mode"}
                  description={
                    language === "zh"
                      ? "近黑界面、关闭玻璃模糊，并锁定夜间主题"
                      : "Near-black UI, no glass/blur, locks night theme"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Leaf className="size-3.5" aria-hidden />
                      {energySave
                        ? language === "zh"
                          ? "开"
                          : "On"
                        : language === "zh"
                          ? "关"
                          : "Off"}
                    </span>
                    <Toggle
                      checked={energySave}
                      label={language === "zh" ? "节能模式" : "Energy Save Mode"}
                      onChange={(next) => {
                        setEnergySave(next);
                        setEnergySaveMode(next);
                      }}
                    />
                  </div>
                </SettingRow>
              </div>
            ) : (
              <SettingRow
                label={language === "zh" ? "语言" : "Language"}
                description={
                  language === "zh"
                    ? "界面与示例文案的显示语言"
                    : "Language for UI and sample content"
                }
              >
                <select
                  className="glass-input w-full rounded-lg px-3 py-2 text-sm"
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as Language)}
                  aria-label={language === "zh" ? "语言" : "Language"}
                >
                  <option value="en">{presenterUiCopy.en.languageEn}</option>
                  <option value="zh">{presenterUiCopy.zh.languageZh}</option>
                </select>
              </SettingRow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Menu({ portalled = true }: MenuProps) {
  const language = useLanguage();
  const [open, setOpen] = useState(false);

  const dialog = <SettingsDialog open={open} onClose={() => setOpen(false)} />;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={presenterUiCopy[language].settings}
        title={presenterUiCopy[language].settings}
        className="slide-locate-btn glass-toolbar-action"
        onClick={() => setOpen(true)}
      >
        <Settings />
      </Button>
      {portalled ? <DialogPortal>{dialog}</DialogPortal> : dialog}
    </>
  );
}
