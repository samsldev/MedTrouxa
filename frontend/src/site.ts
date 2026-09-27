/**
 * Dados institucionais exibidos no rodapé. Campos vazios não aparecem.
 * Configure via variáveis de ambiente do Vite (VITE_*) no build.
 */
const env = import.meta.env;

export const SITE = {
  name: 'MedTrouxa',
  legalName: env.VITE_LEGAL_NAME ?? '',
  cnpj: env.VITE_CNPJ ?? '',
  email: env.VITE_CONTACT_EMAIL ?? '',
  /** Somente dígitos com DDI, ex.: 5548999999999 */
  whatsapp: env.VITE_WHATSAPP ?? '',
  instagram: env.VITE_INSTAGRAM ?? '',
};
