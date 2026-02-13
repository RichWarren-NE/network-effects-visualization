# Network Effects: Film Mobility Visualization Tool

Mapping how short films circulate through international festival networks. This research project analyses 754 films across 393 festivals and 4,445 screenings to reveal programming patterns, geographic mobility, and community structures in the global short film ecosystem.

## Visualizations

### Network Graph
Interactive force-directed graph showing connections between 271 festivals based on shared programming. Reveals four distinct community clusters (generalist core, prestige/auteur, LGBTQ+ subcircuit, and international/documentary), festival tiers, and genre circuits.

### Film Circulation Timeline
Tracks how individual films move through the festival circuit over time, with filters for genre, year, and production country. Shows that award-winning films visit 3.6x more festivals and circulate for twice as long.

### Geographic Mobility
Heat maps and flow diagrams showing how films travel between 80 production countries and screening locations. The top circulation corridor is UK to US (66 films), with 52.6% of all circulation occurring within Europe.

## Live Version

View the deployed visualizations: *[GitHub Pages URL to be added]*

## Technologies

- **Frontend**: React 19, Vite 7
- **Visualizations**: D3.js 7 (network graph, timeline), Plotly.js (geographic maps)
- **Database**: PostgreSQL via Supabase (with Row Level Security)
- **Analysis**: Python (NetworkX, community detection, data extraction)

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- npm (included with Node.js)
- Python 3.10+ (for data extraction scripts only)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/network-effects-viz.git
   cd network-effects-viz
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. Install dependencies and start any of the apps:

   **Unified Dashboard** (all three visualizations):
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```

   **Timeline only**:
   ```bash
   cd timeline-viz
   npm install
   npm run dev
   ```

   **Geographic Mobility only**:
   ```bash
   cd geo-viz
   npm install
   npm run dev
   ```

4. Open `http://localhost:5173` in your browser.

### Building for Production

```bash
cd dashboard && npm run build    # outputs to docs/network/
cd timeline-viz && npm run build # outputs to docs/timeline/
cd geo-viz && npm run build      # outputs to docs/geo/
```

## Project Structure

```
network-effects-viz/
├── dashboard/          # Unified React dashboard (all 3 visualizations)
├── timeline-viz/       # Standalone timeline visualization (React + D3)
├── geo-viz/            # Standalone geographic mobility visualization (React + Plotly)
├── viz/                # Standalone HTML visualizations and data files
│   ├── network_viz_enhanced.html
│   ├── timeline_viz.html
│   ├── geo_mobility.html
│   └── *.json          # Visualization data files
├── database/           # SQL schemas, Python extraction scripts
├── data/               # Source data files
├── docs/               # Production builds (GitHub Pages root)
│   ├── index.html      # Landing page
│   ├── network/        # Dashboard build
│   ├── timeline/       # Timeline build
│   └── geo/            # Geographic build
├── reports/            # Analysis reports
├── .env.example        # Environment variable template
└── README.md
```

## Dataset

- **754 films** across **22 genres** from **80 production countries**
- **393 festivals** with **4,445 screenings** (1998-2026)
- **813 directors** tracked through the festival circuit
- Anchored around Encounters Festival (Bristol) — all films screened there
- 99% metadata completeness

## Contact

Rich Warren — [r.warren@bathspa.ac.uk](mailto:r.warren@bathspa.ac.uk)

Bath Spa University, 2025

## License

This project is licensed under the [MIT License](LICENSE).
