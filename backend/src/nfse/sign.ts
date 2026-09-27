/**
 * XMLDSig da NFS-e Nacional. Port 1:1 de faelith-web/src/nfse/sign.rs.
 *
 * - Perfil usado pelo sistema nacional e pelas implementações de referência: C14N 1.0 inclusivo,
 *   transform enveloped-signature, digest SHA-1, assinatura RSA-SHA1, X509Certificate no KeyInfo
 * - O elemento assinado (infDPS / infPedReg) já é renderizado canônico por `dps.ts`, e o SignedInfo é
 *   montado aqui já canônico, então nenhum canonicalizador XML genérico é necessário
 * - Certificado e chave vêm em PEM (converta o .pfx uma vez com OpenSSL)
 */
import { createHash, createPrivateKey, createSign, KeyObject, X509Certificate } from 'crypto';

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const DSIG_NS = 'http://www.w3.org/2000/09/xmldsig#';

/** SignedInfo canônico (o C14N expande elementos vazios e declara o namespace no ápice). */
export function signedInfo(id: string, digestB64: string): string {
  return `<SignedInfo xmlns="${DSIG_NS}"><CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod><SignatureMethod Algorithm="${DSIG_NS}rsa-sha1"></SignatureMethod><Reference URI="#${id}"><Transforms><Transform Algorithm="${DSIG_NS}enveloped-signature"></Transform><Transform Algorithm="${C14N}"></Transform></Transforms><DigestMethod Algorithm="${DSIG_NS}sha1"></DigestMethod><DigestValue>${digestB64}</DigestValue></Reference></SignedInfo>`;
}

/** Primeiro bloco `CERTIFICATE` de um bundle PEM. */
function firstCertificate(pem: string): string {
  const begin = '-----BEGIN CERTIFICATE-----';
  const end = '-----END CERTIFICATE-----';
  const start = pem.indexOf(begin);
  if (start < 0) throw new Error('nenhum certificado no PEM da NFS-e');
  const stop = pem.indexOf(end, start);
  if (stop < 0) throw new Error('certificado incompleto no PEM da NFS-e');
  return pem.slice(start, stop + end.length);
}

/** Identidade de assinatura: chave privada RSA + certificado folha (DER) enviado no KeyInfo. */
export class SigningIdentity {
  /** Segundos Unix a partir dos quais o certificado deixa de valer. */
  readonly notAfter: number;
  /** Subject do certificado (para a página de status do admin). */
  readonly subject: string;

  private constructor(private key: KeyObject, private certDer: Buffer, notAfter: number, subject: string) {
    this.notAfter = notAfter;
    this.subject = subject;
  }

  /** Carrega a chave PKCS#8 (ou PKCS#1) RSA e o certificado folha a partir de PEM. Numa cadeia, o primeiro é o da empresa. */
  static fromPem(certPem: string, keyPem: string): SigningIdentity {
    let key: KeyObject;
    try {
      key = createPrivateKey(keyPem);
    } catch {
      throw new Error('a chave privada da NFS-e não é um PEM RSA PKCS#8 ou PKCS#1');
    }
    if (key.asymmetricKeyType !== 'rsa') throw new Error('a chave privada da NFS-e não é RSA');
    let cert: X509Certificate;
    try {
      cert = new X509Certificate(firstCertificate(certPem));
    } catch (e) {
      throw new Error(e instanceof Error && e.message.includes('NFS-e') ? e.message : 'o PEM do certificado da NFS-e é inválido');
    }
    return new SigningIdentity(key, cert.raw, Math.floor(new Date(cert.validTo).getTime() / 1000), cert.subject.replace(/\n/g, ', '));
  }

  /** Monta a identidade a partir de chave e certificado em memória (testes). */
  static fromParts(key: KeyObject, certDer: Buffer, subject = 'test'): SigningIdentity {
    return new SigningIdentity(key, certDer, Number.MAX_SAFE_INTEGER, subject);
  }

  /** Retorna o elemento `<Signature>` para o elemento canônico `canonical` cujo Id é `id`. */
  signatureFor(id: string, canonical: string): string {
    const digest = createHash('sha1').update(canonical, 'utf8').digest('base64');
    const info = signedInfo(id, digest);
    const value = createSign('RSA-SHA1').update(info, 'utf8').sign(this.key).toString('base64');
    // O SignedInfo dentro de Signature é serializado sem o próprio xmlns (herdado de Signature).
    const inner = info.replace(` xmlns="${DSIG_NS}"`, '');
    return `<Signature xmlns="${DSIG_NS}">${inner}<SignatureValue>${value}</SignatureValue><KeyInfo><X509Data><X509Certificate>${this.certDer.toString('base64')}</X509Certificate></X509Data></KeyInfo></Signature>`;
  }
}
