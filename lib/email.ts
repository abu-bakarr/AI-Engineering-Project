type EmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const DEFAULT_APP_URL = "https://customer-ai-powered-agent.onrender.com";

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
}

export function absoluteUrl(path: string) {
  return `${appUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function sendEmail(input: EmailInput): Promise<void> {
  const endpoint = process.env.SMTP_HTTP_ENDPOINT?.trim();
  const token = process.env.SMTP_HTTP_TOKEN?.trim();

  if (!endpoint) {
    console.info("[email:dev]", {
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "SupportAI Agent <no-reply@example.com>",
      ...input,
    }),
  });

  if (!response.ok) {
    throw new Error("Email delivery failed.");
  }
}

export async function sendInvitationEmail(input: {
  to: string;
  name: string;
  dummyPassword: string;
  inviteUrl: string;
}) {
  await sendEmail({
    to: input.to,
    subject: "Your SupportAI Agent invitation",
    text: [
      `Hello ${input.name},`,
      "",
      "An administrator created a SupportAI Agent account for you.",
      `Username: ${input.to}`,
      `Temporary password: ${input.dummyPassword}`,
      "",
      "You can sign in with these temporary credentials. After login, you will be asked to choose a permanent password.",
      "",
      "You can also open this secure link to choose your permanent password directly:",
      input.inviteUrl,
      "",
      "This invitation can be used once.",
    ].join("\n"),
    html: `
      <p>Hello ${input.name},</p>
      <p>An administrator created a SupportAI Agent account for you.</p>
      <p><strong>Username:</strong> ${input.to}<br/><strong>Temporary password:</strong> ${input.dummyPassword}</p>
      <p>You can sign in with these temporary credentials. After login, you will be asked to choose a permanent password.</p>
      <p><a href="${input.inviteUrl}">Choose your permanent password directly</a></p>
      <p>This invitation can be used once.</p>
    `,
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  code: string;
}) {
  await sendEmail({
    to: input.to,
    subject: "Your SupportAI Agent password reset code",
    text: [
      `Hello ${input.name},`,
      "",
      "Use this confirmation code to reset your password:",
      input.code,
      "",
      "The code expires in 15 minutes. If you did not request this, ignore this email.",
    ].join("\n"),
    html: `
      <p>Hello ${input.name},</p>
      <p>Use this confirmation code to reset your password:</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px">${input.code}</p>
      <p>The code expires in 15 minutes. If you did not request this, ignore this email.</p>
    `,
  });
}
