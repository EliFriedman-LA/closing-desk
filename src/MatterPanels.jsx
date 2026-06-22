import React, { useEffect, useMemo, useState } from "react";
import { listMatterNotes, createMatterNote, deleteMatterNote } from "./partnerNotesDb.js";
import { listInvoices, getInvoice, setInvoiceStatus, deleteInvoice } from "./partnerBillingDb.js";
import { teamMembers } from "./partnerDb.js";
import { money } from "./partnerRates.js";
import { InvoiceEditorModal, downloadInvoicePdf } from "./PartnerInvoices.jsx";

const NV = "#1e3a5f", BL = "#1B91FE", MUTED = "#64748b", LINE = "#e6eaf0";
const STATUS_TONE = { draft: ["#f1f5f9", "#475569"], sent: ["#fff7ed", "#b45309"], paid: ["#ecfdf5", "#15803d"], void: ["#fef2f2", "#b91c1c"] };

/* ---------------- Internal notes + @mentions ---------------- */
export function MatterNotesPanel({ matter }) {
  const [notes, setNotes] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try { setNotes(await listMatterNotes(matter.id)); } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); (async () => { try { setMembers(await teamMembers()); } catch (e) { /* ignore */ } })(); /* eslint-disable-next-line */ }, [matter.id]);

  const nameOf = (uid) => { const m = members.find((x) => x.user_id === uid); return m ? (m.name || m.email) : "Someone"; };
  const toggleMention = (uid) => setMentions((p) => p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid]);

  const post = async () => {
    const t = body.trim();
    if (!t) return;
    setBusy(true); setErr("");
    try { await createMatterNote(matter.firm_id, matter.id, t, mentions); setBody(""); setMentions([]); await load(); }
    catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const remove = async (n) => { if (!window.confirm("Delete this note?")) return; try { await deleteMatterNote(n.id); await load(); } catch (e) { setErr(e.message || String(e)); } };
  const fmt = (s) => { try { return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 560 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Internal notes</div>
      <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>Private to your firm. @mention a teammate to flag them.</div>

      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Add a note for your team…" style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 10, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
      {members.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
          {members.map((m) => {
            const on = mentions.includes(m.user_id);
            return <button key={m.user_id} onClick={() => toggleMention(m.user_id)} style={{ fontSize: 11.5, padding: "3px 9px", borderRadius: 20, border: `1px solid ${on ? BL : LINE}`, background: on ? "#eff6ff" : "#fff", color: on ? BL : MUTED, fontWeight: 600, cursor: "pointer" }}>@{m.name || m.email}</button>;
          })}
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: "#b91c1c", margin: "4px 0" }}>{err}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={post} disabled={busy || !body.trim()} style={{ padding: "8px 16px", background: body.trim() ? BL : "#cbd5e1", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: body.trim() ? "pointer" : "default" }}>{busy ? "Posting…" : "Post note"}</button>
      </div>

      {loading ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Loading…</div>
        : notes.length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af", padding: "4px 0" }}>No notes yet.</div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {notes.map((n) => (
              <div key={n.id} style={{ borderTop: "1px solid #eef1f6", paddingTop: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: NV }}>{nameOf(n.author_id)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "#9aa7b8" }}>{fmt(n.created_at)}</span>
                    <button onClick={() => remove(n)} title="Delete" style={{ background: "none", border: "none", color: "#b91c1c", fontSize: 12, cursor: "pointer", padding: 0 }}>✕</button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 3 }}>{n.body}</div>
                {(n.mentions || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
                    {(n.mentions || []).map((uid) => <span key={uid} style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: "#eff6ff", color: BL }}>@{nameOf(uid)}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>}
    </div>
  );
}

/* ---------------- Per-matter invoices ---------------- */
export function MatterInvoicesPanel({ matter, firm }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // {} new | { id } | null

  const load = async () => { setLoading(true); try { setRows(await listInvoices(matter.id)); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [matter.id]);

  const fmt = (s) => { if (!s) return ""; try { return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch (e) { return s; } };
  const cycle = async (inv) => { const order = { draft: "sent", sent: "paid", paid: "draft", void: "draft" }; try { await setInvoiceStatus(inv.id, order[inv.status] || "sent"); await load(); } catch (e) { alert(e.message || String(e)); } };
  const remove = async (inv) => { if (!window.confirm(`Delete ${inv.number || "this invoice"}?`)) return; try { await deleteInvoice(inv.id); await load(); } catch (e) { alert(e.message || String(e)); } };
  const pdf = async (inv) => { try { downloadInvoicePdf(await getInvoice(inv.id), firm); } catch (e) { alert(e.message || String(e)); } };

  // Pre-fill bill-to from the matter parties when starting a new one.
  const fixedMatter = useMemo(() => matter, [matter.id]);

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Invoices</div>
        <button onClick={() => setEditing({})} style={{ padding: "7px 13px", background: BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>＋ New invoice</button>
      </div>
      {loading ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Loading…</div>
        : rows.length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af", padding: "4px 0" }}>No invoices on this file yet.</div>
          : <div style={{ display: "flex", flexDirection: "column" }}>
            {rows.map((inv) => {
              const [bg, col] = STATUS_TONE[inv.status] || STATUS_TONE.draft;
              return (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #eef1f6" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NV }}>{inv.number || "Invoice"} · {money(inv.total || 0)}</div>
                    <div style={{ fontSize: 11.5, color: MUTED }}>{[fmt(inv.issue_date), inv.bill_to].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <button onClick={() => cycle(inv)} style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bg, color: col, border: "none", cursor: "pointer", textTransform: "capitalize" }}>{inv.status}</button>
                  <button onClick={() => pdf(inv)} style={{ padding: "5px 9px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: NV }}>PDF</button>
                  <button onClick={() => setEditing({ id: inv.id })} style={{ padding: "5px 9px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>Edit</button>
                  <button onClick={() => remove(inv)} style={{ padding: "5px 8px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>✕</button>
                </div>
              );
            })}
          </div>}

      {editing && <InvoiceEditorModal firm={firm} matters={[matter]} fixedMatter={fixedMatter} allInvoices={rows} existingId={editing.id || null} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
