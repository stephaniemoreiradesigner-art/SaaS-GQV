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
        /**
         * Inicializa o contexto buscando dados reais
         */
        async init() {
            if (state.isReady) return state;

            try {
                // 1. Aguardar Supabase
                const supabase = global.supabaseClient;
                if (!supabase) {
                    throw new Error('Supabase client não disponível');
                }

                // 2. Obter usuário
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    console.warn('[TenantContext] Usuário não logado');
                    return null;
                }
                state.userId = user.id;

                // 3. Resolver Tenant ID (Estratégia em Cascata)
                // A: Metadata do Auth (Mais rápido)
                let tenantId = user.user_metadata?.tenant_id || user.app_metadata?.tenant_id;

                // B: Tabela de Colaboradores (Fonte de verdade da v1)
                let colaboradorData = null;
                if (!tenantId) {
                    const { data: colab } = await supabase
                        .from('colaboradores')
                        .select('tenant_id, perfil_acesso, permissoes')
                        .eq('user_id', user.id)
                        .maybeSingle();
                    
                    if (colab) {
                        tenantId = colab.tenant_id;
                        colaboradorData = colab;
                    }
                }

                // C: Tabela Memberships (Futuro v2)
                let membershipData = null;
                if (!tenantId) {
                    const { data: member } = await supabase
                        .from('memberships')
                        .select('tenant_id, roles')
                        .eq('user_id', user.id)
                        .maybeSingle();
                    
                    if (member) {
                        tenantId = member.tenant_id;
                        membershipData = member;
                    }
                }

                // Normalizar Tenant ID
                if (tenantId) {
                    const raw = String(tenantId || '').trim();
                    if (UUID_RE.test(raw)) {
                        state.tenantUuid = raw;
                        state.tenantId = null;
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

                // 4. Resolver Roles/Permissões
                if (colaboradorData) {
                    state.roles = [colaboradorData.perfil_acesso];
                    // Adaptar para estrutura v2 se necessário
                } else if (membershipData) {
                    state.roles = membershipData.roles || [];
                }

                state.membership = colaboradorData || membershipData;
                state.isReady = true;
                
                console.log('[TenantContext] Inicializado:', { tenantId: state.tenantId, tenantUuid: state.tenantUuid, userId: state.userId });
                this.notifyListeners();
                
                return state;

            } catch (err) {
                console.error('[TenantContext] Erro fatal na inicialização:', err);
                return null;
            }
        },

        get() {
            return { ...state };
        },

        getTenantId() {
            return state.tenantId;
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
