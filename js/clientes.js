// Função global para renderizar área de clientes demo
function renderDemoArea(clientesDemo) {
    if (!Array.isArray(clientesDemo) || clientesDemo.length === 0) return;
    let demoArea = document.getElementById('demoArea');
    if (!demoArea) {
        // Tenta criar acima da tabela principal
        const mainContainer = document.getElementById('lista-clientes-container') || document.body;
        demoArea = document.createElement('div');
        demoArea.id = 'demoArea';
        demoArea.className = 'mt-8';
        mainContainer.insertBefore(demoArea, mainContainer.firstChild);
    }
    let html = `<h2 class="text-lg font-bold text-gray-700 mb-2">Clientes Demo</h2><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
    clientesDemo.forEach(cliente => {
        const nomeExibicao = cliente.nome_fantasia || cliente.nome_empresa;
        html += `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><div class="font-semibold text-yellow-800">${nomeExibicao}</div></div>`;
    });
    html += `</div>`;
    demoArea.innerHTML = html;
}
document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se estamos na página de clientes
    if (!window.location.pathname.includes('clientes.html')) return;

    console.log('Módulo Clientes Iniciado');

    const clientesTableBody = document.getElementById('clientes-cards');
    const formCliente = document.getElementById('form-cliente');
    const mensalidadesContainer = document.getElementById('mensalidades-container');

    const phoneInputs = ['telefone', 'responsavel_whatsapp', 'responsavel_whatsapp_2'];
    phoneInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function (e) {
                let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
                e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
            });
        }
    });

    const normalizeGroupLink = (value) => {
        const trimmed = value ? String(value).trim() : '';
        if (!trimmed) return '';
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://${trimmed}`;
    };

    const updateGroupLinkPreview = (value) => {
        const preview = document.getElementById('link_grupo_preview');
        if (!preview) return;
        if (value) {
            preview.href = value;
            preview.textContent = value;
            preview.classList.remove('hidden');
        } else {
            preview.href = '#';
            preview.textContent = 'Abrir grupo';
            preview.classList.add('hidden');
        }
    };

    const linkGrupoInput = document.getElementById('link_grupo');
    if (linkGrupoInput) {
        linkGrupoInput.addEventListener('blur', () => {
            const normalized = normalizeGroupLink(linkGrupoInput.value);
            linkGrupoInput.value = normalized;
            updateGroupLinkPreview(normalized);
        });
    }

    const normalizeLogoUrl = (value) => {
        const trimmed = value ? String(value).trim() : '';
        if (!trimmed) return '';
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        return `https://${trimmed}`;
    };

    const setLogoPreview = (url, placeholderText) => {
        const img = document.getElementById('logo_preview');
        const placeholder = document.getElementById('logo_preview_placeholder');
        if (!img || !placeholder) return;
        if (url) {
            img.src = url;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        } else {
            img.src = '';
            img.classList.add('hidden');
            placeholder.textContent = placeholderText || 'Logo';
            placeholder.classList.remove('hidden');
        }
    };

    const logoUrlInput = document.getElementById('logo_url');
    if (logoUrlInput) {
        logoUrlInput.addEventListener('blur', () => {
            const normalized = normalizeLogoUrl(logoUrlInput.value);
            logoUrlInput.value = normalized;
            setLogoPreview(normalized, 'Logo');
        });
    }

    const logoFileInput = document.getElementById('logo_file');
    if (logoFileInput) {
        logoFileInput.addEventListener('change', () => {
            const file = logoFileInput.files && logoFileInput.files[0] ? logoFileInput.files[0] : null;
            if (!file) return;
            const url = URL.createObjectURL(file);
            setLogoPreview(url, 'Logo');
        });
    }

    function addMensalidadeRow(data) {
        if (!mensalidadesContainer) return;

        const row = document.createElement('div');
        row.className = 'mensalidade-row flex items-center gap-2 mb-2';

        const descInput = document.createElement('input');
        descInput.type = 'text';
        descInput.placeholder = 'Ex: Tráfego Pago';
        descInput.className = 'flex-[2] rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 sm:text-sm py-2 px-3';
        
        const valorInput = document.createElement('input');
        valorInput.type = 'number';
        valorInput.step = '0.01';
        valorInput.placeholder = '0,00';
        valorInput.className = 'flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 sm:text-sm py-2 px-3 mensalidade-valor';

        const diaSelect = document.createElement('select');
        diaSelect.className = 'flex-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary/20 sm:text-sm py-2 px-3 mensalidade-dia';

        const dias = ['05','10','15','20','25','30'];
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.disabled = true;
        placeholder.selected = true;
        placeholder.textContent = 'Vencimento';
        diaSelect.appendChild(placeholder);
        dias.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d;
            opt.textContent = 'Dia ' + d;
            diaSelect.appendChild(opt);
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i class="fas fa-trash"></i>';
        removeBtn.className = 'text-red-500 hover:text-red-700 p-2 transition-colors';
        removeBtn.onclick = () => {
            mensalidadesContainer.removeChild(row);
        };

        if (data) {
            if (data.descricao) descInput.value = data.descricao;
            if (data.valor) valorInput.value = data.valor;
            if (data.dia_vencimento) diaSelect.value = String(data.dia_vencimento).padStart(2, '0');
        }
        
        // Adicionar classe para identificação
        descInput.classList.add('mensalidade-descricao');

        row.appendChild(descInput);
        row.appendChild(valorInput);
        row.appendChild(diaSelect);
        row.appendChild(removeBtn);
        mensalidadesContainer.appendChild(row);
    }

    function getMensalidadesFromForm() {
        if (!mensalidadesContainer) return [];
        const rows = mensalidadesContainer.querySelectorAll('.mensalidade-row');
        const itens = [];

        rows.forEach(row => {
            const descEl = row.querySelector('.mensalidade-descricao');
            const valorEl = row.querySelector('.mensalidade-valor');
            const diaEl = row.querySelector('.mensalidade-dia');

            const descricao = descEl ? descEl.value.trim() : '';
            const valor = valorEl ? parseFloat((valorEl.value || '').toString().replace(',', '.')) || 0 : 0;
            const dia_vencimento = diaEl ? parseInt(diaEl.value) || null : null;

            if (!descricao && !valor && !dia_vencimento) return;

            itens.push({ descricao, valor, dia_vencimento });
        });

        return itens;
    }

    function carregarMensalidadesNoFormulario(cliente) {
        if (!mensalidadesContainer) return;
        mensalidadesContainer.innerHTML = '';

        let itens = Array.isArray(cliente.mensalidades) ? cliente.mensalidades : [];

        if (!itens.length) {
            if (cliente.valor_mensalidade) {
                itens = [{
                    descricao: 'Mensalidade',
                    valor: cliente.valor_mensalidade,
                    dia_vencimento: cliente.dia_vencimento
                }];
            } else {
                itens = [{}];
            }
        }

        itens.forEach(item => addMensalidadeRow(item));
    }

    window.addMensalidadeRow = function () {
        addMensalidadeRow();
    };

    async function loadInternalOwnersForSelects() {
        const gestorSelect = document.getElementById('gestor_trafego_email');
        const socialSelect = document.getElementById('social_media_email');
        if (!gestorSelect || !socialSelect || !window.supabaseClient) return;

        const buildOption = (value, label, email) => {
            const opt = document.createElement('option');
            opt.value = value;
            opt.textContent = label;
            if (email) opt.dataset.email = email;
            return opt;
        };

        const hasPermission = (colab, perm) => Array.isArray(colab?.permissoes) && colab.permissoes.includes(perm);

        const fetchColaboradores = async (area) => {
            const { data, error } = await window.supabaseClient
                .from('colaboradores')
                .select('id, nome, email, perfil_acesso, permissoes, departamento, ativo')
                .eq('ativo', true)
                .order('nome', { ascending: true });

            if (error) {
                throw error;
            }

            const list = Array.isArray(data) ? data : [];
            if (area === 'Tráfego Pago') {
                return list.filter(c => hasPermission(c, 'trafego_pago'));
            }
            if (area === 'Social Media') {
                return list.filter(c => hasPermission(c, 'social_media'));
            }
            return list;
        };

        try {
            gestorSelect.innerHTML = '';
            socialSelect.innerHTML = '';

            gestorSelect.appendChild(buildOption('', 'Selecione um gestor...'));
            socialSelect.appendChild(buildOption('', 'Selecione um social media...'));

            const gestores = await fetchColaboradores('Tráfego Pago');
            const socials = await fetchColaboradores('Social Media');

            if (gestores.length === 0) {
                gestorSelect.appendChild(buildOption('', 'Nenhum gestor disponível'));
            } else {
                gestores.forEach(c => {
                    gestorSelect.appendChild(buildOption(c.id, c.nome || c.email, c.email));
                });
            }

            if (socials.length === 0) {
                socialSelect.appendChild(buildOption('', 'Nenhum social media disponível'));
            } else {
                socials.forEach(c => {
                    socialSelect.appendChild(buildOption(c.id, c.nome || c.email, c.email));
                });
            }

        } catch (err) {
            console.error('Erro ao carregar responsáveis internos:', err);
            gestorSelect.innerHTML = '<option value="">Erro ao carregar</option>';
            socialSelect.innerHTML = '<option value="">Erro ao carregar</option>';
        }
    }

    // --- CARREGAR TIMES PARA O SELECT ---
    async function loadTimesForSelect() {
        const select = document.getElementById('time_id');
        if (!select || !window.supabaseClient) return;

        try {
            const { data, error } = await window.supabaseClient
                .from('times')
                .select('id, nome')
                .order('nome');

            if (error) throw error;

            select.innerHTML = '<option value="">Selecione um Time...</option>';
            data.forEach(time => {
                const option = document.createElement('option');
                option.value = time.id;
                option.textContent = time.nome;
                select.appendChild(option);
            });

        } catch (err) {
            console.error('Erro ao carregar times:', err);
            select.innerHTML = '<option value="">Erro ao carregar times</option>';
        }
    }

    // --- PERMISSÕES ---
    async function getMyPermissions() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return null;

        const isSuper = (window.SUPERADMIN_EMAILS || []).includes(user.email);
        if (isSuper) return { role: 'super_admin', times: [], email: user.email, colabId: null };

        let colab = null;
        const { data: colabByUserId } = await window.supabaseClient
            .from('colaboradores')
            .select('id, perfil_acesso, times_acesso, email')
            .eq('user_id', user.id)
            .maybeSingle();
        if (colabByUserId) {
            colab = colabByUserId;
        } else {
            const { data: colabByEmail } = await window.supabaseClient
                .from('colaboradores')
                .select('id, perfil_acesso, times_acesso, email')
                .eq('email', user.email)
                .maybeSingle();
            if (colabByEmail) colab = colabByEmail;
        }
        
        if (!colab) {
            const { data: profile } = await window.supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();
            
            if (profile && profile.role === 'super_admin') return { role: 'super_admin', times: [], email: user.email, colabId: null };
            
            return { role: 'unknown', times: [], email: user.email, colabId: null };
        }
        
        return { 
            role: colab.perfil_acesso, 
            times: colab.times_acesso || [],
            email: colab.email || user.email,
            colabId: colab.id
        };
    }

    // 1. Função para Carregar Clientes
    async function loadClientes() {
        if (!window.supabaseClient) {
            console.warn('Supabase não carregado, aguardando...');
            setTimeout(loadClientes, 500);
            return;
        }

        // Carregar times também
        loadTimesForSelect();
        loadInternalOwnersForSelects();

        try {
            const perms = await getMyPermissions();
            
            const createQuery = () => window.supabaseClient
                .from('clientes')
                .select('*, times!clientes_time_id_fkey(nome)')
                .order('created_at', { ascending: false });

            let clientes = [];

            // Aplica filtro por time ou por responsável se não for admin
            if (perms && perms.role !== 'super_admin' && perms.role !== 'admin') {
                if (perms.times && perms.times.length > 0) {
                    const { data, error } = await createQuery().in('time_id', perms.times);
                    if (error) throw error;
                    clientes = data || [];
                } else if (perms.email || perms.colabId) {
                    const email = perms.email || '';
                    const colabId = perms.colabId || '';
                    const queries = [];

                    if (email) {
                        queries.push(createQuery().eq('gestor_trafego_email', email));
                        queries.push(createQuery().eq('social_media_email', email));
                    }
                    if (colabId) {
                        queries.push(createQuery().eq('responsavel_trafego_colaborador_id', colabId));
                        queries.push(createQuery().eq('responsavel_social_colaborador_id', colabId));
                    }

                    if (!queries.length) {
                        renderClientes([]);
                        return;
                    }

                    const results = await Promise.all(queries);
                    const errors = results.map(r => r.error).filter(Boolean);
                    if (errors.length) throw errors[0];

                    clientes = results.flatMap(r => r.data || []);
                } else {
                    renderClientes([]);
                    return;
                }
            } else {
                const { data, error } = await createQuery();
                if (error) throw error;
                clientes = data || [];
            }

            // Filtra clientes demo (is_demo=true) para área separada
            const clientesNormais = Array.isArray(clientes)
                ? clientes.filter(c => !c.is_demo)
                : [];
            const clientesDemo = Array.isArray(clientes)
                ? clientes.filter(c => c.is_demo)
                : [];

            // Exibe clientes normais na listagem principal
            renderClientes(clientesNormais);

            // Exibe área demo se houver clientes demo
            if (clientesDemo.length > 0) {
                renderDemoArea(clientesDemo);
            }

        } catch (error) {
            const message = error?.message || error?.error_description || JSON.stringify(error);
            console.error('Erro ao carregar clientes:', message, error);
            clientesTableBody.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <div class="flex flex-col items-center justify-center text-red-500">
                        <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                        <p>Erro ao carregar clientes.</p>
                        <p class="text-sm text-gray-400 mt-1">${message}</p>
                        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm">
                            Tentar Novamente
                        </button>
                    </div>
                </div>`;
        } finally {
            // Libera a tela
            if (window.showContent) window.showContent();
        }
    }

    const normalizePhoneToWaMe = (phone) => {
        const digits = String(phone || '').replace(/\D/g, '');
        if (!digits) return '';
        const hasCountry = digits.startsWith('55') && digits.length >= 12;
        const normalized = hasCountry ? digits : `55${digits}`;
        return `https://wa.me/${normalized}`;
    };

    const getInitials = (value) => {
        const text = String(value || '').trim();
        if (!text) return 'CL';
        const parts = text.split(' ').filter(Boolean);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    };

    const safeUrl = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '';
        return /^https?:\/\//i.test(raw) ? raw : '';
    };

    // 2. Renderizar Cards
    function renderClientes(clientes) {
            // ...existing code...

            // Função para exibir área de clientes demo
            function renderDemoArea(clientesDemo) {
                let demoHtml = `<div class="mt-8"><h2 class="text-lg font-bold text-gray-700 mb-2">Clientes Demo</h2><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
                clientesDemo.forEach(cliente => {
                    const nomeExibicao = cliente.nome_fantasia || cliente.nome_empresa;
                    demoHtml += `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-4"><div class="font-semibold text-yellow-800">${nomeExibicao}</div></div>`;
                });
                demoHtml += `</div></div>`;
                // Adiciona ao final da listagem principal
                clientesTableBody.insertAdjacentHTML('afterend', demoHtml);
            }
        clientesTableBody.innerHTML = '';

        if (!clientes || clientes.length === 0) {
            // Deixa em branco se não houver clientes
            return;
        }

        const clientMap = {};
        clientes.forEach(cliente => {
            clientMap[String(cliente.id)] = cliente;
            const servicosBadges = (cliente.servicos || [])
                .map(s => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-1">${s}</span>`)
                .join('');

            // Nome Fantasia ou Razão Social
            const nomeExibicao = cliente.nome_fantasia || cliente.nome_empresa;
            const responsavel = cliente.responsavel_nome || '-';
            const phone = cliente.telefone || '';
            const whatsapp = cliente.responsavel_whatsapp || phone;
            const waLink = normalizePhoneToWaMe(whatsapp);
            const grupoLink = safeUrl(normalizeGroupLink(cliente.link_grupo || ''));
            const grupoRegistro = cliente.registro_grupo || '-';
            const logoUrl = cliente.logo_url || '';
            const initials = getInitials(nomeExibicao);
            const whatsappLabel = whatsapp || 'Não informado';
            const grupoLabel = grupoLink ? 'Abrir grupo' : 'Não informado';

            const card = document.createElement('div');
            card.className = 'bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition cursor-pointer';
            card.dataset.clientId = cliente.id;
            card.innerHTML = `
                <div class="flex gap-3 items-start">
                    <div class="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        ${logoUrl ? `<img src="${logoUrl}" alt="Logo ${nomeExibicao}" class="w-full h-full object-cover">` : `<span class="text-sm font-semibold text-gray-500">${initials}</span>`}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="font-semibold text-gray-800 truncate">${nomeExibicao}</div>
                        <div class="text-sm text-gray-500 truncate">Responsável: ${responsavel}</div>
                        ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" class="text-sm text-green-600 hover:underline inline-flex items-center gap-2 mt-1 no-card-click" onclick="event.stopPropagation()"><i class="fab fa-whatsapp"></i> ${whatsappLabel}</a>` : `<div class="text-sm text-gray-400 inline-flex items-center gap-2 mt-1"><i class="fab fa-whatsapp"></i> ${whatsappLabel}</div>`}
                        ${grupoLink ? `<a href="${grupoLink}" target="_blank" rel="noopener" class="text-sm text-[var(--color-primary)] hover:underline inline-flex items-center gap-2 mt-1 no-card-click" onclick="event.stopPropagation()"><i class="fas fa-link"></i> ${grupoLabel}</a>` : `<div class="text-sm text-gray-400 inline-flex items-center gap-2 mt-1"><i class="fas fa-link"></i> ${grupoLabel}</div>`}
                    </div>
                </div>
                ${servicosBadges ? `<div class="mt-3 flex flex-wrap gap-2">${servicosBadges}</div>` : ''}
            `;
            card.addEventListener('click', (event) => {
                if (event.target.closest('a') || event.target.closest('button') || event.target.closest('.no-card-click')) return;
                openClientViewModal(cliente.id);
            });
            clientesTableBody.appendChild(card);
        });
        window.clientCardsMap = clientMap;
    }

    const buildLinkItem = (label, url) => {
        if (!url) return '';
        const safeLink = safeUrl(url);
        if (!safeLink) return '';
        return `
            <div class="flex items-center gap-2">
                <span class="text-gray-500">${label}:</span>
                <a href="${safeLink}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline break-all">${safeLink}</a>
            </div>
        `;
    };

    const normalizeEmailValue = (value) => String(value || '').trim().toLowerCase();
    const isDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const logDev = (...args) => {
        if (isDev) console.log(...args);
    };
    let cachedTenantId = null;
    const resolveCurrentTenantId = async () => {
        if (cachedTenantId !== null) return cachedTenantId;
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return null;

        const metaTenant = user?.user_metadata?.tenant_id
            || user?.app_metadata?.tenant_id
            || user?.user_metadata?.cliente_id
            || user?.app_metadata?.cliente_id;
        if (metaTenant && /^\d+$/.test(String(metaTenant))) {
            cachedTenantId = Number(metaTenant);
            return cachedTenantId;
        }

        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .maybeSingle();
        cachedTenantId = profile?.tenant_id ? Number(profile.tenant_id) : null;
        return cachedTenantId;
    };

    const updateClientAccessUI = ({ liberado, disabled, note, loading }) => {
        const statusEl = document.getElementById('client-view-access-status');
        const buttonEl = document.getElementById('client-view-access-btn');
        const noteEl = document.getElementById('client-view-access-note');
        if (statusEl) statusEl.textContent = `Acesso: ${liberado ? 'Liberado' : 'Não liberado'}`;
        if (noteEl) noteEl.textContent = note || '';
        if (buttonEl) {
            const buttonLabel = liberado ? 'Revogar acesso' : 'Liberar acesso ao painel';
            const iconClass = liberado ? 'fas fa-ban' : 'fas fa-key';
            buttonEl.innerHTML = `<i class="${iconClass}"></i> ${loading ? 'Processando...' : buttonLabel}`;
            buttonEl.disabled = !!disabled || !!loading;
            if (buttonEl.disabled) {
                buttonEl.classList.add('opacity-75', 'cursor-not-allowed');
            } else {
                buttonEl.classList.remove('opacity-75', 'cursor-not-allowed');
            }
        }
    };

    const fetchClientInviteStatus = async (cliente) => {
        const emailNormalizado = normalizeEmailValue(cliente.email_contato || cliente.responsavel_email || cliente.email || '');
        let query = window.supabaseClient
            .from('client_invites')
            .select('id,email,client_id')
            .limit(1);
        if (emailNormalizado) {
            query = query.or(`client_id.eq.${cliente.id},email.ilike.${emailNormalizado}`);
        } else {
            query = query.eq('client_id', cliente.id);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data && data[0]) || null;
    };

    const setupClientAccessControls = async (cliente) => {
        const buttonEl = document.getElementById('client-view-access-btn');
        if (!buttonEl) return;
        const emailNormalizado = normalizeEmailValue(cliente.email_contato || cliente.responsavel_email || cliente.email || '');
        if (!emailNormalizado) {
            updateClientAccessUI({
                liberado: false,
                disabled: true,
                note: 'Cadastre o e-mail do responsável antes.',
                loading: false
            });
            buttonEl.onclick = () => {
                alert('Cadastre o e-mail do responsável antes.');
            };
            return;
        }

        updateClientAccessUI({ liberado: false, disabled: true, note: '', loading: true });
        let invite = null;
        try {
            invite = await fetchClientInviteStatus(cliente);
        } catch (error) {
            console.error('Erro ao buscar acesso do cliente:', error);
            alert('Erro ao buscar acesso do cliente.');
        }
        let liberado = !!invite;
        updateClientAccessUI({ liberado, disabled: false, note: '', loading: false });

        buttonEl.onclick = async () => {
            updateClientAccessUI({ liberado, disabled: true, note: '', loading: true });
            try {
                if (liberado) {
                    const { error } = await window.supabaseClient
                        .from('client_invites')
                        .delete()
                        .eq('client_id', cliente.id);
                    if (error) throw error;
                    liberado = false;
                    alert('Acesso revogado com sucesso.');
                } else {
                    const { error } = await window.supabaseClient
                        .from('client_invites')
                        .upsert(
                            { email: emailNormalizado, client_id: cliente.id },
                            { onConflict: 'email' }
                        );
                    if (error) throw error;
                    liberado = true;
                    alert('Acesso liberado com sucesso.');
                }
            } catch (error) {
                console.error('Erro ao atualizar acesso do cliente:', error);
                alert('Erro ao atualizar acesso do cliente.');
            } finally {
                updateClientAccessUI({ liberado, disabled: false, note: '', loading: false });
            }
        };
    };

    const renderClientView = (cliente) => {
        if (!cliente) return;
        const nomeExibicao = cliente.nome_fantasia || cliente.nome_empresa || 'Cliente';
        const logoUrl = cliente.logo_url || '';
        const initials = getInitials(nomeExibicao);
        const logoImg = document.getElementById('client-view-logo');
        const logoPlaceholder = document.getElementById('client-view-logo-placeholder');
        if (logoImg && logoPlaceholder) {
            if (logoUrl) {
                logoImg.src = logoUrl;
                logoImg.classList.remove('hidden');
                logoPlaceholder.classList.add('hidden');
            } else {
                logoImg.src = '';
                logoImg.classList.add('hidden');
                logoPlaceholder.textContent = initials;
                logoPlaceholder.classList.remove('hidden');
            }
        }

        const subtitle = cliente.times && cliente.times.nome ? cliente.times.nome : '';
        const responsavel = cliente.responsavel_nome || '-';
        const telefone = cliente.telefone || '-';
        const whatsapp = cliente.responsavel_whatsapp || cliente.telefone || '';
        const waLink = normalizePhoneToWaMe(whatsapp);
        const grupoLink = safeUrl(normalizeGroupLink(cliente.link_grupo || ''));
        const grupoRegistro = cliente.registro_grupo || 'Não informado';

        const titleEl = document.getElementById('client-view-title');
        const subtitleEl = document.getElementById('client-view-subtitle');
        if (titleEl) titleEl.textContent = nomeExibicao;
        if (subtitleEl) subtitleEl.textContent = subtitle;

        const responsavelEl = document.getElementById('client-view-responsavel');
        if (responsavelEl) responsavelEl.textContent = `${responsavel} • ${telefone}`;

        const emailEmpresaEl = document.getElementById('client-view-email-empresa');
        const emailResponsavelEl = document.getElementById('client-view-email-responsavel');
        const emailEmpresa = cliente.email_contato || cliente.email || '';
        const emailResponsavel = cliente.responsavel_email || cliente.email_responsavel || '';
        if (emailEmpresaEl) emailEmpresaEl.textContent = emailEmpresa || 'Sem e-mail cadastrado';
        if (emailResponsavelEl) emailResponsavelEl.textContent = emailResponsavel || 'Sem e-mail cadastrado';

        const whatsappEl = document.getElementById('client-view-whatsapp');
        if (whatsappEl) {
            const textSpan = whatsappEl.querySelector('span');
            if (waLink) {
                whatsappEl.href = waLink;
                whatsappEl.classList.remove('hidden');
                if (textSpan) textSpan.textContent = whatsapp || telefone || 'WhatsApp';
            } else {
                whatsappEl.href = '#';
                whatsappEl.classList.add('hidden');
                if (textSpan) textSpan.textContent = '';
            }
        }

        const grupoRegistroEl = document.getElementById('client-view-grupo-registro');
        if (grupoRegistroEl) grupoRegistroEl.textContent = grupoRegistro;

        const grupoLinkEl = document.getElementById('client-view-grupo-link');
        if (grupoLinkEl) {
            const textSpan = grupoLinkEl.querySelector('span');
            if (grupoLink) {
                grupoLinkEl.href = grupoLink;
                grupoLinkEl.classList.remove('hidden');
                if (textSpan) textSpan.textContent = grupoLink;
            } else {
                grupoLinkEl.href = '#';
                grupoLinkEl.classList.add('hidden');
                if (textSpan) textSpan.textContent = '';
            }
        }

        const servicosContainer = document.getElementById('client-view-servicos');
        if (servicosContainer) {
            servicosContainer.innerHTML = '';
            const servicos = Array.isArray(cliente.servicos) ? cliente.servicos : [];
            if (servicos.length) {
                servicos.forEach(servico => {
                    const badge = document.createElement('span');
                    badge.className = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800';
                    badge.textContent = servico;
                    servicosContainer.appendChild(badge);
                });
            } else {
                servicosContainer.innerHTML = '<span class="text-sm text-gray-500">Nenhum serviço informado</span>';
            }
        }

        const mensalidadeEl = document.getElementById('client-view-mensalidade');
        if (mensalidadeEl) {
            const valor = parseFloat(cliente.valor_mensalidade || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
            mensalidadeEl.textContent = `R$ ${valor}`;
        }

        const vencimentoEl = document.getElementById('client-view-vencimento');
        if (vencimentoEl) vencimentoEl.textContent = cliente.dia_vencimento ? `Vencimento: dia ${cliente.dia_vencimento}` : 'Vencimento não informado';

        const statusEl = document.getElementById('client-view-status');
        if (statusEl) statusEl.textContent = cliente.status || 'Ativo';

        const linksContainer = document.getElementById('client-view-links');
        if (linksContainer) {
            const links = [
                buildLinkItem('Briefing', cliente.link_briefing),
                buildLinkItem('Site', cliente.link_site),
                buildLinkItem('Landing Page', cliente.link_lp),
                buildLinkItem('Drive', cliente.link_drive),
                buildLinkItem('Persona', cliente.link_persona),
                buildLinkItem('Grupo', cliente.link_grupo)
            ].filter(Boolean);
            linksContainer.innerHTML = links.length ? links.join('') : '<span class="text-gray-500">Nenhum link informado</span>';
        }

        const editBtn = document.getElementById('client-view-edit-btn');
        if (editBtn) {
            editBtn.onclick = () => {
                closeClientViewModal();
                editCliente(cliente.id);
            };
        }

        const deleteBtn = document.getElementById('client-view-delete-btn');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                closeClientViewModal();
                deleteCliente(cliente.id);
            };
        }

        const historyBtn = document.getElementById('client-view-history-btn');
        if (historyBtn) {
            historyBtn.onclick = () => {
                closeClientViewModal();
                openClientWorklogHistory(cliente.id, nomeExibicao);
            };
        }

        const integrationsBtn = document.getElementById('client-view-integrations-btn');
        if (integrationsBtn) {
            integrationsBtn.onclick = () => {
                closeClientViewModal();
                abrirIntegracoes(cliente.id);
            };
        }

        setupClientAccessControls(cliente);
    };

    const refreshClientById = async (clientId) => {
        const { data, error } = await window.supabaseClient
            .from('clientes')
            .select('*')
            .eq('id', clientId)
            .single();
        if (error) throw error;
        if (window.clientCardsMap) {
            window.clientCardsMap[String(clientId)] = data;
        }
        const modal = document.getElementById('client-view-modal');
        if (modal && !modal.classList.contains('hidden')) {
            renderClientView(data);
            logDev('cliente atualizado usado no modal', data);
        }
        return data;
    };

    window.openClientViewModal = async (clientId) => {
        const modal = document.getElementById('client-view-modal');
        if (!modal) return;
        let cliente = window.clientCardsMap ? window.clientCardsMap[String(clientId)] : null;
        if (!cliente) {
            try {
                const { data, error } = await window.supabaseClient
                    .from('clientes')
                    .select('*')
                    .eq('id', clientId)
                    .single();
                if (error) throw error;
                cliente = data;
            } catch (err) {
                console.error('Erro ao carregar cliente:', err);
                alert('Erro ao carregar detalhes do cliente.');
                return;
            }
        }
        renderClientView(cliente);
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    window.closeClientViewModal = function() {
        const modal = document.getElementById('client-view-modal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    };

    const uploadClientLogoFile = async (clienteId, file) => {
        if (!file) return null;
        const bucket = 'client-logos';
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `logos/${clienteId}-${Date.now()}-${safeName}`;
        const { error } = await window.supabaseClient.storage
            .from(bucket)
            .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data } = window.supabaseClient.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    };

    // 3. Salvar Cliente (Criar ou Editar)
    if (formCliente) {
        formCliente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSave = document.getElementById('btn-save-cliente');
            const originalText = btnSave.innerText;
            const clienteId = document.getElementById('cliente_id').value; // ID oculto

            try {
                btnSave.innerText = 'Salvando...';
                btnSave.disabled = true;

                // Coletar Checkboxes
            const getCheckedValues = (name) => {
                return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);
            };

            // Coletar Mensalidades
            const mensalidades = getMensalidadesFromForm();
            
            // Calcular valor total e definir dia de vencimento principal (baseado no primeiro item)
            let valorTotal = 0;
            let diaVencimentoPrincipal = null;

            if (mensalidades.length > 0) {
                valorTotal = mensalidades.reduce((acc, curr) => acc + curr.valor, 0);
                diaVencimentoPrincipal = mensalidades[0].dia_vencimento;
            }

            const gestorSelect = document.getElementById('gestor_trafego_email');
            const socialSelect = document.getElementById('social_media_email');
            const gestorOption = gestorSelect && gestorSelect.selectedOptions ? gestorSelect.selectedOptions[0] : null;
            const socialOption = socialSelect && socialSelect.selectedOptions ? socialSelect.selectedOptions[0] : null;
            const gestorColaboradorId = gestorSelect && gestorSelect.value ? gestorSelect.value : null;
            const socialColaboradorId = socialSelect && socialSelect.value ? socialSelect.value : null;
            const gestorEmail = gestorOption && gestorOption.dataset ? gestorOption.dataset.email || null : null;
            const socialEmail = socialOption && socialOption.dataset ? socialOption.dataset.email || null : null;
            const logoUrlInputValue = normalizeLogoUrl(document.getElementById('logo_url').value);
            const logoFileInput = document.getElementById('logo_file');
            const logoFile = logoFileInput && logoFileInput.files && logoFileInput.files[0] ? logoFileInput.files[0] : null;
            const registroGrupo = document.getElementById('registro_grupo').value;
            const emailEmpresaValue = normalizeEmailValue(document.getElementById('email_contato').value);

            const clienteData = {
                nome_empresa: document.getElementById('nome_empresa').value,
                nome_fantasia: document.getElementById('nome_fantasia').value,
                time_id: document.getElementById('time_id').value || null,
                telefone: document.getElementById('telefone').value,
                endereco: document.getElementById('endereco').value,
                email_contato: emailEmpresaValue || null,
                responsavel_nome: document.getElementById('responsavel_nome').value,
                responsavel_whatsapp: document.getElementById('responsavel_whatsapp').value,
                responsavel_nome_2: document.getElementById('responsavel_nome_2').value,
                responsavel_whatsapp_2: document.getElementById('responsavel_whatsapp_2').value,
                
                // Campos de compatibilidade + JSONB
                valor_mensalidade: valorTotal,
                dia_vencimento: diaVencimentoPrincipal,
                mensalidades: mensalidades, // Salva o array completo no JSONB

                // Links Úteis
                link_briefing: document.getElementById('link_briefing').value,
                link_site: document.getElementById('link_site').value,
                link_lp: document.getElementById('link_lp').value,
                link_drive: document.getElementById('link_drive').value,
                link_persona: document.getElementById('link_persona').value,
                link_grupo: normalizeGroupLink(document.getElementById('link_grupo').value),
                registro_grupo: registroGrupo || null,
                logo_url: logoUrlInputValue || null,
                
                servicos: getCheckedValues('servicos'),
                responsavel_trafego_colaborador_id: gestorColaboradorId,
                responsavel_social_colaborador_id: socialColaboradorId,
                gestor_trafego_email: gestorEmail,
                social_media_email: socialEmail,
                status: document.getElementById('status_cliente').value
            };

                const logSave = (...args) => console.log('[Clientes Save]', ...args);

                const getErrorMessage = (err) => String(err?.message || err?.error || err?.details || err || '');
                const getErrorPayload = (err) => {
                    try { return JSON.stringify(err || {}); } catch (e) { return ''; }
                };
                const hasMissingColumn = (err, column) => {
                    const text = `${getErrorMessage(err)} ${getErrorPayload(err)}`.toLowerCase();
                    return text.includes(`'${column}'`) || text.includes(`"${column}"`) || text.includes(column);
                };
                const getMissingColumnsCache = () => {
                    try {
                        const raw = localStorage.getItem('clientes_missing_columns') || '[]';
                        const list = JSON.parse(raw);
                        return new Set(Array.isArray(list) ? list : []);
                    } catch (e) {
                        return new Set();
                    }
                };
                const setMissingColumnsCache = (set) => {
                    try {
                        localStorage.setItem('clientes_missing_columns', JSON.stringify(Array.from(set)));
                    } catch (e) {}
                };
                const stripMissingColumns = (data, err) => {
                    const next = { ...data };
                    if (hasMissingColumn(err, 'logo_url')) delete next.logo_url;
                    if (hasMissingColumn(err, 'registro_grupo')) delete next.registro_grupo;
                    if (hasMissingColumn(err, 'tenant_id')) delete next.tenant_id;
                    return next;
                };
                const missingColumns = getMissingColumnsCache();
                if (missingColumns.has('logo_url')) delete clienteData.logo_url;
                if (missingColumns.has('registro_grupo')) delete clienteData.registro_grupo;
                if (missingColumns.has('tenant_id')) delete clienteData.tenant_id;

                let error;
                let allowLogoColumn = true;
                let savedId = null;

                if (clienteId) {
                    if (logoFile) {
                        try {
                            const uploadedUrl = await uploadClientLogoFile(clienteId, logoFile);
                            if (uploadedUrl) clienteData.logo_url = uploadedUrl;
                        } catch (uploadError) {
                            console.warn('Erro ao subir logo:', uploadError);
                            if (!clienteData.logo_url) clienteData.logo_url = null;
                        }
                    }
                    let updatePayload = { ...clienteData };
                    logDev('payload enviado no update', updatePayload);
                    logSave('endpoint', 'supabase: clientes update');
                    logSave('payload', updatePayload);
                    let { data: updateData, error: updateError, status: updateStatus, statusText: updateStatusText } = await window.supabaseClient
                        .from('clientes')
                        .update(updatePayload)
                        .eq('id', clienteId)
                        .select()
                        .single();
                    logSave('response', { status: updateStatus, statusText: updateStatusText, data: updateData, error: updateError });
                    if (updateError && (hasMissingColumn(updateError, 'logo_url') || hasMissingColumn(updateError, 'registro_grupo') || hasMissingColumn(updateError, 'tenant_id'))) {
                        updatePayload = stripMissingColumns(updatePayload, updateError);
                        if (hasMissingColumn(updateError, 'logo_url')) missingColumns.add('logo_url');
                        if (hasMissingColumn(updateError, 'registro_grupo')) missingColumns.add('registro_grupo');
                        if (hasMissingColumn(updateError, 'tenant_id')) missingColumns.add('tenant_id');
                        setMissingColumnsCache(missingColumns);
                        if (!('logo_url' in updatePayload)) allowLogoColumn = false;
                        logSave('endpoint', 'supabase: clientes update (retry)');
                        logSave('payload', updatePayload);
                        const retry = await window.supabaseClient
                            .from('clientes')
                            .update(updatePayload)
                            .eq('id', clienteId)
                            .select()
                            .single();
                        updateData = retry.data;
                        updateError = retry.error;
                        logSave('response', { status: retry.status, statusText: retry.statusText, data: updateData, error: updateError });
                    }
                    error = updateError;
                    logDev('retorno do supabase (update)', { data: updateData, error: updateError });
                    if (!error && !updateData) {
                        throw new Error('Nenhuma linha atualizada.');
                    }
                    savedId = updateData?.id || clienteId;
                    if (!error) {
                        try {
                            await gerarCobrancasMensalidades(
                                { 
                                    nome_empresa: clienteData.nome_empresa,
                                    nome_fantasia: clienteData.nome_fantasia 
                                },
                                mensalidades,
                                { replaceExisting: true }
                            );
                        } catch (cobrancaError) {
                            console.warn('Pós-save: erro ao gerar cobranças/mensalidades:', cobrancaError);
                        }
                    }
                } else {
                    const resolvedTenantId = await resolveCurrentTenantId();
                    if (resolvedTenantId) clienteData.tenant_id = resolvedTenantId;
                    if (clienteData.is_demo === undefined) clienteData.is_demo = false;
                    let insertPayload = { ...clienteData };
                    logSave('endpoint', 'supabase: clientes insert');
                    logSave('payload', insertPayload);
                    let { data: insertData, error: insertError, status: insertStatus, statusText: insertStatusText } = await window.supabaseClient
                        .from('clientes')
                        .insert([insertPayload])
                        .select()
                        .single();
                    logSave('response', { status: insertStatus, statusText: insertStatusText, data: insertData, error: insertError });
                    if (insertError && (hasMissingColumn(insertError, 'logo_url') || hasMissingColumn(insertError, 'registro_grupo') || hasMissingColumn(insertError, 'tenant_id'))) {
                        insertPayload = stripMissingColumns(insertPayload, insertError);
                        if (hasMissingColumn(insertError, 'logo_url')) missingColumns.add('logo_url');
                        if (hasMissingColumn(insertError, 'registro_grupo')) missingColumns.add('registro_grupo');
                        if (hasMissingColumn(insertError, 'tenant_id')) missingColumns.add('tenant_id');
                        setMissingColumnsCache(missingColumns);
                        if (!('logo_url' in insertPayload)) allowLogoColumn = false;
                        logSave('endpoint', 'supabase: clientes insert (retry)');
                        logSave('payload', insertPayload);
                        const retry = await window.supabaseClient
                            .from('clientes')
                            .insert([insertPayload])
                            .select()
                            .single();
                        insertData = retry.data;
                        insertError = retry.error;
                        logSave('response', { status: retry.status, statusText: retry.statusText, data: insertData, error: insertError });
                    }
                    error = insertError;
                    logDev('retorno do supabase (insert)', { data: insertData, error: insertError });
                    savedId = insertData?.id || null;
                    if (!error && !insertData) {
                        throw new Error('Nenhuma linha inserida.');
                    }
                    if (!error && insertData && logoFile && allowLogoColumn) {
                        try {
                            const uploadedUrl = await uploadClientLogoFile(insertData.id, logoFile);
                            if (uploadedUrl) {
                                const { error: logoUpdateError } = await window.supabaseClient
                                    .from('clientes')
                                    .update({ logo_url: uploadedUrl })
                                    .eq('id', insertData.id);
                                if (logoUpdateError) console.warn('Erro ao salvar logo no cliente:', logoUpdateError);
                            }
                        } catch (uploadError) {
                            console.warn('Erro ao subir logo:', uploadError);
                        }
                    }
                    if (!error && insertData && clienteData.status === 'Ativo') {
                        try {
                            await gerarCobrancasMensalidades(
                                { 
                                    nome_empresa: clienteData.nome_empresa,
                                    nome_fantasia: clienteData.nome_fantasia 
                                },
                                mensalidades,
                                { replaceExisting: false }
                            );
                        } catch (cobrancaError) {
                            console.warn('Pós-save: erro ao gerar cobranças/mensalidades:', cobrancaError);
                        }
                    }
                }

                if (error) throw error;
                if (!savedId && !clienteId) throw new Error('Save retornou sem id');

                const refreshedClientId = savedId || clienteId;

                alert(clienteId ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
                
                // Volta para lista
                const lista = document.getElementById('lista-clientes-container');
                const formContainer = document.getElementById('form-cliente-container');
                if (lista && formContainer) {
                    lista.style.display = 'block';
                    formContainer.style.display = 'none';
                }
                
                try {
                    await refreshClientById(refreshedClientId);
                } catch (refreshError) {
                    console.warn('Erro ao recarregar cliente atualizado:', refreshError);
                }

                try {
                    loadClientes();
                } catch (loadError) {
                    console.warn('Erro ao recarregar lista de clientes:', loadError);
                }

            } catch (error) {
                console.error('Erro ao salvar:', error);
                const message = String(error?.message || error?.details || error?.hint || error?.error || 'Erro ao salvar cliente.').trim();
                alert(`Erro ao salvar cliente: ${message}`);
            } finally {
                btnSave.innerText = originalText;
                btnSave.disabled = false;
            }
        });
    }

    async function gerarCobrancasMensalidades(cliente, mensalidades, options = {}) {
        try {
            if (!mensalidades || mensalidades.length === 0) return;

            const hoje = new Date();
            let ano = hoje.getFullYear();
            let mes = hoje.getMonth() + 1;
            if (mes > 11) { mes = 0; ano++; }

            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) return;

            if (options.replaceExisting) {
                const hojeISO = hoje.toISOString().split('T')[0];
                await window.supabaseClient
                    .from('financeiro')
                    .delete()
                    .like('descricao', `Mensalidade - ${cliente.nome_empresa}%`)
                    .eq('tipo', 'entrada')
                    .eq('categoria', 'Mensalidade')
                    .gte('data_transacao', hojeISO);
            }

            const rows = mensalidades
                .filter(m => m && m.valor && m.dia_vencimento)
                .map(item => {
                    const dataCobranca = new Date(ano, mes, item.dia_vencimento);
                    const dataFormatada = dataCobranca.toISOString().split('T')[0];

                    const sufixo = item.descricao ? ` - ${item.descricao}` : '';
                    const nomeParaDescricao = cliente.nome_fantasia || cliente.nome_empresa;

                    return {
                        descricao: `Mensalidade - ${nomeParaDescricao}${sufixo}`,
                        valor: item.valor,
                        tipo: 'entrada',
                        categoria: 'Mensalidade',
                        status: 'a_vencer',
                        data_transacao: dataFormatada,
                        user_id: user.id
                    };
                });

            if (!rows.length) return;

            await window.supabaseClient.from('financeiro').insert(rows);
            console.log('Cobranças automáticas geradas para todas as mensalidades.');
        } catch (finError) {
            console.error('Erro ao gerar cobranças automáticas:', finError);
        }
    }

    // 4. Editar Cliente (Global)
    window.editCliente = async (id) => {
        try {
            // Buscar dados do cliente
            const { data: cliente, error } = await window.supabaseClient
                .from('clientes')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            // Abrir formulário
            const lista = document.getElementById('lista-clientes-container');
            const formContainer = document.getElementById('form-cliente-container');
            
            lista.style.display = 'none';
            formContainer.style.display = 'block';

            // Preencher campos
            document.getElementById('cliente_id').value = cliente.id;
            document.getElementById('nome_empresa').value = cliente.nome_empresa || '';
            document.getElementById('nome_fantasia').value = cliente.nome_fantasia || '';
            document.getElementById('time_id').value = cliente.time_id || '';
            document.getElementById('telefone').value = cliente.telefone || '';
            document.getElementById('endereco').value = cliente.endereco || '';
            document.getElementById('email_contato').value = cliente.email_contato || '';
            document.getElementById('responsavel_nome').value = cliente.responsavel_nome || '';
            document.getElementById('responsavel_whatsapp').value = cliente.responsavel_whatsapp || '';
            document.getElementById('responsavel_nome_2').value = cliente.responsavel_nome_2 || '';
            document.getElementById('responsavel_whatsapp_2').value = cliente.responsavel_whatsapp_2 || '';
            
            document.getElementById('link_briefing').value = cliente.link_briefing || '';
            document.getElementById('link_site').value = cliente.link_site || '';
            document.getElementById('link_lp').value = cliente.link_lp || '';
            document.getElementById('link_drive').value = cliente.link_drive || '';
            document.getElementById('link_persona').value = cliente.link_persona || '';
            document.getElementById('link_grupo').value = cliente.link_grupo || '';
            updateGroupLinkPreview(normalizeGroupLink(cliente.link_grupo || ''));
            document.getElementById('registro_grupo').value = cliente.registro_grupo || '';
            document.getElementById('logo_url').value = cliente.logo_url || '';
            setLogoPreview(normalizeLogoUrl(cliente.logo_url || ''), getInitials(cliente.nome_fantasia || cliente.nome_empresa || ''));
            
            await loadInternalOwnersForSelects();
            const gestorSelect = document.getElementById('gestor_trafego_email');
            const socialSelect = document.getElementById('social_media_email');
            const applyResponsavelSelect = (select, colaboradorId, emailFallback) => {
                if (!select) return;
                const idValue = colaboradorId ? String(colaboradorId) : '';
                if (idValue && Array.from(select.options).some(opt => opt.value === idValue)) {
                    select.value = idValue;
                    return;
                }
                if (emailFallback) {
                    const match = Array.from(select.options).find(opt => (opt.dataset && opt.dataset.email ? opt.dataset.email : '').toLowerCase() === String(emailFallback).toLowerCase());
                    if (match) {
                        select.value = match.value;
                        return;
                    }
                }
                select.value = '';
            };
            applyResponsavelSelect(gestorSelect, cliente.responsavel_trafego_colaborador_id, cliente.gestor_trafego_email);
            applyResponsavelSelect(socialSelect, cliente.responsavel_social_colaborador_id, cliente.social_media_email);
            document.getElementById('status_cliente').value = cliente.status || 'Ativo';

            // Checkboxes
            const setCheckedValues = (name, values) => {
                const checkboxes = document.querySelectorAll(`input[name="${name}"]`);
                checkboxes.forEach(cb => {
                    cb.checked = values.includes(cb.value);
                });
            };

            setCheckedValues('servicos', cliente.servicos || []);

            // Mensalidades
            carregarMensalidadesNoFormulario(cliente);

            await loadConnectionsForClient(cliente.id);
            await loadClienteHistorico(cliente.id);

        } catch (e) {
            console.error('Erro ao editar cliente:', e);
            alert('Erro ao carregar dados do cliente.');
        }
    }
    
    // Função Global Delete
    window.deleteCliente = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este cliente? Isso pode afetar dados vinculados.')) return;
        
        try {
            const { error } = await window.supabaseClient
                .from('clientes')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            loadClientes();
        } catch(e) {
            console.error(e);
            alert('Erro ao excluir cliente.');
        }
    }

    window.abrirIntegracoes = function(clienteId) {
        if (!clienteId) return;
        localStorage.setItem('current_client_id', String(clienteId));
        window.location.href = 'automacoes_integracoes.html';
    }

    // --- IMPORTAÇÃO CSV ---
    window.downloadCSVTemplate = function() {
        const headers = ['Nome Empresa', 'Nome Fantasia', 'Telefone Empresa', 'Email Empresa', 'Nome Responsável', 'WhatsApp Responsável'];
        const csvContent = headers.join(';') + '\n' + 
                           'Empresa Exemplo;Fantasia Exemplo;11999999999;contato@empresa.com;João Silva;11988888888';
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'modelo_importacao_clientes.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    window.importCSV = async function(input) {
        if (!input.files || !input.files[0]) return;
        
        const file = input.files[0];
        const reader = new FileReader();
        
        // Show loading state if possible
        const btn = input.nextElementSibling; // The label/button wrapper
        const originalContent = btn ? btn.innerHTML : '';
        if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';

        reader.onload = async function(e) {
            const text = e.target.result;
            const lines = text.split(/\r?\n/);
            const header = lines[0] || '';
            const separator = header.includes(';') ? ';' : ',';
            lines.shift();
            
            let successCount = 0;
            let errorCount = 0;

            // Fetch times for matching
            let timesMap = {};
            try {
                const { data: times } = await window.supabaseClient.from('times').select('id, nome');
                if (times) {
                    times.forEach(t => timesMap[t.nome.toLowerCase().trim()] = t.id);
                }
            } catch (err) { console.error('Error fetching times', err); }

            for (let line of lines) {
                if (!line.trim()) continue;
                
                const cols = line.split(separator);
                
                // Mapeamento: 0:NomeEmpresa, 1:NomeFantasia, 2:Tel, 3:Email, 4:Resp, 5:Whats, 6:Valor, 7:Dia, 8:Time
                const nomeEmpresa = cols[0]?.trim();
                const nomeFantasia = cols[1]?.trim();
                const telefoneEmpresa = cols[2]?.trim();
                const emailEmpresa = cols[3]?.trim();
                const nomeResponsavel = cols[4]?.trim();
                const whatsappResponsavel = cols[5]?.trim();
                const valorMensalidade = cols[6]?.trim().replace(',', '.');
                const diaVencimento = cols[7]?.trim();
                const nomeTime = cols[8]?.trim();

                if (!nomeEmpresa || !nomeResponsavel || !whatsappResponsavel) {
                    errorCount++;
                    continue;
                }

                // Match time
                let timeId = null;
                if (nomeTime && timesMap[nomeTime.toLowerCase()]) {
                    timeId = timesMap[nomeTime.toLowerCase()];
                } else if (Object.values(timesMap).length > 0) {
                     timeId = Object.values(timesMap)[0]; // Fallback to first time
                }

                // Construct data
                const valor = parseFloat(valorMensalidade) || 0;
                const dia = parseInt(diaVencimento) || 10;
                
                const mensalidades = [{
                    descricao: 'Mensalidade Padrão',
                    valor: valor,
                    dia_vencimento: dia
                }];

                const clienteData = {
                    nome_empresa: nomeEmpresa,
                    nome_fantasia: nomeFantasia || nomeEmpresa,
                    telefone: telefoneEmpresa,
                    email_contato: emailEmpresa,
                    responsavel_nome: nomeResponsavel,
                    responsavel_whatsapp: whatsappResponsavel,
                    status: 'Ativo',
                    time_id: timeId,
                    dia_vencimento: dia,
                    valor_mensalidade: valor,
                    mensalidades: mensalidades
                };

                try {
                    const { error } = await window.supabaseClient.from('clientes').insert(clienteData);
                    if (error) throw error;
                    successCount++;
                } catch (err) {
                    console.error('Error importing line', line, err);
                    errorCount++;
                }
            }
            
            if(btn) btn.innerHTML = originalContent;
            
            alert(`Importação concluída!\nSucesso: ${successCount}\nErros: ${errorCount}`);
            loadClientes();
            input.value = ''; 
        };
        
        reader.readAsText(file);
    };

    const getAuthHeaders = async () => {
        const { data } = await window.supabaseClient.auth.getSession();
        const token = data?.session?.access_token;
        if (!token) return { 'Content-Type': 'application/json' };
        return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    };

    let worklogHistoryClientId = null;
    let worklogHistoryClientName = null;
    let worklogCollaboratorsMap = null;

    const moduleLabels = {
        social_media: 'Social Media',
        traffic: 'Tráfego',
        automations: 'Automações'
    };

    const formatWorklogDateTime = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const formatWorklogDate = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('pt-BR');
    };

    const formatWorklogDuration = (seconds) => {
        const total = Number(seconds);
        if (!Number.isFinite(total) || total < 0) return '-';
        const hrs = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = Math.floor(total % 60);
        const pad = (val) => String(val).padStart(2, '0');
        return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    };

    const setClientWorklogText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    const ensureCollaboratorsMap = async () => {
        if (worklogCollaboratorsMap) return;
        try {
            const { data, error } = await window.supabaseClient
                .from('colaboradores')
                .select('id, nome, user_id, email')
                .eq('ativo', true);
            if (error) throw error;
            worklogCollaboratorsMap = {};
            (data || []).forEach(item => {
                if (item.user_id) worklogCollaboratorsMap[item.user_id] = item.nome || item.email || item.user_id;
                if (item.id && !worklogCollaboratorsMap[item.id]) worklogCollaboratorsMap[item.id] = item.nome || item.email || item.id;
            });
        } catch (err) {
            console.warn('Não foi possível carregar colaboradores:', err);
            worklogCollaboratorsMap = {};
        }
    };

    const resolveCollaboratorName = async (id) => {
        if (!id) return '-';
        await ensureCollaboratorsMap();
        return worklogCollaboratorsMap[id] || id;
    };

    window.openClientWorklogHistory = async function(clientId, clientName) {
        const modal = document.getElementById('client-worklog-history-modal');
        if (!modal) return;
        worklogHistoryClientId = clientId;
        worklogHistoryClientName = clientName || '';
        setClientWorklogText('client-worklog-history-name', worklogHistoryClientName || 'Cliente');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        await loadClientWorklogs(clientId);
    };

    window.closeClientWorklogHistoryModal = function() {
        const modal = document.getElementById('client-worklog-history-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    };

    const loadClientWorklogs = async (clientId) => {
        const body = document.getElementById('client-worklog-history-body');
        if (!body) return;
        body.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando histórico...</td></tr>`;
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${window.API_BASE_URL}/api/worklogs?client_id=${encodeURIComponent(clientId)}`, { headers });
            const json = await res.json().catch(() => []);
            if (!res.ok) {
                throw new Error(json?.error || 'Erro ao carregar histórico');
            }
            const list = Array.isArray(json) ? json : [];
            if (!list.length) {
                body.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500 italic">Nenhum registro encontrado.</td></tr>`;
                return;
            }

            const collaboratorNames = await Promise.all(list.map(item => resolveCollaboratorName(item.created_by)));
            body.innerHTML = '';
            list.forEach((item, index) => {
                const statusLabel = item.status === 'done' ? 'Concluído' : 'Em aberto';
                const statusClass = item.status === 'done'
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                const duration = item.status === 'done' ? formatWorklogDuration(item.duration_seconds) : '-';
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-gray-50 transition-colors border-b border-white';
                tr.innerHTML = `
                    <td class="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">${formatWorklogDateTime(item.created_at)}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${moduleLabels[item.module] || item.module || '-'}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">${item.action_type || '-'}</td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass} capitalize">
                            ${statusLabel}
                        </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-600">${collaboratorNames[index] || '-'}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">${duration}</td>
                    <td class="px-6 py-4 text-right text-sm font-medium">
                        <button onclick="openClientWorklogDetail('${item.id}')" class="text-primary hover:text-primary-hover transition-colors" title="Ver">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                `;
                body.appendChild(tr);
            });
        } catch (err) {
            console.error('Erro ao carregar histórico:', err);
            body.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Erro ao carregar histórico.</td></tr>`;
        }
    };

    window.openClientWorklogDetail = async function(worklogId) {
        const modal = document.getElementById('client-worklog-detail-modal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        await loadClientWorklogDetail(worklogId);
    };

    window.closeClientWorklogDetailModal = function() {
        const modal = document.getElementById('client-worklog-detail-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    };

    const loadClientWorklogDetail = async (worklogId) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${window.API_BASE_URL}/api/worklogs/${encodeURIComponent(worklogId)}`, { headers });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(json?.error || 'Erro ao carregar detalhe');
            }
            await renderClientWorklogDetail(json);
        } catch (err) {
            console.error('Erro ao carregar detalhe:', err);
            alert('Erro ao carregar detalhe do diário.');
        }
    };

    const renderClientWorklogDetail = async (data) => {
        const worklog = data?.worklog || {};
        const actions = Array.isArray(data?.actions) ? data.actions : [];
        const createdByName = await resolveCollaboratorName(worklog.created_by);
        const statusLabel = worklog.status === 'done' ? 'Concluído' : 'Em aberto';
        const duration = worklog.status === 'done' ? formatWorklogDuration(worklog.duration_seconds) : '-';

        setClientWorklogText('client-worklog-detail-cliente', worklogHistoryClientName || '-');
        setClientWorklogText('client-worklog-detail-module', moduleLabels[worklog.module] || worklog.module || '-');
        setClientWorklogText('client-worklog-detail-tipo', worklog.action_type || '-');
        setClientWorklogText('client-worklog-detail-prioridade', worklog.priority || '-');
        setClientWorklogText('client-worklog-detail-prazo', formatWorklogDate(worklog.due_date));
        setClientWorklogText('client-worklog-detail-criado-por', createdByName || '-');
        setClientWorklogText('client-worklog-detail-criado-em', formatWorklogDateTime(worklog.created_at));
        setClientWorklogText('client-worklog-detail-status', statusLabel);
        setClientWorklogText('client-worklog-detail-duracao', duration);

        const list = document.getElementById('client-worklog-actions-list');
        if (!list) return;
        list.innerHTML = '';
        if (!actions.length) {
            list.innerHTML = '<div class="text-sm text-gray-500 italic">Nenhuma ação registrada.</div>';
            return;
        }

        const actionNames = await Promise.all(actions.map(action => resolveCollaboratorName(action.created_by)));
        actions.forEach((action, index) => {
            const item = document.createElement('div');
            item.className = 'bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2';
            item.innerHTML = `
                <div class="flex items-center justify-between text-xs text-gray-400">
                    <span>${formatWorklogDateTime(action.created_at)}</span>
                    <span>${actionNames[index] || '-'}</span>
                </div>
                <div class="text-sm text-gray-700">${action.note || '-'}</div>
            `;
            list.appendChild(item);
        });
    };

    const getConnectionElements = (platform) => {
        return {
            status: document.getElementById(`${platform}-status`),
            account: document.getElementById(`${platform}-account`),
            action: document.getElementById(`${platform}-action`)
        };
    };

    const setConnectionState = (platform, connection) => {
        const els = getConnectionElements(platform);
        if (!els.status || !els.action) return;

        if (connection && connection.status === 'connected') {
            els.status.textContent = 'Status: Conectado';
            if (els.account) {
                const name = connection.external_name || connection.external_id || '';
                if (name) {
                    els.account.textContent = name;
                    els.account.classList.remove('hidden');
                } else {
                    els.account.textContent = '';
                    els.account.classList.add('hidden');
                }
            }
            els.action.textContent = 'Desconectar';
            els.action.dataset.action = 'disconnect';
            els.action.className = 'w-full px-3 py-2 bg-red-500 text-white rounded-md text-sm';
        } else {
            els.status.textContent = 'Status: Não conectado';
            if (els.account) {
                els.account.textContent = '';
                els.account.classList.add('hidden');
            }
            els.action.textContent = 'Conectar';
            els.action.dataset.action = 'connect';
            els.action.className = 'w-full px-3 py-2 bg-primary text-white rounded-md text-sm';
        }
    };

    let currentClientIdForConnections = null;

    const loadConnectionsForClient = async (clientId) => {
        currentClientIdForConnections = clientId;
        setConnectionState('instagram', null);
        setConnectionState('facebook', null);

        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`${window.API_BASE_URL}/api/clients/${clientId}/connections`, { headers });
            if (!res.ok) {
                throw new Error(`Erro ao buscar conexões (${res.status})`);
            }
            const connections = await res.json();
            const list = Array.isArray(connections) ? connections : [];
            list.forEach(item => {
                if (item.platform === 'instagram' || item.platform === 'facebook') {
                    setConnectionState(item.platform, item);
                }
            });
        } catch (err) {
            console.error('Erro ao carregar conexões:', err);
        }
    };

    const startMetaConnection = async (platform) => {
        if (!currentClientIdForConnections) return;

        const headers = await getAuthHeaders();
        const res = await fetch(`${window.API_BASE_URL}/api/clients/${currentClientIdForConnections}/connections/meta/start?platform=${encodeURIComponent(platform)}`, {
            method: 'GET',
            headers
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData?.error || 'Erro ao iniciar conexão');
        }

        const data = await res.json();
        if (!data.auth_url) {
            throw new Error('URL de conexão não recebida');
        }

        window.location.href = data.auth_url;
    };

    const disconnectPlatform = async (platform) => {
        if (!currentClientIdForConnections) return;

        const headers = await getAuthHeaders();
        const res = await fetch(`${window.API_BASE_URL}/api/clients/${currentClientIdForConnections}/connections/${platform}/disconnect`, {
            method: 'POST',
            headers
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData?.error || 'Erro ao desconectar');
        }
    };

    const setupConnectionActions = () => {
        const instagramBtn = document.getElementById('instagram-action');
        const facebookBtn = document.getElementById('facebook-action');

        if (instagramBtn) {
            instagramBtn.addEventListener('click', async () => {
                try {
                    if (!currentClientIdForConnections) {
                        alert('Selecione um cliente para conectar.');
                        return;
                    }
                    if (instagramBtn.dataset.action === 'disconnect') {
                        await disconnectPlatform('instagram');
                        await loadConnectionsForClient(currentClientIdForConnections);
                    } else {
                        await startMetaConnection('instagram');
                    }
                } catch (err) {
                    alert(err.message || 'Erro na conexão do Instagram');
                }
            });
        }

        if (facebookBtn) {
            facebookBtn.addEventListener('click', async () => {
                try {
                    if (!currentClientIdForConnections) {
                        alert('Selecione um cliente para conectar.');
                        return;
                    }
                    if (facebookBtn.dataset.action === 'disconnect') {
                        await disconnectPlatform('facebook');
                        await loadConnectionsForClient(currentClientIdForConnections);
                    } else {
                        await startMetaConnection('facebook');
                    }
                } catch (err) {
                    alert(err.message || 'Erro na conexão do Facebook');
                }
            });
        }
    };

    const loadClienteHistorico = async (clienteId) => {
        const card = document.getElementById('cliente-historico-card');
        const loading = document.getElementById('cliente-historico-loading');
        const empty = document.getElementById('cliente-historico-empty');
        const table = document.getElementById('cliente-historico-table');
        const tbody = document.getElementById('cliente-historico-tbody');
        if (!card || !loading || !empty || !table || !tbody) return;

        if (!clienteId || !window.Logbook || typeof window.Logbook.listActionsByClient !== 'function') {
            card.classList.add('hidden');
            return;
        }

        card.classList.remove('hidden');
        loading.classList.remove('hidden');
        empty.classList.add('hidden');
        table.classList.add('hidden');
        tbody.innerHTML = '';

        const items = await window.Logbook.listActionsByClient(clienteId);
        loading.classList.add('hidden');

        if (!items || items.length === 0) {
            empty.classList.remove('hidden');
            return;
        }

        table.classList.remove('hidden');
        items.slice(0, 50).forEach((item) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors';
            const createdAt = item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '-';
            const moduleLabel = window.Logbook.formatModuleLabel ? window.Logbook.formatModuleLabel(item.module) : item.module || '-';
            const actionLabel = item.action_type || '-';
            const details = item.details || '-';
            tr.innerHTML = `
                <td class="px-6 py-3 text-sm text-gray-600 whitespace-nowrap">${createdAt}</td>
                <td class="px-6 py-3 text-sm text-gray-600">${moduleLabel}</td>
                <td class="px-6 py-3 text-sm text-gray-700">${actionLabel}</td>
                <td class="px-6 py-3 text-sm text-gray-600">${details}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    const handleOAuthReturn = async () => {
        const params = new URLSearchParams(window.location.search);
        const clienteId = params.get('cliente_id') || params.get('cliente');
        if (clienteId) {
            await editCliente(clienteId);
        }
    };

    setupConnectionActions();
    loadClientes();
    handleOAuthReturn();
});
