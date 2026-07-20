use crate::client;
use crate::config;
use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::time::Instant;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WakeCommandKind {
    ScheduleList,
    ScheduleCreate,
    ScheduleGet,
    ScheduleUpdate,
    ScheduleDelete,
    ScheduleRun,
    AuthorizationList,
    AuthorizationCreate,
    AuthorizationUpdate,
    AuthorizationDelete,
    DispatchList,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WakeTopic {
    Schedules,
    Authorizations,
    Dispatches,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct WakeTopicCommand {
    subcommand: &'static str,
    summary: &'static str,
    alias: &'static str,
    target_operation_id: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WakeCommandAlias {
    pub alias: &'static str,
    pub target_operation_id: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct WakeApiRequest {
    pub target_operation_id: &'static str,
    pub method: &'static str,
    pub path: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

pub fn wake_command_aliases() -> &'static [WakeCommandAlias] {
    &[
        WakeCommandAlias {
            alias: "wake:schedules:list",
            target_operation_id: "wake:list-wake-schedules",
        },
        WakeCommandAlias {
            alias: "wake:schedules:create",
            target_operation_id: "wake:create-wake-schedule",
        },
        WakeCommandAlias {
            alias: "wake:schedules:get",
            target_operation_id: "wake:get-wake-schedule",
        },
        WakeCommandAlias {
            alias: "wake:schedules:update",
            target_operation_id: "wake:update-wake-schedule",
        },
        WakeCommandAlias {
            alias: "wake:schedules:delete",
            target_operation_id: "wake:delete-wake-schedule",
        },
        WakeCommandAlias {
            alias: "wake:schedules:run",
            target_operation_id: "wake:run-wake-schedule",
        },
        WakeCommandAlias {
            alias: "wake:authorizations:list",
            target_operation_id: "wake:list-wake-authorizations",
        },
        WakeCommandAlias {
            alias: "wake:authorizations:create",
            target_operation_id: "wake:create-wake-authorization",
        },
        WakeCommandAlias {
            alias: "wake:authorizations:update",
            target_operation_id: "wake:update-wake-authorization",
        },
        WakeCommandAlias {
            alias: "wake:authorizations:delete",
            target_operation_id: "wake:delete-wake-authorization",
        },
        WakeCommandAlias {
            alias: "wake:dispatches:list",
            target_operation_id: "wake:list-wake-dispatches",
        },
    ]
}

pub fn wake_command_target(command: &str) -> Option<&'static str> {
    wake_command_kind(command).map(target_operation_id)
}

pub fn is_wake_friendly_command(command: &str) -> bool {
    let normalized = normalize_command(command);
    if wake_topic_from_command(&normalized).is_some() {
        return true;
    }
    matches!(
        normalized.as_str(),
        "wake:schedules:list"
            | "wake:schedules:create"
            | "wake:schedules:get"
            | "wake:schedules:update"
            | "wake:schedules:delete"
            | "wake:schedules:run"
            | "wake:authorizations:list"
            | "wake:authorizations:create"
            | "wake:authorizations:update"
            | "wake:authorizations:delete"
            | "wake:dispatches:list"
    )
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help();
        return Ok(());
    }
    if let Some(topic) = wake_topic_help_request(args) {
        print_topic_help(topic);
        return Ok(());
    }

    let (command, rest) = split_dispatch_command(args)?;
    execute_command(&command, rest)
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    if let Some(topic) = wake_topic_from_command(command) {
        if args.is_empty() || is_help_request(args) {
            print_topic_help(topic);
            return Ok(());
        }
    }
    if is_help_request(args) {
        if let Some(kind) = wake_command_kind(command) {
            print_command_help(kind);
            return Ok(());
        }
        print_help();
        return Ok(());
    }

    let start = Instant::now();
    let request = build_wake_request(command, args)?;
    let auth = config::resolve_auth(&auth_flags(args)?)?;
    let output = execute_wake_request(&request, &auth)?;
    println!("{}", serde_json::to_string_pretty(&output)?);
    if has_time_flag(args) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

pub fn build_wake_request(command: &str, args: &[String]) -> Result<WakeApiRequest> {
    match wake_command_kind(command) {
        Some(WakeCommandKind::ScheduleList) => build_wake_schedules_list_request_from_args(args),
        Some(WakeCommandKind::ScheduleCreate) => {
            build_wake_schedules_create_request_from_args(args)
        }
        Some(WakeCommandKind::ScheduleGet) => build_wake_schedules_get_request_from_args(args),
        Some(WakeCommandKind::ScheduleUpdate) => {
            build_wake_schedules_update_request_from_args(args)
        }
        Some(WakeCommandKind::ScheduleDelete) => {
            build_wake_schedules_delete_request_from_args(args)
        }
        Some(WakeCommandKind::ScheduleRun) => build_wake_schedules_run_request_from_args(args),
        Some(WakeCommandKind::AuthorizationList) => {
            build_wake_authorizations_list_request_from_args(args)
        }
        Some(WakeCommandKind::AuthorizationCreate) => {
            build_wake_authorizations_create_request_from_args(args)
        }
        Some(WakeCommandKind::AuthorizationUpdate) => {
            build_wake_authorizations_update_request_from_args(args)
        }
        Some(WakeCommandKind::AuthorizationDelete) => {
            build_wake_authorizations_delete_request_from_args(args)
        }
        Some(WakeCommandKind::DispatchList) => build_wake_dispatches_list_request_from_args(args),
        None => Err(crate::usage_err!("Unknown wake command `{command}`")),
    }
}

pub fn build_wake_schedules_list_request_from_args(args: &[String]) -> Result<WakeApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &[])?;
    reject_positionals(&parsed)?;
    Ok(wake_request(
        WakeCommandKind::ScheduleList,
        "/wake/schedules",
        BTreeMap::new(),
        None,
    ))
}

pub fn build_wake_schedules_create_request_from_args(args: &[String]) -> Result<WakeApiRequest> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "from",
            "to",
            "command",
            "cron",
            "timezone",
            "args",
            "note",
        ],
        &["time"],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let mut body = Map::new();
    insert_required_string(&mut body, "from_address", &parsed, "from")?;
    insert_required_string(&mut body, "target_address", &parsed, "to")?;
    insert_required_string(&mut body, "command", &parsed, "command")?;
    insert_required_string(&mut body, "cron_expr", &parsed, "cron")?;
    insert_optional_non_empty_string(&mut body, "timezone", flag_one(&parsed, "timezone"));
    insert_optional_args(&mut body, flag_one(&parsed, "args"))?;
    insert_optional_non_empty_string(&mut body, "note", flag_one(&parsed, "note"));
    Ok(wake_request(
        WakeCommandKind::ScheduleCreate,
        "/wake/schedules",
        BTreeMap::new(),
        Some(Value::Object(body)),
    ))
}

pub fn build_wake_schedules_get_request_from_args(args: &[String]) -> Result<WakeApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &[])?;
    let id = single_positional(&parsed, "wake schedules get requires a schedule id")?;
    Ok(wake_request(
        WakeCommandKind::ScheduleGet,
        &format!("/wake/schedules/{}", urlencoding::encode(&id)),
        BTreeMap::new(),
        None,
    ))
}

pub fn build_wake_schedules_update_request_from_args(args: &[String]) -> Result<WakeApiRequest> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "from",
            "to",
            "command",
            "cron",
            "timezone",
            "args",
            "note",
        ],
        &["enabled", "time"],
        &[],
    )?;
    let id = single_positional(&parsed, "wake schedules update requires a schedule id")?;
    let mut body = Map::new();
    insert_optional_bool(
        &mut body,
        "enabled",
        parsed.bool_flags.get("enabled").copied(),
    );
    insert_optional_non_empty_string(&mut body, "command", flag_one(&parsed, "command"));
    insert_optional_non_empty_string(&mut body, "cron_expr", flag_one(&parsed, "cron"));
    insert_optional_non_empty_string(&mut body, "timezone", flag_one(&parsed, "timezone"));
    insert_optional_non_empty_string(&mut body, "from_address", flag_one(&parsed, "from"));
    insert_optional_non_empty_string(&mut body, "target_address", flag_one(&parsed, "to"));
    insert_optional_args(&mut body, flag_one(&parsed, "args"))?;
    insert_optional_non_empty_string(&mut body, "note", flag_one(&parsed, "note"));
    Ok(wake_request(
        WakeCommandKind::ScheduleUpdate,
        &format!("/wake/schedules/{}", urlencoding::encode(&id)),
        BTreeMap::new(),
        Some(Value::Object(body)),
    ))
}

pub fn build_wake_schedules_delete_request_from_args(args: &[String]) -> Result<WakeApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &[])?;
    let id = single_positional(&parsed, "wake schedules delete requires a schedule id")?;
    Ok(wake_request(
        WakeCommandKind::ScheduleDelete,
        &format!("/wake/schedules/{}", urlencoding::encode(&id)),
        BTreeMap::new(),
        None,
    ))
}

pub fn build_wake_schedules_run_request_from_args(args: &[String]) -> Result<WakeApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &[])?;
    let id = single_positional(&parsed, "wake schedules run requires a schedule id")?;
    Ok(wake_request(
        WakeCommandKind::ScheduleRun,
        &format!("/wake/schedules/{}/run", urlencoding::encode(&id)),
        BTreeMap::new(),
        None,
    ))
}

pub fn build_wake_authorizations_list_request_from_args(args: &[String]) -> Result<WakeApiRequest> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url", "endpoint"],
        &["time"],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let mut query = BTreeMap::new();
    if let Some(endpoint) = non_empty(flag_one(&parsed, "endpoint")) {
        query.insert("recipient_endpoint_id".to_string(), endpoint);
    }
    Ok(wake_request(
        WakeCommandKind::AuthorizationList,
        "/wake/authorizations",
        query,
        None,
    ))
}

pub fn build_wake_authorizations_create_request_from_args(
    args: &[String],
) -> Result<WakeApiRequest> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "endpoint",
            "domain",
            "address",
            "note",
        ],
        &["time"],
        &["command"],
    )?;
    reject_positionals(&parsed)?;
    let mut body = Map::new();
    insert_required_string(&mut body, "recipient_endpoint_id", &parsed, "endpoint")?;
    insert_required_string(&mut body, "allowed_sender_domain", &parsed, "domain")?;
    insert_optional_non_empty_string(
        &mut body,
        "allowed_sender_address",
        flag_one(&parsed, "address"),
    );
    let commands = flag_many(&parsed, "command")
        .into_iter()
        .filter(|value| !value.is_empty())
        .map(Value::String)
        .collect::<Vec<_>>();
    if !commands.is_empty() {
        body.insert("allowed_commands".to_string(), Value::Array(commands));
    }
    insert_optional_non_empty_string(&mut body, "note", flag_one(&parsed, "note"));
    Ok(wake_request(
        WakeCommandKind::AuthorizationCreate,
        "/wake/authorizations",
        BTreeMap::new(),
        Some(Value::Object(body)),
    ))
}

pub fn build_wake_authorizations_update_request_from_args(
    args: &[String],
) -> Result<WakeApiRequest> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url"],
        &["enabled", "time"],
        &[],
    )?;
    let id = single_positional(
        &parsed,
        "wake authorizations update requires an authorization id",
    )?;
    let enabled =
        parsed.bool_flags.get("enabled").copied().ok_or_else(|| {
            anyhow!("Pass --enabled or --no-enabled to set the authorization state")
        })?;
    let mut body = Map::new();
    insert_optional_bool(&mut body, "enabled", Some(enabled));
    Ok(wake_request(
        WakeCommandKind::AuthorizationUpdate,
        &format!("/wake/authorizations/{}", urlencoding::encode(&id)),
        BTreeMap::new(),
        Some(Value::Object(body)),
    ))
}

pub fn build_wake_authorizations_delete_request_from_args(
    args: &[String],
) -> Result<WakeApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &[])?;
    let id = single_positional(
        &parsed,
        "wake authorizations delete requires an authorization id",
    )?;
    Ok(wake_request(
        WakeCommandKind::AuthorizationDelete,
        &format!("/wake/authorizations/{}", urlencoding::encode(&id)),
        BTreeMap::new(),
        None,
    ))
}

pub fn build_wake_dispatches_list_request_from_args(args: &[String]) -> Result<WakeApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url", "limit"], &["time"], &[])?;
    reject_positionals(&parsed)?;
    let mut query = BTreeMap::new();
    if let Some(limit) = optional_u64_flag(&parsed, "limit")? {
        query.insert("limit".to_string(), limit.to_string());
    }
    Ok(wake_request(
        WakeCommandKind::DispatchList,
        "/wake/dispatches",
        query,
        None,
    ))
}

fn split_dispatch_command(args: &[String]) -> Result<(String, &[String])> {
    let first = args
        .first()
        .ok_or_else(|| anyhow!("wake commands require a group and subcommand"))?;
    if first.contains(':') {
        let command = if first.starts_with("wake:") {
            first.clone()
        } else {
            format!("wake:{first}")
        };
        return Ok((command, &args[1..]));
    }
    let direct_command = format!("wake:{first}");
    if wake_command_kind(&direct_command).is_some() {
        return Ok((direct_command, &args[1..]));
    }

    let second = args
        .get(1)
        .ok_or_else(|| anyhow!("wake commands require a group and subcommand"))?;
    Ok((format!("wake:{first}:{second}"), &args[2..]))
}

fn wake_topic_help_request(args: &[String]) -> Option<WakeTopic> {
    match args {
        [topic] => wake_topic(topic),
        [topic, flag] if matches!(flag.as_str(), "--help" | "-h") => wake_topic(topic),
        _ => None,
    }
}

fn wake_topic(topic: &str) -> Option<WakeTopic> {
    let topic = topic.strip_prefix("wake:").unwrap_or(topic);
    match topic {
        "schedules" => Some(WakeTopic::Schedules),
        "authorizations" => Some(WakeTopic::Authorizations),
        "dispatches" => Some(WakeTopic::Dispatches),
        _ => None,
    }
}

fn wake_topic_from_command(command: &str) -> Option<WakeTopic> {
    let normalized = normalize_command(command);
    let topic = normalized.strip_prefix("wake:")?;
    wake_topic(topic)
}

fn wake_command_kind(command: &str) -> Option<WakeCommandKind> {
    let normalized = normalize_command(command);
    let command = normalized
        .strip_prefix("wake:")
        .unwrap_or(normalized.as_str());
    match command {
        "schedules:list" | "list-wake-schedules" => Some(WakeCommandKind::ScheduleList),
        "schedules:create" | "create-wake-schedule" => Some(WakeCommandKind::ScheduleCreate),
        "schedules:get" | "get-wake-schedule" => Some(WakeCommandKind::ScheduleGet),
        "schedules:update" | "update-wake-schedule" => Some(WakeCommandKind::ScheduleUpdate),
        "schedules:delete" | "delete-wake-schedule" => Some(WakeCommandKind::ScheduleDelete),
        "schedules:run" | "run-wake-schedule" => Some(WakeCommandKind::ScheduleRun),
        "authorizations:list" | "list-wake-authorizations" => {
            Some(WakeCommandKind::AuthorizationList)
        }
        "authorizations:create" | "create-wake-authorization" => {
            Some(WakeCommandKind::AuthorizationCreate)
        }
        "authorizations:update" | "update-wake-authorization" => {
            Some(WakeCommandKind::AuthorizationUpdate)
        }
        "authorizations:delete" | "delete-wake-authorization" => {
            Some(WakeCommandKind::AuthorizationDelete)
        }
        "dispatches:list" | "list-wake-dispatches" => Some(WakeCommandKind::DispatchList),
        _ => None,
    }
}

fn normalize_command(command: &str) -> String {
    command.split_whitespace().collect::<Vec<_>>().join(":")
}

fn target_operation_id(kind: WakeCommandKind) -> &'static str {
    match kind {
        WakeCommandKind::ScheduleList => "wake:list-wake-schedules",
        WakeCommandKind::ScheduleCreate => "wake:create-wake-schedule",
        WakeCommandKind::ScheduleGet => "wake:get-wake-schedule",
        WakeCommandKind::ScheduleUpdate => "wake:update-wake-schedule",
        WakeCommandKind::ScheduleDelete => "wake:delete-wake-schedule",
        WakeCommandKind::ScheduleRun => "wake:run-wake-schedule",
        WakeCommandKind::AuthorizationList => "wake:list-wake-authorizations",
        WakeCommandKind::AuthorizationCreate => "wake:create-wake-authorization",
        WakeCommandKind::AuthorizationUpdate => "wake:update-wake-authorization",
        WakeCommandKind::AuthorizationDelete => "wake:delete-wake-authorization",
        WakeCommandKind::DispatchList => "wake:list-wake-dispatches",
    }
}

fn method(kind: WakeCommandKind) -> &'static str {
    match kind {
        WakeCommandKind::ScheduleList
        | WakeCommandKind::ScheduleGet
        | WakeCommandKind::AuthorizationList
        | WakeCommandKind::DispatchList => "GET",
        WakeCommandKind::ScheduleCreate
        | WakeCommandKind::ScheduleRun
        | WakeCommandKind::AuthorizationCreate => "POST",
        WakeCommandKind::ScheduleUpdate | WakeCommandKind::AuthorizationUpdate => "PATCH",
        WakeCommandKind::ScheduleDelete | WakeCommandKind::AuthorizationDelete => "DELETE",
    }
}

fn wake_request(
    kind: WakeCommandKind,
    path: &str,
    query: BTreeMap<String, String>,
    body: Option<Value>,
) -> WakeApiRequest {
    WakeApiRequest {
        target_operation_id: target_operation_id(kind),
        method: method(kind),
        path: path.to_string(),
        query,
        body,
    }
}

fn execute_wake_request(request: &WakeApiRequest, auth: &config::ResolvedAuth) -> Result<Value> {
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
    let value = json.ok_or_else(|| anyhow!("HTTP {status} returned no JSON body"))?;
    if let Some(data) = value.get("data") {
        Ok(data.clone())
    } else {
        Ok(value)
    }
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
                    .ok_or_else(|| crate::usage_err!("Missing value for --{name}"))?
                    .clone()
            };
            flags.insert(name.to_string(), value);
        }
        index += 1;
    }
    Ok(flags)
}

fn has_time_flag(args: &[String]) -> bool {
    let mut enabled = false;
    for arg in args {
        match arg.as_str() {
            "--time" | "--time=true" => enabled = true,
            "--no-time" | "--time=false" => enabled = false,
            _ => {}
        }
    }
    enabled
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive Rust CLI wake commands:");
    println!("  {bin} wake schedules list [--api-key <value>] [--time]");
    println!("  {bin} wake schedules create --from <address> --to <address> --command <name> --cron <expr> [--api-key <value>] [--args <json>] [--timezone <name>] [--note <text>] [--time]");
    println!("  {bin} wake schedules get <id> [--api-key <value>] [--time]");
    println!("  {bin} wake schedules update <id> [--api-key <value>] [--from <address>] [--to <address>] [--command <name>] [--cron <expr>] [--args <json>] [--timezone <name>] [--note <text>] [--enabled|--no-enabled] [--time]");
    println!("  {bin} wake schedules delete <id> [--api-key <value>] [--time]");
    println!("  {bin} wake schedules run <id> [--api-key <value>] [--time]");
    println!("  {bin} wake authorizations list [--api-key <value>] [--endpoint <id>] [--time]");
    println!("  {bin} wake authorizations create --endpoint <id> --domain <domain> [--api-key <value>] [--address <address>] [--command <name>] [--note <text>] [--time]");
    println!("  {bin} wake authorizations update <id> [--api-key <value>] --enabled|--no-enabled [--time]");
    println!("  {bin} wake authorizations delete <id> [--api-key <value>] [--time]");
    println!("  {bin} wake dispatches list [--api-key <value>] [--limit <n>] [--time]");
}

fn print_command_help(kind: WakeCommandKind) {
    match kind {
        WakeCommandKind::ScheduleList => {
            let bin = crate::display_bin_name();
            println!("List wake schedules");
            println!();
            println!("USAGE");
            println!("  {bin} wake schedules list [--api-key <value>] [--time]");
            print_standard_flags();
        }
        WakeCommandKind::ScheduleCreate => {
            let bin = crate::display_bin_name();
            println!("Create a wake schedule");
            println!();
            println!("USAGE");
            println!("  {bin} wake schedules create --from <address> --to <address> --command <name> --cron <expr> [--api-key <value>] [--args <json>] [--timezone <name>] [--note <text>] [--time]");
            println!();
            println!("FLAGS");
            print_standard_flag_lines();
            println!("  --from <address>       Sending identity address.");
            println!("  --to <address>         Target function address the wake is delivered to.");
            println!("  --command <name>       Wake command name.");
            println!("  --cron <expr>          5-field cron expression.");
            println!("  --timezone <name>      IANA timezone (default UTC).");
            println!("  --args <json>          Args as a JSON object.");
            println!("  --note <text>          Optional note.");
        }
        WakeCommandKind::ScheduleGet => {
            let bin = crate::display_bin_name();
            println!("Get a wake schedule");
            println!();
            println!("USAGE");
            println!("  {bin} wake schedules get <id> [--api-key <value>] [--time]");
            print_standard_flags();
        }
        WakeCommandKind::ScheduleUpdate => {
            let bin = crate::display_bin_name();
            println!("Update a wake schedule");
            println!();
            println!("USAGE");
            println!("  {bin} wake schedules update <id> [--api-key <value>] [--from <address>] [--to <address>] [--command <name>] [--cron <expr>] [--args <json>] [--timezone <name>] [--note <text>] [--enabled|--no-enabled] [--time]");
            println!();
            println!("FLAGS");
            print_standard_flag_lines();
            println!("  --from <address>       Sending identity address.");
            println!("  --to <address>         Target function address the wake is delivered to.");
            println!("  --command <name>       Wake command name.");
            println!("  --cron <expr>          5-field cron expression.");
            println!("  --timezone <name>      IANA timezone.");
            println!("  --args <json>          Args as a JSON object.");
            println!("  --note <text>          Optional note.");
            println!("  --enabled              Enable the schedule.");
            println!("  --no-enabled           Pause the schedule.");
        }
        WakeCommandKind::ScheduleDelete => {
            let bin = crate::display_bin_name();
            println!("Delete a wake schedule");
            println!();
            println!("USAGE");
            println!("  {bin} wake schedules delete <id> [--api-key <value>] [--time]");
            print_standard_flags();
        }
        WakeCommandKind::ScheduleRun => {
            let bin = crate::display_bin_name();
            println!("Run a wake schedule now");
            println!();
            println!("USAGE");
            println!("  {bin} wake schedules run <id> [--api-key <value>] [--time]");
            print_standard_flags();
        }
        WakeCommandKind::AuthorizationList => {
            let bin = crate::display_bin_name();
            println!("List wake authorizations");
            println!();
            println!("USAGE");
            println!(
                "  {bin} wake authorizations list [--api-key <value>] [--endpoint <id>] [--time]"
            );
            println!();
            println!("FLAGS");
            print_standard_flag_lines();
            println!("  --endpoint <id>        Only return grants for this target endpoint id.");
        }
        WakeCommandKind::AuthorizationCreate => {
            let bin = crate::display_bin_name();
            println!("Create a wake authorization");
            println!();
            println!("USAGE");
            println!("  {bin} wake authorizations create --endpoint <id> --domain <domain> [--api-key <value>] [--address <address>] [--command <name>] [--note <text>] [--time]");
            println!();
            println!("FLAGS");
            print_standard_flag_lines();
            println!("  --endpoint <id>        Target endpoint id.");
            println!("  --domain <domain>      Allowed sender domain.");
            println!("  --address <address>    Optional specific allowed sender address.");
            println!("  --command <name>       Allowed command (repeatable); omit for any.");
            println!("  --note <text>          Optional note.");
        }
        WakeCommandKind::AuthorizationUpdate => {
            let bin = crate::display_bin_name();
            println!("Update a wake authorization");
            println!();
            println!("USAGE");
            println!("  {bin} wake authorizations update <id> [--api-key <value>] --enabled|--no-enabled [--time]");
            println!();
            println!("FLAGS");
            print_standard_flag_lines();
            println!("  --enabled              Enable the authorization.");
            println!("  --no-enabled           Disable the authorization.");
        }
        WakeCommandKind::AuthorizationDelete => {
            let bin = crate::display_bin_name();
            println!("Delete a wake authorization");
            println!();
            println!("USAGE");
            println!("  {bin} wake authorizations delete <id> [--api-key <value>] [--time]");
            print_standard_flags();
        }
        WakeCommandKind::DispatchList => {
            let bin = crate::display_bin_name();
            println!("List recent wake dispatches");
            println!();
            println!("USAGE");
            println!("  {bin} wake dispatches list [--api-key <value>] [--limit <n>] [--time]");
            println!();
            println!("FLAGS");
            print_standard_flag_lines();
            println!("  --limit <n>            Max rows to return (1-200, default 50).");
        }
    }
}

fn print_standard_flags() {
    println!();
    println!("FLAGS");
    print_standard_flag_lines();
}

fn print_standard_flag_lines() {
    println!("  --api-key <value>      Primitive API key override.");
    println!("  --time                 Print request timing.");
}

fn print_topic_help(topic: WakeTopic) {
    let bin = crate::display_bin_name();
    println!("{}", wake_topic_summary(topic));
    println!();
    println!("USAGE");
    println!("  {bin} wake {} COMMAND", wake_topic_name(topic));
    println!();
    println!("COMMANDS");
    for command in wake_topic_commands(topic) {
        println!(
            "  wake {} {:<6}  {}",
            wake_topic_name(topic),
            command.subcommand,
            command.summary
        );
    }
    println!();
    println!("ALIASES");
    for command in wake_topic_commands(topic) {
        println!("  {bin} {}", command.alias);
        println!("  {bin} {}", command.target_operation_id);
    }
}

fn wake_topic_name(topic: WakeTopic) -> &'static str {
    match topic {
        WakeTopic::Schedules => "schedules",
        WakeTopic::Authorizations => "authorizations",
        WakeTopic::Dispatches => "dispatches",
    }
}

fn wake_topic_summary(topic: WakeTopic) -> &'static str {
    match topic {
        WakeTopic::Schedules => "Wake schedule commands",
        WakeTopic::Authorizations => "Wake authorization commands",
        WakeTopic::Dispatches => "Wake dispatch commands",
    }
}

fn wake_topic_commands(topic: WakeTopic) -> &'static [WakeTopicCommand] {
    match topic {
        WakeTopic::Schedules => &[
            WakeTopicCommand {
                subcommand: "create",
                summary: "Create a wake schedule",
                alias: "wake:schedules:create",
                target_operation_id: "wake:create-wake-schedule",
            },
            WakeTopicCommand {
                subcommand: "delete",
                summary: "Delete a wake schedule",
                alias: "wake:schedules:delete",
                target_operation_id: "wake:delete-wake-schedule",
            },
            WakeTopicCommand {
                subcommand: "get",
                summary: "Get a wake schedule",
                alias: "wake:schedules:get",
                target_operation_id: "wake:get-wake-schedule",
            },
            WakeTopicCommand {
                subcommand: "list",
                summary: "List wake schedules",
                alias: "wake:schedules:list",
                target_operation_id: "wake:list-wake-schedules",
            },
            WakeTopicCommand {
                subcommand: "run",
                summary: "Run a wake schedule now",
                alias: "wake:schedules:run",
                target_operation_id: "wake:run-wake-schedule",
            },
            WakeTopicCommand {
                subcommand: "update",
                summary: "Update a wake schedule",
                alias: "wake:schedules:update",
                target_operation_id: "wake:update-wake-schedule",
            },
        ],
        WakeTopic::Authorizations => &[
            WakeTopicCommand {
                subcommand: "create",
                summary: "Create a wake authorization",
                alias: "wake:authorizations:create",
                target_operation_id: "wake:create-wake-authorization",
            },
            WakeTopicCommand {
                subcommand: "delete",
                summary: "Delete a wake authorization",
                alias: "wake:authorizations:delete",
                target_operation_id: "wake:delete-wake-authorization",
            },
            WakeTopicCommand {
                subcommand: "list",
                summary: "List wake authorizations",
                alias: "wake:authorizations:list",
                target_operation_id: "wake:list-wake-authorizations",
            },
            WakeTopicCommand {
                subcommand: "update",
                summary: "Update a wake authorization",
                alias: "wake:authorizations:update",
                target_operation_id: "wake:update-wake-authorization",
            },
        ],
        WakeTopic::Dispatches => &[WakeTopicCommand {
            subcommand: "list",
            summary: "List recent wake dispatches",
            alias: "wake:dispatches:list",
            target_operation_id: "wake:list-wake-dispatches",
        }],
    }
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
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
                return Err(crate::usage_err!("Unknown boolean flag --no-{name}"));
            }
            parsed.bool_flags.insert(name.to_string(), false);
            index += 1;
            continue;
        }

        let raw = arg.trim_start_matches("--");
        let (name, inline_value) = raw
            .split_once('=')
            .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));
        if bool_flags.contains(name) {
            let value = inline_value
                .as_deref()
                .unwrap_or("true")
                .parse()
                .with_context(|| format!("Expected a boolean value for --{name}"))?;
            parsed.bool_flags.insert(name.to_string(), value);
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
            args.get(index)
                .ok_or_else(|| crate::usage_err!("Missing value for --{name}"))?
                .clone()
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

fn reject_positionals(parsed: &ParsedArgs) -> Result<()> {
    if let Some(value) = parsed.positionals.first() {
        return Err(crate::usage_err!("Unexpected argument: {value}"));
    }
    Ok(())
}

fn single_positional(parsed: &ParsedArgs, missing_message: &str) -> Result<String> {
    let value = parsed
        .positionals
        .first()
        .ok_or_else(|| anyhow!("{missing_message}"))?
        .clone();
    if let Some(extra) = parsed.positionals.get(1) {
        return Err(crate::usage_err!("Unexpected argument: {extra}"));
    }
    Ok(value)
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

fn required_flag(parsed: &ParsedArgs, name: &str) -> Result<String> {
    flag_one(parsed, name).ok_or_else(|| anyhow!("Missing required --{name}"))
}

fn optional_u64_flag(parsed: &ParsedArgs, name: &str) -> Result<Option<u64>> {
    flag_one(parsed, name)
        .map(|value| {
            value
                .parse::<u64>()
                .with_context(|| format!("Expected a non-negative integer for --{name}"))
        })
        .transpose()
}

fn parse_args_object(value: &str) -> Result<Value> {
    let parsed: Value = serde_json::from_str(value).context("--args must be valid JSON")?;
    if !parsed.is_object() {
        return Err(anyhow!("--args must be a JSON object"));
    }
    Ok(parsed)
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.is_empty())
}

fn insert_required_string(
    body: &mut Map<String, Value>,
    body_key: &str,
    parsed: &ParsedArgs,
    flag_name: &str,
) -> Result<()> {
    body.insert(
        body_key.to_string(),
        Value::String(required_flag(parsed, flag_name)?),
    );
    Ok(())
}

fn insert_optional_non_empty_string(
    body: &mut Map<String, Value>,
    key: &str,
    value: Option<String>,
) {
    if let Some(value) = non_empty(value) {
        body.insert(key.to_string(), Value::String(value));
    }
}

fn insert_optional_bool(body: &mut Map<String, Value>, key: &str, value: Option<bool>) {
    if let Some(value) = value {
        body.insert(key.to_string(), Value::Bool(value));
    }
}

fn insert_optional_args(body: &mut Map<String, Value>, value: Option<String>) -> Result<()> {
    if let Some(value) = non_empty(value) {
        body.insert("args".to_string(), parse_args_object(&value)?);
    }
    Ok(())
}
