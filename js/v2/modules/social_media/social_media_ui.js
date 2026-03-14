// js/v2/modules/social_media/social_media_ui.js
// Interface de Usuário do Módulo Social Media V2
// Adaptado para o layout de Drawer e Grid do index.html

(function(global) {
    const SocialMediaUI = {
        drawerId: 'social-post-drawer',

        isDebug: function() {
            return global.__GQV_DEBUG_CONTEXT__ === true;
        },
        
        init: function() {
            // Setup de listeners de UI (fechar drawer, tabs)
            this.setupDrawer();
            this.setupTabs();
            this.setupCalendarFab();
        },

        getSelectedMonthKey: function(clientId) {
            const safeClientId = clientId ? String(clientId) : '';
            if (!safeClientId) {
                return new Date().toISOString().slice(0, 7);
            }
            const stored = localStorage.getItem(`GQV_SOCIAL_MONTH_${safeClientId}`);
            const monthKey = String(stored || '').trim();
            if (/^\d{4}-\d{2}$/.test(monthKey)) {
                return monthKey;
            }
            return new Date().toISOString().slice(0, 7);
        },

        getMonthStartEnd: function(monthKey) {
            const base = new Date(`${monthKey}-01T00:00:00`);
            if (Number.isNaN(base.getTime())) {
                const fallback = new Date();
                const fallbackKey = fallback.toISOString().slice(0, 7);
                return this.getMonthStartEnd(fallbackKey);
            }
            const startDate = `${monthKey}-01`;
            const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
            const endDate = end.toISOString().slice(0, 10);
            return { startDate, endDate, dateRef: base };
        },

        isTabActive: function(tabName) {
            const btn = document.querySelector(`.social-tab-btn[data-social-tab="${tabName}"]`);
            return btn ? btn.getAttribute('data-active') === 'true' : false;
        },

        refreshPostsBoardFromRepo: async function() {
            const clientId = global.ClientContext?.getActiveClient?.() || global.SocialMediaCore?.currentClientId || null;
            if (!clientId) {
                this.renderPostsBoard([], new Date());
                return;
            }

            const monthKey = this.getSelectedMonthKey(clientId);
            const { startDate, endDate, dateRef } = this.getMonthStartEnd(monthKey);
            const posts = await global.SocialMediaRepo?.getPostsByDateRange?.(clientId, startDate, endDate);
            const safePosts = Array.isArray(posts) ? posts : [];

            if (this.isDebug()) {
                const statuses = safePosts.map((p) => String(p?.status ?? '')).filter(Boolean);
                const uniqueStatuses = Array.from(new Set(statuses)).sort();
                console.log('[SocialMediaPosts] fetched posts:', {
                    clientId,
                    monthKey,
                    startDate,
                    endDate,
                    total: safePosts.length
                });
                console.log('[SocialMediaPosts] fetched statuses:', uniqueStatuses);
            }

            if (global.SocialMediaCore) {
                global.SocialMediaCore.currentPosts = safePosts;
                global.SocialMediaCore.currentMonthRef = dateRef;
            }

            this.renderPostsBoard(safePosts, dateRef);
        },

        setupDrawer: function() {
            const closeBtn = document.getElementById('social-post-close');
            const cancelBtn = document.getElementById('social-post-cancel');
            const drawer = document.getElementById(this.drawerId);
            
            // Upload Input Listener
            const uploadInput = document.getElementById('social-post-media-upload');
            if (uploadInput) {
                uploadInput.addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    const container = document.getElementById('social-post-media-preview');
                    if (!container) return;

                    const img = document.getElementById('social-post-media-image');
                    const video = document.getElementById('social-post-media-video');
                    const meta = document.getElementById('social-post-media-meta');

                    let placeholder = document.getElementById('social-post-media-placeholder');
                    if (!placeholder) {
                        placeholder = document.createElement('div');
                        placeholder.id = 'social-post-media-placeholder';
                        placeholder.className = 'hidden text-slate-400 flex flex-col items-center justify-center min-h-[180px]';
                        placeholder.innerHTML = '<i class="fas fa-image text-3xl mb-2"></i><span class="text-sm">Sem mídia</span>';
                        container.prepend(placeholder);
                    }

                    const clearPreview = () => {
                        if (img) {
                            img.src = '';
                            img.classList.add('hidden');
                        }
                        if (video) {
                            video.pause?.();
                            video.src = '';
                            video.classList.add('hidden');
                        }
                        if (meta) meta.textContent = '';
                        placeholder.classList.remove('hidden');
                        container.dataset.mediaUrl = '';
                        const objectUrl = String(container.dataset.mediaObjectUrl || '').trim();
                        if (objectUrl) {
                            URL.revokeObjectURL(objectUrl);
                            container.dataset.mediaObjectUrl = '';
                        }
                    };

                    if (!file) {
                        container.classList.remove('hidden');
                        clearPreview();
                        return;
                    }

                    container.classList.remove('hidden');
                    placeholder.classList.add('hidden');
                    if (meta) meta.textContent = `${file.name || 'Arquivo'}${file.size ? ` • ${Math.ceil(file.size / 1024)} KB` : ''}`;

                    const localUrl = URL.createObjectURL(file);
                    container.dataset.mediaUrl = localUrl;
                    container.dataset.mediaObjectUrl = localUrl;

                    if (file.type && file.type.startsWith('video/')) {
                        if (video) {
                            video.src = localUrl;
                            video.classList.remove('hidden');
                        }
                        if (img) img.classList.add('hidden');
                    } else {
                        if (img) {
                            img.src = localUrl;
                            img.classList.remove('hidden');
                        }
                        if (video) video.classList.add('hidden');
                    }

                    const clientId = global.SocialMediaCore ? global.SocialMediaCore.currentClientId : null;
                    if (!global.SocialMediaUpload || !clientId) return;

                    const uploadedUrl = await global.SocialMediaUpload.uploadFile(file, clientId);
                    if (!uploadedUrl) return;

                    container.dataset.mediaUrl = uploadedUrl;
                    const objectUrl = String(container.dataset.mediaObjectUrl || '').trim();
                    if (objectUrl) {
                        URL.revokeObjectURL(objectUrl);
                        container.dataset.mediaObjectUrl = '';
                    }

                    if (video && !video.classList.contains('hidden')) video.src = uploadedUrl;
                    if (img && !img.classList.contains('hidden')) img.src = uploadedUrl;
                });
            }

            const closeHandler = () => {
                drawer.classList.add('hidden');
                drawer.classList.remove('flex');
            };

            if (closeBtn) closeBtn.addEventListener('click', closeHandler);
            if (cancelBtn) cancelBtn.addEventListener('click', closeHandler);
        },

        setupTabs: function() {
            const tabs = document.querySelectorAll('.social-tab-btn');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabName = tab.dataset.socialTab;
                    tabs.forEach(t => t.setAttribute('data-active', t.dataset.socialTab === tabName ? 'true' : 'false'));
                    document.querySelectorAll('.social-tab').forEach(c => c.classList.add('hidden'));
                    const target = document.getElementById(`social-tab-${tabName}`);
                    if (target) target.classList.remove('hidden');

                    const fab = document.getElementById('social-calendar-fab');
                    if (fab) fab.classList.toggle('hidden', tabName !== 'calendar');

                    if (tabName === 'posts' && typeof this.renderPostsBoard === 'function') {
                        this.refreshPostsBoardFromRepo();
                    }
                });
            });

            const prevBtn = document.getElementById('social-month-prev');
            const nextBtn = document.getElementById('social-month-next');
            const scheduleRefresh = () => {
                if (!this.isTabActive('posts')) return;
                setTimeout(() => this.refreshPostsBoardFromRepo(), 100);
            };
            if (prevBtn) prevBtn.addEventListener('click', scheduleRefresh);
            if (nextBtn) nextBtn.addEventListener('click', scheduleRefresh);
        },

        normalizeStatus: function(raw) {
            const rawStatus = String(raw || '').trim().toLowerCase();
            const normalized = global.GQV_CONSTANTS?.SOCIAL_STATUS_MAP?.[rawStatus] || rawStatus;
            if (['rascunho', 'draft'].includes(normalized)) return 'draft';
            if (['ready_for_review', 'in_production', 'em_producao', 'em_produção', 'producing', 'design', 'design_in_progress', 'briefing_sent'].includes(normalized)) return 'ready_for_review';
            if (['ready_for_approval', 'awaiting_approval', 'aguardando_aprovacao', 'pendente_aprovacao', 'pendente_aprovação', 'pending_approval'].includes(normalized)) return 'ready_for_approval';
            if (['changes_requested', 'needs_revision', 'ajuste_solicitado', 'rejected', 'rejeitado'].includes(normalized)) return 'changes_requested';
            if (['approved', 'aprovado'].includes(normalized)) return 'approved';
            if (['scheduled', 'agendado'].includes(normalized)) return 'scheduled';
            if (['published', 'publicado'].includes(normalized)) return 'published';
            return 'draft';
        },

        isPostEditable: function(rawStatus) {
            const normalized = this.normalizeStatus(rawStatus);
            return !['ready_for_approval', 'approved', 'scheduled', 'published'].includes(normalized);
        },

        getStatusBadgeInfo: function(raw) {
            const rawStatus = String(raw || '').trim().toLowerCase();
            const normalized = global.GQV_CONSTANTS?.SOCIAL_STATUS_MAP?.[rawStatus] || rawStatus;

            const base = 'text-xs uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full';
            const map = {
                draft: { label: 'Rascunho', className: base },
                briefing_sent: { label: 'Em produção', className: `${base} bg-blue-100 text-blue-700` },
                design_in_progress: { label: 'Em produção', className: `${base} bg-blue-100 text-blue-700` },
                in_production: { label: 'Em produção', className: `${base} bg-blue-100 text-blue-700` },
                producing: { label: 'Em produção', className: `${base} bg-blue-100 text-blue-700` },
                ready_for_review: { label: 'Pronto para revisão', className: `${base} bg-indigo-100 text-indigo-700` },
                ready_for_approval: { label: 'Enviado para aprovação', className: `${base} bg-yellow-100 text-yellow-700` },
                awaiting_approval: { label: 'Enviado para aprovação', className: `${base} bg-yellow-100 text-yellow-700` },
                approved: { label: 'Aprovado', className: `${base} bg-green-100 text-green-700` },
                changes_requested: { label: 'Ajustes solicitados', className: `${base} bg-red-100 text-red-700` },
                rejected: { label: 'Ajustes solicitados', className: `${base} bg-red-100 text-red-700` },
                scheduled: { label: 'Agendado', className: `${base} bg-indigo-100 text-indigo-700` },
                published: { label: 'Publicado', className: `${base} bg-emerald-100 text-emerald-700` },
                archived: { label: 'Arquivado', className: `${base} bg-slate-200 text-slate-700` }
            };

            if (map[normalized]) return map[normalized];
            return { label: normalized ? normalized.replace(/_/g, ' ') : '-', className: base };
        },

        getDecisionLabel: function(decision) {
            const key = String(decision || '').trim().toLowerCase();
            if (key === 'approved') return 'Aprovado';
            if (key === 'changes_requested') return 'Ajustes solicitados';
            if (key === 'needs_revision') return 'Ajustes solicitados';
            if (key === 'rejected') return 'Ajustes solicitados';
            if (key === 'resubmitted') return 'Reenviado para aprovação';
            return key || 'Decisão';
        },

        renderPostAuditPanel: function(post, events) {
            const panel = document.getElementById('social-post-audit-panel');
            if (!panel) return;

            const badgeEl = document.getElementById('social-post-status-badge');
            const badgeTopEl = document.getElementById('social-post-status-badge-top');
            const historyEl = document.getElementById('social-post-history');
            const lastDecisionEl = document.getElementById('social-post-last-decision');

            const isEdit = !!(post && post.id);
            panel.classList.toggle('hidden', !isEdit);
            if (!isEdit) return;

            const badge = this.getStatusBadgeInfo(post?.status);
            if (badgeEl) {
                badgeEl.textContent = badge.label;
                badgeEl.className = badge.className;
            }
            if (badgeTopEl) {
                badgeTopEl.textContent = badge.label;
                badgeTopEl.className = badge.className;
            }

            const list = Array.isArray(events) ? events : [];
            const lastDecisionEvent = list[0] || null;
            const fallbackComment = String(post?.comentario_cliente || '').trim();
            const lastComment = String(lastDecisionEvent?.comment || '').trim() || fallbackComment;

            if (lastDecisionEl) {
                if (lastDecisionEvent && lastComment) {
                    lastDecisionEl.textContent = `Última decisão: ${lastComment}`;
                    lastDecisionEl.classList.remove('hidden');
                } else {
                    lastDecisionEl.textContent = '';
                    lastDecisionEl.classList.add('hidden');
                }
            }

            if (!historyEl) return;
            historyEl.innerHTML = '';

            if (!list.length) {
                const empty = document.createElement('div');
                empty.className = 'text-sm text-slate-400';
                empty.textContent = 'Nenhum evento ainda.';
                historyEl.appendChild(empty);
                return;
            }

            list.slice(0, 12).forEach((item) => {
                const row = document.createElement('div');
                row.className = 'flex items-start gap-3';

                const rail = document.createElement('div');
                rail.className = 'flex flex-col items-center';
                rail.innerHTML = `
                    <div class="w-2.5 h-2.5 rounded-full bg-slate-400 mt-1"></div>
                    <div class="w-px flex-1 bg-slate-200 mt-2"></div>
                `;

                const wrap = document.createElement('div');
                wrap.className = 'flex-1 rounded-lg border border-slate-200 bg-white p-3';

                const decidedAt = item?.decided_at ? new Date(item.decided_at).toLocaleString('pt-BR') : '';
                const actor = String(item?.decided_by || '').trim();
                const actorShort = actor ? actor.slice(0, 8) : '';
                const decisionLabel = this.getDecisionLabel(item?.decision);

                const meta = document.createElement('div');
                meta.className = 'text-xs text-slate-400';
                meta.textContent = `${decisionLabel}${decidedAt ? ` • ${decidedAt}` : ''}${actorShort ? ` • ${actorShort}` : ''}`;

                const comment = String(item?.comment || '').trim();
                const commentEl = document.createElement('div');
                commentEl.className = 'text-sm text-slate-600 mt-2';
                commentEl.textContent = comment;
                if (!comment) commentEl.classList.add('hidden');

                wrap.appendChild(meta);
                wrap.appendChild(commentEl);

                row.appendChild(rail);
                row.appendChild(wrap);
                historyEl.appendChild(row);
            });
        },

        refreshPostAuditPanel: async function(post) {
            if (!post || !post.id) return;
            const historyEl = document.getElementById('social-post-history');
            if (historyEl) {
                historyEl.innerHTML = '';
                const loading = document.createElement('div');
                loading.className = 'text-sm text-slate-400';
                loading.textContent = 'Carregando histórico...';
                historyEl.appendChild(loading);
            }

            try {
                const events = await global.SocialMediaRepo?.getPostAuditEvents?.(String(post.id));
                this.renderPostAuditPanel(post, events);
            } catch (err) {
                if (historyEl) {
                    historyEl.innerHTML = '';
                    const msg = document.createElement('div');
                    msg.className = 'text-sm text-slate-400';
                    msg.textContent = 'Não foi possível carregar o histórico.';
                    historyEl.appendChild(msg);
                }
            }
        },

        getFormatInfo: function(post) {
            const raw = String(post?.formato || post?.content_type || post?.tipo || '').trim().toLowerCase();
            if (raw.includes('carrossel')) return { label: 'Carrossel', key: 'carrossel', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' };
            if (raw.includes('reels') || raw.includes('video') || raw.includes('vídeo')) return { label: 'Vídeo', key: 'video', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
            return { label: 'Imagem', key: 'imagem', color: 'bg-slate-50 text-slate-700 border-slate-100' };
        },

        getPostTitle: function(post) {
            return post?.tema || post?.titulo || post?.title || 'Post';
        },

        getPostDate: function(post) {
            const raw = post?.data_agendada || post?.data_postagem || post?.post_date || post?.date || '';
            const date = String(raw).slice(0, 10);
            return date;
        },

        getPostMediaUrl: function(post) {
            return post?.imagem_url || post?.media_url || post?.imagemUrl || post?.mediaUrl || post?.image_url || post?.url_midia || '';
        },

        getPostChannelLabel: function(post) {
            const value = (Array.isArray(post?.plataformas) && post.plataformas[0])
                ? post.plataformas[0]
                : (post?.plataforma || post?.platform || post?.channel || '');
            const raw = String(value || '').trim();
            if (raw) return raw;
            if (post?.instagram) return 'instagram';
            if (post?.facebook) return 'facebook';
            if (post?.linkedin) return 'linkedin';
            if (post?.tiktok) return 'tiktok';
            return '-';
        },

        renderPostsBoard: function(posts, monthRef) {
            const board = document.getElementById('social-posts-board');
            if (!board) return;

            const ref = monthRef instanceof Date ? monthRef : new Date();
            const monthKey = ref.toISOString().slice(0, 7);

            const columns = [
                { key: 'draft', label: 'Rascunhos' },
                { key: 'internal_review', label: 'Revisão interna' },
                { key: 'awaiting_approval', label: 'Aguardando aprovação' },
                { key: 'approved', label: 'Aprovados' },
                { key: 'published', label: 'Publicados' }
            ];

            const grouped = {};
            columns.forEach(c => { grouped[c.key] = []; });

            (posts || []).forEach((post) => {
                const status = this.normalizeStatus(post?.status);
                const dateStr = this.getPostDate(post);
                const bucket = (() => {
                    if (status === 'draft') return 'draft';
                    if (status === 'ready_for_review' || status === 'changes_requested') return 'internal_review';
                    if (status === 'ready_for_approval') return 'awaiting_approval';
                    if (status === 'approved' || status === 'scheduled') return 'approved';
                    if (status === 'published') return 'published';
                    return 'draft';
                })();

                if (bucket === 'approved' && dateStr && String(dateStr).slice(0, 7) !== monthKey) {
                    return;
                }
                grouped[bucket].push(post);
            });

            if (this.isDebug()) {
                const rawStatuses = (posts || []).map((p) => String(p?.status ?? '')).filter(Boolean);
                const uniqueRawStatuses = Array.from(new Set(rawStatuses)).sort();
                const groupedCounts = Object.keys(grouped).reduce((acc, key) => {
                    acc[key] = grouped[key]?.length || 0;
                    return acc;
                }, {});
                console.log('[SocialMediaPosts] grouped by status:', {
                    monthKey,
                    total: (posts || []).length,
                    rawStatuses: uniqueRawStatuses,
                    buckets: groupedCounts
                });
                console.log('[SocialMediaPosts] drafts bucket:', (grouped.draft || []).map((p) => p?.id).filter(Boolean));
                console.log('[SocialMediaPosts] approval bucket:', (grouped.awaiting_approval || []).map((p) => p?.id).filter(Boolean));
            }

            const summaryEl = document.getElementById('social-posts-summary');
            if (summaryEl) {
                const visibleTotal = Object.keys(grouped).reduce((acc, key) => acc + (grouped[key]?.length || 0), 0);
                const changesRequestedCount = (posts || []).filter((p) => this.normalizeStatus(p?.status) === 'changes_requested').length;
                const monthLabel = ref.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                summaryEl.innerHTML = `
                    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                        <div class="min-w-0">
                            <p class="text-[11px] uppercase tracking-widest text-slate-400">Resumo</p>
                            <p class="text-sm font-semibold text-slate-900 truncate">${monthLabel}</p>
                        </div>
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="ui-pill bg-slate-900 text-white border border-slate-900">Total: ${visibleTotal}</span>
                            <span class="ui-pill bg-amber-100 text-amber-700 border border-amber-100">Aguardando aprovação: ${grouped.awaiting_approval?.length || 0}</span>
                            <span class="ui-pill bg-rose-100 text-rose-700 border border-rose-100">Ajustes solicitados: ${changesRequestedCount}</span>
                        </div>
                    </div>
                `;
            }

            board.innerHTML = '';
            columns.forEach((col) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'ui-surface-2 p-4 flex flex-col gap-3 min-h-[260px] border border-slate-200 bg-white shadow-sm';
                const count = grouped[col.key]?.length || 0;
                wrapper.innerHTML = `
                    <div class="flex items-center justify-between gap-3 pb-2 border-b border-slate-100">
                        <div class="min-w-0">
                            <p class="text-[11px] uppercase tracking-widest text-slate-400">Pipeline</p>
                            <p class="text-sm font-semibold text-slate-900 truncate">${col.label}</p>
                        </div>
                        <span class="ui-pill bg-slate-900 text-white border border-slate-900">${count}</span>
                    </div>
                    <div class="flex flex-col gap-3" data-col="${col.key}"></div>
                `;
                const list = wrapper.querySelector('[data-col]');
                (grouped[col.key] || []).forEach((post) => {
                    const title = this.getPostTitle(post);
                    const dateStr = this.getPostDate(post);
                    const dateLabel = dateStr ? new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR') : '-';
                    const channelRaw = this.getPostChannelLabel(post);
                    const channelLabel = String(channelRaw || '-').trim() || '-';
                    const statusBadge = this.getStatusBadgeInfo(post?.status);
                    const normalizedStatus = this.normalizeStatus(post?.status);
                    const canSendForApproval = !!post?.id && ['draft', 'ready_for_review', 'changes_requested'].includes(normalizedStatus);
                    const statusBadgeSmallClass = String(statusBadge.className || '')
                        .replace(/\btext-xs\b/g, 'text-[10px]')
                        .replace(/\bpx-3\b/g, 'px-2')
                        .replace(/\bpy-1\b/g, 'py-0.5');

                    const card = document.createElement('div');
                    card.className = 'ui-card text-left p-4 border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-shadow relative overflow-visible min-h-[96px]';
                    card.setAttribute('role', 'button');
                    card.tabIndex = 0;
                    const menuId = `social-card-menu-${String(post?.id || Math.random().toString(16).slice(2))}`;
                    card.innerHTML = `
                        <div class="flex items-start justify-between gap-3">
                            <p class="text-sm font-semibold text-slate-900 min-w-0" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${title}</p>
                            <div class="relative shrink-0">
                                <button type="button" data-card-action="menu" aria-haspopup="menu" aria-controls="${menuId}" class="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300">
                                    <i class="fas fa-ellipsis-h text-sm"></i>
                                </button>
                                <div id="${menuId}" data-card-menu class="hidden absolute top-0 right-[-180px] w-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-50" role="menu">
                                    <button type="button" data-card-action="edit" class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" role="menuitem">Editar</button>
                                    <button type="button" data-card-action="duplicate" class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" role="menuitem">Duplicar</button>
                                    <button type="button" data-card-action="send" class="w-full text-left px-3 py-2 text-sm ${canSendForApproval ? 'text-slate-700 hover:bg-slate-50' : 'text-slate-300 cursor-not-allowed'}" role="menuitem" ${canSendForApproval ? '' : 'disabled'}>Enviar para aprovação</button>
                                </div>
                            </div>
                        </div>
                        <p class="mt-1 text-xs text-slate-500 truncate">${channelLabel} • ${dateLabel}</p>
                        <div class="mt-3 flex items-center justify-between gap-3">
                            <span class="${statusBadgeSmallClass}">${statusBadge.label}</span>
                        </div>
                    `;
                    const openEditor = () => {
                        document.dispatchEvent(new CustomEvent('v2:post-click', { detail: { post } }));
                    };
                    card.addEventListener('click', (event) => {
                        const actionEl = event.target?.closest?.('[data-card-action]');
                        if (actionEl) return;
                        openEditor();
                    });
                    card.addEventListener('keydown', (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openEditor();
                        }
                    });
                    if (!this._boardMenuOutsideClickHandlerAttached) {
                        this._boardMenuOutsideClickHandlerAttached = true;
                        document.addEventListener('click', (event) => {
                            const insideMenu = !!event.target?.closest?.('[data-card-menu]');
                            const insideMenuBtn = !!event.target?.closest?.('[data-card-action="menu"]');
                            if (insideMenu || insideMenuBtn) return;
                            document.querySelectorAll('[data-card-menu]').forEach((menu) => menu.classList.add('hidden'));
                        });
                    }

                    const closeAllMenus = () => {
                        board.querySelectorAll('[data-card-menu]').forEach((menu) => menu.classList.add('hidden'));
                    };
                    const menuBtn = card.querySelector('[data-card-action="menu"]');
                    const menuEl = card.querySelector('[data-card-menu]');
                    if (menuBtn && menuEl) {
                        menuBtn.addEventListener('click', (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const wasOpen = !menuEl.classList.contains('hidden');
                            closeAllMenus();
                            menuEl.classList.toggle('hidden', wasOpen);
                        });
                    }
                    const editBtn = card.querySelector('[data-card-action="edit"]');
                    if (editBtn) {
                        editBtn.addEventListener('click', (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            closeAllMenus();
                            openEditor();
                        });
                    }
                    const duplicateBtn = card.querySelector('[data-card-action="duplicate"]');
                    if (duplicateBtn) {
                        duplicateBtn.addEventListener('click', (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            closeAllMenus();
                            const duplicated = { ...post, status: 'draft' };
                            delete duplicated.id;
                            delete duplicated.post_id;
                            this.renderCreateForm(duplicated);
                        });
                    }
                    const sendBtn = card.querySelector('[data-card-action="send"]');
                    if (sendBtn) {
                        sendBtn.addEventListener('click', async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!canSendForApproval) return;
                            if (!global.SocialMediaRepo?.updatePostStatus) return;
                            closeAllMenus();
                            const result = await global.SocialMediaRepo.updatePostStatus(post.id, 'ready_for_approval');
                            if (!result) {
                                this.showFeedback('Não foi possível enviar para aprovação.', 'error');
                                return;
                            }
                            this.showFeedback('Enviado para aprovação.');
                            if (this.refreshPostsBoardFromRepo) {
                                await this.refreshPostsBoardFromRepo();
                            }
                        });
                    }
                    list.appendChild(card);
                });
                board.appendChild(wrapper);
            });

            const countDraftEl = document.getElementById('social-count-draft');
            const countPendingEl = document.getElementById('social-count-pending');
            const countApprovedEl = document.getElementById('social-count-approved');
            if (countDraftEl) countDraftEl.textContent = String(grouped.draft?.length || 0);
            if (countPendingEl) countPendingEl.textContent = String(grouped.awaiting_approval?.length || 0);
            if (countApprovedEl) countApprovedEl.textContent = String(grouped.approved?.length || 0);
        },

        setupCalendarFab: function() {
            const fab = document.getElementById('social-calendar-fab');
            if (!fab) return;
            fab.addEventListener('click', () => {
                const ref = global.SocialMediaCore?.currentMonthRef instanceof Date ? global.SocialMediaCore.currentMonthRef : new Date();
                const todayStr = new Date().toISOString().slice(0, 10);
                const monthKey = ref.toISOString().slice(0, 7);
                const dateStr = todayStr.slice(0, 7) === monthKey ? todayStr : `${monthKey}-01`;
                if (global.SocialMediaCore?.startCreate) {
                    global.SocialMediaCore.startCreate(dateStr);
                    return;
                }
                document.dispatchEvent(new CustomEvent('v2:calendar-add', { detail: { date: dateStr } }));
            });
        },

        closeDrawer: function() {
            const drawer = document.getElementById(this.drawerId);
            if (drawer) {
                drawer.classList.add('hidden');
                drawer.classList.remove('flex');
            }
        },

        /**
         * Abre o drawer preenchido para criar ou editar
         * @param {Object} post - Dados do post (opcional)
         */
        renderCreateForm: function(post = null) {
            const drawer = document.getElementById(this.drawerId);
            if (!drawer) return;

            const isEdit = !!(post && post.id);
            // [FIX] Garantir que o ID do post seja sempre string ou vazio, nunca undefined
            const postId = isEdit ? String(post.id) : '';
            
            drawer.dataset.mode = isEdit ? 'edit' : 'create';
            drawer.dataset.postId = postId;
            
            console.log(`[SOCIAL UI] renderCreateForm. IsEdit: ${isEdit}, ID: ${postId}`);

            // Título do Drawer
            const titleEl = document.getElementById('social-post-title');
            if (titleEl) titleEl.textContent = isEdit ? 'Editar Post' : 'Novo Post';

            const badgeTopEl = document.getElementById('social-post-status-badge-top');
            if (badgeTopEl) {
                const badge = this.getStatusBadgeInfo(post?.status || 'draft');
                badgeTopEl.textContent = badge.label;
                badgeTopEl.className = badge.className;
            }

            this.renderPostAuditPanel(post, []);
            if (isEdit) this.refreshPostAuditPanel(post);
            if (typeof global.setSocialPostDrawerTab === 'function') {
                global.setSocialPostDrawerTab('content');
            }

            // Preencher campos
            this.setFieldValue('social-post-title-input', post?.titulo || post?.tema || ''); // DB field: legenda/tema
            this.setFieldValue('social-post-caption-full', post?.legenda || post?.conteudo || ''); // DB field: detailed_content
            this.setFieldValue('social-post-date', post?.data_agendada?.split('T')[0] || post?.data_postagem?.split('T')[0] || '');
            this.setFieldValue('social-post-cta', post?.cta || '');
            this.setFieldValue('social-post-hashtags', post?.hashtags || '');
            this.setFieldValue('social-post-status', post?.status || 'draft');
            
            // Plataforma/Canal (assumindo array ou booleans)
            let platform = 'instagram';
            if (post) {
                if (post.plataformas && post.plataformas[0]) platform = post.plataformas[0];
                else if (post.facebook) platform = 'facebook';
                else if (post.linkedin) platform = 'linkedin';
                else if (post.tiktok) platform = 'tiktok';
            }
            this.setFieldValue('social-post-channel', platform);

            // Mídia preview e hidratação
            const imgPreview = document.getElementById('social-post-media-image');
            const videoPreview = document.getElementById('social-post-media-video');
            const mediaContainer = document.getElementById('social-post-media-preview');
            const uploadInput = document.getElementById('social-post-media-upload');
            
            // Limpar estado anterior
            if (uploadInput) uploadInput.value = ''; // Limpar input file por segurança
            
            if (mediaContainer) {
                const mediaUrl = this.getPostMediaUrl(post);
                mediaContainer.classList.remove('hidden');
                mediaContainer.dataset.mediaUrl = mediaUrl || '';
                mediaContainer.dataset.mediaObjectUrl = '';

                let placeholder = document.getElementById('social-post-media-placeholder');
                if (!placeholder) {
                    placeholder = document.createElement('div');
                    placeholder.id = 'social-post-media-placeholder';
                    placeholder.className = 'hidden text-slate-400 flex flex-col items-center justify-center min-h-[180px]';
                    placeholder.innerHTML = '<i class="fas fa-image text-3xl mb-2"></i><span class="text-sm">Sem mídia</span>';
                    mediaContainer.prepend(placeholder);
                }

                if (!mediaUrl) {
                    if (imgPreview) {
                        imgPreview.src = '';
                        imgPreview.classList.add('hidden');
                    }
                    if (videoPreview) {
                        videoPreview.pause?.();
                        videoPreview.src = '';
                        videoPreview.classList.add('hidden');
                    }
                    placeholder.classList.remove('hidden');
                } else if (mediaUrl.match(/\.(mp4|webm|mov)$/i)) {
                    placeholder.classList.add('hidden');
                    if (videoPreview) {
                        videoPreview.src = mediaUrl;
                        videoPreview.classList.remove('hidden');
                    }
                    if (imgPreview) imgPreview.classList.add('hidden');
                } else {
                    placeholder.classList.add('hidden');
                    if (imgPreview) {
                        imgPreview.src = mediaUrl;
                        imgPreview.classList.remove('hidden');
                    }
                    if (videoPreview) videoPreview.classList.add('hidden');
                }
            }

            const editable = !isEdit || this.isPostEditable(post?.status);
            [
                document.getElementById('social-post-date'),
                document.getElementById('social-post-content-type'),
                document.getElementById('social-post-title-input'),
                document.getElementById('social-post-caption-full'),
                document.getElementById('social-post-cta'),
                document.getElementById('social-post-channel'),
                document.getElementById('social-post-hashtags'),
                document.getElementById('social-post-creative'),
                document.getElementById('social-post-status'),
                document.getElementById('social-post-notes'),
                document.getElementById('social-post-slide-1'),
                document.getElementById('social-post-slide-2'),
                document.getElementById('social-post-slide-3'),
                document.getElementById('social-post-slide-4'),
                document.getElementById('social-post-hook'),
                document.getElementById('social-post-script'),
                document.getElementById('social-post-media-upload'),
                document.getElementById('social-post-save'),
                document.getElementById('social-post-save-top'),
                document.getElementById('social-post-delete')
            ].forEach((el) => {
                if (el) el.disabled = !editable;
            });

            // Exibir drawer
            drawer.classList.remove('hidden');
            drawer.classList.add('flex');
        },

        setFieldValue: function(id, value) {
            const el = document.getElementById(id);
            if (el) el.value = value;
        },

        getFormData: function() {
            // Capturar URL da mídia do preview se existir
            let mediaUrl = null;
            const imgPreview = document.getElementById('social-post-media-image');
            const videoPreview = document.getElementById('social-post-media-video');
            const container = document.getElementById('social-post-media-preview');
            
            // Preferência pela URL persistida no dataset (se houver)
            if (container && container.dataset.mediaUrl) {
                mediaUrl = container.dataset.mediaUrl;
            } else if (imgPreview && !imgPreview.classList.contains('hidden') && imgPreview.src) {
                mediaUrl = imgPreview.src;
            } else if (videoPreview && !videoPreview.classList.contains('hidden') && videoPreview.src) {
                mediaUrl = videoPreview.src;
            }

            return {
                titulo: document.getElementById('social-post-title-input')?.value,
                legenda: document.getElementById('social-post-caption-full')?.value, 
                data_postagem: document.getElementById('social-post-date')?.value,
                cta: document.getElementById('social-post-cta')?.value,
                hashtags: document.getElementById('social-post-hashtags')?.value,
                status: document.getElementById('social-post-status')?.value,
                plataforma: document.getElementById('social-post-channel')?.value,
                imagem_url: mediaUrl // [FIX] Incluir mídia no payload
            };
        },

        showLoading: function() {
            // Pode adicionar um overlay ou spinner no grid
            const grid = document.getElementById('social-calendar-grid');
            if (grid) grid.style.opacity = '0.5';
        },

        hideLoading: function() {
            const grid = document.getElementById('social-calendar-grid');
            if (grid) grid.style.opacity = '1';
        },

        showFeedback: function(msg, type) {
            // Implementar toast simples ou usar alert por enquanto
            // O index.html tem <div id="social-feedback">
            const el = document.getElementById('social-feedback');
            if (el) {
                el.textContent = msg;
                el.className = `text-sm rounded-lg px-3 py-2 ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
                el.classList.remove('hidden');
                setTimeout(() => el.classList.add('hidden'), 3000);
            } else {
                alert(msg);
            }
        },

        showEmptyState: function() {
            // Ocultar conteúdo, mostrar empty state
            const content = document.getElementById('social-content');
            const empty = document.getElementById('empty-social');
            
            if (content) content.classList.add('hidden');
            if (empty) empty.classList.remove('hidden');
        },
        
        showContent: function() {
             const content = document.getElementById('social-content');
             const empty = document.getElementById('empty-social');
             
             if (content) content.classList.remove('hidden');
             if (empty) empty.classList.add('hidden');
        }
    };

    global.SocialMediaUI = SocialMediaUI;
    
    // Auto-init
    document.addEventListener('DOMContentLoaded', () => SocialMediaUI.init());

})(window);
