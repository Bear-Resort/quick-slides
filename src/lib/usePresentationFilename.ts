import { useSyncExternalStore } from "react";
import {
  getPresentationFilename,
  subscribePresentationFilename,
} from "@/lib/presentationFilename";

export function usePresentationFilename(): string {
  return useSyncExternalStore(
    subscribePresentationFilename,
    getPresentationFilename,
    () => getPresentationFilename("en"),
  );
}
