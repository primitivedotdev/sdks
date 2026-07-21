use primitive_rust::auth_commands::{
    account_with_managed_inbox_domain, auth_flags_from_command, auth_help_text,
    browser_login_start_output, build_cli_logout_body, build_poll_cli_login_body,
    build_resend_agent_signup_body, build_start_agent_signup_body, build_start_cli_login_body,
    build_verify_agent_signup_body, chat_state_path, continue_pending_start_output,
    credentials_lock_path, credentials_path, decide_existing_credentials_before_auth,
    decide_pending_start, decide_pending_state, decide_poll_error,
    decide_required_pending_for_email, decide_resend_result, decide_verify_result, dispatch,
    dispatch_auth_command, execute_auth_command_with, format_signup_seconds, identify_auth_command,
    initial_poll_interval_seconds, is_auth_friendly_command, managed_inbox_domain_from_domains,
    pending_signup_path, pending_signup_status, plan_auth_command_request,
    plan_browser_login_credentials_write, plan_browser_login_poll_request,
    plan_browser_login_start_request, plan_confirm_email_code_request, plan_logout_request,
    plan_resend_email_code_request, plan_signup_credentials_write, plan_start_email_code_request,
    plan_whoami_domains_request, resend_email_code_output, serialize_credentials,
    serialize_pending_signup, signup_status_output, start_email_code_output,
    AgentSignupResendResult, AgentSignupStartResult, AgentSignupVerifyResult, AuthApiResponse,
    AuthCommand, AuthCommandId, AuthCommandRequestContext, AuthCommandRequestPlan,
    AuthExecutionContext, AuthRequestBody, AuthRequestPlan, AuthRuntimeHttp, AuthRuntimeIo,
    BrowserLoginFlags, BrowserLoginVerb, CliLoginPollResult, CliLoginStartResult,
    ConfirmEmailCodeFlags, EmailCodeFlow, ExistingCredentialDecision, ExistingLoginProbeStatus,
    PendingAgentSignup, PendingStartDecision, PendingStateDecision, PollDecision,
    RequiredPendingDecision, ResendDecision, ResendEmailCodeFlags, StartEmailCodeFlags,
    StoredCliCredentials, VerifyDecision, WhoamiFlags,
};
use serde_json::{json, Value};
use std::collections::{BTreeMap, VecDeque};
use std::time::{Duration, UNIX_EPOCH};

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

fn json_body(value: Value) -> Option<AuthRequestBody> {
    Some(AuthRequestBody::Json(value))
}

fn pending(email: &str) -> PendingAgentSignup {
    PendingAgentSignup {
        api_base_url: "https://api.primitive.dev/v1".to_string(),
        created_at: "2026-07-17T12:00:00.000Z".to_string(),
        email: email.to_string(),
        expires_at: "2026-07-17T12:10:00.000Z".to_string(),
        expires_in: 600,
        resend_after: 30,
        signup_token: "signup-token".to_string(),
        verification_code_length: 6,
    }
}

fn credentials(org_name: Option<&str>) -> StoredCliCredentials {
    StoredCliCredentials {
        auth_method: "oauth".to_string(),
        access_token: "access".to_string(),
        refresh_token: "refresh".to_string(),
        token_type: "Bearer".to_string(),
        expires_at: "2026-07-17T13:00:00.000Z".to_string(),
        oauth_grant_id: "grant-id".to_string(),
        oauth_client_id: "client-id".to_string(),
        org_id: "org-id".to_string(),
        org_name: org_name.map(str::to_string),
        api_base_url: "https://api.primitive.dev/v1".to_string(),
        created_at: "2026-07-17T12:00:00.000Z".to_string(),
    }
}

#[test]
fn auth_help_requests_return_before_argument_validation() {
    for (command, values) in [
        ("login", ["--help"].as_slice()),
        ("signin:otp", ["--help"].as_slice()),
        ("whoami", ["--api-key", "prim_test", "--help"].as_slice()),
        ("logout", ["--force", "--help"].as_slice()),
        ("login:otp:confirm", ["--help"].as_slice()),
        ("signup:confirm", ["--help"].as_slice()),
    ] {
        primitive_rust::auth_commands::execute_command(command, &args(values))
            .unwrap_or_else(|error| panic!("{command} {values:?} should print help: {error}"));
    }
}

struct AuthHelpCase {
    args: &'static [&'static str],
    command: &'static str,
    contains: &'static [&'static str],
    not_contains: &'static [&'static str],
}

#[test]
fn auth_help_text_is_command_specific_for_focused_auth_commands() {
    let cases = [
        AuthHelpCase {
            command: "login",
            args: &["--help"],
            contains: &[
                "Log in to an existing account",
                "primitive-rust login [EMAIL]",
                "--device-name=<value>",
                "--no-browser",
                "--accept-terms",
                "--signup-code=<value>",
                "login otp      Start OTP login",
            ],
            not_contains: &["Primitive Rust CLI auth commands", "--api-base-url"],
        },
        AuthHelpCase {
            command: "signin",
            args: &["--help"],
            contains: &[
                "Sign in to an existing account",
                "primitive-rust signin [EMAIL]",
                "--device-name=<value>",
                "--no-browser",
                "--accept-terms",
                "--signup-code=<value>",
                "signin otp      Start OTP sign-in",
            ],
            not_contains: &["Primitive Rust CLI auth commands", "--api-base-url"],
        },
        AuthHelpCase {
            command: "otp",
            args: &["--help"],
            contains: &[
                "Start email-code auth",
                "primitive-rust otp [EMAIL]",
                "--accept-terms",
                "--device-name=<value>",
                "--signup-code=<value>",
                "otp confirm  Confirm email-code auth",
            ],
            not_contains: &["--no-browser", "--api-base-url"],
        },
        AuthHelpCase {
            command: "signup",
            args: &["--help"],
            contains: &[
                "Start account signup",
                "primitive-rust signup [EMAIL]",
                "--accept-terms",
                "--device-name=<value>",
                "--signup-code=<value>",
                "Optional signup code",
                "signup confirm      Confirm account signup",
            ],
            not_contains: &["--no-browser", "--api-base-url"],
        },
        AuthHelpCase {
            command: "logout",
            args: &["--help"],
            contains: &[
                "Log out and revoke the saved CLI OAuth grant",
                "primitive-rust logout [-f]",
                "-f, --force",
            ],
            not_contains: &["--json", "--api-base-url"],
        },
        AuthHelpCase {
            command: "whoami",
            args: &["--help"],
            contains: &[
                "Print the authenticated account",
                "primitive-rust whoami [--api-key <value>] [--json] [--time]",
                "--api-key=<value>",
                "--json",
                "--time",
            ],
            not_contains: &["--force", "--api-base-url"],
        },
        AuthHelpCase {
            command: "login:otp:confirm",
            args: &["--help"],
            contains: &[
                "Confirm OTP login",
                "primitive-rust login otp confirm <email> <code>",
                "--org-id=<value>",
                "-f, --force",
            ],
            not_contains: &[
                "Primitive Rust CLI auth commands",
                "--code-from-env",
                "--api-base-url",
            ],
        },
        AuthHelpCase {
            command: "signup:confirm",
            args: &["--help"],
            contains: &[
                "Confirm account signup",
                "primitive-rust signup confirm <email> [code]",
                "--code-from-stdin",
                "--code-from-file=<path>",
                "--code-from-env=<name>",
                "--org-id=<value>",
                "-f, --force",
            ],
            not_contains: &["Primitive Rust CLI auth commands", "--api-base-url"],
        },
    ];

    for case in cases {
        let help = auth_help_text(case.command, &args(case.args));
        for expected in case.contains {
            assert!(
                help.contains(expected),
                "{} help should contain {expected:?}; help:\n{help}",
                case.command
            );
        }
        for unexpected in case.not_contains {
            assert!(
                !help.contains(unexpected),
                "{} help should not contain {unexpected:?}; help:\n{help}",
                case.command
            );
        }
    }
}

#[test]
fn auth_help_text_resolves_nested_help_from_remaining_args() {
    let help = auth_help_text("login", &args(&["otp", "confirm", "--help"]));
    assert!(help.contains("Confirm OTP login"));
    assert!(help.contains("primitive-rust login otp confirm <email> <code>"));

    let help = auth_help_text("signup", &args(&["confirm", "--help"]));
    assert!(help.contains("Confirm account signup"));
    assert!(help.contains("primitive-rust signup confirm <email> [code]"));
}

fn push_verify_success(http: &mut FakeAuthHttp) {
    http.push_json(json!({
        "success": true,
        "data": {
            "access_token": "access",
            "refresh_token": "refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "auth_method": "oauth",
            "oauth_grant_id": "grant-id",
            "oauth_client_id": "client-id",
            "org_id": "org-id",
            "org_name": "Acme"
        }
    }));
}

fn runtime_context(config_dir: &str) -> AuthExecutionContext {
    AuthExecutionContext {
        api_base_url: "https://api.primitive.dev/v1".to_string(),
        api_key: None,
        config_dir: config_dir.to_string(),
        fallback_device_name: "fallback-host".to_string(),
        headers: BTreeMap::new(),
        now: UNIX_EPOCH + Duration::from_millis(1_784_289_600_000),
    }
}

fn confirm_request_body_from_source_args(
    command_args: &[&str],
    io: MemoryAuthIo,
) -> serde_json::Value {
    let config_dir = "/tmp/primitive-confirm-code-source";
    let context = runtime_context(config_dir);
    let pending_path = pending_signup_path(config_dir);
    let mut io = io.with_file(
        &pending_path,
        serialize_pending_signup(&pending("user@example.com")).expect("serialize pending"),
    );
    let mut http = FakeAuthHttp::default();
    push_verify_success(&mut http);
    let command = dispatch(&args(command_args)).expect("dispatch confirm source command");

    execute_auth_command_with(&command, &context, &mut io, &mut http).expect("execute confirm");

    let body = http.requests[0]
        .2
        .body
        .clone()
        .expect("confirm request body");
    match body {
        AuthRequestBody::Json(value) => value,
        AuthRequestBody::Form(_) => panic!("confirm request body should be JSON"),
    }
}

#[derive(Default)]
struct MemoryAuthIo {
    env: BTreeMap<String, String>,
    files: BTreeMap<String, String>,
    prompt_answers: VecDeque<String>,
    prompts: Vec<String>,
    sleeps: Vec<Duration>,
    stdin: VecDeque<anyhow::Result<String>>,
}

impl MemoryAuthIo {
    fn with_env(mut self, name: &str, value: &str) -> Self {
        self.env.insert(name.to_string(), value.to_string());
        self
    }

    fn with_file(mut self, path: &str, contents: String) -> Self {
        self.files.insert(path.to_string(), contents);
        self
    }

    fn with_prompt_answers(mut self, answers: &[&str]) -> Self {
        self.prompt_answers
            .extend(answers.iter().map(|answer| (*answer).to_string()));
        self
    }

    fn with_stdin(mut self, contents: &str) -> Self {
        self.stdin.push_back(Ok(contents.to_string()));
        self
    }

    fn with_stdin_error(mut self, message: &str) -> Self {
        self.stdin
            .push_back(Err(anyhow::anyhow!(message.to_string())));
        self
    }
}

impl AuthRuntimeIo for MemoryAuthIo {
    fn env_var(&mut self, name: &str) -> anyhow::Result<Option<String>> {
        Ok(self.env.get(name).cloned())
    }

    fn exists(&mut self, path: &str) -> bool {
        let prefix = format!("{}/", path.trim_end_matches('/'));
        self.files.contains_key(path) || self.files.keys().any(|key| key.starts_with(&prefix))
    }

    fn prompt_line(&mut self, prompt: &str) -> anyhow::Result<String> {
        self.prompts.push(prompt.to_string());
        self.prompt_answers
            .pop_front()
            .ok_or_else(|| anyhow::anyhow!("missing fake prompt response for {prompt}"))
    }

    fn read_to_string(&mut self, path: &str) -> anyhow::Result<Option<String>> {
        Ok(self.files.get(path).cloned())
    }

    fn read_stdin_to_string(&mut self) -> anyhow::Result<String> {
        self.stdin
            .pop_front()
            .unwrap_or_else(|| Err(anyhow::anyhow!("unexpected stdin read")))
    }

    fn remove_file(&mut self, path: &str) -> anyhow::Result<()> {
        self.files.remove(path);
        Ok(())
    }

    fn remove_dir_all(&mut self, path: &str) -> anyhow::Result<()> {
        let prefix = format!("{}/", path.trim_end_matches('/'));
        self.files
            .retain(|key, _| key != path && !key.starts_with(&prefix));
        Ok(())
    }

    fn sleep(&mut self, duration: Duration) -> anyhow::Result<()> {
        self.sleeps.push(duration);
        Ok(())
    }

    fn write_string(&mut self, path: &str, contents: &str) -> anyhow::Result<()> {
        self.files.insert(path.to_string(), contents.to_string());
        Ok(())
    }
}

#[derive(Default)]
struct FakeAuthHttp {
    requests: Vec<(String, Option<String>, AuthRequestPlan)>,
    responses: VecDeque<AuthApiResponse>,
}

impl FakeAuthHttp {
    fn push_json(&mut self, body: serde_json::Value) {
        self.responses.push_back(AuthApiResponse::json(200, body));
    }

    fn push_error(&mut self, status: u16, code: &str) {
        self.responses.push_back(AuthApiResponse::json(
            status,
            json!({
                "success": false,
                "error": {
                    "code": code,
                },
            }),
        ));
    }

    fn push_error_with_headers(
        &mut self,
        status: u16,
        code: &str,
        headers: BTreeMap<String, String>,
    ) {
        self.responses.push_back(AuthApiResponse::json_with_headers(
            status,
            json!({
                "success": false,
                "error": {
                    "code": code,
                },
            }),
            headers,
        ));
    }
}

impl AuthRuntimeHttp for FakeAuthHttp {
    fn send(
        &mut self,
        context: &AuthExecutionContext,
        request: &AuthRequestPlan,
    ) -> anyhow::Result<AuthApiResponse> {
        self.requests.push((
            context.api_base_url.clone(),
            context.api_key.clone(),
            request.clone(),
        ));
        self.responses
            .pop_front()
            .ok_or_else(|| anyhow::anyhow!("missing fake auth response"))
    }
}

#[test]
fn dispatches_browser_signin_without_wiring() {
    let command = dispatch(&args(&[
        "signin",
        "browser",
        "--device-name",
        "work-laptop",
        "--no-browser",
        "-f",
    ]))
    .expect("dispatch signin browser");

    assert_eq!(
        command,
        AuthCommand::BrowserLogin {
            verb: BrowserLoginVerb::Signin,
            flags: BrowserLoginFlags {
                device_name: Some("work-laptop".to_string()),
                force: true,
                no_browser: true,
                ..BrowserLoginFlags::default()
            },
        }
    );
}

#[test]
fn dispatches_login_and_signin_email_code_shapes() {
    let login = dispatch(&args(&[
        "login",
        "user@example.com",
        "--signup-code=invite-code",
        "--accept-terms",
    ]))
    .expect("dispatch login start");
    assert_eq!(
        login,
        AuthCommand::StartEmailCode {
            flow: EmailCodeFlow::Login,
            email: Some("user@example.com".to_string()),
            flags: StartEmailCodeFlags {
                accept_terms: true,
                signup_code: Some("invite-code".to_string()),
                ..StartEmailCodeFlags::default()
            },
        }
    );

    let signin_otp_confirm = dispatch(&args(&[
        "signin",
        "otp",
        "confirm",
        "user@example.com",
        "123456",
        "--org-id",
        "00000000-0000-4000-8000-000000000000",
    ]))
    .expect("dispatch signin otp confirm");
    assert_eq!(
        signin_otp_confirm,
        AuthCommand::ConfirmEmailCode {
            flow: EmailCodeFlow::SigninOtp,
            email: "user@example.com".to_string(),
            code: "123456".to_string(),
            flags: ConfirmEmailCodeFlags {
                org_id: Some("00000000-0000-4000-8000-000000000000".to_string()),
                ..ConfirmEmailCodeFlags::default()
            },
        }
    );
}

#[test]
fn dispatches_confirm_verification_code_source_shapes() {
    let signup_from_env = dispatch(&args(&[
        "signup",
        "confirm",
        "user@example.com",
        "--code-from-env",
        "TEST_CODE",
    ]))
    .expect("dispatch signup confirm from env");
    assert_eq!(
        signup_from_env,
        AuthCommand::ConfirmEmailCode {
            flow: EmailCodeFlow::Signup,
            email: "user@example.com".to_string(),
            code: String::new(),
            flags: ConfirmEmailCodeFlags {
                code_from_env: Some("TEST_CODE".to_string()),
                ..ConfirmEmailCodeFlags::default()
            },
        }
    );

    let login_from_file = dispatch(&args(&[
        "login",
        "confirm",
        "user@example.com",
        "--code-from-file",
        "/run/user/1000/verification-code",
    ]))
    .expect("dispatch login confirm from file");
    assert_eq!(
        login_from_file,
        AuthCommand::ConfirmEmailCode {
            flow: EmailCodeFlow::Login,
            email: "user@example.com".to_string(),
            code: String::new(),
            flags: ConfirmEmailCodeFlags {
                code_from_file: Some("/run/user/1000/verification-code".to_string()),
                ..ConfirmEmailCodeFlags::default()
            },
        }
    );

    let signin_otp_from_stdin = dispatch(&args(&[
        "signin",
        "otp",
        "confirm",
        "user@example.com",
        "--code-from-stdin",
    ]))
    .expect("dispatch signin otp confirm from stdin");
    assert_eq!(
        signin_otp_from_stdin,
        AuthCommand::ConfirmEmailCode {
            flow: EmailCodeFlow::SigninOtp,
            email: "user@example.com".to_string(),
            code: String::new(),
            flags: ConfirmEmailCodeFlags {
                code_from_stdin: true,
                ..ConfirmEmailCodeFlags::default()
            },
        }
    );
}

#[test]
fn rejects_missing_and_conflicting_confirm_verification_code_sources() {
    let missing = dispatch(&args(&["signup", "confirm", "user@example.com"]))
        .expect_err("signup confirm should require a code source")
        .to_string();
    assert_eq!(
        missing,
        "Pass the verification code as a positional argument or via one of --code-from-stdin, --code-from-file, or --code-from-env."
    );

    let conflicting = dispatch(&args(&[
        "signup",
        "confirm",
        "user@example.com",
        "123456",
        "--code-from-env",
        "TEST_CODE",
    ]))
    .expect_err("signup confirm should reject multiple code sources")
    .to_string();
    assert_eq!(
        conflicting,
        "Pass exactly one source for the verification code; got positional, --code-from-env."
    );
}

#[test]
fn dispatches_signup_resend_status_and_otp() {
    let signup_resend =
        dispatch(&args(&["signup", "resend"])).expect("dispatch signup resend without email");
    assert_eq!(
        signup_resend,
        AuthCommand::ResendEmailCode {
            flow: EmailCodeFlow::Signup,
            email: None,
            flags: ResendEmailCodeFlags::default(),
        }
    );

    let status = dispatch(&args(&["signup", "status", "User@Example.COM", "--json"]))
        .expect("dispatch signup status");
    assert!(matches!(
        status,
        AuthCommand::SignupStatus {
            email: Some(ref email),
            ..
        } if email == "User@Example.COM"
    ));

    let interactive = dispatch(&args(&[
        "signup",
        "interactive",
        "--accept-terms",
        "--signup-code",
        "invite-code",
        "--device-name",
        "work-laptop",
        "--force",
    ]))
    .expect("dispatch signup interactive");
    assert_eq!(
        interactive,
        AuthCommand::SignupInteractive {
            flags: StartEmailCodeFlags {
                accept_terms: true,
                device_name: Some("work-laptop".to_string()),
                force: true,
                signup_code: Some("invite-code".to_string()),
                ..StartEmailCodeFlags::default()
            },
        }
    );

    let otp = dispatch(&args(&[
        "otp",
        "user@example.com",
        "--signup-code",
        "invite-code",
        "--accept-terms",
    ]))
    .expect("dispatch otp start");
    assert!(matches!(
        otp,
        AuthCommand::StartEmailCode {
            flow: EmailCodeFlow::Otp,
            email: Some(ref email),
            ..
        } if email == "user@example.com"
    ));
}

#[test]
fn signin_without_email_rejects_email_code_flags() {
    let error = dispatch(&args(&["signin", "--signup-code", "invite-code"]))
        .expect_err("signin without email should reject email-code flags")
        .to_string();

    assert!(error.contains("Email-code auth needs an email address"));
    assert!(error.contains("primitive signin <email>"));
}

#[test]
fn builds_agent_signup_start_body_like_node_helper() {
    let body = build_start_agent_signup_body(
        "user@example.com",
        &StartEmailCodeFlags {
            accept_terms: true,
            device_name: Some("work-laptop".to_string()),
            signup_code: Some(" invite-code ".to_string()),
            ..StartEmailCodeFlags::default()
        },
        "fallback-host",
    )
    .expect("build start body");

    assert_eq!(
        body,
        json!({
            "device_name": "work-laptop",
            "email": "user@example.com",
            "signup_code": " invite-code ",
            "terms_accepted": true,
        })
    );

    let without_code = build_start_agent_signup_body(
        "user@example.com",
        &StartEmailCodeFlags {
            accept_terms: true,
            signup_code: Some("   ".to_string()),
            ..StartEmailCodeFlags::default()
        },
        "fallback-host",
    )
    .expect("build start body without code");
    assert_eq!(
        without_code,
        json!({
            "device_name": "fallback-host",
            "email": "user@example.com",
            "terms_accepted": true,
        })
    );
}

#[test]
fn builds_browser_poll_verify_resend_and_logout_bodies() {
    let pending = pending("user@example.com");
    let credentials = StoredCliCredentials {
        auth_method: "oauth".to_string(),
        access_token: "access".to_string(),
        refresh_token: "refresh".to_string(),
        token_type: "Bearer".to_string(),
        expires_at: "2026-07-17T13:00:00.000Z".to_string(),
        oauth_grant_id: "grant-id".to_string(),
        oauth_client_id: "client-id".to_string(),
        org_id: "org-id".to_string(),
        org_name: Some("Acme".to_string()),
        api_base_url: "https://api.primitive.dev/v1".to_string(),
        created_at: "2026-07-17T12:00:00.000Z".to_string(),
    };

    assert_eq!(
        build_start_cli_login_body(Some(" work-laptop "), "fallback-host"),
        json!({ "device_name": "work-laptop" })
    );
    assert_eq!(
        build_poll_cli_login_body("device-code"),
        json!({ "device_code": "device-code" })
    );
    assert_eq!(
        build_resend_agent_signup_body("signup-token"),
        json!({ "signup_token": "signup-token" })
    );
    assert_eq!(
        build_verify_agent_signup_body(&pending, "123456", Some("org-id")),
        json!({
            "org_id": "org-id",
            "signup_token": "signup-token",
            "verification_code": "123456",
        })
    );
    assert_eq!(
        build_cli_logout_body(&credentials),
        json!({ "key_id": "grant-id" })
    );
}

#[test]
fn persists_pending_and_credentials_in_node_compatible_shapes() {
    let start = AgentSignupStartResult {
        signup_token: "signup-token".to_string(),
        email: "user@example.com".to_string(),
        expires_in: 600,
        resend_after: 30,
        verification_code_length: 6,
    };
    let pending = PendingAgentSignup::from_start(
        start,
        "https://api.primitive.dev/v1",
        "2026-07-17T12:00:00.000Z",
        "2026-07-17T12:10:00.000Z",
    );
    let serialized = serialize_pending_signup(&pending).expect("serialize pending");
    assert!(serialized.ends_with('\n'));
    assert!(serialized.contains("\"signup_token\": \"signup-token\""));
    assert!(serialized.contains("\"api_base_url\": \"https://api.primitive.dev/v1\""));

    let resend = AgentSignupResendResult {
        email: "user@example.com".to_string(),
        expires_in: 900,
        resend_after: 45,
        verification_code_length: 8,
    };
    let updated = PendingAgentSignup::from_resend(
        &pending,
        resend,
        "2026-07-17T12:01:00.000Z",
        "2026-07-17T12:16:00.000Z",
    );
    assert_eq!(updated.signup_token, "signup-token");
    assert_eq!(updated.verification_code_length, 8);

    let signup = AgentSignupVerifyResult {
        access_token: "access".to_string(),
        refresh_token: "refresh".to_string(),
        token_type: "Bearer".to_string(),
        expires_in: 3600,
        auth_method: "oauth".to_string(),
        oauth_grant_id: "grant-id".to_string(),
        oauth_client_id: "client-id".to_string(),
        org_id: "org-id".to_string(),
        org_name: None,
    };
    let credentials = StoredCliCredentials::from_signup(
        "https://api.primitive.dev/v1",
        signup,
        "2026-07-17T12:00:00.000Z",
        "2026-07-17T13:00:00.000Z",
    );
    let credentials_json = serialize_credentials(&credentials).expect("serialize credentials");
    assert!(credentials_json.contains("\"auth_method\": \"oauth\""));
    assert!(credentials_json.contains("\"oauth_grant_id\": \"grant-id\""));
    assert!(credentials_json.contains("\"org_name\": null"));
}

#[test]
fn maps_browser_login_poll_errors_to_retry_decisions() {
    assert_eq!(initial_poll_interval_seconds(0), 1);
    assert_eq!(initial_poll_interval_seconds(120), 60);

    assert_eq!(
        decide_poll_error("authorization_pending", 5, None, "signin"),
        PollDecision::Continue {
            next_poll_delay_seconds: 5,
            interval_seconds: 5,
        }
    );
    assert_eq!(
        decide_poll_error("slow_down", 5, None, "signin"),
        PollDecision::Continue {
            next_poll_delay_seconds: 10,
            interval_seconds: 10,
        }
    );
    assert_eq!(
        decide_poll_error("slow_down", 5, Some(90), "signin"),
        PollDecision::Continue {
            next_poll_delay_seconds: 60,
            interval_seconds: 60,
        }
    );
    assert_eq!(
        decide_poll_error("access_denied", 5, None, "signin"),
        PollDecision::Denied
    );
    assert_eq!(
        decide_poll_error("expired_token", 5, None, "signin browser"),
        PollDecision::Expired {
            retry_command: "signin browser".to_string(),
        }
    );
}

#[test]
fn maps_resend_and_verify_errors_to_state_decisions() {
    assert_eq!(
        decide_resend_result(false, Some("slow_down"), None, 30),
        ResendDecision::Wait {
            retry_after_seconds: 30,
        }
    );
    assert_eq!(
        decide_resend_result(false, Some("expired_token"), None, 30),
        ResendDecision::ClearPendingAndFail
    );
    assert_eq!(
        decide_verify_result(false, Some("invalid_verification_code")),
        VerifyDecision::InvalidCode
    );
    assert_eq!(
        decide_verify_result(false, Some("invalid_signup_token")),
        VerifyDecision::ClearPendingAndFail
    );
    assert_eq!(
        decide_verify_result(true, None),
        VerifyDecision::SaveCredentials
    );
}

#[test]
fn decides_pending_start_state_without_io() {
    let existing = pending("User@Example.COM");
    assert_eq!(
        decide_pending_start(
            Some(&existing),
            "user@example.com",
            EmailCodeFlow::Signin,
            false,
        ),
        PendingStartDecision::ContinueExisting {
            confirm_command: "signin confirm User@Example.COM <code>".to_string(),
            resend_command: "signin resend User@Example.COM".to_string(),
        }
    );
    assert_eq!(
        decide_pending_start(
            Some(&existing),
            "other@example.com",
            EmailCodeFlow::Signin,
            true,
        ),
        PendingStartDecision::ReplaceExisting
    );
    assert!(matches!(
        decide_pending_start(
            Some(&existing),
            "other@example.com",
            EmailCodeFlow::Signin,
            false,
        ),
        PendingStartDecision::Blocked { .. }
    ));
}

#[test]
fn builds_signup_status_and_duration_copy() {
    let pending = pending("user@example.com");
    let status = pending_signup_status(
        Some(&pending),
        EmailCodeFlow::Signup,
        Some("USER@example.com"),
        1_784_290_000_000,
    )
    .expect("status");

    assert_eq!(status["pending"], true);
    assert_eq!(
        status["confirm_command"],
        "primitive signup confirm user@example.com <code>"
    );
    assert_eq!(
        status["resend_command"],
        "primitive signup resend user@example.com"
    );

    assert_eq!(format_signup_seconds(None), "soon");
    assert_eq!(format_signup_seconds(Some(1)), "1 seconds");
    assert_eq!(format_signup_seconds(Some(60)), "1 minute");
    assert_eq!(format_signup_seconds(Some(61)), "2 minutes");
}

#[test]
fn browser_login_credentials_use_same_disk_shape_as_signup_credentials() {
    let login = CliLoginPollResult {
        access_token: "access".to_string(),
        refresh_token: "refresh".to_string(),
        token_type: "Bearer".to_string(),
        expires_in: 3600,
        oauth_grant_id: "grant-id".to_string(),
        oauth_client_id: "client-id".to_string(),
        org_id: "org-id".to_string(),
        org_name: Some("Acme".to_string()),
    };

    let credentials = StoredCliCredentials::from_browser_login(
        "https://api.primitive.dev/v1",
        login,
        "2026-07-17T12:00:00.000Z",
        "2026-07-17T13:00:00.000Z",
    );

    assert_eq!(credentials.auth_method, "oauth");
    assert_eq!(credentials.token_type, "Bearer");
    assert_eq!(credentials.org_name, Some("Acme".to_string()));
    assert_eq!(credentials.api_base_url, "https://api.primitive.dev/v1");
}

#[test]
fn extracts_managed_inbox_domain_from_verified_managed_domains() {
    let domains = json!([
        {
            "domain": "unverified.primitive.email",
            "managed_zone": "primitive-email",
            "verified": false
        },
        {
            "domain": "custom.example.com",
            "managed_zone": null,
            "verified": true
        },
        {
            "domain": "user.primitive.email",
            "managed_zone": "primitive-email",
            "verified": true
        }
    ]);

    assert_eq!(
        managed_inbox_domain_from_domains(&domains),
        Some("user.primitive.email".to_string())
    );

    let account = account_with_managed_inbox_domain(
        &json!({
            "id": "account-id",
            "email": "user@example.com",
            "plan": "free"
        }),
        Some("user.primitive.email"),
    );
    assert_eq!(
        account
            .get("managed_inbox_domain")
            .and_then(serde_json::Value::as_str),
        Some("user.primitive.email")
    );
}

#[test]
fn identifies_auth_command_ids_and_dispatches_colon_forms() {
    let identified = identify_auth_command(&args(&[
        "signin",
        "otp",
        "confirm",
        "user@example.com",
        "123456",
    ]))
    .expect("identify signin otp confirm");

    assert_eq!(identified.id, AuthCommandId::SigninOtpConfirm);
    assert_eq!(identified.id.as_str(), "signin:otp:confirm");
    assert_eq!(identified.args, args(&["user@example.com", "123456"]));
    assert_eq!(
        identified.dispatch_args(),
        args(&["signin", "otp", "confirm", "user@example.com", "123456"])
    );

    let colon = identify_auth_command(&args(&["login:otp:resend", "user@example.com"]))
        .expect("identify colon form");
    assert_eq!(colon.id, AuthCommandId::LoginOtpResend);
    assert_eq!(colon.args, args(&["user@example.com"]));

    assert!(is_auth_friendly_command("signup:status"));
    assert!(is_auth_friendly_command("signin"));
    assert!(!is_auth_friendly_command("emails:list"));

    let command = dispatch_auth_command(
        "login:confirm",
        &args(&["user@example.com", "123456", "--org-id", "org-id"]),
    )
    .expect("dispatch colon form");
    assert_eq!(
        command,
        AuthCommand::ConfirmEmailCode {
            flow: EmailCodeFlow::Login,
            email: "user@example.com".to_string(),
            code: "123456".to_string(),
            flags: ConfirmEmailCodeFlags {
                org_id: Some("org-id".to_string()),
                ..ConfirmEmailCodeFlags::default()
            },
        }
    );
}

#[test]
fn plans_auth_api_requests_without_network() {
    let start_flags = StartEmailCodeFlags {
        accept_terms: true,
        device_name: Some("work-laptop".to_string()),
        signup_code: Some("invite-code".to_string()),
        ..StartEmailCodeFlags::default()
    };
    let start = plan_start_email_code_request(
        EmailCodeFlow::Signin,
        "user@example.com",
        &start_flags,
        "fallback-host",
    )
    .expect("plan start");
    assert_eq!(start.operation_id, "startAgentSignup");
    assert_eq!(start.method, "POST");
    assert_eq!(start.path, "/agent/signup/start");
    assert!(!start.include_auth);
    assert_eq!(
        start.body,
        json_body(json!({
            "device_name": "work-laptop",
            "email": "user@example.com",
            "signup_code": "invite-code",
            "terms_accepted": true,
        }))
    );

    let missing_code = plan_start_email_code_request(
        EmailCodeFlow::Otp,
        "user@example.com",
        &StartEmailCodeFlags {
            accept_terms: true,
            ..StartEmailCodeFlags::default()
        },
        "fallback-host",
    )
    .expect_err("otp requires signup code")
    .to_string();
    assert!(missing_code.contains("requires --signup-code"));

    let browser = plan_browser_login_start_request(
        &BrowserLoginFlags {
            device_name: Some("  ".to_string()),
            ..BrowserLoginFlags::default()
        },
        "fallback-host",
    );
    assert_eq!(browser.operation_id, "startCliLogin");
    assert_eq!(
        browser.body,
        json_body(json!({ "device_name": "fallback-host" }))
    );

    let poll = plan_browser_login_poll_request("device-code");
    assert_eq!(poll.operation_id, "pollCliLogin");
    assert_eq!(
        poll.body,
        json_body(json!({ "device_code": "device-code" }))
    );

    let pending = pending("user@example.com");
    let confirm = plan_confirm_email_code_request(
        &pending,
        "123456",
        &ConfirmEmailCodeFlags {
            org_id: Some("org-id".to_string()),
            ..ConfirmEmailCodeFlags::default()
        },
    );
    assert_eq!(confirm.operation_id, "verifyAgentSignup");
    assert_eq!(
        confirm.body,
        json_body(json!({
            "org_id": "org-id",
            "signup_token": "signup-token",
            "verification_code": "123456",
        }))
    );

    let resend = plan_resend_email_code_request(&pending);
    assert_eq!(resend.operation_id, "resendAgentSignupVerification");
    assert_eq!(
        resend.body,
        json_body(json!({ "signup_token": "signup-token" }))
    );

    let logout = plan_logout_request(&credentials(None));
    assert_eq!(logout.operation_id, "cliLogout");
    assert!(logout.include_auth);
    assert_eq!(logout.body, json_body(json!({ "key_id": "grant-id" })));

    let domains = plan_whoami_domains_request();
    assert_eq!(domains.operation_id, "listDomains");
    assert_eq!(domains.method, "GET");
    assert_eq!(domains.path, "/domains");
    assert!(domains.include_auth);
    assert_eq!(domains.body, None);
}

#[test]
fn plans_auth_command_requests_from_dispatched_shapes() {
    let pending = pending("user@example.com");
    let command = AuthCommand::ConfirmEmailCode {
        flow: EmailCodeFlow::SigninOtp,
        email: "USER@example.com".to_string(),
        code: "123456".to_string(),
        flags: ConfirmEmailCodeFlags::default(),
    };

    let plan = plan_auth_command_request(
        &command,
        AuthCommandRequestContext {
            fallback_device_name: "fallback-host",
            pending: Some(&pending),
            credentials: None,
        },
    )
    .expect("plan confirm command");
    assert!(matches!(
        plan,
        AuthCommandRequestPlan::ConfirmEmailCode(ref request)
            if request.operation_id == "verifyAgentSignup"
    ));

    let start = AuthCommand::StartEmailCode {
        flow: EmailCodeFlow::Signup,
        email: Some("user@example.com".to_string()),
        flags: StartEmailCodeFlags {
            accept_terms: true,
            ..StartEmailCodeFlags::default()
        },
    };
    let plan = plan_auth_command_request(
        &start,
        AuthCommandRequestContext {
            fallback_device_name: "fallback-host",
            pending: None,
            credentials: None,
        },
    )
    .expect("plan start command");
    assert!(matches!(
        plan,
        AuthCommandRequestPlan::StartEmailCode(ref request)
            if request.body == json_body(json!({
                "device_name": "fallback-host",
                "email": "user@example.com",
                "terms_accepted": true,
            }))
    ));

    let force_logout = AuthCommand::Logout {
        flags: primitive_rust::auth_commands::LogoutFlags {
            force: true,
            ..primitive_rust::auth_commands::LogoutFlags::default()
        },
    };
    assert_eq!(
        plan_auth_command_request(
            &force_logout,
            AuthCommandRequestContext {
                fallback_device_name: "fallback-host",
                pending: None,
                credentials: None,
            },
        )
        .expect("plan force logout"),
        AuthCommandRequestPlan::ForceLogout
    );
}

#[test]
fn decides_pending_state_and_required_email_without_io() {
    let pending = pending("User@Example.COM");
    assert_eq!(
        decide_pending_state(
            Some(&pending),
            "https://api.primitive.dev/v1",
            1_784_289_600_000,
        ),
        PendingStateDecision::Use { expires_in: 600 }
    );
    assert_eq!(
        decide_pending_state(
            Some(&pending),
            "https://api.other.test/v1",
            1_784_289_600_000,
        ),
        PendingStateDecision::IgnoreDifferentApiBaseUrl {
            pending_api_base_url: "https://api.primitive.dev/v1".to_string(),
        }
    );
    assert_eq!(
        decide_pending_state(
            Some(&pending),
            "https://api.primitive.dev/v1",
            9_999_999_999_999,
        ),
        PendingStateDecision::ClearExpired {
            expires_at: "2026-07-17T12:10:00.000Z".to_string(),
        }
    );
    assert_eq!(
        decide_required_pending_for_email(
            Some(&pending),
            EmailCodeFlow::Signin,
            "user@example.com",
        ),
        RequiredPendingDecision::Ready
    );
    assert!(matches!(
        decide_required_pending_for_email(
            Some(&pending),
            EmailCodeFlow::Signin,
            "other@example.com",
        ),
        RequiredPendingDecision::WrongEmail { ref message }
            if message.contains("Pending sign-in is for User@Example.COM")
    ));
}

#[test]
fn decides_existing_credentials_and_write_plans() {
    let existing = credentials(Some("Acme"));
    assert_eq!(
        decide_existing_credentials_before_auth(None, None, false, EmailCodeFlow::Signup, None,),
        ExistingCredentialDecision::Continue
    );
    assert_eq!(
        decide_existing_credentials_before_auth(
            None,
            Some("bad json"),
            true,
            EmailCodeFlow::Signup,
            None,
        ),
        ExistingCredentialDecision::ReplaceUnreadable {
            message:
                "Replacing unreadable Primitive CLI credentials because --force was set: bad json"
                    .to_string(),
        }
    );
    assert_eq!(
        decide_existing_credentials_before_auth(
            Some(&existing),
            None,
            false,
            EmailCodeFlow::Signin,
            None,
        ),
        ExistingCredentialDecision::VerifyExisting
    );
    assert!(matches!(
        decide_existing_credentials_before_auth(
            Some(&existing),
            None,
            false,
            EmailCodeFlow::Signin,
            Some(ExistingLoginProbeStatus::Valid),
        ),
        ExistingCredentialDecision::Blocked { ref message }
            if message == "Already logged in for Acme. Run `primitive logout` before signing in."
    ));
    assert_eq!(
        decide_existing_credentials_before_auth(
            Some(&existing),
            None,
            false,
            EmailCodeFlow::Signup,
            Some(ExistingLoginProbeStatus::RemovedStale),
        ),
        ExistingCredentialDecision::ContinueAfterRemovedStale {
            message: "Continuing with Primitive signup...".to_string(),
        }
    );

    let signup = AgentSignupVerifyResult {
        access_token: "access".to_string(),
        refresh_token: "refresh".to_string(),
        token_type: "Bearer".to_string(),
        expires_in: 3600,
        auth_method: "oauth".to_string(),
        oauth_grant_id: "grant-id".to_string(),
        oauth_client_id: "client-id".to_string(),
        org_id: "org-id".to_string(),
        org_name: Some("Acme".to_string()),
    };
    let write = plan_signup_credentials_write(
        "/tmp/primitive",
        "https://api.primitive.dev/v1",
        &signup,
        "2026-07-17T12:00:00.000Z",
        "2026-07-17T13:00:00.000Z",
    )
    .expect("signup write plan");
    assert_eq!(write.credentials_path, "/tmp/primitive/credentials.json");
    assert_eq!(
        write.delete_pending_path,
        Some("/tmp/primitive/signup.json".to_string())
    );
    assert!(write.delete_chat_state);
    assert!(write.credentials_json.contains("\"org_name\": \"Acme\""));
    assert_eq!(
        write.stderr,
        vec![
            "Logged in to org org-id (Acme).".to_string(),
            "Saved credentials to /tmp/primitive/credentials.json.".to_string(),
        ]
    );

    let login = CliLoginPollResult {
        access_token: "access".to_string(),
        refresh_token: "refresh".to_string(),
        token_type: "Bearer".to_string(),
        expires_in: 3600,
        oauth_grant_id: "grant-id".to_string(),
        oauth_client_id: "client-id".to_string(),
        org_id: "org-id".to_string(),
        org_name: None,
    };
    let browser_write = plan_browser_login_credentials_write(
        "/tmp/primitive",
        "https://api.primitive.dev/v1",
        &login,
        "2026-07-17T12:00:00.000Z",
        "2026-07-17T13:00:00.000Z",
    )
    .expect("browser write plan");
    assert!(browser_write.delete_chat_state);
    assert_eq!(browser_write.delete_pending_path, None);
}

#[test]
fn extracts_auth_flags_and_renders_output_decisions() {
    let command = AuthCommand::Whoami {
        flags: WhoamiFlags {
            api_base_url: Some("https://api.test/v1".to_string()),
            api_key: Some("prim_test".to_string()),
            json: true,
            ..WhoamiFlags::default()
        },
    };
    let flags = auth_flags_from_command(&command);
    assert_eq!(
        flags.get("api-base-url"),
        Some(&"https://api.test/v1".to_string())
    );
    assert_eq!(flags.get("api-key"), Some(&"prim_test".to_string()));

    let pending = pending("user@example.com");
    assert_eq!(
        start_email_code_output(&pending, EmailCodeFlow::Signup).stderr,
        vec![
            "Sent a 6-digit verification code to user@example.com.".to_string(),
            "The code expires in 10 minutes.".to_string(),
            "Run `primitive signup confirm user@example.com <code>` to finish.".to_string(),
        ]
    );
    assert_eq!(
        continue_pending_start_output(&pending, EmailCodeFlow::LoginOtp).stderr,
        vec![
            "Continuing pending Primitive login for user@example.com.".to_string(),
            "Run `primitive login otp confirm user@example.com <code>` to finish, `primitive login otp resend user@example.com` to send a new code, or `primitive signup status` to inspect it.".to_string(),
        ]
    );
    assert_eq!(
        resend_email_code_output(&pending, true).stderr,
        vec![
            "Sent a new 6-digit verification code to user@example.com. It expires in 10 minutes."
                .to_string()
        ]
    );

    let browser = browser_login_start_output(
        &CliLoginStartResult {
            device_code: "device-code".to_string(),
            expires_in: 600,
            interval: 5,
            user_code: "ABCD-EFGH".to_string(),
            verification_uri_complete: "https://primitive.dev/device".to_string(),
        },
        false,
    );
    assert_eq!(
        browser.open_url,
        Some("https://primitive.dev/device".to_string())
    );
    assert_eq!(
        browser.stderr,
        vec![
            "Your sign-in code is: ABCD-EFGH".to_string(),
            "Opening Primitive in your browser...".to_string(),
            "If the browser did not open, visit: https://primitive.dev/device".to_string(),
            "Waiting for browser approval...".to_string(),
        ]
    );

    let empty_status =
        pending_signup_status(None, EmailCodeFlow::Signup, None, 0).expect("empty status");
    assert_eq!(
        signup_status_output(&empty_status, false)
            .expect("render empty status")
            .stdout,
        vec![
            "No pending Primitive signup found.".to_string(),
            "Start one with `primitive signup <email> --accept-terms`.".to_string(),
        ]
    );
    let json_status = signup_status_output(&empty_status, true).expect("render json status");
    assert_eq!(json_status.stdout.len(), 1);
    assert!(json_status.stdout[0].contains("\"pending\": false"));
}

#[test]
fn runtime_starts_email_code_flows_and_persists_pending() {
    for flow in [
        EmailCodeFlow::Signup,
        EmailCodeFlow::Signin,
        EmailCodeFlow::Login,
        EmailCodeFlow::Otp,
    ] {
        let config_dir = format!("/tmp/primitive-runtime-start-{}", flow.action_noun());
        let context = runtime_context(&config_dir);
        let mut io = MemoryAuthIo::default();
        let mut http = FakeAuthHttp::default();
        http.push_json(json!({
            "success": true,
            "data": {
                "signup_token": "signup-token",
                "email": "user@example.com",
                "expires_in": 600,
                "resend_after": 30,
                "verification_code_length": 6
            }
        }));

        let output = execute_auth_command_with(
            &AuthCommand::StartEmailCode {
                email: Some("user@example.com".to_string()),
                flags: StartEmailCodeFlags {
                    accept_terms: true,
                    signup_code: flow.code_required().then(|| "invite-code".to_string()),
                    ..StartEmailCodeFlags::default()
                },
                flow,
            },
            &context,
            &mut io,
            &mut http,
        )
        .expect("execute start email-code flow");

        assert_eq!(http.requests.len(), 1);
        let request = &http.requests[0].2;
        assert_eq!(request.operation_id, "startAgentSignup");
        assert_eq!(request.path, "/agent/signup/start");
        assert_eq!(
            request
                .body
                .as_ref()
                .and_then(|body| body.get("email"))
                .and_then(serde_json::Value::as_str),
            Some("user@example.com")
        );
        assert_eq!(
            request
                .body
                .as_ref()
                .and_then(|body| body.get("signup_code"))
                .and_then(serde_json::Value::as_str),
            flow.code_required().then_some("invite-code")
        );
        let pending_json = io
            .files
            .get(&pending_signup_path(&config_dir))
            .expect("pending signup written");
        assert!(pending_json.contains("\"signup_token\": \"signup-token\""));
        assert!(pending_json.contains("\"expires_at\": \"2026-07-17T12:10:00.000Z\""));
        assert_eq!(
            output.stderr[0],
            "Sent a 6-digit verification code to user@example.com."
        );
    }
}

#[test]
fn runtime_signup_interactive_starts_resends_and_confirms() {
    let config_dir = "/tmp/primitive-runtime-signup-interactive";
    let context = runtime_context(config_dir);
    let mut io = MemoryAuthIo::default().with_prompt_answers(&[
        "user@example.com",
        "yes",
        "",
        "000000",
        "resend",
        "123456",
    ]);
    let mut http = FakeAuthHttp::default();
    http.push_json(json!({
        "success": true,
        "data": {
            "signup_token": "signup-token",
            "email": "user@example.com",
            "expires_in": 600,
            "resend_after": 30,
            "verification_code_length": 6
        }
    }));
    http.push_error(400, "invalid_verification_code");
    http.push_json(json!({
        "success": true,
        "data": {
            "email": "user@example.com",
            "expires_in": 900,
            "resend_after": 45,
            "verification_code_length": 8
        }
    }));
    http.push_json(json!({
        "success": true,
        "data": {
            "access_token": "access",
            "refresh_token": "refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "auth_method": "oauth",
            "oauth_grant_id": "grant-id",
            "oauth_client_id": "client-id",
            "org_id": "org-id",
            "org_name": "Acme"
        }
    }));

    let output = execute_auth_command_with(
        &AuthCommand::SignupInteractive {
            flags: StartEmailCodeFlags {
                device_name: Some("work-laptop".to_string()),
                signup_code: Some("invite-code".to_string()),
                ..StartEmailCodeFlags::default()
            },
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("execute interactive signup");

    assert_eq!(
        io.prompts,
        vec![
            "Email: ".to_string(),
            "Type 'yes' to continue: ".to_string(),
            "Verification code (6 digits): ".to_string(),
            "Verification code (6 digits): ".to_string(),
            "Verification code (6 digits): ".to_string(),
            "Verification code (8 digits): ".to_string(),
        ]
    );
    assert_eq!(
        http.requests
            .iter()
            .map(|(_, _, request)| request.operation_id)
            .collect::<Vec<_>>(),
        vec![
            "startAgentSignup",
            "verifyAgentSignup",
            "resendAgentSignupVerification",
            "verifyAgentSignup",
        ]
    );
    assert_eq!(
        http.requests[0].2.body,
        json_body(json!({
            "device_name": "work-laptop",
            "email": "user@example.com",
            "signup_code": "invite-code",
            "terms_accepted": true,
        }))
    );
    assert_eq!(
        http.requests[1]
            .2
            .body
            .as_ref()
            .and_then(|body| body.get("verification_code"))
            .and_then(serde_json::Value::as_str),
        Some("000000")
    );
    assert_eq!(
        http.requests[2].2.body,
        json_body(json!({ "signup_token": "signup-token" }))
    );
    assert_eq!(
        http.requests[3]
            .2
            .body
            .as_ref()
            .and_then(|body| body.get("verification_code"))
            .and_then(serde_json::Value::as_str),
        Some("123456")
    );
    assert!(!io.files.contains_key(&pending_signup_path(config_dir)));
    assert!(io
        .files
        .get(&credentials_path(config_dir))
        .expect("credentials written")
        .contains("\"access_token\": \"access\""));
    assert_eq!(
        output.stderr,
        vec![
            "By continuing, you agree to Primitive's Terms of Service and Privacy Policy:"
                .to_string(),
            "  https://primitive.dev/terms".to_string(),
            "  https://primitive.dev/privacy".to_string(),
            "Check your email for the 6-digit verification code sent to user@example.com."
                .to_string(),
            "The code expires in 10 minutes.".to_string(),
            "Enter the code from the email, or type `resend` to send a new code after 30 seconds."
                .to_string(),
            "Please enter a value.".to_string(),
            "Invalid verification code. Try again or type `resend`.".to_string(),
            "Sent a new 8-digit verification code. It expires in 15 minutes.".to_string(),
            "Logged in to org org-id (Acme).".to_string(),
            format!("Saved credentials to {}.", credentials_path(config_dir)),
        ]
    );
}

#[test]
fn runtime_signup_interactive_resumes_pending_signup() {
    let config_dir = "/tmp/primitive-runtime-signup-interactive-resume";
    let context = runtime_context(config_dir);
    let pending_path = pending_signup_path(config_dir);
    let mut io = MemoryAuthIo::default()
        .with_file(
            &pending_path,
            serialize_pending_signup(&pending("user@example.com")).expect("serialize pending"),
        )
        .with_prompt_answers(&["123456"]);
    let mut http = FakeAuthHttp::default();
    http.push_json(json!({
        "success": true,
        "data": {
            "access_token": "access",
            "refresh_token": "refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "auth_method": "oauth",
            "oauth_grant_id": "grant-id",
            "oauth_client_id": "client-id",
            "org_id": "org-id",
            "org_name": null
        }
    }));

    let output = execute_auth_command_with(
        &AuthCommand::SignupInteractive {
            flags: StartEmailCodeFlags::default(),
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("resume interactive signup");

    assert_eq!(
        io.prompts,
        vec!["Verification code (6 digits): ".to_string()]
    );
    assert_eq!(http.requests.len(), 1);
    assert_eq!(http.requests[0].2.operation_id, "verifyAgentSignup");
    assert_eq!(
        output.stderr,
        vec![
            "Continuing pending Primitive signup for user@example.com.".to_string(),
            "Check your email for the 6-digit verification code sent to user@example.com."
                .to_string(),
            "The code expires in 10 minutes.".to_string(),
            "Enter the code from the email, or type `resend` to send a new code after 30 seconds."
                .to_string(),
            "Logged in to org org-id.".to_string(),
            format!("Saved credentials to {}.", credentials_path(config_dir)),
        ]
    );
    assert!(!io.files.contains_key(&pending_path));
}

#[test]
fn runtime_confirms_and_resends_from_pending_signup_state() {
    let config_dir = "/tmp/primitive-runtime-confirm";
    let context = runtime_context(config_dir);
    let pending_path = pending_signup_path(config_dir);
    let mut io = MemoryAuthIo::default().with_file(
        &pending_path,
        serialize_pending_signup(&pending("user@example.com")).expect("serialize pending"),
    );
    let mut http = FakeAuthHttp::default();
    http.push_json(json!({
        "success": true,
        "data": {
            "access_token": "access",
            "refresh_token": "refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "auth_method": "oauth",
            "oauth_grant_id": "grant-id",
            "oauth_client_id": "client-id",
            "org_id": "org-id",
            "org_name": "Acme"
        }
    }));

    let output = execute_auth_command_with(
        &AuthCommand::ConfirmEmailCode {
            code: "123456".to_string(),
            email: "USER@example.com".to_string(),
            flags: ConfirmEmailCodeFlags::default(),
            flow: EmailCodeFlow::Signin,
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("execute confirm");

    assert_eq!(http.requests[0].2.operation_id, "verifyAgentSignup");
    assert!(!io.files.contains_key(&pending_path));
    let credentials_json = io
        .files
        .get(&credentials_path(config_dir))
        .expect("credentials written");
    assert!(credentials_json.contains("\"access_token\": \"access\""));
    assert_eq!(
        output.stderr,
        vec![
            "Logged in to org org-id (Acme).".to_string(),
            format!("Saved credentials to {}.", credentials_path(config_dir)),
        ]
    );

    let resend_dir = "/tmp/primitive-runtime-resend";
    let resend_context = runtime_context(resend_dir);
    let resend_path = pending_signup_path(resend_dir);
    let mut resend_io = MemoryAuthIo::default().with_file(
        &resend_path,
        serialize_pending_signup(&pending("user@example.com")).expect("serialize pending"),
    );
    let mut resend_http = FakeAuthHttp::default();
    resend_http.push_json(json!({
        "success": true,
        "data": {
            "email": "user@example.com",
            "expires_in": 900,
            "resend_after": 45,
            "verification_code_length": 8
        }
    }));

    let output = execute_auth_command_with(
        &AuthCommand::ResendEmailCode {
            email: None,
            flags: ResendEmailCodeFlags::default(),
            flow: EmailCodeFlow::Signup,
        },
        &resend_context,
        &mut resend_io,
        &mut resend_http,
    )
    .expect("execute resend");

    assert_eq!(
        resend_http.requests[0].2.operation_id,
        "resendAgentSignupVerification"
    );
    let updated_pending = resend_io
        .files
        .get(&resend_path)
        .expect("updated pending written");
    assert!(updated_pending.contains("\"resend_after\": 45"));
    assert!(updated_pending.contains("\"verification_code_length\": 8"));
    assert_eq!(
        output.stderr,
        vec![
            "Sent a new 8-digit verification code to user@example.com. It expires in 15 minutes."
                .to_string()
        ]
    );
}

#[test]
fn runtime_confirms_with_secure_verification_code_sources() {
    let from_env = confirm_request_body_from_source_args(
        &[
            "signup",
            "confirm",
            "user@example.com",
            "--code-from-env",
            "TEST_CODE",
        ],
        MemoryAuthIo::default().with_env("TEST_CODE", "482917\n"),
    );
    assert_eq!(from_env["verification_code"], "482917");

    let from_file = confirm_request_body_from_source_args(
        &[
            "login",
            "confirm",
            "user@example.com",
            "--code-from-file",
            "/run/user/1000/verification-code",
        ],
        MemoryAuthIo::default()
            .with_file("/run/user/1000/verification-code", "482917\r\n".to_string()),
    );
    assert_eq!(from_file["verification_code"], "482917");

    let from_stdin = confirm_request_body_from_source_args(
        &[
            "signin",
            "otp",
            "confirm",
            "user@example.com",
            "--code-from-stdin",
        ],
        MemoryAuthIo::default().with_stdin("482917\n"),
    );
    assert_eq!(from_stdin["verification_code"], "482917");
}

#[test]
fn runtime_reports_missing_secure_verification_code_sources_before_pending_state() {
    let context = runtime_context("/tmp/primitive-confirm-code-source-errors");
    let mut http = FakeAuthHttp::default();

    let missing_env = dispatch(&args(&[
        "signup",
        "confirm",
        "user@example.com",
        "--code-from-env",
        "MISSING_CODE",
    ]))
    .expect("dispatch missing env source");
    let mut io = MemoryAuthIo::default();
    let error = execute_auth_command_with(&missing_env, &context, &mut io, &mut http)
        .expect_err("missing env source should fail")
        .to_string();
    assert_eq!(
        error,
        "--code-from-env MISSING_CODE: environment variable is not set."
    );

    let missing_file = dispatch(&args(&[
        "signup",
        "confirm",
        "user@example.com",
        "--code-from-file",
        "/no/such/file",
    ]))
    .expect("dispatch missing file source");
    let mut io = MemoryAuthIo::default();
    let error = execute_auth_command_with(&missing_file, &context, &mut io, &mut http)
        .expect_err("missing file source should fail")
        .to_string();
    assert_eq!(
        error,
        "--code-from-file /no/such/file: could not read file: file not found"
    );

    let stdin_error = dispatch(&args(&[
        "signup",
        "confirm",
        "user@example.com",
        "--code-from-stdin",
    ]))
    .expect("dispatch stdin source");
    let mut io = MemoryAuthIo::default().with_stdin_error("stdin is a TTY");
    let error = execute_auth_command_with(&stdin_error, &context, &mut io, &mut http)
        .expect_err("stdin source should surface read errors")
        .to_string();
    assert_eq!(error, "--code-from-stdin: stdin is a TTY");
}

#[test]
fn runtime_logout_revokes_or_force_clears_local_auth_state() {
    let config_dir = "/tmp/primitive-runtime-logout";
    let context = runtime_context(config_dir);
    let mut io = MemoryAuthIo::default()
        .with_file(
            &credentials_path(config_dir),
            serialize_credentials(&credentials(Some("Acme"))).expect("serialize credentials"),
        )
        .with_file(&chat_state_path(config_dir), "{}\n".to_string());
    let mut http = FakeAuthHttp::default();
    http.push_json(json!({
        "success": true,
        "data": {
            "revoked": true,
            "oauth_grant_id": "grant-id"
        }
    }));

    let output = execute_auth_command_with(
        &AuthCommand::Logout {
            flags: primitive_rust::auth_commands::LogoutFlags::default(),
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("execute logout");

    assert_eq!(http.requests[0].2.operation_id, "cliLogout");
    assert_eq!(http.requests[0].1.as_deref(), Some("access"));
    assert!(!io.files.contains_key(&credentials_path(config_dir)));
    assert!(!io.files.contains_key(&chat_state_path(config_dir)));
    assert_eq!(
        output.stderr,
        vec!["Logged out and revoked OAuth grant grant-id.".to_string()]
    );

    let force_dir = "/tmp/primitive-runtime-force-logout";
    let force_context = runtime_context(force_dir);
    let mut force_io = MemoryAuthIo::default()
        .with_file(
            &credentials_path(force_dir),
            serialize_credentials(&credentials(None)).expect("serialize credentials"),
        )
        .with_file(
            &pending_signup_path(force_dir),
            serialize_pending_signup(&pending("user@example.com")).expect("serialize pending"),
        )
        .with_file(&chat_state_path(force_dir), "{}\n".to_string())
        .with_file(
            &format!("{}/owner.json", credentials_lock_path(force_dir)),
            "{}\n".to_string(),
        );
    let mut force_http = FakeAuthHttp::default();

    let output = execute_auth_command_with(
        &AuthCommand::Logout {
            flags: primitive_rust::auth_commands::LogoutFlags {
                force: true,
                ..primitive_rust::auth_commands::LogoutFlags::default()
            },
        },
        &force_context,
        &mut force_io,
        &mut force_http,
    )
    .expect("execute force logout");

    assert!(force_http.requests.is_empty());
    assert!(!force_io.files.contains_key(&credentials_path(force_dir)));
    assert!(!force_io.files.contains_key(&chat_state_path(force_dir)));
    assert!(!force_io.files.contains_key(&pending_signup_path(force_dir)));
    assert!(!force_io.exists(&credentials_lock_path(force_dir)));
    assert_eq!(
        output.stderr,
        vec![
            "Removed local Primitive CLI credentials, local chat reply state, pending email-code auth state, and credential lock. Backing OAuth grant was not revoked."
                .to_string()
        ]
    );
}

#[test]
fn runtime_signup_status_and_whoami_unwrap_local_data_shapes() {
    let config_dir = "/tmp/primitive-runtime-status";
    let mut context = runtime_context(config_dir);
    context.api_key = Some("access".to_string());
    let mut io = MemoryAuthIo::default().with_file(
        &pending_signup_path(config_dir),
        serialize_pending_signup(&pending("user@example.com")).expect("serialize pending"),
    );
    let mut http = FakeAuthHttp::default();

    let status_output = execute_auth_command_with(
        &AuthCommand::SignupStatus {
            email: Some("USER@example.com".to_string()),
            flags: primitive_rust::auth_commands::SignupStatusFlags {
                json: true,
                ..primitive_rust::auth_commands::SignupStatusFlags::default()
            },
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("execute signup status");
    assert!(http.requests.is_empty());
    assert!(status_output.stdout[0].contains("\"pending\": true"));
    assert!(status_output.stdout[0]
        .contains("\"confirm_command\": \"primitive signup confirm user@example.com <code>\""));

    http.push_json(json!({
        "success": true,
        "data": {
            "id": "00000000-0000-4000-8000-000000000000",
            "email": "user@example.com",
            "plan": "free"
        }
    }));
    http.push_json(json!({
        "success": true,
        "data": [
            {
                "domain": "custom.example.com",
                "managed_zone": null,
                "verified": true
            },
            {
                "domain": "user.primitive.email",
                "managed_zone": "primitive-email",
                "verified": true
            }
        ]
    }));
    let whoami_output = execute_auth_command_with(
        &AuthCommand::Whoami {
            flags: WhoamiFlags {
                json: true,
                ..WhoamiFlags::default()
            },
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("execute whoami");

    assert_eq!(http.requests[0].2.operation_id, "getAccount");
    assert_eq!(http.requests[1].2.operation_id, "listDomains");
    assert_eq!(http.requests[0].1.as_deref(), Some("access"));
    assert!(whoami_output.stdout[0].contains("\"email\": \"user@example.com\""));
    assert!(whoami_output.stdout[0].contains("\"managed_inbox_domain\": \"user.primitive.email\""));
    assert!(!whoami_output.stdout[0].contains("\"data\""));

    let mut text_http = FakeAuthHttp::default();
    text_http.push_json(json!({
        "success": true,
        "data": {
            "id": "00000000-0000-4000-8000-000000000000",
            "email": "user@example.com",
            "plan": "free"
        }
    }));
    text_http.push_json(json!({
        "success": true,
        "data": [
            {
                "domain": "user.primitive.email",
                "managed_zone": "primitive-email",
                "verified": true
            }
        ]
    }));
    let text_output = execute_auth_command_with(
        &AuthCommand::Whoami {
            flags: WhoamiFlags::default(),
        },
        &context,
        &mut io,
        &mut text_http,
    )
    .expect("execute whoami text");
    assert_eq!(
        text_output.stdout,
        vec![
            "Authenticated as user@example.com".to_string(),
            "Account id: 00000000-0000-4000-8000-000000000000".to_string(),
            "Plan: free".to_string(),
            "Managed inbox: any-local-part@user.primitive.email".to_string(),
        ]
    );
}

#[test]
fn runtime_browser_login_polls_and_persists_credentials() {
    let context = runtime_context("/tmp/primitive-runtime-browser");
    let mut io = MemoryAuthIo::default();
    let mut http = FakeAuthHttp::default();
    http.push_json(json!({
        "success": true,
        "data": {
            "device_code": "device-code",
            "expires_in": 600,
            "interval": 5,
            "user_code": "ABCD-EFGH",
            "verification_uri_complete": "https://primitive.dev/device"
        }
    }));
    http.push_error(400, "authorization_pending");
    http.push_json(json!({
        "success": true,
        "data": {
            "access_token": "access",
            "refresh_token": "refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "oauth_grant_id": "grant-id",
            "oauth_client_id": "client-id",
            "org_id": "org-id",
            "org_name": "Acme"
        }
    }));

    let output = execute_auth_command_with(
        &AuthCommand::BrowserLogin {
            flags: BrowserLoginFlags::default(),
            verb: BrowserLoginVerb::Signin,
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("execute browser login");

    assert_eq!(http.requests[0].2.operation_id, "startCliLogin");
    assert_eq!(http.requests[1].2.operation_id, "pollCliLogin");
    assert_eq!(http.requests[2].2.operation_id, "pollCliLogin");
    assert_eq!(
        io.sleeps,
        vec![Duration::from_secs(1), Duration::from_secs(5)]
    );
    assert_eq!(
        output.open_url,
        Some("https://primitive.dev/device".to_string())
    );
    assert_eq!(
        output.stderr,
        vec![
            "Your sign-in code is: ABCD-EFGH".to_string(),
            "Opening Primitive in your browser...".to_string(),
            "If the browser did not open, visit: https://primitive.dev/device".to_string(),
            "Waiting for browser approval...".to_string(),
            "Logged in to org org-id (Acme).".to_string(),
            "Saved credentials to /tmp/primitive-runtime-browser/credentials.json.".to_string(),
        ]
    );
    let credentials_json = io
        .files
        .get(&credentials_path("/tmp/primitive-runtime-browser"))
        .expect("credentials written");
    assert!(credentials_json.contains("\"access_token\": \"access\""));
    assert!(credentials_json.contains("\"org_name\": \"Acme\""));
}

#[test]
fn runtime_no_browser_login_prints_url_without_open_request() {
    let context = runtime_context("/tmp/primitive-runtime-no-browser");
    let mut io = MemoryAuthIo::default();
    let mut http = FakeAuthHttp::default();
    http.push_json(json!({
        "success": true,
        "data": {
            "device_code": "device-code",
            "expires_in": 600,
            "interval": 5,
            "user_code": "WXYZ-1234",
            "verification_uri_complete": "https://primitive.dev/device"
        }
    }));
    http.push_json(json!({
        "success": true,
        "data": {
            "access_token": "access",
            "refresh_token": "refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "oauth_grant_id": "grant-id",
            "oauth_client_id": "client-id",
            "org_id": "org-id",
            "org_name": null
        }
    }));

    let output = execute_auth_command_with(
        &AuthCommand::BrowserLogin {
            flags: BrowserLoginFlags {
                no_browser: true,
                ..BrowserLoginFlags::default()
            },
            verb: BrowserLoginVerb::Login,
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("execute no-browser login");

    assert_eq!(output.open_url, None);
    assert_eq!(
        &output.stderr[..4],
        &[
            "Your sign-in code is: WXYZ-1234".to_string(),
            "If the browser did not open, visit: https://primitive.dev/device".to_string(),
            "Waiting for browser approval...".to_string(),
            "Logged in to org org-id.".to_string(),
        ]
    );
    assert!(!output
        .stderr
        .iter()
        .any(|line| line == "Opening Primitive in your browser..."));
}

#[test]
fn runtime_browser_login_honors_poll_slow_down_and_denied() {
    let context = runtime_context("/tmp/primitive-runtime-browser-slow-down");
    let mut io = MemoryAuthIo::default();
    let mut http = FakeAuthHttp::default();
    http.push_json(json!({
        "success": true,
        "data": {
            "device_code": "device-code",
            "expires_in": 600,
            "interval": 2,
            "user_code": "ABCD-EFGH",
            "verification_uri_complete": "https://primitive.dev/device"
        }
    }));
    http.push_error_with_headers(
        400,
        "slow_down",
        BTreeMap::from([("retry-after".to_string(), "7".to_string())]),
    );
    http.push_json(json!({
        "success": true,
        "data": {
            "access_token": "access",
            "refresh_token": "refresh",
            "token_type": "Bearer",
            "expires_in": 3600,
            "oauth_grant_id": "grant-id",
            "oauth_client_id": "client-id",
            "org_id": "org-id",
            "org_name": null
        }
    }));

    execute_auth_command_with(
        &AuthCommand::BrowserLogin {
            flags: BrowserLoginFlags::default(),
            verb: BrowserLoginVerb::Signin,
        },
        &context,
        &mut io,
        &mut http,
    )
    .expect("execute browser login after slow down");
    assert_eq!(
        io.sleeps,
        vec![Duration::from_secs(1), Duration::from_secs(7)]
    );

    let denied_context = runtime_context("/tmp/primitive-runtime-browser-denied");
    let mut denied_io = MemoryAuthIo::default();
    let mut denied_http = FakeAuthHttp::default();
    denied_http.push_json(json!({
        "success": true,
        "data": {
            "device_code": "device-code",
            "expires_in": 600,
            "interval": 5,
            "user_code": "ABCD-EFGH",
            "verification_uri_complete": "https://primitive.dev/device"
        }
    }));
    denied_http.push_error(400, "access_denied");

    let error = execute_auth_command_with(
        &AuthCommand::BrowserLogin {
            flags: BrowserLoginFlags::default(),
            verb: BrowserLoginVerb::Signin,
        },
        &denied_context,
        &mut denied_io,
        &mut denied_http,
    )
    .expect_err("denied browser login should fail")
    .to_string();

    assert!(error.contains("Primitive CLI login was denied in the browser."));
}
