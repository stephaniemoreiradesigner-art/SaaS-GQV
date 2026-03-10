// js/v2/modules/social_media/social_media_calendar.js
// Módulo de Calendário do Social Media V2
// Responsável por renderizar a grid mensal e gerenciar Drag-and-Drop

(function(global) {
    const SocialMediaCalendar = {
        currentMonth: new Date(),
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
                const isToday = new Date().toISOString().slice(0, 10) === dateStr;
                
                const cell = document.createElement('div');
                cell.className = `h-32 bg-white rounded-lg border ${isToday ? 'border-purple-300 ring-1 ring-purple-100' : 'border-slate-200'} p-2 flex flex-col relative group transition-colors hover:border-purple-200`;
                cell.dataset.date = dateStr;
                
                // Header do dia
                cell.innerHTML = `
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-xs font-semibold ${isToday ? 'text-purple-600 bg-purple-50 px-1.5 rounded' : 'text-slate-400'}">${day}</span>
                        <button class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-purple-600 transition-opacity" onclick="document.dispatchEvent(new CustomEvent('v2:calendar-add', { detail: { date: '${dateStr}' } }))">
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

        createPostCard: function(post) {
            const el = document.createElement('div');
            el.draggable = true;
            el.className = 'text-xs p-1.5 rounded border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-sm cursor-grab active:cursor-grabbing transition-all select-none group/card';
            el.dataset.postId = post.id;
            
            // Status color
            const statusColors = {
                'draft': 'border-l-2 border-l-gray-300',
                'in_production': 'border-l-2 border-l-blue-300',
                'awaiting_approval': 'border-l-2 border-l-yellow-400',
                'ready_for_approval': 'border-l-2 border-l-yellow-400',
                'approved': 'border-l-2 border-l-green-400',
                'changes_requested': 'border-l-2 border-l-red-400',
                'published': 'border-l-2 border-l-purple-500',
                'archived': 'border-l-2 border-l-gray-500',
                // Fallbacks para compatibilidade
                'rascunho': 'border-l-2 border-l-gray-300',
                'pendente_aprovacao': 'border-l-2 border-l-yellow-400',
                'aprovado': 'border-l-2 border-l-green-400'
            };
            const borderClass = statusColors[post.status] || statusColors['draft'];
            el.classList.add(...borderClass.split(' '));

            // Conteúdo resumido
            const title = post.legenda || post.titulo || 'Sem título';
            const icon = this.getPlatformIcon(post);
            const mediaUrl = post.imagem_url || post.media_url;
            const isVideo = !!(mediaUrl && mediaUrl.match(/\.(mp4|webm|mov)$/i));
            
            el.innerHTML = `
                <div class="flex items-center gap-1 truncate">
                    ${icon}
                    <span class="truncate font-medium text-slate-700">${title}</span>
                </div>
                ${mediaUrl ? (
                    isVideo
                        ? '<div class="mt-1 h-8 bg-slate-200 rounded overflow-hidden"><video src="'+mediaUrl+'" class="w-full h-full object-cover"></video></div>'
                        : '<div class="mt-1 h-8 bg-slate-200 rounded overflow-hidden"><img src="'+mediaUrl+'" class="w-full h-full object-cover"></div>'
                ) : ''}
            `;

            // Eventos de Drag
            el.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', post.id);
                e.dataTransfer.effectAllowed = 'move';
                el.classList.add('opacity-50');
            });

            el.addEventListener('dragend', (e) => {
                el.classList.remove('opacity-50');
            });
            
            // Clique para editar
            el.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar disparar o clique do dia (add post)
                document.dispatchEvent(new CustomEvent('v2:post-click', { detail: { post } }));
            });

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
                const monthName = this.currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                label.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            }
        }
    };

    global.SocialMediaCalendar = SocialMediaCalendar;

})(window);
