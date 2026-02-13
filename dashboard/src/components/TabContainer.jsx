import { useState, lazy, Suspense } from 'react';
import { useFilteredData } from '../hooks/useFilteredData';
import { useFilters } from '../contexts/FilterContext';

const NetworkTab = lazy(() => import('./NetworkTab'));
const TimelineTab = lazy(() => import('./TimelineTab'));
const GeoTab = lazy(() => import('./GeoTab'));

const TABS = [
  { id: 'network', label: 'Network Graph' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'geo', label: 'Geographic Map' },
];

function LoadingFallback() {
  return (
    <div className="tab-loading">
      <div className="spinner" />
      <span>Loading visualisation...</span>
    </div>
  );
}

function EmptyState() {
  const { resetFilters } = useFilters();
  return (
    <div className="tab-empty-state">
      <div className="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
      <h3>No results match your filters</h3>
      <p>Try widening the year range, removing country or genre filters, or clearing the search query.</p>
      <button className="reset-btn active" onClick={resetFilters}>
        Reset All Filters
      </button>
    </div>
  );
}

export default function TabContainer() {
  const [activeTab, setActiveTab] = useState('network');
  const { filteredFilms } = useFilteredData();

  const isEmpty = filteredFilms.length === 0;

  return (
    <div className="tab-container">
      <nav className="tab-nav" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`tab-btn ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="tab-content" role="tabpanel">
        {isEmpty ? (
          <EmptyState />
        ) : (
          <Suspense fallback={<LoadingFallback />}>
            {activeTab === 'network' && <NetworkTab />}
            {activeTab === 'timeline' && <TimelineTab />}
            {activeTab === 'geo' && <GeoTab />}
          </Suspense>
        )}
      </div>
    </div>
  );
}
