// js/v2/modules/clientes/clientes_ui.js
// Interface de Usuário do Módulo Clientes V2
// Responsável apenas por renderizar e capturar eventos de UI

(function(global) {
    const ClientUI = {
        /**
         * Renderiza a lista de clientes em um container específico
         * @param {Array} clients - Lista de dados dos clientes
         * @param {Function} onSelectCallback - Função a ser chamada ao clicar (recebe o cliente)
         * @param {HTMLElement} container - Elemento onde renderizar (opcional, padrão: #v2-clients-list)
         */
        renderClients: function(clients, onSelectCallback, containerId = 'v2-clients-list') {
            const container = document.getElementById(containerId);
            if (!container) {
                // Se não existir container V2, não fazemos nada (modo silencioso ou criar um oculto para debug)
                console.warn(`[ClientUI] Container #${containerId} não encontrado. UI V2 não renderizada.`);
                return;
            }

            container.innerHTML = ''; // Limpar
            
            if (clients.length === 0) {
                container.innerHTML = '<div class="p-4 text-gray-500">Nenhum cliente encontrado.</div>';
                return;
            }

            const list = document.createElement('ul');
            list.className = 'space-y-2';

            clients.forEach(client => {
                const item = document.createElement('li');
                item.className = 'p-3 bg-white border rounded shadow-sm hover:bg-blue-50 cursor-pointer transition-colors flex justify-between items-center';
                item.dataset.id = client.id;

                const name = client.nome_fantasia || client.razao_social || 'Sem Nome';
                
                item.innerHTML = `
                    <span class="font-medium text-gray-700">${name}</span>
                    <span class="text-xs text-gray-400">ID: ${client.id.substring(0, 8)}...</span>
                `;

                item.addEventListener('click', () => {
                    // Feedback visual simples
                    container.querySelectorAll('li').forEach(li => li.classList.remove('ring-2', 'ring-blue-500'));
                    item.classList.add('ring-2', 'ring-blue-500');
                    
                    if (typeof onSelectCallback === 'function') {
                        onSelectCallback(client);
                    }
                });

                list.appendChild(item);
            });

            container.appendChild(list);
        },

        /**
         * Destaca o cliente ativo na lista
         * @param {string} clientId 
         */
        highlightActive: function(clientId) {
            const container = document.getElementById('v2-clients-list');
            if (!container) return;

            container.querySelectorAll('li').forEach(li => {
                if (li.dataset.id === clientId) {
                    li.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
                } else {
                    li.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
                }
            });
        }
    };

    global.ClientUI = ClientUI;

})(window);
