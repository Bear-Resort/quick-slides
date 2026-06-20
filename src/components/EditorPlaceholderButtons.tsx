import { useLanguage } from "@/lib/useLanguage";
import type { CharRangePosition } from "@/lib/editorInsert";
import {
  EDITOR_PLACEHOLDER_LABELS,
  type EditorPlaceholderKind,
  type EditorPlaceholderSlot,
} from "@/lib/editorPlaceholders";
import { EditorPlaceholderChip } from "@/components/EditorPlaceholderChip";

const copy = {
  en: {
    title: EDITOR_PLACEHOLDER_LABELS.title,
    subtitle: EDITOR_PLACEHOLDER_LABELS.subtitle,
    pageTitle: EDITOR_PLACEHOLDER_LABELS.pageTitle,
    listItem: EDITOR_PLACEHOLDER_LABELS.listItem,
    equation: EDITOR_PLACEHOLDER_LABELS.equation,
    comment: EDITOR_PLACEHOLDER_LABELS.comment,
    header: EDITOR_PLACEHOLDER_LABELS.header,
    cell: EDITOR_PLACEHOLDER_LABELS.cell,
    alt: EDITOR_PLACEHOLDER_LABELS.alt,
    editTitle: "Edit title",
    editSubtitle: "Edit subtitle",
    editPageTitle: "Edit page title",
    editListItem: "Edit list item",
    editEquation: "Edit equation",
    editComment: "Edit comment",
    editHeader: "Edit header",
    editCell: "Edit cell",
    editAlt: "Edit image alt text",
  },
  zh: {
    title: "标题",
    subtitle: "副标题",
    pageTitle: "页面标题",
    listItem: "条目",
    equation: "公式",
    comment: "说明",
    header: "表头",
    cell: "内容",
    alt: "说明",
    editTitle: "编辑标题",
    editSubtitle: "编辑副标题",
    editPageTitle: "编辑页面标题",
    editListItem: "编辑列表条目",
    editEquation: "编辑公式",
    editComment: "编辑注释",
    editHeader: "编辑表头",
    editCell: "编辑单元格",
    editAlt: "编辑图片说明",
  },
} as const;

const EDIT_LABEL_KEYS: Record<
  Exclude<EditorPlaceholderKind, "url">,
  keyof (typeof copy)["en"]
> = {
  title: "editTitle",
  subtitle: "editSubtitle",
  pageTitle: "editPageTitle",
  listItem: "editListItem",
  equation: "editEquation",
  comment: "editComment",
  header: "editHeader",
  cell: "editCell",
  alt: "editAlt",
};

const LABEL_KEYS: Record<
  Exclude<EditorPlaceholderKind, "url">,
  keyof (typeof copy)["en"]
> = {
  title: "title",
  subtitle: "subtitle",
  pageTitle: "pageTitle",
  listItem: "listItem",
  equation: "equation",
  comment: "comment",
  header: "header",
  cell: "cell",
  alt: "alt",
};

type EditorPlaceholderButtonsProps = {
  slots: EditorPlaceholderSlot[];
  positions: Map<number, CharRangePosition>;
  onSelect: (slot: EditorPlaceholderSlot) => void;
};

export function EditorPlaceholderButtons({
  slots,
  positions,
  onSelect,
}: EditorPlaceholderButtonsProps) {
  const language = useLanguage();
  const t = copy[language];

  if (slots.length === 0) return null;

  return (
    <>
      {slots.map((slot) => {
        const position = positions.get(slot.start);
        if (!position || slot.kind === "url") return null;

        const labelKey = LABEL_KEYS[slot.kind];
        const editKey = EDIT_LABEL_KEYS[slot.kind];

        return (
          <EditorPlaceholderChip
            key={slot.start}
            variant={slot.kind}
            label={t[labelKey]}
            ariaLabel={t[editKey]}
            position={position}
            onClick={() => onSelect(slot)}
          />
        );
      })}
    </>
  );
}