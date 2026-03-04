(() => {
    const state = {
        calendars: [],
        current: null,
        clientId: null,
        tenantId: null
    };

    const CALENDAR_STATUS_LABEL = window.CALENDAR_STATUS_LABEL || {};

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
        const profile = await safeMaybeSingle('profiles', 'tenant_id, client_id', 'id', user.id);
        const membership = await safeMaybeSingle('memberships', 'tenant_id', 'user_id', user.id);
        const metaTenant = getMetaValue(user, ['tenant_id']);
        const metaClient = getMetaValue(user, ['client_id', 'cliente_id']);
        const tenantId = clientMembership?.tenant_id
            || portalLink?.tenant_id
            || profile?.tenant_id
            || membership?.tenant_id
            || metaTenant
            || null;
        const clientId = clientMembership?.client_id
            || portalLink?.client_id
            || profile?.client_id
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

    const renderCalendars = (items) => {
        const list = document.getElementById('calendar-list');
        if (!list) return;
        list.innerHTML = '';
        items.forEach((calendar) => {
            const card = document.createElement('div');
            card.className = 'bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3';
            const monthLabel = formatMonthLabel(calendar.mes_referencia);
            const createdLabel = formatDateTime(calendar.created_at);
            const statusLabel = CALENDAR_STATUS_LABEL?.[calendar.status] || 'Aguardando Aprovação';
            card.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <h3 class="text-lg font-semibold">${monthLabel || 'Calendário'}</h3>
                    <span class="text-xs px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-100">${statusLabel}</span>
                </div>
                <p class="text-xs text-gray-500">Criado em ${createdLabel || '-'}</p>
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
            .select('id, mes_referencia, created_at, status, cliente_id')
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
                .select('id, mes_referencia, created_at, status, cliente_id')
                .eq('cliente_id', state.clientId)
                .eq('status', 'aguardando_aprovacao')
                .order('created_at', { ascending: false });
            if (!retry.error) {
                data = retry.data;
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
        const postsLoading = document.getElementById('client-calendar-posts-loading');
        const postsEmpty = document.getElementById('client-calendar-posts-empty');
        const postsList = document.getElementById('client-calendar-posts-list');
        const commentEl = document.getElementById('client-calendar-approval-comment');
        if (titleEl) titleEl.textContent = formatMonthLabel(calendar.mes_referencia) || 'Calendário';
        if (statusEl) {
            const label = CALENDAR_STATUS_LABEL?.[calendar.status] || 'Aguardando Aprovação';
            statusEl.className = 'inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700';
            statusEl.textContent = label.toUpperCase();
        }
        if (periodEl) periodEl.textContent = formatMonthLabel(calendar.mes_referencia);
        if (commentEl) commentEl.value = '';
        if (postsList) postsList.innerHTML = '';
        if (postsEmpty) postsEmpty.classList.add('hidden');
        if (postsLoading) postsLoading.classList.remove('hidden');
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const supabase = await getSupabaseClient();
        if (!supabase) return;
        const { data, error } = await supabase
            .from('social_posts')
            .select('id, tema, legenda, data_agendada, formato, hora_agendada, plataforma')
            .eq('calendar_id', calendar.id)
            .order('data_agendada', { ascending: true });
        if (postsLoading) postsLoading.classList.add('hidden');
        if (error) {
            console.error('[PORTAL] erro ao carregar posts do calendario', error);
            if (postsEmpty) {
                postsEmpty.textContent = 'Erro ao carregar posts.';
                postsEmpty.classList.remove('hidden');
            }
            return;
        }
        const posts = Array.isArray(data) ? data : [];
        if (!posts.length) {
            if (postsEmpty) postsEmpty.classList.remove('hidden');
            return;
        }
        posts.forEach((post) => {
            const row = document.createElement('div');
            row.className = 'border border-gray-200 rounded-xl p-4 flex flex-col gap-2';
            const dateLabel = post.data_agendada ? new Date(`${post.data_agendada}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem data';
            const timeLabel = post.hora_agendada ? String(post.hora_agendada).slice(0, 5) : '';
            const formatLabel = post.formato || 'Formato não informado';
            row.innerHTML = `
                <div class="flex items-center justify-between text-xs text-gray-500">
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

    const approveCalendar = async () => {
        if (!state.current) return;
        const supabase = await getSupabaseClient();
        if (!supabase) return;
        const commentEl = document.getElementById('client-calendar-approval-comment');
        const comment = commentEl ? commentEl.value.trim() : '';
        let query = supabase
            .from('social_calendars')
            .update({
                status: 'aprovado',
                approved_at: new Date().toISOString(),
                approval_comment: comment || null
            })
            .eq('id', state.current.id)
            .eq('cliente_id', state.clientId);
        if (state.tenantId) {
            query = query.eq('tenant_id', state.tenantId);
        }
        let { error } = await query;
        if (error && state.tenantId) {
            const retry = await supabase
                .from('social_calendars')
                .update({
                    status: 'aprovado',
                    approved_at: new Date().toISOString(),
                    approval_comment: comment || null
                })
                .eq('id', state.current.id)
                .eq('cliente_id', state.clientId);
            if (!retry.error) {
                error = null;
            } else {
                error = retry.error;
            }
        }
        if (error) {
            console.error('[PORTAL] erro ao aprovar calendario', error);
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
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (approveBtn) approveBtn.addEventListener('click', approveCalendar);
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
