// js/v2/social_media/social_media_approval.js
// Gerenciador de Aprovação V2
// Responsável por alterar status e gerar links de aprovação

(function(global) {
    if (global.SocialMediaApproval) return;

    const SocialMediaApproval = {
        /**
         * Envia calendário para aprovação
         * @param {string} calendarId 
         * @returns {Promise<string>} Link de aprovação
         */
        async sendForApproval(calendarId) {
            if (!calendarId) throw new Error('ID do calendário obrigatório');

            const supabase = window.supabaseClient;
            if (!supabase) throw new Error('Supabase não inicializado');

            // Gera token único se não existir (simulado ou uuid)
            const shareToken = crypto.randomUUID();

            const { data, error } = await supabase
                .from('social_calendars')
                .update({
                    status: 'aguardando_aprovacao',
                    share_token: shareToken,
                    updated_at: new Date().toISOString()
                })
                .eq('id', calendarId)
                .select()
                .single();

            if (error) throw error;

            const link = `${window.location.origin}/aprovacao_social.html?token=${shareToken}`;
            console.log('[SocialMediaApproval v2] Enviado para aprovação:', link);
            return link;
        }
    };

    global.SocialMediaApproval = SocialMediaApproval;

})(window);
