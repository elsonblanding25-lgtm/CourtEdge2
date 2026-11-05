
/** CourtEdge daily sync.
 * ESPN supplies fixtures and scores.
 * The Odds API supplies available sportsbook lines.
 * Existing pregame predictions are preserved.
 */
import fs from 'node:fs';

const base = new URL('../public/data/', import.meta.url);
const read = n => JSON.parse(fs.readFileSync(new URL(n, base), 'utf8'));
const write = (n, v) =>
  fs.writeFileSync(new URL(n, base), JSON.stringify(v, null, 2) + '\n');

const games = read('games.json');
const ratings = read('ratings.json').filter(
  r => Number.isInteger(r.rank) && Number.isFinite(r.bqNet)
);
const efficiency = ratings.map(r => r.bqNet).sort((a, b) => b - a);

const aliases = {
  'n illinois': 'northern illinois',
  'app state': 'appalachian state',
  'n kentucky': 'northern kentucky',
  'mcneese': 'mcneese state',
  'fgcu': 'florida gulf coast',
  'c connecticut': 'central connecticut',
  'miami fl': 'miami fla',
  'miami florida': 'miami fla',
  'miami ohio': 'miami oh',
  'st bonaventure': 'saint bonaventure',
  'st johns': 'saint johns',
  'st thomas': 'saint thomas',
  'loyola md': 'loyola maryland',
  'uncw': 'unc wilmington',
  'usc upstate': 'south carolina upstate',
  'charleston': 'college of charleston',
  's florida': 'south florida',
  'umass': 'massachusetts',
  'little rock': 'arkansas little rock',
  'liu': 'long island',
  'fau': 'florida atlantic',
  'gw': 'george washington',
  'g washington': 'george washington',
  'southern miss': 'southern mississippi',
  'ut martin': 'tennessee martin',
  'se missouri st': 'southeast missouri state',
  'n carolina': 'north carolina',
  'n carolina central': 'north carolina central',
  'st marys': 'saint marys',
  'purdue fort wayne': 'fort wayne',
  'iu indianapolis': 'iu indy',
  'st josephs': 'saint josephs',
  's illinois': 'southern illinois',
  'e michigan': 'eastern michigan',
  'w michigan': 'western michigan',
  'e illinois': 'eastern illinois',
  'w carolina': 'western carolina',
  'n florida': 'north florida',
  's dakota': 'south dakota',
  's dakota st': 'south dakota state',
  'n dakota': 'north dakota',
  'n dakota st': 'north dakota state',
  'n texas': 'north texas',
  'n iowa': 'northern iowa',
  's indiana': 'southern indiana',
  'uconn': 'connecticut',
  'unc': 'north carolina',
  'n carolina a t': 'north carolina a t'
};

function key(s) {
  const k = String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\bst\b/g, 'saint');

  return aliases[k] || k;
}

const rated = new Map(ratings.map(r => [key(r.team), r]));

function rating(...names) {
  for (const n of names) {
    const r = rated.get(key(n));
    if (r) return r;
  }
  return null;
}

const names = c => [
  c.team?.shortDisplayName,
  c.team?.displayName,
  c.team?.name,
  c.team?.location
].filter(Boolean);

function matches(stored, c) {
  const a = rating(stored);
  return names(c).some(
    n => key(stored) === key(n) || (a && rating(n) === a)
  );
}

function centralDate(d) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);

  const obj = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${obj.year}-${obj.month}-${obj.day}`;
}

function daysApart(a, b) {
  return Math.abs(
    (Date.parse(a + 'T12:00:00Z') -
     Date.parse(b + 'T12:00:00Z')) / 86400000
  );
}

function isFinal(g) {
  return g.status === 'final' ||
    (Number.isFinite(g.awayScore) && Number.isFinite(g.homeScore));
}

function setModel(g, an = [], hn = [], now = new Date()) {
  if (g.modelSpread != null || g.modelFavorite) return false;
  if (isFinal(g) || !g.date || g.date < centralDate(now)) return false;

  const a = rating(g.away, ...an);
  const h = rating(g.home, ...hn);
  if (!a || !h) return false;

  const av = efficiency[a.rank - 1];
  const hv = efficiency[h.rank - 1];

  if (!Number.isFinite(av) || !Number.isFinite(hv)) return false;

  const margin = 0.7 * (hv - av) + (g.site === 'Neutral' ? 0 : 3);

  g.modelFavorite = margin >= 0 ? g.home : g.away;
  g.modelSpread = -Math.round(Math.abs(margin) * 10) / 10;
  g.modelGeneratedAt = now.toISOString();

  return true;
}

function computeEdge(g) {
  if (
    g.modelSpread == null ||
    !g.modelFavorite ||
    g.marketSpread == null ||
    !g.marketFavorite
  ) return;

  if (g.edge != null && g.confidence != null) return;

  const modelHome = g.modelFavorite === g.home
    ? -Math.abs(g.modelSpread)
    : Math.abs(g.modelSpread);

  const marketHome = g.marketFavorite === g.home
    ? -Math.abs(g.marketSpread)
    : Math.abs(g.marketSpread);

  g.edge = Math.round(Math.abs(modelHome - marketHome) * 10) / 10;
  g.confidence = Math.min(
    5,
    1 + [3, 6, 10, 15].filter(t => g.edge >= t).length
  );
}

const now = new Date();
const lookback = Math.max(
  0, Number(process.env.SYNC_LOOKBACK_DAYS ?? 14)
);
const forward = Math.max(
  0, Number(process.env.SYNC_FORWARD_DAYS ?? 7)
);

const start = new Date(Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate() - lookback
));

let eventsSeen = 0;
let added = 0;
let linked = 0;
let finals = 0;
let models = 0;
let ambiguous = 0;

const seen = new Set();

for (let offset = 0; offset <= lookback + forward; offset++) {
  const day = new Date(start);
  day.setUTCDate(start.getUTCDate() + offset);

  const date = day.toISOString().slice(0, 10);
  const stamp = date.replaceAll('-', '');
  const events = new Map();

  for (const suffix of ['&groups=50', '']) {
    try {
      const res = await fetch(
        'https://site.api.espn.com/apis/site/v2/sports/' +
        'basketball/mens-college-basketball/scoreboard' +
        `?dates=${stamp}&limit=500${suffix}`
      );

      if (!res.ok) throw Error(`HTTP ${res.status}`);

      const payload = await res.json();

      for (const e of payload.events || []) {
        events.set(String(e.id), e);
      }
    } catch (e) {
      console.warn(`ESPN ${date}: ${e.message}`);
    }
  }

  for (const event of events.values()) {
    if (seen.has(String(event.id))) continue;
    seen.add(String(event.id));

    const comp = event.competitions?.[0];
    if (!comp) continue;

    const away = comp.competitors?.find(c => c.homeAway === 'away');
    const home = comp.competitors?.find(c => c.homeAway === 'home');
    if (!away || !home) continue;

    eventsSeen++;

    const when = new Date(
      event.date || comp.date || date + 'T12:00:00Z'
    );

    const gameDate = Number.isFinite(when.getTime())
      ? centralDate(when)
      : date;

    let g = games.find(
      x => String(x.espnId || '') === String(event.id)
    );

    if (!g) {
      const candidates = games.filter(
        x =>
          !x.espnId &&
          x.date &&
          daysApart(x.date, gameDate) <= 1 &&
          (
            (matches(x.away, away) && matches(x.home, home)) ||
            (matches(x.away, home) && matches(x.home, away))
          )
      );

      if (candidates.length > 1) {
        ambiguous++;
        console.warn(`AMBIGUOUS ESPN: ${event.id}`);
        continue;
      }

      if (candidates.length === 1) {
        g = candidates[0];
        linked++;

        const reversed =
          matches(g.away, home) && matches(g.home, away);

        if (reversed) {
          const oldAway = g.away;
          const oldHome = g.home;

          g.originalAway = oldAway;
          g.originalHome = oldHome;
          g.pregameOrientationMismatch = true;

          [g.awayML, g.homeML] = [g.homeML, g.awayML];

          for (const field of ['modelFavorite', 'marketFavorite']) {
            if (g[field] === oldAway) {
              g[field] = names(home)[0];
            } else if (g[field] === oldHome) {
              g[field] = names(away)[0];
            }
          }
        } else {
          for (const field of ['modelFavorite', 'marketFavorite']) {
            if (g[field] === g.away) {
              g[field] = names(away)[0];
            } else if (g[field] === g.home) {
              g[field] = names(home)[0];
            }
          }
        }

        g.away = names(away)[0];
        g.home = names(home)[0];
        g.site = comp.neutralSite ? 'Neutral' : 'Home';
      }
    }

    if (!g) {
      if (!rating(...names(away)) || !rating(...names(home))) {
        continue;
      }

      g = {
        id: `espn-${event.id}`,
        date: gameDate,
        away: names(away)[0],
        home: names(home)[0],
        site: comp.neutralSite ? 'Neutral' : 'Home',
        source: 'ESPN / The Odds API',
        modelFavorite: null,
        modelSpread: null,
        marketFavorite: null,
        marketSpread: null,
        awayML: null,
        homeML: null,
        awayScore: null,
        homeScore: null,
        status: 'scheduled'
      };

      games.push(g);
      added++;
    }

    g.espnId = String(event.id);

    if (away.team?.id) {
      g.espnAwayTeamId = String(away.team.id);
    }

    if (home.team?.id) {
      g.espnHomeTeamId = String(home.team.id);
    }

    if (!g.time && Number.isFinite(when.getTime())) {
      g.time = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(when);
    }

    const complete = Boolean(
      comp.status?.type?.completed ||
      event.status?.type?.completed
    );

    if (!complete && setModel(g, names(away), names(home), now)) {
      models++;
    }

    if (complete) {
      const as = away.score;
      const hs = home.score;

      if (
        as != null &&
        hs != null &&
        as !== '' &&
        hs !== '' &&
        Number.isFinite(Number(as)) &&
        Number.isFinite(Number(hs))
      ) {
        g.awayScore = Number(as);
        g.homeScore = Number(hs);
        g.status = 'final';
        finals++;
      }
    } else if (!isFinal(g)) {
      g.status = 'scheduled';
    }

    computeEdge(g);
  }
}

for (const g of games) {
  if (setModel(g, [], [], now)) models++;
  computeEdge(g);
}

// Match sportsbook names containing mascots to school names.
const schoolKeys = [
  ...new Set(ratings.map(r => key(r.team)))
].sort((a, b) => b.length - a.length);

function schoolName(raw) {
  const normalized = key(raw);

  if (rated.has(normalized)) return normalized;

  const hits = schoolKeys.filter(
    k => normalized.startsWith(k + ' ')
  );

  if (hits.length === 1) return hits[0];

  if (
    hits.length > 1 &&
    hits[0].length > hits[1].length
  ) {
    return hits[0];
  }

  return normalized;
}

function sameSchool(a, b) {
  const ka = schoolName(a);
  const kb = schoolName(b);

  return ka === kb ||
    (rating(a) && rating(b) && rating(a) === rating(b));
}

// Fetch and attach available sportsbook odds.
if (process.env.ODDS_API_KEY) {
  try {
    const url =
      'https://api.the-odds-api.com/v4/sports/' +
      'basketball_ncaab/odds/' +
      `?apiKey=${encodeURIComponent(process.env.ODDS_API_KEY)}` +
      '&regions=us' +
      '&markets=spreads,h2h' +
      '&oddsFormat=american' +
      '&dateFormat=iso';

    const res = await fetch(url);

    if (!res.ok) {
      throw Error(`HTTP ${res.status}`);
    }

    const odds = await res.json();

    let updated = 0;
    let already = 0;
    let unmatched = 0;
    let noSpread = 0;
    let ambiguousOdds = 0;
    let completed = 0;

    for (const o of odds) {
      const start = new Date(o.commence_time);

      if (!Number.isFinite(start.getTime())) continue;

      const date = centralDate(start);

      const candidates = games.filter(
        g =>
          g.date &&
          daysApart(g.date, date) <= 1 &&
          (
            (
              sameSchool(g.away, o.away_team) &&
              sameSchool(g.home, o.home_team)
            ) ||
            (
              sameSchool(g.away, o.home_team) &&
              sameSchool(g.home, o.away_team)
            )
          )
      );

      if (candidates.length === 0) {
        unmatched++;
        console.log(
          `ODDS UNMATCHED: ${date} ` +
          `${o.away_team} @ ${o.home_team}`
        );
        continue;
      }

      if (candidates.length !== 1) {
        ambiguousOdds++;
        console.log(
          `ODDS AMBIGUOUS: ${date} ` +
          `${o.away_team} @ ${o.home_team} ` +
          `(${candidates.length} matches)`
        );
        continue;
      }

      const g = candidates[0];

      if (isFinal(g)) {
        completed++;
        continue;
      }

      if (g.marketSpread != null) {
        already++;
        continue;
      }

      const books = [...(o.bookmakers || [])].sort(
        (a, b) =>
          (a.key === 'draftkings' ? -1 : 0) -
          (b.key === 'draftkings' ? -1 : 0)
      );

      let selected = null;
      let homeLine = null;

      for (const book of books) {
        const spread =
          book.markets?.find(m => m.key === 'spreads')
            ?.outcomes || [];

        const homeOutcome = spread.find(
          x => sameSchool(x.name, g.home)
        );

        if (
          homeOutcome &&
          homeOutcome.point != null &&
          Number.isFinite(Number(homeOutcome.point))
        ) {
          selected = book;
          homeLine = Number(homeOutcome.point);
          break;
        }
      }

      if (!selected) {
        noSpread++;
        console.log(
          `ODDS NO SPREAD: ${date} ` +
          `${o.away_team} @ ${o.home_team}`
        );
        continue;
      }

      g.marketFavorite =
        homeLine < 0 ? g.home :
        homeLine > 0 ? g.away :
        null;

      g.marketSpread = -Math.abs(homeLine);

      const money =
        selected.markets?.find(m => m.key === 'h2h')
          ?.outcomes || [];

      g.homeML =
        money.find(m => sameSchool(m.name, g.home))
          ?.price ?? g.homeML ?? null;

      g.awayML =
        money.find(m => sameSchool(m.name, g.away))
          ?.price ?? g.awayML ?? null;

      g.oddsBook = selected.title;
      g.oddsCapturedAt = now.toISOString();

      computeEdge(g);
      updated++;

      console.log(
        `ODDS SAVED: ${date} ${g.away} @ ${g.home}: ` +
        `${g.marketFavorite || 'PK'} ${g.marketSpread}`
      );
    }

    console.log(
      `ODDS: ${odds.length} events; ` +
      `saved ${updated}; ` +
      `already had lines ${already}; ` +
      `unmatched ${unmatched}; ` +
      `ambiguous ${ambiguousOdds}; ` +
      `no spread offered ${noSpread}; ` +
      `final games ${completed}.`
    );
  } catch (e) {
    console.warn('Odds unavailable:', e.message);
  }
} else {
  console.log('ODDS_API_KEY not set.');
}

// Prevent duplicate ESPN IDs.
const ids = games
  .filter(g => g.espnId)
  .map(g => String(g.espnId));

if (new Set(ids).size !== ids.length) {
  throw Error(
    'Duplicate ESPN IDs detected; refusing to publish.'
  );
}

write('games.json', games);

const noId = games.filter(g => !g.espnId);
const noModel = games.filter(g => g.modelSpread == null);

console.log(
  `SYNC: ESPN events ${eventsSeen}; ` +
  `added ${added}; linked ${linked}; ` +
  `finals seen ${finals}; ` +
  `new pregame models ${models}; ` +
  `ambiguous ${ambiguous}; ` +
  `saved ${games.length}.`
);

console.log(
  `COVERAGE: ${noId.length} without ESPN IDs; ` +
  `${noModel.length} without model predictions; ` +
  `${games.filter(isFinal).length} final games.`
);

for (const g of noId.slice(0, 20)) {
  console.log(
    `NO ESPN ID: ${g.date} ${g.away} @ ${g.home}`
  );
}
