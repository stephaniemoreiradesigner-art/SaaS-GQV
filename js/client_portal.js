const setClientName = (value) => {
    const name = value || 'Cliente';
    const nodes = document.querySelectorAll('[data-client-name]');
    nodes.forEach(node => { node.textContent = name; });
};

const toggleSidebar = (open) => {
    const sidebar = document.getElementById('client-sidebar');
    const overlay = document.getElementById('client-sidebar-overlay');
    if (!sidebar || !overlay) return;
    const shouldOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('translate-x-0');
    if (shouldOpen) {
        sidebar.classList.add('translate-x-0');
        overlay.classList.remove('hidden');
    } else {
        sidebar.classList.remove('translate-x-0');
        overlay.classList.add('hidden');
    }
};

const setupClientNavigation = () => {
    const toggleBtn = document.getElementById('client-menu-toggle');
    const overlay = document.getElementById('client-sidebar-overlay');
    if (toggleBtn) toggleBtn.addEventListener('click', () => toggleSidebar());
    if (overlay) overlay.addEventListener('click', () => toggleSidebar(false));
};

const setupClientLogout = () => {
    const btn = document.getElementById('client-logout');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        if (window.clientSession?.clientLogout) {
            await window.clientSession.clientLogout();
            return;
        }
        if (window.supabaseClient) {
            await window.supabaseClient.auth.signOut();
        }
        window.location.href = '/client/login';
    });
};

const normalizeClientNav = (nav) => {
    if (!Array.isArray(nav) || nav.length === 0) return [];
    const hasSections = nav.some((section) => Array.isArray(section?.items));
    if (hasSections) {
        return nav
            .map((section) => ({
                label: section?.label || '',
                items: Array.isArray(section?.items) ? section.items : []
            }))
            .filter((section) => section.items.length > 0);
    }
    const items = nav
        .map((item) => ({
            label: item?.label || '',
            href: item?.href || item?.path || '',
            icon: item?.icon || '',
            permission: item?.permission
        }))
        .filter((item) => item.href);
    return items.length ? [{ label: '', items }] : [];
};

const renderClientNav = (nav, currentPath) => {
    const container = document.getElementById('client-nav');
    if (!container) return;
    const normalizedPath = currentPath.replace(/\/$/, '') || '/client';
    container.innerHTML = '';
    const normalizedNav = normalizeClientNav(nav);
    normalizedNav.forEach((section) => {
        if (section.label) {
            const label = document.createElement('div');
            label.className = 'mt-4 text-xs uppercase text-gray-400 px-3';
            label.textContent = section.label;
            container.appendChild(label);
        }
        section.items.forEach((item) => {
            const link = document.createElement('a');
            const itemHref = item.href || '';
            const itemPath = itemHref.replace(/\/$/, '') || '/client';
            const isActive = normalizedPath === itemPath;
            link.href = itemHref;
            link.className = [
                'flex items-center gap-3 px-3 py-2 rounded-lg',
                isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-gray-600 hover:bg-gray-50'
            ].join(' ');
            link.innerHTML = `<i class="${item.icon}"></i> ${item.label}`;
            container.appendChild(link);
        });
    });
};

const getRequiredPermission = (pathname) => {
    const cleaned = pathname.replace(/\/$/, '') || '/client';
    const map = {
        '/client': 'dashboard.view',
        '/client/index.html': 'dashboard.view',
        '/client/home': 'dashboard.view',
        '/client/metrics': 'metrics.view',
        '/client/metrics.html': 'metrics.view',
        '/client/integrations': 'integrations.view',
        '/client/integrations.html': 'integrations.view',
        '/client/performance': 'performance.view',
        '/client/performance.html': 'performance.view',
        '/client/approvals/calendar': 'approvals.calendar.view',
        '/client/approvals/posts': 'approvals.posts.view'
    };
    return map[cleaned] || 'dashboard.view';
};

const applyPermissionVisibility = (permissions) => {
    const list = Array.isArray(permissions) ? permissions : [];
    document.querySelectorAll('[data-required-permission]').forEach((element) => {
        const required = element.getAttribute('data-required-permission');
        if (required && !list.includes(required)) {
            element.classList.add('hidden');
        } else {
            element.classList.remove('hidden');
        }
    });
};

const getClientAccessToken = async () => {
    const supabase = await window.clientSession?.getSupabaseClient?.();
    const client = supabase || window.supabaseClient;
    if (!client?.auth?.getSession) return null;
    const { data } = await client.auth.getSession();
    return data?.session?.access_token || null;
};

const loadClientContext = async () => {
    const accessToken = await getClientAccessToken();
    if (!accessToken) {
        window.location.href = '/client/login';
        return null;
    }
    const response = await fetch(`${window.API_BASE_URL}/api/client/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (response.status === 401) {
        window.location.href = '/client/login';
        return null;
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        return null;
    }
    window.CLIENT_CONTEXT = payload || null;
    return window.CLIENT_CONTEXT;
};

const renderMenu = () => {
    renderClientNav(window.CLIENT_CONTEXT?.nav || [], window.location.pathname);
};

const ensureClientAccess = async () => {
    if (!window.clientSession?.getSupabaseClient) {
        setTimeout(ensureClientAccess, 300);
        return;
    }
    const context = await loadClientContext();
    if (!context) return;
    const tenantName = context?.tenant?.nome_fantasia || context?.tenant?.nome_empresa || context?.user?.email || 'Cliente';
    setClientName(tenantName);
    renderMenu();
    const requiredPermission = getRequiredPermission(window.location.pathname);
    const permissions = Array.isArray(context?.permissions) ? context.permissions : [];
    applyPermissionVisibility(permissions);
    if (requiredPermission && !permissions.includes(requiredPermission)) {
        window.location.href = '/client/index.html';
        return;
    }
    const content = document.getElementById('client-content');
    if (content) content.classList.remove('opacity-0');
    setupClientNavigation();
    setupClientLogout();
    if (window.supabaseClient?.auth) {
        window.supabaseClient.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                window.location.href = '/client/login';
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    ensureClientAccess();
});
