(function(global) {
    const PerformanceConnectionsRepo = {
        getConnections: async function(clienteId) {
            if (!global.supabaseClient || !clienteId) return [];
            const { data, error } = await global.supabaseClient
                .from('client_platform_connections')
                .select('*')
                .eq('client_id', clienteId)
                .order('platform', { ascending: true });
            if (error) {
                console.error('[PerformanceConnectionsRepo] getConnections error:', error);
                return [];
            }
            return data || [];
        },

        upsertConnection: async function(clienteId, platform, patch) {
            if (!global.supabaseClient || !clienteId || !platform) return { ok: false };
            const tenantId = global.TenantContext?.getTenantId ? global.TenantContext.getTenantId() : null;
            const payload = {
                client_id: clienteId,
                platform,
                ...(tenantId ? { tenant_id: tenantId } : {}),
                ...(patch || {}),
                updated_at: new Date().toISOString()
            };
            const { data, error } = await global.supabaseClient
                .from('client_platform_connections')
                .upsert(payload, { onConflict: 'client_id,platform' })
                .select('*')
                .single();
            if (error) {
                console.error('[PerformanceConnectionsRepo] upsertConnection error:', error);
                return { ok: false, error };
            }
            return { ok: true, data };
        },

        disconnect: async function(clienteId, platform) {
            return await this.upsertConnection(clienteId, platform, {
                connection_status: 'disconnected',
                external_account_id: null,
                external_business_id: null,
                manager_account_id: null,
                organization_id: null,
                scopes: [],
                last_sync_at: null
            });
        }
    };

    global.PerformanceConnectionsRepo = PerformanceConnectionsRepo;
})(window);
