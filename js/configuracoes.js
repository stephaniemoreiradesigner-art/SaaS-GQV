document.addEventListener('DOMContentLoaded', async () => {
    // --- CONTROLE DE ACESSO (RBAC) ---
    // Verifica se o usuário tem permissão para ver configurações sensíveis
    async function checkAccessControl() {
        // Aguarda currentUserData estar disponível (max 2s)
        let attempts = 0;
        while (!window.currentUserData && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        let user = window.currentUserData || null;
        let role = user && user.perfil_acesso ? user.perfil_acesso : 'usuario';

        if ((!user || (role !== 'admin' && role !== 'super_admin')) && window.supabaseClient) {
            try {
                const { data: sessionData } = await window.supabaseClient.auth.getSession();
                const session = sessionData && sessionData.session ? sessionData.session : null;
                if (session) {
                    const { data: colab } = await window.supabaseClient
                        .from('colaboradores')
                        .select('perfil_acesso, permissoes')
                        .eq('email', session.user.email)
                        .maybeSingle();
                    if (colab && colab.perfil_acesso && (colab.perfil_acesso === 'admin' || colab.perfil_acesso === 'super_admin')) {
                        user = {
                            ...(user || {}),
                            perfil_acesso: colab.perfil_acesso,
                            permissoes: colab.permissoes || []
                        };
                        window.currentUserData = user;
                        role = colab.perfil_acesso;
                    }
                }
            } catch (e) {}
        }

        const canSeeWhiteLabel = role === 'super_admin' || role === 'admin';
        
        console.log('🔒 Verificando acesso a configurações. Role:', role);

        if (role !== 'admin' && role !== 'super_admin') {
            window.location.href = 'dashboard.html';
            return;
        }

        const tabWhiteLabel = document.querySelector('div[onclick="openSettingsTab(\'whitelabel\')"]');

        if (tabWhiteLabel) {
            tabWhiteLabel.style.display = canSeeWhiteLabel ? '' : 'none';
        }

        if (!canSeeWhiteLabel) {
            
            // Se por acaso a aba ativa for a whitelabel (ex: persistência de estado), forçar mudança
            const activeTab = document.querySelector('.settings-sidebar .active');
            if (activeTab && activeTab.getAttribute('onclick').includes('whitelabel')) {
                openSettingsTab('integrations'); // Força aba segura
            }
        }
    }
    checkAccessControl();

    const form = document.getElementById('form-config-ai');
    const inputKey = document.getElementById('openai_api_key');
    const inputFbToken = document.getElementById('facebook_app_token');
    const btnSave = document.getElementById('btn-save-config');

    // Carregar configuração atual
    loadConfig();

    // --- WEBHOOKS (n8n) ---
    const formWebhooks = document.getElementById('form-config-webhooks');
    const inputWebhookApproval = document.getElementById('n8n_webhook_approval');
    const inputWebhookTraffic = document.getElementById('n8n_webhook_traffic_metrics');
    const inputWebhookGoogle = document.getElementById('n8n_webhook_google_ads');
    const btnSaveWebhooks = document.getElementById('btn-save-webhooks');

    // --- TESTE DE WEBHOOK ---
    const btnTestTraffic = document.getElementById('btn-test-traffic');
    if (btnTestTraffic) {
        btnTestTraffic.addEventListener('click', async () => {
            const url = inputWebhookTraffic.value.trim();
            if (!url) {
                alert('Por favor, insira uma URL para testar.');
                return;
            }

            const originalHtml = btnTestTraffic.innerHTML;
            btnTestTraffic.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btnTestTraffic.disabled = true;

            try {
                // Simulação de payload
                const payload = {
                    client_id: "CLIENTE_TESTE_123",
                    client_name: "Empresa Exemplo Ltda",
                    action: "fetch_metrics",
                    timestamp: new Date().toISOString()
                };

                console.log('Enviando teste para:', url, payload);

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    alert('Teste enviado com sucesso! Verifique seu n8n.');
                } else {
                    alert('O servidor retornou erro: ' + response.status);
                }

            } catch (err) {
                console.error(err);
                alert('Erro ao enviar teste: ' + err.message);
            } finally {
                btnTestTraffic.innerHTML = originalHtml;
                btnTestTraffic.disabled = false;
            }
        });
    }

	if (formWebhooks) {
		const inputWebhookDashboard = document.getElementById('n8n_webhook_traffic_dashboard');
		loadWebhooksConfig();

		async function loadWebhooksConfig() {
			if (!window.supabaseClient) {
				setTimeout(loadWebhooksConfig, 300);
				return;
			}
			try {
				const { data: dataApproval } = await window.supabaseClient
					.from('configuracoes')
					.select('value')
					.eq('key', 'n8n_webhook_approval')
					.single();
				if (dataApproval) {
					inputWebhookApproval.value = dataApproval.value;
					try { localStorage.setItem('n8n_webhook_approval', dataApproval.value || ''); } catch (e) {}
				}
				
				const { data: dataDashboard } = await window.supabaseClient
					.from('configuracoes')
					.select('value')
					.eq('key', 'n8n_webhook_traffic_dashboard')
					.single();
				if (dataDashboard && inputWebhookDashboard) {
					inputWebhookDashboard.value = dataDashboard.value;
					try { localStorage.setItem('n8n_webhook_traffic_dashboard', dataDashboard.value || ''); } catch (e) {}
				}
				
				const { data: dataTraffic } = await window.supabaseClient
					.from('configuracoes')
					.select('value')
					.eq('key', 'n8n_webhook_traffic_metrics')
					.single();
				if (dataTraffic) {
					inputWebhookTraffic.value = dataTraffic.value;
					try { localStorage.setItem('n8n_webhook_traffic_metrics', dataTraffic.value || ''); } catch (e) {}
				}

                const { data: dataGoogle } = await window.supabaseClient
					.from('configuracoes')
					.select('value')
					.eq('key', 'n8n_webhook_google_ads')
					.single();
				if (dataGoogle && inputWebhookGoogle) {
					inputWebhookGoogle.value = dataGoogle.value;
					try { localStorage.setItem('n8n_webhook_google_ads', dataGoogle.value || ''); } catch (e) {}
				}
				
			} catch (err) { console.error(err); }
		}

		formWebhooks.addEventListener('submit', async (e) => {
			e.preventDefault();
			const originalText = btnSaveWebhooks.innerHTML;
			btnSaveWebhooks.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
			btnSaveWebhooks.disabled = true;
			
			const webhookApproval = inputWebhookApproval.value.trim();
			const webhookDashboard = inputWebhookDashboard ? inputWebhookDashboard.value.trim() : '';
			const webhookTraffic = inputWebhookTraffic.value.trim();
            const webhookGoogle = inputWebhookGoogle ? inputWebhookGoogle.value.trim() : '';
			
			try {
				const { error: err1 } = await window.supabaseClient
					.from('configuracoes')
					.upsert({
						key: 'n8n_webhook_approval',
						value: webhookApproval,
						description: 'Webhook do n8n para Aprovação Finalizada'
					});
				if (err1) throw err1;
				
				if (inputWebhookDashboard) {
					const { error: errDash } = await window.supabaseClient
						.from('configuracoes')
						.upsert({
							key: 'n8n_webhook_traffic_dashboard',
							value: webhookDashboard,
							description: 'Webhook do n8n para Dashboard de Tráfego'
						});
					if (errDash) throw errDash;
				}
				
				const { error: err2 } = await window.supabaseClient
					.from('configuracoes')
					.upsert({
						key: 'n8n_webhook_traffic_metrics',
						value: webhookTraffic,
						description: 'Webhook do n8n para Métricas de Tráfego (Relatórios)'
					});
				if (err2) throw err2;

                if (inputWebhookGoogle) {
					const { error: errGoogle } = await window.supabaseClient
						.from('configuracoes')
						.upsert({
							key: 'n8n_webhook_google_ads',
							value: webhookGoogle,
							description: 'Webhook do n8n para Métricas do Google Ads'
						});
					if (errGoogle) throw errGoogle;
				}
				
				try {
					localStorage.setItem('n8n_webhook_approval', webhookApproval || '');
					if (inputWebhookDashboard) localStorage.setItem('n8n_webhook_traffic_dashboard', webhookDashboard || '');
					localStorage.setItem('n8n_webhook_traffic_metrics', webhookTraffic || '');
                    if (inputWebhookGoogle) localStorage.setItem('n8n_webhook_google_ads', webhookGoogle || '');
				} catch (e) {}
				
				alert('Webhooks salvos com sucesso!');
			} catch (err) {
				console.error(err);
				alert('Erro: ' + err.message);
			} finally {
				btnSaveWebhooks.innerHTML = originalText;
				btnSaveWebhooks.disabled = false;
			}
		});
	}

    async function loadConfig() {
        if (!window.supabaseClient) {
            setTimeout(loadConfig, 300);
            return;
        }

        // VIBECODE SECURITY: 
        // Não carregamos mais chaves sensíveis para o frontend.
        // Apenas liberamos a UI.

        if (window.showContent) window.showContent();
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
             // Listener mantido apenas se o form existir (legado)
             e.preventDefault();
             alert('Use o arquivo .env para configurar as chaves.');
        });
    }

    // --- GESTÃO DE TIMES ---
    const formTime = document.getElementById('form-add-time');
    const inputTimeNome = document.getElementById('novo-time-nome');
    
    loadTimes();

    async function loadTimes() {
        const container = document.getElementById('lista-times');
        if (!window.supabaseClient) {
            setTimeout(loadTimes, 500);
            return;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('times')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                container.innerHTML = '<p class="text-gray-500 italic text-sm">Nenhum time cadastrado.</p>';
                return;
            }

            let html = '<ul class="divide-y divide-gray-100">';
            data.forEach(time => {
                html += `
                    <li class="flex justify-between items-center py-3">
                        <span class="font-medium text-gray-700">${time.nome}</span>
                        <button onclick="deleteTime('${time.id}')" class="text-red-500 hover:text-red-700 transition-colors p-1" title="Excluir Time">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </li>
                `;
            });
            html += '</ul>';
            container.innerHTML = html;

        } catch (err) {
            console.error('Erro ao carregar times:', err);
            container.innerHTML = '<p class="text-red-500 text-sm">Erro ao carregar lista de times.</p>';
        }
    }

    formTime.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nome = inputTimeNome.value.trim();
        if (!nome) return;

        const btn = formTime.querySelector('button');
        const originalText = btn.innerHTML;
        btn.innerText = '...';
        btn.disabled = true;

        try {
            const { error } = await window.supabaseClient
                .from('times')
                .insert({ nome: nome });

            if (error) throw error;

            inputTimeNome.value = '';
            loadTimes();
            
        } catch (err) {
            alert('Erro ao criar time: ' + err.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    });

    window.deleteTime = async (id) => {
        if (!confirm('Tem certeza? Isso pode afetar clientes e colaboradores vinculados.')) return;

        try {
            const { error } = await window.supabaseClient
                .from('times')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadTimes();
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        }
    };

    // --- GESTÃO DE CATEGORIAS FINANCEIRAS ---
    const formCategoria = document.getElementById('form-add-category');
    const inputCategoriaNome = document.getElementById('nova-categoria-nome');
    const selectCategoriaTipo = document.getElementById('nova-categoria-tipo');
    
    loadCategorias();

    async function loadCategorias() {
        const container = document.getElementById('lista-categorias-financeiras');
        if (!container) {
            return;
        }
        if (!window.supabaseClient) {
            setTimeout(loadCategorias, 500);
            return;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('categorias_financeiro')
                .select('*')
                .order('created_at', { ascending: false });

            // Se a tabela não existir, ignora erro silenciosamente ou mostra aviso amigável
            if (error) {
                if (error.code === '42P01') { // undefined_table
                     container.innerHTML = '<p class="text-orange-500 text-sm">Tabela de categorias ainda não criada. Rode o script SQL.</p>';
                     return;
                }
                throw error;
            }

            if (!data || data.length === 0) {
                container.innerHTML = '<p class="text-gray-500 italic text-sm">Nenhuma categoria cadastrada.</p>';
                return;
            }

            let html = '<ul class="divide-y divide-gray-100">';
            data.forEach(cat => {
                let badgeClass = 'bg-gray-100 text-gray-800';
                if(cat.tipo === 'entrada') badgeClass = 'bg-green-100 text-green-800';
                if(cat.tipo === 'saida') badgeClass = 'bg-red-100 text-red-800';
                
                let tipoLabel = cat.tipo === 'ambos' ? 'Entrada & Saída' : (cat.tipo === 'entrada' ? 'Entrada' : 'Saída');

                html += `
                    <li class="flex justify-between items-center py-3">
                        <div class="flex items-center gap-2">
                            <span class="font-medium text-gray-700">${cat.nome}</span>
                            <span class="text-xs px-2 py-0.5 rounded-full ${badgeClass}">${tipoLabel}</span>
                        </div>
                        <button onclick="deleteCategoria('${cat.id}')" class="text-red-500 hover:text-red-700 transition-colors p-1" title="Excluir Categoria">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </li>
                `;
            });
            html += '</ul>';
            container.innerHTML = html;

        } catch (err) {
            console.error('Erro ao carregar categorias:', err);
            container.innerHTML = '<p class="text-red-500 text-sm">Erro ao carregar lista de categorias.</p>';
        }
    }

    if (formCategoria) {
        formCategoria.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nome = inputCategoriaNome.value.trim();
            const tipo = selectCategoriaTipo.value;
            if (!nome) return;

            const btn = formCategoria.querySelector('button');
            const originalText = btn.innerHTML;
            btn.innerText = '...';
            btn.disabled = true;

            try {
                // Pega o ID do usuário logado
                const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
                if (authError || !user) throw new Error("Usuário não autenticado");

                const { error } = await window.supabaseClient
                    .from('categorias_financeiro')
                    .insert({ 
                        nome: nome,
                        tipo: tipo,
                        user_id: user.id
                    });

                if (error) throw error;

                inputCategoriaNome.value = '';
                loadCategorias();
                
            } catch (err) {
                alert('Erro ao criar categoria: ' + err.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    window.deleteCategoria = async (id) => {
        if (!confirm('Tem certeza?')) return;

        try {
            const { error } = await window.supabaseClient
                .from('categorias_financeiro')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadCategorias();
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        }
    };


    // --- WHITE LABEL ---
    const formWhiteLabel = document.getElementById('form-config-whitelabel');
    const inputPrimaryColor = document.getElementById('wl_primary_color');
    const inputPrimaryText = document.getElementById('wl_primary_color_text');
    const inputSecondaryColor = document.getElementById('wl_secondary_color');
    const inputSecondaryText = document.getElementById('wl_secondary_color_text');
    const inputFavicon = document.getElementById('wl_favicon');
    const inputSidebarLogo = document.getElementById('wl_sidebar_logo');
    const btnSaveWL = document.getElementById('btn-save-whitelabel');

    // Sync Color Inputs
    function syncColor(inputColor, inputText) {
        inputColor.addEventListener('input', () => inputText.value = inputColor.value.toUpperCase());
        inputText.addEventListener('input', () => {
            if (/^#[0-9A-F]{6}$/i.test(inputText.value)) {
                inputColor.value = inputText.value;
            }
        });
    }

    if (inputPrimaryColor && inputPrimaryText) syncColor(inputPrimaryColor, inputPrimaryText);
    if (inputSecondaryColor && inputSecondaryText) syncColor(inputSecondaryColor, inputSecondaryText);

    // Carregar configs White Label
    loadWhiteLabelConfig();

    async function loadWhiteLabelConfig() {
        if (!window.supabaseClient) { setTimeout(loadWhiteLabelConfig, 500); return; }
        
        try {
            const keys = ['white_label_primary_color', 'white_label_secondary_color', 'white_label_favicon_url', 'white_label_logo_url'];
            const { data } = await window.supabaseClient
                .from('configuracoes')
                .select('key, value')
                .in('key', keys);
            
            if (data) {
                const config = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                
                if (config.white_label_primary_color) {
                    inputPrimaryColor.value = config.white_label_primary_color;
                    inputPrimaryText.value = config.white_label_primary_color;
                }
                if (config.white_label_secondary_color) {
                    inputSecondaryColor.value = config.white_label_secondary_color;
                    inputSecondaryText.value = config.white_label_secondary_color;
                }
                if (config.white_label_favicon_url) {
                    const preview = document.getElementById('wl_favicon_preview');
                    if (preview) preview.innerHTML = `<img src="${config.white_label_favicon_url}" class="w-8 h-8 object-contain"> <small class="text-gray-500 ml-2">Atual</small>`;
                }
                if (config.white_label_logo_url) {
                    const preview = document.getElementById('wl_logo_preview');
                    if (preview) preview.innerHTML = `<img src="${config.white_label_logo_url}" class="h-12 bg-gray-50 p-1 border rounded object-contain"> <small class="text-gray-500 ml-2">Atual</small>`;
                }
            }
        } catch (e) {
            console.error('Erro ao carregar White Label:', e);
        }
    }

    // Helper: Validar Dimensões da Imagem (SVG, PNG, JPG)
    function validateImageDimensions(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            // Validar Tipo
            const validTypes = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'];
            // Verifica pelo MIME type ou extensão
            const isTypeValid = validTypes.includes(file.type) || /\.(svg|png|jpg|jpeg)$/i.test(file.name);
            
            if (!isTypeValid) {
                reject(new Error("Formato inválido. Use SVG, PNG ou JPG."));
                return;
            }

            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                // Validação de dimensão apenas se não for SVG (SVGs podem não ter dimensões intrínsecas claras ou ser escaláveis)
                // Mas se tiver dimensões definidas, valida.
                if (img.width > maxWidth || img.height > maxHeight) {
                    reject(new Error(`A imagem excede as dimensões permitidas de ${maxWidth}x${maxHeight}px. (Atual: ${img.width}x${img.height}px)`));
                } else {
                    resolve(true);
                }
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("Arquivo de imagem inválido."));
            };
            
            img.src = objectUrl;
        });
    }

    // --- FUNÇÕES GLOBAIS PARA TEMPLATE DE EMAIL ---
    // (Removido: O usuário já configurou o template neutro no Supabase)

    // Salvar White Label
    if (formWhiteLabel) {
        formWhiteLabel.addEventListener('submit', async (e) => {
            e.preventDefault();
            const originalText = btnSaveWL.innerHTML;
            btnSaveWL.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            btnSaveWL.disabled = true;

            try {
                // 0. Validação de Imagens (Logo Sidebar)
                if (inputSidebarLogo.files && inputSidebarLogo.files[0]) {
                    // Limite: 500px de largura x 500px de altura (conforme solicitado)
                    try {
                        await validateImageDimensions(inputSidebarLogo.files[0], 500, 500);
                    } catch (validErr) {
                        throw new Error("Erro no Logo do Sidebar: " + validErr.message);
                    }
                }

                // 1. Salvar Cores
                const updates = [
                    { key: 'white_label_primary_color', value: inputPrimaryColor.value, description: 'Cor Primária White Label' },
                    { key: 'white_label_secondary_color', value: inputSecondaryColor.value, description: 'Cor Secundária White Label' }
                ];

                // 2. Upload Favicon
                if (inputFavicon.files && inputFavicon.files[0]) {
                    const file = inputFavicon.files[0];
                    const url = await uploadWhiteLabelFile('favicon', file);
                    updates.push({ key: 'white_label_favicon_url', value: url, description: 'Favicon White Label' });
                }

                // 3. Upload Logo
                if (inputSidebarLogo.files && inputSidebarLogo.files[0]) {
                    const file = inputSidebarLogo.files[0];
                    const url = await uploadWhiteLabelFile('sidebar-logo', file);
                    updates.push({ key: 'white_label_logo_url', value: url, description: 'Logo Sidebar White Label' });
                }

                const { error } = await window.supabaseClient.from('configuracoes').upsert(updates);
                if (error) throw error;

                alert('Configurações de Personalização salvas com sucesso!');
                
                // Aplicar imediatamente
                if (window.applyWhiteLabelSettings) {
                    window.applyWhiteLabelSettings();
                }

                // Recarregar previews
                loadWhiteLabelConfig();

            } catch (err) {
                console.error(err);
                alert('Erro ao salvar: ' + err.message);
            } finally {
                btnSaveWL.innerHTML = originalText;
                btnSaveWL.disabled = false;
            }
        });
    }

    async function uploadWhiteLabelFile(prefix, file) {
        const bucket = 'colaboradores'; // Usando bucket existente
        const ext = file.name.split('.').pop();
        const timestamp = Date.now();
        const path = `white-label/${prefix}-${timestamp}.${ext}`;
        
        // 1. Upload do arquivo versionado (histórico)
        const { error } = await window.supabaseClient.storage
            .from(bucket)
            .upload(path, file, { upsert: true, contentType: file.type });
            
        if (error) throw error;

        // 2. Se for o logo do sidebar, salvar também uma cópia "fixa" para o e-mail
        // Isso permite que o template de e-mail use sempre a mesma URL
        if (prefix === 'sidebar-logo') {
            const fixedPath = `white-label/logo-email.png`; // Forçamos .png ou mantemos a extensão original se preferir
            // Vamos manter a extensão original para evitar quebra se for jpg
            // Mas para o template de e-mail funcionar sem mexer, o ideal seria uma extensão fixa.
            // Vamos tentar converter? Não, JS puro no front é chato.
            // Vamos salvar com nome fixo e extensão original, mas o template precisaria saber.
            // MELHOR: Salvar como 'logo-email' (sem extensão na URL pública funciona? Depende do browser/client).
            // Vamos assumir que o usuário sobe PNG. Se não, vamos salvar como 'logo-system.png' e definir content-type correto.
            
            await window.supabaseClient.storage
                .from(bucket)
                .upload('white-label/logo-system.png', file, { upsert: true, contentType: file.type });
        }
        
        const { data } = window.supabaseClient.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    }
});
