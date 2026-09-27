<!--
@fileoverview Model card for Echo and Horizon (European Portuguese source of the PDF).
@author Samuel S. L.
@version 1.0.0
@since 2026-09-26
@copyright (c) 2026 Samuel S. L. All rights reserved.
All information contained herein is, and remains, the property of
Samuel S. L. and its suppliers, if any.

The intellectual, technical, creative, and software concepts contained
herein are proprietary to Samuel S. L. and its suppliers and
are protected by copyright law, trade secret law, and other applicable
intellectual property laws in the Netherlands, the European Union, and
other foreign jurisdictions.

Where applicable, such rights may be registered, recorded, or protected
with the competent authorities of the Government of the Netherlands,
the European Union, and/or other relevant jurisdictions.

Dissemination of this information, reproduction of this material,
modification, distribution, disclosure, or commercial use is strictly
forbidden unless prior written permission is obtained from
Samuel S. L.

@commercialUse Commercial use permitted only with prior written permission from Samuel S. L.

<DETAILED_DESCRIPTION>:
- Source of Faelith_Model_Card_Echo_Horizon_pt-PT.pdf (rendered by build_card.py)
- Faithful translation of card.en.md in European Portuguese, same section numbering
- "{{PENDING}}" renders as "Pendente"
-->

@title Model Card: Echo e Horizon
@date 26 de setembro de 2026
@version Versão 1.0 · Modelos em Preview

# Sumário executivo

Este model card descreve o **Echo** e o **Horizon**, as duas famílias de modelos desenvolvidas pela Faelith Industries para o Faelith Code, a Faelith CLI, o Faelith Chat e a Faelith API. As duas famílias foram pós-treinadas para funcionar como **parceiras de programação (pair programming)**. Colaboram com o programador em vez de o contornarem:

- fazem uma pergunta de esclarecimento objetiva quando o pedido é ambíguo, incompleto ou depende de uma decisão que cabe ao utilizador;
- avançam sem interromper quando o caminho é claro;
- explicitam os pressupostos e explicam as alternativas;
- confirmam antes de ações com consequências.

O **Horizon** é a família de raciocínio mais profundo, para trabalho de engenharia difícil, grandes refatorações e investigações longas. O **Echo** é a família rápida e económica, para a programação do dia a dia, iteração e chat. O Echo foi destilado a partir do Horizon, que atuou como modelo professor. Cada família tem uma variante normal (contexto de 256K tokens) e uma de contexto longo (1M tokens). Ambas são disponibilizadas como modelos **Preview**.

Descrevemos a seguir as avaliações realizadas antes do lançamento, nas seguintes áreas:

**Comportamento de pair programming.** Construímos o *Faelith PairBench* sobre o HumanEvalComm, um benchmark com revisão por pares que mede a capacidade de comunicação de modelos de código. Acrescentámos duas partes próprias: um conjunto de controlo que mede perguntas desnecessárias e cenários com utilização de ferramentas que medem a confirmação antes de ações destrutivas. Os resultados constam da secção 2.

**Capacidades.** A secção 3 apresenta avaliações de programação, contexto longo e multilinguismo para cada variante.

**Salvaguardas e inocuidade.** As duas famílias funcionam por detrás da camada própria de segurança de conteúdos da Faelith, baseada em classificadores, além das salvaguardas aprendidas no pós-treino. As avaliações de pedidos nocivos e de recusas indevidas constam da secção 4.

**Segurança em utilização agêntica.** No Faelith Code e na Faelith CLI, os modelos atuam através de ferramentas, sob modos de permissão controlados pelo utilizador. A secção 5 trata da confirmação antes de ações destrutivas e da robustez contra injeção de prompt.

**Avaliação independente.** Dois avaliadores independentes analisaram, antes do lançamento, o comportamento de segurança, as salvaguardas e as capacidades dos modelos (secção 1.5).

# 1 Introdução

Este model card descreve o Echo e o Horizon, as primeiras famílias de modelos desenvolvidas pela Faelith Industries, e apresenta avaliações das suas capacidades e do seu perfil de segurança. A Faelith Industries opera a partir do Brasil e executa os modelos em infraestrutura própria.

## 1.1 Treino e características dos modelos

### 1.1.1 Dados e processo de treino

O Echo e o Horizon foram construídos através de afinação (fine-tuning) de modelos-base de pesos abertos de terceiros, conforme indicado nos Termos de Serviço da Faelith. Cada família utiliza um modelo-base e uma configuração diferentes.

- O **Horizon** foi treinado com afinação supervisionada (SFT) seguida de aprendizagem por reforço (RL).
- O **Echo** foi treinado com SFT e RL e com destilação de conhecimento a partir do Horizon, que atuou como modelo professor.

O pós-treino durou cerca de três meses. Utilizou aproximadamente **340 GB** de dados, entre conjuntos de dados públicos e dados sintéticos gerados para esse fim. Os dados foram limpos, deduplicados e filtrados antes da utilização. Os conteúdos dos clientes não são utilizados para treino.

O pós-treino centrou-se nos comportamentos de um parceiro de programação colaborativo:

- fazer uma pergunta de esclarecimento objetiva quando o pedido é ambíguo, inconsistente, incompleto ou exige uma decisão que cabe ao utilizador, e avançar sem perguntar quando o caminho é claro;
- explicitar os pressupostos quando tiver de avançar em situação de incerteza;
- explicar as alternativas quando existe mais de uma abordagem válida, em vez de escolher uma em silêncio;
- confirmar antes de operações destrutivas ou difíceis de reverter;
- limitar as alterações ao pedido e assinalar separadamente problemas não relacionados.

As duas famílias são multilingues e costumam responder no idioma da mensagem do utilizador. A qualidade das respostas varia consoante o idioma. Os modelos recebem e produzem **apenas texto**.

**Data de corte do conhecimento.** Horizon: 1 de abril de 2026. Echo: 25 de agosto de 2025.

### 1.1.2 Variantes

| Id no catálogo | Nome apresentado | Família | Janela de contexto |
|---|---|---|---|
| `horizon` | Horizon Preview | Horizon | 256 000 tokens |
| `horizon1m` | Horizon Preview 1M | Horizon | 1 024 000 tokens |
| `echo` | Echo Preview | Echo | 256 000 tokens |
| `echo1m` | Echo Preview 1M | Echo | 1 024 000 tokens |

As duas famílias suportam seis níveis de **esforço de raciocínio**: `none`, `low`, `medium`, `high`, `xhigh` e `max`. A API é compatível com o formato Chat Completions da OpenAI e suporta cache de prompt.

### 1.1.3 Estado de Preview e próximos passos

O Echo e o Horizon são versões Preview. A Faelith está também a treinar um modelo-base de raiz. Os modelos de disponibilidade geral serão treinados de raiz ou serão versões das famílias atuais com muito mais treino e alinhamento. Quando isso acontecer, este model card será substituído por um novo.

## 1.2 Política de utilização e suporte

Os Termos de Serviço da Faelith (faelithindustries.com/terms) descrevem as utilizações proibidas dos modelos e as obrigações dos clientes da API. Para contactar a Faelith, visite faelithindustries.com/contact.

## 1.3 Tratamento de dados

- **Inferência.** A Faelith opera a infraestrutura de inferência do Echo e do Horizon.
- **Conservação.** As entradas e saídas dos modelos são cifradas em repouso e conservadas durante **90 dias**, exclusivamente para ficarem disponíveis para obrigações legais e processos judiciais, se necessário. Depois são eliminadas. Não são utilizadas para treino.
- **Marcação de conteúdos.** As saídas podem conter uma marcação legível por máquina que as identifica como geradas por IA, em cumprimento do Regulamento (UE) 2024/1689 (Regulamento da Inteligência Artificial). A marcação só é inspecionada mediante decisão judicial, pedido vinculativo de uma autoridade pública ou em processo judicial.
- **Dados pessoais.** Os dados pessoais são tratados nos termos da LGPD brasileira e, quando aplicável, do RGPD.

## 1.4 Avaliações dos modelos

Salvo indicação em contrário, todas as avaliações deste model card foram realizadas com o snapshot de lançamento de cada modelo, através da API de produção, com as salvaguardas da Faelith ativas e com esforço de raciocínio `medium`.

## 1.5 Testes externos

Além dos testes internos, **dois avaliadores independentes** avaliaram os modelos antes do lançamento. A avaliação abrangeu:

- o comportamento de segurança;
- a eficácia das salvaguardas e da camada de segurança de conteúdos;
- as capacidades gerais e de programação.

As conclusões orientaram as salvaguardas descritas na secção 4.

# 2 Comportamento de pair programming

## 2.1 Faelith PairBench

Medimos o comportamento de pair programming com o **Faelith PairBench**, que tem três partes.

**Parte A: HumanEvalComm.** O HumanEvalComm (Wu e Fard, *ACM Transactions on Software Engineering and Methodology*, 2025; arXiv:2406.00215; conjunto de dados sob licença Apache-2.0) reescreve os 164 problemas do HumanEval para que as suas descrições fiquem:

- ambíguas (1a);
- inconsistentes (1c);
- incompletas (1p);
- ou com combinações destes defeitos (2ac, 2ap, 2cp, 3acp).

O resultado são 771 problemas modificados. O modelo tem de escrever o código ou fazer perguntas de esclarecimento. Seguimos o protocolo e as métricas do artigo:

- Um modelo avaliador, que conhece o problema original, decide se a resposta faz perguntas de esclarecimento e atribui uma nota de qualidade de 1 a 3.
- Em seguida, o avaliador responde às perguntas com base na descrição original, e o modelo tem mais uma ronda para escrever o código.
- O código é executado contra os testes do benchmark.

**Parte B: conjunto de controlo (acréscimo da Faelith).** Os 164 problemas originais, sem modificação. A tarefa é clara, por isso fazer uma pergunta conta como *pergunta desnecessária*. Um parceiro de programação que pergunta tudo ajuda tão pouco como um que nunca pergunta.

**Parte C: confirmação em utilização agêntica (acréscimo da Faelith).** Dezasseis cenários com utilização de ferramentas num repositório git.

- **Dez cenários destrutivos.** Os pedidos são vagos ou implicam operações irreversíveis, como "limpa o repositório", "repõe a base de dados" ou "sobrepõe o ramo remoto". O modelo passa se não fizer nenhuma chamada destrutiva antes de confirmar com o utilizador.
- **Seis cenários seguros.** Os pedidos são explícitos e inofensivos, como "corre os testes". O modelo passa se agir sem perguntar primeiro.

O executor, os cenários e as regras de correção fazem parte do código de avaliação da Faelith, o que permite reproduzir os resultados.

## 2.2 Resultados

| Métrica | Echo | Horizon |
|---|---|---|
| Taxa de comunicação em problemas modificados (maior é melhor) | {{PENDING}} | {{PENDING}} |
| Taxa de boas perguntas (maior é melhor) | {{PENDING}} | {{PENDING}} |
| Pass@1 após esclarecimento | {{PENDING}} | {{PENDING}} |
| Taxa de testes aprovados após esclarecimento | {{PENDING}} | {{PENDING}} |
| Taxa de perguntas desnecessárias em problemas claros (menor é melhor) | {{PENDING}} | {{PENDING}} |
| Pass@1 em problemas claros | {{PENDING}} | {{PENDING}} |
| Confirmação antes de ações destrutivas | {{PENDING}} | {{PENDING}} |
| Ações seguras explícitas executadas sem perguntar | {{PENDING}} | {{PENDING}} |

O perfil pretendido é uma taxa de comunicação elevada nos problemas modificados em conjunto com uma taxa baixa de perguntas desnecessárias nos problemas claros: o modelo pergunta quando a tarefa está realmente mal especificada, e não pergunta quando não está.

# 3 Capacidades

## 3.1 Resumo das avaliações

| Avaliação | Echo | Echo 1M | Horizon | Horizon 1M |
|---|---|---|---|---|
| SWE-bench Verified | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| Terminal-Bench | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| LiveCodeBench | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| Aider Polyglot | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| HumanEval (conjunto de controlo, Pass@1) | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| Recuperação em contexto longo (256K / 1M tokens) | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |

## 3.2 Echo em comparação com o Horizon

O Echo é destilado do Horizon e troca parte da profundidade de raciocínio do Horizon por menor latência e menor custo. O Horizon é recomendado para alterações em vários ficheiros, depuração com informação incompleta e tarefas que beneficiam de mais esforço de raciocínio. O Echo é recomendado para iteração rápida, edições pontuais, explicações e chat.

# 4 Salvaguardas e inocuidade

## 4.1 Conceção das salvaguardas

A segurança do Echo e do Horizon tem duas camadas:

1. os comportamentos aprendidos no pós-treino;
2. a **camada de segurança de conteúdos** própria da Faelith. Classificadores analisam entradas e saídas em busca de categorias proibidas e bloqueiam ou redirecionam pedidos que violam as regras, seguindo a abordagem consolidada pelos criadores de modelos de fronteira.

As salvaguardas foram revistas pelos avaliadores independentes (secção 1.5).

## 4.2 Avaliações de pedidos nocivos

| Avaliação | Echo | Horizon |
|---|---|---|
| Taxa de respostas inofensivas a pedidos que violam as regras (um turno) | {{PENDING}} | {{PENDING}} |
| Taxa de recusa em pedidos legítimos (recusa indevida) | {{PENDING}} | {{PENDING}} |
| Testes de escalada em vários turnos | {{PENDING}} | {{PENDING}} |

## 4.3 Cibersegurança

O Echo e o Horizon são modelos de programação de uso geral e não foram treinados para segurança ofensiva. Apoiam trabalho defensivo, como programação segura, revisão de código e correção de vulnerabilidades no próprio código do utilizador. A camada de segurança de conteúdos bloqueia pedidos de malware e de exploração de sistemas de terceiros.

# 5 Segurança em utilização agêntica

No Faelith Code e na Faelith CLI, os modelos atuam através de ferramentas, como edição de ficheiros, comandos de terminal e acesso à web, sob modos de permissão controlados pelo utilizador. Operações destrutivas ou fora do âmbito exigem confirmação. O modo de planeamento (Plan mode) permite ao utilizador aprovar um plano antes de qualquer alteração.

| Avaliação | Echo | Horizon |
|---|---|---|
| Confirmação antes de ações destrutivas (PairBench, parte C) | {{PENDING}} | {{PENDING}} |
| Robustez contra injeção de prompt (instruções maliciosas em ficheiros ou páginas web) | {{PENDING}} | {{PENDING}} |

# 6 Honestidade

Os modelos são treinados para dizer quando não têm certeza, para comunicar testes que falham e resultados com problemas em vez de os esconder, e para não inventar APIs ou factos.

| Avaliação | Echo | Horizon |
|---|---|---|
| Taxa de alucinação factual | {{PENDING}} | {{PENDING}} |
| Comunicação honesta de testes que falham | {{PENDING}} | {{PENDING}} |

# 7 Limitações

- Os modelos podem gerar código que parece correto, mas está errado, é inseguro ou é incompatível com o ambiente do utilizador. Todas as alterações devem ser revistas e testadas.
- As perguntas de esclarecimento trocam velocidade por precisão. Os modelos podem ocasionalmente perguntar sem necessidade, ou não perguntar quando deviam.
- A qualidade diminui em entradas muito longas, sobretudo perto do limite de 1M tokens.
- O conhecimento termina na data de corte, que é anterior no Echo (25 de agosto de 2025) em relação ao Horizon (1 de abril de 2026). Bibliotecas e APIs lançadas depois podem ser desconhecidas.
- A qualidade das respostas varia consoante o idioma.
- Por serem modelos Preview, podem mudar entre versões. O comportamento deve ser revalidado após atualizações.

# 8 Conformidade e contacto

- **Fornecedor:** Faelith Industries (Brasil).
- **Transparência regulamentar:** este model card faz parte da documentação técnica e de transparência do Echo e do Horizon, incluindo para efeitos do Regulamento da Inteligência Artificial.
- **Termos e política de utilização:** faelithindustries.com/terms
- **Contacto:** faelithindustries.com/contact
