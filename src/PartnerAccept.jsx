import React, { useEffect, useState } from "react";
import { supabase } from "./partnerClient.js";

// Handles the email's /accept?token=… link.
// The invited person sets up their login: they confirm the invited email and
// choose a User ID + password. The server creates the account, redeems the
// invite (validating the token + email), and returns a session we adopt.
export default function Accept({ token }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const clearPending = () => { try { localStorage.removeItem("cd_pending_invite"); } catch (e) { /* ignore */ } };

  // Start from a clean slate so a stale session doesn't interfere.
  useEffect(() => { supabase.auth.signOut().catch(() => {}); }, []);

  const friendly = (code) =>
    ({
      account_exists: "An account already exists for this email. Contact Lakeland to reset your access.",
      invalid_token: "This invitation link isn't valid. Ask Lakeland to resend it.",
      expired: "This invitation has expired. Ask Lakeland to send a new one.",
      invite_revoked: "This invitation was revoked. Please contact Lakeland.",
      invite_accepted: "This invitation has already been used.",
      already_in_a_firm: "This account is already linked to a firm.",
      email_mismatch: "That's not the email this invitation was sent to. Use the invited email.",
    }[code] || (code || "Something went wrong. Please try again."));

  const submit = async () => {
    setError("");
    if (!email.trim()) { setError("Enter the email your invitation was sent to."); return; }
    if (!username.trim()) { setError("Choose a User ID."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== password2) { setError("Passwords don't match."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/partner-accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email: email.trim(), username: username.trim(), password }),
      });
      const d = await r.json().catch(() => ({ ok: false, error: "Request failed" }));
      if (!r.ok || !d.ok) { setError(friendly(d.error)); setBusy(false); return; }
      const { error } = await supabase.auth.setSession({ access_token: d.access_token, refresh_token: d.refresh_token });
      if (error) throw error;
      clearPending();
      window.location.replace("/"); // clean reload → workspace
    } catch (e) {
      setError(e.message || "Something went wrong.");
      setBusy(false);
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

        <h2 className="serif login-title">Set up your login</h2>
        <p className="muted">Confirm your email and choose how you'll sign in from now on.</p>

        <label className="field-label">Email your invitation was sent to</label>
        <input
          className="input"
          type="email"
          value={email}
          placeholder="you@yourfirm.com"
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        <label className="field-label" style={{ marginTop: 12 }}>Choose a User ID</label>
        <input
          className="input"
          autoCapitalize="none"
          value={username}
          placeholder="e.g. jsmith"
          onChange={(e) => setUsername(e.target.value)}
        />

        <label className="field-label" style={{ marginTop: 12 }}>Create a password</label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="field-label" style={{ marginTop: 12 }}>Confirm password</label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {error && <div className="err">{error}</div>}

        <button className="btn primary full" onClick={submit} disabled={busy}>
          {busy ? "Setting up…" : "Create my login"}
        </button>
        <p className="muted small" style={{ marginTop: 12 }}>
          You'll also receive a Company ID — you'll use it with your User ID and password to sign in.
        </p>
      </div>
      <p className="login-foot muted small">Secured by Lakeland Abstract</p>
    </div>
  );
}
