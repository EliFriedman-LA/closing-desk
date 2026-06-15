# Phase 0.4 (Part B) — Closing Desk: accept an invite

Upload to the **closing-desk** repo, in the `src/` folder:
- `App.jsx`    → replace existing
- `Accept.jsx` → new file

Vercel auto-builds. (Part A — the redeem_invite SQL — is already run.)

## How the flow works
1. Attorney clicks the "Set up your account" button in the invite email
   → lands on `…/accept?token=…`.
2. If not signed in: they enter the invited email → get a magic link back to
   `/accept` → return signed in.
3. The app calls `redeem_invite(token)`, which links them to the firm, marks the
   invite accepted, and activates the firm.
4. They're redirected to `/` and land in their workspace.

## Test end-to-end
- In the staff Admin → Firms, invite a firm using an email you control.
- Open the invite email → "Set up your account".
- Enter that same email → magic link → it should redeem and drop you into the
  connected workspace. Back in Admin → Firms, that firm flips to **accepted**.

Guard rails handled: wrong email (mismatch), expired, revoked, already-used, and
already-in-a-firm all show a clear message instead of failing silently.
