// Checklist Module

window.loadChecklist = async function(clientIdOverride = null) {
    const list = document.getElementById('checklist-container');
    const clienteId = clientIdOverride || document.getElementById('filter-cliente')?.value;
    // We can add filters for status later if needed, but for now user didn't explicitly ask for filter bar on checklist page, 
    // but the layout should match "Diário de Bordo" which has filters. I'll stick to the basic list first.

    if (!list) return;

    list.innerHTML = `
        <div style="text-align: center; color: #999; padding: 40px; grid-column: 1/-1;">
            <i class="fas fa-spinner fa-spin fa-2x"></i>
            <p style="margin-top: 10px;">Carregando checklist...</p>
        </div>
    `;

    try {
        // 1. Carregar mapa de clientes
        const { data: clientesData } = await window.supabaseClient
            .from('clientes')
            .select('id, nome_empresa, nome_fantasia');
        
        const mapaClientes = {};
        if (clientesData) {
            clientesData.forEach(c => mapaClientes[c.id] = c.nome_fantasia || c.nome_empresa);
        }

        // 2. Query Principal
        let query = window.supabaseClient
            .from('traffic_checklist') // Assuming table name
            .select('*')
            .order('created_at', { ascending: false });

        if (clienteId) query = query.eq('cliente_id', clienteId);

        const { data: items, error } = await query;

        if (error) {
            // Fallback if table doesn't exist or has different name, try 'checklist'
            console.warn('Erro ao carregar traffic_checklist, tentando checklist...', error);
            // logic to try another table could go here, but I'll assume traffic_checklist for now based on the SQL file.
            throw error;
        }

        // Save for editing
        window.currentChecklistItems = items;

        list.innerHTML = '';
        if (!items || items.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #999; grid-column: 1/-1;">
                    <i class="fas fa-tasks fa-3x" style="margin-bottom: 15px;"></i>
                    <p>Nenhum item no checklist.</p>
                </div>
            `;
            return;
        }

        items.forEach(item => {
            const nomeCliente = mapaClientes[item.cliente_id] || 'Cliente Desconhecido';
            
            // Status colors
            let statusLabel = item.status || 'A fazer';
            let statusColor = '#6c757d'; 
            let statusBg = '#e2e3e5';
            
            switch(item.status) {
                case 'a_fazer':
                    statusLabel = 'A Fazer';
                    statusColor = '#dc3545'; // Vermelho/Cinza escuro
                    statusBg = '#f8d7da';
                    break;
                case 'em_andamento':
                    statusLabel = 'Em Andamento';
                    statusColor = '#fd7e14'; // Laranja
                    statusBg = '#fff3cd';
                    break;
                case 'acompanhando':
                    statusLabel = 'Acompanhando';
                    statusColor = '#17a2b8'; // Azul
                    statusBg = '#d1ecf1';
                    break;
                case 'concluido':
                    statusLabel = 'Concluído';
                    statusColor = '#28a745'; // Verde
                    statusBg = '#d4edda';
                    break;
                default:
                    statusLabel = item.status;
            }

            // Dates
            const dataCriacao = item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '-';
            const prazo = item.prazo ? new Date(item.prazo).toLocaleDateString('pt-BR') : '-';

            // Tailwind Card
            const card = document.createElement('div');
            card.className = `bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-col gap-3 relative overflow-hidden transition-all hover:shadow-md`;
            
            // Border left color simulation
            const borderLeft = document.createElement('div');
            borderLeft.className = 'absolute left-0 top-0 bottom-0 w-1.5';
            borderLeft.style.backgroundColor = statusColor;
            card.appendChild(borderLeft);

            const content = document.createElement('div');
            content.className = 'pl-3 w-full'; // Spacing for border
            
            content.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-gray-800 text-base">${item.item || 'Item sem nome'}</h4>
                    <span class="px-2 py-1 rounded-full text-xs font-bold border" style="background-color: ${statusBg}; color: ${statusColor}; border-color: ${statusColor};">
                        ${statusLabel.toUpperCase()}
                    </span>
                </div>

                <div class="text-sm text-gray-500 mb-3 space-y-1">
                    <div class="flex items-center gap-2"><i class="fas fa-building w-4 text-center"></i> ${nomeCliente}</div>
                    <div class="flex items-center gap-2"><i class="fas fa-tag w-4 text-center"></i> ${item.categoria || '-'}</div>
                </div>

                <div class="bg-gray-50 p-3 rounded-lg text-sm text-gray-700 mb-3">
                    <span class="block font-semibold text-xs text-gray-400 mb-1 uppercase">Observações</span>
                    ${item.observacoes || 'Sem observações'}
                </div>

                <div class="flex justify-between items-center text-xs text-gray-400 border-t border-gray-100 pt-3">
                    <div class="flex gap-4">
                        <span><i class="fas fa-calendar-alt mr-1"></i> Criado: ${dataCriacao}</span>
                        <span><i class="fas fa-clock mr-1"></i> Prazo: ${prazo}</span>
                    </div>
                    <div class="flex gap-2">
                         <button onclick="deleteChecklistItem('${item.id}')" class="text-red-500 hover:text-red-700 transition-colors p-1" title="Excluir"><i class="fas fa-trash"></i></button>
                         <button onclick="openEditChecklist('${item.id}')" class="text-primary hover:text-primary/80 transition-colors p-1 font-medium flex items-center gap-1">
                            ${item.status === 'concluido' ? '<i class="fas fa-eye"></i> Visualizar' : '<i class="fas fa-edit"></i> Editar'}
                         </button>
                    </div>
                </div>
            `;
            
            card.appendChild(content);
            list.appendChild(card);
        });

    } catch (e) {
        console.error('Erro ao carregar checklist:', e);
        list.innerHTML = `
            <div style="color: #dc3545; text-align: center; padding: 20px; grid-column: 1/-1;">
                <p>Erro ao carregar checklist. Verifique o console.</p>
                <button onclick="loadChecklist()" class="btn btn-sm btn-outline-primary">Tentar Novamente</button>
            </div>
        `;
    }
};

window.openChecklistModal = function(itemData = null) {
    const modal = document.getElementById('checklistModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    const titleEl = modal.querySelector('h3');
    if(titleEl) titleEl.innerHTML = itemData ? (itemData.status === 'concluido' ? '<i class="fas fa-eye"></i> Visualizar Tarefa' : '<i class="fas fa-edit"></i> Editar Tarefa') : '<i class="fas fa-plus"></i> Nova Tarefa';

    // Populate Client Select
    const modalSelect = document.getElementById('check-cliente');
    if (modalSelect && modalSelect.options.length <= 1) {
        const mainFilter = document.getElementById('filter-cliente');
        if (mainFilter) {
            modalSelect.innerHTML = '<option value="">Selecione...</option>';
            Array.from(mainFilter.options).forEach((opt, index) => {
                if (index > 0) {
                    modalSelect.appendChild(opt.cloneNode(true));
                }
            });
        }
    }

    // Buttons visibility
    const btnSave = document.getElementById('btn-save-checklist');
    const btnComplete = document.getElementById('btn-complete-checklist');
    
    // Reset or Fill Data
    if (itemData) {
        document.getElementById('check-id').value = itemData.id;
        document.getElementById('check-cliente').value = itemData.cliente_id;
        document.getElementById('check-categoria').value = itemData.categoria || 'Tracking';
        document.getElementById('check-item').value = itemData.item || '';
        document.getElementById('check-prazo').value = itemData.prazo ? itemData.prazo.split('T')[0] : '';
        document.getElementById('check-data-criacao').value = itemData.created_at ? new Date(itemData.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
        document.getElementById('check-status').value = itemData.status || 'a_fazer';
        document.getElementById('check-obs').value = itemData.observacoes || '';

        // If completed, disable editing
        const isCompleted = itemData.status === 'concluido';
        const formElements = modal.querySelectorAll('input, select, textarea');
        formElements.forEach(el => {
            if(el.id !== 'check-data-criacao') { // keep readonly
                 el.disabled = isCompleted;
            }
        });

        if (isCompleted) {
            btnSave.style.display = 'none';
            btnComplete.style.display = 'none';
        } else {
            btnSave.style.display = 'inline-block';
            btnComplete.style.display = 'inline-block';
        }

    } else {
        // NEW
        document.getElementById('check-id').value = '';
        document.getElementById('check-cliente').value = document.getElementById('filter-cliente').value || '';
        document.getElementById('check-categoria').value = 'Tracking';
        document.getElementById('check-item').value = 'Pixel instalado';
        document.getElementById('check-prazo').value = '';
        document.getElementById('check-data-criacao').value = new Date().toLocaleDateString('pt-BR'); // Display only
        document.getElementById('check-status').value = 'a_fazer';
        document.getElementById('check-obs').value = '';

        // Enable all
        const formElements = modal.querySelectorAll('input, select, textarea');
        formElements.forEach(el => {
            if(el.id !== 'check-data-criacao') el.disabled = false;
        });
        
        btnSave.style.display = 'inline-block';
        btnComplete.style.display = 'inline-block';
    }
};

window.closeChecklistModal = function() {
    const modal = document.getElementById('checklistModal');
    if(modal) modal.style.display = 'none';
};

window.openEditChecklist = function(id) {
    if (!window.currentChecklistItems) return;
    const item = window.currentChecklistItems.find(i => i.id == id);
    if (item) {
        openChecklistModal(item);
    }
};

window.submitChecklist = async function(e, markCompleted = false) {
    if(e) e.preventDefault();
    
    const id = document.getElementById('check-id').value;
    const clienteId = document.getElementById('check-cliente').value;
    
    if (!clienteId) {
        alert('Por favor, selecione um cliente.');
        return;
    }

    const data = {
        cliente_id: clienteId,
        categoria: document.getElementById('check-categoria').value,
        item: document.getElementById('check-item').value,
        prazo: document.getElementById('check-prazo').value || null,
        status: markCompleted ? 'concluido' : document.getElementById('check-status').value,
        observacoes: document.getElementById('check-obs').value
    };

    try {
        let error;
        if (id) {
            const res = await window.supabaseClient
                .from('traffic_checklist')
                .update(data)
                .eq('id', id);
            error = res.error;
        } else {
            const res = await window.supabaseClient
                .from('traffic_checklist')
                .insert([data]);
            error = res.error;
        }

        if (error) throw error;

        closeChecklistModal();
        loadChecklist();
        alert(markCompleted ? 'Tarefa concluída com sucesso!' : 'Checklist salvo com sucesso!');

    } catch (e) {
        console.error('Erro ao salvar checklist:', e);
        alert('Erro ao salvar: ' + e.message);
    }
};

window.deleteChecklistItem = async function(id) {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    try {
        const { error } = await window.supabaseClient
            .from('traffic_checklist')
            .delete()
            .eq('id', id);

        if (error) throw error;

        loadChecklist();
        // alert('Item excluído com sucesso!'); // Optional feedback
    } catch (e) {
        console.error('Erro ao excluir item:', e);
        alert('Erro ao excluir: ' + e.message);
    }
};

// Aliases for HTML compatibility
window.addChecklistItem = function() {
    window.openChecklistModal();
};

window.saveChecklistItem = function(event) {
    window.submitChecklist(event);
};
