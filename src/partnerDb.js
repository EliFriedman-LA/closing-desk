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

/* ---------------- Deadlines (Phase 3.1) ---------------- */
export const DEADLINE_ANCHORS = [["contract", "Contract date"], ["closing", "Closing date"]];

export async function listDeadlineTemplates() {
  const { data, error } = await supabase.from("firm_deadline_templates")
    .select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function createDeadlineTemplate(firmId, payload) {
  const { data, error } = await supabase.from("firm_deadline_templates")
    .insert({ firm_id: firmId, ...payload }).select().single();
  if (error) throw error;
  return data;
}
export async function updateDeadlineTemplate(id, patch) {
  const { data, error } = await supabase.from("firm_deadline_templates")
    .update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteDeadlineTemplate(id) {
  const { error } = await supabase.from("firm_deadline_templates").delete().eq("id", id);
  if (error) throw error;
}
const DEFAULT_DEADLINES = [
  { name: "Attorney review ends", anchor: "contract", offset_days: 3 },
  { name: "Inspection due",       anchor: "contract", offset_days: 10 },
  { name: "Mortgage commitment",  anchor: "contract", offset_days: 30 },
  { name: "Clear to close",       anchor: "closing",  offset_days: -3 },
  { name: "Final walkthrough",    anchor: "closing",  offset_days: -1 },
  { name: "Closing day",          anchor: "closing",  offset_days: 0 },
];
export async function seedDefaultTemplates(firmId) {
  const rows = DEFAULT_DEADLINES.map((d, i) => ({ firm_id: firmId, ...d, sort_order: i }));
  const { data, error } = await supabase.from("firm_deadline_templates").insert(rows).select();
  if (error) throw error;
  return data || [];
}

export async function listMatterDeadlines(matterId) {
  const { data, error } = await supabase.from("matter_deadlines")
    .select("*").eq("matter_id", matterId)
    .order("due_date", { ascending: true, nullsFirst: false }).order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function createMatterDeadline(firmId, matterId, payload) {
  const { data, error } = await supabase.from("matter_deadlines")
    .insert({ firm_id: firmId, matter_id: matterId, source: "manual", ...payload }).select().single();
  if (error) throw error;
  return data;
}
export async function updateMatterDeadline(id, patch) {
  const { data, error } = await supabase.from("matter_deadlines")
    .update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteMatterDeadline(id) {
  const { error } = await supabase.from("matter_deadlines").delete().eq("id", id);
  if (error) throw error;
}

function addDays(dateStr, days) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + (days || 0));
  return d.toISOString().slice(0, 10);
}
// Generate/refresh template deadlines for a matter from the firm's template.
// Refreshes due dates on existing template rows, inserts new ones, skips
// templates whose anchor date isn't set. Manual deadlines are untouched.
export async function generateDeadlines(firmId, matter) {
  const templates = await listDeadlineTemplates();
  const existing = await listMatterDeadlines(matter.id);
  const byTemplate = {};
  existing.forEach((d) => { if (d.template_id) byTemplate[d.template_id] = d; });
  let added = 0, updated = 0, skipped = 0;
  for (const t of templates) {
    if (t.active === false) continue;
    const anchorDate = t.anchor === "closing" ? matter.closing_date : matter.contract_date;
    const due = addDays(anchorDate, t.offset_days);
    if (!due) { skipped++; continue; }
    const ex = byTemplate[t.id];
    if (ex) {
      if (ex.due_date !== due || ex.name !== t.name) { await updateMatterDeadline(ex.id, { due_date: due, name: t.name }); updated++; }
    } else {
      await createMatterDeadline(firmId, matter.id, { name: t.name, due_date: due, source: "template", template_id: t.id, sort_order: t.sort_order });
      added++;
    }
  }
  return { added, updated, skipped };
}

// All of the firm's deadlines across every matter, with matter context (for the calendar).
export async function listFirmDeadlines() {
  const { data, error } = await supabase.from("matter_deadlines")
    .select("*, matter:matters(id,file_number,property_address,town)")
    .order("due_date", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ---------------- Quote fee lines (Phase 3.3b) ---------------- */
export async function listFeeLines() {
  const { data, error } = await supabase.from("firm_fee_lines")
    .select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function createFeeLine(firmId, payload) {
  const { data, error } = await supabase.from("firm_fee_lines").insert({ firm_id: firmId, ...payload }).select().single();
  if (error) throw error;
  return data;
}
export async function updateFeeLine(id, patch) {
  const { data, error } = await supabase.from("firm_fee_lines").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteFeeLine(id) {
  const { error } = await supabase.from("firm_fee_lines").delete().eq("id", id);
  if (error) throw error;
}
const DEFAULT_FEES = [
  { name: "Settlement / closing fee", amount: 750 },
  { name: "Title search", amount: 250 },
  { name: "Recording service fee", amount: 75 },
  { name: "Wire / courier", amount: 50 },
];
export async function seedDefaultFees(firmId) {
  const rows = DEFAULT_FEES.map((d, i) => ({ firm_id: firmId, ...d, sort_order: i }));
  const { data, error } = await supabase.from("firm_fee_lines").insert(rows).select();
  if (error) throw error;
  return data || [];
}

/* ---------------- Doc templates (Phase 3.2) ---------------- */
export async function listDocTemplates() {
  const { data, error } = await supabase.from("firm_doc_templates")
    .select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function createDocTemplate(firmId, payload) {
  const { data, error } = await supabase.from("firm_doc_templates")
    .insert({ firm_id: firmId, ...payload }).select().single();
  if (error) throw error;
  return data;
}
export async function updateDocTemplate(id, patch) {
  const { data, error } = await supabase.from("firm_doc_templates")
    .update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteDocTemplate(tpl) {
  if (tpl.storage_path) {
    try { await supabase.storage.from("doc-templates").remove([tpl.storage_path]); } catch (e) { /* ignore */ }
  }
  const { error } = await supabase.from("firm_doc_templates").delete().eq("id", tpl.id);
  if (error) throw error;
}
// Upload a .docx template to the firm-scoped doc-templates bucket; returns the storage path.
export async function uploadDocTemplateFile(firmId, file) {
  const safe = (file.name || "template.docx").replace(/[^\w.\-]+/g, "_");
  const path = `${firmId}/${crypto.randomUUID()}-${safe}`;
  const up = await supabase.storage.from("doc-templates").upload(path, file, {
    contentType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    upsert: false
  });
  if (up.error) throw up.error;
  return path;
}
// Download a stored .docx template as an ArrayBuffer (used by the generator in 3.2b).
export async function downloadDocTemplateFile(path) {
  const { data, error } = await supabase.storage.from("doc-templates").download(path);
  if (error) throw error;
  return await data.arrayBuffer();
}

/* ---------------- Client portal links (Phase 4.0) ---------------- */
async function sha256hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomToken() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Returns { link, token }. The plaintext token is only available here at creation —
// we store just its hash, so the full link must be copied now.
export async function createClientLink(firmId, matterId, opts = {}) {
  const token = randomToken();
  const token_hash = await sha256hex(token);
  const { data, error } = await supabase.from("client_links").insert({
    firm_id: firmId,
    matter_id: matterId,
    token_hash,
    label: opts.label || "Client",
    allow_upload: !!opts.allow_upload,
    allow_messaging: !!opts.allow_messaging,
    expires_at: opts.expires_at || null
  }).select().single();
  if (error) throw error;
  return { link: data, token };
}
export async function listClientLinks(matterId) {
  const { data, error } = await supabase.from("client_links")
    .select("*").eq("matter_id", matterId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function revokeClientLink(id) {
  const { error } = await supabase.from("client_links")
    .update({ revoked_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

// Toggle whether a document is visible in the client portal (Phase 4.0b).
export async function setDocumentClientVisible(id, visible) {
  const { error } = await supabase.from("file_documents")
    .update({ client_visible: !!visible }).eq("id", id);
  if (error) throw error;
}

/* ---------------- Client messages (Phase 4.1) ---------------- */
export async function listClientMessages(matterId) {
  const { data, error } = await supabase.from("client_messages")
    .select("*").eq("matter_id", matterId).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function sendClientMessageAsFirm(firmId, matterId, body) {
  const { data, error } = await supabase.from("client_messages")
    .insert({ firm_id: firmId, matter_id: matterId, sender: "firm", body, read_by_firm: true })
    .select().single();
  if (error) throw error;
  return data;
}
export async function markClientMessagesRead(matterId) {
  const { error } = await supabase.from("client_messages")
    .update({ read_by_firm: true })
    .eq("matter_id", matterId).eq("sender", "client").eq("read_by_firm", false);
  if (error) throw error;
}

/* ---------------- AI endpoints ---------------- */
// These run on our Anthropic key, so the server now requires a signed-in
// session. One helper attaches the token so every call site can't drift.
async function postAiJson(url, payload, failMsg) {
  const token = await _accessToken();
  if (!token) throw new Error("Your session has expired — sign in again.");
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload)
  });
  let j = {};
  try { j = await r.json(); } catch (e) { /* non-JSON */ }
  if (!r.ok || !j.ok) throw new Error(j.error || `${failMsg} (${r.status})`);
  return j;
}

/* ---------------- Contract import (Phase 5.1) ---------------- */
// POST a contract PDF (base64) or pasted text to the extractor; returns the matter fields.
export async function extractContract(payload) {
  const j = await postAiJson("/api/extract-contract", payload, "Extraction failed");
  return j.data;
}

// Reads a .docx template's merge fields. Called from the workspace UI.
export async function extractTemplateFields(payload) {
  const j = await postAiJson("/api/extract-template-fields", payload, "Could not read that template");
  return j;
}

/* ---------------- Email Assistant questionnaire ---------------- */
export async function getEmailAssistantProfile() {
  const { data, error } = await supabase
    .from("email_assistant_profiles")
    .select("answers, generated_prompt")
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return data || null;
}
export async function saveEmailAssistantProfile(firmId, answers, generatedPrompt) {
  let uid = null;
  try { const { data } = await supabase.auth.getUser(); uid = data && data.user && data.user.id; } catch (e) { /* ignore */ }
  const row = { firm_id: firmId, answers, generated_prompt: generatedPrompt || null, updated_at: new Date().toISOString() };
  if (uid) row.user_id = uid;
  const { error } = await supabase.from("email_assistant_profiles").upsert(row, { onConflict: "user_id" });
  if (error) throw error;
}

/* ---------------- Notifications (in-app, per-user read state) ---------------- */
export async function listNotifications(limit = 30) {
  const { data, error } = await supabase.from("notifications")
    .select("*").order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}
export async function myReadNotificationIds() {
  const { data, error } = await supabase.from("notification_reads").select("notification_id");
  if (error) return new Set();
  return new Set((data || []).map((r) => r.notification_id));
}
async function _currentUid() {
  try { const { data } = await supabase.auth.getUser(); return (data && data.user && data.user.id) || null; } catch (e) { return null; }
}
export async function markNotificationRead(id) {
  const u = await _currentUid(); if (!u) return;
  await supabase.from("notification_reads").upsert({ notification_id: id, user_id: u }, { onConflict: "notification_id,user_id", ignoreDuplicates: true });
}
export async function markNotificationsRead(ids) {
  if (!ids || !ids.length) return;
  const u = await _currentUid(); if (!u) return;
  await supabase.from("notification_reads").upsert(ids.map((id) => ({ notification_id: id, user_id: u })), { onConflict: "notification_id,user_id", ignoreDuplicates: true });
}

/* ---------------- Team & roles (Phase T1) ---------------- */
export async function teamMembers() {
  const { data, error } = await supabase.rpc("team_members");
  if (error) throw error;
  return data || [];
}
export async function teamPendingInvites() {
  const { data, error } = await supabase.rpc("team_pending_invites");
  if (error) throw error;
  return data || [];
}
export async function teamInvite(email, role) {
  const { data, error } = await supabase.rpc("team_invite", { p_email: email, p_role: role });
  if (error) throw error;
  return (data && data[0]) || null;
}
export async function teamSetRole(userId, role) {
  const { error } = await supabase.rpc("team_set_role", { p_user_id: userId, p_role: role });
  if (error) throw error;
}
export async function teamRemove(userId) {
  const { error } = await supabase.rpc("team_remove", { p_user_id: userId });
  if (error) throw error;
}
export async function teamRevokeInvite(id) {
  const { error } = await supabase.rpc("team_revoke_invite", { p_invite_id: id });
  if (error) throw error;
}


/* ---------------- Open deadlines (for dashboard risk panel) ---------------- */
export async function listOpenDeadlines() {
  const { data, error } = await supabase.from("matter_deadlines")
    .select("id, matter_id, name, due_date, done")
    .eq("done", false).order("due_date", { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ---------------- Tasks & checklists (Phase T2) ---------------- */
export const TASK_ANCHORS = [["", "No date"], ["contract", "Contract date"], ["closing", "Closing date"]];
export const TASK_TYPES = [["", "All types"], ["Purchase", "Purchase"], ["Sale", "Sale"], ["Refinance", "Refinance"], ["Commercial", "Commercial"], ["Other", "Other"]];

export async function listTaskTemplates() {
  const { data, error } = await supabase.from("firm_task_templates")
    .select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function createTaskTemplate(firmId, payload) {
  const { data, error } = await supabase.from("firm_task_templates").insert({ firm_id: firmId, ...payload }).select().single();
  if (error) throw error; return data;
}
export async function updateTaskTemplate(id, patch) {
  const { data, error } = await supabase.from("firm_task_templates").update(patch).eq("id", id).select().single();
  if (error) throw error; return data;
}
export async function deleteTaskTemplate(id) {
  const { error } = await supabase.from("firm_task_templates").delete().eq("id", id);
  if (error) throw error;
}
const DEFAULT_TASKS = [
  { matter_type: null, label: "Open file & conflict check", anchor: "contract", offset_days: 0 },
  { matter_type: null, label: "Order title", anchor: "contract", offset_days: 1 },
  { matter_type: null, label: "Send attorney-review letter", anchor: "contract", offset_days: 1 },
  { matter_type: "Purchase", label: "Order survey", anchor: "contract", offset_days: 5 },
  { matter_type: null, label: "Request payoff / HOA estoppel", anchor: "contract", offset_days: 7 },
  { matter_type: null, label: "Review title commitment", anchor: "closing", offset_days: -7 },
  { matter_type: null, label: "Schedule closing", anchor: "closing", offset_days: -3 },
  { matter_type: null, label: "Confirm wire & closing figures", anchor: "closing", offset_days: -2 }
];
export async function seedDefaultTaskTemplates(firmId) {
  const rows = DEFAULT_TASKS.map((d, i) => ({ firm_id: firmId, ...d, sort_order: i }));
  const { data, error } = await supabase.from("firm_task_templates").insert(rows).select();
  if (error) throw error; return data || [];
}

export async function listMatterTasks(matterId) {
  const { data, error } = await supabase.from("matter_tasks")
    .select("*").eq("matter_id", matterId)
    .order("done", { ascending: true }).order("due_date", { ascending: true, nullsFirst: false }).order("sort_order", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function createMatterTask(firmId, matterId, payload) {
  const { data, error } = await supabase.from("matter_tasks")
    .insert({ firm_id: firmId, matter_id: matterId, source: "manual", ...payload }).select().single();
  if (error) throw error; return data;
}
export async function updateMatterTask(id, patch) {
  const { data, error } = await supabase.from("matter_tasks").update(patch).eq("id", id).select().single();
  if (error) throw error; return data;
}
export async function deleteMatterTask(id) {
  const { error } = await supabase.from("matter_tasks").delete().eq("id", id);
  if (error) throw error;
}
export async function generateTasks(firmId, matter) {
  const templates = await listTaskTemplates();
  const existing = await listMatterTasks(matter.id);
  const byTemplate = {}; existing.forEach((t) => { if (t.template_id) byTemplate[t.template_id] = t; });
  const mt = matter.transaction_type || null;
  let added = 0;
  for (const t of templates) {
    if (t.active === false) continue;
    if (t.matter_type && mt && t.matter_type !== mt) continue;
    if (byTemplate[t.id]) continue;
    let due = null;
    if (t.anchor) { const anchorDate = t.anchor === "closing" ? matter.closing_date : matter.contract_date; due = anchorDate ? addDays(anchorDate, t.offset_days) : null; }
    await createMatterTask(firmId, matter.id, { label: t.label, due_date: due, source: "template", template_id: t.id, sort_order: t.sort_order });
    added++;
  }
  return { added };
}
export async function myOpenTasks() {
  const u = await _currentUid(); if (!u) return [];
  const { data, error } = await supabase.from("matter_tasks")
    .select("*, matter:matters(property_address, file_number, town)")
    .eq("assignee_user_id", u).eq("done", false)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

/* ---------------- AI assist (Phase A1) ---------------- */
export async function aiAssist(payload) {
  const j = await postAiJson("/api/ai-assist", payload, "AI request failed");
  return j.result;
}

/* ---------------- Archive (Phase R1) ---------------- */
export async function setMatterArchived(id, archived) {
  const { data, error } = await supabase.from("matters")
    .update({ archived: !!archived, archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/* ---------------- Save quote to matter (Phase R1b) ---------------- */
export async function saveMatterQuote(id, quote) {
  const { data, error } = await supabase.from("matters").update({ saved_quote: quote }).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/* ---------------- Firm logo / branding (Phase R1b) ---------------- */
export async function uploadFirmLogo(firmId, file) {
  const ext = ((file.name || "").split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const path = `${firmId}/logo.${ext}`;
  const { error: upErr } = await supabase.storage.from("firm-logos").upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type || undefined });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from("firm-logos").getPublicUrl(path);
  const url = (pub && pub.publicUrl ? pub.publicUrl : "") + "?t=" + Date.now();
  const { error } = await supabase.rpc("set_firm_logo", { p_url: url });
  if (error) throw error;
  return url;
}
export async function removeFirmLogo() {
  const { error } = await supabase.rpc("set_firm_logo", { p_url: null });
  if (error) throw error;
}

/* ---------------- Team logins (credential-based, Chunk 2) ---------------- */
async function _accessToken() {
  const { data } = await supabase.auth.getSession();
  return data && data.session ? data.session.access_token : null;
}

// Firm manager creates a teammate's login. Returns { username, temp_password, company_code }.
export async function teamCreateLogin({ username, role, display_name, password }) {
  const token = await _accessToken();
  const r = await fetch("/api/partner-team", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "create-user", username, role, display_name, password }),
  });
  const d = await r.json().catch(() => ({ ok: false, error: "Request failed" }));
  if (!r.ok || !d.ok) throw new Error(d.error || "Could not create the login.");
  return d;
}

// Firm manager resets a teammate's password. Returns { username, temp_password }.
export async function teamResetPasswordLogin(userId, password) {
  const token = await _accessToken();
  const r = await fetch("/api/partner-team", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: "reset-password", user_id: userId, password }),
  });
  const d = await r.json().catch(() => ({ ok: false, error: "Request failed" }));
  if (!r.ok || !d.ok) throw new Error(d.error || "Could not reset the password.");
  return d;
}
