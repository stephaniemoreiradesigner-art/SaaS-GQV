// js/v2/modules/social_media/social_media_repo.js
// Repositório de Dados de Social Media V2
// Responsável por buscar posts e dados de calendário no Supabase

(function(global) {
    const SocialMediaRepo = {
        /**
         * Cria um novo post manual
         * @param {Object} input - Dados do post
         * @returns {Promise<Object>} Resultado da operação
         */
        createPost: async function(input) {
            if (!global.supabaseClient) {
                throw new Error('Banco de dados não conectado');
            }

            // Validação mínima
            if (!input.cliente_id) throw new Error('Cliente não identificado');
            if (!input.titulo) throw new Error('Título é obrigatório');

            const payload = {
                cliente_id: input.cliente_id,
                titulo: input.titulo, // ou 'tema' dependendo da tabela
                legenda: input.legenda || '',
                plataforma: input.plataforma || 'instagram', // array ou string dependendo do schema
                data_postagem: input.data_postagem || null,
                status: input.status || 'rascunho',
                tipo: 'manual', // flag para identificar origem
                criado_em: new Date().toISOString()
            };

            // Adapter para tabela real (assumindo 'posts' ou 'social_posts' baseado no legado)
            // Se a tabela 'posts' falhou na leitura, provavelmente é 'social_posts' (visto no legado generateCalendar)
            
            let tableName = 'social_posts'; 
            // Tentativa primária na tabela que vimos no legado (generateCalendar usa social_posts)

            try {
                const slides = Array.isArray(input.slides) ? input.slides : [];
                const dbPayload = {
                    cliente_id: payload.cliente_id,
                    tema: payload.titulo,
                    legenda: payload.legenda,
                    data_agendada: payload.data_postagem,
                    status: payload.status,
                    plataformas: [payload.plataforma],
                    formato: input.formato || input.tipo_conteudo || 'post_estatico',
                    tipo_conteudo: input.tipo_conteudo || input.formato || null,
                    cta: input.cta || null,
                    hashtags: input.hashtags || null,
                    slide_1: slides[0] || null,
                    slide_2: slides[1] || null,
                    slide_3: slides[2] || null,
                    slide_4: slides[3] || null,
                    hook: input.hook || null,
                    roteiro: input.roteiro || null,
                    media_url: input.media_url || null,
                    media_path: input.media_path || null,
                    media_type: input.media_type || null,
                    media_name: input.media_name || null,
                    media_size: input.media_size || null,
                    media_bucket: input.media_bucket || null
                };

                const { data, error } = await global.supabaseClient
                    .from(tableName)
                    .insert([dbPayload])
                    .select()
                    .single();

                if (!error) return data;

                console.warn(`[SocialMediaRepo] Erro em ${tableName}, tentando 'posts'...`, error);
                const fallbackPayload = {
                    cliente_id: payload.cliente_id,
                    titulo: payload.titulo,
                    conteudo: payload.legenda,
                    status: payload.status,
                    data_postagem: payload.data_postagem,
                    tipo_conteudo: input.tipo_conteudo || input.formato || null,
                    cta: input.cta || null,
                    hashtags: input.hashtags || null,
                    slide_1: slides[0] || null,
                    slide_2: slides[1] || null,
                    slide_3: slides[2] || null,
                    slide_4: slides[3] || null,
                    hook: input.hook || null,
                    roteiro: input.roteiro || null,
                    media_url: input.media_url || null,
                    media_path: input.media_path || null,
                    media_type: input.media_type || null,
                    media_name: input.media_name || null,
                    media_size: input.media_size || null,
                    media_bucket: input.media_bucket || null
                };
                const { data: fbData, error: fbError } = await global.supabaseClient
                    .from('posts')
                    .insert([fallbackPayload])
                    .select()
                    .single();
                
                if (!fbError) return fbData;

                const minimalPayload = {
                    cliente_id: payload.cliente_id,
                    titulo: payload.titulo,
                    conteudo: payload.legenda,
                    status: payload.status,
                    data_postagem: payload.data_postagem
                };
                const { data: minimalData, error: minimalError } = await global.supabaseClient
                    .from('posts')
                    .insert([minimalPayload])
                    .select()
                    .single();
                if (minimalError) throw minimalError;
                return minimalData;
            } catch (err) {
                console.error('[SocialMediaRepo] Falha ao criar post:', err);
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

            // Mapeamento de campos para update
            const dbPayload = {};
            if (input.titulo !== undefined) dbPayload.tema = input.titulo;
            if (input.legenda !== undefined) dbPayload.legenda = input.legenda;
            if (input.data_postagem !== undefined) dbPayload.data_agendada = input.data_postagem;
            if (input.status !== undefined) dbPayload.status = input.status;
            if (input.plataforma !== undefined) dbPayload.plataformas = [input.plataforma];
            if (input.feedback !== undefined) dbPayload.feedback_aprovacao = input.feedback;
            if (input.formato !== undefined) dbPayload.formato = input.formato;
            if (input.tipo_conteudo !== undefined) dbPayload.tipo_conteudo = input.tipo_conteudo;
            if (input.cta !== undefined) dbPayload.cta = input.cta;
            if (input.hashtags !== undefined) dbPayload.hashtags = input.hashtags;
            if (input.slides !== undefined) {
                dbPayload.slide_1 = input.slides[0] || null;
                dbPayload.slide_2 = input.slides[1] || null;
                dbPayload.slide_3 = input.slides[2] || null;
                dbPayload.slide_4 = input.slides[3] || null;
            }
            if (input.hook !== undefined) dbPayload.hook = input.hook;
            if (input.roteiro !== undefined) dbPayload.roteiro = input.roteiro;
            if (input.media_url !== undefined) dbPayload.media_url = input.media_url;
            if (input.media_path !== undefined) dbPayload.media_path = input.media_path;
            if (input.media_type !== undefined) dbPayload.media_type = input.media_type;
            if (input.media_name !== undefined) dbPayload.media_name = input.media_name;
            if (input.media_size !== undefined) dbPayload.media_size = input.media_size;
            if (input.media_bucket !== undefined) dbPayload.media_bucket = input.media_bucket;
            
            // Campos fallback
            const fallbackPayload = {};
            if (input.titulo !== undefined) fallbackPayload.titulo = input.titulo;
            if (input.legenda !== undefined) fallbackPayload.conteudo = input.legenda;
            if (input.data_postagem !== undefined) fallbackPayload.data_postagem = input.data_postagem;
            if (input.status !== undefined) fallbackPayload.status = input.status;
            if (input.feedback !== undefined) fallbackPayload.feedback_aprovacao = input.feedback;
            if (input.formato !== undefined) fallbackPayload.tipo_conteudo = input.formato;
            if (input.tipo_conteudo !== undefined) fallbackPayload.tipo_conteudo = input.tipo_conteudo;
            if (input.cta !== undefined) fallbackPayload.cta = input.cta;
            if (input.hashtags !== undefined) fallbackPayload.hashtags = input.hashtags;
            if (input.slides !== undefined) {
                fallbackPayload.slide_1 = input.slides[0] || null;
                fallbackPayload.slide_2 = input.slides[1] || null;
                fallbackPayload.slide_3 = input.slides[2] || null;
                fallbackPayload.slide_4 = input.slides[3] || null;
            }
            if (input.hook !== undefined) fallbackPayload.hook = input.hook;
            if (input.roteiro !== undefined) fallbackPayload.roteiro = input.roteiro;
            if (input.media_url !== undefined) fallbackPayload.media_url = input.media_url;
            if (input.media_path !== undefined) fallbackPayload.media_path = input.media_path;
            if (input.media_type !== undefined) fallbackPayload.media_type = input.media_type;
            if (input.media_name !== undefined) fallbackPayload.media_name = input.media_name;
            if (input.media_size !== undefined) fallbackPayload.media_size = input.media_size;
            if (input.media_bucket !== undefined) fallbackPayload.media_bucket = input.media_bucket;

            try {
                // Tenta atualizar em 'social_posts' primeiro
                let { data, error } = await global.supabaseClient
                    .from('social_posts')
                    .update(dbPayload)
                    .eq('id', postId)
                    .select();

                if (!error) return data;

                console.warn('[SocialMediaRepo] Update em social_posts falhou, tentando posts...');
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
                console.error('[SocialMediaRepo] Falha ao atualizar post:', err);
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
                console.warn('[SocialMediaRepo] updatePostDate falhou em social_posts, tentando posts...');
                const { error: fbError } = await global.supabaseClient
                    .from('posts')
                    .update({ data_postagem: newDate })
                    .eq('id', postId);

                if (fbError) throw fbError;
                return true;
            } catch (err) {
                console.error('[SocialMediaRepo] Falha ao mover post:', err);
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

            try {
                // Tenta atualizar em 'social_posts'
                let { error } = await global.supabaseClient
                    .from('social_posts')
                    .update({ status: newStatus })
                    .eq('id', postId);

                if (!error) return true;

                // Fallback 'posts'
                console.warn('[SocialMediaRepo] updatePostStatus falhou em social_posts, tentando posts...');
                const { error: fbError } = await global.supabaseClient
                    .from('posts')
                    .update({ status: newStatus })
                    .eq('id', postId);

                if (fbError) throw fbError;
                return true;
            } catch (err) {
                console.error('[SocialMediaRepo] Falha ao atualizar status:', err);
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
                console.warn('[SocialMediaRepo] updatePostFeedback falhou em social_posts, tentando posts...');
                const { error: fbError } = await global.supabaseClient
                    .from('posts')
                    .update({ feedback_aprovacao: comment })
                    .eq('id', postId);

                if (fbError) throw fbError;
                return true;
            } catch (err) {
                console.error('[SocialMediaRepo] Falha ao atualizar feedback:', err);
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
                console.warn('[SocialMediaRepo] getPostsByDateRange falhou em social_posts, tentando posts...');
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
                console.error('[SocialMediaRepo] Erro ao buscar range:', err);
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
                console.warn('[SocialMediaRepo] Tabela social_posts falhou, tentando posts...');
                const { data: data2, error: error2 } = await global.supabaseClient
                    .from('posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .order('data_postagem', { ascending: false });

                if (error2) throw error2;
                return data2 || [];
            } catch (error) {
                console.error('[SocialMediaRepo] Erro ao buscar posts:', error);
                return [];
            }
        }
    };

    global.SocialMediaRepo = SocialMediaRepo;

})(window);
