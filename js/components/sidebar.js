// Sidebar Configuration and Rendering
const Sidebar = {
    modules: [
        { 
            name: 'Home', 
            icon: 'fas fa-home', 
            link: 'dashboard.html',
            match: ['dashboard.html', 'index.html'] // index usually redirects to dashboard or login
        },
        { 
            name: 'Clientes', 
            icon: 'fas fa-users', 
            link: 'clientes.html',
            match: ['clientes.html']
        },
        { 
            name: 'Tarefas', 
            icon: 'fas fa-tasks', 
            link: 'tarefas.html',
            match: ['tarefas.html']
        },
        { 
            name: 'Social Media', 
            icon: 'fas fa-hashtag', 
            link: 'social_media.html',
            match: ['social_media.html'],
            restricted: true,
            roles: ['super_admin', 'social_media'],
            moduleId: 'social_media'
        },
        { 
            name: 'Tráfego Pago', 
            icon: 'fas fa-bullhorn', 
            link: 'trafego_pago.html',
            match: ['trafego_pago.html'],
            restricted: true,
            roles: ['super_admin', 'trafego_pago'],
            moduleId: 'trafego_pago'
        },
        { 
            name: 'Chat', 
            icon: 'fas fa-comments', 
            link: 'chat.html',
            match: ['chat.html']
        },
        { 
            name: 'Financeiro', 
            icon: 'fas fa-dollar-sign', 
            link: 'financeiro.html',
            match: ['financeiro.html'],
            restricted: true,
            roles: ['super_admin', 'financeiro'],
            moduleId: 'financeiro.view'
        },
        { 
            name: 'Automações', 
            icon: 'fas fa-robot', 
            link: 'automacoes.html',
            match: ['automacoes.html'],
            restricted: true,
            roles: ['super_admin', 'admin'],
            moduleId: 'automacoes'
        },
        { 
            name: 'Colaboradores', 
            icon: 'fas fa-user-friends', 
            link: 'colaboradores.html',
            match: ['colaboradores.html'],
            restricted: true,
            roles: ['super_admin', 'admin'],
            moduleId: 'colaboradores'
        },
        { 
            name: 'Configurações', 
            icon: 'fas fa-cog', 
            link: 'configuracoes.html',
            match: ['configuracoes.html'],
            restricted: true,
            roles: ['super_admin', 'admin'],
            moduleId: 'configuracoes'
        }
    ],

    init: function() {
        const sidebarContainer = document.querySelector('aside nav');
        if (!sidebarContainer) return; // Se não houver sidebar na página, não faz nada

        // Limpa o conteúdo atual (mas preserva a estrutura se necessário, aqui assumo que 'nav' é o container dos links)
        sidebarContainer.innerHTML = '';

        const currentPath = window.location.pathname.split('/').pop() || 'index.html';

        this.modules.forEach(module => {
            const isActive = module.match.includes(currentPath);
            const link = document.createElement('a');
            link.href = module.link;
            link.className = `flex items-center px-6 py-3 transition-colors group ${
                isActive 
                ? 'text-primary bg-primary/5 border-r-4 border-primary font-medium' 
                : 'text-gray-500 hover:text-primary hover:bg-gray-50'
            }`;

            if (module.restricted) {
                link.classList.add('restricted');
                link.dataset.roles = module.roles.join(',');
                link.dataset.module = module.moduleId;
            }

            const icon = document.createElement('i');
            icon.className = `${module.icon} w-6 text-center transition-colors ${
                isActive ? '' : 'group-hover:text-primary'
            }`;

            const text = document.createElement('span');
            text.className = 'font-medium ml-2';
            text.textContent = module.name;

            link.appendChild(icon);
            link.appendChild(text);
            sidebarContainer.appendChild(link);
        });

        // Re-executa verificação de permissões se necessário (assumindo que app.js lida com isso)
        if (window.checkPermissions) {
            window.checkPermissions();
        }
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    Sidebar.init();
});
