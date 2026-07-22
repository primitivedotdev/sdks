use crate::client;
use crate::config;
use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::io::IsTerminal;
use std::time::Instant;

const DEFAULT_SEARCH_LIMIT: u64 = 10;
const MAX_SEARCH_LIMIT: u64 = 100;

const LEXICAL_OPERATION_ID: &str = "emails:search-emails";
const LEXICAL_METHOD: &str = "GET";
const LEXICAL_PATH: &str = "/emails/search";

const SEMANTIC_OPERATION_ID: &str = "search:semantic-search";
const SEMANTIC_METHOD: &str = "POST";
const SEMANTIC_PATH: &str = "/semantic-search";

const SEMANTIC_MODES: &[&str] = &["hybrid", "semantic", "keyword"];
const CORPUS_VALUES: &[&str] = &["inbound", "outbound"];
const EMAIL_STATUSES: &[&str] = &["pending", "accepted", "completed", "rejected"];
const LEXICAL_SORTS: &[&str] = &["relevance", "received_at_desc", "received_at_asc"];
const BOOLEAN_STRING_VALUES: &[&str] = &["true", "false"];
const LEXICAL_ONLY_FLAGS: &[&str] = &[
    "from",
    "to",
    "subject",
    "body",
    "domain",
    "domain-id",
    "has-attachment",
    "status",
    "sort",
    "snippet",
    "include-facets",
];

const SCORE_WIDTH: usize = 7;
const SOURCE_WIDTH: usize = 4;
const SUBJECT_WIDTH: usize = 40;
const FROM_WIDTH: usize = 26;
const SNIPPET_WIDTH: usize = 60;
const LEXICAL_ID_WIDTH_SHORT: usize = 8;
const LEXICAL_ID_WIDTH_FULL: usize = 36;
const LEXICAL_RECEIVED_WIDTH: usize = 19;
const LEXICAL_ADDRESS_WIDTH: usize = 32;
const LEXICAL_SUBJECT_WIDTH: usize = 50;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SearchBackend {
    Lexical,
    Semantic,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SearchRequestPlan {
    pub operation_id: String,
    pub method: String,
    pub path: String,
    pub query: BTreeMap<String, String>,
    pub body: Option<Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SearchCommandPlan {
    pub backend: SearchBackend,
    pub request: SearchRequestPlan,
    pub show_envelope_metadata: bool,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

pub fn build_search_plan(command: &str, args: &[String]) -> Result<SearchCommandPlan> {
    match command {
        "search" => build_top_level_search_plan(args),
        "semantic-search" | "search:semantic-search" => build_semantic_search_plan(args),
        other => Err(crate::usage_error(format!(
            "Unknown search command `{other}`"
        ))),
    }
}

pub fn is_search_command(command: &str) -> bool {
    matches!(
        command,
        "search" | "semantic-search" | "search:semantic-search"
    )
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    if args
        .iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
    {
        print_help(command);
        return Ok(());
    }

    let start = Instant::now();
    let plan = build_search_plan(command, args)?;
    let auth = config::resolve_auth(&auth_flags(args)?)?;
    let envelope = execute_search_request(&plan.request, &auth)?;

    if has_json_flag(args) {
        println!("{}", serde_json::to_string_pretty(&envelope)?);
    } else {
        print_search_table(plan.backend, &envelope, plan.show_envelope_metadata);
    }

    if has_time_flag(args) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

pub fn build_search_plan_from_cli_args(args: &[String]) -> Result<SearchCommandPlan> {
    let (command, rest) = split_search_invocation(args)?;
    build_search_plan(command, rest)
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

fn split_search_invocation(args: &[String]) -> Result<(&'static str, &[String])> {
    let first = args
        .first()
        .ok_or_else(|| anyhow!("search commands require a command"))?;
    match first.as_str() {
        "search" if args.get(1).map(String::as_str) == Some("semantic-search") => {
            Ok(("search:semantic-search", &args[2..]))
        }
        "search" => Ok(("search", &args[1..])),
        "semantic-search" => Ok(("semantic-search", &args[1..])),
        "search:semantic-search" => Ok(("search:semantic-search", &args[1..])),
        other => Err(crate::usage_error(format!(
            "Unknown search command `{other}`"
        ))),
    }
}

fn build_top_level_search_plan(args: &[String]) -> Result<SearchCommandPlan> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "mode",
            "from",
            "to",
            "subject",
            "body",
            "domain",
            "domain-id",
            "has-attachment",
            "status",
            "sort",
            "snippet",
            "include-facets",
            "date-from",
            "date-to",
            "limit",
            "cursor",
        ],
        &["json", "envelope", "time"],
        &["corpus"],
    )?;
    let query = required_query(&parsed, "search")?;

    if let Some(mode) = flag_one(&parsed, "mode") {
        if parsed.bool_flags.get("envelope") == Some(&true) {
            return Err(anyhow!(
                "--envelope only applies to lexical mode. Use --json for the raw semantic envelope."
            ));
        }
        let incompatible: Vec<&str> = LEXICAL_ONLY_FLAGS
            .iter()
            .copied()
            .filter(|name| parsed.flags.contains_key(*name))
            .collect();
        if !incompatible.is_empty() {
            return Err(lexical_only_error(&incompatible));
        }
        return build_semantic_request_plan(&parsed, query, mode);
    }

    if !flag_many(&parsed, "corpus").is_empty() {
        return Err(anyhow!(
            "--corpus only applies to semantic mode. Pass --mode keyword|semantic|hybrid to enable it."
        ));
    }

    build_lexical_request_plan(&parsed, query)
}

fn build_semantic_search_plan(args: &[String]) -> Result<SearchCommandPlan> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "mode",
            "date-from",
            "date-to",
            "limit",
            "cursor",
        ],
        &["json", "time"],
        &["corpus"],
    )?;
    let query = required_query(&parsed, "semantic-search")?;
    let mode = flag_one(&parsed, "mode").unwrap_or_else(|| "hybrid".to_string());
    build_semantic_request_plan(&parsed, query, mode)
}

fn build_lexical_request_plan(
    parsed: &ParsedArgs,
    query_text: String,
) -> Result<SearchCommandPlan> {
    validate_optional_enum_flag(parsed, "has-attachment", BOOLEAN_STRING_VALUES)?;
    validate_optional_enum_flag(parsed, "status", EMAIL_STATUSES)?;
    validate_optional_enum_flag(parsed, "sort", LEXICAL_SORTS)?;
    validate_optional_enum_flag(parsed, "snippet", BOOLEAN_STRING_VALUES)?;
    validate_optional_enum_flag(parsed, "include-facets", BOOLEAN_STRING_VALUES)?;

    let mut query = BTreeMap::new();
    let q = if let Some(domain) = flag_one(parsed, "domain") {
        format!("{query_text} domain:{}", quote_dsl_value(&domain))
    } else {
        query_text
    };
    query.insert("q".to_string(), q);
    query.insert(
        "limit".to_string(),
        parse_limit(parsed, DEFAULT_SEARCH_LIMIT)?.to_string(),
    );
    insert_optional_query_flag(&mut query, parsed, "from", "from");
    insert_optional_query_flag(&mut query, parsed, "to", "to");
    insert_optional_query_flag(&mut query, parsed, "subject", "subject");
    insert_optional_query_flag(&mut query, parsed, "body", "body");
    insert_optional_query_flag(&mut query, parsed, "domain-id", "domain_id");
    insert_optional_query_flag(&mut query, parsed, "has-attachment", "has_attachment");
    insert_optional_query_flag(&mut query, parsed, "status", "status");
    insert_optional_query_flag(&mut query, parsed, "sort", "sort");
    insert_optional_query_flag(&mut query, parsed, "snippet", "snippet");
    insert_optional_query_flag(&mut query, parsed, "include-facets", "include_facets");
    insert_optional_query_flag(&mut query, parsed, "date-from", "date_from");
    insert_optional_query_flag(&mut query, parsed, "date-to", "date_to");
    insert_optional_query_flag(&mut query, parsed, "cursor", "cursor");

    Ok(SearchCommandPlan {
        backend: SearchBackend::Lexical,
        show_envelope_metadata: parsed.bool_flags.get("envelope") == Some(&true),
        request: SearchRequestPlan {
            operation_id: LEXICAL_OPERATION_ID.to_string(),
            method: LEXICAL_METHOD.to_string(),
            path: LEXICAL_PATH.to_string(),
            query,
            body: None,
        },
    })
}

fn build_semantic_request_plan(
    parsed: &ParsedArgs,
    query: String,
    mode: String,
) -> Result<SearchCommandPlan> {
    validate_enum_value("mode", &mode, SEMANTIC_MODES)?;
    for corpus in flag_many(parsed, "corpus") {
        validate_enum_value("corpus", &corpus, CORPUS_VALUES)?;
    }

    let mut body = Map::new();
    body.insert("query".to_string(), Value::String(query));
    body.insert("mode".to_string(), Value::String(mode));
    let corpus = flag_many(parsed, "corpus");
    if !corpus.is_empty() {
        body.insert(
            "corpus".to_string(),
            Value::Array(corpus.into_iter().map(Value::String).collect()),
        );
    }
    insert_optional_body_string(&mut body, parsed, "date-from", "date_from");
    insert_optional_body_string(&mut body, parsed, "date-to", "date_to");
    body.insert(
        "limit".to_string(),
        Value::Number(parse_limit(parsed, DEFAULT_SEARCH_LIMIT)?.into()),
    );
    insert_optional_body_string(&mut body, parsed, "cursor", "cursor");

    Ok(SearchCommandPlan {
        backend: SearchBackend::Semantic,
        show_envelope_metadata: false,
        request: SearchRequestPlan {
            operation_id: SEMANTIC_OPERATION_ID.to_string(),
            method: SEMANTIC_METHOD.to_string(),
            path: SEMANTIC_PATH.to_string(),
            query: BTreeMap::new(),
            body: Some(Value::Object(body)),
        },
    })
}

fn parse_args(
    args: &[String],
    value_flags: &[&str],
    bool_flags: &[&str],
    repeatable_value_flags: &[&str],
) -> Result<ParsedArgs> {
    let value_flags: BTreeSet<&str> = value_flags.iter().copied().collect();
    let bool_flags: BTreeSet<&str> = bool_flags.iter().copied().collect();
    let repeatable_value_flags: BTreeSet<&str> = repeatable_value_flags.iter().copied().collect();
    let mut parsed = ParsedArgs::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with("--") {
            parsed.positionals.push(arg.clone());
            index += 1;
            continue;
        }

        if let Some(name) = arg.strip_prefix("--no-") {
            if !bool_flags.contains(name) {
                return Err(crate::usage_error(format!(
                    "Unknown boolean flag --no-{name}"
                )));
            }
            parsed.bool_flags.insert(name.to_string(), false);
            index += 1;
            continue;
        }

        let raw = arg
            .strip_prefix("--")
            .ok_or_else(|| crate::usage_error(format!("Unexpected argument: {arg}")))?;
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
            return Err(crate::usage_error(format!("Unknown flag --{name}")));
        }

        let value = if let Some(value) = inline_value {
            value
        } else {
            index += 1;
            let value = args
                .get(index)
                .ok_or_else(|| crate::usage_error(format!("Missing value for --{name}")))?;
            if value.starts_with("--") {
                return Err(crate::usage_error(format!("Missing value for --{name}")));
            }
            value.clone()
        };

        if repeatable_value_flags.contains(name) {
            parsed
                .flags
                .entry(name.to_string())
                .or_default()
                .push(value);
        } else if parsed.flags.insert(name.to_string(), vec![value]).is_some() {
            return Err(anyhow!("Pass --{name} only once."));
        }
        index += 1;
    }
    Ok(parsed)
}

fn required_query(parsed: &ParsedArgs, command: &str) -> Result<String> {
    match parsed.positionals.as_slice() {
        [] => Err(crate::usage_error(format!("{command} requires a query"))),
        [query] => Ok(query.clone()),
        [_, extra, ..] => Err(crate::usage_error(format!("Unexpected argument: {extra}"))),
    }
}

fn lexical_only_error(incompatible: &[&str]) -> anyhow::Error {
    let is_one = incompatible.len() == 1;
    anyhow!(
        "Flag{} --{} only {} to the lexical backend. Omit --mode to use {}.",
        if is_one { "" } else { "s" },
        incompatible.join(", --"),
        if is_one { "applies" } else { "apply" },
        if is_one { "it" } else { "them" }
    )
}

fn parse_limit(parsed: &ParsedArgs, default_value: u64) -> Result<u64> {
    let Some(value) = flag_one(parsed, "limit") else {
        return Ok(default_value);
    };
    let parsed: i64 = value
        .parse()
        .with_context(|| "Expected an integer for --limit")?;
    if parsed < 1 {
        return Err(anyhow!("Expected --limit to be greater than or equal to 1"));
    }
    if parsed > MAX_SEARCH_LIMIT as i64 {
        return Err(anyhow!(
            "Expected --limit to be less than or equal to {MAX_SEARCH_LIMIT}"
        ));
    }
    Ok(parsed as u64)
}

fn validate_optional_enum_flag(
    parsed: &ParsedArgs,
    name: &'static str,
    values: &[&str],
) -> Result<()> {
    if let Some(value) = flag_one(parsed, name) {
        validate_enum_value(name, &value, values)?;
    }
    Ok(())
}

fn validate_enum_value(name: &str, value: &str, values: &[&str]) -> Result<()> {
    if values.contains(&value) {
        return Ok(());
    }
    Err(anyhow!(
        "Expected --{name} to be one of: {}",
        values.join(", ")
    ))
}

fn insert_optional_query_flag(
    query: &mut BTreeMap<String, String>,
    parsed: &ParsedArgs,
    flag_name: &str,
    query_name: &str,
) {
    if let Some(value) = flag_one(parsed, flag_name) {
        query.insert(query_name.to_string(), value);
    }
}

fn insert_optional_body_string(
    body: &mut Map<String, Value>,
    parsed: &ParsedArgs,
    flag_name: &str,
    body_name: &str,
) {
    if let Some(value) = flag_one(parsed, flag_name) {
        body.insert(body_name.to_string(), Value::String(value));
    }
}

fn flag_one(parsed: &ParsedArgs, name: &str) -> Option<String> {
    parsed
        .flags
        .get(name)
        .and_then(|values| values.first())
        .cloned()
}

fn flag_many(parsed: &ParsedArgs, name: &str) -> Vec<String> {
    parsed.flags.get(name).cloned().unwrap_or_default()
}

fn execute_search_request(
    request: &SearchRequestPlan,
    auth: &config::ResolvedAuth,
) -> Result<Value> {
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
        return Err(client::error_for_status_with_hints(
            status,
            json.as_ref(),
            &bytes,
        ));
    }
    json.ok_or_else(|| anyhow!("HTTP {status} returned no JSON body"))
}

fn auth_flags(args: &[String]) -> Result<BTreeMap<String, String>> {
    let mut flags = BTreeMap::new();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        let Some(raw) = arg.strip_prefix("--") else {
            index += 1;
            continue;
        };
        let (name, inline_value) = raw
            .split_once('=')
            .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));
        if matches!(name, "api-key" | "api-base-url") {
            let value = if let Some(value) = inline_value {
                value
            } else {
                index += 1;
                args.get(index)
                    .ok_or_else(|| crate::usage_error(format!("Missing value for --{name}")))?
                    .clone()
            };
            flags.insert(name.to_string(), value);
        }
        index += 1;
    }
    Ok(flags)
}

fn has_json_flag(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--json" | "--json=true"))
}

fn has_time_flag(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--time" | "--time=true"))
}

fn print_search_table(backend: SearchBackend, envelope: &Value, show_envelope_metadata: bool) {
    let rows = envelope
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if rows.is_empty() {
        eprintln!("No matching mail.");
        return;
    }

    match backend {
        SearchBackend::Lexical => {
            let id_width = if std::io::stdout().is_terminal() {
                LEXICAL_ID_WIDTH_SHORT
            } else {
                LEXICAL_ID_WIDTH_FULL
            };
            eprintln!("{}", lexical_header(id_width));
            for row in rows {
                println!("{}", lexical_row(&row, id_width));
            }
            if let Some(cursor) = show_envelope_metadata
                .then(|| {
                    envelope
                        .get("meta")
                        .and_then(|meta| meta.get("cursor"))
                        .and_then(Value::as_str)
                })
                .flatten()
            {
                eprintln!("\nNext page: pass --cursor {cursor}");
            }
        }
        SearchBackend::Semantic => {
            eprintln!("{}", semantic_header());
            for row in rows {
                println!("{}", semantic_row(&row));
            }
            if let Some(cursor) = envelope
                .get("meta")
                .and_then(|meta| meta.get("cursor"))
                .and_then(Value::as_str)
            {
                eprintln!("\nNext page: pass --cursor {cursor}");
            }
        }
    }
}

fn lexical_header(id_width: usize) -> String {
    format!(
        "{}  {}  {}  {}  SUBJECT",
        pad_end("ID", id_width),
        pad_end("RECEIVED (UTC)", LEXICAL_RECEIVED_WIDTH),
        pad_end("FROM", LEXICAL_ADDRESS_WIDTH),
        pad_end("TO", LEXICAL_ADDRESS_WIDTH)
    )
}

fn lexical_row(row: &Value, id_width: usize) -> String {
    let id = value_str(row, "id");
    let id: String = id.chars().take(id_width).collect();
    let received = value_str(row, "received_at");
    let from = value_str(row, "sender");
    let to = value_str(row, "recipient");
    let subject = collapse_whitespace(&value_str(row, "subject"));
    format!(
        "{}  {}  {}  {}  {}",
        truncate(&id, id_width),
        format_received_at(&received),
        truncate(&from, LEXICAL_ADDRESS_WIDTH),
        truncate(&to, LEXICAL_ADDRESS_WIDTH),
        truncate(&subject, LEXICAL_SUBJECT_WIDTH)
    )
}

fn semantic_header() -> String {
    format!(
        "{}  {}  {}  {}  EXCERPT",
        pad_start("SCORE", SCORE_WIDTH),
        pad_end("SRC", SOURCE_WIDTH),
        pad_end("SUBJECT", SUBJECT_WIDTH),
        pad_end("FROM", FROM_WIDTH)
    )
}

fn semantic_row(row: &Value) -> String {
    let score = row.get("score").and_then(Value::as_f64).unwrap_or(0.0);
    let score = pad_start(&format!("{score:.3}"), SCORE_WIDTH);
    let source = match value_str(row, "source_type").as_str() {
        "inbound_email" => "in",
        _ => "out",
    };
    let subject = collapse_whitespace(&value_str(row, "subject"));
    let from = value_str(row, "from");
    let snippet = row
        .get("snippets")
        .and_then(Value::as_array)
        .and_then(|snippets| snippets.first())
        .and_then(|snippet| snippet.get("text"))
        .and_then(Value::as_str)
        .map(collapse_whitespace)
        .unwrap_or_default();
    format!(
        "{}  {}  {}  {}  {}",
        score,
        pad_end(source, SOURCE_WIDTH),
        truncate(&subject, SUBJECT_WIDTH),
        truncate(&from, FROM_WIDTH),
        truncate(&snippet, SNIPPET_WIDTH)
    )
}

fn format_received_at(value: &str) -> String {
    if value.is_empty() {
        return pad_end("-", LEXICAL_RECEIVED_WIDTH);
    }
    match chrono::DateTime::parse_from_rfc3339(value) {
        Ok(parsed) => parsed
            .with_timezone(&chrono::Utc)
            .format("%Y-%m-%d %H:%M:%S")
            .to_string(),
        Err(_) => pad_end(value, LEXICAL_RECEIVED_WIDTH),
    }
}

fn value_str(row: &Value, key: &str) -> String {
    row.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn truncate(value: &str, width: usize) -> String {
    if value.chars().count() <= width {
        return pad_end(value, width);
    }
    let prefix: String = value.chars().take(width.saturating_sub(3)).collect();
    format!("{prefix}...")
}

fn pad_end(value: &str, width: usize) -> String {
    format!("{value:<width$}")
}

fn pad_start(value: &str, width: usize) -> String {
    format!("{value:>width$}")
}

fn print_help(command: &str) {
    print!("{}", search_help_text(command));
}

pub fn search_help_text(command: &str) -> String {
    let bin = crate::display_bin_name();
    if command == "search" {
        format!(
            r#"Search mail (lexical by default; --mode for semantic)

USAGE
  {bin} search <query> [flags]

FLAGS
  --api-key <value>
  --body <value>
  --corpus inbound|outbound
  --cursor <value>
  --date-from <value>
  --date-to <value>
  --domain <value>
  --domain-id <value>
  --envelope
  --from <value>
  --has-attachment true|false
  --include-facets true|false
  --json
  --limit <number>
  --mode hybrid|semantic|keyword
  --snippet true|false
  --sort relevance|received_at_desc|received_at_asc
  --status pending|accepted|completed|rejected
  --subject <value>
  --time
  --to <value>
"#
        )
    } else {
        format!(
            r#"Semantic / hybrid / keyword search across received and sent mail

USAGE
  {bin} semantic-search <query> [flags]
  {bin} search semantic-search <query> [flags]

FLAGS
  --api-key <value>
  --corpus inbound|outbound
  --cursor <value>
  --date-from <value>
  --date-to <value>
  --json
  --limit <number>
  --mode hybrid|semantic|keyword
  --time
"#
        )
    }
}
