import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Locate } from "lucide-react";
import { HtmlScrollbar } from "@/components/HtmlScrollbar";
import { EditorImageUploadButtons } from "@/components/EditorImageUploadButtons";
import { EditorInsertMenu } from "@/components/EditorInsertMenu";
import { EditorPlaceholderButtons } from "@/components/EditorPlaceholderButtons";
import { LocateIconButton } from "@/components/LocateIconButton";
import {
  findEditorPlaceholderSlots,
  type EditorPlaceholderSlot,
} from "@/lib/editorPlaceholders";
import {
  applyInsertTemplate,
  findEmptyImageSlots,
  fillImageSlot,
  getCursorLineIndex,
  insertTable,
  measureCharRange,
  type CharRangePosition,
  type InsertTemplateKey,
} from "@/lib/editorInsert";
import type { ScmLineChange } from "@/lib/github/lineDiff";
import { getSlideNavigation } from "@/lib/slideMarkers";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";
import {
  editorFontFamilyClass,
  editorFontSizeClass,
  getEditorFontFamily,
  getEditorFontSize,
  subscribeEditorSettings,
} from "@/lib/editorSettings";

const copy = {
  en: {
    page: (page: number, total: number) => `Page ${page} of ${total}`,
    locate: "Locate",
  },
  zh: {
    page: (page: number, total: number) => `第 ${page} / ${total} 页`,
    locate: "定位",
  },
} as const;
type LinePosition = {
  top: number;
  height: number;
};

export type MarkdownEditorHandle = {
  locateLine: (lineIndex: number) => void;
  focus: () => void;
  undo: () => void;
  redo: () => void;
};

export type EditorHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
};

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onLocateSlide: (slideIndex: number) => void;
  onHistoryChange?: (state: EditorHistoryState) => void;
  placeholder?: string;
  className?: string;
  showLineNumbers?: boolean;
  scmLineChanges?: ScmLineChange[];
  readOnly?: boolean;
};

const MAX_UNDO_STACK = 100;

function getLineCharIndex(lines: string[], lineIndex: number): number {
  let charIndex = 0;
  for (let i = 0; i < lineIndex; i++) {
    charIndex += (lines[i]?.length ?? 0) + 1;
  }
  return charIndex;
}

function measureLinePositions(
  mirror: HTMLDivElement,
  lines: string[],
  lineIndices: number[],
): Map<number, LinePosition> {
  const textNode = mirror.firstChild;
  const positions = new Map<number, LinePosition>();
  const mirrorTop = mirror.getBoundingClientRect().top;
  const fallbackLineHeight = parseFloat(getComputedStyle(mirror).lineHeight) || 20;
  const fallbackPaddingTop = parseFloat(getComputedStyle(mirror).paddingTop) || 0;

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    for (const lineIndex of lineIndices) {
      if (lineIndex === 0) {
        positions.set(0, {
          top: fallbackPaddingTop,
          height: fallbackLineHeight,
        });
      }
    }
    return positions;
  }

  for (const lineIndex of lineIndices) {
    const start = Math.min(getLineCharIndex(lines, lineIndex), textNode.textContent?.length ?? 0);
    const lineText = lines[lineIndex] ?? "";
    const end = Math.min(start + Math.max(lineText.length, 1), textNode.textContent?.length ?? 0);

    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);

    const rect = range.getBoundingClientRect();
    positions.set(lineIndex, {
      top: rect.top - mirrorTop,
      height: rect.height || parseFloat(getComputedStyle(mirror).lineHeight) || 20,
    });
  }

  return positions;
}

function syncMirrorLayout(textarea: HTMLTextAreaElement, mirror: HTMLDivElement) {
  const style = getComputedStyle(textarea);
  mirror.style.width = `${textarea.clientWidth}px`;
  mirror.style.font = style.font;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.wordSpacing = style.wordSpacing;
  mirror.style.padding = style.padding;
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.border = style.border;
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "anywhere";
  mirror.style.wordBreak = style.wordBreak;
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      value,
      onChange,
      onLocateSlide,
      onHistoryChange,
      placeholder,
      className,
      showLineNumbers = false,
      scmLineChanges = [],
      readOnly = false,
    },
    ref,
  ) {
    const language = useLanguage();
    const t = copy[language];
    const [fontSize, setFontSize] = useState(() => getEditorFontSize());
    const [fontFamily, setFontFamily] = useState(() => getEditorFontFamily());
    const editorTextClass = useMemo(
      () =>
        cn(
          "leading-relaxed",
          editorFontSizeClass(fontSize),
          editorFontFamilyClass(fontFamily),
        ),
      [fontSize, fontFamily],
    );

    useEffect(() => {
      return subscribeEditorSettings(() => {
        setFontSize(getEditorFontSize());
        setFontFamily(getEditorFontFamily());
      });
    }, []);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const editorStateRef = useRef({ selectionStart: 0, selectionEnd: 0, scrollTop: 0 });
    const historyRef = useRef({
      past: [] as string[],
      future: [] as string[],
      lastValue: value,
      applying: false,
    });
    const onHistoryChangeRef = useRef(onHistoryChange);
    onHistoryChangeRef.current = onHistoryChange;

    const publishHistoryState = useCallback(() => {
      onHistoryChangeRef.current?.({
        canUndo: historyRef.current.past.length > 0,
        canRedo: historyRef.current.future.length > 0,
      });
    }, []);

    const commitValue = useCallback(
      (next: string, options?: { recordHistory?: boolean }) => {
        const recordHistory = options?.recordHistory !== false;
        const history = historyRef.current;
        if (next === history.lastValue) return;

        if (recordHistory && !history.applying) {
          history.past.push(history.lastValue);
          if (history.past.length > MAX_UNDO_STACK) {
            history.past.shift();
          }
          history.future = [];
        }

        history.lastValue = next;
        publishHistoryState();
        onChange(next);
      },
      [onChange, publishHistoryState],
    );

    const undoEdit = useCallback(() => {
      const history = historyRef.current;
      if (history.past.length === 0) return;
      const previous = history.past.pop()!;
      history.future.push(history.lastValue);
      history.applying = true;
      history.lastValue = previous;
      publishHistoryState();
      onChange(previous);
    }, [onChange, publishHistoryState]);

    const redoEdit = useCallback(() => {
      const history = historyRef.current;
      if (history.future.length === 0) return;
      const next = history.future.pop()!;
      history.past.push(history.lastValue);
      history.applying = true;
      history.lastValue = next;
      publishHistoryState();
      onChange(next);
    }, [onChange, publishHistoryState]);

    // Reset or acknowledge external value updates (file switch / undo apply).
    useEffect(() => {
      const history = historyRef.current;
      if (value === history.lastValue) return;
      if (history.applying) {
        history.applying = false;
        history.lastValue = value;
        return;
      }
      history.past = [];
      history.future = [];
      history.lastValue = value;
      history.applying = false;
      publishHistoryState();
    }, [value, publishHistoryState]);

    const pendingInsertRef = useRef<{
      selectionStart: number;
      selectionEnd: number;
      scrollTop: number;
    } | null>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [isFocused, setIsFocused] = useState(false);
    const [cursorLine, setCursorLine] = useState(0);
    const [insertMenuOpen, setInsertMenuOpen] = useState(false);
    const [linePositions, setLinePositions] = useState<Map<number, LinePosition>>(
      () => new Map(),
    );
    const [imageSlotPositions, setImageSlotPositions] = useState<
      Map<number, CharRangePosition>
    >(() => new Map());
    const [placeholderPositions, setPlaceholderPositions] = useState<
      Map<number, CharRangePosition>
    >(() => new Map());

    const lines = useMemo(() => value.split("\n"), [value]);
    const navigation = useMemo(() => getSlideNavigation(value), [value]);
    const imageSlots = useMemo(() => findEmptyImageSlots(value), [value]);
    const placeholderSlots = useMemo(() => findEditorPlaceholderSlots(value), [value]);

    const showInsertControl = isFocused || insertMenuOpen;

    const remeasure = useCallback(() => {
      const textarea = textareaRef.current;
      const mirror = mirrorRef.current;
      if (!textarea || !mirror) return;

      syncMirrorLayout(textarea, mirror);
      // Empty value leaves no text node; use a placeholder so line 0 can be measured.
      mirror.textContent = value.length === 0 ? "\u200b" : value;

      const lineIndices = navigation.separators.map((separator) => separator.line);
      if (showInsertControl) {
        lineIndices.push(cursorLine);
      }
      if (showLineNumbers || scmLineChanges.length > 0) {
        for (let i = 0; i < lines.length; i += 1) lineIndices.push(i);
      }
      setLinePositions(measureLinePositions(mirror, lines, lineIndices));

      const slotPositions = new Map<number, CharRangePosition>();
      for (const slot of imageSlots) {
        const position = measureCharRange(mirror, slot.overlayStart, slot.overlayEnd, {
          minWidth: 0,
        });
        if (position) {
          slotPositions.set(slot.parenStart, position);
        }
      }
      setImageSlotPositions(slotPositions);

      const phPositions = new Map<number, CharRangePosition>();
      for (const slot of placeholderSlots) {
        const position = measureCharRange(mirror, slot.start, slot.end, { minWidth: 0 });
        if (position) {
          phPositions.set(slot.start, position);
        }
      }
      setPlaceholderPositions(phPositions);
    }, [value, lines, navigation.separators, showInsertControl, cursorLine, imageSlots, placeholderSlots, showLineNumbers, scmLineChanges, editorTextClass]);

    useLayoutEffect(() => {
      remeasure();
    }, [remeasure]);

    useLayoutEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const observer = new ResizeObserver(() => {
        remeasure();
      });
      observer.observe(textarea);
      return () => observer.disconnect();
    }, [remeasure]);

    const snapshotEditorState = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      editorStateRef.current = {
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
        scrollTop: textarea.scrollTop,
      };
    }, []);

    const updateCursorLine = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      snapshotEditorState();
      setCursorLine(getCursorLineIndex(textarea.value, textarea.selectionStart));
    }, [snapshotEditorState]);

    const applyInsertResult = useCallback(
      (result: { value: string; selectionStart: number; selectionEnd: number }) => {
        pendingInsertRef.current = {
          selectionStart: result.selectionStart,
          selectionEnd: result.selectionEnd,
          scrollTop: editorStateRef.current.scrollTop,
        };
        commitValue(result.value);
      },
      [commitValue],
    );

    useLayoutEffect(() => {
      const pending = pendingInsertRef.current;
      const textarea = textareaRef.current;
      if (!pending || !textarea) return;

      pendingInsertRef.current = null;

      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(pending.selectionStart, pending.selectionEnd);
      textarea.scrollTop = pending.scrollTop;
      setScrollTop(pending.scrollTop);
      setCursorLine(getCursorLineIndex(textarea.value, pending.selectionStart));

      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.scrollTop = pending.scrollTop;
        setScrollTop(pending.scrollTop);
      });
    }, [value]);

    const handleInsertTemplate = useCallback(
      (key: InsertTemplateKey) => {
        const cursorPos = editorStateRef.current.selectionStart;
        applyInsertResult(applyInsertTemplate(value, cursorPos, key));
      },
      [applyInsertResult, value],
    );

    const handleInsertTable = useCallback(
      (rows: number, cols: number) => {
        const cursorPos = editorStateRef.current.selectionStart;
        applyInsertResult(insertTable(value, cursorPos, rows, cols));
      },
      [applyInsertResult, value],
    );

    const handleImageUpload = useCallback(
      (slot: { parenStart: number }, url: string) => {
        snapshotEditorState();
        const nextValue = fillImageSlot(value, slot.parenStart, url);
        const closeParen = nextValue.indexOf(")", slot.parenStart);
        const cursorPos = closeParen === -1 ? nextValue.length : closeParen + 1;
        applyInsertResult({
          value: nextValue,
          selectionStart: cursorPos,
          selectionEnd: cursorPos,
        });
      },
      [applyInsertResult, snapshotEditorState, value],
    );

    const handlePlaceholderSelect = useCallback((slot: EditorPlaceholderSlot) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const scrollTop = editorStateRef.current.scrollTop;
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(slot.start, slot.end);
      textarea.scrollTop = scrollTop;
      setScrollTop(scrollTop);
      setCursorLine(getCursorLineIndex(value, slot.start));
      snapshotEditorState();
    }, [snapshotEditorState, value]);

    const locateLine = useCallback((lineIndex: number) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const safeLine = Math.max(0, Math.min(lineIndex, lines.length - 1));
      const charIndex = getLineCharIndex(lines, safeLine);

      textarea.focus();
      textarea.setSelectionRange(charIndex, charIndex);
      setCursorLine(safeLine);

      const position = linePositions.get(safeLine);
      if (position) {
        const nextScroll = Math.max(0, position.top - textarea.clientHeight / 3);
        textarea.scrollTop = nextScroll;
        setScrollTop(nextScroll);
      }
    }, [lines, linePositions]);

    useImperativeHandle(ref, () => ({
      locateLine,
      focus: () => textareaRef.current?.focus(),
      undo: () => {
        textareaRef.current?.focus({ preventScroll: true });
        undoEdit();
      },
      redo: () => {
        textareaRef.current?.focus({ preventScroll: true });
        redoEdit();
      },
    }), [locateLine, undoEdit, redoEdit]);

    const handleLocateSlide = (separatorLine: number) => {
      const marker = navigation.separators.find((item) => item.line === separatorLine);
      if (!marker) return;
      onLocateSlide(marker.page - 1);
    };

    const cursorLinePosition = linePositions.get(cursorLine);
    const insertColWidth = 22;
    const lineColWidth = showLineNumbers ? 28 : 0;
    const gutterWidth = insertColWidth + (lineColWidth || (scmLineChanges.length > 0 ? 12 : 0));
    const padClass =
      showLineNumbers || scmLineChanges.length > 0
        ? "pl-[3.25rem]"
        : "pl-10";

    const scmByLine = useMemo(() => {
      const map = new Map<number, "added" | "modified" | "deleted">();
      for (const change of scmLineChanges) {
        for (let line = change.startLine; line <= change.endLine; line += 1) {
          const idx = line - 1;
          const prev = map.get(idx);
          if (change.kind === "deleted") map.set(idx, "deleted");
          else if (change.kind === "modified" && prev !== "deleted") map.set(idx, "modified");
          else if (change.kind === "added" && !prev) map.set(idx, "added");
        }
      }
      return map;
    }, [scmLineChanges]);

    return (
      <div className={cn("relative min-h-0 flex-1 overflow-hidden html-scroll-area", className)}>
        <textarea
          ref={textareaRef}
          value={value}
          readOnly={readOnly}
          onChange={(event) => {
            if (readOnly) return;
            commitValue(event.target.value);
            updateCursorLine();
          }}
          onKeyDown={(event) => {
            if (readOnly) return;
            const key = event.key.toLowerCase();
            const mod = event.metaKey || event.ctrlKey;
            if (!mod) return;
            if (key === "z" && !event.shiftKey) {
              event.preventDefault();
              undoEdit();
              return;
            }
            if ((key === "z" && event.shiftKey) || key === "y") {
              event.preventDefault();
              redoEdit();
            }
          }}
          onScroll={(event) => {
            const nextScrollTop = event.currentTarget.scrollTop;
            setScrollTop(nextScrollTop);
            editorStateRef.current.scrollTop = nextScrollTop;
          }}
          onFocus={() => {
            setIsFocused(true);
            updateCursorLine();
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!insertMenuOpen) {
                setIsFocused(false);
              }
            }, 0);
          }}
          onSelect={updateCursorLine}
          onKeyUp={updateCursorLine}
          onClick={updateCursorLine}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(
            "absolute inset-0 z-0 w-full resize-none overflow-y-auto bg-transparent px-4 py-4 pr-4 outline-none",
            padClass,
            "no-native-scrollbar whitespace-pre-wrap break-words",
            "focus-visible:ring-1 focus-visible:ring-ring",
            readOnly && "cursor-default opacity-90",
            editorTextClass,
          )}
        />

        <HtmlScrollbar
          scrollRef={textareaRef}
          refreshToken={value}
          className="absolute inset-y-0 right-0 z-30"
        />

        {/* Hidden mirror — same layout as textarea for line measurement */}
        <div
          ref={mirrorRef}
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-0 top-0 -z-10 opacity-0",
            "box-border px-4 py-4",
            padClass,
            editorTextClass,
          )}
        />

        {/* Overlays aligned to measured line positions */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        >
          <div
            className="relative h-full w-full"
            style={{ transform: `translateY(-${scrollTop}px)` }}
          >
            {(showLineNumbers || scmLineChanges.length > 0) &&
              lines.map((_, lineIndex) => {
                const position = linePositions.get(lineIndex);
                if (!position) return null;
                const scm = scmByLine.get(lineIndex);
                return (
                  <div
                    key={`gutter-${lineIndex}`}
                    className="absolute left-0 flex items-stretch"
                    style={{
                      top: position.top,
                      height: position.height,
                      width: gutterWidth,
                    }}
                  >
                    {scm ? (
                      <span
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-[3px]",
                          scm === "added" && "bg-emerald-500",
                          scm === "modified" && "bg-amber-400",
                          scm === "deleted" && "bg-rose-500",
                          scm === "deleted" &&
                            "before:absolute before:left-0 before:top-0 before:border-l-[6px] before:border-b-[6px] before:border-l-transparent before:border-b-rose-500",
                        )}
                        title={scm}
                      />
                    ) : null}
                    {showLineNumbers ? (
                      <span
                        className={cn(
                          "w-full pr-2 text-right text-[10px] tabular-nums leading-[inherit] text-muted-foreground/70",
                          lineIndex === cursorLine && "text-muted-foreground",
                        )}
                        style={{ paddingLeft: insertColWidth }}
                      >
                        {lineIndex + 1}
                      </span>
                    ) : null}
                  </div>
                );
              })}

            <EditorImageUploadButtons
              slots={imageSlots}
              positions={imageSlotPositions}
              onUpload={handleImageUpload}
              onPrepareUpload={snapshotEditorState}
            />

            <EditorPlaceholderButtons
              slots={placeholderSlots}
              positions={placeholderPositions}
              onSelect={handlePlaceholderSelect}
            />

            {showInsertControl && cursorLinePosition && (
              <div
                className="pointer-events-auto absolute flex items-center justify-center"
                style={{
                  left: 2,
                  width: insertColWidth,
                  top: cursorLinePosition.top,
                  height: cursorLinePosition.height,
                }}
              >
                <EditorInsertMenu
                  open={insertMenuOpen}
                  onOpenChange={(open) => {
                    if (open) {
                      snapshotEditorState();
                    }
                    setInsertMenuOpen(open);
                    if (!open && !pendingInsertRef.current) {
                      textareaRef.current?.focus({ preventScroll: true });
                    }
                  }}
                  onInsertTemplate={handleInsertTemplate}
                  onInsertTable={handleInsertTable}
                />
              </div>
            )}

            {navigation.separators.map((separator) => {
              const position = linePositions.get(separator.line);
              if (!position) return null;

              return (
                <div
                  key={separator.line}
                  className="group/locate pointer-events-auto absolute right-6 flex items-center gap-1.5"
                  style={{
                    top: position.top,
                    height: position.height,
                  }}
                >
                  <span
                    className={cn(
                      "rounded-md border border-border/70 bg-background/95 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground shadow-sm backdrop-blur-sm",
                      "pointer-events-none opacity-0 transition-opacity group-hover/locate:opacity-100 group-focus-within/locate:opacity-100",
                    )}
                  >
                    {t.page(separator.page, separator.total)}
                  </span>
                  <LocateIconButton
                    label={t.locate}
                    ariaLabel={`${t.locate} ${t.page(separator.page, separator.total)}`}
                    className="editor-locate-btn size-5"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleLocateSlide(separator.line)}
                    icon={<Locate className="size-3" />}
                    showTooltip={false}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);
