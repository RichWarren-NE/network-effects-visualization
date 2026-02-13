import { useMemo } from 'react';
import Plot from 'react-plotly.js';

const A2_TO_A3 = {
  GB:'GBR',FR:'FRA',US:'USA',DE:'DEU',CH:'CHE',IE:'IRL',CA:'CAN',NL:'NLD',
  ES:'ESP',IT:'ITA',BE:'BEL',AT:'AUT',SE:'SWE',NO:'NOR',FI:'FIN',DK:'DNK',
  IS:'ISL',PL:'POL',CZ:'CZE',BA:'BIH',HR:'HRV',SI:'SVN',RO:'ROU',BG:'BGR',
  TR:'TUR',GE:'GEO',LT:'LTU',LV:'LVA',EE:'EST',HU:'HUN',UA:'UKR',RU:'RUS',
  PT:'PRT',GR:'GRC',KR:'KOR',JP:'JPN',HK:'HKG',CN:'CHN',SG:'SGP',TW:'TWN',
  IN:'IND',IR:'IRN',AE:'ARE',IL:'ISR',ZA:'ZAF',BF:'BFA',AU:'AUS',NZ:'NZL',
  CU:'CUB',MX:'MEX',BR:'BRA',CO:'COL',AR:'ARG',CL:'CHL',PE:'PER',RS:'SRB',
  SK:'SVK',LB:'LBN',
};

const COUNTRY_NAMES = {
  GB:'United Kingdom',FR:'France',US:'United States',DE:'Germany',CH:'Switzerland',
  IE:'Ireland',CA:'Canada',NL:'Netherlands',ES:'Spain',IT:'Italy',BE:'Belgium',
  AT:'Austria',SE:'Sweden',NO:'Norway',FI:'Finland',DK:'Denmark',IS:'Iceland',
  PL:'Poland',CZ:'Czechia',BA:'Bosnia',HR:'Croatia',SI:'Slovenia',RO:'Romania',
  BG:'Bulgaria',GR:'Greece',PT:'Portugal',HU:'Hungary',LT:'Lithuania',LV:'Latvia',
  EE:'Estonia',TR:'Turkey',GE:'Georgia',UA:'Ukraine',RU:'Russia',KR:'South Korea',
  JP:'Japan',CN:'China',HK:'Hong Kong',SG:'Singapore',TW:'Taiwan',IN:'India',
  IR:'Iran',AE:'UAE',IL:'Israel',ZA:'South Africa',BF:'Burkina Faso',AU:'Australia',
  NZ:'New Zealand',CU:'Cuba',MX:'Mexico',BR:'Brazil',CO:'Colombia',AR:'Argentina',
  CL:'Chile',PE:'Peru',RS:'Serbia',SK:'Slovakia',LB:'Lebanon',
};

function aggregatePeriod(snapshots, startYear, endYear) {
  const countryData = {};
  for (const [yearStr, snap] of Object.entries(snapshots)) {
    const year = parseInt(yearStr);
    if (year < startYear || year > endYear) continue;
    for (const [code, d] of Object.entries(snap.screening)) {
      if (!countryData[code]) countryData[code] = { films: 0, screenings: 0 };
      countryData[code].films += d.films;
      countryData[code].screenings += d.screenings;
    }
  }
  return countryData;
}

export default function ComparisonView({ data, genre }) {
  const { period1, period2, changeData } = useMemo(() => {
    const p1 = aggregatePeriod(data.year_snapshots, 2015, 2019);
    const p2 = aggregatePeriod(data.year_snapshots, 2020, 2025);

    // Calculate changes for the difference map
    const allCodes = new Set([...Object.keys(p1), ...Object.keys(p2)]);
    const changes = {};
    for (const code of allCodes) {
      const v1 = p1[code]?.screenings || 0;
      const v2 = p2[code]?.screenings || 0;
      changes[code] = { before: v1, after: v2, diff: v2 - v1 };
    }
    return { period1: p1, period2: p2, changeData: changes };
  }, [data]);

  const makeTrace = (periodData, label) => {
    const locs = [], vals = [], texts = [];
    for (const [code, d] of Object.entries(periodData)) {
      const a3 = A2_TO_A3[code];
      if (!a3) continue;
      locs.push(a3);
      vals.push(d.screenings);
      texts.push(`${COUNTRY_NAMES[code] || code}<br>Screenings: ${d.screenings}<br>Films: ${d.films}`);
    }
    return { locations: locs, z: vals, text: texts };
  };

  const t1 = makeTrace(period1);
  const t2 = makeTrace(period2);

  // Change summary
  const increased = Object.entries(changeData)
    .filter(([, d]) => d.diff > 0)
    .sort((a, b) => b[1].diff - a[1].diff)
    .slice(0, 8);
  const decreased = Object.entries(changeData)
    .filter(([, d]) => d.diff < 0)
    .sort((a, b) => a[1].diff - b[1].diff)
    .slice(0, 5);

  const geoConfig = {
    showframe: false,
    showcoastlines: true,
    coastlinecolor: '#cbd5e1',
    showland: true,
    landcolor: '#f8fafc',
    showocean: true,
    oceancolor: '#f0f9ff',
    projection: { type: 'natural earth' },
    lonaxis: { range: [-30, 60] },
    lataxis: { range: [25, 72] },
  };

  const colorscale = [
    [0, '#dbeafe'], [0.15, '#93c5fd'], [0.4, '#3b82f6'], [1, '#1e40af'],
  ];

  return (
    <div>
      <div className="comparison-container">
        <div className="comparison-panel">
          <h3>Pre-COVID: 2015&ndash;2019</h3>
          <Plot
            data={[{
              type: 'choropleth', locationmode: 'ISO-3',
              locations: t1.locations, z: t1.z, text: t1.text,
              hoverinfo: 'text', colorscale, showscale: false,
              marker: { line: { color: '#cbd5e1', width: 0.5 } },
            }]}
            layout={{
              geo: geoConfig,
              margin: { t: 5, b: 5, l: 5, r: 5 },
              height: 300,
              paper_bgcolor: 'white',
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: '100%' }}
          />
        </div>
        <div className="comparison-panel">
          <h3>COVID Era &amp; Recovery: 2020&ndash;2025</h3>
          <Plot
            data={[{
              type: 'choropleth', locationmode: 'ISO-3',
              locations: t2.locations, z: t2.z, text: t2.text,
              hoverinfo: 'text', colorscale, showscale: false,
              marker: { line: { color: '#cbd5e1', width: 0.5 } },
            }]}
            layout={{
              geo: geoConfig,
              margin: { t: 5, b: 5, l: 5, r: 5 },
              height: 300,
              paper_bgcolor: 'white',
            }}
            config={{ responsive: true, displayModeBar: false }}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: 8, border: '1px solid #bbf7d0' }}>
          <h4 style={{ fontSize: '0.85rem', color: '#166534', marginBottom: '0.5rem' }}>
            Increased Activity
          </h4>
          {increased.map(([code, d]) => (
            <div key={code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.15rem 0' }}>
              <span>{COUNTRY_NAMES[code] || code}</span>
              <span style={{ color: '#166534', fontWeight: 600 }}>+{d.diff} screenings</span>
            </div>
          ))}
        </div>
        <div style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: 8, border: '1px solid #fecaca' }}>
          <h4 style={{ fontSize: '0.85rem', color: '#991b1b', marginBottom: '0.5rem' }}>
            Decreased Activity
          </h4>
          {decreased.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: '#991b1b' }}>No significant decreases</p>
          ) : decreased.map(([code, d]) => (
            <div key={code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.15rem 0' }}>
              <span>{COUNTRY_NAMES[code] || code}</span>
              <span style={{ color: '#991b1b', fontWeight: 600 }}>{d.diff} screenings</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
