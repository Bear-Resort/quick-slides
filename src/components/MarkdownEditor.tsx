import {
  forwardRef,
  useCallback,
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
import { getSlideNavigation } from "@/lib/slideMarkers";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

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

const EDITOR_TEXT_CLASS =
  "font-mono text-sm leading-relaxed [font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace]";

type LinePosition = {
  top: number;
  height: number;
};

export type MarkdownEditorHandle = {
  locateLine: (lineIndex: number) => void;
  focus: () => void;
};

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onLocateSlide: (slideIndex: number) => void;
  placeholder?: string;
  className?: string;
};

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
    { value, onChange, onLocateSlide, placeholder, className },
    ref,
  ) {
    const language = useLanguage();
    const t = copy[language];
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const editorStateRef = useRef({ selectionStart: 0, selectionEnd: 0, scrollTop: 0 });
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
    }, [value, lines, navigation.separators, showInsertControl, cursorLine, imageSlots, placeholderSlots]);

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
        onChange(result.value);
      },
      [onChange],
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
    }), [locateLine]);

    const handleLocateSlide = (separatorLine: number) => {
      const marker = navigation.separators.find((item) => item.line === separatorLine);
      if (!marker) return;
      onLocateSlide(marker.page - 1);
    };

    const cursorLinePosition = linePositions.get(cursorLine);

    return (
      <div className={cn("relative min-h-0 flex-1 overflow-hidden html-scroll-area", className)}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            updateCursorLine();
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
            "absolute inset-0 z-0 w-full resize-none overflow-y-auto bg-background px-4 py-4 pl-10 pr-4 outline-none",
            "no-native-scrollbar whitespace-pre-wrap break-words",
            "focus-visible:ring-1 focus-visible:ring-ring",
            EDITOR_TEXT_CLASS,
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
            "box-border px-4 py-4 pl-10",
            EDITOR_TEXT_CLASS,
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
                className="pointer-events-auto absolute left-1 flex items-center"
                style={{
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
                  className="pointer-events-auto absolute right-6 flex items-center gap-1.5"
                  style={{
                    top: position.top,
                    height: position.height,
                  }}
                >
                  <span className="rounded-md border border-border/70 bg-background/95 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground shadow-sm backdrop-blur-sm">
                    {t.page(separator.page, separator.total)}
                  </span>
                  <LocateIconButton
                    label={t.locate}
                    ariaLabel={`${t.locate} ${t.page(separator.page, separator.total)}`}
                    className="editor-locate-btn size-5"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleLocateSlide(separator.line)}
                    icon={<Locate className="size-3" />}
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
