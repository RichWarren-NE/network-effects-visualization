import { useMemo } from 'react';

export default function FilterControls({ data, filters, onFilterChange }) {
  const countries = useMemo(() => {
    const set = new Set();
    data.films.forEach(f => {
      if (f.country_codes) f.country_codes.split(', ').forEach(c => set.add(c));
    });
    return [...set].sort();
  }, [data]);

  const genres = useMemo(() => {
    const set = new Set();
    data.films.forEach(f => {
      if (f.genres) f.genres.split(', ').forEach(g => set.add(g));
    });
    return [...set].sort();
  }, [data]);

  const update = (key, value) => onFilterChange({ ...filters, [key]: value });

  return (
    <div className="filter-bar">
      <div className="ctrl">
        <label>Country</label>
        <select value={filters.country} onChange={e => update('country', e.target.value)}>
          <option value="">All</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="ctrl">
        <label>Genre</label>
        <select value={filters.genre} onChange={e => update('genre', e.target.value)}>
          <option value="">All</option>
          {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div className="ctrl">
        <label>Year</label>
        <input type="number" placeholder={data.metadata.year_range[0]} value={filters.yearMin}
          onChange={e => update('yearMin', e.target.value)} />
        <span>&ndash;</span>
        <input type="number" placeholder={data.metadata.year_range[1]} value={filters.yearMax}
          onChange={e => update('yearMax', e.target.value)} />
      </div>
      <div className="ctrl">
        <label>Min festivals</label>
        <input type="number" value={filters.minFest} min={1} style={{ width: 50 }}
          onChange={e => update('minFest', e.target.value)} />
      </div>
      <div className="ctrl">
        <label>Awards only</label>
        <input type="checkbox" checked={filters.awardsOnly}
          onChange={e => update('awardsOnly', e.target.checked)} />
      </div>
      <div className="ctrl">
        <label>UK only</label>
        <input type="checkbox" checked={filters.ukOnly}
          onChange={e => update('ukOnly', e.target.checked)} />
      </div>
      <div className="ctrl">
        <label>Sort</label>
        <select value={filters.sort} onChange={e => update('sort', e.target.value)}>
          <option value="festivals-desc">Festivals (most)</option>
          <option value="festivals-asc">Festivals (least)</option>
          <option value="span-desc">Span (longest)</option>
          <option value="span-asc">Span (shortest)</option>
          <option value="year-asc">First screening (earliest)</option>
          <option value="year-desc">First screening (latest)</option>
          <option value="title-asc">Title (A-Z)</option>
        </select>
      </div>
    </div>
  );
}
