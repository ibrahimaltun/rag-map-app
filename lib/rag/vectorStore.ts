import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "./config";
import type { LoadedDocument, StoreFile } from "./types";

export async function readStore(): Promise<StoreFile | null> {
  try {
    const raw = await fs.readFile(config.storePath, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (parsed?.version !== 1 || !Array.isArray(parsed.chunks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeStore(store: StoreFile): Promise<void> {
  await fs.mkdir(path.dirname(config.storePath), { recursive: true });
  await fs.writeFile(config.storePath, JSON.stringify(store), "utf8");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Depo, o anki doküman seti ve embedding modeli ile güncel mi?
 * Doküman ekleme/çıkarma/değiştirme durumunda yeniden indeksleme tetiklenir.
 */
export function isStoreUpToDate(
  store: StoreFile | null,
  docs: LoadedDocument[]
): boolean {
  if (!store) return false;
  if (store.embedModel !== config.embedModel) return false;
  if (store.chunks.length === 0) return false;
  if (Object.keys(store.docHashes).length !== docs.length) return false;
  return docs.every((d) => store.docHashes[d.name] === d.hash);
}
