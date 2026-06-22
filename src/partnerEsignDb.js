import { supabase } from "./partnerClient.js";

// Built-in e-signature — firm-authenticated side. Creates a request + signers,
// lists/voids them. The public signing endpoint (api/esign-sign.js) records the
// actual signatures via the service-role key. RLS scopes all of this to the firm.

function genToken() {
  try {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    return (a + b).replace(/-/g, "");
  } catch (e) {
    return (Math.random().toString(36) + Math.random().toString(36) + Date.now().toString(36)).replace(/\./g, "");
  }
}

export async function listEsignRequests(matterId) {
  const { data, error } = await supabase
    .from("esign_requests")
    .select("*, signers:esign_signers(*)")
    .eq("matter_id", matterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({ ...r, signers: (r.signers || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) }));
}

export async function getEsignRequest(id) {
  const { data, error } = await supabase
    .from("esign_requests")
    .select("*, signers:esign_signers(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  data.signers = (data.signers || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  return data;
}

// signers: [{ name, email, role }]
export async function createEsignRequest(firmId, matterId, { title, doc_path, signers }) {
  const token = genToken();
  const { data: reqRow, error } = await supabase
    .from("esign_requests")
    .insert({ firm_id: firmId, matter_id: matterId, title: title || "Document", doc_path: doc_path || null, status: "sent", token })
    .select()
    .single();
  if (error) throw error;

  const rows = (signers || [])
    .filter((s) => (s.name || "").trim() || (s.email || "").trim())
    .map((s, i) => ({ request_id: reqRow.id, name: (s.name || "").trim() || null, email: (s.email || "").trim() || null, role: (s.role || "").trim() || null, sort_order: i }));
  if (rows.length) {
    const { error: e2 } = await supabase.from("esign_signers").insert(rows);
    if (e2) throw e2;
  }
  return { request: reqRow, token };
}

export async function voidEsignRequest(id) {
  const { data, error } = await supabase.from("esign_requests").update({ status: "void" }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEsignRequest(id) {
  const { error } = await supabase.from("esign_requests").delete().eq("id", id);
  if (error) throw error;
}
