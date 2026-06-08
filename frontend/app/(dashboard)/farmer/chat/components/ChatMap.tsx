"use client";

import React, { useState, useRef, useEffect } from "react";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface MapData {
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  distance_km?: number;
  duration_min?: number;
  route_summary?: string;
}

export default function ChatMap({ mapData }: { mapData: MapData }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Fix Leaflet marker icons path issues in React
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      // Initialize map once
      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current!).setView([mapData.origin_lat, mapData.origin_lng], 10);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear previous layers
      layersRef.current.forEach((layer) => {
        try {
          map.removeLayer(layer);
        } catch (e) {
          console.error(e);
        }
      });
      layersRef.current = [];

      const originLatLng: [number, number] = [mapData.origin_lat, mapData.origin_lng];
      const destLatLng: [number, number] = [mapData.destination_lat, mapData.destination_lng];

      // Origin Marker (green)
      const originIcon = L.divIcon({
        className: "custom-marker-origin",
        html: `<div class="origin-marker-pin" style="width: 28px; height: 28px; background: #15803d; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.15); color: white;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const originMarker = L.marker(originLatLng, { icon: originIcon })
        .bindPopup(`<strong>Asal:</strong> ${mapData.origin_name}`)
        .addTo(map);
      layersRef.current.push(originMarker);

      // Destination Marker (red)
      const destIcon = L.divIcon({
        className: "custom-marker-destination",
        html: `<div class="destination-marker" style="width: 28px; height: 28px; background: #dc2626; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.15); border: 2px solid white;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const destMarker = L.marker(destLatLng, { icon: destIcon })
        .bindPopup(`<strong>Tujuan:</strong> ${mapData.destination_name}`)
        .addTo(map);
      layersRef.current.push(destMarker);

      // Polyline path (green)
      const polyline = L.polyline([originLatLng, destLatLng], {
        color: "#16a34a",
        weight: 4,
        opacity: 0.8,
        lineJoin: "round",
      }).addTo(map);
      layersRef.current.push(polyline);

      // Zoom to fit origin and destination
      map.fitBounds([originLatLng, destLatLng], { padding: [30, 30] });
    });

    return () => {
      isMounted = false;
    };
  }, [mapData]);

  // Handle map size adjustment and zooming when fullscreen changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
        const originLatLng: [number, number] = [mapData.origin_lat, mapData.origin_lng];
        const destLatLng: [number, number] = [mapData.destination_lat, mapData.destination_lng];
        mapInstanceRef.current.fitBounds([originLatLng, destLatLng], { padding: [30, 30] });
      }, 150);
    }
  }, [isFullscreen, mapData]);

  // Toggle native fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Sync state on native fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      style={isFullscreen ? {
        width: "100%",
        height: "100%",
        background: "white",
        margin: 0,
        borderRadius: 0,
        display: "flex",
        flexDirection: "column",
        boxShadow: "none",
        maxWidth: "none",
      } : {
        margin: "12px 0",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
        width: "100%",
        maxWidth: "500px",
      }}
    >
      <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--color-border)", background: "#fcfdfc", fontSize: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ color: "var(--color-primary-dark)" }}>Peta Visualisasi Rute AI</strong>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {mapData.distance_km && (
            <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 550 }}>
              {mapData.distance_km} km | {mapData.duration_min ? `${Math.round(mapData.duration_min)} m` : ""}
            </span>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-muted)",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      <div ref={mapContainerRef} style={isFullscreen ? { width: "100%", flex: 1, zIndex: 1 } : { width: "100%", height: "200px", zIndex: 1 }} />
      {mapData.route_summary && (
        <div style={{ padding: "8px 12px", background: "var(--color-muted)", fontSize: "11px", borderTop: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
          Info Rute: {mapData.route_summary}
        </div>
      )}
    </div>
  );
}
