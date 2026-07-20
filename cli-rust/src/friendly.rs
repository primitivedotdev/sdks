use crate::api;
use crate::config;
use crate::manifest;
use anyhow::{anyhow, Result};

struct OperationLookup {
    operation: Option<&'static manifest::OperationManifest>,
    candidates: Vec<String>,
}

pub fn dispatch(args: Vec<String>) -> Result<()> {
    if args.is_empty() {
        print_help();
        return Ok(());
    }
    if args[0] == "help" && args.len() > 1 {
        let mut routed = args[1..].to_vec();
        routed.push("--help".to_string());
        return dispatch(routed);
    }
    if args[0] == "--help" || args[0] == "-h" || args[0] == "help" {
        print_help();
        return Ok(());
    }
    if args.len() == 1 && matches!(args[0].as_str(), "--version" | "-V") {
        println!("{}/{}", crate::display_bin_name(), crate::VERSION);
        return Ok(());
    }

    let (command, rest) = split_command(&args)?;
    let typed_colon_command = args.first().is_some_and(|arg| arg.contains(':'));
    if rest
        .iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
    {
        if command == "org:secrets" {
            crate::org_secrets::dispatch(rest)?;
            return Ok(());
        }
        if typed_colon_command && command.starts_with("org:secrets:") {
            crate::org_secrets::execute_command(&command, rest)?;
            return Ok(());
        }
        if typed_colon_command
            && command.starts_with("inbox:")
            && crate::inbox_commands::print_command_help(&command)
        {
            return Ok(());
        }
        if typed_colon_command && crate::auth_commands::is_auth_friendly_command(&command) {
            crate::auth_commands::execute_command(&command, rest)?;
            return Ok(());
        }
        if crate::search_commands::is_search_command(&command) {
            crate::search_commands::execute_command(&command, rest)?;
            return Ok(());
        }
        if manifest::uses_generated_cli_help(&command) {
            let operation = manifest::lookup_operation(&command).expect("generated help operation");
            print!(
                "{}",
                api::operation_help_text_for_command(operation, &command)
            );
            return Ok(());
        }
        if typed_colon_command
            && !command.starts_with("config")
            && !command.starts_with("payloads")
            && !command.starts_with("agent")
            && !command.starts_with("payments")
            && !command.starts_with("emails")
            && !command.starts_with("functions")
            && !command.starts_with("domains")
            && !command.starts_with("routes")
            && !command.starts_with("memories")
            && !command.starts_with("wake")
            && !command.starts_with("search")
            && !command.starts_with("chat")
            && print_friendly_command_help(&command)
        {
            return Ok(());
        }
    }
    match command.as_str() {
        "list-operations"
            if rest
                .first()
                .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h")) =>
        {
            print!("{}", list_operations_help_text());
            Ok(())
        }
        "list-operations" => {
            println!(
                "{}",
                serde_json::to_string_pretty(manifest::operation_manifest())?
            );
            Ok(())
        }
        "describe"
            if rest
                .first()
                .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h")) =>
        {
            print!("{}", describe_help_text());
            Ok(())
        }
        "describe" => describe(rest),
        "config"
            if rest
                .first()
                .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h")) =>
        {
            config_help("config")
        }
        "config" => {
            println!("{}", config::config_list_output(rest)?);
            Ok(())
        }
        "config:list"
            if rest
                .first()
                .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h")) =>
        {
            config_help("config:list")
        }
        "config:list" => {
            println!("{}", config::config_list_output(rest)?);
            Ok(())
        }
        "config:reset"
            if rest
                .first()
                .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h")) =>
        {
            config_help("config:reset")
        }
        "config:reset" => {
            eprintln!("{}", config::config_reset(rest)?);
            Ok(())
        }
        "config:set"
            if rest
                .first()
                .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h")) =>
        {
            config_help("config:set")
        }
        "config:set" => {
            let result = config::config_set(rest)?;
            eprintln!(
                "Primitive CLI environment {} is active.",
                result.environment
            );
            if result.removed_credentials {
                eprintln!("{}", config::CREDENTIALS_REMOVED_NOTICE);
            }
            Ok(())
        }
        "config:use"
            if rest
                .first()
                .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h")) =>
        {
            config_help("config:use")
        }
        "config:use" => {
            let [name] = rest else {
                return Err(crate::usage_err!(
                    "config:use requires exactly one environment name"
                ));
            };
            let result = config::config_use(name)?;
            eprintln!(
                "Primitive CLI environment {} is active.",
                result.environment
            );
            if result.removed_credentials {
                eprintln!("{}", config::CREDENTIALS_REMOVED_NOTICE);
            }
            Ok(())
        }
        "completion" => crate::completion_commands::dispatch(rest),
        "autocomplete" => crate::completion_commands::dispatch_autocomplete(rest),
        "autocomplete:script" | "script:autocomplete" => {
            let autocomplete_args: Vec<String> = std::iter::once("script".to_string())
                .chain(rest.iter().cloned())
                .collect();
            crate::completion_commands::dispatch_autocomplete(&autocomplete_args)
        }
        "autocomplete:create" | "create:autocomplete" => {
            let autocomplete_args: Vec<String> = std::iter::once("create".to_string())
                .chain(rest.iter().cloned())
                .collect();
            crate::completion_commands::dispatch_autocomplete(&autocomplete_args)
        }
        "agent" => crate::agent_commands::dispatch(rest),
        other if crate::agent_commands::is_agent_friendly_command(other) => {
            crate::agent_commands::execute_command(other, rest)
        }
        other if crate::auth_commands::is_auth_friendly_command(other) => {
            crate::auth_commands::execute_command(other, rest)
        }
        "payloads" | "payloads:push" | "payloads:pull" => {
            let payload_args = if command == "payloads" {
                rest.to_vec()
            } else {
                let subcommand = command
                    .strip_prefix("payloads:")
                    .expect("payloads command prefix")
                    .to_string();
                std::iter::once(subcommand)
                    .chain(rest.iter().cloned())
                    .collect()
            };
            crate::payloads::dispatch(&payload_args)
        }
        "payments" => crate::payments::dispatch(rest),
        other if crate::payments::is_friendly_command(other) => {
            let subcommand = other
                .strip_prefix("payments:")
                .expect("payments command prefix")
                .to_string();
            let payment_args: Vec<String> = std::iter::once(subcommand)
                .chain(rest.iter().cloned())
                .collect();
            crate::payments::dispatch(&payment_args)
        }
        "routes" => crate::routes_commands::dispatch(rest),
        other if crate::routes_commands::is_routes_friendly_command(other) => {
            crate::routes_commands::execute_command(other, rest)
        }
        "emails" => crate::emails_commands::dispatch(rest),
        other if crate::emails_commands::is_emails_friendly_command(other) => {
            crate::emails_commands::execute_command(other, rest)
        }
        "functions" => crate::functions_commands::dispatch(rest),
        other if crate::functions_commands::is_functions_friendly_command(other) => {
            crate::functions_commands::execute_command(other, rest)
        }
        "domains" => crate::domains_commands::dispatch(rest),
        other if crate::domains_commands::is_domains_friendly_command(other) => {
            crate::domains_commands::execute_command(other, rest)
        }
        "memories" => crate::memories_commands::dispatch(rest),
        other if crate::memories_commands::is_memories_friendly_command(other) => {
            crate::memories_commands::execute_command(other, rest)
        }
        "inbox" => crate::inbox_commands::dispatch(rest),
        other if crate::inbox_commands::is_inbox_friendly_command(other) => {
            let subcommand = other
                .strip_prefix("inbox:")
                .expect("inbox command prefix")
                .to_string();
            let inbox_args: Vec<String> = std::iter::once(subcommand)
                .chain(rest.iter().cloned())
                .collect();
            crate::inbox_commands::dispatch(&inbox_args)
        }
        "org" | "org:secrets" => crate::org_secrets::dispatch(rest),
        other if crate::org_secrets::is_org_secrets_friendly_command(other) => {
            crate::org_secrets::execute_command(other, rest)
        }
        "send" | "reply" | "chat" => {
            let mail_args: Vec<String> = std::iter::once(command)
                .chain(rest.iter().cloned())
                .collect();
            crate::mail_commands::dispatch(&mail_args)
        }
        other if crate::mail_commands::is_mail_friendly_command(other) => {
            let mail_args: Vec<String> = std::iter::once(other.to_string())
                .chain(rest.iter().cloned())
                .collect();
            crate::mail_commands::dispatch(&mail_args)
        }
        "search" | "semantic-search" | "search:semantic-search" => {
            crate::search_commands::execute_command(command.as_str(), rest)
        }
        "wake" => crate::wake_commands::dispatch(rest),
        other if crate::wake_commands::is_wake_friendly_command(other) => {
            crate::wake_commands::execute_command(other, rest)
        }
        "doctor" => crate::doctor_commands::dispatch(rest),
        other => {
            if should_print_topic_help(rest) && print_topic_help(other) {
                return Ok(());
            }
            if let Some(operation) = manifest::lookup_operation(other) {
                let code = api::execute_operation(operation, rest)?;
                if code != 0 {
                    std::process::exit(code);
                }
                Ok(())
            } else {
                Err(crate::usage_err!("Unknown command `{other}`. Run `{} list-operations` to enumerate generated API commands.", crate::display_bin_name()))
            }
        }
    }
}

fn split_command(args: &[String]) -> Result<(String, &[String])> {
    for length in (1..=args.len()).rev() {
        let candidate = args[..length].join(":");
        if is_known_command_candidate(&candidate) {
            return Ok((candidate, &args[length..]));
        }
    }

    let first = args[0].as_str();
    if first.contains(':')
        || matches!(
            first,
            "list-operations"
                | "describe"
                | "agent"
                | "config"
                | "domains"
                | "memories"
                | "wake"
                | "logout"
                | "doctor"
                | "whoami"
                | "payloads"
                | "completion"
                | "autocomplete"
        )
    {
        return Ok((first.to_string(), &args[1..]));
    }
    Ok((first.to_string(), &args[1..]))
}

fn is_known_command_candidate(candidate: &str) -> bool {
    manifest::lookup_operation(candidate).is_some()
        || crate::agent_commands::is_agent_friendly_command(candidate)
        || crate::payments::is_friendly_command(candidate)
        || crate::routes_commands::is_routes_friendly_command(candidate)
        || crate::emails_commands::is_emails_friendly_command(candidate)
        || crate::functions_commands::is_functions_friendly_command(candidate)
        || crate::domains_commands::is_domains_friendly_command(candidate)
        || crate::memories_commands::is_memories_friendly_command(candidate)
        || crate::inbox_commands::is_inbox_friendly_command(candidate)
        || crate::mail_commands::is_mail_friendly_command(candidate)
        || crate::auth_commands::is_auth_friendly_command(candidate)
        || crate::org_secrets::is_org_secrets_friendly_command(candidate)
        || crate::wake_commands::is_wake_friendly_command(candidate)
        || matches!(
            candidate,
            "completion"
                | "autocomplete"
                | "list-operations"
                | "describe"
                | "doctor"
                | "payloads"
                | "payloads:push"
                | "payloads:pull"
                | "config:list"
                | "config:reset"
                | "config:set"
                | "config:use"
        )
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive Rust CLI");
    println!();
    println!("USAGE");
    println!("  {bin} <command> [flags]");
    println!();
    println!("CORE COMMANDS");
    println!("  list-operations");
    println!("  describe <operation>");
    println!("  config list|set|use|reset");
    println!("  completion|autocomplete");
    println!("  signin|login|signup|otp");
    println!("  whoami");
    println!("  logout");
    println!("  doctor");
    println!("  send|reply|chat|search");
    println!("  inbox setup|status");
    println!("  emails latest|wait|watch");
    println!("  functions init|templates|deploy|logs|set-secret|test");
    println!("  domains zone-file");
    println!("  routes list|add|update|remove|test|reorder");
    println!("  memories set|get|delete|search");
    println!("  payments charge|pay|pay-email|pay-email-step");
    println!("  wake schedules|authorizations|dispatches");
    println!("  payloads push|pull");
    println!();
    println!("Generated API commands use <tag>:<command>, for example sending:send-email.");
}

fn should_print_topic_help(rest: &[String]) -> bool {
    rest.is_empty()
        || rest
            .first()
            .is_some_and(|arg| matches!(arg.as_str(), "--help" | "-h"))
}

fn print_topic_help(topic: &str) -> bool {
    let bin = crate::display_bin_name();
    let mut commands: Vec<(String, String)> = crate::help_commands::expected_command_surface()
        .into_values()
        .filter_map(|entry| {
            let id = entry.id;
            let (entry_topic, command) = id.split_once(':')?;
            if entry_topic != topic {
                return None;
            }
            let command = command.to_string();
            let summary = entry
                .summary
                .or(entry.target_operation_id)
                .unwrap_or_else(|| id.clone());
            Some((command, summary))
        })
        .collect();
    if commands.is_empty() {
        return false;
    }

    commands.sort_by(|left, right| left.0.cmp(&right.0));
    commands.dedup_by(|left, right| left.0 == right.0);

    println!("Primitive Rust CLI {topic} commands");
    println!();
    println!("USAGE");
    println!("  {bin} {topic} <command> [flags]");
    println!();
    println!("COMMANDS");
    for (command, summary) in commands {
        println!("  {topic} {command}  {summary}");
    }
    true
}

fn print_friendly_command_help(command: &str) -> bool {
    if !is_known_command_candidate(command) {
        return false;
    }
    if let Some((topic, _)) = command.split_once(':') {
        if print_topic_help(topic) {
            return true;
        }
    }
    print_help();
    true
}

fn list_operations_help_text() -> String {
    let bin = crate::display_bin_name();
    [
        "List all generated API operations (JSON)".to_string(),
        String::new(),
        "USAGE".to_string(),
        format!("  {bin} list-operations"),
        String::new(),
        "DESCRIPTION".to_string(),
        "  List all generated API operations as JSON.".to_string(),
        String::new(),
    ]
    .join("\n")
}

fn describe_help_text() -> String {
    let bin = crate::display_bin_name();
    [
        "Describe a single API operation in detail".to_string(),
        String::new(),
        "USAGE".to_string(),
        format!("  {bin} describe <command>"),
        String::new(),
        "ARGUMENTS".to_string(),
        "  command  Command id, alias, or SDK operation name to describe.".to_string(),
        String::new(),
    ]
    .join("\n")
}

fn describe(args: &[String]) -> Result<()> {
    let id = args
        .first()
        .ok_or_else(|| anyhow!("describe requires a command id, alias, or operation name"))?;
    let OperationLookup {
        operation,
        candidates,
    } = lookup_operation_with_candidates(id);
    let operation = operation.ok_or_else(|| {
        let hint = if candidates.is_empty() {
            format!(
                "Run `{} list-operations` to enumerate.",
                crate::display_bin_name()
            )
        } else {
            format!("Did you mean: {}?", candidates.join(", "))
        };
        anyhow!("Unknown operation `{}`. {hint}", id.trim())
    })?;
    println!("{}", serde_json::to_string_pretty(operation)?);
    Ok(())
}

fn lookup_operation_with_candidates(id: &str) -> OperationLookup {
    if let Some(operation) = manifest::lookup_operation(id) {
        return OperationLookup {
            operation: Some(operation),
            candidates: Vec::new(),
        };
    }

    let query = manifest::resolve_alias(id.trim());
    let mut scored: Vec<(String, i32)> = manifest::operation_manifest()
        .iter()
        .map(|operation| {
            (
                manifest::operation_id(operation),
                score_operation(query, operation),
            )
        })
        .filter(|(_, score)| *score >= 45)
        .collect();
    scored.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));

    OperationLookup {
        operation: None,
        candidates: scored
            .into_iter()
            .take(5)
            .map(|(operation_id, _)| operation_id)
            .collect(),
    }
}

fn operation_lookup_tokens(operation: &manifest::OperationManifest) -> Vec<String> {
    vec![
        manifest::operation_id(operation),
        operation.command.clone(),
        operation.operation_id.clone(),
        operation.sdk_name.clone(),
        format!("{}:{}", operation.tag_command, operation.operation_id),
        format!("{}:{}", operation.tag_command, operation.sdk_name),
    ]
}

fn score_operation(query: &str, operation: &manifest::OperationManifest) -> i32 {
    operation_lookup_tokens(operation)
        .iter()
        .map(|token| score_lookup_token(query, token))
        .max()
        .unwrap_or(0)
}

fn score_lookup_token(query: &str, token: &str) -> i32 {
    let normalized_query = normalize_lookup_token(query);
    let normalized_token = normalize_lookup_token(token);
    if normalized_query.is_empty() || normalized_token.is_empty() {
        return 0;
    }
    if normalized_query == normalized_token {
        return 100;
    }
    if normalized_token.contains(&normalized_query) {
        let delta = normalized_token.len() as i32 - normalized_query.len() as i32;
        return 50.max(90 - delta);
    }
    if normalized_query.contains(&normalized_token) {
        let delta = normalized_query.len() as i32 - normalized_token.len() as i32;
        return 45.max(80 - delta);
    }

    let distance = levenshtein_distance(&normalized_query, &normalized_token) as f64;
    let max_length = normalized_query.len().max(normalized_token.len()) as f64;
    ((1.0 - distance / max_length) * 75.0).round() as i32
}

fn levenshtein_distance(left: &str, right: &str) -> usize {
    if left == right {
        return 0;
    }
    if left.is_empty() {
        return right.len();
    }
    if right.is_empty() {
        return left.len();
    }

    let mut previous: Vec<usize> = (0..=right.len()).collect();
    for (left_index, left_byte) in left.bytes().enumerate() {
        let mut current = vec![left_index + 1];
        for (right_index, right_byte) in right.bytes().enumerate() {
            let substitution_cost = usize::from(left_byte != right_byte);
            current.push(
                (current[right_index] + 1)
                    .min(previous[right_index + 1] + 1)
                    .min(previous[right_index] + substitution_cost),
            );
        }
        previous = current;
    }
    previous[right.len()]
}

fn normalize_lookup_token(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn config_help(command: &str) -> Result<()> {
    print!("{}", config_help_text(command));
    Ok(())
}

fn config_help_text(command: &str) -> String {
    let bin = crate::display_bin_name();
    let lines = match command {
        "config:list" => vec![
            "List Primitive CLI request environments".to_string(),
            String::new(),
            "USAGE".to_string(),
            format!("  {bin} config list [--json] [--show-secrets]"),
            String::new(),
            "FLAGS".to_string(),
            "  --json          Print JSON".to_string(),
            "  --show-secrets  Show header values instead of redacting them".to_string(),
        ],
        "config:reset" => vec![
            "Reset Primitive CLI request environments".to_string(),
            String::new(),
            "USAGE".to_string(),
            format!("  {bin} config reset [-e <value>]"),
            String::new(),
            "FLAGS".to_string(),
            "  -e, --environment <value>  Only remove one environment".to_string(),
        ],
        "config:set" => vec![
            "Set a Primitive CLI request environment".to_string(),
            String::new(),
            "USAGE".to_string(),
            format!(
                "  {bin} config set [-e <value>] [--api-base-url <value>] [--header <value>...] [--unset-header <value>...]"
            ),
            String::new(),
            "FLAGS".to_string(),
            "  -e, --environment <value>      Environment name to create or update".to_string(),
            "      --api-base-url <value>     API base URL".to_string(),
            "      --header <value>...        Request header in name=value form. Repeatable.".to_string(),
            "      --unset-header <value>...  Request header name to remove. Repeatable.".to_string(),
        ],
        "config:use" => vec![
            "Switch the active Primitive CLI request environment".to_string(),
            String::new(),
            "USAGE".to_string(),
            format!("  {bin} config use <environment>"),
            String::new(),
            "ARGUMENTS".to_string(),
            "  environment  Environment name to use".to_string(),
        ],
        _ => vec![
            "Manage Primitive CLI request environments".to_string(),
            String::new(),
            "USAGE".to_string(),
            format!("  {bin} config [--json] [--show-secrets]"),
            String::new(),
            "FLAGS".to_string(),
            "  --json          Print JSON".to_string(),
            "  --show-secrets  Show header values instead of redacting them".to_string(),
            String::new(),
            "COMMANDS".to_string(),
            "  config list   List Primitive CLI request environments".to_string(),
            "  config set    Set a Primitive CLI request environment".to_string(),
            "  config use    Switch the active Primitive CLI request environment".to_string(),
            "  config reset  Reset Primitive CLI request environments".to_string(),
        ],
    };
    format!("{}\n", lines.join("\n"))
}

#[cfg(test)]
mod tests {
    use super::{
        config_help_text, describe, describe_help_text, list_operations_help_text,
        lookup_operation_with_candidates, print_friendly_command_help, split_command,
    };

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn split_command_uses_longest_generated_and_friendly_prefixes() {
        let values = args(&["agent", "claim", "--email", "user@example.com"]);
        let (command, rest) = split_command(&values).expect("agent claim");
        assert_eq!(command, "agent:claim");
        assert_eq!(rest, &values[2..]);

        let values = args(&["wake", "schedules", "list", "--limit", "2"]);
        let (command, rest) = split_command(&values).expect("wake schedules list");
        assert_eq!(command, "wake:schedules:list");
        assert_eq!(rest, &values[3..]);

        let values = args(&["signin", "otp", "confirm", "user@example.com", "123456"]);
        let (command, rest) = split_command(&values).expect("signin otp confirm");
        assert_eq!(command, "signin:otp:confirm");
        assert_eq!(rest, &values[3..]);
    }

    #[test]
    fn split_command_preserves_parent_topics_when_no_subcommand_matches() {
        let values = args(&["agent"]);
        let (command, rest) = split_command(&values).expect("agent parent");
        assert_eq!(command, "agent");
        assert!(rest.is_empty());

        let values = args(&["config", "--help"]);
        let (command, rest) = split_command(&values).expect("config parent");
        assert_eq!(command, "config");
        assert_eq!(rest, &values[1..]);
    }

    #[test]
    fn generated_help_requests_resolve_before_friendly_shortcuts() {
        let values = args(&["inbox:get-inbox-status", "--help"]);
        let (command, rest) = split_command(&values).expect("inbox status");
        assert_eq!(command, "inbox:get-inbox-status");
        assert_eq!(rest, &values[1..]);
        assert!(super::manifest::lookup_operation(&command).is_some());

        let values = args(&["emails", "get", "--help"]);
        let (command, rest) = split_command(&values).expect("emails get");
        assert_eq!(command, "emails:get");
        assert_eq!(rest, &values[2..]);
        assert!(super::manifest::lookup_operation(&command).is_some());
    }

    #[test]
    fn friendly_help_fallback_accepts_shortcut_commands() {
        assert!(print_friendly_command_help("inbox:setup"));
    }

    #[test]
    fn describe_unknown_operation_includes_did_you_mean_candidates() {
        let error = describe(&args(&["emails:get-emial"])).expect_err("unknown operation");
        let message = error.to_string();
        assert!(message.contains("Unknown operation `emails:get-emial`. Did you mean: "));
        assert!(message.contains("emails:get-email"));
    }

    #[test]
    fn operation_lookup_returns_domain_typo_candidates() {
        let result = lookup_operation_with_candidates("domains:verifyDomian");
        assert!(result.operation.is_none());
        assert!(result
            .candidates
            .contains(&"domains:verify-domain".to_string()));
    }

    #[test]
    fn operation_lookup_limits_candidates() {
        let result = lookup_operation_with_candidates("list");
        assert!(result.operation.is_none());
        assert!(result.candidates.len() <= 5);
    }

    #[test]
    fn operation_lookup_returns_empty_candidates_for_unrelated_input() {
        let result = lookup_operation_with_candidates("zzzzzz:notarealoperation");
        assert!(result.operation.is_none());
        assert!(result.candidates.is_empty());
    }

    #[test]
    fn config_help_text_documents_subcommand_flags() {
        let parent = config_help_text("config");
        assert!(parent.contains("primitive-rust config [--json] [--show-secrets]"));
        assert!(parent.contains("--json"));
        assert!(parent.contains("--show-secrets"));

        let list = config_help_text("config:list");
        assert!(list.contains("primitive-rust config list [--json] [--show-secrets]"));
        assert!(list.contains("--json"));
        assert!(list.contains("--show-secrets"));
        assert!(!list.contains("--environment"));

        let reset = config_help_text("config:reset");
        assert!(reset.contains("primitive-rust config reset [-e <value>]"));
        assert!(reset.contains("-e, --environment <value>"));
        assert!(!reset.contains("--show-secrets"));

        let set = config_help_text("config:set");
        assert!(set.contains("--api-base-url <value>"));
        assert!(set.contains("--header <value>..."));
        assert!(set.contains("--unset-header <value>..."));
    }

    #[test]
    fn utility_help_text_documents_expected_usage() {
        let list = list_operations_help_text();
        assert!(list.contains("list-operations"));
        assert!(list.contains("generated API operations"));

        let describe = describe_help_text();
        assert!(describe.contains("describe <command>"));
        assert!(describe.contains("Command id, alias, or SDK operation name"));
    }
}
