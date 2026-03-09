// js/v2/modules/social_media/social_media_ui.js
// Interface de Usuário do Módulo Social Media V2
// Adaptado para o layout de Drawer e Grid do index.html

(function(global) {
    const SocialMediaUI = {
        drawerId: 'social-post-drawer',
        
        init: function() {
            // Setup de listeners de UI (fechar drawer, tabs)
            this.setupDrawer();
            this.setupTabs();
        },

        setupDrawer: function() {
            const closeBtn = document.getElementById('social-post-close');
            const cancelBtn = document.getElementById('social-post-cancel');
            const drawer = document.getElementById(this.drawerId);

            const closeHandler = () => {
                drawer.classList.add('hidden');
                drawer.classList.remove('flex');
            };

            if (closeBtn) closeBtn.addEventListener('click', closeHandler);
            if (cancelBtn) cancelBtn.addEventListener('click', closeHandler);
        },

        setupTabs: function() {
            const tabs = document.querySelectorAll('.social-tab-btn');
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    // Remove active state
                    tabs.forEach(t => {
                        t.classList.remove('bg-slate-900', 'text-white');
                        t.classList.add('text-slate-600', 'hover:text-slate-800', 'border', 'border-slate-200');
                    });
                    
                    // Add active state
                    tab.classList.remove('text-slate-600', 'hover:text-slate-800', 'border', 'border-slate-200');
                    tab.classList.add('bg-slate-900', 'text-white');

                    // Show content
                    const targetId = `social-tab-${tab.dataset.socialTab}`;
                    document.querySelectorAll('.social-tab').forEach(c => c.classList.add('hidden'));
                    const target = document.getElementById(targetId);
                    if (target) target.classList.remove('hidden');
                });
            });
        },

        closeDrawer: function() {
            const drawer = document.getElementById(this.drawerId);
            if (drawer) {
                drawer.classList.add('hidden');
                drawer.classList.remove('flex');
            }
        },

        /**
         * Abre o drawer preenchido para criar ou editar
         * @param {Object} post - Dados do post (opcional)
         */
        renderCreateForm: function(post = null) {
            const drawer = document.getElementById(this.drawerId);
            if (!drawer) return;

            const isEdit = !!(post && post.id);
            drawer.dataset.mode = isEdit ? 'edit' : 'create';
            drawer.dataset.postId = isEdit ? post.id : '';

            // Título do Drawer
            const titleEl = document.getElementById('social-post-title');
            if (titleEl) titleEl.textContent = isEdit ? 'Editar Post' : 'Novo Post';

            // Preencher campos
            this.setFieldValue('social-post-title-input', post?.titulo || post?.tema || ''); // DB field: legenda/tema
            this.setFieldValue('social-post-caption-full', post?.legenda || post?.conteudo || ''); // DB field: detailed_content
            this.setFieldValue('social-post-date', post?.data_agendada?.split('T')[0] || post?.data_postagem?.split('T')[0] || '');
            this.setFieldValue('social-post-cta', post?.cta || '');
            this.setFieldValue('social-post-hashtags', post?.hashtags || '');
            this.setFieldValue('social-post-status', post?.status || 'rascunho');
            
            // Plataforma/Canal (assumindo array ou booleans)
            let platform = 'instagram';
            if (post) {
                if (post.plataformas && post.plataformas[0]) platform = post.plataformas[0];
                else if (post.facebook) platform = 'facebook';
                else if (post.linkedin) platform = 'linkedin';
                else if (post.tiktok) platform = 'tiktok';
            }
            this.setFieldValue('social-post-channel', platform);

            // Mídia preview
            const imgPreview = document.getElementById('social-post-media-image');
            const videoPreview = document.getElementById('social-post-media-video');
            const mediaContainer = document.getElementById('social-post-media-preview');
            
            if (post?.imagem_url) {
                if (mediaContainer) mediaContainer.classList.remove('hidden');
                // Detectar se é vídeo (extensão básica)
                if (post.imagem_url.match(/\.(mp4|webm)$/i)) {
                    if (videoPreview) {
                        videoPreview.src = post.imagem_url;
                        videoPreview.classList.remove('hidden');
                        if (imgPreview) imgPreview.classList.add('hidden');
                    }
                } else {
                    if (imgPreview) {
                        imgPreview.src = post.imagem_url;
                        imgPreview.classList.remove('hidden');
                        if (videoPreview) videoPreview.classList.add('hidden');
                    }
                }
            } else {
                if (mediaContainer) mediaContainer.classList.add('hidden');
            }

            // Exibir drawer
            drawer.classList.remove('hidden');
            drawer.classList.add('flex');
        },

        setFieldValue: function(id, value) {
            const el = document.getElementById(id);
            if (el) el.value = value;
        },

        getFormData: function() {
            return {
                titulo: document.getElementById('social-post-title-input')?.value,
                legenda: document.getElementById('social-post-caption-full')?.value, // Mapping UI 'legenda' to DB 'detailed_content' usually, but here keeping consistent with repo expectation
                data_postagem: document.getElementById('social-post-date')?.value,
                cta: document.getElementById('social-post-cta')?.value,
                hashtags: document.getElementById('social-post-hashtags')?.value,
                status: document.getElementById('social-post-status')?.value,
                plataforma: document.getElementById('social-post-channel')?.value
            };
        },

        showLoading: function() {
            // Pode adicionar um overlay ou spinner no grid
            const grid = document.getElementById('social-calendar-grid');
            if (grid) grid.style.opacity = '0.5';
        },

        hideLoading: function() {
            const grid = document.getElementById('social-calendar-grid');
            if (grid) grid.style.opacity = '1';
        },

        showFeedback: function(msg, type) {
            // Implementar toast simples ou usar alert por enquanto
            // O index.html tem <div id="social-feedback">
            const el = document.getElementById('social-feedback');
            if (el) {
                el.textContent = msg;
                el.className = `text-sm rounded-lg px-3 py-2 ${type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
                el.classList.remove('hidden');
                setTimeout(() => el.classList.add('hidden'), 3000);
            } else {
                alert(msg);
            }
        },

        showEmptyState: function() {
            // Ocultar conteúdo, mostrar empty state
            const content = document.getElementById('social-content');
            const empty = document.getElementById('empty-social');
            
            if (content) content.classList.add('hidden');
            if (empty) empty.classList.remove('hidden');
        },
        
        showContent: function() {
             const content = document.getElementById('social-content');
             const empty = document.getElementById('empty-social');
             
             if (content) content.classList.remove('hidden');
             if (empty) empty.classList.add('hidden');
        }
    };

    global.SocialMediaUI = SocialMediaUI;
    
    // Auto-init
    document.addEventListener('DOMContentLoaded', () => SocialMediaUI.init());

})(window);
