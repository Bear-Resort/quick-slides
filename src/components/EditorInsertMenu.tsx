import {
  Code2,
  FunctionSquare,
  Heading,
  List,
  Plus,
  Table2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableSizePicker } from "@/components/TableSizePicker";
import type { InsertTemplateKey } from "@/lib/editorInsert";
import { useLanguage } from "@/lib/useLanguage";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    addComponent: "Add formatting",
    title: "Title",
    h1Label: "# Main title",
    h1Hint: "Large centered title slide",
    h2Label: "## Subtitle",
    h2Hint: "Centered subtitle under a main title",
    h3Label: "### Page title",
    h3Hint: "Fixed heading at the top of a content slide",
    equation: "Equation",
    mathInlineLabel: "$...$ Inline",
    mathInlineHint: "Math within a line of text",
    mathDisplayLabel: "$$...$$ Display",
    mathDisplayHint: "Centered equation on its own lines",
    code: "Code",
    codeInlineLabel: "`...` Inline",
    codeInlineHint: "Short code snippet in text",
    codeBlockLabel: "```...``` Block",
    codeBlockHint: "Multi-line fenced code block",
    list: "List",
    bulletLabel: "- Bullet list",
    bulletHint: "Unordered list item",
    orderedLabel: "1. Numbered list",
    orderedHint: "Adds the next number in this slide",
    image: "Image",
    imageHint: "One image per slide on the right half",
    separator: "Slide separator",
    separatorHint: "Start a new slide with ---",
    comment: "Comment",
    commentLabel: "<!-- ... --> Note",
    commentHint: "Hidden in slide preview; visible in the editor",
    table: "Table",
    tablePrompt: "Hover to choose table size",
    tableSize: (rows: number, cols: number) => `${cols} × ${rows} table`,
    tableCustomSize: "Custom size…",
    tableCustomTitle: "Custom table size",
    tableRows: "Rows",
    tableColumns: "Columns",
    tableInsert: "Insert table",
    cancel: "Cancel",
  },
  zh: {
    addComponent: "添加格式",
    title: "标题",
    h1Label: "# 主标题",
    h1Hint: "大号居中标题页",
    h2Label: "## 副标题",
    h2Hint: "主标题下方的居中副标题",
    h3Label: "### 页面标题",
    h3Hint: "内容页顶部固定标题",
    equation: "公式",
    mathInlineLabel: "$...$ 行内",
    mathInlineHint: "行内数学公式",
    mathDisplayLabel: "$$...$$ 独立",
    mathDisplayHint: "单独成行的居中公式",
    code: "代码",
    codeInlineLabel: "`...` 行内",
    codeInlineHint: "文本中的短代码",
    codeBlockLabel: "```...``` 块",
    codeBlockHint: "多行围栏代码块",
    list: "列表",
    bulletLabel: "- 无序列表",
    bulletHint: "无序列表条目",
    orderedLabel: "1. 有序列表",
    orderedHint: "在本页添加下一个编号",
    image: "图片",
    imageHint: "每页一张图片，显示在右侧",
    separator: "幻灯片分隔",
    separatorHint: "用 --- 开始新的一页",
    comment: "注释",
    commentLabel: "<!-- ... --> 说明",
    commentHint: "预览中隐藏；编辑器中可见",
    table: "表格",
    tablePrompt: "悬停选择表格大小",
    tableSize: (rows: number, cols: number) => `${cols} × ${rows} 表格`,
    tableCustomSize: "自定义大小…",
    tableCustomTitle: "自定义表格大小",
    tableRows: "行数",
    tableColumns: "列数",
    tableInsert: "插入表格",
    cancel: "取消",
  },
} as const;

type EditorInsertMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertTemplate: (key: InsertTemplateKey) => void;
  onInsertTable: (rows: number, cols: number) => void;
  className?: string;
  style?: React.CSSProperties;
};

function MenuItemWithHint({
  label,
  hint,
  onSelect,
}: {
  label: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      className="flex flex-col items-start gap-0.5 py-2"
      onSelect={(event) => {
        event.preventDefault();
        onSelect();
      }}
    >
      <span className="font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </DropdownMenuItem>
  );
}

export function EditorInsertMenu({
  open,
  onOpenChange,
  onInsertTemplate,
  onInsertTable,
  className,
  style,
}: EditorInsertMenuProps) {
  const language = useLanguage();
  const t = copy[language];

  const insert = (key: InsertTemplateKey) => {
    onInsertTemplate(key);
    onOpenChange(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t.addComponent}
          className={cn(
            "editor-insert-btn flex size-5 shrink-0 items-center justify-center rounded-md border text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
            className,
          )}
          style={style}
          onMouseDown={(event) => event.preventDefault()}
        >
          <Plus className="size-3" strokeWidth={2.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right" className="w-56">
        <DropdownMenuLabel>{t.addComponent}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Heading className="size-4" />
            {t.title}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <MenuItemWithHint label={t.h1Label} hint={t.h1Hint} onSelect={() => insert("h1")} />
            <MenuItemWithHint label={t.h2Label} hint={t.h2Hint} onSelect={() => insert("h2")} />
            <MenuItemWithHint label={t.h3Label} hint={t.h3Hint} onSelect={() => insert("h3")} />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FunctionSquare className="size-4" />
            {t.equation}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <MenuItemWithHint
              label={t.mathInlineLabel}
              hint={t.mathInlineHint}
              onSelect={() => insert("mathInline")}
            />
            <MenuItemWithHint
              label={t.mathDisplayLabel}
              hint={t.mathDisplayHint}
              onSelect={() => insert("mathDisplay")}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Code2 className="size-4" />
            {t.code}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <MenuItemWithHint
              label={t.codeInlineLabel}
              hint={t.codeInlineHint}
              onSelect={() => insert("codeInline")}
            />
            <MenuItemWithHint
              label={t.codeBlockLabel}
              hint={t.codeBlockHint}
              onSelect={() => insert("codeBlock")}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <List className="size-4" />
            {t.list}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <MenuItemWithHint
              label={t.bulletLabel}
              hint={t.bulletHint}
              onSelect={() => insert("bullet")}
            />
            <MenuItemWithHint
              label={t.orderedLabel}
              hint={t.orderedHint}
              onSelect={() => insert("orderedList")}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Table2 className="size-4" />
            {t.table}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-auto p-0">
            <TableSizePicker
              copy={{
                prompt: t.tablePrompt,
                sizeLabel: t.tableSize,
                customSize: t.tableCustomSize,
                customTitle: t.tableCustomTitle,
                rows: t.tableRows,
                columns: t.tableColumns,
                insert: t.tableInsert,
                cancel: t.cancel,
              }}
              onSelect={(rows, cols) => {
                onInsertTable(rows, cols);
                onOpenChange(false);
              }}
            />
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <MenuItemWithHint label={t.image} hint={t.imageHint} onSelect={() => insert("image")} />

        <MenuItemWithHint
          label={t.commentLabel}
          hint={t.commentHint}
          onSelect={() => insert("comment")}
        />

        <MenuItemWithHint
          label={t.separator}
          hint={t.separatorHint}
          onSelect={() => insert("separator")}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
