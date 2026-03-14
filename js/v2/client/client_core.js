// js/v2/client/client_core.js
// Núcleo do Portal do Cliente V2

(function(global) {
    const ClientCore = {
        currentClient: null,
        activeCalendarId: null,
        activePostId: null,
        calendarMonthRef: null,
        clientProfile: null,
        _initStarted: false,
        _pendingEditorialCalendars: [],

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

            this.currentClient = ensured.session;

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
                const clientId = this.currentClient?.client_id || null;
                const clientName = this.currentClient?.name || null;
                if (clientId) global.ClientContext?.setActiveClient?.({ id: clientId, name: clientName });
            } catch {}

            await this.loadClientProfile();

            // 2. Init UI
            if (global.ClientUI) {
                global.ClientUI.init();
                global.ClientUI.updateUserInfo(this.currentClient);
                global.ClientUI.setDashboardHeader({
                    clientId: this.currentClient?.client_id || null,
                    tenantId: this.currentClient?.tenant_id || global.TenantContext?.getTenantUuid?.() || null,
                    status: this.currentClient?.status || this.clientProfile?.status || null
                });
                global.ClientUI.switchView('home'); // Default view
            }

            // 3. Load Initial Data
            await this.loadDashboardData();
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
            const clientIdNum = Number(this.currentClient.client_id);
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
            const clientId = this.currentClient.client_id;
            
            const pendingCalendars = await global.ClientRepo.getPendingCalendars(clientId);
            this._pendingEditorialCalendars = Array.isArray(pendingCalendars) ? pendingCalendars : [];

            const pendingPosts = await global.ClientRepo.getPendingPosts(clientId);
            const pendingPostsWithMedia = (pendingPosts || []).filter((p) => {
                const mediaUrl = p?.imagem_url || p?.media_url || p?.mediaUrl || p?.imagemUrl || null;
                return !!String(mediaUrl || '').trim();
            });
            const now = new Date();
            const monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const postsInMonth = await global.ClientRepo.getPostsByDateRange(clientId, monthStart.toISOString().slice(0, 10), monthEnd.toISOString().slice(0, 10));
            const approvedCount = (postsInMonth || []).filter((p) => {
                const s = String(p?.status || '').toLowerCase();
                return ['approved', 'scheduled', 'aprovado', 'agendado'].includes(s);
            }).length;
            const publishedCount = (postsInMonth || []).filter((p) => {
                const s = String(p?.status || '').toLowerCase();
                return ['published', 'publicado'].includes(s);
            }).length;

            const nextPost = await global.ClientRepo.getNextPost(clientId, now.toISOString().slice(0, 10));
            const nextTitle = nextPost?.tema || nextPost?.titulo || nextPost?.title || '-';
            const nextDateRaw = nextPost?.data_agendada || nextPost?.data_postagem || '';
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
                    clientId: this.currentClient?.client_id || null,
                    tenantId: this.currentClient?.tenant_id || global.TenantContext?.getTenantUuid?.() || null,
                    status: this.currentClient?.status || this.clientProfile?.status || null
                });
            }
        },

        loadCalendars: async function() {
            if (!this.currentClient) return;
            const clientId = this.currentClient.client_id;
            
            const calendars = await global.ClientRepo.getPendingCalendars(clientId);
            
            if (global.ClientUI) {
                global.ClientUI.renderCalendarList(calendars);
            }
        },

        loadPendingPosts: async function() {
            if (!this.currentClient) return;
            const clientId = this.currentClient.client_id;
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
            const list = Array.isArray(this._pendingEditorialCalendars) ? this._pendingEditorialCalendars : [];
            const first = list[0] || null;
            if (!first?.id) {
                alert('Nenhum calendário editorial pendente.');
                return;
            }
            const raw = first.mes_referencia ? String(first.mes_referencia).slice(0, 10) : '';
            const date = raw ? new Date(`${raw}T00:00:00`) : null;
            const monthName = date
                ? date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
                : 'Calendário';
            const label = monthName ? monthName.charAt(0).toUpperCase() + monthName.slice(1) : 'Calendário';
            await this.openCalendarModal(first.id, label, first.status || null);
        },

        loadCalendarMonth: async function() {
            if (!this.currentClient) return;
            if (!(this.calendarMonthRef instanceof Date)) this.calendarMonthRef = new Date();

            const loading = document.getElementById('client-calendar-loading');
            if (loading) loading.classList.remove('hidden');
            const empty = document.getElementById('client-calendar-empty');
            if (empty) empty.classList.add('hidden');

            const clientId = this.currentClient.client_id;
            const start = new Date(this.calendarMonthRef.getFullYear(), this.calendarMonthRef.getMonth(), 1);
            const end = new Date(this.calendarMonthRef.getFullYear(), this.calendarMonthRef.getMonth() + 1, 1);
            const formatLocalDate = (d) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };
            const posts = await global.ClientRepo.getPostsByDateRange(clientId, formatLocalDate(start), formatLocalDate(end));
            global.ClientUI?.renderClientCalendar?.(posts, this.calendarMonthRef);
        },

        shiftCalendarMonth: async function(delta) {
            if (!(this.calendarMonthRef instanceof Date)) this.calendarMonthRef = new Date();
            const next = new Date(this.calendarMonthRef.getFullYear(), this.calendarMonthRef.getMonth() + Number(delta || 0), 1);
            this.calendarMonthRef = next;
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

            const clientId = this.currentClient.client_id;
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

            const clientId = this.currentClient?.client_id || null;
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

            const clientId = this.currentClient?.client_id || null;
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
            const clientId = this.currentClient?.client_id || null;
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
            const clientId = this.currentClient?.client_id || null;
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

        openCalendarModal: async function(calendarId, monthName, status = null) {
            this.activeCalendarId = calendarId;
            
            // UI Setup
            const titleEl = document.getElementById('client-calendar-modal-title');
            const statusEl = document.getElementById('client-calendar-modal-status');
            const periodEl = document.getElementById('client-calendar-modal-period');
            
            if (titleEl) titleEl.textContent = 'Calendário editorial';
            if (periodEl) periodEl.textContent = monthName;
            if (statusEl) {
                const raw = String(status || '').trim().toLowerCase();
                const map = {
                    awaiting_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    aguardando_aprovacao: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    sent_for_approval: { label: 'Aguardando aprovação', cls: 'bg-yellow-100 text-yellow-700' },
                    needs_changes: { label: 'Ajuste solicitado', cls: 'bg-sky-100 text-sky-700' },
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

            // Load Itens do calendário (planejamento editorial)
            const clientId = this.currentClient?.client_id || null;
            const items = global.ClientRepo.getCalendarItems
                ? await global.ClientRepo.getCalendarItems(calendarId, clientId)
                : [];
            if (global.ClientUI) global.ClientUI.renderCalendarPostsInModal(items);

            // Bind Actions
            this.setupModalActions();
        },

        setupModalActions: function() {
            const approveBtn = document.getElementById('client-calendar-modal-approve');
            const adjustBtn = document.getElementById('client-calendar-modal-adjust');
            const closeBtn = document.getElementById('client-calendar-modal-close');
            const commentInput = document.getElementById('client-calendar-approval-comment');

            // Remove old listeners (simple clone hack or just ensure single binding in init - using simple onclick here for MVP clarity)
            if (approveBtn) approveBtn.onclick = () => this.handleApproveCalendar();
            if (adjustBtn) adjustBtn.onclick = () => this.handleRejectCalendar();
            if (closeBtn) closeBtn.onclick = () => global.ClientUI.showCalendarModal(false);
        },

        handleApproveCalendar: async function() {
            if (!this.activeCalendarId) return;
            if (!confirm('Confirmar a aprovação deste calendário?')) return;

            const clientId = this.currentClient?.client_id || null;
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

            const clientId = this.currentClient?.client_id || null;
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
