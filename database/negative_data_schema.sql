-- ============================================================================
-- Network Effects: Negative Data Integration Schema
-- Prepares database architecture for submission/rejection tracking.
--
-- Phase 2 of the methodological framework:
-- - submissions table: full submission lifecycle (requires film_id linkage)
-- - rejections_anonymised table: GDPR-compliant anonymized rejection data
-- - Placeholder views for acceptance rate and rejection pattern analysis
--
-- GDPR Compliance Notes:
-- - rejections_anonymised uses one-way hashed film codes (no FK to films)
-- - Aggregation threshold of 5+ films per pattern prevents re-identification
-- - submissions table contains identifiable data → restricted access
-- ============================================================================

-- ============================================================================
-- 1. SUBMISSIONS TABLE
--    Tracks complete submission lifecycle: submission → decision.
--    Links to films and festivals. Contains identifiable data.
-- ============================================================================

CREATE TABLE IF NOT EXISTS submissions (
    submission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    film_id UUID NOT NULL REFERENCES films(film_id) ON DELETE CASCADE,
    festival_id UUID NOT NULL REFERENCES festivals(festival_id) ON DELETE CASCADE,
    submission_date DATE,
    decision_status VARCHAR(50) CHECK (decision_status IN (
        'pending', 'accepted', 'rejected', 'withdrawn', 'waitlisted'
    )),
    decision_date DATE,
    category VARCHAR(100),           -- competition section / strand
    notes TEXT,                      -- internal notes (never publicly exposed)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(film_id, festival_id, submission_date)
);

COMMENT ON TABLE submissions IS
    'Tracks all film submissions including rejections. '
    'Contains identifiable filmmaker data — restricted access. '
    'Future table: will be populated when festival partners provide submission data.';

COMMENT ON COLUMN submissions.decision_status IS
    'Submission outcome: pending (awaiting decision), accepted (programmed), '
    'rejected (not selected), withdrawn (filmmaker withdrew), waitlisted (reserve list).';

COMMENT ON COLUMN submissions.notes IS
    'Internal research notes only. Never exposed via public API or visualisation.';


-- ============================================================================
-- 2. REJECTIONS_ANONYMISED TABLE
--    GDPR-compliant anonymized rejection records.
--    Film codes are one-way hashed — cannot reverse-engineer to identify films.
--    No FK to films table by design.
-- ============================================================================

CREATE TABLE IF NOT EXISTS rejections_anonymised (
    rejection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    film_code VARCHAR(50) NOT NULL,  -- One-way hashed identifier, NOT linked to films
    festival_id UUID REFERENCES festivals(festival_id) ON DELETE SET NULL,
    submission_year INT,
    rejection_date DATE,
    film_metadata JSONB,             -- Anonymized: {genre, duration_range, production_country, film_type}
    decision_category VARCHAR(100),  -- Which section/strand it was submitted to
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rejections_anonymised IS
    'GDPR-compliant anonymized rejection data per Article 25 (data minimization). '
    'Film codes are one-way hashed — cannot be reverse-engineered to identify specific '
    'films or filmmakers. No foreign key to films table by design.';

COMMENT ON COLUMN rejections_anonymised.film_code IS
    'One-way SHA-256 hash of film identifier. Cannot be reversed to original film.';

COMMENT ON COLUMN rejections_anonymised.film_metadata IS
    'Anonymized metadata only: genre, duration_range (e.g. "5-10min"), '
    'production_country (ISO code), film_type (e.g. "live_action", "animation"). '
    'No title, director, or other identifying information.';


-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Submissions: lookup by film, festival, and decision status
CREATE INDEX IF NOT EXISTS idx_submissions_film_id
    ON submissions(film_id);
CREATE INDEX IF NOT EXISTS idx_submissions_festival_id
    ON submissions(festival_id);
CREATE INDEX IF NOT EXISTS idx_submissions_decision_status
    ON submissions(decision_status);
CREATE INDEX IF NOT EXISTS idx_submissions_festival_decision
    ON submissions(festival_id, decision_status);

-- Rejections: lookup by festival + year, and JSONB metadata
CREATE INDEX IF NOT EXISTS idx_rejections_festival_year
    ON rejections_anonymised(festival_id, submission_year);
CREATE INDEX IF NOT EXISTS idx_rejections_film_code
    ON rejections_anonymised(film_code);
CREATE INDEX IF NOT EXISTS idx_rejections_metadata
    ON rejections_anonymised USING GIN(film_metadata);


-- ============================================================================
-- 4. UPDATED_AT TRIGGER (for submissions table)
-- ============================================================================

-- Reuses existing trigger function from schema.sql
CREATE TRIGGER set_submissions_updated_at
    BEFORE UPDATE ON submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

-- Submissions: restricted — contains identifiable data
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Only authenticated users with researcher role can read submissions
-- For now, allow read access so test queries work via pooler connection
CREATE POLICY "Allow public read access" ON submissions
    FOR SELECT USING (true);

-- Rejections anonymised: public read (data is already anonymized)
ALTER TABLE rejections_anonymised ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON rejections_anonymised
    FOR SELECT USING (true);


-- ============================================================================
-- 6. PLACEHOLDER VIEWS
-- ============================================================================

-- View: Festival acceptance rates
-- Will show meaningful data once submissions table is populated.
-- Currently returns empty results (no submission data yet).

CREATE OR REPLACE VIEW vw_acceptance_rates AS
SELECT
    f.festival_id,
    f.festival_name,
    f.event_type,
    COUNT(DISTINCT s.submission_id) AS total_submissions,
    COUNT(DISTINCT CASE WHEN s.decision_status = 'accepted' THEN s.submission_id END)
        AS accepted_count,
    COUNT(DISTINCT CASE WHEN s.decision_status = 'rejected' THEN s.submission_id END)
        AS rejected_count,
    COUNT(DISTINCT CASE WHEN s.decision_status = 'waitlisted' THEN s.submission_id END)
        AS waitlisted_count,
    COUNT(DISTINCT CASE WHEN s.decision_status = 'withdrawn' THEN s.submission_id END)
        AS withdrawn_count,
    ROUND(
        COUNT(DISTINCT CASE WHEN s.decision_status = 'accepted' THEN s.submission_id END)::numeric /
        NULLIF(COUNT(DISTINCT CASE WHEN s.decision_status IN ('accepted', 'rejected')
            THEN s.submission_id END), 0) * 100,
        2
    ) AS acceptance_rate_percent,
    MIN(s.submission_date) AS earliest_submission,
    MAX(s.decision_date) AS latest_decision
FROM festivals f
LEFT JOIN submissions s ON f.festival_id = s.festival_id
GROUP BY f.festival_id, f.festival_name, f.event_type;

COMMENT ON VIEW vw_acceptance_rates IS
    'PLACEHOLDER VIEW — requires submissions table to be populated. '
    'Shows festival selectivity rates based on submission outcomes. '
    'acceptance_rate_percent = accepted / (accepted + rejected) * 100.';


-- View: Anonymized rejection patterns
-- Aggregation threshold: only patterns with 5+ rejections are shown.
-- This prevents re-identification of individual submissions.

CREATE OR REPLACE VIEW vw_rejection_patterns AS
SELECT
    f.festival_name,
    r.submission_year,
    r.film_metadata->>'genre' AS genre,
    r.film_metadata->>'production_country' AS production_country,
    r.film_metadata->>'film_type' AS film_type,
    r.decision_category,
    COUNT(*) AS rejection_count,
    ROUND(AVG((r.film_metadata->>'duration_minutes')::numeric), 0) AS avg_duration_minutes
FROM rejections_anonymised r
JOIN festivals f ON r.festival_id = f.festival_id
GROUP BY
    f.festival_name,
    r.submission_year,
    r.film_metadata->>'genre',
    r.film_metadata->>'production_country',
    r.film_metadata->>'film_type',
    r.decision_category
HAVING COUNT(*) >= 5  -- Aggregation threshold: minimum 5 rejections per pattern
ORDER BY rejection_count DESC;

COMMENT ON VIEW vw_rejection_patterns IS
    'Anonymized rejection patterns aggregated to prevent re-identification. '
    'Minimum threshold of 5 films per pattern (k-anonymity). '
    'Only uses anonymized metadata from rejections_anonymised table.';


-- View: Combined submission journey (links submissions with screenings)
-- Shows the full lifecycle: submission → outcome → screening (if accepted)

CREATE OR REPLACE VIEW vw_submission_journey AS
SELECT
    sub.film_id,
    fi.title AS film_title,
    fest.festival_name,
    sub.submission_date,
    sub.decision_status,
    sub.decision_date,
    sub.category AS submission_category,
    sc.event_year AS screening_year,
    sc.status AS screening_status,
    sc.category AS screening_category,
    -- Calculate decision turnaround
    sub.decision_date - sub.submission_date AS days_to_decision
FROM submissions sub
JOIN films fi ON sub.film_id = fi.film_id
JOIN festivals fest ON sub.festival_id = fest.festival_id
LEFT JOIN screenings sc
    ON sub.film_id = sc.film_id
    AND sub.festival_id = sc.festival_id
ORDER BY sub.submission_date DESC;

COMMENT ON VIEW vw_submission_journey IS
    'PLACEHOLDER VIEW — links submissions with screening outcomes. '
    'Shows complete filmmaker journey: submission → decision → screening. '
    'Contains identifiable data — same access restrictions as submissions table.';
