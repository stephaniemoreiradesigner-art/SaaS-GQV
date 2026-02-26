window.supabaseClient = window.supabaseClient || null;

function initializeSupabase() {
    if (window.supabaseClient) {
        console.log('[Supabase] Client Initialized');
        return;
    }
    if (typeof window.initSupabase === 'function') {
        window.initSupabase();
        return;
    }
    console.error('[Supabase] SDK not loaded.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSupabase);
} else {
    initializeSupabase();
}
