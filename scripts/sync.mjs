/** Daily sync: ESPN D-I schedule/finals + optional The Odds API spreads/moneylines.
 * Run `npm run sync`; commit public/data/games.json to publish updates.
 * ODDS_API_KEY is optional; without it market odds are unavailable for new games.
 */
import fs from 'node:fs';
const base=new URL('../public/data/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,base),'utf8'));
const write=(n,data)=>fs.writeFileSync(new URL(n,base),JSON.stringify(data,null,2)+'\n');
const ratings=read('ratings.json').filter(x=>x.rank&&x.bqNet!=null);
const games=read('games.json');
const rankByTeam=new Map(ratings.map(x=>[normalize(x.team),x]));
const efficiency=ratings.map(x=>x.bqNet).sort((a,b)=>b-a);
function normalize(x=''){return x.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,'').replace(/\b(university|college|the|state university)\b/g,'').replace(/\s+/g,' ').trim()}
const aliases={"uconn":"connecticut","ole miss":"ole miss","miami hurricanes":"miami fla","miami oh redhawks":"miami oh","unc":"north carolina","ucf":"ucf","smu":"smu","utsa":"utsa","lsu":"lsu","vcu":"vcu","byu":"byu","tcu":"tcu","ucla":"ucla","usc":"usc","unc asheville":"unc asheville","st johns red storm":"st johns"};
function lookup(name){const key=normalize(name);return rankByTeam.get(key)||rankByTeam.get(aliases[key])||null}
function getDay(d){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}

function teamKey(name = '') {
  const aliases = {
    "liberty flames": "liberty",
    "high point panthers": "high point",
    "grambling state": "grambling",
    "grambling state tigers": "grambling",
    "northern illinois huskies": "northern illinois",
    "app state": "appalachian state",
    "appalachian state mountaineers": "appalachian state",
    "merrimack warriors": "merrimack",
    "winthrop eagles": "winthrop",
    "queens royals": "queens"
  };

  const key = normalize(name)
    .replace(/\bst\b/g, "state")
    .replace(/\s+/g, " ")
    .trim();

  return aliases[key] || key;
}

function near(a, b) {
  return teamKey(a) === teamKey(b);
}

function dateClose(a, b) {
  if (!a || !b) return false;
  const diff = Math.abs(
    Date.parse(a + "T12:00:00Z") -
    Date.parse(b + "T12:00:00Z")
  );
  return diff <= 86400000;
}
const today=new Date();
const days=Number(process.env.SYNC_DAYS||3);
const start=new Date(today);start.setUTCDate(start.getUTCDate()-1);
let fetched=0,added=0,graded=0;
for(let offset=0;offset<days;offset++){
 const day=new Date(start);day.setUTCDate(day.getUTCDate()+offset);
 const date=day.toISOString().slice(0,10);
 const url=`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date.replaceAll('-','')}&limit=500&groups=50`;
 let payload;try{const res=await fetch(url);if(!res.ok)throw Error(`ESPN ${res.status}`);payload=await res.json()}catch(e){console.warn('Schedule unavailable:',date,e.message);continue}
 for(const event of payload.events||[]){
  const comp=event.competitions?.[0];if(!comp)continue;
  const away=comp.competitors?.find(c=>c.homeAway==='away'),home=comp.competitors?.find(c=>c.homeAway==='home');if(!away||!home)continue;
  const awayName=away.team?.displayName||'',homeName=home.team?.displayName||'';

const match =
  games.find(g => String(g.espnId) === String(event.id)) ||
  games.find(g =>
    !g.espnId &&
    dateClose(g.date, date) &&
    (
      near(g.away, awayName) ||
      near(g.away, away.team?.shortDisplayName)
    ) &&
    (
      near(g.home, homeName) ||
      near(g.home, home.team?.shortDisplayName)
    )
  );

if (match && !match.espnId) {
  console.log(
    `Linked ESPN ID ${event.id}: ${match.away} @ ${match.home}`
  );
}
  const g=match||{id:`espn-${event.id}`,espnId:event.id,date,away:away.team?.shortDisplayName||awayName,home:home.team?.shortDisplayName||homeName,source:'ESPN / The Odds API',marketFavorite:null,marketSpread:null,awayML:null,homeML:null};
  g.espnId=event.id;g.status=comp.status?.type?.completed?'final':'scheduled';g.time=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(event.date));g.site=comp.neutralSite?'Neutral':'Home';
  if(!match){const a=lookup(g.away)||lookup(awayName),b=lookup(g.home)||lookup(homeName);if(a&&b){const homeMargin=.7*(efficiency[b.rank-1]-efficiency[a.rank-1])+(comp.neutralSite?0:3);g.modelFavorite=homeMargin>=0?g.home:g.away;g.modelSpread=-Math.round(Math.abs(homeMargin)*10)/10;}else{g.modelFavorite=null;g.modelSpread=null;}games.push(g);added++;}
  if(comp.status?.type?.completed){const a=Number(away.score),b=Number(home.score);if(Number.isFinite(a)&&Number.isFinite(b)){g.awayScore=a;g.homeScore=b;graded++;}}
  fetched++;
 }
}
if(process.env.ODDS_API_KEY){
 try{
  const url=`https://api.the-odds-api.com/v4/sports/basketball_ncaab/odds/?apiKey=${encodeURIComponent(process.env.ODDS_API_KEY)}&regions=us&markets=spreads,h2h&oddsFormat=american&dateFormat=iso`;
  const res=await fetch(url);if(!res.ok)throw Error(`Odds API ${res.status}`);
  const odds=await res.json();
  for(const o of odds){const d=getDay(new Date(o.commence_time));const game=games.find(g=>g.date===d&&(near(g.away,o.away_team)||near(g.home,o.home_team)||normalize(g.away).split(' ').slice(-1)[0]===normalize(o.away_team).split(' ').slice(-1)[0])&&(near(g.home,o.home_team)||normalize(g.home).split(' ').slice(-1)[0]===normalize(o.home_team).split(' ').slice(-1)[0]));
   if(!game||game.marketSpread!=null||game.status==='final')continue; // freeze first saved line
   const book=o.bookmakers?.find(b=>b.key==='draftkings')||o.bookmakers?.[0];if(!book)continue;
   const spreads=book.markets?.find(m=>m.key==='spreads')?.outcomes||[];
   const homeLine=spreads.find(s=>near(s.name,o.home_team))?.point;
   if(typeof homeLine==='number'){
    game.marketFavorite=homeLine<0?game.home:game.away;
    game.marketSpread=-Math.abs(homeLine);
    const modelHomeMargin=game.modelFavorite===game.home?-game.modelSpread:game.modelSpread;
    game.edge=game.modelSpread==null?null:Math.round(Math.abs(modelHomeMargin+homeLine)*10)/10;
    game.confidence=game.edge==null?null:Math.min(5,1+[3,6,10,15].filter(t=>game.edge>=t).length);
    game.oddsBook=book.title;game.oddsCapturedAt=new Date().toISOString();
   }
   const money=book.markets?.find(m=>m.key==='h2h')?.outcomes||[];
   game.homeML=money.find(m=>near(m.name,o.home_team))?.price??null;
   game.awayML=money.find(m=>near(m.name,o.away_team))?.price??null;
  }
 }catch(e){console.warn('Odds unavailable:',e.message)}
}else console.log('ODDS_API_KEY not set; new market lines left blank.');
write('games.json',games);
console.log(`Synced ${fetched} events; added ${added}; ${graded} finals checked; ${games.length} saved games.`);
