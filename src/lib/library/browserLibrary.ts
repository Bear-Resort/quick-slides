import {
  isDiskFolderPickerSupported,
  isOriginPrivateFilesystemSupported,
} from "@/lib/library/fsAccess";

/** Chromium desktop browsers that can pick a real folder on disk (Chrome, Edge, …). */
export function isChromiumWithDiskPicker(): boolean {
  return isDiskFolderPickerSupported();
}

/**
 * Browsers without a disk folder picker (Safari, Firefox, …) store the library
 * in browser-managed storage (OPFS), not on the user's filesystem.
 */
export function usesBrowserStorageLibrary(): boolean {
  return !isChromiumWithDiskPicker() && isOriginPrivateFilesystemSupported();
}
