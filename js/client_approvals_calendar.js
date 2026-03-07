(() => {
    const state = {
        calendars: [],
        current: null,
        clientId: null,
        tenantId: null
    };

    const CALENDAR_STATUS_LABEL = window.CALENDAR_STATUS_LABEL || {};
    const STATUS_LABELS = {
        rascunho: 'Rascunho',
        aguardando_aprovacao: 'Aguardando aprovação',
        aprovado: 'Aprovado',
        rejeitado: 'Rejeitado',
        ajuste_solicitado: 'Ajuste solicitado'
    };
    const STATUS_STYLES = {
        rascunho: 'bg-gray-100 text-gray-700 border border-gray-200',
        aguardando_aprovacao: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
        aprovado: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
        rejeitado: 'bg-rose-50 text-rose-700 border border-rose-100',
        ajuste_solicitado: 'bg-blue-50 text-blue-700 border border-blue-100'
    };

    const setLoadingState = (visible) => {
        const loadingEl = document.getElementById('calendar-loading');
        if (loadingEl) loadingEl.classList.toggle('hidden', !visible);
        if (visible) {
            setErrorState(false);
            setEmptyState(false);
        }
    };

    const setEmptyState = (visible) => {
        const emptyEl = document.getElementById('calendar-empty-state');
        const listEl = document.getElementById('calendar-list');
        if (emptyEl) emptyEl.classList.toggle('hidden', !visible);
        if (listEl) listEl.classList.toggle('hidden', visible);
    };

    const setErrorState = (visible, message = '', detail = '') => {
        const errorEl = document.getElementById('calendar-error-state');
        const messageEl = document.getElementById('calendar-error-message');
        const detailEl = document.getElementById('calendar-error-detail');
        const listEl = document.getElementById('calendar-list');
        const loadingEl = document.getElementById('calendar-loading');
        const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        if (messageEl) messageEl.textContent = message || 'Erro ao carregar calendário. Tente novamente.';
        if (detailEl) {
            if (visible && isDev && detail) {
                detailEl.textContent = detail;
                detailEl.classList.remove('hidden');
            } else {
                detailEl.textContent = '';
                detailEl.classList.add('hidden');
            }
        }
        if (errorEl) errorEl.classList.toggle('hidden', !visible);
        if (visible) {
            if (listEl) listEl.classList.add('hidden');
            if (loadingEl) loadingEl.classList.add('hidden');
            setEmptyState(false);
        }
    };

    const showToast = (message, type = 'success') => {
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }
        const toast = document.createElement('div');
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: ${colors[type] || '#333'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 6px 12px rgba(0,0,0,0.12);
            z-index: 99999;
            font-size: 14px;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.25s ease;
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 250);
        }, 3000);
    };

    const formatMonthLabel = (dateStr) => {
        if (!dateStr) return '';
        const parsed = new Date(`${dateStr}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return dateStr;
        const label = parsed.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        return label.charAt(0).toUpperCase() + label.slice(1);
    };

    const formatDateTime = (value) => {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return value;
        return parsed.toLocaleString('pt-BR');
    };

    const sortCandidates = [
        'position',
        'ordem',
        'sequencia',
        'index',
        'post_index',
        'day_index',
        'sort_order',
        'created_at'
    ];

    const parseNumeric = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return null;
        if (/^\d+$/.test(raw)) return Number(raw);
        return null;
    };

    const getMetaValue = (user, keys) => {
        const sources = [user?.user_metadata || {}, user?.app_metadata || {}];
        for (const source of sources) {
            for (const key of keys) {
                const value = parseNumeric(source?.[key]);
                if (value !== null) return value;
            }
        }
        return null;
    };

    const getSupabaseClient = async () => {
        return window.clientSession?.getSupabaseClient?.();
    };

    const detectSortColumn = async (supabase, calendarId) => {
        for (const column of sortCandidates) {
            const { error } = await supabase
                .from('social_posts')
                .select(`id,${column}`)
                .eq('calendar_id', calendarId)
                .limit(1);
            if (!error) return column;
        }
        return 'created_at';
    };

    const fetchOrderedPosts = async (supabase, calendarId) => {
        const detectedColumn = await detectSortColumn(supabase, calendarId);
        const candidates = [detectedColumn, ...sortCandidates.filter((column) => column !== detectedColumn)];
        let lastError = null;
        for (const column of candidates) {
            const { data, error } = await supabase
                .from('social_posts')
                .select('id, tema, legenda, data_agendada, formato, hora_agendada, plataforma')
                .eq('calendar_id', calendarId)
                .order(column, { ascending: true });
            if (!error) {
                return { posts: Array.isArray(data) ? data : [], sortColumn: column, error: null };
            }
            lastError = error;
            console.warn('[PORTAL] falha ordenacao posts', { column, error });
        }
        return { posts: [], sortColumn: detectedColumn, error: lastError };
    };

    const safeMaybeSingle = async (table, columns, field, value) => {
        try {
            const supabase = await getSupabaseClient();
            if (!supabase) return null;
            const { data, error } = await supabase
                .from(table)
                .select(columns)
                .eq(field, value)
                .maybeSingle();
            if (error) return null;
            return data || null;
        } catch {
            return null;
        }
    };

    const resolveClientContext = async () => {
        const supabase = await getSupabaseClient();
        if (!supabase) return null;
        const sessionResult = await supabase.auth.getSession();
        const session = sessionResult?.data?.session;
        const user = session?.user;
        if (!user) {
            window.location.href = 'client_login.html';
            return null;
        }
        if (window.clientSession?.ensureClientSession) {
            await window.clientSession.ensureClientSession();
        }
        const clientMembership = await safeMaybeSingle('client_memberships', 'tenant_id, client_id', 'user_id', user.id);
        const portalLink = await safeMaybeSingle('client_portal_users', 'tenant_id, client_id', 'user_id', user.id);
        // Profiles removido
        const membership = await safeMaybeSingle('memberships', 'tenant_id', 'user_id', user.id);
        const metaTenant = getMetaValue(user, ['tenant_id']);
        const metaClient = getMetaValue(user, ['client_id', 'cliente_id']);
        const tenantId = clientMembership?.tenant_id
            || portalLink?.tenant_id
            || membership?.tenant_id
            || metaTenant
            || null;
        const clientId = clientMembership?.client_id
            || portalLink?.client_id
            || metaClient
            || null;
        const resolvedClientId = clientId || tenantId;
        const resolvedTenantId = tenantId || resolvedClientId;
        if (resolvedTenantId && resolvedClientId && resolvedTenantId !== resolvedClientId) {
            return { error: 'vinculo_invalido' };
        }
        if (!resolvedClientId) {
            return { error: 'cliente_nao_vinculado' };
        }
        state.clientId = resolvedClientId;
        state.tenantId = resolvedTenantId;
        return { clientId: resolvedClientId, tenantId: resolvedTenantId };
    };

    const resolveStatusLabel = (status) => {
        return CALENDAR_STATUS_LABEL?.[status] || STATUS_LABELS[status] || 'Aguardando aprovação';
    };

    const renderCalendars = (items) => {
        const list = document.getElementById('calendar-list');
        if (!list) return;
        list.innerHTML = '';
        items.forEach((calendar) => {
            const card = document.createElement('div');
            card.className = 'bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3';
            const monthLabel = formatMonthLabel(calendar.mes_referencia);
            const createdLabel = formatDateTime(calendar.created_at);
            const statusLabel = resolveStatusLabel(calendar.status);
            const goal = calendar.objetivo || calendar.goal || '';
            const briefing = calendar.briefing || calendar.resumo || '';
            const statusStyle = STATUS_STYLES[calendar.status] || STATUS_STYLES.aguardando_aprovacao;
            card.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <h3 class="text-lg font-semibold">${monthLabel || 'Calendário'}</h3>
                    <span class="text-xs px-2 py-1 rounded-full ${statusStyle}">${statusLabel}</span>
                </div>
                <p class="text-xs text-gray-500">Criado em ${createdLabel || '-'}</p>
                ${goal ? `<p class="text-sm text-gray-700"><span class="font-semibold">Objetivo:</span> ${goal}</p>` : ''}
                ${briefing ? `<p class="text-sm text-gray-700 whitespace-pre-wrap"><span class="font-semibold">Briefing:</span> ${briefing}</p>` : ''}
                <button type="button" data-calendar-id="${calendar.id}" class="portal-open-calendar w-fit px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition">Abrir</button>
            `;
            list.appendChild(card);
        });
    };

    const fetchCalendars = async () => {
        const supabase = await getSupabaseClient();
        if (!supabase) return null;
        let query = supabase
            .from('social_calendars')
            .select('id, mes_referencia, created_at, status, cliente_id, objetivo, briefing, approval_comment')
            .eq('cliente_id', state.clientId)
            .eq('status', 'aguardando_aprovacao')
            .order('created_at', { ascending: false });
        if (state.tenantId) {
            query = query.eq('tenant_id', state.tenantId);
        }
        let { data, error } = await query;
        if (error && state.tenantId) {
            const retry = await supabase
                .from('social_calendars')
                .select('id, mes_referencia, created_at, status, cliente_id, objetivo, briefing, approval_comment')
                .eq('cliente_id', state.clientId)
                .eq('status', 'aguardando_aprovacao')
                .order('created_at', { ascending: false });
            if (!retry.error) {
                data = retry.data;
                error = null;
            }
        }
        if (error && String(error.message || '').includes('column')) {
            let fallbackQuery = supabase
                .from('social_calendars')
                .select('id, mes_referencia, created_at, status, cliente_id')
                .eq('cliente_id', state.clientId)
                .eq('status', 'aguardando_aprovacao')
                .order('created_at', { ascending: false });
            if (state.tenantId) {
                fallbackQuery = fallbackQuery.eq('tenant_id', state.tenantId);
            }
            const fallback = await fallbackQuery;
            if (!fallback.error) {
                data = fallback.data;
                error = null;
            }
        }
        if (error) {
            console.error('[PORTAL] erro ao carregar calendarios', error);
            setErrorState(true, 'Erro ao carregar calendários. Tente novamente.', error?.message || error?.details || '');
            return null;
        }
        return Array.isArray(data) ? data : [];
    };

    const openModal = async (calendar) => {
        const modal = document.getElementById('client-calendar-modal');
        if (!modal) return;
        state.current = calendar;
        const titleEl = document.getElementById('client-calendar-modal-title');
        const statusEl = document.getElementById('client-calendar-modal-status');
        const periodEl = document.getElementById('client-calendar-modal-period');
        const goalEl = document.getElementById('client-calendar-modal-goal');
        const briefingEl = document.getElementById('client-calendar-modal-briefing');
        const postsLoading = document.getElementById('client-calendar-posts-loading');
        const postsEmpty = document.getElementById('client-calendar-posts-empty');
        const postsList = document.getElementById('client-calendar-posts-list');
        const commentEl = document.getElementById('client-calendar-approval-comment');
        if (titleEl) titleEl.textContent = formatMonthLabel(calendar.mes_referencia) || 'Calendário';
        if (statusEl) {
            const label = resolveStatusLabel(calendar.status);
            const statusStyle = STATUS_STYLES[calendar.status] || STATUS_STYLES.aguardando_aprovacao;
            statusEl.className = `inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium ${statusStyle}`;
            statusEl.textContent = label.toUpperCase();
        }
        if (periodEl) periodEl.textContent = formatMonthLabel(calendar.mes_referencia);
        if (goalEl) goalEl.textContent = calendar.objetivo || calendar.goal || 'Não informado';
        if (briefingEl) briefingEl.textContent = calendar.briefing || calendar.resumo || 'Não informado';
        if (commentEl) commentEl.value = '';
        if (postsList) postsList.innerHTML = '';
        if (postsEmpty) postsEmpty.classList.add('hidden');
        if (postsLoading) postsLoading.classList.remove('hidden');
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const supabase = await getSupabaseClient();
        if (!supabase) return;
        const { posts, sortColumn, error } = await fetchOrderedPosts(supabase, calendar.id);
        if (postsLoading) postsLoading.classList.add('hidden');
        if (error) {
            console.error('[PORTAL] erro ao carregar posts do calendario', error);
            if (postsEmpty) {
                postsEmpty.textContent = 'Erro ao carregar posts.';
                postsEmpty.classList.remove('hidden');
            }
            return;
        }
        if (!posts.length) {
            if (postsEmpty) postsEmpty.classList.remove('hidden');
            return;
        }
        if (sortColumn) {
            state.currentSortColumn = sortColumn;
        }
        posts.forEach((post, index) => {
            const row = document.createElement('div');
            row.className = 'border border-gray-200 rounded-xl p-4 flex flex-col gap-2';
            const dateLabel = post.data_agendada ? new Date(`${post.data_agendada}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem data';
            const timeLabel = post.hora_agendada ? String(post.hora_agendada).slice(0, 5) : '';
            const formatLabel = post.formato || 'Formato não informado';
            row.innerHTML = `
                <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>Post #${index + 1}</span>
                    <span>${dateLabel}${timeLabel ? ` • ${timeLabel}` : ''}</span>
                    <span>${formatLabel}</span>
                </div>
                <h4 class="text-base font-semibold text-gray-900">${post.tema || 'Sem tema'}</h4>
                <p class="text-sm text-gray-600 whitespace-pre-wrap">${post.legenda || 'Sem legenda'}</p>
            `;
            if (postsList) postsList.appendChild(row);
        });
    };

    const closeModal = () => {
        const modal = document.getElementById('client-calendar-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        state.current = null;
    };

    const updateCalendarStatus = async (status, comment) => {
        if (!state.current) return false;
        const supabase = await getSupabaseClient();
        if (!supabase) return false;
        const basePayload = { status };
        if (status === 'aprovado') {
            basePayload.approved_at = new Date().toISOString();
        }
        let payload = { ...basePayload };
        if (comment) payload.approval_comment = comment;
        let query = supabase
            .from('social_calendars')
            .update(payload)
            .eq('id', state.current.id)
            .eq('cliente_id', state.clientId);
        if (state.tenantId) {
            query = query.eq('tenant_id', state.tenantId);
        }
        let { error } = await query;
        if (error && comment) {
            payload = { ...basePayload };
            let retry = supabase
                .from('social_calendars')
                .update(payload)
                .eq('id', state.current.id)
                .eq('cliente_id', state.clientId);
            if (state.tenantId) {
                retry = retry.eq('tenant_id', state.tenantId);
            }
            const retryResult = await retry;
            error = retryResult.error;
        }
        if (error) {
            console.error('[PORTAL] erro ao atualizar calendario', error);
            return false;
        }
        return true;
    };

    const approveCalendar = async () => {
        const commentEl = document.getElementById('client-calendar-approval-comment');
        const comment = commentEl ? commentEl.value.trim() : '';
        const ok = await updateCalendarStatus('aprovado', comment);
        if (!ok) {
            showToast('Não foi possível aprovar o calendário.', 'error');
            return;
        }
        showToast('Calendário aprovado com sucesso.', 'success');
        state.calendars = state.calendars.filter((item) => item.id !== state.current.id);
        closeModal();
        if (!state.calendars.length) {
            setEmptyState(true);
            const list = document.getElementById('calendar-list');
            if (list) list.innerHTML = '';
            return;
        }
        renderCalendars(state.calendars);
    };

    const requestChanges = async () => {
        const commentEl = document.getElementById('client-calendar-approval-comment');
        const comment = commentEl ? commentEl.value.trim() : '';
        if (!comment) {
            showToast('Escreva um comentário para solicitar ajustes.', 'warning');
            return;
        }
        const ok = await updateCalendarStatus('ajuste_solicitado', comment);
        if (!ok) {
            showToast('Não foi possível solicitar ajustes.', 'error');
            return;
        }
        showToast('Ajuste solicitado com sucesso.', 'success');
        state.calendars = state.calendars.filter((item) => item.id !== state.current.id);
        closeModal();
        if (!state.calendars.length) {
            setEmptyState(true);
            const list = document.getElementById('calendar-list');
            if (list) list.innerHTML = '';
            return;
        }
        renderCalendars(state.calendars);
    };

    const init = async () => {
        setLoadingState(true);
        const context = await resolveClientContext();
        if (!context || context.error) {
            setLoadingState(false);
            setErrorState(true, 'Seu usuário ainda não está vinculado a um cliente.');
            return;
        }
        const data = await fetchCalendars();
        setLoadingState(false);
        if (!data) return;
        state.calendars = data;
        if (!data.length) {
            setEmptyState(true);
            return;
        }
        setEmptyState(false);
        renderCalendars(data);
        const closeBtn = document.getElementById('client-calendar-modal-close');
        const approveBtn = document.getElementById('client-calendar-modal-approve');
        const adjustBtn = document.getElementById('client-calendar-modal-adjust');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (approveBtn) approveBtn.addEventListener('click', approveCalendar);
        if (adjustBtn) adjustBtn.addEventListener('click', requestChanges);
        document.addEventListener('click', (event) => {
            const target = event.target.closest('.portal-open-calendar');
            if (target?.dataset?.calendarId) {
                const calendar = state.calendars.find((item) => item.id === target.dataset.calendarId);
                if (calendar) openModal(calendar);
            }
        });
    };

    document.addEventListener('DOMContentLoaded', init);
})();
