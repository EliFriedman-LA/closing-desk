# Phase 1.3 — Contacts (firm CRM)

Run the firm_contacts SQL FIRST (in chat), then upload these to the
**closing-desk** repo, inside `src/`:

- `Workspace.jsx` → replace (adds Contacts to the nav + router)
- `Contacts.jsx`  → NEW
- `db.js`         → replace (adds contacts helpers + CONTACT_ROLES)
- `styles.css`    → replace (contacts grid responsive rule appended)

No env changes.

## What you get
- "Contacts" moves from "Coming soon" to a live page in the sidebar.
- Add / edit / delete contacts: name, role, firm, email, phone, notes.
- Search across all fields. Private to your firm (RLS-scoped).

## Test
- Open Contacts → Add contact → fill a few → they list and are searchable.
- Click one to edit or delete.
- These are separate from Lakeland's contacts — only your firm sees them.
