// api/esign-sign.js — Closing Desk built-in e-signature (Pass 2)
// Public signing endpoint. Validates a request token server-side with the
// Supabase SECRET key (bypasses RLS) and records signatures. The secret key
// never reaches the browser. Mirrors api/client-portal.js.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET_KEY;

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SECRET, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!SUPABASE_URL || !SUPABASE_SECRET) { res.status(500).json({ error: "Server not configured" }); return; }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const token = String(body.token || "").trim();
    const action = String(body.action || "get");
    if (!token) { res.status(400).json({ error: "Missing token" }); return; }

    const db = admin();
    const { data: reqRow, error } = await db.from("esign_requests").select("*").eq("token", token).maybeSingle();
    if (error) throw error;
    if (!reqRow) { res.status(404).json({ error: "This signing link is not valid." }); return; }
    if (reqRow.status === "void") { res.status(410).json({ error: "This signing request was canceled." }); return; }

    const { data: signers } = await db.from("esign_signers").select("*").eq("request_id", reqRow.id).order("sort_order", { ascending: true });

    if (action === "get") {
      const { data: firm } = await db.from("firms").select("name, brand_color, logo_url").eq("id", reqRow.firm_id).maybeSingle();
      let docName = null;
      if (reqRow.doc_path) {
        const { data: doc } = await db.from("file_documents").select("name").eq("storage_path", reqRow.doc_path).maybeSingle();
        docName = doc ? doc.name : null;
      }
      res.status(200).json({
        title: reqRow.title || "Document",
        status: reqRow.status,
        firm: { name: (firm && firm.name) || "", brand_color: (firm && firm.brand_color) || "#1B91FE", logo_url: (firm && firm.logo_url) || "" },
        doc: { name: docName, hasFile: !!reqRow.doc_path },
        signers: (signers || []).map((s) => ({ id: s.id, name: s.name, role: s.role, status: s.status }))
      });
      return;
    }

    if (action === "doc") {
      if (!reqRow.doc_path) { res.status(404).json({ error: "No document attached." }); return; }
      const { data: signed, error: sErr } = await db.storage.from("file-docs").createSignedUrl(reqRow.doc_path, 300);
      if (sErr) throw sErr;
      res.status(200).json({ url: signed.signedUrl });
      return;
    }

    if (action === "sign") {
      const signerId = String(body.signer_id || "").trim();
      const sigType = body.signature_type === "typed" ? "typed" : "drawn";
      const sigData = String(body.signature_data || "");
      if (!sigData) { res.status(400).json({ error: "No signature provided." }); return; }
      const signer = (signers || []).find((s) => s.id === signerId);
      if (!signer) { res.status(400).json({ error: "Choose who you are first." }); return; }
      if (signer.status === "signed") { res.status(409).json({ error: "You have already signed." }); return; }

      const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || (req.socket && req.socket.remoteAddress) || null;
      const { error: upErr } = await db.from("esign_signers").update({
        status: "signed", signature_type: sigType, signature_data: sigData, signed_at: new Date().toISOString(), ip
      }).eq("id", signer.id);
      if (upErr) throw upErr;

      const { data: after } = await db.from("esign_signers").select("status").eq("request_id", reqRow.id);
      const allSigned = (after || []).length > 0 && after.every((s) => s.status === "signed");
      if (allSigned) {
        await db.from("esign_requests").update({ status: "signed", completed_at: new Date().toISOString() }).eq("id", reqRow.id);
      }
      res.status(200).json({ ok: true, allSigned });
      return;
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    res.status(500).json({ error: (e && e.message) || "Server error" });
  }
}
