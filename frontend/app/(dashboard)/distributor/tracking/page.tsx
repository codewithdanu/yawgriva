"use client";

import React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { getToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { 
  ScanLine, 
  Loader2, 
  AlertCircle, 
  AlertTriangle,
  CheckCircle2, 
  MapPin, 
  Thermometer, 
  Plus, 
  Search, 
  Compass, 
  Clock,
  Maximize2,
  Minimize2,
  Camera,
  Eye,
  Map,
  X,
  Crosshair,
  Upload,
  Sparkles,
  RotateCw
} from "lucide-react";
import "leaflet/dist/leaflet.css";

// Real-time AI analysis status steps
type AiStep = "idle" | "uploading" | "analyzing" | "done" | "error";

const AI_STEPS: { key: AiStep; label: string; Icon: React.ElementType }[] = [
  { key: "uploading",  label: "Mengunggah foto...",       Icon: Upload },
  { key: "analyzing", label: "AI sedang menganalisis...", Icon: Sparkles },
  { key: "done",      label: "Analisis AI selesai!",      Icon: CheckCircle2 },
];

// Cold-chain temperature thresholds per commodity (°C)
const TEMP_THRESHOLDS: Record<string, { min: number; max: number; label: string }> = {
  tomat:        { min: 8,  max: 15, label: "Tomat" },
  cabai_merah:  { min: 5,  max: 12, label: "Cabai Merah" },
  cabai_rawit:  { min: 5,  max: 12, label: "Cabai Rawit" },
  bawang_merah: { min: 15, max: 25, label: "Bawang Merah" },
  bawang_putih: { min: 15, max: 25, label: "Bawang Putih" },
  kangkung:     { min: 2,  max: 8,  label: "Kangkung" },
};

function getTempStatus(temp: number, commodity: string): "ok" | "warning" | "danger" {
  const normalized = commodity.toLowerCase().replace(/ /g, "_");
  const threshold = TEMP_THRESHOLDS[normalized];
  if (!threshold) return "ok";
  if (temp > threshold.max + 5 || temp < threshold.min - 3) return "danger";
  if (temp > threshold.max || temp < threshold.min) return "warning";
  return "ok";
}

function AiStatusBanner({ step, result }: { step: AiStep; result: any }) {
  if (step === "idle") return null;
  if (step === "error") {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: "#FEF2F2", border: "1px solid #FECACA",
        borderRadius: "var(--radius-lg)", padding: "10px 14px",
        fontSize: "var(--text-xs)", color: "#B91C1C", fontWeight: 600
      }}>
        <AlertCircle size={14} style={{ flexShrink: 0 }} />
        Analisis AI gagal. Silakan coba lagi.
      </div>
    );
  }

  const currentIdx = AI_STEPS.findIndex(s => s.key === step);
  const isDone = step === "done";

  return (
    <div style={{
      background: isDone ? "#F0FDF4" : "#EFF6FF",
      border: `1px solid ${isDone ? "#86EFAC" : "#BFDBFE"}`,
      borderRadius: "var(--radius-lg)",
      padding: "12px 14px",
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}>
      {/* Step Progress */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {AI_STEPS.map((s, i) => {
          const isActive = i === currentIdx;
          const isDoneStep = i < currentIdx || isDone;
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px",
                borderRadius: "var(--radius-full)",
                fontSize: "10px",
                fontWeight: 700,
                background: isDoneStep ? "#DCFCE7" : isActive ? "#DBEAFE" : "#F1F5F9",
                color: isDoneStep ? "#16A34A" : isActive ? "#1D4ED8" : "#94A3B8",
                border: `1px solid ${isDoneStep ? "#86EFAC" : isActive ? "#93C5FD" : "#E2E8F0"}`,
                transition: "all 0.3s ease",
              }}>
                {isActive && !isDone
                  ? <Loader2 size={10} className="animate-spin" />
                  : <s.Icon size={10} />
                }
                {s.label}
              </div>
              {i < AI_STEPS.length - 1 && (
                <div style={{
                  width: 16, height: 2,
                  background: i < currentIdx ? "#86EFAC" : "#E2E8F0",
                  borderRadius: 2, transition: "background 0.3s"
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Result summary */}
      {isDone && result && (
        <div style={{
          background: "white", borderRadius: "var(--radius-md)",
          padding: "8px 10px", border: "1px solid #D1FAE5",
          fontSize: "10px", color: "#374151", display: "flex", flexDirection: "column", gap: 4
        }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={{
              padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 700, fontSize: "10px",
              background: result.visual_condition === "excellent" ? "#DCFCE7" :
                          result.visual_condition === "good" ? "#DBEAFE" :
                          result.visual_condition === "fair" ? "#FEF3C7" :
                          result.visual_condition === "poor" ? "#FEE2E2" : "#F1F5F9",
              color: result.visual_condition === "excellent" ? "#16A34A" :
                     result.visual_condition === "good" ? "#1D4ED8" :
                     result.visual_condition === "fair" ? "#B45309" :
                     result.visual_condition === "poor" ? "#B91C1C" : "#64748B",
            }}>
              Kondisi: {result.visual_condition === "excellent" ? "Sangat Baik" :
                        result.visual_condition === "good" ? "Baik" :
                        result.visual_condition === "fair" ? "Cukup" :
                        result.visual_condition === "poor" ? "Perlu Perhatian" : "Tidak Diketahui"}
            </span>
            {result.visual_confidence && (
              <span style={{ color: "#6B7280" }}>
                Kepercayaan: {Math.round(result.visual_confidence * 100)}%
              </span>
            )}
          </div>
          {result.visual_summary && (
            <p style={{ margin: 0, fontStyle: "italic", color: "#4B5563" }}>
              "{result.visual_summary}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DistributorTrackingPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search hash search bar
  const [searchHash, setSearchHash] = useState("");
  const [searchedBatch, setSearchedBatch] = useState<any | null>(null);

  // QR Code Scanner State
  const [scannerOpen, setScannerOpen] = useState(false);

  // New Checkpoint Form Fields
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [tempCelsius, setTempCelsius] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  
  // Photo upload states
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // AI Analysis real-time status
  const [aiStep, setAiStep] = useState<AiStep>("idle");
  const [aiResult, setAiResult] = useState<any>(null);
  const [reanalyzingIds, setReanalyzingIds] = useState<Record<string, boolean>>({});

  // Location Picker Map Modal
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const locationPickerMapRef = useRef<HTMLDivElement | null>(null);
  const locationPickerInstanceRef = useRef<any>(null);
  const locationPickerMarkerRef = useRef<any>(null);

  // Geocoding search state (for location picker)
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<any[]>([]);
  const [geoSearching, setGeoSearching] = useState(false);
  const geoSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Map Container and Leaflet Refs (main tracking map)
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapLayersRef = useRef<any[]>([]);

  useEffect(() => {
    loadBatches();

    // Poll every 30 seconds for real-time checkpoint updates
    const intervalId = setInterval(async () => {
      try {
        const token = getToken();
        if (!token) return;
        const all = await api.batches.list(token);
        const inTransit = all.filter((b: any) => b.status === "in_transit");
        setBatches(inTransit);
      } catch {
        // Silent poll failure — don't disrupt UI
      }
    }, 30_000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (selectedBatchId) {
      localStorage.setItem("selected_tracking_batch_id", selectedBatchId);
    }
  }, [selectedBatchId]);

  // Real-time polling for AI analysis status of checkpoints
  useEffect(() => {
    let activeInterval: ReturnType<typeof setInterval> | null = null;

    // Check if any checkpoint in the active batch list is currently analyzing
    const hasAnalyzingCheckpoint = batches.some((batch: any) =>
      batch.checkpoints?.some((cp: any) => cp.photo_url && !cp.visual_condition)
    );

    // Or if the searched batch has an analyzing checkpoint
    const searchedIsAnalyzing = searchedBatch?.checkpoints?.some(
      (cp: any) => cp.photo_url && !cp.visual_condition
    );

    if (hasAnalyzingCheckpoint || searchedIsAnalyzing) {
      // Poll every 2 seconds to get fresh data
      activeInterval = setInterval(async () => {
        try {
          const token = getToken();
          if (!token) return;

          // 1. Refresh main batches list
          const all = await api.batches.list(token);
          const inTransit = all.filter((b: any) => b.status === "in_transit");
          setBatches(inTransit);

          // 2. If we just submitted a checkpoint, we also want to update the progress banner
          // Find the latest checkpoint we submitted in the selected batch
          const activeBatch = inTransit.find((b: any) => b.id === selectedBatchId);
          if (activeBatch && activeBatch.checkpoints) {
            // Sort to find the latest checkpoint with a photo
            const photoCps = activeBatch.checkpoints
              .filter((cp: any) => cp.photo_url)
              .sort((a: any, b: any) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());
            
            if (photoCps.length > 0) {
              const latestCp = photoCps[0];
              // If it's the one we just added (or we are in an active AI upload/analysis state)
              if (aiStep === "analyzing" || aiStep === "done") {
                if (latestCp.visual_condition) {
                  // Celery analysis finished! Update banner result
                  setAiResult({
                    checkpoint_id: latestCp.id,
                    photo_url: latestCp.photo_url,
                    visual_condition: latestCp.visual_condition,
                    visual_summary: latestCp.visual_summary,
                    visual_confidence: latestCp.visual_confidence,
                  });
                  setAiStep("done");
                }
              }
            }
          }

          // 3. Refresh searched batch if it exists
          if (searchedBatch) {
            const data = await api.trace.get(searchedBatch.batch.qr_code_hash);
            setSearchedBatch(data);
          }
        } catch (err) {
          console.error("Error polling checkpoint status:", err);
        }
      }, 2000);
    }

    return () => {
      if (activeInterval) clearInterval(activeInterval);
    };
  }, [batches, searchedBatch, aiStep, selectedBatchId]);

  async function loadBatches() {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) return;
      
      const all = await api.batches.list(token);
      // Filter for batches in transit
      const inTransit = all.filter((b: any) => b.status === "in_transit");
      setBatches(inTransit);
      
      const savedBatchId = localStorage.getItem("selected_tracking_batch_id");
      if (inTransit.length > 0) {
        const stillInTransit = inTransit.some((b: any) => b.id === savedBatchId);
        if (savedBatchId && stillInTransit) {
          setSelectedBatchId(savedBatchId);
        } else {
          setSelectedBatchId(inTransit[0].id);
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("Gagal memuat data batch pengiriman.");
    } finally {
      setLoading(false);
    }
  }

  const getGeolocation = () => {
    if (!navigator.geolocation) {
      setError("Geolokasi tidak didukung oleh browser Anda.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setSuccess("Lokasi koordinat checkpoint berhasil diambil!");
        setTimeout(() => setSuccess(null), 3000);
      },
      (err) => {
        console.error(err);
        setError("Gagal mengambil lokasi. Pastikan izin lokasi aktif.");
      }
    );
  };

  const handleSearchTrace = async (e?: React.FormEvent, customHash?: string) => {
    if (e) e.preventDefault();
    const queryHash = customHash || searchHash;
    if (!queryHash.trim()) return;
    setError(null);
    setSearchedBatch(null);

    try {
      const data = await api.trace.get(queryHash.trim());
      setSearchedBatch(data);
    } catch (err: any) {
      console.error(err);
      setError("QR Hash tidak valid atau batch tidak ditemukan.");
    }
  };

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId) return;
    
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setAiStep("idle");
    setAiResult(null);

    try {
      const token = getToken();
      if (!token) return;

      const checkpointData = {
        batch_id: selectedBatchId,
        location_name: locationName,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        temp_celsius: tempCelsius ? parseFloat(tempCelsius) : undefined,
      };

      const cp = await api.checkpoints.create(token, checkpointData) as any;
      
      // If photoFile is selected, upload it to trigger Gemini Vision AI analysis
      if (photoFile && cp && cp.id) {
        // Step 1: Uploading
        setAiStep("uploading");
        await new Promise(r => setTimeout(r, 600)); // brief pause for UX

        // Step 2: Analyzing
        setAiStep("analyzing");
        const analysisResult = await api.checkpoints.uploadPhoto(token, cp.id, photoFile);

        // Step 3: Done
        setAiStep("done");
        setAiResult(analysisResult);

        setSuccess("Checkpoint berhasil ditambahkan dan dianalisis secara visual oleh AI!");
      } else {
        setSuccess("Checkpoint berhasil ditambahkan!");
      }

      setLocationName("");
      setTempCelsius("");
      setLatitude("");
      setLongitude("");
      setPhotoFile(null);
      setPhotoPreview(null);
      
      // Reload batches to update checkpoint histories
      await loadBatches();

      // Force map to re-render after data refresh
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 300);
      
      setTimeout(() => setSuccess(null), 5000);
      // Keep AI result visible for a bit longer
      setTimeout(() => {
        setAiStep("idle");
        setAiResult(null);
      }, 10000);
    } catch (err: any) {
      console.error(err);
      setAiStep(photoFile ? "error" : "idle");
      setError(err.message || "Gagal menambahkan checkpoint.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReanalyzePhoto = async (checkpointId: string) => {
    if (reanalyzingIds[checkpointId]) return;
    
    setReanalyzingIds(prev => ({ ...prev, [checkpointId]: true }));
    setError(null);
    setSuccess(null);

    try {
      const token = getToken();
      if (!token) return;

      await api.checkpoints.reanalyze(token, checkpointId);
      
      setAiStep("analyzing");
      setAiResult(null);

      // Force refresh batches and searchedBatch
      const all = await api.batches.list(token);
      const inTransit = all.filter((b: any) => b.status === "in_transit");
      setBatches(inTransit);
      
      if (searchedBatch) {
        const data = await api.trace.get(searchedBatch.batch.qr_code_hash);
        setSearchedBatch(data);
      }

      setSuccess("Analisis ulang foto berhasil dipicu!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal memicu analisis ulang foto.");
    } finally {
      setReanalyzingIds(prev => ({ ...prev, [checkpointId]: false }));
    }
  };

  const getSelectedBatchDetails = () => {
    return batches.find(b => b.id === selectedBatchId);
  };

  const selectedBatchDetails = getSelectedBatchDetails();

  // ─── Location Picker Map ────────────────────────────────────────────────
  const openLocationPicker = useCallback(() => {
    setLocationPickerOpen(true);
    setGeoQuery("");
    setGeoResults([]);
  }, []);

  // Geocoding search using Nominatim (free, no API key)
  const handleGeoSearch = useCallback(async (query: string) => {
    setGeoQuery(query);
    if (geoSearchTimeoutRef.current) clearTimeout(geoSearchTimeoutRef.current);
    if (!query.trim() || query.length < 3) {
      setGeoResults([]);
      return;
    }
    geoSearchTimeoutRef.current = setTimeout(async () => {
      setGeoSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=id`,
          { headers: { "Accept-Language": "id" } }
        );
        const data = await res.json();
        setGeoResults(data);
      } catch {
        setGeoResults([]);
      } finally {
        setGeoSearching(false);
      }
    }, 500);
  }, []);

  // Reverse geocoding: get place name from coordinates
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "id" } }
      );
      const data = await res.json();
      if (data && data.display_name) {
        // Use neighbourhood/suburb/city_district or first meaningful part
        const addr = data.address || {};
        const name =
          addr.amenity ||
          addr.shop ||
          addr.road ||
          addr.neighbourhood ||
          addr.suburb ||
          addr.city_district ||
          addr.city ||
          data.display_name.split(",")[0];
        setLocationName(name);
        setGeoQuery(name);
      }
    } catch {
      // silently fail — user can type manually
    }
  }, []);

  const handleSelectGeoResult = useCallback((result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setLatitude(lat.toFixed(6));
    setLongitude(lng.toFixed(6));
    setGeoResults([]);

    // Build a short human-readable name from result
    const addr = result.address || {};
    const name =
      addr.amenity ||
      addr.shop ||
      addr.road ||
      addr.neighbourhood ||
      addr.suburb ||
      addr.city_district ||
      result.display_name.split(",")[0];
    setGeoQuery(name);
    setLocationName(name);

    // Move map and marker
    const map = locationPickerInstanceRef.current;
    const marker = locationPickerMarkerRef.current;
    if (map && marker) {
      map.setView([lat, lng], 15);
      marker.setLatLng([lat, lng]);
    }
  }, []);

  useEffect(() => {
    if (!locationPickerOpen || !locationPickerMapRef.current) return;

    let map: any;
    let marker: any;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      // Destroy previous instance if any
      if (locationPickerInstanceRef.current) {
        locationPickerInstanceRef.current.remove();
        locationPickerInstanceRef.current = null;
      }

      const initLat = latitude ? parseFloat(latitude) : -6.9175;
      const initLng = longitude ? parseFloat(longitude) : 107.6191;

      map = L.map(locationPickerMapRef.current!).setView([initLat, initLng], latitude ? 14 : 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Custom draggable marker icon
      const pickerIcon = L.divIcon({
        className: "picker-marker",
        html: `<div style="
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #16a34a, #15803d);
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="transform: rotate(45deg); color: white; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -44],
      });

      // Place marker if we already have coords, else on center
      marker = L.marker([initLat, initLng], { icon: pickerIcon, draggable: true }).addTo(map);

      locationPickerInstanceRef.current = map;
      locationPickerMarkerRef.current = marker;

      // Update coords + reverse geocode on drag
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        const lat = pos.lat;
        const lng = pos.lng;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        reverseGeocode(lat, lng);
      });

      // Click anywhere on map to move marker + reverse geocode
      map.on("click", (ev: any) => {
        marker.setLatLng(ev.latlng);
        const lat = ev.latlng.lat;
        const lng = ev.latlng.lng;
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
        reverseGeocode(lat, lng);
      });

      // Invalidate after short delay for proper sizing
      setTimeout(() => map.invalidateSize(), 200);
    });

    return () => {
      if (locationPickerInstanceRef.current) {
        locationPickerInstanceRef.current.remove();
        locationPickerInstanceRef.current = null;
        locationPickerMarkerRef.current = null;
      }
    };
  }, [locationPickerOpen]);

  // QR Code Scanner Effect
  useEffect(() => {
    if (!scannerOpen) return;

    let html5Qrcode: any = null;

    // Load html5-qrcode dynamically to support SSR
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      html5Qrcode = new Html5Qrcode("qr-reader");
      
      html5Qrcode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          // Check if it's a URL
          let hash = decodedText.trim();
          if (hash.includes("/trace/")) {
            const parts = hash.split("/trace/");
            hash = parts[parts.length - 1].split("?")[0].split("#")[0].trim();
          }
          
          setSearchHash(hash);
          setScannerOpen(false);
          
          // Trigger search directly
          handleSearchTrace(undefined, hash);
          
          html5Qrcode.stop().catch(console.error);
        },
        () => {
          // Silent failure on scan frame
        }
      ).catch((err: any) => {
        console.error("Camera start error:", err);
        setError("Kamera gagal diakses. Pastikan izin kamera telah diberikan.");
        setScannerOpen(false);
      });
    });

    return () => {
      if (html5Qrcode && html5Qrcode.isScanning) {
        html5Qrcode.stop().catch((e: any) => console.error("Scanner stop error", e));
      }
    };
  }, [scannerOpen]);

  // Leaflet Map Visualization Effect
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let checkpoints: any[] = [];
    let batchId = "";

    if (searchedBatch) {
      checkpoints = searchedBatch.checkpoints || [];
      batchId = searchedBatch.batch.id;
    } else if (selectedBatchDetails) {
      checkpoints = selectedBatchDetails.checkpoints || [];
      batchId = selectedBatchDetails.id;
    }

    // Chronologically sort checkpoints
    const sortedCheckpoints = [...checkpoints].sort(
      (a, b) => new Date(a.scanned_at).getTime() - new Date(b.scanned_at).getTime()
    );

    // Retrieve destination coordinates from localStorage if available
    let destination: any = null;
    const destCached = localStorage.getItem(`batch_destination_${batchId}`);
    if (destCached) {
      try {
        destination = JSON.parse(destCached);
      } catch (e) {
        console.error(e);
      }
    } else {
      const isDelivered = searchedBatch 
        ? searchedBatch.batch.status === "delivered" 
        : (selectedBatchDetails ? selectedBatchDetails.status === "delivered" : false);
      if (isDelivered && sortedCheckpoints.length > 0) {
        destination = sortedCheckpoints[sortedCheckpoints.length - 1];
      }
    }

    import("leaflet").then((L) => {
      // Fix Leaflet marker icons path issues in React
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      // If previous map instance's container was detached from DOM (e.g. after state reset),
      // destroy it so we can reinitialize fresh
      if (mapInstanceRef.current) {
        try {
          const container = mapInstanceRef.current.getContainer();
          if (!document.contains(container)) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
          }
        } catch {
          mapInstanceRef.current = null;
        }
      }

      // Initialize map once
      if (!mapInstanceRef.current) {
        const defaultCenter: [number, number] = [-6.9175, 107.6191]; // Bandung
        const map = L.map(mapContainerRef.current!).setView(defaultCenter, 9);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        
        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear previous markers/lines
      mapLayersRef.current.forEach((layer) => map.removeLayer(layer));
      mapLayersRef.current = [];

      if (sortedCheckpoints.length === 0) {
        map.setView([-6.9175, 107.6191], 9);
        return;
      }

      const pathCoords: [number, number][] = [];
      const bounds: [number, number][] = [];

      // Add checkpoints to map
      sortedCheckpoints.forEach((cp, idx) => {
        if (cp.latitude === undefined || cp.longitude === undefined || cp.latitude === null || cp.longitude === null) return;
        
        const isFirst = idx === 0;
        const isLatest = idx === sortedCheckpoints.length - 1;
        const latLng: [number, number] = [cp.latitude, cp.longitude];
        
        pathCoords.push(latLng);
        bounds.push(latLng);

        let markerIcon;

        if (isFirst) {
          markerIcon = L.divIcon({
            className: "custom-marker-origin",
            html: `<div class="origin-marker-pin" style="width: 32px; height: 32px; background: #15803d; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.15); color: white;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
        } else if (isLatest && !destination) {
          markerIcon = L.divIcon({
            className: "custom-marker-current",
            html: `<div class="pulse-marker-wrapper" style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
              <div class="pulse-ring" style="position: absolute; width: 36px; height: 36px; border: 3px solid #16a34a; border-radius: 50%; animation: map-pulse 1.8s ease-out infinite;"></div>
              <div class="truck-marker" style="width: 32px; height: 32px; background: #16a34a; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.25); border: 2px solid white; z-index: 10;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
            </div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });
        } else {
          markerIcon = L.divIcon({
            className: "custom-marker-checkpoint",
            html: `<div class="checkpoint-marker-dot" style="width: 14px; height: 14px; background: #2563eb; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.15);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
        }

        // Determine temperature status and styling for popup
        const commodityName = searchedBatch ? searchedBatch.batch.commodity_name : (selectedBatchDetails ? selectedBatchDetails.commodity_name : "");
        const hasTemp = cp.temp_celsius !== undefined && cp.temp_celsius !== null;
        let tempHtml = "";
        
        if (hasTemp) {
          const tempStatus = getTempStatus(cp.temp_celsius, commodityName);
          const threshold = TEMP_THRESHOLDS[commodityName.toLowerCase().replace(/ /g, "_").replace(/-/g, "_")];
          const rangeText = threshold ? ` (Normal: ${threshold.min}-${threshold.max}&deg;C)` : "";
          
          if (tempStatus === "danger") {
            tempHtml = `<span style="color: #B91C1C; background: #FEE2E2; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #FCA5A5; display: inline-block; margin-top: 4px;">Suhu: ${cp.temp_celsius}&deg;C (Bahaya)${rangeText}</span>`;
          } else if (tempStatus === "warning") {
            tempHtml = `<span style="color: #D97706; background: #FEF3C7; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #FCD34D; display: inline-block; margin-top: 4px;">Suhu: ${cp.temp_celsius}&deg;C (Peringatan)${rangeText}</span>`;
          } else {
            tempHtml = `<span style="color: #16A34A; background: #DCFCE7; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid #BBF7D0; display: inline-block; margin-top: 4px;">Suhu: ${cp.temp_celsius}&deg;C (Normal)</span>`;
          }
        } else {
          tempHtml = `<span style="color: #6b7280; font-size: 11px;">Suhu: &mdash;</span>`;
        }

        const marker = L.marker(latLng, { icon: markerIcon })
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px; line-height: 1.6;">
              <strong style="color: #1f2937; font-size: 13px;">${cp.location_name}</strong><br/>
              <div style="margin: 4px 0 6px 0;">${tempHtml}</div>
              <span style="color: #6b7280; font-size: 10px;">Scanned: ${new Date(cp.scanned_at).toLocaleString("id-ID")}</span>
            </div>
          `);
        
        marker.addTo(map);
        mapLayersRef.current.push(marker);
      });

      // Draw path line
      if (pathCoords.length > 1) {
        const polyline = L.polyline(pathCoords, {
          color: "#16a34a",
          weight: 4,
          opacity: 0.8,
          lineJoin: "round",
        }).addTo(map);
        mapLayersRef.current.push(polyline);
      }

      // Draw destination marker & dotted route
      if (destination && (destination.lat || destination.latitude) && (destination.lng || destination.longitude)) {
        const destLat = destination.lat || destination.latitude;
        const destLng = destination.lng || destination.longitude;
        const destLatLng: [number, number] = [destLat, destLng];
        
        bounds.push(destLatLng);

        const destIcon = L.divIcon({
          className: "custom-marker-destination",
          html: `<div class="destination-marker" style="width: 32px; height: 32px; background: #dc2626; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.15); border: 2px solid white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
          </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const destMarker = L.marker(destLatLng, { icon: destIcon })
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <strong style="color: #b91c1c;">Tujuan Akhir (Pasar)</strong><br/>
              <span style="color: #6b7280; font-size: 11px;">${destination.label || destination.location_name || "Pasar Penerima"}</span>
            </div>
          `);
        destMarker.addTo(map);
        mapLayersRef.current.push(destMarker);

        if (pathCoords.length > 0) {
          const latestCoords = pathCoords[pathCoords.length - 1];
          const remainingPolyline = L.polyline([latestCoords, destLatLng], {
            color: "#3b82f6",
            weight: 3,
            opacity: 0.7,
            dashArray: "6, 8",
            lineJoin: "round",
          }).addTo(map);
          mapLayersRef.current.push(remainingPolyline);

          const truckIconWithDest = L.divIcon({
            className: "custom-marker-current-blue",
            html: `<div class="pulse-marker-wrapper" style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
              <div class="pulse-ring-blue" style="position: absolute; width: 36px; height: 36px; border: 3px solid #3b82f6; border-radius: 50%; animation: map-pulse-blue 1.8s ease-out infinite;"></div>
              <div class="truck-marker-blue" style="width: 32px; height: 32px; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.25); border: 2px solid white; z-index: 10;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="2" ry="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              </div>
            </div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });

          const activeTruckMarker = L.marker(latestCoords, { icon: truckIconWithDest })
            .bindPopup(`
              <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
                <strong style="color: #2563eb;">Dalam Transit ke Tujuan</strong><br/>
                <span style="color: #6b7280; font-size: 11px;">Lokasi: ${sortedCheckpoints[sortedCheckpoints.length - 1].location_name}</span>
              </div>
            `);
          activeTruckMarker.addTo(map);
          mapLayersRef.current.push(activeTruckMarker);
        }
      }

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          if (bounds.length > 0) {
            mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
          }
        }
      }, 100);
    });

    return () => {
      // Don't remove map on cleanup
    };
  }, [selectedBatchId, searchedBatch, batches, isFullscreen]);

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "var(--space-4)" }}>
        <Loader2 className="animate-spin" size={40} style={{ color: "var(--color-primary)" }} />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Memuat data pelacakan...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "var(--space-12)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes map-pulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes map-pulse-blue {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes ai-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .location-picker-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          background: var(--color-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-text);
          cursor: pointer;
          transition: var(--transition-fast);
          flex: 1;
          justify-content: center;
        }
        .location-picker-btn:hover {
          background: var(--color-border);
        }
        .geo-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          background: var(--color-muted);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-text);
          cursor: pointer;
          transition: var(--transition-fast);
          flex: 1;
          justify-content: center;
        }
        .geo-btn:hover {
          background: var(--color-border);
        }
        .leaflet-container {
          z-index: 1 !important;
        }
      `}} />

      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-text)" }}>Tracking &amp; Checkpoints</h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Perbarui lokasi transit dan pantau suhu cold chain produk dalam perjalanan secara real-time.
        </p>
      </div>

      {success && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "var(--color-success-bg)", border: "1px solid var(--color-success)", color: "var(--color-success)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
          <CheckCircle2 size={20} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 550 }}>{success}</span>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 550 }}>{error}</span>
        </div>
      )}

      {/* Tracking Map */}
      <div style={isFullscreen ? {
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
        borderRadius: 0,
        margin: 0,
        height: "100vh",
        width: "100vw",
      } : {
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-xl)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05)"
      }}>
        <div style={{ padding: "var(--space-4) var(--space-6)", borderBottom: "1px solid var(--color-border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fcfdfc" }}>
          <div>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", color: "var(--color-primary-dark)" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: searchedBatch ? "#3b82f6" : "#16a34a", display: "inline-block", boxShadow: searchedBatch ? "0 0 6px #3b82f6" : "0 0 6px #16a34a" }}></span>
              Peta Pelacakan Pengiriman (Live Router)
            </h3>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              {searchedBatch 
                ? `Menampilkan rute hasil scan QR Hash: ${searchHash.substring(0, 8)}...` 
                : (selectedBatchDetails 
                  ? `Memantau perjalanan Batch: ${selectedBatchDetails.commodity_name.replace(/_/g, " ").toUpperCase()} (${selectedBatchDetails.quantity_kg} kg)` 
                  : "Pilih batch aktif atau scan QR code untuk melacak")}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {searchedBatch && (
              <button 
                onClick={() => { setSearchedBatch(null); setSearchHash(""); }}
                style={{ background: "var(--color-primary)", color: "white", border: "none", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", padding: "6px 12px", fontWeight: 600, cursor: "pointer", transition: "var(--transition-fast)" }}
              >
                Kembali ke Batch Aktif
              </button>
            )}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--color-text-muted)",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title={isFullscreen ? "Keluar Layar Penuh" : "Layar Penuh"}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
        <div ref={mapContainerRef} style={isFullscreen ? { width: "100%", flex: 1, zIndex: 1 } : { width: "100%", height: "420px", zIndex: 1 }}></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-6)" }}>
        
        {/* Left Card: Scan Checkpoint Form */}
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-4)" }}>
            <div style={{ padding: "8px", borderRadius: "var(--radius-md)", background: "var(--color-primary-bg)", color: "var(--color-primary)" }}>
              <ScanLine size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Catat Checkpoint Baru</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Scan atau input manual lokasi terkini</p>
            </div>
          </div>

          {batches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--color-text-muted)" }}>
              <p style={{ fontSize: "var(--text-sm)", fontWeight: 550 }}>Tidak ada batch aktif dalam transit.</p>
              <p style={{ fontSize: "var(--text-xs)", marginTop: "4px" }}>Silakan mulai pengiriman dari halaman Perencana Rute terlebih dahulu.</p>
            </div>
          ) : (
            <form onSubmit={handleAddCheckpoint} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {/* Select Batch */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>Pilih Batch Produk</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "white", outline: "none" }}
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.commodity_name.replace(/_/g, " ").toUpperCase()} ({b.quantity_kg} kg) - ID: {b.id.substring(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location Name */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>Nama Lokasi Checkpoint</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: GT Tol Pasteur / Gudang Distributor Bandung"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", outline: "none" }}
                />
              </div>

              {/* Temperature */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>Suhu Ruang Penyimpanan (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="Contoh: 18.5"
                  value={tempCelsius}
                  onChange={(e) => setTempCelsius(e.target.value)}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", outline: "none" }}
                />
                {selectedBatchDetails && (() => {
                  const commodityKey = selectedBatchDetails.commodity_name.toLowerCase().replace(/ /g, "_").replace(/-/g, "_");
                  const threshold = TEMP_THRESHOLDS[commodityKey];
                  if (!threshold) return null;
                  return (
                    <span style={{ 
                      fontSize: "11px", 
                      color: "var(--color-primary-dark)", 
                      background: "var(--color-primary-bg)", 
                      padding: "6px 10px", 
                      borderRadius: "var(--radius-md)", 
                      marginTop: "2px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 500,
                      border: "1px solid rgba(45, 155, 107, 0.2)"
                    }}>
                      <Thermometer size={12} style={{ color: "var(--color-primary)" }} />
                      Suhu ideal {threshold.label}: <strong>{threshold.min}°C &ndash; {threshold.max}°C</strong>
                    </span>
                  );
                })()}
              </div>

              {/* Location Section with Coordinates + Map Picker */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>Lokasi Koordinat</label>
                
                {/* Coordinate display (read-only, updated by picker or geo) */}
                <div style={{
                  display: "flex", gap: "var(--space-3)", alignItems: "center",
                  background: latitude && longitude ? "#F0FDF4" : "var(--color-muted)",
                  border: `1px solid ${latitude && longitude ? "#86EFAC" : "var(--color-border)"}`,
                  borderRadius: "var(--radius-md)",
                  padding: "8px 12px",
                  fontSize: "var(--text-xs)",
                  transition: "all 0.2s",
                }}>
                  <MapPin size={13} style={{ color: latitude && longitude ? "#16a34a" : "var(--color-text-muted)", flexShrink: 0 }} />
                  {latitude && longitude ? (
                    <span style={{ color: "#15803d", fontWeight: 600, fontFamily: "monospace" }}>
                      {parseFloat(latitude).toFixed(5)}, {parseFloat(longitude).toFixed(5)}
                    </span>
                  ) : (
                    <span style={{ color: "var(--color-text-muted)" }}>
                      Belum dipilih — gunakan tombol di bawah
                    </span>
                  )}
                  {latitude && longitude && (
                    <button
                      type="button"
                      onClick={() => { setLatitude(""); setLongitude(""); }}
                      style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0, display: "flex", alignItems: "center" }}
                      title="Hapus koordinat"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Action buttons for location */}
                <div style={{ display: "flex", gap: "8px" }}>
                  {/* Map picker button */}
                  <button
                    type="button"
                    onClick={openLocationPicker}
                    className="location-picker-btn"
                  >
                    <Map size={14} />
                    <span>Pilih di Peta</span>
                  </button>

                  {/* Geolocation button */}
                  <button
                    type="button"
                    onClick={getGeolocation}
                    className="geo-btn"
                  >
                    <Compass size={14} />
                    <span>Deteksi GPS</span>
                  </button>
                </div>

                {/* Hidden inputs to keep values in form */}
                <input type="hidden" value={latitude} />
                <input type="hidden" value={longitude} />
              </div>

              {/* Photo Upload for Visual Condition AI Analysis */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Eye size={12} style={{ color: "var(--color-primary)" }} />
                  Foto Kondisi Fisik Produk (Analisis AI Vision)
                </label>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-xs)", fontWeight: 600, background: "white", cursor: "pointer" }}
                  >
                    <Camera size={14} />
                    <span>Pilih Foto</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoFile(file);
                        setPhotoPreview(URL.createObjectURL(file));
                        setAiStep("idle");
                        setAiResult(null);
                      }
                    }}
                    style={{ display: "none" }}
                  />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                    {photoFile ? photoFile.name : "Belum ada foto terpilih (Opsional)"}
                  </span>
                </div>
                {photoPreview && (
                  <div style={{ marginTop: "6px", position: "relative", width: "120px", height: "80px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--color-border)" }}>
                    <img src={photoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); setAiStep("idle"); setAiResult(null); }}
                      style={{ position: "absolute", top: "2px", right: "2px", background: "rgba(0,0,0,0.6)", color: "white", border: "none", width: "18px", height: "18px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "10px", fontWeight: "bold" }}
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>

              {/* AI Status Banner — shown during and after analysis */}
              <AiStatusBanner step={aiStep} result={aiResult} />

              <button
                type="submit"
                disabled={submitting}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-2)", background: "var(--color-primary)", color: "white", padding: "12px", borderRadius: "var(--radius-md)", border: "none", fontSize: "var(--text-sm)", fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", marginTop: "var(--space-2)", opacity: submitting ? 0.8 : 1 }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    <span>
                      {aiStep === "uploading" ? "Mengunggah foto..." :
                       aiStep === "analyzing" ? "AI menganalisis..." :
                       "Mencatat..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    <span>Catat Checkpoint</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          
          {/* Card 2: Checkpoint Journey of Selected Batch */}
          {(searchedBatch || selectedBatchDetails) && (
            <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>
                {searchedBatch 
                  ? `Riwayat Perjalanan (QR Scan: ${searchedBatch.batch.commodity_name.replace(/_/g, " ").toUpperCase()})` 
                  : "Riwayat Perjalanan Batch Terpilih"}
              </h3>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", position: "relative", paddingLeft: "var(--space-5)", borderLeft: "2px solid var(--color-primary-bg)", margin: "var(--space-2) 0" }}>
                {(() => {
                  const currentCps = searchedBatch ? searchedBatch.checkpoints : selectedBatchDetails.checkpoints;
                  const commodityName = searchedBatch ? searchedBatch.batch.commodity_name : (selectedBatchDetails ? selectedBatchDetails.commodity_name : "");
                  if (currentCps && currentCps.length > 0) {
                    const sortedShowCps = [...currentCps].sort(
                      (a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime()
                    );
                    return sortedShowCps.map((cp: any, idx: number) => (
                      <div key={cp.id} style={{ position: "relative" }}>
                        {/* Timeline dot */}
                        <span style={{
                          position: "absolute",
                          left: "-29px",
                          top: "2px",
                          width: "16px",
                          height: "16px",
                          borderRadius: "50%",
                          background: idx === 0 ? "var(--color-primary)" : "var(--color-primary-bg)",
                          border: idx === 0 ? "3px solid var(--color-primary-bg)" : "2px solid var(--color-primary)",
                          display: "inline-block"
                        }} />
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontWeight: 600, fontSize: "var(--text-sm)" }}>{cp.location_name}</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "11px", color: "var(--color-text-muted)", alignItems: "center" }}>
                            {(() => {
                              if (cp.temp_celsius === undefined || cp.temp_celsius === null) {
                                return (
                                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Thermometer size={10} />
                                    &mdash;
                                  </span>
                                );
                              }
                              
                              const tempStatus = getTempStatus(cp.temp_celsius, commodityName);
                              const threshold = TEMP_THRESHOLDS[commodityName.toLowerCase().replace(/ /g, "_").replace(/-/g, "_")];
                              const rangeText = threshold ? ` (Normal: ${threshold.min}-${threshold.max}°C)` : "";
                              
                              if (tempStatus === "danger") {
                                return (
                                  <span style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "4px", 
                                    color: "#B91C1C", 
                                    background: "#FEE2E2", 
                                    padding: "2px 8px", 
                                    borderRadius: "var(--radius-full)", 
                                    fontWeight: 700,
                                    border: "1px solid #FCA5A5"
                                  }} title={`Suhu berbahaya!${rangeText}`}>
                                    <AlertCircle size={10} style={{ color: "#B91C1C" }} />
                                    {cp.temp_celsius}°C (Bahaya)
                                  </span>
                                );
                              }
                              if (tempStatus === "warning") {
                                return (
                                  <span style={{ 
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "4px", 
                                    color: "#D97706", 
                                    background: "#FEF3C7", 
                                    padding: "2px 8px", 
                                    borderRadius: "var(--radius-full)", 
                                    fontWeight: 700,
                                    border: "1px solid #FCD34D"
                                  }} title={`Suhu tidak normal!${rangeText}`}>
                                    <AlertTriangle size={10} style={{ color: "#D97706" }} />
                                    {cp.temp_celsius}°C (Peringatan)
                                  </span>
                                );
                              }
                              return (
                                <span style={{ 
                                  display: "flex", 
                                  alignItems: "center", 
                                  gap: "4px",
                                  color: "#16A34A",
                                  background: "#DCFCE7",
                                  padding: "2px 8px",
                                  borderRadius: "var(--radius-full)",
                                  fontWeight: 600,
                                  border: "1px solid #BBF7D0"
                                }} title={`Suhu normal${rangeText}`}>
                                  <Thermometer size={10} style={{ color: "#16A34A" }} />
                                  {cp.temp_celsius}°C (Normal)
                                </span>
                              );
                            })()}
                            {cp.latitude && cp.longitude && (
                              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><MapPin size={10} /> {cp.latitude}, {cp.longitude}</span>
                            )}
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={10} /> {new Date(cp.scanned_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} {new Date(cp.scanned_at).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
                            
                            {cp.visual_condition && (
                              <span style={{
                                padding: "1px 6px",
                                borderRadius: "var(--radius-full)",
                                fontSize: "9px",
                                fontWeight: 700,
                                background: cp.visual_condition === "excellent" ? "var(--color-success-bg)" :
                                            cp.visual_condition === "good" ? "#EFF6FF" :
                                            cp.visual_condition === "fair" ? "#FEF3C7" :
                                            cp.visual_condition === "poor" ? "var(--color-danger-bg)" : "#F1F5F9",
                                color: cp.visual_condition === "excellent" ? "var(--color-success)" :
                                       cp.visual_condition === "good" ? "#1D4ED8" :
                                       cp.visual_condition === "fair" ? "#B45309" :
                                       cp.visual_condition === "poor" ? "var(--color-danger)" : "#64748B",
                              }}>
                                Kondisi: {cp.visual_condition === "excellent" ? "Sangat Baik" :
                                          cp.visual_condition === "good" ? "Baik" :
                                          cp.visual_condition === "fair" ? "Cukup" :
                                          cp.visual_condition === "poor" ? "Perlu Perhatian" : "Tidak Diketahui"}
                              </span>
                            )}
                          </div>
                          
                          {/* Image preview & summary */}
                          {cp.photo_url && (
                            <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                              <img
                                src={cp.photo_url}
                                alt={`Foto di ${cp.location_name}`}
                                style={{ width: "100%", maxWidth: "160px", height: "100px", objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                              {cp.visual_summary && (
                                <p style={{ 
                                  margin: 0, fontSize: "10px", fontStyle: "italic",
                                  color: cp.visual_summary.includes("kuota") || cp.visual_summary.includes("sedang sibuk")
                                    ? "#B45309"
                                    : "var(--color-text-muted)"
                                }}>
                                {cp.visual_summary.includes("kuota") || cp.visual_summary.includes("sedang sibuk")
                                    ? (
                                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                        <AlertTriangle size={10} style={{ flexShrink: 0 }} />
                                        {cp.visual_summary}
                                      </span>
                                    )
                                    : `"${cp.visual_summary}"`}
                                </p>
                              )}
                              {(cp.visual_condition === "unknown" || 
                                !cp.visual_condition ||
                                (cp.visual_summary && (
                                  cp.visual_summary.includes("tidak tersedia") || 
                                  cp.visual_summary.includes("kuota") || 
                                  cp.visual_summary.includes("sedang sibuk") ||
                                  cp.visual_summary.includes("gagal")
                                ))
                              ) && (
                                <button
                                  type="button"
                                  onClick={() => handleReanalyzePhoto(cp.id)}
                                  disabled={reanalyzingIds[cp.id]}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "3px 8px",
                                    border: "1px solid var(--color-border)",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "9px",
                                    fontWeight: 600,
                                    background: "white",
                                    color: "var(--color-primary)",
                                    cursor: reanalyzingIds[cp.id] ? "not-allowed" : "pointer",
                                    width: "fit-content",
                                    marginTop: "2px",
                                    boxShadow: "none",
                                    transition: "all 0.2s"
                                  }}
                                >
                                  {reanalyzingIds[cp.id] ? (
                                    <Loader2 size={10} className="animate-spin" />
                                  ) : (
                                    <RotateCw size={10} />
                                  )}
                                  <span>Coba Analisis Lagi</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ));
                  } else {
                    return <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", paddingLeft: "10px" }}>Belum ada checkpoint tercatat.</p>;
                  }
                })()}
              </div>
            </div>
          )}

          {/* Card 3: QR Code Trace Lookup */}
          <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>Cari Data Journey (QR Hash)</h3>
            <form onSubmit={(e) => handleSearchTrace(e)} style={{ display: "flex", gap: "var(--space-2)" }}>
              <input
                type="text"
                required
                placeholder="Masukkan QR Hash (contoh: 7f155d15...)"
                value={searchHash}
                onChange={(e) => setSearchHash(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", outline: "none" }}
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "var(--color-primary-bg)", border: "1px solid var(--color-primary-mid)", color: "var(--color-primary)", padding: "8px 12px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer", transition: "var(--transition-fast)" }}
                title="Scan QR Code Kamera"
              >
                <ScanLine size={16} />
              </button>
              <button
                type="submit"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "var(--color-muted)", border: "1px solid var(--color-border)", color: "var(--color-text)", padding: "8px 12px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer" }}
              >
                <Search size={16} />
              </button>
            </form>

            {searchedBatch && (
              <div style={{ background: "var(--color-muted)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-xs)", position: "relative" }}>
                <button 
                  onClick={() => { setSearchedBatch(null); setSearchHash(""); }}
                  style={{ position: "absolute", right: "12px", top: "12px", background: "none", border: "none", fontSize: "16px", cursor: "pointer", color: "var(--color-text-muted)", fontWeight: "bold" }}
                  title="Clear search"
                >
                  &times;
                </button>
                <div>
                  <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Komoditas:</span>
                  <span style={{ fontWeight: 700, marginLeft: "6px", textTransform: "uppercase" }}>{searchedBatch.batch.commodity_name.replace(/_/g, " ")}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Petani:</span>
                  <span style={{ fontWeight: 600, marginLeft: "6px" }}>{searchedBatch.farmer_name}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Status Batch:</span>
                  <span style={{
                    fontWeight: 700,
                    marginLeft: "6px",
                    color: searchedBatch.batch.status === "delivered" ? "var(--color-success)" : "var(--color-warning)"
                  }}>{searchedBatch.batch.status.toUpperCase()}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 600, color: "var(--color-text-muted)" }}>Total Checkpoint:</span>
                  <span style={{ fontWeight: 600, marginLeft: "6px" }}>{searchedBatch.checkpoints.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* QR Scanner Camera Overlay Modal */}
      {scannerOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "var(--space-4)" }}>
          <div style={{ background: "white", borderRadius: "var(--radius-xl)", padding: "var(--space-6)", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "var(--space-4)", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-3)" }}>
              <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, color: "var(--color-text)" }}>Scan QR Code Journey</h3>
              <button 
                onClick={() => setScannerOpen(false)}
                style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "var(--color-text-muted)", fontWeight: "bold" }}
              >
                &times;
              </button>
            </div>
            
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              Arahkan kamera Anda ke QR Code pada label kemasan produk untuk memindai otomatis dan melacak data perjalanan.
            </p>
            
            <div style={{ background: "var(--color-muted)", borderRadius: "var(--radius-lg)", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "280px" }}>
              <div id="qr-reader" style={{ width: "100%" }}></div>
            </div>
            
            <button
              onClick={() => setScannerOpen(false)}
              style={{ background: "var(--color-muted)", border: "1px solid var(--color-border)", color: "var(--color-text)", padding: "10px", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", fontWeight: 600, cursor: "pointer" }}
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ─── Location Picker Map Modal ────────────────────────────────── */}
      {locationPickerOpen && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.65)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 99998, padding: "var(--space-4)"
        }}>
          <div style={{
            background: "white",
            borderRadius: "var(--radius-xl)",
            width: "100%", maxWidth: "640px",
            display: "flex", flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
            overflow: "hidden",
            maxHeight: "90vh",
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid var(--color-border)",
              background: "#F8FDFB",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ padding: "6px", background: "#DCFCE7", borderRadius: "var(--radius-md)", color: "#16A34A" }}>
                  <Map size={18} />
                </div>
                <div>
                  <h3 style={{ fontWeight: 700, fontSize: "var(--text-base)", color: "var(--color-text)" }}>
                    Pilih Lokasi di Peta
                  </h3>
                  <p style={{ fontSize: "10px", color: "var(--color-text-muted)", margin: 0 }}>
                    Klik pada peta atau geser marker untuk menentukan koordinat checkpoint
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLocationPickerOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Search bar + Tips bar */}
            <div style={{
              background: "#F8FAFC",
              borderBottom: "1px solid var(--color-border)",
              padding: "10px 16px",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              {/* Search input */}
              <div style={{ position: "relative" }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: "white",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  padding: "7px 12px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}>
                  {geoSearching
                    ? <Loader2 size={14} className="animate-spin" style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                    : <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                  }
                  <input
                    type="text"
                    placeholder="Cari lokasi... (contoh: Pasar Induk Kramat Jati)"
                    value={geoQuery}
                    onChange={(e) => handleGeoSearch(e.target.value)}
                    style={{
                      flex: 1, border: "none", outline: "none",
                      fontSize: "var(--text-xs)", background: "transparent",
                      color: "var(--color-text)",
                    }}
                  />
                  {geoQuery && (
                    <button
                      type="button"
                      onClick={() => { setGeoQuery(""); setGeoResults([]); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-muted)", padding: 0, display: "flex" }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Dropdown results */}
                {geoResults.length > 0 && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    background: "white",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    zIndex: 9999,
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}>
                    {geoResults.map((r, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectGeoResult(r)}
                        style={{
                          width: "100%", textAlign: "left",
                          padding: "9px 12px",
                          border: "none",
                          borderBottom: idx < geoResults.length - 1 ? "1px solid #F1F5F9" : "none",
                          background: "none",
                          cursor: "pointer",
                          display: "flex", alignItems: "flex-start", gap: 8,
                          fontSize: "var(--text-xs)",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      >
                        <MapPin size={13} style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 1 }} />
                        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          <span style={{ fontWeight: 600, color: "var(--color-text)" }}>
                            {r.display_name.split(",")[0]}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--color-text-muted)", lineHeight: 1.4 }}>
                            {r.display_name.split(",").slice(1, 4).join(",")}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tips */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "11px", color: "#64748B" }}>
                <Crosshair size={11} />
                <span>Ketik nama lokasi, klik pada peta, atau geser marker untuk memilih koordinat.</span>
              </div>
            </div>


            {/* Map container */}
            <div
              ref={locationPickerMapRef}
              style={{ width: "100%", height: "380px", zIndex: 1 }}
            />

            {/* Coordinate display */}
            <div style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--color-border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#FAFAFA",
              gap: 12,
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                flex: 1,
                background: latitude && longitude ? "#F0FDF4" : "var(--color-muted)",
                border: `1px solid ${latitude && longitude ? "#86EFAC" : "var(--color-border)"}`,
                borderRadius: "var(--radius-md)",
                padding: "8px 12px",
                fontSize: "12px",
                fontFamily: "monospace",
                color: latitude && longitude ? "#15803d" : "var(--color-text-muted)",
                fontWeight: 600,
                transition: "all 0.2s",
              }}>
                <MapPin size={13} style={{ flexShrink: 0 }} />
                {latitude && longitude
                  ? `${parseFloat(latitude).toFixed(5)}, ${parseFloat(longitude).toFixed(5)}`
                  : "Belum dipilih — klik pada peta"}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setLocationPickerOpen(false)}
                  style={{
                    padding: "9px 16px",
                    background: "var(--color-muted)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "var(--color-text)",
                  }}
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (!latitude || !longitude) {
                      // if nothing selected, just close
                      setLocationPickerOpen(false);
                      return;
                    }
                    setLocationPickerOpen(false);
                    setSuccess("Koordinat lokasi berhasil dipilih dari peta!");
                    setTimeout(() => setSuccess(null), 3000);
                  }}
                  style={{
                    padding: "9px 16px",
                    background: latitude && longitude ? "var(--color-primary)" : "#9CA3AF",
                    border: "none",
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "white",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <CheckCircle2 size={14} />
                  Konfirmasi Lokasi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
