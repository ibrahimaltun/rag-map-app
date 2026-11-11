import { NextResponse } from "next/server";
import { config } from "@/lib/rag/config";
import { loadDocuments } from "@/lib/rag/loader";
import { ollamaInfo } from "@/lib/rag/ollama";
import { readStore } from "@/lib/rag/vectorStore";
import type { RagStatus } from "@/lib/rag/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(name: string): string {
  return name.replace(/:latest$/, "");
}

export async function GET() {
  const [store, docs, info] = await Promise.all([
    readStore(),
    loadDocuments(config.documentsDir),
    ollamaInfo(),
  ]);

  const required = [config.chatModel, config.embedModel].map(normalize);
  const installed = info.models.map(normalize);
  const missingModels = required.filter((m) => !installed.includes(m));

  const status: RagStatus = {
    ok: true,
    indexed: Boolean(store && store.chunks.length > 0),
    chunkCount: store?.chunks.length ?? 0,
    documents: docs.map((d) => d.name),
    chatModel: config.chatModel,
    embedModel: config.embedModel,
    ollamaUrl: config.ollamaBaseUrl,
    ollamaReachable: info.reachable,
    hasChatModel: !missingModels.includes(normalize(config.chatModel)),
    hasEmbedModel: !missingModels.includes(normalize(config.embedModel)),
    missingModels,
  };

  return NextResponse.json(status);
}
