const STORAGE_PREFIX = "quick-slides/editor-image/";
export const EDITOR_IMAGE_URL_PREFIX = "qs-local://";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to read image"));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export async function storeEditorImage(file: File): Promise<string> {
  const id = crypto.randomUUID();
  const dataUrl = await readFileAsDataUrl(file);
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, dataUrl);
  } catch {
    throw new Error("Image is too large for local storage");
  }
  return `${EDITOR_IMAGE_URL_PREFIX}${id}`;
}

export function isEditorImageUrl(src: string): boolean {
  return src.startsWith(EDITOR_IMAGE_URL_PREFIX);
}

export function resolveEditorImageSrc(src: string): string {
  if (!isEditorImageUrl(src)) return src;
  const id = src.slice(EDITOR_IMAGE_URL_PREFIX.length);
  return localStorage.getItem(`${STORAGE_PREFIX}${id}`) ?? "";
}
