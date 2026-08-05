import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { getEnergySaveMode, subscribeTheme } from "@/lib/theme";
import { useLanguage } from "@/lib/useLanguage";

const copy = {
  en: {
    label: "Energy",
    title: "Energy Save Mode is on — glass effects are reduced",
  },
  zh: {
    label: "节能",
    title: "节能模式已开启 — 已降低玻璃特效",
  },
} as const;

/** Shown in the header when Energy Save Mode is active (quick-tex style). */
export function EnergySaveBadge() {
  const language = useLanguage();
  const t = copy[language];
  const [active, setActive] = useState(() => getEnergySaveMode());

  useEffect(() => {
    setActive(getEnergySaveMode());
    return subscribeTheme(() => setActive(getEnergySaveMode()));
  }, []);

  if (!active) return null;

  return (
    <div
      className="energy-save-badge flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium tracking-wide"
      role="status"
      aria-label={t.title}
      title={t.title}
    >
      <Leaf className="size-3 shrink-0" aria-hidden />
      <span>{t.label}</span>
    </div>
  );
}
