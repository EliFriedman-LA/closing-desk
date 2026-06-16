# Phase 2.3a — Document exchange (attorney side)

Run the Phase 2.3 SQL FIRST (bucket + file_documents + storage policies), then
upload into the **closing-desk** repo's `src/` folder:

- `Workspace.jsx` → replace
- `db.js`         → replace

No env changes.

## What you get
- A **Documents** panel on every matter detail: ⬆ Upload, list, Open (opens via
  a short-lived signed URL), and delete-your-own.
- Files are stored privately, scoped to your firm — another firm can't see them.
- On a matter connected to a Lakeland file, the docs are shared on that file:
  Lakeland will see what you upload, and you'll see what they share (the staff
  side of that is 2.3b). Each doc is tagged **You** or **Lakeland**.
- Up to 25 MB per file.

## Test
- Open a matter → Documents → Upload a PDF → it lists, tagged "You".
- Click Open → it opens in a new tab. Delete with the ✕.
- (Full two-way exchange — Lakeland uploading back — comes in 2.3b.)
