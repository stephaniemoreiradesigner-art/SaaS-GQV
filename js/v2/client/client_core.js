// js/v2/client/client_core.js
// Núcleo do Portal do Cliente V2

(function(global) {
    const ClientCore = {
        currentClient: null,
        activeCalendarId: null,

        init: async function() {
            // 1. Check Auth & Init Supabase Isolated
            if (!global.ClientAuth) {
                console.error('[ClientCore] Auth module missing');
                return;
            }

            // [ISOLATION] Ensure isolated client is ready
            await global.ClientAuth.init();

            const session = global.ClientAuth.checkSession();
            if (!session) {
                // Se não tiver sessão válida, redireciona para login do cliente
                window.location.href = '/v2/client/login.html';
                return;
            }
            this.currentClient = session;

            // 2. Init UI
            if (global.ClientUI) {
                global.ClientUI.init();
                global.ClientUI.updateUserInfo(this.currentClient);
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
            
            const posts = await global.ClientRepo.getPendingPosts(clientId);
            
            if (global.ClientUI) {
                global.ClientUI.renderPendingPostsList(posts);
            }
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
            
            const result = await global.ClientRepo.approvePost(this.activePostId);
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

            const result = await global.ClientRepo.rejectPost(this.activePostId, reason);
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
            const result = await global.ClientRepo.approvePost(postId);
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
            const result = await global.ClientRepo.rejectPost(postId, reason);
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
            const posts = await global.ClientRepo.getCalendarPosts(calendarId);
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

            const success = await global.ClientRepo.approveCalendar(this.activeCalendarId);
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

            const success = await global.ClientRepo.rejectCalendar(this.activeCalendarId, comment);
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
