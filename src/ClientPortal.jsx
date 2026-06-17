// ClientPortal.jsx — Closing Desk white-label client portal (Phase 4.0)
// Rendered (via partnerMain) when the path is /c/<token>. No login: the token
// in the URL is validated server-side; this view only shows what the endpoint returns.

import React, { useEffect, useState } from "react";
import { getClientPortal } from "./clientDb.js";

const STAGES = ["Order", "Title search", "Commitment", "Clear to close", "Funded", "Recorded", "Policy"];

function readToken() {
  try {
    const p = window.location.pathname;
    return decodeURIComponent((p.split("/c/")[1] || "").replace(/\/+$/, ""));
  } catch (e) { return ""; }
}
function fmtDate(v) {
  if (!v) return "—";
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  let d;
  if (m) d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  else d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
function shade(hex, pct) {
  try {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(r + (255 - r) * pct); g = Math.round(g + (255 - g) * pct); b = Math.round(b + (255 - b) * pct);
    return `rgb(${r},${g},${b})`;
  } catch (e) { return hex; }
}

export default function ClientPortal() {
  const [token] = useState(readToken);
  const [state, setState] = useState("loading"); // loading | error | ready
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!token) { setErr("This link is invalid."); setState("error"); return; }
    let active = true;
    getClientPortal(token)
      .then((d) => { if (active) { setData(d); setState("ready"); } })
      .catch((e) => { if (active) { setErr(e.message || "Unable to load this portal."); setState("error"); } });
    return () => { active = false; };
  }, [token]);

  const accent = (data && data.firm && data.firm.brand_color) || "#1B91FE";
  const NV = "#1e3a5f", MUTED = "#64748b", LINE = "#e6eaf0", BG = "#f5f7fa";

  const Shell = ({ children }) => (
    <div style={{ minHeight: "100vh", background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", color: NV }}>
      {children}
    </div>
  );

  if (state === "loading") {
    return <Shell><div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: MUTED, fontSize: 15 }}>Loading your closing portal…</div></Shell>;
  }
  if (state === "error") {
    return (
      <Shell>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: "32px 28px", maxWidth: 420, textAlign: "center", boxShadow: "0 6px 24px rgba(16,24,40,.06)" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
            <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Link unavailable</div>
            <div style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>{err}</div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 14 }}>Please contact your closing team for an updated link.</div>
          </div>
        </div>
      </Shell>
    );
  }

  const { firm, matter, deadlines } = data;
  const stage = Math.max(0, Math.min(STAGES.length - 1, matter.stage || 0));
  const pct = Math.round((stage / (STAGES.length - 1)) * 100);
  const loc = [matter.town, matter.state].filter(Boolean).join(", ");

  const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, padding: 22, boxShadow: "0 4px 18px rgba(16,24,40,.05)" };
  const sectionTitle = { fontSize: 11, letterSpacing: ".09em", textTransform: "uppercase", color: MUTED, fontWeight: 700, marginBottom: 12 };

  return (
    <Shell>
      <div style={{ background: accent, color: "#fff", padding: "26px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>{firm.name || "Closing portal"}</div>
          <div style={{ fontSize: 13.5, opacity: .92, marginTop: 4 }}>Your closing portal</div>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "22px 18px 60px", display: "grid", gap: 16 }}>
        <div style={card}>
          <div style={sectionTitle}>Property</div>
          <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 19, fontWeight: 600 }}>{matter.property_address || "—"}</div>
          <div style={{ fontSize: 13.5, color: MUTED, marginTop: 3 }}>{[loc, matter.transaction_type].filter(Boolean).join(" · ")}</div>
        </div>

        <div style={card}>
          <div style={sectionTitle}>Closing status</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 20, fontWeight: 600, color: accent }}>{STAGES[stage]}</div>
            <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 600 }}>Step {stage + 1} of {STAGES.length}</div>
          </div>
          <div style={{ height: 8, background: shade(accent, .82), borderRadius: 99, overflow: "hidden", marginBottom: 18 }}>
            <div style={{ width: `${pct}%`, height: "100%", background: accent, borderRadius: 99, transition: "width .4s" }} />
          </div>
          <div style={{ display: "grid", gap: 2 }}>
            {STAGES.map((s, i) => {
              const done = i < stage, cur = i === stage;
              return (
                <div key={s} style={{ display: "flex", alignItems: "center", gap: 11, padding: "7px 0" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: done ? accent : cur ? "#fff" : "#f1f5f9", color: done ? "#fff" : cur ? accent : "#94a3b8", border: cur ? `2px solid ${accent}` : "2px solid transparent" }}>{done ? "✓" : i + 1}</div>
                  <div style={{ fontSize: 14, fontWeight: cur ? 700 : 500, color: cur ? NV : done ? MUTED : "#94a3b8" }}>{s}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={card}>
            <div style={sectionTitle}>Contract date</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{fmtDate(matter.contract_date)}</div>
          </div>
          <div style={card}>
            <div style={sectionTitle}>Closing date</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: matter.closing_date ? accent : NV }}>{fmtDate(matter.closing_date)}</div>
          </div>
        </div>

        {deadlines && deadlines.length > 0 && (
          <div style={card}>
            <div style={sectionTitle}>Key dates</div>
            <div>
              {deadlines.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 0", borderTop: i ? `1px solid #eef1f6` : "none" }}>
                  <div style={{ width: 18, height: 18, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, background: d.done ? accent : "#f1f5f9", color: d.done ? "#fff" : "#94a3b8" }}>{d.done ? "✓" : ""}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: d.done ? MUTED : NV, textDecoration: d.done ? "line-through" : "none" }}>{d.name}</div>
                  <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 600 }}>{fmtDate(d.due_date)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", fontSize: 11.5, color: "#9aa7b8", marginTop: 8 }}>
          Secure closing portal{firm.name ? ` · ${firm.name}` : ""}
        </div>
      </div>
    </Shell>
  );
}
