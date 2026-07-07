// Vercel Serverless Function — firm-manager team logins for Closing Desk.
// File location in the closing-desk repo: api/partner-team.js
//
// A firm ATTORNEY or ADMIN creates/reset User IDs + passwords for their own
// firm's teammates. Gated on the requester's access token; all writes run with
// the service key. Mirrors the landlord team endpoint, scoped by firm.
//
// POST { action, ... }  Authorization: Bearer <requester token>
//   create-user    { username, password?, display_name?, role? }
//   reset-password { user_id, password? }
//
// Env: SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SECRET_KEY

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SECRET_KEY   = process.env.SUPABASE_SECRET_KEY;

const svc = (extra) => ({ apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json", ...(extra || {}) });
const rest = (p) => `${SUPABASE_URL}/rest/v1/${p}`;
const enc = (v) => encodeURIComponent(v);
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const uslug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "");
const randomPass = () => "Cd" + Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 89);
const MANAGER_ROLES = ["attorney", "admin"];
const ROLE_OPTS = ["attorney", "paralegal", "admin"];

async function whoAmI(req) {
  const auth = req.headers.authorization || req.headers.Authorization || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}
async function myFirm(uid) {
  const r = await fetch(rest(`firm_users?user_id=eq.${uid}&select=firm_id,role&limit=1`), { headers: svc() });
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}
async function getCompanyCode(firmId) {
  const r = await fetch(rest(`firms?id=eq.${firmId}&select=company_code&limit=1`), { headers: svc() });
  const rows = r.ok ? await r.json() : [];
  return rows[0]?.company_code || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SUPABASE_URL || !SECRET_KEY || !ANON_KEY) return res.status(500).json({ ok: false, error: "Server not configured." });

  const me = await whoAmI(req);
  if (!me) return res.status(401).json({ ok: false, error: "Sign in required." });
  const mine = await myFirm(me.id);
  if (!mine) return res.status(403).json({ ok: false, error: "You're not linked to a firm." });
  if (!MANAGER_ROLES.includes(mine.role)) return res.status(403).json({ ok: false, error: "Only an attorney or admin can manage the team." });
  const firmId = mine.firm_id;

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  try {
    if (body.action === "create-user") {
      const username = String(body.username || "").trim();
      if (!username || !/^[a-zA-Z0-9._-]{2,40}$/.test(username)) return res.status(400).json({ ok: false, error: "User ID must be 2–40 letters, numbers, dot, dash or underscore." });
      const role = ROLE_OPTS.includes(body.role) ? body.role : "paralegal";
      const password = String(body.password || "").trim() || randomPass();
      const displayName = String(body.display_name || "").trim() || null;
      const code = await getCompanyCode(firmId);
      if (!code) return res.status(400).json({ ok: false, error: "Your firm has no Company ID yet." });
      const authEmail = `${slug(code)}.${uslug(username)}@team.closingdesk.app`;

      const cr = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST", headers: svc(),
        body: JSON.stringify({ email: authEmail, password, email_confirm: true, user_metadata: displayName ? { name: displayName } : {} }),
      });
      const created = await cr.json();
      if (!cr.ok || !created.id) {
        const msg = (created && (created.msg || created.error_description || created.error)) || "could not create user";
        if (/already/i.test(msg) || cr.status === 422) return res.status(409).json({ ok: false, error: "That User ID is already taken in your firm." });
        return res.status(500).json({ ok: false, error: msg });
      }

      const ins = await fetch(rest("firm_users"), {
        method: "POST", headers: svc({ Prefer: "return=minimal" }),
        body: JSON.stringify({ firm_id: firmId, user_id: created.id, role, username, auth_email: authEmail, must_change_password: true }),
      });
      if (!ins.ok) {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${created.id}`, { method: "DELETE", headers: svc() });
        return res.status(500).json({ ok: false, error: "member: " + (await ins.text()).substring(0, 200) });
      }
      return res.status(200).json({ ok: true, username, temp_password: password, company_code: code });
    }

    if (body.action === "reset-password") {
      const userId = String(body.user_id || "").trim();
      if (!userId) return res.status(400).json({ ok: false, error: "user_id required." });
      const mr = await fetch(rest(`firm_users?user_id=eq.${enc(userId)}&firm_id=eq.${firmId}&select=id,username&limit=1`), { headers: svc() });
      const mems = mr.ok ? await mr.json() : [];
      const member = mems[0];
      if (!member) return res.status(404).json({ ok: false, error: "Member not found in your firm." });
      const password = String(body.password || "").trim() || randomPass();
      const ur = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${enc(userId)}`, { method: "PUT", headers: svc(), body: JSON.stringify({ password }) });
      if (!ur.ok) return res.status(500).json({ ok: false, error: "reset: " + (await ur.text()).substring(0, 200) });
      await fetch(rest(`firm_users?user_id=eq.${enc(userId)}&firm_id=eq.${firmId}`), { method: "PATCH", headers: svc({ Prefer: "return=minimal" }), body: JSON.stringify({ must_change_password: true }) });
      return res.status(200).json({ ok: true, username: member.username, temp_password: password });
    }

    return res.status(400).json({ ok: false, error: "Unknown action." });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
