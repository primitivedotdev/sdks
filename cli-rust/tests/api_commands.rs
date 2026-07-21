use primitive_rust::api::{
    detect_function_endpoint, error_hint_for_code, error_hint_for_payload,
    function_endpoint_redirect_message, is_incomplete_domain_verification,
    network_error_hint_for_text, INCOMPLETE_DOMAIN_VERIFICATION_HINT, UNAUTHORIZED_ERROR_HINT,
};
use primitive_rust::manifest;
use serde_json::{json, Value};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const ENDPOINT_ID: &str = "11111111-1111-4111-8111-111111111111";
const FUNCTION_ID: &str = "22222222-2222-4222-8222-222222222222";

fn temp_config_dir(label: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "primitive-rust-generated-api-{label}-{}-{unique}",
        std::process::id()
    ));
    fs::create_dir_all(&path).expect("create config dir");
    path
}

fn run_generated_api_command(
    args: &[&str],
    api_base_url: &str,
    config_dir: &Path,
) -> (i32, String, String) {
    let output = Command::new(env!("CARGO_BIN_EXE_primitive-rust"))
        .args(args)
        .env("PRIMITIVE_CONFIG_DIR", config_dir)
        .env("PRIMITIVE_API_KEY", "prim_test")
        .env("PRIMITIVE_API_BASE_URL", api_base_url)
        .env_remove("PRIMITIVE_API_HEADERS")
        .output()
        .expect("run primitive-rust");
    (
        output.status.code().unwrap_or(-1),
        String::from_utf8(output.stdout).expect("stdout should be utf-8"),
        String::from_utf8(output.stderr).expect("stderr should be utf-8"),
    )
}

fn start_optional_response_json_server(
    response_body: Value,
    wait_for: Duration,
) -> (String, thread::JoinHandle<Option<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind generated API test server");
    listener
        .set_nonblocking(true)
        .expect("set generated API test server nonblocking");
    let base_url = format!("http://{}/v1", listener.local_addr().expect("server addr"));
    let handle = thread::spawn(move || {
        let deadline = Instant::now() + wait_for;
        let (mut stream, _) = loop {
            match listener.accept() {
                Ok(accepted) => break accepted,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    if Instant::now() >= deadline {
                        return None;
                    }
                    thread::sleep(Duration::from_millis(10));
                }
                Err(error) => panic!("accept generated API test request: {error}"),
            }
        };
        // The accepted stream inherits the listener's nonblocking mode on some
        // platforms (observed on macOS), so an early read races the client and
        // panics with WouldBlock. Force blocking with a bounded read instead.
        stream
            .set_nonblocking(false)
            .expect("set test stream blocking");
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .expect("set test stream read timeout");
        stream
            .set_nonblocking(false)
            .expect("set generated API stream blocking");

        let mut buffer = Vec::new();
        loop {
            let mut chunk = [0_u8; 1024];
            let read = stream.read(&mut chunk).expect("read generated API request");
            if read == 0 {
                break;
            }
            buffer.extend_from_slice(&chunk[..read]);
            if let Some(expected) = complete_http_request_length(&buffer) {
                if buffer.len() >= expected {
                    break;
                }
            }
        }

        let request = String::from_utf8_lossy(&buffer).to_string();
        let body = response_body.to_string();
        let response = format!(
            "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
            body.len()
        );
        stream
            .write_all(response.as_bytes())
            .expect("write generated API response");
        Some(request)
    });
    (base_url, handle)
}

fn complete_http_request_length(buffer: &[u8]) -> Option<usize> {
    let request = String::from_utf8_lossy(buffer);
    let (head, _) = request.split_once("\r\n\r\n")?;
    let body_offset = head.len() + 4;
    let content_length = head
        .lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length")
                .then(|| value.trim().parse::<usize>().ok())
                .flatten()
        })
        .unwrap_or(0);
    Some(body_offset + content_length)
}

fn request_body_json(request: &str) -> Value {
    let (_, body) = request
        .split_once("\r\n\r\n")
        .expect("request should include HTTP headers");
    serde_json::from_str(body.trim()).expect("request body should be JSON")
}

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
fn generated_api_boolean_equals_false_is_unexpected_argument_without_request() {
    let (api_base_url, server) = start_optional_response_json_server(
        json!({"data": {"id": "em_123"}}),
        Duration::from_millis(250),
    );
    let config_dir = temp_config_dir("bool-equals-false");
    let (code, stdout, stderr) = run_generated_api_command(
        &["emails:get-email", "--id", "em_123", "--time=false"],
        &api_base_url,
        &config_dir,
    );
    let request = server.join().expect("generated API server thread");

    assert_eq!(code, 2, "stderr: {stderr}");
    assert_eq!(stdout, "");
    assert!(
        stderr.starts_with("Unexpected argument: false"),
        "stderr: {stderr:?}"
    );
    assert!(request.is_none(), "unexpected request:\n{request:?}");
}

#[test]
fn generated_api_duplicate_boolean_flags_use_later_value() {
    let (api_base_url, server) = start_optional_response_json_server(
        json!({"data": {"id": "auth_123", "enabled": false}}),
        Duration::from_secs(3),
    );
    let config_dir = temp_config_dir("duplicate-bool-later-wins");
    let (code, stdout, stderr) = run_generated_api_command(
        &[
            "wake",
            "update-wake-authorization",
            "--id",
            "auth_123",
            "--enabled",
            "--no-enabled",
        ],
        &api_base_url,
        &config_dir,
    );
    let request = server
        .join()
        .expect("generated API server thread")
        .expect("generated API request should be sent");

    assert_eq!(code, 0, "stderr: {stderr}");
    assert_eq!(
        serde_json::from_str::<Value>(&stdout).expect("stdout should be JSON"),
        json!({"id": "auth_123", "enabled": false})
    );
    assert!(
        request.starts_with("PATCH /v1/wake/authorizations/auth_123 HTTP/1.1"),
        "request:\n{request}"
    );
    assert_eq!(request_body_json(&request), json!({"enabled": false}));
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
