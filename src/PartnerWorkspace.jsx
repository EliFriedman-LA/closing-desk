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
import EmailAssistant from "./PartnerEmailAssistant.jsx";
import { listNotifications, markNotificationRead, markNotificationsRead, myReadNotificationIds, listOpenDeadlines } from "./partnerDb.js";
import { teamMembers, teamPendingInvites, teamInvite, teamSetRole, teamRemove, teamRevokeInvite } from "./partnerDb.js";
import { TASK_ANCHORS, TASK_TYPES, listTaskTemplates, createTaskTemplate, updateTaskTemplate, deleteTaskTemplate, seedDefaultTaskTemplates, listMatterTasks, createMatterTask, updateMatterTask, deleteMatterTask, generateTasks, myOpenTasks } from "./partnerDb.js";
import { aiAssist, setMatterArchived } from "./partnerDb.js";
import { STATE_RATES, quotePremium, calcRTF, calcGPF, SIMPLE_EXEMPTION_OPTIONS, PROPERTY_CLASS_OPTIONS, money } from "./partnerRates.js";
import { listFeeLines, createFeeLine, updateFeeLine, deleteFeeLine, seedDefaultFees } from "./partnerDb.js";
import { listDocTemplates, createDocTemplate, updateDocTemplate, deleteDocTemplate, uploadDocTemplateFile, downloadDocTemplateFile } from "./partnerDb.js";
import { DOC_TOKENS, TOKEN_LABELS, buildMergeData, generateDocs, downloadBlob } from "./partnerDocs.js";
import { createClientLink, listClientLinks, revokeClientLink, setDocumentClientVisible, listClientMessages, sendClientMessageAsFirm, markClientMessagesRead, extractContract } from "./partnerDb.js";

const NV = "#1e3a5f", BL = "#1B91FE", MUTED = "#64748b", LINE = "#e6eaf0", FIRM_DEFAULT = "#0f5132";

export default function Workspace({ ctx, email, onSignOut }) {
  const firm = ctx.firm || {};
  const myRole = ctx.role || "attorney";
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
  const [notifs, setNotifs] = useState([]);
  const [readIds, setReadIds] = useState(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setMatters(await listMatters()); } catch (e) { console.error(e); }
    setLoading(false);
  };
  const loadUnreads = async () => { try { setUnreads(await listUnreads()); } catch (e) { /* ignore */ } };
  const loadNotifs = async () => {
    try {
      const [n, r] = await Promise.all([listNotifications(), myReadNotificationIds()]);
      setNotifs(n); setReadIds(r);
    } catch (e) { /* ignore */ }
  };
  useEffect(() => {
    load(); loadUnreads(); loadNotifs();
    const id = setInterval(() => { loadUnreads(); loadNotifs(); }, 25000);
    return () => clearInterval(id);
  }, []);

  const openNotif = async (n) => {
    if (!readIds.has(n.id)) {
      try { await markNotificationRead(n.id); } catch (e) { /* ignore */ }
      setReadIds((prev) => { const s = new Set(prev); s.add(n.id); return s; });
    }
    if (n.matter_id) { setPage("matters"); setSelectedId(n.matter_id); }
  };
  const markAllNotifs = async () => {
    const unread = notifs.filter((n) => !readIds.has(n.id)).map((n) => n.id);
    if (!unread.length) return;
    try { await markNotificationsRead(unread); } catch (e) { /* ignore */ }
    setReadIds((prev) => { const s = new Set(prev); unread.forEach((id) => s.add(id)); return s; });
  };

  const selected = matters.find((m) => m.id === selectedId) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = showArchived ? matters.filter((m) => m.archived) : matters.filter((m) => !m.archived);
    if (q) list = list.filter((m) =>
      [m.file_number, m.property_address, m.town, m.transaction_type, m.title_company_name]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
    return list;
  }, [matters, query, showArchived]);
  const archivedCount = matters.filter((m) => m.archived).length;
  const openCount = matters.filter((m) => !m.archived && (m.stage || 0) < STAGES.length - 1).length;
  const lakelandCount = matters.filter((m) => m.title_provider === "lakeland").length;

  const onCreate = async (payload, seed) => {
    const m = await createMatter(firm.id, payload);
    setShowNew(false);
    await load();
    if (seed) {
      try { await generateDeadlines(firm.id, m); } catch (e) { /* ignore */ }
      try { await generateTasks(firm.id, m); } catch (e) { /* ignore */ }
    }
    setSelectedId(m.id);
    setPage("matters");
  };
  const onStage = async (m, stage) => {
    const up = await updateMatter(m.id, { stage });
    setMatters((prev) => prev.map((x) => (x.id === m.id ? up : x)));
  };
  const onArchive = async (m) => {
    const up = await setMatterArchived(m.id, !m.archived);
    setMatters((prev) => prev.map((x) => (x.id === m.id ? up : x)));
    setSelectedId(null);
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
          {navItem("mytasks", "My tasks", "✓")}
          {navItem("calendar", "Calendar", "▥")}
          {navItem("quotes", "Quotes", "◈")}
          {navItem("contacts", "Contacts", "◍")}
          {navItem("deadlinesetup", "Deadline setup", "◷")}
          {navItem("checklists", "Checklists", "▣")}
          {navItem("feesetup", "Quote fees", "◇")}
          {navItem("doctemplates", "Doc templates", "❏")}
          {navItem("emailassistant", "Email assistant", "✉")}
          {navItem("team", "Team", "◑")}
          <div style={{ fontSize: 10, letterSpacing: ".09em", textTransform: "uppercase", color: "#6f93bb", padding: "16px 12px 6px", fontWeight: 600 }}>Coming soon</div>
          {["✉ Smart Inbox", "✶ AI contract import"].map((t) => (
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
          {page !== "contacts" && (
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search matters…" style={{ flex: 1, maxWidth: 380, padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 9, background: "#f8fafc", fontSize: 13.5 }} />
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <NotificationBell items={notifs} readIds={readIds} onOpenItem={openNotif} onMarkAll={markAllNotifs} />
            {page !== "contacts" && <button onClick={() => setShowNew(true)} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ New matter</button>}
          </div>
        </header>

        <main style={{ padding: "24px 26px 60px", maxWidth: 1100, width: "100%" }}>
          {selected
            ? <MatterDetail matter={selected} firm={firm} email={email} onBack={() => setSelectedId(null)} onStage={onStage} onDelete={onDelete} onArchive={onArchive} onRefresh={load} onRead={loadUnreads} />
            : page === "dashboard"
              ? <Dashboard firm={firm} org={org} accent={accent} initials={initials} openCount={openCount} lakelandCount={lakelandCount} total={matters.length} recent={matters.slice(0, 5)} matters={matters} unreads={unreads} onOpen={(id) => setSelectedId(id)} onNew={() => setShowNew(true)} />
              : page === "contacts"
                ? <Contacts firmId={firm.id} />
                : page === "mytasks"
                  ? <MyTasks onOpen={(id) => { setPage("matters"); setSelectedId(id); }} />
                  : page === "calendar"
                  ? <Calendar onOpen={(id) => setSelectedId(id)} />
                  : page === "quotes"
                    ? <QuotesCalculator firm={firm} onEditFees={() => go("feesetup")} />
                    : page === "deadlinesetup"
                      ? <DeadlineSetup firmId={firm.id} />
                      : page === "checklists"
                        ? <ChecklistSetup firmId={firm.id} />
                      : page === "feesetup"
                        ? <FeeSetup firmId={firm.id} />
                        : page === "doctemplates"
                          ? <DocTemplates firmId={firm.id} />
                          : page === "emailassistant"
                            ? <EmailAssistant firmId={firm.id} />
                            : page === "team"
                              ? <Team firm={firm} myRole={myRole} myEmail={email} />
                              : <MattersList loading={loading} matters={filtered} total={matters.length} unreads={unreads} onOpen={(id) => setSelectedId(id)} onNew={() => setShowNew(true)} query={query} showArchived={showArchived} onToggleArchived={() => setShowArchived((s) => !s)} archivedCount={archivedCount} />}
        </main>
      </div>

      {showNew && <NewMatterModal onClose={() => setShowNew(false)} onCreate={onCreate} />}
    </div>
  );
}

/* ---------------- Needs attention (deadline watchdog) ---------------- */
function NeedsAttention({ matters = [], onOpen }) {
  const [deadlines, setDeadlines] = useState([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { (async () => { try { setDeadlines(await listOpenDeadlines()); } catch (e) { /* ignore */ } setLoaded(true); })(); }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const mById = {}; matters.forEach((m) => { mById[m.id] = m; });
  const addr = (id) => { const m = mById[id]; return m ? (m.property_address || m.file_number || "a file") : "a file"; };
  const days = (d) => { try { return Math.round((new Date(d + "T00:00:00").getTime() - today.getTime()) / 86400000); } catch (e) { return null; } };

  const overdue = deadlines.filter((d) => d.due_date && days(d.due_date) !== null && days(d.due_date) < 0);
  const soon = deadlines.filter((d) => { const n = d.due_date && days(d.due_date); return n !== null && n >= 0 && n <= 7; });
  const ctc = STAGES.indexOf("Clear to close");
  const atRisk = matters.filter((m) => { const n = m.closing_date && days(m.closing_date); return n !== null && n >= 0 && n <= 7 && (m.stage || 0) < ctc; });

  if (!loaded) return null;
  if (overdue.length === 0 && soon.length === 0 && atRisk.length === 0) return null;

  const Row = ({ id, label, sub, tone }) => (
    <div onClick={() => onOpen && onOpen(id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", borderTop: "1px solid #eef1f6", cursor: "pointer" }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NV, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>
      </div>
    </div>
  );
  const cap = (arr, n) => arr.slice(0, n);

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, marginBottom: 18, overflow: "hidden" }}>
      <div style={{ padding: "13px 16px", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
        <span style={{ fontWeight: 700, fontSize: 14, color: NV }}>Needs attention</span>
        <span style={{ fontSize: 12, color: MUTED }}>{overdue.length + soon.length + atRisk.length} item{overdue.length + soon.length + atRisk.length === 1 ? "" : "s"}</span>
      </div>
      {cap(overdue, 6).map((d) => { const n = Math.abs(days(d.due_date)); return <Row key={"o" + d.id} id={d.matter_id} label={d.name} sub={`${n} day${n === 1 ? "" : "s"} overdue · ${addr(d.matter_id)}`} tone="#ef4444" />; })}
      {cap(atRisk, 6).map((m) => { const n = days(m.closing_date); return <Row key={"r" + m.id} id={m.id} label={`Closing in ${n} day${n === 1 ? "" : "s"} — not cleared to close`} sub={addr(m.id)} tone="#f59e0b" />; })}
      {cap(soon, 8).map((d) => { const n = days(d.due_date); return <Row key={"s" + d.id} id={d.matter_id} label={d.name} sub={`${n === 0 ? "due today" : "in " + n + " day" + (n === 1 ? "" : "s")} · ${addr(d.matter_id)}`} tone="#f59e0b" />; })}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ firm, org, accent, initials, openCount, lakelandCount, total, recent, matters = [], unreads = {}, onOpen, onNew }) {
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
      <NeedsAttention matters={matters} onOpen={onOpen} />
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
function MattersList({ loading, matters, total, unreads = {}, onOpen, onNew, query, showArchived, onToggleArchived, archivedCount = 0 }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Your practice</div>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>{showArchived ? "Archived" : "Matters"}</div>
          <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>{showArchived ? "Closed and archived files." : "Every file — with Lakeland or not."}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {(archivedCount > 0 || showArchived) && <button onClick={onToggleArchived} style={{ fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>{showArchived ? "← Active matters" : `Archived (${archivedCount})`}</button>}
          {!showArchived && <button onClick={onNew} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ New matter</button>}
        </div>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14 }}>
        {loading
          ? <div style={{ padding: "26px 18px", color: "#9ca3af", fontSize: 13 }}>Loading…</div>
          : matters.length === 0
            ? <div style={{ padding: "30px 18px", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>{showArchived ? "No archived files." : (query ? "No matters match your search." : "No matters yet — open your first file with “New matter.”")}</div>
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
function MatterDetail({ matter, firm, email, onBack, onStage, onDelete, onArchive, onRefresh, onRead }) {
  const conn = matter.title_provider === "lakeland";
  const linked = !!matter.lakeland_file_number;
  const [live, setLive] = useState(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [request, setRequest] = useState(null);
  const [showPlace, setShowPlace] = useState(false);
  const [showGen, setShowGen] = useState(false);
  const [docsKey, setDocsKey] = useState(0);

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
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 25, lineHeight: 1.1 }}>{matter.property_address || "(no address)"}{matter.archived && <span style={{ ...tag("#f1f5f9", "#475569"), marginLeft: 10, verticalAlign: "middle" }}>Archived</span>}</div>
          <div style={{ color: MUTED, fontSize: 13.5, marginTop: 3 }}>{matter.town || ""}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onArchive(matter)} style={{ padding: "7px 12px", background: "#fff", border: `1px solid ${LINE}`, color: NV, borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>{matter.archived ? "Unarchive" : "Archive"}</button>
          <button onClick={() => onDelete(matter)} style={{ padding: "7px 12px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>Delete</button>
        </div>
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

      <PartiesPanel matter={matter} onRefresh={onRefresh} />

      <DeadlinesPanel matter={matter} onRefresh={onRefresh} />
      <TasksPanel matter={matter} />
      <AIPanel matter={matter} firm={firm} />

      <ClientPortalPanel matter={matter} />

      <ClientMessagesPanel matter={matter} />

      <DocumentsPanel matter={matter} reloadKey={docsKey} onGenerate={() => setShowGen(true)} />

      <MessagesPanel matter={matter} email={email} onRead={onRead} />

      {showConnect && <ConnectModal matter={matter} onClose={() => setShowConnect(false)} onLinked={() => { setShowConnect(false); onRefresh && onRefresh(); }} />}
      {showPlace && <PlaceOrderModal matter={matter} onClose={() => setShowPlace(false)} onPlaced={async () => { setShowPlace(false); const r = await getMatterRequest(matter.id); setRequest(r); }} />}
      {showGen && <GenerateDocModal matter={matter} firm={firm} onClose={() => setShowGen(false)} onSaved={() => setDocsKey((k) => k + 1)} />}
    </div>
  );
}

/* ---------------- Documents panel ---------------- */
function DocumentsPanel({ matter, reloadKey, onGenerate }) {
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
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [matter.id, reloadKey]);

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
  const toggleShare = async (doc) => {
    const next = !doc.client_visible;
    setDocs((p) => p.map((x) => x.id === doc.id ? { ...x, client_visible: next } : x));
    try { await setDocumentClientVisible(doc.id, next); } catch (e) { setErr(e.message || String(e)); load(); }
  };

  const fmtSize = (n) => !n ? "" : n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB";
  const fmtDate = (s) => { try { return new Date(s).toLocaleDateString(); } catch { return ""; } };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Documents</div>
        <input ref={inputRef} type="file" onChange={onPick} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8 }}>
          {onGenerate && <button onClick={onGenerate} style={{ padding: "7px 13px", background: "#fff", color: NV, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>✦ Generate</button>}
          <button onClick={() => inputRef.current && inputRef.current.click()} disabled={busy} style={{ padding: "7px 13px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>{busy ? "Uploading…" : "⬆ Upload"}</button>
        </div>
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
              <span style={d.uploaded_by_client ? tag("#fef3c7", "#92400e") : d.side === "lakeland" ? tag("#e8f3ff", "#0f6fd1") : tag("#f1f5f9", "#475569")}>{d.uploaded_by_client ? "Client" : d.side === "lakeland" ? "Lakeland" : "You"}</span>
              <button onClick={() => toggleShare(d)} title="Show in the client portal" style={{ padding: "5px 10px", background: d.client_visible ? "#ecfdf5" : "#fff", border: `1px solid ${d.client_visible ? "#a7f3d0" : LINE}`, color: d.client_visible ? "#065f46" : MUTED, borderRadius: 6, fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" }}>{d.client_visible ? "Shared ✓" : "Share"}</button>
              <button onClick={() => open(d)} style={{ padding: "5px 10px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, fontSize: 11.5, fontWeight: 500, cursor: "pointer" }}>Open</button>
              {d.side === "firm" && <button onClick={() => remove(d)} title="Delete" style={{ padding: "5px 8px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>✕</button>}
            </div>
          ))}
        </div>}
    </div>
  );
}

/* ---------------- Deadlines panel (per matter) ---------------- */
/* ---------------- AI assistant (Phase A1) ---------------- */
function AIPanel({ matter, firm }) {
  const [tool, setTool] = useState("letter");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [out, setOut] = useState("");
  const [copied, setCopied] = useState(false);
  const [represents, setRepresents] = useState("the buyer");
  const [pasteText, setPasteText] = useState("");
  const fileRef = React.useRef(null);

  const reset = () => { setOut(""); setErr(""); setCopied(false); };
  const copy = () => { try { navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) { /* ignore */ } };

  const toBase64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("Couldn't read the file."));
    r.readAsDataURL(file);
  });

  const draftLetter = async () => {
    setBusy(true); reset();
    try {
      const result = await aiAssist({ task: "draft_letter", context: {
        transaction_type: matter.transaction_type, property_address: matter.property_address, town: matter.town, state: matter.state,
        buyer: matter.buyer_name, seller: matter.seller_name, lender: matter.lender_name,
        contract_date: matter.contract_date, closing_date: matter.closing_date,
        title_company: matter.title_company_name, firm_name: firm && firm.name, represents
      } });
      setOut(result);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const summarizeFile = async (file) => {
    if (!file) return;
    setBusy(true); reset();
    try { setOut(await aiAssist({ task: "summarize", pdf: await toBase64(file) })); }
    catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };
  const summarizeText = async () => {
    const t = pasteText.trim(); if (!t) return;
    setBusy(true); reset();
    try { setOut(await aiAssist({ task: "summarize", text: t })); }
    catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };

  const tabBtn = (k, label) => (
    <button onClick={() => { setTool(k); reset(); }} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, background: tool === k ? BL : "#eef2f7", color: tool === k ? "#fff" : NV }}>{label}</button>
  );
  const inp = { border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 620 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>AI assistant</div>
        {tabBtn("letter", "Review letter")}
        {tabBtn("summary", "Summarize doc")}
      </div>

      {tool === "letter" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <label style={{ fontSize: 12.5, color: MUTED }}>We represent:</label>
            <select value={represents} onChange={(e) => setRepresents(e.target.value)} style={{ ...inp, padding: "6px 9px" }}>
              <option value="the buyer">the buyer / borrower</option>
              <option value="the seller">the seller</option>
            </select>
            <button onClick={draftLetter} disabled={busy} style={{ padding: "8px 15px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>{busy ? "Drafting…" : "Draft attorney-review letter"}</button>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 8 }}>Uses this file's parties and dates. Always read and adjust before sending — it's a starting draft, not legal advice.</div>
        </div>
      )}

      {tool === "summary" && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} style={{ padding: "8px 15px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>{busy ? "Reading…" : "Upload a PDF"}</button>
            <input ref={fileRef} type="file" accept="application/pdf" onChange={(e) => summarizeFile(e.target.files && e.target.files[0])} style={{ display: "none" }} />
            <span style={{ fontSize: 12, color: MUTED }}>contract or title commitment</span>
          </div>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="…or paste the document text here" rows={3} style={{ ...inp, width: "100%", resize: "vertical", marginBottom: 8 }} />
          <button onClick={summarizeText} disabled={busy || !pasteText.trim()} style={{ padding: "7px 13px", background: (busy || !pasteText.trim()) ? "#9ca3af" : NV, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: (busy || !pasteText.trim()) ? "default" : "pointer" }}>Summarize pasted text</button>
        </div>
      )}

      {err && <div style={{ color: "#dc2626", fontSize: 12.5, marginTop: 10 }}>{err}</div>}
      {out && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <button onClick={copy} style={{ fontSize: 12, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
          <textarea value={out} onChange={(e) => setOut(e.target.value)} rows={tool === "letter" ? 16 : 10} style={{ width: "100%", border: `1px solid ${LINE}`, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 1.5, fontFamily: tool === "letter" ? "Georgia, serif" : "inherit", resize: "vertical", background: "#fcfdff", whiteSpace: "pre-wrap" }} />
        </div>
      )}
    </div>
  );
}

/* ---------------- Tasks panel (matter detail) ---------------- */
function TasksPanel({ matter }) {
  const [items, setItems] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState(false);
  const [nLabel, setNLabel] = useState("");
  const [nDate, setNDate] = useState("");

  const load = async () => { setLoading(true); try { setItems(await listMatterTasks(matter.id)); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); (async () => { try { setMembers(await teamMembers()); } catch (e) { /* ignore */ } })(); /* eslint-disable-next-line */ }, [matter.id]);

  const nameOf = (uid) => { if (!uid) return "Unassigned"; const m = members.find((x) => x.user_id === uid); return m ? (m.name || m.email) : "—"; };
  const generate = async () => {
    setBusy(true); setMsg("");
    try { const r = await generateTasks(matter.firm_id, matter); await load(); setMsg(r.added ? `${r.added} task${r.added === 1 ? "" : "s"} added.` : "Nothing to add — set up a checklist in Checklists, or all items are already here."); }
    catch (e) { setMsg(e.message || String(e)); }
    setBusy(false);
  };
  const toggle = async (t) => { const done = !t.done; setItems((p) => p.map((x) => x.id === t.id ? { ...x, done } : x)); try { await updateMatterTask(t.id, { done, done_at: done ? new Date().toISOString() : null }); load(); } catch (e) { load(); } };
  const setAssignee = async (t, uid) => { setItems((p) => p.map((x) => x.id === t.id ? { ...x, assignee_user_id: uid || null } : x)); try { await updateMatterTask(t.id, { assignee_user_id: uid || null }); } catch (e) { load(); } };
  const editDate = async (t, v) => { setItems((p) => p.map((x) => x.id === t.id ? { ...x, due_date: v || null } : x)); try { await updateMatterTask(t.id, { due_date: v || null }); } catch (e) { load(); } };
  const addManual = async () => { if (!nLabel.trim()) return; setBusy(true); try { await createMatterTask(matter.firm_id, matter.id, { label: nLabel.trim(), due_date: nDate || null }); setNLabel(""); setNDate(""); setAdding(false); await load(); } catch (e) { setMsg(e.message || String(e)); } setBusy(false); };
  const remove = async (t) => { if (!window.confirm(`Delete "${t.label}"?`)) return; try { await deleteMatterTask(t.id); await load(); } catch (e) { setMsg(e.message || String(e)); } };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmt = (s) => { if (!s) return ""; try { return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return s; } };
  const overdue = (t) => t.due_date && !t.done && new Date(t.due_date + "T00:00:00") < today;
  const inp = { border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Tasks</div>
        <button onClick={generate} disabled={busy} style={{ padding: "7px 13px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: busy ? "default" : "pointer" }}>{busy ? "…" : "↻ Load checklist"}</button>
      </div>
      {msg && <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>{msg}</div>}
      {loading ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Loading…</div>
        : items.length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af", padding: "6px 0" }}>No tasks yet. Hit “Load checklist,” or add one below.</div>
          : <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderTop: "1px solid #eef1f6" }}>
                <input type="checkbox" checked={!!t.done} onChange={() => toggle(t)} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.done ? "#9ca3af" : NV, textDecoration: t.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: overdue(t) ? "#dc2626" : MUTED, fontWeight: overdue(t) ? 600 : 400 }}>{t.due_date ? fmt(t.due_date) + (overdue(t) ? " · overdue" : "") : "No date"} · {nameOf(t.assignee_user_id)}</div>
                </div>
                <select value={t.assignee_user_id || ""} onChange={(e) => setAssignee(t, e.target.value)} title="Assignee" style={{ ...inp, padding: "4px 6px", fontSize: 11.5, maxWidth: 108 }}>
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>)}
                </select>
                <input type="date" value={t.due_date || ""} onChange={(e) => editDate(t, e.target.value)} style={{ ...inp, padding: "4px 6px", fontSize: 11.5 }} />
                <button onClick={() => remove(t)} title="Delete" style={{ padding: "5px 8px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 11.5, cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>}
      {adding
        ? <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input value={nLabel} onChange={(e) => setNLabel(e.target.value)} placeholder="Task" style={{ ...inp, flex: 1, minWidth: 140 }} />
          <input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} style={inp} />
          <button onClick={addManual} disabled={busy || !nLabel.trim()} style={{ padding: "0 14px", background: (busy || !nLabel.trim()) ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: (busy || !nLabel.trim()) ? "default" : "pointer" }}>Add</button>
          <button onClick={() => { setAdding(false); setNLabel(""); setNDate(""); }} style={{ padding: "0 12px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
        </div>
        : <button onClick={() => setAdding(true)} style={{ marginTop: 12, fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>＋ Add task</button>}
    </div>
  );
}

/* ---------------- My tasks (across matters) ---------------- */
function MyTasks({ onOpen }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setTasks(await myOpenTasks()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = (d) => { try { return Math.round((new Date(d + "T00:00:00").getTime() - today.getTime()) / 86400000); } catch { return null; } };
  const complete = async (t) => { setTasks((p) => p.filter((x) => x.id !== t.id)); try { await updateMatterTask(t.id, { done: true, done_at: new Date().toISOString() }); } catch (e) { load(); } };
  const addr = (t) => (t.matter && (t.matter.property_address || t.matter.file_number)) || "a file";
  const fmt = (s) => { if (!s) return "No date"; try { return new Date(s + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }); } catch { return s; } };

  const groups = [
    { key: "overdue", label: "Overdue", tone: "#ef4444", items: tasks.filter((t) => t.due_date && days(t.due_date) < 0) },
    { key: "today", label: "Today", tone: "#f59e0b", items: tasks.filter((t) => t.due_date && days(t.due_date) === 0) },
    { key: "week", label: "This week", tone: "#f59e0b", items: tasks.filter((t) => t.due_date && days(t.due_date) >= 1 && days(t.due_date) <= 7) },
    { key: "later", label: "Later", tone: "#94a3b8", items: tasks.filter((t) => t.due_date && days(t.due_date) > 7) },
    { key: "nodate", label: "No date", tone: "#94a3b8", items: tasks.filter((t) => !t.due_date) }
  ].filter((g) => g.items.length > 0);

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>My tasks</div>
      <div style={{ color: MUTED, fontSize: 13.5, margin: "4px 0 18px" }}>Everything assigned to you across all your files.</div>
      {loading ? <div style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</div>
        : tasks.length === 0 ? <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "30px 18px", textAlign: "center", color: MUTED, fontSize: 13 }}>Nothing on your plate. Assign yourself tasks from any file.</div>
          : groups.map((g) => (
            <div key={g.key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 0 8px 2px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.tone }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: NV }}>{g.label}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{g.items.length}</span>
              </div>
              <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
                {g.items.map((t) => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 14px", borderTop: "1px solid #eef1f6" }}>
                    <input type="checkbox" onChange={() => complete(t)} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onOpen && t.matter_id && onOpen(t.matter_id)}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: NV, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</div>
                      <div style={{ fontSize: 12, color: MUTED, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmt(t.due_date)} · {addr(t)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
    </div>
  );
}

/* ---------------- Checklist setup (firm task templates) ---------------- */
function ChecklistSetup({ firmId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => { setLoading(true); try { setRows(await listTaskTemplates()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const addRow = async () => { setBusy(true); try { await createTaskTemplate(firmId, { label: "New task", matter_type: null, anchor: null, offset_days: 0, sort_order: rows.length }); await load(); } catch (e) { alert(e.message || String(e)); } setBusy(false); };
  const seed = async () => { setBusy(true); try { await seedDefaultTaskTemplates(firmId); await load(); } catch (e) { alert(e.message || String(e)); } setBusy(false); };
  const patch = async (id, p) => { setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...p } : r)); try { await updateTaskTemplate(id, p); } catch (e) { load(); } };
  const remove = async (r) => { if (!window.confirm(`Remove "${r.label}"?`)) return; try { await deleteTaskTemplate(r.id); await load(); } catch (e) { alert(e.message || String(e)); } };

  const inp = { border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Settings</div>
        <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Checklists</div>
        <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Your firm's reusable task checklist. Pick a matter type (or all), and an optional due-date offset from contract or closing. Hit “Load checklist” on any file to drop these in.</div>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 6 }}>
        {loading ? <div style={{ padding: 22, color: "#9ca3af", fontSize: 13 }}>Loading…</div>
          : rows.length === 0
            ? <div style={{ padding: "26px 18px", textAlign: "center" }}>
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>No checklist set up yet.</div>
              <button onClick={seed} disabled={busy} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", marginRight: 8 }}>Load starter checklist</button>
              <button onClick={addRow} disabled={busy} style={{ padding: "9px 16px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ Add one</button>
            </div>
            : <div>
              <div style={{ display: "flex", gap: 8, padding: "8px 12px", fontSize: 11, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <div style={{ flex: 1 }}>Task</div><div style={{ width: 120 }}>Matter type</div><div style={{ width: 130 }}>Due from</div><div style={{ width: 80 }}>Offset</div><div style={{ width: 28 }} />
              </div>
              {rows.map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 12px", borderTop: "1px solid #eef1f6" }}>
                  <input value={r.label} onChange={(e) => patch(r.id, { label: e.target.value })} style={{ ...inp, flex: 1 }} />
                  <select value={r.matter_type || ""} onChange={(e) => patch(r.id, { matter_type: e.target.value || null })} style={{ ...inp, width: 120 }}>
                    {TASK_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={r.anchor || ""} onChange={(e) => patch(r.id, { anchor: e.target.value || null })} style={{ ...inp, width: 130 }}>
                    {TASK_ANCHORS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input type="number" value={r.offset_days == null ? "" : r.offset_days} onChange={(e) => patch(r.id, { offset_days: e.target.value === "" ? null : parseInt(e.target.value, 10) })} disabled={!r.anchor} style={{ ...inp, width: 80, background: r.anchor ? "#fff" : "#f3f4f6" }} />
                  <button onClick={() => remove(r)} title="Remove" style={{ padding: "6px 9px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <div style={{ padding: "10px 12px" }}>
                <button onClick={addRow} disabled={busy} style={{ fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>＋ Add task</button>
              </div>
            </div>}
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginTop: 10 }}>“All types” applies to every file. A negative offset means before the date (e.g. Closing −7). Leave “Due from” as “No date” for tasks with no deadline.</div>
    </div>
  );
}

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
function QuotesCalculator({ firm, onEditFees }) {
  const states = Object.keys(STATE_RATES);
  const def = states.includes(firm && firm.default_state) ? firm.default_state : "NJ";
  const [state, setState] = useState(def);
  const [ptype, setPtype] = useState(STATE_RATES[def].types[0]);
  const [price, setPrice] = useState("");
  const [loan, setLoan] = useState("");
  const [prior, setPrior] = useState("");
  const [exemption, setExemption] = useState("none");
  const [propClass, setPropClass] = useState("");
  const [fees, setFees] = useState([]); // [{id,name,amount,include}] — editable per quote

  useEffect(() => {
    (async () => {
      try {
        const f = await listFeeLines();
        setFees(f.filter((x) => x.active !== false).map((x) => ({ id: x.id, name: x.name, amount: Number(x.amount) || 0, include: true })));
      } catch (e) { /* ignore */ }
    })();
  }, []);
  const setFee = (id, patch) => setFees((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));

  const onState = (s) => { setState(s); setPtype(STATE_RATES[s].types[0]); };
  const num = (s) => Number(String(s || "").replace(/[^\d.]/g, "")) || 0;
  const isNJ = state === "NJ";
  const isRefi = /refi|refinance|non-sale/i.test(ptype);

  const q = useMemo(() => quotePremium(state, ptype, { price: num(price), loan: num(loan), prior: num(prior) }), [state, ptype, price, loan, prior]);
  const rtf = useMemo(() => isNJ ? calcRTF(num(price), exemption) : null, [isNJ, price, exemption]);
  const gpf = useMemo(() => isNJ ? calcGPF(num(price), propClass) : null, [isNJ, price, propClass]);
  const transfer = ((rtf && rtf.amount) || 0) + ((gpf && gpf.amount) || 0);
  const feesTotal = fees.filter((f) => f.include).reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const total = (q.premium || 0) + (q.search || 0) + transfer + feesTotal;

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
          <div style={sectionLabel}>Firm fees</div>
          {fees.length === 0
            ? <div style={{ fontSize: 12, color: MUTED, padding: "7px 0", borderTop: "1px solid #eef1f6" }}>No fee lines yet. <span onClick={onEditFees} style={{ color: BL, fontWeight: 600, cursor: "pointer" }}>Set up your fees →</span></div>
            : fees.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid #eef1f6" }}>
                <input type="checkbox" checked={f.include} onChange={(e) => setFee(f.id, { include: e.target.checked })} style={{ width: 15, height: 15, cursor: "pointer", flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: f.include ? "#0f172a" : "#9ca3af" }}>{f.name}</span>
                <span style={{ fontSize: 13, color: MUTED }}>$</span>
                <input value={f.amount} onChange={(e) => setFee(f.id, { amount: Number(String(e.target.value).replace(/[^\d.]/g, "")) || 0 })} style={{ width: 84, textAlign: "right", border: `1px solid ${LINE}`, borderRadius: 7, padding: "5px 8px", fontSize: 12.5, fontFamily: "inherit", outline: "none" }} />
              </div>
            ))}
          {fees.length > 0 && <div style={{ textAlign: "right", marginTop: 6 }}><span onClick={onEditFees} style={{ fontSize: 11.5, color: BL, fontWeight: 600, cursor: "pointer" }}>Edit fee schedule →</span></div>}

          <Line label="Estimated total" amount={total} strong />
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 12 }}>Estimate only — figures use Lakeland's current filed rates. Recording fees and firm charges aren't included yet (coming in 3.3b).</div>
      </div>
    </div>
  );
}

/* ---------------- Quote fee setup (firm fee schedule) ---------------- */
function FeeSetup({ firmId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => { setLoading(true); try { setRows(await listFeeLines()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const addRow = async () => { setBusy(true); try { await createFeeLine(firmId, { name: "New fee", amount: 0, sort_order: rows.length }); await load(); } catch (e) { alert(e.message || String(e)); } setBusy(false); };
  const seed = async () => { setBusy(true); try { await seedDefaultFees(firmId); await load(); } catch (e) { alert(e.message || String(e)); } setBusy(false); };
  const patch = async (id, p) => { setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...p } : r)); try { await updateFeeLine(id, p); } catch (e) { load(); } };
  const remove = async (r) => { if (!window.confirm(`Remove "${r.name}"?`)) return; try { await deleteFeeLine(r.id); await load(); } catch (e) { alert(e.message || String(e)); } };

  const inp = { border: `1px solid ${LINE}`, borderRadius: 8, padding: "7px 9px", fontSize: 13, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Settings</div>
        <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Quote fees</div>
        <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Your firm's own charges. These load into every quote on top of Lakeland's premium and transfer tax, and stay editable per quote.</div>
      </div>
      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 6 }}>
        {loading ? <div style={{ padding: 22, color: "#9ca3af", fontSize: 13 }}>Loading…</div>
          : rows.length === 0
            ? <div style={{ padding: "26px 18px", textAlign: "center" }}>
              <div style={{ color: MUTED, fontSize: 13, marginBottom: 12 }}>No fees set up yet.</div>
              <button onClick={seed} disabled={busy} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", marginRight: 8 }}>Load starter set</button>
              <button onClick={addRow} disabled={busy} style={{ padding: "9px 16px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ Add one</button>
            </div>
            : <div>
              <div style={{ display: "flex", gap: 8, padding: "8px 12px", fontSize: 11, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <div style={{ flex: 1 }}>Fee</div><div style={{ width: 140 }}>Default amount</div><div style={{ width: 28 }} />
              </div>
              {rows.map((r) => (
                <div key={r.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 12px", borderTop: "1px solid #eef1f6" }}>
                  <input value={r.name} onChange={(e) => patch(r.id, { name: e.target.value })} style={{ ...inp, flex: 1 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 4, width: 140 }}>
                    <span style={{ color: MUTED, fontSize: 13 }}>$</span>
                    <input type="number" value={r.amount} onChange={(e) => patch(r.id, { amount: Number(e.target.value) || 0 })} style={{ ...inp, flex: 1, width: "100%" }} />
                  </div>
                  <button onClick={() => remove(r)} title="Remove" style={{ padding: "6px 9px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              ))}
              <div style={{ padding: "10px 12px" }}>
                <button onClick={addRow} disabled={busy} style={{ fontSize: 12.5, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>＋ Add fee</button>
              </div>
            </div>}
      </div>
    </div>
  );
}

/* ---------------- Parties (durable, feeds doc merge) ---------------- */
function PartiesPanel({ matter, onRefresh }) {
  const [buyer, setBuyer] = useState(matter.buyer_name || "");
  const [seller, setSeller] = useState(matter.seller_name || "");
  const [lender, setLender] = useState(matter.lender_name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setBuyer(matter.buyer_name || ""); setSeller(matter.seller_name || ""); setLender(matter.lender_name || "");
  }, [matter.id]);

  const dirty = buyer !== (matter.buyer_name || "") || seller !== (matter.seller_name || "") || lender !== (matter.lender_name || "");
  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await updateMatter(matter.id, { buyer_name: buyer.trim() || null, seller_name: seller.trim() || null, lender_name: lender.trim() || null });
      onRefresh && onRefresh(); setSaved(true); setTimeout(() => setSaved(false), 1800);
    } catch (e) { alert(e.message || String(e)); }
    setSaving(false);
  };

  const inp = { width: "100%", padding: "9px 11px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 4, display: "block" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 420 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Parties</div>
        <div style={{ fontSize: 11.5, color: MUTED }}>Fills your generated documents</div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <div><label style={lbl}>Buyer / borrower</label><input style={inp} value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Full name(s)" /></div>
        <div><label style={lbl}>Seller</label><input style={inp} value={seller} onChange={(e) => setSeller(e.target.value)} placeholder="Full name(s)" /></div>
        <div><label style={lbl}>Lender</label><input style={inp} value={lender} onChange={(e) => setLender(e.target.value)} placeholder="Lender name" /></div>
      </div>
      <div style={{ marginTop: 13, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={save} disabled={!dirty || saving} style={{ padding: "8px 15px", background: dirty ? BL : "#cbd5e1", color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: dirty ? "pointer" : "default" }}>{saving ? "Saving…" : "Save parties"}</button>
        {saved && <span style={{ fontSize: 12.5, color: "#16a34a", fontWeight: 600 }}>Saved ✓</span>}
      </div>
    </div>
  );
}

/* ---------------- Doc templates (Phase 3.2a authoring) ---------------- */
const STARTER_BODY = [
  "{{firm_name}}",
  "{{today}}",
  "",
  "RE: {{property_address}}, {{town}}, {{state}}",
  "File No.: {{file_number}}",
  "",
  "To Whom It May Concern:",
  "",
  "This letter concerns the above-referenced {{transaction_type}} between buyer {{buyer}} and seller {{seller}}, scheduled to close on {{closing_date}}. Title is being placed with {{title_company}}.",
  "",
  "Sincerely,",
  "",
  "{{firm_name}}"
].join("\n");

function DocTemplates({ firmId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const fileRef = useRef(null);

  const load = async () => { setLoading(true); try { setRows(await listDocTemplates()); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const newEditor = async () => {
    setBusy(true);
    try {
      const t = await createDocTemplate(firmId, { name: "Untitled template", source_type: "editor", body: STARTER_BODY, sort_order: rows.length });
      await load(); setEditing(t);
    } catch (e) { alert(e.message || String(e)); }
    setBusy(false);
  };
  const onUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) { alert("Please upload a Word .docx file."); return; }
    setBusy(true);
    try {
      const path = await uploadDocTemplateFile(firmId, file);
      await createDocTemplate(firmId, { name: file.name.replace(/\.docx$/i, ""), source_type: "docx", storage_path: path, sort_order: rows.length });
      await load();
    } catch (e) { alert(e.message || String(e)); }
    setBusy(false);
  };
  const rename = async (t, name) => { setRows((p) => p.map((r) => r.id === t.id ? { ...r, name } : r)); try { await updateDocTemplate(t.id, { name }); } catch (e) { load(); } };
  const remove = async (t) => { if (!window.confirm(`Delete "${t.name}"?`)) return; try { await deleteDocTemplate(t); await load(); } catch (e) { alert(e.message || String(e)); } };

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Settings</div>
        <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Doc templates</div>
        <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Your firm's own templates. Write one here with merge fields, or upload a Word file with the same fields. You'll generate filled documents from any matter (coming next).</div>
      </div>

      <div style={{ background: "#f8fafc", border: `1px solid ${LINE}`, borderRadius: 12, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Merge fields you can use</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {DOC_TOKENS.map((t) => (
            <code key={t} style={{ fontSize: 11.5, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 6, padding: "3px 7px", color: NV }}>{`{{${t}}}`}</code>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <button onClick={newEditor} disabled={busy} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ New editor template</button>
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} style={{ padding: "9px 16px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", color: NV }}>⤓ Upload .docx</button>
        <input ref={fileRef} type="file" accept=".docx" onChange={onUpload} style={{ display: "none" }} />
      </div>

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 6 }}>
        {loading ? <div style={{ padding: 22, color: "#9ca3af", fontSize: 13 }}>Loading…</div>
          : rows.length === 0
            ? <div style={{ padding: "26px 18px", textAlign: "center", color: MUTED, fontSize: 13 }}>No templates yet. Create one above.</div>
            : rows.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: "1px solid #eef1f6" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, background: t.source_type === "docx" ? "#eef2ff" : "#e8f3ff", color: t.source_type === "docx" ? "#4338ca" : "#0f6fd1", flexShrink: 0 }}>{t.source_type === "docx" ? "WORD" : "EDITOR"}</span>
                <input value={t.name} onChange={(e) => rename(t, e.target.value)} style={{ flex: 1, minWidth: 0, border: "1px solid transparent", borderRadius: 7, padding: "6px 8px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", outline: "none", color: NV }} onFocus={(e) => e.target.style.border = `1px solid ${LINE}`} onBlur={(e) => e.target.style.border = "1px solid transparent"} />
                {t.source_type === "editor" && <button onClick={() => setEditing(t)} style={{ padding: "6px 12px", background: "#f1f5f9", border: "none", borderRadius: 7, fontSize: 12.5, fontWeight: 600, color: NV, cursor: "pointer" }}>Edit</button>}
                <button onClick={() => remove(t)} title="Delete" style={{ padding: "6px 9px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>✕</button>
              </div>
            ))}
      </div>

      {editing && <TemplateEditorModal template={editing} onClose={() => setEditing(null)} onSaved={load} />}
    </div>
  );
}

function TemplateEditorModal({ template, onClose, onSaved }) {
  const [name, setName] = useState(template.name || "");
  const [body, setBody] = useState(template.body || "");
  const [saving, setSaving] = useState(false);
  const taRef = useRef(null);

  const insert = (tok) => {
    const el = taRef.current;
    const token = `{{${tok}}}`;
    if (!el) { setBody((b) => b + token); return; }
    const s = el.selectionStart || 0, e = el.selectionEnd || 0;
    const next = body.slice(0, s) + token + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); const pos = s + token.length; el.setSelectionRange(pos, pos); });
  };
  const save = async () => {
    setSaving(true);
    try { await updateDocTemplate(template.id, { name: name.trim() || "Untitled template", body }); onSaved && onSaved(); }
    catch (err) { alert(err.message || String(err)); setSaving(false); return; }
    setSaving(false); onClose();
  };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "92vh", overflow: "auto", boxShadow: "0 12px 40px rgba(16,24,40,.2)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" style={{ flex: 1, border: "none", outline: "none", fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 18, color: NV }} />
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, marginBottom: 7 }}>Insert a field at the cursor:</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {DOC_TOKENS.map((t) => (
              <button key={t} onClick={() => insert(t)} style={{ fontSize: 11.5, background: "#f1f5f9", border: `1px solid ${LINE}`, borderRadius: 6, padding: "4px 8px", color: NV, cursor: "pointer", fontFamily: "inherit" }}>{`{{${t}}}`}</button>
            ))}
          </div>
          <textarea ref={taRef} value={body} onChange={(e) => setBody(e.target.value)} rows={18} style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 10, padding: "12px 14px", fontSize: 13.5, lineHeight: 1.6, fontFamily: "ui-monospace, Menlo, Consolas, monospace", outline: "none", resize: "vertical" }} />
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>Blank lines become paragraph breaks. Any field left empty on a matter is simply blank in the document.</div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "flex-end", gap: 10, position: "sticky", bottom: 0, background: "#fff" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", color: NV }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ padding: "9px 18px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>{saving ? "Saving…" : "Save template"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Client portal links (Phase 4.0) ---------------- */
function ClientPortalPanel({ matter }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("Client");
  const [expires, setExpires] = useState("");
  const [allowUpload, setAllowUpload] = useState(false);
  const [allowMsg, setAllowMsg] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState(null); // { url } shown once after creation
  const [copied, setCopied] = useState(false);

  const load = async () => { setLoading(true); try { setLinks(await listClientLinks(matter.id)); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [matter.id]);

  const create = async () => {
    setBusy(true);
    try {
      const { token } = await createClientLink(matter.firm_id, matter.id, {
        label: label.trim() || "Client",
        allow_upload: allowUpload,
        allow_messaging: allowMsg,
        expires_at: expires ? new Date(expires + "T23:59:59").toISOString() : null
      });
      setFresh({ url: `${window.location.origin}/c/${token}` });
      setCopied(false);
      setLabel("Client"); setExpires(""); setAllowUpload(false); setAllowMsg(false); setCreating(false);
      await load();
    } catch (e) { alert(e.message || String(e)); }
    setBusy(false);
  };
  const revoke = async (l) => {
    if (!window.confirm("Revoke this client link? It stops working immediately.")) return;
    try { await revokeClientLink(l.id); await load(); } catch (e) { alert(e.message || String(e)); }
  };
  const copy = (url) => { try { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) { /* ignore */ } };

  const statusOf = (l) => l.revoked_at ? ["Revoked", "#9ca3af"] : (l.expires_at && new Date(l.expires_at) < new Date()) ? ["Expired", "#dc2626"] : ["Active", "#16a34a"];
  const fmt = (v) => { if (!v) return ""; const d = new Date(v); return isNaN(d.getTime()) ? "" : d.toLocaleDateString(); };

  const inp = { width: "100%", padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 3, display: "block" };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Client portal</div>
        {!creating && <button onClick={() => { setCreating(true); setFresh(null); }} style={{ padding: "7px 13px", background: BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>＋ Create link</button>}
      </div>

      {fresh && (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46", marginBottom: 6 }}>Link created — copy it now, it won't be shown again</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input readOnly value={fresh.url} onFocus={(e) => e.target.select()} style={{ ...inp, background: "#fff", fontSize: 12 }} />
            <button onClick={() => copy(fresh.url)} style={{ padding: "8px 13px", background: "#065f46", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{copied ? "Copied ✓" : "Copy"}</button>
          </div>
        </div>
      )}

      {creating && (
        <div style={{ background: "#f8fafc", border: `1px solid ${LINE}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><label style={lbl}>Label</label><input style={inp} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Buyer" /></div>
            <div><label style={lbl}>Expires (optional)</label><input type="date" style={inp} value={expires} onChange={(e) => setExpires(e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 7, cursor: "pointer", color: MUTED }}>
              <input type="checkbox" checked={allowUpload} onChange={(e) => setAllowUpload(e.target.checked)} /> Allow client uploads
            </label>
            <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 7, cursor: "pointer", color: MUTED }}>
              <input type="checkbox" checked={allowMsg} onChange={(e) => setAllowMsg(e.target.checked)} /> Allow messaging
            </label>
          </div>
          <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>Uploads &amp; messaging are stored on the link now; those features turn on in a later update.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={create} disabled={busy} style={{ padding: "8px 15px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: busy ? "default" : "pointer" }}>{busy ? "Creating…" : "Create link"}</button>
            <button onClick={() => setCreating(false)} style={{ padding: "8px 15px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", color: NV }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ fontSize: 13, color: "#9ca3af" }}>Loading…</div>
        : links.length === 0
          ? <div style={{ fontSize: 13, color: MUTED }}>No client links yet. Create one to share a secure, read-only closing portal with your client.</div>
          : links.map((l) => {
            const [st, col] = statusOf(l);
            return (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid #eef1f6" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: NV }}>{l.label || "Client"}</div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>Created {fmt(l.created_at)}{l.last_viewed_at ? ` · last viewed ${fmt(l.last_viewed_at)}` : " · not viewed yet"}{l.expires_at ? ` · expires ${fmt(l.expires_at)}` : ""}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: col, flexShrink: 0 }}>{st}</span>
                {!l.revoked_at && <button onClick={() => revoke(l)} style={{ padding: "5px 10px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>Revoke</button>}
              </div>
            );
          })}
    </div>
  );
}

/* ---------------- Client messages panel (firm side, Phase 4.1) ---------------- */
function ClientMessagesPanel({ matter }) {
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const m = await listClientMessages(matter.id);
      setMsgs(m);
      if (m.some((x) => x.sender === "client" && !x.read_by_firm)) {
        try { await markClientMessagesRead(matter.id); } catch (e) { /* ignore */ }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { setLoading(true); load(); /* eslint-disable-next-line */ }, [matter.id]);

  const send = async () => {
    const t = text.trim();
    if (!t) return;
    setSending(true); setErr("");
    try {
      await sendClientMessageAsFirm(matter.firm_id, matter.id, t);
      setText("");
      await load();
    } catch (e) { setErr(e.message || String(e)); }
    setSending(false);
  };
  const fmtTime = (s) => { try { return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

  return (
    <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginTop: 16, maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Client messages</div>
      </div>
      <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 12 }}>Visible to the client only on links where messaging is enabled.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
        {loading ? <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Loading…</div>
          : msgs.length === 0 ? <div style={{ fontSize: 12.5, color: "#9ca3af", padding: "6px 0" }}>No messages with the client yet.</div>
            : msgs.map((m, i) => {
              const firmMsg = m.sender === "firm";
              return (
                <div key={m.id || i} style={{ alignSelf: firmMsg ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                  <div style={{ background: firmMsg ? BL : "#f1f5f9", color: firmMsg ? "#fff" : NV, borderRadius: 14, padding: "8px 12px", fontSize: 13, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</div>
                  <div style={{ fontSize: 10.5, color: "#9aa7b8", marginTop: 3, textAlign: firmMsg ? "right" : "left" }}>{firmMsg ? "You" : "Client"} · {fmtTime(m.created_at)}</div>
                </div>
              );
            })}
      </div>
      {err && <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 6 }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} placeholder="Reply to the client…" style={{ flex: 1, boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 11px", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none" }} />
        <button onClick={send} disabled={sending || !text.trim()} style={{ padding: "0 16px", background: text.trim() ? BL : "#cbd5e1", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: text.trim() ? "pointer" : "default" }}>{sending ? "…" : "Send"}</button>
      </div>
    </div>
  );
}

/* ---------------- Generate document (Phase 3.2b) ---------------- */
function GenerateDocModal({ matter, firm, onClose, onSaved }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tplId, setTplId] = useState("");
  const [data, setData] = useState(() => buildMergeData(matter, firm));
  const [wantDocx, setWantDocx] = useState(true);
  const [wantPdf, setWantPdf] = useState(true);
  const [saveToFile, setSaveToFile] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const t = await listDocTemplates();
        setTemplates(t);
        if (t.length) setTplId(t[0].id);
      } catch (e) { setErr(e.message || String(e)); }
      setLoading(false);
    })();
  }, []);

  const tpl = templates.find((t) => t.id === tplId) || null;
  const setField = (k, v) => setData((p) => ({ ...p, [k]: v }));

  const run = async () => {
    setErr(""); setDone("");
    if (!tpl) { setErr("Pick a template first."); return; }
    if (!wantDocx && !wantPdf) { setErr("Choose at least one format."); return; }
    setBusy(true);
    try {
      const baseName = `${tpl.name}${matter.file_number ? " - " + matter.file_number : ""}`;
      const { files } = await generateDocs({
        template: tpl, data, baseName, wantDocx, wantPdf,
        fetchDocxBuffer: downloadDocTemplateFile
      });
      for (const f of files) downloadBlob(f.blob, f.name);
      if (saveToFile) {
        for (const f of files) {
          const fileObj = new File([f.blob], f.name, { type: f.type });
          await uploadDocument(matter.firm_id, matter, fileObj);
        }
        onSaved && onSaved();
      }
      setDone(saveToFile
        ? `Generated ${files.length} file${files.length > 1 ? "s" : ""} — downloaded and saved to this file.`
        : `Generated ${files.length} file${files.length > 1 ? "s" : ""} — downloaded.`);
    } catch (e) {
      setErr(e.message || String(e));
    }
    setBusy(false);
  };

  const fld = { width: "100%", padding: "8px 10px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const lbl = { fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 3, display: "block" };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 600, maxHeight: "92vh", overflow: "auto", boxShadow: "0 12px 40px rgba(16,24,40,.2)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#fff" }}>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 18 }}>Generate document</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 20 }}>
          {loading ? <div style={{ color: "#9ca3af", fontSize: 13 }}>Loading templates…</div>
            : templates.length === 0
              ? <div style={{ fontSize: 13, color: MUTED, padding: "10px 0" }}>No templates yet. Add one on the <b>Doc templates</b> page first.</div>
              : <>
                <label style={lbl}>Template</label>
                <select value={tplId} onChange={(e) => setTplId(e.target.value)} style={{ ...fld, marginBottom: 14 }}>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.source_type === "docx" ? " (Word)" : ""}</option>)}
                </select>

                <div style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>Fields for this document</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {DOC_TOKENS.map((k) => (
                    <div key={k}>
                      <label style={lbl}>{TOKEN_LABELS[k] || k}</label>
                      <input value={data[k] || ""} onChange={(e) => setField(k, e.target.value)} style={fld} />
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", padding: "12px 14px", background: "#f8fafc", border: `1px solid ${LINE}`, borderRadius: 10, marginBottom: 14 }}>
                  <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                    <input type="checkbox" checked={wantDocx} onChange={(e) => setWantDocx(e.target.checked)} /> Word
                  </label>
                  <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                    <input type="checkbox" checked={wantPdf} onChange={(e) => setWantPdf(e.target.checked)} /> PDF
                  </label>
                  <span style={{ width: 1, height: 18, background: LINE }} />
                  <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                    <input type="checkbox" checked={saveToFile} onChange={(e) => setSaveToFile(e.target.checked)} /> Save to this file{matter.lakeland_file_number ? " (shared with Lakeland)" : ""}
                  </label>
                </div>

                {err && <div style={{ fontSize: 12.5, color: "#b91c1c", marginBottom: 10 }}>{err}</div>}
                {done && <div style={{ fontSize: 12.5, color: "#16a34a", fontWeight: 600, marginBottom: 10 }}>{done} ✓</div>}
              </>}
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${LINE}`, display: "flex", justifyContent: "flex-end", gap: 10, position: "sticky", bottom: 0, background: "#fff" }}>
          <button onClick={onClose} style={{ padding: "9px 16px", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer", color: NV }}>Close</button>
          <button onClick={run} disabled={busy || loading || templates.length === 0} style={{ padding: "9px 18px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: busy ? "default" : "pointer" }}>{busy ? "Generating…" : "Generate"}</button>
        </div>
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

/* ---------------- Team & roles ---------------- */
const ROLE_OPTS = ["attorney", "paralegal", "admin"];
const roleStyle = { attorney: { bg: "#e8f3ff", c: "#0f6fd1" }, admin: { bg: "#f5f3ff", c: "#6d28d9" }, paralegal: { bg: "#f1f5f9", c: "#475569" } };

function Team({ firm, myRole, myEmail }) {
  const manager = myRole === "attorney" || myRole === "admin";
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("paralegal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setMembers(await teamMembers());
      if (manager) setInvites(await teamPendingInvites());
    } catch (e) { /* ignore */ }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const linkFor = (token) => `${window.location.origin}/accept?token=${encodeURIComponent(token)}`;
  const copy = (text, id) => { try { navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(""), 1600); } catch (e) { /* ignore */ } };

  const invite = async () => {
    setErr("");
    const e = email.trim();
    if (!e) { setErr("Enter an email."); return; }
    setBusy(true);
    try { await teamInvite(e, role); setEmail(""); setRole("paralegal"); await load(); }
    catch (ex) { setErr(ex.message || String(ex)); }
    setBusy(false);
  };
  const changeRole = async (m, r) => { try { await teamSetRole(m.user_id, r); await load(); } catch (e) { alert(e.message || String(e)); } };
  const remove = async (m) => { if (!window.confirm(`Remove ${m.email || m.name} from the team?`)) return; try { await teamRemove(m.user_id); await load(); } catch (e) { alert(e.message || String(e)); } };
  const revoke = async (inv) => { if (!window.confirm(`Revoke the invite to ${inv.email}?`)) return; try { await teamRevokeInvite(inv.id); await load(); } catch (e) { alert(e.message || String(e)); } };

  const Badge = ({ r }) => { const s = roleStyle[r] || roleStyle.paralegal; return <span style={{ ...tag(s.bg, s.c), textTransform: "capitalize" }}>{r}</span>; };

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Team</div>
      <div style={{ color: MUTED, fontSize: 13.5, margin: "4px 0 18px" }}>Everyone in your firm's workspace. {manager ? "Invite teammates and set what they can do." : "Ask an attorney or admin to manage members."}</div>

      {manager && (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: NV, marginBottom: 10 }}>Invite a teammate</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their work email" type="email" style={{ flex: "2 1 220px", padding: "9px 11px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13.5, background: "#f8fafc" }} />
            <select value={role} onChange={(e) => setRole(e.target.value)} style={{ flex: "1 1 130px", padding: "9px 11px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13.5, background: "#fff", textTransform: "capitalize" }}>
              {ROLE_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button onClick={invite} disabled={busy} style={{ padding: "9px 18px", background: busy ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: busy ? "default" : "pointer" }}>{busy ? "Working…" : "Send invite"}</button>
          </div>
          {err && <div style={{ color: "#dc2626", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
          <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>Creates an invite link. They sign in with that exact email to join your firm.</div>
        </div>
      )}

      <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden", marginBottom: manager ? 16 : 0 }}>
        <div style={{ padding: "13px 16px", borderBottom: `1px solid ${LINE}`, fontWeight: 700, fontSize: 14, color: NV }}>Members</div>
        {loading ? <div style={{ padding: 18, color: "#9ca3af", fontSize: 13 }}>Loading…</div>
          : members.length === 0 ? <div style={{ padding: 18, color: MUTED, fontSize: 13 }}>No members yet.</div>
            : members.map((m) => {
              const isMe = (m.email || "").toLowerCase() === (myEmail || "").toLowerCase();
              return (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid #eef1f6" }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: "#eef4fb", color: NV, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{((m.name || m.email || "?")[0] || "?").toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: NV }}>{m.name || m.email}{isMe && <span style={{ fontSize: 11, color: MUTED, fontWeight: 500 }}> · you</span>}</div>
                    {m.name && <div style={{ fontSize: 12, color: MUTED }}>{m.email}</div>}
                  </div>
                  {manager && !isMe
                    ? <select value={m.role} onChange={(e) => changeRole(m, e.target.value)} style={{ padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, background: "#fff", textTransform: "capitalize" }}>
                        {ROLE_OPTS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    : <Badge r={m.role} />}
                  {manager && !isMe && <button onClick={() => remove(m)} style={{ background: "none", border: "none", color: "#b91c1c", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>Remove</button>}
                </div>
              );
            })}
      </div>

      {manager && invites.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "13px 16px", borderBottom: `1px solid ${LINE}`, fontWeight: 700, fontSize: 14, color: NV }}>Pending invites</div>
          {invites.map((inv) => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: "1px solid #eef1f6", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: NV }}>{inv.email}</div>
                <div style={{ fontSize: 11.5, color: MUTED, textTransform: "capitalize" }}>{inv.role} · invited</div>
              </div>
              <button onClick={() => copy(linkFor(inv.token), inv.id)} style={{ padding: "6px 12px", background: "#fff", color: BL, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{copied === inv.id ? "Copied ✓" : "Copy link"}</button>
              <button onClick={() => revoke(inv)} style={{ background: "none", border: "none", color: "#b91c1c", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Revoke</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Notification bell ---------------- */
function NotificationBell({ items, readIds, onOpenItem, onMarkAll }) {
  const [open, setOpen] = useState(false);
  const isRead = (n) => readIds && readIds.has(n.id);
  const unread = items.filter((n) => !isRead(n)).length;
  const fmt = (s) => {
    try {
      const d = new Date(s), diff = (Date.now() - d.getTime()) / 1000;
      if (diff < 60) return "just now";
      if (diff < 3600) return Math.floor(diff / 60) + "m ago";
      if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch (e) { return ""; }
  };
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((s) => !s)} aria-label="Notifications" style={{ position: "relative", width: 38, height: 38, display: "grid", placeItems: "center", background: "none", border: `1px solid ${LINE}`, borderRadius: 9, cursor: "pointer", color: NV }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
        {unread > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, minWidth: 17, height: 17, borderRadius: 9, display: "grid", placeItems: "center", padding: "0 4px" }}>{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && <>
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
        <div style={{ position: "absolute", right: 0, top: 46, width: 340, maxWidth: "86vw", background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, boxShadow: "0 10px 30px rgba(16,32,56,.14)", zIndex: 41, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${LINE}` }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: NV }}>Notifications</span>
            {unread > 0 && <button onClick={onMarkAll} style={{ fontSize: 12, color: BL, fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Mark all read</button>}
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {items.length === 0
              ? <div style={{ padding: "26px 16px", textAlign: "center", color: MUTED, fontSize: 12.5 }}>You're all caught up.</div>
              : items.map((n) => (
                <div key={n.id} onClick={() => { onOpenItem(n); setOpen(false); }} style={{ display: "flex", gap: 10, padding: "11px 14px", borderTop: "1px solid #eef1f6", cursor: "pointer", background: isRead(n) ? "#fff" : "#f5faff" }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: isRead(n) ? "transparent" : BL, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: NV }}>{n.title || "Update"}</div>
                    {n.detail && <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{n.detail}</div>}
                    <div style={{ fontSize: 11, color: "#9aa7b8", marginTop: 2 }}>{fmt(n.created_at)}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </>}
    </div>
  );
}

/* ---------------- New matter modal ---------------- */
function NewMatterModal({ onClose, onCreate }) {
  const [provider, setProvider] = useState("lakeland");
  const [f, setF] = useState({ file_number: "", property_address: "", town: "", state: "NJ", transaction_type: "Purchase", title_company_name: "", buyer: "", seller: "", lender: "", contract_date: "", closing_date: "" });
  const [saving, setSaving] = useState(false);
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const [importing, setImporting] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [importedNote, setImportedNote] = useState("");
  const [wasImported, setWasImported] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef(null);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] || "");
    r.onerror = () => reject(new Error("Couldn't read the file."));
    r.readAsDataURL(file);
  });
  const applyExtract = (d) => {
    setWasImported(true);
    setF((p) => ({
      ...p,
      property_address: d.property_address || p.property_address,
      town: d.town || p.town,
      state: d.state && STATES.includes(d.state) ? d.state : p.state,
      transaction_type: d.transaction_type && TX_TYPES.includes(d.transaction_type) ? d.transaction_type : p.transaction_type,
      buyer: d.buyer || p.buyer,
      seller: d.seller || p.seller,
      lender: d.lender || p.lender,
      contract_date: d.contract_date || p.contract_date,
      closing_date: d.closing_date || p.closing_date
    }));
    const filled = ["buyer", "seller", "lender", "property_address", "town", "state", "transaction_type", "contract_date", "closing_date"].filter((k) => d[k]).length;
    setImportedNote(filled ? `Filled ${filled} field${filled > 1 ? "s" : ""} — review below before creating.` : "Nothing could be read from that — enter the fields manually.");
  };
  const onPdf = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) { setImportErr("Please choose a PDF, or use Paste text."); return; }
    setImporting(true); setImportErr(""); setImportedNote("");
    try { applyExtract(await extractContract({ pdf: await fileToBase64(file), filename: file.name })); }
    catch (err) { setImportErr(err.message || "Couldn't read that contract."); }
    setImporting(false);
  };
  const onPasteExtract = async () => {
    const t = pasteText.trim();
    if (!t) return;
    setImporting(true); setImportErr(""); setImportedNote("");
    try { applyExtract(await extractContract({ text: t })); setPasteMode(false); setPasteText(""); }
    catch (err) { setImportErr(err.message || "Couldn't read that text."); }
    setImporting(false);
  };

  const submit = async () => {
    setSaving(true);
    const seed = wasImported || !!(f.contract_date || f.closing_date);
    try {
      await onCreate({
        title_provider: provider,
        title_company_name: provider === "other" ? f.title_company_name.trim() : null,
        file_number: f.file_number.trim(),
        property_address: f.property_address.trim(),
        town: f.town.trim(),
        state: f.state,
        transaction_type: f.transaction_type,
        buyer_name: f.buyer.trim() || null,
        seller_name: f.seller.trim() || null,
        lender_name: f.lender.trim() || null,
        contract_date: f.contract_date || null,
        closing_date: f.closing_date || null,
        stage: 0
      }, seed);
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
          <div style={{ background: "#f0f7ff", border: "1px solid #cfe4fb", borderRadius: 12, padding: 14, marginBottom: 18 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>✶ Import from contract</div>
            <div style={{ fontSize: 11.5, color: MUTED, marginBottom: 10 }}>Upload the contract PDF or paste the order text — we'll fill the fields below for you to review.</div>
            <input ref={fileRef} type="file" accept=".pdf" onChange={onPdf} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => fileRef.current && fileRef.current.click()} disabled={importing} style={{ padding: "8px 14px", background: importing ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: importing ? "default" : "pointer" }}>{importing ? "Reading…" : "⬆ Upload PDF"}</button>
              <button onClick={() => { setPasteMode((v) => !v); setImportErr(""); }} disabled={importing} style={{ padding: "8px 14px", background: "#fff", color: NV, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{pasteMode ? "Cancel paste" : "Paste text"}</button>
            </div>
            {pasteMode && (
              <div style={{ marginTop: 10 }}>
                <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4} placeholder="Paste the order email or contract text here…" style={{ width: "100%", boxSizing: "border-box", border: `1px solid ${LINE}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
                <button onClick={onPasteExtract} disabled={importing || !pasteText.trim()} style={{ marginTop: 6, padding: "7px 14px", background: pasteText.trim() ? BL : "#cbd5e1", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: pasteText.trim() ? "pointer" : "default" }}>{importing ? "Reading…" : "Extract"}</button>
              </div>
            )}
            {importErr && <div style={{ fontSize: 11.5, color: "#b91c1c", marginTop: 8 }}>{importErr}</div>}
            {importedNote && <div style={{ fontSize: 11.5, color: "#065f46", fontWeight: 600, marginTop: 8 }}>{importedNote}</div>}
          </div>

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

          <div style={{ borderTop: `1px solid ${LINE}`, margin: "18px 0 4px", paddingTop: 14, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: MUTED, fontWeight: 700 }}>Parties &amp; dates (optional)</div>

          <label style={lbl}>Buyer / borrower</label>
          <input style={inp} value={f.buyer} onChange={(e) => u("buyer", e.target.value)} placeholder="Full name(s)" />

          <label style={lbl}>Seller</label>
          <input style={inp} value={f.seller} onChange={(e) => u("seller", e.target.value)} placeholder="Full name(s)" />

          <label style={lbl}>Lender</label>
          <input style={inp} value={f.lender} onChange={(e) => u("lender", e.target.value)} placeholder="Lender name" />

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Contract date</label>
              <input type="date" style={inp} value={f.contract_date} onChange={(e) => u("contract_date", e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Closing date</label>
              <input type="date" style={inp} value={f.closing_date} onChange={(e) => u("closing_date", e.target.value)} />
            </div>
          </div>

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
