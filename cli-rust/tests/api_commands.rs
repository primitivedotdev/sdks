use primitive_rust::api::{
    detect_function_endpoint, error_hint_for_code, error_hint_for_payload,
    function_endpoint_redirect_message, is_incomplete_domain_verification,
    network_error_hint_for_text, INCOMPLETE_DOMAIN_VERIFICATION_HINT, UNAUTHORIZED_ERROR_HINT,
};
use primitive_rust::manifest;
use serde_json::json;

const ENDPOINT_ID: &str = "11111111-1111-4111-8111-111111111111";
const FUNCTION_ID: &str = "22222222-2222-4222-8222-222222222222";

#[test]
fn api_error_helpers_surface_auth_and_network_hints() {
    assert_eq!(
        error_hint_for_code("unauthorized"),
        Some(UNAUTHORIZED_ERROR_HINT)
    );
    assert_eq!(
        error_hint_for_payload(Some(401), Some(&json!({"message": "nope"}))),
        Some(UNAUTHORIZED_ERROR_HINT)
    );
    assert!(network_error_hint_for_text("connection refused")
        .expect("connection hint")
        .contains("refused"));
    assert!(network_error_hint_for_text("dns error")
        .expect("dns hint")
        .contains("DNS"));
    assert_eq!(error_hint_for_code("validation_error"), None);
}

#[test]
fn verify_domain_incomplete_verification_is_non_successful() {
    let verify_domain =
        manifest::lookup_operation("domains:verify-domain").expect("verify domain operation");
    let list_domains =
        manifest::lookup_operation("domains:list-domains").expect("list domains operation");

    assert!(is_incomplete_domain_verification(
        verify_domain,
        &json!({"data": {"verified": false}})
    ));
    assert!(!is_incomplete_domain_verification(
        verify_domain,
        &json!({"data": {"verified": true}})
    ));
    assert!(!is_incomplete_domain_verification(
        list_domains,
        &json!({"data": {"verified": false}})
    ));
    assert!(INCOMPLETE_DOMAIN_VERIFICATION_HINT.contains("domains zone-file"));
}

#[test]
fn endpoint_test_redirect_detects_function_endpoint_rows() {
    let response = json!({
        "data": [
            {
                "id": ENDPOINT_ID,
                "kind": "function",
                "function_id": FUNCTION_ID,
                "url": null
            }
        ]
    });

    let match_ = detect_function_endpoint(ENDPOINT_ID, &response).expect("function endpoint");
    assert_eq!(match_.endpoint_id, ENDPOINT_ID);
    assert_eq!(match_.function_id, FUNCTION_ID);

    let message = function_endpoint_redirect_message(
        "testEndpoint",
        Some("not_found"),
        Some(ENDPOINT_ID),
        &response,
    )
    .expect("redirect message");
    assert!(message.contains(&format!("primitive functions test --id {FUNCTION_ID}")));
    assert!(message.contains(&format!("endpoint_id={ENDPOINT_ID}")));
    assert!(message.contains(&format!("function_id={FUNCTION_ID}")));
}

#[test]
fn endpoint_test_redirect_skips_unrelated_or_malformed_cases() {
    let function_response = json!({
        "data": {
            "data": [
                {
                    "id": ENDPOINT_ID,
                    "kind": "function",
                    "function_id": FUNCTION_ID
                }
            ]
        }
    });
    assert!(function_endpoint_redirect_message(
        "updateEndpoint",
        Some("not_found"),
        Some(ENDPOINT_ID),
        &function_response,
    )
    .is_none());
    assert!(function_endpoint_redirect_message(
        "testEndpoint",
        Some("validation_error"),
        Some(ENDPOINT_ID),
        &function_response,
    )
    .is_none());
    assert!(function_endpoint_redirect_message(
        "testEndpoint",
        Some("not_found"),
        None,
        &function_response,
    )
    .is_none());

    let http_endpoint = json!({
        "data": [
            {
                "id": ENDPOINT_ID,
                "kind": "http",
                "url": "https://example.test/hook"
            }
        ]
    });
    assert!(detect_function_endpoint(ENDPOINT_ID, &http_endpoint).is_none());

    let missing_function_id = json!({
        "data": [
            {
                "id": ENDPOINT_ID,
                "kind": "function"
            }
        ]
    });
    assert!(detect_function_endpoint(ENDPOINT_ID, &missing_function_id).is_none());
}
