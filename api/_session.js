// Shared sign-in check for endpoints that spend our Anthropic credits.
//
// Vercel ignores files beginning with "_" when it builds routes, so this is a
// helper the endpoints import — not an endpoint itself.
//
// Without this, anyone who knows an endpoint's address can push documents
// through it on our AI account. Verifying the caller's Supabase session turns
// "anyone on the internet" into "someone signed in to Closing Desk".

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Returns a message to show the user, or null when the caller is signed in.
export async function signedInError(req) {
  const raw = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7).trim() : "";
  if (!token) return "Please sign in again — this request arrived without a session.";
  if (!SUPABASE_URL || !SUPABASE_ANON) return "This server is missing its authentication settings.";
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` }
    });
    if (!r.ok) return "Your session has expired — sign out and back in, then try again.";
  } catch {
    return "Could not check your sign-in just now. Please try again.";
  }
  return null;
}

// Standard CORS + method + session gate. Returns true when the handler should
// stop (it has already written the response).
export async function rejectUnlessSignedIn(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(200).end(); return true; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Method not allowed" }); return true; }
  const error = await signedInError(req);
  if (error) { res.status(401).json({ ok: false, error }); return true; }
  return false;
}
