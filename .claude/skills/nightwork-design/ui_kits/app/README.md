# Nightwork — App UI Kit

Interactive recreation of the authenticated product chrome: nav bar, job sidebar, dashboard, and the 4-step draw wizard.

## Files

- `index.html` — click-through prototype. Dashboard default; button at the bottom jumps to the draw wizard.
- `Shell.jsx` — `<NavBar>` and `<JobSidebar>` (sticky teal top chrome + 220px left job list).
- `Dashboard.jsx` — `<Dashboard>`: greeting, 4 metric tiles, Needs Attention list, Recent Activity.
- `DrawWizard.jsx` — `<DrawWizard>`: Step 1 Select Job → Step 2 Period → Step 3 Review Line Items (G703 table) → Step 4 Summary & Submit.

## Visual rules applied

- Teal `#3F5862` top bar with 3px top accent; white underline indicates active tab.
- White cards on cream `#F7F5ED` page with 1px `#E8E8E8` borders; square corners only.
- Display type (Century Gothic) for page titles and big numbers; tabular-nums monospace for all money.
- 10–11px `uppercase` `0.12em` tracked labels over section rules.
- Severity dots: danger red `#c0392b`, warning amber `#E89A2B`, brass `#E65100`, success `#2E7D32`.

## Known gaps

- No live data / no auth — all rows are hard-coded realistic samples.
- Mobile drawer variant of `<JobSidebar>` not exposed in the click-through (exists in the codebase).
- Notification bell & role-based nav visibility are visual only.
