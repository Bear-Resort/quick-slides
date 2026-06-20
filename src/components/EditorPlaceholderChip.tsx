import type { ReactNode } from "react";
import type { CharRangePosition } from "@/lib/editorInsert";
import type { EditorPlaceholderKind } from "@/lib/editorPlaceholders";
import { cn } from "@/lib/utils";

type EditorPlaceholderChipProps = {
  variant: EditorPlaceholderKind;
  label: string;
  ariaLabel: string;
  position: CharRangePosition;
  icon?: ReactNode;
  onClick: () => void;
};

export function EditorPlaceholderChip({
  variant,
  label,
  ariaLabel,
  position,
  icon,
  onClick,
}: EditorPlaceholderChipProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        "editor-placeholder-chip pointer-events-auto absolute",
        `editor-placeholder-chip-${variant}`,
        icon && "editor-placeholder-chip-has-icon",
      )}
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        height: position.height,
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {icon}
      <span className="editor-placeholder-chip-label">{label}</span>
    </button>
  );
}
