# CURRENT_CODE_AUDIT_V2

## Escopo auditado
- `v2/agency/index.html`
- `v2/client/*`
- `js/v2/shared/*`
- `js/v2/modules/clientes/*`
- `js/v2/modules/social_media/*`
- `js/v2/modules/performance/*`
- `supabase/migrations/*`

## 1) Telas existentes hoje
- Agência (`v2/agency/index.html`):
  - `view-dashboard`
  - `view-clients`
  - `view-hub`
  - `view-social`
  - `view-performance`
  - `view-approvals`
  - `view-settings`
- Cliente (`v2/client/index.html`):
  - views principais: `home`, `calendar`, `approvals`, `history`, `metrics`
  - subviews internas: `view-social`, `view-ads`
- Auth cliente (`v2/client/*`):
  - `login.html`
  - `register.html`
  - `forgot.html`
  - `reset-password.html`
  - `update.html`

## 2) Arquivos principais por módulo
- Shared:
  - `js/v2/shared/clientContext.js`
  - `js/v2/shared/calendar_state_manager.js`
  - `js/v2/shared/calendar_state_selectors.js`
  - `js/v2/shared/tenantContext.js`
  - `js/v2/shared/auth_guard.js`
  - `js/v2/shared/constants.js`
  - `js/v2/shared/status_map.js`
  - `js/v2/shared/month_utils.js`
  - `js/v2/shared/workspaceState.js`
- Clientes:
  - `js/v2/modules/clientes/clientes_core.js`
  - `js/v2/modules/clientes/clientes_repo.js`
  - `js/v2/modules/clientes/clientes_ui.js`
- Social Media:
  - `js/v2/modules/social_media/social_media_core.js`
  - `js/v2/modules/social_media/social_media_repo.js`
  - `js/v2/modules/social_media/social_media_ui.js`
  - `js/v2/modules/social_media/social_media_calendar.js`
  - `js/v2/modules/social_media/social_media_ai_adapter.js`
  - `js/v2/modules/social_media/social_media_upload.js`
- Performance:
  - `js/v2/modules/performance/performance_connections_core.js`
  - `js/v2/modules/performance/performance_connections_repo.js`
  - `js/v2/modules/performance/performance_connections_ui.js`
- HTML V2:
  - `v2/agency/index.html`
  - `v2/agency/login.html`
  - `v2/client/index.html`
  - `v2/client/login.html`
  - `v2/client/register.html`
  - `v2/client/forgot.html`
  - `v2/client/reset-password.html`
  - `v2/client/update.html`

## 3) Funções principais encontradas
- Shared:
  - `ClientContext`: `init`, `setActiveClient`, `getActiveClient`, `getActiveClientInfo`, `subscribe`
  - `CalendarStateManager`: `init`, `refreshMonthData`, `goToMonth`, `nextMonth`, `prevMonth`, `selectPost`, `patchPost`, `subscribe`
  - `TenantContext`: resolução de tenant por sessão/usuário e cache em memória
- Clientes:
  - Core: `init`, `loadClients`, `handleClientSelection`
  - Repo: `getClients`, `getClientById`, `createClient`, `updateClient`
  - UI: `renderClients`, `highlightActive`
- Social Media:
  - Core: `init`, `onClientChange`, `generateCalendarWithAI`, `handleSavePost`, `processLifecycleEvents`, `logLifecycleEvent`
  - Repo: `getCalendarByMonth`, `getCalendarItems`, `createPost`, `updatePost`, `updatePostStatus`, `appendPostHistoryEvent`, `ensurePostHistoryBaseEvent`, `getPostAuditEvents`
  - UI: `renderPostsBoard`, `openEditorialItemModal`, `saveEditorialItemModal`, `refreshPostAuditPanel`, `renderTimelineEvents`
  - Adapter IA: `generateAICalendar`
- Performance:
  - Core: `init`, `onClientChange`, `handleConnect`, `handleDisconnect`
  - Repo: `getConnections`, `upsertConnection`, `disconnect`
  - UI: `render`, `renderMetrics`

## 4) Estados globais encontrados
- Contextos/estado compartilhado:
  - `global.ClientContext`
  - `global.CalendarStateManager`
  - `global.CalendarStateSelectors`
  - `global.TenantContext`
  - `global.WorkspaceState`
- Módulos globais expostos:
  - `global.SocialMediaCore`, `global.SocialMediaRepo`, `global.SocialMediaUI`, `global.SocialMediaCalendar`, `global.SocialMediaUpload`, `global.SocialMediaAI`
  - `global.ClientCore`, `global.ClientRepo`, `global.ClientesRepo`, `global.ClientUI`
  - `global.PerformanceConnectionsCore`, `global.PerformanceConnectionsRepo`, `global.PerformanceConnectionsUI`
- Persistência local (localStorage):
  - cliente ativo (`GQV_ACTIVE_CLIENT_ID`, `sm_active_client`, `selectedClientId`)
  - mês selecionado social (`GQV_SOCIAL_MONTH_*`)
  - outras chaves ligadas a sessão/contexto em shared

## 5) Onde ClientContext é usado
- Definição:
  - `js/v2/shared/clientContext.js`
- Uso em módulos auditados:
  - `js/v2/modules/social_media/social_media_core.js`
  - `js/v2/modules/social_media/social_media_ui.js`
  - `js/v2/modules/clientes/clientes_core.js`
  - `js/v2/modules/performance/performance_connections_core.js`
- Padrão predominante:
  - leitura via `getActiveClient/getActiveClientInfo`
  - reação a troca via `subscribe(...)`

## 6) Onde CalendarStateManager é usado
- Definição:
  - `js/v2/shared/calendar_state_manager.js`
- Uso em módulos auditados:
  - `js/v2/modules/social_media/social_media_core.js`
  - `js/v2/modules/social_media/social_media_ui.js`
  - `js/v2/modules/social_media/social_media_repo.js` (leitura auxiliar de `monthKey`)
- Ações usadas:
  - navegação de mês (`prevMonth`, `nextMonth`, `goToMonth`)
  - refresh (`refreshMonthData`)
  - leitura de snapshot (`getState`)

## 7) Onde há lógica inline em HTML
- `v2/agency/index.html`:
  - `onclick` inline em link de download
  - blocos `<script>` inline (script principal extenso)
- `v2/client/index.html`:
  - botões com `onclick` inline (toggle social/ads)
  - bloco `<script>` inline de bootstrap da página
- `v2/client/login.html`, `register.html`, `forgot.html`, `reset-password.html`, `update.html`:
  - todos possuem bloco `<script>` inline
- `v2/agency/login.html`:
  - bloco `<script>` inline

## 8) Onde há query Supabase fora de repo
- Em `shared` (fora de `repo`):
  - `js/v2/shared/tenantContext.js`
  - uso de `supabase.auth.getSession`, `supabase.auth.getUser`, `.from('tenants')`
- Em módulo não-repo:
  - `js/v2/modules/social_media/social_media_ai_adapter.js`
  - uso de `supabase.auth.getSession` para token antes da Edge Function
- Observação:
  - nos módulos `clientes`, `social_media` e `performance`, as queries de dados principais estão concentradas nos arquivos `*_repo.js`

## 9) Onde há risco de duplicidade de estado
- Cliente ativo em múltiplas fontes:
  - `ClientContext` + múltiplas chaves `localStorage` com mesmo propósito
- Mês corrente em múltiplas fontes:
  - `CalendarStateManager.state.monthKey` + `localStorage` (`GQV_SOCIAL_MONTH_*`)
- Exposição global ampla:
  - múltiplos módulos em `global.*`, com nomes genéricos (`ClientCore`, `ClientRepo`, `ClientUI`) que aumentam risco de colisão
- Histórico/aprovação:
  - parte da linha do tempo já em `social_post_history`, mas há sinais de lógica derivada de status em UI (timeline derivada), elevando risco de divergência de fonte de verdade

## Notas sobre migrations V2 (somente mapeamento)
- Há histórico de migrações para social approvals/posts/history e políticas RLS em `supabase/migrations/*`
- Arquivo de trilha de histórico real identificado:
  - `supabase/migrations/20260420_social_post_history.sql`
- Não foi aplicada nenhuma alteração de migration nesta auditoria
