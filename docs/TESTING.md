# Testing Strategy

## Automated Tests

| Category | Command | Coverage |
| --- | --- | --- |
| Unit | `npm run test:unit` | RBAC permission matrix and tenant membership rules |
| Integration | `npm run test:integration` | Prisma schema and migration tenant constraints |
| API | `npm run test:api` | Auth/admin route contracts and error handling |
| E2E | `npm run test:e2e` | Primary route workflow presence |
| Performance | `npm run test:performance` | Tenant lookup indexes |
| Security | `npm run test:security` | Protected API authorization and scoped store calls |
| Coverage | `npm run test:coverage` | Node built-in coverage report |

## Manual QA Checklist

1. Login as super admin and verify all companies, users, bots, and global analytics are visible.
2. Login as company admin and verify only Acme users, bots, and analytics are visible.
3. Try to open a foreign bot id as company admin and verify `404` or no data.
4. Upload a document to a company bot and confirm it appears only for that company.
5. Ask a supported question and verify citations.
6. Ask an unsupported question and verify the bot refuses unsupported general knowledge.
7. Disable a company user and verify login is blocked.
8. Run Lighthouse/accessibility checks on landing, login, dashboard, users, and bots.

## CI Automation

GitHub Actions runs:

- dependency installation
- TypeScript check
- automated tests
- coverage report
- high-severity dependency audit
- production build

## Performance Testing Plan

For production load validation, run k6 or Artillery against:

- `POST /api/auth/login`
- `GET /api/bots`
- `POST /chat`
- `POST /api/uploads`

Target initial SLOs:

- p95 dashboard API latency under 500 ms
- p95 chat API latency under 6 seconds with model calls
- zero cross-tenant data leakage under concurrent tenant load
