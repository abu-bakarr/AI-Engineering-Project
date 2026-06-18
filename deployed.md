# Deployment

Optional public deployment target: Railway

## Recommended Railway setup

Create two Railway services in one project:

1. `web`
   - source: this repository
   - build: `Dockerfile`
   - healthcheck: `/health`
2. `chroma`
   - image: `ghcr.io/chroma-core/chroma:0.5.23`

## Required environment variables for `web`

```env
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openrouter/owl-alpha
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
OPENROUTER_DOCUMENT_MODEL=openrouter/free
OPENROUTER_REFERER=https://<your-web-domain>
OPENROUTER_APP_NAME=DSTI RAG Chatbot Platform
CHROMA_URL=http://<your-chroma-service>:8000
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
- Point `CHROMA_URL` at the Railway private network hostname for the Chroma service.
- Set `OPENROUTER_REFERER` to the public Railway URL of the web service.
- The widget script should be served from the same deployed web domain.
