import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Gmail SMTP. No sandbox restrictions — sends to anyone.
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  const { to, subject, text, html, replyTo } = params;

  try {
    const info = await transporter.sendMail({
      from: `"Eventiq" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html: html || undefined,
      replyTo: replyTo || undefined,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email send failed',
    };
  }
}

/**
 * Send an email with conversation context (for vendor/speaker follow-ups).
 */
export async function sendConversationEmail(params: {
  to: string;
  subject: string;
  body: string;
  previousMessageId?: string;
}): Promise<EmailResult> {
  const { to, subject, body, previousMessageId } = params;

  try {
    const mailOptions: nodemailer.SendMailOptions = {
      from: `"Eventiq" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text: body,
      html: `<div style="font-family: sans-serif; line-height: 1.6;">${body.replace(/\n/g, '<br>')}</div>`,
    };

    // Thread emails together using In-Reply-To header
    if (previousMessageId) {
      mailOptions.headers = {
        'In-Reply-To': previousMessageId,
        'References': previousMessageId,
      };
    }

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Email send failed',
    };
  }
}

/**
 * Verify SMTP connection is working.
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
