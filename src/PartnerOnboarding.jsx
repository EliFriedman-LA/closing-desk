import React, { useState } from "react";
import { updateFirm, STATES } from "./partnerDb.js";

const NV = "#1e3a5f", BL = "#1B91FE", MUTED = "#64748b", LINE = "#e6eaf0";

const SWATCHES = ["#0f5132", "#1e3a5f", "#1B91FE", "#0f6fd1", "#6d28d9", "#b45309", "#be123c", "#0f766e"];

export default function OnboardingWizard({ firm, onDone }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(firm.name || "");
  const [color, setColor] = useState(firm.brand_color || "#0f5132");
  const [state, setState] = useState(firm.default_state || "NJ");
  const [busy, setBusy] = useState(false);

  const initials = (name || "F").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const finish = async (skip) => {
    setBusy(true);
    try {
      const patch = skip
        ? { onboarded_at: new Date().toISOString() }
        : { name: name.trim() || firm.name, brand_color: color, default_state: state, onboarded_at: new Date().toISOString() };
      await updateFirm(firm.id, patch);
      onDone();
    } catch (e) {
      setBusy(false);
      alert("Couldn't save setup: " + (e.message || e));
    }
  };

  const card = { background: "#fff", borderRadius: 18, width: "100%", maxWidth: 460, boxShadow: "0 12px 44px rgba(16,24,40,.16)", overflow: "hidden" };
  const inp = { width: "100%", padding: "11px 13px", border: `1px solid ${LINE}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", margin: "16px 0 6px" };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 22, background: "linear-gradient(180deg,#eef3f9,#f6f8fb)" }}>
      <div style={card}>
        {/* Live preview banner */}
        <div style={{ padding: "22px 24px", color: "#fff", display: "flex", alignItems: "center", gap: 14, background: `linear-gradient(100deg, ${shade(color)}, ${color})` }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 18 }}>{initials}</div>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.85)", fontWeight: 600 }}>Workspace preview</div>
            <div style={{ fontFamily: "Fraunces,serif", fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>{name || "Your firm"}</div>
          </div>
        </div>

        <div style={{ padding: "22px 24px 24px" }}>
          {step === 1 ? (
            <>
              <div style={{ fontFamily: "Fraunces,serif", fontSize: 21, fontWeight: 600 }}>Welcome to Closing Desk</div>
              <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Let's set up your firm's workspace — takes 20 seconds.</div>

              <label style={lbl}>Firm display name</label>
              <input style={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hartman & Cole, LLC" autoFocus />

              <label style={lbl}>Brand color</label>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                {SWATCHES.map((c) => (
                  <button key={c} onClick={() => setColor(c)} aria-label={c} style={{
                    width: 30, height: 30, borderRadius: 8, background: c, cursor: "pointer",
                    border: color === c ? "3px solid #0f172a" : "3px solid transparent", outline: color === c ? "none" : `1px solid ${LINE}`
                  }} />
                ))}
              </div>

              <button onClick={() => setStep(2)} style={{ width: "100%", marginTop: 22, padding: "12px", background: BL, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14.5, cursor: "pointer" }}>Continue</button>
              <button onClick={() => finish(true)} disabled={busy} style={{ width: "100%", marginTop: 8, padding: "9px", background: "none", color: MUTED, border: "none", fontSize: 13, cursor: "pointer" }}>Skip for now</button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "Fraunces,serif", fontSize: 21, fontWeight: 600 }}>One quick default</div>
              <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>We'll pre-fill this on new matters — you can change it any time.</div>

              <label style={lbl}>Primary state</label>
              <select style={inp} value={state} onChange={(e) => setState(e.target.value)}>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>

              <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep(1)} disabled={busy} style={{ padding: "12px 16px", background: "#fff", color: "#475569", border: `1px solid ${LINE}`, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Back</button>
                <button onClick={() => finish(false)} disabled={busy} style={{ flex: 1, padding: "12px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14.5, cursor: busy ? "default" : "pointer" }}>{busy ? "Setting up…" : "Finish setup"}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function shade(hex) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 255) - 22), g = Math.max(0, ((n >> 8) & 255) - 22), b = Math.max(0, (n & 255) - 22);
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}
