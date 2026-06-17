// api/client-portal.js — Closing Desk client portal (Phase 4.0)
// Validates a tokenized client link server-side using the Supabase SECRET key
// (bypasses RLS) and returns only the client-facing slice of one matter.
// The secret key never reaches the browser.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SECRET, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
function sha256hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!SUPABASE_URL || !SUPABASE_SECRET) { res.status(500).json({ error: "Server not configured" }); return; }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const token = String(body.token || "").trim();
    if (!token) { res.status(400).json({ error: "Missing token" }); return; }

    const db = admin();
    const { data: link, error } = await db
      .from("client_links")
      .select("*")
      .eq("token_hash", sha256hex(token))
      .maybeSingle();
    if (error) throw error;
    if (!link || link.revoked_at) { res.status(404).json({ error: "This link is no longer active." }); return; }
    if (link.expires_at && new Date(link.expires_at) < new Date()) { res.status(410).json({ error: "This link has expired." }); return; }

    // best-effort view stamp
    db.from("client_links").update({ last_viewed_at: new Date().toISOString() }).eq("id", link.id).then(() => {}, () => {});

    const [matterRes, firmRes, dlRes] = await Promise.all([
      db.from("matters")
        .select("property_address, town, state, transaction_type, stage, contract_date, closing_date, lakeland_file_number")
        .eq("id", link.matter_id).maybeSingle(),
      db.from("firms").select("name, brand_color").eq("id", link.firm_id).maybeSingle(),
      db.from("matter_deadlines").select("name, due_date, done")
        .eq("matter_id", link.matter_id)
        .order("due_date", { ascending: true, nullsFirst: false })
    ]);

    const matter = matterRes.data;
    if (!matter) { res.status(404).json({ error: "Matter not found." }); return; }
    const firm = firmRes.data || {};

    res.status(200).json({
      label: link.label || "Client",
      firm: { name: firm.name || "", brand_color: firm.brand_color || "#1B91FE" },
      matter: {
        property_address: matter.property_address || "",
        town: matter.town || "",
        state: matter.state || "",
        transaction_type: matter.transaction_type || "",
        stage: matter.stage || 0,
        contract_date: matter.contract_date || null,
        closing_date: matter.closing_date || null
      },
      deadlines: (dlRes.data || []).map((d) => ({ name: d.name, due_date: d.due_date, done: !!d.done })),
      settings: { allow_upload: !!link.allow_upload, allow_messaging: !!link.allow_messaging }
    });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Server error" });
  }
}
