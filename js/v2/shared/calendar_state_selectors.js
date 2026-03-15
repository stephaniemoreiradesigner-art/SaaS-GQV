(function(global) {
    if (global.CalendarStateSelectors) return;

    const monthUtils = () => global.MonthUtils;

    const getMonthKeyFromMonthRef = (monthRef) => {
        const raw = String(monthRef || '').trim();
        if (!raw) return '';
        const key = raw.length >= 7 ? raw.slice(0, 7) : raw;
        if (monthUtils()?.isValidMonthKey?.(key)) return key;
        return '';
    };

    const getMonthRefFromMonthKey = (monthKey) => {
        const raw = String(monthKey || '').trim();
        if (!monthUtils()?.isValidMonthKey?.(raw)) return '';
        return `${raw}-01`;
    };

    const getMonthRange = (monthKey) => {
        const raw = String(monthKey || '').trim();
        return monthUtils()?.getMonthRange?.(raw) || null;
    };

    const formatMonthLabel = (monthKey) => {
        const raw = String(monthKey || '').trim();
        return monthUtils()?.formatMonthLabel?.(raw) || raw;
    };

    const getTodayLocalDate = () => {
        return monthUtils()?.formatLocalDate?.(new Date()) || '';
    };

    const getCurrentMonthKey = () => {
        return monthUtils()?.formatMonthKeyFromDate?.(new Date()) || '';
    };

    const formatMonthKeyFromDate = (date) => {
        return monthUtils()?.formatMonthKeyFromDate?.(date) || '';
    };

    global.CalendarStateSelectors = {
        getMonthKeyFromMonthRef,
        getMonthRefFromMonthKey,
        getMonthRange,
        formatMonthLabel,
        getTodayLocalDate,
        getCurrentMonthKey,
        formatMonthKeyFromDate
    };
})(window);
