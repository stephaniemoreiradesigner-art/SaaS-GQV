const supabase = typeof window !== 'undefined' ? window.supabaseClient : null;

async function check() {
    if (!supabase) {
        throw new Error('supabase_nao_inicializado');
    }
    // Attempt to insert a row with all suspect columns to see which one fails
    // We use a non-existent calendar_id, expecting a foreign key error if columns are OK.
    // If columns are missing, we expect a column error.
    
    const { error } = await supabase
        .from('social_posts')
        .insert({
            calendar_id: '00000000-0000-0000-0000-000000000000',
            titulo: 'Teste',
            data_postagem: '2024-01-01',
            legenda_sugestao: 'Teste',
            tema: 'Teste',
            formato: 'estatico'
        });

    console.log(JSON.stringify(error, null, 2));
}

check();
