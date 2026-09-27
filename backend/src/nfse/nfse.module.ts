/**
 * Emissor de NFS-e Nacional: módulo, ganchos do webhook de pagamento, worker em segundo plano, e-mails ao comprador
 * e rotas. Port de faelith-web/src/nfse/mod.rs + routes.rs.
 *
 * - Os ganchos rodam ANTES da liberação do acesso e são idempotentes: se falharem, o webhook responde 500 e o
 *   Mercado Pago reentrega o evento sem efeitos duplicados
 * - O worker reserva documentos vencidos a cada 30 s enquanto o emissor está ligado (NFSE_ENABLED=1); os documentos
 *   são enfileirados mesmo com ele desligado, então o acumulado é emitido quando ele for ligado
 * - O comprador recebe e-mail quando a nota é emitida (com PDF e XML anexados) e quando falta CPF / CNPJ
 */
import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Logger, Module, NotFoundException,
  OnApplicationShutdown, OnModuleInit, Param, ParseUUIDPipe, Post, Put, Query, Res, ServiceUnavailableException, BadGatewayException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { DataSource, Repository } from 'typeorm';
import { AuthModule } from '../auth/auth.module';
import { AdminOnly, CurrentUser, JwtUser } from '../common/auth';
import { appUrl, isProd } from '../config/env';
import { User } from '../database/entities';
import { securityEvent } from '../security/logging';
import { MailService } from '../security/mail';
import { verifyPassword } from '../security/password';
import { RateLimit } from '../security/rate-limit';
import { MfaMethod, TwoFactorService } from '../security/twofactor';
import { LiveGateway } from './client';
import { nfseConfigFromEnv } from './config';
import { digits, validCnpj, validCpf } from './dps';
import { BcbPtax } from './ptax';
import { documentFromCharge, identityFromPayer, Notice, NfseService, onReversal, PaidCharge, saveIdentity } from './service';
import { SigningIdentity } from './sign';
import { simulatedConfig, simulatedIdentity, SimulatedGateway } from './simulated';
import { NfseDocument, PostgresNfse, status } from './store';

/** Intervalo do worker. */
const WORKER_INTERVAL_MS = 30_000;
/** Documentos processados por ciclo. */
const WORKER_BATCH = 20;

/** Monta o emissor quando NFSE_ENABLED=1 (ou =simulate em dev); configuração errada derruba o processo (fail fast). */
function buildService(): NfseService | null {
  const flag = process.env.NFSE_ENABLED?.trim();
  if (flag === 'simulate') {
    if (isProd()) throw new Error('NFSE_ENABLED=simulate é proibido em produção');
    return new NfseService(simulatedConfig(), simulatedIdentity(), new SimulatedGateway(), new BcbPtax());
  }
  const config = nfseConfigFromEnv();
  if (!config) return null;
  const identity = SigningIdentity.fromPem(config.certPem, config.keyPem);
  if (identity.notAfter < Date.now() / 1000) throw new Error('o certificado da NFS-e expirou; renove o certificado A1');
  const gateway = new LiveGateway(config.environment, config.keyPem, config.certPem, config.caBundlePem);
  return new NfseService(config, identity, gateway, new BcbPtax());
}

@Injectable()
export class NfseEngine implements OnModuleInit, OnApplicationShutdown {
  private log = new Logger('NFS-e');
  readonly store: PostgresNfse;
  readonly service: NfseService | null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(@InjectDataSource() db: DataSource, private mail: MailService) {
    this.store = new PostgresNfse(db);
    try {
      this.service = buildService();
    } catch (e) {
      this.log.error(`configuração inválida: ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    }
  }

  get series() { return this.service?.config.series ?? Number(process.env.NFSE_SERIES ?? 1); }

  onModuleInit() {
    if (!this.service) { this.log.log('emissor desligado (NFSE_ENABLED != 1); pagamentos continuam sendo enfileirados'); return; }
    this.log.log(`emissor ligado (${process.env.NFSE_ENABLED === 'simulate' ? 'SIMULAÇÃO' : this.service.config.environment})`);
    this.timer = setInterval(() => void this.tick(), WORKER_INTERVAL_MS);
    setTimeout(() => void this.tick(), 3_000);
  }

  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }

  /** Um ciclo do worker (sem sobreposição dentro do processo; entre processos, o SKIP LOCKED garante exclusividade). */
  async tick() {
    if (!this.service || this.running) return;
    this.running = true;
    try {
      const due = await this.store.claimDue(new Date(), WORKER_BATCH);
      for (const doc of due) {
        try {
          this.sendNotice(await this.service.process(this.store, doc));
        } catch (e) {
          this.log.error(`processamento falhou (${doc.id}): ${e instanceof Error ? e.message : e}`);
        }
      }
    } catch (e) {
      this.log.error(`reserva falhou: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }

  // ---------------- ganchos do webhook ----------------

  /** Pagamento aprovado: enfileira a nota (idempotente) e guarda o CPF/CNPJ do pagador, se houver. */
  async onPaid(charge: PaidCharge) {
    const identity = identityFromPayer(charge.userId, charge.payerIdentification);
    if (identity) await saveIdentity(this.store, identity);
    const doc = documentFromCharge(charge, this.series);
    if (doc) await this.store.enqueue(doc);
  }

  /** Estorno ou chargeback. */
  onReversal(paymentId: string, full: boolean, reason: string) {
    return onReversal(this.store, paymentId, full, reason);
  }

  // ---------------- e-mails ----------------

  /** Envia ao comprador o aviso da nota emitida (com PDF e XML) ou do CPF faltante (melhor esforço). */
  private sendNotice(notice: Notice) {
    if (notice.kind === 'none') return;
    const origin = appUrl();
    void (async () => {
      if (notice.kind === 'needsTaxId') {
        await this.mail.send(notice.email, 'MedTrouxa: informe seu CPF para emitirmos a nota fiscal',
          `Recebemos seu pagamento. Para emitir a nota fiscal (NFS-e), informe seu CPF (ou o CNPJ da empresa) em ${origin}/planos\n`,
          `<p>Recebemos seu pagamento. Para emitir a nota fiscal (NFS-e), informe seu <strong>CPF</strong> (ou o CNPJ da empresa) em <a href="${origin}/planos">Assinatura e notas fiscais</a>.</p>`);
        return;
      }
      const doc = await this.store.get(notice.docId);
      const attachments: { filename: string; content: Buffer | string; contentType: string }[] = [];
      if (doc?.nfseXml) attachments.push({ filename: `nfse-${notice.number}.xml`, content: doc.nfseXml, contentType: 'application/xml' });
      if (doc?.accessKey && this.service) {
        const pdf = await this.service.danfse(doc.accessKey).catch((e) => { this.log.warn(`DANFSe indisponível para o e-mail: ${e}`); return null; });
        if (pdf) attachments.push({ filename: `nfse-${notice.number}.pdf`, content: pdf, contentType: 'application/pdf' });
      }
      await this.mail.send(notice.email, `MedTrouxa: nota fiscal (NFS-e) nº ${notice.number} emitida`,
        `Sua nota fiscal de serviço eletrônica nº ${notice.number} foi emitida.\nO PDF (DANFSe) e o XML estão anexados a este e-mail e também disponíveis em ${origin}/planos\n`,
        `<p>Sua nota fiscal de serviço eletrônica nº <strong>${notice.number}</strong> foi emitida.</p><p>O PDF (DANFSe) e o XML estão anexados a este e-mail e também disponíveis em <a href="${origin}/planos">Assinatura e notas fiscais</a>.</p>`,
        attachments);
    })().catch((e) => this.log.warn(`e-mail de aviso da NFS-e falhou: ${e}`));
  }
}

// ---------------- rotas (port de routes.rs) ----------------

/** Visão pública de um documento (sem XML). */
function docJson(d: NfseDocument) {
  return {
    id: d.id, status: d.status, number: d.nfseNumber, access_key: d.accessKey, dps_id: d.dpsId, source_id: d.sourceId,
    amount_usd_cents: d.amountUsdCents, amount_brl_cents: d.amountBrlCents, ptax_rate: d.ptaxRate,
    buyer_name: (d.buyer as Record<string, unknown>).name ?? null,
    buyer_country: ((d.buyer as Record<string, unknown>).address as Record<string, unknown> | undefined)?.country ?? null,
    attempts: d.attempts, last_error: d.lastError, paid_at: d.paidAt.toISOString(), issued_at: d.issuedAt?.toISOString() ?? null,
    canceled_at: d.canceledAt?.toISOString() ?? null, created_at: d.createdAt.toISOString(),
  };
}

class IdentityDto { @IsIn(['cpf', 'cnpj']) doc_type: 'cpf' | 'cnpj'; @IsString() @MaxLength(32) doc_number: string }
class AdminActionDto {
  @IsOptional() @IsString() @MaxLength(255) reason?: string;
  @IsString() @MaxLength(128) password: string;
  @IsOptional() @IsIn(['totp', 'email', 'recovery']) method?: MfaMethod;
  @IsOptional() @IsString() @Length(6, 12) code?: string;
}

@Controller()
class NfseController {
  constructor(private engine: NfseEngine, @InjectRepository(User) private users: Repository<User>, private twoFactor: TwoFactorService) {}

  /** Serve o XML da NFS-e ou o PDF do DANFSe de um documento. */
  private async download(doc: NfseDocument, kind: string, res: Response) {
    if (kind === 'xml') {
      if (!doc.nfseXml) throw new NotFoundException('a nota ainda não foi emitida');
      res.set({ 'content-type': 'application/xml; charset=utf-8', 'content-disposition': `attachment; filename="nfse-${doc.nfseNumber ?? ''}.xml"` });
      return res.send(doc.nfseXml);
    }
    if (kind === 'pdf') {
      if (!this.engine.service || !doc.accessKey) throw new ServiceUnavailableException('o PDF da nota não está disponível');
      let pdf: Buffer;
      try { pdf = await this.engine.service.danfse(doc.accessKey); }
      catch { throw new BadGatewayException('o sistema nacional não devolveu o PDF; tente novamente mais tarde'); }
      res.set({ 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="nfse-${doc.nfseNumber ?? ''}.pdf"` });
      return res.send(pdf);
    }
    throw new NotFoundException();
  }

  /** GET /api/billing/nfse — notas do usuário e identidade fiscal (mascarada). */
  @Get('billing/nfse')
  async myNotes(@CurrentUser() u: JwtUser) {
    const docs = await this.engine.store.list(null, u.sub, 200);
    const identity = await this.engine.store.getIdentity(u.sub);
    return {
      notes: docs.filter((d) => d.status !== status.VOIDED).map(docJson),
      identity: identity ? { doc_type: identity.docType, doc_number: `***${identity.docNumber.slice(-2)}` } : null,
    };
  }

  /** PUT /api/billing/fiscal-identity — CPF ou CNPJ usado nas notas do usuário (retoma as notas que esperavam). */
  @Put('billing/fiscal-identity') @RateLimit({ limit: 10, windowSec: 600, key: 'user' })
  async setIdentity(@CurrentUser() u: JwtUser, @Body() body: IdentityDto) {
    const number = digits(body.doc_number);
    const valid = body.doc_type === 'cpf' ? validCpf(number) : validCnpj(number);
    if (!valid) throw new BadRequestException('CPF ou CNPJ inválido');
    const resumed = await saveIdentity(this.engine.store, { customerId: u.sub, userId: u.sub, docType: body.doc_type, docNumber: number, updatedAt: new Date() });
    return { saved: true, resumed };
  }

  /** GET /api/billing/nfse/:id/:kind — apenas as notas do próprio usuário. */
  @Get('billing/nfse/:id/:kind')
  async myDownload(@CurrentUser() u: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Param('kind') kind: string, @Res() res: Response) {
    const doc = await this.engine.store.get(id);
    if (!doc || doc.userId !== u.sub) throw new NotFoundException();
    return this.download(doc, kind, res);
  }

  /** GET /api/admin/nfse — documentos e status do emissor / certificado. */
  @AdminOnly() @Get('admin/nfse')
  async adminList(@Query('status') s?: string) {
    const docs = await this.engine.store.list(s && Object.values(status).includes(s as never) ? s : null, null, 300);
    const svc = this.engine.service;
    const emitter = svc ? {
      environment: process.env.NFSE_ENABLED === 'simulate' ? 'simulacao' : svc.config.environment === 'production' ? 'producao' : 'homologacao',
      cnpj: svc.config.seller.cnpj, series: svc.config.series, trib_nac: svc.config.service.national, nbs: svc.config.service.nbs,
      certificate_subject: svc.certificate().subject,
      certificate_expires_at: svc.certificate().notAfter < Number.MAX_SAFE_INTEGER ? new Date(svc.certificate().notAfter * 1000).toISOString() : null,
    } : null;
    return { enabled: !!emitter, emitter, documents: docs.map(docJson) };
  }

  /** GET /api/admin/nfse/:id/:kind. */
  @AdminOnly() @Get('admin/nfse/:id/:kind')
  async adminDownload(@Param('id', ParseUUIDPipe) id: string, @Param('kind') kind: string, @Res() res: Response) {
    const doc = await this.engine.store.get(id);
    if (!doc) throw new NotFoundException();
    return this.download(doc, kind, res);
  }

  /** POST /api/admin/nfse/:id/:action (retry|cancel) — exige reautenticação (senha + 2FA se ativo) e fica auditado. */
  @AdminOnly() @Post('admin/nfse/:id/:action') @RateLimit({ limit: 20, windowSec: 600, key: 'user' })
  async adminAction(@CurrentUser() admin: JwtUser, @Param('id', ParseUUIDPipe) id: string, @Param('action') action: string, @Body() body: AdminActionDto) {
    if (action !== 'retry' && action !== 'cancel') throw new NotFoundException();
    const me = await this.users.findOne({ where: { id: admin.sub }, select: ['id', 'passwordHash', 'twoFactorMethod'] });
    if (!me || !(await verifyPassword(body.password, me.passwordHash))) throw new UnauthorizedException('Reautenticação necessária: senha incorreta');
    if (me.twoFactorMethod === 'totp' || body.method === 'recovery') {
      if (!body.method || !body.code || !(await this.twoFactor.verify(admin.sub, body.method, body.code))) {
        throw new UnauthorizedException('Reautenticação necessária: informe o código do seu app autenticador');
      }
    }
    const doc = await this.engine.store.get(id);
    if (!doc) throw new NotFoundException();
    let next: string;
    if (action === 'retry' && ([status.REJECTED, status.PENDING_DATA, status.QUEUED] as string[]).includes(doc.status)) next = status.QUEUED;
    else if (action === 'retry' && doc.status === status.CANCEL_FAILED) next = status.CANCEL_QUEUED;
    else if (action === 'cancel' && ([status.ISSUED, status.NEEDS_REVIEW, status.CANCEL_FAILED] as string[]).includes(doc.status) && doc.accessKey) next = status.CANCEL_QUEUED;
    else throw new ConflictException('esta ação não se aplica à situação atual da nota');
    if (action === 'cancel') {
      const reason = (body.reason ?? '').trim();
      if ([...reason].length < 15) throw new BadRequestException('o motivo do cancelamento precisa de pelo menos 15 caracteres');
      doc.cancelReason = [...reason].slice(0, 255).join('');
    }
    doc.status = next;
    doc.attempts = 0;
    doc.nextAttemptAt = new Date();
    await this.engine.store.save(doc);
    securityEvent(`admin.nfse.${action}`, { admin: admin.sub, document: doc.id, source: doc.sourceId, reason: doc.cancelReason });
    void this.engine.tick();
    return { status: doc.status };
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  controllers: [NfseController],
  providers: [NfseEngine],
  exports: [NfseEngine],
})
export class NfseModule {}
