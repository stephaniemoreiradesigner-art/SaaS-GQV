const { createClient } = require('@supabase/supabase-js');

let supabase;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️ Supabase credentials missing in environment variables. Using mock client.');
  
  // Mock client para permitir inicialização do servidor mesmo sem chaves
  supabase = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: 'Supabase not configured' } })
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
          maybeSingle: async () => ({ data: null, error: { message: 'Supabase not configured' } }),
          then: (resolve) => resolve({ data: [], error: { message: 'Supabase not configured' } })
        })
      })
    })
  };
} else {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

module.exports = supabase;
