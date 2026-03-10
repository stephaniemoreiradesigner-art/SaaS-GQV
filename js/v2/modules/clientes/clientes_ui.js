// js/v2/modules/clientes/clientes_ui.js
// Interface de Usuário do Módulo Clientes V2
// Responsável apenas por renderizar e capturar eventos de UI

(function(global) {
    const ClientUI = {
        getClientName: function(client) {
            return client?.nome_fantasia || client?.razao_social || client?.nome_empresa || client?.nome || client?.empresa || 'Sem nome';
        },

        getField: function(client, keys) {
            for (const key of keys) {
                const value = client?.[key];
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    return String(value).trim();
                }
            }
            return '';
        },

        getInitials: function(name) {
            const parts = String(name || '')
                .trim()
                .split(/\s+/)
                .filter(Boolean);
            const first = parts[0]?.[0] || '';
            const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
            return (first + last).toUpperCase() || 'CL';
        },

        normalizeServices: function(raw) {
            const normalized = String(raw || '')
                .split(/[,;|]/g)
                .map(s => s.trim())
                .filter(Boolean);
            const mapped = normalized.map((item) => {
                const v = item.toLowerCase();
                if (v.includes('social')) return 'Social Media';
                if (v.includes('tráfego') || v.includes('trafego') || v.includes('ads') || v.includes('performance')) return 'Tráfego Pago';
                if (v.includes('autom')) return 'Automação';
                if (v.includes('consult')) return 'Consultoria';
                return item;
            });
            const unique = [];
            mapped.forEach((s) => {
                if (!unique.includes(s)) unique.push(s);
            });
            return unique.slice(0, 6);
        },

        getServices: function(client) {
            const fromString = this.getField(client, ['servicos_ativos', 'servicos_contratados', 'servicos', 'produtos', 'planos']);
            if (fromString) return this.normalizeServices(fromString);

            const inferred = [];
            if (this.getField(client, ['social_responsavel', 'responsavel_social', 'instagram_url'])) inferred.push('Social Media');
            if (this.getField(client, ['trafego_responsavel', 'responsavel_trafego'])) inferred.push('Tráfego Pago');
            if (this.getField(client, ['automacao_responsavel'])) inferred.push('Automação');
            if (this.getField(client, ['consultoria_responsavel'])) inferred.push('Consultoria');
            return inferred.slice(0, 6);
        },

        formatPhone: function(raw) {
            const digits = String(raw || '').replace(/\D/g, '');
            if (!digits) return '';
            return digits;
        },

        buildWhatsAppLink: function(raw) {
            const digits = this.formatPhone(raw);
            if (!digits) return '';
            const withCountry = digits.length <= 11 ? `55${digits}` : digits;
            return `https://wa.me/${withCountry}`;
        },

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
                container.innerHTML = '<div class="p-6 text-sm text-slate-500">Nenhum cliente encontrado.</div>';
                return;
            }

            clients.forEach(client => {
                const card = document.createElement('div');
                card.className = 'ui-card w-full text-left p-4 cursor-pointer';
                card.dataset.id = client.id;
                card.dataset.clientCard = 'true';
                card.setAttribute('role', 'button');
                card.tabIndex = 0;

                const name = this.getClientName(client);
                const owner = this.getField(client, ['responsavel', 'responsavel_nome', 'social_responsavel', 'trafego_responsavel', 'gestor', 'owner']);
                const phone = this.getField(client, ['telefone', 'celular', 'phone', 'telefone_contato', 'contato_telefone']);
                const whatsapp = this.getField(client, ['whatsapp', 'telefone_whatsapp', 'whatsapp_numero', 'whats']);
                const logoUrl = this.getField(client, ['logo_url', 'logo', 'imagem_logo', 'brand_logo_url']);
                const services = this.getServices(client);

                const phoneLabel = phone ? phone : '-';
                const waLink = this.buildWhatsAppLink(whatsapp || phone);
                const waLabel = waLink ? 'WhatsApp' : 'Sem WhatsApp';

                const chipsHtml = services.length
                    ? services.map(s => `<span class="ui-pill">${s}</span>`).join('')
                    : '<span class="ui-pill">Sem serviços</span>';

                card.innerHTML = `
                    <div class="flex items-start gap-3">
                        <div class="h-11 w-11 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="h-full w-full object-cover">` : this.getInitials(name)}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <p class="text-sm font-semibold text-slate-900 truncate">${name}</p>
                                    <p class="text-xs text-slate-500 mt-1">${owner ? `Responsável: ${owner}` : 'Responsável: -'}</p>
                                </div>
                                <span class="ui-pill">ID ${String(client.id || '').slice(0, 6)}</span>
                            </div>
                            <div class="mt-3 grid grid-cols-1 gap-2">
                                <div class="flex items-center justify-between text-xs text-slate-500">
                                    <span>Telefone</span>
                                    <span class="text-slate-700 font-semibold">${phoneLabel}</span>
                                </div>
                                <div class="flex items-center justify-between text-xs text-slate-500">
                                    <span>WhatsApp</span>
                                    ${waLink ? `<a href="${waLink}" target="_blank" class="text-slate-700 font-semibold hover:underline">${waLabel}</a>` : `<span class="text-slate-400 font-semibold">${waLabel}</span>`}
                                </div>
                            </div>
                            <div class="mt-3 flex flex-wrap gap-2">
                                ${chipsHtml}
                            </div>
                        </div>
                    </div>
                `;

                const handleSelect = () => {
                    container.querySelectorAll('[data-client-card="true"]').forEach(el => el.classList.remove('ring-2', 'ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]'));
                    card.classList.add('ring-2', 'ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]');
                    if (typeof onSelectCallback === 'function') {
                        onSelectCallback(client);
                    }
                };

                card.addEventListener('click', handleSelect);
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleSelect();
                    }
                });

                const waAnchor = card.querySelector('a[href^="https://wa.me/"]');
                if (waAnchor) {
                    waAnchor.addEventListener('click', (event) => event.stopPropagation());
                }

                container.appendChild(card);
            });
        },

        /**
         * Destaca o cliente ativo na lista
         * @param {string} clientId 
         */
        highlightActive: function(clientId) {
            const container = document.getElementById('v2-clients-list');
            if (!container) return;

            container.querySelectorAll('[data-client-card="true"]').forEach(card => {
                const isActive = card.dataset.id === clientId;
                card.classList.toggle('ring-2', isActive);
                card.classList.toggle('ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)]', isActive);
            });
        }
    };

    global.ClientUI = ClientUI;

})(window);
