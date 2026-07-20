use crate::client;
use crate::config;
use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::time::Instant;

pub const DEFAULT_MEMORY_SEARCH_LIMIT: u64 = 50;
pub const MAX_MEMORY_SEARCH_LIMIT: u64 = 100;
pub const MAX_MEMORY_TTL_SECONDS: u64 = 31_536_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MemoryCommandKind {
    Set,
    Get,
    Delete,
    Search,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MemoryCommandAlias {
    pub alias: &'static str,
    pub target_operation_id: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct MemoryApiRequest {
    pub target_operation_id: &'static str,
    pub method: &'static str,
    pub path: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ScopeFlags {
    pub function: Option<String>,
    pub org: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SetMemoryRequestInput {
    pub key: String,
    pub value: Value,
    pub scope: ScopeFlags,
    pub ttl_seconds: Option<u64>,
    pub expires_at: Option<String>,
    pub clear_ttl: bool,
    pub if_absent: bool,
    pub if_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GetMemoryQueryInput {
    pub key: String,
    pub scope: ScopeFlags,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeleteMemoryQueryInput {
    pub key: String,
    pub scope: ScopeFlags,
    pub if_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchMemoriesQueryInput {
    pub prefix: Option<String>,
    pub scope: ScopeFlags,
    pub cursor: Option<String>,
    pub limit: Option<u64>,
    pub metadata_only: bool,
    pub updated_after: Option<String>,
    pub updated_before: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MemoryValueSourceInput {
    pub value: Option<String>,
    pub value_file: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemoryValueSource {
    pub source: String,
    pub label: String,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

pub fn memory_command_aliases() -> &'static [MemoryCommandAlias] {
    &[
        MemoryCommandAlias {
            alias: "memories:set",
            target_operation_id: "memories:set-memory",
        },
        MemoryCommandAlias {
            alias: "memories:get",
            target_operation_id: "memories:get-memory",
        },
        MemoryCommandAlias {
            alias: "memories:delete",
            target_operation_id: "memories:delete-memory",
        },
        MemoryCommandAlias {
            alias: "memories:search",
            target_operation_id: "memories:search-memories",
        },
    ]
}

pub fn memory_command_target(command: &str) -> Option<&'static str> {
    memory_command_kind(command).map(memory_target_operation_id)
}

pub fn is_memories_friendly_command(command: &str) -> bool {
    matches!(
        normalize_command(command).as_str(),
        "memories:set" | "memories:get" | "memories:delete" | "memories:search"
    )
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help(None);
        return Ok(());
    }

    let (subcommand, rest) = args
        .split_first()
        .ok_or_else(|| anyhow!("memories commands require a subcommand"))?;
    let command = if subcommand.contains(':') {
        subcommand.clone()
    } else {
        format!("memories:{subcommand}")
    };
    execute_command(&command, rest)
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    let kind = memory_command_kind(command);
    if is_help_request(args) && kind.is_some() {
        print_help(kind);
        return Ok(());
    }

    let start = Instant::now();
    let request = build_memory_request(command, args)?;
    let auth = config::resolve_auth(&auth_flags(args)?)?;
    let envelope = execute_memory_request(&request, &auth)?;
    write_memory_output(&envelope)?;
    if has_time_flag(args) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

pub fn build_memory_request(command: &str, args: &[String]) -> Result<MemoryApiRequest> {
    match memory_command_kind(command) {
        Some(MemoryCommandKind::Set) => build_memories_set_request_from_args(args),
        Some(MemoryCommandKind::Get) => build_memories_get_request_from_args(args),
        Some(MemoryCommandKind::Delete) => build_memories_delete_request_from_args(args),
        Some(MemoryCommandKind::Search) => build_memories_search_request_from_args(args),
        None => Err(crate::usage_err!("Unknown memories command `{command}`")),
    }
}

pub fn build_memories_set_request_from_args(args: &[String]) -> Result<MemoryApiRequest> {
    build_memories_set_request_from_args_with_reader(args, read_memory_value_file)
}

pub fn build_memories_set_request_from_args_with_reader<F>(
    args: &[String],
    read_file: F,
) -> Result<MemoryApiRequest>
where
    F: Fn(&str) -> Result<String>,
{
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "function",
            "value-file",
            "ttl-seconds",
            "expires-at",
            "if-version",
        ],
        &["org", "clear-ttl", "if-absent", "time"],
    )?;
    let (key, value) = set_positionals(&parsed)?;
    let source = resolve_memory_value_source_with_reader(
        &MemoryValueSourceInput {
            value,
            value_file: flag_one(&parsed, "value-file"),
        },
        read_file,
    )?;
    let value = parse_memory_json(&source.source, &source.label)?;
    let body = build_set_memory_body(&SetMemoryRequestInput {
        key,
        value,
        scope: scope_flags_from_parsed(&parsed),
        ttl_seconds: optional_u64_flag(&parsed, "ttl-seconds")?,
        expires_at: flag_one(&parsed, "expires-at"),
        clear_ttl: parsed.bool_flags.get("clear-ttl") == Some(&true),
        if_absent: parsed.bool_flags.get("if-absent") == Some(&true),
        if_version: flag_one(&parsed, "if-version"),
    })?;
    Ok(memory_request(
        MemoryCommandKind::Set,
        "/memories",
        BTreeMap::new(),
        Some(body),
    ))
}

pub fn build_memories_get_request_from_args(args: &[String]) -> Result<MemoryApiRequest> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url", "function"],
        &["org", "time"],
    )?;
    let key = single_positional(&parsed, "memories get requires a key")?;
    Ok(memory_request(
        MemoryCommandKind::Get,
        "/memories",
        build_get_memory_query(&GetMemoryQueryInput {
            key,
            scope: scope_flags_from_parsed(&parsed),
        })?,
        None,
    ))
}

pub fn build_memories_delete_request_from_args(args: &[String]) -> Result<MemoryApiRequest> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url", "function", "if-version"],
        &["org", "time"],
    )?;
    let key = single_positional(&parsed, "memories delete requires a key")?;
    Ok(memory_request(
        MemoryCommandKind::Delete,
        "/memories",
        build_delete_memory_query(&DeleteMemoryQueryInput {
            key,
            scope: scope_flags_from_parsed(&parsed),
            if_version: flag_one(&parsed, "if-version"),
        })?,
        None,
    ))
}

pub fn build_memories_search_request_from_args(args: &[String]) -> Result<MemoryApiRequest> {
    let parsed = parse_memory_search_args(args)?;
    let prefix = optional_single_positional(&parsed)?;
    build_search_like_request(prefix, parsed)
}

pub fn parse_memory_json(source: &str, label: &str) -> Result<Value> {
    match serde_json::from_str::<Value>(source) {
        Ok(value) if is_memory_json_value(&value) => Ok(value),
        Ok(_) => Err(memory_json_shape_error(label)),
        Err(error) if error.to_string().contains("number out of range") => {
            Err(memory_json_shape_error(label))
        }
        Err(error) => Err(anyhow!(
            "{label} must be valid JSON. Quote strings as JSON strings, for example '\"hello\"'. {error}"
        )),
    }
}

pub fn is_memory_json_value(value: &Value) -> bool {
    match value {
        Value::Null | Value::Bool(_) | Value::String(_) => true,
        Value::Number(number) => {
            number.is_i64() || number.is_u64() || number.as_f64().is_some_and(f64::is_finite)
        }
        Value::Array(values) => values.iter().all(is_memory_json_value),
        Value::Object(values) => values.values().all(is_memory_json_value),
    }
}

pub fn resolve_memory_value_source(input: &MemoryValueSourceInput) -> Result<MemoryValueSource> {
    resolve_memory_value_source_with_reader(input, read_memory_value_file)
}

pub fn resolve_memory_value_source_with_reader<F>(
    input: &MemoryValueSourceInput,
    read_file: F,
) -> Result<MemoryValueSource>
where
    F: Fn(&str) -> Result<String>,
{
    match (&input.value, &input.value_file) {
        (Some(_), Some(_)) => Err(anyhow!(
            "Provide the JSON value as either an argument or --value-file, not both."
        )),
        (Some(value), None) => Ok(MemoryValueSource {
            source: value.clone(),
            label: "value".to_string(),
        }),
        (None, Some(path)) => Ok(MemoryValueSource {
            source: read_file(path)?,
            label: format!("--value-file {path}"),
        }),
        (None, None) => Err(anyhow!("Provide a JSON value argument or --value-file.")),
    }
}

pub fn memory_scope_for_body(flags: &ScopeFlags) -> Result<Option<Value>> {
    validate_scope_flags(flags)?;
    if let Some(function_id) = non_empty_optional(flags.function.as_deref(), "--function")? {
        let mut scope = Map::new();
        scope.insert("type".to_string(), Value::String("function".to_string()));
        scope.insert("id".to_string(), Value::String(function_id));
        return Ok(Some(Value::Object(scope)));
    }
    if flags.org {
        let mut scope = Map::new();
        scope.insert("type".to_string(), Value::String("org".to_string()));
        return Ok(Some(Value::Object(scope)));
    }
    Ok(None)
}

pub fn memory_scope_for_query(flags: &ScopeFlags) -> Result<BTreeMap<String, String>> {
    validate_scope_flags(flags)?;
    let mut query = BTreeMap::new();
    if let Some(function_id) = non_empty_optional(flags.function.as_deref(), "--function")? {
        query.insert("scope_type".to_string(), "function".to_string());
        query.insert("scope_id".to_string(), function_id);
    } else if flags.org {
        query.insert("scope_type".to_string(), "org".to_string());
    }
    Ok(query)
}

pub fn build_set_memory_body(input: &SetMemoryRequestInput) -> Result<Value> {
    validate_ttl_flags(
        input.ttl_seconds,
        input.expires_at.as_deref(),
        input.clear_ttl,
    )?;
    if input.if_absent && input.if_version.is_some() {
        return Err(anyhow!("Use either --if-absent or --if-version, not both."));
    }
    let if_version = non_empty_optional(input.if_version.as_deref(), "--if-version")?;
    let expires_at = non_empty_optional(input.expires_at.as_deref(), "--expires-at")?;

    let mut body = Map::new();
    body.insert("key".to_string(), Value::String(input.key.clone()));
    body.insert("value".to_string(), input.value.clone());
    if let Some(scope) = memory_scope_for_body(&input.scope)? {
        body.insert("scope".to_string(), scope);
    }
    if let Some(ttl_seconds) = input.ttl_seconds {
        ensure_range("--ttl-seconds", ttl_seconds, 1, MAX_MEMORY_TTL_SECONDS)?;
        body.insert("ttl_seconds".to_string(), Value::from(ttl_seconds));
    }
    if let Some(expires_at) = expires_at {
        body.insert("expires_at".to_string(), Value::String(expires_at));
    }
    if input.clear_ttl {
        body.insert("clear_ttl".to_string(), Value::Bool(true));
    }
    if input.if_absent {
        body.insert("if_absent".to_string(), Value::Bool(true));
    }
    if let Some(if_version) = if_version {
        body.insert("if_version".to_string(), Value::String(if_version));
    }
    Ok(Value::Object(body))
}

pub fn build_get_memory_query(input: &GetMemoryQueryInput) -> Result<BTreeMap<String, String>> {
    let mut query = BTreeMap::from([("key".to_string(), input.key.clone())]);
    query.extend(memory_scope_for_query(&input.scope)?);
    Ok(query)
}

pub fn build_delete_memory_query(
    input: &DeleteMemoryQueryInput,
) -> Result<BTreeMap<String, String>> {
    let if_version = non_empty_optional(input.if_version.as_deref(), "--if-version")?;
    let mut query = BTreeMap::from([("key".to_string(), input.key.clone())]);
    query.extend(memory_scope_for_query(&input.scope)?);
    if let Some(if_version) = if_version {
        query.insert("if_version".to_string(), if_version);
    }
    Ok(query)
}

pub fn build_search_memories_query(
    input: &SearchMemoriesQueryInput,
) -> Result<BTreeMap<String, String>> {
    let limit = input.limit.unwrap_or(DEFAULT_MEMORY_SEARCH_LIMIT);
    ensure_range("--limit", limit, 1, MAX_MEMORY_SEARCH_LIMIT)?;
    let cursor = non_empty_optional(input.cursor.as_deref(), "--cursor")?;
    let updated_after = non_empty_optional(input.updated_after.as_deref(), "--updated-after")?;
    let updated_before = non_empty_optional(input.updated_before.as_deref(), "--updated-before")?;

    let mut query = BTreeMap::new();
    if let Some(prefix) = &input.prefix {
        query.insert("prefix".to_string(), prefix.clone());
    }
    query.insert("limit".to_string(), limit.to_string());
    if let Some(cursor) = cursor {
        query.insert("cursor".to_string(), cursor);
    }
    if input.metadata_only {
        query.insert("include_value".to_string(), "false".to_string());
    }
    if let Some(updated_after) = updated_after {
        query.insert("updated_after".to_string(), updated_after);
    }
    if let Some(updated_before) = updated_before {
        query.insert("updated_before".to_string(), updated_before);
    }
    query.extend(memory_scope_for_query(&input.scope)?);
    Ok(query)
}

pub fn memory_output_payload(envelope: &Value) -> Value {
    envelope.get("data").cloned().unwrap_or(Value::Null)
}

pub fn format_memory_output(envelope: &Value) -> Result<String> {
    Ok(serde_json::to_string_pretty(&memory_output_payload(
        envelope,
    ))?)
}

pub fn write_memory_output(envelope: &Value) -> Result<()> {
    println!("{}", format_memory_output(envelope)?);
    Ok(())
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
                    .ok_or_else(|| crate::usage_err!("Missing value for --{name}"))?;
                if value.starts_with("--") {
                    return Err(crate::usage_err!("Missing value for --{name}"));
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

pub fn memories_help_text(command: Option<&str>) -> String {
    memories_help_text_for_kind(command.and_then(memory_command_kind))
}

fn build_search_like_request(
    prefix: Option<String>,
    parsed: ParsedArgs,
) -> Result<MemoryApiRequest> {
    Ok(memory_request(
        MemoryCommandKind::Search,
        "/memories/search",
        build_search_memories_query(&SearchMemoriesQueryInput {
            prefix,
            scope: scope_flags_from_parsed(&parsed),
            cursor: flag_one(&parsed, "cursor"),
            limit: optional_u64_flag(&parsed, "limit")?,
            metadata_only: parsed.bool_flags.get("metadata-only") == Some(&true),
            updated_after: flag_one(&parsed, "updated-after"),
            updated_before: flag_one(&parsed, "updated-before"),
        })?,
        None,
    ))
}

fn parse_memory_search_args(args: &[String]) -> Result<ParsedArgs> {
    parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "function",
            "limit",
            "cursor",
            "updated-after",
            "updated-before",
        ],
        &["org", "metadata-only", "time"],
    )
}

fn execute_memory_request(
    request: &MemoryApiRequest,
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
        return Err(client::error_for_status(status, json.as_ref(), &bytes));
    }
    Ok(json.unwrap_or(Value::Null))
}

fn memory_request(
    kind: MemoryCommandKind,
    path: &str,
    query: BTreeMap<String, String>,
    body: Option<Value>,
) -> MemoryApiRequest {
    MemoryApiRequest {
        target_operation_id: memory_target_operation_id(kind),
        method: memory_method(kind),
        path: path.to_string(),
        query,
        body,
    }
}

fn memory_command_kind(command: &str) -> Option<MemoryCommandKind> {
    let normalized = normalize_command(command);
    let command = normalized
        .strip_prefix("memories:")
        .unwrap_or(normalized.as_str());
    match command {
        "set" | "set-memory" => Some(MemoryCommandKind::Set),
        "get" | "get-memory" => Some(MemoryCommandKind::Get),
        "delete" | "delete-memory" => Some(MemoryCommandKind::Delete),
        "search" | "search-memories" => Some(MemoryCommandKind::Search),
        _ => None,
    }
}

fn memory_target_operation_id(kind: MemoryCommandKind) -> &'static str {
    match kind {
        MemoryCommandKind::Set => "memories:set-memory",
        MemoryCommandKind::Get => "memories:get-memory",
        MemoryCommandKind::Delete => "memories:delete-memory",
        MemoryCommandKind::Search => "memories:search-memories",
    }
}

fn memory_method(kind: MemoryCommandKind) -> &'static str {
    match kind {
        MemoryCommandKind::Set => "PUT",
        MemoryCommandKind::Get | MemoryCommandKind::Search => "GET",
        MemoryCommandKind::Delete => "DELETE",
    }
}

fn normalize_command(command: &str) -> String {
    command.split_whitespace().collect::<Vec<_>>().join(":")
}

fn read_memory_value_file(path: &str) -> Result<String> {
    fs::read_to_string(path).with_context(|| format!("Could not read --value-file {path}"))
}

fn scope_flags_from_parsed(parsed: &ParsedArgs) -> ScopeFlags {
    ScopeFlags {
        function: flag_one(parsed, "function"),
        org: parsed.bool_flags.get("org") == Some(&true),
    }
}

fn validate_scope_flags(flags: &ScopeFlags) -> Result<()> {
    if flags.org && flags.function.is_some() {
        return Err(anyhow!("Use either --function or --org, not both."));
    }
    Ok(())
}

fn validate_ttl_flags(
    ttl_seconds: Option<u64>,
    expires_at: Option<&str>,
    clear_ttl: bool,
) -> Result<()> {
    let count = usize::from(ttl_seconds.is_some())
        + usize::from(expires_at.is_some())
        + usize::from(clear_ttl);
    if count > 1 {
        return Err(anyhow!(
            "Use only one of --ttl-seconds, --expires-at, or --clear-ttl."
        ));
    }
    Ok(())
}

fn non_empty_optional(value: Option<&str>, name: &str) -> Result<Option<String>> {
    match value {
        Some(value) if value.trim().is_empty() => {
            Err(anyhow!("{name} must be a non-empty string."))
        }
        Some(value) => Ok(Some(value.to_string())),
        None => Ok(None),
    }
}

fn memory_json_shape_error(label: &str) -> anyhow::Error {
    anyhow!(
        "{label} must be valid JSON. Numbers must be finite, arrays must not be sparse, and values may not contain undefined, bigint, symbol, function, class instance, or cyclic entries."
    )
}

fn set_positionals(parsed: &ParsedArgs) -> Result<(String, Option<String>)> {
    match parsed.positionals.as_slice() {
        [] => Err(anyhow!("memories set requires a key")),
        [key] => Ok((key.clone(), None)),
        [key, value] => Ok((key.clone(), Some(value.clone()))),
        [_, _, extra, ..] => Err(anyhow!("Unexpected argument: {extra}")),
    }
}

fn single_positional(parsed: &ParsedArgs, missing_message: &str) -> Result<String> {
    match parsed.positionals.as_slice() {
        [] => Err(anyhow!("{missing_message}")),
        [value] => Ok(value.clone()),
        [_, extra, ..] => Err(anyhow!("Unexpected argument: {extra}")),
    }
}

fn optional_single_positional(parsed: &ParsedArgs) -> Result<Option<String>> {
    match parsed.positionals.as_slice() {
        [] => Ok(None),
        [value] => Ok(Some(value.clone())),
        [_, extra, ..] => Err(anyhow!("Unexpected argument: {extra}")),
    }
}

fn parse_args(args: &[String], value_flags: &[&str], bool_flags: &[&str]) -> Result<ParsedArgs> {
    let value_flags: BTreeSet<&str> = value_flags.iter().copied().collect();
    let bool_flags: BTreeSet<&str> = bool_flags.iter().copied().collect();
    let mut parsed = ParsedArgs::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with("--") || arg == "--" {
            parsed.positionals.push(arg.clone());
            index += 1;
            continue;
        }

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

        if !value_flags.contains(name) {
            return Err(crate::usage_err!("Unknown flag --{name}"));
        }

        let value = if let Some(value) = inline_value {
            value
        } else {
            index += 1;
            let value = args
                .get(index)
                .ok_or_else(|| crate::usage_err!("Missing value for --{name}"))?;
            if value.starts_with("--") {
                return Err(crate::usage_err!("Missing value for --{name}"));
            }
            value.clone()
        };
        if parsed.flags.insert(name.to_string(), vec![value]).is_some() {
            return Err(anyhow!("Pass --{name} only once."));
        }
        index += 1;
    }
    Ok(parsed)
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
        .map(|value| {
            value
                .parse()
                .with_context(|| format!("Expected a non-negative integer for --{name}"))
        })
        .transpose()
}

fn ensure_range(name: &str, value: u64, min: u64, max: u64) -> Result<()> {
    if value < min {
        return Err(anyhow!("{name} must be greater than or equal to {min}"));
    }
    if value > max {
        return Err(anyhow!("{name} must be less than or equal to {max}"));
    }
    Ok(())
}

fn memories_help_text_for_kind(kind: Option<MemoryCommandKind>) -> String {
    let bin = crate::display_bin_name();
    match kind {
        Some(MemoryCommandKind::Set) => format!(
            "Set a memory\n\
             \n\
             USAGE\n\
               {bin} memories set <key> [value] [--api-key <value>] [--function <value> | --org] [--value-file <path>] [--ttl-seconds <seconds> | --expires-at <timestamp> | --clear-ttl] [--if-absent | --if-version <version>] [--time]\n\
             \n\
             ARGUMENTS\n\
               <key>    Memory key.\n\
               [value]  JSON value. Strings must be quoted as JSON strings.\n\
             \n\
             FLAGS\n\
               --api-key=<value>      Primitive API key override.\n\
               --clear-ttl            Clear any existing TTL.\n\
               --expires-at=<value>   Set or replace the absolute expiration timestamp.\n\
               --function=<value>     Function id UUID to scope this memory to.\n\
               --if-absent            Create only when the key is absent.\n\
               --if-version=<value>   Compare-and-set version.\n\
               --org                  Force org scope.\n\
               --time                 Print the wall-clock duration to stderr.\n\
               --ttl-seconds=<value>  Set or replace the TTL in seconds.\n\
               --value-file=<value>   Read the JSON value from a UTF-8 file.\n"
        ),
        Some(MemoryCommandKind::Get) => format!(
            "Get a memory\n\
             \n\
             USAGE\n\
               {bin} memories get <key> [--api-key <value>] [--function <value> | --org] [--time]\n\
             \n\
             ARGUMENTS\n\
               <key>  Memory key.\n\
             \n\
             FLAGS\n\
               --api-key=<value>   Primitive API key override.\n\
               --function=<value>  Function id UUID to scope this memory to.\n\
               --org               Force org scope.\n\
               --time              Print the wall-clock duration to stderr.\n"
        ),
        Some(MemoryCommandKind::Delete) => format!(
            "Delete a memory\n\
             \n\
             USAGE\n\
               {bin} memories delete <key> [--api-key <value>] [--function <value> | --org] [--if-version <version>] [--time]\n\
             \n\
             ARGUMENTS\n\
               <key>  Memory key.\n\
             \n\
             FLAGS\n\
               --api-key=<value>     Primitive API key override.\n\
               --function=<value>    Function id UUID to scope this memory to.\n\
               --if-version=<value>  Compare-and-delete version.\n\
               --org                 Force org scope.\n\
               --time                Print the wall-clock duration to stderr.\n"
        ),
        Some(MemoryCommandKind::Search) => format!(
            "Search memories\n\
             \n\
             USAGE\n\
               {bin} memories search [prefix] [--api-key <value>] [--function <value> | --org] [--limit <value>] [--cursor <value>] [--metadata-only] [--updated-after <timestamp>] [--updated-before <timestamp>] [--time]\n\
             \n\
             ARGUMENTS\n\
               [prefix]  Key prefix. Omit to list all active memories in scope.\n\
             \n\
             FLAGS\n\
               --api-key=<value>         Primitive API key override.\n\
               --cursor=<value>          Key cursor from a previous response.\n\
               --function=<value>        Function id UUID to scope this memory to.\n\
               --limit=<value>           Maximum results to return.\n\
               --metadata-only           Omit memory values and return metadata only.\n\
               --org                     Force org scope.\n\
               --time                    Print the wall-clock duration to stderr.\n\
               --updated-after=<value>   Only include memories updated at or after this timestamp.\n\
               --updated-before=<value>  Only include memories updated at or before this timestamp.\n"
        ),
        None => format!(
            "Primitive Rust CLI memories commands\n\
             \n\
             USAGE\n\
               {bin} memories <command>\n\
             \n\
             COMMANDS\n\
               memories set     Set a memory\n\
               memories get     Get a memory\n\
               memories delete  Delete a memory\n\
               memories search  Search memories\n"
        ),
    }
}

fn print_help(kind: Option<MemoryCommandKind>) {
    print!("{}", memories_help_text_for_kind(kind));
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
}
