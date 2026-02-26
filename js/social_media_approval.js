
const POST_STATUS = window.POST_STATUS;
const POST_STATUS_LABEL = window.POST_STATUS_LABEL || {};

async function loadApprovalClients() {
    const select = document.getElementById('approval-client-select');
    if (!select || select.options.length > 1) return;

    try {
        const { data: clients, error } = await window.supabaseClient
            .from('clientes')
            .select('id, nome_fantasia')
            .order('nome_fantasia');
        
        if (error) throw error;
        
        clients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nome_fantasia;
            select.appendChild(opt);
        });
    } catch (e) { console.error('Erro ao carregar clientes:', e); }
}

async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const sessionResult = await window.supabaseClient?.auth?.getSession();
    const token = sessionResult?.data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

const APPROVAL_MEDIA_BUCKET = 'social_media_uploads';
let approvalRangeFrom = null;
let approvalRangeTo = null;
let approvalCompletePosts = [];
let approvalMissingPosts = [];

function normalizeMedias(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

function getLegacyMedias(post) {
    const list = [];
    if (post?.imagem_url) list.push({ public_url: post.imagem_url });
    if (post?.video_url) list.push({ public_url: post.video_url });
    if (post?.arquivo_url) list.push({ public_url: post.arquivo_url });
    return list;
}

function getPostMedias(post) {
    const normalized = normalizeMedias(post?.medias);
    if (normalized.length) return normalized;
    return getLegacyMedias(post);
}

function getPublicUrlFromPath(path) {
    if (!path || !window.supabaseClient?.storage) return '';
    const { data } = window.supabaseClient.storage.from(APPROVAL_MEDIA_BUCKET).getPublicUrl(path);
    return data?.publicUrl || '';
}

function resolvePreviewUrl(post) {
    const medias = getPostMedias(post);
    const primary = medias.find((item) => item && (item.public_url || item.path)) || null;
    if (primary?.public_url) return primary.public_url;
    if (primary?.path) return getPublicUrlFromPath(primary.path);
    return post.imagem_url || post.video_url || post.arquivo_url || '';
}

function showApprovalFeedback(message, type = 'success') {
    if (window.showToast) {
        window.showToast(message, type);
        return;
    }
    alert(message);
}

async function sendMonthlyApproval() {
    if (!currentClienteId || !currentMonth) {
        alert('Selecione um cliente e um mês primeiro.');
        return;
    }
    const btnApprove = document.getElementById('btn-approve');
    if (typeof setButtonLoading === 'function') {
        setButtonLoading(btnApprove, true, 'Enviando...');
    }
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/client/calendar/approvals/submit?month=${encodeURIComponent(currentMonth)}`, {
            method: 'POST',
            headers
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) {
            const message = 'Não foi possível enviar o calendário.';
            showApprovalFeedback(message, 'error');
            return;
        }
        if (data?.approval_link) {
            showApprovalSuccessModal(data.approval_link, data.access_password);
        } else {
            showApprovalFeedback('Calendário enviado para aprovação', 'success');
        }
        console.log('[sendForApproval] aprovação enviada com sucesso', data);
        if (typeof loadCalendarData === 'function') await loadCalendarData();
    } catch (err) {
        console.error('Erro ao enviar calendário:', err);
        showApprovalFeedback('Não foi possível enviar o calendário.', 'error');
    } finally {
        if (typeof setButtonLoading === 'function') {
            setButtonLoading(btnApprove, false);
        }
    }
}

window.sendForApproval = async function() {
    if (!currentClienteId || !currentMonth) {
        alert('Selecione um cliente e um mês primeiro.');
        return;
    }
    if (!confirm('Confirma o envio do calendário deste mês para aprovação?')) return;
    await sendMonthlyApproval();
}

window.sendWeekForApproval = function() {
    if (!currentClienteId) {
        alert('Selecione um cliente primeiro.');
        return;
    }
    const select = document.getElementById('approval-client-select');
    if (select) select.value = currentClienteId;
    const range = getWeekRangeFromCalendar();
    if (range) {
        const startInput = document.getElementById('approval-date-start');
        const endInput = document.getElementById('approval-date-end');
        if (startInput) startInput.value = range.start;
        if (endInput) endInput.value = range.end;
    }
    openModalAnim('modal-approval-date');
}

async function handleApprovalDateSelection() {
    const select = document.getElementById('approval-client-select');
    if (select && select.value) {
        if (currentClienteId !== select.value) {
            currentClienteId = select.value;
            // Atualiza select principal da tela
            const mainSelect = document.getElementById('select-cliente');
            if (mainSelect) mainSelect.value = currentClienteId;
            
            // Se possível, atualiza o calendário de fundo
            if (typeof loadCalendarData === 'function') {
                 // Garante que existe um mês selecionado para carregar dados
                 if (!currentMonth) {
                     const now = new Date();
                     currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                 }
                 loadCalendarData();
            }
        }
    } else if (!currentClienteId) {
        return alert('Selecione um cliente.');
    }

    const startDate = document.getElementById('approval-date-start').value;
    const endDate = document.getElementById('approval-date-end').value;

    if (!startDate || !endDate) return alert('Selecione as datas de início e fim.');
    if (startDate > endDate) return alert('A data inicial não pode ser maior que a final.');

    try {
        const { data: posts, error } = await window.supabaseClient
            .from('social_posts')
            .select('*')
            .eq('cliente_id', currentClienteId)
            .gte('data_agendada', startDate)
            .lte('data_agendada', endDate)
            .order('data_agendada', { ascending: true });

        if (error) throw error;

        const pendingStatuses = [
            POST_STATUS.READY_FOR_APPROVAL,
            POST_STATUS.DRAFT,
            'pendente',
            'rascunho',
            'pendente_aprovação',
            'pendente_aprovacao'
        ].filter(Boolean);
        const postsParaEnvio = posts.filter(p => pendingStatuses.includes(p.status));

        if (!postsParaEnvio || postsParaEnvio.length === 0) {
            const pendingLabel = POST_STATUS_LABEL?.[POST_STATUS.READY_FOR_APPROVAL] || 'Pendente Aprovação';
            const draftLabel = POST_STATUS_LABEL?.[POST_STATUS.DRAFT] || 'Rascunho';
            alert(`Nenhum post disponível para envio neste período.\n(Apenas posts com status "${pendingLabel}" ou "${draftLabel}" são listados. Posts já aprovados ou em aprovação não aparecem aqui.)`);
            return;
        }

        approvalRangeFrom = startDate;
        approvalRangeTo = endDate;
        approvalCompletePosts = [];
        approvalMissingPosts = [];

        postsParaEnvio.forEach((post) => {
            const tema = String(post.tema || '').trim();
            const legenda = String(post.legenda || '').trim();
            const previewUrl = resolvePreviewUrl(post);
            const missing = [];
            if (!tema) missing.push('tema');
            if (!legenda) missing.push('legenda');
            if (!previewUrl) missing.push('criativo');
            if (missing.length) {
                approvalMissingPosts.push({
                    id: post.id,
                    data_agendada: post.data_agendada || null,
                    tema: tema || null,
                    missing
                });
                return;
            }
            approvalCompletePosts.push({ ...post, preview_url: previewUrl });
        });

        closeModalAnim('modal-approval-date');
        if (approvalMissingPosts.length) {
            renderMissingApprovalList(approvalMissingPosts);
            openModalAnim('modal-approval-missing');
            return;
        }

        renderApprovalPreview(approvalCompletePosts);
        openModalAnim('modal-approval-preview');

    } catch (err) {
        console.error('Erro ao buscar posts para aprovação:', err);
        alert('Erro ao buscar posts: ' + err.message);
    }
}

function renderApprovalPreview(posts) {
    const listContainer = document.getElementById('approval-preview-list');
    listContainer.innerHTML = '';

    document.getElementById('approval-count-badge').innerText = `${posts.length} posts selecionados`;

    posts.forEach(post => {
        // Formatar Data
        let dateStr = '-';
        if (post.data_agendada) {
            const [y, m, d] = post.data_agendada.split('-');
            const dateObj = new Date(y, m - 1, d);
            dateStr = dateObj.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        }

        // Badge Formato
        const formatColors = {
            'estatico': 'bg-blue-100 text-blue-800',
            'reels': 'bg-pink-100 text-pink-800',
            'carrossel': 'bg-purple-100 text-purple-800',
            'stories': 'bg-yellow-100 text-yellow-800'
        };
        const badgeClass = formatColors[(post.formato || '').toLowerCase()] || 'bg-gray-100 text-gray-800';
        
        // Arte Preview
        let artPreview = '<div class="h-full w-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs rounded-lg border border-dashed border-gray-300">Sem Arte</div>';
        const previewUrl = post.preview_url || resolvePreviewUrl(post);
        if (previewUrl) {
            const isVideo = previewUrl.match(/\.(mp4|mov|webm)$/i) || String(previewUrl).includes('video');
            if (isVideo) {
                artPreview = `<video src="${previewUrl}" class="h-full w-full object-cover rounded-lg bg-black" controls></video>`;
            } else {
                artPreview = `<img src="${previewUrl}" class="h-full w-full object-cover rounded-lg" alt="Arte">`;
            }
        }

        const card = document.createElement('div');
        card.className = 'bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow';
        card.dataset.postId = post.id; // Salvar ID para envio
        card.innerHTML = `
            <div class="flex gap-4">
                <!-- Coluna da Esquerda: Arte -->
                <div class="w-32 h-32 flex-shrink-0">
                    ${artPreview}
                </div>

                <!-- Coluna da Direita: Informações -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-bold text-gray-900 capitalize">${dateStr}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeClass}">${post.formato || 'Post'}</span>
                        </div>
                        <div class="flex gap-1 text-gray-400 text-xs">
                           ${post.legenda_linkedin ? '<i class="fab fa-linkedin text-blue-700" title="LinkedIn"></i>' : ''}
                           ${post.legenda_tiktok ? '<i class="fab fa-tiktok text-black" title="TikTok"></i>' : ''}
                           <i class="fab fa-instagram text-pink-600" title="Instagram"></i>
                        </div>
                    </div>

                    <h4 class="text-base font-bold text-gray-800 mb-1 truncate" title="${post.tema}">${post.tema}</h4>
                    
                    <div class="bg-gray-50 rounded-lg p-2 border border-gray-100">
                        <p class="text-xs text-gray-600 line-clamp-3 italic">
                            "${post.legenda || 'Sem legenda...'}"
                        </p>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

async function confirmSendApproval() {
    await sendWeeklyApproval();
}

window.sendOnlyCompleteWeek = async function() {
    await sendWeeklyApproval();
    closeModalAnim('modal-approval-missing');
}

async function sendWeeklyApproval() {
    if (!currentClienteId || !approvalRangeFrom || !approvalRangeTo) {
        alert('Selecione um cliente e um período primeiro.');
        return;
    }
    const btnApprove = document.getElementById('btn-approve-week');
    if (typeof setButtonLoading === 'function') {
        setButtonLoading(btnApprove, true, 'Enviando...');
    }
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/client/post/approvals/submit?from=${encodeURIComponent(approvalRangeFrom)}&to=${encodeURIComponent(approvalRangeTo)}`, {
            method: 'POST',
            headers
        });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) {
            showApprovalFeedback('Não foi possível enviar os posts.', 'error');
            return;
        }
        if (data?.missing?.length) {
            renderMissingApprovalList(data.missing);
            openModalAnim('modal-approval-missing');
        }
        if (data?.approval_link) {
            showApprovalSuccessModal(data.approval_link, data.access_password);
        } else {
            showApprovalFeedback('Posts enviados para aprovação', 'success');
        }
        if (typeof loadCalendarData === 'function') await loadCalendarData();
        closeModalAnim('modal-approval-preview');
    } catch (err) {
        console.error('Erro ao enviar posts:', err);
        showApprovalFeedback('Não foi possível enviar os posts.', 'error');
    } finally {
        if (typeof setButtonLoading === 'function') {
            setButtonLoading(btnApprove, false);
        }
    }
}

function getWeekRangeFromCalendar() {
    const view = window.calendar?.view;
    if (!view?.currentStart || !view?.currentEnd) return null;
    const startDate = new Date(view.currentStart);
    const endDate = new Date(view.currentEnd);
    endDate.setDate(endDate.getDate() - 1);
    return {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
    };
}

function renderMissingApprovalList(items) {
    const list = document.getElementById('approval-missing-list');
    const count = document.getElementById('approval-missing-count');
    if (!list) return;
    list.innerHTML = '';
    const data = Array.isArray(items) ? items : [];
    if (count) count.textContent = `${data.length} posts incompletos`;
    data.forEach((item) => {
        const dateLabel = item.data_agendada || 'Sem data';
        const tema = item.tema || 'Sem tema';
        const missing = Array.isArray(item.missing) ? item.missing.join(', ') : '';
        const row = document.createElement('div');
        row.className = 'bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between';
        row.innerHTML = `
            <div>
                <div class="text-sm font-semibold text-gray-800">${tema}</div>
                <div class="text-xs text-gray-500">${dateLabel}</div>
            </div>
            <span class="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100 px-2 py-1 rounded-lg">${missing || 'Incompleto'}</span>
        `;
        list.appendChild(row);
    });
}

function showApprovalSuccessModal(link, accessPassword) {
    // Criar modal dinamicamente ou usar um existente
    // Vou criar um HTML string e injetar, ou melhor, adicionar ao HTML principal.
    // Para agilidade, vou usar um alert customizado ou injetar um modal simples agora.
    
    const passwordHtml = accessPassword ? `
        <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-3 mb-4">
            <div class="text-xs text-gray-500 uppercase tracking-wide font-semibold">Senha</div>
            <div class="text-sm text-gray-700 font-medium">${accessPassword}</div>
        </div>
    ` : '';

    const modalHtml = `
        <div id="modal-approval-success" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 transform scale-95 transition-transform duration-300">
                <div class="text-center mb-6">
                    <div class="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                        <i class="fas fa-check"></i>
                    </div>
                    <h3 class="text-2xl font-bold text-gray-800">Pronto para Enviar!</h3>
                    <p class="text-gray-500 mt-2">Compartilhe o link abaixo com seu cliente.</p>
                </div>

                ${passwordHtml}

                <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center gap-3 mb-6">
                    <input type="text" value="${link}" readonly class="bg-transparent border-none text-gray-600 text-sm flex-1 focus:ring-0 w-full" id="approval-link-input">
                    <button onclick="copyApprovalLink()" class="text-blue-600 hover:text-blue-700 font-medium text-sm">Copiar</button>
                </div>

                <div class="flex justify-center">
                    <button onclick="closeApprovalSuccessModal()" class="px-6 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 font-medium transition-all">Concluir</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Animate In
    setTimeout(() => {
        const m = document.getElementById('modal-approval-success');
        m.classList.remove('opacity-0');
        m.querySelector('div').classList.remove('scale-95');
    }, 10);
}

window.copyApprovalLink = function() {
    const input = document.getElementById('approval-link-input');
    input.select();
    document.execCommand('copy');
    
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Copiado!';
    setTimeout(() => btn.innerText = originalText, 2000);
}

window.closeApprovalSuccessModal = function() {
    const m = document.getElementById('modal-approval-success');
    m.classList.add('opacity-0');
    m.querySelector('div').classList.add('scale-95');
    setTimeout(() => m.remove(), 300);
    
    // Recarregar calendário para mostrar novos status
    if (typeof loadCalendarData === 'function') loadCalendarData();
}
