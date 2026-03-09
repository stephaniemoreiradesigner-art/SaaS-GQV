// js/v2/modules/social_media/social_media_repo.js
// Repositório de Dados de Social Media V2
// Responsável por buscar posts e dados de calendário no Supabase

(function(global) {
    const SocialMediaRepo = {
        /**
         * Busca ou cria o calendário para um mês específico
         * @param {string} clientId 
         * @param {string} monthRef - Formato YYYY-MM-01
         * @returns {Promise<Object>} Dados do calendário (id, status)
         */
        getCalendarByMonth: async function(clientId, monthRef) {
            if (!global.supabaseClient || !clientId || !monthRef) return null;

            try {
                // Tenta buscar existente
                const { data: calendarData, error: calendarError } = await global.supabaseClient
                    .from('social_calendars')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .eq('mes_referencia', monthRef)
                    .maybeSingle();

                if (calendarData) return calendarData;

                // Se não existir, cria
                console.log('[SOCIAL] Criando calendário para:', monthRef);
                const { data: createdCalendar, error: createError } = await global.supabaseClient
                    .from('social_calendars')
                    .insert({
                        cliente_id: clientId,
                        mes_referencia: monthRef,
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
                            .eq('cliente_id', clientId)
                            .eq('mes_referencia', monthRef)
                            .maybeSingle();
                        return retryData;
                     }
                     throw createError;
                }

                return createdCalendar;
            } catch (err) {
                console.error('[SOCIAL] Erro em getCalendarByMonth:', err);
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

        /**
         * Cria um novo post manual
         * @param {Object} input - Dados do post
         * @returns {Promise<Object>} Resultado da operação
         */
        createPost: async function(input) {
            if (!global.supabaseClient) {
                throw new Error('Banco de dados não conectado');
            }

            if (!input.cliente_id && !input.client_id) {
                throw new Error('Cliente não identificado');
            }

            try {
                const clientId = input.cliente_id || input.client_id;
                const postDate = input.data_postagem || input.post_date || new Date().toISOString().slice(0, 10);
                const title = input.titulo || input.tema || input.title || 'Post';
                const content = input.content || input.detailed_content || input.legenda || '';
                
                // Normalização de status
                let status = input.status || 'draft';
                const statusMap = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS_MAP : {
                    'rascunho': 'draft',
                    'pendente_aprovacao': 'ready_for_approval',
                    'awaiting_approval': 'ready_for_approval',
                    'aprovado': 'approved',
                    'rejeitado': 'rejected',
                    'agendado': 'scheduled',
                    'publicado': 'published'
                };
                
                if (statusMap[status]) status = statusMap[status];
                
                // Normalização de formato
                let formato = input.formato || input.tipo_conteudo || 'post_estatico';

                // Correção do mês de referência para sempre ser YYYY-MM-01
                let monthRef;
                if (postDate && postDate.length >= 7) {
                    monthRef = `${postDate.slice(0, 7)}-01`;
                } else {
                    monthRef = new Date().toISOString().slice(0, 7) + '-01';
                }

                // Busca calendário existente com tratamento de erro
                const { data: calendarData, error: calendarError } = await global.supabaseClient
                    .from('social_calendars')
                    .select('id')
                    .eq('cliente_id', clientId)
                    .eq('mes_referencia', monthRef)
                    .maybeSingle();

                let calendarId = calendarData?.id || null;

                // Se não encontrou ou deu erro, tenta criar
                if (!calendarId) {
                    console.log('[SOCIAL] Calendário não encontrado, criando novo para:', monthRef);
                    const { data: createdCalendar, error: createError } = await global.supabaseClient
                        .from('social_calendars')
                        .insert({
                            cliente_id: clientId,
                            mes_referencia: monthRef,
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
                            .eq('mes_referencia', monthRef)
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
                    cliente_id: clientId,
                    data_agendada: postDate,
                    tema: title,
                    formato: formato,
                    legenda: content,
                    detailed_content: input.detailed_content || content,
                    status,
                    cta: input.cta || null,
                    hashtags: input.hashtags || null,
                    imagem_url: input.imagem_url || input.media_url || null
                };
                console.log('[SocialCalendar] insert post payload', dbPayload);
                const { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .insert([dbPayload])
                    .select()
                    .single();

                if (error) throw error;
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
            if (input.data_postagem !== undefined || input.post_date !== undefined) {
                dbPayload.data_agendada = input.data_postagem || input.post_date;
            }
            if (input.status !== undefined) {
                let status = input.status;
                const statusMap = global.GQV_CONSTANTS ? global.GQV_CONSTANTS.SOCIAL_STATUS_MAP : {
                    'rascunho': 'draft',
                    'pendente_aprovacao': 'ready_for_approval',
                    'awaiting_approval': 'ready_for_approval',
                    'aprovado': 'approved',
                    'rejeitado': 'rejected',
                    'agendado': 'scheduled',
                    'publicado': 'published'
                };
                if (statusMap[status]) status = statusMap[status];
                dbPayload.status = status;
            }
            if (input.cta !== undefined) dbPayload.cta = input.cta;
            if (input.hashtags !== undefined) dbPayload.hashtags = input.hashtags;
            if (input.imagem_url !== undefined || input.media_url !== undefined) {
                dbPayload.imagem_url = input.imagem_url || input.media_url;
            }

            try {
                // Tenta atualizar em 'social_posts'
                let { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .update(dbPayload)
                    .eq('id', postId)
                    .select();

                if (error) throw error;
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
                'pendente_aprovacao': 'ready_for_approval',
                'awaiting_approval': 'ready_for_approval',
                'aprovado': 'approved',
                'rejeitado': 'rejected',
                'agendado': 'scheduled',
                'publicado': 'published'
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
         * @param {string} endDate (YYYY-MM-DD)
         * @returns {Promise<Array>} Lista de posts
         */
        getPostsByDateRange: async function(clientId, startDate, endDate) {
            if (!global.supabaseClient || !clientId) return [];

            try {
                // Tenta 'social_posts'
                let { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .gte('data_agendada', startDate)
                    .lte('data_agendada', endDate)
                    .order('data_agendada', { ascending: true });

                if (error) throw error;
                return data;
            } catch (err) {
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
                // Tenta tabela 'social_posts' primeiro (mais provável ser a correta v2/legada)
                let { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .order('data_agendada', { ascending: false });

                if (!error) return data;

                // Fallback para 'posts'
                console.warn('[SOCIAL] Tabela social_posts falhou, tentando posts...');
                const { data: data2, error: error2 } = await global.supabaseClient
                    .from('posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .order('data_postagem', { ascending: false });

                if (error2) throw error2;
                return data2 || [];
            } catch (error) {
                console.error('[SOCIAL] Erro ao buscar posts:', error);
                return [];
            }
        }
    };

    global.SocialMediaRepo = SocialMediaRepo;

})(window);
