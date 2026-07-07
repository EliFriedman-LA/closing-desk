import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Surfaced in the console so a missing env var is obvious during setup.
  console.warn("Closing Desk: missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

// Same Supabase project as the staff app. Auth sessions persist, and magic-link
// tokens in the URL are detected and exchanged automatically on load.
export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// --------------------------------------------------------------------------
// Credential login (Company ID + User ID + password).
// The server resolves the credentials to the underlying auth email and returns
// a session, which we adopt so onAuthStateChange in PartnerApp takes over.
// --------------------------------------------------------------------------
export async function signInWithCredentials(companyCode, username, password) {
  const r = await fetch("/api/partner-auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_code: companyCode, username, password }),
  });
  const d = await r.json().catch(() => ({ ok: false, error: "Sign-in failed" }));
  if (!r.ok || !d.ok) throw new Error(d.error || "Sign-in failed");
  const { error } = await supabase.auth.setSession({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
  });
  if (error) throw error;
  return { mustChangePassword: !!d.must_change_password };
}

// Set a new password for the signed-in user, then clear the forced-change flag.
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
  await supabase.rpc("partner_clear_pw_flag");
}
