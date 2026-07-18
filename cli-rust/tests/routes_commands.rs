use primitive_rust::manifest;
use primitive_rust::routes_commands::{
    build_route_request, build_routes_add_request_from_args, build_routes_list_request_from_args,
    build_routes_remove_request_from_args, build_routes_reorder_request_from_args,
    build_routes_test_request_from_args, build_routes_update_request_from_args, execute_command,
    is_routes_friendly_command, leaf_help as route_leaf_help, route_command_aliases,
    route_command_target,
};
use serde_json::json;
use std::collections::BTreeMap;
use std::process::Command;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
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

#[test]
fn route_aliases_point_at_generated_operations() {
    let expected = [
        ("routes:add", "routes:create-route", "POST", "/routes"),
        ("routes:list", "routes:list-routes", "GET", "/routes"),
        (
            "routes:test",
            "routes:simulate-route",
            "POST",
            "/routes/simulate",
        ),
        (
            "routes:update",
            "routes:update-route",
            "PATCH",
            "/routes/{id}",
        ),
        (
            "routes:reorder",
            "routes:reorder-routes",
            "POST",
            "/routes/reorder",
        ),
        (
            "routes:remove",
            "routes:delete-route",
            "DELETE",
            "/routes/{id}",
        ),
    ];

    assert_eq!(route_command_aliases().len(), expected.len());
    for (alias, target, method, path) in expected {
        assert!(is_routes_friendly_command(alias));
        assert_eq!(route_command_target(alias), Some(target));
        assert_eq!(route_command_target(&alias.replace(':', " ")), Some(target));

        let operation = manifest::lookup_operation(target)
            .unwrap_or_else(|| panic!("missing generated operation {target}"));
        assert_eq!(operation.method, method);
        assert_eq!(operation.path, path);
    }
}

#[test]
fn build_route_request_accepts_friendly_and_generated_aliases() {
    let friendly = build_route_request(
        "routes add",
        &args(&["alice@example.com", "--endpoint", "endpoint_123"]),
    )
    .expect("friendly route request");
    let generated = build_route_request(
        "routes:create-route",
        &args(&["alice@example.com", "--endpoint", "endpoint_123"]),
    )
    .expect("generated route request");

    assert_eq!(friendly, generated);
    assert_eq!(friendly.target_operation_id, "routes:create-route");
}

#[test]
fn routes_help_requests_return_before_argument_validation() {
    execute_command("routes:add", &args(&["--help"])).expect("help request should succeed");
}

#[test]
fn routes_leaf_help_lists_node_visible_flags_for_space_and_colon_spelling() {
    let cases: &[(&str, &[&str])] = &[
        (
            "routes add",
            &[
                "Add a recipient route",
                "routes add",
                "<pattern>",
                "--api-key",
                "--function",
                "--endpoint",
                "--match",
                "--domain",
                "--priority",
                "--disabled",
                "--time",
            ],
        ),
        (
            "routes list",
            &[
                "List recipient routes",
                "routes list",
                "--api-key",
                "--time",
            ],
        ),
        (
            "routes test",
            &[
                "Simulate routing for a recipient",
                "routes test",
                "<recipient>",
                "--api-key",
                "--event-type",
                "--time",
            ],
        ),
        (
            "routes update",
            &[
                "Update a recipient route",
                "routes update",
                "<id>",
                "--api-key",
                "--match",
                "--pattern",
                "--endpoint",
                "--domain",
                "--priority",
                "--enable",
                "--disable",
                "--time",
            ],
        ),
        (
            "routes reorder",
            &[
                "Reorder recipient routes",
                "routes reorder",
                "--api-key",
                "--set",
                "--time",
            ],
        ),
        (
            "routes remove",
            &[
                "Remove a recipient route",
                "routes remove",
                "<id>",
                "--api-key",
                "--time",
            ],
        ),
    ];

    for (spaced, expected_tokens) in cases {
        for command in [spaced.to_string(), spaced.replace(' ', ":")] {
            let help = route_leaf_help(&command)
                .unwrap_or_else(|| panic!("{command} should have leaf help"));
            assert_tokens(&help, expected_tokens);
            assert!(!help.contains("--api-base-url"), "{command}");
            assert!(
                !help.contains("Primitive Rust CLI routes commands"),
                "{command}"
            );
        }
    }
}

#[test]
fn routes_space_help_uses_typed_subcommand_surface() {
    let cases: &[(&[&str], &[&str])] = &[
        (
            &["routes", "add", "--help"],
            &[
                "Add a recipient route",
                "routes add",
                "--function",
                "--endpoint",
                "--match",
                "--disabled",
            ],
        ),
        (
            &["routes", "list", "--help"],
            &[
                "List recipient routes",
                "routes list",
                "--api-key",
                "--time",
            ],
        ),
        (
            &["routes", "test", "--help"],
            &[
                "Simulate routing for a recipient",
                "routes test",
                "--event-type",
            ],
        ),
        (
            &["routes", "update", "--help"],
            &[
                "Update a recipient route",
                "routes update",
                "--match",
                "--pattern",
                "--endpoint",
                "--enable",
                "--disable",
            ],
        ),
        (
            &["routes", "reorder", "--help"],
            &["Reorder recipient routes", "routes reorder", "--set"],
        ),
        (
            &["routes", "remove", "--help"],
            &["Remove a recipient route", "routes remove", "<id>"],
        ),
    ];

    for (values, expected_tokens) in cases {
        let help = run_primitive(values);
        assert_tokens(&help, expected_tokens);
        assert!(!help.contains("--api-base-url"), "{values:?}");
        assert!(
            !help.contains("Primitive Rust CLI routes commands"),
            "{values:?}"
        );
    }
}

#[test]
fn routes_add_maps_positional_pattern_and_endpoint_body() {
    let request = build_routes_add_request_from_args(&args(&[
        "billing@example.com",
        "--endpoint",
        "endpoint_123",
        "--priority",
        "10",
        "--api-key",
        "ignored",
        "--time",
    ]))
    .expect("add request");

    assert_eq!(request.target_operation_id, "routes:create-route");
    assert_eq!(request.method, "POST");
    assert_eq!(request.path, "/routes");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(
        request.body,
        Some(json!({
            "match_type": "exact",
            "pattern": "billing@example.com",
            "endpoint_id": "endpoint_123",
            "priority": 10
        }))
    );
}

#[test]
fn routes_add_maps_function_target_domain_match_and_disabled_flag() {
    let request = build_routes_add_request_from_args(&args(&[
        "support+*@example.com",
        "--match",
        "wildcard",
        "--function",
        "fn_123",
        "--domain",
        "domain_123",
        "--disabled",
    ]))
    .expect("add request");

    assert_eq!(
        request.body,
        Some(json!({
            "match_type": "wildcard",
            "pattern": "support+*@example.com",
            "function_id": "fn_123",
            "domain_id": "domain_123",
            "enabled": false
        }))
    );
}

#[test]
fn routes_add_rejects_invalid_positionals_and_target_flags() {
    let missing_pattern =
        build_routes_add_request_from_args(&args(&["--endpoint", "endpoint_123"]))
            .expect_err("missing positional should fail");
    assert!(missing_pattern
        .to_string()
        .contains("routes add requires a pattern"));

    let extra = build_routes_add_request_from_args(&args(&[
        "a@example.com",
        "b@example.com",
        "--endpoint",
        "endpoint_123",
    ]))
    .expect_err("extra positional should fail");
    assert!(extra
        .to_string()
        .contains("Unexpected argument: b@example.com"));

    let missing_target = build_routes_add_request_from_args(&args(&["a@example.com"]))
        .expect_err("missing target should fail");
    assert!(missing_target
        .to_string()
        .contains("Provide exactly one of --function"));

    let both_targets = build_routes_add_request_from_args(&args(&[
        "a@example.com",
        "--function",
        "fn_123",
        "--endpoint",
        "endpoint_123",
    ]))
    .expect_err("conflicting targets should fail");
    assert!(both_targets
        .to_string()
        .contains("Provide exactly one of --function"));
}

#[test]
fn routes_list_maps_to_empty_get_request() {
    let request = build_routes_list_request_from_args(&args(&["--api-base-url", "ignored"]))
        .expect("list request");

    assert_eq!(request.target_operation_id, "routes:list-routes");
    assert_eq!(request.method, "GET");
    assert_eq!(request.path, "/routes");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(request.body, None);

    let error = build_routes_list_request_from_args(&args(&["unexpected"]))
        .expect_err("list positional should fail");
    assert!(error
        .to_string()
        .contains("Unexpected argument: unexpected"));
}

#[test]
fn routes_test_maps_recipient_and_event_type_body() {
    let request = build_routes_test_request_from_args(&args(&[
        "bounce@example.com",
        "--event-type",
        "email.bounced",
    ]))
    .expect("test request");

    assert_eq!(request.target_operation_id, "routes:simulate-route");
    assert_eq!(request.method, "POST");
    assert_eq!(request.path, "/routes/simulate");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(
        request.body,
        Some(json!({
            "recipient": "bounce@example.com",
            "event_type": "email.bounced"
        }))
    );
}

#[test]
fn routes_update_maps_path_and_patch_body() {
    let request = build_routes_update_request_from_args(&args(&[
        "route/123",
        "--match",
        "regex",
        "--pattern",
        ".*@example\\.com",
        "--endpoint",
        "endpoint_456",
        "--domain",
        "domain_123",
        "--priority",
        "25",
        "--disable",
    ]))
    .expect("update request");

    assert_eq!(request.target_operation_id, "routes:update-route");
    assert_eq!(request.method, "PATCH");
    assert_eq!(request.path, "/routes/route%2F123");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(
        request.body,
        Some(json!({
            "match_type": "regex",
            "pattern": ".*@example\\.com",
            "endpoint_id": "endpoint_456",
            "domain_id": "domain_123",
            "priority": 25,
            "enabled": false
        }))
    );
}

#[test]
fn routes_update_rejects_empty_update_and_enable_disable_conflict() {
    let empty = build_routes_update_request_from_args(&args(&["route_123"]))
        .expect_err("empty update should fail");
    assert!(empty
        .to_string()
        .contains("Provide at least one field to update"));

    let conflict =
        build_routes_update_request_from_args(&args(&["route_123", "--enable", "--disable"]))
            .expect_err("enable/disable conflict should fail");
    assert!(conflict
        .to_string()
        .contains("Use either --enable or --disable"));
}

#[test]
fn routes_match_type_validation_is_deterministic() {
    let create = build_routes_add_request_from_args(&args(&[
        "a@example.com",
        "--endpoint",
        "endpoint_123",
        "--match",
        "prefix",
    ]))
    .expect_err("invalid create match should fail");
    assert!(create
        .to_string()
        .contains("Expected --match to be one of: exact, wildcard, regex"));

    let update = build_routes_update_request_from_args(&args(&["route_123", "--match", "prefix"]))
        .expect_err("invalid update match should fail");
    assert!(update
        .to_string()
        .contains("Expected --match to be one of: exact, wildcard, regex"));
}

#[test]
fn routes_reorder_maps_repeatable_set_values() {
    let request = build_routes_reorder_request_from_args(&args(&[
        "--set",
        "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA=20",
        "--set=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb=5",
    ]))
    .expect("reorder request");

    assert_eq!(request.target_operation_id, "routes:reorder-routes");
    assert_eq!(request.method, "POST");
    assert_eq!(request.path, "/routes/reorder");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(
        request.body,
        Some(json!({
            "updates": [
                {
                    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    "priority": 20
                },
                {
                    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    "priority": 5
                }
            ]
        }))
    );
}

#[test]
fn routes_reorder_rejects_missing_invalid_and_duplicate_set_values() {
    let missing =
        build_routes_reorder_request_from_args(&args(&[])).expect_err("missing set should fail");
    assert!(missing
        .to_string()
        .contains("routes reorder requires at least one --set value"));

    let invalid = build_routes_reorder_request_from_args(&args(&["--set", "route_123=-1"]))
        .expect_err("invalid priority should fail");
    assert!(invalid.to_string().contains("Invalid --set value"));

    let duplicate = build_routes_reorder_request_from_args(&args(&[
        "--set",
        "ROUTE_123=1",
        "--set",
        "route_123=2",
    ]))
    .expect_err("duplicate route should fail");
    assert!(duplicate
        .to_string()
        .contains("Route route_123 appears more than once"));
}

#[test]
fn routes_remove_maps_positional_id_to_delete_path() {
    let request =
        build_routes_remove_request_from_args(&args(&["route/123"])).expect("remove request");

    assert_eq!(request.target_operation_id, "routes:delete-route");
    assert_eq!(request.method, "DELETE");
    assert_eq!(request.path, "/routes/route%2F123");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(request.body, None);
}
