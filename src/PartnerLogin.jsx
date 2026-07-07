import React, { useState } from "react";
import { signInWithCredentials } from "./partnerClient.js";

export default function Login() {
  const [company, setCompany] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | error
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

        <p className="muted small" style={{ marginTop: 14 }}>
          Need access? Ask your firm's administrator, or contact Lakeland.
        </p>
      </div>
      <p className="login-foot muted small">Secured by Lakeland Abstract</p>
    </div>
  );
}
