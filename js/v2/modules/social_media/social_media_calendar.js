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
                        <button class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-purple-600 transition-opacity" onclick="window.SocialMediaCalendar && window.SocialMediaCalendar.addInlineItem && window.SocialMediaCalendar.addInlineItem('${dateStr}')">
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

            const statusMeta = (() => {
                if (!global.GQV_STATUS_MAP) return null;
                if (isCalendarItem && typeof global.GQV_STATUS_MAP.getCalendarItemStatusMeta === 'function') {
                    return global.GQV_STATUS_MAP.getCalendarItemStatusMeta(post.status);
                }
                if (!isCalendarItem && typeof global.GQV_STATUS_MAP.getPostStatusMeta === 'function') {
                    return global.GQV_STATUS_MAP.getPostStatusMeta(post.status);
                }
                return null;
            })();
            const statusLabel = statusMeta?.label || (String(post.status || '').trim() || '-');
            const statusPill = statusMeta?.color?.pill || 'bg-slate-100 text-slate-600';
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
            
            const openInlineEditor = () => {
                if (!isCalendarItem) {
                    document.dispatchEvent(new CustomEvent('v2:post-click', { detail: { post } }));
                    return;
                }
                const existing = el.querySelector('.inline-editor');
                if (existing) {
                    existing.remove();
                }
                const editor = document.createElement('div');
                editor.className = 'inline-editor mt-2 p-2 rounded-lg border border-slate-200 bg-slate-50 space-y-2';
                editor.innerHTML = `
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-semibold text-slate-500 mb-1">Data</label>
                            <input type="date" class="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" value="${String(post.data_agendada || '').slice(0,10)}" data-field="date">
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold text-slate-500 mb-1">Canal</label>
                            <select class="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" data-field="canal">
                                <option value="instagram" ${/instagram/i.test(post.plataforma||post.canal||'instagram') ? 'selected' : ''}>Instagram</option>
                                <option value="facebook" ${/facebook/i.test(post.plataforma||post.canal||'') ? 'selected' : ''}>Facebook</option>
                                <option value="linkedin" ${/linkedin/i.test(post.plataforma||post.canal||'') ? 'selected' : ''}>LinkedIn</option>
                                <option value="tiktok" ${/tiktok/i.test(post.plataforma||post.canal||'') ? 'selected' : ''}>TikTok</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-semibold text-slate-500 mb-1">Tema</label>
                        <input type="text" class="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" value="${(post.tema || '').replace(/"/g, '&quot;')}" data-field="tema">
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <div>
                            <label class="block text-[10px] font-semibold text-slate-500 mb-1">Tipo</label>
                            <select class="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" data-field="tipo">
                                <option value="post_estatico" ${/estatico|imagem|static/i.test(post.formato||post.tipo||'') ? 'selected' : ''}>Post estático</option>
                                <option value="carrossel" ${/carrossel/i.test(post.formato||post.tipo||'') ? 'selected' : ''}>Carrossel</option>
                                <option value="reels" ${/reels|video|vídeo/i.test(post.formato||post.tipo||'') ? 'selected' : ''}>Reels</option>
                                <option value="story" ${/story|stories/i.test(post.formato||post.tipo||'') ? 'selected' : ''}>Story</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold text-slate-500 mb-1">Observações</label>
                            <input type="text" class="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs" value="${(post.observacoes || '').replace(/"/g, '&quot;')}" data-field="observacoes">
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-2 pt-1">
                        <button type="button" class="px-3 py-1 rounded-lg border border-slate-200 text-[11px] text-slate-600 hover:text-slate-800" data-action="cancel">Cancelar</button>
                        <button type="button" class="px-3 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-medium hover:bg-slate-800" data-action="save">Salvar</button>
                    </div>
                `;
                el.appendChild(editor);
                const saveBtn = editor.querySelector('[data-action="save"]');
                const cancelBtn = editor.querySelector('[data-action="cancel"]');
                if (cancelBtn) cancelBtn.addEventListener('click', () => editor.remove());
                if (saveBtn) {
                    saveBtn.addEventListener('click', async () => {
                        const dateEl = editor.querySelector('[data-field="date"]');
                        const temaEl = editor.querySelector('[data-field="tema"]');
                        const tipoEl = editor.querySelector('[data-field="tipo"]');
                        const canalEl = editor.querySelector('[data-field="canal"]');
                        const obsEl = editor.querySelector('[data-field="observacoes"]');
                        const payload = {
                            id: post.calendar_item_id,
                            calendar_id: post.calendar_id || (global.SocialMediaCore?.currentCalendarId || ''),
                            data: String(dateEl?.value || '').slice(0,10),
                            tema: String(temaEl?.value || '').trim(),
                            tipo_conteudo: String(tipoEl?.value || 'post_estatico'),
                            canal: String(canalEl?.value || 'instagram'),
                            observacoes: String(obsEl?.value || '')
                        };
                        if (!payload.data || !payload.tema) return;
                        const btnHtml = saveBtn.innerHTML;
                        saveBtn.disabled = true;
                        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Salvando';
                        try {
                            const res = await (global.SocialMediaRepo?.upsertCalendarItem ? global.SocialMediaRepo.upsertCalendarItem(payload) : Promise.resolve(null));
                            if (res && global.CalendarStateManager?.refreshMonthData) {
                                await global.CalendarStateManager.refreshMonthData();
                            }
                            editor.remove();
                        } catch {
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = btnHtml;
                        }
                    });
                }
            };
            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar disparar o clique do dia (add post)
                const actionEl = e.target?.closest?.('[data-action]');
                if (actionEl) return;
                openInlineEditor();
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
                        openInlineEditor();
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
    global.SocialMediaCalendar.addInlineItem = function(dateStr) {
        const grid = document.getElementById(SocialMediaCalendar.containerId);
        if (!grid) return;
        const cell = Array.from(grid.querySelectorAll('[data-date]')).find(d => d.dataset.date === dateStr);
        if (!cell) return;
        const zone = cell.querySelector('.drop-zone');
        if (!zone) return;
        const newItem = {
            __fromCalendarItem: true,
            calendar_item_id: null,
            calendar_id: (global.SocialMediaCore?.currentCalendarId || ''),
            data_agendada: dateStr,
            tema: '',
            formato: 'post_estatico',
            plataforma: 'instagram',
            status: 'draft'
        };
        const card = SocialMediaCalendar.createPostCard(newItem);
        zone.prepend(card);
        card.click();
    };

})(window);
