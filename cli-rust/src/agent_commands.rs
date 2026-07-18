use crate::{client, config};
use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::io::{self, BufRead, Write};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentUpgradePlan {
    pub auth: BTreeMap<String, String>,
    pub code: Option<String>,
    pub email: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ApiRequest {
    pub method: String,
    pub path: String,
    pub body: Value,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeSet<String>,
    flags: BTreeMap<String, String>,
    positionals: Vec<String>,
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help();
        return Ok(());
    }
    match args[0].as_str() {
        "upgrade" => {
            if args.len() > 1 && matches!(args[1].as_str(), "--help" | "-h") {
                print_upgrade_help();
                return Ok(());
            }
            execute_upgrade(&build_agent_upgrade_plan(&args[1..])?)
        }
        other => Err(anyhow!("Unknown agent command `{other}`")),
    }
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    match command {
        "agent:upgrade" => {
            if args
                .first()
                .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h"))
            {
                print_upgrade_help();
                return Ok(());
            }
            execute_upgrade(&build_agent_upgrade_plan(args)?)
        }
        other => Err(anyhow!("Unknown agent command `{other}`")),
    }
}

pub fn is_agent_friendly_command(command: &str) -> bool {
    matches!(command, "agent:upgrade")
}

pub fn build_agent_upgrade_plan(args: &[String]) -> Result<AgentUpgradePlan> {
    let parsed = parse_args(args, &["api-base-url", "api-key", "code", "email"], &[])?;
    if !parsed.positionals.is_empty() {
        return Err(anyhow!(
            "Unexpected argument: {}. Use --email and --code with agent upgrade.",
            parsed.positionals[0]
        ));
    }
    let auth = auth_flags(&parsed);
    Ok(AgentUpgradePlan {
        auth,
        code: parsed.flags.get("code").cloned(),
        email: parsed.flags.get("email").cloned(),
    })
}

pub fn build_start_agent_claim_request(email: &str) -> ApiRequest {
    ApiRequest {
        method: "POST".to_string(),
        path: "/agent/claim/start".to_string(),
        body: json!({ "email": email }),
    }
}

pub fn build_verify_agent_claim_request(code: &str) -> ApiRequest {
    ApiRequest {
        method: "POST".to_string(),
        path: "/agent/claim/verify".to_string(),
        body: json!({ "verification_code": code }),
    }
}

fn execute_upgrade(plan: &AgentUpgradePlan) -> Result<()> {
    let auth = config::resolve_auth(&plan.auth)?;
    if auth.api_key.is_none() {
        return Err(anyhow!(
            "Not authenticated: set PRIMITIVE_API_KEY, pass --api-key, or run `primitive login`."
        ));
    }

    let email = match &plan.email {
        Some(email) => email.clone(),
        None => prompt_required("Email to confirm: ")?,
    };
    let start = execute_agent_request(&build_start_agent_claim_request(&email), &auth)?;
    if start.get("data").is_none() {
        return Err(anyhow!(
            "{}",
            serde_json::to_string_pretty(&start).unwrap_or_else(|_| start.to_string())
        ));
    }
    eprintln!("Verification code sent to {email}.");

    let code = match &plan.code {
        Some(code) => code.clone(),
        None => prompt_required("Verification code: ")?,
    };
    let verified = execute_agent_request(&build_verify_agent_claim_request(&code), &auth)?;
    let result = verified
        .get("data")
        .cloned()
        .filter(|value| !value.is_null())
        .ok_or_else(|| {
            anyhow!(
                "{}",
                serde_json::to_string_pretty(&verified).unwrap_or_else(|_| verified.to_string())
            )
        })?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    let plan_name = result
        .get("plan")
        .and_then(Value::as_str)
        .unwrap_or("developer");
    eprintln!(
        "Upgraded to {plan_name}. Your API key and managed inbox carry over; the send cap is lifted."
    );
    Ok(())
}

fn execute_agent_request(request: &ApiRequest, auth: &config::ResolvedAuth) -> Result<Value> {
    let http = client::http_client()?;
    let method: Method = request.method.parse()?;
    let url = format!(
        "{}{}",
        auth.api_base_url.trim_end_matches('/'),
        request.path.as_str()
    );
    let mut builder = http.request(method, url);
    builder = client::apply_headers(builder, auth, true, &[], true)?;
    builder = builder.json(&request.body);
    let response = builder.send().context("Could not reach Primitive API")?;
    let (status, bytes, json) = client::parse_response(response)?;
    if status >= 400 {
        return Err(client::error_for_status(status, json.as_ref(), &bytes));
    }
    json.ok_or_else(|| anyhow!("Primitive API returned an empty response"))
}

fn prompt_required(question: &str) -> Result<String> {
    let stdin = io::stdin();
    let mut reader = stdin.lock();
    prompt_required_from(question, &mut reader, &mut io::stderr())
}

pub fn prompt_required_from(
    question: &str,
    reader: &mut impl BufRead,
    writer: &mut impl Write,
) -> Result<String> {
    loop {
        write!(writer, "{question}")?;
        writer.flush()?;
        let mut answer = String::new();
        let bytes = reader.read_line(&mut answer)?;
        if bytes == 0 {
            return Err(anyhow!("No input received for prompt."));
        }
        let answer = answer.trim();
        if !answer.is_empty() {
            return Ok(answer.to_string());
        }
    }
}

fn parse_args(args: &[String], value_flags: &[&str], bool_flags: &[&str]) -> Result<ParsedArgs> {
    let value_flags: BTreeSet<&str> = value_flags.iter().copied().collect();
    let bool_flags: BTreeSet<&str> = bool_flags.iter().copied().collect();
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
        if value_flags.contains(name) {
            let value = match inline_value {
                Some(value) => value,
                None => {
                    index += 1;
                    args.get(index)
                        .cloned()
                        .ok_or_else(|| anyhow!("Missing value for --{name}"))?
                }
            };
            parsed.flags.insert(name.to_string(), value);
            index += 1;
            continue;
        }
        if bool_flags.contains(name) {
            if inline_value.is_some() {
                return Err(anyhow!("Flag --{name} does not take a value"));
            }
            parsed.bool_flags.insert(name.to_string());
            index += 1;
            continue;
        }
        return Err(anyhow!("Unknown flag --{name}"));
    }
    Ok(parsed)
}

fn auth_flags(parsed: &ParsedArgs) -> BTreeMap<String, String> {
    let mut flags = BTreeMap::new();
    for name in ["api-base-url", "api-key"] {
        if let Some(value) = parsed.flags.get(name) {
            flags.insert(name.to_string(), value.clone());
        }
    }
    flags
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive agent commands:");
    println!("  {bin} agent upgrade --email <email> [--code <code>]");
    println!("  {bin} agent claim --email <email>");
    println!("  {bin} agent claim-verify --code <code>");
    println!("  {bin} agent claim-link");
    println!("  {bin} agent create [flags]");
}

fn print_upgrade_help() {
    print!("{}", agent_upgrade_help_text());
}

pub fn agent_upgrade_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Upgrade an agent account to developer (email confirmation)

USAGE
  {bin} agent upgrade [--email <value>] [--code <value>] [--api-key <value>] [--api-base-url <value>]

FLAGS
  --api-base-url <value>  Override the API base URL.
  --api-key <value>       Agent API key.
  --code <value>          Verification code from the email. Prompted if omitted.
  --email <value>         Email to confirm. Prompted if omitted.

EXAMPLES
  {bin} agent upgrade --email you@example.com
"#
    )
}
