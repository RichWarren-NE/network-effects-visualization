import { useState, useEffect } from 'react';
import GeoMap from './components/GeoMap';
import FlowMap from './components/FlowMap';
import ComparisonView from './components/ComparisonView';
import StatisticsPanel from './components/StatisticsPanel';
import './App.css';

function App() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('production');
  const [yearRange, setYearRange] = useState([1998, 2026]);
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [flowThreshold, setFlowThreshold] = useState(3);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/geo_data.json')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { console.error(e); setLoading(false); });
  }, []);

  if (loading) return <div className="loading">Loading geographic data...</div>;
  if (!data) return <div className="loading">Failed to load data.</div>;

  const tabs = [
    { id: 'production', label: 'Production Heat Map' },
    { id: 'screening', label: 'Screening Heat Map' },
    { id: 'flow', label: 'Flow Map' },
    { id: 'compare', label: 'Compare Periods' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1>Geographic Film Mobility</h1>
        <p className="subtitle">
          Short Film Festival Network &mdash; Where films are produced and where they screen
        </p>
      </header>

      <nav className="tab-nav">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(t.id); setSelectedCountry(null); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="controls">
        <div className="control-group">
          <label>Year Range: {yearRange[0]}&ndash;{yearRange[1]}</label>
          <div className="range-inputs">
            <input
              type="range" min={1998} max={2026} value={yearRange[0]}
              onChange={e => setYearRange([+e.target.value, Math.max(+e.target.value, yearRange[1])])}
            />
            <input
              type="range" min={1998} max={2026} value={yearRange[1]}
              onChange={e => setYearRange([Math.min(yearRange[0], +e.target.value), +e.target.value])}
            />
          </div>
        </div>
        <div className="control-group">
          <label>Genre</label>
          <select value={selectedGenre} onChange={e => setSelectedGenre(e.target.value)}>
            <option value="All">All Genres</option>
            {data.genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        {activeTab === 'flow' && (
          <div className="control-group">
            <label>Min Films: {flowThreshold}</label>
            <input
              type="range" min={1} max={30} value={flowThreshold}
              onChange={e => setFlowThreshold(+e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="main-content">
        <div className="map-container">
          {activeTab === 'production' && (
            <GeoMap
              data={data} mode="production" yearRange={yearRange}
              genre={selectedGenre} onCountryClick={setSelectedCountry}
            />
          )}
          {activeTab === 'screening' && (
            <GeoMap
              data={data} mode="screening" yearRange={yearRange}
              genre={selectedGenre} onCountryClick={setSelectedCountry}
            />
          )}
          {activeTab === 'flow' && (
            <FlowMap
              data={data} yearRange={yearRange} genre={selectedGenre}
              threshold={flowThreshold} onCountryClick={setSelectedCountry}
            />
          )}
          {activeTab === 'compare' && (
            <ComparisonView data={data} genre={selectedGenre} />
          )}
        </div>

        <StatisticsPanel
          data={data}
          selectedCountry={selectedCountry}
          onClose={() => setSelectedCountry(null)}
          activeTab={activeTab}
        />
      </div>

      <footer className="app-footer">
        <p className="data-notice">
          Festival locations based on known major festivals. Coverage: {data.data_completeness.festivals_mapped}/{data.data_completeness.festivals_total} festivals mapped ({data.data_completeness.coverage_pct}%).
          Some festivals may have inferred locations.
        </p>
      </footer>
    </div>
  );
}

export default App;
