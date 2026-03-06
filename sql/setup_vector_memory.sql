-- Habilita a extensão pgvector para trabalharmos com IA (Embeddings)
create extension if not exists vector;

-- Cria a tabela de memória de posts
create table if not exists memoria_posts (
  id bigint primary key generated always as identity,
  content text, -- O conteúdo do post (Tema + Legenda)
  metadata jsonb, -- Dados extras: { "cliente_id": 123, "data": "2024-02-01", "formato": "Reels" }
  embedding vector(1536) -- Vetor gerado pela OpenAI (text-embedding-3-small usa 1536 dimensões)
);

-- Cria uma função para buscar posts similares (Isso será usado pelo n8n via RPC se necessário, ou direto pelo node Supabase Vector Store)
create or replace function match_posts (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb DEFAULT '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    memoria_posts.id,
    memoria_posts.content,
    memoria_posts.metadata,
    1 - (memoria_posts.embedding <=> query_embedding) as similarity
  from memoria_posts
  where 1 - (memoria_posts.embedding <=> query_embedding) > match_threshold
  and memoria_posts.metadata @> filter
  order by memoria_posts.embedding <=> query_embedding
  limit match_count;
end;
$$;
