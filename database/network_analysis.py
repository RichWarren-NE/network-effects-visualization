"""
Network Effects: Festival Network Analysis

Builds a weighted graph from vw_network_edges, computes centrality metrics,
detects communities, and exports JSON for D3.js visualisation.

Usage:
    python database/network_analysis.py
"""

import os
import sys
import io
import json
import csv
from collections import defaultdict

import psycopg2
import networkx as nx
import community as community_louvain
from dotenv import load_dotenv

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
VIZ_DIR = os.path.join(BASE_DIR, 'viz')
REPORTS_DIR = os.path.join(BASE_DIR, 'reports')
os.makedirs(VIZ_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Database connection
# ---------------------------------------------------------------------------
load_dotenv(os.path.join(BASE_DIR, '.env'))

def get_conn():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'), database=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'), password=os.getenv('SUPABASE_PASSWORD'),
        port=os.getenv('SUPABASE_PORT'), sslmode='require'
    )

# ---------------------------------------------------------------------------
# 1. Build the graph
# ---------------------------------------------------------------------------
print("Building festival network graph...")
conn = get_conn()
cur = conn.cursor()

# Fetch all edges (festival pairs with 2+ shared films)
cur.execute("""
    SELECT festival_a, festival_b, festival_a_type, festival_b_type,
           shared_film_count
    FROM vw_network_edges
""")
edges = cur.fetchall()
print(f"  {len(edges)} edges loaded from vw_network_edges")

# Fetch per-festival metadata
cur.execute("""
    SELECT festival_name, event_type, unique_film_count, total_screenings,
           first_year, last_year, countries_represented, genres_represented
    FROM vw_festival_statistics
""")
festival_meta = {}
for row in cur.fetchall():
    festival_meta[row[0]] = {
        'event_type': row[1],
        'film_count': row[2],
        'total_screenings': row[3],
        'first_year': row[4],
        'last_year': row[5],
        'countries_represented': row[6],
        'genres': row[7],
    }

# Fetch per-festival year-level data for temporal analysis
cur.execute("""
    SELECT f.festival_name, s.event_year, COUNT(DISTINCT s.film_id) as films
    FROM festivals f
    JOIN screenings s ON f.festival_id = s.festival_id
    WHERE s.event_year IS NOT NULL
    GROUP BY f.festival_name, s.event_year
    ORDER BY f.festival_name, s.event_year
""")
festival_years = defaultdict(dict)
for name, year, films in cur.fetchall():
    festival_years[name][year] = films

# Fetch time-sliced edges for temporal analysis
cur.execute("""
    WITH festival_film_year AS (
        SELECT DISTINCT
            f.festival_name,
            s.film_id,
            s.event_year
        FROM screenings s
        JOIN festivals f ON s.festival_id = f.festival_id
    ),
    year_edges AS (
        SELECT
            a.festival_name AS fa,
            b.festival_name AS fb,
            a.event_year,
            COUNT(DISTINCT a.film_id) AS shared
        FROM festival_film_year a
        JOIN festival_film_year b
            ON a.film_id = b.film_id
            AND a.festival_name < b.festival_name
            AND a.event_year = b.event_year
        GROUP BY a.festival_name, b.festival_name, a.event_year
        HAVING COUNT(DISTINCT a.film_id) >= 2
    )
    SELECT event_year, COUNT(*) AS edge_count,
           SUM(shared) AS total_shared,
           COUNT(DISTINCT fa) + COUNT(DISTINCT fb) AS approx_nodes
    FROM year_edges
    GROUP BY event_year
    ORDER BY event_year
""")
temporal_stats = cur.fetchall()

cur.close()
conn.close()

# Build NetworkX graph
G = nx.Graph()

# Add nodes with metadata
all_festivals = set()
for fa, fb, fa_type, fb_type, count in edges:
    all_festivals.add(fa)
    all_festivals.add(fb)

for fest in all_festivals:
    meta = festival_meta.get(fest, {})
    G.add_node(fest, **meta)

# Add weighted edges
for fa, fb, fa_type, fb_type, count in edges:
    G.add_edge(fa, fb, weight=count)

print(f"  Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

# ---------------------------------------------------------------------------
# 2. Network statistics
# ---------------------------------------------------------------------------
print("\nCalculating network statistics...")

# Degree centrality (normalized)
degree_cent = nx.degree_centrality(G)

# Weighted degree (strength): sum of edge weights
strength = {n: sum(d['weight'] for _, _, d in G.edges(n, data=True)) for n in G.nodes()}

# Betweenness centrality (weighted)
betweenness = nx.betweenness_centrality(G, weight='weight')

# Closeness centrality
closeness = nx.closeness_centrality(G)

# Eigenvector centrality (measures influence through well-connected neighbours)
try:
    eigenvector = nx.eigenvector_centrality(G, max_iter=500, weight='weight')
except nx.PowerIterationFailedConvergence:
    print("  Warning: eigenvector centrality did not converge, using unweighted")
    eigenvector = nx.eigenvector_centrality(G, max_iter=500)

# Clustering coefficient
clustering = nx.clustering(G, weight='weight')

# Global metrics
density = nx.density(G)
avg_clustering = nx.average_clustering(G)
components = list(nx.connected_components(G))
largest_cc = max(components, key=len)
avg_path_len = nx.average_shortest_path_length(G.subgraph(largest_cc))

print(f"  Density: {density:.4f}")
print(f"  Average clustering coefficient: {avg_clustering:.4f}")
print(f"  Connected components: {len(components)}")
print(f"  Largest component: {len(largest_cc)} nodes ({len(largest_cc)*100//G.number_of_nodes()}%)")
print(f"  Average shortest path (largest component): {avg_path_len:.2f}")

# ---------------------------------------------------------------------------
# 3. Community detection (Louvain method)
# ---------------------------------------------------------------------------
print("\nDetecting communities (Louvain method)...")
partition = community_louvain.best_partition(G, weight='weight', resolution=1.0)
n_communities = max(partition.values()) + 1
print(f"  Found {n_communities} communities")

# Community profiles
community_members = defaultdict(list)
for node, comm_id in partition.items():
    community_members[comm_id].append(node)

community_profiles = {}
for comm_id, members in sorted(community_members.items()):
    # Top members by degree centrality
    sorted_members = sorted(members, key=lambda n: degree_cent[n], reverse=True)
    # Aggregate event types
    types = defaultdict(int)
    for m in members:
        t = festival_meta.get(m, {}).get('event_type', 'unknown')
        types[t] += 1

    community_profiles[comm_id] = {
        'size': len(members),
        'top_members': sorted_members[:5],
        'event_types': dict(types),
    }
    top_names = ', '.join(sorted_members[:3])
    print(f"  Community {comm_id}: {len(members)} festivals (top: {top_names})")

# ---------------------------------------------------------------------------
# 4. Export JSON for D3.js
# ---------------------------------------------------------------------------
print("\nExporting JSON for D3.js...")

# Assign colours by community
COMMUNITY_COLOURS = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf',
    '#aec7e8', '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5',
    '#c49c94', '#f7b6d2', '#c7c7c7', '#dbdb8d', '#9edae5',
]

nodes_json = []
for node in G.nodes():
    meta = festival_meta.get(node, {})
    comm_id = partition[node]
    nodes_json.append({
        'id': node,
        'event_type': meta.get('event_type', 'unknown'),
        'film_count': meta.get('film_count', 0),
        'total_screenings': meta.get('total_screenings', 0),
        'first_year': meta.get('first_year'),
        'last_year': meta.get('last_year'),
        'countries_represented': meta.get('countries_represented', 0),
        'genres': meta.get('genres', ''),
        'degree_centrality': round(degree_cent[node], 4),
        'betweenness_centrality': round(betweenness[node], 4),
        'eigenvector_centrality': round(eigenvector[node], 4),
        'closeness_centrality': round(closeness[node], 4),
        'clustering_coefficient': round(clustering[node], 4),
        'weighted_degree': strength[node],
        'community': comm_id,
        'colour': COMMUNITY_COLOURS[comm_id % len(COMMUNITY_COLOURS)],
    })

edges_json = []
for fa, fb, data in G.edges(data=True):
    edges_json.append({
        'source': fa,
        'target': fb,
        'weight': data['weight'],
    })

graph_data = {
    'nodes': nodes_json,
    'edges': edges_json,
    'metadata': {
        'total_nodes': G.number_of_nodes(),
        'total_edges': G.number_of_edges(),
        'density': round(density, 4),
        'avg_clustering': round(avg_clustering, 4),
        'n_components': len(components),
        'largest_component_size': len(largest_cc),
        'avg_path_length': round(avg_path_len, 2),
        'n_communities': n_communities,
        'community_colours': COMMUNITY_COLOURS[:n_communities],
    },
    'temporal': [
        {
            'year': int(year),
            'edge_count': int(ec),
            'total_shared_films': int(ts),
            'approx_active_nodes': int(an),
        }
        for year, ec, ts, an in temporal_stats
    ],
}

json_path = os.path.join(VIZ_DIR, 'network_data.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(graph_data, f, indent=2, ensure_ascii=False)
print(f"  Saved: {json_path}")
print(f"  {len(nodes_json)} nodes, {len(edges_json)} edges")

# ---------------------------------------------------------------------------
# 5. Generate insights report
# ---------------------------------------------------------------------------
print("\nGenerating insights report...")

lines = []
def section(title):
    lines.append('')
    lines.append('=' * 70)
    lines.append(title)
    lines.append('=' * 70)

lines.append('NETWORK EFFECTS - FESTIVAL NETWORK ANALYSIS REPORT')
lines.append(f'Following Loist & Samoilova (2023) methodology')
lines.append('')

section('1. NETWORK OVERVIEW')
lines.append(f'  Festivals (nodes): {G.number_of_nodes()}')
lines.append(f'  Connections (edges): {G.number_of_edges()} (pairs with 2+ shared films)')
lines.append(f'  Network density: {density:.4f}')
lines.append(f'  Average clustering coefficient: {avg_clustering:.4f}')
lines.append(f'  Connected components: {len(components)}')
lines.append(f'  Largest component: {len(largest_cc)} nodes ({len(largest_cc)*100//G.number_of_nodes()}%)')
lines.append(f'  Average shortest path (largest component): {avg_path_len:.2f}')
lines.append('')
lines.append('  Interpretation:')
lines.append(f'    - Density {density:.4f} indicates a {"dense" if density > 0.3 else "moderately connected" if density > 0.1 else "sparse"} network.')
lines.append(f'    - High clustering ({avg_clustering:.2f}) suggests festivals form tightly-knit groups.')
lines.append(f'    - Short average path ({avg_path_len:.1f}) means most festivals are reachable in few steps.')
if len(components) == 1:
    lines.append('    - The network is fully connected: every festival is reachable from every other.')
else:
    isolated = [c for c in components if len(c) <= 2]
    lines.append(f'    - {len(isolated)} isolated/peripheral components exist outside the main network.')

section('2. MOST CENTRAL FESTIVALS (Hub Identification)')

lines.append('')
lines.append('  By DEGREE CENTRALITY (number of connections):')
top_degree = sorted(degree_cent.items(), key=lambda x: x[1], reverse=True)[:15]
for i, (name, val) in enumerate(top_degree, 1):
    meta = festival_meta.get(name, {})
    lines.append(f'    {i:2d}. {name}')
    lines.append(f'        DC={val:.3f}  BC={betweenness[name]:.3f}  EC={eigenvector[name]:.3f}  Films={meta.get("film_count",0)}  Community={partition[name]}')

lines.append('')
lines.append('  By BETWEENNESS CENTRALITY (bridge/gatekeeper role):')
top_between = sorted(betweenness.items(), key=lambda x: x[1], reverse=True)[:10]
for i, (name, val) in enumerate(top_between, 1):
    lines.append(f'    {i:2d}. {name} (BC={val:.4f})')

lines.append('')
lines.append('  By EIGENVECTOR CENTRALITY (influence through well-connected neighbours):')
top_eigen = sorted(eigenvector.items(), key=lambda x: x[1], reverse=True)[:10]
for i, (name, val) in enumerate(top_eigen, 1):
    lines.append(f'    {i:2d}. {name} (EC={val:.4f})')

section('3. COMMUNITY STRUCTURE (Sub-circuits)')

lines.append(f'  {n_communities} communities detected using Louvain method.')
lines.append(f'  Modularity score: {community_louvain.modularity(partition, G, weight="weight"):.4f}')
lines.append('')

for comm_id in sorted(community_profiles.keys()):
    prof = community_profiles[comm_id]
    lines.append(f'  COMMUNITY {comm_id} ({prof["size"]} festivals):')
    lines.append(f'    Type breakdown: {prof["event_types"]}')
    lines.append(f'    Key members:')
    for m in prof['top_members']:
        meta = festival_meta.get(m, {})
        lines.append(f'      - {m} ({meta.get("film_count",0)} films, {meta.get("countries_represented",0)} countries)')
    lines.append('')

section('4. TEMPORAL DYNAMICS')
lines.append('')
lines.append('  Network growth by year:')
for year, ec, ts, an in temporal_stats:
    bar = '#' * (int(ec) // 5)
    lines.append(f'    {year}: {int(ec):4d} edges, {int(ts):4d} shared films, ~{int(an):3d} active festivals {bar}')

lines.append('')
lines.append('  Interpretation:')
peak_year = max(temporal_stats, key=lambda x: x[1])
lines.append(f'    - Peak connectivity in {peak_year[0]}: {peak_year[1]} edges')
lines.append(f'    - Network has {"grown" if temporal_stats[-1][1] > temporal_stats[0][1] else "fluctuated"} over time.')

section('5. PERIPHERAL FESTIVALS')
lines.append('')
lines.append('  Festivals with lowest connectivity (degree centrality < 0.02):')
peripheral = sorted(degree_cent.items(), key=lambda x: x[1])
low_dc = [(n, v) for n, v in peripheral if v < 0.02]
for name, val in low_dc[:15]:
    meta = festival_meta.get(name, {})
    lines.append(f'    - {name} (DC={val:.4f}, {meta.get("film_count",0)} films)')
lines.append(f'    ... {len(low_dc)} peripheral festivals total')

section('6. KEY FINDINGS')
lines.append('')

# Find if Encounters is the top hub
enc_rank = next((i for i, (n, _) in enumerate(top_degree, 1) if 'Encounters' in n), None)
lines.append(f'  1. ENCOUNTERS AS HUB: Ranked #{enc_rank} by degree centrality.')
lines.append(f'     As the anchor festival (all 754 films), it connects to virtually every')
lines.append(f'     other festival in the network, making it the primary hub.')

# European vs North American pattern
lines.append('')
lines.append('  2. SUB-CIRCUIT PATTERNS:')
for comm_id, prof in sorted(community_profiles.items()):
    top3 = ', '.join(prof['top_members'][:3])
    lines.append(f'     Community {comm_id}: {top3}')

lines.append('')
lines.append('  3. GATEKEEPERS: Festivals with high betweenness but moderate degree')
lines.append('     act as bridges between sub-circuits:')
# Find gatekeepers: high betweenness relative to degree
for name, bc in sorted(betweenness.items(), key=lambda x: x[1], reverse=True)[:5]:
    dc = degree_cent[name]
    ratio = bc / dc if dc > 0 else 0
    lines.append(f'     - {name} (BC/DC ratio: {ratio:.2f})')

lines.append('')
lines.append('=' * 70)
lines.append('END OF REPORT')
lines.append('=' * 70)

report_text = '\n'.join(lines)
report_path = os.path.join(REPORTS_DIR, 'network_analysis_report.txt')
with open(report_path, 'w', encoding='utf-8') as f:
    f.write(report_text)
print(f"  Saved: {report_path}")

print(report_text)
print("\nAnalysis complete.")
