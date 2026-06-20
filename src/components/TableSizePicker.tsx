import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { MAX_TABLE_DIMENSION, TABLE_GRID_DIMENSION } from "@/lib/editorInsert";
import { cn } from "@/lib/utils";

type TableSizePickerCopy = {
  prompt: string;
  sizeLabel: (rows: number, cols: number) => string;
  customSize: string;
  customTitle: string;
  rows: string;
  columns: string;
  insert: string;
  cancel: string;
};

type TableSizePickerProps = {
  onSelect: (rows: number, cols: number) => void;
  copy: TableSizePickerCopy;
};

function parseDimension(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return clampDimension(parsed);
}

function clampDimension(value: number): number {
  return Math.min(Math.max(value, 1), MAX_TABLE_DIMENSION);
}

type TableCustomSizeDialogProps = {
  open: boolean;
  onClose: () => void;
  onInsert: (rows: number, cols: number) => void;
  copy: Pick<TableSizePickerCopy, "customTitle" | "rows" | "columns" | "insert" | "cancel">;
};

function TableCustomSizeDialog({
  open,
  onClose,
  onInsert,
  copy,
}: TableCustomSizeDialogProps) {
  const [rows, setRows] = useState("3");
  const [cols, setCols] = useState("3");

  useEffect(() => {
    if (open) {
      setRows("3");
      setCols("3");
    }
  }, [open]);

  if (!open) return null;

  const handleInsert = () => {
    const rowCount = parseDimension(rows);
    const colCount = parseDimension(cols);
    if (rowCount === null || colCount === null) return;
    onInsert(rowCount, colCount);
    onClose();
  };

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="table-custom-size-title"
          className="w-full max-w-xs rounded-xl border border-gray-300 bg-background shadow-lg dark:border-gray-700"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleInsert();
            }
          }}
        >
          <div className="flex items-center justify-between border-b border-gray-300 px-4 py-3 dark:border-gray-700">
            <h2 id="table-custom-size-title" className="text-sm font-semibold">
              {copy.customTitle}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onClose}
              aria-label={copy.cancel}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="space-y-3 px-4 py-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{copy.rows}</span>
              <input
                type="number"
                min={1}
                max={MAX_TABLE_DIMENSION}
                value={rows}
                onChange={(event) => setRows(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">{copy.columns}</span>
              <input
                type="number"
                min={1}
                max={MAX_TABLE_DIMENSION}
                value={cols}
                onChange={(event) => setCols(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-300 px-4 py-3 dark:border-gray-700">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button type="button" size="sm" onClick={handleInsert}>
              {copy.insert}
            </Button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}

export function TableSizePicker({ onSelect, copy }: TableSizePickerProps) {
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  const [customOpen, setCustomOpen] = useState(false);

  const handleSelect = (rows: number, cols: number) => {
    onSelect(rows, cols);
    setCustomOpen(false);
  };

  return (
    <>
      <div className="p-3" onMouseLeave={() => setHover({ rows: 0, cols: 0 })}>
        <p className="mb-2 min-h-4 text-center text-xs text-muted-foreground">
          {hover.rows > 0 ? copy.sizeLabel(hover.rows, hover.cols) : copy.prompt}
        </p>
        <div
          className="inline-grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${TABLE_GRID_DIMENSION}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: TABLE_GRID_DIMENSION * TABLE_GRID_DIMENSION }, (_, index) => {
            const row = Math.floor(index / TABLE_GRID_DIMENSION) + 1;
            const col = (index % TABLE_GRID_DIMENSION) + 1;
            const active = row <= hover.rows && col <= hover.cols;

            return (
              <button
                key={`${row}-${col}`}
                type="button"
                aria-label={copy.sizeLabel(row, col)}
                className={cn(
                  "size-4 rounded-sm border transition-colors",
                  active
                    ? "border-primary bg-primary/80"
                    : "border-border/80 bg-muted/50 hover:border-primary/50",
                )}
                onMouseEnter={() => setHover({ rows: row, cols: col })}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(row, col)}
              />
            );
          })}
        </div>

        <div className="mt-3 border-t border-border pt-2">
          <button
            type="button"
            className="w-full rounded-md px-2 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setCustomOpen(true)}
          >
            {copy.customSize}
          </button>
        </div>
      </div>

      <TableCustomSizeDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onInsert={handleSelect}
        copy={copy}
      />
    </>
  );
}
