"""
Network Effects: Static Print-Ready Network Graph

Generates an A4 landscape, 300 DPI static graph showing the
2020-2025 cumulative network. Optimised for academic publication.
"""

import os, sys, io, json
from collections import defaultdict

import networkx as nx
import community as community_louvain
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.lines import Line2D
import numpy as np

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

BASE_DIR = os.path.join(os.path.dirname(__file__), '..')
VIZ_DIR = os.path.join(BASE_DIR, 'viz')

# Load the enhanced data
with open(os.path.join(VIZ_DIR, 'network_data_enhanced.json'), 'r', encoding='utf-8') as f:
    data = json.load(f)

allNodes = {n['id']: n for n in data['nodes']}
snapshots = data['year_snapshots']

# =====================================================================
# Build the 2020-2025 cumulative graph
# =====================================================================
print("Building 2020-2025 cumulative network...")

# Use 2025 snapshot (which is cumulative 2015-2025) but we want 2020-2025
# Rebuild from year-sliced data by summing 2020-2025
# Actually the snapshots are cumulative from 2015, so let's just filter
# films that screened 2020+ by rebuilding from scratch

# Load edge data from the full dataset and the year snapshots
# Use snapshot for 2025 minus snapshot for 2019 approach
# Simpler: just use the 2025 cumulative and filter to nodes active 2020+

snap = snapshots['2025']
all_edges = snap['edges']

# Filter: only include edges with weight >= 2 (already guaranteed)
# and only festivals active in 2020+
active_2020 = set()
for yr in range(2020, 2026):
    yr_snap = snapshots.get(str(yr), {})
    active_2020.update(yr_snap.get('active_nodes', []))

# Build graph with only 2020+ active festivals
G = nx.Graph()
for e in all_edges:
    if e['source'] in active_2020 and e['target'] in active_2020:
        if e['weight'] >= 3:  # Slightly higher threshold for print clarity
            G.add_edge(e['source'], e['target'], weight=e['weight'])

# Remove isolates
isolates = list(nx.isolates(G))
G.remove_nodes_from(isolates)

print(f"  Nodes: {G.number_of_nodes()}, Edges: {G.number_of_edges()}")

# =====================================================================
# Metrics for this subgraph
# =====================================================================
degree_cent = nx.degree_centrality(G)
betweenness = nx.betweenness_centrality(G, weight='weight')
partition = community_louvain.best_partition(G, weight='weight', resolution=1.0)

# =====================================================================
# Layout
# =====================================================================
print("Computing layout...")
pos = nx.spring_layout(
    G, k=4.5/np.sqrt(G.number_of_nodes()),
    iterations=300, weight='weight', seed=42
)

# Radially spread ALL nodes outward from centre to reduce congestion
centre = np.array([np.mean([p[0] for p in pos.values()]),
                   np.mean([p[1] for p in pos.values()])])
for n in pos:
    vec = np.array(pos[n]) - centre
    dist = np.linalg.norm(vec)
    if dist > 0.001:
        dc = degree_cent.get(n, 0)
        # Higher centrality = less push; lower centrality = more push
        push = 1.0 + (1.0 - min(dc * 3, 1.0)) * 2.5
        pos[n] = tuple(centre + vec * push)

# =====================================================================
# Styling
# =====================================================================
GENRE_COLOURS = {
    'animation':   '#00b4d8',
    'documentary': '#e9c46a',
    'fiction':      '#e76f51',
    'lgbtq':       '#c77dff',
    'horror':      '#ff4444',
    'mixed':       '#8899aa',
}

TIER_MARKERS = {
    'a-list':    'D',   # diamond
    'regional':  'o',   # circle
    'specialist': 's',  # square
    'emerging':  'o',   # circle (smaller)
}

# =====================================================================
# Draw
# =====================================================================
print("Rendering static figure...")

# A4 landscape: 297mm x 210mm = 11.69" x 8.27"
fig, ax = plt.subplots(figsize=(11.69, 8.27))
fig.patch.set_facecolor('#0a0e17')
ax.set_facecolor('#0a0e17')
ax.axis('off')

# Title
fig.text(0.03, 0.96, 'Network Effects: Festival Circulation Network (2020–2025)',
         fontsize=13, fontweight='bold', color='#e2e8f0',
         fontfamily='sans-serif')
fig.text(0.03, 0.93, 'Festivals connected by shared short films (minimum 3 shared films)',
         fontsize=8, color='#6b7a8d', fontfamily='sans-serif')

# Draw edges
edge_weights = [G[u][v]['weight'] for u, v in G.edges()]
max_w = max(edge_weights) if edge_weights else 1

for (u, v, d) in G.edges(data=True):
    w = d['weight']
    alpha = min(0.4, 0.03 + (w / max_w) * 0.35)
    width = 0.2 + (w / max_w) * 2.5
    ax.plot(
        [pos[u][0], pos[v][0]],
        [pos[u][1], pos[v][1]],
        color='#1e3a5f', alpha=alpha, linewidth=width,
        solid_capstyle='round', zorder=1
    )

# Draw nodes by tier (so a-list draws on top)
for tier_order in ['emerging', 'regional', 'specialist', 'a-list']:
    tier_nodes = [n for n in G.nodes() if allNodes.get(n, {}).get('tier') == tier_order]
    if not tier_nodes:
        continue

    xs = [pos[n][0] for n in tier_nodes]
    ys = [pos[n][1] for n in tier_nodes]
    colours = [GENRE_COLOURS.get(allNodes.get(n, {}).get('genre_circuit', 'mixed'), '#8899aa') for n in tier_nodes]
    sizes = [max(15, degree_cent.get(n, 0) * 800) for n in tier_nodes]
    marker = TIER_MARKERS.get(tier_order, 'o')

    ax.scatter(xs, ys, c=colours, s=sizes, marker=marker,
               edgecolors='#1a2236', linewidths=0.4, zorder=3 if tier_order == 'a-list' else 2,
               alpha=0.5 if tier_order == 'emerging' else 0.9)

# Labels — top 15 only, with leader lines for offset labels
label_nodes = sorted(G.nodes(), key=lambda n: degree_cent.get(n, 0), reverse=True)[:15]

# Short name mapping
def short_name(n):
    name = n
    for suffix in [' Short Film and Animation Festival',
                   ' International Animation Festival',
                   ' International Short Film Festival',
                   ' International Film Festival', ' Film Festival',
                   ' International Festival', ' Festival', ' International',
                   ' International Documentary and Short Film Festival']:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
            break
    # Further shorten common prefixes
    name = name.replace('International ', 'Intl. ')
    if len(name) > 26:
        name = name[:24] + '...'
    return name

# Precompute angular slots around centre for labels
# Assign each label a radial direction to avoid overlaps
angles_used = []

for i, n in enumerate(label_nodes):
    name = short_name(n)
    x, y = pos[n]
    r = max(15, degree_cent[n] * 800)

    # Direction: away from graph centre
    dx = x - centre[0]
    dy = y - centre[1]
    angle = np.arctan2(dy, dx)

    # Nudge angle if too close to a used one
    for existing_angle in angles_used:
        if abs(angle - existing_angle) < 0.25:
            angle += 0.3
    angles_used.append(angle)

    # Offset distance scales with centrality (more central = bigger offset to escape core)
    base_offset = 22 + degree_cent[n] * 80
    ox = np.cos(angle) * base_offset
    oy = np.sin(angle) * base_offset

    fs = 6.0 if i < 5 else 5.0
    fw = 'bold' if i < 3 else 'normal'

    ax.annotate(name, (x, y),
                xytext=(ox, oy),
                textcoords='offset points',
                fontsize=fs, color='#b0c8e0' if i < 5 else '#7a98b4',
                fontfamily='sans-serif', fontweight=fw,
                ha='center', va='center',
                arrowprops=dict(arrowstyle='-', color='#2a4060',
                                linewidth=0.4, shrinkA=3, shrinkB=1),
                zorder=5)

# =====================================================================
# Legends
# =====================================================================
# Genre circuit legend
genre_handles = [
    Line2D([0],[0], marker='o', color='w', markerfacecolor=c, markersize=6, linestyle='None', label=k.capitalize())
    for k, c in GENRE_COLOURS.items()
    if any(allNodes.get(n,{}).get('genre_circuit')==k for n in G.nodes())
]
leg1 = ax.legend(handles=genre_handles, title='Genre Circuit',
                  loc='lower left', fontsize=6, title_fontsize=7,
                  frameon=True, facecolor='#0f1520', edgecolor='#1a2236',
                  labelcolor='#90a8c0')
leg1.get_title().set_color('#6b7a8d')
ax.add_artist(leg1)

# Tier legend
tier_handles = [
    Line2D([0],[0], marker='D', color='w', markerfacecolor='#999', markersize=5, linestyle='None', label='A-List'),
    Line2D([0],[0], marker='o', color='w', markerfacecolor='#999', markersize=5, linestyle='None', label='Regional'),
    Line2D([0],[0], marker='s', color='w', markerfacecolor='#999', markersize=5, linestyle='None', label='Specialist'),
]
leg2 = ax.legend(handles=tier_handles, title='Festival Tier',
                  loc='lower right', fontsize=6, title_fontsize=7,
                  frameon=True, facecolor='#0f1520', edgecolor='#1a2236',
                  labelcolor='#90a8c0')
leg2.get_title().set_color('#6b7a8d')
ax.add_artist(leg1)  # re-add first legend

# Stats text
n_communities = max(partition.values()) + 1 if partition else 0
stats_text = (
    f"Nodes: {G.number_of_nodes()}  |  "
    f"Edges: {G.number_of_edges()}  |  "
    f"Communities: {n_communities}  |  "
    f"Density: {nx.density(G):.3f}"
)
fig.text(0.97, 0.93, stats_text, fontsize=7, color='#4a6a8a',
         fontfamily='sans-serif', ha='right')

# Source
fig.text(0.97, 0.02, 'Data: Encounters Film Festival / Miralot  |  Network Effects Project 2026',
         fontsize=6, color='#3a4a5e', fontfamily='sans-serif', ha='right')

plt.tight_layout(pad=1.5)

# =====================================================================
# Save outputs
# =====================================================================
# 300 DPI PNG
png_path = os.path.join(VIZ_DIR, 'network_print_2020_2025.png')
fig.savefig(png_path, dpi=300, facecolor=fig.get_facecolor(),
            bbox_inches='tight', pad_inches=0.3)
print(f"  PNG saved: {png_path} ({os.path.getsize(png_path)/1024/1024:.1f} MB)")

# PDF for print
pdf_path = os.path.join(VIZ_DIR, 'network_print_2020_2025.pdf')
fig.savefig(pdf_path, dpi=300, facecolor=fig.get_facecolor(),
            bbox_inches='tight', pad_inches=0.3)
print(f"  PDF saved: {pdf_path} ({os.path.getsize(pdf_path)/1024/1024:.1f} MB)")

# SVG for editing
svg_path = os.path.join(VIZ_DIR, 'network_print_2020_2025.svg')
fig.savefig(svg_path, facecolor=fig.get_facecolor(),
            bbox_inches='tight', pad_inches=0.3)
print(f"  SVG saved: {svg_path} ({os.path.getsize(svg_path)/1024/1024:.1f} MB)")

plt.close()
print("\nStatic print versions complete.")
