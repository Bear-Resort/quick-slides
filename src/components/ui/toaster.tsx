import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastContextValue = {
  toast: (opts: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

const STYLES = {
  success:
    "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  error: "border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300",
  info: "border-white/15 bg-card/90 text-foreground",
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((opts: Omit<Toast, "id">) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[400] flex max-w-[min(100vw-2rem,20rem)] flex-col gap-2">
        {toasts.map((item) => {
          const Icon = ICONS[item.type];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                "glass-panel pointer-events-auto flex w-72 items-start gap-3 rounded-xl border p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2",
                STYLES[item.type],
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{item.title}</p>
                {item.description ? (
                  <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-snug opacity-85">
                    {item.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
                aria-label="Dismiss"
              >
                <X className="size-3" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
