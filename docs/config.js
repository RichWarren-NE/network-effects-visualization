// Network Effects — Supabase Configuration
// This file is shared by all visualisation pages.
// The anon key is safe to expose — RLS policies restrict access to read-only.

const SUPABASE_URL = 'https://rwcqsajnwoedsbmfzxza.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3Y3FzYWpud29lZHNibWZ6eHphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNTE0NTAsImV4cCI6MjA4NTkyNzQ1MH0.Y-eeEJwL2OLKI4DfewkDJYfq4N7mLVhR5F-xa6mbcWE';

async function supabaseQuery(endpoint, params = '') {
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}?${params}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact'
    }
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status} ${res.statusText}`);
  const count = res.headers.get('content-range');
  const data = await res.json();
  return { data, totalCount: count ? parseInt(count.split('/')[1]) : data.length };
}
