# CourtEdge — College Basketball Model Website

A deployable **Next.js** website using the custom **2026–27 Version 12** college basketball model built in this conversation.

## Features
- Daily predictions and market/model spread comparisons
- 3+ point edge and favorite-flip filters
- 365 teams in rankings (364 with rated strength)
- ATS win/loss/push grading from final scores and the **original saved market line**
- ATS dashboard and confidence-level performance
- Automated ESPN schedule/final-score sync and optional sportsbook odds from The Odds API

## Launch locally
1. Install Node.js 20+.
2. In this folder, run `npm install`.
3. Run `npm run dev`.
4. Visit `http://localhost:3000`.

## Publish a public website
1. Create a new **private GitHub repository** and upload/push this project's files.
2. Visit **https://vercel.com/new** and import the GitHub repository.
3. Accept the Next.js defaults and click **Deploy**. Vercel will provide a public URL such as `your-project.vercel.app`.
4. In GitHub, enable Actions. The `.github/workflows/sync.yml` workflow runs hourly and commits refreshed `public/data/games.json`; Vercel redeploys on each commit.
5. Optional: get an odds API key from **https://the-odds-api.com/** and save it as a GitHub Actions repository secret named `ODDS_API_KEY`. The odds feed may require a paid tier depending on usage and limits.
6. Run the **Refresh basketball games and results** workflow manually once to test.

## Model logic
For new games with both teams in Version 12, a team at V12 rank `r` receives the Basketball Quant preseason projected adjusted-net-efficiency value at the same ordinal rank `r` (empirical rank-to-efficiency mapping). Projected home margin = `0.70 × (home efficiency − away efficiency) + 3.0` home-court points (zero on neutral courts). The model favorite's spread is the negative absolute value of that margin. This is a heuristic, not a calibrated betting prediction model.

The ATS pick is the side favored by the model *relative to the saved market spread*. Final ATS grading uses the saved market line and the actual final score. Market lines are **frozen once captured** and never overwritten by later API updates. Initial November 2 lines were a historical snapshot from the earlier workbook.

## Important limitations
- **Not a hosted site yet**: Vercel provides a URL only after you deploy.
- No API key is included; new market odds remain blank until you configure `ODDS_API_KEY`.
- The Odds API generally provides current/future markets, not a complete backfill of historical pregame odds.
- ESPN team-name differences can prevent some games from matching ratings or old rows; inspect the log after the first sync and expand `aliases` in `scripts/sync.mjs` as needed.
- Existing Nov 2 data uses the spreadsheet's time labels and previously captured market odds. Later syncs may append duplicates where team names differ; reconcile before relying on season-wide metrics.
- The scheduled GitHub Actions workflow may run late or be disabled by GitHub inactivity policies; production-grade ingestion should use a database, stable event IDs, retry handling, and health monitoring.
- The dashboard's unit-profit estimate assumes -110 spread prices; it is **not** realized profit or a guarantee of positive returns.
- Confidence is a simple edge-based heuristic, not a validated probability of winning.
- The source ratings are preseason-only; they do not update automatically based on new games.

## Files
- `public/data/ratings.json` — Version 12 ratings and conferences
- `public/data/games.json` — Nov 2 initial schedule/lines and new synchronized games
- `scripts/sync.mjs` — schedule, score and odds update job
- `.github/workflows/sync.yml` — scheduled GitHub Actions job
- `app/page.jsx` — website pages and ATS dashboard
