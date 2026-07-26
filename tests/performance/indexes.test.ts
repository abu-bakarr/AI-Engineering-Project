import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "prisma/migrations/20260720000000_multi_tenant_saas/migration.sql",
  ),
  "utf8",
);

test("tenant lookup paths have supporting indexes", () => {
  for (const index of [
    "bots_company_created_at_idx",
    "bot_documents_company_uploaded_at_idx",
    "app_users_company_role_idx",
    "tenant_activity_company_created_at_idx",
  ]) {
    assert.match(migration, new RegExp(index));
  }
});
