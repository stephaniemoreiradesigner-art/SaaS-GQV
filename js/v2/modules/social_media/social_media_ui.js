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
                    if (file) {
                        // Show loading state on preview
                        const container = document.getElementById('social-post-media-preview');
                        container.classList.remove('hidden');
                        container.innerHTML = '<div class="flex items-center justify-center h-32"><i class="fas fa-spinner fa-spin text-slate-400 text-2xl"></i></div>';

                        // Upload real
                        const clientId = global.SocialMediaCore ? global.SocialMediaCore.currentClientId : null;
                        let url = null;
                        
                        if (global.SocialMediaUpload && clientId) {
                            url = await global.SocialMediaUpload.uploadFile(file, clientId);
                        } else {
                            // Fallback local se upload falhar ou não tiver módulo
                            console.warn('[UI] Usando preview local (sem persistência real)');
                            url = URL.createObjectURL(file);
                        }

                        if (url) {
                            // Restore preview structure
                            container.innerHTML = `
                                <img id="social-post-media-image" src="" class="w-full h-full object-cover hidden">
                                <video id="social-post-media-video" src="" class="w-full h-full object-cover hidden" controls></video>
                                <button type="button" class="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition" onclick="document.getElementById('social-post-media-preview').classList.add('hidden'); document.getElementById('social-post-media-image').src=''; document.getElementById('social-post-media-video').src='';">
                                    <i class="fas fa-times"></i>
                                </button>
                            `;
                            
                            const img = document.getElementById('social-post-media-image');
                            const video = document.getElementById('social-post-media-video');
                            
                            if (file.type.startsWith('video/')) {
                                video.src = url;
                                video.classList.remove('hidden');
                            } else {
                                img.src = url;
                                img.classList.remove('hidden');
                            }
                            
                            // Store URL in a hidden way or just rely on src
                            container.dataset.mediaUrl = url;
                        }
                    }
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
            if (['producing', 'in_production', 'em_producao', 'em_produção', 'design', 'design_in_progress', 'briefing_sent'].includes(normalized)) return 'producing';
            if (['pending_approval', 'ready_for_approval', 'awaiting_approval', 'aguardando_aprovacao', 'pendente_aprovacao', 'pendente_aprovação'].includes(normalized)) return 'pending_approval';
            if (['changes_requested', 'needs_revision', 'ajuste_solicitado', 'rejected', 'rejeitado'].includes(normalized)) return 'needs_revision';
            if (['approved', 'aprovado'].includes(normalized)) return 'approved';
            if (['scheduled', 'agendado'].includes(normalized)) return 'scheduled';
            return 'draft';
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

        getAuditActionLabel: function(actionType) {
            const key = String(actionType || '').trim().toLowerCase();
            if (key === 'submit_for_approval') return 'Enviado para aprovação';
            if (key === 'approve') return 'Aprovado';
            if (key === 'request_changes') return 'Solicitou ajustes';
            if (key === 'reject') return 'Reprovado';
            if (key === 'return_to_review') return 'Retornou para revisão';
            if (key === 'status_change') return 'Status alterado';
            return key || 'Evento';
        },

        renderPostAuditPanel: function(post, events) {
            const panel = document.getElementById('social-post-audit-panel');
            if (!panel) return;

            const badgeEl = document.getElementById('social-post-status-badge');
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

            const list = Array.isArray(events) ? events : [];
            const lastDecisionEvent = list.find((e) =>
                ['approve', 'request_changes', 'reject'].includes(String(e?.action_type || '').trim().toLowerCase())
            );
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
                const wrap = document.createElement('div');
                wrap.className = 'rounded-lg border border-slate-200 bg-white p-3';

                const createdAt = item?.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '';
                const actor = String(item?.actor_user_id || '').trim();
                const actorShort = actor ? actor.slice(0, 8) : '';
                const actionLabel = this.getAuditActionLabel(item?.action_type);

                const meta = document.createElement('div');
                meta.className = 'text-xs text-slate-400';
                meta.textContent = `${actionLabel}${createdAt ? ` • ${createdAt}` : ''}${actorShort ? ` • ${actorShort}` : ''}`;

                const change = document.createElement('div');
                change.className = 'text-sm text-slate-700 mt-1';
                const from = String(item?.status_anterior || '').trim();
                const to = String(item?.status_novo || '').trim();
                change.textContent = from || to ? `${from || '-'} → ${to || '-'}` : '-';

                const comment = String(item?.comment || '').trim();
                const commentEl = document.createElement('div');
                commentEl.className = 'text-sm text-slate-600 mt-2';
                commentEl.textContent = comment;
                if (!comment) commentEl.classList.add('hidden');

                wrap.appendChild(meta);
                wrap.appendChild(change);
                wrap.appendChild(commentEl);
                historyEl.appendChild(wrap);
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

        renderPostsBoard: function(posts, monthRef) {
            const board = document.getElementById('social-posts-board');
            if (!board) return;

            const ref = monthRef instanceof Date ? monthRef : new Date();
            const monthKey = ref.toISOString().slice(0, 7);

            const columns = [
                { key: 'draft', label: 'Rascunhos' },
                { key: 'producing', label: 'Em andamento' },
                { key: 'pending_approval', label: 'Enviado para aprovação' },
                { key: 'needs_revision', label: 'Ajustes solicitados' },
                { key: 'approved', label: 'Aprovado pelo cliente' },
                { key: 'scheduled', label: 'Agendado' }
            ];

            const grouped = {};
            columns.forEach(c => { grouped[c.key] = []; });

            (posts || []).forEach((post) => {
                const status = this.normalizeStatus(post?.status);
                const dateStr = this.getPostDate(post);
                if (status === 'approved' && dateStr && String(dateStr).slice(0, 7) !== monthKey) {
                    return;
                }
                if (!grouped[status]) grouped[status] = [];
                grouped[status].push(post);
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
                console.log('[SocialMediaPosts] approval bucket:', (grouped.pending_approval || []).map((p) => p?.id).filter(Boolean));
            }

            board.innerHTML = '';
            columns.forEach((col) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'ui-surface-2 p-4 flex flex-col gap-3 min-h-[240px]';
                const count = grouped[col.key]?.length || 0;
                wrapper.innerHTML = `
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-semibold text-slate-900">${col.label}</p>
                        <span class="ui-pill">${count}</span>
                    </div>
                    <div class="flex flex-col gap-2" data-col="${col.key}"></div>
                `;
                const list = wrapper.querySelector('[data-col]');
                (grouped[col.key] || []).forEach((post) => {
                    const mediaUrl = this.getPostMediaUrl(post);
                    const isVideo = !!(mediaUrl && mediaUrl.match(/\.(mp4|webm|mov)$/i));
                    const title = this.getPostTitle(post);
                    const dateStr = this.getPostDate(post);
                    const dateLabel = dateStr ? new Date(`${dateStr}T00:00:00`).toLocaleDateString('pt-BR') : '-';
                    const format = this.getFormatInfo(post);

                    const card = document.createElement('button');
                    card.type = 'button';
                    card.className = 'ui-card text-left p-3';
                    card.innerHTML = `
                        <div class="flex items-start gap-3">
                            <div class="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center text-slate-300 shrink-0">
                                ${mediaUrl ? (isVideo ? `<video src="${mediaUrl}" class="w-full h-full object-cover" muted playsinline preload="metadata"></video>` : `<img src="${mediaUrl}" class="w-full h-full object-cover">`) : '<i class="fas fa-image"></i>'}
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-semibold text-slate-900 truncate">${title}</p>
                                <p class="text-xs text-slate-500 mt-1">${dateLabel}</p>
                                <div class="mt-2 flex items-center gap-2">
                                    <span class="ui-pill ${format.color}">${format.label}</span>
                                    <span class="ui-pill">${String(post?.status || '').toUpperCase() || '-'}</span>
                                </div>
                            </div>
                        </div>
                    `;
                    card.addEventListener('click', () => {
                        document.dispatchEvent(new CustomEvent('v2:post-click', { detail: { post } }));
                    });
                    list.appendChild(card);
                });
                board.appendChild(wrapper);
            });

            const countDraftEl = document.getElementById('social-count-draft');
            const countPendingEl = document.getElementById('social-count-pending');
            const countApprovedEl = document.getElementById('social-count-approved');
            if (countDraftEl) countDraftEl.textContent = String(grouped.draft?.length || 0);
            if (countPendingEl) countPendingEl.textContent = String(grouped.pending_approval?.length || 0);
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

            this.renderPostAuditPanel(post, []);
            if (isEdit) this.refreshPostAuditPanel(post);

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
            
            if (post?.imagem_url) {
                if (mediaContainer) {
                    mediaContainer.classList.remove('hidden');
                    mediaContainer.dataset.mediaUrl = post.imagem_url; // [FIX] Hidratar dataset com URL persistida
                }
                // Detectar se é vídeo (extensão básica)
                if (post.imagem_url.match(/\.(mp4|webm)$/i)) {
                    if (videoPreview) {
                        videoPreview.src = post.imagem_url;
                        videoPreview.classList.remove('hidden');
                        if (imgPreview) imgPreview.classList.add('hidden');
                    }
                } else {
                    if (imgPreview) {
                        imgPreview.src = post.imagem_url;
                        imgPreview.classList.remove('hidden');
                        if (videoPreview) videoPreview.classList.add('hidden');
                    }
                }
            } else {
                if (mediaContainer) {
                    mediaContainer.classList.add('hidden');
                    mediaContainer.dataset.mediaUrl = ''; // Limpar dataset se não houver mídia
                }
            }

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
