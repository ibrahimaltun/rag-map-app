export interface LoadedDocument {
  /** data/documents içindeki dosya adı */
  name: string;
  /** Çıkarılan düz metin */
  text: string;
  /** Metin içeriğinin SHA-256 özeti (değişiklik algılama için) */
  hash: string;
  chars: number;
}

export interface StoredChunk {
  id: string;
  source: string;
  index: number;
  text: string;
  embedding: number[];
}

export interface StoreFile {
  version: 1;
  embedModel: string;
  /** { "dokuman.pdf": "<sha256>" } */
  docHashes: Record<string, string>;
  chunks: StoredChunk[];
  createdAt: string;
}

export interface RetrievedChunk {
  chunk: StoredChunk;
  score: number;
}

export interface SourceRef {
  source: string;
  index: number;
  score: number;
  excerpt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  error?: boolean;
}

export interface RagStatus {
  ok: boolean;
  indexed: boolean;
  chunkCount: number;
  documents: string[];
  chatModel: string;
  embedModel: string;
  ollamaUrl: string;
  ollamaReachable: boolean;
  hasChatModel: boolean;
  hasEmbedModel: boolean;
  missingModels: string[];
}
