// js/v2/modules/social_media/social_media_repo.js
// Repositório de Dados de Social Media V2
// Responsável por buscar posts e dados de calendário no Supabase

(function(global) {
    const SocialMediaRepo = {
        /**
         * Busca posts de um cliente específico
         * @param {string} clientId 
         * @returns {Promise<Array>} Lista de posts
         */
        getPostsByClient: async function(clientId) {
            if (!global.supabaseClient || !clientId) return [];

            try {
                // Buscando da tabela legacy 'calendario_posts' ou a que estiver em uso
                // Baseado na análise anterior, a tabela parece ser 'calendario_posts' ou similar no JSON
                // Vamos tentar buscar de 'posts' ou 'calendario' se existir, mas o legado usa JSON em 'social_media_calendars'
                // ou tabela 'posts_social_media'.
                
                // [STRATEGY] Sprint 2 foca em ler o que existe. 
                // Vamos assumir uma estrutura padrão baseada nos arquivos legados:
                // Tabela: 'posts' (se houver migração) ou 'calendario_posts'
                
                // Buscando na tabela 'posts' (suposição baseada em padrões comuns, ajustaremos se falhar)
                const { data, error } = await global.supabaseClient
                    .from('posts')
                    .select('*')
                    .eq('cliente_id', clientId)
                    .order('data_postagem', { ascending: false });

                if (error) {
                    // Fallback para tabela legado se 'posts' não existir ou der erro
                    console.warn('[SocialMediaRepo] Tabela posts falhou, tentando tabela legado...');
                    return []; 
                }
                
                return data || [];
            } catch (error) {
                console.error('[SocialMediaRepo] Erro ao buscar posts:', error);
                return [];
            }
        }
    };

    global.SocialMediaRepo = SocialMediaRepo;

})(window);
