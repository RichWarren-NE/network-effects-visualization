# Negative Data Integration Plan

## Network Effects: Incorporating Submission and Rejection Data

### 1. Why Negative Data Matters

Current analysis only captures successful outcomes — films that were programmed at festivals. This creates a survivorship bias: we see what *was* selected but not what was considered. Negative data (submissions that didn't result in selection) transforms the analysis:

**From circulation patterns to selection dynamics:**
- **Acceptance rates** reveal festival selectivity and gatekeeping intensity
- **Rejection patterns** show which genres, countries, and film types face barriers
- **Comprehensive filmmaker journeys** map the full submission-to-screening pipeline
- **Programming patterns** expose what festivals *don't* programme, not just what they do

**Research questions unlocked:**
1. Which festival tiers are most selective? Do A-list festivals reject more proportionally?
2. Are certain genres (e.g. experimental, documentary) systematically under-selected?
3. Do films from the Global South face higher rejection rates at European festivals?
4. How many submissions does the average film make before its first acceptance?
5. Is there a "rejection circuit" — festivals that disproportionately reject the same films?
6. Does rejection at a prestige festival predict acceptance at regional ones?

---

### 2. GDPR Compliance Approach

Rejection data is sensitive: it reveals unsuccessful attempts by identifiable filmmakers. The architecture implements GDPR Articles 5, 6, and 25.

#### Two-tier data model

| Table | Data Level | Access | GDPR Basis |
|---|---|---|---|
| `submissions` | Identifiable (links to films/filmmakers) | Restricted to researchers | Legitimate interest (Art. 6(1)(f)) with DPIA |
| `rejections_anonymised` | Anonymized (one-way hashed codes) | Public | Recital 26 exemption (no longer personal data) |

#### Anonymization protocol

1. **Film identification removed**: Film title + director → SHA-256 hash → `film_code`
2. **Metadata generalized**: Duration → range (e.g. "5-10min"); exact date → year only
3. **No reverse linkage**: `rejections_anonymised` has no foreign key to `films` table
4. **Aggregation threshold**: Published patterns require 5+ films (k-anonymity, k=5)

#### Data Protection Impact Assessment (DPIA) requirements

Before populating the `submissions` table:
- [ ] Complete DPIA with university data protection officer
- [ ] Establish lawful basis (likely legitimate interest for academic research)
- [ ] Create data processing agreement with festival partners
- [ ] Define retention period (recommend: duration of PhD + 3 years)
- [ ] Document access controls (who can query identifiable data)
- [ ] Prepare data subject rights procedures (access, rectification, erasure)

---

### 3. Aggregation Thresholds

To prevent re-identification through small-number inference:

| Output | Minimum Threshold | Rationale |
|---|---|---|
| Rejection patterns by genre + country | 5 films | k-anonymity prevents singling out |
| Festival acceptance rates | 10 total submissions | Rates meaningless below this |
| Year-over-year trends | 5 rejections per year-cell | Prevents temporal re-identification |
| Cross-tabulations (genre x country x year) | 5 per cell | Prevents intersection attacks |

The `vw_rejection_patterns` view enforces `HAVING COUNT(*) >= 5` at the database level.

**Cell suppression**: If any aggregation cell contains 1-4 records, it must be suppressed or merged with adjacent cells before publication.

---

### 4. Visualization Changes

When negative data becomes available, each dashboard tab gains new capabilities:

#### Network Graph
- **Edge color encoding**: Currently edges show shared-film weight only. With submission data:
  - Green edges: festivals that accept each other's rejected films (rescue pathways)
  - Red edges: festivals that reject the same films (convergent gatekeeping)
  - Edge opacity: ratio of shared submissions to shared acceptances
- **Node metrics**: Festival selectivity as a new node-sizing option (acceptance rate)
- **New filter**: Toggle between "circulation network" (current) and "selection network"

#### Timeline
- **Rejection markers**: Grey X marks before the first acceptance, showing the submission trail
- **Decision timeline**: Horizontal bars showing submission-to-decision duration
- **Comparison mode**: Side-by-side view of films with similar profiles but different outcomes
- **New sort option**: Sort by "attempts before first acceptance"

#### Geographic Map
- **Submission heat map**: Where films are submitted vs. where they're accepted
- **Rejection flow map**: Directional arcs showing submission flows that don't result in programming
- **Acceptance rate choropleth**: Country-level acceptance rates (films from country X → festival in country Y)
- **Regional bias detection**: Highlight country pairs with statistically unusual acceptance/rejection ratios

#### New Dashboard Tab: Selection Analysis
- Festival selectivity comparison (bar chart of acceptance rates)
- Genre-by-festival heatmap (acceptance rates per genre per festival)
- Submission funnel visualization (submitted → shortlisted → accepted → programmed)
- Filmmaker journey sankey diagram (festival A rejected → festival B accepted)

---

### 5. Data Collection Protocols for Festival Partners

#### What we request

| Field | Required | Format | Sensitivity |
|---|---|---|---|
| Film title | Yes | Free text | High (identifiable) |
| Submission date | Yes | YYYY-MM-DD | Low |
| Decision outcome | Yes | accepted/rejected/withdrawn | Medium |
| Decision date | Preferred | YYYY-MM-DD | Low |
| Competition section | Preferred | Category name | Low |
| Film duration | Preferred | Minutes | Low |
| Film genre | Preferred | Animation/fiction/documentary/experimental | Low |
| Production country | Preferred | ISO 3166-1 alpha-2 | Low |

#### What we do NOT request
- Filmmaker contact details (already in source data where needed)
- Programming committee notes or scoring
- Revenue or fee information
- Third-party distribution data

#### Data transfer protocol
1. Festival exports submission records as CSV (template provided)
2. Data transferred via encrypted channel (SFTP or password-protected upload)
3. Researcher maps films to existing database (by title + year matching)
4. Matched records → `submissions` table (identifiable, restricted)
5. Unmatched/anonymized records → `rejections_anonymised` table (public)
6. Original CSV deleted after import and verification

---

### 6. Anonymization Process

```
Step 1: Receive raw submission data
         film_title: "The Garden Wall"
         director: "Jane Smith"
         festival: "Encounters"
         outcome: "rejected"
         genre: "animation"
         duration: 7 min
         country: "GB"

Step 2: Generate one-way hash
         input = "The Garden Wall|Jane Smith|2024"
         film_code = SHA-256(input)[:12] = "a7f3c9e2b1d4"

Step 3: Generalize metadata
         duration: 7 → duration_range: "5-10min"
         submission_date: 2024-03-15 → submission_year: 2024

Step 4: Insert anonymized record
         INSERT INTO rejections_anonymised (
             film_code, festival_id, submission_year,
             film_metadata, decision_category
         ) VALUES (
             'a7f3c9e2b1d4',
             '<encounters_uuid>',
             2024,
             '{"genre": "animation", "duration_range": "5-10min",
               "production_country": "GB", "film_type": "animation"}',
             'International Competition'
         );

Step 5: Verify non-reversibility
         - No title or director stored
         - Hash cannot be reversed without original input
         - film_code not linked to films table
```

---

### 7. Example Queries

#### Acceptance rate by festival (requires submissions data)
```sql
SELECT festival_name, acceptance_rate_percent, total_submissions
FROM vw_acceptance_rates
WHERE total_submissions >= 10
ORDER BY acceptance_rate_percent ASC;
-- Expected: most selective festivals at top
```

#### Rejection patterns by genre (anonymized data only)
```sql
SELECT genre, production_country, SUM(rejection_count) as total_rejections
FROM vw_rejection_patterns
WHERE submission_year BETWEEN 2020 AND 2025
GROUP BY genre, production_country
ORDER BY total_rejections DESC;
-- Shows which genre + country combinations face most rejections
```

#### Festival selectivity comparison
```sql
SELECT
    ar.festival_name,
    ar.acceptance_rate_percent,
    fs.unique_film_count AS films_programmed,
    ar.total_submissions
FROM vw_acceptance_rates ar
JOIN vw_festival_statistics fs
    ON ar.festival_name = fs.festival_name
WHERE ar.total_submissions >= 10
ORDER BY ar.acceptance_rate_percent ASC;
-- Cross-references selectivity with programming volume
```

#### Filmmaker journey: submissions before first screening
```sql
SELECT
    fi.title,
    COUNT(CASE WHEN s.decision_status = 'rejected' THEN 1 END) AS rejections_before_first,
    MIN(CASE WHEN s.decision_status = 'accepted' THEN s.decision_date END) AS first_acceptance,
    COUNT(DISTINCT s.festival_id) AS total_submissions
FROM submissions s
JOIN films fi ON s.film_id = fi.film_id
GROUP BY fi.film_id, fi.title
HAVING COUNT(CASE WHEN s.decision_status = 'accepted' THEN 1 END) > 0
ORDER BY rejections_before_first DESC;
-- Shows how many rejections films endure before first acceptance
```

#### Genre bias detection (anonymized)
```sql
WITH genre_totals AS (
    SELECT
        film_metadata->>'genre' AS genre,
        festival_id,
        COUNT(*) AS rejection_count
    FROM rejections_anonymised
    WHERE submission_year >= 2020
    GROUP BY film_metadata->>'genre', festival_id
    HAVING COUNT(*) >= 5
)
SELECT
    f.festival_name,
    gt.genre,
    gt.rejection_count,
    ROUND(gt.rejection_count * 100.0 /
        SUM(gt.rejection_count) OVER (PARTITION BY gt.festival_id), 1)
        AS pct_of_festival_rejections
FROM genre_totals gt
JOIN festivals f ON gt.festival_id = f.festival_id
ORDER BY f.festival_name, gt.rejection_count DESC;
-- Reveals genre-level selection bias per festival
```

---

### 8. Implementation Timeline

| Phase | Status | Description |
|---|---|---|
| **Phase 1: Schema creation** | Complete | Tables, views, indexes, RLS policies |
| **Phase 2: Synthetic testing** | Complete | 100 test records validating architecture |
| **Phase 3: DPIA and ethics** | Pending | University data protection review |
| **Phase 4: Partner agreements** | Pending | Data sharing agreements with festivals |
| **Phase 5: Pilot import** | Pending | First festival partner data (Encounters) |
| **Phase 6: Visualization update** | Pending | Dashboard integration of negative data views |

---

### 9. Database Architecture Diagram

```
                 ┌─────────────────┐
                 │     films       │
                 │  (identifiable) │
                 └───────┬─────────┘
                         │ FK
          ┌──────────────┼──────────────┐
          │              │              │
    ┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼─────┐
    │screenings │  │submissions│  │film_dirs  │
    │(outcomes) │  │(lifecycle)│  │film_ctry  │
    │           │  │           │  │film_genre │
    └─────┬─────┘  └─────┬─────┘  └───────────┘
          │              │
          │ FK           │ FK
    ┌─────▼─────┐  ┌─────▼─────┐
    │ festivals │◄─┤           │
    │           │  │           │
    └─────┬─────┘  └───────────┘
          │ FK
    ┌─────▼──────────────┐
    │rejections_anonymised│   ← NO FK to films (by design)
    │  (GDPR compliant)  │
    └────────────────────┘

    Views:
    ├── vw_acceptance_rates      (submissions → festivals)
    ├── vw_rejection_patterns    (rejections_anonymised → festivals)
    └── vw_submission_journey    (submissions → films → screenings)
```
