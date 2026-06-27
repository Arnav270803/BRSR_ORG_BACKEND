import { env } from "../../config/env.js";

type InvitationEmailInput = {
  acceptUrl: string;
  companyName: string;
  email: string;
  role: string;
};

type EmailSendResult = {
  sent: boolean;
  error?: string;
};

function isEmailConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY && env.INVITE_FROM_EMAIL);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendInvitationEmail(input: InvitationEmailInput): Promise<EmailSendResult> {
  if (!isEmailConfigured()) {
    return {
      sent: false,
      error: "Email delivery is not configured"
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env.INVITE_FROM_EMAIL,
      to: input.email,
      subject: `Invitation to join ${input.companyName} on BRSR Platform`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #142019; line-height: 1.6;">
          <h2 style="margin: 0 0 12px;">You've been invited to BRSR Platform</h2>
          <p>You have been invited to join <strong>${escapeHtml(input.companyName)}</strong> as <strong>${escapeHtml(input.role)}</strong>.</p>
          <p>
            <a href="${escapeHtml(input.acceptUrl)}" style="display: inline-block; padding: 10px 14px; background: #1f5135; color: #ffffff; text-decoration: none; border-radius: 6px;">
              Accept invitation
            </a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p><a href="${escapeHtml(input.acceptUrl)}">${escapeHtml(input.acceptUrl)}</a></p>
        </div>
      `,
      text: [
        `You have been invited to join ${input.companyName} on BRSR Platform as ${input.role}.`,
        "",
        "Accept invitation:",
        input.acceptUrl
      ].join("\n")
    })
  });

  if (!response.ok) {
    const details = await response.text();
    return {
      sent: false,
      error: details || "Email provider rejected the request"
    };
  }

  return { sent: true };
}
