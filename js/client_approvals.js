(() => {
    const statusLabels = {
        draft: 'Rascunho',
        briefing_sent: 'Briefing enviado',
        design_in_progress: 'Em criação',
        ready_for_approval: 'Pendente',
        approved: 'Aprovado',
        rejected: 'Reprovado',
        scheduled: 'Agendado',
        published: 'Publicado'
    };

    const statusClasses = {
        draft: 'bg-gray-100 text-gray-600',
        briefing_sent: 'bg-blue-100 text-blue-700',
        design_in_progress: 'bg-purple-100 text-purple-700',
        ready_for_approval: 'bg-yellow-100 text-yellow-700',
        approved: 'bg-green-100 text-green-700',
        rejected: 'bg-orange-100 text-orange-700',
        scheduled: 'bg-indigo-100 text-indigo-700',
        published: 'bg-emerald-100 text-emerald-700'
    };

    const state = {
        posts: [],
        current: null,
        history: null,
        currentVersion: null
    };

    const getSessionOrRedirect = async () => {
        const supabase = await window.clientSession?.getSupabaseClient?.();
        if (!supabase) {
            window.location.href = 'client_login.html';
            return null;
        }
        const sessionResult = await supabase.auth.getSession();
        const session = sessionResult?.data?.session || null;
        if (!session?.access_token) {
            window.location.href = 'client_login.html';
            return null;
        }
        return session;
    };

    const getAuthHeaders = async () => {
        const session = await getSessionOrRedirect();
        if (!session) return null;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`
        };
    };

    const fetchJson = async (url, options = {}) => {
        const res = await fetch(url, options);
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) {
            const message = data?.error || data?.message || 'Erro ao carregar dados';
            throw new Error(message);
        }
        return data;
    };

    const setBadge = (el, status) => {
        const label = statusLabels[status] || status;
        const cls = statusClasses[status] || 'bg-gray-100 text-gray-600';
        el.className = `inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium ${cls}`;
        el.textContent = label;
    };

    const getDisplayData = (post) => ({
        title: post?.tema || post?.titulo || 'Sem título',
        caption: post?.legenda || 'Sem legenda',
        previewUrl: post?.media_url || ''
    });

    const renderEmpty = (visible) => {
        const emptyEl = document.getElementById('client-approvals-empty');
        if (!emptyEl) return;
        if (visible) emptyEl.classList.remove('hidden');
        else emptyEl.classList.add('hidden');
    };

    const renderList = () => {
        const listEl = document.getElementById('client-approvals-list');
        if (!listEl) return;
        listEl.innerHTML = '';
        if (!state.posts.length) {
            renderEmpty(true);
            return;
        }
        renderEmpty(false);
        state.posts.forEach((post) => {
            const display = getDisplayData(post);
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition cursor-pointer text-left';
            card.addEventListener('click', () => openModal(post));

            const preview = display.previewUrl
                ? `<img src="${display.previewUrl}" class="w-20 h-20 rounded-lg object-cover border border-gray-200" alt="Preview">`
                : `<div class="w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">Sem mídia</div>`;
            const caption = display.caption;

            card.innerHTML = `
                <div class="flex gap-4">
                    <div class="flex-shrink-0">${preview}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3">
                            <h3 class="text-base font-semibold text-gray-800 truncate">${display.title}</h3>
                            <span class="approval-status-badge"></span>
                        </div>
                        <p class="text-sm text-gray-500 line-clamp-2 mt-1">${caption}</p>
                    </div>
                </div>
            `;
            const badge = card.querySelector('.approval-status-badge');
            if (badge) setBadge(badge, post.status);
            listEl.appendChild(card);
        });
    };

    const openModal = async (post) => {
        const modal = document.getElementById('client-approval-modal');
        if (!modal) return;
        state.current = post;
        state.history = null;
        state.currentVersion = null;
        const display = getDisplayData(post);

        const titleEl = document.getElementById('client-approval-title');
        const statusEl = document.getElementById('client-approval-status');
        const previewEl = document.getElementById('client-approval-preview');
        const mediaEl = document.getElementById('client-approval-media');
        const captionEl = document.getElementById('client-approval-caption');
        const approvalsEl = document.getElementById('client-approval-audit-approvals');
        const versionsEl = document.getElementById('client-approval-audit-versions');
        const commentsEl = document.getElementById('client-approval-audit-comments');
        const commentInput = document.getElementById('client-approval-comment-input');
        const approveBtn = document.getElementById('client-approval-approve');
        const changesBtn = document.getElementById('client-approval-changes');
        const versionEl = document.getElementById('client-approval-version');
        const submitBtn = document.getElementById('client-approval-submit');

        if (titleEl) titleEl.textContent = display.title;
        if (statusEl) setBadge(statusEl, post.status);
        if (previewEl) {
            if (display.previewUrl) {
                previewEl.href = display.previewUrl;
                previewEl.classList.remove('hidden');
            } else {
                previewEl.classList.add('hidden');
            }
        }
        if (mediaEl) {
            if (display.previewUrl) {
                const isVideo = String(display.previewUrl).match(/\.(mp4|mov|webm)$/i) || String(display.previewUrl).includes('video');
                mediaEl.innerHTML = isVideo
                    ? `<video src="${display.previewUrl}" class="w-full h-full object-cover bg-black" controls></video>`
                    : `<img src="${display.previewUrl}" class="w-full h-full object-cover" alt="Preview">`;
                mediaEl.classList.remove('hidden');
            } else {
                mediaEl.innerHTML = 'Sem mídia disponível';
                mediaEl.classList.remove('hidden');
            }
        }
        if (captionEl) captionEl.textContent = display.caption;
        if (commentInput) commentInput.value = '';
        if (approvalsEl) approvalsEl.innerHTML = '<div class="text-sm text-gray-400">Carregando...</div>';
        if (versionsEl) versionsEl.innerHTML = '<div class="text-sm text-gray-400">Carregando...</div>';
        if (commentsEl) commentsEl.innerHTML = '<div class="text-sm text-gray-400">Carregando...</div>';
        if (versionEl) versionEl.textContent = '-';
        if (approveBtn) approveBtn.disabled = post.status !== 'ready_for_approval';
        if (changesBtn) changesBtn.disabled = post.status !== 'ready_for_approval';
        if (submitBtn) submitBtn.disabled = false;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        await loadHistory();
    };

    const closeModal = () => {
        const modal = document.getElementById('client-approval-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        state.current = null;
        state.history = null;
        state.currentVersion = null;
    };

    const showSnapshot = (snapshot) => {
        let modal = document.getElementById('client-approval-snapshot-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'client-approval-snapshot-modal';
            modal.className = 'fixed inset-0 bg-black/40 hidden items-center justify-center z-50 p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <h3 class="text-lg font-semibold text-gray-900">Snapshot da versão</h3>
                        <button id="client-approval-snapshot-close" class="text-gray-400 hover:text-gray-600 transition">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <div class="p-6 overflow-y-auto">
                        <pre id="client-approval-snapshot-content" class="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-4"></pre>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            const closeBtn = modal.querySelector('#client-approval-snapshot-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                });
            }
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.classList.add('hidden');
                    modal.classList.remove('flex');
                }
            });
        }
        const content = modal.querySelector('#client-approval-snapshot-content');
        if (content) content.textContent = JSON.stringify(snapshot || {}, null, 2);
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    const renderAudit = () => {
        const approvalsEl = document.getElementById('client-approval-audit-approvals');
        const versionsEl = document.getElementById('client-approval-audit-versions');
        const commentsEl = document.getElementById('client-approval-audit-comments');
        if (approvalsEl) approvalsEl.innerHTML = '';
        if (versionsEl) versionsEl.innerHTML = '';
        if (commentsEl) commentsEl.innerHTML = '';

        const approvals = Array.isArray(state.history?.approvals) ? state.history.approvals : [];
        const comments = Array.isArray(state.history?.comments) ? state.history.comments : [];
        const versions = Array.isArray(state.history?.versions) ? state.history.versions : [];

        if (approvalsEl) {
            if (!approvals.length) {
                approvalsEl.innerHTML = '<div class="text-sm text-gray-400">Nenhuma decisão ainda.</div>';
            } else {
                approvals.forEach((item) => {
                    const wrap = document.createElement('div');
                    wrap.className = 'border border-gray-100 rounded-lg p-3';
                    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '';
                    const statusLabel = item.status === 'approved'
                        ? 'Aprovado'
                        : item.status === 'needs_revision'
                            ? 'Solicitou ajustes'
                            : 'Reprovado';
                    const meta = document.createElement('div');
                    meta.className = 'text-xs text-gray-400 mb-1';
                    meta.textContent = `${statusLabel}${createdAt ? ` • ${createdAt}` : ''}`;
                    const body = document.createElement('div');
                    body.className = 'text-sm text-gray-700 whitespace-pre-wrap';
                    body.textContent = item.decision_comment || '';
                    wrap.appendChild(meta);
                    wrap.appendChild(body);
                    approvalsEl.appendChild(wrap);
                });
            }
        }

        if (versionsEl) {
            if (!versions.length) {
                versionsEl.innerHTML = '<div class="text-sm text-gray-400">Nenhuma versão registrada.</div>';
            } else {
                versions.forEach((item) => {
                    const wrap = document.createElement('div');
                    wrap.className = 'border border-gray-100 rounded-lg p-3 flex items-center justify-between gap-3';
                    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '';
                    const meta = document.createElement('div');
                    meta.className = 'text-sm text-gray-700';
                    meta.textContent = `Versão #${item.version_number || '-'}${createdAt ? ` • ${createdAt}` : ''}`;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'px-3 py-1.5 text-xs rounded-lg bg-gray-900 text-white hover:bg-gray-800 transition';
                    btn.textContent = 'Ver snapshot';
                    btn.addEventListener('click', () => showSnapshot(item.snapshot_json));
                    wrap.appendChild(meta);
                    wrap.appendChild(btn);
                    versionsEl.appendChild(wrap);
                });
            }
        }

        if (commentsEl) {
            if (!comments.length) {
                commentsEl.innerHTML = '<div class="text-sm text-gray-400">Nenhum comentário ainda.</div>';
            } else {
                comments.forEach((item) => {
                    const wrap = document.createElement('div');
                    wrap.className = 'border border-gray-100 rounded-lg p-3';
                    const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '';
                    const typeLabel = item.comment_type === 'decision'
                        ? 'Decisão'
                        : item.comment_type === 'system'
                            ? 'Sistema'
                            : 'Comentário';
                    const meta = document.createElement('div');
                    meta.className = 'text-xs text-gray-400 mb-1';
                    meta.textContent = `${typeLabel}${createdAt ? ` • ${createdAt}` : ''}`;
                    const body = document.createElement('div');
                    body.className = 'text-sm text-gray-700 whitespace-pre-wrap';
                    body.textContent = item.body || '';
                    wrap.appendChild(meta);
                    wrap.appendChild(body);
                    commentsEl.appendChild(wrap);
                });
            }
        }
    };

    const updatePostInState = (updated) => {
        state.posts = state.posts.map((item) => (item.id === updated.id ? { ...item, ...updated } : item));
        if (state.current && state.current.id === updated.id) {
            state.current = { ...state.current, ...updated };
        }
    };

    const loadHistory = async () => {
        if (!state.current) return null;
        try {
            const headers = await getAuthHeaders();
            if (!headers) return null;
            const data = await fetchJson(`${window.API_BASE_URL}/api/social/posts/${state.current.id}/audit`, { headers });
            state.history = data || null;
            const versions = Array.isArray(data?.versions) ? data.versions : [];
            state.currentVersion = versions.length ? versions[0] : null;
            const versionEl = document.getElementById('client-approval-version');
            if (versionEl) {
                const versionNumber = state.currentVersion?.version_number;
                versionEl.textContent = versionNumber ? `#${versionNumber}` : 'Nenhuma versão';
            }
            renderAudit();
            return data;
        } catch (error) {
            renderAudit();
            return null;
        }
    };

    const handleStatusChange = async (status) => {
        if (!state.current) return;
        if (!state.currentVersion?.id) {
            alert('Envie para aprovação antes de aprovar ou reprovar.');
            return;
        }
        try {
            const headers = await getAuthHeaders();
            if (!headers) return;
            const commentInput = document.getElementById('client-approval-comment-input');
            const comment = commentInput?.value.trim() || '';
            const endpoint = status === 'approved'
                ? `${window.API_BASE_URL}/api/social/posts/${state.current.id}/approve`
                : `${window.API_BASE_URL}/api/social/posts/${state.current.id}/reject`;
            const body = status === 'approved'
                ? { version_id: state.currentVersion.id, comment: comment || null }
                : { version_id: state.currentVersion.id, comment, requested_changes: [] };
            if (status === 'rejected' && !comment) {
                alert('Escreva um comentário para solicitar ajustes.');
                return;
            }
            await fetchJson(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            if (commentInput) commentInput.value = '';
            updatePostInState({ id: state.current.id, status });
            const statusEl = document.getElementById('client-approval-status');
            if (statusEl) setBadge(statusEl, status);
            const approveBtn = document.getElementById('client-approval-approve');
            const changesBtn = document.getElementById('client-approval-changes');
            if (approveBtn) approveBtn.disabled = status !== 'ready_for_approval';
            if (changesBtn) changesBtn.disabled = status !== 'ready_for_approval';
            if (status !== 'ready_for_approval') {
                state.posts = state.posts.filter((item) => item.id !== state.current.id);
            }
            await loadHistory();
            renderList();
        } catch (error) {
            alert('Não foi possível atualizar o status.');
        }
    };

    const handleSubmitForApproval = async () => {
        if (!state.current) return;
        try {
            const headers = await getAuthHeaders();
            if (!headers) return;
            const data = await fetchJson(`${window.API_BASE_URL}/api/social/posts/${state.current.id}/submit-for-approval`, {
                method: 'POST',
                headers
            });
            const post = data?.post || null;
            const version = data?.version || null;
            if (post) updatePostInState(post);
            state.currentVersion = version || state.currentVersion;
            const versionEl = document.getElementById('client-approval-version');
            if (versionEl) {
                const versionNumber = state.currentVersion?.version_number;
                versionEl.textContent = versionNumber ? `#${versionNumber}` : 'Nenhuma versão';
            }
            const statusEl = document.getElementById('client-approval-status');
            if (statusEl && post?.status) setBadge(statusEl, post.status);
            const approveBtn = document.getElementById('client-approval-approve');
            const changesBtn = document.getElementById('client-approval-changes');
            if (approveBtn) approveBtn.disabled = post?.status !== 'ready_for_approval';
            if (changesBtn) changesBtn.disabled = post?.status !== 'ready_for_approval';
            await loadHistory();
            renderList();
        } catch (error) {
            alert('Não foi possível enviar para aprovação.');
        }
    };

    const handleComment = async () => {
        if (!state.current) return;
        const input = document.getElementById('client-approval-comment-input');
        if (!input) return;
        const comment = input.value.trim();
        if (!comment) return;
        try {
            const headers = await getAuthHeaders();
            if (!headers) return;
            const payload = {
                comment_type: 'comment',
                body: comment,
                target_json: { source: 'client' }
            };
            const data = await fetchJson(`${window.API_BASE_URL}/api/social/posts/${state.current.id}/comments`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload)
            });
            input.value = '';
            if (data) {
                const existing = Array.isArray(state.history?.comments) ? state.history.comments : [];
                const updated = [data, ...existing];
                state.history = { ...(state.history || {}), comments: updated };
                renderAudit();
            }
        } catch (error) {
            alert('Não foi possível enviar o comentário.');
        }
    };

    const bindModalActions = () => {
        const closeBtn = document.getElementById('client-approval-close');
        const modal = document.getElementById('client-approval-modal');
        const approveBtn = document.getElementById('client-approval-approve');
        const changesBtn = document.getElementById('client-approval-changes');
        const commentBtn = document.getElementById('client-approval-comment-btn');
        const submitBtn = document.getElementById('client-approval-submit');

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });
        if (approveBtn) approveBtn.addEventListener('click', () => handleStatusChange('approved'));
        if (changesBtn) changesBtn.addEventListener('click', () => handleStatusChange('rejected'));
        if (commentBtn) commentBtn.addEventListener('click', handleComment);
        if (submitBtn) submitBtn.addEventListener('click', handleSubmitForApproval);
    };

    const loadApprovals = async () => {
        const listEl = document.getElementById('client-approvals-list');
        if (listEl) listEl.innerHTML = '<div class="text-sm text-gray-400 text-center py-8">Carregando aprovações...</div>';
        try {
            const headers = await getAuthHeaders();
            if (!headers) return;
            const data = await fetchJson(`${window.API_BASE_URL}/api/client/social/pending-posts`, { headers });
            const posts = Array.isArray(data?.items) ? data.items : [];
            state.posts = posts;
            renderList();
        } catch (error) {
            if (listEl) listEl.innerHTML = '<div class="text-sm text-gray-400 text-center py-8">Erro ao carregar aprovações.</div>';
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        bindModalActions();
        loadApprovals();
    });
})();
