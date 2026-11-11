"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

/** Harita üzerinde gösterilecek örnek noktalar */
const MARKERS: { lat: number; lng: number; label: string; emoji: string }[] = [
  { lat: 41.0086, lng: 28.98, label: "Ayasofya", emoji: "🏛️" },
  { lat: 41.0054, lng: 28.9768, label: "Kapalıçarşı", emoji: "🛍️" },
  { lat: 41.0256, lng: 28.9744, label: "Galata Kulesi", emoji: "🗼" },
  { lat: 41.0424, lng: 29.0088, label: "Boğaziçi Köprüsü", emoji: "🌉" },
];

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [41.0151, 28.9795], // İstanbul
        zoom: 12,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap katkıcıları",
      }).addTo(map);

      const pinIcon = (emoji: string) =>
        L.divIcon({
          className: "custom-pin",
          html: `<div class="pin"><span>${emoji}</span></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -28],
        });

      for (const m of MARKERS) {
        L.marker([m.lat, m.lng], { icon: pinIcon(m.emoji) })
          .addTo(map)
          .bindPopup(`<strong>${m.label}</strong>`);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className="map-canvas" aria-label="Harita" />;
}
