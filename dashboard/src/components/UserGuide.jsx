import { useState } from 'react';

const SECTIONS = [
  {
    title: 'Filters',
    content: [
      ['Search', 'Type a film title or director name to filter across all tabs. Results update after a brief pause.'],
      ['Year Range', 'Drag the two sliders to narrow the time window. The network graph will show only festivals active in that period.'],
      ['Event Type', 'Choose "Festivals" to see only screening events, "Awards" for award ceremonies, or "Both" for everything.'],
      ['Countries & Genres', 'Tick one or more checkboxes to filter by production country or genre. Filters combine with OR logic within a category (any match) and AND logic across categories.'],
      ['Reset', 'The red "Reset All Filters" button clears every filter. It turns bright red when any filter is active.'],
    ],
  },
  {
    title: 'Network Graph',
    content: [
      ['Reading the graph', 'Each node is a festival. Larger nodes screened more films. Edges connect festivals that share films. Thicker edges mean more shared films.'],
      ['Tiers', 'Node colour indicates tier: gold diamonds = A-list, blue circles = regional, purple squares = specialist, grey triangles = emerging.'],
      ['Interaction', 'Drag nodes to rearrange. Hover for festival details. The graph responds to the master year filter by showing only festivals active in the selected period.'],
    ],
  },
  {
    title: 'Timeline',
    content: [
      ['Reading rows', 'Each row is a film. Circles mark screening events along a horizontal time axis. Colour indicates status: yellow = award won, grey = nominated, orange = special mention, light grey = standard screening.'],
      ['Sorting', 'Use the dropdown to sort by number of festivals, awards, circulation span, or title.'],
      ['Pagination', 'Films are shown 40 per page. Use the arrows at the bottom to navigate.'],
      ['Hover', 'Hover over any circle to see the festival name, year, and screening status.'],
    ],
  },
  {
    title: 'Geographic Map',
    content: [
      ['Sub-tabs', 'Four views are available: Production (where films were made), Screenings (where films were shown), Flows (movement between countries), and Compare (side-by-side period comparison).'],
      ['Interaction', 'Click a country on the choropleth for a detail panel showing top films and connected countries.'],
      ['Flow Map', 'Arc thickness indicates the number of films travelling between two countries. Use the threshold slider to filter out minor flows.'],
      ['Compare', 'Compares pre-COVID (2015\u20132019) and post-COVID (2020\u20132025) periods side by side.'],
    ],
  },
  {
    title: 'Saved Views & Export',
    content: [
      ['Save View', 'Set your filters, then click "+ Save Current View" in the sidebar to name and store the configuration. Views persist across sessions.'],
      ['Load View', 'Click a saved view name to restore its filters instantly.'],
      ['Export', 'Click "Export Data" to download filtered data as CSV (for spreadsheets), JSON (structured data), PNG (current visualisation), or SVG (scalable vector).'],
    ],
  },
];

export default function UserGuide({ onClose }) {
  const [openSection, setOpenSection] = useState(0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal guide-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h2>User Guide</h2>
        <p className="modal-desc">
          How to explore short film circulation patterns using this dashboard.
        </p>

        <div className="guide-sections">
          {SECTIONS.map((sec, i) => (
            <div key={sec.title} className="guide-section">
              <button
                className={`guide-header ${openSection === i ? 'open' : ''}`}
                onClick={() => setOpenSection(openSection === i ? -1 : i)}
              >
                <span>{sec.title}</span>
                <span className="guide-chevron">{openSection === i ? '\u25B2' : '\u25BC'}</span>
              </button>
              {openSection === i && (
                <div className="guide-body">
                  {sec.content.map(([label, text]) => (
                    <div key={label} className="guide-item">
                      <strong>{label}:</strong> {text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
