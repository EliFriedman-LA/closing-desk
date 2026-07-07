// Vercel Serverless Function — one-time backfill of Closing Desk credentials.
// File location in the closing-desk repo: api/partner-backfill.js
//
// Assigns every firm a Company ID (auto from firm name) and every firm_user a
// User ID (auto from their email local-part) + a temporary password. Only fills
// BLANKS — it never overwrites a firm or user that already has credentials, so
// it is safe to run more than once.
//
// GATED by a shared secret. Set BACKFILL_SECRET in the closing-desk Vercel
// project and pass it as the x-backfill-secret header.
//
//   Preview (no writes):  POST {}                    -> the full credential list
//   Commit (writes):      POST { "commit": true }    -> writes + returns the list
//
// Env vars: SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SECRET_KEY / BACKFILL_SECRET

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SECRET_KEY   = process.env.SUPABASE_SECRET_KEY;
const BACKFILL_SECRET = process.env.BACKFILL_SECRET;

const svc = (extra) => ({ apikey: SECRET_KEY, Authorization: `Bearer ${SECRET_KEY}`, "Content-Type": "application/json", ...(extra || {}) });
const rest = (p) => `${SUPABASE_URL}/rest/v1/${p}`;
const slug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const uslug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9._-]+/g, "");
const randomPass = () => "Cd" + Math.random().toString(36).slice(2, 8) + Math.floor(10 + Math.random() * 89);

function uniquify(base, taken) {
  let name = base || "user";
  let n = 1;
  while (taken.has(name)) { n += 1; name = `${base}${n}`; }
  taken.add(name);
  return name;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!SUPABASE_URL || !SECRET_KEY) return res.status(500).json({ ok: false, error: "Server not configured." });
  if (!BACKFILL_SECRET) return res.status(500).json({ ok: false, error: "BACKFILL_SECRET is not set." });
  const secret = req.headers["x-backfill-secret"] || "";
  if (secret !== BACKFILL_SECRET) return res.status(403).json({ ok: false, error: "Forbidden." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const commit = !!(body && body.commit);

  try {
    // ---- firms: assign company_code where blank ---------------------------
    const fr = await fetch(rest(`firms?select=id,name,company_code`), { headers: svc() });
    if (!fr.ok) return res.status(500).json({ ok: false, error: "firms: " + (await fr.text()).slice(0, 200) });
    const firms = await fr.json();

    const takenCodes = new Set(firms.map((f) => (f.company_code || "").toLowerCase()).filter(Boolean));
    const codeByFirm = {};
    for (const f of firms) {
      if (f.company_code) { codeByFirm[f.id] = f.company_code; continue; }
      const base = slug(f.name) || ("firm" + String(f.id).slice(0, 6));
      const code = uniquify(base, takenCodes);
      codeByFirm[f.id] = code;
      if (commit) {
        await fetch(rest(`firms?id=eq.${f.id}`), {
          method: "PATCH", headers: svc({ Prefer: "return=minimal" }),
          body: JSON.stringify({ company_code: code }),
        });
      }
    }

    // ---- firm_users: assign username + auth_email + temp password ---------
    const ur = await fetch(rest(`firm_users?select=id,firm_id,user_id,username,auth_email`), { headers: svc() });
    if (!ur.ok) return res.status(500).json({ ok: false, error: "firm_users: " + (await ur.text()).slice(0, 200) });
    const members = await ur.json();

    // seed per-firm taken usernames from anyone already assigned
    const takenByFirm = {};
    for (const m of members) {
      takenByFirm[m.firm_id] = takenByFirm[m.firm_id] || new Set();
      if (m.username) takenByFirm[m.firm_id].add(m.username.toLowerCase());
    }

    const results = [];
    for (const m of members) {
      if (m.username && m.auth_email) continue; // already has credentials — skip

      // fetch this user's email from the auth record
      const ar = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${m.user_id}`, { headers: svc() });
      const authUser = ar.ok ? await ar.json() : null;
      const email = authUser && authUser.email ? authUser.email : null;
      if (!email) { results.push({ firm_id: m.firm_id, user_id: m.user_id, error: "no auth email found" }); continue; }

      const local = uslug(email.split("@")[0]) || "user";
      takenByFirm[m.firm_id] = takenByFirm[m.firm_id] || new Set();
      const username = uniquify(local, takenByFirm[m.firm_id]);
      const tempPass = randomPass();

      if (commit) {
        // set password on the existing auth account
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${m.user_id}`, {
          method: "PUT", headers: svc(), body: JSON.stringify({ password: tempPass }),
        });
        // write the credential fields
        await fetch(rest(`firm_users?id=eq.${m.id}`), {
          method: "PATCH", headers: svc({ Prefer: "return=minimal" }),
          body: JSON.stringify({ username, auth_email: email, must_change_password: true }),
        });
      }

      results.push({
        firm_id: m.firm_id,
        company_id: codeByFirm[m.firm_id],
        email,
        user_id: username,
        temp_password: tempPass,
      });
    }

    return res.status(200).json({ ok: true, committed: commit, firms: firms.length, credentials: results });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
