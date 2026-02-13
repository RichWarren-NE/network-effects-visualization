"""
Geographic Mobility Data Extractor
Extracts production country, screening, and festival data for geo visualization.
Creates festival-country mappings and geo_data.json for the visualization.
"""
import os, sys, io, json, re, csv
from collections import defaultdict, Counter
from datetime import date

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Load .env
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            os.environ[k] = v

import psycopg2
import psycopg2.extras

def get_conn():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'), database=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'), password=os.getenv('SUPABASE_PASSWORD'),
        port=os.getenv('SUPABASE_PORT'), sslmode='require'
    )

# ── Festival → Country mapping ──────────────────────────────────────────
# Manual mapping for known festivals. We'll map all festivals from DB.
FESTIVAL_COUNTRY_MAP = {
    # UK
    'Encounters': 'GB', 'Encounters Short Film and Animation Festival': 'GB',
    'BFI London Film Festival': 'GB', 'London Short Film Festival': 'GB',
    'Edinburgh International Film Festival': 'GB', 'Glasgow Short Film Festival': 'GB',
    'Sheffield Doc/Fest': 'GB', 'Sheffield DocFest': 'GB',
    'Aesthetica Short Film Festival': 'GB', 'Iris Prize': 'GB',
    'BAFTA': 'GB', 'British Independent Film Awards': 'GB',
    'Raindance Film Festival': 'GB', 'Leeds International Film Festival': 'GB',
    'Cambridge Film Festival': 'GB', 'Flatpack Festival': 'GB',
    'London International Animation Festival': 'GB', 'LIAF': 'GB',
    'Open City Documentary Festival': 'GB', 'Carmarthen Bay Film Festival': 'GB',
    'Hebden Bridge Film Festival': 'GB', 'East End Film Festival': 'GB',
    'Underwire Festival': 'GB', 'Portobello Film Festival': 'GB',
    'British Arrows': 'GB', 'Celtic Media Festival': 'GB',
    'Grierson Awards': 'GB', 'London Calling': 'GB',
    'London Feminist Film Festival': 'GB', 'Watersprite Film Festival': 'GB',
    'BFI Flare': 'GB', 'BFI Future Film Festival': 'GB',
    'Bath Film Festival': 'GB', 'Bolton Film Festival': 'GB',
    'Bristol Radical Film Festival': 'GB',
    'Chichester International Film Festival': 'GB',
    'Cornwall Film Festival': 'GB', 'Cinemagic': 'GB',
    'Crystal Palace International Film Festival': 'GB',
    'Deptford Cinema': 'GB', 'Discovering Film': 'GB',
    'Ely Film Festival': 'GB', 'Fringe! Queer Film & Arts Fest': 'GB',
    'Gloucester Goes Retro': 'GB', 'Hull Independent Cinema': 'GB',
    'International Short Film Festival': 'GB',
    'Kinofilm Manchester': 'GB', 'Manchester Animation Festival': 'GB',
    'Manchester International Film Festival': 'GB',
    'Norwich Film Festival': 'GB', 'Oska Bright Film Festival': 'GB',
    'Reeltime Film Festival': 'GB', 'Sunderland Shorts Film Festival': 'GB',
    'Trinity Buoy Wharf': 'GB', 'UK Film Festival': 'GB',
    'Wimbledon Shorts Film Festival': 'GB', 'Wildscreen Festival': 'GB',
    'ScreenDance Festival': 'GB',
    # France
    'Cannes Film Festival': 'FR', 'Festival de Cannes': 'FR',
    'Cannes': 'FR', 'Clermont-Ferrand International Short Film Festival': 'FR',
    'Clermont-Ferrand': 'FR', 'Annecy International Animation Film Festival': 'FR',
    'Annecy': 'FR', 'Cesar Awards': 'FR', 'Cesars': 'FR',
    'Paris International Film Festival': 'FR', 'Brest European Short Film Festival': 'FR',
    'Grenoble Short Film Festival': 'FR', 'Vendome Film Festival': 'FR',
    'Festival du Film Court de Villeurbanne': 'FR',
    'Festival Tous Courts': 'FR', 'Premiers Plans': 'FR',
    'Poitiers Film Festival': 'FR', 'Regard sur le Court Metrage': 'FR',
    'Festival International du Film': 'FR',
    'Festival International du Court Metrage': 'FR',
    'Quinzaine des Realisateurs': 'FR', 'Directors Fortnight': 'FR',
    "Semaine de la Critique": 'FR', "Critics' Week": 'FR',
    'Palme d\'Or': 'FR', 'Short Film Corner': 'FR',
    'Festival de Films de Femmes': 'FR', 'Marseille FID': 'FR',
    'Festival du Nouveau Cinema': 'FR',
    # Germany
    'Berlinale': 'DE', 'Berlin International Film Festival': 'DE',
    'Internationale Kurzfilmtage Oberhausen': 'DE', 'Oberhausen': 'DE',
    'Hamburg International Short Film Festival': 'DE',
    'DOK Leipzig': 'DE', 'Interfilm Berlin': 'DE',
    'Kurzfilm Festival Hamburg': 'DE', 'Filmfest Dresden': 'DE',
    'Filmfest Munchen': 'DE', 'Munich Film Festival': 'DE',
    'Kassel Documentary Film Festival': 'DE',
    'Cologne International Short Film Festival': 'DE',
    'European Media Art Festival': 'DE',
    'Landshut Short Film Festival': 'DE',
    'Kurzfilmtage Winterthur': 'DE',
    # USA
    'Sundance Film Festival': 'US', 'Sundance': 'US',
    'Tribeca Film Festival': 'US', 'Tribeca': 'US',
    'SXSW': 'US', 'South by Southwest': 'US',
    'Telluride Film Festival': 'US', 'AFI Fest': 'US',
    'Academy Awards': 'US', 'Oscars': 'US',
    'Aspen Shortsfest': 'US', 'Palm Springs International ShortFest': 'US',
    'Palm Springs ShortFest': 'US', 'Palm Springs': 'US',
    'Ann Arbor Film Festival': 'US', 'Cleveland International Film Festival': 'US',
    'New York Film Festival': 'US', 'NYFF': 'US',
    'Los Angeles Film Festival': 'US', 'Chicago International Film Festival': 'US',
    'Nashville Film Festival': 'US', 'Hollyshorts': 'US',
    'HollyShorts Film Festival': 'US',
    'Slamdance Film Festival': 'US', 'Slamdance': 'US',
    'Outfest': 'US', 'Frameline': 'US', 'NewFest': 'US',
    'Flicker Fest': 'US', 'DC Shorts': 'US',
    'Rhode Island International Film Festival': 'US',
    'Seattle International Film Festival': 'US',
    'Atlanta Film Festival': 'US', 'Austin Film Festival': 'US',
    'Cinequest Film Festival': 'US', 'Denver Film Festival': 'US',
    'Hawaii International Film Festival': 'US',
    'Indianapolis International Film Festival': 'US',
    'LA Shorts International Film Festival': 'US',
    'Maryland Film Festival': 'US', 'New Orleans Film Festival': 'US',
    'Philadelphia Film Festival': 'US', 'Portland Film Festival': 'US',
    'San Francisco International Film Festival': 'US',
    'Savannah Film Festival': 'US', 'Sidewalk Film Festival': 'US',
    'St. Louis International Film Festival': 'US',
    'Woodstock Film Festival': 'US',
    # Canada
    'Toronto International Film Festival': 'CA', 'TIFF': 'CA',
    'Ottawa International Animation Festival': 'CA',
    'Vancouver International Film Festival': 'CA',
    'Montreal World Film Festival': 'CA', 'Calgary International Film Festival': 'CA',
    'Inside Out': 'CA', 'Reel Asian International Film Festival': 'CA',
    'Festival du nouveau cinema': 'CA', 'REGARD': 'CA',
    'Fantasia International Film Festival': 'CA',
    # Netherlands
    'International Film Festival Rotterdam': 'NL', 'IFFR': 'NL',
    'Holland Animation Film Festival': 'NL', 'Go Short': 'NL',
    'Netherlands Film Festival': 'NL', 'Cinekid': 'NL',
    'IDFA': 'NL', 'Kaboom Animation Festival': 'NL',
    # Spain
    'San Sebastian International Film Festival': 'ES',
    'Sitges Film Festival': 'ES', 'Malaga Film Festival': 'ES',
    'Bilbao International Festival of Documentary and Short Films': 'ES',
    'Alcala de Henares': 'ES', 'Curtocircuito': 'ES',
    'Filmets Badalona': 'ES', 'La Cabina': 'ES',
    'Mecal': 'ES', 'Aguilar de Campoo': 'ES',
    'Festival de Cine de Huesca': 'ES',
    # Italy
    'Venice Film Festival': 'IT', 'Venice': 'IT',
    'Turin Film Festival': 'IT', 'Giffoni Film Festival': 'IT',
    'Rome Film Fest': 'IT', 'Torino Short Film Market': 'IT',
    'Cortinametraggio': 'IT', 'Ferrara Film Festival': 'IT',
    # Belgium
    'Brussels Short Film Festival': 'BE', 'Anima Festival': 'BE',
    'Court Metrage': 'BE', 'Leuven Short Film Festival': 'BE',
    'Off-Courts': 'BE',
    # Switzerland
    'Locarno Film Festival': 'CH', 'Locarno': 'CH',
    'Winterthur International Short Film Festival': 'CH',
    'Fantoche': 'CH', 'Nifff': 'CH', 'Zurich Film Festival': 'CH',
    'Solothurn Film Days': 'CH', 'Visions du Reel': 'CH',
    # Austria
    'Vienna Shorts': 'AT', 'Tricky Women': 'AT',
    'Viennale': 'AT', 'Diagonale': 'AT', 'Ars Electronica': 'AT',
    # Ireland
    'Cork International Film Festival': 'IE', 'Cork Film Festival': 'IE',
    'Dublin International Film Festival': 'IE', 'Galway Film Fleadh': 'IE',
    'Fastnet Film Festival': 'IE', 'Dingle International Film Festival': 'IE',
    'Kerry Film Festival': 'IE', 'Foyle Film Festival': 'IE',
    'IndieCork': 'IE', 'GAZE': 'IE',
    # Nordic
    'Gothenburg Film Festival': 'SE', 'Uppsala Short Film Festival': 'SE',
    'Stockholm Film Festival': 'SE', 'Malmo Arab Film Festival': 'SE',
    'Fredrikstad Animation Festival': 'NO', 'Oslo/Fusion International Film Festival': 'NO',
    'Norwegian Short Film Festival': 'NO', 'Nordisk Panorama': 'NO',
    'Bergen International Film Festival': 'NO',
    'Tampere Film Festival': 'FI', 'Tampere': 'FI',
    'Helsinki International Film Festival': 'FI',
    'CPH:DOX': 'DK', 'Odense International Film Festival': 'DK',
    'Odense': 'DK', 'Buster Film Festival': 'DK',
    'Reykjavik International Film Festival': 'IS',
    # Eastern Europe
    'Krakow Film Festival': 'PL', 'Off Cinema': 'PL',
    'Warsaw Film Festival': 'PL', 'New Horizons': 'PL',
    'Karlovy Vary International Film Festival': 'CZ',
    'AniFest': 'CZ', 'Anifilm': 'CZ', 'ZLIN Film Festival': 'CZ',
    'Sarajevo Film Festival': 'BA', 'Sarajevo': 'BA',
    'Zagreb Film Festival': 'HR', 'Animafest Zagreb': 'HR',
    'Tabor Film Festival': 'HR',
    'Ljubljana International Film Festival': 'SI', 'Animateka': 'SI',
    'Anim\u2019est': 'RO', 'Transilvania International Film Festival': 'RO',
    'Sofia International Film Festival': 'BG',
    'Fest Anka': 'TR', 'Istanbul Film Festival': 'TR',
    'Akbank Short Film Festival': 'TR',
    'Tbilisi International Film Festival': 'GE',
    'Vilnius International Film Festival': 'LT', 'Kino Pavasaris': 'LT',
    'Riga International Film Festival': 'LV',
    'Tallinn Black Nights Film Festival': 'EE', 'POFF': 'EE',
    'Primanima': 'HU', 'Kecskemeti Animacios Filmfesztival': 'HU',
    'Friss Hus': 'HU', 'CineFest Miskolc': 'HU',
    'Kyiv International Short Film Festival': 'UA',
    'Moscow International Film Festival': 'RU',
    # Portugal
    'Curtas Vila do Conde': 'PT', 'IndieLisboa': 'PT',
    'Lisbon & Sintra Film Festival': 'PT', 'Monstra': 'PT',
    # Greece
    'Thessaloniki International Film Festival': 'GR',
    'Thessaloniki Documentary Festival': 'GR',
    'Athens International Film Festival': 'GR', 'Drama Short Film Festival': 'GR',
    # Asia
    'Busan International Film Festival': 'KR', 'BIFF': 'KR',
    'Seoul International Short Film Festival': 'KR', 'Bucheon International Animation Festival': 'KR',
    'Tokyo International Film Festival': 'JP', 'Short Shorts Film Festival': 'JP',
    'Hiroshima International Animation Festival': 'JP',
    'Hong Kong International Film Festival': 'HK',
    'Shanghai International Film Festival': 'CN',
    'Singapore International Film Festival': 'SG',
    'Taipei Film Festival': 'TW',
    'Mumbai Film Festival': 'IN', 'MAMI': 'IN',
    'Kerala International Film Festival': 'IN',
    'Tehran Short Film Festival': 'IR',
    # Middle East
    'Dubai International Film Festival': 'AE',
    'Abu Dhabi Film Festival': 'AE',
    'Haifa International Film Festival': 'IL',
    'Jerusalem Film Festival': 'IL',
    # Africa
    'Durban International Film Festival': 'ZA',
    'Cape Town International Film Festival': 'ZA',
    'Pan African Film Festival': 'US',  # LA-based
    'FESPACO': 'BF',
    # Oceania
    'Melbourne International Film Festival': 'AU',
    'Sydney Film Festival': 'AU', 'Flickerfest': 'AU',
    'St Kilda Film Festival': 'AU', 'Tropfest': 'AU',
    'New Zealand International Film Festival': 'NZ',
    'Show Me Shorts': 'NZ',
    # Latin America
    'Havana Film Festival': 'CU',
    'Guadalajara International Film Festival': 'MX',
    'FICUNAM': 'MX', 'Morelia International Film Festival': 'MX',
    'Sao Paulo International Short Film Festival': 'BR',
    'Rio de Janeiro International Film Festival': 'BR',
    'Bogota Short Film Festival': 'CO',
    'Buenos Aires International Film Festival': 'AR', 'BAFICI': 'AR',
    'Valdivia International Film Festival': 'CL',
    'Lima Film Festival': 'PE',
}

# Country code to name mapping
COUNTRY_NAMES = {
    'GB': 'United Kingdom', 'FR': 'France', 'US': 'United States', 'DE': 'Germany',
    'CH': 'Switzerland', 'IE': 'Ireland', 'CA': 'Canada', 'NL': 'Netherlands',
    'ES': 'Spain', 'IT': 'Italy', 'BE': 'Belgium', 'AT': 'Austria',
    'SE': 'Sweden', 'NO': 'Norway', 'FI': 'Finland', 'DK': 'Denmark',
    'IS': 'Iceland', 'PL': 'Poland', 'CZ': 'Czechia', 'BA': 'Bosnia and Herzegovina',
    'HR': 'Croatia', 'SI': 'Slovenia', 'RO': 'Romania', 'BG': 'Bulgaria',
    'TR': 'Turkey', 'GE': 'Georgia', 'LT': 'Lithuania', 'LV': 'Latvia',
    'EE': 'Estonia', 'HU': 'Hungary', 'UA': 'Ukraine', 'RU': 'Russia',
    'PT': 'Portugal', 'GR': 'Greece', 'KR': 'South Korea', 'JP': 'Japan',
    'HK': 'Hong Kong', 'CN': 'China', 'SG': 'Singapore', 'TW': 'Taiwan',
    'IN': 'India', 'IR': 'Iran', 'AE': 'United Arab Emirates', 'IL': 'Israel',
    'ZA': 'South Africa', 'BF': 'Burkina Faso', 'AU': 'Australia', 'NZ': 'New Zealand',
    'CU': 'Cuba', 'MX': 'Mexico', 'BR': 'Brazil', 'CO': 'Colombia',
    'AR': 'Argentina', 'CL': 'Chile', 'PE': 'Peru', 'RS': 'Serbia',
    'SK': 'Slovakia', 'LB': 'Lebanon', 'PS': 'Palestine', 'EG': 'Egypt',
    'KE': 'Kenya', 'NG': 'Nigeria', 'GH': 'Ghana', 'TN': 'Tunisia',
    'MA': 'Morocco', 'JO': 'Jordan', 'QA': 'Qatar', 'BH': 'Bahrain',
    'XK': 'Kosovo', 'ME': 'Montenegro', 'MK': 'North Macedonia',
    'AL': 'Albania', 'CY': 'Cyprus', 'MT': 'Malta', 'LU': 'Luxembourg',
}

# Region mapping
REGIONS = {
    'GB': 'Europe', 'FR': 'Europe', 'DE': 'Europe', 'CH': 'Europe',
    'IE': 'Europe', 'NL': 'Europe', 'ES': 'Europe', 'IT': 'Europe',
    'BE': 'Europe', 'AT': 'Europe', 'SE': 'Europe', 'NO': 'Europe',
    'FI': 'Europe', 'DK': 'Europe', 'IS': 'Europe', 'PL': 'Europe',
    'CZ': 'Europe', 'BA': 'Europe', 'HR': 'Europe', 'SI': 'Europe',
    'RO': 'Europe', 'BG': 'Europe', 'GR': 'Europe', 'PT': 'Europe',
    'HU': 'Europe', 'LT': 'Europe', 'LV': 'Europe', 'EE': 'Europe',
    'RS': 'Europe', 'SK': 'Europe', 'AL': 'Europe', 'ME': 'Europe',
    'MK': 'Europe', 'XK': 'Europe', 'CY': 'Europe', 'MT': 'Europe',
    'LU': 'Europe',
    'US': 'North America', 'CA': 'North America', 'MX': 'North America',
    'BR': 'South America', 'AR': 'South America', 'CL': 'South America',
    'CO': 'South America', 'PE': 'South America', 'CU': 'South America',
    'TR': 'Asia', 'GE': 'Asia', 'UA': 'Europe', 'RU': 'Europe',
    'KR': 'Asia', 'JP': 'Asia', 'HK': 'Asia', 'CN': 'Asia',
    'SG': 'Asia', 'TW': 'Asia', 'IN': 'Asia', 'IR': 'Asia',
    'AE': 'Asia', 'IL': 'Asia', 'LB': 'Asia', 'PS': 'Asia',
    'JO': 'Asia', 'QA': 'Asia', 'BH': 'Asia',
    'ZA': 'Africa', 'BF': 'Africa', 'KE': 'Africa', 'NG': 'Africa',
    'GH': 'Africa', 'TN': 'Africa', 'MA': 'Africa', 'EG': 'Africa',
    'AU': 'Oceania', 'NZ': 'Oceania',
}


def fuzzy_match_festival(name, mapping):
    """Try to match a festival name to our mapping using substring matching."""
    # Exact match
    if name in mapping:
        return mapping[name]
    # Case-insensitive
    name_lower = name.lower()
    for k, v in mapping.items():
        if k.lower() == name_lower:
            return v
    # Substring match
    for k, v in mapping.items():
        if k.lower() in name_lower or name_lower in k.lower():
            return v
    # Keyword-based heuristics
    kw = {
        'london': 'GB', 'british': 'GB', 'bristol': 'GB', 'edinburgh': 'GB',
        'glasgow': 'GB', 'sheffield': 'GB', 'cardiff': 'GB', 'wales': 'GB',
        'manchester': 'GB', 'birmingham': 'GB', 'leeds': 'GB', 'brighton': 'GB',
        'nottingham': 'GB', 'belfast': 'GB', 'exeter': 'GB', 'bath': 'GB',
        'york': 'GB', 'oxford': 'GB', 'cambridge': 'GB', 'norwich': 'GB',
        'hull': 'GB', 'sunderland': 'GB', 'cornwall': 'GB', 'devon': 'GB',
        'bafta': 'GB', 'uk ': 'GB', 'bfi': 'GB', 'bolton': 'GB',
        'paris': 'FR', 'clermont': 'FR', 'annecy': 'FR', 'french': 'FR',
        'grenoble': 'FR', 'brest': 'FR', 'lyon': 'FR', 'marseille': 'FR',
        'berlin': 'DE', 'oberhausen': 'DE', 'hamburg': 'DE', 'dresden': 'DE',
        'munich': 'DE', 'german': 'DE', 'leipzig': 'DE', 'cologne': 'DE',
        'kassel': 'DE', 'munchen': 'DE',
        'sundance': 'US', 'tribeca': 'US', 'sxsw': 'US', 'oscar': 'US',
        'academy': 'US', 'aspen': 'US', 'palm springs': 'US', 'new york': 'US',
        'los angeles': 'US', 'chicago': 'US', 'san francisco': 'US',
        'seattle': 'US', 'nashville': 'US', 'atlanta': 'US', 'austin': 'US',
        'toronto': 'CA', 'ottawa': 'CA', 'vancouver': 'CA', 'montreal': 'CA',
        'calgary': 'CA',
        'rotterdam': 'NL', 'amsterdam': 'NL', 'holland': 'NL', 'dutch': 'NL',
        'san sebastian': 'ES', 'sitges': 'ES', 'malaga': 'ES', 'bilbao': 'ES',
        'madrid': 'ES', 'barcelona': 'ES',
        'venice': 'IT', 'rome': 'IT', 'turin': 'IT', 'italian': 'IT',
        'bologna': 'IT', 'milan': 'IT', 'giffoni': 'IT',
        'brussels': 'BE', 'leuven': 'BE', 'ghent': 'BE',
        'locarno': 'CH', 'zurich': 'CH', 'swiss': 'CH', 'winterthur': 'CH',
        'vienna': 'AT', 'viennale': 'AT', 'austrian': 'AT',
        'cork': 'IE', 'dublin': 'IE', 'galway': 'IE', 'irish': 'IE',
        'kerry': 'IE',
        'gothenburg': 'SE', 'stockholm': 'SE', 'uppsala': 'SE', 'malmo': 'SE',
        'swedish': 'SE',
        'tampere': 'FI', 'helsinki': 'FI', 'finnish': 'FI',
        'copenhagen': 'DK', 'odense': 'DK', 'cph': 'DK', 'danish': 'DK',
        'oslo': 'NO', 'bergen': 'NO', 'norwegian': 'NO', 'fredrikstad': 'NO',
        'reykjavik': 'IS', 'iceland': 'IS',
        'krakow': 'PL', 'warsaw': 'PL', 'polish': 'PL', 'wroclaw': 'PL',
        'prague': 'CZ', 'czech': 'CZ', 'zlin': 'CZ', 'karlovy': 'CZ',
        'sarajevo': 'BA', 'zagreb': 'HR', 'croatian': 'HR',
        'ljubljana': 'SI', 'slovenian': 'SI',
        'bucharest': 'RO', 'romanian': 'RO',
        'sofia': 'BG', 'bulgarian': 'BG',
        'istanbul': 'TR', 'turkish': 'TR', 'ankara': 'TR',
        'lisbon': 'PT', 'porto': 'PT', 'portuguese': 'PT',
        'thessaloniki': 'GR', 'athens': 'GR', 'greek': 'GR', 'drama': 'GR',
        'busan': 'KR', 'seoul': 'KR', 'korean': 'KR',
        'tokyo': 'JP', 'hiroshima': 'JP', 'japanese': 'JP',
        'hong kong': 'HK', 'shanghai': 'CN', 'beijing': 'CN', 'chinese': 'CN',
        'singapore': 'SG', 'taipei': 'TW',
        'mumbai': 'IN', 'kerala': 'IN', 'indian': 'IN',
        'tehran': 'IR', 'iranian': 'IR',
        'dubai': 'AE', 'abu dhabi': 'AE',
        'jerusalem': 'IL', 'haifa': 'IL', 'tel aviv': 'IL',
        'durban': 'ZA', 'cape town': 'ZA', 'johannesburg': 'ZA',
        'melbourne': 'AU', 'sydney': 'AU', 'australian': 'AU',
        'wellington': 'NZ', 'auckland': 'NZ',
        'havana': 'CU', 'guadalajara': 'MX', 'mexico': 'MX',
        'sao paulo': 'BR', 'rio': 'BR', 'brazilian': 'BR',
        'bogota': 'CO', 'buenos aires': 'AR',
        'tbilisi': 'GE', 'georgian': 'GE',
        'tallinn': 'EE', 'riga': 'LV', 'vilnius': 'LT',
        'budapest': 'HU', 'hungarian': 'HU',
        'kyiv': 'UA', 'ukrainian': 'UA',
        'moscow': 'RU', 'russian': 'RU',
        'belgrade': 'RS', 'serbian': 'RS',
        'bratislava': 'SK', 'slovak': 'SK',
        'nordic': 'NO',
    }
    for keyword, code in kw.items():
        if keyword in name_lower:
            return code
    return None


def main():
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # 1. Get vw_geographic_mobility data
    print("Fetching geographic mobility view...")
    cur.execute("SELECT * FROM vw_geographic_mobility ORDER BY film_count DESC")
    geo_mobility = cur.fetchall()
    print(f"  {len(geo_mobility)} production countries")

    # 2. Get all festivals
    print("Fetching festivals...")
    cur.execute("SELECT festival_id, festival_name, event_type FROM festivals ORDER BY festival_name")
    festivals = cur.fetchall()
    print(f"  {len(festivals)} festivals")

    # 3. Get detailed screening data with film info
    print("Fetching screenings with film and country data...")
    cur.execute("""
        SELECT
            f.film_id, f.title, f.year,
            fe.festival_id, fe.festival_name,
            s.event_year, s.status, s.category,
            c.country_name, c.country_code
        FROM screenings s
        JOIN films f ON s.film_id = f.film_id
        JOIN festivals fe ON s.festival_id = fe.festival_id
        LEFT JOIN film_countries fc ON f.film_id = fc.film_id
        LEFT JOIN countries c ON fc.country_id = c.country_id
        ORDER BY f.title, s.event_year
    """)
    screenings = cur.fetchall()
    print(f"  {len(screenings)} screening records")

    # 4. Get genre data for filtering
    print("Fetching genre data...")
    cur.execute("""
        SELECT f.film_id, g.genre_name
        FROM film_genres fg
        JOIN films f ON fg.film_id = f.film_id
        JOIN genres g ON fg.genre_id = g.genre_id
    """)
    genres = cur.fetchall()
    print(f"  {len(genres)} film-genre associations")

    cur.close()
    conn.close()

    # Build genre map
    film_genres = defaultdict(list)
    for g in genres:
        film_genres[str(g['film_id'])].append(g['genre_name'])
    all_genres = sorted(set(g['genre_name'] for g in genres))

    # Map festivals to countries
    festival_country = {}
    unmapped = []
    for fest in festivals:
        name = fest['festival_name']
        code = fuzzy_match_festival(name, FESTIVAL_COUNTRY_MAP)
        if code:
            festival_country[str(fest['festival_id'])] = code
        else:
            unmapped.append(name)

    mapped_count = len(festival_country)
    total = len(festivals)
    print(f"\nFestival mapping: {mapped_count}/{total} mapped ({100*mapped_count/total:.1f}%)")
    if unmapped:
        print(f"  Unmapped ({len(unmapped)}): {unmapped[:20]}...")

    # Save festival_countries.csv
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, 'festival_countries.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['festival_id', 'festival_name', 'country_code', 'country_name', 'mapped'])
        for fest in festivals:
            fid = str(fest['festival_id'])
            code = festival_country.get(fid, '')
            cname = COUNTRY_NAMES.get(code, '') if code else ''
            w.writerow([fid, fest['festival_name'], code, cname, 'yes' if code else 'no'])
    print(f"Saved festival mappings to {csv_path}")

    # ── Build geo_data.json ──────────────────────────────────────────────

    # Production country stats
    production_stats = {}
    for row in geo_mobility:
        code = row['production_country_code']
        if not code:
            continue
        top5 = row.get('top_5_festivals', [])
        if isinstance(top5, str):
            try:
                top5 = json.loads(top5)
            except:
                top5 = [top5]
        production_stats[code] = {
            'country': row['production_country'],
            'code': code,
            'film_count': row['film_count'],
            'total_screenings': row['total_screenings'],
            'festivals_reached': row['festivals_reached'],
            'avg_screenings': float(row['avg_screenings_per_film']),
            'avg_festivals': float(row['avg_festivals_per_film']),
            'awards': row['total_awards_won'],
            'nominations': row['total_nominations'],
            'year_range': [row['first_screening_year'], row['last_screening_year']],
            'top_festivals': top5[:5] if top5 else [],
        }

    # Screening country stats (by festival country)
    screening_by_country = defaultdict(lambda: {
        'screenings': 0, 'films': set(), 'festivals': set(), 'film_titles': []
    })

    # Flow data: production_country → screening_country
    flows = defaultdict(lambda: {'count': 0, 'films': set(), 'film_titles': []})

    # Year-based data for filtering and comparison
    year_data = defaultdict(lambda: {
        'production': defaultdict(lambda: {'films': set(), 'screenings': 0}),
        'screening': defaultdict(lambda: {'films': set(), 'screenings': 0}),
        'flows': defaultdict(lambda: {'films': set(), 'count': 0}),
    })

    for s in screenings:
        prod_code = s['country_code']
        fest_id = str(s['festival_id'])
        fest_code = festival_country.get(fest_id)
        film_id = str(s['film_id'])
        title = s['title']
        year = s['event_year'] or (s['year'] if s['year'] else None)

        if fest_code:
            screening_by_country[fest_code]['screenings'] += 1
            screening_by_country[fest_code]['films'].add(film_id)
            screening_by_country[fest_code]['festivals'].add(fest_id)
            if len(screening_by_country[fest_code]['film_titles']) < 50:
                if title not in screening_by_country[fest_code]['film_titles']:
                    screening_by_country[fest_code]['film_titles'].append(title)

        if prod_code and fest_code:
            flow_key = f"{prod_code}->{fest_code}"
            flows[flow_key]['count'] += 1
            flows[flow_key]['films'].add(film_id)
            if len(flows[flow_key]['film_titles']) < 20:
                if title not in flows[flow_key]['film_titles']:
                    flows[flow_key]['film_titles'].append(title)

            if year:
                yd = year_data[year]
                yd['production'][prod_code]['films'].add(film_id)
                yd['production'][prod_code]['screenings'] += 1
                yd['screening'][fest_code]['films'].add(film_id)
                yd['screening'][fest_code]['screenings'] += 1
                yd['flows'][flow_key]['films'].add(film_id)
                yd['flows'][flow_key]['count'] += 1

    # Serialize screening stats
    screening_stats = {}
    for code, data in screening_by_country.items():
        screening_stats[code] = {
            'country': COUNTRY_NAMES.get(code, code),
            'code': code,
            'screenings': data['screenings'],
            'unique_films': len(data['films']),
            'festivals': len(data['festivals']),
            'top_films': data['film_titles'][:10],
        }

    # Serialize flows
    flow_list = []
    for key, data in flows.items():
        src, dst = key.split('->')
        if src == dst:
            continue  # skip domestic
        flow_list.append({
            'source': src,
            'target': dst,
            'source_name': COUNTRY_NAMES.get(src, src),
            'target_name': COUNTRY_NAMES.get(dst, dst),
            'film_count': len(data['films']),
            'screening_count': data['count'],
            'top_films': data['film_titles'][:10],
        })
    flow_list.sort(key=lambda x: x['film_count'], reverse=True)

    # Domestic flows for context
    domestic_flows = []
    for key, data in flows.items():
        src, dst = key.split('->')
        if src == dst:
            domestic_flows.append({
                'country': src,
                'country_name': COUNTRY_NAMES.get(src, src),
                'film_count': len(data['films']),
                'screening_count': data['count'],
            })
    domestic_flows.sort(key=lambda x: x['film_count'], reverse=True)

    # Year snapshots for comparison
    year_snapshots = {}
    for year, yd in sorted(year_data.items()):
        year_snapshots[year] = {
            'production': {
                code: {'films': len(d['films']), 'screenings': d['screenings']}
                for code, d in yd['production'].items()
            },
            'screening': {
                code: {'films': len(d['films']), 'screenings': d['screenings']}
                for code, d in yd['screening'].items()
            },
            'flows': [
                {
                    'key': key,
                    'source': key.split('->')[0],
                    'target': key.split('->')[1],
                    'films': len(d['films']),
                    'screenings': d['count'],
                }
                for key, d in yd['flows'].items()
                if key.split('->')[0] != key.split('->')[1]
            ],
        }

    # Regional circulation analysis
    regional = {'within_europe': 0, 'europe_north_america': 0, 'europe_asia': 0, 'other': 0, 'total': 0}
    for f in flow_list:
        src_region = REGIONS.get(f['source'], 'Other')
        dst_region = REGIONS.get(f['target'], 'Other')
        count = f['film_count']
        regional['total'] += count
        if src_region == 'Europe' and dst_region == 'Europe':
            regional['within_europe'] += count
        elif (src_region == 'Europe' and dst_region == 'North America') or \
             (src_region == 'North America' and dst_region == 'Europe'):
            regional['europe_north_america'] += count
        elif (src_region == 'Europe' and dst_region == 'Asia') or \
             (src_region == 'Asia' and dst_region == 'Europe'):
            regional['europe_asia'] += count
        else:
            regional['other'] += count

    total_r = max(regional['total'], 1)
    regional_pct = {
        'within_europe': round(100 * regional['within_europe'] / total_r, 1),
        'europe_north_america': round(100 * regional['europe_north_america'] / total_r, 1),
        'europe_asia': round(100 * regional['europe_asia'] / total_r, 1),
        'other': round(100 * regional['other'] / total_r, 1),
    }

    # Key statistics
    top_producer = max(production_stats.values(), key=lambda x: x['film_count'])
    top_screener = max(screening_stats.values(), key=lambda x: x['screenings'])

    statistics = {
        'most_productive_country': {
            'country': top_producer['country'],
            'code': top_producer['code'],
            'film_count': top_producer['film_count'],
        },
        'most_active_screening_country': {
            'country': top_screener['country'],
            'code': top_screener['code'],
            'screenings': top_screener['screenings'],
        },
        'top_mobility_routes': [
            {
                'route': f"{f['source_name']} -> {f['target_name']}",
                'source': f['source'],
                'target': f['target'],
                'films': f['film_count'],
            }
            for f in flow_list[:10]
        ],
        'regional_circulation': regional_pct,
        'total_production_countries': len(production_stats),
        'total_screening_countries': len(screening_stats),
        'total_cross_border_flows': len(flow_list),
        'festival_mapping_coverage': f"{mapped_count}/{total} ({100*mapped_count/total:.1f}%)",
    }

    # Film-level data for filtering (compact)
    film_index = {}
    for s in screenings:
        fid = str(s['film_id'])
        if fid not in film_index:
            film_index[fid] = {
                'title': s['title'],
                'year': s['year'],
                'countries': [],
                'genres': film_genres.get(fid, []),
            }
        if s['country_code'] and s['country_code'] not in film_index[fid]['countries']:
            film_index[fid]['countries'].append(s['country_code'])

    # Build final JSON
    geo_data = {
        'production': production_stats,
        'screening': screening_stats,
        'flows': flow_list,
        'domestic_flows': domestic_flows,
        'year_snapshots': year_snapshots,
        'statistics': statistics,
        'genres': all_genres,
        'film_index': film_index,
        'unmapped_festivals': unmapped[:30],
        'data_completeness': {
            'festivals_mapped': mapped_count,
            'festivals_total': total,
            'coverage_pct': round(100 * mapped_count / total, 1),
        },
    }

    # Save JSON
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'geo-viz', 'public')
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, 'geo_data.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(geo_data, f, indent=2, default=str)
    print(f"\nSaved geo_data.json ({os.path.getsize(json_path)/1024:.0f} KB) to {json_path}")

    # Also save to viz/ for standalone HTML
    viz_dir = os.path.join(os.path.dirname(__file__), '..', 'viz')
    os.makedirs(viz_dir, exist_ok=True)
    viz_json = os.path.join(viz_dir, 'geo_data.json')
    with open(viz_json, 'w', encoding='utf-8') as f:
        json.dump(geo_data, f, indent=2, default=str)
    print(f"Saved geo_data.json copy to {viz_json}")

    # ── Generate report ──────────────────────────────────────────────────
    generate_report(geo_data, production_stats, screening_stats, flow_list,
                    domestic_flows, regional_pct, year_snapshots)

    print("\nDone!")


def generate_report(geo_data, production_stats, screening_stats, flow_list,
                    domestic_flows, regional_pct, year_snapshots):
    """Generate the geographic mobility analysis report."""
    reports_dir = os.path.join(os.path.dirname(__file__), '..', 'reports')
    os.makedirs(reports_dir, exist_ok=True)
    path = os.path.join(reports_dir, 'geographic_mobility.txt')

    lines = []
    lines.append("=" * 70)
    lines.append("GEOGRAPHIC MOBILITY ANALYSIS")
    lines.append("Short Film Festival Network - Encounters Dataset")
    lines.append(f"Generated: {date.today().isoformat()}")
    lines.append("=" * 70)

    # Section 1: Central Countries
    lines.append("\n1. MOST CENTRAL COUNTRIES IN THE FESTIVAL NETWORK")
    lines.append("-" * 50)
    lines.append("\nBy Production (films produced):")
    for i, (code, data) in enumerate(
            sorted(production_stats.items(), key=lambda x: x[1]['film_count'], reverse=True)[:15]):
        lines.append(f"  {i+1:2}. {data['country']:30} {data['film_count']:4} films  "
                      f"{data['total_screenings']:5} screenings  {data['festivals_reached']:3} festivals")

    lines.append("\nBy Screening (festival screenings hosted):")
    for i, (code, data) in enumerate(
            sorted(screening_stats.items(), key=lambda x: x[1]['screenings'], reverse=True)[:15]):
        lines.append(f"  {i+1:2}. {data['country']:30} {data['screenings']:5} screenings  "
                      f"{data['unique_films']:4} films  {data['festivals']:3} festivals")

    # Section 2: Regional Circulation
    lines.append("\n\n2. REGIONAL CIRCULATION PATTERNS")
    lines.append("-" * 50)
    lines.append(f"\n  Within Europe:              {regional_pct['within_europe']:5.1f}%")
    lines.append(f"  Europe <-> North America:   {regional_pct['europe_north_america']:5.1f}%")
    lines.append(f"  Europe <-> Asia:            {regional_pct['europe_asia']:5.1f}%")
    lines.append(f"  Other routes:               {regional_pct['other']:5.1f}%")

    lines.append("\n  Interpretation:")
    if regional_pct['within_europe'] > 50:
        lines.append("  Films circulate predominantly within Europe, confirming a strong")
        lines.append("  intra-European festival circuit. The UK-centric dataset (Encounters)")
        lines.append("  naturally biases toward European connections, but the pattern is")
        lines.append("  consistent with known festival network structures.")
    else:
        lines.append("  Significant cross-regional mobility detected.")

    # Section 3: Top Routes
    lines.append("\n\n3. TOP INTERNATIONAL MOBILITY ROUTES")
    lines.append("-" * 50)
    for i, f in enumerate(flow_list[:20]):
        src_region = REGIONS.get(f['source'], '?')
        dst_region = REGIONS.get(f['target'], '?')
        cross = " *" if src_region != dst_region else ""
        lines.append(f"  {i+1:2}. {f['source_name']:25} -> {f['target_name']:25} "
                      f"{f['film_count']:4} films  ({f['screening_count']:5} screenings){cross}")
    lines.append("  (* = cross-regional)")

    lines.append("\n  Domestic circulation (films screening in home country):")
    for d in domestic_flows[:10]:
        lines.append(f"    {d['country_name']:30} {d['film_count']:4} films  {d['screening_count']:5} screenings")

    # Section 4: Temporal Changes
    lines.append("\n\n4. GEOGRAPHIC MOBILITY OVER TIME (PRE/POST COVID)")
    lines.append("-" * 50)

    pre_covid = {'countries': set(), 'flows': 0, 'screenings': 0}
    post_covid = {'countries': set(), 'flows': 0, 'screenings': 0}

    for year, snap in year_snapshots.items():
        try:
            y = int(year)
        except:
            continue
        bucket = pre_covid if y < 2020 else post_covid
        for code in snap['production']:
            bucket['countries'].add(code)
        bucket['flows'] += len(snap.get('flows', []))
        bucket['screenings'] += sum(d['screenings'] for d in snap['production'].values())

    lines.append(f"\n  Pre-COVID (2015-2019):")
    lines.append(f"    Production countries active: {len(pre_covid['countries'])}")
    lines.append(f"    Cross-border flows:          {pre_covid['flows']}")
    lines.append(f"    Total screenings:            {pre_covid['screenings']}")
    lines.append(f"\n  COVID Era & Recovery (2020-2025):")
    lines.append(f"    Production countries active: {len(post_covid['countries'])}")
    lines.append(f"    Cross-border flows:          {post_covid['flows']}")
    lines.append(f"    Total screenings:            {post_covid['screenings']}")

    if pre_covid['screenings'] > 0 and post_covid['screenings'] > 0:
        ratio = post_covid['screenings'] / pre_covid['screenings']
        if ratio > 1:
            lines.append(f"\n  Post-COVID screening volume is {ratio:.1f}x pre-COVID levels.")
        else:
            lines.append(f"\n  Post-COVID screening volume is {ratio:.1f}x pre-COVID levels (decline).")

    # Section 5: UK Focus
    lines.append("\n\n5. UK-SPECIFIC ANALYSIS")
    lines.append("-" * 50)

    uk_prod = production_stats.get('GB', {})
    lines.append(f"\n  UK Production:")
    lines.append(f"    Films produced:         {uk_prod.get('film_count', 0)}")
    lines.append(f"    Total screenings:       {uk_prod.get('total_screenings', 0)}")
    lines.append(f"    Festivals reached:      {uk_prod.get('festivals_reached', 0)}")
    lines.append(f"    Awards won:             {uk_prod.get('awards', 0)}")

    lines.append(f"\n  Where UK Films Travel (top destinations):")
    uk_outbound = [f for f in flow_list if f['source'] == 'GB']
    for i, f in enumerate(uk_outbound[:15]):
        lines.append(f"    {i+1:2}. {f['target_name']:30} {f['film_count']:4} films")

    lines.append(f"\n  Which Countries' Films Come to UK Festivals:")
    uk_inbound = [f for f in flow_list if f['target'] == 'GB']
    for i, f in enumerate(uk_inbound[:15]):
        lines.append(f"    {i+1:2}. {f['source_name']:30} {f['film_count']:4} films")

    uk_screen = screening_stats.get('GB', {})
    lines.append(f"\n  UK as Screening Destination:")
    lines.append(f"    Total screenings:       {uk_screen.get('screenings', 0)}")
    lines.append(f"    Unique films screened:   {uk_screen.get('unique_films', 0)}")
    lines.append(f"    Festivals in UK:        {uk_screen.get('festivals', 0)}")

    # Data notes
    lines.append("\n\n" + "=" * 70)
    lines.append("DATA NOTES")
    lines.append("=" * 70)
    dc = geo_data['data_completeness']
    lines.append(f"  Festival location coverage: {dc['festivals_mapped']}/{dc['festivals_total']} "
                  f"({dc['coverage_pct']}%)")
    lines.append("  Festival locations based on known major festivals and city/country")
    lines.append("  keyword matching. Some smaller festivals may have inferred locations.")
    lines.append("  All 754 films screened at Encounters (Bristol, UK) as the anchor festival.")
    lines.append("  Production country data from film metadata (ISO 3166-1 alpha-2 codes).")

    report = '\n'.join(lines)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f"\nSaved report to {path}")
    print("\nReport preview:")
    print(report[:2000])


if __name__ == '__main__':
    main()
