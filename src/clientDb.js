// clientDb.js — Closing Desk client portal data access (Phase 4.0)
// Talks only to the tokenized serverless endpoints; never touches Supabase directly.

async function post(path, body) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  let j = {};
  try { j = await r.json(); } catch (e) { /* non-JSON */ }
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export function getClientPortal(token) {
  return post("/api/client-portal", { token });
}

export function getClientDocUrl(token, docId) {
  return post("/api/client-doc", { token, doc_id: docId });
}

export function getClientMessages(token) {
  return post("/api/client-messages", { token });
}
export function sendClientMessage(token, body) {
  return post("/api/client-messages", { token, body });
}

// Three steps: get a signed URL, PUT the file straight to storage, then record it.
export async function uploadClientFile(token, file) {
  const ct = file.type || "application/octet-stream";
  const sign = await post("/api/client-upload", { token, action: "sign", filename: file.name, size: file.size, content_type: ct });
  const put = await fetch(sign.uploadUrl, { method: "PUT", headers: { "content-type": ct, "x-upsert": "true" }, body: file });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return post("/api/client-upload", { token, action: "confirm", path: sign.path, filename: file.name, size: file.size, content_type: ct });
}
