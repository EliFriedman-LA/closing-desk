# Phase 1 (first chunk) — Workspace shell + Matters

Upload these to the **closing-desk** repo, INSIDE the `src/` folder (use
Add file → Upload files *from within `src/`* so they don't land at the root):

- `App.jsx`       → replace (now loads the Workspace instead of the placeholder)
- `Workspace.jsx` → NEW
- `db.js`         → NEW
- `styles.css`    → replace (mobile-nav rules appended)

`Home.jsx` is no longer used — you can delete it or leave it; it's not imported.

No SQL, no env changes. The `matters` table + RLS already exist from Phase 0.1.

## What you get
- A real app shell: sidebar + topbar, your firm branding, sign out.
- **Dashboard**: firm banner + open / Lakeland / total counts + recent matters.
- **Matters**: searchable list; **＋ New matter** opens a form with the
  **Title handled by: Lakeland / Other** toggle (Other lets you type the company).
- **Matter detail**: a closing-stage tracker (Lakeland files styled live-blue,
  Other files greyed), set the stage manually for now, file details, delete.

## Test
- Sign in to your firm workspace → click **＋ New matter** → create one as
  "Lakeland" and one as "Other / none" → open each.
- Lakeland file shows the blue tracker + "live status connects later"; the Other
  file shows the greyed tracker + the "not connected" note.
- Everything is scoped to your firm by RLS — another firm can't see your matters.

## Next chunks
- Contacts / CRM, then the onboarding wizard, then the Lakeland live connection.
