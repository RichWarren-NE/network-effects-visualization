import { useData } from '../contexts/DataContext';

export default function Header({ onAbout, onGuide }) {
  const { timelineData, loading, allLoaded, errors } = useData();

  const filmCount = timelineData?.films?.length || 0;
  const festCount = 393;

  const statusColor = loading ? '#fbbf24' : allLoaded ? '#4ade80' : '#f87171';
  const statusText = loading ? 'Loading...' : allLoaded ? 'Data loaded' :
    `Errors: ${Object.keys(errors).join(', ')}`;

  return (
    <header className="dash-header">
      <div className="header-left">
        <h1>Network Effects</h1>
        <span className="header-subtitle">Film Mobility Visualisation Tool</span>
      </div>
      <div className="header-center">
        <span className="header-stat">{filmCount} films</span>
        <span className="header-sep">|</span>
        <span className="header-stat">{festCount} festivals</span>
        <span className="header-sep">|</span>
        <span className="header-stat">1998&ndash;2026</span>
      </div>
      <div className="header-right">
        <div className="status-indicator" title={statusText}>
          <span className="status-dot" style={{ background: statusColor }} />
          <span className="status-text">{loading ? 'Loading' : allLoaded ? 'Connected' : 'Error'}</span>
        </div>
        <button className="header-btn" onClick={onGuide} title="User Guide">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: '-2px', marginRight: '4px' }}>
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <text x="8" y="12" textAnchor="middle" fill="currentColor" fontSize="11" fontWeight="600">?</text>
          </svg>
          Guide
        </button>
        <button className="header-btn" onClick={onAbout}>About</button>
      </div>
    </header>
  );
}
