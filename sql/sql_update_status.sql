-- Atualização da Tabela Clientes para Suportar Status e Novos Campos
-- Rode este comando no SQL Editor do Supabase

-- 1. Adicionar coluna Status e garantir os outros campos
alter table clientes 
add column if not exists status text default 'Ativo';

-- Garantir que os campos usados no cadastro existam (caso não tenham sido criados ainda)
alter table clientes 
add column if not exists nome_empresa text,
add column if not exists telefone text,
add column if not exists endereco text,
add column if not exists email_contato text,
add column if not exists responsavel_nome text,
add column if not exists responsavel_whatsapp text,
add column if not exists valor_mensalidade numeric,
add column if not exists dia_vencimento integer,
add column if not exists servicos jsonb,
add column if not exists plataformas_social jsonb,
add column if not exists plataformas_trafego jsonb;

-- 2. Ajustes finais (opcional, para limpeza)
-- Se a coluna 'nome' antiga estiver atrapalhando, remova a obrigatoriedade ou a coluna
alter table clientes alter column nome drop not null;
