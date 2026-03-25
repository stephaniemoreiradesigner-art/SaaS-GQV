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
                    this.startEdit(e.detail.post);
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
                    this.openPlanning({ date: e.detail.date });
                }
            });
            document.addEventListener('v2:calendar-item-add', (e) => {
                if (e.detail && e.detail.date) {
                    this.openPlanning({ date: e.detail.date });
                }
            });
            document.addEventListener('v2:calendar-item-click', (e) => {
                const itemId = e?.detail?.itemId ?? null;
                const date = e?.detail?.date ?? null;
                this.openPlanning({ itemId, date });
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
                        this.openPlanning({ date: todayStr });
                        return;
                    }
                    this.startCreate(todayStr);
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
            if (!global.SocialMediaUI?.openPlanningModal) {
                this.setAgencyFeedback('Planejamento indisponível.', 'error');
                return;
            }
            global.SocialMediaUI.openPlanningModal({
                clientId: this.currentClientId,
                monthKey: snap?.monthKey || '',
                calendarId: snap?.activeCalendarId || null,
                calendarStatus: snap?.calendarStatus || null,
                editorialItems: Array.isArray(snap?.editorialItems) ? snap.editorialItems : [],
                date,
                itemId
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
                                // Auto-criação: detectar itens aprovados e gerar post único
                                const items = Array.isArray(snap.editorialItems) ? snap.editorialItems : [];
                                items.forEach((it) => {
                                    const meta = global.GQV_STATUS_MAP?.getCalendarItemStatusMeta ? global.GQV_STATUS_MAP.getCalendarItemStatusMeta(it.status) : null;
                                    const isApproved = String(meta?.key || '').trim() === 'approved';
                                    if (isApproved) {
                                        this.createPostFromCalendarItem(it, snap.activeCalendarId, snap.clientId);
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
                    const currentStatus = String(existing?.status || '').trim().toLowerCase();
                    if (currentStatus === 'approved') {
                        await global.SocialMediaRepo?.updatePost?.(existing.id, { status: 'draft' });
                    }
                    this._autoCreatedFromItems.add(key);
                    return;
                }
                await global.SocialMediaRepo?.createPost?.({
                    calendar_id: calendarId,
                    calendar_item_id: calendarItem.id,
                    cliente_id: clientId,
                    status: 'draft',
                    data_agendada: String(calendarItem.data || '').slice(0, 10),
                    tema: calendarItem.tema || null,
                    formato: calendarItem.tipo_conteudo || 'post_estatico',
                    plataforma: calendarItem.canal || 'instagram'
                });
                this._autoCreatedFromItems.add(key);
            } catch (err) {
                console.warn('[AutoCreatePost] falha silenciosa:', err?.message || err);
            }
        },

        handlePostMove: async function(postId, newDate) {
            console.log(`[SOCIAL] Movendo post ${postId} para ${newDate}`);
            
            const success = await global.SocialMediaRepo.updatePostDate(postId, newDate);
            
            if (success) {
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

        startCreate: function(date) {
            console.log('[SOCIAL] Iniciando criação para data:', date);
            if (global.SocialMediaUI) {
                global.SocialMediaUI.renderCreateForm({ data_agendada: date, status: 'rascunho' });
            }
        },

        startEdit: function(post) {
            console.log('[SOCIAL] Iniciando edição do post:', post.id);
            if (global.SocialMediaUI) {
                global.SocialMediaUI.renderCreateForm(post);
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

            if (this.isDebug()) console.log('[SocialMediaV2] handleSavePost payload:', input);

            const saveBtn = document.getElementById('social-post-save');
            const originalText = saveBtn ? saveBtn.innerHTML : 'Salvar';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            }

            try {
                if (mode === 'edit' && postId && postId !== 'undefined' && postId !== '') {
                    if (this.isDebug()) console.log('[SocialMediaV2] Updating existing post...', postId);
                    const updated = await global.SocialMediaRepo.updatePost(postId, input);
                    if (updated) {
                         if (this.isDebug()) console.log('[SocialMediaV2] Post updated successfully:', updated);
                         if (global.SocialMediaUI.showFeedback) global.SocialMediaUI.showFeedback('Atualizado com sucesso!', 'success');
                    } else {
                         throw new Error('Falha ao atualizar (retorno vazio).');
                    }
                } else {
                    if (this.isDebug()) console.log('[SocialMediaV2] Creating new post...', input);
                    const created = await global.SocialMediaRepo.createPost(input);
                    if (created) {
                         if (this.isDebug()) console.log('[SocialMediaV2] Post created successfully:', created);
                         if (global.SocialMediaUI.showFeedback) global.SocialMediaUI.showFeedback('Post criado com sucesso!', 'success');
                    } else {
                         throw new Error('Falha ao criar post (retorno vazio).');
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
