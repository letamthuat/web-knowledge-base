/**
 * Minimal TAR parser (POSIX/GNU ustar format) for browser use.
 * Handles regular files, long name extensions (GNU LongName), and UStar prefix.
 */

export interface TarEntry {
  path: string;
  data: Uint8Array;
}

const dec = new TextDecoder("utf-8");

function readStr(buf: Uint8Array, offset: number, len: number): string {
  const slice = buf.subarray(offset, offset + len);
  const nul = slice.indexOf(0);
  return dec.decode(nul >= 0 ? slice.subarray(0, nul) : slice);
}

function readOctal(buf: Uint8Array, offset: number, len: number): number {
  const s = readStr(buf, offset, len).trim();
  return s ? parseInt(s, 8) : 0;
}

/** Decompress a GZIP buffer using the browser DecompressionStream API. */
export async function gunzipBrowser(input: ArrayBuffer): Promise<ArrayBuffer> {
  // @ts-ignore — DecompressionStream is standard in all modern browsers
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(input);
  writer.close();
  // @ts-ignore
  return new Response(ds.readable).arrayBuffer();
}

export function parseTar(buffer: ArrayBuffer): TarEntry[] {
  const bytes = new Uint8Array(buffer);
  const results: TarEntry[] = [];
  let offset = 0;
  let pendingLongName: string | null = null;

  while (offset + 512 <= bytes.length) {
    const hdr = bytes.subarray(offset, offset + 512);

    // Two consecutive zero blocks = end of archive
    if (hdr.every((b) => b === 0)) break;

    const typeFlag = String.fromCharCode(hdr[156]);
    const rawName = readStr(hdr, 0, 100);
    const size = readOctal(hdr, 124, 12);

    // GNU long name extension: next block has the full path
    if (typeFlag === "L") {
      const nameBytes = bytes.subarray(offset + 512, offset + 512 + size);
      pendingLongName = dec.decode(nameBytes).replace(/\0.*$/, "");
      offset += 512 + Math.ceil(size / 512) * 512;
      continue;
    }

    // Build full path (ustar prefix + name, or GNU longname override)
    let path: string;
    if (pendingLongName !== null) {
      path = pendingLongName;
      pendingLongName = null;
    } else {
      const magic = readStr(hdr, 257, 6); // "ustar"
      const prefix = magic.startsWith("ustar") ? readStr(hdr, 345, 155) : "";
      path = prefix ? `${prefix}/${rawName}` : rawName;
    }

    // Clean path
    path = path.replace(/^\.\//, "").replace(/\0.*$/, "");

    offset += 512; // past header

    const isRegular = typeFlag === "0" || typeFlag === "\0" || typeFlag === "";
    if (isRegular && size > 0 && path && !path.endsWith("/")) {
      const data = bytes.slice(offset, offset + size);
      results.push({ path, data });
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return results;
}
