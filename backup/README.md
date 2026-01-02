# Unicorns Edu — Static Single Page Application (SPA)

Unicorns Edu is a lightweight, static Single Page Application built with HTML, CSS, and vanilla JavaScript. It's designed as an offline-friendly educational management demo with CRUD features and localStorage persistence.

## What this workspace contains

- `assets/`
  - `css/` - stylesheets (base, components, pages)
  - `js/` - core JavaScript utilities and page modules
- `templates/` - HTML fragments for each page (dashboard, classes, students, teachers, payments, schedule, reports)
- `index.html` - main SPA container (entry point)

## Features

- Modular page structure (separate JS file per page)
- No external dependencies (pure HTML/CSS/JS)
- Data persisted in `localStorage` (demo dataset available under `window.demo`)
- Responsive layout using CSS Grid and Flexbox
- Accessibility-minded components (semantic HTML, keyboard-friendly modals)
- Small, dependency-free SVG charts for reports

## How to open

1. Clone or copy the workspace to your local machine.
2. Open `index.html` in a browser (double-click or use a simple static server).

Optionally, to serve via a simple local server (recommended for some browsers):

# On Windows PowerShell
# If you have Python 3 installed
python -m http.server 8000; Start-Process http://localhost:8000

## Development notes

- Main app logic is in `assets/js/`:
  - `data.js` — data layer & localStorage wrapper
  - `ui.js` — UI helpers (modals, notifications)
  - `logic.js` — app router and initialization
  - `pages/` — per-page modules (dashboard.js, classes.js, students.js, teachers.js, payments.js, schedule.js, reports.js)

- Templates are stored in `templates/` and are injected into the page by the router.

## Extending or testing

- Add new pages by creating a template in `templates/` and a matching module in `assets/js/pages/`.
- Data format examples are available in the code and `window.demo` object used for seeding.

## Next steps

- Implement and polish CSS (`assets/css/*.css`).
- Finish automated tests and manual responsive checks.
- Add build tooling if you want to bundle or minify assets.

## Troubleshooting

- If modals or navigation don't work, open the browser console to check for errors.
- Some features assume `window.demo` exists. If not present, the app will load an empty state.

---

If you want, I can:
- Implement the CSS files now (`assets/css/base.css`, `components.css`, `pages.css`).
- Wire templates into `index.html` router and ensure pages render automatically.
- Create a small test suite to validate core flows.

Which of the next steps should I take for you?