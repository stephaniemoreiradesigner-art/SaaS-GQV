// js/v2/social_media/social_media_calendar.js
// Gerenciador de Calendário V2
// Responsável pela criação e persistência de calendários

(function(global) {
    if (global.SocialMediaCalendar) return;

    const SocialMediaCalendar = {
        /**
         * Cria um novo calendário (rascunho)
         * @param {string} clientId 
         * @param {string} month (YYYY-MM)
         * @returns {Promise<object>}
         */
        async createDraft(clientId, month, meta = {}) {
            if (!clientId || !month) throw new Error('Cliente e mês são obrigatórios');

            const supabase = window.supabaseClient;
            if (!supabase) throw new Error('Supabase não inicializado');

            const referenceDate = `${month}-01`;

            // Verifica se já existe
            const { data: existing } = await supabase
                .from('social_calendars')
                .select('id, status')
                .eq('cliente_id', clientId)
                .eq('mes_referencia', referenceDate)
                .maybeSingle();

            if (existing) {
                console.log('[SocialMediaCalendar v2] Calendário já existe:', existing.id);
                return existing;
            }

            // Cria novo
            const payload = {
                cliente_id: clientId,
                mes_referencia: referenceDate,
                status: 'draft',
                updated_at: new Date().toISOString()
            };
            console.log('[SocialCalendar] payload final', payload);
            const { data, error } = await supabase
                .from('social_calendars')
                .insert(payload)
                .select()
                .single();

            if (error) throw error;
            console.log('[SocialMediaCalendar v2] Calendário criado:', data.id);
            return data;
        },

        /**
         * Busca o calendário ativo para o mês
         */
        async getCalendar(clientId, month) {
            const supabase = window.supabaseClient;
            const referenceDate = `${month}-01`;
            
            const { data, error } = await supabase
                .from('social_calendars')
                .select('*')
                .eq('cliente_id', clientId)
                .eq('mes_referencia', referenceDate)
                .maybeSingle();
                
            if (error) console.error('Erro ao buscar calendário:', error);
            return data;
        }
    };

    global.SocialMediaCalendar = SocialMediaCalendar;

})(window);
