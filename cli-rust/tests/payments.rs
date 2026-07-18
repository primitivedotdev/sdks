use flate2::write::GzEncoder;
use flate2::Compression;
use primitive_rust::payments::{
    build_charge_request, build_register_payout_address_body, build_settlement_search_query,
    build_signed_payment_for_challenge_at, build_signed_payment_step_at, challenge_from_json_str,
    decide_pay_email_completion, dispatch as dispatch_payments, email_challenge_from_json_str,
    extract_settle_tx, interaction_json_from_archive, interaction_tar_path_from_meta,
    is_settlement_receipt_for, parse_email_challenge_from_part_bytes, payments_leaf_help_text,
    payments_pay_email_help_text,
};
use primitive_rust::x402::parse_private_key;
use serde_json::json;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

const TEST_ADDRESS: &str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const NORMATIVE_NONCE: &str = "0xc955a08812ab83f9e25c92e5162267b913957c3cc8678de1cf1449f77b516c6e";
const PAYMENT_SIGNATURE: &str = "0x8b857810e21f1b5538cacbdd4ead918e7646ca40d214d576cff3b0a7b9e8b1b53e68b7b7964fc700a6a5d6aaf1bbf0c02cc80b8dbd3a690cd9335e361152aba61b";

fn test_key() -> String {
    [
        "0xac0974bec39a17e3",
        "6ba4a6b4d238ff94",
        "4bacb478cbed5efc",
        "ae784d7bf4f2ff80",
    ]
    .join("")
}

fn assert_tokens(text: &str, tokens: &[&str]) {
    for token in tokens {
        assert!(
            text.contains(token),
            "expected output to contain {token:?}; output:\n{text}"
        );
    }
}

fn run_primitive(values: &[&str]) -> String {
    let output = Command::new(env!("CARGO_BIN_EXE_primitive-rust"))
        .args(values)
        .output()
        .expect("run primitive-rust");
    assert!(
        output.status.success(),
        "{values:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert_eq!(String::from_utf8_lossy(&output.stderr), "");
    String::from_utf8(output.stdout).expect("stdout should be utf-8")
}

fn temp_config_dir(name: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "primitive-rust-payments-{name}-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(&path).expect("create config dir");
    path
}

fn run_primitive_failure(values: &[&str]) -> (i32, String, String) {
    let config_dir = temp_config_dir("failure");
    let result = run_primitive_failure_with_config(values, &config_dir);
    fs::remove_dir_all(config_dir).ok();
    result
}

fn run_primitive_failure_with_config(values: &[&str], config_dir: &Path) -> (i32, String, String) {
    let output = Command::new(env!("CARGO_BIN_EXE_primitive-rust"))
        .args(values)
        .env("PRIMITIVE_CONFIG_DIR", config_dir)
        .env_remove("PRIMITIVE_API_KEY")
        .env_remove("PRIMITIVE_API_BASE_URL")
        .env_remove("PRIMITIVE_API_HEADERS")
        .env_remove("PRIMITIVE_X402_PRIVATE_KEY")
        .output()
        .expect("run primitive-rust");
    assert!(
        !output.status.success(),
        "{values:?} unexpectedly succeeded: {}",
        String::from_utf8_lossy(&output.stdout)
    );
    (
        output.status.code().unwrap_or(-1),
        String::from_utf8(output.stdout).expect("stdout should be utf-8"),
        String::from_utf8(output.stderr).expect("stderr should be utf-8"),
    )
}

fn challenge_json() -> String {
    json!({
        "id": "ch_123",
        "network": "base-sepolia",
        "amount": "10000",
        "pay_to": "0x1111111111111111111111111111111111111111",
        "nonce_binding": {
            "interaction_id": "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
            "challenge_step_id": "f00dface-0000-0000-0000-0000000000aa",
            "challenge_nonce": "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
        },
        "payment_requirements": {
            "scheme": "exact",
            "network": "base-sepolia",
            "maxAmountRequired": "10000",
            "payTo": "0x1111111111111111111111111111111111111111",
            "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
            "extra": { "name": "USDC", "version": "2" }
        },
        "expires_at": "1970-01-02T03:41:39Z"
    })
    .to_string()
}

fn email_challenge_json() -> String {
    json!({
        "interaction_id": "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
        "challenge_id": "ch_123",
        "challenge": {
            "payment_requirements": {
                "scheme": "exact",
                "network": "base-sepolia",
                "maxAmountRequired": "10000",
                "payTo": "0x1111111111111111111111111111111111111111",
                "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                "extra": { "name": "USDC", "version": "2" }
            },
            "nonce_binding": {
                "interaction_id": "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
                "challenge_step_id": "f00dface-0000-0000-0000-0000000000aa",
                "challenge_nonce": "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
            },
            "expires_at": "1970-01-02T03:41:39Z"
        }
    })
    .to_string()
}

fn interaction_envelope_json() -> String {
    json!({
        "interaction_version": 1,
        "interaction_id": "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
        "protocol": "x402.payment",
        "protocol_version": 1,
        "step": "challenge",
        "step_id": "f00dface-0000-0000-0000-0000000000aa",
        "prev_step_id": null,
        "expires_at": "1970-01-02T03:41:39Z",
        "payload": {
            "challenge_nonce": "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
            "payment_requirements": {
                "scheme": "exact",
                "network": "base-sepolia",
                "maxAmountRequired": "10000",
                "payTo": "0x1111111111111111111111111111111111111111",
                "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                "extra": { "name": "USDC", "version": "2" }
            }
        }
    })
    .to_string()
}

#[test]
fn payments_help_requests_return_before_auth_or_argument_validation() {
    dispatch_payments(&["pay".to_string(), "--help".to_string()])
        .expect("help request should succeed");
}

#[test]
fn payments_charge_rejects_unknown_flags_missing_values_and_overprecise_usdc() {
    let (code, stdout, stderr) = run_primitive_failure(&["payments", "charge", "--bogus"]);
    assert_eq!(code, 1);
    assert_eq!(stdout, "");
    assert!(stderr.contains("Unknown flag --bogus"), "{stderr}");

    let (code, stdout, stderr) = run_primitive_failure(&["payments", "charge", "--amount-usdc"]);
    assert_eq!(code, 2);
    assert_eq!(stdout, "");
    assert!(
        stderr.contains("Flag --amount-usdc expects a value"),
        "{stderr}"
    );

    let (code, stdout, stderr) =
        run_primitive_failure(&["payments", "charge", "--amount-usdc", "0.1234567"]);
    assert_eq!(code, 1);
    assert_eq!(stdout, "");
    assert_eq!(
        stderr,
        "Invalid --amount-usdc \"0.1234567\". Use a positive amount with at most 6 decimals, e.g. 0.01.\n"
    );
}

#[test]
fn pay_email_step_enforces_non_default_environment_base_url_safety() {
    let config_dir = temp_config_dir("pay-email-step-non-default");
    fs::write(
        config_dir.join("config.json"),
        serde_json::to_string_pretty(&json!({
            "version": 1,
            "current_environment": "staging",
            "environments": {
                "staging": {
                    "headers": {
                        "x-staging": "secret"
                    }
                }
            }
        }))
        .expect("serialize config"),
    )
    .expect("write config");

    let (code, stdout, stderr) =
        run_primitive_failure_with_config(&["payments", "pay-email-step"], &config_dir);

    assert_eq!(code, 1);
    assert_eq!(stdout, "");
    assert!(
        stderr.contains("environment `staging` does not specify an api_base_url"),
        "{stderr}"
    );
    assert!(!stderr.contains("private key must be 32 bytes"), "{stderr}");
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn pay_email_help_documents_command_flags() {
    let help = payments_pay_email_help_text();
    for expected in [
        "payments pay-email --in-reply-to <inbound-email-id>",
        "--api-key <value>",
        "--private-key <value>",
        "--challenge <json>",
        "--challenge-file <path>",
        "--wait-settle",
        "--settle-timeout <seconds>",
        "--settle-interval <seconds>",
        "--json",
    ] {
        assert!(help.contains(expected), "{expected}");
    }
}

#[test]
fn payments_leaf_help_documents_node_visible_flags() {
    let cases = [
        (
            "charge",
            vec![
                "payments charge",
                "--api-key",
                "--amount-usdc",
                "--amount",
                "--network",
                "--payer-org",
                "--description",
                "--resource",
                "--expires-in",
                "--idempotency-key",
                "--time",
            ],
        ),
        (
            "pay",
            vec![
                "payments pay",
                "--api-key",
                "--private-key",
                "--challenge",
                "--challenge-file",
                "--json",
                "--time",
            ],
        ),
        (
            "pay-challenge",
            vec![
                "payments pay-challenge",
                "--api-key",
                "--private-key",
                "--challenge",
                "--challenge-file",
                "--json",
                "--time",
            ],
        ),
        (
            "register-payout",
            vec![
                "payments register-payout",
                "--api-key",
                "--private-key",
                "--network",
                "--label",
                "--issued-at",
                "--json",
                "--time",
            ],
        ),
        (
            "register-payout-address",
            vec![
                "payments register-payout-address",
                "--api-key",
                "--private-key",
                "--network",
                "--label",
                "--issued-at",
                "--json",
                "--time",
            ],
        ),
        (
            "challenge-from-email",
            vec![
                "payments challenge-from-email",
                "--api-key",
                "--id",
                "--time",
            ],
        ),
        (
            "pay-email",
            vec![
                "payments pay-email",
                "--api-key",
                "--private-key",
                "--challenge",
                "--challenge-file",
                "--in-reply-to",
                "--from",
                "--body",
                "--wait",
                "--wait-settle",
                "--settle-timeout",
                "--settle-interval",
                "--json",
                "--time",
            ],
        ),
        (
            "pay-email-step",
            vec![
                "payments pay-email-step",
                "--api-key",
                "--private-key",
                "--challenge",
                "--challenge-file",
                "--json",
                "--time",
            ],
        ),
    ];

    for (command, expected) in cases {
        let help = payments_leaf_help_text(command).expect("payments leaf help");
        assert_tokens(&help, &expected);
        assert!(!help.contains("Primitive Rust CLI payments commands"));
    }
}

#[test]
fn root_payments_help_routes_space_and_colon_spellings_to_leaf_help() {
    for (space_args, colon_args, expected) in [
        (
            ["payments", "charge", "--help"].as_slice(),
            ["payments:charge", "--help"].as_slice(),
            vec![
                "Request an x402 payment",
                "--amount-usdc",
                "--idempotency-key",
            ],
        ),
        (
            ["payments", "pay", "--help"].as_slice(),
            ["payments:pay", "--help"].as_slice(),
            vec![
                "Sign and settle an x402 payment challenge",
                "--private-key",
                "--json",
            ],
        ),
        (
            ["payments", "pay-challenge", "--help"].as_slice(),
            ["payments:pay-challenge", "--help"].as_slice(),
            vec!["payments pay-challenge", "--challenge-file", "--time"],
        ),
        (
            ["payments", "register-payout", "--help"].as_slice(),
            ["payments:register-payout", "--help"].as_slice(),
            vec!["payments register-payout", "--issued-at", "--label"],
        ),
        (
            ["payments", "challenge-from-email", "--help"].as_slice(),
            ["payments:challenge-from-email", "--help"].as_slice(),
            vec!["payments challenge-from-email", "--id", "--api-key"],
        ),
        (
            ["payments", "pay-email", "--help"].as_slice(),
            ["payments:pay-email", "--help"].as_slice(),
            vec!["payments pay-email", "--in-reply-to", "--wait-settle"],
        ),
        (
            ["payments", "pay-email-step", "--help"].as_slice(),
            ["payments:pay-email-step", "--help"].as_slice(),
            vec![
                "payments pay-email-step",
                "--private-key",
                "--challenge-file",
            ],
        ),
    ] {
        for values in [space_args, colon_args] {
            let output = run_primitive(values);
            assert_tokens(&output, &expected);
            assert!(!output.contains("Primitive Rust CLI payments commands"));
        }
    }
}

fn gzip_tar(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut tar = Vec::new();
    for (name, bytes) in entries {
        let mut header = [0_u8; 512];
        header[..name.len()].copy_from_slice(name.as_bytes());
        header[100..108].copy_from_slice(b"0000644\0");
        header[108..116].copy_from_slice(b"0000000\0");
        header[116..124].copy_from_slice(b"0000000\0");
        let size = format!("{:011o}\0", bytes.len());
        header[124..136].copy_from_slice(size.as_bytes());
        header[136..148].copy_from_slice(b"00000000000\0");
        header[148..156].copy_from_slice(b"        ");
        header[156] = b'0';
        header[257..263].copy_from_slice(b"ustar\0");
        header[263..265].copy_from_slice(b"00");
        let checksum: u32 = header.iter().map(|byte| u32::from(*byte)).sum();
        let checksum = format!("{checksum:06o}\0 ");
        header[148..156].copy_from_slice(checksum.as_bytes());
        tar.extend_from_slice(&header);
        tar.extend_from_slice(bytes);
        let padding = (512 - (bytes.len() % 512)) % 512;
        tar.extend(std::iter::repeat_n(0, padding));
    }
    tar.extend([0_u8; 1024]);
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&tar).unwrap();
    encoder.finish().unwrap()
}

#[test]
fn reads_challenge_data_envelope() {
    let raw =
        json!({ "data": serde_json::from_str::<serde_json::Value>(&challenge_json()).unwrap() })
            .to_string();
    let challenge = challenge_from_json_str(&raw).unwrap();
    assert_eq!(challenge.id, "ch_123");
    assert_eq!(challenge.payment_requirements.max_amount_required, "10000");
}

#[test]
fn derives_email_challenge_from_interaction_part() {
    let challenge =
        parse_email_challenge_from_part_bytes(interaction_envelope_json().as_bytes()).unwrap();
    assert_eq!(
        challenge.interaction_id,
        "a1b2c3d4-0000-0000-0000-000000000001@payer.example"
    );
    assert_eq!(challenge.challenge_id.as_deref(), Some(""));
    assert_eq!(challenge.challenge.expires_at, "1970-01-02T03:41:39Z");
    assert_eq!(
        challenge.challenge.nonce_binding.challenge_step_id,
        "f00dface-0000-0000-0000-0000000000aa"
    );
    assert_eq!(
        challenge.challenge.payment_requirements.max_amount_required,
        "10000"
    );
}

#[test]
fn extracts_interaction_json_from_prefixed_archive_entry() {
    let archive = gzip_tar(&[
        ("0_notes.txt", b"not this"),
        ("1_interaction.json", interaction_envelope_json().as_bytes()),
    ]);
    let bytes = interaction_json_from_archive(&archive, Some("1_interaction.json"))
        .unwrap()
        .unwrap();
    assert_eq!(bytes, interaction_envelope_json().as_bytes());
}

#[test]
fn resolves_interaction_tar_path_from_attachment_metadata() {
    let attachments = json!([
        { "filename": "notes.txt", "content_type": "text/plain", "tar_path": "0_notes.txt" },
        {
            "filename": "interaction.json",
            "content_type": "application/json",
            "tar_path": "1_interaction.json"
        }
    ]);
    assert_eq!(
        interaction_tar_path_from_meta(Some(&attachments)).as_deref(),
        Some("1_interaction.json")
    );
}

#[test]
fn charge_request_converts_human_amount_and_headers() {
    let args = vec![
        "--amount-usdc".to_string(),
        "0.01".to_string(),
        "--payer-org".to_string(),
        "org_123".to_string(),
        "--description".to_string(),
        "test".to_string(),
        "--idempotency-key".to_string(),
        "abc".to_string(),
    ];
    let request = build_charge_request(&args).unwrap();
    assert_eq!(request.body["amount"], "10000");
    assert_eq!(request.body["network"], "base-sepolia");
    assert_eq!(request.body["payer_org"], "org_123");
    assert_eq!(
        request.headers,
        vec![("idempotency-key".to_string(), "abc".to_string())]
    );
}

#[test]
fn signed_challenge_body_matches_viem_vector() {
    let key = parse_private_key(&test_key()).unwrap();
    let challenge = challenge_from_json_str(&challenge_json()).unwrap();
    let payment = build_signed_payment_for_challenge_at(&challenge, &key, 301).unwrap();
    let value = serde_json::to_value(payment).unwrap();
    assert_eq!(value["network"], "base-sepolia");
    assert_eq!(value["payload"]["signature"], PAYMENT_SIGNATURE);
    assert_eq!(value["payload"]["authorization"]["from"], TEST_ADDRESS);
    assert_eq!(
        value["payload"]["authorization"]["to"],
        "0x1111111111111111111111111111111111111111"
    );
    assert_eq!(value["payload"]["authorization"]["value"], "10000");
    assert_eq!(value["payload"]["authorization"]["validAfter"], "1");
    assert_eq!(value["payload"]["authorization"]["validBefore"], "86401");
    assert_eq!(value["payload"]["authorization"]["nonce"], NORMATIVE_NONCE);
}

#[test]
fn register_payout_body_signs_address_control() {
    let key = parse_private_key(&test_key()).unwrap();
    let body = build_register_payout_address_body(
        "11111111-1111-4111-8111-111111111111",
        "base-sepolia",
        Some("treasury"),
        "2026-01-01T00:00:00.000Z",
        &key,
    )
    .unwrap();
    assert_eq!(body["address"], TEST_ADDRESS);
    assert_eq!(body["network"], "base-sepolia");
    assert_eq!(body["label"], "treasury");
    assert_eq!(body["issued_at"], "2026-01-01T00:00:00.000Z");
    assert!(body["signature"].as_str().unwrap().starts_with("0x"));
}

#[test]
fn signed_email_step_uses_compact_interaction_json() {
    let key = parse_private_key(&test_key()).unwrap();
    let challenge = email_challenge_from_json_str(&email_challenge_json()).unwrap();
    let built = build_signed_payment_step_at(
        &challenge,
        &key,
        "11111111-1111-4111-8111-111111111111",
        301,
    )
    .unwrap();
    assert_eq!(built.envelope["interaction_version"], 1);
    assert_eq!(built.envelope["protocol"], "x402.payment");
    assert_eq!(built.envelope["step"], "payment");
    assert_eq!(
        built.envelope["prev_step_id"],
        "f00dface-0000-0000-0000-0000000000aa"
    );
    assert_eq!(
        built.envelope["payload"]["payment"]["payload"]["signature"],
        PAYMENT_SIGNATURE
    );
    assert!(!built.json.contains('\n'));
}

#[test]
fn settlement_receipt_matching_uses_interaction_id_and_later_step() {
    let interaction_id = "a1b2c3d4-0000-0000-0000-000000000001@payer.example";
    assert!(is_settlement_receipt_for(
        &json!({ "interaction_id": interaction_id, "step": "settled" }),
        interaction_id
    ));
    assert!(is_settlement_receipt_for(
        &json!({ "interaction_id": interaction_id }),
        interaction_id
    ));
    assert!(!is_settlement_receipt_for(
        &json!({ "interaction_id": "different@payer.example", "step": "settled" }),
        interaction_id
    ));
    assert!(!is_settlement_receipt_for(
        &json!({ "interaction_id": interaction_id, "step": "challenge" }),
        interaction_id
    ));
    assert!(!is_settlement_receipt_for(
        &json!({ "interaction_id": interaction_id, "step": "payment" }),
        interaction_id
    ));
}

#[test]
fn settle_tx_extraction_checks_top_level_then_payload() {
    assert_eq!(
        extract_settle_tx(&json!({ "settle_tx": "0xabc" })),
        Some("0xabc")
    );
    assert_eq!(
        extract_settle_tx(&json!({ "payload": { "settle_tx": "0xdef" } })),
        Some("0xdef")
    );
    assert_eq!(
        extract_settle_tx(&json!({ "settle_tx": "", "payload": { "settle_tx": "0xdef" } })),
        Some("0xdef")
    );
    assert_eq!(
        extract_settle_tx(&json!({ "payload": { "other": 1 } })),
        None
    );
}

#[test]
fn settlement_search_query_filters_payee_attachments_and_since() {
    let query =
        build_settlement_search_query("payee@example.com", "2030-01-01T00:00:00.000Z", None);
    assert_eq!(
        query.get("from").map(String::as_str),
        Some("payee@example.com")
    );
    assert_eq!(
        query.get("has_attachment").map(String::as_str),
        Some("true")
    );
    assert_eq!(
        query.get("date_from").map(String::as_str),
        Some("2030-01-01T00:00:00.000Z")
    );
    assert_eq!(
        query.get("include_facets").map(String::as_str),
        Some("false")
    );
    assert_eq!(query.get("limit").map(String::as_str), Some("50"));
    assert_eq!(query.get("snippet").map(String::as_str), Some("false"));
    assert_eq!(
        query.get("sort").map(String::as_str),
        Some("received_at_asc")
    );
    assert!(!query.contains_key("cursor"));

    let paged = build_settlement_search_query(
        "payee@example.com",
        "2030-01-01T00:00:00.000Z",
        Some("CURSOR_PAGE_2"),
    );
    assert_eq!(
        paged.get("cursor").map(String::as_str),
        Some("CURSOR_PAGE_2")
    );
}

#[test]
fn pay_email_completion_decision_matches_notice_receipt_timeout_rules() {
    let sent_only = decide_pay_email_completion(false, false, false, false);
    assert!(sent_only.print_wait_notice);
    assert!(!sent_only.print_settlement_receipt);
    assert!(!sent_only.print_timeout_message);
    assert!(!sent_only.exit_nonzero);

    let json_sent_only = decide_pay_email_completion(true, false, false, false);
    assert!(!json_sent_only.print_wait_notice);
    assert!(!json_sent_only.exit_nonzero);

    let settled = decide_pay_email_completion(false, true, false, true);
    assert!(!settled.print_wait_notice);
    assert!(settled.print_settlement_receipt);
    assert!(!settled.print_timeout_message);
    assert!(!settled.exit_nonzero);

    let timed_out = decide_pay_email_completion(false, true, false, false);
    assert!(!timed_out.print_settlement_receipt);
    assert!(timed_out.print_timeout_message);
    assert!(timed_out.exit_nonzero);

    let replayed = decide_pay_email_completion(false, true, true, false);
    assert!(!replayed.print_timeout_message);
    assert!(replayed.exit_nonzero);
}
