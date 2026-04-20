// js/v2/modules/social_media/social_media_core.js
// Núcleo do Módulo Social Media V2
// Reage a mudanças no ClientContext e atualiza a UI

(function(global) {
    const SocialMediaCore = {
        initialized: false,
        currentClientId: null,
        currentClientName: null,
        currentCalendarId: null,
        currentMonthRef: new Date(),
        currentPosts: [],
        _calendarStateUnsub: null,
        _deleteCalendarContext: null,
        _lastCalendarStatus: null,
        // Helper de debug
        isDebug: function() {
            return window.__GQV_DEBUG_CONTEXT__ === true;
        },

        init: async function() {
            if (this.initialized) return;
            console.log('[SOCIAL] Inicializando Core...');
            
            // Dependências
            if (!global.SocialMediaRepo) console.warn('[SOCIAL] Repo não carregado!');
            if (!global.SocialMediaCalendar) console.warn('[SOCIAL] Calendar não carregado!');
            if (!global.SocialMediaUI) console.warn('[SOCIAL] UI não carregado!');

            // Inscrever-se no Contexto
            if (global.ClientContext) {
                global.ClientContext.subscribe((clientId) => {
                    const name = global.ClientContext?.getActiveClientName ? global.ClientContext.getActiveClientName() : null;
                    if (this.isDebug()) console.log('[SocialMediaV2] active client received:', { clientId, clientName: name });
                    this.onClientChange(clientId, name);
                });
            }

            // Delegate para botão salvar no drawer
            const saveBtn = document.getElementById('social-post-save');
            if (saveBtn) {
                // Remover listeners antigos para evitar duplicação (cloneNode remove listeners)
                const newSaveBtn = saveBtn.cloneNode(true);
                saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                
                newSaveBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // Evitar propagação
                    this.handleSavePost();
                });
            }

            // Delegate para botão excluir no drawer
            const deleteBtn = document.getElementById('social-post-delete');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    const drawer = document.getElementById('social-post-drawer');
                    const postId = drawer ? drawer.dataset.postId : null;
                    if (postId) {
                        this.handleDeletePost(postId);
                    }
                });
            }

            // Ouvir clique no card para edição (disparado pelo Calendar ou Feed)
            document.addEventListener('v2:post-click', (e) => {
                if (e.detail && e.detail.post) {
                    this.startEdit(e.detail.post, e.detail.initialTab || null, e.detail.source || 'pipeline');
                }
            });

            // Ouvir drag and drop do calendário
            document.addEventListener('v2:post-drop', (e) => {
                if (e.detail && e.detail.postId && e.detail.newDate) {
                    this.handlePostMove(e.detail.postId, e.detail.newDate);
                }
            });
            
            // Ouvir adição rápida de post no dia
            document.addEventListener('v2:calendar-add', (e) => {
                if (e.detail && e.detail.date) {
                    this.startCreate(String(e.detail.date || '').slice(0, 10), 'calendar');
                }
            });
            document.addEventListener('v2:calendar-item-add', (e) => {
                if (e.detail && e.detail.date) {
                    this.startCreate(String(e.detail.date || '').slice(0, 10), 'calendar');
                }
            });
            document.addEventListener('v2:calendar-item-click', async (e) => {
                await this.handleCalendarItemClick(e?.detail || {});
            });
            
            // Ouvir botão Novo Post
            const newPostBtn = document.getElementById('social-new-post');
            if (newPostBtn) {
                newPostBtn.onclick = () => {
                    const todayStr = global.CalendarStateSelectors?.getTodayLocalDate ? global.CalendarStateSelectors.getTodayLocalDate() : '';
                    const snap = this.getCalendarSnap();
                    const status = String(snap?.calendarStatus || '').trim().toLowerCase();
                    const normalized = global.GQV_CONSTANTS?.getSocialCalendarStatusKey
                        ? global.GQV_CONSTANTS.getSocialCalendarStatusKey(status)
                        : status;
                    const inPlanning = ['draft', 'sent_for_approval', 'needs_changes', 'rascunho', 'aguardando_aprovacao', 'ajuste_solicitado'].includes(normalized);
                    const calendarTabActive = global.SocialMediaUI?.isTabActive ? global.SocialMediaUI.isTabActive('calendar') : false;
                    if (calendarTabActive && inPlanning) {
                        this.startCreate(todayStr, 'calendar');
                        return;
                    }
                    this.startCreate(todayStr, 'pipeline');
                };
            }

            // Navegação de mês
            const prevBtn = document.getElementById('social-month-prev');
            const nextBtn = document.getElementById('social-month-next');
            if (prevBtn) prevBtn.onclick = async () => {
                if (global.CalendarStateManager?.prevMonth) {
                    await global.CalendarStateManager.prevMonth();
                    return;
                }
                await this.changeMonth(-1);
            };
            if (nextBtn) nextBtn.onclick = async () => {
                if (global.CalendarStateManager?.nextMonth) {
                    await global.CalendarStateManager.nextMonth();
                    return;
                }
                await this.changeMonth(1);
            };

            this.bindCalendarActionHandlers();

            this.initialized = true;
        },

        cloneAndBind: function(id, handler) {
            const el = document.getElementById(id);
            if (!el || !el.parentNode) return null;
            const next = el.cloneNode(true);
            el.parentNode.replaceChild(next, el);
            if (typeof handler === 'function') next.addEventListener('click', handler);
            return next;
        },

        setAgencyFeedback: function(message, type = 'success') {
            const ui = global.SocialMediaUI;
            if (ui?.showFeedback) {
                ui.showFeedback(message, type);
                return;
            }
            const el = document.getElementById('social-feedback');
            if (!el) return;
            el.textContent = String(message || '');
            el.className = `text-sm rounded-lg px-3 py-2 ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`;
            el.classList.remove('hidden');
        },

        getCalendarSnap: function() {
            const snap = global.CalendarStateManager?.getState ? global.CalendarStateManager.getState() : null;
            return snap || null;
        },

        openPlanning: function({ date = null, itemId = null } = {}) {
            const snap = this.getCalendarSnap();
            const hasClient = !!String(this.currentClientId || '').trim();
            if (!hasClient) {
                this.setAgencyFeedback('Selecione um cliente primeiro.', 'error');
                return;
            }
            if (!global.SocialMediaUI?.openEditorialItemModal) {
                this.setAgencyFeedback('Editor editorial indisponível.', 'error');
                return;
            }
            const items = Array.isArray(snap?.editorialItems) ? snap.editorialItems : [];
            const selected = itemId ? items.find((it) => String(it?.id) === String(itemId)) : null;
            global.SocialMediaUI.openEditorialItemModal({
                clientId: this.currentClientId,
                monthKey: snap?.monthKey || '',
                calendarId: snap?.activeCalendarId || null,
                calendarStatus: snap?.calendarStatus || null,
                item: selected || { id: itemId, data: String(date || '').slice(0, 10), tema: '', tipo_conteudo: 'post_estatico', canal: 'instagram', observacoes: '' }
            });
        },

        generateCalendarWithAI: async function(input) {
            const activeInfo = global.ClientContext?.getActiveClientInfo ? global.ClientContext.getActiveClientInfo() : null;
            const clientId = String(activeInfo?.clientId || input?.clientId || '').trim();
            const clientName = String(activeInfo?.clientName || input?.clientName || '').trim();
            if (!clientId) return { ok: false, error: 'cliente não selecionado' };

            const snap = this.getCalendarSnap();
            const monthKey = String(snap?.monthKey || input?.monthKey || '').trim().slice(0, 7);
            if (!global.MonthUtils?.isValidMonthKey?.(monthKey)) return { ok: false, error: 'monthKey inválido' };

            if (!global.SocialMediaAI?.generateAICalendar) return { ok: false, error: 'ai_adapter_missing' };
            const repo = global.SocialMediaRepo;
            if (!repo?.insertAICalendarItems) return { ok: false, error: 'repo_missing' };

            let calendarId = String(snap?.activeCalendarId || '').trim();
            if (!calendarId && repo?.getCalendarByMonth) {
                const calendar = await repo.getCalendarByMonth(clientId, monthKey);
                calendarId = String(calendar?.id || '').trim();
            }

            const postsCount = Math.max(1, Math.min(30, Number(input?.postsCount || 0) || 8));
            const briefing = String(input?.briefing || '').trim();
            const seasonalDates = Array.isArray(input?.seasonalDates) ? input.seasonalDates : [];

            let ai;
            try {
                ai = await global.SocialMediaAI.generateAICalendar({
                    clientId,
                    clientName,
                    monthKey,
                    briefing,
                    postsCount,
                    seasonalDates
                });
            } catch (err) {
                return { ok: false, error: String(err?.message || err || '').trim() || 'ai_error' };
            }

            const items = Array.isArray(ai?.items) ? ai.items : [];
            if (!items.length) return { ok: false, error: 'empty_items' };

            const inserted = await repo.insertAICalendarItems(items, calendarId, clientId, { monthKey });
            if (inserted?.ok !== true) {
                const msg = typeof inserted?.error?.message === 'string'
                    ? inserted.error.message
                    : (typeof inserted?.error === 'string' ? inserted.error : 'persist_failed');
                return { ok: false, error: msg };
            }

            const insertedIds = Array.isArray(inserted?.insertedIds) ? inserted.insertedIds : [];
            try {
                if (global.CalendarStateManager?.refreshMonthData) {
                    await global.CalendarStateManager.refreshMonthData({ monthKey, source: 'ai_generate_edge' });
                }
            } catch (err) {
                if (repo?.deleteCalendarItemsByIds && insertedIds.length) {
                    await repo.deleteCalendarItemsByIds(insertedIds);
                }
                return { ok: false, error: 'refresh_failed' };
            }

            return { ok: true, added: Number(inserted?.inserted || 0), skipped: 0 };
        },

        generateEditorialItemsWithAdapter: async function(input) {
            const adapter = global.SocialMediaAI?.generateCalendarWithAI;
            if (typeof adapter === 'function') {
                try {
                    const out = await adapter(input);
                    if (Array.isArray(out) && out.length) return out;
                } catch {}
            }
            return this.generateEditorialItemsFallback(input);
        },

        generateEditorialItemsFallback: function(input) {
            const monthKey = String(input?.monthKey || '').trim().slice(0, 7);
            const postsCount = Math.max(1, Math.min(40, Number(input?.postsCount || 0) || 8));
            const channel = String(input?.channel || 'instagram').trim() || 'instagram';
            const briefing = String(input?.briefing || '').trim();
            const seasonal = Array.isArray(input?.seasonal) ? input.seasonal : [];

            const dates = this.pickEditorialDates(monthKey, postsCount, seasonal);
            const keywords = this.extractBriefingKeywords(briefing);
            const formats = (() => {
                if (channel === 'tiktok') return ['reels', 'reels', 'post_estatico'];
                if (channel === 'linkedin') return ['post_estatico', 'carrossel', 'post_estatico'];
                return ['carrossel', 'post_estatico', 'reels', 'post_estatico'];
            })();

            const baseThemes = [
                'Educação',
                'Autoridade',
                'Prova social',
                'Bastidores',
                'Oferta',
                'Engajamento'
            ];

            const truncate = (value, max) => {
                const s = String(value || '').trim();
                if (!max) return s;
                return s.length > max ? `${s.slice(0, max)}…` : s;
            };

            return dates.map((date, idx) => {
                const seed = keywords[idx % Math.max(1, keywords.length)] || baseThemes[idx % baseThemes.length];
                const seasonalMatch = seasonal.find((s) => String(s?.date || '') === date);
                const theme = seasonalMatch?.label
                    ? `${seasonalMatch.label} — ${seed}`
                    : `${baseThemes[idx % baseThemes.length]} — ${seed}`;
                const tipo = formats[idx % formats.length] || 'post_estatico';
                const observacoes = [
                    briefing ? `Briefing: ${truncate(briefing, 700)}` : '',
                    `Copy base: ${theme}. CTA: Comente/mande DM para saber mais.`,
                    `Sugestão de ângulo: ${seed}.`,
                    seasonalMatch?.label ? `Data sazonal: ${seasonalMatch.label}` : ''
                ].filter(Boolean).join('\n');

                return {
                    data: date,
                    tema: theme,
                    tipo_conteudo: tipo,
                    canal: channel,
                    observacoes
                };
            });
        },

        extractBriefingKeywords: function(briefing) {
            const text = String(briefing || '').toLowerCase();
            const parts = text
                .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
                .split(/\s+/g)
                .map((w) => w.trim())
                .filter(Boolean);
            const stop = new Set(['para', 'com', 'sem', 'uma', 'uns', 'umas', 'sobre', 'mais', 'menos', 'cliente', 'marca', 'empresa', 'produto', 'servico', 'serviço', 'publico', 'público', 'campanha', 'conteudo', 'conteúdo', 'instagram', 'facebook', 'linkedin', 'tiktok', 'nos', 'nas', 'dos', 'das', 'que', 'por', 'como', 'seu', 'sua', 'seus', 'suas', 'isso', 'essa', 'esse', 'este', 'esta']);
            const counts = new Map();
            for (const w of parts) {
                if (w.length < 5) continue;
                if (stop.has(w)) continue;
                counts.set(w, (counts.get(w) || 0) + 1);
            }
            const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([w]) => w);
            return sorted.slice(0, 8);
        },

        parseSeasonalDates: function(raw, monthKey) {
            const mk = String(monthKey || '').trim().slice(0, 7);
            if (!global.MonthUtils?.isValidMonthKey?.(mk)) return [];
            const year = Number(mk.slice(0, 4));
            const month = Number(mk.slice(5, 7));
            if (!Number.isFinite(year) || !Number.isFinite(month)) return [];

            const lines = String(raw || '').split(/\r?\n/g).map((l) => l.trim()).filter(Boolean);
            const out = [];
            for (const line of lines) {
                const mIso = line.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/);
                if (mIso) {
                    const date = mIso[1];
                    const label = String(mIso[2] || '').trim() || 'Data sazonal';
                    if (date.slice(0, 7) === mk) out.push({ date, label });
                    continue;
                }

                const mBr = line.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s*(.*)$/);
                if (mBr) {
                    const dd = Number(mBr[1]);
                    const mm = Number(mBr[2]);
                    const yy = mBr[3] ? Number(mBr[3]) : year;
                    const label = String(mBr[4] || '').trim() || 'Data sazonal';
                    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) continue;
                    const iso = `${String(yy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
                    if (iso.slice(0, 7) === mk) out.push({ date: iso, label });
                }
            }
            const uniq = new Map();
            out.forEach((it) => {
                const k = String(it?.date || '').slice(0, 10);
                if (!k) return;
                if (!uniq.has(k)) uniq.set(k, { date: k, label: String(it?.label || '').trim() || 'Data sazonal' });
            });
            return Array.from(uniq.values()).slice(0, 24);
        },

        pickEditorialDates: function(monthKey, postsCount, seasonal) {
            const mk = String(monthKey || '').trim().slice(0, 7);
            if (!global.MonthUtils?.isValidMonthKey?.(mk)) return [];
            const year = Number(mk.slice(0, 4));
            const month = Number(mk.slice(5, 7));
            const total = Math.max(1, Math.min(40, Number(postsCount || 0) || 8));

            const daysInMonth = new Date(year, month, 0).getDate();
            const candidates = [];
            for (let d = 1; d <= daysInMonth; d += 1) {
                const date = new Date(year, month - 1, d);
                const dow = date.getDay();
                if (dow === 0 || dow === 6) continue;
                const iso = `${mk}-${String(d).padStart(2, '0')}`;
                candidates.push(iso);
            }

            const picked = [];
            const seen = new Set();
            const seasonalDates = Array.isArray(seasonal) ? seasonal.map((s) => String(s?.date || '').slice(0, 10)).filter(Boolean) : [];
            seasonalDates.forEach((d) => {
                if (d.slice(0, 7) !== mk) return;
                if (!seen.has(d)) {
                    picked.push(d);
                    seen.add(d);
                }
            });

            const remaining = Math.max(0, total - picked.length);
            if (!remaining) return picked.slice(0, total);
            if (!candidates.length) return picked.slice(0, total);

            const step = candidates.length / remaining;
            for (let i = 0; i < remaining; i += 1) {
                const idx = Math.min(candidates.length - 1, Math.floor(i * step));
                const date = candidates[idx];
                if (!seen.has(date)) {
                    picked.push(date);
                    seen.add(date);
                }
            }

            if (picked.length < total) {
                for (const d of candidates) {
                    if (picked.length >= total) break;
                    if (!seen.has(d)) {
                        picked.push(d);
                        seen.add(d);
                    }
                }
            }

            return picked.slice(0, total).sort();
        },

        updateCalendarActionButtons: function(snap) {
            const sendBtn = document.getElementById('social-send-approval');
            const delBtn = document.getElementById('social-delete-calendar');
            const status = String(snap?.calendarStatus || '').trim().toLowerCase();
            const itemsCount = Array.isArray(snap?.editorialItems) ? snap.editorialItems.length : 0;
            const isDraft = status === 'draft' || status === 'rascunho';
            const canSend = (status === 'draft' || status === 'rascunho' || status === 'needs_changes' || status === 'ajuste_solicitado' || status === 'changes_requested') && itemsCount > 0;
            if (sendBtn) sendBtn.disabled = !canSend;
            if (delBtn) delBtn.disabled = !(isDraft && !!snap?.activeCalendarId);
        },

        bindCalendarActionHandlers: function() {
            this.cloneAndBind('social-send-approval', async () => {
                const snap = this.getCalendarSnap();
                console.log('[AgencyCalendar] send approval clicked', { clientId: snap?.clientId || null, monthKey: snap?.monthKey || null, calendarId: snap?.activeCalendarId || null });
                const calendarId = String(snap?.activeCalendarId || '').trim();
                const clientId = String(snap?.clientId || '').trim();
                const itemsCount = Array.isArray(snap?.editorialItems) ? snap.editorialItems.length : 0;
                if (!calendarId || !clientId) return;
                if (!itemsCount) {
                    this.setAgencyFeedback('Adicione itens no planejamento antes de enviar para aprovação.', 'error');
                    return;
                }
                console.log('[AgencyCalendar] approval payload', { calendarId, clientId, status: 'sent_for_approval' });
                const res = global.SocialMediaRepo?.updateCalendarStatus
                    ? await global.SocialMediaRepo.updateCalendarStatus(calendarId, clientId, 'sent_for_approval')
                    : { ok: false, error: 'repo_missing' };
                if (res?.ok !== true) {
                    this.setAgencyFeedback('Não foi possível enviar o calendário para aprovação.', 'error');
                    return;
                }
                console.log('[AgencyCalendar] approval persisted', { calendarId, clientId });
                this.setAgencyFeedback('Calendário enviado para aprovação.', 'success');
                if (global.CalendarStateManager?.refreshMonthData) {
                    await global.CalendarStateManager.refreshMonthData();
                }
            });

            this.cloneAndBind('social-delete-calendar', () => {
                const snap = this.getCalendarSnap();
                const calendarId = String(snap?.activeCalendarId || '').trim();
                const status = String(snap?.calendarStatus || '').trim().toLowerCase();
                console.log('[AgencyCalendar] delete calendar clicked', { clientId: snap?.clientId || null, monthKey: snap?.monthKey || null, calendarId: calendarId || null, status: status || null });
                const isDraft = status === 'draft' || status === 'rascunho';
                if (!isDraft) {
                    console.log('[AgencyCalendar] delete blocked (status)', { status });
                    this.setAgencyFeedback('Este calendário já foi enviado para aprovação e não pode mais ser excluído.', 'error');
                    return;
                }
                if (!calendarId) return;
                const modal = document.getElementById('social-calendar-delete-modal');
                const monthEl = document.getElementById('social-calendar-delete-month');
                const feedbackEl = document.getElementById('social-calendar-delete-feedback');
                if (feedbackEl) feedbackEl.classList.add('hidden');
                if (monthEl) {
                    const label = global.CalendarStateSelectors?.formatMonthLabel ? global.CalendarStateSelectors.formatMonthLabel(snap?.monthKey || '') : String(snap?.monthKey || '');
                    monthEl.textContent = label || String(snap?.monthKey || '');
                }
                this._deleteCalendarContext = { calendarId, clientId: String(snap?.clientId || '').trim(), monthKey: String(snap?.monthKey || '').trim() };
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                }
            });

            this.cloneAndBind('social-calendar-delete-close', () => this.closeDeleteCalendarModal());
            this.cloneAndBind('social-calendar-delete-cancel', () => this.closeDeleteCalendarModal());
            const modal = document.getElementById('social-calendar-delete-modal');
            if (modal) {
                modal.addEventListener('click', (event) => {
                    if (event.target === modal) this.closeDeleteCalendarModal();
                });
            }

            this.cloneAndBind('social-calendar-delete-confirm', async () => {
                const ctx = this._deleteCalendarContext;
                const calendarId = String(ctx?.calendarId || '').trim();
                const clientId = String(ctx?.clientId || '').trim();
                if (!calendarId || !clientId) return;
                const snap = this.getCalendarSnap();
                const status = String(snap?.calendarStatus || '').trim().toLowerCase();
                const isDraft = status === 'draft' || status === 'rascunho';
                if (!isDraft) {
                    console.log('[AgencyCalendar] delete blocked (status)', { status });
                    this.setAgencyFeedback('Este calendário já foi enviado para aprovação e não pode mais ser excluído.', 'error');
                    this.closeDeleteCalendarModal();
                    return;
                }
                const res = global.SocialMediaRepo?.deleteCalendarDraft
                    ? await global.SocialMediaRepo.deleteCalendarDraft(calendarId)
                    : { ok: false, error: 'repo_missing' };
                if (res?.ok !== true) {
                    this.setAgencyFeedback('Não foi possível excluir o calendário.', 'error');
                    return;
                }
                console.log('[AgencyCalendar] delete persisted', { calendarId, clientId });
                this.closeDeleteCalendarModal();
                this.setAgencyFeedback('Calendário excluído com sucesso.', 'success');
                if (global.CalendarStateManager?.refreshMonthData) {
                    await global.CalendarStateManager.refreshMonthData();
                }
            });
        },

        closeDeleteCalendarModal: function() {
            const modal = document.getElementById('social-calendar-delete-modal');
            if (!modal) return;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        },

        onClientChange: async function(clientId, clientName) {
            const normalizedClientId = String(clientId ?? '').trim();
            if (!normalizedClientId) {
                console.warn('[SocialMediaV2][STARTUP_TRACE] invalid clientId received:', {
                    clientIdRaw: clientId,
                    clientIdNormalized: normalizedClientId,
                    activeModule: global.WorkspaceState?.getState ? global.WorkspaceState.getState().activeModule : null
                });
                this.currentClientId = null;
                this.currentClientName = null;
                this.showEmptyState();
                return;
            }

            const resolvedName = clientName || (global.ClientContext?.getActiveClientName ? global.ClientContext.getActiveClientName() : null) || 'Cliente';
            if (this.isDebug()) console.log('[SocialMediaV2] render for client:', { clientId: normalizedClientId, clientName: resolvedName });

            // Se mudou o cliente, reseta o estado
            if (normalizedClientId !== this.currentClientId) {
                this.currentClientId = normalizedClientId;
                this.currentClientName = resolvedName;
                console.log(`[SOCIAL] Cliente alterado: ${normalizedClientId}`);
                
                // Atualiza UI básica
                const nameEl = document.getElementById('social-client-name');
                if (nameEl) nameEl.textContent = this.currentClientName;
                
                if (global.SocialMediaUI && global.SocialMediaUI.showContent) {
                    global.SocialMediaUI.showContent();
                }

                const tenantId = global.TenantContext?.getTenantId ? global.TenantContext.getTenantId() : null;
                const manager = global.CalendarStateManager;
                if (manager?.init) {
                    manager.init({
                        clientId: normalizedClientId,
                        tenantId,
                        loadInitialMonthKey: ({ clientId: id }) => {
                            const stored = localStorage.getItem(`GQV_SOCIAL_MONTH_${String(id || '').trim()}`);
                            const key = String(stored || '').trim();
                            return global.MonthUtils?.isValidMonthKey?.(key) ? key : '';
                        },
                        persistMonthKey: ({ clientId: id, monthKey }) => {
                            if (!id || !monthKey) return;
                            localStorage.setItem(`GQV_SOCIAL_MONTH_${String(id).trim()}`, String(monthKey).trim());
                        },
                        fetchCalendarMeta: async ({ clientId: id, monthKey }) => {
                            return global.SocialMediaRepo?.getCalendarByMonth ? await global.SocialMediaRepo.getCalendarByMonth(id, monthKey) : null;
                        },
                        fetchEditorialItems: async ({ activeCalendarId }) => {
                            return global.SocialMediaRepo?.getCalendarItems ? await global.SocialMediaRepo.getCalendarItems(activeCalendarId) : [];
                        },
                        fetchMonthPosts: async ({ clientId: id, startDate, endDateExclusive }) => {
                            return global.SocialMediaRepo?.getPostsByDateRange ? await global.SocialMediaRepo.getPostsByDateRange(id, startDate, endDateExclusive) : [];
                        }
                    });

                    if (!this._calendarStateUnsub && manager.subscribe) {
                        this._calendarStateUnsub = manager.subscribe((snap) => {
                            if (!snap || String(snap.clientId || '') !== String(this.currentClientId || '')) return;

                            const monthKey = String(snap.monthKey || '').trim();
                            const monthReady = !!monthKey
                                && global.MonthUtils?.isValidMonthKey?.(monthKey)
                                && !(snap?.loading?.monthData)
                                && !(snap?.loading?.calendarMeta);

                            this.currentCalendarId = snap.activeCalendarId || null;
                            this.currentMonthRef = snap.monthStart instanceof Date ? snap.monthStart : new Date();
                            this.currentPosts = Array.isArray(snap.monthPosts) ? snap.monthPosts : [];

                            if (monthReady) {
                                if (global.SocialMediaCalendar?.renderFromState) {
                                    global.SocialMediaCalendar.renderFromState(snap);
                                } else if (global.SocialMediaCalendar?.render) {
                                    global.SocialMediaCalendar.render(this.currentPosts, this.currentMonthRef);
                                }
                                if (global.SocialMediaUI?.renderPostsBoard) {
                                    global.SocialMediaUI.renderPostsBoard(this.currentPosts, monthKey);
                                }
                                this.processAutoPublishPosts(this.currentPosts);
                                // Auto-criação/sincronização: aprovados → draft, needs_changes → changes_requested
                                const items = Array.isArray(snap.editorialItems) ? snap.editorialItems : [];
                                items.forEach((it) => {
                                    const meta = global.GQV_STATUS_MAP?.getCalendarItemStatusMeta ? global.GQV_STATUS_MAP.getCalendarItemStatusMeta(it.status) : null;
                                    const statusKey = String(meta?.key || '').trim();
                                    if (statusKey === 'approved') {
                                        this.createPostFromCalendarItem(it, snap.activeCalendarId, snap.clientId);
                                    } else if (statusKey === 'needs_changes') {
                                        this.syncChangesRequestedPost(it, snap.activeCalendarId, snap.clientId);
                                    }
                                });
                            }

                            const statusEl = document.getElementById('social-calendar-status');
                            if (statusEl) {
                                const rawStatus = String(snap.calendarStatus || 'draft');
                                const normalized = global.GQV_CONSTANTS?.getSocialCalendarStatusKey
                                    ? global.GQV_CONSTANTS.getSocialCalendarStatusKey(rawStatus)
                                    : String(rawStatus || '').trim().toLowerCase();
                                const prevStatus = String(this._lastCalendarStatus || '').trim();
                                const nextStatus = String(normalized || '').trim();
                                if (nextStatus === 'approved' && prevStatus && prevStatus !== nextStatus) {
                                    console.log('[AgencyCalendar] unlocked after calendar approval:', { calendarId: snap.activeCalendarId || null, monthKey: snap.monthKey || null, from: prevStatus, to: nextStatus });
                                }
                                this._lastCalendarStatus = nextStatus;
                                const label = global.GQV_CONSTANTS?.getSocialCalendarStatusLabelPt
                                    ? global.GQV_CONSTANTS.getSocialCalendarStatusLabelPt(rawStatus)
                                    : (nextStatus ? nextStatus.replace(/_/g, ' ') : '-');
                                statusEl.textContent = label;
                                statusEl.className = 'text-xs uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full';
                                if (normalized === 'approved') statusEl.classList.add('bg-green-100', 'text-green-700');
                                if (normalized === 'sent_for_approval') statusEl.classList.add('bg-yellow-100', 'text-yellow-700');
                                if (normalized === 'needs_changes') statusEl.classList.add('bg-red-100', 'text-red-700');
                            }

                            this.updateCalendarActionButtons(snap);
                        });
                    }

                    await manager.refreshMonthData();
                    return;
                }

                await this.loadCalendarForMonth(new Date());
            } else if (resolvedName && resolvedName !== this.currentClientName) {
                this.currentClientName = resolvedName;
                const nameEl = document.getElementById('social-client-name');
                if (nameEl) nameEl.textContent = this.currentClientName;
            }
        },

        changeMonth: async function(delta) {
            if (delta < 0 && global.CalendarStateManager?.prevMonth) {
                await global.CalendarStateManager.prevMonth();
                return;
            }
            if (delta > 0 && global.CalendarStateManager?.nextMonth) {
                await global.CalendarStateManager.nextMonth();
                return;
            }
            return;
        },

        loadCalendarForMonth: async function(dateRef) {
            if (!this.currentClientId) return;

            if (!global.CalendarStateManager?.goToMonth) return;
            if (!(dateRef instanceof Date) || Number.isNaN(dateRef.getTime())) return;
            await global.CalendarStateManager.goToMonth(dateRef.getFullYear(), dateRef.getMonth() + 1);
        },
        
        createPostFromCalendarItem: async function(calendarItem, calendarId, clientId) {
            try {
                if (!calendarItem?.id || !calendarId || !clientId) return;
                this._autoCreatedFromItems = this._autoCreatedFromItems || new Set();
                const key = `${calendarId}:${calendarItem.id}`;
                if (this._autoCreatedFromItems.has(key)) return;
                // Verifica se já existe post para o item
                const existing = await global.SocialMediaRepo?.getPostByCalendarItemId?.(calendarItem.id);
                if (existing?.id) {
                    // Post já existe — não tocar no status de produção.
                    // Aprovação editorial e aprovação de mídia são etapas independentes.
                    this._autoCreatedFromItems.add(key);
                    return;
                }
                const newPost = await global.SocialMediaRepo?.createPost?.({
                    calendar_id: calendarId,
                    calendar_item_id: calendarItem.id,
                    cliente_id: clientId,
                    status: 'draft',
                    data_agendada: String(calendarItem.data || '').slice(0, 10),
                    tema: calendarItem.tema || null,
                    formato: calendarItem.tipo_conteudo || 'post_estatico',
                    plataforma: calendarItem.canal || 'instagram',
                    editorial_approved_at: new Date().toISOString(),
                    editorial_item_status: 'approved'
                });
                this._autoCreatedFromItems.add(key);

                // Registrar evento: transição editorial → produção
                const newPostId = newPost?.[0]?.id || newPost?.id || null;
                if (newPostId && global.SocialMediaRepo?.logPostEvent) {
                    global.SocialMediaRepo.logPostEvent(newPostId, {
                        decision: 'editorial_approved',
                        comment: calendarItem.tema ? `Tema aprovado: ${calendarItem.tema}` : 'Tema editorial aprovado — produção iniciada',
                        status_novo: 'draft'
                    }).catch(() => {});
                }
            } catch (err) {
                console.warn('[AutoCreatePost] falha silenciosa:', err?.message || err);
            }
        },

        syncChangesRequestedPost: async function(calendarItem, calendarId, clientId) {
            try {
                if (!calendarItem?.id || !calendarId || !clientId) return;
                this._syncedChangesRequested = this._syncedChangesRequested || new Set();
                const key = `${calendarId}:${calendarItem.id}:changes`;
                if (this._syncedChangesRequested.has(key)) return;
                this._syncedChangesRequested.add(key);
                const comment = String(calendarItem?.comentario_cliente || '').trim();
                // Ajuste editorial ≠ ajuste de mídia.
                // Usar status 'draft' para indicar que o post está em revisão editorial,
                // sem contaminar o fluxo de aprovação de mídia (changes_requested).
                const result = await global.SocialMediaRepo?.upsertPostForCalendarItem?.({
                    calendarId,
                    calendarItemId: calendarItem.id,
                    clientId,
                    status: 'draft',
                    data_agendada: calendarItem.data,
                    tema: calendarItem.tema,
                    formato: calendarItem.tipo_conteudo,
                    plataforma: calendarItem.canal,
                    comentario_cliente: comment
                });
                if (result?.ok !== true) {
                    console.warn('[AgencyCalendar] syncChangesRequestedPost failed:', { calendarItemId: calendarItem.id, error: result?.error || null });
                } else {
                    console.log('[AgencyCalendar] syncChangesRequestedPost ok:', { calendarItemId: calendarItem.id, postId: result?.data?.id || null });
                    if (global.CalendarStateManager?.refreshMonthData) {
                        await global.CalendarStateManager.refreshMonthData();
                    }
                }
            } catch (err) {
                console.warn('[AgencyCalendar] syncChangesRequestedPost exception:', err?.message || err);
            }
        },

        handlePostMove: async function(postId, newDate) {
            console.log(`[SOCIAL] Movendo post ${postId} para ${newDate}`);

            const success = await global.SocialMediaRepo.updatePostDate(postId, newDate);

            if (success) {
                // Registrar evento de mudança de data no histórico
                global.SocialMediaRepo?.logPostEvent?.(postId, {
                    decision: 'date_moved',
                    comment: newDate,
                    status_anterior: null,
                    status_novo: null
                }).catch(() => {});

                if (global.CalendarStateManager?.refreshMonthData) {
                    await global.CalendarStateManager.refreshMonthData();
                } else {
                    await this.loadCalendarForMonth(this.currentMonthRef);
                }
            } else {
                alert('Erro ao mover o post. Tente novamente.');
                if (global.CalendarStateManager?.refreshMonthData) {
                    await global.CalendarStateManager.refreshMonthData();
                } else {
                    await this.loadCalendarForMonth(this.currentMonthRef);
                }
            }
        },

        showEmptyState: function() {
            if (global.SocialMediaUI && global.SocialMediaUI.showEmptyState) {
                global.SocialMediaUI.showEmptyState();
            }
        },

        startCreate: function(date, source = 'pipeline') {
            console.log('[SOCIAL] Iniciando criação para data:', date);
            if (global.SocialMediaUI) {
                global.SocialMediaUI.renderCreateForm({ data_agendada: date, status: 'rascunho' }, null, source || 'pipeline');
            }
        },

        startEdit: function(post, initialTab, source = 'pipeline') {
            console.log('[SOCIAL] Iniciando edição do post:', post.id);
            if (global.SocialMediaUI) {
                global.SocialMediaUI.renderCreateForm(post, initialTab || null, source || 'pipeline');
            }
        },

        normalizePostStatusKey: function(raw) {
            const key = String(raw || '').trim().toLowerCase();
            if (!key) return 'draft';
            if (global.GQV_CONSTANTS?.getSocialStatusKey) return global.GQV_CONSTANTS.getSocialStatusKey(key);
            return key;
        },

        getPostScheduleDateTimeMs: function(post) {
            const rawDate = String(post?.data_agendada || post?.data_postagem || '').trim();
            const rawTime = String(post?.hora_agendada || post?.hora_agendamento || '').trim();
            if (!rawDate) return NaN;
            const hasTimeInDate = rawDate.includes('T');
            const combined = hasTimeInDate ? rawDate : `${rawDate.slice(0, 10)}T${rawTime || '10:00'}:00`;
            const ms = new Date(combined).getTime();
            return Number.isFinite(ms) ? ms : NaN;
        },

        isPostDueToPublish: function(post) {
            const status = this.normalizePostStatusKey(post?.status);
            if (status !== 'scheduled') return false;
            const scheduledMs = this.getPostScheduleDateTimeMs(post);
            if (!Number.isFinite(scheduledMs)) return false;
            return scheduledMs <= Date.now();
        },

        logLifecycleEvent: async function(postId, decision, comment, extra = {}) {
            if (!postId || !global.SocialMediaRepo?.logPostEvent) return;
            await global.SocialMediaRepo.logPostEvent(postId, {
                decision,
                comment: comment || null,
                status_anterior: extra?.statusAnterior || null,
                status_novo: extra?.statusNovo || null,
                actor_type: extra?.actorType || 'agency_user'
            });
        },

        ensurePostFromCalendarItem: async function(item, fallbackDate) {
            const itemId = item?.id || null;
            if (!itemId || !this.currentClientId) return null;
            const existing = await global.SocialMediaRepo?.getPostByCalendarItemId?.(itemId);
            if (existing?.id) return existing;

            const snap = this.getCalendarSnap();
            const created = await global.SocialMediaRepo?.createPost?.({
                calendar_id: snap?.activeCalendarId || null,
                calendar_item_id: itemId,
                cliente_id: this.currentClientId,
                status: 'draft',
                data_agendada: String(item?.data || fallbackDate || '').slice(0, 10),
                tema: item?.tema || 'Conteúdo',
                formato: item?.tipo_conteudo || 'post_estatico',
                plataforma: item?.canal || 'instagram'
            });
            const post = Array.isArray(created) ? created[0] : created;
            if (post?.id) {
                await this.logLifecycleEvent(post.id, 'content_created_calendar', 'Conteúdo criado no calendário', { statusNovo: 'draft' });
            }
            return post || null;
        },

        handleCalendarItemClick: async function(detail) {
            const itemId = detail?.itemId ?? null;
            const date = String(detail?.date || '').slice(0, 10);
            const snap = this.getCalendarSnap();
            const items = Array.isArray(snap?.editorialItems) ? snap.editorialItems : [];
            const selected = itemId ? items.find((it) => String(it?.id) === String(itemId)) : null;

            if (selected) {
                const post = await this.ensurePostFromCalendarItem(selected, date);
                if (post?.id) {
                    this.startEdit(post, null, 'calendar');
                    return;
                }
            }
            this.startCreate(date, 'calendar');
        },

        processAutoPublishPosts: async function(posts) {
            const list = Array.isArray(posts) ? posts : [];
            if (!list.length) return;
            this._autoPublishInFlight = this._autoPublishInFlight || new Set();
            for (const post of list) {
                const postId = post?.id;
                if (!postId || !this.isPostDueToPublish(post)) continue;
                if (this._autoPublishInFlight.has(postId)) continue;
                this._autoPublishInFlight.add(postId);
                try {
                    const ok = await global.SocialMediaRepo?.updatePostStatus?.(postId, 'published');
                    if (ok) {
                        await this.logLifecycleEvent(postId, 'post_published', 'Publicado', {
                            statusAnterior: post?.status || 'scheduled',
                            statusNovo: 'published',
                            actorType: 'system'
                        });
                    }
                } catch (err) {
                    console.warn('[SOCIAL] falha auto-publicação:', err?.message || err);
                } finally {
                    this._autoPublishInFlight.delete(postId);
                }
            }
        },

        processLifecycleEvents: async function(postId, beforePost, afterPost, context = {}) {
            if (!postId) return;
            const prevStatus = this.normalizePostStatusKey(beforePost?.status);
            const nextStatus = this.normalizePostStatusKey(afterPost?.status);
            const hadMediaBefore = !!String(beforePost?.imagem_url || '').trim();
            const hasMediaNow = !!String(afterPost?.imagem_url || '').trim();

            if (context?.isCreate && context?.source === 'calendar') {
                await this.logLifecycleEvent(postId, 'content_created_calendar', 'Conteúdo criado no calendário', { statusNovo: nextStatus || 'draft' });
            }

            if (!hadMediaBefore && hasMediaNow) {
                await this.logLifecycleEvent(postId, 'media_card_created', 'Card de mídia criado', { statusAnterior: prevStatus, statusNovo: nextStatus });
                await this.logLifecycleEvent(postId, 'media_inserted', 'Mídia inserida', { statusAnterior: prevStatus, statusNovo: nextStatus });
            }

            if (prevStatus !== nextStatus) {
                if (nextStatus === 'ready_for_approval') {
                    if (prevStatus === 'changes_requested') {
                        await this.logLifecycleEvent(postId, 'media_adjusted_waiting_approval', 'Mídia ajustada aguardando aprovação', { statusAnterior: prevStatus, statusNovo: nextStatus });
                    } else if (hasMediaNow || hadMediaBefore) {
                        await this.logLifecycleEvent(postId, 'media_sent_for_approval', 'Mídia enviada para aprovação', { statusAnterior: prevStatus, statusNovo: nextStatus });
                    } else {
                        await this.logLifecycleEvent(postId, 'content_sent_for_approval', 'Conteúdo enviado para aprovação', { statusAnterior: prevStatus, statusNovo: nextStatus });
                    }
                } else if (nextStatus === 'approved') {
                    if (hasMediaNow || hadMediaBefore) {
                        await this.logLifecycleEvent(postId, 'post_client_approved', 'Postagem aprovada pelo cliente', { statusAnterior: prevStatus, statusNovo: nextStatus });
                    } else {
                        await this.logLifecycleEvent(postId, 'content_approved', 'Conteúdo aprovado', { statusAnterior: prevStatus, statusNovo: nextStatus });
                    }
                } else if (nextStatus === 'changes_requested') {
                    if (hasMediaNow || hadMediaBefore) {
                        await this.logLifecycleEvent(postId, 'media_in_review', 'Mídia para revisão (cliente solicitou ajustes)', { statusAnterior: prevStatus, statusNovo: nextStatus });
                    } else {
                        await this.logLifecycleEvent(postId, 'content_changes_requested', 'Cliente solicitou ajustes no conteúdo', { statusAnterior: prevStatus, statusNovo: nextStatus });
                    }
                } else if (nextStatus === 'scheduled') {
                    await this.logLifecycleEvent(postId, 'post_scheduled', 'Post agendado', { statusAnterior: prevStatus, statusNovo: nextStatus });
                } else if (nextStatus === 'published') {
                    await this.logLifecycleEvent(postId, 'post_published', 'Publicado', { statusAnterior: prevStatus, statusNovo: nextStatus });
                }
            }
        },

        handleSavePost: async function() {
            if (!this.currentClientId) {
                alert('Selecione um cliente primeiro.');
                return;
            }

            const drawer = document.getElementById('social-post-drawer');
            const mode = drawer.dataset.mode;
            const postId = drawer.dataset.postId;
            
            if (this.isDebug()) console.log(`[SocialMediaV2] handleSavePost start. Mode: ${mode}, PostID: ${postId}`);

            // Get data from UI
            const formData = global.SocialMediaUI.getFormData();
            
            const input = {
                cliente_id: this.currentClientId,
                ...formData
            };

            const saveStatusKey = this.normalizePostStatusKey(input?.status);
            if (saveStatusKey === 'scheduled') {
                const hasDate = !!String(input?.data_agendamento || input?.data_postagem || '').trim();
                const hasTime = !!String(input?.hora_agendada || input?.hora_agendamento || '').trim();
                if (!hasDate || !hasTime) {
                    if (global.SocialMediaUI?.showFeedback) {
                        global.SocialMediaUI.showFeedback('Para agendar, informe data e hora.', 'error');
                    } else {
                        alert('Para agendar, informe data e hora.');
                    }
                    return;
                }
            }

            if (this.isDebug()) console.log('[SocialMediaV2] handleSavePost payload:', input);

            const saveBtn = document.getElementById('social-post-save');
            const originalText = saveBtn ? saveBtn.innerHTML : 'Salvar';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            }

            try {
                const source = String(drawer?.dataset?.openSource || 'pipeline').trim() || 'pipeline';
                let beforePost = null;
                let savedPost = null;
                if (mode === 'edit' && postId && postId !== 'undefined' && postId !== '') {
                    if (this.isDebug()) console.log('[SocialMediaV2] Updating existing post...', postId);
                    beforePost = global.SocialMediaUI?._activePost || null;
                    const updated = await global.SocialMediaRepo.updatePost(postId, input);
                    if (updated) {
                         savedPost = Array.isArray(updated) ? updated[0] : updated;
                         if (this.isDebug()) console.log('[SocialMediaV2] Post updated successfully:', updated);
                         if (global.SocialMediaUI.showFeedback) global.SocialMediaUI.showFeedback('Atualizado com sucesso!', 'success');
                         global.SocialMediaRepo?.logPostEvent?.(postId, {
                             decision: 'agency_updated_content',
                             status_anterior: beforePost?.status || null,
                             status_novo: savedPost?.status || null
                         });
                    } else {
                         throw new Error('Falha ao atualizar (retorno vazio).');
                    }
                } else {
                    if (this.isDebug()) console.log('[SocialMediaV2] Creating new post...', input);
                    const created = await global.SocialMediaRepo.createPost(input);
                    if (created) {
                         savedPost = Array.isArray(created) ? created[0] : created;
                         if (this.isDebug()) console.log('[SocialMediaV2] Post created successfully:', created);
                         if (global.SocialMediaUI.showFeedback) global.SocialMediaUI.showFeedback('Post criado com sucesso!', 'success');
                    } else {
                         throw new Error('Falha ao criar post (retorno vazio).');
                    }
                }

                if (savedPost?.id) {
                    await this.processLifecycleEvents(savedPost.id, beforePost, savedPost, {
                        isCreate: mode !== 'edit',
                        source
                    });
                    const beforeStatus = this.normalizePostStatusKey(beforePost?.status);
                    const afterStatus = this.normalizePostStatusKey(savedPost?.status);
                    const beforeDate = String(beforePost?.data_agendada || '').slice(0, 16);
                    const afterDate = String(savedPost?.data_agendada || '').slice(0, 16);
                    const beforeTime = String(beforePost?.hora_agendada || '').slice(0, 5);
                    const afterTime = String(savedPost?.hora_agendada || '').slice(0, 5);
                    if (afterStatus === 'scheduled' && beforeStatus === 'scheduled' && (beforeDate !== afterDate || beforeTime !== afterTime)) {
                        await this.logLifecycleEvent(savedPost.id, 'post_scheduled', 'Post agendado', {
                            statusAnterior: beforePost?.status || 'scheduled',
                            statusNovo: savedPost?.status || 'scheduled'
                        });
                    }
                    if (this.isPostDueToPublish(savedPost)) {
                        const promoted = await global.SocialMediaRepo?.updatePostStatus?.(savedPost.id, 'published');
                        if (promoted) {
                            await this.logLifecycleEvent(savedPost.id, 'post_published', 'Publicado', {
                                statusAnterior: savedPost?.status || 'scheduled',
                                statusNovo: 'published',
                                actorType: 'system'
                            });
                        }
                    }
                }
                
                // Fecha drawer
                if (global.SocialMediaUI.closeDrawer) {
                    global.SocialMediaUI.closeDrawer();
                }

                // Recarregar calendário
                if (global.CalendarStateManager?.refreshMonthData) {
                    await global.CalendarStateManager.refreshMonthData();
                } else {
                    await this.loadCalendarForMonth(this.currentMonthRef);
                }
                
            } catch (err) {
                console.error('[SOCIAL] Erro crítico ao salvar:', err);
                if (global.SocialMediaUI.showFeedback) global.SocialMediaUI.showFeedback('Erro ao salvar: ' + err.message, 'error');
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = originalText;
                }
            }
        },

        handleDeletePost: async function(postId) {
            if (!confirm('Tem certeza que deseja excluir este post?')) return;

            try {
                console.log('[SOCIAL] Excluindo post...', postId);
                const success = await global.SocialMediaRepo.deletePost(postId);
                
                if (success) {
                    if (global.SocialMediaUI.closeDrawer) {
                        global.SocialMediaUI.closeDrawer();
                    }
                    // Recarregar calendário
                    if (global.CalendarStateManager?.refreshMonthData) {
                        await global.CalendarStateManager.refreshMonthData();
                    } else {
                        await this.loadCalendarForMonth(this.currentMonthRef);
                    }
                    if (global.SocialMediaUI.showFeedback) global.SocialMediaUI.showFeedback('Excluído!', 'success');
                } else {
                    alert('Erro ao excluir post.');
                }
            } catch (err) {
                console.error('[SOCIAL] Erro ao excluir:', err);
                alert('Erro crítico ao excluir.');
            }
        }
    };

    global.SocialMediaCore = SocialMediaCore;

    global.addEventListener('v2:ready', () => SocialMediaCore.init());

})(window);
