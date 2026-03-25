// js/v2/client/client_core.js
// Núcleo do Portal do Cliente V2

(function(global) {
    const ClientCore = {
        currentClient: null,
        activeCalendarId: null,
        activePostId: null,
        clientProfile: null,
        _initStarted: false,
        _pendingEditorialCalendars: [],
        editorialPendingCalendar: null,
        activeEditorialMonthKey: null,
        _calendarManagerUnsub: null,
        _editorialReviewByCalendarId: {},
        getClientId: function() {
            const c = this.currentClient || null;
            if (!c) return null;
            const direct = c.clientId ?? null;
            if (direct) return direct;
            const legacy = c['client' + '_id'] ?? null;
            return legacy || null;
        },

        getTenantId: function() {
            const c = this.currentClient || null;
            if (!c) return null;
            return c.tenantId ?? c.tenant_id ?? global.TenantContext?.getTenantUuid?.() ?? null;
        },

        init: async function() {
            if (this._initStarted) return;
            this._initStarted = true;
            // 1. Check Auth & Init Supabase Isolated
            if (!global.ClientAuth) {
                console.error('[ClientCore] Auth module missing');
                return;
            }

            // [ISOLATION] Ensure isolated client is ready
            await global.ClientAuth.init();
            const ensured = global.ClientAuth.ensurePortalSession
                ? await global.ClientAuth.ensurePortalSession()
                : { ok: false, reason: 'ensure_missing' };

            if (!ensured.ok) {
                if (ensured.reason === 'no_auth_session') {
                    window.location.href = '/v2/client/login.html';
                    return;
                }
                try {
                    if (global.clientPortalSupabase) {
                        await global.clientPortalSupabase.auth.signOut();
                    }
                } catch {}
                localStorage.removeItem(global.ClientAuth.sessionKey || 'V2_CLIENT_SESSION');
                window.location.href = `/v2/client/login.html?error=${encodeURIComponent(ensured.reason || 'client_context_error')}`;
                return;
            }

            const legacyClientId = ensured.session ? ensured.session['client' + '_id'] : null;
            this.currentClient = {
                ...ensured.session,
                clientId: ensured.session?.clientId ?? legacyClientId ?? null,
                tenantId: ensured.session?.tenantId ?? ensured.session?.tenant_id ?? null
            };

            try {
                if (!global.supabaseClient && global.clientPortalSupabase) {
                    global.supabaseClient = global.clientPortalSupabase;
                }
            } catch {}

            try {
                await global.TenantContext?.init?.();
            } catch {}

            try {
                await global.ClientContext?.init?.();
                const clientId = this.getClientId();
                const clientName = this.currentClient?.name || null;
                if (clientId) global.ClientContext?.setActiveClient?.({ id: clientId, name: clientName });
            } catch {}

            await this.loadClientProfile();

            // 2. Init UI
            if (global.ClientUI) {
                global.ClientUI.init();
                global.ClientUI.updateUserInfo(this.currentClient);
                global.ClientUI.setDashboardHeader({
                    clientId: this.getClientId(),
                    tenantId: this.getTenantId(),
                    status: this.currentClient?.status || this.clientProfile?.status || null
                });
                global.ClientUI.switchView('home'); // Default view
            }

            this.initCalendarStateManager();

            // 3. Load Initial Data
            await this.loadDashboardData();
        },

        initCalendarStateManager: function() {
            const manager = global.CalendarStateManager;
            if (!manager?.init || !global.ClientRepo?.getPostsByDateRange) return;

            const clientId = this.getClientId();
            const tenantId = this.getTenantId();
            if (!clientId) return;

            manager.init({
                clientId,
                tenantId,
                loadInitialMonthKey: ({ clientId: id }) => {
                    const stored = localStorage.getItem(`GQV_CLIENT_MONTH_${String(id || '').trim()}`);
                    const key = String(stored || '').trim();
                    return global.MonthUtils?.isValidMonthKey?.(key) ? key : '';
                },
                persistMonthKey: ({ clientId: id, monthKey }) => {
                    if (!id || !monthKey) return;
                    localStorage.setItem(`GQV_CLIENT_MONTH_${String(id).trim()}`, String(monthKey).trim());
                },
                fetchCalendarMeta: async ({ clientId: id, monthKey }) => {
                    if (!global.ClientRepo?.getCalendarByMonthKey) return null;
                    return await global.ClientRepo.getCalendarByMonthKey(id, monthKey);
                },
                fetchEditorialItems: async ({ clientId: id, activeCalendarId }) => {
                    if (!global.ClientRepo?.getCalendarItems) return [];
                    return await global.ClientRepo.getCalendarItems(activeCalendarId, id);
                },
                fetchMonthPosts: async ({ clientId: id, startDate, endDateExclusive }) => {
                    return await global.ClientRepo.getPostsByDateRange(id, startDate, endDateExclusive);
                }
            });

            if (!this._calendarManagerUnsub && manager.subscribe) {
                this._calendarManagerUnsub = manager.subscribe((snap) => {
                    const view = document.getElementById('view-calendar');
                    const shouldRender = view && !view.classList.contains('hidden');
                    if (!shouldRender) return;
                    if (global.ClientUI?.renderClientCalendar) {
                        const monthKey = String(snap.monthKey || '').trim();
                        const monthPosts = Array.isArray(snap.monthPosts) ? snap.monthPosts : [];
                        const editorialItems = Array.isArray(snap.editorialItems) ? snap.editorialItems : [];
                        const calendarStatus = String(snap.calendarStatus || '').trim() || 'draft';
                        if (!monthPosts.length && editorialItems.length) {
                            console.log('[ClientCalendar] fallback render from items:', { monthKey, calendarStatus, itemsCount: editorialItems.length });
                            const mapped = editorialItems.map((it) => ({
                                id: `item_${String(it?.id || Math.random()).replace(/[^\w-]/g, '')}`,
                                __fromCalendarItem: true,
                                data_agendada: String(it?.data || it?.data_agendada || it?.post_date || '').slice(0, 10),
                                tema: it?.tema || it?.titulo || it?.title || 'Item do calendário',
                                formato: it?.tipo_conteudo || it?.formato || 'post_estatico',
                                plataforma: it?.canal || it?.plataforma || it?.platform || 'instagram',
                                status: it?.status || 'draft'
                            })).filter((p) => !!p.data_agendada);
                            global.ClientUI.renderClientCalendar(mapped, monthKey);
                            return;
                        }
                        global.ClientUI.renderClientCalendar(monthPosts, monthKey);
                    }
                });
            }
        },

        onViewChanged: async function(viewName) {
            if (viewName === 'approvals') {
                await this.loadPendingPosts();
            } else if (viewName === 'calendar') {
                await this.loadCalendarMonth();
            } else if (viewName === 'history') {
                await this.loadHistory();
            } else if (viewName === 'home') {
                await this.loadDashboardData();
            } else if (viewName === 'metrics') {
                if (global.ClientUI?.initMetricsChart) global.ClientUI.initMetricsChart();
            }
        },

        loadClientProfile: async function() {
            if (!this.currentClient || !global.clientPortalSupabase) return null;
            const clientIdNum = Number(String(this.getClientId() || '').trim());
            if (!Number.isFinite(clientIdNum) || Number.isNaN(clientIdNum)) return null;

            try {
                const { data, error } = await global.clientPortalSupabase
                    .from('clientes')
                    .select('*')
                    .eq('id', clientIdNum)
                    .maybeSingle();
                if (error) return null;
                this.clientProfile = data || null;

                const tenantUuid = global.TenantContext?.getTenantUuid?.() || null;
                const clientTenant = data?.tenant_id ? String(data.tenant_id) : null;
                if (tenantUuid && clientTenant && tenantUuid !== clientTenant) {
                    await global.clientPortalSupabase.auth.signOut();
                    localStorage.removeItem(global.ClientAuth?.sessionKey || 'V2_CLIENT_SESSION');
                    window.location.href = '/v2/client/login.html?error=tenant_mismatch';
                    return null;
                }

                const clientName =
                    data?.nome_fantasia
                    || data?.nome
                    || data?.nome_empresa
                    || data?.razao_social
                    || this.currentClient.name
                    || 'Cliente';

                this.currentClient = {
                    ...this.currentClient,
                    name: clientName,
                    status: data?.status || this.currentClient.status || null,
                    tenant_id: clientTenant || this.currentClient.tenant_id || tenantUuid || null
                };

                return this.clientProfile;
            } catch {
                return null;
            }
        },

        loadDashboardData: async function() {
            if (!this.currentClient) return;
            const clientId = this.getClientId();
            
            const pendingCalendars = await global.ClientRepo.getPendingCalendars(clientId);
            this._pendingEditorialCalendars = Array.isArray(pendingCalendars) ? pendingCalendars : [];
            this.editorialPendingCalendar = this._pendingEditorialCalendars[0] || null;

            const pendingPosts = await global.ClientRepo.getPendingPosts(clientId);
            const pendingPostsWithMedia = (pendingPosts || []).filter((p) => {
                const mediaUrl = p?.imagem_url || p?.media_url || p?.mediaUrl || p?.imagemUrl || null;
                return !!String(mediaUrl || '').trim();
            });
            const now = new Date();
            const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            if (global.CalendarStateManager?.getState && global.CalendarStateManager?.refreshMonthData) {
                this.initCalendarStateManager();
            }
            const snap = global.CalendarStateManager?.getState ? global.CalendarStateManager.getState() : null;
            const monthKey = String(snap?.monthKey || '').trim();
            const monthRange = global.CalendarStateSelectors?.getMonthRange ? global.CalendarStateSelectors.getMonthRange(monthKey) : null;
            const postsInMonth = monthRange ? await global.ClientRepo.getPostsByDateRange(clientId, monthRange.startDate, monthRange.endDateExclusive) : [];
            const approvedCount = (postsInMonth || []).filter((p) => {
                const s = String(p?.status || '').toLowerCase();
                return ['approved', 'scheduled', 'aprovado', 'agendado'].includes(s);
            }).length;
            const publishedCount = (postsInMonth || []).filter((p) => {
                const s = String(p?.status || '').toLowerCase();
                return ['published', 'publicado'].includes(s);
            }).length;

            const fromDate = global.CalendarStateSelectors?.getTodayLocalDate ? global.CalendarStateSelectors.getTodayLocalDate() : '';
            const nextPost = await global.ClientRepo.getNextPost(clientId, fromDate);
            const nextTitle = nextPost?.tema || nextPost?.titulo || nextPost?.title || '-';
            const nextDateRaw = nextPost?.data_agendada || '';
            const nextDateLabel = nextDateRaw ? new Date(nextDateRaw).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-';
            const nextPlatform = nextPost?.plataforma || nextPost?.platform || nextPost?.canal || '-';
            const nextStatusRaw = String(nextPost?.status || '').toLowerCase();
            const nextStatusLabelMap = {
                draft: 'Rascunho',
                ready_for_review: 'Revisão',
                in_production: 'Revisão',
                changes_requested: 'Ajustes',
                ready_for_approval: 'Pendente',
                awaiting_approval: 'Pendente',
                approved: 'Aprovado',
                scheduled: 'Agendado',
                published: 'Publicado'
            };
            
            if (global.ClientUI) {
                global.ClientUI.setDashboardMetrics({ 
                    monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
                    awaitingApproval: pendingPostsWithMedia.length,
                    approved: approvedCount,
                    published: publishedCount,
                    nextPost: {
                        title: nextTitle,
                        meta: `${nextPlatform} • ${nextDateLabel}`,
                        statusLabel: nextStatusLabelMap[nextStatusRaw] || (nextStatusRaw ? nextStatusRaw.replace(/_/g, ' ') : '-')
                    }
                });
                global.ClientUI.setHomeApprovalAlerts?.({
                    pendingCalendarsCount: this._pendingEditorialCalendars.length,
                    pendingPostsWithMediaCount: pendingPostsWithMedia.length
                });
                global.ClientUI.setDashboardHeader({
                    clientId: this.getClientId(),
                    tenantId: this.getTenantId(),
                    status: this.currentClient?.status || this.clientProfile?.status || null
                });
            }
        },

        loadCalendars: async function() {
            if (!this.currentClient) return;
            const clientId = this.getClientId();
            
            const calendars = await (global.ClientRepo.getClientCalendars ? global.ClientRepo.getClientCalendars(clientId) : global.ClientRepo.getPendingCalendars(clientId));
            console.log('[ClientCalendar] calendarios carregados:', {
                clientId,
                count: Array.isArray(calendars) ? calendars.length : 0,
                ids: (Array.isArray(calendars) ? calendars : []).map((c) => c?.id).filter(Boolean)
            });
            
            if (global.ClientUI) {
                global.ClientUI.renderCalendarList(calendars);
            }
        },

        loadPendingPosts: async function() {
            if (!this.currentClient) return;
            const clientId = this.getClientId();
            const loading = document.getElementById('posts-loading');
            if (loading) loading.classList.remove('hidden');
            
            const posts = await global.ClientRepo.getPendingPosts(clientId);
            const filtered = (posts || []).filter((p) => {
                const mediaUrl = p?.imagem_url || p?.media_url || p?.mediaUrl || p?.imagemUrl || null;
                return !!String(mediaUrl || '').trim();
            });
            
            if (global.ClientUI) {
                global.ClientUI.renderPendingPostsList(filtered);
            }
        },

        openPendingEditorialCalendar: async function() {
            const first = this.editorialPendingCalendar || (Array.isArray(this._pendingEditorialCalendars) ? this._pendingEditorialCalendars[0] : null);
            if (!first?.id) {
                alert('Nenhum calendário editorial pendente.');
                return;
            }
            const monthKey = global.CalendarStateSelectors?.getMonthKeyFromMonthRef
                ? global.CalendarStateSelectors.getMonthKeyFromMonthRef(first.mes_referencia)
                : '';
            await this.openCalendarModal(first.id, monthKey, first.status || null);
        },

        loadCalendarMonth: async function() {
            if (!this.currentClient) return;
            const loading = document.getElementById('client-calendar-loading');
            if (loading) loading.classList.remove('hidden');
            const empty = document.getElementById('client-calendar-empty');
            if (empty) empty.classList.add('hidden');
            if (global.CalendarStateManager?.refreshMonthData) {
                await global.CalendarStateManager.refreshMonthData();
                const snap = global.CalendarStateManager.getState();
                const monthKey = String(snap?.monthKey || '').trim();
                const monthPosts = Array.isArray(snap?.monthPosts) ? snap.monthPosts : [];
                const editorialItems = Array.isArray(snap?.editorialItems) ? snap.editorialItems : [];
                const calendarStatus = String(snap?.calendarStatus || '').trim() || 'draft';
                if (!monthPosts.length && editorialItems.length) {
                    console.log('[ClientCalendar] fallback render from items:', { monthKey, calendarStatus, itemsCount: editorialItems.length });
                    const mapped = editorialItems.map((it) => ({
                        id: `item_${String(it?.id || Math.random()).replace(/[^\w-]/g, '')}`,
                        __fromCalendarItem: true,
                        data_agendada: String(it?.data || it?.data_agendada || it?.post_date || '').slice(0, 10),
                        tema: it?.tema || it?.titulo || it?.title || 'Item do calendário',
                        formato: it?.tipo_conteudo || it?.formato || 'post_estatico',
                        plataforma: it?.canal || it?.plataforma || it?.platform || 'instagram',
                        status: it?.status || 'draft'
                    })).filter((p) => !!p.data_agendada);
                    global.ClientUI?.renderClientCalendar?.(mapped, monthKey);
                    return;
                }
                global.ClientUI?.renderClientCalendar?.(monthPosts, monthKey);
                return;
            }
        },

        shiftCalendarMonth: async function(delta) {
            if (delta < 0 && global.CalendarStateManager?.prevMonth) {
                await global.CalendarStateManager.prevMonth();
                return;
            }
            if (delta > 0 && global.CalendarStateManager?.nextMonth) {
                await global.CalendarStateManager.nextMonth();
                return;
            }
            await this.loadCalendarMonth();
        },

        loadHistory: async function() {
            if (!this.currentClient) return;
            const loading = document.getElementById('client-history-loading');
            if (loading) loading.classList.remove('hidden');
            const empty = document.getElementById('client-history-empty');
            if (empty) empty.classList.add('hidden');
            const list = document.getElementById('client-history-list');
            if (list) list.innerHTML = '';

            const clientId = this.getClientId();
            const posts = await global.ClientRepo.getHistoryPosts(clientId, 60);
            global.ClientUI?.renderHistoryList?.(posts);
        },

        loadFiles: async function() {
            const loading = document.getElementById('files-loading');
            if (loading) loading.classList.remove('hidden');
            if (global.ClientUI?.renderFilesList) global.ClientUI.renderFilesList([]);
        },

        openPostModal: function(post, options = null) {
            this.activePostId = post?.id;
            console.log('[ClientCore] openPostModal:', { postId: this.activePostId, status: post?.status });
            
            // Show UI
            if(global.ClientUI) global.ClientUI.showPostModal(true, post, options);

            // Bind Actions
            const approveBtn = document.getElementById('client-post-modal-approve');
            const rejectBtn = document.getElementById('client-post-modal-reject');
            const closeBtn = document.getElementById('client-post-modal-close');

            const pendingStatuses = global.ClientRepo?.getPendingPostStatuses ? global.ClientRepo.getPendingPostStatuses() : [];
            const rawStatus = String(post?.status || '').trim().toLowerCase();
            const canApprove = !(options && options.readOnly) && pendingStatuses.includes(rawStatus);

            if (approveBtn) approveBtn.onclick = canApprove ? () => this.handleApprovePostInModal() : null;
            if (rejectBtn) rejectBtn.onclick = canApprove ? () => this.handleRejectPostInModal() : null;
            if (closeBtn) closeBtn.onclick = () => {
                if(global.ClientUI) global.ClientUI.showPostModal(false);
            };
        },

        handleApprovePostInModal: async function() {
            if (!this.activePostId) return;
            if (!confirm('Aprovar este post?')) return;

            const clientId = this.getClientId();
            const commentInput = document.getElementById('client-post-modal-comment');
            const comment = commentInput ? commentInput.value.trim() : '';

            const result = await global.ClientRepo.approvePost(this.activePostId, clientId, comment);
            const ok = result === true || result?.ok === true;
            if (ok) {
                alert('Post aprovado com sucesso!');
                if(global.ClientUI) global.ClientUI.showPostModal(false);
                await this.loadPendingPosts(); // Refresh list
                await this.loadDashboardData();
            } else {
                const err = result?.error;
                console.error('[ClientCore] approvePost falhou:', result);
                alert(`Erro ao aprovar post.${err?.message ? `\n${err.message}` : ''}`);
            }
        },

        handleRejectPostInModal: async function() {
            if (!this.activePostId) return;
            
            const commentInput = document.getElementById('client-post-modal-comment');
            const reason = commentInput ? commentInput.value.trim() : '';

            if (!reason) {
                alert('Por favor, descreva o ajuste necessário.');
                return;
            }

            const clientId = this.getClientId();
            const result = await global.ClientRepo.rejectPost(this.activePostId, clientId, reason);
            const ok = result === true || result?.ok === true;
            if (ok) {
                alert('Solicitação de ajuste enviada!');
                if(global.ClientUI) global.ClientUI.showPostModal(false);
                await this.loadPendingPosts(); // Refresh list
                await this.loadDashboardData();
            } else {
                const err = result?.error;
                console.error('[ClientCore] rejectPost falhou:', result);
                alert(`Erro ao enviar solicitação.${err?.message ? `\n${err.message}` : ''}`);
            }
        },

        handleApprovePost: async function(postId) {
            if (!confirm('Aprovar este post?')) return;
            const clientId = this.getClientId();
            const result = await global.ClientRepo.approvePost(postId, clientId, '');
            const ok = result === true || result?.ok === true;
            if (ok) {
                alert('Post aprovado!');
                await this.loadPendingPosts();
            } else {
                const err = result?.error;
                console.error('[ClientCore] approvePost falhou:', result);
                alert(`Erro ao aprovar post.${err?.message ? `\n${err.message}` : ''}`);
            }
        },

        handleRejectPost: async function(postId, reason) {
            const clientId = this.getClientId();
            const result = await global.ClientRepo.rejectPost(postId, clientId, reason);
            const ok = result === true || result?.ok === true;
            if (ok) {
                alert('Solicitação enviada!');
                await this.loadPendingPosts();
            } else {
                const err = result?.error;
                console.error('[ClientCore] rejectPost falhou:', result);
                alert(`Erro ao enviar solicitação.${err?.message ? `\n${err.message}` : ''}`);
            }
        },

        openCalendarModal: async function(calendarId, monthKey, status = null) {
            this.activeCalendarId = calendarId;
            this.activeEditorialMonthKey = global.MonthUtils?.isValidMonthKey?.(monthKey) ? monthKey : null;
            this.ensureEditorialReviewLoaded(calendarId);
            this._activeCalendarItems = [];
            this._activeCalendarPostsByItemId = {};
            this._activeEditorialEntries = [];
            this._activeEditorialMonthPosts = [];
            
            // UI Setup
            const titleEl = document.getElementById('client-calendar-modal-title');
            const statusEl = document.getElementById('client-calendar-modal-status');
            const periodEl = document.getElementById('client-calendar-modal-period');
            const loadingEl = document.getElementById('client-calendar-posts-loading');
            const emptyEl = document.getElementById('client-calendar-posts-empty');
            
            if (titleEl) titleEl.textContent = 'Calendário editorial';
            if (statusEl) {
                const raw = String(status || '').trim().toLowerCase();
                const map = {
                    ready_for_approval: { label: 'Pronto para aprovação', cls: 'bg-amber-100 text-amber-700' },
                    awaiting_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    aguardando_aprovacao: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    sent_for_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    needs_changes: { label: 'Precisa de ajustes', cls: 'bg-sky-100 text-sky-700' },
                    ajuste_solicitado: { label: 'Ajuste solicitado', cls: 'bg-sky-100 text-sky-700' },
                    approved: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
                    aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
                    draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700' },
                    rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700' }
                };
                const info = map[raw] || { label: raw || 'Status', cls: 'bg-slate-100 text-slate-700' };
                statusEl.textContent = info.label;
                statusEl.className = `inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium ${info.cls}`;
            }

            // Show Modal
            if (global.ClientUI) global.ClientUI.showCalendarModal(true);
            if (loadingEl) loadingEl.classList.remove('hidden');
            if (emptyEl) emptyEl.classList.add('hidden');

            // Load Itens do calendário (planejamento editorial)
            const clientId = this.getClientId();
            const meta = global.ClientRepo?.getCalendarMeta ? await global.ClientRepo.getCalendarMeta(calendarId, clientId) : null;
            const metaMonthKey = global.CalendarStateSelectors?.getMonthKeyFromMonthRef
                ? global.CalendarStateSelectors.getMonthKeyFromMonthRef(meta?.mes_referencia)
                : '';
            const effectiveMonthKey = global.MonthUtils?.isValidMonthKey?.(metaMonthKey)
                ? metaMonthKey
                : (global.MonthUtils?.isValidMonthKey?.(monthKey) ? monthKey : '');
            this.activeEditorialMonthKey = effectiveMonthKey || null;
            console.log('[ClientCalendar] source calendario mensal:', {
                calendarId,
                clientId,
                monthKey: effectiveMonthKey || null,
                meta: meta ? { id: meta.id, status: meta.status, mes_referencia: meta.mes_referencia } : null
            });
            if (periodEl) {
                periodEl.textContent = global.MonthUtils?.formatMonthLabel && effectiveMonthKey
                    ? global.MonthUtils.formatMonthLabel(effectiveMonthKey)
                    : (effectiveMonthKey || 'Calendário');
            }
            if (statusEl && meta?.status) {
                const raw = String(meta.status || '').trim().toLowerCase();
                const map = {
                    ready_for_approval: { label: 'Pronto para aprovação', cls: 'bg-amber-100 text-amber-700' },
                    awaiting_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    aguardando_aprovacao: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    sent_for_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    needs_changes: { label: 'Precisa de ajustes', cls: 'bg-sky-100 text-sky-700' },
                    ajuste_solicitado: { label: 'Ajuste solicitado', cls: 'bg-sky-100 text-sky-700' },
                    approved: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
                    aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
                    draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700' },
                    rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700' }
                };
                const info = map[raw] || { label: raw || 'Status', cls: 'bg-slate-100 text-slate-700' };
                statusEl.textContent = info.label;
                statusEl.className = `inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium ${info.cls}`;
            }
            const monthRange = effectiveMonthKey && global.CalendarStateSelectors?.getMonthRange
                ? global.CalendarStateSelectors.getMonthRange(effectiveMonthKey)
                : null;
            const monthPosts = monthRange
                ? await global.ClientRepo.getPostsByDateRange(clientId, monthRange.startDate, monthRange.endDateExclusive)
                : [];

            const items = global.ClientRepo.getCalendarItems
                ? await global.ClientRepo.getCalendarItems(calendarId, clientId)
                : [];
            const itemsById = {};
            (Array.isArray(items) ? items : []).forEach((it) => {
                const key = String(it?.id || '').trim();
                if (key) itemsById[key] = it;
            });

            const byCalendarId = (Array.isArray(monthPosts) ? monthPosts : []).filter((p) => String(p?.calendar_id || '').trim() === String(calendarId || '').trim());
            this._activeEditorialMonthPosts = Array.isArray(monthPosts) ? monthPosts : [];

            const postsByItemId = {};
            (Array.isArray(byCalendarId) ? byCalendarId : []).forEach((p) => {
                const key = String(p?.calendar_item_id || '').trim();
                if (key) postsByItemId[key] = p;
            });

            this._activeCalendarItems = Array.isArray(items) ? items : [];
            this._activeCalendarPostsByItemId = postsByItemId;
            const calendarStatusFallback = String(meta?.status || status || '').trim() || '';

            const entries = (Array.isArray(items) ? items : [])
                .map((item) => {
                    const itemId = String(item?.id || '').trim();
                    if (!itemId) return null;
                    const scheduled = String(item?.data || item?.data_agendada || item?.post_date || item?.data_sugerida || '').slice(0, 10);
                    if (!scheduled) return null;
                    const relatedPost = postsByItemId[itemId] || null;
                    const localReview = this.getEditorialItemReview(itemId);
                    const tema = item?.tema || item?.titulo || item?.title || 'Sem título';
                    const canal = item?.canal || item?.plataforma || item?.platform || '-';
                    const tipo = item?.tipo_conteudo || item?.formato || 'post_estatico';
                    const copy = item?.copy || item?.copy_text || item?.copywriting || item?.observacoes || '';
                    const itemReviewStatus = String(
                        item?.client_review_status
                        || item?.review_status
                        || item?.status_cliente
                        || ''
                    ).trim();
                    let statusValue = String(
                        relatedPost?.status
                        || itemReviewStatus
                        || localReview?.status
                        || item?.status
                        || 'draft'
                    ).trim() || 'draft';
                    const statusKey = global.GQV_CONSTANTS?.getSocialStatusKey ? global.GQV_CONSTANTS.getSocialStatusKey(statusValue) : String(statusValue || '').trim().toLowerCase();
                    if (statusKey === 'needs_changes' || statusKey === 'sent_for_approval') statusValue = 'draft';
                    return {
                        key: String(relatedPost?.id || `item_${itemId}`),
                        postId: String(relatedPost?.id || '').trim() || null,
                        itemId,
                        calendarId: String(calendarId || '').trim(),
                        scheduledDate: scheduled,
                        tema,
                        canal,
                        tipo,
                        copy,
                        status: statusValue
                    };
                })
                .filter((e) => !!e?.scheduledDate);

            // Se não há posts vinculados, renderizar direto dos calendar_items
            if (!entries.length && items && items.length) {
                const itemEntries = items.map((it) => ({
                    key: String(it?.id || Math.random()),
                    postId: null,
                    itemId: String(it?.id || '').trim(),
                    calendarId: String(calendarId || '').trim(),
                    scheduledDate: String(it?.data || it?.data_agendada || '').slice(0, 10),
                    tema: it?.tema || it?.titulo || it?.title || 'Sem título',
                    canal: it?.canal || it?.plataforma || it?.platform || '-',
                    tipo: it?.tipo_conteudo || it?.formato || 'post_estatico',
                    copy: it?.copy || it?.copy_text || it?.copywriting || it?.observacoes || '',
                    status: String(it?.status || '').trim() || 'draft'
                })).filter((e) => !!e.scheduledDate);

                if (global.ClientUI) global.ClientUI.renderCalendarPostsInModal(
                    itemEntries, { source: 'calendar_items_fallback' }
                );
                this.setupModalActions();
                return;
            }

            this._activeEditorialEntries = entries;

            const visible = entries.filter((e) => {
                const raw = String(e?.status || '').trim().toLowerCase();
                const key = global.GQV_CONSTANTS?.getSocialStatusKey ? global.GQV_CONSTANTS.getSocialStatusKey(raw) : raw;
                return key !== 'approved' && key !== 'changes_requested';
            });

            const uniqueStatuses = Array.from(new Set(entries.map((e) => String(e.status || '').trim().toLowerCase()).filter(Boolean)));
            const mapped = uniqueStatuses.map((s) => ({ raw: s, label: global.ClientUI?.getStatusDisplay ? global.ClientUI.getStatusDisplay(s).label : s }));
            console.log('[ClientCalendar] status normalizado:', mapped);
            console.log('[ClientCalendar] itens renderizados no modal:', { calendarId, clientId, count: visible.length, total: entries.length });

            if (global.ClientUI) global.ClientUI.renderCalendarPostsInModal(visible, { source: 'calendar_items', postsByItemId });

            // Bind Actions
            this.setupModalActions();
        },

        getEditorialReviewStorageKey: function(calendarId) {
            const raw = String(calendarId || '').trim();
            return raw ? `GQV_CLIENT_EDITORIAL_REVIEW_${raw}` : '';
        },

        ensureEditorialReviewLoaded: function(calendarId) {
            const raw = String(calendarId || '').trim();
            if (!raw) return;
            if (this._editorialReviewByCalendarId[raw]) return;
            const key = this.getEditorialReviewStorageKey(raw);
            if (!key) return;
            try {
                const stored = localStorage.getItem(key);
                const parsed = stored ? JSON.parse(stored) : null;
                const items = parsed?.items && typeof parsed.items === 'object' ? parsed.items : {};
                this._editorialReviewByCalendarId[raw] = { items };
            } catch {
                this._editorialReviewByCalendarId[raw] = { items: {} };
            }
        },

        persistEditorialReview: function(calendarId) {
            const raw = String(calendarId || '').trim();
            if (!raw) return;
            const key = this.getEditorialReviewStorageKey(raw);
            if (!key) return;
            try {
                localStorage.setItem(key, JSON.stringify(this._editorialReviewByCalendarId[raw] || { items: {} }));
            } catch {}
        },

        getEditorialItemReview: function(itemId) {
            const calendarId = String(this.activeCalendarId || '').trim();
            if (!calendarId) return null;
            this.ensureEditorialReviewLoaded(calendarId);
            const review = this._editorialReviewByCalendarId[calendarId]?.items?.[String(itemId || '').trim()] || null;
            return review && typeof review === 'object' ? review : null;
        },

        setEditorialItemReview: function(itemId, status, comment) {
            const calendarId = String(this.activeCalendarId || '').trim();
            if (!calendarId) return;
            this.ensureEditorialReviewLoaded(calendarId);
            const key = String(itemId || '').trim();
            if (!key) return;
            const safeStatus = String(status || '').trim();
            const safeComment = String(comment || '').trim();
            const current = this._editorialReviewByCalendarId[calendarId] || { items: {} };
            current.items = current.items || {};
            current.items[key] = { status: safeStatus, comment: safeComment, updatedAt: Date.now() };
            this._editorialReviewByCalendarId[calendarId] = current;
            this.persistEditorialReview(calendarId);
        },

        approveCalendarItem: async function(itemId, comment) {
            await this.approveCalendarEntry({ itemId: itemId }, comment);
        },

        approveCalendarEntry: async function(entry, comment) {
            const calendarId = this.activeCalendarId;
            if (!calendarId || !entry) return;
            const clientId = this.getClientId();
            const trimmedComment = String(comment || '').trim();
            const postId = String(entry?.postId || '').trim();
            const itemId = String(entry?.itemId || '').trim();

            if (itemId && global.ClientRepo?.updateCalendarItemEditorialStatus) {
                const scheduledDate = String(entry?.scheduledDate || entry?.date || entry?.data || '').trim();
                const tema = String(entry?.tema || '').trim();
                const copy = String(entry?.copy || '').trim();
                const canal = String(entry?.canal || '').trim();
                const tipo = String(entry?.tipo || '').trim();

                const result = await global.ClientRepo.updateCalendarItemEditorialStatus(itemId, clientId, {
                    status: 'approved',
                    comment: trimmedComment,
                    tema,
                    copy,
                    canal,
                    tipo_conteudo: tipo
                });
                if (result?.ok === true) {
                    this.setEditorialItemReview(itemId, 'approved', trimmedComment);
                } else {
                    console.error('[ClientCalendar] falha ao aprovar item (calendar_item):', { calendarId, itemId, error: result?.error || null });
                    return;
                }

                if (global.ClientRepo?.ensurePostDraftFromCalendarItem) {
                    await global.ClientRepo.ensurePostDraftFromCalendarItem({
                        calendarId,
                        calendarItemId: itemId,
                        clientId,
                        scheduledDate,
                        tema,
                        copy,
                        formato: tipo,
                        plataforma: canal
                    });
                }

                await this.openCalendarModal(calendarId, this.activeEditorialMonthKey || '', null);
                return;
            }

            if (postId && global.ClientRepo?.updatePostEditorialStatus) {
                const result = await global.ClientRepo.updatePostEditorialStatus(postId, clientId, 'draft', trimmedComment);
                if (result?.ok === true) {
                    if (itemId) this.setEditorialItemReview(itemId, 'approved', trimmedComment);
                } else {
                    console.error('[ClientCalendar] falha ao aprovar item (post fallback):', { calendarId, postId, clientId, error: result?.error || null });
                }
            }

            await this.openCalendarModal(calendarId, this.activeEditorialMonthKey || '', null);
        },

        requestCalendarItemAdjustment: async function(itemId, comment) {
            await this.requestCalendarEntryAdjustment({ itemId: itemId }, comment);
        },

        requestCalendarEntryAdjustment: async function(entry, comment, patch = null) {
            let calendarId = this.activeCalendarId;
            if (!calendarId || !entry) return false;
            const clientId = this.getClientId();
            const trimmedComment = String(comment || '').trim();
            const postId = String(entry?.postId || '').trim();
            const itemId = String(entry?.itemId || '').trim();
            const tema = String(patch?.tema || '').trim();
            const copy = String(patch?.copy || patch?.legenda || '').trim();

            if (!calendarId && Array.isArray(this._activeEditorialEntries)) {
                const match = this._activeEditorialEntries.find(e => String(e?.itemId || '') === itemId);
                if (match?.calendarId) calendarId = String(match.calendarId);
            }
            if (!calendarId) {
                console.error('[ClientCalendar] request changes aborted: calendarId missing', { itemId, clientId });
                return false;
            }

            if (itemId && global.ClientRepo?.updateCalendarItemEditorialStatus) {
                const scheduledDate = String(entry?.scheduledDate || entry?.date || entry?.data || '').trim();
                const canal = String(entry?.canal || '').trim();
                const tipo = String(entry?.tipo || '').trim();
                const payload = {
                    calendarId,
                    itemId,
                    clientId,
                    status: 'needs_changes',
                    comment: trimmedComment,
                    scheduledDate,
                    canal,
                    tipo,
                    tema: tema || String(entry?.tema || '').trim(),
                    copy: copy || String(entry?.copy || '').trim()
                };
                console.log('[ClientCalendar] request changes payload', payload);

                const result = await global.ClientRepo.updateCalendarItemEditorialStatus(itemId, clientId, {
                    calendar_id: calendarId,
                    status: 'needs_changes',
                    comment: trimmedComment
                });
                if (result?.ok !== true) {
                    const err = result?.error || null;
                    let errJson = null;
                    try { errJson = JSON.stringify(err, null, 2); } catch { errJson = null; }
                    console.error('[ClientCalendar] request changes failed:', {
                        calendarId,
                        itemId,
                        error: err,
                        code: err?.code || null,
                        message: err?.message || null,
                        details: err?.details || null,
                        hint: err?.hint || null,
                        error_json: errJson
                    });
                    return false;
                }

                console.log('[ClientCalendar] request changes persisted', { calendarId, itemId });
                this.setEditorialItemReview(itemId, 'needs_changes', trimmedComment);

                if (global.ClientRepo?.updateCalendarStatus) {
                    const { error } = await global.ClientRepo.updateCalendarStatus(calendarId, 'needs_changes', clientId);
                    if (error) console.error('[ClientCalendar] calendar needs_changes failed:', { calendarId, error });
                }
                await this.openCalendarModal(calendarId, this.activeEditorialMonthKey || '', null);
                console.log('[ClientCalendar] request changes ui updated', { calendarId, itemId });
                return true;
            }

            if (postId) {
                console.error('[ClientCalendar] request changes blocked: missing itemId, postId ignored', { calendarId, postId, clientId });
            }
            return false;
        },

        submitEditorialAdjustment: async function(entry, payload) {
            const calendarId = this.activeCalendarId;
            if (!calendarId || !entry) return;
            const adjustmentText = String(payload?.adjustmentText || '').trim();
            if (!adjustmentText) {
                console.log('[EditorialReview] missing adjustment text:', { calendarId, entryKey: entry?.key || null });
                global.ClientUI?.setEditorialAdjustFeedback?.('Descreva o ajuste solicitado para continuar.', 'error');
                return;
            }
            const ok = await this.requestCalendarEntryAdjustment(entry, adjustmentText, { tema: payload?.tema, copy: payload?.copy });
            if (!ok) {
                global.ClientUI?.setEditorialAdjustFeedback?.('Não foi possível enviar ajustes. Tente novamente.', 'error');
                return;
            }
            console.log('[EditorialReview] adjustment text saved:', { calendarId, entryKey: entry?.key || null });
            global.ClientUI?.setEditorialAdjustFeedback?.('Ajuste solicitado com sucesso.', 'success');
            global.ClientUI?.showEditorialAdjustModal?.(false);
        },

        sendEditorialFeedbackToAgency: async function() {
            const calendarId = String(this.activeCalendarId || '').trim();
            if (!calendarId) return;
            const clientId = this.getClientId();
            this.ensureEditorialReviewLoaded(calendarId);
            const review = this._editorialReviewByCalendarId[calendarId]?.items || {};
            const commentInput = document.getElementById('client-calendar-approval-comment');
            const freeText = commentInput ? String(commentInput.value || '').trim() : '';
            const lines = Object.keys(review).sort().map((itemKey) => {
                const entry = review[itemKey] || {};
                const s = String(entry.status || '').trim() || 'pending';
                const c = String(entry.comment || '').trim();
                return c ? `item:${itemKey} status:${s} comment:${c}` : `item:${itemKey} status:${s}`;
            });
            const payload = [freeText, lines.length ? lines.join('\n') : ''].filter(Boolean).join('\n\n');
            if (global.ClientRepo?.updateCalendarFeedback) {
                await global.ClientRepo.updateCalendarFeedback(calendarId, clientId, payload);
            }
        },

        concludeCalendarVerification: async function() {
            const calendarId = String(this.activeCalendarId || '').trim();
            if (!calendarId) {
                console.log('[ClientCalendar] conclude blocked reason:', { reason: 'missing_calendarId' });
                return;
            }
            const monthKey = String(this.activeEditorialMonthKey || '').trim();
            const commentInput = document.getElementById('client-calendar-approval-comment');
            const comment = commentInput ? String(commentInput.value || '').trim() : '';
            console.log('[ClientCalendar] conclude clicked', { calendarId, monthKey: monthKey || null });
            await this.sendEditorialFeedbackToAgency();

            const entries = Array.isArray(this._activeEditorialEntries) ? this._activeEditorialEntries : [];
            const approvedKeys = new Set(['approved', 'scheduled', 'published']);
            let hasChangesRequested = false;
            let pendingCount = 0;
            entries.forEach((e) => {
                const raw = String(e?.status || '').trim().toLowerCase();
                const key = global.GQV_CONSTANTS?.getSocialStatusKey ? global.GQV_CONSTANTS.getSocialStatusKey(raw) : raw;
                if (key === 'changes_requested') hasChangesRequested = true;
                else if (!approvedKeys.has(key)) pendingCount += 1;
            });

            const nextCalendarStatus = hasChangesRequested ? 'needs_changes' : (pendingCount === 0 ? 'approved' : null);
            console.log('[ClientCalendar] conclude aggregate:', { calendarId, total: entries.length, pendingCount, hasChangesRequested, nextCalendarStatus });
            if (!nextCalendarStatus) {
                console.log('[ClientCalendar] conclude blocked reason:', { reason: 'pending_items', calendarId, pendingCount });
                return;
            }

            if (global.ClientRepo?.updateCalendarStatus) {
                console.log('[ClientCalendar] about to update social_calendars from: concludeCalendarVerification');
                const clientId = this.getClientId();
                const { error } = await global.ClientRepo.updateCalendarStatus(calendarId, nextCalendarStatus, clientId);
                if (error) {
                    console.error('[ClientCalendar] falha ao concluir verificacao (update status):', { calendarId, status: nextCalendarStatus, error });
                    console.log('[ClientCalendar] conclude update error:', { calendarId, status: nextCalendarStatus, code: error?.code || null, message: error?.message || null });
                    console.log('[ClientCalendar] conclude blocked reason:', { reason: 'updateCalendarStatus_failed', calendarId, status: nextCalendarStatus });
                    return;
                }
                console.log('[ClientCalendar] conclude update success:', { calendarId, status: nextCalendarStatus });
            }
            console.log('[ClientCalendar] calendar status persisted:', { calendarId, status: nextCalendarStatus });
            console.log('[ClientCalendar] pipeline untouched:', { calendarId, note: 'social_posts.status não foi alterado' });

            const statusEl = document.getElementById('client-calendar-modal-status');
            if (statusEl) {
                const raw = nextCalendarStatus;
                const map = {
                    ready_for_approval: { label: 'Pronto para aprovação', cls: 'bg-amber-100 text-amber-700' },
                    awaiting_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    aguardando_aprovacao: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    sent_for_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    needs_changes: { label: 'Precisa de ajustes', cls: 'bg-sky-100 text-sky-700' },
                    ajuste_solicitado: { label: 'Ajuste solicitado', cls: 'bg-sky-100 text-sky-700' },
                    approved: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
                    aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
                    draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700' },
                    rascunho: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-700' }
                };
                const info = map[raw] || { label: raw || 'Status', cls: 'bg-slate-100 text-slate-700' };
                statusEl.textContent = info.label;
                statusEl.className = `inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium ${info.cls}`;
            }

            await this.openCalendarModal(calendarId, monthKey, nextCalendarStatus);

            await this.loadCalendars();
            await this.loadDashboardData();
            console.log('[ClientCalendar] conclude refresh done', { calendarId, clientId: this.getClientId(), monthKey: monthKey || null });
        },

        setupModalActions: function() {
            const closeBtn = document.getElementById('client-calendar-modal-close');
            const closeFooterBtn = document.getElementById('client-calendar-modal-close-footer');
            const concludeBtn = document.getElementById('client-calendar-modal-conclude');

            if (closeBtn) closeBtn.onclick = () => global.ClientUI.showCalendarModal(false);
            if (closeFooterBtn) closeFooterBtn.onclick = () => global.ClientUI.showCalendarModal(false);
            if (concludeBtn) concludeBtn.onclick = async () => {
                console.log('[ClientCalendar] conclude clicked', { calendarId: String(this.activeCalendarId || '').trim() || null });
                await this.concludeCalendarVerification();
            };
        },

        handleApproveCalendar: async function() {
            if (!this.activeCalendarId) return;
            if (!confirm('Confirmar a aprovação deste calendário?')) return;

            const clientId = this.getClientId();
            const commentInput = document.getElementById('client-calendar-approval-comment');
            const comment = commentInput ? commentInput.value.trim() : '';
            const result = await global.ClientRepo.approveCalendar(this.activeCalendarId, clientId, comment);
            const ok = result === true || result?.ok === true;
            if (ok) {
                alert('Calendário aprovado com sucesso!');
                if (global.ClientUI) global.ClientUI.showCalendarModal(false);
                await this.loadCalendars(); // Refresh list
                await this.loadDashboardData();
            } else {
                console.error('[ClientCore] approveCalendar falhou:', result);
                const errMsg = result?.error?.message || '';
                alert(`Erro ao aprovar.${errMsg ? `\n${errMsg}` : ''}`);
            }
        },

        handleRejectCalendar: async function() {
            if (!this.activeCalendarId) return;
            const commentInput = document.getElementById('client-calendar-approval-comment');
            const comment = commentInput ? commentInput.value.trim() : '';

            if (!comment) {
                alert('Por favor, escreva um comentário explicando o que precisa ser ajustado.');
                return;
            }

            const clientId = this.getClientId();
            const result = await global.ClientRepo.rejectCalendar(this.activeCalendarId, clientId, comment);
            const ok = result === true || result?.ok === true;
            if (ok) {
                alert('Solicitação de ajuste enviada!');
                if (global.ClientUI) global.ClientUI.showCalendarModal(false);
                await this.loadCalendars(); // Refresh list
                await this.loadDashboardData();
            } else {
                console.error('[ClientCore] rejectCalendar falhou:', result);
                const errMsg = result?.error?.message || '';
                alert(`Erro ao enviar solicitação.${errMsg ? `\n${errMsg}` : ''}`);
            }
        }
    };

    global.ClientCore = ClientCore;

    // Auto Init
    document.addEventListener('DOMContentLoaded', () => {
        // Aguarda ClientAuth carregar se necessário, mas DOMContentLoaded já deve ter scripts
        setTimeout(() => ClientCore.init(), 500); 
    });

})(window);
