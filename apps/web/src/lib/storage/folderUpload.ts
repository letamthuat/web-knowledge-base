export interface ExtractedFile {
  file?: File;
  relativePath: string; // ví dụ: "SubFolder/document.pdf"
  isEmptyDir?: boolean;
}

/**
 * Đệ quy duyệt qua một entry của hệ thống tệp tin trong trình duyệt (File hoặc Directory)
 */
async function traverseEntry(
  entry: any,
  path: string = ""
): Promise<ExtractedFile[]> {
  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file(
        (file: File) => {
          resolve([{ file, relativePath: path ? `${path}/${file.name}` : file.name }]);
        },
        (err: any) => reject(err)
      );
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    
    const readAllEntries = async (): Promise<any[]> => {
      const allEntries: any[] = [];
      const read = (): Promise<any[]> => {
        return new Promise((resolve, reject) => {
          dirReader.readEntries(
            (entries: any[]) => resolve(entries),
            (err: any) => reject(err)
          );
        });
      };
      
      let entries = await read();
      while (entries.length > 0) {
        allEntries.push(...entries);
        entries = await read();
      }
      return allEntries;
    };
    
    try {
      const entries = await readAllEntries();
      const newPath = path ? `${path}/${entry.name}` : entry.name;
      if (entries.length === 0) {
        return [{ relativePath: newPath, isEmptyDir: true }];
      }
      const results = await Promise.all(
        entries.map((childEntry) => traverseEntry(childEntry, newPath))
      );
      return results.flat();
    } catch (err) {
      console.error("Lỗi đọc thư mục:", err);
      return [];
    }
  }
  return [];
}

/**
 * Bóc tách danh sách file từ DataTransferItemList (kéo thả)
 */
export async function extractFilesFromItems(
  items: DataTransferItemList
): Promise<ExtractedFile[]> {
  const filePromises: Promise<ExtractedFile[]>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      const entry = typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null;
      if (entry) {
        filePromises.push(traverseEntry(entry));
      } else {
        const file = item.getAsFile();
        if (file) {
          filePromises.push(Promise.resolve([{ file, relativePath: file.name }]));
        }
      }
    }
  }
  const results = await Promise.all(filePromises);
  return results.flat();
}
