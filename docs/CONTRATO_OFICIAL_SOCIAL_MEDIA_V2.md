# CONTRATO OFICIAL — SOCIAL MEDIA V2 — SaaS-GQV

## Objetivo
Este documento define a regra oficial do módulo Social Media V2.
Toda alteração no front, back, integração, UI, repo, core, client, agency ou contexto deve respeitar este contrato antes de qualquer modificação.

Se o código atual divergir deste documento, o código deve ser ajustado para obedecer este contrato, e não o contrário.

---

## 1. Regra central do produto

O fluxo oficial do Social Media V2 é:

Planejamento editorial mensal
→ aprovação editorial do calendário
→ geração / produção dos posts
→ aprovação final da mídia
→ publicação

Não misturar planejamento editorial com post final.

---

## 2. Separação obrigatória de camadas

### 2.1 Calendário editorial
Representa o planejamento mensal.

Entidades envolvidas:
- social_calendars
- social_calendar_items

Função:
- guardar o calendário do mês
- guardar os cards editoriais
- permitir aprovação editorial
- servir de base para gerar produção posterior

### 2.2 Produção de posts
Representa a execução do que foi aprovado no editorial.

Entidade envolvida:
- social_posts

Função:
- receber itens aprovados
- controlar pipeline de produção
- controlar mídia final
- controlar publicação

---

## 3. Aprovações oficiais

### 3.1 Aprovação editorial
Acontece dentro da aba/calendário de Calendário.

Regra:
- o cliente aprova conteúdo editorial no Calendário
- o cliente solicita ajustes editoriais no Calendário
- a aba Aprovações NÃO deve listar calendário editorial

### 3.2 Aprovação final de mídia
Acontece na aba Aprovações.

Regra:
- só entram em Aprovações posts que já possuem mídia/prévia final
- Aprovações é etapa final antes de aprovado/publicado

---

## 4. Contrato oficial de status

### 4.1 Status do calendário editorial
Usar oficialmente:
- draft
- sent_for_approval
- approved
- needs_changes

Se existirem status legados no front, eles devem ser traduzidos para estes status oficiais sem contaminar a regra principal.

### 4.2 Status da produção de posts
Usar oficialmente:
- planned
- in_production
- ready
- scheduled
- published

Status complementares legados podem existir apenas como compatibilidade temporária, nunca como fonte principal de verdade.

---

## 5. Contrato oficial de campos

### 5.1 Calendário editorial
Usar oficialmente:
- cliente_id
- mes_referencia
- status

### 5.2 Itens editoriais
Usar oficialmente:
- calendar_id
- data
- tema
- tipo de conteúdo
- canal
- copy
- observações
- status do item, quando aplicável

### 5.3 Produção de posts
Usar oficialmente:
- calendar_id
- cliente_id
- data_agendada
- status

### 5.4 Campos proibidos como padrão novo
Não usar como contrato novo:
- client_id
- post_date

Se ainda existirem, tratar como legado e migrar o consumo gradualmente.

---

## 6. Regra obrigatória de arquitetura

### 6.1 Repo é a fonte única de acesso ao banco
Nenhuma página HTML deve montar query crítica inline se já existir função equivalente no repo.

Obrigação:
- centralizar leitura e escrita no repo
- evitar query duplicada em Agency e Client
- evitar divergência entre front e back

### 6.2 Core coordena regra de negócio
A UI não deve carregar regra de negócio estrutural.

### 6.3 UI só renderiza
A UI deve:
- renderizar estado
- disparar ações
- não ser dona de contrato estrutural

---

## 7. Calendar State Manager — regra obrigatória

Deve existir uma fonte única de verdade para o calendário e o mês visível.

Esse manager deve ser o único dono de:
- clientId
- tenantId
- visibleYear
- visibleMonth
- monthKey
- monthStart
- activeCalendarId
- calendarStatus
- editorialItems
- monthPosts
- selectedItemId
- selectedPostId
- loading flags
- error
- request/version control

Regra absoluta:
Nenhum arquivo pode calcular monthKey sozinho.

Agency e Client devem ler o mesmo estado compartilhado do mês.

---

## 8. Regra de interface oficial

### 8.1 Planejamento editorial
Deve ser visual por cards no calendário.

Não transformar o planejamento editorial em formulário como fluxo principal.

Fluxo correto:
- calendário visual
- cards do mês
- clique no card abre detalhe/edição lateral
- aprovação editorial acontece sobre os cards do calendário

### 8.2 Produção
A produção pode usar pipeline/board/lista, separado do calendário editorial.

---

## 9. Regra obrigatória para mudanças futuras

Antes de qualquer mudança em Social Media, o responsável deve verificar:

1) A mudança respeita a separação entre calendário editorial e produção?
2) A aprovação editorial continua no Calendário?
3) A aba Aprovações continua reservada para mídia final?
4) O repo continua sendo a fonte única de acesso ao banco?
5) A mudança cria ou reativa uso de client_id ou post_date?
6) A mudança duplica cálculo de monthKey, mês visível ou estado do calendário?
7) Agency e Client continuarão lendo a mesma verdade do mês?
8) A mudança preserva compatibilidade temporária com legado sem recolocar o legado como principal?
9) A UI continua visual por cards no planejamento?
10) O fluxo resultante continua sendo:
    planejamento → aprovação editorial → produção → aprovação final → publicação

Se qualquer resposta for “não”, a mudança deve ser revista antes de implementar.

---

## 10. Arquivos mais sensíveis do contrato

Tratar com atenção máxima:
- js/v2/shared/calendar_state_manager.js
- js/v2/shared/calendar_state_selectors.js
- js/v2/modules/social_media/social_media_repo.js
- js/v2/modules/social_media/social_media_core.js
- js/v2/modules/social_media/social_media_ui.js
- js/v2/client/client_core.js
- js/v2/client/client_ui.js
- v2/agency/index.html
- v2/client/index.html
- js/v2/shared/clientContext.js
- js/v2/shared/tenantContext.js

---

## 11. Política obrigatória de execução no TRAE

Antes de qualquer patch estrutural no Social Media, o prompt deve mandar:

- auditar contrato atual
- identificar divergências com este documento
- aplicar somente patch incremental e seguro
- não mexer no banco se não for necessário
- não quebrar v1.1
- não reativar legado como fonte principal
- validar Agency e Client no mesmo mês
- retornar:
  FILES_CHANGED
  PATCH_SUMMARY
  COMMAND_LOG

---

## 12. Regra final

Este documento é a referência oficial do módulo Social Media V2.
Sempre que houver conflito entre:
- código antigo
- comportamento legado
- patch improvisado
- dúvidas de implementação

prevalece este contrato oficial.