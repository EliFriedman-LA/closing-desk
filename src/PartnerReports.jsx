import React, { useEffect, useMemo, useState } from "react";
import { reportData } from "./partnerReportsDb.js";
import { STAGES } from "./partnerDb.js";
import { money } from "./partnerRates.js";

const NV = "#1e3a5f", BL = "#1B91FE", MUTED = "#64748b", LINE = "#e6eaf0";

function monthKey(d) {
  const t = new Date(d);
  if (isNaN(t.getTime())) return null;
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}
function lastNMonths(n) {
  const out = [];
  const d = new Date(); d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
function csv(rows) {
  return rows.map((r) => r.map((v) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
}
function downloadCsv(name, rows) {
  const blob = new Blob([csv(rows)], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function Reports() {
  const [data, setData] = useState({ matters: [], invoices: [], contacts: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try { setData(await reportData()); } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = (d) => { try { return Math.round((new Date(d + "T00:00:00").getTime() - today.getTime()) / 86400000); } catch (e) { return null; } };

  const active = useMemo(() => data.matters.filter((m) => !m.archived), [data.matters]);
  const lastStage = STAGES.length - 1;

  const pipeline = useMemo(() => {
    const open = active.filter((m) => (m.stage || 0) < lastStage);
    const week = active.filter((m) => { const n = m.closing_date && days(m.closing_date); return n !== null && n >= 0 && n <= 7; });
    const month = active.filter((m) => { const n = m.closing_date && days(m.closing_date); return n !== null && n >= 0 && n <= 30; });
    const byStage = STAGES.map((s, i) => ({ stage: s, count: active.filter((m) => (m.stage || 0) === i).length }));
    return { open: open.length, week: week.length, month: month.length, byStage };
  }, [active]);

  const months = useMemo(() => lastNMonths(6), []);
  const closingsByMonth = useMemo(() => {
    const counts = {}; months.forEach((k) => counts[k] = 0);
    data.matters.forEach((m) => {
      const k = m.closing_date && monthKey(m.closing_date);
      if (k && k in counts && (m.closing_date && days(m.closing_date) <= 0)) counts[k]++;
    });
    return counts;
  }, [data.matters, months]);

  const revenue = useMemo(() => {
    const paid = {}; const billed = {}; months.forEach((k) => { paid[k] = 0; billed[k] = 0; });
    let paidTotal = 0, outstanding = 0;
    data.invoices.forEach((inv) => {
      const amt = Number(inv.total) || 0;
      if (inv.status === "paid") {
        paidTotal += amt;
        const k = monthKey(inv.paid_at || inv.issue_date);
        if (k && k in paid) paid[k] += amt;
      } else if (inv.status === "sent") {
        outstanding += amt;
        const k = monthKey(inv.issue_date);
        if (k && k in billed) billed[k] += amt;
      }
    });
    return { paid, billed, paidTotal, outstanding };
  }, [data.invoices, months]);

  const exportMatters = () => {
    const head = ["File #", "Address", "Town", "State", "Type", "Title", "Stage", "Buyer", "Seller", "Lender", "Closing date", "Archived"];
    const rows = data.matters.map((m) => [
      m.file_number, m.property_address, m.town, m.state, m.transaction_type,
      m.title_provider === "lakeland" ? "Lakeland" : (m.title_company_name || ""),
      STAGES[m.stage || 0] || "", m.buyer_name, m.seller_name, m.lender_name, m.closing_date, m.archived ? "yes" : ""
    ]);
    downloadCsv("matters.csv", [head, ...rows]);
  };
  const exportContacts = () => {
    const head = ["Name", "Role", "Firm", "Email", "Phone", "Notes"];
    const rows = data.contacts.map((c) => [c.name, c.role, c.firm_name, c.email, c.phone, c.notes]);
    downloadCsv("contacts.csv", [head, ...rows]);
  };

  const card = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginBottom: 16 };
  const h = { fontWeight: 700, fontSize: 14.5, color: NV, marginBottom: 12 };

  const Bars = ({ series, fmt }) => {
    const max = Math.max(1, ...months.map((k) => series[k] || 0));
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130, padding: "6px 2px 0" }}>
        {months.map((k) => {
          const v = series[k] || 0;
          return (
            <div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 10.5, color: MUTED, fontWeight: 600, minHeight: 13 }}>{v ? (fmt ? fmt(v) : v) : ""}</div>
              <div style={{ width: "100%", maxWidth: 46, height: Math.round((v / max) * 84) + 2, background: v ? BL : "#eef2f7", borderRadius: "6px 6px 0 0" }} />
              <div style={{ fontSize: 10.5, color: MUTED }}>{monthLabel(k)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Your practice</div>
        <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Reports</div>
        <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Pipeline, revenue, and closings across your matters.</div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", fontSize: 13, padding: 20 }}>Loading…</div> : <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 16 }}>
          {[["Open matters", pipeline.open, NV], ["Closing ≤ 7 days", pipeline.week, "#b45309"], ["Closing ≤ 30 days", pipeline.month, BL]].map(([k, v, c]) => (
            <div key={k} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{k}</div>
              <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6, color: c }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={h}>Pipeline by stage</div>
          {pipeline.byStage.map((s) => {
            const max = Math.max(1, ...pipeline.byStage.map((x) => x.count));
            return (
              <div key={s.stage} style={{ display: "flex", alignItems: "center", gap: 12, padding: "5px 0" }}>
                <div style={{ width: 110, fontSize: 12.5, color: NV, fontWeight: 600, flexShrink: 0 }}>{s.stage}</div>
                <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 6, height: 16, overflow: "hidden" }}>
                  <div style={{ width: `${(s.count / max) * 100}%`, height: "100%", background: BL }} />
                </div>
                <div style={{ width: 28, textAlign: "right", fontSize: 12.5, color: MUTED, fontWeight: 600 }}>{s.count}</div>
              </div>
            );
          })}
        </div>

        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <div style={h}>Revenue (last 6 months)</div>
          </div>
          <div style={{ display: "flex", gap: 20, marginBottom: 6 }}>
            <div><div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Collected</div><div style={{ fontSize: 22, fontWeight: 700, color: "#15803d" }}>{money(revenue.paidTotal)}</div></div>
            <div><div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>Outstanding (sent)</div><div style={{ fontSize: 22, fontWeight: 700, color: "#b45309" }}>{money(revenue.outstanding)}</div></div>
          </div>
          <Bars series={revenue.paid} fmt={(v) => money(v).replace(/\.00$/, "")} />
          <div style={{ fontSize: 11, color: MUTED, marginTop: 6 }}>Bars show collected (paid) invoice revenue by month.</div>
        </div>

        <div style={card}>
          <div style={h}>Closings (last 6 months)</div>
          <Bars series={closingsByMonth} />
        </div>

        <div style={card}>
          <div style={h}>Export</div>
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 12 }}>Download your data as a spreadsheet (CSV).</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={exportMatters} style={{ padding: "9px 15px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>⤓ Matters ({data.matters.length})</button>
            <button onClick={exportContacts} style={{ padding: "9px 15px", background: "#fff", color: NV, border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>⤓ Contacts ({data.contacts.length})</button>
          </div>
        </div>
      </>}
    </div>
  );
}
