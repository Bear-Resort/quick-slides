import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

const tooltipClassName = cn(
  "pointer-events-none absolute right-full top-1/2 z-50 mr-1.5 -translate-y-1/2",
  "whitespace-nowrap rounded-md border border-white/15 bg-background/95 px-2 py-0.5",
  "text-[10px] font-medium text-foreground opacity-0 shadow-md backdrop-blur-sm",
  "transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
);

type LocateIconButtonProps = {
  label: string;
  ariaLabel: string;
  onClick: () => void;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  icon: ReactNode;
  /** Hover label next to the icon. Defaults to true. */
  showTooltip?: boolean;
};

export function LocateIconButton({
  label,
  ariaLabel,
  onClick,
  onMouseDown,
  className,
  icon,
  showTooltip = true,
}: LocateIconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "group relative inline-flex cursor-pointer items-center justify-center rounded border shadow-sm",
        className,
      )}
      aria-label={ariaLabel}
      title={showTooltip ? label : undefined}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      <span className="pointer-events-none inline-flex shrink-0 items-center justify-center">
        {icon}
      </span>
      {showTooltip ? (
        <span role="tooltip" className={tooltipClassName}>
          {label}
        </span>
      ) : null}
    </button>
  );
}
