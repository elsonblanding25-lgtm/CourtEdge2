
import fs from 'node:fs';

const base = new URL('../public/data/', import.meta.url);
const read = name => JSON.parse(
  fs.readFileSync(new URL(name, base), 'utf8')
);
const write = (name, data) => fs.writeFileSync(
  new URL(name, base),
  JSON.stringify(data, null, 2) + '\n'
);

const games = read('games.json');
const ratings = read('ratings.json').filter(
  r => Number.isInteger(r.rank) && Number.isFinite(r.bqNet)
);
const efficiency = ratings.map(r => r.bqNet).sort((a, b) => b - a);
const now = new Date();

// IMPORTANT: "St" means State by default.
// "Saint" is handled through explicit aliases.
const aliases = {
  'app st': 'appalachian state',
  'app state': 'appalachian state',
  'arizona st': 'arizona state',
  'arkansas st': 'arkansas state',
  'ball st': 'ball state',
  'boise st': 'boise state',
  'cal baptist': 'california baptist',
  'cal st northridge': 'cal state northridge',
  'chicago st': 'chicago state',
  'c connecticut': 'central connecticut',
  'central conn': 'central connecticut',
  'csu northridge': 'cal state northridge',
  'e michigan': 'eastern michigan',
  'e illinois': 'eastern illinois',
  'east tennessee st': 'east tennessee state',
  'etsu': 'east tennessee state',
  'fau': 'florida atlantic',
  'fgcu': 'florida gulf coast',
  'florida st': 'florida state',
  'g washington': 'george washington',
  'georgia st': 'georgia state',
  'gw': 'george washington',
  'idaho st': 'idaho state',
  'indiana st': 'indiana state',
  'jackson st': 'jackson state',
  'jacksonville st': 'jacksonville state',
  'kansas st': 'kansas state',
  'kent st': 'kent state',
  'liu': 'long island',
  'loyola chi': 'loyola chicago',
  'loyola md': 'loyola maryland',
  'mcneese': 'mcneese state',
  'miami fl': 'miami florida',
  'miami fla': 'miami florida',
  'miami oh': 'miami ohio',
  'mississippi st': 'mississippi state',
  'michigan st': 'michigan state',
  'middle tennessee st': 'middle tennessee',
  'n colorado': 'northern colorado',
  'n dakota': 'north dakota',
  'n dakota st': 'north dakota state',
  'n illinois': 'northern illinois',
  'n iowa': 'northern iowa',
  'n kentucky': 'northern kentucky',
  'n texas': 'north texas',
  'nc st': 'north carolina state',
  'north carolina st': 'north carolina state',
  'northwestern st': 'northwestern state',
  'ole miss': 'mississippi',
  'oregon st': 'oregon state',
  'penn': 'pennsylvania',
  'purdue fort wayne': 'fort wayne',
  's dakota': 'south dakota',
  's dakota st': 'south dakota state',
  's florida': 'south florida',
  's illinois': 'southern illinois',
  'se missouri st': 'southeast missouri state',
  'southern miss': 'southern mississippi',
  'st bonaventure': 'saint bonaventure',
  'st johns': 'saint johns',
  'st josephs': 'saint josephs',
  'st marys': 'saint marys',
  'st peters': 'saint peters',
  'st thomas': 'saint thomas',
  'st thomas mn': 'saint thomas',
  'tarleton st': 'tarleton state',
  'tennessee st': 'tennessee state',
  'texas st': 'texas state',
  'uconn': 'connecticut',
  'ucf': 'central florida',
  'unc': 'north carolina',
  'uncw': 'unc wilmington',
  'umass': 'massachusetts',
  'umkc': 'kansas city',
  'ut martin': 'tennessee martin',
  'usc upstate': 'south carolina upstate',
  'w michigan': 'western michigan',
  'wright st': 'wright state',
  'youngstown st': 'youngstown state'
};

function clean(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value) {
  let n = clean(value);
  if (aliases[n]) return aliases[n];

  // Convert abbreviated "St" to State, not Saint.
  n = n.replace(/\bst\b/g, 'state');

  return aliases[n] || n;
}

const rated = new Map(
  ratings.map(r => [normalize(r.team), r])
);

function rating(...names) {
  for (const name of names) {
    const found = rated.get(normalize(name));
    if (found) return found;
  }
  return null;
}

// Recognize sportsbook names with mascot suffixes.
// Prefer the longest school name to avoid Michigan/Michigan State.
const schoolNames = [...new Set([
  ...ratings.map(r => normalize(r.team)),
  ...games.flatMap(g => [
    normalize(g.away),
    normalize(g.home)
  ]),
  ...Object.values(aliases).map(normalize)
].filter(Boolean))].sort((a, b) => b.length - a.length);

const schoolSet = new Set(schoolNames);

function schoolName(raw) {
  const n = normalize(raw);
  if (schoolSet.has(n)) return n;

  const matches = schoolNames.filter(
    school => n.startsWith(school + ' ')
  );

  return matches[0] || n;
}

function sameSchool(a, b) {
  const x = schoolName(a);
  const y = schoolName(b);

  if (x === y) return true;

  const ra = rating(a, x);
  const rb = rating(b, y);

  return Boolean(ra && rb && ra === rb);
}

function centralDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const p = Object.fromEntries(
    parts.map(item => [item.type, item.value])
  );

  return `${p.year}-${p.month}-${p.day}`;
}

function isFinal(g) {
  return g.status === 'final' ||
    (Number.isFinite(g.awayScore) &&
     Number.isFinite(g.homeScore));
}

function competitorNames(c) {
  return [
    c.team?.shortDisplayName,
    c.team?.displayName,
    c.team?.name,
    c.team?.location
  ].filter(Boolean);
}

function competitorMatches(name, competitor) {
  return competitorNames(competitor).some(
    n => sameSchool(name, n)
  );
}

function setModel(g, awayNames = [], homeNames = []) {
  if (g.modelSpread != null || g.modelFavorite) return false;
  if (isFinal(g)) return false;
  if (!g.date || g.date < centralDate(now)) return false;

  const away = rating(g.away, ...awayNames);
  const home = rating(g.home, ...homeNames);

  if (!away || !home) return false;

  const av = efficiency[away.rank - 1];
  const hv = efficiency[home.rank - 1];

  if (!Number.isFinite(av) || !Number.isFinite(hv)) {
    return false;
  }

  const margin = 0.7 * (hv - av) +
    (g.site === 'Neutral' ? 0 : 3);

  g.modelFavorite = margin >= 0 ? g.home : g.away;
  g.modelSpread = -Math.round(Math.abs(margin) * 10) / 10;
  g.modelGeneratedAt = now.toISOString();

  return true;
}

function computeEdge(g) {
  if (
    g.modelSpread == null ||
    g.marketSpread == null ||
    !g.modelFavorite ||
    !g.marketFavorite
  ) return;

  const modelHome = sameSchool(g.modelFavorite, g.home)
    ? -Math.abs(g.modelSpread)
    : Math.abs(g.modelSpread);

  const marketHome = sameSchool(g.marketFavorite, g.home)
    ? -Math.abs(g.marketSpread)
    : Math.abs(g.marketSpread);

  g.edge = Math.round(
    Math.abs(modelHome - marketHome) * 10
  ) / 10;

  g.confidence = Math.min(
    5,
    1 + [3, 6, 10, 15].filter(
      threshold => g.edge >= threshold
    ).length
  );
}

// ESPN SCORE AND SCHEDULE SYNC
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
      const url =
        'https://site.api.espn.com/apis/site/v2/sports/' +
        'basketball/mens-college-basketball/scoreboard' +
        `?dates=${stamp}&limit=500${suffix}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();

      for (const event of payload.events || []) {
        events.set(String(event.id), event);
      }
    } catch (error) {
      console.warn(`ESPN ${date}: ${error.message}`);
    }
  }

  for (const event of events.values()) {
    if (seen.has(String(event.id))) continue;
    seen.add(String(event.id));

    const competition = event.competitions?.[0];
    if (!competition) continue;

    const away = competition.competitors?.find(
      c => c.homeAway === 'away'
    );
    const home = competition.competitors?.find(
      c => c.homeAway === 'home'
    );

    if (!away || !home) continue;

    eventsSeen++;

    const when = new Date(
      event.date || competition.date ||
      date + 'T12:00:00Z'
    );
    const gameDate = Number.isFinite(when.getTime())
      ? centralDate(when)
      : date;

    let game = games.find(
      g => String(g.espnId || '') === String(event.id)
    );

    if (!game) {
      const candidates = games.filter(
        g => !g.espnId &&
          g.date === gameDate &&
          (
            (
              competitorMatches(g.away, away) &&
              competitorMatches(g.home, home)
            ) ||
            (
              competitorMatches(g.away, home) &&
              competitorMatches(g.home, away)
            )
          )
      );

      if (candidates.length > 1) {
        ambiguous++;
        console.warn(`ESPN AMBIGUOUS: ${event.id}`);
        continue;
      }

      if (candidates.length === 1) {
        game = candidates[0];
        linked++;

        const reversed =
          competitorMatches(game.away, home) &&
          competitorMatches(game.home, away);

        const oldAway = game.away;
        const oldHome = game.home;

        if (reversed) {
          game.originalAway = oldAway;
          game.originalHome = oldHome;
          game.pregameOrientationMismatch = true;

          [game.awayML, game.homeML] =
            [game.homeML, game.awayML];
        }

        for (const field of ['modelFavorite', 'marketFavorite']) {
          if (sameSchool(game[field], oldAway)) {
            game[field] = competitorNames(away)[0] &&
              (reversed
                ? competitorNames(home)[0]
                : competitorNames(away)[0]);
          } else if (sameSchool(game[field], oldHome)) {
            game[field] = reversed
              ? competitorNames(away)[0]
              : competitorNames(home)[0];
          }
        }

        game.away = competitorNames(away)[0];
        game.home = competitorNames(home)[0];
        game.site = competition.neutralSite ? 'Neutral' : 'Home';
      }
    }

    if (!game) {
      if (
        !rating(...competitorNames(away)) ||
        !rating(...competitorNames(home))
      ) continue;

      game = {
        id: `espn-${event.id}`,
        date: gameDate,
        away: competitorNames(away)[0],
        home: competitorNames(home)[0],
        site: competition.neutralSite ? 'Neutral' : 'Home',
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

      games.push(game);
      added++;
    }

    game.espnId = String(event.id);
    game.espnAwayTeamId = String(away.team?.id || '');
    game.espnHomeTeamId = String(home.team?.id || '');

    if (!game.time && Number.isFinite(when.getTime())) {
      game.time = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Chicago',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(when);
    }

    const complete = Boolean(
      competition.status?.type?.completed ||
      event.status?.type?.completed
    );

    if (
      !complete &&
      when > now &&
      setModel(
        game,
        competitorNames(away),
        competitorNames(home)
      )
    ) models++;

    if (complete) {
      const as = away.score;
      const hs = home.score;

      if (
        as != null && hs != null &&
        as !== '' && hs !== '' &&
        Number.isFinite(Number(as)) &&
        Number.isFinite(Number(hs))
      ) {
        game.awayScore = Number(as);
        game.homeScore = Number(hs);
        game.status = 'final';
        finals++;
      }
    } else if (!isFinal(game)) {
      game.status = 'scheduled';
    }

    computeEdge(game);
  }
}

for (const game of games) {
  if (setModel(game)) models++;
  computeEdge(game);
}

// THE ODDS API
if (process.env.ODDS_API_KEY) {
  try {
    const url =
      'https://api.the-odds-api.com/v4/sports/' +
      'basketball_ncaab/odds/' +
      `?apiKey=${encodeURIComponent(process.env.ODDS_API_KEY)}` +
      '&regions=us&markets=spreads,h2h' +
      '&oddsFormat=american&dateFormat=iso';

    const response = await fetch(url);

    if (!response.ok) {
      throw Error(`HTTP ${response.status}`);
    }

    const odds = await response.json();

    let saved = 0;
    let already = 0;
    let unmatched = 0;
    let ambiguousOdds = 0;
    let noSpread = 0;
    let completed = 0;

    for (const event of odds) {
      const startTime = new Date(event.commence_time);

      if (!Number.isFinite(startTime.getTime())) continue;

      const date = centralDate(startTime);

      // Require the exact game date and both school identities.
      const candidates = games.filter(
        g => g.date === date &&
          (
            (
              sameSchool(g.away, event.away_team) &&
              sameSchool(g.home, event.home_team)
            ) ||
            (
              sameSchool(g.away, event.home_team) &&
              sameSchool(g.home, event.away_team)
            )
          )
      );

      if (candidates.length === 0) {
        unmatched++;

        const sameDate = games.filter(g => g.date === date);
        const closest = sameDate.filter(
          g =>
            sameSchool(g.away, event.away_team) ||
            sameSchool(g.home, event.home_team) ||
            sameSchool(g.away, event.home_team) ||
            sameSchool(g.home, event.away_team)
        ).slice(0, 3);

        console.log(
          `ODDS UNMATCHED: ${date} ` +
          `${event.away_team} @ ${event.home_team}` +
          ` [${schoolName(event.away_team)} @ ` +
          `${schoolName(event.home_team)}]`
        );

        for (const g of closest) {
          console.log(
            `  CLOSEST: ${g.away} @ ${g.home} (${g.date})`
          );
        }

        continue;
      }

      if (candidates.length !== 1) {
        ambiguousOdds++;
        console.log(
          `ODDS AMBIGUOUS: ${date} ` +
          `${event.away_team} @ ${event.home_team}` +
          ` (${candidates.length} candidates)`
        );
        continue;
      }

      const game = candidates[0];

      if (isFinal(game)) {
        completed++;
        continue;
      }

      if (game.marketSpread != null) {
        already++;
        continue;
      }

      const books = [...(event.bookmakers || [])].sort(
        (a, b) =>
          Number(b.key === 'draftkings') -
          Number(a.key === 'draftkings')
      );

      let chosen = null;
      let homeLine = null;

      for (const book of books) {
        const outcomes = book.markets?.find(
          m => m.key === 'spreads'
        )?.outcomes || [];

        const home = outcomes.find(
          o => sameSchool(o.name, game.home)
        );
        const away = outcomes.find(
          o => sameSchool(o.name, game.away)
        );

        if (
          !home || !away ||
          home.point == null || away.point == null
        ) continue;

        const hp = Number(home.point);
        const ap = Number(away.point);

        if (
          !Number.isFinite(hp) ||
          !Number.isFinite(ap) ||
          Math.abs(hp + ap) > 0.01
        ) continue;

        chosen = book;
        homeLine = hp;
        break;
      }

      if (!chosen) {
        noSpread++;
        console.log(
          `ODDS NO SPREAD: ${date} ` +
          `${event.away_team} @ ${event.home_team}`
        );
        continue;
      }

      game.marketFavorite =
        homeLine < 0 ? game.home :
        homeLine > 0 ? game.away : null;

      game.marketSpread = -Math.abs(homeLine);

      const money = chosen.markets?.find(
        m => m.key === 'h2h'
      )?.outcomes || [];

      game.homeML = money.find(
        m => sameSchool(m.name, game.home)
      )?.price ?? game.homeML ?? null;

      game.awayML = money.find(
        m => sameSchool(m.name, game.away)
      )?.price ?? game.awayML ?? null;

      game.oddsBook = chosen.title;
      game.oddsCapturedAt = now.toISOString();

      computeEdge(game);
      saved++;

      console.log(
        `ODDS SAVED: ${date} ` +
        `${game.away} @ ${game.home}: ` +
        `${game.marketFavorite || 'PK'} ${game.marketSpread}`
      );
    }

    console.log(
      `ODDS: ${odds.length} events; ` +
      `saved ${saved}; already had lines ${already}; ` +
      `unmatched ${unmatched}; ambiguous ${ambiguousOdds}; ` +
      `no spread offered ${noSpread}; final games ${completed}.`
    );
  } catch (error) {
    console.warn(`Odds unavailable: ${error.message}`);
  }
} else {
  console.log('ODDS_API_KEY not set.');
}

// VALIDATION AND SAVE
const ids = games.filter(g => g.espnId).map(
  g => String(g.espnId)
);

if (new Set(ids).size !== ids.length) {
  throw Error('Duplicate ESPN IDs. Refusing to publish.');
}

write('games.json', games);

console.log(
  `SYNC: ESPN events ${eventsSeen}; added ${added}; ` +
  `linked ${linked}; finals seen ${finals}; ` +
  `new pregame models ${models}; ambiguous ${ambiguous}; ` +
  `saved ${games.length}.`
);

console.log(
  `COVERAGE: ${games.filter(g => !g.espnId).length} ` +
  `without ESPN IDs; ` +
  `${games.filter(g => g.modelSpread == null).length} ` +
  `without model predictions; ` +
  `${games.filter(isFinal).length} final games.`
);

for (const g of games.filter(g => !g.espnId).slice(0, 20)) {
  console.log(
    `NO ESPN ID: ${g.date} ${g.away} @ ${g.home}`
  );
}
