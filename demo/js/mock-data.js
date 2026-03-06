window.demoData = {
    clientes: [
        { id: 1, nome: 'NP2 Marmoraria', plano: 'Pro', responsavel: 'Ana Souza', segmento: 'Arquitetura', status: 'Ativo' },
        { id: 2, nome: 'UseEPI', plano: 'Essencial', responsavel: 'Bruno Lima', segmento: 'Indústria', status: 'Ativo' },
        { id: 3, nome: 'Casa Madé', plano: 'Pro', responsavel: 'Carla Duarte', segmento: 'Decoração', status: 'Ativo' },
        { id: 4, nome: 'Desperta TDAH', plano: 'Growth', responsavel: 'Diego Rocha', segmento: 'Saúde', status: 'Em expansão' },
        { id: 5, nome: 'WorldSign', plano: 'Essencial', responsavel: 'Fernanda Melo', segmento: 'Comunicação', status: 'Ativo' },
        { id: 6, nome: 'Clínica Vital', plano: 'Pro', responsavel: 'Gabriel Costa', segmento: 'Saúde', status: 'Ativo' }
    ],
    tarefas: [
        { id: 1, titulo: 'Criar calendário de março', cliente: 'NP2 Marmoraria', responsavel: 'Ana Souza', prazo: '2026-03-12', status: 'Em andamento', prioridade: 'Alta' },
        { id: 2, titulo: 'Revisar campanha Meta', cliente: 'UseEPI', responsavel: 'Bruno Lima', prazo: '2026-03-15', status: 'Pendente', prioridade: 'Média' },
        { id: 3, titulo: 'Ajustar legenda institucional', cliente: 'Casa Madé', responsavel: 'Carla Duarte', prazo: '2026-03-18', status: 'Em revisão', prioridade: 'Baixa' },
        { id: 4, titulo: 'Solicitar criativo promocional', cliente: 'Clínica Vital', responsavel: 'Gabriel Costa', prazo: '2026-03-20', status: 'Pendente', prioridade: 'Alta' }
    ],
    atividades: [
        { hora: '09:10', descricao: 'Calendário de março enviado para aprovação • NP2 Marmoraria' },
        { hora: '10:35', descricao: 'Relatório de mídia atualizado • UseEPI' },
        { hora: '11:05', descricao: 'Novo criativo solicitado • Casa Madé' },
        { hora: '12:20', descricao: 'Campanha Meta otimizada • Clínica Vital' }
    ],
    operacao: {
        projetosAtivos: 18,
        nivelSaude: 'Estável',
        pendencias: 5,
        aprovacoes: 7
    },
    socialMedia: {
        hub: [
            { titulo: 'Hub Operacional', valor: '92% OK', destaque: 'Produção em ritmo' },
            { titulo: 'Calendários pendentes', valor: '3', destaque: '2 clientes aguardando' },
            { titulo: 'Aprovações pendentes', valor: '7', destaque: 'Priorização alta' },
            { titulo: 'Insights', valor: 'Atualizados', destaque: 'Últimos 7 dias' },
            { titulo: 'Relatórios', valor: '4 prontos', destaque: 'Prontos para envio' },
            { titulo: 'Criativos', valor: '6 solicitações', destaque: 'Em produção' }
        ],
        statuses: ['Rascunho', 'Em ajuste', 'Aguardando aprovação', 'Aprovado']
    },
    socialPosts: [
        { id: 101, data: '2026-03-04', tema: 'Linha premium em destaque', legenda: 'O acabamento perfeito começa na escolha certa. Conheça nossa linha premium.', cta: 'Agende seu orçamento', hashtags: '#marmoraria #design', criativo: 'Imagem comparativa antes/depois', status: 'Rascunho' },
        { id: 102, data: '2026-03-07', tema: 'Segurança no trabalho', legenda: 'A segurança da equipe é prioridade. Treinamento e EPI adequados fazem a diferença.', cta: 'Solicite catálogo', hashtags: '#seguranca #epi', criativo: 'Carrossel com checklist', status: 'Aguardando aprovação' },
        { id: 103, data: '2026-03-12', tema: 'Coleção artesanal', legenda: 'Detalhes que transformam ambientes em experiências únicas.', cta: 'Fale com nosso time', hashtags: '#decor #artesanato', criativo: 'Reels com bastidores', status: 'Aprovado' },
        { id: 104, data: '2026-03-16', tema: 'Bem-estar em foco', legenda: 'Cuidar da mente é parte do seu crescimento. Entenda nossos próximos encontros.', cta: 'Inscreva-se', hashtags: '#saude #tdah', criativo: 'Imagem com agenda', status: 'Rascunho' },
        { id: 105, data: '2026-03-21', tema: 'Case de instalação', legenda: 'Do briefing ao acabamento final: veja o resultado.', cta: 'Solicite visita', hashtags: '#case #arquitetura', criativo: 'Antes/depois em carrossel', status: 'Em ajuste' }
    ],
    trafegoPago: {
        periodos: {
            '7d': { investimento: 'R$ 6.200', leads: '320', cpl: 'R$ 19,40', roas: '3,6x', conversoes: '86' },
            '30d': { investimento: 'R$ 24.500', leads: '1.240', cpl: 'R$ 19,75', roas: '4,1x', conversoes: '342' },
            '90d': { investimento: 'R$ 71.800', leads: '3.820', cpl: 'R$ 18,80', roas: '4,4x', conversoes: '980' }
        },
        redes: {
            meta: { investimento: 'R$ 9.200', leads: '470', cpl: 'R$ 19,60', roas: '4,0x', conversoes: '128' },
            google: { investimento: 'R$ 10.800', leads: '520', cpl: 'R$ 20,10', roas: '4,3x', conversoes: '146' },
            linkedin: { investimento: 'R$ 4.500', leads: '250', cpl: 'R$ 18,00', roas: '3,7x', conversoes: '68' }
        },
        campanhas: [
            { id: 1, nome: 'Meta - Conversão', rede: 'Meta', investimento: 'R$ 8.500', leads: 420, cpl: 'R$ 20,20', roas: '3,9x', status: 'Ativa', budget: 8500 },
            { id: 2, nome: 'Google - Pesquisa', rede: 'Google', investimento: 'R$ 9.200', leads: 510, cpl: 'R$ 18,04', roas: '4,6x', status: 'Ativa', budget: 9200 },
            { id: 3, nome: 'LinkedIn - B2B', rede: 'LinkedIn', investimento: 'R$ 6.800', leads: 310, cpl: 'R$ 21,93', roas: '3,7x', status: 'Em teste', budget: 6800 }
        ],
        criativos: [
            { titulo: 'Vídeo depoimento', canal: 'Meta', ctr: '2,8%', cpa: 'R$ 42' },
            { titulo: 'Carrossel benefício', canal: 'Google', ctr: '3,1%', cpa: 'R$ 38' },
            { titulo: 'Banner institucional', canal: 'LinkedIn', ctr: '1,9%', cpa: 'R$ 52' }
        ]
    },
    financeiro: {
        receitas: 'R$ 185.300',
        despesas: 'R$ 92.400',
        saldo: 'R$ 92.900',
        contas: [
            { descricao: 'Assinatura Cloud', valor: 'R$ 1.250', vencimento: '2026-03-08' },
            { descricao: 'Serviços de mídia', valor: 'R$ 8.900', vencimento: '2026-03-15' },
            { descricao: 'Ferramentas externas', valor: 'R$ 2.100', vencimento: '2026-03-20' }
        ],
        historico: [
            { descricao: 'Mensalidade NP2 Marmoraria', valor: 'R$ 12.000', status: 'Pago' },
            { descricao: 'Mensalidade UseEPI', valor: 'R$ 9.500', status: 'Pago' },
            { descricao: 'Mensalidade Casa Madé', valor: 'R$ 11.200', status: 'Em aberto' }
        ]
    },
    colaboradores: [
        { nome: 'Ana Souza', cargo: 'Gestora de Contas', projetos: 5, produtividade: '88%' },
        { nome: 'Bruno Lima', cargo: 'Analista de Mídia', projetos: 4, produtividade: '82%' },
        { nome: 'Carla Duarte', cargo: 'Social Media', projetos: 6, produtividade: '91%' },
        { nome: 'Diego Rocha', cargo: 'Copywriter', projetos: 3, produtividade: '79%' }
    ],
    painelCliente: {
        calendarioAprovacao: 2,
        postsAprovacao: 6,
        campanhasAtivas: 3,
        proximaFaturaDias: 9,
        atalhos: [
            { titulo: 'Aprovar calendário', rota: '#/calendario' },
            { titulo: 'Ver posts', rota: '#/posts' },
            { titulo: 'Solicitar campanha', rota: '#/campanhas' },
            { titulo: 'Baixar boleto', rota: '#/financeiro' }
        ],
        calendario: [
            { id: 201, data: '2026-03-05', tema: 'Post institucional', status: 'Aguardando aprovação' },
            { id: 202, data: '2026-03-12', tema: 'Campanha promocional', status: 'Aguardando aprovação' }
        ],
        posts: [
            { id: 301, tema: 'Inovação em saúde', legenda: 'Avanços que impactam o dia a dia.', status: 'Aguardando aprovação' },
            { id: 302, tema: 'Semana de prevenção', legenda: 'Dicas rápidas para cuidar da equipe.', status: 'Aguardando aprovação' }
        ],
        redes: {
            instagram: { alcance: '58k', engajamento: '5,2%', seguidores: '12,4k' },
            facebook: { alcance: '34k', engajamento: '3,8%', seguidores: '8,1k' },
            google: { impressoes: '92k', cliques: '4.8k', ctr: '5,2%', conversoes: '184', cpc: 'R$ 2,35' },
            linkedin: { alcance: '18k', engajamento: '4,4%', seguidores: '3,2k' }
        },
        faturas: [
            { descricao: 'Mensalidade março', valor: 'R$ 4.500', status: 'Em aberto', vencimento: '2026-03-15' },
            { descricao: 'Mensalidade fevereiro', valor: 'R$ 4.500', status: 'Pago', vencimento: '2026-02-15' }
        ]
    }
};
