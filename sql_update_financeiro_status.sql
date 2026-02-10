-- Atualização da Tabela Financeiro para Suportar Status
-- Rode este comando no SQL Editor do Supabase

-- 1. Adicionar coluna Status
alter table financeiro 
add column if not exists status text default 'recebido';

-- 2. Atualizar registros antigos para 'recebido' (assumindo que o que já estava lá foi pago)
update financeiro set status = 'recebido' where status is null;
