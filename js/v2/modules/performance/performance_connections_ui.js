(function(global) {
    const PerformanceConnectionsUI = {
        platformOrder: ['meta', 'google_ads', 'linkedin'],

        getPlatformLabel: function(platform) {
            const map = {
                meta: 'Meta Ads',
                google_ads: 'Google Ads',
                linkedin: 'LinkedIn Ads'
            };
            return map[platform] || platform;
        },

        getStatusLabel: function(status) {
            const map = {
                connected: 'Conectado',
                pending: 'Pendente',
                error: 'Erro',
                disconnected: 'Desconectado'
            };
            return map[status] || status || '-';
        },

        getStatusClasses: function(status) {
            const map = {
                connected: 'bg-emerald-100 text-emerald-700',
                pending: 'bg-amber-100 text-amber-700',
                error: 'bg-rose-100 text-rose-700',
                disconnected: 'bg-slate-100 text-slate-600'
            };
            return map[status] || 'bg-slate-100 text-slate-600';
        },

        render: function({ clienteId, clientName, connections, onConnect, onDisconnect }) {
            const list = document.getElementById('performance-connections-list');
            const empty = document.getElementById('performance-connections-empty');
            const badge = document.getElementById('performance-client-badge');
            if (!list || !empty || !badge) return;

            if (!clienteId) {
                list.innerHTML = '';
                empty.classList.remove('hidden');
                badge.textContent = 'Nenhum cliente';
                return;
            }

            empty.classList.add('hidden');
            badge.textContent = clientName ? clientName : `Cliente ${String(clienteId).slice(0, 8)}...`;

            const byPlatform = {};
            (connections || []).forEach((c) => {
                byPlatform[c.platform] = c;
            });

            list.innerHTML = '';
            this.platformOrder.forEach((platform) => {
                const row = byPlatform[platform] || { platform, connection_status: 'disconnected' };
                const status = row.connection_status || 'disconnected';
                const statusLabel = this.getStatusLabel(status);
                const statusClasses = this.getStatusClasses(status);
                const idValue = row.external_account_id || row.external_business_id || row.manager_account_id || row.organization_id || '';

                const item = document.createElement('div');
                item.className = 'border border-slate-200 rounded-xl p-4 bg-white';
                item.innerHTML = `
                    <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                            <p class="text-sm font-semibold text-slate-900">${this.getPlatformLabel(platform)}</p>
                            <div class="mt-1 flex items-center gap-2">
                                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses}">${statusLabel}</span>
                                <span class="text-xs text-slate-400 truncate">${idValue ? `ID: ${idValue}` : 'Sem IDs externos'}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${status === 'connected' || status === 'pending'
                                ? `<button data-action="disconnect" class="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-700 hover:bg-slate-50">Desconectar</button>`
                                : `<button data-action="connect" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">Conectar</button>`
                            }
                        </div>
                    </div>
                `;

                const connectBtn = item.querySelector('[data-action="connect"]');
                const disconnectBtn = item.querySelector('[data-action="disconnect"]');
                if (connectBtn) connectBtn.addEventListener('click', () => onConnect && onConnect(platform));
                if (disconnectBtn) disconnectBtn.addEventListener('click', () => onDisconnect && onDisconnect(platform));

                list.appendChild(item);
            });
        },

        renderMetrics: function({ lastSyncAt }) {
            const grid = document.getElementById('performance-metrics-grid');
            const lastSync = document.getElementById('performance-last-sync');
            if (!grid || !lastSync) return;

            const fmt = (iso) => {
                if (!iso) return '-';
                try {
                    const d = new Date(iso);
                    return d.toLocaleString('pt-BR');
                } catch {
                    return '-';
                }
            };

            lastSync.textContent = `Último sync: ${fmt(lastSyncAt)}`;
            grid.innerHTML = '';

            const cards = [
                { label: 'Investimento', value: 'R$ -' },
                { label: 'Impressões', value: '-' },
                { label: 'Leads', value: '-' },
                { label: 'CPL', value: 'R$ -' }
            ];

            cards.forEach((c) => {
                const el = document.createElement('div');
                el.className = 'rounded-xl border border-slate-200 p-4';
                el.innerHTML = `
                    <p class="text-xs uppercase text-slate-400">${c.label}</p>
                    <p class="text-base font-semibold text-slate-900 mt-2">${c.value}</p>
                `;
                grid.appendChild(el);
            });
        }
    };

    global.PerformanceConnectionsUI = PerformanceConnectionsUI;
})(window);

