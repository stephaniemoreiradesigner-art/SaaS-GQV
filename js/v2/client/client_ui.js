// js/v2/client/client_ui.js
// Interface do Portal do Cliente V2

(function(global) {
    const ClientUI = {
        views: ['home', 'calendar', 'approvals', 'history', 'metrics'],
        metricsChart: null,
        _activeEditorialAdjustmentEntry: null,

        getStatusDisplay: function(rawStatus) {
            const key = global.GQV_CONSTANTS?.getSocialStatusKey
                ? global.GQV_CONSTANTS.getSocialStatusKey(rawStatus)
                : String(rawStatus || '').trim().toLowerCase();
            const baseCls = 'bg-slate-100 text-slate-700 border border-slate-200';
            const meta = global.GQV_STATUS_MAP?.getPostStatusMeta ? global.GQV_STATUS_MAP.getPostStatusMeta(key) : null;
            const cls = meta?.color?.pillBorder || baseCls;
            const label = meta?.label
                || (global.GQV_CONSTANTS?.getSocialCalendarStatusLabelPt && (key === 'sent_for_approval' || key === 'needs_changes')
                    ? global.GQV_CONSTANTS.getSocialCalendarStatusLabelPt(key)
                    : (global.GQV_CONSTANTS?.getSocialStatusLabelPt ? global.GQV_CONSTANTS.getSocialStatusLabelPt(key) : (key ? key.replace(/_/g, ' ') : '-')));
            return { label, cls };
        },

        setEditorialAdjustFeedback: function(message, type = 'success') {
            const el = document.getElementById('client-editorial-adjust-feedback');
            if (!el) return;
            el.textContent = String(message || '');
            el.className = `text-sm rounded-lg px-3 py-2 ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`;
            el.classList.remove('hidden');
        },

        showEditorialAdjustModal: function(show, entry = null) {
            const modal = document.getElementById('client-editorial-adjust-modal');
            if (!modal) return;
            if (!show) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                this._activeEditorialAdjustmentEntry = null;
                return;
            }

            const calId = entry?.calendarId || (global.ClientCore?.activeCalendarId || null);
            const enriched = { ...(entry || {}), calendarId: calId };
            this._activeEditorialAdjustmentEntry = enriched;
            const metaEl = document.getElementById('client-editorial-adjust-meta');
            const themeEl = document.getElementById('client-editorial-adjust-theme');
            const copyEl = document.getElementById('client-editorial-adjust-copy');
            const textEl = document.getElementById('client-editorial-adjust-text');
            const feedbackEl = document.getElementById('client-editorial-adjust-feedback');
            if (feedbackEl) feedbackEl.classList.add('hidden');

            const date = String(enriched?.scheduledDate || '').slice(0, 10);
            const meta = [date, enriched?.canal || null, enriched?.tipo || null].filter(Boolean).join(' • ');
            if (metaEl) metaEl.textContent = meta;
            if (themeEl) themeEl.value = String(enriched?.tema || '').trim();
            if (copyEl) copyEl.value = String(enriched?.copy || '').trim();
            if (textEl) textEl.value = '';

            modal.classList.remove('hidden');
            modal.classList.add('flex');
        },

        init: function() {
            this.setupNavigation();
            this.setupMobileMenu();
            this.setupLogout();
            this.setupApprovalsTabs();
            this.setupCalendarNavigation();
            this.setupEditorialAdjustModal();
            this.setupHomeActions();
            this.switchView('home');
        },

        setupEditorialAdjustModal: function() {
            const closeBtn = document.getElementById('client-editorial-adjust-close');
            const cancelBtn = document.getElementById('client-editorial-adjust-cancel');
            const confirmBtn = document.getElementById('client-editorial-adjust-confirm');
            const modal = document.getElementById('client-editorial-adjust-modal');
            if (closeBtn) closeBtn.addEventListener('click', () => this.showEditorialAdjustModal(false));
            if (cancelBtn) cancelBtn.addEventListener('click', () => this.showEditorialAdjustModal(false));
            if (modal) {
                modal.addEventListener('click', (event) => {
                    if (event.target === modal) this.showEditorialAdjustModal(false);
                });
            }
            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    if (confirmBtn.disabled) return;
                    if (this._editorialAdjustInflight === true) return;
                    const entry = this._activeEditorialAdjustmentEntry;
                    const themeEl = document.getElementById('client-editorial-adjust-theme');
                    const copyEl = document.getElementById('client-editorial-adjust-copy');
                    const textEl = document.getElementById('client-editorial-adjust-text');
                    const tema = themeEl ? String(themeEl.value || '').trim() : '';
                    const copy = copyEl ? String(copyEl.value || '').trim() : '';
                    const adjustmentText = textEl ? String(textEl.value || '').trim() : '';
                    if (!adjustmentText) {
                        console.log('[EditorialReview] missing adjustment text:', { entryKey: entry?.key || null });
                        this.setEditorialAdjustFeedback('Descreva o ajuste solicitado para continuar.', 'error');
                        return;
                    }
                    this._editorialAdjustInflight = true;
                    const original = confirmBtn.innerHTML;
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...';
                    try {
                        await global.ClientCore?.submitEditorialAdjustment?.(entry, { tema, copy, adjustmentText });
                    } finally {
                        this._editorialAdjustInflight = false;
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = original;
                    }
                });
            }
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
                const value = this.getStatusDisplay(status).label;
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
                const monthKey = global.CalendarStateSelectors?.getMonthKeyFromMonthRef
                    ? global.CalendarStateSelectors.getMonthKeyFromMonthRef(cal.mes_referencia)
                    : '';
                const parsed = global.MonthUtils?.parseMonthKey ? global.MonthUtils.parseMonthKey(monthKey) : null;
                const date = parsed ? new Date(parsed.year, parsed.monthIndex, 1) : new Date(String(cal.mes_referencia || ''));
                const monthName = date instanceof Date && !Number.isNaN(date.getTime())
                    ? date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
                    : (global.MonthUtils?.formatMonthLabel && monthKey ? global.MonthUtils.formatMonthLabel(monthKey) : (monthKey || 'Mês'));
                const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                const rawStatus = String(cal.status || '').trim().toLowerCase();
                const statusInfo = this.getStatusDisplay(rawStatus);

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

        renderCalendarPostsInModal: function(entries, options = null) {
            const container = document.getElementById('client-calendar-posts-list');
            const loading = document.getElementById('client-calendar-posts-loading');
            const empty = document.getElementById('client-calendar-posts-empty');
            const commentEl = document.getElementById('client-calendar-approval-comment');
            const source = String(options?.source || '').trim() || 'unknown';

            if (loading) loading.classList.add('hidden');
            if (!container) return;
            
            container.innerHTML = '';

            const list = Array.isArray(entries) ? entries : [];
            console.log('[ClientCalendar] itens renderizados no modal:', { source, count: list.length });

            if (!list.length) {
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');

            const ui = this;
            list.forEach((entry) => {
                const statusInfo = this.getStatusDisplay(entry?.status);
                const dateRaw = entry?.scheduledDate || '';
                const date = dateRaw ? new Date(String(dateRaw).slice(0, 10)).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : 'Sem data';
                const tema = entry?.tema || 'Sem título';
                const tipo = entry?.tipo || 'post_estatico';
                const canal = entry?.canal || '-';
                const detailText = String(entry?.copy || '').trim();
                const detailId = `cal-item-detail-${String(entry?.key || Math.random()).replace(/[^\w-]/g, '')}`;

                const el = document.createElement('div');
                el.className = 'bg-white border border-slate-200 rounded-xl p-4';
                el.innerHTML = `
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-xs text-slate-500">${date} • ${canal}</p>
                            <p class="mt-1 text-sm font-semibold text-slate-900" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${tema}</p>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <span class="text-[10px] uppercase px-2 py-0.5 rounded-full ${statusInfo.cls}">${statusInfo.label}</span>
                            <span class="text-[10px] uppercase px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 border border-slate-200">${tipo}</span>
                        </div>
                    </div>
                    <div class="mt-3 flex items-center justify-end gap-2">
                        <button type="button" data-cal-item-action="approve-item" class="ui-btn ui-btn-secondary">Aprovar item</button>
                        <button type="button" data-cal-item-action="request-changes" class="ui-btn ui-btn-secondary">Solicitar ajuste</button>
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
                el.addEventListener('click', (event) => {
                    const target = event?.target;
                    const tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
                    if (tag === 'BUTTON') return;
                    if (detailEl) detailEl.classList.toggle('hidden');
                });
                const requestBtn = el.querySelector('[data-cal-item-action="request-changes"]');
                if (requestBtn) {
                    requestBtn.addEventListener('click', () => {
                        ui.showEditorialAdjustModal(true, entry);
                    });
                }
                const approveItemBtn = el.querySelector('[data-cal-item-action="approve-item"]');
                if (approveItemBtn) {
                    approveItemBtn.addEventListener('click', () => {
                        const comment = commentEl ? String(commentEl.value || '').trim() : '';
                        global.ClientCore?.approveCalendarEntry?.(entry, comment);
                    });
                }
                container.appendChild(el);
            });
        },

        buildDerivedTimeline: function(post) {
            const events = [];
            const status = String(post?.status || '').trim().toLowerCase();
            const comment = String(
                post?.comentario_cliente || post?.comentarioCliente ||
                post?.feedback_ajuste || post?.feedbackAjuste || ''
            ).trim();

            events.push({ action: 'Post criado', dot: 'bg-slate-400', description: '' });

            const wasResubmitted = !!(comment && ['ready_for_approval', 'awaiting_approval'].includes(status));
            if (wasResubmitted) {
                events.push({ action: 'Enviado para aprova\u00e7\u00e3o', dot: 'bg-blue-400', description: '' });
                events.push({ action: 'Ajuste solicitado pelo cliente', dot: 'bg-amber-500', description: comment });
                events.push({ action: 'M\u00eddia revisada e reenviada', dot: 'bg-indigo-500', description: '' });
            } else if (comment) {
                events.push({ action: 'Enviado para aprova\u00e7\u00e3o', dot: 'bg-blue-400', description: '' });
                events.push({ action: 'Ajuste solicitado pelo cliente', dot: 'bg-amber-500', description: comment });
            } else {
                events.push({ action: 'Enviado para aprova\u00e7\u00e3o', dot: 'bg-blue-400', description: '' });
            }

            if (['approved', 'aprovado'].includes(status)) {
                events.push({ action: 'Aprovado', dot: 'bg-emerald-500', description: '' });
            } else if (['scheduled', 'agendado'].includes(status)) {
                events.push({ action: 'Aprovado', dot: 'bg-emerald-500', description: '' });
                events.push({ action: 'Agendado para publica\u00e7\u00e3o', dot: 'bg-purple-500', description: '' });
            } else if (['published', 'publicado'].includes(status)) {
                events.push({ action: 'Aprovado', dot: 'bg-emerald-500', description: '' });
                events.push({ action: 'Publicado', dot: 'bg-teal-500', description: '' });
            }

            return events;
        },

        /**
         * Converte evento de social_approvals para formato de exibição
         */
        _normalizeAuditEventForTimeline: function(ev) {
            const decision = String(ev?.decision || ev?.action_type || '').toLowerCase();
            const explicitLabel = String(ev?.event_label || '').trim();
            const labelMap = {
                created: 'Post criado',
                resubmitted: 'Reenviado para aprovação',
                submitted: 'Enviado para aprovação',
                approved: 'Aprovado',
                changes_requested: 'Ajuste solicitado',
                needs_revision: 'Ajuste solicitado',
                rejected: 'Reprovado',
                in_review: 'Em produção',
                returned_to_draft: 'Devolvido para rascunho',
                scheduled: 'Agendado para publicação',
                published: 'Publicado',
                date_moved: 'Data reagendada',
                editorial_approved: 'Tema aprovado — produção iniciada',
                status_change: 'Status alterado'
            };
            const dotMap = {
                created: 'bg-slate-400',
                resubmitted: 'bg-blue-400',
                submitted: 'bg-blue-400',
                approved: 'bg-emerald-500',
                changes_requested: 'bg-amber-500',
                needs_revision: 'bg-amber-500',
                rejected: 'bg-red-500',
                in_review: 'bg-indigo-400',
                returned_to_draft: 'bg-slate-300',
                scheduled: 'bg-purple-500',
                published: 'bg-teal-500',
                editorial_approved: 'bg-emerald-400',
                date_moved: 'bg-sky-400',
                status_change: 'bg-slate-300'
            };
            return {
                action: explicitLabel || labelMap[decision] || decision || 'Evento',
                dot: dotMap[decision] || 'bg-slate-300',
                description: String(ev?.comment || '').trim()
            };
        },

        /**
         * Busca eventos reais e re-renderiza a timeline (fire-and-forget)
         */
        _refreshTimelineFromDB: async function(post) {
            if (!post?.id) return;
            try {
                const events = await global.ClientCore?.getPostAuditEvents?.(post.id);
                if (!Array.isArray(events) || !events.length) return;
                const mapped = events.map((ev) => this._normalizeAuditEventForTimeline(ev));
                this.renderClientPostTimeline(post, mapped);
            } catch (err) {
                console.warn('[ClientUI] _refreshTimelineFromDB error:', err);
            }
        },

        renderClientPostTimeline: function(post, events) {
            const modal = document.getElementById('client-post-modal');
            if (!modal) return;

            let timelineEl = document.getElementById('client-post-modal-timeline');
            if (!timelineEl) {
                timelineEl = document.createElement('div');
                timelineEl.id = 'client-post-modal-timeline';
                const feedbackArea = document.getElementById('client-post-modal-feedback-area');
                if (feedbackArea && feedbackArea.parentNode) {
                    feedbackArea.parentNode.insertBefore(timelineEl, feedbackArea);
                }
            }

            const eventsToRender = Array.isArray(events) ? events : [];
            if (!eventsToRender.length) {
                timelineEl.className = 'space-y-2';
                timelineEl.innerHTML = '<div class="text-xs text-slate-400">Sem histórico registrado ainda.</div>';
                return;
            }

            timelineEl.className = 'space-y-2';

            const heading = document.createElement('label');
            heading.className = 'block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2';
            heading.textContent = 'Trajeto do conte\u00fado';

            const inner = document.createElement('div');
            inner.className = 'space-y-1 bg-slate-50 rounded-lg border border-slate-100 p-3';

            eventsToRender.forEach((ev, idx) => {
                const isLast = idx === eventsToRender.length - 1;
                const row = document.createElement('div');
                row.className = 'flex items-start gap-2';

                const rail = document.createElement('div');
                rail.className = 'flex flex-col items-center flex-shrink-0';
                const dot = document.createElement('div');
                dot.className = `w-2 h-2 rounded-full ${ev.dot} mt-1.5`;
                rail.appendChild(dot);
                if (!isLast) {
                    const line = document.createElement('div');
                    line.className = 'w-px flex-1 bg-slate-200 mt-0.5 min-h-[14px]';
                    rail.appendChild(line);
                }

                const content = document.createElement('div');
                content.className = 'pb-1';
                const label = document.createElement('p');
                label.className = `text-xs font-semibold ${isLast ? 'text-slate-800' : 'text-slate-500'}`;
                label.textContent = ev.action;
                content.appendChild(label);
                if (ev.description) {
                    const desc = document.createElement('p');
                    desc.className = 'text-[11px] text-slate-400 italic mt-0.5';
                    desc.textContent = '\u201c' + ev.description + '\u201d';
                    content.appendChild(desc);
                }

                row.appendChild(rail);
                row.appendChild(content);
                inner.appendChild(row);
            });

            timelineEl.innerHTML = '';
            timelineEl.appendChild(heading);
            timelineEl.appendChild(inner);
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
                const meta = global.GQV_STATUS_MAP?.getPostStatusMeta ? global.GQV_STATUS_MAP.getPostStatusMeta(postData.status) : null;
                statusEl.textContent = meta?.label || postData.status;
                
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

                this.renderClientPostTimeline(postData);
                // Fire-and-forget: atualiza com dados reais do banco após renderização inicial
                this._refreshTimelineFromDB(postData);

                modal.classList.remove('hidden');
                modal.classList.add('flex');
            } else {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
            }
        },

        renderPendingPostsList: function(posts, editorialItems) {
            const container = document.getElementById('client-approvals-list');
            const empty = document.getElementById('client-approvals-empty');
            const loading = document.getElementById('posts-loading');

            if (loading) loading.classList.add('hidden');
            if (!container) return;
            container.innerHTML = '';

            const editorial = Array.isArray(editorialItems) ? editorialItems : [];
            const allEmpty = (!posts || posts.length === 0) && editorial.length === 0;

            if (allEmpty) {
                if (empty) empty.classList.remove('hidden');
                return;
            }
            if (empty) empty.classList.add('hidden');

            // Seção: Aprovação Editorial (calendário de conteúdo)
            if (editorial.length > 0) {
                const editorialHeader = document.createElement('div');
                editorialHeader.className = 'flex items-center gap-3 mb-3';
                editorialHeader.innerHTML = `
                    <span class="text-xs font-semibold uppercase tracking-widest text-emerald-600">Aprovação Editorial</span>
                    <span class="flex-1 h-px bg-emerald-100"></span>
                    <span class="text-[10px] text-emerald-500 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">Planejamento de conteúdo</span>
                `;
                container.appendChild(editorialHeader);
            }

            // Itens editoriais revisados pela agência
            editorial.forEach((item) => {
                const date = item.data ? new Date(item.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem data';
                const tema = item.tema || 'Item editorial';
                const canal = item.canal || '-';
                const prevComment = item.comentario_cliente
                    ? `<p class="mt-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2"><strong>Seu comentário anterior:</strong> ${item.comentario_cliente}</p>`
                    : '';

                const el = document.createElement('div');
                el.className = 'ui-card p-5 border border-emerald-200 bg-emerald-50 hover:shadow-md transition';
                const isMediaAdjustment = !!item.comentario_cliente;
                el.innerHTML = `
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs uppercase tracking-widest text-emerald-600 font-semibold">${isMediaAdjustment ? 'Mídia revisada — tema editorial aprovado mantido' : 'Aguardando aprovação editorial'}</p>
                            <h3 class="mt-1 text-base font-semibold text-slate-900" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${tema}</h3>
                            <p class="mt-1 text-xs text-slate-500">${canal} • ${date}</p>
                            ${isMediaAdjustment ? '<p class="mt-1 text-[11px] text-slate-400 italic">Apenas a mídia foi ajustada. O tema aprovado foi mantido.</p>' : ''}
                            ${prevComment}
                        </div>
                        <span class="ui-pill ${isMediaAdjustment ? 'bg-indigo-100 text-indigo-700 border border-indigo-100' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'} shrink-0">${isMediaAdjustment ? 'Mídia revisada' : 'Revisado'}</span>
                    </div>
                    <div class="mt-4 flex flex-col sm:flex-row gap-2">
                        <button type="button" class="ui-btn ui-btn-primary btn-approve-editorial">Aprovar</button>
                        <button type="button" class="ui-btn ui-btn-secondary btn-request-changes-editorial">Solicitar ajustes</button>
                    </div>
                    <div class="mt-3 hidden editorial-changes-form">
                        <textarea class="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-fuchsia-400" rows="3" placeholder="Descreva o ajuste necessário..."></textarea>
                        <div class="mt-2 flex gap-2">
                            <button type="button" class="ui-btn ui-btn-primary btn-submit-changes">Enviar ajuste</button>
                            <button type="button" class="ui-btn ui-btn-secondary btn-cancel-changes">Cancelar</button>
                        </div>
                        <p class="editorial-feedback mt-2 hidden text-sm rounded-lg px-3 py-2"></p>
                    </div>
                    <p class="editorial-feedback mt-2 hidden text-sm rounded-lg px-3 py-2"></p>
                `;

                const approveBtn = el.querySelector('.btn-approve-editorial');
                const requestBtn = el.querySelector('.btn-request-changes-editorial');
                const changesForm = el.querySelector('.editorial-changes-form');
                const textarea = el.querySelector('textarea');
                const submitBtn = el.querySelector('.btn-submit-changes');
                const cancelBtn = el.querySelector('.btn-cancel-changes');
                const feedbacks = el.querySelectorAll('.editorial-feedback');

                const showFeedback = (msg, type) => {
                    feedbacks.forEach((f) => {
                        f.textContent = msg;
                        f.className = `editorial-feedback mt-2 text-sm rounded-lg px-3 py-2 ${type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-100 text-emerald-700'}`;
                    });
                };

                if (approveBtn) {
                    approveBtn.addEventListener('click', async () => {
                        approveBtn.disabled = true;
                        approveBtn.textContent = 'Aprovando...';
                        const result = await global.ClientCore?.approveCalendarItemFromApprovals?.(item.id, item.calendar_id);
                        if (result?.ok !== true) {
                            showFeedback('Não foi possível aprovar. Tente novamente.', 'error');
                            approveBtn.disabled = false;
                            approveBtn.textContent = 'Aprovar';
                        }
                    });
                }

                if (requestBtn) {
                    requestBtn.addEventListener('click', () => {
                        changesForm?.classList.toggle('hidden');
                        textarea?.focus();
                    });
                }

                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => {
                        changesForm?.classList.add('hidden');
                        if (textarea) textarea.value = '';
                    });
                }

                if (submitBtn) {
                    submitBtn.addEventListener('click', async () => {
                        const comment = String(textarea?.value || '').trim();
                        if (!comment) { textarea?.focus(); return; }
                        submitBtn.disabled = true;
                        submitBtn.textContent = 'Enviando...';
                        const result = await global.ClientCore?.requestCalendarItemAdjustmentFromApprovals?.(item.id, item.calendar_id, comment);
                        if (result?.ok !== true) {
                            showFeedback('Não foi possível enviar. Tente novamente.', 'error');
                            submitBtn.disabled = false;
                            submitBtn.textContent = 'Enviar ajuste';
                        }
                    });
                }

                container.appendChild(el);
            });

            if (!posts || posts.length === 0) return;

            // Seção: Aprovação de Mídia (posts de produção)
            const mediaHeader = document.createElement('div');
            mediaHeader.className = 'flex items-center gap-3 mb-3 mt-6';
            mediaHeader.innerHTML = `
                <span class="text-xs font-semibold uppercase tracking-widest text-indigo-600">Aprovação de Mídia</span>
                <span class="flex-1 h-px bg-indigo-100"></span>
                <span class="text-[10px] text-indigo-500 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">Conteúdo produzido — aprovação final</span>
            `;
            container.appendChild(mediaHeader);

            posts.forEach(post => {
                const dateRaw = post.data_agendada || null;
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
                const isResubmission = !!(post.comentario_cliente || post.comentarioCliente || post.feedback_ajuste);

                let mediaHtml = this.getMediaHtml(post, 'w-full md:w-40 h-48 md:h-28');

                el.innerHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-4 items-start">
                        <div class="min-w-0">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="text-xs uppercase tracking-widest ${isResubmission ? 'text-indigo-500' : 'text-slate-400'}">${isResubmission ? 'Mídia ajustada — aguardando sua aprovação' : 'Aguardando sua aprovação'}</p>
                                    <h3 class="mt-1 text-base font-semibold text-slate-900" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${title}</h3>
                                    <p class="mt-1 text-xs text-slate-500 truncate">${platform} • ${date}</p>
                                    ${isResubmission ? '<p class="mt-1 text-[11px] text-slate-400 italic">O tema foi mantido. Apenas a mídia foi revisada.</p>' : ''}
                                </div>
                                <span class="ui-pill ${isResubmission ? 'bg-indigo-100 text-indigo-700 border border-indigo-100' : 'bg-amber-100 text-amber-700 border border-amber-100'}">${isResubmission ? 'Mídia revisada' : 'Pendente'}</span>
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
                const raw = p?.data_agendada || '';
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
                    const raw = p?.data_agendada || '';
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
                    const statusLabel = this.getStatusDisplay(status).label;
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
                    card.addEventListener('click', () => {
                        if (p && p.__fromCalendarItem) return;
                        global.ClientCore?.openPostModal?.(p, { readOnly: true });
                    });
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
                const dateRaw = p.data_agendada || '';
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
