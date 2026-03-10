(function(global) {
    let schemaCache = null;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isUuid = (value) => UUID_RE.test(String(value || '').trim());
    const isNumeric = (value) => /^-?\d+$/.test(String(value || '').trim());

    const detectSchema = async () => {
        if (schemaCache) return schemaCache;
        if (!global.supabaseClient) return null;

        const testColumn = async (column) => {
            const { error } = await global.supabaseClient
                .from('client_platform_connections')
                .select(column)
                .limit(1);
            return !error;
        };

        const columns = {};
        const candidates = [
            'tenant_id',
            'tenant_uuid',
            'tenant_id_uuid',
            'user_id',
            'client_id',
            'client_uuid',
            'client_id_uuid',
            'cliente_id',
            'platform',
            'updated_at'
        ];

        for (const column of candidates) {
            columns[column] = await testColumn(column);
        }

        const tenantUuidColumn =
            (columns.tenant_id_uuid && 'tenant_id_uuid') ||
            (columns.tenant_uuid && 'tenant_uuid') ||
            null;

        const tenantIdColumn = columns.tenant_id ? 'tenant_id' : null;

        const clientUuidColumn =
            (columns.client_id_uuid && 'client_id_uuid') ||
            (columns.client_uuid && 'client_uuid') ||
            (columns.cliente_id && 'cliente_id') ||
            null;

        const clientIdColumn = columns.client_id ? 'client_id' : null;

        const onConflict =
            (clientUuidColumn && `${clientUuidColumn},platform`) ||
            (clientIdColumn && `${clientIdColumn},platform`) ||
            'platform';

        schemaCache = {
            columns,
            tenantUuidColumn,
            tenantIdColumn,
            clientUuidColumn,
            clientIdColumn,
            onConflict
        };

        console.log('[PerformanceConnectionsRepo] Schema detectado:', schemaCache);
        return schemaCache;
    };

    const resolveClientFilter = (schema, clientId) => {
        const raw = clientId;
        const isUuidValue = isUuid(raw);
        if (isUuidValue && schema?.clientUuidColumn) return { column: schema.clientUuidColumn, value: String(raw).trim() };
        if (!isUuidValue && schema?.clientIdColumn) return { column: schema.clientIdColumn, value: isNumeric(raw) ? Number(raw) : raw };
        if (schema?.clientUuidColumn) return { column: schema.clientUuidColumn, value: String(raw).trim() };
        if (schema?.clientIdColumn) return { column: schema.clientIdColumn, value: isNumeric(raw) ? Number(raw) : raw };
        return { column: 'client_id', value: raw };
    };

    const resolveTenantPatch = (schema) => {
        const ctx = global.TenantContext?.get ? global.TenantContext.get() : null;
        const tenantId = ctx?.tenantId;
        const tenantUuid = ctx?.tenantUuid;

        const patch = {};
        if (schema?.tenantUuidColumn && tenantUuid && isUuid(tenantUuid)) {
            patch[schema.tenantUuidColumn] = tenantUuid;
        }
        if (schema?.tenantIdColumn && Number.isFinite(tenantId)) {
            patch[schema.tenantIdColumn] = tenantId;
        }
        return patch;
    };

    const PerformanceConnectionsRepo = {
        getConnections: async function(clienteId) {
            if (!global.supabaseClient || !clienteId) return [];
            const schema = await detectSchema();
            const primary = resolveClientFilter(schema, clienteId);
            console.log('[PerformanceConnectionsRepo] getConnections filter:', { column: primary.column, value: primary.value, raw: clienteId });

            const attempt = async (filter) => {
                return await global.supabaseClient
                    .from('client_platform_connections')
                    .select('*')
                    .eq(filter.column, filter.value)
                    .order('platform', { ascending: true });
            };

            const result1 = await attempt(primary);
            if (!result1.error) return result1.data || [];

            const isTypeMismatch = String(result1.error?.message || '').includes('bigint = uuid') || result1.error?.code === '42883';
            let fallback = null;
            if (primary.column === schema?.clientIdColumn && schema?.clientUuidColumn) {
                fallback = { column: schema.clientUuidColumn, value: String(clienteId).trim() };
            } else if (primary.column === schema?.clientUuidColumn && schema?.clientIdColumn) {
                fallback = { column: schema.clientIdColumn, value: isNumeric(clienteId) ? Number(clienteId) : clienteId };
            }
            if (isTypeMismatch && fallback && fallback.column !== primary.column) {
                console.log('[PerformanceConnectionsRepo] getConnections fallback:', { column: fallback.column, value: fallback.value, raw: clienteId });
                const result2 = await attempt(fallback);
                if (!result2.error) return result2.data || [];
                console.error('[PerformanceConnectionsRepo] getConnections error:', result2.error);
                return [];
            }

            console.error('[PerformanceConnectionsRepo] getConnections error:', result1.error);
            return [];
        },

        upsertConnection: async function(clienteId, platform, patch) {
            if (!global.supabaseClient || !clienteId || !platform) return { ok: false };
            const schema = await detectSchema();
            const clientFilter = resolveClientFilter(schema, clienteId);
            const payload = {
                [clientFilter.column]: clientFilter.value,
                platform,
                ...resolveTenantPatch(schema),
                ...(patch || {}),
                updated_at: new Date().toISOString()
            };
            console.log('[PerformanceConnectionsRepo] upsertConnection payload:', {
                clientColumn: clientFilter.column,
                clientValue: clientFilter.value,
                platform,
                tenantColumns: {
                    tenantIdColumn: schema?.tenantIdColumn || null,
                    tenantUuidColumn: schema?.tenantUuidColumn || null
                }
            });
            const { data, error } = await global.supabaseClient
                .from('client_platform_connections')
                .upsert(payload, { onConflict: schema?.onConflict || 'client_id,platform' })
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
