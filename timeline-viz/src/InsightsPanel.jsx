import { useMemo } from 'react';

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '\u2026' : s; }

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : ((s[m - 1] + s[m]) / 2);
}

export default function InsightsPanel({ films }) {
  const stats = useMemo(() => {
    if (!films || films.length === 0) return null;

    const spans = films.map(f => f.circulation_span_years);
    const fests = films.map(f => f.total_festivals);
    const avgSpan = (spans.reduce((a, b) => a + b, 0) / spans.length).toFixed(1);
    const avgFest = (fests.reduce((a, b) => a + b, 0) / fests.length).toFixed(1);
    const medFest = median(fests);
    const awarded = films.filter(f => f.has_awards).length;
    const awardRate = ((awarded / films.length) * 100).toFixed(0);

    // Most common first festival
    const firstFests = {};
    films.forEach(f => {
      if (f.screening_timeline && f.screening_timeline.length) {
        const fy = f.screening_timeline[0].event_year;
        f.screening_timeline.filter(e => e.event_year === fy).forEach(e => {
          firstFests[e.festival] = (firstFests[e.festival] || 0) + 1;
        });
      }
    });
    const topFirst = Object.entries(firstFests).sort((a, b) => b[1] - a[1])[0];

    const top = [...films].sort((a, b) => b.total_festivals - a.total_festivals)[0];

    return { count: films.length, avgFest, medFest, avgSpan, awardRate, topFirst, top };
  }, [films]);

  if (!stats) {
    return (
      <div className="insights-panel">
        <h3>Insights</h3>
        <div style={{ color: 'var(--text-dim)' }}>No films match filters</div>
      </div>
    );
  }

  return (
    <div className="insights-panel">
      <h3>Insights</h3>
      <Row label="Films shown" value={stats.count} />
      <Row label="Avg festivals/film" value={stats.avgFest} />
      <Row label="Median festivals" value={stats.medFest} />
      <Row label="Avg circulation" value={stats.avgSpan + ' yr'} />
      <Row label="Award rate" value={stats.awardRate + '%'} />
      <Row label="Most common 1st" value={stats.topFirst ? `${truncate(stats.topFirst[0], 18)} (${stats.topFirst[1]})` : '\u2014'} />
      <Row label="Most traveled" value={stats.top ? `${truncate(stats.top.title, 16)} (${stats.top.total_festivals})` : '\u2014'} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="insight-row">
      <span className="insight-label">{label}</span>
      <span className="insight-value">{value}</span>
    </div>
  );
}
