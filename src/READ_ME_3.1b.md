# 3.1b Calendar — CLOSING DESK repo (closing-desk)
Drop into src/ (REPLACE both):
  - PartnerWorkspace.jsx  (new "Calendar" nav page: Agenda + Month views)
  - partnerDb.js          (adds listFirmDeadlines roll-up)
No SQL. Sidebar -> Calendar. Agenda groups Overdue / Next 7 days / Later;
Month view shows deadlines per day, click a day for its list. Check items off
right from the calendar; "Show completed" toggles done items. Click a row to
jump to that matter.
