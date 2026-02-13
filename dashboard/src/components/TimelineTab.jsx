import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { useFilteredData } from '../hooks/useFilteredData';

const STATUS_GROUPS = {
  'won': '#eab308', 'winner': '#eab308', 'award': '#eab308', 'best': '#eab308',
  'grand prix': '#eab308', 'first prize': '#eab308', 'special prize': '#eab308',
  'nominated': '#94a3b8', 'nomination': '#94a3b8',
  'special mention': '#d97706', 'honourable mention': '#d97706', 'mention': '#d97706',
};

function statusColor(status) {
  if (!status) return '#9ca3af';
  const s = status.toLowerCase();
  for (const [key, color] of Object.entries(STATUS_GROUPS)) {
    if (s.includes(key)) return color;
  }
  return '#9ca3af';
}

function statusGroup(status) {
  if (!status) return 'screening';
  const s = status.toLowerCase();
  if (s.includes('won') || s.includes('winner') || s.includes('award') || s.includes('best') ||
      s.includes('grand prix') || s.includes('first prize') || s.includes('special prize')) return 'won';
  if (s.includes('nominated') || s.includes('nomination')) return 'nominated';
  if (s.includes('mention')) return 'mention';
  return 'screening';
}

const PAGE_SIZE = 40;

export default function TimelineTab() {
  const { filteredFilms } = useFilteredData();
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const rowsRef = useRef(null);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [sort, setSort] = useState('festivals-desc');

  // Sort films
  const sortedFilms = useMemo(() => {
    const films = [...filteredFilms];
    const [field, dir] = sort.split('-');
    films.sort((a, b) => {
      let va, vb;
      if (field === 'festivals') { va = a.total_festivals; vb = b.total_festivals; }
      else if (field === 'span') { va = a.circulation_span_years; vb = b.circulation_span_years; }
      else if (field === 'year') { va = a.first_screening_year; vb = b.first_screening_year; }
      else if (field === 'title') { va = (a.title || '').toLowerCase(); vb = (b.title || '').toLowerCase(); }
      else if (field === 'awards') { va = a.awards_won || 0; vb = b.awards_won || 0; }
      if (dir === 'desc') return vb > va ? 1 : vb < va ? -1 : 0;
      return va > vb ? 1 : va < vb ? -1 : 0;
    });
    return films;
  }, [filteredFilms, sort]);

  const pagedFilms = useMemo(() => {
    return sortedFilms.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [sortedFilms, page]);

  const totalPages = Math.ceil(sortedFilms.length / PAGE_SIZE);

  // Compute year range for axis
  const yearRange = useMemo(() => {
    if (sortedFilms.length === 0) return [2015, 2025];
    const min = d3.min(sortedFilms, f => f.first_screening_year) - 1;
    const max = d3.max(sortedFilms, f => f.last_screening_year) + 1;
    return [Math.max(min, 1995), max];
  }, [sortedFilms]);

  // Render header axis
  useEffect(() => {
    if (!headerRef.current) return;
    const el = headerRef.current;
    el.innerHTML = '';
    const width = 700;
    const xScale = d3.scaleLinear().domain(yearRange).range([0, width]);
    const svg = d3.select(el).append('svg').attr('width', width + 20).attr('height', 22);
    const ticks = [];
    for (let y = Math.ceil(yearRange[0]); y <= yearRange[1]; y += 2) ticks.push(y);
    svg.selectAll('text').data(ticks).enter().append('text')
      .attr('x', d => xScale(d) + 10).attr('y', 14)
      .attr('text-anchor', 'middle').attr('fill', '#6b7280').attr('font-size', 10)
      .text(d => d);
  }, [yearRange]);

  // Render film rows
  useEffect(() => {
    if (!rowsRef.current) return;
    const el = rowsRef.current;
    el.innerHTML = '';
    if (pagedFilms.length === 0) return;

    const width = 700;
    const rowH = 28;
    const xScale = d3.scaleLinear().domain(yearRange).range([0, width]);

    pagedFilms.forEach((film, i) => {
      const row = document.createElement('div');
      row.className = 'tl-row' + (i % 2 === 1 ? ' alt' : '');

      // Label
      const label = document.createElement('div');
      label.className = 'tl-label';
      label.textContent = (film.title || 'Untitled').substring(0, 30) + (film.title && film.title.length > 30 ? '...' : '');
      label.title = `${film.title} (${film.directors || 'Unknown'}, ${film.production_year || '?'})`;
      row.appendChild(label);

      // Stats
      const stats = document.createElement('div');
      stats.className = 'tl-stats';
      stats.textContent = `${film.total_festivals}f ${film.total_screenings}s`;
      row.appendChild(stats);

      // SVG timeline
      const svgWrap = document.createElement('div');
      svgWrap.className = 'tl-svg';
      const svg = d3.select(svgWrap).append('svg')
        .attr('width', width + 20).attr('height', rowH);

      const events = film.screening_timeline || [];
      if (events.length > 0) {
        const first = xScale(events[0].event_year) + 10;
        const last = xScale(events[events.length - 1].event_year) + 10;
        svg.append('line').attr('x1', first).attr('y1', rowH / 2)
          .attr('x2', last).attr('y2', rowH / 2)
          .attr('stroke', '#e5e7eb').attr('stroke-width', 1.5);

        const byYear = {};
        events.forEach(e => {
          if (!byYear[e.event_year]) byYear[e.event_year] = [];
          byYear[e.event_year].push(e);
        });

        Object.entries(byYear).forEach(([year, yEvents]) => {
          const x = xScale(+year) + 10;
          yEvents.forEach((e, j) => {
            const n = yEvents.length;
            const offset = n > 1 ? (j - (n - 1) / 2) * 5 : 0;
            const cx = x + offset;
            const sg = statusGroup(e.status);
            const color = statusColor(e.status);
            const r = sg === 'won' ? 4.5 : sg === 'mention' ? 3.5 : 3;

            svg.append('circle')
              .attr('cx', cx).attr('cy', rowH / 2).attr('r', r)
              .attr('fill', color)
              .attr('stroke', sg === 'won' ? '#a16207' : 'none')
              .attr('stroke-width', sg === 'won' ? 1 : 0)
              .on('mouseenter', (evt) => {
                setTooltip({
                  x: evt.clientX + 12, y: evt.clientY - 10,
                  festival: e.festival, year: e.event_year,
                  status: e.status || 'Screening', category: e.category,
                  filmTitle: film.title,
                });
              })
              .on('mouseleave', () => setTooltip(null));
          });
        });
      }

      row.appendChild(svgWrap);
      el.appendChild(row);
    });
  }, [pagedFilms, yearRange]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filteredFilms]);

  if (sortedFilms.length === 0) {
    return <div className="tab-empty">No films match current filters.</div>;
  }

  return (
    <div className="timeline-tab">
      <div className="viz-toolbar">
        <span className="viz-info">{sortedFilms.length} films</span>
        <div className="sort-controls">
          <label>Sort:</label>
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="festivals-desc">Most Festivals</option>
            <option value="festivals-asc">Fewest Festivals</option>
            <option value="span-desc">Longest Span</option>
            <option value="awards-desc">Most Awards</option>
            <option value="year-desc">Newest First</option>
            <option value="year-asc">Oldest First</option>
            <option value="title-asc">Title A-Z</option>
          </select>
        </div>
        <div className="legend-row">
          <span className="legend-item"><span className="legend-dot" style={{ background: '#9ca3af' }} />Screening</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#eab308' }} />Won</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#94a3b8' }} />Nominated</span>
          <span className="legend-item"><span className="legend-dot" style={{ background: '#d97706' }} />Mention</span>
        </div>
      </div>

      <div className="tl-header" ref={headerRef} />
      <div className="tl-rows" ref={rowsRef} />

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span>Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {tooltip && (
        <div className="float-tooltip" style={{ left: tooltip.x, top: tooltip.y, position: 'fixed' }}>
          <div className="tt-title">{tooltip.festival}</div>
          <div className="tt-row">{tooltip.year} &middot; {tooltip.status}{tooltip.category ? ` (${tooltip.category})` : ''}</div>
          {tooltip.filmTitle && <div className="tt-row" style={{ opacity: 0.7 }}>{tooltip.filmTitle}</div>}
        </div>
      )}
    </div>
  );
}
