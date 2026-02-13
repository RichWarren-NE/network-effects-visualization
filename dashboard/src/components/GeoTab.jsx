import { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useFilteredData } from '../hooks/useFilteredData';
import { useFilters } from '../contexts/FilterContext';

const A2_A3 = {
  GB:'GBR',FR:'FRA',US:'USA',DE:'DEU',CH:'CHE',IE:'IRL',CA:'CAN',NL:'NLD',
  ES:'ESP',IT:'ITA',BE:'BEL',AT:'AUT',SE:'SWE',NO:'NOR',FI:'FIN',DK:'DNK',
  IS:'ISL',PL:'POL',CZ:'CZE',BA:'BIH',HR:'HRV',SI:'SVN',RO:'ROU',BG:'BGR',
  TR:'TUR',GE:'GEO',LT:'LTU',LV:'LVA',EE:'EST',HU:'HUN',UA:'UKR',RU:'RUS',
  PT:'PRT',GR:'GRC',KR:'KOR',JP:'JPN',HK:'HKG',CN:'CHN',SG:'SGP',TW:'TWN',
  IN:'IND',IR:'IRN',AE:'ARE',IL:'ISR',ZA:'ZAF',BF:'BFA',AU:'AUS',NZ:'NZL',
  CU:'CUB',MX:'MEX',BR:'BRA',CO:'COL',AR:'ARG',CL:'CHL',PE:'PER',RS:'SRB',
  SK:'SVK',LB:'LBN',
};
const A3_A2 = Object.fromEntries(Object.entries(A2_A3).map(([k, v]) => [v, k]));

const CENTROIDS = {
  GB:[54,-2],FR:[46.6,2.3],US:[39,-98],DE:[51,10],CH:[47,8],IE:[53.4,-8],
  CA:[56,-96],NL:[52.3,5.3],ES:[40,-3.7],IT:[42.5,12.5],BE:[50.8,4.3],
  AT:[47.5,13.3],SE:[62,15],NO:[64,12],FI:[64,26],DK:[56,10],IS:[65,-18],
  PL:[52,20],CZ:[49.8,15.5],BA:[44,17.7],HR:[45.2,15.5],SI:[46.1,14.8],
  RO:[46,25],BG:[42.7,25.5],GR:[39.1,21.8],PT:[39.4,-8.2],HU:[47.2,19.5],
  LT:[55.2,24],LV:[57,24.7],EE:[58.6,25],TR:[39,35.2],GE:[42.3,43.4],
  UA:[49,31.4],RU:[61,105],KR:[36,128],JP:[36.2,138.3],CN:[35,105],
  HK:[22.3,114.2],SG:[1.4,103.8],TW:[23.7,121],IN:[20.6,79],IR:[32.4,53.7],
  AE:[24,54],IL:[31.5,34.8],ZA:[-28.5,24.5],AU:[-25.3,133.8],NZ:[-40.9,174.9],
  CU:[21.5,-80],MX:[23.6,-102.6],BR:[-14.2,-51.9],CO:[4.6,-74.3],AR:[-38.4,-63.6],
};

const COUNTRY_NAMES = {
  GB:'United Kingdom',FR:'France',US:'United States',DE:'Germany',CH:'Switzerland',
  IE:'Ireland',CA:'Canada',NL:'Netherlands',ES:'Spain',IT:'Italy',BE:'Belgium',
  AT:'Austria',SE:'Sweden',NO:'Norway',FI:'Finland',DK:'Denmark',PL:'Poland',
  CZ:'Czechia',GR:'Greece',PT:'Portugal',CN:'China',AU:'Australia',JP:'Japan',
  KR:'South Korea',IN:'India',BR:'Brazil',HU:'Hungary',EE:'Estonia',
};

const colorscale = [[0,'#dbeafe'],[0.15,'#93c5fd'],[0.4,'#3b82f6'],[1,'#1e40af']];
const geoEurope = {
  showframe:false,showcoastlines:true,coastlinecolor:'#cbd5e1',
  showland:true,landcolor:'#f8fafc',showocean:true,oceancolor:'#f0f9ff',
  showcountries:true,countrycolor:'#e2e8f0',
  projection:{type:'natural earth'},lonaxis:{range:[-30,60]},lataxis:{range:[25,72]},
};
const geoWorld = { ...geoEurope, lonaxis: undefined, lataxis: undefined };

export default function GeoTab() {
  const { geoData } = useFilteredData();
  const [subTab, setSubTab] = useState('production');
  const [flowThreshold, setFlowThreshold] = useState(3);
  const [selectedCountry, setSelectedCountry] = useState(null);

  if (!geoData) return <div className="tab-empty">No geographic data available.</div>;

  const subs = [
    { id: 'production', label: 'Production' },
    { id: 'screening', label: 'Screenings' },
    { id: 'flow', label: 'Flows' },
    { id: 'compare', label: 'Compare' },
  ];

  return (
    <div className="geo-tab">
      <div className="viz-toolbar">
        <div className="sub-tabs">
          {subs.map(s => (
            <button key={s.id} className={`sub-tab ${subTab === s.id ? 'active' : ''}`}
              onClick={() => { setSubTab(s.id); setSelectedCountry(null); }}>{s.label}</button>
          ))}
        </div>
        {subTab === 'flow' && (
          <div className="flow-threshold">
            <label>Min films: {flowThreshold}</label>
            <input type="range" min={1} max={30} value={flowThreshold}
              onChange={e => setFlowThreshold(+e.target.value)} />
          </div>
        )}
      </div>

      <div className="geo-content">
        <div className="geo-map">
          {subTab === 'production' && <ChoroplethMap data={geoData.production} mode="production" onClick={setSelectedCountry} />}
          {subTab === 'screening' && <ChoroplethMap data={geoData.screening} mode="screening" onClick={setSelectedCountry} />}
          {subTab === 'flow' && <FlowMapInner data={geoData} threshold={flowThreshold} />}
          {subTab === 'compare' && <ComparisonInner data={geoData} />}
        </div>

        {selectedCountry && (subTab === 'production' || subTab === 'screening') && (
          <div className="geo-detail">
            <button className="detail-close" onClick={() => setSelectedCountry(null)}>&times;</button>
            <CountryDetail code={selectedCountry} data={geoData} />
          </div>
        )}
      </div>

      <div className="geo-stats-bar">
        <span>Coverage: {geoData.data_completeness?.festivals_mapped}/{geoData.data_completeness?.festivals_total} festivals mapped ({geoData.data_completeness?.coverage_pct}%)</span>
        <span className="geo-stats-sep">|</span>
        <span>Top route: {geoData.statistics?.top_mobility_routes?.[0]?.route} ({geoData.statistics?.top_mobility_routes?.[0]?.films} films)</span>
        <span className="geo-stats-sep">|</span>
        <span>Within Europe: {geoData.statistics?.regional_circulation?.within_europe}%</span>
      </div>
    </div>
  );
}

function ChoroplethMap({ data, mode, onClick }) {
  const { locs, vals, texts } = useMemo(() => {
    const l = [], v = [], t = [];
    for (const [code, info] of Object.entries(data)) {
      const a3 = A2_A3[code]; if (!a3) continue;
      const val = mode === 'production' ? info.film_count : info.screenings;
      const label = mode === 'production'
        ? `${info.country}<br>Films: ${info.film_count}<br>Screenings: ${info.total_screenings}<br>Festivals: ${info.festivals_reached}`
        : `${info.country}<br>Screenings: ${info.screenings}<br>Films: ${info.unique_films}<br>Festivals: ${info.festivals}`;
      l.push(a3); v.push(val); t.push(label);
    }
    return { locs: l, vals: v, texts: t };
  }, [data, mode]);

  return (
    <Plot
      data={[{
        type:'choropleth',locationmode:'ISO-3',locations:locs,z:vals,text:texts,
        hoverinfo:'text',colorscale,
        colorbar:{title:{text:mode==='production'?'Films':'Screenings',font:{size:11}},thickness:12,len:0.4,tickfont:{size:9}},
        marker:{line:{color:'#cbd5e1',width:0.5}},
      }]}
      layout={{
        title:{text:mode==='production'?'Film Production by Country':'Festival Screenings by Country',font:{size:14,color:'#1e3a5f'},x:0.5},
        geo:geoEurope,margin:{t:35,b:5,l:5,r:5},height:460,paper_bgcolor:'white',
      }}
      config={{responsive:true,displayModeBar:false}}
      style={{width:'100%'}}
      onClick={e => {
        if (e.points?.[0]) {
          const code = A3_A2[e.points[0].location];
          if (code) onClick(code);
        }
      }}
    />
  );
}

function FlowMapInner({ data, threshold }) {
  const traces = useMemo(() => {
    const flows = data.flows.filter(f => f.film_count >= threshold);
    if (!flows.length) return [];
    const maxF = Math.max(...flows.map(f => f.film_count));
    const result = [];
    const cFilms = {};

    for (const f of flows) {
      const s = CENTROIDS[f.source], d = CENTROIDS[f.target];
      if (!s || !d) continue;
      const w = Math.max(0.5, (f.film_count / maxF) * 5);
      const op = Math.min(0.8, 0.15 + (f.film_count / maxF) * 0.65);
      cFilms[f.source] = (cFilms[f.source] || 0) + f.film_count;
      cFilms[f.target] = (cFilms[f.target] || 0) + f.film_count;
      result.push({
        type:'scattergeo',mode:'lines',
        lon:[s[1],d[1]],lat:[s[0],d[0]],
        line:{width:w,color:`rgba(30,64,175,${op})`},
        hoverinfo:'text',
        text:`${f.source_name} \u2192 ${f.target_name}<br>${f.film_count} films (${f.screening_count} screenings)`,
        showlegend:false,
      });
    }

    const mLon=[],mLat=[],mTxt=[],mSz=[];
    for (const [code, count] of Object.entries(cFilms)) {
      const c = CENTROIDS[code]; if (!c) continue;
      mLat.push(c[0]); mLon.push(c[1]);
      mTxt.push(`${COUNTRY_NAMES[code]||code}: ${count} connections`);
      mSz.push(Math.max(5, Math.min(20, Math.sqrt(count) * 2)));
    }
    result.push({
      type:'scattergeo',mode:'markers',lon:mLon,lat:mLat,
      hoverinfo:'text',hovertext:mTxt,
      marker:{size:mSz,color:'#3b82f6',line:{width:1,color:'white'},opacity:0.8},
      showlegend:false,
    });
    return result;
  }, [data, threshold]);

  return (
    <Plot data={traces}
      layout={{
        title:{text:`Film Mobility Flows (${threshold}+ films)`,font:{size:14,color:'#1e3a5f'},x:0.5},
        geo:geoWorld,margin:{t:35,b:5,l:5,r:5},height:460,paper_bgcolor:'white',showlegend:false,
      }}
      config={{responsive:true,displayModeBar:false}} style={{width:'100%'}} />
  );
}

function ComparisonInner({ data }) {
  const { p1, p2, inc, dec } = useMemo(() => {
    const agg = (start, end) => {
      const cd = {};
      for (const [y, snap] of Object.entries(data.year_snapshots || {})) {
        const yr = parseInt(y); if (yr < start || yr > end) continue;
        for (const [code, d] of Object.entries(snap.screening || {})) {
          if (!cd[code]) cd[code] = { films: 0, screenings: 0 };
          cd[code].films += d.films; cd[code].screenings += d.screenings;
        }
      }
      return cd;
    };
    const pre = agg(2015, 2019), post = agg(2020, 2025);
    const mk = (src) => {
      const l=[],v=[],t=[];
      for (const [c,d] of Object.entries(src)) {
        const a = A2_A3[c]; if (!a) continue;
        l.push(a); v.push(d.screenings);
        t.push(`${COUNTRY_NAMES[c]||c}<br>Screenings: ${d.screenings}<br>Films: ${d.films}`);
      }
      return {l,v,t};
    };
    const allC = new Set([...Object.keys(pre), ...Object.keys(post)]);
    const changes = [];
    for (const c of allC) {
      const b = (pre[c]||{}).screenings||0, a = (post[c]||{}).screenings||0;
      changes.push({ code: c, name: COUNTRY_NAMES[c]||c, diff: a-b });
    }
    return {
      p1: mk(pre), p2: mk(post),
      inc: changes.filter(c=>c.diff>0).sort((a,b)=>b.diff-a.diff).slice(0,6),
      dec: changes.filter(c=>c.diff<0).sort((a,b)=>a.diff-b.diff).slice(0,4),
    };
  }, [data]);

  const trace = (d) => ({
    type:'choropleth',locationmode:'ISO-3',locations:d.l,z:d.v,text:d.t,
    hoverinfo:'text',colorscale,showscale:false,
    marker:{line:{color:'#cbd5e1',width:0.5}},
  });

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
        <div>
          <div style={{textAlign:'center',fontSize:'0.8rem',fontWeight:600,color:'#1e3a5f',padding:'0.3rem'}}>Pre-COVID: 2015&ndash;2019</div>
          <Plot data={[trace(p1)]} layout={{geo:geoEurope,margin:{t:5,b:5,l:5,r:5},height:260,paper_bgcolor:'white'}} config={{responsive:true,displayModeBar:false}} style={{width:'100%'}} />
        </div>
        <div>
          <div style={{textAlign:'center',fontSize:'0.8rem',fontWeight:600,color:'#1e3a5f',padding:'0.3rem'}}>COVID Era &amp; Recovery: 2020&ndash;2025</div>
          <Plot data={[trace(p2)]} layout={{geo:geoEurope,margin:{t:5,b:5,l:5,r:5},height:260,paper_bgcolor:'white'}} config={{responsive:true,displayModeBar:false}} style={{width:'100%'}} />
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem',marginTop:'0.5rem'}}>
        <div style={{background:'#f0fdf4',padding:'0.5rem',borderRadius:6,border:'1px solid #bbf7d0'}}>
          <div style={{fontSize:'0.8rem',fontWeight:600,color:'#166534',marginBottom:'0.3rem'}}>Increased</div>
          {inc.map(c => <div key={c.code} style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem',padding:'0.1rem 0'}}><span>{c.name}</span><span style={{color:'#166534',fontWeight:600}}>+{c.diff}</span></div>)}
        </div>
        <div style={{background:'#fef2f2',padding:'0.5rem',borderRadius:6,border:'1px solid #fecaca'}}>
          <div style={{fontSize:'0.8rem',fontWeight:600,color:'#991b1b',marginBottom:'0.3rem'}}>Decreased</div>
          {dec.length ? dec.map(c => <div key={c.code} style={{display:'flex',justifyContent:'space-between',fontSize:'0.75rem',padding:'0.1rem 0'}}><span>{c.name}</span><span style={{color:'#991b1b',fontWeight:600}}>{c.diff}</span></div>) : <div style={{fontSize:'0.75rem',color:'#991b1b'}}>None</div>}
        </div>
      </div>
    </div>
  );
}

function CountryDetail({ code, data }) {
  const p = data.production[code];
  const s = data.screening[code];
  const outbound = data.flows.filter(f => f.source === code).slice(0, 8);
  const inbound = data.flows.filter(f => f.target === code).slice(0, 8);
  const name = p?.country || s?.country || code;

  return (
    <div>
      <h4 style={{ color: '#1e40af', marginBottom: '0.5rem' }}>{name}</h4>
      {p && (
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Production</div>
          <div style={{ fontSize: '0.8rem', color: '#475569' }}>{p.film_count} films &middot; {p.total_screenings} screenings &middot; {p.festivals_reached} festivals &middot; {p.awards} awards</div>
        </div>
      )}
      {s && (
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Screening Destination</div>
          <div style={{ fontSize: '0.8rem', color: '#475569' }}>{s.screenings} screenings &middot; {s.unique_films} films &middot; {s.festivals} festivals</div>
        </div>
      )}
      {outbound.length > 0 && (
        <div style={{ marginBottom: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Films Travel To</div>
          {outbound.map(f => <div key={f.target} style={{ fontSize: '0.75rem', color: '#475569' }}>{f.target_name}: {f.film_count} films</div>)}
        </div>
      )}
      {inbound.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>Films Arrive From</div>
          {inbound.map(f => <div key={f.source} style={{ fontSize: '0.75rem', color: '#475569' }}>{f.source_name}: {f.film_count} films</div>)}
        </div>
      )}
    </div>
  );
}
