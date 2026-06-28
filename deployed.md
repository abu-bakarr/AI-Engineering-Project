# Deployment

Public deployment target: Render

## Recommended Render setup

Create two Render services in one project:

1. `web`
   - source: this repository
   - branch: `main`
   - runtime: Docker (`Dockerfile`)
   - healthcheck: `/health`
   - public URL: `https://ai-engineering-project-tv92.onrender.com`
2. `chroma`
   - type: private service
   - image: `ghcr.io/chroma-core/chroma:0.5.23`
   - add persistent disk

## Required environment variables for `web`

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/owl-alpha
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
OPENROUTER_DOCUMENT_MODEL=openrouter/free
OPENROUTER_REFERER=https://ai-engineering-project-tv92.onrender.com
OPENROUTER_APP_NAME=RAG Chatbot Platform
CHROMA_URL=http://<your-render-chroma-private-host>:8000
CHROMA_COLLECTION=dsti_rag_docs
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_DB_URL=
SUPABASE_STORAGE_BUCKET=bot-documents
```

## Required environment variables for `chroma`

```env
IS_PERSISTENT=TRUE
ANONYMIZED_TELEMETRY=FALSE
ALLOW_RESET=TRUE
```

## Notes

- Mount a persistent volume for the Chroma service.
- Point `CHROMA_URL` at the Render private network hostname for the Chroma service.
- Set `OPENROUTER_REFERER` to the public Render URL of the web service.
- The widget script should be served from the same deployed web domain.
- Keep auto deploy enabled from GitHub so pushes to `main` trigger new deployments.
