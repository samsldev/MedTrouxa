/**
 * @fileoverview NFS-e Nacional DPS and cancellation-event XML (leiaute 1.01), rendered deterministically in canonical form.
 * @author Samuel S. L.
 * @version 1.0.0
 * @since 2026-09-26
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
 * - Element order, names, and value formats follow the official XSDs DPS_v1.01 / pedRegEvento_v1.01
 *   (namespace http://www.sped.fazenda.gov.br/nfse); text is escaped exactly as XML C14N does, so the
 *   serialized infDPS is byte-identical to its canonical form and the signature digest is stable
 * - DPS Id = "DPS" + IBGE city (7) + inscription type (1 CPF, 2 CNPJ) + CNPJ/CPF (14) + series (5) + number (15)
 * - Event Id = "PRE" + access key (50) + event type (6) + request number (3)
 * - Domestic buyers need a CPF or CNPJ; foreign buyers are an export (tribISSQN 3, cPaisResult, comExt)
 */

use chrono::{DateTime, FixedOffset, NaiveDate};

/// XML namespace of every NFS-e Nacional document.
pub const NFSE_NS: &str = "http://www.sped.fazenda.gov.br/nfse";
/// Layout version sent in the `versao` attribute.
pub const LAYOUT_VERSION: &str = "1.01";
/// BACEN currency code of the US dollar (used in `comExt/tpMoeda`).
pub const BACEN_USD: &str = "220";

/// Target environment (`tpAmb`): 1 production, 2 restricted production (homologation).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Environment {
    Production,
    Homologation,
}

impl Environment {
    /// Value of `tpAmb`.
    pub fn code(self) -> &'static str {
        match self {
            Self::Production => "1",
            Self::Homologation => "2",
        }
    }
}

/// Federal identification of the buyer (`toma`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BuyerId {
    Cpf(String),
    Cnpj(String),
    /// Foreign tax id (VAT, EIN...).
    Nif(String),
    /// Foreign buyer without a tax id (`cNaoNIF`): 1 exempt, 2 not required.
    NoNif(&'static str),
}

/// Foreign postal address (`endExt`), used for export buyers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ForeignAddress {
    pub country: String,
    pub postal_code: String,
    pub city: String,
    pub state: String,
    pub street: String,
    pub number: String,
    pub district: String,
}

/// The buyer of the service.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Buyer {
    pub id: BuyerId,
    pub name: String,
    pub email: Option<String>,
    /// ISO 3166-1 alpha-2 country; `BR` means a domestic sale.
    pub country: String,
    /// Address for foreign buyers (optional in the layout; sent when known).
    pub foreign_address: Option<ForeignAddress>,
}

impl Buyer {
    /// True when the buyer resides abroad (export of services).
    pub fn is_foreign(&self) -> bool {
        self.country != "BR"
    }
}

/// Seller (`prest`) data and tax regime, from configuration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Seller {
    pub cnpj: String,
    pub municipal_registration: Option<String>,
    /// IBGE code of the seller's city (7 digits).
    pub city_code: String,
    /// `opSimpNac`: 1 not a Simples optant, 2 MEI, 3 ME/EPP.
    pub simples_option: String,
    /// `regApTribSN` for ME/EPP (1, 2 or 3); omitted otherwise.
    pub simples_regime: Option<String>,
    /// `regEspTrib` (0 none).
    pub special_regime: String,
}

/// Service classification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServiceCode {
    /// National tax code (`cTribNac`, 6 digits, LC 116 item + subitem + detail).
    pub national: String,
    /// NBS code (`cNBS`, 9 digits).
    pub nbs: String,
}

/// Optional IBS/CBS declaration (Reforma Tributaria); rates are computed by the national system.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IbsCbs {
    pub operation_indicator: String,
    pub cst: String,
    pub class_code: String,
}

/// Everything needed to render one DPS.
#[derive(Debug, Clone, PartialEq)]
pub struct Dps {
    pub environment: Environment,
    pub app_version: String,
    pub series: u32,
    pub number: u64,
    pub issued_at: DateTime<FixedOffset>,
    /// Competence date (`dCompet`): the payment date, never after the issue date.
    pub competence: NaiveDate,
    pub seller: Seller,
    pub buyer: Buyer,
    pub service: ServiceCode,
    pub description: String,
    /// Service value in BRL cents (`vServ`).
    pub value_brl_cents: i64,
    /// Original value in USD cents (`comExt/vServMoeda`, exports only).
    pub value_usd_cents: i64,
    pub ibs_cbs: Option<IbsCbs>,
}

/// Escapes text content exactly as Canonical XML does (`&`, `<`, `>`, carriage return).
pub fn escape_text(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for ch in raw.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '\r' => out.push_str("&#xD;"),
            // Characters XML 1.0 forbids are dropped rather than breaking the document.
            c if (c as u32) < 0x20 && c != '\n' && c != '\t' => {}
            c => out.push(c),
        }
    }
    out
}

/// Keeps only ASCII digits.
pub fn digits(raw: &str) -> String {
    raw.chars().filter(char::is_ascii_digit).collect()
}

/// Truncates to at most `max` characters, trimming whitespace; falls back when empty.
fn bounded(raw: &str, max: usize, fallback: &str) -> String {
    let text: String = raw.trim().chars().take(max).collect();
    if text.trim().is_empty() {
        fallback.to_string()
    } else {
        text.trim().to_string()
    }
}

/// Formats cents as `TSDec15V2` (`123.45`, `0`, `10.00`).
pub fn money(cents: i64) -> String {
    let cents = cents.max(0);
    if cents == 0 {
        "0".to_string()
    } else {
        format!("{}.{:02}", cents / 100, cents % 100)
    }
}

/// True when a CPF has 11 digits, is not a repeated digit, and both check digits match.
pub fn valid_cpf(raw: &str) -> bool {
    let d: Vec<u32> = digits(raw).chars().filter_map(|c| c.to_digit(10)).collect();
    if d.len() != 11 || d.iter().all(|x| *x == d[0]) {
        return false;
    }
    let check = |len: usize| {
        let sum: u32 = d[..len].iter().enumerate().map(|(i, x)| x * (len as u32 + 1 - i as u32)).sum();
        let rest = (sum * 10) % 11;
        if rest == 10 { 0 } else { rest }
    };
    check(9) == d[9] && check(10) == d[10]
}

/// True when a CNPJ has 14 digits, is not a repeated digit, and both check digits match.
pub fn valid_cnpj(raw: &str) -> bool {
    let d: Vec<u32> = digits(raw).chars().filter_map(|c| c.to_digit(10)).collect();
    if d.len() != 14 || d.iter().all(|x| *x == d[0]) {
        return false;
    }
    let check = |len: usize| {
        let weights: Vec<u32> = if len == 12 { vec![5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] } else { vec![6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] };
        let sum: u32 = d[..len].iter().zip(&weights).map(|(x, w)| x * w).sum();
        let rest = sum % 11;
        if rest < 2 { 0 } else { 11 - rest }
    };
    check(12) == d[12] && check(13) == d[13]
}

/// Appends `<tag>escaped</tag>`.
fn el(out: &mut String, tag: &str, value: &str) {
    out.push('<');
    out.push_str(tag);
    out.push('>');
    out.push_str(&escape_text(value));
    out.push_str("</");
    out.push_str(tag);
    out.push('>');
}

impl Dps {
    /// The 45-character DPS identifier (`infDPS/@Id`).
    pub fn id(&self) -> String {
        format!(
            "DPS{}2{:0>14}{:05}{:015}",
            self.seller.city_code,
            digits(&self.seller.cnpj),
            self.series,
            self.number
        )
    }

    /// Canonical `infDPS` element (with the inherited default namespace), the digest input.
    pub fn canonical_inf(&self) -> String {
        format!("<infDPS xmlns=\"{NFSE_NS}\" Id=\"{}\">{}</infDPS>", self.id(), self.inf_body())
    }

    /// Unsigned document; `signature` (a full `<Signature>` element) is appended after `infDPS`.
    pub fn document(&self, signature: &str) -> String {
        format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><DPS xmlns=\"{NFSE_NS}\" versao=\"{LAYOUT_VERSION}\"><infDPS Id=\"{}\">{}</infDPS>{signature}</DPS>",
            self.id(),
            self.inf_body()
        )
    }

    /// Children of `infDPS`, in XSD order.
    fn inf_body(&self) -> String {
        let mut x = String::with_capacity(2048);
        el(&mut x, "tpAmb", self.environment.code());
        el(&mut x, "dhEmi", &self.issued_at.format("%Y-%m-%dT%H:%M:%S%:z").to_string());
        el(&mut x, "verAplic", &bounded(&self.app_version, 20, "Faelith"));
        el(&mut x, "serie", &self.series.to_string());
        el(&mut x, "nDPS", &self.number.to_string());
        el(&mut x, "dCompet", &self.competence.format("%Y-%m-%d").to_string());
        el(&mut x, "tpEmit", "1");
        el(&mut x, "cLocEmi", &self.seller.city_code);
        self.render_seller(&mut x);
        self.render_buyer(&mut x);
        self.render_service(&mut x);
        self.render_values(&mut x);
        if let Some(ibs) = &self.ibs_cbs {
            x.push_str("<IBSCBS>");
            el(&mut x, "finNFSe", "0");
            el(&mut x, "indFinal", if matches!(self.buyer.id, BuyerId::Cpf(_)) { "1" } else { "0" });
            el(&mut x, "cIndOp", &ibs.operation_indicator);
            el(&mut x, "indDest", "0");
            x.push_str("<valores><trib><gIBSCBS>");
            el(&mut x, "CST", &ibs.cst);
            el(&mut x, "cClassTrib", &ibs.class_code);
            x.push_str("</gIBSCBS></trib></valores></IBSCBS>");
        }
        x
    }

    /// `prest`: CNPJ, municipal registration, tax regime.
    fn render_seller(&self, x: &mut String) {
        let s = &self.seller;
        x.push_str("<prest>");
        el(x, "CNPJ", &digits(&s.cnpj));
        if let Some(im) = s.municipal_registration.as_deref().filter(|im| !im.trim().is_empty()) {
            el(x, "IM", im.trim());
        }
        x.push_str("<regTrib>");
        el(x, "opSimpNac", &s.simples_option);
        if let Some(regime) = s.simples_regime.as_deref().filter(|_| s.simples_option == "3") {
            el(x, "regApTribSN", regime);
        }
        el(x, "regEspTrib", &s.special_regime);
        x.push_str("</regTrib></prest>");
    }

    /// `toma`: identification, name, foreign address, e-mail.
    fn render_buyer(&self, x: &mut String) {
        let b = &self.buyer;
        x.push_str("<toma>");
        match &b.id {
            BuyerId::Cpf(cpf) => el(x, "CPF", &digits(cpf)),
            BuyerId::Cnpj(cnpj) => el(x, "CNPJ", &digits(cnpj)),
            BuyerId::Nif(nif) => el(x, "NIF", &bounded(nif, 40, "0")),
            BuyerId::NoNif(code) => el(x, "cNaoNIF", code),
        }
        el(x, "xNome", &bounded(&b.name, 300, "Consumidor"));
        if let Some(addr) = b.foreign_address.as_ref().filter(|_| b.is_foreign()) {
            x.push_str("<end><endExt>");
            el(x, "cPais", &addr.country);
            el(x, "cEndPost", &bounded(&addr.postal_code, 11, "0"));
            el(x, "xCidade", &bounded(&addr.city, 60, "Não informado"));
            el(x, "xEstProvReg", &bounded(&addr.state, 60, "Não informado"));
            x.push_str("</endExt>");
            el(x, "xLgr", &bounded(&addr.street, 255, "Não informado"));
            el(x, "nro", &bounded(&addr.number, 60, "S/N"));
            el(x, "xBairro", &bounded(&addr.district, 60, "Não informado"));
            x.push_str("</end>");
        }
        if let Some(email) = b.email.as_deref().filter(|e| e.contains('@') && e.len() <= 80) {
            el(x, "email", email);
        }
        x.push_str("</toma>");
    }

    /// `serv`: place of service, codes, description, and foreign-trade data for exports.
    fn render_service(&self, x: &mut String) {
        x.push_str("<serv><locPrest>");
        el(x, "cLocPrestacao", &self.seller.city_code);
        x.push_str("</locPrest><cServ>");
        el(x, "cTribNac", &self.service.national);
        el(x, "xDescServ", &bounded(&self.description, 2000, "Servico"));
        el(x, "cNBS", &self.service.nbs);
        x.push_str("</cServ>");
        if self.buyer.is_foreign() {
            x.push_str("<comExt>");
            el(x, "mdPrestacao", "1");
            el(x, "vincPrest", "0");
            el(x, "tpMoeda", BACEN_USD);
            el(x, "vServMoeda", &money(self.value_usd_cents));
            el(x, "mecAFComexP", "01");
            el(x, "mecAFComexT", "01");
            el(x, "movTempBens", "1");
            el(x, "mdic", "0");
            x.push_str("</comExt>");
        }
        x.push_str("</serv>");
    }

    /// `valores`: service value and municipal tax treatment (taxable or export).
    fn render_values(&self, x: &mut String) {
        x.push_str("<valores><vServPrest>");
        el(x, "vServ", &money(self.value_brl_cents));
        x.push_str("</vServPrest><trib><tribMun>");
        if self.buyer.is_foreign() {
            el(x, "tribISSQN", "3");
            el(x, "cPaisResult", &self.buyer.country);
        } else {
            el(x, "tribISSQN", "1");
        }
        el(x, "tpRetISSQN", "1");
        x.push_str("</tribMun><totTrib>");
        el(x, "indTotTrib", "0");
        x.push_str("</totTrib></trib></valores>");
    }
}

/// Cancellation request (event e101101) for an issued NFS-e.
#[derive(Debug, Clone, PartialEq)]
pub struct CancelRequest {
    pub environment: Environment,
    pub app_version: String,
    pub requested_at: DateTime<FixedOffset>,
    pub seller_cnpj: String,
    pub access_key: String,
    /// `cMotivo`: 1 issuing error, 2 service not provided, 9 other.
    pub reason_code: &'static str,
    /// `xMotivo`, 15 to 255 characters.
    pub reason: String,
}

impl CancelRequest {
    /// The 62-character request identifier (`infPedReg/@Id`).
    pub fn id(&self) -> String {
        format!("PRE{}101101001", self.access_key)
    }

    /// Canonical `infPedReg` element, the digest input.
    pub fn canonical_inf(&self) -> String {
        format!("<infPedReg xmlns=\"{NFSE_NS}\" Id=\"{}\">{}</infPedReg>", self.id(), self.inf_body())
    }

    /// Document with the signature appended after `infPedReg`.
    pub fn document(&self, signature: &str) -> String {
        format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?><pedRegEvento xmlns=\"{NFSE_NS}\" versao=\"{LAYOUT_VERSION}\"><infPedReg Id=\"{}\">{}</infPedReg>{signature}</pedRegEvento>",
            self.id(),
            self.inf_body()
        )
    }

    /// Children of `infPedReg`, in XSD order.
    fn inf_body(&self) -> String {
        let mut x = String::with_capacity(512);
        el(&mut x, "tpAmb", self.environment.code());
        el(&mut x, "verAplic", &bounded(&self.app_version, 20, "Faelith"));
        el(&mut x, "dhEvento", &self.requested_at.format("%Y-%m-%dT%H:%M:%S%:z").to_string());
        el(&mut x, "CNPJAutor", &digits(&self.seller_cnpj));
        el(&mut x, "chNFSe", &self.access_key);
        el(&mut x, "nPedRegEvento", "1");
        x.push_str("<e101101>");
        el(&mut x, "xDesc", "Cancelamento de NFS-e");
        el(&mut x, "cMotivo", self.reason_code);
        let mut reason = bounded(&self.reason, 255, "Cancelamento solicitado pelo prestador");
        while reason.chars().count() < 15 {
            reason.push('.');
        }
        el(&mut x, "xMotivo", &reason);
        x.push_str("</e101101>");
        x
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use chrono::TimeZone;

    /// A domestic DPS fixture.
    pub(crate) fn fixture(buyer: Buyer) -> Dps {
        Dps {
            environment: Environment::Homologation,
            app_version: "Faelith_1.0".into(),
            series: 1,
            number: 3180,
            issued_at: FixedOffset::west_opt(3 * 3600).unwrap().with_ymd_and_hms(2026, 9, 26, 10, 0, 0).unwrap(),
            competence: NaiveDate::from_ymd_opt(2026, 9, 25).unwrap(),
            seller: Seller {
                cnpj: "11.222.333/0001-81".into(),
                municipal_registration: None,
                city_code: "3170206".into(),
                simples_option: "3".into(),
                simples_regime: Some("1".into()),
                special_regime: "0".into(),
            },
            buyer,
            service: ServiceCode { national: "010301".into(), nbs: "123456789".into() },
            description: "Assinatura Faelith Pro <mensal> & uso".into(),
            value_brl_cents: 10_950,
            value_usd_cents: 2_000,
            ibs_cbs: None,
        }
    }

    /// The Id has 45 characters with CNPJ type 2, zero-padded series and number.
    #[test]
    fn dps_id_layout() {
        let dps = fixture(Buyer { id: BuyerId::Cpf("123.456.789-09".into()), name: "Ana".into(), email: None, country: "BR".into(), foreign_address: None });
        assert_eq!(dps.id(), "DPS317020621122233300018100001000000000003180");
        assert_eq!(dps.id().len(), 45);
    }

    /// Domestic sale: CPF buyer, taxable ISS, escaped description, no comExt.
    #[test]
    fn domestic_document() {
        let dps = fixture(Buyer { id: BuyerId::Cpf("123.456.789-09".into()), name: "Ana".into(), email: Some("ana@example.com".into()), country: "BR".into(), foreign_address: None });
        let doc = dps.document("");
        assert!(doc.contains("<toma><CPF>12345678909</CPF><xNome>Ana</xNome><email>ana@example.com</email></toma>"));
        assert!(doc.contains("<tribISSQN>1</tribISSQN><tpRetISSQN>1</tpRetISSQN>"));
        assert!(doc.contains("Assinatura Faelith Pro &lt;mensal&gt; &amp; uso"));
        assert!(doc.contains("<vServ>109.50</vServ>"));
        assert!(doc.contains("<regTrib><opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib></regTrib>"));
        assert!(!doc.contains("comExt"));
        assert!(dps.canonical_inf().starts_with("<infDPS xmlns=\"http://www.sped.fazenda.gov.br/nfse\" Id=\"DPS"));
    }

    /// Export: foreign buyer without NIF, ISS export code, destination country, comExt in USD.
    #[test]
    fn export_document() {
        let buyer = Buyer {
            id: BuyerId::NoNif("2"),
            name: "John Doe".into(),
            email: None,
            country: "US".into(),
            foreign_address: Some(ForeignAddress {
                country: "US".into(),
                postal_code: "94105".into(),
                city: "San Francisco".into(),
                state: "CA".into(),
                street: "Market St".into(),
                number: "".into(),
                district: "".into(),
            }),
        };
        let doc = fixture(buyer).document("");
        assert!(doc.contains("<cNaoNIF>2</cNaoNIF><xNome>John Doe</xNome><end><endExt><cPais>US</cPais>"));
        assert!(doc.contains("<nro>S/N</nro><xBairro>Não informado</xBairro>"));
        assert!(doc.contains("<tribISSQN>3</tribISSQN><cPaisResult>US</cPaisResult>"));
        assert!(doc.contains("<tpMoeda>220</tpMoeda><vServMoeda>20.00</vServMoeda>"));
    }

    /// Cancellation Id is 62 characters and the reason is padded to the 15-character minimum.
    #[test]
    fn cancel_event() {
        let request = CancelRequest {
            environment: Environment::Homologation,
            app_version: "Faelith_1.0".into(),
            requested_at: FixedOffset::west_opt(3 * 3600).unwrap().with_ymd_and_hms(2026, 9, 26, 10, 0, 0).unwrap(),
            seller_cnpj: "11222333000181".into(),
            access_key: "3".repeat(50),
            reason_code: "2",
            reason: "Reembolso".into(),
        };
        assert_eq!(request.id().len(), 62);
        let doc = request.document("");
        assert!(doc.contains("<nPedRegEvento>1</nPedRegEvento><e101101><xDesc>Cancelamento de NFS-e</xDesc><cMotivo>2</cMotivo><xMotivo>Reembolso......</xMotivo>"));
    }

    /// Check digits of CPF and CNPJ.
    #[test]
    fn document_numbers() {
        assert!(valid_cpf("123.456.789-09"));
        assert!(!valid_cpf("123.456.789-00"));
        assert!(!valid_cpf("111.111.111-11"));
        assert!(valid_cnpj("11.222.333/0001-81"));
        assert!(!valid_cnpj("11.222.333/0001-80"));
    }

    /// Money follows TSDec15V2.
    #[test]
    fn money_format() {
        assert_eq!(money(0), "0");
        assert_eq!(money(5), "0.05");
        assert_eq!(money(1_000), "10.00");
    }
}
