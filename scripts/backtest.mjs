
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);
const DATA = new URL('public/data/', ROOT);

const read = (name, fallback) => {
  const p = new URL(name, DATA);
  return fs.existsSync(p)
    ? JSON.parse(fs.readFileSync(p, 'utf8'))
    : fallback;
};

const games = read('games.json', []);
const currentRatings = read('ratings.json', []);

if (!Array.isArray(games) || !Array.isArray(currentRatings)) {
  throw Error('Invalid data');
}

const clean = v => String(v ?? '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const aliases = {
  'nc central': 'north carolina central',
  'n carolina central': 'north carolina central',
  'new mexico st': 'new mexico state',
  'washington st': 'washington state',
  'san diego st': 'san diego state',
  'colorado st': 'colorado state',
  'oklahoma st': 'oklahoma state',
  'kansas st': 'kansas state',
  'montana st': 'montana state',
  'portland st': 'portland state',
  'alabama st': 'alabama state',
  'delaware st': 'delaware state',
  'illinois st': 'illinois state',
  'idaho st': 'idaho state',
  'boise st': 'boise state',
  'ut martin': 'tennessee martin',
  'w carolina': 'western carolina',
  's indiana': 'southern indiana',
  'c connecticut': 'central connecticut',
  'w michigan': 'western michigan',
  'st john s': 'saint johns',
  'st thomas': 'saint thomas',
  'st thomas mn': 'saint thomas',
  'saint mary s': 'saint marys',
  'saint peter s': 'saint peters',
  'pitt': 'pittsburgh',
  'u albany': 'albany',
  'ualbany': 'albany',
  'iu indy': 'iu indianapolis',
  'i u indy': 'iu indianapolis',
  'abilene chrstn': 'abilene christian',
  'umkc': 'kansas city',
  'mississippi': 'ole miss',
  'uconn': 'connecticut',
  'byu': 'brigham young',
  'vcu': 'virginia commonwealth',
  'smu': 'southern methodist',
  'ucf': 'central florida',
  'fau': 'florida atlantic',
  'unc asheville': 'north carolina asheville',
  'unc greensboro': 'north carolina greensboro',
  'unc wilmington': 'north carolina wilmington',
  'app st': 'appalachian state',
  'mcneese': 'mcneese state',
  'long island university': 'long island',
  'liu': 'long island',
  'purdue fort wayne': 'fort wayne',
  'purdue fw': 'fort wayne'
};

const canon = v => aliases[clean(v)] || clean(v);

const index = rows => {
  const m = new Map();

  for (const r of rows) {
    const k = canon(r.team);
    const n = Number(r.bqNet);

    if (k && Number.isFinite(n)) {
      m.set(k, n);
    }
  }

  return m;
};

const currentIndex = index(currentRatings);

// Search Git history for earlier ratings.json versions.
// GitHub Actions must use fetch-depth: 0.

let history = [];

try {
  const raw = execFileSync('git', [
    'log',
    '--all',
    '--format=%H|%cI',
    '--',
    'public/data/ratings.json'
  ], {
    cwd: new URL('.', ROOT),
    encoding: 'utf8'
  });

  history = raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [sha, committedAt] = line.split('|');

      return {
        sha,
        committedAt,
        time: Date.parse(committedAt)
      };
    })
    .filter(x => Number.isFinite(x.time))
    .sort((a, b) => b.time - a.time);

} catch (e) {
  console.warn(
    'Git history unavailable:',
    e.message
  );
}

const cache = new Map();

function historicalRatings(commit) {
  if (cache.has(commit.sha)) {
    return cache.get(commit.sha);
  }

  try {
    const raw = execFileSync('git', [
      'show',
      `${commit.sha}:public/data/ratings.json`
    ], {
      cwd: new URL('.', ROOT),
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024
    });

    const result = index(JSON.parse(raw));

    cache.set(commit.sha, result);

    return result;

  } catch {
    cache.set(commit.sha, null);
    return null;
  }
}

// Only evaluate November 5 and November 6, 2026.

const targetDates = new Set([
  '2026-11-05',
  '2026-11-06'
]);

const results = [];

let evaluated = 0;
let wins = 0;
let errorSum = 0;
let retros = 0;
let missing = 0;

for (const g of games) {
  if (
    !targetDates.has(g.date) ||
    g.status !== 'final'
  ) {
    continue;
  }

  const awayScore = Number(g.awayScore);
  const homeScore = Number(g.homeScore);

  if (
    !Number.isFinite(awayScore) ||
    !Number.isFinite(homeScore)
  ) {
    continue;
  }

  const tipoff = Date.parse(g.startTime || '');

  const actualHomeMargin =
    homeScore - awayScore;

  const row = {
    date: g.date,
    away: g.away,
    home: g.home,
    awayScore,
    homeScore,
    actualHomeMargin,
    category: 'missing-ratings',
    eligibleForAccuracy: false
  };

  // Without a valid tipoff time, historical
  // snapshot eligibility cannot be established.

  const commits = Number.isFinite(tipoff)
    ? history.filter(c => c.time < tipoff)
    : [];

  let selected = null;

  for (const c of commits) {
    const ratings = historicalRatings(c);

    if (
      ratings?.has(canon(g.away)) &&
      ratings?.has(canon(g.home))
    ) {
      selected = {
        ratings,
        commit: c
      };

      break;
    }
  }

  // Current ratings can provide a retrospective
  // estimate, but never a scored historical test.

  const ratings =
    selected?.ratings || currentIndex;

  const a = ratings.get(canon(g.away));
  const h = ratings.get(canon(g.home));

  if (a !== undefined && h !== undefined) {
    const neutral =
      String(g.site).toLowerCase() === 'neutral';

    const predictedHomeMargin =
      Math.round(
        (
          0.7 * (h - a) +
          (neutral ? 0 : 3)
        ) * 10
      ) / 10;

    row.predictedHomeMargin =
      predictedHomeMargin;

    row.predictedWinner =
      predictedHomeMargin > 0
        ? g.home
        : predictedHomeMargin < 0
          ? g.away
          : 'Pick’em';

    row.predictedSpread =
      predictedHomeMargin > 0
        ? `${g.home} -${predictedHomeMargin.toFixed(1)}`
        : predictedHomeMargin < 0
          ? `${g.away} -${Math.abs(predictedHomeMargin).toFixed(1)}`
          : 'Pick’em';

    row.marginAbsoluteError =
      Math.round(
        Math.abs(
          predictedHomeMargin - actualHomeMargin
        ) * 10
      ) / 10;

    row.winnerCorrect =
      predictedHomeMargin !== 0 &&
      actualHomeMargin !== 0 &&
      Math.sign(predictedHomeMargin) ===
        Math.sign(actualHomeMargin);

    if (selected) {
      row.category = 'historical-git-snapshot';
      row.eligibleForAccuracy = true;

      row.ratingSnapshotCommit =
        selected.commit.sha;

      row.ratingSnapshotCommittedAt =
        selected.commit.committedAt;

      evaluated++;
      wins += Number(row.winnerCorrect);
      errorSum += row.marginAbsoluteError;

    } else {
      row.category =
        'retrospective-current-ratings';

      row.note =
        'Uses current ratings; not a valid ' +
        'pregame accuracy measurement.';

      retros++;
    }

  } else {
    row.note =
      'No matching ratings for both teams.';

    missing++;
  }

  results.push(row);
}

const summary = {
  dates: [...targetDates],

  completedGames: results.length,

  historicalSnapshotEvaluated: evaluated,

  retrospectiveEstimatesExcluded: retros,

  missingRatings: missing,

  historicalWinnerAccuracyPct: evaluated
    ? Math.round(1000 * wins / evaluated) / 10
    : null,

  historicalMarginMAE: evaluated
    ? Math.round(100 * errorSum / evaluated) / 100
    : null,

  methodology:
    'Git ratings.json commit timestamp strictly ' +
    'before ESPN tipoff; baseline formula ' +
    '0.7*(home bqNet-away bqNet)+3 home points ' +
    '(0 neutral). Retrospective current ratings ' +
    'excluded from accuracy. Git commit timestamp ' +
    'is evidence of repository availability, ' +
    'not proof the rating source itself was ' +
    'point-in-time.'
};

fs.writeFileSync(
  new URL('backtest_2026-11-05_06.json', DATA),
  JSON.stringify({
    summary,
    games: results
  }, null, 2) + '\n'
);

console.log(
  'BACKTEST:',
  JSON.stringify(summary, null, 2)
);
