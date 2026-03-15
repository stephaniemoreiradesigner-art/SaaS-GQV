// js/v2/client/client_ui.js
// Interface do Portal do Cliente V2

(function(global) {
    const ClientUI = {
        views: ['home', 'calendar', 'approvals', 'history', 'metrics'],
        metricsChart: null,

        init: function() {
            this.setupNavigation();
            this.setupMobileMenu();
            this.setupLogout();
            this.setupApprovalsTabs();
            this.setupCalendarNavigation();
            this.setupHomeActions();
            this.switchView('home');
        },

        setupNavigation: function() {
            const navBtns = document.querySelectorAll('.portal-nav-btn');
            navBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const view = btn.dataset.view;
                    this.switchView(view);
                    const sidebar = document.getElementById('portal-sidebar');
                    const overlay = document.getElementById('portal-overlay');
                    sidebar?.classList?.add?.('-translate-x-full');
                    overlay?.classList?.add?.('hidden');
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
                // Remove existing listeners by cloning
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                newBtn.addEventListener('click', () => {
                    if (global.ClientAuth) {
                        console.log('[ClientUI] Logout acionado');
                        global.ClientAuth.logout();
                    } else {
                        console.error('[ClientUI] ClientAuth não encontrado para logout');
                        window.location.href = '/v2/client/login.html';
                    }
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
                    btn.classList.add('bg-slate-900', 'text-white');
                    btn.classList.remove('text-slate-700');
                    const icon = btn.querySelector('i');
                    if (icon) icon.classList.add('text-white');
                } else {
                    btn.classList.remove('bg-slate-900', 'text-white');
                    btn.classList.add('text-slate-700');
                    const icon = btn.querySelector('i');
                    if (icon) icon.classList.remove('text-white');
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

        setDashboardHeader: function({ clientId, tenantId, status } = {}) {
            const clientIdEl = document.getElementById('client-dashboard-client-id');
            const tenantIdEl = document.getElementById('client-dashboard-tenant-id');
            const statusBadge = document.getElementById('client-dashboard-status-badge');

            if (clientIdEl) clientIdEl.textContent = clientId ? String(clientId) : '-';
            if (tenantIdEl) tenantIdEl.textContent = tenantId ? String(tenantId) : '-';

            if (statusBadge) {
                const value = String(status || '').trim();
                statusBadge.innerHTML = `
                    <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                    Status: ${value || '-'}
                `;
            }
        },

        initMetricsChart: function() {
            if (this.metricsChart) return;
            const canvas = document.getElementById('metrics-chart');
            if (!canvas || typeof global.Chart === 'undefined') return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            this.metricsChart = new global.Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Sem1', 'Sem2', 'Sem3', 'Sem4'],
                    datasets: [{
                        label: 'Resultados',
                        data: [0, 0, 0, 0],
                        borderColor: '#111827',
                        backgroundColor: 'rgba(17,24,39,0.08)',
                        tension: 0.35,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, ticks: { color: '#9CA3AF' } },
                        x: { ticks: { color: '#9CA3AF' } }
                    }
                }
            });
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
                const rawStatus = String(cal.status || '').trim().toLowerCase();
                const statusMap = {
                    draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700 border border-slate-200' },
                    rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700 border border-slate-200' },
                    awaiting_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
                    aguardando_aprovacao: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
                    sent_for_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
                    needs_changes: { label: 'Ajuste solicitado', cls: 'bg-sky-100 text-sky-700 border border-sky-200' },
                    ajuste_solicitado: { label: 'Ajuste solicitado', cls: 'bg-sky-100 text-sky-700 border border-sky-200' },
                    approved: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
                    aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
                    in_production: { label: 'Em produção', cls: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
                    em_producao: { label: 'Em produção', cls: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
                    published: { label: 'Publicado', cls: 'bg-slate-900 text-white border border-slate-900' },
                    publicado: { label: 'Publicado', cls: 'bg-slate-900 text-white border border-slate-900' },
                    archived: { label: 'Concluído', cls: 'bg-slate-100 text-slate-700 border border-slate-200' },
                    concluido: { label: 'Concluído', cls: 'bg-slate-100 text-slate-700 border border-slate-200' }
                };
                const statusInfo = statusMap[rawStatus] || { label: rawStatus || 'Status', cls: 'bg-slate-100 text-slate-700 border border-slate-200' };

                const card = document.createElement('div');
                card.className = 'bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer';
                card.innerHTML = `
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-xs uppercase text-slate-400 tracking-wider">Mês de referência</p>
                            <h3 class="text-lg font-semibold text-slate-900 capitalize">${capitalizedMonth}</h3>
                        </div>
                        <span class="text-xs px-2 py-1 rounded-full uppercase font-bold ${statusInfo.cls}">${statusInfo.label}</span>
                    </div>
                `;
                card.setAttribute('role', 'button');
                card.tabIndex = 0;
                const open = () => {
                    const monthKey = global.CalendarStateSelectors?.getMonthKeyFromMonthRef
                        ? global.CalendarStateSelectors.getMonthKeyFromMonthRef(cal.mes_referencia)
                        : '';
                    if (global.ClientCore) global.ClientCore.openCalendarModal(cal.id, monthKey, rawStatus);
                };
                card.addEventListener('click', open);
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        open();
                    }
                });
                container.appendChild(card);
            });
        },

        renderCalendarPostsInModal: function(items) {
            const container = document.getElementById('client-calendar-posts-list');
            const loading = document.getElementById('client-calendar-posts-loading');
            const empty = document.getElementById('client-calendar-posts-empty');
            const commentEl = document.getElementById('client-calendar-approval-comment');

            if (loading) loading.classList.add('hidden');
            if (!container) return;
            
            container.innerHTML = '';

            if (!items || items.length === 0) {
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');

            items.forEach(item => {
                const dateRaw = item.data || item.data_agendada || item.data_postagem || '';
                const date = dateRaw ? new Date(String(dateRaw).slice(0, 10)).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem data';
                const tema = item.tema || item.titulo || item.title || 'Sem título';
                const tipo = item.tipo_conteudo || item.formato || 'post_estatico';
                const canal = item.canal || item.plataforma || item.platform || '-';
                const copy = item.copy || item.copy_text || item.copywriting || '';
                const obs = item.observacoes || '';
                const notes = item.notes || item.legenda || '';
                const detailText = String(copy || obs || notes || '').trim();
                const detailId = `cal-item-detail-${String(item.id || Math.random()).replace(/[^\w-]/g, '')}`;

                const el = document.createElement('div');
                el.className = 'bg-white border border-slate-200 rounded-xl p-4';
                el.innerHTML = `
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-xs text-slate-500">${date} • ${canal}</p>
                            <p class="mt-1 text-sm font-semibold text-slate-900" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${tema}</p>
                        </div>
                        <span class="text-[10px] uppercase px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 border border-slate-200">${tipo}</span>
                    </div>
                    <div class="mt-3 flex items-center justify-end gap-2">
                        <button type="button" data-cal-item-action="request-changes" class="ui-btn ui-btn-secondary">Solicitar ajuste deste item</button>
                        <button type="button" data-cal-item-action="toggle" class="ui-btn ui-btn-secondary">Detalhes</button>
                    </div>
                    <div id="${detailId}" class="hidden mt-4 ui-surface-2 p-4">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <p class="text-[11px] uppercase tracking-widest text-slate-400">Tema</p>
                                <p class="text-sm text-slate-800">${tema}</p>
                            </div>
                            <div>
                                <p class="text-[11px] uppercase tracking-widest text-slate-400">Data</p>
                                <p class="text-sm text-slate-800">${date}</p>
                            </div>
                            <div>
                                <p class="text-[11px] uppercase tracking-widest text-slate-400">Canal</p>
                                <p class="text-sm text-slate-800">${canal}</p>
                            </div>
                            <div>
                                <p class="text-[11px] uppercase tracking-widest text-slate-400">Tipo</p>
                                <p class="text-sm text-slate-800">${tipo}</p>
                            </div>
                        </div>
                        <div class="mt-4">
                            <p class="text-[11px] uppercase tracking-widest text-slate-400">Copy/Observações</p>
                            <p class="text-sm text-slate-700 whitespace-pre-wrap">${detailText || '-'}</p>
                        </div>
                    </div>
                `;
                const toggleBtn = el.querySelector('[data-cal-item-action="toggle"]');
                const detailEl = el.querySelector(`#${detailId}`);
                if (toggleBtn && detailEl) {
                    toggleBtn.addEventListener('click', () => {
                        detailEl.classList.toggle('hidden');
                    });
                }
                const requestBtn = el.querySelector('[data-cal-item-action="request-changes"]');
                if (requestBtn) {
                    requestBtn.addEventListener('click', () => {
                        if (!commentEl) return;
                        const prefix = `Solicitar ajuste no item: "${tema}" (${date} • ${canal} • ${tipo})`;
                        const extra = detailText ? `\n\n${detailText}` : '';
                        commentEl.value = `${prefix}${extra}`.trim();
                        commentEl.focus();
                        commentEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
                    });
                }
                container.appendChild(el);
            });
        },

        showPostModal: function(show, postData = null, options = null) {
            const modal = document.getElementById('client-post-modal');
            if (!modal) return;

            if (show && postData) {
                // Populate Data
                const date = postData.data_agendada ? new Date(postData.data_agendada).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem data';
                const title = postData.tema || postData.titulo || postData.title || 'Detalhes do Post';
                const mediaUrl = postData.imagem_url || postData.media_url;
                const titleEl = document.getElementById('client-post-modal-title');
                document.getElementById('client-post-modal-date').textContent = date;
                document.getElementById('client-post-modal-caption').textContent = postData.legenda || 'Sem legenda.';
                if (titleEl) titleEl.textContent = title;
                
                // Status Badge
                const statusEl = document.getElementById('client-post-modal-status');
                const statusMap = {
                    'draft': 'Rascunho',
                    'ready_for_approval': 'Pendente',
                    'pendente_aprovacao': 'Pendente',
                    'pendente_aprovação': 'Pendente',
                    'aguardando_aprovacao': 'Pendente',
                    'awaiting_approval': 'Pendente',
                    'approved': 'Aprovado',
                    'changes_requested': 'Ajustes Solicitados',
                    'scheduled': 'Agendado',
                    'published': 'Publicado'
                };
                statusEl.textContent = statusMap[postData.status] || postData.status;
                
                // Media
                const mediaContainer = document.getElementById('client-post-modal-media-container');
                let mediaHtml = '';
                if (mediaUrl) {
                    if (mediaUrl.match(/\.(mp4|webm|mov)$/i)) {
                         mediaHtml = `<video src="${mediaUrl}" controls class="max-w-full max-h-[400px] rounded"></video>`;
                    } else {
                         mediaHtml = `<img src="${mediaUrl}" class="max-w-full max-h-[400px] object-contain rounded">`;
                    }
                } else {
                    mediaHtml = `<div class="text-slate-400 flex flex-col items-center"><i class="fas fa-image text-4xl mb-2"></i><span class="text-sm">Sem mídia</span></div>`;
                }
                mediaContainer.innerHTML = mediaHtml;

                // Reset Comment
                const commentInput = document.getElementById('client-post-modal-comment');
                if(commentInput) commentInput.value = '';

                const rawStatus = String(postData.status || '').trim().toLowerCase();
                const pendingStatuses = global.ClientRepo?.getPendingPostStatuses ? global.ClientRepo.getPendingPostStatuses() : [];
                const isReadOnly = !!(options && options.readOnly);
                const canApprove = !isReadOnly && pendingStatuses.includes(rawStatus);
                const actions = document.getElementById('client-post-modal-actions');
                const approveBtn = document.getElementById('client-post-modal-approve');
                const rejectBtn = document.getElementById('client-post-modal-reject');
                if (actions) actions.classList.toggle('hidden', !canApprove);
                if (approveBtn) approveBtn.disabled = !canApprove;
                if (rejectBtn) rejectBtn.disabled = !canApprove;

                modal.classList.remove('hidden');
                modal.classList.add('flex');
            } else {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        },

        renderPendingPostsList: function(posts) {
            const container = document.getElementById('client-approvals-list');
            const empty = document.getElementById('client-approvals-empty');
            const loading = document.getElementById('posts-loading');
            
            if (loading) loading.classList.add('hidden');
            if (!container) return;
            container.innerHTML = '';

            if (!posts || posts.length === 0) {
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');

            posts.forEach(post => {
                const dateRaw = post.data_agendada || post.data_postagem || null;
                const date = dateRaw ? new Date(dateRaw).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem data';
                const el = document.createElement('div');
                el.className = 'ui-card p-5 border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition';
                
                // Click card to open modal
                el.onclick = (e) => {
                    // Prevent if clicking buttons directly
                    if(e.target.tagName === 'BUTTON') return;
                    if(global.ClientCore) global.ClientCore.openPostModal(post);
                };

                const title = post.tema || post.titulo || 'Post sem título';
                const caption = post.legenda || 'Sem legenda';
                const platform = post.plataforma || post.platform || post.canal || '-';

                let mediaHtml = this.getMediaHtml(post, 'w-full md:w-40 h-48 md:h-28');

                el.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-4 items-start">
                        <div class="min-w-0">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="text-xs uppercase tracking-widest text-slate-400">Aguardando sua aprovação</p>
                                    <h3 class="mt-1 text-base font-semibold text-slate-900" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${title}</h3>
                                    <p class="mt-1 text-xs text-slate-500 truncate">${platform} • ${date}</p>
                                </div>
                                <span class="ui-pill bg-amber-100 text-amber-700 border border-amber-100">Pendente</span>
                            </div>
                            <p class="mt-3 text-sm text-slate-600" style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${caption}</p>
                            <div class="mt-4 flex flex-col sm:flex-row gap-2">
                                <button type="button" class="ui-btn ui-btn-primary btn-open-post-modal">Revisar e aprovar</button>
                                <button type="button" class="ui-btn ui-btn-secondary btn-request-changes">Solicitar ajustes</button>
                            </div>
                        </div>
                        <div class="md:justify-self-end">
                            ${mediaHtml}
                        </div>
                    </div>
                `;

                const viewBtn = el.querySelector('.btn-open-post-modal');
                if (viewBtn) {
                    viewBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (global.ClientCore) global.ClientCore.openPostModal(post);
                    });
                }
                const requestBtn = el.querySelector('.btn-request-changes');
                if (requestBtn) {
                    requestBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (global.ClientCore) global.ClientCore.openPostModal(post);
                        setTimeout(() => document.getElementById('client-post-modal-comment')?.focus(), 0);
                    });
                }
                container.appendChild(el);
            });
        },

        renderFilesList: function(files) {
            const container = document.getElementById('files-list');
            const empty = document.getElementById('files-empty-state');
            const loading = document.getElementById('files-loading');
            if (loading) loading.classList.add('hidden');
            if (!container) return;
            container.innerHTML = '';
            const items = Array.isArray(files) ? files : [];
            if (items.length === 0) {
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');
            items.forEach((file) => {
                const card = document.createElement('div');
                card.className = 'ui-card p-4 flex items-center justify-between';
                const name = file?.name || file?.nome || 'Arquivo';
                card.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                            <i class="fas fa-file"></i>
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-slate-900">${String(name)}</p>
                            <p class="text-xs text-slate-500">Disponível</p>
                        </div>
                    </div>
                    <span class="text-xs text-slate-400">Em breve</span>
                `;
                container.appendChild(card);
            });
        },

        getMediaHtml: function(post, classes = 'w-16 h-16') {
            // [FIX] Normalizar campo de mídia
            const mediaUrl = post.imagem_url || post.media_url;
            
            if (mediaUrl) {
                if (mediaUrl.match(/\.(mp4|webm|mov)$/i)) {
                    return `<video src="${mediaUrl}" class="${classes} object-cover rounded bg-slate-100"></video>`;
                } else {
                    return `<img src="${mediaUrl}" class="${classes} object-cover rounded bg-slate-100" onerror="this.src='https://placehold.co/400?text=Erro+Midia'">`;
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

        setupApprovalsTabs: function() {
            const postsBtn = document.getElementById('approvals-tab-posts');
            const calendarsBtn = document.getElementById('approvals-tab-calendars');
            if (!postsBtn || !calendarsBtn) return;
            postsBtn.addEventListener('click', () => {
                this.setApprovalsTab('posts');
                global.ClientCore?.loadPendingPosts?.();
            });
            calendarsBtn.addEventListener('click', () => {
                this.setApprovalsTab('calendars');
                global.ClientCore?.loadCalendars?.();
            });
            this.setApprovalsTab('posts');
        },

        setApprovalsTab: function(tabKey) {
            const postsBtn = document.getElementById('approvals-tab-posts');
            const calendarsBtn = document.getElementById('approvals-tab-calendars');
            const postsPanel = document.getElementById('approvals-panel-posts');
            const calendarsPanel = document.getElementById('approvals-panel-calendars');
            const key = String(tabKey || 'posts').trim().toLowerCase();
            if (postsPanel) postsPanel.classList.toggle('hidden', key !== 'posts');
            if (calendarsPanel) calendarsPanel.classList.toggle('hidden', key !== 'calendars');
            if (postsBtn) {
                postsBtn.classList.toggle('bg-white', key === 'posts');
                postsBtn.classList.toggle('shadow-sm', key === 'posts');
                postsBtn.classList.toggle('text-slate-900', key === 'posts');
                postsBtn.classList.toggle('text-slate-600', key !== 'posts');
            }
            if (calendarsBtn) {
                calendarsBtn.classList.toggle('bg-white', key === 'calendars');
                calendarsBtn.classList.toggle('shadow-sm', key === 'calendars');
                calendarsBtn.classList.toggle('text-slate-900', key === 'calendars');
                calendarsBtn.classList.toggle('text-slate-600', key !== 'calendars');
            }
        },

        setupCalendarNavigation: function() {
            const prevBtn = document.getElementById('client-calendar-prev');
            const nextBtn = document.getElementById('client-calendar-next');
            if (prevBtn) prevBtn.onclick = async () => {
                if (global.CalendarStateManager?.prevMonth) {
                    await global.CalendarStateManager.prevMonth();
                    return;
                }
                await global.ClientCore?.shiftCalendarMonth?.(-1);
            };
            if (nextBtn) nextBtn.onclick = async () => {
                if (global.CalendarStateManager?.nextMonth) {
                    await global.CalendarStateManager.nextMonth();
                    return;
                }
                await global.ClientCore?.shiftCalendarMonth?.(1);
            };
        },

        setupHomeActions: function() {
            const btn = document.getElementById('home-go-approvals');
            if (!btn) return;
            btn.addEventListener('click', () => this.switchView('approvals'));
        },

        setHomeApprovalAlerts: function({ pendingCalendarsCount = 0, pendingPostsWithMediaCount = 0 } = {}) {
            const editorialEl = document.getElementById('home-alert-editorial');
            const editorialCountEl = document.getElementById('home-alert-editorial-count');
            const editorialAction = document.getElementById('home-alert-editorial-action');
            const postsEl = document.getElementById('home-alert-posts');
            const postsCountEl = document.getElementById('home-alert-posts-count');
            const postsAction = document.getElementById('home-alert-posts-action');

            if (editorialCountEl) editorialCountEl.textContent = String(pendingCalendarsCount || 0);
            if (editorialEl) editorialEl.classList.toggle('hidden', !(pendingCalendarsCount > 0));
            if (editorialAction) editorialAction.onclick = () => global.ClientCore?.openPendingEditorialCalendar?.();

            if (postsCountEl) postsCountEl.textContent = String(pendingPostsWithMediaCount || 0);
            if (postsEl) postsEl.classList.toggle('hidden', !(pendingPostsWithMediaCount > 0));
            if (postsAction) postsAction.onclick = () => this.switchView('approvals');
        },

        renderClientCalendar: function(posts, monthKey) {
            const monthEl = document.getElementById('client-calendar-month');
            const gridEl = document.getElementById('client-calendar-grid');
            const loadingEl = document.getElementById('client-calendar-loading');
            const emptyEl = document.getElementById('client-calendar-empty');
            if (!gridEl) return;

            if (loadingEl) loadingEl.classList.add('hidden');

            const monthLabel = global.MonthUtils?.formatMonthLabel
                ? global.MonthUtils.formatMonthLabel(monthKey)
                : String(monthKey || '');
            if (monthEl) monthEl.textContent = monthLabel;
            const parsed = global.MonthUtils?.parseMonthKey ? global.MonthUtils.parseMonthKey(monthKey) : null;
            const ref = parsed ? new Date(parsed.year, parsed.monthIndex, 1) : new Date();
            const items = (posts || []).filter((p) => {
                const raw = p?.data_agendada || p?.data_postagem || p?.post_date || p?.date || '';
                const dateStr = String(raw).slice(0, 10);
                return dateStr && dateStr.slice(0, 7) === monthKey;
            });

            gridEl.innerHTML = '';
            if (!items.length) {
                if (emptyEl) emptyEl.classList.remove('hidden');
                return;
            }
            if (emptyEl) emptyEl.classList.add('hidden');

            const firstDay = new Date(ref.getFullYear(), ref.getMonth(), 1);
            const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
            const startWeekday = (firstDay.getDay() + 6) % 7;
            const daysInMonth = lastDay.getDate();

            const weekdayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
            weekdayNames.forEach((name) => {
                const header = document.createElement('div');
                header.className = 'text-[11px] font-semibold text-slate-400 px-2';
                header.textContent = name;
                gridEl.appendChild(header);
            });

            for (let i = 0; i < startWeekday; i += 1) {
                const blank = document.createElement('div');
                blank.className = 'min-h-[92px] rounded-xl border border-transparent';
                gridEl.appendChild(blank);
            }

            for (let day = 1; day <= daysInMonth; day += 1) {
                const date = new Date(ref.getFullYear(), ref.getMonth(), day);
                const dateKey = global.MonthUtils?.formatLocalDate
                    ? global.MonthUtils.formatLocalDate(date)
                    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const dayPosts = items.filter((p) => {
                    const raw = p?.data_agendada || p?.data_postagem || p?.post_date || p?.date || '';
                    return String(raw).slice(0, 10) === dateKey;
                });

                const cell = document.createElement('div');
                cell.className = 'min-h-[92px] rounded-2xl border border-slate-200 bg-white p-2';
                cell.innerHTML = `<div class="text-[11px] font-semibold text-slate-500">${day}</div>`;

                const list = document.createElement('div');
                list.className = 'mt-2 flex flex-col gap-2';
                dayPosts.forEach((p) => {
                    const title = p.tema || p.titulo || p.title || 'Post';
                    const status = String(p.status || '').toLowerCase();
                    const statusLabel = status ? status.replace(/_/g, ' ') : '-';
                    const formatRaw = String(p.formato || p.content_type || p.tipo || '').toLowerCase();
                    const typeBorder = (formatRaw.includes('carrossel'))
                        ? 'border-l-4 border-l-violet-500'
                        : ((formatRaw.includes('reels') || formatRaw.includes('video') || formatRaw.includes('vídeo'))
                            ? 'border-l-4 border-l-pink-500'
                            : ((formatRaw.includes('story') || formatRaw.includes('stories'))
                                ? 'border-l-4 border-l-orange-500'
                                : 'border-l-4 border-l-sky-500'));

                    const card = document.createElement('button');
                    card.type = 'button';
                    card.className = `text-left px-2 py-2 rounded-xl border border-slate-200 bg-white hover:shadow-sm hover:border-slate-300 transition ${typeBorder}`;
                    card.innerHTML = `
                        <p class="text-xs font-semibold text-slate-800 truncate">${title}</p>
                        <div class="mt-2 flex items-center justify-between gap-2">
                            <span class="text-[10px] text-slate-500 truncate">${p.plataforma || p.platform || '-'}</span>
                            <span class="text-[10px] uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${statusLabel}</span>
                        </div>
                    `;
                    card.addEventListener('click', () => global.ClientCore?.openPostModal?.(p, { readOnly: true }));
                    list.appendChild(card);
                });

                cell.appendChild(list);
                gridEl.appendChild(cell);
            }
        },

        renderHistoryList: function(posts) {
            const listEl = document.getElementById('client-history-list');
            const loadingEl = document.getElementById('client-history-loading');
            const emptyEl = document.getElementById('client-history-empty');
            if (loadingEl) loadingEl.classList.add('hidden');
            if (!listEl) return;
            if (!posts || !posts.length) {
                listEl.innerHTML = '';
                if (emptyEl) emptyEl.classList.remove('hidden');
                return;
            }
            if (emptyEl) emptyEl.classList.add('hidden');
            listEl.innerHTML = '';
            posts.forEach((p) => {
                const title = p.tema || p.titulo || p.title || 'Post';
                const dateRaw = p.data_agendada || p.data_postagem || '';
                const dateLabel = dateRaw ? new Date(dateRaw).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-';
                const status = String(p.status || '').toLowerCase();
                const statusLabel = status ? status.replace(/_/g, ' ') : '-';
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'ui-card p-4 text-left border border-slate-200 bg-white hover:shadow-sm hover:border-slate-300 transition';
                item.innerHTML = `
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-sm font-semibold text-slate-900 truncate">${title}</p>
                            <p class="mt-1 text-xs text-slate-500 truncate">${p.plataforma || p.platform || '-'} • ${dateLabel}</p>
                        </div>
                        <span class="ui-pill bg-slate-100 text-slate-600 border border-slate-200">${statusLabel}</span>
                    </div>
                `;
                item.addEventListener('click', () => global.ClientCore?.openPostModal?.(p, { readOnly: true }));
                listEl.appendChild(item);
            });
        },

        setDashboardMetrics: function(data) {
            const monthEl = document.getElementById('home-month-label');
            const awaitingEl = document.getElementById('home-count-awaiting');
            const approvedEl = document.getElementById('home-count-approved');
            const publishedEl = document.getElementById('home-count-published');
            const nextTitleEl = document.getElementById('home-next-title');
            const nextMetaEl = document.getElementById('home-next-meta');
            const nextStatusEl = document.getElementById('home-next-status');

            if (monthEl) monthEl.textContent = data?.monthLabel || '-';
            if (awaitingEl) awaitingEl.textContent = String(data?.awaitingApproval || 0);
            if (approvedEl) approvedEl.textContent = String(data?.approved || 0);
            if (publishedEl) publishedEl.textContent = String(data?.published || 0);

            if (nextTitleEl) nextTitleEl.textContent = data?.nextPost?.title || '-';
            if (nextMetaEl) nextMetaEl.textContent = data?.nextPost?.meta || '-';
            if (nextStatusEl) nextStatusEl.textContent = data?.nextPost?.statusLabel || '-';
        }
    };

    global.ClientUI = ClientUI;

})(window);
