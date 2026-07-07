import React, { useEffect, useState, useCallback } from "react";
import { supabase, changePassword } from "./partnerClient.js";
import Login from "./PartnerLogin.jsx";
import Workspace from "./PartnerWorkspace.jsx";
import Accept from "./PartnerAccept.jsx";
import OnboardingWizard from "./PartnerOnboarding.jsx";

// Auth + firm-context gate.
//   loading   → checking session
//   signedout → no session; show Login (Company ID + User ID + password, or email link)
//   nofirm    → signed in, but not linked to a firm yet (no invite accepted)
//   ready     → signed in and linked to a firm; show the workspace
export default function App() {
  const [status, setStatus] = useState("loading");
  const [session, setSession] = useState(null);
  const [ctx, setCtx] = useState(null); // { role, firm, org, mustChange }

  // An invite token arrives in the URL (?token=…). Persist it so it survives the
  // magic-link round-trip, then the Accept flow redeems it.
  const [inviteToken] = useState(() => {
    try {
      const p = new URLSearchParams(window.location.search).get("token");
      if (p) localStorage.setItem("cd_pending_invite", p);
      return p || localStorage.getItem("cd_pending_invite") || null;
    } catch {
      return null;
    }
  });

  const loadContext = useCallback(async (sess) => {
    try {
      const { data, error } = await supabase
        .from("firm_users")
        .select("role, must_change_password, firm:firms(*, org:orgs(*))")
        .eq("user_id", sess.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data && data.firm) {
        setCtx({ role: data.role, firm: data.firm, org: data.firm.org, mustChange: !!data.must_change_password });
        setStatus("ready");
      } else {
        setCtx(null);
        setStatus("nofirm");
      }
    } catch (e) {
      console.error("Closing Desk: failed to load firm context", e);
      setStatus("nofirm");
    }
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sess = data.session;
      setSession(sess);
      if (sess) loadContext(sess);
      else setStatus("signedout");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) {
        setStatus("loading");
        loadContext(sess);
      } else {
        setCtx(null);
        setStatus("signedout");
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadContext]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (status === "loading") {
    return (
      <div className="center">
        <div className="brand-mark big">C</div>
        <p className="muted">Loading your workspace…</p>
      </div>
    );
  }

  if (inviteToken) return <Accept token={inviteToken} session={session} />;

  if (status === "signedout") return <Login />;

  if (status === "nofirm") {
    return (
      <div className="center">
        <div className="brand-mark big">C</div>
        <h2 className="serif">You're signed in</h2>
        <p className="muted" style={{ maxWidth: 360, textAlign: "center" }}>
          This account isn't linked to a firm yet. Once your firm is set up,
          your workspace will appear here. If you were invited, open the link in
          your invitation email.
        </p>
        <p className="muted small">{session?.user?.email}</p>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
    );
  }

  if (ctx && ctx.mustChange) {
    return (
      <ForcePasswordChange
        onDone={() => { setStatus("loading"); loadContext(session); }}
        onSignOut={signOut}
      />
    );
  }

  if (ctx && !ctx.firm?.onboarded_at) {
    return <OnboardingWizard firm={ctx.firm} onDone={() => { setStatus("loading"); loadContext(session); }} />;
  }

  return <Workspace ctx={ctx} email={session?.user?.email} onSignOut={signOut} />;
}

// Forced password change on first sign-in for owner-created / backfilled users.
function ForcePasswordChange({ onDone, onSignOut }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (pw.length < 8) { setErr("Use at least 8 characters."); return; }
    if (pw !== pw2) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      await changePassword(pw);
      onDone();
    } catch (e) {
      setErr(e.message || "Could not update password.");
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
        <h2 className="serif login-title">Set your password</h2>
        <p className="muted">Choose a new password to finish setting up your account.</p>

        <label className="field-label">New password</label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoFocus
        />

        <label className="field-label" style={{ marginTop: 12 }}>Confirm password</label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {err && <div className="err">{err}</div>}

        <button className="btn primary full" onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Set password & continue"}
        </button>
        <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
