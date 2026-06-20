import { useSyncExternalStore } from "react";
import {
  getLanguage,
  subscribeLanguage,
  type Language,
} from "@/lib/language";

export function useLanguage(): Language {
  return useSyncExternalStore(
    subscribeLanguage,
    getLanguage,
    (): Language => "en",
  );
}
