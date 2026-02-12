document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se estamos na página de clientes
    if (!window.location.pathname.includes('clientes.html')) return;

    console.log('Módulo Clientes Iniciado');

    const clientesTableBody = document.getElementById('clientes-table-body');
    const formCliente = document.getElementById('form-cliente');
    const mensalidadesContainer = document.getElementById('mensalidades-container');

    const phoneInputs = ['telefone', 'responsavel_whatsapp'];
    phoneInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', function (e) {
                let x = e.target.value.replace(/\D/g, '').match(/(\d{0,2})(\d{0,5})(\d{0,4})/);
                e.target.value = !x[2] ? x[1] : '(' + x[1] + ') ' + x[2] + (x[3] ? '-' + x[3] : '');
            });
        }
    });

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

            const uniqueClientes = Array.isArray(clientes)
                ? Array.from(new Map(clientes.map(cliente => [String(cliente.id), cliente])).values())
                : [];

            renderClientes(uniqueClientes);

        } catch (error) {
            const message = error?.message || error?.error_description || JSON.stringify(error);
            console.error('Erro ao carregar clientes:', message, error);
            clientesTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-8">
                        <div class="flex flex-col items-center justify-center text-red-500">
                            <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                            <p>Erro ao carregar clientes.</p>
                            <p class="text-sm text-gray-400 mt-1">${message}</p>
                            <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm">
                                Tentar Novamente
                            </button>
                        </div>
                    </td>
                </tr>`;
        } finally {
            // Libera a tela
            if (window.showContent) window.showContent();
        }
    }

    // 2. Renderizar Tabela
    function renderClientes(clientes) {
        clientesTableBody.innerHTML = '';

        if (!clientes || clientes.length === 0) {
            // Deixa em branco se não houver clientes
            return;
        }

        clientes.forEach(cliente => {
            const servicosBadges = (cliente.servicos || [])
                .map(s => `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-1">${s}</span>`)
                .join('');

            // Nome do Time
            const nomeTime = cliente.times ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 ml-1">${cliente.times.nome}</span>` : '';

            // Nome Fantasia ou Razão Social
            const nomeExibicao = cliente.nome_fantasia || cliente.nome_empresa;

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0';
            row.innerHTML = `
                <td class="px-6 py-4">
                    <div class="flex items-center flex-wrap">
                        <strong class="text-gray-900 font-medium">${nomeExibicao}</strong> ${nomeTime}
                    </div>
                    <div class="text-xs text-gray-500 mt-1">${cliente.telefone || ''}</div>
                </td>
                <td class="px-6 py-4">
                    <div class="text-sm text-gray-700">${cliente.responsavel_nome || '-'}</div>
                    <a href="https://wa.me/55${(cliente.responsavel_whatsapp || '').replace(/\D/g, '')}" target="_blank" class="text-xs text-green-600 flex items-center gap-1 mt-0.5 hover:underline">
                        <i class="fab fa-whatsapp"></i> ${cliente.responsavel_whatsapp || '-'}
                    </a>
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">${servicosBadges}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">R$ ${parseFloat(cliente.valor_mensalidade || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">Dia ${cliente.dia_vencimento || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="text-primary hover:text-primary/80 mr-3 p-1.5 hover:bg-primary/10 rounded transition-colors" onclick="editCliente('${cliente.id}')"><i class="fas fa-edit"></i></button>
                    <button class="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition-colors" onclick="deleteCliente('${cliente.id}')"><i class="fas fa-trash"></i></button>
                </td>
            `;
            clientesTableBody.appendChild(row);
        });
    }

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

            const clienteData = {
                nome_empresa: document.getElementById('nome_empresa').value,
                nome_fantasia: document.getElementById('nome_fantasia').value,
                time_id: document.getElementById('time_id').value || null,
                telefone: document.getElementById('telefone').value,
                endereco: document.getElementById('endereco').value,
                email_contato: document.getElementById('email_contato').value,
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
                
                servicos: getCheckedValues('servicos'),
                responsavel_trafego_colaborador_id: gestorColaboradorId,
                responsavel_social_colaborador_id: socialColaboradorId,
                gestor_trafego_email: gestorEmail,
                social_media_email: socialEmail,
                status: document.getElementById('status_cliente').value
            };

                let error;

                if (clienteId) {
                    const { error: updateError } = await window.supabaseClient
                        .from('clientes')
                        .update(clienteData)
                        .eq('id', clienteId);
                    
                    error = updateError;

                    if (!error) {
                        await gerarCobrancasMensalidades(
                            { 
                                nome_empresa: clienteData.nome_empresa,
                                nome_fantasia: clienteData.nome_fantasia 
                            },
                            mensalidades,
                            { replaceExisting: true }
                        );
                    }
                } else {
                    const { data, error: insertError } = await window.supabaseClient
                        .from('clientes')
                        .insert([clienteData])
                        .select()
                        .single();
                    
                    error = insertError;

                    if (!error && data && clienteData.status === 'Ativo') {
                        await gerarCobrancasMensalidades(
                            { 
                                nome_empresa: clienteData.nome_empresa,
                                nome_fantasia: clienteData.nome_fantasia 
                            },
                            mensalidades,
                            { replaceExisting: false }
                        );
                    }
                }

                if (error) throw error;

                alert(clienteId ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!');
                
                // Volta para lista
                const lista = document.getElementById('lista-clientes-container');
                const formContainer = document.getElementById('form-cliente-container');
                if (lista && formContainer) {
                    lista.style.display = 'block';
                    formContainer.style.display = 'none';
                }
                
                loadClientes(); // Recarrega a lista

            } catch (error) {
                console.error('Erro ao salvar:', error);
                alert('Erro ao salvar cliente: ' + error.message);
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
            const res = await fetch(`/api/clients/${clientId}/connections`, { headers });
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
        const res = await fetch(`/api/clients/${currentClientIdForConnections}/connections/meta/start`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ platform })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData?.error || 'Erro ao iniciar conexão');
        }

        const data = await res.json();
        if (!data.url) {
            throw new Error('URL de conexão não recebida');
        }

        window.location.href = data.url;
    };

    const disconnectPlatform = async (platform) => {
        if (!currentClientIdForConnections) return;

        const headers = await getAuthHeaders();
        const res = await fetch(`/api/clients/${currentClientIdForConnections}/connections/${platform}/disconnect`, {
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

    const handleOAuthReturn = async () => {
        const params = new URLSearchParams(window.location.search);
        const clienteId = params.get('cliente');
        if (clienteId) {
            await editCliente(clienteId);
        }
    };

    setupConnectionActions();
    loadClientes();
    handleOAuthReturn();
});
