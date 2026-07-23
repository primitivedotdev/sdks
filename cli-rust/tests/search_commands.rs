use primitive_rust::search_commands::{
    build_search_plan, build_search_plan_from_cli_args, search_help_text, SearchBackend,
    SearchCommandPlan,
};
use serde_json::json;
use std::collections::BTreeMap;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

fn query(values: &[(&str, &str)]) -> BTreeMap<String, String> {
    values
        .iter()
        .map(|(name, value)| ((*name).to_string(), (*value).to_string()))
        .collect()
}

fn assert_semantic_defaults(plan: &SearchCommandPlan) {
    assert_eq!(plan.backend, SearchBackend::Semantic);
    assert_eq!(plan.request.operation_id, "search:semantic-search");
    assert_eq!(plan.request.method, "POST");
    assert_eq!(plan.request.path, "/semantic-search");
    assert!(plan.request.query.is_empty());
    assert_eq!(
        plan.request.body,
        Some(json!({
            "query": "renewal",
            "mode": "hybrid",
            "limit": 10
        }))
    );
}

#[test]
fn search_positional_query_maps_to_lexical_emails_search() {
    let plan = build_search_plan("search", &args(&["invoice"])).expect("search plan");

    assert_eq!(plan.backend, SearchBackend::Lexical);
    assert_eq!(plan.request.operation_id, "emails:search-emails");
    assert_eq!(plan.request.method, "GET");
    assert_eq!(plan.request.path, "/emails/search");
    assert_eq!(plan.request.body, None);
    assert_eq!(
        plan.request.query,
        query(&[("limit", "10"), ("q", "invoice")])
    );
}

#[test]
fn lexical_search_builds_query_flags_and_domain_dsl() {
    let plan = build_search_plan(
        "search",
        &args(&[
            "renewal",
            "--from",
            "alice@example.com",
            "--to=billing@example.com",
            "--subject",
            "invoice",
            "--body",
            "payment due",
            "--domain",
            "acme corp",
            "--domain-id",
            "dom_123",
            "--has-attachment",
            "true",
            "--status",
            "completed",
            "--sort",
            "received_at_asc",
            "--snippet",
            "false",
            "--include-facets",
            "false",
            "--date-from",
            "2026-01-01T00:00:00Z",
            "--date-to",
            "2026-01-31T00:00:00Z",
            "--limit",
            "25",
            "--cursor",
            "cursor_1",
        ]),
    )
    .expect("lexical search plan");

    assert_eq!(plan.backend, SearchBackend::Lexical);
    assert_eq!(
        plan.request.query,
        query(&[
            ("body", "payment due"),
            ("cursor", "cursor_1"),
            ("date_from", "2026-01-01T00:00:00Z"),
            ("date_to", "2026-01-31T00:00:00Z"),
            ("domain_id", "dom_123"),
            ("from", "alice@example.com"),
            ("has_attachment", "true"),
            ("include_facets", "false"),
            ("limit", "25"),
            ("q", "renewal domain:\"acme corp\""),
            ("snippet", "false"),
            ("sort", "received_at_asc"),
            ("status", "completed"),
            ("subject", "invoice"),
            ("to", "billing@example.com"),
        ])
    );
}

#[test]
fn search_mode_dispatches_to_semantic_body() {
    let plan = build_search_plan(
        "search",
        &args(&[
            "kickoff",
            "--mode",
            "keyword",
            "--corpus",
            "inbound",
            "--corpus",
            "outbound",
            "--date-from",
            "2026-02-01T00:00:00Z",
            "--date-to",
            "2026-02-28T00:00:00Z",
            "--limit",
            "7",
            "--cursor",
            "cursor_2",
            "--json",
            "--time",
        ]),
    )
    .expect("semantic search plan");

    assert_eq!(plan.backend, SearchBackend::Semantic);
    assert_eq!(plan.request.operation_id, "search:semantic-search");
    assert_eq!(plan.request.method, "POST");
    assert_eq!(plan.request.path, "/semantic-search");
    assert!(plan.request.query.is_empty());
    assert_eq!(
        plan.request.body,
        Some(json!({
            "query": "kickoff",
            "mode": "keyword",
            "corpus": ["inbound", "outbound"],
            "date_from": "2026-02-01T00:00:00Z",
            "date_to": "2026-02-28T00:00:00Z",
            "limit": 7,
            "cursor": "cursor_2"
        }))
    );
}

#[test]
fn root_semantic_and_compat_commands_default_to_hybrid() {
    let root =
        build_search_plan("semantic-search", &args(&["renewal"])).expect("root semantic plan");
    let compat = build_search_plan("search:semantic-search", &args(&["renewal"]))
        .expect("compat semantic plan");
    let split_compat =
        build_search_plan_from_cli_args(&args(&["search", "semantic-search", "renewal"]))
            .expect("space-separated compat plan");

    assert_semantic_defaults(&root);
    assert_semantic_defaults(&compat);
    assert_semantic_defaults(&split_compat);
}

#[test]
fn search_help_documents_node_visible_flags() {
    for expected in [
        "--api-key <value>",
        "--body <value>",
        "--corpus inbound|outbound",
        "--cursor <value>",
        "--date-from <value>",
        "--date-to <value>",
        "--domain <value>",
        "--domain-id <value>",
        "--envelope",
        "--from <value>",
        "--has-attachment true|false",
        "--include-facets true|false",
        "--json",
        "--limit <number>",
        "--mode hybrid|semantic|keyword",
        "--snippet true|false",
        "--sort relevance|received_at_desc|received_at_asc",
        "--status pending|accepted|completed|rejected",
        "--subject <value>",
        "--time",
        "--to <value>",
    ] {
        assert!(search_help_text("search").contains(expected), "{expected}");
    }

    for expected in [
        "--api-key <value>",
        "--corpus inbound|outbound",
        "--cursor <value>",
        "--date-from <value>",
        "--date-to <value>",
        "--json",
        "--limit <number>",
        "--mode hybrid|semantic|keyword",
        "--time",
    ] {
        assert!(
            search_help_text("semantic-search").contains(expected),
            "{expected}"
        );
    }
}

#[test]
fn rejects_invalid_search_arguments() {
    let cases = [
        (
            "missing query",
            "search",
            vec!["--limit", "10"],
            "search requires a query",
        ),
        (
            "extra positional",
            "search",
            vec!["invoice", "extra"],
            "Unexpected argument: extra",
        ),
        (
            "invalid mode",
            "search",
            vec!["invoice", "--mode", "vector"],
            "Expected --mode to be one of: hybrid, semantic, keyword",
        ),
        (
            "lexical flag with mode",
            "search",
            vec!["invoice", "--mode", "semantic", "--from", "acme.com"],
            "only applies to the lexical backend",
        ),
        (
            "corpus without mode",
            "search",
            vec!["invoice", "--corpus", "inbound"],
            "--corpus only applies to semantic mode",
        ),
        (
            "envelope with mode",
            "search",
            vec!["invoice", "--mode", "hybrid", "--envelope"],
            "--envelope only applies to lexical mode",
        ),
        (
            "invalid limit",
            "semantic-search",
            vec!["invoice", "--limit", "101"],
            "Expected --limit to be less than or equal to 100",
        ),
        (
            "semantic rejects lexical flags",
            "semantic-search",
            vec!["invoice", "--from", "acme.com"],
            "Nonexistent flag: --from",
        ),
        (
            "invalid corpus",
            "semantic-search",
            vec!["invoice", "--corpus", "archive"],
            "Expected --corpus to be one of: inbound, outbound",
        ),
    ];

    for (name, command, raw_args, expected) in cases {
        let raw_args = args(&raw_args);
        let error = match build_search_plan(command, &raw_args) {
            Ok(_) => panic!("{name} should fail"),
            Err(error) => error,
        };
        assert!(
            error.to_string().contains(expected),
            "{name} error should contain {expected:?}, got {error}"
        );
    }
}
