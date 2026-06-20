import { Return } from "@/components/Return";
import { HelpButton } from "@/components/HelpDialog";
import { Menu } from "@/components/Menu";

type HeaderProps = {
  onLoadSample: () => void;
  hasEditorContent: boolean;
};

export function Header({ onLoadSample, hasEditorContent }: HeaderProps) {
  return (
    <div className="app-header-bar sticky top-0 z-10 flex items-center justify-between border-b px-4 py-4">
      <div className="flex items-center gap-3">
        <Return />
        <h1 className="text-lg font-bold tracking-tight">Quick Slides</h1>
      </div>
      <div className="flex items-center gap-1">
        <HelpButton
          onLoadSample={onLoadSample}
          hasEditorContent={hasEditorContent}
        />
        <Menu />
      </div>
    </div>
  );
}
