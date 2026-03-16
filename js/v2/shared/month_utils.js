(function(global) {
    if (global.MonthUtils) return;

    const pad2 = (n) => String(n).padStart(2, '0');

    const buildMonthReference = (year, month) => {
        const y = Number(year);
        const m = Number(month);
        if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return '';
        return `${y}-${pad2(m)}-01`;
    };

    const isValidMonthKey = (value) => {
        const raw = String(value || '').trim();
        if (!/^\d{4}-\d{2}$/.test(raw)) return false;
        const month = Number(raw.slice(5, 7));
        return Number.isFinite(month) && month >= 1 && month <= 12;
    };

    const parseMonthKey = (monthKey) => {
        const raw = String(monthKey || '').trim();
        if (!isValidMonthKey(raw)) return null;
        const year = Number(raw.slice(0, 4));
        const month = Number(raw.slice(5, 7));
        const monthIndex = month - 1;
        if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return null;
        return { year, monthIndex };
    };

    const buildMonthReferenceFromMonthKey = (monthKey) => {
        const parsed = parseMonthKey(monthKey);
        if (!parsed) return '';
        return buildMonthReference(parsed.year, parsed.monthIndex + 1);
    };

    const formatMonthKeyFromDate = (date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    };

    const formatLocalDate = (date) => {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    };

    const getMonthRange = (monthKey) => {
        const parsed = parseMonthKey(monthKey);
        if (!parsed) return null;
        const start = new Date(parsed.year, parsed.monthIndex, 1);
        const endExclusive = new Date(parsed.year, parsed.monthIndex + 1, 1);
        return {
            start,
            endExclusive,
            startDate: formatLocalDate(start),
            endDateExclusive: formatLocalDate(endExclusive)
        };
    };

    const addMonths = (monthKey, delta) => {
        const parsed = parseMonthKey(monthKey);
        if (!parsed) return '';
        const base = new Date(parsed.year, parsed.monthIndex + Number(delta || 0), 1);
        return formatMonthKeyFromDate(base);
    };

    const formatMonthLabel = (monthKey, locale = 'pt-BR') => {
        const parsed = parseMonthKey(monthKey);
        if (!parsed) return String(monthKey || '');
        const ref = new Date(parsed.year, parsed.monthIndex, 1);
        const label = ref.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
    };

    global.MonthUtils = {
        buildMonthReference,
        buildMonthReferenceFromMonthKey,
        isValidMonthKey,
        parseMonthKey,
        formatMonthKeyFromDate,
        formatLocalDate,
        getMonthRange,
        addMonths,
        formatMonthLabel
    };
})(window);
