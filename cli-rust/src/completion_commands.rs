use crate::help_commands::{expected_command_surface, CommandSource};
use crate::manifest;
use anyhow::{anyhow, Result};
use std::collections::BTreeSet;

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || args.iter().any(|arg| is_help_arg(arg)) {
        print!("{}", completion_help_text(&crate::display_bin_name()));
        return Ok(());
    }
    if args.len() != 1 {
        return Err(anyhow!(
            "completion requires exactly one shell: bash, zsh, powershell, or fish"
        ));
    }
    let bin = crate::display_bin_name();
    let script = render_completion(&bin, &args[0])?;
    print!("{script}");
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

    let bin = crate::display_bin_name();
    if args.iter().any(|arg| is_help_arg(arg)) {
        print!("{}", autocomplete_help_text(&bin));
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
    print!("{}", autocomplete_setup_instructions(&bin, shell)?);
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
    let mut lines = vec![
        format!("function __fish_{}_needs_command", shell_ident(bin)),
        "  set -l cmd (commandline -opc)".to_string(),
        "  test (count $cmd) -le 1".to_string(),
        "end".to_string(),
        String::new(),
        format!(
            "function __fish_{}_topic_needs_subcommand",
            shell_ident(bin)
        ),
        "  set -l cmd (commandline -opc)".to_string(),
        "  test (count $cmd) -eq 2".to_string(),
        "  and test \"$cmd[2]\" = \"$argv[1]\"".to_string(),
        "end".to_string(),
        String::new(),
    ];

    let mut root_commands = BTreeSet::new();
    for entry in expected_command_surface().into_values() {
        if let Some((root, _)) = entry.id.split_once(':') {
            root_commands.insert(root.to_string());
        } else {
            root_commands.insert(entry.id);
        }
    }
    for root in root_commands {
        lines.push(format!(
            "complete -c {bin} -f -n '__fish_{}_needs_command' -a '{}' -d '{}'",
            shell_ident(bin),
            fish_escape(&root),
            fish_escape(root_summary(&root))
        ));
    }

    let mut topic_pairs = BTreeSet::new();
    for operation in manifest::operation_manifest() {
        topic_pairs.insert((
            operation.tag_command.clone(),
            operation.command.clone(),
            operation
                .summary
                .clone()
                .unwrap_or_else(|| format!("{} {}", operation.method, operation.path)),
        ));
    }
    for alias in manifest::aliases() {
        if let Some((topic, command)) = alias.0.split_once(':') {
            topic_pairs.insert((
                topic.to_string(),
                command.to_string(),
                format!("Alias for {}", alias.1),
            ));
        }
    }
    for entry in expected_command_surface().into_values() {
        if entry.source == CommandSource::Friendly {
            if let Some((topic, command)) = entry.id.split_once(':') {
                topic_pairs.insert((
                    topic.to_string(),
                    command.to_string(),
                    entry.summary.unwrap_or_else(|| entry.id.clone()),
                ));
            }
        }
    }
    for (topic, command, summary) in topic_pairs {
        lines.push(format!(
            "complete -c {bin} -f -n '__fish_{}_topic_needs_subcommand {}' -a '{}' -d '{}'",
            shell_ident(bin),
            fish_escape(&topic),
            fish_escape(&command),
            fish_escape(&summary)
        ));
    }

    lines.push(format!(
        "complete -c {bin} -l help -d 'Show help for {bin}'"
    ));
    lines.push(format!(
        "complete -c {bin} -l version -d 'Show version for {bin}'"
    ));
    format!("{}\n", lines.join("\n"))
}

fn root_summary(root: &str) -> &str {
    match root {
        "autocomplete" => "Install or display shell autocomplete for bash, zsh, and powershell",
        "completion" => "Show shell completion output or installation instructions",
        "list-operations" => "List generated API operations",
        "describe" => "Describe an API operation",
        "config" => "Manage request environments",
        "doctor" => "Run CLI diagnostics",
        other => other,
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
    let bin = crate::display_bin_name();
    if args.iter().any(|arg| is_help_arg(arg)) {
        print!("{}", autocomplete_script_help_text(&bin));
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
    print!("{}", autocomplete_setup_script(&bin, shell)?);
    Ok(())
}

fn dispatch_autocomplete_create(args: &[String]) -> Result<()> {
    let bin = crate::display_bin_name();
    if args.iter().any(|arg| is_help_arg(arg)) {
        print!("{}", autocomplete_create_help_text(&bin));
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
