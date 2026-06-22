import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  listInvoices, getInvoice, createInvoice, updateInvoice, deleteInvoice, setInvoiceStatus,
  listInvoiceSettings, createInvoiceSetting, updateInvoiceSetting, deleteInvoiceSetting
} from "./partnerBillingDb.js";
import { money } from "./partnerRates.js";
import { TX_TYPES } from "./partnerDb.js";

const NV = "#1e3a5f", BL = "#1B91FE", MUTED = "#64748b", LINE = "#e6eaf0";
const STATUS_TONE = {
  draft: ["#f1f5f9", "#475569"], sent: ["#fff7ed", "#b45309"], paid: ["#ecfdf5", "#15803d"], void: ["#fef2f2", "#b91c1c"]
};

function fmtDate(s) { if (!s) return ""; try { return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return s; } }
function nextNumber(invoices) {
  let max = 0;
  (invoices || []).forEach((i) => { const m = String(i.number || "").match(/(\d+)\s*$/); if (m) max = Math.max(max, parseInt(m[1], 10)); });
  return "INV-" + String(max + 1).padStart(4, "0");
}

/* ---------------- Invoice PDF ---------------- */
export function downloadInvoicePdf(invoice, firm) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const pageW = pdf.internal.pageSize.getWidth();
  let y = margin;

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(18);
  pdf.text(String(firm?.name || "Invoice"), margin, y);
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(22); pdf.setTextColor(120);
  pdf.text("INVOICE", pageW - margin, y, { align: "right" });
  pdf.setTextColor(0);
  y += 26;

  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(90);
  if (invoice.number) pdf.text(`No. ${invoice.number}`, pageW - margin, y, { align: "right" });
  pdf.setTextColor(0);
  y += 24;

  pdf.setFontSize(10); pdf.setTextColor(110); pdf.text("BILL TO", margin, y); pdf.setTextColor(0);
  y += 14; pdf.setFontSize(11);
  (String(invoice.bill_to || "—").split("\n")).forEach((ln) => { pdf.text(ln, margin, y); y += 14; });

  const rightY0 = y - (String(invoice.bill_to || "—").split("\n").length * 14) - 14 + 14;
  pdf.setFontSize(10); pdf.setTextColor(110);
  pdf.text(`Issued: ${fmtDate(invoice.issue_date) || "—"}`, pageW - margin, rightY0, { align: "right" });
  if (invoice.due_date) pdf.text(`Due: ${fmtDate(invoice.due_date)}`, pageW - margin, rightY0 + 14, { align: "right" });
  pdf.setTextColor(0);

  y += 14;
  pdf.setDrawColor(220); pdf.line(margin, y, pageW - margin, y); y += 18;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(10);
  pdf.text("Description", margin, y);
  pdf.text("Qty", pageW - margin - 180, y, { align: "right" });
  pdf.text("Rate", pageW - margin - 90, y, { align: "right" });
  pdf.text("Amount", pageW - margin, y, { align: "right" });
  y += 6; pdf.line(margin, y, pageW - margin, y); y += 16;

  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10.5);
  (invoice.items || []).forEach((it) => {
    if (y > 700) { pdf.addPage(); y = margin; }
    const lines = pdf.splitTextToSize(String(it.description || ""), pageW - 2 * margin - 200);
    pdf.text(lines, margin, y);
    pdf.text(String(it.qty ?? ""), pageW - margin - 180, y, { align: "right" });
    pdf.text(it.rate != null ? money(it.rate) : "", pageW - margin - 90, y, { align: "right" });
    pdf.text(it.amount != null ? money(it.amount) : "", pageW - margin, y, { align: "right" });
    y += Math.max(16, lines.length * 14);
  });

  y += 6; pdf.setDrawColor(220); pdf.line(pageW - margin - 200, y, pageW - margin, y); y += 18;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
  pdf.text("Total", pageW - margin - 90, y, { align: "right" });
  pdf.text(money(invoice.total || 0), pageW - margin, y, { align: "right" });

  if (invoice.notes) {
    y += 30; pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(90);
    pdf.text(pdf.splitTextToSize(String(invoice.notes), pageW - 2 * margin), margin, y);
    pdf.setTextColor(0);
  }

  pdf.save(`${invoice.number || "invoice"}.pdf`);
}

/* ---------------- Editor modal (shared) ---------------- */
export function InvoiceEditorModal({ firm, matters = [], fixedMatter = null, existingId = null, allInvoices = [], onClose, onSaved }) {
  const [loading, setLoading] = useState(!!existingId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [matterId, setMatterId] = useState(fixedMatter ? fixedMatter.id : "");
  const [number, setNumber] = useState(nextNumber(allInvoices));
  const [billTo, setBillTo] = useState("");
  const [issue, setIssue] = useState(() => new Date().toISOString().slice(0, 10));
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [items, setItems] = useState([{ description: "", qty: 1, rate: 0, amount: 0 }]);

  useEffect(() => {
    if (!existingId) return;
    (async () => {
      try {
        const inv = await getInvoice(existingId);
        setMatterId(inv.matter_id || ""); setNumber(inv.number || ""); setBillTo(inv.bill_to || "");
        setIssue((inv.issue_date || "").slice(0, 10)); setDue((inv.due_date || "").slice(0, 10));
        setNotes(inv.notes || ""); setStatus(inv.status || "draft");
        setItems(inv.items && inv.items.length ? inv.items.map((it) => ({ description: it.description, qty: it.qty, rate: it.rate, amount: it.amount })) : [{ description: "", qty: 1, rate: 0, amount: 0 }]);
      } catch (e) { setErr(e.message || String(e)); }
      setLoading(false);
    })();
  }, [existingId]);

  const total = useMemo(() => items.reduce((s, it) => s + (Number(it.amount) || 0), 0), [items]);
  const setItem = (i, patch) => setItems((p) => p.map((it, idx) => {
    if (idx !== i) return it;
    const next = { ...it, ...patch };
    if ("qty" in patch || "rate" in patch) next.amount = (Number(next.qty) || 0) * (Number(next.rate) || 0);
    return next;
  }));
  const addItem = () => setItems((p) => [...p, { description: "", qty: 1, rate: 0, amount: 0 }]);
  const removeItem = (i) => setItems((p) => p.length > 1 ? p.filter((_, idx) => idx !== i) : p);

  const loadFromQuote = () => {
    const m = (fixedMatter && fixedMatter.saved_quote ? fixedMatter : matters.find((x) => x.id === matterId)) || null;
    const q = m && m.saved_quote;
    if (!q) { setErr("That file has no saved quote to load."); return; }
    const rows = [];
    if (q.premium) rows.push({ description: "Title premium", qty: 1, rate: q.premium, amount: q.premium });
    if (q.search) rows.push({ description: "Search & exam", qty: 1, rate: q.search, amount: q.search });
    if (q.rtf) rows.push({ description: "Realty Transfer Fee", qty: 1, rate: q.rtf, amount: q.rtf });
    if (q.gpf) rows.push({ description: "Graduated Percent Fee", qty: 1, rate: q.gpf, amount: q.gpf });
    (q.fees || []).forEach((f) => rows.push({ description: f.name, qty: 1, rate: f.amount, amount: f.amount }));
    if (!rows.length) { setErr("Saved quote had no line items."); return; }
    setItems(rows); setErr("");
  };

  const save = async () => {
    setErr("");
    setBusy(true);
    const cleanItems = items.filter((it) => (it.description || "").trim() || Number(it.amount));
    const payload = {
      matter_id: matterId || null, number: number.trim() || null, bill_to: billTo.trim() || null,
      issue_date: issue || null, due_date: due || null, notes: notes.trim() || null, status
    };
    try {
      if (existingId) await updateInvoice(existingId, payload, cleanItems);
      else await createInvoice(firm.id, payload, cleanItems);
      onSaved && onSaved();
      onClose();
    } catch (e) { setErr(e.message || String(e)); setBusy(false); }
  };

  const inp = { width: "100%", padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 3, display: "block" };
  const activeMatters = matters.filter((m) => !m.archived);

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620, maxHeight: "92vh", overflow: "auto", boxShadow: "0 12px 40px rgba(16,24,40,.2)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff" }}>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 18 }}>{existingId ? "Edit invoice" : "New invoice"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {loading ? <div style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</div> : <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div><label style={lbl}>Invoice #</label><input style={inp} value={number} onChange={(e) => setNumber(e.target.value)} /></div>
              <div><label style={lbl}>Status</label>
                <select style={inp} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {["draft", "sent", "paid", "void"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
                </select>
              </div>
              {!fixedMatter && (
                <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>File (optional)</label>
                  <select style={inp} value={matterId} onChange={(e) => setMatterId(e.target.value)}>
                    <option value="">— none —</option>
                    {activeMatters.map((m) => <option key={m.id} value={m.id}>{m.file_number ? m.file_number + " · " : ""}{m.property_address || "(no address)"}</option>)}
                  </select>
                </div>
              )}
              <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Bill to</label>
                <textarea style={{ ...inp, resize: "vertical", minHeight: 48 }} value={billTo} onChange={(e) => setBillTo(e.target.value)} placeholder="Client name / address" />
              </div>
              <div><label style={lbl}>Issue date</label><input type="date" style={inp} value={issue} onChange={(e) => setIssue(e.target.value)} /></div>
              <div><label style={lbl}>Due date</label><input type="date" style={inp} value={due} onChange={(e) => setDue(e.target.value)} /></div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Line items</div>
              <button onClick={loadFromQuote} style={{ fontSize: 11.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Load from saved quote</button>
            </div>
            <div style={{ display: "flex", gap: 6, fontSize: 10.5, color: MUTED, fontWeight: 600, padding: "0 2px 4px" }}>
              <div style={{ flex: 1 }}>Description</div><div style={{ width: 52 }}>Qty</div><div style={{ width: 80 }}>Rate</div><div style={{ width: 84 }}>Amount</div><div style={{ width: 22 }} />
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <input style={{ ...inp, flex: 1 }} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Service" />
                <input style={{ ...inp, width: 52 }} value={it.qty} onChange={(e) => setItem(i, { qty: Number(String(e.target.value).replace(/[^\d.]/g, "")) || 0 })} />
                <input style={{ ...inp, width: 80 }} value={it.rate} onChange={(e) => setItem(i, { rate: Number(String(e.target.value).replace(/[^\d.]/g, "")) || 0 })} />
                <input style={{ ...inp, width: 84, background: "#f8fafc" }} value={Number(it.amount || 0).toFixed(2)} onChange={(e) => setItem(i, { amount: Number(String(e.target.value).replace(/[^\d.]/g, "")) || 0 })} />
                <button onClick={() => removeItem(i)} style={{ width: 22, background: "none", border: "none", color: "#b91c1c", fontSize: 15, cursor: "pointer" }}>×</button>
              </div>
            ))}
            <button onClick={addItem} style={{ fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>＋ Add line</button>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 14, alignItems: "baseline", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LINE}` }}>
              <span style={{ fontSize: 13, color: MUTED, fontWeight: 600 }}>Total</span>
              <span style={{ fontFamily: "Fraunces,serif", fontSize: 20, fontWeight: 700, color: NV }}>{money(total)}</span>
            </div>

            <label style={{ ...lbl, marginTop: 12 }}>Notes</label>
            <textarea style={{ ...inp, resize: "vertical", minHeight: 48 }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, thank-you, etc." />

            {err && <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 10 }}>{err}</div>}
          </>}
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "flex-end", gap: 10, position: "sticky", bottom: 0, background: "#fff" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", color: NV }}>Cancel</button>
          <button onClick={save} disabled={busy || loading} style={{ padding: "9px 18px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: busy ? "default" : "pointer" }}>{busy ? "Saving…" : "Save invoice"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Fee schedules ---------------- */
function FeeSchedules({ firm }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => { setLoading(true); try { setRows(await listInvoiceSettings()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const add = async () => { setBusy(true); try { await createInvoiceSetting(firm.id, { matter_type: null, billing_type: "flat", flat_amount: 0, hourly_rate: 0 }); await load(); } catch (e) { alert(e.message || String(e)); } setBusy(false); };
  const patch = async (id, p) => { setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...p } : r)); try { await updateInvoiceSetting(id, p); } catch (e) { load(); } };
  const remove = async (r) => { if (!window.confirm("Remove this fee schedule?")) return; try { await deleteInvoiceSetting(r.id); await load(); } catch (e) { alert(e.message || String(e)); } };

  const inp = { border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 6 }}>
      <div style={{ padding: "10px 12px", fontSize: 12, color: MUTED }}>Set a flat fee or hourly rate per matter type. These are yours to reference when billing.</div>
      {loading ? <div style={{ padding: 18, color: "#9ca3af", fontSize: 13 }}>Loading…</div>
        : rows.length === 0 ? <div style={{ padding: "20px 12px", color: MUTED, fontSize: 13 }}>No fee schedules yet.</div>
          : rows.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px", borderTop: "1px solid #eef1f6", flexWrap: "wrap" }}>
              <select value={r.matter_type || ""} onChange={(e) => patch(r.id, { matter_type: e.target.value || null })} style={{ ...inp, width: 140 }}>
                <option value="">All types</option>
                {TX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select value={r.billing_type} onChange={(e) => patch(r.id, { billing_type: e.target.value })} style={{ ...inp, width: 110 }}>
                <option value="flat">Flat fee</option>
                <option value="hourly">Hourly</option>
              </select>
              {r.billing_type === "flat"
                ? <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: MUTED }}>$</span><input type="number" value={r.flat_amount || 0} onChange={(e) => patch(r.id, { flat_amount: Number(e.target.value) || 0 })} style={{ ...inp, width: 110 }} /></div>
                : <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: MUTED }}>$</span><input type="number" value={r.hourly_rate || 0} onChange={(e) => patch(r.id, { hourly_rate: Number(e.target.value) || 0 })} style={{ ...inp, width: 110 }} /><span style={{ color: MUTED, fontSize: 12 }}>/hr</span></div>}
              <div style={{ flex: 1 }} />
              <button onClick={() => remove(r)} style={{ padding: "6px 9px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
            </div>
          ))}
      <div style={{ padding: "10px 12px" }}>
        <button onClick={add} disabled={busy} style={{ fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>＋ Add fee schedule</button>
      </div>
    </div>
  );
}

/* ---------------- Invoices screen ---------------- */
export default function Invoices({ firm, matters = [] }) {
  const [tab, setTab] = useState("invoices");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id } | {} for new | null

  const load = async () => { setLoading(true); try { setRows(await listInvoices()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const matterLabel = (id) => { const m = matters.find((x) => x.id === id); return m ? (m.file_number || m.property_address || "file") : ""; };
  const cycle = async (inv) => {
    const order = { draft: "sent", sent: "paid", paid: "draft", void: "draft" };
    try { await setInvoiceStatus(inv.id, order[inv.status] || "sent"); await load(); } catch (e) { alert(e.message || String(e)); }
  };
  const remove = async (inv) => { if (!window.confirm(`Delete ${inv.number || "this invoice"}?`)) return; try { await deleteInvoice(inv.id); await load(); } catch (e) { alert(e.message || String(e)); } };
  const pdf = async (inv) => { try { const full = await getInvoice(inv.id); downloadInvoicePdf(full, firm); } catch (e) { alert(e.message || String(e)); } };

  const outstanding = rows.filter((r) => r.status === "sent").reduce((s, r) => s + (Number(r.total) || 0), 0);
  const collected = rows.filter((r) => r.status === "paid").reduce((s, r) => s + (Number(r.total) || 0), 0);

  const tabBtn = (k, label) => (
    <button onClick={() => setTab(k)} style={{ padding: "7px 14px", borderRadius: 18, border: `1px solid ${LINE}`, background: tab === k ? BL : "#fff", color: tab === k ? "#fff" : MUTED, cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Billing</div>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Invoices</div>
          <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Bill your clients and track what's been paid.</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {tabBtn("invoices", "Invoices")}
          {tabBtn("fees", "Fee schedules")}
          {tab === "invoices" && <button onClick={() => setEditing({})} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ New invoice</button>}
        </div>
      </div>

      {tab === "fees" ? <FeeSchedules firm={firm} /> : <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 16, maxWidth: 420 }}>
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}><div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Collected</div><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#15803d" }}>{money(collected)}</div></div>
          <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}><div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Outstanding</div><div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "#b45309" }}>{money(outstanding)}</div></div>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
          {loading ? <div style={{ padding: "26px 18px", color: "#9ca3af", fontSize: 13 }}>Loading…</div>
            : rows.length === 0 ? <div style={{ padding: "30px 18px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No invoices yet. Click “New invoice” to bill a client.</div>
              : rows.map((inv) => {
                const [bg, col] = STATUS_TONE[inv.status] || STATUS_TONE.draft;
                return (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderTop: "1px solid #eef1f6" }}>
                    <div style={{ width: 96, flexShrink: 0, fontWeight: 700, fontSize: 12.5, color: NV }}>{inv.number || "—"}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.bill_to || "(no recipient)"}</div>
                      <div style={{ fontSize: 12, color: MUTED }}>{[fmtDate(inv.issue_date), matterLabel(inv.matter_id)].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: NV }}>{money(inv.total || 0)}</div>
                    <button onClick={() => cycle(inv)} title="Click to advance status" style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bg, color: col, border: "none", cursor: "pointer", textTransform: "capitalize" }}>{inv.status}</button>
                    <button onClick={() => pdf(inv)} style={{ padding: "5px 10px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", color: NV }}>PDF</button>
                    <button onClick={() => setEditing({ id: inv.id })} style={{ padding: "5px 10px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}>Edit</button>
                    <button onClick={() => remove(inv)} style={{ padding: "5px 8px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>✕</button>
                  </div>
                );
              })}
        </div>
      </>}

      {editing && <InvoiceEditorModal firm={firm} matters={matters} allInvoices={rows} existingId={editing.id || null} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}
