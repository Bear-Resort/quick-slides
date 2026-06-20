import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

const tooltipClassName =
  "pointer-events-none absolute right-full top-1/2 z-50 mr-1.5 -translate-y-1/2 whitespace-nowrap rounded-md border border-gray-300 bg-popover px-2 py-0.5 text-[10px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:border-gray-700";

type LocateIconButtonProps = {
  label: string;
  ariaLabel: string;
  onClick: () => void;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  icon: ReactNode;
};

export function LocateIconButton({
  label,
  ariaLabel,
  onClick,
  onMouseDown,
  className,
  icon,
}: LocateIconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "group relative inline-flex items-center justify-center rounded border shadow-sm",
        className,
      )}
      aria-label={ariaLabel}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {icon}
      <span role="tooltip" className={tooltipClassName}>
        {label}
      </span>
    </button>
  );
}
