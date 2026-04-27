export type StorageBackend = "convex" | "r2" | "b2";

export interface UploadResult {
  storageBackend: StorageBackend;
  storageKey: string;
}

export interface StorageProvider {
  upload(
    file: File,
    options: {
      convexUploadUrl?: string;
      r2PresignedUrl?: string;
      storageKey?: string;
      onProgress?: (pct: number) => void;
    },
  ): Promise<UploadResult>;
  getDownloadUrl(storageBackend: StorageBackend, storageKey: string): Promise<string>;
}
