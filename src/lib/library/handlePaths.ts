/** Maps directory handles to OPFS path segments (from navigator.storage root). */
const handlePaths = new WeakMap<FileSystemDirectoryHandle, string[]>();

export function registerHandlePath(
  handle: FileSystemDirectoryHandle,
  segments: string[],
): void {
  handlePaths.set(handle, segments);
}

export function registerChildHandle(
  parent: FileSystemDirectoryHandle,
  child: FileSystemDirectoryHandle,
  childName: string,
): void {
  const parentPath = handlePaths.get(parent);
  if (parentPath) {
    registerHandlePath(child, [...parentPath, childName]);
  }
}

export function getHandlePath(
  handle: FileSystemDirectoryHandle,
): string[] | undefined {
  return handlePaths.get(handle);
}
