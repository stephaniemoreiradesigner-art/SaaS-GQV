(function () {
    if (window.__socialMediaLoaded) return;
    window.__socialMediaLoaded = true;

// social_media.js - Lógica do Calendário Editorial com FullCalendar e Tailwind CSS

// Variáveis Globais
var calendar = null;
var currentClienteId = null;
var currentCalendarId = null; 
var currentMonth = null; 
var clientDataMap = {}; 
var tempSelectedDate = null;
var tempSelectedFormat = null;
var calendarConnectionsCache = {};
var socialPostsCache = [];
var lastSeasonalDates = [];
var currentPostProps = null;
let socialMediaPermission = null;

// === Dashboard navigation shim (v1.1) ===
function getSocialDashboardViews() {
    return {
        dashboard: document.getElementById('social-media-home'),
        calendar: document.getElementById('calendar-view'),
        insights: document.getElementById('insights-view'),
        diary: document.getElementById('logs-view'),
        creative: document.getElementById('creative-requests-view')
    };
}

if (typeof window.openSocialMediaTab !== 'function') {
    window.openSocialMediaTab = function(tab) {
        try {
            const t = String(tab || '').toLowerCase();
            const views = getSocialDashboardViews();
            const hasAnyView = Object.values(views).some(Boolean);

            if (!hasAnyView) {
                const url = new URL(window.location.href);
                url.hash = `#tab=${encodeURIComponent(t)}`;
                window.location.href = url.toString();
                return;
            }

            Object.values(views).forEach(el => {
                if (!el) return;
                el.classList.add('hidden');
                el.style.display = 'none';
            });

            const key =
                (t === 'calendario' || t === 'calendar') ? 'calendar' :
                (t === 'insights') ? 'insights' :
                (t === 'diario' || t === 'diary') ? 'diary' :
                (t === 'solicitacoes' || t === 'creative' || t === 'creative_requests') ? 'creative' :
                'dashboard';

            const target = views[key] || views.dashboard;
            if (target) {
                target.classList.remove('hidden');
                target.style.display = '';
            }

            if (key === 'calendar') {
                setTimeout(forceCalendarRerender, 50);
            }

            const url = new URL(window.location.href);
            url.hash = `#tab=${encodeURIComponent(key)}`;
            window.history.replaceState({}, '', url.toString());
        } catch (e) {
            console.error('[SocialMedia] openSocialMediaTab failed:', e);
        }
    };
}

function applySocialTabFromHash() {
    const rawHash = String(window.location.hash || '').replace(/^#/, '');
    const params = new URLSearchParams(rawHash);
    const tab = params.get('tab');
    window.openSocialMediaTab(tab || 'dashboard');
    if (rawHash.includes('tab=calendar')) {
        setTimeout(forceCalendarRerender, 50);
    }
}

function forceCalendarRerender() {
    if (!window.__gqvCalendarInstance) return;

    // FullCalendar às vezes renderiza “em branco” se o container estava hidden
    requestAnimationFrame(() => {
        try {
            window.__gqvCalendarInstance.updateSize();
        } catch (_) {}
    });
}

window.forceCalendarRerender = forceCalendarRerender;

const CALENDAR_STATUS = window.CALENDAR_STATUS;
const POST_STATUS = window.POST_STATUS;
const CALENDAR_STATUS_LABEL = window.CALENDAR_STATUS_LABEL || {};
const POST_STATUS_LABEL = window.POST_STATUS_LABEL || {};

function ensureCalendarCTAContainer() {
    let container = document.getElementById('calendar-connection-cta');
    if (container) return container;
    const calendarEl = document.getElementById('calendar');
    const whiteBox = calendarEl ? calendarEl.parentElement : null;
    const parent = whiteBox ? whiteBox.parentElement : null;
    if (!parent) return null;
    container = document.createElement('div');
    container.id = 'calendar-connection-cta';
    container.className = 'mb-6 hidden';
    parent.insertBefore(container, whiteBox);
    return container;
}

async function ensureSocialMediaPermission() {
    if (socialMediaPermission !== null) return socialMediaPermission;
    if (!window.supabaseClient) return false;
    try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return false;
        const isSuper = (window.SUPERADMIN_EMAILS || []).includes(user.email);
        if (isSuper) {
            socialMediaPermission = true;
            return true;
        }

        let colab = null;
        const { data: colabByUserId } = await window.supabaseClient
            .from('colaboradores')
            .select('id, perfil_acesso, permissoes, email')
            .eq('user_id', user.id)
            .maybeSingle();
        if (colabByUserId) {
            colab = colabByUserId;
        } else {
            const { data: colabByEmail } = await window.supabaseClient
                .from('colaboradores')
                .select('id, perfil_acesso, permissoes, email')
                .eq('email', user.email)
                .maybeSingle();
            if (colabByEmail) colab = colabByEmail;
        }

        const role = colab?.perfil_acesso || '';
        const perms = Array.isArray(colab?.permissoes) ? colab.permissoes : [];
        socialMediaPermission = role === 'admin' || role === 'super_admin' || perms.includes('social_media');
        return socialMediaPermission;
    } catch (err) {
        console.warn('[SocialMedia] Falha ao checar permissao:', err);
        socialMediaPermission = false;
        return false;
    }
}

function updateGenerateButtonState() {
    const btnHeaderGenerate = document.getElementById('btn-header-generate');
    const btnModalGenerate = document.getElementById('btn-modal-generate');
    const hasClient = !!currentClienteId;
    const hasPermission = socialMediaPermission === true;
    const isEnabled = hasClient && hasPermission;
    if (btnHeaderGenerate) btnHeaderGenerate.disabled = !isEnabled;
    if (btnModalGenerate) btnModalGenerate.disabled = !isEnabled;
}

async function updateCalendarConnections(clientId) {
    if (!clientId) {
        const container = ensureCalendarCTAContainer();
        if (container) {
            container.innerHTML = '';
            container.classList.add('hidden');
        }
        return;
    }

    const connections = await window.getConnectedPlatforms(clientId);
    calendarConnectionsCache[clientId] = connections;
    const connectedPlatforms = (connections.connected || []).map(item => item.platform).filter(p => ['instagram', 'facebook', 'linkedin', 'tiktok'].includes(p));

    const btnModalGenerate = document.getElementById('btn-modal-generate');
    const container = ensureCalendarCTAContainer();

    if (connectedPlatforms.length === 0) {
        if (btnModalGenerate) btnModalGenerate.disabled = true;
        if (container) {
            container.innerHTML = window.renderPlatformNotConnectedCTA(clientId, 'Instagram/Facebook/LinkedIn/TikTok');
            container.classList.remove('hidden');
        }
        updateGenerateButtonState();
        return;
    }

    if (container) {
        container.innerHTML = '';
        container.classList.add('hidden');
    }

    updateGenerateButtonState();
}

// --- Modal: Configurar Geração (compatível com IDs antigos e novos)
function getGenerationModalElements() {
    // HTML antigo: modal-generation-config / modal-generation-config-content
    // HTML novo: generationModal / generationModalContent
    const modal =
        document.getElementById("generationModal") ||
        document.getElementById("modal-generation-config");

    const content =
        document.getElementById("generationModalContent") ||
        document.getElementById("modal-generation-config-content");

    return { modal, content };
}

window.openGenerationConfigModal = function () {
    const { modal, content } = getGenerationModalElements();
    if (!modal) return;

    modal.classList.remove("hidden");
    modal.classList.add("flex");

    requestAnimationFrame(() => {
        modal.classList.remove("opacity-0");
        if (content) content.classList.remove("scale-95");
    });
};

window.closeGenerationModal = function () {
    const { modal, content } = getGenerationModalElements();
    if (!modal) return;

    modal.classList.add("opacity-0");
    if (content) content.classList.add("scale-95");

    setTimeout(() => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }, 300);
};

// Mantém compatibilidade com chamadas antigas
window.closeGenerationConfigModal =
    window.closeGenerationConfigModal || window.closeGenerationModal;

function showGenerationLog() {
    const log = document.getElementById('generationLog');
    if (!log) return;
    log.innerHTML = `
        <div id="generation-log-header" class="font-semibold text-gray-800">Gerando conteúdo...</div>
        <div id="generation-log-content" class="mt-2 space-y-1"></div>
        <div id="generation-log-status" class="mt-2 text-[11px] text-gray-500"></div>
        <div id="generation-log-actions" class="mt-3 hidden">
            <button id="generation-log-retry" class="px-3 py-1 rounded bg-gray-800 text-white text-xs">Tentar novamente</button>
        </div>
    `;
    log.classList.remove('hidden');
}

function appendGenerationLog(message) {
    const log = document.getElementById('generationLog');
    if (!log) return;
    const content = document.getElementById('generation-log-content');
    const line = document.createElement('div');
    line.textContent = message;
    if (content) {
        content.appendChild(line);
        content.scrollTop = content.scrollHeight;
    } else {
        log.appendChild(line);
        log.scrollTop = log.scrollHeight;
    }
}

function hideGenerationLog() {
    const log = document.getElementById('generationLog');
    if (!log) return;
    log.classList.add('hidden');
}

let generationModalLoading = false;

function setGenerationLogContentVisible(isVisible) {
    const content = document.getElementById('generation-log-content');
    if (!content) return;
    if (isVisible) {
        content.classList.remove('hidden');
    } else {
        content.classList.add('hidden');
    }
}

function setGenerationLogMessage(message) {
    showGenerationLog();
    const header = document.getElementById('generation-log-header');
    if (header) header.textContent = message || '';
    setGenerationLogContentVisible(false);
    setGenerationStatusMessage('');
    const actions = document.getElementById('generation-log-actions');
    if (actions) actions.classList.add('hidden');
}

function updateRetryButtonState() {
    const retryButton = document.getElementById('generation-log-retry');
    if (!retryButton) return;
    const isLocked = window.__calendarGenerationInProgress === true;
    retryButton.disabled = isLocked;
    if (isLocked) {
        retryButton.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        retryButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

function setGenerationLoading(isLoading, message) {
    generationModalLoading = isLoading;
    const btnConfirm = document.getElementById('btn-generation-confirm');
    const btnCancel = document.getElementById('btn-generation-cancel');
    const btnClose = document.getElementById('btn-generation-close');
    if (btnConfirm) {
        if (!btnConfirm.dataset.originalHtml) {
            btnConfirm.dataset.originalHtml = btnConfirm.innerHTML;
        }
        btnConfirm.disabled = isLoading;
        btnConfirm.innerHTML = isLoading
            ? '<i class="fas fa-spinner fa-spin mr-2"></i> Gerando...'
            : btnConfirm.dataset.originalHtml;
        if (isLoading) {
            btnConfirm.classList.add('loading');
        } else {
            btnConfirm.classList.remove('loading');
        }
    }
    [btnCancel, btnClose].forEach((btn) => {
        if (!btn) return;
        btn.disabled = isLoading;
        if (isLoading) {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
    if (isLoading) {
        setGenerationLogMessage(message || 'Gerando seu calendário, aguarde...');
    }
    updateRetryButtonState();
}

let progressPollInterval = null;
let progressLastUpdateAt = 0;
let progressLastToken = '';
let progressCalendarId = null;
let lastGenerationConfig = null;
let progressRequestId = null;
let progressCompleted = false;
let progressLastLogLength = 0;

function setGenerationStatusMessage(message) {
    const status = document.getElementById('generation-log-status');
    if (!status) return;
    status.textContent = message || '';
}

function renderProgressLog(text) {
    const content = document.getElementById('generation-log-content');
    if (!content) return;
    const fullText = String(text || '');
    if (fullText.length < progressLastLogLength) {
        content.innerHTML = '';
        progressLastLogLength = 0;
    }
    const newText = fullText.slice(progressLastLogLength);
    if (!newText && content.childElementCount === 0) {
        const emptyLine = document.createElement('div');
        emptyLine.textContent = 'Aguardando atualização do servidor...';
        content.appendChild(emptyLine);
        return;
    }
    if (newText) {
        if (content.childElementCount === 1 && content.textContent === 'Aguardando atualização do servidor...') {
            content.innerHTML = '';
        }
        const lines = newText.split('\n').filter(Boolean);
        lines.forEach((lineText) => {
            const line = document.createElement('div');
            line.textContent = lineText;
            content.appendChild(line);
        });
        content.scrollTop = content.scrollHeight;
    }
    progressLastLogLength = fullText.length;
}

function setRetryVisible(isVisible, message, options = {}) {
    const actions = document.getElementById('generation-log-actions');
    const retryButton = document.getElementById('generation-log-retry');
    if (!actions || !retryButton) return;
    if (isVisible) {
        actions.classList.remove('hidden');
        setGenerationLogContentVisible(false);
        setGenerationStatusMessage(message || 'Sem atualização do backend há 30s. Clique em "Tentar novamente".');
        retryButton.textContent = options.label || 'Tentar novamente';
        retryButton.onclick = options.onClick || (() => {
            actions.classList.add('hidden');
            setGenerationStatusMessage('');
            if (lastGenerationConfig) {
                generateCalendar(lastGenerationConfig);
            }
        });
        updateRetryButtonState();
    } else {
        actions.classList.add('hidden');
        retryButton.onclick = null;
    }
}

async function pollCalendarProgress() {
    if (!progressCalendarId) return;
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${window.API_BASE_URL}/api/social/calendars/${progressCalendarId}`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const calendar = data?.calendar || null;
        if (!calendar) return;
        const logText = String(calendar.erro_log || '');
        const token = `${calendar.updated_at || ''}|${logText}`;
        if (token !== progressLastToken) {
            progressLastToken = token;
            progressLastUpdateAt = Date.now();
            renderProgressLog(logText);
        }
        const status = String(calendar.status || '');
        let progressMeta = null;
        try {
            progressMeta = JSON.parse(calendar.erro_log || '{}');
        } catch {
            progressMeta = null;
        }
        const generationMeta = progressMeta?.generation || null;
        const progressStatus = String(generationMeta?.status || '');
        const isInProduction = status === CALENDAR_STATUS.IN_PRODUCTION;
        const isReady = [
            CALENDAR_STATUS.AWAITING_APPROVAL,
            CALENDAR_STATUS.APPROVED,
            CALENDAR_STATUS.PUBLISHED
        ].includes(status);
        if (!isInProduction || progressStatus === 'partial' || generationMeta?.last_error) {
            stopCalendarProgressPolling();
            if (isReady) {
                setRetryVisible(false);
                if (!progressCompleted) {
                    progressCompleted = true;
                    setGenerationLogMessage('Calendário gerado. Atualizando...');
                    try {
                        await loadCalendarData();
                        const updated = await waitForCalendarUpdate({ timeoutMs: 10000 });
                        if (updated) {
                            window.closeGenerationModal();
                            hideGenerationLog();
                        } else {
                            const message = 'Calendário ainda não apareceu. Clique em "Tentar novamente" para atualizar.';
                            setGenerationStatusMessage(message);
                            setRetryVisible(true, message);
                        }
                    } catch (error) {
                        const message = 'Erro ao atualizar calendário. Clique em "Tentar novamente".';
                        setGenerationStatusMessage(message);
                        setRetryVisible(true, message);
                    } finally {
                        setGenerationLoading(false);
                    }
                }
            } else if (progressStatus === 'partial') {
                let generated = 0;
                let expected = 0;
                try {
                    generated = Number(generationMeta?.generated || 0);
                    expected = Number(generationMeta?.expected || 0);
                } catch {}
                const partialMessage = `Geramos ${generated} de ${expected}. Clique em "Tentar novamente" para completar.`;
                setGenerationLogMessage(partialMessage);
                setGenerationLoading(false);
                setRetryVisible(true, partialMessage, {
                    label: 'Completar geração',
                    onClick: () => {
                        setRetryVisible(false);
                        setGenerationLoading(true, 'Gerando seu calendário, aguarde...');
                        generateCalendar({ ...lastGenerationConfig, force: false });
                    }
                });
            } else if (generationMeta?.last_error) {
                const message = 'Falha na geração. Clique em "Tentar novamente".';
                setGenerationLogMessage(message);
                setGenerationLoading(false);
                setRetryVisible(true, message);
            } else {
                const message = 'Geração interrompida. Clique em "Tentar novamente".';
                setGenerationLogMessage(message);
                setGenerationLoading(false);
                setRetryVisible(true, message);
            }
        }
        if (progressLastUpdateAt && Date.now() - progressLastUpdateAt > 30000) {
            const friendlyMessage = 'Sem atualização do backend. Clique em "Tentar novamente".';
            setGenerationLogMessage(friendlyMessage);
            setGenerationLoading(false);
            setRetryVisible(true, friendlyMessage);
        }
    } catch {}
}

function startCalendarProgressPolling(calendarId) {
    progressCalendarId = calendarId;
    progressLastUpdateAt = Date.now();
    progressLastToken = '';
    progressLastLogLength = 0;
    progressCompleted = false;
    setRetryVisible(false);
    setGenerationStatusMessage('');
    renderProgressLog('');
    if (progressPollInterval) clearInterval(progressPollInterval);
    progressPollInterval = setInterval(pollCalendarProgress, 1500);
    pollCalendarProgress();
}

function stopCalendarProgressPolling() {
    if (progressPollInterval) {
        clearInterval(progressPollInterval);
        progressPollInterval = null;
    }
    progressCalendarId = null;
}

function generateRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function waitForCalendarUpdate(options = {}) {
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 10000;
    const intervalMs = Number.isFinite(Number(options.intervalMs)) ? Number(options.intervalMs) : 500;
    return new Promise((resolve) => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            const hasEvents = window.calendar && typeof window.calendar.getEvents === 'function'
                ? window.calendar.getEvents().length > 0
                : false;
            const hasCache = Array.isArray(socialPostsCache) && socialPostsCache.length > 0;
            if (hasEvents || hasCache) {
                clearInterval(timer);
                resolve(true);
                return;
            }
            if (Date.now() - startedAt >= timeoutMs) {
                clearInterval(timer);
                resolve(false);
            }
        }, intervalMs);
    });
}

const MEDIA_BUCKET = 'social_media_uploads';
const mediaUploadState = {
    feed: [],
    story: []
};

function sanitizeFileName(name) {
    return String(name || 'arquivo').replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

function resolveMediaType(file) {
    const name = String(file?.name || '');
    const type = String(file?.type || '');
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type === 'application/pdf' || name.match(/\.pdf$/i)) return 'pdf';
    if (name.match(/\.(doc|docx|txt)$/i) || type.includes('word') || type.includes('text')) return 'doc';
    return 'doc';
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
    if (post?.imagem_url) {
        list.push({ public_url: post.imagem_url, type: 'image', name: 'imagem', size: null, source: 'post_media' });
    }
    if (post?.video_url) {
        list.push({ public_url: post.video_url, type: 'video', name: 'video', size: null, source: 'post_media' });
    }
    if (post?.arquivo_url) {
        list.push({ public_url: post.arquivo_url, type: 'doc', name: 'arquivo', size: null, source: 'post_media' });
    }
    return list;
}

function getPostMedias(post) {
    const normalized = normalizeMedias(post?.medias);
    if (normalized.length) return normalized;
    return getLegacyMedias(post);
}

function getPublicUrlFromPath(path) {
    if (!path || !window.supabaseClient?.storage) return '';
    const { data } = window.supabaseClient.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return data?.publicUrl || '';
}

function normalizeCreativeGuide(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
            const parsed = JSON.parse(trimmed);
            return typeof parsed === 'object' ? parsed : value;
        } catch {
            return value;
        }
    }
    return null;
}

function formatCreativeGuideForTextarea(value) {
    const guide = normalizeCreativeGuide(value);
    if (!guide) return '';
    if (typeof guide === 'string') return guide;
    const parts = [];
    const criativo = guide.criativo || null;
    if (criativo) {
        const tipo = criativo.tipo || criativo.formato || '';
        if (tipo) parts.push(`Criativo: ${tipo}`);
        if (criativo.conceito_visual) parts.push(`Conceito visual:\n${criativo.conceito_visual}`);
        if (criativo.composicao) parts.push(`Composição:\n${criativo.composicao}`);
        if (criativo.texto_na_arte) parts.push(`Texto na arte:\n${criativo.texto_na_arte}`);
        if (criativo.banco_imagens_sugerido) parts.push(`Banco de imagens sugerido:\n${criativo.banco_imagens_sugerido}`);
        if (Array.isArray(criativo.checklist_designer) && criativo.checklist_designer.length) {
            parts.push(`Checklist do designer:\n- ${criativo.checklist_designer.join('\n- ')}`);
        }
        if (Array.isArray(criativo.slides) && criativo.slides.length) {
            const slidesText = criativo.slides.map((slide, index) => {
                const title = slide?.titulo_do_slide || slide?.titulo || `Slide ${index + 1}`;
                const copy = slide?.copy || '';
                const visual = slide?.visual_sugerido || '';
                return [`${title}`, copy ? `Copy: ${copy}` : '', visual ? `Visual: ${visual}` : ''].filter(Boolean).join('\n');
            }).join('\n\n');
            parts.push(`Slides:\n${slidesText}`);
        }
        if (criativo.roteiro) {
            const roteiro = criativo.roteiro || {};
            const roteiroParts = [];
            if (roteiro.gancho) roteiroParts.push(`Gancho: ${roteiro.gancho}`);
            if (roteiro.desenvolvimento) roteiroParts.push(`Desenvolvimento: ${roteiro.desenvolvimento}`);
            if (roteiro.encerramento) roteiroParts.push(`Encerramento: ${roteiro.encerramento}`);
            if (roteiroParts.length) parts.push(`Roteiro:\n${roteiroParts.join('\n')}`);
        }
        if (Array.isArray(criativo.cenas_sugeridas) && criativo.cenas_sugeridas.length) {
            parts.push(`Cenas sugeridas:\n- ${criativo.cenas_sugeridas.join('\n- ')}`);
        }
        if (Array.isArray(criativo.sugestoes_captacao) && criativo.sugestoes_captacao.length) {
            parts.push(`Sugestões de captação:\n- ${criativo.sugestoes_captacao.join('\n- ')}`);
        }
        return parts.filter(Boolean).join('\n\n');
    }
    if (guide.creative_guide) parts.push(String(guide.creative_guide));
    if (Array.isArray(guide.assets_checklist) && guide.assets_checklist.length) {
        parts.push(`Assets:\n- ${guide.assets_checklist.join('\n- ')}`);
    }
    if (guide.layout_or_script) parts.push(`Layout/Roteiro:\n${guide.layout_or_script}`);
    return parts.filter(Boolean).join('\n\n');
}

function mergeCreativeGuide(existing, textValue) {
    const trimmed = String(textValue || '').trim();
    if (!trimmed) return existing || null;
    const normalized = normalizeCreativeGuide(existing);
    if (normalized && typeof normalized === 'object') {
        return { ...normalized, creative_guide: trimmed };
    }
    return trimmed;
}

function buildMediaThumbs(medias) {
    const items = Array.isArray(medias) ? medias : [];
    if (!items.length) return '';
    const thumbs = items.slice(0, 3).map((media) => {
        const url = media.public_url || getPublicUrlFromPath(media.path);
        if (media.type === 'image' && url) {
            return `<img src="${url}" class="w-6 h-6 rounded object-cover border border-gray-200" alt="">`;
        }
        if (media.type === 'video' && url) {
            return `<div class="w-6 h-6 rounded bg-gray-900 text-white flex items-center justify-center text-[10px]"><i class="fas fa-play"></i></div>`;
        }
        if (media.type === 'pdf') {
            return `<div class="w-6 h-6 rounded bg-red-50 text-red-600 flex items-center justify-center text-[10px]"><i class="fas fa-file-pdf"></i></div>`;
        }
        return `<div class="w-6 h-6 rounded bg-gray-100 text-gray-500 flex items-center justify-center text-[10px]"><i class="fas fa-file"></i></div>`;
    });
    return `<div class="mt-2 flex gap-1">${thumbs.join('')}</div>`;
}

function renderPostMediaList(medias) {
    const list = document.getElementById('post-media-list');
    if (!list) return;
    const items = Array.isArray(medias) ? medias : [];
    if (!items.length) {
        list.innerHTML = '<div class="text-sm text-gray-500">Nenhum anexo.</div>';
        return;
    }
    list.innerHTML = '';
    items.forEach((media) => {
        const url = media.public_url || getPublicUrlFromPath(media.path);
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg';
        const left = document.createElement('div');
        left.className = 'flex items-center gap-3';
        if (media.type === 'image' && url) {
            left.innerHTML = `<img src="${url}" class="w-12 h-12 rounded-lg object-cover border border-gray-200" alt="">`;
        } else if (media.type === 'video' && url) {
            left.innerHTML = `<div class="w-12 h-12 rounded-lg bg-gray-900 text-white flex items-center justify-center"><i class="fas fa-play"></i></div>`;
        } else if (media.type === 'pdf') {
            left.innerHTML = `<div class="w-12 h-12 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><i class="fas fa-file-pdf text-lg"></i></div>`;
        } else {
            left.innerHTML = `<div class="w-12 h-12 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center"><i class="fas fa-file text-lg"></i></div>`;
        }
        const meta = document.createElement('div');
        meta.className = 'flex flex-col';
        const name = document.createElement('span');
        name.className = 'text-sm font-medium text-gray-700';
        name.textContent = media.name || 'Anexo';
        const tag = document.createElement('span');
        tag.className = 'text-xs text-gray-400 uppercase';
        tag.textContent = media.source || 'post_media';
        meta.appendChild(name);
        meta.appendChild(tag);
        left.appendChild(meta);
        const link = document.createElement('a');
        link.className = 'text-xs text-primary font-semibold underline';
        link.href = url || '#';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = url ? 'Abrir' : 'Indisponível';
        wrapper.appendChild(left);
        wrapper.appendChild(link);
        list.appendChild(wrapper);
    });
}

function resetMediaUploadState() {
    mediaUploadState.feed = [];
    mediaUploadState.story = [];
}

function buildStoragePath({ clientId, month, postId, source, fileName }) {
    const safeName = sanitizeFileName(fileName);
    const parts = [`client_${clientId}`];
    if (month) parts.push(`month_${month}`);
    parts.push(source || 'post_media');
    if (postId) parts.push(`post_${postId}`);
    return `${parts.join('/')}/${Date.now()}-${safeName}`;
}

async function uploadMediaFiles(files, { clientId, month, postId, source }) {
    const uploads = [];
    if (!files || !files.length) return uploads;
    for (const file of files) {
        const path = buildStoragePath({ clientId, month, postId, source, fileName: file.name });
        const { error } = await window.supabaseClient.storage
            .from(MEDIA_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const publicUrl = getPublicUrlFromPath(path);
        uploads.push({
            path,
            type: resolveMediaType(file),
            name: file.name,
            size: file.size,
            source: source || 'post_media',
            public_url: publicUrl || null
        });
    }
    return uploads;
}

let socialMediaDomReady = false;
let socialMediaSupabaseReady = false;

const tryLoadSocialMediaClients = () => {
    if (!socialMediaDomReady || !socialMediaSupabaseReady) return;
    loadClientes();
};

window.addEventListener('supabaseReady', () => {
    socialMediaSupabaseReady = true;
    tryLoadSocialMediaClients();
});

document.addEventListener('DOMContentLoaded', async () => {
    socialMediaDomReady = true;
    if (window.supabaseClient) {
        socialMediaSupabaseReady = true;
        tryLoadSocialMediaClients();
    } else {
        setTimeout(() => {
            if (window.supabaseClient) {
                socialMediaSupabaseReady = true;
                tryLoadSocialMediaClients();
            }
        }, 800);
    }
    initCalendar();
    ensureSocialMediaPermission().then(updateGenerateButtonState);
    applySocialTabFromHash();

    const selectCliente = document.getElementById('select-cliente');
    if (selectCliente) {
        selectCliente.addEventListener('change', (e) => {
            currentClienteId = e.target.value;
            checkSelection();
            updateCalendarConnections(currentClienteId);
        });
    }

    const inputMes = document.getElementById('input-mes');
    if (inputMes) {
        if (!inputMes.value) {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            inputMes.value = `${yyyy}-${mm}`;
        }
        currentMonth = inputMes.value;
        inputMes.addEventListener('change', (e) => {
            currentMonth = e.target.value;
            if (calendar) calendar.gotoDate(currentMonth + '-01');
            checkSelection();
        });
    }

    const btnHeaderGenerate = document.getElementById('btn-header-generate');
    if (btnHeaderGenerate) btnHeaderGenerate.addEventListener('click', handleGenerateClick);
    
    const btnDelete = document.getElementById('btn-delete-calendar');
    if (btnDelete) btnDelete.addEventListener('click', deleteCalendar);

        const { modal: modalGeneration } =
            typeof getGenerationModalElements === "function"
                ? getGenerationModalElements()
                : { modal: null };

        if (modalGeneration) {
            modalGeneration.addEventListener("click", (e) => {
                // clique no overlay fecha
                if (e.target === modalGeneration) window.closeGenerationModal();
            });
        }

        // Compatível: botões por ID (HTML antigo)
        const btnGenerationCancel = document.getElementById("btn-generation-cancel");
        if (btnGenerationCancel)
            btnGenerationCancel.addEventListener("click", window.closeGenerationModal);

        const btnGenerationClose = document.getElementById("btn-generation-close");
        if (btnGenerationClose)
            btnGenerationClose.addEventListener("click", window.closeGenerationModal);

        // Compatível: botões/overlay por data-attribute (HTML novo)
        document.addEventListener("click", (e) => {
            const target =
                e.target && e.target.closest
                    ? e.target.closest("[data-close-generation]")
                    : null;
            if (!target) return;
            e.preventDefault();
            window.closeGenerationModal();
        });

    const btnGenerationConfirm = document.getElementById('btn-generation-confirm');
    if (btnGenerationConfirm) {
        btnGenerationConfirm.onclick = () => {
            const postsCountInput = document.getElementById('postsCount');
            const seasonalDatesInput = document.getElementById('seasonalDates');
            const rawCount = postsCountInput ? parseInt(postsCountInput.value, 10) : 12;
            const postsCount = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 12;
            const seasonalDates = seasonalDatesInput ? seasonalDatesInput.value
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean) : [];
            generateCalendar({ postsCount, seasonalDates });
        };
    }

    const modalPost = document.getElementById('modal-post');
    if (modalPost) {
        modalPost.addEventListener('click', (e) => {
            if (e.target === modalPost) window.closePostModal();
        });
    }
});

// Expor initCalendar globalmente
window.initCalendar = initCalendar;

function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // Se já existir, destrói para recriar (evita duplicação)
    if (window.calendar && typeof window.calendar.destroy === 'function') {
        window.calendar.destroy();
    }

    window.calendar = calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        buttonText: {
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            day: 'Dia',
            list: 'Lista'
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        height: '100%',
        editable: true,
        droppable: true,
        dayMaxEvents: 2,
        events: [],
        
        dayCellContent: function(arg) {
            // Retorna ao padrão simples, apenas com o número da data
            return { html: `<a class="fc-daygrid-day-number" style="text-decoration: none; color: #374151; font-weight: 700; cursor: pointer; padding: 4px;">${arg.dayNumberText}</a>` };
        },
        
        dateClick: function(info) {
             // Clique na célula vazia abre o modal para aquela data
             window.openFormatModal(info.dateStr);
        },
        
        eventContent: function(arg) {
            const props = arg.event.extendedProps;
            const formato = props.formato || 'post';
            let iconClass = 'fa-file-alt';
            let bgColorClass = 'bg-blue-50';
            let borderColorClass = 'border-blue-500';
            let textColorClass = 'text-blue-700';
            
            if (formato && formato.toLowerCase().includes('reels')) {
                iconClass = 'fa-video';
                bgColorClass = 'bg-pink-50';
                borderColorClass = 'border-pink-500';
                textColorClass = 'text-pink-700';
            } else if (formato && formato.toLowerCase().includes('carrossel')) {
                iconClass = 'fa-images';
                bgColorClass = 'bg-purple-50';
                borderColorClass = 'border-purple-500';
                textColorClass = 'text-purple-700';
            } else if (formato && formato.toLowerCase().includes('story')) {
                iconClass = 'fa-clock';
                bgColorClass = 'bg-yellow-50';
                borderColorClass = 'border-yellow-500';
                textColorClass = 'text-yellow-700';
            } else if (formato && formato.toLowerCase().includes('estatico')) {
                iconClass = 'fa-image';
                bgColorClass = 'bg-blue-50';
                borderColorClass = 'border-blue-500';
                textColorClass = 'text-blue-700';
            }

            let statusIcon = '';
            let statusClass = '';
            
            if (props.status === POST_STATUS.APPROVED) {
                const approvedLabel = POST_STATUS_LABEL?.[POST_STATUS.APPROVED] || 'Aprovado';
                statusIcon = `<i class="fas fa-check-circle text-green-500 ml-1" title="${approvedLabel}"></i>`;
                borderColorClass = 'border-green-500';
                bgColorClass = 'bg-green-50';
                textColorClass = 'text-green-700';
            } else if (props.status === POST_STATUS.REJECTED) {
                const rejectedLabel = POST_STATUS_LABEL?.[POST_STATUS.REJECTED] || 'Ajustes Solicitados';
                statusIcon = `<i class="fas fa-exclamation-circle text-red-500 ml-1" title="${rejectedLabel}"></i>`;
                borderColorClass = 'border-red-500';
                bgColorClass = 'bg-red-50';
                textColorClass = 'text-red-700';
            } else if (props.status === POST_STATUS.DESIGN_IN_PROGRESS) {
                const inProgressLabel = POST_STATUS_LABEL?.[POST_STATUS.DESIGN_IN_PROGRESS] || 'Em Produção';
                statusIcon = `<i class="fas fa-pencil-alt text-orange-500 ml-1" title="${inProgressLabel}"></i>`;
                borderColorClass = 'border-orange-500';
                bgColorClass = 'bg-orange-50';
                textColorClass = 'text-orange-700';
            } else if (props.status === POST_STATUS.READY_FOR_APPROVAL) {
                const pendingLabel = POST_STATUS_LABEL?.[POST_STATUS.READY_FOR_APPROVAL] || 'Pendente Aprovação';
                statusIcon = `<i class="fas fa-clock text-yellow-500 ml-1" title="${pendingLabel}"></i>`;
                borderColorClass = 'border-yellow-500';
                bgColorClass = 'bg-yellow-50';
                textColorClass = 'text-yellow-700';
            }

            const mediaThumbs = buildMediaThumbs(getPostMedias(props));
            let html = `
                <div class="event-card text-xs ${borderColorClass} ${bgColorClass} shadow-sm rounded-r overflow-hidden cursor-pointer hover:shadow-md transition-shadow">
                    <div class="font-bold truncate flex items-center gap-1.5 ${textColorClass}">
                        <i class="fas ${iconClass}"></i>
                        <span class="truncate">${arg.event.title}</span>
                        ${statusIcon}
                    </div>
                    ${mediaThumbs}
                </div>
            `;
            return { html: html };
        },
        
        eventDrop: async function(info) {
            try {
                const newDate = info.event.start.toISOString().split('T')[0];
                const { error } = await window.supabaseClient
                    .from('social_posts')
                    .update({ data_agendada: newDate })
                    .eq('id', info.event.id);
                if (error) throw error;
            } catch (err) {
                console.error('Erro ao mover:', err);
                alert('Erro ao atualizar data: ' + err.message);
                info.revert();
            }
        },
        
        eventClick: function(info) {
            openPostModal(info.event);
        },
        datesSet: function(info) {
            updateApprovalButtonsForView(info.view?.type || '');
        }
    });

    calendar.render();
    window.__gqvCalendarInstance = calendar;
    updateApprovalButtonsForView(calendar?.view?.type || '');
}

async function ensureCalendarRendered() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || !calendar) return false;
    if (!calendarEl.querySelector('.fc-view-harness')) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    return true;
}

function openPostModal(event) {
    const props = event.extendedProps;
    currentPostProps = props || null;
    const modal = document.getElementById('modal-post');
    const content = document.getElementById('modal-post-content');
    
    document.getElementById('post-tema').value = event.title || '';
    
    const dateStr = event.startStr.split('T')[0];
    document.getElementById('post-data').value = dateStr;
    
    const timeStr = props.hora_agendada || '10:00';
    const timeInput = document.getElementById('post-hora');
    if(timeInput) timeInput.value = timeStr.substring(0, 5);

    document.getElementById('post-formato').value = (props.formato || 'estatico').toLowerCase();
    
    const connectionData = calendarConnectionsCache[currentClienteId];
    const clientPlatforms = connectionData ? (connectionData.connected || []).map(item => item.platform) : [];
    
    const platInput = document.getElementById('post-plataformas');
    if(platInput) {
        platInput.value = clientPlatforms.join(', ') || 'Nenhuma conectada';
    }

    const roteiroInput = document.getElementById('post-roteiro');
    if(roteiroInput) roteiroInput.value = props.conteudo_roteiro || '';

    document.getElementById('post-estrategia').value = props.estrategia || '';
    const creativeField = document.getElementById('post-visual');
    if (creativeField) creativeField.value = formatCreativeGuideForTextarea(props.creative_guide || props.descricao_visual);
    
    const container = document.getElementById('legendas-container');
    if (container) {
        container.innerHTML = '';
        
        // Determinar plataformas visíveis
        const activePlatforms = clientPlatforms.filter(p => ['instagram', 'facebook', 'linkedin', 'tiktok'].includes(p.toLowerCase()));
        
        // Se não houver plataformas, mostra mensagem ou esconde
        if (activePlatforms.length === 0) {
            container.innerHTML = window.renderPlatformNotConnectedCTA(currentClienteId, 'Instagram/Facebook/LinkedIn/TikTok');
            return;
        }

        const hasMeta = activePlatforms.some(p => ['instagram', 'facebook'].includes(p.toLowerCase()));
        const hasLinkedin = activePlatforms.some(p => p.toLowerCase() === 'linkedin');
        const hasTiktok = activePlatforms.some(p => p.toLowerCase() === 'tiktok');

        const createField = (id, label, value, icon) => {
            const div = document.createElement('div');
            div.className = 'space-y-2';
            const actionButton = id === 'post-legenda'
                ? `<button type="button" id="btn-improve-copy" onclick="improveCopyWithAI()" class="text-xs px-3 py-1.5 border border-purple-300 text-purple-600 rounded-md hover:bg-purple-50 transition-colors flex items-center gap-1">
                        <i class="fas fa-magic"></i> ✨ Melhorar com IA
                   </button>`
                : '';
            div.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <label class="block text-sm font-medium text-gray-700 flex items-center gap-2">
                        <i class="fab fa-${icon}"></i> ${label}
                    </label>
                    ${actionButton}
                </div>
                <textarea id="${id}" rows="3" 
                    class="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none text-sm"
                    placeholder="Escreva a legenda para ${label.split(' ')[1]}...">${value || ''}</textarea>
            `;
            container.appendChild(div);
        };

        // 1. Legenda Principal (Instagram/Facebook)
        if (hasMeta || (!hasLinkedin && !hasTiktok)) {
            const val = props.legenda || '';
            const label = hasMeta ? 'Legenda Instagram/Facebook' : 'Legenda Principal';
            createField('post-legenda', label, val, 'instagram');
        }

        // 2. Legenda LinkedIn
        if (hasLinkedin) {
            createField('post-legenda-linkedin', 'Legenda LinkedIn', props.legenda_linkedin, 'linkedin');
        }

        // 3. Legenda TikTok
        if (hasTiktok) {
            createField('post-legenda-tiktok', 'Legenda TikTok', props.legenda_tiktok, 'tiktok');
        }

        // 4. Legenda YouTube

        // Configurar Upload de Mídia (Feed/Story)
        setupMediaUpload(activePlatforms, (props.formato || 'estatico').toLowerCase());
    }

    resetMediaUploadState();
    renderPostMediaList(getPostMedias(props));

    // Carregar feedback se houver
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackText = document.getElementById('post-feedback-text');
    
    // Configurar Badge de Status
    const statusBadge = document.getElementById('post-status-badge');
    if (statusBadge) {
        if (props.status === POST_STATUS.APPROVED) {
            statusBadge.textContent = POST_STATUS_LABEL?.[POST_STATUS.APPROVED] || 'Aprovado';
            statusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200';
        } else if (props.status === POST_STATUS.REJECTED) {
            statusBadge.textContent = POST_STATUS_LABEL?.[POST_STATUS.REJECTED] || 'Ajustes Solicitados';
            statusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200';
        } else if (props.status === POST_STATUS.READY_FOR_APPROVAL) {
            statusBadge.textContent = POST_STATUS_LABEL?.[POST_STATUS.READY_FOR_APPROVAL] || 'Pendente Aprovação';
            statusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200';
        } else {
            statusBadge.textContent = POST_STATUS_LABEL?.[POST_STATUS.DRAFT] || 'Rascunho';
            statusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800';
        }
    }

    // Resetar estado de readonly e feedback
    const formInputs = modal.querySelectorAll('input, textarea, select');
    const isApproved = props.status === POST_STATUS.APPROVED;
    
    formInputs.forEach(input => {
        if (input.tagName === 'SELECT' || input.type === 'file' || input.type === 'date' || input.type === 'time') {
            input.disabled = isApproved;
        } else {
            input.readOnly = isApproved;
        }

        if (isApproved) {
            input.classList.add('bg-gray-50');
            input.classList.remove('bg-white');
            if (input.tagName === 'SELECT' || input.type === 'file') input.classList.add('cursor-not-allowed');
        } else {
            input.disabled = false;
            input.readOnly = false;
            input.classList.remove('bg-gray-50', 'cursor-not-allowed');
            input.classList.add('bg-white'); // Restaurar bg-white se necessário (alguns inputs usam bg-gray-50 por padrão no html, cuidado)
            // No HTML original: bg-gray-50 border border-gray-200 ... focus:bg-white
            // Então remover bg-gray-50 pode quebrar o estilo padrão.
            // Vamos apenas remover a classe de 'readonly' visual se não estiver aprovado.
            // Melhor abordagem: Resetar classes para o padrão esperado.
            
            // O HTML original usa bg-gray-50 por padrão.
            input.classList.add('bg-gray-50'); 
            input.classList.remove('bg-gray-100'); // Remover a classe antiga de disabled se existir
        }
    });

    // Tratamento de botões se aprovado
    const btnImproveCopy = document.getElementById('btn-improve-copy');
    if (btnImproveCopy) btnImproveCopy.disabled = isApproved;
    const btnChangeTheme = document.getElementById('btn-change-theme');
    if (btnChangeTheme) btnChangeTheme.disabled = isApproved;

    const btnSave = document.querySelector('#modal-post button[onclick="savePost()"]');
    if (btnSave) {
        btnSave.disabled = isApproved;
        btnSave.style.display = isApproved ? 'none' : 'block';
        btnSave.onclick = () => savePost(event.id);
    }

    if (feedbackArea && feedbackText) {
        // Suporte para feedback antigo (texto) ou novo (JSON)
        let feedbackContent = '';
        
        if (props.feedback_cliente) {
            if (typeof props.feedback_cliente === 'object') {
                const tipos = props.feedback_cliente.tipo ? props.feedback_cliente.tipo.join(', ') : 'Geral';
                feedbackContent = `<strong>Solicitação (${tipos}):</strong> ${props.feedback_cliente.comentario}`;
            } else {
                feedbackContent = props.feedback_cliente;
            }
        } else if (props.feedback_ajuste) {
            feedbackContent = props.feedback_ajuste;
        }

        if (feedbackContent) {
            feedbackText.innerHTML = feedbackContent;
            feedbackArea.classList.remove('hidden');
            feedbackArea.className = 'mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm mb-4';
            
            // Adicionar cabeçalho de alerta
            // Limpa filhos anteriores para evitar duplicação ou erro de referência
            const existingHeader = feedbackArea.querySelector('.feedback-header');
            if (existingHeader) existingHeader.remove();

            const header = document.createElement('div');
            header.className = 'feedback-header font-bold mb-1 flex items-center gap-2';
            header.innerHTML = '<i class="fas fa-exclamation-circle"></i> Ajuste Solicitado pelo Cliente';
            
            // Verifica se feedbackText ainda é filho de feedbackArea antes de inserir
            if (feedbackText.parentNode === feedbackArea) {
                feedbackArea.insertBefore(header, feedbackText);
            } else {
                // Fallback caso a estrutura tenha mudado
                feedbackArea.prepend(header);
            }
        } else {
            feedbackArea.classList.add('hidden');
            feedbackText.innerHTML = '';
        }
    }
    
    // Aviso se aprovado
    if (isApproved) {
        let approvedBanner = document.getElementById('approved-banner');
        if (!approvedBanner) {
            approvedBanner = document.createElement('div');
            approvedBanner.id = 'approved-banner';
            approvedBanner.className = 'mb-4 p-3 bg-green-100 border border-green-200 text-green-700 rounded-lg flex items-center gap-2 font-medium';
            approvedBanner.innerHTML = '<i class="fas fa-check-circle"></i> Post Aprovado pelo Cliente (Somente Leitura)';
            content.insertBefore(approvedBanner, content.firstChild);
        }
    } else {
        const banner = document.getElementById('approved-banner');
        if (banner) banner.remove();
    }
    
    // Configurar botão de excluir
    const btnDelete = document.querySelector('#modal-post button[onclick="deletePost()"]');
    if (btnDelete) {
        if (event.id) {
            btnDelete.parentElement.style.display = 'flex'; // Mostrar container do footer completo
            btnDelete.style.display = 'block';
            document.getElementById('modal-post').dataset.eventId = event.id;
        } else {
            btnDelete.style.display = 'none';
            document.getElementById('modal-post').dataset.eventId = '';
        }
    }

    // Mostrar modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
    }, 10);
}

function getPlatformIcon(platform) {
    const map = {
        'instagram': 'instagram text-pink-600',
        'facebook': 'facebook text-blue-600',
        'linkedin': 'linkedin text-blue-700',
        'tiktok': 'tiktok text-black',
        'youtube': 'youtube text-red-600'
    };
    return map[platform] || 'share-alt';
}

function setupMediaUpload(platforms, formato) {
    const section = document.getElementById('media-upload-section');
    const feedInput = document.getElementById('file-feed');
    const storyInput = document.getElementById('file-story');
    const feedLimitInfo = document.getElementById('feed-limit-info');
    const previewFeed = document.getElementById('preview-feed');
    const previewStory = document.getElementById('preview-story');
    
    // Verificar se Instagram ou Facebook estão presentes
    const hasMeta = platforms.some(p => ['instagram', 'facebook'].includes(p.toLowerCase()));
    
    if (!hasMeta) {
        section.classList.add('hidden');
        return;
    }
    
    section.classList.remove('hidden');
    resetMediaUploadState();
    
    // Reset inputs
    if(feedInput) feedInput.value = '';
    if(storyInput) storyInput.value = '';
    if(previewFeed) previewFeed.innerHTML = '';
    if(previewStory) previewStory.innerHTML = '';

    // Configurar restrições baseadas no formato
    if (feedInput) {
        // Remover event listeners anteriores para evitar duplicação (idealmente usar named functions, mas aqui faremos reset simples)
        const newFeedInput = feedInput.cloneNode(true);
        feedInput.parentNode.replaceChild(newFeedInput, feedInput);
        
        if (formato === 'carrossel') {
            newFeedInput.setAttribute('multiple', 'multiple');
            newFeedInput.setAttribute('accept', 'image/*');
            feedLimitInfo.textContent = '(Até 10 imagens)';
            
            newFeedInput.addEventListener('change', (e) => handleFileSelect(e, 'feed', 10, 'image'));
        } else if (formato === 'estatico') {
            newFeedInput.removeAttribute('multiple');
            newFeedInput.setAttribute('accept', 'image/*');
            feedLimitInfo.textContent = '(Apenas 1 imagem)';
            
            newFeedInput.addEventListener('change', (e) => handleFileSelect(e, 'feed', 1, 'image'));
        } else if (formato === 'reels') {
            newFeedInput.removeAttribute('multiple');
            newFeedInput.setAttribute('accept', 'video/*');
            feedLimitInfo.textContent = '(Apenas 1 vídeo)';
            
            newFeedInput.addEventListener('change', (e) => handleFileSelect(e, 'feed', 1, 'video'));
        }
    }

    // Configurar Story (Sempre permitido para Meta)
    if (storyInput) {
        const newStoryInput = storyInput.cloneNode(true);
        storyInput.parentNode.replaceChild(newStoryInput, storyInput);
        newStoryInput.addEventListener('change', (e) => handleFileSelect(e, 'story', 1, 'all')); // 'all' permite verificar duração se for vídeo
    }
}

function handleFileSelect(event, type, maxFiles, acceptType) {
    const files = Array.from(event.target.files);
    const container = document.getElementById(`preview-${type}`);
    container.innerHTML = '';

    if (files.length > maxFiles) {
        alert(`O limite é de ${maxFiles} arquivo(s) para este formato.`);
        event.target.value = '';
        return;
    }

    const acceptedFiles = [];
    files.forEach(file => {
        // Validação de tipo
        if (acceptType === 'image' && !file.type.startsWith('image/')) {
            alert('Apenas imagens são permitidas para este formato.');
            return;
        }
        if (acceptType === 'video' && !file.type.startsWith('video/')) {
            alert('Apenas vídeos são permitidas para este formato.');
            return;
        }

        // Validação específica de Story (Duração)
        if (type === 'story' && file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = function() {
                window.URL.revokeObjectURL(video.src);
                if (video.duration > 30) { // Margem de erro 29s -> 30s
                    alert('O vídeo do Story deve ter no máximo 29 segundos.');
                    // Remover preview ou limpar input
                }
            }
            video.src = URL.createObjectURL(file);
        }

        acceptedFiles.push(file);
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'relative group aspect-square rounded-lg overflow-hidden border border-gray-200';
            
            if (file.type.startsWith('image/')) {
                div.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
            } else {
                div.innerHTML = `<video src="${e.target.result}" class="w-full h-full object-cover"></video><div class="absolute inset-0 flex items-center justify-center bg-black/30"><i class="fas fa-play text-white"></i></div>`;
            }
            
            // Botão remover (visual apenas por enquanto)
            const btnRemove = document.createElement('button');
            btnRemove.className = 'absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity';
            btnRemove.innerHTML = '<i class="fas fa-times"></i>';
            btnRemove.onclick = (ev) => {
                ev.preventDefault();
                div.remove();
                // TODO: Remover do input file (complexo sem DataTransfer) ou gerenciar array separado
            };
            
            div.appendChild(btnRemove);
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    mediaUploadState[type] = acceptedFiles;
}

window.closePostModal = function closePostModal() {
    const modal = document.getElementById('modal-post');
    const content = document.getElementById('modal-post-content');
    if (!modal || !content) return;
    currentPostProps = null;
    modal.dataset.eventId = '';
    if (modal.dataset.currentStatus) {
        delete modal.dataset.currentStatus;
    }
    const feedbackArea = document.getElementById('feedback-area');
    const feedbackText = document.getElementById('post-feedback-text');
    if (feedbackText) feedbackText.innerHTML = '';
    if (feedbackArea) feedbackArea.classList.add('hidden');
    const statusBadge = document.getElementById('post-status-badge');
    if (statusBadge) {
        statusBadge.textContent = '';
        statusBadge.className = '';
    }
    const approvedBanner = document.getElementById('approved-banner');
    if (approvedBanner) approvedBanner.remove();
    const inputs = modal.querySelectorAll('input, textarea, select');
    inputs.forEach((input) => {
        if (input.tagName === 'SELECT') {
            input.value = '';
            return;
        }
        if (input.type === 'file') {
            input.value = '';
            return;
        }
        input.value = '';
    });
    const previewFeed = document.getElementById('preview-feed');
    if (previewFeed) previewFeed.innerHTML = '';
    const previewStory = document.getElementById('preview-story');
    if (previewStory) previewStory.innerHTML = '';
    resetMediaUploadState();
    modal.classList.add('opacity-0');
    content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300);
}

async function savePost() {
    const modal = document.getElementById('modal-post');
    const eventId = modal.dataset.eventId;
    
    const btn = document.querySelector('#modal-post button[onclick="savePost()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';

    try {
        const postData = {
            tema: document.getElementById('post-tema').value,
            data_agendada: document.getElementById('post-data').value,
            hora_agendada: document.getElementById('post-hora')?.value || '10:00',
            formato: document.getElementById('post-formato').value,
            descricao_visual: document.getElementById('post-visual')?.value,
            conteudo_roteiro: document.getElementById('post-roteiro')?.value,
            estrategia: document.getElementById('post-estrategia').value,
            legenda: document.getElementById('post-legenda')?.value,
            legenda_linkedin: document.getElementById('post-legenda-linkedin')?.value,
            legenda_tiktok: document.getElementById('post-legenda-tiktok')?.value,
            updated_at: new Date()
        };
        postData.creative_guide = mergeCreativeGuide(currentPostProps?.creative_guide, document.getElementById('post-visual')?.value);
        const existingMedias = getPostMedias(currentPostProps);
        const selectedFiles = [...mediaUploadState.feed, ...mediaUploadState.story];
        if (selectedFiles.length) {
            const uploadedMedias = await uploadMediaFiles(selectedFiles, {
                clientId: currentClienteId,
                month: currentMonth,
                postId: eventId || null,
                source: 'post_media'
            });
            postData.medias = [...existingMedias, ...uploadedMedias];
        }

        const currentStatus = modal.dataset.currentStatus;

        if (eventId) {
            if (currentStatus !== POST_STATUS.DRAFT) {
                postData.status = POST_STATUS.READY_FOR_APPROVAL;
            }
            postData.status = POST_STATUS.READY_FOR_APPROVAL;

            const { error } = await window.supabaseClient
                .from('social_posts')
                .update(postData)
                .eq('id', eventId);
            if (error) throw error;

            // ATUALIZAR TAREFA VINCULADA
            // "a tarefa na 'tarefas' ela muda para 'enviar para aprovação do cliente'"
            const { error: taskError } = await window.supabaseClient
                .from('tarefas')
                .update({ status: 'enviar para aprovação do cliente' })
                .eq('post_id', eventId);
                
            if (taskError) console.error('Erro ao atualizar tarefa vinculada:', taskError);

            if (window.Logbook && window.Logbook.addAction) {
                window.Logbook.addAction({
                    clienteId: currentClienteId,
                    module: 'social_media',
                    actionType: 'post_updated',
                    title: 'Post atualizado',
                    details: JSON.stringify({
                        tema: postData.tema,
                        data: postData.data_agendada,
                        formato: postData.formato,
                        status: postData.status
                    }),
                    refType: 'social_post',
                    refId: eventId
                });
            }
        } else {
            postData.cliente_id = currentClienteId;
            postData.created_at = new Date();
            // Ao criar novo, também já nasce como pendente ou rascunho? 
            // Geralmente rascunho, mas se o usuário quer o fluxo...
            // Vou manter 'rascunho' na criação para não poluir com pendências incompletas, 
            // a menos que o usuário edite depois.
            postData.status = POST_STATUS.DRAFT;
            if (!postData.medias && selectedFiles.length) {
                const uploadedMedias = await uploadMediaFiles(selectedFiles, {
                    clientId: currentClienteId,
                    month: currentMonth,
                    postId: null,
                    source: 'post_media'
                });
                postData.medias = uploadedMedias;
            }
            const { error } = await window.supabaseClient
                .from('social_posts')
                .insert([postData]);
            if (error) throw error;
            if (window.Logbook && window.Logbook.addAction) {
                window.Logbook.addAction({
                    clienteId: currentClienteId,
                    module: 'social_media',
                    actionType: 'post_created',
                    title: 'Post criado',
                    details: JSON.stringify({
                        tema: postData.tema,
                        data: postData.data_agendada,
                        formato: postData.formato,
                        status: postData.status
                    }),
                    refType: 'social_post',
                    refId: null
                });
            }
        }

        window.closePostModal();
        await loadCalendarData();

    } catch (err) {
        console.error('Erro ao salvar post:', err);
        alert('Erro ao salvar: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

window.deletePost = async function deletePost() {
    const modal = document.getElementById('modal-post');
    const eventId = modal.dataset.eventId;
    if (!eventId) return;

    if (!confirm('Tem certeza que deseja excluir este post?')) return;

    try {
        const { error } = await window.supabaseClient
            .from('social_posts')
            .delete()
            .eq('id', eventId);

        if (error) throw error;

        if (window.Logbook && window.Logbook.addAction) {
            const temaValue = document.getElementById('post-tema')?.value;
            const dataValue = document.getElementById('post-data')?.value;
            window.Logbook.addAction({
                clienteId: currentClienteId,
                module: 'social_media',
                actionType: 'post_deleted',
                title: 'Post excluído',
                details: JSON.stringify({ tema: temaValue, data: dataValue }),
                refType: 'social_post',
                refId: eventId
            });
        }

        window.closePostModal();
        const event = calendar.getEventById(eventId);
        if (event) event.remove();
        await loadCalendarData();

    } catch (err) {
        console.error('Erro ao excluir:', err);
        alert('Erro ao excluir: ' + err.message);
    }
}

async function refineWithAI(targetId = 'post-legenda') {
    const legendaInput = document.getElementById(targetId);
    const temaInput = document.getElementById('post-tema');
    const roteiroInput = document.getElementById('post-roteiro');
    const visualInput = document.getElementById('post-visual');
    const btnRefine = document.querySelector(`button[onclick="refineWithAI('${targetId}')"]`);
    
    if (!legendaInput || !btnRefine) return;
    
    const originalText = btnRefine.innerHTML;
    btnRefine.disabled = true;
    btnRefine.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
    
    try {
        // VIBECODE SECURITY: Chave API movida para o backend (.env)
        // Não buscamos mais a chave no frontend para evitar exposição.
        // O backend (/api/openai/...) injetará a chave com segurança.
        
        // Mantemos apenas a verificação se o backend está respondendo (feito no fetch)

        const currentLegenda = legendaInput.value;
        const context = `
        Tema: ${temaInput?.value || 'Geral'}
        Roteiro/Conteúdo: ${roteiroInput?.value || 'Não informado'}
        Visual: ${visualInput?.value || 'Não informado'}
        Legenda Atual: ${currentLegenda || '(Vazia)'}
        `;

        let platformSpecificRules = '';
        if (targetId === 'post-legenda-linkedin') {
            platformSpecificRules = `
            ADAPTAÇÃO PARA LINKEDIN:
            - Tom: Profissional, corporativo e focado em negócios/carreira.
            - Estrutura: Parágrafos curtos para leitura fácil, mas conteúdo denso em valor.
            - Hashtags: Use apenas 3-5 hashtags estratégicas e profissionais.
            - Evite: Gírias excessivas ou linguagem muito informal. Foco em autoridade e networking.
            `;
        } else if (targetId === 'post-legenda-tiktok') {
            platformSpecificRules = `
            ADAPTAÇÃO PARA TIKTOK:
            - Tom: Dinâmico, viral e direto ao ponto.
            - Estrutura: Texto curto e impactante. O foco é fazer a pessoa assistir o vídeo até o final.
            - Hashtags: Use hashtags de tendências (trends) e virais.
            - Call to Action: Focado em interação rápida (comentar, compartilhar).
            `;
        } else {
            // Padrão (Instagram/Facebook)
            platformSpecificRules = `
            ADAPTAÇÃO PARA INSTAGRAM/FACEBOOK:
            - Tom: Envolvente, próximo e visual.
            - Estrutura: Storytelling cativante.
            - Hashtags: 15-20 hashtags estratégicas no final.
            `;
        }

        const prompt = `
        1. NÃO seja raso ou genérico.
        2. Use a estrutura AIDA (Atenção, Interesse, Desejo, Ação) de forma magistral.
        3. HOOK (Gancho): A primeira frase deve ser chocante, curiosa ou contra-intuitiva.
        4. LINGUAGEM: Use a linguagem da persona.
        5. EMOJIS: Use emojis para dar ritmo.
        
        ${platformSpecificRules}

        ${context}
        
        Retorne APENAS o texto da nova legenda.
        `;

        // PROXY VIBECODE: Chamada segura via backend local
        // Removemos a necessidade de apiKey no frontend
        const response = await fetch(`${window.API_BASE_URL}/api/openai/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Authorization é injetado pelo servidor
            },
            body: JSON.stringify({
                model: "gpt-4-turbo",
                messages: [
                    { role: "system", content: "Você é um Copywriter de Elite especialista em redes sociais. Escreve textos longos, persuasivos e formatados." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.8
            })
        });

        if (!response.ok) throw new Error('Erro na OpenAI');
        
        const data = await response.json();
        const newCaption = data.choices[0].message.content;
        
        legendaInput.value = newCaption;
        legendaInput.classList.add('ring-2', 'ring-green-500');
        setTimeout(() => legendaInput.classList.remove('ring-2', 'ring-green-500'), 2000);

    } catch (err) {
        console.error('Erro ao refinar:', err);
        alert('Erro ao melhorar legenda: ' + err.message);
    } finally {
        btnRefine.disabled = false;
        btnRefine.innerHTML = originalText;
    }
}

function buildCaptionText(caption, cta, hashtags) {
    const safeCaption = String(caption || '').trim();
    const safeCta = String(cta || '').trim();
    const tagList = Array.isArray(hashtags) ? hashtags.filter(Boolean).map(tag => String(tag)) : [];
    const tagText = tagList.length
        ? tagList.map(tag => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ')
        : '';
    return [safeCaption, safeCta, tagText].filter(Boolean).join('\n\n').trim();
}

function extractHashtags(text) {
    const matches = String(text || '').match(/#[\wÀ-ÿ_]+/g);
    return matches ? Array.from(new Set(matches)) : [];
}

function stripHashtags(text) {
    return String(text || '').replace(/#[\wÀ-ÿ_]+/g, '').replace(/\s{2,}/g, ' ').trim();
}

function parseEstrategia(estrategia) {
    const parts = String(estrategia || '').split('|').map(part => part.trim()).filter(Boolean);
    return {
        pillar: parts[0] || '',
        objective: parts[1] || ''
    };
}

function getSeasonalDatesPayload() {
    return Array.isArray(lastSeasonalDates) ? lastSeasonalDates : [];
}

function getClientContextPayload() {
    const client = clientDataMap[currentClienteId] || {};
    return {
        client_insights: String(client.client_insights || client.insights || ''),
        visual_identity: String(client.visual_identity || client.identidade_visual || '')
    };
}

function setButtonLoading(button, isLoading, loadingLabel) {
    if (!button) return;
    if (isLoading) {
        button.dataset.originalLabel = button.innerHTML;
        button.disabled = true;
        button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingLabel}`;
    } else {
        button.disabled = false;
        button.innerHTML = button.dataset.originalLabel || button.innerHTML;
        delete button.dataset.originalLabel;
    }
}

async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const sessionResult = await window.supabaseClient?.auth?.getSession();
    const token = sessionResult?.data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
}

function normalizeMonthValue(value) {
    const raw = String(value || '').trim();
    if (/^\d{4}-\d{2}$/.test(raw)) return raw;
    const match = raw.match(/^(\d{4})-(\d{1,2})$/);
    if (!match) return '';
    return `${match[1]}-${match[2].padStart(2, '0')}`;
}

function setApproveButtonLabel(button, label) {
    if (!button) return;
    if (!button.dataset.iconHtml) {
        const iconEl = button.querySelector('i');
        button.dataset.iconHtml = iconEl ? iconEl.outerHTML : '';
    }
    button.innerHTML = `${button.dataset.iconHtml ? `${button.dataset.iconHtml} ` : ''}${label}`;
}

async function fetchApprovalBatchStatus(clientId, month) {
    const normalizedMonth = normalizeMonthValue(month);
    if (!clientId || !normalizedMonth) return null;
    try {
        const headers = await getAuthHeaders();
        const url = new URL(`${window.API_BASE_URL}/api/client/calendar/approvals`);
        url.searchParams.set('month', normalizedMonth);
        url.searchParams.set('client_id', String(clientId));
        const res = await fetch(url.toString(), { headers });
        const text = await res.text();
        let data = null;
        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = null;
        }
        if (!res.ok) return null;
        const calendar = data?.calendar || null;
        if (!calendar) return null;
        return { status: calendar.status };
    } catch {
        return null;
    }
}

async function improveCopyWithAI() {
    const btn = document.getElementById('btn-improve-copy');
    const legendaInput = document.getElementById('post-legenda');
    const temaInput = document.getElementById('post-tema');
    const roteiroInput = document.getElementById('post-roteiro');
    const formatoInput = document.getElementById('post-formato');
    const estrategiaInput = document.getElementById('post-estrategia');

    if (!legendaInput || !temaInput || !roteiroInput || !formatoInput) return;

    setButtonLoading(btn, true, 'Melhorando...');

    try {
        const baseCaption = stripHashtags(legendaInput.value);
        const hashtags = extractHashtags(legendaInput.value);
        const fallbackEstrategia = currentPostProps?.estrategia || '';
        const parsedEstrategia = parseEstrategia(estrategiaInput?.value || fallbackEstrategia);
        const pillar = parsedEstrategia.pillar || currentPostProps?.pillar || currentPostProps?.pilar || '';
        const objective = parsedEstrategia.objective || currentPostProps?.objective || currentPostProps?.objetivo || '';
        const clientContext = getClientContextPayload();

        const payload = {
            client_insights: clientContext.client_insights,
            visual_identity: clientContext.visual_identity,
            seasonal_dates: getSeasonalDatesPayload(),
            post: {
                theme: temaInput.value || '',
                format: formatoInput.value || '',
                pillar,
                objective,
                structure: roteiroInput.value || '',
                caption: baseCaption,
                cta: '',
                hashtags
            }
        };

        const response = await fetch(`${window.API_BASE_URL}/api/social/improve-copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseClone = response.clone();
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            const text = await responseClone.text();
            throw new Error(text || 'Resposta inválida do servidor.');
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || data.error || 'Erro ao melhorar legenda.');
        }

        const result = data.data || {};
        legendaInput.value = buildCaptionText(result.caption, result.cta, result.hashtags);
        legendaInput.classList.add('ring-2', 'ring-green-500');
        setTimeout(() => legendaInput.classList.remove('ring-2', 'ring-green-500'), 2000);
    } catch (err) {
        console.error('Erro ao melhorar com IA:', err);
        alert('Não foi possível melhorar a legenda. Tente novamente.');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function changeThemeWithAI() {
    const btn = document.getElementById('btn-change-theme');
    const legendaInput = document.getElementById('post-legenda');
    const temaInput = document.getElementById('post-tema');
    const roteiroInput = document.getElementById('post-roteiro');
    const formatoInput = document.getElementById('post-formato');
    const estrategiaInput = document.getElementById('post-estrategia');
    const dataInput = document.getElementById('post-data');
    const horaInput = document.getElementById('post-hora');

    if (!legendaInput || !temaInput || !roteiroInput || !formatoInput) return;

    setButtonLoading(btn, true, 'Refazendo...');

    try {
        const fallbackEstrategia = currentPostProps?.estrategia || '';
        const parsedEstrategia = parseEstrategia(estrategiaInput?.value || fallbackEstrategia);
        const pillar = parsedEstrategia.pillar || currentPostProps?.pillar || currentPostProps?.pilar || '';
        const objective = parsedEstrategia.objective || currentPostProps?.objective || currentPostProps?.objetivo || '';
        const clientContext = getClientContextPayload();
        const currentTheme = temaInput.value || '';
        const possibleHook = String(roteiroInput.value || '').split('\n')[0] || '';

        const payload = {
            client_insights: clientContext.client_insights,
            visual_identity: clientContext.visual_identity,
            seasonal_dates: getSeasonalDatesPayload(),
            constraints: {
                scheduled_date: dataInput?.value || '',
                scheduled_time: horaInput?.value || '',
                pillar,
                objective,
                format: formatoInput.value || ''
            },
            post: {
                current_theme: currentTheme,
                current_hook: possibleHook
            }
        };

        const response = await fetch(`${window.API_BASE_URL}/api/social/change-theme`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseClone = response.clone();
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            const text = await responseClone.text();
            throw new Error(text || 'Resposta inválida do servidor.');
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || data.error || 'Erro ao trocar tema.');
        }

        const result = data.data || {};
        if (result.theme) temaInput.value = result.theme;
        if (result.structure || result.hook) {
            const roteiroFinal = result.hook
                ? `Hook: ${result.hook}\n\n${result.structure || ''}`.trim()
                : String(result.structure || '').trim();
            roteiroInput.value = roteiroFinal;
        }
        legendaInput.value = buildCaptionText(result.caption, result.cta, result.hashtags);
        legendaInput.classList.add('ring-2', 'ring-green-500');
        setTimeout(() => legendaInput.classList.remove('ring-2', 'ring-green-500'), 2000);
    } catch (err) {
        console.error('Erro ao trocar tema com IA:', err);
        alert('Não foi possível trocar o tema. Tente novamente.');
    } finally {
        setButtonLoading(btn, false);
    }
}

async function loadClientes() {
    const select = document.getElementById('select-cliente');
    if (!select) {
        console.warn('[SocialMedia] select-cliente não encontrado no DOM.');
        return;
    }

    // Retry se o Supabase não estiver pronto
    if (!window.supabaseClient) {
        console.warn('[SocialMedia] Supabase ainda não inicializado, tentando novamente em 500ms...');
        setTimeout(loadClientes, 500);
        return;
    }

    try {
        console.log('[SocialMedia] Iniciando carregamento de clientes...');

        // indicador visual
        if (select.options.length > 0 && select.options[0]) {
            select.options[0].text = 'Carregando...';
        }

        // Busca nome_fantasia e nome_empresa (fallback), pois ambientes podem ter schema diferente
        const { data, error } = await window.supabaseClient
            .from('clientes')
            .select('id, nome_fantasia, nome_empresa, plataformas_social')
            .order('nome_fantasia', { ascending: true });

        if (error) {
            console.error('[SocialMedia] Erro ao carregar clientes (Supabase):', error);
            throw error;
        }

        const rows = Array.isArray(data) ? data : [];
        const uniqueRows = Array.from(new Map(rows.map(c => [String(c.id), c])).values());

        console.log(`[SocialMedia] Clientes carregados: ${uniqueRows.length}`);

        // reset options
        select.innerHTML = '<option value="">Selecione o Cliente...</option>';

        clientDataMap = clientDataMap || {};
        uniqueRows.forEach(c => {
            clientDataMap[c.id] = c;

            const label =
                c.nome_fantasia ||
                c.nome_empresa ||
                `Cliente ${c.id}`;

            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = label;
            select.appendChild(opt);
        });

        if (uniqueRows.length === 0) {
            const opt = document.createElement('option');
            opt.disabled = true;
            opt.textContent = 'Nenhum cliente encontrado';
            select.appendChild(opt);
        }

    } catch (err) {
        console.error('[SocialMedia] Erro crítico ao carregar clientes:', err);
        select.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

window.__debugLoadClientes = loadClientes;

function checkSelection() {
    const btnConfig = document.getElementById('btn-config-ia');
    const btnApprove = document.getElementById('btn-approve');
    const btnApproveWeek = document.getElementById('btn-approve-week');
    const btnDelete = document.getElementById('btn-delete-calendar');

    if (currentClienteId && currentMonth) {
        if (btnConfig) btnConfig.disabled = false;
        loadCalendarData();
        updateCalendarConnections(currentClienteId);
        updateApprovalButtonsForView(calendar?.view?.type || '');
    } else {
        if (btnConfig) btnConfig.disabled = true;
        
        // Resetar botões se não houver seleção
        [btnApprove, btnApproveWeek, btnDelete].forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.className = 'flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm shadow-sm transition-all';
            }
        });

        if (calendar) calendar.removeAllEvents();
    }

    updateGenerateButtonState();
    ensureSocialMediaPermission().then(updateGenerateButtonState);
}

async function loadCalendarData() {
    if (!currentClienteId || !currentMonth) return;
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl || !calendar) {
        console.error('[generateCalendar] container não encontrado');
        return;
    }
    
    // Calcular corretamente o último dia do mês
    const [year, month] = currentMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate(); // dia 0 do próximo mês = último dia deste
    
    const startDate = `${currentMonth}-01`;
    const endDate = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;
    
    console.log(`Carregando posts de ${startDate} a ${endDate} para cliente ${currentClienteId}`);

    try {
        const { data, error } = await window.supabaseClient
            .from('social_posts')
            .select('*')
            .eq('cliente_id', parseInt(currentClienteId) || currentClienteId)
            .gte('data_agendada', startDate)
            .lte('data_agendada', endDate);
            
        if (error) throw error;

        console.log(`Posts carregados: ${data.length}`);
        socialPostsCache = Array.isArray(data) ? data : [];

        // Atualiza estado dos botões (Habilitar apenas se houver posts)
        const btnDelete = document.getElementById('btn-delete-calendar');
        const btnApprove = document.getElementById('btn-approve');
        const btnApproveWeek = document.getElementById('btn-approve-week');
        const hasPosts = data.length > 0;

        if (btnDelete) {
            btnDelete.disabled = !hasPosts;
            if (hasPosts) {
                // Habilitado (Vermelho/Alerta)
                btnDelete.className = 'flex items-center gap-2 px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-lg cursor-pointer hover:bg-red-50 font-medium text-sm shadow-sm transition-all';
            } else {
                // Desabilitado
                btnDelete.className = 'flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm shadow-sm transition-all';
            }
        }

        if (btnApprove) {
            btnApprove.disabled = !hasPosts;
            if (hasPosts) {
                // Habilitado (Verde)
                btnApprove.className = 'flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white border border-green-600 rounded-lg cursor-pointer hover:bg-green-600 font-medium text-sm shadow-md transition-all';
            } else {
                // Desabilitado
                btnApprove.className = 'flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm shadow-sm transition-all';
            }
        }

        if (btnApprove) {
            if (!hasPosts) {
                setApproveButtonLabel(btnApprove, 'Enviar calendário para aprovação');
                btnApprove.dataset.approvalSent = 'false';
            } else {
                const approvalStatus = await fetchApprovalBatchStatus(currentClienteId, currentMonth);
                if (approvalStatus?.status && approvalStatus.status !== CALENDAR_STATUS.DRAFT) {
                    setApproveButtonLabel(btnApprove, 'Reenviar calendário para aprovação');
                    btnApprove.dataset.approvalSent = 'true';
                    btnApprove.dataset.approvalStatus = approvalStatus.status;
                } else {
                    setApproveButtonLabel(btnApprove, 'Enviar calendário para aprovação');
                    btnApprove.dataset.approvalSent = 'false';
                    delete btnApprove.dataset.approvalStatus;
                }
            }
        }
        if (btnApproveWeek) {
            updateWeeklyApproveState();
        }

        const ready = await ensureCalendarRendered();
        if (!ready) {
            console.error('[generateCalendar] container não encontrado');
            return;
        }
        calendar.removeAllEvents();
        data.forEach(post => {
            calendar.addEvent({
                id: post.id,
                title: post.tema,
                start: post.data_agendada,
                extendedProps: post
            });
        });
    } catch (err) {
        console.error('Erro ao carregar posts:', err);
    }
}

function updateApprovalButtonsForView(viewType) {
    const btnApprove = document.getElementById('btn-approve');
    const btnApproveWeek = document.getElementById('btn-approve-week');
    if (!btnApprove || !btnApproveWeek) return;
    const isWeek = viewType === 'timeGridWeek';
    if (isWeek) {
        btnApprove.classList.add('hidden');
        btnApproveWeek.classList.remove('hidden');
    } else {
        btnApprove.classList.remove('hidden');
        btnApproveWeek.classList.add('hidden');
    }
    updateWeeklyApproveState();
}

function getCalendarWeekRange() {
    if (!calendar?.view?.currentStart || !calendar?.view?.currentEnd) return null;
    const start = new Date(calendar.view.currentStart);
    const end = new Date(calendar.view.currentEnd);
    end.setDate(end.getDate() - 1);
    return { start, end };
}

function toDateOnly(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.split('T')[0];
    return value.toISOString().split('T')[0];
}

function updateWeeklyApproveState() {
    const btnApproveWeek = document.getElementById('btn-approve-week');
    if (!btnApproveWeek) return;
    const range = getCalendarWeekRange();
    if (!currentClienteId || !range) {
        btnApproveWeek.disabled = true;
        btnApproveWeek.className = 'hidden flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm shadow-sm transition-all';
        return;
    }
    const start = toDateOnly(range.start);
    const end = toDateOnly(range.end);
    const hasPostsInWeek = socialPostsCache.some((post) => {
        const date = toDateOnly(post.data_agendada);
        return date >= start && date <= end;
    });
    btnApproveWeek.disabled = !hasPostsInWeek;
    if (hasPostsInWeek) {
        btnApproveWeek.className = 'flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white border border-green-600 rounded-lg cursor-pointer hover:bg-green-600 font-medium text-sm shadow-md transition-all';
    } else {
        btnApproveWeek.className = 'hidden flex items-center gap-2 px-4 py-2.5 bg-gray-100 border border-gray-200 text-gray-400 rounded-lg cursor-not-allowed font-medium text-sm shadow-sm transition-all';
    }
}

async function handleGenerateClick() {
    const hasPermission = await ensureSocialMediaPermission();
    if (!hasPermission) {
        alert('Voce nao tem permissao para gerar calendario.');
        return;
    }
    if (!currentClienteId) {
        alert('Por favor, selecione um cliente primeiro.');
        return;
    }

    const connections = calendarConnectionsCache[currentClienteId] || await window.getConnectedPlatforms(currentClienteId);
    calendarConnectionsCache[currentClienteId] = connections;
    const connectedPlatforms = (connections.connected || []).map(item => item.platform).filter(p => ['instagram', 'facebook', 'linkedin', 'tiktok'].includes(p));

    if (connectedPlatforms.length === 0) {
        const container = ensureCalendarCTAContainer();
        if (container) {
            container.innerHTML = window.renderPlatformNotConnectedCTA(currentClienteId, 'Instagram/Facebook/LinkedIn/TikTok');
            container.classList.remove('hidden');
        }
        return;
    }

    openGenerationConfigModal();
}

async function deleteCalendar() {
    if (!currentClienteId || !currentMonth) return;
    if (!confirm('Tem certeza que deseja excluir TODO o calendário deste mês?')) return;
    
    try {
        const [year, month] = currentMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const startDate = `${currentMonth}-01`;
        const endDate = `${currentMonth}-${String(lastDay).padStart(2, '0')}`;

        const { error } = await window.supabaseClient
            .from('social_posts')
            .delete()
            .eq('cliente_id', currentClienteId)
            .gte('data_agendada', startDate)
            .lte('data_agendada', endDate);
            
        if (error) throw error;
        calendar.removeAllEvents();
        alert('Calendário excluído com sucesso!');
        checkSelection();
    } catch (e) {
        alert('Erro ao excluir: ' + e.message);
    }
}

async function generateCalendar(config = {}) {
    if (!currentClienteId) {
        alert('Por favor, selecione um cliente primeiro.');
        return;
    }

    const client = clientDataMap[currentClienteId];
    if (!client) {
        console.error('Dados do cliente não encontrados no mapa.');
        alert('Erro ao identificar cliente. Tente recarregar a página.');
        return;
    }

    if (window.__calendarGenerationInProgress === true) {
        if (typeof appendGenerationLog === 'function') {
            appendGenerationLog('Já estou gerando...');
        } else {
            alert('Já estou gerando...');
        }
        return;
    }
    window.__calendarGenerationInProgress = true;
    window.__calendarGenerating = true;

    const generationButtons = [];
    const originalButtonTexts = new Map();
    let bannerEl = null;

    const ensureBannerStyle = () => {
        if (document.getElementById('calendar-generation-banner-style')) return;
        const style = document.createElement('style');
        style.id = 'calendar-generation-banner-style';
        style.textContent = `
.calendar-generation-spinner {
    width: 18px;
    height: 18px;
    border: 3px solid rgba(255, 255, 255, 0.35);
    border-top-color: #fff;
    border-radius: 999px;
    animation: calendarGenerationSpin 1s linear infinite;
}
@keyframes calendarGenerationSpin {
    to { transform: rotate(360deg); }
}
        `.trim();
        document.head.appendChild(style);
    };

    const showGenerationBanner = () => {
        ensureBannerStyle();
        const existing = document.getElementById('calendar-generation-banner');
        if (existing) existing.remove();
        bannerEl = document.createElement('div');
        bannerEl.id = 'calendar-generation-banner';
        bannerEl.style.position = 'fixed';
        bannerEl.style.top = '16px';
        bannerEl.style.right = '16px';
        bannerEl.style.zIndex = '90';
        bannerEl.style.background = '#111827';
        bannerEl.style.color = '#fff';
        bannerEl.style.padding = '12px 16px';
        bannerEl.style.borderRadius = '12px';
        bannerEl.style.boxShadow = '0 12px 24px rgba(0,0,0,0.2)';
        bannerEl.style.display = 'flex';
        bannerEl.style.alignItems = 'center';
        bannerEl.style.gap = '12px';
        bannerEl.innerHTML = `
            <div class="calendar-generation-spinner"></div>
            <div>
                <div style="font-weight:700;">Gerando calendário... não feche esta tela.</div>
                <div style="font-size:12px; opacity:0.85;">Isso pode levar alguns segundos.</div>
            </div>
        `;
        document.body.appendChild(bannerEl);
    };

    const disableGenerationButtons = () => {
        const selectors = ['#btn-modal-generate', '#btn-generate-calendar', '[data-action="generate-calendar"]', '#btn-generation-confirm', '#btn-header-generate'];
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((el) => {
                if (!generationButtons.includes(el)) {
                    generationButtons.push(el);
                }
            });
        });
        generationButtons.forEach((btn) => {
            originalButtonTexts.set(btn, btn.innerHTML);
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
        });
    };

    const restoreGenerationButtons = () => {
        generationButtons.forEach((btn) => {
            btn.disabled = false;
            const original = originalButtonTexts.get(btn);
            if (original !== undefined) {
                btn.innerHTML = original;
            }
        });
        originalButtonTexts.clear();
        generationButtons.length = 0;
    };

    const buildPayloadSummary = (payload) => {
        try {
            if (!payload || typeof payload !== 'object') return { type: typeof payload };
            const summary = { keys: Object.keys(payload) };
            Object.keys(payload).forEach((k) => {
                if (Array.isArray(payload[k])) summary[`${k}_length`] = payload[k].length;
            });
            if (payload?.choices?.[0]?.message?.content) {
                summary.content_length = String(payload.choices[0].message.content).length;
            }
            return summary;
        } catch {
            return { type: typeof payload };
        }
    };

    let requestId = null;
    let generationSucceeded = false;
    try {
        const connections = calendarConnectionsCache[currentClienteId] || await window.getConnectedPlatforms(currentClienteId);
        calendarConnectionsCache[currentClienteId] = connections;
        const platforms = (connections.connected || []).map(item => item.platform).filter(p => ['instagram', 'facebook', 'linkedin', 'tiktok'].includes(p));
        if (platforms.length === 0) {
            const container = ensureCalendarCTAContainer();
            if (container) {
                container.innerHTML = window.renderPlatformNotConnectedCTA(currentClienteId, 'Instagram/Facebook/LinkedIn/TikTok');
                container.classList.remove('hidden');
            }
            return;
        }

        disableGenerationButtons();
        showGenerationBanner();
        setGenerationLoading(true, 'Gerando seu calendário, aguarde...');

        requestId = generateRequestId();
        lastGenerationConfig = config;
        progressRequestId = requestId;
        let calendarId = null;
        const postsCount = Number.isFinite(config.postsCount) && config.postsCount > 0 ? config.postsCount : 12;
        const forceGeneration = Boolean(config.force);
        const seasonalDates = Array.isArray(config.seasonalDates) ? config.seasonalDates : [];
        lastSeasonalDates = seasonalDates;

        const contextLink = null;

        const apiEndpoint = `${window.API_BASE_URL}/api/openai/proxy`;
        const apiEndpointUrl = new URL(apiEndpoint).toString();
        console.log('[generateCalendar] endpoint', apiEndpoint, 'clientId', currentClienteId);
        console.log('[generateCalendar] request_id', requestId);
        appendGenerationLog(`request_id: ${requestId}`);
        let response;
        const calendarPrompt = `
Crie um calendário editorial para o cliente ${client.nome_empresa}.
Mês de referência: ${currentMonth}
Nicho: ${client.nicho_atuacao || 'Geral'}
Plataformas ativas: ${platforms.join(', ')}
Quantidade de posts: ${postsCount}
Datas sazonais (se houver): ${seasonalDates && seasonalDates.length ? JSON.stringify(seasonalDates) : 'nenhuma'}
Identidade visual (se houver): ${client.visual_identity || client.identidade_visual || 'não informada'}

Regras obrigatórias:
- Responda APENAS com JSON válido.
- Retorne um OBJETO no formato:
{
  "month": "${currentMonth}",
  "timezone": "America/Sao_Paulo",
  "posts": [
    {
      "date": "YYYY-MM-DD",
      "format": "estatico|carrossel|reels",
      "tema": "título curto",
      "conteudo_roteiro": "conteúdo/roteiro/slides detalhado",
      "descricao_visual": "descrição visual",
      "estrategia": "objetivo do post",
      "legenda_instagram": "legenda para Instagram/Facebook",
      "legenda_linkedin": "legenda para LinkedIn (se plataforma ativa)",
      "legenda_tiktok": "legenda para TikTok (se plataforma ativa)",
      "cta": "chamada para ação",
      "hashtags": ["#..."],
      "criativo": {}
    }
  ]
}
- Se a plataforma LinkedIn NÃO estiver ativa, deixe legenda_linkedin como "".
- Se a plataforma TikTok NÃO estiver ativa, deixe legenda_tiktok como "".
- Distribua os posts ao longo do mês, evitando concentrar todos na mesma semana.
- Mantenha consistência com um tom profissional e consultivo.
`;

        const messages = [
          { role: "system", content: "Você é um estrategista sênior de social media e copywriter. Retorne sempre JSON válido e completo, sem texto extra." },
          { role: "user", content: calendarPrompt }
        ];
        const requestPayload = {
            __legacy_calendar_mode: true,
            mode: 'calendar',
                model: 'gpt-4-turbo',
                temperature: 0.7,
                request_id: requestId,
                client_id: currentClienteId,
                client_name: client.nome_empresa,
                niche: client.nicho_atuacao || 'Geral',
                month: currentMonth,
                platforms,
                posts_count: postsCount,
                seasonal_dates: seasonalDates,
                context_link: contextLink,
                visual_identity: client.visual_identity || client.identidade_visual || null,
                force: forceGeneration,
                messages
            };
        console.debug('[generateCalendar] request', {
            url: apiEndpointUrl,
            method: 'POST',
            body: {
                request_id: requestId,
                client_id: currentClienteId,
                month: currentMonth,
                posts_count: postsCount,
                platforms,
                seasonal_dates_count: seasonalDates.length,
                force: forceGeneration,
                model: 'gpt-4-turbo'
            }
        });
        const headers = await getAuthHeaders();
        headers['x-request-id'] = requestId;
        response = await fetch(apiEndpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestPayload)
        });

        appendGenerationLog(`Resposta recebida: status ${response.status}`);
        if (response.ok) {
            appendGenerationLog('API OK (200)');
        }
        const responseClone = response.clone();
        let data;
        try {
            data = await response.json();
        } catch (jsonError) {
            const text = await responseClone.text();
            throw new Error(text || 'Resposta inválida do servidor.');
        }
        console.debug('[generateCalendar] response', {
            status: response.status,
            summary: buildPayloadSummary(data)
        });

        if (data?.partial === true) {
            const generated = Number(data?.generated || 0);
            const expected = Number(data?.expected || postsCount);
            const partialMessage = `Geramos ${generated} de ${expected}. Clique em "Tentar novamente" para completar.`;
            setGenerationLogMessage(partialMessage);
            setGenerationLoading(false);
            setRetryVisible(true, partialMessage, {
                label: 'Tentar novamente',
                onClick: () => {
                    setRetryVisible(false);
                    setGenerationLoading(true, 'Gerando seu calendário, aguarde...');
                    generateCalendar({ ...lastGenerationConfig, force: false });
                }
            });
            return;
        }

        if (data?.error === true) {
            const errorMessage = data?.message || 'Erro na comunicação com a OpenAI (Proxy)';
            setGenerationLogMessage(errorMessage);
            setGenerationLoading(false);
            setRetryVisible(true, errorMessage);
            return;
        }

        if (!response.ok || data?.ok === false) {
            const errorMessage = data?.message || data?.error || 'Erro na comunicação com a OpenAI (Proxy)';
            const errorRequestId = data?.request_id || requestId;
            console.error('[generateCalendar] request_id', errorRequestId);
            setGenerationLogMessage(errorMessage);
            setGenerationLoading(false);
            setRetryVisible(true, errorMessage);
            return;
        }

        if (data?.status === 'processing') {
            calendarId = data?.calendar_id || null;
            progressRequestId = data?.request_id || requestId;
            setGenerationStatusMessage('Geração iniciada no servidor.');
            if (calendarId) {
                startCalendarProgressPolling(calendarId);
            } else {
                setGenerationStatusMessage('Aguardando calendário do servidor...');
            }
            return;
        }
        if (data?.status === 'exists') {
            calendarId = data?.calendar_id || null;
            const existsMessage = data?.message || 'Já existe um calendário para este mês.';
            setGenerationLogMessage(existsMessage);
            setGenerationLoading(false);
            setRetryVisible(true, existsMessage, {
                label: 'Gerar novamente',
                onClick: () => {
                    setRetryVisible(false);
                    setGenerationLoading(true, 'Gerando seu calendário, aguarde...');
                    generateCalendar({ ...lastGenerationConfig, force: true });
                }
            });
            return;
        }

        let content = data.choices[0].message.content;

        let calendarPayload;
        try {
            calendarPayload = JSON.parse(content.replace(/```json/g, '').replace(/```/g, ''));
        } catch (e) {
            console.error('Erro JSON:', content);
            throw new Error('Erro ao processar resposta da IA. Formato inválido.');
        }

        if (Array.isArray(calendarPayload)) {
            calendarPayload = { month: currentMonth, timezone: 'America/Sao_Paulo', posts: calendarPayload };
        }

        if (!calendarPayload || !Array.isArray(calendarPayload.posts)) {
            throw new Error('A IA não retornou um calendário válido.');
        }

        const rawPosts = calendarPayload.posts;
        console.log('Posts recebidos da IA:', rawPosts.length);

        const generalMedias = [];

        const [year, month] = currentMonth.split('-').map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const usedDates = new Set();
        let fallbackCursor = 1;

        const normalizeFormat = (value) => {
            const raw = String(value || '').toLowerCase();
            if (raw.includes('reels')) return 'reels';
            if (raw.includes('carrossel')) return 'carrossel';
            if (raw.includes('estatic') || raw.includes('estático')) return 'estatico';
            return 'estatico';
        };

        const normalizeTime = (value) => {
            const raw = String(value || '').trim();
            if (/^\d{2}:\d{2}$/.test(raw)) return raw;
            if (/^\d{1}:\d{2}$/.test(raw)) return `0${raw}`;
            return '10:00';
        };

        const normalizeDate = (value) => {
            const raw = String(value || '').trim();
            if (!raw) return '';
            if (raw.includes('T')) {
                const [datePart] = raw.split('T');
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
                const [d, m, y] = raw.split('/').map(Number);
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
            if (/^\d{2}\/\d{2}$/.test(raw)) {
                const [d, m] = raw.split('/').map(Number);
                return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
            return '';
        };

        const nextAvailableDate = () => {
            while (fallbackCursor <= lastDay) {
                const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(fallbackCursor).padStart(2, '0')}`;
                fallbackCursor += 1;
                if (!usedDates.has(dateStr)) {
                    usedDates.add(dateStr);
                    return dateStr;
                }
            }
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            usedDates.add(dateStr);
            return dateStr;
        };

        const isDateInMonth = (dateStr) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
            const [y, m] = dateStr.split('-').map(Number);
            return y === year && m === month;
        };

        const clienteIdNum = Number(currentClienteId);
        const clienteIdValue = Number.isFinite(clienteIdNum) ? clienteIdNum : currentClienteId;

        const postsToInsert = [];
        rawPosts.forEach((post, index) => {
            const rawDate = post.scheduled_date || post.data_agendada || post.data || post.date || '';
            const rawTime = post.scheduled_time || post.hora_agendada || post.horario || '';
            let scheduledDate = normalizeDate(rawDate);
            let scheduledTime = normalizeTime(rawTime);
            let corrected = false;

            if (!isDateInMonth(scheduledDate) || usedDates.has(scheduledDate)) {
                scheduledDate = nextAvailableDate();
                corrected = true;
            } else {
                usedDates.add(scheduledDate);
            }

            if (scheduledTime === '10:00' && String(rawTime || '').trim() === '') {
                corrected = true;
            }

            const dataAgendada = `${scheduledDate}T${scheduledTime}:00`;
            if (!scheduledDate || !scheduledTime) {
                console.log('Post removido por data inválida:', index);
                return;
            }

            if (corrected) {
                console.log('Post corrigido por fallback:', index, dataAgendada);
            }

            const captionBase = post.legenda_instagram || post.caption || post.legenda || post.legenda_sugestao || '';
            const cta = post.cta || '';
            const hashtags = Array.isArray(post.hashtags) ? post.hashtags.filter(Boolean) : [];
            const hashtagsText = hashtags.length
                ? hashtags.map(tag => (String(tag).startsWith('#') ? tag : `#${tag}`)).join(' ')
                : '';
            const legendaParts = [captionBase, cta ? `\n\n${cta}` : '', hashtagsText ? `\n\n${hashtagsText}` : ''];
            const legendaFinal = legendaParts.join('').trim();

            const estrategiaParts = [post.pillar || '', post.objective || '', post.week || ''].filter(Boolean);

            postsToInsert.push({
                cliente_id: clienteIdValue,
                calendar_id: calendar.id,
                data_agendada: dataAgendada,
                hora_agendada: scheduledTime,
                formato: normalizeFormat(post.format || post.formato),
                tema: post.tema || post.theme || 'Sem título',
                conteudo_roteiro: post.structure || post.conteudo_roteiro || '',
                detailed_content: post.detailed_content || post.structure || post.conteudo_roteiro || '',
                descricao_visual: post.descricao_visual || '',
                creative_suggestion: post.creative_suggestion || post.creative_guide?.conceito_visual || post.descricao_visual || '',
                creative_guide: post.creative_guide || post.criativo || null,
                estrategia: estrategiaParts.join(' | '),
                legenda: legendaFinal,
                legenda_linkedin: post.legenda_linkedin || null,
                legenda_tiktok: post.legenda_tiktok || null,
                status: POST_STATUS.DRAFT,
                medias: generalMedias
            });
        });

        console.log('Posts válidos para insert:', postsToInsert.length);
        appendGenerationLog('Salvando posts...');
        console.debug('[generateCalendar] preparing_insert', { count: postsToInsert.length });
        if (postsToInsert.length === 0) {
            throw new Error('Nenhum post válido para inserir.');
        }

        // Warmup do cache antes do insert
        try {
            await window.supabaseClient.from('social_posts').select('id').limit(1);
        } catch (ignore) {}

        appendGenerationLog('Salvando posts no banco...');
        const { error } = await window.supabaseClient
            .from('social_posts')
            .insert(postsToInsert)
            .select();

        if (error) {
            console.error('Erro Supabase Insert:', error);
            console.debug('[generateCalendar] insert_error', { message: error?.message || String(error) });
            if (error.message && (error.message.includes('schema cache') || error.message.includes('Could not find'))) {
                 console.warn('Erro de Schema Cache. Limpando e tentando reload...');
                 Object.keys(localStorage).forEach(key => {
                    if (key.includes('supabase.auth.token')) return;
                    if (key.includes('supabase')) localStorage.removeItem(key);
                 });
                 throw new Error('Erro de sincronização. Por favor, tente novamente (cache limpo).');
            }
            throw error;
        }
        appendGenerationLog('Posts salvos');
        console.debug('[generateCalendar] insert_ok', { count: postsToInsert.length });

        const calendarContainer = document.getElementById('calendar');
        if (!calendarContainer) {
            console.error('[generateCalendar] container não encontrado');
        }
        setGenerationLogMessage('Calendário gerado. Atualizando...');
        try {
            await loadCalendarData();
            const updated = await waitForCalendarUpdate({ timeoutMs: 10000 });
            if (updated) {
                generationSucceeded = true;
                window.closeGenerationModal();
                hideGenerationLog();
            } else {
                const message = 'Calendário ainda não apareceu. Clique em "Tentar novamente" para atualizar.';
                setGenerationStatusMessage(message);
                setRetryVisible(true, message);
            }
        } catch (error) {
            const message = 'Erro ao atualizar calendário. Clique em "Tentar novamente".';
            setGenerationStatusMessage(message);
            setRetryVisible(true, message);
        } finally {
            setGenerationLoading(false);
        }

        } catch (err) {
        console.error('Erro Geral:', err);
        const errorMessage = err?.message || String(err);
        const isNetworkFailure = err?.name === 'AbortError' || errorMessage.includes('Failed to fetch');
        if (isNetworkFailure) {
            const networkMessage = 'Falha de rede. Clique em "Tentar novamente".';
            setGenerationLogMessage(networkMessage);
            setGenerationLoading(false);
            setRetryVisible(true, networkMessage);
        } else {
            const friendlyMessage = errorMessage || 'Erro ao gerar calendário. Clique em "Tentar novamente".';
            setGenerationLogMessage(friendlyMessage);
            setGenerationLoading(false);
            setRetryVisible(true, friendlyMessage);
        }
    } finally {
        if (bannerEl) bannerEl.remove();
        restoreGenerationButtons();
        window.__calendarGenerating = false;
        window.__calendarGenerationInProgress = false;
        updateRetryButtonState();
        if (generationSucceeded) {
            stopCalendarProgressPolling();
        }
    }
}

// New functions
window.openFormatModal = function(dateStr) {
    if (!currentClienteId) { alert('Selecione um cliente!'); return; }
    tempSelectedDate = dateStr;
    const modal = document.getElementById('modal-select-format');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const content = modal.firstElementChild;
            if (content) content.classList.remove('scale-95');
        }, 10);
    }
}

window.selectFormat = function(format) {
    tempSelectedFormat = format;
    closeModalAnim('modal-select-format');
    setTimeout(() => {
        const modal = document.getElementById('modal-select-mode');
        if (modal) {
             modal.classList.remove('hidden');
             modal.classList.add('flex');
             setTimeout(() => {
                 modal.classList.remove('opacity-0');
                 const content = modal.firstElementChild;
                 if (content) content.classList.remove('scale-95');
             }, 10);
        }
    }, 300);
}

window.handleManualCreation = function() {
    closeModalAnim('modal-select-mode');
    setTimeout(() => {
        const fakeEvent = {
            id: '',
            title: '',
            startStr: tempSelectedDate,
            extendedProps: { formato: tempSelectedFormat, status: POST_STATUS.DRAFT }
        };
        openPostModal(fakeEvent);
    }, 300);
}

window.handleAICreation = function() {
    closeModalAnim('modal-select-mode');
    generateSinglePostAI(tempSelectedDate, tempSelectedFormat);
}

async function generateSinglePostAI(date, format) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'ai-loading-overlay';
    loadingDiv.className = 'fixed inset-0 bg-gray-900/80 z-[70] flex flex-col items-center justify-center text-white backdrop-blur-sm';
    loadingDiv.innerHTML = `
        <div class="relative w-24 h-24 mb-6">
             <div class="absolute top-0 left-0 w-full h-full border-4 border-gray-600 rounded-full"></div>
             <div class="absolute top-0 left-0 w-full h-full border-4 border-t-purple-500 rounded-full animate-spin"></div>
             <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-2xl">
                 <i class="fas fa-magic text-purple-400"></i>
             </div>
        </div>
        <h3 class="text-xl font-bold mb-2">Criando seu post com IA...</h3>
        <p class="text-sm opacity-70">Analisando tendências e criando conteúdo incrível para ${format}</p>
    `;
    document.body.appendChild(loadingDiv);

    try {
        const toIsoDate = (value) => {
            if (value instanceof Date && !Number.isNaN(value.getTime())) {
                return value.toISOString().slice(0, 10);
            }
            const raw = String(value || '').trim();
            if (!raw) return '';
            if (raw.includes('T')) {
                const [datePart] = raw.split('T');
                if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
                const [d, m, y] = raw.split('/').map(Number);
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
            if (/^\d{2}\/\d{2}$/.test(raw) && typeof currentMonth === 'string') {
                const [d, m] = raw.split('/').map(Number);
                if (/^\d{4}-\d{2}$/.test(currentMonth)) {
                    const [y] = currentMonth.split('-').map(Number);
                    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                }
            }
            return '';
        };

        const resolveFallbackDate = () => {
            if (typeof currentMonth === 'string' && /^\d{4}-\d{2}$/.test(currentMonth)) {
                return `${currentMonth}-01`;
            }
            return new Date().toISOString().slice(0, 10);
        };

        const scheduledDate = toIsoDate(date) || resolveFallbackDate();
        // VIBECODE: Removido fetch de API Key do Frontend.
        // const { data: configData } = await window.supabaseClient...
        
        // if (!configData || !configData.value) throw new Error('Chave OpenAI não configurada.');
        // const apiKey = configData.value;

        const client = clientDataMap[currentClienteId];
        if (!client) throw new Error('Cliente não encontrado');

        const prompt = `
        Crie UM post para redes sociais para o cliente: ${client.nome_empresa}.
        Data: ${scheduledDate}
        Formato: ${format}
        Nicho: ${client.nicho_atuacao || 'Geral'}
        
        Gere um objeto JSON com a seguinte estrutura:
        {
            "tema": "Título curto e chamativo",
            "conteudo_roteiro": "Texto do post, roteiro do vídeo ou slides do carrossel. Detalhado.",
            "descricao_visual": "Descrição da imagem ou cena do vídeo.",
            "estrategia": "Qual o objetivo deste post (Engajamento, Venda, Autoridade).",
            "legenda_instagram": "Legenda principal (Instagram/Facebook). ESTILO BÚSSOLA CRIATIVOS: Densa, Persuasiva, Storytelling, AIDA.",
            "legenda_linkedin": "Legenda adaptada para LinkedIn (opcional, preencha se fizer sentido para o nicho).",
            "legenda_tiktok": "Legenda adaptada para TikTok (opcional, preencha se for vídeo).",
            "cta": "Chamada para ação objetiva",
            "hashtags": ["#tag1", "#tag2"],
            "criativo": {}
        }

        FORMATO DO CRIATIVO:
        - Se format = Estático:
          "criativo": {
            "tipo": "Estático",
            "conceito_visual": "",
            "composicao": "",
            "texto_na_arte": "",
            "banco_imagens_sugerido": "",
            "checklist_designer": ["..."]
          }
        - Se format = Carrossel:
          "criativo": {
            "tipo": "Carrossel",
            "slides": [
              { "titulo_do_slide": "", "copy": "", "visual_sugerido": "" }
            ]
          }
        - Se format = Reels:
          "criativo": {
            "tipo": "Reels",
            "roteiro": { "gancho": "", "desenvolvimento": "", "encerramento": "" },
            "cenas_sugeridas": ["..."],
            "sugestoes_captacao": ["..."]
          }
        
        DIRETRIZES DE COPYWRITING (MODELO BÚSSOLA CRIATIVOS):
        1. HOOK (Gancho): Comece com uma frase impactante, curiosa ou contra-intuitiva.
        2. CORPO: Desenvolva o conteúdo com profundidade. Use parágrafos curtos para facilitar a leitura.
        3. EMOJIS: Use emojis para pontuar e dar ritmo (sem exageros).
        4. CTA: Termine sempre com uma Chamada para Ação clara.
        5. TOM: Especialista, porém próximo e autêntico.
        
        Responda APENAS o JSON.
        `;

        // VIBECODE: Usando Proxy Backend
        const headers = await getAuthHeaders();
        const response = await fetch(`${window.API_BASE_URL}/api/openai/proxy`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: "gpt-4-turbo",
                messages: [
                    { role: "system", content: "Você é um Copywriter de Elite (Estilo Bússola Criativos). Retorne sempre JSON válido." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
             const errData = await response.json();
             throw new Error(errData.error || 'Erro na OpenAI (Proxy)');
        }
        
        const data = await response.json();
        const content = data.choices[0].message.content;
        
        let jsonContent;
        try {
            jsonContent = JSON.parse(content.replace(/```json/g, '').replace(/```/g, ''));
        } catch (e) {
            console.error('Erro ao parsear JSON da IA', content);
            throw new Error('A IA não retornou um formato válido. Tente novamente.');
        }

        let finalClienteId = currentClienteId;
        // Validação robusta de ID
        if (currentClienteId && !isNaN(currentClienteId) && !currentClienteId.toString().includes('-')) {
            finalClienteId = parseInt(currentClienteId);
        }

        const newPost = {
            cliente_id: finalClienteId,
            data_agendada: scheduledDate,
            hora_agendada: '10:00',
            formato: format || 'post',
            tema: jsonContent.tema || 'Sem título',
            conteudo_roteiro: jsonContent.conteudo_roteiro || '',
            detailed_content: jsonContent.detailed_content || jsonContent.conteudo_roteiro || '',
            descricao_visual: jsonContent.descricao_visual || '',
            creative_suggestion: jsonContent.creative_suggestion || jsonContent.descricao_visual || '',
            estrategia: jsonContent.estrategia || '',
            legenda: jsonContent.legenda_instagram || jsonContent.legenda_sugestao || '',
            legenda_linkedin: jsonContent.legenda_linkedin || null,
            legenda_tiktok: jsonContent.legenda_tiktok || null,
            creative_guide: jsonContent.criativo || jsonContent.creative_guide || null,
            status: POST_STATUS.DRAFT
        };

        console.log('Enviando post para Supabase:', newPost);
        
        // Tenta "acordar" o schema cache com um select simples antes do insert
        try {
            await window.supabaseClient.from('social_posts').select('id').limit(1);
        } catch (ignore) { console.warn('Cache warmup falhou, prosseguindo...'); }

        const { error: insertError } = await window.supabaseClient
            .from('social_posts')
            .insert([newPost])
            .select();

        if (insertError) {
             console.error('Erro detalhado Supabase:', insertError);
             if (insertError.message && (insertError.message.includes('schema cache') || insertError.message.includes('Could not find'))) {
                  console.warn('Erro de Schema Cache confirmado. Tentando reload forçado...');
                  // Limpa localStorage de cache do supabase se existir (hack)
                  Object.keys(localStorage).forEach(key => {
                      if (key.includes('supabase.auth.token')) return; // Mantém auth
                      if (key.includes('supabase')) localStorage.removeItem(key);
                  });
                  throw new Error('Erro de sincronização com o banco de dados. O sistema tentou corrigir automaticamente. Por favor, tente clicar em "Criar com IA" novamente.');
             }
             throw insertError;
        }

        await loadCalendarData();
        
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-5 right-5 bg-green-500 text-white px-6 py-4 rounded-xl shadow-2xl z-[80] animate-bounce-in flex items-center gap-3';
        successDiv.innerHTML = '<i class="fas fa-check-circle text-2xl"></i><div><h4 class="font-bold">Sucesso!</h4><p class="text-sm">Post criado com IA.</p></div>';
        document.body.appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 3000);

    } catch (err) {
        console.error('Erro ao gerar post:', err);
        alert('Erro ao gerar post com IA: ' + err.message);
    } finally {
        loadingDiv.remove();
    }
}
})();
