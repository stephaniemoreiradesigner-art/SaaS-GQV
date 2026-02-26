document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se estamos na página financeira
    if (!window.location.pathname.includes('financeiro.html')) return;

    // Remove tela de loading inicial se existir
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }, 1000);
    }

    // Verificação de Segurança da Conexão com Retry
    let attempts = 0;
    const maxAttempts = 50; 
    
    const checkConnection = setInterval(() => {
        if (!window.supabaseClient && typeof window.initSupabase === 'function') {
            window.initSupabase();
        }

        if (window.supabaseClient) {
            clearInterval(checkConnection);
            console.log('Conexão Supabase estabelecida!');
            startFinanceiro();
        } else {
            attempts++;
            if (attempts % 5 === 0) console.warn(`Aguardando conexão... (${attempts}/${maxAttempts})`);
            
            if (attempts >= maxAttempts) {
                clearInterval(checkConnection);
                console.error('CRÍTICO: Falha total na conexão.');
                
                if (!window.supabase) {
                    alert('Erro Crítico: A biblioteca do Supabase não foi carregada. Verifique se algum bloqueador de anúncios (AdBlock) está impedindo o carregamento ou verifique sua internet.');
                } else {
                    alert('Erro de conexão com o banco de dados. O sistema não conseguiu inicializar. Tente recarregar a página (Ctrl + F5).');
                }
            }
        }
    }, 200); // Tenta a cada 200ms

    async function startFinanceiro() {
        const allowed = await ensureFinanceAccess();
        if (!allowed) return;
        initFinanceiro();
    }

    async function ensureFinanceAccess() {
        const maxWaits = 30;
        let waits = 0;

        while (!window.currentUserData && waits < maxWaits) {
            await new Promise(r => setTimeout(r, 100));
            waits++;
        }

        const userRole = window.currentUserData?.perfil_acesso || 'usuario';
        const permissoes = Array.isArray(window.currentUserData?.permissoes) ? window.currentUserData.permissoes : [];
        const hasPermission = ['super_admin', 'admin', 'financeiro'].includes(userRole) || permissoes.includes('financeiro');

        if (!hasPermission) {
            alert('Você não tem permissão para acessar o módulo Financeiro.');
            window.location.href = 'dashboard.html';
            return false;
        }

        return true;
    }

    // Função global para mudar abas
    window.switchFinanceTab = (tabName) => {
        document.querySelectorAll('.finance-tab-content').forEach(el => el.classList.add('hidden'));
        const tab = document.getElementById(`tab-${tabName}`);
        if (tab) tab.classList.remove('hidden');
        
        // Atualiza estilo dos botões
        const btnLancamentos = document.getElementById('btn-tab-lancamentos');
        const btnFluxo = document.getElementById('btn-tab-fluxo');
        
        if (tabName === 'lancamentos') {
            btnLancamentos.classList.remove('text-gray-500', 'hover:text-[var(--color-primary)]');
            btnLancamentos.classList.add('bg-[var(--color-primary)]', 'text-white', 'shadow-sm');
            
            btnFluxo.classList.remove('bg-[var(--color-primary)]', 'text-white', 'shadow-sm');
            btnFluxo.classList.add('text-gray-500', 'hover:text-[var(--color-primary)]');
        } else {
            btnFluxo.classList.remove('text-gray-500', 'hover:text-[var(--color-primary)]');
            btnFluxo.classList.add('bg-[var(--color-primary)]', 'text-white', 'shadow-sm');
            
            btnLancamentos.classList.remove('bg-[var(--color-primary)]', 'text-white', 'shadow-sm');
            btnLancamentos.classList.add('text-gray-500', 'hover:text-[var(--color-primary)]');
        }
    };

    function initFinanceiro() {
        const form = document.getElementById('form-financeiro');
        const tableBody = document.querySelector('#transactions-table tbody');
        const totalBalanceEl = document.getElementById('total-balance');
        const btnNew = document.getElementById('btn-new-transaction');
        const btnCancel = document.getElementById('btn-cancel');
        const btnCloseModal = document.getElementById('btn-close-modal');
        const formContainer = document.getElementById('transaction-modal');
        const modalBackdrop = document.getElementById('modal-backdrop');
        
        let currentEditId = null; // Variável para rastrear se estamos editando

        // Funções Auxiliares para Modal
        const openModal = () => {
            formContainer.classList.remove('hidden');
            // Pequeno delay para permitir a transição CSS se houver
            setTimeout(() => {
                formContainer.querySelector('.modal-content-transition').classList.remove('scale-95', 'opacity-0');
                formContainer.querySelector('.modal-content-transition').classList.add('scale-100', 'opacity-100');
            }, 10);
        };

        const closeModal = () => {
            formContainer.querySelector('.modal-content-transition').classList.remove('scale-100', 'opacity-100');
            formContainer.querySelector('.modal-content-transition').classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                formContainer.classList.add('hidden');
                form.reset();
                currentEditId = null;
            }, 300);
        };

        // Toggle Form
        if(btnNew) {
            btnNew.addEventListener('click', () => {
                currentEditId = null; // Reset para modo criação
                form.reset();
                document.getElementById('arquivo_url').value = '';
                document.getElementById('boleto-preview').classList.add('hidden');
                document.getElementById('form-title').innerText = 'Novo Lançamento';
                document.getElementById('btn-save').innerText = 'Salvar';
                
                openModal();
                document.getElementById('data').valueAsDate = new Date();
            });
        }

        if(btnCancel) btnCancel.addEventListener('click', closeModal);
        if(btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
        if(modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

        // Fechar ao clicar fora
        if(formContainer) {
            formContainer.addEventListener('click', (e) => {
                if (e.target === formContainer) closeModal();
            });
        }


        // Função para atualizar labels de Status dinamicamente
        const tipoSelect = document.getElementById('tipo');
        const statusSelect = document.getElementById('status');

        if(tipoSelect && statusSelect) {
            tipoSelect.addEventListener('change', () => {
                const tipo = tipoSelect.value;
                const options = statusSelect.options;

                if (tipo === 'saida') {
                    options[0].text = 'Pago';
                    options[1].text = 'À Pagar';
                } else {
                    options[0].text = 'Recebido';
                    options[1].text = 'À Vencer';
                }
            });
        }

        // Carregar Transações
        loadTransactions();
        
        // Carregar Categorias
        loadCategoriesForSelect();

        // Salvar Transação (Criar ou Atualizar)
        if(form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const desc = document.getElementById('desc').value;
                const valor = parseFloat(document.getElementById('valor').value);
                const tipo = document.getElementById('tipo').value;
                const categoria = document.getElementById('categoria').value;
                const status = document.getElementById('status').value;
                const data = document.getElementById('data').value;
                const arquivoUrlInput = document.getElementById('arquivo_url').value;
                const fileInput = document.getElementById('arquivo_boleto');
                
                let finalArquivoUrl = arquivoUrlInput;

                // Pega o ID do usuário logado
                const { data: { user }, error: authError } = await window.supabaseClient.auth.getUser();
                
                if (authError || !user) {
                    console.warn('Usuário não autenticado:', authError);
                    alert('Sessão expirada. Por favor, faça login novamente.');
                    window.location.href = 'index.html'; // Redireciona para o login
                    return;
                }

                try {
                    let error;
                    
                    // Mostra loading no botão
                    const btnSave = document.getElementById('btn-save');
                    const originalBtnText = btnSave.innerText;
                    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
                    btnSave.disabled = true;

                    // Upload de Arquivo se houver
                    if (fileInput.files.length > 0) {
                        const file = fileInput.files[0];
                        const fileExt = file.name.split('.').pop();
                        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                        const filePath = `${user.id}/${fileName}`; // Organizar por usuário
                        
                        // Upload
                        const { error: uploadError } = await window.supabaseClient.storage
                            .from('boletos')
                            .upload(filePath, file);
                        
                        if (uploadError) {
                            // Se o bucket não existir, tenta criar (embora client-side geralmente não permita)
                            // ou apenas alerta. Vamos assumir que 'boletos' deve existir ou 'financeiro'
                            console.error('Erro upload:', uploadError);
                            // Fallback tentativo para bucket 'financeiro' se 'boletos' falhar? 
                            // Melhor lançar erro para feedback
                            throw new Error('Erro ao fazer upload do boleto: ' + uploadError.message);
                        }

                        // Get Public URL
                        const { data: publicUrlData } = window.supabaseClient.storage
                            .from('boletos')
                            .getPublicUrl(filePath);
                            
                        finalArquivoUrl = publicUrlData.publicUrl;
                    }

                    if (currentEditId) {
                        // Modo Edição: UPDATE
                        const response = await window.supabaseClient
                            .from('financeiro')
                            .update({
                                descricao: desc,
                                valor: valor,
                                tipo: tipo,
                                categoria: categoria,
                                status: status,
                                data_transacao: data,
                                arquivo_url: finalArquivoUrl,
                                user_id: user.id
                            })
                            .eq('id', currentEditId);
                        error = response.error;
                    } else {
                        // Modo Criação: INSERT
                        const response = await window.supabaseClient
                            .from('financeiro')
                            .insert([{
                                descricao: desc,
                                valor: valor,
                                tipo: tipo,
                                categoria: categoria,
                                status: status,
                                data_transacao: data,
                                arquivo_url: finalArquivoUrl,
                                user_id: user.id
                            }]);
                        error = response.error;
                    }

                    if (error) throw error;

                    // Feedback visual (Toast seria melhor, mas alert serve por enquanto)
                    // alert(currentEditId ? 'Lançamento atualizado!' : 'Lançamento salvo!');
                    
                    closeModal();
                    loadTransactions(); 

                } catch (error) {
                    console.error('Erro ao salvar:', error);
                    alert('Erro ao salvar: ' + error.message);
                } finally {
                    const btnSave = document.getElementById('btn-save');
                    btnSave.innerText = currentEditId ? 'Atualizar' : 'Salvar';
                    btnSave.disabled = false;
                }
            });
        }

        // Função para carregar dados
        async function loadTransactions() {
            try {
                // ... (código existente)
                const { data, error } = await window.supabaseClient
                    .from('financeiro')
                    .select('*')
                    .order('data_transacao', { ascending: false });

                if (error) throw error;

                // Filtrar para o mês corrente para a TABELA
                const hoje = new Date();
                const currentMonth = hoje.getMonth();
                const currentYear = hoje.getFullYear();

                const transactionsDoMes = data.filter(t => {
                    if (!t.data_transacao) return false;
                    const parts = t.data_transacao.split('-');
                    const tYear = parseInt(parts[0]);
                    const tMonth = parseInt(parts[1]) - 1;
                    return tYear === currentYear && tMonth === currentMonth;
                });

                renderTable(transactionsDoMes); // Tabela só mostra mês atual
                calculateBalance(data); // Balance usa TODOS os dados para cálculo correto de saldo acumulado
                
                try {
                    if (typeof processAndRenderCharts === 'function') {
                        processAndRenderCharts(transactionsDoMes); // Gráficos do mês ou total? Geralmente dashboard é do mês.
                    }
                } catch (chartError) {
                    console.error('Erro ao renderizar gráficos:', chartError);
                }

            } catch (error) {
                console.error('Erro ao carregar transações:', error);
            }
        }

        // Listener para atualizar quando automação rodar
        window.addEventListener('mensalidades_atualizadas', () => {
            console.log('🔄 Atualizando tabela financeira após automação...');
            loadTransactions();
        });

        // Renderizar Tabela
        function renderTable(transactions = []) {
            if (!tableBody) {
                console.error('Tbody não encontrado');
                return;
            }
            tableBody.innerHTML = '';

            if (!transactions || transactions.length === 0) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center p-10 text-gray-400">
                            Nenhum lançamento encontrado neste mês.
                        </td>
                    </tr>
                `;
                return;
            }

            console.log(`Renderizando ${transactions.length} transações`);

            transactions.forEach(t => {
                try {
                    const row = document.createElement('tr');
                    row.className = 'hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0';
                    
                    // Tratamento seguro de valores
                    const valorNum = parseFloat(t.valor);
                    const valorFormatado = isNaN(valorNum) 
                        ? 'R$ 0,00' 
                        : valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    
                    // Classes e Labels baseados no tipo
                    const tipoLabel = t.tipo === 'entrada' ? 'Entrada' : 'Saída';
                    const tipoBadgeClass = t.tipo === 'entrada' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700';
                    
                    // Status
                    let statusHtml = '';
                    if(t.status === 'recebido' || t.status === 'pago') {
                        statusHtml = '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600"><i class="fas fa-check text-xs"></i></span>';
                    } else {
                        statusHtml = '<span class="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-600"><i class="fas fa-clock text-xs"></i></span>';
                    }

                    // Tratamento seguro de datas
                    let dataDisplay = '-';
                    if (t.data_transacao) {
                        const dateObj = new Date(t.data_transacao);
                        if (!isNaN(dateObj)) {
                            // Usando UTC para evitar problemas de fuso horário com datas YYYY-MM-DD
                            const userTimezoneOffset = dateObj.getTimezoneOffset() * 60000;
                            const adjustedDate = new Date(dateObj.getTime() + userTimezoneOffset);
                            dataDisplay = adjustedDate.toLocaleDateString('pt-BR'); 
                        }
                    }

                    const categoriaDisplay = t.categoria || 'Sem Categoria';
                    const descDisplay = t.descricao || 'Sem Descrição';
                    
                    // Ícone de Anexo
                    let anexoHtml = '';
                    if (t.arquivo_url) {
                        anexoHtml = `<a href="${t.arquivo_url}" target="_blank" class="text-blue-500 hover:text-blue-700 ml-2" title="Ver Boleto/Anexo"><i class="fas fa-paperclip"></i></a>`;
                    }

                    row.innerHTML = `
                        <td class="p-4 font-medium text-gray-900">${dataDisplay}</td>
                        <td class="p-4 text-gray-600 font-medium">
                            ${descDisplay}
                            ${anexoHtml}
                        </td>
                        <td class="p-4">
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                ${categoriaDisplay}
                            </span>
                        </td>
                        <td class="p-4 text-center">${statusHtml}</td>
                        <td class="p-4 text-center">
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoBadgeClass}">
                                ${tipoLabel}
                            </span>
                        </td>
                        <td class="p-4 text-right font-bold ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}">
                            ${t.tipo === 'saida' ? '-' : '+'} ${valorFormatado}
                        </td>
                        <td class="p-4 text-right">
                            <div class="flex items-center justify-end gap-2">
                                <button class="p-1.5 text-gray-400 hover:text-[var(--color-primary)] hover:bg-purple-50 rounded transition-colors" onclick="editTransaction(${t.id})" title="Editar">
                                    <i class="fas fa-pencil-alt"></i>
                                </button>
                                <button class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" onclick="deleteTransaction(${t.id})" title="Excluir">
                                    <i class="fas fa-trash-alt"></i>
                                </button>
                            </div>
                        </td>
                    `;
                    tableBody.appendChild(row);
                } catch (err) {
                    console.error('Erro ao renderizar linha:', err, t);
                }
            });
        }

        // Calcular Saldo e KPIs
        function calculateBalance(transactions) {
            // Variáveis Globais (Para Saldo Líquido)
            let globalRecebidos = 0;
            let globalPagos = 0;

            // Variáveis Mensais (Para Cards de KPIs)
            let monthRecebidos = 0;
            let monthAVencer = 0;
            let monthVencido = 0;
            let monthDespesasAVencer = 0;
            let monthDespesasPagas = 0;

            const hoje = new Date();
            hoje.setHours(0,0,0,0);
            
            const currentMonth = hoje.getMonth();
            const currentYear = hoje.getFullYear();

            transactions.forEach(t => {
                const valor = parseFloat(t.valor);
                
                // Parse Data
                let isCurrentMonth = false;
                if (t.data_transacao) {
                    const parts = t.data_transacao.split('-');
                    const tYear = parseInt(parts[0]);
                    const tMonth = parseInt(parts[1]) - 1;
                    if (tYear === currentYear && tMonth === currentMonth) {
                        isCurrentMonth = true;
                    }
                }

                const dataVencimento = new Date(t.data_transacao);
                // Ajuste fuso horário simples
                dataVencimento.setMinutes(dataVencimento.getMinutes() + dataVencimento.getTimezoneOffset());
                dataVencimento.setHours(0,0,0,0);

                // Lógica Global (Saldo Líquido)
                if (t.tipo === 'entrada' && t.status === 'recebido') {
                    globalRecebidos += valor;
                } else if (t.tipo === 'saida' && (t.status === 'pago' || t.status === 'recebido')) {
                    globalPagos += valor;
                }

                // Lógica Mensal (Cards) - Apenas se for do mês corrente
                // OBS: Para "Vencido" talvez faça sentido mostrar de todo o passado? 
                // O usuário pediu "lançamentos somente do mês", geralmente KPIs seguem a visualização.
                // Vou manter KPIs estritos ao mês para Recebidos/Pagos, mas Vencido geralmente é acumulativo de dívida.
                // Mas para simplificar e atender "foco no mês", vou filtrar tudo pelo mês, EXCETO Saldo Líquido.
                
                // Exceção: Vencido (Entradas) e Despesas à Vencer (Saídas) se forem antigas e não pagas, deveriam aparecer?
                // Se eu filtrar só mês, escondo dívidas antigas.
                // Vou manter VENCIDO como GLOBAL (acumulado), pois é dívida.
                // À VENCER: Apenas futuro (mas se for mês que vem?). O card diz "À Vencer". Se filtrar pelo mês corrente, só mostra o que vence ESTE mês. Isso faz sentido para "Visão do Mês".
                
                if (t.tipo === 'entrada') {
                    if (t.status === 'recebido') {
                        if (isCurrentMonth) monthRecebidos += valor;
                    } else if (t.status === 'a_vencer') {
                        if (dataVencimento < hoje) {
                            // Vencido: Mostra tudo ou só do mês? Vamos mostrar tudo que está vencido, alerta global.
                            monthVencido += valor; 
                        } else {
                            // À Vencer: Só deste mês
                            if (isCurrentMonth) monthAVencer += valor;
                        }
                    }
                } else if (t.tipo === 'saida') {
                    if (t.status === 'recebido' || t.status === 'pago') { 
                        if (isCurrentMonth) monthDespesasPagas += valor;
                    } else {
                        // À Pagar
                        if (isCurrentMonth) monthDespesasAVencer += valor;
                    }
                }
            });

            // O Saldo Total (Líquido) = Recebidos Global - Saídas Pagas Global
            const saldoLiquido = globalRecebidos - globalPagos;

            // Atualiza UI
            const formatCurrency = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            if(document.getElementById('total-recebidos'))
                document.getElementById('total-recebidos').innerText = formatCurrency(monthRecebidos);
            
            if(document.getElementById('total-a-vencer'))
                document.getElementById('total-a-vencer').innerText = formatCurrency(monthAVencer);
            
            if(document.getElementById('total-vencido'))
                document.getElementById('total-vencido').innerText = formatCurrency(monthVencido);
            
            if(document.getElementById('total-despesas-a-vencer'))
                document.getElementById('total-despesas-a-vencer').innerText = formatCurrency(monthDespesasAVencer);
            
            if(document.getElementById('total-despesas-pagas'))
                document.getElementById('total-despesas-pagas').innerText = formatCurrency(monthDespesasPagas);
            
            // Saldo Roxo (GLOBAL)
            totalBalanceEl.innerText = formatCurrency(saldoLiquido);
        }

        // Função global para editar (dentro do escopo para acessar variáveis)
        window.editTransaction = async (id) => {
            try {
                const { data, error } = await window.supabaseClient
                    .from('financeiro')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error) throw error;

                // Preenche o formulário
                document.getElementById('desc').value = data.descricao;
                document.getElementById('valor').value = data.valor;
                document.getElementById('tipo').value = data.tipo;
                document.getElementById('categoria').value = data.categoria || 'Outros';
                document.getElementById('status').value = data.status;
                document.getElementById('data').value = data.data_transacao;
                document.getElementById('arquivo_url').value = data.arquivo_url || '';
                
                // Atualiza label do status baseado no tipo
                const event = new Event('change');
                document.getElementById('tipo').dispatchEvent(event);
                // Restaura o valor do status pois o change event pode ter resetado
                document.getElementById('status').value = data.status;

                // Preview do Boleto
                const previewDiv = document.getElementById('boleto-preview');
                const btnView = document.getElementById('btn-view-boleto');
                if (data.arquivo_url) {
                    previewDiv.classList.remove('hidden');
                    btnView.href = data.arquivo_url;
                } else {
                    previewDiv.classList.add('hidden');
                    btnView.href = '#';
                }

                currentEditId = id;
                document.getElementById('form-title').innerText = 'Editar Lançamento';
                document.getElementById('btn-save').innerText = 'Atualizar';
                
                openModal();

            } catch (error) {
                console.error('Erro ao editar:', error);
                alert('Erro ao carregar dados da transação.');
            }
        };

        // Função global para deletar (precisa estar no window)
        window.deleteTransaction = async (id) => {
            if (!window.supabaseClient) {
                alert('Erro de conexão. Recarregue a página.');
                return;
            }

            if (confirm('Tem certeza que deseja excluir este lançamento?')) {
                try {
                    const { error } = await window.supabaseClient
                        .from('financeiro')
                        .delete()
                        .eq('id', id);

                    if (error) throw error;
                    loadTransactions();
                } catch (error) {
                    alert('Erro ao excluir: ' + error.message);
                }
            }
        };

        // --- NOVAS FUNÇÕES DO FINANCEIRO (Gráficos e Categorias) ---

        async function loadCategoriesForSelect() {
            const select = document.getElementById('categoria');
            if (!select) return;

            try {
                const { data, error } = await window.supabaseClient
                    .from('categorias_financeiro')
                    .select('nome')
                    .order('nome');

                if (error) {
                    if (error.code !== '42P01') console.error('Erro ao carregar categorias:', error);
                    return; // Mantém opções padrão se erro ou tabela inexistente
                }

                if (data && data.length > 0) {
                    select.innerHTML = '';
                    data.forEach(cat => {
                        const option = document.createElement('option');
                        option.value = cat.nome;
                        option.text = cat.nome;
                        select.appendChild(option);
                    });
                    // Adicionar opção "Outros" se não existir
                    if (!data.find(c => c.nome === 'Outros')) {
                         const opt = document.createElement('option');
                         opt.value = 'Outros';
                         opt.text = 'Outros';
                         select.appendChild(opt);
                    }
                }
            } catch (err) {
                console.error('Erro cat:', err);
            }
        }

        let chartLine = null;
        let chartDoughnut = null;

        // Processar dados e renderizar gráficos Chart.js
        window.processAndRenderCharts = (transactions) => {
            const chartCategoriasEl = document.getElementById('chart-categorias');
            const chartRoscaEl = document.getElementById('chart-rosca');

            if (!chartCategoriasEl || !chartRoscaEl) return;

            // 1. Agrupar por Categoria
            const categoriasMap = {};
            transactions.forEach(t => {
                const cat = t.categoria || 'Outros';
                const val = parseFloat(t.valor);
                if (!categoriasMap[cat]) categoriasMap[cat] = 0;
                categoriasMap[cat] += val;
            });

            const catLabels = Object.keys(categoriasMap);
            const catValues = Object.values(categoriasMap);

            // 2. Entradas vs Saídas
            let totalEntrada = 0;
            let totalSaida = 0;
            transactions.forEach(t => {
                if (t.tipo === 'entrada') totalEntrada += parseFloat(t.valor);
                else totalSaida += parseFloat(t.valor);
            });

            // Atualiza barras de progresso
            const hoje = new Date();
            const mesAtual = hoje.getMonth();
            const anoAtual = hoje.getFullYear();
            
            // Filtra transações do mês atual para as barras
            const transacoesMes = transactions.filter(t => {
                const d = new Date(t.data_transacao);
                // Ajuste timezone
                d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
                return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
            });

            let entradasMes = 0;
            let saidasMes = 0;
            transacoesMes.forEach(t => {
                if (t.tipo === 'entrada' && t.status === 'recebido') entradasMes += parseFloat(t.valor);
                if (t.tipo === 'saida' && (t.status === 'pago' || t.status === 'recebido')) saidasMes += parseFloat(t.valor);
            });

            // Metas fictícias ou baseadas em histórico (aqui fixo para exemplo visual)
            const metaEntrada = entradasMes * 1.5 || 1000; // Exemplo
            const metaSaida = saidasMes * 1.2 || 1000;

            const percEntrada = Math.min((entradasMes / metaEntrada) * 100, 100).toFixed(0);
            const percSaida = Math.min((saidasMes / metaSaida) * 100, 100).toFixed(0);

            if(document.getElementById('perc-recebidos')) document.getElementById('perc-recebidos').innerText = `R$ ${entradasMes.toLocaleString('pt-BR')}`;
            if(document.getElementById('perc-pagos')) document.getElementById('perc-pagos').innerText = `R$ ${saidasMes.toLocaleString('pt-BR')}`;
            
            if(document.getElementById('bar-recebidos')) document.getElementById('bar-recebidos').style.width = `${percEntrada}%`;
            if(document.getElementById('bar-pagos')) document.getElementById('bar-pagos').style.width = `${percSaida}%`;

            // --- Chart.js: Categorias (Bar Chart) ---
            if (chartLine) chartLine.destroy();
            chartLine = new Chart(chartCategoriasEl, {
                type: 'bar',
                data: {
                    labels: catLabels,
                    datasets: [{
                        label: 'Total por Categoria',
                        data: catValues,
                        backgroundColor: 'rgba(128, 90, 213, 0.6)',
                        borderColor: 'rgba(128, 90, 213, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                display: true,
                                drawBorder: false,
                                color: '#f3f4f6'
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            }
                        }
                    },
                    plugins: {
                        legend: { display: false }
                    }
                }
            });

            // --- Chart.js: Rosca (Doughnut) ---
            if (chartDoughnut) chartDoughnut.destroy();
            chartDoughnut = new Chart(chartRoscaEl, {
                type: 'doughnut',
                data: {
                    labels: ['Entradas', 'Saídas'],
                    datasets: [{
                        data: [totalEntrada, totalSaida],
                        backgroundColor: [
                            '#48bb78', // Green
                            '#f56565'  // Red
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    },
                    cutout: '70%'
                }
            });
        };
    }
});
