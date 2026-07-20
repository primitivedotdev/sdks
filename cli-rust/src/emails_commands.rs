use crate::{client, config};
use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use reqwest::Method;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::io::IsTerminal;
use std::time::{Duration, Instant};

pub const DEFAULT_LATEST_LIMIT: u64 = 10;
pub const MAX_LATEST_LIMIT: u64 = 100;
pub const DEFAULT_EMAIL_LIST_LIMIT: u64 = 50;
pub const MAX_EMAIL_LIST_LIMIT: u64 = 100;
pub const MAX_EMAIL_LIST_WAIT_SECONDS: u64 = 30;
pub const DEFAULT_EMAIL_POLL_INTERVAL_SECONDS: u64 = 2;
pub const DEFAULT_EMAIL_POLL_PAGE_SIZE: u64 = 50;
pub const MAX_EMAIL_POLL_PAGE_SIZE: u64 = 100;
pub const DEFAULT_WAIT_TIMEOUT_SECONDS: u64 = 300;

pub const SUBJECT_DISPLAY_WIDTH: usize = 50;
pub const ADDRESS_DISPLAY_WIDTH: usize = 32;
pub const ID_DISPLAY_WIDTH_SHORT: usize = 8;
pub const ID_DISPLAY_WIDTH_FULL: usize = 36;
pub const RECEIVED_DISPLAY_WIDTH: usize = 19;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ApiRequest {
    pub method: String,
    pub path: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum EmailCommandKind {
    Latest,
    List,
    Get,
    Search,
    Wait,
    Watch,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EmailCommandAlias {
    pub alias: &'static str,
    pub target_operation_id: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmailCommandOutputMode {
    LatestTable,
    LatestJson,
    JsonData,
    JsonEnvelope,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailSingleCommandPlan {
    pub target_operation_id: &'static str,
    pub request: ApiRequest,
    pub output_mode: EmailCommandOutputMode,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailPollCommandPlan {
    pub target_operation_id: &'static str,
    pub plan: EmailPollPlan,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EmailCommandPlan {
    Single(EmailSingleCommandPlan),
    Poll(EmailPollCommandPlan),
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LatestShortcutInput {
    pub limit: Option<u64>,
    pub json: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LatestShortcutPlan {
    pub request: ApiRequest,
    pub output_mode: LatestOutputMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LatestOutputMode {
    Table,
    Json,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailSummary {
    pub id: String,
    pub received_at: Option<String>,
    pub sender: Option<String>,
    pub recipient: Option<String>,
    pub subject: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct EmailSearchRow {
    pub id: String,
    pub received_at: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recipient: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EmailPollFilters {
    pub body: Option<String>,
    pub domain: Option<String>,
    pub domain_id: Option<String>,
    pub from: Option<String>,
    pub has_attachment: Option<bool>,
    pub q: Option<String>,
    pub reply_to_sent_email_id: Option<String>,
    pub spam_score_gte: Option<i64>,
    pub spam_score_lt: Option<i64>,
    pub subject: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EmailPollFilterFlags {
    pub body: Option<String>,
    pub domain: Option<String>,
    pub domain_id: Option<String>,
    pub from: Option<String>,
    pub has_attachment: Option<bool>,
    pub q: Option<String>,
    pub reply_to_sent_email_id: Option<String>,
    pub spam_score_gte: Option<i64>,
    pub spam_score_lt: Option<i64>,
    pub subject: Option<String>,
    pub to: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WaitShortcutInput {
    pub filters: EmailPollFilters,
    pub include_existing: bool,
    pub interval_seconds: Option<u64>,
    pub number: Option<u64>,
    pub page_size: Option<u64>,
    pub since: Option<String>,
    pub table: bool,
    pub timeout_seconds: Option<u64>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct WatchShortcutInput {
    pub filters: EmailPollFilters,
    pub include_existing: bool,
    pub interval_seconds: Option<u64>,
    pub jsonl: bool,
    pub number: Option<u64>,
    pub page_size: Option<u64>,
    pub seconds: Option<u64>,
    pub since: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailPollPlan {
    pub request: ApiRequest,
    pub interval_seconds: u64,
    pub page_size: u64,
    pub deadline_seconds: Option<u64>,
    pub target_matches: Option<u64>,
    pub output_mode: EmailPollOutputMode,
    pub initial_cursor: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmailPollOutputMode {
    Table,
    Jsonl,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailPollPageDecision {
    pub next_cursor: Option<String>,
    pub cursor_advanced: bool,
    pub sleep_before_next_poll: bool,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

impl EmailSearchRow {
    pub fn summary(&self) -> EmailSummary {
        EmailSummary {
            id: self.id.clone(),
            received_at: Some(self.received_at.clone()),
            sender: self.sender.clone(),
            recipient: self.recipient.clone(),
            subject: self.subject.clone(),
        }
    }
}

pub fn email_command_aliases() -> &'static [EmailCommandAlias] {
    &[
        EmailCommandAlias {
            alias: "emails:latest",
            target_operation_id: "emails:list-emails",
        },
        EmailCommandAlias {
            alias: "emails:list",
            target_operation_id: "emails:list-emails",
        },
        EmailCommandAlias {
            alias: "emails:get",
            target_operation_id: "emails:get-email",
        },
        EmailCommandAlias {
            alias: "emails:search",
            target_operation_id: "emails:search-emails",
        },
        EmailCommandAlias {
            alias: "emails:wait",
            target_operation_id: "emails:search-emails",
        },
        EmailCommandAlias {
            alias: "emails:watch",
            target_operation_id: "emails:search-emails",
        },
    ]
}

pub fn email_command_target(command: &str) -> Option<&'static str> {
    email_command_kind(command).map(email_target_operation_id)
}

pub fn is_emails_friendly_command(command: &str) -> bool {
    matches!(
        command
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(":")
            .as_str(),
        "emails:get" | "emails:latest" | "emails:wait" | "emails:watch"
    )
}

pub fn build_email_command_plan(
    command: &str,
    args: &[String],
    now_iso: &str,
) -> Result<EmailCommandPlan> {
    match email_command_kind(command) {
        Some(kind) => build_email_command_plan_for_kind(kind, args, now_iso),
        None => Err(crate::usage_err!("Unknown emails command `{command}`")),
    }
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help();
        return Ok(());
    }
    let (subcommand, rest) = args
        .split_first()
        .ok_or_else(|| anyhow!("emails commands require a subcommand"))?;
    execute_command(&format!("emails:{subcommand}"), rest)
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    if is_help_request(args) {
        if let Some(kind) = email_command_kind(command) {
            print_command_help(kind);
            return Ok(());
        }
    }

    let Some(kind) = email_command_kind(command) else {
        return Err(crate::usage_err!("Unknown emails command `{command}`"));
    };

    let start = Instant::now();
    let now_iso = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let plan = build_email_command_plan_for_kind(kind, args, &now_iso)?;
    let auth = config::resolve_auth(&auth_flags(args)?)?;
    match plan {
        EmailCommandPlan::Single(plan) => {
            let envelope = execute_email_request(&plan.request, &auth)?;
            write_single_command_output(&plan, &envelope)?;
        }
        EmailCommandPlan::Poll(plan) => {
            run_poll_command(&plan.plan, &auth)?;
        }
    }
    if has_time_flag(args) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

fn build_email_command_plan_for_kind(
    kind: EmailCommandKind,
    args: &[String],
    now_iso: &str,
) -> Result<EmailCommandPlan> {
    match kind {
        EmailCommandKind::Latest => build_latest_request_from_args(args).map(wrap_single),
        EmailCommandKind::List => build_emails_list_request_from_args(args).map(wrap_single),
        EmailCommandKind::Get => build_emails_get_request_from_args(args).map(wrap_single),
        EmailCommandKind::Search => build_emails_search_request_from_args(args).map(wrap_single),
        EmailCommandKind::Wait => build_wait_poll_plan_from_args(args, now_iso).map(wrap_poll),
        EmailCommandKind::Watch => build_watch_poll_plan_from_args(args, now_iso).map(wrap_poll),
    }
}

pub fn leaf_help(command: &str) -> Option<String> {
    email_command_kind(command).and_then(help_for_kind)
}

fn print_command_help(kind: EmailCommandKind) {
    if let Some(help) = help_for_kind(kind) {
        print!("{help}");
    } else {
        print_help();
    }
}

fn help_for_kind(kind: EmailCommandKind) -> Option<String> {
    match kind {
        EmailCommandKind::Latest => Some(latest_help()),
        EmailCommandKind::Wait => Some(wait_help()),
        EmailCommandKind::Watch => Some(watch_help()),
        _ => None,
    }
}

fn latest_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
Show the most recent inbound emails as a compact table

USAGE
  {bin} emails latest [--api-key <value>] [--limit <value>] [--json] [--time]

FLAGS
  --api-key <value>  Primitive API key override.
  --limit <value>    Number of rows to print (1-{MAX_LATEST_LIMIT}, default {DEFAULT_LATEST_LIMIT}).
  --json             Print the raw response envelope as JSON on stdout.
  --time             Print the wall-clock duration to stderr after completion.
"
    )
}

fn wait_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
Wait for matching inbound emails

USAGE
  {bin} emails wait [--api-key <value>] [--body <value>] [--domain <value>] [--domain-id <value>]
  [--from <value>] [--has-attachment] [--include-existing] [--interval <value>] [-n <value>]
  [--page-size <value>] [--q <value>] [--reply-to-sent-email-id <value>] [--since <value>]
  [--spam-score-gte <value>] [--spam-score-lt <value>] [--subject <value>] [--table]
  [--timeout <value>] [--to <value>]

FLAGS
  --api-key <value>                 Primitive API key override.
  --body <value>                    Full-text body filter.
  --domain <value>                  Filter by inbound email domain.
  --domain-id <value>               Filter by domain UUID.
  --from <value>                    Filter by sender address or domain.
  --has-attachment                  Only match emails with one or more attachments.
  --include-existing                Start from existing matching emails.
  --interval <value>                Seconds to wait between empty polls (default {DEFAULT_EMAIL_POLL_INTERVAL_SECONDS}).
  -n, --number <value>              Exit after this many matching emails (default 1).
  --page-size <value>               Emails to fetch per poll (1-{MAX_EMAIL_POLL_PAGE_SIZE}, default {DEFAULT_EMAIL_POLL_PAGE_SIZE}).
  --q <value>                       Full-text search DSL query.
  --reply-to-sent-email-id <value>  Filter to threaded replies for an outbound send id.
  --since <value>                   Only match emails received on or after this date/time.
  --spam-score-gte <value>          Only match emails with spam score greater than or equal to this value.
  --spam-score-lt <value>           Only match emails with spam score below this value.
  --subject <value>                 Full-text subject filter.
  --table                           Print a human-readable table instead of JSONL.
  --timeout <value>                 Seconds to wait before exiting nonzero; 0 waits forever (default {DEFAULT_WAIT_TIMEOUT_SECONDS}).
  --to <value>                      Filter by recipient address or domain.
"
    )
}

fn watch_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
Watch inbound emails with filters

USAGE
  {bin} emails watch [--api-key <value>] [--body <value>] [--domain <value>] [--domain-id <value>]
  [--from <value>] [--has-attachment] [--include-existing] [--interval <value>] [--jsonl]
  [--number <value>] [--page-size <value>] [--q <value>] [--seconds <value>] [--since <value>]
  [--spam-score-gte <value>] [--spam-score-lt <value>] [--subject <value>] [--to <value>]

FLAGS
  --api-key <value>         Primitive API key override.
  --body <value>            Full-text body filter.
  --domain <value>          Filter by inbound email domain.
  --domain-id <value>       Filter by domain UUID.
  --from <value>            Filter by sender address or domain.
  --has-attachment          Only show emails with one or more attachments.
  --include-existing        Start from existing matching emails.
  --interval <value>        Seconds to wait between empty polls (default {DEFAULT_EMAIL_POLL_INTERVAL_SECONDS}).
  --jsonl                   Print each email as one JSON object per line.
  --number <value>          Exit after printing this many matching emails.
  --page-size <value>       Emails to fetch per poll (1-{MAX_EMAIL_POLL_PAGE_SIZE}, default {DEFAULT_EMAIL_POLL_PAGE_SIZE}).
  --q <value>               Full-text search DSL query.
  --seconds <value>         Exit after this many seconds.
  --since <value>           Only show emails received on or after this date/time.
  --spam-score-gte <value>  Only show emails with spam score greater than or equal to this value.
  --spam-score-lt <value>   Only show emails with spam score below this value.
  --subject <value>         Full-text subject filter.
  --to <value>              Filter by recipient address or domain.
"
    )
}

pub fn build_latest_request_from_args(args: &[String]) -> Result<EmailSingleCommandPlan> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url", "limit"],
        &["json", "time"],
        &[],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let shortcut = build_latest_plan(&LatestShortcutInput {
        limit: optional_u64_flag(&parsed, "limit")?,
        json: parsed.bool_flags.get("json") == Some(&true),
    })?;
    Ok(EmailSingleCommandPlan {
        target_operation_id: email_target_operation_id(EmailCommandKind::Latest),
        request: shortcut.request,
        output_mode: match shortcut.output_mode {
            LatestOutputMode::Table => EmailCommandOutputMode::LatestTable,
            LatestOutputMode::Json => EmailCommandOutputMode::LatestJson,
        },
    })
}

pub fn build_emails_list_request_from_args(args: &[String]) -> Result<EmailSingleCommandPlan> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "cursor",
            "limit",
            "domain-id",
            "status",
            "search",
            "date-from",
            "date-to",
            "since",
            "wait",
        ],
        &["json", "envelope", "time"],
        &[],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let limit = optional_u64_flag(&parsed, "limit")?.unwrap_or(DEFAULT_EMAIL_LIST_LIMIT);
    ensure_range("--limit", limit, 1, MAX_EMAIL_LIST_LIMIT)?;
    let wait = optional_u64_flag(&parsed, "wait")?;
    if let Some(wait) = wait {
        ensure_range("--wait", wait, 0, MAX_EMAIL_LIST_WAIT_SECONDS)?;
    }

    let mut query = BTreeMap::from([("limit".to_string(), limit.to_string())]);
    insert_optional_query_flag(&mut query, &parsed, "cursor", "cursor");
    insert_optional_query_flag(&mut query, &parsed, "domain-id", "domain_id");
    insert_optional_query_flag(&mut query, &parsed, "status", "status");
    insert_optional_query_flag(&mut query, &parsed, "search", "search");
    insert_optional_query_flag(&mut query, &parsed, "date-from", "date_from");
    insert_optional_query_flag(&mut query, &parsed, "date-to", "date_to");
    insert_optional_query_flag(&mut query, &parsed, "since", "since");
    if let Some(wait) = wait {
        query.insert("wait".to_string(), wait.to_string());
    }

    Ok(EmailSingleCommandPlan {
        target_operation_id: email_target_operation_id(EmailCommandKind::List),
        request: ApiRequest {
            method: "GET".to_string(),
            path: "/emails".to_string(),
            query,
            body: None,
        },
        output_mode: json_output_mode(&parsed),
    })
}

pub fn build_emails_get_request_from_args(args: &[String]) -> Result<EmailSingleCommandPlan> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url", "id"],
        &["json", "envelope", "time"],
        &[],
        &[],
    )?;
    let id = single_id(&parsed, "emails get requires an email id")?;
    Ok(EmailSingleCommandPlan {
        target_operation_id: email_target_operation_id(EmailCommandKind::Get),
        request: ApiRequest {
            method: "GET".to_string(),
            path: format!("/emails/{}", urlencoding::encode(&id)),
            query: BTreeMap::new(),
            body: None,
        },
        output_mode: json_output_mode(&parsed),
    })
}

pub fn build_emails_search_request_from_args(args: &[String]) -> Result<EmailSingleCommandPlan> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "q",
            "from",
            "to",
            "subject",
            "body",
            "domain",
            "domain-id",
            "reply-to-sent-email-id",
            "status",
            "date-from",
            "date-to",
            "spam-score-lt",
            "spam-score-gte",
            "sort",
            "cursor",
            "limit",
            "snippet",
            "include-facets",
        ],
        &["has-attachment", "json", "envelope", "time"],
        &[],
        &[],
    )?;
    let positional_q = optional_single_positional(&parsed)?;
    let flag_q = flag_one(&parsed, "q");
    if positional_q.is_some() && flag_q.is_some() {
        return Err(anyhow!("Use either a positional query or --q, not both."));
    }
    validate_optional_enum_flag(
        &parsed,
        "sort",
        &["relevance", "received_at_desc", "received_at_asc"],
    )?;
    validate_optional_enum_flag(&parsed, "snippet", &["true", "false"])?;
    validate_optional_enum_flag(&parsed, "include-facets", &["true", "false"])?;
    validate_optional_number_flag(&parsed, "spam-score-lt")?;
    validate_optional_number_flag(&parsed, "spam-score-gte")?;
    let limit = optional_u64_flag(&parsed, "limit")?.unwrap_or(DEFAULT_EMAIL_LIST_LIMIT);
    ensure_range("--limit", limit, 1, MAX_EMAIL_LIST_LIMIT)?;

    let q = combine_q(
        flag_q.or(positional_q).as_deref(),
        flag_one(&parsed, "domain").as_deref(),
    );
    let mut query = BTreeMap::from([
        (
            "include_facets".to_string(),
            flag_one(&parsed, "include-facets").unwrap_or_else(|| "true".to_string()),
        ),
        ("limit".to_string(), limit.to_string()),
        (
            "snippet".to_string(),
            flag_one(&parsed, "snippet").unwrap_or_else(|| "true".to_string()),
        ),
    ]);
    insert_optional_string(&mut query, "q", q.as_deref());
    insert_optional_query_flag(&mut query, &parsed, "from", "from");
    insert_optional_query_flag(&mut query, &parsed, "to", "to");
    insert_optional_query_flag(&mut query, &parsed, "subject", "subject");
    insert_optional_query_flag(&mut query, &parsed, "body", "body");
    insert_optional_query_flag(&mut query, &parsed, "domain-id", "domain_id");
    insert_optional_query_flag(
        &mut query,
        &parsed,
        "reply-to-sent-email-id",
        "reply_to_sent_email_id",
    );
    insert_optional_query_flag(&mut query, &parsed, "status", "status");
    insert_optional_query_flag(&mut query, &parsed, "date-from", "date_from");
    insert_optional_query_flag(&mut query, &parsed, "date-to", "date_to");
    if let Some(has_attachment) = parsed.bool_flags.get("has-attachment") {
        query.insert("has_attachment".to_string(), has_attachment.to_string());
    }
    insert_optional_query_flag(&mut query, &parsed, "spam-score-lt", "spam_score_lt");
    insert_optional_query_flag(&mut query, &parsed, "spam-score-gte", "spam_score_gte");
    insert_optional_query_flag(&mut query, &parsed, "sort", "sort");
    insert_optional_query_flag(&mut query, &parsed, "cursor", "cursor");

    Ok(EmailSingleCommandPlan {
        target_operation_id: email_target_operation_id(EmailCommandKind::Search),
        request: ApiRequest {
            method: "GET".to_string(),
            path: "/emails/search".to_string(),
            query,
            body: None,
        },
        output_mode: json_output_mode(&parsed),
    })
}

pub fn build_wait_poll_plan_from_args(
    args: &[String],
    now_iso: &str,
) -> Result<EmailPollCommandPlan> {
    let parsed = parse_email_poll_args(args, true)?;
    reject_positionals(&parsed)?;
    let input = WaitShortcutInput {
        filters: poll_filters_from_parsed(&parsed)?,
        include_existing: parsed.bool_flags.get("include-existing") == Some(&true),
        interval_seconds: optional_u64_flag(&parsed, "interval")?,
        number: optional_u64_flag(&parsed, "number")?,
        page_size: optional_u64_flag(&parsed, "page-size")?,
        since: flag_one(&parsed, "since"),
        table: parsed.bool_flags.get("table") == Some(&true),
        timeout_seconds: optional_u64_flag(&parsed, "timeout")?,
    };
    Ok(EmailPollCommandPlan {
        target_operation_id: email_target_operation_id(EmailCommandKind::Wait),
        plan: build_wait_poll_plan(&input, now_iso)?,
    })
}

pub fn build_watch_poll_plan_from_args(
    args: &[String],
    now_iso: &str,
) -> Result<EmailPollCommandPlan> {
    let parsed = parse_email_poll_args(args, false)?;
    reject_positionals(&parsed)?;
    let input = WatchShortcutInput {
        filters: poll_filters_from_parsed(&parsed)?,
        include_existing: parsed.bool_flags.get("include-existing") == Some(&true),
        interval_seconds: optional_u64_flag(&parsed, "interval")?,
        jsonl: parsed.bool_flags.get("jsonl") == Some(&true),
        number: optional_u64_flag(&parsed, "number")?,
        page_size: optional_u64_flag(&parsed, "page-size")?,
        seconds: optional_u64_flag(&parsed, "seconds")?,
        since: flag_one(&parsed, "since"),
    };
    Ok(EmailPollCommandPlan {
        target_operation_id: email_target_operation_id(EmailCommandKind::Watch),
        plan: build_watch_poll_plan(&input, now_iso)?,
    })
}

pub fn auth_flags(args: &[String]) -> Result<BTreeMap<String, String>> {
    let mut flags = BTreeMap::new();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        let Some(raw) = arg.strip_prefix("--") else {
            index += 1;
            continue;
        };
        if raw.starts_with("no-") {
            index += 1;
            continue;
        }
        let (name, inline_value) = raw
            .split_once('=')
            .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));
        if matches!(name, "api-key" | "api-base-url") {
            let value = if let Some(value) = inline_value {
                value
            } else {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| anyhow!("Missing value for --{name}"))?;
                if value.starts_with("--") {
                    return Err(anyhow!("Missing value for --{name}"));
                }
                value.clone()
            };
            flags.insert(name.to_string(), value);
        }
        index += 1;
    }
    Ok(flags)
}

pub fn has_time_flag(args: &[String]) -> bool {
    args.iter()
        .rev()
        .find_map(|arg| {
            if arg == "--time" || arg == "--time=true" {
                Some(true)
            } else if arg == "--no-time" || arg == "--time=false" {
                Some(false)
            } else {
                None
            }
        })
        .unwrap_or(false)
}

pub fn build_latest_plan(input: &LatestShortcutInput) -> Result<LatestShortcutPlan> {
    let limit = input.limit.unwrap_or(DEFAULT_LATEST_LIMIT);
    ensure_range("--limit", limit, 1, MAX_LATEST_LIMIT)?;
    Ok(LatestShortcutPlan {
        request: ApiRequest {
            method: "GET".to_string(),
            path: "/emails".to_string(),
            query: BTreeMap::from([("limit".to_string(), limit.to_string())]),
            body: None,
        },
        output_mode: if input.json {
            LatestOutputMode::Json
        } else {
            LatestOutputMode::Table
        },
    })
}

pub fn truncate(value: &str, width: usize) -> String {
    if value.chars().count() <= width {
        return pad_end(value, width);
    }
    let prefix: String = value.chars().take(width.saturating_sub(3)).collect();
    format!("{prefix}...")
}

pub fn format_received_at(value: Option<&str>) -> String {
    let Some(value) = value.filter(|value| !value.is_empty()) else {
        return pad_end("-", RECEIVED_DISPLAY_WIDTH);
    };
    match parse_timestamp(value) {
        Ok(parsed) => parsed.format("%Y-%m-%d %H:%M:%S").to_string(),
        Err(_) => pad_end(value, RECEIVED_DISPLAY_WIDTH),
    }
}

pub fn pick_id_width(is_tty: bool) -> usize {
    if is_tty {
        ID_DISPLAY_WIDTH_SHORT
    } else {
        ID_DISPLAY_WIDTH_FULL
    }
}

pub fn format_header(id_width: usize) -> String {
    format!(
        "{}  {}  {}  {}  SUBJECT",
        pad_end("ID", id_width),
        pad_end("RECEIVED (UTC)", RECEIVED_DISPLAY_WIDTH),
        pad_end("FROM", ADDRESS_DISPLAY_WIDTH),
        pad_end("TO", ADDRESS_DISPLAY_WIDTH)
    )
}

pub fn format_row(email: &EmailSummary, id_width: usize) -> String {
    let id_prefix: String = email.id.chars().take(id_width).collect();
    let id = truncate(&id_prefix, id_width);
    let received = format_received_at(email.received_at.as_deref());
    let from = truncate(
        email.sender.as_deref().unwrap_or_default(),
        ADDRESS_DISPLAY_WIDTH,
    );
    let to = truncate(
        email.recipient.as_deref().unwrap_or_default(),
        ADDRESS_DISPLAY_WIDTH,
    );
    let subject = collapse_whitespace(email.subject.as_deref().unwrap_or_default());
    let subject = truncate(&subject, SUBJECT_DISPLAY_WIDTH);
    format!("{id}  {received}  {from}  {to}  {subject}")
}

pub fn quote_dsl_value(value: &str) -> String {
    if !value.is_empty()
        && value
            .chars()
            .all(|character| !character.is_whitespace() && character != '"')
    {
        return value.to_string();
    }
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

pub fn filters_from_flags(flags: &EmailPollFilterFlags) -> EmailPollFilters {
    EmailPollFilters {
        body: flags.body.clone(),
        domain: flags.domain.clone(),
        domain_id: flags.domain_id.clone(),
        from: flags.from.clone(),
        has_attachment: flags.has_attachment,
        q: flags.q.clone(),
        reply_to_sent_email_id: flags.reply_to_sent_email_id.clone(),
        spam_score_gte: flags.spam_score_gte,
        spam_score_lt: flags.spam_score_lt,
        subject: flags.subject.clone(),
        to: flags.to.clone(),
    }
}

pub fn normalize_iso_date(value: &str, label: &str) -> Result<String> {
    parse_timestamp(value)
        .map(|timestamp| timestamp.to_rfc3339_opts(SecondsFormat::Millis, true))
        .map_err(|_| anyhow!("{label} must be a valid date or ISO-8601 timestamp."))
}

pub fn since_from_flags(
    include_existing: bool,
    since: Option<&str>,
    now_iso: &str,
) -> Result<Option<String>> {
    if let Some(since) = since {
        return normalize_iso_date(since, "--since").map(Some);
    }
    if include_existing {
        return Ok(None);
    }
    normalize_iso_date(now_iso, "now").map(Some)
}

pub fn build_email_search_query(
    filters: &EmailPollFilters,
    page_size: u64,
    since: Option<&str>,
    cursor: Option<&str>,
) -> BTreeMap<String, String> {
    let mut query = BTreeMap::from([
        ("include_facets".to_string(), "false".to_string()),
        ("limit".to_string(), page_size.to_string()),
        ("snippet".to_string(), "false".to_string()),
        ("sort".to_string(), "received_at_asc".to_string()),
    ]);

    if let Some(q) = combine_q(filters.q.as_deref(), filters.domain.as_deref()) {
        query.insert("q".to_string(), q);
    }
    insert_optional_string(&mut query, "body", filters.body.as_deref());
    insert_optional_string(&mut query, "domain_id", filters.domain_id.as_deref());
    insert_optional_string(&mut query, "from", filters.from.as_deref());
    if let Some(has_attachment) = filters.has_attachment {
        query.insert("has_attachment".to_string(), has_attachment.to_string());
    }
    if let Some(spam_score_gte) = filters.spam_score_gte {
        query.insert("spam_score_gte".to_string(), spam_score_gte.to_string());
    }
    if let Some(spam_score_lt) = filters.spam_score_lt {
        query.insert("spam_score_lt".to_string(), spam_score_lt.to_string());
    }
    insert_optional_string(
        &mut query,
        "reply_to_sent_email_id",
        filters.reply_to_sent_email_id.as_deref(),
    );
    insert_optional_string(&mut query, "subject", filters.subject.as_deref());
    insert_optional_string(&mut query, "to", filters.to.as_deref());
    insert_optional_string(&mut query, "date_from", since);
    insert_optional_string(&mut query, "cursor", cursor);

    query
}

pub fn build_email_search_request(
    filters: &EmailPollFilters,
    page_size: u64,
    since: Option<&str>,
    cursor: Option<&str>,
) -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/emails/search".to_string(),
        query: build_email_search_query(filters, page_size, since, cursor),
        body: None,
    }
}

pub fn build_wait_poll_plan(input: &WaitShortcutInput, now_iso: &str) -> Result<EmailPollPlan> {
    let interval_seconds = input
        .interval_seconds
        .unwrap_or(DEFAULT_EMAIL_POLL_INTERVAL_SECONDS);
    ensure_min("--interval", interval_seconds, 1)?;
    let page_size = input.page_size.unwrap_or(DEFAULT_EMAIL_POLL_PAGE_SIZE);
    ensure_range("--page-size", page_size, 1, MAX_EMAIL_POLL_PAGE_SIZE)?;
    let number = input.number.unwrap_or(1);
    ensure_min("--number", number, 1)?;
    let timeout_seconds = input
        .timeout_seconds
        .unwrap_or(DEFAULT_WAIT_TIMEOUT_SECONDS);
    let since = since_from_flags(input.include_existing, input.since.as_deref(), now_iso)?;

    Ok(EmailPollPlan {
        request: build_email_search_request(&input.filters, page_size, since.as_deref(), None),
        interval_seconds,
        page_size,
        deadline_seconds: (timeout_seconds != 0).then_some(timeout_seconds),
        target_matches: Some(number),
        output_mode: if input.table {
            EmailPollOutputMode::Table
        } else {
            EmailPollOutputMode::Jsonl
        },
        initial_cursor: None,
    })
}

pub fn build_watch_poll_plan(input: &WatchShortcutInput, now_iso: &str) -> Result<EmailPollPlan> {
    let interval_seconds = input
        .interval_seconds
        .unwrap_or(DEFAULT_EMAIL_POLL_INTERVAL_SECONDS);
    ensure_min("--interval", interval_seconds, 1)?;
    let page_size = input.page_size.unwrap_or(DEFAULT_EMAIL_POLL_PAGE_SIZE);
    ensure_range("--page-size", page_size, 1, MAX_EMAIL_POLL_PAGE_SIZE)?;
    if let Some(number) = input.number {
        ensure_min("--number", number, 1)?;
    }
    if let Some(seconds) = input.seconds {
        ensure_min("--seconds", seconds, 1)?;
    }
    let since = since_from_flags(input.include_existing, input.since.as_deref(), now_iso)?;

    Ok(EmailPollPlan {
        request: build_email_search_request(&input.filters, page_size, since.as_deref(), None),
        interval_seconds,
        page_size,
        deadline_seconds: input.seconds,
        target_matches: input.number,
        output_mode: if input.jsonl {
            EmailPollOutputMode::Jsonl
        } else {
            EmailPollOutputMode::Table
        },
        initial_cursor: None,
    })
}

pub fn encode_received_at_search_cursor(email: &EmailSearchRow) -> Result<String> {
    let received_at = normalize_iso_date(&email.received_at, "received_at")?;
    Ok(base64url_encode(
        format!("r|{received_at}|{}", email.id).as_bytes(),
    ))
}

pub fn cursor_from_rows(rows: &[EmailSearchRow]) -> Result<Option<String>> {
    rows.last()
        .map(encode_received_at_search_cursor)
        .transpose()
}

pub fn cursor_from_accepted_rows(rows: &[EmailSearchRow]) -> Result<Option<String>> {
    rows.iter()
        .rev()
        .find(|row| is_accepted_status(&row.status))
        .map(encode_received_at_search_cursor)
        .transpose()
}

pub fn collect_new_accepted_emails(
    rows: &[EmailSearchRow],
    seen_ids: &mut BTreeSet<String>,
) -> Vec<EmailSearchRow> {
    let mut fresh = Vec::new();
    for row in rows {
        if !is_accepted_status(&row.status) || seen_ids.contains(&row.id) {
            continue;
        }
        seen_ids.insert(row.id.clone());
        fresh.push(row.clone());
    }
    fresh
}

pub fn decide_email_poll_page(
    current_cursor: Option<&str>,
    rows: &[EmailSearchRow],
) -> Result<EmailPollPageDecision> {
    let next_cursor = cursor_from_accepted_rows(rows)?;
    let cursor_advanced = next_cursor
        .as_deref()
        .is_some_and(|next_cursor| Some(next_cursor) != current_cursor);
    Ok(EmailPollPageDecision {
        next_cursor,
        cursor_advanced,
        sleep_before_next_poll: !cursor_advanced,
    })
}

pub fn format_poll_row(
    row: &EmailSearchRow,
    output_mode: EmailPollOutputMode,
    id_width: usize,
) -> Result<String> {
    match output_mode {
        EmailPollOutputMode::Table => Ok(format_row(&row.summary(), id_width)),
        EmailPollOutputMode::Jsonl => Ok(serde_json::to_string(row)?),
    }
}

pub fn format_wait_timeout_message(target: u64, matched: u64) -> String {
    format!(
        "Timed out waiting for {target} matching email{}; received {matched}.",
        if target == 1 { "" } else { "s" }
    )
}

fn wrap_single(plan: EmailSingleCommandPlan) -> EmailCommandPlan {
    EmailCommandPlan::Single(plan)
}

fn wrap_poll(plan: EmailPollCommandPlan) -> EmailCommandPlan {
    EmailCommandPlan::Poll(plan)
}

fn email_command_kind(command: &str) -> Option<EmailCommandKind> {
    let normalized = command.split_whitespace().collect::<Vec<_>>().join(":");
    let command = normalized
        .strip_prefix("emails:")
        .unwrap_or(normalized.as_str());
    match command {
        "latest" => Some(EmailCommandKind::Latest),
        "list" | "list-emails" => Some(EmailCommandKind::List),
        "get" | "get-email" => Some(EmailCommandKind::Get),
        "search" | "search-emails" => Some(EmailCommandKind::Search),
        "wait" => Some(EmailCommandKind::Wait),
        "watch" => Some(EmailCommandKind::Watch),
        _ => None,
    }
}

fn email_target_operation_id(kind: EmailCommandKind) -> &'static str {
    match kind {
        EmailCommandKind::Latest | EmailCommandKind::List => "emails:list-emails",
        EmailCommandKind::Get => "emails:get-email",
        EmailCommandKind::Search | EmailCommandKind::Wait | EmailCommandKind::Watch => {
            "emails:search-emails"
        }
    }
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive Rust CLI emails commands:");
    println!("  {bin} emails latest [--limit <n>] [--json]");
    println!("  {bin} emails list [flags]");
    println!("  {bin} emails get <id>");
    println!("  {bin} emails search [query] [flags]");
    println!("  {bin} emails download-raw --id <id> --output <path>");
    println!("  {bin} emails wait [filters]");
    println!("  {bin} emails watch [filters]");
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
}

fn execute_email_request(request: &ApiRequest, auth: &config::ResolvedAuth) -> Result<Value> {
    let http = client::http_client()?;
    let mut url = format!(
        "{}{}",
        auth.api_base_url.trim_end_matches('/'),
        request.path
    );
    if !request.query.is_empty() {
        let query = request
            .query
            .iter()
            .map(|(key, value)| {
                format!(
                    "{}={}",
                    urlencoding::encode(key),
                    urlencoding::encode(value)
                )
            })
            .collect::<Vec<_>>()
            .join("&");
        url.push('?');
        url.push_str(&query);
    }
    let method: Method = request.method.parse()?;
    let mut builder = http.request(method, url);
    builder = client::apply_headers(builder, auth, true, &[], request.body.is_some())?;
    if let Some(body) = &request.body {
        builder = builder.json(body);
    }
    let response = builder.send()?;
    let (status, bytes, json) = client::parse_response(response)?;
    if status >= 400 {
        return Err(client::error_for_status(status, json.as_ref(), &bytes));
    }
    Ok(json.unwrap_or(Value::Null))
}

fn write_single_command_output(plan: &EmailSingleCommandPlan, envelope: &Value) -> Result<()> {
    match plan.output_mode {
        EmailCommandOutputMode::LatestTable => write_latest_table(envelope),
        EmailCommandOutputMode::LatestJson | EmailCommandOutputMode::JsonEnvelope => {
            println!("{}", serde_json::to_string_pretty(envelope)?);
            Ok(())
        }
        EmailCommandOutputMode::JsonData => {
            let data = envelope.get("data").cloned().unwrap_or(Value::Null);
            println!("{}", serde_json::to_string_pretty(&data)?);
            Ok(())
        }
    }
}

fn write_latest_table(envelope: &Value) -> Result<()> {
    let rows = envelope
        .get("data")
        .and_then(Value::as_array)
        .map(|rows| {
            rows.iter()
                .map(email_summary_from_value)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if rows.is_empty() {
        eprintln!(
            "No inbound emails yet. Send an email to one of your verified domains to populate this list."
        );
        return Ok(());
    }
    let id_width = pick_id_width(std::io::stdout().is_terminal());
    eprintln!("{}", format_header(id_width));
    for row in rows {
        println!("{}", format_row(&row, id_width));
    }
    Ok(())
}

fn run_poll_command(plan: &EmailPollPlan, auth: &config::ResolvedAuth) -> Result<()> {
    let id_width = pick_id_width(std::io::stdout().is_terminal());
    let deadline = plan
        .deadline_seconds
        .map(|seconds| Instant::now() + Duration::from_secs(seconds));
    let mut seen_ids = BTreeSet::new();
    let mut cursor = plan.initial_cursor.clone();
    let mut matched = 0_u64;
    let mut header_printed = false;

    loop {
        if deadline.is_some_and(|deadline| Instant::now() >= deadline) {
            break;
        }

        let mut request = plan.request.clone();
        if let Some(cursor) = &cursor {
            request.query.insert("cursor".to_string(), cursor.clone());
        }
        let envelope = execute_email_request(&request, auth)?;
        let rows = search_rows_from_envelope(&envelope);
        let decision = decide_email_poll_page(cursor.as_deref(), &rows)?;
        if let Some(next_cursor) = decision.next_cursor {
            cursor = Some(next_cursor);
        }

        for email in collect_new_accepted_emails(&rows, &mut seen_ids) {
            if plan.output_mode == EmailPollOutputMode::Table && !header_printed {
                eprintln!("{}", format_header(id_width));
                header_printed = true;
            }
            println!("{}", format_poll_row(&email, plan.output_mode, id_width)?);
            matched += 1;
            if plan.target_matches.is_some_and(|target| matched >= target) {
                return Ok(());
            }
        }

        if decision.cursor_advanced {
            continue;
        }
        if deadline.is_some_and(|deadline| Instant::now() >= deadline) {
            break;
        }
        std::thread::sleep(Duration::from_secs(plan.interval_seconds));
    }

    if let Some(target) = plan.target_matches {
        if matched < target {
            return Err(anyhow!("{}", format_wait_timeout_message(target, matched)));
        }
    }
    Ok(())
}

fn email_summary_from_value(value: &Value) -> EmailSummary {
    EmailSummary {
        id: value
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        received_at: value
            .get("received_at")
            .and_then(Value::as_str)
            .map(str::to_string),
        sender: value
            .get("sender")
            .or_else(|| value.get("from_email"))
            .and_then(Value::as_str)
            .map(str::to_string),
        recipient: value
            .get("recipient")
            .or_else(|| value.get("to_email"))
            .and_then(Value::as_str)
            .map(str::to_string),
        subject: value
            .get("subject")
            .and_then(Value::as_str)
            .map(str::to_string),
    }
}

fn search_rows_from_envelope(envelope: &Value) -> Vec<EmailSearchRow> {
    envelope
        .get("data")
        .and_then(Value::as_array)
        .map(|rows| {
            rows.iter()
                .filter_map(email_search_row_from_value)
                .collect()
        })
        .unwrap_or_default()
}

fn email_search_row_from_value(value: &Value) -> Option<EmailSearchRow> {
    Some(EmailSearchRow {
        id: value.get("id")?.as_str()?.to_string(),
        received_at: value.get("received_at")?.as_str()?.to_string(),
        status: value.get("status")?.as_str()?.to_string(),
        sender: value
            .get("sender")
            .or_else(|| value.get("from_email"))
            .and_then(Value::as_str)
            .map(str::to_string),
        recipient: value
            .get("recipient")
            .or_else(|| value.get("to_email"))
            .and_then(Value::as_str)
            .map(str::to_string),
        subject: value
            .get("subject")
            .and_then(Value::as_str)
            .map(str::to_string),
    })
}

fn parse_email_poll_args(args: &[String], wait: bool) -> Result<ParsedArgs> {
    let mut value_flags = vec![
        "api-key",
        "api-base-url",
        "body",
        "domain",
        "domain-id",
        "from",
        "interval",
        "number",
        "page-size",
        "q",
        "since",
        "spam-score-gte",
        "spam-score-lt",
        "subject",
        "to",
    ];
    let mut bool_flags = vec!["has-attachment", "include-existing", "time"];
    let short_value_flags = if wait {
        &[("n", "number")][..]
    } else {
        &[][..]
    };
    if wait {
        value_flags.extend(["reply-to-sent-email-id", "timeout"]);
        bool_flags.push("table");
    } else {
        value_flags.push("seconds");
        bool_flags.push("jsonl");
    }
    parse_args(args, &value_flags, &bool_flags, &[], short_value_flags)
}

fn poll_filters_from_parsed(parsed: &ParsedArgs) -> Result<EmailPollFilters> {
    Ok(filters_from_flags(&EmailPollFilterFlags {
        body: flag_one(parsed, "body"),
        domain: flag_one(parsed, "domain"),
        domain_id: flag_one(parsed, "domain-id"),
        from: flag_one(parsed, "from"),
        has_attachment: parsed.bool_flags.get("has-attachment").copied(),
        q: flag_one(parsed, "q"),
        reply_to_sent_email_id: flag_one(parsed, "reply-to-sent-email-id"),
        spam_score_gte: optional_i64_flag(parsed, "spam-score-gte")?,
        spam_score_lt: optional_i64_flag(parsed, "spam-score-lt")?,
        subject: flag_one(parsed, "subject"),
        to: flag_one(parsed, "to"),
    }))
}

fn json_output_mode(parsed: &ParsedArgs) -> EmailCommandOutputMode {
    if parsed.bool_flags.get("envelope") == Some(&true) {
        EmailCommandOutputMode::JsonEnvelope
    } else {
        EmailCommandOutputMode::JsonData
    }
}

fn parse_args(
    args: &[String],
    value_flags: &[&str],
    bool_flags: &[&str],
    repeatable_value_flags: &[&str],
    short_value_flags: &[(&str, &str)],
) -> Result<ParsedArgs> {
    let value_flags: BTreeSet<&str> = value_flags.iter().copied().collect();
    let bool_flags: BTreeSet<&str> = bool_flags.iter().copied().collect();
    let repeatable_value_flags: BTreeSet<&str> = repeatable_value_flags.iter().copied().collect();
    let short_value_flags: BTreeMap<&str, &str> = short_value_flags.iter().copied().collect();
    let mut parsed = ParsedArgs::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with('-') || arg == "-" {
            parsed.positionals.push(arg.clone());
            index += 1;
            continue;
        }

        if arg.starts_with("--") {
            if let Some(name) = arg.strip_prefix("--no-") {
                if !bool_flags.contains(name) {
                    return Err(crate::usage_err!("Unknown boolean flag --no-{name}"));
                }
                parsed.bool_flags.insert(name.to_string(), false);
                index += 1;
                continue;
            }

            let raw = arg
                .strip_prefix("--")
                .ok_or_else(|| anyhow!("Unexpected argument: {arg}"))?;
            let (name, inline_value) = raw
                .split_once('=')
                .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));

            if bool_flags.contains(name) {
                let value = inline_value.as_deref().unwrap_or("true");
                parsed.bool_flags.insert(
                    name.to_string(),
                    value
                        .parse()
                        .with_context(|| format!("Expected a boolean for --{name}"))?,
                );
                index += 1;
                continue;
            }

            if !value_flags.contains(name) && !repeatable_value_flags.contains(name) {
                return Err(crate::usage_err!("Unknown flag --{name}"));
            }

            let value = if let Some(value) = inline_value {
                value
            } else {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| anyhow!("Missing value for --{name}"))?;
                if value.starts_with("--") {
                    return Err(anyhow!("Missing value for --{name}"));
                }
                value.clone()
            };
            insert_parsed_value(
                &mut parsed,
                name,
                value,
                repeatable_value_flags.contains(name),
            )?;
            index += 1;
            continue;
        }

        let raw = arg
            .strip_prefix('-')
            .ok_or_else(|| anyhow!("Unexpected argument: {arg}"))?;
        let (short_name, inline_value) = raw
            .split_once('=')
            .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));
        let Some(name) = short_value_flags.get(short_name).copied() else {
            return Err(crate::usage_err!("Unknown short flag -{short_name}"));
        };
        let value = if let Some(value) = inline_value {
            value
        } else {
            index += 1;
            let value = args
                .get(index)
                .ok_or_else(|| anyhow!("Missing value for -{short_name}"))?;
            if value.starts_with("--") {
                return Err(anyhow!("Missing value for -{short_name}"));
            }
            value.clone()
        };
        insert_parsed_value(
            &mut parsed,
            name,
            value,
            repeatable_value_flags.contains(name),
        )?;
        index += 1;
    }
    Ok(parsed)
}

fn insert_parsed_value(
    parsed: &mut ParsedArgs,
    name: &str,
    value: String,
    repeatable: bool,
) -> Result<()> {
    if repeatable {
        parsed
            .flags
            .entry(name.to_string())
            .or_default()
            .push(value);
    } else if parsed.flags.insert(name.to_string(), vec![value]).is_some() {
        return Err(anyhow!("Pass --{name} only once."));
    }
    Ok(())
}

fn reject_positionals(parsed: &ParsedArgs) -> Result<()> {
    if let Some(value) = parsed.positionals.first() {
        return Err(anyhow!("Unexpected argument: {value}"));
    }
    Ok(())
}

fn optional_single_positional(parsed: &ParsedArgs) -> Result<Option<String>> {
    match parsed.positionals.as_slice() {
        [] => Ok(None),
        [value] => Ok(Some(value.clone())),
        [_, extra, ..] => Err(anyhow!("Unexpected argument: {extra}")),
    }
}

fn single_id(parsed: &ParsedArgs, missing_message: &str) -> Result<String> {
    let positional = optional_single_positional(parsed)?;
    let flag_id = flag_one(parsed, "id");
    match (positional, flag_id) {
        (Some(_), Some(_)) => Err(anyhow!("Use either a positional id or --id, not both.")),
        (Some(id), None) | (None, Some(id)) => Ok(id),
        (None, None) => Err(anyhow!("{missing_message}")),
    }
}

fn flag_one(parsed: &ParsedArgs, name: &str) -> Option<String> {
    parsed
        .flags
        .get(name)
        .and_then(|values| values.first())
        .cloned()
}

fn optional_u64_flag(parsed: &ParsedArgs, name: &str) -> Result<Option<u64>> {
    flag_one(parsed, name)
        .map(|value| parse_u64_flag_value(name, &value))
        .transpose()
}

fn parse_u64_flag_value(name: &str, value: &str) -> Result<u64> {
    value
        .parse::<u64>()
        .with_context(|| format!("Expected a non-negative integer for --{name}"))
}

fn optional_i64_flag(parsed: &ParsedArgs, name: &str) -> Result<Option<i64>> {
    flag_one(parsed, name)
        .map(|value| parse_i64_flag_value(name, &value))
        .transpose()
}

fn parse_i64_flag_value(name: &str, value: &str) -> Result<i64> {
    value
        .parse::<i64>()
        .with_context(|| format!("Expected an integer for --{name}"))
}

fn validate_optional_number_flag(parsed: &ParsedArgs, name: &str) -> Result<()> {
    if let Some(value) = flag_one(parsed, name) {
        value
            .parse::<f64>()
            .with_context(|| format!("Expected a number for --{name}"))?;
    }
    Ok(())
}

fn validate_optional_enum_flag(
    parsed: &ParsedArgs,
    name: &str,
    allowed_values: &[&str],
) -> Result<()> {
    if let Some(value) = flag_one(parsed, name) {
        validate_enum_value(name, &value, allowed_values)?;
    }
    Ok(())
}

fn validate_enum_value(name: &str, value: &str, allowed_values: &[&str]) -> Result<()> {
    if allowed_values.contains(&value) {
        Ok(())
    } else {
        Err(anyhow!(
            "Expected --{name} to be one of: {}",
            allowed_values.join(", ")
        ))
    }
}

fn insert_optional_query_flag(
    query: &mut BTreeMap<String, String>,
    parsed: &ParsedArgs,
    flag: &str,
    key: &str,
) {
    if let Some(value) = flag_one(parsed, flag) {
        query.insert(key.to_string(), value);
    }
}

fn combine_q(q: Option<&str>, domain: Option<&str>) -> Option<String> {
    let q = q.map(str::trim).filter(|value| !value.is_empty());
    let domain = domain
        .filter(|value| !value.is_empty())
        .map(str::trim)
        .map(|value| format!("domain:{}", quote_dsl_value(value)));
    let parts: Vec<&str> = q.into_iter().chain(domain.as_deref()).collect();
    (!parts.is_empty()).then(|| parts.join(" "))
}

fn parse_timestamp(value: &str) -> Result<DateTime<Utc>> {
    if let Ok(parsed) = DateTime::parse_from_rfc3339(value) {
        return Ok(parsed.with_timezone(&Utc));
    }
    if let Ok(parsed) = NaiveDate::parse_from_str(value, "%Y-%m-%d") {
        let midnight = parsed
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| anyhow!("invalid date"))?;
        return Ok(DateTime::from_naive_utc_and_offset(midnight, Utc));
    }
    Err(anyhow!("invalid timestamp"))
}

fn pad_end(value: &str, width: usize) -> String {
    let length = value.chars().count();
    if length >= width {
        return value.to_string();
    }
    let mut padded = String::with_capacity(value.len() + width - length);
    padded.push_str(value);
    padded.extend(std::iter::repeat_n(' ', width - length));
    padded
}

fn collapse_whitespace(value: &str) -> String {
    let mut collapsed = String::with_capacity(value.len());
    let mut previous_was_whitespace = false;
    for character in value.chars() {
        if character.is_whitespace() {
            if !previous_was_whitespace {
                collapsed.push(' ');
                previous_was_whitespace = true;
            }
        } else {
            collapsed.push(character);
            previous_was_whitespace = false;
        }
    }
    collapsed
}

fn insert_optional_string(query: &mut BTreeMap<String, String>, key: &str, value: Option<&str>) {
    if let Some(value) = value {
        query.insert(key.to_string(), value.to_string());
    }
}

fn is_accepted_status(status: &str) -> bool {
    matches!(status, "accepted" | "completed")
}

fn ensure_min(name: &str, value: u64, min: u64) -> Result<()> {
    if value < min {
        return Err(anyhow!("{name} must be greater than or equal to {min}"));
    }
    Ok(())
}

fn ensure_range(name: &str, value: u64, min: u64, max: u64) -> Result<()> {
    ensure_min(name, value, min)?;
    if value > max {
        return Err(anyhow!("{name} must be less than or equal to {max}"));
    }
    Ok(())
}

fn base64url_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);
        out.push(ALPHABET[(b0 >> 2) as usize] as char);
        out.push(ALPHABET[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(b2 & 0b0011_1111) as usize] as char);
        }
    }
    out
}
