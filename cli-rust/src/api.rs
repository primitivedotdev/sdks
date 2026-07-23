use crate::client;
use crate::config;
use crate::manifest::{self, flag_name, OperationManifest, ParameterManifest};
use anyhow::{anyhow, Result};
use chrono::{DateTime, SecondsFormat, Utc};
use serde_json::{json, Map, Number, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::error::Error;
use std::fs;
use std::time::{Duration, Instant, SystemTime};

#[derive(Debug, Default)]
pub struct Invocation {
    pub flags: BTreeMap<String, String>,
    pub bool_flags: BTreeMap<String, bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FlagKind {
    Bool { allow_no: bool },
    Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FlagSpec {
    canonical: String,
    kind: FlagKind,
}

pub const UNAUTHORIZED_ERROR_HINT: &str = "Hint: run `primitive signin`, pass --api-key explicitly, or set PRIMITIVE_API_KEY in your environment. `primitive whoami` is the fastest way to verify auth is live.";
pub const INCOMPLETE_DOMAIN_VERIFICATION_HINT: &str = "Domain verification is incomplete. Add or fix the DNS records shown above, or run `primitive domains zone-file --id <domain-id>` to download the complete zone file, then retry `primitive domains verify --id <domain-id>`.";
pub const GENERIC_NETWORK_ERROR_HINT: &str = "Hint: the request could not reach Primitive. Check network egress, DNS, firewall, and proxy settings. `primitive doctor` reports the local environment in one shot.";
const API_KEY_FLAG_DESCRIPTION: &str =
    "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)";
const ENVELOPE_FLAG_DESCRIPTION: &str = "Print the full response envelope, including pagination metadata such as meta.cursor. Defaults to printing only the data payload for backward compatibility.";
const JSON_FLAG_DESCRIPTION: &str =
    "Accepted for consistency with task-focused commands. Generated API commands already print JSON by default.";
const TIME_FLAG_DESCRIPTION: &str = "Print the wall-clock duration of this command to stderr after it completes (e.g. `[time: 1.34s]`). Useful for measuring `--wait` send latency, comparing CLI overhead, or capturing timing in scripts.";
const RAW_BODY_FLAG_DESCRIPTION: &str = "Full request body as raw JSON. Escape hatch for nested or complex fields (e.g. arrays); prefer per-field flags (e.g. --to, --from, --body-text) when available.";
const BODY_FILE_FLAG_DESCRIPTION: &str =
    "Path to a JSON file used as the request body. Same role as --raw-body for callers passing a saved payload.";
const OUTPUT_FLAG_DESCRIPTION: &str = "Write binary response bytes to a file";

const NETWORK_UNREACHABLE_HINT: &str = "Hint: the network is unreachable. Check egress rules, firewall policy, and proxy configuration. `primitive doctor` reports the local environment in one shot.";
const NETWORK_REFUSED_HINT: &str = "Hint: the server refused the connection. Check that your firewall allows egress to *.primitive.dev and that PRIMITIVE_API_BASE_URL overrides point at a reachable host. `primitive doctor` reports the local environment in one shot.";
const NETWORK_TIMEOUT_HINT: &str = "Hint: the connection timed out. Check egress rules and proxy configuration. `primitive doctor` reports the local environment in one shot.";
const NETWORK_DNS_HINT: &str = "Hint: DNS lookup failed. Check resolver configuration and try `curl -v https://api.primitive.dev/v1/account` to confirm the host resolves. `primitive doctor` reports the local environment in one shot.";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FunctionEndpointMatch {
    pub endpoint_id: String,
    pub function_id: String,
}

pub fn parse_invocation(args: &[String]) -> Result<Invocation> {
    let mut invocation = Invocation::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with("--") {
            return Err(crate::usage_error(format!("Unexpected argument: {arg}")));
        }
        if let Some(name) = arg.strip_prefix("--no-") {
            invocation.bool_flags.insert(name.to_string(), false);
            index += 1;
            continue;
        }
        let raw = arg.trim_start_matches("--");
        if let Some((name, value)) = raw.split_once('=') {
            invocation.flags.insert(name.to_string(), value.to_string());
            index += 1;
            continue;
        }
        let name = raw.to_string();
        if matches!(name.as_str(), "json" | "envelope" | "time") {
            invocation.bool_flags.insert(name, true);
            index += 1;
            continue;
        }
        if index + 1 < args.len() && !args[index + 1].starts_with("--") {
            invocation.flags.insert(name, args[index + 1].clone());
            index += 2;
        } else {
            invocation.bool_flags.insert(name, true);
            index += 1;
        }
    }
    Ok(invocation)
}

pub fn execute_operation(operation: &OperationManifest, args: &[String]) -> Result<i32> {
    if is_help_request(args) {
        print!("{}", operation_help_text(operation));
        return Ok(0);
    }
    let invocation = parse_operation_invocation(operation, args)?;
    let start = Instant::now();
    let auth = config::resolve_auth(&invocation.flags)?;
    let body = build_body(operation, &invocation)?;
    let url = build_url(operation, &auth.api_base_url, &invocation)?;
    let header_values = collect_header_values(operation, &invocation)?;
    let client = client::http_client()?;
    let method = operation.method.parse()?;
    let mut request = client.request(method, url);
    let has_body = body.is_some();
    request = client::apply_headers(
        request,
        &auth,
        manifest::operation_requires_auth(operation),
        &header_values,
        has_body,
    )?;
    if let Some(body) = &body {
        request = request.json(body);
    }

    let response = request.send();
    let response = match response {
        Ok(response) => response,
        Err(error) => {
            let code = network_error_code(&error);
            let hint_key = format!("{code} {error}");
            eprintln!(
                "{}",
                json!({
                    "code": code,
                    "message": error.to_string(),
                })
            );
            eprintln!(
                "{}",
                network_error_hint_for_text(&hint_key).unwrap_or(GENERIC_NETWORK_ERROR_HINT)
            );
            return Ok(1);
        }
    };

    let (status, bytes, json) = if operation.binary_response {
        client::parse_response(response)?
    } else {
        client::parse_response_with_declared_json_error(response)?
    };
    if status >= 400 {
        let error_code = extract_error_code(json.as_ref()).map(str::to_string);
        eprintln!(
            "{}",
            client::error_for_status(status, json.as_ref(), &bytes)
        );
        if let Some(hint) = error_hint_for_payload(Some(status), json.as_ref()) {
            eprintln!("{hint}");
        }
        if extract_error_code(json.as_ref()) == Some("unauthorized")
            && auth.source == config::AuthSource::Stored
        {
            eprintln!("{}", config::SAVED_CLI_OAUTH_SESSION_REJECTED_MESSAGE);
        }
        if let Some(redirect) = maybe_fetch_function_endpoint_redirect(
            operation,
            &invocation,
            &auth,
            &client,
            error_code.as_deref(),
        ) {
            eprintln!("{redirect}");
        }
        return Ok(1);
    }

    if operation.binary_response {
        if let Some(output) = invocation.flags.get("output") {
            fs::write(output, bytes)?;
        } else {
            use std::io::Write;
            std::io::stdout().write_all(&bytes)?;
        }
        print_time(&invocation, start);
        return Ok(0);
    }

    let envelope = json.unwrap_or(Value::Null);
    if let Some(cursor) = envelope
        .get("meta")
        .and_then(|meta| meta.get("cursor"))
        .and_then(Value::as_str)
    {
        eprintln!("next cursor: {cursor}");
    }

    let data = envelope.get("data").cloned().unwrap_or(Value::Null);
    if data.as_array().is_some_and(Vec::is_empty) {
        if let Some(hint) = empty_result_hint(&operation.sdk_name) {
            eprintln!("{hint}");
        }
    }
    write_idempotent_replay_banner(&data);

    if operation.sdk_name == "verifyAgentSignup" {
        maybe_save_signup_credentials(&data, &auth)?;
    }

    let incomplete_domain_verification = is_incomplete_domain_verification(operation, &envelope);
    let output = if invocation.bool_flags.get("envelope") == Some(&true) {
        envelope
    } else {
        data
    };
    println!("{}", serde_json::to_string_pretty(&output)?);
    let exit_code = if incomplete_domain_verification {
        eprintln!("{INCOMPLETE_DOMAIN_VERIFICATION_HINT}");
        1
    } else {
        0
    };
    print_time(&invocation, start);
    Ok(exit_code)
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
}

fn parse_operation_invocation(
    operation: &OperationManifest,
    args: &[String],
) -> Result<Invocation> {
    parse_invocation_with_allowed_flags(args, &operation_flag_kinds(operation))
}

fn parse_invocation_with_allowed_flags(
    args: &[String],
    allowed: &BTreeMap<String, FlagSpec>,
) -> Result<Invocation> {
    let mut invocation = Invocation::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with("--") || arg == "--" {
            return Err(crate::usage_error(format!("Unexpected argument: {arg}")));
        }
        if let Some(name) = arg.strip_prefix("--no-") {
            match allowed.get(name) {
                Some(FlagSpec {
                    canonical,
                    kind: FlagKind::Bool { allow_no: true },
                }) => {
                    insert_bool_flag(&mut invocation, canonical, false)?;
                    index += 1;
                    continue;
                }
                Some(_) | None => {
                    return Err(crate::usage_error(format!("Nonexistent flag: --no-{name}")));
                }
            }
        }

        let raw = arg.trim_start_matches("--");
        if let Some((name, value)) = raw.split_once('=') {
            match allowed.get(name) {
                Some(FlagSpec {
                    canonical,
                    kind: FlagKind::Value,
                }) => {
                    insert_value_flag(&mut invocation, canonical, value.to_string())?;
                }
                Some(FlagSpec {
                    canonical,
                    kind: FlagKind::Bool { .. },
                }) => {
                    insert_bool_flag(&mut invocation, canonical, true)?;
                    return Err(crate::usage_error(format!("Unexpected argument: {value}")));
                }
                None => return Err(crate::usage_error(format!("Nonexistent flag: --{name}"))),
            }
            index += 1;
            continue;
        }

        let name = raw.to_string();
        match allowed.get(name.as_str()) {
            Some(FlagSpec {
                canonical,
                kind: FlagKind::Bool { .. },
            }) => {
                insert_bool_flag(&mut invocation, canonical, true)?;
                index += 1;
            }
            Some(FlagSpec {
                canonical,
                kind: FlagKind::Value,
            }) => {
                if index + 1 >= args.len() || args[index + 1].starts_with("--") {
                    return Err(crate::usage_error(format!("Flag --{name} expects a value")));
                }
                insert_value_flag(&mut invocation, canonical, args[index + 1].clone())?;
                index += 2;
            }
            None => return Err(crate::usage_error(format!("Nonexistent flag: --{name}"))),
        }
    }
    Ok(invocation)
}

fn insert_value_flag(invocation: &mut Invocation, canonical: &str, value: String) -> Result<()> {
    reject_duplicate_flag(invocation, canonical)?;
    invocation.flags.insert(canonical.to_string(), value);
    Ok(())
}

fn insert_bool_flag(invocation: &mut Invocation, canonical: &str, value: bool) -> Result<()> {
    if invocation.flags.contains_key(canonical) {
        return Err(crate::usage_error(format!(
            "Flag --{canonical} can only be specified once"
        )));
    }
    invocation.bool_flags.insert(canonical.to_string(), value);
    Ok(())
}

fn reject_duplicate_flag(invocation: &Invocation, canonical: &str) -> Result<()> {
    if invocation.flags.contains_key(canonical) || invocation.bool_flags.contains_key(canonical) {
        return Err(crate::usage_error(format!(
            "Flag --{canonical} can only be specified once"
        )));
    }
    Ok(())
}

fn operation_flag_kinds(operation: &OperationManifest) -> BTreeMap<String, FlagSpec> {
    let mut flags = BTreeMap::new();
    insert_flag_spec(&mut flags, "api-key", "api-key", FlagKind::Value);
    insert_flag_spec(&mut flags, "api-base-url", "api-base-url", FlagKind::Value);
    insert_flag_spec(
        &mut flags,
        "time",
        "time",
        FlagKind::Bool { allow_no: false },
    );

    if operation.binary_response {
        insert_flag_spec(&mut flags, "output", "output", FlagKind::Value);
    } else {
        insert_flag_spec(
            &mut flags,
            "json",
            "json",
            FlagKind::Bool { allow_no: false },
        );
        insert_flag_spec(
            &mut flags,
            "envelope",
            "envelope",
            FlagKind::Bool { allow_no: false },
        );
    }

    for parameter in operation
        .path_params
        .iter()
        .chain(operation.query_params.iter())
        .chain(operation.header_params.iter())
    {
        let kind = if parameter.type_name == "boolean" {
            FlagKind::Bool { allow_no: false }
        } else {
            FlagKind::Value
        };
        let name = flag_name(&parameter.name);
        insert_flag_spec(&mut flags, &name, &name, kind);
    }

    if operation.has_json_body {
        insert_flag_spec(&mut flags, "raw-body", "raw-body", FlagKind::Value);
        insert_flag_spec(&mut flags, "body-file", "body-file", FlagKind::Value);
        for (property, schema) in request_body_properties(operation) {
            let canonical = flag_name(&property);
            let kind = if body_scalar_type(schema).as_deref() == Some("boolean") {
                FlagKind::Bool { allow_no: true }
            } else {
                FlagKind::Value
            };
            insert_flag_spec(&mut flags, &canonical, &canonical, kind);
            for alias in body_flag_aliases(&operation.sdk_name, &property) {
                insert_flag_spec(&mut flags, &alias, &canonical, kind);
            }
        }
    }

    flags
}

fn insert_flag_spec(
    flags: &mut BTreeMap<String, FlagSpec>,
    name: &str,
    canonical: &str,
    kind: FlagKind,
) {
    flags.insert(
        name.to_string(),
        FlagSpec {
            canonical: canonical.to_string(),
            kind,
        },
    );
}

pub fn operation_help_text(operation: &OperationManifest) -> String {
    operation_help_text_for_command(operation, &manifest::operation_id(operation))
}

pub fn operation_help_text_for_command(operation: &OperationManifest, command: &str) -> String {
    let command = command.split(':').collect::<Vec<_>>().join(" ");
    let description = operation_description(operation);
    let mut lines = Vec::new();
    lines.push(
        operation
            .summary
            .as_deref()
            .unwrap_or_else(|| {
                operation
                    .description
                    .as_deref()
                    .unwrap_or("Primitive API operation")
            })
            .to_string(),
    );
    lines.push(String::new());
    lines.push("USAGE".to_string());
    lines.push(format!(
        "  $ {} {command}{}",
        crate::display_bin_name(),
        operation_usage_suffix(operation)
    ));
    lines.push(String::new());
    lines.push("FLAGS".to_string());
    for flag in operation_help_flags(operation) {
        lines.push(flag.render());
    }
    lines.push(String::new());
    lines.push("DESCRIPTION".to_string());
    for line in description.lines() {
        if line.is_empty() {
            lines.push(String::new());
        } else {
            lines.push(format!("  {line}"));
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum HelpFlagValue {
    Bool,
    BoolAllowNo,
    Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HelpFlag {
    default_value: Option<String>,
    description: String,
    enum_values: Vec<String>,
    name: String,
    required: bool,
    value: HelpFlagValue,
}

impl HelpFlag {
    fn usage_token(&self) -> String {
        let token = match self.value {
            HelpFlagValue::Bool | HelpFlagValue::BoolAllowNo => format!("--{}", self.name),
            HelpFlagValue::Value => format!("--{} {}", self.name, self.usage_value_label()),
        };
        if self.required {
            token
        } else {
            format!("[{token}]")
        }
    }

    fn render(&self) -> String {
        let declaration = match self.value {
            HelpFlagValue::Bool => format!("--{}", self.name),
            HelpFlagValue::BoolAllowNo => format!("--[no-]{}", self.name),
            HelpFlagValue::Value => format!("--{}={}", self.name, self.declaration_value_label()),
        };
        let required = if self.required { "(required) " } else { "" };
        let default = self
            .default_value
            .as_ref()
            .map(|value| format!("[default: {value}] "))
            .unwrap_or_default();
        let options = if self.enum_values.is_empty() {
            String::new()
        } else {
            format!(" <options: {}>", self.enum_values.join("|"))
        };
        let description = format!("{required}{default}{}{options}", self.description);
        let mut description_lines = description.lines();
        let first_description = description_lines.next().unwrap_or("");
        let first = if self.name == "api-key" {
            format!("  {declaration}  [env: PRIMITIVE_API_KEY] {first_description}")
        } else {
            format!("  {declaration}  {first_description}")
        };
        let continuation_indent = format!("  {}", " ".repeat(declaration.len() + 2));
        let rest = description_lines
            .map(|line| format!("{continuation_indent}{line}"))
            .collect::<Vec<_>>();
        if rest.is_empty() {
            return first;
        }
        format!("{first}\n{}", rest.join("\n"))
    }

    fn usage_value_label(&self) -> String {
        if self.enum_values.is_empty() {
            "<value>".to_string()
        } else {
            self.enum_values.join("|")
        }
    }

    fn declaration_value_label(&self) -> &'static str {
        if self.enum_values.is_empty() {
            "<value>"
        } else {
            "<option>"
        }
    }
}

fn operation_usage_suffix(operation: &OperationManifest) -> String {
    let flags = operation_usage_flags(operation);
    if flags.is_empty() {
        return String::new();
    }
    let required = flags
        .iter()
        .filter(|flag| flag.required)
        .map(HelpFlag::usage_token);
    let optional = flags
        .iter()
        .filter(|flag| !flag.required)
        .map(HelpFlag::usage_token);
    format!(
        " {}",
        required.chain(optional).collect::<Vec<_>>().join(" ")
    )
}

fn operation_usage_flags(operation: &OperationManifest) -> Vec<HelpFlag> {
    let mut flags = Vec::new();
    flags.push(HelpFlag {
        default_value: None,
        description: API_KEY_FLAG_DESCRIPTION.to_string(),
        enum_values: Vec::new(),
        name: "api-key".to_string(),
        required: false,
        value: HelpFlagValue::Value,
    });
    flags.push(HelpFlag {
        default_value: None,
        description: TIME_FLAG_DESCRIPTION.to_string(),
        enum_values: Vec::new(),
        name: "time".to_string(),
        required: false,
        value: HelpFlagValue::Bool,
    });
    if !operation.binary_response {
        flags.push(HelpFlag {
            default_value: None,
            description: JSON_FLAG_DESCRIPTION.to_string(),
            enum_values: Vec::new(),
            name: "json".to_string(),
            required: false,
            value: HelpFlagValue::Bool,
        });
        flags.push(HelpFlag {
            default_value: None,
            description: ENVELOPE_FLAG_DESCRIPTION.to_string(),
            enum_values: Vec::new(),
            name: "envelope".to_string(),
            required: false,
            value: HelpFlagValue::Bool,
        });
    }

    for parameter in operation
        .path_params
        .iter()
        .chain(operation.query_params.iter())
        .chain(operation.header_params.iter())
    {
        flags.push(HelpFlag {
            default_value: numeric_help_default(
                &parameter.type_name,
                parameter.default_value.as_ref(),
            ),
            description: parameter
                .description
                .clone()
                .unwrap_or_else(|| parameter.name.clone()),
            enum_values: parameter.enum_values.clone().unwrap_or_default(),
            name: flag_name(&parameter.name),
            required: parameter.required,
            value: if parameter.type_name == "boolean" {
                HelpFlagValue::Bool
            } else {
                HelpFlagValue::Value
            },
        });
    }

    if operation.has_json_body {
        flags.push(HelpFlag {
            default_value: None,
            description: RAW_BODY_FLAG_DESCRIPTION.to_string(),
            enum_values: Vec::new(),
            name: "raw-body".to_string(),
            required: false,
            value: HelpFlagValue::Value,
        });
        flags.push(HelpFlag {
            default_value: None,
            description: BODY_FILE_FLAG_DESCRIPTION.to_string(),
            enum_values: Vec::new(),
            name: "body-file".to_string(),
            required: false,
            value: HelpFlagValue::Value,
        });
        for field in request_body_fields(operation) {
            if field.kind == BodyFieldKind::Complex {
                continue;
            }
            flags.push(HelpFlag {
                default_value: field.default_value,
                description: if field.description.is_empty() {
                    field.name.clone()
                } else {
                    field.description
                },
                enum_values: field.enum_values,
                name: flag_name(&field.name),
                required: false,
                value: if field.kind == BodyFieldKind::Boolean {
                    HelpFlagValue::BoolAllowNo
                } else {
                    HelpFlagValue::Value
                },
            });
        }
    }

    if operation.binary_response {
        flags.push(HelpFlag {
            default_value: None,
            description: OUTPUT_FLAG_DESCRIPTION.to_string(),
            enum_values: Vec::new(),
            name: "output".to_string(),
            required: false,
            value: HelpFlagValue::Value,
        });
    }

    flags
}

fn operation_help_flags(operation: &OperationManifest) -> Vec<HelpFlag> {
    let mut flags = operation_usage_flags(operation);
    flags.sort_by(|left, right| left.name.cmp(&right.name));
    flags
}

fn operation_description(operation: &OperationManifest) -> String {
    let summary = operation.summary.as_deref().unwrap_or_else(|| {
        operation
            .description
            .as_deref()
            .unwrap_or("Primitive API operation")
    });
    let base = operation
        .description
        .as_deref()
        .map(canonicalize_cli_references)
        .unwrap_or_else(|| format!("{} {}", operation.method, operation.path));
    let schema_summary = operation
        .has_json_body
        .then(|| request_schema_summary(operation))
        .flatten();
    let hint = operation_hint(&operation.sdk_name);
    let mut description = summary.to_string();
    if !base.trim().is_empty() && base.trim() != summary.trim() {
        description.push_str("\n\n");
        description.push_str(&base);
    }
    if let Some(summary) = schema_summary {
        description.push_str("\n\n");
        description.push_str(&summary);
    }
    if let Some(hint) = hint {
        description.push_str("\n\n");
        description.push_str(hint);
    }
    description
}

fn request_body_properties(operation: &OperationManifest) -> Vec<(String, &Value)> {
    request_body_fields(operation)
        .into_iter()
        .filter(|field| field.kind != BodyFieldKind::Complex)
        .filter_map(|field| {
            operation
                .request_schema
                .as_ref()
                .and_then(|schema| schema.get("properties"))
                .and_then(Value::as_object)
                .and_then(|properties| properties.get(&field.name))
                .map(|schema| (field.name, schema))
        })
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BodyFieldKind {
    Boolean,
    Complex,
    Integer,
    Number,
    String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BodyField {
    default_value: Option<String>,
    description: String,
    display_type: String,
    enum_values: Vec<String>,
    kind: BodyFieldKind,
    name: String,
    required: bool,
}

fn request_body_fields(operation: &OperationManifest) -> Vec<BodyField> {
    let Some(properties) = operation
        .request_schema
        .as_ref()
        .and_then(|schema| schema.get("properties"))
        .and_then(Value::as_object)
    else {
        return Vec::new();
    };
    let mut occupied = BTreeSet::new();
    for parameter in operation
        .path_params
        .iter()
        .chain(operation.query_params.iter())
        .chain(operation.header_params.iter())
    {
        occupied.insert(flag_name(&parameter.name));
    }
    for reserved in [
        "api-key",
        "api-base-url",
        "raw-body",
        "body-file",
        "envelope",
        "output",
    ] {
        occupied.insert(reserved.to_string());
    }
    let required = operation
        .request_schema
        .as_ref()
        .and_then(|schema| schema.get("required"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .collect::<BTreeSet<_>>()
        })
        .unwrap_or_default();

    let mut fields = properties
        .iter()
        .filter_map(|(property, schema)| {
            let descriptor =
                body_field_descriptor(property, schema, required.contains(property.as_str()))?;
            (!occupied.contains(&flag_name(property))).then_some(descriptor)
        })
        .collect::<Vec<_>>();
    fields.sort_by(|left, right| {
        if left.required != right.required {
            return right.required.cmp(&left.required);
        }
        left.name.cmp(&right.name)
    });
    fields
}

fn body_field_descriptor(property: &str, schema: &Value, required: bool) -> Option<BodyField> {
    let (display_type, kind) = body_field_type(schema);
    Some(BodyField {
        default_value: body_numeric_help_default(kind, schema.get("default")),
        description: schema
            .get("description")
            .and_then(Value::as_str)
            .map(first_description_paragraph)
            .unwrap_or_default(),
        display_type,
        enum_values: schema
            .get("enum")
            .and_then(Value::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
        kind,
        name: property.to_string(),
        required,
    })
}

fn numeric_help_default(type_name: &str, value: Option<&Value>) -> Option<String> {
    if !matches!(type_name, "integer" | "number") {
        return None;
    }
    value
        .and_then(|value| value.as_number())
        .map(ToString::to_string)
}

fn body_numeric_help_default(kind: BodyFieldKind, value: Option<&Value>) -> Option<String> {
    if !matches!(kind, BodyFieldKind::Integer | BodyFieldKind::Number) {
        return None;
    }
    value
        .and_then(|value| value.as_number())
        .map(ToString::to_string)
}

fn body_field_type(schema: &Value) -> (String, BodyFieldKind) {
    match schema.get("type") {
        Some(Value::String(value)) => match value.as_str() {
            "string" => ("string".to_string(), BodyFieldKind::String),
            "integer" => ("integer".to_string(), BodyFieldKind::Integer),
            "number" => ("number".to_string(), BodyFieldKind::Number),
            "boolean" => ("boolean".to_string(), BodyFieldKind::Boolean),
            "array" => {
                let display_type = schema
                    .get("items")
                    .and_then(|items| items.get("type"))
                    .and_then(Value::as_str)
                    .map(|item_type| format!("array<{item_type}>"))
                    .unwrap_or_else(|| "array".to_string());
                (display_type, BodyFieldKind::Complex)
            }
            other => (other.to_string(), BodyFieldKind::Complex),
        },
        Some(Value::Array(values)) => {
            let non_null = values
                .iter()
                .filter_map(Value::as_str)
                .filter(|value| *value != "null")
                .collect::<Vec<_>>();
            if non_null.len() == 1 {
                let display_type = format!("{}?", non_null[0]);
                let kind = match non_null[0] {
                    "string" => BodyFieldKind::String,
                    "integer" => BodyFieldKind::Integer,
                    "number" => BodyFieldKind::Number,
                    "boolean" => BodyFieldKind::Boolean,
                    _ => BodyFieldKind::Complex,
                };
                (display_type, kind)
            } else {
                (non_null.join("|"), BodyFieldKind::Complex)
            }
        }
        _ => ("any".to_string(), BodyFieldKind::Complex),
    }
}

fn first_description_paragraph(description: &str) -> String {
    description
        .split("\n\n")
        .next()
        .unwrap_or("")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn request_schema_summary(operation: &OperationManifest) -> Option<String> {
    let complex = request_body_fields(operation)
        .into_iter()
        .filter(|field| field.kind == BodyFieldKind::Complex)
        .collect::<Vec<_>>();
    if complex.is_empty() {
        return None;
    }
    let name_width = complex
        .iter()
        .map(|field| field.name.len())
        .max()
        .unwrap_or(0)
        .min(24);
    let mut lines =
        vec!["Body fields requiring --raw-body JSON (these are not exposed as flags):".to_string()];
    for field in complex {
        let marker = if field.required { " *" } else { "  " };
        let mut name = field.name;
        if name.len() < name_width {
            name.push_str(&" ".repeat(name_width - name.len()));
        }
        let description = if field.description.chars().count() > 78 {
            format!(
                "{}...",
                field.description.chars().take(75).collect::<String>()
            )
        } else {
            field.description
        };
        let suffix = if description.is_empty() {
            String::new()
        } else {
            format!("  {description}")
        };
        lines.push(format!("{marker} {name}  {}{suffix}", field.display_type));
    }
    lines.push(
        "(* = required. Scalar body fields are exposed as individual --flag-name flags; see FLAGS above.)"
            .to_string(),
    );
    Some(lines.join("\n"))
}

fn canonicalize_cli_references(description: &str) -> String {
    description
        .replace("`primitive emails:latest`", "`primitive emails latest`")
        .replace(
            "`primitive describe emails:get-email | jq '.responseSchema.properties'`",
            "`primitive describe emails:get | jq '.responseSchema.properties'`",
        )
}

fn operation_hint(sdk_name: &str) -> Option<&'static str> {
    match sdk_name {
        "addDomain" => Some("Tip: after this returns a domain id, run `primitive domains zone-file --id <domain-id> --output <domain>.zone` when the user wants an importable DNS zone file."),
        "verifyDomain" => Some("Tip: if DNS is still missing, run `primitive domains zone-file --id <domain-id> --output <domain>.zone` to give the user an importable DNS zone file."),
        "downloadDomainZoneFile" => Some("Tip: prefer `primitive domains zone-file --id <domain-id> --output <domain>.zone` for CLI-friendly file output."),
        "getInboxStatus" => Some("Tip: prefer `primitive inbox status` for a compact readiness summary and next-step commands."),
        "getSendPermissions" => Some("Tip: this command answers where you may send mail to. To find usable sender domains for --from, run `primitive domains list` or `primitive inbox status` and use an address at an active verified domain."),
        "sendEmail" => Some("Tip: prefer `primitive send --to <address> --body <text> --attachment <file>` for file attachments. This raw command exists for callers passing JSON."),
        "createFunction" => Some("Tip: prefer `primitive functions deploy --name <name> --file <bundle>` for file-input ergonomics. This raw command exists for callers passing JSON."),
        "updateFunction" => Some("Tip: prefer `primitive functions redeploy --id <id> --file <bundle>` for file-input ergonomics. This raw command exists for callers passing JSON."),
        "createFunctionSecret" => Some("Tip: prefer `primitive functions set-secret --id <id> --key <KEY> --value <value> [--redeploy]` for secret writes that also push the binding live. This raw command exists for callers passing JSON."),
        "setFunctionSecret" => Some("Tip: prefer `primitive functions set-secret --id <id> --key <KEY> --value <value> [--redeploy]` for secret writes that also push the binding live. This raw command exists for callers passing JSON."),
        "setMemory" => Some("Tip: prefer `primitive memories set <key> <json-value> [--function <function-id>]` for JSON value parsing and scope flags. This raw command exists for callers passing full request JSON."),
        "getMemory" => Some("Tip: prefer `primitive memories get <key> [--function <function-id>]` for the common read path."),
        "deleteMemory" => Some("Tip: prefer `primitive memories delete <key> [--function <function-id>]` for the common delete path."),
        "searchMemories" => Some("Tip: prefer `primitive memories search [prefix] [--metadata-only] [--function <function-id>]` for the common search path."),
        "startAgentSignup" => Some("Tip: pass --terms-accepted, and optionally --signup-code <code> if you have one. Capture the signup_token from the response and feed it to `primitive agent verify-agent-signup --signup-token <token> --verification-code <6-digit-code>` (the verify flag accepts --code as an alias). The high-level `primitive signup <email>` command walks an interactive user through both steps with friendlier prompts."),
        "verifyAgentSignup" => Some("Tip: pass --verification-code <code> (or --code; both work). The response carries OAuth tokens but not your assigned inbox domain; run `primitive domains list` (or `primitive whoami`) after success to see the managed *.primitive.email address that routes to this account."),
        _ => None,
    }
}

fn print_time(invocation: &Invocation, start: Instant) {
    if invocation.bool_flags.get("time") == Some(&true) {
        let elapsed = start.elapsed();
        let seconds = elapsed.as_secs_f64();
        eprintln!("[time: {seconds:.2}s]");
    }
}

fn network_error_code(error: &reqwest::Error) -> String {
    error
        .source()
        .map(|source| source.to_string())
        .unwrap_or_else(|| "network_error".to_string())
}

pub fn extract_error_code(payload: Option<&Value>) -> Option<&str> {
    let payload = payload?;
    if let Some(code) = payload
        .get("error")
        .and_then(|error| error.get("code"))
        .and_then(Value::as_str)
    {
        return Some(code);
    }
    payload.get("code").and_then(Value::as_str)
}

pub fn error_hint_for_code(code: &str) -> Option<&'static str> {
    if code == "unauthorized" {
        return Some(UNAUTHORIZED_ERROR_HINT);
    }
    None
}

pub fn error_hint_for_payload(
    status: Option<u16>,
    payload: Option<&Value>,
) -> Option<&'static str> {
    if let Some(code) = extract_error_code(payload) {
        if let Some(hint) = error_hint_for_code(code) {
            return Some(hint);
        }
    }
    if status == Some(401) {
        return Some(UNAUTHORIZED_ERROR_HINT);
    }
    None
}

pub fn network_error_hint_for_text(text: &str) -> Option<&'static str> {
    let normalized = text.to_ascii_lowercase();
    if normalized.contains("enetunreach") || normalized.contains("network is unreachable") {
        return Some(NETWORK_UNREACHABLE_HINT);
    }
    if normalized.contains("econnrefused") || normalized.contains("connection refused") {
        return Some(NETWORK_REFUSED_HINT);
    }
    if normalized.contains("etimedout")
        || normalized.contains("timed out")
        || normalized.contains("timeout")
    {
        return Some(NETWORK_TIMEOUT_HINT);
    }
    if normalized.contains("eai_again")
        || normalized.contains("dns")
        || normalized.contains("failed to lookup address information")
    {
        return Some(NETWORK_DNS_HINT);
    }
    None
}

pub fn is_incomplete_domain_verification(operation: &OperationManifest, envelope: &Value) -> bool {
    operation.sdk_name == "verifyDomain"
        && envelope
            .get("data")
            .and_then(|data| data.get("verified"))
            .and_then(Value::as_bool)
            == Some(false)
}

pub fn detect_function_endpoint(
    endpoint_id: &str,
    endpoints_response: &Value,
) -> Option<FunctionEndpointMatch> {
    for row in endpoint_rows(endpoints_response)? {
        let Some(row) = row.as_object() else {
            continue;
        };
        if row.get("id").and_then(Value::as_str) != Some(endpoint_id) {
            continue;
        }
        if row.get("kind").and_then(Value::as_str) != Some("function") {
            return None;
        }
        let function_id = row.get("function_id").and_then(Value::as_str)?;
        if function_id.is_empty() {
            return None;
        }
        return Some(FunctionEndpointMatch {
            endpoint_id: endpoint_id.to_string(),
            function_id: function_id.to_string(),
        });
    }
    None
}

fn endpoint_rows(endpoints_response: &Value) -> Option<&Vec<Value>> {
    endpoints_response
        .as_array()
        .or_else(|| endpoints_response.get("data").and_then(Value::as_array))
        .or_else(|| {
            endpoints_response
                .get("data")
                .and_then(|data| data.get("data"))
                .and_then(Value::as_array)
        })
}

pub fn format_function_endpoint_redirect(match_: &FunctionEndpointMatch) -> String {
    [
        "This is a function endpoint. Function endpoints are tested differently. Run:".to_string(),
        String::new(),
        format!("    primitive functions test --id {}", match_.function_id),
        String::new(),
        format!(
            "(pass the function id, not the endpoint id. endpoint_id={} function_id={})",
            match_.endpoint_id, match_.function_id
        ),
    ]
    .join("\n")
}

pub fn function_endpoint_redirect_message(
    sdk_name: &str,
    error_code: Option<&str>,
    endpoint_id: Option<&str>,
    endpoints_response: &Value,
) -> Option<String> {
    if sdk_name != "testEndpoint" {
        return None;
    }
    if error_code != Some("not_found") {
        return None;
    }
    let endpoint_id = endpoint_id?;
    let match_ = detect_function_endpoint(endpoint_id, endpoints_response)?;
    Some(format_function_endpoint_redirect(&match_))
}

fn maybe_fetch_function_endpoint_redirect(
    operation: &OperationManifest,
    invocation: &Invocation,
    auth: &config::ResolvedAuth,
    http: &reqwest::blocking::Client,
    error_code: Option<&str>,
) -> Option<String> {
    if operation.sdk_name != "testEndpoint" || error_code != Some("not_found") {
        return None;
    }
    let endpoint_id = invocation.flags.get("id")?;
    let endpoints_response = fetch_list_endpoints_response(auth, http)?;
    function_endpoint_redirect_message(
        &operation.sdk_name,
        error_code,
        Some(endpoint_id),
        &endpoints_response,
    )
}

fn fetch_list_endpoints_response(
    auth: &config::ResolvedAuth,
    http: &reqwest::blocking::Client,
) -> Option<Value> {
    let operation = manifest::lookup_operation("endpoints:list-endpoints")?;
    let invocation = Invocation::default();
    let url = build_url(operation, &auth.api_base_url, &invocation).ok()?;
    let method: reqwest::Method = operation.method.parse().ok()?;
    let request = http.request(method, url);
    let request = client::apply_headers(
        request,
        auth,
        manifest::operation_requires_auth(operation),
        &[],
        false,
    )
    .ok()?;
    let response = request.send().ok()?;
    let (status, bytes, json) = client::parse_response(response).ok()?;
    if status >= 400 || bytes.is_empty() {
        return None;
    }
    json
}

fn collect_header_values(
    operation: &OperationManifest,
    invocation: &Invocation,
) -> Result<Vec<(String, String)>> {
    operation
        .header_params
        .iter()
        .filter_map(|parameter| match parameter_value(parameter, invocation) {
            Ok(Some(value)) => Some(Ok((parameter.name.clone(), value))),
            Ok(None) => None,
            Err(error) => Some(Err(error)),
        })
        .collect()
}

fn build_url(
    operation: &OperationManifest,
    base_url: &str,
    invocation: &Invocation,
) -> Result<String> {
    let mut path = operation.path.clone();
    for parameter in &operation.path_params {
        let value = parameter_value(parameter, invocation)?.ok_or_else(|| {
            crate::usage_error(format!("Missing required --{}", flag_name(&parameter.name)))
        })?;
        path = path.replace(
            &format!("{{{}}}", parameter.name),
            &urlencoding::encode(&value),
        );
    }
    let mut url = format!("{}{}", base_url.trim_end_matches('/'), path);
    let mut query = Vec::new();
    for parameter in &operation.query_params {
        if let Some(value) = parameter_value(parameter, invocation)? {
            query.push(format!(
                "{}={}",
                urlencoding::encode(&parameter.name),
                urlencoding::encode(&value)
            ));
        }
    }
    if !query.is_empty() {
        url.push('?');
        url.push_str(&query.join("&"));
    }
    Ok(url)
}

fn parameter_value(
    parameter: &ParameterManifest,
    invocation: &Invocation,
) -> Result<Option<String>> {
    let name = flag_name(&parameter.name);
    if let Some(value) = invocation.flags.get(&name) {
        return Ok(Some(coerce_parameter_value(parameter, value)?));
    }
    if let Some(value) = invocation.bool_flags.get(&name) {
        return Ok(Some(coerce_parameter_value(parameter, &value.to_string())?));
    }
    if let Some(default_value) = default_parameter_value(parameter) {
        return Ok(Some(default_value_to_string(default_value)?));
    }
    if parameter.required {
        return Err(crate::usage_error(format!("Missing required --{name}")));
    }
    Ok(None)
}

fn coerce_parameter_value(parameter: &ParameterManifest, value: &str) -> Result<String> {
    if let Some(values) = &parameter.enum_values {
        if !values.iter().any(|item| item == value) {
            return Err(crate::usage_error(format!(
                "Expected --{} to be one of: {}",
                flag_name(&parameter.name),
                values.join(", ")
            )));
        }
    }
    match parameter.type_name.as_str() {
        "integer" => {
            let parsed: i64 = value.parse().map_err(|_| {
                crate::usage_error(format!(
                    "Expected an integer for --{}",
                    flag_name(&parameter.name)
                ))
            })?;
            check_numeric_bounds(parameter, parsed as f64)?;
            Ok(parsed.to_string())
        }
        "number" => {
            let trimmed = value.trim();
            let parsed: f64 = trimmed.parse().map_err(|_| {
                crate::usage_error(format!(
                    "Expected a number for --{}",
                    flag_name(&parameter.name)
                ))
            })?;
            if !parsed.is_finite() {
                return Err(crate::usage_error(format!(
                    "Expected a finite number for --{}",
                    flag_name(&parameter.name)
                )));
            }
            check_numeric_bounds(parameter, parsed)?;
            Ok(number_to_cli_string(parsed)?)
        }
        "boolean" => {
            let parsed: bool = value.parse().map_err(|_| {
                crate::usage_error(format!(
                    "Expected a boolean for --{}",
                    flag_name(&parameter.name)
                ))
            })?;
            Ok(parsed.to_string())
        }
        _ => Ok(value.to_string()),
    }
}

fn check_numeric_bounds(parameter: &ParameterManifest, value: f64) -> Result<()> {
    if let Some(minimum) = &parameter.minimum {
        if minimum.as_f64().is_some_and(|min| value < min) {
            return Err(crate::usage_error(format!(
                "Expected --{} to be greater than or equal to {minimum}",
                flag_name(&parameter.name)
            )));
        }
    }
    if let Some(maximum) = &parameter.maximum {
        if maximum.as_f64().is_some_and(|max| value > max) {
            return Err(crate::usage_error(format!(
                "Expected --{} to be less than or equal to {maximum}",
                flag_name(&parameter.name)
            )));
        }
    }
    Ok(())
}

fn default_parameter_value(parameter: &ParameterManifest) -> Option<&Value> {
    if matches!(parameter.type_name.as_str(), "integer" | "number") {
        parameter.default_value.as_ref()
    } else {
        None
    }
}

fn default_value_to_string(value: &Value) -> Result<String> {
    match value {
        Value::Bool(value) => Ok(value.to_string()),
        Value::Number(value) => Ok(value.to_string()),
        Value::String(value) => Ok(value.clone()),
        _ => Err(anyhow!("Unsupported default value in operation manifest")),
    }
}

fn number_to_cli_string(value: f64) -> Result<String> {
    let number = Number::from_f64(value).ok_or_else(|| anyhow!("Invalid number"))?;
    Ok(number.to_string())
}

fn build_body(operation: &OperationManifest, invocation: &Invocation) -> Result<Option<Value>> {
    if !operation.has_json_body {
        return Ok(None);
    }

    let mut explicit = read_json_body(invocation)?;
    let overrides = collect_body_field_flags(operation, invocation)?;

    if !overrides.is_empty() {
        match explicit.take() {
            None => explicit = Some(Value::Object(overrides)),
            Some(Value::Object(mut object)) => {
                object.extend(overrides);
                explicit = Some(Value::Object(object));
            }
            Some(other) => {
                let override_flags = overrides
                    .keys()
                    .map(|property| format!("--{}", flag_name(property)))
                    .collect::<Vec<_>>()
                    .join(", ");
                return Err(crate::usage_error(format!(
                    "--raw-body must be a JSON object when also passing per-field flags (got {}); supplied per-field flags: {}. Either drop --raw-body and rely on the per-field flags, or move every field into the JSON --raw-body and drop the flags.",
                    json_type(&other),
                    override_flags
                )));
            }
        }
    }

    if operation.body_required && explicit.is_none() {
        return Err(crate::usage_error(format!(
            "Operation {} requires a body. Pass each field as a --flag or supply JSON via --raw-body / --body-file.",
            operation.operation_id
        )));
    }

    Ok(explicit)
}

fn read_json_body(invocation: &Invocation) -> Result<Option<Value>> {
    let raw_body = invocation.flags.get("raw-body");
    let body_file = invocation.flags.get("body-file");
    if raw_body.is_some() && body_file.is_some() {
        return Err(anyhow!("Use either --raw-body or --body-file, not both"));
    }
    if let Some(raw_body) = raw_body {
        return serde_json::from_str(raw_body)
            .map(Some)
            .map_err(|error| anyhow!("--raw-body is not valid JSON: {error}"));
    }
    if let Some(body_file) = body_file {
        let contents = fs::read_to_string(body_file)
            .map_err(|error| anyhow!("Could not read --body-file {body_file}: {error}"))?;
        return serde_json::from_str(&contents)
            .map(Some)
            .map_err(|error| anyhow!("--body-file is not valid JSON: {error}"));
    }
    Ok(None)
}

fn collect_body_field_flags(
    operation: &OperationManifest,
    invocation: &Invocation,
) -> Result<Map<String, Value>> {
    let mut result = Map::new();
    let Some(properties) = operation
        .request_schema
        .as_ref()
        .and_then(|schema| schema.get("properties"))
        .and_then(Value::as_object)
    else {
        return Ok(result);
    };

    let mut occupied = BTreeSet::new();
    for parameter in operation
        .path_params
        .iter()
        .chain(operation.query_params.iter())
        .chain(operation.header_params.iter())
    {
        occupied.insert(flag_name(&parameter.name));
    }
    for reserved in [
        "api-key",
        "api-base-url",
        "raw-body",
        "body-file",
        "envelope",
        "output",
    ] {
        occupied.insert(reserved.to_string());
    }

    for (property, schema) in properties {
        let flag = flag_name(property);
        if occupied.contains(&flag) {
            continue;
        }
        if body_scalar_type(schema).is_none() {
            continue;
        }
        let aliases = body_flag_aliases(&operation.sdk_name, property);
        let value = invocation
            .flags
            .get(&flag)
            .map(|value| (value.as_str(), false))
            .or_else(|| {
                aliases.iter().find_map(|alias| {
                    invocation
                        .flags
                        .get(alias)
                        .map(|value| (value.as_str(), false))
                })
            });
        let bool_value = invocation.bool_flags.get(&flag).copied().or_else(|| {
            aliases
                .iter()
                .find_map(|alias| invocation.bool_flags.get(alias).copied())
        });

        if let Some((value, _)) = value {
            result.insert(
                property.clone(),
                coerce_body_flag_value(property, schema, value)?,
            );
        } else if let Some(value) = bool_value {
            result.insert(property.clone(), Value::Bool(value));
        }
    }
    Ok(result)
}

fn body_flag_aliases(operation_sdk_name: &str, property: &str) -> Vec<String> {
    match (operation_sdk_name, property) {
        ("verifyAgentSignup", "verification_code") => vec!["code".to_string()],
        _ => Vec::new(),
    }
}

fn coerce_body_flag_value(property: &str, schema: &Value, value: &str) -> Result<Value> {
    if let Some(values) = schema.get("enum").and_then(Value::as_array) {
        let allowed: Vec<&str> = values.iter().filter_map(Value::as_str).collect();
        if !allowed.is_empty() && !allowed.contains(&value) {
            return Err(crate::usage_error(format!(
                "Expected --{} to be one of: {}",
                flag_name(property),
                allowed.join(", ")
            )));
        }
    }
    match body_scalar_type(schema).as_deref() {
        Some("integer") => {
            let parsed: i64 = value.parse().map_err(|_| {
                crate::usage_error(format!("Expected an integer for --{}", flag_name(property)))
            })?;
            check_body_numeric_bounds(property, schema, parsed as f64)?;
            Ok(Value::Number(Number::from(parsed)))
        }
        Some("number") => {
            let parsed: f64 = value.trim().parse().map_err(|_| {
                crate::usage_error(format!("Expected a number for --{}", flag_name(property)))
            })?;
            if !parsed.is_finite() {
                return Err(crate::usage_error(format!(
                    "Expected a finite number for --{}",
                    flag_name(property)
                )));
            }
            check_body_numeric_bounds(property, schema, parsed)?;
            let number = Number::from_f64(parsed).ok_or_else(|| anyhow!("Invalid number"))?;
            Ok(Value::Number(number))
        }
        Some("boolean") => {
            let parsed: bool = value.parse().map_err(|_| {
                crate::usage_error(format!("Expected a boolean for --{}", flag_name(property)))
            })?;
            Ok(Value::Bool(parsed))
        }
        _ => Ok(Value::String(value.to_string())),
    }
}

fn check_body_numeric_bounds(property: &str, schema: &Value, value: f64) -> Result<()> {
    if let Some(minimum) = schema.get("minimum").and_then(Value::as_f64) {
        if value < minimum {
            return Err(crate::usage_error(format!(
                "Expected --{} to be greater than or equal to {minimum}",
                flag_name(property)
            )));
        }
    }
    if let Some(maximum) = schema.get("maximum").and_then(Value::as_f64) {
        if value > maximum {
            return Err(crate::usage_error(format!(
                "Expected --{} to be less than or equal to {maximum}",
                flag_name(property)
            )));
        }
    }
    Ok(())
}

fn body_scalar_type(schema: &Value) -> Option<String> {
    match schema.get("type") {
        Some(Value::String(value))
            if matches!(value.as_str(), "string" | "integer" | "number" | "boolean") =>
        {
            Some(value.clone())
        }
        Some(Value::Array(values)) => {
            let non_null: Vec<&str> = values
                .iter()
                .filter_map(Value::as_str)
                .filter(|value| *value != "null")
                .collect();
            if non_null.len() == 1
                && matches!(non_null[0], "string" | "integer" | "number" | "boolean")
            {
                Some(non_null[0].to_string())
            } else {
                None
            }
        }
        _ => None,
    }
}

fn json_type(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn empty_result_hint(sdk_name: &str) -> Option<&'static str> {
    match sdk_name {
        "listDeliveries" => Some("(no results) No webhook deliveries logged yet. If you have an endpoint configured but expected to see test fires here: test deliveries from `primitive endpoints test` are NOT logged in this list, they're synchronous and visible only in the test-endpoint command's response. Real deliveries are logged when an inbound `email.received` event fans out to your endpoints. If you have no endpoints, run `primitive endpoints list` to check."),
        "listEndpoints" => Some("(no results) No webhook endpoints configured. Add one with `primitive endpoints create --url <your-url>`."),
        "listEmails" => Some("(no results) No inbound emails received yet on this account. Send one to a verified domain to populate this list. For a compact view, prefer `primitive emails latest`."),
        "listDomains" => Some("(no results) No domains on this account. Add one with `primitive domains add --domain <yourdomain.example>`."),
        "listFilters" => Some("(no results) No filter rules configured."),
        "listFunctions" => Some("(no results) No Functions configured yet. Start with `primitive functions templates`, then `primitive functions init --template <template>` and `primitive functions deploy --name <name> --file <bundle>`."),
        _ => None,
    }
}

fn write_idempotent_replay_banner(data: &Value) {
    if data.get("idempotent_replay").and_then(Value::as_bool) != Some(true) {
        return;
    }
    eprintln!("note: idempotent replay. this exact send already happened earlier.");
    eprintln!(
        "      no new MX traffic was generated by this call. nothing new will arrive in any inbox."
    );
    if let Some(id) = data.get("id").and_then(Value::as_str) {
        eprintln!("      cached row id: {id}");
    }
    let status = data.get("status").and_then(Value::as_str);
    let delivery_status = data.get("delivery_status").and_then(Value::as_str);
    if status.is_some() || delivery_status.is_some() {
        let mut parts = Vec::new();
        if let Some(status) = status {
            parts.push(format!("status={status}"));
        }
        if let Some(delivery_status) = delivery_status {
            if Some(delivery_status) != status {
                parts.push(format!("delivery_status={delivery_status}"));
            }
        }
        if !parts.is_empty() {
            eprintln!("      original {}", parts.join(", "));
        }
    }
    eprintln!("      to send a fresh copy: vary any field (subject, body, etc.) or");
    eprintln!("      pass a unique Idempotency-Key on the underlying API call.");
}

fn maybe_save_signup_credentials(data: &Value, auth: &config::ResolvedAuth) -> Result<()> {
    if data.get("access_token").and_then(Value::as_str).is_none()
        || data.get("refresh_token").and_then(Value::as_str).is_none()
    {
        return Ok(());
    }
    let path = auth.config_dir.join("credentials.json");
    let now = SystemTime::now();
    let created_at = system_time_to_utc_millis(now);
    let expires_at = data
        .get("expires_in")
        .and_then(Value::as_u64)
        .map(|expires_in| system_time_to_utc_millis(now + Duration::from_secs(expires_in)))
        .or_else(|| {
            data.get("expires_at")
                .and_then(Value::as_str)
                .map(ToString::to_string)
        })
        .unwrap_or_default();
    let credentials = json!({
        "auth_method": "oauth",
        "access_token": data.get("access_token").and_then(Value::as_str).unwrap_or_default(),
        "refresh_token": data.get("refresh_token").and_then(Value::as_str).unwrap_or_default(),
        "token_type": "Bearer",
        "expires_at": expires_at,
        "oauth_grant_id": data.get("oauth_grant_id").and_then(Value::as_str).unwrap_or_default(),
        "oauth_client_id": data.get("oauth_client_id").and_then(Value::as_str).unwrap_or_default(),
        "org_id": data.get("org_id").and_then(Value::as_str).unwrap_or_default(),
        "org_name": data.get("org_name").cloned().unwrap_or(Value::Null),
        "api_base_url": auth.api_base_url,
        "created_at": created_at,
    });
    config::delete_chat_state_in_dir(&auth.config_dir)?;
    config::write_private_file_atomic(
        &path,
        format!("{}\n", serde_json::to_string_pretty(&credentials)?),
    )?;
    eprintln!(
        "Credentials saved to the CLI config; `primitive whoami` will work on the next call."
    );
    Ok(())
}

fn system_time_to_utc_millis(time: SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339_opts(SecondsFormat::Millis, true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_no_boolean_flag() {
        let args = vec!["--no-enabled".to_string()];
        let invocation = parse_invocation(&args).expect("parse invocation");
        assert_eq!(invocation.bool_flags.get("enabled"), Some(&false));
    }

    #[test]
    fn body_aliases_include_agent_signup_code() {
        assert_eq!(
            body_flag_aliases("verifyAgentSignup", "verification_code"),
            vec!["code".to_string()]
        );
    }

    #[test]
    fn generated_operation_help_lists_request_flags_without_auth() {
        let operation = manifest::lookup_operation("sending:send-email").expect("send operation");
        let help = operation_help_text(operation);

        assert!(help
            .contains("$ primitive-rust sending send-email [--api-key <value>] [--time] [--json]"));
        assert!(help.contains("Sends an outbound email through Primitive's outbound relay"));
        assert!(help.contains("--api-key=<value>"));
        assert!(help.contains("--json"));
        assert!(help.contains("--envelope"));
        assert!(!help.contains("--api-base-url"));
        assert!(help.contains("--idempotency-key=<value>"));
        assert!(help.contains("--body-text=<value>"));
        assert!(help.contains("--[no-]wait"));
        assert!(help.contains("Body fields requiring --raw-body JSON"));
        assert!(help.contains("attachments"));
        assert!(!help.contains("--attachments="));
        assert!(is_help_request(&["--help".to_string()]));
        assert!(!is_help_request(&["help".to_string()]));
        assert!(is_help_request(&[
            "--api-key".to_string(),
            "prim_test".to_string(),
            "--help".to_string(),
        ]));
    }

    #[test]
    fn generated_operation_alias_help_keeps_invoked_command_spelling() {
        let operation = manifest::lookup_operation("sending:send")
            .expect("send alias should resolve to send operation");
        let help = operation_help_text_for_command(operation, "sending:send");

        assert!(help.contains("$ primitive-rust sending send [--api-key <value>]"));
        assert!(!help.contains("sending send-email [--api-key <value>]"));
        assert!(help.contains("Tip: prefer `primitive send --to <address>"));
    }

    #[test]
    fn generated_operation_help_hides_body_aliases_but_parser_accepts_them() {
        let operation = manifest::lookup_operation("agent:verify-agent-signup")
            .expect("verify agent signup operation");
        let help = operation_help_text(operation);

        assert!(help.contains("--verification-code=<value>"));
        assert!(!help.contains("--code=<value>"));

        let invocation = parse_operation_invocation(
            operation,
            &[
                "--signup-token".to_string(),
                "signup_token".to_string(),
                "--code".to_string(),
                "123456".to_string(),
            ],
        )
        .expect("alias should parse");

        assert_eq!(
            collect_body_field_flags(operation, &invocation)
                .expect("request body")
                .get("verification_code")
                .and_then(Value::as_str),
            Some("123456")
        );
    }

    #[test]
    fn generated_operation_parser_rejects_duplicate_value_flags() {
        let operation = manifest::lookup_operation("sending:send-email").expect("send operation");
        let duplicate = parse_operation_invocation(
            operation,
            &[
                "--from".to_string(),
                "from@example.com".to_string(),
                "--to".to_string(),
                "one@example.com".to_string(),
                "--to".to_string(),
                "two@example.com".to_string(),
                "--body-text".to_string(),
                "hello".to_string(),
            ],
        )
        .expect_err("duplicate generated value flag should fail");

        assert_eq!(
            duplicate.to_string(),
            "Flag --to can only be specified once"
        );
    }

    #[test]
    fn generated_operation_parser_rejects_duplicate_aliases() {
        let operation = manifest::lookup_operation("agent:verify-agent-signup")
            .expect("verify agent signup operation");
        let canonical_and_alias = parse_operation_invocation(
            operation,
            &[
                "--signup-token".to_string(),
                "signup_token".to_string(),
                "--verification-code".to_string(),
                "111111".to_string(),
                "--code".to_string(),
                "222222".to_string(),
            ],
        )
        .expect_err("canonical and alias should count as one flag");
        assert_eq!(
            canonical_and_alias.to_string(),
            "Flag --verification-code can only be specified once"
        );

        let repeated_alias = parse_operation_invocation(
            operation,
            &[
                "--signup-token".to_string(),
                "signup_token".to_string(),
                "--code".to_string(),
                "111111".to_string(),
                "--code".to_string(),
                "222222".to_string(),
            ],
        )
        .expect_err("repeated alias should count as one flag");
        assert_eq!(
            repeated_alias.to_string(),
            "Flag --verification-code can only be specified once"
        );
    }

    #[test]
    fn generated_operation_parser_rejects_unknown_and_missing_value_flags() {
        let operation =
            manifest::lookup_operation("emails:search-emails").expect("search emails operation");

        let unknown = parse_operation_invocation(operation, &["--bogus".to_string()])
            .expect_err("unknown generated flag should fail");
        assert!(unknown.to_string().contains("Nonexistent flag"));

        let missing = parse_operation_invocation(operation, &["--q".to_string()])
            .expect_err("missing generated flag value should fail");
        assert!(missing.to_string().contains("expects a value"));

        let hidden_base_url = parse_operation_invocation(
            operation,
            &[
                "--api-base-url".to_string(),
                "https://api.example.test/v1".to_string(),
            ],
        )
        .expect("hidden base URL override should still parse");
        assert_eq!(
            hidden_base_url
                .flags
                .get("api-base-url")
                .map(String::as_str),
            Some("https://api.example.test/v1")
        );
    }

    #[test]
    fn generated_operation_parser_exposes_only_scalar_body_flags() {
        let operation = manifest::lookup_operation("sending:send-email").expect("send operation");

        let complex =
            parse_operation_invocation(operation, &["--attachments".to_string(), "[]".to_string()])
                .expect_err("complex body field should not be a generated flag");
        assert!(complex.to_string().contains("Nonexistent flag"));

        let invocation = parse_operation_invocation(
            operation,
            &[
                "--to".to_string(),
                "alice@example.com".to_string(),
                "--from".to_string(),
                "bot@example.com".to_string(),
                "--body-text".to_string(),
                "hello".to_string(),
                "--no-wait".to_string(),
            ],
        )
        .expect("scalar body flags should parse");
        assert_eq!(invocation.bool_flags.get("wait"), Some(&false));
    }

    #[test]
    fn generated_operation_parser_only_applies_numeric_parameter_defaults() {
        let operation =
            manifest::lookup_operation("emails:search-emails").expect("search emails operation");
        let invocation =
            parse_operation_invocation(operation, &["--q".to_string(), "hello".to_string()])
                .expect("search invocation");
        let url =
            build_url(operation, "https://api.example.test/v1", &invocation).expect("search URL");

        assert!(url.contains("q=hello"), "{url}");
        assert!(url.contains("limit=50"), "{url}");
        assert!(!url.contains("snippet=true"), "{url}");
        assert!(!url.contains("include_facets=true"), "{url}");
    }

    #[test]
    fn generated_operation_parser_rejects_nonfinite_and_out_of_range_numbers() {
        let search =
            manifest::lookup_operation("emails:search-emails").expect("search emails operation");
        let spam_score = search
            .query_params
            .iter()
            .find(|parameter| parameter.name == "spam_score_lt")
            .expect("spam_score_lt parameter");
        let nonfinite = coerce_parameter_value(spam_score, "inf")
            .expect_err("nonfinite query number should fail");
        assert!(nonfinite.to_string().contains("finite number"));

        let send = manifest::lookup_operation("sending:send-email").expect("send operation");
        let wait_timeout_ms = send
            .request_schema
            .as_ref()
            .and_then(|schema| schema.get("properties"))
            .and_then(Value::as_object)
            .and_then(|properties| properties.get("wait_timeout_ms"))
            .expect("wait_timeout_ms schema");
        let below_minimum = coerce_body_flag_value("wait_timeout_ms", wait_timeout_ms, "1")
            .expect_err("body number below minimum should fail");
        assert!(
            below_minimum
                .to_string()
                .contains("greater than or equal to 1000"),
            "{below_minimum}"
        );
    }
}
