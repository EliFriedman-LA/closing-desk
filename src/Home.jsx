import React from "react";

// Placeholder workspace for Phase 0.2 — confirms auth + firm context resolved.
// The real sidebar/screens land in later phases.
export default function Home({ ctx, email, onSignOut }) {
  const firm = ctx.firm || {};
  const org = ctx.org || {};
  const initials = (firm.name || "F")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-row sm">
          <div className="brand-mark">C</div>
          <div className="brand-name sm">Closing Desk</div>
        </div>
        <div className="top-right">
          <span className="muted small">{email}</span>
          <button className="btn ghost sm" onClick={onSignOut}>Sign out</button>
        </div>
      </header>

      <main className="home">
        <div
          className="firm-banner"
          style={{ "--accent": firm.brand_color || "#0f5132" }}
        >
          <div className="firm-logo">{initials}</div>
          <div>
            <div className="eyebrow">Connected workspace</div>
            <h1 className="serif firm-title">{firm.name}</h1>
            <div className="muted">
              {ctx.role ? ctx.role[0].toUpperCase() + ctx.role.slice(1) : "Member"}
              {firm.state ? ` · ${firm.state}` : ""} · linked to {org.name || "Lakeland"}
            </div>
          </div>
        </div>

        <div className="card ready-card">
          <div className="ok-badge">✓</div>
          <div>
            <h3>You're set up and connected</h3>
            <p className="muted">
              Authentication and your firm workspace are live. Matters, the
              Lakeland connection, your inbox, and the rest of your tools arrive
              in the next builds.
            </p>
          </div>
        </div>

        <div className="meta-grid">
          <div className="card meta">
            <div className="meta-k">Firm</div>
            <div className="meta-v">{firm.name}</div>
          </div>
          <div className="card meta">
            <div className="meta-k">Title partner</div>
            <div className="meta-v">{org.name || "Lakeland Abstract"}</div>
          </div>
          <div className="card meta">
            <div className="meta-k">Your role</div>
            <div className="meta-v">{ctx.role || "member"}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
