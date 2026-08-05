import { useEffect, useState } from "react";
import { Bot, Check, Copy, X } from "lucide-react";
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

<!-- One image: ![caption](url). Alt text shows as the caption under the image.
     Text left (clips if too long), image right. Two images: title only + two images. -->
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
    exampleMarkdown: "Example markdown",
    examplePreview: "Slide preview",
    loadSample: "Load sample document",
    replaceSampleConfirm:
      "Replace the current editor content with the sample document?",
    sections: {
      start: {
        title: "Getting started",
        body: "Quick Slides is a Bear Resort app for quick, systematic slides with markdown and an agent-friendly repo layout. The editor starts empty — write markdown on the left and the preview updates as you type, or load the sample document below. Use ◀ ▶ to walk through the syntax example. Comments in the code explain features — they are hidden in the preview.",
      },
      present: {
        title: "Present",
        body: "Click Present to enter fullscreen slideshow mode. Use arrow keys or Space to advance, Esc to exit.",
      },
      download: {
        title: "Download",
        body: "Use Download in the slides panel. There are three export formats:",
        items: [
          {
            name: "HTML (presentation)",
            detail:
              "Standalone, high resolution view on any browser.",
          },
          {
            name: "PDF (image)",
            detail: "PDF document with limited resolution.",
          },
          {
            name: "PDF (high-resolution)",
            detail:
              "Clean text PDF with high resolution. Requires GitHub sign-in and uses your weekly quota.",
          },
        ],
      },
      plans: {
        title: "Plans & quotas",
        body: "Plans apply to high-resolution PDF exports (per calendar week). Image PDF and HTML stay available regardless of plan. Guests can use image PDF and HTML only.",
        tableHeaders: {
          plan: "Plan",
          perWeek: "PDFs / week",
        },
        rows: [
          { plan: "Free", perWeek: "3" },
          { plan: "Premium", perWeek: "15" },
          { plan: "Pro", perWeek: "40" },
        ],
        note: "Premium can be requested from Download when your free quota is used. A shared monthly server capacity may also limit high-resolution exports when the service is busy.",
      },
    },
  },
  zh: {
    help: "帮助",
    title: "Quick Slides 指南",
    close: "关闭",
    exampleMarkdown: "示例 Markdown",
    examplePreview: "幻灯片预览",
    loadSample: "加载示例文档",
    replaceSampleConfirm: "用示例文档替换当前编辑器内容？",
    sections: {
      start: {
        title: "入门",
        body: "Quick Slides 是小熊樂園出品的应用，用 Markdown 与智能体友好的仓库结构快速、系统地制作幻灯片。编辑器默认为空 — 在左侧编写 Markdown 可实时预览，或点击下方加载示例文档。用 ◀ ▶ 浏览语法示例。代码中的注释说明功能，预览中不会显示。",
      },
      present: {
        title: "演示",
        body: "点击「演示」进入全屏放映。方向键或空格翻页，Esc 退出。",
      },
      download: {
        title: "下载",
        body: "在幻灯片面板点击「下载」。共有三种导出格式：",
        items: [
          {
            name: "HTML（演示模式）",
            detail: "独立高清演示，任意浏览器可打开。",
          },
          {
            name: "PDF（图片）",
            detail: "分辨率有限的 PDF 文档。",
          },
          {
            name: "PDF（高清）",
            detail:
              "清晰可选中文字的高清 PDF。需 GitHub 登录，并占用每周配额。",
          },
        ],
      },
      plans: {
        title: "方案与配额",
        body: "方案仅限制高清 PDF（按自然周）。图片 PDF 与 HTML 不受方案限制。未登录访客只能使用图片 PDF 与 HTML。",
        tableHeaders: {
          plan: "方案",
          perWeek: "每周次数",
        },
        rows: [
          { plan: "Free（免费）", perWeek: "3" },
          { plan: "Premium（高级）", perWeek: "15" },
          { plan: "Pro", perWeek: "40" },
        ],
        note: "免费配额用尽后可在下载面板申请 Premium。服务繁忙时，还可能受每月共享服务端容量限制。",
      },
    },
  },
} as const;

const aiCopy = {
  en: {
    label: "AI instructions",
    title: "AI agent skill",
    close: "Close",
    copied: "Copied!",
    copyInstructions: "Copy instructions",
    body: "Give this skill to your coding agent (Cursor, Claude Code, Codex, ChatGPT, etc.) so it formats the repository correctly — markdown slides, quick-slides.json, images/, and Git layout.",
    hint: "Paste into chat, save as SKILL.md / AGENTS.md / project instructions, or attach as a custom skill.",
  },
  zh: {
    label: "AI 说明",
    title: "AI 智能体技能",
    close: "关闭",
    copied: "已复制！",
    copyInstructions: "复制说明",
    body: "把这份技能交给你的编程智能体（Cursor、Claude Code、Codex、ChatGPT 等），即可按规范整理仓库 —— Markdown 幻灯片、quick-slides.json、images/ 与 Git 目录结构。",
    hint: "可粘贴到对话、保存为 SKILL.md / AGENTS.md / 项目说明，或添加为自定义技能。",
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

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleLoadSample = () => {
    if (hasEditorContent && !window.confirm(t.replaceSampleConfirm)) {
      return;
    }
    onLoadSample();
    onClose();
  };

  return (
    <DialogPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-slides-help-title"
          className="glass-panel glass-panel-dialog flex h-[min(90vh,820px)] max-h-[min(90vh,820px)] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-xl border shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="glass-divider relative z-[1] flex shrink-0 items-center justify-between border-b px-5 py-4">
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
            className="relative z-[1] flex-1"
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
                <h3 className="font-semibold">{t.sections.download.title}</h3>
                <p className="mt-1 text-muted-foreground">{t.sections.download.body}</p>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
                  {t.sections.download.items.map((item) => (
                    <li key={item.name}>
                      <span className="font-medium text-foreground">{item.name}</span>
                      {" — "}
                      {item.detail}
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="font-semibold">{t.sections.plans.title}</h3>
                <p className="mt-1 text-muted-foreground">{t.sections.plans.body}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[16rem] border-collapse text-left text-sm text-muted-foreground">
                    <thead>
                      <tr className="border-b border-white/15">
                        <th className="py-2 pr-4 font-semibold text-foreground">
                          {t.sections.plans.tableHeaders.plan}
                        </th>
                        <th className="py-2 font-semibold text-foreground">
                          {t.sections.plans.tableHeaders.perWeek}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.sections.plans.rows.map((row) => (
                        <tr key={row.plan} className="border-b border-white/10">
                          <td className="py-2 pr-4 font-medium text-foreground">
                            {row.plan}
                          </td>
                          <td className="py-2 tabular-nums">{row.perWeek}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.sections.plans.note}
                </p>
              </section>
            </div>
          </HtmlScrollbarArea>

          <div className="glass-divider relative z-[1] flex shrink-0 justify-end border-t px-5 py-4">
            <Button onClick={onClose}>{t.close}</Button>
          </div>
        </div>
      </div>
    </DialogPortal>
  );
}

type AiInstructionsDialogProps = {
  open: boolean;
  onClose: () => void;
};

function AiInstructionsDialog({ open, onClose }: AiInstructionsDialogProps) {
  const language = useLanguage();
  const t = aiCopy[language];
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

  const handleCopy = async () => {
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-[3px]"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-slides-ai-title"
          className="glass-panel glass-panel-dialog flex h-[min(90vh,720px)] max-h-[min(90vh,720px)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="glass-divider relative z-[1] flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
            <div className="flex min-w-0 items-center gap-2">
              <Bot className="size-5 shrink-0 text-foreground" aria-hidden />
              <h2 id="quick-slides-ai-title" className="truncate text-lg font-bold">
                {t.title}
              </h2>
            </div>
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
            className="relative z-[1] flex-1"
            contentClassName="px-5 py-4"
            refreshToken={language}
          >
            <div className="space-y-3 text-sm leading-relaxed">
              <p className="text-muted-foreground">{t.body}</p>
              <p className="text-xs text-muted-foreground">{t.hint}</p>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => void handleCopy()}>
                  {copied ? <Check className="text-green-600" /> : <Copy />}
                  {copied ? t.copied : t.copyInstructions}
                </Button>
              </div>
              <pre className="glass-panel max-h-[min(55vh,480px)] overflow-auto rounded-lg border p-3 font-mono text-xs leading-relaxed">
                {QUICK_SLIDES_AI_INSTRUCTIONS}
              </pre>
            </div>
          </HtmlScrollbarArea>

          <div className="glass-divider relative z-[1] flex shrink-0 justify-end border-t px-5 py-4">
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
        className="slide-locate-btn glass-toolbar-action"
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

export function AiInstructionsButton() {
  const language = useLanguage();
  const t = aiCopy[language];
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        aria-label={t.label}
        title={t.label}
        onClick={() => setOpen(true)}
        className="slide-locate-btn glass-toolbar-action"
      >
        <Bot className="size-4" aria-hidden />
      </Button>
      <AiInstructionsDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
