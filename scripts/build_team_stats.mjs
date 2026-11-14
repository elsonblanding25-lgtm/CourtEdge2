// CourtEdge Phase 2: Build 2026-27 team stats from completed ESPN DI box scores.
// Run BEFORE scripts/sync.mjs. No model predictions or ATS picks are created here.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dataDir = path.join(root, 'public', 'data');
const read = (name, fallback) => {
  const p = path.join(dataDir, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback;
};
const write = (name, value) => fs.writeFileSync(
  path.join(dataDir, name), JSON.stringify(value, null, 2) + '\n'
);
const games = read('games.json', []);
const cache = read('team_stats_cache.json', {});
const now = new Date();
const minDate = process.env.STATS_SEASON_START || '2026-11-05';
const maxGames = Math.max(0, Number(process.env.STATS_MAX_FETCH ?? 500));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const finite = v => v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
const norm = v => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function getStat(statistics, ...keys) {
  for (const s of statistics || []) {
    const id = norm(s.name || s.abbreviation || s.label);
    if (keys.some(key => id === norm(key))) {
      const value = s.displayValue ?? s.value;
      if (value !== undefined) return value;
    }
  }
  return null;
}
function pair(value) {
  const match = String(value ?? '').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}
function parseTeam(t) {
  const s = t.statistics || [];
  const fg = pair(getStat(s, 'fieldGoalsMade-fieldGoalsAttempted', 'fieldGoalsMadeAttempted', 'FG'));
  const three = pair(getStat(s, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'threePointFieldGoalsMadeAttempted', '3PT'));
  const ft = pair(getStat(s, 'freeThrowsMade-freeThrowsAttempted', 'freeThrowsMadeAttempted', 'FT'));
  const oreb = finite(getStat(s, 'offensiveRebounds', 'offRebounds', 'OREB'));
  const dreb = finite(getStat(s, 'defensiveRebounds', 'defRebounds', 'DREB'));
  const turnovers = finite(getStat(s, 'turnovers', 'totalTurnovers', 'TO'));
  if (!fg || !three || !ft || oreb === null || dreb === null || turnovers === null || fg[1] <= 0) return null;
  if (fg[0] > fg[1] || three[0] > fg[0] || ft[0] > ft[1]) return null;
  return { id: String(t.team?.id || ''), fgm: fg[0], fga: fg[1], tpm: three[0], fta: ft[1], oreb, dreb, turnovers };
}
function parseSummary(payload) {
  const teams = payload?.boxscore?.teams || [];
  if (teams.length !== 2) return null;
  const parsed = teams.map(parseTeam);
  if (parsed.some(t => !t || !t.id)) return null;
  return parsed;
}

// Use only ESPN-ID-linked completed games in CourtEdge's DI-filtered games.json.
// Recheck the scheduled start time to avoid accidental future games.
const finals = games.filter(g =>
  g.espnId && g.date >= minDate &&
  (g.status === 'final' || (finite(g.homeScore) !== null && finite(g.awayScore) !== null)) &&
  (!g.startTime || new Date(g.startTime) < now)
);
const unique = [...new Map(finals.map(g => [String(g.espnId), g])).values()];
let fetched = 0, cacheHits = 0, unavailable = 0, failures = 0;
let consecutiveFetchErrors = 0;
const records = [];
for (const g of unique) {
  const id = String(g.espnId);
  let entry = cache[id];
  // A cached missing/invalid result is retried after six hours.
  const retry = !entry?.teams && (!entry?.checkedAt || now - new Date(entry.checkedAt) > 6 * 3600000);
  if (!entry || retry) {
    if (fetched >= maxGames || consecutiveFetchErrors >= 8) continue;
    fetched++;
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary?event=${encodeURIComponent(id)}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) {
        if (response.status === 404) {
          entry = { checkedAt: now.toISOString(), teams: null };
          cache[id] = entry;
          unavailable++;
          consecutiveFetchErrors = 0;
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const teams = parseSummary(payload);
      entry = { checkedAt: now.toISOString(), teams };
      cache[id] = entry;
      consecutiveFetchErrors = 0;
      if (!teams) unavailable++;
    } catch (error) {
      failures++;
      consecutiveFetchErrors++;
      if (consecutiveFetchErrors === 8) console.warn('STATS BUILD: ESPN fetch circuit breaker opened after 8 consecutive errors.');
      console.warn(`STATS FETCH FAILED: ESPN ${id}: ${error.message}`);
      entry = { checkedAt: now.toISOString(), teams: null };
      cache[id] = entry;
    }
    if (fetched % 20 === 0) await sleep(200);
  } else cacheHits++;
  if (!entry.teams) continue;
  const [a, b] = entry.teams;
  const awayId = String(g.espnAwayTeamId || '');
  const homeId = String(g.espnHomeTeamId || '');
  // Team IDs must agree with the ESPN game; never guess team orientation.
  if (!awayId || !homeId || ![a.id, b.id].includes(awayId) || ![a.id, b.id].includes(homeId) || awayId === homeId) {
    console.warn(`STATS ID MISMATCH: ESPN ${id} ${g.away} @ ${g.home}`);
    continue;
  }
  const away = a.id === awayId ? a : b;
  const home = a.id === homeId ? a : b;
  if (away.id === home.id) continue;
  const possessions = (t) => t.fga - t.oreb + t.turnovers + 0.475 * t.fta;
  const pace = (possessions(away) + possessions(home)) / 2;
  if (pace <= 30 || pace >= 130) continue;
  records.push({ g, away, home, pace });
}

const sums = new Map();
function add(id, name, own, opp, pace) {
  if (!sums.has(id)) sums.set(id, {
    team: name, espnTeamId: id, gamesPlayed: 0, fgm: 0, fga: 0, tpm: 0, fta: 0,
    oreb: 0, turnovers: 0, possessions: 0, opponentFgm: 0, opponentFga: 0,
    opponentTpm: 0, opponentFta: 0, opponentOreb: 0, opponentTurnovers: 0,
    opponentPossessions: 0, opponentDreb: 0, ownDreb: 0, paceSum: 0
  });
  const s = sums.get(id);
  s.gamesPlayed++;
  for (const k of ['fgm', 'fga', 'tpm', 'fta', 'oreb', 'turnovers']) {
    s[k] += own[k];
    s['opponent' + k[0].toUpperCase() + k.slice(1)] += opp[k];
  }
  s.possessions += own.fga - own.oreb + own.turnovers + .475 * own.fta;
  s.opponentPossessions += opp.fga - opp.oreb + opp.turnovers + .475 * opp.fta;
  s.ownDreb += own.dreb;
  s.opponentDreb += opp.dreb;
  s.paceSum += pace;
}
for (const {g, away, home, pace} of records) {
  add(away.id, g.away, away, home, pace);
  add(home.id, g.home, home, away, pace);
}
const pct = (n, d) => d > 0 ? Math.round(n / d * 1000) / 10 : null;
const round = n => Math.round(n * 10) / 10;
const stats = [...sums.values()].map(s => ({
  team: s.team, espnTeamId: s.espnTeamId, gamesPlayed: s.gamesPlayed,
  offTO: pct(s.turnovers, s.possessions),
  defTOForced: pct(s.opponentTurnovers, s.opponentPossessions),
  offEFG: pct(s.fgm + 0.5 * s.tpm, s.fga),
  defEFGAllowed: pct(s.opponentFgm + 0.5 * s.opponentTpm, s.opponentFga),
  offORB: pct(s.oreb, s.oreb + s.opponentDreb),
  defORBAllowed: pct(s.opponentOreb, s.opponentOreb + s.ownDreb),
  offFTR: pct(s.fta, s.fga),
  defFTRAllowed: pct(s.opponentFta, s.opponentFga),
  pace: round(s.paceSum / s.gamesPlayed)
})).filter(s => ['offTO','defTOForced','offEFG','defEFGAllowed','offORB','defORBAllowed','offFTR','defFTRAllowed','pace'].every(k => s[k] !== null));
stats.sort((a, b) => a.team.localeCompare(b.team));
write('team_stats_cache.json', cache);
if (stats.length > 0 || !Array.isArray(read('team_stats.json', [])) || read('team_stats.json', []).length === 0) {
  write('team_stats.json', stats);
} else {
  console.warn('STATS BUILD: no usable box scores; preserving existing team_stats.json.');
}
console.log(`STATS BUILD: ${unique.length} eligible finals; ${fetched} fetched; ${cacheHits} cached; ${records.length} usable box scores; ${stats.length} team profiles; ${stats.filter(s => s.gamesPlayed >= 3).length} with 3+ games; ${unavailable} incomplete; ${failures} fetch errors; ${consecutiveFetchErrors >= 8 ? 'fetch halted after repeated failures' : 'fetch healthy'}.`);
console.log('STATS BUILD: raw season-to-date team rates (not opponent-adjusted); predictions remain controlled by COURTEDGE_ENABLE_MODEL.');
