"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { api, AgentLog, AgentHealth } from "@/lib/api";
import {
  Activity,
  Loader2,
  AlertCircle,
  Cpu,
  Clock,
  Zap,
  CheckCircle,
  Terminal,
  Database
} from "lucide-react";
import LogDetailModal from "./components/LogDetailModal";
import styles from "./page.module.css";

export default function AgentLogsPage() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [health, setHealth] = useState<AgentHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AgentLog | null>(null);

  // Filter & Pagination States
  const [agentFilter, setAgentFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) return;

      const [logsData, healthData] = await Promise.all([
        api.agents.logs(token),
        api.agents.health(token)
      ]);

      setLogs(logsData);
      setHealth(healthData);
    } catch (err: any) {
      console.error(err);
      setError("Gagal memuat log aktivitas AI agent. Pastikan hak akses admin Anda aktif.");
    } finally {
      setLoading(false);
    }
  }

  const getAgentColor = (type: string) => {
    switch (type) {
      case "price":
        return { bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" };
      case "logistics":
        return { bg: "#EFF6FF", text: "#1E40AF", border: "#BFDBFE" };
      case "anomaly":
        return { bg: "#FFF1F2", text: "#9F1239", border: "#FECDD3" };
      default:
        return { bg: "#F4F4F5", text: "#71717A", border: "#E4E4E7" };
    }
  };

  // Calculate filter matching
  const filteredLogs = logs.filter((l) => {
    const matchesAgent = agentFilter === "all" || l.agent_type === agentFilter;
    const matchesModel = modelFilter === "all" || l.model_used === modelFilter;
    const matchesSearch = searchQuery === "" ||
      l.agent_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (l.model_used && l.model_used.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (l.output_summary && l.output_summary.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesAgent && matchesModel && matchesSearch;
  });

  // Calculate paginated logs
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);

  // Dynamically extract unique models
  const uniqueModels = Array.from(new Set(logs.map(l => l.model_used).filter(Boolean))) as string[];

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "var(--space-4)" }}>
        <Loader2 className="animate-spin" size={40} style={{ color: "var(--color-primary)" }} />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Memuat log aktivitas agent...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "var(--space-12)", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-text)" }}>Log Aktivitas Agent</h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Pantau audit log, token usage, model yang aktif digunakan, dan kecepatan latensi AI Agent.
        </p>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)" }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 550 }}>{error}</span>
        </div>
      )}

      {/* Grid: Health Panels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
        {health.map((h) => {
          const colors = getAgentColor(h.agent_type);
          return (
            <div key={h.agent_type} style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{
                  padding: "4px 10px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  background: colors.bg,
                  color: colors.text,
                  border: `1px solid ${colors.border}`
                }}>
                  {h.agent_type} Agent
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: h.status === "online" ? "var(--color-success)" : "var(--color-danger)" }} />
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, textTransform: "capitalize" }}>{h.status}</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)", marginTop: "var(--space-1)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "10px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}><Clock size={10} /> Latency</span>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{h.avg_latency_ms ? `${h.avg_latency_ms}ms` : "-"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "10px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}><Zap size={10} /> Total Calls</span>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700 }}>{h.total_calls_today}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "10px", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: "4px" }}><Cpu size={10} /> Model</span>
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.primary_model}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters Bar */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "var(--space-4)",
        background: "var(--color-surface)",
        padding: "var(--space-5)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--color-border)",
        alignItems: "center"
      }}>
        {/* Search */}
        <div style={{ flex: "2 1 300px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-muted)" }}>Cari Log</label>
          <input
            type="text"
            placeholder="Cari kata kunci respons, model, atau agent..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-sm)",
              background: "var(--color-muted)",
              color: "var(--color-text)",
              outline: "none",
              width: "100%"
            }}
          />
        </div>

        {/* Agent Filter */}
        <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-muted)" }}>Tipe Agent</label>
          <select
            value={agentFilter}
            onChange={(e) => { setAgentFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-sm)",
              background: "var(--color-muted)",
              color: "var(--color-text)",
              outline: "none",
              cursor: "pointer",
              width: "100%"
            }}
          >
            <option value="all">Semua Agent</option>
            <option value="price">Price Agent</option>
            <option value="logistics">Logistics Agent</option>
            <option value="anomaly">Anomaly Agent</option>
          </select>
        </div>

        {/* Model Filter */}
        <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-muted)" }}>Model AI</label>
          <select
            value={modelFilter}
            onChange={(e) => { setModelFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              fontSize: "var(--text-sm)",
              background: "var(--color-muted)",
              color: "var(--color-text)",
              outline: "none",
              cursor: "pointer",
              width: "100%"
            }}
          >
            <option value="all">Semua Model</option>
            {uniqueModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Terminal size={18} style={{ color: "var(--color-primary)" }} />
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>Audit Logs Aktivitas</h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ background: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "12px 24px", fontWeight: 600, color: "var(--color-text)", width: "140px" }}>Waktu</th>
                <th style={{ padding: "12px 24px", fontWeight: 600, color: "var(--color-text)", width: "130px" }}>Agent</th>
                <th style={{ padding: "12px 24px", fontWeight: 600, color: "var(--color-text)", width: "160px" }}>Model</th>
                <th style={{ padding: "12px 24px", fontWeight: 600, color: "var(--color-text)", width: "100px" }}>Latency</th>
                <th style={{ padding: "12px 24px", fontWeight: 600, color: "var(--color-text)", width: "100px" }}>Tokens</th>
                <th style={{ padding: "12px 24px", fontWeight: 600, color: "var(--color-text)" }}>Ringkasan Respons</th>
              </tr>
            </thead>
            <tbody>
              {currentLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>
                    Tidak ada log aktivitas tercatat yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                currentLogs.map((l) => {
                  const colors = getAgentColor(l.agent_type);
                  return (
                    <tr
                      key={l.id}
                      className={styles.auditRow}
                      onClick={() => setSelectedLog(l)}
                      style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)" }}
                    >
                      {/* Waktu */}
                      <td style={{ padding: "12px 24px", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(l.created_at).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        })} - {new Date(l.created_at).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short"
                        })}
                      </td>

                      {/* Agent Type */}
                      <td style={{ padding: "12px 24px" }}>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "var(--radius-sm)",
                          fontSize: "10px",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          background: colors.bg,
                          color: colors.text,
                          border: `1px solid ${colors.border}`
                        }}>
                          {l.agent_type}
                        </span>
                      </td>

                      {/* Model Used */}
                      <td style={{ padding: "12px 24px", fontWeight: 550, color: "var(--color-text-muted)" }}>
                        {l.model_used || "-"}
                      </td>

                      {/* Latency */}
                      <td style={{ padding: "12px 24px", fontWeight: 600 }}>
                        {l.latency_ms !== null ? `${l.latency_ms} ms` : "-"}
                      </td>

                      {/* Tokens Used */}
                      <td style={{ padding: "12px 24px", color: "var(--color-text-muted)" }}>
                        {l.tokens_used !== null ? l.tokens_used : "-"}
                      </td>

                      {/* Output Summary */}
                      <td style={{ padding: "12px 24px", color: "var(--color-text)", maxWidth: "350px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.output_summary || "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 24px",
            borderTop: "1px solid var(--color-border)",
            background: "var(--color-muted)",
            fontSize: "var(--text-sm)"
          }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "white",
                color: currentPage === 1 ? "var(--color-text-muted)" : "var(--color-text)",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                fontWeight: 550,
                opacity: currentPage === 1 ? 0.5 : 1,
                transition: "all 0.2s"
              }}
            >
              Sebelumnya
            </button>
            <span style={{ color: "var(--color-text-muted)" }}>
              Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredLogs.length} log)
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--color-border)",
                background: "white",
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

      {/* Log Detail Modal */}
      {selectedLog && (
        <LogDetailModal
          selectedLog={selectedLog}
          onClose={() => setSelectedLog(null)}
          getAgentColor={getAgentColor}
        />
      )}
    </div>
  );
}
