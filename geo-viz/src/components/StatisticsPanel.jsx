export default function StatisticsPanel({ data, selectedCountry, onClose, activeTab }) {
  const stats = data.statistics;

  const countryInfo = selectedCountry ? {
    production: data.production[selectedCountry],
    screening: data.screening[selectedCountry],
    outbound: data.flows.filter(f => f.source === selectedCountry).slice(0, 10),
    inbound: data.flows.filter(f => f.target === selectedCountry).slice(0, 10),
  } : null;

  return (
    <div className="stats-panel">
      {selectedCountry && countryInfo && (
        <div className="country-detail">
          <button className="close-btn" onClick={onClose}>&times;</button>
          <h4>{countryInfo.production?.country || countryInfo.screening?.country || selectedCountry}</h4>

          {countryInfo.production && (
            <div className="stat-item">
              <div className="stat-label">Production</div>
              <div className="stat-sub">
                {countryInfo.production.film_count} films &middot; {countryInfo.production.total_screenings} screenings &middot; {countryInfo.production.festivals_reached} festivals
              </div>
            </div>
          )}

          {countryInfo.screening && (
            <div className="stat-item">
              <div className="stat-label">As Screening Destination</div>
              <div className="stat-sub">
                {countryInfo.screening.screenings} screenings &middot; {countryInfo.screening.unique_films} films &middot; {countryInfo.screening.festivals} festivals
              </div>
            </div>
          )}

          {countryInfo.outbound.length > 0 && (
            <div className="stat-item">
              <div className="stat-label">Films travel to</div>
              <ul className="film-list">
                {countryInfo.outbound.map(f => (
                  <li key={f.target}>{f.target_name}: {f.film_count} films</li>
                ))}
              </ul>
            </div>
          )}

          {countryInfo.inbound.length > 0 && (
            <div className="stat-item">
              <div className="stat-label">Films arrive from</div>
              <ul className="film-list">
                {countryInfo.inbound.map(f => (
                  <li key={f.source}>{f.source_name}: {f.film_count} films</li>
                ))}
              </ul>
            </div>
          )}

          {countryInfo.screening?.top_films?.length > 0 && (
            <div className="stat-item">
              <div className="stat-label">Sample Films</div>
              <ul className="film-list">
                {countryInfo.screening.top_films.slice(0, 8).map(f => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <h3>Key Statistics</h3>

      <div className="stat-item">
        <div className="stat-label">Most Productive Country</div>
        <div className="stat-value">{stats.most_productive_country.country}</div>
        <div className="stat-sub">{stats.most_productive_country.film_count} films produced</div>
      </div>

      <div className="stat-item">
        <div className="stat-label">Most Active Screening Country</div>
        <div className="stat-value">{stats.most_active_screening_country.country}</div>
        <div className="stat-sub">{stats.most_active_screening_country.screenings} screenings</div>
      </div>

      <div className="stat-item">
        <div className="stat-label">Top Mobility Routes</div>
        <ul className="route-list">
          {stats.top_mobility_routes.slice(0, 5).map((r, i) => (
            <li key={i}>
              <span className="route-name">{r.route}</span>
              <span className="route-count">{r.films}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="stat-item">
        <div className="stat-label">Regional Circulation</div>
        <div className="regional-bars">
          {[
            { label: 'Within Europe', key: 'within_europe' },
            { label: 'Europe \u2194 N. America', key: 'europe_north_america' },
            { label: 'Europe \u2194 Asia', key: 'europe_asia' },
            { label: 'Other routes', key: 'other' },
          ].map(({ label, key }) => (
            <div className="regional-bar" key={key}>
              <div className="regional-bar-label">
                <span>{label}</span>
                <span>{stats.regional_circulation[key]}%</span>
              </div>
              <div className="regional-bar-track">
                <div
                  className="regional-bar-fill"
                  style={{ width: `${stats.regional_circulation[key]}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="stat-item">
        <div className="stat-label">Network Summary</div>
        <div className="stat-sub">
          {stats.total_production_countries} production countries &middot; {stats.total_screening_countries} screening countries &middot; {stats.total_cross_border_flows} cross-border flows
        </div>
      </div>
    </div>
  );
}
