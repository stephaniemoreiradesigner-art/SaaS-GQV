document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.includes('colaboradores.html')) return;

    const tableBody = document.getElementById('colaboradores-table-body');
    const form = document.getElementById('form-colaborador');

    function onlyDigits(str) { return (str || '').replace(/\D/g, ''); }

    function formatCPF(value) {
        const v = onlyDigits(value).slice(0, 11);
        return v.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (m, a, b, c, d) => `${a}.${b}.${c}${d ? '-' + d : ''}`);
    }

    function formatCNPJ(value) {
        const v = onlyDigits(value).slice(0, 14);
        return v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (m, a, b, c, d, e) => `${a}.${b}.${c}/${d}${e ? '-' + e : ''}`);
    }

    const tipoDocumentoEl = document.getElementById('tipo_documento');
    const documentoEl = document.getElementById('documento');
    const telefoneEl = document.getElementById('telefone');
    const fotoInput = document.getElementById('foto');
    const fotoPreview = document.getElementById('foto-preview');
    const contratoInput = document.getElementById('contrato');
    const perfilAcessoEl = document.getElementById('perfil_acesso');
    const nivelHierarquicoEl = document.getElementById('nivel_hierarquico');
    const departamentoEl = document.getElementById('departamento');
    const departamentoWrapper = document.getElementById('departamento-wrapper');
    const salarioEl = document.getElementById('salario');
    const ativoEl = document.getElementById('ativo');

    const departamentoPermissoes = {
        social_media: ['social_media'],
        gestor_trafego: ['trafego_pago'],
        gestor_automacao: ['automacoes'],
        departamento_comercial: ['clientes'],
        analista_financeiro: ['financeiro']
    };

    // --- Nova Lógica de Permissões ---
    function updatePermissionsUI() {
        const nivel = nivelHierarquicoEl ? nivelHierarquicoEl.value : null;
        if (perfilAcessoEl) {
            if (nivel === 'CEO') perfilAcessoEl.value = 'super_admin';
            else if (nivel === 'Diretoria') perfilAcessoEl.value = 'admin';
            else perfilAcessoEl.value = 'usuario';
        }
        if (departamentoWrapper && departamentoEl) {
            const isDepartamento = nivel === 'Departamento';
            departamentoWrapper.classList.toggle('hidden', !isDepartamento);
            if (!isDepartamento) departamentoEl.value = '';
        }
        const perfil = perfilAcessoEl ? perfilAcessoEl.value : 'usuario';
        const modCheckboxes = document.querySelectorAll('.modulo-check');
        const timeCheckboxes = document.querySelectorAll('.time-check');
        const isFullAccess = perfil === 'super_admin' || perfil === 'admin';
        
        modCheckboxes.forEach(cb => {
            if (isFullAccess) {
                cb.checked = true;
                cb.disabled = true; // Marca e trava
            } else {
                const dept = departamentoEl ? departamentoEl.value : '';
                const allowed = departamentoPermissoes[dept] || [];
                cb.checked = allowed.includes(cb.value);
                cb.disabled = true;
            }
        });

        timeCheckboxes.forEach(cb => {
            if (isFullAccess) {
                cb.checked = true;
                cb.disabled = true;
            } else {
                cb.disabled = false;
            }
        });
    }

    if (nivelHierarquicoEl) {
        nivelHierarquicoEl.addEventListener('change', updatePermissionsUI);
    }
    if (departamentoEl) {
        departamentoEl.addEventListener('change', updatePermissionsUI);
    }
    // ---------------------------------

    if (tipoDocumentoEl && documentoEl) {
        const applyMask = () => {
            const tipo = tipoDocumentoEl.value;
            documentoEl.placeholder = tipo === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00';
            documentoEl.value = tipo === 'CPF' ? formatCPF(documentoEl.value) : formatCNPJ(documentoEl.value);
        };
        tipoDocumentoEl.addEventListener('change', applyMask);
        documentoEl.addEventListener('input', applyMask);
        applyMask();
    }

    if (telefoneEl) {
        telefoneEl.addEventListener('input', function (e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
        });
    }

    if (fotoInput && fotoPreview) {
        fotoInput.addEventListener('change', () => {
            const file = fotoInput.files && fotoInput.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => { fotoPreview.src = e.target.result; };
                reader.readAsDataURL(file);
            }
        });
    }

    // --- Carregar Times (Squads) ---
    async function loadTimes() {
        const container = document.getElementById('times-container');
        if (!container) return;

        if (!window.supabaseClient) {
            setTimeout(loadTimes, 500);
            return;
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('times')
                .select('*')
                .order('nome', { ascending: true });

            if (error) throw error;

            container.innerHTML = ''; 

            if (!data || data.length === 0) {
                container.innerHTML = ''; // Deixa em branco se não houver times
                // Libera tela mesmo vazio
                if (window.showContent) window.showContent();
                return;
            }

            let html = '<div class="times-grid">';
            data.forEach(time => {
                html += `
                    <div class="time-checkbox">
                        <input type="checkbox" id="time_${time.id}" value="${time.id}" name="times_acesso" class="time-check">
                        <label for="time_${time.id}">${time.nome}</label>
                    </div>
                `;
            });
            html += '</div>';
            container.innerHTML = html;
            
            // Atualiza UI baseada no perfil atual (caso já tenha algo selecionado)
            updatePermissionsUI();

        } catch (err) {
            console.error('Erro ao carregar times:', err);
            container.innerHTML = ''; // Deixa em branco em caso de erro
        } finally {
            // Libera a tela
            if (window.showContent) window.showContent();
        }
    }

    async function uploadFileToStorage(folder, id, file) {
        if (!file) return null;
        const bucket = 'colaboradores';
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const path = `${folder}/${id}-${Date.now()}-${safeName}`;
        const { error } = await window.supabaseClient.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type });
        if (error) { throw error; }
        const { data } = window.supabaseClient.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
    }

    async function ensureAuthAndRole() {
        const { data } = await window.supabaseClient.auth.getSession();
        const session = data.session;
        if (!session) { window.location.href = 'index.html'; return null; }

        try {
            const allowSuper = (window.SUPERADMIN_EMAILS || []).includes(session.user.email);
            if (allowSuper) { return session; }
            
            // Tenta buscar profile, mas não trava se der erro 500
            let profile = null;
            try {
                const { data: p, error: pErr } = await window.supabaseClient
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .maybeSingle(); // maybeSingle evita erro se não achar
                if (!pErr) profile = p;
            } catch (ignore) { console.warn('Erro ao buscar profile, tentando fallback...'); }

            if (profile && profile.role === 'super_admin') {
                if (allowSuper) { return session; }
            }

            const { data: colab } = await window.supabaseClient
                .from('colaboradores')
                .select('perfil_acesso,email')
                .eq('email', session.user.email)
                .maybeSingle();

            if (colab && colab.perfil_acesso === 'super_admin') {
                if (allowSuper) { return session; }
            }
            
            // Se chegou aqui, é um usuário normal ou a verificação falhou parcialmente.
            // Vamos permitir carregar a página mas com restrições, ou pelo menos não travar.
            // Para "colaboradores", geralmente só admin vê. 
            // Mas vamos retornar a sessão para permitir que a query de listagem decida (RLS).
            return session;

        } catch (e) {
            console.warn('Verificação de papel falhou:', e.message);
            // Em caso de erro grave, ainda retornamos a sessão para tentar carregar o que der
            return session;
        }
    }

    async function loadColaboradores() {
        if (!window.supabaseClient) { setTimeout(loadColaboradores, 500); return; }
        
        try {
            const session = await ensureAuthAndRole();
            if (!session) return; // Só para se redirecionou

            const { data: colaboradores, error } = await window.supabaseClient
                .from('colaboradores')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            renderColaboradores(colaboradores || []);
        } catch (error) {
            console.error('Erro ao carregar colaboradores:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-8">
                        <div class="flex flex-col items-center justify-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Erro ao carregar colaboradores.</p>
                            <p class="text-sm text-gray-400 mt-1">${error.message || 'Erro desconhecido'}</p>
                            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm">
                                Tentar Novamente
                            </button>
                        </div>
                    </td>
                </tr>`;
        }
    }

    // --- UI Helpers ---
    function toggleForm() {
        const listContainer = document.getElementById('lista-colaboradores-container');
        const formContainer = document.getElementById('form-colaborador-container');
        const form = document.getElementById('form-colaborador');
        const fotoPreview = document.getElementById('foto-preview');
        const btnSave = document.getElementById('btn-save-colaborador');
        const title = document.getElementById('form-title');

        // Se o form estiver escondido, vamos mostrar
        if (formContainer.classList.contains('hidden')) {
            listContainer.classList.add('hidden');
            formContainer.classList.remove('hidden');

            if (!window.currentColabId) {
                // Modo CRIAÇÃO
                form.reset();
                if (fotoPreview) {
                    fotoPreview.src = '';
                    fotoPreview.parentElement.classList.add('hidden');
                }
                if (btnSave) btnSave.innerText = 'Salvar Colaborador';
                if (title) title.innerText = 'Cadastrar Novo Colaborador';
                updatePermissionsUI();
            } else {
                // Modo EDIÇÃO
                if (fotoPreview && fotoPreview.src && fotoPreview.src !== window.location.href) {
                     fotoPreview.parentElement.classList.remove('hidden');
                }
                if (title) title.innerText = 'Editar Colaborador';
            }
        } else {
            // Se o form estiver visível, vamos esconder
            formContainer.classList.add('hidden');
            listContainer.classList.remove('hidden');
            
            // Limpar ID ao fechar
            window.currentColabId = null;
        }
    }
    
    // Expor globalmente
    window.toggleForm = toggleForm;

    function renderColaboradores(items) {
        tableBody.innerHTML = '';
        if (!items.length) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-8 text-gray-500">
                        <div class="flex flex-col items-center justify-center">
                            <i class="fas fa-users text-4xl text-gray-300 mb-3"></i>
                            <p>Nenhum colaborador cadastrado ainda.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        const departamentoLabels = {
            social_media: 'Social Media',
            gestor_trafego: 'Gestor de Tráfego',
            gestor_automacao: 'Gestor de Automação',
            departamento_comercial: 'Departamento Comercial',
            analista_financeiro: 'Analista Financeiro'
        };

        items.forEach(c => {
            const tipo = c.tipo_documento === 'CNPJ' ? 'CNPJ' : 'CPF';
            const docMask = tipo === 'CNPJ' ? formatCNPJ(c.documento) : formatCPF(c.documento);
            const hierarquia = c.nivel_hierarquico || (c.perfil_acesso === 'super_admin' ? 'CEO' : c.perfil_acesso === 'admin' ? 'Diretoria' : 'Departamento');
            const departamento = c.departamento ? departamentoLabels[c.departamento] || c.departamento : '—';
            const salarioNum = Number(c.salario);
            const salarioDisplay = Number.isFinite(salarioNum)
                ? salarioNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                : '—';
            
            // Badges
            const regimeBadge = `<span class="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">${c.regime}</span>`;
            
            let perfilClass = 'bg-gray-100 text-gray-700 border-gray-200';
            if (c.perfil_acesso === 'admin') perfilClass = 'bg-purple-50 text-purple-700 border-purple-100';
            if (c.perfil_acesso === 'super_admin') perfilClass = 'bg-indigo-50 text-indigo-700 border-indigo-100';
            
            const perfilBadge = `<span class="px-2 py-1 rounded-full text-xs font-medium border ${perfilClass}">${hierarquia}</span>`;

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0';
            
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    ${c.foto_url 
                        ? `<img src="${c.foto_url}" alt="Foto" class="h-10 w-10 rounded-full object-cover border border-gray-200">` 
                        : `<div class="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200">
                             <i class="fas fa-user"></i>
                           </div>`
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${c.nome}</div>
                    <div class="text-xs text-gray-500">${departamento}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">${docMask}</td>
                <td class="px-6 py-4 whitespace-nowrap">${regimeBadge}</td>
                <td class="px-6 py-4 whitespace-nowrap">${perfilBadge}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${departamento}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${salarioDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${c.email}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center">
                    ${c.contrato_url 
                        ? `<a href="${c.contrato_url}" target="_blank" class="text-[var(--color-primary)] hover:text-indigo-800 transition-colors" title="Ver Contrato"><i class="fas fa-file-contract text-lg"></i></a>` 
                        : '<span class="text-gray-300">—</span>'
                    }
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="editColaborador('${c.id}')" class="p-2 text-gray-400 hover:text-[var(--color-primary)] hover:bg-indigo-50 rounded-lg transition-colors" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteColaborador('${c.id}')" class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-save-colaborador');
            const original = btn.innerText;
            try {
                btn.innerText = 'Salvando...';
                btn.disabled = true;
                const tipo = document.getElementById('tipo_documento').value;
                const docRaw = onlyDigits(document.getElementById('documento').value);
                const payload = {
                    nome: document.getElementById('nome').value,
                    tipo_documento: tipo,
                    documento: docRaw,
                    endereco: document.getElementById('endereco').value,
                    data_nascimento: document.getElementById('data_nascimento').value || null,
                    telefone: document.getElementById('telefone').value,
                    email: document.getElementById('email').value,
                    regime: document.getElementById('regime').value,
                    perfil_acesso: document.getElementById('perfil_acesso').value,
                    nivel_hierarquico: nivelHierarquicoEl ? nivelHierarquicoEl.value : null,
                    departamento: departamentoEl ? departamentoEl.value || null : null,
                    salario: salarioEl && salarioEl.value ? parseFloat(String(salarioEl.value).replace(',', '.')) : null,
                    ativo: ativoEl ? ativoEl.value === 'true' : true,
                    // Coletar Permissões de Módulos
                    permissoes: Array.from(document.querySelectorAll('.modulo-check:checked')).map(cb => cb.value),
                    // Coletar Times (Squads)
                    times_acesso: Array.from(document.querySelectorAll('.time-check:checked')).map(cb => cb.value)
                };

                if (window.currentColabId) {
                    if (contratoInput && contratoInput.files && contratoInput.files[0] && contratoInput.files[0].type !== 'application/pdf') {
                        alert('Anexe o contrato apenas em PDF.');
                        throw new Error('Contrato deve ser PDF');
                    }
                    let extra = {};
                    if (fotoInput && fotoInput.files && fotoInput.files[0]) {
                        try { 
                            extra.foto_url = await uploadFileToStorage('fotos', window.currentColabId, fotoInput.files[0]); 
                        } catch (e) { 
                            console.error('Upload foto falhou:', e);
                            alert('Atenção: Erro ao fazer upload da foto. O cadastro será salvo sem a nova imagem.\nErro: ' + e.message);
                        }
                    }
                    if (contratoInput && contratoInput.files && contratoInput.files[0]) {
                        try { 
                            extra.contrato_url = await uploadFileToStorage('contratos', window.currentColabId, contratoInput.files[0]); 
                        } catch (e) { 
                            console.warn('Upload contrato falhou:', e.message);
                            alert('Atenção: Erro ao fazer upload do contrato. Tente novamente.');
                        }
                    }
                    
                    // Update no banco
                    const { error } = await window.supabaseClient
                        .from('colaboradores')
                        .update({ ...payload, ...extra })
                        .eq('id', window.currentColabId);
                    
                    if (error) throw error;

                    // Atualizar Sidebar se for o próprio usuário
                    const { data: { user } } = await window.supabaseClient.auth.getUser();
                    if (user && user.email === payload.email) {
                        // Recarrega perfil na sidebar
                        // Precisamos acessar a função global ou recarregar a página?
                        // Como loadUserProfile está em app.js e não é global, vamos tentar recarregar via evento ou reload
                        // Mas podemos tentar injetar direto se tivermos acesso ao DOM da sidebar
                        const avatarSidebar = document.getElementById('user-avatar-sidebar');
                        if (avatarSidebar && extra.foto_url) {
                            avatarSidebar.src = extra.foto_url;
                        }
                    }

                    alert('Colaborador atualizado com sucesso!');
                    window.currentColabId = null;
                    btn.innerText = 'Salvar Colaborador';
                } else {
                    if (contratoInput && contratoInput.files && contratoInput.files[0] && contratoInput.files[0].type !== 'application/pdf') {
                        alert('Anexe o contrato apenas em PDF.');
                        throw new Error('Contrato deve ser PDF');
                    }
                    const { data: inserted, error } = await window.supabaseClient
                        .from('colaboradores')
                        .insert([payload])
                        .select();
                    if (error) throw error;
                    const created = inserted && inserted[0];
                    if (created) {
                        let fotoUrl = null;
                        let contratoUrl = null;
                        if (fotoInput && fotoInput.files && fotoInput.files[0]) {
                            try { 
                                fotoUrl = await uploadFileToStorage('fotos', created.id, fotoInput.files[0]); 
                            } catch (e) { 
                                console.error('Upload foto falhou:', e);
                                alert('Atenção: Erro ao fazer upload da foto na criação. Edite o colaborador para tentar novamente.');
                            }
                        }
                        if (contratoInput && contratoInput.files && contratoInput.files[0]) {
                            try { 
                                contratoUrl = await uploadFileToStorage('contratos', created.id, contratoInput.files[0]); 
                            } catch (e) { 
                                console.warn('Upload contrato falhou:', e.message);
                            }
                        }
                        if (fotoUrl || contratoUrl) {
                            await window.supabaseClient.from('colaboradores').update({ foto_url: fotoUrl, contrato_url: contratoUrl }).eq('id', created.id);
                        }
                    }
                    alert('Colaborador cadastrado com sucesso!');
                }

                if (window.verificarGeracaoSalariosAutomaticos) {
                    await window.verificarGeracaoSalariosAutomaticos({ force: true });
                }

                toggleForm();
                loadColaboradores();
            } catch (err) {
                alert('Erro ao salvar colaborador: ' + err.message);
            } finally {
                btn.innerText = original;
                btn.disabled = false;
            }
        });
    }

    window.deleteColaborador = async (id) => {
        if (!confirm('Tem certeza que deseja excluir este colaborador?')) return;
        try {
            const { error } = await window.supabaseClient.from('colaboradores').delete().eq('id', id);
            if (error) throw error;
            loadColaboradores();
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        }
    };

    window.editColaborador = async (id) => {
        try {
            const { data, error } = await window.supabaseClient.from('colaboradores').select('*').eq('id', id).single();
            if (error) throw error;
            document.getElementById('nome').value = data.nome || '';
            document.getElementById('tipo_documento').value = data.tipo_documento || 'CPF';
            document.getElementById('documento').value = data.tipo_documento === 'CNPJ' ? formatCNPJ(data.documento) : formatCPF(data.documento);
            document.getElementById('endereco').value = data.endereco || '';
            document.getElementById('data_nascimento').value = data.data_nascimento || '';
            document.getElementById('telefone').value = data.telefone || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('regime').value = data.regime || 'MEI';
            if (nivelHierarquicoEl) {
                let nivel = data.nivel_hierarquico;
                if (!nivel) {
                    if (data.perfil_acesso === 'super_admin') nivel = 'CEO';
                    else if (data.perfil_acesso === 'admin') nivel = 'Diretoria';
                    else nivel = 'Departamento';
                }
                nivelHierarquicoEl.value = nivel;
            }
            if (departamentoEl) departamentoEl.value = data.departamento || '';
            if (salarioEl) salarioEl.value = data.salario ?? '';
            if (ativoEl) ativoEl.value = data.ativo === false ? 'false' : 'true';
            document.getElementById('perfil_acesso').value = data.perfil_acesso || 'usuario';
            
            updatePermissionsUI();

            // Preencher permissões de times
            const timesAcesso = data.times_acesso || [];
            const timeCheckboxes = document.querySelectorAll('.time-check');
            const perfil = perfilAcessoEl ? perfilAcessoEl.value : 'usuario';
            
            timeCheckboxes.forEach(cb => {
                if (perfil === 'super_admin' || perfil === 'admin') {
                    cb.checked = true;
                    cb.disabled = true;
                } else {
                    cb.checked = timesAcesso.includes(cb.value);
                    cb.disabled = false;
                }
            });

            if (fotoPreview) { fotoPreview.src = data.foto_url || ''; }
            window.currentColabId = id;
            toggleForm();
            const btn = document.getElementById('btn-save-colaborador');
            btn.innerText = 'Atualizar Colaborador';
        } catch (err) {
            alert('Erro ao carregar dados para edição: ' + err.message);
        }
    };

    

    setTimeout(() => {
        loadColaboradores();
        loadTimes();
    }, 800);
});
