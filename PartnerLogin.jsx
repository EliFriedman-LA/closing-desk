import React, { useState } from "react";
import { supabase, signInWithCredentials } from "./partnerClient.js";

export default function Login() {
  const [mode, setMode] = useState("credentials"); // credentials | email
  const [company, setCompany] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  const login = async () => {
    if (!company.trim() || !username.trim() || !password) {
      setError("Enter your Company ID, User ID, and password.");
      setState("error");
      return;
    }
    setState("sending");
    setError("");
    try {
      await signInWithCredentials(company.trim(), username.trim(), password);
      // onAuthStateChange in PartnerApp takes over from here.
    } catch (e) {
      setError(e.message || "Could not sign in.");
      setState("error");
    }
  };

  const send = async () => {
    const e = email.trim();
    if (!e) return;
    setState("sending");
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setError(error.message);
      setState("error");
    } else {
      setState("sent");
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand-row">
          <div className="brand-mark">C</div>
          <div>
            <div className="brand-name">Closing Desk</div>
            <div className="brand-sub">Powered by Lakeland</div>
          </div>
        </div>

        {mode === "email" && state === "sent" ? (
          <div className="sent">
            <div className="sent-icon">✉</div>
            <h2 className="serif">Check your email</h2>
            <p className="muted">
              We sent a sign-in link to <b>{email}</b>. Open it on this device to continue.
            </p>
            <button className="btn ghost" onClick={() => setState("idle")}>
              Use a different email
            </button>
          </div>
        ) : mode === "credentials" ? (
          <>
            <h2 className="serif login-title">Sign in</h2>
            <p className="muted">Use the Company ID and User ID from Lakeland.</p>

            <label className="field-label">Company ID</label>
            <input
              className="input"
              autoCapitalize="characters"
              value={company}
              placeholder="e.g. SMITHLAW"
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              autoFocus
            />

            <label className="field-label" style={{ marginTop: 12 }}>User ID</label>
            <input
              className="input"
              autoCapitalize="none"
              value={username}
              placeholder="e.g. jsmith"
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />

            <label className="field-label" style={{ marginTop: 12 }}>Password</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
            />

            {state === "error" && <div className="err">{error}</div>}

            <button className="btn primary full" onClick={login} disabled={state === "sending"}>
              {state === "sending" ? "Signing in…" : "Sign in"}
            </button>
            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => { setMode("email"); setState("idle"); setError(""); }}
            >
              Account owner? Use an email sign-in link
            </button>
          </>
        ) : (
          <>
            <h2 className="serif login-title">Email sign-in</h2>
            <p className="muted">We'll email you a secure sign-in link — no password.</p>

            <label className="field-label">Email</label>
            <input
              className="input"
              type="email"
              value={email}
              placeholder="you@yourfirm.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              autoFocus
            />

            {state === "error" && <div className="err">{error}</div>}

            <button
              className="btn primary full"
              onClick={send}
              disabled={state === "sending" || !email.trim()}
            >
              {state === "sending" ? "Sending…" : "Email me a sign-in link"}
            </button>
            <button
              className="btn ghost"
              style={{ width: "100%", marginTop: 10 }}
              onClick={() => { setMode("credentials"); setState("idle"); setError(""); }}
            >
              Back to Company ID sign-in
            </button>
          </>
        )}
      </div>
      <p className="login-foot muted small">Secured by Lakeland Abstract</p>
    </div>
  );
}
