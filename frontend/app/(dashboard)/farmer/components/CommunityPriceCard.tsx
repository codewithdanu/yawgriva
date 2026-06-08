"use client";

import React, { useState } from "react";
import { Users, Send, Activity } from "lucide-react";
import { api, CommunityPriceAggregate } from "@/lib/api";
import { getToken, StoredUser } from "@/lib/auth";
import styles from "../page.module.css";

interface CommunityPriceCardProps {
  user: StoredUser | null;
  communityPriceData: CommunityPriceAggregate | null;
  onReportSuccess: (message: string) => void;
  onRefreshData: () => void;
  selectableCrops: { value: string; label: string }[];
}

export default function CommunityPriceCard({
  user,
  communityPriceData,
  onReportSuccess,
  onRefreshData,
  selectableCrops,
}: CommunityPriceCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    commodity_name: "cabai_merah",
    price_per_kg: "",
    market_name: "",
    region: user?.region || "Jawa",
    transaction_type: "tengkulak" as "tengkulak" | "pasar" | "langsung",
  });

  const defaultRegions = ["Jawa", "Sumatera", "Kalimantan", "Sulawesi", "Bali", "NTB", "NTT", "Papua"];
  const selectableRegions = [...defaultRegions];
  if (user?.region && !selectableRegions.includes(user.region)) {
    selectableRegions.push(user.region);
  }

  const handleSubmit = async () => {
    const token = getToken();
    if (!token || !form.price_per_kg) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.communityPrices.submit(token, {
        ...form,
        price_per_kg: parseFloat(form.price_per_kg),
      });
      setShowModal(false);
      const cropLabel = selectableCrops.find(c => c.value === form.commodity_name)?.label || form.commodity_name;
      onReportSuccess(`Laporan harga lapangan untuk ${cropLabel} berhasil dikirim!`);
      setForm(f => ({ ...f, price_per_kg: "" }));
      onRefreshData();
    } catch (err: any) {
      setError(err?.message || "Gagal mengirim laporan harga");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <div className={styles.cardHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--color-primary-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={18} color="var(--color-primary)" />
          </div>
          <h2 style={{ fontSize: "var(--text-lg)", margin: 0 }}>Harga Lapangan</h2>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { setError(null); setShowModal(true); }}
        >
          <Send size={14} /> Laporkan
        </button>
      </div>

      {communityPriceData ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Harga Komunitas</span>
            <span style={{ fontWeight: 700, fontSize: "var(--text-base)", color: communityPriceData.community_price ? "var(--color-text)" : "var(--color-text-muted)" }}>
              {communityPriceData.community_price 
                ? `Rp ${communityPriceData.community_price.toLocaleString("id-ID")}/kg` 
                : "Belum cukup data (min. 3 laporan)"}
            </span>
          </div>
          {communityPriceData.official_price && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Harga Resmi</span>
              <span style={{ fontWeight: 600 }}>Rp {communityPriceData.official_price.toLocaleString("id-ID")}/kg</span>
            </div>
          )}
          {communityPriceData.gap_percent !== null && (
            <div style={{
              padding: "var(--space-3)",
              borderRadius: "var(--radius-md)",
              background: communityPriceData.alert_level === "high" ? "var(--color-danger-bg)" : communityPriceData.alert_level === "medium" ? "#FEF3C7" : "var(--color-success-bg)",
              color: communityPriceData.alert_level === "high" ? "var(--color-danger)" : communityPriceData.alert_level === "medium" ? "#B45309" : "var(--color-success)",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
            }}>
              <Activity size={14} />
              Selisih {communityPriceData.gap_percent > 0 ? "+" : ""}{communityPriceData.gap_percent.toFixed(1)}% dari harga resmi
            </div>
          )}
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>
            Dari {communityPriceData.today_report_count} laporan hari ini
          </p>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
          <Users size={32} color="var(--color-border)" style={{ margin: "0 auto var(--space-2)" }} />
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", margin: "0 0 4px 0" }}>Belum ada laporan harga hari ini</p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", margin: 0 }}>Jadilah yang pertama melaporkan!</p>
        </div>
      )}

      {/* Modal Dialog */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => { setError(null); setShowModal(false); }}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 style={{ margin: 0 }}>Laporkan Harga Lapangan</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setError(null); setShowModal(false); }}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginBottom: "var(--space-4)", margin: "0 0 16px 0" }}>
                Bantu petani lain dengan melaporkan harga aktual di pasar. 1 laporan per komoditas per hari.
              </p>
              {error && (
                <div style={{
                  background: "var(--color-danger-bg)",
                  color: "var(--color-danger)",
                  border: "1px solid var(--color-danger)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  marginBottom: "var(--space-4)"
                }}>
                  {error}
                </div>
              )}
              <div className={styles.formGroup}>
                <label className="label">Komoditas</label>
                <select
                  className="input"
                  value={form.commodity_name}
                  onChange={(e) => setForm(f => ({ ...f, commodity_name: e.target.value }))}
                >
                  {selectableCrops.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.formGroup} style={{ marginTop: "12px" }}>
                <label className="label">Harga (Rp/kg)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Contoh: 45000"
                  value={form.price_per_kg}
                  onChange={(e) => setForm(f => ({ ...f, price_per_kg: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup} style={{ marginTop: "12px" }}>
                <label className="label">Nama Pasar (opsional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Contoh: Pasar Wage Purwokerto"
                  value={form.market_name}
                  onChange={(e) => setForm(f => ({ ...f, market_name: e.target.value }))}
                />
              </div>
              <div className={styles.formGroup} style={{ marginTop: "12px" }}>
                <label className="label">Jenis Transaksi</label>
                <select
                  className="input"
                  value={form.transaction_type}
                  onChange={(e) => setForm(f => ({ ...f, transaction_type: e.target.value as "tengkulak" | "pasar" | "langsung" }))}
                >
                  <option value="tengkulak">Ke Tengkulak</option>
                  <option value="pasar">Di Pasar</option>
                  <option value="langsung">Langsung ke Konsumen</option>
                </select>
              </div>
              <div className={styles.formGroup} style={{ marginTop: "12px" }}>
                <label className="label">Region</label>
                <select
                  className="input"
                  value={form.region}
                  onChange={(e) => setForm(f => ({ ...f, region: e.target.value }))}
                >
                  {selectableRegions.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => { setError(null); setShowModal(false); }}>Batal</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={submitting || !form.price_per_kg}
              >
                {submitting ? "Mengirim..." : "Kirim Laporan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
