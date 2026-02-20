(() => {
    const state = {
        items: [],
        current: null
    };

    const setEmptyState = (visible) => {
        const emptyEl = document.getElementById('calendar-empty-state');
        const container = document.getElementById('calendar-container');
        if (emptyEl) emptyEl.classList.toggle('hidden', !visible);
        if (container) container.classList.toggle('hidden', visible);
    };

    const setErrorState = (visible, message, detail) => {
        const errorEl = document.getElementById('calendar-error-state');
        const messageEl = document.getElementById('calendar-error-message');
        const detailEl = document.getElementById('calendar-error-detail');
        const emptyEl = document.getElementById('calendar-empty-state');
        const container = document.getElementById('calendar-container');
        if (messageEl) messageEl.textContent = message || 'Erro ao carregar calendário. Tente novamente.';
        const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
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
        if (emptyEl) emptyEl.classList.toggle('hidden', visible);
        if (container) container.classList.toggle('hidden', visible);
    };

    const formatDate = (date) => {
        if (!date) return '';
        const parsed = new Date(`${date}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return date;
        return parsed.toLocaleDateString('pt-BR');
    };

    const normalizeMedias = (raw) => {
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string' && raw.trim()) {
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    };

    const getLegacyMedias = (item) => {
        const list = [];
        if (item?.imagem_url) list.push({ public_url: item.imagem_url, type: 'image', name: 'imagem' });
        if (item?.video_url) list.push({ public_url: item.video_url, type: 'video', name: 'video' });
        if (item?.arquivo_url) list.push({ public_url: item.arquivo_url, type: 'doc', name: 'arquivo' });
        return list;
    };

    const getPostMedias = (item) => {
        const normalized = normalizeMedias(item?.medias);
        if (normalized.length) return normalized;
        return getLegacyMedias(item);
    };

    const getPublicUrlFromPath = async (path) => {
        if (!path) return '';
        const supabase = await window.clientApp?.getSupabaseClient?.();
        if (!supabase?.storage) return '';
        const { data } = supabase.storage.from('social_media_uploads').getPublicUrl(path);
        return data?.publicUrl || '';
    };

    const truncate = (text, max = 48) => {
        if (!text) return '';
        if (text.length <= max) return text;
        return `${text.slice(0, max - 3)}...`;
    };

    const getAuthHeaders = async () => {
        const supabase = await window.clientApp?.getSupabaseClient?.();
        if (!supabase) {
            window.location.href = 'client_login.html';
            return null;
        }
        const sessionResult = await supabase.auth.getSession();
        const session = sessionResult?.data?.session;
        const token = session?.access_token;
        if (!token) {
            window.location.href = 'client_login.html';
            return null;
        }
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        };
    };

    const getStatusConfig = (status) => {
        const normalized = String(status || '').trim().toLowerCase();
        if (['aprovado', 'approved'].includes(normalized)) {
            return {
                label: 'APROVADO',
                className: 'inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700'
            };
        }
        if (['ajuste_solicitado', 'needs_adjustment'].includes(normalized)) {
            return {
                label: 'AJUSTE SOLICITADO',
                className: 'inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700'
            };
        }
        return {
            label: 'PENDENTE',
            className: 'inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700'
        };
    };

    const setApprovalBatchButton = (approvalId) => {
        const btn = document.getElementById('client-approval-batch-btn');
        if (!btn) return;
        if (approvalId) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    };

    const showFeedback = (message) => {
        if (window.showToast) {
            window.showToast(message);
        } else {
            alert(message);
        }
    };

    const buildMonthRange = (monthStr) => {
        const [year, month] = monthStr.split('-').map((part) => parseInt(part, 10));
        if (!year || !month) return null;
        const paddedMonth = String(month).padStart(2, '0');
        const nextMonthValue = month === 12 ? 1 : month + 1;
        const nextYearValue = month === 12 ? year + 1 : year;
        const paddedNextMonth = String(nextMonthValue).padStart(2, '0');
        const from = `${year}-${paddedMonth}-01`;
        const to = `${nextYearValue}-${paddedNextMonth}-01`;
        return { from, to, firstDayLocal: new Date(year, month - 1, 1) };
    };

    const openModal = async (item) => {
        const modal = document.getElementById('client-calendar-modal');
        if (!modal) return;
        state.current = item;

        const titleEl = document.getElementById('client-calendar-modal-title');
        const statusEl = document.getElementById('client-calendar-modal-status');
        const dateEl = document.getElementById('client-calendar-modal-date');
        const platformEl = document.getElementById('client-calendar-modal-platform');
        const formatEl = document.getElementById('client-calendar-modal-format');
        const themeEl = document.getElementById('client-calendar-modal-theme');
        const captionEl = document.getElementById('client-calendar-modal-caption');
        const reasonEl = document.getElementById('client-calendar-modal-reason');
        const mediaWrap = document.getElementById('client-calendar-modal-media');
        const mediaList = document.getElementById('client-calendar-modal-media-list');

        if (titleEl) titleEl.textContent = item.tema || item.titulo || 'Sem título';
        if (statusEl) {
            const statusConfig = getStatusConfig(item.status);
            statusEl.className = statusConfig.className;
            statusEl.textContent = statusConfig.label;
        }
        if (dateEl) dateEl.textContent = formatDate(item.data_agendada || item.scheduled_at);
        if (platformEl) platformEl.textContent = item.plataforma || 'Não informado';
        if (formatEl) formatEl.textContent = item.formato || 'Não informado';
        if (themeEl) themeEl.textContent = item.tema || item.titulo || 'Sem tema';
        if (captionEl) captionEl.textContent = item.legenda || 'Sem legenda';
        if (reasonEl) reasonEl.value = item.feedback_ajuste || '';
        if (mediaWrap && mediaList) {
            const medias = getPostMedias(item);
            if (!medias.length) {
                mediaWrap.classList.add('hidden');
            } else {
                mediaWrap.classList.remove('hidden');
                mediaList.innerHTML = '';
                for (const media of medias) {
                    const url = media.public_url || await getPublicUrlFromPath(media.path);
                    const row = document.createElement('div');
                    row.className = 'flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg';
                    const left = document.createElement('div');
                    left.className = 'flex items-center gap-3';
                    if (media.type === 'image' && url) {
                        left.innerHTML = `<img src="${url}" class="w-12 h-12 rounded-lg object-cover border border-gray-200" alt="">`;
                    } else if (media.type === 'video' && url) {
                        left.innerHTML = `<div class="w-12 h-12 rounded-lg bg-gray-900 text-white flex items-center justify-center"><i class="fas fa-play"></i></div>`;
                    } else if (media.type === 'pdf') {
                        left.innerHTML = `<div class="w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><i class="fas fa-file-pdf text-lg"></i></div>`;
                    } else {
                        left.innerHTML = `<div class="w-12 h-12 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center"><i class="fas fa-file text-lg"></i></div>`;
                    }
                    const name = document.createElement('span');
                    name.className = 'text-sm font-medium text-gray-700';
                    name.textContent = media.name || 'Anexo';
                    left.appendChild(name);
                    const link = document.createElement('a');
                    link.className = 'text-xs text-purple-700 font-semibold underline';
                    link.href = url || '#';
                    link.target = '_blank';
                    link.rel = 'noopener';
                    link.textContent = url ? 'Abrir' : 'Indisponível';
                    row.appendChild(left);
                    row.appendChild(link);
                    mediaList.appendChild(row);
                }
            }
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    const closeModal = () => {
        const modal = document.getElementById('client-calendar-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        const reasonEl = document.getElementById('client-calendar-modal-reason');
        if (reasonEl) reasonEl.value = '';
        state.current = null;
    };

    const renderCalendar = (monthStr, items) => {
        const grid = document.getElementById('client-calendar-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const range = buildMonthRange(monthStr);
        if (!range) return;

        const firstDay = range.firstDayLocal;
        const year = firstDay.getFullYear();
        const monthIndex = firstDay.getMonth();
        const startWeekDay = new Date(year, monthIndex, 1).getDay();
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

        const itemsByDay = items.reduce((acc, item) => {
            const dateStr = item.data_agendada || item.scheduled_at;
            if (!dateStr) return acc;
            const day = parseInt(dateStr.split('-')[2], 10);
            if (!day) return acc;
            if (!acc[day]) acc[day] = [];
            acc[day].push(item);
            return acc;
        }, {});

        for (let i = 0; i < startWeekDay; i += 1) {
            const blank = document.createElement('div');
            blank.className = 'bg-white min-h-[120px]';
            grid.appendChild(blank);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const cell = document.createElement('div');
            cell.className = 'bg-white min-h-[120px] px-3 py-2 flex flex-col gap-2';

            const dayLabel = document.createElement('div');
            dayLabel.className = 'text-xs font-semibold text-gray-500';
            dayLabel.textContent = day;
            cell.appendChild(dayLabel);

            const dayItems = itemsByDay[day] || [];
            dayItems.forEach((item) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'text-left text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-100 transition';
                btn.textContent = truncate(item.tema || item.titulo || 'Sem título');
                btn.addEventListener('click', () => openModal(item));
                cell.appendChild(btn);
            });

            grid.appendChild(cell);
        }
    };

    const updateLocalItemStatus = (itemId, status, feedback) => {
        const items = Array.isArray(state.items) ? state.items : [];
        const updatedItems = items.map((item) => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                status,
                feedback_ajuste: feedback ?? item.feedback_ajuste
            };
        });
        state.items = updatedItems;
        if (state.current && state.current.id === itemId) {
            state.current.status = status;
            if (feedback !== undefined) state.current.feedback_ajuste = feedback;
            const statusEl = document.getElementById('client-calendar-modal-status');
            if (statusEl) {
                const statusConfig = getStatusConfig(status);
                statusEl.className = statusConfig.className;
                statusEl.textContent = statusConfig.label;
            }
        }
        if (state.month) renderCalendar(state.month, updatedItems);
    };

    const updateApprovalItemStatus = async (status, reason) => {
        if (!state.current?.id) return;
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch(`/api/client/social/approval-items/${state.current.id}/status`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ status, reason })
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) {
            const message = data?.error === 'motivo_obrigatorio'
                ? 'Informe o motivo do ajuste.'
                : 'Não foi possível atualizar o status.';
            showFeedback(message);
            return;
        }
        const nextStatus = data?.status || status;
        const feedback = data?.feedback_ajuste ?? reason ?? null;
        updateLocalItemStatus(state.current.id, nextStatus, feedback);
        showFeedback('Status atualizado com sucesso.');
    };

    const loadCalendarForMonth = async (monthStr) => {
        const range = buildMonthRange(monthStr);
        if (!range) return;
        state.month = monthStr;
        try {
            const headers = await getAuthHeaders();
            if (!headers) return;
            const url = `/api/client/social/approval-batch?month=${monthStr}`;
            const res = await fetch(url, { headers });
            const text = await res.text();
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                data = null;
            }
            if (!res.ok) {
                const isMissingTenant = res.status === 400 && data?.error === 'missing_tenant';
                setEmptyState(false);
                if (isMissingTenant) {
                    setErrorState(true, 'Seu usuário ainda não está vinculado a uma empresa. Fale com o suporte.');
                } else {
                    console.error(text);
                    setErrorState(true, 'Erro ao carregar calendário. Tente novamente.', text || data?.error || data?.message);
                }
                return;
            }
            const items = Array.isArray(data?.items) ? data.items : [];
            state.items = items;
            state.approvalId = data?.approval_id || null;
            setErrorState(false);
            if (!items.length) {
                setEmptyState(true);
                setApprovalBatchButton(null);
                return;
            }
            setEmptyState(false);
            setApprovalBatchButton(state.approvalId);
            renderCalendar(monthStr, items);
        } catch {
            setEmptyState(false);
            setErrorState(true, 'Erro ao carregar calendário. Tente novamente.');
        }
    };

    const init = () => {
        const monthInput = document.getElementById('calendar-month-input');
        const closeBtn = document.getElementById('client-calendar-modal-close');
        const approveBtn = document.getElementById('client-calendar-modal-approve');
        const changesBtn = document.getElementById('client-calendar-modal-changes');
        const batchBtn = document.getElementById('client-approval-batch-btn');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (approveBtn) {
            approveBtn.addEventListener('click', () => {
                updateApprovalItemStatus('approved');
            });
        }
        if (changesBtn) {
            changesBtn.addEventListener('click', () => {
                const reasonEl = document.getElementById('client-calendar-modal-reason');
                const reason = reasonEl ? reasonEl.value.trim() : '';
                if (!reason) {
                    showFeedback('Informe o motivo do ajuste.');
                    return;
                }
                updateApprovalItemStatus('needs_adjustment', reason);
            });
        }
        if (batchBtn) {
            batchBtn.addEventListener('click', () => {
                if (state.approvalId) {
                    window.location.href = `aprovacao.html?id=${state.approvalId}`;
                }
            });
        }

        if (monthInput) {
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            monthInput.value = month;
            monthInput.addEventListener('change', (event) => {
                const value = event.target.value;
                if (value) loadCalendarForMonth(value);
            });
            loadCalendarForMonth(month);
        }
    };

    document.addEventListener('DOMContentLoaded', init);
})();
