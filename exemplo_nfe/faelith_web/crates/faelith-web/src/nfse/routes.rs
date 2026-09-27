/**
 * @fileoverview HTTP endpoints of the NFS-e module: buyer notes and fiscal data, and the admin console.
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
 * - Buyer: list own notes, download XML / DANFSe PDF, set CPF or CNPJ (resumes notes waiting for it)
 * - Admin: list with status filter, emitter / certificate status, download, retry, and manual cancellation;
 *   mutations need CSRF, admin, a fresh reauthentication, and are written to the audit log
 */

use crate::admin::require_admin;
use crate::audit_store::AuditEntry;
use crate::nfse::dps::{digits, valid_cnpj, valid_cpf};
use crate::nfse::service::save_identity;
use crate::nfse::store::{status, FiscalIdentity, NfseDocument};
use crate::routes::{csrf_origin, err, require_user};
use crate::security::{require_reauth, FactorBody};
use crate::AppState;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use chrono::Utc;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

/// Public view of a document (no XML).
fn doc_json(doc: &NfseDocument) -> Value {
    json!({
        "id": doc.id,
        "status": doc.status,
        "number": doc.nfse_number,
        "access_key": doc.access_key,
        "dps_id": doc.dps_id,
        "stripe_invoice_id": doc.stripe_invoice_id,
        "amount_usd_cents": doc.amount_usd_cents,
        "amount_brl_cents": doc.amount_brl_cents,
        "ptax_rate": doc.ptax_rate,
        "buyer_name": doc.buyer.get("name"),
        "buyer_country": doc.buyer.pointer("/address/country"),
        "attempts": doc.attempts,
        "last_error": doc.last_error,
        "paid_at": doc.paid_at.to_rfc3339(),
        "issued_at": doc.issued_at.map(|at| at.to_rfc3339()),
        "canceled_at": doc.canceled_at.map(|at| at.to_rfc3339()),
        "created_at": doc.created_at.to_rfc3339(),
    })
}

/// Stripe customer of the signed-in user's organization, when it has bought anything.
async fn user_customer(state: &AppState, org_id: Uuid) -> Option<String> {
    state.store.get_subscription(org_id).await.ok().flatten().and_then(|sub| sub.stripe_customer_id)
}

/// GET /api/billing/nfse — the organization's notes and its fiscal identity (masked).
pub async fn my_notes(State(state): State<AppState>, headers: HeaderMap) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let docs = state.nfse.list(None, Some(user.org_id), 200).await.unwrap_or_default();
    let identity = match user_customer(&state, user.org_id).await {
        Some(customer) => state.nfse.get_identity(&customer).await.ok().flatten(),
        None => None,
    };
    let masked = identity.map(|i| {
        let tail: String = i.doc_number.chars().rev().take(2).collect::<Vec<_>>().into_iter().rev().collect();
        json!({ "doc_type": i.doc_type, "doc_number": format!("***{tail}") })
    });
    Json(json!({
        "notes": docs.iter().filter(|d| d.status != status::VOIDED).map(doc_json).collect::<Vec<Value>>(),
        "identity": masked,
    }))
    .into_response()
}

#[derive(Debug, Deserialize)]
pub struct IdentityBody {
    doc_type: String,
    doc_number: String,
}

/// PUT /api/billing/fiscal-identity — CPF or CNPJ used on the organization's notes.
pub async fn set_identity(State(state): State<AppState>, headers: HeaderMap, Json(body): Json<IdentityBody>) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    let number = digits(&body.doc_number);
    let valid = match body.doc_type.as_str() {
        "cpf" => valid_cpf(&number),
        "cnpj" => valid_cnpj(&number),
        _ => false,
    };
    if !valid {
        return err(StatusCode::BAD_REQUEST, "invalid CPF or CNPJ");
    }
    let Some(customer) = user_customer(&state, user.org_id).await else {
        return err(StatusCode::CONFLICT, "no purchase yet; the CPF can also be given at checkout");
    };
    let identity = FiscalIdentity { stripe_customer_id: customer, org_id: Some(user.org_id), doc_type: body.doc_type, doc_number: number, updated_at: Utc::now() };
    match save_identity(state.nfse.as_ref(), &identity).await {
        Ok(resumed) => Json(json!({ "saved": true, "resumed": resumed })).into_response(),
        Err(error) => {
            tracing::error!(error = %error, "fiscal identity save failed");
            err(StatusCode::INTERNAL_SERVER_ERROR, "could not save the fiscal data")
        }
    }
}

/// Serves the NFS-e XML or DANFSe PDF of a document.
async fn download(state: &AppState, doc: NfseDocument, kind: &str) -> Response {
    match kind {
        "xml" => match doc.nfse_xml {
            Some(xml) => (
                [(header::CONTENT_TYPE, "application/xml; charset=utf-8".to_string()), (header::CONTENT_DISPOSITION, format!("attachment; filename=\"nfse-{}.xml\"", doc.nfse_number.unwrap_or_default()))],
                xml,
            )
                .into_response(),
            None => err(StatusCode::NOT_FOUND, "the note has not been issued"),
        },
        "pdf" => {
            let (Some(service), Some(key)) = (state.nfse_service.as_ref(), doc.access_key.as_deref()) else {
                return err(StatusCode::SERVICE_UNAVAILABLE, "the note PDF is not available");
            };
            match service.danfse(key).await {
                Ok(pdf) => (
                    [(header::CONTENT_TYPE, "application/pdf".to_string()), (header::CONTENT_DISPOSITION, format!("attachment; filename=\"nfse-{}.pdf\"", doc.nfse_number.unwrap_or_default()))],
                    pdf,
                )
                    .into_response(),
                Err(error) => {
                    tracing::warn!(error = %error, "danfse download failed");
                    err(StatusCode::BAD_GATEWAY, "the national system did not return the PDF; try again later")
                }
            }
        }
        _ => err(StatusCode::NOT_FOUND, "not found"),
    }
}

/// GET /api/billing/nfse/{id}/{xml|pdf} — only the organization's own notes.
pub async fn my_download(State(state): State<AppState>, headers: HeaderMap, Path((id, kind)): Path<(Uuid, String)>) -> Response {
    let user = match require_user(&state, &headers).await {
        Ok(user) => user,
        Err(response) => return response,
    };
    match state.nfse.get(id).await {
        Ok(Some(doc)) if doc.org_id == Some(user.org_id) => download(&state, doc, &kind).await,
        Ok(_) => err(StatusCode::NOT_FOUND, "not found"),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "lookup failed"),
    }
}

#[derive(Debug, Default, Deserialize)]
pub struct AdminListQuery {
    status: Option<String>,
}

/// GET /api/admin/nfse — documents plus emitter and certificate status.
pub async fn admin_list(State(state): State<AppState>, headers: HeaderMap, Query(query): Query<AdminListQuery>) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    let docs = state.nfse.list(query.status.as_deref().filter(|s| !s.is_empty()), None, 300).await.unwrap_or_default();
    let emitter = state.nfse_service.as_ref().map(|service| {
        let (subject, not_after) = service.certificate();
        json!({
            "environment": if service.config.environment == crate::nfse::dps::Environment::Production { "producao" } else { "homologacao" },
            "cnpj": service.config.seller.cnpj,
            "series": service.config.series,
            "trib_nac": service.config.service.national,
            "nbs": service.config.service.nbs,
            "certificate_subject": subject,
            "certificate_expires_at": chrono::DateTime::from_timestamp(not_after, 0).map(|at| at.to_rfc3339()),
        })
    });
    Json(json!({ "enabled": emitter.is_some(), "emitter": emitter, "documents": docs.iter().map(doc_json).collect::<Vec<Value>>() })).into_response()
}

/// GET /api/admin/nfse/{id}/{xml|pdf}.
pub async fn admin_download(State(state): State<AppState>, headers: HeaderMap, Path((id, kind)): Path<(Uuid, String)>) -> Response {
    if let Err(response) = require_admin(&state, &headers).await {
        return response;
    }
    match state.nfse.get(id).await {
        Ok(Some(doc)) => download(&state, doc, &kind).await,
        Ok(None) => err(StatusCode::NOT_FOUND, "not found"),
        Err(_) => err(StatusCode::INTERNAL_SERVER_ERROR, "lookup failed"),
    }
}

#[derive(Debug, Deserialize)]
pub struct AdminActionBody {
    reason: Option<String>,
    reauth: Option<FactorBody>,
}

/// POST /api/admin/nfse/{id}/{retry|cancel} — requeue a stuck document or cancel an issued note.
pub async fn admin_action(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((id, action)): Path<(Uuid, String)>,
    Json(body): Json<AdminActionBody>,
) -> Response {
    if let Err(response) = csrf_origin(&state, &headers) {
        return response;
    }
    let admin = match require_admin(&state, &headers).await {
        Ok(admin) => admin,
        Err(response) => return response,
    };
    if let Err(response) = require_reauth(&state, &admin, body.reauth.as_ref(), true).await {
        return response;
    }
    let Ok(Some(mut doc)) = state.nfse.get(id).await else {
        return err(StatusCode::NOT_FOUND, "not found");
    };
    let next = match (action.as_str(), doc.status.as_str()) {
        ("retry", status::REJECTED | status::PENDING_DATA | status::QUEUED) => status::QUEUED,
        ("retry", status::CANCEL_FAILED) => status::CANCEL_QUEUED,
        ("cancel", status::ISSUED | status::NEEDS_REVIEW | status::CANCEL_FAILED) if doc.access_key.is_some() => status::CANCEL_QUEUED,
        ("retry" | "cancel", _) => return err(StatusCode::CONFLICT, "this action does not apply to the note's current status"),
        _ => return err(StatusCode::NOT_FOUND, "not found"),
    };
    if action == "cancel" {
        let reason = body.reason.as_deref().map(str::trim).unwrap_or_default();
        if reason.chars().count() < 15 {
            return err(StatusCode::BAD_REQUEST, "the cancellation reason needs at least 15 characters");
        }
        doc.cancel_reason = Some(reason.chars().take(255).collect());
    }
    doc.status = next.to_string();
    doc.attempts = 0;
    doc.next_attempt_at = Utc::now();
    if let Err(error) = state.nfse.save(&doc).await {
        tracing::error!(error = %error, "nfse admin action failed");
        return err(StatusCode::INTERNAL_SERVER_ERROR, "update failed");
    }
    let entry = AuditEntry {
        admin_email: admin.email.clone(),
        action: format!("nfse.{action}"),
        target_org: doc.org_id,
        detail: json!({ "document": doc.id, "invoice": doc.stripe_invoice_id, "reason": doc.cancel_reason }),
        at: Utc::now(),
    };
    if let Err(error) = state.audit.record(&entry).await {
        tracing::error!(error = %error, "admin audit write failed");
    }
    Json(json!({ "status": doc.status })).into_response()
}
