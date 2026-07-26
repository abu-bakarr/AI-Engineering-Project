import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("auth API exposes login, logout, and session endpoints", () => {
  assert.match(read("app/api/auth/login/route.ts"), /authenticateUser/);
  assert.match(read("app/api/auth/logout/route.ts"), /clearSessionCookie/);
  assert.match(read("app/api/auth/session/route.ts"), /getSessionFromRequest/);
  assert.match(read("app/api/auth/invitations/accept/route.ts"), /acceptUserInvitation/);
  assert.match(read("app/api/auth/password-reset/request/route.ts"), /startPasswordReset/);
  assert.match(read("app/api/auth/password-reset/verify/route.ts"), /verifyPasswordResetCode/);
  assert.match(read("app/api/auth/password-reset/complete/route.ts"), /completePasswordReset/);
  assert.match(read("app/api/auth/password/change-temporary/route.ts"), /completeTemporaryPasswordChange/);
  assert.match(read("app/api/auth/onboarding/route.ts"), /completeOnboarding/);
});

test("admin APIs return authorization-aware error responses", () => {
  for (const route of [
    "app/api/analytics/route.ts",
    "app/api/companies/route.ts",
    "app/api/integrations/route.ts",
    "app/api/users/route.ts",
    "app/api/users/[id]/route.ts",
  ]) {
    const source = read(route);
    assert.match(source, /authErrorResponse/);
    assert.match(source, /databaseErrorResponse/);
  }
});

test("integration API protects credential configuration", () => {
  const source = read("app/api/integrations/route.ts");
  assert.match(source, /requirePermission\(req, "settings:read"\)/);
  assert.match(source, /requirePermission\(req, "integrations:configure"\)/);
  assert.match(source, /upsertChannelIntegration/);
});

test("user API supports invitation resend and removal actions", () => {
  const source = read("app/api/users/[id]/route.ts");
  assert.match(source, /createUserInvitation/);
  assert.match(source, /sendInvitationEmail/);
  assert.match(source, /credentials/);
  assert.match(source, /removeUser/);
  assert.match(source, /export async function DELETE/);
});
