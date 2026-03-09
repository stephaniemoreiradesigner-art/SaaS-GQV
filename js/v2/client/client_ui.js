// js/v2/client/client_ui.js
// Interface do Portal do Cliente V2

(function(global) {
    const ClientUI = {
        views: ['home', 'approvals-calendar', 'approvals-posts', 'metrics', 'requests'],

        init: function() {
            this.setupNavigation();
            this.setupMobileMenu();
            this.setupLogout();
        },

        setupNavigation: function() {
            const navBtns = document.querySelectorAll('.portal-nav-btn');
            navBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const view = btn.dataset.view;
                    this.switchView(view);
                });
            });
        },

        setupMobileMenu: function() {
            const toggle = document.getElementById('portal-menu-toggle');
            const sidebar = document.getElementById('portal-sidebar');
            const overlay = document.getElementById('portal-overlay');

            if (toggle && sidebar && overlay) {
                const closeMenu = () => {
                    sidebar.classList.add('-translate-x-full');
                    overlay.classList.add('hidden');
                };

                toggle.addEventListener('click', () => {
                    sidebar.classList.remove('-translate-x-full');
                    overlay.classList.remove('hidden');
                });

                overlay.addEventListener('click', closeMenu);
            }
        },

        setupLogout: function() {
            const btn = document.getElementById('client-logout');
            if (btn) {
                btn.addEventListener('click', () => {
                    if (global.ClientAuth) global.ClientAuth.logout();
                });
            }
        },

        switchView: function(viewName) {
            // Hide all
            document.querySelectorAll('.portal-view').forEach(el => el.classList.add('hidden'));
            // Show target
            const target = document.getElementById(`view-${viewName}`);
            if (target) target.classList.remove('hidden');

            // Update nav active state
            document.querySelectorAll('.portal-nav-btn').forEach(btn => {
                if (btn.dataset.view === viewName) {
                    btn.classList.add('bg-slate-100', 'text-slate-900', 'font-medium');
                    btn.classList.remove('text-slate-700');
                } else {
                    btn.classList.remove('bg-slate-100', 'text-slate-900', 'font-medium');
                    btn.classList.add('text-slate-700');
                }
            });

            // Trigger specific load logic
            if (global.ClientCore) {
                global.ClientCore.onViewChanged(viewName);
            }
        },

        updateUserInfo: function(client) {
            const nameEls = document.querySelectorAll('[data-client-name]');
            nameEls.forEach(el => el.textContent = client.name || 'Cliente');
        },

        renderCalendarList: function(calendars) {
            const container = document.getElementById('calendar-list');
            const empty = document.getElementById('calendar-empty-state');
            const loading = document.getElementById('calendar-loading');
            
            if (loading) loading.classList.add('hidden');
            if (!container) return;
            
            container.innerHTML = '';

            if (!calendars || calendars.length === 0) {
                if (empty) empty.classList.remove('hidden');
                return;
            }

            if (empty) empty.classList.add('hidden');

            calendars.forEach(cal => {
                const date = new Date(cal.mes_referencia);
                const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }); // Force UTC to avoid timezone shifts
                const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

                const card = document.createElement('div');
                card.className = 'bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow';
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-xs uppercase text-slate-400 tracking-wider">Mês de referência</p>
                            <h3 class="text-lg font-semibold text-slate-900 capitalize">${capitalizedMonth}</h3>
                        </div>
                        <span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full uppercase font-bold">Pendente</span>
                    </div>
                    <div class="flex gap-2 mt-4">
                        <button class="flex-1 bg-slate-900 text-white text-sm py-2 rounded-lg hover:bg-slate-800 transition btn-view-calendar" data-id="${cal.id}" data-month="${capitalizedMonth}">
                            Visualizar e Aprovar
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });

            // Bind click events
            document.querySelectorAll('.btn-view-calendar').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.id;
                    const month = btn.dataset.month;
                    if (global.ClientCore) global.ClientCore.openCalendarModal(id, month);
                });
            });
        },

        renderCalendarPostsInModal: function(posts) {
            const container = document.getElementById('client-calendar-posts-list');
            const loading = document.getElementById('client-calendar-posts-loading');
            const empty = document.getElementById('client-calendar-posts-empty');

            if (loading) loading.classList.add('hidden');
            if (!container) return;
            
            container.innerHTML = '';

            if (!posts || posts.length === 0) {
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');

            posts.forEach(post => {
                const date = post.data_agendada ? new Date(post.data_agendada).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem data';
                const el = document.createElement('div');
                el.className = 'bg-white border border-slate-200 rounded-lg p-3 flex gap-3';
                
                let mediaHtml = this.getMediaHtml(post);

                el.innerHTML = `
                    ${mediaHtml}
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between">
                            <p class="text-xs text-slate-500">${date}</p>
                            <span class="text-[10px] uppercase px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">${post.formato || 'Post'}</span>
                        </div>
                        <h4 class="font-medium text-slate-900 truncate text-sm">${post.tema || post.titulo || 'Sem título'}</h4>
                        <p class="text-xs text-slate-500 truncate">${post.legenda || ''}</p>
                    </div>
                `;
                container.appendChild(el);
            });
        },

        renderPendingPostsList: function(posts) {
            const container = document.getElementById('client-approvals-list');
            const empty = document.getElementById('client-approvals-empty');
            
            if (!container) return;
            container.innerHTML = '';

            if (!posts || posts.length === 0) {
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');

            posts.forEach(post => {
                const date = post.data_agendada ? new Date(post.data_agendada).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem data';
                const el = document.createElement('div');
                el.className = 'bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4';
                
                let mediaHtml = this.getMediaHtml(post, 'w-full md:w-32 h-48 md:h-32');

                el.innerHTML = `
                    ${mediaHtml}
                    <div class="flex-1 space-y-2">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="text-xs text-slate-500 mb-1">${date}</p>
                                <h3 class="font-semibold text-slate-900">${post.tema || post.titulo || 'Sem título'}</h3>
                            </div>
                            <span class="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full uppercase font-bold">Pendente</span>
                        </div>
                        <p class="text-sm text-slate-600 line-clamp-2">${post.legenda || ''}</p>
                        <div class="flex justify-end gap-2 mt-2">
                            <button class="px-3 py-1.5 rounded border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 btn-reject-post" data-id="${post.id}">Ajustar</button>
                            <button class="px-3 py-1.5 rounded bg-slate-900 text-white text-sm hover:bg-slate-800 btn-approve-post" data-id="${post.id}">Aprovar</button>
                        </div>
                    </div>
                `;
                container.appendChild(el);
            });

            // Bind events
            document.querySelectorAll('.btn-approve-post').forEach(btn => {
                btn.addEventListener('click', () => {
                     if(global.ClientCore) global.ClientCore.handleApprovePost(btn.dataset.id);
                });
            });
             document.querySelectorAll('.btn-reject-post').forEach(btn => {
                btn.addEventListener('click', () => {
                     const reason = prompt('Motivo do ajuste:');
                     if(reason && global.ClientCore) global.ClientCore.handleRejectPost(btn.dataset.id, reason);
                });
            });
        },

        getMediaHtml: function(post, classes = 'w-16 h-16') {
            if (post.imagem_url) {
                if (post.imagem_url.match(/\.(mp4|webm)$/i)) {
                    return `<video src="${post.imagem_url}" class="${classes} object-cover rounded bg-slate-100"></video>`;
                } else {
                    return `<img src="${post.imagem_url}" class="${classes} object-cover rounded bg-slate-100">`;
                }
            }
            return `<div class="${classes} bg-slate-100 rounded flex items-center justify-center text-slate-300"><i class="fas fa-image"></i></div>`;
        },

        showCalendarModal: function(show) {
            const modal = document.getElementById('client-calendar-modal');
            if (modal) {
                if (show) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                } else {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            }
        },

        setDashboardMetrics: function(data) {
            const approvalsEl = document.getElementById('home-approvals');
            if (approvalsEl) approvalsEl.textContent = data.approvals || 0;
            
            // Other metrics...
        }
    };

    global.ClientUI = ClientUI;

})(window);
