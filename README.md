# Closing Desk — Phase 0.2 (scaffold + magic-link auth + firm context)

The new, separate attorney app. It signs an attorney in by emailed magic link,
resolves their firm through `firm_users → firms → orgs`, and gates the app on it.
This is the authenticated skeleton — feature screens come in later phases.

It uses the **same Supabase project** as the staff app (just the public anon key).

---

## 1. Put it in its own repo

1. Create a **new GitHub repo** (e.g. `closing-desk`) — separate from the staff app.
2. Upload everything in this folder to it.

## 2. Create a new Vercel project

1. New Project → import the `closing-desk` repo.
2. Framework preset: **Vite** (build `vite build`, output `dist`) — auto-detected.
3. Add **Environment Variables** (Production + Preview):
   - `VITE_SUPABASE_URL` = your Supabase project URL (same one the staff app uses)
   - `VITE_SUPABASE_ANON_KEY` = the **anon public** key (not the service key)
4. Deploy. Note the URL (e.g. `https://closing-desk.vercel.app`).

## 3. Point Supabase Auth at it

In Supabase → **Authentication → URL Configuration**:
- **Site URL**: your Closing Desk Vercel URL.
- **Redirect URLs**: add the same URL (and `http://localhost:5174` if you'll run it locally).
- Make sure the **Email** provider is enabled (magic links are on by default).

---

## 4. Test it

1. Open the deployed URL → you should see the **Sign in** screen.
2. Enter your email → click **Email me a sign-in link** → open the link from your inbox.
3. You'll land signed in, on the **"This account isn't linked to a firm yet"** screen.
   That's correct — there's no firm mapping for you yet.

### Link yourself to a test firm (to see the workspace)

- In Supabase → **Authentication → Users**, find your user and copy its **UUID**.
- Run this in the SQL Editor (paste your UUID where shown):

```sql
with f as (
  insert into firms (title_company_id, name, slug, state, brand_color)
  select id, 'Test Firm LLC', 'test-firm', 'NJ', '#0f5132'
  from orgs where slug = 'lakeland'
  returning id
)
insert into firm_users (firm_id, user_id, email, name, role)
select f.id, '<YOUR_AUTH_USER_UUID>', 'you@yourfirm.com', 'You', 'attorney'
from f;
```

- Reload Closing Desk → you should now see the **connected firm workspace**
  ("Test Firm LLC · linked to Lakeland Abstract").

(Re-running the block fails on the unique `slug` — change `test-firm` to something
else, or delete the test firm first.)

---

## What's next

- **0.3** — "Invite firm" in the staff admin panel (so onboarding is real, not manual SQL).
- **0.4** — invite redemption (the attorney accepting an invite auto-creates their `firm_users` row).
- Then the workspace screens.
