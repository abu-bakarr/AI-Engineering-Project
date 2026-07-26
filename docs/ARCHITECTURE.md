# Architecture

## System Context

```mermaid
C4Context
  title SupportAI Agent System Context
  Person(company_admin, "Company Admin", "Manages users, bots, and knowledge")
  Person(company_user, "Company User", "Uses company support bots")
  Person(super_admin, "Super Admin", "Operates the SaaS platform")
  System(supportai, "SupportAI Agent", "Multi-tenant RAG support platform")
  System_Ext(supabase, "Supabase", "Postgres, Storage, optional Auth")
  System_Ext(chroma, "ChromaDB", "Vector search")
  System_Ext(openrouter, "OpenRouter", "LLM and embeddings")
  Rel(company_admin, supportai, "Administers company workspace")
  Rel(company_user, supportai, "Chats with company bots")
  Rel(super_admin, supportai, "Manages all tenants")
  Rel(supportai, supabase, "Stores tenant data and documents")
  Rel(supportai, chroma, "Indexes and retrieves chunks")
  Rel(supportai, openrouter, "Generates grounded answers")
```

## Request Flow

```mermaid
sequenceDiagram
  participant U as User
  participant UI as Next.js UI
  participant API as API Route
  participant RBAC as Session/RBAC
  participant DB as Supabase Postgres
  participant V as ChromaDB
  participant LLM as OpenRouter
  U->>UI: Ask bot question
  UI->>API: POST /chat
  API->>RBAC: Resolve session and tenant
  API->>DB: Load bot within tenant scope
  API->>V: Retrieve document chunks
  API->>LLM: Generate answer from context
  API->>DB: Increment scoped usage
  API-->>UI: Answer + citations + latency
```

## Component Diagram

```mermaid
flowchart TB
  subgraph Frontend
    Landing[Landing page]
    Dashboard[Dashboards]
    Users[User management]
    Bots[Bot management]
    Widget[Embeddable widget]
  end
  subgraph Backend
    Auth[Auth/session]
    RBAC[RBAC policy]
    Store[Tenant-scoped store]
    Upload[Document processing]
    RAG[RAG pipeline]
  end
  Frontend --> Auth
  Auth --> RBAC
  RBAC --> Store
  Bots --> Upload
  Widget --> RAG
  Dashboard --> RAG
```

## Security Architecture

- Tenant-owned rows carry `company_id`.
- API routes call centralized `requirePermission`.
- Store methods apply `tenantWhere(scope)` to bot, document, user, and analytics queries.
- Super admin bypass is explicit in RBAC.
- Company users cannot provide a foreign `companyId` to create resources.
- Session cookies are httpOnly, same-site, signed, and secure in production.
- Prisma is the selected data-access strategy. Supabase is used as hosted Postgres, Storage, and optional password verification infrastructure, not as a competing ORM.
- Conversations, contacts, messages, integrations, settings, subscriptions, usage, SLA, quality, approval, and security records are modeled as tenant-owned tables.

See `docs/ENTERPRISE_SAAS.md` for the role matrix, feature matrix, webhook setup, migrations, and limitations.

## Cloud Architecture

Recommended production topology:

- CDN/WAF in front of Next.js.
- Next.js container on Railway, Render, Vercel, or Kubernetes.
- Supabase Postgres with automated backups and private Storage bucket.
- Chroma Cloud or persistent Chroma service for vectors.
- OpenRouter for model access.
- GitHub Actions for CI, tests, security audit, and build verification.

## Scalability

- Company and document indexes support tenant-filtered queries.
- Vector collections are bot-scoped.
- Upload processing can be moved to background jobs without changing the data model.
- Subscription fields allow usage limits and billing integration later.
