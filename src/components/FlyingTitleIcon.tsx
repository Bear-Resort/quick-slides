import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type SVGProps,
} from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const FLIGHT_MS = 480;
const FLIGHT_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

type Rect = { top: number; left: number; width: number; height: number };

type IconComponent =
  | LucideIcon
  | ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

let panelTriggerEl: Element | null = null;

/** Call from toolbar buttons before opening a WorkspacePanel / dialog. */
export function setPanelIconTrigger(el: Element | null): void {
  panelTriggerEl = el;
}

export function getPanelIconTrigger(): Element | null {
  return panelTriggerEl;
}

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
};

function FlyingGlyph({
  Icon,
  flight,
  onDone,
}: {
  Icon: IconComponent;
  flight: Flight;
  onDone: () => void;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useLayoutEffect(() => {
    const node = nodeRef.current;
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
      node.style.transition = `transform ${FLIGHT_MS}ms ${FLIGHT_EASE}`;
      node.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(${sx}, ${sy})`;
    });

    const fallback = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDoneRef.current();
    }, FLIGHT_MS + 50);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
  }, [flight]);

  return (
    <div
      ref={nodeRef}
      className="pointer-events-none fixed z-[260] flex items-center justify-center text-foreground will-change-transform"
      style={
        {
          top: flight.start.top,
          left: flight.start.left,
          width: flight.start.width,
          height: flight.start.height,
          transformOrigin: "top left",
        } satisfies CSSProperties
      }
      onTransitionEnd={(event) => {
        if (event.propertyName !== "transform") return;
        if (doneRef.current) return;
        doneRef.current = true;
        onDoneRef.current();
      }}
    >
      <Icon className="size-full" aria-hidden />
    </div>
  );
}

type UseTitleIconFlightOptions = {
  open: boolean;
  Icon?: IconComponent;
};

/**
 * Bear-resort-style open: fly toolbar icon into the dialog title slot.
 * Returns refs/classes for the title icon and an optional flying overlay.
 */
export function useTitleIconFlight({ open, Icon }: UseTitleIconFlightOptions) {
  const titleIconRef = useRef<HTMLSpanElement>(null);
  const [panelShown, setPanelShown] = useState(false);
  const [iconVisible, setIconVisible] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const openGenRef = useRef(0);

  const finishOpen = useCallback(() => {
    setFlight(null);
    setIconVisible(true);
    setPanelShown(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPanelShown(false);
      setIconVisible(false);
      setFlight(null);
      return;
    }

    if (!Icon) {
      setPanelShown(true);
      setIconVisible(false);
      return;
    }

    const generation = ++openGenRef.current;
    setPanelShown(false);
    setIconVisible(false);
    setFlight(null);

    if (prefersReducedMotion()) {
      finishOpen();
      return;
    }

    let cancelled = false;
    let attempts = 0;

    const tryStart = () => {
      if (cancelled || generation !== openGenRef.current) return;
      attempts += 1;
      const start = readRect(getPanelIconTrigger());
      const end = readRect(titleIconRef.current);
      if (!start || !end) {
        if (attempts < 8) {
          requestAnimationFrame(tryStart);
          return;
        }
        finishOpen();
        return;
      }
      setFlight({ start, end });
      setPanelShown(true);
    };

    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(tryStart);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
    };
  }, [open, Icon, finishOpen]);

  const titleIcon = Icon ? (
    <span
      ref={titleIconRef}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center",
        !iconVisible && "opacity-0",
      )}
      aria-hidden
    >
      <Icon className="size-5" />
    </span>
  ) : null;

  const flightOverlay =
    flight && Icon && typeof document !== "undefined"
      ? createPortal(
          <FlyingGlyph
            Icon={Icon}
            flight={flight}
            onDone={() => {
              setFlight(null);
              setIconVisible(true);
            }}
          />,
          document.body,
        )
      : null;

  return {
    panelShown: !Icon || panelShown,
    titleIcon,
    flightOverlay,
  };
}
