import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { DeckMetadata } from "@/lib/library/deckFormat";

export type DeckContextValue = {
  mode: "library" | "ephemeral";
  folderName: string | null;
  handle: FileSystemDirectoryHandle | null;
  metadata: DeckMetadata | null;
  resolveImageSrc: (src: string) => Promise<string>;
  storeImage: (file: File) => Promise<string>;
};

const defaultResolve = async (src: string) => src;
const defaultStore = async (_file: File) => {
  throw new Error("No deck open for image storage");
};

const DeckContext = createContext<DeckContextValue>({
  mode: "ephemeral",
  folderName: null,
  handle: null,
  metadata: null,
  resolveImageSrc: defaultResolve,
  storeImage: defaultStore,
});

type DeckProviderProps = {
  children: ReactNode;
  folderName?: string | null;
  handle?: FileSystemDirectoryHandle | null;
  metadata?: DeckMetadata | null;
  resolveImageSrc?: (src: string) => Promise<string>;
  storeImage?: (file: File) => Promise<string>;
};

export function DeckProvider({
  children,
  folderName = null,
  handle = null,
  metadata = null,
  resolveImageSrc,
  storeImage,
}: DeckProviderProps) {
  const value = useMemo<DeckContextValue>(
    () => ({
      mode: folderName && handle ? "library" : "ephemeral",
      folderName,
      handle,
      metadata,
      resolveImageSrc: resolveImageSrc ?? defaultResolve,
      storeImage: storeImage ?? defaultStore,
    }),
    [folderName, handle, metadata, resolveImageSrc, storeImage],
  );

  return <DeckContext.Provider value={value}>{children}</DeckContext.Provider>;
}

export function useDeckContext(): DeckContextValue {
  return useContext(DeckContext);
}

export function useDeckImageResolver() {
  const { resolveImageSrc, storeImage, mode } = useDeckContext();
  return { resolveImageSrc, storeImage, isLibraryDeck: mode === "library" };
}

export function useOptionalDeckHandle(): FileSystemDirectoryHandle | null {
  return useContext(DeckContext).handle;
}
