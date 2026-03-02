(() => {
    window.API_BASE_URL = window.API_BASE_URL || 'https://api.gestaoquevende.cloud';
    let supabaseConfigPromise = null;

    const loadClientSupabaseConfig = async () => {
        if (window.supabaseConfig) return window.supabaseConfig;
        if (supabaseConfigPromise) return supabaseConfigPromise;

        supabaseConfigPromise = fetch('/config')
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Falha ao carregar /config: ${response.status}`);
                }
                return response.json();
            })
            .then((data) => {
                const supabaseUrl = data?.supabaseUrl;
                const supabaseAnonKey = data?.supabaseAnonKey;
                if (data?.missing || !supabaseUrl || !supabaseAnonKey) {
                    return null;
                }
                window.supabaseConfig = { supabaseUrl, supabaseAnonKey };
                return window.supabaseConfig;
            })
            .catch(() => null);

        return supabaseConfigPromise;
    };

    const getSupabaseClient = async () => {
        if (window.supabaseClient) return window.supabaseClient;
        if (!window.supabase) return null;
        if (!window.supabaseConfig) {
            const config = await loadClientSupabaseConfig();
            if (!config) return null;
        }
        window.supabaseClient = window.supabase.createClient(
            window.supabaseConfig.supabaseUrl,
            window.supabaseConfig.supabaseAnonKey
        );
        return window.supabaseClient;
    };

    const getSession = async () => {
        const supabase = await getSupabaseClient();
        if (!supabase) return null;
        const sessionResult = await supabase.auth.getSession();
        return sessionResult?.data?.session || null;
    };

    const fetchJson = async (url, options = {}) => {
        const res = await fetch(url, options);
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        return { ok: res.ok, status: res.status, data };
    };

    const ensureClientSession = async () => {
        const session = await getSession();
        const accessToken = session?.access_token;
        if (!accessToken) {
            window.location.href = 'client_login.html';
            return null;
        }

        const { ok, data, status } = await fetchJson(`${window.API_BASE_URL}/api/client/me`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!ok) {
            if ([401, 403].includes(status)) {
                window.location.href = 'client_login.html';
                return null;
            }
            return null;
        }

        window.currentTenantId = data?.tenant_id || null;
        window.currentClientIds = Array.isArray(data?.client_ids) ? data.client_ids : [];
        return data;
    };

    const clientLogout = async () => {
        const supabase = await getSupabaseClient();
        if (supabase) await supabase.auth.signOut();
        window.location.href = 'client_login.html';
    };

    window.clientSession = {
        getSupabaseClient,
        ensureClientSession,
        clientLogout
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureClientSession);
    } else {
        ensureClientSession();
    }
})();
