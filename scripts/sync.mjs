
/** CourtEdge ESPN finals and model backfill. Keeps pregame lines and existing predictions. */
import fs from 'node:fs';
const base = new URL('../public/data/', import.meta.url);
const read = n => JSON.parse(fs.readFileSync(new URL(n, base), 'utf8'));
const write = (n, value) => fs.writeFileSync(new URL(n, base), JSON.stringify(value, null, 2) + '\n');
const ratings = read('ratings.json').filter(r => Number.isInteger(r.rank) && Number.isFinite(r.bqNet));
const games = read('games.json');
const efficiency = ratings.map(r => r.bqNet).sort((a,b) => b-a);
const norm = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const alias = {
  'uconn':'connecticut', 'unc':'north carolina', 'app state':'appalachian state',
  'grambling state':'grambling', 'miami fl':'miami fla', 'miami florida':'miami fla',
  'miami oh':'miami oh', 'ole miss':'ole miss', 'saint marys ca':'saint marys',
  'st marys':'saint marys', 'st johns':'saint johns', 'st louis':'saint louis',
  'st bonaventure':'saint bonaventure', 'st josephs':'saint josephs',
  'purdue fort wayne':'fort wayne', 'pfw':'fort wayne', 'iu indianapolis':'iu indy',
  'umkc':'missouri kansas city', 'charleston':'college of charleston',
  'southern miss':'southern mississippi', 'louisiana':'louisiana lafayette',
  'mcneese':'mcneese state', 'sam houston':'sam houston state',
  'ut rio grande valley':'texas rio grande valley', 'utrgv':'texas rio grande valley',
  'uncw':'unc wilmington', 'uic':'illinois chicago', 'long island university':'long island',
  'li u':'long island', 'liu':'long island', 'queens nc':'queens',
  'maryland eastern shore':'maryland eastern shore', 'umes':'maryland eastern shore',
  'tennessee martin':'tennessee martin', 'ut martin':'tennessee martin',
  'little rock':'arkansas little rock', 'ucf':'ucf', 'lsu':'lsu'
};
function key(s) { let k=norm(s).replace(/\bst\b/g,'saint').replace(/\bstate university\b/g,'state'); return alias[k] || k; }
const ratingMap = new Map(ratings.map(r => [key(r.team),r]));
function rating(...names) { for(const n of names){const r=ratingMap.get(key(n)); if(r)return r;} return null; }
const dayCT = d => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const dayDiff = (a,b) => Math.abs((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);
const same = (a,b) => key(a) === key(b);
const names = c => [c.team?.shortDisplayName,c.team?.displayName,c.team?.name,c.team?.location].filter(Boolean);
function teamMatches(stored, c) { const r=rating(stored); return names(c).some(n => same(stored,n) || (r && rating(n)?.team===r.team)); }
function fillPrediction(g,awayNames=[],homeNames=[]) {
  if(g.modelSpread!=null && g.modelFavorite) return false;
  const a=rating(g.away,...awayNames), h=rating(g.home,...homeNames);
  if(!a || !h) return false;
  const av=efficiency[a.rank-1], hv=efficiency[h.rank-1];
  if(!Number.isFinite(av)||!Number.isFinite(hv))return false;
  const margin=.7*(hv-av)+(g.site==='Neutral'?0:3);
  g.modelFavorite=margin>=0?g.home:g.away;
  g.modelSpread=-Math.round(Math.abs(margin)*10)/10;
  return true;
}
let fetched=0,added=0,linked=0,finals=0,backfilled=0,unmatched=[];
const now=new Date();
const lookback=Number(process.env.SYNC_LOOKBACK_DAYS||14);
const forward=Number(process.env.SYNC_FORWARD_DAYS||7);
const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-lookback));
const seen=new Set();
for(let offset=0;offset<=lookback+forward;offset++) {
  const day=new Date(start);day.setUTCDate(start.getUTCDate()+offset);
  const date=day.toISOString().slice(0,10), stamp=date.replaceAll('-','');
  // Some ESPN schedules differ by scoreboard group; merge the two feeds by event ID.
  const events=new Map();
  for(const suffix of ['&groups=50','']) {
    const url=`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${stamp}&limit=500${suffix}`;
    try { const response=await fetch(url); if(!response.ok)throw Error(`HTTP ${response.status}`);
      const body=await response.json(); for(const event of body.events||[]) events.set(String(event.id),event);
    } catch(e) { console.warn(`ESPN request failed ${date} ${suffix||'all'}: ${e.message}`); }
  }
  for(const event of events.values()) {
    if(seen.has(String(event.id)))continue;seen.add(String(event.id));
    const comp=event.competitions?.[0]; if(!comp)continue;
    const away=comp.competitors?.find(c=>c.homeAway==='away');
    const home=comp.competitors?.find(c=>c.homeAway==='home');
    if(!away||!home)continue;
    fetched++;
    const eventDate=new Date(event.date||comp.date||date+'T12:00:00Z');
    const centralDate=Number.isFinite(eventDate.getTime())?dayCT(eventDate):date;
    const options=games.filter(g => !g.espnId && g.date && dayDiff(g.date,centralDate)<=1 && teamMatches(g.away,away) && teamMatches(g.home,home));
    let g=games.find(g=>String(g.espnId||'')===String(event.id));
    if(!g && options.length===1) { g=options[0]; linked++; console.log(`LINKED ${event.id}: ${g.date} ${g.away} @ ${g.home}`); }
    if(!g && options.length>1) { unmatched.push(`AMBIGUOUS ${event.id} ${names(away)[0]} @ ${names(home)[0]}`); continue; }
    if(!g) {
      const a=rating(...names(away)),h=rating(...names(home));
      if(!a||!h)continue; // Don't add non-D-I/exhibition games to the ratings board.
      g={id:`espn-${event.id}`,date:centralDate,away:away.team.shortDisplayName||away.team.displayName,
        home:home.team.shortDisplayName||home.team.displayName,source:'ESPN / The Odds API',
        marketFavorite:null,marketSpread:null,awayML:null,homeML:null};
      games.push(g);added++;
    }
    g.espnId=String(event.id);
    if(!g.espnAwayTeamId && away.team?.id)g.espnAwayTeamId=String(away.team.id);
    if(!g.espnHomeTeamId && home.team?.id)g.espnHomeTeamId=String(home.team.id);
    if(!g.site)g.site=comp.neutralSite?'Neutral':'Home';
    if(!g.time && Number.isFinite(eventDate.getTime()))g.time=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit',hour12:false}).format(eventDate);
    if(fillPrediction(g,names(away),names(home)))backfilled++;
    const complete=Boolean(comp.status?.type?.completed || event.status?.type?.completed);
    if(complete) {
      const as=away.score,hs=home.score;
      if(as!=null && hs!=null && as!=='' && hs!=='' && Number.isFinite(Number(as)) && Number.isFinite(Number(hs))) {
        g.awayScore=Number(as);g.homeScore=Number(hs);g.status='final';finals++;
      } else console.warn(`FINAL WITHOUT SCORES ${event.id}: ${g.away} @ ${g.home}`);
    } else if(g.status!=='final')g.status='scheduled';
  }
}
// Backfill original games too, even if ESPN doesn't have a matching event yet.
for(const g of games)if(fillPrediction(g))backfilled++;
if(process.env.ODDS_API_KEY) {
 try {
  const url=`https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds/?apiKey=${encodeURIComponent(process.env.ODDS_API_KEY)}&regions=us&markets=spreads,h2h&oddsFormat=american&dateFormat=iso`;
  const response=await fetch(url);if(!response.ok)throw Error(`Odds API ${response.status}`);
  const odds=await response.json();let updated=0;
  for(const o of odds){
    const d=dayCT(new Date(o.commence_time));
    const matches=games.filter(g=>g.status!=='final'&&g.marketSpread==null&&dayDiff(g.date,d)<=1&&same(g.away,o.away_team)&&same(g.home,o.home_team));
    if(matches.length!==1)continue;
    const g=matches[0],book=o.bookmakers?.find(b=>b.key==='draftkings')||o.bookmakers?.[0];if(!book)continue;
    const spread=book.markets?.find(m=>m.key==='spreads')?.outcomes||[];
    const homeLine=spread.find(s=>same(s.name,o.home_team))?.point;
    if(typeof homeLine!=='number')continue;
    g.marketFavorite=homeLine<0?g.home:g.away;g.marketSpread=-Math.abs(homeLine);
    if(g.modelSpread!=null&&g.modelFavorite){const modelHome=g.modelFavorite===g.home?-g.modelSpread:g.modelSpread;
      g.edge=Math.round(Math.abs(modelHome+homeLine)*10)/10;
      g.confidence=Math.min(5,1+[3,6,10,15].filter(t=>g.edge>=t).length);
    }
    const money=book.markets?.find(m=>m.key==='h2h')?.outcomes||[];
    g.homeML=money.find(m=>same(m.name,o.home_team))?.price??g.homeML??null;
    g.awayML=money.find(m=>same(m.name,o.away_team))?.price??g.awayML??null;
    g.oddsBook=book.title;g.oddsCapturedAt=new Date().toISOString();updated++;
  }
  console.log(`ODDS: ${odds.length} events returned; ${updated} new lines saved.`);
 }catch(e){console.warn('Odds unavailable:',e.message);}
} else console.log('ODDS_API_KEY not set.');
write('games.json',games);
const noId=games.filter(g=>!g.espnId);
const noModel=games.filter(g=>g.modelSpread==null||!g.modelFavorite);
console.log(`SYNC: ESPN events ${fetched}; added ${added}; linked ${linked}; finals seen ${finals}; predictions backfilled ${backfilled}; saved ${games.length}.`);
console.log(`COVERAGE: ${noId.length} without ESPN IDs; ${noModel.length} without model predictions; ${games.filter(g=>g.status==='final').length} final games.`);
for(const g of noId.slice(0,30))console.log(`NO ESPN ID: ${g.date} ${g.away} @ ${g.home}`);
for(const g of noModel.slice(0,30))console.log(`NO MODEL: ${g.date} ${g.away} @ ${g.home}; away rated=${Boolean(rating(g.away))}; home rated=${Boolean(rating(g.home))}`);
for(const msg of unmatched.slice(0,30))console.log(msg);
