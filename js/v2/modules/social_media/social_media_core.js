// js/v2/modules/social_media/social_media_core.js
// Núcleo do Módulo Social Media V2
// Reage a mudanças no ClientContext e atualiza a UI

(function(global) {
    const SocialMediaCore = {
        initialized: false,
        currentClientId: null,
        currentClientName: null, // Armazenar nome para reuso

        init: async function() {
            if (this.initialized) return;
            console.log('[SocialMediaCore V2] Inicializando...');

            if (!global.SocialMediaRepo || !global.SocialMediaUI || !global.ClientContext) {
                console.error('[SocialMediaCore V2] Dependências ausentes.');
                return;
            }

            // Inscrever-se no Contexto
            global.ClientContext.subscribe(this.onClientChange.bind(this));

            // Ouvir evento global também (segurança)
            global.addEventListener('gqv:client-changed', (e) => {
                if (e.detail && e.detail.clientId) {
                    this.onClientChange(e.detail.clientId, e.detail.clientName);
                }
            });

            // Delegate de eventos do formulário (para não precisar re-bindar sempre)
            document.addEventListener('submit', (e) => {
                if (e.target && e.target.id === 'v2-create-post-form') {
                    e.preventDefault();
                    this.handleCreateOrUpdatePost(e.target);
                }
            });

            // Delegate para botão cancelar
            document.addEventListener('click', (e) => {
                if (e.target && e.target.id === 'v2-btn-cancel') {
                    this.cancelEdit();
                }
            });

            // Delegate para botão deletar
            document.addEventListener('click', (e) => {
                if (e.target && e.target.closest('#v2-btn-delete')) {
                    const form = document.getElementById('v2-create-post-form');
                    const postId = form ? form.dataset.postId : null;
                    if (postId) {
                        this.handleDeletePost(postId);
                    }
                }
            });

            // Ouvir clique no card para edição
            document.addEventListener('v2:post-click', (e) => {
                if (e.detail && e.detail.post) {
                    this.startEdit(e.detail.post);
                }
            });

            // Estado inicial
            const activeId = global.ClientContext.getActiveClient();
            if (activeId) {
                // Tenta pegar nome do storage se não vier no init
                const name = localStorage.getItem('GQV_ACTIVE_CLIENT_NAME');
                this.onClientChange(activeId, name);
            } else {
                global.SocialMediaUI.showEmptyState();
            }

            this.initialized = true;
        },

        onClientChange: async function(clientId, clientName) {
            if (!clientId) {
                this.currentClientId = null;
                this.currentClientName = null;
                global.SocialMediaUI.showEmptyState();
                return;
            }

            // Evitar reloads desnecessários se for o mesmo ID
            if (clientId === this.currentClientId) return;
            
            this.currentClientId = clientId;
            this.currentClientName = clientName || 'Cliente';
            
            console.log(`[SocialMediaCore V2] Carregando dados para cliente: ${clientId} (${clientName})`);

            global.SocialMediaUI.showLoading();

            try {
                const posts = await global.SocialMediaRepo.getPostsByClient(clientId);
                global.SocialMediaUI.renderFeed(posts, clientName);
                global.SocialMediaUI.renderCalendar(posts); // Renderiza também o calendário
            } catch (err) {
                console.error('[SocialMediaCore V2] Erro no fluxo de carga:', err);
                const container = document.getElementById('v2-social-feed');
                if (container) container.innerHTML = '<div class="text-red-500">Erro ao carregar posts.</div>';
            }
        },

        startEdit: function(post) {
            console.log('[SocialMediaCore V2] Iniciando edição do post:', post.id);
            global.SocialMediaUI.renderCreateForm(post);
        },

        cancelEdit: function() {
            global.SocialMediaUI.renderCreateForm(null); // Volta para modo create
        },

        handleCreateOrUpdatePost: async function(form) {
            if (!this.currentClientId) {
                global.SocialMediaUI.showFeedback('Selecione um cliente primeiro.', 'error');
                return;
            }

            const mode = form.dataset.mode; // 'create' ou 'edit'
            const postId = form.dataset.postId;
            const formData = new FormData(form);
            
            const input = {
                cliente_id: this.currentClientId,
                titulo: formData.get('titulo'),
                legenda: formData.get('legenda'),
                plataforma: formData.get('plataforma'),
                data_postagem: formData.get('data_postagem') || null,
                status: 'rascunho'
            };

            global.SocialMediaUI.setFormLoading(true);

            try {
                if (mode === 'edit' && postId) {
                    console.log('[SocialMediaCore V2] Atualizando post...', postId);
                    await global.SocialMediaRepo.updatePost(postId, input);
                    global.SocialMediaUI.showFeedback('Post atualizado com sucesso!', 'success');
                } else {
                    console.log('[SocialMediaCore V2] Criando post...', input);
                    await global.SocialMediaRepo.createPost(input);
                    global.SocialMediaUI.showFeedback('Rascunho salvo com sucesso!', 'success');
                }
                
                global.SocialMediaUI.clearForm();
                
                // Se estava editando, volta para modo criar
                if (mode === 'edit') {
                    setTimeout(() => this.cancelEdit(), 1000);
                }

                // Recarregar lista
                const posts = await global.SocialMediaRepo.getPostsByClient(this.currentClientId);
                global.SocialMediaUI.renderFeed(posts, this.currentClientName);
                global.SocialMediaUI.renderCalendar(posts); // Atualiza calendário
                
            } catch (err) {
                console.error('[SocialMediaCore V2] Erro ao salvar:', err);
                global.SocialMediaUI.showFeedback('Erro ao salvar. Verifique o console.', 'error');
            } finally {
                global.SocialMediaUI.setFormLoading(false);
            }
        },

        handleDeletePost: async function(postId) {
            if (!confirm('Tem certeza que deseja excluir este post?')) return;

            global.SocialMediaUI.setFormLoading(true); // Bloqueia UI
            
            try {
                console.log('[SocialMediaCore V2] Excluindo post...', postId);
                const success = await global.SocialMediaRepo.deletePost(postId);
                
                if (success) {
                    global.SocialMediaUI.showFeedback('Post excluído.', 'success');
                    this.cancelEdit(); // Limpa form
                    
                    // Recarregar lista
                    const posts = await global.SocialMediaRepo.getPostsByClient(this.currentClientId);
                    global.SocialMediaUI.renderFeed(posts, this.currentClientName);
                    global.SocialMediaUI.renderCalendar(posts); // Atualiza calendário
                } else {
                    global.SocialMediaUI.showFeedback('Erro ao excluir.', 'error');
                }
            } catch (err) {
                console.error('[SocialMediaCore V2] Erro ao excluir:', err);
                global.SocialMediaUI.showFeedback('Erro crítico ao excluir.', 'error');
            } finally {
                global.SocialMediaUI.setFormLoading(false);
            }
        }
    };

    global.addEventListener('v2:ready', () => {
        SocialMediaCore.init();
    });

    // Fallback init
    setTimeout(() => {
        if (!SocialMediaCore.initialized && global.ClientContext) {
            SocialMediaCore.init();
        }
    }, 1500);

    global.SocialMediaCore = SocialMediaCore;

})(window);
