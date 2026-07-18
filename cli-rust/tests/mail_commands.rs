use primitive_rust::mail_commands::{
    auth_flags, build_chat_command_plan_from_args,
    build_chat_command_plan_from_args_with_default_lookup,
    build_chat_command_plan_from_args_with_default_lookup_with_stdin,
    build_chat_command_plan_from_args_with_stdin, build_chat_json_envelope,
    build_chat_reply_command_plan_from_args, build_chat_reply_turn_plan_from_args,
    build_chat_send_request, build_chat_turn_plan, build_chat_wait_requests,
    build_default_from_lookup_request, build_reply_command_plan_from_args,
    build_reply_shortcut_body, build_send_command_plan_from_args,
    build_send_command_plan_from_args_with_default_lookup, build_send_shortcut_body,
    chat_help_text, chat_reply_help_text, chat_state_path, derive_subject,
    execute_chat_command_plan_with_runtime, format_chat_transcript, has_time_flag,
    identify_mail_command, is_mail_friendly_command, load_active_chat_state,
    load_chat_conversation_by_local_id, lookup_default_from_address, mail_command_target,
    pick_default_from_address, read_attachment_files, reply_help_text, resolve_chat_response_body,
    resolve_message_bodies, save_active_chat_state_at, send_help_text, ApiRequest, Attachment,
    ChatMatchStrategy, ChatReplyContextPlan, ChatReplyStateLookup, ChatResponseBodyFormat,
    ChatSendInput, ChatTurnInput, ChatWaitInput, MailCommandKind, MailOutputShape,
    MessageBodySourceInput, ReplyShortcutInput, ResolvedMessageBodies, SavedChatState,
    SavedChatStateInput, SendShortcutInput,
};
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

fn argv(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|part| (*part).to_string()).collect()
}

#[test]
fn mail_help_flags_after_commands_do_not_validate_request_args() {
    for args in [
        argv(&["send", "--help"]),
        argv(&["reply", "--help"]),
        argv(&["chat", "--help"]),
        argv(&["chat", "reply", "--help"]),
        argv(&["send", "--api-key", "prim_test", "--help"]),
    ] {
        primitive_rust::mail_commands::dispatch(&args)
            .unwrap_or_else(|error| panic!("{args:?} should print help: {error}"));
    }
}

#[test]
fn mail_command_help_documents_node_visible_flags() {
    let cases = [
        (
            send_help_text(),
            [
                "--api-key",
                "--attachment",
                "--bcc",
                "--body",
                "--body-file",
                "--body-stdin",
                "--cc",
                "--from",
                "--html",
                "--html-file",
                "--html-stdin",
                "--in-reply-to",
                "--subject",
                "--time",
                "--to",
                "--wait",
                "--wait-timeout-ms",
            ]
            .as_slice(),
        ),
        (
            reply_help_text(),
            [
                "-a",
                "--attachment",
                "--api-key",
                "--body",
                "--body-file",
                "--body-stdin",
                "--from",
                "--html",
                "--html-file",
                "--html-stdin",
                "--id",
                "--time",
                "--wait",
            ]
            .as_slice(),
        ),
        (
            chat_help_text(),
            [
                "-a",
                "--attachment",
                "--api-key",
                "--from",
                "--in-reply-to",
                "--interval",
                "--json",
                "--quiet",
                "--reply",
                "--reply-to-email-id",
                "--strict-only",
                "--strict-phase-seconds",
                "--time",
                "--timeout",
            ]
            .as_slice(),
        ),
        (
            chat_reply_help_text(),
            [
                "-a",
                "--attachment",
                "--api-key",
                "--id",
                "--interval",
                "--json",
                "--quiet",
                "--strict-only",
                "--strict-phase-seconds",
                "--time",
                "--timeout",
            ]
            .as_slice(),
        ),
    ];

    for (help, expected_flags) in cases {
        for expected in expected_flags {
            assert!(help.contains(expected), "{expected}");
        }
    }
}

fn unique_config_dir(label: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!(
        "primitive-mail-{}-{}-{}",
        label,
        std::process::id(),
        nonce
    ))
}

fn write_temp_attachment(label: &str, filename: &str, contents: &[u8]) -> (PathBuf, String) {
    let dir = unique_config_dir(label);
    fs::create_dir_all(&dir).expect("create temp attachment dir");
    let path = dir.join(filename);
    fs::write(&path, contents).expect("write temp attachment");
    (dir, path.to_string_lossy().into_owned())
}

#[test]
fn resolves_inline_body_and_html_sources() {
    let bodies = resolve_message_bodies(
        &MessageBodySourceInput {
            body: Some("hello".to_string()),
            html: Some("<p>hello</p>".to_string()),
            ..Default::default()
        },
        |_| unreachable!("no file read expected"),
        |_| unreachable!("no stdin read expected"),
    )
    .expect("resolve bodies");

    assert_eq!(
        bodies,
        ResolvedMessageBodies {
            body: Some("hello".to_string()),
            html: Some("<p>hello</p>".to_string())
        }
    );
}

#[test]
fn rejects_multiple_plain_text_body_sources() {
    let error = resolve_message_bodies(
        &MessageBodySourceInput {
            body: Some("hello".to_string()),
            body_file: Some("body.txt".to_string()),
            ..Default::default()
        },
        |_| Ok("from file".to_string()),
        |_| Ok("from stdin".to_string()),
    )
    .expect_err("conflicting body sources should fail");

    assert!(error
        .to_string()
        .contains("Pass only one plain-text body source"));
}

#[test]
fn rejects_consuming_stdin_twice() {
    let error = resolve_message_bodies(
        &MessageBodySourceInput {
            body_stdin: true,
            html_stdin: true,
            ..Default::default()
        },
        |_| Ok("from file".to_string()),
        |_| Ok("from stdin".to_string()),
    )
    .expect_err("conflicting stdin sources should fail");

    assert!(error
        .to_string()
        .contains("Stdin can only be consumed once"));
}

#[test]
fn rejects_missing_or_empty_message_body() {
    let missing = resolve_message_bodies(
        &MessageBodySourceInput::default(),
        |_| Ok(String::new()),
        |_| Ok(String::new()),
    )
    .expect_err("missing body should fail");
    assert!(missing
        .to_string()
        .contains("Either a plain-text body source or an HTML body source"));

    let empty = resolve_message_bodies(
        &MessageBodySourceInput {
            body: Some(String::new()),
            ..Default::default()
        },
        |_| Ok(String::new()),
        |_| Ok(String::new()),
    )
    .expect_err("empty body should fail");
    assert!(empty
        .to_string()
        .contains("Either a non-empty plain-text body or a non-empty HTML body"));
}

#[test]
fn reads_body_sources_from_file_and_stdin_callbacks() {
    let bodies = resolve_message_bodies(
        &MessageBodySourceInput {
            body_file: Some("body.txt".to_string()),
            html_stdin: true,
            ..Default::default()
        },
        |path| Ok(format!("file:{path}")),
        |label| Ok(format!("stdin:{label}")),
    )
    .expect("resolve callback sources");

    assert_eq!(bodies.body.as_deref(), Some("file:body.txt"));
    assert_eq!(bodies.html.as_deref(), Some("stdin:--html-stdin"));
}

#[test]
fn reads_attachments_as_base64_with_filename_metadata() {
    let paths = vec!["reports/summary.txt".to_string(), "image.bin".to_string()];
    let attachments = read_attachment_files(&paths, |path| {
        Ok(match path {
            "reports/summary.txt" => b"hello".to_vec(),
            "image.bin" => vec![0xff, 0x00, 0x10],
            other => panic!("unexpected path {other}"),
        })
    })
    .expect("read attachments")
    .expect("attachments");

    assert_eq!(
        attachments,
        vec![
            Attachment {
                content_base64: "aGVsbG8=".to_string(),
                filename: "summary.txt".to_string(),
            },
            Attachment {
                content_base64: "/wAQ".to_string(),
                filename: "image.bin".to_string(),
            },
        ]
    );
}

#[test]
fn rejects_empty_or_control_character_attachments() {
    let empty_paths = vec!["empty.txt".to_string()];
    let empty = read_attachment_files(&empty_paths, |_| Ok(Vec::new()))
        .expect_err("empty attachment should fail");
    assert!(empty.to_string().contains("is empty"));

    let control_paths = vec!["bad\u{7f}.txt".to_string()];
    let control = read_attachment_files(&control_paths, |_| Ok(b"x".to_vec()))
        .expect_err("control filename should fail");
    assert!(control.to_string().contains("contains control characters"));
}

#[test]
fn derives_subject_from_first_non_empty_line_and_truncates() {
    assert_eq!(derive_subject("\n  Hello there  \nsecond"), "Hello there");
    assert_eq!(derive_subject("\n\n"), "Message");

    let long = "x".repeat(240);
    let subject = derive_subject(&long);
    assert_eq!(subject.len(), 200);
    assert!(subject.ends_with("..."));
}

#[test]
fn builds_default_from_lookup_request() {
    let request = build_default_from_lookup_request();

    assert_eq!(request.method, "GET");
    assert_eq!(request.path, "/domains");
    assert!(request.query.is_empty());
    assert_eq!(request.body, None);
}

#[test]
fn picks_default_from_from_first_active_verified_domain() {
    let from = pick_default_from_address(&json!({
        "data": [
            {"domain": "pending.example", "verified": false},
            {"domain": "inactive.example", "is_active": false},
            {"domain": "verified.example", "is_active": true},
            {"domain": "later.example", "is_active": true}
        ]
    }))
    .expect("default from");

    assert_eq!(from, "agent@verified.example");
}

#[test]
fn rejects_default_from_when_no_active_verified_domain_exists() {
    let error = lookup_default_from_address(|request| {
        assert_eq!(request.path, "/domains");
        Ok(json!({
            "data": [
                {"domain": "pending.example", "verified": false},
                {"domain": "inactive.example", "is_active": false}
            ]
        }))
    })
    .expect_err("missing verified outbound domain should fail");

    assert!(error
        .to_string()
        .contains("No active verified outbound domain found on this account"));
    assert!(error.to_string().contains("pass --from explicitly"));
}

#[test]
fn wraps_default_from_lookup_transport_errors_with_actionable_message() {
    let error = lookup_default_from_address(|request| {
        assert_eq!(request.path, "/domains");
        Err(anyhow::anyhow!("HTTP 503"))
    })
    .expect_err("lookup transport error should fail");

    assert!(error
        .to_string()
        .contains("Could not look up your verified domains to default --from"));
    assert!(error.to_string().contains("Pass --from explicitly"));
    assert!(error.to_string().contains("HTTP 503"));
}

#[test]
fn builds_send_shortcut_payload_with_defaults_and_optional_fields() {
    let body = build_send_shortcut_body(&SendShortcutInput {
        from: None,
        default_from: Some("agent@example.com".to_string()),
        to: "alice@example.com".to_string(),
        cc: vec!["bob@example.com".to_string()],
        bcc: vec!["audit@example.com".to_string()],
        subject: None,
        bodies: ResolvedMessageBodies {
            body: Some("\n Status update\nDetails".to_string()),
            html: Some("<p>Status update</p>".to_string()),
        },
        attachments: Some(vec![Attachment {
            content_base64: "eA==".to_string(),
            filename: "x.txt".to_string(),
        }]),
        in_reply_to: Some("<parent@example.com>".to_string()),
        wait: Some(true),
        wait_timeout_ms: Some(30_000),
    })
    .expect("build send body");

    assert_eq!(
        body,
        json!({
            "from": "agent@example.com",
            "to": "alice@example.com",
            "cc": ["bob@example.com"],
            "bcc": ["audit@example.com"],
            "subject": "Status update",
            "body_text": "\n Status update\nDetails",
            "body_html": "<p>Status update</p>",
            "attachments": [{"content_base64": "eA==", "filename": "x.txt"}],
            "in_reply_to": "<parent@example.com>",
            "wait": true,
            "wait_timeout_ms": 30000
        })
    );
}

#[test]
fn builds_send_shortcut_payload_with_message_subject_for_html_only() {
    let body = build_send_shortcut_body(&SendShortcutInput {
        from: Some("agent@example.com".to_string()),
        default_from: None,
        to: "alice@example.com".to_string(),
        cc: Vec::new(),
        bcc: Vec::new(),
        subject: None,
        bodies: ResolvedMessageBodies {
            body: None,
            html: Some("<p>Hello</p>".to_string()),
        },
        attachments: None,
        in_reply_to: None,
        wait: None,
        wait_timeout_ms: None,
    })
    .expect("build send body");

    assert_eq!(body["subject"], "Message");
    assert_eq!(body["body_html"], "<p>Hello</p>");
}

#[test]
fn builds_reply_payload_without_recipient_subject_or_threading_headers() {
    let body = build_reply_shortcut_body(&ReplyShortcutInput {
        id: "email_123".to_string(),
        from: Some("Support <agent@example.com>".to_string()),
        bodies: ResolvedMessageBodies {
            body: Some("Thanks".to_string()),
            html: None,
        },
        attachments: Some(vec![Attachment {
            content_base64: "eA==".to_string(),
            filename: "x.txt".to_string(),
        }]),
        wait: Some(false),
    })
    .expect("build reply body");

    assert_eq!(
        body,
        json!({
            "body_text": "Thanks",
            "from": "Support <agent@example.com>",
            "attachments": [{"content_base64": "eA==", "filename": "x.txt"}],
            "wait": false
        })
    );
    assert!(body.get("to").is_none());
    assert!(body.get("subject").is_none());
    assert!(body.get("in_reply_to").is_none());
}

#[test]
fn builds_chat_new_send_request() {
    let request = build_chat_send_request(&ChatSendInput {
        recipient: "agent@example.com".to_string(),
        message: "Can you check this?".to_string(),
        from: "me@example.com".to_string(),
        subject: None,
        in_reply_to: Some("<raw-message-id>".to_string()),
        attachments: None,
        reply_to_email_id: None,
    })
    .expect("build chat send request");

    assert_eq!(request.method, "POST");
    assert_eq!(request.path, "/send-mail");
    assert_eq!(
        request.body,
        Some(json!({
            "from": "me@example.com",
            "to": "agent@example.com",
            "subject": "Can you check this?",
            "body_text": "Can you check this?",
            "in_reply_to": "<raw-message-id>"
        }))
    );
}

#[test]
fn builds_chat_reply_send_request() {
    let request = build_chat_send_request(&ChatSendInput {
        recipient: "agent@example.com".to_string(),
        message: "One more thing".to_string(),
        from: "me@example.com".to_string(),
        subject: Some("ignored in reply mode".to_string()),
        in_reply_to: None,
        attachments: None,
        reply_to_email_id: Some("email/123".to_string()),
    })
    .expect("build chat reply request");

    assert_eq!(request.method, "POST");
    assert_eq!(request.path, "/emails/email%2F123/reply");
    assert_eq!(
        request.body,
        Some(json!({
            "body_text": "One more thing",
            "from": "me@example.com"
        }))
    );
}

#[test]
fn builds_chat_strict_and_fallback_wait_requests() {
    let phases = build_chat_wait_requests(&ChatWaitInput {
        from: "me@example.com".to_string(),
        recipient: "agent@example.com".to_string(),
        sent_at_iso: "2026-07-17T12:00:00.000Z".to_string(),
        sent_id: "sent_123".to_string(),
        strict_only: false,
        page_size: 25,
    });

    assert_eq!(phases.len(), 2);
    assert_eq!(phases[0].strategy, ChatMatchStrategy::Strict);
    assert_eq!(phases[0].request.path, "/emails/search");
    assert_eq!(
        phases[0].request.query,
        BTreeMap::from([
            (
                "date_from".to_string(),
                "2026-07-17T12:00:00.000Z".to_string()
            ),
            ("include_facets".to_string(), "false".to_string()),
            ("limit".to_string(), "25".to_string()),
            ("reply_to_sent_email_id".to_string(), "sent_123".to_string()),
            ("snippet".to_string(), "false".to_string()),
            ("sort".to_string(), "received_at_asc".to_string()),
        ])
    );
    assert_eq!(phases[1].strategy, ChatMatchStrategy::Fallback);
    assert_eq!(
        phases[1].request.query,
        BTreeMap::from([
            (
                "date_from".to_string(),
                "2026-07-17T12:00:00.000Z".to_string()
            ),
            ("from".to_string(), "agent@example.com".to_string()),
            ("include_facets".to_string(), "false".to_string()),
            ("limit".to_string(), "25".to_string()),
            ("snippet".to_string(), "false".to_string()),
            ("sort".to_string(), "received_at_asc".to_string()),
            ("to".to_string(), "me@example.com".to_string()),
        ])
    );
}

#[test]
fn omits_chat_fallback_wait_request_in_strict_only_mode() {
    let phases = build_chat_wait_requests(&ChatWaitInput {
        from: "me@example.com".to_string(),
        recipient: "agent@example.com".to_string(),
        sent_at_iso: "2026-07-17T12:00:00.000Z".to_string(),
        sent_id: "sent_123".to_string(),
        strict_only: true,
        page_size: 50,
    });

    assert_eq!(phases.len(), 1);
    assert_eq!(phases[0].strategy, ChatMatchStrategy::Strict);
}

#[test]
fn builds_chat_turn_plan_with_send_and_wait_sequence() {
    let plan = build_chat_turn_plan(&ChatTurnInput {
        send: ChatSendInput {
            recipient: "agent@example.com".to_string(),
            message: "Ping".to_string(),
            from: "me@example.com".to_string(),
            subject: None,
            in_reply_to: None,
            attachments: None,
            reply_to_email_id: None,
        },
        wait: ChatWaitInput {
            from: "me@example.com".to_string(),
            recipient: "agent@example.com".to_string(),
            sent_at_iso: "2026-07-17T12:00:00.000Z".to_string(),
            sent_id: "sent_123".to_string(),
            strict_only: false,
            page_size: 50,
        },
    })
    .expect("build plan");

    assert_eq!(plan.send.path, "/send-mail");
    assert_eq!(plan.wait_phases.len(), 2);
}

#[test]
fn identifies_top_level_mail_commands_and_targets() {
    let chat_reply =
        identify_mail_command(&argv(&["chat", "reply", "one more"])).expect("identify chat reply");
    assert_eq!(chat_reply.kind, MailCommandKind::ChatReply);
    assert_eq!(chat_reply.consumed_args, 2);
    assert_eq!(chat_reply.command, "chat reply");

    let send = identify_mail_command(&argv(&["send", "--to", "alice@example.com"]))
        .expect("identify send");
    assert_eq!(send.kind, MailCommandKind::Send);
    assert_eq!(send.consumed_args, 1);
    assert!(is_mail_friendly_command("chat:reply"));
    assert_eq!(mail_command_target("send"), Some("sending:send-email"));
    assert_eq!(
        mail_command_target("chat:reply"),
        Some("sending:reply-to-email")
    );
}

#[test]
fn extracts_runtime_auth_and_time_flags_without_touching_request_body() {
    let args = argv(&[
        "chat",
        "agent@example.com",
        "Ping",
        "--api-key=key_123",
        "--api-base-url",
        "http://127.0.0.1:8787",
        "--time",
        "--no-time",
    ]);
    let flags = auth_flags(&args).expect("auth flags");
    assert_eq!(flags.get("api-key").map(String::as_str), Some("key_123"));
    assert_eq!(
        flags.get("api-base-url").map(String::as_str),
        Some("http://127.0.0.1:8787")
    );
    assert!(!has_time_flag(&args));
}

#[test]
fn plans_send_command_with_default_from_runtime_flags_and_json_result_output() {
    let plan = build_send_command_plan_from_args(
        &argv(&[
            "--to",
            "alice@example.com",
            "--body",
            "Hello",
            "--api-key",
            "key_123",
            "--time",
        ]),
        Some("agent@example.com".to_string()),
    )
    .expect("build send plan");

    assert_eq!(plan.target_operation_id, "sending:send-email");
    assert_eq!(plan.output_shape, MailOutputShape::JsonResult);
    assert!(plan.runtime.time);
    assert_eq!(
        plan.runtime.auth.get("api-key").map(String::as_str),
        Some("key_123")
    );
    assert_eq!(
        plan.request.body,
        Some(json!({
            "from": "agent@example.com",
            "to": "alice@example.com",
            "subject": "Hello",
            "body_text": "Hello"
        }))
    );
}

#[test]
fn plans_send_command_by_looking_up_default_from_when_omitted() {
    let mut lookup_requests = Vec::new();
    let plan = build_send_command_plan_from_args_with_default_lookup(
        &argv(&["--to", "alice@example.com", "--body", "Hello"]),
        |request| {
            lookup_requests.push(request.clone());
            Ok(json!({
                "data": [
                    {"domain": "verified.example", "is_active": true}
                ]
            }))
        },
    )
    .expect("build send plan with default lookup");

    assert_eq!(lookup_requests, vec![build_default_from_lookup_request()]);
    assert_eq!(
        plan.request.body,
        Some(json!({
            "from": "agent@verified.example",
            "to": "alice@example.com",
            "subject": "Hello",
            "body_text": "Hello"
        }))
    );
}

#[test]
fn plans_send_command_with_explicit_from_without_default_lookup() {
    let plan = build_send_command_plan_from_args_with_default_lookup(
        &argv(&[
            "--to",
            "alice@example.com",
            "--from",
            "support@example.com",
            "--body",
            "Hello",
        ]),
        |_| panic!("explicit --from should not trigger default lookup"),
    )
    .expect("build send plan with explicit from");

    assert_eq!(
        plan.request.body,
        Some(json!({
            "from": "support@example.com",
            "to": "alice@example.com",
            "subject": "Hello",
            "body_text": "Hello"
        }))
    );
}

#[test]
fn plans_top_level_chat_message_from_stdin_when_positional_is_omitted() {
    let mut reads = 0;
    let plan = build_chat_command_plan_from_args_with_stdin(
        &argv(&["agent@example.com", "--from", "me@example.com"]),
        None,
        "2026-07-17T12:00:00.000Z",
        "sent_123",
        || {
            reads += 1;
            Ok("Hello from stdin\n".to_string())
        },
    )
    .expect("build chat plan from stdin");

    assert_eq!(reads, 1);
    assert_eq!(plan.message, "Hello from stdin\n");
    assert_eq!(plan.subject.as_deref(), Some("Hello from stdin"));
    assert_eq!(
        plan.send.expect("send request").body,
        Some(json!({
            "from": "me@example.com",
            "to": "agent@example.com",
            "subject": "Hello from stdin",
            "body_text": "Hello from stdin\n"
        }))
    );
}

#[test]
fn plans_top_level_chat_by_looking_up_default_from_when_omitted() {
    let mut lookup_requests = Vec::new();
    let plan = build_chat_command_plan_from_args_with_default_lookup(
        &argv(&["agent@example.com", "Ping"]),
        "2026-07-17T12:00:00.000Z",
        "sent_123",
        |request| {
            lookup_requests.push(request.clone());
            Ok(json!({
                "data": [
                    {"domain": "verified.example", "is_active": true}
                ]
            }))
        },
    )
    .expect("build chat plan with default lookup");

    assert_eq!(lookup_requests, vec![build_default_from_lookup_request()]);
    assert_eq!(plan.from, "agent@verified.example");
    assert_eq!(
        plan.send.expect("send request").body,
        Some(json!({
            "from": "agent@verified.example",
            "to": "agent@example.com",
            "subject": "Ping",
            "body_text": "Ping"
        }))
    );
    assert_eq!(
        plan.wait.phases[1]
            .request
            .query
            .get("to")
            .map(String::as_str),
        Some("agent@verified.example")
    );
}

#[test]
fn plans_top_level_chat_stdin_by_looking_up_default_from_after_reading_message() {
    let events = std::cell::RefCell::new(Vec::new());
    let plan = build_chat_command_plan_from_args_with_default_lookup_with_stdin(
        &argv(&["agent@example.com"]),
        "2026-07-17T12:00:00.000Z",
        "sent_123",
        || {
            events.borrow_mut().push("stdin".to_string());
            Ok("Hello from stdin".to_string())
        },
        |request| {
            events.borrow_mut().push(format!("lookup:{}", request.path));
            Ok(json!({
                "data": [
                    {"domain": "verified.example", "is_active": true}
                ]
            }))
        },
    )
    .expect("build chat plan with stdin and default lookup");

    assert_eq!(
        events.into_inner(),
        vec!["stdin".to_string(), "lookup:/domains".to_string()]
    );
    assert_eq!(plan.from, "agent@verified.example");
}

#[test]
fn plans_top_level_chat_with_explicit_from_without_default_lookup() {
    let plan = build_chat_command_plan_from_args_with_default_lookup(
        &argv(&["agent@example.com", "Ping", "--from", "me@example.com"]),
        "2026-07-17T12:00:00.000Z",
        "sent_123",
        |_| panic!("explicit --from should not trigger default lookup"),
    )
    .expect("build chat plan with explicit from");

    assert_eq!(plan.from, "me@example.com");
    assert_eq!(
        plan.send.expect("send request").body,
        Some(json!({
            "from": "me@example.com",
            "to": "agent@example.com",
            "subject": "Ping",
            "body_text": "Ping"
        }))
    );
}

#[test]
fn plans_top_level_chat_latest_reply_context_by_looking_up_default_from_when_omitted() {
    let mut lookup_requests = Vec::new();
    let plan = build_chat_command_plan_from_args_with_default_lookup(
        &argv(&["agent@example.com", "--reply", "One more thing"]),
        "2026-07-17T12:00:00.000Z",
        "sent_123",
        |request| {
            lookup_requests.push(request.clone());
            Ok(json!({
                "data": [
                    {"domain": "verified.example", "is_active": true}
                ]
            }))
        },
    )
    .expect("build latest reply context with default lookup");

    assert_eq!(lookup_requests, vec![build_default_from_lookup_request()]);
    assert!(plan.reply_mode);
    assert_eq!(plan.from, "agent@verified.example");
    assert!(plan.send.is_none());
    match plan.reply_context {
        ChatReplyContextPlan::LatestInboundFromRecipient { request } => {
            assert_eq!(
                request.query.get("to").map(String::as_str),
                Some("agent@verified.example")
            );
        }
        other => panic!("unexpected reply context {other:?}"),
    }
}

#[test]
fn keeps_exact_top_level_chat_reply_parent_from_default_lookup_out_of_scope() {
    let error = build_chat_command_plan_from_args_with_default_lookup(
        &argv(&[
            "agent@example.com",
            "--reply",
            "One more thing",
            "--reply-to-email-id",
            "email_123",
        ]),
        "2026-07-17T12:00:00.000Z",
        "sent_123",
        |_| panic!("exact reply parent should not trigger default lookup"),
    )
    .expect_err("exact reply parent still requires explicit reply metadata");

    assert!(error.to_string().contains("--from is required"));
}

#[test]
fn rejects_empty_top_level_chat_stdin_message() {
    let error = build_chat_command_plan_from_args_with_stdin(
        &argv(&["agent@example.com", "--from", "me@example.com"]),
        None,
        "2026-07-17T12:00:00.000Z",
        "sent_123",
        || Ok(" \n".to_string()),
    )
    .expect_err("empty stdin message should fail");

    assert!(error.to_string().contains("Message body is empty."));
}

#[test]
fn plans_reply_command_with_short_attachment_alias() {
    let (dir, attachment_path) = write_temp_attachment("reply-a", "report.txt", b"hello");
    let plan = build_reply_command_plan_from_args(&[
        "--id".to_string(),
        "email_123".to_string(),
        "--body".to_string(),
        "Attached".to_string(),
        "-a".to_string(),
        attachment_path,
    ])
    .expect("build reply plan with -a");

    assert_eq!(
        plan.request.body,
        Some(json!({
            "body_text": "Attached",
            "attachments": [{"content_base64": "aGVsbG8=", "filename": "report.txt"}]
        }))
    );

    fs::remove_dir_all(dir).ok();
}

#[test]
fn plans_top_level_chat_with_short_attachment_alias() {
    let (dir, attachment_path) = write_temp_attachment("chat-a", "report.txt", b"hello");
    let plan = build_chat_command_plan_from_args(
        &[
            "agent@example.com".to_string(),
            "Ping".to_string(),
            "--from".to_string(),
            "me@example.com".to_string(),
            "-a".to_string(),
            attachment_path,
        ],
        None,
        "2026-07-17T12:00:00.000Z",
        "sent_123",
    )
    .expect("build chat plan with -a");

    assert_eq!(
        plan.send.expect("send request").body,
        Some(json!({
            "from": "me@example.com",
            "to": "agent@example.com",
            "subject": "Ping",
            "body_text": "Ping",
            "attachments": [{"content_base64": "aGVsbG8=", "filename": "report.txt"}]
        }))
    );

    fs::remove_dir_all(dir).ok();
}

#[test]
fn plans_chat_reply_with_short_attachment_alias() {
    let (dir, attachment_path) = write_temp_attachment("chat-reply-a", "report.txt", b"hello");
    let state = SavedChatState {
        local_id: 7,
        recipient: "agent@example.com".to_string(),
        from: "me@example.com".to_string(),
        last_reply_email_id: "email/parent".to_string(),
        timeout_seconds: 45,
        strict_phase_seconds: 10,
        strict_only: true,
    };
    let plan = build_chat_reply_turn_plan_from_args(
        &[
            "One more thing".to_string(),
            "-a".to_string(),
            attachment_path,
        ],
        &state,
        "2026-07-17T12:00:00.000Z",
        "sent_456",
    )
    .expect("build chat reply turn with -a");

    let send = plan.send.expect("send request");
    assert_eq!(send.path, "/emails/email%2Fparent/reply");
    assert_eq!(
        send.body,
        Some(json!({
            "body_text": "One more thing",
            "from": "me@example.com",
            "attachments": [{"content_base64": "aGVsbG8=", "filename": "report.txt"}]
        }))
    );

    fs::remove_dir_all(dir).ok();
}

#[test]
fn plans_chat_send_wait_sequence_and_json_output_without_network() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "Please check this",
            "--from",
            "me@example.com",
            "--json",
            "--strict-only",
            "--timeout",
            "15",
            "--strict-phase-seconds",
            "5",
            "--interval",
            "2",
            "--page-size",
            "25",
            "--chat-local-id",
            "3",
        ]),
        None,
        "2026-07-17T12:00:00.000Z",
        "sent_123",
    )
    .expect("build chat plan");

    assert_eq!(plan.target_operation_id, "sending:send-email");
    assert_eq!(plan.output_shape, MailOutputShape::ChatJsonEnvelope);
    assert_eq!(plan.local_chat_id, Some(3));
    assert_eq!(plan.wait.timeout_seconds, 15);
    assert_eq!(plan.wait.strict_phase_seconds, 5);
    assert_eq!(plan.wait.interval_seconds, 2);
    assert_eq!(plan.wait.page_size, 25);
    assert_eq!(plan.wait.phases.len(), 1);
    assert_eq!(plan.reply_context, ChatReplyContextPlan::None);
    assert_eq!(plan.send.expect("send request").path, "/send-mail");
}

#[test]
fn plans_chat_reply_mode_latest_context_before_reply_send_request() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "--reply",
            "One more thing",
            "--from",
            "me@example.com",
            "--page-size",
            "20",
        ]),
        None,
        "2026-07-17T12:00:00.000Z",
        "sent_123",
    )
    .expect("build chat reply-context plan");

    assert!(plan.reply_mode);
    assert_eq!(plan.target_operation_id, "sending:reply-to-email");
    assert!(plan.send.is_none());
    match plan.reply_context {
        ChatReplyContextPlan::LatestInboundFromRecipient { request } => {
            assert_eq!(request.path, "/emails/search");
            assert_eq!(
                request.query,
                BTreeMap::from([
                    ("from".to_string(), "agent@example.com".to_string()),
                    ("include_facets".to_string(), "false".to_string()),
                    ("limit".to_string(), "20".to_string()),
                    ("snippet".to_string(), "false".to_string()),
                    ("sort".to_string(), "received_at_desc".to_string()),
                    ("to".to_string(), "me@example.com".to_string()),
                ])
            );
        }
        other => panic!("unexpected reply context {other:?}"),
    }
}

#[test]
fn plans_chat_reply_forwarding_from_saved_state() {
    let state = SavedChatState {
        local_id: 7,
        recipient: "agent@example.com".to_string(),
        from: "me@example.com".to_string(),
        last_reply_email_id: "email/parent".to_string(),
        timeout_seconds: 120,
        strict_phase_seconds: 60,
        strict_only: true,
    };
    let plan = build_chat_reply_command_plan_from_args(
        &argv(&[
            "0",
            "One more thing",
            "--json",
            "--quiet",
            "--attachment",
            "report.pdf",
            "--api-key",
            "key_123",
            "--time",
        ]),
        Some(&state),
    )
    .expect("build chat reply plan");

    assert_eq!(plan.state_lookup, ChatReplyStateLookup::LocalId { id: 0 });
    assert_eq!(plan.message.as_deref(), Some("One more thing"));
    assert!(!plan.needs_stdin);
    assert_eq!(plan.output_shape, MailOutputShape::ChatJsonEnvelope);
    assert_eq!(
        plan.forward_args.expect("forward args"),
        argv(&[
            "agent@example.com",
            "--reply",
            "One more thing",
            "--from",
            "me@example.com",
            "--reply-to-email-id",
            "email/parent",
            "--timeout",
            "120",
            "--strict-phase-seconds",
            "60",
            "--interval",
            "2",
            "--page-size",
            "50",
            "--chat-local-id",
            "7",
            "--api-key",
            "key_123",
            "--json",
            "--quiet",
            "--attachment",
            "report.pdf",
            "--strict-only",
            "--time",
        ])
    );
}

#[test]
fn builds_chat_reply_turn_plan_from_saved_state() {
    let state = SavedChatState {
        local_id: 7,
        recipient: "agent@example.com".to_string(),
        from: "me@example.com".to_string(),
        last_reply_email_id: "email/parent".to_string(),
        timeout_seconds: 45,
        strict_phase_seconds: 10,
        strict_only: true,
    };
    let plan = build_chat_reply_turn_plan_from_args(
        &argv(&["One more thing"]),
        &state,
        "2026-07-17T12:00:00.000Z",
        "sent_456",
    )
    .expect("build chat reply turn");

    assert_eq!(
        plan.send.expect("send request").path,
        "/emails/email%2Fparent/reply"
    );
    assert_eq!(plan.wait.timeout_seconds, 45);
    assert_eq!(plan.wait.strict_phase_seconds, 10);
    assert_eq!(plan.wait.phases.len(), 1);
}

#[test]
fn persists_chat_state_in_node_compatible_shape_and_loads_it() {
    let config_dir = unique_config_dir("state");
    let saved = save_active_chat_state_at(
        &config_dir,
        SavedChatStateInput {
            recipient: "agent@example.com".to_string(),
            from: "me@example.com".to_string(),
            last_reply_email_id: "email/parent".to_string(),
            last_reply_received_at: "2026-07-17T12:00:02.000Z".to_string(),
            last_sent_email_id: "sent-1".to_string(),
            thread_id: Some("thread-1".to_string()),
            timeout_seconds: 45,
            strict_phase_seconds: 10,
            strict_only: true,
        },
        None,
        "2026-07-17T12:00:03.000Z",
    )
    .expect("save chat state");

    assert_eq!(saved.local_id, 0);
    let path = chat_state_path(&config_dir);
    let state_json: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&path).expect("read state")).expect("json state");
    assert_eq!(state_json["version"], 2);
    assert_eq!(state_json["active_local_id"], 0);
    assert_eq!(state_json["next_local_id"], 1);
    assert_eq!(state_json["conversations"][0]["local_id"], 0);
    assert_eq!(
        state_json["conversations"][0]["last_sent_email_id"],
        "sent-1"
    );
    assert_eq!(
        state_json["conversations"][0]["last_reply_received_at"],
        "2026-07-17T12:00:02.000Z"
    );

    let active = load_active_chat_state(&config_dir)
        .expect("load active")
        .expect("active state");
    let by_id = load_chat_conversation_by_local_id(&config_dir, 0)
        .expect("load by id")
        .expect("local state");
    assert_eq!(active, saved);
    assert_eq!(by_id, saved);

    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn loads_saved_chat_state_for_reply_request_construction_without_network() {
    let config_dir = unique_config_dir("reply-state");
    fs::create_dir_all(&config_dir).expect("create config dir");
    fs::write(
        chat_state_path(&config_dir),
        format!(
            "{}\n",
            json!({
                "version": 2,
                "active_local_id": 4,
                "next_local_id": 5,
                "conversations": [{
                    "local_id": 4,
                    "recipient": "agent@example.com",
                    "from": "me@example.com",
                    "last_reply_email_id": "email/parent",
                    "last_reply_received_at": "2026-07-17T12:00:02.000Z",
                    "last_sent_email_id": "sent-1",
                    "thread_id": "thread-1",
                    "timeout_seconds": 30,
                    "strict_phase_seconds": 8,
                    "strict_only": false,
                    "updated_at": "2026-07-17T12:00:03.000Z"
                }]
            })
        ),
    )
    .expect("write state");

    let state = load_chat_conversation_by_local_id(&config_dir, 4)
        .expect("load state")
        .expect("local chat");
    let plan = build_chat_reply_turn_plan_from_args(
        &argv(&["--id", "4", "One more thing", "--json"]),
        &state,
        "2026-07-17T12:00:04.000Z",
        "sent-reply",
    )
    .expect("build reply turn");

    assert_eq!(plan.local_chat_id, Some(4));
    assert_eq!(plan.output_shape, MailOutputShape::ChatJsonEnvelope);
    assert_eq!(plan.wait.timeout_seconds, 30);
    assert_eq!(plan.wait.strict_phase_seconds, 8);
    let send = plan.send.expect("send request");
    assert_eq!(send.method, "POST");
    assert_eq!(send.path, "/emails/email%2Fparent/reply");
    assert_eq!(
        send.body,
        Some(json!({
            "body_text": "One more thing",
            "from": "me@example.com"
        }))
    );

    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn executes_chat_new_turn_with_strict_poll_and_json_output_without_network() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "Ping",
            "--from",
            "me@example.com",
            "--json",
            "--timeout",
            "5",
            "--strict-phase-seconds",
            "2",
            "--interval",
            "1",
        ]),
        None,
        "",
        "",
    )
    .expect("build chat plan");
    let mut calls: Vec<ApiRequest> = Vec::new();

    let outcome = execute_chat_command_plan_with_runtime(
        &plan,
        |request| {
            calls.push(request.clone());
            match (request.method.as_str(), request.path.as_str()) {
                ("POST", "/send-mail") => Ok(json!({
                    "data": {
                        "id": "sent-1",
                        "accepted": ["agent@example.com"],
                        "from": "me@example.com",
                        "subject": "Ping",
                        "status": "queued",
                        "delivery_status": "sent",
                        "idempotent_replay": false
                    }
                })),
                ("GET", "/emails/search")
                    if request
                        .query
                        .get("reply_to_sent_email_id")
                        .map(String::as_str)
                        == Some("sent-1") =>
                {
                    Ok(json!({
                        "data": [{
                            "id": "email-1",
                            "status": "accepted",
                            "received_at": "2026-07-17T12:00:01.000Z"
                        }]
                    }))
                }
                ("GET", "/emails/email-1") => Ok(json!({
                    "data": {
                        "id": "email-1",
                        "from_email": "agent@example.com",
                        "to_email": "me@example.com",
                        "subject": "Re: Ping",
                        "received_at": "2026-07-17T12:00:01.000Z",
                        "body_text": "Pong",
                        "reply_to_sent_email_id": "sent-1"
                    }
                })),
                other => panic!("unexpected request {other:?}: {request:?}"),
            }
        },
        || "2026-07-17T12:00:00.000Z".to_string(),
        || 0,
        |_| unreachable!("strict match should not sleep"),
    )
    .expect("execute chat");

    assert_eq!(calls[0].path, "/send-mail");
    assert_eq!(calls[1].path, "/emails/search");
    assert_eq!(
        calls[1].query.get("date_from").map(String::as_str),
        Some("2026-07-17T12:00:00.000Z")
    );
    assert_eq!(calls[2].path, "/emails/email-1");
    assert_eq!(outcome.match_strategy, ChatMatchStrategy::Strict);
    assert_eq!(outcome.response_body, "Pong");

    let envelope = build_chat_json_envelope(&outcome);
    assert_eq!(envelope["response_body"], "Pong");
    assert_eq!(envelope["response_body_format"], "text");
    assert_eq!(envelope["match"]["strategy"], "strict");
    assert_eq!(
        envelope["match"]["description"],
        "strict, matched by reply_to_sent_email_id"
    );
    assert!(envelope["follow_up_commands"][0]["command"]
        .as_str()
        .expect("follow up command")
        .contains("--reply-to-email-id email-1"));

    let transcript = format_chat_transcript(&outcome);
    assert!(transcript.contains("Reply received"));
    assert!(transcript.contains("Match: strict, matched by reply_to_sent_email_id"));
    assert!(transcript.contains("Pong"));
}

#[test]
fn executes_chat_wait_fallback_when_strict_filter_is_not_supported() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "Ping",
            "--from",
            "me@example.com",
            "--timeout",
            "5",
            "--strict-phase-seconds",
            "2",
            "--interval",
            "1",
        ]),
        None,
        "",
        "",
    )
    .expect("build chat plan");
    let mut calls: Vec<ApiRequest> = Vec::new();

    let outcome = execute_chat_command_plan_with_runtime(
        &plan,
        |request| {
            calls.push(request.clone());
            match (request.method.as_str(), request.path.as_str()) {
                ("POST", "/send-mail") => Ok(json!({
                    "data": {
                        "id": "sent-1",
                        "accepted": ["agent@example.com"],
                        "from": "me@example.com",
                        "subject": "Ping",
                        "status": "queued"
                    }
                })),
                ("GET", "/emails/search")
                    if request
                        .query
                        .get("reply_to_sent_email_id")
                        .map(String::as_str)
                        == Some("sent-1") =>
                {
                    Ok(json!({
                        "data": [{
                            "id": "email-wrong",
                            "status": "accepted",
                            "received_at": "2026-07-17T12:00:01.000Z"
                        }]
                    }))
                }
                ("GET", "/emails/email-wrong") => Ok(json!({
                    "data": {
                        "id": "email-wrong",
                        "from_email": "agent@example.com",
                        "to_email": "me@example.com",
                        "received_at": "2026-07-17T12:00:01.000Z",
                        "body_text": "Wrong thread",
                        "reply_to_sent_email_id": "other-sent"
                    }
                })),
                ("GET", "/emails/search")
                    if request.query.get("from").map(String::as_str)
                        == Some("agent@example.com") =>
                {
                    Ok(json!({
                        "data": [{
                            "id": "email-fallback",
                            "status": "accepted",
                            "received_at": "2026-07-17T12:00:02.000Z"
                        }]
                    }))
                }
                ("GET", "/emails/email-fallback") => Ok(json!({
                    "data": {
                        "id": "email-fallback",
                        "from_email": "agent@example.com",
                        "to_email": "me@example.com",
                        "received_at": "2026-07-17T12:00:02.000Z",
                        "body_text": "Fallback answer"
                    }
                })),
                other => panic!("unexpected request {other:?}: {request:?}"),
            }
        },
        || "2026-07-17T12:00:00.000Z".to_string(),
        || 0,
        |_| unreachable!("fallback match should not sleep"),
    )
    .expect("execute chat");

    assert_eq!(outcome.match_strategy, ChatMatchStrategy::Fallback);
    assert_eq!(outcome.response_body, "Fallback answer");
    assert!(calls.iter().any(|request| {
        request.path == "/emails/search"
            && request.query.get("from").map(String::as_str) == Some("agent@example.com")
            && request.query.get("to").map(String::as_str) == Some("me@example.com")
    }));
}

#[test]
fn executes_chat_reply_mode_by_finding_latest_parent_before_sending_reply() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "--reply",
            "Follow up",
            "--from",
            "me@example.com",
            "--json",
            "--timeout",
            "5",
        ]),
        None,
        "",
        "",
    )
    .expect("build reply-mode chat plan");
    let mut calls: Vec<ApiRequest> = Vec::new();

    let outcome = execute_chat_command_plan_with_runtime(
        &plan,
        |request| {
            calls.push(request.clone());
            match (request.method.as_str(), request.path.as_str()) {
                ("GET", "/emails/search")
                    if request.query.get("sort").map(String::as_str)
                        == Some("received_at_desc") =>
                {
                    Ok(json!({
                        "data": [{
                            "id": "email/parent",
                            "status": "accepted",
                            "received_at": "2026-07-17T11:59:00.000Z"
                        }]
                    }))
                }
                ("POST", "/emails/email%2Fparent/reply") => {
                    assert_eq!(
                        request.body,
                        Some(json!({
                            "body_text": "Follow up",
                            "from": "me@example.com"
                        }))
                    );
                    Ok(json!({
                        "data": {
                            "id": "sent-reply-1",
                            "accepted": ["agent@example.com"],
                            "from": "me@example.com",
                            "status": "queued"
                        }
                    }))
                }
                ("GET", "/emails/search")
                    if request
                        .query
                        .get("reply_to_sent_email_id")
                        .map(String::as_str)
                        == Some("sent-reply-1") =>
                {
                    Ok(json!({
                        "data": [{
                            "id": "email-reply",
                            "status": "accepted",
                            "received_at": "2026-07-17T12:00:02.000Z"
                        }]
                    }))
                }
                ("GET", "/emails/email-reply") => Ok(json!({
                    "data": {
                        "id": "email-reply",
                        "from_email": "agent@example.com",
                        "to_email": "me@example.com",
                        "received_at": "2026-07-17T12:00:02.000Z",
                        "body_text": "Follow-up answer.",
                        "reply_to_sent_email_id": "sent-reply-1"
                    }
                })),
                other => panic!("unexpected request {other:?}: {request:?}"),
            }
        },
        || "2026-07-17T12:00:00.000Z".to_string(),
        || 0,
        |_| unreachable!("reply-mode match should not sleep"),
    )
    .expect("execute reply-mode chat");

    assert_eq!(calls[0].path, "/emails/search");
    assert_eq!(calls[1].path, "/emails/email%2Fparent/reply");
    assert_eq!(outcome.match_strategy, ChatMatchStrategy::Strict);
    assert_eq!(outcome.response_body, "Follow-up answer.");
}

#[test]
fn executes_chat_reply_mode_by_loading_exact_parent_before_sending_reply() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "--reply",
            "Follow up",
            "--reply-to-email-id",
            "email/parent",
            "--from",
            "me@example.com",
            "--json",
            "--timeout",
            "5",
        ]),
        None,
        "",
        "",
    )
    .expect("build exact reply-mode chat plan");
    let mut calls: Vec<ApiRequest> = Vec::new();

    let outcome = execute_chat_command_plan_with_runtime(
        &plan,
        |request| {
            calls.push(request.clone());
            match (request.method.as_str(), request.path.as_str()) {
                ("GET", "/emails/email%2Fparent") => Ok(json!({
                    "data": {
                        "id": "email/parent",
                        "from_email": "Agent <agent@example.com>",
                        "to_email": "me@example.com",
                        "subject": "Original question",
                        "received_at": "2026-07-17T11:59:00.000Z"
                    }
                })),
                ("POST", "/emails/email%2Fparent/reply") => {
                    assert_eq!(
                        request.body,
                        Some(json!({
                            "body_text": "Follow up",
                            "from": "me@example.com"
                        }))
                    );
                    Ok(json!({
                        "data": {
                            "id": "sent-reply-1",
                            "accepted": ["agent@example.com"],
                            "from": "me@example.com",
                            "status": "queued"
                        }
                    }))
                }
                ("GET", "/emails/search")
                    if request
                        .query
                        .get("reply_to_sent_email_id")
                        .map(String::as_str)
                        == Some("sent-reply-1") =>
                {
                    Ok(json!({
                        "data": [{
                            "id": "email-reply",
                            "status": "accepted",
                            "received_at": "2026-07-17T12:00:02.000Z"
                        }]
                    }))
                }
                ("GET", "/emails/email-reply") => Ok(json!({
                    "data": {
                        "id": "email-reply",
                        "from_email": "agent@example.com",
                        "to_email": "me@example.com",
                        "received_at": "2026-07-17T12:00:02.000Z",
                        "body_text": "Follow-up answer.",
                        "reply_to_sent_email_id": "sent-reply-1"
                    }
                })),
                other => panic!("unexpected request {other:?}: {request:?}"),
            }
        },
        || "2026-07-17T12:00:00.000Z".to_string(),
        || 0,
        |_| unreachable!("exact reply-mode match should not sleep"),
    )
    .expect("execute exact reply-mode chat");

    assert_eq!(calls[0].path, "/emails/email%2Fparent");
    assert_eq!(calls[1].path, "/emails/email%2Fparent/reply");
    assert_eq!(outcome.match_strategy, ChatMatchStrategy::Strict);
    assert_eq!(outcome.response_body, "Follow-up answer.");
}

#[test]
fn rejects_exact_chat_reply_parent_from_wrong_recipient_before_sending() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "--reply",
            "Follow up",
            "--reply-to-email-id",
            "email/parent",
            "--from",
            "me@example.com",
        ]),
        None,
        "",
        "",
    )
    .expect("build exact reply-mode chat plan");
    let mut calls: Vec<ApiRequest> = Vec::new();

    let error = execute_chat_command_plan_with_runtime(
        &plan,
        |request| {
            calls.push(request.clone());
            match (request.method.as_str(), request.path.as_str()) {
                ("GET", "/emails/email%2Fparent") => Ok(json!({
                    "data": {
                        "id": "email/parent",
                        "from_email": "other@example.com",
                        "to_email": "me@example.com",
                        "received_at": "2026-07-17T11:59:00.000Z"
                    }
                })),
                other => panic!("unexpected request {other:?}: {request:?}"),
            }
        },
        || "2026-07-17T12:00:00.000Z".to_string(),
        || 0,
        |_| unreachable!("wrong parent should fail before polling"),
    )
    .expect_err("wrong parent should fail");

    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].path, "/emails/email%2Fparent");
    assert!(error
        .to_string()
        .contains("Inbound email email/parent is from other@example.com, not agent@example.com"));
}

#[test]
fn resolves_chat_response_body_with_node_priority_order() {
    assert_eq!(
        resolve_chat_response_body(&json!({
            "body_text": "plain",
            "body_html": "<p>html</p>"
        })),
        primitive_rust::mail_commands::ChatResponseBody {
            body: "plain".to_string(),
            format: ChatResponseBodyFormat::Text,
        }
    );
    assert_eq!(
        resolve_chat_response_body(&json!({
            "body_text": "",
            "body_html": "<p>html</p>"
        })),
        primitive_rust::mail_commands::ChatResponseBody {
            body: "<p>html</p>".to_string(),
            format: ChatResponseBodyFormat::Html,
        }
    );
    assert_eq!(
        resolve_chat_response_body(&json!({ "body_text": "" })),
        primitive_rust::mail_commands::ChatResponseBody {
            body: String::new(),
            format: ChatResponseBodyFormat::Text,
        }
    );
    assert_eq!(
        resolve_chat_response_body(&json!({})),
        primitive_rust::mail_commands::ChatResponseBody {
            body: String::new(),
            format: ChatResponseBodyFormat::Empty,
        }
    );
}

#[test]
fn idempotent_replay_fetches_existing_threaded_reply_without_since_filter() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "Ping",
            "--from",
            "me@example.com",
            "--json",
            "--timeout",
            "5",
        ]),
        None,
        "",
        "",
    )
    .expect("build chat plan");
    let mut calls: Vec<ApiRequest> = Vec::new();

    let outcome = execute_chat_command_plan_with_runtime(
        &plan,
        |request| {
            calls.push(request.clone());
            match (request.method.as_str(), request.path.as_str()) {
                ("POST", "/send-mail") => Ok(json!({
                    "data": {
                        "id": "sent-1",
                        "accepted": ["agent@example.com"],
                        "from": "me@example.com",
                        "subject": "Ping",
                        "status": "queued",
                        "idempotent_replay": true
                    }
                })),
                ("GET", "/emails/search")
                    if request
                        .query
                        .get("reply_to_sent_email_id")
                        .map(String::as_str)
                        == Some("sent-1") =>
                {
                    assert!(!request.query.contains_key("date_from"));
                    Ok(json!({
                        "data": [
                            {
                                "id": "reply-older",
                                "status": "accepted",
                                "received_at": "2026-07-17T11:59:00.000Z"
                            },
                            {
                                "id": "reply-pending-newer",
                                "status": "pending",
                                "received_at": "2026-07-17T12:01:00.000Z"
                            },
                            {
                                "id": "reply-newest",
                                "status": "completed",
                                "received_at": "2026-07-17T12:00:30.000Z"
                            }
                        ]
                    }))
                }
                ("GET", "/emails/reply-newest") => Ok(json!({
                    "data": {
                        "id": "reply-newest",
                        "from_email": "agent@example.com",
                        "to_email": "me@example.com",
                        "subject": "Re: Ping",
                        "received_at": "2026-07-17T12:00:30.000Z",
                        "body_text": "Cached pong",
                        "reply_to_sent_email_id": "sent-1"
                    }
                })),
                other => panic!("unexpected request {other:?}: {request:?}"),
            }
        },
        || "2026-07-17T12:00:00.000Z".to_string(),
        || 0,
        |_| unreachable!("idempotent replay recovery should not poll"),
    )
    .expect("recover idempotent replay");

    assert_eq!(calls.len(), 3);
    assert_eq!(calls[0].path, "/send-mail");
    assert_eq!(calls[1].path, "/emails/search");
    assert_eq!(
        calls[1]
            .query
            .get("reply_to_sent_email_id")
            .map(String::as_str),
        Some("sent-1")
    );
    assert!(!calls[1].query.contains_key("date_from"));
    assert_eq!(calls[2].path, "/emails/reply-newest");
    assert_eq!(outcome.match_strategy, ChatMatchStrategy::Strict);
    assert_eq!(outcome.response_body, "Cached pong");

    let envelope = build_chat_json_envelope(&outcome);
    assert_eq!(envelope["response_body"], "Cached pong");
    assert_eq!(envelope["match"]["strategy"], "strict");

    let transcript = format_chat_transcript(&outcome);
    assert!(transcript.contains("Reply received"));
    assert!(transcript.contains("Cached pong"));
}

#[test]
fn idempotent_replay_without_existing_reply_errors_after_one_search() {
    let plan = build_chat_command_plan_from_args(
        &argv(&[
            "agent@example.com",
            "Ping",
            "--from",
            "me@example.com",
            "--timeout",
            "5",
        ]),
        None,
        "",
        "",
    )
    .expect("build chat plan");
    let mut calls: Vec<ApiRequest> = Vec::new();

    let error = execute_chat_command_plan_with_runtime(
        &plan,
        |request| {
            calls.push(request.clone());
            match (request.method.as_str(), request.path.as_str()) {
                ("POST", "/send-mail") => Ok(json!({
                    "data": {
                        "id": "sent-1",
                        "accepted": ["agent@example.com"],
                        "from": "me@example.com",
                        "subject": "Ping",
                        "status": "queued",
                        "idempotent_replay": true
                    }
                })),
                ("GET", "/emails/search")
                    if request
                        .query
                        .get("reply_to_sent_email_id")
                        .map(String::as_str)
                        == Some("sent-1") =>
                {
                    assert!(!request.query.contains_key("date_from"));
                    Ok(json!({
                        "data": [
                            {
                                "id": "reply-pending",
                                "status": "pending",
                                "received_at": "2026-07-17T12:00:30.000Z"
                            },
                            {
                                "id": "reply-rejected",
                                "status": "rejected",
                                "received_at": "2026-07-17T12:00:31.000Z"
                            }
                        ]
                    }))
                }
                other => panic!("unexpected request {other:?}: {request:?}"),
            }
        },
        || "2026-07-17T12:00:00.000Z".to_string(),
        || 0,
        |_| unreachable!("idempotent replay without a reply should not poll"),
    )
    .expect_err("idempotent replay without an existing reply should fail");

    assert!(error
        .to_string()
        .contains("no prior accepted reply was found"));
    assert_eq!(calls.len(), 2);
    assert_eq!(calls[0].path, "/send-mail");
    assert_eq!(calls[1].path, "/emails/search");
    assert!(!calls[1].query.contains_key("date_from"));
}
