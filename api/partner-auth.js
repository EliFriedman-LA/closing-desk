// Vercel Serverless Function — credential login for Closing Desk.
// File location in the closing-desk repo: api/partner-auth.js
//
// Resolves Company ID + User ID -> the underlying Supabase auth email (server
// side, so the email is never exposed to the browser), then does a password
// grant and returns the session for the client to adopt.
//
// Env vars in the closing-desk Vercel project:
//   SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SECRET_KEY

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const SECRET_KEY   = process.env.SUPABASE_SECRET_KEY;

const svc = () => ({ apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json" });
const rest = (p) => `${SUPABASE_URL}/rest/v1/${p}`;
const enc = (v) => encodeURIComponent(v);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SUPABASE_URL || !SECRET_KEY || !ANON_KEY) return res.status(500).json({ ok: false, error: "Server not configured (missing Supabase env vars)." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};
  const company  = String(body.company_code || "").trim();
  const username = String(body.username || "").trim();
  const password = String(body.password || "");
  const GENERIC = "Invalid Company ID, User ID, or password.";
  if (!company || !username || !password) return res.status(400).json({ ok: false, error: "Enter your Company ID, User ID, and password." });

  try {
    // company_code -> firm
    const fr = await fetch(rest(`firms?company_code=ilike.${enc(company)}&select=id&limit=1`), { headers: svc() });
    const firms = fr.ok ? await fr.json() : [];
    const firm = Array.isArray(firms) && firms[0] ? firms[0] : null;
    if (!firm) return res.status(401).json({ ok: false, error: GENERIC });

    // (firm, username) -> auth_email
    const ur = await fetch(rest(`firm_users?firm_id=eq.${firm.id}&username=ilike.${enc(username)}&select=auth_email,must_change_password&limit=1`), { headers: svc() });
    const users = ur.ok ? await ur.json() : [];
    const user = Array.isArray(users) && users[0] ? users[0] : null;
    if (!user || !user.auth_email) return res.status(401).json({ ok: false, error: GENERIC });

    // password grant
    const tr = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.auth_email, password }),
    });
    const tok = await tr.json();
    if (!tr.ok || !tok.access_token) return res.status(401).json({ ok: false, error: GENERIC });

    return res.status(200).json({
      ok: true,
      access_token: tok.access_token,
      refresh_token: tok.refresh_token,
      must_change_password: !!user.must_change_password,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
