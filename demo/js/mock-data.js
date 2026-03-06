window.demoData = {
    clientes: [
        { id: 1, nome: 'NP2 Marmoraria', plano: 'Pro', responsavel: 'Ana Souza' },
        { id: 2, nome: 'UseEPI', plano: 'Essencial', responsavel: 'Bruno Lima' },
        { id: 3, nome: 'Casa Madé', plano: 'Pro', responsavel: 'Carla Duarte' },
        { id: 4, nome: 'Desperta TDAH', plano: 'Growth', responsavel: 'Diego Rocha' },
        { id: 5, nome: 'WorldSign', plano: 'Essencial', responsavel: 'Fernanda Melo' },
        { id: 6, nome: 'Clínica Vital', plano: 'Pro', responsavel: 'Gabriel Costa' }
    ],
    tarefas: [
        { id: 1, titulo: 'Criar calendário de março', cliente: 'NP2 Marmoraria', responsavel: 'Ana Souza', prazo: '2026-03-12', status: 'Em andamento' },
        { id: 2, titulo: 'Revisar campanha Meta', cliente: 'UseEPI', responsavel: 'Bruno Lima', prazo: '2026-03-15', status: 'Pendente' },
        { id: 3, titulo: 'Ajustar legenda institucional', cliente: 'Casa Madé', responsavel: 'Carla Duarte', prazo: '2026-03-18', status: 'Em revisão' },
        { id: 4, titulo: 'Solicitar criativo promocional', cliente: 'Clínica Vital', responsavel: 'Gabriel Costa', prazo: '2026-03-20', status: 'Pendente' }
    ],
    socialPosts: [
        { id: 101, data: '2026-03-04', tema: 'Linha premium em destaque', legenda: 'O acabamento perfeito começa na escolha certa. Conheça nossa linha premium.', cta: 'Agende seu orçamento', hashtags: '#marmoraria #design', criativo: 'Imagem comparativa antes/depois', status: 'Rascunho' },
        { id: 102, data: '2026-03-07', tema: 'Segurança no trabalho', legenda: 'A segurança da equipe é prioridade. Treinamento e EPI adequados fazem a diferença.', cta: 'Solicite catálogo', hashtags: '#seguranca #epi', criativo: 'Carrossel com checklist', status: 'Aguardando aprovação' },
        { id: 103, data: '2026-03-12', tema: 'Coleção artesanal', legenda: 'Detalhes que transformam ambientes em experiências únicas.', cta: 'Fale com nosso time', hashtags: '#decor #artesanato', criativo: 'Reels com bastidores', status: 'Aprovado' },
        { id: 104, data: '2026-03-16', tema: 'Bem-estar em foco', legenda: 'Cuidar da mente é parte do seu crescimento. Entenda nossos próximos encontros.', cta: 'Inscreva-se', hashtags: '#saude #tdah', criativo: 'Imagem com agenda', status: 'Rascunho' }
    ],
    trafegoPago: {
        resumo: [
            { label: 'Investimento', value: 'R$ 24.500' },
            { label: 'Leads', value: '1.240' },
            { label: 'CPL', value: 'R$ 19,75' },
            { label: 'ROAS', value: '4,1x' }
        ],
        campanhas: [
            { nome: 'Meta - Conversão', investimento: 'R$ 8.500', leads: 420, cpl: 'R$ 20,20', roas: '3,9x' },
            { nome: 'Google - Pesquisa', investimento: 'R$ 9.200', leads: 510, cpl: 'R$ 18,04', roas: '4,6x' },
            { nome: 'LinkedIn - B2B', investimento: 'R$ 6.800', leads: 310, cpl: 'R$ 21,93', roas: '3,7x' }
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
        redes: {
            instagram: { alcance: '58k', engajamento: '5,2%', seguidores: '12,4k' },
            facebook: { alcance: '34k', engajamento: '3,8%', seguidores: '8,1k' },
            google: { alcance: '92k', engajamento: '6,1%', seguidores: '2,4k' },
            linkedin: { alcance: '18k', engajamento: '4,4%', seguidores: '3,2k' }
        }
    }
};
