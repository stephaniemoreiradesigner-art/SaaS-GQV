const loadClientSupabaseConfig = async () => {
    if (window.clientSupabaseConfig) return window.clientSupabaseConfig;
    try {
        const response = await fetch('/config');
        if (!response.ok) return null;
        const data = await response.json();
        if (!data?.supabaseUrl || !data?.supabaseAnonKey || data?.missing) return null;
        window.clientSupabaseConfig = { supabaseUrl: data.supabaseUrl, supabaseAnonKey: data.supabaseAnonKey };
        return window.clientSupabaseConfig;
    } catch (error) {
        console.error('Erro ao carregar /config', error);
        return null;
    }
};

const initClientSupabase = async () => {
    if (window.supabaseClient) return window.supabaseClient;
    if (!window.supabase) return null;
    const config = await loadClientSupabaseConfig();
    if (!config) return null;
    window.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    return window.supabaseClient;
};

const normalizeRole = (value) => String(value || '').trim().toLowerCase();

const setClientName = (value) => {
    const name = value || 'Cliente';
    const nodes = document.querySelectorAll('[data-client-name]');
    nodes.forEach(node => { node.textContent = name; });
};

const toggleSidebar = (open) => {
    const sidebar = document.getElementById('client-sidebar');
    const overlay = document.getElementById('client-sidebar-overlay');
    if (!sidebar || !overlay) return;
    const shouldOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('translate-x-0');
    if (shouldOpen) {
        sidebar.classList.add('translate-x-0');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.remove('translate-x-0');
        overlay.classList.add('hidden');
    }
};

const setupClientNavigation = () => {
    const toggleBtn = document.getElementById('client-menu-toggle');
    const overlay = document.getElementById('client-sidebar-overlay');
    if (toggleBtn) toggleBtn.addEventListener('click', () => toggleSidebar());
    if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));
};

const setupClientLogout = () => {
    const btn = document.getElementById('client-logout');
    if (!btn || !window.supabaseClient) return;
    btn.addEventListener('click', async () => {
        await window.supabaseClient.auth.signOut();
        window.location.href = '/client/login';
    });
};

const ensureClientAccess = async () => {
    const client = await initClientSupabase();
    if (!client) return;
    const { data } = await client.auth.getSession();
    const session = data?.session || null;
    if (!session) {
        window.location.href = '/client/login';
        return;
    }
    const user = session.user;
    let profile = null;
    try {
        const { data: profileData } = await client
            .from('profiles')
            .select('role,full_name,tenant_id')
            .eq('id', user.id)
            .maybeSingle();
        profile = profileData || null;
    } catch (error) {
        console.warn('Erro ao buscar perfil', error);
    }
    const role = normalizeRole(profile?.role || user?.user_metadata?.role || user?.app_metadata?.role);
    if (role !== 'client') {
        window.location.href = '/dashboard.html';
        return;
    }
    setClientName(profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Cliente');
    const content = document.getElementById('client-content');
    if (content) content.classList.remove('opacity-0');
    setupClientNavigation();
    setupClientLogout();
    client.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = '/client/login';
        }
    });
};

document.addEventListener('DOMContentLoaded', () => {
    ensureClientAccess();
});
