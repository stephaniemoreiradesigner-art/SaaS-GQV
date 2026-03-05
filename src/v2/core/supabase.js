const { createClient } = require('@supabase/supabase-js');

// Helper para ler variáveis com fallback
const getEnv = (key, fallbackKey) => {
  return process.env[key] || (fallbackKey ? process.env[fallbackKey] : undefined);
};

// Resolução de credenciais
const supabaseUrl = getEnv('SUPABASE_URL', 'SUPABASE_REST_URL');
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY', 'SUPABASE_ANON');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE');

// Log de status (apenas booleans para segurança)
console.log('[Supabase v2] Config Check:', {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  hasServiceKey: !!supabaseServiceKey
});

let supabase;

// Precisamos da URL e da Service Key para operações privilegiadas (backend)
if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
} else {
  console.warn('⚠️ [Supabase v2] Credenciais incompletas. O cliente não foi inicializado corretamente.');
  // Em vez de mock, deixamos undefined ou null para forçar erro explícito ao usar
  supabase = null; 
}

module.exports = supabase;
