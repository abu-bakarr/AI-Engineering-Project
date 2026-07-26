# Contributing

## Workflow

1. Create a feature branch.
2. Keep changes scoped to the requested feature or fix.
3. Run `npm test`, `npx tsc --noEmit`, and `npm run build`.
4. Open a pull request with a clear summary, screenshots for UI changes, and test evidence.

## Coding Standards

- Preserve existing Next.js App Router structure.
- Keep authorization checks in API routes and shared RBAC helpers.
- Do not rely on frontend filtering for tenant isolation.
- Add `companyId` to new tenant-owned models.
- Use Prisma relationships and indexes for tenant-owned resources.
- Keep secrets out of committed files.

## Pull Request Checklist

- [ ] Functional behavior is complete.
- [ ] Tenant isolation is enforced server-side.
- [ ] Tests were added or updated.
- [ ] CI passes.
- [ ] Documentation was updated.
- [ ] Screenshots were attached for UI changes.
