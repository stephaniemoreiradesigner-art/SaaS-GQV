// js/v2/modules/social_media/social_media_upload.js
// Módulo de Upload para Social Media (Supabase Storage)

(function(global) {
    const SocialMediaUpload = {
        
        /**
         * Realiza o upload de um arquivo para o bucket 'social-media-assets'
         * @param {File} file - Arquivo a ser enviado
         * @param {string} clientId - ID do cliente (para organização de pastas)
         * @returns {Promise<string|null>} - URL pública do arquivo ou null em caso de erro
         */
        uploadFile: async function(file, clientId) {
            if (!file) return null;
            if (!clientId) {
                console.error('[Upload] Client ID obrigatório para upload.');
                return null;
            }

            try {
                const supabase = global.supabaseClient || window.supabaseClient;
                if (!supabase) throw new Error('Supabase Client não encontrado');

                const fileExt = file.name.split('.').pop();
                const fileName = `${clientId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const filePath = `${fileName}`;

                console.log(`[Upload] Iniciando upload: ${filePath}`);

                const { data, error } = await supabase.storage
                    .from('social-media-assets')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (error) throw error;

                // Obter URL pública
                const { data: publicData } = supabase.storage
                    .from('social-media-assets')
                    .getPublicUrl(filePath);

                console.log(`[Upload] Sucesso: ${publicData.publicUrl}`);
                return publicData.publicUrl;

            } catch (err) {
                console.error('[Upload] Erro no upload:', err);
                alert('Erro ao fazer upload da imagem. Tente novamente.');
                return null;
            }
        }
    };

    global.SocialMediaUpload = SocialMediaUpload;

})(window);
