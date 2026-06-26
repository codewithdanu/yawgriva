"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sprout, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { getToken, getStoredUser, setToken, setStoredUser, getDashboardPath } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Load saved credentials if Remember Me was checked
  useEffect(() => {
    const token = getToken();
    const user = getStoredUser();
    if (token && user) {
      router.push(getDashboardPath(user.role));
      return;
    }

    const savedEmail = localStorage.getItem("yawgriva_remember_email");
    const savedPassword = localStorage.getItem("yawgriva_remember_password");
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
    // Check if redirected from register
    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      setJustRegistered(true);
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await api.auth.login(email, password);

      setToken(result.access_token);
      setStoredUser({
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        region: result.user.region,
      });

      // Save or clear credentials based on rememberMe checkbox
      if (rememberMe) {
        localStorage.setItem("yawgriva_remember_email", email);
        localStorage.setItem("yawgriva_remember_password", password);
      } else {
        localStorage.removeItem("yawgriva_remember_email");
        localStorage.removeItem("yawgriva_remember_password");
      }

      router.push(getDashboardPath(result.user.role));
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || "Terjadi kesalahan. Coba lagi.");
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
          <p className="login-subtitle">Masuk ke dashboard Anda</p>
        </div>

        {/* Registration Success Banner */}
        {justRegistered && (
          <div className="login-success animate-fade-in" style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
            <div>
              <strong>Pendaftaran berhasil!</strong>
              <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", opacity: 0.85 }}>Silakan masuk dengan akun yang baru dibuat.</p>
            </div>
          </div>
        )}

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
                autoComplete="current-password"
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

          {/* Remember Me Checkbox */}
          <div className="form-group-checkbox" style={{ display: "flex", alignItems: "center", gap: "8px", margin: "var(--space-1) 0" }}>
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: "16px", height: "16px", accentColor: "var(--color-primary)", cursor: "pointer" }}
            />
            <label htmlFor="rememberMe" className="label" style={{ margin: 0, cursor: "pointer", fontSize: "var(--text-sm)", userSelect: "none" }}>
              Ingat Saya
            </label>
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
              "Masuk"
            )}
          </button>
        </form>

        {/* Toggle link to Register */}
        <div className="login-toggle">
          <p>
            Belum punya akun?{" "}
            <Link href="/register" style={{ color: "var(--color-primary)", fontWeight: 600, textDecoration: "none" }}>
              Daftar sekarang
            </Link>
          </p>
        </div>

        {/* Demo credentials */}
        <div className="demo-credentials">
          <p className="demo-title">Demo Login</p>
          <div className="demo-items">
            <button onClick={() => { setEmail("admin@mail.com"); setPassword("admin123"); }} className="demo-item">
              <span className="badge badge-primary">Admin</span>
            </button>
            <button onClick={() => { setEmail("budi@mail.com"); setPassword("farmer123"); }} className="demo-item">
              <span className="badge badge-success">Petani</span>
            </button>
            <button onClick={() => { setEmail("distributor@mail.com"); setPassword("distrib123"); }} className="demo-item">
              <span className="badge badge-warning">Distributor</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
