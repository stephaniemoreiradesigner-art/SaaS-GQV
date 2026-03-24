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

## 🧩 STATUS EDITORIAL

- `draft` → item em criação  
- `approved` → aprovado pelo cliente  
- `needs_changes` → cliente solicitou ajustes  

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