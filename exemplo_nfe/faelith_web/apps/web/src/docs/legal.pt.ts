/**
 * @fileoverview Termos de Serviço em português europeu (tradução; a versão em inglês prevalece).
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
 * - Faithful pt-PT translation of TERMS_BODY (docs/legal.ts), same section numbering
 * - Section 19 keeps the clause that the English version controls
 * - Must be reviewed by counsel before publication and kept in sync with the English text
 */

export const TERMS_BODY_PT = `
Estes Termos de Serviço (os **"Termos"**) são um contrato entre si e a Faelith Industries (**"Faelith"**, **"nós"**). Regem o seu acesso e utilização do site da Faelith, da aplicação desktop da Faelith, da ferramenta de linha de comandos \`faelith\`, do Faelith Chat, do Faelith Code, da API da Faelith e de qualquer software, documentação e suporte relacionados (em conjunto, os **"Serviços"**).

Ao criar uma conta, instalar o nosso software ou utilizar os Serviços de qualquer outra forma, aceita estes Termos. Se utilizar os Serviços em nome de uma empresa ou de outra pessoa coletiva, declara ter poderes para a vincular, e "si" passa a referir-se a essa entidade. Se não concordar, não utilize os Serviços.

## 1. Quem somos

A Faelith Industries desenvolve e opera os Serviços a partir do Brasil. Pode contactar-nos através da página de [Contacto](/contact). Quando estes Termos mencionam "lei aplicável", incluem as leis do Brasil, incluindo o Código de Defesa do Consumidor (Lei 8.078/1990) e a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018), as leis da União Europeia quando lhe sejam aplicáveis e qualquer outra lei que se lhe aplique onde utiliza os Serviços.

## 2. Elegibilidade e a sua conta

- Tem de ter pelo menos 18 anos, ou a maioridade do local onde vive se for superior, para utilizar os Serviços.
- Precisa de uma conta para utilizar a maior parte dos Serviços. Compromete-se a fornecer informações corretas, mantê-las atualizadas e manter a sua palavra-passe e as suas chaves de API confidenciais.
- **As chaves de API são credenciais.** Tudo o que for feito com uma chave emitida para a sua conta é considerado feito por si. Não partilhe chaves, não as coloque em código executado no cliente nem as publique em repositórios públicos. Pode revogar uma chave a qualquer momento em **Painel, Chaves de API**; revogue-a de imediato se suspeitar de exposição.
- É responsável por toda a atividade na sua conta e por qualquer pessoa a quem permita utilizá-la. Informe-nos prontamente se tiver conhecimento de acesso não autorizado.
- Podemos recusar, suspender ou encerrar contas que violem estes Termos ou que, de forma razoável, consideremos representar um risco para os Serviços, para outros utilizadores ou para terceiros.

## 3. Os nossos modelos

Os Serviços funcionam com duas famílias de modelos, **Echo** e **Horizon**, nas variantes de contexto de 256k e 1M. Estes modelos são construídos sobre os pesos base abertos da família DeepSeek V4 (Echo sobre o DeepSeek V4 Flash, Horizon sobre o DeepSeek V4 Pro) e depois treinados, alinhados, avaliados e servidos pela Faelith. Os pesos base são utilizados ao abrigo da licença publicada; os modelos Faelith resultantes, os seus dados de treino, ferramentas, prompts e infraestrutura de execução pertencem à Faelith. Os nomes, aliases e capacidades dos modelos podem mudar ao longo do tempo, conforme descrito no [Changelog](/changelog).

## 4. Utilização dos Serviços

Sem prejuízo destes Termos, concedemos-lhe um direito limitado, não exclusivo, intransmissível e revogável de utilizar os Serviços para fins empresariais internos ou uso pessoal, incluindo criar e operar as suas próprias aplicações sobre a API.

Compromete-se a não fazer, nem ajudar ninguém a fazer, o seguinte:

- utilizar os Serviços para desenvolver, treinar ou melhorar um modelo de base ou qualquer modelo que concorra com os Serviços, incluindo extraindo respostas de forma sistemática para esse fim;
- fazer engenharia inversa, descompilar ou tentar obter os pesos, o código-fonte, os prompts de sistema ou os componentes internos dos Serviços, exceto na medida em que a lei aplicável proíba essa restrição;
- contornar limites de taxa, medidores de utilização, sistemas de segurança, autenticação ou qualquer outra proteção, ou aceder aos Serviços por meios diferentes das interfaces que disponibilizamos;
- revender, sublicenciar, partilhar em regime de tempo partilhado ou disponibilizar os Serviços a terceiros como oferta autónoma, exceto através da sua própria aplicação que acrescente funcionalidade relevante;
- apresentar respostas como se fossem produzidas por humanos quando uma pessoa razoável seria induzida em erro, ou remover avisos de que o conteúdo foi produzido com recurso a IA quando nós ou a lei exigirmos esses avisos;
- interferir com a integridade ou o desempenho dos Serviços, sondar ou testar as suas vulnerabilidades sem autorização escrita, ou introduzir código malicioso.

## 5. Utilizações proibidas

Não pode utilizar os Serviços, nem permitir que os seus utilizadores os utilizem, para:

- violar qualquer lei, regulamento ou direito de terceiros aplicável, incluindo leis de propriedade intelectual, privacidade e controlo de exportações;
- gerar ou distribuir material de abuso sexual de crianças, ou conteúdo sexual envolvendo menores sob qualquer forma;
- facilitar violência, terrorismo, tráfico de seres humanos, ou o desenvolvimento, aquisição ou utilização de armas capazes de causar vítimas em massa, incluindo armas químicas, biológicas, radiológicas, nucleares ou explosivos de elevada potência;
- criar malware, realizar intrusões não autorizadas ou comprometer de qualquer outra forma a segurança de sistemas, redes ou contas;
- gerar conteúdo fraudulento, enganoso ou abusivo, incluindo burlas, phishing, usurpação da identidade de pessoas ou organizações reais, comportamento inautêntico coordenado ou imagens íntimas não consentidas;
- tomar decisões automatizadas que produzam efeitos jurídicos ou igualmente significativos sobre pessoas (por exemplo em emprego, crédito, habitação, seguros, educação ou acesso a serviços essenciais) sem revisão humana efetiva e as salvaguardas exigidas por lei;
- operar os Serviços em contextos de alto risco em que uma falha possa causar a morte, lesões graves ou danos ambientais ou materiais graves, a menos que tenha implementado supervisão humana adequada e que tenhamos concordado com essa utilização por escrito;
- assediar, ameaçar, difamar ou discriminar qualquer pessoa, ou gerar discurso de ódio.

Podemos investigar suspeitas de violação, remover ou recusar o processamento de conteúdo, limitar ou suspender o acesso e comunicar atividades ilícitas às autoridades.

## 6. Os seus inputs e outputs

**Inputs** são os prompts, ficheiros, código, repositórios, anexos e outros conteúdos que envia para os Serviços. **Outputs** são as respostas que os Serviços geram para si.

- Continua a ser titular dos seus Inputs. Declara ter os direitos necessários para os enviar e que isso não viola estes Termos nem direitos de terceiros.
- Entre si e a Faelith, e na medida permitida por lei, cedemos-lhe todos os nossos direitos, títulos e interesses sobre os Outputs. Pode utilizar os Outputs para qualquer finalidade lícita, sem prejuízo destes Termos.
- Os Outputs são gerados por aprendizagem automática e podem ser imprecisos, incompletos, desatualizados ou semelhantes a outputs gerados para outros utilizadores. **Deve avaliar os Outputs para o seu caso de utilização antes de confiar neles** e é responsável pelas decisões e ações que tomar com base neles. O código produzido pelo Code e pela CLI deve ser revisto e testado como o código de qualquer outro colaborador.
- Os Serviços podem executar ações no seu ambiente por sua instrução (por exemplo editar ficheiros, executar comandos ou fazer pedidos de rede). É responsável pelas permissões que concede, por rever as ações propostas e pelas consequências das ações executadas no seu ambiente.

**Marcação de conteúdo (watermark).** Para cumprir o Regulamento (UE) 2024/1689 (Regulamento da Inteligência Artificial), em especial as obrigações de transparência dos prestadores de sistemas de IA que geram conteúdo sintético, e leis equivalentes, os Outputs, incluindo código-fonte, podem conter marcações técnicas (uma "marca de água" ou "watermark") num formato legível por máquina, que permitem identificá-los como gerados por IA.

- A marca de água é exclusivamente uma medida de conformidade e de proteção. Não afeta a sua titularidade nem o seu direito de utilizar os Outputs nos termos desta Secção, não restringe a utilização lícita e não é usada pela Faelith para monitorizar, definir perfis ou avaliar o utilizador ou os seus utilizadores.
- A Faelith não inspecionará, descodificará ou verificará a marca de água do código ou de outros Outputs que gerar, nem os examinará de outra forma, exceto (a) quando exigido por decisão transitada em julgado ou exequível de um tribunal competente, (b) em resposta a um pedido juridicamente vinculativo de uma autoridade pública competente, ou (c) quando estritamente necessário para declarar, exercer ou defender um direito num processo judicial. Qualquer verificação deste tipo limita-se ao que a decisão, o pedido ou o processo exigir e, quando a lei o permitir, será notificado previamente.
- Compromete-se a não remover, alterar, ocultar ou contornar a marca de água, nem tentar fazê-lo, quando tal viole a lei aplicável ou sirva para apresentar conteúdo gerado por IA como produzido por humanos de forma a induzir terceiros em erro.

## 7. Tratamento de dados

A Faelith utiliza inferência com **zero retenção de dados (ZDR)**. Separadamente, a Faelith guarda durante 90 dias, em S3 sob controlo da Faelith, uma cópia com cifragem de envelope do input completo do modelo, do output completo e da transcrição completa enviada em cada pedido. Inclui mensagens de sistema, programador, utilizador, assistente e ferramentas; saída de raciocínio; chamadas e resultados de ferramentas; leituras e escritas de ficheiros; resultados de grep/pesquisa; novas tentativas; e saída transmitida em streaming. Esta política aplica-se a todas as chaves e não altera o preço.

Tratamos também dados da conta, registos de faturação, metadados de utilização (como contagem de tokens, modelo, horas e códigos de erro) e registos de segurança para operar os Serviços. O nosso tratamento de dados pessoais está descrito no Aviso de Privacidade e, quando fornece dados pessoais de terceiros através da API, no nosso Adenda de Tratamento de Dados. Cumprimos a Lei Geral de Proteção de Dados (LGPD) do Brasil e, quando aplicável, o Regulamento Geral sobre a Proteção de Dados da UE e leis equivalentes. Não envie categorias especiais de dados pessoais, números de cartões de pagamento ou informações de saúde reguladas, salvo se um contrato escrito connosco o permitir expressamente.

## 8. Planos, créditos e tarifas

- **As subscrições** dão direito a medidores de utilização contínuos para Code e Chat, conforme descrito na página de [Preços](/pricing) e na [Documentação](/docs/plans-and-usage). As subscrições renovam-se automaticamente no fim de cada período de faturação até serem canceladas. Pode cancelar a qualquer momento; o plano mantém-se ativo até ao fim do período pago.
- **Direito de livre resolução.** Quando a lei do seu país de faturação concede ao consumidor o direito de resolver contratos celebrados à distância (por exemplo Brasil, União Europeia, Reino Unido e outros), pode cancelar a sua primeira subscrição dentro desse prazo (7 ou 14 dias, consoante o país) em **Faturação e faturas** e receber o reembolso total; as suas chaves deixam de funcionar de imediato. Aplica-se uma vez por cliente e por cartão de pagamento. Durante esse prazo, os pedidos da subscrição são servidos pelo Horizon Preview e não é possível comprar pacotes de créditos. Após o prazo, cancelar interrompe a renovação e o plano mantém-se ativo até ao fim do mês ou ano pago, sem reembolso.
- **Ofertas promocionais (50% de desconto num mês).** As duas ofertas abaixo aplicam-se apenas a subscrições mensais e seguem as mesmas regras: o mês com desconto custa 50% do preço de tabela do plano, os limites de utilização do plano ficam reduzidos a metade nesse mês, e a utilização acima do limite incluído nesse mês é cobrada ao nosso custo de fornecedor, e não segundo a tabela de preços publicada. Após o mês com desconto, a subscrição renova-se pelo preço total e com os limites integrais, salvo se a cancelar.
  - **Oferta de boas-vindas.** Disponível apenas na sua primeira subscrição, uma vez por conta e por endereço de e-mail, quando apresentada numa página de campanha da Faelith. O desconto aplica-se ao seu primeiro mês.
  - **Oferta de permanência.** Quando cancela uma subscrição mensal depois de terminado o prazo de livre resolução, podemos oferecer-lhe 50% de desconto no mês seguinte. Se aceitar, o desconto aplica-se à renovação seguinte e qualquer cancelamento pendente é anulado, pelo que a subscrição continua a renovar-se. Depois de utilizar a oferta de permanência ou uma oferta de boas-vindas, cabe exclusivamente à Faelith decidir se e quando a oferta de permanência voltará a ser apresentada. Recusar a oferta não afeta o cancelamento.
  - As ofertas são discricionárias: podemos alterá-las ou retirá-las para novas adesões a qualquer momento; não são cumuláveis entre si nem com outros descontos no mesmo mês, não têm valor monetário e não prorrogam nem reiniciam o prazo de livre resolução.
- **Os créditos pré-pagos** financiam a utilização da API. Os créditos são debitados por token segundo a tabela de preços publicada do modelo em vigor no momento do pedido. Os créditos não são reembolsáveis, salvo quando exigido por lei, não vencem juros e expiram doze meses após a compra, salvo se a lei aplicável exigir um prazo superior.
- Não existe plano gratuito. Os preços são apresentados em dólares americanos e não incluem impostos, que cobramos quando exigido. Autoriza-nos, a nós e ao nosso processador de pagamentos, a cobrar no seu meio de pagamento todas as tarifas e impostos aplicáveis.
- Podemos alterar preços e medidores com pelo menos 30 dias de pré-aviso no site ou por e-mail. As alterações aplicam-se a partir do período de faturação seguinte; se não concordar, cancele antes de a alteração entrar em vigor.
- A utilização pode ser estimada em tempo real e conciliada posteriormente. Se considerar que uma cobrança está errada, contacte-nos no prazo de 60 dias após a cobrança.

## 9. Serviços de terceiros e código aberto

Os Serviços interagem com serviços de terceiros que escolha ligar, como alojamentos de código, servidores de contexto de modelos, registos de pacotes e fornecedores de pagamento. Esses serviços regem-se pelos seus próprios termos e não somos responsáveis por eles. O software inclui componentes de código aberto licenciados nos seus próprios termos, listados no software, que prevalecem sobre estes Termos para esses componentes em caso de conflito.

## 10. Propriedade intelectual e feedback

Com exceção dos direitos que lhe são expressamente concedidos nestes Termos, a Faelith e os seus licenciantes detêm todos os direitos sobre os Serviços, incluindo modelos, software, documentação, marcas e o aspeto dos Serviços. Se nos enviar feedback, sugestões ou ideias, concede-nos uma licença perpétua, irrevogável, mundial e gratuita para os utilizar, sem qualquer obrigação para consigo.

## 11. Funcionalidades beta e em pré-visualização

Podemos disponibilizar funcionalidades assinaladas como beta, pré-visualização, experimentais ou semelhantes. São fornecidas no estado em que se encontram, podem mudar ou ser retiradas sem aviso, podem estar sujeitas a termos adicionais e ficam excluídas de quaisquer compromissos de disponibilidade ou suporte.

## 12. Suspensão e cessação

Pode deixar de utilizar os Serviços e encerrar a sua conta a qualquer momento em **Painel, Definições**. Podemos suspender ou fazer cessar o seu acesso se violar de forma relevante estes Termos, se a sua conta estiver inativa durante mais de doze meses sem créditos restantes, se a lei o exigir, ou se continuar a prestar-lhe os Serviços criar um risco jurídico ou de segurança para nós. Quando razoável, iremos notificá-lo e dar-lhe a oportunidade de corrigir o problema primeiro. Com a cessação, o seu direito de utilizar os Serviços termina, o tempo de subscrição não utilizado não é reembolsado salvo quando exigido por lei, e eliminaremos ou devolveremos os seus dados conforme a Secção 7. As secções que, pela sua natureza, devam subsistir após a cessação subsistem.

## 13. Exclusão de garantias

Os Serviços são fornecidos "no estado em que se encontram" e "conforme disponíveis". Na máxima medida permitida por lei, excluímos todas as garantias, expressas ou implícitas, incluindo garantias de comerciabilidade, adequação a um fim específico, não violação e quaisquer garantias decorrentes da prática comercial. Não garantimos que os Serviços sejam ininterruptos ou isentos de erros, nem que os Outputs sejam exatos, completos ou adequados a qualquer finalidade. Nada nestes Termos limita os direitos que os consumidores têm ao abrigo da lei imperativa do local onde vivem.

## 14. Limitação de responsabilidade

Na máxima medida permitida por lei, nem a Faelith nem os seus fornecedores serão responsáveis por danos indiretos, acidentais, especiais, consequenciais ou punitivos, nem por lucros cessantes, receitas, dados ou reputação, decorrentes ou relacionados com os Serviços ou com estes Termos, qualquer que seja a causa e o fundamento, ainda que avisados dessa possibilidade. A nossa responsabilidade total decorrente ou relacionada com os Serviços ou com estes Termos não excederá o maior valor entre o que nos pagou nos doze meses anteriores ao facto que deu origem à reclamação e cem dólares americanos. Estas limitações não se aplicam à responsabilidade que não pode ser limitada pela lei aplicável, incluindo a responsabilidade por morte ou lesão corporal causada por negligência, por fraude, ou por dolo ou negligência grave.

## 15. Indemnização

Se for uma empresa, defenderá, indemnizará e isentará a Faelith e os seus administradores, trabalhadores e agentes de qualquer reclamação de terceiros, e dos custos relacionados e honorários razoáveis de advogados, decorrentes dos seus Inputs, das suas aplicações, da sua utilização dos Outputs ou da sua violação destes Termos ou da lei aplicável, exceto na medida em que a reclamação resulte de uma violação nossa.

## 16. Controlo de exportações e sanções

Declara que não se encontra, nem é nacional ou residente, num país ou território sujeito a sanções abrangentes do Brasil, das Nações Unidas, da União Europeia ou dos Estados Unidos, e que não consta de nenhuma lista de partes restritas relevante. Cumprirá todas as leis de controlo de exportações e sanções aplicáveis ao utilizar os Serviços.

## 17. Lei aplicável e litígios

Estes Termos regem-se pelas leis da República Federativa do Brasil, sem atender às regras de conflito de leis. São competentes os tribunais da sede da Faelith no Brasil para os litígios decorrentes destes Termos, sem prejuízo do direito do consumidor de intentar a ação nos tribunais do seu próprio domicílio, garantido pelo Código de Defesa do Consumidor brasileiro, e do direito dos consumidores residentes na União Europeia ou noutro país de intentar ações nos tribunais do seu país de residência e de manter as regras imperativas de proteção do consumidor desse país. Antes de recorrer aos tribunais, pode contactar-nos através da página de [Contacto](/contact); os consumidores no Brasil podem também usar a plataforma pública consumidor.gov.br. A Convenção das Nações Unidas sobre os Contratos de Compra e Venda Internacional de Mercadorias não se aplica.

## 18. Alterações a estes Termos

Podemos atualizar estes Termos periodicamente. Para alterações relevantes, daremos pelo menos 30 dias de pré-aviso publicando os novos Termos no site e, quando tivermos o seu endereço de e-mail, por e-mail. A utilização continuada dos Serviços após a data de entrada em vigor constitui aceitação. Se não concordar, deixe de utilizar os Serviços e encerre a sua conta antes de as alterações entrarem em vigor. A data de entrada em vigor e a versão aparecem no topo desta página.

## 19. Disposições gerais

Estes Termos, juntamente com qualquer nota de encomenda, o Aviso de Privacidade e qualquer Adenda de Tratamento de Dados, constituem o acordo integral entre si e a Faelith relativamente aos Serviços. Se alguma disposição for considerada inexequível, as restantes mantêm-se em vigor. A falta de exigência do cumprimento de uma disposição não constitui renúncia. Não pode ceder estes Termos sem o nosso consentimento; podemos cedê-los no âmbito de uma fusão, aquisição ou venda de ativos. As notificações podem ser-lhe enviadas por e-mail para o endereço da sua conta ou publicadas no site. A versão em inglês destes Termos prevalece sobre qualquer tradução.

## 20. Contacto

As questões sobre estes Termos podem ser enviadas através da página de [Contacto](/contact). Para comunicações de segurança, inclua "security" no assunto e confirmaremos a receção no prazo de dois dias úteis.
`;
