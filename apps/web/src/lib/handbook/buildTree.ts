import { Id } from "@/_generated/dataModel";

export interface HandbookFile {
  docId: Id<"documents">;
  relPath: string;
  format: string;
  title: string;
  progressPct: number | null;
}

export interface FileNode {
  type: "file";
  name: string;
  relPath: string;
  docId: Id<"documents">;
  format: string;
  progressPct: number | null;
}

export interface FolderNode {
  type: "folder";
  name: string;
  path: string; // prefix path từ gốc handbook, vd "assets/img"
  children: TreeNode[];
}

export type TreeNode = FolderNode | FileNode;

/** So sánh tự nhiên: ưu tiên tiền tố số (00-, 01-, 10-), fallback localeCompare numeric. */
export function naturalCompare(a: string, b: string): number {
  const na = a.match(/^(\d+)/);
  const nb = b.match(/^(\d+)/);
  if (na && nb) {
    const diff = parseInt(na[1], 10) - parseInt(nb[1], 10);
    if (diff !== 0) return diff;
  } else if (na && !nb) {
    return -1; // file đánh số lên trước
  } else if (!na && nb) {
    return 1;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  // Folder trước file, mỗi nhóm sort tự nhiên theo tên
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return naturalCompare(a.name, b.name);
  });
  for (const n of nodes) {
    if (n.type === "folder") sortNodes(n.children);
  }
  return nodes;
}

/**
 * Dựng cây từ danh sách file (relPath) + folder rỗng (emptyFolders prefix).
 */
export function buildTree(files: HandbookFile[], emptyFolders: string[] = []): TreeNode[] {
  const root: FolderNode = { type: "folder", name: "", path: "", children: [] };

  function ensureFolder(segments: string[]): FolderNode {
    let cur = root;
    let acc = "";
    for (const seg of segments) {
      acc = acc ? `${acc}/${seg}` : seg;
      let next = cur.children.find(
        (c): c is FolderNode => c.type === "folder" && c.name === seg
      );
      if (!next) {
        next = { type: "folder", name: seg, path: acc, children: [] };
        cur.children.push(next);
      }
      cur = next;
    }
    return cur;
  }

  // Folder rỗng
  for (const prefix of emptyFolders) {
    const segs = prefix.split("/").filter(Boolean);
    if (segs.length) ensureFolder(segs);
  }

  // File
  for (const f of files) {
    const segs = f.relPath.split("/").filter(Boolean);
    const name = segs.pop() ?? f.relPath;
    const folder = segs.length ? ensureFolder(segs) : root;
    folder.children.push({
      type: "file",
      name,
      relPath: f.relPath,
      docId: f.docId,
      format: f.format,
      progressPct: f.progressPct,
    });
  }

  return sortNodes(root.children);
}

/** Tập folder-path tổ tiên của 1 file (để auto-expand khi file active). */
export function ancestorPaths(relPath: string): string[] {
  const segs = relPath.split("/").filter(Boolean);
  segs.pop();
  const out: string[] = [];
  let acc = "";
  for (const s of segs) {
    acc = acc ? `${acc}/${s}` : s;
    out.push(acc);
  }
  return out;
}
