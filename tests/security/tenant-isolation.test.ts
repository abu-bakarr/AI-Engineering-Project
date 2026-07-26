import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("protected bot API routes require RBAC permissions", () => {
  assert.match(read("app/api/bots/route.ts"), /requirePermission\(req, "bots:read"\)/);
  assert.match(read("app/api/bots/route.ts"), /requirePermission\(req, "bots:create"\)/);
  assert.match(read("app/api/bots/[id]/route.ts"), /requirePermission\(_, "bots:read"\)/);
  assert.match(read("app/api/bots/[id]/route.ts"), /requirePermission\(req, "bots:update"\)/);
  assert.match(read("app/api/bots/[id]/route.ts"), /requirePermission\(_, "bots:delete"\)/);
});

test("uploads validate ownership before document attachment", () => {
  const source = read("app/api/uploads/route.ts");
  assert.match(source, /requirePermission\(req, "bots:update"\)/);
  assert.match(source, /getBotById\(botId, session\)/);
  assert.match(source, /appendBotDocuments\(botId, documents, session\)/);
});

test("store methods apply tenant scope in bot queries and mutations", () => {
  const source = read("lib/supabase-store.ts");
  assert.match(source, /function tenantWhere/);
  assert.match(source, /where: \{ id, \.\.\.tenantWhere\(scope\) \}/);
  assert.match(source, /where: \{ botId, \.\.\.tenantWhere\(scope\) \}/);
  assert.match(source, /deleteMany\(\{\s*where: \{ id, \.\.\.tenantWhere\(scope\) \}/);
});

test("conversation APIs require permissions and tenant-scoped data access", () => {
  assert.match(read("app/api/conversations/route.ts"), /requirePermission\(req, "conversations:read"\)/);
  assert.match(read("app/api/conversations/[id]/route.ts"), /requirePermission\(req, "conversations:read"\)/);
  assert.match(read("app/api/conversations/[id]/route.ts"), /requirePermission\(req, "conversations:update"\)/);
  const source = read("lib/supabase-store.ts");
  assert.match(source, /where: \{ id, \.\.\.tenantWhere\(scope\) \}/);
  assert.match(source, /requirePlanFeature\(conversation\.company\.plan, "human_takeover"\)/);
});

test("public chat refuses AI responses while human takeover is active", () => {
  const source = read("app/api/chat/route.ts");
  assert.match(source, /canAiRespondToConversation/);
  assert.match(source, /AI responses are paused while a human agent controls this conversation/);
});

test("Meta webhook routes validate signatures and store inbound messages idempotently", () => {
  const helper = read("app/api/webhooks/meta.ts");
  const store = read("lib/supabase-store.ts");
  assert.match(helper, /x-hub-signature-256/);
  assert.match(helper, /timingSafeEqual/);
  assert.match(store, /companyId_channel_externalMessageId/);
  assert.match(store, /recordInboundChannelMessage/);
});

test("integration credentials are tenant-scoped and returned only as masked metadata", () => {
  const route = read("app/api/integrations/route.ts");
  const store = read("lib/supabase-store.ts");
  assert.match(route, /requirePermission\(req, "integrations:configure"\)/);
  assert.match(store, /getIntegrationTargetCompany/);
  assert.match(store, /canUseChannel\(company\.plan, input\.channel\)/);
  assert.match(store, /createCipheriv\("aes-256-gcm"/);
  assert.match(store, /maskedCredentials/);
});

test("temporary invitation passwords require a first-login password change", () => {
  const auth = read("lib/auth.ts");
  const modal = read("components/FirstLoginPasswordModal.tsx");
  const endpoint = read("app/api/auth/password/change-temporary/route.ts");
  assert.match(auth, /needsPasswordChange/);
  assert.match(modal, /api\/auth\/password\/change-temporary/);
  assert.match(endpoint, /requireSession/);
  assert.match(endpoint, /setSessionCookie/);
});

test("settings access and channel toggles are restricted by role and plan", () => {
  const settings = read("app/settings/page.tsx");
  const integrations = read("components/IntegrationConfigurationPanel.tsx");
  const store = read("lib/supabase-store.ts");
  assert.match(settings, /session\?\.role === "company_admin"/);
  assert.match(settings, /Settings are restricted/);
  assert.match(settings, /isSuperAdmin && \(/);
  assert.match(settings, /channelAvailability/);
  assert.match(settings, /checked=\{checked\}/);
  assert.match(settings, /disabled=\{!allowed\}/);
  assert.match(integrations, /selectedChannelEnabled/);
  assert.match(integrations, /canSaveSelectedChannel/);
  assert.match(integrations, /This channel is turned off for this company/);
  assert.match(store, /canUseMessaging\s*\?\s*target\.whatsappEnabled\s*:\s*false/);
  assert.match(store, /canUseMessaging\s*\?\s*target\.facebookEnabled\s*:\s*false/);
  assert.match(store, /company\.whatsappEnabled/);
  assert.match(store, /company\.facebookEnabled/);
  assert.match(store, /!isSuperAdmin\(scope\.role\)/);
});
