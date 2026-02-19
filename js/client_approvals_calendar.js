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

    const truncate = (text, max = 48) => {
        if (!text) return '';
        if (text.length <= max) return text;
        return `${text.slice(0, max - 3)}...`;
    };

    const buildMonthRange = (monthStr) => {
        const [year, month] = monthStr.split('-').map((part) => parseInt(part, 10));
        if (!year || !month) return null;
        const firstDay = new Date(Date.UTC(year, month - 1, 1));
        const nextMonth = new Date(Date.UTC(year, month, 1));
        const from = firstDay.toISOString().slice(0, 10);
        const to = nextMonth.toISOString().slice(0, 10);
        return { from, to, firstDayLocal: new Date(year, month - 1, 1) };
    };

    const openModal = (item) => {
        const modal = document.getElementById('client-calendar-modal');
        if (!modal) return;
        state.current = item;

        const titleEl = document.getElementById('client-calendar-modal-title');
        const statusEl = document.getElementById('client-calendar-modal-status');
        const dateEl = document.getElementById('client-calendar-modal-date');
        const platformEl = document.getElementById('client-calendar-modal-platform');
        const captionEl = document.getElementById('client-calendar-modal-caption');
        const mediaWrap = document.getElementById('client-calendar-modal-media');
        const mediaImg = document.getElementById('client-calendar-modal-media-img');

        if (titleEl) titleEl.textContent = item.tema || item.titulo || 'Sem título';
        if (statusEl) {
            statusEl.className = 'inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700';
            statusEl.textContent = 'PENDENTE';
        }
        if (dateEl) dateEl.textContent = formatDate(item.data_agendada || item.scheduled_at);
        if (platformEl) platformEl.textContent = item.plataforma || 'Não informado';
        if (captionEl) captionEl.textContent = item.legenda || 'Sem legenda';
        if (mediaWrap && mediaImg) {
            if (item.media_url) {
                mediaImg.src = item.media_url;
                mediaWrap.classList.remove('hidden');
            } else {
                mediaWrap.classList.add('hidden');
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

    const loadCalendarForMonth = async (monthStr) => {
        const range = buildMonthRange(monthStr);
        if (!range) return;
        const { from, to } = range;
        try {
            const supabase = await window.clientApp?.getSupabaseClient?.();
            if (!supabase) {
                window.location.href = 'client_login.html';
                return;
            }
            const sessionResult = await supabase.auth.getSession();
            const session = sessionResult?.data?.session;
            const token = session?.access_token;
            if (!token) {
                window.location.href = 'client_login.html';
                return;
            }
            const headers = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            };
            const url = `/api/client/social/pending-posts?from=${from}&to=${to}`;
            const res = await fetch(url, { headers });
            const text = await res.text();
            let data = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                data = null;
            }
            if (!res.ok) {
                console.error(text);
                setEmptyState(false);
                setErrorState(true, 'Erro ao carregar calendário. Tente novamente.', text || data?.error || data?.message);
                return;
            }
            const items = Array.isArray(data?.items) ? data.items : [];
            state.items = items;
            setErrorState(false);
            if (!items.length) {
                setEmptyState(true);
                return;
            }
            setEmptyState(false);
            renderCalendar(monthStr, items);
        } catch {
            setEmptyState(false);
            setErrorState(true, 'Erro ao carregar calendário. Tente novamente.');
        }
    };

    const init = () => {
        const monthInput = document.getElementById('calendar-month-input');
        const closeBtn = document.getElementById('client-calendar-modal-close');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

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
