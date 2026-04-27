# REBUILD_GAP_ANALYSIS_V2

## Escopo
- Baseado somente em V2 e áreas auditadas:
  - `v2/agency/index.html`
  - `v2/client/*`
  - `js/v2/shared/*`
  - `js/v2/modules/clientes/*`
  - `js/v2/modules/social_media/*`
  - `js/v2/modules/performance/*`
  - `supabase/migrations/*`

## 1) O que já está aproveitável
- Arquitetura por módulo com separação `core/repo/ui` em `clientes`, `social_media`, `performance`.
- `ClientContext` e `CalendarStateManager` já existem e cobrem sincronização de cliente/mês.
- Repositório social já centraliza grande parte das operações e inclui histórico em `social_post_history`.
- Fluxo de portal cliente já possui views dedicadas (`home`, `calendar`, `approvals`, `history`, `metrics`).
- Migrations V2 mostram base de backend para social approvals/post history e RLS.

## 2) O que está quebrado ou confuso
- Mistura de responsabilidades:
  - estado em contexto + estado espelhado em `localStorage` + estado transitório em UI.
- HTML com lógica inline em páginas críticas (`agency/index`, `client/index`, auth pages).
- Superfície global alta (`global.*`) com nomes genéricos, aumentando acoplamento e colisão.
- Queries Supabase fora de camada `repo` em pontos de infraestrutura/contexto (`tenantContext`, `social_media_ai_adapter`).
- Módulo de agência concentrado em um único HTML extenso, difícil de evoluir por tela/feature.

## 3) O que precisa ser refeito no front
- Reestruturação de telas:
  - separar `v2/agency/index.html` em shell + telas/componentes por módulo.
- Redução de inline script:
  - mover lógica inline de HTML para arquivos JS de entrada por tela.
- Unificação de estado:
  - definir fonte única para cliente ativo e mês ativo (evitar espelhos redundantes).
- Padronização de eventos/timeline:
  - timeline sempre orientada por eventos persistidos (evitar timeline derivada por heurística de status).
- Contratos de módulo:
  - manter `core` como orquestrador, `repo` como acesso a dados, `ui` como render puro.

## 4) O que deve permanecer no backend
- Tabelas e políticas RLS já existentes em `supabase/migrations/*` para social/client portal.
- Persistência de histórico (`social_post_history`) como fonte de verdade de eventos.
- Regras de aprovação/rejeição e trilha de auditoria no banco.
- Qualquer enriquecimento de decisão/evento que impacte integridade deve ficar server-side.

## 5) Ordem recomendada de reconstrução
1. Travar contrato de arquitetura V2 (estado, eventos, fronteira `core/repo/ui`).
2. Extrair shell de navegação da agência e quebrar `index.html` em entradas por tela.
3. Migrar lógica inline HTML para módulos JS de página.
4. Consolidar estado global (cliente/mês) e remover duplicidades em `localStorage`.
5. Normalizar timeline social para leitura exclusiva de eventos persistidos.
6. Revisar queries fora de `repo` e manter apenas autenticação/contexto estritamente necessário.
7. Só após isso, avançar para otimizações visuais e features novas.

## 6) Riscos técnicos por módulo
- Shared:
  - risco de acoplamento alto por contexto global e persistência múltipla.
- Clientes:
  - risco de colisão de namespace global (`ClientCore/ClientRepo/ClientUI`).
- Social Media:
  - risco de inconsistência entre status derivado em UI e trilha real de eventos.
  - risco de manutenção por volume de responsabilidades no `core`.
- Performance:
  - módulo ainda focal em conexões; risco moderado de dependência de contexto global.
- HTML V2 (agency/client):
  - risco alto por script inline e baixa modularidade de página.
- Migrations:
  - risco baixo de modelagem base; risco médio de histórico de hotfixes acumulados dificultar rastreabilidade.

## Resíduo técnico (não base operacional)
- Artefatos legados e bridges devem ser tratados apenas como compatibilidade temporária.
- Base operacional recomendada: módulos V2 auditados + contrato de arquitetura oficial.
