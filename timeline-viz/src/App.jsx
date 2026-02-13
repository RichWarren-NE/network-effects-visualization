import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import './App.css';
import FilterControls from './FilterControls';
import Timeline from './Timeline';
import InsightsPanel from './InsightsPanel';
import { renderFilmRow, statusGroup, statusColor } from './filmRow';

const TABS = [
  { id: 'most-traveled', label: 'Most Traveled' },
  { id: 'search', label: 'Search Film' },
  { id: 'compare', label: 'Compare' },
  { id: 'aggregate', label: 'Aggregate' },
];

const DEFAULT_FILTERS = {
  country: '', genre: '', yearMin: '', yearMax: '',
  minFest: '1', awardsOnly: false, ukOnly: false, sort: 'festivals-desc',
};

function escHtml(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '\u2026' : s; }

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('most-traveled');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [tooltip, setTooltip] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilm, setSelectedFilm] = useState(null);
  const searchTimelineRef = useRef(null);

  // Compare state
  const [compareQuery, setCompareQuery] = useState('');
  const [compareFilms, setCompareFilms] = useState([]);
  const compareTimelineRef = useRef(null);

  // Aggregate refs
  const heatmapRef = useRef(null);
  const durationRef = useRef(null);

  // Load data
  useEffect(() => {
    fetch('/timeline_data.json')
      .then(r => r.json())
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  // Filter + sort films
  const filteredFilms = useMemo(() => {
    if (!data) return [];
    const { country, genre, yearMin, yearMax, minFest, awardsOnly, ukOnly, sort } = filters;
    const yMin = parseInt(yearMin) || 0;
    const yMax = parseInt(yearMax) || 9999;
    const mf = parseInt(minFest) || 1;

    let result = data.films.filter(f => {
      if (country && (!f.country_codes || !f.country_codes.split(', ').includes(country))) return false;
      if (genre && (!f.genres || !f.genres.split(', ').includes(genre))) return false;
      if (f.first_screening_year < yMin || f.first_screening_year > yMax) return false;
      if (f.total_festivals < mf) return false;
      if (awardsOnly && !f.has_awards) return false;
      if (ukOnly && !f.is_uk) return false;
      return true;
    });

    const [field, dir] = sort.split('-');
    result.sort((a, b) => {
      let va, vb;
      if (field === 'festivals') { va = a.total_festivals; vb = b.total_festivals; }
      else if (field === 'span') { va = a.circulation_span_years; vb = b.circulation_span_years; }
      else if (field === 'year') { va = a.first_screening_year; vb = b.first_screening_year; }
      else if (field === 'title') { va = a.title.toLowerCase(); vb = b.title.toLowerCase(); }
      if (dir === 'desc') return vb > va ? 1 : vb < va ? -1 : 0;
      return va > vb ? 1 : va < vb ? -1 : 0;
    });
    return result;
  }, [data, filters]);

  // Search matches
  const searchMatches = useMemo(() => {
    if (!data || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return data.films.filter(f =>
      (f.title && f.title.toLowerCase().includes(q)) ||
      (f.original_title && f.original_title.toLowerCase().includes(q)) ||
      (f.directors && f.directors.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [data, searchQuery]);

  // Compare suggestions
  const compareSuggestions = useMemo(() => {
    if (!data || compareQuery.length < 2) return [];
    const q = compareQuery.toLowerCase();
    return data.films.filter(f =>
      !compareFilms.find(cf => cf.film_id === f.film_id) &&
      ((f.title && f.title.toLowerCase().includes(q)) ||
       (f.directors && f.directors.toLowerCase().includes(q)))
    ).slice(0, 10);
  }, [data, compareQuery, compareFilms]);

  // Render search detail timeline
  useEffect(() => {
    if (!selectedFilm || !searchTimelineRef.current) return;
    const el = searchTimelineRef.current;
    el.innerHTML = '';
    const events = selectedFilm.screening_timeline;
    if (!events || events.length === 0) return;

    const yearMin = events[0].event_year - 1;
    const yearMax = events[events.length - 1].event_year + 1;
    const width = Math.max(800, (yearMax - yearMin) * 80);
    const height = 120;
    const xScale = d3.scaleLinear().domain([yearMin, yearMax]).range([40, width - 40]);

    const svg = d3.select(el).append('svg').attr('width', width).attr('height', height);

    const ticks = [];
    for (let y = yearMin; y <= yearMax; y++) ticks.push(y);
    svg.selectAll('.tick-line').data(ticks).enter().append('line')
      .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
      .attr('y1', 30).attr('y2', 50).attr('stroke', '#e5e7eb');
    svg.selectAll('.tick-label').data(ticks).enter().append('text')
      .attr('x', d => xScale(d)).attr('y', 24).attr('text-anchor', 'middle')
      .attr('fill', '#6b7280').attr('font-size', 10).text(d => d);

    const firstX = xScale(events[0].event_year);
    const lastX = xScale(events[events.length - 1].event_year);
    svg.append('line').attr('x1', firstX).attr('y1', 40).attr('x2', lastX).attr('y2', 40)
      .attr('stroke', '#d1d5db').attr('stroke-width', 2);

    const byYear = {};
    events.forEach(e => { if (!byYear[e.event_year]) byYear[e.event_year] = []; byYear[e.event_year].push(e); });

    Object.entries(byYear).forEach(([year, yearEvents]) => {
      const x = xScale(+year);
      yearEvents.forEach((e, j) => {
        const n = yearEvents.length;
        const offset = n > 1 ? (j - (n - 1) / 2) * 14 : 0;
        const cx = x + offset;
        const sg = statusGroup(e.status);
        const color = statusColor(sg);

        svg.append('circle').attr('cx', cx).attr('cy', 40).attr('r', sg === 'won' ? 5 : 4)
          .attr('fill', color).attr('stroke', sg === 'won' ? '#a16207' : 'none').attr('stroke-width', 1);

        svg.append('text').attr('x', cx).attr('y', 52)
          .attr('transform', `rotate(35, ${cx}, 52)`)
          .attr('font-size', 9).attr('fill', '#4b5563')
          .text(truncate(e.festival, 30) + (sg !== 'screening' ? ' \u2605' : ''));
      });
    });
  }, [selectedFilm]);

  // Render compare timeline
  useEffect(() => {
    if (!compareTimelineRef.current) return;
    const el = compareTimelineRef.current;
    el.innerHTML = '';
    if (compareFilms.length === 0) return;

    let yearMin = Infinity, yearMax = -Infinity;
    compareFilms.forEach(f => {
      if (f.first_screening_year < yearMin) yearMin = f.first_screening_year;
      if (f.last_screening_year > yearMax) yearMax = f.last_screening_year;
    });
    yearMin -= 1; yearMax += 1;

    const width = 800;
    const rowH = 50;
    const height = compareFilms.length * rowH + 40;
    const xScale = d3.scaleLinear().domain([yearMin, yearMax]).range([250, width - 20]);

    const svg = d3.select(el).append('svg').attr('width', width).attr('height', height);

    const ticks = [];
    for (let y = Math.ceil(yearMin); y <= yearMax; y++) ticks.push(y);
    svg.selectAll('.tick-label').data(ticks).enter().append('text')
      .attr('x', d => xScale(d)).attr('y', 16).attr('text-anchor', 'middle')
      .attr('fill', '#6b7280').attr('font-size', 10).text(d => d);

    compareFilms.forEach((film, i) => {
      const cy = 30 + i * rowH + rowH / 2;
      svg.append('text').attr('x', 8).attr('y', cy + 4).attr('font-size', 11)
        .attr('fill', '#1f2937').text(truncate(film.title, 35));
      if (i % 2 === 1) {
        svg.append('rect').attr('x', 240).attr('y', cy - rowH / 2 + 5)
          .attr('width', width - 240).attr('height', rowH).attr('fill', '#f8f9fa');
      }
      renderFilmRow(svg, film, cy, xScale, {
        onTooltipShow: (evt, event, pos, total, f) => {
          setTooltip({
            x: Math.min(evt.clientX + 12, window.innerWidth - 320),
            y: Math.min(evt.clientY - 10, window.innerHeight - 100),
            festival: event.festival, year: event.event_year,
            status: event.status, category: event.category,
            pos, total, filmTitle: f.title,
          });
        },
        onTooltipHide: () => setTooltip(null),
      });
    });
  }, [compareFilms, setTooltip]);

  // Render aggregate charts
  useEffect(() => {
    if (activeTab !== 'aggregate' || !data) return;
    renderHeatmap();
    renderDurationChart();
  }, [activeTab, data]);

  const renderHeatmap = useCallback(() => {
    if (!heatmapRef.current || !data) return;
    const el = heatmapRef.current;
    el.innerHTML = '';
    const heatmap = data.aggregate.heatmap_data;
    if (!heatmap || heatmap.length === 0) return;

    const prodYears = [...new Set(heatmap.map(d => d.production_year))].sort((a, b) => a - b);
    const screenYears = [...new Set(heatmap.map(d => d.screening_year))].sort((a, b) => a - b);
    const maxCount = d3.max(heatmap, d => d.count);

    const cellSize = 18;
    const marginLeft = 50;
    const marginTop = 40;
    const width = marginLeft + screenYears.length * cellSize + 20;
    const height = marginTop + prodYears.length * cellSize + 20;

    const svg = d3.select(el).append('svg').attr('width', width).attr('height', height);
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxCount]);

    const lookup = {};
    heatmap.forEach(d => { lookup[`${d.production_year}-${d.screening_year}`] = d.count; });

    svg.selectAll('.py-label').data(prodYears).enter().append('text')
      .attr('x', marginLeft - 4).attr('y', (d, i) => marginTop + i * cellSize + cellSize / 2 + 3)
      .attr('text-anchor', 'end').attr('font-size', 9).attr('fill', '#6b7280').text(d => d);

    svg.selectAll('.sy-label').data(screenYears).enter().append('text')
      .attr('x', (d, i) => marginLeft + i * cellSize + cellSize / 2)
      .attr('y', marginTop - 6).attr('text-anchor', 'middle')
      .attr('font-size', 9).attr('fill', '#6b7280')
      .attr('transform', (d, i) => `rotate(-45, ${marginLeft + i * cellSize + cellSize / 2}, ${marginTop - 6})`)
      .text(d => `'${String(d).slice(2)}`);

    prodYears.forEach((py, yi) => {
      screenYears.forEach((sy, xi) => {
        const count = lookup[`${py}-${sy}`] || 0;
        if (count === 0) return;
        svg.append('rect')
          .attr('x', marginLeft + xi * cellSize).attr('y', marginTop + yi * cellSize)
          .attr('width', cellSize - 1).attr('height', cellSize - 1)
          .attr('fill', color(count)).attr('rx', 2)
          .on('mouseenter', (evt) => {
            setTooltip({
              x: evt.clientX + 12, y: evt.clientY - 10,
              festival: `Production: ${py}, Screening: ${sy}`,
              year: null, status: `${count} screening(s)`, filmTitle: null,
            });
          })
          .on('mouseleave', () => setTooltip(null));
      });
    });
  }, [data, setTooltip]);

  const renderDurationChart = useCallback(() => {
    if (!durationRef.current || !data) return;
    const el = durationRef.current;
    el.innerHTML = '';

    const spanDist = data.aggregate.span_distribution;
    const awardedSpans = {};
    const ukSpans = {};
    data.films.forEach(f => {
      const s = f.circulation_span_years;
      if (f.has_awards) awardedSpans[s] = (awardedSpans[s] || 0) + 1;
      if (f.is_uk) ukSpans[s] = (ukSpans[s] || 0) + 1;
    });

    const displaySpans = Object.keys(spanDist).map(Number).filter(s => s <= 10).sort((a, b) => a - b);
    const barWidth = 40;
    const groupWidth = barWidth * 3 + 10;
    const marginLeft = 50;
    const marginBottom = 40;
    const marginTop = 20;
    const chartWidth = marginLeft + displaySpans.length * groupWidth + 20;
    const chartHeight = 250;

    const maxVal = d3.max(displaySpans, s => spanDist[String(s)] || 0) || 1;
    const yScale = d3.scaleLinear().domain([0, maxVal]).range([chartHeight - marginBottom, marginTop]);

    const svg = d3.select(el).append('svg').attr('width', chartWidth).attr('height', chartHeight);

    const yTicks = yScale.ticks(5);
    yTicks.forEach(t => {
      svg.append('line').attr('x1', marginLeft).attr('x2', chartWidth - 20)
        .attr('y1', yScale(t)).attr('y2', yScale(t)).attr('stroke', '#f3f4f6');
      svg.append('text').attr('x', marginLeft - 6).attr('y', yScale(t) + 3)
        .attr('text-anchor', 'end').attr('font-size', 10).attr('fill', '#6b7280').text(t);
    });

    displaySpans.forEach((span, i) => {
      const gx = marginLeft + i * groupWidth + 5;
      const allCount = spanDist[String(span)] || 0;
      const awardCount = awardedSpans[span] || 0;
      const ukCount = ukSpans[span] || 0;

      svg.append('rect').attr('x', gx).attr('y', yScale(allCount))
        .attr('width', barWidth - 2).attr('height', yScale(0) - yScale(allCount))
        .attr('fill', '#93c5fd').attr('rx', 2);
      svg.append('rect').attr('x', gx + barWidth).attr('y', yScale(awardCount))
        .attr('width', barWidth - 2).attr('height', yScale(0) - yScale(awardCount))
        .attr('fill', '#eab308').attr('rx', 2);
      svg.append('rect').attr('x', gx + barWidth * 2).attr('y', yScale(ukCount))
        .attr('width', barWidth - 2).attr('height', yScale(0) - yScale(ukCount))
        .attr('fill', '#60a5fa').attr('rx', 2);

      svg.append('text').attr('x', gx + barWidth * 1.5).attr('y', chartHeight - marginBottom + 16)
        .attr('text-anchor', 'middle').attr('font-size', 10).attr('fill', '#6b7280').text(span + 'y');
    });

    [{ label: 'All', color: '#93c5fd' }, { label: 'Awarded', color: '#eab308' }, { label: 'UK', color: '#60a5fa' }].forEach((l, i) => {
      svg.append('rect').attr('x', marginLeft + i * 80).attr('y', marginTop - 8).attr('width', 12).attr('height', 12).attr('fill', l.color).attr('rx', 2);
      svg.append('text').attr('x', marginLeft + i * 80 + 16).attr('y', marginTop + 2).attr('font-size', 10).attr('fill', '#6b7280').text(l.label);
    });
  }, [data]);

  if (error) return <div style={{ padding: 40, color: '#ef4444' }}>Error loading data: {error}</div>;
  if (!data) return <div style={{ padding: 40 }}>Loading timeline data...</div>;

  return (
    <>
      {/* Header */}
      <div className="header">
        <h1>Film Circulation Timeline</h1>
        <div className="sep" />
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
        <div className="sep" />
        <div className="legend">
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--screening)' }} />Screening</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--won)' }} />Won</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--nominated)' }} />Nominated</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--mention)' }} />Mention</div>
        </div>
      </div>

      {/* Filters (Most Traveled only) */}
      {activeTab === 'most-traveled' && (
        <FilterControls data={data} filters={filters} onFilterChange={setFilters} />
      )}

      {/* Main content */}
      <div className="main-layout">
        {/* Most Traveled */}
        {activeTab === 'most-traveled' && (
          <>
            <Timeline films={filteredFilms} tooltip={tooltip} setTooltip={setTooltip} />
            <InsightsPanel films={filteredFilms} />
          </>
        )}

        {/* Search */}
        {activeTab === 'search' && (
          <div className="search-tab">
            <input className="search-input" type="text" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSelectedFilm(null); }}
              placeholder="Search by title, director, or original title..." />
            <div style={{ marginTop: 8 }}>
              {searchMatches.map(f => (
                <div key={f.film_id} className="search-result" onClick={() => { setSelectedFilm(f); setSearchQuery(f.title); }}>
                  {f.title} <span style={{ color: 'var(--text-dim)' }}>({f.directors || 'Unknown'}, {f.production_year || '?'}) &mdash; {f.total_festivals} festivals</span>
                </div>
              ))}
            </div>
            {selectedFilm && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 16, marginBottom: 6 }}>{selectedFilm.title}</h3>
                {selectedFilm.original_title && selectedFilm.original_title !== selectedFilm.title && (
                  <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 4 }}>{selectedFilm.original_title}</div>
                )}
                <div>Director(s): {selectedFilm.directors || 'Unknown'}</div>
                <div>Countries: {selectedFilm.countries || '?'} | Year: {selectedFilm.production_year || '?'} | Duration: {selectedFilm.duration ? selectedFilm.duration + ' min' : '?'}</div>
                <div>Genres: {selectedFilm.genres || 'None'}</div>
                <div style={{ marginTop: 4 }}>
                  {selectedFilm.total_festivals} festivals, {selectedFilm.total_screenings} screenings, span {selectedFilm.circulation_span_years} years ({selectedFilm.first_screening_year}&ndash;{selectedFilm.last_screening_year})
                </div>
                <div>Awards: {selectedFilm.awards_won} wins, {selectedFilm.nominations} nominations, {selectedFilm.mentions} mentions</div>
                <div ref={searchTimelineRef} style={{ marginTop: 12, overflowX: 'auto' }} />
              </div>
            )}
          </div>
        )}

        {/* Compare */}
        {activeTab === 'compare' && (
          <div className="compare-tab">
            <input className="search-input" type="text" value={compareQuery}
              onChange={e => setCompareQuery(e.target.value)}
              placeholder="Search films to compare (max 10)..." />
            <div style={{ marginTop: 8 }}>
              {compareSuggestions.map(f => (
                <div key={f.film_id} className="search-result" onClick={() => {
                  if (compareFilms.length < 10) {
                    setCompareFilms(prev => [...prev, f]);
                    setCompareQuery('');
                  }
                }}>
                  {f.title} <span style={{ color: 'var(--text-dim)' }}>({f.total_festivals} fest.)</span>
                </div>
              ))}
            </div>
            <div className="compare-chips">
              {compareFilms.map((f, i) => (
                <span key={f.film_id} className="compare-chip">
                  {truncate(f.title, 30)}
                  <span className="remove" onClick={() => setCompareFilms(prev => prev.filter((_, j) => j !== i))}>&times;</span>
                </span>
              ))}
            </div>
            <div ref={compareTimelineRef} style={{ marginTop: 16 }} />
            {compareFilms.length > 0 && (
              <table className="compare-table">
                <thead><tr><th>Film</th><th>Festivals</th><th>Screenings</th><th>Span</th><th>Awards</th><th>First Year</th></tr></thead>
                <tbody>
                  {compareFilms.map(f => (
                    <tr key={f.film_id}>
                      <td style={{ textAlign: 'left' }}>{f.title}</td>
                      <td>{f.total_festivals}</td>
                      <td>{f.total_screenings}</td>
                      <td>{f.circulation_span_years}y</td>
                      <td>{f.awards_won}</td>
                      <td>{f.first_screening_year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Aggregate */}
        {activeTab === 'aggregate' && (
          <div className="aggregate-tab">
            <div className="agg-section">
              <h3>Screening Heatmap: Production Year x Screening Year</h3>
              <div ref={heatmapRef} />
            </div>
            <div className="agg-section">
              <h3>Circulation Duration Distribution</h3>
              <div ref={durationRef} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="bottom-bar">
        <span>Note: Only event_year available (no month). All 754 films screened at Encounters.</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tt-festival">{tooltip.festival}</div>
          {tooltip.year && <div>{tooltip.year} &middot; {tooltip.status}{tooltip.category ? ` (${tooltip.category})` : ''}</div>}
          {!tooltip.year && <div>{tooltip.status}</div>}
          {tooltip.pos && <div className="tt-dim">{tooltip.pos} of {tooltip.total} festivals for this film</div>}
          {tooltip.filmTitle && <div className="tt-dim">{tooltip.filmTitle}</div>}
        </div>
      )}
    </>
  );
}
