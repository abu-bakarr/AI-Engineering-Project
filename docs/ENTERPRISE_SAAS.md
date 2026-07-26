# Enterprise SaaS Platform Notes

## Architecture Overview

The application is a Next.js App Router SaaS console with server-side API routes, Prisma data access, Supabase Postgres/Storage infrastructure, ChromaDB vector search, and OpenRouter model calls. The request path is:

```text
Page or widget
  -> Next.js API route
  -> request validation and session lookup
  -> RBAC / subscription entitlement checks
  -> tenant-scoped Prisma data access
  -> Postgres, Supabase Storage, ChromaDB, or OpenRouter
```

## ORM Decision

Selected approach: **Prisma**.

Reason: the project already contains `prisma/schema.prisma`, migration history, generated Prisma client usage, server-side API routes, and repository-style data access in `lib/supabase-store.ts`. Supabase remains infrastructure for Postgres, Storage, and optional password verification, but it is not used as a competing ORM. Tenant security is enforced in API/service code and by database foreign keys, indexes, and constraints.

## Multi-Tenant Security Model

Tenant-owned records carry `company_id`. Authenticated API routes derive the acting company from the signed `support_ai_session` cookie. Company users and company admins never get to choose their tenant scope in API requests; frontend `companyId` values are ignored unless the caller is a Super Admin.

Key helpers:

- `requirePermission()` in `lib/auth.ts`
- `tenantWhere()` and `companyWhere()` in `lib/supabase-store.ts`
- `canAccessTenant()` and role helpers in `lib/rbac.ts`
- `hasFeature()`, `canUseChannel()`, and `canJoinLiveChat()` in `lib/plans.ts`

Direct object access for bots, users, conversations, documents, activity, and analytics uses tenant-scoped Prisma filters. Missing or foreign records return a safe `404` from API routes.

## Roles

| Role | Scope | Main capabilities |
| --- | --- | --- |
| Super Admin | Platform | Companies, users, bots, integrations, plans, analytics, activity |
| Company Admin | Own company | Users, bots, conversations, activity, settings, usage |
| Company User | Own company | Bots, permitted conversations, own support workflows |

Company Admins can create only `company_admin` and `company_user` users. Super Admin changes are intentionally blocked from normal user mutation endpoints and should be handled through a separate audited provisioning workflow.

## Subscription Feature Matrix

| Feature | Starter | Growth | Enterprise |
| --- | --- | --- | --- |
| Website chatbot | Yes | Yes | Yes |
| Bot and knowledge management | Yes | Yes | Yes |
| Basic analytics | Yes | Yes | Yes |
| WhatsApp | No | Yes | Yes |
| Facebook Messenger | No | Yes | Yes |
| Live monitoring and human takeover | No | Yes | Yes |
| Advanced analytics | No | Yes | Yes |
| Routing and escalation | No | Yes | Yes |
| AI quality management | No | No | Yes |
| SLA management | No | No | Yes |
| Custom roles and approvals | No | No | Yes |
| Security and audit center | No | No | Yes |

The source of truth is `PLAN_FEATURES` in `lib/plans.ts`. Backend endpoints must call the helpers before enabling restricted behavior.

## Database Migrations

Important migrations:

- `20260720000000_multi_tenant_saas`: company root, tenant users, tenant activity, bot/document tenant ownership.
- `20260726000000_company_profile_channels`: company profile and channel enablement fields.
- `20260726010000_enterprise_support_platform`: conversations, messages, contacts, integrations, subscriptions, settings, routing, escalation, SLA, quality, approval, usage, and security-event foundations.

Run locally:

```bash
npm run prisma:migrate
npm run prisma:generate
```

## Seed Users

Demo users are inserted by migration:

- `super@supportai.local`
- `admin@acme.local`
- `agent@acme.local`

Default password verification falls back to `DEMO_LOGIN_PASSWORD` when no local password hash is present.

## WhatsApp Configuration

Required environment variables:

- `WHATSAPP_APP_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `INTEGRATION_CREDENTIAL_ENCRYPTION_KEY`

Webhook URL:

```text
/api/webhooks/whatsapp
```

The route validates `x-hub-signature-256`, normalizes inbound messages, looks up the configured company by external account ID, enforces the company plan, and creates messages idempotently by `(company_id, channel, external_message_id)`.

## Facebook Messenger Configuration

Required environment variables:

- `FACEBOOK_APP_ID`
- `FACEBOOK_APP_SECRET`
- `FACEBOOK_VERIFY_TOKEN`
- `FACEBOOK_PAGE_ACCESS_TOKEN`
- `INTEGRATION_CREDENTIAL_ENCRYPTION_KEY`

Webhook URL:

```text
/api/webhooks/facebook
```

The route uses the same signature and idempotency pattern as WhatsApp.

## Local Development

```bash
npm install
npm run prisma:generate
npm run dev
```

Set `DATABASE_URL` or `SUPABASE_DB_URL`, Supabase Storage credentials, OpenRouter credentials, and webhook secrets in `.env`.

## Testing

```bash
npm run test
npx tsc --noEmit
npm run build
```

There is no `lint` script currently defined in `package.json`.

## Deployment Considerations

- Use strong `AUTH_SESSION_SECRET`.
- Store integration tokens in a managed secret store or encrypted credentials table.
- Put CDN/WAF rate limiting in front of public chat and webhook endpoints.
- Apply migrations before deploying API code that expects new tables.
- Use Supabase backups and private Storage buckets.

## Known Limitations

- Outbound WhatsApp/Facebook sending is not fully implemented.
- Real-time inbox updates currently use API refresh foundations; production should add one chosen realtime mechanism.
- Secure Super Admin impersonation is intentionally not enabled.
- Payment provider checkout and invoice flows are not connected.
- Fine-grained custom roles are modeled for Enterprise but not fully exposed in UI.
