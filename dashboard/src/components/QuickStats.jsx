import { useFilteredData } from '../hooks/useFilteredData';

const COUNTRY_NAMES = {
  GB:'UK',FR:'France',US:'USA',DE:'Germany',CH:'Switzerland',IE:'Ireland',
  CA:'Canada',NL:'Netherlands',ES:'Spain',IT:'Italy',BE:'Belgium',AT:'Austria',
  SE:'Sweden',NO:'Norway',FI:'Finland',DK:'Denmark',PL:'Poland',CZ:'Czechia',
  GR:'Greece',PT:'Portugal',CN:'China',AU:'Australia',JP:'Japan',KR:'S. Korea',
};

function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '\u2026' : s; }

export default function QuickStats() {
  const { quickStats } = useFilteredData();
  const s = quickStats;

  return (
    <div className="quick-stats">
      <h3 className="filter-title">Selection Summary</h3>
      <div className="qs-grid">
        <div className="qs-item">
          <div className="qs-value">{s.films.toLocaleString()}</div>
          <div className="qs-label">Films</div>
        </div>
        <div className="qs-item">
          <div className="qs-value">{s.festivals.toLocaleString()}</div>
          <div className="qs-label">Festivals</div>
        </div>
        <div className="qs-item">
          <div className="qs-value">{s.screenings.toLocaleString()}</div>
          <div className="qs-label">Screenings</div>
        </div>
        <div className="qs-item">
          <div className="qs-value">{s.dateRange}</div>
          <div className="qs-label">Date Range</div>
        </div>
      </div>
      <div className="qs-detail">
        <div className="qs-row">
          <span className="qs-row-label">Top Country</span>
          <span className="qs-row-value">{COUNTRY_NAMES[s.topCountry] || s.topCountry} {s.topCountryCount ? `(${s.topCountryCount})` : ''}</span>
        </div>
        <div className="qs-row">
          <span className="qs-row-label">Top Festival</span>
          <span className="qs-row-value" title={s.topFestival}>{truncate(s.topFestival, 22)} {s.topFestivalCount ? `(${s.topFestivalCount})` : ''}</span>
        </div>
      </div>
    </div>
  );
}
