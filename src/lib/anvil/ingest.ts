import { fnv1a, merkleRoot } from "./hash.ts";
import type { IngestedBundle, VirtualFile } from "./types.ts";

const MAX_FILES = 240;
const MAX_FILE_BYTES = 80_000;
const MAX_BUNDLE_BYTES = 1_200_000;

function clip(content: string): string {
  if (content.length <= MAX_FILE_BYTES) return content;
  return content.slice(0, MAX_FILE_BYTES);
}

/** O(n) — normalize raw path/content pairs into a hashed bundle. */
export function ingestFiles(
  name: string,
  origin: IngestedBundle["origin"],
  raw: { path: string; content: string }[],
  now = Date.now(),
): IngestedBundle {
  const files: VirtualFile[] = [];
  let bytes = 0;
  for (const item of raw.slice(0, MAX_FILES)) {
    const path = String(item.path || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .slice(0, 240);
    if (!path || path.includes("..")) continue;
    const content = clip(String(item.content ?? ""));
    const size = content.length;
    if (bytes + size > MAX_BUNDLE_BYTES) break;
    bytes += size;
    files.push({ path, content, size, hash: fnv1a(path + "\0" + content) });
  }
  return {
    name: name.slice(0, 80) || "bundle",
    origin,
    files,
    merkle: merkleRoot(files),
    bytes,
    ingestedAt: now,
  };
}

const BLOCK = /(?:^|\n)===+\s*\n/;
const HEAD = /^(?:\/\/\s*)?([^\n]+)\n---+\n/;

/** Parse `path\n---\ncontent\n===\npath\n---\ncontent` paste format. O(n). */
export function parsePasteTree(text: string): { path: string; content: string }[] {
  const chunks = text.split(BLOCK).map((s) => s.trim()).filter(Boolean);
  const out: { path: string; content: string }[] = [];
  for (const chunk of chunks) {
    const m = chunk.match(HEAD);
    if (m) {
      out.push({ path: m[1].trim(), content: chunk.slice(m[0].length) });
    } else if (chunk.includes("\n")) {
      const i = chunk.indexOf("\n");
      out.push({ path: chunk.slice(0, i).trim(), content: chunk.slice(i + 1) });
    } else {
      out.push({ path: "paste.txt", content: chunk });
    }
  }
  return out;
}

export async function filesFromDrop(list: FileList | File[]): Promise<{ path: string; content: string }[]> {
  const files = Array.from(list).slice(0, MAX_FILES);
  const out: { path: string; content: string }[] = [];
  for (const file of files) {
    const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (file.size > MAX_FILE_BYTES * 2) continue;
    const content = await file.text().catch(() => "");
    out.push({ path, content });
  }
  return out;
}
