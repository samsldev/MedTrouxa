import { Link } from 'react-router-dom';
import { Logo } from '../components/Brand';
import Footer from '../components/Footer';
import { SITE } from '../site';

const controller = SITE.legalName || 'MedTrouxa';
const contact = SITE.email || 'o canal de suporte da plataforma';

const DOCS = {
  termos: {
    title: 'Termos de uso', kicker: 'Jurídico',
    sections: [
      ['1. O serviço', 'O MedTrouxa é uma plataforma de estudos para estudantes de medicina, com questões comentadas, flashcards, simulados, cronogramas e uma tutora com inteligência artificial. O conteúdo é exclusivamente educacional e não substitui avaliação, diagnóstico ou conduta médica.'],
      ['2. Conta', 'Você é responsável pela confidencialidade da sua senha e pelas atividades na sua conta. A conta é pessoal e intransferível; o compartilhamento de acesso pode levar à suspensão.'],
      ['3. Planos e pagamento', 'Os planos são anuais (Arcano: 6 anos, pagamento único), pagos à vista ou parcelados em até 12x no cartão por meio do Mercado Pago. O acesso é liberado após a confirmação do pagamento. Estornos e chargebacks encerram o acesso correspondente.'],
      ['4. Direito de arrependimento', 'Nas contratações online, você pode desistir em até 7 dias da contratação, com reembolso integral (Código de Defesa do Consumidor, art. 49), pelo contato indicado abaixo.'],
      ['5. Uso adequado', 'É proibido copiar ou redistribuir o conteúdo em massa, tentar burlar limites técnicos, explorar falhas de segurança ou usar a plataforma para fins ilícitos. Vulnerabilidades devem ser reportadas de forma responsável ao nosso contato.'],
      ['6. Inteligência artificial', 'As respostas da Coruja são geradas por IA e podem conter imprecisões. Confira sempre com a literatura e as diretrizes oficiais.'],
      ['7. Contato', `Dúvidas sobre estes termos: ${contact}.`],
    ],
  },
  privacidade: {
    title: 'Política de privacidade', kicker: 'LGPD',
    sections: [
      ['1. Controlador', `${controller}${SITE.cnpj ? `, CNPJ ${SITE.cnpj}` : ''}, é o controlador dos dados pessoais tratados na plataforma. Contato do encarregado (DPO): ${contact}.`],
      ['2. Dados que coletamos', 'Cadastro: nome, e-mail, faculdade e período (opcionais) e senha (armazenada apenas como hash bcrypt). Uso: questões respondidas, revisões de flashcards, simulados, cronogramas e pontuação. Pagamento: plano, valor, forma e status — os dados do cartão são tratados diretamente pelo Mercado Pago e nunca passam pelos nossos servidores. Técnicos: endereço IP e registros de acesso para segurança.'],
      ['3. Finalidades e bases legais', 'Prestar o serviço contratado (execução de contrato); cobrança e obrigações fiscais (obrigação legal); segurança, prevenção a fraudes e abuso (legítimo interesse); comunicações sobre sua conta, como redefinição de senha (execução de contrato).'],
      ['4. Compartilhamento', 'Mercado Pago (processamento de pagamentos), provedor de e-mail (mensagens transacionais) e, ao usar a Coruja IA, o provedor de IA recebe apenas o texto da sua pergunta — sem nome, e-mail ou identificadores. Não vendemos dados pessoais.'],
      ['5. Ranking', 'No ranking, outros estudantes veem apenas seu primeiro nome, a inicial do sobrenome, sua faculdade (se informada) e sua pontuação.'],
      ['6. Retenção', 'Mantemos seus dados enquanto a conta existir. Ao excluir a conta, apagamos perfil e histórico de estudos; registros de pagamento são mantidos, sem vínculo com seus dados pessoais, pelo prazo exigido pela legislação fiscal.'],
      ['7. Seus direitos', 'Em "Minha conta" você pode corrigir seus dados, baixar uma cópia de todos eles (portabilidade), encerrar sessões em todos os dispositivos e excluir a conta. Outros pedidos (LGPD, art. 18) podem ser feitos pelo contato acima.'],
      ['8. Segurança', 'Tráfego criptografado (HTTPS/HSTS), senhas com bcrypt, sessões com tokens de curta duração e cookies httpOnly, limites contra força bruta, banco de dados em rede isolada com réplicas e backups diários criptografados.'],
      ['9. Cookies e análise', 'Usamos um cookie essencial de sessão (httpOnly, restrito à autenticação). Nas páginas públicas medimos visitas, rolagem e cliques com um rastreador próprio (sem terceiros e sem publicidade): sem o seu consentimento os dados são totalmente anônimos; com ele, suas visitas são ligadas por um identificador aleatório guardado no seu navegador. Endereço IP e user-agent nunca são armazenados. Você pode mudar sua escolha a qualquer momento em "Preferências de cookies", no rodapé.'],
    ],
  },
};

export default function Legal({ doc }: { doc: keyof typeof DOCS }) {
  const d = DOCS[doc];
  return (
    <div className="legal-page">
      <header className="checkout-top"><Link to="/"><Logo /></Link><Link to="/" className="btn btn-text">← Voltar ao início</Link></header>
      <main className="lp-wrap narrow legal">
        <span className="kicker">{d.kicker}</span>
        <h1>{d.title}</h1>
        <p className="muted">Versão 2026-09. Minuta: revise com sua assessoria jurídica antes do lançamento comercial.</p>
        {d.sections.map(([h, t]) => <section key={h}><h2>{h}</h2><p>{t}</p></section>)}
      </main>
      <Footer />
    </div>
  );
}
