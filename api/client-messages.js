// api/client-messages.js — Closing Desk client portal (Phase 4.1)
// Token-validated client <-> firm messaging thread for one matter.
// POST { token }            -> returns the thread
// POST { token, body }      -> posts a client message, returns the thread
// Requires the link to have allow_messaging = true.

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
    let text = String(body.body || "").trim();
    if (!token) { res.status(400).json({ error: "Missing token" }); return; }

    const db = admin();
    const { data: link, error } = await db
      .from("client_links")
      .select("id, matter_id, firm_id, allow_messaging, revoked_at, expires_at")
      .eq("token_hash", sha256hex(token))
      .maybeSingle();
    if (error) throw error;
    if (!link || link.revoked_at) { res.status(404).json({ error: "This link is no longer active." }); return; }
    if (link.expires_at && new Date(link.expires_at) < new Date()) { res.status(410).json({ error: "This link has expired." }); return; }
    if (!link.allow_messaging) { res.status(403).json({ error: "Messaging isn't enabled for this link." }); return; }

    if (text) {
      if (text.length > 4000) text = text.slice(0, 4000);
      const { error: iErr } = await db.from("client_messages").insert({
        matter_id: link.matter_id, firm_id: link.firm_id, sender: "client", body: text, read_by_firm: false
      });
      if (iErr) throw iErr;
    }

    const { data: msgs, error: mErr } = await db
      .from("client_messages")
      .select("sender, body, created_at")
      .eq("matter_id", link.matter_id)
      .order("created_at", { ascending: true });
    if (mErr) throw mErr;

    res.status(200).json({ messages: msgs || [] });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Server error" });
  }
}
