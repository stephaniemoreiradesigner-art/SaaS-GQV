// js/v2/modules/social_media/social_media_ui.js
// Interface de Usuário do Módulo Social Media V2
// Responsável por renderizar o Feed/Calendário de posts

(function(global) {
    const SocialMediaUI = {
        /**
         * Renderiza o formulário de criação rápida
         */
        renderCreateForm: function() {
            const container = document.getElementById('v2-social-create-area');
            if (!container) return;

            container.innerHTML = `
                <div class="bg-white p-4 rounded-lg border border-gray-200 mb-6 shadow-sm">
                    <h4 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <i class="fas fa-pen-nib text-purple-600"></i> Novo Post Manual (V2)
                    </h4>
                    <form id="v2-create-post-form" class="space-y-3">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="text" name="titulo" placeholder="Título / Tema" required 
                                class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-purple-500 focus:border-purple-500">
                            
                            <select name="plataforma" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm">
                                <option value="instagram">Instagram</option>
                                <option value="facebook">Facebook</option>
                                <option value="linkedin">LinkedIn</option>
                                <option value="tiktok">TikTok</option>
                            </select>
                        </div>
                        
                        <textarea name="legenda" rows="2" placeholder="Legenda ou ideia inicial..." 
                            class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-purple-500 focus:border-purple-500"></textarea>
                        
                        <div class="flex justify-between items-center">
                            <input type="date" name="data_postagem" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs">
                            
                            <button type="submit" id="v2-btn-save" class="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2">
                                <span class="hidden md:inline">Salvar Rascunho</span>
                                <span class="md:hidden">Salvar</span>
                                <i class="fas fa-save"></i>
                            </button>
                        </div>
                        <div id="v2-form-feedback" class="text-xs mt-2 hidden"></div>
                    </form>
                </div>
            `;
        },

        /**
         * Renderiza a lista de posts no container V2
         * @param {Array} posts 
         * @param {string} clientName 
         */
        renderFeed: function(posts, clientName) {
            const container = document.getElementById('v2-social-feed');
            if (!container) return;

            container.innerHTML = '';

            // Injeta a área de criação antes do feed se não existir no HTML base
            let createArea = document.getElementById('v2-social-create-area');
            if (!createArea) {
                createArea = document.createElement('div');
                createArea.id = 'v2-social-create-area';
                container.parentNode.insertBefore(createArea, container);
                this.renderCreateForm();
            }

            const header = document.createElement('div');
            header.className = 'mb-4 flex justify-between items-center';
            header.innerHTML = `
                <h4 class="text-md font-semibold text-gray-700">Posts de: <span class="text-blue-600">${clientName || 'Cliente Desconhecido'}</span></h4>
                <span class="text-xs text-gray-500">${posts.length} posts encontrados</span>
            `;
            container.appendChild(header);

            if (posts.length === 0) {
                container.innerHTML += `
                    <div class="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p class="text-gray-500">Nenhum post encontrado para este cliente.</p>
                        <p class="text-xs text-gray-400 mt-1">Use o formulário acima para criar o primeiro.</p>
                    </div>
                `;
                return;
            }

            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

            posts.forEach(post => {
                const card = document.createElement('div');
                card.className = 'bg-white p-4 rounded shadow-sm border border-gray-100 hover:shadow-md transition-shadow';
                
                // Compatibilidade de campos entre tabelas (posts vs social_posts)
                const dateRaw = post.data_postagem || post.data_agendada;
                const date = dateRaw ? new Date(dateRaw).toLocaleDateString('pt-BR') : 'Sem data';
                const status = post.status || 'rascunho';
                const title = post.titulo || post.tema || 'Sem título';
                const content = post.legenda || post.conteudo || '';
                
                const statusColor = status === 'aprovado' ? 'green' : (status === 'agendado' ? 'blue' : 'gray');

                // Detectar plataformas (pode vir array jsonb ou colunas booleanas)
                let platformsHtml = '';
                if (Array.isArray(post.plataformas)) {
                    post.plataformas.forEach(p => {
                        platformsHtml += `<i class="fab fa-${p}"></i> `;
                    });
                } else {
                    if (post.instagram) platformsHtml += '<i class="fab fa-instagram"></i> ';
                    if (post.facebook) platformsHtml += '<i class="fab fa-facebook"></i> ';
                    if (post.linkedin) platformsHtml += '<i class="fab fa-linkedin"></i> ';
                }

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold text-gray-500">${date}</span>
                        <span class="px-2 py-0.5 text-xs rounded-full bg-${statusColor}-100 text-${statusColor}-800 capitalize">${status}</span>
                    </div>
                    <h5 class="font-medium text-gray-800 mb-2 line-clamp-2" title="${title}">${title}</h5>
                    <p class="text-sm text-gray-600 line-clamp-3 mb-3">${content}</p>
                    <div class="flex gap-2 text-xs text-gray-400">
                        ${platformsHtml || '<i class="fas fa-share-alt"></i>'}
                    </div>
                `;
                grid.appendChild(card);
            });

            container.appendChild(grid);
        },

        setFormLoading: function(isLoading) {
            const btn = document.getElementById('v2-btn-save');
            if (btn) {
                btn.disabled = isLoading;
                btn.innerHTML = isLoading ? '<i class="fas fa-spinner fa-spin"></i> Salvando...' : '<span class="hidden md:inline">Salvar Rascunho</span><span class="md:hidden">Salvar</span> <i class="fas fa-save"></i>';
            }
        },

        showFeedback: function(message, type = 'success') {
            const el = document.getElementById('v2-form-feedback');
            if (el) {
                el.textContent = message;
                el.className = `text-xs mt-2 p-2 rounded ${type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`;
                el.classList.remove('hidden');
                setTimeout(() => el.classList.add('hidden'), 3000);
            }
        },

        clearForm: function() {
            const form = document.getElementById('v2-create-post-form');
            if (form) form.reset();
        },

        showLoading: function() {
            const container = document.getElementById('v2-social-feed');
            if (container) {
                container.innerHTML = '<div class="p-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando posts...</div>';
            }
        },

        showEmptyState: function() {
            const container = document.getElementById('v2-social-feed');
            if (container) {
                container.innerHTML = '<div class="p-4 text-center text-gray-400">Selecione um cliente para ver os posts.</div>';
            }
            // Ocultar form se não tiver cliente
            const formContainer = document.getElementById('v2-social-create-area');
            if (formContainer) formContainer.innerHTML = ''; 
        }
    };

    global.SocialMediaUI = SocialMediaUI;

})(window);
