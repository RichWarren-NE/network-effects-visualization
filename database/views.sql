-- ============================================================================
-- Network Effects: SQL Views for Visualisations
-- ============================================================================

-- ============================================================================
-- 1. vw_network_edges
--    Festival pairs connected by shared films (for network graph)
--    Only pairs with 2+ shared films to reduce noise.
-- ============================================================================

DROP VIEW IF EXISTS vw_network_edges;

CREATE VIEW vw_network_edges AS
WITH festival_film_pairs AS (
    -- All (festival, film) combinations
    SELECT DISTINCT s.festival_id, s.film_id
    FROM screenings s
),
shared AS (
    -- Self-join: find films shared between two different festivals
    SELECT
        a.festival_id AS festival_a_id,
        b.festival_id AS festival_b_id,
        a.film_id
    FROM festival_film_pairs a
    JOIN festival_film_pairs b
        ON a.film_id = b.film_id
        AND a.festival_id < b.festival_id  -- avoid duplicates and self-pairs
)
SELECT
    fa.festival_name AS festival_a,
    fb.festival_name AS festival_b,
    fa.event_type    AS festival_a_type,
    fb.event_type    AS festival_b_type,
    COUNT(*)         AS shared_film_count,
    ARRAY_AGG(DISTINCT f.title ORDER BY f.title) AS shared_film_titles
FROM shared sh
JOIN festivals fa ON sh.festival_a_id = fa.festival_id
JOIN festivals fb ON sh.festival_b_id = fb.festival_id
JOIN films f      ON sh.film_id = f.film_id
GROUP BY fa.festival_name, fb.festival_name, fa.event_type, fb.event_type
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC;


-- ============================================================================
-- 2. vw_film_circulation_timeline
--    Each film with its full chronological screening history.
--    Includes circulation duration and total festival count.
-- ============================================================================

DROP VIEW IF EXISTS vw_film_circulation_timeline;

CREATE VIEW vw_film_circulation_timeline AS
WITH film_meta AS (
    SELECT
        f.film_id,
        f.title,
        f.original_title,
        f.year AS production_year,
        f.duration,
        STRING_AGG(DISTINCT d.director_name, ', ' ORDER BY d.director_name) AS directors,
        STRING_AGG(DISTINCT c.country_name, ', ' ORDER BY c.country_name)  AS countries,
        STRING_AGG(DISTINCT c.country_code, ', ' ORDER BY c.country_code)  AS country_codes,
        STRING_AGG(DISTINCT g.genre_name, ', ' ORDER BY g.genre_name)      AS genres
    FROM films f
    LEFT JOIN film_directors fd ON f.film_id = fd.film_id
    LEFT JOIN directors d       ON fd.director_id = d.director_id
    LEFT JOIN film_countries fc ON f.film_id = fc.film_id
    LEFT JOIN countries c       ON fc.country_id = c.country_id
    LEFT JOIN film_genres fg    ON f.film_id = fg.film_id
    LEFT JOIN genres g          ON fg.genre_id = g.genre_id
    GROUP BY f.film_id, f.title, f.original_title, f.year, f.duration
),
film_screening_stats AS (
    SELECT
        s.film_id,
        COUNT(DISTINCT s.festival_id)       AS total_festivals,
        COUNT(s.screening_id)               AS total_screenings,
        COUNT(*) FILTER (WHERE s.status = 'won')              AS awards_won,
        COUNT(*) FILTER (WHERE s.status = 'nominated')        AS nominations,
        COUNT(*) FILTER (WHERE s.status IN ('special_mention', 'honorable_mention')) AS mentions,
        MIN(s.event_year)                   AS first_screening_year,
        MAX(s.event_year)                   AS last_screening_year,
        MAX(s.event_year) - MIN(s.event_year) AS circulation_span_years
    FROM screenings s
    GROUP BY s.film_id
),
screening_events AS (
    SELECT
        s.film_id,
        JSON_AGG(
            JSON_BUILD_OBJECT(
                'event_year', s.event_year,
                'festival', fest.festival_name,
                'event_type', fest.event_type,
                'status', s.status,
                'category', s.category
            ) ORDER BY s.event_year, fest.festival_name
        ) AS screening_timeline
    FROM screenings s
    JOIN festivals fest ON s.festival_id = fest.festival_id
    GROUP BY s.film_id
)
SELECT
    fm.film_id,
    fm.title,
    fm.original_title,
    fm.production_year,
    fm.duration,
    fm.directors,
    fm.countries,
    fm.country_codes,
    fm.genres,
    fs.total_festivals,
    fs.total_screenings,
    fs.awards_won,
    fs.nominations,
    fs.mentions,
    fs.first_screening_year,
    fs.last_screening_year,
    fs.circulation_span_years,
    se.screening_timeline
FROM film_meta fm
JOIN film_screening_stats fs ON fm.film_id = fs.film_id
JOIN screening_events se     ON fm.film_id = se.film_id
ORDER BY fs.total_festivals DESC, fm.title;


-- ============================================================================
-- 3. vw_geographic_mobility
--    Production country patterns and how films circulate.
--    Shows each country's reach into the festival network.
-- ============================================================================

DROP VIEW IF EXISTS vw_geographic_mobility;

CREATE VIEW vw_geographic_mobility AS
WITH country_films AS (
    -- Films per production country
    SELECT
        c.country_id,
        c.country_name,
        c.country_code,
        fc.film_id
    FROM countries c
    JOIN film_countries fc ON c.country_id = fc.country_id
),
country_screenings AS (
    -- All screenings for films from each country
    SELECT
        cf.country_id,
        cf.country_name,
        cf.country_code,
        cf.film_id,
        s.screening_id,
        s.festival_id,
        s.event_year,
        s.status
    FROM country_films cf
    JOIN screenings s ON cf.film_id = s.film_id
)
SELECT
    cs.country_name         AS production_country,
    cs.country_code         AS production_country_code,
    COUNT(DISTINCT cs.film_id)      AS film_count,
    COUNT(DISTINCT cs.screening_id) AS total_screenings,
    COUNT(DISTINCT cs.festival_id)  AS festivals_reached,
    ROUND(COUNT(DISTINCT cs.screening_id)::numeric
        / NULLIF(COUNT(DISTINCT cs.film_id), 0), 1)
                            AS avg_screenings_per_film,
    ROUND(COUNT(DISTINCT cs.festival_id)::numeric
        / NULLIF(COUNT(DISTINCT cs.film_id), 0), 1)
                            AS avg_festivals_per_film,
    COUNT(*) FILTER (WHERE cs.status = 'won')
                            AS total_awards_won,
    COUNT(*) FILTER (WHERE cs.status = 'nominated')
                            AS total_nominations,
    MIN(cs.event_year)      AS first_screening_year,
    MAX(cs.event_year)      AS last_screening_year,
    -- Top festivals for this country's films
    (SELECT ARRAY_AGG(sub.festival_name ORDER BY sub.cnt DESC)
     FROM (
         SELECT fest.festival_name, COUNT(DISTINCT cs2.film_id) AS cnt
         FROM country_screenings cs2
         JOIN festivals fest ON cs2.festival_id = fest.festival_id
         WHERE cs2.country_id = cs.country_id
         GROUP BY fest.festival_name
         ORDER BY cnt DESC
         LIMIT 5
     ) sub
    ) AS top_5_festivals
FROM country_screenings cs
GROUP BY cs.country_id, cs.country_name, cs.country_code
ORDER BY film_count DESC;


-- ============================================================================
-- 4. vw_festival_statistics
--    Dashboard-level statistics for each festival.
-- ============================================================================

DROP VIEW IF EXISTS vw_festival_statistics;

CREATE VIEW vw_festival_statistics AS
WITH festival_films AS (
    SELECT
        s.festival_id,
        s.film_id,
        s.event_year,
        s.status,
        s.category
    FROM screenings s
),
genre_agg AS (
    SELECT
        sub.festival_id,
        STRING_AGG(sub.genre_name, ', ' ORDER BY sub.genre_name) AS genres_represented,
        JSONB_OBJECT_AGG(sub.genre_name, sub.cnt) AS genre_distribution
    FROM (
        SELECT ff2.festival_id, g2.genre_name, COUNT(DISTINCT ff2.film_id) AS cnt
        FROM festival_films ff2
        JOIN film_genres fg ON ff2.film_id = fg.film_id
        JOIN genres g2      ON fg.genre_id = g2.genre_id
        GROUP BY ff2.festival_id, g2.genre_name
    ) sub
    GROUP BY sub.festival_id
),
country_agg AS (
    SELECT
        ff.festival_id,
        COUNT(DISTINCT c.country_id)  AS countries_represented,
        STRING_AGG(DISTINCT c.country_name, ', ' ORDER BY c.country_name) AS country_list,
        STRING_AGG(DISTINCT c.country_code, ', ' ORDER BY c.country_code) AS country_codes
    FROM festival_films ff
    JOIN film_countries fc ON ff.film_id = fc.film_id
    JOIN countries c       ON fc.country_id = c.country_id
    GROUP BY ff.festival_id
)
SELECT
    f.festival_name,
    f.event_type,
    f.first_year,
    f.last_year,
    f.last_year - f.first_year + 1      AS years_active,
    COUNT(DISTINCT ff.film_id)           AS unique_film_count,
    COUNT(ff.film_id)                    AS total_screenings,
    COUNT(*) FILTER (WHERE ff.status = 'won')              AS awards_given,
    COUNT(*) FILTER (WHERE ff.status = 'nominated')        AS nominations_given,
    COUNT(*) FILTER (WHERE ff.status IN ('special_mention', 'honorable_mention')) AS mentions_given,
    COUNT(DISTINCT ff.event_year)        AS distinct_years_with_events,
    ga.genres_represented,
    ga.genre_distribution,
    ca.countries_represented,
    ca.country_list,
    ca.country_codes
FROM festivals f
LEFT JOIN festival_films ff ON f.festival_id = ff.festival_id
LEFT JOIN genre_agg ga      ON f.festival_id = ga.festival_id
LEFT JOIN country_agg ca    ON f.festival_id = ca.festival_id
GROUP BY f.festival_id, f.festival_name, f.event_type, f.first_year, f.last_year,
         ga.genres_represented, ga.genre_distribution,
         ca.countries_represented, ca.country_list, ca.country_codes
ORDER BY COUNT(DISTINCT ff.film_id) DESC;
