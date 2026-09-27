/**
 * @fileoverview Legal content: Terms of Service Markdown for the public /terms page.
 * @author Samuel S. L.
 * @version 1.4.0
 * @since 2026-09-14
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
 * <DETAILED_DESCRIPTION>:
 * - One document covering consumer and commercial use of the Services
 *   (website, desktop app, CLI, Chat, Code and the API)
 * - Structure follows the conventions of leading model providers: who we
 *   are, account, permitted and prohibited use, inputs and outputs,
 *   retention, fees, IP, warranties, liability, termination, law
 * - Facts mirror the product: ZDR inference, encrypted Faelith capture,
 *   prepaid credits, rolling meters, and no free plan
 * - Model provenance is stated once, briefly, under "Our models"
 * - `##` headings feed the "On this page" rail; keep them short
 */

export const TERMS_EFFECTIVE = '2026-09-26';
export const TERMS_VERSION = '1.3';

export const TERMS_BODY = `
These Terms of Service (the **"Terms"**) are an agreement between you and Faelith Industries (**"Faelith"**, **"we"**, **"us"**). They govern your access to and use of the Faelith website, the Faelith desktop application, the \`faelith\` command-line tool, Faelith Chat, Faelith Code, the Faelith API and any related software, documentation and support (together, the **"Services"**).

By creating an account, installing our software, or otherwise using the Services, you agree to these Terms. If you are using the Services on behalf of a company or another legal entity, you represent that you have authority to bind that entity, and "you" refers to that entity. If you do not agree, do not use the Services.

## 1. Who we are

Faelith Industries builds and operates the Services from Brazil. You can reach us through the [Contact](/contact) page. Where these Terms refer to "applicable law", they include the laws of Brazil, including the Consumer Defense Code (Law 8,078/1990) and the General Data Protection Law (LGPD, Law 13,709/2018), the laws of the European Union where they apply to you, and any other law that applies to you where you use the Services.

## 2. Eligibility and your account

- You must be at least 18 years old, or the age of majority where you live if that is higher, to use the Services.
- You need an account to use most of the Services. You agree to provide accurate information, keep it current and keep your password and API keys confidential.
- **API keys are credentials.** Anything done with a key issued to your account is treated as done by you. Do not share keys, embed them in client-side code or commit them to public repositories. You can revoke a key at any time under **Dashboard, API Keys**; revoke immediately if you suspect exposure.
- You are responsible for all activity under your account and for anyone you allow to use it. Tell us promptly if you become aware of unauthorised access.
- We may refuse, suspend or close accounts that violate these Terms or that we reasonably believe pose a risk to the Services, to other users or to third parties.

## 3. Our models

The Services are powered by two model families, **Echo** and **Horizon**, in 256k and 1M context variants. These models are built on top of the open base weights of the DeepSeek V4 family (Echo on DeepSeek V4 Flash, Horizon on DeepSeek V4 Pro) and then further trained, aligned, evaluated and served by Faelith. The upstream base weights are used under their published licence; the resulting Faelith models, their training data, tooling, prompts and serving infrastructure are Faelith's. Model names, aliases and capabilities may change over time as described in the [Changelog](/changelog).

## 4. Using the Services

Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable right to use the Services for your own internal business purposes or personal use, including building and operating your own applications on the API.

You agree not to, and not to help anyone else to:

- use the Services to develop, train or improve a foundation model or any model that competes with the Services, including by systematically extracting outputs for that purpose;
- reverse engineer, decompile or otherwise attempt to obtain the weights, source code, system prompts or underlying components of the Services, except to the extent applicable law forbids that restriction;
- circumvent rate limits, usage meters, safety systems, authentication or any other protective measure, or access the Services by means other than the interfaces we provide;
- resell, sublicense, time-share or otherwise make the Services available to third parties as a stand-alone offering, except through your own application that adds material functionality;
- misrepresent output as human-generated where a reasonable person would be misled, or remove notices that content was produced with the assistance of AI where we or the law require such notices;
- interfere with the integrity or performance of the Services, probe or test their vulnerability without written permission, or introduce malicious code.

## 5. Prohibited uses

You may not use the Services, and may not allow your users to use them, to:

- violate any applicable law, regulation or third-party right, including intellectual property, privacy and export-control laws;
- generate or distribute child sexual abuse material, or sexual content involving minors in any form;
- facilitate violence, terrorism, human trafficking, or the development, acquisition or use of weapons capable of causing mass casualties, including chemical, biological, radiological, nuclear or high-yield explosive weapons;
- create malware, conduct unauthorised intrusion, or otherwise compromise the security of any system, network or account;
- generate fraudulent, deceptive or abusive content, including scams, phishing, impersonation of real people or organisations, coordinated inauthentic behaviour or non-consensual intimate imagery;
- make automated decisions that produce legal or similarly significant effects on individuals (for example in employment, credit, housing, insurance, education or access to essential services) without meaningful human review and the safeguards required by law;
- operate the Services in high-risk settings where failure could lead to death, serious injury or severe environmental or property damage, unless you have implemented appropriate human oversight and we have agreed to that use in writing;
- harass, threaten, defame or discriminate against any person, or generate hate speech.

We may investigate suspected violations, remove or refuse to process content, throttle or suspend access, and report unlawful activity to authorities.

## 6. Your inputs and outputs

**Inputs** are the prompts, files, code, repositories, attachments and other content you submit to the Services. **Outputs** are the responses the Services generate for you.

- You retain ownership of your Inputs. You represent that you have the rights needed to submit them and that doing so does not violate these Terms or any third-party right.
- As between you and Faelith, and to the extent permitted by law, we assign to you all of our rights, title and interest in Outputs. You may use Outputs for any lawful purpose, subject to these Terms.
- Outputs are generated by machine learning and may be inaccurate, incomplete, out of date, or similar to outputs generated for other users. **You must evaluate Outputs for your use case before relying on them**, and you are responsible for any decisions you make or actions you take based on them. Code produced by Code and the CLI should be reviewed and tested like code from any other contributor.
- The Services can perform actions in your environment on your instruction (for example editing files, running commands or making network requests). You are responsible for the permissions you grant, for reviewing proposed actions, and for the consequences of actions carried out in your environment.

**Output marking (watermark).** To comply with Regulation (EU) 2024/1689 (the EU Artificial Intelligence Act), in particular the transparency obligations for providers of AI systems that generate synthetic content, and with comparable laws, Outputs, including source code, may carry technical markings (a "watermark") in a machine-readable format that allow them to be identified as AI-generated.

- The watermark is a compliance and protective measure only. It does not affect your ownership of or your right to use Outputs under this Section, does not restrict lawful use, and is not used by Faelith to monitor, profile or evaluate you or your users.
- Faelith will not inspect, decode or verify the watermark in, or otherwise examine, code or other Outputs you generate, except (a) when required by a final or enforceable order of a competent court, (b) in response to a legally binding request from a competent public authority, or (c) where strictly necessary to establish, exercise or defend legal claims in judicial proceedings. Any such verification is limited to what the order, request or proceeding requires, and, where the law permits, we will notify you beforehand.
- You agree not to remove, alter, obscure or circumvent the watermark, or to attempt to do so, where that would breach applicable law or be used to present AI-generated content as human-made in a way that could mislead others.

## 7. Data handling

Faelith uses **zero data retention (ZDR)** inference. Faelith separately retains, for 90 days in Faelith-controlled S3, an envelope-encrypted copy of the complete model input, complete model output and complete transcript supplied with each request. This includes system, developer, user, assistant and tool messages; reasoning output; tool calls and results; file reads and writes; grep/search results; retries; and streamed output. This policy applies to every key and does not change pricing.

We also process account data, billing records, usage metadata (such as token counts, model, timestamps and error codes) and security logs to operate the Services. Our processing of personal data is described in the Privacy Notice and, where you provide personal data of third parties through the API, in our Data Processing Addendum. We comply with Brazil's Lei Geral de Proteção de Dados (LGPD) and, where applicable, the EU General Data Protection Regulation and comparable laws. Do not submit special categories of personal data, payment card numbers or regulated health information unless a written agreement with us expressly allows it.

## 8. Plans, credits and fees

- **Subscriptions** grant rolling usage meters for Code and Chat as described on the [Pricing](/pricing) page and in the [Docs](/docs/plans-and-usage). Subscriptions renew automatically at the end of each billing period until cancelled. You may cancel at any time; the plan stays active until the end of the paid period.
- **Right of withdrawal.** Where the law of your billing country gives consumers a right to withdraw from distance contracts (for example Brazil, the European Union, the United Kingdom and others), you may cancel your first subscription within that period (7 or 14 days depending on the country) from **Billing & Invoices** and receive a full refund; your keys stop working immediately. This applies once per customer and payment card. During this period, subscription requests are served by Horizon Preview, and credit packs cannot be purchased. After the period, cancelling stops renewal and the plan remains active until the end of the paid month or year, without a refund.
- **Promotional offers (50% off one month).** Both offers below apply only to monthly subscriptions and follow the same rules: the discounted month costs 50% of the plan's list price, the plan's usage allowances are halved for that month, and usage beyond the included allowance in that month is billed at our provider cost instead of the published rate card. After the discounted month the subscription renews at the full price and the full allowances unless you cancel.
  - **Introductory offer.** Available on your first subscription only, once per account and per email address, when offered on a Faelith landing page. The discount applies to your first month.
  - **Retention offer.** When you cancel a monthly subscription after the withdrawal period has ended, we may offer 50% off your next month instead. If you accept, the discount applies to your next renewal and any pending cancellation is withdrawn, so the subscription keeps renewing. Whether and when the retention offer is shown again after you use it, or after an introductory offer, is at our discretion. Declining the offer has no effect on the cancellation.
  - The offers are discretionary: we may change or withdraw them for future acceptances at any time, they cannot be combined with each other or with other discounts on the same month, have no cash value, and do not extend or restart the withdrawal period.
- **Prepaid credits** fund API usage. Credits are debited per token at the published rate card for the model in force at the time of the request. Credits are non-refundable except where required by law, do not accrue interest and expire twelve months after purchase unless a longer period is required by applicable law.
- There is no free plan. Prices are shown in US dollars and exclude taxes, which we collect where required. You authorise us and our payment processor to charge your payment method for all fees and applicable taxes.
- We may change prices and meters with at least 30 days' notice on the website or by email. Changes apply to the next billing period; if you do not agree, cancel before the change takes effect.
- Usage may be estimated in real time and reconciled afterwards. If you believe a charge is wrong, contact us within 60 days of the charge.

## 9. Third-party services and open source

The Services interoperate with third-party services you choose to connect, such as source-code hosts, model-context servers, package registries and payment providers. Those services are governed by their own terms, and we are not responsible for them. The software includes open-source components licensed under their own terms, which are listed in the software and prevail over these Terms for those components to the extent of any conflict.

## 10. Intellectual property and feedback

Except for the rights expressly granted to you in these Terms, Faelith and its licensors own all rights in the Services, including the models, software, documentation, trademarks and the look and feel of the Services. If you send us feedback, suggestions or ideas, you grant us a perpetual, irrevocable, worldwide, royalty-free licence to use them without obligation to you.

## 11. Beta and preview features

We may offer features marked as beta, preview, experimental or similar. They are provided as-is, may change or be withdrawn without notice, may be subject to additional terms, and are excluded from any uptime or support commitments.

## 12. Suspension and termination

You may stop using the Services and close your account at any time from **Dashboard, Settings**. We may suspend or terminate your access if you materially breach these Terms, if your account is inactive for more than twelve months with no remaining credits, if required by law, or if continuing to provide the Services to you would create legal or security risk for us. Where reasonable, we will notify you and give you an opportunity to remedy the issue first. On termination your right to use the Services ends, unused subscription time is not refunded except where required by law, and we will delete or return your data as described in Section 7. Sections that by their nature should survive termination do so.

## 13. Disclaimers

The Services are provided "as is" and "as available". To the fullest extent permitted by law, we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, non-infringement and any warranties arising from course of dealing. We do not warrant that the Services will be uninterrupted, error-free, or that Outputs will be accurate, complete or fit for any purpose. Nothing in these Terms limits rights that consumers have under mandatory law where they live.

## 14. Limitation of liability

To the fullest extent permitted by law, neither Faelith nor its suppliers will be liable for any indirect, incidental, special, consequential or punitive damages, or for lost profits, revenue, data or goodwill, arising out of or related to the Services or these Terms, however caused and under any theory of liability, even if advised of the possibility. Our total aggregate liability arising out of or relating to the Services or these Terms will not exceed the greater of the amounts you paid us in the twelve months before the event giving rise to the claim and one hundred US dollars. These limitations do not apply to liability that cannot be limited under applicable law, including liability for death or personal injury caused by negligence, for fraud, or for intent or gross negligence.

## 15. Indemnification

If you are a business, you will defend, indemnify and hold harmless Faelith and its officers, employees and agents from any third-party claim, and related costs and reasonable legal fees, arising from your Inputs, your applications, your use of Outputs or your breach of these Terms or applicable law, except to the extent the claim results from our breach.

## 16. Export control and sanctions

You represent that you are not located in, and are not a national or resident of, a country or territory subject to comprehensive sanctions by Brazil, the United Nations, the European Union or the United States, and that you are not on any relevant restricted-party list. You will comply with all applicable export-control and sanctions laws when using the Services.

## 17. Governing law and disputes

These Terms are governed by the laws of the Federative Republic of Brazil, without regard to conflict-of-law rules. The courts of the place of Faelith's registered office in Brazil have jurisdiction over disputes arising from these Terms, except that consumers may always bring proceedings in the courts of their own domicile, as guaranteed by the Brazilian Consumer Defense Code, and consumers resident in the European Union or another country may also bring proceedings in the courts of their country of residence and keep the mandatory consumer-protection rules of that country. Before going to court, you may contact us through the [Contact](/contact) page, and Brazilian consumers may also use the public platform consumidor.gov.br. The United Nations Convention on Contracts for the International Sale of Goods does not apply.

## 18. Changes to these Terms

We may update these Terms from time to time. For material changes we will give at least 30 days' notice by posting the new Terms on the website and, where we have your email address, by email. Continued use of the Services after the effective date constitutes acceptance. If you do not agree, stop using the Services and close your account before the changes take effect. The effective date and version are shown at the top of this page.

## 19. General

These Terms, together with any order form, the Privacy Notice and any Data Processing Addendum, are the entire agreement between you and Faelith regarding the Services. If any provision is found unenforceable, the rest remains in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition or sale of assets. Notices to you may be given by email to the address on your account or by posting on the website. The English version of these Terms controls over any translation.

## 20. Contact

Questions about these Terms can be sent through the [Contact](/contact) page. For security reports, include "security" in the subject line and we will acknowledge within two business days.
`;
