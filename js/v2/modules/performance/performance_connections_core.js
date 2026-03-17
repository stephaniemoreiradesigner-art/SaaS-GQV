(function(global) {
    const PerformanceConnectionsCore = {
        initialized: false,
        currentClientId: null,
        currentClientName: null,

        init: function() {
            if (this.initialized) return;
            if (!global.PerformanceConnectionsRepo || !global.PerformanceConnectionsUI) return;
            const isDebug = () => global.__GQV_DEBUG_CONTEXT__ === true;

            if (global.ClientContext?.subscribe) {
                global.ClientContext.subscribe((clientId) => {
                    const name = global.ClientContext?.getActiveClientName ? global.ClientContext.getActiveClientName() : '';
                    if (isDebug()) console.log('[PerformanceV2] active client received:', { clientId, clientName: name || null });
                    this.onClientChange(clientId, name);
                });
            }

            if (global.WorkspaceState?.subscribe) {
                global.WorkspaceState.subscribe(() => {
                    const moduleName = global.WorkspaceState?.getState ? global.WorkspaceState.getState().activeModule : null;
                    if (moduleName === 'performance' && this.currentClientId) {
                        const name = global.ClientContext?.getActiveClientName ? global.ClientContext.getActiveClientName() : (this.currentClientName || '');
                        this.onClientChange(this.currentClientId, name);
                    }
                });
            }

            this.initialized = true;
        },

        onClientChange: async function(clientId, clientName) {
            const isDebug = () => global.__GQV_DEBUG_CONTEXT__ === true;
            this.currentClientId = clientId || null;
            this.currentClientName = clientName || '';

            if (!clientId) {
                global.PerformanceConnectionsUI.render({ clienteId: null, clientName: null, connections: [] });
                global.PerformanceConnectionsUI.renderMetrics({ lastSyncAt: null });
                return;
            }

            const activeModule = global.WorkspaceState?.getState ? global.WorkspaceState.getState().activeModule : null;
            if (activeModule !== 'performance') {
                console.log('[PerformanceV2][STARTUP_TRACE] skip fetch (inactive module):', { activeModule, clientId });
                return;
            }

            if (isDebug()) console.log('[PerformanceV2] filter by client:', { clientId });
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

