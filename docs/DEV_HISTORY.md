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
