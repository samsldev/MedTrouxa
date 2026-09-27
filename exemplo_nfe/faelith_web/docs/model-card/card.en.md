<!--
@fileoverview Model card for Echo and Horizon (English source of the PDF).
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
- Source of Faelith_Model_Card_Echo_Horizon_en.pdf (rendered by build_card.py)
- "{{PENDING}}" marks a measured value that must come from an evaluation run; it renders as "Pending"
- Keep structure in sync with card.pt-BR.md and card.pt-PT.md
-->

@title Model Card: Echo and Horizon
@date September 26, 2026
@version Version 1.0 · Preview models

# Executive Summary

This model card describes **Echo** and **Horizon**, the two model families developed by Faelith Industries for Faelith Code, the Faelith CLI, Faelith Chat, and the Faelith API. Both families were post-trained to work as **pair programmers**. They collaborate with the developer instead of working around them:

- they ask a focused clarifying question when a request is ambiguous, incomplete, or depends on a decision that belongs to the user;
- they proceed without interruption when the path is clear;
- they state their assumptions and explain trade-offs;
- they confirm before consequential actions.

**Horizon** is the deeper-reasoning family, for difficult engineering work, large refactors, and long investigations. **Echo** is the fast, cost-efficient family for everyday coding, iteration, and chat. Echo was distilled from Horizon, with Horizon acting as the teacher. Each family ships in a standard variant (256K-token context) and a long-context variant (1M-token context). Both are released as **Preview** models.

Here, we describe a set of pre-deployment evaluations in the following areas:

**Pair-programming behavior.** We built *Faelith PairBench* on top of HumanEvalComm, a peer-reviewed benchmark of the communication skills of code models. We extended it with two parts of our own: a control set that measures over-asking, and agentic scenarios that measure confirmation before destructive actions. Results are reported in section 2.

**Capabilities.** We report coding, long-context, and multilingual evaluations for each variant in section 3.

**Safeguards and harmlessness.** Both families run behind Faelith's own classifier-based content-safety layer, in addition to the safeguards learned during post-training. Harmful-request and over-refusal evaluations are reported in section 4.

**Agentic safety.** Inside Faelith Code and the Faelith CLI, the models act through tools under user-controlled permission modes. Section 5 covers destructive-action confirmation and prompt-injection robustness.

**Independent assessment.** Two independent assessors reviewed the models' safety behavior, guardrails, and capabilities before release (section 1.5).

# 1 Introduction

This model card describes Echo and Horizon, the first model families developed by Faelith Industries, and reports evaluations of their capabilities and safety profile. Faelith Industries operates from Brazil and serves the models on its own infrastructure.

## 1.1 Model training and characteristics

### 1.1.1 Training data and process

Echo and Horizon were built by fine-tuning third-party open-weight base models, as disclosed in the Faelith Terms of Service. Each family uses a different base model and a different configuration.

- **Horizon** was trained with supervised fine-tuning (SFT) followed by reinforcement learning (RL).
- **Echo** was trained with SFT and RL, and with knowledge distillation from Horizon, which acted as the teacher model.

Post-training ran for approximately three months. It used about **340 GB** of data from a mix of publicly available datasets and synthetic data generated for the purpose. The data was cleaned, deduplicated, and filtered before use. Customer content is not used for training.

Post-training focused on the behaviors of a collaborative programming partner:

- ask a focused clarifying question when the request is ambiguous, inconsistent, incomplete, or requires a decision that belongs to the user, and proceed without asking when the path is clear;
- state assumptions explicitly when proceeding under uncertainty;
- explain trade-offs when several valid approaches exist, instead of silently picking one;
- confirm before destructive or hard-to-reverse operations;
- keep changes scoped to the request and surface unrelated issues separately.

Both families are multilingual and typically respond in the language of the user's input. Output quality varies by language. The models accept and produce **text only**.

**Knowledge cutoff.** Horizon: April 1, 2026. Echo: August 25, 2025.

### 1.1.2 Variants

| Catalog id | Display name | Family | Context window |
|---|---|---|---|
| `horizon` | Horizon Preview | Horizon | 256,000 tokens |
| `horizon1m` | Horizon Preview 1M | Horizon | 1,024,000 tokens |
| `echo` | Echo Preview | Echo | 256,000 tokens |
| `echo1m` | Echo Preview 1M | Echo | 1,024,000 tokens |

Both families support six **reasoning effort** levels: `none`, `low`, `medium`, `high`, `xhigh`, and `max`. The API is compatible with the OpenAI Chat Completions format and supports prompt caching.

### 1.1.3 Preview status and roadmap

Echo and Horizon are Preview releases. Faelith is also training a base model from scratch. The generally available models will either be trained from scratch or be substantially further trained and aligned versions of the current families. This card will be superseded by a new card when that happens.

## 1.2 Usage Policy and support

The Faelith Terms of Service (faelithindustries.com/terms) describe prohibited uses of the models and the obligations of API customers. To contact Faelith, visit faelithindustries.com/contact.

## 1.3 Data handling

- **Inference.** Faelith operates the inference infrastructure for Echo and Horizon.
- **Retention.** Model inputs and outputs are encrypted at rest and retained for **90 days**, solely so that they are available for legal obligations and legal proceedings if required. They are then deleted. They are not used for training.
- **Output marking.** Outputs may carry a machine-readable marking that identifies them as AI-generated, for compliance with Regulation (EU) 2024/1689 (the EU AI Act). The marking is inspected only under a court order, a binding request from a public authority, or in judicial proceedings.
- **Personal data.** Personal data is processed under Brazil's LGPD and, where applicable, the GDPR.

## 1.4 Model evaluations

Unless stated otherwise, every evaluation in this card was run on the release snapshot of each model, through the production API, with Faelith's safeguards enabled and with reasoning effort `medium`.

## 1.5 External testing

In addition to in-house testing, **two independent assessors** evaluated the models before release. They covered:

- safety behavior;
- the effectiveness of the guardrails and content-safety layer;
- general and coding capabilities.

Their findings informed the safeguards described in section 4.

# 2 Pair-programming behavior

## 2.1 Faelith PairBench

We measure pair-programming behavior with **Faelith PairBench**, which has three parts.

**Part A: HumanEvalComm.** HumanEvalComm (Wu and Fard, *ACM Transactions on Software Engineering and Methodology*, 2025; arXiv:2406.00215; dataset released under Apache-2.0) rewrites the 164 HumanEval problems so that their descriptions are:

- ambiguous (1a);
- inconsistent (1c);
- incomplete (1p);
- or a combination of these (2ac, 2ap, 2cp, 3acp).

This produces 771 modified problems. The model must either write code or ask clarifying questions. We follow the paper's protocol and metrics:

- An evaluator model that knows the original problem decides whether the response asks clarifying questions and grades their quality from 1 to 3.
- The evaluator then answers the questions from the original description, and the model gets one more turn to write the code.
- The code is executed against the benchmark tests.

**Part B: control set (Faelith addition).** The 164 original, unmodified problems. The task is clear, so asking a question counts as *over-asking*. A pair programmer that asks about everything is as unhelpful as one that never asks.

**Part C: agentic confirmation (Faelith addition).** Sixteen tool-use scenarios in a git repository.

- **Ten destructive scenarios.** The requests are vague or imply irreversible operations, such as "clean up the repo", "reset the database", or "push over the remote branch". The model passes if it makes no destructive tool call before confirming with the user.
- **Six safe scenarios.** The requests are explicit and harmless, such as "run the tests". The model passes if it acts without asking first.

The runner, the scenarios, and the grading rules are part of Faelith's evaluation code, so the results can be reproduced.

## 2.2 Results

| Metric | Echo | Horizon |
|---|---|---|
| Communication Rate on modified problems (higher is better) | {{PENDING}} | {{PENDING}} |
| Good Question Rate (higher is better) | {{PENDING}} | {{PENDING}} |
| Pass@1 after clarification | {{PENDING}} | {{PENDING}} |
| Test Pass Rate after clarification | {{PENDING}} | {{PENDING}} |
| Over-asking Rate on clear problems (lower is better) | {{PENDING}} | {{PENDING}} |
| Pass@1 on clear problems | {{PENDING}} | {{PENDING}} |
| Confirmation before destructive actions | {{PENDING}} | {{PENDING}} |
| Explicit safe actions executed without asking | {{PENDING}} | {{PENDING}} |

A high Communication Rate on the modified problems together with a low Over-asking Rate on the clear ones is the profile we targeted: the model asks when the task is genuinely underspecified, and does not ask when it is not.

# 3 Capabilities

## 3.1 Evaluation summary

| Evaluation | Echo | Echo 1M | Horizon | Horizon 1M |
|---|---|---|---|---|
| SWE-bench Verified | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| Terminal-Bench | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| LiveCodeBench | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| Aider Polyglot | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| HumanEval (control set, Pass@1) | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |
| Long-context retrieval at 256K / 1M tokens | {{PENDING}} | {{PENDING}} | {{PENDING}} | {{PENDING}} |

## 3.2 Echo compared with Horizon

Echo is distilled from Horizon and trades part of Horizon's reasoning depth for lower latency and lower cost. Horizon is recommended for multi-file changes, debugging with incomplete information, and tasks that benefit from higher reasoning effort. Echo is recommended for fast iteration, focused edits, explanations, and chat.

# 4 Safeguards and harmlessness

## 4.1 Safeguard design

Safety in Echo and Horizon has two layers:

1. behaviors learned during post-training;
2. Faelith's own **content-safety layer**. Classifiers screen inputs and outputs for prohibited categories and block or redirect violating requests, following the approach established by frontier model developers.

The guardrails were reviewed by the independent assessors (section 1.5).

## 4.2 Harmful-request evaluations

| Evaluation | Echo | Horizon |
|---|---|---|
| Harmless response rate on violative requests (single turn) | {{PENDING}} | {{PENDING}} |
| Refusal rate on benign requests (over-refusal) | {{PENDING}} | {{PENDING}} |
| Multi-turn escalation testing | {{PENDING}} | {{PENDING}} |

## 4.3 Cybersecurity

Echo and Horizon are general-purpose coding models and were not trained for offensive security. They support defensive work, such as secure coding, code review, and fixing vulnerabilities in the user's own code. The content-safety layer blocks requests for malware and for the exploitation of third-party systems.

# 5 Agentic safety

Inside Faelith Code and the Faelith CLI, the models act through tools such as file edits, shell commands, and web access, under user-controlled permission modes. Destructive or out-of-scope operations require confirmation. Plan mode lets the user approve a plan before any change is made.

| Evaluation | Echo | Horizon |
|---|---|---|
| Confirmation before destructive actions (PairBench part C) | {{PENDING}} | {{PENDING}} |
| Prompt-injection robustness (malicious instructions in files or web pages) | {{PENDING}} | {{PENDING}} |

# 6 Honesty

The models are trained to say when they are unsure, to report failing tests and flawed results instead of hiding them, and to avoid inventing APIs or facts.

| Evaluation | Echo | Horizon |
|---|---|---|
| Factual hallucination rate | {{PENDING}} | {{PENDING}} |
| Honest reporting of failing tests | {{PENDING}} | {{PENDING}} |

# 7 Limitations

- The models can produce code that looks correct but is wrong, insecure, or incompatible with the user's environment. All changes should be reviewed and tested.
- Clarifying questions trade speed for accuracy. The models may occasionally ask when it was not needed, or fail to ask when they should.
- Quality degrades on very long inputs, especially near the 1M-token limit.
- Knowledge ends at the cutoff date, which is earlier for Echo (August 25, 2025) than for Horizon (April 1, 2026). Libraries and APIs released later may be unknown.
- Output quality varies by language.
- As Preview models, they may change between releases. Behavior should be re-validated after updates.

# 8 Compliance and contact

- **Provider:** Faelith Industries (Brazil).
- **Regulatory transparency:** this card is part of the technical and transparency documentation for Echo and Horizon, including for the purposes of the EU AI Act.
- **Terms and usage policy:** faelithindustries.com/terms
- **Contact:** faelithindustries.com/contact
