// api/client-doc.js — Closing Desk client portal (Phase 4.0b)
// Validates a client token and returns a short-lived signed download URL —
// only for documents on that matter that the firm marked client_visible.

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
    const docId = String(body.doc_id || "").trim();
    if (!token || !docId) { res.status(400).json({ error: "Missing token or document" }); return; }

    const db = admin();
    const { data: link, error } = await db
      .from("client_links")
      .select("id, matter_id, revoked_at, expires_at")
      .eq("token_hash", sha256hex(token))
      .maybeSingle();
    if (error) throw error;
    if (!link || link.revoked_at) { res.status(404).json({ error: "This link is no longer active." }); return; }
    if (link.expires_at && new Date(link.expires_at) < new Date()) { res.status(410).json({ error: "This link has expired." }); return; }

    const { data: doc, error: dErr } = await db
      .from("file_documents")
      .select("id, name, storage_path, matter_id, client_visible")
      .eq("id", docId)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!doc || doc.matter_id !== link.matter_id || !doc.client_visible) {
      res.status(404).json({ error: "Document not available." });
      return;
    }

    const { data: signed, error: sErr } = await db.storage.from("file-docs").createSignedUrl(doc.storage_path, 300);
    if (sErr) throw sErr;
    res.status(200).json({ url: signed.signedUrl, name: doc.name });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Server error" });
  }
}
