import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogPortal } from "@/components/ui/dialog-portal";
import {
  APP_VERSION,
  claimAppVersionAnnounce,
  markAppVersionSeen,
} from "@/lib/appVersion";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const BEAR_RESORT_URL = "https://bear-resort.github.io/";
const BEAR_SRC = "https://bear-resort.github.io/logos/default-bear.gif";
const BEAR_FLIGHT_MS = 480;
const BEAR_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

const copy = {
  en: {
    label: "Bear Resort",
    title: "A Bear Resort production",
    body: "Quick Slides is a Bear Resort app aiming to create quick, systematic slides using markdown and an agent system.",
    versionLabel: `Version ${APP_VERSION}`,
    whatsNew: "What's new",
    notes: [
      "Unified liquid glass UI across the editor chrome and panels",
      "Git project mode: link repos, SCM status, pull/push, and quick push",
    ],
    visit: "Visit Bear Resort",
    close: "Close",
  },
  zh: {
    label: "小熊樂園",
    title: "小熊樂園出品",
    body: "Quick Slides 是小熊樂園出品的应用，旨在用 Markdown 与智能体系统快速、系统地制作幻灯片。",
    versionLabel: `版本 ${APP_VERSION}`,
    whatsNew: "更新内容",
    notes: [
      "统一的液态玻璃界面（编辑器顶栏与面板）",
      "Git 项目模式：关联仓库、SCM 状态、拉取/推送与一键推送",
    ],
    visit: "访问小熊樂園",
    close: "关闭",
  },
} as const;

type Rect = { top: number; left: number; width: number; height: number };

function readRect(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Flight = {
  start: Rect;
  end: Rect;
  direction: "open" | "close";
};

function FlyingBear({
  flight,
  onDone,
}: {
  flight: Flight;
  onDone: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useLayoutEffect(() => {
    const node = imgRef.current;
    if (!node) return;
    doneRef.current = false;

    const dx = flight.end.left - flight.start.left;
    const dy = flight.end.top - flight.start.top;
    const sx = flight.end.width / flight.start.width;
    const sy = flight.end.height / flight.start.height;

    node.style.top = `${flight.start.top}px`;
    node.style.left = `${flight.start.left}px`;
    node.style.width = `${flight.start.width}px`;
    node.style.height = `${flight.start.height}px`;
    node.style.transformOrigin = "top left";
    node.style.transition = "none";
    node.style.transform = "translate3d(0,0,0) scale(1)";
    void node.getBoundingClientRect();

    const raf = requestAnimationFrame(() => {
      node.style.transition = `transform ${BEAR_FLIGHT_MS}ms ${BEAR_EASE}`;
      node.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
    });

    const fallback = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    }, BEAR_FLIGHT_MS + 50);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [flight]);

  return (
    <img
      ref={imgRef}
      src={BEAR_SRC}
      alt=""
      aria-hidden
      className="pointer-events-none fixed z-[60] object-contain will-change-transform"
      style={{
        top: flight.start.top,
        left: flight.start.left,
        width: flight.start.width,
        height: flight.start.height,
        transformOrigin: "top left",
      }}
      onTransitionEnd={(event) => {
        if (event.propertyName !== "transform") return;
        if (doneRef.current) return;
        doneRef.current = true;
        onDoneRef.current();
      }}
    />
  );
}

type BearResortDialogProps = {
  mounted: boolean;
  closing: boolean;
  panelShown: boolean;
  bearVisible: boolean;
  onClose: () => void;
  dialogImgRef: React.RefObject<HTMLImageElement | null>;
};

function BearResortDialog({
  mounted,
  closing,
  panelShown,
  bearVisible,
  onClose,
  dialogImgRef,
}: BearResortDialogProps) {
  const language = useLanguage();
  const t = copy[language];

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closing) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, closing, onClose]);

  if (!mounted) return null;

  return (
    <DialogPortal>
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px] transition-opacity duration-[480ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
          panelShown ? "opacity-100" : "opacity-0",
        )}
        onClick={() => {
          if (!closing) onClose();
        }}
      >
        {/*
          Opacity-only reveal — no translate/scale — so the dialog bear’s
          measured target matches its final on-screen position.
        */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bear-resort-dialog-title"
          className={cn(
            "glass-panel glass-panel-dialog w-full max-w-sm rounded-xl border p-6 shadow-lg transition-opacity duration-[480ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
            panelShown ? "opacity-100" : "opacity-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <img
              ref={dialogImgRef}
              src={BEAR_SRC}
              alt=""
              className={cn(
                "h-12 w-12 shrink-0 object-contain",
                !bearVisible && "opacity-0",
              )}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t.close}
              title={t.close}
              className="glass-close shrink-0"
              disabled={closing}
            >
              <X />
            </Button>
          </div>

          <h2 id="bear-resort-dialog-title" className="mt-4 text-lg font-bold">
            {t.title}
          </h2>
          <p className="mt-1 text-xs font-semibold tabular-nums text-foreground/70">
            {t.versionLabel}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t.body}
          </p>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
              {t.whatsNew}
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm leading-snug text-muted-foreground">
              {t.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={closing}>
              {t.close}
            </Button>
            <Button asChild>
              <a href={BEAR_RESORT_URL} target="_blank" rel="noopener noreferrer">
                {t.visit}
              </a>
            </Button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}

export function Return({ iconOnly = false }: { iconOnly?: boolean } = {}) {
  const language = useLanguage();
  const t = copy[language];
  const triggerImgRef = useRef<HTMLImageElement>(null);
  const dialogImgRef = useRef<HTMLImageElement>(null);
  const openStartedRef = useRef(false);

  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [panelShown, setPanelShown] = useState(false);
  const [bearVisible, setBearVisible] = useState(false);
  const [triggerHidden, setTriggerHidden] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);

  const finishOpen = useCallback(() => {
    setFlight(null);
    setBearVisible(true);
    setPanelShown(true);
    openStartedRef.current = false;
  }, []);

  const finishClose = useCallback(() => {
    setFlight(null);
    setMounted(false);
    setClosing(false);
    setPanelShown(false);
    setBearVisible(false);
    setTriggerHidden(false);
    openStartedRef.current = false;
  }, []);

  const beginOpen = useCallback(() => {
    if (mounted || closing || openStartedRef.current) return;
    openStartedRef.current = true;
    setTriggerHidden(true);
    setBearVisible(false);
    setPanelShown(false);
    setMounted(true);
  }, [mounted, closing]);

  // Measure after dialog is in its final layout (no slide/scale), then fly.
  useLayoutEffect(() => {
    if (!mounted || closing || flight || bearVisible) return;

    if (prefersReducedMotion()) {
      finishOpen();
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const tryStart = () => {
      if (cancelled) return;
      attempts += 1;

      const start = readRect(triggerImgRef.current);
      const end = readRect(dialogImgRef.current);
      if (!start || !end) {
        if (attempts < 8) {
          requestAnimationFrame(tryStart);
          return;
        }
        finishOpen();
        return;
      }

      // Start bear flight and dialog fade in the same commit so they run together.
      // (Do not defer setPanelShown — the effect cleanup when `flight` updates
      // would cancel a trailing rAF and leave the panel hidden until flight ends.)
      setFlight({ start, end, direction: "open" });
      setPanelShown(true);
    };

    // Wait two frames so header + portal layout settle (esp. auto-open on load).
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(tryStart);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, [mounted, closing, flight, bearVisible, finishOpen]);

  const handleClose = useCallback(() => {
    if (!mounted || closing) return;
    markAppVersionSeen();
    setClosing(true);

    if (prefersReducedMotion()) {
      finishClose();
      return;
    }

    const start = readRect(dialogImgRef.current);
    const end = readRect(triggerImgRef.current);
    if (!start || !end) {
      finishClose();
      return;
    }

    setBearVisible(false);
    setPanelShown(false);
    setTriggerHidden(true);
    setFlight({ start, end, direction: "close" });
  }, [mounted, closing, finishClose]);

  const handleFlightDone = useCallback(() => {
    if (!flight) return;
    if (flight.direction === "open") {
      finishOpen();
    } else {
      finishClose();
    }
  }, [flight, finishOpen, finishClose]);

  useEffect(() => {
    if (!claimAppVersionAnnounce()) return;
    // Let the toolbar finish laying out before measuring the trigger bear.
    const timer = window.setTimeout(() => beginOpen(), 120);
    return () => window.clearTimeout(timer);
  }, [beginOpen]);

  return (
    <>
      <Button
        variant="outline"
        size={iconOnly ? "icon" : "default"}
        onClick={() => beginOpen()}
        aria-label={t.label}
        title={t.label}
        className={
          iconOnly
            ? "slide-locate-btn glass-toolbar-action"
            : "slide-locate-btn glass-toolbar-action gap-2"
        }
      >
        <img
          ref={triggerImgRef}
          src={BEAR_SRC}
          alt=""
          className={cn(
            iconOnly ? "h-5 w-5 object-contain" : "h-6 w-6 object-contain",
            triggerHidden && "opacity-0",
          )}
        />
        {iconOnly ? null : t.label}
      </Button>

      <BearResortDialog
        mounted={mounted}
        closing={closing}
        panelShown={panelShown}
        bearVisible={bearVisible}
        onClose={handleClose}
        dialogImgRef={dialogImgRef}
      />

      {flight ? (
        <DialogPortal>
          <FlyingBear flight={flight} onDone={handleFlightDone} />
        </DialogPortal>
      ) : null}
    </>
  );
}
