# CONTRATO OFICIAL — SOCIAL MEDIA V2

## 📌 VISÃO GERAL

O módulo de Social Media V2 é dividido em dois fluxos independentes:

1. **Calendário Editorial (Planejamento)**
2. **Posts (Produção e Publicação)**

Esses fluxos possuem regras, estados e responsabilidades distintas.

---

# 🧠 REGRA PRINCIPAL

> ❗ Nunca misturar estados de calendário com estados de post

- Calendar Items → fluxo editorial  
- Posts → fluxo de produção/publicação  

---

# 🔵 1. CALENDÁRIO EDITORIAL

## 📦 Tabela: `social_calendar_items`

Representa cada conteúdo planejado do mês.

### Campos principais:

- `id`
- `calendar_id`
- `data`
- `tema`
- `tipo_conteudo`
- `canal`
- `observacoes`

### Campos estruturais:

- `status` (text)
- `copy` (text)
- `cta` (text)
- `content_structure` (jsonb)

---

## 🧩 STATUS EDITORIAL (`social_calendar_items.status`)

- `draft` → item em criação pela agência  
- `approved` → tema aprovado pelo cliente → dispara criação do post de produção  
- `needs_changes` → cliente solicitou ajustes no tema → post de produção não é afetado  

> ❗ `needs_changes` no calendário editorial NÃO gera `changes_requested` no post.  
> O status `changes_requested` no post é reservado para rejeição de mídia produzida.

---

## 🧱 CONTENT STRUCTURE

Define a estrutura do conteúdo com base no tipo.

### 🎥 Reels

```json
{
  "type": "reels",
  "roteiro": {
    "hook": "string",
    "body": "string",
    "cta": "string"
  }
}
```

---

# 🟣 2. POSTS (PRODUÇÃO E PUBLICAÇÃO)

## 📦 Tabela: `social_posts`

Representa o conteúdo em produção — gerado a partir de um item editorial aprovado ou criado diretamente.

### Campos principais:

- `id`
- `calendar_id`
- `calendar_item_id` → vínculo com o item editorial de origem (nullable)
- `cliente_id`
- `status`
- `tema`, `legenda`, `plataforma`, `formato`
- `data_agendada`
- `imagem_url`, `video_url`

---

## 🧩 STATUS DE PRODUÇÃO (`social_posts.status`)

| Status | Significado |
|---|---|
| `draft` | Post criado — aguardando produção de conteúdo |
| `ready_for_review` | Em produção — agência revisando |
| `ready_for_approval` | Mídia pronta — enviada para aprovação final do cliente |
| `changes_requested` | Cliente rejeitou a mídia — ajuste necessário |
| `approved` | Mídia aprovada pelo cliente |
| `scheduled` | Agendado para publicação |
| `published` | Publicado |

> ❗ `changes_requested` significa APENAS que o cliente rejeitou a **mídia produzida**.  
> O tema editorial continua aprovado — apenas a execução visual precisa ser refeita.

---

# 🔗 3. CONEXÃO EDITORIAL → PRODUÇÃO

## Fluxo

```
[Calendário] item.status = 'approved'
       ↓
Agência inicia produção
       ↓
[Post] status = 'draft'          ← criado com vínculo calendar_item_id
       ↓
[Post] status = 'ready_for_review'   ← agência conclui conteúdo
       ↓
[Post] status = 'ready_for_approval' ← enviado para cliente (mídia)
       ↓
Cliente aprova ou solicita ajuste de mídia (NÃO afeta aprovação editorial)
```

## Regras de Isolamento

- Aprovar ou rejeitar um `calendar_item` NÃO altera o `status` do post vinculado
- Rejeitar a mídia (`changes_requested`) NÃO reverte a aprovação editorial
- Um post existente NUNCA tem seu status resetado pela sincronização do calendário

---

# 🧩 4. DOIS TIPOS DE APROVAÇÃO DO CLIENTE

## Aprovação Editorial (Planejamento)

- Objeto: `social_calendar_items`
- Onde: tela do Calendário Editorial
- O que o cliente aprova: **tema, copy, canal, formato**
- Resultado: item vai para `approved`, agência inicia produção

## Aprovação de Mídia (Produção)

- Objeto: `social_posts`
- Onde: tela de Aprovações (posts)
- O que o cliente aprova: **imagem, vídeo, legenda final produzida**
- Resultado: post vai para `approved`, agência agenda/publica

---

# 📋 5. HISTÓRICO DE EVENTOS

Todos os eventos são registrados em `social_approvals`:

- Criação do post (`created`)
- Mudança de status (`resubmitted`, `approved`, `changes_requested`, etc.)
- Mudança de data (`date_moved`)
- Aprovação editorial vinculada (`editorial_approved`)

---

# ⛔ ANTI-PADRÕES PROIBIDOS

- Usar `changes_requested` no post para sinalizar ajuste editorial
- Resetar status do post quando o calendário muda
- Exibir status de produção como se fosse status editorial
- Criar lógica que assume que um post aprovado editorialmente = mídia aprovada
