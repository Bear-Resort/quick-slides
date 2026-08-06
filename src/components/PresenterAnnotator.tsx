import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { SlideColorMode } from "@/lib/slideThemes";
import { cn } from "@/lib/utils";

export type PresenterAnnotateTool =
  | "none"
  | "pointer"
  | "pen-blue"
  | "pen-red"
  | "pen-black"
  | "eraser";

type Point = { x: number; y: number };

type Stroke = {
  kind: "pen" | "eraser";
  color: string;
  width: number;
  points: Point[];
};

type PenId = "pen-blue" | "pen-red" | "pen-black";

const PEN_COLORS_LIGHT: Record<PenId, string> = {
  "pen-blue": "#2563eb",
  "pen-red": "#dc2626",
  "pen-black": "#171717",
};

/** On dark slides: light blue / light red / white so ink stays visible. */
const PEN_COLORS_DARK: Record<PenId, string> = {
  "pen-blue": "#93c5fd",
  "pen-red": "#fca5a5",
  "pen-black": "#ffffff",
};

export function getPresenterPenColor(
  tool: PenId,
  colorMode: SlideColorMode,
): string {
  return colorMode === "dark" ? PEN_COLORS_DARK[tool] : PEN_COLORS_LIGHT[tool];
}

export function getPresenterPenSwatch(
  tool: PenId,
  colorMode: SlideColorMode,
): string {
  return getPresenterPenColor(tool, colorMode);
}

const PEN_WIDTH = 3.5;
const PEN_CURSOR_SIZE = 14;
const ERASER_WIDTH = 28;

function isPenTool(
  tool: PresenterAnnotateTool,
): tool is "pen-blue" | "pen-red" | "pen-black" {
  return tool === "pen-blue" || tool === "pen-red" || tool === "pen-black";
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
): void {
  if (stroke.points.length === 0) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.width;

  if (stroke.kind === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }

  ctx.beginPath();
  const first = stroke.points[0]!;
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < stroke.points.length; i++) {
    const point = stroke.points[i]!;
    ctx.lineTo(point.x, point.y);
  }
  if (stroke.points.length === 1) {
    ctx.lineTo(first.x + 0.01, first.y);
  }
  ctx.stroke();
  ctx.restore();
}

function redrawAll(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }
}

type PresenterAnnotatorProps = {
  slideIndex: number;
  tool: PresenterAnnotateTool;
  colorMode?: SlideColorMode;
  /** Increment to clear ink on the current slide. */
  clearNonce?: number;
  className?: string;
};

/** Ephemeral ink / laser overlay for present mode only (never persisted). */
export function PresenterAnnotator({
  slideIndex,
  tool,
  colorMode = "light",
  clearNonce = 0,
  className,
}: PresenterAnnotatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesBySlideRef = useRef<Map<number, Stroke[]>>(new Map());
  const drawingRef = useRef<Stroke | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const inactive = tool === "none";
  const isLaser = tool === "pointer";
  const isEraser = tool === "eraser";
  const isPen = isPenTool(tool);
  const hideSystemCursor = isLaser || isEraser || isPen;
  const penColor = isPen ? getPresenterPenColor(tool, colorMode) : null;

  const syncCanvasSize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    if (
      canvas.width !== Math.round(width * dpr) ||
      canvas.height !== Math.round(height * dpr)
    ) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redrawAll(ctx, strokesBySlideRef.current.get(slideIndex) ?? [], width, height);
  }, [slideIndex]);

  useEffect(() => {
    syncCanvasSize();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => syncCanvasSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [syncCanvasSize]);

  useEffect(() => {
    drawingRef.current = null;
    setCursor(null);
    syncCanvasSize();
  }, [slideIndex, syncCanvasSize]);

  useEffect(() => {
    if (clearNonce <= 0) return;
    strokesBySlideRef.current.set(slideIndex, []);
    drawingRef.current = null;
    syncCanvasSize();
  }, [clearNonce, slideIndex, syncCanvasSize]);

  useEffect(() => {
    if (inactive) {
      drawingRef.current = null;
      setCursor(null);
    }
  }, [inactive, tool]);

  const pointFromEvent = (event: ReactPointerEvent<HTMLDivElement>): Point => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const paintCurrent = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = container.getBoundingClientRect();
    const strokes = [...(strokesBySlideRef.current.get(slideIndex) ?? [])];
    if (drawingRef.current) strokes.push(drawingRef.current);
    redrawAll(ctx, strokes, rect.width, rect.height);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (inactive || tool === "pointer") return;
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (isEraser || isPen) setCursor(point);

    if (tool === "eraser") {
      drawingRef.current = {
        kind: "eraser",
        color: "transparent",
        width: ERASER_WIDTH,
        points: [point],
      };
    } else {
      drawingRef.current = {
        kind: "pen",
        color: getPresenterPenColor(tool, colorMode),
        width: PEN_WIDTH,
        points: [point],
      };
    }
    paintCurrent();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (inactive) return;
    const point = pointFromEvent(event);

    if (isLaser || isEraser || isPen) {
      setCursor(point);
    }

    if (tool === "pointer") return;

    if (!drawingRef.current) return;
    const points = drawingRef.current.points;
    const last = points[points.length - 1];
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < 1.25) return;
    points.push(point);
    paintCurrent();
  };

  const finishStroke = () => {
    if (!drawingRef.current) return;
    const list = strokesBySlideRef.current.get(slideIndex) ?? [];
    list.push(drawingRef.current);
    strokesBySlideRef.current.set(slideIndex, list);
    drawingRef.current = null;
    paintCurrent();
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishStroke();
  };

  const onPointerLeave = () => {
    if (isLaser || isEraser || isPen) setCursor(null);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "absolute inset-0 z-10 touch-none",
        inactive && "pointer-events-none",
        !inactive && (hideSystemCursor ? "cursor-none" : "cursor-crosshair"),
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {isLaser && cursor ? (
        <div
          className="presenter-laser pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: cursor.x, top: cursor.y }}
        />
      ) : null}
      {isEraser && cursor ? (
        <div
          className={cn(
            "presenter-eraser-cursor pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
            colorMode === "light" && "presenter-glass-light",
          )}
          style={{
            left: cursor.x,
            top: cursor.y,
            width: ERASER_WIDTH,
            height: ERASER_WIDTH,
          }}
        />
      ) : null}
      {isPen && cursor && penColor ? (
        <div
          className={cn(
            "presenter-pen-cursor pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
            colorMode === "light" && "presenter-glass-light",
          )}
          style={
            {
              left: cursor.x,
              top: cursor.y,
              width: PEN_CURSOR_SIZE,
              height: PEN_CURSOR_SIZE,
              "--pen-ink": penColor,
            } as CSSProperties
          }
        />
      ) : null}
    </div>
  );
}
