import fs from 'node:fs';
import path from 'node:path';

// Run from the repository root, once, before the next sync.
// Saves a timestamped backup outside public/data before resetting.
const input = path.resolve('public/data/games.json');
const games = JSON.parse(fs.readFileSync(input, 'utf8'));
if (!Array.isArray(games)) throw Error('games.json must be an array');
const ids = games.map(g => String(g.espnId || g.id || ''));
if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
  throw Error('Missing or duplicate game IDs; refusing reset');
}
const dir = path.resolve('audit-output');
fs.mkdirSync(dir, {recursive:true});
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = path.join(dir, `games-before-model-reset-${stamp}.json`);
fs.copyFileSync(input, backup);
const remove = [
  'modelFavorite','modelSpread','modelVersion','modelGeneratedAt',
  'modelBaseMargin','modelMatchupAdjustment','modelWinnerCorrect',
  'modelMarginError','edge','confidence','atsPick','voidedAtsPicks',
  'preUpgradeModel','evaluationStatus'
];
let models=0,picks=0,markets=0;
for (const g of games) {
  if (g.modelFavorite != null || g.modelSpread != null) models++;
  if (g.atsPick != null) picks++;
  if (g.marketSpread != null) markets++;
  for (const key of remove) delete g[key];
}
// The sync writes a fresh ATS summary on the next run. Reset it now as well.
const atsFile = path.resolve('public/data/ats_results.json');
const atsBackup = fs.existsSync(atsFile)
  ? path.join(dir, `ats-before-model-reset-${stamp}.json`) : null;
if (atsBackup) fs.copyFileSync(atsFile, atsBackup);
const ats = {
  generatedAt: new Date().toISOString(),
  methodology: 'Model paused for Phase 2 reset. No model ATS picks recorded.',
  wins:0, losses:0, pushes:0, pending:0, noEdge:0, void:0,
  gamesWithMarket:markets, gamesWithModel:0, picks:[], graded:0, winPct:null
};
const output = JSON.stringify(games,null,2)+'\n';
fs.writeFileSync(input, output);
fs.writeFileSync(atsFile,JSON.stringify(ats,null,2)+'\n');
const check = JSON.parse(fs.readFileSync(input,'utf8'));
if (check.length !== games.length || check.some(g => g.modelSpread != null || g.atsPick != null)) {
  throw Error('Post-reset verification failed');
}
console.log('MODEL RESET COMPLETE:',JSON.stringify({games:games.length,removedModels:models,removedPicks:picks,preservedMarketSpreads:markets,backup,atsBackup}));
