import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { isProd } from '../config/env';

@Injectable()
export class MailService {
  private log = new Logger('Mail');
  private transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  private from = process.env.MAIL_FROM ?? 'MedTrouxa <nao-responda@medtrouxa.com.br>';

  async send(to: string, subject: string, text: string, html?: string) {
    if (!this.transport) {
      if (isProd()) throw new Error('SMTP não configurado');
      this.log.warn(`[DEV] e-mail não enviado (sem SMTP_URL). Para: ${to} | ${subject}\n${text}`);
      return;
    }
    await this.transport.sendMail({ from: this.from, to, subject, text, html });
  }
}
