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

        normalizeIdForFilter: function(value) {
            const raw = String(value ?? '').trim();
            if (!raw) return null;
            if (/^\d+$/.test(raw)) return raw;
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return raw;
            return null;
        },

        getPendingCalendarStatuses: function() {
            const base = [
                'awaiting_approval',
                'aguardando_aprovacao',
                'sent_for_approval',
                'needs_changes',
                'ajuste_solicitado'
            ];
            return Array.from(new Set(base.filter(Boolean)));
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

        getClientCalendars: async function(clientId) {
            const supabase = await this.getClient();
            if (!supabase || !clientId) return [];
            const normalizedClientId = this.normalizeBigIntId(clientId) ?? clientId;

            const { data, error } = await supabase
                .from('social_calendars')
                .select('*')
                .eq('cliente_id', normalizedClientId)
                .order('mes_referencia', { ascending: false });

            if (error) {
                console.error('[ClientRepo] Erro ao buscar calendários do cliente:', error);
                return [];
            }

            const excluded = new Set(['published', 'publicado', 'archived', 'concluido', 'concluído']);
            const rows = Array.isArray(data) ? data : [];
            return rows.filter((c) => !excluded.has(String(c?.status || '').trim().toLowerCase()));
        },

        getCalendarByMonthKey: async function(clientId, monthKey) {
            const supabase = await this.getClient();
            if (!supabase || !clientId) return null;
            const normalizedClientId = this.normalizeBigIntId(clientId) ?? clientId;
            const key = String(monthKey || '').trim().slice(0, 7);
            if (!global.MonthUtils?.isValidMonthKey?.(key)) return null;

            const monthRef = global.MonthUtils?.buildMonthReferenceFromMonthKey
                ? global.MonthUtils.buildMonthReferenceFromMonthKey(key)
                : `${key}-01`;

            const tryFetch = async (mesReferencia) => {
                const { data, error } = await supabase
                    .from('social_calendars')
                    .select('id,status,mes_referencia,cliente_id')
                    .eq('cliente_id', normalizedClientId)
                    .eq('mes_referencia', mesReferencia)
                    .maybeSingle();
                if (error) return { data: null, error };
                return { data: data || null, error: null };
            };

            const first = await tryFetch(monthRef);
            if (first.data) return first.data;
            const second = await tryFetch(key);
            if (second.error) {
                console.error('[ClientRepo] Erro ao buscar calendário por mês:', {
                    clientId: normalizedClientId,
                    monthKey: key,
                    monthRef,
                    code: second.error.code,
                    message: second.error.message
                });
            }
            return second.data || null;
        },

        getCalendarMeta: async function(calendarId, clientId) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return null;
            const normalizedCalendarId = this.normalizeBigIntId(calendarId) ?? calendarId;
            const normalizedClientId = this.normalizeBigIntId(clientId);

            let query = supabase
                .from('social_calendars')
                .select('id,status,mes_referencia,cliente_id')
                .eq('id', normalizedCalendarId);
            if (normalizedClientId) query = query.eq('cliente_id', normalizedClientId);
            const { data, error } = await query.maybeSingle();
            if (error) {
                console.error('[ClientRepo] Erro ao buscar meta do calendário:', error);
                return null;
            }
            return data || null;
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

        upsertCalendarItemEditorialDecision: async function(params) {
            const supabase = await this.getClient();
            if (!supabase) return { ok: false, error: { message: 'missing_supabase' } };

            const calendarId = params?.calendarId;
            const itemId = params?.itemId;
            const clientId = params?.clientId;
            const scheduledDate = String(params?.scheduledDate || '').trim();
            const status = String(params?.status || '').trim();
            const comment = String(params?.comment || '').trim();
            const tema = String(params?.tema || '').trim();
            const legenda = String(params?.legenda || params?.copy || '').trim();

            if (!calendarId || !itemId || !clientId || !scheduledDate || !status) {
                return { ok: false, error: { message: 'missing_params' } };
            }

            const normalizedCalendarId = this.normalizeBigIntId(calendarId) ?? calendarId;
            const normalizedClientId = this.normalizeBigIntId(clientId) ?? clientId;
            const normalizedItemId = this.normalizeBigIntId(itemId) ?? itemId;

            const basePayload = {
                cliente_id: normalizedClientId,
                calendar_id: normalizedCalendarId,
                calendar_item_id: normalizedItemId,
                data_agendada: scheduledDate,
                status: status,
                feedback_cliente: comment || null,
                feedback_ajuste: status === 'changes_requested' ? (comment || null) : null,
                tema: tema || null,
                legenda: legenda || null,
                updated_at: new Date().toISOString()
            };

            try {
                const { data: existing, error: findError } = await supabase
                    .from('social_posts')
                    .select('id,calendar_item_id')
                    .eq('calendar_id', normalizedCalendarId)
                    .eq('calendar_item_id', normalizedItemId)
                    .maybeSingle();

                if (findError) {
                    console.error('[ClientRepo] Erro ao localizar post por calendar_item_id:', findError);
                    return { ok: false, error: findError };
                }

                if (existing?.id) {
                    const { data, error } = await supabase
                        .from('social_posts')
                        .update(basePayload)
                        .eq('id', existing.id)
                        .select('*')
                        .maybeSingle();
                    if (error) return { ok: false, error };
                    return { ok: true, data: data || null };
                }

                const { data, error } = await supabase
                    .from('social_posts')
                    .insert(basePayload)
                    .select('*')
                    .maybeSingle();
                if (error) return { ok: false, error };
                return { ok: true, data: data || null };
            } catch (error) {
                console.error('[ClientRepo] Falha em upsertCalendarItemEditorialDecision:', error);
                return { ok: false, error };
            }
        },

        updateCalendarItemReview: async function(itemId, clientId, review) {
            const supabase = await this.getClient();
            if (!supabase || !itemId) return { ok: false, error: { message: 'missing_params' } };

            const normalizedItemId = this.normalizeIdForFilter ? this.normalizeIdForFilter(itemId) : String(itemId || '').trim();
            const normalizedClientId = this.normalizeIdForFilter ? this.normalizeIdForFilter(clientId) : null;
            const status = String(review?.status || '').trim();
            const comment = String(review?.comment || '').trim();

            const attempts = [
                { statusKey: 'client_review_status', commentKey: 'client_review_comment' },
                { statusKey: 'review_status', commentKey: 'review_comment' },
                { statusKey: 'status_cliente', commentKey: 'comentario_cliente' },
                { statusKey: 'status', commentKey: 'comentario_cliente' },
                { statusKey: 'status', commentKey: 'comentario' }
            ];

            for (let i = 0; i < attempts.length; i += 1) {
                const a = attempts[i];
                const payload = {};
                if (status) payload[a.statusKey] = status;
                if (comment) payload[a.commentKey] = comment;
                if (!Object.keys(payload).length) continue;

                let query = supabase
                    .from('social_calendar_items')
                    .update(payload)
                    .eq('id', normalizedItemId);
                if (normalizedClientId) query = query.eq('cliente_id', normalizedClientId);

                const { data, error } = await query.select('id');
                if (!error) return { ok: true, data: (data && data[0]) || null };
            }

            return { ok: true, data: null };
        },

        updateCalendarFeedback: async function(calendarId, clientId, comment) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return { ok: false, error: { message: 'missing_params' } };
            const normalizedCalendarId = this.normalizeIdForFilter ? this.normalizeIdForFilter(calendarId) : String(calendarId || '').trim();
            const payload = { comentario_cliente: String(comment || '').trim() || null };

            const query = supabase
                .from('social_calendars')
                .update(payload)
                .eq('id', normalizedCalendarId);
            const { data, error } = await query.select('id,status');
            if (error) return { ok: false, error };
            return { ok: true, data: (data && data[0]) || null };
        },

        updateCalendarStatus: async function(calendarId, status) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return { ok: false, error: { message: 'missing_params' } };
            const id = String(calendarId || '').trim();
            if (!id) return { ok: false, error: { message: 'missing_params' } };
            const payload = { status: String(status || '').trim() || null };

            const { data, error } = await supabase
                .from('social_calendars')
                .update(payload)
                .eq('id', id);

            return { data, error };
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
                return [];
            }
        },

        /**
         * Aprova um calendário inteiro
         * @param {string} calendarId 
         */
        approveCalendar: async function(calendarId, clientId, comment) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return false;

            const approvedStatus = 'approved';
            const trimmedComment = String(comment || '').trim();
            const normalizedCalendarId = this.normalizeIdForFilter(calendarId) ?? String(calendarId ?? '').trim();
            const normalizedClientId = this.normalizeIdForFilter(clientId);
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

            const changesStatus = 'draft';
            const normalizedCalendarId = this.normalizeIdForFilter(calendarId) ?? String(calendarId ?? '').trim();
            const normalizedClientId = this.normalizeIdForFilter(clientId);
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

        updatePostEditorialStatus: async function(postId, clientId, status, comment) {
            const supabase = await this.getClient();
            if (!supabase || !postId) return { ok: false, error: { message: 'missing_params' } };

            const normalizedPostId = String(postId || '').trim();
            const normalizedClientId = this.normalizeBigIntId(clientId);
            const nextStatus = String(status || '').trim();
            const trimmedComment = String(comment || '').trim();

            const payload = {
                status: nextStatus,
                feedback_cliente: trimmedComment || null,
                feedback_ajuste: nextStatus === 'changes_requested' ? (trimmedComment || null) : null,
                updated_at: new Date().toISOString()
            };
            const patch = arguments.length >= 5 ? arguments[4] : null;
            const tema = String(patch?.tema || '').trim();
            const legenda = String(patch?.legenda || patch?.copy || '').trim();
            if (tema) payload.tema = tema;
            if (legenda) payload.legenda = legenda;

            let query = supabase
                .from('social_posts')
                .update(payload)
                .eq('id', normalizedPostId);
            if (normalizedClientId) query = query.eq('cliente_id', normalizedClientId);

            const { data, error } = await query.select('*').maybeSingle();
            if (error) {
                console.error('[ClientRepo] Erro ao atualizar status editorial do post:', {
                    postId: normalizedPostId,
                    clientId: normalizedClientId,
                    payload,
                    code: error.code,
                    message: error.message
                });
                return { ok: false, error };
            }
            return { ok: true, data: data || null };
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
                return [];
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
                return null;
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
                return [];
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
