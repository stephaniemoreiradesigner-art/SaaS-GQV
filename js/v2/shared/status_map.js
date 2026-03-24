(function(global) {
    if (global.GQV_STATUS_MAP) return;

    const DOMAIN = {
        CALENDAR_ITEM: 'calendar_item',
        POST: 'post'
    };

    const STATUS = {
        CALENDAR_ITEMS: {
            DRAFT: 'draft',
            APPROVED: 'approved',
            NEEDS_CHANGES: 'needs_changes'
        },
        POSTS: {
            DRAFT: 'draft',
            IN_PRODUCTION: 'in_production',
            READY_FOR_REVIEW: 'ready_for_review',
            READY_FOR_APPROVAL: 'ready_for_approval',
            APPROVED: 'approved',
            NEEDS_CHANGES: 'needs_changes',
            CHANGES_REQUESTED: 'changes_requested',
            REJECTED: 'rejected',
            SCHEDULED: 'scheduled',
            PUBLISHED: 'published',
            ARCHIVED: 'archived'
        }
    };

    const base = {
        pill: 'bg-slate-100 text-slate-600',
        pillBorder: 'bg-slate-100 text-slate-600 border border-slate-200'
    };

    const CALENDAR_ITEM_META = {
        draft: { key: 'draft', domain: DOMAIN.CALENDAR_ITEM, label: 'Rascunho', color: { pill: base.pill, pillBorder: base.pillBorder }, editable: true },
        approved: { key: 'approved', domain: DOMAIN.CALENDAR_ITEM, label: 'Aprovado', color: { pill: 'bg-emerald-100 text-emerald-700', pillBorder: 'bg-emerald-50 text-emerald-700 border border-emerald-100' }, editable: false },
        needs_changes: { key: 'needs_changes', domain: DOMAIN.CALENDAR_ITEM, label: 'Precisa de ajustes', color: { pill: 'bg-sky-100 text-sky-700', pillBorder: 'bg-sky-50 text-sky-700 border border-sky-100' }, editable: true }
    };

    const POST_META = {
        draft: { key: 'draft', domain: DOMAIN.POST, label: 'Rascunho', color: { pill: base.pill, pillBorder: base.pillBorder }, editable: true },
        ready_for_review: { key: 'ready_for_review', domain: DOMAIN.POST, label: 'Pronto para revisão', color: { pill: 'bg-indigo-100 text-indigo-700', pillBorder: 'bg-indigo-50 text-indigo-700 border border-indigo-100' }, editable: true },
        ready_for_approval: { key: 'ready_for_approval', domain: DOMAIN.POST, label: 'Enviado para aprovação', color: { pill: 'bg-yellow-100 text-yellow-700', pillBorder: 'bg-yellow-50 text-yellow-700 border border-yellow-100' }, editable: false },
        in_production: { key: 'in_production', domain: DOMAIN.POST, label: 'Para produção', color: { pill: 'bg-blue-100 text-blue-700', pillBorder: 'bg-blue-50 text-blue-700 border border-blue-100' }, editable: true },
        approved: { key: 'approved', domain: DOMAIN.POST, label: 'Aprovado', color: { pill: 'bg-green-100 text-green-700', pillBorder: 'bg-green-50 text-green-700 border border-green-100' }, editable: false },
        needs_changes: { key: 'needs_changes', domain: DOMAIN.POST, label: 'Ajustes solicitados', color: { pill: 'bg-red-100 text-red-700', pillBorder: 'bg-red-50 text-red-700 border border-red-100' }, editable: true },
        changes_requested: { key: 'changes_requested', domain: DOMAIN.POST, label: 'Ajustes solicitados', color: { pill: 'bg-red-100 text-red-700', pillBorder: 'bg-red-50 text-red-700 border border-red-100' }, editable: true },
        rejected: { key: 'rejected', domain: DOMAIN.POST, label: 'Ajustes solicitados', color: { pill: 'bg-red-100 text-red-700', pillBorder: 'bg-red-50 text-red-700 border border-red-100' }, editable: true },
        scheduled: { key: 'scheduled', domain: DOMAIN.POST, label: 'Agendado', color: { pill: 'bg-indigo-100 text-indigo-700', pillBorder: 'bg-indigo-50 text-indigo-700 border border-indigo-100' }, editable: false },
        published: { key: 'published', domain: DOMAIN.POST, label: 'Publicado', color: { pill: 'bg-emerald-100 text-emerald-700', pillBorder: 'bg-emerald-50 text-emerald-700 border border-emerald-100' }, editable: false },
        archived: { key: 'archived', domain: DOMAIN.POST, label: 'Arquivado', color: { pill: 'bg-slate-200 text-slate-700', pillBorder: 'bg-slate-200 text-slate-700 border border-slate-300' }, editable: false }
    };

    const normalizeKey = (raw) => {
        const value = String(raw ?? '').trim().toLowerCase();
        return value;
    };

    const normalizeCalendarItemStatus = (raw) => {
        const key = normalizeKey(raw);
        const aliases = {
            rascunho: 'draft',
            draft: 'draft',
            aprovado: 'approved',
            approved: 'approved',
            needs_changes: 'needs_changes',
            changes_requested: 'needs_changes',
            ajuste_solicitado: 'needs_changes',
            ajustes_solicitados: 'needs_changes'
        };
        return aliases[key] || key;
    };

    const normalizePostStatus = (raw) => {
        const key = normalizeKey(raw);
        const constantsKey = global.GQV_CONSTANTS?.getSocialStatusKey ? global.GQV_CONSTANTS.getSocialStatusKey(key) : '';
        const baseKey = constantsKey || key;
        const aliases = {
            rascunho: 'draft',
            draft: 'draft',
            para_producao: 'in_production',
            'para_produção': 'in_production',
            em_producao: 'in_production',
            'em_produção': 'in_production',
            in_production: 'in_production',
            producing: 'in_production',
            ready_for_review: 'ready_for_review',
            ready_for_approval: 'ready_for_approval',
            awaiting_approval: 'ready_for_approval',
            aguardando_aprovacao: 'ready_for_approval',
            pendente_aprovacao: 'ready_for_approval',
            aprovado: 'approved',
            approved: 'approved',
            needs_changes: 'needs_changes',
            changes_requested: 'needs_changes',
            ajuste_solicitado: 'needs_changes',
            ajustes_solicitados: 'needs_changes',
            rejected: 'needs_changes',
            rejeitado: 'needs_changes',
            scheduled: 'scheduled',
            agendado: 'scheduled',
            published: 'published',
            publicado: 'published',
            archived: 'archived',
            concluido: 'archived',
            'concluído': 'archived'
        };
        return aliases[baseKey] || baseKey;
    };

    const fallbackMeta = (domain, raw) => {
        const clean = String(raw ?? '').trim();
        const label = clean || '-';
        return { key: clean ? clean.toLowerCase() : '', domain, label, color: { pill: base.pill, pillBorder: base.pillBorder }, editable: false };
    };

    const getCalendarItemStatusMeta = (raw) => {
        const key = normalizeCalendarItemStatus(raw);
        return CALENDAR_ITEM_META[key] || fallbackMeta(DOMAIN.CALENDAR_ITEM, raw);
    };

    const getPostStatusMeta = (raw) => {
        const key = normalizePostStatus(raw);
        return POST_META[key] || fallbackMeta(DOMAIN.POST, raw);
    };

    const getStatusLabel = (domain, raw) => {
        const meta = domain === DOMAIN.CALENDAR_ITEM ? getCalendarItemStatusMeta(raw) : getPostStatusMeta(raw);
        return meta?.label || '-';
    };

    const getStatusColor = (domain, raw) => {
        const meta = domain === DOMAIN.CALENDAR_ITEM ? getCalendarItemStatusMeta(raw) : getPostStatusMeta(raw);
        return meta?.color?.pill || base.pill;
    };

    global.GQV_STATUS_MAP = {
        DOMAIN,
        STATUS,
        getCalendarItemStatusMeta,
        getPostStatusMeta,
        getStatusLabel,
        getStatusColor
    };
})(window);
