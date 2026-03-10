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
            
            const pendingStatuses = global.GQV_CONSTANTS 
                ? [
                    global.GQV_CONSTANTS.SOCIAL_STATUS.READY_FOR_APPROVAL,
                    'pendente_aprovacao', // legacy
                    'awaiting_approval' // legacy
                  ]
                : ['awaiting_approval', 'em_aprovacao', 'pendente_aprovacao', 'ready_for_approval'];

            const { data, error } = await supabase
                .from('social_calendars')
                .select('*')
                .eq('cliente_id', clientId)
                .in('status', pendingStatuses)
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

            const pendingStatuses = global.GQV_CONSTANTS 
                ? [
                    global.GQV_CONSTANTS.SOCIAL_STATUS.READY_FOR_APPROVAL,
                    'pendente_aprovacao', // legacy
                    'awaiting_approval' // legacy
                  ]
                : ['awaiting_approval', 'em_aprovacao', 'pendente_aprovacao', 'ready_for_approval'];

            const { data, error } = await supabase
                .from('social_posts')
                .select('*, social_calendars!inner(cliente_id)')
                .eq('social_calendars.cliente_id', clientId)
                .in('status', pendingStatuses)
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

            const approvedStatus = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS.APPROVED : 'approved';

            // 1. Aprova calendário
            const { data: calData, error: calError } = await supabase
                .from('social_calendars')
                .update({ 
                    status: approvedStatus,
                    comentario_cliente: null // Limpa comentários anteriores se houver
                })
                .eq('id', calendarId)
                .select('id,status');

            if (calError) {
                console.error('[ClientRepo] Erro ao aprovar calendário:', calError);
                return false;
            }
            if (!calData || calData.length === 0) {
                console.error('[ClientRepo] Aprovação de calendário não afetou nenhuma linha (possível RLS/filtro).', calendarId);
                return false;
            }

            // 2. Aprova todos os posts associados (Opcional, mas boa prática para consistência)
            const { data: postData, error: postError } = await supabase
                .from('social_posts')
                .update({ status: approvedStatus })
                .eq('calendar_id', calendarId)
                .select('id,status');

            if (postError) console.warn('[ClientRepo] Erro ao aprovar posts em lote:', postError);
            if (!postError && (!postData || postData.length === 0)) {
                console.warn('[ClientRepo] Aprovação em lote não atualizou posts (pode não haver posts no calendário).', calendarId);
            }

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

            const changesStatus = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS.CHANGES_REQUESTED : 'changes_requested';

            const { error } = await supabase
                .from('social_calendars')
                .update({ 
                    status: changesStatus,
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

            const approvedStatus = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS.APPROVED : 'approved';
            const normalizedPostId = postId ? String(postId).trim() : '';
            const { data: userData } = await supabase.auth.getUser();
            const email = userData?.user?.email || null;

            const payload = {
                status: approvedStatus,
                comentario_cliente: null
            };

            const { data, error } = await supabase
                .from('social_posts')
                .update(payload)
                .eq('id', normalizedPostId)
                .select('id,status,cliente_id,calendar_id');

            if (error) {
                console.error('[ClientRepo] Erro ao aprovar post:', {
                    postId: normalizedPostId,
                    authEmail: email,
                    payload,
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                });
                return { ok: false, error, postId, payload };
            }
            if (!data || data.length === 0) {
                console.error('[ClientRepo] Aprovação não afetou nenhuma linha (possível RLS/filtro).', {
                    postId: normalizedPostId,
                    authEmail: email,
                    payload
                });
                return { ok: false, error: { message: 'Nenhuma linha atualizada (RLS/filtro).' }, postId, payload };
            }
            return { ok: true, data: data[0] };
        },

        /**
         * Rejeita um post individual
         * @param {string} postId 
         * @param {string} comment 
         */
        rejectPost: async function(postId, comment) {
            const supabase = await this.getClient();
            if (!supabase) return false;

            const changesStatus = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS.CHANGES_REQUESTED : 'changes_requested';
            const normalizedPostId = postId ? String(postId).trim() : '';
            const { data: userData } = await supabase.auth.getUser();
            const email = userData?.user?.email || null;

            const payload = {
                status: changesStatus,
                comentario_cliente: comment
            };

            const { data, error } = await supabase
                .from('social_posts')
                .update(payload)
                .eq('id', normalizedPostId)
                .select('id,status,cliente_id,calendar_id');

            if (error) {
                console.error('[ClientRepo] Erro ao solicitar ajustes no post:', {
                    postId: normalizedPostId,
                    authEmail: email,
                    payload,
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                });
                return { ok: false, error, postId, payload };
            }
            if (!data || data.length === 0) {
                console.error('[ClientRepo] Solicitação de ajuste não afetou nenhuma linha (possível RLS/filtro).', {
                    postId: normalizedPostId,
                    authEmail: email,
                    payload
                });
                return { ok: false, error: { message: 'Nenhuma linha atualizada (RLS/filtro).' }, postId, payload };
            }
            return { ok: true, data: data[0] };
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
