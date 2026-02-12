document.addEventListener('DOMContentLoaded', async () => {
    // Verificar se estamos na página de chat
    if (!window.location.pathname.includes('chat.html')) return;

    const shouldBlockChat = !window.location.search.includes('chat_dev=1');
    if (shouldBlockChat) {
        const modal = document.getElementById('chat-dev-modal');
        const overlay = document.getElementById('chat-dev-overlay');
        const closeBtn = document.getElementById('chat-dev-close');
        const okBtn = document.getElementById('chat-dev-ok');
        if (modal) modal.classList.remove('hidden');

        const handleClose = () => {
            if (modal) modal.classList.add('hidden');
            window.location.href = 'home.html';
        };

        if (overlay) overlay.addEventListener('click', handleClose);
        if (closeBtn) closeBtn.addEventListener('click', handleClose);
        if (okBtn) okBtn.addEventListener('click', handleClose);
        return;
    }

    const channelListPublic = document.getElementById('channel-list-public');
    const channelListDm = document.getElementById('channel-list-dm');
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const btnSend = document.getElementById('btn-send-message');
    const chatEmptyState = document.getElementById('chat-empty-state');
    const chatContent = document.getElementById('chat-content');
    const chatHeaderTitle = document.getElementById('chat-header-title');
    const chatHeaderDesc = document.getElementById('chat-header-desc');

    let activeChannelId = null;
    let realtimeSubscription = null;
    let currentUser = null;

    // Inicializar
    async function initChat() {
        try {
            // 1. Obter usuário atual
            const { data: { user } } = await window.supabaseClient.auth.getUser();
            if (!user) {
                window.location.href = 'index.html';
                return;
            }
            
            // Buscar perfil completo (nome, foto)
            const { data: profile } = await window.supabaseClient
                .from('colaboradores')
                .select('*')
                .eq('email', user.email)
                .single();
            
            currentUser = { ...user, ...profile }; // Merge auth and profile data

            // 2. Carregar Canais Públicos
            await loadChannels();

            // 3. Carregar Usuários para DMs (Simulando lista de DMs)
            await loadDirectMessages();

            // Remove loading screen
            document.getElementById('loading-screen').style.display = 'none';

        } catch (error) {
            console.error('Erro ao inicializar chat:', error);
            alert('Erro ao carregar chat. Verifique o console.');
        }
    }

    // --- CARREGAMENTO DE DADOS ---

    async function loadChannels() {
        channelListPublic.innerHTML = '';
        
        const { data: channels, error } = await window.supabaseClient
            .from('chat_channels')
            .select('*')
            .eq('type', 'public')
            .order('name');

        if (error) {
            console.error('Erro ao buscar canais:', error);
            return;
        }

        if (channels.length === 0) {
            // Se não houver canais, criar o #Geral automaticamente
            channelListPublic.innerHTML = '<li class="px-5 py-3 text-xs text-gray-400 italic">Nenhum canal público</li>';
        } else {
            channels.forEach(channel => {
                const li = document.createElement('li');
                li.className = 'chat-channel-item group flex items-center px-4 py-2 rounded-md cursor-pointer hover:bg-gray-100 transition-colors text-gray-700 mb-1';
                li.dataset.id = channel.id;
                
                // Icon styling via Tailwind classes handled in innerHTML
                li.innerHTML = `
                    <span class="w-5 text-center text-gray-400 group-hover:text-primary transition-colors"><i class="fas fa-hashtag text-xs"></i></span>
                    <span class="text-sm font-medium ml-2">${channel.name.toLowerCase()}</span>
                `;
                li.onclick = () => selectChannel(channel);
                channelListPublic.appendChild(li);
            });
        }
    }

    async function loadDirectMessages() {
        channelListDm.innerHTML = '';

        // Buscar todos os colaboradores (exceto eu mesmo)
        const { data: users, error } = await window.supabaseClient
            .from('colaboradores')
            .select('id, nome, email, foto_url')
            .neq('email', currentUser.email);

        if (error) {
            console.error('Erro ao buscar usuários:', error);
            return;
        }

        users.forEach(user => {
            const li = document.createElement('li');
            li.className = 'chat-channel-item group flex items-center px-4 py-2 rounded-md cursor-pointer hover:bg-gray-100 transition-colors text-gray-700 mb-1';
            li.innerHTML = `
                <div class="relative mr-3">
                    <div class="w-2 h-2 rounded-full bg-green-500 ring-2 ring-white"></div>
                </div>
                <span class="text-sm font-medium text-gray-700 group-hover:text-gray-900">${user.nome || user.email.split('@')[0]}</span>
            `;
            // Ao clicar, iniciar DM (buscar ou criar canal direct)
            li.onclick = () => startDirectMessage(user);
            channelListDm.appendChild(li);
        });
    }

    // --- LÓGICA DE CANAL ---

    async function selectChannel(channel, targetUser = null) {
        if (activeChannelId === channel.id) return;

        // UI Updates
        document.querySelectorAll('.chat-channel-item').forEach(el => {
            el.classList.remove('bg-blue-50', 'text-primary');
            el.querySelector('.text-primary')?.classList.remove('text-primary'); // Remove highlight from icon if added manually
        });
        
        // Find and activate current item
        const activeItem = [...document.querySelectorAll('.chat-channel-item')].find(el => el.dataset.id === channel.id);
        if (activeItem) {
            activeItem.classList.add('bg-blue-50', 'text-primary');
            const icon = activeItem.querySelector('.fa-hashtag');
            if(icon) icon.parentElement.classList.add('text-primary');
        }

        activeChannelId = channel.id;
        
        // Update Header
        if (channel.type === 'public') {
            chatHeaderTitle.innerHTML = `<i class="fas fa-hashtag text-gray-400 text-sm mr-2"></i> ${channel.name}`;
            chatHeaderDesc.textContent = 'Canal público da equipe';
        } else if (channel.type === 'direct' && targetUser) {
            chatHeaderTitle.innerHTML = `<i class="fas fa-user text-gray-400 text-sm mr-2"></i> ${targetUser.nome}`;
            chatHeaderDesc.textContent = targetUser.email;
        }

        // Show Content
        chatEmptyState.classList.add('hidden');
        chatContent.classList.remove('hidden');
        chatContent.classList.add('flex'); // Ensure flex is restored
        
        messagesContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fas fa-spinner fa-spin mb-2"></i>
                <span class="text-sm">Carregando mensagens...</span>
            </div>
        `;

        // Load Messages
        await loadMessages(channel.id);

        // Subscribe to Realtime
        subscribeToChannel(channel.id);

        // Focus Input
        messageInput.focus();
        if (channel.type === 'public') {
            messageInput.placeholder = `Enviar mensagem para #${channel.name}`;
        } else {
            messageInput.placeholder = `Enviar mensagem para ${targetUser ? targetUser.nome : 'privado'}`;
        }
    }

    async function startDirectMessage(targetUser) {
        // 1. Verificar se já existe canal direct entre currentUser e targetUser
        // Isso é complexo de fazer em uma query simples sem backend function, 
        // mas vamos tentar buscar canais do tipo 'direct' que eu faço parte
        // e verificar se o outro membro é o targetUser.
        
        // Simplificação: Vamos criar um ID determinístico ou buscar na tabela members.
        // Query: Buscar channel_id onde (user_id = me OR user_id = target) GROUP BY channel_id HAVING count = 2
        // Supabase query complexa.
        
        // Workaround VibeCode: Vamos criar um canal novo se não acharmos fácil, ou usar uma convenção de nome 'dm_id1_id2' (ordenado)
        // Mas nomes de DM são null.
        
        // Vamos tentar encontrar um canal 'direct' comum.
        // Passo 1: Meus canais direct
        const { data: myMemberChannels } = await window.supabaseClient
            .from('chat_members')
            .select('channel_id, chat_channels!inner(type)')
            .eq('user_id', currentUser.id || currentUser.user_id) // Preciso do ID do auth
            .eq('chat_channels.type', 'direct');
            
        // Passo 2: Canais do alvo
        // ... (muito requests).
        
        // Vamos usar uma abordagem "Try Create":
        // Tentar criar um canal direct. Se eu puder identificar unicamente...
        
        // Melhor abordagem para MVP: Criar sempre um novo canal se não tiver ID na memória? Não.
        // Vamos varrer os canais que eu tenho e ver os membros.
        
        try {
            // Pegar ID real do Auth (currentUser.id deve vir do auth.getUser())
            const myAuthId = (await window.supabaseClient.auth.getUser()).data.user.id;
            
            // Buscar target user ID (Auth ID) usando o email
            // A tabela 'colaboradores' pode ter um ID diferente do Auth ID.
            // Vamos buscar na tabela 'profiles' que mapeia ID (Auth) e Email, ou tentar inferir.
            
            let targetAuthId = null;

            // Tentativa 1: Buscar na tabela profiles (padrão do sistema)
            const { data: profileData } = await window.supabaseClient
                .from('profiles')
                .select('id')
                .eq('email', targetUser.email)
                .maybeSingle();

            if (profileData) {
                targetAuthId = profileData.id;
            } else {
                // Tentativa 2: Se não tiver profile, talvez o usuário ainda não tenha feito login/cadastro no Auth
                // Mas se ele estiver logado, o Auth ID dele existe.
                // Se não acharmos o Auth ID, não podemos criar o chat (Foreign Key constraint).
                console.warn(`Auth ID não encontrado para o email ${targetUser.email}`);
                alert('Este usuário ainda não ativou a conta ou não possui um perfil de sistema vinculado.');
                return;
            }
            
            // Verificar meus canais
            const { data: myChannels } = await window.supabaseClient
                .from('chat_members')
                .select('channel_id')
                .eq('user_id', myAuthId);
                
            const myChannelIds = myChannels.map(c => c.channel_id);
            
            if (myChannelIds.length > 0) {
                // Buscar se o target está em algum desses canais que seja DIRECT
                const { data: commonChannels } = await window.supabaseClient
                    .from('chat_members')
                    .select('channel_id, chat_channels!inner(type)')
                    .in('channel_id', myChannelIds)
                    .eq('user_id', targetAuthId)
                    .eq('chat_channels.type', 'direct');

                if (commonChannels && commonChannels.length > 0) {
                    // Achamos!
                    const channelId = commonChannels[0].channel_id;
                    const { data: channel } = await window.supabaseClient.from('chat_channels').select('*').eq('id', channelId).single();
                    selectChannel(channel, targetUser);
                    return;
                }
            }

            // Se não achou, cria novo
            const { data: newChannel, error: createError } = await window.supabaseClient
                .from('chat_channels')
                .insert({ type: 'direct', created_by: myAuthId })
                .select()
                .single();

            if (createError) throw createError;

            // Adicionar membros
            await window.supabaseClient
                .from('chat_members')
                .insert([
                    { channel_id: newChannel.id, user_id: myAuthId },
                    { channel_id: newChannel.id, user_id: targetAuthId }
                ]);

            selectChannel(newChannel, targetUser);

        } catch (e) {
            console.error('Erro ao abrir DM:', e);
            alert('Erro ao abrir conversa privada.');
        }
    }

    async function loadMessages(channelId) {
        const { data: messages, error } = await window.supabaseClient
            .from('chat_messages')
            .select(`
                id, content, created_at, user_id
            `)
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true })
            .limit(50); // Últimas 50

        if (error) {
            messagesContainer.innerHTML = '<div class="text-red-500 text-center p-4">Erro ao carregar mensagens.</div>';
            return;
        }

        messagesContainer.innerHTML = '';
        
        // --- Otimização: Carregar usuários em lote ---
        const userIds = [...new Set(messages.map(m => m.user_id))];
        const userMap = {};

        if (userIds.length > 0) {
            try {
                // 1. Buscar Emails via Profiles (Mapear AuthID -> Email)
                const { data: profiles } = await window.supabaseClient
                    .from('profiles')
                    .select('id, email')
                    .in('id', userIds);
                
                const idToEmail = {};
                const emails = [];
                if (profiles) {
                    profiles.forEach(p => {
                        idToEmail[p.id] = p.email;
                        if(p.email) emails.push(p.email);
                    });
                }

                // 2. Buscar Dados de Colaboradores via Email (Mapear Email -> Nome/Foto)
                if (emails.length > 0) {
                    const { data: colabs } = await window.supabaseClient
                        .from('colaboradores')
                        .select('email, nome, foto_url')
                        .in('email', emails);
                    
                    const emailToColab = {};
                    if (colabs) {
                        colabs.forEach(c => {
                            emailToColab[c.email] = c;
                        });
                    }

                    // 3. Construir Mapa Final (AuthID -> Dados)
                    userIds.forEach(uid => {
                        const email = idToEmail[uid];
                        if (email && emailToColab[email]) {
                            userMap[uid] = emailToColab[email];
                        }
                    });
                }
            } catch (err) {
                console.error("Erro ao carregar autores:", err);
            }
        }
        
        for (const msg of messages) {
            await appendMessage(msg, userMap);
        }
        
        scrollToBottom();
    }

    async function appendMessage(msg, userMap = {}) {
        // Buscar info do usuário
        let authorName = 'Usuário';
        let authorAvatar = 'assets/logo.png'; // fallback
        
        if (msg.user_id === currentUser.id) {
            authorName = 'Você';
            authorAvatar = currentUser.foto_url || currentUser.user_metadata?.avatar_url || 'https://ui-avatars.com/api/?name=Eu';
        } else {
            // Tentar usar o mapa pré-carregado
            const author = userMap[msg.user_id];
            
            if (author) {
                authorName = author.nome;
                authorAvatar = author.foto_url || `https://ui-avatars.com/api/?name=${author.nome}`;
            } else {
                authorName = 'Usuário'; 
                authorAvatar = `https://ui-avatars.com/api/?name=U`;
            }
        }

        const date = new Date(msg.created_at);
        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const div = document.createElement('div');
        div.className = 'flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group';
        div.innerHTML = `
            <img src="${authorAvatar}" class="w-10 h-10 rounded-full object-cover flex-shrink-0" alt="${authorName}">
            <div class="flex-1 min-w-0">
                <div class="flex items-baseline gap-2 mb-1">
                    <span class="font-bold text-gray-900 text-sm">${authorName}</span>
                    <span class="text-xs text-gray-400 group-hover:text-gray-500 transition-colors">${timeStr}</span>
                </div>
                <div class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(msg.content)}</div>
            </div>
        `;
        messagesContainer.appendChild(div);
    }

    // --- ENVIAR MENSAGEM ---

    async function sendMessage() {
        const content = messageInput.value.trim();
        if (!content || !activeChannelId) return;

        messageInput.value = ''; // Limpar imediatamente (otimista)

        try {
            const { error } = await window.supabaseClient
                .from('chat_messages')
                .insert({
                    channel_id: activeChannelId,
                    user_id: (await window.supabaseClient.auth.getUser()).data.user.id,
                    content: content
                });

            if (error) throw error;
            // Realtime vai cuidar de mostrar a mensagem

        } catch (e) {
            console.error('Erro ao enviar:', e);
            alert('Falha ao enviar mensagem.');
            messageInput.value = content; // Devolver texto
        }
    }

    // --- REALTIME ---

    function subscribeToChannel(channelId) {
        if (realtimeSubscription) {
            window.supabaseClient.removeChannel(realtimeSubscription);
        }

        realtimeSubscription = window.supabaseClient
            .channel(`public:chat_messages:channel_id=eq.${channelId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'chat_messages', 
                filter: `channel_id=eq.${channelId}` 
            }, payload => {
                appendMessage(payload.new).then(() => scrollToBottom());
            })
            .subscribe();
    }

    // --- UTILS ---

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }

    // --- EVENT LISTENERS ---

    btnSend.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Função global para criar canal
    window.createNewChannel = async () => {
        const name = prompt('Nome do novo canal (sem #):');
        if (!name) return;

        try {
            const { error } = await window.supabaseClient
                .from('chat_channels')
                .insert({
                    name: name,
                    type: 'public',
                    created_by: (await window.supabaseClient.auth.getUser()).data.user.id
                });
            
            if (error) throw error;
            
            alert('Canal criado!');
            loadChannels(); // Recarregar lista
        } catch (e) {
            console.error(e);
            alert('Erro ao criar canal.');
        }
    };

    // --- DETECÇÃO DE CONEXÃO ---
    function updateOnlineStatus() {
        const isOnline = navigator.onLine;
        const header = document.querySelector('.chat-header');
        
        let offlineBanner = document.getElementById('offline-banner');
        
        if (!isOnline) {
            if (!offlineBanner) {
                offlineBanner = document.createElement('div');
                offlineBanner.id = 'offline-banner';
                offlineBanner.className = 'bg-red-500 text-white text-center py-1 px-4 text-xs font-bold shadow-md';
                offlineBanner.innerHTML = '<i class="fas fa-wifi mr-2"></i> Você está offline. As mensagens podem não ser enviadas.';
                
                // Inserir antes do header ou no topo do container de mensagens
                if (header) {
                    header.parentNode.insertBefore(offlineBanner, header.nextSibling);
                }
            }
            // Desabilitar input
            if(messageInput) {
                messageInput.disabled = true;
                messageInput.placeholder = 'Aguardando conexão...';
                messageInput.classList.add('bg-gray-100', 'cursor-not-allowed');
            }
            if(btnSend) {
                btnSend.disabled = true;
                btnSend.classList.add('opacity-50', 'cursor-not-allowed');
            }
            
        } else {
            if (offlineBanner) offlineBanner.remove();
            
            // Habilitar input
            if(messageInput) {
                messageInput.disabled = false;
                messageInput.classList.remove('bg-gray-100', 'cursor-not-allowed');
                if(activeChannelId) {
                    const channelName = document.querySelector(`.chat-channel-item[data-id="${activeChannelId}"] span:nth-child(2)`)?.textContent;
                    if(channelName) messageInput.placeholder = `Enviar mensagem para #${channelName}`;
                    else messageInput.placeholder = 'Digite sua mensagem...';
                }
            }
            if(btnSend) {
                btnSend.disabled = false;
                btnSend.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Inicializar
    initChat();
    updateOnlineStatus(); // Check inicial
});
