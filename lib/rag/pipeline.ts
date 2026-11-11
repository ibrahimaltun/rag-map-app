import { config } from "./config";
import { chunkText } from "./chunker";
import { loadDocuments } from "./loader";
import { embedTexts, chatStream, type OllamaChatMessage } from "./ollama";
import {
  cosineSimilarity,
  isStoreUpToDate,
  readStore,
  writeStore,
} from "./vectorStore";
import type { RetrievedChunk, StoreFile, StoredChunk } from "./types";

export type { RetrievedChunk };

export interface IndexResult {
  rebuilt: boolean;
  chunkCount: number;
  documents: string[];
}

/**
 * Dokümanları parçalar, embedding'lerini üretir ve vektör deposuna yazar.
 * Depo güncelse (dokümanlar değişmemişse) mevcut depo korunur.
 */
export async function indexDocuments(force = false): Promise<IndexResult> {
  const docs = await loadDocuments(config.documentsDir);
  const existing = await readStore();

  if (!force && isStoreUpToDate(existing, docs)) {
    return {
      rebuilt: false,
      chunkCount: existing!.chunks.length,
      documents: docs.map((d) => d.name),
    };
  }

  if (docs.length === 0) {
    throw new Error(
      `${config.documentsDir} klasöründe desteklenen doküman bulunamadı (.pdf, .txt, .md).`
    );
  }

  const pending: { source: string; index: number; text: string }[] = [];
  for (const doc of docs) {
    const parts = chunkText(
      doc.text,
      config.chunkTargetChars,
      config.chunkOverlapChars
    );
    parts.forEach((text, index) => pending.push({ source: doc.name, index, text }));
  }

  const embeddings = await embedTexts(pending.map((c) => c.text));
  const chunks: StoredChunk[] = pending.map((c, i) => ({
    id: `${c.source}#${c.index}`,
    source: c.source,
    index: c.index,
    text: c.text,
    embedding: embeddings[i],
  }));

  const docHashes: Record<string, string> = {};
  for (const d of docs) docHashes[d.name] = d.hash;

  const store: StoreFile = {
    version: 1,
    embedModel: config.embedModel,
    docHashes,
    chunks,
    createdAt: new Date().toISOString(),
  };
  await writeStore(store);

  return { rebuilt: true, chunkCount: chunks.length, documents: docs.map((d) => d.name) };
}

/** Sorgudan önce indeksin var olduğundan emin olur (lazy ingest). */
export async function ensureIndexed(): Promise<void> {
  await indexDocuments(false);
}

export async function retrieve(
  question: string,
  k = config.topK
): Promise<RetrievedChunk[]> {
  const store = await readStore();
  if (!store || store.chunks.length === 0) {
    throw new Error("Vektör deposu boş. Önce dokümanı indeksleyin.");
  }
  const [queryEmbedding] = await embedTexts([question]);
  return store.chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const SYSTEM_PROMPT = [
  "You are a document question-answering assistant running a RAG (Retrieval-Augmented Generation) pipeline.",
  "Answer strictly using ONLY the numbered context excerpts provided in the user message.",
  "If the excerpts do not contain enough information, say briefly that the answer is not in the document.",
  "Never use outside knowledge and never make up facts.",
  "Keep the answer concise, factual and helpful.",
  "Always answer in the same language the user asked in (Turkish question -> Turkish answer).",
].join(" ");

export function buildMessages(
  question: string,
  retrieved: RetrievedChunk[]
): { role: "system" | "user" | "assistant"; content: string }[] {
  const context = retrieved
    .map(
      (r, i) =>
        `[${i + 1}] (kaynak: ${r.chunk.source}, parça #${r.chunk.index})\n${r.chunk.text}`
    )
    .join("\n\n---\n\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Context excerpts from the document:\n\n${context}\n\n---\nQuestion: ${question}`,
    },
  ];
}

export interface AskEvents {
  onToken: (token: string) => void;
  onSources?: (sources: RetrievedChunk[]) => void;
}

/** Uçtan uca RAG akışı: lazy ingest → retrieval → Ollama sohbet akışı. */
export async function askStream(
  question: string,
  events: AskEvents
): Promise<void> {
  await indexDocuments(false);
  const retrieved = await retrieve(question);
  events.onSources?.(retrieved);
  const messages: OllamaChatMessage[] = buildMessages(question, retrieved);
  for await (const part of chatStream(messages)) {
    if (part.content) events.onToken(part.content);
    if (part.done) break;
  }
}
