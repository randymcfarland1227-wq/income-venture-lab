# Income & Venture Lab

A personal operating system for exploring income ideas, planning ventures, researching investments, and running low-risk experiments. The application keeps personal notes and statuses synchronized with Google Sheets while protecting externally sourced market facts from accidental spreadsheet edits.

## What is included

- Short-term income and long-term venture workspaces
- Investment and asset research library
- Paper and actual experiment tracking
- Financial scenarios, milestones, expenses, findings, and research notes
- Bidirectional Google Sheets sync for user-authored fields
- Application-owned market-data fields with source, observation date, caching, and stale/unavailable states
- Light and dark themes
- Google Apps Script sync service in `apps-script/`

## Data-authority model

User-authored fields such as notes, status, ratings, experiments, and decisions sync in both directions between the site and Google Sheets. External facts and calculated values—including market levels, yields, inflation data, rates, and calculated returns—flow from their authoritative source through the application to Sheets. Spreadsheet edits cannot become market data.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm ci
npm run dev
```

Create a local `.dev.vars` file for the server-side Sheets connection:

```text
GOOGLE_SHEETS_SYNC_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
GOOGLE_SHEETS_SYNC_SECRET=replace-with-a-long-random-secret
GOOGLE_SHEETS_SCRIPT_ID=your-script-project-id
```

Optional licensed quote-provider settings:

```text
MARKET_DATA_API_URL=
MARKET_DATA_API_KEY=
```

Never commit `.dev.vars` or credentials.

## Google Apps Script

The Apps Script project lives in `apps-script/`. It manages the Sheet tabs, stable row identities, conflict-safe writes, and protected application-owned columns.

1. Create or select an Apps Script project connected to the intended Google account.
2. Update `apps-script/.clasp.json` with that project’s script ID if deploying a separate copy.
3. Set the same sync secret used by the application.
4. Deploy the script as a web app and place its `/exec` URL in `GOOGLE_SHEETS_SYNC_URL`.
5. Run the site’s Sheet setup once to create or validate the managed tabs and install edit triggers.

The repository does not contain the live sync secret.

## Validation

```bash
npm run build
npm run lint
```

The end-to-end sync checks, including the market-data authority rule, are in `scripts/sync-smoke.mjs` with the local Sheet stand-in in `scripts/mock-sheets.mjs`.

## Hosting note

This is a server-backed application that uses a database and server-side integrations. GitHub Pages alone cannot run the complete application. The public repository is the canonical source; deploy the built server application to a compatible runtime and keep Google Apps Script as the Sheets integration service.
