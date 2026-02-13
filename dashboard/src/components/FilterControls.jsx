import { useState, useCallback, useRef, useEffect } from 'react';
import { useFilters } from '../contexts/FilterContext';
import { useFilteredData } from '../hooks/useFilteredData';

const COUNTRY_NAMES = {
  GB:'United Kingdom',FR:'France',US:'United States',DE:'Germany',CH:'Switzerland',
  IE:'Ireland',CA:'Canada',NL:'Netherlands',ES:'Spain',IT:'Italy',BE:'Belgium',
  AT:'Austria',SE:'Sweden',NO:'Norway',FI:'Finland',DK:'Denmark',PL:'Poland',
  CZ:'Czechia',GR:'Greece',PT:'Portugal',CN:'China',AU:'Australia',JP:'Japan',
  KR:'South Korea',IN:'India',BR:'Brazil',HU:'Hungary',RO:'Romania',HR:'Croatia',
  NZ:'New Zealand',IL:'Israel',TR:'Turkey',RU:'Russia',LB:'Lebanon',AR:'Argentina',
  CL:'Chile',CO:'Colombia',MX:'Mexico',
};

export default function FilterControls() {
  const { filters, updateFilter, resetFilters, savedViews, saveView, loadView, deleteView } = useFilters();
  const { filterOptions } = useFilteredData();
  const [viewName, setViewName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  // Debounced search input
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);
  const debounceRef = useRef(null);

  useEffect(() => {
    setLocalSearch(filters.searchQuery);
  }, [filters.searchQuery]);

  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setLocalSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateFilter('searchQuery', val);
    }, 500);
  }, [updateFilter]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const toggleCountry = useCallback((code) => {
    updateFilter('countries',
      filters.countries.includes(code)
        ? filters.countries.filter(c => c !== code)
        : [...filters.countries, code]
    );
  }, [filters.countries, updateFilter]);

  const toggleGenre = useCallback((genre) => {
    updateFilter('genres',
      filters.genres.includes(genre)
        ? filters.genres.filter(g => g !== genre)
        : [...filters.genres, genre]
    );
  }, [filters.genres, updateFilter]);

  const handleSave = () => {
    if (viewName.trim()) {
      saveView(viewName.trim());
      setViewName('');
      setShowSaveInput(false);
    }
  };

  const hasActiveFilters = filters.countries.length > 0 || filters.genres.length > 0 ||
    filters.eventType !== 'both' || filters.searchQuery !== '' ||
    filters.yearRange[0] > 1998 || filters.yearRange[1] < 2026;

  return (
    <div className="filter-controls">
      <div className="filter-section">
        <h3 className="filter-title">Filters</h3>

        {/* Search */}
        <div className="filter-group">
          <label className="filter-label">Film Search</label>
          <input
            type="text"
            className="filter-input"
            placeholder="Title or director..."
            value={localSearch}
            onChange={handleSearchChange}
          />
        </div>

        {/* Year Range */}
        <div className="filter-group">
          <label className="filter-label">
            Years: {filters.yearRange[0]}&ndash;{filters.yearRange[1]}
          </label>
          <input
            type="range" min={1998} max={2026}
            value={filters.yearRange[0]}
            onChange={e => updateFilter('yearRange', [+e.target.value, Math.max(+e.target.value, filters.yearRange[1])])}
            className="filter-range"
          />
          <input
            type="range" min={1998} max={2026}
            value={filters.yearRange[1]}
            onChange={e => updateFilter('yearRange', [Math.min(filters.yearRange[0], +e.target.value), +e.target.value])}
            className="filter-range"
          />
        </div>

        {/* Event Type */}
        <div className="filter-group">
          <label className="filter-label">Event Type</label>
          <div className="radio-group">
            {[['both', 'Both'], ['festival', 'Festivals'], ['award', 'Awards']].map(([val, label]) => (
              <label key={val} className="radio-item">
                <input
                  type="radio" name="eventType"
                  checked={filters.eventType === val}
                  onChange={() => updateFilter('eventType', val)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Countries */}
        <div className="filter-group">
          <label className="filter-label">
            Countries {filters.countries.length > 0 && `(${filters.countries.length})`}
          </label>
          <div className="checkbox-list">
            {filterOptions.countries.map(({ code, count }) => (
              <label key={code} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={filters.countries.includes(code)}
                  onChange={() => toggleCountry(code)}
                />
                <span>{COUNTRY_NAMES[code] || code} ({count})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Genres */}
        <div className="filter-group">
          <label className="filter-label">
            Genres {filters.genres.length > 0 && `(${filters.genres.length})`}
          </label>
          <div className="checkbox-list">
            {filterOptions.genres.map(g => (
              <label key={g} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={filters.genres.includes(g)}
                  onChange={() => toggleGenre(g)}
                />
                <span>{g}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Reset */}
        <button
          className={`reset-btn ${hasActiveFilters ? 'active' : ''}`}
          onClick={resetFilters}
          disabled={!hasActiveFilters}
        >
          Reset All Filters
        </button>
      </div>

      {/* Saved Views */}
      <div className="filter-section">
        <h3 className="filter-title">Saved Views</h3>
        {savedViews.length > 0 && (
          <div className="saved-views">
            {savedViews.map(v => (
              <div key={v.name} className="saved-view-item">
                <button className="saved-view-btn" onClick={() => loadView(v.name)}>{v.name}</button>
                <button className="saved-view-del" onClick={() => deleteView(v.name)}>&times;</button>
              </div>
            ))}
          </div>
        )}
        {showSaveInput ? (
          <div className="save-input-row">
            <input
              type="text" className="filter-input" placeholder="View name..."
              value={viewName} onChange={e => setViewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <button className="save-btn" onClick={handleSave}>Save</button>
            <button className="cancel-btn" onClick={() => setShowSaveInput(false)}>Cancel</button>
          </div>
        ) : (
          <button className="save-view-trigger" onClick={() => setShowSaveInput(true)}>
            + Save Current View
          </button>
        )}
      </div>
    </div>
  );
}
