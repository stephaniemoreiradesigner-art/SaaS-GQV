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
            const normalizedClientId = String(clientId ?? '').trim();
            if (!normalizedClientId) return null;
            if (!global.SocialMediaRepo?.uploadFile) return null;
            return await global.SocialMediaRepo.uploadFile(file, normalizedClientId);
        }
    };

    global.SocialMediaUpload = SocialMediaUpload;

})(window);
