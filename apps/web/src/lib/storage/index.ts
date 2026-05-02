export * from "./types";

export const CONVEX_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const SUPPORTED_FORMATS: Record<string, string> = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "audio/x-m4a": "audio",
  "video/mp4": "video",
  "video/webm": "video",
  "text/markdown": "markdown",
  "text/x-markdown": "markdown",
  // .md files thường được detect là text/plain
  "text/plain": "markdown",
  "text/html": "web_clip",
  "application/xhtml+xml": "web_clip",
};

export const SUPPORTED_EXTENSIONS: Record<string, string> = {
  ".pdf": "pdf",
  ".epub": "epub",
  ".docx": "docx",
  ".pptx": "pptx",
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".gif": "image",
  ".mp3": "audio",
  ".m4a": "audio",
  ".wav": "audio",
  ".mp4": "video",
  ".webm": "video",
  ".md": "markdown",
  ".markdown": "markdown",
  ".html": "web_clip",
  ".htm": "web_clip",
  ".xhtml": "web_clip",
};

export function detectFormat(file: File): string | null {
  // Thử MIME type trước
  if (file.type && SUPPORTED_FORMATS[file.type]) {
    return SUPPORTED_FORMATS[file.type];
  }
  // Fallback theo extension
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS[ext] ?? null;
}

/**
 * Upload file lên storage backend đúng.
 * - ≤5MB → Convex (uploadUrl từ Convex action)
 * - >5MB → R2 (presigned PUT URL từ Convex action)
 */
export async function uploadFile(
  file: File,
  uploadUrl: string,
  storageBackend: "convex" | "r2",
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (storageBackend === "convex") {
          // Convex trả về { storageId } trong body
          try {
            const res = JSON.parse(xhr.responseText);
            resolve(res.storageId ?? "");
          } catch {
            resolve("");
          }
        } else {
          // R2: storageKey đã biết trước
          resolve("");
        }
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Upload network error")));

    xhr.open("POST", uploadUrl);
    if (storageBackend === "convex") {
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    } else {
      // R2 presigned PUT
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    }
    xhr.send(file);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
