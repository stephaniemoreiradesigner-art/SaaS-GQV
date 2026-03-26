// js/v2/modules/social_media/social_media_ui.js
// Interface de Usuário do Módulo Social Media V2
// Adaptado para o layout de Drawer e Grid do index.html

(function(global) {
    const SocialMediaUI = {
        drawerId: 'social-post-drawer',
        _activePost: null,
        _planningContext: null,

        isDebug: function() {
            return global.__GQV_DEBUG_CONTEXT__ === true;
        },
        
        init: function() {
            // Setup de listeners de UI (fechar drawer, tabs)
            this.setupDrawer();
            this.setupTabs();
            this.setupCalendarFab();
            this.setupEditorialItemModal();
            this.setupAiCalendarModal();
        },

        getSelectedMonthKey: function(clientId) {
            const managerKey = global.CalendarStateManager?.getState ? String(global.CalendarStateManager.getState()?.monthKey || '').trim() : '';
            if (global.MonthUtils?.isValidMonthKey?.(managerKey)) return managerKey;
            const safeClientId = clientId ? String(clientId) : '';
            if (!safeClientId) {
                return global.CalendarStateSelectors?.getCurrentMonthKey ? global.CalendarStateSelectors.getCurrentMonthKey() : '';
            }
            const stored = localStorage.getItem(`GQV_SOCIAL_MONTH_${safeClientId}`);
            const monthKey = String(stored || '').trim();
            if (global.MonthUtils?.isValidMonthKey?.(monthKey)) {
                return monthKey;
            }
            return global.CalendarStateSelectors?.getCurrentMonthKey ? global.CalendarStateSelectors.getCurrentMonthKey() : '';
        },

        getMonthStartEnd: function(monthKey) {
            const range = global.CalendarStateSelectors?.getMonthRange ? global.CalendarStateSelectors.getMonthRange(monthKey) : null;
            if (!range) {
                const fallbackKey = global.CalendarStateSelectors?.getCurrentMonthKey ? global.CalendarStateSelectors.getCurrentMonthKey() : '';
                return fallbackKey ? this.getMonthStartEnd(fallbackKey) : { startDate: '', endDateExclusive: '', dateRef: new Date() };
            }
            return { startDate: range.startDate, endDateExclusive: range.endDateExclusive, dateRef: range.start };
        },

        isTabActive: function(tabName) {
            const btn = document.querySelector(`.social-tab-btn[data-social-tab="${tabName}"]`);
            return btn ? btn.getAttribute('data-active') === 'true' : false;
        },

        refreshPostsBoardFromRepo: async function() {
            const clientId = global.ClientContext?.getActiveClient?.() || null;
            if (!clientId) {
                this.renderPostsBoard([], '');
                return;
            }

            if (global.CalendarStateManager?.getState) {
                const snap = global.CalendarStateManager.getState();
                const monthKey = String(snap?.monthKey || '').trim();
                const isReady = !!monthKey && global.MonthUtils?.isValidMonthKey?.(monthKey) && !(snap?.loading?.monthData);
                if (!isReady) return;
                this.renderPostsBoard(snap.monthPosts || [], monthKey);
                return;
            }

            const monthKey = this.getSelectedMonthKey(clientId);
            const { startDate, endDateExclusive } = this.getMonthStartEnd(monthKey);
            const posts = await global.SocialMediaRepo?.getPostsByDateRange?.(clientId, startDate, endDateExclusive);
            const safePosts = Array.isArray(posts) ? posts : [];
            this.renderPostsBoard(safePosts, monthKey);
        },

        setupDrawer: function() {
            const closeBtn = document.getElementById('social-post-close');
            const cancelBtn = document.getElementById('social-post-cancel');
            const drawer = document.getElementById(this.drawerId);
            const postTabBtns = document.querySelectorAll('.social-post-tab-btn');
            
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

                    const activeClientId = global.ClientContext?.getActiveClient?.() || null;
                    if (!global.SocialMediaUpload || !activeClientId) return;

                    const uploadedUrl = await global.SocialMediaUpload.uploadFile(file, activeClientId);
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
            postTabBtns.forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const key = String(btn?.dataset?.postTab || '').trim().toLowerCase();
                    if (key !== 'history') return;
                    if (typeof global.setSocialPostDrawerTab === 'function') {
                        global.setSocialPostDrawerTab('history');
                    }
                    if (!this._activePost?.id) return;
                    await this.refreshPostAuditPanel(this._activePost);
                });
            });
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
            if (['ready_for_review', 'in_production', 'em_producao', 'em_produção', 'para_producao', 'para_produção', 'para producao', 'para produção', 'producing', 'design', 'design_in_progress', 'briefing_sent'].includes(normalized)) return 'ready_for_review';
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
            if (global.GQV_STATUS_MAP?.getPostStatusMeta) {
                const meta = global.GQV_STATUS_MAP.getPostStatusMeta(normalized);
                const color = meta?.color?.pill || 'bg-slate-100 text-slate-500';
                return { label: meta?.label || (normalized ? normalized.replace(/_/g, ' ') : '-'), className: `text-xs uppercase ${color} px-3 py-1 rounded-full` };
            }
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

        resolveAdjustmentFromPost: function(post) {
            const candidates = [
                post?.comentario_cliente,
                post?.comentarioCliente,
                post?.feedback_ajuste,
                post?.feedbackAjuste,
                post?.feedback_cliente,
                post?.feedbackCliente,
                post?.client_feedback,
                post?.adjustment_note,
                post?.adjustmentNote,
            ];
            const text = candidates.map(v => String(v || '').trim()).find(v => v.length > 0) || '';
            const source = post?.comentario_cliente ? 'comentario_cliente'
                : post?.feedback_ajuste ? 'feedback_ajuste'
                : post?.feedback_cliente ? 'feedback_cliente' : '';
            const at = post?.updated_at || post?.updatedAt || null;
            return { text, source, at };
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
            const lastDecisionEvent = list.find((e) => String(e?.kind || '').trim() === 'approval') || null;
            const fallbackComment = String(post?.comentario_cliente || '').trim();
            const lastComment = String(lastDecisionEvent?.description || '').trim() || fallbackComment;

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
                empty.textContent = 'Nenhum histórico disponível.';
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

                const at = String(item?.at || '').trim();
                const atLabel = at ? new Date(at).toLocaleString('pt-BR') : '';
                const origin = String(item?.origin || '').trim();
                const action = String(item?.action || '').trim();
                const meta = document.createElement('div');
                meta.className = 'text-xs text-slate-400';
                meta.textContent = `${origin || '-'}${action ? ` • ${action}` : ''}${atLabel ? ` • ${atLabel}` : ''}`;

                const desc = String(item?.description || '').trim();
                const descEl = document.createElement('div');
                descEl.className = 'text-sm text-slate-600 mt-2 whitespace-pre-wrap';
                descEl.textContent = desc;
                if (!desc) descEl.classList.add('hidden');

                wrap.appendChild(meta);
                wrap.appendChild(descEl);

                row.appendChild(rail);
                row.appendChild(wrap);
                historyEl.appendChild(row);
            });
        },

        refreshPostAuditPanel: async function(post) {
            if (!post || !post.id) return;
            console.log('[EditorialHistory] load requested:', { postId: String(post.id), status: String(post?.status || '').trim() || null });
            const historyEl = document.getElementById('social-post-history');
            if (historyEl) {
                historyEl.innerHTML = '';
                const loading = document.createElement('div');
                loading.className = 'text-sm text-slate-400';
                loading.textContent = 'Carregando histórico...';
                historyEl.appendChild(loading);
            }

            try {
                const adjustment = this.resolveAdjustmentFromPost(post);
                console.log('[EditorialHistory] source resolved:', { postId: String(post.id), source: adjustment.source || null, hasText: !!adjustment.text });

                const audit = await global.SocialMediaRepo?.getPostAuditEvents?.(String(post.id));
                const auditArr = Array.isArray(audit) ? audit : [];

                const normalized = [];
                if (adjustment.text) {
                    normalized.push({
                        kind: 'client_adjustment',
                        at: String(adjustment.at || new Date().toISOString()),
                        origin: 'Cliente',
                        action: 'Solicitou ajustes',
                        description: adjustment.text
                    });
                }
                auditArr.forEach((ev) => {
                    const at = ev?.decided_at ? String(ev.decided_at) : '';
                    normalized.push({
                        kind: 'approval',
                        at: at || new Date().toISOString(),
                        origin: String(ev?.decided_by || '').trim() ? `Aprovação (${String(ev.decided_by).slice(0, 8)})` : 'Aprovação',
                        action: this.getDecisionLabel(ev?.decision),
                        description: String(ev?.comment || '').trim()
                    });
                });

                const sorted = normalized
                    .filter((e) => e && e.at)
                    .sort((a, b) => String(b.at).localeCompare(String(a.at)));

                console.log('[EditorialHistory] events normalized:', { postId: String(post.id), count: sorted.length });
                console.log('[EditorialHistory] render count:', { postId: String(post.id), count: sorted.length });
                this.renderPostAuditPanel(post, sorted);
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

        renderPostsBoard: function(posts, monthKey) {
            const board = document.getElementById('social-posts-board');
            if (!board) return;
            const safeMonthKey = String(monthKey || '').trim();

            const columns = [
                { key: 'draft', label: 'Rascunhos' },
                { key: 'internal_review', label: 'Revisão interna' },
                { key: 'awaiting_approval', label: 'Aguardando aprovação' },
                { key: 'approved', label: 'Aprovado' },
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

                if (bucket === 'approved' && safeMonthKey && dateStr && String(dateStr).slice(0, 7) !== safeMonthKey) {
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
                    monthKey: safeMonthKey,
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
                const monthLabel = (() => {
                    if (safeMonthKey && global.CalendarStateSelectors?.formatMonthLabel) {
                        const formatted = global.CalendarStateSelectors.formatMonthLabel(safeMonthKey);
                        if (formatted) return formatted;
                    }
                    const parsed = global.MonthUtils?.parseMonthKey ? global.MonthUtils.parseMonthKey(safeMonthKey) : null;
                    if (parsed) {
                        const d = new Date(parsed.year, parsed.monthIndex, 1);
                        const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        return label ? (label.charAt(0).toUpperCase() + label.slice(1)) : safeMonthKey;
                    }
                    return safeMonthKey;
                })();
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
                const snap = global.CalendarStateManager?.getState ? global.CalendarStateManager.getState() : null;
                const monthKey = String(snap?.monthKey || '').trim();
                const todayStr = global.CalendarStateSelectors?.getTodayLocalDate ? global.CalendarStateSelectors.getTodayLocalDate() : '';
                const dateStr = todayStr && monthKey && todayStr.slice(0, 7) === monthKey ? todayStr : (monthKey ? `${monthKey}-01` : todayStr);
                document.dispatchEvent(new CustomEvent('v2:calendar-item-add', { detail: { date: dateStr } }));
            });
        },

        setupPlanningModal: function() {
            const modal = document.getElementById('social-plan-modal');
            if (!modal) return;

            const close = () => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                this._planningContext = null;
                this.clearPlanningForm();
                const feedback = document.getElementById('social-plan-feedback');
                if (feedback) feedback.classList.add('hidden');
            };

            const closeBtn = document.getElementById('social-plan-close');
            const closeBottomBtn = document.getElementById('social-plan-close-bottom');
            if (closeBtn) closeBtn.addEventListener('click', close);
            if (closeBottomBtn) closeBottomBtn.addEventListener('click', close);
            modal.addEventListener('click', (event) => {
                if (event.target === modal) close();
            });

            const clearBtn = document.getElementById('social-plan-clear');
            if (clearBtn) clearBtn.addEventListener('click', () => this.clearPlanningForm());

            const saveBtn = document.getElementById('social-plan-save');
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    await this.savePlanningItem();
                });
            }
        },

        setupEditorialItemModal: function() {
            const modal = document.getElementById('social-editorial-item-modal');
            if (!modal) return;
            const closeBtn = document.getElementById('social-editorial-item-close');
            const cancelBtn = document.getElementById('social-editorial-item-cancel');
            const saveBtn = document.getElementById('social-editorial-item-save');
            const close = () => this.showEditorialItemModal(false);
            if (closeBtn) closeBtn.addEventListener('click', close);
            if (cancelBtn) cancelBtn.addEventListener('click', close);
            modal.addEventListener('click', (event) => {
                if (event.target === modal) close();
            });
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    await this.saveEditorialItemModal();
                });
            }
            const resendBtn = document.getElementById('social-editorial-item-resend');
            if (resendBtn) {
                resendBtn.addEventListener('click', async () => {
                    await this.resendCalendarItemToClient();
                });
            }
        },

        showEditorialItemModal: function(show) {
            const modal = document.getElementById('social-editorial-item-modal');
            if (!modal) return;
            if (!show) {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                this._editorialItemContext = null;
                return;
            }
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        },

        openEditorialItemModal: function(input) {
            const modal = document.getElementById('social-editorial-item-modal');
            if (!modal) return;

            const clientId = String(input?.clientId || '').trim();
            const monthKey = String(input?.monthKey || '').trim();
            const calendarId = String(input?.calendarId || '').trim();
            const calendarStatusRaw = input?.calendarStatus ?? null;
            const statusKey = global.GQV_CONSTANTS?.getSocialCalendarStatusKey
                ? global.GQV_CONSTANTS.getSocialCalendarStatusKey(calendarStatusRaw)
                : String(calendarStatusRaw || '').trim().toLowerCase();
            const editable = ['draft', 'needs_changes'].includes(String(statusKey || '').trim());

            const item = input?.item && typeof input.item === 'object' ? input.item : {};
            const itemId = item?.id ?? null;
            const date = String(item?.data || item?.data_agendada || input?.date || '').slice(0, 10);

            this._editorialItemContext = {
                clientId,
                monthKey,
                calendarId,
                calendarStatus: calendarStatusRaw,
                editable,
                itemId: itemId ? String(itemId) : ''
            };

            const idEl = document.getElementById('social-editorial-item-id');
            const dateEl = document.getElementById('social-editorial-item-date');
            const themeEl = document.getElementById('social-editorial-item-theme');
            const typeEl = document.getElementById('social-editorial-item-type');
            const channelEl = document.getElementById('social-editorial-item-channel');
            const notesEl = document.getElementById('social-editorial-item-notes');
            const statusEl = document.getElementById('social-editorial-item-status');
            const feedbackEl = document.getElementById('social-editorial-item-feedback');

            if (feedbackEl) feedbackEl.classList.add('hidden');

            if (idEl) idEl.value = itemId ? String(itemId) : '';
            if (dateEl) dateEl.value = date;
            if (themeEl) themeEl.value = String(item?.tema || '').trim();
            if (typeEl) typeEl.value = String(item?.tipo_conteudo || 'post_estatico');
            if (channelEl) channelEl.value = String(item?.canal || 'instagram');
            if (notesEl) notesEl.value = String(item?.observacoes || '');
            if (statusEl) {
                const meta = global.GQV_STATUS_MAP?.getCalendarItemStatusMeta ? global.GQV_STATUS_MAP.getCalendarItemStatusMeta(item?.status || 'draft') : null;
                statusEl.value = meta?.label || String(item?.status || 'draft');
            }

            const clientCommentWrap = document.getElementById('social-editorial-item-client-comment-wrap');
            const clientCommentText = document.getElementById('social-editorial-item-client-comment');
            const comentario = String(item?.comentario_cliente || '').trim();
            if (clientCommentWrap && clientCommentText) {
                if (comentario) {
                    clientCommentText.textContent = comentario;
                    clientCommentWrap.classList.remove('hidden');
                } else {
                    clientCommentWrap.classList.add('hidden');
                    clientCommentText.textContent = '';
                }
            }

            const controls = [dateEl, themeEl, typeEl, channelEl, notesEl, document.getElementById('social-editorial-item-save')];
            controls.forEach((el) => {
                if (!el) return;
                el.disabled = !editable;
            });

            // Mostrar botão "Reenviar para cliente" apenas quando item está em needs_changes
            const resendBtn = document.getElementById('social-editorial-item-resend');
            if (resendBtn) {
                const itemStatusRaw = String(item?.status || '').trim().toLowerCase();
                const itemStatusKey = global.GQV_CONSTANTS?.getSocialCalendarStatusKey
                    ? global.GQV_CONSTANTS.getSocialCalendarStatusKey(itemStatusRaw)
                    : itemStatusRaw;
                if (itemStatusKey === 'needs_changes') {
                    resendBtn.classList.remove('hidden');
                } else {
                    resendBtn.classList.add('hidden');
                }
            }

            this.showEditorialItemModal(true);
        },

        saveEditorialItemModal: async function() {
            const ctx = this._editorialItemContext || {};
            const calendarId = String(ctx.calendarId || '').trim();
            if (!calendarId) return;
            if (!ctx.editable) return;

            const idEl = document.getElementById('social-editorial-item-id');
            const dateEl = document.getElementById('social-editorial-item-date');
            const themeEl = document.getElementById('social-editorial-item-theme');
            const typeEl = document.getElementById('social-editorial-item-type');
            const channelEl = document.getElementById('social-editorial-item-channel');
            const notesEl = document.getElementById('social-editorial-item-notes');
            const feedbackEl = document.getElementById('social-editorial-item-feedback');
            const saveBtn = document.getElementById('social-editorial-item-save');

            const idRaw = String(idEl?.value || '').trim();
            const payload = {
                id: idRaw ? Number(idRaw) : undefined,
                calendar_id: calendarId,
                data: String(dateEl?.value || '').slice(0, 10),
                tema: String(themeEl?.value || '').trim(),
                tipo_conteudo: String(typeEl?.value || 'post_estatico'),
                canal: String(channelEl?.value || 'instagram'),
                observacoes: String(notesEl?.value || '')
            };
            if (!payload.data || !payload.tema) {
                if (feedbackEl) {
                    feedbackEl.textContent = 'Informe data e tema.';
                    feedbackEl.className = 'text-sm rounded-lg px-3 py-2 bg-red-100 text-red-700';
                    feedbackEl.classList.remove('hidden');
                }
                return;
            }
            if (!global.SocialMediaRepo?.upsertCalendarItem) return;

            const original = saveBtn ? saveBtn.innerHTML : '';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
            }
            try {
                const saved = await global.SocialMediaRepo.upsertCalendarItem(payload);
                if (!saved) {
                    if (feedbackEl) {
                        feedbackEl.textContent = 'Não foi possível salvar o item.';
                        feedbackEl.className = 'text-sm rounded-lg px-3 py-2 bg-red-100 text-red-700';
                        feedbackEl.classList.remove('hidden');
                    }
                    return;
                }
                this.applySavedEditorialItemToCalendar(saved);
                this.showEditorialItemModal(false);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = original;
                }
            }
        },

        resendCalendarItemToClient: async function() {
            const ctx = this._editorialItemContext || {};
            const itemId = String(ctx.itemId || '').trim();
            const calendarId = String(ctx.calendarId || '').trim();
            if (!itemId || !calendarId) return;

            const feedbackEl = document.getElementById('social-editorial-item-feedback');
            const resendBtn = document.getElementById('social-editorial-item-resend');

            if (resendBtn) { resendBtn.disabled = true; resendBtn.textContent = 'Reenviando...'; }

            const result = await global.SocialMediaRepo?.updateCalendarItemStatus?.(
                Number(itemId) || itemId,
                'sent_for_approval'
            );
            console.log('[AgencyCalendar] resend result:', { itemId, calendarId, result });

            if (!result || result.ok !== true) {
                if (feedbackEl) {
                    feedbackEl.textContent = 'Não foi possível reenviar o item.';
                    feedbackEl.className = 'text-sm rounded-lg px-3 py-2 bg-red-100 text-red-700';
                    feedbackEl.classList.remove('hidden');
                }
                if (resendBtn) { resendBtn.disabled = false; resendBtn.textContent = 'Reenviar para cliente'; }
                return;
            }

            if (feedbackEl) {
                feedbackEl.textContent = 'Item reenviado para o cliente.';
                feedbackEl.className = 'text-sm rounded-lg px-3 py-2 bg-emerald-50 text-emerald-700';
                feedbackEl.classList.remove('hidden');
            }

            console.log('[AgencyCalendar] item reenviado para aprovação do cliente', { itemId, calendarId });
            setTimeout(() => this.showEditorialItemModal(false), 900);
        },

        applySavedEditorialItemToCalendar: function(saved) {
            const dateKey = String(saved?.data || saved?.data_agendada || '').slice(0, 10);
            if (!dateKey || !global.SocialMediaCalendar?.createPostCard) return;

            const mapped = {
                id: `item_${String(saved?.id || Math.random()).replace(/[^\w-]/g, '')}`,
                __fromCalendarItem: true,
                calendar_item_id: saved?.id || null,
                calendar_id: saved?.calendar_id || null,
                data_agendada: dateKey,
                tema: saved?.tema || 'Item do calendário',
                formato: saved?.tipo_conteudo || 'post_estatico',
                plataforma: saved?.canal || 'instagram',
                status: saved?.status || 'draft'
            };

            const existing = saved?.id ? document.querySelector(`[data-calendar-item-id="${String(saved.id)}"]`) : null;
            if (existing) existing.remove();

            const grid = document.getElementById(global.SocialMediaCalendar.containerId || 'social-calendar-grid');
            const targetZone = grid ? grid.querySelector(`[data-date="${dateKey}"] .drop-zone`) : null;
            if (!targetZone) return;

            const card = global.SocialMediaCalendar.createPostCard(mapped);
            targetZone.appendChild(card);
        },

        setupAiCalendarModal: function() {
            const openBtn = document.getElementById('social-generate-ai');
            const modal = document.getElementById('social-ai-modal');
            if (!openBtn || !modal) return;

            const closeBtn = document.getElementById('social-ai-close');
            const cancelBtn = document.getElementById('social-ai-cancel');
            const generateBtn = document.getElementById('social-ai-generate');
            const countEl = document.getElementById('social-ai-count');
            const monthEl = document.getElementById('social-ai-month');
            const briefingEl = document.getElementById('social-ai-briefing');
            const seasonalEl = document.getElementById('social-ai-seasonal');
            const notesEl = document.getElementById('social-ai-notes');
            const fileEl = document.getElementById('social-ai-briefing-file');
            const channelEl = document.getElementById('social-ai-channel');

            const close = () => {
                modal.classList.add('hidden');
                modal.classList.remove('flex');
                this.setAiCalendarFeedback('', 'success', { hidden: true });
            };

            openBtn.addEventListener('click', () => {
                const info = global.ClientContext?.getActiveClientInfo ? global.ClientContext.getActiveClientInfo() : null;
                const clientId = String(info?.clientId || '').trim();
                if (!clientId) {
                    this.showFeedback?.('Selecione um cliente primeiro.', 'error');
                    return;
                }

                const snap = global.CalendarStateManager?.getState ? global.CalendarStateManager.getState() : null;
                const mk = String(snap?.monthKey || '').trim();
                if (monthEl) {
                    if (mk) monthEl.value = mk;
                    monthEl.readOnly = true;
                    monthEl.disabled = true;
                }

                modal.classList.remove('hidden');
                modal.classList.add('flex');
                this.setAiCalendarFeedback('', 'success', { hidden: true });
            });

            if (closeBtn) closeBtn.addEventListener('click', close);
            if (cancelBtn) cancelBtn.addEventListener('click', close);
            modal.addEventListener('click', (event) => {
                if (event.target === modal) close();
            });

            if (generateBtn) {
                generateBtn.addEventListener('click', async () => {
                    const info = global.ClientContext?.getActiveClientInfo ? global.ClientContext.getActiveClientInfo() : null;
                    const clientId = String(info?.clientId || '').trim();
                    const clientName = String(info?.clientName || '').trim();
                    if (!clientId) {
                        this.setAiCalendarFeedback('Selecione um cliente primeiro.', 'error');
                        return;
                    }

                    const rawCount = Number(countEl?.value || 0);
                    const postsCount = Math.max(1, Math.min(40, Number.isFinite(rawCount) ? rawCount : 8));
                    const snap = global.CalendarStateManager?.getState ? global.CalendarStateManager.getState() : null;
                    const monthKey = String(snap?.monthKey || monthEl?.value || '').trim().slice(0, 7);
                    const channel = String(channelEl?.value || 'instagram').trim() || 'instagram';
                    const briefingText = String(briefingEl?.value || '').trim();
                    const seasonalRaw = String(seasonalEl?.value || '').trim();
                    const seasonalDates = seasonalRaw
                        ? seasonalRaw.split(/[,\n]/g).map((s) => String(s || '').trim()).filter(Boolean)
                        : [];
                    const notes = String(notesEl?.value || '').trim();
                    const file = fileEl?.files && fileEl.files[0] ? fileEl.files[0] : null;

                    const original = generateBtn.innerHTML;
                    generateBtn.disabled = true;
                    generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Gerando...';
                    try {
                        const fileText = await this.readAiBriefingFile(file);
                        const mergedBriefing = [briefingText, fileText, notes].filter(Boolean).join('\n\n');

                        if (!global.SocialMediaCore?.generateCalendarWithAI) {
                            this.setAiCalendarFeedback('Geração indisponível.', 'error');
                            return;
                        }

                        const res = await global.SocialMediaCore.generateCalendarWithAI({
                            clientId,
                            clientName,
                            briefing: mergedBriefing,
                            postsCount,
                            seasonalDates,
                            monthKey,
                            channel
                        });

                        if (!res?.ok) {
                            this.setAiCalendarFeedback(res?.error || 'Não foi possível gerar o calendário.', 'error');
                            return;
                        }

                        const added = Number(res?.added || 0);
                        const skipped = Number(res?.skipped || 0);
                        this.setAiCalendarFeedback(`Calendário gerado: ${added} itens adicionados${skipped ? ` • ${skipped} ignorados` : ''}.`, 'success');
                    } finally {
                        generateBtn.disabled = false;
                        generateBtn.innerHTML = original;
                    }
                });
            }
        },

        setAiCalendarFeedback: function(message, type = 'success', options = {}) {
            const el = document.getElementById('social-ai-feedback');
            if (!el) return;
            const hidden = options && options.hidden === true;
            if (hidden) {
                el.classList.add('hidden');
                el.textContent = '';
                return;
            }
            el.textContent = String(message || '');
            el.className = `text-sm rounded-lg px-3 py-2 ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`;
            el.classList.remove('hidden');
        },

        readAiBriefingFile: function(file) {
            if (!file) return Promise.resolve('');
            const maxBytes = 160 * 1024;
            if (file.size && file.size > maxBytes) {
                return Promise.resolve('');
            }
            const name = String(file.name || '').toLowerCase();
            const looksText = name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.csv') || name.endsWith('.json');
            if (!looksText) return Promise.resolve('');

            return new Promise((resolve) => {
                try {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || '').trim());
                    reader.onerror = () => resolve('');
                    reader.readAsText(file);
                } catch {
                    resolve('');
                }
            });
        },

        clearPlanningForm: function() {
            const idEl = document.getElementById('social-plan-item-id');
            const dateEl = document.getElementById('social-plan-date');
            const themeEl = document.getElementById('social-plan-theme');
            const typeEl = document.getElementById('social-plan-type');
            const channelEl = document.getElementById('social-plan-channel');
            const notesEl = document.getElementById('social-plan-notes');
            const feedback = document.getElementById('social-plan-feedback');

            if (idEl) idEl.value = '';
            if (dateEl) dateEl.value = '';
            if (themeEl) themeEl.value = '';
            if (typeEl) typeEl.value = 'post_estatico';
            if (channelEl) channelEl.value = 'instagram';
            if (notesEl) notesEl.value = '';
            if (feedback) feedback.classList.add('hidden');
        },

        setPlanningFeedback: function(message, type = 'success') {
            const el = document.getElementById('social-plan-feedback');
            if (!el) return;
            el.textContent = String(message || '');
            el.classList.remove('hidden', 'bg-red-50', 'text-red-600', 'bg-green-50', 'text-green-600');
            if (type === 'error') el.classList.add('bg-red-50', 'text-red-600');
            else el.classList.add('bg-green-50', 'text-green-600');
        },

        renderPlanningList: function(items, { selectedId = null } = {}) {
            const listEl = document.getElementById('social-plan-items');
            const emptyEl = document.getElementById('social-plan-empty');
            const countEl = document.getElementById('social-plan-count');
            if (!listEl) return;

            const safeItems = Array.isArray(items) ? items : [];
            if (countEl) countEl.textContent = String(safeItems.length);

            listEl.innerHTML = '';
            if (!safeItems.length) {
                if (emptyEl) emptyEl.classList.remove('hidden');
                return;
            }
            if (emptyEl) emptyEl.classList.add('hidden');

            safeItems.slice(0, 80).forEach((it) => {
                const row = document.createElement('button');
                row.type = 'button';
                const id = it?.id ?? null;
                const date = String(it?.data || '').slice(0, 10);
                const tema = String(it?.tema || '').trim() || 'Sem tema';
                const canal = String(it?.canal || '').trim() || '-';
                const tipo = String(it?.tipo_conteudo || '').trim() || '-';
                const active = selectedId && String(id) === String(selectedId);
                row.className = `w-full text-left rounded-xl border px-3 py-2 bg-white hover:bg-slate-50 ${active ? 'border-slate-900' : 'border-slate-200'}`;
                row.innerHTML = `
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <div class="text-xs text-slate-400">${date || '-'}</div>
                            <div class="text-sm font-semibold text-slate-900 truncate">${tema}</div>
                        </div>
                        <div class="shrink-0 text-xs text-slate-500">${canal} • ${tipo}</div>
                    </div>
                `;
                row.addEventListener('click', () => {
                    this.openPlanningModal({
                        ...(this._planningContext || {}),
                        itemId: id,
                        date
                    });
                });
                listEl.appendChild(row);
            });
        },

        fillPlanningForm: function(item, preferredDate) {
            const idEl = document.getElementById('social-plan-item-id');
            const dateEl = document.getElementById('social-plan-date');
            const themeEl = document.getElementById('social-plan-theme');
            const typeEl = document.getElementById('social-plan-type');
            const channelEl = document.getElementById('social-plan-channel');
            const notesEl = document.getElementById('social-plan-notes');

            if (idEl) idEl.value = item?.id ? String(item.id) : '';
            if (dateEl) dateEl.value = String(item?.data || preferredDate || '').slice(0, 10);
            if (themeEl) themeEl.value = String(item?.tema || '').trim();
            if (typeEl) typeEl.value = String(item?.tipo_conteudo || 'post_estatico');
            if (channelEl) channelEl.value = String(item?.canal || 'instagram');
            if (notesEl) notesEl.value = String(item?.observacoes || '');
        },

        setPlanningEditable: function(isEditable) {
            const controls = [
                document.getElementById('social-plan-date'),
                document.getElementById('social-plan-theme'),
                document.getElementById('social-plan-type'),
                document.getElementById('social-plan-channel'),
                document.getElementById('social-plan-notes'),
                document.getElementById('social-plan-save')
            ];
            controls.forEach((el) => {
                if (!el) return;
                el.disabled = !isEditable;
            });
        },

        openPlanningModal: function(input) {
            const clientId = String(input?.clientId || '').trim();
            const monthKey = String(input?.monthKey || '').trim();
            const calendarId = String(input?.calendarId || '').trim();
            const calendarStatusRaw = input?.calendarStatus ?? null;
            const itemId = input?.itemId ?? null;
            const date = String(input?.date || '').slice(0, 10);
            const items = Array.isArray(input?.editorialItems) ? input.editorialItems : [];
            const selected = itemId ? (items || []).find((it) => String(it?.id) === String(itemId)) : null;
            this.openEditorialItemModal({
                clientId,
                monthKey,
                calendarId,
                calendarStatus: calendarStatusRaw,
                item: selected || { id: itemId, data: date, tema: '', tipo_conteudo: 'post_estatico', canal: 'instagram', observacoes: '' }
            });
        },

        savePlanningItem: async function() {
            const ctx = this._planningContext || {};
            const calendarId = String(ctx.calendarId || '').trim();
            if (!calendarId) {
                this.setPlanningFeedback('Calendário do mês não encontrado.', 'error');
                return;
            }
            const statusKey = global.GQV_CONSTANTS?.getSocialCalendarStatusKey
                ? global.GQV_CONSTANTS.getSocialCalendarStatusKey(ctx.calendarStatus)
                : String(ctx.calendarStatus || '').trim().toLowerCase();
            const editable = ['draft', 'needs_changes'].includes(String(statusKey || '').trim());
            if (!editable) {
                this.setPlanningFeedback('Edição bloqueada: calendário em aprovação.', 'error');
                return;
            }

            const idEl = document.getElementById('social-plan-item-id');
            const dateEl = document.getElementById('social-plan-date');
            const themeEl = document.getElementById('social-plan-theme');
            const typeEl = document.getElementById('social-plan-type');
            const channelEl = document.getElementById('social-plan-channel');
            const notesEl = document.getElementById('social-plan-notes');

            const idRaw = String(idEl?.value || '').trim();
            const payload = {
                id: idRaw ? Number(idRaw) : undefined,
                calendar_id: calendarId,
                data: String(dateEl?.value || '').slice(0, 10),
                tema: String(themeEl?.value || '').trim(),
                tipo_conteudo: String(typeEl?.value || 'post_estatico'),
                canal: String(channelEl?.value || 'instagram'),
                observacoes: String(notesEl?.value || '')
            };
            if (!payload.data || !payload.tema) {
                this.setPlanningFeedback('Informe data e tema.', 'error');
                return;
            }
            if (!global.SocialMediaRepo?.upsertCalendarItem) {
                this.setPlanningFeedback('Repositório Social Media não disponível.', 'error');
                return;
            }

            const saveBtn = document.getElementById('social-plan-save');
            const original = saveBtn ? saveBtn.innerHTML : '';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Salvando...';
            }
            try {
                const saved = await global.SocialMediaRepo.upsertCalendarItem(payload);
                if (!saved) {
                    this.setPlanningFeedback('Não foi possível salvar o item.', 'error');
                    return;
                }
                if (global.CalendarStateManager?.refreshMonthData) {
                    await global.CalendarStateManager.refreshMonthData();
                    const snap = global.CalendarStateManager.getState();
                    const liveItems = Array.isArray(snap?.editorialItems) ? snap.editorialItems : [];
                    this._planningContext = { ...(this._planningContext || {}), editorialItems: liveItems };
                    this.renderPlanningList(liveItems, { selectedId: saved?.id || null });
                }
                this.clearPlanningForm();
                this.setPlanningFeedback('Item salvo.', 'success');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = original;
                }
            }
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

            this._activePost = post || null;
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
            if (isEdit) {
                this.refreshPostAuditPanel(post);
                if (typeof window.setSocialActivePost === 'function') {
                    window.setSocialActivePost(post);
                }
            }
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
