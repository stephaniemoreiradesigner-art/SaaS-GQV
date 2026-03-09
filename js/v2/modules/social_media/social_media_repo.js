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
                const title = input.titulo || input.title || input.legenda || 'Post';
                const content = input.content || input.detailed_content || input.legenda || '';
                
                // Normalização de status
                let status = input.status || 'draft';
                if (status === 'rascunho') status = 'draft';
                if (status === 'pendente_aprovacao') status = 'awaiting_approval';
                if (status === 'aprovado') status = 'approved';
                
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
                    legenda: title,
                    detailed_content: content,
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

                if (!error) return data;

                console.warn('[SOCIAL] Erro em social_posts, tentando posts...', error);
                const fallbackPayload = {
                    cliente_id: clientId,
                    titulo: title,
                    conteudo: content,
                    status,
                    data_postagem: postDate,
                    tipo_conteudo: input.tipo_conteudo || input.formato || null,
                    cta: input.cta || null,
                    hashtags: input.hashtags || null
                };
                const { data: fbData, error: fbError } = await global.supabaseClient
                    .from('posts')
                    .insert([fallbackPayload])
                    .select()
                    .single();
                
                if (!fbError) return fbData;

                const minimalPayload = {
                    cliente_id: clientId,
                    titulo: title,
                    conteudo: content,
                    status,
                    data_postagem: postDate
                };
                const { data: minimalData, error: minimalError } = await global.supabaseClient
                    .from('posts')
                    .insert([minimalPayload])
                    .select()
                    .single();
                if (minimalError) throw minimalError;
                return minimalData;
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
            if (input.titulo !== undefined || input.title !== undefined) {
                dbPayload.legenda = input.titulo ?? input.title;
            }
            if (input.legenda !== undefined || input.content !== undefined) {
                dbPayload.detailed_content = input.content ?? input.legenda;
            }
            if (input.data_postagem !== undefined || input.post_date !== undefined) {
                dbPayload.data_agendada = input.data_postagem ?? input.post_date;
            }
            if (input.status !== undefined) {
                let status = input.status;
                if (status === 'rascunho') status = 'draft';
                if (status === 'pendente_aprovacao') status = 'awaiting_approval';
                if (status === 'aprovado') status = 'approved';
                dbPayload.status = status;
            }
            if (input.cta !== undefined) dbPayload.cta = input.cta;
            if (input.hashtags !== undefined) dbPayload.hashtags = input.hashtags;
            if (input.imagem_url !== undefined || input.media_url !== undefined) {
                dbPayload.imagem_url = input.imagem_url ?? input.media_url;
            }
            
            const fallbackPayload = {};
            if (input.titulo !== undefined || input.title !== undefined) fallbackPayload.titulo = input.titulo ?? input.title;
            if (input.legenda !== undefined || input.content !== undefined) fallbackPayload.conteudo = input.content ?? input.legenda;
            if (input.data_postagem !== undefined || input.post_date !== undefined) fallbackPayload.data_postagem = input.data_postagem ?? input.post_date;
            if (input.status !== undefined) fallbackPayload.status = input.status === 'rascunho' ? 'draft' : input.status;
            if (input.cta !== undefined) fallbackPayload.cta = input.cta;
            if (input.hashtags !== undefined) fallbackPayload.hashtags = input.hashtags;

            try {
                // Tenta atualizar em 'social_posts' primeiro
                let { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .update(dbPayload)
                    .eq('id', postId)
                    .select();

                if (!error) return data;

                console.warn('[SOCIAL] Update em social_posts falhou, tentando posts...');
                const { data: fbData, error: fbError } = await global.supabaseClient
                    .from('posts')
                    .update(fallbackPayload)
                    .eq('id', postId)
                    .select();

                if (!fbError) return fbData;

                const minimalPayload = {};
                if (input.titulo !== undefined) minimalPayload.titulo = input.titulo;
                if (input.legenda !== undefined) minimalPayload.conteudo = input.legenda;
                if (input.data_postagem !== undefined) minimalPayload.data_postagem = input.data_postagem;
                if (input.status !== undefined) minimalPayload.status = input.status;
                const { data: minimalData, error: minimalError } = await global.supabaseClient
                    .from('posts')
                    .update(minimalPayload)
                    .eq('id', postId)
                    .select();
                if (minimalError) throw minimalError;
                return minimalData;
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

                if (!error) return true;

                // Se falhar, tenta 'posts'
                console.warn('[SocialMediaRepo] Delete em social_posts falhou, tentando posts...');
                const { error: fbError } = await global.supabaseClient
                    .from('posts')
                    .delete()
                    .eq('id', postId);

                if (fbError) throw fbError;
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

                if (!error) return true;

                // Fallback 'posts'
                console.warn('[SOCIAL] updatePostDate falhou em social_posts, tentando posts...');
                const { error: fbError } = await global.supabaseClient
                    .from('posts')
                    .update({ data_postagem: newDate })
                    .eq('id', postId);

                if (fbError) throw fbError;
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
            if (newStatus === 'rascunho') normalizedStatus = 'draft';
            if (newStatus === 'pendente_aprovacao') normalizedStatus = 'awaiting_approval';
            if (newStatus === 'aprovado') normalizedStatus = 'approved';

            try {
                // Tenta atualizar em 'social_posts'
                let { error } = await global.supabaseClient
                    .from('social_posts')
                    .update({ status: normalizedStatus })
                    .eq('id', postId);

                if (!error) return true;

                // Fallback 'posts'
                console.warn('[SOCIAL] updatePostStatus falhou em social_posts, tentando posts...');
                const { error: fbError } = await global.supabaseClient
                    .from('posts')
                    .update({ status: normalizedStatus })
                    .eq('id', postId);

                if (fbError) throw fbError;
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

                if (!error) return true;

                // Fallback 'posts'
                console.warn('[SOCIAL] updatePostFeedback falhou em social_posts, tentando posts...');
                const { error: fbError } = await global.supabaseClient
                    .from('posts')
                    .update({ feedback_aprovacao: comment })
                    .eq('id', postId);

                if (fbError) throw fbError;
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

                if (!error) return data;

                // Fallback 'posts'
                console.warn('[SOCIAL] getPostsByDateRange falhou em social_posts, tentando posts...');
                const { data: fbData, error: fbError } = await global.supabaseClient
                    .from('posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .gte('data_postagem', startDate)
                    .lte('data_postagem', endDate)
                    .order('data_postagem', { ascending: true });

                if (fbError) throw fbError;
                return fbData || [];
            } catch (err) {
                console.error('[SOCIAL] Erro ao buscar range:', err);
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
