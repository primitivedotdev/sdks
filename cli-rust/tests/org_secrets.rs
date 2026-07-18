use anyhow::anyhow;
use primitive_rust::manifest;
use primitive_rust::org_secrets::{
    auth_flags, build_create_org_secret_request, build_delete_org_secret_request,
    build_org_secrets_command_plan_with_io, build_org_secrets_list_request_from_args,
    build_org_secrets_remove_request_from_args, build_org_secrets_set_request_from_args_with_io,
    has_time_flag, is_org_secrets_friendly_command, org_secrets_command_aliases,
    org_secrets_command_target, org_secrets_leaf_help_text, parse_set_org_secret_command_plan,
    render_org_secrets_output, OrgSecretsOutputBehavior, SingleSecretValueSource,
};
use serde_json::{json, Value};
use std::collections::BTreeMap;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

fn body_value(request_body: &Option<Value>, key: &str) -> String {
    request_body
        .as_ref()
        .and_then(|body| body.get(key))
        .and_then(Value::as_str)
        .unwrap_or_else(|| panic!("missing string body field {key}"))
        .to_string()
}

fn no_file_reader(path: &str) -> anyhow::Result<String> {
    Err(anyhow!("unexpected file read {path}"))
}

fn no_stdin_reader() -> anyhow::Result<String> {
    Err(anyhow!("unexpected stdin read"))
}

#[test]
fn org_secret_aliases_point_at_generated_operations() {
    let expected = [
        (
            "org:secrets:list",
            "functions:list-org-secrets",
            "GET",
            "/org/secrets",
        ),
        (
            "org:secrets:set",
            "functions:create-org-secret",
            "POST",
            "/org/secrets",
        ),
        (
            "org:secrets:remove",
            "functions:delete-org-secret",
            "DELETE",
            "/org/secrets/{key}",
        ),
        (
            "org:secrets:delete",
            "functions:delete-org-secret",
            "DELETE",
            "/org/secrets/{key}",
        ),
    ];

    assert_eq!(org_secrets_command_aliases().len(), expected.len());
    for (alias, target, method, path) in expected {
        assert!(is_org_secrets_friendly_command(alias));
        assert!(is_org_secrets_friendly_command(&alias.replace(':', " ")));
        assert_eq!(org_secrets_command_target(alias), Some(target));
        assert_eq!(
            org_secrets_command_target(&alias.replace(':', " ")),
            Some(target)
        );

        let operation = manifest::lookup_operation(target)
            .unwrap_or_else(|| panic!("missing generated operation {target}"));
        assert_eq!(operation.method, method);
        assert_eq!(operation.path, path);
    }
    assert!(is_org_secrets_friendly_command("org:secrets"));
}

#[test]
fn org_secrets_parent_help_dispatch_forms_are_accepted() {
    for values in [
        args(&["org:secrets"]),
        args(&["org:secrets", "--help"]),
        args(&["help", "org:secrets"]),
    ] {
        primitive_rust::friendly::dispatch(values).expect("org secrets parent help");
    }
}

#[test]
fn org_secrets_leaf_help_documents_node_visible_flags() {
    for (command, expected) in [
        (
            "org:secrets:list",
            vec!["org secrets list", "--api-key <value>", "--time"],
        ),
        (
            "org:secrets:set",
            vec![
                "org secrets set --key <KEY>",
                "--api-key <value>",
                "--key <KEY>",
                "--stdin",
                "--time",
                "--value <value>",
                "--value-file <path>",
                "--value-from-env <KEY>",
                "--value-from-env-file <FILE[:KEY]>",
            ],
        ),
        (
            "org:secrets:remove",
            vec![
                "org secrets remove --key <KEY>",
                "--api-key <value>",
                "--key <KEY>",
                "--time",
            ],
        ),
        (
            "org:secrets:delete",
            vec![
                "org secrets delete --key <KEY>",
                "--api-key <value>",
                "--key <KEY>",
                "--time",
            ],
        ),
    ] {
        let help = org_secrets_leaf_help_text(command).expect("leaf help");
        for expected in expected {
            assert!(help.contains(expected), "{command}: {expected}");
        }
    }
}

#[test]
fn list_maps_to_items_json_request_without_positionals() {
    let request = build_org_secrets_list_request_from_args(&args(&[
        "--api-key",
        "ignored",
        "--api-base-url=https://api.example.test/v1",
        "--time",
    ]))
    .expect("list request");

    assert_eq!(request.target_operation_id, "functions:list-org-secrets");
    assert_eq!(request.method, "GET");
    assert_eq!(request.path, "/org/secrets");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(request.body, None);

    let plan = build_org_secrets_command_plan_with_io(
        "org secrets list",
        &args(&["--time"]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
    )
    .expect("list plan");
    assert_eq!(plan.output_behavior, OrgSecretsOutputBehavior::Json);

    let error = build_org_secrets_list_request_from_args(&args(&["unexpected"]))
        .expect_err("list positional should fail");
    assert!(error
        .to_string()
        .contains("Unexpected argument: unexpected"));
}

#[test]
fn set_parses_direct_value_and_builds_post_body() {
    let parsed = parse_set_org_secret_command_plan(&args(&[
        "--key",
        "MODEL_API_KEY",
        "--value=token=live",
        "--api-key",
        "ignored",
        "--time",
    ]))
    .expect("set parse");

    assert_eq!(parsed.key, "MODEL_API_KEY");
    assert_eq!(
        parsed.source,
        SingleSecretValueSource::Value("token=live".to_string())
    );

    let plan = build_org_secrets_command_plan_with_io(
        "org:secrets:set",
        &args(&["--key", "MODEL_API_KEY", "--value=token=live"]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
    )
    .expect("set plan");

    assert_eq!(plan.target_operation_id, "functions:create-org-secret");
    assert_eq!(plan.request.method, "POST");
    assert_eq!(plan.request.path, "/org/secrets");
    assert_eq!(
        plan.request.body,
        Some(json!({ "key": "MODEL_API_KEY", "value": "token=live" }))
    );
    assert_eq!(
        plan.output_behavior,
        OrgSecretsOutputBehavior::SetNotice {
            key: "MODEL_API_KEY".to_string()
        }
    );
}

#[test]
fn set_resolves_env_file_and_stdin_value_sources() {
    let mut env = BTreeMap::new();
    env.insert("MODEL_API_KEY".to_string(), "token-env".to_string());
    let from_env = build_org_secrets_set_request_from_args_with_io(
        &args(&[
            "--key",
            "MODEL_API_KEY",
            "--value-from-env",
            "MODEL_API_KEY",
        ]),
        env,
        no_file_reader,
        no_stdin_reader,
    )
    .expect("env request");
    assert_eq!(body_value(&from_env.body, "value"), "token-env");

    let from_file = build_org_secrets_set_request_from_args_with_io(
        &args(&["--key", "MODEL_API_KEY", "--value-file", "secret.txt"]),
        BTreeMap::new(),
        |path| match path {
            "secret.txt" => Ok("file\nvalue".to_string()),
            other => Err(anyhow!("unexpected read {other}")),
        },
        no_stdin_reader,
    )
    .expect("file request");
    assert_eq!(body_value(&from_file.body, "value"), "file\nvalue");

    let from_env_file = build_org_secrets_set_request_from_args_with_io(
        &args(&[
            "--key",
            "MODEL_API_KEY",
            "--value-from-env-file",
            ".env.local:ALT_KEY",
        ]),
        BTreeMap::new(),
        |path| match path {
            ".env.local" => Ok(
                "# comment\nexport ALT_KEY=\"line\\nvalue\"\nMODEL_API_KEY=ignored\n".to_string(),
            ),
            other => Err(anyhow!("unexpected read {other}")),
        },
        no_stdin_reader,
    )
    .expect("env file request");
    assert_eq!(body_value(&from_env_file.body, "value"), "line\nvalue");

    let from_env_file_fallback = build_org_secrets_set_request_from_args_with_io(
        &args(&[
            "--key",
            "MODEL_API_KEY",
            "--value-from-env-file",
            ".env.local",
        ]),
        BTreeMap::new(),
        |path| match path {
            ".env.local" => Ok("MODEL_API_KEY='single quoted'\n".to_string()),
            other => Err(anyhow!("unexpected read {other}")),
        },
        no_stdin_reader,
    )
    .expect("env file fallback request");
    assert_eq!(
        body_value(&from_env_file_fallback.body, "value"),
        "single quoted"
    );

    let from_stdin = build_org_secrets_set_request_from_args_with_io(
        &args(&["--key", "MODEL_API_KEY", "--stdin"]),
        BTreeMap::new(),
        no_file_reader,
        || Ok("stdin-value\r\n".to_string()),
    )
    .expect("stdin request");
    assert_eq!(body_value(&from_stdin.body, "value"), "stdin-value");
}

#[test]
fn set_rejects_invalid_keys_missing_sources_and_conflicting_sources() {
    let invalid_key =
        parse_set_org_secret_command_plan(&args(&["--key", "model_api_key", "--value", "token"]))
            .expect_err("invalid key should fail");
    assert!(invalid_key.to_string().contains("^[A-Z_][A-Z0-9_]*$"));

    let missing_source = parse_set_org_secret_command_plan(&args(&["--key", "MODEL_API_KEY"]))
        .expect_err("missing source should fail");
    assert!(missing_source
        .to_string()
        .contains("Pass exactly one of --value"));

    let conflicting_sources = parse_set_org_secret_command_plan(&args(&[
        "--key",
        "MODEL_API_KEY",
        "--value",
        "token",
        "--stdin",
    ]))
    .expect_err("conflicting sources should fail");
    assert!(conflicting_sources
        .to_string()
        .contains("Pass exactly one of --value"));

    let missing_env = build_org_secrets_set_request_from_args_with_io(
        &args(&[
            "--key",
            "MODEL_API_KEY",
            "--value-from-env",
            "MODEL_API_KEY",
        ]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
    )
    .expect_err("missing env should fail");
    assert!(missing_env
        .to_string()
        .contains("environment variable is not set"));
}

#[test]
fn remove_requires_key_and_builds_delete_request() {
    let request = build_org_secrets_remove_request_from_args(&args(&[
        "--key",
        "STRIPE_KEY",
        "--api-base-url",
        "ignored",
        "--time",
    ]))
    .expect("remove request");

    assert_eq!(request.target_operation_id, "functions:delete-org-secret");
    assert_eq!(request.method, "DELETE");
    assert_eq!(request.path, "/org/secrets/STRIPE_KEY");
    assert_eq!(request.query, BTreeMap::new());
    assert_eq!(request.body, None);

    let direct = build_delete_org_secret_request("MODEL_API_KEY").expect("direct delete request");
    assert_eq!(direct.path, "/org/secrets/MODEL_API_KEY");

    let missing_key = build_org_secrets_remove_request_from_args(&args(&[]))
        .expect_err("missing key should fail");
    assert!(missing_key.to_string().contains("Missing required --key"));
}

#[test]
fn delete_aliases_require_key_and_build_delete_request() {
    for command in ["org secrets delete", "org:secrets:delete"] {
        let plan = build_org_secrets_command_plan_with_io(
            command,
            &args(&["--key", "STRIPE_KEY"]),
            BTreeMap::new(),
            no_file_reader,
            no_stdin_reader,
        )
        .unwrap_or_else(|error| panic!("{command} should build a delete plan: {error}"));

        assert_eq!(plan.target_operation_id, "functions:delete-org-secret");
        assert_eq!(plan.request.method, "DELETE");
        assert_eq!(plan.request.path, "/org/secrets/STRIPE_KEY");
        assert_eq!(
            plan.output_behavior,
            OrgSecretsOutputBehavior::RemoveNotice {
                key: "STRIPE_KEY".to_string()
            }
        );
    }
}

#[test]
fn delete_alias_rejects_positional_key_like_remove() {
    for command in ["org secrets delete", "org:secrets:delete"] {
        let error = build_org_secrets_command_plan_with_io(
            command,
            &args(&["STRIPE_KEY"]),
            BTreeMap::new(),
            no_file_reader,
            no_stdin_reader,
        )
        .unwrap_err();

        assert!(
            error
                .to_string()
                .contains("Unexpected argument: STRIPE_KEY"),
            "{command} should reject positional key, got {error}"
        );
    }
}

#[test]
fn auth_flags_and_time_detection_ignore_command_specific_flags() {
    let flags = auth_flags(&args(&[
        "--key",
        "MODEL_API_KEY",
        "--value",
        "token",
        "--api-key",
        "token_test",
        "--api-base-url=https://api.example.test/v1",
        "--time",
    ]))
    .expect("auth flags");

    assert_eq!(
        flags,
        BTreeMap::from([
            (
                "api-base-url".to_string(),
                "https://api.example.test/v1".to_string()
            ),
            ("api-key".to_string(), "token_test".to_string()),
        ])
    );
    assert!(has_time_flag(&args(&["--time"])));
    assert!(has_time_flag(&args(&["--time=true"])));
    assert!(!has_time_flag(&args(&["--time=false", "--no-time"])));

    let missing = auth_flags(&args(&["--api-key"])).expect_err("missing api key should fail");
    assert!(missing.to_string().contains("Missing value for --api-key"));
}

#[test]
fn success_output_matches_node_friendly_behavior() {
    let list_plan = build_org_secrets_command_plan_with_io(
        "org secrets list",
        &args(&[]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
    )
    .expect("list plan");
    let list_output = render_org_secrets_output(
        &list_plan,
        &json!([{ "key": "MODEL_API_KEY", "created_at": "2026-07-17T00:00:00Z" }]),
    )
    .expect("list output");
    assert!(list_output.stdout[0].contains("\"key\": \"MODEL_API_KEY\""));
    assert!(list_output.stderr.is_empty());

    let set_plan = build_org_secrets_command_plan_with_io(
        "org secrets set",
        &args(&["--key", "MODEL_API_KEY", "--value", "token"]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
    )
    .expect("set plan");
    let set_output = render_org_secrets_output(
        &set_plan,
        &json!({ "key": "MODEL_API_KEY", "created": true }),
    )
    .expect("set output");
    assert!(set_output.stdout[0].contains("\"created\": true"));
    assert_eq!(
        set_output.stderr,
        vec![
            "Global secret MODEL_API_KEY saved. Deployed functions pick it up on their next redeploy; a function secret of the same name overrides it."
        ]
    );

    let remove_plan = build_org_secrets_command_plan_with_io(
        "org secrets remove",
        &args(&["--key", "MODEL_API_KEY"]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
    )
    .expect("remove plan");
    let remove_output =
        render_org_secrets_output(&remove_plan, &Value::Null).expect("remove output");
    assert!(remove_output.stdout.is_empty());
    assert_eq!(
        remove_output.stderr,
        vec![
            "Global secret MODEL_API_KEY deleted. Deployed functions keep the previous value until each is redeployed."
        ]
    );
}

#[test]
fn direct_request_builders_validate_key_and_match_node_paths() {
    let set = build_create_org_secret_request("MODEL_API_KEY", "token").expect("create request");
    assert_eq!(set.target_operation_id, "functions:create-org-secret");
    assert_eq!(set.method, "POST");
    assert_eq!(set.path, "/org/secrets");
    assert_eq!(
        set.body,
        Some(json!({ "key": "MODEL_API_KEY", "value": "token" }))
    );

    let invalid = build_create_org_secret_request("model_api_key", "token")
        .expect_err("invalid key should fail");
    assert!(invalid.to_string().contains("^[A-Z_][A-Z0-9_]*$"));
}
