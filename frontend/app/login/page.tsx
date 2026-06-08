"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sprout, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { setToken, setStoredUser, getDashboardPath } from "@/lib/auth";

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
  }, []);

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

        .login-success {
          background: var(--color-success-bg);
          color: var(--color-success);
          border: 1px solid var(--color-success);
          padding: var(--space-3) var(--space-4);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          margin-bottom: var(--space-4);
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

        .login-toggle button {
          background: none;
          border: none;
          color: var(--color-primary);
          font-weight: 600;
          cursor: pointer;
          font-size: var(--text-sm);
        }

        .login-toggle button:hover {
          text-decoration: underline;
        }

        .demo-credentials {
          margin-top: var(--space-6);
          padding-top: var(--space-4);
          border-top: 1px solid var(--color-border);
          text-align: center;
        }

        .demo-title {
          font-size: var(--text-xs);
          color: var(--color-text-muted);
          margin-bottom: var(--space-3);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .demo-items {
          display: flex;
          gap: var(--space-2);
          justify-content: center;
        }

        .demo-item {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: transform var(--transition-fast);
        }

        .demo-item:hover {
          transform: scale(1.05);
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
