// Vercel Serverless Function — accept a Closing Desk firm invite with a login.
// File location in the closing-desk repo: api/partner-accept.js
//
// The invited person chooses a User ID + password. We create their auth account
// (with the invited email), redeem the invite AS that user to link their firm
// (reusing the existing redeem_invite RPC — which validates the token, expiry,
// and email match), then store the User ID. Returns a session for the client.
//
// POST { token, email, username, password }
// Env: SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SECRET_KEY

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SECRET_KEY   = process.env.SUPABASE_SECRET_KEY;

const svc = (extra) => ({ apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json", ...(extra || {}) });
const rest = (p) => `${SUPABASE_URL}/rest/v1/${p}`;
const enc = (v) => encodeURIComponent(v);

async function setUsername(userId, base, email) {
  for (let i = 0; i < 6; i++) {
    const name = i === 0 ? base : `${base}${i + 1}`;
    const r = await fetch(rest(`firm_users?user_id=eq.${enc(userId)}`), {
      method: "PATCH", headers: svc({ Prefer: "return=minimal" }),
      body: JSON.stringify({ username: name, auth_email: email, must_change_password: false }),
    });
    if (r.ok) return name;
    const t = await r.text();
    if (!/duplicate|unique|conflict|constraint/i.test(t)) throw new Error("username: " + t.slice(0, 150));
  }
  throw new Error("Could not assign a User ID.");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SUPABASE_URL || !SECRET_KEY || !ANON_KEY) return res.status(500).json({ ok: false, error: "Server not configured." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const token    = String(body.token || "").trim();
  const email    = String(body.email || "").trim().toLowerCase();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  if (!token) return res.status(400).json({ ok: false, error: "Missing invitation token." });
  if (!email) return res.status(400).json({ ok: false, error: "Enter the email your invitation was sent to." });
  if (!username || !/^[a-zA-Z0-9._-]{2,40}$/.test(username)) return res.status(400).json({ ok: false, error: "User ID must be 2–40 letters, numbers, dot, dash or underscore." });
  if (password.length < 8) return res.status(400).json({ ok: false, error: "Password must be at least 8 characters." });

  let createdId = null;
  try {
    // 1) create the auth account with the invited email
    const cr = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST", headers: svc(),
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const created = await cr.json();
    if (!cr.ok || !created.id) {
      const msg = (created && (created.msg || created.error_description || created.error)) || "";
      if (/already/i.test(msg) || cr.status === 422) return res.status(409).json({ ok: false, error: "account_exists" });
      return res.status(500).json({ ok: false, error: msg || "Could not create your account." });
    }
    createdId = created.id;

    // 2) sign in to get a session (needed to redeem as this user)
    const tr = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const tok = await tr.json();
    if (!tr.ok || !tok.access_token) throw new Error("Could not establish a session.");

    // 3) redeem the invite AS this user (validates token + email match + links firm)
    const rr = await fetch(`${SUPABASE_URL}/rest/v1/rpc/redeem_invite`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${tok.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    });
    const rd = await rr.json().catch(() => null);
    const redeemed = rd && (Array.isArray(rd) ? rd[0] : rd);
    if (!rr.ok || !redeemed || !redeemed.ok) {
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${createdId}`, { method: "DELETE", headers: svc() });
      const code = (redeemed && redeemed.error) || "invalid_token";
      return res.status(400).json({ ok: false, error: code });
    }

    // 4) store the chosen User ID on the firm_users row redeem just created
    const finalUsername = await setUsername(createdId, username, email);

    return res.status(200).json({
      ok: true,
      username: finalUsername,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
    });
  } catch (err) {
    if (createdId) { try { await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${createdId}`, { method: "DELETE", headers: svc() }); } catch (e) { /* ignore */ } }
    return res.status(500).json({ ok: false, error: err.message });
  }
}
