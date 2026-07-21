use crate::config::ResolvedAuth;
use anyhow::{anyhow, Result};
use reqwest::blocking::{Client, RequestBuilder, Response};
use reqwest::header::{
    HeaderMap, HeaderName, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE, USER_AGENT,
};
use serde_json::Value;

const USER_AGENT_VALUE: &str = concat!("primitive-rust/", env!("CARGO_PKG_VERSION"));
const UNAUTHORIZED_ERROR_HINT: &str = "Hint: run `primitive signin`, pass --api-key explicitly, or set PRIMITIVE_API_KEY in your environment. `primitive whoami` is the fastest way to verify auth is live.";

const X402_ERROR_HINTS: &[(&str, &str)] = &[
    (
        "no_payout_address",
        "Register a payout address first: `primitive payments register-payout-address --network <network>`.",
    ),
    (
        "feature_disabled",
        "x402 payments are not enabled for this organization yet.",
    ),
    (
        "payment_declined",
        "Your spend policy declined this payment. Check it with `primitive payments get-spend-policy`; if it is paused, re-enable with `primitive payments update-spend-policy --paused false`.",
    ),
    (
        "challenge_expired",
        "This challenge has expired. Ask the payee to create a new one (raise `--expires-in` when creating long-lived challenges).",
    ),
    (
        "settlement_failed",
        "On-chain settlement failed. The most common cause is insufficient USDC in the paying wallet on this network. Fund the wallet and retry.",
    ),
    (
        "payment_verification_failed",
        "The signed payment did not match the challenge. Make sure you are paying with the wallet and network the challenge was issued for.",
    ),
    (
        "ownership_proof_failed",
        "The signature did not prove control of the address. Make sure the wallet key matches the address you are registering.",
    ),
];

pub fn http_client() -> Result<Client> {
    Client::builder()
        .user_agent(USER_AGENT_VALUE)
        .build()
        .map_err(Into::into)
}

pub fn apply_headers(
    mut request: RequestBuilder,
    auth: &ResolvedAuth,
    include_auth: bool,
    operation_headers: &[(String, String)],
    has_json_body: bool,
) -> Result<RequestBuilder> {
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    if has_json_body {
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    }
    for (name, value) in &auth.headers {
        headers.insert(
            HeaderName::from_bytes(name.as_bytes())?,
            HeaderValue::from_str(value)?,
        );
    }
    if include_auth {
        if let Some(api_key) = &auth.api_key {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {api_key}"))?,
            );
        }
    }
    for (name, value) in operation_headers {
        headers.insert(
            HeaderName::from_bytes(name.as_bytes())?,
            HeaderValue::from_str(value)?,
        );
    }
    request = request.headers(headers);
    Ok(request)
}

pub fn parse_response(response: Response) -> Result<(u16, Vec<u8>, Option<Value>)> {
    let status = response.status().as_u16();
    let bytes = response.bytes()?.to_vec();
    let json = if bytes.is_empty() {
        None
    } else {
        serde_json::from_slice(&bytes).ok()
    };
    Ok((status, bytes, json))
}

pub fn error_for_status(status: u16, json: Option<&Value>, bytes: &[u8]) -> anyhow::Error {
    anyhow!("{}", error_message_for_status(status, json, bytes))
}

pub fn error_for_status_with_hints(
    status: u16,
    json: Option<&Value>,
    bytes: &[u8],
) -> anyhow::Error {
    let message = error_message_for_status(status, json, bytes);

    if let Some(hint) = error_hint_for_status(status, json) {
        anyhow!("{message}\n{hint}")
    } else {
        anyhow!("{message}")
    }
}

/// Like [`error_for_status_with_hints`] but also maps x402 payment error
/// codes to actionable hints. Only the payments commands use this, matching
/// the Node CLI where the x402 hint table lives in payments-shared.ts;
/// `feature_disabled` in particular is not payments-specific, so surfacing
/// the x402 hint from non-payments commands (e.g. wake) is misleading.
pub fn error_for_status_with_payment_hints(
    status: u16,
    json: Option<&Value>,
    bytes: &[u8],
) -> anyhow::Error {
    // Payments deliberately prints the whole server envelope (matching the
    // Node CLI's payments-shared.ts, which documents the envelope as the most
    // useful payload for x402 flows) rather than the flattened error object.
    let message = raw_error_message_for_status(status, json, bytes);

    let hint = error_hint_for_status(status, json)
        .or_else(|| payment_error_hint_for_code(extract_error_code(json)));
    if let Some(hint) = hint {
        anyhow!("{message}\n{hint}")
    } else {
        anyhow!("{message}")
    }
}

fn error_message_for_status(status: u16, json: Option<&Value>, bytes: &[u8]) -> String {
    if let Some(json) = json {
        // Match the Node CLI: unwrap the response envelope and print the
        // inner `error` object so stderr carries `{code, message, ...}`
        // rather than `{error: {...}, success: false}`.
        let payload = match json.get("error") {
            Some(inner) if !inner.is_null() => inner,
            _ => json,
        };
        serde_json::to_string_pretty(payload).unwrap_or_else(|_| payload.to_string())
    } else {
        raw_error_message_for_status(status, None, bytes)
    }
}

fn raw_error_message_for_status(status: u16, json: Option<&Value>, bytes: &[u8]) -> String {
    if let Some(json) = json {
        serde_json::to_string_pretty(json).unwrap_or_else(|_| json.to_string())
    } else if bytes.is_empty() {
        format!("HTTP {status}")
    } else {
        String::from_utf8_lossy(bytes).to_string()
    }
}

fn error_hint_for_status(status: u16, json: Option<&Value>) -> Option<&'static str> {
    let code = extract_error_code(json);
    if code == Some("unauthorized") || status == 401 {
        return Some(UNAUTHORIZED_ERROR_HINT);
    }
    None
}

fn payment_error_hint_for_code(code: Option<&str>) -> Option<&'static str> {
    let code = code?;
    X402_ERROR_HINTS
        .iter()
        .find_map(|(candidate, hint)| (*candidate == code).then_some(*hint))
}

fn extract_error_code(payload: Option<&Value>) -> Option<&str> {
    let payload = payload?;
    if let Some(code) = payload
        .get("error")
        .and_then(|error| error.get("code"))
        .and_then(Value::as_str)
    {
        return Some(code);
    }
    payload.get("code").and_then(Value::as_str)
}

#[cfg(test)]
mod error_shape_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn envelope_errors_flatten_to_inner_error_object() {
        let envelope = json!({
            "error": {"code": "feature_disabled", "message": "Wake dispatch is not enabled for this org"},
            "success": false
        });
        let message = error_for_status(403, Some(&envelope), b"").to_string();
        assert_eq!(
            message,
            serde_json::to_string_pretty(&json!({
                "code": "feature_disabled",
                "message": "Wake dispatch is not enabled for this org"
            }))
            .unwrap()
        );
        assert!(!message.contains("success"));
    }

    #[test]
    fn non_envelope_errors_print_unchanged() {
        let flat = json!({"code": "x", "message": "y"});
        assert_eq!(
            error_for_status(400, Some(&flat), b"").to_string(),
            serde_json::to_string_pretty(&flat).unwrap()
        );
        let null_error = json!({"error": null, "detail": "d"});
        assert_eq!(
            error_for_status(400, Some(&null_error), b"").to_string(),
            serde_json::to_string_pretty(&null_error).unwrap()
        );
    }

    #[test]
    fn x402_hints_only_fire_from_the_payment_variant() {
        let envelope = json!({
            "error": {"code": "feature_disabled", "message": "Wake dispatch is not enabled for this org"},
            "success": false
        });
        let generic = error_for_status_with_hints(403, Some(&envelope), b"").to_string();
        assert!(!generic.contains("x402"), "{generic}");
        let payments = error_for_status_with_payment_hints(403, Some(&envelope), b"").to_string();
        assert!(
            payments.contains("x402 payments are not enabled"),
            "{payments}"
        );
        // Payments keeps the full envelope on purpose (see the Node CLI).
        assert!(payments.contains("\"success\""), "{payments}");
    }

    #[test]
    fn unauthorized_hint_still_fires_everywhere() {
        let envelope = json!({
            "error": {"code": "unauthorized", "message": "Invalid or missing API key"},
            "success": false
        });
        let message = error_for_status_with_hints(401, Some(&envelope), b"").to_string();
        assert!(
            message.contains("Hint: run `primitive signin`"),
            "{message}"
        );
    }
}
