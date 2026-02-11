
// Gerenciamento de Solicitações de Criativos (Tráfego Pago -> Social Media)

window.openCreativeRequestModal = async function() {
    const modal = document.getElementById('creative-request-modal');
    if (!modal) return;
    
    modal.classList.remove('hidden');
    document.querySelector('form', modal).reset();
    
    // Carregar Clientes
    const clienteSelect = document.getElementById('req-cliente');
    if (clienteSelect && clienteSelect.options.length <= 1) {
        const mainFilter = document.getElementById('filter-cliente');
        if (mainFilter) {
            Array.from(mainFilter.options).forEach((opt, index) => {
                if (index > 0) clienteSelect.appendChild(opt.cloneNode(true));
            });
        } else {
            // Fallback se filtro não estiver carregado
            const { data } = await window.supabaseClient.from('clientes').select('id, nome_fantasia');
            if(data) {
                data.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nome_fantasia;
                    clienteSelect.appendChild(opt);
                });
            }
        }
    }
    
    // Pré-selecionar cliente se filtro estiver ativo
    const currentClient = document.getElementById('filter-cliente')?.value;
    if(currentClient) clienteSelect.value = currentClient;

    // Carregar Colaboradores (Social Media)
    const colabSelect = document.getElementById('req-colaborador');
    if (colabSelect && colabSelect.options.length <= 1) {
        try {
            // Busca colaboradores filtrando por acesso ao módulo Social Media
            // Precisa ter perfil 'super_admin', 'admin' OU permissão 'social_media'
            const { data: colabs, error } = await window.supabaseClient
                .from('colaboradores')
                .select('id, nome, email, permissoes, perfil_acesso');

            if (error) throw error;

            if (colabs) {
                const filtered = colabs.filter(c => {
                    const isSuper = c.perfil_acesso === 'super_admin';
                    const isAdmin = c.perfil_acesso === 'admin';
                    const hasPerm = c.permissoes && Array.isArray(c.permissoes) && c.permissoes.includes('social_media');
                    return isSuper || isAdmin || hasPerm;
                });

                if (filtered.length > 0) {
                    filtered.forEach(u => {
                        const opt = document.createElement('option');
                        // Usamos o ID do colaborador como value, mas guardamos o email para a atribuição
                        opt.value = u.id;
                        opt.dataset.email = u.email;
                        opt.textContent = u.nome || u.email;
                        colabSelect.appendChild(opt);
                    });
                } else {
                    console.warn('Nenhum colaborador com permissão social_media encontrado. Usando fallback.');
                    throw new Error('Nenhum colaborador qualificado encontrado'); // Força cair no catch para usar profiles
                }
            }
        } catch (e) {
            console.error('Erro ao carregar colaboradores, usando fallback profiles:', e);
            // Fallback: Busca profiles se der erro na tabela colaboradores
            const { data: users } = await window.supabaseClient
                .from('profiles')
                .select('id, email, nome');
                
            if (users) {
                users.forEach(u => {
                    const opt = document.createElement('option');
                    opt.value = u.id;
                    opt.dataset.email = u.email; 
                    opt.textContent = u.nome || u.email;
                    colabSelect.appendChild(opt);
                });
            }
        }
    }
}

window.closeCreativeRequestModal = function() {
    const modal = document.getElementById('creative-request-modal');
    if(modal) modal.classList.add('hidden');
}

window.submitCreativeRequest = async function(e) {
    e.preventDefault();
    
    const clienteId = document.getElementById('req-cliente').value;
    const colaboradorId = document.getElementById('req-colaborador').value;
    const prazo = document.getElementById('req-prazo').value;
    const etapa = document.getElementById('req-etapa').value;
    const copy = document.getElementById('req-copy').value;
    
    if (!clienteId || !colaboradorId || !prazo) {
        alert('Preencha Cliente, Colaborador e Prazo.');
        return;
    }

    const user = (await window.supabaseClient.auth.getUser()).data.user;
    if(!user) {
        alert('Usuário não autenticado.');
        return;
    }

    const descricaoCompleta = `[Solicitação de Criativo]\nEtapa do Funil: ${etapa}\n\nInstruções/Copy:\n${copy}`;
    
    // Obter nome do cliente para o título
    const clienteNome = document.getElementById('req-cliente').options[document.getElementById('req-cliente').selectedIndex].text;

    try {
        // 1. Criar Tarefa
        const { data: tarefa, error } = await window.supabaseClient
            .from('tarefas')
            .insert({
                titulo: `Criativo: ${clienteNome}`,
                descricao: descricaoCompleta,
                prazo_data: prazo,
                cliente_id: clienteId,
                tipo: 'solicitacao_criativo',
                status: 'pendente',
                criado_por: user.id,
                etapa_funil: etapa,
                copy_legenda: copy
            })
            .select()
            .single();
            
        if (error) throw error;

        // 2. Atribuir Responsável
        if (colaboradorId) {
            try {
                 const colabSelect = document.getElementById('req-colaborador');
                 const selectedOpt = colabSelect.options[colabSelect.selectedIndex];
                 const userEmail = selectedOpt.dataset.email;

                 if(userEmail) {
                     await window.supabaseClient
                        .from('tarefa_atribuicoes')
                        .insert({
                            tarefa_id: tarefa.id,
                            usuario_email: userEmail
                        });
                 } else {
                     console.warn('Email do colaborador não encontrado para atribuição.');
                 }
            } catch (atribError) {
                console.warn('Erro ao atribuir responsável:', atribError);
            }
        }

        alert('Solicitação enviada com sucesso!');
        closeCreativeRequestModal();
        loadCreativeRequests(); // Recarrega a lista

    } catch (error) {
        console.error('Erro ao criar solicitação:', error);
        alert('Erro ao enviar solicitação: ' + error.message);
    }
}

window.loadCreativeRequests = async function() {
    // Container de Cards/Lista
    const container = document.getElementById('creative-requests-container');
    // Wrapper da Tabela antiga (para esconder)
    const tableWrapper = document.getElementById('creative-requests-table-wrapper');
    
    // Filtros
    const filterCliente = document.getElementById('solicitacao-filter-cliente');
    const filterStatus = document.getElementById('solicitacao-filter-status');
    const clienteId = filterCliente ? filterCliente.value : '';
    const statusVal = filterStatus ? filterStatus.value : '';

    if (!container) return;
    
    // Garante que a tabela antiga esteja oculta e o container de cards visível
    if(tableWrapper) tableWrapper.classList.add('hidden');
    container.classList.remove('hidden');

    // Popular filtro de clientes se estiver vazio (apenas na primeira vez)
    if (filterCliente && filterCliente.options.length <= 1) {
        try {
            const { data: clientesData } = await window.supabaseClient
                .from('clientes')
                .select('id, nome_fantasia')
                .order('nome_fantasia');
            
            const uniqueClientes = Array.isArray(clientesData)
                ? Array.from(new Map(clientesData.map(cliente => [String(cliente.id), cliente])).values())
                : [];

            if (uniqueClientes.length > 0) {
                uniqueClientes.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.nome_fantasia;
                    filterCliente.appendChild(opt);
                });
            }
        } catch (err) {
            console.error('Erro ao carregar clientes para filtro:', err);
        }
    }

    container.innerHTML = `<div class="col-span-full flex justify-center py-12 text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mr-3"></i> Carregando solicitações...</div>`;
    
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
                    <i class="fas fa-user-slash text-4xl mb-3 text-red-300"></i>
                    <span class="text-lg font-medium text-gray-500">Usuário não autenticado</span>
                </div>
            `;
            return;
        }

        const userId = user.id;
        const userEmail = user.email || '';

        let query = window.supabaseClient
            .from('tarefas')
            .select(`
                *,
                clientes (nome_fantasia),
                tarefa_atribuicoes (
                    usuario_email
                )
            `)
            .eq('tipo', 'solicitacao_criativo')
            .order('created_at', { ascending: false });

        if (userId && userEmail) {
            const safeEmail = userEmail.replace(/"/g, '').trim();
            const encodedEmail = encodeURIComponent(`"${safeEmail}"`);
            query = query.or(`criado_por.eq.${userId},tarefa_atribuicoes.usuario_email.eq.${encodedEmail}`);
        }
            
        // Aplicar Filtros
        if (clienteId) {
            query = query.eq('cliente_id', clienteId);
        }
        
        if (statusVal) {
            if (statusVal === 'pendente') {
                // Pendente pode ser status 'pendente'
                query = query.eq('status', 'pendente');
            } else if (statusVal === 'em_andamento') {
                query = query.eq('status', 'em_andamento');
            } else if (statusVal === 'solicitacao_prazo') {
                query = query.eq('status', 'solicitacao_prazo');
            } else if (statusVal === 'concluido') {
                // Pode ser concluido ou concluida (normalizar)
                query = query.in('status', ['concluido', 'concluida']);
            }
        }

        const { data: requests, error } = await query;
            
        if (error) throw error;

        const filteredRequests = (requests || []).filter(req => {
            const createdBy = req.criado_por === userId;
            const assigned = (req.tarefa_atribuicoes || []).some(a => a.usuario_email === userEmail);
            return createdBy || assigned;
        });

        container.innerHTML = '';
        
        if (!filteredRequests || filteredRequests.length === 0) {
            container.innerHTML = `
                <div class="col-span-full flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <div class="bg-white p-3 rounded-full mb-3 text-gray-400 shadow-sm border border-gray-100">
                        <i class="fas fa-filter text-2xl"></i>
                    </div>
                    <h3 class="text-base font-medium text-gray-900 mb-1">Nenhum Registro Encontrado</h3>
                    <p class="text-gray-500 max-w-md mx-auto text-xs">Tente ajustar os filtros ou crie uma nova solicitação.</p>
                </div>
            `;
            return;
        }
        
        filteredRequests.forEach(req => {
            const dataPrazo = new Date(req.prazo_data).toLocaleDateString('pt-BR');
            
            // Responsável
            let responsavel = 'Não atribuído';
            if (req.tarefa_atribuicoes && req.tarefa_atribuicoes.length > 0) {
                const attr = req.tarefa_atribuicoes[0];
                responsavel = attr.usuario_email || 'Desconhecido';
            }
            
            // Definição de Estilos por Status
            let rowClass = 'border-l-4 border-l-gray-300 hover:bg-gray-50'; // Padrão pendente
            let statusBadge = `<span class="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border border-gray-200 inline-block">Pendente</span>`;
            let actionsHtml = '';
            
            // Lógica de Cores e Ações baseada no Status
            if (req.status === 'em_andamento') {
                rowClass = 'border-l-4 border-l-orange-400 hover:bg-orange-50/30';
                statusBadge = `<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border border-orange-200 flex items-center gap-1 w-fit"><i class="fas fa-spinner fa-spin text-[10px]"></i> Em Andamento</span>`;
                
            } else if (req.status === 'solicitacao_prazo') {
                rowClass = 'border-l-4 border-l-yellow-400 hover:bg-yellow-50/30';
                
                // Formatar prazo solicitado
                let prazoSolStr = 'Data inválida';
                let prazoSolRaw = null;
                if (req.prazo_solicitado) {
                    const d = new Date(req.prazo_solicitado);
                    prazoSolStr = d.toLocaleDateString('pt-BR');
                    prazoSolRaw = req.prazo_solicitado;
                }
                
                statusBadge = `<span class="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border border-yellow-200 flex items-center gap-1 w-fit"><i class="fas fa-clock"></i> Prazo Solicitado: ${prazoSolStr}</span>`;
                
                actionsHtml = `
                    <div class="flex items-center gap-2 mt-2 md:mt-0">
                        <button onclick="approveDeadline('${req.id}', '${prazoSolRaw}')" class="bg-green-100 hover:bg-green-200 text-green-700 text-xs font-bold py-1.5 px-3 rounded transition-colors flex items-center gap-1" title="Aceitar Prazo">
                            <i class="fas fa-check"></i> Aceitar
                        </button>
                         <button onclick="openEditTaskModal('${req.id}')" class="bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs font-bold py-1.5 px-3 rounded transition-colors flex items-center gap-1" title="Novo Prazo">
                            <i class="fas fa-calendar-alt"></i> Negociar
                        </button>
                    </div>
                `;
                
            } else if (req.status === 'concluido' || req.status === 'concluida') {
                rowClass = 'border-l-4 border-l-green-500 hover:bg-green-50/30';
                statusBadge = `<span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide border border-green-200 flex items-center gap-1 w-fit"><i class="fas fa-check-circle"></i> Concluído</span>`;
                
                const hasLink = req.link_arquivos && req.link_arquivos.length > 0;
                
                if (hasLink) {
                    actionsHtml = `
                        <button onclick="window.open('${req.link_arquivos}', '_blank')" class="mt-2 md:mt-0 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded shadow-sm hover:shadow transition-all flex items-center gap-2">
                            <i class="fas fa-download"></i> Baixar
                        </button>
                    `;
                } else {
                     actionsHtml = `
                        <span class="mt-2 md:mt-0 text-[10px] text-gray-400 italic flex items-center"><i class="fas fa-info-circle mr-1"></i> Sem link</span>
                    `;
                }
            } else {
                // Pendente Ações
                actionsHtml = `
                    <button onclick="openTransferModal('${req.id}')" class="mt-2 md:mt-0 text-gray-400 hover:text-primary text-xs font-medium transition-colors flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded">
                        <i class="fas fa-exchange-alt"></i> Reatribuir
                    </button>
                `;
            }

            // HTML do Item (Estilo Lista Flutuante Horizontal)
            const item = document.createElement('div');
            item.className = `bg-white rounded-lg shadow-sm border border-gray-200 p-4 transition-all flex flex-col md:flex-row md:items-center gap-4 ${rowClass} mb-3`;
            
            item.innerHTML = `
                <!-- Coluna 1: Info Principal -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            <i class="fas fa-briefcase text-gray-300"></i> ${req.clientes?.nome_fantasia || 'Sem Cliente'}
                        </span>
                        ${statusBadge}
                    </div>
                    <h3 class="font-bold text-gray-800 text-sm leading-tight truncate" title="${req.titulo}">${req.titulo}</h3>
                    <p class="text-xs text-gray-500 mt-1 line-clamp-1" title="${req.copy_legenda || ''}">${req.copy_legenda || 'Sem descrição detalhada'}</p>
                </div>

                <!-- Coluna 2: Detalhes Secundários -->
                <div class="flex items-center gap-4 text-xs text-gray-500 md:border-l md:border-gray-100 md:pl-4 md:w-1/3">
                    <div class="flex flex-col gap-1">
                        <span class="flex items-center gap-1.5" title="Prazo"><i class="far fa-calendar text-gray-400 w-4"></i> ${dataPrazo}</span>
                        <span class="flex items-center gap-1.5" title="Responsável"><i class="far fa-user-circle text-gray-400 w-4"></i> <span class="truncate max-w-[120px]">${responsavel}</span></span>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="flex items-center gap-1.5" title="Etapa"><i class="fas fa-layer-group text-gray-400 w-4"></i> ${req.etapa_funil || '-'}</span>
                    </div>
                </div>

                <!-- Coluna 3: Ações -->
                <div class="flex items-center justify-end md:w-auto">
                    ${actionsHtml}
                </div>
            `;
            
            container.appendChild(item);
        });
        
    } catch (e) {
        console.error('Erro ao carregar solicitações:', e);
        container.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-12 text-gray-400">
                <i class="fas fa-exclamation-circle text-4xl mb-3 text-red-300"></i>
                <span class="text-lg font-medium text-gray-500">Erro ao carregar</span>
                <span class="text-sm text-gray-400">${e.message}</span>
            </div>
        `;
    }
}

// --- Funções de Ação ---

window.approveDeadline = async function(taskId, newDateIso) {
    if (!confirm('Aceitar o novo prazo solicitado?')) return;
    
    try {
        const { error } = await window.supabaseClient
            .from('tarefas')
            .update({
                prazo_data: newDateIso,
                status: 'em_andamento', // Volta para em andamento ou mantém? Geralmente aceitar prazo significa que o trabalho continua
                prazo_solicitado: null // Limpa a solicitação
            })
            .eq('id', taskId);
            
        if (error) throw error;
        
        alert('Novo prazo aceito com sucesso!');
        loadCreativeRequests();
        
    } catch (e) {
        console.error('Erro ao aceitar prazo:', e);
        alert('Erro ao atualizar prazo: ' + e.message);
    }
}

window.openTransferModal = async function(taskId) {
    const modal = document.getElementById('transfer-modal');
    if (!modal) return;
    
    document.getElementById('transfer-task-id').value = taskId;
    const select = document.getElementById('transfer-colaborador');
    select.innerHTML = '<option value="">Carregando...</option>';
    
    modal.classList.remove('hidden');
    modal.classList.add('flex'); // Centralizar flex
    
    // Carregar Colaboradores (Reusando lógica similar do create modal, mas focando em Social Media)
    try {
        const { data: colabs, error } = await window.supabaseClient
            .from('colaboradores')
            .select('id, nome, email, permissoes, perfil_acesso'); // Sem filtrar ativo para simplificar por enquanto, ou filtrar client-side

        if (error) throw error;
        
        select.innerHTML = '<option value="">Selecione...</option>';
        
        if (colabs) {
             const filtered = colabs.filter(c => {
                 const isSuper = c.perfil_acesso === 'super_admin';
                 const isAdmin = c.perfil_acesso === 'admin';
                 const hasPerm = c.permissoes && Array.isArray(c.permissoes) && c.permissoes.includes('social_media');
                 return isSuper || isAdmin || hasPerm;
             });

             filtered.forEach(u => {
                 const opt = document.createElement('option');
                 opt.value = u.email; // Usamos Email para a tabela tarefa_atribuicoes
                 opt.textContent = u.nome || u.email;
                 select.appendChild(opt);
             });
        }
    } catch (e) {
        console.error(e);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

window.confirmTransfer = async function() {
    const taskId = document.getElementById('transfer-task-id').value;
    const newEmail = document.getElementById('transfer-colaborador').value;
    
    if (!taskId || !newEmail) {
        alert('Selecione um colaborador.');
        return;
    }
    
    try {
        // 1. Remover atribuições anteriores (se houver, ou apenas adicionar nova?) 
        // Geralmente em tasks simples trocamos o responsável. Vamos limpar e adicionar.
        await window.supabaseClient.from('tarefa_atribuicoes').delete().eq('tarefa_id', taskId);
        
        // 2. Adicionar nova
        const { error } = await window.supabaseClient
            .from('tarefa_atribuicoes')
            .insert({
                tarefa_id: taskId,
                usuario_email: newEmail
            });
            
        if (error) throw error;
        
        // 3. Opcional: Se estava em solicitação de prazo e foi transferido, limpar solicitação?
        // Vamos manter o status, mas o novo responsável decidirá.
        
        document.getElementById('transfer-modal').classList.add('hidden');
        alert('Tarefa transferida com sucesso!');
        loadCreativeRequests();
        
    } catch (e) {
        console.error('Erro ao transferir:', e);
        alert('Erro ao transferir: ' + e.message);
    }
}

// Reuso de modal de edição de tarefa existente em tarefas.js? 
// Se não estiver acessível, podemos redirecionar para tarefas.html
window.openEditTaskModal = function(taskId) {
    // Redireciona para tela de tarefas abrindo o modal
    window.location.href = `tarefas.html?open_task=${taskId}`;
}

// Inicializar quando a aba for trocada para 'solicitacoes'
// Adiciona hook na função switchTab global se possível, ou usa MutationObserver
// Como switchTab está no HTML/app.js, podemos sobrescrevê-la ou adicionar listener
const originalSwitchTab = window.switchTab;
window.switchTab = function(tabId) {
    if (originalSwitchTab) originalSwitchTab(tabId);
    if (tabId === 'solicitacoes') {
        loadCreativeRequests();
    }
}
