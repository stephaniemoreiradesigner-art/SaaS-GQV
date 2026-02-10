# Módulo de Automação - Instruções

## 1. Configuração do Banco de Dados
1. Abra o arquivo `setup_automations.html` no seu navegador.
2. Clique em **"Executar Configuração"**.
3. Se falhar, copie o SQL gerado e rode no "SQL Editor" do painel do Supabase.

## 2. Configuração do Backend (API Node.js)
Este módulo possui uma API Node.js para funcionalidades avançadas (Failover, Logs).

1. Abra o terminal na pasta do projeto.
2. Instale as dependências:
   ```bash
   npm install
   ```
   *(Se não tiver `package.json` ainda, ele foi criado. Certifique-se de ter Node.js instalado)*

3. Inicie o servidor:
   ```bash
   node server.js
   ```
   O servidor rodará em `http://localhost:3000`.

## 3. Como Testar
1. Acesse o SaaS e clique em **Automações** no menu.
2. **Criar Fluxo**: Clique em "+ Novo Fluxo" e crie um teste.
3. **Failover**:
   - Vá na aba "Standby".
   - Veja o par de fluxos configurado (Mock ou Real).
   - Clique em "Simular Falha" (isso vai chamar a API `/failover/check` simulando erros).
   - Verifique se o status mudou para "Failover Triggered" e se apareceu no Audit Log.

## 4. Notas
- Se o servidor Node.js não estiver rodando, o frontend tentará buscar dados básicos diretamente do Supabase (Modo Fallback), mas funcionalidades como "Failover Automático" dependem do servidor.
