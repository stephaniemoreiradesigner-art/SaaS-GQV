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

        init: async function() {
            if (this.initialized) return;
            console.log('[SOCIAL] Inicializando Core...');
            const isDebug = () => global.__GQV_DEBUG_CONTEXT__ === true;

            // Dependências
            if (!global.SocialMediaRepo) console.warn('[SOCIAL] Repo não carregado!');
            if (!global.SocialMediaCalendar) console.warn('[SOCIAL] Calendar não carregado!');
            if (!global.SocialMediaUI) console.warn('[SOCIAL] UI não carregado!');

            // Inscrever-se no Contexto
            if (global.ClientContext) {
                global.ClientContext.subscribe((clientId) => {
                    const name = localStorage.getItem('GQV_ACTIVE_CLIENT_NAME') || null;
                    if (isDebug()) console.log('[SocialMediaV2] active client received:', { clientId, clientName: name });
                    this.onClientChange(clientId, name);
                });
            }

            // Ouvir evento global também (segurança)
            window.addEventListener('gqv:client-changed', (e) => {
                if (e.detail && e.detail.clientId) {
                    if (isDebug()) console.log('[SocialMediaV2] client changed received:', { clientId: e.detail.clientId, clientName: e.detail.clientName || null });
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
                newPostBtn.addEventListener('click', () => {
                    this.startCreate(new Date().toISOString().slice(0, 10));
                });
            }

            // Navegação de mês
            const prevBtn = document.getElementById('social-month-prev');
            const nextBtn = document.getElementById('social-month-next');
            if (prevBtn) prevBtn.addEventListener('click', () => this.changeMonth(-1));
            if (nextBtn) nextBtn.addEventListener('click', () => this.changeMonth(1));

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

        onClientChange: async function(clientId, clientName) {
            const isDebug = () => global.__GQV_DEBUG_CONTEXT__ === true;
            if (!clientId) {
                this.currentClientId = null;
                this.currentClientName = null;
                this.showEmptyState();
                return;
            }

            const resolvedName = clientName || localStorage.getItem('GQV_ACTIVE_CLIENT_NAME') || 'Cliente';
            if (isDebug()) console.log('[SocialMediaV2] render for client:', { clientId, clientName: resolvedName });

            // Se mudou o cliente, reseta o estado
            if (clientId !== this.currentClientId) {
                this.currentClientId = clientId;
                this.currentClientName = resolvedName;
                console.log(`[SOCIAL] Cliente alterado: ${clientId}`);
                
                // Atualiza UI básica
                const nameEl = document.getElementById('social-client-name');
                if (nameEl) nameEl.textContent = this.currentClientName;
                
                if (global.SocialMediaUI && global.SocialMediaUI.showContent) {
                    global.SocialMediaUI.showContent();
                }
                
                // Carrega calendário do mês atual
                await this.loadCalendarForMonth(new Date());
            } else if (resolvedName && resolvedName !== this.currentClientName) {
                this.currentClientName = resolvedName;
                const nameEl = document.getElementById('social-client-name');
                if (nameEl) nameEl.textContent = this.currentClientName;
            }
        },

        changeMonth: async function(delta) {
            if (!this.currentMonthRef) this.currentMonthRef = new Date();
            
            const newDate = new Date(this.currentMonthRef);
            newDate.setMonth(newDate.getMonth() + delta);
            
            await this.loadCalendarForMonth(newDate);
        },

        loadCalendarForMonth: async function(dateRef) {
            const isDebug = () => global.__GQV_DEBUG_CONTEXT__ === true;
            if (!this.currentClientId) return;

            this.currentMonthRef = dateRef;
            const monthStr = dateRef.toISOString().slice(0, 7) + '-01'; // YYYY-MM-01
            if (isDebug()) console.log('[SocialMediaV2] render for client:', { clientId: this.currentClientId, monthRef: monthStr });

            if (global.SocialMediaUI && global.SocialMediaUI.showLoading) {
                global.SocialMediaUI.showLoading();
            }

            try {
                // 1. Busca/Cria Calendário
                const calendar = await global.SocialMediaRepo.getCalendarByMonth(this.currentClientId, monthStr);
                
                if (calendar) {
                    this.currentCalendarId = calendar.id;
                    
                    // 2. Busca Posts
                    const posts = await global.SocialMediaRepo.getPostsByCalendar(calendar.id);
                    this.currentPosts = Array.isArray(posts) ? posts : [];
                    
                    // 3. Renderiza
                    if (global.SocialMediaCalendar) {
                        global.SocialMediaCalendar.render(this.currentPosts, dateRef);
                    }
                    if (global.SocialMediaUI && typeof global.SocialMediaUI.renderPostsBoard === 'function') {
                        global.SocialMediaUI.renderPostsBoard(this.currentPosts, dateRef);
                    }
                    
                    // Atualiza status na UI
                    const statusEl = document.getElementById('social-calendar-status');
                    if (statusEl) {
                        const statusMap = {
                            'draft': 'Rascunho',
                            'in_production': 'Em produção',
                            'awaiting_approval': 'Aguardando Aprovação',
                            'ready_for_approval': 'Aguardando Aprovação',
                            'approved': 'Aprovado',
                            'published': 'Publicado',
                            'archived': 'Arquivado',
                            'changes_requested': 'Ajustes Solicitados'
                        };
                        const status = calendar.status || 'draft';
                        statusEl.textContent = statusMap[status] || status;
                        statusEl.className = 'text-xs uppercase bg-slate-100 text-slate-500 px-3 py-1 rounded-full'; // Reset classes
                        
                        if (status === 'approved') statusEl.classList.add('bg-green-100', 'text-green-700');
                        if (status === 'awaiting_approval' || status === 'ready_for_approval') statusEl.classList.add('bg-yellow-100', 'text-yellow-700');
                        if (status === 'in_production') statusEl.classList.add('bg-blue-100', 'text-blue-700');
                        if (status === 'changes_requested') statusEl.classList.add('bg-red-100', 'text-red-700');
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
                await this.loadCalendarForMonth(this.currentMonthRef);
            } else {
                alert('Erro ao mover o post. Tente novamente.');
                await this.loadCalendarForMonth(this.currentMonthRef);
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
            
            console.log(`[SOCIAL] handleSavePost acionado. Mode: ${mode}, PostID: ${postId}`);

            // Get data from UI
            const formData = global.SocialMediaUI.getFormData();
            
            const input = {
                cliente_id: this.currentClientId,
                ...formData
            };

            const saveBtn = document.getElementById('social-post-save');
            const originalText = saveBtn ? saveBtn.innerHTML : 'Salvar';
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            }

            try {
                if (mode === 'edit' && postId && postId !== 'undefined' && postId !== '') {
                    console.log('[SOCIAL] Atualizando post existente...', postId);
                    const updated = await global.SocialMediaRepo.updatePost(postId, input);
                    if (updated) {
                         if (global.SocialMediaUI.showFeedback) global.SocialMediaUI.showFeedback('Atualizado com sucesso!', 'success');
                    } else {
                         throw new Error('Falha ao atualizar (retorno vazio).');
                    }
                } else {
                    console.log('[SOCIAL] Criando novo post...', input);
                    const created = await global.SocialMediaRepo.createPost(input);
                    if (created) {
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
                await this.loadCalendarForMonth(this.currentMonthRef);
                
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
                    await this.loadCalendarForMonth(this.currentMonthRef);
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
