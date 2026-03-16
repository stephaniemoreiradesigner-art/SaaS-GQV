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
                    const name = localStorage.getItem('GQV_ACTIVE_CLIENT_NAME') || null;
                    if (this.isDebug()) console.log('[SocialMediaV2] active client received:', { clientId, clientName: name });
                    this.onClientChange(clientId, name);
                });
            }

            // Ouvir evento global também (segurança)
            window.addEventListener('gqv:client-changed', (e) => {
                if (e.detail && e.detail.clientId) {
                    if (this.isDebug()) console.log('[SocialMediaV2] client changed received:', { clientId: e.detail.clientId, clientName: e.detail.clientName || null });
                    this.onClientChange(e.detail.clientId, e.detail.clientName);
                }
            });

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
                    this.startCreate(e.detail.date);
                }
            });
            
            // Ouvir botão Novo Post
            const newPostBtn = document.getElementById('social-new-post');
            if (newPostBtn) {
                newPostBtn.onclick = () => {
                    const todayStr = global.CalendarStateSelectors?.getTodayLocalDate ? global.CalendarStateSelectors.getTodayLocalDate() : '';
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

            // Estado inicial
            if (global.ClientContext) {
                const activeId = global.ClientContext.getActiveClient();
                if (activeId) {
                    const name = localStorage.getItem('GQV_ACTIVE_CLIENT_NAME');
                    this.onClientChange(activeId, name);
                } else {
                    this.showEmptyState();
                }
            }

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

        updateCalendarActionButtons: function(snap) {
            const sendBtn = document.getElementById('social-send-approval');
            const delBtn = document.getElementById('social-delete-calendar');
            const status = String(snap?.calendarStatus || '').trim().toLowerCase();
            const itemsCount = Array.isArray(snap?.editorialItems) ? snap.editorialItems.length : 0;
            const isDraft = status === 'draft' || status === 'rascunho';
            const canSend = (status === 'draft' || status === 'rascunho' || status === 'changes_requested') && itemsCount > 0;
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
                console.log('[AgencyCalendar] approval payload', { calendarId, clientId, status: 'aguardando_aprovacao' });
                const res = global.SocialMediaRepo?.updateCalendarStatus
                    ? await global.SocialMediaRepo.updateCalendarStatus(calendarId, clientId, 'aguardando_aprovacao')
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

            const resolvedName = clientName || localStorage.getItem('GQV_ACTIVE_CLIENT_NAME') || 'Cliente';
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

                            this.currentCalendarId = snap.activeCalendarId || null;
                            this.currentMonthRef = snap.monthStart instanceof Date ? snap.monthStart : new Date();
                            this.currentPosts = Array.isArray(snap.monthPosts) ? snap.monthPosts : [];

                            if (global.SocialMediaCalendar?.renderFromState) {
                                global.SocialMediaCalendar.renderFromState(snap);
                            } else if (global.SocialMediaCalendar?.render) {
                                global.SocialMediaCalendar.render(this.currentPosts, this.currentMonthRef);
                            }

                            if (global.SocialMediaUI?.renderPostsBoard) {
                                global.SocialMediaUI.renderPostsBoard(this.currentPosts, snap.monthKey || '');
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
            if (!this.currentMonthRef) this.currentMonthRef = new Date();
            const newDate = new Date(this.currentMonthRef);
            newDate.setMonth(newDate.getMonth() + delta);
            await this.loadCalendarForMonth(newDate);
        },

        loadCalendarForMonth: async function(dateRef) {
            if (!this.currentClientId) return;

            if (global.CalendarStateManager?.goToMonth && dateRef instanceof Date && !Number.isNaN(dateRef.getTime())) {
                await global.CalendarStateManager.goToMonth(dateRef.getFullYear(), dateRef.getMonth() + 1);
                return;
            }

            this.currentMonthRef = dateRef;
            const monthKey = global.CalendarStateSelectors?.formatMonthKeyFromDate ? global.CalendarStateSelectors.formatMonthKeyFromDate(dateRef) : '';
            if (this.isDebug()) console.log('[SocialMediaV2] loadCalendarForMonth:', { clientId: this.currentClientId, monthKey });

            if (global.SocialMediaUI && global.SocialMediaUI.showLoading) {
                global.SocialMediaUI.showLoading();
            }

            try {
                // 1. Busca/Cria Calendário
                const calendar = await global.SocialMediaRepo.getCalendarByMonth(this.currentClientId, monthKey);
                
                if (calendar) {
                    this.currentCalendarId = calendar.id;
                    
                    // 2. Busca Posts do mês por range
                    const range = global.CalendarStateSelectors?.getMonthRange ? global.CalendarStateSelectors.getMonthRange(monthKey) : null;
                    const posts = range && global.SocialMediaRepo?.getPostsByDateRange
                        ? await global.SocialMediaRepo.getPostsByDateRange(this.currentClientId, range.startDate, range.endDateExclusive)
                        : [];
                    this.currentPosts = Array.isArray(posts) ? posts : [];
                    
                    // 3. Renderiza
                    if (global.SocialMediaCalendar) {
                        global.SocialMediaCalendar.render(this.currentPosts, dateRef);
                    }
                    if (global.SocialMediaUI && typeof global.SocialMediaUI.renderPostsBoard === 'function') {
                        global.SocialMediaUI.renderPostsBoard(this.currentPosts, monthKey);
                    }
                    
                    // Atualiza status na UI
                    const statusEl = document.getElementById('social-calendar-status');
                    if (statusEl) {
                        const rawStatus = String(calendar.status || 'draft');
                        const normalized = global.GQV_CONSTANTS?.getSocialCalendarStatusKey
                            ? global.GQV_CONSTANTS.getSocialCalendarStatusKey(rawStatus)
                            : String(rawStatus || '').trim().toLowerCase();
                        const label = global.GQV_CONSTANTS?.getSocialCalendarStatusLabelPt
                            ? global.GQV_CONSTANTS.getSocialCalendarStatusLabelPt(rawStatus)
                            : (normalized ? normalized.replace(/_/g, ' ') : '-');
                        statusEl.textContent = label;
                        statusEl.className = 'text-xs uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full'; // Reset classes
                        
                        if (normalized === 'approved') statusEl.classList.add('bg-green-100', 'text-green-700');
                        if (normalized === 'sent_for_approval') statusEl.classList.add('bg-yellow-100', 'text-yellow-700');
                        if (normalized === 'needs_changes') statusEl.classList.add('bg-red-100', 'text-red-700');
                    }
                    
                    // Exibir feedback do cliente se houver ajustes solicitados
                    if (calendar.status === 'changes_requested' && calendar.comentario_cliente) {
                        if (global.SocialMediaUI.showFeedback) {
                            global.SocialMediaUI.showFeedback(`Cliente solicitou ajustes: "${calendar.comentario_cliente}"`, 'error');
                        }
                    }
                } else {
                    console.error('[SOCIAL] Falha ao carregar calendário.');
                }
            } catch (err) {
                console.error('[SOCIAL] Erro no fluxo de carregamento:', err);
            } finally {
                if (global.SocialMediaUI && global.SocialMediaUI.hideLoading) {
                    global.SocialMediaUI.hideLoading();
                }
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
