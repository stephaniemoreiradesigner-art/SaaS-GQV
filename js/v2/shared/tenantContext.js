// js/v2/shared/tenantContext.js
// Contexto de Tenant Real da V2
// Unifica a descoberta do tenant ID e dados do membro logado

(function(global) {
    console.log('[V2] tenantContext carregado');
    
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
            const uuid = String(tenantUuid || '').trim();
            if (!UUID_RE.test(uuid)) return { tenantId: null, tenantUuid: null };
            if (!supabase) return { tenantId: uuid, tenantUuid: uuid };

            const parseMissingColumn = (error) => {
                const msg = String(error?.message || '');
                const match = msg.match(/Could not find the '([^']+)' column of 'tenants' in the schema cache/i);
                return match ? match[1] : null;
            };

            const attempt = async (selectExpr) => {
                return supabase
                    .from('tenants')
                    .select(selectExpr)
                    .eq('id', uuid)
                    .maybeSingle();
            };

            let data = null;
            let error = null;

            try {
                ({ data, error } = await attempt('id,legacy_id'));
                if (error) {
                    const missing = parseMissingColumn(error);
                    if (missing === 'legacy_id') {
                        ({ data, error } = await attempt('id'));
                    }
                }
            } catch (e) {
                error = e;
            }

            if (error) return { tenantId: uuid, tenantUuid: uuid };
            const row = data || null;
            const legacy = row?.legacy_id;
            if (legacy !== undefined && legacy !== null && String(legacy).match(/^-?\d+$/)) {
                const parsed = Number(legacy);
                if (Number.isFinite(parsed) && !Number.isNaN(parsed)) {
                    return { tenantId: parsed, tenantUuid: uuid };
                }
            }
            return { tenantId: row?.id ? String(row.id) : uuid, tenantUuid: uuid };
        },

        /**
         * Inicializa o contexto buscando dados reais
         */
        async init() {
            if (state.isReady) return state;

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
