// js/v2/client/client_repo.js
// Repositório de Dados do Portal do Cliente V2

(function(global) {
    const ClientRepo = {
        isDebug: function() {
            return global.__GQV_DEBUG_CONTEXT__ === true;
        },

        normalizeBigIntId: function(value) {
            const raw = String(value ?? '').trim();
            if (!raw) return null;
            const num = Number(raw);
            if (!Number.isFinite(num) || Number.isNaN(num)) return null;
            const intVal = Math.trunc(num);
            if (intVal <= 0) return null;
            return intVal;
        },

        getPendingCalendarStatuses: function() {
            const base = [
                'sent_for_approval',
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
            const normalizedClientId = this.normalizeBigIntId(clientId) ?? clientId;

            const { data, error } = await supabase
                .from('social_calendars')
                .select('*')
                .eq('cliente_id', normalizedClientId)
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
            const normalizedCalendarId = this.normalizeBigIntId(calendarId) ?? calendarId;
            const normalizedClientId = this.normalizeBigIntId(clientId);

            let query = supabase
                .from('social_posts')
                .select('*')
                .eq('calendar_id', normalizedCalendarId);
            if (normalizedClientId) query = query.eq('cliente_id', normalizedClientId);
            const { data, error } = await query.order('data_agendada', { ascending: true });

            if (error) {
                console.error('[ClientRepo] Erro ao buscar posts:', error);
                return [];
            }
            return data || [];
        },

        getCalendarItems: async function(calendarId, clientId) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return [];
            const normalizedCalendarId = this.normalizeBigIntId(calendarId) ?? calendarId;

            let query = supabase
                .from('social_calendar_items')
                .select('*')
                .eq('calendar_id', normalizedCalendarId);
            const { data, error } = await query.order('data', { ascending: true });

            if (error) {
                console.error('[ClientRepo] Erro ao buscar itens do calendário:', error);
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

            const approvedStatus = global.GQV_CONSTANTS?.SOCIAL_CALENDAR_STATUS?.APPROVED
                ? global.GQV_CONSTANTS.SOCIAL_CALENDAR_STATUS.APPROVED
                : (global.GQV_CONSTANTS?.SOCIAL_STATUS?.APPROVED || 'approved');
            const trimmedComment = String(comment || '').trim();
            const normalizedCalendarId = this.normalizeBigIntId(calendarId) ?? calendarId;
            const normalizedClientId = this.normalizeBigIntId(clientId);
            const { data: userData } = await supabase.auth.getUser();
            const email = userData?.user?.email || null;
            const payload = {
                status: approvedStatus,
                comentario_cliente: trimmedComment || null
            };

            if (this.isDebug()) {
                console.log('[ClientRepo] approveCalendar update:', {
                    table: 'social_calendars',
                    payload,
                    filter: {
                        id: normalizedCalendarId,
                        cliente_id: normalizedClientId
                    },
                    authEmail: email
                });
            }

            // 1. Aprova calendário
            let calendarQuery = supabase
                .from('social_calendars')
                .update(payload)
                .eq('id', normalizedCalendarId);
            if (normalizedClientId) calendarQuery = calendarQuery.eq('cliente_id', normalizedClientId);

            const { data: calData, error: calError } = await calendarQuery.select('id,status,cliente_id');

            if (calError) {
                console.error('[ClientRepo] Erro ao aprovar calendário:', calError);
                return { ok: false, error: calError };
            }
            if (!calData || calData.length === 0) {
                console.error('[ClientRepo] Aprovação de calendário não afetou nenhuma linha (possível RLS/filtro).', {
                    calendarId: normalizedCalendarId,
                    clientId: normalizedClientId,
                    authEmail: email,
                    payload
                });
                return { ok: false, error: { message: 'Nenhuma linha atualizada (RLS/filtro).' }, calendarId: normalizedCalendarId, clientId: normalizedClientId };
            }

            return { ok: true, data: calData[0] };
        },

        /**
         * Solicita ajustes no calendário
         * @param {string} calendarId 
         * @param {string} comment 
         */
        rejectCalendar: async function(calendarId, clientId, comment) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return false;

            const changesStatus = global.GQV_CONSTANTS?.SOCIAL_CALENDAR_STATUS?.NEEDS_CHANGES
                ? global.GQV_CONSTANTS.SOCIAL_CALENDAR_STATUS.NEEDS_CHANGES
                : 'needs_changes';
            const normalizedCalendarId = this.normalizeBigIntId(calendarId) ?? calendarId;
            const normalizedClientId = this.normalizeBigIntId(clientId);
            const payload = {
                status: changesStatus,
                comentario_cliente: comment
            };

            let query = supabase
                .from('social_calendars')
                .update(payload)
                .eq('id', normalizedCalendarId);
            if (normalizedClientId) query = query.eq('cliente_id', normalizedClientId);
            const { data, error } = await query.select('id,status,cliente_id');

            if (error) {
                console.error('[ClientRepo] Erro ao rejeitar calendário:', error);
                return { ok: false, error };
            }
            if (!data || data.length === 0) {
                console.error('[ClientRepo] Rejeição de calendário não afetou nenhuma linha (possível RLS/filtro).', {
                    calendarId: normalizedCalendarId,
                    clientId: normalizedClientId,
                    payload
                });
                return { ok: false, error: { message: 'Nenhuma linha atualizada (RLS/filtro).' } };
            }
            return { ok: true, data: data[0] };
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
            const normalizedClientId = this.normalizeBigIntId(clientId);
            const { data: userData } = await supabase.auth.getUser();
            const email = userData?.user?.email || null;
            const trimmedComment = String(comment || '').trim();

            const payload = {
                status: approvedStatus,
                comentario_cliente: trimmedComment || null
            };

            if (this.isDebug()) {
                console.log('[ClientRepo] approvePost update:', {
                    table: 'social_posts',
                    payload,
                    filter: {
                        id: normalizedPostId,
                        cliente_id: normalizedClientId
                    },
                    authEmail: email
                });
            }

            let query = supabase
                .from('social_posts')
                .update(payload)
                .eq('id', normalizedPostId);
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
            const normalizedClientId = this.normalizeBigIntId(clientId);
            const { data: userData } = await supabase.auth.getUser();
            const email = userData?.user?.email || null;

            const payload = {
                status: changesStatus,
                comentario_cliente: comment
            };

            if (this.isDebug()) {
                console.log('[ClientRepo] rejectPost update:', {
                    table: 'social_posts',
                    payload,
                    filter: {
                        id: normalizedPostId,
                        cliente_id: normalizedClientId
                    },
                    authEmail: email
                });
            }

            let query = supabase
                .from('social_posts')
                .update(payload)
                .eq('id', normalizedPostId);
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

        getPostsByDateRange: async function(clientId, startDate, endDate) {
            const supabase = await this.getClient();
            if (!supabase || !clientId) return [];

            const start = String(startDate || '').slice(0, 10);
            const end = String(endDate || '').slice(0, 10);
            if (!start || !end) return [];

            try {
                const { data, error } = await supabase
                    .from('social_posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .gte('data_agendada', start)
                    .lt('data_agendada', end)
                    .order('data_agendada', { ascending: true });
                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('[ClientRepo] Erro ao buscar posts por período em social_posts:', error);
                try {
                    const { data, error: fallbackError } = await supabase
                        .from('posts')
                        .select('*')
                        .eq('cliente_id', clientId)
                        .gte('data_postagem', start)
                        .lt('data_postagem', end)
                        .order('data_postagem', { ascending: true });
                    if (fallbackError) throw fallbackError;
                    return data || [];
                } catch (fallbackError) {
                    console.error('[ClientRepo] Erro ao buscar posts por período em posts:', fallbackError);
                    return [];
                }
            }
        },

        getNextPost: async function(clientId, fromDate) {
            const supabase = await this.getClient();
            if (!supabase || !clientId) return null;

            const from = String(fromDate || '').slice(0, 10);
            if (!from) return null;

            try {
                const { data, error } = await supabase
                    .from('social_posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .gte('data_agendada', from)
                    .order('data_agendada', { ascending: true })
                    .limit(1);
                if (error) throw error;
                return (data && data[0]) || null;
            } catch (error) {
                console.error('[ClientRepo] Erro ao buscar próximo post em social_posts:', error);
                try {
                    const { data, error: fallbackError } = await supabase
                        .from('posts')
                        .select('*')
                        .eq('cliente_id', clientId)
                        .gte('data_postagem', from)
                        .order('data_postagem', { ascending: true })
                        .limit(1);
                    if (fallbackError) throw fallbackError;
                    return (data && data[0]) || null;
                } catch (fallbackError) {
                    console.error('[ClientRepo] Erro ao buscar próximo post em posts:', fallbackError);
                    return null;
                }
            }
        },

        getHistoryPosts: async function(clientId, limit = 60) {
            const supabase = await this.getClient();
            if (!supabase || !clientId) return [];

            const statuses = ['approved', 'scheduled', 'published', 'aprovado', 'agendado', 'publicado'];
            const safeLimit = Math.max(1, Math.min(200, Number(limit || 60)));

            try {
                const { data, error } = await supabase
                    .from('social_posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .in('status', statuses)
                    .order('data_agendada', { ascending: false })
                    .limit(safeLimit);
                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('[ClientRepo] Erro ao buscar histórico em social_posts:', error);
                try {
                    const { data, error: fallbackError } = await supabase
                        .from('posts')
                        .select('*')
                        .eq('cliente_id', clientId)
                        .in('status', statuses)
                        .order('data_postagem', { ascending: false })
                        .limit(safeLimit);
                    if (fallbackError) throw fallbackError;
                    return data || [];
                } catch (fallbackError) {
                    console.error('[ClientRepo] Erro ao buscar histórico em posts:', fallbackError);
                    return [];
                }
            }
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
