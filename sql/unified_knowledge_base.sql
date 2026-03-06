-- 1. Habilita a extensão pgvector para trabalhar com Inteligência Artificial
create extension if not exists vector;

-- 2. Cria o Bucket de Armazenamento Dedicado para IA (arquivos-conhecimento)
insert into storage.buckets (id, name, public)
values ('arquivos-conhecimento', 'arquivos-conhecimento', true)
on conflict (id) do nothing;

-- Políticas de segurança do Bucket (Se der erro que já existe, pode ignorar)
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'Public Access Knowledge') then
    create policy "Public Access Knowledge" on storage.objects for select using ( bucket_id = 'arquivos-conhecimento' );
  end if;
  
  if not exists (select 1 from pg_policies where policyname = 'Auth Upload Knowledge') then
    create policy "Auth Upload Knowledge" on storage.objects for insert with check ( bucket_id = 'arquivos-conhecimento' and auth.role() = 'authenticated' );
  end if;
end $$;

-- 3. Cria a Tabela Unificada de Conhecimento (Vector Store)
create table if not exists base_conhecimento (
  id bigint primary key generated always as identity,
  cliente_id bigint references clientes(id) on delete cascade, -- CORRIGIDO: Tipo alterado para BIGINT para bater com a tabela clientes
  conteudo text, -- O texto extraído do PDF, do Link ou do contexto
  metadados jsonb, -- { "tipo": "persona", "arquivo_original": "url..." }
  embedding vector(1536), -- Compatível com OpenAI
  created_at timestamptz default now()
);

-- 4. Cria índice para busca rápida
create index if not exists base_conhecimento_embedding_idx on base_conhecimento using hnsw (embedding vector_cosine_ops);
