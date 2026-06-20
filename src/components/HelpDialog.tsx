import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { HtmlScrollbarArea } from "@/components/HtmlScrollbar";
import { HelpExamplePair } from "@/components/HelpExamplePair";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { Button } from "@/components/ui/button";
import { QUICK_SLIDES_AI_INSTRUCTIONS } from "@/lib/quickSlidesSkill";
import { useLanguage } from "@/lib/useLanguage";

const GETTING_STARTED_MARKDOWN = {
  en: `<!-- # starts a title slide — large centered heading -->
# Quick Slides
<!-- ## optional subtitle under the main title -->
## Presentations from markdown

<!-- Put --- on its own line to start a new slide -->
---

<!-- ### sets a content page heading; body text is left-aligned below -->
### Content slides

Your slide content goes here.

---

<!-- **double asterisks** for bold, *single* for italic -->
<!-- > for blockquotes, [text](url) for links -->
### Markdown

**Bold** and *italic* text.

> A short blockquote

[Links](https://example.com) too.

---

<!-- - for bullet lists, 1. for numbered lists -->
### Lists

- First point
- Second point

1. Step one
2. Step two

---

<!-- One image per slide: ![alt](url). Text stays left, image fills the right -->
### With image

Notes stay on the left.

![Bear Resort](https://bear-resort.github.io/logos/default-bear.gif)

---

<!-- Inline math: wrap with $...$. Display math: $$ on its own lines -->
### Math

Inline: $E = mc^2$

$$
\\sin 2x = 2\\sin x\\cos x
$$

---

<!-- Inline code with backticks, or a fenced block with triple backticks -->
### Code

Inline \`const x = 1\`

\`\`\`
function greet() {
  return "Hello";
}
\`\`\``,
  zh: `<!-- # 开始标题页 — 大号居中标题 -->
# Quick Slides
<!-- ## 主标题下方的可选副标题 -->
## 用 Markdown 做演示

<!-- 单独一行的 --- 开始新的一页 -->
---

<!-- ### 设置内容页标题；正文在下方左对齐 -->
### 内容页

幻灯片正文写在这里。

---

<!-- **双星号** 粗体，*单星号* 斜体 -->
<!-- > 引用，[文字](链接) 超链接 -->
### Markdown

**粗体**与*斜体*。

> 简短引用

也支持[链接](https://example.com)。

---

<!-- - 无序列表，1. 有序列表 -->
### 列表

- 第一点
- 第二点

1. 步骤一
2. 步骤二

---

<!-- 每页一张图：![说明](url)。文字在左，图片在右 -->
### 配图

说明文字在左侧。

![Bear Resort](https://bear-resort.github.io/logos/default-bear.gif)

---

<!-- 行内公式：$...$。独立公式：单独成行的 $$ -->
### 公式

行内：$E = mc^2$

$$
\\sin 2x = 2\\sin x\\cos x
$$

---

<!-- 行内 \`反引号\`，或三反引号围栏代码块 -->
### 代码

行内 \`const x = 1\`

\`\`\`
function greet() {
  return "Hello";
}
\`\`\``,
} as const;

const copy = {
  en: {
    help: "Help",
    title: "Quick Slides guide",
    close: "Close",
    copied: "Copied!",
    copyInstructions: "Copy instructions",
    instructionsHint:
      "Works with Claude, Codex, Cursor, ChatGPT, and other assistants — paste into chat or save as a project instructions file.",
    exampleMarkdown: "Example markdown",
    examplePreview: "Slide preview",
    loadSample: "Load sample document",
    replaceSampleConfirm:
      "Replace the current editor content with the sample document?",
    sections: {
      start: {
        title: "Getting started",
        body: "The editor starts empty. Write markdown on the left and the preview updates as you type, or load the sample document below. Use ◀ ▶ to walk through the syntax example. Comments in the code explain features — they are hidden in the preview.",
      },
      present: {
        title: "Present",
        body: "Click Present to enter fullscreen slideshow mode. Use arrow keys or Space to advance, Esc to exit.",
      },
      instructions: {
        title: "AI instructions",
        body: "Copy the block below and give it to any AI assistant when you want slide decks written for Quick Slides.",
      },
    },
  },
  zh: {
    help: "帮助",
    title: "Quick Slides 指南",
    close: "关闭",
    copied: "已复制！",
    copyInstructions: "复制说明",
    instructionsHint:
      "适用于 Claude、Codex、Cursor、ChatGPT 等助手 — 粘贴到对话中，或保存为项目说明文件。",
    exampleMarkdown: "示例 Markdown",
    examplePreview: "幻灯片预览",
    loadSample: "加载示例文档",
    replaceSampleConfirm: "用示例文档替换当前编辑器内容？",
    sections: {
      start: {
        title: "入门",
        body: "编辑器默认为空。在左侧编写 Markdown 可实时预览，或点击下方加载示例文档。用 ◀ ▶ 浏览语法示例。代码中的注释说明功能，预览中不会显示。",
      },
      present: {
        title: "演示",
        body: "点击「演示」进入全屏放映。方向键或空格翻页，Esc 退出。",
      },
      instructions: {
        title: "AI 说明",
        body: "复制下方内容，交给任意 AI 助手，即可按 Quick Slides 规则生成幻灯片。",
      },
    },
  },
} as const;

type HelpDialogProps = {
  open: boolean;
  onClose: () => void;
  onLoadSample: () => void;
  hasEditorContent: boolean;
};

export function HelpDialog({
  open,
  onClose,
  onLoadSample,
  hasEditorContent,
}: HelpDialogProps) {
  const language = useLanguage();
  const t = copy[language];
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  if (!open) return null;

  const handleLoadSample = () => {
    if (hasEditorContent && !window.confirm(t.replaceSampleConfirm)) {
      return;
    }
    onLoadSample();
    onClose();
  };

  const handleCopyInstructions = async () => {
    try {
      await navigator.clipboard.writeText(QUICK_SLIDES_AI_INSTRUCTIONS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-slides-help-title"
          className="flex h-[min(90vh,820px)] max-h-[min(90vh,820px)] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-gray-300 bg-background shadow-lg dark:border-gray-700"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-gray-300 px-5 py-4 dark:border-gray-700">
            <h2 id="quick-slides-help-title" className="text-lg font-bold">
              {t.title}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t.close}
              title={t.close}
            >
              <X />
            </Button>
          </div>

          <HtmlScrollbarArea
            className="flex-1"
            contentClassName="px-5 py-4"
            refreshToken={language}
          >
            <div className="space-y-6 text-sm leading-relaxed text-foreground">
              <section className="space-y-4">
                <div>
                  <h3 className="font-semibold">{t.sections.start.title}</h3>
                  <p className="mt-1 text-muted-foreground">{t.sections.start.body}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={handleLoadSample}
                  >
                    {t.loadSample}
                  </Button>
                </div>

                <div className="help-example-labels hidden md:grid md:grid-cols-2 md:gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t.exampleMarkdown}
                  </span>
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t.examplePreview}
                  </span>
                </div>

                <HelpExamplePair
                  key={language}
                  markdown={GETTING_STARTED_MARKDOWN[language]}
                />
              </section>

              <section>
                <h3 className="font-semibold">{t.sections.present.title}</h3>
                <p className="mt-1 text-muted-foreground">{t.sections.present.body}</p>
              </section>

              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">{t.sections.instructions.title}</h3>
                  <Button variant="outline" size="sm" onClick={handleCopyInstructions}>
                    {copied ? <Check className="text-green-600" /> : <Copy />}
                    {copied ? t.copied : t.copyInstructions}
                  </Button>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t.sections.instructions.body}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{t.instructionsHint}</p>
                <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-gray-300 bg-secondary p-3 font-mono text-xs leading-relaxed dark:border-gray-700">
                  {QUICK_SLIDES_AI_INSTRUCTIONS}
                </pre>
              </section>
            </div>
          </HtmlScrollbarArea>

          <div className="flex shrink-0 justify-end border-t border-gray-300 px-5 py-4 dark:border-gray-700">
            <Button onClick={onClose}>{t.close}</Button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}

type HelpButtonProps = {
  onLoadSample: () => void;
  hasEditorContent: boolean;
};

export function HelpButton({ onLoadSample, hasEditorContent }: HelpButtonProps) {
  const language = useLanguage();
  const t = copy[language];
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={t.help}
        title={t.help}
        onClick={() => setOpen(true)}
        className="slide-locate-btn"
      >
        <span className="text-base font-bold leading-none">?</span>
      </Button>
      <HelpDialog
        open={open}
        onClose={() => setOpen(false)}
        onLoadSample={onLoadSample}
        hasEditorContent={hasEditorContent}
      />
    </>
  );
}
