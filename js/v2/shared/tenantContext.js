// js/v2/shared/tenantContext.js
// Contexto de Tenant Real da V2
// Unifica a descoberta do tenant ID e dados do membro logado

(function(global) {
    const VERSION = '2026-03-13.3';
    global.__TENANT_CONTEXT_VERSION__ = VERSION;
    console.log('[V2] tenantContext carregado', VERSION);
    
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let state = {
        tenantId: null,
        tenantUuid: null,
        userId: null,
        membership: null,
        roles: [],
        isReady: false
    };

    const LISTENERS = new Set();

    const TenantContext = {
        async resolveTenantIdFromUuid(supabase, tenantUuid) {
            let uuid = String(tenantUuid || '').trim();
            uuid = uuid.replace(/^urn:uuid:/i, '').replace(/[{}]/g, '').trim();
            if (!UUID_RE.test(uuid)) return { tenantId: null, tenantUuid: null };
            if (!supabase) return { tenantId: null, tenantUuid: uuid };
            try {
                const candidates = ['uuid', 'tenant_uuid', 'external_uuid'];
                for (let i = 0; i < candidates.length; i += 1) {
                    const column = candidates[i];
                    const { data, error } = await supabase
                        .from('tenants')
                        .select('id')
                        .eq(column, uuid)
                        .maybeSingle();

                    if (!error) {
                        const row = data || null;
                        const tenantIdRaw = row?.id ?? null;
                        const tenantId = tenantIdRaw !== null && tenantIdRaw !== undefined ? Number(tenantIdRaw) : null;
                        const resolved = { tenantId: Number.isFinite(tenantId) ? tenantId : null, tenantUuid: uuid };
                        console.log('[TenantContext] tenant resolved', resolved);
                        return resolved;
                    }

                    const msg = String(error?.message || '');
                    const retryable =
                        error?.code === '42703' ||
                        msg.includes('does not exist') ||
                        msg.includes(`'${column}'`) ||
                        msg.includes(`.${column}`) ||
                        msg.includes('schema cache');
                    if (!retryable) {
                        console.error('[TenantContext] Falha ao resolver tenant por uuid:', { column, uuid, errorCode: error?.code || null, errorMessage: error?.message || null });
                        return { tenantId: null, tenantUuid: uuid };
                    }
                }
                console.warn('[TenantContext] Nenhuma coluna UUID compatível encontrada em tenants.', { uuid });
                return { tenantId: null, tenantUuid: uuid };
            } catch {
                return { tenantId: null, tenantUuid: uuid };
            }
        },

        /**
         * Inicializa o contexto buscando dados reais
         */
        async init() {
            try {
                const path = String(global.location?.pathname || '');
                const isClientPortal = path.includes('/v2/client/');
                const supabase = global.supabaseClient || global.clientPortalSupabase;
                if (!supabase) {
                    throw new Error('Supabase client não disponível');
                }

                const { data: sessionData } = await supabase.auth.getSession();
                const session = sessionData?.session || null;
                if (!session?.access_token) {
                    console.warn('[TenantContext] Usuário não logado');
                    return null;
                }

                if (state.isReady) {
                    if (state.tenantUuid && (state.tenantId === null || state.tenantId === undefined)) {
                        const resolved = await this.resolveTenantIdFromUuid(supabase, state.tenantUuid);
                        if (resolved?.tenantUuid) state.tenantUuid = resolved.tenantUuid;
                        if (resolved?.tenantId !== null && resolved?.tenantId !== undefined) state.tenantId = resolved.tenantId;
                        this.notifyListeners();
                    }
                    return state;
                }

                if (isClientPortal) {
                    const { data: userData } = await supabase.auth.getUser();
                    const user = userData?.user || null;
                    if (!user) return null;

                    const fallbackTenant = user?.user_metadata?.tenant_id || user?.app_metadata?.tenant_id || null;
                    if (fallbackTenant) {
                        const raw = String(fallbackTenant || '').trim();
                        if (UUID_RE.test(raw)) {
                            const resolved = await this.resolveTenantIdFromUuid(supabase, raw);
                            state.tenantUuid = resolved.tenantUuid;
                            state.tenantId = resolved.tenantId;
                        } else if (/^-?\d+$/.test(raw)) {
                            state.tenantId = Number(raw);
                            state.tenantUuid = null;
                        } else {
                            state.tenantId = null;
                            state.tenantUuid = null;
                        }
                    }
                    state.userId = user?.id || session.user?.id || null;
                    const role = String(user?.user_metadata?.role || user?.app_metadata?.role || '').trim().toLowerCase();
                    state.roles = role ? [role] : [];
                    state.membership = null;
                    if (state.tenantUuid && (state.tenantId === null || state.tenantId === undefined)) {
                        const resolved = await this.resolveTenantIdFromUuid(supabase, state.tenantUuid);
                        if (resolved?.tenantUuid) state.tenantUuid = resolved.tenantUuid;
                        if (resolved?.tenantId !== null && resolved?.tenantId !== undefined) state.tenantId = resolved.tenantId;
                    }
                    state.isReady = true;
                    this.notifyListeners();
                    return state;
                }

                const res = await fetch('/api/v2/me', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`
                    }
                });

                if (!res.ok) {
                    throw new Error(`Falha ao buscar /api/v2/me: ${res.status}`);
                }

                const me = await res.json();
                state.userId = me?.user_id || session.user?.id || null;
                state.roles = Array.isArray(me?.roles) ? me.roles : [];
                state.membership = me?.membership_id
                    ? { id: me.membership_id, tenant_id: me?.tenant_id || null }
                    : null;

                const tenantId = me?.tenant_id;

                // Normalizar Tenant ID
                if (tenantId) {
                    const raw = String(tenantId || '').trim();
                    if (UUID_RE.test(raw)) {
                        const resolved = await this.resolveTenantIdFromUuid(supabase, raw);
                        state.tenantUuid = resolved.tenantUuid;
                        state.tenantId = resolved.tenantId;
                    } else if (/^-?\d+$/.test(raw)) {
                        state.tenantId = Number(raw);
                        state.tenantUuid = null;
                    } else {
                        state.tenantId = null;
                        state.tenantUuid = null;
                    }
                } else {
                    console.error('[TenantContext] Não foi possível resolver o Tenant ID');
                }

                if (state.tenantUuid && (state.tenantId === null || state.tenantId === undefined)) {
                    const resolved = await this.resolveTenantIdFromUuid(supabase, state.tenantUuid);
                    if (resolved?.tenantUuid) state.tenantUuid = resolved.tenantUuid;
                    if (resolved?.tenantId !== null && resolved?.tenantId !== undefined) state.tenantId = resolved.tenantId;
                }

                state.isReady = true;
                
                console.log('[TenantContext] Inicializado:', { tenantId: state.tenantId, tenantUuid: state.tenantUuid, userId: state.userId });
                this.notifyListeners();
                
                return state;

            } catch (err) {
                console.error('[TenantContext] Erro fatal na inicialização:', err);
                try {
                    const supabase = global.supabaseClient || global.clientPortalSupabase;
                    const { data: userData } = supabase?.auth?.getUser ? await supabase.auth.getUser() : { data: { user: null } };
                    const user = userData?.user || null;
                    const fallbackTenant = user?.user_metadata?.tenant_id || user?.app_metadata?.tenant_id || null;
                    if (fallbackTenant) {
                        const raw = String(fallbackTenant || '').trim();
                        if (UUID_RE.test(raw)) {
                            const resolved = await this.resolveTenantIdFromUuid(supabase, raw);
                            state.tenantUuid = resolved.tenantUuid;
                            state.tenantId = resolved.tenantId;
                        } else if (/^-?\d+$/.test(raw)) {
                            state.tenantId = Number(raw);
                            state.tenantUuid = null;
                        }
                        state.userId = user?.id || state.userId;
                        state.roles = state.roles || [];
                        state.membership = state.membership || null;
                        state.isReady = true;
                        this.notifyListeners();
                        return state;
                    }
                } catch (fallbackErr) {
                    console.error('[TenantContext] Falha no fallback:', fallbackErr);
                }
                return null;
            }
        },

        get() {
            return { ...state };
        },

        getTenantId() {
            return state.tenantId ?? state.tenantUuid;
        },

        getTenantUuid() {
            return state.tenantUuid;
        },

        subscribe(callback) {
            LISTENERS.add(callback);
            if (state.isReady) callback(state);
            return () => LISTENERS.delete(callback);
        },

        notifyListeners() {
            LISTENERS.forEach(cb => cb(state));
        }
    };

    global.TenantContext = TenantContext;

})(window);
