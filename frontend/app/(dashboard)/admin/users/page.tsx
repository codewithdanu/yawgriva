"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/auth";
import { api, User } from "@/lib/api";
import { INDONESIA_PROVINCES } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";
import { 
  Loader2, 
  AlertCircle, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar,
  CheckCircle2,
  XCircle
} from "lucide-react";

const regionOptions = [
  { value: "all", label: "Semua Wilayah" },
  { value: "Tidak dispesifikasikan", label: "Tidak dispesifikasikan" },
  ...INDONESIA_PROVINCES.map((prov) => ({ value: prov, label: prov }))
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) return;
      const data = await api.admin.users(token);
      setUsers(data);
    } catch (err: unknown) {
      console.error(err);
      setError("Gagal memuat daftar pengguna. Pastikan Anda memiliki akses admin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleVerify(userId: string, currentStatus: boolean) {
    setUpdatingId(userId);
    try {
      const token = getToken();
      if (!token) return;
      const updatedUser = await api.admin.verifyUser(token, userId, !currentStatus);
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? { ...u, is_verified: updatedUser.is_verified } : u))
      );
    } catch (err: unknown) {
      console.error(err);
      const errMsg = err instanceof Error ? err.message : "Gagal mengubah status verifikasi.";
      alert(errMsg);
    } finally {
      setUpdatingId(null);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "admin":
        return { background: "#FAF5FF", color: "#6B21A8", border: "1px solid #E9D5FF" };
      case "farmer":
        return { background: "var(--color-primary-bg)", color: "var(--color-primary-dark)", border: "1px solid var(--color-primary)" };
      case "distributor":
        return { background: "#EFF6FF", color: "#1E40AF", border: "1px solid #BFDBFE" };
      default:
        return { background: "#F4F4F5", color: "#71717A", border: "1px solid #E4E4E7" };
    }
  };

  // Calculate filter matching
  const filteredUsers = users.filter((u) => {
    const matchesSearch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    
    const matchesRegion = regionFilter === "all" || (u.region || "Tidak dispesifikasikan") === regionFilter;
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "verified" && (u.role === "admin" || u.is_verified)) ||
      (statusFilter === "unverified" && u.role !== "admin" && !u.is_verified);
      
    return matchesSearch && matchesRole && matchesRegion && matchesStatus;
  });

  // Calculate paginated users
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  // Dynamically extract unique regions for dropdown
  const uniqueRegions = Array.from(new Set(users.map(u => u.region || "Tidak dispesifikasikan")));

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: "var(--space-4)" }}>
        <Loader2 className="animate-spin" size={40} style={{ color: "var(--color-primary)" }} />
        <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Memuat data pengguna...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "var(--space-12)" }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--space-8)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: "var(--color-text)" }}>Manajemen Pengguna</h1>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          Daftar seluruh pengguna terdaftar di platform Yawgriva Supply Chain.
        </p>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", background: "var(--color-danger-bg)", border: "1px solid var(--color-danger)", color: "var(--color-danger)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", marginBottom: "var(--space-6)" }}>
          <AlertCircle size={20} />
          <span style={{ fontSize: "var(--text-sm)", fontWeight: 550 }}>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div style={{ 
        display: "flex", 
        flexWrap: "wrap", 
        gap: "var(--space-4)", 
        marginBottom: "var(--space-6)", 
        background: "var(--color-surface)", 
        padding: "var(--space-5)", 
        borderRadius: "var(--radius-xl)", 
        border: "1px solid var(--color-border)",
        alignItems: "center"
      }}>
        {/* Search */}
        <div style={{ flex: "2 1 300px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-muted)" }}>Cari Pengguna</label>
          <input 
            type="text" 
            placeholder="Cari nama atau email..." 
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
              width: "100%",
              transition: "border-color 0.2s",
            }} 
            onFocus={(e) => e.target.style.borderColor = "var(--color-primary)"}
            onBlur={(e) => e.target.style.borderColor = "var(--color-border)"}
          />
        </div>

        {/* Role Filter */}
        <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-muted)" }}>Peran (Role)</label>
          <select 
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
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
            <option value="all">Semua Peran</option>
            <option value="admin">Admin</option>
            <option value="farmer">Petani (Farmer)</option>
            <option value="distributor">Distributor</option>
          </select>
        </div>

        {/* Region Filter */}
        <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-muted)" }}>Wilayah</label>
          <SearchableSelect
            options={regionOptions}
            value={regionFilter}
            onChange={(val) => { setRegionFilter(val); setCurrentPage(1); }}
            placeholder="Semua Wilayah"
          />
        </div>

        {/* Status Filter */}
        <div style={{ flex: "1 1 180px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-text-muted)" }}>Status Verifikasi</label>
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
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
            <option value="all">Semua Status</option>
            <option value="verified">Terverifikasi</option>
            <option value="unverified">Belum Terverifikasi</option>
          </select>
        </div>
      </div>

      {/* Users List Card */}
      <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
        
        {/* Table Wrapper for Desktop */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-sm)" }}>
            <thead>
              <tr style={{ background: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" }}>
                <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--color-text)" }}>Pengguna</th>
                <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--color-text)" }}>Kontak</th>
                <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--color-text)" }}>Wilayah</th>
                <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--color-text)" }}>Role</th>
                <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--color-text)" }}>Verifikasi</th>
                <th style={{ padding: "16px 24px", fontWeight: 600, color: "var(--color-text)" }}>Bergabung Pada</th>
              </tr>
            </thead>
            <tbody>
              {currentUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "32px 24px", textAlign: "center", color: "var(--color-text-muted)" }}>
                    Tidak ada pengguna terdaftar yang cocok dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                currentUsers.map((u) => {
                  const badgeStyle = getRoleBadgeStyle(u.role);
                  return (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                      {/* Name & Avatar */}
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                          <div style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden"
                          }}>
                            <img 
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=${u.role === "admin" ? "2D6A4F" : u.role === "farmer" ? "40916C" : "1B4332"}&color=ffffff&size=64&bold=true&rounded=true&format=png`} 
                              alt={u.name} 
                              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                            />
                          </div>
                          <div>
                            <span style={{ fontWeight: 600, color: "var(--color-text)", display: "block" }}>{u.name}</span>
                            <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>ID: {u.id.substring(0, 8)}...</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td style={{ padding: "16px 24px" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                            <Mail size={12} />
                            <span>{u.email}</span>
                          </div>
                          {u.phone && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                              <Phone size={12} />
                              <span>{u.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Region */}
                      <td style={{ padding: "16px 24px", color: "var(--color-text-muted)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <MapPin size={14} style={{ color: "var(--color-primary)" }} />
                          <span>{u.region || "Tidak dispesifikasikan"}</span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "var(--radius-full)",
                          fontSize: "var(--text-xs)",
                          fontWeight: 600,
                          textTransform: "capitalize",
                          ...badgeStyle
                        }}>
                          {u.role}
                        </span>
                      </td>

                      {/* Verification Status */}
                      <td style={{ padding: "16px 24px" }}>
                        {u.role === "admin" ? (
                          <span style={{
                            padding: "4px 10px",
                            borderRadius: "var(--radius-full)",
                            fontSize: "var(--text-xs)",
                            fontWeight: 600,
                            background: "var(--color-success-bg)",
                            color: "var(--color-success)",
                            border: "1px solid var(--color-success)"
                          }}>
                            Terverifikasi
                          </span>
                        ) : (
                          <button
                            onClick={() => handleToggleVerify(u.id, u.is_verified)}
                            disabled={updatingId === u.id}
                            style={{
                              padding: "4px 12px",
                              borderRadius: "var(--radius-full)",
                              fontSize: "var(--text-xs)",
                              fontWeight: 600,
                              cursor: updatingId === u.id ? "not-allowed" : "pointer",
                              border: "1px solid",
                              transition: "all 0.2s ease",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              background: u.is_verified ? "var(--color-success-bg)" : "var(--color-danger-bg)",
                              color: u.is_verified ? "var(--color-success)" : "var(--color-danger)",
                              borderColor: u.is_verified ? "var(--color-success)" : "var(--color-danger)",
                              opacity: updatingId === u.id ? 0.6 : 1,
                            }}
                            title="Klik untuk mengubah status verifikasi"
                          >
                            {updatingId === u.id ? (
                              <Loader2 size={12} className="animate-spin" style={{ color: "inherit" }} />
                            ) : u.is_verified ? (
                              <CheckCircle2 size={12} style={{ color: "inherit" }} />
                            ) : (
                              <XCircle size={12} style={{ color: "inherit" }} />
                            )}
                            <span>{u.is_verified ? "Terverifikasi" : "Belum Terverifikasi"}</span>
                          </button>
                        )}
                      </td>

                      {/* Created At */}
                      <td style={{ padding: "16px 24px", color: "var(--color-text-muted)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "var(--text-xs)" }}>
                          <Calendar size={14} />
                          <span>{new Date(u.created_at).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                          })}</span>
                        </div>
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
              Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> ({filteredUsers.length} pengguna)
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
    </div>
  );
}
