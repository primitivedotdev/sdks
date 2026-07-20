use crate::client;
use crate::config;
use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde::Serialize;
use serde_json::{Map, Number, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::time::Instant;

const MATCH_TYPES: &[&str] = &["exact", "wildcard", "regex"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RouteCommandKind {
    Add,
    List,
    Test,
    Update,
    Reorder,
    Remove,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RouteCommandAlias {
    pub alias: &'static str,
    pub target_operation_id: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct RouteApiRequest {
    pub target_operation_id: &'static str,
    pub method: &'static str,
    pub path: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RouteTarget {
    Function { function_id: String },
    Endpoint { endpoint_id: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateRouteInput {
    pub pattern: String,
    pub match_type: String,
    pub target: RouteTarget,
    pub domain_id: Option<String>,
    pub priority: Option<u64>,
    pub disabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SimulateRouteInput {
    pub recipient: String,
    pub event_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateRouteInput {
    pub id: String,
    pub match_type: Option<String>,
    pub pattern: Option<String>,
    pub endpoint_id: Option<String>,
    pub domain_id: Option<String>,
    pub priority: Option<u64>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReorderRouteUpdate {
    pub id: String,
    pub priority: u64,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

pub fn route_command_aliases() -> &'static [RouteCommandAlias] {
    &[
        RouteCommandAlias {
            alias: "routes:add",
            target_operation_id: "routes:create-route",
        },
        RouteCommandAlias {
            alias: "routes:list",
            target_operation_id: "routes:list-routes",
        },
        RouteCommandAlias {
            alias: "routes:test",
            target_operation_id: "routes:simulate-route",
        },
        RouteCommandAlias {
            alias: "routes:update",
            target_operation_id: "routes:update-route",
        },
        RouteCommandAlias {
            alias: "routes:reorder",
            target_operation_id: "routes:reorder-routes",
        },
        RouteCommandAlias {
            alias: "routes:remove",
            target_operation_id: "routes:delete-route",
        },
    ]
}

pub fn route_command_target(command: &str) -> Option<&'static str> {
    route_command_kind(command).map(target_operation_id)
}

pub fn is_routes_friendly_command(command: &str) -> bool {
    matches!(
        command,
        "routes:add"
            | "routes:list"
            | "routes:test"
            | "routes:update"
            | "routes:reorder"
            | "routes:remove"
    )
}

pub fn build_route_request(command: &str, args: &[String]) -> Result<RouteApiRequest> {
    match route_command_kind(command) {
        Some(RouteCommandKind::Add) => build_routes_add_request_from_args(args),
        Some(RouteCommandKind::List) => build_routes_list_request_from_args(args),
        Some(RouteCommandKind::Test) => build_routes_test_request_from_args(args),
        Some(RouteCommandKind::Update) => build_routes_update_request_from_args(args),
        Some(RouteCommandKind::Reorder) => build_routes_reorder_request_from_args(args),
        Some(RouteCommandKind::Remove) => build_routes_remove_request_from_args(args),
        None => Err(crate::usage_err!("Unknown routes command `{command}`")),
    }
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help();
        return Ok(());
    }
    let (subcommand, rest) = args
        .split_first()
        .ok_or_else(|| anyhow!("routes commands require a subcommand"))?;
    execute_command(&format!("routes:{subcommand}"), rest)
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    if is_help_request(args) {
        if let Some(kind) = route_command_kind(command) {
            print_command_help(kind);
            return Ok(());
        }
    }

    let start = Instant::now();
    let request = build_route_request(command, args)?;
    let auth = config::resolve_auth(&auth_flags(args)?)?;
    let output = execute_route_request(&request, &auth)?;
    println!("{}", serde_json::to_string_pretty(&output)?);
    if has_time_flag(args) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

pub fn build_routes_add_request_from_args(args: &[String]) -> Result<RouteApiRequest> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "function",
            "endpoint",
            "match",
            "domain",
            "priority",
        ],
        &["disabled", "time"],
        &[],
    )?;
    let pattern = single_positional(&parsed, "routes add requires a pattern")?;
    let target =
        resolve_create_target(flag_one(&parsed, "function"), flag_one(&parsed, "endpoint"))?;
    build_create_route_request(&CreateRouteInput {
        pattern,
        match_type: flag_one(&parsed, "match").unwrap_or_else(|| "exact".to_string()),
        target,
        domain_id: flag_one(&parsed, "domain"),
        priority: optional_u64_flag(&parsed, "priority")?,
        disabled: parsed.bool_flags.get("disabled") == Some(&true),
    })
}

pub fn build_routes_list_request_from_args(args: &[String]) -> Result<RouteApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &[])?;
    reject_positionals(&parsed)?;
    Ok(route_request(
        RouteCommandKind::List,
        "/routes".to_string(),
        None,
    ))
}

pub fn build_routes_test_request_from_args(args: &[String]) -> Result<RouteApiRequest> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url", "event-type"],
        &["time"],
        &[],
    )?;
    let recipient = single_positional(&parsed, "routes test requires a recipient")?;
    build_simulate_route_request(&SimulateRouteInput {
        recipient,
        event_type: flag_one(&parsed, "event-type"),
    })
}

pub fn build_routes_update_request_from_args(args: &[String]) -> Result<RouteApiRequest> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "match",
            "pattern",
            "endpoint",
            "domain",
            "priority",
        ],
        &["enable", "disable", "time"],
        &[],
    )?;
    let id = single_positional(&parsed, "routes update requires a route id")?;
    let enabled = enabled_from_update_flags(&parsed)?;
    build_update_route_request(&UpdateRouteInput {
        id,
        match_type: flag_one(&parsed, "match"),
        pattern: flag_one(&parsed, "pattern"),
        endpoint_id: flag_one(&parsed, "endpoint"),
        domain_id: flag_one(&parsed, "domain"),
        priority: optional_u64_flag(&parsed, "priority")?,
        enabled,
    })
}

pub fn build_routes_reorder_request_from_args(args: &[String]) -> Result<RouteApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &["set"])?;
    reject_positionals(&parsed)?;
    let set_values = flag_many(&parsed, "set");
    if set_values.is_empty() {
        return Err(anyhow!("routes reorder requires at least one --set value"));
    }
    build_reorder_routes_request(&parse_reorder_updates(&set_values)?)
}

pub fn build_routes_remove_request_from_args(args: &[String]) -> Result<RouteApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &[])?;
    let id = single_positional(&parsed, "routes remove requires a route id")?;
    Ok(route_request(
        RouteCommandKind::Remove,
        format!("/routes/{}", urlencoding::encode(&id)),
        None,
    ))
}

pub fn resolve_create_target(
    function_id: Option<String>,
    endpoint_id: Option<String>,
) -> Result<RouteTarget> {
    match (present_value(function_id), present_value(endpoint_id)) {
        (Some(function_id), None) => Ok(RouteTarget::Function { function_id }),
        (None, Some(endpoint_id)) => Ok(RouteTarget::Endpoint { endpoint_id }),
        (None, None) => Err(anyhow!(
            "Provide exactly one of --function (route to a function) or --endpoint (an existing endpoint)."
        )),
        (Some(_), Some(_)) => Err(anyhow!(
            "Provide exactly one of --function (route to a function) or --endpoint (an existing endpoint)."
        )),
    }
}

pub fn build_create_route_body(input: &CreateRouteInput) -> Result<Value> {
    validate_match_type(&input.match_type)?;
    let mut body = Map::new();
    insert_string(&mut body, "match_type", &input.match_type);
    insert_string(&mut body, "pattern", &input.pattern);
    match &input.target {
        RouteTarget::Function { function_id } => {
            insert_string(&mut body, "function_id", function_id);
        }
        RouteTarget::Endpoint { endpoint_id } => {
            insert_string(&mut body, "endpoint_id", endpoint_id);
        }
    }
    insert_optional_string(&mut body, "domain_id", input.domain_id.as_ref());
    insert_optional_u64(&mut body, "priority", input.priority);
    if input.disabled {
        body.insert("enabled".to_string(), Value::Bool(false));
    }
    Ok(Value::Object(body))
}

pub fn build_create_route_request(input: &CreateRouteInput) -> Result<RouteApiRequest> {
    Ok(route_request(
        RouteCommandKind::Add,
        "/routes".to_string(),
        Some(build_create_route_body(input)?),
    ))
}

pub fn build_simulate_route_body(input: &SimulateRouteInput) -> Value {
    let mut body = Map::new();
    insert_string(&mut body, "recipient", &input.recipient);
    insert_optional_string(&mut body, "event_type", input.event_type.as_ref());
    Value::Object(body)
}

pub fn build_simulate_route_request(input: &SimulateRouteInput) -> Result<RouteApiRequest> {
    Ok(route_request(
        RouteCommandKind::Test,
        "/routes/simulate".to_string(),
        Some(build_simulate_route_body(input)),
    ))
}

pub fn build_update_route_body(input: &UpdateRouteInput) -> Result<Value> {
    let mut body = Map::new();
    if let Some(match_type) = &input.match_type {
        validate_match_type(match_type)?;
        insert_string(&mut body, "match_type", match_type);
    }
    insert_optional_string(&mut body, "pattern", input.pattern.as_ref());
    insert_optional_string(&mut body, "endpoint_id", input.endpoint_id.as_ref());
    insert_optional_string(&mut body, "domain_id", input.domain_id.as_ref());
    insert_optional_u64(&mut body, "priority", input.priority);
    if let Some(enabled) = input.enabled {
        body.insert("enabled".to_string(), Value::Bool(enabled));
    }
    if body.is_empty() {
        return Err(anyhow!(
            "Provide at least one field to update (--match, --pattern, --endpoint, --domain, --priority, --enable/--disable)."
        ));
    }
    Ok(Value::Object(body))
}

pub fn build_update_route_request(input: &UpdateRouteInput) -> Result<RouteApiRequest> {
    Ok(route_request(
        RouteCommandKind::Update,
        format!("/routes/{}", urlencoding::encode(&input.id)),
        Some(build_update_route_body(input)?),
    ))
}

pub fn parse_reorder_updates(set: &[String]) -> Result<Vec<ReorderRouteUpdate>> {
    let mut updates = Vec::with_capacity(set.len());
    let mut seen = BTreeSet::new();
    for pair in set {
        let (raw_id, raw_priority) = pair.split_once('=').ok_or_else(|| {
            anyhow!(
                "Invalid --set value \"{pair}\"; expected <route-id>=<priority> with a non-negative integer priority."
            )
        })?;
        let id = raw_id.trim().to_lowercase();
        let priority = parse_u64_flag_value("set", raw_priority.trim()).map_err(|_| {
            anyhow!(
                "Invalid --set value \"{pair}\"; expected <route-id>=<priority> with a non-negative integer priority."
            )
        })?;
        if id.is_empty() {
            return Err(anyhow!(
                "Invalid --set value \"{pair}\"; expected <route-id>=<priority> with a non-negative integer priority."
            ));
        }
        if !seen.insert(id.clone()) {
            return Err(anyhow!(
                "Route {id} appears more than once in --set; specify each route at most once."
            ));
        }
        updates.push(ReorderRouteUpdate { id, priority });
    }
    Ok(updates)
}

pub fn build_reorder_routes_body(updates: &[ReorderRouteUpdate]) -> Result<Value> {
    if updates.is_empty() {
        return Err(anyhow!("routes reorder requires at least one --set value"));
    }
    let values = updates
        .iter()
        .map(|update| {
            let mut item = Map::new();
            insert_string(&mut item, "id", &update.id);
            insert_u64(&mut item, "priority", update.priority);
            Value::Object(item)
        })
        .collect();
    let mut body = Map::new();
    body.insert("updates".to_string(), Value::Array(values));
    Ok(Value::Object(body))
}

pub fn build_reorder_routes_request(updates: &[ReorderRouteUpdate]) -> Result<RouteApiRequest> {
    Ok(route_request(
        RouteCommandKind::Reorder,
        "/routes/reorder".to_string(),
        Some(build_reorder_routes_body(updates)?),
    ))
}

fn route_command_kind(command: &str) -> Option<RouteCommandKind> {
    let normalized = command.split_whitespace().collect::<Vec<_>>().join(":");
    let command = normalized
        .strip_prefix("routes:")
        .unwrap_or(normalized.as_str());
    match command {
        "add" | "create-route" => Some(RouteCommandKind::Add),
        "list" | "list-routes" => Some(RouteCommandKind::List),
        "test" | "simulate-route" => Some(RouteCommandKind::Test),
        "update" | "update-route" => Some(RouteCommandKind::Update),
        "reorder" | "reorder-routes" => Some(RouteCommandKind::Reorder),
        "remove" | "delete-route" => Some(RouteCommandKind::Remove),
        _ => None,
    }
}

fn target_operation_id(kind: RouteCommandKind) -> &'static str {
    match kind {
        RouteCommandKind::Add => "routes:create-route",
        RouteCommandKind::List => "routes:list-routes",
        RouteCommandKind::Test => "routes:simulate-route",
        RouteCommandKind::Update => "routes:update-route",
        RouteCommandKind::Reorder => "routes:reorder-routes",
        RouteCommandKind::Remove => "routes:delete-route",
    }
}

fn method(kind: RouteCommandKind) -> &'static str {
    match kind {
        RouteCommandKind::Add | RouteCommandKind::Test | RouteCommandKind::Reorder => "POST",
        RouteCommandKind::List => "GET",
        RouteCommandKind::Update => "PATCH",
        RouteCommandKind::Remove => "DELETE",
    }
}

fn route_request(kind: RouteCommandKind, path: String, body: Option<Value>) -> RouteApiRequest {
    RouteApiRequest {
        target_operation_id: target_operation_id(kind),
        method: method(kind),
        path,
        query: BTreeMap::new(),
        body,
    }
}

fn execute_route_request(request: &RouteApiRequest, auth: &config::ResolvedAuth) -> Result<Value> {
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
    args.iter()
        .any(|arg| arg == "--time" || arg == "--time=true")
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive Rust CLI routes commands:");
    println!("  {bin} routes add <pattern> (--function <id> | --endpoint <id>)");
    println!("  {bin} routes list");
    println!("  {bin} routes test <recipient>");
    println!("  {bin} routes update <id> [flags]");
    println!("  {bin} routes reorder --set <id=priority>");
    println!("  {bin} routes remove <id>");
}

pub fn leaf_help(command: &str) -> Option<String> {
    route_command_kind(command).and_then(help_for_kind)
}

fn print_command_help(kind: RouteCommandKind) {
    if let Some(help) = help_for_kind(kind) {
        print!("{help}");
    } else {
        print_help();
    }
}

fn help_for_kind(kind: RouteCommandKind) -> Option<String> {
    match kind {
        RouteCommandKind::Add => Some(routes_add_help()),
        RouteCommandKind::List => Some(routes_list_help()),
        RouteCommandKind::Test => Some(routes_test_help()),
        RouteCommandKind::Update => Some(routes_update_help()),
        RouteCommandKind::Reorder => Some(routes_reorder_help()),
        RouteCommandKind::Remove => Some(routes_remove_help()),
    }
}

fn routes_add_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
Add a recipient route

USAGE
  {bin} routes add <pattern> [--api-key <value>] [--time] (--function <value> | --endpoint <value>)
  [--match <exact|wildcard|regex>] [--domain <value>] [--priority <value>] [--disabled]

ARGUMENTS
  <pattern>  Recipient address or wildcard pattern.

FLAGS
  --api-key <value>    Primitive API key override.
  --function <value>   Function id to route this address to. Mutually exclusive with --endpoint.
  --endpoint <value>   Existing endpoint id to route to. Mutually exclusive with --function.
  --match <value>      Match type for the pattern (exact, wildcard, regex; default exact).
  --domain <value>     Scope the route to this domain id.
  --priority <value>   Evaluation order within a scope; lower is checked first.
  --disabled           Create the route disabled.
  --time               Print the wall-clock duration to stderr after completion.
"
    )
}

fn routes_list_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
List recipient routes

USAGE
  {bin} routes list [--api-key <value>] [--time]

FLAGS
  --api-key <value>  Primitive API key override.
  --time             Print the wall-clock duration to stderr after completion.
"
    )
}

fn routes_test_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
Simulate routing for a recipient

USAGE
  {bin} routes test <recipient> [--api-key <value>] [--time] [--event-type <value>]

ARGUMENTS
  <recipient>  Recipient address to simulate.

FLAGS
  --api-key <value>     Primitive API key override.
  --event-type <value>  Event type to model (defaults to email.received).
  --time                Print the wall-clock duration to stderr after completion.
"
    )
}

fn routes_update_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
Update a recipient route

USAGE
  {bin} routes update <id> [--api-key <value>] [--time] [--match <exact|wildcard|regex>]
  [--pattern <value>] [--endpoint <value>] [--domain <value>] [--priority <value>]
  [--enable | --disable]

ARGUMENTS
  <id>  Route id to update.

FLAGS
  --api-key <value>   Primitive API key override.
  --match <value>     New match type for the pattern (exact, wildcard, regex).
  --pattern <value>   New recipient address or wildcard pattern.
  --endpoint <value>  New target endpoint id.
  --domain <value>    New domain scope id.
  --priority <value>  New evaluation priority within a scope; lower is checked first.
  --enable            Enable the route. Mutually exclusive with --disable.
  --disable           Disable the route. Mutually exclusive with --enable.
  --time              Print the wall-clock duration to stderr after completion.
"
    )
}

fn routes_reorder_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
Reorder recipient routes

USAGE
  {bin} routes reorder [--api-key <value>] [--time] --set <route-id=priority>...

FLAGS
  --api-key <value>  Primitive API key override.
  --set <value>      A route and its new priority as <route-id>=<priority>. Repeatable.
  --time             Print the wall-clock duration to stderr after completion.
"
    )
}

fn routes_remove_help() -> String {
    let bin = crate::display_bin_name();
    format!(
        "\
Remove a recipient route

USAGE
  {bin} routes remove <id> [--api-key <value>] [--time]

ARGUMENTS
  <id>  Route id to delete.

FLAGS
  --api-key <value>  Primitive API key override.
  --time             Print the wall-clock duration to stderr after completion.
"
    )
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

fn reject_positionals(parsed: &ParsedArgs) -> Result<()> {
    if let Some(value) = parsed.positionals.first() {
        return Err(crate::usage_err!("Unexpected argument: {value}"));
    }
    Ok(())
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

fn enabled_from_update_flags(parsed: &ParsedArgs) -> Result<Option<bool>> {
    let enable = parsed.bool_flags.get("enable") == Some(&true);
    let disable = parsed.bool_flags.get("disable") == Some(&true);
    match (enable, disable) {
        (true, true) => Err(anyhow!("Use either --enable or --disable, not both.")),
        (true, false) => Ok(Some(true)),
        (false, true) => Ok(Some(false)),
        (false, false) => Ok(None),
    }
}

fn present_value(value: Option<String>) -> Option<String> {
    value.filter(|value| !value.is_empty())
}

fn validate_match_type(value: &str) -> Result<()> {
    if MATCH_TYPES.contains(&value) {
        Ok(())
    } else {
        Err(anyhow!(
            "Expected --match to be one of: {}",
            MATCH_TYPES.join(", ")
        ))
    }
}

fn insert_string(body: &mut Map<String, Value>, key: &str, value: &str) {
    body.insert(key.to_string(), Value::String(value.to_string()));
}

fn insert_optional_string(body: &mut Map<String, Value>, key: &str, value: Option<&String>) {
    if let Some(value) = value {
        body.insert(key.to_string(), Value::String(value.clone()));
    }
}

fn insert_optional_u64(body: &mut Map<String, Value>, key: &str, value: Option<u64>) {
    if let Some(value) = value {
        insert_u64(body, key, value);
    }
}

fn insert_u64(body: &mut Map<String, Value>, key: &str, value: u64) {
    body.insert(key.to_string(), Value::Number(Number::from(value)));
}
