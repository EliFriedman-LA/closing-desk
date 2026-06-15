# Phase 2.1 — Live Lakeland connection

Run the Phase 2.1 SQL FIRST (in chat), then upload these into the
**closing-desk** repo's `src/` folder:

- `Workspace.jsx` → replace (matter detail now connects + shows live status)
- `db.js`         → replace (adds linkLakelandMatter + getLakelandStatus)

No styles.css change. No env changes.

## What you get
- On a Lakeland matter that isn't linked yet: a **◆ Connect to Lakeland** button.
  Enter the Lakeland file # + property ZIP → if they match a real order, the
  matter links.
- Once linked: the 7-stage tracker goes **live** — driven by your back office
  (Title search → Commitment → Clear to close → Funded → Recorded → Policy),
  plus a "Lakeland milestones" card with the key dates. Read-only; it advances
  automatically as your team works the file. A green dot = live.
- Non-Lakeland matters keep the manual stage dropdown.

## Test (end-to-end)
1. In your STAFF app, pick a real order — note its file number + property ZIP.
2. In Closing Desk, make a Lakeland matter, open it, click Connect, enter that
   file # + ZIP → it should link and show that file's live stage + dates.
3. Change something on the file in the staff app (e.g. set a commitment date or
   check Wires Sent) → reopen the matter in Closing Desk → the stage moves.

Security: attorneys never query your orders table. The two functions verify the
firm owns the matter and return only file #, address, stage, and key dates.
