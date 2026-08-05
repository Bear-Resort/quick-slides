import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  ChevronRight,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { FileScmKind } from "@/lib/github/scmStatus";
import { isImagePath, type RepoFileEntry } from "@/lib/github/workingTree";
import { cn } from "@/lib/utils";

type RepoFileTreeProps = {
  entries: RepoFileEntry[];
  selectedPath?: string | null;
  onSelect: (path: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onNewFolder?: (parentPath: string) => void;
  onNewFile?: (parentPath: string) => void;
  scmByPath?: Record<string, FileScmKind>;
  onInclude?: (path: string) => void | Promise<void>;
  onRevert?: (path: string) => void | Promise<void>;
};

type ContextMenuState = {
  path: string;
  isDir: boolean;
  x: number;
  y: number;
  scm?: FileScmKind;
};

const rowBase =
  "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs appearance-none bg-transparent hover:bg-white/8";

function ScmBadge({ kind }: { kind: FileScmKind }) {
  const label = kind === "new" ? "New" : "Modified";
  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "ml-auto inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold leading-none",
        kind === "new"
          ? "bg-emerald-500 text-white"
          : "bg-amber-400 text-amber-950",
      )}
    >
      {kind === "new" ? "N" : "M"}
    </span>
  );
}

function Node({
  entry,
  selectedPath,
  onSelect,
  onContextMenu,
  scmByPath,
  depth = 0,
}: {
  entry: RepoFileEntry;
  selectedPath?: string | null;
  onSelect: (path: string) => void;
  onContextMenu: (event: MouseEvent, entry: RepoFileEntry) => void;
  scmByPath?: Record<string, FileScmKind>;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 2);
  const isSelected = selectedPath === entry.path;
  const scm = !entry.isDir ? scmByPath?.[entry.path] : undefined;

  if (entry.isDir) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          onContextMenu={(event) => onContextMenu(event, entry)}
          className={cn(rowBase, isSelected && "bg-white/10")}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <ChevronRight
            className={cn(
              "size-3 shrink-0 opacity-70 transition-transform",
              open && "rotate-90",
            )}
          />
          {open ? (
            <FolderOpen className="size-3.5 shrink-0 text-primary" />
          ) : (
            <Folder className="size-3.5 shrink-0 text-primary" />
          )}
          <span className="truncate">{entry.name}</span>
        </button>
        {open && entry.children && entry.children.length > 0 ? (
          <div>
            {entry.children.map((child) => (
              <Node
                key={child.path}
                entry={child}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onContextMenu={onContextMenu}
                scmByPath={scmByPath}
                depth={depth + 1}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const Icon = isImagePath(entry.path)
    ? FileImage
    : entry.name.endsWith(".md") || entry.name.endsWith(".json")
      ? FileText
      : File;

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.path)}
      onContextMenu={(event) => onContextMenu(event, entry)}
      className={cn(rowBase, "gap-2", isSelected && "bg-white/10")}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <Icon className="size-3.5 shrink-0 opacity-70" />
      <span className="min-w-0 flex-1 truncate">{entry.name}</span>
      {scm ? <ScmBadge kind={scm} /> : null}
    </button>
  );
}

export function RepoFileTree({
  entries,
  selectedPath,
  onSelect,
  onRename,
  onDelete,
  onNewFolder,
  onNewFile,
  scmByPath,
  onInclude,
  onRevert,
}: RepoFileTreeProps) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menu]);

  if (entries.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-muted-foreground">
        No files yet.
      </p>
    );
  }

  return (
    <div className="relative py-1">
      {entries.map((entry) => (
        <Node
          key={entry.path}
          entry={entry}
          selectedPath={selectedPath}
          onSelect={onSelect}
          scmByPath={scmByPath}
          onContextMenu={(event, target) => {
            event.preventDefault();
            event.stopPropagation();
            setMenu({
              path: target.path,
              isDir: target.isDir,
              x: event.clientX,
              y: event.clientY,
              scm: !target.isDir ? scmByPath?.[target.path] : undefined,
            });
          }}
        />
      ))}

      {menu ? (
        <div
          ref={menuRef}
          className="fixed z-[320] min-w-[10rem] rounded-md border border-white/15 bg-background/95 p-1 shadow-lg backdrop-blur-sm"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          {menu.isDir && onNewFile ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/10"
              onClick={() => {
                setMenu(null);
                onNewFile(menu.path);
              }}
            >
              <Plus className="size-3.5" />
              New file…
            </button>
          ) : null}
          {menu.isDir && onNewFolder ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/10"
              onClick={() => {
                setMenu(null);
                onNewFolder(menu.path);
              }}
            >
              <FolderPlus className="size-3.5" />
              New folder…
            </button>
          ) : null}
          {onRename ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/10"
              onClick={() => {
                setMenu(null);
                onRename(menu.path);
              }}
            >
              <Pencil className="size-3.5" />
              Rename…
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-red-600 hover:bg-white/10 dark:text-red-400"
              onClick={() => {
                setMenu(null);
                onDelete(menu.path);
              }}
            >
              <Trash2 className="size-3.5" />
              Delete…
            </button>
          ) : null}
          {!menu.isDir && menu.scm && onInclude ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/10"
              onClick={() => {
                setMenu(null);
                void onInclude(menu.path);
              }}
            >
              <Plus className="size-3.5" />
              Include file
            </button>
          ) : null}
          {!menu.isDir && menu.scm && onRevert ? (
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/10"
              onClick={() => {
                setMenu(null);
                void onRevert(menu.path);
              }}
            >
              <RotateCcw className="size-3.5" />
              Revert file
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
