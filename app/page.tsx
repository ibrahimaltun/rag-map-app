"use client";

import dynamic from "next/dynamic";
import RagChat from "@/components/rag/RagChat";

/**
 * Leaflet yalnızca tarayıcıda çalışabildiği için harita bileşeni
 * SSR olmadan, dinamik olarak yüklenir.
 */
const MapView = dynamic(() => import("@/components/map/MapView"), {
  ssr: false,
  loading: () => <div className="map-loading">🗺️ Harita yükleniyor…</div>,
});

export default function Home() {
  return (
    <main className="page">
      {/* Tam ekran harita arayüzü */}
      <MapView />

      {/* Haritadan bağımsız overlay bilgi kartı */}
      <div className="map-legend">
        <h1>🗺️ RAG Harita Asistanı</h1>
        <p>
          Yerel Ollama modelleri (qwen2.5:3b + nomic-embed-text) ile çalışan
          doküman soru-cevap sistemi. Sağ alttaki buton ile doküman hakkında
          soru sorabilirsiniz.
        </p>
        <span className="legend-tag">İstanbul · OpenStreetMap</span>
      </div>

      {/**
       * ANA SAYFAYA IMPORT EDİLEN CUSTOM COMPONENT:
       * Haritadan bağımsız, yüksek z-index katmanında çalışan
       * doküman soru-cevap paneli (buton + sohbet ekranı).
       */}
      <RagChat />
    </main>
  );
}
