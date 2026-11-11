import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { LoadedDocument } from "./types";

const SUPPORTED = new Set([".pdf", ".txt", ".md", ".markdown"]);

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Belirtilen klasördeki desteklenen tüm dokümanları okur ve metne çevirir. */
export async function loadDocuments(dir: string): Promise<LoadedDocument[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const docs: LoadedDocument[] = [];
  for (const entry of entries.sort()) {
    const full = path.join(dir, entry);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile()) continue;
      const ext = path.extname(entry).toLowerCase();
      if (!SUPPORTED.has(ext)) continue;

      let text = "";
      if (ext === ".pdf") {
        text = await readPdf(full);
      } else {
        text = await fs.readFile(full, "utf8");
      }

      text = text.trim();
      if (!text) continue;
      docs.push({
        name: entry,
        text,
        hash: sha256(text),
        chars: text.length,
      });
    } catch (err) {
      console.error(`[rag] ${entry} okunamadı:`, err);
    }
  }
  return docs;
}

type PdfParseFn = (buffer: Buffer) => Promise<{ text?: string }>;

async function readPdf(file: string): Promise<string> {
  const dataBuffer = await fs.readFile(file);
  // pdf-parse index.js debug moduna girebildiğinden doğrudan lib alt modülü kullanılır.
  const mod = (await import("pdf-parse/lib/pdf-parse.js")) as unknown as
    | PdfParseFnModule
    | { default: PdfParseFnModule };
  const pdfParse: PdfParseFnModule =
    typeof mod === "function" ? mod : mod.default;
  const result = await pdfParse(dataBuffer);
  return result?.text ?? "";
}

type PdfParseFnModule = (buffer: Buffer) => Promise<{ text?: string }>;
