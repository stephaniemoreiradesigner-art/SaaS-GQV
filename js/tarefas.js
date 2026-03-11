document.addEventListener('DOMContentLoaded', async function() {
    // Auth já é verificado em app.js, não precisamos de checkAuth aqui
    await loadTasks();
    setupModalListeners();

    // Verificar se há solicitação para abrir tarefa via URL
    const urlParams = new URLSearchParams(window.location.search);
    const openTaskId = urlParams.get('open_task');
    if (openTaskId) {
        openViewTaskModal(openTaskId);
        // Limpar URL para não reabrir ao atualizar
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

let currentTasks = [];
let allCollaborators = [];
let calendar = null;
const currentUserId = localStorage.getItem('user_id'); // Assuming theme.js or login sets this
let currentUserEmail = null;

function normalizeTimesAccess(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => String(v));
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(v => String(v));
        } catch (e) {
            return [];
        }
    }
    return [];
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

async function loadTasks() {
    const isDemo =
        (typeof window.isDemoMode === 'function' ? window.isDemoMode() : String(localStorage.getItem('demo_mode')) === 'true')
        || !window.supabaseClient;

    if (isDemo) {
        const demoTasks = [
            { id: 1, titulo: 'Criar calendário de abril', cliente: 'Tekohá', status: 'pendente', prazo_data: '2026-03-20' },
            { id: 2, titulo: 'Revisar campanha Meta', cliente: 'UsePi', status: 'em_andamento', prazo_data: '2026-03-18' },
            { id: 3, titulo: 'Solicitar criativos', cliente: 'NeuroEduca', status: 'concluido', prazo_data: '2026-03-15' },
            { id: 4, titulo: 'Validar briefing do cliente', cliente: 'Tekohá', status: 'pendente', prazo_data: '2026-03-22' }
        ];

        currentTasks = demoTasks.map((t) => ({
            id: String(t.id),
            titulo: t.titulo,
            descricao: '',
            prazo_data: t.prazo_data,
            prazo_tipo: 'ate_dia',
            cliente_id: '',
            tipo: 'tarefa',
            criado_por: 'demo-user-001',
            status: t.status,
            clientes: { nome_empresa: t.cliente, nome_fantasia: t.cliente },
            tarefa_atribuicoes: []
        }));

        allCollaborators = [{
            id: 'demo-user-001',
            nome: localStorage.getItem('demo_user_name') || 'Stéphanie Demo',
            email: 'demo@gqv.com',
            times_acesso: [],
            perfil_acesso: 'admin'
        }];

        const select = document.getElementById('task-cliente');
        if (select) {
            const demos = typeof window.getDemoClients === 'function' ? window.getDemoClients() : [];
            select.innerHTML = '<option value="">Selecione o Cliente</option>';
            (Array.isArray(demos) ? demos : []).forEach((c) => {
                const opt = document.createElement('option');
                opt.value = String(c.id);
                opt.textContent = String(c.empresa || c.nome || '');
                select.appendChild(opt);
            });
        }

        renderTaskList();
        renderCalendar();
        const loading = document.getElementById('loading-screen');
        if (loading) loading.classList.add('hidden');
        return;
    }

    const loading = document.getElementById('loading-screen');
    if(loading) loading.classList.remove('hidden');
    
    try {
        const { data: authData } = await window.supabaseClient.auth.getUser();
        const authUser = authData?.user || null;
        currentUserEmail = authUser?.email ? normalizeEmail(authUser.email) : null;

        // 1. Carregar colaboradores para dropdowns
        const { data: collaborators, error: collaboratorsError } = await window.supabaseClient
            .from('colaboradores')
            .select('id, nome, email, ativo, times_acesso, perfil_acesso')
            .eq('ativo', true)
            .order('nome', { ascending: true });

        if (collaboratorsError) {
            const { data: users } = await window.supabaseClient
                .from('profiles')
                .select('id, full_name, email');
            allCollaborators = (users || []).map(u => ({
                id: u.id,
                nome: u.full_name,
                email: u.email,
                times_acesso: [],
                perfil_acesso: 'usuario'
            }));
        } else {
            allCollaborators = collaborators || [];
        }

        // 2. Carregar tarefas
        const statusFilter = document.getElementById('filter-status')?.value || 'all';
        
        let query = window.supabaseClient
            .from('tarefas')
            .select(`
                *,
                clientes (nome_empresa, nome_fantasia),
                tarefa_atribuicoes (usuario_email)
            `)
            .order('prazo_data', { ascending: true });
            
        if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        } else {
            // Se o filtro for "Todos", excluir os concluídos para limpar a tela e calendário
            // Eles só aparecerão se o usuário filtrar explicitamente por "Concluído"
            query = query.neq('status', 'concluido').neq('status', 'concluida');
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        const rawTasks = data || [];
        currentTasks = rawTasks.filter(task => {
            const createdBy = task.criado_por;
            const createdByText = normalizeEmail(createdBy);
            const isCreatorById = authUser?.id && String(createdBy) === String(authUser.id);
            const isCreatorByEmail = currentUserEmail && createdByText === currentUserEmail;
            const isAssignee = currentUserEmail && (task.tarefa_atribuicoes || []).some(a => normalizeEmail(a.usuario_email) === currentUserEmail);
            return isCreatorById || isCreatorByEmail || isAssignee;
        });
        
        renderTaskList();
        renderCalendar();
        
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        // Não mostrar alert intrusivo se for apenas falta de dados, mas mostrar erro no console
        // Se a tabela não existir, vai dar erro aqui.
        const container = document.getElementById('task-list-column');
        if(container) {
            const message = error && error.message ? error.message : 'Erro ao carregar. Verifique o banco de dados.';
            container.innerHTML = `<div class="p-4 text-center text-red-500">${message}</div>`;
        }
    } finally {
        if(loading) loading.classList.add('hidden');
    }
}

function renderTaskList() {
    const container = document.getElementById('task-list-column');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (currentTasks.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fas fa-check-circle fa-2x mb-3"></i>
                <p>Nenhuma tarefa encontrada.</p>
            </div>
        `;
        return;
    }
    
    currentTasks.forEach(task => {
        const isCompleted = task.status === 'concluido' || task.status === 'concluida';
        const isLate = !isCompleted && new Date(task.prazo_data) < new Date();
        
        let statusColor = getTaskColor(task);
        let statusText = formatStatus(task.status);
        
        // Se for solicitação de prazo, mostrar a data solicitada
        if (task.status === 'solicitacao_prazo' && task.prazo_solicitado) {
             const dSol = new Date(task.prazo_solicitado);
             dSol.setMinutes(dSol.getMinutes() + dSol.getTimezoneOffset());
             statusText = `Solicitado: ${dSol.toLocaleDateString('pt-BR')}`;
        }
        
        // Lógica específica para texto de ajustes
        const isAdjustmentTask = task.post_id || (task.descricao && task.descricao.includes('Ajuste solicitado'));
        if (isAdjustmentTask && task.status === 'em_andamento') {
            statusText = 'Ajustes em andamento';
        }

        const card = document.createElement('div');
        card.className = `bg-white p-4 rounded-lg shadow-sm border-l-4 hover:shadow-md transition-shadow cursor-pointer mb-3`;
        card.style.borderLeftColor = statusColor;
        card.onclick = () => openViewTaskModal(task.id);
        
        const date = new Date(task.prazo_data);
        date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
        const dateStr = date.toLocaleDateString('pt-BR');
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-gray-800 line-clamp-2 text-sm">${task.titulo}</h4>
                ${task.tipo === 'reuniao' ? '<span class="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded"><i class="fas fa-video"></i></span>' : '<span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"><i class="fas fa-tasks"></i></span>'}
            </div>
            <div class="flex justify-between items-end text-xs text-gray-500">
                <div>
                    <p class="mb-1 truncate max-w-[150px]"><i class="far fa-building mr-1"></i> ${task.clientes?.nome_empresa || task.clientes?.nome_fantasia || 'Sem cliente'}</p>
                    <p class="${isLate ? 'text-red-500 font-bold' : ''}"><i class="far fa-calendar mr-1"></i> ${dateStr}</p>
                </div>
                <span class="px-2 py-1 rounded bg-gray-50 font-medium" style="color: ${statusColor}; border: 1px solid ${statusColor}20">
                    ${statusText}
                </span>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function renderCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    if (calendar) {
        updateCalendarEvents();
        return;
    }

    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        timeZone: 'UTC', // Garante que as datas sejam exibidas exatamente como no banco (sem conversão de fuso)
        height: '100%',
        headerToolbar: {
            left: 'prev,next',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        buttonText: {
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia'
        },
        events: getCalendarEvents(),
        eventClick: function(info) {
            openViewTaskModal(info.event.id);
        },
        eventContent: function(arg) {
            const color = arg.event.backgroundColor;
            return {
                html: `<div class="fc-content px-1 py-0.5 rounded overflow-hidden text-xs text-white" style="background-color: ${color}; border-left: 3px solid rgba(0,0,0,0.2);">
                        <div class="font-bold truncate">${arg.event.title}</div>
                       </div>`
            };
        }
    });

    calendar.render();
}

function getCalendarEvents() {
    return currentTasks.map(task => {
        let color = getTaskColor(task);
        
        // Lógica para ajustes em andamento no calendário (mantém compatibilidade com props extendidas)
        const isAdjustmentTask = task.post_id || (task.descricao && task.descricao.includes('Ajuste solicitado'));

        return {
            id: task.id,
            title: task.titulo,
            // Usa apenas a parte da data (YYYY-MM-DD) para garantir que fique no dia correto em modo UTC
            start: task.prazo_data.split('T')[0],
            allDay: true, // Força o evento a ser de dia inteiro 
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
                status: task.status,
                tipo: task.tipo,
                isAdjustment: isAdjustmentTask,
                descricao: task.descricao
            }
        };
    });
}

function updateCalendarEvents() {
    if (calendar) {
        calendar.removeAllEvents();
        calendar.addEventSource(getCalendarEvents());
    }
}

// --- Helpers ---

function getNextSunday(date) {
    const result = new Date(date);
    result.setDate(date.getDate() + (7 - date.getDay()));
    result.setHours(0, 0, 0, 0);
    // Se o dia já for domingo, pega o próximo (ou mantém se a lógica for "fim desta semana")
    // A regra diz: "naquela semana, às 00h do próximo domingo essa tarefa suma"
    // Se terminei na terça (04), domingo é (09).
    // Se terminei no domingo (09), o próximo é (16).
    if (date.getDay() === 0) {
        result.setDate(result.getDate() + 7);
    }
    return result;
}

function getTaskColor(task) {
    // 1. Verifica atraso (Vermelho tem prioridade para alertar usuário)
    if (task.status !== 'concluido' && task.status !== 'concluida' && new Date(task.prazo_data) < new Date()) {
        // Exceção: Se for ajuste ou aprovado, o usuário pediu cor específica "como está".
        // Mas atraso é crítico. Vou manter vermelho SE não for um desses tipos especiais que ele pediu explicitamente?
        // O usuário disse: "quando for ajuste traga a tarefa em laranja como está".
        // Isso sugere que a cor do TIPO é a identidade visual que ele quer.
        // Vou dar prioridade para a cor do TIPO. Se estiver atrasado, o texto da data na lista lateral já fica vermelho.
        // No calendário, a cor de fundo define o tipo.
        
        // Vamos verificar os tipos primeiro.
    }

    const titleLower = (task.titulo || '').toLowerCase();
    const descLower = (task.descricao || '').toLowerCase();

    // 2. Regra Post Aprovado -> Verde (#28a745) - PRIORIDADE ALTA
    if (task.status === 'aguardando_agendamento' || titleLower.includes('post aprovado') || titleLower.includes('agendar post')) {
        return '#28a745';
    }

    // 3. Regra Ajuste -> Laranja (#fd7e14)
    // Se tiver post_id mas NÃO for aprovado (já passou pelo if acima), então é ajuste ou outra coisa vinculada
    if (task.post_id || titleLower.includes('ajuste') || descLower.includes('ajuste solicitado')) {
        return '#fd7e14';
    }

    // 4. Se não for tipo especial, verifica atraso
    if (task.status !== 'concluido' && task.status !== 'concluida' && new Date(task.prazo_data) < new Date()) {
        return '#dc3545'; // Atrasada
    }

    // 5. Status Padrão
    return getColorForStatus(task.status);
}

function getColorForStatus(status) {
    switch (status) {
        case 'pendente': return '#ffc107'; // Amarelo
        case 'em_andamento': return '#fd7e14'; // Laranja
        case 'concluido': 
        case 'concluida': return '#28a745'; // Verde
        case 'solicitacao_prazo': return '#17a2b8'; // Azul
        case 'ajuste_solicitado': return '#fd7e14';
        case 'aguardando_agendamento': return '#0ea5e9';
        case 'atrasada': return '#dc3545'; // Vermelho
        default: return '#6c757d'; // Cinza
    }
}

function formatStatus(status) {
    switch (status) {
        case 'pendente': return 'Pendente';
        case 'em_andamento': return 'Em Andamento';
        case 'concluido': 
        case 'concluida': return 'Concluído';
        case 'solicitacao_prazo': return 'Prazo Solicitado';
        case 'ajuste_solicitado': return 'Ajuste Solicitado';
        case 'aguardando_agendamento': return 'Aguardando Agendamento';
        default: return status;
    }
}

function formatTipoHistorico(tipo) {
    switch(tipo) {
        case 'criacao': return 'Tarefa Criada';
        case 'atualizacao_status': return 'Mudança de Status';
        case 'comentario': return 'Comentário/Log';
        case 'solicitacao_prazo': return 'Solicitação de Prazo';
        default: return tipo;
    }
}

// --- Modais ---

function setupModalListeners() {
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });
}

window.openNewTaskModal = function() {
    const legacyModal = document.getElementById('newTaskModal');
    if (legacyModal) {
        legacyModal.classList.remove('hidden');
        loadClientesForSelect();
        return;
    }

    const createSection = document.getElementById('create-task-section');
    const listSection = document.getElementById('tasks-container');
    if (createSection) createSection.classList.remove('hidden');
    if (listSection) listSection.classList.add('hidden');
    initNewTaskForm();
}

window.closeNewTaskModal = function() {
    const legacyModal = document.getElementById('newTaskModal');
    if (legacyModal) {
        legacyModal.classList.add('hidden');
        return;
    }

    showTasksList();
}

window.showTasksList = function() {
    const createSection = document.getElementById('create-task-section');
    const listSection = document.getElementById('tasks-container');
    if (createSection) createSection.classList.add('hidden');
    if (listSection) listSection.classList.remove('hidden');
}

function initNewTaskForm() {
    const form = document.getElementById('form-nova-tarefa');
    if (form) form.reset();

    const tagsContainer = document.getElementById('selected-assignees-tags');
    if (tagsContainer) tagsContainer.innerHTML = '';
    selectedAssignees = [];

    const creationDate = document.getElementById('creation-date');
    if (creationDate) {
        creationDate.textContent = new Date().toLocaleDateString('pt-BR');
    }

    loadClientesForSelect();
    loadAssigneesForSelect();
    toggleTaskType();
    loadCreatorInfo();
}

async function loadCreatorInfo() {
    const creatorName = document.getElementById('creator-name');
    const creatorAvatar = document.getElementById('creator-avatar');
    if (!creatorName && !creatorAvatar) return;

    const isDemo = (typeof window.isDemoMode === 'function' ? window.isDemoMode() : String(localStorage.getItem('demo_mode')) === 'true') || !window.supabaseClient;
    if (isDemo) {
        const email = 'demo@gqv.com';
        if (creatorName) creatorName.textContent = email;
        if (creatorAvatar) creatorAvatar.src = 'assets/avatar-placeholder.png';
        return;
    }

    try {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        const email = session?.user?.email || '';

        if (creatorName) {
            creatorName.textContent = email || 'Usuário';
        }

        if (creatorAvatar) {
            creatorAvatar.src = 'assets/avatar-placeholder.png';
        }
    } catch (e) {
        if (creatorName) creatorName.textContent = 'Usuário';
    }
}

let selectedAssignees = [];

function loadAssigneesForSelect() {
    const select = document.getElementById('task-assignees-select');
    if (!select) return;
    select.innerHTML = '<option value="">Selecione um colaborador...</option>';

    let list = Array.isArray(allCollaborators) ? allCollaborators : [];
    if (!list.length) return;

    list.forEach(colab => {
        const email = colab.email || colab.usuario_email || '';
        if (!email) return;
        const opt = document.createElement('option');
        opt.value = email;
        opt.textContent = colab.full_name || colab.nome || email;
        select.appendChild(opt);
    });
}

window.addAssigneeFromSelect = function(selectEl) {
    if (!selectEl || !selectEl.value) return;
    const email = selectEl.value;
    if (selectedAssignees.includes(email)) {
        selectEl.value = '';
        return;
    }
    selectedAssignees.push(email);
    renderAssigneeTags();
    selectEl.value = '';
}

function renderAssigneeTags() {
    const container = document.getElementById('selected-assignees-tags');
    if (!container) return;
    container.innerHTML = '';
    selectedAssignees.forEach(email => {
        const tag = document.createElement('span');
        tag.className = 'inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-purple-100 text-purple-700';
        tag.textContent = email;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'text-purple-500 hover:text-purple-700';
        btn.innerHTML = '<i class="fas fa-times"></i>';
        btn.onclick = () => {
            selectedAssignees = selectedAssignees.filter(e => e !== email);
            renderAssigneeTags();
        };

        tag.appendChild(btn);
        container.appendChild(tag);
    });
}

window.toggleTaskType = function() {
    const meetingGroup = document.getElementById('meeting-time-group');
    if (!meetingGroup) return;
    const typeRadio = document.querySelector('input[name="task-type"]:checked');
    const isMeeting = typeRadio && typeRadio.value === 'reuniao';
    if (isMeeting) {
        meetingGroup.classList.remove('hidden');
    } else {
        meetingGroup.classList.add('hidden');
    }
}

window.submitNewTask = async function(event) {
    if (event && event.preventDefault) event.preventDefault();

    const titulo = document.getElementById('task-title')?.value?.trim() || '';
    const descricao = document.getElementById('task-description')?.value?.trim() || '';
    const prazoData = document.getElementById('task-prazo-data')?.value || '';
    const prazoTipo = document.getElementById('task-prazo-tipo')?.value || 'ate_dia';
    const clienteId = document.getElementById('task-cliente')?.value || null;
    const typeRadio = document.querySelector('input[name="task-type"]:checked');
    const tipo = typeRadio ? typeRadio.value : 'tarefa';
    const horarioReuniao = document.getElementById('task-meeting-time')?.value || null;

    if (!titulo || !prazoData || !clienteId) {
        alert('Preencha os campos obrigatórios.');
        return;
    }

    try {
        const { data: userData } = await window.supabaseClient.auth.getUser();
        const criadoPor = userData?.user?.id || null;

        const payload = {
            titulo,
            descricao,
            prazo_data: prazoData,
            prazo_tipo: prazoTipo,
            cliente_id: clienteId,
            tipo,
            criado_por: criadoPor,
            status: 'pendente',
            horario_reuniao: tipo === 'reuniao' ? horarioReuniao : null
        };

        const { data: created, error } = await window.supabaseClient
            .from('tarefas')
            .insert(payload)
            .select('id')
            .single();

        if (error) throw error;

        const tarefaId = created?.id;
        if (tarefaId && selectedAssignees.length > 0) {
            const assignments = selectedAssignees.map(email => ({
                tarefa_id: tarefaId,
                usuario_email: email
            }));
            const { error: assignError } = await window.supabaseClient
                .from('tarefa_atribuicoes')
                .insert(assignments);
            if (assignError) throw assignError;
        }

        alert('Tarefa criada com sucesso!');
        showTasksList();
        loadTasks();
    } catch (e) {
        console.error(e);
        alert('Erro ao criar tarefa: ' + (e?.message || ''));
    }
}

async function loadClientesForSelect() {
    const select = document.getElementById('task-cliente');
    if (!select || select.options.length > 1) return;

    const isDemo = (typeof window.isDemoMode === 'function' ? window.isDemoMode() : String(localStorage.getItem('demo_mode')) === 'true') || !window.supabaseClient;
    if (isDemo) {
        const demos = typeof window.getDemoClients === 'function' ? window.getDemoClients() : [];
        (Array.isArray(demos) ? demos : []).forEach((c) => {
            const opt = document.createElement('option');
            opt.value = String(c.id);
            opt.textContent = String(c.empresa || c.nome || '');
            select.appendChild(opt);
        });
        return;
    }

    const { data } = await window.supabaseClient.from('clientes').select('id, nome_fantasia');
    if (data) {
        data.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nome_fantasia;
            select.appendChild(opt);
        });
    }
}

window.createNewTask = async function() {
    const titulo = document.getElementById('task-titulo').value;
    const descricao = document.getElementById('task-descricao').value;
    const prazo = document.getElementById('task-prazo').value;
    const cliente = document.getElementById('task-cliente').value;
    const tipo = document.getElementById('task-tipo').value;
    
    if (!titulo || !prazo) {
        alert('Preencha os campos obrigatórios.');
        return;
    }

    const payload = {
        titulo,
        descricao,
        prazo_data: prazo,
        cliente_id: cliente || null,
        tipo: tipo,
        criado_por: (await window.supabaseClient.auth.getUser()).data.user?.id,
        status: 'pendente'
    };

    try {
        const { error } = await window.supabaseClient.from('tarefas').insert(payload);
        if (error) throw error;
        
        alert('Tarefa criada com sucesso!');
        closeNewTaskModal();
        loadTasks();
    } catch (e) {
        console.error(e);
        alert('Erro ao criar tarefa.');
    }
}

window.openViewTaskModal = async function(taskId) {
    const modal = document.getElementById('viewTaskModal');
    const content = document.getElementById('view-task-content');
    modal.classList.remove('hidden');
    content.innerHTML = '<div class="text-center p-5 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Carregando detalhes...</div>';
    
    const isDemo = (typeof window.isDemoMode === 'function' ? window.isDemoMode() : String(localStorage.getItem('demo_mode')) === 'true') || !window.supabaseClient;
    if (isDemo) {
        const task = currentTasks.find((t) => String(t.id) === String(taskId));
        if (!task) {
            content.innerHTML = '<p class="text-gray-500 text-center">Tarefa não encontrada.</p>';
            return;
        }
        const prazo = String(task.prazo_data || '').slice(0, 10);
        const clienteNome = task.clientes?.nome_empresa || task.clientes?.nome_fantasia || 'Sem cliente';
        content.innerHTML = `
            <h2 class="text-xl font-bold text-[var(--color-primary)] mb-3">${String(task.titulo || '')}</h2>
            <div class="space-y-2 text-sm text-gray-700">
                <div><span class="font-semibold">Cliente:</span> ${String(clienteNome).replace(/</g, '&lt;')}</div>
                <div><span class="font-semibold">Status:</span> ${String(task.status || '').toUpperCase()}</div>
                <div><span class="font-semibold">Prazo:</span> ${String(prazo).replace(/</g, '&lt;')}</div>
            </div>
        `;
        return;
    }

    try {
        const { data: task, error } = await window.supabaseClient
            .from('tarefas')
            .select(`
                *,
                clientes (nome_empresa, nome_fantasia),
                tarefa_atribuicoes (usuario_email)
            `)
            .eq('id', taskId)
            .single();
            
        if (error) throw error;
        
        const { data: history } = await window.supabaseClient
            .from('tarefa_historico')
            .select(`
                *,
                profiles:usuario_id (email)
            `)
            .eq('tarefa_id', taskId)
            .order('created_at', { ascending: false });

        renderTaskDetails(task, history);
        
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        content.innerHTML = '<p class="text-red-500 text-center">Erro ao carregar detalhes.</p>';
    }
}

window.closeViewTaskModal = function() {
    document.getElementById('viewTaskModal').classList.add('hidden');
}

function renderTaskDetails(task, history) {
    const content = document.getElementById('view-task-content');
    const isCompleted = task.status === 'concluido' || task.status === 'concluida';
    const user = JSON.parse(localStorage.getItem('sb-kvkrdpblsngoyzhsgoja-auth-token')); // Fallback to get user ID
    const currentUserId = user?.user?.id;
    const currentEmail = normalizeEmail(user?.user?.email);
    
    const d = new Date(task.prazo_data);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    const prazo = d.toLocaleDateString('pt-BR');
    
    let buttonsHtml = '';
    const createdByText = normalizeEmail(task.criado_por);
    const isCreator = (currentUserId && String(task.criado_por) === String(currentUserId)) || (currentEmail && createdByText === currentEmail);
    const isAssignee = currentEmail && (task.tarefa_atribuicoes || []).some(a => normalizeEmail(a.usuario_email) === currentEmail);
    
    // Lógica para exibir "Ajustes em andamento"
    const isAdjustmentTask = task.post_id || (task.descricao && task.descricao.includes('Ajuste solicitado'));
    let statusDisplay = formatStatus(task.status);
    if (isAdjustmentTask && task.status === 'em_andamento') {
        statusDisplay = 'Ajustes em andamento';
    }

    if (!isCompleted) {
        if (task.status === 'solicitacao_prazo') {
            const prazoSolicitado = task.prazo_solicitado ? new Date(task.prazo_solicitado).toLocaleDateString('pt-BR') : 'Data inválida';
            if (isCreator) {
                buttonsHtml += `
                    <div class="bg-yellow-50 p-3 rounded-md mb-3 border border-yellow-200">
                        <strong class="text-yellow-800">Solicitação de Prazo:</strong>
                        <div class="text-sm text-yellow-700 mt-1">Novo prazo solicitado: ${prazoSolicitado}</div>
                        <div class="mt-2 flex gap-2">
                            <button onclick="approveExtension('${task.id}')" class="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm">Aceitar Prazo</button>
                            <button onclick="openTransferModal('${task.id}')" class="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">Transferir Tarefa</button>
                        </div>
                    </div>
                `;
            } else {
                buttonsHtml += `
                    <div class="bg-yellow-50 p-3 rounded-md mb-3 border border-yellow-200">
                        <strong class="text-yellow-800">Prazo solicitado:</strong>
                        <div class="text-sm text-yellow-700 mt-1">Aguardando resposta do solicitante. Novo prazo: ${prazoSolicitado}</div>
                    </div>
                `;
            }
        } else {
            if (isAssignee) {
                buttonsHtml += `
                    <button onclick="updateTaskStatus('${task.id}', 'concluido')" class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 mr-2 mb-2">
                        <i class="fas fa-check mr-1"></i> Concluído
                    </button>
                `;

                if (task.status !== 'em_andamento') {
                    buttonsHtml += `
                        <button onclick="updateTaskStatus('${task.id}', 'em_andamento')" class="px-4 py-2 bg-[#ff7f0e] text-white rounded hover:opacity-90 mr-2 mb-2">
                            <i class="fas fa-play mr-1"></i> Em andamento
                        </button>
                    `;
                }

                if (!task.prazo_aprovado && task.status !== 'solicitacao_prazo') {
                    buttonsHtml += `
                        <button onclick="requestExtension('${task.id}')" class="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 mb-2">
                            <i class="fas fa-clock mr-1"></i> Solicitar Prazo
                        </button>
                    `;
                }
            }

            if (isCreator) {
                buttonsHtml += `
                    <button onclick="deleteTask('${task.id}')" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 mr-2 mb-2">
                        <i class="fas fa-trash mr-1"></i> Excluir
                    </button>
                `;
            }
        }
    }
    
    let meetingInfo = '';
    let meetingNotesHtml = '';
    
    if (task.tipo === 'reuniao') {
        if (task.horario_reuniao) {
            meetingInfo = `<p class="mb-2"><strong class="text-gray-700"><i class="far fa-clock"></i> Horário:</strong> ${task.horario_reuniao}</p>`;
        }
        
        meetingNotesHtml = `
            <div class="mt-5 pt-4 border-t border-gray-100">
                <h4 class="mb-2 font-medium text-gray-700"><i class="fas fa-sticky-note mr-1"></i> Anotações da Reunião</h4>
                <textarea id="meeting-notes-${task.id}" class="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent" rows="5" placeholder="Digite aqui a ata ou anotações da reunião...">${task.anotacoes_reuniao || ''}</textarea>
                <div class="mt-2 text-right">
                    <button onclick="saveMeetingNotes('${task.id}')" class="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded hover:opacity-90 text-sm">
                        <i class="fas fa-save mr-1"></i> Salvar Anotações
                    </button>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = `
        <h2 class="text-xl font-bold text-[var(--color-primary)] mb-1">${task.titulo}</h2>
        <div class="mb-5 text-gray-500 text-sm">
            Status: <span class="font-bold uppercase" style="color:${getColorForStatus(task.status)}">${statusDisplay}</span>
            ${task.tipo === 'reuniao' ? '<span class="ml-2 bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded text-xs">Reunião</span>' : ''}
        </div>
        
        <div class="bg-gray-50 p-4 rounded-lg mb-5 border border-gray-100">
            <p class="mb-2"><strong>Cliente:</strong> ${task.clientes?.nome_empresa || task.clientes?.nome_fantasia || 'N/A'}</p>
            <p class="mb-2"><strong>Prazo:</strong> ${task.prazo_tipo === 'ate_dia' ? 'Até' : 'Para'} ${prazo}</p>
            ${meetingInfo}
            <hr class="my-3 border-gray-200">
            <p class="whitespace-pre-wrap text-gray-700">${task.descricao || 'Sem descrição.'}</p>
            ${meetingNotesHtml}
            
            ${task.tipo === 'solicitacao_criativo' ? `
                <div class="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <h4 class="font-bold text-purple-800 mb-2"><i class="fas fa-paint-brush"></i> Detalhes do Criativo</h4>
                    <div class="grid grid-cols-1 gap-4 mb-3">
                        <div>
                            <span class="text-xs text-gray-500 uppercase font-bold">Etapa do Funil</span>
                            <p class="text-gray-800 font-medium">${task.etapa_funil || '-'}</p>
                        </div>
                    </div>
                    <div class="mb-3">
                         <span class="text-xs text-gray-500 uppercase font-bold">Copy / Legenda</span>
                         <div class="bg-white p-2 rounded border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">${task.copy_legenda || '-'}</div>
                    </div>
                    
                    <div class="mt-4 border-t border-purple-200 pt-3">
                        <label class="block text-sm font-bold text-purple-900 mb-1">Link da Pasta de Criativos (Entrega)</label>
                        <div class="flex gap-2">
                            <input type="text" id="creative-link-${task.id}" value="${task.link_arquivos || ''}" 
                                class="flex-1 px-3 py-1.5 text-sm border border-purple-300 rounded focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Cole o link do Drive/Canva aqui...">
                            <button onclick="saveCreativeLink('${task.id}')" class="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition-colors">
                                <i class="fas fa-save"></i>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Ao salvar, o gestor poderá baixar os arquivos.</p>
                    </div>
                </div>
            ` : ''}
        </div>
        
        <div class="mb-5">
            ${buttonsHtml}
        </div>
        
        <div id="transfer-area-${task.id}" class="hidden bg-gray-100 p-3 rounded-md mb-4">
             <h4 class="font-medium mb-2">Transferir Tarefa</h4>
             <select id="transfer-select-${task.id}" class="w-full p-2 border border-gray-300 rounded mb-2"></select>
             <button onclick="confirmTransfer('${task.id}')" class="px-3 py-1 bg-[var(--color-primary)] text-white rounded text-sm mr-2">Confirmar Transferência</button>
             <button onclick="document.getElementById('transfer-area-${task.id}').classList.add('hidden')" class="px-3 py-1 bg-gray-500 text-white rounded text-sm">Cancelar</button>
        </div>
        
        <h4 class="border-b-2 border-gray-100 pb-2 mb-4 font-semibold text-gray-700">Histórico</h4>
        <div class="max-h-[200px] overflow-y-auto custom-scrollbar">
            ${history && history.length > 0 ? history.map(h => `
                <div class="mb-3 text-sm border-l-2 border-gray-300 pl-3">
                    <div class="font-medium text-xs text-gray-500 mb-1">
                        ${new Date(h.created_at).toLocaleString('pt-BR')} - ${formatTipoHistorico(h.tipo)}
                    </div>
                    <div class="text-gray-700">${h.descricao}</div>
                </div>
            `).join('') : '<p class="text-gray-500 italic">Sem histórico.</p>'}
        </div>
    `;
    
    const assigneeEmail = task.tarefa_atribuicoes && task.tarefa_atribuicoes[0] ? task.tarefa_atribuicoes[0].usuario_email : null;
    const assignee = allCollaborators.find(c => normalizeEmail(c.email) === normalizeEmail(assigneeEmail));
    const assigneeTimeIds = normalizeTimesAccess(assignee?.times_acesso);

    const filteredCollaborators = allCollaborators.filter(c => {
        const times = normalizeTimesAccess(c.times_acesso);
        if (assigneeTimeIds.length === 0) return true;
        return times.some(id => assigneeTimeIds.includes(String(id)));
    });

    // Populate transfer select
    const transferSelect = document.getElementById(`transfer-select-${task.id}`);
    if (transferSelect) {
        transferSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecione um colaborador';
        transferSelect.appendChild(placeholder);

        if (filteredCollaborators.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.disabled = true;
            opt.textContent = 'Nenhum colaborador do mesmo departamento';
            transferSelect.appendChild(opt);
            return;
        }

        filteredCollaborators.forEach(c => {
             const opt = document.createElement('option');
             opt.value = c.email;
             opt.textContent = c.nome || c.email;
             transferSelect.appendChild(opt);
        });
    }
}

window.openTransferModal = function(taskId) {
    const area = document.getElementById(`transfer-area-${taskId}`);
    if (area) area.classList.remove('hidden');
}

window.updateTaskStatus = async function(taskId, newStatus) {
    const btn = event.target.closest('button');
    const originalText = btn ? btn.innerHTML : '';
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }

    try {
        const user = (await window.supabaseClient.auth.getUser()).data.user;
        const currentUserId = user?.id;

        // 1. Buscar a tarefa para ver se tem post_id vinculado e quem criou
        const { data: task, error: fetchError } = await window.supabaseClient
            .from('tarefas')
            .select('post_id, titulo, criado_por, status, tarefa_atribuicoes (usuario_email)')
            .eq('id', taskId)
            .single();

        if (fetchError) throw fetchError;

        const currentEmail = normalizeEmail(user?.email);
        const isAssignee = currentEmail && (task.tarefa_atribuicoes || []).some(a => normalizeEmail(a.usuario_email) === currentEmail);
        if (!isAssignee) {
            alert('Apenas o realizador pode atualizar o status.');
            return;
        }

        // 2. Atualizar status da tarefa
        const { error } = await window.supabaseClient
            .from('tarefas')
            .update({ status: newStatus })
            .eq('id', taskId);

        if (error) throw error;

        // 3. Registrar no histórico
        await window.supabaseClient
            .from('tarefa_historico')
            .insert({
                tarefa_id: taskId,
                usuario_id: currentUserId,
                tipo: 'atualizacao_status',
                descricao: `Status alterado para ${formatStatus(newStatus)}`
            });

        // 4. Sincronizar com Social Post (se houver)
        if (task.post_id) {
            let newPostStatus = null;
            let logMsg = '';

            if (newStatus === 'em_andamento') {
                newPostStatus = 'ajuste_em_andamento'; 
                logMsg = 'Iniciado ajuste no post vinculado.';
            } else if (newStatus === 'concluido' || newStatus === 'concluida') {
                newPostStatus = 'pendente_aprovação'; 
                logMsg = 'Ajuste concluído. Post enviado para aprovação.';
            }

            if (newPostStatus) {
                const { error: postError } = await window.supabaseClient
                    .from('social_posts')
                    .update({ status: newPostStatus })
                    .eq('id', task.post_id);

                if (postError) console.error('Erro ao atualizar post vinculado:', postError);
                else {
                    await window.supabaseClient
                        .from('tarefa_historico')
                        .insert({
                            tarefa_id: taskId,
                            usuario_id: currentUserId,
                            tipo: 'comentario',
                            descricao: logMsg
                        });
                }
            }
        }

        // NOVO: Notificação de Conclusão para o Criador
        if ((newStatus === 'concluido' || newStatus === 'concluida') && task.criado_por && task.criado_por !== currentUserId) {
            const userName = user.user_metadata?.nome || user.email;
            await window.supabaseClient
                .from('notificacoes')
                .insert({
                    usuario_id: task.criado_por,
                    mensagem: `Tarefa "${task.titulo}" concluída por ${userName}`,
                    link_destino: taskId
                });
        }

        alert('Status atualizado!');
        closeViewTaskModal();
        loadTasks(); 

    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        alert('Erro ao atualizar status: ' + error.message);
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

function parseDateInput(input) {
    if (!input) return null;
    const value = String(input).trim();

    const brMatch = value.match(/^\s*(\d{2})\/(\d{2})\/(\d{4})\s*$/);
    if (brMatch) {
        const day = parseInt(brMatch[1], 10);
        const month = parseInt(brMatch[2], 10);
        const year = parseInt(brMatch[3], 10);
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(`${iso}T00:00:00`);
        if (date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day) {
            return iso;
        }
        return null;
    }

    const isoMatch = value.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(`${iso}T00:00:00`);
        if (date.getFullYear() === year && date.getMonth() + 1 === month && date.getDate() === day) {
            return iso;
        }
        return null;
    }

    return null;
}

function formatDateBr(value) {
    if (!value) return '';
    const text = String(value).trim();
    const brMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (brMatch) return text;

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    }

    return text;
}

window.requestExtension = async function(taskId) {
    const { data: authData } = await window.supabaseClient.auth.getUser();
    const authUser = authData?.user;
    const currentEmail = normalizeEmail(authUser?.email);

    const { data: taskInfo, error: taskInfoError } = await window.supabaseClient
        .from('tarefas')
        .select('prazo_aprovado, status, tarefa_atribuicoes (usuario_email)')
        .eq('id', taskId)
        .single();

    if (taskInfoError || !taskInfo) {
        alert('Não foi possível validar a tarefa.');
        return;
    }

    const isAssignee = currentEmail && (taskInfo.tarefa_atribuicoes || []).some(a => normalizeEmail(a.usuario_email) === currentEmail);
    if (!isAssignee) {
        alert('Apenas o realizador pode solicitar prazo.');
        return;
    }

    if (taskInfo.prazo_aprovado) {
        alert('Este prazo já foi aprovado e não pode ser solicitado novamente.');
        return;
    }

    if (taskInfo.status === 'solicitacao_prazo') {
        alert('Já existe uma solicitação de prazo em andamento.');
        return;
    }

    const inputDate = prompt("Para qual data você deseja solicitar o novo prazo? (DD/MM/AAAA)");
    if (!inputDate) return;

    const newDate = parseDateInput(inputDate);
    if (!newDate) {
        alert('Data inválida. Use o formato DD/MM/AAAA.');
        return;
    }

    const user = (await window.supabaseClient.auth.getUser()).data.user;

    try {
        const { error: updateError } = await window.supabaseClient
            .from('tarefas')
            .update({ 
                status: 'solicitacao_prazo',
                prazo_solicitado: newDate,
                prazo_aprovado: false
            })
            .eq('id', taskId);

        if (updateError) throw updateError;

        const { error: historyError } = await window.supabaseClient
            .from('tarefa_historico')
            .insert({
                tarefa_id: taskId,
                usuario_id: user?.id,
                tipo: 'solicitacao_prazo',
                descricao: `Solicitou novo prazo para: ${formatDateBr(newDate)}`
            });

        if (historyError) {
            console.error('Erro ao registrar histórico:', historyError);
        }

        try {
            const { data: taskInfoDetails, error: taskInfoDetailsError } = await window.supabaseClient
                .from('tarefas')
                .select('titulo, criado_por')
                .eq('id', taskId)
                .single();

            if (!taskInfoDetailsError && taskInfoDetails) {
                const requesterId = user?.id || null;
                const creatorId = taskInfoDetails.criado_por || null;
                const title = taskInfoDetails.titulo || 'uma tarefa';

                if (requesterId) {
                    const { error: selfNotifError } = await window.supabaseClient
                        .from('notificacoes')
                        .insert({
                            usuario_id: requesterId,
                            mensagem: `✅ Solicitação de prazo enviada para "${title}".`,
                            link_destino: taskId
                        });

                    if (selfNotifError) {
                        console.error('Erro ao criar notificação do solicitante:', selfNotifError);
                    }
                }

                if (creatorId && String(creatorId) !== String(requesterId)) {
                    const { error: creatorNotifError } = await window.supabaseClient
                        .from('notificacoes')
                        .insert({
                            usuario_id: creatorId,
                            mensagem: `⏳ ${requesterEmail} solicitou prazo para "${title}".`,
                            link_destino: taskId
                        });

                    if (creatorNotifError) {
                        console.error('Erro ao criar notificação do criador:', creatorNotifError);
                    }
                }
            }
        } catch (e) {
            console.error('Erro ao notificar solicitação de prazo:', e);
        }
            
        alert('Solicitação enviada!');
        closeViewTaskModal();
        loadTasks();

    } catch (error) {
        console.error(error);
        const message = error && error.message ? error.message : 'Erro ao solicitar prazo.';
        alert(message);
    }
}

window.approveExtension = async function(taskId) {
    const inputDate = prompt("Confirme a nova data de prazo (DD/MM/AAAA):");
    if (!inputDate) return;

    const newDate = parseDateInput(inputDate);
    if (!newDate) {
        alert('Data inválida. Use o formato DD/MM/AAAA.');
        return;
    }
    
    const user = (await window.supabaseClient.auth.getUser()).data.user;

    try {
        const { error: updateError } = await window.supabaseClient
            .from('tarefas')
            .update({ 
                status: 'pendente',
                prazo_data: newDate,
                prazo_solicitado: null,
                prazo_aprovado: true
            })
            .eq('id', taskId);

        if (updateError) throw updateError;

        const { data: updatedTask, error: fetchError } = await window.supabaseClient
            .from('tarefas')
            .select('id, status, prazo_data, prazo_solicitado')
            .eq('id', taskId)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (!updatedTask || updatedTask.status !== 'pendente') {
            throw new Error('Não foi possível atualizar o status para Pendente.');
        }
            
        const { error: historyError } = await window.supabaseClient
            .from('tarefa_historico')
            .insert({
                tarefa_id: taskId,
                usuario_id: user?.id,
                tipo: 'comentario',
                descricao: `Prazo estendido para ${formatDateBr(newDate)}. Status voltado para Pendente.`
            });

        if (historyError) throw historyError;
            
        try {
            const { data: taskInfo, error: taskInfoError } = await window.supabaseClient
                .from('tarefas')
                .select('titulo, tarefa_atribuicoes (usuario_email)')
                .eq('id', taskId)
                .single();

            if (!taskInfoError && taskInfo && taskInfo.tarefa_atribuicoes && taskInfo.tarefa_atribuicoes.length > 0) {
                const assigneeEmail = taskInfo.tarefa_atribuicoes[0].usuario_email;
                const { data: profile } = await window.supabaseClient
                    .from('profiles')
                    .select('id')
                    .eq('email', assigneeEmail)
                    .maybeSingle();

                if (profile?.id) {
                    await window.supabaseClient
                        .from('notificacoes')
                        .insert({
                            usuario_id: profile.id,
                            mensagem: `✅ Novo prazo aprovado para "${taskInfo.titulo}".`,
                            link_destino: taskId
                        });
                }
            }
        } catch (e) {
            console.error('Erro ao notificar aprovacao de prazo:', e);
        }

        alert('Prazo atualizado!');
        await openViewTaskModal(taskId);
        loadTasks();
    } catch (e) {
        console.error(e);
        alert(e?.message || 'Erro ao atualizar.');
    }
}

window.rejectExtension = async function(taskId) {
    if(!confirm("Rejeitar solicitação e manter prazo atual?")) return;
    
    const user = (await window.supabaseClient.auth.getUser()).data.user;

    try {
         await window.supabaseClient
            .from('tarefas')
            .update({ status: 'pendente' }) 
            .eq('id', taskId);
            
         await window.supabaseClient
            .from('tarefa_historico')
            .insert({
                tarefa_id: taskId,
                usuario_id: user?.id,
                tipo: 'comentario',
                descricao: `Solicitação de prazo rejeitada. Manteve-se o prazo original.`
            });
            
        alert('Solicitação rejeitada.');
        closeViewTaskModal();
        loadTasks();
    } catch (e) {
        console.error(e);
        alert('Erro.');
    }
}

window.confirmTransfer = async function(taskId) {
    const select = document.getElementById(`transfer-select-${taskId}`);
    const newEmail = select.value;
    if (!newEmail) return alert('Selecione um usuário');
    
    const user = (await window.supabaseClient.auth.getUser()).data.user;

    try {
        // Remover atribuições antigas (simplificado)
        await window.supabaseClient.from('tarefa_atribuicoes').delete().eq('tarefa_id', taskId);
        
        // Criar nova
        await window.supabaseClient.from('tarefa_atribuicoes').insert({
            tarefa_id: taskId,
            usuario_email: newEmail
        });

        await window.supabaseClient
            .from('tarefas')
            .update({
                status: 'pendente',
                prazo_solicitado: null,
                prazo_aprovado: false
            })
            .eq('id', taskId);
        
         await window.supabaseClient
            .from('tarefa_historico')
            .insert({
                tarefa_id: taskId,
                usuario_id: user?.id,
                tipo: 'comentario',
                descricao: `Tarefa transferida para ${newEmail}`
            });
            
        alert('Transferido!');
        document.getElementById(`transfer-area-${taskId}`).classList.add('hidden');
        loadTasks(); // recarrega para atualizar views
    } catch (e) {
        console.error(e);
        alert('Erro ao transferir');
    }
}

window.deleteTask = async function(taskId) {
    if (!confirm('Excluir esta tarefa? Isso remove para todos.')) return;

    try {
        const { data: authData } = await window.supabaseClient.auth.getUser();
        const user = authData?.user;
        if (!user) {
            alert('Usuário não autenticado.');
            return;
        }

        const { data: task, error: taskError } = await window.supabaseClient
            .from('tarefas')
            .select('criado_por')
            .eq('id', taskId)
            .single();

        if (taskError) throw taskError;

        const userEmail = normalizeEmail(user.email);
        const isCreator = (user.id && String(task.criado_por) === String(user.id)) || (userEmail && normalizeEmail(task.criado_por) === userEmail);

        if (!isCreator) {
            alert('Apenas o solicitante pode excluir a tarefa.');
            return;
        }

        await window.supabaseClient
            .from('tarefa_atribuicoes')
            .delete()
            .eq('tarefa_id', taskId);

        const { error: deleteError } = await window.supabaseClient
            .from('tarefas')
            .delete()
            .eq('id', taskId);

        if (deleteError) throw deleteError;

        alert('Tarefa excluída.');
        closeViewTaskModal();
        loadTasks();
    } catch (e) {
        console.error(e);
        alert('Erro ao excluir tarefa.');
    }
}

window.saveMeetingNotes = async function(taskId) {
    const notes = document.getElementById(`meeting-notes-${taskId}`).value;
    
    try {
        const { error } = await window.supabaseClient
            .from('tarefas')
            .update({ anotacoes_reuniao: notes })
            .eq('id', taskId);
            
        if (error) throw error;
        alert('Anotações salvas!');
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar anotações.');
    }
}

window.saveCreativeLink = async function(taskId) {
    const link = document.getElementById(`creative-link-${taskId}`).value;
    
    try {
        const { error } = await window.supabaseClient
            .from('tarefas')
            .update({ link_arquivos: link })
            .eq('id', taskId);
            
        if (error) throw error;
        
        alert('Link dos criativos salvo com sucesso!');
        // Opcional: Adicionar histórico
        const user = (await window.supabaseClient.auth.getUser()).data.user;
        await window.supabaseClient.from('tarefa_historico').insert({
            tarefa_id: taskId,
            usuario_id: user?.id,
            tipo: 'comentario',
            descricao: `Link de criativos atualizado.`
        });
        
    } catch (e) {
        console.error(e);
        alert('Erro ao salvar link.');
    }
}
