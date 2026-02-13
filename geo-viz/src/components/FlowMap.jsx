import { useMemo } from 'react';
import Plot from 'react-plotly.js';

// Country centroids (lat, lon) for arc drawing
const CENTROIDS = {
  GB:[54,-2],FR:[46.6,2.3],US:[39,-98],DE:[51,10],CH:[47,8],IE:[53.4,-8],
  CA:[56,-96],NL:[52.3,5.3],ES:[40,-3.7],IT:[42.5,12.5],BE:[50.8,4.3],
  AT:[47.5,13.3],SE:[62,15],NO:[64,12],FI:[64,26],DK:[56,10],IS:[65,-18],
  PL:[52,20],CZ:[49.8,15.5],BA:[44,17.7],HR:[45.2,15.5],SI:[46.1,14.8],
  RO:[46,25],BG:[42.7,25.5],GR:[39.1,21.8],PT:[39.4,-8.2],HU:[47.2,19.5],
  LT:[55.2,24],LV:[57,24.7],EE:[58.6,25],TR:[39,35.2],GE:[42.3,43.4],
  UA:[49,31.4],RU:[61,105],KR:[36,128],JP:[36.2,138.3],CN:[35,105],
  HK:[22.3,114.2],SG:[1.4,103.8],TW:[23.7,121],IN:[20.6,79],IR:[32.4,53.7],
  AE:[24,54],IL:[31.5,34.8],ZA:[-28.5,24.5],BF:[12.4,-1.6],AU:[-25.3,133.8],
  NZ:[-40.9,174.9],CU:[21.5,-80],MX:[23.6,-102.6],BR:[-14.2,-51.9],
  CO:[4.6,-74.3],AR:[-38.4,-63.6],CL:[-35.7,-71.5],PE:[-9.2,-75],
  RS:[44.2,20.9],SK:[48.7,19.7],LB:[33.9,35.8],
};

export default function FlowMap({ data, yearRange, genre, threshold, onCountryClick }) {
  const { traces } = useMemo(() => {
    const flows = data.flows.filter(f => f.film_count >= threshold);
    if (flows.length === 0) return { traces: [] };

    const maxFilms = Math.max(...flows.map(f => f.film_count));
    const lines = [];
    const markerLons = [], markerLats = [], markerTexts = [], markerSizes = [];

    // Count films per country for markers
    const countryFilms = {};
    for (const f of flows) {
      countryFilms[f.source] = (countryFilms[f.source] || 0) + f.film_count;
      countryFilms[f.target] = (countryFilms[f.target] || 0) + f.film_count;
    }

    for (const f of flows) {
      const src = CENTROIDS[f.source];
      const dst = CENTROIDS[f.target];
      if (!src || !dst) continue;

      const width = Math.max(0.5, (f.film_count / maxFilms) * 5);
      const opacity = Math.min(0.8, 0.15 + (f.film_count / maxFilms) * 0.65);

      lines.push({
        type: 'scattergeo',
        mode: 'lines',
        lon: [src[1], dst[1]],
        lat: [src[0], dst[0]],
        line: { width, color: `rgba(30, 64, 175, ${opacity})`, dash: 'solid' },
        hoverinfo: 'text',
        text: `${f.source_name} → ${f.target_name}<br>${f.film_count} films (${f.screening_count} screenings)`,
        showlegend: false,
      });
    }

    // Country markers
    for (const [code, count] of Object.entries(countryFilms)) {
      const c = CENTROIDS[code];
      if (!c) continue;
      markerLats.push(c[0]);
      markerLons.push(c[1]);
      markerTexts.push(`${data.production[code]?.country || code}: ${count} film connections`);
      markerSizes.push(Math.max(5, Math.min(20, Math.sqrt(count) * 2)));
    }

    const markerTrace = {
      type: 'scattergeo',
      mode: 'markers+text',
      lon: markerLons,
      lat: markerLats,
      text: Object.keys(countryFilms).map(c => data.production[c]?.country?.substring(0, 3) || c),
      textposition: 'top center',
      textfont: { size: 8, color: '#475569' },
      hoverinfo: 'text',
      hovertext: markerTexts,
      marker: {
        size: markerSizes,
        color: '#3b82f6',
        line: { width: 1, color: 'white' },
        opacity: 0.8,
      },
      showlegend: false,
    };

    return { traces: [...lines, markerTrace] };
  }, [data, threshold]);

  return (
    <Plot
      data={traces}
      layout={{
        title: {
          text: `Film Mobility Flows (${threshold}+ films)`,
          font: { size: 16, color: '#1e3a5f' },
          x: 0.5,
        },
        geo: {
          showframe: false,
          showcoastlines: true,
          coastlinecolor: '#cbd5e1',
          showland: true,
          landcolor: '#f8fafc',
          showocean: true,
          oceancolor: '#f0f9ff',
          showcountries: true,
          countrycolor: '#e2e8f0',
          projection: { type: 'natural earth' },
        },
        margin: { t: 40, b: 10, l: 10, r: 10 },
        height: 500,
        paper_bgcolor: 'white',
        showlegend: false,
      }}
      config={{ responsive: true, displayModeBar: true }}
      style={{ width: '100%' }}
    />
  );
}
