import { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { renderFilmRow, statusGroup } from './filmRow';

const ROW_HEIGHT = 26;
const LABEL_WIDTH = 240;
const PAGE_SIZE = 50;

export default function Timeline({ films, tooltip, setTooltip }) {
  const containerRef = useRef(null);
  const headerRef = useRef(null);
  const rowsRef = useRef(null);
  const [page, setPage] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  // Reset page when films change
  useEffect(() => { setPage(0); setExpandedId(null); }, [films]);

  const totalPages = Math.ceil(films.length / PAGE_SIZE);
  const pageFilms = films.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const onTooltipShow = useCallback((evt, event, pos, total, film) => {
    setTooltip({
      x: Math.min(evt.clientX + 12, window.innerWidth - 320),
      y: Math.min(evt.clientY - 10, window.innerHeight - 100),
      festival: event.festival,
      year: event.event_year,
      status: event.status,
      category: event.category,
      pos, total,
      filmTitle: film.title,
    });
  }, [setTooltip]);

  const onTooltipHide = useCallback(() => setTooltip(null), [setTooltip]);

  // Render D3 content
  useEffect(() => {
    if (!containerRef.current || !films.length) return;

    const containerWidth = containerRef.current.clientWidth;
    const timelineWidth = containerWidth - LABEL_WIDTH - 20;

    // Compute x scale
    let yearMin = Infinity, yearMax = -Infinity;
    films.forEach(f => {
      if (f.first_screening_year < yearMin) yearMin = f.first_screening_year;
      if (f.last_screening_year > yearMax) yearMax = f.last_screening_year;
    });
    if (!isFinite(yearMin)) { yearMin = 2000; yearMax = 2025; }
    yearMin = Math.max(yearMin - 1, 1995);
    yearMax = yearMax + 1;

    const xScale = d3.scaleLinear().domain([yearMin, yearMax]).range([10, timelineWidth - 10]);

    // Render x-axis header
    const headerEl = headerRef.current;
    headerEl.innerHTML = '';
    const axisSvg = d3.select(headerEl).append('svg')
      .attr('width', containerWidth).attr('height', 28);
    const axisG = axisSvg.append('g').attr('transform', `translate(${LABEL_WIDTH}, 0)`);

    const ticks = [];
    for (let y = Math.ceil(yearMin); y <= yearMax; y += 2) ticks.push(y);
    axisG.selectAll('text').data(ticks).enter().append('text')
      .attr('x', d => xScale(d)).attr('y', 18).attr('text-anchor', 'middle')
      .attr('fill', '#6b7280').attr('font-size', 10).text(d => `'${String(d).slice(2)}`);
    axisG.selectAll('line').data(ticks).enter().append('line')
      .attr('x1', d => xScale(d)).attr('x2', d => xScale(d))
      .attr('y1', 22).attr('y2', 28).attr('stroke', '#e5e7eb');

    // Render film rows
    const rowsEl = rowsRef.current;
    rowsEl.innerHTML = '';

    pageFilms.forEach((film, i) => {
      const globalIdx = page * PAGE_SIZE + i + 1;

      const row = document.createElement('div');
      row.className = 'film-row';

      // Label
      const label = document.createElement('div');
      label.className = 'film-label';
      label.title = film.title;
      label.innerHTML = `<span class="rank">${globalIdx}.</span>${escHtml(film.title)}${film.has_awards ? '<span class="award-badge">\u2605</span>' : ''}`;
      row.appendChild(label);

      // Timeline SVG container
      const tlDiv = document.createElement('div');
      tlDiv.className = 'film-timeline-svg';
      row.appendChild(tlDiv);

      const svg = d3.select(tlDiv).append('svg')
        .attr('width', timelineWidth).attr('height', ROW_HEIGHT);

      renderFilmRow(svg, film, ROW_HEIGHT / 2, xScale, { onTooltipShow, onTooltipHide });

      row.addEventListener('click', () => {
        setExpandedId(prev => prev === film.film_id ? null : film.film_id);
      });

      rowsEl.appendChild(row);

      // Expanded detail
      if (expandedId === film.film_id) {
        const detail = document.createElement('div');
        detail.className = 'expanded-detail';
        let html = `<div class="meta-line"><strong>${escHtml(film.title)}</strong>`;
        if (film.original_title && film.original_title !== film.title) html += ` <em>(${escHtml(film.original_title)})</em>`;
        html += `</div>`;
        html += `<div class="meta-line">Director(s): ${escHtml(film.directors || 'Unknown')} | ${film.countries || '?'} | ${film.production_year || '?'} | ${film.duration ? film.duration + ' min' : '?'}</div>`;
        html += `<div class="meta-line">Genres: ${escHtml(film.genres || 'None')} | ${film.total_festivals} festivals, ${film.total_screenings} screenings, span ${film.circulation_span_years}y</div>`;
        html += `<div class="meta-line">Awards: ${film.awards_won} wins, ${film.nominations} nominations, ${film.mentions} mentions</div>`;
        html += `<div class="fest-list">`;
        film.screening_timeline.forEach(e => {
          const sg = statusGroup(e.status);
          html += `<span class="fest-item ${sg}">${escHtml(e.festival)} (${e.event_year})${sg !== 'screening' ? ' ' + e.status : ''}</span>`;
        });
        html += `</div>`;
        detail.innerHTML = html;
        rowsEl.appendChild(detail);
      }
    });
  }, [pageFilms, films, page, expandedId, onTooltipShow, onTooltipHide]);

  return (
    <>
      <div className="timeline-area" ref={containerRef}>
        <div ref={headerRef} style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fff', borderBottom: '1px solid var(--border)', height: 28 }} />
        <div ref={rowsRef} />
      </div>
      <div className="bottom-pagination" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '0 8px' }}>
        <span className="page-info" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {films.length} films | Page {page + 1} of {Math.max(1, totalPages)}
        </span>
        <button className="page-btn" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
        <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
      </div>
    </>
  );
}

function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
