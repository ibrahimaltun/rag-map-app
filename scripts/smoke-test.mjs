#!/usr/bin/env node
/**
 * Uçtan uca smoke test:
 *   1. /api/rag/status  → Ollama erişimi, model kurulumu ve indeks durumu
 *   2. /api/rag/ingest  → (gerekirse) doküman → chunk → embedding → vektör deposu
 *   3. /api/rag/ask     → EN ve TR sorular, NDJSON akışının çözümlenmesi
 *
 * Kullanım:
 *   npm start -- -p 3100   (ayrı terminalde)
 *   node scripts/smoke-test.mjs
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3100";

let failures = 0;
function check(name, cond, extra = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failures++;
}

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`${path} -> HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** /api/rag/ask NDJSON akışını tüketip yanıt ve kaynakları döndürür. */
async function ask(question) {
  const res = await fetch(`${BASE}/api/rag/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    throw new Error(`/api/rag/ask -> HTTP ${res.status}: ${await res.text()}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let sources = [];
  let sawDone = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let i;
    while ((i = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, i).trim();
      buffer = buffer.slice(i + 1);
      if (!line) continue;
      const evt = JSON.parse(line);
      if (evt.t === "token") answer += evt.v;
      else if (evt.t === "sources") sources = evt.v;
      else if (evt.t === "done") sawDone = true;
      else if (evt.t === "error") throw new Error(`Akış hatası: ${evt.v}`);
    }
  }
  return { answer, sources, sawDone };
}

console.log(`🔍 Smoke test başlıyor: ${BASE}\n`);

// 1) Durum kontrolü
const status = await getJson("/api/rag/status");
check("Status endpoint çalışıyor", status.ok === true);
check("Ollama erişilebilir", status.ollamaReachable === true, status.ollamaUrl);
check(
  "Sohbet modeli kurulu",
  status.hasChatModel === true,
  status.chatModel
);
check(
  "Embedding modeli kurulu",
  status.hasEmbedModel === true,
  status.embedModel
);
check(
  "Doküman bulundu",
  Array.isArray(status.documents) && status.documents.length > 0,
  (status.documents ?? []).join(", ")
);

// 2) Indeks kontrolü (yoksa ingest tetikle)
if (!status.indexed) {
  console.log("ℹ️  Indeks yok — /api/rag/ingest tetikleniyor (birkaç sn sürebilir)…");
  const ingRes = await fetch(`${BASE}/api/rag/ingest`, { method: "POST" });
  const ing = await ingRes.json();
  check("Ingest başarılı", ingRes.ok && ing.ok === true, `${ing.chunkCount} parça`);
} else {
  check("Indeks hazır", true, `${status.chunkCount} parça`);
}

// 3) İngilizce soru
console.log("\n→ EN soru: What is the title of this document and what architecture does it introduce?");
const en = await ask("What is the title of this document and what architecture does it introduce?");
console.log(`   Yanıt (${en.answer.length} karakter): ${en.answer.slice(0, 260)}…`);
check("EN soru yanıtlandı", en.answer.trim().length > 10);
check("EN akış 'done' olayı alındı", en.sawDone === true);
check("EN kaynak parçaları döndü", en.sources.length > 0, `${en.sources.length} kaynak`);
check(
  "EN kaynak formatı doğru",
  en.sources.every((s) => typeof s.source === "string" && typeof s.score === "number" && typeof s.excerpt === "string")
);

// 4) Türkçe soru
console.log("\n→ TR soru: Bu makalede önerilen mimarinin adı nedir?");
const tr = await ask("Bu makalede önerilen mimarinin adı nedir?");
console.log(`   Yanıt (${tr.answer.length} karakter): ${tr.answer.slice(0, 260)}…`);
check("TR soru yanıtlandı", tr.answer.trim().length > 10);
check("TR kaynak parçaları döndü", tr.sources.length > 0, `${tr.sources.length} kaynak`);

// 5) Doküman dışı soru → model 'bulamadım' tarzı yanıt vermeli (halüsinasyon kontrolü değil,
//    sadece akışın çalıştığını doğrular)
console.log("\n→ Ekstra soru: What is the capital city of France according to the document?");
const extra = await ask("What is the capital city of France according to the document?");
console.log(`   Yanıt: ${extra.answer.slice(0, 220)}…`);
check("Doküman dışı soru da güvenli işlendi", extra.answer.trim().length > 0 && extra.sawDone === true);

console.log(`\n${failures === 0 ? "🎉 TÜM TESTLER GEÇTİ" : `⚠️  ${failures} test başarısız`}`);
process.exit(failures === 0 ? 0 : 1);
