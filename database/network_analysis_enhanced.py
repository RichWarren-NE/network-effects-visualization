"""
Network Effects: Enhanced Network Analysis

Builds year-sliced network data, classifies festival tiers,
detects genre-based subcircuits, and exports enriched JSON for D3.js.
"""

import os, sys, io, json
from collections import defaultdict, Counter

import psycopg2
import networkx as nx
import community as community_louvain
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
VIZ_DIR = os.path.join(BASE_DIR, 'viz')
os.makedirs(VIZ_DIR, exist_ok=True)

load_dotenv(os.path.join(BASE_DIR, '.env'))

def get_conn():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'), database=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'), password=os.getenv('SUPABASE_PASSWORD'),
        port=os.getenv('SUPABASE_PORT'), sslmode='require'
    )

conn = get_conn()
cur = conn.cursor()

# =====================================================================
# 1. Year-sliced edges (for animation)
# =====================================================================
print("1. Building year-sliced edges...")
cur.execute("""
    WITH festival_film_year AS (
        SELECT DISTINCT
            f.festival_name, s.film_id, s.event_year
        FROM screenings s
        JOIN festivals f ON s.festival_id = f.festival_id
        WHERE s.event_year BETWEEN 2015 AND 2025
    )
    SELECT
        a.festival_name AS fa,
        b.festival_name AS fb,
        a.event_year,
        COUNT(DISTINCT a.film_id) AS shared_count
    FROM festival_film_year a
    JOIN festival_film_year b
        ON a.film_id = b.film_id
        AND a.festival_name < b.festival_name
        AND a.event_year = b.event_year
    GROUP BY a.festival_name, b.festival_name, a.event_year
    HAVING COUNT(DISTINCT a.film_id) >= 2
    ORDER BY a.event_year, shared_count DESC
""")
year_edges_raw = cur.fetchall()

# Group by year
year_edges = defaultdict(list)
for fa, fb, yr, cnt in year_edges_raw:
    year_edges[int(yr)].append({'source': fa, 'target': fb, 'weight': int(cnt)})

# Also get active festivals per year
cur.execute("""
    SELECT f.festival_name, s.event_year, COUNT(DISTINCT s.film_id) as films
    FROM festivals f
    JOIN screenings s ON f.festival_id = s.festival_id
    WHERE s.event_year BETWEEN 2015 AND 2025
    GROUP BY f.festival_name, s.event_year
""")
year_festivals = defaultdict(dict)
for name, yr, films in cur.fetchall():
    year_festivals[int(yr)][name] = int(films)

print(f"   Year-sliced edges across {len(year_edges)} years")
for yr in sorted(year_edges.keys()):
    fests_active = len(year_festivals.get(yr, {}))
    print(f"   {yr}: {len(year_edges[yr]):4d} edges, {fests_active:3d} active festivals")

# =====================================================================
# 2. Festival tiers
# =====================================================================
print("\n2. Classifying festival tiers...")

# Tier criteria based on film count + international reach
cur.execute("""
    SELECT fs.festival_name, fs.event_type, fs.unique_film_count,
           fs.countries_represented, fs.total_screenings,
           fs.first_year, fs.last_year
    FROM vw_festival_statistics fs
    ORDER BY fs.unique_film_count DESC
""")
festival_rows = cur.fetchall()

# A-list: internationally recognised, large film counts, wide geographic reach
# Regional: moderate film counts, more localised
# Specialist: niche focus (LGBTQ+, animation-only, documentary-only, etc.)
# Emerging: smaller/newer festivals

# Specialist detection keywords
SPECIALIST_KEYWORDS = {
    'lgbtq': ['queer', 'lgbtq', 'gay', 'lesbian', 'frameline', 'outfest',
              'chéries-chéris', 'cheris', 'reelout', 'iris prize', 'merlinka',
              'pink apple', 'mix copenhagen', 'image+nation'],
    'animation': ['annecy', 'animafest', 'animest', 'animated encounters',
                  'animation', 'hiroshima', 'anima'],
    'documentary': ['doc', 'dokufest', 'doclisboa', 'docaviv', 'idfa',
                    'dok leipzig', 'visions du réel', 'jihlava'],
    'horror': ['frightfest', 'horror', 'sitges', 'fantasia'],
}

# Well-known A-list festivals
A_LIST_NAMES = {
    'berlin international film festival', 'cannes film festival',
    'venice international film festival', 'toronto international film festival',
    'sundance film festival', 'locarno film festival',
    'san sebastián international film festival', 'rotterdam international film festival',
    'bfi london film festival', 'new york film festival',
    'clermont-ferrand international short film festival',
    'annecy international animation festival', 'sxsw film festival',
    'tribeca film festival', 'telluride film festival',
    'edinburgh international film festival',
    'palm springs international shortfest',
    'encounters short film and animation festival',
}

tiers = {}
for name, etype, films, countries, screenings, fy, ly in festival_rows:
    name_lower = name.lower()

    # Check specialist first
    specialist_type = None
    for stype, keywords in SPECIALIST_KEYWORDS.items():
        if any(kw in name_lower for kw in keywords):
            specialist_type = stype
            break

    if specialist_type:
        tiers[name] = {'tier': 'specialist', 'specialist_type': specialist_type}
    elif name_lower in A_LIST_NAMES or (films and films >= 40 and countries and countries >= 20):
        tiers[name] = {'tier': 'a-list', 'specialist_type': None}
    elif films and films >= 10:
        tiers[name] = {'tier': 'regional', 'specialist_type': None}
    else:
        tiers[name] = {'tier': 'emerging', 'specialist_type': None}

tier_counts = Counter(t['tier'] for t in tiers.values())
print(f"   A-list: {tier_counts['a-list']}, Regional: {tier_counts['regional']}, "
      f"Specialist: {tier_counts['specialist']}, Emerging: {tier_counts['emerging']}")

# =====================================================================
# 3. Genre subcircuits
# =====================================================================
print("\n3. Detecting genre subcircuits...")

# For each festival, get its dominant genre profile
cur.execute("""
    SELECT f.festival_name,
           g.genre_name,
           COUNT(DISTINCT s.film_id) AS film_count
    FROM festivals f
    JOIN screenings s ON f.festival_id = s.festival_id
    JOIN film_genres fg ON s.film_id = fg.film_id
    JOIN genres g ON fg.genre_id = g.genre_id
    WHERE g.genre_name NOT IN ('Short')
    GROUP BY f.festival_name, g.genre_name
    ORDER BY f.festival_name, film_count DESC
""")

festival_genres = defaultdict(lambda: defaultdict(int))
for fname, gname, cnt in cur.fetchall():
    festival_genres[fname][gname] = int(cnt)

# Classify dominant genre
def classify_genre_circuit(genres_dict):
    if not genres_dict:
        return 'mixed'
    total = sum(genres_dict.values())
    if total == 0:
        return 'mixed'

    animation_pct = genres_dict.get('Animation', 0) / total
    doc_pct = genres_dict.get('Documentary', 0) / total
    drama_pct = genres_dict.get('Drama', 0) / total
    lgbtq_pct = genres_dict.get('LGBTQ+', 0) / total

    if animation_pct > 0.5:
        return 'animation'
    if doc_pct > 0.4:
        return 'documentary'
    if lgbtq_pct > 0.3:
        return 'lgbtq'
    if drama_pct > 0.4:
        return 'fiction'
    return 'mixed'

genre_circuits = {}
for fname, gdict in festival_genres.items():
    genre_circuits[fname] = classify_genre_circuit(gdict)

# Override with specialist type if available
for fname, tier_info in tiers.items():
    if tier_info['specialist_type']:
        genre_circuits[fname] = tier_info['specialist_type']

circuit_counts = Counter(genre_circuits.values())
print(f"   Genre circuits: {dict(circuit_counts)}")

# =====================================================================
# 4. Film-to-festival index for search
# =====================================================================
print("\n4. Building film search index...")
cur.execute("""
    SELECT f.title, f.year,
           STRING_AGG(DISTINCT d.director_name, ', ' ORDER BY d.director_name) AS directors,
           ARRAY_AGG(DISTINCT fest.festival_name) AS festivals
    FROM films f
    LEFT JOIN film_directors fd ON f.film_id = fd.film_id
    LEFT JOIN directors d ON fd.director_id = d.director_id
    JOIN screenings s ON f.film_id = s.film_id
    JOIN festivals fest ON s.festival_id = fest.festival_id
    GROUP BY f.film_id, f.title, f.year
    ORDER BY f.title
""")
film_index = []
for title, year, directors, festivals_arr in cur.fetchall():
    film_index.append({
        'title': title,
        'year': int(year) if year else None,
        'directors': directors or '',
        'festivals': list(festivals_arr) if festivals_arr else [],
    })
print(f"   {len(film_index)} films indexed")

cur.close()
conn.close()

# =====================================================================
# 5. Build aggregate graph and compute metrics
# =====================================================================
print("\n5. Computing network metrics...")

# Load existing network_data.json for node metrics
with open(os.path.join(VIZ_DIR, 'network_data.json'), 'r', encoding='utf-8') as f:
    existing = json.load(f)

existing_nodes = {n['id']: n for n in existing['nodes']}

# Enrich nodes with tier and genre circuit
enriched_nodes = []
for n in existing['nodes']:
    tier_info = tiers.get(n['id'], {'tier': 'emerging', 'specialist_type': None})
    circuit = genre_circuits.get(n['id'], 'mixed')
    genre_profile = dict(festival_genres.get(n['id'], {}))

    enriched_nodes.append({
        **n,
        'tier': tier_info['tier'],
        'specialist_type': tier_info['specialist_type'],
        'genre_circuit': circuit,
        'genre_profile': genre_profile,
    })

# =====================================================================
# 6. Cumulative edges (2015-Y) for animation
# =====================================================================
print("\n6. Building cumulative network snapshots...")
cumulative_snapshots = {}
for year in range(2015, 2026):
    # Cumulative edges: aggregate all edges from 2015 to this year
    cum_edge_map = defaultdict(int)
    cum_festival_films = defaultdict(int)
    for y in range(2015, year + 1):
        for e in year_edges.get(y, []):
            key = (min(e['source'], e['target']), max(e['source'], e['target']))
            cum_edge_map[key] += e['weight']
        for fname, fcount in year_festivals.get(y, {}).items():
            cum_festival_films[fname] += fcount

    cum_edges = [
        {'source': k[0], 'target': k[1], 'weight': v}
        for k, v in cum_edge_map.items() if v >= 2
    ]

    # Active nodes for this cumulative slice
    active_ids = set()
    for e in cum_edges:
        active_ids.add(e['source'])
        active_ids.add(e['target'])

    cumulative_snapshots[year] = {
        'edges': cum_edges,
        'active_nodes': list(active_ids),
        'node_films': {k: v for k, v in cum_festival_films.items() if k in active_ids},
        'stats': {
            'nodes': len(active_ids),
            'edges': len(cum_edges),
        }
    }
    print(f"   {year}: {len(active_ids):3d} nodes, {len(cum_edges):4d} edges (cumulative)")

# =====================================================================
# 7. Export enhanced JSON
# =====================================================================
print("\n7. Exporting enhanced JSON...")

GENRE_CIRCUIT_COLOURS = {
    'animation':   '#00b4d8',
    'documentary': '#e9c46a',
    'fiction':     '#e76f51',
    'lgbtq':      '#c77dff',
    'horror':     '#ff4444',
    'mixed':      '#6b7a8d',
}

TIER_SHAPES = {
    'a-list':     'diamond',
    'regional':   'circle',
    'specialist': 'square',
    'emerging':   'triangle',
}

output = {
    'nodes': enriched_nodes,
    'edges': existing['edges'],
    'metadata': {
        **existing['metadata'],
        'genre_circuit_colours': GENRE_CIRCUIT_COLOURS,
        'tier_shapes': TIER_SHAPES,
        'years': list(range(2015, 2026)),
    },
    'year_snapshots': {str(yr): snap for yr, snap in cumulative_snapshots.items()},
    'film_index': film_index,
}

out_path = os.path.join(VIZ_DIR, 'network_data_enhanced.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False)

size_mb = os.path.getsize(out_path) / 1024 / 1024
print(f"   Saved: {out_path} ({size_mb:.1f} MB)")
print(f"   {len(enriched_nodes)} nodes, {len(existing['edges'])} edges, "
      f"{len(cumulative_snapshots)} year snapshots, {len(film_index)} films indexed")

print("\nDone.")
