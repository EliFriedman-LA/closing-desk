import { supabase } from "./partnerClient.js";

// Reporting reads. Pulls matters (pipeline + closings), invoices (revenue), and
// contacts (export) in one shot. Invoices/contacts are best-effort so reporting
// still renders if a table is empty. RLS scopes everything to the firm.

export async function reportData() {
  const { data: matters, error } = await supabase.from("matters").select("*");
  if (error) throw error;

  let invoices = [];
  try {
    const r = await supabase.from("invoices").select("id,total,status,issue_date,paid_at,matter_id,bill_to,number");
    invoices = r.data || [];
  } catch (e) { /* table may be empty / new */ }

  let contacts = [];
  try {
    const r = await supabase.from("firm_contacts").select("*");
    contacts = r.data || [];
  } catch (e) { /* ignore */ }

  return { matters: matters || [], invoices, contacts };
}
