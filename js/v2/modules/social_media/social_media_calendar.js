// js/v2/modules/social_media/social_media_calendar.js
// Módulo de Calendário do Social Media V2
// Responsável por renderizar a grid mensal e gerenciar Drag-and-Drop

(function(global) {
    const SocialMediaCalendar = {
        currentMonth: new Date(),
        currentMonthKey: '',
        posts: [],
        containerId: 'social-calendar-grid',

        init: function() {
            // Setup de listeners globais se necessário
            this.setupDragAndDrop();
        },

        /**
         * Renderiza o calendário para o mês e posts fornecidos
         * @param {Array} posts - Lista de posts normalizados
         * @param {Date} date - Data de referência do mês
         */
        render: function(posts, date) {
            this.posts = posts || [];
            this.currentMonth = date || new Date();
            
            const container = document.getElementById(this.containerId);
            if (!container) return;

            container.innerHTML = '';
            
            // Cálculos de datas
            const year = this.currentMonth.getFullYear();
            const month = this.currentMonth.getMonth();
            
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            
            const daysInMonth = lastDay.getDate();
            const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Ajuste para Seg=0 ou Dom=0 conforme layout (Index tem Seg como primeiro)
            
            // Index.html layout: Seg Ter Qua Qui Sex Sáb Dom
            // JS getDay(): 0=Dom, 1=Seg, ... 6=Sab
            // Ajustando para 0=Seg, ... 6=Dom
            let startOffset = firstDay.getDay() - 1;
            if (startOffset < 0) startOffset = 6; // Domingo vira 6

            // Preenchimento dias vazios antes do início
            for (let i = 0; i < startOffset; i++) {
                const emptyCell = document.createElement('div');
                emptyCell.className = 'h-32 bg-gray-50/50 rounded-lg border border-transparent';
                container.appendChild(emptyCell);
            }

            // Dias do mês
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const todayStr = global.CalendarStateSelectors?.getTodayLocalDate ? global.CalendarStateSelectors.getTodayLocalDate() : '';
                const isToday = todayStr === dateStr;
                
                const cell = document.createElement('div');
                cell.className = `h-32 bg-white rounded-lg border ${isToday ? 'border-purple-300 ring-1 ring-purple-100' : 'border-slate-200'} p-2 flex flex-col relative group transition-colors hover:border-purple-200`;
                cell.dataset.date = dateStr;
                
                // Header do dia
                cell.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-xs font-semibold ${isToday ? 'text-purple-600 bg-purple-50 px-1.5 rounded' : 'text-slate-400'}">${day}</span>
                        <button class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-purple-600 transition-opacity" onclick="document.dispatchEvent(new CustomEvent('v2:calendar-item-add', { detail: { date: '${dateStr}' } }))">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                    </div>
                    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-1 drop-zone" data-date="${dateStr}">
                        <!-- Posts aqui -->
                    </div>
                `;

                // Adicionar posts do dia
                const daysPosts = this.posts.filter(p => {
                    const pDate = p.data_agendada ? p.data_agendada.slice(0, 10) : '';
                    return pDate === dateStr;
                });

                const postsContainer = cell.querySelector('.drop-zone');
                daysPosts.forEach(post => {
                    const postCard = this.createPostCard(post);
                    postsContainer.appendChild(postCard);
                });

                container.appendChild(cell);
            }

            this.updateMonthLabel();
        },

        renderFromState: function(state) {
            const monthStart = state?.monthStart instanceof Date ? state.monthStart : new Date();
            const monthKey = String(state?.monthKey || '').trim();
            this.currentMonthKey = monthKey;
            const items = Array.isArray(state?.editorialItems) ? state.editorialItems : [];

            const mappedItems = items.map((it) => ({
                id: `item_${String(it?.id || Math.random()).replace(/[^\w-]/g, '')}`,
                __fromCalendarItem: true,
                calendar_item_id: it?.id || null,
                data_agendada: String(it?.data || it?.data_agendada || it?.post_date || it?.data_sugerida || '').slice(0, 10),
                tema: it?.tema || it?.titulo || it?.title || 'Item do calendário',
                formato: it?.tipo_conteudo || it?.formato || it?.content_type || 'post_estatico',
                plataforma: it?.canal || it?.plataforma || it?.platform || 'instagram',
                status: it?.status || 'draft'
            })).filter((p) => !!p.data_agendada);

            const renderList = mappedItems;
            this.render(renderList, monthStart);
        },

        createPostCard: function(post) {
            const el = document.createElement('div');
            const isCalendarItem = !!post?.__fromCalendarItem;
            el.draggable = !isCalendarItem;
            el.className = 'text-xs p-2 rounded-xl border border-slate-200 bg-white hover:shadow-sm hover:border-slate-300 cursor-grab active:cursor-grabbing transition-all select-none group/card relative min-h-[72px] flex flex-col justify-between';
            el.dataset.postId = post.id;
            
            const formatRaw = String(post.formato || post.content_type || post.tipo || '').toLowerCase();
            const typeBorder = (() => {
                if (formatRaw.includes('carrossel')) return 'border-l-4 border-l-violet-500';
                if (formatRaw.includes('reels') || formatRaw.includes('video') || formatRaw.includes('vídeo')) return 'border-l-4 border-l-pink-500';
                if (formatRaw.includes('story') || formatRaw.includes('stories')) return 'border-l-4 border-l-orange-500';
                return 'border-l-4 border-l-sky-500';
            })();
            el.classList.add(...typeBorder.split(' '));

            const statusLabel = global.GQV_CONSTANTS?.getSocialStatusLabelPt
                ? global.GQV_CONSTANTS.getSocialStatusLabelPt(post.status)
                : (String(post.status || '').trim() || '-');
            const statusPill = (() => {
                const key = global.GQV_CONSTANTS?.getSocialStatusKey
                    ? global.GQV_CONSTANTS.getSocialStatusKey(post.status)
                    : String(post.status || '').trim().toLowerCase();
                const map = {
                    draft: 'bg-slate-100 text-slate-600',
                    ready_for_review: 'bg-indigo-100 text-indigo-700',
                    in_production: 'bg-indigo-100 text-indigo-700',
                    ready_for_approval: 'bg-amber-100 text-amber-700',
                    awaiting_approval: 'bg-amber-100 text-amber-700',
                    approved: 'bg-emerald-100 text-emerald-700',
                    scheduled: 'bg-emerald-100 text-emerald-700',
                    changes_requested: 'bg-rose-100 text-rose-700',
                    published: 'bg-emerald-100 text-emerald-700',
                    archived: 'bg-slate-200 text-slate-700',
                    rascunho: 'bg-slate-100 text-slate-600',
                    pendente_aprovacao: 'bg-amber-100 text-amber-700',
                    aprovado: 'bg-emerald-100 text-emerald-700',
                    ajuste_solicitado: 'bg-rose-100 text-rose-700'
                };
                return map[key] || 'bg-slate-100 text-slate-600';
            })();
            const title = post.tema || post.titulo || post.title || post.legenda || 'Sem título';
            const channel = String(post.plataforma || post.platform || post.canal || post.channel || '').trim() || (post.instagram ? 'instagram' : (post.facebook ? 'facebook' : (post.linkedin ? 'linkedin' : (post.tiktok ? 'tiktok' : '-'))));
            const statusElId = `status_${post.id || Math.random().toString(16).slice(2)}`;
            
            el.innerHTML = `
                <div class="min-w-0">
                    <p class="text-xs font-semibold text-slate-800" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${title}</p>
                </div>
                <div class="mt-2 flex items-center justify-between gap-2">
                    <span class="text-[10px] text-slate-500 truncate">${channel}</span>
                    <span id="${statusElId}" class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusPill}">${statusLabel}</span>
                </div>
            `;

            // Eventos de Drag
            if (!isCalendarItem) {
                el.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', post.id);
                    e.dataTransfer.effectAllowed = 'move';
                    el.classList.add('opacity-50');
                });
            }

            el.addEventListener('dragend', (e) => {
                el.classList.remove('opacity-50');
            });
            
            const openEditor = () => {
                if (isCalendarItem) {
                    document.dispatchEvent(new CustomEvent('v2:calendar-item-click', { detail: { itemId: post.calendar_item_id, date: post.data_agendada } }));
                    return;
                }
                document.dispatchEvent(new CustomEvent('v2:post-click', { detail: { post } }));
            };
            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar disparar o clique do dia (add post)
                const actionEl = e.target?.closest?.('[data-action]');
                if (actionEl) return;
                openEditor();
            });

            if (!isCalendarItem) {
                const actionWrap = document.createElement('div');
                actionWrap.className = 'absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity';
                actionWrap.innerHTML = `
                    <button type="button" data-action="edit" class="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300" draggable="false">
                        <i class="fas fa-pen text-[10px]"></i>
                    </button>
                    <button type="button" data-action="duplicate" class="h-7 w-7 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300" draggable="false">
                        <i class="far fa-copy text-[10px]"></i>
                    </button>
                `;
                el.prepend(actionWrap);

                const editBtn = el.querySelector('[data-action="edit"]');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditor();
                    });
                }
                const duplicateBtn = el.querySelector('[data-action="duplicate"]');
                if (duplicateBtn) {
                    duplicateBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const duplicated = { ...post, status: 'draft' };
                        delete duplicated.id;
                        delete duplicated.post_id;
                        if (global.SocialMediaUI?.renderCreateForm) {
                            global.SocialMediaUI.renderCreateForm(duplicated);
                        } else {
                            document.dispatchEvent(new CustomEvent('v2:post-click', { detail: { post: duplicated } }));
                        }
                    });
                }
            }

            return el;
        },

        getPlatformIcon: function(post) {
            // Lógica simples para ícone, pode ser expandida
            if (post.instagram) return '<i class="fab fa-instagram text-pink-600"></i>';
            if (post.linkedin) return '<i class="fab fa-linkedin text-blue-700"></i>';
            if (post.facebook) return '<i class="fab fa-facebook text-blue-600"></i>';
            if (post.tiktok) return '<i class="fab fa-tiktok text-black"></i>';
            return '<i class="fas fa-hashtag text-slate-400"></i>';
        },

        setupDragAndDrop: function() {
            const container = document.getElementById(this.containerId);
            if (!container) return;

            // Delegação de eventos para drop zones (dias)
            container.addEventListener('dragover', (e) => {
                e.preventDefault(); // Permitir drop
                const dropZone = e.target.closest('.drop-zone');
                if (dropZone) {
                    e.dataTransfer.dropEffect = 'move';
                    dropZone.parentElement.classList.add('bg-purple-50');
                }
            });

            container.addEventListener('dragleave', (e) => {
                const dropZone = e.target.closest('.drop-zone');
                if (dropZone) {
                    dropZone.parentElement.classList.remove('bg-purple-50');
                }
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                const dropZone = e.target.closest('.drop-zone');
                if (dropZone) {
                    dropZone.parentElement.classList.remove('bg-purple-50');
                    const postId = e.dataTransfer.getData('text/plain');
                    const newDate = dropZone.dataset.date;
                    
                    if (postId && newDate) {
                        // Disparar evento para o Core tratar a persistência
                        document.dispatchEvent(new CustomEvent('v2:post-drop', { 
                            detail: { postId, newDate } 
                        }));
                    }
                }
            });
        },

        updateMonthLabel: function() {
            const label = document.getElementById('social-month-label');
            if (label) {
                const monthKey = String(this.currentMonthKey || '').trim();
                const formatted = global.CalendarStateSelectors?.formatMonthLabel
                    ? global.CalendarStateSelectors.formatMonthLabel(monthKey)
                    : '';
                if (formatted) {
                    label.textContent = formatted;
                    return;
                }
                const monthName = this.currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                label.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            }
        }
    };

    global.SocialMediaCalendar = SocialMediaCalendar;

})(window);
