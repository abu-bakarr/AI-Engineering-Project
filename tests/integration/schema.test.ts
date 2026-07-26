import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schema = fs.readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(
  path.join(
    root,
    "prisma/migrations/20260720000000_multi_tenant_saas/migration.sql",
  ),
  "utf8",
);
const enterpriseMigration = fs.readFileSync(
  path.join(
    root,
    "prisma/migrations/20260726010000_enterprise_support_platform/migration.sql",
  ),
  "utf8",
);

test("schema includes company as the tenant root", () => {
  assert.match(schema, /model Company/);
  assert.match(schema, /model AppUser/);
  assert.match(schema, /model TenantActivity/);
});

test("tenant-owned tables carry company references", () => {
  assert.match(schema, /model Bot[\s\S]*companyId\s+String/);
  assert.match(schema, /model BotDocument[\s\S]*companyId\s+String/);
  assert.match(migration, /alter table public\.bots[\s\S]*company_id/);
  assert.match(migration, /alter table public\.bot_documents[\s\S]*company_id/);
});

test("database enforces one-company tenant users", () => {
  assert.match(
    migration,
    /app_users_company_required_for_tenant_users[\s\S]*role <> 'super_admin'/,
  );
});

test("user lifecycle fields support invitations, onboarding, and password reset", () => {
  assert.match(schema, /invitationTokenHash/);
  assert.match(schema, /firstLoginCompletedAt/);
  assert.match(schema, /onboardingCompletedAt/);
  assert.match(schema, /passwordResetCodeHash/);
});

test("enterprise support schema includes tenant-owned conversation and integration models", () => {
  for (const model of [
    "model Contact",
    "model Conversation",
    "model Message",
    "model ChannelIntegration",
    "model Subscription",
    "model CompanySetting",
    "model SLAConfig",
    "model QualityReview",
    "model ApprovalRequest",
    "model SecurityEvent",
  ]) {
    assert.match(schema, new RegExp(model));
  }

  for (const table of [
    "public.conversations",
    "public.messages",
    "public.channel_integrations",
    "public.company_settings",
  ]) {
    assert.match(enterpriseMigration, new RegExp(table));
  }
});

test("conversation modes and webhook idempotency are database constrained", () => {
  assert.match(enterpriseMigration, /conversations_mode_check/);
  assert.match(enterpriseMigration, /AI_ACTIVE/);
  assert.match(enterpriseMigration, /HUMAN_ACTIVE/);
  assert.match(enterpriseMigration, /messages_company_channel_external_key/);
});
