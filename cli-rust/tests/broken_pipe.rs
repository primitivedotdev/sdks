#[cfg(unix)]
#[test]
fn list_operations_tolerates_closed_stdout_pipe() {
    let binary = env!("CARGO_BIN_EXE_primitive");
    let status = std::process::Command::new("bash")
        .arg("-o")
        .arg("pipefail")
        .arg("-c")
        .arg("\"$1\" list-operations | head -n 1 >/dev/null")
        .arg("_")
        .arg(binary)
        .status()
        .expect("run primitive with closed stdout pipe");

    assert!(
        status.success(),
        "primitive should exit cleanly when stdout closes early"
    );
}
