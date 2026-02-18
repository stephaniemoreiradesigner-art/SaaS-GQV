# SaaS-GQV

## Logo do Cliente
Para exibir o logo nos cards e na visualização do cliente, o sistema usa este fluxo:

- Upload (preferencial): envia a imagem para o bucket client-logos no Supabase Storage e salva a URL pública em logo_url.
- Fallback (simples): se não tiver Storage configurado, informe uma URL de imagem no campo logo_url e ela será usada diretamente.
