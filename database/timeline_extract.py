"""
Network Effects: Film Circulation Timeline Data Extraction

Queries vw_film_circulation_timeline, computes aggregate statistics,
and exports JSON for the timeline visualisation plus a text report.

Usage:
    python database/timeline_extract.py
"""

import os
import sys
import io
import json
from datetime import datetime
from collections import Counter, defaultdict

import psycopg2
import psycopg2.extras
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
# 1. Fetch data
# ---------------------------------------------------------------------------
print("Fetching film circulation timeline data...")
conn = get_conn()
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
cur.execute("SELECT * FROM vw_film_circulation_timeline")
rows = cur.fetchall()
cur.close()
conn.close()
print(f"  Fetched {len(rows)} films")

# ---------------------------------------------------------------------------
# 2. Process films
# ---------------------------------------------------------------------------
print("Processing films...")

ENCOUNTERS_NAMES = {
    'Encounters Short Film and Animation Festival',
    'Encounters Film Festival',
    'Encounters',
    'Brief Encounters',
}

films = []
for row in rows:
    timeline = row['screening_timeline']
    # psycopg2 auto-deserialises JSON; handle string fallback
    if isinstance(timeline, str):
        timeline = json.loads(timeline)

    # Computed fields
    country_codes = row['country_codes'] or ''
    is_uk = 'GB' in [c.strip() for c in country_codes.split(',')]
    has_awards = (row['awards_won'] or 0) > 0

    # Check if first screening is at Encounters
    premiered_at_encounters = False
    if timeline:
        first_year = timeline[0]['event_year']
        first_events = [e for e in timeline if e['event_year'] == first_year]
        premiered_at_encounters = any(
            e['festival'] in ENCOUNTERS_NAMES or 'encounters' in e['festival'].lower()
            for e in first_events
        )

    film = {
        'film_id': str(row['film_id']),
        'title': row['title'],
        'original_title': row['original_title'],
        'production_year': row['production_year'],
        'duration': row['duration'],
        'directors': row['directors'],
        'countries': row['countries'],
        'country_codes': row['country_codes'],
        'genres': row['genres'],
        'total_festivals': row['total_festivals'],
        'total_screenings': row['total_screenings'],
        'awards_won': row['awards_won'] or 0,
        'nominations': row['nominations'] or 0,
        'mentions': row['mentions'] or 0,
        'first_screening_year': row['first_screening_year'],
        'last_screening_year': row['last_screening_year'],
        'circulation_span_years': row['circulation_span_years'] or 0,
        'screening_timeline': timeline,
        'has_awards': has_awards,
        'is_uk': is_uk,
        'premiered_at_encounters': premiered_at_encounters,
    }
    films.append(film)

print(f"  Processed {len(films)} films")

# ---------------------------------------------------------------------------
# 3. Compute aggregate statistics
# ---------------------------------------------------------------------------
print("Computing aggregate statistics...")

spans = [f['circulation_span_years'] for f in films]
festival_counts = [f['total_festivals'] for f in films]
screening_counts = [f['total_screenings'] for f in films]

def median(values):
    s = sorted(values)
    n = len(s)
    if n == 0:
        return 0
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2

def mean(values):
    return sum(values) / len(values) if values else 0

# Span distribution
span_dist = Counter(spans)
span_distribution = {str(k): v for k, v in sorted(span_dist.items())}

# Year distribution (number of screenings per year)
year_screening_counts = Counter()
for f in films:
    for e in f['screening_timeline']:
        year_screening_counts[e['event_year']] += 1
year_distribution = {str(k): v for k, v in sorted(year_screening_counts.items())}

# Production year distribution
prod_year_counts = Counter(f['production_year'] for f in films if f['production_year'])
production_year_distribution = {str(k): v for k, v in sorted(prod_year_counts.items())}

# Award analysis
awarded_films = [f for f in films if f['has_awards']]
non_awarded_films = [f for f in films if not f['has_awards']]

avg_span_awarded = mean([f['circulation_span_years'] for f in awarded_films]) if awarded_films else 0
avg_span_non_awarded = mean([f['circulation_span_years'] for f in non_awarded_films]) if non_awarded_films else 0
avg_festivals_awarded = mean([f['total_festivals'] for f in awarded_films]) if awarded_films else 0
avg_festivals_non_awarded = mean([f['total_festivals'] for f in non_awarded_films]) if non_awarded_films else 0

# Encounters premiere analysis
encounters_premiere_films = [f for f in films if f['premiered_at_encounters']]
encounters_premiere_count = len(encounters_premiere_films)

# UK film stats
uk_films = [f for f in films if f['is_uk']]

# First festival analysis
first_festivals = Counter()
for f in films:
    if f['screening_timeline']:
        first_year = f['screening_timeline'][0]['event_year']
        first_events = [e for e in f['screening_timeline'] if e['event_year'] == first_year]
        for e in first_events:
            first_festivals[e['festival']] += 1

# Year range
all_years = [e['event_year'] for f in films for e in f['screening_timeline'] if e['event_year']]
year_min = min(all_years) if all_years else 0
year_max = max(all_years) if all_years else 0

# Heatmap data: production_year × screening_year
heatmap = defaultdict(lambda: defaultdict(int))
for f in films:
    py = f['production_year']
    if py:
        for e in f['screening_timeline']:
            sy = e['event_year']
            if sy:
                heatmap[py][sy] += 1

heatmap_data = []
for py in sorted(heatmap.keys()):
    for sy in sorted(heatmap[py].keys()):
        heatmap_data.append({
            'production_year': py,
            'screening_year': sy,
            'count': heatmap[py][sy]
        })

# Genre breakdown
genre_stats = defaultdict(lambda: {'count': 0, 'total_festivals': 0, 'total_span': 0})
for f in films:
    if f['genres']:
        for g in f['genres'].split(', '):
            genre_stats[g]['count'] += 1
            genre_stats[g]['total_festivals'] += f['total_festivals']
            genre_stats[g]['total_span'] += f['circulation_span_years']

genre_summary = {}
for g, s in sorted(genre_stats.items()):
    genre_summary[g] = {
        'count': s['count'],
        'avg_festivals': round(s['total_festivals'] / s['count'], 2),
        'avg_span': round(s['total_span'] / s['count'], 2),
    }

# Country breakdown
country_stats = defaultdict(lambda: {'count': 0, 'total_festivals': 0})
for f in films:
    if f['country_codes']:
        for cc in f['country_codes'].split(', '):
            country_stats[cc]['count'] += 1
            country_stats[cc]['total_festivals'] += f['total_festivals']

aggregate = {
    'avg_circulation_span': round(mean(spans), 2),
    'median_circulation_span': median(spans),
    'avg_festivals': round(mean(festival_counts), 2),
    'median_festivals': median(festival_counts),
    'avg_screenings': round(mean(screening_counts), 2),
    'pct_with_awards': round(len(awarded_films) / len(films) * 100, 1),
    'span_distribution': span_distribution,
    'year_distribution': year_distribution,
    'production_year_distribution': production_year_distribution,
    'encounters_premiere_count': encounters_premiere_count,
    'encounters_premiere_pct': round(encounters_premiere_count / len(films) * 100, 1),
    'avg_span_with_awards': round(avg_span_awarded, 2),
    'avg_span_without_awards': round(avg_span_non_awarded, 2),
    'avg_festivals_with_awards': round(avg_festivals_awarded, 2),
    'avg_festivals_without_awards': round(avg_festivals_non_awarded, 2),
    'uk_films_count': len(uk_films),
    'uk_films_avg_festivals': round(mean([f['total_festivals'] for f in uk_films]), 2) if uk_films else 0,
    'uk_films_avg_span': round(mean([f['circulation_span_years'] for f in uk_films]), 2) if uk_films else 0,
    'top_first_festivals': [{'festival': f, 'count': c} for f, c in first_festivals.most_common(20)],
    'genre_summary': genre_summary,
    'heatmap_data': heatmap_data,
}

metadata = {
    'total_films': len(films),
    'year_range': [year_min, year_max],
    'extracted_at': datetime.now().isoformat(),
    'source_view': 'vw_film_circulation_timeline',
    'note': 'Only event_year available (no month/day). All 754 films screened at Encounters.',
}

# ---------------------------------------------------------------------------
# 4. Export JSON
# ---------------------------------------------------------------------------
output = {
    'metadata': metadata,
    'aggregate': aggregate,
    'films': films,
}

json_path = os.path.join(VIZ_DIR, 'timeline_data.json')
with open(json_path, 'w', encoding='utf-8') as fh:
    json.dump(output, fh, ensure_ascii=False, indent=None, separators=(',', ':'))

file_size = os.path.getsize(json_path) / 1024
print(f"  Exported {json_path} ({file_size:.0f} KB)")

# ---------------------------------------------------------------------------
# 5. Generate report
# ---------------------------------------------------------------------------
print("Generating circulation patterns report...")

lines = []
w = lines.append

w("NETWORK EFFECTS - FILM CIRCULATION PATTERNS REPORT")
w("Companion analysis to the festival network graph")
w("")

# Section 1: Circulation Duration
w("=" * 70)
w("1. CIRCULATION DURATION")
w("=" * 70)
w(f"  Total films analysed: {len(films)}")
w(f"  Average circulation span: {mean(spans):.2f} years")
w(f"  Median circulation span: {median(spans)} years")
w(f"  Average festivals per film: {mean(festival_counts):.1f}")
w(f"  Median festivals per film: {median(festival_counts)}")
w(f"  Average screenings per film: {mean(screening_counts):.1f}")
w("")
w("  Span distribution (years -> number of films):")
max_bar = 50
max_count = max(span_dist.values()) if span_dist else 1
for span_val in sorted(span_dist.keys()):
    count = span_dist[span_val]
    bar_len = int(count / max_count * max_bar)
    w(f"    {span_val:>2}y: {'█' * bar_len} {count}")
w("")
w("  Interpretation:")
w(f"    - Most films ({span_dist.get(0, 0)}) circulate within a single year.")
single_year_pct = span_dist.get(0, 0) / len(films) * 100 if films else 0
multi_year = len(films) - span_dist.get(0, 0)
w(f"    - {single_year_pct:.0f}% have a span of 0 (all screenings in the same year).")
w(f"    - {multi_year} films ({100 - single_year_pct:.0f}%) span multiple years.")
long_circuit = len([f for f in films if f['circulation_span_years'] >= 3])
w(f"    - {long_circuit} films have 3+ year circulation spans.")
w("")

# Section 2: Award Effect
w("=" * 70)
w("2. AWARD EFFECT ON CIRCULATION")
w("=" * 70)
w(f"  Films with at least one award: {len(awarded_films)} ({aggregate['pct_with_awards']}%)")
w(f"  Films without awards: {len(non_awarded_films)}")
w("")
w("  Comparison:")
w(f"    {'Metric':<30} {'Awarded':>12} {'Non-awarded':>12}")
w(f"    {'-'*30} {'-'*12} {'-'*12}")
w(f"    {'Avg circulation span (years)':<30} {avg_span_awarded:>12.2f} {avg_span_non_awarded:>12.2f}")
w(f"    {'Avg festival count':<30} {avg_festivals_awarded:>12.1f} {avg_festivals_non_awarded:>12.1f}")
awarded_med_span = median([f['circulation_span_years'] for f in awarded_films]) if awarded_films else 0
non_awarded_med_span = median([f['circulation_span_years'] for f in non_awarded_films]) if non_awarded_films else 0
w(f"    {'Median circulation span':<30} {awarded_med_span:>12} {non_awarded_med_span:>12}")
awarded_med_fest = median([f['total_festivals'] for f in awarded_films]) if awarded_films else 0
non_awarded_med_fest = median([f['total_festivals'] for f in non_awarded_films]) if non_awarded_films else 0
w(f"    {'Median festival count':<30} {awarded_med_fest:>12} {non_awarded_med_fest:>12}")
w("")
if avg_festivals_awarded > avg_festivals_non_awarded:
    ratio = avg_festivals_awarded / avg_festivals_non_awarded if avg_festivals_non_awarded else 0
    w(f"  Interpretation:")
    w(f"    - Award-winning films visit {ratio:.1f}x more festivals on average.")
    w(f"    - Awards extend circulation by ~{avg_span_awarded - avg_span_non_awarded:.1f} years on average.")
w("")

# Section 3: Outliers - Most Traveled Films
w("=" * 70)
w("3. MOST TRAVELED FILMS (20+ festivals)")
w("=" * 70)
outliers = [f for f in films if f['total_festivals'] >= 20]
outliers.sort(key=lambda x: x['total_festivals'], reverse=True)
w(f"  {len(outliers)} films screened at 20 or more festivals:")
w("")
for i, f in enumerate(outliers, 1):
    awards_str = f" [★ {f['awards_won']} wins]" if f['has_awards'] else ""
    w(f"  {i:>3}. {f['title']}")
    w(f"       Director(s): {f['directors'] or 'Unknown'}")
    w(f"       {f['total_festivals']} festivals, {f['total_screenings']} screenings, "
      f"span {f['circulation_span_years']}y ({f['first_screening_year']}-{f['last_screening_year']})"
      f"{awards_str}")
w("")

# Section 4: Yearly Patterns
w("=" * 70)
w("4. YEARLY PATTERNS")
w("=" * 70)
w("")
w("  Screenings per year:")
max_yearly = max(year_screening_counts.values()) if year_screening_counts else 1
for year in sorted(year_screening_counts.keys()):
    count = year_screening_counts[year]
    bar_len = int(count / max_yearly * max_bar)
    w(f"    {year}: {'█' * bar_len} {count}")
w("")

# Cohort analysis: by production year, how many festivals on average?
w("  Cohort analysis (by production year, avg festivals per film):")
cohort_data = defaultdict(list)
for f in films:
    if f['production_year']:
        cohort_data[f['production_year']].append(f['total_festivals'])
for py in sorted(cohort_data.keys()):
    avg = mean(cohort_data[py])
    count = len(cohort_data[py])
    if count >= 3:  # Only show years with enough data
        bar_len = int(avg / 20 * max_bar)  # Scale to max ~20
        w(f"    {py}: {'█' * bar_len} {avg:.1f} avg ({count} films)")
w("")

# Section 5: UK Films / Encounters as Launchpad
w("=" * 70)
w("5. UK FILMS & ENCOUNTERS AS LAUNCHPAD")
w("=" * 70)
w(f"  UK films (country_code contains GB): {len(uk_films)}")
w(f"  UK films avg festivals: {aggregate['uk_films_avg_festivals']}")
w(f"  UK films avg span: {aggregate['uk_films_avg_span']} years")
w(f"  Overall avg festivals: {aggregate['avg_festivals']}")
w(f"  Overall avg span: {aggregate['avg_circulation_span']} years")
w("")
w(f"  Films premiering at Encounters (first screening year): {encounters_premiere_count} ({aggregate['encounters_premiere_pct']}%)")
if encounters_premiere_films:
    enc_avg_fest = mean([f['total_festivals'] for f in encounters_premiere_films])
    enc_avg_span = mean([f['circulation_span_years'] for f in encounters_premiere_films])
    non_enc = [f for f in films if not f['premiered_at_encounters']]
    non_enc_avg_fest = mean([f['total_festivals'] for f in non_enc]) if non_enc else 0
    non_enc_avg_span = mean([f['circulation_span_years'] for f in non_enc]) if non_enc else 0
    w(f"  Encounters-premiere avg festivals: {enc_avg_fest:.1f}")
    w(f"  Encounters-premiere avg span: {enc_avg_span:.2f} years")
    w(f"  Non-Encounters-premiere avg festivals: {non_enc_avg_fest:.1f}")
    w(f"  Non-Encounters-premiere avg span: {non_enc_avg_span:.2f} years")
w("")
w("  Top 20 first festivals (most common first screening venue):")
for fest, count in first_festivals.most_common(20):
    w(f"    {count:>4}x  {fest}")
w("")
w("  Note: All 754 films screen at Encounters by definition (it is the anchor")
w("  festival for this dataset). 'Premiered at Encounters' means Encounters was")
w("  among the earliest screening venues (same year as first screening).")
w("")

w("=" * 70)
w("END OF REPORT")
w("=" * 70)

report_path = os.path.join(REPORTS_DIR, 'circulation_patterns.txt')
with open(report_path, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(lines))

print(f"  Exported {report_path}")
print("Done.")
