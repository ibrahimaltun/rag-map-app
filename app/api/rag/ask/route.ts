import { NextResponse } from "next/server";
import { askStream } from "@/lib/rag/pipeline";
import type { SourceRef } from "@/lib/rag/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * NDJSON akışı döndürür:
 *   {"t":"token","v":"..."}     -> yanıt parçası
 *   {"t":"sources","v":[...]}   -> kullanılan döküman parçaları
 *   {"t":"done"}                -> akış bitti
 *   {"t":"error","v":"..."}     -> akış sırasında hata
 */
export async function POST(req: Request) {
  let question = "";
  try {
    const body = (await req.json()) as { question?: unknown };
    if (typeof body?.question === "string") question = body.question.trim();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Geçersiz istek gövdesi." },
      { status: 400 }
    );
  }

  if (!question) {
    return NextResponse.json(
      { ok: false, error: "Soru boş olamaz." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        await askStream(question, {
          onToken: (token) => send({ t: "token", v: token }),
          onSources: (retrieved) =>
            send({
              t: "sources",
              v: retrieved.map<SourceRef>((r) => ({
                source: r.chunk.source,
                index: r.chunk.index,
                score: Number(r.score.toFixed(4)),
                excerpt:
                  r.chunk.text.slice(0, 240) +
                  (r.chunk.text.length > 240 ? "…" : ""),
              })),
            }),
        });
        send({ t: "done" });
      } catch (err) {
        console.error("[rag] ask hatası:", err);
        send({
          t: "error",
          v: err instanceof Error ? err.message : "Bilinmeyen hata",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
