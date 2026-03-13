// js/v2/client/client_core.js
// Núcleo do Portal do Cliente V2

(function(global) {
    const ClientCore = {
        currentClient: null,
        activeCalendarId: null,
        clientProfile: null,

        init: async function() {
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
            if (viewName === 'approvals-calendar') {
                await this.loadCalendars();
            } else if (viewName === 'approvals-posts') {
                await this.loadPendingPosts();
            } else if (viewName === 'home') {
                await this.loadDashboardData();
            } else if (viewName === 'metrics') {
                if (global.ClientUI?.initMetricsChart) global.ClientUI.initMetricsChart();
            } else if (viewName === 'files') {
                await this.loadFiles();
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
            
            // Fetch Pending Calendars count
            const calendars = await global.ClientRepo.getPendingCalendars(clientId);
            const pendingPosts = await global.ClientRepo.getPendingPosts(clientId);
            
            if (global.ClientUI) {
                global.ClientUI.setDashboardMetrics({ 
                    approvals: calendars.length + pendingPosts.length 
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
            
            if (global.ClientUI) {
                global.ClientUI.renderPendingPostsList(posts);
            }
        },

        loadFiles: async function() {
            const loading = document.getElementById('files-loading');
            if (loading) loading.classList.remove('hidden');
            if (global.ClientUI?.renderFilesList) global.ClientUI.renderFilesList([]);
        },

        openPostModal: function(post) {
            this.activePostId = post?.id;
            console.log('[ClientCore] openPostModal:', { postId: this.activePostId, status: post?.status });
            
            // Show UI
            if(global.ClientUI) global.ClientUI.showPostModal(true, post);

            // Bind Actions
            const approveBtn = document.getElementById('client-post-modal-approve');
            const rejectBtn = document.getElementById('client-post-modal-reject');
            const closeBtn = document.getElementById('client-post-modal-close');

            if (approveBtn) approveBtn.onclick = () => this.handleApprovePostInModal();
            if (rejectBtn) rejectBtn.onclick = () => this.handleRejectPostInModal();
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

        openCalendarModal: async function(calendarId, monthName) {
            this.activeCalendarId = calendarId;
            
            // UI Setup
            const titleEl = document.getElementById('client-calendar-modal-title');
            const statusEl = document.getElementById('client-calendar-modal-status');
            const periodEl = document.getElementById('client-calendar-modal-period');
            
            if (titleEl) titleEl.textContent = 'Aprovação de Calendário';
            if (periodEl) periodEl.textContent = monthName;
            if (statusEl) {
                statusEl.textContent = 'Aguardando Aprovação';
                statusEl.className = 'inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700';
            }

            // Show Modal
            if (global.ClientUI) global.ClientUI.showCalendarModal(true);

            // Load Posts
            const clientId = this.currentClient?.client_id || null;
            const posts = await global.ClientRepo.getCalendarPosts(calendarId, clientId);
            if (global.ClientUI) global.ClientUI.renderCalendarPostsInModal(posts);

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
            const success = await global.ClientRepo.approveCalendar(this.activeCalendarId, clientId, comment);
            if (success) {
                alert('Calendário aprovado com sucesso!');
                if (global.ClientUI) global.ClientUI.showCalendarModal(false);
                await this.loadCalendars(); // Refresh list
                await this.loadDashboardData();
            } else {
                alert('Erro ao aprovar. Tente novamente.');
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
            const success = await global.ClientRepo.rejectCalendar(this.activeCalendarId, clientId, comment);
            if (success) {
                alert('Solicitação de ajuste enviada!');
                if (global.ClientUI) global.ClientUI.showCalendarModal(false);
                await this.loadCalendars(); // Refresh list
                await this.loadDashboardData();
            } else {
                alert('Erro ao enviar solicitação.');
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
