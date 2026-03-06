window.demoApp = (() => {
    const data = window.demoData || {};

    const setText = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = value;
    };

    const renderHome = () => {
        setText('[data-home="clientes"]', data.clientes?.length || 0);
        setText('[data-home="projetos"]', 14);
        setText('[data-home="posts"]', data.socialPosts?.length || 0);
        setText('[data-home="campanhas"]', data.trafegoPago?.campanhas?.length || 0);
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
                    <span class="list-subtitle">Plano ${cliente.plano} • Responsável: ${cliente.responsavel}</span>
                </div>
                <span class="badge badge-success">Ativo</span>
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
                    <span class="badge badge-warning">${tarefa.status}</span>
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

    const renderSocialMedia = () => {
        const list = document.getElementById('social-media-posts');
        const detail = document.getElementById('social-media-detail');
        if (!list || !detail) return;
        list.innerHTML = '';
        (data.socialPosts || []).forEach(post => {
            const item = document.createElement('div');
            item.className = 'calendar-item';
            item.dataset.postId = post.id;
            item.innerHTML = `
                <div class="list-title">${post.data} • ${post.tema}</div>
                <div class="list-subtitle">${post.status}</div>
            `;
            list.appendChild(item);
        });
        if (data.socialPosts?.length) {
            renderSocialMediaDetail(data.socialPosts[0].id);
        }
        list.addEventListener('click', (e) => {
            const target = e.target.closest('.calendar-item');
            if (!target) return;
            renderSocialMediaDetail(Number(target.dataset.postId));
        });
    };

    const renderSocialMediaDetail = (postId) => {
        const detail = document.getElementById('social-media-detail');
        if (!detail) return;
        const post = (data.socialPosts || []).find(item => item.id === postId);
        if (!post) return;
        detail.innerHTML = `
            <div class="detail-row"><span class="detail-label">Tema:</span> ${post.tema}</div>
            <div class="detail-row"><span class="detail-label">Legenda:</span> ${post.legenda}</div>
            <div class="detail-row"><span class="detail-label">CTA:</span> ${post.cta}</div>
            <div class="detail-row"><span class="detail-label">Hashtags:</span> ${post.hashtags}</div>
            <div class="detail-row"><span class="detail-label">Criativo:</span> ${post.criativo}</div>
            <div class="detail-row"><span class="detail-label">Status:</span> ${post.status}</div>
            <div class="actions-row">
                <button class="btn btn-primary btn-sm" data-action="editar-post">Editar</button>
                <button class="btn btn-sm" data-action="enviar-aprovacao">Enviar para aprovação</button>
                <button class="btn btn-sm" data-action="marcar-aprovado">Marcar aprovado</button>
            </div>
        `;
    };

    const renderTrafegoPago = () => {
        const metrics = document.getElementById('trafego-metrics');
        const list = document.getElementById('trafego-campanhas');
        if (metrics) {
            metrics.innerHTML = '';
            (data.trafegoPago?.resumo || []).forEach(item => {
                const card = document.createElement('div');
                card.className = 'metric-card';
                card.innerHTML = `<span class="metric-label">${item.label}</span><span class="metric-value">${item.value}</span>`;
                metrics.appendChild(card);
            });
        }
        if (list) {
            list.innerHTML = '';
            (data.trafegoPago?.campanhas || []).forEach(campanha => {
                const card = document.createElement('div');
                card.className = 'list-card';
                card.innerHTML = `
                    <div class="list-card-info">
                        <span class="list-title">${campanha.nome}</span>
                        <span class="list-subtitle">Investimento ${campanha.investimento} • Leads ${campanha.leads} • CPL ${campanha.cpl} • ROAS ${campanha.roas}</span>
                    </div>
                    <span class="badge badge-success">Ativa</span>
                `;
                list.appendChild(card);
            });
        }
    };

    const renderFinanceiro = () => {
        setText('[data-financeiro="receitas"]', data.financeiro?.receitas || 'R$ 0');
        setText('[data-financeiro="despesas"]', data.financeiro?.despesas || 'R$ 0');
        setText('[data-financeiro="saldo"]', data.financeiro?.saldo || 'R$ 0');
        const contas = document.getElementById('financeiro-contas');
        if (!contas) return;
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

    const bindActions = () => {
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            if (action === 'excluir-tarefa') alert('Tarefa excluída (simulado).');
            if (action === 'transferir-tarefa') alert('Transferência de tarefa simulada.');
            if (action === 'solicitar-prazo') alert('Solicitação de prazo enviada.');
            if (action === 'enviar-aprovacao') alert('Post enviado para aprovação.');
            if (action === 'marcar-aprovado') alert('Post marcado como aprovado.');
            if (action === 'editar-post') alert('Edição simulada.');
            if (action === 'baixar-boleto') alert('Boleto baixado (simulado).');
            if (action === 'aprovar-post') alert('Post aprovado.');
            if (action === 'solicitar-ajuste') alert('Ajuste solicitado.');
        });
    };

    const initPage = (routeKey) => {
        if (routeKey === 'home') renderHome();
        if (routeKey === 'clientes') renderClientes();
        if (routeKey === 'tarefas') renderTarefas();
        if (routeKey === 'social-media') renderSocialMedia();
        if (routeKey === 'trafego-pago') renderTrafegoPago();
        if (routeKey === 'financeiro') renderFinanceiro();
        if (routeKey === 'colaboradores') renderColaboradores();
        if (routeKey === 'cliente-dashboard') renderClienteDashboard();
        if (routeKey === 'cliente-insights') renderClienteInsights();
    };

    const init = () => {
        bindActions();
    };

    init();

    return { initPage };
})();
