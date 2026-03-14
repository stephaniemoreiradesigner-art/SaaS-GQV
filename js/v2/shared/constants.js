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
            'archived': 'archived',
            'in_production': 'in_production',
            'producing': 'in_production'
        }
    };

    global.GQV_CONSTANTS = CONSTANTS;
})(window);
