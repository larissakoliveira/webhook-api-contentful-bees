# Documentação

O guia completo em português (arquitetura, Contentful, env, ngrok, Vercel, produtos, “avisar-me”) vive no repositório **bee-app**:

- Ficheiro: `bee-app/docs/GUIA-COMPLETO.md`  
- Se só clonaste este repositório, clona também o frontend ou pede o ficheiro ao repositório bee-app.

**Produção (Vercel):** o Contentful deve apontar para `POST https://<projeto>.vercel.app/api/vercelWebhook` (não uses `/webhook` — essa rota é só no Express local).
