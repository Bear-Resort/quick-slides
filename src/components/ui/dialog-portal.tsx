import { createPortal } from "react-dom";
import type { ReactNode } from "react";

type DialogPortalProps = {
  children: ReactNode;
};

export function DialogPortal({ children }: DialogPortalProps) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
