# Histórico de Desenvolvimento - SaaS GQV V2

Este documento registra marcos técnicos importantes, correções de bugs complexos e decisões arquiteturais.

## 2026-03-09 — Social Media Media Rehydration Fix

### Problema
A mídia persistia corretamente no banco de dados e era exibida sem problemas no Portal do Cliente. No entanto, ao reabrir posts já salvos dentro do painel da Agency (Agência), o preview da mídia não aparecia, dando a impressão de que o arquivo havia sido perdido.

### Causa
O navegador, por motivos de segurança, não permite repopular programaticamente um `<input type="file">` com um arquivo vindo de uma URL. Como a UI dependia exclusivamente do evento `change` desse input ou de um estado volátil para mostrar o preview, ao recarregar a página ou reabrir o drawer, a informação visual era perdida.

### Solução
Implementou-se uma lógica de "hidratação" no momento de abertura do drawer de edição:
1.  Ao abrir um post (`renderCreateForm`), a URL persistida (`imagem_url`) é injetada no `dataset.mediaUrl` do container de preview.
2.  A UI força a exibição do elemento `<img>` ou `<video>` com essa URL.
3.  No momento de salvar (`getFormData`), o sistema verifica se houve um novo upload. Se não houver, ele recupera a URL do `dataset`, garantindo que a mídia original não seja sobrescrita por `null`.

### Arquivo Alterado
- `js/v2/modules/social_media/social_media_ui.js`

### Commit
`fix(v2-social): rehydrate persisted media in agency post editor`

## 2026-03-10 — Client Approval Sync & Agency Calendar Media Persistence

### Problema
- No Portal do Cliente, o clique em "Aprovar Post" exibia sucesso, mas o post permanecia como pendente na UI.
- Na Agency, o status aprovado não era refletido de forma confiável após reload.
- Na Agency, a thumb de mídia no card do calendário sumia após reload (mesmo com mídia persistida no banco e no Portal).

### Causa
- O update no Portal falhava por RLS (cliente autenticado sem policy de UPDATE em `social_posts`) e o erro estava sendo exibido apenas como mensagem genérica.
- Além disso, o update no Portal não validava se alguma linha foi realmente atualizada. Em cenários de RLS/filtro (0 linhas afetadas), o Supabase podia retornar `error: null` e a UI tratava como sucesso.
- A Agency ainda mapeava parte dos status legados (`awaiting_approval`) e não reconhecia `ready_for_approval`, gerando inconsistência visual.
- O calendário da Agency renderizava thumb apenas de `imagem_url` e não tolerava fallback de campo (`media_url`) quando presente.

### Solução
- Portal: updates passam a usar `select()` e validam `data.length > 0` antes de retornar sucesso, evitando "sucesso falso", e logam `error.code/message/details` quando falha.
- Banco: adicionada policy RLS para permitir que o cliente (por e-mail) atualize o status dos próprios posts para `approved`/`changes_requested`.
- Agency: padronização de status na UI (`ready_for_approval` + `changes_requested`) e ajustes de classes/cor.
- Agency Calendar: thumb passa a usar `imagem_url || media_url` (com fallbacks adicionais) e renderiza `<img>` ou `<video>` conforme extensão.

### Arquivos Alterados
- `js/v2/client/client_repo.js`
- `js/v2/client/client_core.js`
- `js/v2/modules/social_media/social_media_core.js`
- `js/v2/modules/social_media/social_media_calendar.js`
- `supabase/migrations/fix_social_posts_client_approval_rls.sql`

### Como Validar Manualmente
1. Agency: abrir um post com mídia → verificar thumb visível no calendário.
2. Portal do Cliente: aprovar um post pendente → confirmar que ele sai da lista pendente após refresh.
3. Agency: recarregar após aprovação → confirmar status atualizado vindo do banco e thumb ainda presente.

## 2026-03-10 — Client Details Access Model & Performance Connections Foundation

### Problema
- O módulo Clientes precisava de uma tela de detalhes por cliente, com blocos bem definidos e controle de acesso por tipo de informação.
- O módulo Tráfego Pago precisava de uma base correta para conexões por cliente (Meta, Google Ads, LinkedIn) sem implementar integrações completas hoje.

### Causa
- Não existia uma camada de permissão no frontend para segmentar a visualização (operacional vs financeiro/legal vs admin).
- Não existia uma estrutura de dados única para armazenar o estado de conexão por plataforma por cliente, nem uma UI mínima como fonte de verdade operacional.

### Solução
- Clientes: adicionada modal de detalhes ao clicar no card, com blocos (Visão Geral, Operação, Ativos Digitais, Financeiro/Contrato) e um modelo de acesso por role (via `TenantContext.roles`).
- Banco: adicionadas colunas opcionais em `clientes` para suportar campos operacionais/ativos/financeiro (sem segredos).
- Tráfego Pago: criada tabela `client_platform_connections` com RLS para Agência e UI base em Performance para visualizar status e registrar conexões como pendentes.

### Arquivos Alterados
- `v2/agency/index.html`
- `js/v2/modules/performance/performance_connections_repo.js`
- `js/v2/modules/performance/performance_connections_ui.js`
- `js/v2/modules/performance/performance_connections_core.js`
- `supabase/migrations/add_client_detail_fields.sql`
- `supabase/migrations/create_client_platform_connections.sql`

### Como Validar Manualmente
1. Agency → Clientes: clicar em um cliente → modal de detalhes abre sem definir cliente automaticamente.
2. Agency → Clientes: testar roles:
   - admin/super_admin: enxerga todos os blocos.
   - operacional: enxerga Visão Geral + Operação + Ativos Digitais.
   - financeiro/legal: enxerga apenas Financeiro e Contrato.
3. Agency → Performance: selecionar cliente ativo → ver cards de conexão (Meta/Google/LinkedIn).
4. Agency → Performance: clicar em Conectar → status muda para Pendente e persiste ao recarregar (após aplicar migrações no Supabase).
