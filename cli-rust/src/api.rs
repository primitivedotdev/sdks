use crate::client;
use crate::config;
use crate::manifest::{self, flag_name, OperationManifest, ParameterManifest};
use anyhow::{anyhow, Context, Result};
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

pub const UNAUTHORIZED_ERROR_HINT: &str = "Hint: run `primitive signin`, pass --api-key explicitly, or set PRIMITIVE_API_KEY in your environment. `primitive whoami` is the fastest way to verify auth is live.";
pub const INCOMPLETE_DOMAIN_VERIFICATION_HINT: &str = "Domain verification is incomplete. Add or fix the DNS records shown above, or run `primitive domains zone-file --id <domain-id>` to download the complete zone file, then retry `primitive domains verify --id <domain-id>`.";
pub const GENERIC_NETWORK_ERROR_HINT: &str = "Hint: the request could not reach Primitive. Check network egress, DNS, firewall, and proxy settings. `primitive doctor` reports the local environment in one shot.";

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
            return Err(crate::usage_err!("Unexpected argument: {arg}"));
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
    // Invocation parsing and parameter validation are usage errors (exit 2,
    // like the Node CLI); everything past this point is a runtime failure.
    let invocation = parse_operation_invocation(operation, args).map_err(crate::usage_error)?;
    let start = Instant::now();
    let auth = config::resolve_auth(&invocation.flags)?;
    let body = build_body(operation, &invocation).map_err(crate::usage_error)?;
    let url = build_url(operation, &auth.api_base_url, &invocation).map_err(crate::usage_error)?;
    let header_values =
        collect_header_values(operation, &invocation).map_err(crate::usage_error)?;
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

    let (status, bytes, json) = client::parse_response(response)?;
    if status >= 400 {
        let error_code = extract_error_code(json.as_ref()).map(str::to_string);
        eprintln!(
            "{}",
            client::error_for_status(status, json.as_ref(), &bytes)
        );
        if let Some(hint) = error_hint_for_payload(Some(status), json.as_ref()) {
            eprintln!("{hint}");
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
    allowed: &BTreeMap<String, FlagKind>,
) -> Result<Invocation> {
    let mut invocation = Invocation::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with("--") || arg == "--" {
            return Err(crate::usage_err!("Unexpected argument: {arg}"));
        }
        if let Some(name) = arg.strip_prefix("--no-") {
            match allowed.get(name) {
                Some(FlagKind::Bool { allow_no: true }) => {
                    invocation.bool_flags.insert(name.to_string(), false);
                    index += 1;
                    continue;
                }
                Some(_) | None => return Err(crate::usage_err!("Nonexistent flag: --no-{name}")),
            }
        }

        let raw = arg.trim_start_matches("--");
        if let Some((name, value)) = raw.split_once('=') {
            match allowed.get(name) {
                Some(FlagKind::Value) => {
                    invocation.flags.insert(name.to_string(), value.to_string());
                }
                Some(FlagKind::Bool { .. }) => {
                    invocation
                        .bool_flags
                        .insert(name.to_string(), parse_bool_flag_value(name, value)?);
                }
                None => return Err(crate::usage_err!("Nonexistent flag: --{name}")),
            }
            index += 1;
            continue;
        }

        let name = raw.to_string();
        match allowed.get(name.as_str()) {
            Some(FlagKind::Bool { .. }) => {
                invocation.bool_flags.insert(name, true);
                index += 1;
            }
            Some(FlagKind::Value) => {
                if index + 1 >= args.len() || args[index + 1].starts_with("--") {
                    return Err(crate::usage_err!("Flag --{name} expects a value"));
                }
                invocation.flags.insert(name, args[index + 1].clone());
                index += 2;
            }
            None => return Err(crate::usage_err!("Nonexistent flag: --{name}")),
        }
    }
    Ok(invocation)
}

fn parse_bool_flag_value(name: &str, value: &str) -> Result<bool> {
    value
        .parse()
        .with_context(|| format!("Expected a boolean for --{name}"))
        .map_err(crate::config::usage_error)
}

fn operation_flag_kinds(operation: &OperationManifest) -> BTreeMap<String, FlagKind> {
    let mut flags = BTreeMap::new();
    flags.insert("api-key".to_string(), FlagKind::Value);
    flags.insert("api-base-url".to_string(), FlagKind::Value);
    flags.insert("time".to_string(), FlagKind::Bool { allow_no: false });

    if operation.binary_response {
        flags.insert("output".to_string(), FlagKind::Value);
    } else {
        flags.insert("json".to_string(), FlagKind::Bool { allow_no: false });
        flags.insert("envelope".to_string(), FlagKind::Bool { allow_no: false });
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
        flags.insert(flag_name(&parameter.name), kind);
    }

    if operation.has_json_body {
        flags.insert("raw-body".to_string(), FlagKind::Value);
        flags.insert("body-file".to_string(), FlagKind::Value);
        for (property, schema) in request_body_properties(operation) {
            let kind = if body_scalar_type(schema).as_deref() == Some("boolean") {
                FlagKind::Bool { allow_no: true }
            } else {
                FlagKind::Value
            };
            flags.insert(flag_name(&property), kind);
            for alias in body_flag_aliases(&operation.sdk_name, &property) {
                flags.insert(alias, kind);
            }
        }
    }

    flags
}

pub fn operation_help_text(operation: &OperationManifest) -> String {
    operation_help_text_for_command(operation, &manifest::operation_id(operation))
}

pub fn operation_help_text_for_command(operation: &OperationManifest, command: &str) -> String {
    let command = command.split(':').collect::<Vec<_>>().join(" ");
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
    lines.push(format!("  {} {command} [flags]", crate::display_bin_name()));
    lines.push(String::new());
    lines.push("API".to_string());
    lines.push(format!("  {} {}", operation.method, operation.path));
    lines.push(String::new());
    lines.push("FLAGS".to_string());
    lines.push("  --api-key <value>".to_string());
    if operation.binary_response {
        lines.push("  --output <path>".to_string());
    } else {
        lines.push("  --json".to_string());
        lines.push("  --envelope".to_string());
    }
    lines.push("  --time".to_string());
    push_parameter_help(&mut lines, "PATH PARAMETERS", &operation.path_params);
    push_parameter_help(&mut lines, "QUERY PARAMETERS", &operation.query_params);
    push_parameter_help(&mut lines, "HEADER PARAMETERS", &operation.header_params);
    if operation.has_json_body {
        lines.push(String::new());
        lines.push("BODY".to_string());
        lines.push("  --raw-body <json>".to_string());
        lines.push("  --body-file <path>".to_string());
        for (property, schema) in request_body_properties(operation) {
            let name = flag_name(&property);
            if body_scalar_type(schema).as_deref() == Some("boolean") {
                lines.push(format!("  --[no-]{name}"));
            } else {
                lines.push(format!("  --{} <{}>", name, schema_label(schema)));
            }
        }
    }
    lines.push(String::new());
    lines.join("\n")
}

fn push_parameter_help(lines: &mut Vec<String>, title: &str, parameters: &[ParameterManifest]) {
    if parameters.is_empty() {
        return;
    }
    lines.push(String::new());
    lines.push(title.to_string());
    for parameter in parameters {
        let required = if parameter.required { " required" } else { "" };
        lines.push(format!(
            "  --{} <{}>{required}",
            flag_name(&parameter.name),
            parameter.type_name
        ));
    }
}

fn request_body_properties(operation: &OperationManifest) -> Vec<(String, &Value)> {
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
    properties
        .iter()
        .filter(|(property, schema)| {
            !occupied.contains(&flag_name(property)) && body_scalar_type(schema).is_some()
        })
        .map(|(property, schema)| (property.clone(), schema))
        .collect()
}

fn schema_label(schema: &Value) -> String {
    body_scalar_type(schema).unwrap_or_else(|| "json".to_string())
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
    network_error_hint_for_text(code)
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
        let value = parameter_value(parameter, invocation)?
            .ok_or_else(|| anyhow!("Missing required --{}", flag_name(&parameter.name)))?;
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
    if let Some(default_value) = &parameter.default_value {
        return Ok(Some(default_value_to_string(default_value)?));
    }
    if parameter.required {
        return Err(anyhow!("Missing required --{name}"));
    }
    Ok(None)
}

fn coerce_parameter_value(parameter: &ParameterManifest, value: &str) -> Result<String> {
    if let Some(values) = &parameter.enum_values {
        if !values.iter().any(|item| item == value) {
            return Err(anyhow!(
                "Expected --{} to be one of: {}",
                flag_name(&parameter.name),
                values.join(", ")
            ));
        }
    }
    match parameter.type_name.as_str() {
        "integer" => {
            let parsed: i64 = value.parse().with_context(|| {
                format!("Expected an integer for --{}", flag_name(&parameter.name))
            })?;
            check_numeric_bounds(parameter, parsed as f64)?;
            Ok(parsed.to_string())
        }
        "number" => {
            let parsed: f64 = value.parse().with_context(|| {
                format!("Expected a number for --{}", flag_name(&parameter.name))
            })?;
            check_numeric_bounds(parameter, parsed)?;
            Ok(value.to_string())
        }
        "boolean" => {
            let parsed: bool = value.parse().with_context(|| {
                format!("Expected a boolean for --{}", flag_name(&parameter.name))
            })?;
            Ok(parsed.to_string())
        }
        _ => Ok(value.to_string()),
    }
}

fn check_numeric_bounds(parameter: &ParameterManifest, value: f64) -> Result<()> {
    if let Some(minimum) = parameter.minimum {
        if value < minimum {
            return Err(anyhow!(
                "Expected --{} to be greater than or equal to {minimum}",
                flag_name(&parameter.name)
            ));
        }
    }
    if let Some(maximum) = parameter.maximum {
        if value > maximum {
            return Err(anyhow!(
                "Expected --{} to be less than or equal to {maximum}",
                flag_name(&parameter.name)
            ));
        }
    }
    Ok(())
}

fn default_value_to_string(value: &Value) -> Result<String> {
    match value {
        Value::Bool(value) => Ok(value.to_string()),
        Value::Number(value) => Ok(value.to_string()),
        Value::String(value) => Ok(value.clone()),
        _ => Err(anyhow!("Unsupported default value in operation manifest")),
    }
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
                return Err(anyhow!(
                    "--raw-body must be a JSON object when also passing per-field flags (got {})",
                    json_type(&other)
                ));
            }
        }
    }

    if operation.body_required && explicit.is_none() {
        return Err(anyhow!(
            "Operation {} requires a body. Pass each field as a --flag or supply JSON via --raw-body / --body-file.",
            operation.operation_id
        ));
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
        return Ok(Some(
            serde_json::from_str(raw_body).context("--raw-body is not valid JSON")?,
        ));
    }
    if let Some(body_file) = body_file {
        let contents = fs::read_to_string(body_file)
            .with_context(|| format!("Could not read --body-file {body_file}"))?;
        return Ok(Some(
            serde_json::from_str(&contents).context("--body-file is not valid JSON")?,
        ));
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
            return Err(anyhow!(
                "Expected --{} to be one of: {}",
                flag_name(property),
                allowed.join(", ")
            ));
        }
    }
    match body_scalar_type(schema).as_deref() {
        Some("integer") => {
            let parsed: i64 = value
                .parse()
                .with_context(|| format!("Expected an integer for --{}", flag_name(property)))?;
            Ok(Value::Number(Number::from(parsed)))
        }
        Some("number") => {
            let parsed: f64 = value
                .parse()
                .with_context(|| format!("Expected a number for --{}", flag_name(property)))?;
            let number = Number::from_f64(parsed).ok_or_else(|| anyhow!("Invalid number"))?;
            Ok(Value::Number(number))
        }
        Some("boolean") => {
            let parsed: bool = value
                .parse()
                .with_context(|| format!("Expected a boolean for --{}", flag_name(property)))?;
            Ok(Value::Bool(parsed))
        }
        _ => Ok(Value::String(value.to_string())),
    }
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

        assert!(help.contains("primitive-rust sending send-email [flags]"));
        assert!(help.contains("POST /send-mail"));
        assert!(help.contains("--api-key <value>"));
        assert!(help.contains("--json"));
        assert!(help.contains("--envelope"));
        assert!(!help.contains("--api-base-url"));
        assert!(help.contains("--idempotency-key <string>"));
        assert!(help.contains("--body-text <string>"));
        assert!(help.contains("--[no-]wait"));
        assert!(!help.contains("--attachments <"));
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

        assert!(help.contains("primitive-rust sending send [flags]"));
        assert!(!help.contains("sending send-email [flags]"));
        assert!(help.contains("POST /send-mail"));
    }

    #[test]
    fn generated_operation_help_hides_body_aliases_but_parser_accepts_them() {
        let operation = manifest::lookup_operation("agent:verify-agent-signup")
            .expect("verify agent signup operation");
        let help = operation_help_text(operation);

        assert!(help.contains("--verification-code <string>"));
        assert!(!help.contains("--code <string>"));

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
}
