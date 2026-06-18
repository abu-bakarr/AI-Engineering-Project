# Design and Evaluation

## Objective

This project implements a multi-bot Retrieval-Augmented Generation platform for policy and procedure documents. The repository now satisfies the required project structure for:

- reproducible setup and run instructions
- ingestion and indexing into a vector store
- a corpus-constrained RAG pipeline
- web chat and API routes
- CI on push and pull request
- evaluation scaffolding for groundedness, citation accuracy, and latency

## Architecture

### Application layer

- `app/page.tsx`
  - root web chat interface required by the brief
- `app/bots/*`
  - admin workflows for bot creation, ingestion, status control, embed distribution, and document management
- `public/widget.js`
  - embeddable chat widget for external sites

### API layer

- `app/chat/route.ts`
  - project-facing `/chat` POST route
- `app/health/route.ts`
  - project-facing `/health` JSON route
- `app/api/chat/route.ts`
  - internal chat route used by the widget and admin preview
- `app/api/uploads/route.ts`
  - ingestion and indexing pipeline

### Retrieval layer

- `lib/rag.ts`
  - text extraction
  - chunking
  - embedding
  - Chroma retrieval
  - lexical reranking
  - corpus-only prompting and fallback

### Persistence layer

- `lib/supabase-store.ts`
  - bot metadata
  - document metadata
  - storage object management

## Design choices

### Vector database

ChromaDB was kept as the vector backend because it satisfies the lightweight local-store requirement, integrates cleanly with LangChain, and works well for local development and low-cost deployment.

### Embeddings

OpenRouter-based embeddings remain in place to preserve the existing implementation. This keeps a consistent provider surface for both generation and embeddings while still allowing free-tier model usage.

### Chunking

The current implementation uses `RecursiveCharacterTextSplitter` with:

- chunk size: `1200`
- overlap: `200`

This is a pragmatic default for policy-style prose where sections are often a few paragraphs long and cross references span adjacent text.

### Retrieval

The retrieval path now follows:

1. vector similarity search
2. bot-level filtering
3. lightweight lexical reranking
4. citation/snippet packaging

The reranking step helps align source selection with explicit policy terms in the user query without introducing a paid reranker dependency.

### Guardrails

The main project requirement is corpus-bound answering. The prompt and fallback behavior now enforce:

- no general-knowledge answering
- refusal when context is insufficient
- inline citations with exact source titles
- bounded answer length

### Ingestion

The ingestion layer now accepts:

- PDF
- DOCX
- MD
- TXT
- HTML/HTM

This aligns the app more closely with the file types described in the project brief.

## Evaluation approach

Evaluation artifacts are stored in:

- `evaluation/sample-eval-set.json`
- `scripts/evaluate-rag.mjs`

The evaluation script measures:

- citation accuracy
- heuristic groundedness
- latency (`p50`, `p95`, average)

### Groundedness heuristic

Automatic groundedness is approximated using:

- required answer fragments
- forbidden fragments
- presence of citation objects

This is not a perfect substitute for human review, but it provides a consistent regression check for local iteration and CI-adjacent validation.

### Recommended workflow

1. Start the app locally.
2. Upload the sample corpus in `data/sample-corpus/` to a fresh bot.
3. Run:

```bash
BOT_ID=<your-bot-id> node scripts/evaluate-rag.mjs
```

4. Save the generated JSON/Markdown output as the final submission evidence.

## Current status

What is implemented in the repository:

- RAG application with ingestion, indexing, retrieval, and citations
- `/`, `/chat`, and `/health`
- CI build and typecheck on push/PR
- reproducible setup docs
- design and evaluation artifacts

What still requires environment-backed execution outside this patch:

- final evaluation numbers from a real run
- optional public deployment on Render/Railway
- recorded demo video

Those items depend on your API keys, dataset choice, and deployment account rather than additional local code structure.
