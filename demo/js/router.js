const demoRouter = (() => {
    const defaultConfig = {
        routes: {
            home: 'pages/home.html',
            clientes: 'pages/clientes.html',
            tarefas: 'pages/tarefas.html',
            'social-media': 'pages/social-media.html',
            'trafego-pago': 'pages/trafego-pago.html',
            financeiro: 'pages/financeiro.html',
            colaboradores: 'pages/colaboradores.html',
            configuracoes: 'pages/configuracoes.html'
        },
        defaultRoute: 'home',
        linkSelector: '.sidebar-menu a',
        activeClass: 'active'
    };

    const app = document.getElementById('app');

    const getConfig = () => {
        return window.demoRouterConfig || defaultConfig;
    };

    const resolveRoute = (config) => {
        const hash = window.location.hash || `#/${config.defaultRoute}`;
        const key = hash.replace('#/', '');
        return config.routes[key] ? key : config.defaultRoute;
    };

    const setActiveLink = (routeKey, config) => {
        const links = document.querySelectorAll(config.linkSelector);
        links.forEach(link => {
            const linkRoute = link.getAttribute('data-route');
            if (linkRoute === routeKey) link.classList.add(config.activeClass);
            else link.classList.remove(config.activeClass);
        });
    };

    const loadPage = async (routeKey, config) => {
        const path = config.routes[routeKey];
        if (!path) return;
        try {
            const response = await fetch(path, { cache: 'no-cache' });
            const html = await response.text();
            if (app) app.innerHTML = html;
            setActiveLink(routeKey, config);
            if (window.demoApp && typeof window.demoApp.initPage === 'function') {
                window.demoApp.initPage(routeKey);
            }
        } catch (e) {
            if (app) app.innerHTML = '<div class="card">Falha ao carregar a página da demo.</div>';
        }
    };

    const handleNavigation = () => {
        const config = getConfig();
        const routeKey = resolveRoute(config);
        loadPage(routeKey, config);
    };

    const bindMenu = () => {
        const config = getConfig();
        const links = document.querySelectorAll(config.linkSelector);
        links.forEach(link => {
            link.addEventListener('click', () => {
                const routeKey = link.getAttribute('data-route');
                if (!routeKey) return;
                window.location.hash = `#/${routeKey}`;
            });
        });
    };

    const start = () => {
        bindMenu();
        window.addEventListener('hashchange', handleNavigation);
        handleNavigation();
    };

    return { start };
})();

document.addEventListener('DOMContentLoaded', () => {
    demoRouter.start();
});
