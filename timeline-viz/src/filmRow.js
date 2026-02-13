/**
 * Renders a single film's timeline row into an SVG element using D3.
 * Shared between Timeline (most traveled), search detail, and compare views.
 */

export function statusGroup(s) {
  if (s === 'won' || s === 'second_place' || s === 'third_place') return 'won';
  if (s === 'nominated') return 'nominated';
  if (s === 'special_mention' || s === 'honorable_mention') return 'mention';
  return 'screening';
}

export function statusColor(sg) {
  if (sg === 'won') return '#eab308';
  if (sg === 'nominated') return '#94a3b8';
  if (sg === 'mention') return '#d97706';
  return '#9ca3af';
}

/**
 * @param {d3.Selection} svg - D3 selection of SVG element
 * @param {Object} film - Film data object
 * @param {number} cy - Y center of the row
 * @param {d3.ScaleLinear} xScale - D3 linear scale for years
 * @param {Object} opts - { onTooltipShow, onTooltipHide }
 */
export function renderFilmRow(svg, film, cy, xScale, opts = {}) {
  const events = film.screening_timeline;
  if (!events || events.length === 0) return;

  const firstX = xScale(events[0].event_year);
  const lastX = xScale(events[events.length - 1].event_year);

  // Connecting line
  svg.append('line')
    .attr('x1', firstX).attr('y1', cy)
    .attr('x2', lastX).attr('y2', cy)
    .attr('stroke', '#d1d5db').attr('stroke-width', 1.5);

  // Group by year for collision handling
  const byYear = {};
  events.forEach(e => {
    if (!byYear[e.event_year]) byYear[e.event_year] = [];
    byYear[e.event_year].push(e);
  });

  Object.entries(byYear).forEach(([year, yearEvents]) => {
    const x = xScale(+year);
    yearEvents.forEach((e, j) => {
      const n = yearEvents.length;
      const offset = n > 1 ? (j - (n - 1) / 2) * 5 : 0;
      const cx = x + offset;
      const sg = statusGroup(e.status);
      const color = statusColor(sg);
      const r = sg === 'won' ? 4.5 : sg === 'mention' ? 3.5 : 3;

      const circle = svg.append('circle')
        .attr('cx', cx).attr('cy', cy).attr('r', r)
        .attr('fill', color)
        .attr('stroke', sg === 'won' ? '#a16207' : 'none')
        .attr('stroke-width', sg === 'won' ? 1 : 0)
        .style('cursor', 'pointer');

      const pos = events.indexOf(e) + 1;
      if (opts.onTooltipShow) {
        circle.on('mouseenter', (evt) => opts.onTooltipShow(evt, e, pos, events.length, film));
      }
      if (opts.onTooltipHide) {
        circle.on('mouseleave', opts.onTooltipHide);
      }
    });
  });
}
