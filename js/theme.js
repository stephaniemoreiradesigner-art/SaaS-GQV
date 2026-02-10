// Script de Tema e WhiteLabel
// Carrega configurações do banco e aplica visual
// Versão Otimizada com Cache LocalStorage

(function() {
    const CACHE_KEY = 'saas_theme_config';

    // 1. Configurar Tailwind
    const configureTailwind = () => {
        if (window.tailwind) {
            window.tailwind.config = {
                theme: {
                    extend: {
                        colors: {
                            primary: 'var(--color-primary)',
                            secondary: 'var(--color-secondary)',
                            'primary-hover': 'var(--color-primary-hover)', 
                        },
                        fontFamily: {
                            sans: ['Inter', 'sans-serif'],
                        }
                    }
                }
            };
        }
    };

    if (!window.tailwind) {
        const scriptTailwind = document.createElement('script');
        scriptTailwind.src = "https://cdn.tailwindcss.com";
        scriptTailwind.onload = configureTailwind;
        document.head.appendChild(scriptTailwind);
    } else {
        configureTailwind();
    }

    // 2. Injetar CSS Base e Variáveis Padrão
    const style = document.createElement('style');
    style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        :root {
            --color-primary: #800080; /* Roxo Padrão */
            --color-primary-hover: #6a006a;
            --color-secondary: #FBB03B; /* Laranja Padrão */
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: #f8f9fa; /* bg-gray-50 */
        }

        /* Scrollbar Personalizada */
        ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #f1f1f1;
        }
        ::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #aaa;
        }
        
        /* Loading Overlay */
        #theme-loading {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: #fff;
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
            transition: opacity 0.5s;
        }

        /* Logo Sidebar Maior */
        #logo-sidebar {
            height: auto !important;
            max-height: 80px !important; 
            width: auto !important;
            max-width: 200px !important;
        }
        /* Ajuste container do logo no sidebar */
        aside > div:first-child {
            height: 100px !important;
        }
        
        /* Logo Mobile */
        #logo-mobile {
            height: 48px !important;
        }
    `;
    document.head.appendChild(style);

    // 3. Adicionar Loading Screen (se não existir e não tiver cache)
    document.addEventListener('DOMContentLoaded', () => {
        // Se já tiver cache, não mostra loading ou mostra muito breve
        const cached = localStorage.getItem(CACHE_KEY);
        if (!cached && !document.getElementById('theme-loading')) {
            const loading = document.createElement('div');
            loading.id = 'theme-loading';
            loading.innerHTML = '<div style="width: 40px; height: 40px; border: 4px solid #eee; border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s linear infinite;"></div><style>@keyframes spin { to { transform: rotate(360deg); } }</style>';
            document.body.prepend(loading);
        } else if (cached) {
            // Se tem cache, aplica imediatamente
            try {
                applyConfigToDOM(JSON.parse(cached));
            } catch(e) { console.error(e); }
        }
    });

    // 4. Carregar Configurações do Supabase (Sync/Background)
    document.addEventListener('DOMContentLoaded', async () => {
        // Aguarda Supabase carregar
        const checkSupabase = setInterval(async () => {
            if (window.supabaseClient) {
                clearInterval(checkSupabase);
                await applyTheme();
            }
        }, 100);

        // Fallback para remover loading se demorar muito
        setTimeout(() => {
            const loading = document.getElementById('theme-loading');
            if (loading) {
                loading.style.opacity = '0';
                setTimeout(() => loading.remove(), 500);
            }
        }, 3000);
    });

    // Expor função globalmente
    window.applyWhiteLabelSettings = applyTheme;
    
    // Helper: Aplica configurações ao DOM
    function applyConfigToDOM(config) {
        const root = document.documentElement;

        // Helper: Adjust Color (Hex)
        const adjustColor = (color, amount) => {
            return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
        }
        
        // Helper: Check Light Color (unused but kept for reference)
        const isLightColor = (hex) => {
            const c = hex.substring(1);
            const rgb = parseInt(c, 16);
            const r = (rgb >> 16) & 0xff;
            const g = (rgb >>  8) & 0xff;
            const b = (rgb >>  0) & 0xff;
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            return luma > 160;
        }

        // Apply Primary Color
        if (config.white_label_primary_color) {
            const primary = config.white_label_primary_color;
            root.style.setProperty('--color-primary', primary);
            
            // Generate Hover
            try {
                const primaryHover = adjustColor(primary, -20);
                root.style.setProperty('--color-primary-hover', primaryHover);
            } catch(e) { console.warn('Erro ao calcular hover', e); }
        }

        // Apply Secondary Color
        if (config.white_label_secondary_color) {
            const secondary = config.white_label_secondary_color;
            root.style.setProperty('--color-secondary', secondary);
            
            // Inject Sidebar Hover Style (Secondary Color)
            const styleId = 'whitelabel-overrides';
            let styleEl = document.getElementById(styleId);
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.id = styleId;
                document.head.appendChild(styleEl);
            }
            
            styleEl.innerHTML = `
                /* Sidebar Hover - Cor Secundária */
                aside nav a:hover, 
                aside nav a:hover i,
                aside nav a:hover span {
                    color: ${secondary} !important;
                }
            `;
        }

        // Apply Logo
        const logoSidebar = document.getElementById('logo-sidebar');
        const logoMobile = document.getElementById('logo-mobile');
        
        if (config.white_label_logo_url) {
            if (logoSidebar) logoSidebar.src = config.white_label_logo_url;
            if (logoMobile) logoMobile.src = config.white_label_logo_url;
        }

        // Apply Favicon
        if (config.white_label_favicon_url) {
            let link = document.querySelector("link[rel*='icon']");
            if (!link) {
                link = document.createElement('link');
                link.type = 'image/x-icon';
                link.rel = 'shortcut icon';
                document.head.appendChild(link);
            }
            link.href = config.white_label_favicon_url;
        }
    }

    async function applyTheme() {
        // 1. Tentar Cache (Instantâneo) - Já aplicado no DOMContentLoaded, mas reforça aqui se chamado manualmente
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const config = JSON.parse(cached);
                applyConfigToDOM(config);
                
                // Remove loading se existir
                const loading = document.getElementById('theme-loading');
                if (loading) loading.style.display = 'none';
            } catch(e) { console.error('Cache error', e); }
        }

        try {
            // 2. Buscar Dados Atualizados
            const keys = ['white_label_primary_color', 'white_label_secondary_color', 'white_label_logo_url', 'white_label_favicon_url'];
            const { data, error } = await window.supabaseClient
                .from('configuracoes')
                .select('key, value')
                .in('key', keys);

            if (!error && data) {
                const config = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                
                // Atualizar Cache
                localStorage.setItem(CACHE_KEY, JSON.stringify(config));

                // Aplicar
                applyConfigToDOM(config);
            }
        } catch (e) {
            console.error('Erro ao carregar tema:', e);
        } finally {
            const loading = document.getElementById('theme-loading');
            if (loading) {
                loading.style.opacity = '0';
                setTimeout(() => loading.remove(), 500);
            }
        }
    }
})();