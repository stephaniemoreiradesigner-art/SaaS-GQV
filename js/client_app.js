(() => {
    const loadConfig = async () => {
        if (window.supabaseConfig) return window.supabaseConfig;
        if (typeof window.loadSupabaseConfig === 'function') {
            const config = await window.loadSupabaseConfig();
            if (config) return config;
        }
        try {
            const response = await fetch('/config');
            if (!response.ok) return null;
            const data = await response.json();
            if (!data?.supabaseUrl || !data?.supabaseAnonKey || data?.missing) return null;
            window.supabaseConfig = { supabaseUrl: data.supabaseUrl, supabaseAnonKey: data.supabaseAnonKey };
            return window.supabaseConfig;
        } catch (error) {
            return null;
        }
    };

    const getSupabaseClient = async () => {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof window.initSupabase === 'function') {
            const ok = await window.initSupabase();
            if (ok && window.supabaseClient) return window.supabaseClient;
        }
        if (!window.supabase) return null;
        const config = await loadConfig();
        if (!config) return null;
        window.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: {
                storageKey: 'gqv_client_auth',
                persistSession: true,
                autoRefreshToken: true
            }
        });
        return window.supabaseClient;
    };

    const requireClientAuth = async (redirectTo = 'client_login.html') => {
        const supabase = await getSupabaseClient();
        if (!supabase) {
            window.location.href = redirectTo;
            return false;
        }
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session) {
            window.location.href = redirectTo;
            return false;
        }
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .maybeSingle();
        const normalizedRole = String(profile?.role || '').trim().toLowerCase();
        const isClientRole = normalizedRole === 'client' || normalizedRole === 'cliente';
        if (error || !isClientRole) {
            alert('Acesso restrito ao painel do cliente.');
            await supabase.auth.signOut();
            window.location.href = redirectTo;
            return false;
        }
        return true;
    };

    const clientLogout = async () => {
        const supabase = await getSupabaseClient();
        if (supabase) await supabase.auth.signOut();
        window.location.href = 'client_login.html';
    };

    const getMeContext = async () => {
        const supabase = await getSupabaseClient();
        if (!supabase) throw new Error('supabase_nao_inicializado');
        const { data } = await supabase.auth.getSession();
        const accessToken = data?.session?.access_token || '';
        if (!accessToken) throw new Error('unauthorized');
        const response = await fetch('/api/me/context', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            const errorMessage = payload?.error || 'erro_ao_buscar_contexto';
            const error = new Error(errorMessage);
            error.payload = payload;
            throw error;
        }
        return payload;
    };

    window.clientApp = {
        getSupabaseClient,
        requireClientAuth,
        clientLogout
    };

    window.getMeContext = getMeContext;
})();
