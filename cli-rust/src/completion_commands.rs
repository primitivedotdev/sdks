use crate::help_commands::{expected_command_surface, CommandSource};
use crate::manifest;
use anyhow::{anyhow, Result};
use std::collections::BTreeSet;
use std::io::IsTerminal;

const PUBLIC_COMPLETION_BIN: &str = "primitive";

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || args.iter().any(|arg| is_help_arg(arg)) {
        print!("{}", completion_help_text(PUBLIC_COMPLETION_BIN));
        return Ok(());
    }
    if args.len() != 1 {
        return Err(anyhow!(
            "completion requires exactly one shell: bash, zsh, powershell, or fish"
        ));
    }
    let bin = PUBLIC_COMPLETION_BIN;
    print!(
        "{}",
        completion_command_output(bin, &args[0], std::io::stdout().is_terminal())?
    );
    Ok(())
}

pub fn dispatch_autocomplete(args: &[String]) -> Result<()> {
    if let Some(first) = args.first() {
        if first == "script" {
            return dispatch_autocomplete_script(&args[1..]);
        }
        if first == "create" {
            return dispatch_autocomplete_create(&args[1..]);
        }
    }

    let bin = PUBLIC_COMPLETION_BIN;
    if args.iter().any(|arg| is_help_arg(arg)) {
        print!("{}", autocomplete_help_text(bin));
        return Ok(());
    }

    let positional: Vec<&str> = args
        .iter()
        .filter_map(|arg| {
            let value = arg.as_str();
            if is_refresh_arg(value) {
                None
            } else {
                Some(value)
            }
        })
        .collect();
    if positional.len() > 1 {
        return Err(anyhow!(
            "autocomplete requires at most one shell: zsh, bash, or powershell"
        ));
    }

    let shell = positional.first().copied().unwrap_or("bash");
    if !is_autocomplete_shell(shell) {
        return Err(anyhow!(
            "Expected {shell} to be one of: zsh, bash, powershell"
        ));
    }
    if args.iter().any(|arg| is_refresh_arg(arg)) {
        return Ok(());
    }
    print!("{}", autocomplete_setup_instructions(bin, shell)?);
    Ok(())
}

pub fn completion_help_text(bin: &str) -> String {
    [
        "Output a shell completion script or print setup instructions".to_string(),
        String::new(),
        "USAGE".to_string(),
        format!("  $ {bin} completion SHELL"),
        String::new(),
        "ARGUMENTS".to_string(),
        "  SHELL  (bash|zsh|powershell|fish) Shell type".to_string(),
        String::new(),
        "DESCRIPTION".to_string(),
        "  Output a shell completion script or print setup instructions.".to_string(),
        String::new(),
        "EXAMPLES".to_string(),
        format!("  $ {bin} completion bash >> /etc/bash_completion.d/primitive"),
        String::new(),
        format!("  $ {bin} completion zsh > /usr/local/share/zsh/site-functions/_primitive"),
        String::new(),
        format!("  $ {bin} completion fish > ~/.config/fish/completions/primitive.fish"),
        String::new(),
    ]
    .join("\n")
}

pub fn autocomplete_help_text(bin: &str) -> String {
    [
        "Display autocomplete installation instructions.".to_string(),
        String::new(),
        "USAGE".to_string(),
        format!("  $ {bin} autocomplete [SHELL] [-r]"),
        String::new(),
        "ARGUMENTS".to_string(),
        "  [SHELL]  (zsh|bash|powershell) Shell type".to_string(),
        String::new(),
        "FLAGS".to_string(),
        "  -r, --refresh-cache  Refresh cache (ignores displaying instructions)".to_string(),
        String::new(),
        "DESCRIPTION".to_string(),
        "  Display autocomplete installation instructions.".to_string(),
        String::new(),
        "EXAMPLES".to_string(),
        format!("  $ {bin} autocomplete"),
        String::new(),
        format!("  $ {bin} autocomplete bash"),
        String::new(),
        format!("  $ {bin} autocomplete zsh"),
        String::new(),
        format!("  $ {bin} autocomplete powershell"),
        String::new(),
        format!("  $ {bin} autocomplete --refresh-cache"),
        String::new(),
    ]
    .join("\n")
}

pub fn render_completion(bin: &str, shell: &str) -> Result<String> {
    let commands = completion_words();
    match shell {
        "fish" => Ok(render_fish_completion(bin)),
        "bash" => Ok(render_bash_completion(bin, &commands)),
        "zsh" => Ok(render_zsh_completion(bin, &commands)),
        "powershell" => Ok(render_powershell_completion(bin, &commands)),
        other => Err(anyhow!(
            "unsupported shell `{other}`; expected bash, zsh, powershell, or fish"
        )),
    }
}

pub fn completion_command_output(
    bin: &str,
    shell: &str,
    stdout_is_terminal: bool,
) -> Result<String> {
    match shell {
        "fish" => render_completion(bin, shell),
        "bash" | "zsh" if !stdout_is_terminal => render_completion(bin, shell),
        "bash" | "zsh" | "powershell" => autocomplete_setup_instructions(bin, shell),
        other => render_completion(bin, other),
    }
}

fn completion_words() -> Vec<String> {
    let mut words = BTreeSet::new();
    for entry in expected_command_surface().into_values() {
        match entry.source {
            CommandSource::GeneratedOperation | CommandSource::GeneratedAlias => {
                words.insert(entry.id.replace(':', " "));
                words.insert(entry.id);
            }
            CommandSource::Friendly => {
                words.insert(entry.id.replace(':', " "));
                words.insert(entry.id);
            }
        }
    }
    words.into_iter().collect()
}

fn render_bash_completion(bin: &str, commands: &[String]) -> String {
    let function_name = format!("_{}_completion", shell_ident(bin));
    let words = commands
        .iter()
        .map(|word| shell_single_quote(word))
        .collect::<Vec<_>>()
        .join(" ");
    format!(
        "{function_name}() {{\n  local cur=\"${{COMP_WORDS[COMP_CWORD]}}\"\n  COMPREPLY=( $(compgen -W \"{words}\" -- \"$cur\") )\n}}\ncomplete -F {function_name} {bin}\n"
    )
}

fn render_zsh_completion(bin: &str, commands: &[String]) -> String {
    let words = commands
        .iter()
        .map(|word| shell_single_quote(word))
        .collect::<Vec<_>>()
        .join(" ");
    format!("#compdef {bin}\n_arguments '1:command:(({words}))'\n")
}

fn render_powershell_completion(bin: &str, commands: &[String]) -> String {
    let words = commands
        .iter()
        .map(|word| format!("'{}'", word.replace('\'', "''")))
        .collect::<Vec<_>>()
        .join(", ");
    format!(
        "Register-ArgumentCompleter -Native -CommandName {bin} -ScriptBlock {{\n  param($wordToComplete)\n  @({words}) | Where-Object {{ $_ -like \"$wordToComplete*\" }} | ForEach-Object {{ [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }}\n}}\n"
    )
}

fn render_fish_completion(bin: &str) -> String {
    let ident = shell_ident(bin);
    let mut lines = vec![
        format!("function __fish_{ident}_needs_command"),
        "  set -l cmd (commandline -opc)".to_string(),
        "  test (count $cmd) -le 1".to_string(),
        "end".to_string(),
        String::new(),
        format!("function __fish_{ident}_topic_needs_subcommand"),
        "  set -l cmd (commandline -opc)".to_string(),
        "  test (count $cmd) -eq 2".to_string(),
        "  and test \"$cmd[2]\" = \"$argv[1]\"".to_string(),
        "end".to_string(),
        String::new(),
        format!("function __fish_{ident}_using_operation"),
        "  set -l cmd (commandline -opc)".to_string(),
        "  test (count $cmd) -ge 3".to_string(),
        "  and test \"$cmd[2]\" = \"$argv[1]\"".to_string(),
        "  and test \"$cmd[3]\" = \"$argv[2]\"".to_string(),
        "end".to_string(),
        String::new(),
        format!("function __fish_{ident}_using_root_command"),
        "  set -l cmd (commandline -opc)".to_string(),
        "  test (count $cmd) -eq 2".to_string(),
        "  and test \"$cmd[2]\" = \"$argv[1]\"".to_string(),
        "end".to_string(),
        String::new(),
        format!("complete -c {bin} -f -n '__fish_{ident}_needs_command' -a 'list-operations' -d 'List all generated API operations'"),
        format!("complete -c {bin} -f -n '__fish_{ident}_needs_command' -a 'completion' -d 'Show shell completion output or installation instructions'"),
        format!("complete -c {bin} -f -n '__fish_{ident}_needs_command' -a 'autocomplete' -d 'Install or display shell autocomplete for bash, zsh, and powershell'"),
        format!("complete -c {bin} -f -n '__fish_{ident}_needs_command' -a 'help' -d 'Display help for {bin}'"),
    ];

    let mut top_level_topics = Vec::new();
    for operation in manifest::operation_manifest() {
        if !top_level_topics.contains(&operation.tag_command) {
            top_level_topics.push(operation.tag_command.clone());
        }
    }

    for topic in &top_level_topics {
        lines.push(format!(
            "complete -c {bin} -f -n '__fish_{ident}_needs_command' -a '{}' -d '{}'",
            fish_escape(topic),
            fish_escape(node_topic_summary(topic).unwrap_or(topic))
        ));
    }

    lines.push(format!(
        "complete -c {bin} -f -n '__fish_{ident}_using_root_command completion' -a 'bash zsh powershell fish' -d 'Shell type'"
    ));

    for topic in &top_level_topics {
        for operation in manifest::operation_manifest()
            .iter()
            .filter(|operation| operation.tag_command == *topic)
        {
            let summary = operation.summary.as_deref().map_or_else(
                || format!("{} {}", operation.method, operation.path),
                str::to_string,
            );
            lines.push(format!(
                "complete -c {bin} -f -n '__fish_{ident}_topic_needs_subcommand {}' -a '{}' -d '{}'",
                fish_escape(topic),
                fish_escape(&operation.command),
                fish_escape(&summary)
            ));

            for parameter in operation
                .path_params
                .iter()
                .chain(operation.query_params.iter())
            {
                lines.push(format!(
                    "complete -c {bin} -n '{}' -l '{}' -r -d '{}'",
                    operation_condition(bin, operation),
                    fish_escape(&parameter.name.replace('_', "-")),
                    fish_escape(parameter.description.as_deref().unwrap_or(&parameter.name))
                ));
            }

            lines.push(format!(
                "complete -c {bin} -n '{}' -l 'api-key' -r -d 'Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)'",
                operation_condition(bin, operation)
            ));

            if !operation.binary_response {
                lines.push(format!(
                    "complete -c {bin} -n '{}' -l 'envelope' -d 'Print the full response envelope, including pagination metadata'",
                    operation_condition(bin, operation)
                ));
            }

            if operation.has_json_body {
                lines.push(format!(
                    "complete -c {bin} -n '{}' -l 'body' -r -d 'JSON request body'",
                    operation_condition(bin, operation)
                ));
                lines.push(format!(
                    "complete -c {bin} -n '{}' -l 'body-file' -r -d 'Path to a JSON file used as the request body'",
                    operation_condition(bin, operation)
                ));
            }

            if operation.binary_response {
                lines.push(format!(
                    "complete -c {bin} -n '{}' -l 'output' -r -d 'Write binary response bytes to a file'",
                    operation_condition(bin, operation)
                ));
            }
        }
    }

    lines.push(format!(
        "complete -c {bin} -l help -d 'Show help for {bin}'"
    ));
    lines.push(format!(
        "complete -c {bin} -l version -d 'Show version for {bin}'"
    ));
    format!("{}\n\n", lines.join("\n"))
}

fn operation_condition(bin: &str, operation: &manifest::OperationManifest) -> String {
    format!(
        "__fish_{}_using_operation {} {}",
        shell_ident(bin),
        fish_escape(&operation.tag_command),
        fish_escape(&operation.command)
    )
}

fn node_topic_summary(topic: &str) -> Option<&'static str> {
    match topic {
        "account" => Some("Manage your account settings, storage, and webhook secret"),
        "agent" => Some("Agent signup and authentication"),
        "cli" => Some("Browser-assisted CLI authentication"),
        "domains" => Some("Claim, verify, and manage email domains"),
        "emails" => Some("List, inspect, and manage received emails"),
        "endpoints" => Some("Manage webhook endpoints that receive email events"),
        "filters" => Some("Manage whitelist and blocklist filter rules"),
        "functions" => Some("Deploy JavaScript handlers that run on inbound mail. Each function\nis a single ESM module whose default export is an object with an\nasync `fetch(request, env)` method, in the shape of a Workers-style\nhandler. Primitive signs each delivery and forwards the\n`Primitive-Signature` header to the handler; verify the raw request\nbody with `PRIMITIVE_WEBHOOK_SECRET` before trusting the parsed event.\nThe `event` field is `email.received` for normal inbound mail, or a\nmachine-mail type (`email.bounced`, `email.tls_report`,\n`email.dmarc_report`, `email.dmarc_failure`) for bounces and reports;\nthe payload shape is otherwise identical. Code runs on\nPrimitive's edge runtime; there is no infrastructure to manage.\nSecrets land in `env` as encrypted bindings and are refreshed on\nevery redeploy.\n"),
        "inbox" => Some("Check inbound email setup and processing readiness"),
        "memories" => Some("Durable org-scoped or function-scoped JSON key-value storage for\nagents and functions. Keys are caller-defined. Function scope is\nalways addressed by the function id UUID, not by function name.\n"),
        "payments" => Some("Collect and pay stablecoin (USDC) payments with x402. Settlement is\nnon-custodial: funds move directly from payer to payee on-chain via an\nEIP-3009 authorization the payer signs with their own key, and Primitive\nnever holds funds. The payee registers a payout address and creates a\nchallenge; the payer signs and settles it under a configurable spend\npolicy (kill-switch, per-payment and per-day caps, payee allowlist).\n"),
        "registries" => Some("The Agent Registry: ownable directories of agents, addressable by a\nregistry-scoped handle. A registry's publish policy (owner_only, request,\nor open) decides whether a publish lists immediately or pends owner\napproval. An agent is defined once with a globally unique,\nreachability-verified address, then published into any registry under a\nhandle. Discovery reads (list, resolve, get) are public for public\nregistries; managing a registry and moderating requests use the owner's\nAPI key.\n"),
        "routes" => Some("Recipient routing: route inbound mail to a single destination per recipient\naddress. Rules bind an address pattern (exact or wildcard) to an endpoint;\n`function_id` routes an address to a function, minting its route-target\nendpoint.\n"),
        "search" => Some("Semantic and hybrid search across received and sent mail"),
        "sending" => Some("Send outbound emails through the Primitive API"),
        "templates" => {
            Some("Browse approved Function templates, install deploy-mode templates, and\npoll install progress.\n")
        }
        "threads" => Some("Conversation threads spanning received and sent emails"),
        "wake" => Some("Wake scheduling: schedule and send typed wake commands to your own\nfunctions over real DKIM-signed email on a cron cadence, and manage the\nper-target allowlist that authorizes which senders may wake a function.\n"),
        "webhook-deliveries" => Some("View and replay webhook delivery attempts"),
        _ => None,
    }
}

fn shell_ident(value: &str) -> String {
    value.replace('-', "_")
}

fn shell_single_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn fish_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('\'', "\\'")
}

fn dispatch_autocomplete_script(args: &[String]) -> Result<()> {
    let bin = PUBLIC_COMPLETION_BIN;
    if args.iter().any(|arg| is_help_arg(arg)) {
        print!("{}", autocomplete_script_help_text(bin));
        return Ok(());
    }
    if args.len() > 1 {
        return Err(anyhow!(
            "autocomplete script requires at most one shell: zsh, bash, or powershell"
        ));
    }
    let shell = args.first().map(String::as_str).unwrap_or("bash");
    if !is_autocomplete_shell(shell) {
        return Err(anyhow!(
            "Expected {shell} to be one of: zsh, bash, powershell"
        ));
    }
    print!("{}", autocomplete_setup_script(bin, shell)?);
    Ok(())
}

fn dispatch_autocomplete_create(args: &[String]) -> Result<()> {
    let bin = PUBLIC_COMPLETION_BIN;
    if args.iter().any(|arg| is_help_arg(arg)) {
        print!("{}", autocomplete_create_help_text(bin));
        return Ok(());
    }
    if !args.is_empty() {
        return Err(anyhow!("autocomplete create does not accept arguments"));
    }
    Ok(())
}

fn autocomplete_script_help_text(bin: &str) -> String {
    [
        "outputs autocomplete config script for shells".to_string(),
        String::new(),
        "USAGE".to_string(),
        format!("  $ {bin} autocomplete script [SHELL]"),
        String::new(),
        "ARGUMENTS".to_string(),
        "  [SHELL]  (zsh|bash|powershell) Shell type".to_string(),
        String::new(),
        "DESCRIPTION".to_string(),
        "  outputs autocomplete config script for shells".to_string(),
        String::new(),
    ]
    .join("\n")
}

fn autocomplete_create_help_text(bin: &str) -> String {
    [
        "create autocomplete setup scripts and completion functions".to_string(),
        String::new(),
        "USAGE".to_string(),
        format!("  $ {bin} autocomplete create"),
        String::new(),
        "DESCRIPTION".to_string(),
        "  create autocomplete setup scripts and completion functions".to_string(),
        String::new(),
    ]
    .join("\n")
}

fn autocomplete_setup_instructions(bin: &str, shell: &str) -> Result<String> {
    let title = format!(
        "Setup Instructions for {} CLI Autocomplete ---",
        bin.to_uppercase()
    );
    let script_command = format!("{bin} autocomplete script {shell}");
    let body = match shell {
        "bash" => format!(
            "{title}\n==============================================\n\n1) Run this command in your terminal window:\n\n  printf \"$({script_command})\" >> ~/.bashrc; source ~/.bashrc\n\n2) Start using autocomplete:\n\n  {bin} <TAB><TAB>                  # Command completion\n  {bin} command --<TAB><TAB>        # Flag completion\n\n  Enjoy!\n"
        ),
        "zsh" => format!(
            "{title}\n==============================================\n\n1) Run this command in your terminal window:\n\n  printf \"$({script_command})\" >> ~/.zshrc; source ~/.zshrc\n\n2) Start using autocomplete:\n\n  {bin} <TAB>                  # Command completion\n  {bin} command --<TAB>        # Flag completion\n\n  Enjoy!\n"
        ),
        "powershell" => format!(
            "{title}\n==============================================\n\n1) Run this cmdlet in your PowerShell window:\n\n  Add-Content -Path $PROFILE -Value (Invoke-Expression -Command \"{script_command}\"); .$PROFILE\n\n2) Start using autocomplete:\n\n  {bin} <TAB>                  # Command completion\n  {bin} command --<TAB>        # Flag completion\n\n  Enjoy!\n"
        ),
        other => {
            return Err(anyhow!(
                "Expected {other} to be one of: zsh, bash, powershell"
            ));
        }
    };
    Ok(body)
}

fn autocomplete_setup_script(bin: &str, shell: &str) -> Result<String> {
    match shell {
        "bash" | "zsh" => Ok(format!(
            "eval \"$({bin} completion {shell})\"; # {bin} autocomplete setup\n"
        )),
        "powershell" => Ok(format!(
            "Invoke-Expression (& {bin} completion powershell); # {bin} autocomplete setup\n"
        )),
        other => Err(anyhow!(
            "Expected {other} to be one of: zsh, bash, powershell"
        )),
    }
}

fn is_help_arg(value: &str) -> bool {
    matches!(value, "--help" | "-h" | "help")
}

fn is_refresh_arg(value: &str) -> bool {
    matches!(value, "--refresh-cache" | "-r")
}

fn is_autocomplete_shell(value: &str) -> bool {
    matches!(value, "zsh" | "bash" | "powershell")
}
