-- Solução para o erro: column reference "metadata" is ambiguous
-- Este erro ocorre porque a função de busca tem um parâmetro 'metadata' que conflita com o nome da coluna 'metadata' na tabela.
-- A solução é recriar a função usando '#variable_conflict use_column'.

create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    conteudo as content,
    metadata,
    1 - (embedding <=> query_embedding) as similarity
  from base_conhecimento
  where 1 - (embedding <=> query_embedding) > match_threshold
  and metadata @> filter
  order by embedding <=> query_embedding
  limit match_count;
end;
$$;
