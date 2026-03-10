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

## 2026-03-10 — Clients List Rehydration After Reload

### Problema
- Na tela de Clientes da Agency, a lista carregava na primeira interação, mas após reload a UI era sobrescrita por estado vazio ("Nenhum cliente encontrado").

### Causa
- O `loadClients()` era executado imediatamente no carregamento da página, antes do boot v2 concluir (`supabaseReady` + `v2:ready`). Em reload, isso acionava `getClients()` cedo demais (supabase/contexto ainda não prontos), resultando em lista vazia e a UI não re-renderizava novamente com dados reais.

### Solução
- Tornou-se o carregamento da lista dependente do boot v2: `loadClients()` aguarda `supabaseReady` e `v2:ready` antes de consultar o repositório.
- Adicionados logs de diagnóstico (`[ClientsView]`) e um retry único quando o retorno é vazio para capturar condições de corrida.
- Gatilhos adicionais para recarregar a lista ao navegar para a view "clients" (nav/header/go-clients), garantindo estabilidade após reload e navegação.

### Arquivos Alterados
- `v2/agency/index.html`

### Como Validar Manualmente
1. Agency → Clientes: abrir a tela → lista aparece.
2. Recarregar página → lista continua visível (sem estado vazio indevido).
3. Buscar cliente (campo Buscar) → filtro funciona.
4. Clicar em cliente → modal abre.
5. Voltar/recarregar → lista permanece estável.

## 2026-03-10 — Client Portal Posts Approval Flow (Visualizar + Aprovação)

### Problema
- No Portal do Cliente (Aprovar Posts), o botão "Visualizar" não abria o modal.
- Ao clicar em "Aprovar Post", retornava "Nenhuma linha atualizada (RLS/filtro)" e o fluxo não fechava ponta a ponta.

### Causa
- O card bloqueava o clique em botões (`if(e.target.tagName === 'BUTTON') return;`), mas o botão "Visualizar" não tinha handler próprio, então o clique não acionava nada.
- O modal não normalizava mídia (usava apenas `imagem_url`, enquanto a lista suportava `media_url`), causando modal sem mídia mesmo quando existia.
- A policy de UPDATE para cliente estava acoplando a autorização em `social_posts.cliente_id`, mas o fluxo do Portal identifica ownership de forma confiável via `social_posts.calendar_id -> social_calendars.cliente_id`. Isso resultava em UPDATE com 0 linhas afetadas sob RLS (sem erro explícito).

### Solução
- UI: adicionada ação explícita no botão "Visualizar" para abrir o modal com dados reais (tema/título, legenda, status e mídia quando existir).
- UI: modal passa a usar `imagem_url || media_url` e popula título corretamente.
- Banco: policy de UPDATE ajustada para validar ownership via relação com `social_calendars` e permitir somente transição para `approved/changes_requested`.
- Logs: fluxo imprime no console o `postId`, `payload` e `authEmail` para diagnóstico rápido.

### Arquivos Alterados
- `v2/client/index.html` (referência do modal; sem alteração de layout)
- `js/v2/client/client_ui.js`
- `js/v2/client/client_core.js`
- `js/v2/client/client_repo.js`
- `supabase/migrations/fix_social_posts_client_approval_rls_v2.sql`

### Como Validar Manualmente
1. Portal do Cliente → Aprovar Posts: clicar em "Visualizar" → modal abre com dados reais (incluindo mídia quando existir).
2. Portal do Cliente: clicar em "Aprovar Post" → confirmação → update persiste no banco (sem "RLS/filtro").
3. Recarregar Portal → post aprovado não aparece como pendente.
4. Agency: recarregar → status do post reflete `approved`.

## 2026-03-10 — Início do Redesign Visual V2 (Linguagem Linear + White-label)

### Decisão
- Adotar linguagem visual minimalista inspirada no Linear para a V2.
- Manter a arquitetura client-first intacta (TenantContext/ClientContext, repos, Supabase client, regras de cliente ativo).

### Escopo desta etapa
- Refinar shell da Agency V2 (sidebar/topbar/workspace) para um visual premium e consistente.
- Iniciar pipeline visual no Social Media V2 (visão por estágios + cards clicáveis).
- Refinar casca do Portal do Cliente V2 para ficar coerente com a nova linguagem.
- Criar base de componentes visuais reutilizáveis (Button/Card/Badge/Tabs/Drawer/Empty State) via classes e tokens.
- White-label via variáveis CSS (primária/secundária) e suporte a logo + favicon dinâmicos.

### O que foi implementado
- UI Kit Linear: tokens e classes reutilizáveis baseadas em `--color-primary/secondary` (fornecidas pelo `theme.js`).
- Agency: header com busca/notifications/profile (UI), tabs do Social Media migradas para o padrão de tabs, e criação da view Pipeline.
- Portal: inclusão de logo dinâmico (sidebar e header) e base de estilo consistente.

### Arquivos Alterados
- `js/v2/shared/ui_kit_linear.js`
- `v2/agency/index.html`
- `v2/client/index.html`

### Como Validar Manualmente
1. Agency: abrir dashboard/clientes/social → verificar consistência visual (sidebar/topbar/cards/tabs).
2. Social Media: alternar tabs → Pipeline renderiza colunas e cards, clique abre drawer.
3. Portal: abrir Home/Aprovações → sidebar/topbar carregam logo e UI permanece responsiva.
4. White-label: ao aplicar configurações do `theme.js`, cor primária/secundária, logo e favicon refletem na UI.

### Próximos passos sugeridos
- Refinar calendário mensal e o drawer do post (hierarquia visual + blocos).
- Implementar pipeline com drag and drop e estágios consistentes (sem alterar schema).
- Expandir white-label para logo por cliente no portal quando aplicável.

## 2026-03-10 — Social Media Posts Kanban (mesma base do Calendário) + Ações no Modal de Cliente

### Problema
- Social Media: a aba Calendário exibia posts do mês, mas a aba Posts não refletia os mesmos dados (estado vazio/sem espelho do calendário).
- Clientes: modal de cliente não oferecia ações operacionais de cadastro (Editar/Excluir) ponta a ponta.

### Causa
- Não existia estado compartilhado explícito no módulo Social Media para armazenar os posts carregados do `calendar_id` do mês atual e reusar em múltiplas views.
- O modal de cliente possuía UI de detalhes, mas não conectava ações de edição/exclusão ao fluxo existente.

### Solução
- Social Media:
  - `SocialMediaCore` passa a persistir `currentPosts` como fonte de verdade do mês atual (mesma base usada para renderizar o Calendário).
  - A aba Posts renderiza um kanban operacional diretamente a partir de `currentPosts` e re-renderiza ao trocar mês/cliente e após operações (create/edit/delete/move/status).
  - Tabs do Social Media foram simplificadas para: Visão Geral / Posts / Calendário / Insights.
- Clientes:
  - Modal de cliente ganhou ações de Editar/Excluir.
  - Editar abre o modal de cadastro em modo edição, pré-carregando os dados atuais.
  - Excluir usa confirmação visual interna (sem `alert/confirm` nativos), remove o cliente e atualiza a lista; se o cliente excluído estiver ativo, limpa o `ClientContext`.

### Arquivos Alterados
- `v2/agency/index.html`
- `js/v2/modules/social_media/social_media_core.js`
- `js/v2/modules/social_media/social_media_ui.js`
- `js/v2/modules/social_media/social_media_calendar.js`
- `js/v2/modules/clientes/clientes_ui.js`

### Como Validar Manualmente
1. Agency → Social Media → Calendário: confirmar que há posts no mês.
2. Agency → Social Media → Posts: confirmar que os mesmos posts aparecem organizados por status (kanban).
3. Editar/criar/mover/excluir post: confirmar atualização em Calendário e Posts.
4. Agency → Clientes: abrir modal de cliente → confirmar botões Editar e Excluir.
5. Editar cliente: salvar → lista atualiza sem sumir.
6. Excluir cliente: confirmar no modal → lista atualiza; se era cliente ativo, cliente ativo é limpo.

## 2026-03-10 — Portal do Cliente: loop login↔dashboard após exclusão de cliente duplicado

### Incidente
- Existiam dois clientes duplicados (ID 14 correto, ID 73 incorreto).
- O cliente ID 73 foi excluído manualmente.
- Após isso, o Portal do Cliente entrou em loop entre Login e Dashboard para o usuário afetado.

### Causa raiz
- O guard de autenticação do Portal usava a sessão do Supabase para redirecionar (login → dashboard), mas o Portal dependia de um cache adicional local (`V2_CLIENT_SESSION`) para montar o contexto do cliente.
- Com a sessão do Supabase persistida e o `V2_CLIENT_SESSION` ausente/inconsistente (apontando para o ID removido), o guard redirecionava para o dashboard e o core do portal devolvia para o login, causando loop.

### Correção
- Portal agora re-hidrata o `V2_CLIENT_SESSION` a partir da sessão do Supabase antes de permitir redirect automático.
- A resolução de `client_id` passa a vir exclusivamente da tabela de vínculo do portal (`client_portal_users`).
- Se o vínculo estiver inválido (cliente removido/inexistente ou vínculo ausente), o portal:
  - limpa caches relacionados,
  - impede o loop (não redireciona em cascata),
  - exibe mensagem controlada no login com instrução clara.

### Ajuste adicional (registro)
- O fluxo de `register.html` agora cria o vínculo do usuário recém-criado na tabela `client_portal_users` usando o `client_id` do convite (URL), garantindo que o login subsequente resolva o cliente corretamente.

### Observação (RLS)
- Se a tabela `client_portal_users` estiver com RLS habilitado sem policy de INSERT/SELECT, o registro do vínculo será bloqueado. Foi adicionado o script `sql/2026-03-10_client_portal_users_rls.sql` com policies para permitir INSERT/SELECT do próprio usuário (`auth.uid() = user_id`).

### Arquivos Alterados
- `js/v2/shared/auth_guard.js`
- `js/v2/client/client_auth.js`
- `js/v2/client/client_core.js`
- `v2/client/login.html`

### Como Validar Manualmente
1. Portal do Cliente: abrir `/v2/client/login.html` com sessão antiga → não deve entrar em loop.
2. Logar com o e-mail correto → resolver cliente ID 14 e abrir dashboard.
3. Logout → voltar ao login e permanecer estável.
4. Reload no dashboard → permanecer estável.
5. Simular vínculo inexistente → exibir mensagem amigável e não entrar em loop.

## 2026-03-10 — Agency Clientes: fluxo de edição completo (cards + modal V2)

### Problema
- Na tela Agency V2 → Clientes, o botão "Editar" não executava nenhuma ação.
- O modal de clientes não contemplava os campos principais esperados para edição (responsável/telefones/serviços).

### Solução
- Cards de clientes abrem o modal de detalhes; a edição é acessada exclusivamente pelo botão "Editar" no modal de detalhes.
- Modal de clientes foi adaptado para suportar claramente:
  - modo create (Novo Cliente)
  - modo edit (Editar Cliente)
- Campos de edição incluídos no modal: nome da empresa, nome fantasia, responsável, e-mail, telefone, whatsapp, documento, status, serviços contratados e logo (URL).
- Salvamento em modo edição executa UPDATE via `ClientRepo.updateClient` e atualiza a lista/cards imediatamente após sucesso (sem recarregar a página inteira).

### Arquivos Alterados
- `v2/agency/index.html`
- `js/v2/modules/clientes/clientes_ui.js`
- `js/v2/modules/clientes/clientes_repo.js`

### Como Validar Manualmente
1. Agency → Clientes: clicar em um card → modal de detalhes abre.
2. No modal de detalhes: clicar em "Editar" → modal abre preenchido.
3. Alterar 2 campos (ex.: telefone + whatsapp) e salvar → modal fecha e card reflete mudanças.
4. Alterar logo (URL) e salvar → avatar/logo no detalhe e no card atualiza.
