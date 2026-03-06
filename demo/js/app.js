window.demoApp = (() => {
    const data = window.demoData || {};
    const state = {
        socialPosts: (data.socialPosts || []).map(post => ({ ...post })),
        selectedPostId: null,
        trafego: {
            periodo: '30d',
            rede: 'meta',
            campanhas: (data.trafegoPago?.campanhas || []).map(c => ({ ...c }))
        }
    };

    const setText = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = value;
    };

    const ensureModal = () => {
        let modal = document.getElementById('demo-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'demo-modal';
        modal.className = 'demo-modal';
        modal.innerHTML = `
            <div class="demo-modal-content">
                <div class="demo-modal-header">
                    <span class="demo-modal-title" id="demo-modal-title"></span>
                    <button class="demo-modal-close" data-action="close-modal">&times;</button>
                </div>
                <div id="demo-modal-body"></div>
                <div class="actions-row" style="margin-top: 16px; justify-content: flex-end;">
                    <button class="btn btn-primary btn-sm" data-action="close-modal">Ok</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        return modal;
    };

    const showModal = (title, body) => {
        const modal = ensureModal();
        const titleEl = document.getElementById('demo-modal-title');
        const bodyEl = document.getElementById('demo-modal-body');
        if (titleEl) titleEl.textContent = title;
        if (bodyEl) bodyEl.innerHTML = body;
        modal.classList.add('active');
    };

    const closeModal = () => {
        const modal = document.getElementById('demo-modal');
        if (modal) modal.classList.remove('active');
    };

    const renderHome = () => {
        setText('[data-home="clientes"]', data.clientes?.length || 0);
        setText('[data-home="projetos"]', data.operacao?.projetosAtivos || 0);
        setText('[data-home="posts"]', state.socialPosts.length || 0);
        setText('[data-home="campanhas"]', data.trafegoPago?.campanhas?.length || 0);
        const activities = document.getElementById('home-activities');
        if (activities) {
            activities.innerHTML = '';
            (data.atividades || []).forEach(item => {
                const row = document.createElement('div');
                row.className = 'list-card';
                row.innerHTML = `
                    <div class="list-card-info">
                        <span class="list-title">${item.hora}</span>
                        <span class="list-subtitle">${item.descricao}</span>
                    </div>
                    <span class="pill">Atual</span>
                `;
                activities.appendChild(row);
            });
        }
        const operation = document.getElementById('home-operation');
        if (operation) {
            operation.innerHTML = `
                <div class="metric-card">
                    <span class="metric-label">Projetos ativos</span>
                    <span class="metric-value">${data.operacao?.projetosAtivos || 0}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Aprovações pendentes</span>
                    <span class="metric-value">${data.operacao?.aprovacoes || 0}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Pendências críticas</span>
                    <span class="metric-value">${data.operacao?.pendencias || 0}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">Nível de saúde</span>
                    <span class="metric-value">${data.operacao?.nivelSaude || 'Estável'}</span>
                </div>
            `;
        }
        const executive = document.getElementById('home-executive');
        if (executive) {
            executive.innerHTML = `
                <div class="detail-row"><span class="detail-label">Status:</span> Operação estável e com entregas no prazo</div>
                <div class="detail-row"><span class="detail-label">Foco da semana:</span> Aprovações e otimizações de mídia</div>
                <div class="detail-row"><span class="detail-label">Risco:</span> Baixo</div>
            `;
        }
    };

    const renderClientes = () => {
        const container = document.getElementById('clientes-list');
        if (!container) return;
        container.innerHTML = '';
        (data.clientes || []).forEach(cliente => {
            const card = document.createElement('div');
            card.className = 'list-card';
            card.innerHTML = `
                <div class="list-card-info">
                    <span class="list-title">${cliente.nome}</span>
                    <span class="list-subtitle">Plano ${cliente.plano} • ${cliente.segmento} • ${cliente.responsavel}</span>
                </div>
                <div class="actions-row">
                    <span class="status-chip">${cliente.status}</span>
                    <button class="btn btn-primary btn-sm" data-action="abrir-cliente">Abrir</button>
                </div>
            `;
            container.appendChild(card);
        });
    };

    const renderTarefas = () => {
        const container = document.getElementById('tarefas-list');
        if (!container) return;
        container.innerHTML = '';
        (data.tarefas || []).forEach(tarefa => {
            const card = document.createElement('div');
            card.className = 'list-card';
            card.innerHTML = `
                <div class="list-card-info">
                    <span class="list-title">${tarefa.titulo}</span>
                    <span class="list-subtitle">${tarefa.cliente} • ${tarefa.responsavel} • Prazo ${tarefa.prazo}</span>
                    <div class="actions-row">
                        <span class="badge badge-warning">${tarefa.status}</span>
                        <span class="status-chip">Prioridade ${tarefa.prioridade}</span>
                    </div>
                </div>
                <div class="actions-row">
                    <button class="btn btn-primary btn-sm" data-action="excluir-tarefa">Excluir</button>
                    <button class="btn btn-sm" data-action="transferir-tarefa">Transferir</button>
                    <button class="btn btn-sm" data-action="solicitar-prazo">Solicitar prazo</button>
                </div>
            `;
            container.appendChild(card);
        });
    };

    const renderSocialHub = () => {
        const hub = document.getElementById('sm-hub-cards');
        if (!hub) return;
        hub.innerHTML = '';
        (data.socialMedia?.hub || []).forEach(item => {
            const card = document.createElement('div');
            card.className = 'metric-card';
            card.innerHTML = `
                <span class="metric-label">${item.titulo}</span>
                <span class="metric-value">${item.valor}</span>
                <span class="list-subtitle">${item.destaque}</span>
            `;
            hub.appendChild(card);
        });
    };

    const renderSocialList = () => {
        const list = document.getElementById('social-media-posts');
        if (!list) return;
        list.innerHTML = '';
        state.socialPosts.forEach(post => {
            const item = document.createElement('div');
            item.className = 'calendar-item sm-post-item';
            item.dataset.postId = post.id;
            item.innerHTML = `
                <div class="sm-post-meta">
                    <span class="list-title">${post.data} • ${post.tema}</span>
                    <span class="list-subtitle">${post.legenda.slice(0, 60)}...</span>
                </div>
                <span class="status-chip">${post.status}</span>
            `;
            list.appendChild(item);
        });
        if (!state.selectedPostId && state.socialPosts.length) {
            state.selectedPostId = state.socialPosts[0].id;
        }
        renderSocialDetail(state.selectedPostId);
    };

    const renderSocialDetail = (postId) => {
        const post = state.socialPosts.find(item => item.id === postId);
        if (!post) return;
        const temaInput = document.getElementById('sm-edit-tema');
        const legendaInput = document.getElementById('sm-edit-legenda');
        const statusSelect = document.getElementById('sm-edit-status');
        const extra = document.getElementById('sm-detail-extra');
        if (temaInput) temaInput.value = post.tema;
        if (legendaInput) legendaInput.value = post.legenda;
        if (statusSelect) {
            statusSelect.innerHTML = '';
            (data.socialMedia?.statuses || []).forEach(status => {
                const option = document.createElement('option');
                option.value = status;
                option.textContent = status;
                if (status === post.status) option.selected = true;
                statusSelect.appendChild(option);
            });
        }
        if (extra) {
            extra.innerHTML = `
                <div class="detail-row"><span class="detail-label">CTA:</span> ${post.cta}</div>
                <div class="detail-row"><span class="detail-label">Hashtags:</span> ${post.hashtags}</div>
                <div class="detail-row"><span class="detail-label">Criativo:</span> ${post.criativo}</div>
            `;
        }
    };

    const updateSocialPost = (updates) => {
        const post = state.socialPosts.find(item => item.id === state.selectedPostId);
        if (!post) return;
        Object.assign(post, updates);
        renderSocialList();
        renderSocialReport();
    };

    const renderSocialReport = () => {
        const report = document.getElementById('sm-report');
        if (!report) return;
        const statusCount = state.socialPosts.reduce((acc, post) => {
            acc[post.status] = (acc[post.status] || 0) + 1;
            return acc;
        }, {});
        report.innerHTML = `
            <div class="detail-row"><span class="detail-label">Total de posts:</span> ${state.socialPosts.length}</div>
            <div class="detail-row"><span class="detail-label">Rascunhos:</span> ${statusCount['Rascunho'] || 0}</div>
            <div class="detail-row"><span class="detail-label">Em ajuste:</span> ${statusCount['Em ajuste'] || 0}</div>
            <div class="detail-row"><span class="detail-label">Aguardando aprovação:</span> ${statusCount['Aguardando aprovação'] || 0}</div>
            <div class="detail-row"><span class="detail-label">Aprovados:</span> ${statusCount['Aprovado'] || 0}</div>
        `;
    };

    const renderSocialMedia = () => {
        renderSocialHub();
        renderSocialList();
        renderSocialReport();
    };

    const renderTrafegoMetrics = () => {
        const metrics = document.getElementById('trafego-metrics');
        if (!metrics) return;
        const periodData = data.trafegoPago?.periodos?.[state.trafego.periodo] || {};
        const networkData = data.trafegoPago?.redes?.[state.trafego.rede] || {};
        const merged = {
            investimento: networkData.investimento || periodData.investimento,
            leads: networkData.leads || periodData.leads,
            cpl: networkData.cpl || periodData.cpl,
            roas: networkData.roas || periodData.roas,
            conversoes: networkData.conversoes || periodData.conversoes
        };
        metrics.innerHTML = `
            <div class="metric-card"><span class="metric-label">Investimento</span><span class="metric-value">${merged.investimento || '-'}</span></div>
            <div class="metric-card"><span class="metric-label">Leads</span><span class="metric-value">${merged.leads || '-'}</span></div>
            <div class="metric-card"><span class="metric-label">CPL</span><span class="metric-value">${merged.cpl || '-'}</span></div>
            <div class="metric-card"><span class="metric-label">ROAS</span><span class="metric-value">${merged.roas || '-'}</span></div>
            <div class="metric-card"><span class="metric-label">Conversões</span><span class="metric-value">${merged.conversoes || '-'}</span></div>
        `;
    };

    const renderTrafegoCampanhas = () => {
        const list = document.getElementById('trafego-campanhas');
        if (!list) return;
        list.innerHTML = '';
        state.trafego.campanhas.forEach(campanha => {
            const card = document.createElement('div');
            card.className = 'list-card';
            card.innerHTML = `
                <div class="list-card-info">
                    <span class="list-title">${campanha.nome}</span>
                    <span class="list-subtitle">${campanha.rede} • Leads ${campanha.leads} • CPL ${campanha.cpl} • ROAS ${campanha.roas}</span>
                    <div class="actions-row">
                        <label class="list-subtitle">Orçamento</label>
                        <input type="range" min="3000" max="12000" value="${campanha.budget}" data-campaign="${campanha.id}" class="tp-budget">
                        <span class="status-chip" id="tp-budget-${campanha.id}">R$ ${campanha.budget}</span>
                    </div>
                </div>
                <div class="actions-row">
                    <select class="form-control tp-status" data-campaign="${campanha.id}">
                        <option ${campanha.status === 'Ativa' ? 'selected' : ''}>Ativa</option>
                        <option ${campanha.status === 'Em teste' ? 'selected' : ''}>Em teste</option>
                        <option ${campanha.status === 'Pausada' ? 'selected' : ''}>Pausada</option>
                    </select>
                </div>
            `;
            list.appendChild(card);
        });
        list.querySelectorAll('.tp-budget').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = Number(e.target.dataset.campaign);
                const value = Number(e.target.value);
                const campanha = state.trafego.campanhas.find(c => c.id === id);
                if (campanha) {
                    campanha.budget = value;
                    const label = document.getElementById(`tp-budget-${id}`);
                    if (label) label.textContent = `R$ ${value}`;
                }
            });
        });
        list.querySelectorAll('.tp-status').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = Number(e.target.dataset.campaign);
                const campanha = state.trafego.campanhas.find(c => c.id === id);
                if (campanha) campanha.status = e.target.value;
                showModal('Status atualizado', 'A campanha foi atualizada na simulação.');
            });
        });
    };

    const renderTrafegoCriativos = () => {
        const list = document.getElementById('trafego-criativos');
        if (!list) return;
        list.innerHTML = '';
        (data.trafegoPago?.criativos || []).forEach(criativo => {
            const card = document.createElement('div');
            card.className = 'list-card';
            card.innerHTML = `
                <div class="list-card-info">
                    <span class="list-title">${criativo.titulo}</span>
                    <span class="list-subtitle">${criativo.canal} • CTR ${criativo.ctr} • CPA ${criativo.cpa}</span>
                </div>
                <span class="badge badge-success">Top</span>
            `;
            list.appendChild(card);
        });
    };

    const renderTrafegoReport = (loading = false) => {
        const report = document.getElementById('tp-report');
        if (!report) return;
        if (loading) {
            report.innerHTML = '<div class="demo-loading"><i class="fas fa-spinner fa-spin"></i> Gerando relatório...</div>';
            return;
        }
        report.innerHTML = `
            <div class="detail-row"><span class="detail-label">Resumo:</span> Campanhas estáveis com otimizações semanais</div>
            <div class="detail-row"><span class="detail-label">Meta principal:</span> Reduzir CPL em 8%</div>
            <div class="detail-row"><span class="detail-label">Ação sugerida:</span> Reforçar criativos de prova social</div>
        `;
    };

    const renderTrafegoPago = () => {
        const periodSelect = document.getElementById('tp-period');
        const networkSelect = document.getElementById('tp-network');
        if (periodSelect) state.trafego.periodo = periodSelect.value;
        if (networkSelect) state.trafego.rede = networkSelect.value;
        renderTrafegoMetrics();
        renderTrafegoCampanhas();
        renderTrafegoCriativos();
        renderTrafegoReport();
        if (periodSelect) {
            periodSelect.onchange = () => {
                state.trafego.periodo = periodSelect.value;
                renderTrafegoMetrics();
            };
        }
        if (networkSelect) {
            networkSelect.onchange = () => {
                state.trafego.rede = networkSelect.value;
                renderTrafegoMetrics();
            };
        }
    };

    const renderFinanceiro = () => {
        setText('[data-financeiro="receitas"]', data.financeiro?.receitas || 'R$ 0');
        setText('[data-financeiro="despesas"]', data.financeiro?.despesas || 'R$ 0');
        setText('[data-financeiro="saldo"]', data.financeiro?.saldo || 'R$ 0');
        const contas = document.getElementById('financeiro-contas');
        if (contas) {
            contas.innerHTML = '';
            (data.financeiro?.contas || []).forEach(conta => {
                const card = document.createElement('div');
                card.className = 'list-card';
                card.innerHTML = `
                    <div class="list-card-info">
                        <span class="list-title">${conta.descricao}</span>
                        <span class="list-subtitle">Valor ${conta.valor} • Vencimento ${conta.vencimento}</span>
                    </div>
                    <span class="badge badge-warning">A vencer</span>
                `;
                contas.appendChild(card);
            });
        }
        const historico = document.getElementById('financeiro-historico');
        if (historico) {
            historico.innerHTML = '';
            (data.financeiro?.historico || []).forEach(item => {
                const card = document.createElement('div');
                card.className = 'list-card';
                card.innerHTML = `
                    <div class="list-card-info">
                        <span class="list-title">${item.descricao}</span>
                        <span class="list-subtitle">${item.valor}</span>
                    </div>
                    <span class="status-chip">${item.status}</span>
                `;
                historico.appendChild(card);
            });
        }
    };

    const renderColaboradores = () => {
        const container = document.getElementById('colaboradores-list');
        if (!container) return;
        container.innerHTML = '';
        (data.colaboradores || []).forEach(colab => {
            const card = document.createElement('div');
            card.className = 'list-card';
            card.innerHTML = `
                <div class="list-card-info">
                    <span class="list-title">${colab.nome}</span>
                    <span class="list-subtitle">${colab.cargo} • Projetos ${colab.projetos}</span>
                </div>
                <span class="badge badge-success">${colab.produtividade}</span>
            `;
            container.appendChild(card);
        });
    };

    const renderClienteDashboard = () => {
        setText('[data-client="calendario"]', data.painelCliente?.calendarioAprovacao || 0);
        setText('[data-client="posts"]', data.painelCliente?.postsAprovacao || 0);
        setText('[data-client="campanhas"]', data.painelCliente?.campanhasAtivas || 0);
        setText('[data-client="fatura"]', data.painelCliente?.proximaFaturaDias || 0);
        const shortcuts = document.getElementById('client-shortcuts');
        if (shortcuts) {
            shortcuts.innerHTML = '';
            (data.painelCliente?.atalhos || []).forEach(item => {
                const card = document.createElement('div');
                card.className = 'list-card';
                card.innerHTML = `
                    <div class="list-card-info">
                        <span class="list-title">${item.titulo}</span>
                        <span class="list-subtitle">Acesso rápido</span>
                    </div>
                    <button class="btn btn-primary btn-sm" data-action="cliente-atalho" data-route="${item.rota}">Abrir</button>
                `;
                shortcuts.appendChild(card);
            });
        }
    };

    const renderClienteCalendario = () => {
        const list = document.getElementById('client-calendario');
        if (!list) return;
        list.innerHTML = '';
        (data.painelCliente?.calendario || []).forEach(item => {
            const row = document.createElement('div');
            row.className = 'calendar-item';
            row.innerHTML = `
                <div class="list-title">${item.data} • ${item.tema}</div>
                <div class="list-subtitle">${item.status}</div>
                <div class="actions-row" style="margin-top: 10px;">
                    <button class="btn btn-primary btn-sm" data-action="aprovar-post">Aprovar</button>
                    <button class="btn btn-sm" data-action="solicitar-ajuste">Solicitar ajuste</button>
                    <button class="btn btn-sm">Comentar</button>
                </div>
            `;
            list.appendChild(row);
        });
    };

    const renderClientePosts = () => {
        const list = document.getElementById('client-posts');
        if (!list) return;
        list.innerHTML = '';
        (data.painelCliente?.posts || []).forEach(post => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <h3>${post.tema}</h3>
                <p class="list-subtitle">${post.legenda}</p>
                <div class="actions-row" style="margin-top: 10px;">
                    <button class="btn btn-primary btn-sm" data-action="aprovar-post">Aprovar</button>
                    <button class="btn btn-sm" data-action="solicitar-ajuste">Solicitar ajuste</button>
                </div>
            `;
            list.appendChild(card);
        });
    };

    const renderClienteFinanceiro = () => {
        const resumo = document.getElementById('client-financeiro-resumo');
        if (resumo) {
            const fatura = data.painelCliente?.faturas?.[0];
            resumo.innerHTML = `
                <div class="detail-row"><span class="detail-label">Próxima fatura:</span> ${fatura?.descricao || 'Mensalidade'} • ${fatura?.valor || 'R$ 0'}</div>
                <div class="detail-row"><span class="detail-label">Vencimento:</span> ${fatura?.vencimento || '-'}</div>
                <div class="detail-row"><span class="detail-label">Status:</span> ${fatura?.status || 'Em aberto'}</div>
                <div class="actions-row" style="margin-top: 12px;">
                    <button class="btn btn-primary btn-sm" data-action="baixar-boleto">Baixar boleto</button>
                </div>
            `;
        }
        const historico = document.getElementById('client-financeiro-historico');
        if (historico) {
            historico.innerHTML = '';
            (data.painelCliente?.faturas || []).forEach(item => {
                const card = document.createElement('div');
                card.className = 'list-card';
                card.innerHTML = `
                    <div class="list-card-info">
                        <span class="list-title">${item.descricao}</span>
                        <span class="list-subtitle">${item.valor} • ${item.vencimento}</span>
                    </div>
                    <span class="status-chip">${item.status}</span>
                `;
                historico.appendChild(card);
            });
        }
    };

    const renderClienteCampanhas = () => {
        return;
    };

    const renderClienteInsights = () => {
        const buttons = document.querySelectorAll('[data-insight]');
        const output = document.getElementById('insight-output');
        if (!buttons.length || !output) return;
        const setInsight = (key) => {
            const info = data.painelCliente?.redes?.[key];
            if (!info) return;
            output.innerHTML = `
                <div class="metric-card"><span class="metric-label">Alcance</span><span class="metric-value">${info.alcance}</span></div>
                <div class="metric-card"><span class="metric-label">Engajamento</span><span class="metric-value">${info.engajamento}</span></div>
                <div class="metric-card"><span class="metric-label">Seguidores</span><span class="metric-value">${info.seguidores}</span></div>
            `;
            buttons.forEach(btn => {
                if (btn.dataset.insight === key) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        };
        buttons.forEach(btn => {
            btn.addEventListener('click', () => setInsight(btn.dataset.insight));
        });
        setInsight('instagram');
    };

    const handleSocialSave = () => {
        const tema = document.getElementById('sm-edit-tema')?.value || '';
        const legenda = document.getElementById('sm-edit-legenda')?.value || '';
        const status = document.getElementById('sm-edit-status')?.value || '';
        updateSocialPost({ tema, legenda, status });
        showModal('Ajuste salvo', 'O post foi atualizado para a simulação.');
    };

    const handleSocialApproval = (status) => {
        updateSocialPost({ status });
        showModal('Status atualizado', `Status alterado para ${status}.`);
    };

    const handleSocialReport = () => {
        const report = document.getElementById('sm-report');
        if (!report) return;
        report.innerHTML = '<div class="demo-loading"><i class="fas fa-spinner fa-spin"></i> Gerando relatório...</div>';
        setTimeout(() => {
            renderSocialReport();
            showModal('Relatório pronto', 'O relatório foi gerado com base no calendário atual.');
        }, 800);
    };

    const handleTrafficReport = () => {
        renderTrafegoReport(true);
        setTimeout(() => {
            renderTrafegoReport(false);
            showModal('Relatório pronto', 'Relatório simulado gerado com sucesso.');
        }, 900);
    };

    const bindActions = () => {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            if (action === 'close-modal') closeModal();
            if (action === 'excluir-tarefa') showModal('Tarefa excluída', 'A tarefa foi removida da lista simulada.');
            if (action === 'transferir-tarefa') showModal('Transferência enviada', 'A tarefa foi transferida para outro responsável.');
            if (action === 'solicitar-prazo') showModal('Solicitação registrada', 'O prazo foi solicitado ao gestor.');
            if (action === 'abrir-cliente') window.location.href = 'cliente.html';
            if (action === 'sm-calendar') showModal('Calendário criado', 'Calendário gerado com dados simulados.');
            if (action === 'sm-save') handleSocialSave();
            if (action === 'sm-send-approval') handleSocialApproval('Aguardando aprovação');
            if (action === 'sm-approve') handleSocialApproval('Aprovado');
            if (action === 'sm-report') handleSocialReport();
            if (action === 'tp-report') handleTrafficReport();
            if (action === 'baixar-boleto') showModal('Boleto baixado', 'Download simulado do boleto.');
            if (action === 'aprovar-post') showModal('Post aprovado', 'A aprovação foi registrada.');
            if (action === 'solicitar-ajuste') showModal('Ajuste solicitado', 'O time recebeu sua solicitação.');
            if (action === 'solicitar-campanha') showModal('Solicitação enviada', 'A campanha entrou na fila de atendimento.');
            if (action === 'cliente-atalho') {
                const route = target.dataset.route || '#/dashboard';
                window.location.hash = route;
            }
        });
    };

    const bindSocialList = () => {
        const list = document.getElementById('social-media-posts');
        if (!list) return;
        list.addEventListener('click', (e) => {
            const target = e.target.closest('.calendar-item');
            if (!target) return;
            state.selectedPostId = Number(target.dataset.postId);
            renderSocialDetail(state.selectedPostId);
        });
    };

    const initPage = (routeKey) => {
        const isClientView = Boolean(document.querySelector('.client-menu'));
        if (isClientView) {
            if (routeKey === 'dashboard') renderClienteDashboard();
            if (routeKey === 'calendario') renderClienteCalendario();
            if (routeKey === 'posts') renderClientePosts();
            if (routeKey === 'campanhas') renderClienteCampanhas();
            if (routeKey === 'insights') renderClienteInsights();
            if (routeKey === 'financeiro') renderClienteFinanceiro();
            return;
        }
        if (routeKey === 'home') renderHome();
        if (routeKey === 'clientes') renderClientes();
        if (routeKey === 'tarefas') renderTarefas();
        if (routeKey === 'social-media') {
            renderSocialMedia();
            bindSocialList();
        }
        if (routeKey === 'trafego-pago') renderTrafegoPago();
        if (routeKey === 'financeiro') renderFinanceiro();
        if (routeKey === 'colaboradores') renderColaboradores();
        if (routeKey === 'configuracoes') return;
    };

    const init = () => {
        bindActions();
        ensureModal();
    };

    init();

    return { initPage };
})();
