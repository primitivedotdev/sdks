use crate::client;
use crate::config;
use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde::Serialize;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{self, IsTerminal, Read};
use std::time::Instant;

const LIST_ORG_SECRETS_OPERATION: &str = "functions:list-org-secrets";
const CREATE_ORG_SECRET_OPERATION: &str = "functions:create-org-secret";
const DELETE_ORG_SECRET_OPERATION: &str = "functions:delete-org-secret";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OrgSecretsCommandKind {
    List,
    Set,
    Remove,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OrgSecretsCommandAlias {
    pub alias: &'static str,
    pub target_operation_id: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct OrgSecretsApiRequest {
    pub target_operation_id: &'static str,
    pub method: &'static str,
    pub path: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OrgSecretsCommandPlan {
    pub target_operation_id: &'static str,
    pub request: OrgSecretsApiRequest,
    pub output_behavior: OrgSecretsOutputBehavior,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OrgSecretsOutputBehavior {
    Json,
    SetNotice { key: String },
    RemoveNotice { key: String },
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OrgSecretsTextOutput {
    pub stdout: Vec<String>,
    pub stderr: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SetOrgSecretCommandPlan {
    pub key: String,
    pub source: SingleSecretValueSource,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SingleSecretValueSourceInput {
    pub key: String,
    pub source: SingleSecretValueSource,
    pub env: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SingleSecretValueSource {
    Value(String),
    ValueFromEnv(String),
    ValueFile(String),
    ValueFromEnvFile(String),
    Stdin,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

pub fn org_secrets_command_aliases() -> &'static [OrgSecretsCommandAlias] {
    &[
        OrgSecretsCommandAlias {
            alias: "org:secrets:list",
            target_operation_id: LIST_ORG_SECRETS_OPERATION,
        },
        OrgSecretsCommandAlias {
            alias: "org:secrets:set",
            target_operation_id: CREATE_ORG_SECRET_OPERATION,
        },
        OrgSecretsCommandAlias {
            alias: "org:secrets:remove",
            target_operation_id: DELETE_ORG_SECRET_OPERATION,
        },
        OrgSecretsCommandAlias {
            alias: "org:secrets:delete",
            target_operation_id: DELETE_ORG_SECRET_OPERATION,
        },
    ]
}

pub fn org_secrets_command_target(command: &str) -> Option<&'static str> {
    org_secrets_command_kind(command).map(target_operation_id)
}

pub fn is_org_secrets_friendly_command(command: &str) -> bool {
    command == "org:secrets" || org_secrets_command_kind(command).is_some()
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty()
        || matches!(args[0].as_str(), "--help" | "-h")
        || matches!(
            args,
            [first, second] if first == "org" && second == "secrets"
        )
        || matches!(
            args,
            [first, second, third] if first == "org"
                && second == "secrets"
                && matches!(third.as_str(), "--help" | "-h")
        )
        || matches!(args, [first] if first == "secrets")
        || matches!(
            args,
            [first, second] if first == "secrets" && matches!(second.as_str(), "--help" | "-h")
        )
    {
        print_help();
        return Ok(());
    }

    let (command, rest) = dispatch_command_and_args(args)?;
    execute_command(&command, rest)
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    if args
        .first()
        .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h"))
    {
        if let Some(help) = org_secrets_leaf_help_text(command) {
            print!("{help}");
        } else {
            print_help();
        }
        return Ok(());
    }

    let start = Instant::now();
    let plan = build_org_secrets_command_plan(command, args)?;
    let auth = config::resolve_auth(&auth_flags(args)?)?;
    let output = execute_org_secrets_request(&plan.request, &auth)?;
    write_text_output(&render_org_secrets_output(&plan, &output)?);

    if has_time_flag(args) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

pub fn build_org_secrets_command_plan(
    command: &str,
    args: &[String],
) -> Result<OrgSecretsCommandPlan> {
    build_org_secrets_command_plan_with_io(
        command,
        args,
        std::env::vars().collect(),
        |path| fs::read_to_string(path).with_context(|| format!("Could not read {path}")),
        read_stdin_string,
    )
}

pub fn build_org_secrets_command_plan_with_io(
    command: &str,
    args: &[String],
    env: BTreeMap<String, String>,
    mut read_file: impl FnMut(&str) -> Result<String>,
    read_stdin: impl FnMut() -> Result<String>,
) -> Result<OrgSecretsCommandPlan> {
    let kind = org_secrets_command_kind(command)
        .ok_or_else(|| crate::usage_error(format!("Unknown org secrets command `{command}`")))?;
    match kind {
        OrgSecretsCommandKind::List => {
            let request = build_org_secrets_list_request_from_args(args)?;
            Ok(OrgSecretsCommandPlan {
                target_operation_id: request.target_operation_id,
                request,
                output_behavior: OrgSecretsOutputBehavior::Json,
            })
        }
        OrgSecretsCommandKind::Set => {
            let plan = parse_set_org_secret_command_plan(args)?;
            let value = resolve_single_secret_value(
                &SingleSecretValueSourceInput {
                    key: plan.key.clone(),
                    source: plan.source,
                    env,
                },
                |path| read_file(path),
                read_stdin,
            )?;
            let request = build_create_org_secret_request(&plan.key, &value)?;
            Ok(OrgSecretsCommandPlan {
                target_operation_id: request.target_operation_id,
                request,
                output_behavior: OrgSecretsOutputBehavior::SetNotice { key: plan.key },
            })
        }
        OrgSecretsCommandKind::Remove => {
            let request = build_org_secrets_remove_request_from_args(args)?;
            let key = key_from_remove_request_path(&request.path)?;
            Ok(OrgSecretsCommandPlan {
                target_operation_id: request.target_operation_id,
                request,
                output_behavior: OrgSecretsOutputBehavior::RemoveNotice { key },
            })
        }
    }
}

pub fn build_org_secrets_list_request_from_args(args: &[String]) -> Result<OrgSecretsApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["time"], &[])?;
    reject_positionals(&parsed)?;
    Ok(org_secrets_request(
        OrgSecretsCommandKind::List,
        "/org/secrets".to_string(),
        None,
    ))
}

pub fn build_org_secrets_set_request_from_args_with_io(
    args: &[String],
    env: BTreeMap<String, String>,
    read_file: impl FnMut(&str) -> Result<String>,
    read_stdin: impl FnMut() -> Result<String>,
) -> Result<OrgSecretsApiRequest> {
    let plan = build_org_secrets_command_plan_with_io(
        "org secrets set",
        args,
        env,
        read_file,
        read_stdin,
    )?;
    Ok(plan.request)
}

pub fn build_org_secrets_remove_request_from_args(args: &[String]) -> Result<OrgSecretsApiRequest> {
    let parsed = parse_args(args, &["api-key", "api-base-url", "key"], &["time"], &[])?;
    reject_positionals(&parsed)?;
    let key = required_flag(&parsed, "key")?;
    build_delete_org_secret_request(&key)
}

pub fn parse_set_org_secret_command_plan(args: &[String]) -> Result<SetOrgSecretCommandPlan> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "key",
            "value",
            "value-from-env",
            "value-file",
            "value-from-env-file",
        ],
        &["stdin", "time"],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let key = required_flag(&parsed, "key")?;
    validate_secret_key(&key, "--key")?;
    let source = single_secret_source_from_parsed(&parsed)?;
    Ok(SetOrgSecretCommandPlan { key, source })
}

pub fn resolve_single_secret_value(
    input: &SingleSecretValueSourceInput,
    mut read_file: impl FnMut(&str) -> Result<String>,
    mut read_stdin: impl FnMut() -> Result<String>,
) -> Result<String> {
    validate_secret_key(&input.key, "--key")?;
    match &input.source {
        SingleSecretValueSource::Value(value) => Ok(value.clone()),
        SingleSecretValueSource::ValueFromEnv(key) => {
            input.env.get(key).cloned().ok_or_else(|| {
                anyhow!(
                    "--value-from-env {key} could not read {key}: environment variable is not set."
                )
            })
        }
        SingleSecretValueSource::ValueFile(path) => {
            read_file(path).map_err(|error| anyhow!("Could not read --value-file {path}: {error}"))
        }
        SingleSecretValueSource::ValueFromEnvFile(entry) => {
            let (path, key) = parse_single_value_env_file_ref(entry, &input.key)?;
            let contents = read_file(&path)
                .map_err(|error| anyhow!("Could not read env file {path}: {error}"))?;
            let values = parse_env_file(&contents);
            values.get(&key).cloned().ok_or_else(|| {
                anyhow!(
                    "--value-from-env-file {entry} could not read {key}: key is not present in {path}."
                )
            })
        }
        SingleSecretValueSource::Stdin => Ok(strip_one_trailing_line_ending(
            &read_stdin().map_err(|error| anyhow!("Could not read --stdin: {error}"))?,
        )),
    }
}

pub fn build_create_org_secret_request(key: &str, value: &str) -> Result<OrgSecretsApiRequest> {
    validate_secret_key(key, "--key")?;
    Ok(org_secrets_request(
        OrgSecretsCommandKind::Set,
        "/org/secrets".to_string(),
        Some(json!({ "key": key, "value": value })),
    ))
}

pub fn build_delete_org_secret_request(key: &str) -> Result<OrgSecretsApiRequest> {
    validate_secret_key(key, "--key")?;
    Ok(org_secrets_request(
        OrgSecretsCommandKind::Remove,
        format!("/org/secrets/{}", urlencoding::encode(key)),
        None,
    ))
}

pub fn render_org_secrets_output(
    plan: &OrgSecretsCommandPlan,
    output: &Value,
) -> Result<OrgSecretsTextOutput> {
    match &plan.output_behavior {
        OrgSecretsOutputBehavior::Json => Ok(OrgSecretsTextOutput {
            stdout: vec![serde_json::to_string_pretty(output)?],
            stderr: Vec::new(),
        }),
        OrgSecretsOutputBehavior::SetNotice { key } => Ok(OrgSecretsTextOutput {
            stdout: vec![serde_json::to_string_pretty(output)?],
            stderr: vec![format!(
                "Global secret {key} saved. Deployed functions pick it up on their next redeploy; a function secret of the same name overrides it."
            )],
        }),
        OrgSecretsOutputBehavior::RemoveNotice { key } => Ok(OrgSecretsTextOutput {
            stdout: Vec::new(),
            stderr: vec![format!(
                "Global secret {key} deleted. Deployed functions keep the previous value until each is redeployed."
            )],
        }),
    }
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
                    .ok_or_else(|| crate::usage_error(format!("Missing value for --{name}")))?;
                if value.starts_with("--") {
                    return Err(crate::usage_error(format!("Missing value for --{name}")));
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
        .any(|arg| matches!(arg.as_str(), "--time" | "--time=true"))
}

fn dispatch_command_and_args(args: &[String]) -> Result<(String, &[String])> {
    match args {
        [first, second, third, rest @ ..] if first == "org" && second == "secrets" => {
            Ok((format!("org:secrets:{third}"), rest))
        }
        [first, second, rest @ ..] if first == "secrets" => {
            Ok((format!("org:secrets:{second}"), rest))
        }
        [first, rest @ ..] => Ok((format!("org:secrets:{first}"), rest)),
        [] => Err(anyhow!("org secrets commands require a subcommand")),
    }
}

fn org_secrets_command_kind(command: &str) -> Option<OrgSecretsCommandKind> {
    let normalized = command.split_whitespace().collect::<Vec<_>>().join(":");
    let command = normalized
        .strip_prefix("org:secrets:")
        .or_else(|| normalized.strip_prefix("org-secrets:"))
        .or_else(|| normalized.strip_prefix("secrets:"))
        .unwrap_or(normalized.as_str());
    match command {
        "list" | "list-org-secrets" => Some(OrgSecretsCommandKind::List),
        "set" | "create-org-secret" => Some(OrgSecretsCommandKind::Set),
        "remove" | "delete" => Some(OrgSecretsCommandKind::Remove),
        _ => None,
    }
}

fn org_secrets_delete_alias_invoked(command: &str) -> bool {
    let normalized = command.split_whitespace().collect::<Vec<_>>().join(":");
    let command = normalized
        .strip_prefix("org:secrets:")
        .or_else(|| normalized.strip_prefix("org-secrets:"))
        .or_else(|| normalized.strip_prefix("secrets:"))
        .unwrap_or(normalized.as_str());
    command == "delete"
}

fn target_operation_id(kind: OrgSecretsCommandKind) -> &'static str {
    match kind {
        OrgSecretsCommandKind::List => LIST_ORG_SECRETS_OPERATION,
        OrgSecretsCommandKind::Set => CREATE_ORG_SECRET_OPERATION,
        OrgSecretsCommandKind::Remove => DELETE_ORG_SECRET_OPERATION,
    }
}

fn method(kind: OrgSecretsCommandKind) -> &'static str {
    match kind {
        OrgSecretsCommandKind::List => "GET",
        OrgSecretsCommandKind::Set => "POST",
        OrgSecretsCommandKind::Remove => "DELETE",
    }
}

fn org_secrets_request(
    kind: OrgSecretsCommandKind,
    path: String,
    body: Option<Value>,
) -> OrgSecretsApiRequest {
    OrgSecretsApiRequest {
        target_operation_id: target_operation_id(kind),
        method: method(kind),
        path,
        query: BTreeMap::new(),
        body,
    }
}

fn execute_org_secrets_request(
    request: &OrgSecretsApiRequest,
    auth: &config::ResolvedAuth,
) -> Result<Value> {
    let http = client::http_client()?;
    let method: Method = request.method.parse()?;
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

    let mut builder = http.request(method, url);
    builder = client::apply_headers(builder, auth, true, &[], request.body.is_some())?;
    if let Some(body) = &request.body {
        builder = builder.json(body);
    }

    let response = builder.send()?;
    let (status, bytes, json) = client::parse_response_with_declared_json_error(response)?;
    if status >= 400 {
        return Err(client::error_for_status_with_hints(
            status,
            json.as_ref(),
            &bytes,
        ));
    }
    if request.target_operation_id == DELETE_ORG_SECRET_OPERATION {
        return Ok(Value::Null);
    }
    let value = json.ok_or_else(|| anyhow!("HTTP {status} returned no JSON body"))?;
    match request.target_operation_id {
        LIST_ORG_SECRETS_OPERATION => Ok(value
            .get("data")
            .and_then(|data| data.get("items"))
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new()))),
        CREATE_ORG_SECRET_OPERATION => Ok(value.get("data").cloned().unwrap_or_else(|| json!({}))),
        _ => Ok(value),
    }
}

fn write_text_output(output: &OrgSecretsTextOutput) {
    for line in &output.stdout {
        println!("{line}");
    }
    for line in &output.stderr {
        eprintln!("{line}");
    }
}

fn read_stdin_string() -> Result<String> {
    let mut stdin = io::stdin();
    if stdin.is_terminal() {
        return Err(anyhow!(
            "stdin is a TTY; pipe a value into this command or pass a file/env source instead."
        ));
    }
    let mut input = String::new();
    stdin
        .read_to_string(&mut input)
        .context("Could not read stdin")?;
    Ok(input)
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive Rust CLI org secrets commands:");
    println!("  {bin} org secrets list");
    println!("  {bin} org secrets set --key <KEY> [source]");
    println!("  {bin} org secrets remove --key <KEY>");
}

pub fn org_secrets_leaf_help_text(command: &str) -> Option<String> {
    let kind = org_secrets_command_kind(command)?;
    let bin = crate::display_bin_name();
    let text = match kind {
        OrgSecretsCommandKind::List => format!(
            r#"List global secrets (keys only; values never returned)

USAGE
  {bin} org secrets list [--api-key <value>] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --time             Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} org secrets list
"#
        ),
        OrgSecretsCommandKind::Set => format!(
            r#"Set a global secret shared across all functions

USAGE
  {bin} org secrets set --key <KEY> [--api-key <value>] [--value <value>] [--value-from-env <KEY>] [--value-file <path>] [--value-from-env-file <FILE[:KEY]>] [--stdin] [--time]

FLAGS
      --api-key <value>              Primitive API key override.
      --key <KEY>                    Required global secret key.
      --stdin                        Read the secret value from stdin.
      --time                         Print elapsed wall-clock time to stderr.
      --value <value>                Secret value.
      --value-file <path>            UTF-8 file to read as the secret value.
      --value-from-env <KEY>         Environment variable to read as the secret value.
      --value-from-env-file <FILE[:KEY]>
                                      Dotenv-style file to read as the secret value.

EXAMPLES
  {bin} org secrets set --key STRIPE_KEY --value sk_live_...
  {bin} org secrets set --key MODEL_API_KEY --value-from-env MODEL_API_KEY
"#
        ),
        OrgSecretsCommandKind::Remove => {
            let verb = if org_secrets_delete_alias_invoked(command) {
                "delete"
            } else {
                "remove"
            };
            format!(
                r#"Delete a global secret

USAGE
  {bin} org secrets {verb} --key <KEY> [--api-key <value>] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --key <KEY>        Required global secret key to delete.
      --time             Print elapsed wall-clock time to stderr.

ALIASES
  {bin} org secrets delete

EXAMPLES
  {bin} org secrets remove --key STRIPE_KEY
"#
            )
        }
    };
    Some(text)
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

fn reject_positionals(parsed: &ParsedArgs) -> Result<()> {
    if let Some(value) = parsed.positionals.first() {
        return Err(crate::usage_error(format!("Unexpected argument: {value}")));
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

fn required_flag(parsed: &ParsedArgs, name: &str) -> Result<String> {
    flag_one(parsed, name).ok_or_else(|| crate::usage_error(format!("Missing required --{name}")))
}

fn single_secret_source_from_parsed(parsed: &ParsedArgs) -> Result<SingleSecretValueSource> {
    let mut sources = Vec::new();
    if let Some(value) = flag_one(parsed, "value") {
        sources.push(SingleSecretValueSource::Value(value));
    }
    if let Some(value) = flag_one(parsed, "value-from-env") {
        sources.push(SingleSecretValueSource::ValueFromEnv(value));
    }
    if let Some(value) = flag_one(parsed, "value-file") {
        sources.push(SingleSecretValueSource::ValueFile(value));
    }
    if let Some(value) = flag_one(parsed, "value-from-env-file") {
        sources.push(SingleSecretValueSource::ValueFromEnvFile(value));
    }
    if parsed.bool_flags.get("stdin") == Some(&true) {
        sources.push(SingleSecretValueSource::Stdin);
    }
    if sources.len() != 1 {
        return Err(anyhow!(
            "Pass exactly one of --value, --value-from-env, --value-file, --value-from-env-file, or --stdin."
        ));
    }
    Ok(sources.remove(0))
}

fn validate_secret_key(key: &str, flag_label: &str) -> Result<()> {
    let mut chars = key.chars();
    let Some(first) = chars.next() else {
        return Err(secret_key_error(key, flag_label));
    };
    if !(first == '_' || first.is_ascii_uppercase())
        || !chars.all(|ch| ch == '_' || ch.is_ascii_uppercase() || ch.is_ascii_digit())
    {
        return Err(secret_key_error(key, flag_label));
    }
    Ok(())
}

fn secret_key_error(key: &str, flag_label: &str) -> anyhow::Error {
    anyhow!(
        "{flag_label} KEY {key:?} does not match ^[A-Z_][A-Z0-9_]*$ (uppercase letters, digits, underscores; first character is a letter or underscore)."
    )
}

fn parse_single_value_env_file_ref(entry: &str, fallback_key: &str) -> Result<(String, String)> {
    let Some(sep) = entry.rfind(':') else {
        return Ok((entry.to_string(), fallback_key.to_string()));
    };
    if sep == 0 || sep == entry.len() - 1 {
        return Err(anyhow!(
            "--value-from-env-file expects FILE or FILE:KEY (got {entry:?}). Example: --value-from-env-file .env.local or --value-from-env-file .env.local:MODEL_API_KEY"
        ));
    }
    let path = entry[..sep].to_string();
    let key = entry[sep + 1..].to_string();
    validate_secret_key(&key, "--value-from-env-file")?;
    Ok((path, key))
}

fn parse_env_file(contents: &str) -> BTreeMap<String, String> {
    let mut values = BTreeMap::new();
    let normalized = contents.strip_prefix('\u{feff}').unwrap_or(contents);
    for raw_line in normalized.lines() {
        let mut line = raw_line.trim_start();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some(rest) = line.strip_prefix("export ") {
            line = rest.trim_start();
        }
        let Some(eq) = line.find('=') else {
            continue;
        };
        let key = line[..eq].trim_end();
        if !is_env_key(key) {
            continue;
        }
        let raw_value = line[eq + 1..].trim_start();
        values.insert(key.to_string(), parse_env_value(raw_value));
    }
    values
}

fn is_env_key(key: &str) -> bool {
    let mut chars = key.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    (first == '_' || first.is_ascii_alphabetic())
        && chars.all(|ch| ch == '_' || ch.is_ascii_alphanumeric())
}

fn parse_env_value(raw: &str) -> String {
    if let Some(value) = raw.strip_prefix('\'') {
        return value
            .find('\'')
            .map_or_else(|| value.to_string(), |end| value[..end].to_string());
    }
    if raw.starts_with('"') {
        return parse_double_quoted_env_value(raw);
    }
    strip_unquoted_env_comment(raw).trim_end().to_string()
}

fn parse_double_quoted_env_value(value: &str) -> String {
    let mut out = String::new();
    let mut escaped = false;
    for ch in value.chars().skip(1) {
        if escaped {
            match ch {
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                't' => out.push('\t'),
                other => out.push(other),
            }
            escaped = false;
            continue;
        }
        match ch {
            '\\' => escaped = true,
            '"' => break,
            other => out.push(other),
        }
    }
    if escaped {
        out.push('\\');
    }
    out
}

fn strip_unquoted_env_comment(value: &str) -> &str {
    let mut previous_was_space = false;
    for (index, ch) in value.char_indices() {
        if ch == '#' && previous_was_space {
            return &value[..index];
        }
        previous_was_space = ch.is_whitespace();
    }
    value
}

fn strip_one_trailing_line_ending(value: &str) -> String {
    let Some(without_lf) = value.strip_suffix('\n') else {
        return value.to_string();
    };
    without_lf
        .strip_suffix('\r')
        .unwrap_or(without_lf)
        .to_string()
}

fn key_from_remove_request_path(path: &str) -> Result<String> {
    let encoded = path
        .strip_prefix("/org/secrets/")
        .ok_or_else(|| anyhow!("Remove request path did not include a secret key."))?;
    Ok(urlencoding::decode(encoded)?.into_owned())
}
