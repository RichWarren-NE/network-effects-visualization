import { useMemo } from 'react';
import { useFilters } from '../contexts/FilterContext';
import { useData } from '../contexts/DataContext';

export function useFilteredData() {
  const { filters } = useFilters();
  const { networkData, timelineData, geoData } = useData();

  // Filtered timeline films
  const filteredFilms = useMemo(() => {
    if (!timelineData) return [];
    const { yearRange, countries, genres, eventType, searchQuery } = filters;
    const q = searchQuery.toLowerCase().trim();

    return timelineData.films.filter(f => {
      // Year range
      if (f.first_screening_year > yearRange[1] || f.last_screening_year < yearRange[0]) return false;

      // Countries
      if (countries.length > 0) {
        const filmCodes = (f.country_codes || '').split(', ').map(c => c.trim());
        if (!countries.some(c => filmCodes.includes(c))) return false;
      }

      // Genres
      if (genres.length > 0) {
        const filmGenres = (f.genres || '').split(', ').map(g => g.trim());
        if (!genres.some(g => filmGenres.includes(g))) return false;
      }

      // Event type filter via screening timeline
      if (eventType !== 'both' && f.screening_timeline) {
        const hasType = f.screening_timeline.some(s => s.event_type === eventType);
        if (!hasType) return false;
      }

      // Search
      if (q.length >= 2) {
        if (!(f.title || '').toLowerCase().includes(q) &&
            !(f.directors || '').toLowerCase().includes(q) &&
            !(f.original_title || '').toLowerCase().includes(q)) return false;
      }

      return true;
    });
  }, [timelineData, filters]);

  // Film IDs for cross-filtering
  const filteredFilmIds = useMemo(() => {
    return new Set(filteredFilms.map(f => f.film_id));
  }, [filteredFilms]);

  // Filtered film titles for network cross-reference
  const filteredFilmTitles = useMemo(() => {
    return new Set(filteredFilms.map(f => f.title));
  }, [filteredFilms]);

  // Filtered network data
  const filteredNetwork = useMemo(() => {
    if (!networkData) return null;
    const { yearRange } = filters;

    // Use year snapshots if range is narrower than full range
    const useSnapshot = yearRange[0] > 1998 || yearRange[1] < 2026;

    if (useSnapshot && networkData.year_snapshots) {
      // Merge relevant year snapshots
      const activeNodes = new Set();
      const edgeMap = {};
      const nodeFilms = {};

      for (let y = yearRange[0]; y <= yearRange[1]; y++) {
        const snap = networkData.year_snapshots[String(y)];
        if (!snap) continue;
        (snap.active_nodes || []).forEach(n => activeNodes.add(n));
        (snap.edges || []).forEach(e => {
          const key = [e.source, e.target].sort().join('||');
          if (!edgeMap[key]) edgeMap[key] = { source: e.source, target: e.target, weight: 0 };
          edgeMap[key].weight += e.weight;
        });
        if (snap.node_films) {
          for (const [node, count] of Object.entries(snap.node_films)) {
            nodeFilms[node] = (nodeFilms[node] || 0) + count;
          }
        }
      }

      const filteredNodes = networkData.nodes.filter(n => activeNodes.has(n.id));
      const nodeSet = new Set(filteredNodes.map(n => n.id));
      const filteredEdges = Object.values(edgeMap).filter(e =>
        nodeSet.has(e.source) && nodeSet.has(e.target)
      );

      return {
        nodes: filteredNodes,
        edges: filteredEdges,
        metadata: networkData.metadata,
      };
    }

    return {
      nodes: networkData.nodes,
      edges: networkData.edges,
      metadata: networkData.metadata,
    };
  }, [networkData, filters]);

  // Quick statistics
  const quickStats = useMemo(() => {
    const filmCount = filteredFilms.length;
    if (filmCount === 0) {
      return {
        films: 0, festivals: 0, screenings: 0,
        dateRange: 'N/A', topCountry: 'N/A', topFestival: 'N/A',
      };
    }

    const festivalSet = new Set();
    let screenings = 0;
    let minYear = Infinity, maxYear = -Infinity;
    const countryCounts = {};
    const festivalCounts = {};

    filteredFilms.forEach(f => {
      screenings += f.total_screenings || 0;
      if (f.first_screening_year < minYear) minYear = f.first_screening_year;
      if (f.last_screening_year > maxYear) maxYear = f.last_screening_year;

      (f.country_codes || '').split(', ').forEach(c => {
        const ct = c.trim();
        if (ct) countryCounts[ct] = (countryCounts[ct] || 0) + 1;
      });

      (f.screening_timeline || []).forEach(s => {
        festivalSet.add(s.festival);
        festivalCounts[s.festival] = (festivalCounts[s.festival] || 0) + 1;
      });
    });

    const topCountryCode = Object.entries(countryCounts).sort((a, b) => b[1] - a[1])[0];
    const topFest = Object.entries(festivalCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      films: filmCount,
      festivals: festivalSet.size,
      screenings,
      dateRange: `${minYear}–${maxYear}`,
      topCountry: topCountryCode ? topCountryCode[0] : 'N/A',
      topCountryCount: topCountryCode ? topCountryCode[1] : 0,
      topFestival: topFest ? topFest[0] : 'N/A',
      topFestivalCount: topFest ? topFest[1] : 0,
    };
  }, [filteredFilms]);

  // Available filter options (extracted from full dataset)
  const filterOptions = useMemo(() => {
    if (!timelineData) return { countries: [], genres: [] };

    const countrySet = {};
    const genreSet = new Set();

    timelineData.films.forEach(f => {
      (f.country_codes || '').split(', ').forEach(c => {
        const ct = c.trim();
        if (ct) countrySet[ct] = (countrySet[ct] || 0) + 1;
      });
      (f.genres || '').split(', ').forEach(g => {
        const gt = g.trim();
        if (gt) genreSet.add(gt);
      });
    });

    const countries = Object.entries(countrySet)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([code, count]) => ({ code, count }));

    return {
      countries,
      genres: [...genreSet].sort(),
    };
  }, [timelineData]);

  return {
    filteredFilms,
    filteredFilmIds,
    filteredFilmTitles,
    filteredNetwork,
    quickStats,
    filterOptions,
    geoData,
  };
}
