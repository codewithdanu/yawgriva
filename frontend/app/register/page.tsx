"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sprout, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { INDONESIA_PROVINCES } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("farmer");
  const [region, setRegion] = useState("");

  // Check URL query parameters for auto-selecting role
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get("role");
      if (roleParam) {
        const normalized = roleParam.toLowerCase();
        if (normalized === "petani" || normalized === "farmer") {
          setRole("farmer");
        } else if (normalized === "distributor") {
          setRole("distributor");
        }
      }
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.auth.register({
        name,
        email,
        phone: phone || undefined,
        password,
        role,
        region: region || undefined,
      });

      // Redirect to login with success message
      router.push("/login?registered=1");
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || "Terjadi kesalahan saat mendaftar. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-container animate-fade-in">
        {/* Header */}
        <div className="login-header">
          <Link href="/" className="login-logo" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/images/logo-with-text.png" alt="Yawgriva Logo" style={{ height: "40px", objectFit: "contain" }} />
          </Link>
          <p className="login-subtitle">Buat akun baru</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="login-error animate-fade-in" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="name" className="label">Nama Lengkap</label>
            <input
              id="name"
              type="text"
              className="input"
              placeholder="Masukkan nama lengkap"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="role" className="label">Peran</label>
            <select
              id="role"
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="farmer">Petani</option>
              <option value="distributor">Distributor</option>
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone" className="label">No. Telepon</label>
              <input
                id="phone"
                type="tel"
                className="input"
                placeholder="081234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="region" className="label">Wilayah</label>
              <SearchableSelect
                options={INDONESIA_PROVINCES}
                value={region}
                onChange={(val) => setRegion(val)}
                placeholder="Pilih Wilayah"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="label">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="email@contoh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="label">Password</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ width: "100%", marginTop: "var(--space-2)" }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin" />
                Memproses...
              </>
            ) : (
              "Daftar"
            )}
          </button>
        </form>

        {/* Toggle to Login */}
        <div className="login-toggle">
          <p>
            Sudah punya akun?{" "}
            <Link href="/login" style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}>
              Masuk
            </Link>
          </p>
        </div>
      </div>

      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
          background: var(--color-muted);
        }

        .login-container {
          width: 100%;
          max-width: 440px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: var(--space-8);
        }

        .login-header {
          text-align: center;
          margin-bottom: var(--space-6);
        }

        .login-logo {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
          font-weight: 700;
          font-size: var(--text-xl);
          color: var(--color-primary);
          margin-bottom: var(--space-2);
        }

        .login-subtitle {
          color: var(--color-text-muted);
          font-size: var(--text-sm);
        }

        .login-error {
          background: var(--color-danger-bg);
          color: var(--color-danger);
          padding: var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          margin-bottom: var(--space-4);
          text-align: center;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-3);
        }

        .password-wrapper {
          position: relative;
        }

        .password-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 4px;
        }

        .login-toggle {
          text-align: center;
          margin-top: var(--space-4);
          font-size: var(--text-sm);
          color: var(--color-text-muted);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        :global(.spin) {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
