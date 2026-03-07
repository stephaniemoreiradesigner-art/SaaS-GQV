// js/v2/shared/workspaceState.js
// Gerenciador de Estado Global do Workspace V2
// Responsável por orquestrar qual módulo está visível (Social Media, Performance, etc.)

(function(global) {
    const LISTENERS = new Set();
    
    // Estado inicial
    let currentState = {
        activeModule: 'dashboard', // dashboard, social_media, performance
        activeView: 'default',     // calendar, list, insights, etc.
        sidebarExpanded: true
    };

    const WorkspaceState = {
        /**
         * Retorna o estado atual completo
         */
        getState() {
            return { ...currentState };
        },

        /**
         * Define o módulo ativo
         * @param {string} moduleName 
         */
        setActiveModule(moduleName) {
            if (currentState.activeModule === moduleName) return;
            currentState.activeModule = moduleName;
            this.notifyListeners();
            console.log('[WorkspaceState v2] Módulo ativo:', moduleName);
        },

        /**
         * Define a view ativa dentro do módulo
         * @param {string} viewName 
         */
        setActiveView(viewName) {
            if (currentState.activeView === viewName) return;
            currentState.activeView = viewName;
            this.notifyListeners();
        },

        /**
         * Registra ouvinte de mudanças de estado
         */
        subscribe(callback) {
            LISTENERS.add(callback);
            return () => LISTENERS.delete(callback);
        },

        notifyListeners() {
            const snapshot = { ...currentState };
            const event = { ...snapshot, payload: snapshot };
            LISTENERS.forEach(cb => {
                try {
                    cb(event);
                } catch (e) {
                    console.error('[WorkspaceState] Erro no listener:', e);
                }
            });
        }
    };

    global.WorkspaceState = WorkspaceState;

})(window);
