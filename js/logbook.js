// AJUSTE PARAMETROS RPC AQUI:
// - Se os nomes das RPCs ou parâmetros forem diferentes, ajuste em addAction/closeEntry.
// - Se o schema de tabela for diferente, ajuste em listActionsByClient.
window.Logbook = (() => {
    const formatModuleLabel = (module) => {
        const map = {
            social_media: 'Social Media',
            trafego_pago: 'Tráfego Pago',
            automacoes: 'Automações'
        };
        return map[module] || module || '-';
    };

    const addAction = async (payload) => {
        try {
            if (!window.supabaseClient) return null;
            const clienteId = payload?.clienteId || payload?.cliente_id;
            if (!clienteId) return null;

            const rpcPayload = {
                cliente_id: clienteId,
                module: payload?.module,
                action_type: payload?.actionType || payload?.action_type,
                title: payload?.title,
                details: payload?.details,
                ref_type: payload?.refType || payload?.ref_type,
                ref_id: payload?.refId || payload?.ref_id
            };

            const { data, error } = await window.supabaseClient.rpc('add_action', rpcPayload);
            if (error) {
                console.warn('Logbook addAction falhou:', error);
                return null;
            }
            return data || null;
        } catch (err) {
            console.warn('Logbook addAction falhou:', err);
            return null;
        }
    };

    const closeEntry = async ({ entryId }) => {
        try {
            if (!window.supabaseClient) return null;
            if (!entryId) return null;
            const { data, error } = await window.supabaseClient.rpc('close_entry', { entry_id: entryId });
            if (error) {
                console.warn('Logbook closeEntry falhou:', error);
                return null;
            }
            return data || true;
        } catch (err) {
            console.warn('Logbook closeEntry falhou:', err);
            return null;
        }
    };

    const listActionsByClient = async (clienteId) => {
        if (!window.supabaseClient || !clienteId) return [];
        const normalize = (items) => {
            return (items || []).map((item) => ({
                created_at: item.created_at,
                module: item.module || item.origin || item.modulo,
                action_type: item.action_type || item.tipo_acao,
                title: item.title || item.titulo,
                details: item.details || item.detalhes || item.note
            }));
        };

        try {
            const { data, error } = await window.supabaseClient
                .from('logbook_actions')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return normalize(data);
        } catch (err) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('actions')
                    .select('*')
                    .eq('cliente_id', clienteId)
                    .order('created_at', { ascending: false })
                    .limit(50);
                if (error) throw error;
                return normalize(data);
            } catch (fallbackErr) {
                console.warn('Logbook listActionsByClient falhou:', fallbackErr);
                return [];
            }
        }
    };

    return {
        addAction,
        closeEntry,
        listActionsByClient,
        formatModuleLabel
    };
})();
