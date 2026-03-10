(function(global) {
    let schemaCache = null;
    let schemaInFlight = null;
    let warnedMissingTable = false;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = (value) => UUID_RE.test(String(value || '').trim());
    const isNumeric = (value) => /^-?\d+$/.test(String(value || '').trim());

    const isMissingTableError = (error) => {
        const msg = String(error?.message || '');
        return error?.code === 'PGRST106' || msg.includes('schema cache') || msg.includes('Could not find the table');
    };

    const detectSchema = async () => {
        if (schemaCache) return schemaCache;
        if (schemaInFlight) return await schemaInFlight;
        if (!global.supabaseClient) return null;

        schemaInFlight = (async () => {
            const { error } = await global.supabaseClient
                .from('client_platform_connections')
                .select('id')
                .limit(1);

            if (error && isMissingTableError(error)) {
                schemaCache = { missing: true };
                if (!warnedMissingTable) {
                    warnedMissingTable = true;
                    console.warn('[PerformanceConnectionsRepo] Tabela client_platform_connections não existe no Supabase. Módulo de conexões ficará inativo.');
                }
                return schemaCache;
            }

            schemaCache = {
                missing: false,
                clientColumn: null
            };
            return schemaCache;
        })();

        try {
            return await schemaInFlight;
        } finally {
            schemaInFlight = null;
        }
    };

    const buildClientColumnCandidates = (clienteId) => {
        if (isUuid(clienteId)) return ['cliente_id', 'client_id_uuid', 'client_uuid', 'client_id'];
        if (isNumeric(clienteId)) return ['client_id', 'cliente_id', 'client_id_uuid', 'client_uuid'];
        return ['client_id', 'cliente_id', 'client_id_uuid', 'client_uuid'];
    };

    const resolveClientValue = (column, raw) => {
        if (column === 'client_id') {
            return isNumeric(raw) ? Number(raw) : raw;
        }
        return String(raw).trim();
    };

    const resolveTenantPatch = () => {
        const ctx = global.TenantContext?.get ? global.TenantContext.get() : null;
        const tenantId = ctx?.tenantId;
        if (Number.isFinite(tenantId)) {
            return { tenant_id: tenantId };
        }
        return {};
    };

    const PerformanceConnectionsRepo = {
        getConnections: async function(clienteId) {
            if (!global.supabaseClient || !clienteId) return [];
            const schema = await detectSchema();
            if (!schema || schema.missing) return [];

            const candidates = schema.clientColumn ? [schema.clientColumn] : buildClientColumnCandidates(clienteId);
            for (const column of candidates) {
                const value = resolveClientValue(column, clienteId);
                console.log('[PerformanceConnectionsRepo] getConnections filter:', { column, value, raw: clienteId });
                const { data, error } = await global.supabaseClient
                    .from('client_platform_connections')
                    .select('*')
                    .eq(column, value)
                    .order('platform', { ascending: true });
                if (!error) {
                    schema.clientColumn = column;
                    return data || [];
                }
                if (isMissingTableError(error)) return [];
                const msg = String(error?.message || '');
                const shouldRetry =
                    error?.code === '42883' ||
                    error?.code === '42703' ||
                    msg.includes('bigint = uuid') ||
                    msg.includes('does not exist') ||
                    msg.includes('invalid input syntax');
                if (!shouldRetry) {
                    console.error('[PerformanceConnectionsRepo] getConnections error:', error);
                    return [];
                }
            }

            return [];
        },

        upsertConnection: async function(clienteId, platform, patch) {
            if (!global.supabaseClient || !clienteId || !platform) return { ok: false };
            const schema = await detectSchema();
            if (!schema || schema.missing) return { ok: false, reason: 'missing_table' };

            const candidates = schema.clientColumn ? [schema.clientColumn] : buildClientColumnCandidates(clienteId);
            for (const column of candidates) {
                const value = resolveClientValue(column, clienteId);
                const basePayload = {
                    [column]: value,
                    platform,
                    ...(patch || {}),
                    updated_at: new Date().toISOString()
                };
                const payloadWithTenant = { ...basePayload, ...resolveTenantPatch() };
                console.log('[PerformanceConnectionsRepo] upsertConnection payload:', { clientColumn: column, clientValue: value, platform });

                const attempt = async (payload) => {
                    return await global.supabaseClient
                        .from('client_platform_connections')
                        .upsert(payload, { onConflict: `${column},platform` })
                        .select('*')
                        .single();
                };

                let result = await attempt(payloadWithTenant);
                if (result.error && (result.error?.code === '42703' || String(result.error?.message || '').includes('does not exist'))) {
                    result = await attempt(basePayload);
                }

                if (!result.error) {
                    schema.clientColumn = column;
                    return { ok: true, data: result.data };
                }
                if (isMissingTableError(result.error)) return { ok: false, reason: 'missing_table' };

                const msg = String(result.error?.message || '');
                const shouldRetry =
                    result.error?.code === '42883' ||
                    result.error?.code === '42703' ||
                    msg.includes('bigint = uuid') ||
                    msg.includes('does not exist') ||
                    msg.includes('invalid input syntax');
                if (!shouldRetry) {
                    console.error('[PerformanceConnectionsRepo] upsertConnection error:', result.error);
                    return { ok: false, error: result.error };
                }
            }

            return { ok: false, reason: 'no_compatible_schema' };
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
