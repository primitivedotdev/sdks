use crate::config::ResolvedAuth;
use anyhow::{anyhow, Result};
use reqwest::blocking::{Client, RequestBuilder, Response};
use reqwest::header::{
    HeaderMap, HeaderName, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE, USER_AGENT,
};
use reqwest::StatusCode;
use serde_json::{json, Value};

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
    let mut builder = Client::builder().user_agent(USER_AGENT_VALUE);
    if env_no_proxy_wildcard() {
        builder = builder.no_proxy();
    }
    builder.build().map_err(Into::into)
}

pub use crate::config::env_no_proxy_wildcard;

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
    parse_response_inner(response, false)
}

pub fn parse_binary_response(response: Response) -> Result<(u16, Vec<u8>, Option<Value>)> {
    let status = response.status().as_u16();
    let content_type_is_json = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(is_json_content_type);
    let bytes = response.bytes()?.to_vec();
    let json = parse_binary_json_payload(status, &bytes, content_type_is_json);
    Ok((status, bytes, json))
}

pub fn parse_response_with_declared_json_error(
    response: Response,
) -> Result<(u16, Vec<u8>, Option<Value>)> {
    parse_response_inner(response, true)
}

fn parse_response_inner(
    response: Response,
    error_on_declared_json_parse_failure: bool,
) -> Result<(u16, Vec<u8>, Option<Value>)> {
    let status = response.status().as_u16();
    let content_type_is_json = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(is_json_content_type);
    let bytes = response.bytes()?.to_vec();
    let json = parse_json_payload(
        status,
        &bytes,
        content_type_is_json,
        error_on_declared_json_parse_failure,
    )?;
    Ok((status, bytes, json))
}

fn parse_json_payload(
    status: u16,
    bytes: &[u8],
    content_type_is_json: bool,
    error_on_declared_json_parse_failure: bool,
) -> Result<Option<Value>> {
    if bytes.is_empty() {
        return Ok(None);
    }
    if content_type_is_json && error_on_declared_json_parse_failure {
        return match serde_json::from_slice(bytes) {
            Ok(value) => Ok(Some(value)),
            Err(error) if status < 400 => Err(json_parse_client_error(error)),
            Err(_) => Ok(Some(Value::String(
                String::from_utf8_lossy(bytes).to_string(),
            ))),
        };
    }
    Ok(serde_json::from_slice(bytes).ok())
}

fn parse_binary_json_payload(
    status: u16,
    bytes: &[u8],
    content_type_is_json: bool,
) -> Option<Value> {
    if status < 400 {
        return serde_json::from_slice(bytes).ok();
    }
    if content_type_is_json {
        return match serde_json::from_slice(bytes) {
            Ok(value) => Some(value),
            Err(_) => Some(binary_http_error_payload(status, None)),
        };
    }
    let message = (!bytes.is_empty()).then(|| String::from_utf8_lossy(bytes).to_string());
    Some(binary_http_error_payload(status, message))
}

fn binary_http_error_payload(status: u16, message: Option<String>) -> Value {
    json!({
        "code": "http_error",
        "message": message.unwrap_or_else(|| http_status_line(status)),
    })
}

fn http_status_line(status: u16) -> String {
    let reason = StatusCode::from_u16(status)
        .ok()
        .and_then(|status| status.canonical_reason());
    match reason {
        Some(reason) => format!("HTTP {status} {reason}"),
        None => format!("HTTP {status}"),
    }
}

fn is_json_content_type(value: &str) -> bool {
    value
        .split(';')
        .next()
        .is_some_and(|media_type| media_type.trim().eq_ignore_ascii_case("application/json"))
}

fn json_parse_client_error(error: serde_json::Error) -> anyhow::Error {
    let message = if error.classify() == serde_json::error::Category::Eof {
        "Unexpected end of JSON input".to_string()
    } else {
        error.to_string()
    };
    anyhow!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "code": "client_error",
            "message": message,
        }))
        .expect("client error JSON should serialize")
    )
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
///
/// Unlike every other error path, payments prints the WHOLE `{success,
/// error}` envelope rather than the flattened inner error. This is a
/// deliberate cross-CLI contract, not an oversight: the Node CLI's
/// payments-shared.ts documents the envelope as the most useful payload for
/// x402 flows and synthesizes the same shape for client-side failures, and
/// the "payments api error keeps x402 feature hint" parity fixture pins the
/// envelope on both CLIs. Flattening here would diverge from Node.
pub fn error_for_status_with_payment_hints(
    status: u16,
    json: Option<&Value>,
    bytes: &[u8],
) -> anyhow::Error {
    // Payments deliberately prints the whole server envelope (matching the
    // Node CLI's payments-shared.ts, which documents the envelope as the most
    // useful payload for x402 flows) rather than the flattened error object.
    let message = if json.is_none() && bytes.is_empty() {
        payment_empty_body_error_message(status)
    } else {
        raw_error_message_for_status(status, json, bytes)
    };

    let hint = error_hint_for_status(status, json)
        .or_else(|| payment_error_hint_for_code(extract_error_code(json)));
    if let Some(hint) = hint {
        anyhow!("{message}\n{hint}")
    } else {
        anyhow!("{message}")
    }
}

fn payment_empty_body_error_message(status: u16) -> String {
    serde_json::to_string_pretty(&json!({
        "error": {
            "code": "request_failed",
            "message": format!("request failed with {status}"),
        },
        "success": false,
    }))
    .expect("payment request_failed envelope should serialize")
}

fn error_message_for_status(_status: u16, json: Option<&Value>, bytes: &[u8]) -> String {
    if let Some(json) = json {
        // Match the Node CLI: unwrap the response envelope and print the
        // inner `error` object so stderr carries `{code, message, ...}`
        // rather than `{error: {...}, success: false}`.
        let payload = match json.get("error") {
            Some(inner) if !inner.is_null() => inner,
            _ => json,
        };
        serde_json::to_string_pretty(payload).unwrap_or_else(|_| payload.to_string())
    } else if bytes.is_empty() {
        "{}".to_string()
    } else {
        serde_json::to_string_pretty(&Value::String(String::from_utf8_lossy(bytes).to_string()))
            .unwrap_or_else(|_| String::from_utf8_lossy(bytes).to_string())
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
    fn declared_json_parse_errors_match_node_client_error_shape() {
        let error = serde_json::from_str::<Value>("{\"success\": true, \"data\": ").unwrap_err();
        assert_eq!(
            json_parse_client_error(error).to_string(),
            serde_json::to_string_pretty(&json!({
                "code": "client_error",
                "message": "Unexpected end of JSON input"
            }))
            .unwrap()
        );
        assert!(is_json_content_type("application/json; charset=utf-8"));
        assert!(!is_json_content_type("text/plain"));
    }

    #[test]
    fn malformed_declared_json_error_body_is_preserved_as_string() {
        let raw = b"{\"success\": false, \"error\": ";
        let parsed = parse_json_payload(500, raw, true, true)
            .unwrap()
            .expect("error body should be represented");
        assert_eq!(
            parsed,
            Value::String(String::from_utf8_lossy(raw).to_string())
        );
        assert_eq!(
            error_for_status(500, Some(&parsed), raw).to_string(),
            serde_json::to_string_pretty(&parsed).unwrap()
        );
    }

    #[test]
    fn generic_text_error_body_is_rendered_as_json_string() {
        let raw = b"upstream text error";
        let expected =
            serde_json::to_string_pretty(&Value::String("upstream text error".to_string()))
                .unwrap();
        assert_eq!(error_for_status(502, None, raw).to_string(), expected);
        assert_eq!(error_for_status(503, None, b"").to_string(), "{}");
        assert_eq!(
            error_for_status_with_payment_hints(502, None, raw).to_string(),
            "upstream text error"
        );
        assert_eq!(
            error_for_status_with_payment_hints(503, None, b"").to_string(),
            serde_json::to_string_pretty(&json!({
                "error": {
                    "code": "request_failed",
                    "message": "request failed with 503"
                },
                "success": false
            }))
            .unwrap()
        );
    }

    #[test]
    fn binary_error_fallbacks_match_node_http_error_shape() {
        assert_eq!(
            parse_binary_json_payload(500, b"{\"success\": false, \"error\": ", true),
            Some(json!({
                "code": "http_error",
                "message": "HTTP 500 Internal Server Error"
            }))
        );
        assert_eq!(
            parse_binary_json_payload(502, b"upstream text error", false),
            Some(json!({
                "code": "http_error",
                "message": "upstream text error"
            }))
        );
        assert_eq!(
            parse_binary_json_payload(503, b"", true),
            Some(json!({
                "code": "http_error",
                "message": "HTTP 503 Service Unavailable"
            }))
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
