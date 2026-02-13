import { createTransport, type Transporter } from 'nodemailer';
import type { DeliveryProvider, EmailPayload, DeliveryResult } from '@mauntic/domain-kernel/delivery';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class SmtpProvider implements DeliveryProvider<'email'> {
  readonly channel = 'email' as const;
  readonly name = 'smtp';

  private transporter: Transporter;
  private defaultFrom: string;

  constructor(config: SmtpConfig) {
    this.defaultFrom = config.from;
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.auth.user,
        pass: config.auth.pass,
      },
    });
  }

  async send(payload: EmailPayload): Promise<DeliveryResult> {
    try {
      const info = await this.transporter.sendMail({
        from: payload.from || this.defaultFrom,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        replyTo: payload.replyTo,
        headers: payload.headers,
        attachments: payload.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          contentType: a.contentType,
        })),
      });

      return {
        success: true,
        externalId: info.messageId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `SMTP send failed: ${message}`,
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
