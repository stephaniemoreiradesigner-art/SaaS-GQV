// js/v2/shared/constants.js
// Constantes Globais da V2

(function(global) {
    const CONSTANTS = {
        SOCIAL_CALENDAR_STATUS: {
            DRAFT: 'draft',
            SENT_FOR_APPROVAL: 'sent_for_approval',
            APPROVED: 'approved',
            NEEDS_CHANGES: 'needs_changes'
        },
        SOCIAL_CALENDAR_STATUS_MAP: {
            rascunho: 'draft',
            draft: 'draft',
            enviado_para_aprovacao: 'sent_for_approval',
            sent_for_approval: 'sent_for_approval',
            awaiting_approval: 'sent_for_approval',
            ready_for_approval: 'sent_for_approval',
            aguardando_aprovacao: 'sent_for_approval',
            aguardando_aprovação: 'sent_for_approval',
            aprovado: 'approved',
            approved: 'approved',
            needs_changes: 'needs_changes',
            changes_requested: 'needs_changes',
            ajuste_solicitado: 'needs_changes'
        },
        SOCIAL_STATUS: {
            DRAFT: 'draft',
            READY_FOR_APPROVAL: 'ready_for_approval',
            APPROVED: 'approved',
            REJECTED: 'rejected',
            SCHEDULED: 'scheduled',
            PUBLISHED: 'published',
            CHANGES_REQUESTED: 'changes_requested',
            ARCHIVED: 'archived',
            IN_PRODUCTION: 'in_production'
        },
        // Mapa para normalização de entradas (PT -> EN)
        SOCIAL_STATUS_MAP: {
            'rascunho': 'draft',
            'draft': 'draft',
            'planned': 'draft',
            'pendente_aprovacao': 'ready_for_approval',
            'awaiting_approval': 'ready_for_approval',
            'ready_for_approval': 'ready_for_approval',
            'ready': 'ready_for_approval',
            'aprovado': 'approved',
            'approved': 'approved',
            'rejeitado': 'rejected',
            'rejected': 'rejected',
            'agendado': 'scheduled',
            'scheduled': 'scheduled',
            'publicado': 'published',
            'published': 'published',
            'changes_requested': 'changes_requested',
            'ajustes_solicitados': 'changes_requested',
            'archived': 'archived',
            'in_production': 'in_production',
            'para_producao': 'in_production',
            'para_produção': 'in_production',
            'producing': 'in_production'
        },
        getSocialStatusKey: function(raw) {
            const value = String(raw || '').trim().toLowerCase();
            if (!value) return '';
            return this.SOCIAL_STATUS_MAP?.[value] || value;
        },
        getSocialStatusLabelPt: function(raw) {
            const key = this.getSocialStatusKey(raw);
            const map = {
                draft: 'Rascunho',
                ready_for_review: 'Revisão interna',
                in_production: 'Em produção',
                ready_for_approval: 'Pronto para aprovação',
                awaiting_approval: 'Aguardando aprovação',
                approved: 'Aprovado',
                changes_requested: 'Ajustes solicitados',
                rejected: 'Ajustes solicitados',
                needs_changes: 'Precisa de ajustes',
                scheduled: 'Agendado',
                published: 'Publicado',
                archived: 'Arquivado'
            };
            return map[key] || (key ? key.replace(/_/g, ' ') : '-');
        },
        getSocialCalendarStatusKey: function(raw) {
            const value = String(raw || '').trim().toLowerCase();
            if (!value) return '';
            return this.SOCIAL_CALENDAR_STATUS_MAP?.[value] || value;
        },
        getSocialCalendarStatusLabelPt: function(raw) {
            const key = this.getSocialCalendarStatusKey(raw);
            const map = {
                draft: 'Rascunho',
                sent_for_approval: 'Aguardando aprovação',
                approved: 'Aprovado',
                needs_changes: 'Precisa de ajustes'
            };
            return map[key] || (key ? key.replace(/_/g, ' ') : '-');
        }
    };

    global.GQV_CONSTANTS = CONSTANTS;
})(window);
