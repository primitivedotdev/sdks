use primitive_rust::agent_commands::{
    agent_upgrade_help_text, build_agent_upgrade_plan, build_start_agent_claim_request,
    build_verify_agent_claim_request, is_agent_friendly_command, prompt_required_from,
    AgentUpgradePlan, ApiRequest,
};
use serde_json::json;
use std::collections::BTreeMap;
use std::io::Cursor;

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

#[test]
fn upgrade_plan_parses_auth_email_and_code_flags() {
    let plan = build_agent_upgrade_plan(&args(&[
        "--email",
        "agent@example.com",
        "--code=123456",
        "--api-key",
        "prim_test",
        "--api-base-url=https://api.example.test/v1",
    ]))
    .expect("upgrade plan");

    assert_eq!(
        plan,
        AgentUpgradePlan {
            auth: BTreeMap::from([
                (
                    "api-base-url".to_string(),
                    "https://api.example.test/v1".to_string()
                ),
                ("api-key".to_string(), "prim_test".to_string()),
            ]),
            code: Some("123456".to_string()),
            email: Some("agent@example.com".to_string()),
        }
    );
}

#[test]
fn upgrade_plan_rejects_positionals_and_unknown_flags() {
    let positional = build_agent_upgrade_plan(&args(&["agent@example.com"]))
        .expect_err("positionals should be rejected");
    assert!(positional.to_string().contains("Unexpected argument"));

    let unknown =
        build_agent_upgrade_plan(&args(&["--json"])).expect_err("unknown flags should fail");
    assert!(unknown.to_string().contains("Unknown flag --json"));

    let missing =
        build_agent_upgrade_plan(&args(&["--email"])).expect_err("missing value should fail");
    assert!(missing.to_string().contains("Missing value for --email"));
}

#[test]
fn upgrade_requests_match_agent_claim_api_contract() {
    assert!(is_agent_friendly_command("agent:upgrade"));
    assert!(!is_agent_friendly_command("agent:create-agent-account"));

    assert_eq!(
        build_start_agent_claim_request("agent@example.com"),
        ApiRequest {
            method: "POST".to_string(),
            path: "/agent/claim/start".to_string(),
            body: json!({ "email": "agent@example.com" }),
        }
    );
    assert_eq!(
        build_verify_agent_claim_request("123456"),
        ApiRequest {
            method: "POST".to_string(),
            path: "/agent/claim/verify".to_string(),
            body: json!({ "verification_code": "123456" }),
        }
    );
}

#[test]
fn upgrade_help_documents_node_visible_flags() {
    let help = agent_upgrade_help_text();
    for expected in [
        "agent upgrade",
        "--api-base-url <value>",
        "--api-key <value>",
        "--code <value>",
        "--email <value>",
    ] {
        assert!(help.contains(expected), "{expected}");
    }
}

#[test]
fn prompt_required_retries_empty_answers_on_stderr_writer() {
    let mut input = Cursor::new("\n  \n123456\n");
    let mut output = Vec::new();

    let answer =
        prompt_required_from("Verification code: ", &mut input, &mut output).expect("prompt");

    assert_eq!(answer, "123456");
    assert_eq!(
        String::from_utf8(output).expect("utf8"),
        "Verification code: Verification code: Verification code: "
    );
}
