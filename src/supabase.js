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
