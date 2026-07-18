use primitive_rust::emails_commands::{
    auth_flags, build_email_command_plan, build_email_search_query,
    build_emails_get_request_from_args, build_emails_list_request_from_args,
    build_emails_search_request_from_args, build_latest_plan, build_wait_poll_plan,
    build_wait_poll_plan_from_args, build_watch_poll_plan, build_watch_poll_plan_from_args,
    collect_new_accepted_emails, cursor_from_accepted_rows, cursor_from_rows,
    decide_email_poll_page, dispatch, email_command_aliases, email_command_target,
    encode_received_at_search_cursor, execute_command, filters_from_flags, format_header,
    format_poll_row, format_received_at, format_row, format_wait_timeout_message, has_time_flag,
    is_emails_friendly_command, leaf_help as email_leaf_help, pick_id_width, quote_dsl_value,
    truncate, EmailCommandOutputMode, EmailCommandPlan, EmailPollFilterFlags, EmailPollFilters,
    EmailPollOutputMode, EmailSearchRow, EmailSummary, LatestOutputMode, LatestShortcutInput,
    WaitShortcutInput, WatchShortcutInput, ADDRESS_DISPLAY_WIDTH, DEFAULT_EMAIL_LIST_LIMIT,
    DEFAULT_EMAIL_POLL_INTERVAL_SECONDS, DEFAULT_EMAIL_POLL_PAGE_SIZE, DEFAULT_LATEST_LIMIT,
    DEFAULT_WAIT_TIMEOUT_SECONDS, ID_DISPLAY_WIDTH_FULL, ID_DISPLAY_WIDTH_SHORT,
    MAX_EMAIL_POLL_PAGE_SIZE, MAX_LATEST_LIMIT, RECEIVED_DISPLAY_WIDTH,
};
use primitive_rust::friendly;
use serde_json::json;
use std::collections::{BTreeMap, BTreeSet};
use std::process::Command;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

fn row(id: &str, received_at: &str, status: &str) -> EmailSearchRow {
    EmailSearchRow {
        id: id.to_string(),
        received_at: received_at.to_string(),
        status: status.to_string(),
        sender: Some("sender@example.com".to_string()),
        recipient: Some("agent@example.com".to_string()),
        subject: Some("Verification code".to_string()),
    }
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
fn email_aliases_cover_shortcuts_and_generated_email_operations() {
    let expected = [
        ("emails:latest", "emails:list-emails"),
        ("emails:list", "emails:list-emails"),
        ("emails:get", "emails:get-email"),
        ("emails:search", "emails:search-emails"),
        ("emails:wait", "emails:search-emails"),
        ("emails:watch", "emails:search-emails"),
    ];

    assert_eq!(email_command_aliases().len(), expected.len());
    for (alias, target) in expected {
        assert_eq!(email_command_target(alias), Some(target));
        assert_eq!(email_command_target(&alias.replace(':', " ")), Some(target));
    }
    for alias in ["emails:get", "emails:latest", "emails:wait", "emails:watch"] {
        assert!(is_emails_friendly_command(alias));
        assert!(is_emails_friendly_command(&alias.replace(':', " ")));
    }
    for alias in ["emails:list", "emails:show", "emails:search"] {
        assert!(!is_emails_friendly_command(alias));
    }
    assert_eq!(email_command_target("emails:show"), None);
    assert_eq!(
        email_command_target("emails:list-emails"),
        Some("emails:list-emails")
    );
    assert_eq!(
        email_command_target("emails:get-email"),
        Some("emails:get-email")
    );
}

#[test]
fn root_dispatch_rejects_poll_shortcut_like_node_cli() {
    let spaced = friendly::dispatch(args(&["emails", "poll", "--help"]))
        .expect_err("spaced poll shortcut should not route");
    assert!(spaced
        .to_string()
        .contains("Unknown emails command `emails:poll`"));

    let colon = friendly::dispatch(args(&["emails:poll", "--help"]))
        .expect_err("colon poll shortcut should not route");
    assert!(colon.to_string().contains("Unknown command `emails:poll`"));
}

#[test]
fn email_runtime_flags_extract_auth_and_time_without_consuming_other_flags() {
    let extracted = auth_flags(&args(&[
        "--api-key",
        "key_123",
        "--api-base-url=https://api.example.test/v1",
        "--limit",
        "5",
        "--time",
    ]))
    .expect("auth flags");

    assert_eq!(
        extracted,
        BTreeMap::from([
            (
                "api-base-url".to_string(),
                "https://api.example.test/v1".to_string()
            ),
            ("api-key".to_string(), "key_123".to_string()),
        ])
    );
    assert!(has_time_flag(&args(&["--limit", "5", "--time=true"])));
    assert!(!has_time_flag(&args(&["--time", "--no-time"])));
    assert!(auth_flags(&args(&["--api-key"]))
        .expect_err("missing api key value should fail")
        .to_string()
        .contains("Missing value for --api-key"));
}

#[test]
fn latest_runtime_plan_preserves_json_envelope_behavior() {
    let plan = build_email_command_plan(
        "emails latest",
        &args(&["--limit", "3", "--json", "--api-key", "ignored", "--time"]),
        "2026-07-17T12:00:00.000Z",
    )
    .expect("latest command plan");

    let EmailCommandPlan::Single(plan) = plan else {
        panic!("latest should be a single request");
    };
    assert_eq!(plan.target_operation_id, "emails:list-emails");
    assert_eq!(plan.output_mode, EmailCommandOutputMode::LatestJson);
    assert_eq!(plan.request.method, "GET");
    assert_eq!(plan.request.path, "/emails");
    assert_eq!(
        plan.request.query,
        BTreeMap::from([("limit".to_string(), "3".to_string())])
    );
}

#[test]
fn list_get_and_search_runtime_plans_match_email_api_shapes() {
    let list = build_emails_list_request_from_args(&args(&[
        "--domain-id",
        "domain_123",
        "--status",
        "accepted",
        "--search",
        "invoice",
        "--date-from",
        "2026-07-01T00:00:00Z",
        "--wait",
        "30",
        "--envelope",
    ]))
    .expect("list request");

    assert_eq!(list.target_operation_id, "emails:list-emails");
    assert_eq!(list.output_mode, EmailCommandOutputMode::JsonEnvelope);
    assert_eq!(list.request.path, "/emails");
    assert_eq!(
        list.request.query,
        BTreeMap::from([
            ("date_from".to_string(), "2026-07-01T00:00:00Z".to_string()),
            ("domain_id".to_string(), "domain_123".to_string()),
            ("limit".to_string(), DEFAULT_EMAIL_LIST_LIMIT.to_string()),
            ("search".to_string(), "invoice".to_string()),
            ("status".to_string(), "accepted".to_string()),
            ("wait".to_string(), "30".to_string()),
        ])
    );

    let get = build_emails_get_request_from_args(&args(&["email/123"])).expect("get request");
    assert_eq!(get.target_operation_id, "emails:get-email");
    assert_eq!(get.request.path, "/emails/email%2F123");
    assert_eq!(get.output_mode, EmailCommandOutputMode::JsonData);

    let search = build_emails_search_request_from_args(&args(&[
        "renewal",
        "--domain",
        "acme corp",
        "--from",
        "alice@example.com",
        "--has-attachment",
        "--limit",
        "25",
        "--snippet",
        "false",
        "--include-facets",
        "false",
    ]))
    .expect("search request");

    assert_eq!(search.target_operation_id, "emails:search-emails");
    assert_eq!(search.request.path, "/emails/search");
    assert_eq!(
        search.request.query,
        BTreeMap::from([
            ("from".to_string(), "alice@example.com".to_string()),
            ("has_attachment".to_string(), "true".to_string()),
            ("include_facets".to_string(), "false".to_string()),
            ("limit".to_string(), "25".to_string()),
            ("q".to_string(), "renewal domain:\"acme corp\"".to_string()),
            ("snippet".to_string(), "false".to_string()),
        ])
    );
}

#[test]
fn emails_help_requests_return_before_argument_validation() {
    for (command, args) in [
        ("emails:get", args(&["--help"])),
        ("emails:latest", args(&["-h"])),
        ("emails:wait", args(&["--help"])),
        ("emails:watch", args(&["--help"])),
    ] {
        execute_command(command, &args).expect("help request should succeed");
    }
}

#[test]
fn emails_leaf_help_lists_node_visible_flags() {
    let latest = email_leaf_help("emails latest").expect("latest help");
    assert_tokens(
        &latest,
        &[
            "Show the most recent inbound emails as a compact table",
            "emails latest",
            "--api-key",
            "--limit",
            "--json",
            "--time",
        ],
    );
    assert!(!latest.contains("--api-base-url"));
    assert!(!latest.contains("emails wait"));

    let wait = email_leaf_help("emails wait").expect("wait help");
    assert_tokens(
        &wait,
        &[
            "Wait for matching inbound emails",
            "emails wait",
            "--api-key",
            "--body",
            "--domain",
            "--domain-id",
            "--from",
            "--has-attachment",
            "--include-existing",
            "--interval",
            "-n, --number",
            "--page-size",
            "--q",
            "--reply-to-sent-email-id",
            "--since",
            "--spam-score-gte",
            "--spam-score-lt",
            "--subject",
            "--table",
            "--timeout",
            "--to",
        ],
    );
    assert!(!wait.contains("--api-base-url"));
    assert!(!wait.contains("emails latest"));

    let watch = email_leaf_help("emails watch").expect("watch help");
    assert_tokens(
        &watch,
        &[
            "Watch inbound emails with filters",
            "emails watch",
            "--api-key",
            "--body",
            "--domain",
            "--domain-id",
            "--from",
            "--has-attachment",
            "--include-existing",
            "--interval",
            "--jsonl",
            "--number",
            "--page-size",
            "--q",
            "--seconds",
            "--since",
            "--spam-score-gte",
            "--spam-score-lt",
            "--subject",
            "--to",
        ],
    );
    assert!(!watch.contains("--api-base-url"));
    assert!(!watch.contains("--reply-to-sent-email-id"));
    assert!(!watch.contains("emails latest"));
}

#[test]
fn emails_leaf_help_uses_typed_subcommand_surface() {
    let latest = run_primitive(&["emails", "latest", "--help"]);
    assert_tokens(&latest, &["emails latest", "--limit", "--json"]);
    assert!(!latest.contains("Primitive Rust CLI emails commands"));

    let wait = run_primitive(&["emails", "wait", "--help"]);
    assert_tokens(
        &wait,
        &[
            "emails wait",
            "--reply-to-sent-email-id",
            "--timeout",
            "--table",
        ],
    );
    assert!(!wait.contains("Primitive Rust CLI emails commands"));

    let watch = run_primitive(&["emails", "watch", "--help"]);
    assert_tokens(&watch, &["emails watch", "--jsonl", "--seconds"]);
    assert!(!watch.contains("Primitive Rust CLI emails commands"));
}

#[test]
fn emails_show_is_not_a_routed_alias_or_help_surface() {
    let error = dispatch(&args(&["show", "--help"]))
        .expect_err("emails show should not be accepted as a Rust-only alias");
    assert!(error.to_string().contains("Unknown emails command"));
}

#[test]
fn wait_and_watch_runtime_arg_plans_feed_polling_core() {
    let wait = build_wait_poll_plan_from_args(
        &args(&[
            "--to",
            "agent@example.com",
            "--reply-to-sent-email-id",
            "sent_123",
            "-n",
            "2",
            "--timeout",
            "0",
            "--table",
        ]),
        "2026-07-17T12:00:00.000Z",
    )
    .expect("wait request");

    assert_eq!(wait.target_operation_id, "emails:search-emails");
    assert_eq!(wait.plan.output_mode, EmailPollOutputMode::Table);
    assert_eq!(wait.plan.target_matches, Some(2));
    assert_eq!(wait.plan.deadline_seconds, None);
    assert_eq!(
        wait.plan.request.query.get("to").map(String::as_str),
        Some("agent@example.com")
    );
    assert_eq!(
        wait.plan
            .request
            .query
            .get("reply_to_sent_email_id")
            .map(String::as_str),
        Some("sent_123")
    );

    let watch = build_watch_poll_plan_from_args(
        &args(&[
            "--include-existing",
            "--jsonl",
            "--seconds",
            "60",
            "--number",
            "3",
        ]),
        "2026-07-17T12:00:00.000Z",
    )
    .expect("watch request");

    assert_eq!(watch.target_operation_id, "emails:search-emails");
    assert_eq!(watch.plan.output_mode, EmailPollOutputMode::Jsonl);
    assert_eq!(watch.plan.deadline_seconds, Some(60));
    assert_eq!(watch.plan.target_matches, Some(3));
    assert!(!watch.plan.request.query.contains_key("date_from"));
}

#[test]
fn latest_defaults_to_table_and_builds_list_request() {
    let plan = build_latest_plan(&LatestShortcutInput::default()).expect("build latest plan");

    assert_eq!(plan.output_mode, LatestOutputMode::Table);
    assert_eq!(plan.request.method, "GET");
    assert_eq!(plan.request.path, "/emails");
    assert_eq!(
        plan.request.query,
        BTreeMap::from([("limit".to_string(), DEFAULT_LATEST_LIMIT.to_string())])
    );
    assert_eq!(plan.request.body, None);
}

#[test]
fn latest_json_mode_and_limit_bounds_are_explicit() {
    let plan = build_latest_plan(&LatestShortcutInput {
        limit: Some(MAX_LATEST_LIMIT),
        json: true,
    })
    .expect("build latest json plan");

    assert_eq!(plan.output_mode, LatestOutputMode::Json);
    assert_eq!(
        plan.request.query,
        BTreeMap::from([("limit".to_string(), MAX_LATEST_LIMIT.to_string())])
    );

    assert!(build_latest_plan(&LatestShortcutInput {
        limit: Some(0),
        json: false,
    })
    .expect_err("zero limit should fail")
    .to_string()
    .contains("--limit must be greater than or equal to 1"));
    assert!(build_latest_plan(&LatestShortcutInput {
        limit: Some(MAX_LATEST_LIMIT + 1),
        json: false,
    })
    .expect_err("too-large limit should fail")
    .to_string()
    .contains("--limit must be less than or equal to 100"));
}

#[test]
fn formats_latest_table_rows_like_node_shortcut() {
    assert_eq!(pick_id_width(true), ID_DISPLAY_WIDTH_SHORT);
    assert_eq!(pick_id_width(false), ID_DISPLAY_WIDTH_FULL);
    assert_eq!(truncate("abcdefghijklmnopqrstuvwxyz", 8), "abcde...");
    assert_eq!(
        format_received_at(Some("2026-07-17T12:34:56.789Z")),
        "2026-07-17 12:34:56"
    );
    assert_eq!(
        format_received_at(None),
        format!("{}{}", "-", " ".repeat(RECEIVED_DISPLAY_WIDTH - 1))
    );
    assert_eq!(
        format_header(8),
        format!(
            "ID{}  RECEIVED (UTC){}  FROM{}  TO{}  SUBJECT",
            " ".repeat(6),
            " ".repeat(RECEIVED_DISPLAY_WIDTH - "RECEIVED (UTC)".len()),
            " ".repeat(ADDRESS_DISPLAY_WIDTH - "FROM".len()),
            " ".repeat(ADDRESS_DISPLAY_WIDTH - "TO".len())
        )
    );

    let formatted = format_row(
        &EmailSummary {
            id: "12345678-1234-1234-1234-123456789abc".to_string(),
            received_at: Some("2026-07-17T12:34:56.789Z".to_string()),
            sender: Some("a-very-long-sender-address@example.com".to_string()),
            recipient: Some("agent@example.com".to_string()),
            subject: Some("Subject\nwith\tcollapsed       whitespace".to_string()),
        },
        ID_DISPLAY_WIDTH_SHORT,
    );

    assert!(formatted.starts_with("12345678  2026-07-17 12:34:56"));
    assert!(formatted.contains("a-very-long-sender-address@ex..."));
    assert!(formatted.ends_with("Subject with collapsed whitespace                 "));
}

#[test]
fn builds_poll_filters_and_search_query() {
    let flags = EmailPollFilterFlags {
        body: Some("body text".to_string()),
        domain: Some("example domain.test".to_string()),
        domain_id: Some("domain_123".to_string()),
        from: Some("alice@example.com".to_string()),
        has_attachment: Some(true),
        q: Some("subject:verify".to_string()),
        reply_to_sent_email_id: Some("sent_123".to_string()),
        spam_score_gte: Some(3),
        spam_score_lt: Some(7),
        subject: Some("verification".to_string()),
        to: Some("agent@example.com".to_string()),
    };
    let filters = filters_from_flags(&flags);

    assert_eq!(quote_dsl_value("example.com"), "example.com");
    assert_eq!(
        quote_dsl_value("sales \"east\"\\ops"),
        "\"sales \\\"east\\\"\\\\ops\""
    );
    assert_eq!(
        build_email_search_query(
            &filters,
            25,
            Some("2026-07-17T12:00:00.000Z"),
            Some("cursor_1"),
        ),
        BTreeMap::from([
            ("body".to_string(), "body text".to_string()),
            ("cursor".to_string(), "cursor_1".to_string()),
            (
                "date_from".to_string(),
                "2026-07-17T12:00:00.000Z".to_string()
            ),
            ("domain_id".to_string(), "domain_123".to_string()),
            ("from".to_string(), "alice@example.com".to_string()),
            ("has_attachment".to_string(), "true".to_string()),
            ("include_facets".to_string(), "false".to_string()),
            ("limit".to_string(), "25".to_string()),
            (
                "q".to_string(),
                "subject:verify domain:\"example domain.test\"".to_string()
            ),
            ("reply_to_sent_email_id".to_string(), "sent_123".to_string()),
            ("snippet".to_string(), "false".to_string()),
            ("sort".to_string(), "received_at_asc".to_string()),
            ("spam_score_gte".to_string(), "3".to_string()),
            ("spam_score_lt".to_string(), "7".to_string()),
            ("subject".to_string(), "verification".to_string()),
            ("to".to_string(), "agent@example.com".to_string()),
        ])
    );
}

#[test]
fn wait_defaults_to_jsonl_and_plans_first_poll_request() {
    let plan = build_wait_poll_plan(
        &WaitShortcutInput {
            filters: EmailPollFilters {
                to: Some("agent@example.com".to_string()),
                ..Default::default()
            },
            ..Default::default()
        },
        "2026-07-17T12:00:00.000Z",
    )
    .expect("build wait plan");

    assert_eq!(plan.output_mode, EmailPollOutputMode::Jsonl);
    assert_eq!(plan.interval_seconds, DEFAULT_EMAIL_POLL_INTERVAL_SECONDS);
    assert_eq!(plan.page_size, DEFAULT_EMAIL_POLL_PAGE_SIZE);
    assert_eq!(plan.deadline_seconds, Some(DEFAULT_WAIT_TIMEOUT_SECONDS));
    assert_eq!(plan.target_matches, Some(1));
    assert_eq!(plan.initial_cursor, None);
    assert_eq!(plan.request.path, "/emails/search");
    assert_eq!(
        plan.request.query,
        BTreeMap::from([
            (
                "date_from".to_string(),
                "2026-07-17T12:00:00.000Z".to_string()
            ),
            ("include_facets".to_string(), "false".to_string()),
            (
                "limit".to_string(),
                DEFAULT_EMAIL_POLL_PAGE_SIZE.to_string()
            ),
            ("snippet".to_string(), "false".to_string()),
            ("sort".to_string(), "received_at_asc".to_string()),
            ("to".to_string(), "agent@example.com".to_string()),
        ])
    );
}

#[test]
fn wait_handles_timeout_zero_custom_interval_and_explicit_since() {
    let plan = build_wait_poll_plan(
        &WaitShortcutInput {
            include_existing: true,
            interval_seconds: Some(7),
            number: Some(5),
            page_size: Some(75),
            since: Some("2026-07-17".to_string()),
            table: true,
            timeout_seconds: Some(0),
            ..Default::default()
        },
        "2026-07-17T12:00:00.000Z",
    )
    .expect("build wait plan");

    assert_eq!(plan.output_mode, EmailPollOutputMode::Table);
    assert_eq!(plan.interval_seconds, 7);
    assert_eq!(plan.page_size, 75);
    assert_eq!(plan.deadline_seconds, None);
    assert_eq!(plan.target_matches, Some(5));
    assert_eq!(
        plan.request.query.get("date_from").map(String::as_str),
        Some("2026-07-17T00:00:00.000Z")
    );
}

#[test]
fn watch_defaults_to_table_and_supports_jsonl_seconds_and_number() {
    let default_plan =
        build_watch_poll_plan(&WatchShortcutInput::default(), "2026-07-17T12:00:00.000Z")
            .expect("build default watch plan");

    assert_eq!(default_plan.output_mode, EmailPollOutputMode::Table);
    assert_eq!(default_plan.deadline_seconds, None);
    assert_eq!(default_plan.target_matches, None);
    assert_eq!(
        default_plan
            .request
            .query
            .get("date_from")
            .map(String::as_str),
        Some("2026-07-17T12:00:00.000Z")
    );

    let jsonl_plan = build_watch_poll_plan(
        &WatchShortcutInput {
            include_existing: true,
            interval_seconds: Some(3),
            jsonl: true,
            number: Some(20),
            page_size: Some(MAX_EMAIL_POLL_PAGE_SIZE),
            seconds: Some(300),
            ..Default::default()
        },
        "2026-07-17T12:00:00.000Z",
    )
    .expect("build jsonl watch plan");

    assert_eq!(jsonl_plan.output_mode, EmailPollOutputMode::Jsonl);
    assert_eq!(jsonl_plan.interval_seconds, 3);
    assert_eq!(jsonl_plan.deadline_seconds, Some(300));
    assert_eq!(jsonl_plan.target_matches, Some(20));
    assert!(!jsonl_plan.request.query.contains_key("date_from"));
}

#[test]
fn poll_plan_validation_matches_cli_bounds() {
    assert!(build_wait_poll_plan(
        &WaitShortcutInput {
            interval_seconds: Some(0),
            ..Default::default()
        },
        "2026-07-17T12:00:00.000Z",
    )
    .expect_err("zero interval should fail")
    .to_string()
    .contains("--interval must be greater than or equal to 1"));

    assert!(build_wait_poll_plan(
        &WaitShortcutInput {
            number: Some(0),
            ..Default::default()
        },
        "2026-07-17T12:00:00.000Z",
    )
    .expect_err("zero number should fail")
    .to_string()
    .contains("--number must be greater than or equal to 1"));

    assert!(build_watch_poll_plan(
        &WatchShortcutInput {
            page_size: Some(MAX_EMAIL_POLL_PAGE_SIZE + 1),
            ..Default::default()
        },
        "2026-07-17T12:00:00.000Z",
    )
    .expect_err("too-large page size should fail")
    .to_string()
    .contains("--page-size must be less than or equal to 100"));

    assert!(build_watch_poll_plan(
        &WatchShortcutInput {
            seconds: Some(0),
            ..Default::default()
        },
        "2026-07-17T12:00:00.000Z",
    )
    .expect_err("zero seconds should fail")
    .to_string()
    .contains("--seconds must be greater than or equal to 1"));

    assert!(build_wait_poll_plan(
        &WaitShortcutInput {
            since: Some("not-a-date".to_string()),
            ..Default::default()
        },
        "2026-07-17T12:00:00.000Z",
    )
    .expect_err("invalid since should fail")
    .to_string()
    .contains("--since must be a valid date or ISO-8601 timestamp"));
}

#[test]
fn cursor_helpers_follow_accepted_rows_and_page_progression() {
    let rows = vec![
        row("email_1", "2026-07-17T12:00:00.000Z", "pending"),
        row("email_2", "2026-07-17T12:01:00.000Z", "accepted"),
        row("email_3", "2026-07-17T12:02:00.000Z", "completed"),
        row("email_4", "2026-07-17T12:03:00.000Z", "rejected"),
    ];

    assert_eq!(
        encode_received_at_search_cursor(&rows[1]).expect("encode cursor"),
        "cnwyMDI2LTA3LTE3VDEyOjAxOjAwLjAwMFp8ZW1haWxfMg"
    );
    assert_eq!(
        cursor_from_rows(&rows)
            .expect("cursor from rows")
            .as_deref(),
        Some("cnwyMDI2LTA3LTE3VDEyOjAzOjAwLjAwMFp8ZW1haWxfNA")
    );
    assert_eq!(
        cursor_from_accepted_rows(&rows)
            .expect("cursor from accepted rows")
            .as_deref(),
        Some("cnwyMDI2LTA3LTE3VDEyOjAyOjAwLjAwMFp8ZW1haWxfMw")
    );

    let mut seen_ids = BTreeSet::from(["email_2".to_string()]);
    let fresh = collect_new_accepted_emails(&rows, &mut seen_ids);
    assert_eq!(fresh, vec![rows[2].clone()]);
    assert!(seen_ids.contains("email_3"));

    let decision = decide_email_poll_page(None, &rows).expect("page decision");
    assert_eq!(
        decision.next_cursor.as_deref(),
        Some("cnwyMDI2LTA3LTE3VDEyOjAyOjAwLjAwMFp8ZW1haWxfMw")
    );
    assert!(decision.cursor_advanced);
    assert!(!decision.sleep_before_next_poll);

    let repeated = decide_email_poll_page(decision.next_cursor.as_deref(), &rows)
        .expect("repeated page decision");
    assert!(!repeated.cursor_advanced);
    assert!(repeated.sleep_before_next_poll);

    let pending_only = decide_email_poll_page(
        None,
        &[row("email_5", "2026-07-17T12:04:00.000Z", "pending")],
    )
    .expect("pending page decision");
    assert_eq!(pending_only.next_cursor, None);
    assert!(!pending_only.cursor_advanced);
    assert!(pending_only.sleep_before_next_poll);
}

#[test]
fn poll_output_rendering_and_timeout_message_are_deterministic() {
    let accepted = row("email_2", "2026-07-17T12:01:00.000Z", "accepted");

    let jsonl = format_poll_row(&accepted, EmailPollOutputMode::Jsonl, ID_DISPLAY_WIDTH_FULL)
        .expect("format jsonl");
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&jsonl).expect("jsonl row"),
        json!({
            "id": "email_2",
            "received_at": "2026-07-17T12:01:00.000Z",
            "status": "accepted",
            "sender": "sender@example.com",
            "recipient": "agent@example.com",
            "subject": "Verification code"
        })
    );

    let table = format_poll_row(
        &accepted,
        EmailPollOutputMode::Table,
        ID_DISPLAY_WIDTH_SHORT,
    )
    .expect("format table");
    assert!(table.starts_with("email_2   2026-07-17 12:01:00"));

    assert_eq!(
        format_wait_timeout_message(1, 0),
        "Timed out waiting for 1 matching email; received 0."
    );
    assert_eq!(
        format_wait_timeout_message(5, 3),
        "Timed out waiting for 5 matching emails; received 3."
    );
}
