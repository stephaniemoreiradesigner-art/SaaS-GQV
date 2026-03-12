(function(global) {
    const PerformanceConnectionsCore = {
        initialized: false,
        currentClientId: null,
        currentClientName: null,

        init: function() {
            if (this.initialized) return;
            if (!global.PerformanceConnectionsRepo || !global.PerformanceConnectionsUI) return;

            if (global.ClientContext?.subscribe) {
                global.ClientContext.subscribe((clientId) => {
                    const name = localStorage.getItem('GQV_ACTIVE_CLIENT_NAME') || '';
                    this.onClientChange(clientId, name);
                });
            }

            const activeId = global.ClientContext?.getActiveClient ? global.ClientContext.getActiveClient() : null;
            if (activeId) {
                const name = localStorage.getItem('GQV_ACTIVE_CLIENT_NAME') || '';
                this.onClientChange(activeId, name);
            } else {
                global.PerformanceConnectionsUI.render({ clienteId: null, clientName: null, connections: [] });
                global.PerformanceConnectionsUI.renderMetrics({ lastSyncAt: null });
            }

            this.initialized = true;
        },

        onClientChange: async function(clientId, clientName) {
            this.currentClientId = clientId || null;
            this.currentClientName = clientName || '';

            if (!clientId) {
                global.PerformanceConnectionsUI.render({ clienteId: null, clientName: null, connections: [] });
                global.PerformanceConnectionsUI.renderMetrics({ lastSyncAt: null });
                return;
            }

            const connections = await global.PerformanceConnectionsRepo.getConnections(clientId);
            const lastSyncAt = connections.reduce((acc, c) => {
                const ts = c.last_sync_at || null;
                if (!ts) return acc;
                if (!acc) return ts;
                return new Date(ts) > new Date(acc) ? ts : acc;
            }, null);

            global.PerformanceConnectionsUI.render({
                clienteId: clientId,
                clientName: clientName,
                connections,
                onConnect: (platform) => this.handleConnect(platform),
                onDisconnect: (platform) => this.handleDisconnect(platform)
            });
            global.PerformanceConnectionsUI.renderMetrics({ lastSyncAt });
        },

        handleConnect: async function(platform) {
            if (!this.currentClientId) return;
            const result = await global.PerformanceConnectionsRepo.upsertConnection(this.currentClientId, platform, {
                connection_status: 'pending'
            });
            if (!result?.ok) {
                alert('Erro ao iniciar conexão.');
                return;
            }
            await this.onClientChange(this.currentClientId, this.currentClientName);
            alert('Conexão registrada como pendente. Integração completa será ativada no próximo bloco.');
        },

        handleDisconnect: async function(platform) {
            if (!this.currentClientId) return;
            const result = await global.PerformanceConnectionsRepo.disconnect(this.currentClientId, platform);
            if (!result?.ok) {
                alert('Erro ao desconectar.');
                return;
            }
            await this.onClientChange(this.currentClientId, this.currentClientName);
        }
    };

    global.PerformanceConnectionsCore = PerformanceConnectionsCore;

    global.addEventListener('v2:ready', () => PerformanceConnectionsCore.init());
})(window);

