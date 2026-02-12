// Inicialização do cliente Supabase
window.supabaseConfig = null;
let supabaseConfigPromise = null;

async function loadSupabaseConfig() {
    if (window.supabaseConfig) return window.supabaseConfig;
    if (supabaseConfigPromise) return supabaseConfigPromise;

    supabaseConfigPromise = fetch('/config')
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Falha ao carregar /config: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            const supabaseUrl = data?.supabaseUrl;
            const supabaseAnonKey = data?.supabaseAnonKey;
            if (data?.missing || !supabaseUrl || !supabaseAnonKey) {
                console.error('Configuração Supabase ausente ou incompleta em /config', data);
                return null;
            }
            window.supabaseConfig = { supabaseUrl, supabaseAnonKey };
            return window.supabaseConfig;
        })
        .catch((err) => {
            console.error('Erro ao carregar /config do Supabase:', err);
            return null;
        });

    return supabaseConfigPromise;
}

async function initSupabase() {
    if (window.supabaseClient) return true; // Já inicializado

    try {
        if (!window.supabase) {
            console.warn('Biblioteca Supabase ainda não carregada no app.js, aguardando...');
            return false;
        } else {
            if (!window.supabaseConfig) {
                const config = await loadSupabaseConfig();
                if (!config) return false;
            }
            window.supabaseClient = window.supabase.createClient(window.supabaseConfig.supabaseUrl, window.supabaseConfig.supabaseAnonKey);
            console.log('Supabase inicializado com sucesso no app.js');
            window.SUPERADMIN_EMAILS = ['stephaniemoreira.designer@gmail.com', 'marketing.vaniamello@gmail.com'];
            return true;
        }
    } catch (err) {
        console.error('Erro fatal ao inicializar Supabase:', err);
        return false;
    }
}

// Tenta inicializar imediatamente
initSupabase();

// Se falhar, tenta novamente no DOMContentLoaded e window.onload
document.addEventListener('DOMContentLoaded', () => {
    loadSupabaseConfig();
    initSupabase().then((ready) => {
        if (!ready) {
            const checkSupabase = setInterval(async () => {
                if (await initSupabase()) {
                    clearInterval(checkSupabase);
                    window.dispatchEvent(new CustomEvent('supabaseReady'));
                }
            }, 100);
            setTimeout(() => clearInterval(checkSupabase), 10000);
        } else {
            window.dispatchEvent(new CustomEvent('supabaseReady'));
        }
    });
});


// Função global para mostrar o conteúdo e esconder loading (Definida fora do evento para garantir disponibilidade)
window.showContent = function() {
    const loadingScreen = document.getElementById('loading-screen');
    const dashboardWrapper = document.querySelector('.dashboard-wrapper');
    
    // Se o loading já sumiu, garante que o wrapper esteja visível
    if (!loadingScreen || loadingScreen.style.display === 'none') {
        if (dashboardWrapper) dashboardWrapper.style.display = 'flex';
        return;
    }

    if (loadingScreen) {
        loadingScreen.style.transition = 'opacity 0.5s';
        loadingScreen.style.opacity = '0';
        
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            if (dashboardWrapper) {
                dashboardWrapper.style.display = 'flex';
            }
        }, 500);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sistema GQV Iniciado - v2.0 (Resiliente)');
    
    // REDE DE SEGURANÇA: Timeout Global
    // Se em 4 segundos a tela de loading ainda estiver lá, força a abertura
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen && loadingScreen.style.display !== 'none') {
            console.warn('⚠️ Timeout de segurança ativado: Forçando abertura da tela.');
            window.showContent();
        }
    }, 4000);

    // --- Lógica de Autenticação Isolada ---
    async function checkAuthAndLoad() {
        if (!window.supabaseClient) return;

        // --- 1. Tentativa de Recuperação via URL (Prioridade Máxima) ---
        const urlParams = new URLSearchParams(window.location.search);
        let accessToken = urlParams.get('access_token');
        let refreshToken = urlParams.get('refresh_token');

        if (!accessToken || !refreshToken) {
            const hash = window.location.hash ? window.location.hash.replace(/^#/, '') : '';
            const hashParams = new URLSearchParams(hash);
            accessToken = accessToken || hashParams.get('access_token');
            refreshToken = refreshToken || hashParams.get('refresh_token');
        }

        if (accessToken && refreshToken) {
            try {
                console.log('🔑 Tentando restaurar sessão via URL...');
                const { error } = await window.supabaseClient.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                });
                
                if (window.location.search.includes('access_token') || window.location.hash.includes('access_token')) {
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
                window.showContent(); // LIBERA IMEDIATAMENTE
                return; // Interrompe o fluxo normal para evitar conflitos
            } catch (e) {
                console.error('Erro crítico ao restaurar sessão:', e);
            }
        }
    
        // --- 2. Fluxo Normal de Verificação ---
        try {
            const { data } = await window.supabaseClient.auth.getSession();
            let session = data.session;

            const path = window.location.pathname;
            const isLoginPage = path.includes('index.html') || path.endsWith('/') || path.endsWith('/SaaS-GQV/');
            const isRestrictedPage = !isLoginPage;

            if (session) {
                console.log('👤 Usuário logado:', session.user.email);
                
                if (isLoginPage) {
                    window.location.href = 'dashboard.html';
                } else {
                    // Carregar dados do usuário se estiver no dashboard
                    if (typeof loadUserProfile === 'function') loadUserProfile(session);
                    
                    // AUTOMACAO: Verificar e Gerar Mensalidades
                    if (window.verificarGeracaoMensalidadesAutomaticas) {
                        // Pequeno delay para não travar a renderização inicial
                        setTimeout(() => {
                            window.verificarGeracaoMensalidadesAutomaticas();
                        }, 2000);
                    }

                    if (window.verificarGeracaoSalariosAutomaticos) {
                        setTimeout(() => {
                            window.verificarGeracaoSalariosAutomaticos();
                        }, 2500);
                    }

                    window.showContent();
                }
            } else {
                console.log('👤 Usuário NÃO logado');
                
                if (isRestrictedPage) {
                    // Se estiver em página restrita, tenta mais uma vez antes de expulsar
                    setTimeout(async () => {
                        const { data: retryData } = await window.supabaseClient.auth.getSession();
                        if (retryData.session) {
                            window.showContent();
                            if (typeof loadUserProfile === 'function') loadUserProfile(retryData.session);
                        } else {
                            console.warn('🚫 Acesso negado. Redirecionando para login...');
                            if (!window.location.search.includes('access_token')) {
                                window.location.href = 'index.html';
                            }
                        }
                    }, 1000);
                }
            }

            // Ouvinte de mudanças de estado
            window.supabaseClient.auth.onAuthStateChange((event, newSession) => {
                console.log('🔄 Estado de Auth mudou:', event);
                if (event === 'SIGNED_OUT' && isRestrictedPage) {
                    window.location.href = 'index.html';
                }
            });

        } catch (e) {
            console.error('Erro geral na verificação de sessão:', e);
            window.showContent(); 
        }
    }

    // Inicia verificação se Supabase já estiver pronto
    if (window.supabaseClient) {
        checkAuthAndLoad();
    } else {
        // Aguarda evento de prontidão
        window.addEventListener('supabaseReady', () => {
            console.log('Evento supabaseReady recebido. Iniciando auth check...');
            checkAuthAndLoad();
        });
    }

    // --- Funções Auxiliares ---

    // Função global para toggle de submenu (precisa ser window.toggleSubmenu pois é chamada via onclick no HTML)
    window.toggleSubmenu = function(event, element) {
        event.preventDefault();
        const parentLi = element.parentElement;
        const submenu = parentLi.querySelector('.submenu');
        const arrowIcon = element.querySelector('.fa-chevron-down');

        if (submenu) {
            submenu.classList.toggle('open');
            if (arrowIcon) {
                arrowIcon.classList.toggle('rotate-icon');
            }
        }
    };

    // Função global para exibir Toasts (Notificações)
    window.showToast = function(message, type = 'info') {
        // Remove toasts anteriores para não empilhar demais
        const existingToasts = document.querySelectorAll('.custom-toast');
        existingToasts.forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.textContent = message;

        // Cores baseadas no tipo
        let bgColor = '#333';
        if (type === 'success') bgColor = '#28a745'; // Verde
        if (type === 'error') bgColor = '#dc3545';   // Vermelho
        if (type === 'warning') bgColor = '#ffc107'; // Amarelo
        if (type === 'info') bgColor = '#17a2b8';    // Azul

        // Estilos Inline para garantir funcionamento sem CSS extra
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: ${bgColor};
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 99999;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            opacity: 0;
            transform: translateY(-20px);
            transition: all 0.3s ease;
        `;

        document.body.appendChild(toast);

        // Animação de entrada
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        // Auto-remove após 3 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, 3000);
    };

    // --- WHITE LABEL SYSTEM ---
    // Aplica configurações visuais (Cores, Logo, Favicon)
    window.applyWhiteLabelSettings = async function() {
        // Função interna para aplicar as regras CSS/DOM
        const applyConfig = (config) => {
            const root = document.documentElement;
            
            // Helper para clarear/escurecer cor (Hex)
            const adjustColor = (color, amount) => {
                return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
            }
            
            // Helper para verificar se cor é clara (para contraste)
            const isLightColor = (hex) => {
                const c = hex.substring(1);      // strip #
                const rgb = parseInt(c, 16);   // convert rrggbb to decimal
                const r = (rgb >> 16) & 0xff;  // extract red
                const g = (rgb >>  8) & 0xff;  // extract green
                const b = (rgb >>  0) & 0xff;  // extract blue
                const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
                return luma > 160; // 160 é um bom threshold
            }

            if (config.white_label_primary_color) {
                const primary = config.white_label_primary_color;
                
                // Aplicar variáveis globais (suporte legado e novo)
                root.style.setProperty('--color-primary', primary);
                root.style.setProperty('--primary-color', primary); // Para configuracoes.html
                
                // Calcular versão hover (mais escura)
                try {
                    const primaryHover = adjustColor(primary, -20);
                    root.style.setProperty('--color-primary-dark', primaryHover);
                    root.style.setProperty('--primary-hover', primaryHover);
                } catch(e) { console.warn('Erro ao calcular hover', e); }

                // Sidebar assume a cor primária
                root.style.setProperty('--bg-sidebar', primary); 
                
                // Ajuste de contraste da Sidebar
                if (isLightColor(primary)) {
                    // Se fundo claro -> Texto Preto
                    root.style.setProperty('--text-light', '#333333');
                    // Ícones brancos podem sumir, forçar escuro se possível ou assumir que text-light resolve
                    // O CSS usa var(--text-light) para links da sidebar, então isso resolve!
                } else {
                    // Se fundo escuro -> Texto Branco (Padrão)
                    root.style.setProperty('--text-light', '#ffffff');
                }
            }
            
            if (config.white_label_secondary_color) {
                const secondary = config.white_label_secondary_color;
                root.style.setProperty('--color-secondary', secondary);
                root.style.setProperty('--secondary-color', secondary); // Para configuracoes.html
                
                // Se sidebar é clara, o item ativo precisa de destaque
                // Vamos usar a cor secundária para o item ativo se a sidebar for clara?
                // Ou apenas injetar uma regra CSS específica para .active
                
                const styleId = 'whitelabel-overrides';
                let styleEl = document.getElementById(styleId);
                if (!styleEl) {
                    styleEl = document.createElement('style');
                    styleEl.id = styleId;
                    document.head.appendChild(styleEl);
                }
                
                // Forçar cor do item ativo para ser a secundária
                // E garantir que o texto dentro do ativo seja legível (se secundária for clara -> texto escuro)
                const activeTextColor = isLightColor(secondary) ? '#333' : '#fff';
                
                styleEl.innerHTML = `
                    .sidebar-menu a.active, .sidebar-menu a:hover,
                    .nav-item.active {
                        background-color: ${secondary} !important;
                        color: ${activeTextColor} !important;
                    }
                    .sidebar-menu a.active i, .sidebar-menu a:hover i {
                        color: ${activeTextColor} !important;
                    }
                    /* Ajuste para ícones na sidebar geral se fundo for claro */
                    ${config.white_label_primary_color && isLightColor(config.white_label_primary_color) ? 
                        `.sidebar-menu a { color: #333 !important; } 
                         .sidebar-menu a i { color: #555 !important; }` : ''}
                `;
            }
            
            if (config.white_label_favicon_url) {
                let link = document.querySelector("link[rel*='icon']");
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'shortcut icon';
                    document.head.appendChild(link);
                }
                link.type = 'image/x-icon';
                link.href = config.white_label_favicon_url;
            }
            
            if (config.white_label_logo_url) {
                const logoSidebar = document.getElementById('logo-sidebar');
                const logoMobile = document.getElementById('logo-mobile');
                const logos = document.querySelectorAll('.sidebar-header img'); // Fallback
                
                if (logoSidebar) logoSidebar.src = config.white_label_logo_url;
                if (logoMobile) logoMobile.src = config.white_label_logo_url;
                if (logos.length > 0) logos.forEach(logo => logo.src = config.white_label_logo_url);
            }
        };

        try {
            // 1. Tentar cache local (instantâneo)
            const cachedConfig = localStorage.getItem('whiteLabelConfig');
            if (cachedConfig) {
                applyConfig(JSON.parse(cachedConfig));
            }

            // 2. Buscar atualizações no Supabase
            if (!window.supabaseClient) return;

            const keys = ['white_label_primary_color', 'white_label_secondary_color', 'white_label_favicon_url', 'white_label_logo_url'];
            const { data } = await window.supabaseClient
                .from('configuracoes')
                .select('key, value')
                .in('key', keys);

            if (data && data.length > 0) {
                const config = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                
                // Salvar no cache para próximas cargas
                localStorage.setItem('whiteLabelConfig', JSON.stringify(config));
                
                // Reaplicar para garantir consistência
                applyConfig(config);
            }
        } catch (e) {
            console.error('Erro ao aplicar White Label:', e);
        }
    };

    // Chamar aplicação do White Label assim que possível
    window.applyWhiteLabelSettings();

    function ensureProfileModal() {
        let modal = document.getElementById('profile-modal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'profile-modal';
        modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4';
        modal.innerHTML = `
            <div class="bg-white w-full max-w-2xl rounded-xl shadow-lg overflow-hidden">
                <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                    <h3 class="text-xl font-bold text-gray-800">Meu Perfil</h3>
                    <button type="button" id="profile-close-btn" class="text-gray-400 hover:text-gray-600 transition-colors">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                <form id="profile-form" class="space-y-6 p-6">
                    <div>
                        <h4 class="text-lg font-semibold text-[var(--color-primary)] mb-4 flex items-center gap-2">
                            <i class="fas fa-id-card"></i> Dados Pessoais
                        </h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                                <input type="text" id="profile-nome" required class="w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--color-primary)] focus:ring focus:ring-[var(--color-primary)] focus:ring-opacity-50 py-2 px-3 border">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                                <input type="date" id="profile-data-nascimento" class="w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--color-primary)] focus:ring focus:ring-[var(--color-primary)] focus:ring-opacity-50 py-2 px-3 border">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                                <select id="profile-tipo-documento" disabled class="w-full rounded-md border-gray-200 bg-gray-100 text-gray-500 py-2 px-3 border">
                                    <option value="CPF">CPF</option>
                                    <option value="CNPJ">CNPJ</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
                                <input type="text" id="profile-documento" disabled class="w-full rounded-md border-gray-200 bg-gray-100 text-gray-500 py-2 px-3 border">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Telefone/WhatsApp</label>
                                <input type="text" id="profile-telefone" class="phone-mask w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--color-primary)] focus:ring focus:ring-[var(--color-primary)] focus:ring-opacity-50 py-2 px-3 border" placeholder="(00) 90000-0000">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
                                <input type="text" id="profile-endereco" class="w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--color-primary)] focus:ring focus:ring-[var(--color-primary)] focus:ring-opacity-50 py-2 px-3 border">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                                <input type="email" id="profile-email" disabled class="w-full rounded-md border-gray-200 bg-gray-100 text-gray-500 py-2 px-3 border">
                            </div>
                            <div class="md:col-span-2">
                                <label class="block text-sm font-medium text-gray-700 mb-2">Foto do Colaborador</label>
                                <div class="flex items-center gap-4">
                                    <img id="profile-foto-preview" src="" alt="Foto" class="h-16 w-16 rounded-full object-cover border border-gray-200 bg-gray-100">
                                    <input type="file" id="profile-foto" accept="image/*" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-[var(--color-primary)] file:text-white hover:file:opacity-90">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button type="button" id="profile-cancel-btn" class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Cancelar</button>
                        <button type="submit" id="profile-save-btn" class="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-opacity shadow-sm">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('#profile-close-btn');
        const cancelBtn = modal.querySelector('#profile-cancel-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => closeProfileModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => closeProfileModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeProfileModal();
        });

        const fotoInput = modal.querySelector('#profile-foto');
        const fotoPreview = modal.querySelector('#profile-foto-preview');
        if (fotoInput && fotoPreview) {
            fotoInput.addEventListener('change', () => {
                const file = fotoInput.files && fotoInput.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => { fotoPreview.src = ev.target.result; };
                reader.readAsDataURL(file);
            });
        }

        const form = modal.querySelector('#profile-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveProfileChanges();
            });
        }

        return modal;
    }

    function openProfileModal() {
        const modal = ensureProfileModal();
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        loadProfileData();
    }

    function closeProfileModal() {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    async function uploadProfileFile(colabId, file) {
        if (!file) return null;
        const bucket = 'colaboradores';
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `fotos/${colabId}-${Date.now()}-${safeName}`;
        const { error } = await window.supabaseClient.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data } = window.supabaseClient.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    }

    async function getCurrentColab() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return { user: null, colab: null };

        let colab = null;
        const { data: byUserId, error: errUserId } = await window.supabaseClient
            .from('colaboradores')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

        if (errUserId) throw errUserId;
        if (byUserId) {
            colab = byUserId;
        } else {
            const { data: byEmail, error: errEmail } = await window.supabaseClient
                .from('colaboradores')
                .select('*')
                .eq('email', user.email)
                .maybeSingle();
            if (errEmail) throw errEmail;
            colab = byEmail || null;
        }

        return { user, colab };
    }

    async function loadProfileData() {
        try {
            const { user, colab } = await getCurrentColab();
            if (!user || !colab) {
                alert('Não foi possível carregar seu perfil.');
                closeProfileModal();
                return;
            }

            window.currentProfileColab = colab;

            const nomeEl = document.getElementById('profile-nome');
            const dataNascEl = document.getElementById('profile-data-nascimento');
            const tipoDocEl = document.getElementById('profile-tipo-documento');
            const docEl = document.getElementById('profile-documento');
            const telEl = document.getElementById('profile-telefone');
            const endEl = document.getElementById('profile-endereco');
            const emailEl = document.getElementById('profile-email');
            const fotoPreview = document.getElementById('profile-foto-preview');

            if (nomeEl) nomeEl.value = colab.nome || '';
            if (dataNascEl) dataNascEl.value = colab.data_nascimento || '';
            if (tipoDocEl) tipoDocEl.value = colab.tipo_documento || 'CPF';
            if (docEl) docEl.value = colab.documento || '';
            if (telEl) telEl.value = colab.telefone || '';
            if (endEl) endEl.value = colab.endereco || '';
            if (emailEl) emailEl.value = colab.email || user.email;
            if (fotoPreview) fotoPreview.src = colab.foto_url || '';
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
            alert('Erro ao carregar seu perfil.');
            closeProfileModal();
        }
    }

    async function saveProfileChanges() {
        const saveBtn = document.getElementById('profile-save-btn');
        const originalText = saveBtn ? saveBtn.innerText : '';
        try {
            if (saveBtn) {
                saveBtn.innerText = 'Salvando...';
                saveBtn.disabled = true;
            }

            const { user, colab } = await getCurrentColab();
            if (!user || !colab) {
                alert('Não foi possível salvar seu perfil.');
                return;
            }

            const nomeEl = document.getElementById('profile-nome');
            const dataNascEl = document.getElementById('profile-data-nascimento');
            const telEl = document.getElementById('profile-telefone');
            const endEl = document.getElementById('profile-endereco');
            const fotoInput = document.getElementById('profile-foto');

            const payload = {
                nome: nomeEl ? nomeEl.value : colab.nome,
                data_nascimento: dataNascEl ? (dataNascEl.value || null) : colab.data_nascimento,
                telefone: telEl ? telEl.value : colab.telefone,
                endereco: endEl ? endEl.value : colab.endereco
            };

            if (fotoInput && fotoInput.files && fotoInput.files[0]) {
                try {
                    payload.foto_url = await uploadProfileFile(colab.id, fotoInput.files[0]);
                } catch (e) {
                    console.error('Upload foto falhou:', e);
                    alert('Erro ao fazer upload da foto.');
                }
            }

            const { error } = await window.supabaseClient
                .from('colaboradores')
                .update(payload)
                .eq('id', colab.id);

            if (error) throw error;

            const avatarEl = document.getElementById('user-avatar-sidebar');
            const nameEl = document.getElementById('user-name-sidebar');
            if (avatarEl && payload.foto_url) avatarEl.src = payload.foto_url;
            if (nameEl && payload.nome) nameEl.innerText = payload.nome.split(' ')[0];

            closeProfileModal();
            window.showToast && window.showToast('Perfil atualizado com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            alert('Erro ao salvar seu perfil.');
        } finally {
            if (saveBtn) {
                saveBtn.innerText = originalText;
                saveBtn.disabled = false;
            }
        }
    }

    function bindProfileClick() {
        const avatarEl = document.getElementById('user-avatar-sidebar');
        const nameEl = document.getElementById('user-name-sidebar');
        const logoutBtn = document.getElementById('btn-logout-sidebar');
        const container = avatarEl ? avatarEl.parentElement : null;

        const attach = (el) => {
            if (!el || el.dataset.profileBound === '1') return;
            el.dataset.profileBound = '1';
            el.classList.add('cursor-pointer');
            el.addEventListener('click', (e) => {
                if (logoutBtn && (e.target === logoutBtn || logoutBtn.contains(e.target))) return;
                openProfileModal();
            });
        };

        attach(avatarEl);
        attach(nameEl);
        attach(container);
    }

    window.updateSidebarProfile = function(user, colabData) {
        const avatarEl = document.getElementById('user-avatar-sidebar');
        const nameEl = document.getElementById('user-name-sidebar');
        const logoutBtn = document.getElementById('btn-logout-sidebar');

        if (nameEl) {
            const displayName = colabData && colabData.nome ? colabData.nome.split(' ')[0] : (user.email.split('@')[0]);
            nameEl.innerText = displayName;
            nameEl.title = colabData && colabData.nome ? colabData.nome : user.email;
        }

        if (avatarEl) {
            if (colabData && colabData.foto_url) {
                avatarEl.src = colabData.foto_url;
            } else {
                // Placeholder
                avatarEl.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSI0Ii8+PHBhdGggZD0iTTIwIDIxdi0yYTQgNCAwIDAgMC00LTRoLThhNCA0IDAgMCAwLTQgNHYyIi8+PC9zdmc+';
                avatarEl.style.padding = '2px';
            }
        }

        if (logoutBtn) {
            const newBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
            newBtn.addEventListener('click', async () => {
                await window.supabaseClient.auth.signOut();
                window.location.href = 'index.html';
            });
        }

        bindProfileClick();
    }

    async function loadUserProfile(session) {
        const userEmailElement = document.getElementById('user-email-display');
        if (userEmailElement) {
            userEmailElement.innerText = session.user.email;
        }

        try {
            const { data: profile } = await window.supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();

            // Busca dados ricos do colaborador
            const { data: colab } = await window.supabaseClient
                .from('colaboradores')
                .select('*')
                .eq('email', session.user.email)
                .maybeSingle();

            // Atualiza Sidebar
            updateSidebarProfile(session.user, colab);

            const allowSuper = (window.SUPERADMIN_EMAILS || []).includes(session.user.email);
            let roleToApply = profile && profile.role ? profile.role : null;
            const colabRole = colab && colab.perfil_acesso ? colab.perfil_acesso : null;

            if (colabRole && (colabRole === 'admin' || colabRole === 'super_admin')) {
                roleToApply = colabRole;
            } else if (colabRole && (!roleToApply || roleToApply === 'usuario' || roleToApply === 'colaborador')) {
                roleToApply = colabRole;
            }

            if (allowSuper) {
                roleToApply = 'super_admin';
            }

            if (!roleToApply) {
                roleToApply = allowSuper ? 'super_admin' : 'usuario';
            }

            if (profile && profile.role !== roleToApply) {
                const rolePersist = roleToApply === 'super_admin' && !allowSuper ? null : roleToApply;
                if (rolePersist) {
                    await window.supabaseClient
                        .from('profiles')
                        .upsert({ id: session.user.id, role: rolePersist });
                }
            }

            if (roleToApply === 'super_admin' && !allowSuper) {
                roleToApply = 'usuario';
            }

            // Atualiza currentUserData globalmente para uso em checkPermissions
            window.currentUserData = {
                ...(colab || {}),
                perfil_acesso: roleToApply,
                permissoes: colab && colab.permissoes ? colab.permissoes : []
            };

            // Aplica permissões
            const permissoes = colab && colab.permissoes ? colab.permissoes : [];
            applyUserPermissions(roleToApply, permissoes);
            
            // Re-checa permissões da Sidebar (novo modelo)
            if (window.checkPermissions) {
                window.checkPermissions();
            }

        } catch (error) {
            console.error('Erro ao buscar perfil:', error);
        }
    }

    function applyUserPermissions(role, permissoes = []) {
        const body = document.body;
        
        // 1. Controle de Exclusão (Botão Lixeira)
        // Apenas SuperAdmin pode excluir (remove a classe no-delete).
        // Todos os outros ganham a classe no-delete.
        if (role === 'super_admin') {
            body.classList.remove('no-delete');
        } else {
            body.classList.add('no-delete');
        }

        // 2. Controle do Menu Lateral (Sidebar)
        // Usa o seletor direto (>) para não afetar os itens de submenu, que são controlados apenas pelo pai
        const menuItems = document.querySelectorAll('.sidebar-menu > li');
        
        menuItems.forEach(item => {
            const link = item.querySelector('a');
            if (!link) return;
            
            const moduleName = link.getAttribute('data-module');
            const restrictedRoles = item.getAttribute('data-role'); // Roles legados do HTML
            
            // SuperAdmin vê tudo
            if (role === 'super_admin') {
                item.style.display = 'block';
                return;
            }

            // Admin vê todos os módulos operacionais, mas não configurações de sistema
            if (role === 'admin') {
                // Se for item exclusivo de super_admin (ex: Configurações, Colaboradores se restrito)
                // Vamos checar o data-role original. Se só tiver 'super_admin', Admin não vê.
                if (restrictedRoles === 'super_admin') {
                    item.style.display = 'none';
                } else {
                    item.style.display = 'block';
                }
                return;
            }

            // Usuário Comum
            if (role === 'usuario') {
                // Dashboard sempre visível
                if (moduleName === 'dashboard') {
                    item.style.display = 'block';
                    return;
                }

                // Verifica se tem permissão explícita no array de permissões
                if (permissoes && permissoes.includes(moduleName)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            }
        });
    }

    // --- PERMISSIONS / RBAC SYSTEM ---
    window.checkPermissions = function() {
        // Verifica elementos restritos e esconde se o usuário não tiver permissão
        const restrictedElements = document.querySelectorAll('.restricted');
        
        // Tenta obter role do usuário (pode estar em window.currentUserData ou precisa buscar)
        // Por padrão, assume 'usuario' se não definido
        let userRole = 'usuario';
        
        // Verifica se há dados de usuário carregados (dashboard.js geralmente carrega)
        if (window.currentUserData && window.currentUserData.perfil_acesso) {
            userRole = window.currentUserData.perfil_acesso;
        } else if (window.supabaseClient) {
            // Se não tiver dados carregados, tenta verificar sessão rapidamente ou aguardar
            // Mas para UI, ideal é esconder preventivamente?
            // Vamos assumir que se não carregou ainda, esconde (fail-safe)
            // OU, verifica se é superadmin hardcoded
            // const session = window.supabaseClient.auth.session(); // Deprecated in v2, use getSession
            // Difícil pegar síncrono.
        }

        // Verifica superadmin por email (hardcoded fallback)
        // window.SUPERADMIN_EMAILS definido no início do app.js
        
        const moduleMap = {
            'social_media.html': 'social_media',
            'trafego_pago.html': 'trafego_pago',
            'financeiro.html': 'financeiro',
            'automacoes.html': 'automacoes',
            'colaboradores.html': 'colaboradores',
            'clientes.html': 'clientes',
            'tarefas.html': 'tarefas'
        };

        restrictedElements.forEach(el => {
            const allowedRoles = (el.dataset.roles || '').split(',');
            let moduleId = el.dataset.module || '';
            if (!moduleId && el.tagName === 'A') {
                const href = el.getAttribute('href') || '';
                const file = href.split('/').pop();
                moduleId = moduleMap[file] || '';
            }
            const permissoes = window.currentUserData && Array.isArray(window.currentUserData.permissoes)
                ? window.currentUserData.permissoes
                : [];
            const hasModulePermission = moduleId && permissoes.includes(moduleId);
            // Se usuário é admin ou super_admin, geralmente tem acesso a tudo, 
            // mas o sistema de roles pode ser explícito.
            // Vamos assumir que super_admin tem acesso irrestrito.
            
            const hasAccess = hasModulePermission || allowedRoles.includes(userRole) || userRole === 'super_admin' || userRole === 'admin';
            
            if (!hasAccess) {
                el.style.display = 'none';
            } else {
                el.style.display = ''; // Restaura display original (flex, block, etc)
            }
        });

        const settingsLinks = document.querySelectorAll('a[href="configuracoes.html"], a[href$="/configuracoes.html"]');
        settingsLinks.forEach(link => {
            if (userRole !== 'admin' && userRole !== 'super_admin') {
                link.style.display = 'none';
            } else {
                link.style.display = '';
            }
        });
    };

    // --- Máscara de Telefone Global ---
    // Aplica a máscara em campos com classe 'phone-mask' ou IDs específicos
    const phoneInputs = document.querySelectorAll('.phone-mask, #telefone, #responsavel_whatsapp, #whatsapp');
    
    // Melhor implementação de máscara que não buga no backspace
    function maskPhoneInput(e) {
        let v = e.target.value.replace(/\D/g, "");
        if (v.length > 11) v = v.slice(0, 11);

        if (v.length > 10) {
            // (11) 91234-5678
            v = v.replace(/^(\d\d)(\d{5})(\d{4}).*/, "($1) $2-$3");
        } else if (v.length > 5) {
            // (11) 1234-5678
            v = v.replace(/^(\d\d)(\d{4})(\d{0,4}).*/, "($1) $2-$3");
        } else if (v.length > 2) {
            v = v.replace(/^(\d\d)(\d{0,5})/, "($1) $2");
        } else {
            v = v.replace(/^(\d*)/, "($1");
        }
        e.target.value = v;
    }

    phoneInputs.forEach(input => {
        input.addEventListener('input', maskPhoneInput);
    });

    const chatLinks = document.querySelectorAll('a[href="chat.html"], a[href$="/chat.html"]');
    chatLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Módulo em desenvolvimento');
            window.location.href = 'home.html';
        });
    });

    // Lógica de Login (Formulário)
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            try {
                submitBtn.innerText = 'Entrando...';
                submitBtn.disabled = true;
                
                const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                    email, password
                });

                if (error) throw error;
                
                // Redireciona com token para garantir (hack local)
                if (data.session) {
                    const params = new URLSearchParams();
                    params.append('access_token', data.session.access_token);
                    params.append('refresh_token', data.session.refresh_token);
                    window.location.href = 'dashboard.html?' + params.toString();
                }

            } catch (error) {
                alert('Erro ao entrar: ' + error.message);
                submitBtn.innerText = 'Entrar';
                submitBtn.disabled = false;
            }
        });
    }

    // --- 3. Logout ---
    const btnLogout = document.getElementById('btn-logout-sidebar');
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (confirm('Tem certeza que deseja sair?')) {
                const { error } = await window.supabaseClient.auth.signOut();
                if (!error) {
                    window.location.href = 'index.html';
                }
            }
        });
    }

    // --- 4. Submenu Toggle (Global) ---
    window.toggleSubmenu = (e, link) => {
        e.preventDefault();
        const submenu = link.nextElementSibling;
        const icon = link.querySelector('.fa-chevron-down');
        
        if (submenu.style.display === 'block') {
            submenu.style.display = 'none';
            icon.classList.remove('rotate-icon');
        } else {
            submenu.style.display = 'block';
            icon.classList.add('rotate-icon');
        }
    };

    // --- 5. White Label System ---
    window.applyWhiteLabelSettings = async function() {
        // 1. Tentar carregar do LocalStorage (Instantâneo)
        try {
            const cachedWL = localStorage.getItem('gqv_whitelabel_config');
            if (cachedWL) {
                applyWLStyles(JSON.parse(cachedWL));
            }
        } catch (e) { console.error('Erro ler cache WL', e); }

        // 2. Tentar carregar do Supabase (Atualizado)
        if (window.supabaseClient) {
            try {
                const keys = ['white_label_primary_color', 'white_label_secondary_color', 'white_label_favicon_url', 'white_label_logo_url'];
                const { data } = await window.supabaseClient
                    .from('configuracoes')
                    .select('key, value')
                    .in('key', keys);
                
                if (data && data.length > 0) {
                    const config = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    localStorage.setItem('gqv_whitelabel_config', JSON.stringify(config));
                    applyWLStyles(config);
                }
            } catch (e) {
                console.error('Erro buscar WL Supabase:', e);
            }
        }
    };

    function applyWLStyles(config) {
        const root = document.documentElement;

        if (config.white_label_primary_color) {
            root.style.setProperty('--color-primary', config.white_label_primary_color);
            // Sidebar assume a cor principal conforme solicitado
            root.style.setProperty('--bg-sidebar', config.white_label_primary_color);
        }
        
        if (config.white_label_secondary_color) {
            root.style.setProperty('--color-secondary', config.white_label_secondary_color);
        }

        if (config.white_label_favicon_url) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = config.white_label_favicon_url;
        }

        if (config.white_label_logo_url) {
            const logoImgs = document.querySelectorAll('.sidebar-header img');
            logoImgs.forEach(img => img.src = config.white_label_logo_url);
        }
    }

    // Inicializar White Label
    window.applyWhiteLabelSettings();

});

// --- AUTOMACAO FINANCEIRA (Cobrança Recorrente) ---
// Regra: Criar cobrança do mês seguinte, 15 dias antes do vencimento.
window.verificarGeracaoMensalidadesAutomaticas = async function() {
    if (!window.supabaseClient) return;
    
    // Evitar rodar múltiplas vezes no mesmo dia
    const hojeISO = new Date().toISOString().split('T')[0];
    const checkKey = `mensalidades_checked_${hojeISO}`;
    
    // Se já rodou hoje, para.
    if (localStorage.getItem(checkKey)) {
        console.log('✅ Verificação de mensalidades já realizada hoje.');
        return;
    }

    console.log('🔄 Iniciando verificação de mensalidades automáticas...');

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        // 1. Buscar clientes ativos com mensalidades
        const { data: clientes, error: errClientes } = await window.supabaseClient
            .from('clientes')
            .select('*')
            .eq('status', 'Ativo');

        if (errClientes) throw errClientes;

        if (!clientes || clientes.length === 0) {
            console.log('Nenhum cliente ativo para verificar.');
            localStorage.setItem(checkKey, 'true');
            return;
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0); // Zerar hora para comparação correta de dias

        const promises = [];

        // Helper para corrigir data (ex: 31 de Fev -> 28/29 de Fev)
        const getDateForDay = (year, month, day) => {
            // dia 0 do mês seguinte é o último dia do mês atual
            // mas aqui queremos dia X do mês M.
            // Se dia X não existe no mês M (ex: 30 de Fev), JS pula para Março.
            // Precisamos travar no último dia do mês se estourar.
            
            const date = new Date(year, month, day);
            // Se o mês mudou, significa que o dia não existe naquele mês
            if (date.getMonth() !== month) {
                 // Retorna o último dia do mês correto
                return new Date(year, month + 1, 0);
            }
            return date;
        };

        for (const cliente of clientes) {
            if (!cliente.mensalidades || !Array.isArray(cliente.mensalidades)) continue;

            for (const mensalidade of cliente.mensalidades) {
                if (!mensalidade.valor || !mensalidade.dia_vencimento) continue;

                // Verificar vencimento deste mês e do próximo
                const currentYear = hoje.getFullYear();
                const currentMonth = hoje.getMonth(); // 0-11

                // Datas candidatas: mês atual e próximo mês
                // Ex: Hoje 20/Out. Vencimento dia 05.
                // Mês atual: 05/Out (Passou). Mês seg: 05/Nov (Futuro).
                const datasParaVerificar = [
                    getDateForDay(currentYear, currentMonth, mensalidade.dia_vencimento),
                    getDateForDay(currentYear, currentMonth + 1, mensalidade.dia_vencimento)
                ];

                for (const dataVencimento of datasParaVerificar) {
                    dataVencimento.setHours(0, 0, 0, 0); // Zerar hora

                    // Diferença em dias
                    const diffTime = dataVencimento.getTime() - hoje.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    
                    // Log de debug para entender o cálculo
                    // console.log(`Cliente: ${cliente.nome_fantasia}, Venc: ${dataVencimento.toISOString()}, Diff: ${diffDays}`);

                    // Se já passou há mais de 45 dias, ignora (muito antigo)
                    if (diffDays < -45) continue;

                    // Regra: "15 dias antes do vencimento"
                    // Se faltam 15 dias ou menos (e não é muito antigo, ex: > -5 dias para evitar gerar duplicado de meses passados se falhou antes)
                    // Vamos considerar uma janela: de 15 dias antes até 5 dias depois do vencimento (caso o script não rode por uns dias)
                    // Se diffDays <= 15. E diffDays > -10 (exemplo).
                    // Mas a verificação de existência no banco já protege contra duplicatas.
                    
                    if (diffDays <= 15 && diffDays >= -5) {
                        promises.push((async () => {
                            // Ajuste para garantir data correta no ISO (fuso horário)
                            // Usamos dataVencimento que está 00:00 local. 
                            // toISOString usa UTC. Se formos -3, vira dia anterior 21:00.
                            // Solução: Criar data com timezone offset compensado ou string manual.
                            const ano = dataVencimento.getFullYear();
                            const mes = String(dataVencimento.getMonth() + 1).padStart(2, '0');
                            const dia = String(dataVencimento.getDate()).padStart(2, '0');
                            const dataISO = `${ano}-${mes}-${dia}`;

                            const nomeParaDescricao = cliente.nome_fantasia || cliente.nome_empresa;
                            const sufixo = mensalidade.descricao ? ` - ${mensalidade.descricao}` : '';
                            const descricao = `Mensalidade - ${nomeParaDescricao}${sufixo}`; 

                            // Verificar se já existe cobrança para esta data e descrição
                            const { data: existing } = await window.supabaseClient
                                .from('financeiro')
                                .select('id')
                                .gte('data_transacao', dataISO) // Mesma data
                                .lte('data_transacao', dataISO) // Mesma data
                                .eq('categoria', 'Mensalidade')
                                .ilike('descricao', descricao) // Case insensitive
                                .maybeSingle();

                            if (!existing) {
                                console.log(`➕ Gerando cobrança auto: ${cliente.nome_fantasia} para ${dataISO}`);
                                
                                await window.supabaseClient.from('financeiro').insert({
                                    descricao: descricao,
                                    valor: mensalidade.valor,
                                    tipo: 'entrada',
                                    categoria: 'Mensalidade',
                                    status: 'a_vencer',
                                    data_transacao: dataISO,
                                    user_id: user.id
                                });
                            }
                        })());
                    }
                }
            }
        }

        await Promise.all(promises);
        console.log('✅ Verificação de mensalidades concluída.');
        localStorage.setItem(checkKey, 'true');
        
        // Notificar que houve atualização financeira
        window.dispatchEvent(new CustomEvent('mensalidades_atualizadas'));

    } catch (error) {
        console.error('Erro na automação de mensalidades:', error);
    }
};

window.verificarGeracaoSalariosAutomaticos = async function(options = {}) {
    if (!window.supabaseClient) return;

    const hojeISO = new Date().toISOString().split('T')[0];
    const checkKey = `salarios_checked_${hojeISO}`;

    if (!options.force && localStorage.getItem(checkKey)) {
        return;
    }

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        const { data: colaboradores, error: errColabs } = await window.supabaseClient
            .from('colaboradores')
            .select('id, nome, salario, ativo, dia_vencimento_pagamento')
            .eq('ativo', true);

        if (errColabs) throw errColabs;

        const ativos = (colaboradores || []).filter(c => Number(c.salario) > 0);
        if (!ativos.length) {
            localStorage.setItem(checkKey, 'true');
            return;
        }

        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mesIndex = hoje.getMonth();
        const competencia = `${ano}-${String(mesIndex + 1).padStart(2, '0')}`;

        const ids = ativos.map(c => c.id);
        const { data: existentes, error: errExist } = await window.supabaseClient
            .from('financeiro')
            .select('id, colaborador_id, valor')
            .eq('competencia', competencia)
            .in('colaborador_id', ids)
            .eq('tipo', 'saida');

        if (errExist) throw errExist;

        const existentesMap = new Map((existentes || []).map(e => [e.colaborador_id, e]));
        const inserts = [];
        const updates = [];

        ativos.forEach(c => {
            const salario = Number(c.salario);
            const descricao = `Salário - ${c.nome}`;
            const diaVencimento = Number(c.dia_vencimento_pagamento);
            const lastDay = new Date(ano, mesIndex + 1, 0).getDate();
            const diaFinal = Number.isFinite(diaVencimento) && diaVencimento > 0
                ? Math.min(diaVencimento, lastDay)
                : 1;
            const dataBase = `${ano}-${String(mesIndex + 1).padStart(2, '0')}-${String(diaFinal).padStart(2, '0')}`;
            const existente = existentesMap.get(c.id);
            if (existente) {
                if (Number(existente.valor) !== salario) {
                    updates.push({ id: existente.id, valor: salario, descricao, data_transacao: dataBase });
                }
            } else {
                inserts.push({
                    descricao,
                    valor: salario,
                    tipo: 'saida',
                    categoria: 'Pessoal',
                    status: 'a_vencer',
                    data_transacao: dataBase,
                    colaborador_id: c.id,
                    competencia,
                    user_id: user.id
                });
            }
        });

        if (updates.length) {
            await Promise.all(updates.map(u => (
                window.supabaseClient
                    .from('financeiro')
                    .update({ valor: u.valor, descricao: u.descricao, data_transacao: u.data_transacao })
                    .eq('id', u.id)
            )));
        }

        if (inserts.length) {
            await window.supabaseClient.from('financeiro').insert(inserts);
        }

        localStorage.setItem(checkKey, 'true');
        window.dispatchEvent(new CustomEvent('mensalidades_atualizadas'));
    } catch (error) {
        console.error('Erro na automação de salários:', error);
    }
};
