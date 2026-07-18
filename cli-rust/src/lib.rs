pub mod agent_commands;
pub mod api;
pub mod auth_commands;
pub mod client;
pub mod completion_commands;
pub mod config;
pub mod doctor_commands;
pub mod domains_commands;
pub mod emails_commands;
pub mod friendly;
pub mod functions_commands;
pub mod help_commands;
pub mod inbox_commands;
pub mod mail_commands;
pub mod manifest;
pub mod memories_commands;
pub mod org_secrets;
pub mod payloads;
pub mod payments;
pub mod routes_commands;
pub mod search_commands;
pub mod wake_commands;
pub mod x402;

mod root_startup;

pub const BIN_NAME: &str = "primitive-rust";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const USER_AGENT: &str = concat!("primitive-rust/", env!("CARGO_PKG_VERSION"));

pub fn main_entry() {
    install_broken_pipe_panic_hook();

    match std::panic::catch_unwind(run_from_env) {
        Ok(Ok(())) => {}
        Ok(Err(error)) => {
            if is_broken_pipe_error(&error) {
                return;
            }
            eprintln!("{error}");
            std::process::exit(1);
        }
        Err(payload) => {
            if panic_payload_is_broken_pipe(payload.as_ref()) {
                return;
            }
            std::panic::resume_unwind(payload);
        }
    }
}

pub fn run_from_env() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    root_startup::write_root_auth_context_if_needed(&args);
    friendly::dispatch(args)
}

pub fn display_bin_name() -> String {
    display_bin_name_from_path(std::env::args_os().next())
}

pub fn display_bin_name_from_path(path: Option<std::ffi::OsString>) -> String {
    path.and_then(|path| {
        std::path::PathBuf::from(path)
            .file_name()
            .and_then(|name| name.to_str())
            .map(|name| {
                name.strip_suffix(".exe")
                    .or_else(|| name.strip_suffix(".EXE"))
                    .unwrap_or(name)
                    .to_string()
            })
    })
    .filter(|name| matches!(name.as_str(), "primitive" | "prim" | "primitive-rust"))
    .unwrap_or_else(|| BIN_NAME.to_string())
}

fn install_broken_pipe_panic_hook() {
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        if panic_payload_is_broken_pipe(info.payload()) {
            return;
        }
        default_hook(info);
    }));
}

fn is_broken_pipe_error(error: &anyhow::Error) -> bool {
    error.chain().any(|cause| {
        cause
            .downcast_ref::<std::io::Error>()
            .is_some_and(|error| error.kind() == std::io::ErrorKind::BrokenPipe)
    }) || error.to_string().contains("Broken pipe")
}

fn panic_payload_is_broken_pipe(payload: &(dyn std::any::Any + Send)) -> bool {
    payload
        .downcast_ref::<&str>()
        .is_some_and(|message| message.contains("Broken pipe"))
        || payload
            .downcast_ref::<String>()
            .is_some_and(|message| message.contains("Broken pipe"))
}

#[cfg(test)]
mod tests {
    use super::{display_bin_name_from_path, panic_payload_is_broken_pipe, BIN_NAME};
    use std::ffi::OsString;

    #[test]
    fn display_bin_name_accepts_public_and_dev_names() {
        assert_eq!(
            display_bin_name_from_path(Some(OsString::from("/tmp/primitive"))),
            "primitive"
        );
        assert_eq!(
            display_bin_name_from_path(Some(OsString::from("/tmp/prim"))),
            "prim"
        );
        assert_eq!(
            display_bin_name_from_path(Some(OsString::from("/tmp/primitive-rust"))),
            "primitive-rust"
        );
        assert_eq!(
            display_bin_name_from_path(Some(OsString::from("/tmp/primitive.exe"))),
            "primitive"
        );
        assert_eq!(
            display_bin_name_from_path(Some(OsString::from("/tmp/prim.EXE"))),
            "prim"
        );
        assert_eq!(
            display_bin_name_from_path(Some(OsString::from("/tmp/test-binary"))),
            BIN_NAME
        );
    }

    #[test]
    fn detects_broken_pipe_panic_payloads() {
        let payload = "failed printing to stdout: Broken pipe (os error 32)";
        assert!(panic_payload_is_broken_pipe(&payload));

        let payload = String::from("failed printing to stdout: Broken pipe (os error 32)");
        assert!(panic_payload_is_broken_pipe(&payload));
    }
}
