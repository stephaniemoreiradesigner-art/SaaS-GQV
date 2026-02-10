const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gbqknmejsmnizjdnopnq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdicWtubWVqc21uaXpqZG5vcG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjkyOTMsImV4cCI6MjA3ODgwNTI5M30.w-v_CW3X5DF9x_nnFe3Lhvw_JyrXxfXKv7tPIZAjGaU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
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
