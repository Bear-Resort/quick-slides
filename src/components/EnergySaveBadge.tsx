import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Leaf } from "lucide-react";
import { getEnergySaveMode, subscribeTheme } from "@/lib/theme";
import { useLanguage } from "@/lib/useLanguage";

const copy = {
  en: {
    label: "Energy",
    title:
      "Energy Save Mode — darker UI, no glass/blur effects, Auto Save stays on",
  },
  zh: {
    label: "节能",
    title: "节能模式 — 深色界面、关闭玻璃模糊，自动保存保持开启",
  },
} as const;

/** Shown in the header when Energy Save Mode is active (quick-tex style). */
export function EnergySaveBadge() {
  const language = useLanguage();
  const t = copy[language];
  const [active, setActive] = useState(() => getEnergySaveMode());
  const badgeRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setActive(getEnergySaveMode());
    return subscribeTheme(() => setActive(getEnergySaveMode()));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const el = badgeRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setCoords({
        top: rect.bottom + 6,
        left: Math.max(8, rect.right - 220),
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  if (!active) return null;

  return (
    <>
      <div
        ref={badgeRef}
        className="energy-save-badge flex h-7 items-center gap-1 rounded-md px-1.5 text-[10px] font-medium tracking-wide"
        tabIndex={0}
        role="status"
        aria-label={t.title}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Leaf className="size-3 shrink-0" aria-hidden />
        <span>{t.label}</span>
      </div>
      {open
        ? createPortal(
            <div
              className="energy-save-tooltip"
              style={{ top: coords.top, left: coords.left }}
              role="tooltip"
            >
              {t.title}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
