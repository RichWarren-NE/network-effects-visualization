import { createContext, useContext, useState, useCallback } from 'react';

const FilterContext = createContext(null);

const DEFAULT_FILTERS = {
  yearRange: [1998, 2026],
  countries: [],
  genres: [],
  eventType: 'both', // 'festival' | 'award' | 'both'
  searchQuery: '',
};

export function FilterProvider({ children }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [savedViews, setSavedViews] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dashboard_saved_views') || '[]');
    } catch { return []; }
  });

  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const saveView = useCallback((name) => {
    const view = { name, filters: { ...filters }, savedAt: Date.now() };
    setSavedViews(prev => {
      const next = [...prev.filter(v => v.name !== name), view];
      localStorage.setItem('dashboard_saved_views', JSON.stringify(next));
      return next;
    });
  }, [filters]);

  const loadView = useCallback((name) => {
    const view = savedViews.find(v => v.name === name);
    if (view) setFilters(view.filters);
  }, [savedViews]);

  const deleteView = useCallback((name) => {
    setSavedViews(prev => {
      const next = prev.filter(v => v.name !== name);
      localStorage.setItem('dashboard_saved_views', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <FilterContext.Provider value={{
      filters, updateFilter, resetFilters,
      savedViews, saveView, loadView, deleteView,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error('useFilters must be inside FilterProvider');
  return ctx;
}
