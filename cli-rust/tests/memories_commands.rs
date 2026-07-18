use anyhow::anyhow;
use primitive_rust::manifest;
use primitive_rust::memories_commands::{
    auth_flags, build_delete_memory_query, build_get_memory_query,
    build_memories_delete_request_from_args, build_memories_get_request_from_args,
    build_memories_search_request_from_args, build_memories_set_request_from_args,
    build_memories_set_request_from_args_with_reader, build_memory_request,
    build_search_memories_query, build_set_memory_body, execute_command, format_memory_output,
    has_time_flag, is_memories_friendly_command, memories_help_text, memory_command_aliases,
    memory_command_target, memory_output_payload, memory_scope_for_body, memory_scope_for_query,
    parse_memory_json, resolve_memory_value_source_with_reader, DeleteMemoryQueryInput,
    GetMemoryQueryInput, MemoryValueSourceInput, ScopeFlags, SearchMemoriesQueryInput,
    SetMemoryRequestInput, DEFAULT_MEMORY_SEARCH_LIMIT, MAX_MEMORY_SEARCH_LIMIT,
};
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};

const FUNCTION_ID: &str = "11111111-1111-4111-8111-111111111111";

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

fn query(values: &[(&str, &str)]) -> BTreeMap<String, String> {
    values
        .iter()
        .map(|(name, value)| ((*name).to_string(), (*value).to_string()))
        .collect()
}

fn help_flag_tokens(help: &str) -> BTreeSet<String> {
    let mut tokens = BTreeSet::new();
    for (index, _) in help.match_indices("--") {
        let token: String = help[index..]
            .chars()
            .take_while(|char| char.is_ascii_alphanumeric() || *char == '-')
            .collect();
        if token.len() > 2 {
            tokens.insert(token);
        }
    }
    tokens
}

fn expected_flags(values: &[&str]) -> BTreeSet<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

fn function_scope() -> ScopeFlags {
    ScopeFlags {
        function: Some(FUNCTION_ID.to_string()),
        org: false,
    }
}

#[test]
fn memory_aliases_point_at_generated_operations() {
    let expected = [
        ("memories:set", "memories:set-memory", "PUT", "/memories"),
        ("memories:get", "memories:get-memory", "GET", "/memories"),
        (
            "memories:delete",
            "memories:delete-memory",
            "DELETE",
            "/memories",
        ),
        (
            "memories:search",
            "memories:search-memories",
            "GET",
            "/memories/search",
        ),
    ];

    assert_eq!(memory_command_aliases().len(), expected.len());
    for (alias, target, method, path) in expected {
        assert!(is_memories_friendly_command(alias));
        assert!(is_memories_friendly_command(&alias.replace(':', " ")));
        assert_eq!(memory_command_target(alias), Some(target));
        assert_eq!(
            memory_command_target(&alias.replace(':', " ")),
            Some(target)
        );

        let operation = manifest::lookup_operation(target)
            .unwrap_or_else(|| panic!("missing generated operation {target}"));
        assert_eq!(operation.method, method);
        assert_eq!(operation.path, path);
    }

    assert!(!is_memories_friendly_command("memories:set-memory"));
    assert_eq!(
        memory_command_target("memories:set-memory"),
        Some("memories:set-memory")
    );
}

#[test]
fn memories_help_requests_return_before_argument_validation() {
    execute_command("memories:set", &args(&["--help"])).expect("help request should succeed");
}

#[test]
fn memories_leaf_help_documents_command_specific_flags() {
    let cases = [
        (
            "memories:set",
            expected_flags(&[
                "--api-key",
                "--clear-ttl",
                "--expires-at",
                "--function",
                "--if-absent",
                "--if-version",
                "--org",
                "--time",
                "--ttl-seconds",
                "--value-file",
            ]),
        ),
        (
            "memories:get",
            expected_flags(&["--api-key", "--function", "--org", "--time"]),
        ),
        (
            "memories:delete",
            expected_flags(&["--api-key", "--function", "--if-version", "--org", "--time"]),
        ),
        (
            "memories:search",
            expected_flags(&[
                "--api-key",
                "--cursor",
                "--function",
                "--limit",
                "--metadata-only",
                "--org",
                "--time",
                "--updated-after",
                "--updated-before",
            ]),
        ),
    ];

    for (command, expected) in cases {
        let actual = help_flag_tokens(&memories_help_text(Some(command)));
        assert_eq!(
            actual, expected,
            "{command} help should expose only command-specific visible flags"
        );
        assert!(
            !actual.contains("--api-base-url"),
            "{command} help should not expose the hidden API base URL flag"
        );
    }
}

#[test]
fn memory_runtime_flags_extract_auth_and_time() {
    let flags = auth_flags(&args(&[
        "--api-key",
        "key_123",
        "--api-base-url=https://api.example.test/v1",
        "--metadata-only",
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
            ("api-key".to_string(), "key_123".to_string()),
        ])
    );
    assert!(has_time_flag(&args(&["--time=true"])));
    assert!(!has_time_flag(&args(&["--time", "--no-time"])));
    assert!(auth_flags(&args(&["--api-key"]))
        .expect_err("missing value should fail")
        .to_string()
        .contains("Missing value for --api-key"));
}

#[test]
fn memory_json_values_and_value_sources_match_node_behavior() {
    assert_eq!(
        parse_memory_json("{\"step\":2}", "value").expect("object json"),
        json!({ "step": 2 })
    );
    assert_eq!(
        parse_memory_json("\"hello\"", "value").expect("string json"),
        json!("hello")
    );

    let unquoted = parse_memory_json("hello", "value").expect_err("unquoted should fail");
    assert!(unquoted.to_string().contains("valid JSON"));
    assert!(unquoted.to_string().contains("\"hello\""));

    let non_finite = parse_memory_json("1e999", "value").expect_err("overflow should fail");
    assert!(non_finite.to_string().contains("Numbers must be finite"));

    assert_eq!(
        resolve_memory_value_source_with_reader(
            &MemoryValueSourceInput {
                value: Some("{\"ok\":true}".to_string()),
                value_file: None,
            },
            |_| Err(anyhow!("unexpected file read")),
        )
        .expect("inline value"),
        primitive_rust::memories_commands::MemoryValueSource {
            source: "{\"ok\":true}".to_string(),
            label: "value".to_string(),
        }
    );

    assert_eq!(
        resolve_memory_value_source_with_reader(
            &MemoryValueSourceInput {
                value: None,
                value_file: Some("state.json".to_string()),
            },
            |path| {
                assert_eq!(path, "state.json");
                Ok("{\"file\":true}".to_string())
            },
        )
        .expect("file value"),
        primitive_rust::memories_commands::MemoryValueSource {
            source: "{\"file\":true}".to_string(),
            label: "--value-file state.json".to_string(),
        }
    );

    assert!(resolve_memory_value_source_with_reader(
        &MemoryValueSourceInput {
            value: Some("{}".to_string()),
            value_file: Some("state.json".to_string()),
        },
        |_| Err(anyhow!("unexpected file read")),
    )
    .expect_err("both sources should fail")
    .to_string()
    .contains("either an argument or --value-file"));

    assert!(
        resolve_memory_value_source_with_reader(&MemoryValueSourceInput::default(), |_| Err(
            anyhow!("unexpected file read")
        ),)
        .expect_err("missing source should fail")
        .to_string()
        .contains("Provide a JSON value")
    );
}

#[test]
fn memory_scope_and_body_builders_create_api_shapes() {
    assert_eq!(
        memory_scope_for_body(&function_scope()).expect("function body scope"),
        Some(json!({ "type": "function", "id": FUNCTION_ID }))
    );
    assert_eq!(
        memory_scope_for_body(&ScopeFlags {
            function: None,
            org: true,
        })
        .expect("org body scope"),
        Some(json!({ "type": "org" }))
    );
    assert_eq!(
        memory_scope_for_query(&function_scope()).expect("function query scope"),
        query(&[("scope_id", FUNCTION_ID), ("scope_type", "function")])
    );
    assert_eq!(
        memory_scope_for_query(&ScopeFlags {
            function: None,
            org: true,
        })
        .expect("org query scope"),
        query(&[("scope_type", "org")])
    );

    assert!(memory_scope_for_body(&ScopeFlags {
        function: Some(String::new()),
        org: false,
    })
    .expect_err("empty function flag should fail")
    .to_string()
    .contains("--function must be a non-empty string"));
    assert!(memory_scope_for_query(&ScopeFlags {
        function: Some(FUNCTION_ID.to_string()),
        org: true,
    })
    .expect_err("scope conflict should fail")
    .to_string()
    .contains("Use either --function or --org"));

    let body = build_set_memory_body(&SetMemoryRequestInput {
        key: "thread:state".to_string(),
        value: json!({ "step": 2 }),
        scope: function_scope(),
        ttl_seconds: Some(60),
        expires_at: None,
        clear_ttl: false,
        if_absent: false,
        if_version: Some("7".to_string()),
    })
    .expect("set body");
    assert_eq!(
        body,
        json!({
            "key": "thread:state",
            "value": { "step": 2 },
            "scope": { "type": "function", "id": FUNCTION_ID },
            "ttl_seconds": 60,
            "if_version": "7"
        })
    );

    assert_eq!(
        build_get_memory_query(&GetMemoryQueryInput {
            key: "thread:state".to_string(),
            scope: ScopeFlags {
                function: None,
                org: true,
            },
        })
        .expect("get query"),
        query(&[("key", "thread:state"), ("scope_type", "org")])
    );
    assert_eq!(
        build_delete_memory_query(&DeleteMemoryQueryInput {
            key: "thread:state".to_string(),
            scope: function_scope(),
            if_version: Some("3".to_string()),
        })
        .expect("delete query"),
        query(&[
            ("if_version", "3"),
            ("key", "thread:state"),
            ("scope_id", FUNCTION_ID),
            ("scope_type", "function"),
        ])
    );
    assert_eq!(
        build_search_memories_query(&SearchMemoriesQueryInput {
            prefix: Some("thread:".to_string()),
            scope: function_scope(),
            cursor: Some("thread:1".to_string()),
            limit: Some(25),
            metadata_only: true,
            updated_after: None,
            updated_before: None,
        })
        .expect("search query"),
        query(&[
            ("cursor", "thread:1"),
            ("include_value", "false"),
            ("limit", "25"),
            ("prefix", "thread:"),
            ("scope_id", FUNCTION_ID),
            ("scope_type", "function"),
        ])
    );
}

#[test]
fn memory_request_builders_parse_user_facing_command_shapes() {
    let set = build_memories_set_request_from_args(&args(&[
        "state",
        "{\"step\":2}",
        "--function",
        FUNCTION_ID,
        "--if-version",
        "3",
    ]))
    .expect("set request");
    assert_eq!(set.target_operation_id, "memories:set-memory");
    assert_eq!(set.method, "PUT");
    assert_eq!(set.path, "/memories");
    assert!(set.query.is_empty());
    assert_eq!(
        set.body,
        Some(json!({
            "key": "state",
            "value": { "step": 2 },
            "scope": { "type": "function", "id": FUNCTION_ID },
            "if_version": "3"
        }))
    );

    let file_set = build_memories_set_request_from_args_with_reader(
        &args(&[
            "state",
            "--value-file",
            "state.json",
            "--org",
            "--clear-ttl",
            "--if-absent",
        ]),
        |path| {
            assert_eq!(path, "state.json");
            Ok("{\"file\":true}".to_string())
        },
    )
    .expect("file set request");
    assert_eq!(
        file_set.body,
        Some(json!({
            "key": "state",
            "value": { "file": true },
            "scope": { "type": "org" },
            "clear_ttl": true,
            "if_absent": true
        }))
    );

    let get = build_memories_get_request_from_args(&args(&["state", "--function", FUNCTION_ID]))
        .expect("get request");
    assert_eq!(get.target_operation_id, "memories:get-memory");
    assert_eq!(get.method, "GET");
    assert_eq!(get.path, "/memories");
    assert_eq!(
        get.query,
        query(&[
            ("key", "state"),
            ("scope_id", FUNCTION_ID),
            ("scope_type", "function"),
        ])
    );

    let delete = build_memories_delete_request_from_args(&args(&[
        "state",
        "--function",
        FUNCTION_ID,
        "--if-version",
        "4",
    ]))
    .expect("delete request");
    assert_eq!(delete.target_operation_id, "memories:delete-memory");
    assert_eq!(delete.method, "DELETE");
    assert_eq!(
        delete.query,
        query(&[
            ("if_version", "4"),
            ("key", "state"),
            ("scope_id", FUNCTION_ID),
            ("scope_type", "function"),
        ])
    );

    let search = build_memories_search_request_from_args(&args(&[
        "thread:",
        "--function",
        FUNCTION_ID,
        "--metadata-only",
        "--limit",
        "25",
        "--cursor",
        "thread:1",
        "--updated-after",
        "2026-07-01T00:00:00Z",
        "--updated-before",
        "2026-07-31T00:00:00Z",
    ]))
    .expect("search request");
    assert_eq!(search.target_operation_id, "memories:search-memories");
    assert_eq!(search.method, "GET");
    assert_eq!(search.path, "/memories/search");
    assert_eq!(
        search.query,
        query(&[
            ("cursor", "thread:1"),
            ("include_value", "false"),
            ("limit", "25"),
            ("prefix", "thread:"),
            ("scope_id", FUNCTION_ID),
            ("scope_type", "function"),
            ("updated_after", "2026-07-01T00:00:00Z"),
            ("updated_before", "2026-07-31T00:00:00Z"),
        ])
    );

    let search_all =
        build_memories_search_request_from_args(&args(&["--org"])).expect("search-all request");
    assert_eq!(search_all.target_operation_id, "memories:search-memories");
    assert_eq!(
        search_all.query,
        query(&[
            ("limit", &DEFAULT_MEMORY_SEARCH_LIMIT.to_string()),
            ("scope_type", "org"),
        ])
    );

    assert_eq!(
        build_memory_request("memories set", &args(&["state", "true"]))
            .expect("space-separated command"),
        build_memory_request("memories:set", &args(&["state", "true"])).expect("colon command")
    );
}

#[test]
fn memory_request_builders_reject_invalid_user_shapes() {
    let cases = [
        (
            "missing set value",
            build_memories_set_request_from_args(&args(&["state"]))
                .expect_err("missing value should fail")
                .to_string(),
            "Provide a JSON value",
        ),
        (
            "extra set positional",
            build_memories_set_request_from_args(&args(&["state", "true", "extra"]))
                .expect_err("extra positional should fail")
                .to_string(),
            "Unexpected argument: extra",
        ),
        (
            "ttl conflict",
            build_memories_set_request_from_args(&args(&[
                "state",
                "true",
                "--ttl-seconds",
                "60",
                "--clear-ttl",
            ]))
            .expect_err("ttl conflict should fail")
            .to_string(),
            "Use only one of --ttl-seconds",
        ),
        (
            "if conflict",
            build_memories_set_request_from_args(&args(&[
                "state",
                "true",
                "--if-absent",
                "--if-version",
                "3",
            ]))
            .expect_err("if conflict should fail")
            .to_string(),
            "Use either --if-absent or --if-version",
        ),
        (
            "scope conflict",
            build_memories_get_request_from_args(&args(&[
                "state",
                "--function",
                FUNCTION_ID,
                "--org",
            ]))
            .expect_err("scope conflict should fail")
            .to_string(),
            "Use either --function or --org",
        ),
        (
            "empty if version",
            build_memories_delete_request_from_args(&args(&["state", "--if-version", ""]))
                .expect_err("empty if-version should fail")
                .to_string(),
            "--if-version must be a non-empty string",
        ),
        (
            "large search limit",
            build_memories_search_request_from_args(&args(&[
                "--limit",
                &(MAX_MEMORY_SEARCH_LIMIT + 1).to_string(),
            ]))
            .expect_err("large limit should fail")
            .to_string(),
            "--limit must be less than or equal to 100",
        ),
    ];

    for (name, error, expected) in cases {
        assert!(
            error.contains(expected),
            "{name} error should contain {expected:?}, got {error}"
        );
    }

    let both_sources = build_memories_set_request_from_args_with_reader(
        &args(&["state", "true", "--value-file", "state.json"]),
        |_| Err(anyhow!("unexpected file read")),
    )
    .expect_err("both value sources should fail");
    assert!(both_sources
        .to_string()
        .contains("either an argument or --value-file"));
}

#[test]
fn memory_output_extracts_data_like_node_friendly_commands() {
    let envelope = json!({
        "data": {
            "key": "state",
            "value": { "step": 2 }
        },
        "meta": {
            "cursor": "next"
        }
    });
    let data = json!({
        "key": "state",
        "value": { "step": 2 }
    });

    assert_eq!(memory_output_payload(&envelope), data);
    assert_eq!(
        format_memory_output(&envelope).expect("format output"),
        serde_json::to_string_pretty(&data).expect("pretty data")
    );
    assert_eq!(
        format_memory_output(&json!({ "meta": { "cursor": "next" } })).expect("format null output"),
        "null"
    );
}
