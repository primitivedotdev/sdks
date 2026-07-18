use primitive_rust::manifest;
use primitive_rust::wake_commands::{
    build_wake_authorizations_create_request_from_args,
    build_wake_authorizations_delete_request_from_args,
    build_wake_authorizations_list_request_from_args,
    build_wake_authorizations_update_request_from_args,
    build_wake_dispatches_list_request_from_args, build_wake_request,
    build_wake_schedules_create_request_from_args, build_wake_schedules_delete_request_from_args,
    build_wake_schedules_get_request_from_args, build_wake_schedules_list_request_from_args,
    build_wake_schedules_run_request_from_args, build_wake_schedules_update_request_from_args,
    execute_command, is_wake_friendly_command, wake_command_aliases, wake_command_target,
};
use serde_json::json;
use std::collections::BTreeMap;
use std::process::Command;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

fn command_output(values: &[&str]) -> String {
    let output = Command::new(env!("CARGO_BIN_EXE_primitive-rust"))
        .args(values)
        .output()
        .expect("run primitive-rust");
    assert!(
        output.status.success(),
        "{values:?} should exit 0; stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8(output.stdout).expect("stdout utf8")
}

fn assert_help_contains_flags(invocation: &[&str], expected_flags: &[&str]) {
    let stdout = command_output(invocation);
    assert!(
        stdout.contains("USAGE"),
        "{invocation:?} should print command help; stdout:\n{stdout}"
    );
    assert!(
        stdout.contains("FLAGS"),
        "{invocation:?} should include a FLAGS section; stdout:\n{stdout}"
    );
    assert!(
        !stdout.contains("--api-base-url"),
        "{invocation:?} should not expose hidden --api-base-url; stdout:\n{stdout}"
    );
    for flag in expected_flags {
        assert!(
            stdout.contains(flag),
            "{invocation:?} should document {flag}; stdout:\n{stdout}"
        );
    }
}

#[test]
fn wake_aliases_point_at_generated_operations() {
    let expected = [
        (
            "wake:schedules:list",
            "wake:list-wake-schedules",
            "GET",
            "/wake/schedules",
        ),
        (
            "wake:schedules:create",
            "wake:create-wake-schedule",
            "POST",
            "/wake/schedules",
        ),
        (
            "wake:schedules:get",
            "wake:get-wake-schedule",
            "GET",
            "/wake/schedules/{id}",
        ),
        (
            "wake:schedules:update",
            "wake:update-wake-schedule",
            "PATCH",
            "/wake/schedules/{id}",
        ),
        (
            "wake:schedules:delete",
            "wake:delete-wake-schedule",
            "DELETE",
            "/wake/schedules/{id}",
        ),
        (
            "wake:schedules:run",
            "wake:run-wake-schedule",
            "POST",
            "/wake/schedules/{id}/run",
        ),
        (
            "wake:authorizations:list",
            "wake:list-wake-authorizations",
            "GET",
            "/wake/authorizations",
        ),
        (
            "wake:authorizations:create",
            "wake:create-wake-authorization",
            "POST",
            "/wake/authorizations",
        ),
        (
            "wake:authorizations:update",
            "wake:update-wake-authorization",
            "PATCH",
            "/wake/authorizations/{id}",
        ),
        (
            "wake:authorizations:delete",
            "wake:delete-wake-authorization",
            "DELETE",
            "/wake/authorizations/{id}",
        ),
        (
            "wake:dispatches:list",
            "wake:list-wake-dispatches",
            "GET",
            "/wake/dispatches",
        ),
    ];

    assert_eq!(wake_command_aliases().len(), expected.len());
    for (alias, target, method, path) in expected {
        assert!(is_wake_friendly_command(alias));
        assert_eq!(wake_command_target(alias), Some(target));
        assert_eq!(wake_command_target(&alias.replace(':', " ")), Some(target));

        let operation = manifest::lookup_operation(target)
            .unwrap_or_else(|| panic!("missing generated operation {target}"));
        assert_eq!(operation.method, method);
        assert_eq!(operation.path, path);
    }
}

#[test]
fn wake_help_requests_return_before_argument_validation() {
    execute_command("wake:schedules:list", &args(&["--help"]))
        .expect("help request should succeed");
}

#[test]
fn wake_leaf_help_documents_node_visible_flags() {
    let cases: &[(&[&str], &[&str], &[&str])] = &[
        (
            &["schedules", "list"],
            &["schedules:list"],
            &["--api-key", "--time"],
        ),
        (
            &["schedules", "create"],
            &["schedules:create"],
            &[
                "--api-key",
                "--time",
                "--from",
                "--to",
                "--command",
                "--cron",
                "--timezone",
                "--args",
                "--note",
            ],
        ),
        (
            &["schedules", "get"],
            &["schedules:get"],
            &["--api-key", "--time"],
        ),
        (
            &["schedules", "update"],
            &["schedules:update"],
            &[
                "--api-key",
                "--time",
                "--from",
                "--to",
                "--command",
                "--cron",
                "--timezone",
                "--args",
                "--note",
                "--enabled",
                "--no-enabled",
            ],
        ),
        (
            &["schedules", "delete"],
            &["schedules:delete"],
            &["--api-key", "--time"],
        ),
        (
            &["schedules", "run"],
            &["schedules:run"],
            &["--api-key", "--time"],
        ),
        (
            &["authorizations", "list"],
            &["authorizations:list"],
            &["--api-key", "--time", "--endpoint"],
        ),
        (
            &["authorizations", "create"],
            &["authorizations:create"],
            &[
                "--api-key",
                "--time",
                "--endpoint",
                "--domain",
                "--address",
                "--command",
                "--note",
            ],
        ),
        (
            &["authorizations", "update"],
            &["authorizations:update"],
            &["--api-key", "--time", "--enabled", "--no-enabled"],
        ),
        (
            &["authorizations", "delete"],
            &["authorizations:delete"],
            &["--api-key", "--time"],
        ),
        (
            &["dispatches", "list"],
            &["dispatches:list"],
            &["--api-key", "--time", "--limit"],
        ),
    ];

    for (space_parts, colon_parts, expected_flags) in cases {
        let mut spaced = vec!["wake"];
        spaced.extend_from_slice(space_parts);
        spaced.push("--help");
        assert_help_contains_flags(&spaced, expected_flags);

        let mut colon = vec!["wake"];
        colon.extend_from_slice(colon_parts);
        colon.push("--help");
        assert_help_contains_flags(&colon, expected_flags);
    }
}

#[test]
fn nested_wake_topic_help_lists_subcommands_and_aliases() {
    let cases = [
        (
            "schedules",
            [
                "wake schedules create",
                "wake schedules delete",
                "wake schedules get",
                "wake schedules list",
                "wake schedules run",
                "wake schedules update",
            ]
            .as_slice(),
            [
                "wake:schedules:create",
                "wake:create-wake-schedule",
                "wake:schedules:delete",
                "wake:delete-wake-schedule",
                "wake:schedules:get",
                "wake:get-wake-schedule",
                "wake:schedules:list",
                "wake:list-wake-schedules",
                "wake:schedules:run",
                "wake:run-wake-schedule",
                "wake:schedules:update",
                "wake:update-wake-schedule",
            ]
            .as_slice(),
        ),
        (
            "authorizations",
            [
                "wake authorizations create",
                "wake authorizations delete",
                "wake authorizations list",
                "wake authorizations update",
            ]
            .as_slice(),
            [
                "wake:authorizations:create",
                "wake:create-wake-authorization",
                "wake:authorizations:delete",
                "wake:delete-wake-authorization",
                "wake:authorizations:list",
                "wake:list-wake-authorizations",
                "wake:authorizations:update",
                "wake:update-wake-authorization",
            ]
            .as_slice(),
        ),
        (
            "dispatches",
            ["wake dispatches list"].as_slice(),
            ["wake:dispatches:list", "wake:list-wake-dispatches"].as_slice(),
        ),
    ];

    for (topic, subcommands, _aliases) in cases {
        let arg_forms = [
            vec!["wake".to_string(), topic.to_string()],
            vec!["wake".to_string(), topic.to_string(), "--help".to_string()],
            vec![format!("wake:{topic}")],
            vec![format!("wake:{topic}"), "--help".to_string()],
            vec!["help".to_string(), format!("wake:{topic}")],
            vec!["help".to_string(), "wake".to_string(), topic.to_string()],
        ];
        for args in arg_forms {
            let label = args.join(" ");
            let output = Command::new(env!("CARGO_BIN_EXE_primitive-rust"))
                .args(args)
                .output()
                .expect("run primitive-rust");
            assert!(
                output.status.success(),
                "{label} should exit 0; stderr: {}",
                String::from_utf8_lossy(&output.stderr)
            );

            let stdout = String::from_utf8(output.stdout).expect("stdout utf8");
            assert!(stdout.contains(&format!("primitive wake {topic} COMMAND")));
            for subcommand in subcommands {
                assert!(
                    stdout.contains(subcommand),
                    "wake {topic} help should list {subcommand}; stdout:\n{stdout}"
                );
            }
        }
    }
}

#[test]
fn build_wake_request_accepts_friendly_and_generated_aliases() {
    let friendly = build_wake_request(
        "wake schedules create",
        &args(&[
            "--from",
            "scheduler@example.com",
            "--to",
            "worker@example.com",
            "--command",
            "process_inbox",
            "--cron",
            "0 9 * * *",
        ]),
    )
    .expect("friendly request");
    let generated = build_wake_request(
        "wake:create-wake-schedule",
        &args(&[
            "--from",
            "scheduler@example.com",
            "--to",
            "worker@example.com",
            "--command",
            "process_inbox",
            "--cron",
            "0 9 * * *",
        ]),
    )
    .expect("generated request");

    assert_eq!(friendly, generated);
    assert_eq!(friendly.target_operation_id, "wake:create-wake-schedule");
}

#[test]
fn schedules_create_maps_node_friendly_flags_to_request_body() {
    let request = build_wake_schedules_create_request_from_args(&args(&[
        "--from",
        "scheduler@acme.dev",
        "--to",
        "agent@acme.dev",
        "--command",
        "process_inbox",
        "--cron",
        "0 9 * * *",
        "--timezone",
        "America/New_York",
        "--args",
        r#"{"limit":10,"dryRun":true}"#,
        "--note",
        "weekday run",
        "--api-key",
        "ignored",
        "--time",
    ]))
    .expect("create request");

    assert_eq!(request.target_operation_id, "wake:create-wake-schedule");
    assert_eq!(request.method, "POST");
    assert_eq!(request.path, "/wake/schedules");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(
        request.body,
        Some(json!({
            "from_address": "scheduler@acme.dev",
            "target_address": "agent@acme.dev",
            "command": "process_inbox",
            "cron_expr": "0 9 * * *",
            "timezone": "America/New_York",
            "args": {"limit": 10, "dryRun": true},
            "note": "weekday run"
        }))
    );
}

#[test]
fn schedules_update_maps_enabled_no_enabled_and_optional_fields() {
    let request = build_wake_schedules_update_request_from_args(&args(&[
        "schedule/123",
        "--from",
        "scheduler@acme.dev",
        "--to",
        "agent@acme.dev",
        "--command",
        "sync_mail",
        "--cron",
        "*/15 * * * *",
        "--timezone",
        "UTC",
        "--args",
        r#"{"batch":5}"#,
        "--note",
        "paused for maintenance",
        "--no-enabled",
    ]))
    .expect("update request");

    assert_eq!(request.target_operation_id, "wake:update-wake-schedule");
    assert_eq!(request.method, "PATCH");
    assert_eq!(request.path, "/wake/schedules/schedule%2F123");
    assert_eq!(
        request.body,
        Some(json!({
            "enabled": false,
            "command": "sync_mail",
            "cron_expr": "*/15 * * * *",
            "timezone": "UTC",
            "from_address": "scheduler@acme.dev",
            "target_address": "agent@acme.dev",
            "args": {"batch": 5},
            "note": "paused for maintenance"
        }))
    );

    let enabled =
        build_wake_schedules_update_request_from_args(&args(&["schedule_123", "--enabled"]))
            .expect("enabled update");
    assert_eq!(enabled.body, Some(json!({"enabled": true})));
}

#[test]
fn schedules_update_value_flags_reject_following_flag_tokens() {
    let error = build_wake_schedules_update_request_from_args(&args(&[
        "sched_123",
        "--note",
        "--enabled",
        "--api-key",
        "prim_test",
    ]))
    .expect_err("flag token should not be consumed as --note value");

    assert!(error.to_string().contains("Flag --note expects a value"));
}

#[test]
fn schedules_update_value_flags_accept_single_dash_values() {
    let request =
        build_wake_schedules_update_request_from_args(&args(&["sched_123", "--note", "-1"]))
            .expect("single-dash value should remain a value");

    assert_eq!(
        request.body,
        Some(json!({
            "note": "-1"
        }))
    );
}

#[test]
fn schedules_list_get_delete_and_run_build_expected_requests() {
    let list = build_wake_schedules_list_request_from_args(&args(&["--api-base-url", "ignored"]))
        .expect("list request");
    assert_eq!(list.target_operation_id, "wake:list-wake-schedules");
    assert_eq!(list.method, "GET");
    assert_eq!(list.path, "/wake/schedules");
    assert_eq!(list.body, None);

    let get =
        build_wake_schedules_get_request_from_args(&args(&["schedule/123"])).expect("get request");
    assert_eq!(get.target_operation_id, "wake:get-wake-schedule");
    assert_eq!(get.method, "GET");
    assert_eq!(get.path, "/wake/schedules/schedule%2F123");
    assert_eq!(get.body, None);

    let delete = build_wake_schedules_delete_request_from_args(&args(&["schedule/123"]))
        .expect("delete request");
    assert_eq!(delete.target_operation_id, "wake:delete-wake-schedule");
    assert_eq!(delete.method, "DELETE");
    assert_eq!(delete.path, "/wake/schedules/schedule%2F123");
    assert_eq!(delete.body, None);

    let run =
        build_wake_schedules_run_request_from_args(&args(&["schedule/123"])).expect("run request");
    assert_eq!(run.target_operation_id, "wake:run-wake-schedule");
    assert_eq!(run.method, "POST");
    assert_eq!(run.path, "/wake/schedules/schedule%2F123/run");
    assert_eq!(run.body, None);
}

#[test]
fn authorizations_create_and_list_map_endpoint_domain_and_commands() {
    let list =
        build_wake_authorizations_list_request_from_args(&args(&["--endpoint", "endpoint_123"]))
            .expect("list request");
    assert_eq!(list.target_operation_id, "wake:list-wake-authorizations");
    assert_eq!(list.method, "GET");
    assert_eq!(list.path, "/wake/authorizations");
    assert_eq!(
        list.query,
        BTreeMap::from([(
            "recipient_endpoint_id".to_string(),
            "endpoint_123".to_string()
        )])
    );
    assert_eq!(list.body, None);

    let create = build_wake_authorizations_create_request_from_args(&args(&[
        "--endpoint",
        "endpoint_123",
        "--domain",
        "agents.acme.dev",
        "--address",
        "scheduler@agents.acme.dev",
        "--command",
        "process_inbox",
        "--command",
        "sync_mail",
        "--note",
        "trusted scheduler",
    ]))
    .expect("create request");
    assert_eq!(create.target_operation_id, "wake:create-wake-authorization");
    assert_eq!(create.method, "POST");
    assert_eq!(create.path, "/wake/authorizations");
    assert_eq!(
        create.body,
        Some(json!({
            "recipient_endpoint_id": "endpoint_123",
            "allowed_sender_domain": "agents.acme.dev",
            "allowed_sender_address": "scheduler@agents.acme.dev",
            "allowed_commands": ["process_inbox", "sync_mail"],
            "note": "trusted scheduler"
        }))
    );
}

#[test]
fn authorizations_update_and_delete_build_expected_requests() {
    let update =
        build_wake_authorizations_update_request_from_args(&args(&["auth/123", "--no-enabled"]))
            .expect("update request");
    assert_eq!(update.target_operation_id, "wake:update-wake-authorization");
    assert_eq!(update.method, "PATCH");
    assert_eq!(update.path, "/wake/authorizations/auth%2F123");
    assert_eq!(update.body, Some(json!({"enabled": false})));

    let enabled =
        build_wake_authorizations_update_request_from_args(&args(&["auth_123", "--enabled"]))
            .expect("enabled update");
    assert_eq!(enabled.body, Some(json!({"enabled": true})));

    let missing = build_wake_authorizations_update_request_from_args(&args(&["auth_123"]))
        .expect_err("missing enabled flag should fail");
    assert!(missing
        .to_string()
        .contains("Pass --enabled or --no-enabled"));

    let delete = build_wake_authorizations_delete_request_from_args(&args(&["auth/123"]))
        .expect("delete request");
    assert_eq!(delete.target_operation_id, "wake:delete-wake-authorization");
    assert_eq!(delete.method, "DELETE");
    assert_eq!(delete.path, "/wake/authorizations/auth%2F123");
    assert_eq!(delete.body, None);
}

#[test]
fn dispatches_list_maps_limit_query() {
    let request = build_wake_dispatches_list_request_from_args(&args(&["--limit", "20"]))
        .expect("dispatches list request");

    assert_eq!(request.target_operation_id, "wake:list-wake-dispatches");
    assert_eq!(request.method, "GET");
    assert_eq!(request.path, "/wake/dispatches");
    assert_eq!(
        request.query,
        BTreeMap::from([("limit".to_string(), "20".to_string())])
    );
    assert_eq!(request.body, None);
}

#[test]
fn args_flag_must_be_json_object() {
    let array = build_wake_schedules_create_request_from_args(&args(&[
        "--from",
        "scheduler@acme.dev",
        "--to",
        "agent@acme.dev",
        "--command",
        "process_inbox",
        "--cron",
        "0 9 * * *",
        "--args",
        "[]",
    ]))
    .expect_err("array args should fail");
    assert!(array.to_string().contains("--args must be a JSON object"));

    let invalid = build_wake_schedules_update_request_from_args(&args(&[
        "schedule_123",
        "--args",
        "{not-json}",
    ]))
    .expect_err("invalid args should fail");
    assert!(invalid.to_string().contains("--args must be valid JSON"));
}
