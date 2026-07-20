use crate::{client, config};
use anyhow::{anyhow, Result};
use reqwest::Method;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{self, Write};
use std::path::Path;

const CREDENTIALS_FILE: &str = "credentials.json";
const PROXY_ENV_VARS: [&str; 4] = [
    "NODE_USE_ENV_PROXY",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CheckStatus {
    Ok,
    Warn,
    Fail,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct CheckOutcome {
    pub status: CheckStatus,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CheckRow {
    pub label: String,
    pub outcome: CheckOutcome,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DoctorSummary {
    pub ok: bool,
    pub checks: Vec<DoctorSummaryCheck>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DoctorSummaryCheck {
    pub label: String,
    pub status: CheckStatus,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DoctorCommandPlan {
    pub auth: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct DoctorApiResponse {
    pub status: u16,
    pub bytes: Vec<u8>,
    pub body: Option<Value>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AccountCheck {
    pub outcome: CheckOutcome,
    pub account: Option<Value>,
}

#[derive(Debug)]
pub struct ApiKeyCheckInput<'a> {
    pub api_key: Option<&'a str>,
    pub config_dir: &'a Path,
    pub env: &'a BTreeMap<String, String>,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    flags: BTreeMap<String, String>,
    positionals: Vec<String>,
}

impl CheckOutcome {
    pub fn ok(message: impl Into<String>) -> Self {
        Self {
            status: CheckStatus::Ok,
            message: message.into(),
            hint: None,
        }
    }

    pub fn warn(message: impl Into<String>, hint: Option<impl Into<String>>) -> Self {
        Self {
            status: CheckStatus::Warn,
            message: message.into(),
            hint: hint.map(Into::into),
        }
    }

    pub fn fail(message: impl Into<String>, hint: Option<impl Into<String>>) -> Self {
        Self {
            status: CheckStatus::Fail,
            message: message.into(),
            hint: hint.map(Into::into),
        }
    }
}

impl DoctorCommandPlan {
    fn api_key(&self) -> Option<&str> {
        self.auth.get("api-key").map(String::as_str)
    }
}

pub fn dispatch(args: &[String]) -> Result<()> {
    let code = execute(args)?;
    if code != 0 {
        std::process::exit(code);
    }
    Ok(())
}

pub fn execute(args: &[String]) -> Result<i32> {
    let mut stdout = io::stdout();
    let mut stderr = io::stderr();
    execute_with_writers(args, &mut stdout, &mut stderr)
}

pub fn execute_with_writers(
    args: &[String],
    stdout: &mut impl Write,
    stderr: &mut impl Write,
) -> Result<i32> {
    if args
        .first()
        .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h"))
    {
        print_help_to(stdout)?;
        return Ok(0);
    }

    let plan = build_doctor_plan(args)?;
    let env = current_env_map();
    let config_dir = config::config_dir();
    let mut rows = build_local_check_rows(&plan, &env, &config_dir);
    let auth_failed = rows
        .iter()
        .any(|row| row.label == "Auth" && row.outcome.status == CheckStatus::Fail);

    if !auth_failed {
        match config::resolve_auth(&plan.auth) {
            Ok(auth) if auth.api_key.is_some() => {
                let account_check = check_account(&auth);
                let account_ok = account_check.outcome.status == CheckStatus::Ok;
                rows.push(CheckRow {
                    label: "API auth".to_string(),
                    outcome: account_check.outcome,
                });
                if account_ok {
                    rows.push(CheckRow {
                        label: "Domains".to_string(),
                        outcome: check_domains(&auth),
                    });
                }
            }
            Ok(_) => {}
            Err(error) => rows.push(CheckRow {
                label: "API auth".to_string(),
                outcome: CheckOutcome::fail(
                    format!("could not resolve CLI auth ({error})"),
                    Some("Run `primitive logout` to clear malformed local auth state, then `primitive signin` to recreate it."),
                ),
            }),
        }
    }

    write_doctor_report(&rows, stdout, stderr)
}

pub fn build_doctor_plan(args: &[String]) -> Result<DoctorCommandPlan> {
    let parsed = parse_args(args, &["api-base-url", "api-key"])?;
    if let Some(positional) = parsed.positionals.first() {
        return Err(anyhow!(
            "Unexpected argument: {positional}. `doctor` only accepts flags."
        ));
    }
    Ok(DoctorCommandPlan { auth: parsed.flags })
}

pub fn build_local_check_rows(
    plan: &DoctorCommandPlan,
    env: &BTreeMap<String, String>,
    config_dir: &Path,
) -> Vec<CheckRow> {
    vec![
        CheckRow {
            label: "CLI runtime".to_string(),
            outcome: check_cli_runtime(env!("CARGO_PKG_VERSION")),
        },
        CheckRow {
            label: "Proxy env".to_string(),
            outcome: check_proxy_env(env),
        },
        CheckRow {
            label: "Auth".to_string(),
            outcome: check_api_key(ApiKeyCheckInput {
                api_key: plan.api_key(),
                config_dir,
                env,
            }),
        },
    ]
}

pub fn check_cli_runtime(version: &str) -> CheckOutcome {
    let version = version.trim();
    if version.is_empty() {
        return CheckOutcome::warn(
            "unrecognized CLI version",
            Some("Rebuild the CLI so package metadata is embedded."),
        );
    }
    CheckOutcome::ok(format!("{} {version}", crate::display_bin_name()))
}

pub fn check_proxy_env(env: &BTreeMap<String, String>) -> CheckOutcome {
    let present = PROXY_ENV_VARS
        .iter()
        .filter_map(|name| env_value(env, name).map(|value| format!("{name}={value}")))
        .collect::<Vec<_>>();

    if present.is_empty() {
        return CheckOutcome::ok("no proxy env vars set");
    }

    let proxy_host_vars = ["HTTPS_PROXY", "HTTP_PROXY"]
        .iter()
        .filter(|name| env_value(env, name).is_some())
        .copied()
        .collect::<Vec<_>>();
    let proxy_enabled = env_value(env, "NODE_USE_ENV_PROXY") == Some("1");
    if !proxy_host_vars.is_empty() && !proxy_enabled {
        return CheckOutcome::warn(
            format!(
                "{} ({} set, NODE_USE_ENV_PROXY not)",
                present.join(", "),
                proxy_host_vars.join(" / ")
            ),
            Some("Node 22+ ignores HTTP(S)_PROXY by default. Re-run the Node CLI with NODE_USE_ENV_PROXY=1 if API calls fail with ENETUNREACH or ECONNREFUSED."),
        );
    }

    CheckOutcome::ok(present.join(", "))
}

pub fn check_api_key(input: ApiKeyCheckInput<'_>) -> CheckOutcome {
    let api_key = input
        .api_key
        .filter(|value| !value.trim().is_empty())
        .or_else(|| env_value(input.env, "PRIMITIVE_API_KEY"));

    if let Some(api_key) = api_key {
        if api_key.starts_with("prim_") {
            return CheckOutcome::ok("provided via flag/env (prim_ prefix)");
        }
        return CheckOutcome::warn(
            "provided but does not start with prim_",
            Some("Verify the key is a Primitive API key, not a value from another service."),
        );
    }

    if detect_primitive_key_env_misname(input.env) {
        return CheckOutcome::fail(
            "PRIMITIVE_KEY is set but the CLI reads PRIMITIVE_API_KEY",
            Some("Rename your env var, or re-run with PRIMITIVE_API_KEY=$PRIMITIVE_KEY."),
        );
    }

    let credentials_path = input.config_dir.join(CREDENTIALS_FILE);
    let contents = match fs::read_to_string(&credentials_path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return CheckOutcome::fail(
                "no CLI OAuth session or explicit API key found",
                Some("Run `primitive signin`, pass --api-key explicitly, or export PRIMITIVE_API_KEY=prim_..."),
            )
        }
        Err(error) => {
            return CheckOutcome::fail(
                format!(
                    "{} exists but is unreadable or malformed ({error})",
                    credentials_path.display()
                ),
                Some("Run `primitive logout` to clear it, then `primitive signin` to recreate."),
            )
        }
    };

    match serde_json::from_str::<Value>(&contents) {
        Ok(credentials) => check_credentials_value(&credentials_path, &credentials),
        Err(error) => CheckOutcome::fail(
            format!(
                "{} exists but is unreadable or malformed ({error})",
                credentials_path.display()
            ),
            Some("Run `primitive logout` to clear it, then `primitive signin` to recreate."),
        ),
    }
}

pub fn detect_primitive_key_env_misname(env: &BTreeMap<String, String>) -> bool {
    env_value(env, "PRIMITIVE_KEY").is_some() && env_value(env, "PRIMITIVE_API_KEY").is_none()
}

pub fn check_account_response(response: &DoctorApiResponse) -> AccountCheck {
    if response.status >= 400 {
        return AccountCheck {
            outcome: CheckOutcome::fail(
                format!("API rejected the key ({})", response_error_body(response)),
                Some("Run `primitive whoami` for the full error envelope. If the key was rotated, regenerate it in the dashboard."),
            ),
            account: None,
        };
    }

    let Some(account) = response
        .body
        .as_ref()
        .and_then(|body| body.get("data"))
        .filter(|data| !data.is_null())
        .cloned()
    else {
        return AccountCheck {
            outcome: CheckOutcome::fail("/account returned an empty body", None::<String>),
            account: None,
        };
    };

    let email = account
        .get("email")
        .and_then(Value::as_str)
        .unwrap_or("(unknown email)");
    let plan = account
        .get("plan")
        .and_then(Value::as_str)
        .unwrap_or("(unknown plan)");
    let id = account
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("(unknown account id)");

    AccountCheck {
        outcome: CheckOutcome::ok(format!("{email} (plan: {plan}, id: {id})")),
        account: Some(account),
    }
}

pub fn check_domains_response(response: &DoctorApiResponse) -> CheckOutcome {
    if response.status >= 400 {
        return CheckOutcome::warn(
            "could not list domains",
            Some("Run `primitive domains list` for the full error envelope."),
        );
    }

    let rows = response
        .body
        .as_ref()
        .and_then(|body| body.get("data"))
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let active = rows
        .iter()
        .filter(|row| domain_active(row))
        .collect::<Vec<_>>();

    if rows.is_empty() {
        return CheckOutcome::warn(
            "no domains on this account yet",
            Some("A managed `*.primitive.email` subdomain is auto-issued on signup. If this is empty, complete onboarding or check the dashboard."),
        );
    }
    if active.is_empty() {
        return CheckOutcome::warn(
            format!("{} domain(s), none active", rows.len()),
            Some("Run `primitive domains verify --id <id>` for any domain you intend to send / receive on."),
        );
    }

    let names = active
        .iter()
        .filter_map(|row| row.get("domain").and_then(Value::as_str))
        .filter(|domain| !domain.trim().is_empty())
        .collect::<Vec<_>>();
    if names.is_empty() {
        CheckOutcome::ok(format!("{} active domain(s)", active.len()))
    } else {
        CheckOutcome::ok(format!(
            "{} active domain(s): {}",
            active.len(),
            names.join(", ")
        ))
    }
}

pub fn render_row(row: &CheckRow) -> String {
    let tag = match row.outcome.status {
        CheckStatus::Ok => "[OK]  ",
        CheckStatus::Warn => "[WARN]",
        CheckStatus::Fail => "[FAIL]",
    };
    format!("{tag} {}: {}", row.label, row.outcome.message)
}

pub fn doctor_summary(rows: &[CheckRow]) -> DoctorSummary {
    DoctorSummary {
        ok: rows.iter().all(|row| row.outcome.status == CheckStatus::Ok),
        checks: rows
            .iter()
            .map(|row| DoctorSummaryCheck {
                label: row.label.clone(),
                status: row.outcome.status,
                message: row.outcome.message.clone(),
                hint: row.outcome.hint.clone(),
            })
            .collect(),
    }
}

pub fn write_doctor_report(
    rows: &[CheckRow],
    stdout: &mut impl Write,
    stderr: &mut impl Write,
) -> Result<i32> {
    for row in rows {
        writeln!(stderr, "{}", render_row(row))?;
        if let Some(hint) = &row.outcome.hint {
            writeln!(stderr, "       hint: {hint}")?;
        }
    }

    writeln!(
        stdout,
        "{}",
        serde_json::to_string_pretty(&doctor_summary(rows))?
    )?;

    if rows
        .iter()
        .any(|row| row.outcome.status == CheckStatus::Fail)
    {
        Ok(1)
    } else {
        Ok(0)
    }
}

fn check_account(auth: &config::ResolvedAuth) -> AccountCheck {
    match execute_doctor_get("/account", auth) {
        Ok(response) => check_account_response(&response),
        Err(error) => AccountCheck {
            outcome: account_network_error(&error),
            account: None,
        },
    }
}

fn check_domains(auth: &config::ResolvedAuth) -> CheckOutcome {
    match execute_doctor_get("/domains", auth) {
        Ok(response) => check_domains_response(&response),
        Err(error) => CheckOutcome::warn(format!("listDomains threw: {error}"), None::<String>),
    }
}

fn execute_doctor_get(path: &str, auth: &config::ResolvedAuth) -> Result<DoctorApiResponse> {
    let http = client::http_client()?;
    let url = format!("{}{}", auth.api_base_url.trim_end_matches('/'), path);
    let mut request = http.request(Method::GET, url);
    request = client::apply_headers(request, auth, true, &[], false)?;
    let response = request.send()?;
    let (status, bytes, body) = client::parse_response(response)?;
    Ok(DoctorApiResponse {
        status,
        bytes,
        body,
    })
}

fn account_network_error(error: &anyhow::Error) -> CheckOutcome {
    let hint = error.downcast_ref::<reqwest::Error>().map_or_else(
        || "Inspect the error above. `curl https://api.primitive.dev/v1/account -H \"Authorization: Bearer $PRIMITIVE_API_KEY\"` is the fastest way to bisect CLI vs network.",
        |error| {
            if error.is_connect() || error.is_timeout() {
                "Network unreachable. If you're behind a proxy, confirm HTTPS_PROXY is set. If you're in a container, check that egress to *.primitive.dev is allowed."
            } else {
                "Inspect the error above. `curl https://api.primitive.dev/v1/account -H \"Authorization: Bearer $PRIMITIVE_API_KEY\"` is the fastest way to bisect CLI vs network."
            }
        },
    );
    CheckOutcome::fail(error.to_string(), Some(hint))
}

fn parse_args(args: &[String], value_flags: &[&str]) -> Result<ParsedArgs> {
    let value_flags = value_flags.iter().copied().collect::<BTreeSet<_>>();
    let mut parsed = ParsedArgs::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with("--") {
            parsed.positionals.push(arg.clone());
            index += 1;
            continue;
        }

        let raw = arg.trim_start_matches("--");
        let (name, inline_value) = match raw.split_once('=') {
            Some((name, value)) => (name, Some(value.to_string())),
            None => (raw, None),
        };
        if !value_flags.contains(name) {
            return Err(crate::usage_err!("Unknown flag --{name}"));
        }

        let value = match inline_value {
            Some(value) => value,
            None => {
                index += 1;
                args.get(index)
                    .cloned()
                    .ok_or_else(|| crate::usage_err!("Missing value for --{name}"))?
            }
        };
        parsed.flags.insert(name.to_string(), value);
        index += 1;
    }
    Ok(parsed)
}

fn check_credentials_value(credentials_path: &Path, credentials: &Value) -> CheckOutcome {
    if credentials.get("auth_method").and_then(Value::as_str) == Some("oauth")
        && credentials
            .get("access_token")
            .and_then(Value::as_str)
            .is_some_and(|value| !value.is_empty())
    {
        return CheckOutcome::ok(format!(
            "loaded OAuth session from {}",
            credentials_path.display()
        ));
    }
    if credentials
        .get("api_key")
        .and_then(Value::as_str)
        .is_some_and(|value| !value.is_empty())
    {
        return CheckOutcome::fail(
            format!(
                "{} contains legacy API-key login state",
                credentials_path.display()
            ),
            Some("Run `primitive signin` to create saved OAuth credentials. Existing API keys still work with --api-key or PRIMITIVE_API_KEY."),
        );
    }
    CheckOutcome::fail(
        format!(
            "{} exists but contains no OAuth access_token",
            credentials_path.display()
        ),
        Some("Run `primitive logout` to clear it, then `primitive signin` to recreate."),
    )
}

fn domain_active(row: &Value) -> bool {
    row.get("is_active")
        .and_then(Value::as_bool)
        .or_else(|| row.get("verified").and_then(Value::as_bool))
        == Some(true)
}

fn response_error_body(response: &DoctorApiResponse) -> String {
    let raw = if let Some(body) = &response.body {
        serde_json::to_string(body).unwrap_or_else(|_| body.to_string())
    } else if response.bytes.is_empty() {
        format!("HTTP {}", response.status)
    } else {
        String::from_utf8_lossy(&response.bytes).into_owned()
    };
    truncate_chars(&raw, 300)
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    value.chars().take(max_chars).collect()
}

fn current_env_map() -> BTreeMap<String, String> {
    std::env::vars().collect()
}

fn env_value<'a>(env: &'a BTreeMap<String, String>, name: &str) -> Option<&'a str> {
    env.get(name)
        .map(String::as_str)
        .filter(|value| !value.is_empty())
}

fn print_help_to(writer: &mut impl Write) -> Result<()> {
    writeln!(writer, "Primitive doctor")?;
    writeln!(writer)?;
    writeln!(writer, "USAGE")?;
    writeln!(
        writer,
        "  {} doctor [--api-key <key>]",
        crate::display_bin_name()
    )?;
    writeln!(writer)?;
    writeln!(writer, "FLAGS")?;
    writeln!(
        writer,
        "  --api-key <key>          Primitive API key override"
    )?;
    Ok(())
}
