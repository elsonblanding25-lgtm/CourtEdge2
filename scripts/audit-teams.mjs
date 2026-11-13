
import fs from 'node:fs';
import vm from 'node:vm';

const ratings = JSON.parse(
  fs.readFileSync('public/data/ratings.json', 'utf8')
);
const source = fs.readFileSync('scripts/sync.mjs', 'utf8');

const begin = source.indexOf('function clean(value)');
const end = source.indexOf(
  '// Development mode: no games_archive.json required.'
);

if (begin < 0 || end <= begin) {
  throw Error('Could not locate school matching code in sync.mjs');
}

const sandbox = vm.createContext({ ratings });

vm.runInContext(
  source.slice(begin, end) +
  '\nglobalThis.matcher = {schoolName, isDI, aliases, specialAliases};',
  sandbox
);

const { schoolName, isDI, aliases, specialAliases } = sandbox.matcher;

const base =
  'https://site.api.espn.com/apis/site/v2/sports/' +
  'basketball/mens-college-basketball/teams';

const urls = [
  `${base}?groups=50&limit=500`,
  `${base}?limit=500`
];

const all = new Map();

for (const url of urls) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) throw Error(`HTTP ${res.status}`);

    const data = await res.json();

    for (const sport of data.sports || []) {
      for (const league of sport.leagues || []) {
        for (const entry of league.teams || []) {
          const team = entry.team || entry;
          if (team.id) all.set(String(team.id), team);
        }
      }
    }

    console.log(
      `ESPN endpoint returned ${all.size} unique teams so far: ${url}`
    );
  } catch (e) {
    console.warn(`ESPN request failed: ${e.message}`);
  }
}

if (all.size < 300) {
  throw Error(
    `Only ${all.size} ESPN teams found. ` +
    'Refusing to certify incomplete directory.'
  );
}

const ratingMap = new Map();

for (const r of ratings) {
  const id = schoolName(r.team);

  if (!ratingMap.has(id)) ratingMap.set(id, []);

  ratingMap.get(id).push(r.team);
}

const collisions = [...ratingMap].filter(
  ([, names]) => names.length > 1
);

const espnTeams = [...all.values()];

const records = espnTeams.map(team => {
  const candidates = [
    team.shortDisplayName,
    team.displayName,
    team.location,
    team.name
  ].filter(Boolean);

  const matching = [
    ...new Set(
      candidates.map(schoolName).filter(id => ratingMap.has(id))
    )
  ];

  return {
    espnId: String(team.id),
    espnName: team.displayName || team.location || '',
    candidates,
    matched: matching.length === 1 ? matching[0] : null,
    issue: matching.length === 0
      ? 'unmatched'
      : matching.length > 1
        ? 'ambiguous'
        : null
  };
});

const unmatched = records.filter(x => x.issue === 'unmatched');
const ambiguous = records.filter(x => x.issue === 'ambiguous');

const matchedIds = new Set(
  records.filter(x => x.matched).map(x => x.matched)
);

const missingRatings = [...ratingMap]
  .filter(([id]) => !matchedIds.has(id))
  .map(([id, names]) => ({ id, names }));

const unknownAliases = Object.entries({
  ...aliases,
  ...specialAliases
})
  .filter(([, target]) => !isDI(target))
  .map(([alias, target]) => ({ alias, target }));

const report = {
  generatedAt: new Date().toISOString(),
  espnCount: all.size,
  ratingsCount: ratings.length,
  matchedEspn: records.length - unmatched.length - ambiguous.length,
  unmatched,
  ambiguous,
  missingRatings,
  collisions,
  unknownAliases,
  records
};

fs.mkdirSync('audit-output', { recursive: true });

fs.writeFileSync(
  'audit-output/team-directory-audit.json',
  JSON.stringify(report, null, 2) + '\n'
);

console.log(
  `AUDIT SUMMARY: ESPN ${all.size}; ` +
  `ratings ${ratings.length}; ` +
  `matched ESPN ${report.matchedEspn}; ` +
  `unmatched ESPN ${unmatched.length}; ` +
  `ambiguous ESPN ${ambiguous.length}; ` +
  `ratings not matched ${missingRatings.length}; ` +
  `canonical collisions ${collisions.length}; ` +
  `unknown alias targets ${unknownAliases.length}`
);

for (const [label, entries] of Object.entries({
  UNMATCHED_ESPN: unmatched,
  AMBIGUOUS_ESPN: ambiguous,
  UNMATCHED_RATING: missingRatings,
  COLLISION: collisions,
  UNKNOWN_ALIAS_TARGET: unknownAliases
})) {
  for (const entry of entries) {
    console.log(`${label}: ${JSON.stringify(entry)}`);
  }
}

if (
  collisions.length ||
  ambiguous.length ||
  unmatched.length ||
  missingRatings.length ||
  unknownAliases.length
) {
  console.log(
    'AUDIT STATUS: REVIEW REQUIRED — no production files changed.'
  );
} else {
  console.log(
    'AUDIT STATUS: All current ESPN and ratings names matched.'
  );
}
