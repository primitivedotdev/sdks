use crate::{client, config};
use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::time::Instant;

const DOMAIN_DISPLAY_WIDTH: usize = 34;
const STATUS_DISPLAY_WIDTH: usize = 12;
const BOOL_DISPLAY_WIDTH: usize = 7;
const NUM_DISPLAY_WIDTH: usize = 6;
const DEFAULT_PRIMITIVE_LOCAL_PART: &str = "agent";
const DEFAULT_SETUP_FUNCTION_NAME: &str = "inbound-reply";
const DEFAULT_SETUP_LOCAL_PART: &str = "inbox";
const FUNCTION_ID_PLACEHOLDER: &str = "<function-id>";
const INBOX_STATUS_TARGET_OPERATION_ID: &str = "inbox:get-inbox-status";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ApiRequest {
    pub method: String,
    pub path: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InboxCommandKind {
    Setup,
    Status,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InboxRuntimeFlags {
    pub auth: BTreeMap<String, String>,
    pub time: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum InboxOutputMode {
    SetupText,
    SetupJson,
    StatusText { domain: Option<String> },
    StatusJson { domain: Option<String> },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InboxCommandPlan {
    pub target_operation_id: &'static str,
    pub request: ApiRequest,
    pub output_mode: InboxOutputMode,
    pub runtime: InboxRuntimeFlags,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct InboxStatus {
    pub ready: bool,
    pub receiving_ready: bool,
    pub processing_ready: bool,
    pub summary: String,
    pub next_actions: Vec<InboxStatusNextAction>,
    pub domains: Vec<InboxStatusDomain>,
    pub endpoints: InboxStatusEndpointSummary,
    pub functions: InboxStatusFunctionSummary,
    pub recent_emails: InboxStatusRecentEmailSummary,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct InboxStatusNextAction {
    pub kind: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct InboxStatusDomain {
    pub id: String,
    pub domain: String,
    pub verified: bool,
    pub active: bool,
    pub managed: bool,
    pub receiving_ready: bool,
    pub processing_ready: bool,
    pub processing_route_count: u64,
    pub endpoint_count: u64,
    pub enabled_endpoint_count: u64,
    pub function_endpoint_count: u64,
    pub email_count: u64,
    pub latest_email_received_at: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct InboxStatusEndpointSummary {
    pub total: u64,
    pub enabled: u64,
    pub disabled: u64,
    pub fallback_enabled: u64,
    pub domain_scoped_enabled: u64,
    pub http_enabled: u64,
    pub function_enabled: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct InboxStatusFunctionSummary {
    pub total: u64,
    pub deployed: u64,
    pub pending: u64,
    pub failed: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct InboxStatusRecentEmailSummary {
    pub total: u64,
    pub latest_received_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InboxSetupCommandSet {
    pub scaffold: Vec<String>,
    pub logs: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InboxSetupProof {
    pub after_test: Vec<String>,
    pub logs_command: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InboxSetupReadiness {
    pub ready: bool,
    pub receiving_ready: bool,
    pub processing_ready: bool,
    pub mode: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InboxSetupReceive {
    pub address: Option<String>,
    pub domain: Option<String>,
    pub managed: bool,
    pub placeholder_local_part: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InboxSetupProcessing {
    pub stored_only: bool,
    pub active: bool,
    pub enabled_endpoints: u64,
    pub deployed_functions: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct InboxSetupGuide {
    pub readiness: InboxSetupReadiness,
    pub receive: InboxSetupReceive,
    pub processing: InboxSetupProcessing,
    pub commands: InboxSetupCommandSet,
    pub proof: InboxSetupProof,
    pub status: InboxStatus,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help();
        return Ok(());
    }
    if args
        .iter()
        .skip(1)
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
    {
        if !print_command_help(&args[0]) {
            print_help();
        }
        return Ok(());
    }

    let start = Instant::now();
    let plan = build_inbox_command_plan(args)?;
    let auth = config::resolve_auth(&plan.runtime.auth)?;
    let envelope = execute_inbox_request(&plan.request, &auth)?;
    println!("{}", render_inbox_output(&plan, &envelope)?);
    if plan.runtime.time {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

pub fn inbox_command_target(command: &str) -> Option<&'static str> {
    match normalize_command(command).as_deref() {
        Some("inbox:setup" | "inbox:status" | "inbox:get-inbox-status") => {
            Some(INBOX_STATUS_TARGET_OPERATION_ID)
        }
        _ => None,
    }
}

pub fn is_inbox_friendly_command(command: &str) -> bool {
    matches!(
        normalize_command(command).as_deref(),
        Some("inbox:setup" | "inbox:status" | "inbox:get-inbox-status")
    )
}

pub fn build_inbox_command_plan(args: &[String]) -> Result<InboxCommandPlan> {
    let (subcommand, rest) = args
        .split_first()
        .ok_or_else(|| anyhow!("inbox commands require `setup` or `status`"))?;
    match subcommand.as_str() {
        "setup" => build_setup_command_plan_from_args(rest),
        "status" | "get-inbox-status" => build_status_command_plan_from_args(rest),
        other => Err(crate::usage_err!("Unknown inbox command `{other}`")),
    }
}

pub fn build_setup_command_plan_from_args(args: &[String]) -> Result<InboxCommandPlan> {
    let parsed = parse_args(args, &["api-key", "api-base-url"], &["json", "time"], &[])?;
    reject_positionals(&parsed)?;
    Ok(InboxCommandPlan {
        target_operation_id: INBOX_STATUS_TARGET_OPERATION_ID,
        request: inbox_status_request(),
        output_mode: if parsed.bool_flags.get("json") == Some(&true) {
            InboxOutputMode::SetupJson
        } else {
            InboxOutputMode::SetupText
        },
        runtime: runtime_flags(&parsed),
    })
}

pub fn build_status_command_plan_from_args(args: &[String]) -> Result<InboxCommandPlan> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url", "domain"],
        &["json", "time"],
        &[],
    )?;
    reject_positionals(&parsed)?;
    let domain = flag_one(&parsed, "domain");
    Ok(InboxCommandPlan {
        target_operation_id: INBOX_STATUS_TARGET_OPERATION_ID,
        request: inbox_status_request(),
        output_mode: if parsed.bool_flags.get("json") == Some(&true) {
            InboxOutputMode::StatusJson { domain }
        } else {
            InboxOutputMode::StatusText { domain }
        },
        runtime: runtime_flags(&parsed),
    })
}

pub fn inbox_status_request() -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/inbox/status".to_string(),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn render_inbox_output(plan: &InboxCommandPlan, envelope: &Value) -> Result<String> {
    let status = inbox_status_from_envelope(envelope)?;
    match &plan.output_mode {
        InboxOutputMode::SetupText => {
            Ok(format_inbox_setup_guide(&build_inbox_setup_guide(&status)))
        }
        InboxOutputMode::SetupJson => {
            let guide = build_inbox_setup_guide(&status);
            render_json_data(envelope, serde_json::to_value(guide)?)
        }
        InboxOutputMode::StatusText { domain } => {
            let status = output_status(status, domain.as_deref())?;
            Ok(format_inbox_status(&status))
        }
        InboxOutputMode::StatusJson { domain } => {
            let status = output_status(status, domain.as_deref())?;
            render_json_data(envelope, serde_json::to_value(status)?)
        }
    }
}

pub fn inbox_status_from_envelope(envelope: &Value) -> Result<InboxStatus> {
    let data = envelope
        .get("data")
        .ok_or_else(|| anyhow!("Primitive API returned no inbox status."))?;
    serde_json::from_value(data.clone()).context("Primitive API returned malformed inbox status")
}

pub fn status_text(status: &str) -> String {
    match status {
        "ready" => "ready".to_string(),
        "stored_only" => "stored-only".to_string(),
        "pending_dns" => "pending-dns".to_string(),
        "inactive" => "inactive".to_string(),
        other => other.to_string(),
    }
}

pub fn yes_no(value: bool) -> &'static str {
    if value {
        "yes"
    } else {
        "no"
    }
}

pub fn format_inbox_date(value: Option<&str>) -> String {
    let Some(value) = value.filter(|value| !value.is_empty()) else {
        return "never".to_string();
    };
    let Ok(parsed) = DateTime::parse_from_rfc3339(value) else {
        return value.to_string();
    };
    parsed
        .with_timezone(&Utc)
        .format("%Y-%m-%d %H:%M:%S UTC")
        .to_string()
}

pub fn truncate(value: &str, width: usize) -> String {
    if value.len() <= width {
        return format!("{value:<width$}");
    }
    if width <= 3 {
        return ".".repeat(width);
    }
    format!("{}...", &value[..width - 3])
}

pub fn plural(count: u64, singular: &str, plural_value: Option<&str>) -> String {
    let unit = if count == 1 {
        singular.to_string()
    } else {
        plural_value
            .map(str::to_string)
            .unwrap_or_else(|| format!("{singular}s"))
    };
    format!("{count} {unit}")
}

pub fn domain_summary(domain: &InboxStatusDomain) -> String {
    match domain.status.as_str() {
        "ready" => format!(
            "{} can receive mail and has {}.",
            domain.domain,
            plural(
                domain.processing_route_count,
                "processing route",
                Some("processing routes")
            )
        ),
        "stored_only" => format!(
            "{} can receive and store mail, but has no enabled processing route.",
            domain.domain
        ),
        "pending_dns" => format!(
            "{} is waiting on DNS verification before it can receive mail.",
            domain.domain
        ),
        "inactive" => format!("{} is verified but inactive.", domain.domain),
        other => format!("{} has status {other}.", domain.domain),
    }
}

pub fn find_suggested_primitive_address(domains: &[InboxStatusDomain]) -> Option<(String, String)> {
    let domain = domains
        .iter()
        .find(|entry| entry.managed && entry.active && entry.receiving_ready)?;
    Some((
        format!("{DEFAULT_PRIMITIVE_LOCAL_PART}@{}", domain.domain),
        domain.domain.clone(),
    ))
}

pub fn focus_inbox_status(status: &InboxStatus, domain_name: &str) -> Result<InboxStatus> {
    let normalized = domain_name.to_lowercase();
    let domain = status
        .domains
        .iter()
        .find(|entry| entry.domain.to_lowercase() == normalized)
        .ok_or_else(|| anyhow!("Domain {domain_name} was not found."))?;

    Ok(InboxStatus {
        domains: vec![domain.clone()],
        ready: domain.receiving_ready && domain.processing_ready,
        receiving_ready: domain.receiving_ready,
        processing_ready: domain.processing_ready,
        summary: domain_summary(domain),
        recent_emails: InboxStatusRecentEmailSummary {
            total: domain.email_count,
            latest_received_at: domain.latest_email_received_at.clone(),
        },
        next_actions: status.next_actions.clone(),
        endpoints: status.endpoints.clone(),
        functions: status.functions.clone(),
    })
}

pub fn format_domain_header() -> String {
    [
        format!("{:<DOMAIN_DISPLAY_WIDTH$}", "DOMAIN"),
        format!("{:<STATUS_DISPLAY_WIDTH$}", "STATUS"),
        format!("{:<BOOL_DISPLAY_WIDTH$}", "RECEIVE"),
        format!("{:<BOOL_DISPLAY_WIDTH$}", "PROCESS"),
        format!("{:>NUM_DISPLAY_WIDTH$}", "EMAILS"),
        format!("{:>NUM_DISPLAY_WIDTH$}", "ROUTES"),
    ]
    .join("  ")
}

pub fn format_domain_row(domain: &InboxStatusDomain) -> String {
    [
        truncate(&domain.domain, DOMAIN_DISPLAY_WIDTH),
        format!("{:<STATUS_DISPLAY_WIDTH$}", status_text(&domain.status)),
        format!("{:<BOOL_DISPLAY_WIDTH$}", yes_no(domain.receiving_ready)),
        format!("{:<BOOL_DISPLAY_WIDTH$}", yes_no(domain.processing_ready)),
        format!("{:>NUM_DISPLAY_WIDTH$}", domain.email_count),
        format!("{:>NUM_DISPLAY_WIDTH$}", domain.processing_route_count),
    ]
    .join("  ")
}

pub fn format_next_action(action: &InboxStatusNextAction) -> String {
    match &action.command {
        Some(command) => format!("- {}\n  {command}", action.message),
        None => format!("- {}", action.message),
    }
}

pub fn format_inbox_status(status: &InboxStatus) -> String {
    let mut lines = vec![status.summary.clone(), String::new(), "Domains".to_string()];
    let suggested_address = find_suggested_primitive_address(&status.domains);

    if status.domains.is_empty() {
        lines.push("No domains configured.".to_string());
    } else {
        lines.push(format_domain_header());
        lines.extend(status.domains.iter().map(format_domain_row));
    }

    lines.extend([
        String::new(),
        format!(
            "Endpoints: {}/{} enabled ({} fallback, {} domain-scoped, {} function)",
            status.endpoints.enabled,
            status.endpoints.total,
            status.endpoints.fallback_enabled,
            status.endpoints.domain_scoped_enabled,
            status.endpoints.function_enabled
        ),
        format!(
            "Functions: {}/{} deployed ({} pending, {} failed)",
            status.functions.deployed,
            status.functions.total,
            status.functions.pending,
            status.functions.failed
        ),
        format!(
            "Recent inbound: {} latest {}",
            plural(status.recent_emails.total, "email", Some("emails")),
            format_inbox_date(status.recent_emails.latest_received_at.as_deref())
        ),
    ]);

    if let Some((address, domain)) = suggested_address {
        lines.extend([
            String::new(),
            format!("Primitive address: {address}"),
            format!("  Any local-part at {domain} can receive mail."),
            format!("  Try: primitive send --to {address} --subject \"hello\" --body \"test\""),
        ]);
    }

    if !status.next_actions.is_empty() {
        lines.extend([String::new(), "Next actions".to_string()]);
        lines.extend(status.next_actions.iter().map(format_next_action));
    }

    lines.join("\n")
}

pub fn build_inbox_setup_commands(function_name: Option<&str>) -> InboxSetupCommandSet {
    let function_name = function_name.unwrap_or(DEFAULT_SETUP_FUNCTION_NAME);
    InboxSetupCommandSet {
        scaffold: vec![
            format!("primitive functions init {function_name}"),
            format!("cd {function_name}"),
            "npm install".to_string(),
            "npm run build".to_string(),
            format!(
                "primitive functions deploy --name {function_name} --file ./dist/handler.js --wait"
            ),
            format!("primitive functions test --id {FUNCTION_ID_PLACEHOLDER} --wait --show-sends"),
        ],
        logs: format!("primitive functions logs --id {FUNCTION_ID_PLACEHOLDER}"),
        status: "primitive inbox status".to_string(),
    }
}

pub fn build_inbox_setup_proof(commands: &InboxSetupCommandSet) -> InboxSetupProof {
    InboxSetupProof {
        after_test: vec![
            "inbound id for the generated test email".to_string(),
            "function id matching the deployed Function".to_string(),
            "invocation status completed, failed, or send_failed".to_string(),
            "reply/send result emitted by the handler".to_string(),
        ],
        logs_command: commands.logs.clone(),
    }
}

pub fn build_inbox_setup_guide(status: &InboxStatus) -> InboxSetupGuide {
    let domain = first_usable_managed_domain(status);
    let commands = build_inbox_setup_commands(None);
    let mode = if !status.receiving_ready {
        "not_receiving"
    } else if status.processing_ready {
        "actively_processed"
    } else {
        "stored_only"
    };

    InboxSetupGuide {
        readiness: InboxSetupReadiness {
            ready: status.ready,
            receiving_ready: status.receiving_ready,
            processing_ready: status.processing_ready,
            mode: mode.to_string(),
            summary: status.summary.clone(),
        },
        receive: InboxSetupReceive {
            address: domain.map(|domain| format!("{DEFAULT_SETUP_LOCAL_PART}@{}", domain.domain)),
            domain: domain.map(|domain| domain.domain.clone()),
            managed: domain.is_some_and(|domain| domain.managed),
            placeholder_local_part: domain.map(|_| DEFAULT_SETUP_LOCAL_PART.to_string()),
        },
        processing: InboxSetupProcessing {
            stored_only: status.receiving_ready && !status.processing_ready,
            active: status.processing_ready,
            enabled_endpoints: status.endpoints.enabled,
            deployed_functions: status.functions.deployed,
        },
        proof: build_inbox_setup_proof(&commands),
        commands,
        status: status.clone(),
    }
}

pub fn format_inbox_setup_guide(guide: &InboxSetupGuide) -> String {
    let mut lines = vec![
        "Inbound setup".to_string(),
        String::new(),
        guide.readiness.summary.clone(),
        String::new(),
        format_setup_readiness(guide),
        String::new(),
        format_receive_address(guide),
        String::new(),
        "Domains".to_string(),
    ];
    lines.extend(format_setup_domain_details(&guide.status));
    lines.extend([
        String::new(),
        format!(
            "Processing routes: {} enabled endpoint(s), {} deployed Function(s)",
            guide.processing.enabled_endpoints, guide.processing.deployed_functions
        ),
    ]);

    match guide.readiness.mode.as_str() {
        "not_receiving" => lines.extend([
            String::new(),
            "Next actions".to_string(),
            "Make a receiving-ready domain available, then re-run:".to_string(),
            format!("  {}", guide.commands.status),
        ]),
        "stored_only" => {
            lines.extend([
                String::new(),
                "Next actions".to_string(),
                "No processing route is enabled. Scaffold, deploy, and test an email Function:"
                    .to_string(),
            ]);
            lines.extend(
                guide
                    .commands
                    .scaffold
                    .iter()
                    .map(|command| format!("  {command}")),
            );
        }
        _ => lines.extend([
            String::new(),
            "Next actions".to_string(),
            "Inbound mail has an active processing route. Run a Function test when you know the Function id:"
                .to_string(),
            format!("  primitive functions test --id {FUNCTION_ID_PLACEHOLDER} --wait --show-sends"),
        ]),
    }

    if !guide.status.next_actions.is_empty() {
        lines.extend([String::new(), "API suggested actions".to_string()]);
        lines.extend(guide.status.next_actions.iter().map(format_next_action));
    }

    lines.extend([
        String::new(),
        "Proof after functions test".to_string(),
        "- Inbound id: the generated test email should have an inbound id.".to_string(),
        "- Function id: the run should point at the Function id you deployed.".to_string(),
        "- Invocation status: expect completed; failed or send_failed identifies the failing stage."
            .to_string(),
        "- Reply/send result: --show-sends should show the handler's outbound result when it replies or sends."
            .to_string(),
        "- Logs:".to_string(),
        format!("  {}", guide.proof.logs_command),
    ]);

    lines.join("\n")
}

fn normalize_command(command: &str) -> Option<String> {
    let normalized = command.split_whitespace().collect::<Vec<_>>().join(":");
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn output_status(status: InboxStatus, domain: Option<&str>) -> Result<InboxStatus> {
    match domain {
        Some(domain) => focus_inbox_status(&status, domain),
        None => Ok(status),
    }
}

fn render_json_data(envelope: &Value, data: Value) -> Result<String> {
    let mut output = envelope.clone();
    match &mut output {
        Value::Object(object) => {
            object.insert("data".to_string(), data);
        }
        _ => {
            output = serde_json::json!({ "data": data });
        }
    }
    serde_json::to_string_pretty(&output).map_err(Into::into)
}

fn runtime_flags(parsed: &ParsedArgs) -> InboxRuntimeFlags {
    let mut auth = BTreeMap::new();
    for name in ["api-base-url", "api-key"] {
        if let Some(value) = flag_one(parsed, name) {
            auth.insert(name.to_string(), value);
        }
    }
    InboxRuntimeFlags {
        auth,
        time: parsed.bool_flags.get("time") == Some(&true),
    }
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
        if !arg.starts_with('-') || arg == "-" {
            parsed.positionals.push(arg.clone());
            index += 1;
            continue;
        }

        if let Some(raw) = arg.strip_prefix("--") {
            if let Some(name) = raw.strip_prefix("no-") {
                if !bool_flags.contains(name) {
                    return Err(crate::usage_err!("Unknown boolean flag --no-{name}"));
                }
                parsed.bool_flags.insert(name.to_string(), false);
                index += 1;
                continue;
            }

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
                    .ok_or_else(|| crate::usage_err!("Missing value for --{name}"))?;
                if value.starts_with("--") {
                    return Err(crate::usage_err!("Missing value for --{name}"));
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

        return Err(crate::usage_err!("Unknown short flag {arg}"));
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

fn execute_inbox_request(request: &ApiRequest, auth: &config::ResolvedAuth) -> Result<Value> {
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

fn print_help() {
    let bin = crate::display_bin_name();
    println!("inbox commands: setup, status");
    println!("  {bin} inbox setup [--json]");
    println!("  {bin} inbox status [--domain <domain>] [--json]");
}

pub fn print_command_help(command: &str) -> bool {
    match command {
        "setup" | "inbox:setup" => {
            print!("{}", inbox_setup_help_text());
            true
        }
        "status" | "get-inbox-status" | "inbox:status" | "inbox:get-inbox-status" => {
            print!("{}", inbox_status_help_text("status"));
            true
        }
        _ => false,
    }
}

pub fn inbox_setup_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Guide inbound email setup

USAGE
  {bin} inbox setup [--api-key <value>] [--json] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --json             Print structured readiness, receive address, commands, proof metadata, and raw status as JSON.
      --time             Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} inbox setup
  {bin} inbox setup --json
"#
    )
}

pub fn inbox_status_help_text(command: &str) -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Show inbound email readiness

USAGE
  {bin} inbox {command} [--api-key <value>] [--domain <value>] [--json] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --domain <value>   Focus domain readiness and recent email fields on one domain returned by the inbox status API.
      --json             Print the raw response envelope as JSON.
      --time             Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} inbox status
  {bin} inbox status --domain example.com
  {bin} inbox status --json
"#
    )
}

fn first_usable_managed_domain(status: &InboxStatus) -> Option<&InboxStatusDomain> {
    status
        .domains
        .iter()
        .find(|domain| domain.managed && domain.receiving_ready && domain.active)
        .or_else(|| {
            status
                .domains
                .iter()
                .find(|domain| domain.managed && domain.receiving_ready)
        })
}

fn format_setup_readiness(guide: &InboxSetupGuide) -> String {
    let readiness = if guide.readiness.ready {
        "ready"
    } else {
        "not ready"
    };
    let mode = match guide.readiness.mode.as_str() {
        "actively_processed" => "actively processed",
        "stored_only" => "stored-only",
        _ => "not receiving",
    };

    [
        format!("Readiness: {readiness}"),
        format!("Receiving: {}", yes_no(guide.readiness.receiving_ready)),
        format!("Processing: {}", yes_no(guide.readiness.processing_ready)),
        format!("Mode: {mode}"),
    ]
    .join("\n")
}

fn format_receive_address(guide: &InboxSetupGuide) -> String {
    match (&guide.receive.domain, &guide.receive.address) {
        (Some(domain), Some(address)) => {
            format!("Receive address: {address}\nReceive domain: {domain} (Primitive-managed)")
        }
        _ => {
            "Receive address: none found on a receiving-ready Primitive-managed domain".to_string()
        }
    }
}

fn format_setup_domain_details(status: &InboxStatus) -> Vec<String> {
    if status.domains.is_empty() {
        return vec!["Domains: none configured".to_string()];
    }
    status
        .domains
        .iter()
        .map(|domain| {
            format!(
                "- {}: {}, receive {}, process {}, routes {}",
                domain.domain,
                status_text(&domain.status),
                yes_no(domain.receiving_ready),
                yes_no(domain.processing_ready),
                domain.processing_route_count
            )
        })
        .collect()
}
