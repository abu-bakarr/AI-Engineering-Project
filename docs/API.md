# API Documentation

All protected routes require the `support_ai_session` httpOnly cookie issued by `POST /api/auth/login`.

## Authentication

### `POST /api/auth/login`

Request:

```json
{ "email": "admin@acme.local", "password": "Password123!" }
```

Response:

```json
{ "session": { "userId": "user-company-admin", "role": "company_admin", "companyId": "company-demo-acme" } }
```

### `GET /api/auth/session`

Returns the authenticated user, role, company id, and company name.

### `POST /api/auth/logout`

Clears the session cookie.

## Companies

### `GET /api/companies`

Super admin only. Returns all companies.

### `POST /api/companies`

Super admin only.

```json
{ "name": "Northwind Support", "plan": "growth", "billingCycle": "monthly" }
```

## Users

### `GET /api/users`

Super admin sees all users. Company admins see only their company users.

### `POST /api/users`

Company admins create users for their own company. Super admins may pass `companyId`.

```json
{ "name": "Jane Doe", "email": "jane@example.com", "role": "company_user" }
```

### `PATCH /api/users/:id`

Updates name, role, or status inside the caller's authorized scope.

## Bots

### `GET /api/bots`

Returns bots visible to the caller. Super admin receives all bots; tenant users receive only their company bots.

### `POST /api/bots`

Creates a bot owned by the caller's company. Super admins may pass `companyId`.

### `GET /api/bots/:id`

Returns one bot only if the caller can access the bot's company.

### `PATCH /api/bots/:id`

Updates metadata, status, or documents only inside tenant scope.

### `DELETE /api/bots/:id`

Deletes a bot and best-effort vector/storage artifacts only inside tenant scope.

## Uploads

### `POST /api/uploads`

Multipart form data:

- `botId`
- `files`
- `richText`

The route validates bot ownership before attaching documents.

## Chat

### `POST /chat` or `POST /api/chat`

```json
{ "botId": "bot-id", "message": "What is the refund policy?" }
```

Dashboard users are tenant-scoped. Public widget calls are allowed only for active bots by exact bot id.

## Analytics

### `GET /api/analytics`

Super admin receives global platform metrics. Tenant users receive only company analytics.
