/**
 * Termos de uso e política de privacidade — fonte única para o site e para os apps.
 * `app`: variante exibida nos apps nativos. Não descreve preços nem meios de compra (App Store 3.1.3(b) / Google Play),
 * e troca o trecho de cookies do site pelo que o app realmente faz.
 */
type Section = [string, string];
export interface LegalDoc { title: string; kicker: string; version: string; sections: Section[] }

const VERSION = '2026-09';

export function legalDoc(doc: 'termos' | 'privacidade', platform: 'web' | 'app'): LegalDoc {
  const controller = process.env.LEGAL_NAME || 'MedTrouxa';
  const cnpj = process.env.CNPJ ? `, CNPJ ${process.env.CNPJ}` : '';
  const contact = process.env.CONTACT_EMAIL || 'o canal de suporte da plataforma';
  const app = platform === 'app';

  if (doc === 'termos') return {
    title: 'Termos de uso', kicker: 'Jurídico', version: VERSION,
    sections: [
      ['1. O serviço', 'O MedTrouxa é uma plataforma de estudos para estudantes de medicina, com questões comentadas, flashcards, simulados, cronogramas e uma tutora com inteligência artificial. O conteúdo é exclusivamente educacional e não substitui avaliação, diagnóstico ou conduta médica.'],
      ['2. Conta', 'Você é responsável pela confidencialidade da sua senha e pelas atividades na sua conta. A conta é pessoal e intransferível; o compartilhamento de acesso pode levar à suspensão.'],
      app
        ? ['3. Planos', 'Os recursos disponíveis dependem do plano vinculado à sua conta. O aplicativo não realiza vendas nem cobranças.']
        : ['3. Planos e pagamento', 'Os planos são anuais (Arcano: 6 anos, pagamento único), pagos à vista ou parcelados em até 12x no cartão por meio do Mercado Pago. O acesso é liberado após a confirmação do pagamento. Estornos e chargebacks encerram o acesso correspondente.'],
      ['4. Direito de arrependimento', 'Nas contratações online, você pode desistir em até 7 dias da contratação, com reembolso integral (Código de Defesa do Consumidor, art. 49), pelo contato indicado abaixo.'],
      ['5. Uso adequado', 'É proibido copiar ou redistribuir o conteúdo em massa, tentar burlar limites técnicos, explorar falhas de segurança, usar nomes ofensivos ou usar a plataforma para fins ilícitos. Nomes impróprios no ranking e respostas inadequadas da IA podem ser denunciados; contas que violarem estas regras podem ser suspensas. Vulnerabilidades devem ser reportadas de forma responsável ao nosso contato.'],
      ['6. Inteligência artificial', 'As respostas da Coruja são geradas por IA e podem conter imprecisões. Confira sempre com a literatura e as diretrizes oficiais. Você pode denunciar uma resposta inadequada no próprio chat.'],
      ['7. Exclusão da conta', 'Você pode excluir sua conta a qualquer momento em "Minha conta", no site ou no app. Veja o que é apagado na Política de privacidade.'],
      ['8. Contato', `Dúvidas sobre estes termos: ${contact}.`],
    ],
  };

  return {
    title: 'Política de privacidade', kicker: 'LGPD', version: VERSION,
    sections: [
      ['1. Controlador', `${controller}${cnpj}, é o controlador dos dados pessoais tratados na plataforma. Contato do encarregado (DPO): ${contact}.`],
      ['2. Dados que coletamos', 'Cadastro: nome, e-mail, faculdade e período (opcionais) e senha (armazenada apenas como hash bcrypt). Uso: questões respondidas, revisões de flashcards, simulados, cronogramas e pontuação. Pagamento: plano, valor, forma e status — os dados do cartão são tratados diretamente pelo processador de pagamentos e nunca passam pelos nossos servidores. Técnicos: endereço IP e registros de acesso para segurança.'],
      ['3. Finalidades e bases legais', 'Prestar o serviço contratado (execução de contrato); cobrança e obrigações fiscais (obrigação legal); segurança, prevenção a fraudes e abuso (legítimo interesse); comunicações sobre sua conta, como redefinição de senha (execução de contrato).'],
      ['4. Compartilhamento e inteligência artificial', 'Processador de pagamentos, provedor de e-mail (mensagens transacionais) e provedor de IA. Ao usar a Coruja IA — e só depois de você autorizar — o texto da sua pergunta (ou o enunciado da questão, ou o resumo que você colar) é enviado à Anthropic, fornecedora do modelo de IA, sem seu nome, e-mail ou identificadores. Não inclua dados pessoais ou de pacientes nas perguntas. Não vendemos dados pessoais nem os usamos para publicidade.'],
      ['5. Ranking', 'No ranking, outros estudantes veem apenas seu primeiro nome, a inicial do sobrenome, sua faculdade (se informada) e sua pontuação.'],
      ['6. Retenção e exclusão', 'Mantemos seus dados enquanto a conta existir. Ao excluir a conta (em "Minha conta", no site ou no app), apagamos perfil e histórico de estudos imediatamente; registros de pagamento são mantidos, sem vínculo com seus dados pessoais, pelo prazo exigido pela legislação fiscal. Sem acesso à conta? Peça a exclusão pelo contato acima.'],
      ['7. Seus direitos', 'Em "Minha conta" você pode corrigir seus dados, baixar uma cópia de todos eles (portabilidade), encerrar sessões em todos os dispositivos e excluir a conta. Outros pedidos (LGPD, art. 18) podem ser feitos pelo contato acima.'],
      ['8. Segurança', 'Tráfego criptografado (HTTPS/HSTS), senhas com bcrypt, sessões com tokens de curta duração, verificação em duas etapas opcional, limites contra força bruta, banco de dados em rede isolada com réplicas e backups diários criptografados.'],
      app
        ? ['9. Dados no aparelho', 'O app não usa cookies, rastreadores, publicidade nem identificadores de anúncio. A sessão é guardada no armazenamento seguro do sistema (Keychain no iOS, Keystore no Android), apenas neste aparelho; as respostas de um simulado em andamento ficam salvas localmente até o envio. Sair da conta apaga esses dados do aparelho.']
        : ['9. Cookies e análise', 'Usamos um cookie essencial de sessão (httpOnly, restrito à autenticação). Nas páginas públicas medimos visitas, rolagem e cliques com um rastreador próprio (sem terceiros e sem publicidade): sem o seu consentimento os dados são totalmente anônimos; com ele, suas visitas são ligadas por um identificador aleatório guardado no seu navegador. Endereço IP e user-agent nunca são armazenados. Você pode mudar sua escolha a qualquer momento em "Preferências de cookies", no rodapé.'],
    ],
  };
}
