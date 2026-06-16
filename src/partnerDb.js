import { supabase } from "./partnerClient.js";

// Shared option lists + the closing milestone stages.
export const TX_TYPES = ["Purchase", "Sale", "Refinance", "Commercial", "Other"];
export const STATES = ["NJ", "NY", "PA", "FL", "OH", "GA", "National"];
export const STAGES = ["Order", "Title search", "Commitment", "Clear to close", "Funded", "Recorded", "Policy"];

// All reads/writes are auto-scoped to the firm by RLS (firm_id = current_firm_id()).
export async function listMatters() {
  const { data, error } = await supabase
    .from("matters")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createMatter(firmId, payload) {
  const { data, error } = await supabase
    .from("matters")
    .insert({ firm_id: firmId, ...payload })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMatter(id, patch) {
  const { data, error } = await supabase
    .from("matters")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMatter(id) {
  const { error } = await supabase.from("matters").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Contacts (firm's own CRM) ---------------- */
export const CONTACT_ROLES = ["Buyer", "Seller", "Attorney", "Realtor", "Real Estate Broker", "Mortgage Broker", "Lender", "Title company", "Inspector", "Appraiser", "Other"];

export async function listContacts() {
  const { data, error } = await supabase.from("firm_contacts").select("*").order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function createContact(firmId, payload) {
  const { data, error } = await supabase.from("firm_contacts").insert({ firm_id: firmId, ...payload }).select().single();
  if (error) throw error;
  return data;
}
export async function updateContact(id, patch) {
  const { data, error } = await supabase.from("firm_contacts").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteContact(id) {
  const { error } = await supabase.from("firm_contacts").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- Firm (branding / onboarding) ---------------- */
export async function updateFirm(id, patch) {
  const { data, error } = await supabase.from("firms").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/* ---------------- Lakeland live connection (Phase 2) ---------------- */
export async function linkLakelandMatter(matterId, fileNumber, zip) {
  const { data, error } = await supabase.rpc("link_lakeland_matter", { p_matter_id: matterId, p_file_number: fileNumber, p_zip: zip });
  if (error) throw error;
  return data;
}
export async function getLakelandStatus(matterId) {
  const { data, error } = await supabase.rpc("lakeland_matter_status", { p_matter_id: matterId });
  if (error) throw error;
  return data;
}

/* ---------------- Title order requests (Phase 2.2) ---------------- */
export async function createOrderRequest(firmId, payload) {
  const { data, error } = await supabase.from("order_requests").insert({ firm_id: firmId, ...payload }).select().single();
  if (error) throw error;
  return data;
}
export async function getMatterRequest(matterId) {
  const { data, error } = await supabase
    .from("order_requests").select("*").eq("matter_id", matterId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
export async function cancelOrderRequest(id) {
  const { error } = await supabase.from("order_requests").update({ status: "canceled" }).eq("id", id);
  if (error) throw error;
}

/* ---------------- Document exchange (Phase 2.3) ---------------- */
export async function listDocuments(matterId) {
  const { data, error } = await supabase
    .from("file_documents").select("*").eq("matter_id", matterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function uploadDocument(firmId, matter, file) {
  const safe = (file.name || "file").replace(/[^\w.\-]+/g, "_");
  const path = `${firmId}/${matter.id}/${crypto.randomUUID()}-${safe}`;
  const up = await supabase.storage.from("file-docs").upload(path, file, {
    contentType: file.type || "application/octet-stream", upsert: false
  });
  if (up.error) throw up.error;
  const { data, error } = await supabase.from("file_documents").insert({
    matter_id: matter.id, firm_id: firmId, file_number: matter.lakeland_file_number || null,
    side: "firm", name: file.name, storage_path: path, size: file.size, content_type: file.type || null
  }).select().single();
  if (error) throw error;
  return data;
}
export async function documentUrl(path) {
  const { data, error } = await supabase.storage.from("file-docs").createSignedUrl(path, 120);
  if (error) throw error;
  return data.signedUrl;
}
export async function deleteDocument(doc) {
  await supabase.storage.from("file-docs").remove([doc.storage_path]);
  const { error } = await supabase.from("file_documents").delete().eq("id", doc.id);
  if (error) throw error;
}

/* ---------------- Per-file messaging (Phase 2.4) ---------------- */
export async function listMessages(matterId) {
  const { data, error } = await supabase
    .from("file_messages").select("*").eq("matter_id", matterId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function postMessage(firmId, matterId, body, senderName) {
  const { data, error } = await supabase.from("file_messages").insert({
    matter_id: matterId, firm_id: firmId, sender_type: "firm",
    sender_name: senderName || null, body
  }).select().single();
  if (error) throw error;
  return data;
}

export async function markRead(firmId, matterId) {
  const { error } = await supabase.from("file_message_reads")
    .upsert({ matter_id: matterId, firm_id: firmId, side: "firm", last_read_at: new Date().toISOString() }, { onConflict: "matter_id,side" });
  if (error) throw error;
}
export async function listUnreads() {
  const { data, error } = await supabase.rpc("firm_matter_unreads");
  if (error) throw error;
  const map = {};
  (data || []).forEach((r) => { map[r.matter_id] = r.unread; });
  return map;
}
