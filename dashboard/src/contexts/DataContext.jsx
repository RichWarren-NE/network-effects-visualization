import { createContext, useContext, useState, useEffect } from 'react';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [networkData, setNetworkData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const load = async (url, setter, key) => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = await r.json();
        setter(d);
      } catch (e) {
        setErrors(prev => ({ ...prev, [key]: e.message }));
      }
    };

    Promise.all([
      load('/network_data_enhanced.json', setNetworkData, 'network'),
      load('/timeline_data.json', setTimelineData, 'timeline'),
      load('/geo_data.json', setGeoData, 'geo'),
    ]).finally(() => setLoading(false));
  }, []);

  const allLoaded = !!(networkData && timelineData && geoData);

  return (
    <DataContext.Provider value={{
      networkData, timelineData, geoData,
      loading, errors, allLoaded,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be inside DataProvider');
  return ctx;
}
