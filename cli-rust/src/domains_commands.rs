use crate::client;
use crate::config;
use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{self, Write};
use std::time::Instant;

const LIST_DOMAINS_OPERATION: &str = "domains:list-domains";
const DOWNLOAD_ZONE_FILE_OPERATION: &str = "domains:download-domain-zone-file";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum DomainsCommandKind {
    ZoneFile,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DomainsCommandAlias {
    pub alias: &'static str,
    pub target_operation_id: &'static str,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct DomainsApiRequest {
    pub target_operation_id: &'static str,
    pub method: &'static str,
    pub path: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomainZoneFileCommandPlan {
    pub target_operation_id: &'static str,
    pub selector: DomainZoneFileSelector,
    pub outbound_only: bool,
    pub output: ZoneFileOutputDestination,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DomainZoneFileSelector {
    Id(String),
    Domain(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ZoneFileOutputDestination {
    Stdout,
    File(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DomainSelection {
    pub id: String,
    pub domain: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ZoneFileWriteOutcome {
    Stdout { bytes: usize },
    File { path: String, bytes: usize },
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

pub fn domains_command_aliases() -> &'static [DomainsCommandAlias] {
    &[
        DomainsCommandAlias {
            alias: "domains:zone-file",
            target_operation_id: DOWNLOAD_ZONE_FILE_OPERATION,
        },
        DomainsCommandAlias {
            alias: "domains:download-domain-zone-file",
            target_operation_id: DOWNLOAD_ZONE_FILE_OPERATION,
        },
    ]
}

pub fn domains_command_target(command: &str) -> Option<&'static str> {
    domains_command_kind(command).map(target_operation_id)
}

pub fn is_domains_friendly_command(command: &str) -> bool {
    domains_command_kind(command).is_some()
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help();
        return Ok(());
    }
    let (subcommand, rest) = args
        .split_first()
        .ok_or_else(|| anyhow!("domains commands require a subcommand"))?;
    execute_command(&format!("domains:{subcommand}"), rest)
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
    let plan = build_domains_command_plan(command, args)?;
    let auth = config::resolve_auth(&auth_flags(args)?)?;
    execute_zone_file_command_plan(&plan, &auth)?;

    if has_time_flag(args) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

pub fn build_domains_command_plan(
    command: &str,
    args: &[String],
) -> Result<DomainZoneFileCommandPlan> {
    let kind = domains_command_kind(command)
        .ok_or_else(|| anyhow!("Unknown domains command `{command}`"))?;
    match kind {
        DomainsCommandKind::ZoneFile => parse_zone_file_command_plan(args),
    }
}

pub fn parse_zone_file_command_plan(args: &[String]) -> Result<DomainZoneFileCommandPlan> {
    let parsed = parse_args(
        args,
        &["api-key", "api-base-url", "id", "domain", "output"],
        &["outbound-only", "time"],
        &[("o", "output")],
    )?;
    reject_positionals(&parsed)?;

    let id = present_value(flag_one(&parsed, "id"));
    let domain = present_value(flag_one(&parsed, "domain"));
    let selector = match (id, domain) {
        (Some(id), None) => DomainZoneFileSelector::Id(id),
        (None, Some(domain)) => DomainZoneFileSelector::Domain(domain),
        (Some(_), Some(_)) => return Err(anyhow!("Use only one of --id or --domain.")),
        (None, None) => return Err(anyhow!("Pass --id <domain-id> or --domain <domain>.")),
    };

    Ok(DomainZoneFileCommandPlan {
        target_operation_id: DOWNLOAD_ZONE_FILE_OPERATION,
        selector,
        outbound_only: parsed.bool_flags.get("outbound-only") == Some(&true),
        output: output_destination(flag_one(&parsed, "output")),
    })
}

pub fn initial_zone_file_request(plan: &DomainZoneFileCommandPlan) -> DomainsApiRequest {
    match &plan.selector {
        DomainZoneFileSelector::Id(id) => build_zone_file_download_request(id, plan.outbound_only),
        DomainZoneFileSelector::Domain(_) => build_list_domains_request(),
    }
}

pub fn build_list_domains_request() -> DomainsApiRequest {
    domains_request(
        LIST_DOMAINS_OPERATION,
        "GET",
        "/domains".to_string(),
        BTreeMap::new(),
    )
}

pub fn build_zone_file_download_request(domain_id: &str, outbound_only: bool) -> DomainsApiRequest {
    let mut query = BTreeMap::new();
    if outbound_only {
        query.insert("outbound_only".to_string(), "true".to_string());
    }
    domains_request(
        DOWNLOAD_ZONE_FILE_OPERATION,
        "GET",
        format!("/domains/{}/zone-file", urlencoding::encode(domain_id)),
        query,
    )
}

pub fn select_domain_by_name(domains_response: &Value, domain: &str) -> Result<DomainSelection> {
    let rows = domain_rows(domains_response)?;
    let mut matches = Vec::new();

    for row in rows {
        let Some(row_domain) = row.get("domain").and_then(Value::as_str) else {
            continue;
        };
        if row_domain == domain {
            matches.push(row);
        }
    }

    match matches.as_slice() {
        [] => Err(anyhow!("Domain {domain} was not found.")),
        [row] => {
            let id = row.get("id").and_then(Value::as_str).ok_or_else(|| {
                anyhow!("Domain {domain} did not include an id. Use --id <domain-id> instead.")
            })?;
            let matched_domain = row.get("domain").and_then(Value::as_str).unwrap_or(domain);
            Ok(DomainSelection {
                id: id.to_string(),
                domain: matched_domain.to_string(),
            })
        }
        _ => Err(anyhow!(
            "Domain {domain} matched multiple domains. Use --id <domain-id> instead."
        )),
    }
}

pub fn write_zone_file_output_with<WriteFile, WriteStdout>(
    destination: &ZoneFileOutputDestination,
    bytes: &[u8],
    mut write_file: WriteFile,
    mut write_stdout: WriteStdout,
) -> Result<ZoneFileWriteOutcome>
where
    WriteFile: FnMut(&str, &[u8]) -> Result<()>,
    WriteStdout: FnMut(&[u8]) -> Result<()>,
{
    match destination {
        ZoneFileOutputDestination::File(path) => {
            write_file(path, bytes)?;
            Ok(ZoneFileWriteOutcome::File {
                path: path.clone(),
                bytes: bytes.len(),
            })
        }
        ZoneFileOutputDestination::Stdout => {
            write_stdout(bytes)?;
            Ok(ZoneFileWriteOutcome::Stdout { bytes: bytes.len() })
        }
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

fn execute_zone_file_command_plan(
    plan: &DomainZoneFileCommandPlan,
    auth: &config::ResolvedAuth,
) -> Result<()> {
    let domain_id = match &plan.selector {
        DomainZoneFileSelector::Id(id) => id.clone(),
        DomainZoneFileSelector::Domain(domain) => {
            let domains = execute_json_request(&build_list_domains_request(), auth)?;
            select_domain_by_name(&domains, domain)?.id
        }
    };
    let request = build_zone_file_download_request(&domain_id, plan.outbound_only);
    let bytes = execute_binary_request(&request, auth)?;
    let outcome = write_zone_file_output(&plan.output, &bytes)?;
    if let ZoneFileWriteOutcome::File { path, .. } = outcome {
        eprintln!("Wrote zone file to {path}");
    }
    Ok(())
}

fn domains_command_kind(command: &str) -> Option<DomainsCommandKind> {
    let normalized = command.split_whitespace().collect::<Vec<_>>().join(":");
    let command = normalized
        .strip_prefix("domains:")
        .unwrap_or(normalized.as_str());
    match command {
        "zone-file" | "download-domain-zone-file" => Some(DomainsCommandKind::ZoneFile),
        _ => None,
    }
}

fn target_operation_id(kind: DomainsCommandKind) -> &'static str {
    match kind {
        DomainsCommandKind::ZoneFile => DOWNLOAD_ZONE_FILE_OPERATION,
    }
}

fn domains_request(
    target_operation_id: &'static str,
    method: &'static str,
    path: String,
    query: BTreeMap<String, String>,
) -> DomainsApiRequest {
    DomainsApiRequest {
        target_operation_id,
        method,
        path,
        query,
        body: None,
    }
}

fn execute_json_request(request: &DomainsApiRequest, auth: &config::ResolvedAuth) -> Result<Value> {
    let bytes = execute_request_bytes(request, auth)?;
    serde_json::from_slice(&bytes).context("API response was not valid JSON")
}

fn execute_binary_request(
    request: &DomainsApiRequest,
    auth: &config::ResolvedAuth,
) -> Result<Vec<u8>> {
    execute_request_bytes(request, auth)
}

fn execute_request_bytes(
    request: &DomainsApiRequest,
    auth: &config::ResolvedAuth,
) -> Result<Vec<u8>> {
    let http = client::http_client()?;
    let method: Method = request.method.parse()?;
    let mut builder = http.request(method, build_url(request, &auth.api_base_url));
    builder = client::apply_headers(builder, auth, true, &[], false)?;
    let response = builder.send()?;
    let (status, bytes, json) = client::parse_response(response)?;
    if status >= 400 {
        return Err(client::error_for_status_with_hints(
            status,
            json.as_ref(),
            &bytes,
        ));
    }
    Ok(bytes)
}

fn build_url(request: &DomainsApiRequest, base_url: &str) -> String {
    let mut url = format!("{}{}", base_url.trim_end_matches('/'), request.path);
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
    url
}

fn write_zone_file_output(
    destination: &ZoneFileOutputDestination,
    bytes: &[u8],
) -> Result<ZoneFileWriteOutcome> {
    write_zone_file_output_with(
        destination,
        bytes,
        |path, bytes| fs::write(path, bytes).with_context(|| format!("Could not write {path}")),
        |bytes| {
            let mut stdout = io::stdout();
            stdout
                .write_all(bytes)
                .context("Could not write zone file to stdout")
        },
    )
}

fn domain_rows(domains_response: &Value) -> Result<&Vec<Value>> {
    if let Some(rows) = domains_response.as_array() {
        return Ok(rows);
    }
    domains_response
        .get("data")
        .and_then(Value::as_array)
        .ok_or_else(|| anyhow!("listDomains response did not contain a domain list."))
}

fn output_destination(output: Option<String>) -> ZoneFileOutputDestination {
    match present_value(output) {
        Some(path) => ZoneFileOutputDestination::File(path),
        None => ZoneFileOutputDestination::Stdout,
    }
}

fn parse_args(
    args: &[String],
    value_flags: &[&str],
    bool_flags: &[&str],
    short_value_flags: &[(&str, &str)],
) -> Result<ParsedArgs> {
    let value_flags: BTreeSet<&str> = value_flags.iter().copied().collect();
    let bool_flags: BTreeSet<&str> = bool_flags.iter().copied().collect();
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
                    return Err(anyhow!("Unknown boolean flag --no-{name}"));
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
                return Err(anyhow!("Unknown flag --{name}"));
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
            insert_parsed_value(&mut parsed, name, value)?;
            index += 1;
            continue;
        }

        let raw = arg
            .strip_prefix('-')
            .ok_or_else(|| anyhow!("Unexpected argument: {arg}"))?;
        let (short_name, inline_value) = raw.split_once('=').map_or_else(
            || {
                let Some((candidate, value)) = raw.split_at_checked(1) else {
                    return (raw, None);
                };
                if value.is_empty() || !short_value_flags.contains_key(candidate) {
                    (raw, None)
                } else {
                    (candidate, Some(value.to_string()))
                }
            },
            |(name, value)| (name, Some(value.to_string())),
        );
        let Some(name) = short_value_flags.get(short_name).copied() else {
            return Err(anyhow!("Unknown short flag -{short_name}"));
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
        insert_parsed_value(&mut parsed, name, value)?;
        index += 1;
    }

    Ok(parsed)
}

fn insert_parsed_value(parsed: &mut ParsedArgs, name: &str, value: String) -> Result<()> {
    if parsed.flags.insert(name.to_string(), vec![value]).is_some() {
        return Err(anyhow!("Pass --{name} only once."));
    }
    Ok(())
}

fn reject_positionals(parsed: &ParsedArgs) -> Result<()> {
    if let Some(extra) = parsed.positionals.first() {
        return Err(anyhow!("Unexpected argument: {extra}"));
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

fn present_value(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive Rust CLI domains commands:");
    println!("  {bin} domains list [flags]");
    println!("  {bin} domains add --domain <domain> [flags]");
    println!("  {bin} domains verify --id <domain-id>");
    println!("  {bin} domains update --id <domain-id> [flags]");
    println!("  {bin} domains delete --id <domain-id>");
    println!("  {bin} domains zone-file --id <domain-id> [--output <path>]");
    println!("  {bin} domains zone-file --domain <domain> [--output <path>]");
}

fn print_command_help(command: &str) -> bool {
    match domains_command_kind(command) {
        Some(DomainsCommandKind::ZoneFile) => {
            print!("{}", domains_zone_file_help_text());
            true
        }
        None => false,
    }
}

pub fn domains_zone_file_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Download a DNS zone file for a domain

USAGE
  {bin} domains zone-file [--api-key <value>] [--domain <value>] [--id <value>] [-o <path>] [--outbound-only] [--time]

FLAGS
  -o, --output <path>      Write the zone file to this path instead of stdout.
      --api-key <value>    Primitive API key override.
      --domain <domain>    Domain name to look up before downloading its zone file.
      --id <domain-id>     Domain id returned by `primitive domains add` or `primitive domains list`.
      --outbound-only      Include only outbound DNS records.
      --time               Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} domains zone-file --id <domain-id>
  {bin} domains zone-file --id <domain-id> --output example.com.zone
  {bin} domains zone-file --domain example.com --output example.com.zone
"#
    )
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
}
