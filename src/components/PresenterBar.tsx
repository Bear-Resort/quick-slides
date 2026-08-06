import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eraser,
  MousePointer2,
  PenLine,
  Trash2,
  X,
} from "lucide-react";
import {
  getPresenterPenSwatch,
  type PresenterAnnotateTool,
} from "@/components/PresenterAnnotator";
import type { SlideColorMode } from "@/lib/slideThemes";
import { presenterUiCopy } from "@/lib/presenterUi";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

type PresenterBarProps = {
  index: number;
  total: number;
  tool: PresenterAnnotateTool;
  colorMode?: SlideColorMode;
  onToolChange: (tool: PresenterAnnotateTool) => void;
  onClearPage: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
};

const DRAW_TOOLS: Array<{
  id: Exclude<PresenterAnnotateTool, "none">;
  labelKey: "pointer" | "penBlue" | "penRed" | "penBlack" | "eraser";
}> = [
  { id: "pointer", labelKey: "pointer" },
  { id: "pen-blue", labelKey: "penBlue" },
  { id: "pen-red", labelKey: "penRed" },
  { id: "pen-black", labelKey: "penBlack" },
  { id: "eraser", labelKey: "eraser" },
];

/** Overlay chrome matching the exported HTML presentation viewer. */
export function PresenterBar({
  index,
  total,
  tool,
  colorMode = "light",
  onToolChange,
  onClearPage,
  onPrevious,
  onNext,
  onExit,
}: PresenterBarProps) {
  const language = useLanguage();
  const t = presenterUiCopy[language];
  const [toolboxOpen, setToolboxOpen] = useState(false);

  const closeToolbox = () => {
    setToolboxOpen(false);
    onToolChange("none");
  };

  const openToolbox = () => {
    setToolboxOpen(true);
    if (tool === "none") onToolChange("pointer");
  };

  return (
    <>
      <div
        className="presenter-counter pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 text-[0.95rem] font-semibold tabular-nums tracking-wide text-white/90"
        aria-live="polite"
      >
        {index + 1}/{total}
      </div>

      <button
        type="button"
        onClick={onPrevious}
        disabled={index === 0}
        aria-label={t.previous}
        className="presenter-nav presenter-nav-prev absolute bottom-5 left-4 z-20 inline-flex size-11 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white disabled:cursor-not-allowed disabled:opacity-28 sm:left-5"
      >
        <ChevronLeft className="size-5" />
      </button>

      {toolboxOpen ? (
        <div
          className={cn(
            "presenter-toolbox absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/35 bg-black/55 p-1.5 backdrop-blur-sm",
            colorMode === "light" && "presenter-toolbox-light",
          )}
          role="toolbar"
          aria-label={t.annotateToolbar}
        >
          {DRAW_TOOLS.map((item) => {
            const active = tool === item.id;
            const label =
              item.id === "pen-black" && colorMode === "dark"
                ? t.penWhite
                : t[item.labelKey];
            const swatch =
              item.id === "pen-blue" ||
              item.id === "pen-red" ||
              item.id === "pen-black"
                ? getPresenterPenSwatch(item.id, colorMode)
                : undefined;

            return (
              <button
                key={item.id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={active}
                onClick={() => onToolChange(item.id)}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-full transition-colors",
                  active
                    ? "bg-white/20 text-white ring-2 ring-white/70"
                    : "text-white/85 hover:bg-white/12 hover:text-white",
                )}
              >
                {item.id === "pointer" ? (
                  <span className="presenter-pen-chip">
                    <MousePointer2 className="size-3.5 text-red-500" />
                  </span>
                ) : item.id === "eraser" ? (
                  <Eraser className="size-4" />
                ) : (
                  <span
                    className={cn(
                      "presenter-pen-chip",
                      item.id === "pen-black" &&
                        colorMode === "dark" &&
                        "presenter-pen-chip-white",
                    )}
                  >
                    <PenLine className="size-3.5" style={{ color: swatch }} />
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            title={t.clearPage}
            aria-label={t.clearPage}
            onClick={onClearPage}
            className="inline-flex size-9 items-center justify-center rounded-full text-white/85 hover:bg-white/12 hover:text-white"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            title={t.hideAnnotate}
            aria-label={t.hideAnnotate}
            onClick={closeToolbox}
            className="ml-0.5 inline-flex size-9 items-center justify-center rounded-full text-white/85 hover:bg-white/12 hover:text-white"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          title={t.showAnnotate}
          aria-label={t.showAnnotate}
          onClick={openToolbox}
          className="presenter-nav absolute bottom-5 left-1/2 z-20 inline-flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white"
        >
          <PenLine className="size-4" />
        </button>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={index >= total - 1}
        aria-label={t.next}
        className="presenter-nav presenter-nav-next absolute bottom-5 right-4 z-20 inline-flex size-11 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white disabled:cursor-not-allowed disabled:opacity-28 sm:right-5"
      >
        <ChevronRight className="size-5" />
      </button>

      <button
        type="button"
        onClick={onExit}
        aria-label={t.exit}
        title={t.exit}
        className="presenter-nav absolute right-3 top-3 z-20 inline-flex size-9 items-center justify-center rounded-full border border-white/35 bg-black/45 text-white sm:right-4 sm:top-4"
      >
        <X className="size-4" />
      </button>
    </>
  );
}
