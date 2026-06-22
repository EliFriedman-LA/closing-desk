import { supabase } from "./partnerClient.js";

// Internal matter notes + @mentions. firm_id is passed on insert; RLS scopes all reads
// to the firm (firm_id = current_firm_id()). mentions is an array of firm_users.user_id.

export async function listMatterNotes(matterId) {
  const { data, error } = await supabase
    .from("matter_notes")
    .select("*")
    .eq("matter_id", matterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createMatterNote(firmId, matterId, body, mentions) {
  let authorId = null;
  try { authorId = (await supabase.auth.getUser()).data.user?.id || null; } catch (e) { /* ignore */ }
  const { data, error } = await supabase
    .from("matter_notes")
    .insert({ firm_id: firmId, matter_id: matterId, author_id: authorId, body, mentions: mentions || [] })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMatterNote(id) {
  const { error } = await supabase.from("matter_notes").delete().eq("id", id);
  if (error) throw error;
}
