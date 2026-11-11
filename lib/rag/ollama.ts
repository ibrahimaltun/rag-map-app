import { config } from "./config";

export class OllamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaError";
  }
}

function friendlyNetworkError(err: unknown, action: string): never {
  if (err instanceof OllamaError) throw err;
  throw new OllamaError(
    `Ollama sunucusuna ulaşılamadı (${config.ollamaBaseUrl}). ` +
      `Terminalde \`ollama serve\` komutunun çalıştığından ve ilgili modellerin ` +
      `\`ollama pull <model>\` ile indirildiğinden emin olun. (${action}: ${
        err instanceof Error ? err.message : String(err)
      })`
  );
}

export interface OllamaTag {
  name: string;
  model: string;
}

/** Ollama erişilebilir mi ve hangi modeller kurulu? */
export async function ollamaInfo(): Promise<{
  reachable: boolean;
  models: string[];
}> {
  try {
    const res = await fetch(`${config.ollamaBaseUrl}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { reachable: false, models: [] };
    const data = (await res.json()) as { models?: OllamaTag[] };
    const models = (data.models ?? []).map((m) => m.name);
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

function modelExists(models: string[], name: string): boolean {
  const base = name.replace(/:latest$/, "");
  return models.some(
    (m) => m === name || m.replace(/:latest$/, "") === base
  );
}

/** Hem erişim hem model kurulumu kontrolü. */
export async function ensureOllamaReady(): Promise<void> {
  const { reachable, models } = await ollamaInfo();
  if (!reachable) {
    throw new OllamaError(
      `Ollama sunucusuna ulaşılamadı (${config.ollamaBaseUrl}). ` +
        `\`ollama serve\` komutunun çalıştığından emin olun.`
    );
  }
  const missing = [config.chatModel, config.embedModel].filter(
    (m) => !modelExists(models, m)
  );
  if (missing.length > 0) {
    throw new OllamaError(
      `Gerekli model(ler) Ollama'da kurulu değil: ${missing.join(", ")}. ` +
        `Şu komutları çalıştırın: ${missing
          .map((m) => `\`ollama pull ${m}\``)
          .join(" ve ")}`
    );
  }
}

/** Metinleri embedding vektörlerine çevirir (batch hâlinde). */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += config.embedBatchSize) {
    const batch = texts.slice(i, i + config.embedBatchSize);
    let res: Response;
    try {
      res = await fetch(`${config.ollamaBaseUrl}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.embedModel, input: batch }),
        signal: AbortSignal.timeout(120000),
      });
    } catch (err) {
      friendlyNetworkError(err, "embed");
    }
    if (!res!.ok) {
      throw new OllamaError(
        `Embedding isteği başarısız (HTTP ${res!.status}): ${await res!
          .text()
          .catch(() => "")}`
      );
    }
    const data = (await res!.json()) as { embeddings?: number[][] };
    if (!data.embeddings || data.embeddings.length !== batch.length) {
      throw new OllamaError("Ollama'dan beklenmeyen embedding yanıtı alındı.");
    }
    out.push(...data.embeddings);
  }
  return out;
}

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatStreamPart {
  content: string;
  done: boolean;
}

/** Ollama /api/chat akışını (NDJSON) async generator olarak üretir. */
export async function* chatStream(
  messages: OllamaChatMessage[]
): AsyncGenerator<ChatStreamPart> {
  let res: Response;
  try {
    res = await fetch(`${config.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.chatModel,
        messages,
        stream: true,
        options: {
          temperature: config.temperature,
          num_predict: config.maxTokens,
        },
      }),
    });
  } catch (err) {
    friendlyNetworkError(err, "chat");
  }
  if (!res!.ok || !res!.body) {
    const detail = await res!.text().catch(() => "");
    throw new OllamaError(
      `Sohbet isteği başarısız (HTTP ${res!.status}): ${detail.slice(0, 300)}`
    );
  }

  const reader = res!.body.getReader();
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
      let parsed: {
        message?: { content?: string };
        done?: boolean;
        error?: string;
      };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (parsed.error) {
        throw new OllamaError(`Ollama hatası: ${parsed.error}`);
      }
      yield {
        content: parsed.message?.content ?? "",
        done: parsed.done ?? false,
      };
    }
  }
}
