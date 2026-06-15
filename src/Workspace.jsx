import React, { useEffect, useMemo, useState } from "react";
import {
  listMatters, createMatter, updateMatter, deleteMatter,
  TX_TYPES, STATES, STAGES
} from "./db.js";
import Contacts from "./Contacts.jsx";

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

  const load = async () => {
    setLoading(true);
    try { setMatters(await listMatters()); } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

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
          {navItem("contacts", "Contacts", "◍")}
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
            ? <MatterDetail matter={selected} onBack={() => setSelectedId(null)} onStage={onStage} onDelete={onDelete} />
            : page === "dashboard"
              ? <Dashboard firm={firm} org={org} accent={accent} initials={initials} openCount={openCount} lakelandCount={lakelandCount} total={matters.length} recent={matters.slice(0, 5)} onOpen={(id) => setSelectedId(id)} onNew={() => setShowNew(true)} />
              : page === "contacts"
                ? <Contacts firmId={firm.id} />
                : <MattersList loading={loading} matters={filtered} total={matters.length} onOpen={(id) => setSelectedId(id)} onNew={() => setShowNew(true)} query={query} />}
        </main>
      </div>

      {showNew && <NewMatterModal onClose={() => setShowNew(false)} onCreate={onCreate} />}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard({ firm, org, accent, initials, openCount, lakelandCount, total, recent, onOpen, onNew }) {
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
          : recent.map((m) => <MatterRow key={m.id} m={m} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

/* ---------------- Matters list ---------------- */
function MattersList({ loading, matters, total, onOpen, onNew, query }) {
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
            : matters.map((m) => <MatterRow key={m.id} m={m} onOpen={onOpen} />)}
      </div>
    </div>
  );
}

function MatterRow({ m, onOpen }) {
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
      {provTag}
      <span style={tag("#f8fafc", "#475569")}>{stageLabel}</span>
    </div>
  );
}

/* ---------------- Matter detail ---------------- */
function MatterDetail({ matter, onBack, onStage, onDelete }) {
  const conn = matter.title_provider === "lakeland";
  const stage = matter.stage || 0;
  const details = [
    ["File #", matter.file_number],
    ["Type", matter.transaction_type],
    ["State", matter.state],
    ["Town", matter.town],
    ["Title", conn ? "Lakeland Abstract" : (matter.title_company_name || "—")]
  ].filter((d) => d[1]);

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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Current stage</div>
            <div style={{ fontFamily: "Fraunces,serif", fontSize: 18, fontWeight: 600, color: NV }}>{STAGES[stage]}</div>
          </div>
          {conn
            ? <span style={tag("#e8f3ff", "#0f6fd1")}>◆ Lakeland file</span>
            : <span style={tag("#f1f5f9", "#64748b")}>Not connected</span>}
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
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ fontSize: 12, color: MUTED }}>{conn ? "Live Lakeland status connects in a later build — set it manually for now:" : "Update status:"}</span>
          <select value={stage} onChange={(e) => onStage(matter, parseInt(e.target.value, 10))} style={{ padding: "6px 9px", border: `1px solid ${LINE}`, borderRadius: 7, fontSize: 12.5 }}>
            {STAGES.map((s, i) => <option key={s} value={i}>{s}</option>)}
          </select>
        </div>
      </div>

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
