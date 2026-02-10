-- Inserir chave inicial para Webhook do n8n
INSERT INTO public.configuracoes (key, value, description)
VALUES ('n8n_webhook_approval', '', 'Webhook do n8n para Aprovação Finalizada')
ON CONFLICT (key) DO NOTHING;
