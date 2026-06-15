# Phase 1.4 — Onboarding wizard

Run the firms onboarding SQL FIRST (in chat), then upload these into the
**closing-desk** repo's `src/` folder:

- `App.jsx`              → replace (shows the wizard on first run)
- `OnboardingWizard.jsx` → NEW
- `db.js`                → replace (adds updateFirm)

No styles.css change this time. No env changes.

## What you get
- A firm accepting an invite now lands on a quick branded setup card:
  set the display name, pick a brand color (live preview banner), choose a
  primary state. "Finish" or "Skip" — either way it won't show again.
- The chosen brand color flows into the workspace banner + firm avatar.
- The primary state pre-fills on new matters.

## Test
- Because the onboarded flag is new, your existing "test" firm will show the
  wizard once on next load — run through it, pick a color, finish, and you'll
  land in the workspace with that branding. Reload: it won't reappear.

NOTE: This assumes `Contacts.jsx` is already in `src/` from 1.3 (it is now).
