# SaaS-GQV

## Stack

- Node.js
- Express
- Supabase
- Multi-tenant (tenant_id BIGINT)
- Deploy via Coolify
- VPS principal: 31.97.23.172 (Hostinger KVM2)
- Domínio: gestaoquevende.cloud
- API: api.gestaoquevende.cloud

## Módulos

- Social Media (ativo)
- Aprovação de calendário
- Painel do cliente
- Tráfego Pago (em evolução)

## Regras Técnicas

- Sempre usar tenant_id nas queries
- RLS ativa no Supabase
- Status centralizados em constantes
- Não quebrar endpoints existentes
- Commit push origin main obrigatório após alterações

## Fluxo de Desenvolvimento

1. Alterar código
2. npm run lint
3. npm run typecheck (se aplicável)
4. Commit
5. Push
