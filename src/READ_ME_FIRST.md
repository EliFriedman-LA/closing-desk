# Phase 2.2a — Place a title order (attorney side)

Run the Phase 2.2a SQL FIRST (order_requests table), then upload into the
**closing-desk** repo's `src/` folder:

- `Workspace.jsx` → replace
- `db.js`         → replace

No styles / env changes.

## What you get (attorney side)
On a Lakeland matter that isn't connected yet, the tracker footer now shows TWO
options:
- **◆ Connect existing file** — link to a file Lakeland already opened (2.1).
- **Place title order** — send a new file to Lakeland to open. Opens a form
  prefilled from the matter (address, town, state, type + buyer/seller/lender/
  notes). Submitting creates a pending request.

After placing: the matter shows **"Order placed — pending Lakeland review"**
(with a Cancel link). When your staff accept it (built in 2.2b), the matter
auto-connects and goes live.

## Test
- Make a Lakeland matter → open it → **Place title order** → submit.
- It flips to "pending review." Check Supabase → `order_requests` has the row
  (status = pending). 2.2b adds the staff-side Accept that turns it into a real
  file and links the matter.
