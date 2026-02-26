
// js/aprovacao.js

let currentPosts = [];
let currentPostId = null;
const urlParams = new URLSearchParams(window.location.search);
const approvalGroupId = urlParams.get('id');
const POST_STATUS = window.POST_STATUS || {};
const POST_STATUS_LABEL = window.POST_STATUS_LABEL || {};

document.addEventListener('DOMContentLoaded', () => {
    if (!approvalGroupId) {
        document.getElementById('posts-grid').innerHTML = `
            <div class="col-span-full text-center py-20">
                <i class="fas fa-exclamation-circle text-4xl text-red-500 mb-4"></i>
                <p class="text-gray-500">Link inválido ou expirado.</p>
            </div>
        `;
        return;
    }
    loadBranding();
    loadPosts();
});

async function loadBranding() {
    try {
        const keys = ['white_label_primary_color', 'white_label_secondary_color', 'white_label_logo_url', 'white_label_favicon_url'];
        const { data, error } = await window.supabaseClient
            .from('configuracoes')
            .select('key, value')
            .in('key', keys);

        if (error) throw error;

        if (data && data.length > 0) {
            const config = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
            applyBranding(config);
        }
    } catch (err) {
        console.error('Erro ao carregar branding:', err);
    }
}

function applyBranding(config) {
    // Cores
    if (config.white_label_primary_color) {
        document.documentElement.style.setProperty('--color-primary', config.white_label_primary_color);
        // Atualizar config do Tailwind dinamicamente é complexo, então usamos variáveis CSS onde possível ou style inline
        // Mas como configuramos tailwind via script no head, podemos tentar atualizar:
        if (window.tailwind && window.tailwind.config) {
            window.tailwind.config.theme.extend.colors.primary = config.white_label_primary_color;
        }
        
        // Atualizar elementos específicos que usam classes hardcoded se necessário, 
        // mas melhor é injetar estilo global sobrescrevendo
        const style = document.createElement('style');
        style.innerHTML = `
            .text-primary { color: ${config.white_label_primary_color} !important; }
            .bg-primary { background-color: ${config.white_label_primary_color} !important; }
            .border-primary { border-color: ${config.white_label_primary_color} !important; }
            .from-primary { --tw-gradient-from: ${config.white_label_primary_color} !important; }
        `;
        document.head.appendChild(style);
    }
    
    if (config.white_label_secondary_color) {
        document.documentElement.style.setProperty('--color-secondary', config.white_label_secondary_color);
        const style = document.createElement('style');
        style.innerHTML = `
            .text-secondary { color: ${config.white_label_secondary_color} !important; }
            .bg-secondary { background-color: ${config.white_label_secondary_color} !important; }
            .border-secondary { border-color: ${config.white_label_secondary_color} !important; }
            .to-secondary { --tw-gradient-to: ${config.white_label_secondary_color} !important; }
        `;
        document.head.appendChild(style);
    }

    // Logo
    if (config.white_label_logo_url) {
        const logoContainer = document.querySelector('header .flex.items-center.gap-2');
        if (logoContainer) {
            // Substituir o ícone padrão e texto pelo logo
            logoContainer.innerHTML = `
                <img src="${config.white_label_logo_url}" alt="Logo" class="h-10 object-contain">
                <span class="mx-2 text-gray-300">|</span>
                <span class="text-sm font-medium text-gray-500">Área do Cliente</span>
            `;
        }
        
        // Atualizar Favicon
        if (config.white_label_favicon_url) {
            let link = document.querySelector("link[rel~='icon']");
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.appendChild(link);
            }
            link.href = config.white_label_favicon_url;
        }
    }
}

async function loadPosts() {
    try {
        const approvedStatuses = [POST_STATUS.APPROVED, 'aprovado'].filter(Boolean);
        let query = window.supabaseClient
            .from('social_posts')
            .select('*')
            .eq('approval_group_id', approvalGroupId);
        if (approvedStatuses.length) {
            query = query.not('status', 'in', `(${approvedStatuses.join(',')})`);
        }
        query = query.order('data_agendada', { ascending: true });

        const { data, error } = await query;

        if (error) throw error;

        currentPosts = data;
        renderPosts(data);
        updateHeaderStatus(data);

    } catch (err) {
        console.error('Erro ao carregar posts:', err);
        document.getElementById('posts-grid').innerHTML = '<p class="text-center col-span-full text-red-500">Erro ao carregar posts.</p>';
    }
}

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
    if (post?.imagem_url) list.push({ public_url: post.imagem_url, type: 'image', name: 'imagem' });
    if (post?.video_url) list.push({ public_url: post.video_url, type: 'video', name: 'video' });
    if (post?.arquivo_url) list.push({ public_url: post.arquivo_url, type: 'doc', name: 'arquivo' });
    return list;
}

function getPostMedias(post) {
    const normalized = normalizeMedias(post?.medias);
    if (normalized.length) return normalized;
    return getLegacyMedias(post);
}

function getPublicUrlFromPath(path) {
    if (!path || !window.supabaseClient?.storage) return '';
    const { data } = window.supabaseClient.storage.from('social_media_uploads').getPublicUrl(path);
    return data?.publicUrl || '';
}

function resolveMediaUrl(media) {
    return media.public_url || getPublicUrlFromPath(media.path);
}

function renderPosts(posts) {
    const grid = document.getElementById('posts-grid');
    grid.innerHTML = '';

    if (posts.length === 0) {
        grid.innerHTML = '<p class="text-center col-span-full text-gray-500">Nenhum post encontrado.</p>';
        return;
    }

    // Filtrar Stories (não exibir na aprovação, conforme solicitado)
    const visiblePosts = posts.filter(p => !p.formato || !p.formato.toLowerCase().includes('stor'));

    if (visiblePosts.length === 0) {
        grid.innerHTML = '<p class="text-center col-span-full text-gray-500">Nenhum post de Feed/Reels para aprovação.</p>';
        return;
    }

    visiblePosts.forEach(post => {
        const dateStr = formatDate(post.data_agendada);
        const statusConfig = getStatusConfig(post.status);
        
        // Mídia Preview (Thumb)
        let mediaThumb = '<div class="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400"><i class="fas fa-image text-3xl"></i></div>';
        const medias = getPostMedias(post);
        const media = medias[0];
        const mediaUrl = media ? resolveMediaUrl(media) : '';
        if (mediaUrl) {
            if (media.type === 'video' || mediaUrl.match(/\.(mp4|mov|webm)$/i)) {
                mediaThumb = `<video src="${mediaUrl}" class="w-full h-48 object-cover" muted></video>`;
            } else if (media.type === 'image') {
                mediaThumb = `<img src="${mediaUrl}" class="w-full h-48 object-cover" alt="Preview">`;
            } else if (media.type === 'pdf') {
                mediaThumb = '<div class="w-full h-48 bg-red-50 flex items-center justify-center text-red-500"><i class="fas fa-file-pdf text-3xl"></i></div>';
            } else {
                mediaThumb = '<div class="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400"><i class="fas fa-file text-3xl"></i></div>';
            }
        }

        const card = document.createElement('div');
        const approvedStatuses = [POST_STATUS.APPROVED, 'aprovado'].filter(Boolean);
        card.className = `bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all cursor-pointer group ${approvedStatuses.includes(post.status) ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`;
        card.onclick = () => openPostDetails(post.id);
        
        card.innerHTML = `
            <div class="relative">
                ${mediaThumb}
                <div class="absolute top-3 right-3">
                    <span class="px-2 py-1 rounded-lg text-xs font-bold uppercase ${statusConfig.badgeClass} shadow-sm backdrop-blur-md bg-white/90">
                        ${statusConfig.label}
                    </span>
                </div>
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span class="bg-white text-gray-900 px-4 py-2 rounded-full font-medium shadow-lg text-sm transform translate-y-2 group-hover:translate-y-0 transition-transform">Ver Detalhes</span>
                </div>
            </div>
            <div class="p-5">
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${dateStr}</span>
                </div>
                <h3 class="font-bold text-gray-800 text-lg mb-2 line-clamp-1">${post.tema}</h3>
                <p class="text-gray-500 text-sm line-clamp-2">${post.legenda || 'Sem legenda...'}</p>
            </div>
        `;
        grid.appendChild(card);
    });

    checkCompletion();
}

function openPostDetails(postId) {
    const post = currentPosts.find(p => p.id === postId);
    if (!post) return;
    
    currentPostId = postId;
    const modal = document.getElementById('modal-detalhes');
    
    // Preencher Dados
    document.getElementById('detail-tema').innerText = post.tema;
    document.getElementById('detail-data').innerText = formatDate(post.data_agendada);
    document.getElementById('detail-legenda').innerText = post.legenda || '';
    
    // Plataformas
    const platsContainer = document.getElementById('detail-plataformas');
    platsContainer.innerHTML = '';
    // Simulação de plataformas (já que não tenho no post, normalmente vem do cliente, mas vou usar ícones genéricos se não tiver)
    // Se tiver legenda_linkedin, assume linkedin, etc.
    if (post.legenda_linkedin) platsContainer.innerHTML += '<i class="fab fa-linkedin text-blue-700 text-xl"></i>';
    if (post.legenda_tiktok) platsContainer.innerHTML += '<i class="fab fa-tiktok text-black text-xl"></i>';
    platsContainer.innerHTML += '<i class="fab fa-instagram text-pink-600 text-xl"></i>';

    // Mídia Grande
    const mediaContainer = document.getElementById('media-container');
    const btnDownload = document.getElementById('btn-download');
    const medias = getPostMedias(post);
    const primary = medias[0];
    const mediaUrl = primary ? resolveMediaUrl(primary) : '';

    if (mediaUrl) {
        btnDownload.href = mediaUrl;
        btnDownload.classList.remove('hidden');
        if (primary.type === 'video' || mediaUrl.match(/\.(mp4|mov|webm)$/i)) {
            mediaContainer.innerHTML = `<video src="${mediaUrl}" class="max-w-full max-h-full rounded-lg shadow-2xl" controls></video>`;
        } else if (primary.type === 'image') {
            mediaContainer.innerHTML = `<img src="${mediaUrl}" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Arte">`;
        } else if (primary.type === 'pdf') {
            mediaContainer.innerHTML = '<div class="w-full h-64 bg-red-50 text-red-500 flex items-center justify-center rounded-lg"><i class="fas fa-file-pdf text-4xl"></i></div>';
        } else {
            mediaContainer.innerHTML = '<div class="w-full h-64 bg-gray-100 text-gray-500 flex items-center justify-center rounded-lg"><i class="fas fa-file text-4xl"></i></div>';
        }
    } else {
        mediaContainer.innerHTML = '<div class="text-white opacity-50">Sem mídia</div>';
        btnDownload.classList.add('hidden');
    }

    // Status e Botões
    const actionsFooter = document.getElementById('actions-footer');
    const statusBadge = document.getElementById('post-status-badge');
    const statusConfig = getStatusConfig(post.status);
    
    statusBadge.innerHTML = `<span class="px-3 py-1 rounded-full text-xs font-bold uppercase ${statusConfig.badgeClass}">${statusConfig.label}</span>`;

    if ([POST_STATUS.APPROVED, POST_STATUS.REJECTED, 'aprovado', 'ajuste_solicitado'].includes(post.status)) {
        actionsFooter.classList.add('hidden');
    } else {
        actionsFooter.classList.remove('hidden');
    }

    modal.classList.remove('hidden');
}

function closeModalDetalhes() {
    document.getElementById('modal-detalhes').classList.add('hidden');
    currentPostId = null;
}

function openAdjustModal() {
    document.getElementById('modal-ajuste').classList.remove('hidden');
}

function closeAdjustModal() {
    document.getElementById('modal-ajuste').classList.add('hidden');
}

async function approvePost() {
    if (!currentPostId) return;
    
    const btn = document.querySelector('button[onclick="approvePost()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const { error } = await window.supabaseClient
            .from('social_posts')
            .update({ status: POST_STATUS.APPROVED || 'aprovado' })
            .eq('id', currentPostId);

        if (error) throw error;

        // Atualizar local
        const post = currentPosts.find(p => p.id === currentPostId);
        if (post) post.status = POST_STATUS.APPROVED || 'aprovado';

        closeModalDetalhes();
        renderPosts(currentPosts);
        updateHeaderStatus(currentPosts);

    } catch (err) {
        alert('Erro ao aprovar: ' + err.message);
    } finally {
        btn.innerHTML = originalText;
    }
}

async function sendAdjustment() {
    if (!currentPostId) return;

    const checkArte = document.getElementById('check-arte').checked;
    const checkLegenda = document.getElementById('check-legenda').checked;
    const comentario = document.getElementById('ajuste-comentario').value;

    if (!checkArte && !checkLegenda && !comentario) {
        alert('Selecione pelo menos uma opção ou escreva um comentário.');
        return;
    }

    const feedback = {
        tipo: [],
        comentario: comentario,
        data: new Date()
    };

    if (checkArte) feedback.tipo.push('Arte');
    if (checkLegenda) feedback.tipo.push('Legenda');

    const btn = document.querySelector('button[onclick="sendAdjustment()"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    try {
        const { error } = await window.supabaseClient
            .from('social_posts')
            .update({ 
                status: POST_STATUS.REJECTED || 'ajuste_solicitado',
                feedback_cliente: feedback
            })
            .eq('id', currentPostId);

        if (error) throw error;

        // Atualizar local
        const post = currentPosts.find(p => p.id === currentPostId);
        if (post) post.status = POST_STATUS.REJECTED || 'ajuste_solicitado';

        closeAdjustModal();
        closeModalDetalhes();
        renderPosts(currentPosts);
        updateHeaderStatus(currentPosts);

        // Limpar form
        document.getElementById('check-arte').checked = false;
        document.getElementById('check-legenda').checked = false;
        document.getElementById('ajuste-comentario').value = '';

    } catch (err) {
        alert('Erro ao enviar ajuste: ' + err.message);
    } finally {
        btn.innerHTML = 'Enviar Ajustes';
    }
}

function getStatusConfig(status) {
    const value = String(status || '').trim().toLowerCase();
    if ([POST_STATUS.APPROVED, 'aprovado'].includes(value)) {
        return { label: POST_STATUS_LABEL?.[POST_STATUS.APPROVED] || 'Aprovado', badgeClass: 'bg-green-100 text-green-700 border border-green-200' };
    }
    if ([POST_STATUS.REJECTED, 'ajuste_solicitado'].includes(value)) {
        return { label: POST_STATUS_LABEL?.[POST_STATUS.REJECTED] || 'Ajuste Solicitado', badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200' };
    }
    if ([POST_STATUS.READY_FOR_APPROVAL, 'pendente_aprovação', 'pendente_aprovacao', 'aguardando_aprovacao', 'pendente'].includes(value)) {
        return { label: POST_STATUS_LABEL?.[POST_STATUS.READY_FOR_APPROVAL] || 'Pendente', badgeClass: 'bg-yellow-100 text-yellow-700 border border-yellow-200' };
    }
    return { label: POST_STATUS_LABEL?.[POST_STATUS.DRAFT] || 'Rascunho', badgeClass: 'bg-gray-100 text-gray-600' };
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const [y, m, d] = dateString.split('-');
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

function updateHeaderStatus(posts) {
    const total = posts.length;
    const pendingStatuses = [POST_STATUS.READY_FOR_APPROVAL, 'pendente_aprovação', 'pendente_aprovacao', 'aguardando_aprovacao', 'pendente'].filter(Boolean);
    const approvedStatuses = [POST_STATUS.APPROVED, 'aprovado'].filter(Boolean);
    const pendentes = posts.filter(p => pendingStatuses.includes(p.status)).length;
    const aprovados = posts.filter(p => approvedStatuses.includes(p.status)).length;
    
    const statusEl = document.getElementById('status-geral');
    if (pendentes === 0 && total > 0) {
        statusEl.innerHTML = '<span class="text-green-600 font-bold"><i class="fas fa-check-circle"></i> Tudo Respondido!</span>';
    } else {
        statusEl.innerHTML = `${aprovados}/${total} Aprovados • ${pendentes} Pendentes`;
    }
}

function checkCompletion() {
    const pendingStatuses = [POST_STATUS.READY_FOR_APPROVAL, 'pendente_aprovação', 'pendente_aprovacao', 'aguardando_aprovacao', 'pendente'].filter(Boolean);
    const rejectedStatuses = [POST_STATUS.REJECTED, 'ajuste_solicitado'].filter(Boolean);
    const pendentes = currentPosts.filter(p => pendingStatuses.includes(p.status)).length;
    const ajustes = currentPosts.filter(p => rejectedStatuses.includes(p.status)).length;
    
    if (pendentes === 0 && currentPosts.length > 0) {
        // Todos respondidos
        let msg = '';
        let iconHtml = '';
        
        if (ajustes > 0) {
            msg = 'Obrigado pelas confirmações! Em breve enviaremos as alterações para nova aprovação.';
            iconHtml = '<i class="fas fa-tools"></i>';
            document.getElementById('conclusao-icon').className = 'w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-8 text-orange-500 text-5xl shadow-sm';
        } else {
            msg = 'Obrigado pelas confirmações! Seus posts serão agendados.';
            iconHtml = '<i class="fas fa-check"></i>';
            document.getElementById('conclusao-icon').className = 'w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 text-green-500 text-5xl shadow-sm';
        }

        document.getElementById('conclusao-mensagem').innerText = msg;
        document.getElementById('conclusao-icon').innerHTML = iconHtml;

        // Mostrar Modal Bloqueante
        setTimeout(() => {
            const modal = document.getElementById('modal-conclusao');
            modal.classList.remove('hidden');
            // Remove o scroll da página de fundo
            document.body.style.overflow = 'hidden';
        }, 500);
    }
}

function tryClosePage() {
    window.close();
}
