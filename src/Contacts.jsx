import React, { useEffect, useMemo, useState } from "react";
import { listContacts, createContact, updateContact, deleteContact, CONTACT_ROLES } from "./db.js";

const NV = "#1e3a5f", BL = "#1B91FE", MUTED = "#64748b", LINE = "#e6eaf0";

export default function Contacts({ firmId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // contact object, or {} for new, or null

  const load = async () => {
    setLoading(true);
    try { setContacts(await listContacts()); } catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) =>
      [c.name, c.role, c.firm_name, c.email, c.phone].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [contacts, query]);

  const save = async (payload, id) => {
    if (id) await updateContact(id, payload);
    else await createContact(firmId, payload);
    setEditing(null);
    load();
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete ${c.name}? This can't be undone.`)) return;
    await deleteContact(c.id);
    setEditing(null);
    load();
  };

  const initials = (n) => (n || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: BL, fontWeight: 600 }}>Your relationships</div>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1 }}>Contacts</div>
          <div style={{ color: MUTED, fontSize: 13.5, marginTop: 4 }}>Clients, agents, lenders, counsel — your private book.</div>
        </div>
        <button onClick={() => setEditing({})} style={{ padding: "9px 16px", background: BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>＋ Add contact</button>
      </div>

      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, role, firm, email…" style={{ width: "100%", maxWidth: 380, padding: "9px 12px", border: `1px solid ${LINE}`, borderRadius: 9, background: "#fff", fontSize: 13.5, marginBottom: 16 }} />

      {loading
        ? <div style={{ color: "#9ca3af", fontSize: 13 }}>Loading…</div>
        : filtered.length === 0
          ? <div style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 14, padding: "30px 18px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>{query ? "No contacts match." : "No contacts yet — add your first with “Add contact.”"}</div>
          : <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12 }} className="cd-contacts-grid">
            {filtered.map((c) => (
              <div key={c.id} onClick={() => setEditing(c)} style={{ background: "#fff", border: `1px solid ${LINE}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 13, cursor: "pointer" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#eef2f8", color: NV, display: "grid", placeItems: "center", fontWeight: 600, flexShrink: 0 }}>{initials(c.name)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[c.role, c.firm_name].filter(Boolean).join(" · ") || c.email || c.phone || "—"}</div>
                </div>
              </div>
            ))}
          </div>}

      {editing && <ContactModal contact={editing} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />}
    </div>
  );
}

function ContactModal({ contact, onClose, onSave, onDelete }) {
  const isNew = !contact.id;
  const [f, setF] = useState({
    name: contact.name || "", role: contact.role || "", firm_name: contact.firm_name || "",
    email: contact.email || "", phone: contact.phone || "", notes: contact.notes || ""
  });
  const [saving, setSaving] = useState(false);
  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name.trim()) { alert("Name is required."); return; }
    setSaving(true);
    try {
      await onSave({
        name: f.name.trim(), role: f.role || null, firm_name: f.firm_name.trim() || null,
        email: f.email.trim() || null, phone: f.phone.trim() || null, notes: f.notes.trim() || null
      }, contact.id);
    } catch (e) {
      setSaving(false);
      alert("Couldn't save: " + (e.message || e));
    }
  };

  const inp = { width: "100%", padding: "10px 12px", border: `1px solid ${LINE}`, borderRadius: 9, fontSize: 13.5, fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 12, fontWeight: 600, color: "#475569", margin: "12px 0 5px" };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 60 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "90vh", overflow: "auto", boxShadow: "0 12px 40px rgba(16,24,40,.2)" }}>
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${LINE}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Fraunces,serif", fontWeight: 600, fontSize: 18 }}>{isNew ? "Add contact" : "Edit contact"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          <label style={lbl}>Name</label>
          <input style={inp} value={f.name} onChange={(e) => u("name", e.target.value)} placeholder="Full name" autoFocus />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Role</label>
              <select style={inp} value={f.role} onChange={(e) => u("role", e.target.value)}>
                <option value="">—</option>
                {CONTACT_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>Firm / company</label>
              <input style={inp} value={f.firm_name} onChange={(e) => u("firm_name", e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <label style={lbl}>Email</label>
          <input style={inp} value={f.email} onChange={(e) => u("email", e.target.value)} placeholder="name@example.com" />
          <label style={lbl}>Phone</label>
          <input style={inp} value={f.phone} onChange={(e) => u("phone", e.target.value)} placeholder="(555) 555-5555" />
          <label style={lbl}>Notes</label>
          <textarea style={{ ...inp, resize: "vertical", minHeight: 60 }} value={f.notes} onChange={(e) => u("notes", e.target.value)} placeholder="Anything worth remembering" />

          <div style={{ display: "flex", gap: 10, marginTop: 18, alignItems: "center" }}>
            <button onClick={submit} disabled={saving} style={{ flex: 1, padding: "11px", background: saving ? "#9ca3af" : BL, color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 14, cursor: saving ? "default" : "pointer" }}>{saving ? "Saving…" : isNew ? "Add contact" : "Save changes"}</button>
            {!isNew && <button onClick={() => onDelete(contact)} style={{ padding: "11px 14px", background: "#fff", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Delete</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
