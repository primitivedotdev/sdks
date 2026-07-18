use primitive_rust::completion_commands::{
    autocomplete_help_text, completion_help_text, render_completion,
};

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

#[test]
fn fish_completion_includes_root_and_generated_subcommands() {
    let script = render_completion("primitive-rust", "fish").expect("fish completion");
    assert!(script.contains("__fish_primitive_rust_needs_command"));
    assert!(script.contains("-a 'completion'"));
    assert!(script.contains("-a 'autocomplete'"));
    assert!(script.contains("-a 'sending'"));
    assert!(script.contains("-a 'send-email'"));
    assert!(script.contains("-a 'send'"));
    assert!(script.contains("-l help"));
}

#[test]
fn bash_zsh_and_powershell_completions_are_sourceable_scripts() {
    let bash = render_completion("primitive-rust", "bash").expect("bash completion");
    assert!(bash.contains("complete -F _primitive_rust_completion primitive-rust"));
    assert!(bash.contains("'autocomplete'"));
    assert!(bash.contains("sending send-email"));

    let zsh = render_completion("primitive-rust", "zsh").expect("zsh completion");
    assert!(zsh.starts_with("#compdef primitive-rust"));
    assert!(zsh.contains("list-operations"));
    assert!(zsh.contains("autocomplete"));

    let powershell =
        render_completion("primitive-rust", "powershell").expect("powershell completion");
    assert!(powershell.contains("Register-ArgumentCompleter"));
    assert!(powershell.contains("'completion'"));
    assert!(powershell.contains("'autocomplete'"));
}

#[test]
fn public_command_names_render_public_completions() {
    let fish = render_completion("primitive", "fish").expect("primitive fish completion");
    assert!(fish.contains("__fish_primitive_needs_command"));
    assert!(fish.contains("complete -c primitive"));
    assert!(!fish.contains("primitive-rust"));

    let prim = render_completion("prim", "bash").expect("prim bash completion");
    assert!(prim.contains("complete -F _prim_completion prim"));
    assert!(prim.contains("sending send-email"));
}

#[test]
fn rejects_unknown_shells() {
    let error = render_completion("primitive-rust", "xonsh").expect_err("unsupported shell");
    assert!(error.to_string().contains("unsupported shell"));
}

#[test]
fn autocomplete_help_matches_node_plugin_surface() {
    let help = autocomplete_help_text("primitive");
    assert!(help.contains("Display autocomplete installation instructions."));
    assert!(help.contains("$ primitive autocomplete [SHELL] [-r]"));
    assert!(help.contains("[SHELL]  (zsh|bash|powershell) Shell type"));
    assert!(help.contains("-r, --refresh-cache"));
}

#[test]
fn completion_help_keeps_fish_on_completion_command() {
    let help = completion_help_text("primitive");
    assert!(help.contains("$ primitive completion SHELL"));
    assert!(help.contains("(bash|zsh|powershell|fish)"));
}

#[test]
fn autocomplete_help_dispatch_forms_are_accepted() {
    primitive_rust::friendly::dispatch(args(&["autocomplete", "--help"]))
        .expect("autocomplete help");
    primitive_rust::friendly::dispatch(args(&["autocomplete", "bash", "--help"]))
        .expect("autocomplete bash help");
    primitive_rust::friendly::dispatch(args(&["help", "autocomplete"])).expect("help autocomplete");
    primitive_rust::friendly::dispatch(args(&["autocomplete:script", "--help"]))
        .expect("autocomplete script help");
    primitive_rust::friendly::dispatch(args(&["script:autocomplete", "--help"]))
        .expect("script autocomplete help");
    primitive_rust::friendly::dispatch(args(&["autocomplete:create", "--help"]))
        .expect("autocomplete create help");
    primitive_rust::friendly::dispatch(args(&["create:autocomplete", "--help"]))
        .expect("create autocomplete help");
}

#[test]
fn autocomplete_rejects_fish_like_node_plugin() {
    let error = primitive_rust::friendly::dispatch(args(&["autocomplete", "fish"]))
        .expect_err("fish is not an autocomplete plugin shell");
    assert!(error.to_string().contains("zsh, bash, powershell"));
}
