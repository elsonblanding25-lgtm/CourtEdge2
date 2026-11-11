
'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Activity,
  BarChart3,
  CalendarDays,
  Search,
  Trophy,
  Target
} from 'lucide-react';

// --------------------------------------
// HELPERS
// --------------------------------------

const format = (n) =>
  n == null ? '—' : Number(n).toFixed(1);

function getGameStart(g) {
  const value =
    g.startTime ||
    g.startDate ||
    g.commenceTime;

  if (!value) return NaN;

  return Date.parse(value);
}

function getNext24HourGames(games, now) {
  const cutoff = now + 24 * 60 * 60 * 1000;

  return games
    .filter((g) => {
      const start = getGameStart(g);

      return (
        Number.isFinite(start) &&
        start >= now &&
        start <= cutoff &&
        g.homeScore == null &&
        g.awayScore == null
      );
    })
    .sort((a, b) => getGameStart(a) - getGameStart(b));
}

function hasMarketSpread(g) {
  return (
    g.marketFavorite != null &&
    g.marketSpread != null &&
    Number.isFinite(Number(g.marketSpread))
  );
}

// Historical ATS grading.
// Preserves the calculation from the
// original website.
function grade(g) {
  if (
    g.awayScore == null ||
    g.homeScore == null ||
    !g.marketFavorite ||
    g.marketSpread == null ||
    !g.modelFavorite ||
    g.modelSpread == null
  ) {
    return null;
  }

  const marketHomeLine =
    g.marketFavorite === g.home
      ? g.marketSpread
      : -g.marketSpread;

  const modelHomeMargin =
    g.modelFavorite === g.home
      ? -g.modelSpread
      : g.modelSpread;

  const edge = modelHomeMargin + marketHomeLine;

  const pick =
    edge > 0
      ? g.home
      : edge < 0
        ? g.away
        : null;

  if (!pick) return null;

  const margin =
    g.homeScore - g.awayScore + marketHomeLine;

  return {
    pick,
    result:
      margin === 0
        ? 'Push'
        : (pick === g.home
            ? margin > 0
            : margin < 0)
          ? 'Win'
          : 'Loss'
  };
}

// --------------------------------------
// MAIN PAGE
// --------------------------------------

export default function Home() {
  const [ratings, setRatings] = useState([]);
  const [games, setGames] = useState([]);

  const [tab, setTab] = useState('Picks');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All games');

  const [now, setNow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // ------------------------------------
  // LOAD DATA
  // ------------------------------------

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        const [ratingsResponse, gamesResponse] =
          await Promise.all([
            fetch('/data/ratings.json'),
            fetch('/data/games.json')
          ]);

        if (!ratingsResponse.ok || !gamesResponse.ok) {
          throw new Error('Could not load CourtEdge data.');
        }

        const [ratingsData, gamesData] =
          await Promise.all([
            ratingsResponse.json(),
            gamesResponse.json()
          ]);

        if (!active) return;

        setRatings(
          Array.isArray(ratingsData) ? ratingsData : []
        );

        setGames(
          Array.isArray(gamesData) ? gamesData : []
        );

        setLoadError('');
      } catch (error) {
        console.error(error);

        if (active) {
          setLoadError(
            'Unable to load basketball data. Please refresh.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    setNow(Date.now());
    loadData();

    // Update the 24-hour window every minute.
    const clock = setInterval(() => {
      setNow(Date.now());
    }, 60 * 1000);

    // Refresh game data every five minutes.
    const refresh = setInterval(() => {
      loadData();
    }, 5 * 60 * 1000);

    return () => {
      active = false;
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, []);

  // ------------------------------------
  // UPCOMING GAMES
  // ------------------------------------

  const upcomingGames = useMemo(() => {
    if (now === null) return [];

    return getNext24HourGames(games, now);
  }, [games, now]);

  const shown = useMemo(() => {
    return upcomingGames.filter((g) => {
      const matchesSearch =
        `${g.away} ${g.home}`
          .toLowerCase()
          .includes(query.toLowerCase());

      const matchesFilter =
        filter === 'All games' ||
        (filter === '3+ edge' && g.edge >= 3) ||
        (
          filter === 'Favorite flips' &&
          g.modelFavorite &&
          g.marketFavorite &&
          g.modelFavorite !== g.marketFavorite
        ) ||
        (
          filter === 'Missing odds' &&
          !hasMarketSpread(g)
        );

      return matchesSearch && matchesFilter;
    });
  }, [upcomingGames, query, filter]);

  // ------------------------------------
  // 24-HOUR MARKET COVERAGE
  // ------------------------------------

  const total24h = upcomingGames.length;

  const withOdds = upcomingGames.filter(
    hasMarketSpread
  ).length;

  const missingOdds = total24h - withOdds;

  const coverage = total24h
    ? `${(100 * withOdds / total24h).toFixed(1)}%`
    : '—';

  // ------------------------------------
  // HISTORICAL PERFORMANCE
  // ------------------------------------

  const graded = games.map(grade).filter(Boolean);

  const wins = graded.filter(
    (g) => g.result === 'Win'
  ).length;

  const losses = graded.filter(
    (g) => g.result === 'Loss'
  ).length;

  const pushes = graded.filter(
    (g) => g.result === 'Push'
  ).length;

  const winRate = wins + losses
    ? `${(100 * wins / (wins + losses)).toFixed(1)}%`
    : '—';

  const kpis = [
    ['ATS RECORD', `${wins}-${losses}-${pushes}`, Target],
    ['ATS WIN RATE', winRate, Activity],
    ['GAMES TRACKED', games.length, CalendarDays],
    [
      '3+ POINT EDGES',
      games.filter((g) => g.edge >= 3).length,
      BarChart3
    ]
  ];

  // ------------------------------------
  // RENDER
  // ------------------------------------

  return (
    <div className="shell">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <div className="brandmark">CE</div>

          <div>
            <strong>COURTEDGE</strong>
            <small>COLLEGE BASKETBALL</small>
          </div>
        </div>

        <div className="navlabel">WORKSPACE</div>

        {[
          ['Picks', CalendarDays],
          ['Power Rankings', Trophy],
          ['ATS Performance', BarChart3]
        ].map(([name, Icon]) => (
          <button
            key={name}
            className={
              'nav ' + (tab === name ? 'active' : '')
            }
            onClick={() => {
              setTab(name);
              setQuery('');
            }}
          >
            <Icon size={18} />
            {name}
          </button>
        ))}

        <div className="sidebarbottom">
          <span className="livepoint" />
          {' '}MODEL V12
          <p>80% BQ baseline · 20% custom</p>
          <p>2026–27 Season</p>
        </div>

      </aside>

      {/* MAIN CONTENT */}
      <main className="main">

        <div className="topline">
          <span>2026–27 SEASON / ANALYTICS</span>
          <span className="pill">
            ● COURTEDGE MODEL V12
          </span>
        </div>

        <header>
          <div>
            <div className="eyebrow">
              THE NUMBERS BEHIND THE GAME
            </div>

            <h1>
              {tab === 'Picks'
                ? 'Daily Predictions'
                : tab === 'Power Rankings'
                  ? 'Power Rankings'
                  : 'ATS Performance'}
            </h1>

            <p className="subtitle">
              Independent college basketball projections
              powered by our custom ratings.
            </p>
          </div>
        </header>

        {/* EXISTING KPI CARDS */}
        <div className="stats">
          {kpis.map(([label, value, Icon]) => (
            <div className="stat" key={label}>
              <div className="stathead">
                {label}
                <Icon size={17} />
              </div>

              <div className="statval">
                {value}
              </div>
            </div>
          ))}
        </div>

        {loadError && (
          <div className="empty">{loadError}</div>
        )}

        {/* ==================================
            PICKS: NEXT 24 HOURS
           ================================== */}

        {tab === 'Picks' ? (

          <section className="panel">

            <div className="sectionhead">
              <div>
                <h2>Upcoming Games — Next 24 Hours</h2>
                <p>
                  Model predictions and sportsbook
                  coverage for upcoming Division I games
                </p>
              </div>

              <div className="tools">

                <span className="pill">
                  NEXT 24 HOURS
                </span>

                <select
                  value={filter}
                  onChange={(e) =>
                    setFilter(e.target.value)
                  }
                >
                  {[
                    'All games',
                    '3+ edge',
                    'Favorite flips',
                    'Missing odds'
                  ].map((option) => (
                    <option key={option}>
                      {option}
                    </option>
                  ))}
                </select>

                <div className="search">
                  <Search size={15} />

                  <input
                    value={query}
                    onChange={(e) =>
                      setQuery(e.target.value)
                    }
                    placeholder="Search teams"
                  />
                </div>

              </div>
            </div>

            {/* 24-HOUR ODDS COVERAGE TRACKER */}
            <div className="stats" style={{
              padding: '16px',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(145px, 1fr))'
            }}>

              {[
                ['24H GAMES', total24h],
                ['WITH SPREADS', withOdds],
                ['MISSING SPREADS', missingOdds],
                ['ODDS COVERAGE', coverage]
              ].map(([label, value]) => (
                <div className="stat" key={label}>
                  <div className="stathead">
                    {label}
                  </div>

                  <div className="statval">
                    {value}
                  </div>
                </div>
              ))}

            </div>

            <div className="tablewrap">
              <table>

                <thead>
                  <tr>
                    <th>TIME (CT)</th>
                    <th>MATCHUP</th>
                    <th>MODEL PICK</th>
                    <th>MARKET</th>
                    <th>EDGE</th>
                    <th>CONF.</th>
                    <th>ODDS STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {shown.map((g) => {
                    const flip =
                      g.modelFavorite &&
                      g.marketFavorite &&
                      g.modelFavorite !==
                        g.marketFavorite;

                    const hasOdds = hasMarketSpread(g);

                    return (
                      <tr key={g.id}>

                        <td className="muted">
                          {g.time || '—'}
                        </td>

                        <td>
                          <b>{g.away}</b>
                          <span className="at"> at </span>
                          <b>{g.home}</b>

                          <div className="tiny">
                            {g.site === 'Neutral'
                              ? 'Neutral site'
                              : 'Home court'}

                            {flip && (
                              <span className="flag">
                                FAVORITE FLIP
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="pick">
                          {g.modelFavorite
                            ? `${g.modelFavorite} ${format(g.modelSpread)}`
                            : '—'}
                        </td>

                        <td>
                          {hasOdds
                            ? g.marketSpread === 0
                              ? 'PK 0'
                              : `${g.marketFavorite} ${format(g.marketSpread)}`
                            : '—'}
                        </td>

                        <td>
                          {g.edge != null ? (
                            <span className={
                              g.edge >= 3
                                ? 'edge strong'
                                : 'edge'
                            }>
                              {g.edge >= 3 ? '+' : ''}
                              {format(g.edge)}
                              {g.edge >= 3 ? ' ⚑' : ''}
                            </span>
                          ) : '—'}
                        </td>

                        <td>
                          {g.confidence
                            ? `${g.confidence}/5`
                            : '—'}
                        </td>

                        <td>
                          <span className={
                            'result ' +
                            (hasOdds ? 'Win' : '')
                          }>
                            {hasOdds
                              ? 'Spread saved'
                              : 'Missing odds'}
                          </span>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>

              {!loading && !shown.length && (
                <div className="empty">
                  No upcoming games match this filter.
                </div>
              )}

              {loading && (
                <div className="empty">
                  Loading games...
                </div>
              )}
            </div>

            <div className="footnote">
              The 24-hour window updates every minute.
              Game data refreshes every five minutes.
              Sportsbook lines are saved snapshots,
              not guaranteed live quotes.
              Missing lines remain visible.
            </div>

          </section>

        ) : tab === 'Power Rankings' ? (

          /* ==================================
             POWER RANKINGS
             ================================== */

          <section className="panel">

            <div className="sectionhead">
              <div>
                <h2>National power ratings</h2>
                <p>
                  Division I team rankings · Version 12
                </p>
              </div>

              <div className="search">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(e) =>
                    setQuery(e.target.value)
                  }
                  placeholder="Search teams"
                />
              </div>
            </div>

            <div className="tablewrap">
              <table>

                <thead>
                  <tr>
                    <th>RANK</th>
                    <th>TEAM</th>
                    <th>CONFERENCE</th>
                    <th>MODEL RATING</th>
                    <th>BQ RANK</th>
                  </tr>
                </thead>

                <tbody>
                  {ratings
                    .filter((r) =>
                      r.rank &&
                      r.team
                        .toLowerCase()
                        .includes(query.toLowerCase())
                    )
                    .sort((a, b) => a.rank - b.rank)
                    .map((r) => (
                      <tr key={r.team}>
                        <td className="rank">
                          #{r.rank}
                        </td>

                        <td>
                          <b>{r.team}</b>
                        </td>

                        <td className="muted">
                          {r.conference || '—'}
                        </td>

                        <td className="pick">
                          {format(r.score)}
                        </td>

                        <td>
                          {r.bqRank != null
                            ? `#${r.bqRank}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>

              </table>
            </div>

          </section>

        ) : (

          /* ==================================
             ATS PERFORMANCE
             ================================== */

          <section className="panel">

            <div className="sectionhead">
              <div>
                <h2>
                  Against-the-spread performance
                </h2>

                <p>
                  Historical performance from
                  saved market lines and final scores
                </p>
              </div>
            </div>

            <div className="performance">

              <div className="performancecard">
                <span>Overall ATS</span>
                <strong>
                  {wins}-{losses}-{pushes}
                </strong>
                <p>Wins · Losses · Pushes</p>
              </div>

              <div className="performancecard">
                <span>Win percentage</span>
                <strong>{winRate}</strong>
                <p>Pushes excluded</p>
              </div>

              <div className="performancecard">
                <span>Flat-unit profit*</span>
                <strong>
                  {(
                    wins * (100 / 110) -
                    losses
                  ).toFixed(2)}u
                </strong>
                <p>Illustrative -110 pricing</p>
              </div>

            </div>

            <h3 className="subhead">
              Confidence breakdown
            </h3>

            <div className="tablewrap">
              <table>

                <thead>
                  <tr>
                    <th>CONFIDENCE</th>
                    <th>WINS</th>
                    <th>LOSSES</th>
                    <th>ATS WIN %</th>
                  </tr>
                </thead>

                <tbody>
                  {[1, 2, 3, 4, 5].map((n) => {
                    const group = games
                      .filter((g) =>
                        g.confidence === n
                      )
                      .map(grade)
                      .filter(Boolean);

                    const w = group.filter(
                      (g) => g.result === 'Win'
                    ).length;

                    const l = group.filter(
                      (g) => g.result === 'Loss'
                    ).length;

                    return (
                      <tr key={n}>
                        <td>{n}/5</td>
                        <td>{w}</td>
                        <td>{l}</td>
                        <td>
                          {w + l
                            ? (
                              100 * w / (w + l)
                            ).toFixed(1) + '%'
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>

            <div className="footnote">
              *Profit assumes -110 spread odds
              and 1 unit risked per graded pick.
              Actual sportsbook prices may differ.
            </div>

          </section>

        )}

        <footer>
          COURTEDGE ANALYTICS
          <span>
            Independent projections · Not financial advice
          </span>
        </footer>

      </main>
    </div>
  );
}
