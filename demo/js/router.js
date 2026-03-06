const demoRouter = (() => {
    const routes = {
        home: 'pages/home.html',
        clientes: 'pages/clientes.html',
        tarefas: 'pages/tarefas.html',
        'social-media': 'pages/social-media.html',
        'trafego-pago': 'pages/trafego-pago.html',
        financeiro: 'pages/financeiro.html',
        colaboradores: 'pages/colaboradores.html',
        configuracoes: 'pages/configuracoes.html',
        'cliente-dashboard': 'cliente/dashboard.html',
        'cliente-calendario': 'cliente/calendario.html',
        'cliente-posts': 'cliente/posts.html',
        'cliente-campanhas': 'cliente/campanhas.html',
        'cliente-insights': 'cliente/insights.html',
        'cliente-financeiro': 'cliente/financeiro.html'
    };

    const app = document.getElementById('app');

    const resolveRoute = () => {
        const hash = window.location.hash || '#/home';
        const key = hash.replace('#/', '');
        return routes[key] ? key : 'home';
    };

    const setActiveLink = (routeKey) => {
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            const linkRoute = link.getAttribute('data-route');
            if (linkRoute === routeKey) link.classList.add('active');
            else link.classList.remove('active');
        });
    };

    const loadPage = async (routeKey) => {
        const path = routes[routeKey];
        if (!path) return;
        try {
            const response = await fetch(path, { cache: 'no-cache' });
            const html = await response.text();
            app.innerHTML = html;
            setActiveLink(routeKey);
            if (window.demoApp && typeof window.demoApp.initPage === 'function') {
                window.demoApp.initPage(routeKey);
            }
        } catch (e) {
            app.innerHTML = '<div class="card">Falha ao carregar a página da demo.</div>';
        }
    };

    const handleNavigation = () => {
        const routeKey = resolveRoute();
        loadPage(routeKey);
    };

    const bindMenu = () => {
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
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
