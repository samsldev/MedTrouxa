/**
 * @fileoverview Termos de Serviço em português do Brasil (tradução; a versão em inglês prevalece).
 * @author Samuel S. L.
 * @version 1.3.0
 * @since 2026-09-25
 * @copyright (c) 2026 Samuel S. L. All rights reserved.
 * All information contained herein is, and remains, the property of
 * Samuel S. L. and its suppliers, if any.
 *
 * The intellectual, technical, creative, and software concepts contained
 * herein are proprietary to Samuel S. L. and its suppliers and
 * are protected by copyright law, trade secret law, and other applicable
 * intellectual property laws in the Netherlands, the European Union, and
 * other foreign jurisdictions.
 *
 * Where applicable, such rights may be registered, recorded, or protected
 * with the competent authorities of the Government of the Netherlands,
 * the European Union, and/or other relevant jurisdictions.
 *
 * Dissemination of this information, reproduction of this material,
 * modification, distribution, disclosure, or commercial use is strictly
 * forbidden unless prior written permission is obtained from
 * Samuel S. L.
 *
 * @commercialUse Commercial use permitted only with prior written permission from Samuel S. L.
 *
 * DETAILED_DESCRIPTION:
 * - Faithful pt-BR translation of TERMS_BODY (docs/legal.ts), same section numbering
 * - Section 19 keeps the clause that the English version controls
 * - Must be reviewed by counsel before publication and kept in sync with the English text
 */

export const TERMS_BODY_BR = `
Estes Termos de Serviço (os **"Termos"**) são um contrato entre você e a Faelith Industries (**"Faelith"**, **"nós"**). Eles regem o seu acesso e uso do site da Faelith, do aplicativo desktop da Faelith, da ferramenta de linha de comando \`faelith\`, do Faelith Chat, do Faelith Code, da API da Faelith e de qualquer software, documentação e suporte relacionados (em conjunto, os **"Serviços"**).

Ao criar uma conta, instalar nosso software ou usar os Serviços de qualquer outra forma, você concorda com estes Termos. Se estiver usando os Serviços em nome de uma empresa ou outra pessoa jurídica, você declara ter poderes para vinculá-la, e "você" passa a se referir a essa entidade. Se não concordar, não use os Serviços.

## 1. Quem somos

A Faelith Industries desenvolve e opera os Serviços a partir do Brasil. Você pode falar conosco pela página de [Contato](/contact). Quando estes Termos mencionam "lei aplicável", incluem as leis do Brasil, inclusive o Código de Defesa do Consumidor (Lei 8.078/1990) e a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018), as leis da União Europeia quando se aplicarem a você e qualquer outra lei que se aplique a você onde você usa os Serviços.

## 2. Elegibilidade e sua conta

- Você precisa ter pelo menos 18 anos, ou a maioridade do lugar onde vive se for maior, para usar os Serviços.
- Você precisa de uma conta para usar a maior parte dos Serviços. Você concorda em fornecer informações corretas, mantê-las atualizadas e manter sua senha e suas chaves de API em sigilo.
- **Chaves de API são credenciais.** Tudo o que for feito com uma chave emitida para a sua conta é considerado feito por você. Não compartilhe chaves, não as coloque em código executado no cliente nem as publique em repositórios públicos. Você pode revogar uma chave a qualquer momento em **Painel, Chaves de API**; revogue imediatamente se suspeitar de exposição.
- Você é responsável por toda a atividade na sua conta e por qualquer pessoa a quem permitir usá-la. Avise-nos prontamente se souber de acesso não autorizado.
- Podemos recusar, suspender ou encerrar contas que violem estes Termos ou que, de forma razoável, entendamos representar risco para os Serviços, para outros usuários ou para terceiros.

## 3. Nossos modelos

Os Serviços funcionam com duas famílias de modelos, **Echo** e **Horizon**, nas variantes de contexto de 256k e 1M. Esses modelos são construídos sobre os pesos base abertos da família DeepSeek V4 (Echo sobre o DeepSeek V4 Flash, Horizon sobre o DeepSeek V4 Pro) e depois treinados, alinhados, avaliados e servidos pela Faelith. Os pesos base são usados sob a licença publicada; os modelos Faelith resultantes, seus dados de treino, ferramentas, prompts e infraestrutura de execução pertencem à Faelith. Nomes, aliases e capacidades dos modelos podem mudar com o tempo, conforme descrito no [Changelog](/changelog).

## 4. Uso dos Serviços

Observados estes Termos, concedemos a você um direito limitado, não exclusivo, intransferível e revogável de usar os Serviços para fins comerciais internos ou uso pessoal, incluindo criar e operar suas próprias aplicações sobre a API.

Você concorda em não fazer, nem ajudar ninguém a fazer, o seguinte:

- usar os Serviços para desenvolver, treinar ou melhorar um modelo de base ou qualquer modelo que concorra com os Serviços, inclusive extraindo respostas de forma sistemática para esse fim;
- fazer engenharia reversa, descompilar ou tentar obter os pesos, o código-fonte, os prompts de sistema ou os componentes internos dos Serviços, exceto na medida em que a lei aplicável proíba essa restrição;
- contornar limites de taxa, medidores de uso, sistemas de segurança, autenticação ou qualquer outra proteção, ou acessar os Serviços por meios diferentes das interfaces que fornecemos;
- revender, sublicenciar, compartilhar por tempo ou disponibilizar os Serviços a terceiros como oferta independente, exceto por meio da sua própria aplicação que acrescente funcionalidade relevante;
- apresentar respostas como se fossem produzidas por humanos quando uma pessoa razoável seria enganada, ou remover avisos de que o conteúdo foi produzido com auxílio de IA quando nós ou a lei exigirmos esses avisos;
- interferir na integridade ou no desempenho dos Serviços, sondar ou testar suas vulnerabilidades sem permissão por escrito, ou introduzir código malicioso.

## 5. Usos proibidos

Você não pode usar os Serviços, nem permitir que seus usuários os usem, para:

- violar qualquer lei, regulamento ou direito de terceiros aplicável, incluindo leis de propriedade intelectual, privacidade e controle de exportação;
- gerar ou distribuir material de abuso sexual infantil, ou conteúdo sexual envolvendo menores de qualquer forma;
- facilitar violência, terrorismo, tráfico de pessoas, ou o desenvolvimento, aquisição ou uso de armas capazes de causar vítimas em massa, incluindo armas químicas, biológicas, radiológicas, nucleares ou explosivos de alta potência;
- criar malware, realizar invasões não autorizadas ou comprometer de qualquer outra forma a segurança de sistemas, redes ou contas;
- gerar conteúdo fraudulento, enganoso ou abusivo, incluindo golpes, phishing, se passar por pessoas ou organizações reais, comportamento inautêntico coordenado ou imagens íntimas não consensuais;
- tomar decisões automatizadas que produzam efeitos jurídicos ou igualmente significativos sobre pessoas (por exemplo em emprego, crédito, moradia, seguros, educação ou acesso a serviços essenciais) sem revisão humana efetiva e as salvaguardas exigidas por lei;
- operar os Serviços em contextos de alto risco em que uma falha possa causar morte, lesão grave ou danos ambientais ou materiais severos, a menos que você tenha implementado supervisão humana adequada e nós tenhamos concordado com esse uso por escrito;
- assediar, ameaçar, difamar ou discriminar qualquer pessoa, ou gerar discurso de ódio.

Podemos investigar suspeitas de violação, remover ou recusar o processamento de conteúdo, limitar ou suspender o acesso e comunicar atividades ilegais às autoridades.

## 6. Seus inputs e outputs

**Inputs** são os prompts, arquivos, código, repositórios, anexos e outros conteúdos que você envia aos Serviços. **Outputs** são as respostas que os Serviços geram para você.

- Você continua dono dos seus Inputs. Você declara ter os direitos necessários para enviá-los e que isso não viola estes Termos nem direitos de terceiros.
- Entre você e a Faelith, e na medida permitida por lei, cedemos a você todos os nossos direitos, títulos e interesses sobre os Outputs. Você pode usar os Outputs para qualquer finalidade lícita, observados estes Termos.
- Os Outputs são gerados por aprendizado de máquina e podem ser imprecisos, incompletos, desatualizados ou parecidos com outputs gerados para outros usuários. **Você deve avaliar os Outputs para o seu caso de uso antes de confiar neles** e é responsável pelas decisões e ações que tomar com base neles. O código produzido pelo Code e pela CLI deve ser revisado e testado como o código de qualquer outro colaborador.
- Os Serviços podem executar ações no seu ambiente sob sua instrução (por exemplo editar arquivos, executar comandos ou fazer requisições de rede). Você é responsável pelas permissões que concede, por revisar as ações propostas e pelas consequências das ações executadas no seu ambiente.

**Marcação de conteúdo (watermark).** Para cumprir o Regulamento (UE) 2024/1689 (Regulamento Europeu de Inteligência Artificial), em especial as obrigações de transparência dos fornecedores de sistemas de IA que geram conteúdo sintético, e leis equivalentes, os Outputs, inclusive código-fonte, podem conter marcações técnicas (uma "marca d'água" ou "watermark") em formato legível por máquina, que permitem identificá-los como gerados por IA.

- A marca d'água é exclusivamente uma medida de conformidade e de proteção. Ela não afeta a sua titularidade nem o seu direito de usar os Outputs nos termos desta Seção, não restringe o uso lícito e não é usada pela Faelith para monitorar, traçar perfil ou avaliar você ou seus usuários.
- A Faelith não inspecionará, decodificará ou verificará a marca d'água do código ou de outros Outputs que você gerar, nem os examinará de outra forma, exceto (a) quando exigido por ordem judicial definitiva ou exequível de tribunal competente, (b) em resposta a requisição juridicamente vinculante de autoridade pública competente, ou (c) quando estritamente necessário para constituir, exercer ou defender direitos em processo judicial. Qualquer verificação desse tipo se limitará ao que a ordem, a requisição ou o processo exigir e, quando a lei permitir, você será avisado previamente.
- Você concorda em não remover, alterar, ocultar ou contornar a marca d'água, nem tentar fazê-lo, quando isso violar a lei aplicável ou servir para apresentar conteúdo gerado por IA como produzido por humanos de forma que possa enganar terceiros.

## 7. Tratamento de dados

A Faelith usa inferência com **zero retenção de dados (ZDR)**. Separadamente, a Faelith guarda por 90 dias, em S3 sob controle da Faelith, uma cópia com criptografia de envelope do input completo do modelo, do output completo e da transcrição completa enviada em cada requisição. Isso inclui mensagens de sistema, desenvolvedor, usuário, assistente e ferramentas; saída de raciocínio; chamadas e resultados de ferramentas; leituras e escritas de arquivos; resultados de grep/busca; novas tentativas; e saída transmitida em streaming. Esta política vale para toda chave e não altera o preço.

Também tratamos dados da conta, registros de cobrança, metadados de uso (como contagem de tokens, modelo, horários e códigos de erro) e logs de segurança para operar os Serviços. Nosso tratamento de dados pessoais está descrito no Aviso de Privacidade e, quando você fornece dados pessoais de terceiros pela API, no nosso Adendo de Tratamento de Dados. Cumprimos a Lei Geral de Proteção de Dados (LGPD) do Brasil e, quando aplicável, o Regulamento Geral sobre a Proteção de Dados da UE e leis equivalentes. Não envie categorias especiais de dados pessoais, números de cartão de pagamento ou informações de saúde reguladas, a menos que um contrato escrito conosco permita expressamente.

## 8. Planos, créditos e tarifas

- **Assinaturas** dão direito a medidores de uso contínuos para Code e Chat, conforme descrito na página de [Preços](/pricing) e na [Documentação](/docs/plans-and-usage). As assinaturas renovam automaticamente ao fim de cada período de cobrança até serem canceladas. Você pode cancelar a qualquer momento; o plano continua ativo até o fim do período pago.
- **Direito de arrependimento.** Quando a lei do seu país de cobrança dá ao consumidor o direito de desistir de contratos a distância (por exemplo Brasil, União Europeia, Reino Unido e outros), você pode cancelar sua primeira assinatura dentro desse prazo (7 ou 14 dias, conforme o país) em **Cobrança e faturas** e receber o reembolso integral; suas chaves param de funcionar imediatamente. Isso vale uma vez por cliente e por cartão de pagamento. Durante esse prazo, as requisições da assinatura são atendidas pelo Horizon Preview e pacotes de créditos não podem ser comprados. Depois do prazo, cancelar interrompe a renovação e o plano continua ativo até o fim do mês ou ano pago, sem reembolso.
- **Ofertas promocionais (50% de desconto em um mês).** As duas ofertas abaixo valem apenas para assinaturas mensais e seguem as mesmas regras: o mês com desconto custa 50% do preço de tabela do plano, os limites de uso do plano ficam pela metade nesse mês, e o uso acima do limite incluído nesse mês é cobrado pelo nosso custo de provedor, e não pela tabela de preços publicada. Depois do mês com desconto, a assinatura renova pelo preço cheio e com os limites integrais, a menos que você cancele.
  - **Oferta de boas-vindas.** Disponível apenas na sua primeira assinatura, uma vez por conta e por endereço de e-mail, quando oferecida em uma página de campanha da Faelith. O desconto vale para o seu primeiro mês.
  - **Oferta de permanência.** Quando você cancela uma assinatura mensal depois de encerrado o prazo de arrependimento, podemos oferecer 50% de desconto no seu próximo mês. Se você aceitar, o desconto vale para a próxima renovação e qualquer cancelamento pendente é desfeito, de modo que a assinatura continua renovando. Depois que você usa a oferta de permanência ou uma oferta de boas-vindas, cabe exclusivamente à Faelith decidir se e quando a oferta de permanência voltará a ser exibida. Recusar a oferta não afeta o cancelamento.
  - As ofertas são discricionárias: podemos alterá-las ou encerrá-las para novas adesões a qualquer momento; elas não são cumulativas entre si nem com outros descontos no mesmo mês, não têm valor em dinheiro e não prorrogam nem reiniciam o prazo de arrependimento.
- **Créditos pré-pagos** custeiam o uso da API. Os créditos são debitados por token pela tabela de preços publicada do modelo vigente no momento da requisição. Os créditos não são reembolsáveis, salvo quando exigido por lei, não rendem juros e expiram doze meses após a compra, a menos que a lei aplicável exija prazo maior.
- Não existe plano grátis. Os preços são exibidos em dólares americanos e não incluem impostos, que cobramos quando exigido. Você autoriza a nós e ao nosso processador de pagamentos a cobrar no seu meio de pagamento todas as tarifas e impostos aplicáveis.
- Podemos alterar preços e medidores com pelo menos 30 dias de aviso no site ou por e-mail. As alterações valem a partir do próximo período de cobrança; se não concordar, cancele antes de a alteração entrar em vigor.
- O uso pode ser estimado em tempo real e conciliado depois. Se achar que uma cobrança está errada, fale conosco em até 60 dias da cobrança.

## 9. Serviços de terceiros e código aberto

Os Serviços interagem com serviços de terceiros que você escolhe conectar, como hospedagens de código, servidores de contexto de modelos, registros de pacotes e provedores de pagamento. Esses serviços têm os próprios termos e não somos responsáveis por eles. O software inclui componentes de código aberto licenciados sob os próprios termos, listados no software, que prevalecem sobre estes Termos para esses componentes em caso de conflito.

## 10. Propriedade intelectual e feedback

Exceto pelos direitos expressamente concedidos a você nestes Termos, a Faelith e seus licenciantes detêm todos os direitos sobre os Serviços, incluindo modelos, software, documentação, marcas e a aparência dos Serviços. Se você nos enviar feedback, sugestões ou ideias, concede-nos uma licença perpétua, irrevogável, mundial e gratuita para usá-los, sem obrigação para com você.

## 11. Recursos beta e em preview

Podemos oferecer recursos marcados como beta, preview, experimentais ou similares. Eles são fornecidos no estado em que se encontram, podem mudar ou ser retirados sem aviso, podem estar sujeitos a termos adicionais e ficam fora de qualquer compromisso de disponibilidade ou suporte.

## 12. Suspensão e encerramento

Você pode parar de usar os Serviços e encerrar sua conta a qualquer momento em **Painel, Configurações**. Podemos suspender ou encerrar seu acesso se você violar de forma relevante estes Termos, se sua conta ficar inativa por mais de doze meses sem créditos restantes, se exigido por lei, ou se continuar prestando os Serviços a você criar risco jurídico ou de segurança para nós. Quando razoável, avisaremos e daremos a oportunidade de corrigir o problema antes. Com o encerramento, seu direito de usar os Serviços termina, o tempo de assinatura não usado não é reembolsado salvo quando exigido por lei, e excluiremos ou devolveremos seus dados conforme a Seção 7. As seções que, por sua natureza, devem continuar valendo após o encerramento continuam.

## 13. Isenções de garantia

Os Serviços são fornecidos "no estado em que se encontram" e "conforme disponíveis". Na máxima extensão permitida por lei, afastamos todas as garantias, expressas ou implícitas, incluindo garantias de comerciabilidade, adequação a uma finalidade específica, não violação e quaisquer garantias decorrentes da prática comercial. Não garantimos que os Serviços serão ininterruptos ou livres de erros, nem que os Outputs serão precisos, completos ou adequados a qualquer finalidade. Nada nestes Termos limita os direitos que os consumidores têm pela lei obrigatória do lugar onde vivem.

## 14. Limitação de responsabilidade

Na máxima extensão permitida por lei, nem a Faelith nem seus fornecedores serão responsáveis por danos indiretos, incidentais, especiais, consequenciais ou punitivos, nem por lucros cessantes, receita, dados ou reputação, decorrentes ou relacionados aos Serviços ou a estes Termos, qualquer que seja a causa e o fundamento, ainda que avisados da possibilidade. Nossa responsabilidade total decorrente ou relacionada aos Serviços ou a estes Termos não excederá o maior valor entre o que você nos pagou nos doze meses anteriores ao fato que originou a reclamação e cem dólares americanos. Estas limitações não se aplicam à responsabilidade que não pode ser limitada pela lei aplicável, incluindo responsabilidade por morte ou lesão corporal causada por negligência, por fraude, ou por dolo ou culpa grave.

## 15. Indenização

Se você for uma empresa, você defenderá, indenizará e isentará a Faelith e seus diretores, funcionários e agentes de qualquer reclamação de terceiros, e dos custos relacionados e honorários advocatícios razoáveis, decorrentes dos seus Inputs, das suas aplicações, do seu uso dos Outputs ou da sua violação destes Termos ou da lei aplicável, exceto na medida em que a reclamação resulte de violação nossa.

## 16. Controle de exportação e sanções

Você declara que não está localizado, nem é cidadão ou residente, em país ou território sujeito a sanções abrangentes do Brasil, das Nações Unidas, da União Europeia ou dos Estados Unidos, e que não consta de nenhuma lista de partes restritas relevante. Você cumprirá todas as leis de controle de exportação e sanções aplicáveis ao usar os Serviços.

## 17. Lei aplicável e disputas

Estes Termos são regidos pelas leis da República Federativa do Brasil, sem considerar regras de conflito de leis. Fica eleito o foro da sede da Faelith no Brasil para as disputas decorrentes destes Termos, ressalvado ao consumidor o direito de propor a ação no foro do seu próprio domicílio, conforme o Código de Defesa do Consumidor, e ressalvado aos consumidores residentes na União Europeia ou em outro país o direito de ajuizar ações nos tribunais do seu país de residência e de manter as regras obrigatórias de proteção ao consumidor desse país. Antes de recorrer à Justiça, você pode falar conosco pela página de [Contato](/contact), e consumidores no Brasil também podem usar a plataforma pública consumidor.gov.br. A Convenção das Nações Unidas sobre Contratos de Compra e Venda Internacional de Mercadorias não se aplica.

## 18. Alterações destes Termos

Podemos atualizar estes Termos de tempos em tempos. Para alterações relevantes, daremos pelo menos 30 dias de aviso publicando os novos Termos no site e, quando tivermos seu e-mail, por e-mail. Continuar usando os Serviços após a data de vigência significa aceitação. Se não concordar, pare de usar os Serviços e encerre sua conta antes de as alterações entrarem em vigor. A data de vigência e a versão aparecem no topo desta página.

## 19. Disposições gerais

Estes Termos, junto com qualquer pedido de compra, o Aviso de Privacidade e qualquer Adendo de Tratamento de Dados, são o acordo integral entre você e a Faelith sobre os Serviços. Se alguma disposição for considerada inexequível, o restante continua válido. Deixar de exigir o cumprimento de uma disposição não é renúncia. Você não pode ceder estes Termos sem o nosso consentimento; podemos cedê-los em caso de fusão, aquisição ou venda de ativos. Avisos a você podem ser dados por e-mail para o endereço da sua conta ou publicados no site. A versão em inglês destes Termos prevalece sobre qualquer tradução.

## 20. Contato

Dúvidas sobre estes Termos podem ser enviadas pela página de [Contato](/contact). Para relatos de segurança, inclua "security" no assunto e confirmaremos o recebimento em até dois dias úteis.
`;
