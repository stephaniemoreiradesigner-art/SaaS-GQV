// js/v2/client/client_repo.js
// Repositório de Dados do Portal do Cliente V2

(function(global) {
    const ClientRepo = {
        getPendingCalendarStatuses: function() {
            const base = [
                'awaiting_approval',
                'aguardando_aprovacao',
                'ready_for_approval',
                'pendente_aprovacao',
                'pendente_aprovação',
                'em_aprovacao'
            ];
            const fromConstants = global.GQV_CONSTANTS?.SOCIAL_STATUS?.READY_FOR_APPROVAL
                ? [global.GQV_CONSTANTS.SOCIAL_STATUS.READY_FOR_APPROVAL]
                : [];
            return Array.from(new Set([...fromConstants, ...base].filter(Boolean)));
        },

        getPendingPostStatuses: function() {
            const base = [
                'ready_for_approval',
                'pendente_aprovacao',
                'pendente_aprovação',
                'aguardando_aprovacao',
                'awaiting_approval',
                'em_aprovacao'
            ];
            const fromConstants = global.GQV_CONSTANTS?.SOCIAL_STATUS?.READY_FOR_APPROVAL
                ? [global.GQV_CONSTANTS.SOCIAL_STATUS.READY_FOR_APPROVAL]
                : [];
            return Array.from(new Set([...fromConstants, ...base].filter(Boolean)));
        },

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
            if (!supabase || !clientId) return [];
            const pendingStatuses = this.getPendingCalendarStatuses();

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
        getCalendarPosts: async function(calendarId, clientId) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return [];

            let query = supabase
                .from('social_posts')
                .select('*')
                .eq('calendar_id', calendarId);
            if (clientId) query = query.eq('cliente_id', clientId);
            const { data, error } = await query.order('data_agendada', { ascending: true });

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
            if (!supabase || !clientId) return [];

            const pendingStatuses = this.getPendingPostStatuses();

            try {
                const { data, error } = await supabase
                    .from('social_posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .in('status', pendingStatuses)
                    .order('data_agendada', { ascending: true });
                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('[ClientRepo] Erro ao buscar posts pendentes em social_posts:', error);
                try {
                    const { data, error: fallbackError } = await supabase
                        .from('posts')
                        .select('*')
                        .eq('cliente_id', clientId)
                        .in('status', pendingStatuses)
                        .order('data_postagem', { ascending: true });
                    if (fallbackError) throw fallbackError;
                    return data || [];
                } catch (fallbackError) {
                    console.error('[ClientRepo] Erro ao buscar posts pendentes em posts:', fallbackError);
                    return [];
                }
            }
        },

        /**
         * Aprova um calendário inteiro
         * @param {string} calendarId 
         */
        approveCalendar: async function(calendarId, clientId, comment) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return false;

            const approvedStatus = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS.APPROVED : 'approved';
            const trimmedComment = String(comment || '').trim();

            // 1. Aprova calendário
            let calendarQuery = supabase
                .from('social_calendars')
                .update({
                    status: approvedStatus,
                    comentario_cliente: trimmedComment || null
                })
                .eq('id', calendarId);
            if (clientId) calendarQuery = calendarQuery.eq('cliente_id', clientId);

            const { data: calData, error: calError } = await calendarQuery.select('id,status');

            if (calError) {
                console.error('[ClientRepo] Erro ao aprovar calendário:', calError);
                return false;
            }
            if (!calData || calData.length === 0) {
                console.error('[ClientRepo] Aprovação de calendário não afetou nenhuma linha (possível RLS/filtro).', calendarId);
                return false;
            }

            // 2. Aprova todos os posts associados (Opcional, mas boa prática para consistência)
            let postsQuery = supabase
                .from('social_posts')
                .update({ status: approvedStatus })
                .eq('calendar_id', calendarId);
            if (clientId) postsQuery = postsQuery.eq('cliente_id', clientId);
            const { data: postData, error: postError } = await postsQuery.select('id,status');
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
        rejectCalendar: async function(calendarId, clientId, comment) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return false;

            const changesStatus = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS.CHANGES_REQUESTED : 'changes_requested';

            let query = supabase
                .from('social_calendars')
                .update({ 
                    status: changesStatus,
                    comentario_cliente: comment 
                })
                .eq('id', calendarId);
            if (clientId) query = query.eq('cliente_id', clientId);
            const { error } = await query;

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
        approvePost: async function(postId, clientId, comment) {
            const supabase = await this.getClient();
            if (!supabase) return false;

            const approvedStatus = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS.APPROVED : 'approved';
            const normalizedPostId = postId ? String(postId).trim() : '';
            const { data: userData } = await supabase.auth.getUser();
            const email = userData?.user?.email || null;
            const trimmedComment = String(comment || '').trim();

            const payload = {
                status: approvedStatus,
                comentario_cliente: trimmedComment || null
            };

            let query = supabase
                .from('social_posts')
                .update(payload)
                .eq('id', normalizedPostId);
            if (clientId) query = query.eq('cliente_id', clientId);
            const { data, error } = await query.select('id,status,cliente_id,calendar_id');

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
        rejectPost: async function(postId, clientId, comment) {
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

            let query = supabase
                .from('social_posts')
                .update(payload)
                .eq('id', normalizedPostId);
            if (clientId) query = query.eq('cliente_id', clientId);
            const { data, error } = await query.select('id,status,cliente_id,calendar_id');

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
