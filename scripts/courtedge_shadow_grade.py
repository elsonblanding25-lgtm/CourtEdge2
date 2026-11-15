
#!/usr/bin/env python3
"""Grade frozen CourtEdge predictions without changing official ATS records."""

import csv
import json
import sys
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone

preview_path = Path(
    sys.argv[1] if len(sys.argv) > 1
    else "public/data/model_preview.json"
)

games_path = Path(
    sys.argv[2] if len(sys.argv) > 2
    else "public/data/games.json"
)

output_dir = Path("public/data")
output_dir.mkdir(parents=True, exist_ok=True)

preview = json.loads(preview_path.read_text(encoding="utf-8"))
games = json.loads(games_path.read_text(encoding="utf-8"))

if isinstance(games, dict):
    games = games.get("games", [])

by_id = {
    str(g["espnId"]): g
    for g in games
    if g.get("espnId")
}

rows = []

for p in preview["games"]:
    g = by_id.get(str(p["espnId"]), {})

    home_score = g.get("homeScore")
    away_score = g.get("awayScore")

    final = str(g.get("status", "")).lower() in (
        "final", "completed", "post"
    )

    scored = (
        final
        and isinstance(home_score, (int, float))
        and isinstance(away_score, (int, float))
    )

    start = datetime.fromisoformat(
        p["startTime"].replace("Z", "+00:00")
    )

    stamped = datetime.fromisoformat(
        p["modelGeneratedAt"].replace("Z", "+00:00")
    )

    before_tip = stamped < start

    market = p.get("marketHomeHandicap")
    lean = p.get("previewLean")

    has_market = (
        isinstance(market, (int, float))
        and lean in ("home", "away")
    )

    eligible = has_market and before_tip

    result = "pending"
    chosen_margin = None

    if not before_tip:
        result = "invalid_late_prediction"

    elif not has_market:
        result = "no_market"

    elif scored:
        home_cover_margin = (
            home_score - away_score + market
        )

        chosen_margin = (
            home_cover_margin
            if lean == "home"
            else -home_cover_margin
        )

        if chosen_margin > 0:
            result = "win"
        elif chosen_margin < 0:
            result = "loss"
        else:
            result = "push"

    elif final:
        result = "final_missing_scores"

    rows.append({
        "espnId": p["espnId"],
        "date": p["date"],
        "startTime": p["startTime"],
        "away": p["away"],
        "home": p["home"],
        "modelVersion": p["modelVersion"],
        "modelFavorite": p["modelFavorite"],
        "modelSpread": p["modelSpread"],
        "marketFavorite": p.get("marketFavorite"),
        "marketSpread": p.get("marketSpread"),
        "sportsbook": p.get("sportsbook"),
        "edge": p.get("edge"),
        "previewLean": lean,
        "predictionTime": p["modelGeneratedAt"],
        "beforeTip": before_tip,
        "marketPresent": has_market,
        "eligibleForATS": eligible,
        "awayScore": away_score if scored else "",
        "homeScore": home_score if scored else "",
        "chosenSideCoverMargin": (
            round(chosen_margin, 3)
            if chosen_margin is not None
            else ""
        ),
        "shadowResult": result
    })

csv_path = output_dir / "shadow_results.csv"

with csv_path.open(
    "w", newline="", encoding="utf-8"
) as f:
    writer = csv.DictWriter(
        f, fieldnames=rows[0].keys()
    )
    writer.writeheader()
    writer.writerows(rows)

counts = Counter(
    row["shadowResult"] for row in rows
)

wins = counts["win"]
losses = counts["loss"]
pushes = counts["push"]

summary = {
    "snapshotGeneratedAt": preview["generatedAt"],
    "gradedAt": datetime.now(timezone.utc).isoformat(),
    "snapshotCount": len(rows),
    "eligiblePregameMarketPicks": sum(
        row["eligibleForATS"] for row in rows
    ),
    "results": dict(counts),
    "wins": wins,
    "losses": losses,
    "pushes": pushes,
    "winRateExcludingPushes": (
        round(wins / (wins + losses), 4)
        if wins + losses
        else None
    ),
    "warning": (
        "Saved market lines have not been independently "
        "verified for freshness. Shadow results are "
        "not official ATS picks."
    )
}

json_path = output_dir / "shadow_summary.json"

json_path.write_text(
    json.dumps(summary, indent=2) + "\n",
    encoding="utf-8"
)

print(json.dumps(summary, indent=2))
