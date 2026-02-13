import { useState } from 'react';
import { useFilteredData } from '../hooks/useFilteredData';
import { useFilters } from '../contexts/FilterContext';

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function showToast(msg, isError) {
  const el = document.createElement('div');
  el.className = `toast ${isError ? 'toast-error' : 'toast-success'}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-show'));
  setTimeout(() => {
    el.classList.remove('toast-show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

export default function ExportModal({ onClose }) {
  const { filteredFilms, quickStats } = useFilteredData();
  const { filters } = useFilters();
  const [exporting, setExporting] = useState(null);

  const ts = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const exportCSV = () => {
    try {
      setExporting('csv');
      const meta = [
        `# Network Effects: Film Mobility Data Export`,
        `# Exported: ${new Date().toISOString()}`,
        `# Films: ${filteredFilms.length} | Festivals: ${quickStats.festivals} | Screenings: ${quickStats.screenings}`,
        `# Filters: years ${filters.yearRange[0]}-${filters.yearRange[1]}` +
          (filters.countries.length ? `, countries: ${filters.countries.join('/')}` : '') +
          (filters.genres.length ? `, genres: ${filters.genres.join('/')}` : '') +
          (filters.searchQuery ? `, search: "${filters.searchQuery}"` : ''),
        `# Citation: Warren, R. (2025) Network Effects. Bath Spa University.`,
        '',
      ];
      const headers = ['title', 'directors', 'production_year', 'countries', 'country_codes',
        'genres', 'total_festivals', 'total_screenings', 'circulation_span_years',
        'awards_won', 'nominations', 'first_screening_year', 'last_screening_year'];
      const rows = filteredFilms.map(f =>
        headers.map(h => {
          const val = f[h];
          if (val == null) return '';
          const s = String(val);
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(',')
      );
      downloadFile([...meta, headers.join(','), ...rows].join('\n'),
        `network_effects_${ts()}.csv`, 'text/csv;charset=utf-8');
      showToast(`Exported ${filteredFilms.length} films as CSV`);
    } catch (err) {
      showToast('CSV export failed: ' + err.message, true);
    } finally {
      setExporting(null);
    }
  };

  const exportJSON = () => {
    try {
      setExporting('json');
      const data = {
        metadata: {
          title: 'Network Effects: Film Mobility Data',
          exported_at: new Date().toISOString(),
          citation: 'Warren, R. (2025) Network Effects. Bath Spa University.',
          film_count: filteredFilms.length,
          filters_applied: {
            year_range: filters.yearRange,
            countries: filters.countries,
            genres: filters.genres,
            event_type: filters.eventType,
            search_query: filters.searchQuery,
          },
          stats: quickStats,
        },
        films: filteredFilms.map(f => ({
          title: f.title,
          directors: f.directors,
          production_year: f.production_year,
          countries: f.countries,
          country_codes: f.country_codes,
          genres: f.genres,
          total_festivals: f.total_festivals,
          total_screenings: f.total_screenings,
          circulation_span_years: f.circulation_span_years,
          awards_won: f.awards_won,
          nominations: f.nominations,
          first_screening_year: f.first_screening_year,
          last_screening_year: f.last_screening_year,
        })),
      };
      downloadFile(JSON.stringify(data, null, 2),
        `network_effects_${ts()}.json`, 'application/json');
      showToast(`Exported ${filteredFilms.length} films as JSON`);
    } catch (err) {
      showToast('JSON export failed: ' + err.message, true);
    } finally {
      setExporting(null);
    }
  };

  const exportPNG = () => {
    try {
      setExporting('png');
      // Try Plotly chart first (GeoTab)
      const plotly = document.querySelector('.tab-content .js-plotly-plot');
      if (plotly && window.Plotly) {
        window.Plotly.downloadImage(plotly, {
          format: 'png', width: 3840, height: 2160, scale: 2,
          filename: `network_effects_viz_${ts()}`,
        });
        showToast('Exported visualisation as 300 DPI PNG');
        setExporting(null);
        return;
      }
      // Try Canvas (NetworkTab)
      const canvas = document.querySelector('.tab-content canvas');
      if (canvas) {
        const hiRes = document.createElement('canvas');
        const scale = 300 / 96; // 300 DPI
        hiRes.width = canvas.width * scale;
        hiRes.height = canvas.height * scale;
        const ctx = hiRes.getContext('2d');
        ctx.scale(scale, scale);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, hiRes.width, hiRes.height);
        ctx.drawImage(canvas, 0, 0);
        const a = document.createElement('a');
        a.download = `network_effects_viz_${ts()}.png`;
        a.href = hiRes.toDataURL('image/png');
        a.click();
        showToast('Exported network graph as 300 DPI PNG');
        setExporting(null);
        return;
      }
      // Try SVG (TimelineTab)
      const svg = document.querySelector('.tab-content svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const dpiCanvas = document.createElement('canvas');
        const ctx = dpiCanvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
          const scale = 300 / 96;
          dpiCanvas.width = img.width * scale;
          dpiCanvas.height = img.height * scale;
          ctx.scale(scale, scale);
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, dpiCanvas.width, dpiCanvas.height);
          ctx.drawImage(img, 0, 0);
          const a = document.createElement('a');
          a.download = `network_effects_viz_${ts()}.png`;
          a.href = dpiCanvas.toDataURL('image/png');
          a.click();
          showToast('Exported timeline as 300 DPI PNG');
          setExporting(null);
        };
        img.onerror = () => {
          showToast('PNG render failed. Try SVG export instead.', true);
          setExporting(null);
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        return;
      }
      showToast('No visualisation found to export. Switch to a tab first.', true);
    } catch (err) {
      showToast('PNG export failed: ' + err.message, true);
    } finally {
      setExporting(null);
    }
  };

  const exportSVG = () => {
    try {
      setExporting('svg');
      // Try Plotly
      const plotly = document.querySelector('.tab-content .js-plotly-plot');
      if (plotly && window.Plotly) {
        window.Plotly.downloadImage(plotly, {
          format: 'svg', width: 1920, height: 1080,
          filename: `network_effects_viz_${ts()}`,
        });
        showToast('Exported visualisation as SVG');
        setExporting(null);
        return;
      }
      // Try existing SVG (TimelineTab)
      const svg = document.querySelector('.tab-content svg');
      if (svg) {
        const clone = svg.cloneNode(true);
        // Embed fonts
        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.textContent = `text, tspan { font-family: 'Inter', system-ui, -apple-system, sans-serif; }`;
        clone.insertBefore(style, clone.firstChild);
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        const svgData = new XMLSerializer().serializeToString(clone);
        downloadFile(svgData, `network_effects_viz_${ts()}.svg`, 'image/svg+xml');
        showToast('Exported timeline as SVG');
        setExporting(null);
        return;
      }
      showToast('No vector visualisation found. SVG export works on Timeline and Geographic tabs.', true);
    } catch (err) {
      showToast('SVG export failed: ' + err.message, true);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>Export Data</h2>
        <p className="modal-desc">
          Export {filteredFilms.length} films matching current filters.
        </p>
        <div className="export-options">
          <button className="export-option" onClick={exportCSV} disabled={exporting}>
            <span className="export-icon">CSV</span>
            <div>
              <div className="export-detail">Tabular data for spreadsheets</div>
              <div className="export-sub">Includes metadata header and filter summary</div>
            </div>
          </button>
          <button className="export-option" onClick={exportJSON} disabled={exporting}>
            <span className="export-icon">JSON</span>
            <div>
              <div className="export-detail">Structured data with metadata</div>
              <div className="export-sub">Machine-readable with applied filters</div>
            </div>
          </button>
          <button className="export-option" onClick={exportPNG} disabled={exporting}>
            <span className="export-icon">PNG</span>
            <div>
              <div className="export-detail">Current visualisation as image</div>
              <div className="export-sub">300 DPI, suitable for print</div>
            </div>
          </button>
          <button className="export-option" onClick={exportSVG} disabled={exporting}>
            <span className="export-icon">SVG</span>
            <div>
              <div className="export-detail">Scalable vector graphic</div>
              <div className="export-sub">Editable in Illustrator/Inkscape, embedded fonts</div>
            </div>
          </button>
        </div>
        {exporting && (
          <div className="export-progress">
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            <span>Exporting {exporting.toUpperCase()}...</span>
          </div>
        )}
      </div>
    </div>
  );
}
