import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./partnerClient.js";

// Handles the email's /accept?token=… link.
//  - Not signed in → ask for the invited email, send a magic link back to /accept.
//  - Signed in → call redeem_invite(token); on success, go to the workspace.
export default function Accept({ token, session }) {
  const [phase, setPhase] = useState(session ? "redeeming" : "email");
  const [email, setEmail] = useState("");
  const [sendState, setSendState] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState("");
  const [invited, setInvited] = useState("");

  const clearPending = () => { try { localStorage.removeItem("cd_pending_invite"); } catch {} };

  const redeem = useCallback(async () => {
    setPhase("redeeming");
    setError("");
    const { data, error } = await supabase.rpc("redeem_invite", { p_token: token });
    if (error) {
      clearPending();
      setError(error.message);
      setPhase("error");
      return;
    }
    if (data && data.ok) {
      clearPending();
      window.location.replace("/"); // clean reload → workspace
      return;
    }
    if (data && data.invited) setInvited(data.invited);
    const code = (data && data.error) || "unknown";
    // Drop the stored token on terminal outcomes so we don't bounce back here.
    // Keep it only for email_mismatch, where signing in with the right email retries.
    if (code !== "email_mismatch") clearPending();
    setError(code);
    setPhase("error");
  }, [token]);

  useEffect(() => {
    if (session) redeem();
  }, [session, redeem]);

  const sendLink = async () => {
    const e = email.trim();
    if (!e) return;
    setSendState("sending");
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: window.location.origin + "/accept?token=" + encodeURIComponent(token) }
    });
    if (error) {
      setError(error.message);
      setSendState("idle");
    } else {
      setSendState("sent");
    }
  };

  const useDifferentEmail = async () => {
    await supabase.auth.signOut();
    setPhase("email");
    setError("");
    setSendState("idle");
  };

  const friendly = (code) =>
    ({
      invalid_token: "This invitation link isn't valid. Ask Lakeland to resend it.",
      expired: "This invitation has expired. Ask Lakeland to send a new one.",
      invite_revoked: "This invitation was revoked. Please contact Lakeland.",
      invite_accepted: "This invitation has already been used.",
      already_in_a_firm: "Your account is already linked to a firm.",
      not_authenticated: "Please sign in to accept the invitation.",
      email_mismatch: invited
        ? `This invitation was sent to ${invited}. Sign in with that email to accept it.`
        : "This invitation was sent to a different email. Sign in with the invited email."
    }[code] || "Something went wrong accepting the invitation. Please try again.");

  const Brand = () => (
    <div className="brand-row">
      <div className="brand-mark">C</div>
      <div>
        <div className="brand-name">Closing Desk</div>
        <div className="brand-sub">Powered by Lakeland</div>
      </div>
    </div>
  );

  if (phase === "redeeming") {
    return (
      <div className="center">
        <div className="brand-mark big">C</div>
        <p className="muted">Setting up your workspace…</p>
      </div>
    );
  }

  if (phase === "error") {
    const mismatch = error === "email_mismatch";
    return (
      <div className="login">
        <div className="login-card">
          <Brand />
          <h2 className="serif login-title">Invitation</h2>
          <p className="muted">{friendly(error)}</p>
          {mismatch ? (
            <button className="btn primary full" onClick={useDifferentEmail}>Use a different email</button>
          ) : (
            <button className="btn full" onClick={() => { clearPending(); window.location.replace("/"); }}>Go to sign in</button>
          )}
        </div>
      </div>
    );
  }

  if (sendState === "sent") {
    return (
      <div className="login">
        <div className="login-card">
          <Brand />
          <div className="sent">
            <div className="sent-icon">✉</div>
            <h2 className="serif">Check your email</h2>
            <p className="muted">
              We sent a sign-in link to <b>{email}</b>. Open it on this device to
              finish accepting your invitation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // phase === "email" — not signed in yet
  return (
    <div className="login">
      <div className="login-card">
        <Brand />
        <h2 className="serif login-title">Accept your invitation</h2>
        <p className="muted">
          Enter the email your invitation was sent to — we'll email you a secure
          sign-in link to finish setting up.
        </p>
        <label className="field-label">Email</label>
        <input
          className="input"
          type="email"
          value={email}
          placeholder="you@yourfirm.com"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendLink()}
          autoFocus
        />
        {error && <div className="err">{error}</div>}
        <button
          className="btn primary full"
          onClick={sendLink}
          disabled={sendState === "sending" || !email.trim()}
        >
          {sendState === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
      </div>
      <p className="login-foot muted small">Secured by Lakeland Abstract</p>
    </div>
  );
}
