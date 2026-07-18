use primitive_rust::inbox_commands::{
    build_inbox_command_plan, build_inbox_setup_guide, build_setup_command_plan_from_args,
    find_suggested_primitive_address, focus_inbox_status, format_domain_header, format_domain_row,
    format_inbox_date, format_inbox_setup_guide, format_inbox_status, inbox_command_target,
    inbox_setup_help_text, inbox_status_help_text, is_inbox_friendly_command, render_inbox_output,
    ApiRequest, InboxCommandPlan, InboxOutputMode, InboxRuntimeFlags, InboxStatus,
    InboxStatusDomain, InboxStatusEndpointSummary, InboxStatusFunctionSummary,
    InboxStatusNextAction, InboxStatusRecentEmailSummary,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::process::Command;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
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
    String::from_utf8(output.stdout).expect("stdout should be utf-8")
}

fn domain(
    name: &str,
    status: &str,
    receiving_ready: bool,
    processing_ready: bool,
    processing_route_count: u64,
) -> InboxStatusDomain {
    InboxStatusDomain {
        id: format!("domain_{name}"),
        domain: name.to_string(),
        verified: true,
        active: true,
        managed: name.ends_with("primitive.dev"),
        receiving_ready,
        processing_ready,
        processing_route_count,
        endpoint_count: processing_route_count,
        enabled_endpoint_count: processing_route_count,
        function_endpoint_count: processing_route_count,
        email_count: 7,
        latest_email_received_at: Some("2026-07-17T12:13:14Z".to_string()),
        status: status.to_string(),
    }
}

fn sample_status() -> InboxStatus {
    InboxStatus {
        ready: false,
        receiving_ready: true,
        processing_ready: false,
        summary: "Inbound mail is stored but not processed.".to_string(),
        next_actions: vec![InboxStatusNextAction {
            kind: "configure_processing".to_string(),
            message: "Deploy a Function processing route.".to_string(),
            command: Some("primitive functions init inbound-reply".to_string()),
        }],
        domains: vec![
            domain("managed.primitive.dev", "stored_only", true, false, 0),
            domain("example.com", "ready", true, true, 2),
        ],
        endpoints: InboxStatusEndpointSummary {
            total: 2,
            enabled: 1,
            disabled: 1,
            fallback_enabled: 1,
            domain_scoped_enabled: 0,
            http_enabled: 0,
            function_enabled: 1,
        },
        functions: InboxStatusFunctionSummary {
            total: 2,
            deployed: 1,
            pending: 1,
            failed: 0,
        },
        recent_emails: InboxStatusRecentEmailSummary {
            total: 9,
            latest_received_at: Some("2026-07-17T12:13:14Z".to_string()),
        },
    }
}

fn envelope(status: InboxStatus) -> Value {
    json!({
        "success": true,
        "data": status,
        "meta": {"request_id": "req_123"}
    })
}

#[test]
fn inbox_targets_cover_friendly_shortcuts_and_generated_status() {
    assert_eq!(
        inbox_command_target("inbox setup"),
        Some("inbox:get-inbox-status")
    );
    assert_eq!(
        inbox_command_target("inbox:status"),
        Some("inbox:get-inbox-status")
    );
    assert_eq!(
        inbox_command_target("inbox:get-inbox-status"),
        Some("inbox:get-inbox-status")
    );
    assert!(is_inbox_friendly_command("inbox setup"));
    assert!(is_inbox_friendly_command("inbox:status"));
    assert!(is_inbox_friendly_command("inbox:get-inbox-status"));
}

#[test]
fn inbox_help_requests_return_before_argument_validation() {
    for values in [
        ["setup", "--help"].as_slice(),
        ["status", "--help"].as_slice(),
        ["setup", "--api-key", "prim_test", "--help"].as_slice(),
    ] {
        primitive_rust::inbox_commands::dispatch(&args(values))
            .unwrap_or_else(|error| panic!("{values:?} should print help: {error}"));
    }
}

#[test]
fn root_inbox_generated_status_help_wins_over_parent_help() {
    for values in [
        ["inbox", "get-inbox-status", "--help"].as_slice(),
        ["inbox:get-inbox-status", "--help"].as_slice(),
    ] {
        let output = run_primitive(values);
        assert!(
            output.contains("Show inbound email readiness"),
            "{values:?}"
        );
        assert!(output.contains("FLAGS"), "{values:?}");
        assert!(output.contains("--api-key <value>"), "{values:?}");
        assert!(output.contains("--domain <value>"), "{values:?}");
        assert!(output.contains("--json"), "{values:?}");
        assert!(output.contains("--time"), "{values:?}");
        assert!(!output.contains("API\n  GET /inbox/status"), "{values:?}");
        assert!(!output.contains("--envelope"), "{values:?}");
        assert!(
            !output.contains("inbox commands: setup, status"),
            "{values:?}"
        );
    }
}

#[test]
fn root_inbox_friendly_status_help_stays_friendly() {
    let output = run_primitive(&["inbox", "status", "--help"]);

    assert!(output.contains("Show inbound email readiness"));
    assert!(output.contains("primitive-rust inbox status"));
    assert!(output.contains("--domain <value>"));
    assert!(!output.contains("API\n  GET /inbox/status"));
    assert!(!output.contains("--envelope"));
}

#[test]
fn root_inbox_colon_help_uses_leaf_surfaces() {
    for (values, expected) in [
        (
            ["inbox:setup", "--help"].as_slice(),
            vec![
                "Guide inbound email setup",
                "--api-key <value>",
                "--json",
                "--time",
            ],
        ),
        (
            ["inbox:status", "--help"].as_slice(),
            vec![
                "Show inbound email readiness",
                "--api-key <value>",
                "--domain <value>",
                "--json",
                "--time",
            ],
        ),
    ] {
        let output = run_primitive(values);
        for expected in expected {
            assert!(output.contains(expected), "{values:?}: {expected}");
        }
        assert!(
            !output.contains("Primitive Rust CLI inbox commands"),
            "{values:?}"
        );
    }
}

#[test]
fn inbox_leaf_help_documents_node_visible_flags() {
    for (help, expected) in [
        (
            inbox_setup_help_text(),
            vec!["inbox setup", "--api-key <value>", "--json", "--time"],
        ),
        (
            inbox_status_help_text("status"),
            vec![
                "inbox status",
                "--api-key <value>",
                "--domain <value>",
                "--json",
                "--time",
            ],
        ),
    ] {
        for expected in expected {
            assert!(help.contains(expected), "{expected}");
        }
    }
}

#[test]
fn status_plan_parses_runtime_flags_and_domain_focus() {
    let plan = build_inbox_command_plan(&args(&[
        "status",
        "--domain",
        "Example.COM",
        "--json",
        "--api-key",
        "key_123",
        "--api-base-url=https://api.example.test/v1",
        "--time",
    ]))
    .expect("status plan");

    assert_eq!(plan.target_operation_id, "inbox:get-inbox-status");
    assert_eq!(
        plan.request,
        ApiRequest {
            method: "GET".to_string(),
            path: "/inbox/status".to_string(),
            query: BTreeMap::new(),
            body: None,
        }
    );
    assert_eq!(
        plan.output_mode,
        InboxOutputMode::StatusJson {
            domain: Some("Example.COM".to_string())
        }
    );
    assert_eq!(
        plan.runtime.auth,
        BTreeMap::from([
            (
                "api-base-url".to_string(),
                "https://api.example.test/v1".to_string()
            ),
            ("api-key".to_string(), "key_123".to_string()),
        ])
    );
    assert!(plan.runtime.time);
}

#[test]
fn setup_plan_accepts_setup_flags_and_rejects_status_only_flags() {
    let plan =
        build_setup_command_plan_from_args(&args(&["--json", "--no-time"])).expect("setup plan");

    assert_eq!(plan.target_operation_id, "inbox:get-inbox-status");
    assert_eq!(plan.output_mode, InboxOutputMode::SetupJson);
    assert!(!plan.runtime.time);

    let error = build_setup_command_plan_from_args(&args(&["--domain", "example.com"]))
        .expect_err("setup does not take domain focus");
    assert!(error.to_string().contains("Unknown flag --domain"));
}

#[test]
fn focus_status_is_case_insensitive_and_keeps_account_summaries() {
    let status = sample_status();
    let focused = focus_inbox_status(&status, "EXAMPLE.COM").expect("focus domain");

    assert_eq!(focused.domains.len(), 1);
    assert_eq!(focused.domains[0].domain, "example.com");
    assert!(focused.ready);
    assert!(focused.receiving_ready);
    assert!(focused.processing_ready);
    assert_eq!(
        focused.summary,
        "example.com can receive mail and has 2 processing routes."
    );
    assert_eq!(focused.endpoints, status.endpoints);
    assert_eq!(focused.functions, status.functions);
    assert_eq!(focused.recent_emails.total, 7);

    let missing =
        focus_inbox_status(&status, "missing.example").expect_err("missing domain should fail");
    assert!(missing
        .to_string()
        .contains("Domain missing.example was not found."));
}

#[test]
fn status_formatting_includes_table_counts_dates_and_suggested_address() {
    let status = sample_status();
    let output = format_inbox_status(&status);

    assert!(format_domain_header().contains("DOMAIN"));
    assert!(format_domain_row(&status.domains[1]).contains("example.com"));
    assert!(output.contains("Inbound mail is stored but not processed."));
    assert!(output.contains("managed.primitive.dev"));
    assert!(output.contains("Endpoints: 1/2 enabled (1 fallback, 0 domain-scoped, 1 function)"));
    assert!(output.contains("Functions: 1/2 deployed (1 pending, 0 failed)"));
    assert!(output.contains("Recent inbound: 9 emails latest 2026-07-17 12:13:14 UTC"));
    assert!(output.contains("Primitive address: agent@managed.primitive.dev"));
    assert!(output.contains("primitive send --to agent@managed.primitive.dev"));
    assert!(output.contains("primitive functions init inbound-reply"));

    assert_eq!(
        find_suggested_primitive_address(&status.domains),
        Some((
            "agent@managed.primitive.dev".to_string(),
            "managed.primitive.dev".to_string()
        ))
    );
    assert_eq!(format_inbox_date(None), "never");
    assert_eq!(format_inbox_date(Some("not-a-date")), "not-a-date");
}

#[test]
fn setup_guide_models_stored_only_readiness_and_scaffold_commands() {
    let status = sample_status();
    let guide = build_inbox_setup_guide(&status);
    let output = format_inbox_setup_guide(&guide);

    assert_eq!(guide.readiness.mode, "stored_only");
    assert_eq!(
        guide.receive.address.as_deref(),
        Some("inbox@managed.primitive.dev")
    );
    assert!(guide.processing.stored_only);
    assert!(!guide.processing.active);
    assert!(output.contains("Inbound setup"));
    assert!(output.contains("Mode: stored-only"));
    assert!(output.contains("Receive address: inbox@managed.primitive.dev"));
    assert!(output.contains("No processing route is enabled."));
    assert!(output.contains("primitive functions deploy --name inbound-reply"));
    assert!(output.contains("Proof after functions test"));
}

#[test]
fn rendering_json_preserves_envelope_and_replaces_data_shape() {
    let status = sample_status();
    let status_plan = InboxCommandPlan {
        target_operation_id: "inbox:get-inbox-status",
        request: ApiRequest {
            method: "GET".to_string(),
            path: "/inbox/status".to_string(),
            query: BTreeMap::new(),
            body: None,
        },
        output_mode: InboxOutputMode::StatusJson {
            domain: Some("example.com".to_string()),
        },
        runtime: InboxRuntimeFlags {
            auth: BTreeMap::new(),
            time: false,
        },
    };

    let rendered = render_inbox_output(&status_plan, &envelope(status.clone())).expect("render");
    let rendered: Value = serde_json::from_str(&rendered).expect("json output");
    assert_eq!(rendered["success"], true);
    assert_eq!(rendered["meta"]["request_id"], "req_123");
    assert_eq!(rendered["data"]["domains"].as_array().unwrap().len(), 1);
    assert_eq!(
        rendered["data"]["summary"],
        "example.com can receive mail and has 2 processing routes."
    );

    let setup_plan = InboxCommandPlan {
        output_mode: InboxOutputMode::SetupJson,
        ..status_plan
    };
    let rendered = render_inbox_output(&setup_plan, &envelope(status)).expect("render setup");
    let rendered: Value = serde_json::from_str(&rendered).expect("json output");
    assert_eq!(rendered["data"]["readiness"]["mode"], "stored_only");
    assert_eq!(
        rendered["data"]["receive"]["address"],
        "inbox@managed.primitive.dev"
    );
    assert_eq!(
        rendered["data"]["commands"]["status"],
        "primitive inbox status"
    );
}
