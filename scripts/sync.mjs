
import fs from 'node:fs';

const base = new URL('../public/data/', import.meta.url);

function read(name, fallback = null) {
  const file = new URL(name, base);
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : fallback;
}

function write(name, data) {
  fs.writeFileSync(
    new URL(name, base),
    JSON.stringify(data, null, 2) + '\n'
  );
}

const published = read('games.json', []);
const archive = read('games_archive.json', []);
const ratings = read('ratings.json', []).filter(
  r => Number.isInteger(r.rank) &&
       Number.isFinite(r.bqNet)
);

if (!Array.isArray(published) ||
    !Array.isArray(archive) ||
    ratings.length < 300) {
  throw Error('Missing or invalid CourtEdge data.');
}

const now = new Date();

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

// Every abbreviation is mapped to an explicit school.
// Do not globally replace "St" with "State" or "Saint".
const aliases = {
  'ualbany': 'albany',
  'albany': 'albany',
  'app st': 'appalachian state',
  'app state': 'appalachian state',
  'arizona st': 'arizona state',
  'arkansas st': 'arkansas state',
  'arkansas little rock': 'little rock',
  'little rock': 'little rock',
  'ualr': 'little rock',
  'ball st': 'ball state',
  'bethune': 'bethune cookman',
  'bethune cookman': 'bethune cookman',
  'boise st': 'boise state',
  'c arkansas': 'central arkansas',
  'central arkansas': 'central arkansas',
  'c connecticut': 'central connecticut',
  'central conn': 'central connecticut',
  'ca baptist': 'california baptist',
  'cal baptist': 'california baptist',
  'cal st northridge': 'cal state northridge',
  'csu northridge': 'cal state northridge',
  'charleston': 'college of charleston',
  'college of charleston': 'college of charleston',
  'chicago st': 'chicago state',
  'coastal': 'coastal carolina',
  'detroit': 'detroit mercy',
  'e illinois': 'eastern illinois',
  'e michigan': 'eastern michigan',
  'e washington': 'eastern washington',
  'east tennessee st': 'east tennessee state',
  'etsu': 'east tennessee state',
  'fau': 'florida atlantic',
  'fgcu': 'florida gulf coast',
  'florida st': 'florida state',
  'ga southern': 'georgia southern',
  'g washington': 'george washington',
  'gw': 'george washington',
  'georgia st': 'georgia state',
  'idaho st': 'idaho state',
  'indiana st': 'indiana state',
  'jackson st': 'jackson state',
  'jax state': 'jacksonville state',
  'jacksonville st': 'jacksonville state',
  'kansas st': 'kansas state',
  'kent st': 'kent state',
  'liu': 'long island',
  'louisiana lafayette': 'louisiana',
  'ul lafayette': 'louisiana',
  'ul louisiana': 'louisiana',
  'louisiana': 'louisiana',
  'loyola chi': 'loyola chicago',
  'loyola md': 'loyola maryland',
  'mcneese': 'mcneese state',
  'miami fl': 'miami florida',
  'miami fla': 'miami florida',
  'miami oh': 'miami ohio',
  'michigan st': 'michigan state',
  'mississippi st': 'mississippi state',
  'mtsu': 'middle tennessee',
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
  'n western st': 'northwestern state',
  'nwestern st': 'northwestern state',
  'northwestern st': 'northwestern state',
  'ole miss': 'mississippi',
  'oregon st': 'oregon state',
  'penn': 'pennsylvania',
  'pitt': 'pittsburgh',
  'purdue fort wayne': 'fort wayne',
  's dakota': 'south dakota',
  's dakota st': 'south dakota state',
  's florida': 'south florida',
  's illinois': 'southern illinois',
  's indiana': 'southern indiana',
  'se missouri st': 'southeast missouri state',
  'southern miss': 'southern mississippi',
  'st bonaventure': 'saint bonaventure',
  'st johns': 'saint johns',
  'st josephs': 'saint josephs',
  'st marys': 'saint marys',
  'st peters': 'saint peters',
  'st thomas': 'saint thomas',
  'st thomas mn': 'saint thomas',
  'saint thomas mn': 'saint thomas',
  'tarleton st': 'tarleton state',
  'tennessee st': 'tennessee state',
  'texas st': 'texas state',
  'ucf': 'central florida',
  'uconn': 'connecticut',
  'unc': 'north carolina',
  'uncw': 'unc wilmington',
  'umass': 'massachusetts',
  'umkc': 'kansas city',
  'ut martin': 'tennessee martin',
  'usc upstate': 'south carolina upstate',
  'w carolina': 'western carolina',
  'w michigan': 'western michigan',
  'wright st': 'wright state',
  'youngstown st': 'youngstown state'
};

const specialAliases = {
  'mcneese cowboys': 'mcneese state',
  'liu sharks': 'long island',
  'albany great danes': 'albany',
  'buffalo bulls': 'buffalo',
  'northwestern st demons': 'northwestern state',
  'coastal carolina chanticleers': 'coastal carolina',
  'jacksonville st gamecocks': 'jacksonville state',
  'west georgia wolves': 'west georgia',
  'loyola chi ramblers': 'loyola chicago',
  'bethune cookman wildcats': 'bethune cookman',
  'eastern washington eagles': 'eastern washington',
  'georgia southern eagles': 'georgia southern',
  'ucf knights': 'central florida',
  'detroit mercy titans': 'detroit mercy',
  'southern miss golden eagles': 'southern mississippi',
  'uconn huskies': 'connecticut',
  'st thomas mn tommies': 'saint thomas',
  'saint thomas mn tommies': 'saint thomas',
  'central arkansas bears': 'central arkansas',
  'ole miss rebels': 'mississippi',
  'southern illinois salukis': 'southern illinois',
  'umkc kangaroos': 'kansas city',
  'n colorado bears': 'northern colorado',
  'csu northridge matadors': 'cal state northridge',
  'middle tennessee blue raiders': 'middle tennessee',
  'cal baptist lancers': 'california baptist',
  'tarleton state texans': 'tarleton state',
  'north dakota st bison': 'north dakota state',
  'vmi keydets': 'vmi',
  'smu mustangs': 'smu',
  'byu cougars': 'byu',
  'uic flames': 'uic',
  'wright st raiders': 'wright state'
};

function canonical(value) {
  const n = clean(value);
  return specialAliases[n] || aliases[n] || n;
}

// Explicitly recognized DI programs that may be absent
// from the ratings roster or represented differently.
const additionalDI = [
  'little rock',
  'western carolina',
  'southern indiana',
  'louisiana',
  'college of charleston',
  'central arkansas',
  'west georgia',
  'mercyhurst',
  'le moyne'
];

const diNames = new Set([
  ...ratings.map(r => canonical(r.team)),
  ...additionalDI.map(canonical)
]);

// Mascot removal is permitted only for known mascot
// suffixes, rather than arbitrary extra words.
const mascotSuffixes = [
  'great danes',
  'mean green',
  'blue devils',
  'red raiders',
  'golden eagles',
  'fighting illini',
  'chanticleers',
  'musketeers',
  'mountaineers',
  'gamecocks',
  'colonials',
  'mavericks',
  'panthers',
  'wildcats',
  'bulldogs',
  'cardinals',
  'cowboys',
  'cougars',
  'jaguars',
  'mustangs',
  'warriors',
  'raiders',
  'knights',
  'eagles',
  'falcons',
  'demons',
  'tommies',
  'rebels',
  'sharks',
  'bears',
  'bulls',
  'ducks',
  'dons',
  'bison',
  'owls',
  'flames',
  'titans',
  'hawks',
  'lancers',
  'broncos',
  'rams',
  'wolves',
  'zips',
  'ragin cajuns',
  'keydets',
  'toreros',
  'terriers',
  'penguins',
  'huskies',
  'matadors',
  'salukis',
  'jaspers',
  'quakers',
  'aggies',
  'texans',
  'bengals',
  'cyclones',
  'hoosiers',
  'trojans',
  'beavers',
  'yellow jackets',
  'golden gophers',
  'blue raiders',
  'wolfpack',
  'redhawks',
  'thunderbirds',
  'pirates',
  'spartans',
  'lions'
].sort((a, b) => b.length - a.length);

function schoolName(raw) {
  const original = clean(raw);
  if (!original) return '';

  let n = canonical(original);

  if (diNames.has(n)) return n;

  // A known mascot can be removed only when the
  // remaining name resolves to a recognized DI school.
  for (const mascot of mascotSuffixes) {
    if (!original.endsWith(' ' + mascot)) continue;

    const candidate = canonical(
      original.slice(0, -mascot.length - 1)
    );

    if (diNames.has(candidate)) return candidate;
  }

  return n;
}

function sameSchool(a, b) {
  const x = schoolName(a);
  const y = schoolName(b);
  return Boolean(x && y && x === y);
}

function isDI(name) {
  return diNames.has(schoolName(name));
}

function isDIGame(g) {
  return isDI(g.away) && isDI(g.home);
}

// Merge the published games into the archive without
// replacing records containing historical information.
const games = [...archive];

function gameIdentity(g) {
  if (g.espnId) return `espn:${g.espnId}`;
  if (g.id) return `id:${g.id}`;
  return `${g.date}|${schoolName(g.away)}|${schoolName(g.home)}`;
}

const known = new Set(games.map(gameIdentity));

for (const g of published) {
  const id = gameIdentity(g);
  if (!known.has(id)) {
    games.push(g);
    known.add(id);
  }
}

const rated = new Map(
  ratings.map(r => [schoolName(r.team), r])
);

const efficiency = ratings
  .map(r => r.bqNet)
  .sort((a, b) => b - a);

function rating(...names) {
  for (const name of names) {
    const r = rated.get(schoolName(name));
    if (r) return r;
  }
  return null;
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
    (
      Number.isFinite(g.awayScore) &&
      Number.isFinite(g.homeScore)
    );
}

function competitorNames(c) {
  return [
    c.team?.shortDisplayName,
    c.team?.displayName,
    c.team?.location,
    c.team?.name
  ].filter(Boolean);
}

function competitorMatches(name, c) {
  return competitorNames(c).some(
    n => sameSchool(name, n)
  );
}

function competitorDI(c) {
  return competitorNames(c).some(isDI);
}

function setModel(g, awayNames = [], homeNames = []) {
  if (g.modelSpread != null || g.modelFavorite) return false;
  if (isFinal(g) || !isDIGame(g)) return false;
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
  g.modelSpread =
    -Math.round(Math.abs(margin) * 10) / 10;
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

  const home = schoolName(g.home);
  const away = schoolName(g.away);
  const mf = schoolName(g.modelFavorite);
  const sf = schoolName(g.marketFavorite);

  if (![home, away].includes(mf)) return;
  if (![home, away].includes(sf)) return;

  const modelHome = mf === home
    ? -Math.abs(g.modelSpread)
    : Math.abs(g.modelSpread);

  const marketHome = sf === home
    ? -Math.abs(g.marketSpread)
    : Math.abs(g.marketSpread);

  // Preserve historical recorded edges.
  if (g.edge != null && g.confidence != null) return;

  g.edge = Math.round(
    Math.abs(modelHome - marketHome) * 10
  ) / 10;

  g.confidence = Math.min(
    5,
    1 + [3, 6, 10, 15].filter(
      t => g.edge >= t
    ).length
  );
}

// ESPN sync
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
let skippedNonDI = 0;

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

      for (const e of payload.events || []) {
        events.set(String(e.id), e);
      }
    } catch (error) {
      console.warn(`ESPN ${date}: ${error.message}`);
    }
  }

  for (const event of events.values()) {
    if (seen.has(String(event.id))) continue;
    seen.add(String(event.id));

    const comp = event.competitions?.[0];
    if (!comp) continue;

    const away = comp.competitors?.find(
      c => c.homeAway === 'away'
    );
    const home = comp.competitors?.find(
      c => c.homeAway === 'home'
    );

    if (!away || !home) continue;
    eventsSeen++;

    if (!competitorDI(away) || !competitorDI(home)) {
      skippedNonDI++;
      continue;
    }

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
          x.date === gameDate &&
          (
            (
              competitorMatches(x.away, away) &&
              competitorMatches(x.home, home)
            ) ||
            (
              competitorMatches(x.away, home) &&
              competitorMatches(x.home, away)
            )
          )
      );

      if (candidates.length > 1) {
        ambiguous++;
        console.warn(`ESPN AMBIGUOUS: ${event.id}`);
        continue;
      }

      if (candidates.length === 1) {
        g = candidates[0];
        linked++;

        const oldAway = g.away;
        const oldHome = g.home;
        const newAway = competitorNames(away)[0];
        const newHome = competitorNames(home)[0];

        const reversed =
          competitorMatches(oldAway, home) &&
          competitorMatches(oldHome, away);

        if (reversed) {
          g.originalAway = oldAway;
          g.originalHome = oldHome;
          g.pregameOrientationMismatch = true;
          [g.awayML, g.homeML] =
            [g.homeML, g.awayML];
        }

        for (const field of [
          'modelFavorite',
          'marketFavorite'
        ]) {
          if (sameSchool(g[field], newAway)) {
            g[field] = newAway;
          } else if (sameSchool(g[field], newHome)) {
            g[field] = newHome;
          }
        }

        g.away = newAway;
        g.home = newHome;
        g.site = comp.neutralSite ? 'Neutral' : 'Home';
      }
    }

    if (!g) {
      g = {
        id: `espn-${event.id}`,
        date: gameDate,
        away: competitorNames(away)[0],
        home: competitorNames(home)[0],
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

    if (
      !complete &&
      when > now &&
      setModel(
        g,
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
  if (setModel(g)) models++;
  computeEdge(g);
}

// Sportsbook odds
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
    let nonDI = 0;

    for (const event of odds) {
      const startTime = new Date(event.commence_time);
      if (!Number.isFinite(startTime.getTime())) continue;

      if (!isDI(event.away_team) || !isDI(event.home_team)) {
        nonDI++;
        continue;
      }

      const date = centralDate(startTime);

      const candidates = games.filter(
        g =>
          isDIGame(g) &&
          g.date === date &&
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
        console.log(
          `ODDS UNMATCHED: ${date} ` +
          `${event.away_team} @ ${event.home_team}`
        );

        const closest = games.filter(
          g =>
            g.date === date &&
            (
              sameSchool(g.away, event.away_team) ||
              sameSchool(g.home, event.home_team) ||
              sameSchool(g.away, event.home_team) ||
              sameSchool(g.home, event.away_team)
            )
        ).slice(0, 3);

        for (const g of closest) {
          console.log(`  CLOSEST: ${g.away} @ ${g.home}`);
        }
        continue;
      }

      if (candidates.length !== 1) {
        ambiguousOdds++;
        console.log(
          `ODDS AMBIGUOUS: ${date} ` +
          `${event.away_team} @ ${event.home_team}`
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

      const books = [...(event.bookmakers || [])].sort(
        (a, b) =>
          Number(b.key === 'draftkings') -
          Number(a.key === 'draftkings')
      );

      let selected = null;
      let homeLine = null;

      for (const book of books) {
        const spread = book.markets?.find(
          m => m.key === 'spreads'
        )?.outcomes || [];

        const home = spread.find(
          o => sameSchool(o.name, g.home)
        );
        const away = spread.find(
          o => sameSchool(o.name, g.away)
        );

        if (
          !home || !away ||
          home.point == null ||
          away.point == null
        ) continue;

        const hp = Number(home.point);
        const ap = Number(away.point);

        if (
          !Number.isFinite(hp) ||
          !Number.isFinite(ap) ||
          Math.abs(hp + ap) > 0.01
        ) continue;

        selected = book;
        homeLine = hp;
        break;
      }

      if (!selected) {
        noSpread++;
        continue;
      }

      g.marketFavorite =
        homeLine < 0 ? g.home :
        homeLine > 0 ? g.away : null;

      g.marketSpread = -Math.abs(homeLine);

      const money = selected.markets?.find(
        m => m.key === 'h2h'
      )?.outcomes || [];

      g.homeML = money.find(
        m => sameSchool(m.name, g.home)
      )?.price ?? g.homeML ?? null;

      g.awayML = money.find(
        m => sameSchool(m.name, g.away)
      )?.price ?? g.awayML ?? null;

      g.oddsBook = selected.title;
      g.oddsCapturedAt = now.toISOString();

      computeEdge(g);
      saved++;

      console.log(
        `ODDS SAVED: ${date} ${g.away} @ ${g.home}: ` +
        `${g.marketFavorite || 'PK'} ${g.marketSpread}`
      );
    }

    console.log(
      `ODDS: ${odds.length} events; ` +
      `saved ${saved}; already had lines ${already}; ` +
      `unmatched ${unmatched}; ambiguous ${ambiguousOdds}; ` +
      `no spread offered ${noSpread}; ` +
      `final games ${completed}; non-DI excluded ${nonDI}.`
    );
  } catch (error) {
    console.warn(`Odds unavailable: ${error.message}`);
  }
} else {
  console.log('ODDS_API_KEY not set.');
}

// Validate and publish
const ids = games
  .filter(g => g.espnId)
  .map(g => String(g.espnId));

if (new Set(ids).size !== ids.length) {
  throw Error('Duplicate ESPN IDs. Refusing to publish.');
}

const diGames = games.filter(isDIGame);
const excluded = games.filter(g => !isDIGame(g));

write('games_archive.json', games);
write('games.json', diGames);

console.log(
  `SYNC: ESPN events ${eventsSeen}; added ${added}; ` +
  `linked ${linked}; finals seen ${finals}; ` +
  `new pregame models ${models}; ambiguous ${ambiguous}; ` +
  `ESPN non-DI skipped ${skippedNonDI}.`
);

console.log(
  `DI FILTER: ${games.length} total archived; ` +
  `${diGames.length} published DI games; ` +
  `${excluded.length} excluded from website.`
);

console.log(
  `COVERAGE: ` +
  `${diGames.filter(g => !g.espnId).length} without ESPN IDs; ` +
  `${diGames.filter(g => g.modelSpread == null).length} without models; ` +
  `${diGames.filter(isFinal).length} final DI games.`
);

for (const g of excluded.slice(0, 30)) {
  console.log(
    `EXCLUDED: ${g.date} ${g.away} @ ${g.home} ` +
    `[away DI=${isDI(g.away)}, home DI=${isDI(g.home)}]`
  );
}
