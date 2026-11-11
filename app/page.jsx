'use client';
import {useEffect,useMemo,useState} from 'react';
import {Activity,ArrowUpRight,BarChart3,CalendarDays,Search,Trophy,Target} from 'lucide-react';
const format=n=>n==null?'—':Number(n).toFixed(1);

function getNext24HourGames(games) {
  const now = Date.now();
  const cutoff = now + 24 * 60 * 60 * 1000;

  return games
    .filter(g => {
      const start = Date.parse(g.startTime);

      return (
        Number.isFinite(start) &&
        start >= now &&
        start <= cutoff &&
        g.status !== 'final'
      );
    })
    .sort((a, b) =>
      Date.parse(a.startTime) - Date.parse(b.startTime)
    );
}

function grade(g){if(g.awayScore==null||g.homeScore==null||!g.marketFavorite||g.marketSpread==null||!g.modelFavorite||g.modelSpread==null)return null;const marketHomeLine=g.marketFavorite===g.home?g.marketSpread:-g.marketSpread;const modelHomeMargin=g.modelFavorite===g.home?-g.modelSpread:g.modelSpread;const edge=modelHomeMargin+marketHomeLine;const pick=edge>0?g.home:edge<0?g.away:null;if(!pick)return null;const margin=g.homeScore-g.awayScore+marketHomeLine;return {pick,result:margin===0?'Push':(pick===g.home?margin>0:margin<0)?'Win':'Loss'};}
export default function Home(){const [ratings,setRatings]=useState([]),[games,setGames]=useState([]),[tab,setTab]=useState('Picks'),[query,setQuery]=useState(''),[date,setDate]=useState('2026-11-02'),[filter,setFilter]=useState('All games');useEffect(()=>{Promise.all([fetch('/data/ratings.json').then(r=>r.json()),fetch('/data/games.json').then(r=>r.json())]).then(([a,b])=>{setRatings(a);setGames(b)}).catch(console.error)},[]);const graded=games.map(grade).filter(Boolean),wins=graded.filter(x=>x.result==='Win').length,losses=graded.filter(x=>x.result==='Loss').length,pushes=graded.filter(x=>x.result==='Push').length;const kpis=[['ATS RECORD',`${wins}-${losses}-${pushes}`,Target],['ATS WIN RATE',wins+losses?`${(100*wins/(wins+losses)).toFixed(1)}%`:'—',Activity],['GAMES TRACKED',games.length,CalendarDays],['3+ POINT EDGES',games.filter(g=>g.edge>=3).length,BarChart3]];return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brandmark">CE</div><div><strong>COURTEDGE</strong><small>COLLEGE BASKETBALL</small></div></div><div className="navlabel">WORKSPACE</div>{[['Picks',CalendarDays],['Power Rankings',Trophy],['ATS Performance',BarChart3]].map(([name,Icon])=><button key={name} className={'nav '+(tab===name?'active':'')} onClick={()=>setTab(name)}><Icon size={18}/>{name}</button>)}<div className="sidebarbottom"><span className="livepoint"/> MODEL V12 <p>80% BQ baseline · 20% custom</p><p>2026–27 Season</p></div></aside><main className="main"><div className="topline"><span>2026–27 SEASON / ANALYTICS</span><span className="pill">● PRESEASON MODEL V12</span></div><header><div><div className="eyebrow">THE NUMBERS BEHIND THE GAME</div><h1>{tab==='Picks'?'Daily Predictions':tab==='Power Rankings'?'Power Rankings':'ATS Performance'}</h1><p className="subtitle">Independent college basketball projections powered by our custom preseason ratings.</p></div></header><div className="stats">{kpis.map(([label,val,Icon])=><div className="stat" key={label}><div className="stathead">{label}<Icon size={17}/></div><div className="statval">{val}</div></div>)}</div>{tab==='Picks'?<section className="panel"><div className="sectionhead"><div></div><div className="tools"><span className="pill">NEXT 24 HOURS</span><select value={filter} onChange={e=>setFilter(e.target.value)}>{['All games','3+ edge','Favorite flips','Graded'].map(x=><option key={x}>{x}</option>)}</select><div className="search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search teams"/></div></div></div><div className="tablewrap"><table><thead><tr><th>TIME (CT)</th><th>MATCHUP</th><th>MODEL PICK</th><th>MARKET</th><th>EDGE</th><th>CONF.</th><th>RESULT</th></tr></thead><tbody>{shown.map(g=>{const flip=g.modelFavorite&&g.marketFavorite&&g.modelFavorite!==g.marketFavorite;const gr=grade(g);return <tr key={g.id}><td className="muted">{g.time||'—'}</td><td><b>{g.away}</b><span className="at"> at </span><b>{g.home}</b><div className="tiny">{g.site==='Neutral'?'Neutral site':'Home court'} {flip&&<span className="flag">FAVORITE FLIP</span>}</div></td><td className="pick">{g.modelFavorite?`${g.modelFavorite} ${format(g.modelSpread)}`:'—'}</td><td>{g.marketFavorite?`${g.marketFavorite} ${format(g.marketSpread)}`:'—'}</td><td>{g.edge!=null?<span className={g.edge>=3?'edge strong':'edge'}>{g.edge>=3?'+':''}{format(g.edge)}{g.edge>=3?' ⚑':''}</span>:'—'}</td><td>{g.confidence?`${g.confidence}/5`:'—'}</td><td><span className={'result '+(gr?.result||'')}>{gr?.result||'Pending'}</span></td></tr>})}</tbody></table>{!shown.length&&<div className="empty">No games match this filter.</div>}</div><div className="footnote">Market lines are saved snapshots, not guaranteed live quotes. A missing line is shown as —. Confidence is a heuristic, not a win probability.</div></section>:tab==='Power Rankings'?<section className="panel"><div className="sectionhead"><div><h2>National power ratings</h2><p>364 rated Division I teams · Version 12</p></div><div className="search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search teams"/></div></div><div className="tablewrap"><table><thead><tr><th>RANK</th><th>TEAM</th><th>CONFERENCE</th><th>MODEL RATING</th><th>BQ RANK</th></tr></thead><tbody>{ratings.filter(x=>x.rank&&x.team.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.rank-b.rank).map(x=><tr key={x.team}><td className="rank">#{x.rank}</td><td><b>{x.team}</b></td><td className="muted">{x.conference}</td><td className="pick">{format(x.score)}</td><td>#{x.bqRank}</td></tr>)}</tbody></table></div></section>:<section className="panel"><div className="sectionhead"><div><h2>Against-the-spread performance</h2><p>Graded from saved pregame market lines and final scores</p></div></div><div className="performance"><div className="performancecard"><span>Overall ATS</span><strong>{wins}-{losses}-{pushes}</strong><p>Wins · Losses · Pushes</p></div><div className="performancecard"><span>Win percentage</span><strong>{wins+losses?(100*wins/(wins+losses)).toFixed(1)+'%':'—'}</strong><p>Pushes excluded</p></div><div className="performancecard"><span>Flat-unit profit*</span><strong>{(wins*(100/110)-losses).toFixed(2)}u</strong><p>Illustrative -110 pricing</p></div></div><h3 className="subhead">Confidence breakdown</h3><table><thead><tr><th>CONFIDENCE</th><th>WINS</th><th>LOSSES</th><th>ATS WIN %</th></tr></thead><tbody>{[1,2,3,4,5].map(n=>{const gg=games.filter(g=>g.confidence===n).map(grade).filter(Boolean),w=gg.filter(x=>x.result==='Win').length,l=gg.filter(x=>x.result==='Loss').length;return <tr key={n}><td>{n}/5</td><td>{w}</td><td>{l}</td><td>{w+l?(100*w/(w+l)).toFixed(1)+'%':'—'}</td></tr>})}</tbody></table><div className="footnote">*Profit assumes -110 spread odds and 1 unit risked per graded pick. Actual sportsbook prices may differ. Final scores require the scheduled data sync or manual update to games.json.</div></section>}<footer>COURTEDGE ANALYTICS <span>Independent projections · Not financial advice</span></footer></main></div>}

const shown = useMemo(() => {
  return getNext24HourGames(games).filter(g => {
    const matchesSearch =
      `${g.away} ${g.home}`
        .toLowerCase()
        .includes(query.toLowerCase());

    const matchesFilter =
      filter === 'All games' ||
      (filter === '3+ edge' && g.edge >= 3) ||
      (filter === 'Favorite flips' &&
        g.modelFavorite &&
        g.marketFavorite &&
        g.modelFavorite !== g.marketFavorite);

    return matchesSearch && matchesFilter;
  });
}, [games, query, filter]);

<h2>Upcoming Games — Next 24 Hours</h2>
<p>Model predictions and sportsbook coverage for upcoming Division I games</p>

{['All games','3+ edge','Favorite flips'].map(x=><option key={x}>{x}</option>)}
