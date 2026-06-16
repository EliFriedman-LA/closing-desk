# Closing Desk — Partner rename (one-time)

Renames every Closing Desk file with a `Partner` prefix so the app can live in
the SAME project/upload as the staff app without name collisions.
Functionality is 100% unchanged — only filenames + import paths.

## 1) Upload these into the closing-desk repo
- The 10 files in `src/`  → into the repo's **`src/`** folder
- `index.html`            → into the repo **root** (it now points at partnerMain.jsx)

## 2) DELETE the old files from `src/` (they're replaced)
Delete these 11 from `src/` so only the Partner-named files remain:
  App.jsx, Workspace.jsx, Login.jsx, Accept.jsx, Contacts.jsx,
  OnboardingWizard.jsx, db.js, supabase.js, styles.css, main.jsx, Home.jsx

(If you forget to delete them the app still works — index.html boots from
partnerMain.jsx and the old files become dead/unused — but deleting keeps it clean.)

## Name map (old → new)
  App.jsx            → PartnerApp.jsx
  Workspace.jsx      → PartnerWorkspace.jsx
  Login.jsx          → PartnerLogin.jsx
  Accept.jsx         → PartnerAccept.jsx
  Contacts.jsx       → PartnerContacts.jsx
  OnboardingWizard.jsx → PartnerOnboarding.jsx
  db.js              → partnerDb.js
  supabase.js        → partnerClient.js
  styles.css         → partner.css
  main.jsx           → partnerMain.jsx
  Home.jsx           → (deleted, was unused)
  index.html         → (same name, now references partnerMain.jsx)

No env changes. After deploy, the build boots from partnerMain.jsx → PartnerApp.
