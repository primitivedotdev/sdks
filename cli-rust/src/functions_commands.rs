use crate::client;
use crate::config;
use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

pub const DEFAULT_FUNCTION_TEMPLATE_ID: &str = "email-reply";
pub const DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS: u64 = 120;
pub const DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS: u64 = 2;
pub const DEFAULT_LOG_LIMIT: u64 = 50;
pub const DEFAULT_LOG_POLL_INTERVAL_SECONDS: u64 = 2;
pub const DEFAULT_TEST_WAIT_TIMEOUT_SECONDS: u64 = 60;
pub const DEFAULT_TEST_POLL_INTERVAL_SECONDS: u64 = 2;
pub const TEST_TRACE_NO_DELIVERIES_GRACE_SECONDS: u64 = 15;

const SDK_VERSION_RANGE: &str = "^1.22.0";
const CLI_VERSION_RANGE: &str = "^1.22.0";
const ESBUILD_VERSION_RANGE: &str = "^0.27.0";

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
pub struct FunctionCommandAlias {
    pub alias: &'static str,
    pub target_operation_id: Option<&'static str>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FunctionCommandPlan {
    Init(InitCommandPlan),
    Templates(TemplatesCommandPlan),
    Api(FunctionApiCommandPlan),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FunctionApiCommandPlan {
    pub target_operation_id: &'static str,
    pub request: ApiRequest,
    pub behavior: FunctionApiBehavior,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FunctionApiBehavior {
    Json,
    Deploy {
        create: bool,
        secrets: Vec<SecretFlagPair>,
        wait: bool,
        timeout_seconds: u64,
        poll_interval_seconds: u64,
    },
    Logs {
        follow: bool,
        jsonl: bool,
        poll_interval_seconds: u64,
    },
    SetSecret {
        redeploy: bool,
    },
    Test {
        wait: bool,
        show_sends: bool,
        timeout_seconds: u64,
        poll_interval_seconds: u64,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FunctionCommandExit {
    Success,
    Code(i32),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum TestTraceWaitOutcome {
    Terminal(Value),
    NoRoute(String),
    Timeout(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SetSecretRedeployStage {
    GetFunction,
    Redeploy,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct FunctionTemplateAuthor {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct FunctionTemplateSummary {
    pub id: String,
    pub title: String,
    pub summary: String,
    pub description: String,
    pub author: FunctionTemplateAuthor,
    pub tags: Vec<String>,
    pub dependencies: Vec<String>,
    #[serde(rename = "devDependencies")]
    pub dev_dependencies: Vec<String>,
    pub secrets: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct FunctionTemplateFile {
    #[serde(rename = "relativePath")]
    pub relative_path: String,
    pub contents: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InitCommandPlan {
    pub name: String,
    pub out_dir: String,
    pub template_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplatesCommandPlan {
    pub json: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeployFileInput {
    pub name: String,
    pub code: String,
    pub source_map: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedeployFileInput {
    pub id: String,
    pub code: String,
    pub source_map: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceDeployInput {
    pub name: String,
    pub files: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceRedeployInput {
    pub id: String,
    pub files: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DeployModePlan {
    File {
        file: String,
        source_map_file: Option<String>,
    },
    Source {
        source_dir: String,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeployCommandPlan {
    pub name: String,
    pub mode: DeployModePlan,
    pub secrets: SecretSourcePlan,
    pub wait: bool,
    pub timeout_seconds: u64,
    pub poll_interval_seconds: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RedeployCommandPlan {
    pub id: String,
    pub file: String,
    pub source_map_file: Option<String>,
    pub secrets: SecretSourcePlan,
    pub wait: bool,
    pub timeout_seconds: u64,
    pub poll_interval_seconds: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SetSecretCommandPlan {
    pub id: String,
    pub key: String,
    pub source: SingleSecretValueSource,
    pub redeploy: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SecretSourcePlan {
    pub inline: Vec<String>,
    pub from_env: Vec<String>,
    pub from_file: Vec<String>,
    pub from_env_file: Vec<String>,
    pub from_stdin: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SecretSourceInput {
    pub inline: Vec<String>,
    pub from_env: Vec<String>,
    pub from_file: Vec<String>,
    pub from_env_file: Vec<String>,
    pub from_stdin: Option<String>,
    pub env: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecretFlagPair {
    pub key: String,
    pub value: String,
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FunctionLogsPlan {
    pub request: ApiRequest,
    pub follow: bool,
    pub jsonl: bool,
    pub poll_interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FunctionLogRow {
    pub id: String,
    pub function_id: String,
    pub ts: String,
    pub level: String,
    pub message: String,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FunctionLogsPage {
    items: Vec<FunctionLogRow>,
    next_cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FunctionInvocationCounts {
    invocations_total: u64,
    invocations_24h: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FreshFunctionLogs {
    pub fresh_newest_first: Vec<FunctionLogRow>,
    pub reached_seen: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RouteTargetInput {
    Domain(String),
    Fallback,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RouteSetCommandPlan {
    pub request: ApiRequest,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TestFunctionPlan {
    pub trigger: ApiRequest,
    pub should_wait: bool,
    pub should_show_sends: bool,
    pub timeout_seconds: u64,
    pub poll_interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct MatchingFunctionEndpoint {
    pub id: String,
    pub function_id: Option<String>,
    pub is_current_function: bool,
    pub scope: FunctionEndpointScope,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FunctionEndpointScope {
    Domain,
    Fallback,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct RawEndpointRow {
    pub id: Option<String>,
    pub enabled: Option<bool>,
    pub deactivated_at: Option<String>,
    pub domain_id: Option<String>,
    pub function_id: Option<String>,
    pub kind: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct ParsedArgs {
    flags: BTreeMap<String, Vec<String>>,
    bool_flags: BTreeMap<String, bool>,
    positionals: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FunctionCommandKind {
    Init,
    Templates,
    Deploy,
    Redeploy,
    SetSecret,
    Logs,
    RouteSet,
    RouteUnset,
    RouteGet,
    RoutingTopology,
    Test,
}

pub fn function_command_aliases() -> &'static [FunctionCommandAlias] {
    &[
        FunctionCommandAlias {
            alias: "functions:init",
            target_operation_id: None,
        },
        FunctionCommandAlias {
            alias: "functions:templates",
            target_operation_id: None,
        },
        FunctionCommandAlias {
            alias: "functions:deploy",
            target_operation_id: Some("functions:create-function"),
        },
        FunctionCommandAlias {
            alias: "functions:redeploy",
            target_operation_id: Some("functions:update-function"),
        },
        FunctionCommandAlias {
            alias: "functions:set-secret",
            target_operation_id: Some("functions:set-function-secret"),
        },
        FunctionCommandAlias {
            alias: "functions:test",
            target_operation_id: Some("functions:test-function"),
        },
        FunctionCommandAlias {
            alias: "functions:test-function",
            target_operation_id: Some("functions:test-function"),
        },
        FunctionCommandAlias {
            alias: "functions:route-set",
            target_operation_id: Some("functions:set-function-route"),
        },
        FunctionCommandAlias {
            alias: "functions:route-unset",
            target_operation_id: Some("functions:unset-function-route"),
        },
        FunctionCommandAlias {
            alias: "functions:route-get",
            target_operation_id: Some("functions:get-function-routing"),
        },
        FunctionCommandAlias {
            alias: "functions:routing-topology",
            target_operation_id: Some("functions:get-org-routing-topology"),
        },
        FunctionCommandAlias {
            alias: "functions:logs",
            target_operation_id: Some("functions:list-function-logs"),
        },
    ]
}

pub fn function_command_target(command: &str) -> Option<&'static str> {
    function_command_kind(command).and_then(target_operation_id)
}

pub fn is_functions_friendly_command(command: &str) -> bool {
    function_command_aliases()
        .iter()
        .any(|alias| alias.alias == command)
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help();
        return Ok(());
    }
    let (subcommand, rest) = args
        .split_first()
        .ok_or_else(|| anyhow!("functions commands require a subcommand"))?;
    execute_command(&format!("functions:{subcommand}"), rest)
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    if is_help_request(args) {
        if print_command_help(command) {
            return Ok(());
        }
        print_help();
        return Ok(());
    }

    let start = Instant::now();
    let plan = build_function_command_plan(command, args)?;
    let exit = match plan {
        FunctionCommandPlan::Init(plan) => {
            execute_init_plan(&plan)?;
            FunctionCommandExit::Success
        }
        FunctionCommandPlan::Templates(plan) => {
            execute_templates_plan(&plan)?;
            FunctionCommandExit::Success
        }
        FunctionCommandPlan::Api(plan) => {
            let auth = config::resolve_auth(&auth_flags(args)?)?;
            execute_api_plan(&plan, &auth)?
        }
    };

    if has_time_flag(args) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    if let FunctionCommandExit::Code(code) = exit {
        std::process::exit(code);
    }
    Ok(())
}

pub fn build_function_command_plan(command: &str, args: &[String]) -> Result<FunctionCommandPlan> {
    build_function_command_plan_with_io(
        command,
        args,
        std::env::vars().collect(),
        |path| fs::read_to_string(path).with_context(|| format!("Could not read {path}")),
        read_stdin_string,
        collect_source_files,
    )
}

pub fn build_function_command_plan_with_io(
    command: &str,
    args: &[String],
    env: BTreeMap<String, String>,
    mut read_file: impl FnMut(&str) -> Result<String>,
    mut read_stdin: impl FnMut() -> Result<String>,
    mut read_source_dir: impl FnMut(&str) -> Result<BTreeMap<String, String>>,
) -> Result<FunctionCommandPlan> {
    let kind = function_command_kind(command)
        .ok_or_else(|| crate::usage_err!("Unknown functions command `{command}`"))?;
    let args = args_without_runtime_flags(args)?;
    match kind {
        FunctionCommandKind::Init => Ok(FunctionCommandPlan::Init(parse_init_command_plan(&args)?)),
        FunctionCommandKind::Templates => Ok(FunctionCommandPlan::Templates(
            parse_templates_command_plan(&args)?,
        )),
        FunctionCommandKind::Deploy => {
            let plan = parse_deploy_command_plan(&args)?;
            let secrets = resolve_secret_source_plan(
                &plan.secrets,
                env,
                |path| read_file(path),
                &mut read_stdin,
            )?;
            let request = match &plan.mode {
                DeployModePlan::File {
                    file,
                    source_map_file,
                } => build_deploy_file_request_from_paths(
                    &plan.name,
                    file,
                    source_map_file.as_deref(),
                    |path| read_file(path),
                )?,
                DeployModePlan::Source { source_dir } => {
                    build_deploy_source_create_request(&SourceDeployInput {
                        name: plan.name.clone(),
                        files: read_source_dir(source_dir)?,
                    })
                }
            };
            Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
                target_operation_id: "functions:create-function",
                request,
                behavior: FunctionApiBehavior::Deploy {
                    create: true,
                    secrets,
                    wait: plan.wait,
                    timeout_seconds: plan.timeout_seconds,
                    poll_interval_seconds: plan.poll_interval_seconds,
                },
            }))
        }
        FunctionCommandKind::Redeploy => {
            let plan = parse_redeploy_command_plan(&args)?;
            let secrets = resolve_secret_source_plan(
                &plan.secrets,
                env,
                |path| read_file(path),
                &mut read_stdin,
            )?;
            let request = build_redeploy_file_request_from_paths(
                &plan.id,
                &plan.file,
                plan.source_map_file.as_deref(),
                |path| read_file(path),
            )?;
            Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
                target_operation_id: "functions:update-function",
                request,
                behavior: FunctionApiBehavior::Deploy {
                    create: false,
                    secrets,
                    wait: plan.wait,
                    timeout_seconds: plan.timeout_seconds,
                    poll_interval_seconds: plan.poll_interval_seconds,
                },
            }))
        }
        FunctionCommandKind::SetSecret => {
            let plan = parse_set_secret_command_plan(&args)?;
            let value = resolve_single_secret_value(
                &SingleSecretValueSourceInput {
                    key: plan.key.clone(),
                    source: plan.source.clone(),
                    env,
                },
                |path| read_file(path),
                read_stdin,
            )?;
            Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
                target_operation_id: "functions:set-function-secret",
                request: build_set_secret_request(&plan.id, &plan.key, &value),
                behavior: FunctionApiBehavior::SetSecret {
                    redeploy: plan.redeploy,
                },
            }))
        }
        FunctionCommandKind::Logs => {
            let plan = parse_logs_command_plan(&args)?;
            Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
                target_operation_id: "functions:list-function-logs",
                request: plan.request,
                behavior: FunctionApiBehavior::Logs {
                    follow: plan.follow,
                    jsonl: plan.jsonl,
                    poll_interval_seconds: plan.poll_interval_seconds,
                },
            }))
        }
        FunctionCommandKind::RouteSet => {
            let plan = parse_route_set_command_plan(&args)?;
            Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
                target_operation_id: "functions:set-function-route",
                request: plan.request,
                behavior: FunctionApiBehavior::Json,
            }))
        }
        FunctionCommandKind::RouteUnset => Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
            target_operation_id: "functions:unset-function-route",
            request: parse_route_unset_command_plan(&args)?,
            behavior: FunctionApiBehavior::Json,
        })),
        FunctionCommandKind::RouteGet => Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
            target_operation_id: "functions:get-function-routing",
            request: parse_route_get_command_plan(&args)?,
            behavior: FunctionApiBehavior::Json,
        })),
        FunctionCommandKind::RoutingTopology => {
            Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
                target_operation_id: "functions:get-org-routing-topology",
                request: parse_routing_topology_command_plan(&args)?,
                behavior: FunctionApiBehavior::Json,
            }))
        }
        FunctionCommandKind::Test => {
            let plan = parse_test_function_command_plan(&args)?;
            Ok(FunctionCommandPlan::Api(FunctionApiCommandPlan {
                target_operation_id: "functions:test-function",
                request: plan.trigger,
                behavior: FunctionApiBehavior::Test {
                    wait: plan.should_wait,
                    show_sends: plan.should_show_sends,
                    timeout_seconds: plan.timeout_seconds,
                    poll_interval_seconds: plan.poll_interval_seconds,
                },
            }))
        }
    }
}

pub fn build_function_api_request(
    command: &str,
    args: &[String],
    env: BTreeMap<String, String>,
    read_file: impl FnMut(&str) -> Result<String>,
    read_stdin: impl FnMut() -> Result<String>,
    read_source_dir: impl FnMut(&str) -> Result<BTreeMap<String, String>>,
) -> Result<FunctionApiCommandPlan> {
    match build_function_command_plan_with_io(
        command,
        args,
        env,
        read_file,
        read_stdin,
        read_source_dir,
    )? {
        FunctionCommandPlan::Api(plan) => Ok(plan),
        FunctionCommandPlan::Init(_) | FunctionCommandPlan::Templates(_) => Err(anyhow!(
            "`{command}` is a local functions command and does not build an API request."
        )),
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
        .any(|arg| matches!(arg.as_str(), "--time" | "--time=true"))
}

fn function_command_kind(command: &str) -> Option<FunctionCommandKind> {
    let normalized = command.split_whitespace().collect::<Vec<_>>().join(":");
    let command = normalized
        .strip_prefix("functions:")
        .unwrap_or(normalized.as_str());
    match command {
        "init" => Some(FunctionCommandKind::Init),
        "templates" => Some(FunctionCommandKind::Templates),
        "deploy" | "create-function" => Some(FunctionCommandKind::Deploy),
        "redeploy" | "update-function" => Some(FunctionCommandKind::Redeploy),
        "set-secret" | "set-function-secret" | "create-function-secret" => {
            Some(FunctionCommandKind::SetSecret)
        }
        "logs" | "list-function-logs" => Some(FunctionCommandKind::Logs),
        "route-set" | "set-function-route" => Some(FunctionCommandKind::RouteSet),
        "route-unset" | "unset-function-route" => Some(FunctionCommandKind::RouteUnset),
        "route-get" | "get-function-routing" => Some(FunctionCommandKind::RouteGet),
        "routing-topology" | "get-org-routing-topology" => {
            Some(FunctionCommandKind::RoutingTopology)
        }
        "test" | "test-function" => Some(FunctionCommandKind::Test),
        _ => None,
    }
}

fn target_operation_id(kind: FunctionCommandKind) -> Option<&'static str> {
    match kind {
        FunctionCommandKind::Init | FunctionCommandKind::Templates => None,
        FunctionCommandKind::Deploy => Some("functions:create-function"),
        FunctionCommandKind::Redeploy => Some("functions:update-function"),
        FunctionCommandKind::SetSecret => Some("functions:set-function-secret"),
        FunctionCommandKind::Logs => Some("functions:list-function-logs"),
        FunctionCommandKind::RouteSet => Some("functions:set-function-route"),
        FunctionCommandKind::RouteUnset => Some("functions:unset-function-route"),
        FunctionCommandKind::RouteGet => Some("functions:get-function-routing"),
        FunctionCommandKind::RoutingTopology => Some("functions:get-org-routing-topology"),
        FunctionCommandKind::Test => Some("functions:test-function"),
    }
}

fn args_without_runtime_flags(args: &[String]) -> Result<Vec<String>> {
    let mut stripped = Vec::new();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        let Some(raw) = arg.strip_prefix("--") else {
            stripped.push(arg.clone());
            index += 1;
            continue;
        };
        let (name, inline_value) = raw
            .split_once('=')
            .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));

        if matches!(name, "api-key" | "api-base-url") {
            if inline_value.is_none() {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| anyhow!("Missing value for --{name}"))?;
                if value.starts_with("--") {
                    return Err(anyhow!("Missing value for --{name}"));
                }
            }
            index += 1;
            continue;
        }

        if name == "time" || raw == "no-time" {
            index += 1;
            continue;
        }

        stripped.push(arg.clone());
        index += 1;
    }
    Ok(stripped)
}

fn execute_init_plan(plan: &InitCommandPlan) -> Result<()> {
    let files = scaffold_files(&plan.name, Some(&plan.template_id))?;
    let out_dir = PathBuf::from(&plan.out_dir);
    fs::create_dir_all(&out_dir)
        .with_context(|| format!("Could not create {}", out_dir.display()))?;

    for file in files {
        let path = out_dir.join(&file.relative_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .with_context(|| format!("Could not create {}", parent.display()))?;
        }
        fs::write(&path, file.contents)
            .with_context(|| format!("Could not write {}", path.display()))?;
    }

    println!(
        "Created Primitive Function project in {}.",
        out_dir.display()
    );
    Ok(())
}

fn execute_templates_plan(plan: &TemplatesCommandPlan) -> Result<()> {
    let templates = function_template_summaries();
    if plan.json {
        println!("{}", serde_json::to_string_pretty(&templates)?);
    } else {
        println!("{}", format_function_template_list(&templates));
    }
    Ok(())
}

fn execute_api_plan(
    plan: &FunctionApiCommandPlan,
    auth: &config::ResolvedAuth,
) -> Result<FunctionCommandExit> {
    match &plan.behavior {
        FunctionApiBehavior::Json => {
            let output = execute_function_request(&plan.request, auth)?;
            print_json(&output)?;
            Ok(FunctionCommandExit::Success)
        }
        FunctionApiBehavior::Deploy {
            create,
            secrets,
            wait,
            timeout_seconds,
            poll_interval_seconds,
        } => execute_deploy_api_plan(
            plan,
            auth,
            *create,
            secrets,
            *wait,
            *timeout_seconds,
            *poll_interval_seconds,
        )
        .map(|()| FunctionCommandExit::Success),
        FunctionApiBehavior::Logs {
            follow,
            jsonl,
            poll_interval_seconds,
        } => execute_logs_api_plan(plan, auth, *follow, *jsonl, *poll_interval_seconds)
            .map(|()| FunctionCommandExit::Success),
        FunctionApiBehavior::SetSecret { redeploy } => {
            execute_set_secret_api_plan(plan, auth, *redeploy)
                .map(|()| FunctionCommandExit::Success)
        }
        FunctionApiBehavior::Test {
            wait,
            show_sends,
            timeout_seconds,
            poll_interval_seconds,
        } => execute_test_api_plan(
            plan,
            auth,
            *wait,
            *show_sends,
            *timeout_seconds,
            *poll_interval_seconds,
        ),
    }
}

fn execute_deploy_api_plan(
    plan: &FunctionApiCommandPlan,
    auth: &config::ResolvedAuth,
    create: bool,
    secrets: &[SecretFlagPair],
    wait: bool,
    timeout_seconds: u64,
    poll_interval_seconds: u64,
) -> Result<()> {
    let mut output;
    let function_id;

    if create && is_source_create_request(&plan.request) {
        let name = source_create_name(&plan.request)?;
        let listed = execute_function_request(&build_list_functions_request(), auth)?;
        if let Some(existing_id) = function_id_for_name(&listed, &name) {
            function_id = existing_id;
            for secret in secrets {
                execute_function_request(
                    &build_set_secret_request(&function_id, &secret.key, &secret.value),
                    auth,
                )?;
            }
            output = execute_function_request(
                &build_redeploy_request_from_create_request(&function_id, &plan.request)?,
                auth,
            )?;
        } else {
            output = execute_function_request(&plan.request, auth)?;
            function_id = output
                .get("id")
                .and_then(Value::as_str)
                .map(str::to_string)
                .ok_or_else(|| anyhow!("Create function response did not include an id."))?;
            for secret in secrets {
                execute_function_request(
                    &build_set_secret_request(&function_id, &secret.key, &secret.value),
                    auth,
                )?;
            }
            if !secrets.is_empty() {
                output = execute_function_request(
                    &build_redeploy_request_from_create_request(&function_id, &plan.request)?,
                    auth,
                )?;
            }
        }
    } else if create {
        output = execute_function_request(&plan.request, auth)?;
        function_id = output
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| anyhow!("Create function response did not include an id."))?;
        for secret in secrets {
            execute_function_request(
                &build_set_secret_request(&function_id, &secret.key, &secret.value),
                auth,
            )?;
        }
        if !secrets.is_empty() {
            output = execute_function_request(
                &build_redeploy_request_from_create_request(&function_id, &plan.request)?,
                auth,
            )?;
        }
    } else {
        function_id = function_id_from_request(&plan.request)
            .map(str::to_string)
            .ok_or_else(|| anyhow!("Redeploy request path did not include a function id."))?;
        for secret in secrets {
            execute_function_request(
                &build_set_secret_request(&function_id, &secret.key, &secret.value),
                auth,
            )?;
        }
        output = execute_function_request(&plan.request, auth)?;
    }

    if wait {
        output = wait_for_deploy(&function_id, auth, timeout_seconds, poll_interval_seconds)?;
    }
    print_json(&output)?;
    if create {
        write_route_status_hint(&function_id, auth);
    }
    Ok(())
}

fn execute_logs_api_plan(
    plan: &FunctionApiCommandPlan,
    auth: &config::ResolvedAuth,
    follow: bool,
    jsonl: bool,
    poll_interval_seconds: u64,
) -> Result<()> {
    let mut seen_ids = BTreeSet::new();
    let mut completed_initial_follow_poll = false;
    let mut has_observed_logs = false;
    let mut wrote_empty_hint = false;

    loop {
        let mut cursor = plan.request.query.get("cursor").cloned();
        let mut rows = Vec::new();

        let next_cursor = loop {
            let request = build_logs_request_with_cursor(&plan.request, cursor.as_deref());
            let output = execute_function_request(&request, auth)?;
            let Some(page) = function_logs_page_from_value(&output)? else {
                if !follow {
                    return print_json(&output);
                }
                thread::sleep(Duration::from_secs(poll_interval_seconds));
                continue;
            };

            let page_next_cursor = page.next_cursor.clone();

            if !follow {
                rows = order_function_logs_for_display(&page.items);
                break page_next_cursor;
            }

            if !page.items.is_empty() {
                has_observed_logs = true;
            }

            let collected = collect_fresh_function_logs_from_page(&page.items, &mut seen_ids);
            rows.extend(collected.fresh_newest_first);

            if !completed_initial_follow_poll
                || collected.reached_seen
                || page.next_cursor.is_none()
            {
                rows = order_function_logs_for_display(&rows);
                break page_next_cursor;
            }

            cursor = page.next_cursor;
        };

        if rows.is_empty() && !wrote_empty_hint {
            write_empty_function_logs_hint(&plan.request, auth, follow, has_observed_logs);
            wrote_empty_hint = true;
        }

        for row in rows {
            if jsonl {
                println!("{}", serde_json::to_string(&row)?);
            } else {
                println!("{}", format_function_log_line(&row));
            }
        }

        if !follow {
            if let Some(cursor) = next_cursor {
                eprintln!("next cursor: {cursor}");
            }
            return Ok(());
        }

        completed_initial_follow_poll = true;
        thread::sleep(Duration::from_secs(poll_interval_seconds));
    }
}

fn execute_set_secret_api_plan(
    plan: &FunctionApiCommandPlan,
    auth: &config::ResolvedAuth,
    redeploy: bool,
) -> Result<()> {
    let secret = execute_function_request(&plan.request, auth)?;
    let id = function_id_from_request(&plan.request)
        .ok_or_else(|| anyhow!("Set-secret request path did not include a function id."))?;
    let key = function_secret_key_from_request(&plan.request)
        .ok_or_else(|| anyhow!("Set-secret request path did not include a secret key."))?;
    if !redeploy {
        print_json(&build_set_secret_result(&secret, None))?;
        eprintln!("{}", format_set_secret_saved_warning(id, key));
        return Ok(());
    }

    let current = match execute_function_request(&build_get_function_request(id), auth) {
        Ok(current) => current,
        Err(error) => {
            eprintln!(
                "{}",
                format_set_secret_redeploy_stage_warning(id, SetSecretRedeployStage::GetFunction)
            );
            return Err(error);
        }
    };
    let code = current
        .get("code")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("Current function response did not include code."))?;
    let redeploy_output =
        match execute_function_request(&build_secret_redeploy_request(id, code), auth) {
            Ok(redeploy_output) => redeploy_output,
            Err(error) => {
                eprintln!(
                    "{}",
                    format_set_secret_redeploy_stage_warning(id, SetSecretRedeployStage::Redeploy)
                );
                return Err(error);
            }
        };
    print_json(&build_set_secret_result(&secret, Some(&redeploy_output)))
}

fn execute_test_api_plan(
    plan: &FunctionApiCommandPlan,
    auth: &config::ResolvedAuth,
    wait: bool,
    show_sends: bool,
    timeout_seconds: u64,
    poll_interval_seconds: u64,
) -> Result<FunctionCommandExit> {
    let invocation = execute_function_request(&plan.request, auth)?;
    if !wait {
        print_json(&invocation)?;
        return Ok(FunctionCommandExit::Success);
    }

    let id = function_id_from_request(&plan.request)
        .ok_or_else(|| anyhow!("Test request path did not include a function id."))?;
    let run_id = invocation
        .get("test_run_id")
        .or_else(|| invocation.get("id"))
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("Test response did not include a test run id."))?;
    maybe_write_endpoint_noise_warning(id, &invocation, auth);
    let wait_start = Instant::now();
    let to_address = invocation.get("to").and_then(Value::as_str).unwrap_or("");
    eprintln!("Waiting for test run {run_id} to complete for {to_address}...");
    let trace = match wait_for_test_trace(
        id,
        run_id,
        &invocation,
        auth,
        timeout_seconds,
        poll_interval_seconds,
    )? {
        TestTraceWaitOutcome::Terminal(trace) => trace,
        TestTraceWaitOutcome::NoRoute(message) => {
            eprintln!("{message}");
            return Ok(FunctionCommandExit::Code(1));
        }
        TestTraceWaitOutcome::Timeout(message) => {
            eprintln!("{message}");
            return Ok(FunctionCommandExit::Code(2));
        }
    };
    let outcome = build_function_test_outcome(
        id,
        &invocation,
        &trace,
        wait_start.elapsed().as_secs(),
        show_sends,
    );
    print_json(&outcome)?;
    Ok(function_test_failure_exit_code(&trace)
        .map(FunctionCommandExit::Code)
        .unwrap_or(FunctionCommandExit::Success))
}

fn execute_function_request(request: &ApiRequest, auth: &config::ResolvedAuth) -> Result<Value> {
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
    Ok(value.get("data").cloned().unwrap_or(value))
}

fn wait_for_deploy(
    id: &str,
    auth: &config::ResolvedAuth,
    timeout_seconds: u64,
    poll_interval_seconds: u64,
) -> Result<Value> {
    let start = Instant::now();
    loop {
        let output = execute_function_request(&build_get_function_request(id), auth)?;
        match output.get("deploy_status").and_then(Value::as_str) {
            Some("deployed") => return Ok(output),
            Some("failed") => {
                let detail = output
                    .get("deploy_error")
                    .and_then(Value::as_str)
                    .unwrap_or("deploy failed");
                return Err(anyhow!("{detail}"));
            }
            _ => {}
        }
        if has_wait_timeout_elapsed(start.elapsed(), timeout_seconds) {
            return Err(anyhow!(
                "Timed out waiting for function {id} to deploy after {timeout_seconds}s."
            ));
        }
        thread::sleep(Duration::from_secs(poll_interval_seconds));
    }
}

fn wait_for_test_trace(
    id: &str,
    run_id: &str,
    invocation: &Value,
    auth: &config::ResolvedAuth,
    timeout_seconds: u64,
    poll_interval_seconds: u64,
) -> Result<TestTraceWaitOutcome> {
    let start = Instant::now();
    let request = build_test_run_trace_request(id, run_id);
    loop {
        let trace = execute_function_request(&request, auth)?;
        if should_report_test_trace_no_route(&trace, start.elapsed()) {
            return Ok(TestTraceWaitOutcome::NoRoute(
                format_function_test_no_route_message(id),
            ));
        }
        if is_terminal_function_test_trace_state(&trace) {
            return Ok(TestTraceWaitOutcome::Terminal(trace));
        }
        if has_wait_timeout_elapsed(start.elapsed(), timeout_seconds) {
            let final_trace = execute_function_request(&request, auth).ok();
            return Ok(TestTraceWaitOutcome::Timeout(
                format_function_test_timeout_message(
                    timeout_seconds,
                    invocation,
                    final_trace.as_ref(),
                ),
            ));
        }
        thread::sleep(Duration::from_secs(poll_interval_seconds));
    }
}

pub fn has_wait_timeout_elapsed(elapsed: Duration, timeout_seconds: u64) -> bool {
    timeout_seconds != 0 && elapsed >= Duration::from_secs(timeout_seconds)
}

pub fn build_list_functions_request() -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/functions".to_string(),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn function_id_for_name(functions: &Value, name: &str) -> Option<String> {
    let rows = functions
        .as_array()
        .or_else(|| functions.get("data").and_then(Value::as_array))
        .or_else(|| functions.get("items").and_then(Value::as_array))?;

    rows.iter().find_map(|row| {
        if row.get("name").and_then(Value::as_str) == Some(name) {
            row.get("id").and_then(Value::as_str).map(str::to_string)
        } else {
            None
        }
    })
}

fn source_create_name(request: &ApiRequest) -> Result<String> {
    request
        .body
        .as_ref()
        .and_then(Value::as_object)
        .and_then(|body| body.get("name"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| anyhow!("Source deploy request did not include a function name."))
}

fn is_source_create_request(request: &ApiRequest) -> bool {
    request
        .body
        .as_ref()
        .and_then(Value::as_object)
        .is_some_and(|body| body.contains_key("files"))
}

pub fn build_redeploy_request_from_create_request(
    id: &str,
    request: &ApiRequest,
) -> Result<ApiRequest> {
    let mut body = request
        .body
        .as_ref()
        .and_then(Value::as_object)
        .cloned()
        .ok_or_else(|| anyhow!("Create function request did not include an object body."))?;
    body.remove("name");
    if body.is_empty() {
        return Err(anyhow!(
            "Create function request did not include deployable code or files."
        ));
    }
    Ok(ApiRequest {
        method: "PUT".to_string(),
        path: format!("/functions/{id}"),
        query: BTreeMap::new(),
        body: Some(Value::Object(body)),
    })
}

fn function_id_from_request(request: &ApiRequest) -> Option<&str> {
    request
        .path
        .strip_prefix("/functions/")
        .and_then(|rest| rest.split('/').next())
        .filter(|id| !id.is_empty())
}

fn function_secret_key_from_request(request: &ApiRequest) -> Option<&str> {
    request
        .path
        .split_once("/secrets/")
        .map(|(_, key)| key)
        .filter(|key| !key.is_empty())
}

pub fn format_route_status_hint(function_id: &str, routing: &Value) -> String {
    if routing.is_null() {
        format!(
            "Deployed but no route is bound. Inbound mail will not reach this function until you bind one: primitive functions route-set --id {function_id} --domain <domain-id>  (or --fallback)"
        )
    } else {
        "Route bound. Function will receive inbound mail.".to_string()
    }
}

fn write_route_status_hint(function_id: &str, auth: &config::ResolvedAuth) {
    if let Ok(routing) = execute_function_request(&build_route_get_request(function_id), auth) {
        eprintln!("{}", format_route_status_hint(function_id, &routing));
    }
}

fn write_empty_function_logs_hint(
    request: &ApiRequest,
    auth: &config::ResolvedAuth,
    follow: bool,
    has_observed_logs: bool,
) {
    if follow {
        if has_observed_logs {
            eprintln!("Waiting for new function logs...");
        } else {
            eprintln!("No function logs yet. Waiting for new rows...");
        }
        return;
    }

    if request.query.contains_key("cursor") {
        eprintln!("No more function logs after this cursor.");
        return;
    }

    let function_id = function_id_from_request(request).unwrap_or_default();
    if let Some(invocations) = read_function_invocations(function_id, auth) {
        if invocations.invocations_total > 0 {
            eprintln!(
                "No function logs yet, but this function has been invoked {} time(s) ({} in the last 24h). Your handler likely has no console.log/console.error calls on the path that fired. Add logging and redeploy to surface details.",
                invocations.invocations_total, invocations.invocations_24h
            );
            return;
        }
    }

    eprintln!("No function logs yet. Trigger the function, then run this command again.");
}

fn read_function_invocations(
    function_id: &str,
    auth: &config::ResolvedAuth,
) -> Option<FunctionInvocationCounts> {
    if function_id.is_empty() {
        return None;
    }
    let output = execute_function_request(&build_get_function_request(function_id), auth).ok()?;
    Some(FunctionInvocationCounts {
        invocations_total: output
            .get("invocations_total")
            .and_then(Value::as_u64)
            .unwrap_or(0),
        invocations_24h: output
            .get("invocations_24h")
            .and_then(Value::as_u64)
            .unwrap_or(0),
    })
}

fn function_logs_page_from_value(value: &Value) -> Result<Option<FunctionLogsPage>> {
    let rows = function_log_rows_value(value);
    let Some(rows) = rows else {
        return Ok(None);
    };
    let items = rows
        .iter()
        .cloned()
        .map(|row| serde_json::from_value(row).context("Function log row is malformed"))
        .collect::<Result<Vec<_>>>()?;
    Ok(Some(FunctionLogsPage {
        items,
        next_cursor: value
            .get("next_cursor")
            .and_then(Value::as_str)
            .or_else(|| {
                value
                    .get("meta")
                    .and_then(|meta| meta.get("cursor"))
                    .and_then(Value::as_str)
            })
            .map(str::to_string),
    }))
}

fn function_log_rows_value(value: &Value) -> Option<&Vec<Value>> {
    value
        .as_array()
        .or_else(|| value.get("items").and_then(Value::as_array))
        .or_else(|| value.get("logs").and_then(Value::as_array))
        .or_else(|| value.get("rows").and_then(Value::as_array))
}

fn build_logs_request_with_cursor(request: &ApiRequest, cursor: Option<&str>) -> ApiRequest {
    let mut next = request.clone();
    match cursor {
        Some(cursor) => {
            next.query.insert("cursor".to_string(), cursor.to_string());
        }
        None => {
            next.query.remove("cursor");
        }
    }
    next
}

pub fn collect_source_files(source_dir: &str) -> Result<BTreeMap<String, String>> {
    let root = Path::new(source_dir);
    if !root.is_dir() {
        return Err(anyhow!("--source {source_dir} is not a directory."));
    }
    let mut files = BTreeMap::new();

    let package_path = root.join("package.json");
    let package_raw = fs::read_to_string(&package_path).map_err(|_| {
        anyhow!(
            "No package.json found in {source_dir}. A managed build needs a package.json (its \"dependencies\" are installed)."
        )
    })?;
    let mut package_json: Value = serde_json::from_str(&package_raw)
        .map_err(|error| anyhow!("package.json in {source_dir} is not valid JSON: {error}"))?;
    if let Some(package_object) = package_json.as_object_mut() {
        package_object.remove("devDependencies");
    }
    files.insert(
        "package.json".to_string(),
        format!("{}\n", serde_json::to_string_pretty(&package_json)?),
    );

    let src_dir = root.join("src");
    if src_dir.is_dir() {
        collect_source_files_inner(root, &src_dir, &mut files)?;
    }
    if files.len() == 1 {
        return Err(anyhow!(
            "No source files found under {}. Put your handler at src/index.ts.",
            src_dir.display()
        ));
    }
    Ok(files)
}

fn collect_source_files_inner(
    root: &Path,
    dir: &Path,
    files: &mut BTreeMap<String, String>,
) -> Result<()> {
    let mut entries = fs::read_dir(dir)
        .with_context(|| format!("Could not read {}", dir.display()))?
        .collect::<std::result::Result<Vec<_>, _>>()
        .with_context(|| format!("Could not read {}", dir.display()))?;
    entries.sort_by_key(|entry| entry.path());

    for entry in entries {
        let path = entry.path();
        let file_type = entry
            .file_type()
            .with_context(|| format!("Could not inspect {}", path.display()))?;
        if file_type.is_dir() {
            collect_source_files_inner(root, &path, files)?;
        } else if file_type.is_file() {
            let relative = source_relative_path(root, &path)?;
            let contents = fs::read_to_string(&path)
                .with_context(|| format!("Could not read {}", path.display()))?;
            files.insert(relative, contents);
        }
    }
    Ok(())
}

fn source_relative_path(root: &Path, path: &Path) -> Result<String> {
    let relative = path
        .strip_prefix(root)
        .with_context(|| format!("Could not make {} relative", path.display()))?;
    relative
        .to_str()
        .map(|value| value.replace('\\', "/"))
        .ok_or_else(|| anyhow!("Source path {} is not valid UTF-8.", path.display()))
}

fn read_stdin_string() -> Result<String> {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .context("Could not read stdin")?;
    Ok(input)
}

fn print_json(value: &Value) -> Result<()> {
    println!("{}", serde_json::to_string_pretty(value)?);
    Ok(())
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive Rust CLI functions commands:");
    println!("  {bin} functions list [flags]");
    println!("  {bin} functions get --id <fn-id>");
    println!("  {bin} functions delete --id <fn-id>");
    println!("  {bin} functions init <name>");
    println!("  {bin} functions templates [--json]");
    println!("  {bin} functions deploy --name <name> (--file <bundle> | --source <dir>)");
    println!("  {bin} functions redeploy --id <fn-id> --file <bundle>");
    println!("  {bin} functions list-secrets --id <fn-id>");
    println!("  {bin} functions set-secret --id <fn-id> --key <KEY> [source]");
    println!("  {bin} functions logs --id <fn-id>");
    println!("  {bin} functions test --id <fn-id>");
    println!("  {bin} functions route-set|route-unset|route-get|routing-topology");
}

fn print_command_help(command: &str) -> bool {
    match function_command_kind(command) {
        Some(FunctionCommandKind::Init) => {
            print!("{}", functions_init_help_text());
            true
        }
        Some(FunctionCommandKind::Deploy) => {
            print!("{}", functions_deploy_help_text());
            true
        }
        Some(FunctionCommandKind::Redeploy) => {
            print!("{}", functions_redeploy_help_text());
            true
        }
        Some(FunctionCommandKind::SetSecret) => {
            print!("{}", functions_set_secret_help_text());
            true
        }
        Some(FunctionCommandKind::Logs) => {
            print!("{}", functions_logs_help_text());
            true
        }
        Some(FunctionCommandKind::RouteSet) => {
            print!("{}", functions_route_set_help_text());
            true
        }
        Some(FunctionCommandKind::RouteUnset) => {
            print!("{}", functions_route_unset_help_text());
            true
        }
        Some(FunctionCommandKind::RouteGet) => {
            print!("{}", functions_route_get_help_text());
            true
        }
        Some(FunctionCommandKind::RoutingTopology) => {
            print!("{}", functions_routing_topology_help_text());
            true
        }
        Some(FunctionCommandKind::Test) => {
            print!("{}", functions_test_help_text());
            true
        }
        Some(FunctionCommandKind::Templates) => {
            print!("{}", functions_templates_help_text());
            true
        }
        _ => false,
    }
}

pub fn functions_init_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Scaffold a local function project from a template

USAGE
  {bin} functions init <name> [--out-dir <dir>] [--template <id>]

FLAGS
      --out-dir <dir>    Directory to write. Defaults to ./<name>.
      --template <id>    Function template id. Defaults to email-reply.

EXAMPLES
  {bin} functions init reply-bot
  {bin} functions init reply-bot --out-dir ./functions/reply-bot
  {bin} functions init triage --template email-reply
"#
    )
}

pub fn functions_deploy_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Deploy a new function from a bundled handler file or source directory

USAGE
  {bin} functions deploy --name <name> (--file <bundle> | --source <dir>) [--api-key <value>] [--source-map-file <path>] [--secret <KEY=VALUE>] [--secret-from-env <KEY>] [--secret-from-file <KEY=PATH>] [--secret-from-env-file <FILE:KEY>] [--secret-from-stdin <KEY>] [--wait] [--timeout <seconds>] [--poll-interval <seconds>] [--time]

FLAGS
      --api-key <value>              Primitive API key override.
      --file <bundle>                Path to the bundled ESM handler file. Exactly one of --file or --source is required.
      --name <name>                  Required function name.
      --poll-interval <value>        Seconds between deploy-status polls when --wait is set. Defaults to 2.
      --secret <KEY=VALUE>           Secret KEY=VALUE to seed on the deployed function. Repeatable.
      --secret-from-env <KEY>        Secret KEY to read from the environment. Repeatable.
      --secret-from-env-file <FILE:KEY>
                                      Secret FILE:KEY to read from a dotenv-style file. Repeatable.
      --secret-from-file <KEY=PATH>  Secret KEY=PATH to read from a UTF-8 file. Repeatable.
      --secret-from-stdin <KEY>      Secret KEY to read from stdin.
      --source <dir>                 Path to a project directory for managed build. Exactly one of --file or --source is required.
      --source-map-file <path>       Optional path to a source map for the bundle.
      --time                         Print elapsed wall-clock time to stderr.
      --timeout <value>              Seconds to wait when --wait is set before exiting non-zero. Use 0 to wait forever. Defaults to 120.
      --wait                         Wait until the function deploy reaches deployed or failed.

EXAMPLES
  {bin} functions deploy --name forwarder --file ./bundle.js
  {bin} functions deploy --name triage --source ./triage-agent
  {bin} functions deploy --name forwarder --file ./bundle.js --source-map-file ./bundle.js.map
  {bin} functions deploy --name forwarder --file ./bundle.js --secret MODEL_API_KEY=token-...
  {bin} functions deploy --name triage --source . --wait
"#
    )
}

pub fn functions_set_secret_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Write a function secret and optionally redeploy it

USAGE
  {bin} functions set-secret --id <fn-id> --key <KEY> [--api-key <value>] [--value <value>] [--value-from-env <KEY>] [--value-file <path>] [--value-from-env-file <FILE[:KEY]>] [--stdin] [--redeploy] [--time]

FLAGS
      --api-key <value>              Primitive API key override.
      --id <fn-id>                   Required function id.
      --key <KEY>                    Required secret key.
      --redeploy                     Redeploy the function with its current code so the new value is live.
      --stdin                        Read the secret value from stdin.
      --time                         Print elapsed wall-clock time to stderr.
      --value <value>                Secret value.
      --value-file <path>            UTF-8 file to read as the secret value.
      --value-from-env <KEY>         Environment variable to read as the secret value.
      --value-from-env-file <FILE[:KEY]>
                                      Dotenv-style file to read as the secret value.

EXAMPLES
  {bin} functions set-secret --id fn_123 --key API_TOKEN --value abc123
  {bin} functions set-secret --id fn_123 --key MODEL_API_KEY --value-from-env MODEL_API_KEY --redeploy
  printf '%s' "$MODEL_API_KEY" | {bin} functions set-secret --id fn_123 --key MODEL_API_KEY --stdin --redeploy
"#
    )
}

pub fn functions_redeploy_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Redeploy an existing function from a bundled handler file

USAGE
  {bin} functions redeploy --id <fn-id> --file <bundle> [--api-key <value>] [--source-map-file <path>] [--secret <KEY=VALUE>] [--secret-from-env <KEY>] [--secret-from-file <KEY=PATH>] [--secret-from-env-file <FILE:KEY>] [--secret-from-stdin <KEY>] [--wait] [--timeout <seconds>] [--poll-interval <seconds>] [--time]

FLAGS
      --api-key <value>              Primitive API key override.
      --file <bundle>                Path to the bundled ESM handler file.
      --id <fn-id>                   Required function id.
      --poll-interval <value>        Seconds between deploy-status polls when --wait is set. Defaults to 2.
      --secret <KEY=VALUE>           Secret KEY=VALUE to set before redeploying. Repeatable.
      --secret-from-env <KEY>        Secret KEY to read from the environment. Repeatable.
      --secret-from-env-file <FILE:KEY>
                                      Secret FILE:KEY to read from a dotenv-style file. Repeatable.
      --secret-from-file <KEY=PATH>  Secret KEY=PATH to read from a UTF-8 file. Repeatable.
      --secret-from-stdin <KEY>      Secret KEY to read from stdin.
      --source-map-file <path>       Optional path to a source map for the bundle.
      --time                         Print elapsed wall-clock time to stderr.
      --timeout <value>              Seconds to wait when --wait is set before exiting non-zero. Use 0 to wait forever. Defaults to 120.
      --wait                         Wait until the function deploy reaches deployed or failed.

EXAMPLES
  {bin} functions redeploy --id fn_123 --file ./bundle.js
  {bin} functions redeploy --id fn_123 --file ./bundle.js --source-map-file ./bundle.js.map
  {bin} functions redeploy --id fn_123 --file ./bundle.js --secret MODEL_API_KEY=token-...
  {bin} functions redeploy --id fn_123 --file ./bundle.js --wait
"#
    )
}

pub fn functions_route_set_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Bind inbound mail to a function

USAGE
  {bin} functions route-set --id <fn-id> [--api-key <value>] [--domain <domain-id> | --fallback] [--takeover] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --domain <id>     Verified inbound domain id to scope this function to.
      --fallback        Bind this function as the org fallback.
      --id <fn-id>      Required function id.
      --takeover        Deactivate any conflicting binding before installing this one.
      --time            Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} functions route-set --id fn_123 --domain domain_123
  {bin} functions route-set --id fn_123 --fallback
  {bin} functions route-set --id fn_123 --domain domain_123 --takeover
"#
    )
}

pub fn functions_route_unset_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Unbind any route from a function

USAGE
  {bin} functions route-unset --id <fn-id> [--api-key <value>] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --id <fn-id>       Required function id.
      --time             Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} functions route-unset --id fn_123
"#
    )
}

pub fn functions_route_get_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Show a function's current route binding

USAGE
  {bin} functions route-get --id <fn-id> [--api-key <value>] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --id <fn-id>       Required function id.
      --time             Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} functions route-get --id fn_123
"#
    )
}

pub fn functions_routing_topology_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Show the org-wide function routing topology

USAGE
  {bin} functions routing-topology [--api-key <value>] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --time             Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} functions routing-topology
"#
    )
}

pub fn functions_test_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Trigger a test invocation; with --wait, watch it land

USAGE
  {bin} functions test --id <fn-id> [--api-key <value>] [--local-part <value>] [--wait] [--show-sends] [--timeout <seconds>] [--poll-interval <seconds>] [--time]

FLAGS
      --api-key <value>        Primitive API key override.
      --id <fn-id>             Required function id.
      --local-part <value>     Override the synthetic local-part the test inbound is addressed to.
      --poll-interval <value>  Seconds between polls while waiting. Defaults to 2.
      --show-sends             Also print outbound emails emitted while processing the test inbound. Implies --wait.
      --time                   Print elapsed wall-clock time to stderr.
      --timeout <value>        Seconds to wait before exiting non-zero when --wait is set. Use 0 to wait forever. Defaults to 60.
      --wait                   Block until the function test run reaches a terminal state or --timeout elapses.

EXAMPLES
  {bin} functions test --id fn_123
  {bin} functions test --id fn_123 --local-part summarize
  {bin} functions test --id fn_123 --wait --show-sends
"#
    )
}

pub fn functions_templates_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"List available Primitive Function templates

USAGE
  {bin} functions templates [--json]

FLAGS
      --json  Format output as json.

EXAMPLES
  {bin} functions templates
  {bin} functions templates --json
"#
    )
}

pub fn functions_logs_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"List or follow a function's execution logs

USAGE
  {bin} functions logs --id <fn-id> [--api-key <value>] [--limit <value>] [--cursor <value>] [-f] [--jsonl] [--poll-interval <seconds>] [--time]

FLAGS
  -f, --follow                 Keep polling for new logs.
      --api-key <value>        Primitive API key override.
      --cursor <value>         Opaque pagination cursor. Not supported with --follow.
      --id <fn-id>             Required function id.
      --jsonl                  Print one compact JSON object per log row.
      --limit <value>          Maximum rows to fetch per poll. Defaults to 50.
      --poll-interval <value>  Seconds between polls when --follow is set. Defaults to 2.
      --time                   Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} functions logs --id <fn-id>
  {bin} functions logs --id <fn-id> --jsonl
  {bin} functions logs --id <fn-id> --follow
"#
    )
}

pub fn is_valid_function_name(name: &str) -> bool {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    if name.len() > 63 || !first.is_ascii_lowercase() && !first.is_ascii_digit() {
        return false;
    }
    chars.all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '-' || ch == '_')
}

pub fn function_template_ids() -> Vec<String> {
    vec![DEFAULT_FUNCTION_TEMPLATE_ID.to_string()]
}

pub fn function_template_summaries() -> Vec<FunctionTemplateSummary> {
    vec![email_reply_template_summary()]
}

pub fn format_function_template_list(templates: &[FunctionTemplateSummary]) -> String {
    let mut lines = vec![
        "Available Primitive Function templates:".to_string(),
        String::new(),
    ];

    for template in templates {
        lines.push(template.id.clone());
        lines.push(format!("  title: {}", template.title));
        lines.push(format!("  author: {}", template.author.name));
        lines.push(format!("  summary: {}", template.summary));
        lines.push(format!(
            "  tags: {}",
            if template.tags.is_empty() {
                "none".to_string()
            } else {
                template.tags.join(", ")
            }
        ));
        lines.push(format!(
            "  secrets: {}",
            if template.secrets.is_empty() {
                "none".to_string()
            } else {
                template.secrets.join(", ")
            }
        ));
        lines.push(String::new());
    }

    lines.push("Use `primitive functions init <name> --template <id>`.".to_string());
    lines.join("\n")
}

pub fn scaffold_files(name: &str, template_id: Option<&str>) -> Result<Vec<FunctionTemplateFile>> {
    let template_id = template_id.unwrap_or(DEFAULT_FUNCTION_TEMPLATE_ID);
    if template_id != DEFAULT_FUNCTION_TEMPLATE_ID {
        return Err(anyhow!(
            "Unknown function template \"{template_id}\". Available templates: {}. Run `primitive functions templates` for details.",
            function_template_ids().join(", ")
        ));
    }
    Ok(render_email_reply_template_files(name))
}

pub fn parse_init_command_plan(args: &[String]) -> Result<InitCommandPlan> {
    let parsed = parse_args(args, &["out-dir", "template"], &[], &[])?;
    if parsed.positionals.len() != 1 {
        return Err(anyhow!(
            "functions init requires exactly one <name> argument."
        ));
    }
    let name = parsed.positionals[0].clone();
    if !is_valid_function_name(&name) {
        return Err(anyhow!(
            "Invalid function name \"{name}\". Use lowercase letters, digits, hyphens, or underscores (1-63 chars, must start with a letter or digit)."
        ));
    }
    let template_id =
        flag_one(&parsed, "template").unwrap_or_else(|| DEFAULT_FUNCTION_TEMPLATE_ID.to_string());
    if template_id != DEFAULT_FUNCTION_TEMPLATE_ID {
        return Err(anyhow!(
            "Unknown function template \"{template_id}\". Available templates: {}. Run `primitive functions templates` for details.",
            function_template_ids().join(", ")
        ));
    }
    let out_dir = flag_one(&parsed, "out-dir").unwrap_or_else(|| format!("./{name}"));
    Ok(InitCommandPlan {
        name,
        out_dir,
        template_id,
    })
}

pub fn parse_templates_command_plan(args: &[String]) -> Result<TemplatesCommandPlan> {
    let parsed = parse_args(args, &[], &["json"], &[])?;
    reject_positionals(&parsed)?;
    Ok(TemplatesCommandPlan {
        json: parsed.bool_flags.get("json") == Some(&true),
    })
}

pub fn build_deploy_file_request(input: &DeployFileInput) -> ApiRequest {
    let mut body = Map::new();
    insert_string(&mut body, "name", &input.name);
    insert_string(&mut body, "code", &input.code);
    insert_optional_string(&mut body, "sourceMap", input.source_map.as_ref());
    ApiRequest {
        method: "POST".to_string(),
        path: "/functions".to_string(),
        query: BTreeMap::new(),
        body: Some(Value::Object(body)),
    }
}

pub fn build_deploy_file_request_from_paths(
    name: &str,
    file: &str,
    source_map_file: Option<&str>,
    mut read_file: impl FnMut(&str) -> Result<String>,
) -> Result<ApiRequest> {
    let code = read_file(file).with_context(|| format!("Could not read --file {file}"))?;
    let source_map = source_map_file
        .map(|path| {
            read_file(path).with_context(|| format!("Could not read --source-map-file {path}"))
        })
        .transpose()?;
    Ok(build_deploy_file_request(&DeployFileInput {
        name: name.to_string(),
        code,
        source_map,
    }))
}

pub fn build_deploy_source_create_request(input: &SourceDeployInput) -> ApiRequest {
    let mut body = Map::new();
    insert_string(&mut body, "name", &input.name);
    body.insert("files".to_string(), json!(input.files));
    ApiRequest {
        method: "POST".to_string(),
        path: "/functions".to_string(),
        query: BTreeMap::new(),
        body: Some(Value::Object(body)),
    }
}

pub fn build_redeploy_file_request(input: &RedeployFileInput) -> ApiRequest {
    let mut body = Map::new();
    insert_string(&mut body, "code", &input.code);
    insert_optional_string(&mut body, "sourceMap", input.source_map.as_ref());
    ApiRequest {
        method: "PUT".to_string(),
        path: format!("/functions/{}", input.id),
        query: BTreeMap::new(),
        body: Some(Value::Object(body)),
    }
}

pub fn build_redeploy_file_request_from_paths(
    id: &str,
    file: &str,
    source_map_file: Option<&str>,
    mut read_file: impl FnMut(&str) -> Result<String>,
) -> Result<ApiRequest> {
    let code = read_file(file).with_context(|| format!("Could not read --file {file}"))?;
    let source_map = source_map_file
        .map(|path| {
            read_file(path).with_context(|| format!("Could not read --source-map-file {path}"))
        })
        .transpose()?;
    Ok(build_redeploy_file_request(&RedeployFileInput {
        id: id.to_string(),
        code,
        source_map,
    }))
}

pub fn build_redeploy_source_request(input: &SourceRedeployInput) -> ApiRequest {
    let mut body = Map::new();
    body.insert("files".to_string(), json!(input.files));
    ApiRequest {
        method: "PUT".to_string(),
        path: format!("/functions/{}", input.id),
        query: BTreeMap::new(),
        body: Some(Value::Object(body)),
    }
}

pub fn parse_deploy_command_plan(args: &[String]) -> Result<DeployCommandPlan> {
    let parsed = parse_args(
        args,
        &[
            "name",
            "file",
            "source",
            "source-map-file",
            "secret-from-stdin",
            "timeout",
            "poll-interval",
        ],
        &["wait", "time"],
        &[
            "secret",
            "secret-from-env",
            "secret-from-file",
            "secret-from-env-file",
        ],
    )?;
    reject_positionals(&parsed)?;
    let name = required_flag(&parsed, "name")?;
    let file = flag_one(&parsed, "file");
    let source = flag_one(&parsed, "source");
    let mode = match (file, source) {
        (Some(file), None) => DeployModePlan::File {
            file,
            source_map_file: flag_one(&parsed, "source-map-file"),
        },
        (None, Some(source_dir)) => DeployModePlan::Source { source_dir },
        _ => {
            return Err(anyhow!(
                "Provide exactly one of --file (a pre-built bundle) or --source (a project directory for managed build)."
            ));
        }
    };
    let timeout_seconds =
        optional_u64_flag(&parsed, "timeout")?.unwrap_or(DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS);
    let poll_interval_seconds = optional_u64_flag(&parsed, "poll-interval")?
        .unwrap_or(DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS);
    validate_deploy_wait_flags(timeout_seconds, poll_interval_seconds)?;
    Ok(DeployCommandPlan {
        name,
        mode,
        secrets: secret_source_plan_from_parsed(&parsed),
        wait: parsed.bool_flags.get("wait") == Some(&true),
        timeout_seconds,
        poll_interval_seconds,
    })
}

pub fn parse_redeploy_command_plan(args: &[String]) -> Result<RedeployCommandPlan> {
    let parsed = parse_args(
        args,
        &[
            "id",
            "file",
            "source-map-file",
            "secret-from-stdin",
            "timeout",
            "poll-interval",
        ],
        &["wait", "time"],
        &[
            "secret",
            "secret-from-env",
            "secret-from-file",
            "secret-from-env-file",
        ],
    )?;
    reject_positionals(&parsed)?;
    let timeout_seconds =
        optional_u64_flag(&parsed, "timeout")?.unwrap_or(DEFAULT_DEPLOY_WAIT_TIMEOUT_SECONDS);
    let poll_interval_seconds = optional_u64_flag(&parsed, "poll-interval")?
        .unwrap_or(DEFAULT_DEPLOY_POLL_INTERVAL_SECONDS);
    validate_deploy_wait_flags(timeout_seconds, poll_interval_seconds)?;
    Ok(RedeployCommandPlan {
        id: required_flag(&parsed, "id")?,
        file: required_flag(&parsed, "file")?,
        source_map_file: flag_one(&parsed, "source-map-file"),
        secrets: secret_source_plan_from_parsed(&parsed),
        wait: parsed.bool_flags.get("wait") == Some(&true),
        timeout_seconds,
        poll_interval_seconds,
    })
}

pub fn validate_deploy_wait_flags(timeout_seconds: u64, poll_interval_seconds: u64) -> Result<()> {
    if poll_interval_seconds == 0 {
        return Err(anyhow!("--poll-interval must be greater than 0."));
    }
    let _ = timeout_seconds;
    Ok(())
}

pub fn parse_secret_flags(raw: &[String]) -> Result<Vec<SecretFlagPair>> {
    resolve_secret_flags(
        &SecretSourceInput {
            inline: raw.to_vec(),
            ..Default::default()
        },
        |_| unreachable!("no file source expected"),
        || unreachable!("no stdin source expected"),
    )
}

pub fn resolve_secret_flags(
    input: &SecretSourceInput,
    mut read_file: impl FnMut(&str) -> Result<String>,
    mut read_stdin: impl FnMut() -> Result<String>,
) -> Result<Vec<SecretFlagPair>> {
    let mut secrets = Vec::new();
    let mut seen_keys = BTreeSet::new();
    let mut env_file_cache: BTreeMap<String, BTreeMap<String, String>> = BTreeMap::new();

    for entry in &input.inline {
        let (key, value) = parse_key_value_flag(entry, "--secret")?;
        reserve_secret_key(&key, "--secret", &mut seen_keys)?;
        secrets.push(SecretFlagPair { key, value });
    }

    for key in &input.from_env {
        reserve_secret_key(key, "--secret-from-env", &mut seen_keys)?;
        let value = input.env.get(key).cloned().ok_or_else(|| {
            anyhow!(
                "--secret-from-env {key} could not read {key}: environment variable is not set."
            )
        })?;
        secrets.push(SecretFlagPair {
            key: key.clone(),
            value,
        });
    }

    for entry in &input.from_file {
        let (key, path) = parse_key_value_flag(entry, "--secret-from-file")?;
        reserve_secret_key(&key, "--secret-from-file", &mut seen_keys)?;
        let value = read_file(&path)
            .map_err(|error| anyhow!("Could not read --secret-from-file {path}: {error}"))?;
        secrets.push(SecretFlagPair { key, value });
    }

    for entry in &input.from_env_file {
        let (path, key) = parse_env_file_key_ref(entry, "--secret-from-env-file")?;
        reserve_secret_key(&key, "--secret-from-env-file", &mut seen_keys)?;
        let file = read_cached_env_file(&path, &mut read_file, &mut env_file_cache)?;
        let value = file.get(&key).cloned().ok_or_else(|| {
            anyhow!(
                "--secret-from-env-file {entry} could not read {key}: key is not present in {path}."
            )
        })?;
        secrets.push(SecretFlagPair { key, value });
    }

    if let Some(key) = &input.from_stdin {
        reserve_secret_key(key, "--secret-from-stdin", &mut seen_keys)?;
        let value = strip_one_trailing_line_ending(
            &read_stdin()
                .map_err(|error| anyhow!("Could not read --secret-from-stdin: {error}"))?,
        );
        secrets.push(SecretFlagPair {
            key: key.clone(),
            value,
        });
    }

    Ok(secrets)
}

pub fn resolve_secret_source_plan(
    plan: &SecretSourcePlan,
    env: BTreeMap<String, String>,
    read_file: impl FnMut(&str) -> Result<String>,
    read_stdin: impl FnMut() -> Result<String>,
) -> Result<Vec<SecretFlagPair>> {
    resolve_secret_flags(
        &SecretSourceInput {
            inline: plan.inline.clone(),
            from_env: plan.from_env.clone(),
            from_file: plan.from_file.clone(),
            from_env_file: plan.from_env_file.clone(),
            from_stdin: plan.from_stdin.clone(),
            env,
        },
        read_file,
        read_stdin,
    )
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
            let values = parse_env_file(
                &read_file(&path)
                    .map_err(|error| anyhow!("Could not read env file {path}: {error}"))?,
            );
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

pub fn parse_set_secret_command_plan(args: &[String]) -> Result<SetSecretCommandPlan> {
    let parsed = parse_args(
        args,
        &[
            "id",
            "key",
            "value",
            "value-from-env",
            "value-file",
            "value-from-env-file",
        ],
        &["stdin", "redeploy", "time"],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let key = required_flag(&parsed, "key")?;
    validate_secret_key(&key, "--key")?;
    let source = single_secret_source_from_parsed(&parsed)?;
    Ok(SetSecretCommandPlan {
        id: required_flag(&parsed, "id")?,
        key,
        source,
        redeploy: parsed.bool_flags.get("redeploy") == Some(&true),
    })
}

pub fn build_set_secret_request(id: &str, key: &str, value: &str) -> ApiRequest {
    ApiRequest {
        method: "PUT".to_string(),
        path: format!("/functions/{id}/secrets/{key}"),
        query: BTreeMap::new(),
        body: Some(json!({ "value": value })),
    }
}

pub fn build_set_secret_result(secret: &Value, redeploy: Option<&Value>) -> Value {
    let mut result = Map::new();
    result.insert("secret".to_string(), secret.clone());
    if let Some(redeploy) = redeploy {
        result.insert("redeploy".to_string(), redeploy.clone());
    }
    Value::Object(result)
}

pub fn format_set_secret_saved_warning(id: &str, key: &str) -> String {
    format!(
        "Secret {key} saved. Not live until redeploy. Re-run with --redeploy, or run `primitive functions redeploy --id {id} --file <bundle.js>`."
    )
}

pub fn format_set_secret_redeploy_stage_warning(id: &str, stage: SetSecretRedeployStage) -> String {
    match stage {
        SetSecretRedeployStage::GetFunction => format!(
            "Secret was written, but reading current function code for redeploy failed; the secret is NOT yet live. Re-run with --redeploy, or call `primitive functions redeploy --id {id} --file <bundle>` once you have the bundle."
        ),
        SetSecretRedeployStage::Redeploy => format!(
            "Secret was written, but the redeploy step failed; the secret is NOT yet live. Inspect the function's deploy_error and re-run `primitive functions redeploy --id {id} --file <bundle>` once the cause is fixed."
        ),
    }
}

pub fn build_get_function_request(id: &str) -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: format!("/functions/{id}"),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn build_secret_redeploy_request(id: &str, current_code: &str) -> ApiRequest {
    ApiRequest {
        method: "PUT".to_string(),
        path: format!("/functions/{id}"),
        query: BTreeMap::new(),
        body: Some(json!({ "code": current_code })),
    }
}

pub fn build_logs_request(id: &str, limit: u64, cursor: Option<&str>) -> ApiRequest {
    let mut query = BTreeMap::new();
    query.insert("limit".to_string(), limit.to_string());
    if let Some(cursor) = cursor {
        query.insert("cursor".to_string(), cursor.to_string());
    }
    ApiRequest {
        method: "GET".to_string(),
        path: format!("/functions/{id}/logs"),
        query,
        body: None,
    }
}

pub fn parse_logs_command_plan(args: &[String]) -> Result<FunctionLogsPlan> {
    let args = expand_logs_short_flags(args);
    let parsed = parse_args(
        &args,
        &[
            "api-key",
            "api-base-url",
            "id",
            "limit",
            "cursor",
            "poll-interval",
        ],
        &["follow", "jsonl", "time"],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let limit = optional_u64_flag(&parsed, "limit")?.unwrap_or(DEFAULT_LOG_LIMIT);
    if limit == 0 {
        return Err(anyhow!("--limit must be greater than 0."));
    }
    let poll_interval_seconds =
        optional_u64_flag(&parsed, "poll-interval")?.unwrap_or(DEFAULT_LOG_POLL_INTERVAL_SECONDS);
    if poll_interval_seconds == 0 {
        return Err(anyhow!("--poll-interval must be greater than 0."));
    }
    let follow = parsed.bool_flags.get("follow") == Some(&true);
    let cursor = flag_one(&parsed, "cursor");
    if follow && cursor.is_some() {
        return Err(crate::usage_err!(
            "--cursor cannot be combined with --follow."
        ));
    }
    Ok(FunctionLogsPlan {
        request: build_logs_request(&required_flag(&parsed, "id")?, limit, cursor.as_deref()),
        follow,
        jsonl: parsed.bool_flags.get("jsonl") == Some(&true),
        poll_interval_seconds,
    })
}

fn expand_logs_short_flags(args: &[String]) -> Vec<String> {
    args.iter()
        .map(|arg| {
            if arg == "-f" {
                "--follow".to_string()
            } else {
                arg.clone()
            }
        })
        .collect()
}

pub fn order_function_logs_for_display(rows: &[FunctionLogRow]) -> Vec<FunctionLogRow> {
    rows.iter().cloned().rev().collect()
}

pub fn format_function_log_line(row: &FunctionLogRow) -> String {
    let metadata = row
        .metadata
        .as_ref()
        .filter(|value| value.as_object().is_some_and(|object| !object.is_empty()))
        .map(|value| format!(" {}", serde_json::to_string(value).expect("json metadata")))
        .unwrap_or_default();
    format!(
        "{} {} {}{}",
        row.ts,
        log_level_label(&row.level),
        row.message,
        metadata
    )
}

pub fn collect_fresh_function_logs_from_page(
    rows: &[FunctionLogRow],
    seen_ids: &mut BTreeSet<String>,
) -> FreshFunctionLogs {
    let mut fresh_newest_first = Vec::new();
    let mut reached_seen = false;

    for row in rows {
        if seen_ids.contains(&row.id) {
            reached_seen = true;
            continue;
        }
        fresh_newest_first.push(row.clone());
        seen_ids.insert(row.id.clone());
    }

    FreshFunctionLogs {
        fresh_newest_first,
        reached_seen,
    }
}

pub fn filter_new_function_logs(
    rows: &[FunctionLogRow],
    seen_ids: &mut BTreeSet<String>,
) -> Vec<FunctionLogRow> {
    order_function_logs_for_display(
        &collect_fresh_function_logs_from_page(rows, seen_ids).fresh_newest_first,
    )
}

pub fn build_route_set_request(id: &str, target: RouteTargetInput, takeover: bool) -> ApiRequest {
    let target = match target {
        RouteTargetInput::Domain(domain_id) => json!({
            "kind": "domain",
            "domainId": domain_id,
        }),
        RouteTargetInput::Fallback => json!({ "kind": "fallback" }),
    };
    let mut body = Map::new();
    body.insert("target".to_string(), target);
    if takeover {
        body.insert("takeover".to_string(), Value::Bool(true));
    }
    ApiRequest {
        method: "PUT".to_string(),
        path: format!("/functions/{id}/route"),
        query: BTreeMap::new(),
        body: Some(Value::Object(body)),
    }
}

pub fn parse_route_set_command_plan(args: &[String]) -> Result<RouteSetCommandPlan> {
    let parsed = parse_args(
        args,
        &["id", "domain"],
        &["fallback", "takeover", "time"],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let domain = flag_one(&parsed, "domain");
    let fallback = parsed.bool_flags.get("fallback") == Some(&true);
    let target = match (domain, fallback) {
        (Some(domain), false) => RouteTargetInput::Domain(domain),
        (None, true) => RouteTargetInput::Fallback,
        _ => {
            return Err(anyhow!(
                "Provide exactly one of --domain (scoped binding) or --fallback (org fallback)."
            ));
        }
    };
    Ok(RouteSetCommandPlan {
        request: build_route_set_request(
            &required_flag(&parsed, "id")?,
            target,
            parsed.bool_flags.get("takeover") == Some(&true),
        ),
    })
}

pub fn build_route_unset_request(id: &str) -> ApiRequest {
    ApiRequest {
        method: "DELETE".to_string(),
        path: format!("/functions/{id}/route"),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn parse_route_unset_command_plan(args: &[String]) -> Result<ApiRequest> {
    let parsed = parse_args(args, &["id"], &["time"], &[])?;
    reject_positionals(&parsed)?;
    Ok(build_route_unset_request(&required_flag(&parsed, "id")?))
}

pub fn build_route_get_request(id: &str) -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: format!("/functions/{id}/routing"),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn parse_route_get_command_plan(args: &[String]) -> Result<ApiRequest> {
    let parsed = parse_args(args, &["id"], &["time"], &[])?;
    reject_positionals(&parsed)?;
    Ok(build_route_get_request(&required_flag(&parsed, "id")?))
}

pub fn build_routing_topology_request() -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/functions/routing-topology".to_string(),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn parse_routing_topology_command_plan(args: &[String]) -> Result<ApiRequest> {
    let parsed = parse_args(args, &[], &["time"], &[])?;
    reject_positionals(&parsed)?;
    Ok(build_routing_topology_request())
}

pub fn build_test_function_request(id: &str, local_part: Option<&str>) -> ApiRequest {
    let body = local_part.map(|local_part| json!({ "local_part": local_part }));
    ApiRequest {
        method: "POST".to_string(),
        path: format!("/functions/{id}/test"),
        query: BTreeMap::new(),
        body,
    }
}

pub fn build_test_run_trace_request(id: &str, run_id: &str) -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: format!("/functions/{id}/test-runs/{run_id}/trace"),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn parse_test_function_command_plan(args: &[String]) -> Result<TestFunctionPlan> {
    let parsed = parse_args(
        args,
        &["id", "local-part", "timeout", "poll-interval"],
        &["wait", "show-sends", "time"],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let timeout_seconds =
        optional_u64_flag(&parsed, "timeout")?.unwrap_or(DEFAULT_TEST_WAIT_TIMEOUT_SECONDS);
    let poll_interval_seconds =
        optional_u64_flag(&parsed, "poll-interval")?.unwrap_or(DEFAULT_TEST_POLL_INTERVAL_SECONDS);
    if poll_interval_seconds == 0 {
        return Err(anyhow!("--poll-interval must be greater than 0."));
    }
    let wait = parsed.bool_flags.get("wait") == Some(&true);
    let show_sends = parsed.bool_flags.get("show-sends") == Some(&true);
    Ok(TestFunctionPlan {
        trigger: build_test_function_request(
            &required_flag(&parsed, "id")?,
            flag_one(&parsed, "local-part").as_deref(),
        ),
        should_wait: wait || show_sends,
        should_show_sends: show_sends,
        timeout_seconds,
        poll_interval_seconds,
    })
}

pub fn build_function_test_outcome(
    function_id: &str,
    invocation: &Value,
    trace: &Value,
    elapsed_seconds: u64,
    show_sends: bool,
) -> Value {
    let inbound = trace.get("inbound_email").filter(|value| !value.is_null());
    let mut outcome = Map::new();
    outcome.insert("elapsed_seconds".to_string(), json!(elapsed_seconds));
    outcome.insert("function_id".to_string(), json!(function_id));
    copy_json_field(&mut outcome, invocation, "inbound_domain");
    outcome.insert(
        "inbound_id".to_string(),
        inbound
            .and_then(|value| value.get("id"))
            .cloned()
            .unwrap_or(Value::Null),
    );
    copy_json_field_as(&mut outcome, invocation, "to", "inbound_to");
    copy_json_field(invocation_map(&mut outcome), invocation, "poll_since");
    copy_json_field(trace_map(&mut outcome), trace, "state");
    copy_json_field_as(&mut outcome, invocation, "test_run_id", "test_run_id");
    copy_json_field_as(&mut outcome, invocation, "send_id", "test_send_id");
    copy_json_field_as(&mut outcome, invocation, "subject", "test_subject");
    copy_json_field(invocation_map(&mut outcome), invocation, "trace_url");
    copy_json_field(invocation_map(&mut outcome), invocation, "watch_url");
    outcome.insert(
        "webhook_attempt_count".to_string(),
        inbound
            .and_then(|value| value.get("webhook_attempt_count"))
            .cloned()
            .unwrap_or(Value::Null),
    );
    outcome.insert(
        "webhook_last_error".to_string(),
        inbound
            .and_then(|value| value.get("webhook_last_error"))
            .cloned()
            .unwrap_or(Value::Null),
    );
    outcome.insert(
        "webhook_last_status_code".to_string(),
        inbound
            .and_then(|value| value.get("webhook_last_status_code"))
            .cloned()
            .unwrap_or(Value::Null),
    );
    outcome.insert(
        "webhook_status".to_string(),
        inbound
            .and_then(|value| value.get("webhook_status"))
            .cloned()
            .unwrap_or(Value::Null),
    );
    if show_sends {
        outcome.insert(
            "sent_emails".to_string(),
            trace.get("replies").cloned().unwrap_or_else(|| json!([])),
        );
    }
    Value::Object(outcome)
}

pub fn is_terminal_function_test_trace_state(trace: &Value) -> bool {
    matches!(
        trace.get("state").and_then(Value::as_str),
        Some("completed" | "failed" | "send_failed")
    )
}

pub fn function_test_failure_exit_code(trace: &Value) -> Option<i32> {
    match trace.get("state").and_then(Value::as_str) {
        Some("failed" | "send_failed") => Some(1),
        _ => None,
    }
}

pub fn should_report_test_trace_no_route(trace: &Value, elapsed: Duration) -> bool {
    let inbound_landed = trace
        .get("inbound_email")
        .is_some_and(|value| !value.is_null());
    let no_deliveries = trace
        .get("deliveries")
        .and_then(Value::as_array)
        .is_some_and(Vec::is_empty);
    inbound_landed
        && no_deliveries
        && elapsed > Duration::from_secs(TEST_TRACE_NO_DELIVERIES_GRACE_SECONDS)
}

pub fn format_function_test_no_route_message(function_id: &str) -> String {
    format!(
        "Inbound email arrived but no route matched. Bind one with: primitive functions route-set --id {function_id} --domain <domain-id> (or --fallback), then retry."
    )
}

pub fn format_function_test_timeout_message(
    timeout_seconds: u64,
    invocation: &Value,
    final_trace: Option<&Value>,
) -> String {
    let inbound_landed = final_trace
        .and_then(|trace| trace.get("inbound_email"))
        .is_some_and(|value| !value.is_null());
    let delivery_count = final_trace
        .and_then(|trace| trace.get("deliveries"))
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let log_count = final_trace
        .and_then(|trace| trace.get("logs"))
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let reply_count = final_trace
        .and_then(|trace| trace.get("replies"))
        .and_then(Value::as_array)
        .map_or(0, Vec::len);
    let webhook_status = final_trace
        .and_then(|trace| trace.get("inbound_email"))
        .and_then(|inbound| inbound.get("webhook_status"))
        .and_then(Value::as_str)
        .unwrap_or("n/a");
    let watch_url = invocation
        .get("watch_url")
        .and_then(Value::as_str)
        .unwrap_or("n/a");
    let trace_url = invocation
        .get("trace_url")
        .and_then(Value::as_str)
        .unwrap_or("n/a");
    format!(
        "Timed out after {timeout_seconds}s. Trace summary: inbound_landed={inbound_landed} deliveries={delivery_count} logs={log_count} replies={reply_count} webhook_status={webhook_status}. Browse {watch_url} for the live view, or inspect {trace_url}."
    )
}

pub fn build_list_domains_request() -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/domains".to_string(),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn build_list_endpoints_request() -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/endpoints".to_string(),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn find_matching_function_endpoints(
    endpoints: &[RawEndpointRow],
    current_function_id: &str,
    inbound_domain_id: Option<&str>,
) -> Vec<MatchingFunctionEndpoint> {
    let mut domain_matches = Vec::new();
    let mut fallback_matches = Vec::new();
    for endpoint in endpoints {
        if endpoint.kind.as_deref() != Some("function") {
            continue;
        }
        if endpoint.enabled == Some(false) || endpoint.deactivated_at.is_some() {
            continue;
        }
        let Some(id) = endpoint.id.as_ref().filter(|id| !id.is_empty()) else {
            continue;
        };
        if let Some(domain_id) = endpoint
            .domain_id
            .as_ref()
            .filter(|value| !value.is_empty())
        {
            if inbound_domain_id != Some(domain_id.as_str()) {
                continue;
            }
            domain_matches.push(MatchingFunctionEndpoint {
                id: id.clone(),
                function_id: endpoint
                    .function_id
                    .clone()
                    .filter(|value| !value.is_empty()),
                is_current_function: endpoint.function_id.as_deref() == Some(current_function_id),
                scope: FunctionEndpointScope::Domain,
            });
        } else {
            fallback_matches.push(MatchingFunctionEndpoint {
                id: id.clone(),
                function_id: endpoint
                    .function_id
                    .clone()
                    .filter(|value| !value.is_empty()),
                is_current_function: endpoint.function_id.as_deref() == Some(current_function_id),
                scope: FunctionEndpointScope::Fallback,
            });
        }
    }
    if domain_matches.is_empty() {
        fallback_matches
    } else {
        domain_matches
    }
}

pub fn format_function_endpoint_noise_warning(
    to_address: &str,
    inbound_domain: &str,
    endpoints: &[MatchingFunctionEndpoint],
) -> Option<String> {
    if !endpoints
        .iter()
        .any(|endpoint| !endpoint.is_current_function)
    {
        return None;
    }
    let mut lines = vec![format!(
        "Warning: {} function endpoints may receive mail for {to_address}:",
        endpoints.len()
    )];
    for endpoint in endpoints {
        let scope = match endpoint.scope {
            FunctionEndpointScope::Fallback => "fallback".to_string(),
            FunctionEndpointScope::Domain => format!("scoped to {inbound_domain}"),
        };
        let current = if endpoint.is_current_function {
            " (this function)"
        } else {
            ""
        };
        let target = endpoint
            .function_id
            .as_ref()
            .map(|function_id| format!(" -> function {function_id}"))
            .unwrap_or_default();
        lines.push(format!(
            "- endpoint {}{target}, {scope}{current}",
            endpoint.id
        ));
    }
    Some(lines.join("\n"))
}

fn maybe_write_endpoint_noise_warning(
    current_function_id: &str,
    invocation: &Value,
    auth: &config::ResolvedAuth,
) {
    let Some(inbound_domain) = invocation.get("inbound_domain").and_then(Value::as_str) else {
        return;
    };
    let Some(to_address) = invocation.get("to").and_then(Value::as_str) else {
        return;
    };

    let Ok(domains) = execute_function_request(&build_list_domains_request(), auth) else {
        return;
    };
    let Ok(endpoints) = execute_function_request(&build_list_endpoints_request(), auth) else {
        return;
    };

    let inbound_domain_id = domain_id_for_inbound_domain(&domains, inbound_domain);
    let endpoint_rows = endpoint_rows_from_value(&endpoints);
    let matches = find_matching_function_endpoints(
        &endpoint_rows,
        current_function_id,
        inbound_domain_id.as_deref(),
    );
    if let Some(warning) =
        format_function_endpoint_noise_warning(to_address, inbound_domain, &matches)
    {
        eprintln!("{warning}");
    }
}

fn domain_id_for_inbound_domain(domains: &Value, inbound_domain: &str) -> Option<String> {
    rows_from_value(domains)?.iter().find_map(|row| {
        let domain = row.get("domain").and_then(Value::as_str)?;
        if domain.eq_ignore_ascii_case(inbound_domain) {
            row.get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.is_empty())
                .map(str::to_string)
        } else {
            None
        }
    })
}

fn endpoint_rows_from_value(endpoints: &Value) -> Vec<RawEndpointRow> {
    rows_from_value(endpoints)
        .map(|rows| {
            rows.iter()
                .filter_map(|row| serde_json::from_value(row.clone()).ok())
                .collect()
        })
        .unwrap_or_default()
}

fn rows_from_value(value: &Value) -> Option<&Vec<Value>> {
    value
        .as_array()
        .or_else(|| value.get("data").and_then(Value::as_array))
        .or_else(|| value.get("items").and_then(Value::as_array))
}

fn email_reply_template_summary() -> FunctionTemplateSummary {
    FunctionTemplateSummary {
        id: DEFAULT_FUNCTION_TEMPLATE_ID.to_string(),
        title: "Email Reply".to_string(),
        summary: "Reply to inbound email with the Primitive SDK.".to_string(),
        description: "A deployable TypeScript email handler that verifies signed email.received events, skips likely loops, and replies with the Primitive SDK.".to_string(),
        author: FunctionTemplateAuthor {
            id: "primitive-team".to_string(),
            name: "Primitive Team".to_string(),
            url: Some("https://primitive.dev".to_string()),
        },
        tags: vec![
            "email".to_string(),
            "reply".to_string(),
            "typescript".to_string(),
            "worker".to_string(),
        ],
        dependencies: vec!["@primitivedotdev/sdk".to_string()],
        dev_dependencies: vec![
            "primitive".to_string(),
            "esbuild".to_string(),
            "typescript".to_string(),
        ],
        secrets: Vec::new(),
    }
}

fn render_email_reply_template_files(name: &str) -> Vec<FunctionTemplateFile> {
    vec![
        FunctionTemplateFile {
            relative_path: "handler.ts".to_string(),
            contents: render_handler(),
        },
        FunctionTemplateFile {
            relative_path: "package.json".to_string(),
            contents: render_package_json(name),
        },
        FunctionTemplateFile {
            relative_path: "build.mjs".to_string(),
            contents: render_build_mjs(),
        },
        FunctionTemplateFile {
            relative_path: "tsconfig.json".to_string(),
            contents: render_tsconfig(),
        },
        FunctionTemplateFile {
            relative_path: ".gitignore".to_string(),
            contents: "node_modules\ndist\n".to_string(),
        },
        FunctionTemplateFile {
            relative_path: "README.md".to_string(),
            contents: render_readme(name),
        },
    ]
}

fn render_handler() -> String {
    r#"import {
  createPrimitiveClient,
  normalizeReceivedEmail,
  PRIMITIVE_SIGNATURE_HEADER,
  type EmailReceivedEvent,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "@primitivedotdev/sdk/api";

interface Env {
  PRIMITIVE_API_KEY: string;
  PRIMITIVE_API_BASE_URL: string;
  PRIMITIVE_WEBHOOK_SECRET: string;
}

function extractEmailAddresses(value: string | null | undefined): string[] {
  return (
    value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)?.map((address) =>
      address.toLowerCase(),
    ) ?? []
  );
}

function inboundRecipientAddresses(event: EmailReceivedEvent): string[] {
  return [
    ...event.email.smtp.rcpt_to.flatMap(extractEmailAddresses),
    ...extractEmailAddresses(event.email.headers.to),
  ];
}

export function isLoop(event: EmailReceivedEvent): boolean {
  const envelopeSender = (event.email.smtp.mail_from || "").trim();
  if (envelopeSender === "" || envelopeSender === "<>") return true;

  const fromAddresses = [
    ...extractEmailAddresses(event.email.headers.from),
    ...extractEmailAddresses(event.email.smtp.mail_from),
  ];
  if (fromAddresses.length === 0) return true;

  const inboundAddresses = new Set(inboundRecipientAddresses(event));
  return fromAddresses.some((from) => inboundAddresses.has(from));
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const rawBody = await req.text();
      const signatureHeader = req.headers.get(PRIMITIVE_SIGNATURE_HEADER) ?? "";

      try {
        await verifyWebhookSignature({
          rawBody,
          signatureHeader,
          secret: env.PRIMITIVE_WEBHOOK_SECRET,
        });
      } catch (signatureError) {
        if (signatureError instanceof WebhookVerificationError) {
          return new Response("invalid signature", { status: 401 });
        }
        throw signatureError;
      }

      const event = JSON.parse(rawBody) as EmailReceivedEvent;
      if (event.event !== "email.received") {
        return Response.json({ ok: true, skipped: event.event });
      }
      if (isLoop(event)) {
        return Response.json({ ok: true, skipped: "loop" });
      }

      const client = createPrimitiveClient({
        apiKey: env.PRIMITIVE_API_KEY,
        apiBaseUrl: env.PRIMITIVE_API_BASE_URL,
      });
      const reply = await client.reply(normalizeReceivedEmail(event), {
        text: "Got your message.",
      });

      return Response.json({ ok: true, reply });
    } catch (err) {
      console.error("handler error:", err);
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 200 },
      );
    }
  },
};
"#
    .to_string()
}

fn render_package_json(name: &str) -> String {
    format!(
        "{}\n",
        serde_json::to_string_pretty(&json!({
            "name": name,
            "version": "0.1.0",
            "private": true,
            "type": "module",
            "scripts": {
                "build": "node build.mjs",
                "deploy": format!("npm run build && primitive functions deploy --name {name} --file ./dist/handler.js --wait"),
                "test:function": "primitive functions test --id $PRIMITIVE_FUNCTION_ID --wait --show-sends",
                "logs": "primitive functions logs --id $PRIMITIVE_FUNCTION_ID",
                "redeploy": "npm run build && primitive functions redeploy --id $PRIMITIVE_FUNCTION_ID --file ./dist/handler.js --wait",
            },
            "dependencies": {
                "@primitivedotdev/sdk": SDK_VERSION_RANGE,
            },
            "devDependencies": {
                "primitive": CLI_VERSION_RANGE,
                "esbuild": ESBUILD_VERSION_RANGE,
                "typescript": "^5.7.2",
            },
        }))
        .expect("package json")
    )
}

fn render_build_mjs() -> String {
    r#"import { build } from "esbuild";

await build({
  entryPoints: ["handler.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["worker", "browser"],
  outfile: "dist/handler.js",
});
"#
    .to_string()
}

fn render_tsconfig() -> String {
    format!(
        "{}\n",
        serde_json::to_string_pretty(&json!({
            "compilerOptions": {
                "target": "ES2022",
                "module": "ESNext",
                "moduleResolution": "Bundler",
                "strict": true,
                "lib": ["ES2022", "WebWorker"],
                "types": [],
                "esModuleInterop": true,
                "skipLibCheck": true,
            },
            "include": ["handler.ts"],
        }))
        .expect("tsconfig json")
    )
}

fn render_readme(name: &str) -> String {
    format!(
        r#"# {name}

## What this is

A Primitive Function: a JavaScript handler that runs on inbound mail.
It receives the `email.received` event, demonstrates a basic reply
via the Primitive SDK, and returns a JSON envelope.

## Develop

```
npm install
npm run build
```

## Deploy

```
npm run deploy
```

After the first deploy, copy the returned function id into your shell:

```
export PRIMITIVE_FUNCTION_ID=<fn-id>
```

## Bind a route

```
primitive functions route-set --id "$PRIMITIVE_FUNCTION_ID" --domain <domain-id>
```

Use `--fallback` instead of `--domain` to bind the Function as the
org-wide fallback for any active domain that has no scoped binding.

## Prove it works

```
primitive inbox status
npm run test:function
npm run logs
```

## Redeploy

```
npm run redeploy
```

## Secrets

```
export MODEL_API_KEY=token-...
primitive functions set-secret --id "$PRIMITIVE_FUNCTION_ID" --key MODEL_API_KEY --value-from-env MODEL_API_KEY --redeploy
```
"#
    )
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
            let value = inline_value.as_deref().unwrap_or("true").parse()?;
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
            let value = args
                .get(index)
                .ok_or_else(|| anyhow!("Missing value for --{name}"))?;
            if value.starts_with("--") {
                return Err(anyhow!("Missing value for --{name}"));
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
        return Err(anyhow!("Unexpected argument: {value}"));
    }
    Ok(())
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
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
                .parse()
                .with_context(|| format!("Expected an integer for --{name}"))
        })
        .transpose()
}

fn secret_source_plan_from_parsed(parsed: &ParsedArgs) -> SecretSourcePlan {
    SecretSourcePlan {
        inline: flag_many(parsed, "secret"),
        from_env: flag_many(parsed, "secret-from-env"),
        from_file: flag_many(parsed, "secret-from-file"),
        from_env_file: flag_many(parsed, "secret-from-env-file"),
        from_stdin: flag_one(parsed, "secret-from-stdin"),
    }
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

fn parse_key_value_flag(entry: &str, flag_label: &str) -> Result<(String, String)> {
    let Some(eq) = entry.find('=') else {
        return Err(anyhow!(
            "{flag_label} expects KEY=VALUE (got {entry:?}). Example: {flag_label} API_TOKEN=abc123"
        ));
    };
    let key = &entry[..eq];
    if key.is_empty() {
        return Err(anyhow!(
            "{flag_label} is missing a KEY before '=' (got {entry:?}). Example: {flag_label} API_TOKEN=abc123"
        ));
    }
    Ok((key.to_string(), entry[eq + 1..].to_string()))
}

fn reserve_secret_key(key: &str, flag_label: &str, seen_keys: &mut BTreeSet<String>) -> Result<()> {
    validate_secret_key(key, flag_label)?;
    if !seen_keys.insert(key.to_string()) {
        return Err(anyhow!(
            "Secret KEY {key:?} was passed more than once. Each key may only appear once per command."
        ));
    }
    Ok(())
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

fn parse_env_file_key_ref(entry: &str, flag_label: &str) -> Result<(String, String)> {
    let Some(sep) = entry.rfind(':') else {
        return Err(anyhow!(
            "{flag_label} expects FILE:KEY (got {entry:?}). Example: {flag_label} .env.local:MODEL_API_KEY"
        ));
    };
    if sep == 0 || sep == entry.len() - 1 {
        return Err(anyhow!(
            "{flag_label} expects FILE:KEY (got {entry:?}). Example: {flag_label} .env.local:MODEL_API_KEY"
        ));
    }
    let path = entry[..sep].to_string();
    let key = entry[sep + 1..].to_string();
    validate_secret_key(&key, flag_label)?;
    Ok((path, key))
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

fn read_cached_env_file(
    path: &str,
    read_file: &mut impl FnMut(&str) -> Result<String>,
    cache: &mut BTreeMap<String, BTreeMap<String, String>>,
) -> Result<BTreeMap<String, String>> {
    if let Some(values) = cache.get(path) {
        return Ok(values.clone());
    }
    let contents =
        read_file(path).map_err(|error| anyhow!("Could not read env file {path}: {error}"))?;
    let values = parse_env_file(&contents);
    cache.insert(path.to_string(), values.clone());
    Ok(values)
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

fn insert_string(body: &mut Map<String, Value>, key: &str, value: &str) {
    body.insert(key.to_string(), Value::String(value.to_string()));
}

fn insert_optional_string(body: &mut Map<String, Value>, key: &str, value: Option<&String>) {
    if let Some(value) = value {
        insert_string(body, key, value);
    }
}

fn log_level_label(level: &str) -> String {
    let mut label = level.to_uppercase();
    while label.len() < 5 {
        label.push(' ');
    }
    label
}

fn copy_json_field(out: &mut Map<String, Value>, source: &Value, field: &str) {
    if let Some(value) = source.get(field) {
        out.insert(field.to_string(), value.clone());
    }
}

fn copy_json_field_as(out: &mut Map<String, Value>, source: &Value, field: &str, out_field: &str) {
    if let Some(value) = source.get(field) {
        out.insert(out_field.to_string(), value.clone());
    }
}

fn invocation_map(out: &mut Map<String, Value>) -> &mut Map<String, Value> {
    out
}

fn trace_map(out: &mut Map<String, Value>) -> &mut Map<String, Value> {
    out
}
