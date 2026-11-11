# 🗺️ RAG Harita Asistanı

Tam ekran **harita arayüzü** üzerine, haritadan bağımsız (z-index'li) bir butonla açılan
**doküman soru-cevap paneli** içeren, tamamen **yerel Ollama** modelleriyle çalışan bir
**RAG (Retrieval-Augmented Generation)** sistemi.

## Test Sonuçları

Son çalıştırma: 2026-11-04 · Port 3100 (production build) · Tüm testler ✅

| Test | Sonuç |
| --- | --- |
| `next build` (TypeScript + derleme) | ✅ Hatasız |
| `/api/rag/status` | ✅ Ollama erişilebilir, modeller kurulu |
| `/api/rag/ingest` | ✅ 40 parça, 768 boyutlu embedding, ~1.1 sn |
| EN soru (başlık/mimari) | ✅ Yanıt + 4 kaynak |
| TR soru (mimari adı) | ✅ "Transformer" + 4 kaynak |
| İçerik sorusu (multi-head attention) | ✅ Formülü kaynak parçasıyla (skor 0.737) yanıtladı |
| Doküman dışı soru | ✅ "Belgede bilgi yok" yanıtı (halüsinasyon koruması) |
| Ana sayfa render | ✅ Harita + özel bileşen (buton) HTML'de mevcut |
| Dev modu (`npm run dev`) | ✅ Çalışıyor |

Not: Varsayılan sohbet modeli Türkçe yanıtlar nedeniyle `qwen2.5:3b` olarak
seçildi; `llama3.2` ile karşılaştırıldığında belirgin daha iyi Türkçe üretti
(her ikisi de aynı ağırlık sınıfında, tüketici bilgisayarları için uygun).

## Mimari

```
data/documents/*.pdf|.txt|.md        ← RAG bilgi kaynağı (örnek doküman indirilmiştir)
        │
        ▼
lib/rag/loader.ts                    ← PDF/txt/md okuma (pdf-parse)
lib/rag/chunker.ts                   ← Paragraf/cümle duyarlı parçalama (+örtüşme)
lib/rag/ollama.ts                    ← Ollama API istemcisi (/api/embed, /api/chat)
lib/rag/vectorStore.ts               ← JSON tabanlı vektör deposu + kosinüs benzerliği
lib/rag/pipeline.ts                  ← lazy ingest → retrieval → sohbet akışı
        │
        ▼
app/api/rag/{status,ingest,ask}      ← Next.js API rotaları (NDJSON akış)
        │
        ▼
app/page.tsx ─ imports → components/rag/RagChat.tsx   ← CUSTOM COMPONENT (buton + panel)
             └ dynamic  → components/map/MapView.tsx  ← Leaflet harita (OSM döşemeleri)
```

**Modeller (verimlilik için seçildi):**

| Görev | Model | Boyut | Not |
| --- | --- | --- | --- |
| Sohbet | `qwen2.5:3b` (Q4_K_M) | ~1.9 GB | Tüketici cihazlarında CPU/GPU ile çalışır; Türkçe dahil çok dilli yanıtlarda güçlü |
| Embedding | `nomic-embed-text` (137M) | ~274 MB | Küçük ve hızlı, 768 boyutlu vektör |

Alternatif sohbet modeli: `llama3.2` (3.2B, ~2 GB) — `RAG_CHAT_MODEL=llama3.2` ile seçilir.

## Kurulum

Gereksinimler: **Node.js 18+** ve [Ollama](https://ollama.com).

```bash
# 1. Ollama modelleri (zaten kuruluysa atlayın)
ollama pull qwen2.5:3b
ollama pull nomic-embed-text

# 2. Bağımlılıklar
npm install

# 3. Geliştirme sunucusu
npm run dev            # http://localhost:3000

# veya üretim modu
npm run build && npm start
```

## Kullanım

1. Sayfa açıldığında tam ekran harita (İstanbul merkezli) görünür.
2. Sağ alttaki **💬 Dokümana Sor** butonuna tıklayın (harita üstünde z-index'li
   bağımsız katman).
3. Açılan panelde doküman hakkında soru sorun — ilk soruda doküman otomatik
   olarak indekslenir (chunk + embedding).
4. Her yanıtta kullanılan kaynak parçalar ve benzerlik skorları gösterilir.
   Panel başlığındaki **♻** butonu ile yeniden indeksleme yapılır.

## Dokümanı Değiştirme

`data/documents/` klasörüne yeni `.pdf`, `.txt` veya `.md` dosyası koyun ve
paneldeki ♦ yeniden indeksle (♻) butonuna basın (veya `curl -X POST
localhost:3000/api/rag/ingest`). Varsayılan örnek doküman: web'den indirilen
*“Attention Is All You Need”* (arXiv:1706.03762).

## Yapılandırma (ortam değişkenleri)

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API adresi |
| `RAG_CHAT_MODEL` | `llama3.2` | Sohbet modeli (ör. `qwen2.5:3b`) |
| `RAG_EMBED_MODEL` | `nomic-embed-text` | Embedding modeli |
| `RAG_DOCS_DIR` | `data/documents` | Doküman klasörü |
| `RAG_STORE_PATH` | `data/vector-store.json` | Vektör deposu dosyası |

## API

| Yöntem | Yol | Açıklama |
| --- | --- | --- |
| GET | `/api/rag/status` | Ollama/model/indeks durumu |
| POST | `/api/rag/ingest` | Yeniden indeksleme |
| POST | `/api/rag/ask` | `{ "question": "..." }` → NDJSON akışı: `{"t":"token"…}`, `{"t":"sources"…}`, `{"t":"done"}` |

## Test

```bash
npm start -- -p 3100     # ayrı terminalde (veya npm run dev)
node scripts/smoke-test.mjs    # status + ingest + EN/TR sorular
```

## Notlar

- Harita döşemeleri OpenStreetMap'ten canlı akar; çevrimdışıysa panel yine
  çalışır, yalnızca döşemeler boş görünür.
- Vektör arama, bağımlılık gerektirmeyen kosinüs benzerliği ile yapılır
  (tek/az sayıda doküman için ek altyapıya ihtiyaç bırakmaz).
