// js/v2/modules/social_media/social_media_ai_adapter.js
// Adapter para Edge Function generate-calendar-ai

(function(global) {
    if (global.SocialMediaAI?.generateAICalendar) return;

    const EDGE_URL = 'https://gbqknmejsmnizjdnopnq.supabase.co/functions/v1/generate-calendar-ai';

    /**
     * @typedef {Object} CalendarItem
     * @property {string} date YYYY-MM-DD
     * @property {string} theme
     * @property {'reels'|'carrossel'|'imagem'} format
     * @property {string} channel
     * @property {string} caption_base
     * @property {string} notes
     */

    /**
     * @param {Object} payload
     * @param {string|number} payload.clientId
     * @param {string} payload.clientName
     * @param {string} payload.monthKey YYYY-MM
     * @param {string} payload.briefing
     * @param {number} payload.postsCount 1..30
     * @param {string[]} [payload.seasonalDates]
     * @returns {Promise<{items: CalendarItem[]}>}
     */
    async function generateAICalendar(payload) {
        const clientId = String(payload?.clientId ?? '').trim();
        if (!clientId) throw new Error('cliente não selecionado');

        const briefing = String(payload?.briefing ?? '').trim();
        if (!briefing || briefing.length < 10) throw new Error('briefing obrigatório');

        const rawCount = Number(payload?.postsCount ?? NaN);
        if (!Number.isFinite(rawCount) || rawCount < 1 || rawCount > 30) throw new Error('postsCount inválido');

        const monthKey = String(payload?.monthKey ?? '').trim().slice(0, 7);
        const seasonalDates = Array.isArray(payload?.seasonalDates) ? payload.seasonalDates.map((s) => String(s || '').trim()).filter(Boolean) : [];

        const body = {
            clientId,
            clientName: String(payload?.clientName ?? '').trim(),
            monthKey,
            briefing,
            postsCount: rawCount,
            seasonalDates
        };

        const res = await fetch(EDGE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }

        if (!res.ok) {
            const errMsg = String(data?.error || text || '').trim();
            throw new Error(`${res.status}${errMsg ? ` ${errMsg}` : ''}`.trim());
        }

        const items = Array.isArray(data?.items) ? data.items : [];
        return { items };
    }

    global.SocialMediaAI = global.SocialMediaAI || {};
    global.SocialMediaAI.generateAICalendar = generateAICalendar;
    global.SocialMediaAI.generateCalendarWithAI = generateAICalendar;
})(window);

