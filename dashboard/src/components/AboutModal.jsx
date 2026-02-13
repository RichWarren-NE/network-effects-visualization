export default function AboutModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>About This Tool</h2>

        <section className="modal-section">
          <h3>Network Effects: Film Mobility Visualisation Tool</h3>
          <p>
            This tool visualises how short films circulate through international
            festival networks. It integrates network analysis, circulation timelines,
            and geographic mapping to reveal the structural patterns that shape film
            mobility across borders.
          </p>
        </section>

        <section className="modal-section">
          <h3>Data Source</h3>
          <p>
            Circulation data provided by <strong>Miralot</strong> via{' '}
            <strong>Encounters Film Festival</strong> (Bristol, UK). The dataset
            includes 754 films across 393 festivals spanning 1998&ndash;2026. All
            films in the dataset have screened at Encounters, making it the anchor
            point for the network.
          </p>
        </section>

        <section className="modal-section">
          <h3>Methodology</h3>
          <ul>
            <li><strong>Network Analysis:</strong> Festival co-screening relationships
              modelled as a weighted undirected graph. Community detection via Louvain
              algorithm identifies four distinct subcircuits. Festival tiers (A-list,
              regional, specialist, emerging) classified by centrality metrics.</li>
            <li><strong>Timeline Analysis:</strong> Circulation span measured as years
              between first and last screening. Award impact measured by comparing
              festival counts and circulation spans between awarded and non-awarded
              films.</li>
            <li><strong>Geographic Analysis:</strong> Film mobility tracked from
              production country to screening country. Festival locations mapped via
              name matching (51.4% coverage). Regional circulation calculated as
              percentage of cross-border flows.</li>
          </ul>
        </section>

        <section className="modal-section">
          <h3>Citation</h3>
          <p className="citation">
            Warren, R. (2025) <em>Network Effects: Mapping Short Film Circulation
            Through Festival Networks</em>. Bath Spa University.
          </p>
        </section>

        <section className="modal-section">
          <h3>Data Notes</h3>
          <ul>
            <li>Only event year is available (no month/day precision)</li>
            <li>Festival location coverage: 202 of 393 festivals mapped to countries</li>
            <li>Some co-production films appear under multiple country codes</li>
            <li>Screening status categories vary by festival reporting conventions</li>
          </ul>
        </section>

        <section className="modal-section">
          <h3>Contact</h3>
          <p>
            For questions about this research, contact{' '}
            <a href="mailto:r.warren@bathspa.ac.uk" className="about-link">
              r.warren@bathspa.ac.uk
            </a>
          </p>
          <p className="about-affil">Bath Spa University &middot; School of Creative Industries</p>
        </section>
      </div>
    </div>
  );
}
