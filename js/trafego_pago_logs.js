// ... (existing code)

// Helper para formatar duração
function formatDuration(ms) {
    if (!ms || ms < 0) return '0m';
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    let parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    
    return parts.join(' ') || 'Menos de 1m';
}

// --- DIÁRIO DE BORDO ---

window.loadTrafficLogs = async function(clientIdOverride = null, containerId = null, typeFilter = null) {
    let targetContainer = document.getElementById(containerId) || document.getElementById('logs-table-body');
    // Fallback para lista se tabela não existir
    if (!targetContainer) targetContainer = document.getElementById('timeline-container'); // PRIORIDADE: Timeline Container
    if (!targetContainer) targetContainer = document.getElementById('traffic-logs-list');

    const isTable = targetContainer && targetContainer.tagName === 'TBODY';

    const activeClientId = typeof window.getActiveClientId === 'function' ? window.getActiveClientId() : '';
    const clienteId = clientIdOverride || activeClientId || document.getElementById('filter-cliente')?.value;
    const statusFilter = document.getElementById('filter-status-log')?.value;
    const prioridadeFilter = document.getElementById('filter-prioridade-log')?.value;

    if (!targetContainer) return;

    // Loading State
    if (isTable) {
        targetContainer.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando registros...</td></tr>`;
    } else {
        targetContainer.innerHTML = `<div class="p-8 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando...</div>`;
    }

    try {
        // 1. Mapa de Clientes
        const { data: clientesData } = await window.supabaseClient.from('clientes').select('id, nome_fantasia, nome_empresa');
        const mapaClientes = {};
        if (clientesData) clientesData.forEach(c => mapaClientes[c.id] = c.nome_fantasia || c.nome_empresa);

        // 2. Query
        let query = window.supabaseClient.from('traffic_logs').select('*').order('created_at', { ascending: false });

        if (clienteId) query = query.eq('cliente_id', clienteId);
        if (statusFilter) query = query.eq('status', statusFilter);
        if (prioridadeFilter) query = query.eq('prioridade', prioridadeFilter);
        if (typeFilter) query = query.eq('tipo_alteracao', typeFilter);

        const { data: logs, error } = await query;
                if (error) throw error;

                window.currentTrafficLogs = logs;
                targetContainer.innerHTML = '';

                if (!logs || logs.length === 0) {
                    const msg = 'Nenhum registro encontrado.';
                    targetContainer.innerHTML = isTable 
                        ? `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500 italic">${msg}</td></tr>`
                        : `<div class="p-4 text-gray-500 italic">${msg}</div>`;
                    return;
                }

                logs.forEach(log => {
                    const nomeCliente = mapaClientes[log.cliente_id] || 'Cliente Desconhecido';
                    const dataCriacao = new Date(log.created_at);
                    const dataFormatada = dataCriacao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                    
                    // Cores baseadas no Status
                    let statusClass = '';
                    let rowClass = 'hover:bg-gray-50'; // Padrão
                    
                    if (log.status === 'feito' || log.status === 'concluido') {
                        statusClass = 'bg-green-100 text-green-700 border border-green-200';
                        rowClass = 'bg-green-50/50 hover:bg-green-50'; 
                    } else if (log.status === 'acompanhando' || log.status === 'em_andamento') {
                        statusClass = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                        rowClass = 'bg-yellow-50/50 hover:bg-yellow-50'; 
                    } else { // Pendente (ou null)
                        statusClass = 'bg-red-100 text-red-700 border border-red-200';
                        rowClass = 'bg-red-50/50 hover:bg-red-50';
                    }

                    // Prioridade Badge
                    let prioridadeClass = 'bg-gray-100 text-gray-700 border border-gray-200';
                    if (log.prioridade === 'alta') prioridadeClass = 'bg-red-100 text-red-700 border border-red-200 font-bold';
                    else if (log.prioridade === 'media') prioridadeClass = 'bg-blue-100 text-blue-700 border border-blue-200';
                    else if (log.prioridade === 'baixa') prioridadeClass = 'bg-green-100 text-green-700 border border-green-200';

                    // Formatar prazo
                    const prazoFormatado = log.prazo ? new Date(log.prazo).toLocaleDateString('pt-BR') : '-';
                    
                    // Informações de Duração e Datas
                    let durationInfo = '';
                    if ((log.status === 'feito' || log.status === 'concluido') && log.duration) {
                         durationInfo = `<div class="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100" title="Duração Total"><i class="fas fa-stopwatch mr-1"></i> ${log.duration}</div>`;
                    }

                    if (isTable) {
                        const tr = document.createElement('tr');
                        tr.className = `${rowClass} transition-colors border-b border-white`; 

                        tr.innerHTML = `
                            <td class="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                <div class="flex flex-col gap-1">
                                    <div title="Data de Criação">
                                        <i class="far fa-calendar-plus text-gray-400 text-xs mr-1"></i> ${dataFormatada}
                                    </div>
                                    ${log.prazo ? `
                                    <div title="Prazo de Conclusão" class="${new Date(log.prazo) < new Date() && log.status !== 'feito' && log.status !== 'concluido' ? 'text-red-600 font-bold' : ''}">
                                        <i class="far fa-calendar-check text-gray-400 text-xs mr-1"></i> ${prazoFormatado}
                                    </div>` : ''}
                                    ${durationInfo}
                                </div>
                            </td>
                            <td class="px-6 py-4 text-sm font-medium text-gray-900">${nomeCliente}</td>
                            <td class="px-6 py-4">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize border border-gray-200">
                                    ${log.tipo_alteracao || '-'}
                                </span>
                            </td>
                            <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title="${log.descricao || ''}">
                                ${log.descricao || '-'}
                            </td>
                            <td class="px-6 py-4">
                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${prioridadeClass} capitalize">
                                    ${log.prioridade || 'media'}
                                </span>
                            </td>
                            <td class="px-6 py-4">
                                <div class="flex flex-col gap-1">
                                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass} capitalize">
                                        ${log.status === 'concluido' ? 'Concluído' : (log.status === 'em_andamento' ? 'Em andamento' : (log.status || 'pendente'))}
                                    </span>
                                </div>
                            </td>
                            <td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                                <button onclick="openEditTrafficLog('${log.id}')" class="text-primary hover:text-primary-hover mr-3 transition-colors" title="Ver/Editar">
                                    <i class="fas ${(log.status === 'feito' || log.status === 'concluido') ? 'fa-eye' : 'fa-edit'}"></i>
                                </button>
                                <button onclick="deleteTrafficLog('${log.id}')" class="text-red-600 hover:text-red-900 transition-colors" title="Excluir">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                        targetContainer.appendChild(tr);
                    } else {
                        // Fallback timeline (Visual "Card Row" estilo Registro de Cliente)
                        const item = document.createElement('div');
                        item.className = `bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row gap-4 items-start transition-all hover:shadow-md hover:border-gray-300 mb-3 group`;
                        
                        // Icon Color Logic
                        let iconBg = 'bg-blue-50 text-blue-600';
                        if (log.tipo_alteracao === 'criacao') iconBg = 'bg-green-50 text-green-600';
                        else if (log.tipo_alteracao === 'pausa') iconBg = 'bg-red-50 text-red-600';
                        else if (log.tipo_alteracao === 'analise') iconBg = 'bg-primary/5 text-primary';
                        
                        const iconMap = {
                            'otimizacao': 'fa-chart-line',
                            'criacao': 'fa-plus-circle',
                            'analise': 'fa-search',
                            'pausa': 'fa-pause-circle',
                            'escala': 'fa-rocket',
                            'Revisão de calendário': 'fa-calendar-check',
                            'Confecção de criativos': 'fa-paint-brush',
                            'ajustes de post': 'fa-edit',
                            'Artes Extras': 'fa-palette',
                            'Criação de Identidade': 'fa-fingerprint'
                        };
                        const icon = iconMap[log.tipo_alteracao] || 'fa-clipboard-list';

                        item.innerHTML = `
                            <div class="flex items-start gap-5 flex-1 w-full">
                                <!-- Icon Box -->
                                <div class="w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                                    <i class="fas ${icon} text-lg"></i>
                                </div>
                                
                                <!-- Content -->
                                <div class="flex-1 min-w-0 pt-1">
                                    <div class="flex flex-wrap items-center gap-2 mb-2">
                                        <span class="text-xs font-medium text-gray-400 flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md border border-gray-100" title="Data de Criação">
                                            <i class="far fa-clock"></i> ${dataFormatada}
                                        </span>
                                        <span class="px-2.5 py-1 rounded-md text-xs font-semibold ${statusClass} border border-transparent capitalize tracking-wide shadow-sm">${log.status === 'concluido' ? 'Concluído' : (log.status === 'em_andamento' ? 'Em andamento' : (log.status || 'pendente'))}</span>
                                        <span class="px-2.5 py-1 rounded-md text-xs font-semibold ${prioridadeClass} capitalize tracking-wide shadow-sm">${log.prioridade || 'media'}</span>
                                    </div>
                                    
                                    <h3 class="font-bold text-gray-900 text-lg mb-1.5 leading-snug flex items-center gap-2 flex-wrap">
                                        <span class="hover:text-primary transition-colors cursor-pointer" onclick="openEditTrafficLog('${log.id}')">${nomeCliente}</span>
                                        <i class="fas fa-chevron-right text-gray-300 text-xs mx-1"></i>
                                        <span class="text-primary capitalize font-bold bg-primary/5 px-2 py-0.5 rounded text-base">${log.tipo_alteracao}</span>
                                    </h3>
                                    
                                    <p class="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-2">${log.descricao || 'Sem descrição'}</p>
                                    
                                    <!-- Metadata Row -->
                                    <div class="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-gray-500 border-t border-gray-50 pt-3 mt-2">
                                        ${log.solicitante ? `
                                        <div class="flex items-center gap-2 group/meta">
                                            <div class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover/meta:bg-gray-200 transition-colors"><i class="fas fa-user text-[10px]"></i></div>
                                            <span class="font-medium text-gray-600">${log.solicitante}</span>
                                        </div>` : ''}

                                        ${log.link_criativo ? `
                                        <div class="flex items-center gap-2 group/meta">
                                            <div class="w-6 h-6 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 group-hover/meta:bg-purple-100 transition-colors"><i class="fas fa-link text-[10px]"></i></div>
                                            <a href="${log.link_criativo}" target="_blank" class="font-medium text-purple-600 hover:underline truncate max-w-[150px]">Criativo</a>
                                        </div>` : ''}
                                        
                                        <div class="flex items-center gap-2 group/meta ${new Date(log.prazo) < new Date() && log.status !== 'feito' && log.status !== 'concluido' ? 'text-red-600' : ''}">
                                            <div class="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover/meta:bg-gray-200 transition-colors"><i class="fas fa-calendar-day text-[10px]"></i></div>
                                            <span class="font-medium">Prazo: ${prazoFormatado}</span>
                                        </div>
                                        
                                        ${log.duration && (log.status === 'feito' || log.status === 'concluido') ? `
                                        <div class="flex items-center gap-2 group/meta text-blue-600">
                                            <div class="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 group-hover/meta:bg-blue-100 transition-colors"><i class="fas fa-stopwatch text-[10px]"></i></div>
                                            <span class="font-medium">Gastou: ${log.duration}</span>
                                        </div>` : ''}
                                    </div>
                                </div>
                            </div>

                            <!-- Right: Actions -->
                            <div class="flex flex-row md:flex-col items-center justify-end gap-2 w-full md:w-auto mt-4 md:mt-0 md:pl-4 md:border-l border-gray-100 md:self-stretch">
                                ${log.tarefa_id ? `
                                <button onclick="window.location.href='tarefas.html?open_task=${log.tarefa_id}'" class="w-full md:w-auto px-3 py-2 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-primary transition-all flex items-center justify-center gap-2 group/btn" title="Visualizar Tarefa Vinculada">
                                    <i class="fas fa-external-link-alt group-hover/btn:scale-110 transition-transform"></i> <span class="md:hidden lg:inline">Tarefa</span>
                                </button>
                                ` : ''}
                                
                                <div class="flex items-center gap-2 w-full md:w-auto justify-end">
                                    <button onclick="openEditTrafficLog('${log.id}')" class="flex-1 md:flex-none h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all shadow-sm hover:shadow" title="Editar">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteTrafficLog('${log.id}')" class="flex-1 md:flex-none h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all shadow-sm hover:shadow" title="Excluir">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                        targetContainer.appendChild(item);
                    }
                });

    } catch (e) {
        console.error('Erro ao carregar logs:', e);
        targetContainer.innerHTML = isTable 
            ? `<tr><td colspan="7" class="text-red-500 text-center py-4">Erro ao carregar dados.</td></tr>`
            : `<div class="text-red-500 text-center p-4">Erro ao carregar dados.</div>`;
    }
}

window.openTrafficLogModal = function(logDataOrType = null) {
    const modal = document.getElementById('traffic-log-modal');
    if (!modal) return;

    let logData = null;
    let initialType = 'otimizacao';

    if (typeof logDataOrType === 'string') {
        initialType = logDataOrType;
    } else if (logDataOrType && typeof logDataOrType === 'object') {
        logData = logDataOrType;
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('flex'); 
    
    // Title
    const titleEl = modal.querySelector('h3');
    if(titleEl) titleEl.innerHTML = logData ? '<i class="fas fa-edit text-primary"></i> Editar Registro' : '<i class="fas fa-pen-fancy text-primary"></i> Novo Registro';

    // Populate Clients
    const modalSelect = document.getElementById('log-cliente');
    if (modalSelect && modalSelect.options.length <= 1) {
        const mainFilter = document.getElementById('filter-cliente');
        if (mainFilter) {
            modalSelect.innerHTML = '<option value="">Selecione...</option>';
            Array.from(mainFilter.options).forEach((opt, index) => {
                if (index > 0) modalSelect.appendChild(opt.cloneNode(true));
            });
        }
    }

    // Reset Form
    const form = modal.querySelector('form');
    if(form) form.reset();

    // Populate Fields
    document.getElementById('log-id').value = logData ? logData.id : '';
    
    // Default Values
    if (logData) {
        if(document.getElementById('log-cliente')) document.getElementById('log-cliente').value = logData.cliente_id || '';
        if(document.getElementById('log-tipo')) document.getElementById('log-tipo').value = logData.tipo_alteracao || 'otimizacao';
        if(document.getElementById('log-status')) document.getElementById('log-status').value = logData.status || 'pendente';
        if(document.getElementById('log-prioridade')) document.getElementById('log-prioridade').value = logData.prioridade || 'media';
        if(document.getElementById('log-solicitante')) document.getElementById('log-solicitante').value = logData.solicitante || '';
        if(document.getElementById('log-descricao')) document.getElementById('log-descricao').value = logData.descricao || ''; 
        if(document.getElementById('log-acoes')) document.getElementById('log-acoes').value = logData.acoes_tomadas || '';
        if(document.getElementById('log-prazo')) document.getElementById('log-prazo').value = logData.prazo || '';
        if(document.getElementById('log-link')) document.getElementById('log-link').value = logData.link_criativo || '';
        
        if(document.getElementById('log-created-at')) {
            const date = new Date(logData.created_at);
            document.getElementById('log-created-at').value = date.toLocaleString('pt-BR');
        }

        // Somente Leitura se Feito
        const isDone = logData.status === 'feito' || logData.status === 'concluido';
        const inputs = form.querySelectorAll('input:not([type=hidden]), select, textarea');
        inputs.forEach(input => {
            if (isDone) {
                input.disabled = true;
                input.classList.add('bg-gray-100', 'cursor-not-allowed');
            } else {
                input.disabled = false;
                input.classList.remove('bg-gray-100', 'cursor-not-allowed');
                input.classList.add('bg-gray-50');
            }
        });
        
        const saveBtn = modal.querySelector('button[type="submit"]');
        if (saveBtn) {
            if (isDone) saveBtn.style.display = 'none';
            else saveBtn.style.display = 'block';
        }

    } else {
        // Novo
        if(document.getElementById('log-tipo')) document.getElementById('log-tipo').value = initialType;
        if(document.getElementById('log-created-at')) document.getElementById('log-created-at').value = new Date().toLocaleString('pt-BR');
        
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.disabled = false; 
            input.classList.remove('bg-gray-100', 'cursor-not-allowed');
        });
         if(document.getElementById('log-created-at')) document.getElementById('log-created-at').disabled = true; 
         
         const saveBtn = modal.querySelector('button[type="submit"]');
         if(saveBtn) saveBtn.style.display = 'block';
    }
}

window.closeTrafficLogModal = function() {
    const modal = document.getElementById('traffic-log-modal');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

window.openEditTrafficLog = function(id) {
    if (!window.currentTrafficLogs) return;
    const log = window.currentTrafficLogs.find(l => l.id == id);
    if (log) openTrafficLogModal(log);
}

window.submitTrafficLog = async function(event) {
    event.preventDefault();
    
    const id = document.getElementById('log-id').value;
    const clienteId = document.getElementById('log-cliente').value;
    
    if (!clienteId) {
        alert('Selecione um cliente.');
        return;
    }

    const data = {
        cliente_id: clienteId,
        tipo_alteracao: document.getElementById('log-tipo').value,
        status: document.getElementById('log-status').value,
        prioridade: document.getElementById('log-prioridade')?.value || 'media',
        solicitante: document.getElementById('log-solicitante')?.value || null,
        descricao: document.getElementById('log-descricao').value, 
        acoes_tomadas: document.getElementById('log-acoes')?.value || null,
        prazo: document.getElementById('log-prazo')?.value || null,
        link_criativo: document.getElementById('log-link')?.value || null,
    };

    // Lógica de Duração e Conclusão
    if (data.status === 'feito' || data.status === 'concluido') {
        let createdAt = null;
        if (id && window.currentTrafficLogs) {
             const existing = window.currentTrafficLogs.find(l => l.id == id);
             if (existing) createdAt = new Date(existing.created_at);
        } else if (!id) {
             createdAt = new Date(); 
        }

        if (createdAt) {
            const now = new Date();
            const diff = now - createdAt;
            data.duration = formatDuration(diff);
            data.completed_at = now.toISOString();
        }
    } else {
        // Se não estiver feito, limpa os dados de conclusão
        data.completed_at = null;
        data.duration = null;
    }

    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        let logResult;

        if (id) {
            // Update
            const res = await window.supabaseClient.from('traffic_logs').update(data).eq('id', id).select();
            if (res.error) throw res.error;
            logResult = res.data[0];
        } else {
            // Insert
            const res = await window.supabaseClient.from('traffic_logs').insert([data]).select();
            if (res.error) throw res.error;
            logResult = res.data[0];
            
            // Integração com Tarefas (Criar nova tarefa se novo log)
            if (user) {
                // Busca nome do cliente para o título
                const cliSel = document.getElementById('log-cliente');
                const cliNome = cliSel.options[cliSel.selectedIndex].text;

                const taskData = {
                    titulo: `[Diário] ${data.tipo_alteracao} - ${cliNome}`,
                    descricao: `Solicitação: ${data.descricao}\n\nSolicitante: ${data.solicitante || 'N/A'}\nPrioridade: ${data.prioridade}\nPrazo: ${data.prazo || 'N/A'}`,
                    status: 'pendente', 
                    cliente_id: clienteId,
                    criado_por: user.id, 
                    prazo_data: data.prazo ? new Date(data.prazo).toISOString() : null,
                    tipo: 'trafego' 
                };
                
                const taskRes = await window.supabaseClient.from('tarefas').insert([taskData]).select();
                if (!taskRes.error && taskRes.data) {
                    await window.supabaseClient.from('traffic_logs').update({ tarefa_id: taskRes.data[0].id }).eq('id', logResult.id);
                }
            }
        }

        closeTrafficLogModal();
        window.loadTrafficLogs(null, null, null); 
        alert('Registro salvo com sucesso!');

    } catch (e) {
        console.error('Erro ao salvar:', e);
        alert('Erro ao salvar registro: ' + e.message);
    }
}

window.deleteTrafficLog = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este registro? Se houver uma tarefa vinculada, ela também será excluída.')) return;
    
    try {
        // 1. Buscar o log para verificar se tem tarefa vinculada
        const { data: log, error: fetchError } = await window.supabaseClient
            .from('traffic_logs')
            .select('tarefa_id')
            .eq('id', id)
            .single();
        
        if (fetchError) throw fetchError;

        // 2. Excluir o log PRIMEIRO (para evitar erro de Foreign Key se não for Cascade)
        const { error } = await window.supabaseClient.from('traffic_logs').delete().eq('id', id);
        if (error) throw error;

        // 3. Se tiver tarefa vinculada, excluir a tarefa
        if (log && log.tarefa_id) {
            const { error: taskError } = await window.supabaseClient
                .from('tarefas')
                .delete()
                .eq('id', log.tarefa_id);
            
            if (taskError) {
                console.warn('Erro ao excluir tarefa vinculada:', taskError);
            }
        }
        
        window.loadTrafficLogs(null, null, null);
        alert('Registro excluído com sucesso.');
    } catch (e) {
        console.error(e);
        alert('Erro ao excluir: ' + e.message);
    }
}

window.loadWorklogs = async function() {
    const targetContainer = document.getElementById('logs-table-body');
    if (!targetContainer) return;

    targetContainer.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-400"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando registros...</td></tr>`;

    const clienteId = document.getElementById('filter-cliente')?.value || '';
    const statusFilter = document.getElementById('filter-status-log')?.value || '';
    const prioridadeFilter = document.getElementById('filter-prioridade-log')?.value || '';

    const select = document.getElementById('filter-cliente');
    const clientOptions = select ? Array.from(select.options).slice(1) : [];
    const clientIds = clienteId ? [clienteId] : clientOptions.map(opt => opt.value).filter(Boolean);
    const clientNameMap = clientOptions.reduce((acc, opt) => {
        acc[opt.value] = opt.textContent || opt.value;
        return acc;
    }, {});

    if (clientIds.length === 0) {
        targetContainer.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500 italic">Selecione um cliente para ver os registros.</td></tr>`;
        return;
    }

    try {
        const headers = await getWorklogAuthHeaders();
        const responses = await Promise.all(clientIds.map(async (id) => {
            const res = await fetch(`${window.API_BASE_URL}/api/worklogs?client_id=${encodeURIComponent(id)}&module=social_media`, {
                method: 'GET',
                headers
            });
            const json = await res.json().catch(() => []);
            if (!res.ok) {
                throw new Error(json?.error || 'Erro ao carregar worklogs');
            }
            return Array.isArray(json) ? json : [];
        }));

        let logs = responses.flat();
        if (statusFilter) logs = logs.filter(item => item.status === statusFilter);
        if (prioridadeFilter) logs = logs.filter(item => (item.priority || '').toLowerCase() === prioridadeFilter);

        logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        targetContainer.innerHTML = '';
        if (!logs.length) {
            targetContainer.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500 italic">Nenhum registro encontrado.</td></tr>`;
            return;
        }

        logs.forEach(log => {
            const dataCriacao = formatWorklogDateTime(log.created_at);
            const statusLabel = log.status === 'done' ? 'Concluído' : 'Em aberto';
            const statusClass = log.status === 'done'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-yellow-100 text-yellow-700 border border-yellow-200';

            let prioridadeClass = 'bg-gray-100 text-gray-700 border border-gray-200';
            if (log.priority === 'alta') prioridadeClass = 'bg-red-100 text-red-700 border border-red-200 font-bold';
            else if (log.priority === 'media') prioridadeClass = 'bg-blue-100 text-blue-700 border border-blue-200';
            else if (log.priority === 'baixa') prioridadeClass = 'bg-green-100 text-green-700 border border-green-200';

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 transition-colors border-b border-white';
            tr.innerHTML = `
                <td class="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">${dataCriacao}</td>
                <td class="px-6 py-4 text-sm font-medium text-gray-900">${clientNameMap[log.client_id] || 'Cliente Desconhecido'}</td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 capitalize border border-gray-200">
                        ${log.action_type || '-'}
                    </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title="${log.description || ''}">
                    ${log.description || '-'}
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-col gap-1">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClass} capitalize">
                            ${statusLabel}
                        </span>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${prioridadeClass} capitalize">
                            ${log.priority || 'media'}
                        </span>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">
                    ${log.requested_by_name || '-'}
                </td>
                <td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
                    <button onclick="openWorklogDetailModal('${log.id}')" class="text-primary hover:text-primary-hover transition-colors" title="Ver Detalhe">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            `;
            targetContainer.appendChild(tr);
        });
    } catch (e) {
        console.error('Erro ao carregar worklogs:', e);
        targetContainer.innerHTML = `<tr><td colspan="7" class="text-red-500 text-center py-4">Erro ao carregar dados.</td></tr>`;
    }
}

window.openWorklogModal = function() {
    const modal = document.getElementById('traffic-log-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const titleEl = modal.querySelector('h3');
    if (titleEl) titleEl.innerHTML = '<i class="fas fa-pen-fancy text-primary"></i> Novo Registro';

    const modalSelect = document.getElementById('log-cliente');
    if (modalSelect && modalSelect.options.length <= 1) {
        const mainFilter = document.getElementById('filter-cliente');
        if (mainFilter) {
            modalSelect.innerHTML = '<option value="">Selecione...</option>';
            Array.from(mainFilter.options).forEach((opt, index) => {
                if (index > 0) modalSelect.appendChild(opt.cloneNode(true));
            });
        }
    }

    const form = modal.querySelector('form');
    if (form) form.reset();

    if (document.getElementById('log-prioridade')) document.getElementById('log-prioridade').value = 'media';
    if (document.getElementById('log-created-at')) document.getElementById('log-created-at').value = new Date().toLocaleString('pt-BR');
}

window.closeWorklogModal = function() {
    const modal = document.getElementById('traffic-log-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

window.submitWorklog = async function(event) {
    event.preventDefault();

    const clienteId = document.getElementById('log-cliente')?.value;
    const actionType = document.getElementById('log-tipo')?.value;
    if (!clienteId || !actionType) {
        alert('Preencha cliente e tipo de ação.');
        return;
    }

    const payload = {
        client_id: clienteId,
        module: 'social_media',
        action_type: actionType,
        priority: document.getElementById('log-prioridade')?.value || 'media',
        requested_by_name: document.getElementById('log-solicitante')?.value || null,
        due_date: document.getElementById('log-prazo')?.value || null,
        creative_link: document.getElementById('log-link')?.value || null,
        description: document.getElementById('log-descricao')?.value || null
    };

    try {
        const headers = await getWorklogAuthHeaders();
        const res = await fetch(`${window.API_BASE_URL}/api/worklogs`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(json?.message || json?.error || 'Erro ao salvar worklog');
        }

        closeWorklogModal();
        await loadWorklogs();
        if (json?.id) {
            openWorklogDetailModal(json.id);
        }
        alert('Registro criado com sucesso.');
    } catch (e) {
        console.error('Erro ao salvar worklog:', e);
        alert('Erro ao salvar registro: ' + e.message);
    }
}

window.openWorklogDetailModal = async function(worklogId) {
    const modal = document.getElementById('worklog-detail-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    window.currentWorklogId = worklogId;
    await loadWorklogDetail(worklogId);
}

window.closeWorklogDetailModal = function() {
    const modal = document.getElementById('worklog-detail-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function loadWorklogDetail(worklogId) {
    if (!worklogId) return;
    const headers = await getWorklogAuthHeaders();
    const res = await fetch(`${window.API_BASE_URL}/api/worklogs/${encodeURIComponent(worklogId)}`, {
        method: 'GET',
        headers
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
        alert(json?.error || 'Erro ao carregar detalhe do diário');
        return;
    }
    window.currentWorklogDetail = json || null;
    renderWorklogDetail(json);
}

async function renderWorklogDetail(data) {
    const worklog = data?.worklog || {};
    const actions = Array.isArray(data?.actions) ? data.actions : [];

    const select = document.getElementById('filter-cliente');
    const clientName = getClientNameFromSelect(worklog.client_id, select);
    const createdAt = formatWorklogDateTime(worklog.created_at);
    const dueDate = formatWorklogDate(worklog.due_date);
    const statusLabel = worklog.status === 'done' ? 'Concluído' : 'Em aberto';
    const duration = worklog.status === 'done' ? formatWorklogDuration(worklog.duration_seconds) : '-';
    const createdBy = await resolveWorklogCreatedBy(worklog.created_by);

    setText('worklog-detail-cliente', clientName || '-');
    setText('worklog-detail-tipo', worklog.action_type || '-');
    setText('worklog-detail-prioridade', worklog.priority || '-');
    setText('worklog-detail-prazo', dueDate);
    setText('worklog-detail-criado-por', createdBy || '-');
    setText('worklog-detail-criado-em', createdAt);
    setText('worklog-detail-status', statusLabel);
    setText('worklog-detail-duracao', duration);

    const list = document.getElementById('worklog-actions-list');
    if (list) {
        list.innerHTML = '';
        if (!actions.length) {
            list.innerHTML = '<div class="text-sm text-gray-500 italic">Nenhuma ação registrada.</div>';
        } else {
            actions.forEach(action => {
                const item = document.createElement('div');
                item.className = 'bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2';
                const actionDate = formatWorklogDateTime(action.created_at);
                item.innerHTML = `
                    <div class="flex items-center justify-between text-xs text-gray-400">
                        <span>${actionDate}</span>
                        <span>${action.created_by || ''}</span>
                    </div>
                    <div class="text-sm text-gray-700">${action.note || '-'}</div>
                `;
                list.appendChild(item);
            });
        }
    }

    const form = document.getElementById('worklog-actions-form');
    if (form) {
        if (worklog.status === 'open') {
            form.classList.remove('hidden');
            const noteInput = document.getElementById('worklog-action-note');
            if (noteInput) noteInput.disabled = false;
        } else {
            form.classList.add('hidden');
        }
    }
}

window.submitWorklogAction = async function() {
    const worklogId = window.currentWorklogId;
    if (!worklogId) return;
    const noteInput = document.getElementById('worklog-action-note');
    const note = noteInput ? noteInput.value.trim() : '';
    if (!note) {
        alert('Descreva a ação antes de enviar.');
        return;
    }

    try {
        const headers = await getWorklogAuthHeaders();
        const res = await fetch(`${window.API_BASE_URL}/api/worklogs/${encodeURIComponent(worklogId)}/actions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ note })
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(json?.message || json?.error || 'Erro ao adicionar ação');
        }
        if (noteInput) noteInput.value = '';
        await loadWorklogDetail(worklogId);
        await loadWorklogs();
    } catch (e) {
        console.error('Erro ao adicionar ação:', e);
        alert('Erro ao adicionar ação: ' + e.message);
    }
}

window.closeWorklog = async function() {
    const worklogId = window.currentWorklogId;
    if (!worklogId) return;
    try {
        const headers = await getWorklogAuthHeaders();
        const res = await fetch(`${window.API_BASE_URL}/api/worklogs/${encodeURIComponent(worklogId)}/close`, {
            method: 'POST',
            headers
        });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
            throw new Error(json?.message || json?.error || 'Erro ao concluir worklog');
        }
        await loadWorklogDetail(worklogId);
        await loadWorklogs();
        alert('Worklog concluído.');
    } catch (e) {
        console.error('Erro ao concluir worklog:', e);
        alert('Erro ao concluir: ' + e.message);
    }
}

async function getWorklogAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const sessionResult = await window.supabaseClient?.auth?.getSession();
    const token = sessionResult?.data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function formatWorklogDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatWorklogDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR');
}

function formatWorklogDuration(seconds) {
    const total = Number(seconds);
    if (!Number.isFinite(total) || total < 0) return '-';
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);
    const pad = (val) => String(val).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function getClientNameFromSelect(clientId, select) {
    if (!clientId || !select) return '';
    const opt = Array.from(select.options).find(o => String(o.value) === String(clientId));
    return opt ? opt.textContent : '';
}

async function resolveWorklogCreatedBy(createdBy) {
    if (!createdBy) return '';
    const sessionResult = await window.supabaseClient?.auth?.getSession();
    const currentId = sessionResult?.data?.session?.user?.id;
    if (currentId && currentId === createdBy) return 'Você';
    return createdBy;
}
