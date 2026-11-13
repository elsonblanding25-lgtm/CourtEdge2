
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('scripts/sync.mjs', 'utf8');
const ratings = JSON.parse(
  fs.readFileSync('public/data/ratings.json', 'utf8')
);
const games = JSON.parse(
  fs.readFileSync('public/data/games.json', 'utf8')
);

const begin = source.indexOf('function clean(value)');
const end = source.indexOf(
  '// Development mode: no games_archive.json required.'
);

if (begin < 0 || end <= begin) {
  throw Error('Matching section not found in sync.mjs');
}

const context = vm.createContext({ ratings });

vm.runInContext(
  source.slice(begin, end) +
  '\nglobalThis.audit = {schoolName,isDI,sameSchool};',
  context
);

const { schoolName, isDI, sameSchool } = context.audit;

const key = process.env.ODDS_API_KEY;
if (!key) throw Error('ODDS_API_KEY secret missing');

async function getJSON(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30000)
  });

  if (!res.ok) {
    throw Error(
      `HTTP ${res.status}: ${(await res.text()).slice(0, 250)}`
    );
  }

  return res.json();
}

const espn = await getJSON(
  'https://site.api.espn.com/apis/site/v2/sports/' +
  'basketball/mens-college-basketball/teams?groups=50&limit=500'
);

const espnTeams = espn.sports
  .flatMap(s => s.leagues || [])
  .flatMap(l => l.teams || [])
  .map(x => x.team || x);

const identities = new Map();

for (const t of espnTeams) {
  const names = [
    t.shortDisplayName,
    t.displayName,
    t.location
  ].filter(Boolean);

  const matches = [
    ...new Set(names.map(schoolName).filter(isDI))
  ];

  if (matches.length !== 1) {
    throw Error(
      `ESPN identity unresolved: ${t.displayName} => ${matches.join(',')}`
    );
  }

  if (identities.has(matches[0])) {
    throw Error(`ESPN identity collision: ${matches[0]}`);
  }

  identities.set(matches[0], t);
}

if (identities.size !== 365) {
  throw Error(
    `Expected 365 unique ESPN teams; got ${identities.size}`
  );
}

const endpoint = new URL(
  'https://api.the-odds-api.com/v4/sports/basketball_ncaab/events'
);

endpoint.searchParams.set('apiKey', key);
endpoint.searchParams.set('dateFormat', 'iso');

const events = await getJSON(endpoint);

if (!Array.isArray(events)) {
  throw Error('Unexpected Odds API events response');
}

const now = Date.now();
const cutoff = now + 24 * 60 * 60 * 1000;

const findings = [];
const names = new Map();

for (const e of events) {
  const a = schoolName(e.away_team);
  const h = schoolName(e.home_team);

  for (const [raw, id] of [
    [e.away_team, a],
    [e.home_team, h]
  ]) {
    const item = names.get(raw) || {
      raw,
      canonical: id,
      recognized: identities.has(id),
      count: 0
    };

    item.count++;
    names.set(raw, item);
  }

  const time = Date.parse(e.commence_time);

  const within24 =
    Number.isFinite(time) &&
    time >= now &&
    time < cutoff;

  const candidates = games.filter(g => {
    const t = Date.parse(g.startTime || '');

    return (
      Number.isFinite(t) &&
      Math.abs(t - time) <= 6 * 60 * 60 * 1000 &&
      (
        (
          sameSchool(g.away, e.away_team) &&
          sameSchool(g.home, e.home_team)
        ) ||
        (
          sameSchool(g.away, e.home_team) &&
          sameSchool(g.home, e.away_team)
        )
      )
    );
  });

  const issue =
    !identities.has(a) || !identities.has(h)
      ? 'unknown_team'
      : a === h
        ? 'same_team_identity'
        : candidates.length === 0
          ? 'no_published_game'
          : candidates.length > 1
            ? 'ambiguous_game'
            : null;

  findings.push({
    id: e.id,
    commenceTime: e.commence_time,
    away: e.away_team,
    home: e.home_team,
    awayCanonical: a,
    homeCanonical: h,
    within24,
    issue,
    publishedMatches: candidates.map(g => ({
      id: g.id,
      away: g.away,
      home: g.home,
      startTime: g.startTime
    }))
  });
}

const summary = {
  espnTeams: identities.size,
  oddsEvents: events.length,
  distinctSportsbookNames: names.size,
  recognizedNames: [...names.values()].filter(
    x => x.recognized
  ).length,
  unknownNames: [...names.values()].filter(
    x => !x.recognized
  ).length,
  matchedGames: findings.filter(x => !x.issue).length,
  unknownTeamEvents: findings.filter(
    x => x.issue === 'unknown_team'
  ).length,
  noPublishedGame: findings.filter(
    x => x.issue === 'no_published_game'
  ).length,
  ambiguousGames: findings.filter(
    x => x.issue === 'ambiguous_game'
  ).length,
  next24Events: findings.filter(x => x.within24).length,
  next24Matched: findings.filter(
    x => x.within24 && !x.issue
  ).length
};

const report = {
  generatedAt: new Date().toISOString(),
  summary,
  unknownNames: [...names.values()].filter(
    x => !x.recognized
  ),
  findings
};

fs.mkdirSync('audit-output', { recursive: true });

fs.writeFileSync(
  'audit-output/sportsbook-audit.json',
  JSON.stringify(report, null, 2) + '\n'
);

console.log(
  'SPORTSBOOK AUDIT SUMMARY:',
  JSON.stringify(summary)
);

for (const x of report.unknownNames) {
  console.log(
    'UNKNOWN SPORTSBOOK NAME:',
    JSON.stringify(x)
  );
}

for (const x of findings.filter(x => x.issue)) {
  console.log(
    'UNMATCHED SPORTSBOOK EVENT:',
    JSON.stringify(x)
  );
}

console.log(
  'AUDIT COMPLETE: read-only; no production files modified'
);
