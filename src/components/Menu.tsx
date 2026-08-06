import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Leaf, Monitor, Moon, Settings, Sun, X } from "lucide-react";
import {
  setPanelIconTrigger,
  useTitleIconFlight,
} from "@/components/FlyingTitleIcon";
import { Button } from "@/components/ui/button";
import { DialogPortal } from "@/components/ui/dialog-portal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTOSAVE_OPTIONS,
  EDITOR_FONT_FAMILY_OPTIONS,
  EDITOR_FONT_SIZE_OPTIONS,
  getAutosaveDelayMs,
  getEditorFontFamily,
  getEditorFontSize,
  setAutosaveDelayMs,
  setEditorFontFamily,
  setEditorFontSize,
  subscribeEditorSettings,
  type AutosaveDelayMs,
  type EditorFontFamily,
  type EditorFontSize,
} from "@/lib/editorSettings";
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
  /** Show local autosave controls (browser / disk library modes). */
  showLocalAutosave?: boolean;
};

type SettingsTab = "general" | "appearance" | "language";

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

function SettingsDialog({
  open,
  onClose,
  showLocalAutosave,
}: {
  open: boolean;
  onClose: () => void;
  showLocalAutosave: boolean;
}) {
  const language = useLanguage();
  const t = presenterUiCopy[language];
  const [tab, setTab] = useState<SettingsTab>(
    showLocalAutosave ? "general" : "appearance",
  );
  const [preference, setPreference] = useState<ThemePreference>(() =>
    getThemePreference(),
  );
  const [energySave, setEnergySave] = useState(() => getEnergySaveMode());
  const [autosaveDelay, setAutosaveDelay] = useState<AutosaveDelayMs>(() =>
    getAutosaveDelayMs(),
  );
  const [fontSize, setFontSize] = useState<EditorFontSize>(() =>
    getEditorFontSize(),
  );
  const [fontFamily, setFontFamily] = useState<EditorFontFamily>(() =>
    getEditorFontFamily(),
  );
  const { panelShown, titleIcon, flightOverlay } = useTitleIconFlight({
    open,
    Icon: Settings,
  });

  useEffect(() => {
    if (!open) return;
    setPreference(getThemePreference());
    setEnergySave(getEnergySaveMode());
    setAutosaveDelay(getAutosaveDelayMs());
    setFontSize(getEditorFontSize());
    setFontFamily(getEditorFontFamily());
  }, [open]);

  useEffect(() => {
    if (!showLocalAutosave && tab === "general") {
      setTab("appearance");
    }
  }, [showLocalAutosave, tab]);

  useEffect(() => {
    return subscribeTheme(() => {
      setPreference(getThemePreference());
      setEnergySave(getEnergySaveMode());
    });
  }, []);

  useEffect(() => {
    return subscribeEditorSettings(() => {
      setAutosaveDelay(getAutosaveDelayMs());
      setFontSize(getEditorFontSize());
      setFontFamily(getEditorFontFamily());
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
    ...(showLocalAutosave
      ? [
          {
            id: "general" as const,
            label: language === "zh" ? "通用" : "General",
          },
        ]
      : []),
    { id: "appearance", label: language === "zh" ? "外观" : "Appearance" },
    { id: "language", label: language === "zh" ? "语言" : "Language" },
  ];

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px] transition-opacity duration-[480ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          panelShown ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-slides-settings-title"
          className={cn(
            "glass-panel glass-panel-dialog flex h-[min(520px,90vh)] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border shadow-lg transition-opacity duration-[480ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            panelShown ? "opacity-100" : "opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="glass-divider relative z-[1] flex shrink-0 items-center justify-between border-b px-5 py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {titleIcon}
              <h2
                id="quick-slides-settings-title"
                className="text-base font-semibold"
              >
                {t.settings}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="glass-close size-7 shrink-0"
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
            style={{
              gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
            }}
          >
            <div
              aria-hidden
              className="glass-seg-active pointer-events-none absolute top-[var(--glass-seg-pad)] bottom-[var(--glass-seg-pad)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                left: `calc(${(Math.max(0, tabs.findIndex((item) => item.id === tab)) / tabs.length) * 100}% + var(--glass-seg-pad))`,
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
            {tab === "general" && showLocalAutosave ? (
              <div className="space-y-5">
                <SettingRow
                  label={language === "zh" ? "自动保存间隔" : "Autosave interval"}
                  description={
                    language === "zh"
                      ? "仅用于本地存储与本地仓库模式。选择「从不」则仅在切换文件或离开页面时保存。"
                      : "For localStorage and local repository modes only. Choose Never to save only when switching files or leaving the page."
                  }
                >
                  <Select
                    value={String(autosaveDelay)}
                    onValueChange={(next) => {
                      const delay = Number(next) as AutosaveDelayMs;
                      setAutosaveDelay(delay);
                      setAutosaveDelayMs(delay);
                    }}
                  >
                    <SelectTrigger
                      aria-label={
                        language === "zh" ? "自动保存间隔" : "Autosave interval"
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTOSAVE_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label[language]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </div>
            ) : null}

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

                <SettingRow
                  label={language === "zh" ? "编辑器字号" : "Editor size"}
                  description={
                    language === "zh"
                      ? "Markdown 编辑区文字大小"
                      : "Text size in the markdown editor"
                  }
                >
                  <Select
                    value={fontSize}
                    onValueChange={(next) => {
                      const size = next as EditorFontSize;
                      setFontSize(size);
                      setEditorFontSize(size);
                    }}
                  >
                    <SelectTrigger
                      aria-label={language === "zh" ? "编辑器字号" : "Editor size"}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITOR_FONT_SIZE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label[language]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  label={language === "zh" ? "编辑器字体" : "Editor font"}
                  description={
                    language === "zh"
                      ? "Markdown 编辑区字体"
                      : "Typeface used in the markdown editor"
                  }
                >
                  <Select
                    value={fontFamily}
                    onValueChange={(next) => {
                      const family = next as EditorFontFamily;
                      setFontFamily(family);
                      setEditorFontFamily(family);
                    }}
                  >
                    <SelectTrigger
                      aria-label={language === "zh" ? "编辑器字体" : "Editor font"}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EDITOR_FONT_FAMILY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label[language]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </div>
            ) : null}

            {tab === "language" ? (
              <SettingRow
                label={language === "zh" ? "语言" : "Language"}
                description={
                  language === "zh"
                    ? "界面与示例文案的显示语言"
                    : "Language for UI and sample content"
                }
              >
                <Select
                  value={language}
                  onValueChange={(next) => setLanguage(next as Language)}
                >
                  <SelectTrigger
                    aria-label={language === "zh" ? "语言" : "Language"}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">
                      {presenterUiCopy.en.languageEn}
                    </SelectItem>
                    <SelectItem value="zh">
                      {presenterUiCopy.zh.languageZh}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            ) : null}
          </div>
        </div>
      </div>
      </div>
      {flightOverlay}
    </>
  );
}

export function Menu({
  portalled = true,
  showLocalAutosave = false,
}: MenuProps) {
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const iconRef = useRef<SVGSVGElement>(null);

  const dialog = (
    <SettingsDialog
      open={open}
      onClose={() => setOpen(false)}
      showLocalAutosave={showLocalAutosave}
    />
  );

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={presenterUiCopy[language].settings}
        title={presenterUiCopy[language].settings}
        className="slide-locate-btn glass-toolbar-action"
        onClick={() => {
          setPanelIconTrigger(iconRef.current);
          setOpen(true);
        }}
      >
        <Settings ref={iconRef} className="size-4" aria-hidden />
      </Button>
      {portalled ? <DialogPortal>{dialog}</DialogPortal> : dialog}
    </>
  );
}
