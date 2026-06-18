// api/client-upload.js — Closing Desk client portal (Phase 4.2)
// Two-phase client upload, gated by the link's allow_upload flag:
//   POST { token, action:'sign',    filename, size, content_type }
//        -> { uploadUrl, path }   (client PUTs the file straight to storage)
//   POST { token, action:'confirm', path, filename, size, content_type }
//        -> { ok:true }           (records the file_documents row after a successful PUT)
// Files never pass through this function, so there's no request-size limit.

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;
const MAX_BYTES = 25 * 1024 * 1024;
const BUCKET = "file-docs";

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SECRET, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
function sha256hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}
function safeName(n) {
  return String(n || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120) || "file";
}

async function resolveLink(db, token) {
  const { data: link, error } = await db
    .from("client_links")
    .select("id, matter_id, firm_id, allow_upload, revoked_at, expires_at")
    .eq("token_hash", sha256hex(token))
    .maybeSingle();
  if (error) throw error;
  return link;
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!SUPABASE_URL || !SUPABASE_SECRET) { res.status(500).json({ error: "Server not configured" }); return; }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const token = String(body.token || "").trim();
    const action = String(body.action || "").trim();
    if (!token) { res.status(400).json({ error: "Missing token" }); return; }

    const db = admin();
    const link = await resolveLink(db, token);
    if (!link || link.revoked_at) { res.status(404).json({ error: "This link is no longer active." }); return; }
    if (link.expires_at && new Date(link.expires_at) < new Date()) { res.status(410).json({ error: "This link has expired." }); return; }
    if (!link.allow_upload) { res.status(403).json({ error: "Uploads aren't enabled for this link." }); return; }

    const prefix = `${link.firm_id}/${link.matter_id}/`;

    if (action === "sign") {
      const size = Number(body.size || 0);
      if (size > MAX_BYTES) { res.status(413).json({ error: "Files must be 25 MB or smaller." }); return; }
      const path = `${prefix}client-${crypto.randomUUID()}-${safeName(body.filename)}`;
      const { data: signed, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      const uploadUrl = signed.signedUrl.startsWith("http") ? signed.signedUrl : `${SUPABASE_URL}${signed.signedUrl}`;
      res.status(200).json({ uploadUrl, path });
      return;
    }

    if (action === "confirm") {
      const path = String(body.path || "");
      if (!path.startsWith(prefix)) { res.status(400).json({ error: "Invalid upload path." }); return; }
      const size = Number(body.size || 0);
      const { error } = await db.from("file_documents").insert({
        matter_id: link.matter_id,
        firm_id: link.firm_id,
        side: "firm",
        uploaded_by_client: true,
        client_visible: true,
        name: String(body.filename || "Document"),
        storage_path: path,
        size: size || null,
        content_type: body.content_type || null,
        file_number: null
      });
      if (error) throw error;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Server error" });
  }
}
