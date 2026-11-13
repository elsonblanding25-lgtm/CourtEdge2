
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
  throw Error('Cannot locate team matcher');
}

const context = vm.createContext({ ratings });

vm.runInContext(
  source.slice(begin, end) +
  '\nglobalThis.audit={schoolName,isDI,sameSchool};',
  context
);

const { schoolName, isDI, sameSchool } = context.audit;

const targets = [
  ['West Florida', 'Cleveland St', '2026-11-13'],
  ['Texas A&M-CC', 'Florida St', '2026-11-13'],
  ['North Alabama', 'Miami', '2026-11-13'],
  ["Florida Int'l", 'Florida Gulf Coast', '2026-11-13'],
  ['Sam Houston St', 'Illinois', '2026-11-13'],
  ['Northern Arizona', 'Kentucky', '2026-11-13'],
  ["Mt. St. Mary's", 'Virginia Tech', '2026-11-13'],
  ['SE Missouri St', 'Middle Tennessee', '2026-11-13'],
  ['Alcorn St', 'Tarleton State', '2026-11-13'],
  ['SIU-Edwardsville', 'Duke', '2026-11-13'],
  ['Texas Southern', 'Murray St', '2026-11-13'],
  ['UL Monroe', 'Arizona St', '2026-11-13'],
  ['UIC', "Saint Mary's", '2026-11-13']
];

async function scoreboard(date) {
  const stamp = date.replaceAll('-', '');
  const events = new Map();

  for (const suffix of ['&groups=50', '']) {
    const url =
      'https://site.api.espn.com/apis/site/v2/sports/' +
      'basketball/mens-college-basketball/scoreboard' +
      `?dates=${stamp}&limit=500${suffix}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw Error(`ESPN HTTP ${response.status}`);
    }

    const data = await response.json();

    for (const event of data.events || []) {
      events.set(String(event.id), event);
    }
  }

  return [...events.values()];
}

const dates = [...new Set([
  ...targets.map(x => x[2]),
  '2026-11-14'
])];

const espnEvents = new Map();

for (const date of dates) {
  for (const event of await scoreboard(date)) {
    espnEvents.set(String(event.id), event);
  }
}

function names(competitor) {
  return [
    competitor?.team?.shortDisplayName,
    competitor?.team?.displayName,
    competitor?.team?.location
  ].filter(Boolean);
}

function matches(target, competitor) {
  return names(competitor).some(
    name => sameSchool(target, name)
  );
}

for (const [away, home, date] of targets) {
  const published = games.filter(g =>
    sameSchool(g.away, away) &&
    sameSchool(g.home, home) &&
    Math.abs(
      Date.parse(g.startTime) -
      Date.parse(date + 'T12:00:00Z')
    ) <= 36 * 60 * 60 * 1000
  );

  const espnMatches = [...espnEvents.values()]
    .filter(event => {
      const competitors =
        event.competitions?.[0]?.competitors || [];

      const a = competitors.find(
        c => c.homeAway === 'away'
      );
      const h = competitors.find(
        c => c.homeAway === 'home'
      );

      return matches(away, a) && matches(home, h);
    })
    .map(event => {
      const competitors =
        event.competitions?.[0]?.competitors || [];

      const a = competitors.find(
        c => c.homeAway === 'away'
      );
      const h = competitors.find(
        c => c.homeAway === 'home'
      );

      return {
        espnId: event.id,
        startTime: event.date,
        awayNames: names(a),
        homeNames: names(h),
        awayRecognized: names(a).some(isDI),
        homeRecognized: names(h).some(isDI)
      };
    });

  console.log('MISSING GAME DIAGNOSTIC:', JSON.stringify({
    matchup: `${away} @ ${home}`,
    publishedCount: published.length,
    publishedIds: published.map(g => g.id),
    espnMatches
  }));
}

console.log('DIAGNOSTIC COMPLETE: no files modified');
