// js/v2/modules/social_media/social_media_ui.js
// Interface de Usuário do Módulo Social Media V2
// Responsável por renderizar o Feed/Calendário de posts

(function(global) {
    const SocialMediaUI = {
        /**
         * Renderiza o formulário de criação/edição
         * @param {Object} [postToEdit] - Dados do post se for edição
         */
        renderCreateForm: function(postToEdit = null) {
            const container = document.getElementById('v2-social-create-area');
            if (!container) return;

            const isEdit = !!postToEdit;
            const title = isEdit ? 'Editar Post (V2)' : 'Novo Post Manual (V2)';
            const btnText = isEdit ? 'Atualizar Post' : 'Salvar Rascunho';
            const btnIcon = isEdit ? 'fa-check' : 'fa-save';
            const cancelBtn = isEdit ? `<button type="button" id="v2-btn-cancel" class="px-3 py-2 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition-colors mr-2">Cancelar</button>` : '';
            const deleteBtn = isEdit ? `<button type="button" id="v2-btn-delete" class="px-3 py-2 bg-red-100 text-red-600 rounded text-sm hover:bg-red-200 transition-colors ml-auto"><i class="fas fa-trash"></i> Excluir</button>` : '';

            // Valores iniciais
            const valTitle = postToEdit ? (postToEdit.titulo || postToEdit.tema || '') : '';
            const valContent = postToEdit ? (postToEdit.legenda || postToEdit.conteudo || '') : '';
            const valDate = postToEdit ? (postToEdit.data_postagem || postToEdit.data_agendada || '').split('T')[0] : '';
            const valPlatform = postToEdit && postToEdit.plataformas && postToEdit.plataformas[0] ? postToEdit.plataformas[0] : 'instagram';
            const postId = postToEdit ? postToEdit.id : '';

            container.innerHTML = `
                <div class="bg-white p-4 rounded-lg border ${isEdit ? 'border-purple-300 ring-2 ring-purple-100' : 'border-gray-200'} mb-6 shadow-sm transition-all">
                    <h4 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <i class="fas fa-pen-nib text-purple-600"></i> ${title}
                    </h4>
                    <form id="v2-create-post-form" class="space-y-3" data-mode="${isEdit ? 'edit' : 'create'}" data-post-id="${postId}">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="text" name="titulo" value="${valTitle}" placeholder="Título / Tema" required 
                                class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-purple-500 focus:border-purple-500">
                            
                            <select name="plataforma" class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm">
                                <option value="instagram" ${valPlatform === 'instagram' ? 'selected' : ''}>Instagram</option>
                                <option value="facebook" ${valPlatform === 'facebook' ? 'selected' : ''}>Facebook</option>
                                <option value="linkedin" ${valPlatform === 'linkedin' ? 'selected' : ''}>LinkedIn</option>
                                <option value="tiktok" ${valPlatform === 'tiktok' ? 'selected' : ''}>TikTok</option>
                            </select>
                        </div>
                        
                        <textarea name="legenda" rows="2" placeholder="Legenda ou ideia inicial..." 
                            class="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm focus:ring-purple-500 focus:border-purple-500">${valContent}</textarea>
                        
                        <div class="flex flex-wrap gap-2 items-center">
                            <input type="date" name="data_postagem" value="${valDate}" class="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs">
                            
                            <div class="flex-1"></div>
                            
                            ${cancelBtn}
                            
                            <button type="submit" id="v2-btn-save" class="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700 transition-colors flex items-center gap-2">
                                <span class="hidden md:inline">${btnText}</span>
                                <span class="md:hidden">Salvar</span>
                                <i class="fas ${btnIcon}"></i>
                            </button>
                            
                            ${deleteBtn}
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
                card.className = 'bg-white p-4 rounded shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer hover:border-purple-200 relative group';
                
                // Tooltip de edição
                const editHint = document.createElement('div');
                editHint.className = 'absolute top-2 right-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity';
                editHint.innerHTML = '<i class="fas fa-pencil-alt"></i> Editar';
                card.appendChild(editHint);

                // Evento de clique para edição
                card.addEventListener('click', (e) => {
                    // Evitar conflito se clicar em botões internos futuros
                    if (e.target.closest('button')) return;
                    
                    // Dispara evento customizado para o Core ouvir
                    const event = new CustomEvent('v2:post-click', { detail: { post } });
                    document.dispatchEvent(event);
                    
                    // Feedback visual
                    document.querySelectorAll('#v2-social-feed > div > div').forEach(d => d.classList.remove('ring-2', 'ring-purple-400'));
                    card.classList.add('ring-2', 'ring-purple-400');
                    
                    // Scroll suave para o form
                    const formArea = document.getElementById('v2-social-create-area');
                    if(formArea) formArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                });
                
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

                card.innerHTML += `
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
        },

        /**
         * Renderiza o Calendário Visual (FullCalendar)
         * @param {Array} posts 
         */
        renderCalendar: function(posts) {
            const container = document.getElementById('v2-social-calendar');
            if (!container) return; // Se não houver container de calendário, ignora

            // Limpa para evitar duplicidade se já houver instância (embora FullCalendar gerencie bem)
            container.innerHTML = '';

            if (typeof FullCalendar === 'undefined') {
                container.innerHTML = '<div class="text-red-500">Biblioteca FullCalendar não carregada.</div>';
                return;
            }

            // Mapeia posts para eventos do FullCalendar
            const events = posts.map(post => {
                const date = post.data_agendada || post.data_postagem;
                if (!date) return null;

                const status = post.status || 'rascunho';
                let color = '#9ca3af'; // gray (rascunho)
                if (status === 'aprovado') color = '#10b981'; // green
                if (status === 'agendado') color = '#3b82f6'; // blue

                // Título com ícone (HTML não é suportado nativamente no title v5+, usa-se eventContent)
                const title = post.titulo || post.tema || 'Sem título';
                
                // Plataforma
                let platformIcon = '';
                const platforms = post.plataformas || [];
                if (platforms.includes('instagram') || post.instagram) platformIcon = 'instagram';
                else if (platforms.includes('facebook') || post.facebook) platformIcon = 'facebook';
                else if (platforms.includes('linkedin') || post.linkedin) platformIcon = 'linkedin';

                return {
                    id: post.id,
                    title: title,
                    start: date,
                    backgroundColor: color,
                    borderColor: color,
                    extendedProps: {
                        post: post,
                        platformIcon: platformIcon
                    }
                };
            }).filter(Boolean);

            const calendar = new FullCalendar.Calendar(container, {
                initialView: 'dayGridMonth',
                locale: 'pt-br',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,listWeek'
                },
                events: events,
                height: 600,
                eventClick: (info) => {
                    // Dispara evento de edição igual ao clique na lista
                    const event = new CustomEvent('v2:post-click', { detail: { post: info.event.extendedProps.post } });
                    document.dispatchEvent(event);
                },
                eventContent: function(arg) {
                    // Custom render para ícones
                    const icon = arg.event.extendedProps.platformIcon 
                        ? `<i class="fab fa-${arg.event.extendedProps.platformIcon} mr-1"></i>` 
                        : '';
                    return { html: `<div class="fc-event-main-frame text-xs truncate">${icon} ${arg.event.title}</div>` };
                }
            });

            calendar.render();
            // Salva referência global se precisar acessar depois (opcional)
            global.v2CalendarInstance = calendar; 
        }
    };

    global.SocialMediaUI = SocialMediaUI;

})(window);
