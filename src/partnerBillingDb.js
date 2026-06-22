import { supabase } from "./partnerClient.js";

// Billing — invoices, line items, and firm fee schedules.
// firm_id passed on insert; RLS scopes reads to the firm. Line items + settings
// are child/firm rows guarded by the same firm policy.

/* ---------------- Invoices ---------------- */
export async function listInvoices(matterId) {
  let q = supabase.from("invoices").select("*").order("created_at", { ascending: false });
  if (matterId) q = q.eq("matter_id", matterId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getInvoice(id) {
  const { data: inv, error } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: items, error: e2 } = await supabase
    .from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order", { ascending: true });
  if (e2) throw e2;
  return { ...inv, items: items || [] };
}

function totalsOf(items) {
  const subtotal = (items || []).reduce((s, it) => s + (Number(it.amount) || 0), 0);
  return { subtotal, total: subtotal };
}

export async function createInvoice(firmId, payload, items) {
  const t = totalsOf(items);
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({ firm_id: firmId, subtotal: t.subtotal, total: t.total, ...payload })
    .select()
    .single();
  if (error) throw error;
  await replaceLineItems(inv.id, items || []);
  return inv;
}

export async function updateInvoice(id, patch, items) {
  const extra = {};
  if (items) { const t = totalsOf(items); extra.subtotal = t.subtotal; extra.total = t.total; }
  const { data, error } = await supabase
    .from("invoices")
    .update({ ...patch, ...extra, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  if (items) await replaceLineItems(id, items);
  return data;
}

export async function replaceLineItems(invoiceId, items) {
  const { error: delErr } = await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
  if (delErr) throw delErr;
  const rows = (items || []).map((it, i) => ({
    invoice_id: invoiceId,
    description: it.description || "",
    qty: Number(it.qty) || 0,
    rate: Number(it.rate) || 0,
    amount: Number(it.amount) || 0,
    sort_order: i
  }));
  if (rows.length) {
    const { error } = await supabase.from("invoice_line_items").insert(rows);
    if (error) throw error;
  }
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

export async function setInvoiceStatus(id, status) {
  const patch = { status, updated_at: new Date().toISOString() };
  patch.paid_at = status === "paid" ? new Date().toISOString() : null;
  const { data, error } = await supabase.from("invoices").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/* ---------------- Fee schedules ---------------- */
export async function listInvoiceSettings() {
  const { data, error } = await supabase
    .from("invoice_settings").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function createInvoiceSetting(firmId, payload) {
  const { data, error } = await supabase
    .from("invoice_settings").insert({ firm_id: firmId, ...payload }).select().single();
  if (error) throw error;
  return data;
}
export async function updateInvoiceSetting(id, patch) {
  const { data, error } = await supabase
    .from("invoice_settings").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteInvoiceSetting(id) {
  const { error } = await supabase.from("invoice_settings").delete().eq("id", id);
  if (error) throw error;
}
