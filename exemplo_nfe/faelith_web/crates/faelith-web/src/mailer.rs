/**
 * @fileoverview Transactional email delivery (SMTP in production, memory in tests).
 * @author Samuel S. L.
 * @version 1.1.0
 * @since 2026-09-23
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
 * - Provider-agnostic SMTP (SES, Postmark, Resend, Brevo...) over rustls with a pooled transport
 * - STARTTLS (587) and implicit TLS (465); plaintext only for a loopback dev relay such as Mailpit
 * - Log mailer is a dev-only opt-in that prints codes; production refuses to start without SMTP
 * - Every message is multipart/alternative (plain text + HTML) for deliverability
 * Primary docs: https://docs.rs/lettre/0.11.23/lettre/
 * https://www.rfc-editor.org/rfc/rfc8314
 */

use crate::config::{SmtpConfig, SmtpSecurity};
use async_trait::async_trait;
use lettre::message::{Mailbox, MultiPart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use std::sync::Mutex;
use std::time::Duration;

/// SMTP round-trip budget so a stalled relay cannot pin a request forever.
const SMTP_TIMEOUT: Duration = Duration::from_secs(15);

/// One rendered transactional message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OutgoingEmail {
    pub to: String,
    pub subject: String,
    pub text: String,
    pub html: String,
}

/// Delivers transactional email. Errors are operator-facing and never contain secrets.
#[async_trait]
pub trait Mailer: Send + Sync {
    /// Sends one message, returning once the relay accepted it.
    async fn send(&self, email: OutgoingEmail) -> Result<(), String>;
}

/// Production mailer backed by a pooled async SMTP transport.
pub struct SmtpMailer {
    transport: AsyncSmtpTransport<Tokio1Executor>,
    from: Mailbox,
}

impl SmtpMailer {
    /// Builds the transport from configuration without opening a connection.
    ///
    /// `relay`/`starttls_relay` enforce certificate validation against the
    /// webpki roots; `Plain` is refused unless the host is loopback.
    pub fn new(config: &SmtpConfig) -> Result<Self, String> {
        let from: Mailbox = config
            .from
            .parse()
            .map_err(|err| format!("MAIL_FROM is not a valid mailbox: {err}"))?;
        let builder = match config.security {
            SmtpSecurity::StartTls => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&config.host)
                .map_err(|err| format!("smtp starttls relay: {err}"))?,
            SmtpSecurity::Tls => AsyncSmtpTransport::<Tokio1Executor>::relay(&config.host)
                .map_err(|err| format!("smtp tls relay: {err}"))?,
            SmtpSecurity::Plain => {
                if !is_loopback_host(&config.host) {
                    return Err("SMTP_SECURITY=plain is only allowed for a loopback relay".to_string());
                }
                AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
            }
        };
        let mut builder = builder.port(config.port).timeout(Some(SMTP_TIMEOUT));
        if let (Some(user), Some(pass)) = (&config.username, &config.password) {
            builder = builder.credentials(Credentials::new(user.clone(), pass.clone()));
        }
        Ok(Self {
            transport: builder.build(),
            from,
        })
    }

    /// Opens a connection and runs NOOP so a bad relay fails at startup, not at signup.
    pub async fn verify(&self) -> Result<(), String> {
        match self.transport.test_connection().await {
            Ok(true) => Ok(()),
            Ok(false) => Err("smtp relay rejected the connection test".to_string()),
            Err(err) => Err(format!("smtp connection test failed: {err}")),
        }
    }
}

/// True for `localhost` and literal loopback IPs.
fn is_loopback_host(host: &str) -> bool {
    host.eq_ignore_ascii_case("localhost")
        || host
            .parse::<std::net::IpAddr>()
            .map(|ip| ip.is_loopback())
            .unwrap_or(false)
}

#[async_trait]
impl Mailer for SmtpMailer {
    async fn send(&self, email: OutgoingEmail) -> Result<(), String> {
        let to: Mailbox = email
            .to
            .parse()
            .map_err(|_| "recipient address is invalid".to_string())?;
        let message = Message::builder()
            .from(self.from.clone())
            .to(to)
            .subject(email.subject)
            .multipart(MultiPart::alternative_plain_html(email.text, email.html))
            .map_err(|err| format!("email build failed: {err}"))?;
        self.transport
            .send(message)
            .await
            .map(|_| ())
            .map_err(|err| format!("smtp send failed: {err}"))
    }
}

/// Development mailer that writes messages to the log instead of sending them.
///
/// It exposes one-time codes in logs, so `main` only allows it behind
/// `FAELITH_ALLOW_LOG_MAILER=1` and never when SMTP is configured.
pub struct LogMailer;

#[async_trait]
impl Mailer for LogMailer {
    async fn send(&self, email: OutgoingEmail) -> Result<(), String> {
        tracing::warn!(
            to = %email.to,
            subject = %email.subject,
            body = %email.text,
            "LogMailer: email not sent (dev mode)"
        );
        Ok(())
    }
}

/// Test mailer that records every message for assertions.
#[derive(Default)]
pub struct MemoryMailer {
    sent: Mutex<Vec<OutgoingEmail>>,
}

impl MemoryMailer {
    /// Creates an empty outbox.
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns a copy of every message sent so far.
    pub fn sent(&self) -> Vec<OutgoingEmail> {
        self.sent.lock().map(|sent| sent.clone()).unwrap_or_default()
    }

    /// Extracts the 6-digit code from the most recent message to `to`.
    pub fn last_code_for(&self, to: &str) -> Option<String> {
        self.sent()
            .iter()
            .rev()
            .find(|email| email.to == to)
            .and_then(|email| extract_code(&email.text))
    }
}

/// First run of exactly six consecutive digits in a text body.
fn extract_code(text: &str) -> Option<String> {
    text.split(|c: char| !c.is_ascii_digit())
        .find(|run| run.len() == 6)
        .map(str::to_string)
}

#[async_trait]
impl Mailer for MemoryMailer {
    async fn send(&self, email: OutgoingEmail) -> Result<(), String> {
        self.sent
            .lock()
            .map_err(|err| err.to_string())?
            .push(email);
        Ok(())
    }
}

/// Minimal HTML escaping for values interpolated into templates.
fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

/// Wraps a heading and paragraphs in a small, client-safe HTML layout.
fn render_html(heading: &str, paragraphs: &[String], code: Option<&str>) -> String {
    let body: String = paragraphs
        .iter()
        .map(|p| format!("<p style=\"margin:0 0 16px;color:#333;font-size:15px;line-height:1.5\">{}</p>", escape_html(p)))
        .collect();
    let code_block = code
        .map(|c| {
            format!(
                "<p style=\"margin:8px 0 24px;font-family:Consolas,Menlo,monospace;font-size:32px;letter-spacing:8px;font-weight:700;color:#111\">{}</p>",
                escape_html(c)
            )
        })
        .unwrap_or_default();
    format!(
        "<!doctype html><html><body style=\"margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif\">\
<div style=\"max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px\">\
<p style=\"margin:0 0 24px;font-weight:700;font-size:18px;color:#d6425a\">Faelith</p>\
<h1 style=\"margin:0 0 16px;font-size:20px;color:#111\">{}</h1>{code_block}{body}\
<p style=\"margin:24px 0 0;color:#888;font-size:12px\">If you did not request this, you can ignore this email. Faelith staff will never ask you for this code.</p>\
</div></body></html>",
        escape_html(heading)
    )
}

/// Builds a code email with matching plain-text and HTML bodies.
fn code_email(to: &str, subject: &str, heading: &str, code: &str, lines: &[String]) -> OutgoingEmail {
    let mut text = format!("{heading}\n\nYour code: {code}\n\n");
    for line in lines {
        text.push_str(line);
        text.push_str("\n\n");
    }
    text.push_str("If you did not request this, you can ignore this email. Faelith staff will never ask you for this code.\n");
    OutgoingEmail {
        to: to.to_string(),
        subject: subject.to_string(),
        text,
        html: render_html(heading, lines, Some(code)),
    }
}

/// Signup verification code (valid for `ttl_minutes`).
pub fn signup_code_email(to: &str, code: &str, ttl_minutes: i64) -> OutgoingEmail {
    code_email(
        to,
        &format!("{code} is your Faelith verification code"),
        "Confirm your email",
        code,
        &[format!("Enter this code to finish creating your Faelith account. It expires in {ttl_minutes} minutes.")],
    )
}

/// Sign-in second-factor code.
pub fn login_code_email(to: &str, code: &str, ttl_minutes: i64) -> OutgoingEmail {
    code_email(
        to,
        &format!("{code} is your Faelith sign-in code"),
        "Finish signing in",
        code,
        &[format!("Someone (hopefully you) entered your password. Enter this code to finish signing in. It expires in {ttl_minutes} minutes.")],
    )
}

/// Step-up code before a security settings change.
pub fn stepup_code_email(to: &str, code: &str, ttl_minutes: i64) -> OutgoingEmail {
    code_email(
        to,
        &format!("{code} is your Faelith security code"),
        "Confirm a sensitive change",
        code,
        &[format!("Enter this code to confirm a sensitive change to your account (security settings, API keys, billing, or account deletion). It expires in {ttl_minutes} minutes.")],
    )
}

/// Sent instead of a code when someone signs up with an address that already has an account.
///
/// The HTTP response is identical either way, so the signup form does not
/// reveal which emails are registered.
pub fn account_exists_email(to: &str, public_origin: &str) -> OutgoingEmail {
    let heading = "You already have a Faelith account";
    let lines = vec![
        "Someone tried to create a new Faelith account with this email address, but one already exists.".to_string(),
        format!("If this was you, sign in at {public_origin}/login instead."),
    ];
    OutgoingEmail {
        to: to.to_string(),
        subject: heading.to_string(),
        text: format!("{heading}\n\n{}\n\n{}\n", lines[0], lines[1]),
        html: render_html(heading, &lines, None),
    }
}

/// Password reset link. The token travels in the URL fragment so it never
/// reaches server logs or Referer headers.
pub fn password_reset_email(to: &str, link: &str, ttl_minutes: i64) -> OutgoingEmail {
    let heading = "Reset your Faelith password";
    let lines = vec![
        format!("Open this link to choose a new password. It works once and expires in {ttl_minutes} minutes:"),
        link.to_string(),
        "If you did not ask for this, ignore this email; your password stays the same. Two-factor authentication is still required to sign in.".to_string(),
    ];
    OutgoingEmail {
        to: to.to_string(),
        subject: heading.to_string(),
        text: format!("{heading}\n\n{}\n\n{}\n\n{}\n", lines[0], lines[1], lines[2]),
        html: render_html(heading, &lines, None),
    }
}

/// Notice after a two-factor setting changed, so a hijacked session is noticed.
pub fn security_notice_email(to: &str, change: &str) -> OutgoingEmail {
    let heading = "Your Faelith security settings changed";
    let lines = vec![
        format!("Change: {change}."),
        "If you did not make this change, reset your password and contact support immediately.".to_string(),
    ];
    OutgoingEmail {
        to: to.to_string(),
        subject: heading.to_string(),
        text: format!("{heading}\n\n{}\n\n{}\n", lines[0], lines[1]),
        html: render_html(heading, &lines, None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Code emails carry the code in both bodies and in the subject.
    #[test]
    fn code_email_contains_code_everywhere() {
        let email = signup_code_email("a@x.com", "042917", 10);
        assert!(email.subject.starts_with("042917"));
        assert!(email.text.contains("042917"));
        assert!(email.html.contains("042917"));
        assert_eq!(extract_code(&email.text).as_deref(), Some("042917"));
    }

    /// Interpolated values are HTML-escaped.
    #[test]
    fn html_is_escaped() {
        let email = security_notice_email("a@x.com", "<script>");
        assert!(!email.html.contains("<script>"));
        assert!(email.html.contains("&lt;script&gt;"));
    }

    /// Delivers a real message through a loopback relay (e.g. Mailpit on :1025).
    ///
    /// Runs only when `FAELITH_TEST_SMTP_PORT` is set; otherwise returns immediately.
    #[tokio::test]
    async fn smtp_delivers_to_loopback_relay() {
        let Ok(port) = std::env::var("FAELITH_TEST_SMTP_PORT") else {
            return;
        };
        let mailer = SmtpMailer::new(&SmtpConfig {
            host: "127.0.0.1".to_string(),
            port: port.parse().expect("FAELITH_TEST_SMTP_PORT is a port"),
            username: None,
            password: None,
            security: SmtpSecurity::Plain,
            from: "Faelith <no-reply@faelith.test>".to_string(),
        })
        .unwrap();
        mailer.verify().await.expect("relay reachable");
        mailer
            .send(signup_code_email("dev@faelith.test", "123456", 10))
            .await
            .expect("relay accepted the message");
    }

    /// Plaintext SMTP is refused for non-loopback relays.
    ///
    /// Runs on Tokio because building the pooled transport spawns its cleanup task.
    #[tokio::test]
    async fn plain_smtp_requires_loopback() {
        let config = SmtpConfig {
            host: "smtp.example.com".to_string(),
            port: 25,
            username: None,
            password: None,
            security: SmtpSecurity::Plain,
            from: "Faelith <no-reply@example.com>".to_string(),
        };
        assert!(SmtpMailer::new(&config).is_err());
        let local = SmtpConfig {
            host: "127.0.0.1".to_string(),
            port: 1025,
            ..config
        };
        assert!(SmtpMailer::new(&local).is_ok());
    }
}
