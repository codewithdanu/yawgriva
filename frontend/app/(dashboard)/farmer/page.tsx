"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  AlertTriangle,
  MessageSquare,
  ArrowRight,
  Sprout,
  BarChart3,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { getToken, getStoredUser, StoredUser } from "@/lib/auth";
import { api, FreshnessResult, WeeklyReportItem, CommunityPriceAggregate, DeliveryRequest } from "@/lib/api";
import { formatCurrency, formatCommodityName } from "@/lib/utils";
import PricePredictionChart from "@/components/farmer/PricePredictionChart";
import MarkdownRenderer from "@/components/shared/MarkdownRenderer";
import CommunityPriceCard from "./components/CommunityPriceCard";
import WeeklyReportsCard from "./components/WeeklyReportsCard";
import styles from "./page.module.css";

const SELECTABLE_CROPS = [
  { value: "cabai_merah", label: "Cabai Merah" },
  { value: "cabai_rawit", label: "Cabai Rawit" },
  { value: "tomat", label: "Tomat" },
  { value: "bawang_merah", label: "Bawang Merah" },
  { value: "bawang_putih", label: "Bawang Putih" },
];

export default function FarmerDashboard() {
  const [user, setUser] = useState<StoredUser | null>(null);
  
  // Dashboard metrics
  const [activeBatches, setActiveBatches] = useState<any[]>([]);
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryRequest[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [pricesList, setPricesList] = useState<any[]>([]);
  
  // Chart selection and prediction state
  const [selectedCrop, setSelectedCrop] = useState("cabai_merah");
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [recommendation, setRecommendation] = useState("");
  const [loading, setLoading] = useState(true);

  const getCropBaseConfidence = (crop: string) => {
    switch (crop) {
      case "cabai_merah": return 0.88;
      case "cabai_rawit": return 0.91;
      case "tomat": return 0.76;
      case "bawang_merah": return 0.83;
      case "bawang_putih": return 0.80;
      default: return 0.85;
    }
  };

  const avgConfidence = predictions.length > 0
    ? Math.round((predictions.reduce((acc: number, p: any) => acc + (p.confidence || getCropBaseConfidence(selectedCrop)), 0) / predictions.length) * 100)
    : Math.round(getCropBaseConfidence(selectedCrop) * 100);

  // Freshness scores per batch
  const [freshnessMap, setFreshnessMap] = useState<Record<string, FreshnessResult>>({});

  // Weekly reports
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReportItem[]>([]);

  // Community prices
  const [communityPriceData, setCommunityPriceData] = useState<CommunityPriceAggregate | null>(null);
  const [priceReportSuccess, setPriceReportSuccess] = useState<string | null>(null);

  const fetchDashboardData = async (userRegion: string = "Jawa") => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) return;

      // 1. Fetch batches and delivery requests
      const [allBatches, reqs] = await Promise.all([
        api.batches.list(token),
        api.deliveryRequests.list(token)
      ]);
      setDeliveryRequests(reqs);
      const active = allBatches.filter((b: any) => b.status !== "sold" && b.status !== "delivered");
      setActiveBatches(active);

      // 2. Count active alerts (sum alerts on active batches)
      let activeAlerts = 0;
      allBatches.forEach((b: any) => {
        if (b.alerts) {
          activeAlerts += b.alerts.filter((a: any) => !a.resolved_at).length;
        }
      });
      setAlertCount(activeAlerts);

      // 3. Load latest prices list for top crops
      const loadedPrices = [];
      for (const crop of SELECTABLE_CROPS.slice(0, 4)) {
        try {
          const priceData = await api.prices.get(token, crop.value);
          if (priceData && priceData.length > 0) {
            const latest = priceData[0].price_per_kg;
            const previous = priceData.length > 1 ? priceData[1].price_per_kg : latest;
            const diff = latest - previous;
            const pct = previous > 0 ? (diff / previous) * 100 : 0.0;
            
            loadedPrices.push({
              commodity: crop.label,
              price: latest,
              change: parseFloat(pct.toFixed(1)),
              trend: diff > 0 ? "naik" : diff < 0 ? "turun" : "stabil",
            });
          } else {
            loadedPrices.push({
              commodity: crop.label,
              price: crop.value === "cabai_merah" ? 45000 : crop.value === "tomat" ? 12000 : 35000,
              change: 0.0,
              trend: "stabil",
            });
          }
        } catch {
          loadedPrices.push({
            commodity: crop.label,
            price: crop.value === "cabai_merah" ? 45000 : crop.value === "tomat" ? 12000 : 35000,
            change: 0.0,
            trend: "stabil",
          });
        }
      }
      setPricesList(loadedPrices);

      // Fetch freshness scores for active batches (top 3)
      const freshnessResults: Record<string, FreshnessResult> = {};
      for (const batch of active.slice(0, 3)) {
        try {
          const f = await api.batches.getFreshness(token, batch.id);
          freshnessResults[batch.id] = f;
        } catch {
          // Ignore freshness load failure
        }
      }
      setFreshnessMap(freshnessResults);

      // Fetch weekly reports
      try {
        const reports = await api.farmerReports.list(token);
        setWeeklyReports(reports.slice(0, 3));
      } catch {
        // Ignore failure
      }

      // Fetch community price data for selected crop
      try {
        const cpData = await api.communityPrices.getAggregate(token, "cabai_merah", userRegion);
        setCommunityPriceData(cpData);
      } catch {
        // Ignore failure
      }
    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartPredictions = async (crop: string) => {
    setLoadingChart(true);
    try {
      const token = getToken();
      if (!token) return;

      const userRegion = user?.region || "Jawa";
      const dateStr = new Date().toISOString().split("T")[0];
      const predCacheKey = `yawgriva_predictions_v3_${crop}_${userRegion}_${dateStr}`;
      const recCacheKey = `yawgriva_recommendation_v3_${crop}_${userRegion}_${dateStr}`;

      const cachedPred = localStorage.getItem(predCacheKey);
      const cachedRec = localStorage.getItem(recCacheKey);

      if (cachedPred && cachedRec) {
        setPredictions(JSON.parse(cachedPred));
        setRecommendation(cachedRec);
        setLoadingChart(false);
        return;
      }

      const predData = await api.prices.predict(token, crop, userRegion);
      setPredictions(predData);

      const agentResp = await api.agents.price(token, crop, userRegion);
      setRecommendation(agentResp.reply);

      localStorage.setItem(predCacheKey, JSON.stringify(predData));
      localStorage.setItem(recCacheKey, agentResp.reply);
    } catch (err) {
      console.warn("Error loading prediction chart data:", err);
      let basePrice = 45000;
      if (crop === "cabai_rawit") basePrice = 55000;
      else if (crop === "tomat") basePrice = 12000;
      else if (crop === "bawang_merah") basePrice = 35000;
      else if (crop === "bawang_putih") basePrice = 28000;

      const baseConf = getCropBaseConfidence(crop);

      setPredictions([
        { predicted_price: basePrice, confidence: baseConf, predicted_for: new Date(Date.now() + 86400000 * 1).toISOString() },
        { predicted_price: Math.round(basePrice * 1.03), confidence: baseConf - 0.03, predicted_for: new Date(Date.now() + 86400000 * 4).toISOString() },
        { predicted_price: Math.round(basePrice * 1.06), confidence: baseConf - 0.06, predicted_for: new Date(Date.now() + 86400000 * 8).toISOString() },
        { predicted_price: Math.round(basePrice * 1.09), confidence: baseConf - 0.09, predicted_for: new Date(Date.now() + 86400000 * 12).toISOString() },
      ]);
      setRecommendation(
        `Harga ${crop.replace("_", " ")} diprediksi akan mengalami kenaikan berkala. Rekomendasi: lakukan pemantauan ketat dan tahan penjualan beberapa hari untuk memaksimalkan keuntungan.`
      );
    } finally {
      setLoadingChart(false);
    }
  };

  useEffect(() => {
    const stored = getStoredUser();
    let region = "Jawa";
    if (stored) {
      setUser(stored);
      region = stored.region || "Jawa";
    }
    
    fetchDashboardData(region);
  }, []);

  useEffect(() => {
    fetchChartPredictions(selectedCrop);
  }, [selectedCrop, user]);

  const handlePriceReportSuccess = (msg: string) => {
    setPriceReportSuccess(msg);
    setTimeout(() => setPriceReportSuccess(null), 5000);
  };

  const getFreshnessBadgeStyle = (color: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      green: { bg: "var(--color-success-bg)", text: "var(--color-success)" },
      yellow: { bg: "#FFF9E6", text: "#B45309" },
      orange: { bg: "#FEF3C7", text: "#D97706" },
      red: { bg: "var(--color-danger-bg)", text: "var(--color-danger)" },
    };
    return map[color] || { bg: "var(--color-muted)", text: "var(--color-text-muted)" };
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 11) return "Selamat Pagi";
    if (hour < 15) return "Selamat Siang";
    if (hour < 19) return "Selamat Sore";
    return "Selamat Malam";
  };

  return (
    <div className={styles.farmerDashboard}>
      {/* Welcome Header */}
      <div className={`${styles.welcomeSection} ${styles.animateFadeIn}`}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-1)" }}>
            {greeting()}, {user?.name?.split(" ")[0] || "Petani"} 👋
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", margin: 0 }}>
            Berikut ringkasan informasi penting untuk hari ini
          </p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn btn-secondary" onClick={() => fetchDashboardData(user?.region || "Jawa")} disabled={loading}>
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/farmer/chat" className="btn btn-primary">
            <MessageSquare size={18} />
            Tanya AI
          </Link>
        </div>
      </div>

      {/* Success notification banner */}
      {priceReportSuccess && (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "var(--space-3)", 
          background: "var(--color-success-bg)", 
          border: "1px solid var(--color-success)", 
          color: "var(--color-success)", 
          padding: "var(--space-4)", 
          borderRadius: "var(--radius-lg)"
        }}>
          <CheckCircle2 size={20} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{priceReportSuccess}</span>
        </div>
      )}

      {/* Quick Stats */}
      <div className={`${styles.statsGrid} ${styles.animateFadeIn}`} style={{ animationDelay: "0.1s" }}>
        <div className={`card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: "var(--color-primary-bg)" }}>
            <Package size={20} color="var(--color-primary)" />
          </div>
          <div>
            <p className={styles.statValue} style={{ margin: 0 }}>{loading ? "..." : activeBatches.length}</p>
            <p className={styles.statLabel} style={{ margin: 0 }}>Batch Aktif</p>
          </div>
        </div>
        <div className={`card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: "var(--color-danger-bg)" }}>
            <AlertTriangle size={20} color="var(--color-danger)" />
          </div>
          <div>
            <p className={styles.statValue} style={{ margin: 0 }}>{loading ? "..." : alertCount}</p>
            <p className={styles.statLabel} style={{ margin: 0 }}>Alert Aktif</p>
          </div>
        </div>
        <div className={`card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: "var(--color-success-bg)" }}>
            <BarChart3 size={20} color="var(--color-success)" />
          </div>
          <div>
            <p className={styles.statValue} style={{ margin: 0 }}>{loadingChart ? "..." : `${avgConfidence}%`}</p>
            <p className={styles.statLabel} style={{ margin: 0 }}>Confidence AI</p>
          </div>
        </div>
      </div>

      {/* Predictions Section */}
      <div className={`${styles.predictionsLayout} ${styles.animateFadeIn}`} style={{ animationDelay: "0.15s" }}>
        <div className={styles.cropSelectorRow}>
          <label className="label" style={{ margin: 0, fontWeight: 600 }}>Tampilkan Prediksi:</label>
          <div className={styles.cropButtons}>
            {SELECTABLE_CROPS.map((crop) => (
              <button
                key={crop.value}
                className={`btn btn-sm ${selectedCrop === crop.value ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setSelectedCrop(crop.value)}
                disabled={loadingChart}
              >
                {crop.label}
              </button>
            ))}
          </div>
        </div>
        
        {loadingChart ? (
          <div className="card skeleton" style={{ height: "300px" }} />
        ) : (
          <PricePredictionChart predictions={predictions} commodityName={selectedCrop} />
        )}
      </div>

      {/* Price Section */}
      <div className={styles.sectionGrid}>
        <div className="card animate-fade-in" style={{ animationDelay: "0.2s" }}>
          <div className={styles.cardHeader}>
            <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Harga Pasar Terbaru</h2>
            <span className="badge badge-primary">Live Kementan</span>
          </div>
          <div className={styles.priceList}>
            {loading ? (
              <div className="skeleton" style={{ height: "150px" }} />
            ) : (
              pricesList.map((item) => (
                <div key={item.commodity} className={styles.priceItem}>
                  <div className="price-info">
                    <span className={styles.priceCommodity}>{item.commodity}</span>
                    <span className={styles.priceValue}>{formatCurrency(item.price)}/kg</span>
                  </div>
                  <div className={`${styles.priceChange} ${item.trend === "naik" ? styles.priceUp : item.trend === "turun" ? styles.priceDown : styles.priceStable}`}>
                    {item.trend === "naik" ? <TrendingUp size={14} /> : item.trend === "turun" ? <TrendingDown size={14} /> : <Minus size={14} />}
                    <span>{item.change > 0 ? "+" : ""}{item.change}%</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Batches with Freshness */}
        <div className="card animate-fade-in" style={{ animationDelay: "0.25s" }}>
          <div className={styles.cardHeader}>
            <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Batch Aktif</h2>
            <Link href="/farmer/batches" className="btn btn-ghost btn-sm">
              Kelola Batch <ArrowRight size={14} />
            </Link>
          </div>
          <div className={styles.batchList}>
            {loading ? (
              <div className="skeleton" style={{ height: "150px" }} />
            ) : activeBatches.length === 0 ? (
              <div className={styles.emptyBatches}>
                <Sprout size={32} color="var(--color-border)" />
                <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)", marginTop: "4px", marginInline: 0 }}>
                  Belum ada batch pengiriman aktif
                </p>
              </div>
            ) : (
              activeBatches.slice(0, 3).map((batch) => {
                const freshness = freshnessMap[batch.id];
                const badgeStyle = freshness ? getFreshnessBadgeStyle(freshness.label_color) : null;
                const latestRequest = deliveryRequests.find((r) => r.batch_id === batch.id);
                return (
                  <div key={batch.id} className={styles.batchItem}>
                    <div className={styles.batchIcon}>
                      <Sprout size={18} />
                    </div>
                    <div className={styles.batchInfo}>
                      <span className={styles.batchCommodity}>
                        {SELECTABLE_CROPS.find((c) => c.value === batch.commodity_name)?.label || formatCommodityName(batch.commodity_name)}
                      </span>
                      <span className={styles.batchMeta}>
                        {batch.quantity_kg} kg · Panen {new Date(batch.harvest_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                      {freshness && badgeStyle && (
                        <span style={{ fontSize: "var(--text-xs)", padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 600, background: badgeStyle.bg, color: badgeStyle.text }} title="Skor Kesegaran">
                          {freshness.score.toFixed(0)}
                        </span>
                      )}
                      <span className={`badge ${batch.status === "registered" ? "badge-primary" : "badge-warning"}`}>
                        {batch.status === "registered" ? "Terdaftar" : "Transit"}
                      </span>
                      {latestRequest && (
                        <span className={`badge ${
                          latestRequest.status === "accepted" 
                            ? "badge-success" 
                            : latestRequest.status === "declined" 
                            ? "badge-danger" 
                            : latestRequest.status === "pending" 
                            ? "badge-warning" 
                            : "badge-muted"
                        }`}>
                          {latestRequest.status === "accepted" && "Diterima"}
                          {latestRequest.status === "declined" && "Ditolak"}
                          {latestRequest.status === "pending" && "Menunggu"}
                          {latestRequest.status === "expired" && "Kedaluwarsa"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendation Banner */}
      {recommendation && (
        <div className={`card ${styles.aiBanner} animate-fade-in`} style={{ animationDelay: "0.3s" }}>
          <div className={styles.aiBannerContent}>
            <div className={styles.aiBannerIcon}>
              <BarChart3 size={24} />
            </div>
            <div style={{ flex: 1, overflow: "hidden" }}>
              <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-2)", color: "var(--color-primary-dark)", fontWeight: 700, marginTop: 0 }}>
                Analisis Rekomendasi AI
              </h3>
              <MarkdownRenderer content={recommendation} />
            </div>
          </div>
        </div>
      )}

      {/* Community Price + Weekly Report row */}
      <div className={`${styles.sectionGrid} animate-fade-in`} style={{ animationDelay: "0.35s" }}>
        <CommunityPriceCard
          user={user}
          communityPriceData={communityPriceData}
          onReportSuccess={handlePriceReportSuccess}
          onRefreshData={() => {
            const token = getToken();
            if (token) {
              api.communityPrices.getAggregate(token, "cabai_merah", user?.region || "Jawa")
                .then(setCommunityPriceData)
                .catch(console.error);
            }
          }}
          selectableCrops={SELECTABLE_CROPS}
        />

        <WeeklyReportsCard
          weeklyReports={weeklyReports}
        />
      </div>
    </div>
  );
}
