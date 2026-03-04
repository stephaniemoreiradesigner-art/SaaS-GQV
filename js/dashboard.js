document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se estamos na página de dashboard
    if (!window.location.pathname.includes('dashboard.html')) return;

    let socialChartInstance = null;
    let currentUserRole = 'usuario';
    let currentUserEmail = '';
    let currentUserId = '';
    let currentUserData = null;

    // Aguarda e inicializa dados do usuário
    async function initDashboard() {
        try {
            // Aguarda Supabase
            if (!window.supabaseClient) {
                await new Promise(r => setTimeout(r, 500));
            }
            if (!window.supabaseClient) return;

            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                currentUserEmail = session.user.email;
                currentUserId = session.user.id;
                
                // Buscar dados detalhados do colaborador para permissões
                const { data: colab } = await window.supabaseClient
                    .from('colaboradores')
                    .select('*')
                    .eq('email', currentUserEmail)
                    .maybeSingle();

                if (colab) {
                    currentUserData = colab;
                    currentUserRole = colab.perfil_acesso || 'usuario';
                    // Salvar globalmente para helpers se precisar
                    window.currentUserData = colab;
                } else {
                    // Fallback se não achar na tabela colaboradores (ex: admin inicial)
                    // Verifica profile ou superadmin array
                    const isSuper = (window.SUPERADMIN_EMAILS || []).includes(currentUserEmail);
                    if (isSuper) currentUserRole = 'super_admin';
                }

                // Carrega métricas
                await loadDashboardMetrics();
                
                // Libera a tela
                if (window.showContent) window.showContent();
            }
        } catch (e) {
            console.error('Erro init dashboard:', e);
        }
    }

    async function getCurrentSessionUser() {
        const { data: { session } } = await window.supabaseClient.auth.getSession();
        return session?.user || null;
    }

    function isUuid(v) { 
      return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); 
    } 

    async function getCurrentTenantId(user) { 
      if (!user) return null; 
      const metaTenant = user.user_metadata?.tenant_id ?? user.app_metadata?.tenant_id; 
      if (metaTenant) return String(metaTenant); 

      const { data: profile } = await window.supabaseClient 
        .from('profiles') 
        .select('tenant_id') 
        .eq('id', user.id) 
        .maybeSingle(); 

      return profile?.tenant_id ? String(profile.tenant_id) : null; 
    } 

    async function getChecklistContext() { 
      const user = await getCurrentSessionUser(); 
      const userId = 
        window.currentUserData?.id || 
        window.currentUserData?.user_id || 
        user?.id || 
        null; 

      if (!userId) return { tenantUuid: null, userId: null }; 

      const fromUserData = window.currentUserData?.tenant_id_uuid; 
      if (isUuid(fromUserData)) return { tenantUuid: fromUserData, userId }; 

      if (isUuid(window.currentTenantId)) return { tenantUuid: window.currentTenantId, userId }; 

      const { data, error } = await window.supabaseClient 
        .from('colaboradores') 
        .select('tenant_id_uuid') 
        .eq('user_id', userId) 
        .maybeSingle(); 

      if (error) { 
        console.error('[Lembretes] tenant lookup error', error); 
        return { tenantUuid: null, userId }; 
      } 

      const tenantUuid = data?.tenant_id_uuid; 
      return { tenantUuid: isUuid(tenantUuid) ? tenantUuid : null, userId }; 
    } 

    window.addTodo = async function () { 
      const input = document.getElementById('new-todo'); 
      const titulo = input?.value?.trim(); 
      if (!titulo) return; 

      try { 
        const { tenantUuid, userId } = await getChecklistContext(); 
        if (!tenantUuid) { 
          alert('Checklist indisponível: tenant não resolvido. Verifique vínculo do colaborador.'); 
          return; 
        } 
        if (!userId) throw new Error('Checklist sem contexto (tenant/user)'); 

        const payload = { 
          titulo, 
          concluido: false, 
          user_id: userId, 
          tenant_id_uuid: tenantUuid 
        }; 
        delete payload.tenant_id; 
        console.log('[Lembretes] payload', payload); 

        const { error } = await window.supabaseClient 
          .from('lembretes') 
          .insert([payload]); 

        if (error) throw error; 

        input.value = ''; 
        await loadLembretes(); 
      } catch (e) { 
        console.error('[Lembretes] insert error', e); 
        alert('Falha ao salvar checklist'); 
      } 
    }; 

    window.deleteTodo = async function (id) { 
      if (!confirm('Excluir este item do checklist?')) return; 

      try { 
        const { tenantUuid, userId } = await getChecklistContext(); 
        if (!tenantUuid) { 
          alert('Checklist indisponível: tenant não resolvido. Verifique vínculo do colaborador.'); 
          return; 
        } 
        if (!userId) throw new Error('Checklist sem contexto (tenant/user)'); 

        const { error } = await window.supabaseClient 
          .from('lembretes') 
          .delete() 
          .eq('id', id) 
          .eq('tenant_id_uuid', tenantUuid) 
          .eq('user_id', userId); 

        if (error) throw error; 

        await loadLembretes(); 
      } catch (e) { 
        console.error('[Lembretes] delete error', e); 
        alert('Falha ao excluir checklist'); 
      } 
    }; 

    window.toggleTodo = async function (id, checked) { 
      try { 
        const { tenantUuid, userId } = await getChecklistContext(); 
        if (!tenantUuid) { 
          alert('Checklist indisponível: tenant não resolvido. Verifique vínculo do colaborador.'); 
          return; 
        } 
        if (!userId) throw new Error('Checklist sem contexto (tenant/user)'); 

        const { error } = await window.supabaseClient 
          .from('lembretes') 
          .update({ concluido: !!checked }) 
          .eq('id', id) 
          .eq('tenant_id_uuid', tenantUuid) 
          .eq('user_id', userId); 

        if (error) throw error; 

        await loadLembretes(); 
      } catch (e) { 
        console.error('[Lembretes] toggle error', e); 
        alert('Falha ao atualizar checklist'); 
      } 
    }; 

    async function loadLembretes() { 
      const list = document.getElementById('todo-list'); 
      if (!list) return; 

      try { 
        list.innerHTML = '<li class="text-center text-gray-400 py-4 italic text-sm">Carregando...</li>'; 

        const { tenantUuid, userId } = await getChecklistContext(); 
        if (!tenantUuid) { 
          alert('Checklist indisponível: tenant não resolvido. Verifique vínculo do colaborador.'); 
          return; 
        } 
        if (!userId) throw new Error('Checklist sem contexto (tenant/user)'); 

        const { data: todos, error } = await window.supabaseClient 
          .from('lembretes') 
          .select('id, titulo, concluido, created_at, user_id, tenant_id_uuid') 
          .eq('tenant_id_uuid', tenantUuid) 
          .eq('user_id', userId) 
          .order('concluido', { ascending: true }) 
          .order('created_at', { ascending: false }); 

        if (error) throw error; 

        list.innerHTML = ''; 
        if (!todos || todos.length === 0) { 
          list.innerHTML = '<li class="text-center text-gray-400 py-4 italic text-sm">Nenhum item no checklist</li>'; 
          return; 
        } 

        todos.forEach(todo => { 
          const li = document.createElement('li'); 
          const completedClass = todo.concluido ? 'line-through text-gray-400 bg-gray-50' : 'text-gray-700 hover:bg-gray-50'; 
          li.className = `flex items-center gap-3 p-3 border-b border-gray-100 last:border-0 transition-colors ${completedClass}`; 
          li.innerHTML = ` 
            <input type="checkbox" class="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary cursor-pointer" 
                   ${todo.concluido ? 'checked' : ''} onchange="toggleTodo('${todo.id}', this.checked)"> 
            <span class="flex-1 text-sm font-medium">${todo.titulo}</span> 
            <button class="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-colors" 
                    onclick="deleteTodo('${todo.id}')" title="Excluir"> 
              <i class="fas fa-trash-alt text-xs"></i> 
            </button> 
          `; 
          list.appendChild(li); 
        }); 
      } catch (e) { 
        console.error('[Lembretes] load error', e); 
        list.innerHTML = '<li class="text-red-500 text-center py-2 text-sm">Erro ao carregar</li>'; 
      } 
    } 

    // --- NOVA FUNÇÃO: Agenda do Dia (Sistema) ---
    async function loadSystemAgenda() {
        const list = document.getElementById('system-reminders-list');
        const container = document.getElementById('system-reminders-container');
        if (!list || !container) return;

        // Configurar datas
        const today = new Date();
        today.setHours(0,0,0,0);
        const startOfDay = new Date(today);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        const todayDateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

        container.style.display = 'block';
        list.innerHTML = '<li class="text-center text-gray-400 py-4 text-sm">Carregando agenda...</li>';

        const items = [];

        try {
            // 1. Buscar Tarefas e Reuniões de Hoje
            // Traz tarefas que vencem hoje
            let query = window.supabaseClient
                .from('tarefas')
                .select(`
                    id, titulo, tipo, prazo_data, horario_reuniao, status, time_id, criado_por,
                    tarefa_atribuicoes ( usuario_email )
                `)
                .eq('prazo_data', todayDateStr)
                .neq('status', 'concluido')
                .neq('status', 'concluida'); // Não mostrar concluídas (ambos gêneros)

            const { data: tarefas, error: errTarefas } = await query;

            if (errTarefas) {
                console.warn('Erro ao buscar tarefas (pode ser permissão ou tabela inexistente):', errTarefas);
            } else if (tarefas) {
                const currentEmailLower = (currentUserEmail || '').toLowerCase();

                tarefas.forEach(t => {
                    // Filtro de Permissão
                    let isVisible = false;

                    const criadoPorMim = currentUserId && t.criado_por && String(t.criado_por) === String(currentUserId);

                    if (t.status === 'solicitacao_prazo') {
                        isVisible = criadoPorMim;
                    } else if (['admin', 'super_admin'].includes(currentUserRole)) {
                        isVisible = true;
                    } else {
                        const atribuido = t.tarefa_atribuicoes?.some(a => (a.usuario_email || '').toLowerCase() === currentEmailLower);

                        let timeMatch = false;
                        if (t.time_id && currentUserData && currentUserData.times_acesso) {
                            let userTimes = currentUserData.times_acesso;
                            if (typeof userTimes === 'string') {
                                try { userTimes = JSON.parse(userTimes); } catch(e) { userTimes = []; }
                            }
                            
                            if (Array.isArray(userTimes)) {
                                if (userTimes.map(id => String(id)).includes(String(t.time_id))) {
                                    timeMatch = true;
                                }
                            }
                        }

                        if (atribuido || timeMatch || criadoPorMim) isVisible = true;
                    }

                    if (isVisible) {
                        items.push({
                            type: t.tipo,
                            title: t.titulo,
                            desc: t.tipo === 'reuniao' ? `Reunião às ${t.horario_reuniao || '??:??'}` : 'Entrega hoje',
                            link: `tarefas.html?id=${t.id}`, // Vai abrir detalhes
                            icon: t.tipo === 'reuniao' ? 'fa-users' : 'fa-tasks',
                            colorClass: t.tipo === 'reuniao' ? 'bg-cyan-100 text-cyan-600' : 'bg-blue-100 text-blue-600'
                        });
                    }
                });
            }

            // 2. Buscar Aniversariantes do Dia
            const { data: colaboradores, error: errColab } = await window.supabaseClient
                .from('colaboradores')
                .select('nome, data_nascimento, times_acesso')
                .not('data_nascimento', 'is', null);

            if (!errColab && colaboradores) {
                colaboradores.forEach(c => {
                    // Parse data nascimento (YYYY-MM-DD)
                    const parts = c.data_nascimento.split('-');
                    if (parts.length === 3) {
                        const nascDia = parseInt(parts[2]);
                        const nascMes = parseInt(parts[1]) - 1; // JS months are 0-based

                        const nextBirthday = new Date(today.getFullYear(), nascMes, nascDia);
                        if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);
                        const diffMs = nextBirthday.getTime() - today.getTime();
                        const diffDays = Math.floor(diffMs / 86400000);

                        if (diffDays >= 0 && diffDays <= 15) {
                            items.push({
                                type: 'aniversario',
                                title: `🎉 Parabéns, ${c.nome}!`,
                                desc: diffDays === 0 ? 'Aniversariante do dia' : `Aniversário em ${diffDays} dias`,
                                link: null,
                                icon: 'fa-birthday-cake',
                                colorClass: 'bg-pink-100 text-pink-600'
                            });
                        }
                    }
                });
            }

        } catch (error) {
            console.error('Erro ao carregar agenda:', error);
        }

        // Renderizar
        list.innerHTML = '';
        if (items.length === 0) {
            list.innerHTML = '<li class="text-center text-gray-400 py-4 text-sm italic">Nada agendado para hoje.</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.className = `flex items-center gap-3 p-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${item.link ? 'cursor-pointer' : 'cursor-default'}`;
            
            if (item.link) {
                li.onclick = () => window.location.href = item.link;
            }

            li.innerHTML = `
                <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.colorClass}">
                    <i class="fas ${item.icon} text-sm"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <span class="block text-sm font-semibold text-gray-800 truncate">${item.title}</span>
                    <span class="block text-xs text-gray-500 truncate">${item.desc}</span>
                </div>
                ${item.link ? '<i class="fas fa-chevron-right text-gray-300 text-xs"></i>' : ''}
            `;
            list.appendChild(li);
        });
    }

    async function loadCampanhasEmAndamento() {
        try {
            const { count, error } = await window.supabaseClient
                .from('projetos') 
                .select('*', { count: 'exact', head: true })
                .eq('status', 'em_andamento');

            if (error) throw error;
            updateMetric('metric-campanhas', count || 0, 'Campanhas em andamento');
        } catch (e) {
            // Silencioso pois 'projetos' pode ter sumido
            updateMetric('metric-campanhas', 0, 'Campanhas em andamento');
        }
    }

    const humanizeRole = (role) => {
        const value = String(role || '').trim();
        if (!value) return 'Colaborador';
        return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    async function loadAniversariantesMes() {
        const list = document.getElementById('birthdays-month-list');
        if (!list) return;

        try {
            const { data: colaboradores, error } = await window.supabaseClient
                .from('colaboradores')
                .select('nome, data_nascimento, perfil_acesso, cargo, departamento, nivel_hierarquico')
                .not('data_nascimento', 'is', null);

            if (error) throw error;

            if (!colaboradores || colaboradores.length === 0) {
                list.innerHTML = '<p class="text-center text-gray-400 py-4 italic text-sm">Nenhum aniversariante este mês.</p>';
                return;
            }

            const today = new Date();
            const currentMonth = today.getMonth(); // 0-11
            const currentDay = today.getDate();

            // Filtrar aniversariantes do mês
            const birthdays = colaboradores.filter(c => {
                const parts = c.data_nascimento.split('-'); // YYYY-MM-DD
                if (parts.length !== 3) return false;
                const month = parseInt(parts[1]) - 1;
                return month === currentMonth;
            }).map(c => {
                const parts = c.data_nascimento.split('-');
                const day = parseInt(parts[2]);
                const month = parseInt(parts[1]);

                const departamento = typeof c.departamento === 'string' ? c.departamento.trim() : c.departamento;
                const cargo = typeof c.cargo === 'string' ? c.cargo.trim() : c.cargo;
                const nivelHierarquico = typeof c.nivel_hierarquico === 'string' ? c.nivel_hierarquico.trim() : c.nivel_hierarquico;
                const label = departamento || cargo || nivelHierarquico || humanizeRole(c.perfil_acesso);

                // Primeiro Nome
                const firstName = c.nome.split(' ')[0];

                return {
                    ...c,
                    firstName: firstName,
                    day: day,
                    month: month,
                    label: label,
                    isToday: day === currentDay
                };
            });

            // Ordenar por dia
            birthdays.sort((a, b) => a.day - b.day);

            list.innerHTML = '';
            if (birthdays.length === 0) {
                list.innerHTML = '<p class="text-center text-gray-400 py-4 italic text-sm">Nenhum aniversariante este mês.</p>';
                return;
            }

            birthdays.forEach(b => {
                const item = document.createElement('div');
                // Destaque se for hoje
                const bgClass = b.isToday ? 'bg-pink-50 border-pink-200' : 'bg-gray-50 border-gray-100';
                const textClass = b.isToday ? 'text-pink-700' : 'text-gray-700';
                
                item.className = `flex items-center justify-between p-3 rounded-lg border ${bgClass} transition-colors`;
                item.innerHTML = `
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center text-pink-500 shadow-sm border border-pink-100">
                            <i class="fas fa-birthday-cake text-sm"></i>
                        </div>
                        <div>
                            <h4 class="text-sm font-semibold ${textClass}">${b.firstName}</h4>
                            <p class="text-xs text-gray-500">${b.label}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="text-sm font-bold ${b.isToday ? 'text-pink-600' : 'text-gray-600'}">
                            ${b.day.toString().padStart(2, '0')}/${b.month.toString().padStart(2, '0')}
                        </span>
                        ${b.isToday ? '<span class="block text-[10px] font-bold text-pink-500 uppercase tracking-wide">Hoje!</span>' : ''}
                    </div>
                `;
                list.appendChild(item);
            });

        } catch (e) {
            console.error('Erro ao carregar aniversariantes:', e);
            list.innerHTML = '<p class="text-center text-red-400 py-4 text-sm">Erro ao carregar.</p>';
        }
    }

    async function loadDashboardMetrics() {
        await Promise.all([
            loadCampanhasEmAndamento(),
            loadSystemAgenda(),
            loadLembretes(),
            loadAniversariantesMes()
        ]);
    }

    function updateMetric(id, value, title) {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    }

    // Inicializa
    initDashboard();
});
