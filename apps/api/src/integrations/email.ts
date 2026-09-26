import type { Logger } from 'pino';
import { Resend } from 'resend';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: 'resend' | 'console';
  send(message: EmailMessage): Promise<void>;
}

/**
 * Development transport: writes the email (including any links) to the server log instead of
 * sending it. It is selected explicitly by configuration and never claims delivery.
 */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console' as const;
  /** Recent messages, used by tests to read verification links. */
  readonly outbox: EmailMessage[] = [];

  constructor(private readonly logger: Logger) {}

  async send(message: EmailMessage): Promise<void> {
    this.outbox.push(message);
    if (this.outbox.length > 50) this.outbox.shift();
    this.logger.info({ to: message.to, subject: message.subject }, `[email:console] not sent\n${message.text}`);
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend' as const;
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) throw new Error(`Resend rejected the email: ${error.message}`);
  }
}

/* --------------------------------- Templates --------------------------------- */

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#fff7f0;font-family:Arial,Helvetica,sans-serif;color:#1f1147">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px">
  <tr><td style="font-size:26px;font-weight:800;color:#ff4d2e">NovaFood</td></tr>
  <tr><td style="padding-top:16px;font-size:20px;font-weight:700">${escape(title)}</td></tr>
  <tr><td style="padding-top:12px;font-size:15px;line-height:1.6">${bodyHtml}</td></tr>
  <tr><td style="padding-top:28px;font-size:12px;color:#7a6f99">You received this because an account on NovaFood uses this address.</td></tr>
  </table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="padding:12px 0"><a href="${escape(href)}" style="background:#ff4d2e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700">${escape(label)}</a></p>
  <p style="font-size:12px;color:#7a6f99">Or paste this link into your browser:<br>${escape(href)}</p>`;
}

export const emailTemplates = {
  verifyEmail(name: string, link: string): Omit<EmailMessage, 'to'> {
    return {
      subject: 'Verify your NovaFood email',
      html: layout(`Hey ${name}, welcome aboard 👋`, `<p>Confirm your email so we can send you order updates.</p>${button(link, 'Verify email')}<p>This link expires in 24 hours.</p>`),
      text: `Hey ${name}, confirm your NovaFood email: ${link}\nThis link expires in 24 hours.`,
    };
  },
  resetPassword(name: string, link: string): Omit<EmailMessage, 'to'> {
    return {
      subject: 'Reset your NovaFood password',
      html: layout('Reset your password', `<p>Hi ${escape(name)}, we received a request to reset your password.</p>${button(link, 'Choose a new password')}<p>This link expires in 30 minutes. If you did not ask for this, you can ignore this email.</p>`),
      text: `Hi ${name}, reset your NovaFood password: ${link}\nThis link expires in 30 minutes. If you did not request it, ignore this email.`,
    };
  },
  orderConfirmed(name: string, orderNumber: string, total: string, link: string): Omit<EmailMessage, 'to'> {
    return {
      subject: `Order ${orderNumber} confirmed`,
      html: layout('Scene sorted! Your order is placed 🎉', `<p>Hi ${escape(name)}, order <b>${escape(orderNumber)}</b> (${escape(total)}) has reached the restaurant.</p>${button(link, 'Track your order')}`),
      text: `Hi ${name}, order ${orderNumber} (${total}) has reached the restaurant. Track it: ${link}`,
    };
  },
};
