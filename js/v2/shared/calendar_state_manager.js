(function(global) {
    if (global.CalendarStateManager) return;

    const monthUtils = () => global.MonthUtils;
    const selectors = () => global.CalendarStateSelectors;

    const clone = (value) => {
        try {
            return structuredClone(value);
        } catch {
            return JSON.parse(JSON.stringify(value));
        }
    };

    const createInitialState = () => ({
        clientId: null,
        tenantId: null,
        visibleYear: null,
        visibleMonth: null,
        monthKey: '',
        monthStart: null,
        pendingMonthKey: null,
        activeCalendarId: null,
        calendarStatus: null,
        editorialItems: [],
        monthPosts: [],
        selectedItemId: null,
        selectedPostId: null,
        loading: {
            monthData: false,
            calendarMeta: false,
            editorialItems: false,
            monthPosts: false
        },
        lastRequestKey: null,
        version: 0,
        error: null
    });

    let state = createInitialState();
    const listeners = new Set();
    let adapters = {
        loadInitialMonthKey: null,
        persistMonthKey: null,
        fetchCalendarMeta: null,
        fetchEditorialItems: null,
        fetchMonthPosts: null
    };

    const notify = () => {
        const snapshot = CalendarStateManager.getState();
        listeners.forEach((fn) => {
            try {
                fn(snapshot);
            } catch (e) {
                console.error('[CalendarStateManager] listener error:', e);
            }
        });
    };

    const setState = (patch) => {
        state = { ...state, ...patch };
        notify();
    };

    const setMonthKey = (monthKey) => {
        const mu = monthUtils();
        if (!mu?.isValidMonthKey?.(monthKey) || !mu?.parseMonthKey || !mu?.getMonthRange) return;
        const parsed = mu.parseMonthKey(monthKey);
        const range = mu.getMonthRange(monthKey);
        if (!parsed || !range) return;
        state = {
            ...state,
            visibleYear: parsed.year,
            visibleMonth: parsed.monthIndex + 1,
            monthKey,
            monthStart: range.start
        };
    };

    const computeMonthInfo = (monthKey) => {
        const mu = monthUtils();
        if (!mu?.isValidMonthKey?.(monthKey) || !mu?.parseMonthKey || !mu?.getMonthRange) return null;
        const parsed = mu.parseMonthKey(monthKey);
        const range = mu.getMonthRange(monthKey);
        if (!parsed || !range) return null;
        return {
            monthKey,
            monthStart: range.start,
            visibleYear: parsed.year,
            visibleMonth: parsed.monthIndex + 1,
            range
        };
    };

    const init = (input) => {
        const mu = monthUtils();
        if (!mu?.formatMonthKeyFromDate) return;

        const clientId = input?.clientId ?? null;
        const tenantId = input?.tenantId ?? null;
        const monthKeyFromInput = String(input?.monthKey || '').trim();

        adapters = {
            loadInitialMonthKey: input?.loadInitialMonthKey || null,
            persistMonthKey: input?.persistMonthKey || null,
            fetchCalendarMeta: input?.fetchCalendarMeta || null,
            fetchEditorialItems: input?.fetchEditorialItems || null,
            fetchMonthPosts: input?.fetchMonthPosts || null
        };

        state = createInitialState();
        state.clientId = clientId;
        state.tenantId = tenantId;

        let initialMonthKey = '';
        if (mu.isValidMonthKey?.(monthKeyFromInput)) {
            initialMonthKey = monthKeyFromInput;
        } else if (typeof adapters.loadInitialMonthKey === 'function') {
            const loaded = String(adapters.loadInitialMonthKey({ clientId, tenantId }) || '').trim();
            if (mu.isValidMonthKey?.(loaded)) initialMonthKey = loaded;
        }
        if (!initialMonthKey) initialMonthKey = mu.formatMonthKeyFromDate(new Date());
        setMonthKey(initialMonthKey);
        notify();
        return CalendarStateManager.getState();
    };

    const refreshMonthData = async (input) => {
        const mu = monthUtils();
        const sel = selectors();
        if (!mu?.isValidMonthKey || !mu?.getMonthRange || !sel?.getMonthRefFromMonthKey) return state;
        if (!state.clientId) return CalendarStateManager.getState();

        const requestedMonthKeyRaw = String(input?.monthKey || '').trim();
        const requestedMonthKey = mu.isValidMonthKey(requestedMonthKeyRaw) ? requestedMonthKeyRaw : state.monthKey;
        if (!mu.isValidMonthKey(requestedMonthKey)) return CalendarStateManager.getState();

        const monthInfo = computeMonthInfo(requestedMonthKey);
        if (!monthInfo?.range) return CalendarStateManager.getState();

        const isMonthChange = requestedMonthKey !== state.monthKey;

        const requestVersion = (state.version || 0) + 1;
        const requestKey = `${String(state.clientId)}:${String(state.tenantId || '')}:${requestedMonthKey}:${requestVersion}`;

        state = {
            ...state,
            version: requestVersion,
            lastRequestKey: requestKey,
            error: null,
            pendingMonthKey: isMonthChange ? requestedMonthKey : null,
            loading: { monthData: true, calendarMeta: true, editorialItems: true, monthPosts: true }
        };
        notify();

        const currentKey = () => state.lastRequestKey;
        const sameRequest = () => currentKey() === requestKey;

        const monthRef = sel.getMonthRefFromMonthKey(requestedMonthKey);

        try {
            let calendarMeta = null;
            if (typeof adapters.fetchCalendarMeta === 'function') {
                calendarMeta = await adapters.fetchCalendarMeta({
                    clientId: state.clientId,
                    tenantId: state.tenantId,
                    monthKey: requestedMonthKey,
                    monthRef
                });
            }
            if (!sameRequest()) return CalendarStateManager.getState();

            const activeCalendarId = calendarMeta?.id || calendarMeta?.calendarId || calendarMeta?.calendar_id || null;
            const calendarStatus = calendarMeta?.status ?? null;

            let editorialItems = [];
            if (typeof adapters.fetchEditorialItems === 'function' && activeCalendarId) {
                const items = await adapters.fetchEditorialItems({
                    clientId: state.clientId,
                    tenantId: state.tenantId,
                    monthKey: requestedMonthKey,
                    activeCalendarId
                });
                editorialItems = Array.isArray(items) ? items : [];
            }
            if (!sameRequest()) return CalendarStateManager.getState();

            let monthPosts = [];
            if (typeof adapters.fetchMonthPosts === 'function') {
                const posts = await adapters.fetchMonthPosts({
                    clientId: state.clientId,
                    tenantId: state.tenantId,
                    monthKey: requestedMonthKey,
                    startDate: monthInfo.range.startDate,
                    endDateExclusive: monthInfo.range.endDateExclusive
                });
                monthPosts = Array.isArray(posts) ? posts : [];
            }
            if (!sameRequest()) return CalendarStateManager.getState();

            state = {
                ...state,
                ...(isMonthChange ? {
                    monthKey: monthInfo.monthKey,
                    monthStart: monthInfo.monthStart,
                    visibleYear: monthInfo.visibleYear,
                    visibleMonth: monthInfo.visibleMonth
                } : {}),
                activeCalendarId,
                calendarStatus,
                editorialItems,
                monthPosts,
                pendingMonthKey: null,
                loading: { monthData: false, calendarMeta: false, editorialItems: false, monthPosts: false }
            };
            notify();

            if (typeof adapters.persistMonthKey === 'function') {
                try {
                    adapters.persistMonthKey({ clientId: state.clientId, tenantId: state.tenantId, monthKey: requestedMonthKey });
                } catch {}
            }
        } catch (err) {
            if (!sameRequest()) return CalendarStateManager.getState();
            state = {
                ...state,
                error: err,
                pendingMonthKey: null,
                loading: { monthData: false, calendarMeta: false, editorialItems: false, monthPosts: false }
            };
            notify();
        }

        return CalendarStateManager.getState();
    };

    const goToMonth = async (year, month) => {
        const mu = monthUtils();
        if (!mu?.formatMonthKeyFromDate) return CalendarStateManager.getState();
        const y = Number(year);
        const m = Number(month);
        if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return CalendarStateManager.getState();
        const key = mu.formatMonthKeyFromDate(new Date(y, m - 1, 1));
        await refreshMonthData({ monthKey: key, source: 'goToMonth' });
        return CalendarStateManager.getState();
    };

    const nextMonth = async () => {
        const mu = monthUtils();
        if (!mu?.addMonths) return CalendarStateManager.getState();
        const base = state.pendingMonthKey || state.monthKey;
        const next = mu.addMonths(base, 1);
        if (!next) return CalendarStateManager.getState();
        await refreshMonthData({ monthKey: next, source: 'nextMonth' });
        return CalendarStateManager.getState();
    };

    const prevMonth = async () => {
        const mu = monthUtils();
        if (!mu?.addMonths) return CalendarStateManager.getState();
        const base = state.pendingMonthKey || state.monthKey;
        const prev = mu.addMonths(base, -1);
        if (!prev) return CalendarStateManager.getState();
        await refreshMonthData({ monthKey: prev, source: 'prevMonth' });
        return CalendarStateManager.getState();
    };

    const subscribe = (listener) => {
        if (typeof listener !== 'function') return () => {};
        listeners.add(listener);
        try {
            listener(CalendarStateManager.getState());
        } catch {}
        return () => listeners.delete(listener);
    };

    const selectEditorialItem = (id) => {
        setState({ selectedItemId: id ?? null, selectedPostId: null });
        return CalendarStateManager.getState();
    };

    const selectPost = (id) => {
        setState({ selectedPostId: id ?? null, selectedItemId: null });
        return CalendarStateManager.getState();
    };

    const clearSelection = () => {
        setState({ selectedItemId: null, selectedPostId: null });
        return CalendarStateManager.getState();
    };

    const patchEditorialItem = (id, patch) => {
        const key = String(id ?? '').trim();
        if (!key) return CalendarStateManager.getState();
        const next = (state.editorialItems || []).map((it) => (String(it?.id ?? '') === key ? { ...it, ...(patch || {}) } : it));
        setState({ editorialItems: next });
        return CalendarStateManager.getState();
    };

    const patchPost = (id, patch) => {
        const key = String(id ?? '').trim();
        if (!key) return CalendarStateManager.getState();
        const next = (state.monthPosts || []).map((it) => (String(it?.id ?? '') === key ? { ...it, ...(patch || {}) } : it));
        setState({ monthPosts: next });
        return CalendarStateManager.getState();
    };

    const CalendarStateManager = {
        init,
        getState: () => clone(state),
        subscribe,
        goToMonth,
        nextMonth,
        prevMonth,
        refreshMonthData,
        selectEditorialItem,
        selectPost,
        clearSelection,
        patchEditorialItem,
        patchPost
    };

    global.CalendarStateManager = CalendarStateManager;
})(window);
