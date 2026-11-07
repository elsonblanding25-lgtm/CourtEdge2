
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
const statsInput = read('team_stats.json', []); // Optional matchup statistics
const ratings = read('ratings.json', []).filter(
  r => Number.isInteger(r.rank) &&
       Number.isFinite(r.bqNet)
);

if (!Array.isArray(published) ||
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
  'kansas city': 'kansas city',
  'texas a and m cc': 'texas a and m corpus christi',
  'texas a m cc': 'texas a and m corpus christi',
  'texas a and m corpus christi': 'texas a and m corpus christi',
  'texas a m corpus christi': 'texas a and m corpus christi',
  'abilene chrstn': 'abilene christian',
  'nc central': 'north carolina central',
  'n carolina central': 'north carolina central',
  'purdue fw': 'fort wayne',
  'fort wayne': 'fort wayne',
  'montana st': 'montana state',
  'colorado st': 'colorado state',
  'washington st': 'washington state',
  'oklahoma st': 'oklahoma state',
  'illinois st': 'illinois state',
  'alabama st': 'alabama state',
  'delaware st': 'delaware state',
  'san diego st': 'san diego state',
  'new mexico st': 'new mexico state',
  'portland st': 'portland state',
  'texas a m cc islanders': 'texas a and m corpus christi',
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
  'wright st raiders': 'wright state',
  'lamar cardinals': 'lamar',
  'abilene christian wildcats': 'abilene christian',
  'north carolina central eagles': 'north carolina central',
  'longwood lancers': 'longwood'
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
  'le moyne',
  'kansas city',
  'texas a and m corpus christi',
  'washington state',
  'oklahoma state',
  'montana state',
  'colorado state',
  'illinois state',
  'fort wayne',
  'alabama state',
  'delaware state',
  'san diego state',
  'new mexico state',
  'portland state',
  'abilene christian',
  'north carolina central',
  'lamar',
  'longwood'
];

const diNames = new Set([
  ...ratings.map(r => canonical(r.team)),
  ...additionalDI.map(canonical)
]);

// Only remove known mascot suffixes.
// This prevents non-DI schools such as Southern Wesleyan
// from being mistaken for Southern University.
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

  const n = canonical(original);

  if (diNames.has(n)) return n;

  // Strip a mascot only if the resulting school
  // is already recognized as Division I.
  for (const mascot of mascotSuffixes) {
    if (!original.endsWith(' ' + mascot)) continue;

    const candidate = canonical(
      original.slice(0, -mascot.length - 1)
    );

    if (diNames.has(candidate)) {
      return candidate;
    }
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

// Development mode: no games_archive.json required.
const games = [];

function gameIdentity(g) {
  if (g.espnId) return `espn:${g.espnId}`;
  if (g.id) return `id:${g.id}`;

  return (
    `${g.date}|${schoolName(g.away)}|` +
    `${schoolName(g.home)}`
  );
}

const known = new Set(games.map(gameIdentity));

for (const g of published) {
  const id = gameIdentity(g);

  if (!known.has(id)) {
    games.push(g);
    known.add(id);
  }
}

// Map each team to its actual power rating.
const rated = new Map(
  ratings.map(r => [schoolName(r.team), r])
);

// Never index a sorted ratings array using rank.
// Use the actual bqNet value assigned to the team.
function rating(...names) {
  for (const name of names) {
    const r = rated.get(schoolName(name));

    if (r) return r;
  }

  return null;
}

// All game dates use Central Time.
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

// Identify completed games.
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

// Optional team_stats.json format:
// [
//   {
//     team: "Duke",
//     gamesPlayed: 10,
//     offTO: 15.2,
//     defTOForced: 19.4,
//     offEFG: 54.1,
//     defEFGAllowed: 45.8,
//     offORB: 31.2,
//     defORBAllowed: 25.1,
//     offFTR: 34.5,
//     defFTRAllowed: 28.3,
//     pace: 70.5
//   }
// ]
//
// All rates are percentages, e.g. 18.2,
// rather than decimals such as 0.182.
//
// Statistics should be opponent-adjusted when possible
// and must represent information available before tipoff.

const stats = new Map();

if (Array.isArray(statsInput)) {
  for (const r of statsInput) {
    if (r && isDI(r.team)) {
      stats.set(schoolName(r.team), r);
    }
  }
} else {
  console.warn(
    'STATS: team_stats.json must be an array; baseline only.'
  );
}

// Approximate national baselines.
// These are starting assumptions, not verified
// 2026-27 national averages.
const average = {
  offTO: 17,
  defTOForced: 17,
  offEFG: 50,
  defEFGAllowed: 50,
  offORB: 28,
  defORBAllowed: 28,
  offFTR: 32,
  defFTRAllowed: 32,
  pace: 69
};

const clamp = (x, lo, hi) =>
  Math.max(lo, Math.min(hi, x));

const num = v =>
  v == null || v === '' ? NaN : Number(v);

// Require a complete statistical profile
// and at least three games of sample data.
function hasStats(r) {
  return r &&
    [
      'offTO',
      'defTOForced',
      'offEFG',
      'defEFGAllowed',
      'offORB',
      'defORBAllowed',
      'offFTR',
      'defFTRAllowed',
      'pace'
    ].every(k => Number.isFinite(num(r[k]))) &&
    num(r.gamesPlayed) >= 3;
}

// Estimate the offensive matchup adjustment.
//
// The coefficients are provisional and must
// be calibrated against completed games.
function matchupAdjustment(off, def) {
  const diff = (a, b, baselineKey) =>
    (
      (num(off[a]) - average[baselineKey]) +
      (num(def[b]) - average[baselineKey])
    ) / 2;

  // More offensive turnovers and more defensive
  // pressure lower the offense's expected output.
  const turnover =
    -0.85 * diff(
      'offTO',
      'defTOForced',
      'offTO'
    );

  // Better shooting and weaker opposing
  // shooting defense raise expected output.
  const shooting =
    0.65 * diff(
      'offEFG',
      'defEFGAllowed',
      'offEFG'
    );

  // Offensive rebounding creates
  // second-chance scoring opportunities.
  const rebound =
    0.22 * diff(
      'offORB',
      'defORBAllowed',
      'offORB'
    );

  // Free-throw opportunities can increase
  // expected scoring efficiency.
  const freeThrows =
    0.12 * diff(
      'offFTR',
      'defFTRAllowed',
      'offFTR'
    );

  return (
    turnover +
    shooting +
    rebound +
    freeThrows
  );
}

// Determine whether a game has not started.
//
// If a reliable start time is unavailable,
// only future-date games are eligible.
// This avoids retroactively creating predictions
// for games that may already be underway.
function kickoff(g) {
  const d = new Date(
    g.startTime || g.commenceTime || ''
  );

  if (Number.isFinite(d.getTime())) {
    return d;
  }

  return g.date > centralDate(now)
    ? new Date(g.date + 'T23:59:59Z')
    : null;
}

// CourtEdge Model V2
function setModel(
  g,
  awayNames = [],
  homeNames = []
) {
  if (isFinal(g) || !isDIGame(g)) {
    return false;
  }

  const start = kickoff(g);

  if (!start || start <= now) {
    return false;
  }

  const away = rating(g.away, ...awayNames);
  const home = rating(g.home, ...homeNames);

  if (!away || !home) {
    return false;
  }

  const awayNet = num(away.bqNet);
  const homeNet = num(home.bqNet);

  if (
    !Number.isFinite(awayNet) ||
    !Number.isFinite(homeNet)
  ) {
    return false;
  }

  const a = stats.get(schoolName(g.away));
  const h = stats.get(schoolName(g.home));

  const detailed =
    hasStats(a) && hasStats(h);

  const version = detailed
    ? 'v2-matchup-1'
    : 'v2-baseline-1';

  // Don't regenerate an existing prediction
  // when it already uses the current model version.
  if (
    g.modelVersion === version &&
    g.modelSpread != null
  ) {
    return false;
  }

  // Preserve the previous prediction
  // before upgrading an upcoming game.
  if (
    g.modelSpread != null &&
    !g.preUpgradeModel
  ) {
    g.preUpgradeModel = {
      favorite: g.modelFavorite,
      spread: g.modelSpread,
      generatedAt: g.modelGeneratedAt || null
    };
  }

  // Baseline power-rating projection.
  // Positive margin favors the home team.
  const base =
    0.7 * (homeNet - awayNet) +
    (g.site === 'Neutral' ? 0 : 3);

  let adjustment = 0;

  if (detailed) {
    // Estimate game pace from both teams.
    const pace = clamp(
      (num(a.pace) + num(h.pace)) / 2,
      58,
      82
    );

    // Home offensive matchup advantage
    // minus away offensive matchup advantage.
    const raw =
      (
        matchupAdjustment(h, a) -
        matchupAdjustment(a, h)
      ) * pace / 69;

    // Small samples receive less weight.
    const reliability = clamp(
      Math.min(
        num(a.gamesPlayed),
        num(h.gamesPlayed)
      ) / 15,
      0,
      1
    );

    // Cap the total matchup adjustment
    // at five points in either direction.
    adjustment = clamp(
      raw * reliability,
      -5,
      5
    );
  }

  const margin = base + adjustment;

  g.modelFavorite =
    margin >= 0 ? g.home : g.away;

  g.modelSpread =
    -Math.round(Math.abs(margin) * 10) / 10;

  g.modelVersion = version;

  g.modelBaseMargin =
    Math.round(base * 10) / 10;

  g.modelMatchupAdjustment =
    Math.round(adjustment * 10) / 10;

  g.modelGeneratedAt = now.toISOString();

  // Recalculate the market edge when
  // a pregame prediction is updated.
  g.edge = null;
  g.confidence = null;

  return true;
}

// Compare the model's spread against
// the sportsbook's market spread.
function computeEdge(g) {
  if (
    g.modelSpread == null ||
    g.marketSpread == null ||
    !g.modelFavorite ||
    !g.marketFavorite
  ) {
    return;
  }

  const home = schoolName(g.home);
  const away = schoolName(g.away);
  const mf = schoolName(g.modelFavorite);
  const sf = schoolName(g.marketFavorite);

  if (
    ![home, away].includes(mf) ||
    ![home, away].includes(sf)
  ) {
    return;
  }

  // Convert both spreads into a consistent
  // home-team point-spread representation.
  const modelHome = mf === home
    ? -Math.abs(g.modelSpread)
    : Math.abs(g.modelSpread);

  const marketHome = sf === home
    ? -Math.abs(g.marketSpread)
    : Math.abs(g.marketSpread);

  // Preserve already-recorded edges.
  if (
    g.edge != null &&
    g.confidence != null
  ) {
    return;
  }

  g.edge = Math.round(
    Math.abs(modelHome - marketHome) * 10
  ) / 10;

  // Preliminary confidence score based
  // on the size of the model-market difference.
  g.confidence = Math.min(
    5,
    1 + [3, 6, 10, 15].filter(
      threshold => g.edge >= threshold
    ).length
  );
}

// ============================================================
// COURTEDGE MODEL V2 — ESPN SCHEDULE SYNCHRONIZATION
// ============================================================

// Development mode:
// Only fetch today's games and future games.
// Completed games from earlier dates are not needed.

const lookback = 0;

const forward = Math.max(
  0,
  Number(process.env.SYNC_FORWARD_DAYS ?? 7)
);

const today = centralDate(now);

const start = new Date(
  `${today}T12:00:00Z`
);

let eventsSeen = 0;
let added = 0;
let linked = 0;
let finals = 0;
let models = 0;
let ambiguous = 0;
let skippedNonDI = 0;

const seen = new Set();

// Process today's schedule plus future dates.
for (let offset = 0; offset <= forward; offset++) {
  const day = new Date(start);

  day.setUTCDate(
    start.getUTCDate() + offset
  );

  const date = day.toISOString().slice(0, 10);
  const stamp = date.replaceAll('-', '');

  const events = new Map();

  // ESPN's grouped and ungrouped scoreboards
  // can return different sets of games.
  // Combining both improves coverage.
  for (const suffix of ['&groups=50', '']) {
    try {
      const url =
        'https://site.api.espn.com/apis/site/v2/sports/' +
        'basketball/mens-college-basketball/scoreboard' +
        `?dates=${stamp}&limit=500${suffix}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw Error(
          `HTTP ${response.status}`
        );
      }

      const payload = await response.json();

      for (const e of payload.events || []) {
        events.set(String(e.id), e);
      }
    } catch (error) {
      console.warn(
        `ESPN ${date}: ${error.message}`
      );
    }
  }

  // Process each ESPN event only once.
  for (const event of events.values()) {
    if (seen.has(String(event.id))) {
      continue;
    }

    seen.add(String(event.id));

    const comp = event.competitions?.[0];

    if (!comp) continue;

    const away = comp.competitors?.find(
      c => c.homeAway === 'away'
    );

    const home = comp.competitors?.find(
      c => c.homeAway === 'home'
    );

    if (!away || !home) {
      continue;
    }

    eventsSeen++;

    // Only include Division I vs Division I games.
    if (
      !competitorDI(away) ||
      !competitorDI(home)
    ) {
      skippedNonDI++;
      continue;
    }

    const when = new Date(
      event.date ||
      comp.date ||
      date + 'T12:00:00Z'
    );

    const validTime =
      Number.isFinite(when.getTime());

    const gameDate = validTime
      ? centralDate(when)
      : date;

    // Do not import games from previous dates.
    if (gameDate < today) {
      continue;
    }

    // Find the game by its ESPN event ID.
    let g = games.find(
      x =>
        String(x.espnId || '') ===
        String(event.id)
    );

    // If no ESPN ID is attached, attempt to
    // match by date and both participating teams.
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

        console.warn(
          `ESPN AMBIGUOUS: ${event.id}`
        );

        continue;
      }

      if (candidates.length === 1) {
        g = candidates[0];
        linked++;

        const oldAway = g.away;
        const oldHome = g.home;

        const newAway =
          competitorNames(away)[0];

        const newHome =
          competitorNames(home)[0];

        const reversed =
          competitorMatches(oldAway, home) &&
          competitorMatches(oldHome, away);

        // If an existing record has reversed
        // orientation, preserve its original names
        // and swap team-specific moneylines.
        if (reversed) {
          g.originalAway = oldAway;
          g.originalHome = oldHome;

          g.pregameOrientationMismatch = true;

          [g.awayML, g.homeML] = [
            g.homeML,
            g.awayML
          ];
        }

        // Keep the recorded favorite attached
        // to the correct school.
        for (const field of [
          'modelFavorite',
          'marketFavorite'
        ]) {
          if (
            sameSchool(g[field], newAway)
          ) {
            g[field] = newAway;
          } else if (
            sameSchool(g[field], newHome)
          ) {
            g[field] = newHome;
          }
        }

        g.away = newAway;
        g.home = newHome;

        g.site = comp.neutralSite
          ? 'Neutral'
          : 'Home';
      }
    }

    // Create a new game if ESPN has not
    // previously been linked to it.
    if (!g) {
      g = {
        id: `espn-${event.id}`,
        espnId: String(event.id),
        date: gameDate,

        away: competitorNames(away)[0],
        home: competitorNames(home)[0],

        site: comp.neutralSite
          ? 'Neutral'
          : 'Home',

        source: 'ESPN / The Odds API',

        modelFavorite: null,
        modelSpread: null,
        modelVersion: null,

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

    // Attach ESPN identifiers for future
    // synchronization and team matching.
    g.espnId = String(event.id);

    if (away.team?.id) {
      g.espnAwayTeamId =
        String(away.team.id);
    }

    if (home.team?.id) {
      g.espnHomeTeamId =
        String(home.team.id);
    }

    g.date = gameDate;

    g.site = comp.neutralSite
      ? 'Neutral'
      : 'Home';

    // Save the exact scheduled start time.
    // This prevents generating model
    // predictions after a game has started.
    if (validTime) {
      g.startTime = when.toISOString();

      g.time = new Intl.DateTimeFormat(
        'en-US',
        {
          timeZone: 'America/Chicago',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }
      ).format(when);
    }

    const complete = Boolean(
      comp.status?.type?.completed ||
      event.status?.type?.completed
    );

    const state =
      comp.status?.type?.state ||
      event.status?.type?.state ||
      '';

    // Only create new predictions when
    // the game has not started.
    if (
      !complete &&
      state !== 'in' &&
      validTime &&
      when > now &&
      setModel(
        g,
        competitorNames(away),
        competitorNames(home)
      )
    ) {
      models++;
    }

    // Update completed games with final scores.
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
    } else if (state === 'in') {
      // Track live games without treating
      // partial scores as final results.
      g.status = 'live';

    } else if (!isFinal(g)) {
      g.status = 'scheduled';
    }

    computeEdge(g);
  }
}

// Attempt predictions for existing games
// that were not newly imported from ESPN.
//
// setModel() checks kickoff times and
// refuses to generate predictions after tipoff.
for (const g of games) {
  if (g.date < today) {
    continue;
  }

  if (setModel(g)) {
    models++;
  }

  computeEdge(g);
}

// ============================================================
// COURTEDGE MODEL V2 — SPORTSBOOK ODDS
// ============================================================

if (process.env.ODDS_API_KEY) {
  try {
    const url =
      'https://api.the-odds-api.com/v4/sports/' +
      'basketball_ncaab/odds/' +
      `?apiKey=${encodeURIComponent(
        process.env.ODDS_API_KEY
      )}` +
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
      const startTime = new Date(
        event.commence_time
      );

      if (
        !Number.isFinite(startTime.getTime())
      ) {
        continue;
      }

      const date = centralDate(startTime);

      // Only process today's and future games.
      if (date < today) {
        continue;
      }

      // Reject non-DI matchups.
      if (
        !isDI(event.away_team) ||
        !isDI(event.home_team)
      ) {
        nonDI++;
        continue;
      }

      // Match both participating teams
      // and the exact Central Time game date.
      const candidates = games.filter(
        g =>
          isDIGame(g) &&
          g.date === date &&
          (
            (
              sameSchool(
                g.away,
                event.away_team
              ) &&
              sameSchool(
                g.home,
                event.home_team
              )
            ) ||
            (
              sameSchool(
                g.away,
                event.home_team
              ) &&
              sameSchool(
                g.home,
                event.away_team
              )
            )
          )
      );

      if (candidates.length === 0) {
        unmatched++;

        console.log(
          `ODDS UNMATCHED: ${date} ` +
          `${event.away_team} @ ` +
          `${event.home_team}`
        );

        const closest = games.filter(
          g =>
            g.date === date &&
            (
              sameSchool(
                g.away,
                event.away_team
              ) ||
              sameSchool(
                g.home,
                event.home_team
              ) ||
              sameSchool(
                g.away,
                event.home_team
              ) ||
              sameSchool(
                g.home,
                event.away_team
              )
            )
        ).slice(0, 3);

        for (const g of closest) {
          console.log(
            `  CLOSEST: ${g.away} @ ${g.home}`
          );
        }

        continue;
      }

      if (candidates.length !== 1) {
        ambiguousOdds++;

        console.warn(
          `ODDS AMBIGUOUS: ${date} ` +
          `${event.away_team} @ ` +
          `${event.home_team}`
        );

        continue;
      }

      const g = candidates[0];

      // Never attach new market odds
      // to completed or already-started games.
      if (
        isFinal(g) ||
        g.status === 'live' ||
        startTime <= now
      ) {
        completed++;
        continue;
      }

      // Preserve the first recorded pregame line.
      if (g.marketSpread != null) {
        already++;
        continue;
      }

      // Prefer DraftKings, then other
      // available sportsbooks.
      const books = [
        ...(event.bookmakers || [])
      ].sort(
        (a, b) =>
          Number(b.key === 'draftkings') -
          Number(a.key === 'draftkings')
      );

      let selected = null;
      let homeLine = null;

      for (const book of books) {
        const spread =
          book.markets?.find(
            m => m.key === 'spreads'
          )?.outcomes || [];

        const home = spread.find(
          o => sameSchool(o.name, g.home)
        );

        const away = spread.find(
          o => sameSchool(o.name, g.away)
        );

        if (
          !home ||
          !away ||
          home.point == null ||
          away.point == null
        ) {
          continue;
        }

        const hp = Number(home.point);
        const ap = Number(away.point);

        // Both sides must have valid
        // opposite point spreads.
        if (
          !Number.isFinite(hp) ||
          !Number.isFinite(ap) ||
          Math.abs(hp + ap) > 0.01
        ) {
          continue;
        }

        selected = book;
        homeLine = hp;

        break;
      }

      if (!selected) {
        noSpread++;
        continue;
      }

      // Convert the selected home spread
      // into CourtEdge's market format.
      g.marketFavorite =
        homeLine < 0
          ? g.home
          : homeLine > 0
            ? g.away
            : null;

      g.marketSpread =
        -Math.abs(homeLine);

      // Retrieve moneyline odds from
      // the same selected sportsbook.
      const money =
        selected.markets?.find(
          m => m.key === 'h2h'
        )?.outcomes || [];

      g.homeML =
        money.find(
          m => sameSchool(m.name, g.home)
        )?.price ??
        g.homeML ??
        null;

      g.awayML =
        money.find(
          m => sameSchool(m.name, g.away)
        )?.price ??
        g.awayML ??
        null;

      g.oddsBook = selected.title;
      g.oddsCapturedAt = now.toISOString();

      computeEdge(g);

      saved++;

      console.log(
        `ODDS SAVED: ${date} ` +
        `${g.away} @ ${g.home}: ` +
        `${g.marketFavorite || 'PK'} ` +
        `${g.marketSpread}`
      );
    }

    console.log(
      `ODDS: ${odds.length} events; ` +
      `saved ${saved}; ` +
      `already had lines ${already}; ` +
      `unmatched ${unmatched}; ` +
      `ambiguous ${ambiguousOdds}; ` +
      `no spread offered ${noSpread}; ` +
      `started/final games ${completed}; ` +
      `non-DI excluded ${nonDI}.`
    );

  } catch (error) {
    console.warn(
      `Odds unavailable: ${error.message}`
    );
  }

} else {
  console.log(
    'ODDS_API_KEY not set. Market odds unavailable.'
  );
}

// ============================================================
// COURTEDGE MODEL V2 — VALIDATION AND PUBLISHING
// ============================================================

// Only publish today's and future DI games.
// Completed games from today remain visible,
// but older games are removed.

const diGames = games.filter(
  g =>
    g.date >= today &&
    isDIGame(g)
);

// Prevent duplicate ESPN events.
const espnIds = diGames
  .filter(g => g.espnId)
  .map(g => String(g.espnId));

if (
  new Set(espnIds).size !==
  espnIds.length
) {
  throw Error(
    'Duplicate ESPN IDs. Refusing to publish.'
  );
}

// Prevent duplicate matchups on the same date.
const matchupIds = diGames.map(
  g =>
    `${g.date}|` +
    `${schoolName(g.away)}|` +
    `${schoolName(g.home)}`
);

if (
  new Set(matchupIds).size !==
  matchupIds.length
) {
  throw Error(
    'Duplicate game matchups. Refusing to publish.'
  );
}

// Sort chronologically.
diGames.sort((a, b) => {
  const aTime =
    a.startTime ||
    `${a.date}T12:00:00Z`;

  const bTime =
    b.startTime ||
    `${b.date}T12:00:00Z`;

  return aTime.localeCompare(bTime);
});

// Final model and market coverage checks.
const missingModels = diGames.filter(
  g =>
    g.modelSpread == null ||
    !g.modelFavorite
);

const missingMarkets = diGames.filter(
  g =>
    g.marketSpread == null
);

const matchupModels = diGames.filter(
  g =>
    g.modelVersion === 'v2-matchup-1'
);

const baselineModels = diGames.filter(
  g =>
    g.modelVersion === 'v2-baseline-1'
);

const upcoming = diGames.filter(
  g =>
    !isFinal(g) &&
    g.status !== 'live' &&
    kickoff(g) > now
);

const upcomingMissingModels = upcoming.filter(
  g =>
    g.modelSpread == null ||
    !g.modelFavorite
);

const upcomingMissingMarkets = upcoming.filter(
  g =>
    g.marketSpread == null
);

// Save the website-visible games.
// No games_archive.json is required.
write('games.json', diGames);

// ============================================================
// COURTEDGE MODEL V2 — LOGGING
// ============================================================

console.log(
  `SYNC: ESPN events ${eventsSeen}; ` +
  `added ${added}; ` +
  `linked ${linked}; ` +
  `finals seen ${finals}; ` +
  `new model predictions ${models}; ` +
  `ambiguous ${ambiguous}; ` +
  `ESPN non-DI skipped ${skippedNonDI}.`
);

console.log(
  `DI FILTER: ${games.length} games processed; ` +
  `${diGames.length} published; ` +
  `${games.length - diGames.length} excluded ` +
  `or outside the current date range.`
);

console.log(
  `MODEL COVERAGE: ` +
  `${matchupModels.length} matchup-adjusted; ` +
  `${baselineModels.length} baseline; ` +
  `${missingModels.length} total without models.`
);

console.log(
  `MARKET COVERAGE: ` +
  `${diGames.length - missingMarkets.length} ` +
  `games with sportsbook spreads; ` +
  `${missingMarkets.length} without market spreads.`
);

console.log(
  `UPCOMING COVERAGE: ` +
  `${upcoming.length} upcoming games; ` +
  `${upcomingMissingModels.length} missing models; ` +
  `${upcomingMissingMarkets.length} missing markets.`
);

console.log(
  `STATS: ${stats.size} DI team profiles loaded.`
);

// Identify upcoming games that are missing
// predictions so they can be investigated.
for (const g of upcomingMissingModels.slice(0, 30)) {
  console.warn(
    `MISSING MODEL: ${g.date} ` +
    `${g.away} @ ${g.home}`
  );
}

// Identify upcoming games without market odds.
for (const g of upcomingMissingMarkets.slice(0, 30)) {
  console.log(
    `MISSING MARKET: ${g.date} ` +
    `${g.away} @ ${g.home}`
  );
}

// Final confirmation.
console.log(
  `COURTEDGE V2 COMPLETE: ` +
  `${diGames.length} games published to games.json.`
);
