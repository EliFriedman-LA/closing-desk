// ClientPortal.jsx — Closing Desk white-label client portal (Phase 4.0)
// Rendered (via partnerMain) when the path is /c/<token>. No login: the token
// in the URL is validated server-side; this view only shows what the endpoint returns.

import React, { useEffect, useState, useRef } from "react";
import { getClientPortal, getClientDocUrl, getClientMessages, sendClientMessage, uploadClientFile } from "./clientDb.js";

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
  const [dl, setDl] = useState(""); // id of doc currently being fetched
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const reload = () => getClientPortal(token).then((d) => setData(d)).catch(() => {});

  const onUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { alert("Files must be 25 MB or smaller."); return; }
    setUploading(true);
    try { await uploadClientFile(token, file); await reload(); }
    catch (err) { alert(err.message || "Upload failed."); }
    setUploading(false);
  };

  const openDoc = async (docId) => {
    setDl(docId);
    try {
      const { url } = await getClientDocUrl(token, docId);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      alert(e.message || "Unable to open this document.");
    }
    setDl("");
  };

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

  const { firm, matter, deadlines, documents } = data;
  const settings = data.settings || {};
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

        {((documents && documents.length > 0) || settings.allow_upload) && (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: documents && documents.length ? 4 : 0 }}>
              <div style={sectionTitle}>Documents</div>
              {settings.allow_upload && (
                <>
                  <input ref={fileRef} type="file" onChange={onUpload} style={{ display: "none" }} />
                  <button onClick={() => fileRef.current && fileRef.current.click()} disabled={uploading} style={{ padding: "7px 14px", background: uploading ? "#9ca3af" : accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: uploading ? "default" : "pointer" }}>{uploading ? "Uploading…" : "⬆ Upload"}</button>
                </>
              )}
            </div>
            {(!documents || documents.length === 0)
              ? <div style={{ fontSize: 13, color: MUTED, padding: "10px 0 2px" }}>No documents yet.{settings.allow_upload ? " Use Upload to send a file to your closing team." : ""}</div>
              : <div>
                {documents.map((d, i) => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 0", borderTop: i ? `1px solid #eef1f6` : "none" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: shade(accent, .86), color: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▤</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: NV, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                      <div style={{ fontSize: 11.5, color: MUTED }}>{fmtDate(d.created_at)}</div>
                    </div>
                    <button onClick={() => openDoc(d.id)} disabled={dl === d.id} style={{ padding: "7px 14px", background: accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: dl === d.id ? "default" : "pointer", flexShrink: 0, opacity: dl === d.id ? .7 : 1 }}>{dl === d.id ? "Opening…" : "View"}</button>
                  </div>
                ))}
              </div>}
          </div>
        )}

        {settings.allow_messaging && <ClientMessages token={token} accent={accent} card={card} sectionTitle={sectionTitle} NV={NV} MUTED={MUTED} LINE={LINE} />}

        <div style={{ textAlign: "center", fontSize: 11.5, color: "#9aa7b8", marginTop: 8 }}>
          Secure closing portal{firm.name ? ` · ${firm.name}` : ""}
        </div>
      </div>
    </Shell>
  );
}

function ClientMessages({ token, accent, card, sectionTitle, NV, MUTED, LINE }) {
  const [msgs, setMsgs] = React.useState([]);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    let active = true;
    getClientMessages(token)
      .then((d) => { if (active) { setMsgs(d.messages || []); setLoading(false); } })
      .catch(() => { if (active) { setLoading(false); } });
    return () => { active = false; };
  }, [token]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true); setErr("");
    try {
      const d = await sendClientMessage(token, t);
      setMsgs(d.messages || []);
      setText("");
    } catch (e) { setErr(e.message || "Couldn't send."); }
    setSending(false);
  };
  const fmtTime = (s) => { try { return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

  return (
    <div style={card}>
      <div style={sectionTitle}>Messages</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
        {loading ? <div style={{ fontSize: 13, color: MUTED }}>Loading…</div>
          : msgs.length === 0 ? <div style={{ fontSize: 13, color: MUTED, padding: "6px 0" }}>No messages yet. Send your closing team a note below.</div>
            : msgs.map((m, i) => {
              const mine = m.sender === "client";
              return (
                <div key={i} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                  <div style={{ background: mine ? accent : "#f1f5f9", color: mine ? "#fff" : NV, borderRadius: 14, padding: "9px 13px", fontSize: 13.5, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                  <div style={{ fontSize: 10.5, color: "#9aa7b8", marginTop: 3, textAlign: mine ? "right" : "left" }}>{mine ? "You" : "Closing team"} · {fmtTime(m.created_at)}</div>
                </div>
              );
            })}
      </div>
      {err && <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 6 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder="Write a message…" style={{ flex: 1, boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 12px", fontSize: 13.5, fontFamily: "inherit", outline: "none", resize: "none" }} />
        <button onClick={send} disabled={sending || !text.trim()} style={{ padding: "0 18px", background: text.trim() ? accent : "#cbd5e1", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: text.trim() ? "pointer" : "default" }}>{sending ? "…" : "Send"}</button>
      </div>
    </div>
  );
}
