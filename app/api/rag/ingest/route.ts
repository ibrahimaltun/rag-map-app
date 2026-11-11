import { NextResponse } from "next/server";
import { indexDocuments } from "@/lib/rag/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dokümanları yeniden indeksler (chunk → embedding → vektör deposu). */
export async function POST() {
  try {
    const result = await indexDocuments(true);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Bilinmeyen indeksleme hatası";
    console.error("[rag] ingest hatası:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
