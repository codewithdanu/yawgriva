"use client";

import { useState, useEffect } from "react";
import { getToken, getStoredUser, setStoredUser } from "@/lib/auth";
import { api, UserProfile } from "@/lib/api";
import { INDONESIA_PROVINCES } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";
import { 
  User, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";

export default function AdminProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) return;
      
      const data = await api.auth.getProfile(token);
      setProfile(data);
      
      // Initialize form
      setName(data.name || "");
      setPhone(data.phone || "");
      setRegion(data.region || "");
    } catch (err: any) {
      console.error(err);
      setError("Gagal memuat profil admin. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = getToken();
      if (!token) return;

      const updateData = {
        name,
        phone: phone || null,
        region: region || null,
      };

      const updated = await api.auth.updateProfile(token, updateData);
      setProfile(updated);

      // Update stored user details for layout
      const stored = getStoredUser();
      if (stored) {
        setStoredUser({
          ...stored,
          name: updated.name,
          region: updated.region,
        });
      }

      setSuccess("Profil admin berhasil disimpan!");
      window.scrollTo({ top: 0, behavior: "smooth" });
      
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Gagal menyimpan profil. Silakan periksa kembali inputan Anda.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "var(--space-4)" }}>
        <Loader2 className="animate-spin" size={40} style={{ color: "var(--color-primary)" }} />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Memuat data profil...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", paddingBottom: "var(--space-12)", padding: "var(--space-6)" }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 700, color: "var(--color-text)" }}>Profil Admin</h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Kelola informasi akun administrator Yawgriva Anda.
        </p>
      </div>

      {/* Notifications */}
      {success && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "var(--color-success-bg)", border: "1px solid var(--color-success)", color: "var(--color-success)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", marginBottom: "var(--space-6)" }}>
          <CheckCircle2 size={20} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 550 }}>{success}</span>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", marginBottom: "var(--space-6)" }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 550 }}>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
        
        {/* Card: Account Info */}
        <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-4)" }}>
            <div style={{ padding: "8px", borderRadius: "var(--radius-md)", background: "var(--color-primary-bg)", color: "var(--color-primary)" }}>
              <User size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: "var(--text-lg)", fontWeight: 600 }}>Informasi Akun</h3>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Detail pengguna administrator</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            {/* Name */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text)" }}>Nama Lengkap</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", outline: "none" }}
              />
            </div>

            {/* Email (Readonly) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text)" }}>Email (Tidak dapat diubah)</label>
              <input
                type="email"
                disabled
                value={profile?.email || ""}
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", background: "var(--color-muted)", color: "var(--color-text-muted)", cursor: "not-allowed" }}
              />
            </div>

            {/* Phone */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text)" }}>Nomor Telepon</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Contoh: 08123456789"
                style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)", outline: "none" }}
              />
            </div>

            {/* Region */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text)" }}>Wilayah</label>
              <SearchableSelect
                options={INDONESIA_PROVINCES}
                value={region}
                onChange={(val) => setRegion(val)}
                placeholder="Pilih Wilayah"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: "var(--color-primary)",
              color: "white",
              padding: "12px 24px",
              borderRadius: "var(--radius-md)",
              border: "none",
              fontSize: "var(--text-sm)",
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)"
            }}
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Simpan Perubahan</span>
              </>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
