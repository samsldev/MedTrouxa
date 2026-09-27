/**
 * @fileoverview USD to BRL conversion for NFS-e values using the Banco Central PTAX rate.
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
 * - Rate: PTAX selling rate (cotacaoVenda) of the last business day before the payment date
 *   (walks back up to 10 days over weekends and holidays); the rule must be confirmed by the accountant
 * - Source: BCB Olinda OData API CotacaoDolarDia (public, no authentication)
 * - The rate is fixed per invoice when the NFS-e is first rendered and stored with the document
 */

use async_trait::async_trait;
use chrono::{Duration, NaiveDate};
use serde_json::Value;

/// Source of USD/BRL rates.
#[async_trait]
pub trait ExchangeRates: Send + Sync {
    /// Selling PTAX of `day`, or None when there is no quote (weekend or holiday).
    async fn ptax_sell(&self, day: NaiveDate) -> Result<Option<f64>, String>;
}

/// Rate used for a payment made on `paid_on`: the last quote strictly before that day.
pub async fn rate_for_payment(rates: &dyn ExchangeRates, paid_on: NaiveDate) -> Result<(NaiveDate, f64), String> {
    for back in 1..=10 {
        let day = paid_on - Duration::days(back);
        if let Some(rate) = rates.ptax_sell(day).await? {
            return Ok((day, rate));
        }
    }
    Err(format!("no PTAX quote in the 10 days before {paid_on}"))
}

/// Converts USD cents to BRL cents at `rate`, rounding half up.
pub fn usd_to_brl_cents(usd_cents: i64, rate: f64) -> i64 {
    (usd_cents as f64 * rate).round() as i64
}

/// Live client for the BCB Olinda PTAX service.
pub struct BcbPtax {
    http: reqwest::Client,
}

impl BcbPtax {
    /// Wraps a shared HTTP client (bounded timeouts are set by the caller).
    pub fn new(http: reqwest::Client) -> Self {
        Self { http }
    }
}

#[async_trait]
impl ExchangeRates for BcbPtax {
    /// Docs: https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/aplicacao
    async fn ptax_sell(&self, day: NaiveDate) -> Result<Option<f64>, String> {
        let url = format!(
            "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='{}'&$top=1&$format=json",
            day.format("%m-%d-%Y")
        );
        let response = self.http.get(url).send().await.map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            return Err(format!("ptax lookup failed with {}", response.status()));
        }
        let body: Value = response.json().await.map_err(|error| error.to_string())?;
        Ok(body.pointer("/value/0/cotacaoVenda").and_then(Value::as_f64))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Quotes only on weekdays.
    struct Weekdays;

    #[async_trait]
    impl ExchangeRates for Weekdays {
        async fn ptax_sell(&self, day: NaiveDate) -> Result<Option<f64>, String> {
            use chrono::Datelike;
            Ok((day.weekday().number_from_monday() <= 5).then_some(5.2))
        }
    }

    /// A Monday payment uses Friday's quote; conversion rounds to cents.
    #[tokio::test]
    async fn previous_business_day() {
        let monday = NaiveDate::from_ymd_opt(2026, 9, 28).unwrap();
        let (day, rate) = rate_for_payment(&Weekdays, monday).await.unwrap();
        assert_eq!(day, NaiveDate::from_ymd_opt(2026, 9, 25).unwrap());
        assert_eq!(usd_to_brl_cents(2_000, rate), 10_400);
    }
}
