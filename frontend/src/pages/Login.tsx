import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      const redirectTo = location.state?.from?.pathname || "/company-orientation";
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Authentication failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      {/* LEFT SECTION */}
      <div style={leftSection}>
        <div style={overlay}>
          <h1 style={brand}>Brisk Olive</h1>
          <p style={tagline}>All Department Dashboard for Streamlined Workflow Management</p>

          <ul style={featureList}>
            <li style={featureItem}>
              <span style={bullet}></span>
              <div>
                <span style={featureTitle}>Unified Dashboard</span>
                <div style={featureDesc}>Access all departments from a single, centralized platform</div>
              </div>
            </li>
            <li style={featureItem}>
              <span style={bullet}></span>
              <div>
                <span style={featureTitle}>Streamlined Operations</span>
                <div style={featureDesc}>Optimize workflows across all teams and departments</div>
              </div>
            </li>
            <li style={featureItem}>
              <span style={bullet}></span>
              <div>
                <span style={featureTitle}>Real-Time Collaboration</span>
                <div style={featureDesc}>Connect departments and enhance cross-functional teamwork</div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* RIGHT SECTION */}
      <div style={rightSection}>
        <div style={loginCard}>
          <h2 style={welcome}>Welcome back</h2>
          <p style={subtitle}>Please enter your credentials to continue</p>

          {error && <div style={errorBox}>{error}</div>}

          <form onSubmit={handleSubmit}>
            <label style={label}>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              required
            />

            <div style={passwordHeader}>
              <label style={label}>Password</label>
            </div>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={input}
              required
            />

            <div style={remember}>
              <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
              <span>Remember me</span>
            </div>

            <button type="submit" style={loginBtn} disabled={loading}>
              {loading ? "Verifying..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const container: React.CSSProperties = {
  display: "flex",
  height: "100vh",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  background: "#f8fafc",
  overflow: "hidden",
};

const leftSection: React.CSSProperties = {
  flex: 1,
  backgroundImage: "url('https://images.unsplash.com/photo-1524758631624-e2822e304c36')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const overlay: React.CSSProperties = {
  height: "100%",
  width: "100%",
  background: "linear-gradient(135deg, rgba(85, 107, 47, 0.85) 0%, rgba(70, 90, 40, 0.9) 100%)",
  color: "#fff",
  padding: "80px 70px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
};

const brand: React.CSSProperties = { fontSize: 56, fontWeight: 900, marginBottom: 20, lineHeight: 1.1, letterSpacing: 1, margin: "0 0 20px 0" };
const tagline: React.CSSProperties = { fontSize: 22, fontWeight: 500, maxWidth: 500, marginBottom: 60, lineHeight: 1.6, color: "#f1f5f9", margin: "0 0 60px 0" };
const featureList: React.CSSProperties = { listStyle: "none", padding: 0, maxWidth: 520, margin: 0 };
const featureItem: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 };
const bullet: React.CSSProperties = { width: 14, height: 14, backgroundColor: "#f1f5f9", borderRadius: "50%", display: "inline-block", marginTop: 4, flexShrink: 0, boxShadow: "0 0 10px rgba(255,255,255,0.3)" };
const featureTitle: React.CSSProperties = { fontWeight: 700, fontSize: 18, color: "#ffffff", marginBottom: 6, display: "block" };
const featureDesc: React.CSSProperties = { fontSize: 15, color: "rgba(255,255,255,0.9)", lineHeight: 1.6, fontWeight: 400 };

const rightSection: React.CSSProperties = { flex: 1, background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", display: "flex", justifyContent: "center", alignItems: "center", padding: "20px" };
const loginCard: React.CSSProperties = { width: 480, background: "#fff", borderRadius: 20, padding: "48px 40px", boxShadow: "0 25px 50px rgba(0,0,0,0.1), 0 0 1px rgba(0,0,0,0.05)" };
const welcome: React.CSSProperties = { fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "#1a1a1a" };
const subtitle: React.CSSProperties = { color: "#64748b", margin: "0 0 32px 0", fontSize: 15, fontWeight: 500 };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 700, display: "block", marginBottom: 8, color: "#334155", textTransform: "uppercase", letterSpacing: 0.5 };
const input: React.CSSProperties = { width: "100%", padding: "14px 16px", borderRadius: 10, border: "2px solid #e2e8f0", marginTop: 0, marginBottom: 20, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", backgroundColor: "#f8fafc", outline: "none" };
const passwordHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const remember: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontSize: 14, marginBottom: 28, color: "#475569", fontWeight: 500 };
const loginBtn: React.CSSProperties = { width: "100%", padding: 14, background: "linear-gradient(135deg, #556b2f 0%, #476b2a 100%)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 10px 25px rgba(85, 107, 47, 0.2)", letterSpacing: 0.5, textTransform: "uppercase" };
const errorBox: React.CSSProperties = { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, marginBottom: 20 };
