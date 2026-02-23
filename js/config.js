const SUPABASE_URL = 'https://gbqknmejsmnizjdnopnq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicWtubWVqc21uaXpqZG5vcG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjkyOTMsImV4cCI6MjA3ODgwNTI5M30.w-v_CW3X5DF9x_nnFe3Lhvw_JyrXxfXKv7tPIZAjGaU';

window.supabaseClient = null;

function initializeSupabase() {
    if (window.supabase) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('[Supabase] Client Initialized');
    } else {
        console.error('[Supabase] SDK not loaded.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSupabase);
} else {
    initializeSupabase();
}
