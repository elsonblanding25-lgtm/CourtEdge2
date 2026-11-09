[ROADMAP.md](https://github.com/user-attachments/files/34563765/ROADMAP.md)
# CourtEdge2 — Thanksgiving 2026 roadmap

**Target:** November 26, 2026. This is a tentative development plan, not a claim of proven profitability.

## November 7–12 — Tracking and tournament readiness
- [ ] Automatically capture immutable pregame model-versus-sportsbook ATS picks.
- [ ] Track first and latest observed sportsbook spreads and source timestamps.
- [ ] Grade ATS wins/losses/pushes from completed games; exclude missing pregame evidence.
- [ ] Discover newly announced ESPN tournament matchups by event ID.
- [ ] Handle TBD opponents, neutral sites, reschedules and line changes.
- [ ] Monitor The Odds API usage and ESPN discovery coverage.

## November 13–18 — Team statistics
- [ ] Populate `public/data/team_stats.json` from a consistent source.
- [ ] Add offensive/defensive efficiency, eFG%, turnover rate, rebounding, free-throw rate and pace.
- [ ] Use only information available before tipoff; preserve model version in each pick.
- [ ] Compare upgraded model against existing `v2-baseline-1` on the same out-of-sample games.

## November 19–23 — Validation
- [ ] Review ATS by model edge size (2+, 5+, 10+ points).
- [ ] Evaluate spread MAE, biases, favorites/underdogs, neutral sites and missing market coverage.
- [ ] Calibrate on earlier dates; reserve later dates for validation.
- [ ] Do not treat a small sample as proof of a betting advantage.

## November 24–26 — Thanksgiving release
- [ ] Add website performance dashboard and coverage counts.
- [ ] Review sync failures, game ID changes, odds quotas and missing lines.
- [ ] Publish stable version and transparent methodology.

## Definitions
- **ATS pick:** First observed pairing of a valid pregame model prediction and sportsbook spread; locked before tipoff.
- **ATS win:** The recommended team covers the sportsbook handicap captured with that pick.
- **Push:** Exactly tied after applying the handicap; excluded from win-rate denominator.
- **No edge:** Model and market imply the same margin; not counted as a wager.
- **Void:** Original teams changed after a pick was recorded; excluded from win rate.
- **Market coverage:** Only spreads actually returned by a bookmaker; never fabricate missing lines.

## Operational note
GitHub scheduled Actions can be delayed; 30-minute scheduling is best effort. Monitor Odds API request quota and consider reducing frequency if needed. Snapshots reflect the first time CourtEdge **observed** a line, not necessarily the true market opening line. No odds data means no ATS result.
