// js/v2/modules/social_media/social_media_repo.js
// Repositório de Dados de Social Media V2
// Responsável por buscar posts e dados de calendário no Supabase

(function(global) {
    const isDebug = () => global.__GQV_DEBUG_CONTEXT__ === true;
    let mesReferenciaFormatCache = null;
    let mesReferenciaFormatInFlight = null;

    const logQueryError = (name, table, filters, error) => {
        try {
            console.error('[SocialMediaRepo][QUERY_ERROR]', {
                name,
                table,
                filters,
                code: error?.code || null,
                message: error?.message || String(error || '')
            });
        } catch {}
    };

    const resolveMesReferenciaFormat = async () => {
        if (mesReferenciaFormatCache) return mesReferenciaFormatCache;
        if (mesReferenciaFormatInFlight) return await mesReferenciaFormatInFlight;
        if (!global.supabaseClient) return null;
        mesReferenciaFormatInFlight = (async () => {
            try {
                const { data, error } = await global.supabaseClient
                    .from('social_calendars')
                    .select('mes_referencia')
                    .limit(1);
                if (error) return null;
                const raw = String(Array.isArray(data) && data[0] ? data[0].mes_referencia : '').trim();
                if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return 'date';
                if (/^\d{4}-\d{2}$/.test(raw)) return 'month';
                return null;
            } catch {
                return null;
            }
        })();
        try {
            mesReferenciaFormatCache = await mesReferenciaFormatInFlight;
            return mesReferenciaFormatCache;
        } finally {
            mesReferenciaFormatInFlight = null;
        }
    };

    const SocialMediaRepo = {
        /**
         * Busca ou cria o calendário para um mês específico
         * @param {string} clientId 
         * @param {string} monthKey - Formato YYYY-MM
         * @returns {Promise<Object>} Dados do calendário (id, status)
         */
        getCalendarByMonth: async function(clientId, monthKey) {
            if (!global.supabaseClient || !monthKey) return null;

            const normalizedClientId = String(clientId ?? '').trim();
            if (!normalizedClientId) {
                console.warn('[SocialMediaRepo][STARTUP_TRACE] skip getCalendarByMonth (invalid clientId):', {
                    clientIdRaw: clientId,
                    clientIdNormalized: normalizedClientId,
                    monthKeyRaw: monthKey
                });
                return null;
            }

            const normalizedMonthKey = String(monthKey || '').trim().slice(0, 7);
            const monthStart = /^\d{4}-\d{2}$/.test(normalizedMonthKey)
                ? (global.MonthUtils?.buildMonthReferenceFromMonthKey ? global.MonthUtils.buildMonthReferenceFromMonthKey(normalizedMonthKey) : `${normalizedMonthKey}-01`)
                : '';
            const mesReferenciaValue = monthStart;
            if (!mesReferenciaValue) return null;

            if (isDebug()) console.log('[SocialMediaRepo] getCalendarByMonth:', { clientId: normalizedClientId, monthKey: normalizedMonthKey });
            console.log('[AgencyCalendar] query payload:', { function: 'getCalendarByMonth', table: 'social_calendars', cliente_id: normalizedClientId, mes_referencia: mesReferenciaValue, monthKey: normalizedMonthKey, monthStart });

            try {
                // Tenta buscar existente
                let { data: calendarData, error: calendarError } = await global.supabaseClient
                    .from('social_calendars')
                    .select('*')
                    .eq('cliente_id', normalizedClientId)
                    .eq('mes_referencia', mesReferenciaValue)
                    .maybeSingle();

                if (calendarError) {
                    console.error('[AgencyCalendar] query error:', { function: 'getCalendarByMonth', table: 'social_calendars', cliente_id: normalizedClientId, mes_referencia: mesReferenciaValue, code: calendarError?.code || null, message: calendarError?.message || null });
                    logQueryError('getCalendarByMonth', 'social_calendars', { cliente_id: normalizedClientId, mes_referencia: mesReferenciaValue }, calendarError);
                    throw calendarError;
                }
                if (calendarData) return calendarData;

                // Se não existir, cria
                console.log('[SOCIAL] Criando calendário para:', mesReferenciaValue);
                let { data: createdCalendar, error: createError } = await global.supabaseClient
                    .from('social_calendars')
                    .insert({
                        cliente_id: normalizedClientId,
                        mes_referencia: mesReferenciaValue,
                        status: 'draft',
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();
                
                if (createError) {
                     // Tratamento de concorrência (pode ter sido criado nesse milissegundo)
                     if (createError.code === '23505') { // Unique violation
                        const { data: retryData } = await global.supabaseClient
                            .from('social_calendars')
                            .select('*')
                            .eq('cliente_id', normalizedClientId)
                            .eq('mes_referencia', mesReferenciaValue)
                            .maybeSingle();
                        return retryData;
                     }
                     logQueryError('getCalendarByMonth:create', 'social_calendars', { cliente_id: normalizedClientId, mes_referencia: mesReferenciaValue }, createError);
                     throw createError;
                }

                return createdCalendar;
            } catch (err) {
                console.error('[SOCIAL] Erro em getCalendarByMonth:', err);
                return null;
            }
        },

        uploadFile: async function(file, clientId) {
            if (!global.supabaseClient || !file) return null;
            const normalizedClientId = String(clientId ?? '').trim();
            if (!normalizedClientId) return null;

            try {
                const fileExt = String(file.name || '').split('.').pop();
                const fileName = `${normalizedClientId}/${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error } = await global.supabaseClient.storage
                    .from('social-media-assets')
                    .upload(filePath, file, { cacheControl: '3600', upsert: false });
                if (error) throw error;

                const { data: publicData } = global.supabaseClient.storage
                    .from('social-media-assets')
                    .getPublicUrl(filePath);
                return publicData?.publicUrl || null;
            } catch (err) {
                console.error('[SOCIAL] Falha ao fazer upload:', err);
                return null;
            }
        },

        /**
         * Busca posts de um calendário específico
         * @param {string} calendarId 
         * @returns {Promise<Array>} Lista de posts
         */
        getPostsByCalendar: async function(calendarId) {
            if (!global.supabaseClient || !calendarId) return [];

            try {
                const { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .select('*')
                    .eq('calendar_id', calendarId)
                    .order('data_agendada', { ascending: true });

                if (error) throw error;
                return data || [];
            } catch (err) {
                console.error('[SOCIAL] Erro ao buscar posts do calendário:', err);
                return [];
            }
        },

        getCalendarItems: async function(calendarId) {
            if (!global.supabaseClient) return [];
            const id = String(calendarId || '').trim();
            if (!id) return [];

            try {
                const { data, error } = await global.supabaseClient
                    .from('social_calendar_items')
                    .select('*')
                    .eq('calendar_id', id)
                    .order('data', { ascending: true });

                if (error) throw error;
                return data || [];
            } catch (err) {
                console.error('[AgencyCalendar] query error:', { function: 'getCalendarItems', table: 'social_calendar_items', calendar_id: id, code: err?.code || null, message: err?.message || null });
                logQueryError('getCalendarItems', 'social_calendar_items', { calendar_id: id }, err);
                console.error('[SOCIAL] Erro ao buscar itens do calendário:', err);
                return [];
            }
        },

        upsertCalendarItem: async function(input) {
            if (!global.supabaseClient || !input) return null;
            const calendarId = input.calendar_id || input.calendarId || null;
            const date = (input.data || input.date || '').slice(0, 10);
            const tema = String(input.tema || input.title || '').trim();
            const tipoConteudo = String(input.tipo_conteudo || input.content_type || input.formato || 'post_estatico').trim() || 'post_estatico';
            const canal = String(input.canal || input.platform || 'instagram').trim() || 'instagram';
            const observacoes = input.observacoes ?? input.notes ?? null;

            if (!calendarId || !date || !tema) return null;

            const payload = {
                calendar_id: calendarId,
                data: date,
                tema,
                tipo_conteudo: tipoConteudo,
                canal,
                observacoes,
                updated_at: new Date().toISOString()
            };

            try {
                if (input.id) {
                    const { data, error } = await global.supabaseClient
                        .from('social_calendar_items')
                        .update(payload)
                        .eq('id', input.id)
                        .select()
                        .single();
                    if (error) throw error;
                    return data || null;
                }

                const { data, error } = await global.supabaseClient
                    .from('social_calendar_items')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                return data || null;
            } catch (err) {
                console.error('[SOCIAL] Erro ao salvar item do calendário:', err);
                return null;
            }
        },

        insertCalendarItemsBatch: async function(calendarId, items) {
            if (!global.supabaseClient) return { ok: false, error: 'db_not_ready' };
            const id = String(calendarId || '').trim();
            const list = Array.isArray(items) ? items : [];
            if (!id || !list.length) return { ok: true, data: [], inserted: 0 };

            const payloads = list
                .map((it) => {
                    const date = String(it?.data || it?.date || '').slice(0, 10);
                    const tema = String(it?.tema || it?.title || '').trim();
                    const tipo_conteudo = String(it?.tipo_conteudo || it?.formato || it?.content_type || 'post_estatico').trim() || 'post_estatico';
                    const canal = String(it?.canal || it?.channel || it?.platform || 'instagram').trim() || 'instagram';
                    const observacoes = it?.observacoes ?? it?.notes ?? null;
                    if (!date || !tema) return null;
                    return {
                        calendar_id: id,
                        data: date,
                        tema,
                        tipo_conteudo,
                        canal,
                        observacoes,
                        updated_at: new Date().toISOString()
                    };
                })
                .filter(Boolean);

            if (!payloads.length) return { ok: true, data: [], inserted: 0 };

            try {
                const { data, error } = await global.supabaseClient
                    .from('social_calendar_items')
                    .insert(payloads)
                    .select('*');
                if (error) throw error;
                const out = Array.isArray(data) ? data : [];
                return { ok: true, data: out, inserted: out.length };
            } catch (err) {
                console.error('[SOCIAL] Erro ao inserir itens em lote:', err);
                return { ok: false, error: err };
            }
        },

        insertAICalendarItems: async function(items, calendarId, clienteId, options = {}) {
            if (!global.supabaseClient) return { ok: false, error: 'db_not_ready' };
            const clientId = String(clienteId || '').trim();
            if (!clientId) return { ok: false, error: 'cliente_missing' };

            const monthKeyFromOptions = String(options?.monthKey || '').trim().slice(0, 7);
            const monthKeyFromState = global.CalendarStateManager?.getState ? String(global.CalendarStateManager.getState()?.monthKey || '').trim().slice(0, 7) : '';
            const monthKey = monthKeyFromOptions || monthKeyFromState;

            let calId = String(calendarId || '').trim();
            if (!calId) {
                const cal = await this.getCalendarByMonth(clientId, monthKey);
                calId = String(cal?.id || '').trim();
            }
            if (!calId) return { ok: false, error: 'calendar_not_found' };

            const list = Array.isArray(items) ? items : [];
            if (!list.length) return { ok: true, inserted: 0, insertedIds: [], calendarId: calId };

            let hasExisting = false;
            try {
                const { data, error } = await global.supabaseClient
                    .from('social_calendar_items')
                    .select('id')
                    .eq('calendar_id', calId)
                    .limit(1);
                if (!error && Array.isArray(data) && data.length) hasExisting = true;
            } catch {}

            if (hasExisting) {
                const confirmed = typeof global.confirm === 'function'
                    ? global.confirm('Já existem itens neste mês. Substituir o planejamento atual pelos itens gerados por IA?')
                    : false;
                if (!confirmed) return { ok: false, error: 'cancelled_by_user' };

                try {
                    const { error: delErr } = await global.supabaseClient
                        .from('social_calendar_items')
                        .delete()
                        .eq('calendar_id', calId);
                    if (delErr) throw delErr;
                } catch (err) {
                    return { ok: false, error: err };
                }
            }

            const normalizeFormat = (raw) => {
                const f = String(raw || '').trim().toLowerCase();
                if (f === 'imagem') return 'post_estatico';
                if (f === 'reels') return 'reels';
                if (f === 'carrossel') return 'carrossel';
                return f || 'post_estatico';
            };

            const opTag = `ai_gen:${Date.now().toString(36)}`;
            const payloadsBase = list
                .map((it) => {
                    const data = String(it?.date || '').slice(0, 10);
                    const tema = String(it?.theme || '').trim();
                    const tipo_conteudo = normalizeFormat(it?.format);
                    const canal = String(it?.channel || 'instagram').trim() || 'instagram';
                    const caption = String(it?.caption_base || '').trim();
                    const notes = String(it?.notes || '').trim();
                    if (!data || !tema) return null;
                    const observacoes = [notes, caption ? `Copy base:\n${caption}` : '', `[${opTag}]`].filter(Boolean).join('\n\n');
                    return {
                        calendar_id: calId,
                        data,
                        tema,
                        tipo_conteudo,
                        canal,
                        observacoes,
                        updated_at: new Date().toISOString()
                    };
                })
                .filter(Boolean);

            if (!payloadsBase.length) return { ok: true, inserted: 0, insertedIds: [], calendarId: calId };

            const tryInsert = async (payloads) => {
                const { data, error } = await global.supabaseClient
                    .from('social_calendar_items')
                    .insert(payloads)
                    .select('id');
                if (error) throw error;
                const rows = Array.isArray(data) ? data : [];
                const ids = rows.map((r) => r?.id).filter(Boolean);
                return ids;
            };

            try {
                const ids = await tryInsert(payloadsBase);
                return { ok: true, inserted: ids.length, insertedIds: ids, calendarId: calId };
            } catch (err) {
                const msg = String(err?.message || '').toLowerCase();
                const shouldRetry = msg.includes('column') || msg.includes('unknown');
                if (!shouldRetry) return { ok: false, error: err };

                const withoutOptional = payloadsBase.map((p) => {
                    const next = { ...p };
                    return next;
                });
                try {
                    const ids = await tryInsert(withoutOptional);
                    return { ok: true, inserted: ids.length, insertedIds: ids, calendarId: calId };
                } catch (err2) {
                    return { ok: false, error: err2 };
                }
            }
        },

        deleteCalendarItemsByIds: async function(ids) {
            if (!global.supabaseClient) return false;
            const list = Array.isArray(ids) ? ids.filter(Boolean) : [];
            if (!list.length) return true;
            try {
                const { error } = await global.supabaseClient
                    .from('social_calendar_items')
                    .delete()
                    .in('id', list);
                if (error) throw error;
                return true;
            } catch {
                return false;
            }
        },

        deleteCalendarItem: async function(itemId) {
            if (!global.supabaseClient || !itemId) return false;
            try {
                const { error } = await global.supabaseClient
                    .from('social_calendar_items')
                    .delete()
                    .eq('id', itemId);
                if (error) throw error;
                return true;
            } catch (err) {
                console.error('[SOCIAL] Erro ao excluir item do calendário:', err);
                return false;
            }
        },

        deleteCalendarDraft: async function(calendarId) {
            if (!global.supabaseClient || !calendarId) return { ok: false, error: 'missing_params' };
            const id = String(calendarId || '').trim();
            if (!id) return { ok: false, error: 'missing_params' };

            try {
                const { data: calendar, error: calError } = await global.supabaseClient
                    .from('social_calendars')
                    .select('id,status')
                    .eq('id', id)
                    .maybeSingle();
                if (calError) throw calError;
                if (!calendar?.id) return { ok: false, error: 'calendar_not_found' };

                const status = String(calendar.status || '').trim().toLowerCase();
                const deletable = new Set(['draft', 'rascunho']);
                if (!deletable.has(status)) {
                    return { ok: false, error: { message: 'calendar_not_deletable', status } };
                }

                const { error: itemsError } = await global.supabaseClient
                    .from('social_calendar_items')
                    .delete()
                    .eq('calendar_id', id);
                if (itemsError) throw itemsError;

                const { error: postsError } = await global.supabaseClient
                    .from('social_posts')
                    .delete()
                    .eq('calendar_id', id);
                if (postsError) throw postsError;

                const { error: deleteError } = await global.supabaseClient
                    .from('social_calendars')
                    .delete()
                    .eq('id', id);
                if (deleteError) throw deleteError;

                return { ok: true };
            } catch (err) {
                console.error('[SOCIAL] Erro ao excluir calendário:', err);
                return { ok: false, error: err };
            }
        },

        updateCalendarStatus: async function(calendarId, clientId, status) {
            if (!global.supabaseClient || !calendarId) return { ok: false, error: 'missing_params' };
            const id = String(calendarId || '').trim();
            const normalizedClientId = String(clientId || '').trim();
            if (!id) return { ok: false, error: 'missing_params' };

            const raw = String(status || '').trim().toLowerCase();
            const map = {
                aguardando_aprovacao: 'sent_for_approval',
                awaiting_approval: 'sent_for_approval',
                ready_for_approval: 'sent_for_approval',
                sent_for_approval: 'sent_for_approval',
                rascunho: 'draft',
                ajuste_solicitado: 'needs_changes',
                changes_requested: 'needs_changes',
                needs_changes: 'needs_changes',
                aprovado: 'approved',
                em_producao: 'in_production',
                publicado: 'published',
                concluido: 'archived',
                concluído: 'archived'
            };
            const next = map[raw] || raw;

            try {
                let query = global.supabaseClient
                    .from('social_calendars')
                    .update({ status: next, updated_at: new Date().toISOString() })
                    .eq('id', id);
                if (normalizedClientId) query = query.eq('cliente_id', normalizedClientId);
                const { data, error } = await query.select('*').maybeSingle();
                if (error) throw error;
                return { ok: true, data: data || null };
            } catch (err) {
                console.error('[SOCIAL] Erro ao atualizar status do calendário:', err);
                return { ok: false, error: err };
            }
        },

        generatePostsFromCalendarItems: async function(calendarId) {
            if (!global.supabaseClient || !calendarId) return { ok: false, error: 'missing_params' };
            try {
                const { data: calendar, error: calError } = await global.supabaseClient
                    .from('social_calendars')
                    .select('id,cliente_id,status')
                    .eq('id', calendarId)
                    .maybeSingle();
                if (calError) throw calError;
                if (!calendar) return { ok: false, error: 'calendar_not_found' };

                const calStatus = String(calendar.status || '').trim().toLowerCase();
                const approvedStatuses = new Set(['approved', 'aprovado']);
                if (!approvedStatuses.has(calStatus)) {
                    return { ok: false, error: 'calendar_not_approved' };
                }

                const items = await this.getCalendarItems(calendarId);
                if (!items.length) return { ok: true, created: 0, skipped: 0 };

                const itemIds = items.map((it) => it.id).filter(Boolean);
                const { data: existing, error: existingErr } = await global.supabaseClient
                    .from('social_posts')
                    .select('id,calendar_item_id')
                    .eq('calendar_id', calendarId)
                    .in('calendar_item_id', itemIds);
                if (existingErr) throw existingErr;
                const existingSet = new Set((existing || []).map((p) => String(p.calendar_item_id)).filter(Boolean));

                const toInsert = items
                    .filter((it) => it?.id && !existingSet.has(String(it.id)))
                    .map((it) => ({
                        calendar_id: calendarId,
                        calendar_item_id: it.id,
                        cliente_id: calendar.cliente_id,
                        data_agendada: String(it.data || '').slice(0, 10),
                        tema: it.tema,
                        formato: it.tipo_conteudo || 'post_estatico',
                        plataforma: it.canal || 'instagram',
                        legenda: '',
                        detailed_content: '',
                        status: 'draft',
                        updated_at: new Date().toISOString()
                    }));

                if (!toInsert.length) return { ok: true, created: 0, skipped: items.length };

                const { data: inserted, error: insertErr } = await global.supabaseClient
                    .from('social_posts')
                    .insert(toInsert)
                    .select('id,calendar_item_id');
                if (insertErr) throw insertErr;

                return { ok: true, created: (inserted || []).length, skipped: items.length - (inserted || []).length };
            } catch (err) {
                console.error('[SOCIAL] Erro ao gerar posts a partir dos itens:', err);
                return { ok: false, error: err };
            }
        },

        /**
         * Cria um novo post manual
         * @param {Object} input - Dados do post
         * @returns {Promise<Object>} Resultado da operação
         */
        createPost: async function(input) {
            if (isDebug()) console.log('[SocialMediaRepo] createPost payload:', input);

            if (!global.supabaseClient) {
                throw new Error('Banco de dados não conectado');
            }

            const normalizedClientId = String(input?.cliente_id ?? '').trim();
            if (!normalizedClientId) {
                throw new Error('Cliente não identificado');
            }

            try {
                const clientId = normalizedClientId;
                const localToday = global.MonthUtils?.formatLocalDate ? global.MonthUtils.formatLocalDate(new Date()) : '';
                const postDate = input.data_agendada || input.data || localToday;
                const title = input.titulo || input.tema || input.title || 'Post';
                const content = input.content || input.detailed_content || input.legenda || '';
                
                // Normalização de status
                let status = input.status || 'draft';
                const statusMap = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS_MAP : {
                    'rascunho': 'draft',
                    'para_producao': 'in_production',
                    'para_produção': 'in_production',
                    'pendente_aprovacao': 'ready_for_approval',
                    'awaiting_approval': 'ready_for_approval',
                    'aprovado': 'approved',
                    'rejeitado': 'rejected',
                    'agendado': 'scheduled',
                    'publicado': 'published',
                    'ajustes_solicitados': 'changes_requested'
                };
                
                if (statusMap[status]) status = statusMap[status];
                
                // Normalização de formato
                let formato = input.formato || input.tipo_conteudo || 'post_estatico';

                // Mês de referência: YYYY-MM
                const monthKey = postDate && String(postDate).length >= 7 ? String(postDate).slice(0, 7) : '';
                const monthRef = global.MonthUtils?.buildMonthReferenceFromMonthKey
                    ? global.MonthUtils.buildMonthReferenceFromMonthKey(monthKey)
                    : (monthKey ? `${monthKey}-01` : '');
                const mesReferenciaValue = monthRef;
                if (!mesReferenciaValue) throw new Error('mes_referencia_invalid');

                // Busca calendário existente com tratamento de erro
                const { data: calendarData, error: calendarError } = await global.supabaseClient
                    .from('social_calendars')
                    .select('id')
                    .eq('cliente_id', clientId)
                    .eq('mes_referencia', mesReferenciaValue)
                    .maybeSingle();

                let calendarId = calendarData?.id || null;

                // Se não encontrou ou deu erro, tenta criar
                if (!calendarId) {
                    console.log('[SOCIAL] Calendário não encontrado, criando novo para:', mesReferenciaValue);
                    const { data: createdCalendar, error: createError } = await global.supabaseClient
                        .from('social_calendars')
                        .insert({
                            cliente_id: clientId,
                            mes_referencia: mesReferenciaValue,
                            status: 'draft',
                            updated_at: new Date().toISOString()
                        })
                        .select()
                        .single();
                    
                    if (createError) {
                        // Se erro for duplicidade (pode ter sido criado concorrentemente), tenta buscar de novo
                        console.warn('[SOCIAL] Erro ao criar calendário (possível concorrência), tentando recuperar...', createError);
                        const { data: retryData } = await global.supabaseClient
                            .from('social_calendars')
                            .select('id')
                            .eq('cliente_id', clientId)
                            .eq('mes_referencia', mesReferenciaValue)
                            .maybeSingle();
                        
                        if (retryData?.id) {
                            calendarId = retryData.id;
                        } else {
                            console.error('[SOCIAL] Falha definitiva ao obter calendário base:', createError);
                            throw createError; 
                        }
                    } else {
                        calendarId = createdCalendar?.id;
                    }
                }

                const dbPayload = {
                    calendar_id: calendarId,
                    data_agendada: postDate,
                    tema: title,
                    formato: formato,
                    legenda: content,
                    detailed_content: input.detailed_content || content,
                    status,
                    sugestao_criativo: input.sugestao_criativo || input.criativo || input.creative || null,
                    cta: input.cta || null,
                    hashtags: input.hashtags || null,
                    imagem_url: input.imagem_url || input.media_url || null,
                    plataforma: input.plataforma || input.platform || null
                };
                console.log('[SocialCalendar] insert post payload', dbPayload);
                const { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .insert([dbPayload])
                    .select()
                    .single();

                if (error) throw error;
                if (isDebug()) console.log('[SocialMediaRepo] createPost success:', data);
                return data;
            } catch (err) {
                console.error('[SOCIAL] Falha ao criar post:', err);
                throw err;
            }
        },

        /**
         * Atualiza um post existente
         * @param {string} postId
         * @param {Object} input - Dados para atualizar
         * @returns {Promise<Object>} Resultado da operação
         */
        updatePost: async function(postId, input) {
            if (isDebug()) console.log('[SocialMediaRepo] updatePost:', { postId, input });

            if (!global.supabaseClient || !postId) return null;

            const dbPayload = {};
            
            // Mapeamento correto para social_posts
            if (input.titulo !== undefined || input.title !== undefined || input.tema !== undefined) {
                dbPayload.tema = input.tema || input.titulo || input.title;
            }
            if (input.formato !== undefined || input.tipo_conteudo !== undefined) {
                dbPayload.formato = input.formato || input.tipo_conteudo;
            }
            if (input.legenda !== undefined || input.content !== undefined) {
                dbPayload.legenda = input.legenda || input.content;
            }
            if (input.detailed_content !== undefined) {
                dbPayload.detailed_content = input.detailed_content;
            }
            if (input.sugestao_criativo !== undefined || input.criativo !== undefined || input.creative !== undefined) {
                dbPayload.sugestao_criativo = input.sugestao_criativo || input.criativo || input.creative;
            }
            if (input.data_agendada !== undefined || input.data !== undefined) {
                dbPayload.data_agendada = input.data_agendada || input.data;
            }
            if (input.status !== undefined) {
                let status = input.status;
                const statusMap = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS_MAP : {
                    'rascunho': 'draft',
                    'para_producao': 'in_production',
                    'para_produção': 'in_production',
                    'pendente_aprovacao': 'ready_for_approval',
                    'awaiting_approval': 'ready_for_approval',
                    'aprovado': 'approved',
                    'rejeitado': 'rejected',
                    'agendado': 'scheduled',
                    'publicado': 'published',
                    'ajustes_solicitados': 'changes_requested'
                };
                if (statusMap[status]) status = statusMap[status];
                dbPayload.status = status;
            }
            if (input.cta !== undefined) dbPayload.cta = input.cta;
            if (input.hashtags !== undefined) dbPayload.hashtags = input.hashtags;
            if (input.imagem_url !== undefined || input.media_url !== undefined) {
                dbPayload.imagem_url = input.imagem_url || input.media_url;
            }
            if (input.plataforma !== undefined || input.platform !== undefined) {
                dbPayload.plataforma = input.plataforma || input.platform;
            }

            try {
                // Tenta atualizar em 'social_posts'
                let { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .update(dbPayload)
                    .eq('id', postId)
                    .select();

                if (error) throw error;
                if (isDebug()) console.log('[SocialMediaRepo] updatePost success:', data);
                return data;
            } catch (err) {
                console.error('[SOCIAL] Falha ao atualizar post:', err);
                throw err;
            }
        },

        /**
         * Exclui um post
         * @param {string} postId
         * @returns {Promise<boolean>} Sucesso ou falha
         */
        deletePost: async function(postId) {
            if (!global.supabaseClient || !postId) return false;

            try {
                // Tenta deletar de 'social_posts'
                let { error } = await global.supabaseClient
                    .from('social_posts')
                    .delete()
                    .eq('id', postId);

                if (error) throw error;
                return true;
            } catch (err) {
                console.error('[SocialMediaRepo] Falha ao excluir post:', err);
                return false;
            }
        },

        /**
         * Atualiza apenas a data de um post (otimizado para Drag and Drop)
         * @param {string} postId
         * @param {string} newDate (YYYY-MM-DD)
         * @returns {Promise<boolean>} Sucesso
         */
        updatePostDate: async function(postId, newDate) {
            if (!global.supabaseClient || !postId || !newDate) return false;

            try {
                // Tenta atualizar em 'social_posts'
                let { error } = await global.supabaseClient
                    .from('social_posts')
                    .update({ data_agendada: newDate })
                    .eq('id', postId);

                if (error) throw error;
                return true;
            } catch (err) {
                console.error('[SOCIAL] Falha ao mover post:', err);
                return false;
            }
        },

        /**
         * Atualiza o status de um post
         * @param {string} postId
         * @param {string} newStatus (rascunho, pendente_aprovacao, aprovado)
         * @returns {Promise<boolean>} Sucesso
         */
        updatePostStatus: async function(postId, newStatus) {
            if (!global.supabaseClient || !postId || !newStatus) return false;
            let normalizedStatus = newStatus;
            const statusMap = {
                'rascunho': 'draft',
                'para_producao': 'in_production',
                'para_produção': 'in_production',
                'pendente_aprovacao': 'ready_for_approval',
                'awaiting_approval': 'ready_for_approval',
                'aprovado': 'approved',
                'rejeitado': 'rejected',
                'agendado': 'scheduled',
                'publicado': 'published',
                'ajustes_solicitados': 'changes_requested'
            };
            if (statusMap[newStatus]) normalizedStatus = statusMap[newStatus];

            try {
                // Tenta atualizar em 'social_posts'
                let { error } = await global.supabaseClient
                    .from('social_posts')
                    .update({ status: normalizedStatus })
                    .eq('id', postId);

                if (error) throw error;
                return true;
            } catch (err) {
                console.error('[SOCIAL] Falha ao atualizar status:', err);
                return false;
            }
        },

        /**
         * Atualiza apenas o feedback/comentário de um post
         * @param {string} postId
         * @param {string} comment
         * @returns {Promise<boolean>} Sucesso
         */
        updatePostFeedback: async function(postId, comment) {
            if (!global.supabaseClient || !postId) return false;

            try {
                // Tenta atualizar em 'social_posts'
                let { error } = await global.supabaseClient
                    .from('social_posts')
                    .update({ feedback_aprovacao: comment })
                    .eq('id', postId);

                if (error) throw error;
                return true;
            } catch (err) {
                console.error('[SOCIAL] Falha ao atualizar feedback:', err);
                return false;
            }
        },

        /**
         * Busca posts de um cliente em um intervalo de datas
         * @param {string} clientId
         * @param {string} startDate (YYYY-MM-DD)
         * @param {string} endDateExclusive (YYYY-MM-DD)
         * @returns {Promise<Array>} Lista de posts
         */
        getPostsByDateRange: async function(clientId, startDate, endDateExclusive) {
            if (!global.supabaseClient) return [];
            const normalizedClientId = String(clientId || '').trim();
            const start = String(startDate || '').slice(0, 10);
            const end = String(endDateExclusive || '').slice(0, 10);
            const isIso = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);
            if (!normalizedClientId || !isIso(start) || !isIso(end)) {
                console.error('[AgencyCalendar] query error:', {
                    function: 'getPostsByDateRange',
                    table: 'social_posts',
                    cliente_id: normalizedClientId || null,
                    data_agendada_gte: startDate,
                    data_agendada_lt: endDateExclusive,
                    reason: 'invalid_params'
                });
                return [];
            }
            console.log('[AgencyCalendar] query payload:', {
                function: 'getPostsByDateRange',
                table: 'social_posts',
                cliente_id: normalizedClientId,
                data_agendada_gte: start,
                data_agendada_lt: end
            });

            try {
                const clientValue = /^\d+$/.test(normalizedClientId) ? Number(normalizedClientId) : normalizedClientId;

                let { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .select('*, social_calendars!inner(cliente_id)')
                    .eq('social_calendars.cliente_id', clientValue)
                    .gte('data_agendada', start)
                    .lt('data_agendada', end)
                    .order('data_agendada', { ascending: true });

                if (error) {
                    const msg = String(error?.message || '');
                    const shouldFallback =
                        error?.code === 'PGRST200' ||
                        msg.toLowerCase().includes('relationship') ||
                        msg.toLowerCase().includes('foreign key');
                    if (!shouldFallback) throw error;

                    ({ data, error } = await global.supabaseClient
                        .from('social_posts')
                        .select('*')
                        .eq('cliente_id', clientValue)
                        .gte('data_agendada', start)
                        .lt('data_agendada', end)
                        .order('data_agendada', { ascending: true }));
                }

                if (error) throw error;
                return data || [];
            } catch (err) {
                console.error('[AgencyCalendar] query error:', { function: 'getPostsByDateRange', table: 'social_posts', cliente_id: normalizedClientId, data_agendada_gte: start, data_agendada_lt: end, code: err?.code || null, message: err?.message || null });
                logQueryError('getPostsByDateRange', 'social_posts', { cliente_id: normalizedClientId, data_agendada_gte: start, data_agendada_lt: end }, err);
                console.error('[SOCIAL] Falha ao buscar posts por range:', err);
                return [];
            }
        },

        /**
         * Busca posts de um cliente específico (Todos)
         * @param {string} clientId 
         * @returns {Promise<Array>} Lista de posts
         */
        getPostsByClient: async function(clientId) {
            if (!global.supabaseClient || !clientId) return [];

            try {
                const normalizedClientId = String(clientId || '').trim();
                const clientValue = /^\d+$/.test(normalizedClientId) ? Number(normalizedClientId) : normalizedClientId;

                let { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .select('*, social_calendars!inner(cliente_id)')
                    .eq('social_calendars.cliente_id', clientValue)
                    .order('data_agendada', { ascending: false });

                if (error) {
                    const msg = String(error?.message || '');
                    const shouldFallback =
                        error?.code === 'PGRST200' ||
                        msg.toLowerCase().includes('relationship') ||
                        msg.toLowerCase().includes('foreign key');
                    if (!shouldFallback) throw error;

                    ({ data, error } = await global.supabaseClient
                        .from('social_posts')
                        .select('*')
                        .eq('cliente_id', clientValue)
                        .order('data_agendada', { ascending: false }));
                }

                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('[SOCIAL] Erro ao buscar posts:', error);
                return [];
            }
        },

        getPostAuditEvents: async function(postId) {
            if (!global.supabaseClient || !postId) return [];

            try {
                const { data, error } = await global.supabaseClient
                    .from('social_approvals')
                    .select('post_id,version_id,decision,decided_by,decided_at,comment')
                    .eq('post_id', postId)
                    .order('decided_at', { ascending: false });

                if (error) throw error;
                return data || [];
            } catch (err) {
                console.error('[SOCIAL] Erro ao buscar histórico do post:', err);
                return [];
            }
        }
    };

    global.SocialMediaRepo = SocialMediaRepo;

})(window);
