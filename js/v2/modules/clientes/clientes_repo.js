(function(global) {
    const ClientesRepo = {
        getClients: async function() {
            try {
                const supabase = global.supabaseClient || null;
                const sessionRes = supabase?.auth?.getSession ? await supabase.auth.getSession() : { data: { session: null } };
                const accessToken = sessionRes?.data?.session?.access_token || '';

                const headers = {};
                if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

                const res = await fetch('/api/clients/list', { method: 'GET', headers });
                const json = await res.json().catch(() => null);
                if (!res.ok) {
                    console.error('[ClientesRepo] getClients error:', {
                        status: res.status,
                        error: json?.error || null
                    });
                    return [];
                }

                const list = Array.isArray(json?.clients) ? json.clients : [];
                return list
                    .map((c) => {
                        const id = String(c?.id || '').trim();
                        const nome = String(c?.nome || '').trim();
                        if (!id || !nome) return null;
                        return {
                            id,
                            nome,
                            nome_fantasia: nome,
                            nome_empresa: nome,
                            link_grupo: c?.link_grupo ? String(c.link_grupo) : ''
                        };
                    })
                    .filter(Boolean);
            } catch (error) {
                console.error('[ClientesRepo] getClients fatal:', error);
                return [];
            }
        }
    };

    global.ClientesRepo = ClientesRepo;
})(window);

