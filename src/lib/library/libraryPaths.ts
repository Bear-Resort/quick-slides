export const DEFAULT_LIBRARY_DIR_NAME = "qs-slides";
export const DEFAULT_LIBRARY_DISPLAY_PATH = "~/qs-slides";
export const LIBRARY_PICKER_ID = "quick-slides-library";
export const CUSTOM_LIBRARY_PICKER_ID = "quick-slides-custom-library";

export function getLibraryDisplayPath(
  handle: FileSystemDirectoryHandle | null | undefined,
): string {
  if (!handle) return DEFAULT_LIBRARY_DISPLAY_PATH;
  if (handle.name === DEFAULT_LIBRARY_DIR_NAME) {
    return DEFAULT_LIBRARY_DISPLAY_PATH;
  }
  return handle.name;
}
