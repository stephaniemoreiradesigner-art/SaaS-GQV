# Regras Operacionais de Desenvolvimento — SaaS-GQV

Este arquivo define regras para qualquer alteração automática no código do projeto.

## 1. Regra de Segurança
Nunca reescrever arquivos inteiros sem necessidade.
Preferir pequenas edições (patches).

## 2. Estrutura do Sistema
O sistema possui módulos principais:

- Clientes
- Social Media
- Tráfego Pago
- Painel do Cliente

Estes são os módulos prioritários do projeto.

## 3. Módulos Temporariamente Desativados
Os módulos abaixo devem permanecer com estado:

"Em construção... 🛠️"

Sem erro de console.

Lista atual:

- tarefas.html
- relatorios.html
- automacoes.html
- financeiro.html
- colaboradores.html

## 4. ClientContext
Todos os módulos devem obter o cliente ativo usando:

clientContext.js

Nunca criar outra fonte paralela de cliente ativo.

## 5. Layout
O layout pode ser alterado se melhorar a usabilidade.

Prioridade:
fluxo operacional > preservação visual.

## 6. Social Media
O módulo Social Media é crítico.

Nunca quebrar:

- geração de calendário
- fluxo de aprovação
- conexão com cliente ativo

## 7. Commits
Sempre que alterações forem aplicadas executar:

git add -A
git commit -m "chore: aplicar regras estruturais SaaS-GQV"
git push origin main

## 8. Alterações Futuras
Sempre trabalhar em blocos pequenos:

1 módulo por vez
1 commit por alteração

Nunca alterar múltiplos módulos sem necessidade.

OBJETIVO FINAL:
Garantir estabilidade do sistema e reduzir diffs grandes.
