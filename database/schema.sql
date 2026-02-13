-- ============================================================================
-- Network Effects: Film Festival Circulation Database
-- Schema for Supabase (PostgreSQL)
--
-- Tracks how short films circulate through international festival networks.
-- Normalised design supporting network graphs, timelines, and geographic maps.
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Films: core entity representing each unique short film
CREATE TABLE films (
    film_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    original_title TEXT,
    year INTEGER,
    duration INTEGER,  -- in minutes
    synopsis TEXT,
    industry_events_count INTEGER,  -- total festival appearances from source data
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Festivals: each unique festival or award ceremony
CREATE TABLE festivals (
    festival_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    festival_name TEXT NOT NULL UNIQUE,
    event_type TEXT CHECK (event_type IN ('festival', 'award')),
    first_year INTEGER,  -- derived: earliest event_year in screenings
    last_year INTEGER,   -- derived: latest event_year in screenings
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Screenings: the core mobility record — a film appearing at a festival
CREATE TABLE screenings (
    screening_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    film_id UUID NOT NULL REFERENCES films(film_id) ON DELETE CASCADE,
    festival_id UUID NOT NULL REFERENCES festivals(festival_id) ON DELETE CASCADE,
    event_year INTEGER,
    status TEXT CHECK (status IN (
        'screening', 'won', 'nominated', 'special_mention',
        'honorable_mention', 'second_place', 'third_place'
    )),
    category TEXT,  -- award category or competition section
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Directors
CREATE TABLE directors (
    director_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    director_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Film-Directors junction table
CREATE TABLE film_directors (
    film_id UUID NOT NULL REFERENCES films(film_id) ON DELETE CASCADE,
    director_id UUID NOT NULL REFERENCES directors(director_id) ON DELETE CASCADE,
    PRIMARY KEY (film_id, director_id)
);

-- Countries with ISO codes for geographic mapping
CREATE TABLE countries (
    country_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    country_name TEXT NOT NULL UNIQUE,
    country_code CHAR(2),  -- ISO 3166-1 alpha-2
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Film-Countries junction table (production countries)
CREATE TABLE film_countries (
    film_id UUID NOT NULL REFERENCES films(film_id) ON DELETE CASCADE,
    country_id UUID NOT NULL REFERENCES countries(country_id) ON DELETE CASCADE,
    PRIMARY KEY (film_id, country_id)
);

-- Genres
CREATE TABLE genres (
    genre_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    genre_name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Film-Genres junction table
CREATE TABLE film_genres (
    film_id UUID NOT NULL REFERENCES films(film_id) ON DELETE CASCADE,
    genre_id UUID NOT NULL REFERENCES genres(genre_id) ON DELETE CASCADE,
    PRIMARY KEY (film_id, genre_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Duplicate detection: match films by title + year
CREATE INDEX idx_films_title_year ON films(title, year);

-- Core screening lookups
CREATE INDEX idx_screenings_film_id ON screenings(film_id);
CREATE INDEX idx_screenings_festival_id ON screenings(festival_id);
CREATE INDEX idx_screenings_film_festival_year ON screenings(film_id, festival_id, event_year);
CREATE INDEX idx_screenings_event_year ON screenings(event_year);

-- Festival name lookups
CREATE INDEX idx_festivals_name ON festivals(festival_name);

-- Director name lookups
CREATE INDEX idx_directors_name ON directors(director_name);

-- Country code lookups for geographic mapping
CREATE INDEX idx_countries_code ON countries(country_code);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_films_updated_at
    BEFORE UPDATE ON films
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_festivals_updated_at
    BEFORE UPDATE ON festivals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_screenings_updated_at
    BEFORE UPDATE ON screenings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_directors_updated_at
    BEFORE UPDATE ON directors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_countries_updated_at
    BEFORE UPDATE ON countries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_genres_updated_at
    BEFORE UPDATE ON genres
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUTURE TABLES (empty, for planned expansion)
-- ============================================================================

-- Submissions: for future negative data (films submitted but not selected)
-- Will track submission patterns to understand festival selection dynamics.
-- CREATE TABLE submissions (
--     submission_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     film_id UUID NOT NULL REFERENCES films(film_id) ON DELETE CASCADE,
--     festival_id UUID NOT NULL REFERENCES festivals(festival_id) ON DELETE CASCADE,
--     submission_year INTEGER,
--     submission_date DATE,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Rejections (anonymised): GDPR-compliant aggregated rejection data.
-- Uses aggregation thresholds (minimum 5 films per pattern) to prevent
-- identification of individual submission outcomes.
-- CREATE TABLE rejections_anonymised (
--     rejection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     festival_id UUID NOT NULL REFERENCES festivals(festival_id) ON DELETE CASCADE,
--     rejection_year INTEGER,
--     genre_id UUID REFERENCES genres(genre_id),
--     country_id UUID REFERENCES countries(country_id),
--     rejection_count INTEGER NOT NULL CHECK (rejection_count >= 5),
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- ============================================================================
-- ROW LEVEL SECURITY (Supabase best practice)
-- ============================================================================

ALTER TABLE films ENABLE ROW LEVEL SECURITY;
ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenings ENABLE ROW LEVEL SECURITY;
ALTER TABLE directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE film_genres ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated and anon users (research data is public)
CREATE POLICY "Allow public read access" ON films FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON festivals FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON screenings FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON directors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON film_directors FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON countries FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON film_countries FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON genres FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON film_genres FOR SELECT USING (true);
