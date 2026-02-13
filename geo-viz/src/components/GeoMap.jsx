import { useMemo } from 'react';
import Plot from 'react-plotly.js';

// ISO alpha-2 to alpha-3 for Plotly choropleth
const A2_TO_A3 = {
  GB:'GBR',FR:'FRA',US:'USA',DE:'DEU',CH:'CHE',IE:'IRL',CA:'CAN',NL:'NLD',
  ES:'ESP',IT:'ITA',BE:'BEL',AT:'AUT',SE:'SWE',NO:'NOR',FI:'FIN',DK:'DNK',
  IS:'ISL',PL:'POL',CZ:'CZE',BA:'BIH',HR:'HRV',SI:'SVN',RO:'ROU',BG:'BGR',
  TR:'TUR',GE:'GEO',LT:'LTU',LV:'LVA',EE:'EST',HU:'HUN',UA:'UKR',RU:'RUS',
  PT:'PRT',GR:'GRC',KR:'KOR',JP:'JPN',HK:'HKG',CN:'CHN',SG:'SGP',TW:'TWN',
  IN:'IND',IR:'IRN',AE:'ARE',IL:'ISR',ZA:'ZAF',BF:'BFA',AU:'AUS',NZ:'NZL',
  CU:'CUB',MX:'MEX',BR:'BRA',CO:'COL',AR:'ARG',CL:'CHL',PE:'PER',RS:'SRB',
  SK:'SVK',LB:'LBN',PS:'PSE',EG:'EGY',KE:'KEN',NG:'NGA',GH:'GHA',TN:'TUN',
  MA:'MAR',JO:'JOR',QA:'QAT',BH:'BHR',XK:'XKX',ME:'MNE',MK:'MKD',AL:'ALB',
  CY:'CYP',MT:'MLT',LU:'LUX',
};

export default function GeoMap({ data, mode, yearRange, genre, onCountryClick }) {
  const { locations, values, texts, hoverTexts } = useMemo(() => {
    const source = mode === 'production' ? data.production : data.screening;
    const locs = [], vals = [], txts = [], hovers = [];

    for (const [code, info] of Object.entries(source)) {
      const a3 = A2_TO_A3[code];
      if (!a3) continue;

      const val = mode === 'production' ? info.film_count : info.screenings;
      const label = mode === 'production'
        ? `${info.country}<br>Films: ${info.film_count}<br>Screenings: ${info.total_screenings}<br>Festivals: ${info.festivals_reached}`
        : `${info.country}<br>Screenings: ${info.screenings}<br>Films: ${info.unique_films}<br>Festivals: ${info.festivals}`;

      const topFilms = (info.top_festivals || info.top_films || []).slice(0, 3);
      const filmStr = topFilms.length > 0 ? `<br>Top: ${topFilms.join(', ')}` : '';

      locs.push(a3);
      vals.push(val);
      txts.push(info.country);
      hovers.push(label + filmStr);
    }
    return { locations: locs, values: vals, texts: txts, hoverTexts: hovers };
  }, [data, mode]);

  const title = mode === 'production'
    ? 'Film Production by Country'
    : 'Festival Screenings by Country';

  return (
    <Plot
      data={[{
        type: 'choropleth',
        locationmode: 'ISO-3',
        locations,
        z: values,
        text: hoverTexts,
        hoverinfo: 'text',
        colorscale: [
          [0, '#dbeafe'],
          [0.15, '#93c5fd'],
          [0.4, '#3b82f6'],
          [1, '#1e40af'],
        ],
        colorbar: {
          title: { text: mode === 'production' ? 'Films' : 'Screenings', font: { size: 12 } },
          thickness: 15,
          len: 0.5,
          tickfont: { size: 10 },
        },
        marker: { line: { color: '#cbd5e1', width: 0.5 } },
      }]}
      layout={{
        title: { text: title, font: { size: 16, color: '#1e3a5f' }, x: 0.5 },
        geo: {
          showframe: false,
          showcoastlines: true,
          coastlinecolor: '#cbd5e1',
          showland: true,
          landcolor: '#f8fafc',
          showocean: true,
          oceancolor: '#f0f9ff',
          showlakes: false,
          projection: { type: 'natural earth' },
          lonaxis: { range: [-30, 60] },
          lataxis: { range: [25, 72] },
        },
        margin: { t: 40, b: 10, l: 10, r: 10 },
        height: 500,
        paper_bgcolor: 'white',
      }}
      config={{ responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['toImage'] }}
      style={{ width: '100%' }}
      onClick={(e) => {
        if (e.points && e.points[0]) {
          const loc = e.points[0].location;
          const code = Object.entries(A2_TO_A3).find(([, v]) => v === loc)?.[0];
          if (code) onCountryClick(code);
        }
      }}
    />
  );
}
