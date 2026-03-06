if (window.location.pathname.includes('social_media.html')) {
    console.warn('[SM FIX] social_media_app.js desativado no social_media.html');
} else {
const getActiveClientId = () => {
    if (typeof window.getActiveClientId === 'function') return window.getActiveClientId();
    return '';
};

// Define the SocialMediaApp namespace
window.SocialMediaApp = {
    state: {
        tab: 'dashboard',
        scope: 'cliente',
        period: '7d',
        clientId: null
    },

    init() {
        this.syncFromHash();
        this.loadClientContext();
        document.addEventListener('click', this.handleActionClick.bind(this));
        document.addEventListener('change', this.handleActionChange.bind(this));
    },

    setTab(tab) {
        this.state.tab = tab;
        this.syncToHash();
        console.log(`[SocialMediaApp] Tab set to: ${tab}`);
    },

    setScope(scope) {
        this.state.scope = scope;
        this.syncToHash();
        console.log(`[SocialMediaApp] Scope set to: ${scope}`);
    },

    setPeriod(period) {
        this.state.period = period;
        this.syncToHash();
        console.log(`[SocialMediaApp] Period set to: ${period}`);
    },

    syncFromHash() {
        const params = new URLSearchParams(window.location.hash.slice(1));
        this.state.tab = params.get('tab') || 'dashboard';
        this.state.scope = params.get('scope') || 'cliente';
        this.state.period = params.get('period') || '7d';
        console.log('[SocialMediaApp] State synced from hash:', this.state);
    },

    syncToHash() {
        const params = new URLSearchParams();
        params.set('tab', this.state.tab);
        params.set('scope', this.state.scope);
        params.set('period', this.state.period);
        window.location.hash = `#${params.toString()}`;
    },

    loadClientContext() {
        const selectClient = document.getElementById('select-cliente');
        if (selectClient) {
            this.state.clientId = selectClient.value;
        }
        console.log('[SocialMediaApp] Client context loaded:', this.state.clientId);
    },

    handleActionClick(event) {
        const action = event.target.dataset.action;
        if (!action) return;

        switch (action) {
            case 'set-tab':
                this.setTab(event.target.dataset.tab);
                break;
            case 'set-scope':
                this.setScope(event.target.dataset.scope);
                break;
            case 'go-home':
                this.setTab('dashboard');
                break;
            default:
                console.warn(`[SocialMediaApp] Unknown action: ${action}`);
        }
    },

    handleActionChange(event) {
        const action = event.target.dataset.actionChange;
        if (!action) return;

        switch (action) {
            case 'set-period':
                this.setPeriod(event.target.value);
                break;
            default:
                console.warn(`[SocialMediaApp] Unknown change action: ${action}`);
        }
    }
};

// Temporary compatibility shims
window.setOperationalScope = (scope) => SocialMediaApp.setScope(scope);
window.showSocialMediaHome = () => SocialMediaApp.setTab('dashboard');
window.openSocialMediaTab = (tab) => SocialMediaApp.setTab(tab);
window.operationalHubState = SocialMediaApp.state;

// Initialize the app
SocialMediaApp.init();
}
