import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase.js";
import Login from "./Login.jsx";
import Workspace from "./Workspace.jsx";
import Accept from "./Accept.jsx";
import OnboardingWizard from "./OnboardingWizard.jsx";

// Auth + firm-context gate.
//   loading   → checking session
//   signedout → no session; show Login (magic link)
//   nofirm    → signed in, but not linked to a firm yet (no invite accepted)
//   ready     → signed in and linked to a firm; show the workspace
export default function App() {
  const [status, setStatus] = useState("loading");
  const [session, setSession] = useState(null);
  const [ctx, setCtx] = useState(null); // { role, firm, org }
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
        .select("role, firm:firms(*, org:orgs(*))")
        .eq("user_id", sess.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data && data.firm) {
        setCtx({ role: data.role, firm: data.firm, org: data.firm.org });
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

  if (ctx && !ctx.firm?.onboarded_at) {
    return <OnboardingWizard firm={ctx.firm} onDone={() => { setStatus("loading"); loadContext(session); }} />;
  }

  return <Workspace ctx={ctx} email={session?.user?.email} onSignOut={signOut} />;
}
