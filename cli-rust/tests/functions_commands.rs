#[path = "../src/config.rs"]
pub mod config;

#[path = "../src/client.rs"]
pub mod client;

#[path = "../src/functions_commands.rs"]
pub mod functions_commands;

pub fn display_bin_name() -> String {
    "primitive-rust".to_string()
}

use anyhow::anyhow;
use functions_commands::{
    auth_flags, build_deploy_file_request_from_paths, build_deploy_source_create_request,
    build_function_command_plan_with_io, build_list_domains_request, build_list_endpoints_request,
    build_list_functions_request, build_redeploy_file_request_from_paths,
    build_redeploy_request_from_create_request, build_redeploy_source_request,
    build_route_get_request, build_route_set_request, build_route_unset_request,
    build_routing_topology_request, build_set_secret_request, build_set_secret_result,
    build_test_run_trace_request, collect_source_files, find_matching_function_endpoints,
    format_function_endpoint_noise_warning, format_function_test_no_route_message,
    format_function_test_timeout_message, format_route_status_hint,
    format_set_secret_redeploy_stage_warning, format_set_secret_saved_warning,
    function_command_target, function_id_for_name, function_test_failure_exit_code,
    functions_deploy_help_text, functions_init_help_text, functions_logs_help_text,
    functions_redeploy_help_text, functions_route_get_help_text, functions_route_set_help_text,
    functions_route_unset_help_text, functions_routing_topology_help_text,
    functions_set_secret_help_text, functions_templates_help_text, functions_test_help_text,
    has_time_flag, has_wait_timeout_elapsed, is_functions_friendly_command,
    is_terminal_function_test_trace_state, parse_deploy_command_plan, parse_logs_command_plan,
    parse_redeploy_command_plan, parse_route_set_command_plan, parse_set_secret_command_plan,
    parse_test_function_command_plan, resolve_single_secret_value,
    should_report_test_trace_no_route, FunctionApiBehavior, FunctionCommandPlan, FunctionLogsPlan,
    RawEndpointRow, RouteTargetInput, SecretFlagPair, SecretSourcePlan, SetSecretRedeployStage,
    SingleSecretValueSource, SingleSecretValueSourceInput, SourceDeployInput, SourceRedeployInput,
    TestFunctionPlan, DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS, DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS,
    DEFAULT_LOG_POLL_INTERVAL_SECONDS, DEFAULT_TEST_POLL_INTERVAL_SECONDS,
    DEFAULT_TEST_WAIT_TIMEOUT_SECONDS, TEST_TRACE_NO_DELIVERIES_GRACE_SECONDS,
};
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

fn files(entries: &[(&str, &str)]) -> BTreeMap<String, String> {
    entries
        .iter()
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect()
}

fn temp_dir(label: &str) -> PathBuf {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir().join(format!(
        "primitive-rust-functions-{label}-{}-{unique}",
        std::process::id()
    ))
}

fn no_file_reader(path: &str) -> anyhow::Result<String> {
    Err(anyhow!("unexpected file read {path}"))
}

fn no_stdin_reader() -> anyhow::Result<String> {
    Err(anyhow!("unexpected stdin read"))
}

fn no_source_reader(path: &str) -> anyhow::Result<BTreeMap<String, String>> {
    Err(anyhow!("unexpected source read {path}"))
}

#[test]
fn function_runtime_aliases_auth_flags_and_time_detection_are_stable() {
    assert!(is_functions_friendly_command("functions:deploy"));
    assert_eq!(
        function_command_target("functions deploy"),
        Some("functions:create-function")
    );
    assert_eq!(
        function_command_target("functions:list-function-logs"),
        Some("functions:list-function-logs")
    );
    assert_eq!(function_command_target("functions templates"), None);

    let flags = auth_flags(&args(&[
        "--api-key",
        "token_test",
        "--api-base-url=https://api.example.test/v1",
        "--time",
    ]))
    .expect("auth flags");
    assert_eq!(flags.get("api-key").map(String::as_str), Some("token_test"));
    assert_eq!(
        flags.get("api-base-url").map(String::as_str),
        Some("https://api.example.test/v1")
    );
    assert!(has_time_flag(&args(&["--time"])));
    assert!(has_time_flag(&args(&["--time=true"])));
    assert!(!has_time_flag(&args(&["--time=false", "--no-time"])));

    let missing = auth_flags(&args(&["--api-key"])).expect_err("missing auth value");
    assert!(missing.to_string().contains("Missing value for --api-key"));
}

#[test]
fn build_function_runtime_plan_reads_file_deploy_and_resolves_secret_sources() {
    let mut env = BTreeMap::new();
    env.insert("MODEL_API_KEY".to_string(), "token-env".to_string());

    let plan = build_function_command_plan_with_io(
        "functions deploy",
        &args(&[
            "--name",
            "forwarder",
            "--file",
            "bundle.js",
            "--source-map-file",
            "bundle.js.map",
            "--secret-from-env",
            "MODEL_API_KEY",
            "--api-key",
            "ignored",
            "--time",
            "--wait",
        ]),
        env,
        |path| match path {
            "bundle.js" => Ok("export default {};".to_string()),
            "bundle.js.map" => Ok("{\"version\":3}".to_string()),
            other => Err(anyhow!("unexpected read {other}")),
        },
        no_stdin_reader,
        no_source_reader,
    )
    .expect("runtime deploy plan");

    let FunctionCommandPlan::Api(plan) = plan else {
        panic!("expected api plan");
    };
    assert_eq!(plan.target_operation_id, "functions:create-function");
    assert_eq!(plan.request.method, "POST");
    assert_eq!(plan.request.path, "/functions");
    assert_eq!(
        plan.request.body,
        Some(json!({
            "name": "forwarder",
            "code": "export default {};",
            "sourceMap": "{\"version\":3}"
        }))
    );
    assert_eq!(
        plan.behavior,
        FunctionApiBehavior::Deploy {
            create: true,
            secrets: vec![SecretFlagPair {
                key: "MODEL_API_KEY".to_string(),
                value: "token-env".to_string(),
            }],
            wait: true,
            timeout_seconds: DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS,
            poll_interval_seconds: DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS,
        }
    );
}

#[test]
fn build_function_runtime_plan_handles_local_and_source_commands() {
    let templates = build_function_command_plan_with_io(
        "functions templates",
        &args(&["--json", "--time"]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
        no_source_reader,
    )
    .expect("templates plan");
    let FunctionCommandPlan::Templates(templates) = templates else {
        panic!("expected templates plan");
    };
    assert!(templates.json);

    let init = build_function_command_plan_with_io(
        "functions:init",
        &args(&[
            "reply-bot",
            "--out-dir",
            "./tmp/reply-bot",
            "--api-base-url",
            "ignored",
        ]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
        no_source_reader,
    )
    .expect("init plan");
    let FunctionCommandPlan::Init(init) = init else {
        panic!("expected init plan");
    };
    assert_eq!(init.name, "reply-bot");
    assert_eq!(init.out_dir, "./tmp/reply-bot");

    let source = build_function_command_plan_with_io(
        "functions:create-function",
        &args(&["--name", "triage", "--source", "src"]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
        |path| {
            assert_eq!(path, "src");
            Ok(files(&[
                ("package.json", "{}\n"),
                ("src/index.ts", "export {};"),
            ]))
        },
    )
    .expect("source deploy plan");
    let FunctionCommandPlan::Api(source) = source else {
        panic!("expected api plan");
    };
    assert_eq!(source.target_operation_id, "functions:create-function");
    assert_eq!(
        source.request.body,
        Some(json!({
            "name": "triage",
            "files": {
                "package.json": "{}\n",
                "src/index.ts": "export {};"
            }
        }))
    );
}

#[test]
fn build_function_runtime_plan_selects_route_logs_and_test_behaviors() {
    let route = build_function_command_plan_with_io(
        "functions route-set",
        &args(&[
            "--id",
            "fn_123",
            "--fallback",
            "--takeover",
            "--api-key",
            "ignored",
        ]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
        no_source_reader,
    )
    .expect("route plan");
    let FunctionCommandPlan::Api(route) = route else {
        panic!("expected api plan");
    };
    assert_eq!(route.target_operation_id, "functions:set-function-route");
    assert_eq!(route.behavior, FunctionApiBehavior::Json);
    assert_eq!(
        route.request.body,
        Some(json!({
            "target": { "kind": "fallback" },
            "takeover": true
        }))
    );

    let logs = build_function_command_plan_with_io(
        "functions:list-function-logs",
        &args(&[
            "--id",
            "fn_123",
            "--follow",
            "--jsonl",
            "--poll-interval",
            "7",
        ]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
        no_source_reader,
    )
    .expect("logs plan");
    let FunctionCommandPlan::Api(logs) = logs else {
        panic!("expected api plan");
    };
    assert_eq!(logs.target_operation_id, "functions:list-function-logs");
    assert_eq!(
        logs.behavior,
        FunctionApiBehavior::Logs {
            follow: true,
            jsonl: true,
            poll_interval_seconds: 7,
        }
    );

    let test = build_function_command_plan_with_io(
        "functions:test-function",
        &args(&[
            "--id",
            "fn_123",
            "--show-sends",
            "--timeout",
            "9",
            "--poll-interval",
            "3",
        ]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
        no_source_reader,
    )
    .expect("test plan");
    let FunctionCommandPlan::Api(test) = test else {
        panic!("expected api plan");
    };
    assert_eq!(test.target_operation_id, "functions:test-function");
    assert_eq!(
        test.behavior,
        FunctionApiBehavior::Test {
            wait: true,
            show_sends: true,
            timeout_seconds: 9,
            poll_interval_seconds: 3,
        }
    );
}

#[test]
fn builds_deploy_body_from_bundle_file_and_source_map() {
    let request = build_deploy_file_request_from_paths(
        "forwarder",
        "bundle.js",
        Some("bundle.js.map"),
        |path| match path {
            "bundle.js" => Ok("export default {};".to_string()),
            "bundle.js.map" => Ok("{\"version\":3}".to_string()),
            other => Err(anyhow!("unexpected read {other}")),
        },
    )
    .expect("deploy file request");

    assert_eq!(request.method, "POST");
    assert_eq!(request.path, "/functions");
    assert_eq!(
        request.body,
        Some(json!({
            "name": "forwarder",
            "code": "export default {};",
            "sourceMap": "{\"version\":3}"
        }))
    );
}

#[test]
fn builds_source_deploy_body_with_files_map() {
    let request = build_deploy_source_create_request(&SourceDeployInput {
        name: "triage".to_string(),
        files: files(&[
            ("package.json", "{\"dependencies\":{}}\n"),
            ("src/index.ts", "export default {};"),
        ]),
    });

    assert_eq!(request.method, "POST");
    assert_eq!(request.path, "/functions");
    assert_eq!(
        request.body,
        Some(json!({
            "name": "triage",
            "files": {
                "package.json": "{\"dependencies\":{}}\n",
                "src/index.ts": "export default {};"
            }
        }))
    );
}

#[test]
fn collects_source_deploy_files_like_node_cli() {
    let root = temp_dir("source");
    fs::create_dir_all(root.join("src/nested")).expect("create source dirs");
    fs::write(
        root.join("package.json"),
        r#"{"name":"triage","devDependencies":{"typescript":"^5.0.0"},"dependencies":{"@primitivedotdev/sdk":"^1.0.0"}}"#,
    )
    .expect("write package");
    fs::write(root.join("src/index.ts"), "export default {};").expect("write index");
    fs::write(root.join("src/nested/util.ts"), "export const ok = true;").expect("write util");
    fs::write(root.join("README.md"), "not shipped").expect("write readme");

    let source_dir = root.to_string_lossy().to_string();
    let collected = collect_source_files(&source_dir).expect("collect source files");

    assert_eq!(
        collected.get("src/index.ts").map(String::as_str),
        Some("export default {};")
    );
    assert_eq!(
        collected.get("src/nested/util.ts").map(String::as_str),
        Some("export const ok = true;")
    );
    assert!(!collected.contains_key("README.md"));
    let package_json = collected
        .get("package.json")
        .expect("package should be shipped");
    assert!(package_json.contains("\"dependencies\""));
    assert!(package_json.contains("\"@primitivedotdev/sdk\""));
    assert!(!package_json.contains("devDependencies"));
    assert!(package_json.ends_with('\n'));

    fs::remove_dir_all(root).expect("remove temp project");
}

#[test]
fn source_deploy_requires_package_json_and_source_files() {
    let missing_package = temp_dir("missing-package");
    fs::create_dir_all(missing_package.join("src")).expect("create src dir");
    fs::write(missing_package.join("src/index.ts"), "export default {};").expect("write source");
    let error = collect_source_files(&missing_package.to_string_lossy())
        .expect_err("package.json should be required");
    assert!(error.to_string().contains("No package.json found"));
    fs::remove_dir_all(missing_package).expect("remove missing package project");

    let missing_source = temp_dir("missing-source");
    fs::create_dir_all(&missing_source).expect("create project");
    fs::write(missing_source.join("package.json"), "{}").expect("write package");
    let error = collect_source_files(&missing_source.to_string_lossy())
        .expect_err("src files should be required");
    assert!(error.to_string().contains("No source files found under"));
    fs::remove_dir_all(missing_source).expect("remove missing source project");
}

#[test]
fn builds_redeploy_body_from_bundle_file_and_source_map() {
    let request = build_redeploy_file_request_from_paths(
        "fn_123",
        "dist/handler.js",
        Some("dist/handler.js.map"),
        |path| match path {
            "dist/handler.js" => Ok("export default { fetch() {} };".to_string()),
            "dist/handler.js.map" => Ok("{\"sources\":[]}".to_string()),
            other => Err(anyhow!("unexpected read {other}")),
        },
    )
    .expect("redeploy file request");

    assert_eq!(request.method, "PUT");
    assert_eq!(request.path, "/functions/fn_123");
    assert_eq!(
        request.body,
        Some(json!({
            "code": "export default { fetch() {} };",
            "sourceMap": "{\"sources\":[]}"
        }))
    );
}

#[test]
fn builds_source_redeploy_body_with_files_only() {
    let request = build_redeploy_source_request(&SourceRedeployInput {
        id: "fn_123".to_string(),
        files: files(&[
            ("package.json", "{\"dependencies\":{\"x\":\"1\"}}\n"),
            ("src/index.ts", "export default {};"),
        ]),
    });

    assert_eq!(request.method, "PUT");
    assert_eq!(request.path, "/functions/fn_123");
    assert_eq!(
        request.body,
        Some(json!({
            "files": {
                "package.json": "{\"dependencies\":{\"x\":\"1\"}}\n",
                "src/index.ts": "export default {};"
            }
        }))
    );
}

#[test]
fn source_deploy_can_redeploy_existing_function_by_name() {
    let create_request = build_deploy_source_create_request(&SourceDeployInput {
        name: "triage".to_string(),
        files: files(&[
            ("package.json", "{\"dependencies\":{}}\n"),
            ("src/index.ts", "export default {};"),
        ]),
    });

    let list_request = build_list_functions_request();
    assert_eq!(list_request.method, "GET");
    assert_eq!(list_request.path, "/functions");

    let existing_id = function_id_for_name(
        &json!([
            { "id": "fn_other", "name": "other" },
            { "id": "fn_existing", "name": "triage" }
        ]),
        "triage",
    );
    assert_eq!(existing_id.as_deref(), Some("fn_existing"));

    let redeploy = build_redeploy_request_from_create_request("fn_existing", &create_request)
        .expect("source redeploy request");
    assert_eq!(redeploy.method, "PUT");
    assert_eq!(redeploy.path, "/functions/fn_existing");
    assert_eq!(
        redeploy.body,
        Some(json!({
            "files": {
                "package.json": "{\"dependencies\":{}}\n",
                "src/index.ts": "export default {};"
            }
        }))
    );
}

#[test]
fn deploy_and_redeploy_parser_plans_keep_file_source_modes_pure() {
    let deploy = parse_deploy_command_plan(&args(&[
        "--name",
        "triage",
        "--source",
        ".",
        "--secret",
        "MODEL_API_KEY=token",
        "--wait",
    ]))
    .expect("deploy plan");
    assert_eq!(deploy.name, "triage");
    assert_eq!(
        deploy.secrets,
        SecretSourcePlan {
            inline: vec!["MODEL_API_KEY=token".to_string()],
            ..Default::default()
        }
    );
    assert!(deploy.wait);
    assert_eq!(deploy.timeout_seconds, DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS);
    assert_eq!(
        deploy.poll_interval_seconds,
        DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS
    );

    let redeploy = parse_redeploy_command_plan(&args(&[
        "--id",
        "fn_123",
        "--file",
        "bundle.js",
        "--source-map-file",
        "bundle.js.map",
    ]))
    .expect("redeploy plan");
    assert_eq!(redeploy.id, "fn_123");
    assert_eq!(redeploy.file, "bundle.js");
    assert_eq!(redeploy.source_map_file.as_deref(), Some("bundle.js.map"));
    assert!(!redeploy.wait);
}

#[test]
fn timeout_zero_means_wait_indefinitely_for_deploy_and_test_polling() {
    let deploy = parse_deploy_command_plan(&args(&[
        "--name",
        "triage",
        "--source",
        ".",
        "--wait",
        "--timeout",
        "0",
    ]))
    .expect("deploy plan");
    assert_eq!(deploy.timeout_seconds, 0);

    let test =
        parse_test_function_command_plan(&args(&["--id", "fn_123", "--wait", "--timeout", "0"]))
            .expect("test plan");
    assert_eq!(test.timeout_seconds, 0);

    assert!(!has_wait_timeout_elapsed(Duration::from_secs(3600), 0));
    assert!(!has_wait_timeout_elapsed(Duration::from_millis(999), 1));
    assert!(has_wait_timeout_elapsed(Duration::from_secs(1), 1));
}

#[test]
fn rejects_ambiguous_deploy_file_and_source_modes() {
    let missing = parse_deploy_command_plan(&args(&["--name", "triage"]))
        .expect_err("missing mode should fail");
    assert!(missing.to_string().contains("exactly one of --file"));

    let both = parse_deploy_command_plan(&args(&[
        "--name",
        "triage",
        "--file",
        "bundle.js",
        "--source",
        ".",
    ]))
    .expect_err("two modes should fail");
    assert!(both.to_string().contains("exactly one of --file"));
}

#[test]
fn validates_set_secret_source_shape_before_reading_values() {
    let missing = parse_set_secret_command_plan(&args(&["--id", "fn_123", "--key", "API_TOKEN"]))
        .expect_err("missing source should fail");
    assert!(missing.to_string().contains("Pass exactly one"));

    let ambiguous = parse_set_secret_command_plan(&args(&[
        "--id",
        "fn_123",
        "--key",
        "API_TOKEN",
        "--value",
        "direct",
        "--stdin",
    ]))
    .expect_err("ambiguous source should fail");
    assert!(ambiguous.to_string().contains("Pass exactly one"));

    let bad_key = parse_set_secret_command_plan(&args(&[
        "--id",
        "fn_123",
        "--key",
        "model-api-key",
        "--value-file",
        "secret.txt",
    ]))
    .expect_err("bad key should fail");
    assert!(bad_key.to_string().contains("uppercase letters"));
}

#[test]
fn resolves_set_secret_sources_without_trimming_file_values() {
    let mut env = BTreeMap::new();
    env.insert("MODEL_API_KEY".to_string(), "token-env".to_string());

    let env_value = resolve_single_secret_value(
        &SingleSecretValueSourceInput {
            key: "MODEL_API_KEY".to_string(),
            source: SingleSecretValueSource::ValueFromEnv("MODEL_API_KEY".to_string()),
            env: env.clone(),
        },
        |_| unreachable!("no file read"),
        || unreachable!("no stdin read"),
    )
    .expect("env value");
    assert_eq!(env_value, "token-env");

    let file_value = resolve_single_secret_value(
        &SingleSecretValueSourceInput {
            key: "PRIVATE_KEY".to_string(),
            source: SingleSecretValueSource::ValueFile("private.pem".to_string()),
            env,
        },
        |path| {
            assert_eq!(path, "private.pem");
            Ok("pem\nwith trailing newline\n".to_string())
        },
        || unreachable!("no stdin read"),
    )
    .expect("file value");
    assert_eq!(file_value, "pem\nwith trailing newline\n");
}

#[test]
fn maps_logs_query_and_output_flags() {
    let plan = parse_logs_command_plan(&args(&[
        "--id", "fn_123", "--limit", "25", "--cursor", "cur_abc", "--jsonl",
    ]))
    .expect("logs plan");

    assert_eq!(
        plan,
        FunctionLogsPlan {
            request: functions_commands::ApiRequest {
                method: "GET".to_string(),
                path: "/functions/fn_123/logs".to_string(),
                query: BTreeMap::from([
                    ("cursor".to_string(), "cur_abc".to_string()),
                    ("limit".to_string(), "25".to_string()),
                ]),
                body: None,
            },
            follow: false,
            jsonl: true,
            poll_interval_seconds: DEFAULT_LOG_POLL_INTERVAL_SECONDS,
        }
    );
}

#[test]
fn maps_logs_follow_flags_and_rejects_cursor_follow_combo() {
    let follow = parse_logs_command_plan(&args(&[
        "--id",
        "fn_123",
        "--follow",
        "--poll-interval",
        "5",
    ]))
    .expect("follow logs plan");
    assert!(follow.follow);
    assert!(!follow.jsonl);
    assert_eq!(follow.poll_interval_seconds, 5);
    assert_eq!(
        follow.request.query.get("limit").map(String::as_str),
        Some("50")
    );
    assert!(!follow.request.query.contains_key("cursor"));

    let error = parse_logs_command_plan(&args(&[
        "--id", "fn_123", "--follow", "--cursor", "cur_abc",
    ]))
    .expect_err("follow plus cursor should fail");
    assert!(error.to_string().contains("--cursor cannot be combined"));
}

#[test]
fn maps_logs_short_follow_alias() {
    let follow = parse_logs_command_plan(&args(&["--id", "fn_123", "-f", "--poll-interval", "5"]))
        .expect("short follow logs plan");
    assert!(follow.follow);
    assert!(!follow.jsonl);
    assert_eq!(follow.poll_interval_seconds, 5);
    assert_eq!(
        follow.request.query.get("limit").map(String::as_str),
        Some("50")
    );
    assert!(!follow.request.query.contains_key("cursor"));

    let error = parse_logs_command_plan(&args(&["--id", "fn_123", "-f", "--cursor", "cur_abc"]))
        .expect_err("short follow plus cursor should fail");
    assert!(error.to_string().contains("--cursor cannot be combined"));
}

#[test]
fn logs_help_documents_command_flags() {
    let help = functions_logs_help_text();
    for expected in [
        "functions logs --id <fn-id>",
        "--api-key <value>",
        "--cursor <value>",
        "--jsonl",
        "--poll-interval <value>",
        "-f, --follow",
    ] {
        assert!(help.contains(expected), "{expected}");
    }
    assert!(!help.contains("--api-base-url"));
}

#[test]
fn init_help_documents_command_flags() {
    let help = functions_init_help_text();
    for expected in [
        "functions init <name>",
        "--out-dir <dir>",
        "--template <id>",
    ] {
        assert!(help.contains(expected), "{expected}");
    }
}

#[test]
fn deploy_help_documents_command_flags() {
    let help = functions_deploy_help_text();
    for expected in [
        "functions deploy --name <name>",
        "--api-key <value>",
        "--file <bundle>",
        "--name <name>",
        "--poll-interval <value>",
        "--secret <KEY=VALUE>",
        "--secret-from-env <KEY>",
        "--secret-from-env-file <FILE:KEY>",
        "--secret-from-file <KEY=PATH>",
        "--secret-from-stdin <KEY>",
        "--source <dir>",
        "--source-map-file <path>",
        "--time",
        "--timeout <value>",
        "--wait",
    ] {
        assert!(help.contains(expected), "{expected}");
    }
}

#[test]
fn redeploy_help_documents_command_flags() {
    let help = functions_redeploy_help_text();
    for expected in [
        "functions redeploy --id <fn-id>",
        "--api-key <value>",
        "--file <bundle>",
        "--id <fn-id>",
        "--poll-interval <value>",
        "--secret <KEY=VALUE>",
        "--secret-from-env <KEY>",
        "--secret-from-env-file <FILE:KEY>",
        "--secret-from-file <KEY=PATH>",
        "--secret-from-stdin <KEY>",
        "--source-map-file <path>",
        "--time",
        "--timeout <value>",
        "--wait",
    ] {
        assert!(help.contains(expected), "{expected}");
    }
}

#[test]
fn function_shortcut_help_documents_node_visible_flags() {
    for (help, expected) in [
        (
            functions_set_secret_help_text(),
            vec![
                "functions set-secret --id <fn-id>",
                "--api-key <value>",
                "--id <fn-id>",
                "--key <KEY>",
                "--redeploy",
                "--stdin",
                "--time",
                "--value <value>",
                "--value-file <path>",
                "--value-from-env <KEY>",
                "--value-from-env-file <FILE[:KEY]>",
            ],
        ),
        (
            functions_route_set_help_text(),
            vec![
                "functions route-set --id <fn-id>",
                "--api-key <value>",
                "--domain <id>",
                "--fallback",
                "--id <fn-id>",
                "--takeover",
                "--time",
            ],
        ),
        (
            functions_route_unset_help_text(),
            vec![
                "functions route-unset --id <fn-id>",
                "--api-key <value>",
                "--id <fn-id>",
                "--time",
            ],
        ),
        (
            functions_route_get_help_text(),
            vec![
                "functions route-get --id <fn-id>",
                "--api-key <value>",
                "--id <fn-id>",
                "--time",
            ],
        ),
        (
            functions_routing_topology_help_text(),
            vec!["functions routing-topology", "--api-key <value>", "--time"],
        ),
        (
            functions_test_help_text(),
            vec![
                "functions test --id <fn-id>",
                "--api-key <value>",
                "--id <fn-id>",
                "--local-part <value>",
                "--poll-interval <value>",
                "--show-sends",
                "--time",
                "--timeout <value>",
                "--wait",
            ],
        ),
        (
            functions_templates_help_text(),
            vec!["functions templates", "--json"],
        ),
    ] {
        for expected in expected {
            assert!(help.contains(expected), "{expected}");
        }
    }
}

#[test]
fn builds_logs_command_plan_with_short_follow_alias() {
    let logs = build_function_command_plan_with_io(
        "functions logs",
        &args(&["--id", "fn_123", "-f"]),
        BTreeMap::new(),
        no_file_reader,
        no_stdin_reader,
        no_source_reader,
    )
    .expect("logs plan");
    let FunctionCommandPlan::Api(logs) = logs else {
        panic!("expected api plan");
    };
    assert_eq!(logs.target_operation_id, "functions:list-function-logs");
    assert_eq!(
        logs.behavior,
        FunctionApiBehavior::Logs {
            follow: true,
            jsonl: false,
            poll_interval_seconds: DEFAULT_LOG_POLL_INTERVAL_SECONDS,
        }
    );
}

#[test]
fn builds_route_command_requests() {
    let domain = build_route_set_request(
        "fn_123",
        RouteTargetInput::Domain("domain_123".to_string()),
        true,
    );
    assert_eq!(domain.method, "PUT");
    assert_eq!(domain.path, "/functions/fn_123/route");
    assert_eq!(
        domain.body,
        Some(json!({
            "target": { "kind": "domain", "domainId": "domain_123" },
            "takeover": true
        }))
    );

    let fallback = parse_route_set_command_plan(&args(&["--id", "fn_123", "--fallback"]))
        .expect("fallback route plan");
    assert_eq!(
        fallback.request.body,
        Some(json!({ "target": { "kind": "fallback" } }))
    );

    assert_eq!(build_route_unset_request("fn_123").method, "DELETE");
    assert_eq!(
        build_route_unset_request("fn_123").path,
        "/functions/fn_123/route"
    );
    assert_eq!(build_route_get_request("fn_123").method, "GET");
    assert_eq!(
        build_route_get_request("fn_123").path,
        "/functions/fn_123/routing"
    );
    assert_eq!(build_routing_topology_request().method, "GET");
    assert_eq!(
        build_routing_topology_request().path,
        "/functions/routing-topology"
    );
}

#[test]
fn formats_route_status_hint_after_deploy() {
    assert_eq!(
        format_route_status_hint("fn_123", &json!(null)),
        "Deployed but no route is bound. Inbound mail will not reach this function until you bind one: primitive functions route-set --id fn_123 --domain <domain-id>  (or --fallback)"
    );
    assert_eq!(
        format_route_status_hint("fn_123", &json!({ "endpoint_id": "ep_123" })),
        "Route bound. Function will receive inbound mail."
    );
}

#[test]
fn rejects_route_set_without_exactly_one_target() {
    let missing = parse_route_set_command_plan(&args(&["--id", "fn_123"]))
        .expect_err("missing route target should fail");
    assert!(missing.to_string().contains("exactly one of --domain"));

    let both = parse_route_set_command_plan(&args(&[
        "--id",
        "fn_123",
        "--domain",
        "domain_123",
        "--fallback",
    ]))
    .expect_err("two route targets should fail");
    assert!(both.to_string().contains("exactly one of --domain"));
}

#[test]
fn maps_test_function_wait_and_show_sends_flags() {
    let plan = parse_test_function_command_plan(&args(&[
        "--id",
        "fn_123",
        "--local-part",
        "summarize",
        "--show-sends",
    ]))
    .expect("test function plan");

    assert_eq!(
        plan,
        TestFunctionPlan {
            trigger: functions_commands::ApiRequest {
                method: "POST".to_string(),
                path: "/functions/fn_123/test".to_string(),
                query: BTreeMap::new(),
                body: Some(json!({ "local_part": "summarize" })),
            },
            should_wait: true,
            should_show_sends: true,
            timeout_seconds: DEFAULT_TEST_WAIT_TIMEOUT_SECONDS,
            poll_interval_seconds: DEFAULT_TEST_POLL_INTERVAL_SECONDS,
        }
    );

    let fire_and_forget =
        parse_test_function_command_plan(&args(&["--id", "fn_123"])).expect("fire and forget plan");
    assert!(!fire_and_forget.should_wait);
    assert!(!fire_and_forget.should_show_sends);
    assert_eq!(fire_and_forget.trigger.body, None);
}

#[test]
fn builds_test_trace_and_set_secret_requests() {
    let trace = build_test_run_trace_request("fn_123", "run_123");
    assert_eq!(trace.method, "GET");
    assert_eq!(trace.path, "/functions/fn_123/test-runs/run_123/trace");

    let set_secret = build_set_secret_request("fn_123", "API_TOKEN", "abc123");
    assert_eq!(set_secret.method, "PUT");
    assert_eq!(set_secret.path, "/functions/fn_123/secrets/API_TOKEN");
    assert_eq!(set_secret.body, Some(json!({ "value": "abc123" })));

    assert_eq!(build_list_domains_request().path, "/domains");
    assert_eq!(build_list_endpoints_request().path, "/endpoints");
}

#[test]
fn formats_set_secret_runtime_output_and_warnings_like_node_cli() {
    let secret = json!({
        "function_id": "fn_123",
        "key": "API_TOKEN",
        "updated_at": "2026-01-01T00:00:00Z"
    });
    let redeploy = json!({
        "id": "fn_123",
        "deploy_status": "pending"
    });

    assert_eq!(
        build_set_secret_result(&secret, Some(&redeploy)),
        json!({
            "secret": secret,
            "redeploy": redeploy
        })
    );
    assert_eq!(
        build_set_secret_result(&secret, None),
        json!({
            "secret": secret
        })
    );
    assert_eq!(
        format_set_secret_saved_warning("fn_123", "API_TOKEN"),
        "Secret API_TOKEN saved. Not live until redeploy. Re-run with --redeploy, or run `primitive functions redeploy --id fn_123 --file <bundle.js>`."
    );
    assert_eq!(
        format_set_secret_redeploy_stage_warning(
            "fn_123",
            SetSecretRedeployStage::GetFunction
        ),
        "Secret was written, but reading current function code for redeploy failed; the secret is NOT yet live. Re-run with --redeploy, or call `primitive functions redeploy --id fn_123 --file <bundle>` once you have the bundle."
    );
    assert_eq!(
        format_set_secret_redeploy_stage_warning("fn_123", SetSecretRedeployStage::Redeploy),
        "Secret was written, but the redeploy step failed; the secret is NOT yet live. Inspect the function's deploy_error and re-run `primitive functions redeploy --id fn_123 --file <bundle>` once the cause is fixed."
    );
}

#[test]
fn formats_function_test_trace_timeout_and_no_route_messages_like_node_cli() {
    let invocation = json!({
        "watch_url": "https://app.example.test/watch",
        "trace_url": "https://app.example.test/trace"
    });
    let final_trace = json!({
        "inbound_email": {
            "id": "email_123",
            "webhook_status": "pending"
        },
        "deliveries": [{ "id": "delivery_123" }],
        "logs": [{ "id": "log_123" }, { "id": "log_456" }],
        "replies": []
    });

    assert_eq!(
        format_function_test_timeout_message(60, &invocation, Some(&final_trace)),
        "Timed out after 60s. Trace summary: inbound_landed=true deliveries=1 logs=2 replies=0 webhook_status=pending. Browse https://app.example.test/watch for the live view, or inspect https://app.example.test/trace."
    );
    assert_eq!(
        format_function_test_timeout_message(3, &invocation, None),
        "Timed out after 3s. Trace summary: inbound_landed=false deliveries=0 logs=0 replies=0 webhook_status=n/a. Browse https://app.example.test/watch for the live view, or inspect https://app.example.test/trace."
    );
    assert_eq!(
        format_function_test_no_route_message("fn_123"),
        "Inbound email arrived but no route matched. Bind one with: primitive functions route-set --id fn_123 --domain <domain-id> (or --fallback), then retry."
    );
}

#[test]
fn detects_function_test_no_route_after_grace_window() {
    let trace = json!({
        "state": "waiting",
        "inbound_email": { "id": "email_123" },
        "deliveries": []
    });
    assert!(!should_report_test_trace_no_route(
        &trace,
        Duration::from_secs(TEST_TRACE_NO_DELIVERIES_GRACE_SECONDS)
    ));
    assert!(should_report_test_trace_no_route(
        &trace,
        Duration::from_secs(TEST_TRACE_NO_DELIVERIES_GRACE_SECONDS + 1)
    ));

    let delivery_pending = json!({
        "state": "waiting",
        "inbound_email": { "id": "email_123" },
        "deliveries": [{ "id": "delivery_123" }]
    });
    assert!(!should_report_test_trace_no_route(
        &delivery_pending,
        Duration::from_secs(TEST_TRACE_NO_DELIVERIES_GRACE_SECONDS + 1)
    ));
}

#[test]
fn maps_function_test_terminal_failure_states_to_nonzero_exit() {
    assert!(is_terminal_function_test_trace_state(
        &json!({ "state": "completed" })
    ));
    assert_eq!(
        function_test_failure_exit_code(&json!({ "state": "completed" })),
        None
    );
    assert_eq!(
        function_test_failure_exit_code(&json!({ "state": "failed" })),
        Some(1)
    );
    assert_eq!(
        function_test_failure_exit_code(&json!({ "state": "send_failed" })),
        Some(1)
    );
    assert!(!is_terminal_function_test_trace_state(
        &json!({ "state": "waiting" })
    ));
}

#[test]
fn formats_function_endpoint_noise_warning_for_competing_routes() {
    let endpoints = vec![
        RawEndpointRow {
            id: Some("ep_current".to_string()),
            enabled: Some(true),
            deactivated_at: None,
            domain_id: Some("domain_123".to_string()),
            function_id: Some("fn_123".to_string()),
            kind: Some("function".to_string()),
        },
        RawEndpointRow {
            id: Some("ep_other".to_string()),
            enabled: Some(true),
            deactivated_at: None,
            domain_id: Some("domain_123".to_string()),
            function_id: Some("fn_other".to_string()),
            kind: Some("function".to_string()),
        },
        RawEndpointRow {
            id: Some("ep_fallback".to_string()),
            enabled: Some(true),
            deactivated_at: None,
            domain_id: None,
            function_id: Some("fn_fallback".to_string()),
            kind: Some("function".to_string()),
        },
    ];

    let matches = find_matching_function_endpoints(&endpoints, "fn_123", Some("domain_123"));
    assert_eq!(matches.len(), 2);
    assert_eq!(
        format_function_endpoint_noise_warning(
            "summarize@example.com",
            "example.com",
            &matches
        )
        .expect("warning"),
        "Warning: 2 function endpoints may receive mail for summarize@example.com:\n- endpoint ep_current -> function fn_123, scoped to example.com (this function)\n- endpoint ep_other -> function fn_other, scoped to example.com"
    );
}
