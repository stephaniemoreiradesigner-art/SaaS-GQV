// js/v2/modules/social_media/social_media_ui.js
// Interface de Usuário do Módulo Social Media V2
// Responsável por renderizar o Feed/Calendário de posts

(function(global) {
    const SocialMediaUI = {
        /**
         * Renderiza a lista de posts no container V2
         * @param {Array} posts 
         * @param {string} clientName 
         */
        renderFeed: function(posts, clientName) {
            const container = document.getElementById('v2-social-feed');
            if (!container) return;

            container.innerHTML = '';

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
                        <p class="text-xs text-gray-400 mt-1">Selecione outro cliente ou crie um novo post.</p>
                    </div>
                `;
                return;
            }

            const grid = document.createElement('div');
            grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';

            posts.forEach(post => {
                const card = document.createElement('div');
                card.className = 'bg-white p-4 rounded shadow-sm border border-gray-100 hover:shadow-md transition-shadow';
                
                const date = post.data_postagem ? new Date(post.data_postagem).toLocaleDateString('pt-BR') : 'Sem data';
                const statusColor = post.status === 'aprovado' ? 'green' : (post.status === 'agendado' ? 'blue' : 'gray');

                card.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold text-gray-500">${date}</span>
                        <span class="px-2 py-0.5 text-xs rounded-full bg-${statusColor}-100 text-${statusColor}-800 capitalize">${post.status || 'Rascunho'}</span>
                    </div>
                    <h5 class="font-medium text-gray-800 mb-2 line-clamp-2">${post.titulo || post.tema || 'Sem título'}</h5>
                    <p class="text-sm text-gray-600 line-clamp-3 mb-3">${post.legenda || post.conteudo || ''}</p>
                    <div class="flex gap-2 text-xs text-gray-400">
                        ${post.instagram ? '<i class="fab fa-instagram"></i>' : ''}
                        ${post.facebook ? '<i class="fab fa-facebook"></i>' : ''}
                        ${post.linkedin ? '<i class="fab fa-linkedin"></i>' : ''}
                    </div>
                `;
                grid.appendChild(card);
            });

            container.appendChild(grid);
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
        }
    };

    global.SocialMediaUI = SocialMediaUI;

})(window);
