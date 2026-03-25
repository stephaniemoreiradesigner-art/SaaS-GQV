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

        _mesReferenciaFormatByClient: {},
        _mesReferenciaFormatInflight: {},

        resolveMesReferenciaFormat: async function(clientId) {
            const normalizedClientId = this.normalizeBigIntId(clientId) ?? clientId;
            const key = String(normalizedClientId || '').trim();
            if (!key) return null;
            if (this._mesReferenciaFormatByClient[key]) return this._mesReferenciaFormatByClient[key];
            if (this._mesReferenciaFormatInflight[key]) return await this._mesReferenciaFormatInflight[key];

            this._mesReferenciaFormatInflight[key] = (async () => {
                const supabase = await this.getClient();
                if (!supabase) return null;
                const { data, error } = await supabase
                    .from('social_calendars')
                    .select('mes_referencia')
                    .eq('cliente_id', normalizedClientId)
                    .order('mes_referencia', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (error || !data) return null;
                const raw = String(data?.mes_referencia || '').trim();
                if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'date';
                if (/^\d{4}-\d{2}$/.test(raw)) return 'month';
                return null;
            })();

            const resolved = await this._mesReferenciaFormatInflight[key];
            delete this._mesReferenciaFormatInflight[key];
            if (resolved) this._mesReferenciaFormatByClient[key] = resolved;
            return resolved || null;
        },

        getPendingCalendarStatuses: function() {
            const base = [
                'awaiting_approval',
                'aguardando_aprovacao',
                'sent_for_approval'
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

            const format = await this.resolveMesReferenciaFormat(normalizedClientId);
            const preferred = format === 'month' ? key : monthRef;

            const first = await tryFetch(preferred);
            if (first.data) return first.data;
            if (first.error) {
                console.error('[ClientRepo] Erro ao buscar calendário por mês:', {
                    clientId: normalizedClientId,
                    monthKey: key,
                    monthRef: preferred,
                    code: first.error.code,
                    message: first.error.message
                });
                if (String(first.error.code || '') === '22007') this._mesReferenciaFormatByClient[String(normalizedClientId)] = 'date';
                return null;
            }
            if (!format) {
                const second = await tryFetch(key);
                if (second.data) {
                    this._mesReferenciaFormatByClient[String(normalizedClientId)] = 'month';
                    return second.data;
                }
                if (second.error && String(second.error.code || '') !== '22007') {
                    console.error('[ClientRepo] Erro ao buscar calendário por mês:', {
                        clientId: normalizedClientId,
                        monthKey: key,
                        monthRef: key,
                        code: second.error.code,
                        message: second.error.message
                    });
                }
            }
            return null;
        },

        getCalendarMeta: async function(calendarId, clientId) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return null;
            const normalizedCalendarId = this.normalizeIdForFilter(calendarId) ?? String(calendarId || '').trim();
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
            const normalizedCalendarId = this.normalizeIdForFilter(calendarId) ?? String(calendarId || '').trim();
            console.log('[ClientRepo] getCalendarItems filter:', { calendarId: String(calendarId || '').trim(), normalizedCalendarId });

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
            const plataforma = String(params?.plataforma || params?.platform || params?.canal || '').trim();
            const formato = String(params?.formato || params?.format || params?.tipo_conteudo || params?.tipo || '').trim();

            if (!calendarId || !itemId || !clientId || !status) {
                return { ok: false, error: { message: 'missing_params' } };
            }

            const normalizedCalendarId = this.normalizeBigIntId(calendarId) ?? calendarId;
            const normalizedClientId = this.normalizeBigIntId(clientId) ?? clientId;
            const normalizedItemId = this.normalizeBigIntId(itemId) ?? itemId;
            const normalizedClientIdStr = /^\d+$/.test(String(normalizedClientId)) ? String(normalizedClientId) : String(clientId).trim();

            const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').slice(0, 10));
            const scheduled = isIsoDate(scheduledDate) ? String(scheduledDate).slice(0, 10) : '';
            const nowIso = new Date().toISOString();

            if (!scheduled) {
                return { ok: false, error: { message: 'missing_data_agendada' } };
            }

            const basePayload = {
                cliente_id: normalizedClientIdStr,
                calendar_id: normalizedCalendarId,
                calendar_item_id: normalizedItemId,
                status: status,
                data_agendada: scheduled,
                plataforma: plataforma || 'instagram',
                formato: formato || 'post_estatico',
                feedback_cliente: comment || null,
                feedback_ajuste: status === 'changes_requested' ? (comment || null) : null,
                tema: tema || null,
                legenda: legenda || null,
                updated_at: nowIso
            };

            const errorLooksLikeMissingColumn = (error, columnName) => {
                const msg = String(error?.message || '').toLowerCase();
                const col = String(columnName || '').toLowerCase();
                return error?.code === '42703' || msg.includes(`column ${col}`) || msg.includes(`"${col}"`) || msg.includes(`'${col}'`);
            };

            const applyWithFallback = async (op) => {
                let payload = { ...basePayload };
                let result = await op(payload);
                if (result?.error && errorLooksLikeMissingColumn(result.error, 'cliente_id')) {
                    payload = { ...payload };
                    delete payload.cliente_id;
                    result = await op(payload);
                }
                if (result?.error && errorLooksLikeMissingColumn(result.error, 'data_agendada')) {
                    payload = { ...payload };
                    delete payload.data_agendada;
                    result = await op(payload);
                }
                return result;
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
                    const { data, error } = await applyWithFallback((payload) => supabase
                        .from('social_posts')
                        .update(payload)
                        .eq('id', existing.id)
                        .select('*')
                        .maybeSingle());
                    if (error) return { ok: false, error };
                    return { ok: true, data: data || null };
                }

                const { data, error } = await applyWithFallback((payload) => supabase
                    .from('social_posts')
                    .insert(payload)
                    .select('*')
                    .maybeSingle());
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

        updateCalendarItemEditorialStatus: async function(itemId, clientId, patch) {
            const supabase = await this.getClient();
            if (!supabase || !itemId) return { ok: false, error: { message: 'missing_params' } };

            const normalizedItemId = this.normalizeIdForFilter ? this.normalizeIdForFilter(itemId) : String(itemId || '').trim();
            const normalizedClientId = this.normalizeIdForFilter ? this.normalizeIdForFilter(clientId) : null;
            const normalizedCalendarId = this.normalizeIdForFilter
                ? this.normalizeIdForFilter(patch?.calendar_id ?? patch?.calendarId)
                : null;

            const nextStatus = String(patch?.status || '').trim();
            const comment = String(patch?.comment || '').trim();
            const tema = String(patch?.tema || '').trim();
            const copy = String(patch?.copy || patch?.legenda || '').trim();
            const canal = String(patch?.canal || patch?.plataforma || '').trim();
            const tipo = String(patch?.tipo_conteudo || patch?.tipo || '').trim();
            const observacoes = String(patch?.observacoes || '').trim();

            const basePayload = {};
            if (nextStatus) basePayload.status = nextStatus;
            if (tema) basePayload.tema = tema;
            if (copy) basePayload.copy = copy;
            if (observacoes) basePayload.observacoes = observacoes;
            if (canal) basePayload.canal = canal;
            if (tipo) basePayload.tipo_conteudo = tipo;

            const errorLooksLikeMissingColumn = (error, columnName) => {
                const msg = String(error?.message || '').toLowerCase();
                const col = String(columnName || '').toLowerCase();
                return error?.code === '42703'
                    || error?.code === 'PGRST204'
                    || msg.includes(`column ${col}`)
                    || msg.includes(`"${col}"`)
                    || msg.includes(`'${col}'`)
                    || msg.includes(`could not find the '${col}' column`)
                    || msg.includes(`could not find the "${col}" column`);
            };

            const commentKeys = ['comentario_cliente', 'comentario', 'feedback_cliente', 'client_review_comment', 'review_comment'];
            const filterAttempts = normalizedClientId ? [true, false] : [false];
            const calendarAttempts = normalizedCalendarId ? [true, false] : [false];

            for (const useCalendarFilter of calendarAttempts) {
                for (const useClientFilter of filterAttempts) {
                    for (const commentKey of commentKeys) {
                        const payload = { ...basePayload };
                        if (comment) payload[commentKey] = comment;
                        try {
                            const finalPayload = { ...payload };
                            const filters = {
                                id: normalizedItemId,
                                calendar_id: useCalendarFilter ? normalizedCalendarId : null,
                                cliente_id: useClientFilter ? normalizedClientId : null
                            };
                            console.log('[ClientRepo] updateCalendarItemEditorialStatus attempt', { payload: finalPayload, filters });
                            let query = supabase
                                .from('social_calendar_items')
                                .update(finalPayload)
                                .eq('id', normalizedItemId)
                                .select('id,status,calendar_id');
                            if (useCalendarFilter) query = query.eq('calendar_id', normalizedCalendarId);
                            if (useClientFilter) query = query.eq('cliente_id', normalizedClientId);
                            const { data, error } = await query;
                            if (!error) {
                                const row = Array.isArray(data) ? data[0] : data;
                                if (row?.id) return { ok: true, data: row };
                                return { ok: false, error: { message: 'no_rows_updated', payload, filters: { id: normalizedItemId, calendar_id: useCalendarFilter ? normalizedCalendarId : null, cliente_id: useClientFilter ? normalizedClientId : null } } };
                            }
                            console.log('[ClientRepo] updateCalendarItemEditorialStatus error detail:', {
                                itemId: normalizedItemId,
                                calendarId: useCalendarFilter ? normalizedCalendarId : null,
                                clientId: useClientFilter ? normalizedClientId : null,
                                payload,
                                code: error?.code || null,
                                message: error?.message || null,
                                details: error?.details || null,
                                hint: error?.hint || null
                            });
                            if (useCalendarFilter && errorLooksLikeMissingColumn(error, 'calendar_id')) {
                                continue;
                            }
                            if (useClientFilter && errorLooksLikeMissingColumn(error, 'cliente_id')) {
                                continue;
                            }
                            if (comment && errorLooksLikeMissingColumn(error, commentKey)) {
                                continue;
                            }
                            return { ok: false, error };
                        } catch (error) {
                            return { ok: false, error };
                        }
                    }
                }
            }

            return { ok: false, error: { message: 'update_failed' } };
        },

        ensurePostDraftFromCalendarItem: async function(params) {
            const supabase = await this.getClient();
            if (!supabase) return { ok: false, error: { message: 'missing_supabase' } };

            const calendarId = String(params?.calendarId || '').trim();
            const calendarItemId = params?.calendarItemId ?? params?.itemId ?? null;
            const clientId = String(params?.clientId || '').trim();
            if (!calendarId || !calendarItemId || !clientId) return { ok: false, error: { message: 'missing_params' } };

            const scheduledDate = String(params?.scheduledDate || params?.data || '').slice(0, 10);
            const tema = String(params?.tema || '').trim();
            const legenda = String(params?.legenda || params?.copy || '').trim();
            const formato = String(params?.formato || params?.tipo_conteudo || '').trim();
            const plataforma = String(params?.plataforma || params?.canal || '').trim();

            try {
                const { data: existing, error: findError } = await supabase
                    .from('social_posts')
                    .select('*')
                    .eq('calendar_id', calendarId)
                    .eq('calendar_item_id', calendarItemId)
                    .maybeSingle();
                if (findError) return { ok: false, error: findError };

                if (existing?.id) {
                    const currentStatus = String(existing.status || '').trim().toLowerCase();
                    const shouldForceDraft = currentStatus === 'approved' || currentStatus === '';
                    const isHardFinal = ['scheduled', 'published'].includes(currentStatus);
                    const payload = {};
                    if (!isHardFinal && shouldForceDraft) payload.status = 'draft';
                    if (scheduledDate) payload.data_agendada = scheduledDate;
                    if (tema) payload.tema = tema;
                    if (legenda) payload.legenda = legenda;
                    if (formato) payload.formato = formato;
                    if (plataforma) payload.plataforma = plataforma;
                    if (!Object.keys(payload).length) return { ok: true, data: existing };

                    const { data, error } = await supabase
                        .from('social_posts')
                        .update(payload)
                        .eq('id', existing.id)
                        .select('*')
                        .maybeSingle();
                    if (error) return { ok: false, error };
                    return { ok: true, data: data || null };
                }

                const insertPayload = {
                    calendar_id: calendarId,
                    calendar_item_id: calendarItemId,
                    cliente_id: clientId,
                    status: 'draft',
                    data_agendada: scheduledDate || null,
                    tema: tema || null,
                    formato: formato || 'post_estatico',
                    plataforma: plataforma || 'instagram',
                    legenda: legenda || null
                };

                const { data, error } = await supabase
                    .from('social_posts')
                    .insert(insertPayload)
                    .select('*')
                    .maybeSingle();
                if (error) return { ok: false, error };
                return { ok: true, data: data || null };
            } catch (error) {
                return { ok: false, error };
            }
        },

        updateCalendarFeedback: async function(calendarId, clientId, comment) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return { ok: false, error: { message: 'missing_params' } };
            const normalizedCalendarId = this.normalizeIdForFilter ? this.normalizeIdForFilter(calendarId) : String(calendarId || '').trim();
            const payload = { comentario_cliente: String(comment || '').trim() || null };

            console.log('[ClientCalendar] about to update social_calendars from: ClientRepo.updateCalendarFeedback');
            const query = supabase
                .from('social_calendars')
                .update(payload)
                .eq('id', normalizedCalendarId);
            const { data, error } = await query.select('id,status');
            if (error) return { ok: false, error };
            return { ok: true, data: (data && data[0]) || null };
        },

        updateCalendarStatus: async function(calendarId, status, clientId) {
            const supabase = await this.getClient();
            if (!supabase || !calendarId) return { ok: false, error: { message: 'missing_params' } };
            const id = this.normalizeIdForFilter(calendarId) ?? String(calendarId || '').trim();
            if (!id) return { ok: false, error: { message: 'missing_params' } };
            const nextStatus = String(status || '').trim() || null;
            const normalizedClientId = clientId ? this.normalizeIdForFilter(clientId) : null;

            console.log('[ClientCalendar] about to update social_calendars from: ClientRepo.updateCalendarStatus');
            let query = supabase
                .from('social_calendars')
                .update({ status: nextStatus })
                .eq('id', id)
                .select('id,status,cliente_id')
                .maybeSingle();
            if (normalizedClientId) query = query.eq('cliente_id', normalizedClientId);
            const { data, error } = await query;

            if (error) {
                console.log('[ClientRepo] updateCalendarStatus error detail:', {
                    calendarId: id,
                    status: nextStatus,
                    payload: { status: nextStatus },
                    code: error?.code || null,
                    message: error?.message || null,
                    details: error?.details || null,
                    hint: error?.hint || null
                });
                return { error };
            }

            console.log('[ClientRepo] updateCalendarStatus success:', { calendarId: id, status: nextStatus });
            return { error: null, data };
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
