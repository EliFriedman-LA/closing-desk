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
