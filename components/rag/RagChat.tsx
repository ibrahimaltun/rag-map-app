"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, RagStatus, SourceRef } from "@/lib/rag/types";
import "./rag-chat.css";

const SUGGESTIONS = [
  "Bu doküman ne anlatıyor?",
  "Makalenin ana katkısı nedir?",
  "Transformer mimarisinin temel bileşenleri nelerdir?",
];

/**
 * CUSTOM COMPONENT: Doküman Soru-Cevap Paneli
 * -------------------------------------------
 * Ana sayfaya (app/page.tsx) import edilir. Tam ekran haritanın ÜSTÜNDE,
 * Haritadan bağımsız bir katmanda (z-index: 1250 > Leaflet pane z-index'leri)
 * konumlanır. Sağ alttaki butona tıklayınca RAG soru-cevap ekranı açılır;
 * sorular /api/rag/ask üzerinden Ollama (qwen2.5:3b + nomic-embed-text)
 * modellerine gider ve yanıt akış hâlinde (NDJSON) gösterilir.
 */
export default function RagChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<RagStatus | null>(null);
  const [indexing, setIndexing] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/rag/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const appendToken = useCallback((token: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const idx = copy.length - 1;
      copy[idx] = { ...copy[idx], content: copy[idx].content + token };
      return copy;
    });
  }, []);

  const setSources = useCallback((sources: SourceRef[]) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const idx = copy.length - 1;
      if (copy[idx].role !== "assistant") return prev;
      copy[idx] = { ...copy[idx], sources };
      return copy;
    });
  }, []);

  const markError = useCallback((message: string) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const idx = copy.length - 1;
      if (copy[idx].role !== "assistant") return prev;
      copy[idx] = {
        ...copy[idx],
        content: copy[idx].content || `⚠️ ${message}`,
        error: !copy[idx].content,
      };
      return copy;
    });
  }, []);

  const send = useCallback(
    async (rawQuestion?: string) => {
      const question = (rawQuestion ?? input).trim();
      if (!question || busy) return;
      setInput("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: question },
        { role: "assistant", content: "" },
      ]);
      setBusy(true);
      try {
        const res = await fetch("/api/rag/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? `Sunucu hatası (HTTP ${res.status})`);
        }
        if (!res.body) throw new Error("Sunucu boş yanıt döndürdü.");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const evt = JSON.parse(line) as {
              t: "token" | "sources" | "done" | "error";
              v?: string | SourceRef[];
            };
            if (evt.t === "token" && typeof evt.v === "string") {
              appendToken(evt.v);
            } else if (evt.t === "sources" && Array.isArray(evt.v)) {
              setSources(evt.v as SourceRef[]);
            } else if (evt.t === "error") {
              throw new Error(
                typeof evt.v === "string" ? evt.v : "Akış hatası"
              );
            }
          }
        }
      } catch (err) {
        markError(err instanceof Error ? err.message : "Bilinmeyen hata");
      } finally {
        setBusy(false);
      }
    },
    [input, busy, appendToken, setSources, markError]
  );

  const reindex = useCallback(async () => {
    if (indexing) return;
    setIndexing(true);
    try {
      await fetch("/api/rag/ingest", { method: "POST" });
      const s = await fetch("/api/rag/status").then((r) => r.json());
      setStatus(s as RagStatus);
    } catch {
      // durum sessizce korunur
    } finally {
      setIndexing(false);
    }
  }, [indexing]);

  const statusLabel = buildStatusLabel(status, indexing);

  return (
    <div className="rag-root">
      {open ? (
        <section className="rag-panel" role="dialog" aria-label="Doküman soru-cevap paneli">
          <header className="rag-panel-header">
            <div className="rag-panel-title">
              <h2>📄 Doküman Asistanı</h2>
              <p title={statusLabel}>{statusLabel}</p>
            </div>
            <div className="rag-panel-actions">
              <button
                className="rag-icon-btn"
                onClick={reindex}
                disabled={indexing}
                title="Dokümanları yeniden indeksle"
                aria-label="Yeniden indeksle"
              >
                {indexing ? "⟳" : "♻"}
              </button>
              <button
                className="rag-icon-btn"
                onClick={() => setOpen(false)}
                title="Kapat"
                aria-label="Paneli kapat"
              >
                ✕
              </button>
            </div>
          </header>

          {status && !status.ollamaReachable ? (
            <div className="rag-warning">
              Ollama sunucusuna ulaşılamıyor. Terminalde{" "}
              <code>ollama serve</code> çalıştığından emin olun.
            </div>
          ) : null}
          {status && status.ollamaReachable && status.missingModels.length > 0 ? (
            <div className="rag-warning">
              Eksik model(ler): {status.missingModels.join(", ")}.{" "}
              <code>ollama pull &lt;model&gt;</code> ile indirin.
            </div>
          ) : null}

          <div className="rag-messages" ref={listRef}>
            {messages.length === 0 ? (
              <div className="rag-empty">
                <div className="rag-empty-icon">💬</div>
                <p>
                  İndekslenmiş doküman hakkında her şeyi sorabilirsiniz. Yanıtlar
                  yalnızca doküman içeriğine dayanır.
                </p>
                <div className="rag-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      className="rag-suggestion"
                      onClick={() => void send(s)}
                      disabled={busy}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="rag-msg rag-msg-user">
                    {m.content}
                  </div>
                ) : (
                  <div
                    key={i}
                    className={`rag-msg rag-msg-assistant${m.error ? " rag-msg-error" : ""}`}
                  >
                    {m.content || (busy ? <span className="rag-typing">Düşünüyor…</span> : "")}
                    {m.sources && m.sources.length > 0 ? (
                      <details className="rag-sources">
                        <summary>📚 Kaynak parçalar ({m.sources.length})</summary>
                        <ul>
                          {m.sources.map((s, j) => (
                            <li key={j}>
                              <div className="rag-source-meta">
                                <span>{s.source} · parça #{s.index}</span>
                                <span>{(s.score * 100).toFixed(1)}% benzerlik</span>
                              </div>
                              <p>{s.excerpt}</p>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </div>
                )
              )
            )}
          </div>

          <form
            className="rag-input-row"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              ref={inputRef}
              className="rag-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Doküman hakkında bir soru yaz…"
              disabled={busy}
              maxLength={500}
            />
            <button
              type="submit"
              className="rag-send-btn"
              disabled={busy || !input.trim()}
            >
              {busy ? "…" : "Gönder"}
            </button>
          </form>
        </section>
      ) : (
        <button
          className="rag-open-btn"
          onClick={() => setOpen(true)}
          aria-label="Doküman soru-cevap ekranını aç"
        >
          <span className="rag-open-btn-icon">💬</span>
          <span className="rag-open-btn-text">Dokümana Sor</span>
        </button>
      )}
    </div>
  );
}

function buildStatusLabel(status: RagStatus | null, indexing: boolean): string {
  if (indexing) return "Yeniden indeksleniyor…";
  if (!status) return "Durum alınıyor…";
  if (!status.ollamaReachable) return "Ollama bağlantısı yok";
  const docPart =
    status.documents.length > 0
      ? status.documents.length === 1
        ? status.documents[0]
        : `${status.documents.length} doküman`
      : "doküman yok";
  const chunkPart = status.indexed ? `${status.chunkCount} parça` : "indeks yok";
  return `${status.chatModel} · ${docPart} · ${chunkPart}`;
}
