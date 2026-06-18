# DSTI RAG Chatbot Platform

A platform for creating document-backed chatbots that can be embedded on any website. Upload documents, configure your bot, and let it answer questions strictly from the content you provide.

## Features

- **Bot Management**: Create and configure multiple chatbots from a single dashboard
- **Document Ingestion**: Upload PDF, DOCX, Markdown, text, and HTML documents with automatic text extraction
- **Vector Search**: Semantic search powered by ChromaDB for accurate context retrieval
- **Supabase Persistence**: Bots and document metadata are stored in Supabase tables
- **Embeddable Widget**: Drop a single script tag into any site to add a chat interface
- **Fallback Search**: Keyword-based retrieval when ChromaDB is unavailable
- **Document Preview**: View uploaded documents directly in the admin panel
- **Structured Citations**: Chat responses include retrieved citation snippets and latency metadata

## Project Deliverables

This repository includes the project artifacts requested by the AI Engineering Project brief:

- [README.md](README.md)
- [design-and-evaluation.md](design-and-evaluation.md)
- [ai-tooling.md](ai-tooling.md)
- [.github/workflows/ci.yml](.github/workflows/ci.yml)
- [evaluation/sample-eval-set.json](evaluation/sample-eval-set.json)
- [scripts/evaluate-rag.mjs](scripts/evaluate-rag.mjs)
- [data/sample-corpus](data/sample-corpus)
- [railway.json](railway.json)
- [deployed.md](deployed.md)

## Required Routes

- `/` - primary web chat interface
- `/chat` - POST RAG endpoint
- `/health` - JSON health endpoint
- `/bots` - admin workspace

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Vector Store**: ChromaDB
- **Database**: Supabase
- **LLM & Embeddings**: OpenRouter (via LangChain)
- **Document Parsing**: LlamaIndex LiteParse, pdf-parse, PaddleOCR

## Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose
- An [OpenRouter](https://openrouter.ai) API key
- A [Supabase](https://supabase.com) project URL and service role key

## Docker Compose Deployment

This is the recommended way to run the application for both development and production.

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd dsti_rag_chatbot_platform
    ```

2.  **Set up environment variables:**
    Create a `.env` file by copying the example file:

    macOS/Linux:
    ```bash
    cp .env.example .env
    ```

    Windows PowerShell:
    ```powershell
    Copy-Item .env.example .env
    ```

    Now, edit the `.env` file and add your OpenRouter API key:
    ```env
    OPENROUTER_API_KEY=your_openrouter_api_key
    SUPABASE_URL=https://your-project.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    # ... other variables are pre-configured for Docker Compose
    ```

3.  **Build and run the application:**
    ```bash
    docker-compose up --build
    ```
    This command will:
    - Build the Next.js application Docker image.
    - Pull the ChromaDB image.
    - Start both services and connect them.

    The application will be available at [http://localhost:3001](http://localhost:3001).

## Manual Installation (Without Docker)

If you prefer to run the services manually:

### Prerequisites

- Node.js 18+
- Python 3.8+ if you want to use the Python Chroma CLI directly
- Poppler utilities (`pdftoppm`) for OCR fallback on scanned/image-only PDFs
- Tesseract English language data (`eng.traineddata`) for LiteParse OCR fallback
- An [OpenRouter](https://openrouter.ai) API key
- A Supabase project URL and service role key
- A Supabase database connection string if you want to reset tables from npm

### Supabase Setup

1. Create a Supabase project from the Supabase dashboard.

2. Open **Project Settings > API**.

3. Copy the project URL into `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
```

Use the API project URL here, not the Postgres connection string.

4. Copy the `service_role` key into `.env`:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Keep this key server-side only. Do not expose it with a `NEXT_PUBLIC_` prefix.

5. Copy the database connection string into `.env` if you want to reset tables from npm:

```env
SUPABASE_DB_URL=postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres
```

Use the URI connection string from **Project Settings > Database**. Keep it server-side only.

6. Open **SQL Editor** in Supabase.

7. Run the schema in [supabase/schema.sql](supabase/schema.sql). It creates:

- `bots`: bot profile, status, colors, and query count
- `bot_documents`: document metadata, extracted content, hashes, and Supabase Storage object paths
- Supabase Storage bucket `bot-documents`: original uploaded files

8. Confirm both tables exist in **Table Editor**.

9. Confirm the private `bot-documents` bucket exists in **Storage**.

10. Start the app with `npm run dev` and create a bot. The dashboard should read from Supabase immediately.

To drop and recreate the Supabase tables from your terminal:

```bash
npm run db:reset:supabase
```

This runs [supabase/reset.sql](supabase/reset.sql), which deletes all bot and document rows before recreating the tables.

### Installation

Install dependencies:

```bash
npm install
```

The project installs the Chroma JavaScript CLI through npm. If you prefer to run Chroma with Python instead, install it separately:

```bash
pip install chromadb
```

Set up environment variables by creating a `.env` file:

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then edit `.env`:

```env
# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/auto
OPENROUTER_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
OPENROUTER_DOCUMENT_MODEL=openrouter/free
OPENROUTER_REFERER=http://localhost:3001

# ChromaDB
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=dsti_rag_docs

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres
SUPABASE_STORAGE_BUCKET=bot-documents
```

### PaddleOCR Fallback

The upload pipeline first tries native text extraction for PDFs and DOCX files. If the extracted text is too small, it falls back to PaddleOCR so scanned PDFs and DOCX files made from embedded images can still be converted to text before vector indexing.

Install the PaddleOCR model assets locally:

```text
rag/ocr-models/
├── PP-OCRv5_mobile_det_infer.onnx
├── PP-OCRv5_mobile_rec_infer.onnx
└── ppocrv5_dict.txt
```

You can override those paths with:

```env
PADDLEOCR_MODEL_DIR=rag/ocr-models
PADDLEOCR_DETECTION_MODEL=rag/ocr-models/PP-OCRv5_mobile_det_infer.onnx
PADDLEOCR_RECOGNITION_MODEL=rag/ocr-models/PP-OCRv5_mobile_rec_infer.onnx
PADDLEOCR_DICTIONARY=rag/ocr-models/ppocrv5_dict.txt
DOCUMENT_OCR_TIMEOUT_MS=120000
OCR_MIN_TEXT_LENGTH=40
```

If Tesseract language data is installed outside the standard system paths, set:

```env
TESSDATA_PREFIX=/path/to/tessdata
```

### Running the Application

**Development**

```bash
npm run dev
```

Starts ChromaDB on [http://localhost:8000](http://localhost:8000) and Next.js on [http://localhost:3001](http://localhost:3001).

Use [http://localhost:3001](http://localhost:3001) for the project chat interface and [http://localhost:3001/bots](http://localhost:3001/bots) for the admin workspace.

If port 8000 is already used by a non-Chroma process, `npm run dev` still starts Next.js and the app falls back to local keyword retrieval when Chroma is unavailable. Stop the process using port 8000 when you want semantic indexing and retrieval.

If optional native packages are missing, `npm run dev` warns and continues so the app still starts. Install them manually with:

```bash
npm install --include=optional
```

To allow the dev script to attempt that install automatically, run:

```bash
AUTO_INSTALL_NATIVE_DEPS=1 npm run dev
```

macOS/Linux:

```bash
lsof -nP -iTCP:8000 -sTCP:LISTEN
```

Windows PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 8000 | Select-Object LocalAddress,LocalPort,OwningProcess
Stop-Process -Id <PID>
```

**Production**

```bash
npm run build
npm start
```

For production, run ChromaDB as a separate persistent service and set `CHROMA_URL` accordingly.

## Evaluation

After creating a bot and uploading the files in `data/sample-corpus/`, run:

```bash
BOT_ID=<your-bot-id> node scripts/evaluate-rag.mjs
```

Optional environment variables:

```env
EVAL_BASE_URL=http://localhost:3001
EVAL_FILE=evaluation/sample-eval-set.json
```

The script reports:

- heuristic groundedness
- citation accuracy
- latency average, p50, and p95
- per-question citation snippets
- JSON and Markdown reports written to `evaluation/reports/`

## CI

GitHub Actions is configured in `.github/workflows/ci.yml` and runs on both push and pull request:

- `npm ci`
- `npx tsc --noEmit`
- `npm run build`

## Railway Deployment

Railway deployment scaffolding is included:

- [railway.json](railway.json)
- [deployed.md](deployed.md)

The recommended production layout is:

1. a `web` service for the Next.js app using the repository `Dockerfile`
2. a separate `chroma` service with persistent storage

## Project Structure

```
dsti_rag_chatbot_platform/
├── app/
│   ├── api/
│   │   ├── bots/            # Bot CRUD endpoints
│   │   ├── chat/            # Chat inference endpoint
│   │   ├── uploads/         # Document upload endpoint
│   │   └── widget/          # Widget config endpoint
│   ├── bots/                # Bot detail, docs, and embed pages
│   ├── dashboard/           # Main dashboard
│   └── settings/            # App settings
├── components/              # Reusable UI components
├── lib/
│   ├── rag.ts               # RAG pipeline (indexing, retrieval, inference)
│   ├── documents.ts         # Document processing helpers
│   ├── supabase-store.ts    # Supabase-backed bot and document persistence
│   └── types.ts             # Shared TypeScript types
├── public/
│   └── widget.js            # Embeddable chat widget
├── rag/
│   ├── uploads/             # Stored document files
│   └── dataStore/           # ChromaDB data
├── supabase/
│   └── schema.sql           # Database tables for bots and bot documents
└── scripts/
    ├── dev-with-chroma.mjs  # Cross-platform dev startup script
    └── dev-with-chroma.sh   # Legacy Unix shell startup script
```

## Embedding a Bot

Once a bot is created and has documents indexed, paste this into any HTML page:

```html
<script
  src="https://your-domain.com/widget.js"
  data-bot-id="<your-bot-id>"
  defer
></script>
```

## User Roles

The platform currently supports:

- **Admin**: Full access to create, configure, and manage bots
- **Public**: Interact with embedded bots on external sites

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

[WIP]

## Support

For support and questions, please contact [dsti.gov.sl].
