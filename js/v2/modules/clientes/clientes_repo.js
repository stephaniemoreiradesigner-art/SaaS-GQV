(function(global) {
    const ClientRepo = {
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
        },

        getClientById: async function(id) {
            try {
                const supabase = global.supabaseClient || null;
                const rawId = String(id || '').trim();
                if (!supabase || !rawId) return null;
                const { data, error } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('id', rawId)
                    .maybeSingle();
                if (error) {
                    console.error('[ClientRepo] getClientById error:', error);
                    return null;
                }
                return data || null;
            } catch (error) {
                console.error('[ClientRepo] getClientById fatal:', error);
                return null;
            }
        },

        createClient: async function(payload) {
            try {
                const supabase = global.supabaseClient || null;
                if (!supabase) return { data: null, error: new Error('missing_supabase') };
                const input = payload && typeof payload === 'object' ? payload : {};
                const { data, error } = await supabase
                    .from('clientes')
                    .insert(input)
                    .select('*')
                    .maybeSingle();
                if (error) return { data: null, error };
                return { data: data || null, error: null };
            } catch (error) {
                console.error('[ClientRepo] createClient fatal:', error);
                return { data: null, error };
            }
        },

        updateClient: async function(id, payload) {
            try {
                const supabase = global.supabaseClient || null;
                const rawId = String(id || '').trim();
                if (!supabase || !rawId) return { data: null, error: new Error('missing_params') };
                const input = payload && typeof payload === 'object' ? payload : {};
                const { data, error } = await supabase
                    .from('clientes')
                    .update(input)
                    .eq('id', rawId)
                    .select('*')
                    .maybeSingle();
                if (error) return { data: null, error };
                return { data: data || null, error: null };
            } catch (error) {
                console.error('[ClientRepo] updateClient fatal:', error);
                return { data: null, error };
            }
        }
    };

    global.ClientRepo = ClientRepo;
    global.ClientesRepo = ClientRepo;
})(window);
