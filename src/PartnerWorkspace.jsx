import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  listMatters, createMatter, updateMatter, deleteMatter,
  linkLakelandMatter, getLakelandStatus,
  createOrderRequest, getMatterRequest, cancelOrderRequest,
  listDocuments, uploadDocument, documentUrl, deleteDocument,
  listMessages, postMessage, markRead, listUnreads,
  listDeadlineTemplates, createDeadlineTemplate, updateDeadlineTemplate, deleteDeadlineTemplate, seedDefaultTemplates,
  listMatterDeadlines, createMatterDeadline, updateMatterDeadline, deleteMatterDeadline, generateDeadlines, DEADLINE_ANCHORS, listFirmDeadlines,
  TX_TYPES, STATES, STAGES
} from "./partnerDb.js";
import Contacts from "./PartnerContacts.jsx";
import { STATE_RATES, quotePremium, calcRTF, calcGPF, SIMPLE_EXEMPTION_OPTIONS, PROPERTY_CLASS_OPTIONS, money } from "./partnerRates.js";

const NV = "#1e3a5f", BL = "#1B91FE", MUTED = "#64748b", LINE = "#e6eaf0", FIRM_DEFAULT = "#0f5132";

export default function Workspace({ ctx, email, onSignOut }) {
  const firm = ctx.firm || {};
  const org = ctx.org || {};
  const accent = firm.brand_color || FIRM_DEFAULT;
  const initials = (firm.name || "F").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("matters"); // dashboard | matters
  const [selectedId, setSelectedId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [unreads, setUnreads] = useState({});

  const load = async () => {
    setLoading(true);
    try { setMatters(await listMatters()); } catch (e) { console.error(e); }
    setLoading(false);
  };
  const loadUnreads = async () => { try { setUnreads(await listUnreads()); } catch (e) { /* ignore */ } };
  useEffect(() => {
    load(); loadUnreads();
    const id = setInterval(loadUnreads, 25000);
    return () => clearInterval(id);
  }, []);

  const selected = matters.find((m) => m.id === selectedId) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matters;
    return matters.filter((m) =>
      [m.file_number, m.property_address, m.town, m.transaction_type, m.title_company_name]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [matters, query]);
  const openCount = matters.filter((m) => (m.stage || 0) < STAGES.length - 1).length;
  const lakelandCount = matters.filter((m) => m.title_provider === "lakeland").length;

  const onCreate = async (payload) => {
    const m = await createMatter(firm.id, payload);
    setShowNew(false);
    await load();
    setSelectedId(m.id);
    setPage("matters");
  };
  const onStage = async (m, stage) => {
    const up = await updateMatter(m.id, { stage });
    setMatters((prev) => prev.map((x) => (x.id === m.id ? up : x)));
  };
  const onDelete = async (m) => {
    if (!window.confirm(`Delete this matter${m.file_number ? " (" + m.file_number + ")" : ""}? This can't be undone.`)) return;
    await deleteMatter(m.id);
    setSelectedId(null);
    load();
  };

  const go = (p) => { setPage(p); setSelectedId(null); setNavOpen(false); };

  const navItem = (key, label, icon) => (
    <button onClick={() => go(key)} style={{
      display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9,
      color: page === key && !selected ? "#fff" : "#c4d6ea", fontWeight: 500, fontSize: 13.5,
      border: "none", width: "100%", textAlign: "left", cursor: "pointer",
      background: page === key && !selected ? BL : "transparent"
    }}>
      <span style={{ width: 18, textAlign: "center" }}>{icon}</span>{label}
    </button>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f4f6fa" }}>
      {/* Sidebar */}
      <aside style={{
        background: NV, color: "#dbe6f4", width: 230, flexShrink: 0, display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh"
      }} className={navOpen ? "cd-nav open" : "cd-nav"}>
        <div style={{ padding: "20px 18px 12px", display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#fff,#dceefe)", color: NV, display: "grid", placeItems: "center", fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 19 }}>C</div>
          <div>
            <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 17, color: "#fff", lineHeight: 1.1 }}>Closing Desk</div>
            <div style={{ fontSize: 10, color: "#8fb0d4", letterSpacing: ".05em", textTransform: "uppercase" }}>Powered by Lakeland</div>
          </div>
        </div>
        <nav style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
          {navItem("dashboard", "Dashboard", "▦")}
          {navItem("matters", "Matters", "▤")}
          {navItem("calendar", "Calendar", "▥")}
          {navItem("quotes", "Quotes", "◈")}
          {navItem("contacts", "Contacts", "◍")}
          {navItem("deadlinesetup", "Deadline setup", "◷")}
          <div style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "#6f93bb", padding: "16px 12px 6px", fontWeight: 600 }}>Coming soon</div>
          {["▣ Calendar", "✉ Smart Inbox", "▥ Documents"].map((t) => (
            <div key={t} style={{ padding: "9px 12px", fontSize: 13.5, color: "#5d7da6" }}>{t}</div>
          ))}
        </nav>
        <div style={{ margin: "10px 12px 14px", padding: "11px 12px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 11, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: accent, color: "#fff", display: "grid", placeItems: "center", fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 13 }}>{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#fff", fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firm.name}</div>
            <div onClick={onSignOut} style={{ fontSize: 11, color: "#8fb0d4", cursor: "pointer" }}>Sign out</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <header style={{ height: 60, background: "#fff", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 14, padding: "0 22px", position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setNavOpen((s) => !s)} className="cd-menu" style={{ display: "none", background: "none", border: "none", fontSize: 20, color: NV, cursor: "pointer" }}>☰</button>
          {page !== "contacts" && <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search matters…" style={{ flex: 1, maxWidth: 380, padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 9, background: "#f8fafc", fontSize: 13.5 }} />
            <button onClick={() => setShowNew(true)} style={{ marginLeft: "auto", padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ New matter</button>
          </>}
        </header>

        <main style={{ padding: "24px 26px 60px", maxWidth: 1100, width: "100%" }}>
          {selected
            ? <MatterDetail matter={selected} email={email} onBack={() => setSelectedId(null)} onStage={onStage} onDelete={onDelete} onRefresh={load} onRead={loadUnreads} />
            : page === "dashboard"
              ? <Dashboard firm={firm} org={org} accent={accent} initials={initials} openCount={openCount} lakelandCount={lakelandCount} total={matters.length} recent={matters.slice(0, 5)} unreads={unreads} onOpen={(id) => setSelectedId(id)} onNew={() => setShowNew(true)} />
              : page === "contacts"
                ? <Contacts firmId={firm.id} />
                : page === "calendar"
                  ? <Calendar onOpen={(id) => setSelectedId(id)} />
                  : page === "quotes"
                    ? <QuotesCalculator firm={firm} />
                    : page === "deadlinesetup"
                      ? <DeadlineSetup firmId={firm.id} />
                      : <MattersList loading={loading} matters={filtered} total={matters.length} unreads={unreads} onOpen={(id) => setSelectedId(id)} onNew={() => setShowNew(true)} query={query} />}
        </main>
      </div>

      {showNew && <NewMatterModal onClose={() => setShowNew(false)} onCreate={onCreate} />}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ firm, org, accent, initials, openCount, lakelandCount, total, recent, unreads = {}, onOpen, onNew }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, padding: 22, borderRadius: 16, color: "#fff", marginBottom: 18, background: `linear-gradient(100deg, ${shade(accent)}, ${accent})` }}>
        <div style={{ width: 54, height: 54, borderRadius: 13, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 20 }}>{initials}</div>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.85)", fontWeight: 600 }}>Workspace</div>
          <div style={{ fontFamily: "Fraunces,serif", fontSize: 25, fontWeight: 600, margin: "3px 0", lineHeight: 1.1 }}>{firm.name}</div>
          <div style={{ color: "rgba(255,255,255,.82)" }}>Linked to {org.name || "Lakeland Abstract"}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
        {[["Open matters", openCount, BL], ["With Lakeland", lakelandCount, "#0f6fd1"], ["Total files", total, NV]].map(([k, v, c]) => (
          <div key={k} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>{k}</div>
            <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
        <div style={{ padding: "14px 18px", fontWeight: 600, fontSize: 14.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Recent matters
          <button onClick={onNew} style={{ fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>＋ New matter</button>
        </div>
        {recent.length === 0
          ? <div style={{ padding: "26px 18px", color: "#9ca3af", fontSize: 13 }}>No matters yet. Click “New matter” to open your first file.</div>
          : recent.map((m) => <MatterRow key={m.id} m={m} unread={unreads[m.id]} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

/* ---------------- Matters list ---------------- */
function MattersList({ loading, matters, total, unreads = {}, onOpen, onNew, query }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Your practice</div>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Matters</div>
          <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Every file — with Lakeland or not.</div>
        </div>
        <button onClick={onNew} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ New matter</button>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
        {loading
          ? <div style={{ padding: "26px 18px", color: "#9ca3af", fontSize: 13 }}>Loading…</div>
          : matters.length === 0
            ? <div style={{ padding: "30px 18px", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>{query ? "No matters match your search." : "No matters yet — open your first file with “New matter.”"}</div>
            : matters.map((m) => <MatterRow key={m.id} m={m} unread={unreads[m.id]} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function MatterRow({ m, unread, onOpen }) {
  const provTag = m.title_provider === "lakeland"
    ? <span style={tag("#e8f3ff", "#0f6fd1")}>◆ Lakeland</span>
    : <span style={tag("#f1f5f9", "#64748b")}>{m.title_company_name || "Other"}</span>;
  const stageLabel = STAGES[m.stage || 0] || STAGES[0];
  return (
    <div onClick={() => onOpen(m.id)} style={{ display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", borderTop: `1px solid #eef1f6`, cursor: "pointer" }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, color: NV, width: 130, flexShrink: 0 }}>{m.file_number || "—"}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.property_address || "(no address)"}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{[m.town, m.transaction_type].filter(Boolean).join(" · ") || "—"}</div>
      </div>
      <div style={{ flex: 1 }} />
      {unread > 0 && <span title="New messages from Lakeland" style={{ background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{unread}</span>}
      {provTag}
      <span style={tag("#f8fafc", "#475569")}>{stageLabel}</span>
    </div>
  );
}

/* ---------------- Matter detail ---------------- */
function MatterDetail({ matter, email, onBack, onStage, onDelete, onRefresh, onRead }) {
  const conn = matter.title_provider === "lakeland";
  const linked = !!matter.lakeland_file_number;
  const [live, setLive] = useState(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [request, setRequest] = useState(null);
  const [showPlace, setShowPlace] = useState(false);

  useEffect(() => {
    let on = true;
    if (linked) {
      setLoadingLive(true);
      getLakelandStatus(matter.id)
        .then((s) => { if (on) { setLive(s); setLoadingLive(false); } })
        .catch(() => { if (on) setLoadingLive(false); });
      setRequest(null);
    } else {
      setLive(null);
      getMatterRequest(matter.id).then((r) => { if (on) setRequest(r); }).catch(() => {});
    }
    return () => { on = false; };
  }, [matter.id, matter.lakeland_file_number]);

  const liveOk = linked && live && live.ok;
  const stage = liveOk ? live.stage : (matter.stage || 0);

  const details = [
    ["File #", matter.file_number],
    ["Type", matter.transaction_type],
    ["State", matter.state],
    ["Town", matter.town],
    ["Title", conn ? "Lakeland Abstract" : (matter.title_company_name || "—")]
  ].filter((d) => d[1]);

  const dateRows = liveOk && live.dates ? [
    ["Search received", live.dates.search_received],
    ["Commitment sent", live.dates.commitment_sent],
    ["Closing scheduled", live.dates.scheduled_closing],
    ["Closed / funded", live.dates.closed],
    ["Policy sent", live.dates.policy_sent]
  ].filter((d) => d[1]) : [];

  const liveErr = (code) => ({
    file_not_found: "We can't find that Lakeland file right now.",
    not_linked: "Not connected yet.",
    not_your_matter: "This matter isn't available."
  }[code] || "Couldn't load live status.");

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: BL, fontWeight: 600, fontSize: 13, padding: 0, marginBottom: 14, cursor: "pointer" }}>← Matters</button>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>{matter.file_number || "Matter"} · {matter.transaction_type || ""}</div>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 25, lineHeight: 1.1 }}>{matter.property_address || "(no address)"}</div>
          <div style={{ color: MUTED, fontSize: 13.5, marginTop: 3 }}>{matter.town || ""}</div>
        </div>
        <button onClick={() => onDelete(matter)} style={{ padding: "7px 12px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>Delete</button>
      </div>

      {/* Tracker */}
      <div style={{ padding: "20px 18px 14px", borderRadius: 14, border: `1px solid ${conn ? "#dbe9fa" : LINE}`, background: conn ? "linear-gradient(180deg,#fbfdff,#f4f9ff)" : "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Current stage</div>
            <div style={{ fontFamily: "Fraunces,serif", fontSize: 18, fontWeight: 600, color: NV }}>{STAGES[stage]}</div>
          </div>
          {conn
            ? (linked
                ? <span style={tag("#e8f3ff", "#0f6fd1")}>● Live · Lakeland #{matter.lakeland_file_number}</span>
                : <span style={tag("#fff7ed", "#b45309")}>Not connected</span>)
            : <span style={tag("#f1f5f9", "#64748b")}>Manual</span>}
        </div>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {STAGES.map((s, i) => {
            const st = i < stage ? "done" : i === stage ? "cur" : "todo";
            return (
              <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", minWidth: 0 }}>
                {i > 0 && <div style={{ position: "absolute", top: 13, left: "-50%", width: "100%", height: 3, background: i <= stage ? BL : LINE }} />}
                <div style={{
                  width: 27, height: 27, borderRadius: "50%", zIndex: 1, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700,
                  background: st === "done" ? BL : "#fff", color: st === "done" ? "#fff" : st === "cur" ? BL : "#94a3b8",
                  border: `3px solid ${st === "todo" ? LINE : BL}`
                }}>{i < stage ? "✓" : i + 1}</div>
                <div style={{ fontSize: 10.5, color: i === stage ? NV : MUTED, marginTop: 8, textAlign: "center", fontWeight: 600 }}>{s}</div>
              </div>
            );
          })}
        </div>

        {/* Footer: live / connect / manual */}
        {conn ? (
          linked ? (
            <div style={{ marginTop: 16, fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: loadingLive ? "#cbd5e1" : liveOk ? "#16a34a" : "#f59e0b", flexShrink: 0 }} />
              {loadingLive ? "Syncing live status…" : liveOk ? "Live from Lakeland — updates automatically as your file progresses." : liveErr(live && live.error)}
            </div>
          ) : (
            request && request.status === "pending" ? (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={tag("#fff7ed", "#b45309")}>● Order placed — pending Lakeland review</span>
                <button onClick={async () => { await cancelOrderRequest(request.id); const r = await getMatterRequest(matter.id); setRequest(r); }} style={{ fontSize: 12, color: MUTED, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Cancel request</button>
              </div>
            ) : (
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                {request && request.status === "declined" && <span style={tag("#fef2f2", "#b91c1c")}>Previous request declined</span>}
                <button onClick={() => setShowConnect(true)} style={{ padding: "9px 15px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>◆ Connect existing file</button>
                <button onClick={() => setShowPlace(true)} style={{ padding: "9px 15px", background: "#fff", color: NV, border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Place title order</button>
              </div>
            )
          )
        ) : (
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 12, color: MUTED }}>Update status:</span>
            <select value={stage} onChange={(e) => onStage(matter, parseInt(e.target.value, 10))} style={{ padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 7, fontSize: 12.5 }}>
              {STAGES.map((s, i) => <option key={s} value={i}>{s}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Live key dates */}
      {dateRows.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 420 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Lakeland milestones</div>
          {dateRows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid #eef1f6", fontSize: 13 }}>
              <span style={{ color: MUTED }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Details */}
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 420 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>File details</div>
        {details.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid #eef1f6", fontSize: 13 }}>
            <span style={{ color: MUTED }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
          </div>
        ))}
        {!conn && (
          <div style={{ marginTop: 12, padding: "11px 13px", background: "#f1f5f9", border: "1px dashed #cbd5e1", borderRadius: 9, fontSize: 12, color: MUTED }}>
            This file isn't with Lakeland, so the live connection (ordering, document exchange) is hidden. The rest of your workspace works the same.
          </div>
        )}
      </div>

      <DeadlinesPanel matter={matter} onRefresh={onRefresh} />

      <DocumentsPanel matter={matter} />

      <MessagesPanel matter={matter} email={email} onRead={onRead} />

      {showConnect && <ConnectModal matter={matter} onClose={() => setShowConnect(false)} onLinked={() => { setShowConnect(false); onRefresh && onRefresh(); }} />}
      {showPlace && <PlaceOrderModal matter={matter} onClose={() => setShowPlace(false)} onPlaced={async () => { setShowPlace(false); const r = await getMatterRequest(matter.id); setRequest(r); }} />}
    </div>
  );
}

/* ---------------- Documents panel ---------------- */
function DocumentsPanel({ matter }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try { setDocs(await listDocuments(matter.id)); } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [matter.id]);

  const onPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (inputRef.current) inputRef.current.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { setErr("Files must be 25 MB or smaller."); return; }
    setBusy(true); setErr("");
    try { await uploadDocument(matter.firm_id, matter, file); await load(); }
    catch (e2) { setErr(e2.message || String(e2)); }
    setBusy(false);
  };
  const open = async (doc) => {
    try { const url = await documentUrl(doc.storage_path); window.open(url, "_blank", "noopener"); }
    catch (e) { setErr("Couldn't open the file."); }
  };
  const remove = async (doc) => {
    if (!window.confirm(`Delete "${doc.name}"?`)) return;
    try { await deleteDocument(doc); await load(); } catch (e) { setErr(e.message || String(e)); }
  };

  const fmtSize = (n) => !n ? "" : n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB";
  const fmtDate = (s) => { try { return new Date(s).toLocaleDateString(); } catch { return ""; } };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Documents</div>
        <input ref={inputRef} type="file" onChange={onPick} style={{ display: "none" }} />
        <button onClick={() => inputRef.current && inputRef.current.click()} disabled={busy} style={{ padding: "7px 13px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>{busy ? "Uploading…" : "⬆ Upload"}</button>
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>
        {matter.lakeland_file_number ? "Shared with Lakeland on this file. They can see what you upload, and you'll see what they share." : "Your files for this matter. They'll be shared with Lakeland once this matter is connected to a file."}
      </div>
      {err && <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>{err}</div>}

      {loading ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Loading…</div>
        : docs.length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af", padding: "8px 0" }}>No documents yet.</div>
        : <div style={{ display: "flex", flexDirection: "column" }}>
          {docs.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #eef1f6" }}>
              <div style={{ fontSize: 18, flexShrink: 0 }}>📄</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div onClick={() => open(d)} style={{ fontSize: 13, fontWeight: 600, color: NV, cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{[fmtSize(d.size), fmtDate(d.created_at)].filter(Boolean).join(" · ")}</div>
              </div>
              <span style={d.side === "lakeland" ? tag("#e8f3ff", "#0f6fd1") : tag("#f1f5f9", "#475569")}>{d.side === "lakeland" ? "Lakeland" : "You"}</span>
              <button onClick={() => open(d)} style={{ padding: "5px 10px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}>Open</button>
              {d.side === "firm" && <button onClick={() => remove(d)} title="Delete" style={{ padding: "5px 8px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>✕</button>}
            </div>
          ))}
        </div>}
    </div>
  );
}

/* ---------------- Deadlines panel (per matter) ---------------- */
function DeadlinesPanel({ matter, onRefresh }) {
  const [contractDate, setContractDate] = useState(matter.contract_date || "");
  const [closingDate, setClosingDate] = useState(matter.closing_date || "");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState(false);
  const [nName, setNName] = useState("");
  const [nDate, setNDate] = useState("");

  const load = async () => {
    setLoading(true);
    try { setItems(await listMatterDeadlines(matter.id)); } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => {
    setContractDate(matter.contract_date || "");
    setClosingDate(matter.closing_date || "");
    load();
    /* eslint-disable-next-line */
  }, [matter.id]);

  const saveDates = async (patch) => {
    try { await updateMatter(matter.id, patch); onRefresh && onRefresh(); }
    catch (e) { setMsg(e.message || String(e)); }
  };
  const onContract = (v) => { setContractDate(v); saveDates({ contract_date: v || null }); };
  const onClosing = (v) => { setClosingDate(v); saveDates({ closing_date: v || null }); };

  const generate = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await generateDeadlines(matter.firm_id, { ...matter, contract_date: contractDate || null, closing_date: closingDate || null });
      await load();
      const bits = [];
      if (r.added) bits.push(`${r.added} added`);
      if (r.updated) bits.push(`${r.updated} updated`);
      if (r.skipped) bits.push(`${r.skipped} skipped (no anchor date)`);
      setMsg(bits.length ? bits.join(" · ") : "Nothing to generate — set up your template in Deadline setup.");
    } catch (e) { setMsg(e.message || String(e)); }
    setBusy(false);
  };
  const toggle = async (d) => {
    const done = !d.done;
    setItems((p) => p.map((x) => x.id === d.id ? { ...x, done } : x));
    try { await updateMatterDeadline(d.id, { done, done_at: done ? new Date().toISOString() : null }); } catch (e) { load(); }
  };
  const addManual = async () => {
    if (!nName.trim()) return;
    setBusy(true);
    try { await createMatterDeadline(matter.firm_id, matter.id, { name: nName.trim(), due_date: nDate || null }); setNName(""); setNDate(""); setAdding(false); await load(); }
    catch (e) { setMsg(e.message || String(e)); }
    setBusy(false);
  };
  const editDate = async (d, v) => {
    setItems((p) => p.map((x) => x.id === d.id ? { ...x, due_date: v || null } : x));
    try { await updateMatterDeadline(d.id, { due_date: v || null }); } catch (e) { load(); }
  };
  const remove = async (d) => {
    if (!window.confirm(`Delete "${d.name}"?`)) return;
    try { await deleteMatterDeadline(d.id); await load(); } catch (e) { setMsg(e.message || String(e)); }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmt = (s) => { if (!s) return "No date"; try { return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); } catch { return s; } };
  const isOverdue = (d) => d.due_date && !d.done && new Date(d.due_date + "T00:00:00") < today;
  const dateInput = { border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Deadlines</div>
        <button onClick={generate} disabled={busy} style={{ padding: "7px 13px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>{busy ? "…" : "↻ Generate from template"}</button>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: MUTED }}>Contract date<br />
          <input type="date" value={contractDate} onChange={(e) => onContract(e.target.value)} style={{ ...dateInput, marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: MUTED }}>Closing date<br />
          <input type="date" value={closingDate} onChange={(e) => onClosing(e.target.value)} style={{ ...dateInput, marginTop: 4 }} />
        </label>
      </div>
      {msg && <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>{msg}</div>}

      {loading ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Loading…</div>
        : items.length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af", padding: "6px 0" }}>No deadlines yet. Set your dates and hit “Generate,” or add one below.</div>
          : <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid #eef1f6" }}>
                <input type="checkbox" checked={!!d.done} onChange={() => toggle(d)} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: d.done ? "#9ca3af" : NV, textDecoration: d.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}{d.source === "template" && <span style={{ ...tag("#eef2ff", "#4338ca"), marginLeft: 6 }}>auto</span>}</div>
                  <div style={{ fontSize: 11, color: isOverdue(d) ? "#dc2626" : MUTED, fontWeight: isOverdue(d) ? 600 : 400 }}>{fmt(d.due_date)}{isOverdue(d) ? " · overdue" : ""}</div>
                </div>
                <input type="date" value={d.due_date || ""} onChange={(e) => editDate(d, e.target.value)} style={{ ...dateInput, padding: "4px 6px", fontSize: 11.5 }} />
                <button onClick={() => remove(d)} title="Delete" style={{ padding: "5px 8px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>}

      {adding
        ? <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Deadline name" style={{ ...dateInput, flex: 1, minWidth: 140 }} />
          <input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} style={dateInput} />
          <button onClick={addManual} disabled={busy || !nName.trim()} style={{ padding: "0 14px", background: (busy || !nName.trim()) ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: (busy || !nName.trim()) ? "default" : "pointer" }}>Add</button>
          <button onClick={() => { setAdding(false); setNName(""); setNDate(""); }} style={{ padding: "0 12px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
        </div>
        : <button onClick={() => setAdding(true)} style={{ marginTop: 12, fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>＋ Add deadline</button>}
    </div>
  );
}

/* ---------------- Deadline setup (firm template) ---------------- */
function DeadlineSetup({ firmId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => { setLoading(true); try { setRows(await listDeadlineTemplates()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const addRow = async () => {
    setBusy(true);
    try { await createDeadlineTemplate(firmId, { name: "New deadline", anchor: "contract", offset_days: 0, sort_order: rows.length }); await load(); }
    catch (e) { alert(e.message || String(e)); }
    setBusy(false);
  };
  const seed = async () => {
    setBusy(true);
    try { await seedDefaultTemplates(firmId); await load(); }
    catch (e) { alert(e.message || String(e)); }
    setBusy(false);
  };
  const patch = async (id, p) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...p } : r));
    try { await updateDeadlineTemplate(id, p); } catch (e) { load(); }
  };
  const remove = async (r) => {
    if (!window.confirm(`Remove "${r.name}" from your template?`)) return;
    try { await deleteDeadlineTemplate(r.id); await load(); } catch (e) { alert(e.message || String(e)); }
  };

  const inp = { border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Settings</div>
        <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Deadline setup</div>
        <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Your firm's standard deadlines. Each is an offset from a matter's contract or closing date. They auto-fill onto a matter when you hit “Generate.”</div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 6 }}>
        {loading ? <div style={{ padding: 22, color: "#9ca3af", fontSize: 13 }}>Loading…</div>
          : rows.length === 0
            ? <div style={{ padding: "26px 18px", textAlign: "center" }}>
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>No deadlines set up yet.</div>
              <button onClick={seed} disabled={busy} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", marginRight: 8 }}>Load NJ starter set</button>
              <button onClick={addRow} disabled={busy} style={{ padding: "9px 16px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ Add one</button>
            </div>
            : <div>
              <div style={{ display: "flex", gap: 8, padding: "8px 12px", fontSize: 11, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <div style={{ flex: 1 }}>Deadline</div><div style={{ width: 150 }}>Anchor</div><div style={{ width: 130 }}>Offset (days)</div><div style={{ width: 28 }} />
              </div>
              {rows.map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 12px", borderTop: "1px solid #eef1f6" }}>
                  <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} style={{ ...inp, flex: 1 }} />
                  <select value={r.anchor} onChange={(e) => patch(r.id, { anchor: e.target.value })} style={{ ...inp, width: 150 }}>
                    {DEADLINE_ANCHORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="number" value={r.offset_days} onChange={(e) => patch(r.id, { offset_days: parseInt(e.target.value || "0", 10) })} style={{ ...inp, width: 130 }} />
                  <button onClick={() => remove(r)} title="Remove" style={{ padding: "6px 9px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <div style={{ padding: "10px 12px" }}>
                <button onClick={addRow} disabled={busy} style={{ fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>＋ Add deadline</button>
              </div>
            </div>}
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10 }}>Tip: a negative offset means “before” the anchor (e.g. Closing −3 = three days before closing). Positive means after.</div>
    </div>
  );
}

/* ---------------- Quotes calculator (Phase 3.3a, on-screen) ---------------- */
function QuotesCalculator({ firm }) {
  const states = Object.keys(STATE_RATES);
  const def = states.includes(firm && firm.default_state) ? firm.default_state : "NJ";
  const [state, setState] = useState(def);
  const [ptype, setPtype] = useState(STATE_RATES[def].types[0]);
  const [price, setPrice] = useState("");
  const [loan, setLoan] = useState("");
  const [prior, setPrior] = useState("");
  const [exemption, setExemption] = useState("none");
  const [propClass, setPropClass] = useState("");

  const onState = (s) => { setState(s); setPtype(STATE_RATES[s].types[0]); };
  const num = (s) => Number(String(s || "").replace(/[^\d.]/g, "")) || 0;
  const isNJ = state === "NJ";
  const isRefi = /refi|refinance|non-sale/i.test(ptype);

  const q = useMemo(() => quotePremium(state, ptype, { price: num(price), loan: num(loan), prior: num(prior) }), [state, ptype, price, loan, prior]);
  const rtf = useMemo(() => isNJ ? calcRTF(num(price), exemption) : null, [isNJ, price, exemption]);
  const gpf = useMemo(() => isNJ ? calcGPF(num(price), propClass) : null, [isNJ, price, propClass]);
  const transfer = ((rtf && rtf.amount) || 0) + ((gpf && gpf.amount) || 0);
  const total = (q.premium || 0) + (q.search || 0) + transfer;

  const fld = { border: `1px solid ${LINE}`, borderRadius: 9, padding: "9px 11px", fontSize: 13.5, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 4, display: "block" };
  const sectionLabel = { fontSize: 11.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", margin: "12px 0 2px" };
  const Line = ({ label, amount, strong, muted }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid #eef1f6", fontSize: strong ? 14.5 : 13, fontWeight: strong ? 700 : 500, color: muted ? MUTED : "#0f172a" }}>
      <span>{label}</span><span>{amount == null ? "" : money(amount)}</span>
    </div>
  );

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Tools</div>
        <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Quotes</div>
        <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Instant title-premium and transfer-tax estimate, using Lakeland's filed rates.</div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={lbl}>State</label><select value={state} onChange={(e) => onState(e.target.value)} style={fld}>{states.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label style={lbl}>Policy type</label><select value={ptype} onChange={(e) => setPtype(e.target.value)} style={fld}>{STATE_RATES[state].types.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div><label style={lbl}>Purchase price / owner coverage</label><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="$" style={fld} /></div>
          <div><label style={lbl}>Loan amount</label><input value={loan} onChange={(e) => setLoan(e.target.value)} placeholder="$" style={fld} /></div>
          {isNJ && isRefi && <div><label style={lbl}>Prior owner's coverage</label><input value={prior} onChange={(e) => setPrior(e.target.value)} placeholder="$" style={fld} /></div>}
          {isNJ && <div><label style={lbl}>RTF exemption</label><select value={exemption} onChange={(e) => setExemption(e.target.value)} style={fld}>{SIMPLE_EXEMPTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>}
          {isNJ && <div><label style={lbl}>Property class (GPF over $1M)</label><select value={propClass} onChange={(e) => setPropClass(e.target.value)} style={fld}>{PROPERTY_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>}
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ ...sectionLabel, marginTop: 0 }}>Title premium</div>
          {q.lines && q.lines.length ? q.lines.map((l, i) => <Line key={i} label={l.label} amount={l.amount} muted={l.amount == null} />) : <Line label="Enter amounts above" amount={null} muted />}
          {q.search > 0 && <Line label="Search & exam fee" amount={q.search} />}
          {isNJ && <>
            <div style={sectionLabel}>Transfer tax (NJ)</div>
            <Line label={`Realty Transfer Fee${rtf && rtf.rateTable ? ` · ${rtf.rateTable}` : ""}`} amount={rtf ? rtf.amount : 0} />
            {gpf && gpf.amount > 0 && <Line label={`Graduated Percent Fee · ${gpf.bracketLabel}`} amount={gpf.amount} />}
          </>}
          <Line label="Estimated total" amount={total} strong />
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>Estimate only — figures use Lakeland's current filed rates. Recording fees and firm charges aren't included yet (coming in 3.3b).</div>
      </div>
    </div>
  );
}

/* ---------------- Calendar / agenda (Phase 3.1b) ---------------- */
function Calendar({ onOpen }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("agenda"); // agenda | month
  const [showDone, setShowDone] = useState(false);
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [selDay, setSelDay] = useState(null);

  const load = async () => { setLoading(true); try { setItems(await listFirmDeadlines()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const toggle = async (d) => {
    const done = !d.done;
    setItems((p) => p.map((x) => x.id === d.id ? { ...x, done } : x));
    try { await updateMatterDeadline(d.id, { done, done_at: done ? new Date().toISOString() : null }); } catch (e) { load(); }
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const parse = (s) => s ? new Date(s + "T00:00:00") : null;
  const fmt = (s) => { const d = parse(s); return d ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "No date"; };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const matterLabel = (m) => m ? ([m.file_number, m.property_address].filter(Boolean).join(" · ") || "(matter)") : "(matter)";

  const visible = items.filter((d) => (showDone || !d.done) && d.due_date);
  const overdue = [], soon = [], later = [];
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
  for (const d of visible) {
    const due = parse(d.due_date);
    if (!d.done && due < today) overdue.push(d);
    else if (due <= in7) soon.push(d);
    else later.push(d);
  }

  const navBtn = { width: 34, height: 34, borderRadius: 8, border: `1px solid ${LINE}`, background: "#fff", cursor: "pointer", fontSize: 17, color: NV, lineHeight: 1 };
  const Row = ({ d }) => {
    const due = parse(d.due_date);
    const od = !d.done && due < today;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderTop: "1px solid #eef1f6" }}>
        <input type="checkbox" checked={!!d.done} onChange={() => toggle(d)} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
        <div style={{ width: 96, flexShrink: 0, fontSize: 12, fontWeight: 600, color: od ? "#dc2626" : NV }}>{fmt(d.due_date)}</div>
        <div onClick={() => d.matter && onOpen(d.matter.id)} style={{ minWidth: 0, flex: 1, cursor: d.matter ? "pointer" : "default" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: d.done ? "#9ca3af" : "#0f172a", textDecoration: d.done ? "line-through" : "none" }}>{d.name}</div>
          <div style={{ fontSize: 11.5, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{matterLabel(d.matter)}</div>
        </div>
        {od && <span style={tag("#fef2f2", "#dc2626")}>overdue</span>}
      </div>
    );
  };
  const Group = ({ label, list, color }) => list.length === 0 ? null : (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, marginBottom: 14, overflow: "hidden" }}>
      <div style={{ padding: "11px 16px", fontWeight: 600, fontSize: 13, color, background: "#fafbfd", display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span><span style={{ color: MUTED }}>{list.length}</span>
      </div>
      {list.map((d) => <Row key={d.id} d={d} />)}
    </div>
  );

  const monthCells = useMemo(() => {
    const start = new Date(cursor); const startDow = start.getDay();
    const gridStart = new Date(start); gridStart.setDate(1 - startDow);
    const cells = [];
    for (let i = 0; i < 42; i++) { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); cells.push(d); }
    return cells;
  }, [cursor]);
  const byDay = useMemo(() => { const m = {}; for (const d of items) { if ((showDone || !d.done) && d.due_date) (m[d.due_date] = m[d.due_date] || []).push(d); } return m; }, [items, showDone]);
  const monthName = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Your practice</div>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Calendar</div>
          <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Every deadline across your matters, in one place.</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: MUTED, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show completed</label>
          {["agenda", "month"].map((v) => <button key={v} onClick={() => setView(v)} style={{ padding: "7px 14px", borderRadius: 18, border: `1px solid ${LINE}`, background: view === v ? BL : "#fff", color: view === v ? "#fff" : MUTED, cursor: "pointer", fontSize: 12.5, fontWeight: 600, textTransform: "capitalize" }}>{v}</button>)}
        </div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", fontSize: 13, padding: 20 }}>Loading…</div>
        : view === "agenda"
          ? (visible.length === 0
            ? <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "40px 18px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>No deadlines yet. Add them on a matter, or set up your firm template in Deadline setup.</div>
            : <>
              <Group label="Overdue" list={overdue} color="#dc2626" />
              <Group label="Next 7 days" list={soon} color={NV} />
              <Group label="Later" list={later} color={MUTED} />
            </>)
          : <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button onClick={() => { setSelDay(null); setCursor((c) => { const n = new Date(c); n.setMonth(n.getMonth() - 1); return n; }); }} style={navBtn}>‹</button>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{monthName}</div>
              <button onClick={() => { setSelDay(null); setCursor((c) => { const n = new Date(c); n.setMonth(n.getMonth() + 1); return n; }); }} style={navBtn}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => <div key={w} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 600, color: MUTED, padding: "2px 0" }}>{w}</div>)}
              {monthCells.map((d, i) => {
                const inMonth = d.getMonth() === cursor.getMonth();
                const key = iso(d);
                const dayItems = byDay[key] || [];
                const isToday = d.getTime() === today.getTime();
                return (
                  <div key={i} onClick={() => dayItems.length && setSelDay(selDay === key ? null : key)} style={{ minHeight: 66, border: `1px solid ${selDay === key ? BL : "#eef1f6"}`, borderRadius: 8, padding: 5, background: inMonth ? "#fff" : "#fafafa", cursor: dayItems.length ? "pointer" : "default", opacity: inMonth ? 1 : 0.55 }}>
                    <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? BL : "#334155", textAlign: "right" }}>{d.getDate()}</div>
                    {dayItems.slice(0, 3).map((x) => { const xo = !x.done && parse(x.due_date) < today; return <div key={x.id} style={{ fontSize: 9.5, marginTop: 2, padding: "1px 4px", borderRadius: 3, background: x.done ? "#f1f5f9" : xo ? "#fef2f2" : "#e8f3ff", color: x.done ? "#94a3b8" : xo ? "#dc2626" : "#0f6fd1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.name}</div>; })}
                    {dayItems.length > 3 && <div style={{ fontSize: 9, color: MUTED, marginTop: 1 }}>+{dayItems.length - 3} more</div>}
                  </div>
                );
              })}
            </div>
            {selDay && (byDay[selDay] || []).length > 0 && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${LINE}`, paddingTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: NV, padding: "8px 16px 0" }}>{fmt(selDay)}</div>
                {(byDay[selDay] || []).map((d) => <Row key={d.id} d={d} />)}
              </div>
            )}
          </div>}
    </div>
  );
}

/* ---------------- Messages panel ---------------- */
function MessagesPanel({ matter, email, onRead }) {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef(null);
  const connected = !!matter.lakeland_file_number;

  const load = async (scroll, mark) => {
    try {
      const m = await listMessages(matter.id);
      setMsgs(m);
      if (scroll) setTimeout(() => endRef.current && endRef.current.scrollIntoView({ behavior: "smooth" }), 50);
      if (mark && connected) { try { await markRead(matter.firm_id, matter.id); onRead && onRead(); } catch (_) {} }
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => {
    setLoading(true); load(true, true);
    const id = setInterval(() => load(false, false), 20000);
    return () => clearInterval(id);
    /* eslint-disable-next-line */
  }, [matter.id]);

  const send = async () => {
    const body = text.trim();
    if (!body || !connected) return;
    setBusy(true); setErr("");
    try { await postMessage(matter.firm_id, matter.id, body, email); setText(""); await load(true, true); }
    catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const onKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const fmt = (s) => { try { return new Date(s).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch { return ""; } };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 560 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Messages</div>
      <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>
        {connected ? "Direct line to the Lakeland team on this file." : "Connect this matter to a Lakeland file to message the title team."}
      </div>
      {err && <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>{err}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", padding: "4px 2px" }}>
        {loading ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Loading…</div>
          : msgs.length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af", padding: "8px 0" }}>{connected ? "No messages yet. Say hello 👋" : "No messages yet."}</div>
          : msgs.map((m) => {
            const mine = m.sender_type === "firm";
            return (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize: 10.5, color: MUTED, margin: "0 4px 3px" }}>{mine ? "You" : "Lakeland"}{m.sender_name ? ` · ${m.sender_name}` : ""} · {fmt(m.created_at)}</div>
                <div style={{ maxWidth: "82%", padding: "9px 12px", borderRadius: 13, fontSize: 13, lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word", background: mine ? BL : "#f1f5f9", color: mine ? "#fff" : "#0f172a", borderBottomRightRadius: mine ? 4 : 13, borderBottomLeftRadius: mine ? 13 : 4 }}>{m.body}</div>
              </div>
            );
          })}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} rows={2}
          placeholder={connected ? "Write a message…" : "Connect to a file first"} disabled={!connected || busy}
          style={{ flex: 1, resize: "none", border: `1px solid ${LINE}`, borderRadius: 9, padding: "9px 11px", fontSize: 13, fontFamily: "inherit", outline: "none", background: connected ? "#fff" : "#f8fafc" }} />
        <button onClick={send} disabled={!connected || busy || !text.trim()}
          style={{ padding: "0 16px", background: (!connected || busy || !text.trim()) ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: (!connected || busy || !text.trim()) ? "default" : "pointer" }}>{busy ? "…" : "Send"}</button>
      </div>
    </div>
  );
}

/* ---------------- Connect-to-Lakeland modal ---------------- */
function ConnectModal({ matter, onClose, onLinked }) {
  const [fileNo, setFileNo] = useState(matter.file_number || "");
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    const fn = fileNo.trim(), z = zip.trim();
    if (!fn || !z) { setErr("Enter the Lakeland file number and the property ZIP."); return; }
    setBusy(true); setErr("");
    try {
      const res = await linkLakelandMatter(matter.id, fn, z);
      if (res && res.ok) { onLinked(); return; }
      setErr(res && res.error === "no_match"
        ? "No Lakeland file matches that file number and ZIP. Double-check both with your title contact."
        : "Couldn't connect: " + ((res && res.error) || "unknown error"));
      setBusy(false);
    } catch (e) { setErr(e.message || String(e)); setBusy(false); }
  };

  const inp = { width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13.5, fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", margin: "12px 0 5px" };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 430, boxShadow: "0 12px 40px rgba(16,24,40,.2)" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 18 }}>Connect to Lakeland</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 4 }}>Enter the Lakeland file number and the property ZIP code to link this matter to its file and turn on live status.</div>
          <label style={lbl}>Lakeland file number</label>
          <input style={inp} value={fileNo} onChange={(e) => setFileNo(e.target.value)} placeholder="e.g. 2026-01234" autoFocus />
          <label style={lbl}>Property ZIP</label>
          <input style={inp} value={zip} onChange={(e) => setZip(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="e.g. 08701" />
          {err && <div style={{ marginTop: 10, fontSize: 12.5, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 11px" }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 16, padding: "11px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: busy ? "default" : "pointer" }}>{busy ? "Connecting…" : "Connect"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Place-title-order modal ---------------- */
function PlaceOrderModal({ matter, onClose, onPlaced }) {
  const [f, setF] = useState({
    property_address: matter.property_address || "",
    town: matter.town || "",
    state: matter.state || "NJ",
    zip: "",
    transaction_type: matter.transaction_type || "Purchase",
    buyer: "", seller: "", lender: "", notes: ""
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.property_address.trim()) { setErr("Property address is required."); return; }
    setBusy(true); setErr("");
    try {
      await createOrderRequest(matter.firm_id, {
        matter_id: matter.id,
        property_address: f.property_address.trim(),
        town: f.town.trim() || null,
        state: f.state,
        zip: f.zip.trim() || null,
        transaction_type: f.transaction_type,
        buyer: f.buyer.trim() || null,
        seller: f.seller.trim() || null,
        lender: f.lender.trim() || null,
        notes: f.notes.trim() || null
      });
      onPlaced();
    } catch (e) { setErr(e.message || String(e)); setBusy(false); }
  };

  const inp = { width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13.5, fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", margin: "12px 0 5px" };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto", boxShadow: "0 12px 40px rgba(16,24,40,.2)" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 18 }}>Place a title order</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 12.5, color: MUTED, marginBottom: 6 }}>This sends the file to Lakeland to open. They'll review it, open the file, and your matter connects automatically.</div>

          <label style={lbl}>Property address</label>
          <input style={inp} value={f.property_address} onChange={(e) => u("property_address", e.target.value)} placeholder="123 Main St" autoFocus />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}><label style={lbl}>Town</label><input style={inp} value={f.town} onChange={(e) => u("town", e.target.value)} /></div>
            <div style={{ flex: 1 }}><label style={lbl}>State</label><select style={inp} value={f.state} onChange={(e) => u("state", e.target.value)}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div style={{ flex: 1 }}><label style={lbl}>ZIP</label><input style={inp} value={f.zip} onChange={(e) => u("zip", e.target.value)} /></div>
          </div>
          <label style={lbl}>Transaction type</label>
          <select style={inp} value={f.transaction_type} onChange={(e) => u("transaction_type", e.target.value)}>{TX_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={lbl}>Buyer</label><input style={inp} value={f.buyer} onChange={(e) => u("buyer", e.target.value)} placeholder="Optional" /></div>
            <div style={{ flex: 1 }}><label style={lbl}>Seller</label><input style={inp} value={f.seller} onChange={(e) => u("seller", e.target.value)} placeholder="Optional" /></div>
          </div>
          <label style={lbl}>Lender</label>
          <input style={inp} value={f.lender} onChange={(e) => u("lender", e.target.value)} placeholder="Optional" />
          <label style={lbl}>Notes for Lakeland</label>
          <textarea style={{ ...inp, resize: "vertical", minHeight: 56 }} value={f.notes} onChange={(e) => u("notes", e.target.value)} placeholder="Anything they should know" />

          {err && <div style={{ marginTop: 10, fontSize: 12.5, color: "#b91c1c", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 11px" }}>{err}</div>}
          <button onClick={submit} disabled={busy} style={{ width: "100%", marginTop: 16, padding: "11px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: busy ? "default" : "pointer" }}>{busy ? "Sending…" : "Send order to Lakeland"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- New matter modal ---------------- */
function NewMatterModal({ onClose, onCreate }) {
  const [provider, setProvider] = useState("lakeland");
  const [f, setF] = useState({ file_number: "", property_address: "", town: "", state: "NJ", transaction_type: "Purchase", title_company_name: "" });
  const [saving, setSaving] = useState(false);
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      await onCreate({
        title_provider: provider,
        title_company_name: provider === "other" ? f.title_company_name.trim() : null,
        file_number: f.file_number.trim(),
        property_address: f.property_address.trim(),
        town: f.town.trim(),
        state: f.state,
        transaction_type: f.transaction_type,
        stage: 0
      });
    } catch (e) {
      setSaving(false);
      alert("Couldn't create the matter: " + (e.message || e));
    }
  };

  const inp = { width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13.5, fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", margin: "12px 0 5px" };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflow: "auto", boxShadow: "0 12px 40px rgba(16,24,40,.2)" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 18 }}>New matter</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          <div style={lbl}>Title handled by</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["lakeland", "◆ Lakeland"], ["other", "Other / none"]].map(([k, l]) => (
              <button key={k} onClick={() => setProvider(k)} style={{
                flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: `1px solid ${provider === k ? BL : LINE}`, background: provider === k ? "#eff6ff" : "#fff", color: provider === k ? BL : "#475569"
              }}>{l}</button>
            ))}
          </div>
          {provider === "other" && (
            <>
              <label style={lbl}>Title company (optional)</label>
              <input style={inp} value={f.title_company_name} onChange={(e) => u("title_company_name", e.target.value)} placeholder="e.g. First American" />
            </>
          )}

          <label style={lbl}>File number</label>
          <input style={inp} value={f.file_number} onChange={(e) => u("file_number", e.target.value)} placeholder="Your file #" />

          <label style={lbl}>Property address</label>
          <input style={inp} value={f.property_address} onChange={(e) => u("property_address", e.target.value)} placeholder="123 Main St" />

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={lbl}>Town</label>
              <input style={inp} value={f.town} onChange={(e) => u("town", e.target.value)} placeholder="Lakewood" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>State</label>
              <select style={inp} value={f.state} onChange={(e) => u("state", e.target.value)}>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <label style={lbl}>Transaction type</label>
          <select style={inp} value={f.transaction_type} onChange={(e) => u("transaction_type", e.target.value)}>
            {TX_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>

          <button onClick={submit} disabled={saving} style={{ width: "100%", marginTop: 18, padding: "11px", background: saving ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: saving ? "default" : "pointer" }}>
            {saving ? "Creating…" : "Create matter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function tag(bg, color) {
  return { fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap", background: bg, color };
}
function shade(hex) {
  // darken a hex by ~12% for the banner gradient start
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 255) - 22), g = Math.max(0, ((n >> 8) & 255) - 22), b = Math.max(0, (n & 255) - 22);
    return `rgb(${r},${g},${b})`;
  } catch { return hex; }
}
