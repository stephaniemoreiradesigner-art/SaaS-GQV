(() => {
    window.API_BASE_URL = window.API_BASE_URL || 'https://api.gestaoquevende.cloud';
    const getSupabaseClient = async () => {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof window.initSupabase === 'function') {
            const ok = await window.initSupabase();
            if (ok && window.supabaseClient) return window.supabaseClient;
        }
        return null;
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
        const response = await fetch(`${window.API_BASE_URL}/api/me/context`, {
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

    window.setActiveClientId = (clienteId) => {
        const value = String(clienteId || '').trim();
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return false;
        const normalized = String(Math.trunc(parsed));
        window.currentClienteId = normalized;
        localStorage.setItem('GQV_ACTIVE_CLIENT_ID', normalized);
        return true;
    };

    window.getActiveClientId = () => {
        const current = String(window.currentClienteId || '').trim();
        if (current) return current;
        const stored = String(localStorage.getItem('GQV_ACTIVE_CLIENT_ID') || '').trim();
        if (stored) {
            window.currentClienteId = stored;
            return stored;
        }
        return '';
    };

    window.clientApp = {
        getSupabaseClient,
        requireClientAuth,
        clientLogout
    };

    window.getMeContext = getMeContext;
})();
