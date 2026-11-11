/**
 * RAG pipeline merkezi yapılandırması.
 * Tüm değerler ortam değişkenleriyle geçilebilir; varsayılanlar tipik bir
 * tüketici bilgisayarında sorunsuz çalışacak şekilde seçilmiştir.
 */
export const config = {
  /** Ollama API adresi */
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  /**
   * Sohbet modeli: qwen2.5 (3B, Q4_K_M, ~1.9GB) — tüketici bilgisayarlarında
   * CPU/GPU ile rahatça çalışan, Türkçe dahil çok dilli yanıtlarda güçlü model.
   * Alternatif: RAG_CHAT_MODEL=llama3.2 (daha hafif, İngilizce ağırlıklı).
   */
  chatModel: process.env.RAG_CHAT_MODEL ?? "qwen2.5:3b",
  /** Embedding modeli: nomic-embed-text (137M, ~274MB) küçük ve hızlıdır. */
  embedModel: process.env.RAG_EMBED_MODEL ?? "nomic-embed-text",
  /** Indekslenecek dokümanların bulunduğu klasör (proje köküne göre) */
  documentsDir: process.env.RAG_DOCS_DIR ?? "data/documents",
  /** Vektör deposu JSON dosyası */
  storePath: process.env.RAG_STORE_PATH ?? "data/vector-store.json",
  /** Hedef parça (chunk) boyutu — karakter */
  chunkTargetChars: 1200,
  /** Parçalar arası örtüşme — karakter */
  chunkOverlapChars: 180,
  /** Sorgu için geri getirilecek en benzer parça sayısı */
  topK: 4,
  /** Embedding API'sine tek istekte gönderilecek parça sayısı */
  embedBatchSize: 16,
  /** Sohbet modeli üretim ayarları */
  temperature: 0.2,
  maxTokens: 512,
} as const;
