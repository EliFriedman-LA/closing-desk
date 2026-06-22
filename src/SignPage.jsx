import React, { useEffect, useRef, useState } from "react";

const NV = "#1e3a5f", MUTED = "#64748b", LINE = "#e6eaf0";

async function post(body) {
  const r = await fetch("/api/esign-sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  let j = {};
  try { j = await r.json(); } catch (e) { /* non-JSON */ }
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

function tokenFromPath() {
  try { return decodeURIComponent(window.location.pathname.replace(/^\/sign\//, "").replace(/\/+$/, "")); }
  catch (e) { return ""; }
}

/* ---------------- Signature pad ---------------- */
function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const dirty = useRef(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  const pos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    const t = e.touches && e.touches[0];
    const cx = t ? t.clientX : e.clientX;
    const cy = t ? t.clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };
  const start = (e) => { e.preventDefault(); drawing.current = true; last.current = pos(e); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    dirty.current = true;
    onChange && onChange(canvasRef.current.toDataURL("image/png"));
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    onChange && onChange("");
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end}
        style={{ width: "100%", height: 150, border: `1px solid ${LINE}`, borderRadius: 10, background: "#fff", touchAction: "none", cursor: "crosshair" }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span style={{ fontSize: 11.5, color: MUTED }}>Draw your signature above</span>
        <button onClick={clear} style={{ fontSize: 12, color: NV, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Clear</button>
      </div>
    </div>
  );
}

export default function SignPage() {
  const [token] = useState(tokenFromPath);
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [signerId, setSignerId] = useState("");
  const [mode, setMode] = useState("draw"); // draw | type
  const [drawn, setDrawn] = useState("");
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const load = async () => {
    setLoading(true); setError("");
    try {
      const d = await post({ token, action: "get" });
      setInfo(d);
      const firstPending = (d.signers || []).find((s) => s.status !== "signed");
      if (firstPending) setSignerId(firstPending.id);
      if (d.status === "signed") setDone(true);
    } catch (e) { setError(e.message || String(e)); }
    setLoading(false);
  };
  useEffect(() => { if (token) load(); else { setError("This signing link is not valid."); setLoading(false); } /* eslint-disable-next-line */ }, [token]);

  const viewDoc = async () => {
    try { const { url } = await post({ token, action: "doc" }); window.open(url, "_blank", "noopener"); }
    catch (e) { setError(e.message || String(e)); }
  };

  const accent = (info && info.firm && info.firm.brand_color) || "#1B91FE";
  const signer = info && (info.signers || []).find((s) => s.id === signerId);
  const canSubmit = signerId && (mode === "draw" ? !!drawn : !!typed.trim());

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setError("");
    try {
      await post({
        token, action: "sign", signer_id: signerId,
        signature_type: mode === "draw" ? "drawn" : "typed",
        signature_data: mode === "draw" ? drawn : typed.trim()
      });
      await load();
      setDrawn(""); setTyped("");
    } catch (e) { setError(e.message || String(e)); }
    setSubmitting(false);
  };

  const wrap = { minHeight: "100vh", background: "#f4f6fa", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 18px" };
  const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 16, width: "100%", maxWidth: 540, boxShadow: "0 10px 40px rgba(16,24,40,.08)", overflow: "hidden" };

  if (loading) return <div style={wrap}><div style={{ ...card, padding: 40, textAlign: "center", color: MUTED }}>Loading…</div></div>;

  if (error && !info) return (
    <div style={wrap}><div style={{ ...card, padding: 40, textAlign: "center" }}>
      <div style={{ fontFamily: "Fraunces,serif", fontSize: 20, color: NV, marginBottom: 8 }}>Signing link</div>
      <div style={{ color: "#b91c1c", fontSize: 14 }}>{error}</div>
    </div></div>
  );

  const allSigned = info && (info.signers || []).length > 0 && (info.signers || []).every((s) => s.status === "signed");

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ padding: "20px 24px", color: "#fff", display: "flex", alignItems: "center", gap: 14, background: accent }}>
          {info.firm.logo_url
            ? <div style={{ width: 40, height: 40, borderRadius: 8, background: "#fff", display: "grid", placeItems: "center", overflow: "hidden", flexShrink: 0 }}><img src={info.firm.logo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
            : null}
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", opacity: 0.85, fontWeight: 600 }}>{info.firm.name || "Signature request"}</div>
            <div style={{ fontFamily: "Fraunces,serif", fontSize: 20, fontWeight: 600, lineHeight: 1.15 }}>{info.title}</div>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {info.doc.hasFile && (
            <button onClick={viewDoc} style={{ width: "100%", padding: "11px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: NV, cursor: "pointer", marginBottom: 18 }}>
              📄 View the document{info.doc.name ? ` — ${info.doc.name}` : ""}
            </button>
          )}

          {done || allSigned ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#ecfdf5", color: "#15803d", display: "grid", placeItems: "center", fontSize: 26, margin: "0 auto 12px" }}>✓</div>
              <div style={{ fontFamily: "Fraunces,serif", fontSize: 19, color: NV, marginBottom: 6 }}>All signed</div>
              <div style={{ fontSize: 13.5, color: MUTED }}>Thank you. Everyone has signed this document — you can close this page.</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: MUTED, fontWeight: 600, marginBottom: 8 }}>WHO ARE YOU?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {(info.signers || []).map((s) => {
                  const sgn = s.status === "signed";
                  const on = s.id === signerId;
                  return (
                    <button key={s.id} disabled={sgn} onClick={() => setSignerId(s.id)} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left",
                      padding: "11px 14px", borderRadius: 10, cursor: sgn ? "default" : "pointer",
                      border: `1px solid ${on && !sgn ? accent : LINE}`, background: sgn ? "#f8fafc" : on ? "#f5faff" : "#fff"
                    }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: sgn ? MUTED : NV }}>{s.name || "Signer"}{s.role ? ` · ${s.role}` : ""}</span>
                      {sgn
                        ? <span style={{ fontSize: 11.5, fontWeight: 700, color: "#15803d" }}>Signed ✓</span>
                        : <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? accent : MUTED }}>{on ? "Selected" : "Select"}</span>}
                    </button>
                  );
                })}
              </div>

              {signer && signer.status !== "signed" && (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    {[["draw", "Draw"], ["type", "Type"]].map(([k, l]) => (
                      <button key={k} onClick={() => setMode(k)} style={{ flex: 1, padding: "8px", borderRadius: 9, border: `1px solid ${mode === k ? accent : LINE}`, background: mode === k ? "#f5faff" : "#fff", color: mode === k ? accent : MUTED, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{l}</button>
                    ))}
                  </div>

                  {mode === "draw"
                    ? <SignaturePad onChange={setDrawn} />
                    : <div>
                        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your full legal name" style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px", border: `1px solid ${LINE}`, borderRadius: 10, fontSize: 16, outline: "none" }} />
                        {typed.trim() && <div style={{ marginTop: 10, padding: "14px 16px", border: `1px dashed ${LINE}`, borderRadius: 10, fontFamily: "'Brush Script MT', cursive", fontSize: 30, color: "#0f172a" }}>{typed.trim()}</div>}
                      </div>}

                  <div style={{ fontSize: 11.5, color: MUTED, margin: "14px 0" }}>
                    By signing, you agree your electronic signature is legally binding for this document. Your name, the time, and your IP address are recorded.
                  </div>

                  {error && <div style={{ fontSize: 12.5, color: "#b91c1c", marginBottom: 10 }}>{error}</div>}

                  <button onClick={submit} disabled={!canSubmit || submitting} style={{ width: "100%", padding: "13px", background: (!canSubmit || submitting) ? "#9ca3af" : accent, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: (!canSubmit || submitting) ? "default" : "pointer" }}>
                    {submitting ? "Signing…" : "Sign & submit"}
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div style={{ padding: "12px 24px", borderTop: `1px solid ${LINE}`, fontSize: 11, color: "#9aa7b8", textAlign: "center" }}>
          Secured by Closing Desk · Powered by Lakeland
        </div>
      </div>
    </div>
  );
}
