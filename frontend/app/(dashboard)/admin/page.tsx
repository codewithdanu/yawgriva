"use client";

import { useState, useEffect } from "react";
import { getToken, removeToken } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { 
  api, 
  AgentHealth, 
  Alert, 
  CommunityPriceReport 
} from "@/lib/api";
import {
  Users,
  Package,
  AlertTriangle,
  Activity,
  Shield,
  Cpu,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatCommodityName, formatAlertType } from "@/lib/utils";

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<{ total_users: number; total_batches: number; active_alerts: number } | null>(null);
  const [agentHealth, setAgentHealth] = useState<AgentHealth[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [outliers, setOutliers] = useState<CommunityPriceReport[]>([]);
  
  const [mainModel, setMainModel] = useState<string>("gemini");
  const [savingModel, setSavingModel] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"auth" | "network" | "unknown">("unknown");
  const [activeOutlierTab, setActiveOutlierTab] = useState<"suspect" | "rejected">("suspect");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  async function handleTriggerScan() {
    setScanning(true);
    setScanResult(null);
    try {
      const token = getToken();
      if (!token) return;
      const res = await api.admin.triggerScan(token);
      setScanResult(`Scan selesai: Memindai ${res.scanned_count} batch aktif. Ditemukan ${res.alerts_created} anomali baru.`);
      
      const updatedAlerts = await api.admin.alerts(token);
      setAlerts(updatedAlerts);
      
      const updatedOverview = await api.admin.overview(token);
      setOverview(updatedOverview);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      alert("Gagal menjalankan scan: " + errMsg);
    } finally {
      setScanning(false);
    }
  }


  async function loadDashboardData() {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) {
        router.push("/login");
        return;
      }

      const [overviewData, healthData, alertsData, outliersData, modelData] = await Promise.all([
        api.admin.overview(token),
        api.agents.health(token),
        api.admin.alerts(token),
        api.admin.listOutliers(token),
        api.admin.getAiModel(token),
      ]);

      setOverview(overviewData);
      setAgentHealth(healthData);
      setAlerts(alertsData);
      setOutliers(outliersData);
      setMainModel(modelData.main_model);
    } catch (err: unknown) {
      console.error(err);
      // Determine error type for better user guidance
      if (err && typeof err === "object" && "status" in err) {
        const status = (err as { status: number }).status;
        if (status === 401) {
          setErrorType("auth");
          setError("Sesi Anda telah kedaluwarsa. Silakan login kembali.");
        } else if (status === 403) {
          setErrorType("auth");
          setError("Akses ditolak. Pastikan akun Anda memiliki role admin yang benar.");
        } else {
          setErrorType("network");
          setError(`Server error (${status}). Coba lagi beberapa saat.`);
        }
      } else if (err instanceof TypeError && err.message.includes("fetch")) {
        setErrorType("network");
        setError("Tidak dapat terhubung ke server. Pastikan server backend berjalan di port 8000.");
      } else {
        setErrorType("unknown");
        setError("Terjadi kesalahan saat memuat data. Silakan coba lagi.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResolveAlert(alertId: string) {
    setActionId(alertId);
    try {
      const token = getToken();
      if (!token) return;
      await api.admin.resolveAlert(token, alertId);
      
      const updatedAlerts = await api.admin.alerts(token);
      setAlerts(updatedAlerts);
      
      const updatedOverview = await api.admin.overview(token);
      setOverview(updatedOverview);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      alert("Gagal me-resolve alert: " + errMsg);
    } finally {
      setActionId(null);
    }
  }

  async function handleValidateOutlier(reportId: string) {
    setActionId(reportId);
    try {
      const token = getToken();
      if (!token) return;
      await api.admin.validateOutlier(token, reportId);
      
      const updatedOutliers = await api.admin.listOutliers(token);
      setOutliers(updatedOutliers);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      alert("Gagal memvalidasi laporan harga: " + errMsg);
    } finally {
      setActionId(null);
    }
  }

  async function handleRejectOutlier(reportId: string) {
    setActionId(reportId);
    try {
      const token = getToken();
      if (!token) return;
      await api.admin.rejectOutlier(token, reportId);
      
      const updatedOutliers = await api.admin.listOutliers(token);
      setOutliers(updatedOutliers);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      alert("Gagal menolak laporan harga: " + errMsg);
    } finally {
      setActionId(null);
    }
  }

  async function handleSaveModelSettings(selectedModel: string) {
    setSavingModel(true);
    setSaveSuccess(false);
    try {
      const token = getToken();
      if (!token) return;
      await api.admin.updateAiModel(token, selectedModel);
      setMainModel(selectedModel);
      setSaveSuccess(true);
      // Automatically refresh the agent health data to show the updated model
      const updatedHealth = await api.agents.health(token);
      setAgentHealth(updatedHealth);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      alert("Gagal memperbarui model AI utama: " + errMsg);
    } finally {
      setSavingModel(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboardData();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const totalPagesCount = Math.ceil(alerts.length / itemsPerPage);
    if (currentPage > 1 && currentPage > totalPagesCount) {
      setCurrentPage(totalPagesCount || 1);
    }
  }, [alerts.length, currentPage]);

  const getAgentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "price":
        return <Activity size={20} />;
      case "logistics":
        return <Shield size={20} />;
      case "anomaly":
        return <Cpu size={20} />;
      default:
        return <Cpu size={20} />;
    }
  };

  const getAgentTitle = (type: string) => {
    switch (type.toLowerCase()) {
      case "price":
        return "Price Intelligence Agent";
      case "logistics":
        return "Logistics Routing Agent";
      case "anomaly":
        return "Anomaly Detection Agent";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1) + " Agent";
    }
  };

  function formatIDR(value: number) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "var(--space-4)" }}>
        <Loader2 className="animate-spin" size={40} style={{ color: "var(--color-primary)" }} />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Memuat data dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "var(--space-4)", padding: "var(--space-6)" }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: errorType === "auth" ? "var(--color-warning-bg)" : "var(--color-danger-bg)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={36} style={{ color: errorType === "auth" ? "var(--color-warning)" : "var(--color-danger)" }} />
        </div>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <p style={{ fontSize: "var(--text-base)", color: "var(--color-text)", fontWeight: 600, margin: "0 0 var(--space-2)" }}>
            {errorType === "auth" ? "Akses Ditolak" : errorType === "network" ? "Koneksi Gagal" : "Gagal Memuat Data"}
          </p>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: 0 }}>{error}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {errorType === "auth" ? (
            <button 
              onClick={() => { removeToken(); router.push("/login"); }}
              style={{
                padding: "8px 20px",
                background: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
              }}
            >
              Login Ulang
            </button>
          ) : (
            <button 
              onClick={loadDashboardData}
              style={{
                padding: "8px 20px",
                background: "var(--color-primary)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
              }}
            >
              Coba Lagi
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalCallsToday = agentHealth.reduce((acc, curr) => acc + curr.total_calls_today, 0);
  const filteredOutliers = outliers.filter(o => o.status === activeOutlierTab);

  const totalPages = Math.ceil(alerts.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAlerts = alerts.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <div className="animate-fade-in" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-1)" }}>
            System Overview
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
            Monitoring kesehatan sistem dan aktivitas agent
          </p>
        </div>
        <button 
          onClick={loadDashboardData}
          style={{
            padding: "8px 14px",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--color-text)"
          }}
        >
          <RefreshCw size={12} />
          Refresh Data
        </button>
      </div>

      {/* System Stats */}
      <div className="stats-grid animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "var(--color-primary-bg)" }}>
            <Users size={20} color="var(--color-primary)" />
          </div>
          <div>
            <p className="stat-value">{overview ? overview.total_users : "-"}</p>
            <p className="stat-label">Total Users</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "var(--color-warning-bg)" }}>
            <Package size={20} color="var(--color-warning)" />
          </div>
          <div>
            <p className="stat-value">{overview ? overview.total_batches : "-"}</p>
            <p className="stat-label">Total Batches</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "var(--color-danger-bg)" }}>
            <AlertTriangle size={20} color="var(--color-danger)" />
          </div>
          <div>
            <p className="stat-value">{overview ? overview.active_alerts : "-"}</p>
            <p className="stat-label">Active Alerts</p>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "var(--color-success-bg)" }}>
            <Zap size={20} color="var(--color-success)" />
          </div>
          <div>
            <p className="stat-value">{totalCallsToday}</p>
            <p className="stat-label">API Calls Today</p>
          </div>
        </div>
      </div>

      {/* AI Model Settings */}
      <div className="card animate-fade-in" style={{ animationDelay: "0.12s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-4)" }}>
          <div>
            <h2 style={{ fontSize: "var(--text-lg)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Cpu size={20} style={{ color: "var(--color-primary)" }} />
              Konfigurasi Model AI Utama
            </h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)", marginTop: "2px" }}>
              Pilih provider model AI utama yang akan dihubungi terlebih dahulu oleh sistem Orchestrator Agen Yawgriva.
            </p>
          </div>
          {saveSuccess && (
            <span style={{
              fontSize: "var(--text-xs)",
              background: "var(--color-success-bg)",
              color: "var(--color-success)",
              padding: "4px 10px",
              borderRadius: "var(--radius-md)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}>
              <CheckCircle2 size={12} /> Pengaturan disimpan!
            </span>
          )}
        </div>
        
        <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-4)", flexWrap: "wrap" }}>
          <button
            onClick={() => handleSaveModelSettings("gemini")}
            disabled={savingModel || mainModel === "gemini"}
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "var(--space-4)",
              background: mainModel === "gemini" ? "var(--color-primary-bg)" : "var(--color-surface)",
              border: mainModel === "gemini" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              textAlign: "left",
              cursor: savingModel ? "not-allowed" : "pointer",
              transition: "all var(--transition-fast)",
              position: "relative",
              opacity: savingModel ? 0.7 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <strong style={{ fontSize: "var(--text-sm)", color: mainModel === "gemini" ? "var(--color-primary)" : "var(--color-text)" }}>Google Gemini</strong>
              {mainModel === "gemini" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary)" }} />}
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              Menggunakan keluarga model Gemini 2.5/3.5 Flash sebagai pemroses utama (sangat cepat & efisien biaya).
            </p>
          </button>

          <button
            onClick={() => handleSaveModelSettings("openai")}
            disabled={savingModel || mainModel === "openai"}
            style={{
              flex: 1,
              minWidth: "200px",
              padding: "var(--space-4)",
              background: mainModel === "openai" ? "var(--color-primary-bg)" : "var(--color-surface)",
              border: mainModel === "openai" ? "2px solid var(--color-primary)" : "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              textAlign: "left",
              cursor: savingModel ? "not-allowed" : "pointer",
              transition: "all var(--transition-fast)",
              position: "relative",
              opacity: savingModel ? 0.7 : 1,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <strong style={{ fontSize: "var(--text-sm)", color: mainModel === "openai" ? "var(--color-primary)" : "var(--color-text)" }}>OpenAI GPT-4o-mini</strong>
              {mainModel === "openai" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary)" }} />}
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
              Menggunakan model GPT-4o-mini dari OpenAI sebagai pemroses utama (tingkat akurasi tinggi & andal).
            </p>
          </button>
        </div>
      </div>

      {/* Agent Health */}
      <div className="card animate-fade-in" style={{ animationDelay: "0.15s" }}>
        <h2 style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
          AI Agent Health
        </h2>
        <div className="agent-grid">
          {agentHealth.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)" }}>
              Tidak ada data kesehatan agent.
            </div>
          ) : (
            agentHealth.map((agent) => (
              <div key={agent.agent_type} className="agent-card">
                <div className="agent-header">
                  <div className="agent-icon">{getAgentIcon(agent.agent_type)}</div>
                  <div>
                    <h3 className="agent-name">{getAgentTitle(agent.agent_type)}</h3>
                    <div className="agent-status">
                      <span className={`status-dot ${agent.status === "online" ? "status-online" : "status-offline"}`} />
                      <span style={{ textTransform: "capitalize" }}>{agent.status}</span>
                    </div>
                  </div>
                </div>
                <div className="agent-metrics">
                  <div className="agent-metric">
                    <Clock size={12} />
                    <span>{agent.avg_latency_ms ? `${Math.round(agent.avg_latency_ms)}ms avg` : "N/A"}</span>
                  </div>
                  <div className="agent-metric">
                    <Zap size={12} />
                    <span>{agent.total_calls_today} calls today</span>
                  </div>
                  <div className="agent-metric">
                    <Cpu size={12} />
                    <span>{agent.primary_model}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Community Price Outliers Moderation */}
      <div className="card animate-fade-in" style={{ animationDelay: "0.2s" }}>
        <div style={{ marginBottom: "var(--space-4)" }}>
          <h2 style={{ fontSize: "var(--text-lg)" }}>
            Validasi Outlier Harga Komunitas
          </h2>
          <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)", marginTop: "2px" }}>
            Moderasi laporan harga crowdsourced dari petani yang terdeteksi tidak wajar
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--color-border)", marginBottom: "var(--space-4)", gap: "var(--space-6)" }}>
          <button
            onClick={() => setActiveOutlierTab("suspect")}
            style={{
              paddingBottom: "var(--space-2)",
              borderBottom: activeOutlierTab === "suspect" ? "2px solid var(--color-primary)" : "none",
              color: activeOutlierTab === "suspect" ? "var(--color-primary)" : "var(--color-text-muted)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Perlu Ditinjau ({outliers.filter(o => o.status === "suspect").length})
          </button>
          <button
            onClick={() => setActiveOutlierTab("rejected")}
            style={{
              paddingBottom: "var(--space-2)",
              borderBottom: activeOutlierTab === "rejected" ? "2px solid var(--color-primary)" : "none",
              color: activeOutlierTab === "rejected" ? "var(--color-primary)" : "var(--color-text-muted)",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              fontWeight: 600,
              fontSize: "var(--text-sm)",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Ditolak ({outliers.filter(o => o.status === "rejected").length})
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ overflowX: "auto" }}>
          {filteredOutliers.length === 0 ? (
            <div style={{ padding: "var(--space-8) var(--space-4)", textAlign: "center", color: "var(--color-text-muted)", background: "var(--color-muted)", borderRadius: "var(--radius-lg)" }}>
              <CheckCircle2 size={36} color="var(--color-success)" style={{ margin: "0 auto var(--space-3)" }} />
              <p style={{ fontSize: "var(--text-sm)", fontWeight: 550 }}>
                {activeOutlierTab === "suspect" 
                  ? "Semua laporan harga aman. Tidak ada outlier baru untuk diverifikasi." 
                  : "Tidak ada riwayat laporan harga yang ditolak."}
              </p>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Komoditas</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Harga</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Wilayah & Pasar</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Transaksi</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Bobot</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600 }}>Waktu Lapor</th>
                  <th style={{ padding: "12px 16px", fontWeight: 600, textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutliers.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                      <span>{formatCommodityName(o.commodity_name)}</span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text)", fontWeight: 500 }}>
                      {formatIDR(o.price_per_kg)}/kg
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-muted)" }}>
                      <div>{o.region}</div>
                      <div style={{ fontSize: "var(--text-xs)" }}>{o.market_name || "Pasar Umum"}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "4px 8px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "var(--text-xs)",
                        fontWeight: 600,
                        textTransform: "capitalize",
                        background: o.transaction_type === "tengkulak" ? "#FFFBEB" : o.transaction_type === "pasar" ? "#EFF6FF" : "#ECFDF5",
                        color: o.transaction_type === "tengkulak" ? "#B45309" : o.transaction_type === "pasar" ? "#1D4ED8" : "#047857",
                        border: "1px solid",
                        borderColor: o.transaction_type === "tengkulak" ? "#FDE68A" : o.transaction_type === "pasar" ? "#BFDBFE" : "#A7F3D0",
                      }}>
                        {o.transaction_type}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--color-text-muted)" }}>
                      {o.reporter_weight.toFixed(1)}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                      {new Date(o.reported_at).toLocaleDateString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                        {activeOutlierTab === "suspect" ? (
                          <>
                            <button
                              onClick={() => handleValidateOutlier(o.id)}
                              disabled={actionId === o.id}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "var(--radius-full)",
                                border: "1px solid var(--color-success)",
                                color: "var(--color-success)",
                                background: "none",
                                fontSize: "var(--text-xs)",
                                fontWeight: 600,
                                cursor: actionId === o.id ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                opacity: actionId === o.id ? 0.6 : 1,
                              }}
                            >
                              {actionId === o.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={12} />
                              )}
                              Setujui
                            </button>
                            <button
                              onClick={() => handleRejectOutlier(o.id)}
                              disabled={actionId === o.id}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "var(--radius-full)",
                                border: "1px solid var(--color-danger)",
                                color: "var(--color-danger)",
                                background: "none",
                                fontSize: "var(--text-xs)",
                                fontWeight: 600,
                                cursor: actionId === o.id ? "not-allowed" : "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                opacity: actionId === o.id ? 0.6 : 1,
                              }}
                            >
                              {actionId === o.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <XCircle size={12} />
                              )}
                              Tolak
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleValidateOutlier(o.id)}
                            disabled={actionId === o.id}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "var(--radius-full)",
                              border: "1px solid var(--color-primary)",
                              color: "var(--color-primary)",
                              background: "none",
                              fontSize: "var(--text-xs)",
                              fontWeight: 600,
                              cursor: actionId === o.id ? "not-allowed" : "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              opacity: actionId === o.id ? 0.6 : 1,
                            }}
                          >
                            {actionId === o.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            Pulihkan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="card animate-fade-in" style={{ animationDelay: "0.25s" }}>
        <div className="alerts-header">
          <div>
            <h2 style={{ fontSize: "var(--text-lg)" }}>
              Recent Alerts
            </h2>
            <p style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)", marginTop: "2px" }}>
              Log anomali aktif yang terdeteksi oleh Anomaly Detection Agent
            </p>
          </div>
          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className="scan-btn"
          >
            {scanning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Memindai...
              </>
            ) : (
              <>
                <Cpu size={12} />
                Jalankan Scan Anomali Sekarang
              </>
            )}
          </button>
        </div>

        {scanResult && (
          <div style={{
            padding: "8px 12px",
            background: "var(--color-success-bg)",
            color: "var(--color-success)",
            border: "1px solid var(--color-success)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--text-xs)",
            marginBottom: "var(--space-4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <span>{scanResult}</span>
            <button 
              onClick={() => setScanResult(null)}
              style={{ background: "none", border: "none", color: "var(--color-success)", cursor: "pointer", fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        <div className="alert-list">
          {currentAlerts.length === 0 ? (
            <div style={{ color: "var(--color-text-muted)", fontSize: "var(--text-sm)", padding: "var(--space-2) 0" }}>
              Tidak ada alert aktif saat ini.
            </div>
          ) : (
            currentAlerts.map((alert) => {
              const severityClass = alert.severity === "high" ? "severity-high" : alert.severity === "medium" ? "severity-medium" : "severity-low";
              const severityBadge = alert.severity === "high" ? "badge-danger" : alert.severity === "medium" ? "badge-warning" : "badge-info";
              return (
                <div key={alert.id} className="alert-item">
                  <div className="alert-left">
                    <div className={`alert-severity ${severityClass}`} style={{
                      background: alert.severity === "high" ? "var(--color-danger-bg)" : alert.severity === "medium" ? "var(--color-warning-bg)" : "#EFF6FF",
                      color: alert.severity === "high" ? "var(--color-danger)" : alert.severity === "medium" ? "var(--color-warning)" : "#1E40AF",
                    }}>
                      <AlertTriangle size={14} />
                    </div>
                    <div className="alert-content">
                      <span className="alert-message" style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 550 }}>{alert.message}</span>
                      <span className="alert-meta" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                        <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{formatAlertType(alert.alert_type)}</span>
                        <span>•</span>
                        {alert.commodity_name && (
                          <>
                            <span>Batch: <strong>{formatCommodityName(alert.commodity_name)}</strong></span>
                            <span>•</span>
                          </>
                        )}
                        {alert.farmer_name && (
                          <>
                            <span>Petani: <strong>{alert.farmer_name}</strong></span>
                            <span>•</span>
                          </>
                        )}
                        <span>{new Date(alert.created_at).toLocaleDateString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}</span>
                      </span>
                    </div>
                  </div>
                  <div className="alert-right">
                    <span className={`badge ${severityBadge}`} style={{
                      textTransform: "capitalize",
                      background: alert.severity === "high" ? "var(--color-danger-bg)" : alert.severity === "medium" ? "var(--color-warning-bg)" : "#EFF6FF",
                      color: alert.severity === "high" ? "var(--color-danger)" : alert.severity === "medium" ? "var(--color-warning)" : "#1E40AF",
                      border: "1px solid",
                      borderColor: alert.severity === "high" ? "var(--color-danger)" : alert.severity === "medium" ? "var(--color-warning)" : "#BFDBFE",
                    }}>
                      {alert.severity}
                    </span>
                    {alert.resolved_at ? (
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-success)", display: "flex", alignItems: "center", gap: "4px", fontWeight: 600 }}>
                        <CheckCircle2 size={12} /> Resolved
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        disabled={actionId === alert.id}
                        className="resolve-btn"
                      >
                        {actionId === alert.id ? "Loading..." : "Resolve"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "var(--space-4)",
            marginTop: "var(--space-4)",
            borderTop: "1px solid var(--color-border)",
            fontSize: "var(--text-sm)"
          }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: currentPage === 1 ? "var(--color-text-muted)" : "var(--color-text)",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                fontWeight: 550,
                opacity: currentPage === 1 ? 0.5 : 1,
                transition: "all 0.2s"
              }}
            >
              Sebelumnya
            </button>
            <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
              Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({alerts.length} alert)
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: currentPage === totalPages ? "var(--color-text-muted)" : "var(--color-text)",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                fontWeight: 550,
                opacity: currentPage === totalPages ? 0.5 : 1,
                transition: "all 0.2s"
              }}
            >
              Selanjutnya
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .admin-dashboard {
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: var(--space-4);
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .stat-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-value {
          font-size: var(--text-xl);
          font-weight: 700;
          line-height: 1.2;
        }

        .stat-label {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        /* Agents */
        .agent-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--space-4);
        }

        .agent-card {
          padding: var(--space-4);
          background: var(--color-muted);
          border-radius: var(--radius-lg);
        }

        .agent-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .agent-icon {
          width: 40px;
          height: 40px;
          background: var(--color-primary-bg);
          color: var(--color-primary);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .agent-name {
          font-size: var(--text-sm);
          font-weight: 600;
        }

        .agent-status {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: var(--radius-full);
        }

        .status-online {
          background: var(--color-success);
          box-shadow: 0 0 6px rgba(22, 163, 74, 0.4);
        }

        .status-offline {
          background: var(--color-danger);
        }

        .agent-metrics {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .agent-metric {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-xs);
          color: var(--color-text-muted);
        }

        .alerts-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-4);
          margin-bottom: var(--space-4);
        }

        .scan-btn {
          padding: 6px 12px;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: var(--radius-md);
          font-size: var(--text-xs);
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .scan-btn:hover {
          opacity: 0.9;
        }

        .scan-btn:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        /* Alerts */
        .alert-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .alert-item {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-3);
          background: var(--color-muted);
          border-radius: var(--radius-md);
        }

        .alert-left {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          flex: 1;
        }

        .alert-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          flex-shrink: 0;
        }

        .resolve-btn {
          padding: 4px 10px;
          border-radius: var(--radius-full);
          border: 1px solid var(--color-primary);
          color: var(--color-primary);
          background: none;
          font-size: var(--text-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .resolve-btn:hover {
          background: var(--color-primary-bg);
        }

        .resolve-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .alert-severity {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .severity-high {
          background: var(--color-danger-bg);
          color: var(--color-danger);
        }

        .severity-medium {
          background: var(--color-warning-bg);
          color: var(--color-warning);
        }

        .severity-low {
          background: #EFF6FF;
          color: #1E40AF;
        }

        .alert-content {
          flex: 1;
        }

        @media (max-width: 1024px) {
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .agent-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .alerts-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-3);
          }

          .scan-btn {
            width: 100%;
            justify-content: center;
          }

          .alert-item {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-3);
          }

          .alert-right {
            justify-content: flex-end;
            border-top: 1px solid var(--color-border);
            padding-top: var(--space-2);
            width: 100%;
          }
        }

        @media (max-width: 560px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
