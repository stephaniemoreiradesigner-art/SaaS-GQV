// js/v2/client/client_repo.js
// Repositório de Dados do Portal do Cliente V2

(function(global) {
    const ClientRepo = {
        /**
         * Helper para garantir cliente Supabase correto
         */
        getClient: async function() {
            if (global.clientPortalSupabase) return global.clientPortalSupabase;
            if (global.ClientAuth) {
                await global.ClientAuth.init();
                return global.clientPortalSupabase;
            }
            return null;
        },

        /**
         * Busca calendários aguardando aprovação
         * @param {string} clientId 
         */
        getPendingCalendars: async function(clientId) {
            const supabase = await this.getClient();
            if (!supabase) return [];
            
            const { data, error } = await supabase
                .from('social_calendars')
                .select('*')
                .eq('cliente_id', clientId)
                .in('status', ['awaiting_approval', 'em_aprovacao', 'pendente_aprovacao']) // Abrangendo variações
                .order('mes_referencia', { ascending: false });

            if (error) {
                console.error('[ClientRepo] Erro ao buscar calendários:', error);
                return [];
            }
            return data || [];
        },

        /**
         * Busca posts de um calendário
         * @param {string} calendarId 
         */
        getCalendarPosts: async function(calendarId) {
            const supabase = await this.getClient();
            if (!supabase) return [];

            const { data, error } = await supabase
                .from('social_posts')
                .select('*')
                .eq('calendar_id', calendarId)
                .order('data_agendada', { ascending: true });

            if (error) {
                console.error('[ClientRepo] Erro ao buscar posts:', error);
                return [];
            }
            return data || [];
        },

        /**
         * Busca todos os posts pendentes de aprovação (independente do calendário)
         * @param {string} clientId
         */
        getPendingPosts: async function(clientId) {
            const supabase = await this.getClient();
            if (!supabase) return [];

            const { data, error } = await supabase
                .from('social_posts')
                .select('*, social_calendars!inner(cliente_id)')
                .eq('social_calendars.cliente_id', clientId)
                .in('status', ['awaiting_approval', 'em_aprovacao', 'pendente_aprovacao'])
                .order('data_agendada', { ascending: true });

            if (error) {
                console.error('[ClientRepo] Erro ao buscar posts pendentes:', error);
                return [];
            }
            return data || [];
        },

        /**
         * Aprova um calendário inteiro
         * @param {string} calendarId 
         */
        approveCalendar: async function(calendarId) {
            const supabase = await this.getClient();
            if (!supabase) return false;

            // 1. Aprova calendário
            const { error: calError } = await supabase
                .from('social_calendars')
                .update({ 
                    status: 'approved',
                    comentario_cliente: null // Limpa comentários anteriores se houver
                })
                .eq('id', calendarId);

            if (calError) {
                console.error('[ClientRepo] Erro ao aprovar calendário:', calError);
                return false;
            }

            // 2. Aprova todos os posts associados (Opcional, mas boa prática para consistência)
            const { error: postError } = await supabase
                .from('social_posts')
                .update({ status: 'approved' })
                .eq('calendar_id', calendarId);

            if (postError) console.warn('[ClientRepo] Erro ao aprovar posts em lote:', postError);

            return true;
        },

        /**
         * Solicita ajustes no calendário
         * @param {string} calendarId 
         * @param {string} comment 
         */
        rejectCalendar: async function(calendarId, comment) {
            const supabase = await this.getClient();
            if (!supabase) return false;

            const { error } = await supabase
                .from('social_calendars')
                .update({ 
                    status: 'changes_requested',
                    comentario_cliente: comment 
                })
                .eq('id', calendarId);

            if (error) {
                console.error('[ClientRepo] Erro ao rejeitar calendário:', error);
                return false;
            }
            return true;
        },

        /**
         * Aprova um post individual
         * @param {string} postId 
         */
        approvePost: async function(postId) {
            const supabase = await this.getClient();
            if (!supabase) return false;

            const { error } = await supabase
                .from('social_posts')
                .update({ 
                    status: 'approved',
                    comentario_cliente: null
                })
                .eq('id', postId);

            if (error) return false;
            return true;
        },

        /**
         * Rejeita um post individual
         * @param {string} postId 
         * @param {string} comment 
         */
        rejectPost: async function(postId, comment) {
            const supabase = await this.getClient();
            if (!supabase) return false;

            const { error } = await supabase
                .from('social_posts')
                .update({ 
                    status: 'changes_requested',
                    comentario_cliente: comment 
                })
                .eq('id', postId);

            if (error) return false;
            return true;
        },

        /**
         * Busca métricas resumidas (Mock para MVP)
         */
        getMetricsSummary: async function(clientId) {
            // Futuro: conectar com tabela de analytics
            return {
                approvals: (await this.getPendingCalendars(clientId)).length,
                investment: 0,
                leads: 0
            };
        }
    };

    global.ClientRepo = ClientRepo;

})(window);
