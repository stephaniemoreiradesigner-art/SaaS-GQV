
document.addEventListener('DOMContentLoaded', async () => {
    // Aguardar Supabase
    const waitForSupabase = setInterval(async () => {
        if (window.supabaseClient) {
            clearInterval(waitForSupabase);
            initNotifications();
        }
    }, 500);

    async function initNotifications() {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (!user) return;

        console.log('🔔 Iniciando sistema de notificações para:', user.email);

        // Inscrever no canal de notificações
        const channel = window.supabaseClient
            .channel('public:notificacoes')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notificacoes',
                filter: `usuario_id=eq.${user.id}`
            }, payload => {
                console.log('🔔 Nova notificação recebida:', payload);
                const notif = payload.new;
                
                // Exibir Toast
                if (window.showToast) {
                    // Mensagem, Tipo (success = verde)
                    window.showToast(notif.mensagem, 'success');
                }

                // Tocar som (opcional)
                try {
                    // Som curto de notificação
                    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3'); 
                    audio.volume = 0.5;
                    audio.play().catch(e => console.warn('Audio play blocked (user interaction needed)', e));
                } catch (e) {}
            })
            .subscribe();
    }
});
