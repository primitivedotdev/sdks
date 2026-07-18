use primitive_rust::doctor_commands::{
    build_doctor_plan, check_account_response, check_api_key, check_domains_response,
    check_proxy_env, doctor_summary, render_row, write_doctor_report, ApiKeyCheckInput,
    CheckOutcome, CheckRow, CheckStatus, DoctorApiResponse,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

fn env(values: &[(&str, &str)]) -> BTreeMap<String, String> {
    values
        .iter()
        .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
        .collect()
}

fn temp_config_dir(name: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("primitive-rust-doctor-{name}-{nonce}"));
    fs::create_dir_all(&path).expect("create temp dir");
    path
}

fn json_response(status: u16, body: Value) -> DoctorApiResponse {
    DoctorApiResponse {
        status,
        bytes: serde_json::to_vec(&body).expect("serialize body"),
        body: Some(body),
    }
}

#[test]
fn doctor_plan_parses_auth_flags_and_rejects_extra_input() {
    let plan = build_doctor_plan(&args(&[
        "--api-key",
        "prim_test",
        "--api-base-url=https://api.example.test/v1",
    ]))
    .expect("plan");

    assert_eq!(
        plan.auth,
        BTreeMap::from([
            (
                "api-base-url".to_string(),
                "https://api.example.test/v1".to_string()
            ),
            ("api-key".to_string(), "prim_test".to_string()),
        ])
    );

    let positional = build_doctor_plan(&args(&["extra"])).expect_err("positionals should fail");
    assert!(positional.to_string().contains("Unexpected argument"));

    let unknown = build_doctor_plan(&args(&["--json"])).expect_err("unknown flags should fail");
    assert!(unknown.to_string().contains("Unknown flag --json"));

    let missing = build_doctor_plan(&args(&["--api-key"])).expect_err("missing value should fail");
    assert!(missing.to_string().contains("Missing value for --api-key"));
}

#[test]
fn doctor_help_hides_api_base_url() {
    let output = Command::new(env!("CARGO_BIN_EXE_primitive-rust"))
        .args(["doctor", "--help"])
        .output()
        .expect("run primitive-rust");
    assert!(
        output.status.success(),
        "doctor --help should exit 0; stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let stdout = String::from_utf8(output.stdout).expect("stdout utf8");
    assert!(stdout.contains("--api-key"));
    assert!(!stdout.contains("--api-base-url"));
}

#[test]
fn render_row_uses_node_doctor_status_prefixes() {
    assert_eq!(
        render_row(&CheckRow {
            label: "CLI runtime".to_string(),
            outcome: CheckOutcome::ok("primitive-rust 0.1.0"),
        }),
        "[OK]   CLI runtime: primitive-rust 0.1.0"
    );
    assert_eq!(
        render_row(&CheckRow {
            label: "Proxy env".to_string(),
            outcome: CheckOutcome::warn("HTTPS_PROXY set", None::<String>),
        }),
        "[WARN] Proxy env: HTTPS_PROXY set"
    );
    assert_eq!(
        render_row(&CheckRow {
            label: "Auth".to_string(),
            outcome: CheckOutcome::fail("missing", None::<String>),
        }),
        "[FAIL] Auth: missing"
    );
}

#[test]
fn proxy_check_reports_node_proxy_gotcha_without_hiding_present_vars() {
    let no_proxy = check_proxy_env(&env(&[]));
    assert_eq!(no_proxy.status, CheckStatus::Ok);
    assert_eq!(no_proxy.message, "no proxy env vars set");

    let enabled = check_proxy_env(&env(&[
        ("NODE_USE_ENV_PROXY", "1"),
        ("HTTPS_PROXY", "http://corp-proxy:8080"),
    ]));
    assert_eq!(enabled.status, CheckStatus::Ok);
    assert!(enabled.message.contains("NODE_USE_ENV_PROXY=1"));
    assert!(enabled
        .message
        .contains("HTTPS_PROXY=http://corp-proxy:8080"));

    let missing_node_flag = check_proxy_env(&env(&[
        ("HTTPS_PROXY", "http://corp-proxy:8443"),
        ("HTTP_PROXY", "http://corp-proxy:8080"),
    ]));
    assert_eq!(missing_node_flag.status, CheckStatus::Warn);
    assert!(missing_node_flag
        .message
        .contains("HTTPS_PROXY / HTTP_PROXY set"));
    assert!(missing_node_flag
        .hint
        .as_deref()
        .expect("hint")
        .contains("NODE_USE_ENV_PROXY=1"));
}

#[test]
fn api_key_check_handles_env_keys_rename_hint_and_credentials_files() {
    let missing_dir = PathBuf::from("/tmp/definitely-missing-primitive-doctor-test-2026");

    let from_env = check_api_key(ApiKeyCheckInput {
        api_key: None,
        config_dir: &missing_dir,
        env: &env(&[("PRIMITIVE_API_KEY", "prim_env")]),
    });
    assert_eq!(from_env.status, CheckStatus::Ok);
    assert!(from_env.message.contains("prim_"));

    let wrong_key = check_api_key(ApiKeyCheckInput {
        api_key: Some("sk_live_wrong"),
        config_dir: &missing_dir,
        env: &env(&[]),
    });
    assert_eq!(wrong_key.status, CheckStatus::Warn);
    assert!(wrong_key
        .hint
        .as_deref()
        .expect("hint")
        .contains("Primitive API key"));

    let rename = check_api_key(ApiKeyCheckInput {
        api_key: None,
        config_dir: &missing_dir,
        env: &env(&[("PRIMITIVE_KEY", "prim_legacy_var")]),
    });
    assert_eq!(rename.status, CheckStatus::Fail);
    assert!(rename.message.contains("PRIMITIVE_KEY"));
    assert!(rename
        .hint
        .as_deref()
        .expect("hint")
        .contains("PRIMITIVE_API_KEY=$PRIMITIVE_KEY"));

    let missing = check_api_key(ApiKeyCheckInput {
        api_key: None,
        config_dir: &missing_dir,
        env: &env(&[]),
    });
    assert_eq!(missing.status, CheckStatus::Fail);
    assert!(missing.message.contains("no CLI OAuth session"));
}

#[test]
fn api_key_check_distinguishes_oauth_legacy_missing_and_malformed_credentials() {
    let oauth_dir = temp_config_dir("oauth");
    let legacy_dir = temp_config_dir("legacy");
    let empty_dir = temp_config_dir("empty");
    let malformed_dir = temp_config_dir("malformed");
    fs::write(
        oauth_dir.join("credentials.json"),
        json!({
            "auth_method": "oauth",
            "access_token": "prim_oat_saved"
        })
        .to_string(),
    )
    .expect("write oauth");
    fs::write(
        legacy_dir.join("credentials.json"),
        json!({ "api_key": "prim_legacy_saved" }).to_string(),
    )
    .expect("write legacy");
    fs::write(empty_dir.join("credentials.json"), "{}").expect("write empty");
    fs::write(malformed_dir.join("credentials.json"), "{not valid json").expect("write malformed");

    let clean_env = env(&[]);
    let oauth = check_api_key(ApiKeyCheckInput {
        api_key: None,
        config_dir: &oauth_dir,
        env: &clean_env,
    });
    assert_eq!(oauth.status, CheckStatus::Ok);
    assert!(oauth.message.contains("OAuth session"));

    let legacy = check_api_key(ApiKeyCheckInput {
        api_key: None,
        config_dir: &legacy_dir,
        env: &clean_env,
    });
    assert_eq!(legacy.status, CheckStatus::Fail);
    assert!(legacy.message.contains("legacy API-key login state"));

    let empty = check_api_key(ApiKeyCheckInput {
        api_key: None,
        config_dir: &empty_dir,
        env: &clean_env,
    });
    assert_eq!(empty.status, CheckStatus::Fail);
    assert!(empty.message.contains("contains no OAuth access_token"));

    let malformed = check_api_key(ApiKeyCheckInput {
        api_key: None,
        config_dir: &malformed_dir,
        env: &clean_env,
    });
    assert_eq!(malformed.status, CheckStatus::Fail);
    assert!(malformed.message.contains("unreadable or malformed"));

    for path in [oauth_dir, legacy_dir, empty_dir, malformed_dir] {
        fs::remove_dir_all(path).expect("cleanup");
    }
}

#[test]
fn account_response_check_matches_doctor_success_and_rejected_key_shapes() {
    let ok = check_account_response(&json_response(
        200,
        json!({
            "data": {
                "email": "user@example.com",
                "plan": "developer",
                "id": "acct_123"
            }
        }),
    ));
    assert_eq!(ok.outcome.status, CheckStatus::Ok);
    assert_eq!(
        ok.outcome.message,
        "user@example.com (plan: developer, id: acct_123)"
    );
    assert!(ok.account.is_some());

    let rejected = check_account_response(&json_response(
        401,
        json!({
            "error": {
                "code": "unauthorized"
            }
        }),
    ));
    assert_eq!(rejected.outcome.status, CheckStatus::Fail);
    assert!(rejected.outcome.message.contains("API rejected the key"));
    assert!(rejected
        .outcome
        .hint
        .as_deref()
        .expect("hint")
        .contains("primitive whoami"));

    let empty = check_account_response(&json_response(200, json!({})));
    assert_eq!(empty.outcome.status, CheckStatus::Fail);
    assert!(empty.outcome.message.contains("empty body"));
}

#[test]
fn domains_response_check_accepts_verified_and_legacy_active_flags() {
    let active = check_domains_response(&json_response(
        200,
        json!({
            "data": [
                { "domain": "primary.test", "verified": true },
                { "domain": "secondary.test", "is_active": true },
                { "domain": "inactive.test", "verified": false }
            ]
        }),
    ));
    assert_eq!(active.status, CheckStatus::Ok);
    assert_eq!(
        active.message,
        "2 active domain(s): primary.test, secondary.test"
    );

    let none = check_domains_response(&json_response(200, json!({ "data": [] })));
    assert_eq!(none.status, CheckStatus::Warn);
    assert!(none.message.contains("no domains"));

    let inactive = check_domains_response(&json_response(
        200,
        json!({
            "data": [
                { "domain": "inactive.test", "verified": false }
            ]
        }),
    ));
    assert_eq!(inactive.status, CheckStatus::Warn);
    assert!(inactive.message.contains("none active"));
}

#[test]
fn report_writer_keeps_human_rows_on_stderr_and_json_summary_on_stdout() {
    let rows = vec![
        CheckRow {
            label: "CLI runtime".to_string(),
            outcome: CheckOutcome::ok("primitive-rust 0.1.0"),
        },
        CheckRow {
            label: "Proxy env".to_string(),
            outcome: CheckOutcome::warn("HTTPS_PROXY set", Some("set NODE_USE_ENV_PROXY=1")),
        },
    ];
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();

    let code = write_doctor_report(&rows, &mut stdout, &mut stderr).expect("write report");

    assert_eq!(code, 0);
    let stderr = String::from_utf8(stderr).expect("stderr utf8");
    assert!(stderr.contains("[OK]   CLI runtime: primitive-rust 0.1.0"));
    assert!(stderr.contains("[WARN] Proxy env: HTTPS_PROXY set"));
    assert!(stderr.contains("hint: set NODE_USE_ENV_PROXY=1"));

    let summary: Value = serde_json::from_slice(&stdout).expect("summary json");
    assert_eq!(summary["ok"], false);
    assert_eq!(summary["checks"][1]["status"], "warn");
    assert!(!doctor_summary(&rows).ok);

    let fail_rows = vec![CheckRow {
        label: "Auth".to_string(),
        outcome: CheckOutcome::fail("missing", None::<String>),
    }];
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let code = write_doctor_report(&fail_rows, &mut stdout, &mut stderr).expect("write fail");
    assert_eq!(code, 1);
}
