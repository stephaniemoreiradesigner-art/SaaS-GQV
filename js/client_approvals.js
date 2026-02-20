(() => {
    const statusLabels = {
        pending: 'Pendente',
        approved: 'Aprovado',
        changes_requested: 'Ajustes solicitados'
    };

    const statusClasses = {
        pending: 'bg-yellow-100 text-yellow-700',
        approved: 'bg-green-100 text-green-700',
        changes_requested: 'bg-orange-100 text-orange-700'
    };

    const state = {
        approvals: [],
        current: null
    };

    const getTypeFromPage = () => {
        const path = (window.location.pathname || '').toLowerCase();
        if (path.includes('posts')) return 'post';
        if (path.includes('calendar')) return 'calendar';
        return null;
    };

    const getSessionOrRedirect = async () => {
        const supabase = await window.clientApp?.getSupabaseClient?.();
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
        if (!state.approvals.length) {
            renderEmpty(true);
            return;
        }
        renderEmpty(false);
        state.approvals.forEach((approval) => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition cursor-pointer text-left';
            card.addEventListener('click', () => openModal(approval));

            const preview = approval.preview_url
                ? `<img src="${approval.preview_url}" class="w-20 h-20 rounded-lg object-cover border border-gray-200" alt="Preview">`
                : `<div class="w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">Sem mídia</div>`;
            const caption = approval.caption ? approval.caption : 'Sem legenda';

            card.innerHTML = `
                <div class="flex gap-4">
                    <div class="flex-shrink-0">${preview}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-start justify-between gap-3">
                            <h3 class="text-base font-semibold text-gray-800 truncate">${approval.title || 'Sem título'}</h3>
                            <span class="approval-status-badge"></span>
                        </div>
                        <p class="text-sm text-gray-500 line-clamp-2 mt-1">${caption}</p>
                    </div>
                </div>
            `;
            const badge = card.querySelector('.approval-status-badge');
            if (badge) setBadge(badge, approval.status);
            listEl.appendChild(card);
        });
    };

    const openModal = async (approval) => {
        const modal = document.getElementById('client-approval-modal');
        if (!modal) return;
        state.current = approval;

        const titleEl = document.getElementById('client-approval-title');
        const statusEl = document.getElementById('client-approval-status');
        const previewEl = document.getElementById('client-approval-preview');
        const mediaEl = document.getElementById('client-approval-media');
        const captionEl = document.getElementById('client-approval-caption');
        const commentsEl = document.getElementById('client-approval-comments');
        const commentInput = document.getElementById('client-approval-comment-input');
        const approveBtn = document.getElementById('client-approval-approve');
        const changesBtn = document.getElementById('client-approval-changes');

        if (titleEl) titleEl.textContent = approval.title || 'Sem título';
        if (statusEl) setBadge(statusEl, approval.status);
        if (previewEl) {
            if (approval.preview_url) {
                previewEl.href = approval.preview_url;
                previewEl.classList.remove('hidden');
            } else {
                previewEl.classList.add('hidden');
            }
        }
        if (mediaEl) {
            if (approval.preview_url) {
                const isVideo = String(approval.preview_url).match(/\.(mp4|mov|webm)$/i) || String(approval.preview_url).includes('video');
                mediaEl.innerHTML = isVideo
                    ? `<video src="${approval.preview_url}" class="w-full h-full object-cover bg-black" controls></video>`
                    : `<img src="${approval.preview_url}" class="w-full h-full object-cover" alt="Preview">`;
                mediaEl.classList.remove('hidden');
            } else {
                mediaEl.innerHTML = 'Sem mídia disponível';
                mediaEl.classList.remove('hidden');
            }
        }
        if (captionEl) captionEl.textContent = approval.caption || 'Sem legenda';
        if (commentInput) commentInput.value = '';
        if (commentsEl) commentsEl.innerHTML = '<div class="text-sm text-gray-400">Carregando comentários...</div>';
        if (approveBtn) approveBtn.disabled = approval.status !== 'pending';
        if (changesBtn) changesBtn.disabled = approval.status !== 'pending';

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        try {
            const headers = await getAuthHeaders();
            if (!headers) return;
            const data = await fetchJson(`/api/client/approvals/${approval.id}`, { headers });
            const comments = Array.isArray(data?.comments) ? data.comments : [];
            renderComments(comments);
        } catch (error) {
            renderComments([]);
        }
    };

    const closeModal = () => {
        const modal = document.getElementById('client-approval-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        state.current = null;
    };

    const renderComments = (comments) => {
        const commentsEl = document.getElementById('client-approval-comments');
        if (!commentsEl) return;
        commentsEl.innerHTML = '';
        if (!comments.length) {
            const empty = document.createElement('div');
            empty.className = 'text-sm text-gray-400';
            empty.textContent = 'Nenhum comentário ainda.';
            commentsEl.appendChild(empty);
            return;
        }
        comments.forEach((comment) => {
            const wrap = document.createElement('div');
            wrap.className = 'border border-gray-100 rounded-lg p-3';

            const meta = document.createElement('div');
            meta.className = 'text-xs text-gray-400 mb-1';
            const role = comment.author_role === 'team' ? 'Equipe' : 'Cliente';
            const createdAt = comment.created_at ? new Date(comment.created_at).toLocaleString('pt-BR') : '';
            meta.textContent = `${role}${createdAt ? ` • ${createdAt}` : ''}`;

            const body = document.createElement('div');
            body.className = 'text-sm text-gray-700 whitespace-pre-wrap';
            body.textContent = comment.comment || '';

            wrap.appendChild(meta);
            wrap.appendChild(body);
            commentsEl.appendChild(wrap);
        });
    };

    const updateApprovalInState = (updated) => {
        state.approvals = state.approvals.map((item) => (item.id === updated.id ? updated : item));
        if (state.current && state.current.id === updated.id) {
            state.current = updated;
        }
    };

    const handleStatusChange = async (status) => {
        if (!state.current) return;
        try {
            const headers = await getAuthHeaders();
            if (!headers) return;
            const data = await fetchJson(`/api/client/approvals/${state.current.id}/status`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ status })
            });
            updateApprovalInState(data);
            const statusEl = document.getElementById('client-approval-status');
            if (statusEl) setBadge(statusEl, data.status);
            const approveBtn = document.getElementById('client-approval-approve');
            const changesBtn = document.getElementById('client-approval-changes');
            if (approveBtn) approveBtn.disabled = data.status !== 'pending';
            if (changesBtn) changesBtn.disabled = data.status !== 'pending';
            renderList();
        } catch (error) {
            alert('Não foi possível atualizar o status.');
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
            const data = await fetchJson(`/api/client/approvals/${state.current.id}/comment`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ comment })
            });
            input.value = '';
            const commentsEl = document.getElementById('client-approval-comments');
            if (commentsEl && commentsEl.firstChild && commentsEl.firstChild.textContent === 'Nenhum comentário ainda.') {
                commentsEl.innerHTML = '';
            }
            const list = Array.isArray(data) ? data : [data];
            list.forEach((commentItem) => {
                const current = Array.from(commentsEl?.children || []);
                if (!current.length) {
                    renderComments([commentItem]);
                } else {
                    const wrap = document.createElement('div');
                    wrap.className = 'border border-gray-100 rounded-lg p-3';

                    const meta = document.createElement('div');
                    meta.className = 'text-xs text-gray-400 mb-1';
                    const createdAt = commentItem.created_at ? new Date(commentItem.created_at).toLocaleString('pt-BR') : '';
                    meta.textContent = `Cliente${createdAt ? ` • ${createdAt}` : ''}`;

                    const body = document.createElement('div');
                    body.className = 'text-sm text-gray-700 whitespace-pre-wrap';
                    body.textContent = commentItem.comment || comment;

                    wrap.appendChild(meta);
                    wrap.appendChild(body);
                    commentsEl?.appendChild(wrap);
                }
            });
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

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (modal) modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });
        if (approveBtn) approveBtn.addEventListener('click', () => handleStatusChange('approved'));
        if (changesBtn) changesBtn.addEventListener('click', () => handleStatusChange('changes_requested'));
        if (commentBtn) commentBtn.addEventListener('click', handleComment);
    };

    const loadApprovals = async () => {
        const type = getTypeFromPage();
        if (!type) return;
        const listEl = document.getElementById('client-approvals-list');
        if (listEl) listEl.innerHTML = '<div class="text-sm text-gray-400 text-center py-8">Carregando aprovações...</div>';
        try {
            const headers = await getAuthHeaders();
            if (!headers) return;
            const data = await fetchJson(`/api/client/approvals?type=${encodeURIComponent(type)}`, { headers });
            state.approvals = Array.isArray(data) ? data : [];
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
