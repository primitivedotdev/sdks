use crate::{client, config};
use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, SecondsFormat, Utc};
use reqwest::Method;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::io::{IsTerminal, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command as ProcessCommand, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

pub const CREDENTIALS_FILE: &str = "credentials.json";
pub const CREDENTIALS_LOCK_DIR: &str = "credentials.lock";
pub const CHAT_STATE_FILE: &str = "chat-state.json";
pub const PENDING_SIGNUP_FILE: &str = "signup.json";
pub const MAX_CLI_LOGIN_POLL_INTERVAL_SECONDS: u64 = 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BrowserLoginVerb {
    Login,
    Signin,
}

impl BrowserLoginVerb {
    pub fn retry_command(self) -> &'static str {
        match self {
            Self::Login => "login",
            Self::Signin => "signin",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EmailCodeFlow {
    Signup,
    Signin,
    Login,
    SigninOtp,
    LoginOtp,
    Otp,
}

impl EmailCodeFlow {
    pub fn action_noun(self) -> &'static str {
        match self {
            Self::Signup => "signup",
            Self::Signin | Self::SigninOtp => "sign-in",
            Self::Login | Self::LoginOtp => "login",
            Self::Otp => "email-code auth",
        }
    }

    pub fn action_gerund(self) -> &'static str {
        match self {
            Self::Signup => "creating a new account",
            Self::Signin | Self::SigninOtp => "signing in",
            Self::Login | Self::LoginOtp => "logging in",
            Self::Otp => "authenticating",
        }
    }

    pub fn code_required(self) -> bool {
        !matches!(self, Self::Signup)
    }

    pub fn start_command(self, email: &str) -> String {
        match self {
            Self::Signup => format!("signup {email}"),
            Self::Signin => format!("signin {email}"),
            Self::Login => format!("login {email}"),
            Self::SigninOtp => format!("signin otp {email}"),
            Self::LoginOtp => format!("login otp {email}"),
            Self::Otp => format!("otp {email}"),
        }
    }

    pub fn confirm_command(self, email: &str) -> String {
        match self {
            Self::Signup => format!("signup confirm {email} <code>"),
            Self::Signin => format!("signin confirm {email} <code>"),
            Self::Login => format!("login confirm {email} <code>"),
            Self::SigninOtp => format!("signin otp confirm {email} <code>"),
            Self::LoginOtp => format!("login otp confirm {email} <code>"),
            Self::Otp => format!("otp confirm {email} <code>"),
        }
    }

    pub fn resend_command(self, email: &str) -> String {
        match self {
            Self::Signup => format!("signup resend {email}"),
            Self::Signin => format!("signin resend {email}"),
            Self::Login => format!("login resend {email}"),
            Self::SigninOtp => format!("signin otp resend {email}"),
            Self::LoginOtp => format!("login otp resend {email}"),
            Self::Otp => format!("otp resend {email}"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct StartEmailCodeFlags {
    pub accept_terms: bool,
    pub api_base_url: Option<String>,
    pub device_name: Option<String>,
    pub force: bool,
    pub signup_code: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ConfirmEmailCodeFlags {
    pub api_base_url: Option<String>,
    pub code_from_env: Option<String>,
    pub code_from_file: Option<String>,
    pub code_from_stdin: bool,
    pub force: bool,
    pub org_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct BrowserLoginFlags {
    pub api_base_url: Option<String>,
    pub device_name: Option<String>,
    pub force: bool,
    pub no_browser: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ResendEmailCodeFlags {
    pub api_base_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct SignupStatusFlags {
    pub api_base_url: Option<String>,
    pub json: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct LogoutFlags {
    pub api_base_url: Option<String>,
    pub force: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct WhoamiFlags {
    pub api_base_url: Option<String>,
    pub api_key: Option<String>,
    pub json: bool,
    pub time: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuthCommand {
    BrowserLogin {
        flags: BrowserLoginFlags,
        verb: BrowserLoginVerb,
    },
    StartEmailCode {
        email: Option<String>,
        flags: StartEmailCodeFlags,
        flow: EmailCodeFlow,
    },
    ConfirmEmailCode {
        code: String,
        email: String,
        flags: ConfirmEmailCodeFlags,
        flow: EmailCodeFlow,
    },
    ResendEmailCode {
        email: Option<String>,
        flags: ResendEmailCodeFlags,
        flow: EmailCodeFlow,
    },
    SignupInteractive {
        flags: StartEmailCodeFlags,
    },
    SignupStatus {
        email: Option<String>,
        flags: SignupStatusFlags,
    },
    Logout {
        flags: LogoutFlags,
    },
    Whoami {
        flags: WhoamiFlags,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthCommandId {
    Login,
    LoginBrowser,
    LoginConfirm,
    LoginOtp,
    LoginOtpConfirm,
    LoginOtpResend,
    LoginResend,
    Otp,
    OtpConfirm,
    OtpResend,
    Signin,
    SigninBrowser,
    SigninConfirm,
    SigninOtp,
    SigninOtpConfirm,
    SigninOtpResend,
    SigninResend,
    Signup,
    SignupConfirm,
    SignupInteractive,
    SignupResend,
    SignupStatus,
    Logout,
    Whoami,
}

impl AuthCommandId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Login => "login",
            Self::LoginBrowser => "login:browser",
            Self::LoginConfirm => "login:confirm",
            Self::LoginOtp => "login:otp",
            Self::LoginOtpConfirm => "login:otp:confirm",
            Self::LoginOtpResend => "login:otp:resend",
            Self::LoginResend => "login:resend",
            Self::Otp => "otp",
            Self::OtpConfirm => "otp:confirm",
            Self::OtpResend => "otp:resend",
            Self::Signin => "signin",
            Self::SigninBrowser => "signin:browser",
            Self::SigninConfirm => "signin:confirm",
            Self::SigninOtp => "signin:otp",
            Self::SigninOtpConfirm => "signin:otp:confirm",
            Self::SigninOtpResend => "signin:otp:resend",
            Self::SigninResend => "signin:resend",
            Self::Signup => "signup",
            Self::SignupConfirm => "signup:confirm",
            Self::SignupInteractive => "signup:interactive",
            Self::SignupResend => "signup:resend",
            Self::SignupStatus => "signup:status",
            Self::Logout => "logout",
            Self::Whoami => "whoami",
        }
    }

    fn dispatch_words(self) -> &'static [&'static str] {
        match self {
            Self::Login => &["login"],
            Self::LoginBrowser => &["login", "browser"],
            Self::LoginConfirm => &["login", "confirm"],
            Self::LoginOtp => &["login", "otp"],
            Self::LoginOtpConfirm => &["login", "otp", "confirm"],
            Self::LoginOtpResend => &["login", "otp", "resend"],
            Self::LoginResend => &["login", "resend"],
            Self::Otp => &["otp"],
            Self::OtpConfirm => &["otp", "confirm"],
            Self::OtpResend => &["otp", "resend"],
            Self::Signin => &["signin"],
            Self::SigninBrowser => &["signin", "browser"],
            Self::SigninConfirm => &["signin", "confirm"],
            Self::SigninOtp => &["signin", "otp"],
            Self::SigninOtpConfirm => &["signin", "otp", "confirm"],
            Self::SigninOtpResend => &["signin", "otp", "resend"],
            Self::SigninResend => &["signin", "resend"],
            Self::Signup => &["signup"],
            Self::SignupConfirm => &["signup", "confirm"],
            Self::SignupInteractive => &["signup", "interactive"],
            Self::SignupResend => &["signup", "resend"],
            Self::SignupStatus => &["signup", "status"],
            Self::Logout => &["logout"],
            Self::Whoami => &["whoami"],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IdentifiedAuthCommand {
    pub args: Vec<String>,
    pub id: AuthCommandId,
}

impl IdentifiedAuthCommand {
    pub fn dispatch_args(&self) -> Vec<String> {
        self.id
            .dispatch_words()
            .iter()
            .map(|value| (*value).to_string())
            .chain(self.args.iter().cloned())
            .collect()
    }
}

pub fn is_auth_friendly_command(command: &str) -> bool {
    auth_command_id_from_colon(command).is_some()
        || matches!(
            command,
            "login" | "otp" | "signin" | "signup" | "logout" | "whoami"
        )
}

pub fn identify_auth_command(args: &[String]) -> Option<IdentifiedAuthCommand> {
    let (first, rest) = args.split_first()?;
    let (id, consumed_rest) = identify_auth_command_parts(first, rest)?;
    Some(IdentifiedAuthCommand {
        args: rest[consumed_rest..].to_vec(),
        id,
    })
}

pub fn dispatch_identified_auth_command(args: &[String]) -> Result<AuthCommand> {
    let identified = identify_auth_command(args).ok_or_else(|| {
        crate::usage_err!(
            "Unknown auth command: {}",
            args.first().map_or("", String::as_str)
        )
    })?;
    dispatch(&identified.dispatch_args())
}

pub fn dispatch_auth_command(command: &str, rest: &[String]) -> Result<AuthCommand> {
    let args: Vec<String> = std::iter::once(command.to_string())
        .chain(rest.iter().cloned())
        .collect();
    dispatch_identified_auth_command(&args)
}

pub fn dispatch(args: &[String]) -> Result<AuthCommand> {
    let (command, rest) = args
        .split_first()
        .ok_or_else(|| crate::usage_err!("Missing auth command."))?;
    match command.as_str() {
        "login" => parse_login_or_signin(rest, BrowserLoginVerb::Login),
        "signin" => parse_login_or_signin(rest, BrowserLoginVerb::Signin),
        "otp" => parse_otp(rest),
        "signup" => parse_signup(rest),
        "logout" => parse_logout(rest),
        "whoami" => parse_whoami(rest),
        other => Err(crate::usage_err!("Unknown auth command: {other}")),
    }
}

fn identify_auth_command_parts(first: &str, rest: &[String]) -> Option<(AuthCommandId, usize)> {
    if first.contains(':') {
        let id = auth_command_id_from_colon(first)?;
        return Some((id, 0));
    }
    match first {
        "login" => identify_login_or_signin_id(rest, AuthCommandId::Login),
        "signin" => identify_login_or_signin_id(rest, AuthCommandId::Signin),
        "otp" => match rest.first().map(String::as_str) {
            Some("confirm") => Some((AuthCommandId::OtpConfirm, 1)),
            Some("resend") => Some((AuthCommandId::OtpResend, 1)),
            _ => Some((AuthCommandId::Otp, 0)),
        },
        "signup" => match rest.first().map(String::as_str) {
            Some("confirm") => Some((AuthCommandId::SignupConfirm, 1)),
            Some("interactive") => Some((AuthCommandId::SignupInteractive, 1)),
            Some("resend") => Some((AuthCommandId::SignupResend, 1)),
            Some("status") => Some((AuthCommandId::SignupStatus, 1)),
            _ => Some((AuthCommandId::Signup, 0)),
        },
        "logout" => Some((AuthCommandId::Logout, 0)),
        "whoami" => Some((AuthCommandId::Whoami, 0)),
        _ => None,
    }
}

fn identify_login_or_signin_id(
    rest: &[String],
    bare: AuthCommandId,
) -> Option<(AuthCommandId, usize)> {
    let signin = bare == AuthCommandId::Signin;
    match rest.first().map(String::as_str) {
        Some("browser") => Some((
            if signin {
                AuthCommandId::SigninBrowser
            } else {
                AuthCommandId::LoginBrowser
            },
            1,
        )),
        Some("confirm") => Some((
            if signin {
                AuthCommandId::SigninConfirm
            } else {
                AuthCommandId::LoginConfirm
            },
            1,
        )),
        Some("resend") => Some((
            if signin {
                AuthCommandId::SigninResend
            } else {
                AuthCommandId::LoginResend
            },
            1,
        )),
        Some("otp") => match rest.get(1).map(String::as_str) {
            Some("confirm") => Some((
                if signin {
                    AuthCommandId::SigninOtpConfirm
                } else {
                    AuthCommandId::LoginOtpConfirm
                },
                2,
            )),
            Some("resend") => Some((
                if signin {
                    AuthCommandId::SigninOtpResend
                } else {
                    AuthCommandId::LoginOtpResend
                },
                2,
            )),
            _ => Some((
                if signin {
                    AuthCommandId::SigninOtp
                } else {
                    AuthCommandId::LoginOtp
                },
                1,
            )),
        },
        _ => Some((bare, 0)),
    }
}

fn auth_command_id_from_colon(command: &str) -> Option<AuthCommandId> {
    Some(match command {
        "login" => AuthCommandId::Login,
        "login:browser" => AuthCommandId::LoginBrowser,
        "login:confirm" => AuthCommandId::LoginConfirm,
        "login:otp" => AuthCommandId::LoginOtp,
        "login:otp:confirm" => AuthCommandId::LoginOtpConfirm,
        "login:otp:resend" => AuthCommandId::LoginOtpResend,
        "login:resend" => AuthCommandId::LoginResend,
        "otp" => AuthCommandId::Otp,
        "otp:confirm" => AuthCommandId::OtpConfirm,
        "otp:resend" => AuthCommandId::OtpResend,
        "signin" => AuthCommandId::Signin,
        "signin:browser" => AuthCommandId::SigninBrowser,
        "signin:confirm" => AuthCommandId::SigninConfirm,
        "signin:otp" => AuthCommandId::SigninOtp,
        "signin:otp:confirm" => AuthCommandId::SigninOtpConfirm,
        "signin:otp:resend" => AuthCommandId::SigninOtpResend,
        "signin:resend" => AuthCommandId::SigninResend,
        "signup" => AuthCommandId::Signup,
        "signup:confirm" => AuthCommandId::SignupConfirm,
        "signup:interactive" => AuthCommandId::SignupInteractive,
        "signup:resend" => AuthCommandId::SignupResend,
        "signup:status" => AuthCommandId::SignupStatus,
        "logout" => AuthCommandId::Logout,
        "whoami" => AuthCommandId::Whoami,
        _ => return None,
    })
}

const BROWSER_VALUE_FLAGS: &[&str] = &["api-base-url", "device-name"];
const BROWSER_BOOL_FLAGS: &[&str] = &["force", "no-browser"];
const CONFIRM_VALUE_FLAGS: &[&str] = &["api-base-url", "code-from-env", "code-from-file", "org-id"];
const CONFIRM_BOOL_FLAGS: &[&str] = &["code-from-stdin", "force"];
const LOGIN_OR_SIGNIN_VALUE_FLAGS: &[&str] = &["api-base-url", "device-name", "signup-code"];
const LOGIN_OR_SIGNIN_BOOL_FLAGS: &[&str] = &["accept-terms", "force", "no-browser"];
const LOGOUT_VALUE_FLAGS: &[&str] = &["api-base-url"];
const LOGOUT_BOOL_FLAGS: &[&str] = &["force"];
const RESEND_VALUE_FLAGS: &[&str] = &["api-base-url"];
const RESEND_BOOL_FLAGS: &[&str] = &[];
const SIGNUP_STATUS_VALUE_FLAGS: &[&str] = &["api-base-url"];
const SIGNUP_STATUS_BOOL_FLAGS: &[&str] = &["json"];
const START_VALUE_FLAGS: &[&str] = &["api-base-url", "device-name", "signup-code"];
const START_BOOL_FLAGS: &[&str] = &["accept-terms", "force"];
const WHOAMI_VALUE_FLAGS: &[&str] = &["api-base-url", "api-key"];
const WHOAMI_BOOL_FLAGS: &[&str] = &["json", "time"];

fn parse_login_or_signin(args: &[String], verb: BrowserLoginVerb) -> Result<AuthCommand> {
    let top_flow = match verb {
        BrowserLoginVerb::Login => EmailCodeFlow::Login,
        BrowserLoginVerb::Signin => EmailCodeFlow::Signin,
    };
    let otp_flow = match verb {
        BrowserLoginVerb::Login => EmailCodeFlow::LoginOtp,
        BrowserLoginVerb::Signin => EmailCodeFlow::SigninOtp,
    };

    match args.first().map(String::as_str) {
        Some("browser") => {
            let parsed = ParsedArgs::parse(&args[1..], BROWSER_VALUE_FLAGS, BROWSER_BOOL_FLAGS)?;
            parsed.require_no_positionals("browser login")?;
            Ok(AuthCommand::BrowserLogin {
                flags: browser_flags(&parsed),
                verb,
            })
        }
        Some("confirm") => parse_confirm(&args[1..], top_flow),
        Some("resend") => parse_resend(&args[1..], top_flow, true),
        Some("otp") => parse_otp_under_login(&args[1..], otp_flow),
        _ => {
            let parsed = ParsedArgs::parse(
                args,
                LOGIN_OR_SIGNIN_VALUE_FLAGS,
                LOGIN_OR_SIGNIN_BOOL_FLAGS,
            )?;
            if parsed.positionals.is_empty() {
                let start_flags = start_flags(&parsed);
                if start_flags.signup_code.is_some() || start_flags.accept_terms {
                    return Err(crate::usage_err!(
                        "Email-code auth needs an email address. Run `primitive {} --signup-code <code> --accept-terms`.",
                        top_flow.start_command("<email>")
                    ));
                }
                Ok(AuthCommand::BrowserLogin {
                    flags: browser_flags(&parsed),
                    verb,
                })
            } else {
                if parsed.bool("no-browser") {
                    return Err(crate::usage_err!("Unknown flag --no-browser"));
                }
                parse_start_from_parsed(parsed, top_flow)
            }
        }
    }
}

fn parse_otp_under_login(args: &[String], flow: EmailCodeFlow) -> Result<AuthCommand> {
    match args.first().map(String::as_str) {
        Some("confirm") => parse_confirm(&args[1..], flow),
        Some("resend") => parse_resend(&args[1..], flow, true),
        _ => {
            let parsed = ParsedArgs::parse(args, START_VALUE_FLAGS, START_BOOL_FLAGS)?;
            parse_start_from_parsed(parsed, flow)
        }
    }
}

fn parse_otp(args: &[String]) -> Result<AuthCommand> {
    match args.first().map(String::as_str) {
        Some("confirm") => parse_confirm(&args[1..], EmailCodeFlow::Otp),
        Some("resend") => parse_resend(&args[1..], EmailCodeFlow::Otp, true),
        _ => {
            let parsed = ParsedArgs::parse(args, START_VALUE_FLAGS, START_BOOL_FLAGS)?;
            parse_start_from_parsed(parsed, EmailCodeFlow::Otp)
        }
    }
}

fn parse_signup(args: &[String]) -> Result<AuthCommand> {
    match args.first().map(String::as_str) {
        Some("confirm") => parse_confirm(&args[1..], EmailCodeFlow::Signup),
        Some("resend") => parse_resend(&args[1..], EmailCodeFlow::Signup, false),
        Some("status") => {
            let parsed = ParsedArgs::parse(
                &args[1..],
                SIGNUP_STATUS_VALUE_FLAGS,
                SIGNUP_STATUS_BOOL_FLAGS,
            )?;
            let email = optional_single_positional(&parsed, "signup status")?;
            Ok(AuthCommand::SignupStatus {
                email,
                flags: SignupStatusFlags {
                    api_base_url: parsed.value("api-base-url"),
                    json: parsed.bool("json"),
                },
            })
        }
        Some("interactive") => {
            let parsed = ParsedArgs::parse(&args[1..], START_VALUE_FLAGS, START_BOOL_FLAGS)?;
            parsed.require_no_positionals("signup interactive")?;
            Ok(AuthCommand::SignupInteractive {
                flags: start_flags(&parsed),
            })
        }
        _ => {
            let parsed = ParsedArgs::parse(args, START_VALUE_FLAGS, START_BOOL_FLAGS)?;
            parse_start_from_parsed(parsed, EmailCodeFlow::Signup)
        }
    }
}

fn parse_logout(args: &[String]) -> Result<AuthCommand> {
    let parsed = ParsedArgs::parse(args, LOGOUT_VALUE_FLAGS, LOGOUT_BOOL_FLAGS)?;
    parsed.require_no_positionals("logout")?;
    Ok(AuthCommand::Logout {
        flags: LogoutFlags {
            api_base_url: parsed.value("api-base-url"),
            force: parsed.bool("force"),
        },
    })
}

fn parse_whoami(args: &[String]) -> Result<AuthCommand> {
    let parsed = ParsedArgs::parse(args, WHOAMI_VALUE_FLAGS, WHOAMI_BOOL_FLAGS)?;
    parsed.require_no_positionals("whoami")?;
    Ok(AuthCommand::Whoami {
        flags: WhoamiFlags {
            api_base_url: parsed.value("api-base-url"),
            api_key: parsed.value("api-key"),
            json: parsed.bool("json"),
            time: parsed.bool("time"),
        },
    })
}

fn parse_confirm(args: &[String], flow: EmailCodeFlow) -> Result<AuthCommand> {
    let parsed = ParsedArgs::parse(args, CONFIRM_VALUE_FLAGS, CONFIRM_BOOL_FLAGS)?;
    if parsed.positionals.is_empty() {
        return Err(crate::usage_err!(
            "{} confirm expects <email> [code].",
            flow.action_noun()
        ));
    }
    if parsed.positionals.len() > 2 {
        return Err(crate::usage_err!(
            "{} confirm received too many positional arguments.",
            flow.action_noun()
        ));
    }
    let flags = ConfirmEmailCodeFlags {
        api_base_url: parsed.value("api-base-url"),
        code_from_env: parsed.value("code-from-env"),
        code_from_file: parsed.value("code-from-file"),
        code_from_stdin: parsed.bool("code-from-stdin"),
        force: parsed.bool("force"),
        org_id: parsed.value("org-id"),
    };
    validate_verification_code_sources(parsed.positionals.get(1).map(String::as_str), &flags)?;
    Ok(AuthCommand::ConfirmEmailCode {
        email: parsed.positionals[0].clone(),
        code: parsed.positionals.get(1).cloned().unwrap_or_default(),
        flags,
        flow,
    })
}

fn parse_resend(args: &[String], flow: EmailCodeFlow, email_required: bool) -> Result<AuthCommand> {
    let parsed = ParsedArgs::parse(args, RESEND_VALUE_FLAGS, RESEND_BOOL_FLAGS)?;
    let email = if email_required {
        if parsed.positionals.len() != 1 {
            return Err(crate::usage_err!(
                "{} resend expects <email>.",
                flow.action_noun()
            ));
        }
        Some(parsed.positionals[0].clone())
    } else {
        optional_single_positional(&parsed, "signup resend")?
    };
    Ok(AuthCommand::ResendEmailCode {
        email,
        flags: ResendEmailCodeFlags {
            api_base_url: parsed.value("api-base-url"),
        },
        flow,
    })
}

fn parse_start_from_parsed(parsed: ParsedArgs, flow: EmailCodeFlow) -> Result<AuthCommand> {
    let email = optional_single_positional(&parsed, flow.action_noun())?;
    Ok(AuthCommand::StartEmailCode {
        email,
        flags: start_flags(&parsed),
        flow,
    })
}

fn start_flags(parsed: &ParsedArgs) -> StartEmailCodeFlags {
    StartEmailCodeFlags {
        accept_terms: parsed.bool("accept-terms"),
        api_base_url: parsed.value("api-base-url"),
        device_name: parsed.value("device-name"),
        force: parsed.bool("force"),
        signup_code: non_empty_optional(parsed.value("signup-code")),
    }
}

fn browser_flags(parsed: &ParsedArgs) -> BrowserLoginFlags {
    BrowserLoginFlags {
        api_base_url: parsed.value("api-base-url"),
        device_name: parsed.value("device-name"),
        force: parsed.bool("force"),
        no_browser: parsed.bool("no-browser"),
    }
}

fn optional_single_positional(parsed: &ParsedArgs, label: &str) -> Result<Option<String>> {
    match parsed.positionals.as_slice() {
        [] => Ok(None),
        [value] => Ok(Some(value.clone())),
        _ => Err(crate::usage_err!(
            "{label} received too many positional arguments."
        )),
    }
}

fn non_empty_optional(value: Option<String>) -> Option<String> {
    value.and_then(|item| {
        let trimmed = item.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(item)
        }
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Default)]
struct ParsedArgs {
    bool_flags: BTreeSet<String>,
    flags: BTreeMap<String, String>,
    positionals: Vec<String>,
}

impl ParsedArgs {
    fn parse(args: &[String], value_flags: &[&str], bool_flags: &[&str]) -> Result<Self> {
        let mut parsed = Self::default();
        let mut index = 0;
        while index < args.len() {
            let arg = &args[index];
            if arg == "--" {
                parsed.positionals.extend(args[index + 1..].iter().cloned());
                break;
            }
            if arg == "-f" {
                if !bool_flags.contains(&"force") {
                    return Err(crate::usage_err!("Unknown flag -f"));
                }
                parsed.bool_flags.insert("force".to_string());
                index += 1;
                continue;
            }
            if let Some(name) = arg.strip_prefix("--no-") {
                if name == "browser" && bool_flags.contains(&"no-browser") {
                    parsed.bool_flags.insert("no-browser".to_string());
                    index += 1;
                    continue;
                }
                return Err(crate::usage_err!("Unknown flag --no-{name}"));
            }
            if let Some(raw) = arg.strip_prefix("--") {
                let (name, inline_value) = raw
                    .split_once('=')
                    .map_or((raw, None), |(name, value)| (name, Some(value)));
                if bool_flags.contains(&name) {
                    if inline_value.is_some() {
                        return Err(crate::usage_err!("Flag --{name} does not take a value."));
                    }
                    parsed.bool_flags.insert(name.to_string());
                    index += 1;
                    continue;
                }
                if !value_flags.contains(&name) {
                    return Err(crate::usage_err!("Unknown flag --{name}"));
                }
                let value = if let Some(value) = inline_value {
                    value.to_string()
                } else {
                    index += 1;
                    let value = args
                        .get(index)
                        .ok_or_else(|| crate::usage_err!("Missing value for --{name}"))?;
                    if value.starts_with("--") {
                        return Err(crate::usage_err!("Missing value for --{name}"));
                    }
                    value.clone()
                };
                parsed.flags.insert(name.to_string(), value);
                index += 1;
                continue;
            }
            parsed.positionals.push(arg.clone());
            index += 1;
        }
        Ok(parsed)
    }

    fn bool(&self, name: &str) -> bool {
        self.bool_flags.contains(name)
    }

    fn value(&self, name: &str) -> Option<String> {
        self.flags.get(name).cloned()
    }

    fn require_no_positionals(&self, label: &str) -> Result<()> {
        if self.positionals.is_empty() {
            Ok(())
        } else {
            Err(crate::usage_err!(
                "{label} received unexpected positional arguments."
            ))
        }
    }
}

fn selected_verification_code_sources<'a>(
    positional_code: Option<&str>,
    flags: &'a ConfirmEmailCodeFlags,
) -> Vec<&'a str> {
    let mut sources = Vec::new();
    if positional_code.is_some() {
        sources.push("positional");
    }
    if flags.code_from_stdin {
        sources.push("--code-from-stdin");
    }
    if flags.code_from_file.is_some() {
        sources.push("--code-from-file");
    }
    if flags.code_from_env.is_some() {
        sources.push("--code-from-env");
    }
    sources
}

fn validate_verification_code_sources(
    positional_code: Option<&str>,
    flags: &ConfirmEmailCodeFlags,
) -> Result<()> {
    let sources = selected_verification_code_sources(positional_code, flags);
    if sources.is_empty() {
        return Err(crate::usage_err!(
            "Pass the verification code as a positional argument or via one of --code-from-stdin, --code-from-file, or --code-from-env."
        ));
    }
    if sources.len() > 1 {
        return Err(crate::usage_err!(
            "Pass exactly one source for the verification code; got {}.",
            sources.join(", ")
        ));
    }
    Ok(())
}

fn has_non_positional_verification_code_source(flags: &ConfirmEmailCodeFlags) -> bool {
    flags.code_from_stdin || flags.code_from_file.is_some() || flags.code_from_env.is_some()
}

fn strip_trailing_verification_code_newline(value: &str) -> String {
    value
        .strip_suffix("\r\n")
        .or_else(|| value.strip_suffix('\n'))
        .unwrap_or(value)
        .to_string()
}

pub fn resolve_verification_code(
    positional_code: Option<&str>,
    flags: &ConfirmEmailCodeFlags,
    io: &mut impl AuthRuntimeIo,
) -> Result<String> {
    validate_verification_code_sources(positional_code, flags)?;
    if let Some(code) = positional_code {
        return Ok(code.to_string());
    }
    if let Some(name) = &flags.code_from_env {
        let value = io.env_var(name)?;
        return value
            .map(|value| strip_trailing_verification_code_newline(&value))
            .ok_or_else(|| anyhow!("--code-from-env {name}: environment variable is not set."));
    }
    if let Some(path) = &flags.code_from_file {
        let value = io
            .read_to_string(path)
            .map_err(|error| anyhow!("--code-from-file {path}: could not read file: {error}"))?
            .ok_or_else(|| {
                anyhow!("--code-from-file {path}: could not read file: file not found")
            })?;
        return Ok(strip_trailing_verification_code_newline(&value));
    }
    let value = io
        .read_stdin_to_string()
        .map_err(|error| anyhow!("--code-from-stdin: {error}"))?;
    Ok(strip_trailing_verification_code_newline(&value))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StartAgentSignupRequest {
    pub device_name: String,
    pub email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signup_code: Option<String>,
    pub terms_accepted: bool,
}

pub fn build_start_agent_signup_body(
    email: &str,
    flags: &StartEmailCodeFlags,
    fallback_device_name: &str,
) -> Result<Value> {
    if !flags.accept_terms {
        return Err(crate::usage_err!(
            "terms must be accepted before starting Primitive email-code auth"
        ));
    }
    let request = StartAgentSignupRequest {
        device_name: flags
            .device_name
            .clone()
            .filter(|item| !item.trim().is_empty())
            .unwrap_or_else(|| fallback_device_name.to_string()),
        email: email.to_string(),
        signup_code: non_empty_optional(flags.signup_code.clone()),
        terms_accepted: true,
    };
    Ok(serde_json::to_value(request)?)
}

pub fn required_signup_code(
    flow: EmailCodeFlow,
    flags: &StartEmailCodeFlags,
) -> Result<Option<String>> {
    match (
        flow.code_required(),
        non_empty_optional(flags.signup_code.clone()),
    ) {
        (_, Some(code)) => Ok(Some(code)),
        (false, None) => Ok(None),
        (true, None) => Err(crate::usage_err!(
            "{} requires --signup-code <code> before starting.",
            flow.action_noun()
        )),
    }
}

pub fn build_start_cli_login_body(device_name: Option<&str>, fallback_device_name: &str) -> Value {
    json!({
        "device_name": device_name
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .unwrap_or(fallback_device_name)
    })
}

pub fn build_poll_cli_login_body(device_code: &str) -> Value {
    json!({ "device_code": device_code })
}

pub fn build_resend_agent_signup_body(signup_token: &str) -> Value {
    json!({ "signup_token": signup_token })
}

pub fn build_verify_agent_signup_body(
    pending: &PendingAgentSignup,
    verification_code: &str,
    org_id: Option<&str>,
) -> Value {
    let mut body = json!({
        "signup_token": pending.signup_token,
        "verification_code": verification_code,
    });
    if let Some(org_id) = org_id.filter(|item| !item.trim().is_empty()) {
        body["org_id"] = json!(org_id);
    }
    body
}

pub fn build_cli_logout_body(credentials: &StoredCliCredentials) -> Value {
    json!({ "key_id": credentials.oauth_grant_id })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentSignupStartResult {
    pub signup_token: String,
    pub email: String,
    pub expires_in: u64,
    pub resend_after: u64,
    pub verification_code_length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentSignupResendResult {
    pub email: String,
    pub expires_in: u64,
    pub resend_after: u64,
    pub verification_code_length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PendingAgentSignup {
    pub api_base_url: String,
    pub created_at: String,
    pub email: String,
    pub expires_at: String,
    pub expires_in: u64,
    pub resend_after: u64,
    pub signup_token: String,
    pub verification_code_length: u64,
}

impl PendingAgentSignup {
    pub fn from_start(
        start: AgentSignupStartResult,
        api_base_url: &str,
        created_at: &str,
        expires_at: &str,
    ) -> Self {
        Self {
            api_base_url: api_base_url.to_string(),
            created_at: created_at.to_string(),
            email: start.email,
            expires_at: expires_at.to_string(),
            expires_in: start.expires_in,
            resend_after: start.resend_after,
            signup_token: start.signup_token,
            verification_code_length: start.verification_code_length,
        }
    }

    pub fn from_resend(
        previous: &Self,
        resend: AgentSignupResendResult,
        created_at: &str,
        expires_at: &str,
    ) -> Self {
        Self {
            api_base_url: previous.api_base_url.clone(),
            created_at: created_at.to_string(),
            email: resend.email,
            expires_at: expires_at.to_string(),
            expires_in: resend.expires_in,
            resend_after: resend.resend_after,
            signup_token: previous.signup_token.clone(),
            verification_code_length: resend.verification_code_length,
        }
    }
}

pub fn pending_signup_path(config_dir: &str) -> String {
    format!(
        "{}/{}",
        config_dir.trim_end_matches('/'),
        PENDING_SIGNUP_FILE
    )
}

pub fn credentials_path(config_dir: &str) -> String {
    format!("{}/{}", config_dir.trim_end_matches('/'), CREDENTIALS_FILE)
}

pub fn credentials_lock_path(config_dir: &str) -> String {
    format!(
        "{}/{}",
        config_dir.trim_end_matches('/'),
        CREDENTIALS_LOCK_DIR
    )
}

pub fn chat_state_path(config_dir: &str) -> String {
    format!("{}/{}", config_dir.trim_end_matches('/'), CHAT_STATE_FILE)
}

pub fn serialize_pending_signup(pending: &PendingAgentSignup) -> Result<String> {
    Ok(format!("{}\n", serde_json::to_string_pretty(pending)?))
}

pub fn parse_pending_signup(value: &Value) -> Option<PendingAgentSignup> {
    serde_json::from_value(value.clone()).ok()
}

pub fn pending_signup_status(
    pending: Option<&PendingAgentSignup>,
    flow: EmailCodeFlow,
    email: Option<&str>,
    now_epoch_ms: i64,
) -> Result<Value> {
    let Some(pending) = pending else {
        return Ok(json!({
            "code_length": null,
            "confirm_command": null,
            "email": null,
            "expired": false,
            "expires_at": null,
            "expires_in": null,
            "pending": false,
            "resend_after": null,
            "resend_command": null,
            "signup_command": "primitive signup <email> --accept-terms"
        }));
    };
    if let Some(email) = email {
        if normalize_email(&pending.email) != normalize_email(email) {
            return Err(anyhow!(
                "Pending {} is for {}, not {}.",
                flow.action_noun(),
                pending.email,
                email
            ));
        }
    }
    let expires_at_ms = parse_simple_utc_ms(&pending.expires_at);
    let expires_in = expires_at_ms.map(|value| ((value - now_epoch_ms) / 1000).max(0));
    Ok(json!({
        "code_length": pending.verification_code_length,
        "confirm_command": format!("primitive {}", flow.confirm_command(&pending.email)),
        "email": pending.email,
        "expired": expires_in.is_some_and(|value| value <= 0),
        "expires_at": pending.expires_at,
        "expires_in": expires_in,
        "pending": true,
        "resend_after": pending.resend_after,
        "resend_command": format!("primitive {}", flow.resend_command(&pending.email)),
    }))
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn parse_simple_utc_ms(value: &str) -> Option<i64> {
    let value = value.strip_suffix('Z').unwrap_or(value);
    let (date, time) = value.split_once('T')?;
    let mut date_parts = date.split('-');
    let year: i32 = date_parts.next()?.parse().ok()?;
    let month: i32 = date_parts.next()?.parse().ok()?;
    let day: i32 = date_parts.next()?.parse().ok()?;
    let mut time_parts = time.split(':');
    let hour: i32 = time_parts.next()?.parse().ok()?;
    let minute: i32 = time_parts.next()?.parse().ok()?;
    let seconds: f64 = time_parts.next()?.parse().ok()?;
    let epoch_days = days_from_civil(year, month, day);
    let whole_seconds = seconds.trunc() as i64;
    let millis = ((seconds.fract()) * 1000.0).round() as i64;
    Some(
        (((epoch_days * 24 + hour as i64) * 60 + minute as i64) * 60 + whole_seconds) * 1000
            + millis,
    )
}

fn days_from_civil(year: i32, month: i32, day: i32) -> i64 {
    let year = year - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * month + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    (era * 146097 + doe - 719468) as i64
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgentSignupVerifyResult {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub auth_method: String,
    pub oauth_grant_id: String,
    pub oauth_client_id: String,
    pub org_id: String,
    pub org_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CliLoginPollResult {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub oauth_grant_id: String,
    pub oauth_client_id: String,
    pub org_id: String,
    pub org_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StoredCliCredentials {
    pub auth_method: String,
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_at: String,
    pub oauth_grant_id: String,
    pub oauth_client_id: String,
    pub org_id: String,
    pub org_name: Option<String>,
    pub api_base_url: String,
    pub created_at: String,
}

impl StoredCliCredentials {
    pub fn from_signup(
        api_base_url: &str,
        signup: AgentSignupVerifyResult,
        created_at: &str,
        expires_at: &str,
    ) -> Self {
        Self {
            auth_method: "oauth".to_string(),
            access_token: signup.access_token,
            refresh_token: signup.refresh_token,
            token_type: signup.token_type,
            expires_at: expires_at.to_string(),
            oauth_grant_id: signup.oauth_grant_id,
            oauth_client_id: signup.oauth_client_id,
            org_id: signup.org_id,
            org_name: signup.org_name,
            api_base_url: api_base_url.to_string(),
            created_at: created_at.to_string(),
        }
    }

    pub fn from_browser_login(
        api_base_url: &str,
        login: CliLoginPollResult,
        created_at: &str,
        expires_at: &str,
    ) -> Self {
        Self {
            auth_method: "oauth".to_string(),
            access_token: login.access_token,
            refresh_token: login.refresh_token,
            token_type: login.token_type,
            expires_at: expires_at.to_string(),
            oauth_grant_id: login.oauth_grant_id,
            oauth_client_id: login.oauth_client_id,
            org_id: login.org_id,
            org_name: login.org_name,
            api_base_url: api_base_url.to_string(),
            created_at: created_at.to_string(),
        }
    }
}

pub fn serialize_credentials(credentials: &StoredCliCredentials) -> Result<String> {
    Ok(format!("{}\n", serde_json::to_string_pretty(credentials)?))
}

pub fn access_token_expires_at(now: SystemTime, expires_in_seconds: u64) -> SystemTime {
    now + Duration::from_secs(expires_in_seconds)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PendingStartDecision {
    StartNew,
    ContinueExisting {
        confirm_command: String,
        resend_command: String,
    },
    ReplaceExisting,
    Blocked {
        message: String,
    },
}

pub fn decide_pending_start(
    existing: Option<&PendingAgentSignup>,
    requested_email: &str,
    flow: EmailCodeFlow,
    force: bool,
) -> PendingStartDecision {
    let Some(existing) = existing else {
        return PendingStartDecision::StartNew;
    };
    if force {
        return PendingStartDecision::ReplaceExisting;
    }
    if normalize_email(&existing.email) == normalize_email(requested_email) {
        return PendingStartDecision::ContinueExisting {
            confirm_command: flow.confirm_command(&existing.email),
            resend_command: flow.resend_command(&existing.email),
        };
    }
    PendingStartDecision::Blocked {
        message: format!(
            "Pending {} is for {}. Run `primitive signup status` to inspect it, or `primitive {} --force` to replace it.",
            flow.action_noun(),
            existing.email,
            flow.start_command(requested_email)
        ),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PollDecision {
    Continue {
        next_poll_delay_seconds: u64,
        interval_seconds: u64,
    },
    SaveCredentials,
    Denied,
    Expired {
        retry_command: String,
    },
    InvalidDeviceCode {
        retry_command: String,
    },
    Failed,
}

pub fn initial_poll_interval_seconds(interval_seconds: u64) -> u64 {
    interval_seconds.clamp(1, MAX_CLI_LOGIN_POLL_INTERVAL_SECONDS)
}

pub fn decide_poll_error(
    code: &str,
    interval_seconds: u64,
    retry_after_seconds: Option<u64>,
    retry_command: &str,
) -> PollDecision {
    match code {
        "authorization_pending" => PollDecision::Continue {
            next_poll_delay_seconds: interval_seconds,
            interval_seconds,
        },
        "slow_down" => {
            let next_interval = retry_after_seconds
                .unwrap_or(interval_seconds.saturating_add(5))
                .min(MAX_CLI_LOGIN_POLL_INTERVAL_SECONDS);
            PollDecision::Continue {
                next_poll_delay_seconds: next_interval,
                interval_seconds: next_interval,
            }
        }
        "access_denied" => PollDecision::Denied,
        "expired_token" => PollDecision::Expired {
            retry_command: retry_command.to_string(),
        },
        "invalid_device_code" => PollDecision::InvalidDeviceCode {
            retry_command: retry_command.to_string(),
        },
        _ => PollDecision::Failed,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResendDecision {
    SavePending,
    Wait { retry_after_seconds: u64 },
    ClearPendingAndFail,
    Fail,
}

pub fn decide_resend_result(
    has_data: bool,
    error_code: Option<&str>,
    retry_after_seconds: Option<u64>,
    current_resend_after_seconds: u64,
) -> ResendDecision {
    if has_data {
        return ResendDecision::SavePending;
    }
    match error_code {
        Some("slow_down") => ResendDecision::Wait {
            retry_after_seconds: retry_after_seconds.unwrap_or(current_resend_after_seconds),
        },
        Some("expired_token" | "invalid_signup_token") => ResendDecision::ClearPendingAndFail,
        _ => ResendDecision::Fail,
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum VerifyDecision {
    SaveCredentials,
    InvalidCode,
    ClearPendingAndFail,
    Fail,
}

pub fn decide_verify_result(has_data: bool, error_code: Option<&str>) -> VerifyDecision {
    if has_data {
        return VerifyDecision::SaveCredentials;
    }
    match error_code {
        Some("invalid_verification_code") => VerifyDecision::InvalidCode,
        Some("expired_token" | "invalid_signup_token") => VerifyDecision::ClearPendingAndFail,
        _ => VerifyDecision::Fail,
    }
}

pub fn format_signup_seconds(seconds: Option<u64>) -> String {
    match seconds {
        Some(value) if value > 0 && value < 60 => format!("{value} seconds"),
        Some(value) if value >= 60 => {
            let minutes = value.div_ceil(60);
            if minutes == 1 {
                "1 minute".to_string()
            } else {
                format!("{minutes} minutes")
            }
        }
        _ => "soon".to_string(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CliLoginStartResult {
    pub device_code: String,
    pub expires_in: u64,
    pub interval: u64,
    pub user_code: String,
    pub verification_uri_complete: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct AuthRequestPlan {
    pub body: Option<Value>,
    pub include_auth: bool,
    pub method: &'static str,
    pub operation_id: &'static str,
    pub path: &'static str,
}

impl AuthRequestPlan {
    fn get(operation_id: &'static str, path: &'static str, include_auth: bool) -> Self {
        Self {
            body: None,
            include_auth,
            method: "GET",
            operation_id,
            path,
        }
    }

    fn post(
        operation_id: &'static str,
        path: &'static str,
        body: Value,
        include_auth: bool,
    ) -> Self {
        Self {
            body: Some(body),
            include_auth,
            method: "POST",
            operation_id,
            path,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum AuthCommandRequestPlan {
    BrowserLoginStart(AuthRequestPlan),
    ConfirmEmailCode(AuthRequestPlan),
    ForceLogout,
    Logout(AuthRequestPlan),
    ResendEmailCode(AuthRequestPlan),
    SignupInteractive,
    SignupStatus,
    StartEmailCode(AuthRequestPlan),
    Whoami(AuthRequestPlan),
}

#[derive(Debug, Clone, Copy, Default)]
pub struct AuthCommandRequestContext<'a> {
    pub credentials: Option<&'a StoredCliCredentials>,
    pub fallback_device_name: &'a str,
    pub pending: Option<&'a PendingAgentSignup>,
}

pub fn plan_auth_command_request(
    command: &AuthCommand,
    context: AuthCommandRequestContext<'_>,
) -> Result<AuthCommandRequestPlan> {
    match command {
        AuthCommand::BrowserLogin { flags, .. } => Ok(AuthCommandRequestPlan::BrowserLoginStart(
            plan_browser_login_start_request(flags, context.fallback_device_name),
        )),
        AuthCommand::StartEmailCode { email, flags, flow } => {
            let email = email.as_deref().ok_or_else(|| {
                crate::usage_err!("{} needs an email address.", flow.action_noun())
            })?;
            Ok(AuthCommandRequestPlan::StartEmailCode(
                plan_start_email_code_request(*flow, email, flags, context.fallback_device_name)?,
            ))
        }
        AuthCommand::ConfirmEmailCode {
            code,
            email,
            flags,
            flow,
        } => {
            let pending = required_pending_for_email(context.pending, *flow, email)?;
            Ok(AuthCommandRequestPlan::ConfirmEmailCode(
                plan_confirm_email_code_request(pending, code, flags),
            ))
        }
        AuthCommand::ResendEmailCode { email, flow, .. } => {
            let pending = match email {
                Some(email) => required_pending_for_email(context.pending, *flow, email)?,
                None => context.pending.ok_or_else(|| {
                    anyhow!(
                        "No pending {} found. Run `primitive signup status` to inspect pending state.",
                        flow.action_noun()
                    )
                })?,
            };
            Ok(AuthCommandRequestPlan::ResendEmailCode(
                plan_resend_email_code_request(pending),
            ))
        }
        AuthCommand::SignupInteractive { .. } => Ok(AuthCommandRequestPlan::SignupInteractive),
        AuthCommand::SignupStatus { .. } => Ok(AuthCommandRequestPlan::SignupStatus),
        AuthCommand::Logout { flags } => {
            if flags.force {
                return Ok(AuthCommandRequestPlan::ForceLogout);
            }
            let credentials = context.credentials.ok_or_else(|| {
                anyhow!("Not logged in. Run `primitive signin` to create saved CLI credentials.")
            })?;
            Ok(AuthCommandRequestPlan::Logout(plan_logout_request(
                credentials,
            )))
        }
        AuthCommand::Whoami { .. } => {
            Ok(AuthCommandRequestPlan::Whoami(plan_whoami_account_request()))
        }
    }
}

pub fn plan_start_email_code_request(
    flow: EmailCodeFlow,
    email: &str,
    flags: &StartEmailCodeFlags,
    fallback_device_name: &str,
) -> Result<AuthRequestPlan> {
    required_signup_code(flow, flags)?;
    Ok(AuthRequestPlan::post(
        "startAgentSignup",
        "/agent/signup/start",
        build_start_agent_signup_body(email, flags, fallback_device_name)?,
        false,
    ))
}

pub fn plan_browser_login_start_request(
    flags: &BrowserLoginFlags,
    fallback_device_name: &str,
) -> AuthRequestPlan {
    AuthRequestPlan::post(
        "startCliLogin",
        "/cli/login/start",
        build_start_cli_login_body(flags.device_name.as_deref(), fallback_device_name),
        false,
    )
}

pub fn plan_browser_login_poll_request(device_code: &str) -> AuthRequestPlan {
    AuthRequestPlan::post(
        "pollCliLogin",
        "/cli/login/poll",
        build_poll_cli_login_body(device_code),
        false,
    )
}

pub fn plan_confirm_email_code_request(
    pending: &PendingAgentSignup,
    code: &str,
    flags: &ConfirmEmailCodeFlags,
) -> AuthRequestPlan {
    AuthRequestPlan::post(
        "verifyAgentSignup",
        "/agent/signup/verify",
        build_verify_agent_signup_body(pending, code, flags.org_id.as_deref()),
        false,
    )
}

pub fn plan_resend_email_code_request(pending: &PendingAgentSignup) -> AuthRequestPlan {
    AuthRequestPlan::post(
        "resendAgentSignupVerification",
        "/agent/signup/resend",
        build_resend_agent_signup_body(&pending.signup_token),
        false,
    )
}

pub fn plan_logout_request(credentials: &StoredCliCredentials) -> AuthRequestPlan {
    AuthRequestPlan::post(
        "cliLogout",
        "/cli/logout",
        build_cli_logout_body(credentials),
        true,
    )
}

pub fn plan_whoami_account_request() -> AuthRequestPlan {
    AuthRequestPlan::get("getAccount", "/account", true)
}

pub fn plan_whoami_domains_request() -> AuthRequestPlan {
    AuthRequestPlan::get("listDomains", "/domains", true)
}

pub fn auth_flags_from_command(command: &AuthCommand) -> BTreeMap<String, String> {
    let mut extracted = BTreeMap::new();
    let api_base_url = match command {
        AuthCommand::BrowserLogin { flags, .. } => flags.api_base_url.as_deref(),
        AuthCommand::StartEmailCode { flags, .. } => flags.api_base_url.as_deref(),
        AuthCommand::ConfirmEmailCode { flags, .. } => flags.api_base_url.as_deref(),
        AuthCommand::ResendEmailCode { flags, .. } => flags.api_base_url.as_deref(),
        AuthCommand::SignupInteractive { flags } => flags.api_base_url.as_deref(),
        AuthCommand::SignupStatus { flags, .. } => flags.api_base_url.as_deref(),
        AuthCommand::Logout { flags } => flags.api_base_url.as_deref(),
        AuthCommand::Whoami { flags } => {
            if let Some(api_key) = &flags.api_key {
                extracted.insert("api-key".to_string(), api_key.clone());
            }
            flags.api_base_url.as_deref()
        }
    };
    if let Some(api_base_url) = api_base_url {
        extracted.insert("api-base-url".to_string(), api_base_url.to_string());
    }
    extracted
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PendingStateDecision {
    ClearExpired { expires_at: String },
    IgnoreDifferentApiBaseUrl { pending_api_base_url: String },
    Missing,
    Use { expires_in: u64 },
}

pub fn decide_pending_state(
    pending: Option<&PendingAgentSignup>,
    api_base_url: &str,
    now_epoch_ms: i64,
) -> PendingStateDecision {
    let Some(pending) = pending else {
        return PendingStateDecision::Missing;
    };
    if pending.api_base_url != api_base_url {
        return PendingStateDecision::IgnoreDifferentApiBaseUrl {
            pending_api_base_url: pending.api_base_url.clone(),
        };
    }
    let Some(expires_at_ms) = parse_simple_utc_ms(&pending.expires_at) else {
        return PendingStateDecision::Use {
            expires_in: pending.expires_in,
        };
    };
    if expires_at_ms <= now_epoch_ms {
        return PendingStateDecision::ClearExpired {
            expires_at: pending.expires_at.clone(),
        };
    }
    let remaining_ms = (expires_at_ms - now_epoch_ms) as u64;
    PendingStateDecision::Use {
        expires_in: remaining_ms.div_ceil(1000),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RequiredPendingDecision {
    Missing { message: String },
    Ready,
    WrongEmail { message: String },
}

pub fn decide_required_pending_for_email(
    pending: Option<&PendingAgentSignup>,
    flow: EmailCodeFlow,
    email: &str,
) -> RequiredPendingDecision {
    let Some(pending) = pending else {
        return RequiredPendingDecision::Missing {
            message: format!(
                "No pending {} for {}. Run `primitive signup status {}` to inspect pending state, or `primitive {}` first.",
                flow.action_noun(),
                email,
                email,
                flow.start_command(email)
            ),
        };
    };
    if normalize_email(&pending.email) != normalize_email(email) {
        return RequiredPendingDecision::WrongEmail {
            message: format!(
                "Pending {} is for {}, not {}. Run `primitive signup status` to inspect it, or `primitive {} --force` to replace it.",
                flow.action_noun(),
                pending.email,
                email,
                flow.start_command(email)
            ),
        };
    }
    RequiredPendingDecision::Ready
}

fn required_pending_for_email<'a>(
    pending: Option<&'a PendingAgentSignup>,
    flow: EmailCodeFlow,
    email: &str,
) -> Result<&'a PendingAgentSignup> {
    match decide_required_pending_for_email(pending, flow, email) {
        RequiredPendingDecision::Ready => Ok(pending.expect("ready pending")),
        RequiredPendingDecision::Missing { message }
        | RequiredPendingDecision::WrongEmail { message } => Err(anyhow!("{message}")),
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExistingCredentialDecision {
    Blocked { message: String },
    Continue,
    ContinueAfterRemovedStale { message: String },
    ReplaceExisting { message: String },
    ReplaceUnreadable { message: String },
    VerifyExisting,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ExistingLoginProbeStatus {
    Blocked { message: String },
    RemovedStale,
    Valid,
}

pub fn decide_existing_credentials_before_auth(
    existing: Option<&StoredCliCredentials>,
    load_error: Option<&str>,
    force: bool,
    flow: EmailCodeFlow,
    probe_status: Option<ExistingLoginProbeStatus>,
) -> ExistingCredentialDecision {
    if let Some(error) = load_error {
        if force {
            return ExistingCredentialDecision::ReplaceUnreadable {
                message: format!(
                    "Replacing unreadable Primitive CLI credentials because --force was set: {error}"
                ),
            };
        }
        return ExistingCredentialDecision::Blocked {
            message: error.to_string(),
        };
    }
    let Some(existing) = existing else {
        return ExistingCredentialDecision::Continue;
    };
    if force {
        return ExistingCredentialDecision::ReplaceExisting {
            message: format!(
                "Replacing saved Primitive CLI credentials after {} because --force was set.",
                flow.action_noun()
            ),
        };
    }
    match probe_status {
        None => ExistingCredentialDecision::VerifyExisting,
        Some(ExistingLoginProbeStatus::RemovedStale) => {
            ExistingCredentialDecision::ContinueAfterRemovedStale {
                message: "Continuing with Primitive signup...".to_string(),
            }
        }
        Some(ExistingLoginProbeStatus::Blocked { message }) => {
            ExistingCredentialDecision::Blocked { message }
        }
        Some(ExistingLoginProbeStatus::Valid) => {
            let org = existing
                .org_name
                .as_ref()
                .map(|name| format!(" for {name}"))
                .unwrap_or_default();
            ExistingCredentialDecision::Blocked {
                message: format!(
                    "Already logged in{org}. Run `primitive logout` before {}.",
                    flow.action_gerund()
                ),
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CredentialWritePlan {
    pub credentials_json: String,
    pub credentials_path: String,
    pub delete_chat_state: bool,
    pub delete_pending_path: Option<String>,
    pub stderr: Vec<String>,
}

pub fn plan_signup_credentials_write(
    config_dir: &str,
    api_base_url: &str,
    signup: &AgentSignupVerifyResult,
    created_at: &str,
    expires_at: &str,
) -> Result<CredentialWritePlan> {
    let credentials =
        StoredCliCredentials::from_signup(api_base_url, signup.clone(), created_at, expires_at);
    credentials_write_plan(
        config_dir,
        &credentials,
        Some(pending_signup_path(config_dir)),
        true,
    )
}

pub fn plan_browser_login_credentials_write(
    config_dir: &str,
    api_base_url: &str,
    login: &CliLoginPollResult,
    created_at: &str,
    expires_at: &str,
) -> Result<CredentialWritePlan> {
    let credentials = StoredCliCredentials::from_browser_login(
        api_base_url,
        login.clone(),
        created_at,
        expires_at,
    );
    credentials_write_plan(config_dir, &credentials, None, true)
}

fn credentials_write_plan(
    config_dir: &str,
    credentials: &StoredCliCredentials,
    delete_pending_path: Option<String>,
    delete_chat_state: bool,
) -> Result<CredentialWritePlan> {
    let org = credentials
        .org_name
        .as_ref()
        .map(|name| format!(" ({name})"))
        .unwrap_or_default();
    let path = credentials_path(config_dir);
    Ok(CredentialWritePlan {
        credentials_json: serialize_credentials(credentials)?,
        credentials_path: path.clone(),
        delete_chat_state,
        delete_pending_path,
        stderr: vec![
            format!("Logged in to org {}{}.", credentials.org_id, org),
            format!("Saved credentials to {path}."),
        ],
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthTextOutput {
    pub open_url: Option<String>,
    pub stderr: Vec<String>,
    pub stdout: Vec<String>,
}

type AuthOutputEmitter<'a> = &'a mut dyn FnMut(&AuthTextOutput) -> Result<()>;

impl AuthTextOutput {
    fn stderr(lines: Vec<String>) -> Self {
        Self {
            open_url: None,
            stderr: lines,
            stdout: Vec::new(),
        }
    }

    fn stdout(lines: Vec<String>) -> Self {
        Self {
            open_url: None,
            stderr: Vec::new(),
            stdout: lines,
        }
    }
}

pub fn start_email_code_output(
    pending: &PendingAgentSignup,
    flow: EmailCodeFlow,
) -> AuthTextOutput {
    AuthTextOutput::stderr(vec![
        format!(
            "Sent a {}-digit verification code to {}.",
            pending.verification_code_length, pending.email
        ),
        format!(
            "The code expires in {}.",
            format_signup_seconds(Some(pending.expires_in))
        ),
        format!(
            "Run `primitive {}` to finish.",
            flow.confirm_command(&pending.email)
        ),
    ])
}

pub fn continue_pending_start_output(
    pending: &PendingAgentSignup,
    flow: EmailCodeFlow,
) -> AuthTextOutput {
    AuthTextOutput::stderr(vec![
        format!(
            "Continuing pending Primitive {} for {}.",
            flow.action_noun(),
            pending.email
        ),
        format!(
            "Run `primitive {}` to finish, `primitive {}` to send a new code, or `primitive signup status` to inspect it.",
            flow.confirm_command(&pending.email),
            flow.resend_command(&pending.email)
        ),
    ])
}

pub fn resend_email_code_output(pending: &PendingAgentSignup, resent: bool) -> AuthTextOutput {
    if !resent {
        return AuthTextOutput::stderr(Vec::new());
    }
    AuthTextOutput::stderr(vec![format!(
        "Sent a new {}-digit verification code to {}. It expires in {}.",
        pending.verification_code_length,
        pending.email,
        format_signup_seconds(Some(pending.expires_in))
    )])
}

pub fn browser_login_start_output(start: &CliLoginStartResult, no_browser: bool) -> AuthTextOutput {
    let mut stderr = vec![format!("Your sign-in code is: {}", start.user_code)];
    let open_url = if no_browser {
        None
    } else {
        stderr.push("Opening Primitive in your browser...".to_string());
        Some(start.verification_uri_complete.clone())
    };
    stderr.push(format!(
        "If the browser did not open, visit: {}",
        start.verification_uri_complete
    ));
    stderr.push("Waiting for browser approval...".to_string());
    AuthTextOutput {
        open_url,
        stderr,
        stdout: Vec::new(),
    }
}

pub fn signup_status_output(status: &Value, json_output: bool) -> Result<AuthTextOutput> {
    if json_output {
        return Ok(AuthTextOutput::stdout(vec![serde_json::to_string_pretty(
            status,
        )?]));
    }
    if status.get("pending").and_then(Value::as_bool) != Some(true) {
        let command = status
            .get("signup_command")
            .and_then(Value::as_str)
            .unwrap_or("primitive signup <email> --accept-terms");
        return Ok(AuthTextOutput::stdout(vec![
            "No pending Primitive signup found.".to_string(),
            format!("Start one with `{command}`."),
        ]));
    }

    let mut lines = Vec::new();
    if let Some(email) = status.get("email").and_then(Value::as_str) {
        lines.push(format!("Pending Primitive signup for {email}."));
    }
    if let Some(length) = status.get("code_length").and_then(Value::as_u64) {
        lines.push(format!("Verification code length: {length}"));
    }
    if let Some(expires_at) = status.get("expires_at").and_then(Value::as_str) {
        if status.get("expired").and_then(Value::as_bool) == Some(true) {
            lines.push(format!("Expired at: {expires_at}"));
        } else {
            lines.push(format!("Expires at: {expires_at}"));
            lines.push(format!(
                "Expires in: {}",
                format_signup_seconds(status.get("expires_in").and_then(Value::as_u64))
            ));
        }
    }
    if let Some(resend_after) = status.get("resend_after").and_then(Value::as_u64) {
        lines.push(format!(
            "Resend after: {}",
            format_signup_seconds(Some(resend_after))
        ));
    }
    if let Some(command) = status.get("confirm_command").and_then(Value::as_str) {
        lines.push(format!("Confirm: {command}"));
    }
    if let Some(command) = status.get("resend_command").and_then(Value::as_str) {
        lines.push(format!("Resend: {command}"));
    }
    Ok(AuthTextOutput::stdout(lines))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AuthExecutionContext {
    pub api_base_url: String,
    pub api_key: Option<String>,
    pub config_dir: String,
    pub fallback_device_name: String,
    pub headers: BTreeMap<String, String>,
    pub now: SystemTime,
}

impl AuthExecutionContext {
    pub fn from_resolved_auth(
        auth: &config::ResolvedAuth,
        fallback_device_name: &str,
        now: SystemTime,
    ) -> Self {
        Self {
            api_base_url: auth.api_base_url.clone(),
            api_key: auth.api_key.clone(),
            config_dir: auth.config_dir.to_string_lossy().to_string(),
            fallback_device_name: fallback_device_name.to_string(),
            headers: auth.headers.clone(),
            now,
        }
    }

    fn with_api_key_if_missing(&self, api_key: &str) -> Self {
        if self.api_key.is_some() {
            return self.clone();
        }
        let mut next = self.clone();
        next.api_key = Some(api_key.to_string());
        next
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct AuthApiResponse {
    pub body: Option<Value>,
    pub headers: BTreeMap<String, String>,
    pub status: u16,
}

impl AuthApiResponse {
    pub fn json(status: u16, body: Value) -> Self {
        Self {
            body: Some(body),
            headers: BTreeMap::new(),
            status,
        }
    }

    pub fn json_with_headers(status: u16, body: Value, headers: BTreeMap<String, String>) -> Self {
        Self {
            body: Some(body),
            headers,
            status,
        }
    }
}

pub trait AuthRuntimeIo {
    fn env_var(&mut self, name: &str) -> Result<Option<String>> {
        match env::var(name) {
            Ok(value) => Ok(Some(value)),
            Err(env::VarError::NotPresent) => Ok(None),
            Err(env::VarError::NotUnicode(_)) => {
                Err(anyhow!("environment variable is not valid UTF-8"))
            }
        }
    }

    fn exists(&mut self, path: &str) -> bool;
    fn prompt_line(&mut self, prompt: &str) -> Result<String> {
        let mut stderr = std::io::stderr();
        stderr.write_all(prompt.as_bytes())?;
        stderr.flush()?;

        let mut value = String::new();
        std::io::stdin().read_line(&mut value)?;
        Ok(value.trim().to_string())
    }
    fn read_stdin_to_string(&mut self) -> Result<String> {
        let mut stdin = std::io::stdin();
        if stdin.is_terminal() {
            return Err(crate::usage_err!(
                "stdin is a TTY; pipe the code into this command or use --code-from-file / --code-from-env instead."
            ));
        }
        let mut value = String::new();
        stdin
            .read_to_string(&mut value)
            .context("Could not read stdin")?;
        Ok(value)
    }

    fn read_to_string(&mut self, path: &str) -> Result<Option<String>>;
    fn remove_dir_all(&mut self, path: &str) -> Result<()>;
    fn remove_file(&mut self, path: &str) -> Result<()>;
    fn sleep(&mut self, duration: Duration) -> Result<()> {
        std::thread::sleep(duration);
        Ok(())
    }
    fn write_string(&mut self, path: &str, contents: &str) -> Result<()>;
}

pub trait AuthRuntimeHttp {
    fn send(
        &mut self,
        context: &AuthExecutionContext,
        request: &AuthRequestPlan,
    ) -> Result<AuthApiResponse>;
}

pub struct FileAuthRuntimeIo;

impl AuthRuntimeIo for FileAuthRuntimeIo {
    fn exists(&mut self, path: &str) -> bool {
        Path::new(path).exists()
    }

    fn read_to_string(&mut self, path: &str) -> Result<Option<String>> {
        match fs::read_to_string(path) {
            Ok(contents) => Ok(Some(contents)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error).with_context(|| format!("Could not read {path}")),
        }
    }

    fn remove_file(&mut self, path: &str) -> Result<()> {
        match fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error).with_context(|| format!("Could not remove {path}")),
        }
    }

    fn remove_dir_all(&mut self, path: &str) -> Result<()> {
        match fs::remove_dir_all(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotADirectory => {
                self.remove_file(path)
            }
            Err(error) => Err(error).with_context(|| format!("Could not remove {path}")),
        }
    }

    fn write_string(&mut self, path: &str, contents: &str) -> Result<()> {
        config::write_private_file_atomic(Path::new(path), contents)
    }
}

pub struct ReqwestAuthRuntimeHttp;

impl AuthRuntimeHttp for ReqwestAuthRuntimeHttp {
    fn send(
        &mut self,
        context: &AuthExecutionContext,
        request: &AuthRequestPlan,
    ) -> Result<AuthApiResponse> {
        execute_auth_request(request, context)
    }
}

pub fn execute_command(command: &str, args: &[String]) -> Result<()> {
    if is_help_request(args) {
        print!("{}", auth_help_text(command, args));
        return Ok(());
    }
    let command = dispatch_auth_command(command, args)?;
    execute_auth_command(&command)
}

fn is_help_request(args: &[String]) -> bool {
    args.iter().any(|arg| is_help_arg(arg))
}

fn is_help_arg(arg: &str) -> bool {
    matches!(arg, "--help" | "-h")
}

#[derive(Debug, Clone, Copy)]
struct AuthHelpSpec {
    arguments: &'static str,
    commands: &'static [&'static str],
    description: &'static str,
    flags: &'static [&'static str],
    summary: &'static str,
    usage: &'static str,
}

pub fn auth_help_text(command: &str, args: &[String]) -> String {
    let id = requested_auth_help_id(command, args);
    let Some(id) = id else {
        return auth_parent_help_text();
    };
    render_auth_help(auth_help_spec(id))
}

fn requested_auth_help_id(command: &str, args: &[String]) -> Option<AuthCommandId> {
    let mut request: Vec<String> = command.split(':').map(str::to_string).collect();
    request.extend(args.iter().filter(|arg| !is_help_arg(arg)).cloned());
    identify_auth_command(&request).map(|identified| identified.id)
}

fn render_auth_help(spec: AuthHelpSpec) -> String {
    let bin = crate::display_bin_name();
    let mut lines = vec![
        spec.summary.to_string(),
        String::new(),
        "USAGE".to_string(),
        format!("  {bin} {}", spec.usage),
    ];

    if !spec.arguments.is_empty() {
        lines.push(String::new());
        lines.push("ARGUMENTS".to_string());
        lines.extend(spec.arguments.lines().map(str::to_string));
    }

    if !spec.flags.is_empty() {
        lines.push(String::new());
        lines.push("FLAGS".to_string());
        lines.extend(spec.flags.iter().map(|line| (*line).to_string()));
    }

    if !spec.description.is_empty() {
        lines.push(String::new());
        lines.push("DESCRIPTION".to_string());
        lines.push(format!("  {}", spec.summary));
        lines.push(String::new());
        lines.extend(spec.description.lines().map(|line| format!("  {line}")));
    }

    if !spec.commands.is_empty() {
        lines.push(String::new());
        lines.push("COMMANDS".to_string());
        lines.extend(spec.commands.iter().map(|line| (*line).to_string()));
    }

    lines.push(String::new());
    lines.join("\n")
}

fn auth_parent_help_text() -> String {
    let bin = crate::display_bin_name();
    [
        "Primitive Rust CLI auth commands".to_string(),
        String::new(),
        "USAGE".to_string(),
        format!("  {bin} signin|login|otp|signup|whoami|logout [flags]"),
        String::new(),
        "COMMANDS".to_string(),
        "  signin|login  Sign in with browser approval or start email-code auth".to_string(),
        "  otp           Start email-code auth".to_string(),
        "  signup        Start account signup".to_string(),
        "  whoami        Print the authenticated account".to_string(),
        "  logout        Log out and revoke saved CLI OAuth credentials".to_string(),
        String::new(),
    ]
    .join("\n")
}

fn auth_help_spec(id: AuthCommandId) -> AuthHelpSpec {
    match id {
        AuthCommandId::Login => AuthHelpSpec {
            arguments:
                "  [EMAIL]  Email address for email-code login. Omit it to use browser approval.",
            commands: &[
                "  login browser  Log in with browser approval",
                "  login confirm  Confirm email-code login",
                "  login otp      Start OTP login",
                "  login resend   Resend email-code login code",
            ],
            description: "Log in or sign in to an existing Primitive account and save an org-scoped OAuth session locally.\nUse an email plus --signup-code and --accept-terms for email-code login, or omit the email for browser approval.",
            flags: LOGIN_OR_SIGNIN_HELP_FLAGS,
            summary: "Log in to an existing account",
            usage: "login [EMAIL] [--device-name <value>] [--no-browser] [-f] [--accept-terms] [--signup-code <value>]",
        },
        AuthCommandId::Signin => AuthHelpSpec {
            arguments: "  [EMAIL]  Email address for email-code sign-in. Omit it to use browser approval.",
            commands: &[
                "  signin browser  Sign in with browser approval",
                "  signin confirm  Confirm email-code sign-in",
                "  signin otp      Start OTP sign-in",
                "  signin resend   Resend email-code sign-in code",
            ],
            description: "Sign in or log in to an existing Primitive account and save an org-scoped OAuth session locally.\nUse an email plus --signup-code and --accept-terms for email-code sign-in, or omit the email for browser approval.",
            flags: LOGIN_OR_SIGNIN_HELP_FLAGS,
            summary: "Sign in to an existing account",
            usage: "signin [EMAIL] [--device-name <value>] [--no-browser] [-f] [--accept-terms] [--signup-code <value>]",
        },
        AuthCommandId::LoginBrowser => browser_help_spec(
            "Log in with browser approval",
            "login browser [--device-name <value>] [--no-browser] [-f]",
            "Log in to an existing Primitive account by opening Primitive in your browser and saving an org-scoped OAuth session locally.",
        ),
        AuthCommandId::SigninBrowser => browser_help_spec(
            "Sign in with browser approval",
            "signin browser [--device-name <value>] [--no-browser] [-f]",
            "Sign in to an existing Primitive account by opening Primitive in your browser and saving an org-scoped OAuth session locally.",
        ),
        AuthCommandId::LoginConfirm => confirm_help_spec(
            "Confirm email-code login",
            "login confirm <email> <code> [-f] [--org-id <value>]",
            "Confirm a pending email-code login, create an OAuth session, and save CLI credentials locally.",
            "  <email>  Email address used to start login\n  <code>   Verification code from the auth email",
        ),
        AuthCommandId::SigninConfirm => confirm_help_spec(
            "Confirm email-code sign-in",
            "signin confirm <email> <code> [-f] [--org-id <value>]",
            "Confirm a pending email-code sign-in, create an OAuth session, and save CLI credentials locally.",
            "  <email>  Email address used to start sign-in\n  <code>   Verification code from the auth email",
        ),
        AuthCommandId::LoginOtp => otp_start_help_spec(
            "Start OTP login",
            "login otp [EMAIL] [--accept-terms] [--device-name <value>] [-f] [--signup-code <value>]",
            "Start email-code login using Primitive's signup/auth OTP flow, send a verification code, and save the pending token locally. Requires a signup code.",
            &[
                "  login otp confirm  Confirm OTP login",
                "  login otp resend   Resend OTP login code",
            ],
        ),
        AuthCommandId::SigninOtp => otp_start_help_spec(
            "Start OTP sign-in",
            "signin otp [EMAIL] [--accept-terms] [--device-name <value>] [-f] [--signup-code <value>]",
            "Start email-code sign-in using Primitive's signup/auth OTP flow, send a verification code, and save the pending token locally. Requires a signup code.",
            &[
                "  signin otp confirm  Confirm OTP sign-in",
                "  signin otp resend   Resend OTP sign-in code",
            ],
        ),
        AuthCommandId::Otp => otp_start_help_spec(
            "Start email-code auth",
            "otp [EMAIL] [--accept-terms] [--device-name <value>] [-f] [--signup-code <value>]",
            "Start email-code authentication, send a verification code, and save the pending token locally. Requires a signup code.",
            &[
                "  otp confirm  Confirm email-code auth",
                "  otp resend   Resend email-code auth code",
            ],
        ),
        AuthCommandId::LoginOtpConfirm => confirm_help_spec(
            "Confirm OTP login",
            "login otp confirm <email> <code> [-f] [--org-id <value>]",
            "Confirm a pending OTP login, create an OAuth session, and save CLI credentials locally.",
            "  <email>  Email address used to start OTP login\n  <code>   Verification code from the auth email",
        ),
        AuthCommandId::SigninOtpConfirm => confirm_help_spec(
            "Confirm OTP sign-in",
            "signin otp confirm <email> <code> [-f] [--org-id <value>]",
            "Confirm a pending OTP sign-in, create an OAuth session, and save CLI credentials locally.",
            "  <email>  Email address used to start OTP sign-in\n  <code>   Verification code from the auth email",
        ),
        AuthCommandId::OtpConfirm => confirm_help_spec(
            "Confirm email-code auth",
            "otp confirm <email> <code> [-f] [--org-id <value>]",
            "Confirm pending email-code authentication, create an OAuth session, and save CLI credentials locally.",
            "  <email>  Email address used to start email-code auth\n  <code>   Verification code from the auth email",
        ),
        AuthCommandId::LoginOtpResend => resend_help_spec(
            "Resend OTP login code",
            "login otp resend <email>",
            "Resend the verification code for a pending OTP login.",
            "  <email>  Email address used to start OTP login",
        ),
        AuthCommandId::SigninOtpResend => resend_help_spec(
            "Resend OTP sign-in code",
            "signin otp resend <email>",
            "Resend the verification code for a pending OTP sign-in.",
            "  <email>  Email address used to start OTP sign-in",
        ),
        AuthCommandId::OtpResend => resend_help_spec(
            "Resend email-code auth code",
            "otp resend <email>",
            "Resend the verification code for pending email-code authentication.",
            "  <email>  Email address used to start email-code auth",
        ),
        AuthCommandId::LoginResend => resend_help_spec(
            "Resend email-code login code",
            "login resend <email>",
            "Resend the verification code for a pending email-code login.",
            "  <email>  Email address used to start login",
        ),
        AuthCommandId::SigninResend => resend_help_spec(
            "Resend email-code sign-in code",
            "signin resend <email>",
            "Resend the verification code for a pending email-code sign-in.",
            "  <email>  Email address used to start sign-in",
        ),
        AuthCommandId::Signup => AuthHelpSpec {
            arguments: "  [EMAIL]  Email address to sign up",
            commands: &[
                "  signup confirm      Confirm account signup",
                "  signup interactive  Run interactive account signup",
                "  signup resend       Resend signup verification code",
                "  signup status       Show pending signup status",
            ],
            description: "Start a Primitive account signup, send an email verification code, and save a pending signup token locally.",
            flags: SIGNUP_START_HELP_FLAGS,
            summary: "Start account signup",
            usage: "signup [EMAIL] [--accept-terms] [--device-name <value>] [-f] [--signup-code <value>]",
        },
        AuthCommandId::SignupConfirm => AuthHelpSpec {
            arguments: "  <email>  Email address used to start signup\n  [code]   Verification code from the signup email. Optional when one code source flag is passed.",
            commands: &[],
            description: "Confirm a pending Primitive signup, create an OAuth session, and save CLI credentials locally.",
            flags: SIGNUP_CONFIRM_HELP_FLAGS,
            summary: "Confirm account signup",
            usage: "signup confirm <email> [code] [--code-from-stdin] [--code-from-file <path>] [--code-from-env <name>] [-f] [--org-id <value>]",
        },
        AuthCommandId::SignupInteractive => AuthHelpSpec {
            arguments: "",
            commands: &[],
            description: "Run the full signup flow in one interactive terminal session.",
            flags: SIGNUP_START_HELP_FLAGS,
            summary: "Run interactive account signup",
            usage: "signup interactive [--accept-terms] [--device-name <value>] [-f] [--signup-code <value>]",
        },
        AuthCommandId::SignupResend => AuthHelpSpec {
            arguments: "  [email]  Email address used to start signup. Defaults to the saved pending signup.",
            commands: &[],
            description: "Resend the verification code for a pending signup.",
            flags: &[],
            summary: "Resend signup verification code",
            usage: "signup resend [email]",
        },
        AuthCommandId::SignupStatus => AuthHelpSpec {
            arguments: "  [email]  Email address expected in the pending signup",
            commands: &[],
            description: "Inspect the locally saved pending Primitive signup state.",
            flags: &["  --json  Print pending signup status as JSON"],
            summary: "Show pending signup status",
            usage: "signup status [email] [--json]",
        },
        AuthCommandId::Logout => AuthHelpSpec {
            arguments: "",
            commands: &[],
            description: "Log out by revoking the saved Primitive CLI OAuth grant and deleting local credentials.\nUse --force to remove local credentials, pending email-code auth state, and stale credential locks without contacting Primitive.",
            flags: &[
                "  -f, --force  Remove local CLI credentials, pending email-code auth state, and any credential lock without revoking the server OAuth grant",
            ],
            summary: "Log out and revoke the saved CLI OAuth grant",
            usage: "logout [-f]",
        },
        AuthCommandId::Whoami => AuthHelpSpec {
            arguments: "",
            commands: &[],
            description: "Print the account currently authenticated by saved OAuth credentials or an explicit API key.\nThe default output is a concise human summary. Pass --json when a script needs the full /account response.",
            flags: &[
                "  --api-key=<value>  Primitive API key override",
                "  --json             Print the full account JSON response",
                "  --time             Print the wall-clock duration of this command to stderr after it completes",
            ],
            summary: "Print the authenticated account (credentials smoke test)",
            usage: "whoami [--api-key <value>] [--json] [--time]",
        },
    }
}

const LOGIN_OR_SIGNIN_HELP_FLAGS: &[&str] = &[
    "  -f, --force                Replace saved credentials or pending email-code auth state when needed, without first verifying the existing session",
    "      --accept-terms         Confirm acceptance of Primitive's Terms of Service and Privacy Policy",
    "      --device-name=<value>  Device name used for the created CLI OAuth session",
    "      --no-browser           Do not attempt to open the browser automatically",
    "      --signup-code=<value>  Signup code required to start email-code sign-in",
];

const OTP_START_HELP_FLAGS: &[&str] = &[
    "  -f, --force                Replace saved credentials or pending email-code auth state when needed",
    "      --accept-terms         Confirm acceptance of Primitive's Terms of Service and Privacy Policy",
    "      --device-name=<value>  Device name used for the created CLI OAuth session",
    "      --signup-code=<value>  Signup code required to start email-code sign-in",
];

const SIGNUP_START_HELP_FLAGS: &[&str] = &[
    "  -f, --force                Replace saved credentials or pending signup state when needed",
    "      --accept-terms         Confirm acceptance of Primitive's Terms of Service and Privacy Policy",
    "      --device-name=<value>  Device name used for the created CLI OAuth session",
    "      --signup-code=<value>  Optional signup code. Omit if you do not have one.",
];

const BROWSER_HELP_FLAGS: &[&str] = &[
    "  -f, --force                Replace saved credentials without first verifying the existing session",
    "      --device-name=<value>  Device name shown in the browser approval screen",
    "      --no-browser           Do not attempt to open the browser automatically",
];

const CONFIRM_HELP_FLAGS: &[&str] = &[
    "  -f, --force           Replace saved credentials after verification",
    "      --org-id=<value>  Workspace id to target when the email belongs to multiple workspaces",
];

const SIGNUP_CONFIRM_HELP_FLAGS: &[&str] = &[
    "  -f, --force                 Replace saved credentials after verification",
    "      --code-from-env=<name>   Read the verification code from this environment variable",
    "      --code-from-file=<path>  Read the verification code from a UTF-8 file at this path",
    "      --code-from-stdin        Read the verification code from stdin instead of the positional argument",
    "      --org-id=<value>         Workspace id to target when the email belongs to multiple workspaces",
];

fn browser_help_spec(
    summary: &'static str,
    usage: &'static str,
    description: &'static str,
) -> AuthHelpSpec {
    AuthHelpSpec {
        arguments: "",
        commands: &[],
        description,
        flags: BROWSER_HELP_FLAGS,
        summary,
        usage,
    }
}

fn confirm_help_spec(
    summary: &'static str,
    usage: &'static str,
    description: &'static str,
    email_argument: &'static str,
) -> AuthHelpSpec {
    AuthHelpSpec {
        arguments: email_argument,
        commands: &[],
        description,
        flags: CONFIRM_HELP_FLAGS,
        summary,
        usage,
    }
}

fn otp_start_help_spec(
    summary: &'static str,
    usage: &'static str,
    description: &'static str,
    commands: &'static [&'static str],
) -> AuthHelpSpec {
    AuthHelpSpec {
        arguments: "  [EMAIL]  Email address to sign in with",
        commands,
        description,
        flags: OTP_START_HELP_FLAGS,
        summary,
        usage,
    }
}

fn resend_help_spec(
    summary: &'static str,
    usage: &'static str,
    description: &'static str,
    email_argument: &'static str,
) -> AuthHelpSpec {
    AuthHelpSpec {
        arguments: email_argument,
        commands: &[],
        description,
        flags: &[],
        summary,
        usage,
    }
}

pub fn execute_auth_command(command: &AuthCommand) -> Result<()> {
    let started = Instant::now();
    let flags = auth_flags_from_command(command);
    let auth = config::resolve_auth(&flags)?;
    let context =
        AuthExecutionContext::from_resolved_auth(&auth, &fallback_device_name(), SystemTime::now());
    let mut io = FileAuthRuntimeIo;
    let mut http = ReqwestAuthRuntimeHttp;
    let output = match command {
        AuthCommand::BrowserLogin { flags, verb } => {
            let mut emit_start = |output: &AuthTextOutput| {
                write_auth_text_output(output);
                Ok(())
            };
            execute_browser_login(
                *verb,
                flags,
                &context,
                &mut io,
                &mut http,
                Some(&mut emit_start),
            )?
        }
        AuthCommand::SignupInteractive { flags } => {
            let mut emit_interactive = |output: &AuthTextOutput| {
                write_auth_text_output(output);
                Ok(())
            };
            execute_signup_interactive(
                flags,
                &context,
                &mut io,
                &mut http,
                Some(&mut emit_interactive),
            )?
        }
        _ => execute_auth_command_with(command, &context, &mut io, &mut http)?,
    };
    write_auth_text_output(&output);
    if command_time_enabled(command) {
        eprintln!("[time: {:.2}s]", started.elapsed().as_secs_f64());
    }
    Ok(())
}

pub fn execute_auth_command_with(
    command: &AuthCommand,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
) -> Result<AuthTextOutput> {
    match command {
        AuthCommand::BrowserLogin { flags, verb } => {
            execute_browser_login(*verb, flags, context, io, http, None)
        }
        AuthCommand::SignupInteractive { flags } => {
            execute_signup_interactive(flags, context, io, http, None)
        }
        AuthCommand::StartEmailCode { email, flags, flow } => {
            execute_start_email_code(*flow, email.as_deref(), flags, context, io, http)
        }
        AuthCommand::ConfirmEmailCode {
            code,
            email,
            flags,
            flow,
        } => execute_confirm_email_code(*flow, email, code, flags, context, io, http),
        AuthCommand::ResendEmailCode { email, flags, flow } => {
            execute_resend_email_code(*flow, email.as_deref(), flags, context, io, http)
        }
        AuthCommand::SignupStatus { email, flags } => {
            execute_signup_status(email.as_deref(), flags, context, io)
        }
        AuthCommand::Logout { flags } => execute_logout(flags, context, io, http),
        AuthCommand::Whoami { flags } => execute_whoami(flags, context, http),
    }
}

pub fn execute_auth_request(
    request: &AuthRequestPlan,
    context: &AuthExecutionContext,
) -> Result<AuthApiResponse> {
    let http = client::http_client()?;
    let url = format!(
        "{}{}",
        context.api_base_url.trim_end_matches('/'),
        request.path
    );
    let method: Method = request.method.parse()?;
    let auth = config::ResolvedAuth {
        api_key: context.api_key.clone(),
        api_base_url: context.api_base_url.clone(),
        headers: context.headers.clone(),
        config_dir: PathBuf::from(&context.config_dir),
    };
    let mut builder = http.request(method, url);
    builder = client::apply_headers(
        builder,
        &auth,
        request.include_auth,
        &[],
        request.body.is_some(),
    )?;
    if let Some(body) = &request.body {
        builder = builder.json(body);
    }
    let response = builder.send()?;
    let headers = response
        .headers()
        .iter()
        .filter_map(|(name, value)| {
            value
                .to_str()
                .ok()
                .map(|value| (name.as_str().to_ascii_lowercase(), value.to_string()))
        })
        .collect();
    let (status, _bytes, body) = client::parse_response(response)?;
    Ok(AuthApiResponse {
        body,
        headers,
        status,
    })
}

fn execute_browser_login(
    verb: BrowserLoginVerb,
    flags: &BrowserLoginFlags,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
    mut emit_start: Option<AuthOutputEmitter<'_>>,
) -> Result<AuthTextOutput> {
    let mut prefix = Vec::new();
    match read_credentials_for_auth(io, &context.config_dir) {
        Ok(Some(_credentials)) if flags.force => {
            prefix.push(
                "Replacing saved Primitive CLI credentials after browser approval because --force was set."
                    .to_string(),
            );
        }
        Ok(Some(credentials)) => {
            let org = credentials
                .org_name
                .as_ref()
                .map(|name| format!(" for {name}"))
                .unwrap_or_default();
            return Err(anyhow!(
                "Already logged in{org}. Run `primitive logout` before logging in again."
            ));
        }
        Ok(None) => {}
        Err(error) if flags.force => {
            prefix.push(format!(
                "Replacing unreadable Primitive CLI credentials because --force was set: {error}"
            ));
        }
        Err(error) => return Err(error),
    }

    let plan = plan_auth_command_request(
        &AuthCommand::BrowserLogin {
            flags: flags.clone(),
            verb,
        },
        AuthCommandRequestContext {
            credentials: None,
            fallback_device_name: &context.fallback_device_name,
            pending: None,
        },
    )?;
    let AuthCommandRequestPlan::BrowserLoginStart(request) = plan else {
        return Err(anyhow!(
            "Internal auth planner returned the wrong browser login start plan."
        ));
    };
    let response = http.send(context, &request)?;
    if !response_has_data(&response) {
        return Err(auth_error_for_response(
            &response,
            "Could not start Primitive CLI login.",
        ));
    }
    let start: CliLoginStartResult = parse_response_data(
        &response,
        "Primitive API returned an empty CLI login response.",
    )?;
    let mut output = browser_login_start_output(&start, flags.no_browser);
    output.stderr.splice(0..0, prefix);
    if let Some(emit) = emit_start.as_mut() {
        emit(&output)?;
        output = AuthTextOutput::stderr(Vec::new());
    }

    let retry_command = verb.retry_command();
    let mut interval_seconds = initial_poll_interval_seconds(start.interval);
    let mut next_poll_delay_seconds = 1;
    let mut elapsed_seconds = 0_u64;

    while elapsed_seconds < start.expires_in {
        io.sleep(Duration::from_secs(next_poll_delay_seconds))?;
        elapsed_seconds = elapsed_seconds.saturating_add(next_poll_delay_seconds);

        let request = plan_browser_login_poll_request(&start.device_code);
        let response = http.send(context, &request)?;
        if response_has_data(&response) {
            let login: CliLoginPollResult = parse_response_data(
                &response,
                "Primitive API returned an empty CLI poll response.",
            )?;
            let created_at = system_time_to_utc_millis(context.now);
            let expires_at =
                system_time_to_utc_millis(access_token_expires_at(context.now, login.expires_in));
            let write = plan_browser_login_credentials_write(
                &context.config_dir,
                &context.api_base_url,
                &login,
                &created_at,
                &expires_at,
            )?;
            apply_credential_write(io, &context.config_dir, &write)?;
            output.stderr.extend(write.stderr);
            return Ok(output);
        }

        match decide_poll_error(
            response_error_code(&response).unwrap_or(""),
            interval_seconds,
            retry_after_seconds(&response),
            retry_command,
        ) {
            PollDecision::Continue {
                next_poll_delay_seconds: next_delay,
                interval_seconds: next_interval,
            } => {
                next_poll_delay_seconds = next_delay;
                interval_seconds = next_interval;
            }
            PollDecision::Denied => {
                return Err(anyhow!("Primitive CLI login was denied in the browser."));
            }
            PollDecision::Expired { retry_command } => {
                return Err(anyhow!(
                    "Primitive CLI login expired. Run `primitive {retry_command}` again."
                ));
            }
            PollDecision::InvalidDeviceCode { retry_command } => {
                return Err(anyhow!(
                    "Primitive CLI login device code is invalid. Run `primitive {retry_command}` again."
                ));
            }
            PollDecision::Failed | PollDecision::SaveCredentials => {
                return Err(auth_error_for_response(
                    &response,
                    "Primitive CLI login failed while polling for approval.",
                ));
            }
        }
    }

    Err(anyhow!(
        "Primitive CLI login expired. Run `primitive {retry_command}` again."
    ))
}

fn execute_signup_interactive(
    flags: &StartEmailCodeFlags,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
    mut emit: Option<AuthOutputEmitter<'_>>,
) -> Result<AuthTextOutput> {
    let mut output = AuthTextOutput::stderr(Vec::new());
    let mut prefix = Vec::new();
    match read_credentials_for_auth(io, &context.config_dir) {
        Ok(Some(credentials)) if flags.force => {
            let org = credentials
                .org_name
                .as_ref()
                .map(|name| format!(" for {name}"))
                .unwrap_or_default();
            prefix.push(format!(
                "Replacing saved Primitive CLI credentials{org} after signup because --force was set."
            ));
        }
        Ok(Some(credentials)) => {
            let org = credentials
                .org_name
                .as_ref()
                .map(|name| format!(" for {name}"))
                .unwrap_or_default();
            return Err(anyhow!(
                "Already logged in{org}. Run `primitive logout` before creating a new account."
            ));
        }
        Ok(None) => {}
        Err(error) if flags.force => {
            prefix.push(format!(
                "Replacing unreadable Primitive CLI credentials because --force was set: {error}"
            ));
        }
        Err(error) => return Err(error),
    }
    emit_or_collect_stderr(&mut output, &mut emit, prefix)?;

    let mut pending = if flags.force {
        io.remove_file(&pending_signup_path(&context.config_dir))?;
        None
    } else {
        read_active_pending_signup(io, context)?
    };

    if let Some(existing) = pending.as_ref() {
        emit_or_collect_stderr(
            &mut output,
            &mut emit,
            vec![format!(
                "Continuing pending Primitive signup for {}.",
                existing.email
            )],
        )?;
    } else {
        let email = prompt_required(io, "Email: ", &mut output, &mut emit)?;
        let mut start_flags = flags.clone();
        if !start_flags.accept_terms {
            confirm_signup_terms(io, &mut output, &mut emit)?;
            start_flags.accept_terms = true;
        }
        pending = Some(start_interactive_signup(
            &email,
            &start_flags,
            context,
            io,
            http,
        )?);
    }

    let mut pending = pending.expect("interactive signup has pending state");
    emit_interactive_code_instructions(&pending, &mut output, &mut emit)?;

    loop {
        let prompt = format!(
            "Verification code ({} digits): ",
            pending.verification_code_length
        );
        let verification_code = prompt_required(io, &prompt, &mut output, &mut emit)?;
        if verification_code.eq_ignore_ascii_case("resend") {
            match resend_interactive_signup(&pending, context, io, http)? {
                InteractiveResendOutcome::Resent { next, stderr } => {
                    pending = next;
                    emit_or_collect_stderr(&mut output, &mut emit, stderr)?;
                }
                InteractiveResendOutcome::Wait { stderr } => {
                    emit_or_collect_stderr(&mut output, &mut emit, stderr)?;
                }
            }
            continue;
        }

        match verify_interactive_signup(&pending, &verification_code, context, io, http)? {
            InteractiveVerifyOutcome::Saved { stderr } => {
                output.stderr.extend(stderr);
                return Ok(output);
            }
            InteractiveVerifyOutcome::InvalidCode { stderr } => {
                emit_or_collect_stderr(&mut output, &mut emit, stderr)?;
            }
        }
    }
}

fn start_interactive_signup(
    email: &str,
    flags: &StartEmailCodeFlags,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
) -> Result<PendingAgentSignup> {
    let plan = plan_auth_command_request(
        &AuthCommand::StartEmailCode {
            email: Some(email.to_string()),
            flags: flags.clone(),
            flow: EmailCodeFlow::Signup,
        },
        AuthCommandRequestContext {
            credentials: None,
            fallback_device_name: &context.fallback_device_name,
            pending: None,
        },
    )?;
    let AuthCommandRequestPlan::StartEmailCode(request) = plan else {
        return Err(anyhow!(
            "Internal auth planner returned the wrong start plan."
        ));
    };
    let response = http.send(context, &request)?;
    if !response_has_data(&response) {
        return Err(auth_error_for_response(
            &response,
            "Could not start Primitive agent signup.",
        ));
    }
    let start: AgentSignupStartResult = parse_response_data(
        &response,
        "Primitive API returned an empty agent signup response.",
    )?;
    let created_at = system_time_to_utc_millis(context.now);
    let expires_at =
        system_time_to_utc_millis(access_token_expires_at(context.now, start.expires_in));
    let pending =
        PendingAgentSignup::from_start(start, &context.api_base_url, &created_at, &expires_at);
    io.write_string(
        &pending_signup_path(&context.config_dir),
        &serialize_pending_signup(&pending)?,
    )?;
    Ok(pending)
}

enum InteractiveResendOutcome {
    Resent {
        next: PendingAgentSignup,
        stderr: Vec<String>,
    },
    Wait {
        stderr: Vec<String>,
    },
}

fn resend_interactive_signup(
    pending: &PendingAgentSignup,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
) -> Result<InteractiveResendOutcome> {
    let request = plan_resend_email_code_request(pending);
    let response = http.send(context, &request)?;
    if response_has_data(&response) {
        let resend: AgentSignupResendResult = parse_response_data(
            &response,
            "Primitive API returned an empty agent signup resend response.",
        )?;
        let created_at = system_time_to_utc_millis(context.now);
        let expires_at =
            system_time_to_utc_millis(access_token_expires_at(context.now, resend.expires_in));
        let next = PendingAgentSignup::from_resend(pending, resend, &created_at, &expires_at);
        io.write_string(
            &pending_signup_path(&context.config_dir),
            &serialize_pending_signup(&next)?,
        )?;
        return Ok(InteractiveResendOutcome::Resent {
            stderr: vec![format!(
                "Sent a new {}-digit verification code. It expires in {}.",
                next.verification_code_length,
                format_signup_seconds(Some(next.expires_in))
            )],
            next,
        });
    }

    match decide_resend_result(
        false,
        response_error_code(&response),
        retry_after_seconds(&response),
        pending.resend_after,
    ) {
        ResendDecision::Wait {
            retry_after_seconds,
        } => Ok(InteractiveResendOutcome::Wait {
            stderr: vec![format!(
                "Verification email was sent recently. Wait {} before trying again.",
                format_signup_seconds(Some(retry_after_seconds))
            )],
        }),
        ResendDecision::ClearPendingAndFail => {
            io.remove_file(&pending_signup_path(&context.config_dir))?;
            Err(auth_error_for_response(
                &response,
                "Could not resend Primitive agent signup verification email.",
            ))
        }
        ResendDecision::Fail | ResendDecision::SavePending => Err(auth_error_for_response(
            &response,
            "Could not resend Primitive agent signup verification email.",
        )),
    }
}

enum InteractiveVerifyOutcome {
    InvalidCode { stderr: Vec<String> },
    Saved { stderr: Vec<String> },
}

fn verify_interactive_signup(
    pending: &PendingAgentSignup,
    verification_code: &str,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
) -> Result<InteractiveVerifyOutcome> {
    let request = plan_confirm_email_code_request(
        pending,
        verification_code,
        &ConfirmEmailCodeFlags::default(),
    );
    let response = http.send(context, &request)?;
    if response_has_data(&response) {
        let signup: AgentSignupVerifyResult = parse_response_data(
            &response,
            "Primitive API returned an empty agent signup verification response.",
        )?;
        let created_at = system_time_to_utc_millis(context.now);
        let expires_at =
            system_time_to_utc_millis(access_token_expires_at(context.now, signup.expires_in));
        let write = plan_signup_credentials_write(
            &context.config_dir,
            &context.api_base_url,
            &signup,
            &created_at,
            &expires_at,
        )?;
        apply_credential_write(io, &context.config_dir, &write)?;
        return Ok(InteractiveVerifyOutcome::Saved {
            stderr: write.stderr,
        });
    }

    match decide_verify_result(false, response_error_code(&response)) {
        VerifyDecision::InvalidCode => Ok(InteractiveVerifyOutcome::InvalidCode {
            stderr: vec!["Invalid verification code. Try again or type `resend`.".to_string()],
        }),
        VerifyDecision::ClearPendingAndFail => {
            io.remove_file(&pending_signup_path(&context.config_dir))?;
            Err(auth_error_for_response(
                &response,
                "Primitive agent signup failed while verifying the account.",
            ))
        }
        VerifyDecision::Fail | VerifyDecision::SaveCredentials => Err(auth_error_for_response(
            &response,
            "Primitive agent signup failed while verifying the account.",
        )),
    }
}

fn confirm_signup_terms(
    io: &mut impl AuthRuntimeIo,
    output: &mut AuthTextOutput,
    emit: &mut Option<AuthOutputEmitter<'_>>,
) -> Result<()> {
    emit_or_collect_stderr(
        output,
        emit,
        vec![
            "By continuing, you agree to Primitive's Terms of Service and Privacy Policy:"
                .to_string(),
            "  https://primitive.dev/terms".to_string(),
            "  https://primitive.dev/privacy".to_string(),
        ],
    )?;
    let answer = prompt_required(io, "Type 'yes' to continue: ", output, emit)?;
    if matches!(answer.to_ascii_lowercase().as_str(), "yes" | "y") {
        Ok(())
    } else {
        Err(anyhow!("You must accept the terms to create an account."))
    }
}

fn prompt_required(
    io: &mut impl AuthRuntimeIo,
    prompt: &str,
    output: &mut AuthTextOutput,
    emit: &mut Option<AuthOutputEmitter<'_>>,
) -> Result<String> {
    loop {
        let value = io.prompt_line(prompt)?;
        let value = value.trim();
        if !value.is_empty() {
            return Ok(value.to_string());
        }
        emit_or_collect_stderr(output, emit, vec!["Please enter a value.".to_string()])?;
    }
}

fn emit_interactive_code_instructions(
    pending: &PendingAgentSignup,
    output: &mut AuthTextOutput,
    emit: &mut Option<AuthOutputEmitter<'_>>,
) -> Result<()> {
    emit_or_collect_stderr(
        output,
        emit,
        vec![
            format!(
                "Check your email for the {}-digit verification code sent to {}.",
                pending.verification_code_length, pending.email
            ),
            format!(
                "The code expires in {}.",
                format_signup_seconds(Some(pending.expires_in))
            ),
            format!(
                "Enter the code from the email, or type `resend` to send a new code after {}.",
                format_signup_seconds(Some(pending.resend_after))
            ),
        ],
    )
}

fn emit_or_collect_stderr(
    output: &mut AuthTextOutput,
    emit: &mut Option<AuthOutputEmitter<'_>>,
    lines: Vec<String>,
) -> Result<()> {
    if lines.is_empty() {
        return Ok(());
    }
    if let Some(emit) = emit.as_mut() {
        emit(&AuthTextOutput::stderr(lines))?;
    } else {
        output.stderr.extend(lines);
    }
    Ok(())
}

fn execute_start_email_code(
    flow: EmailCodeFlow,
    email: Option<&str>,
    flags: &StartEmailCodeFlags,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
) -> Result<AuthTextOutput> {
    let email =
        email.ok_or_else(|| crate::usage_err!("{} needs an email address.", flow.action_noun()))?;
    let mut prefix = Vec::new();
    match read_credentials_for_auth(io, &context.config_dir) {
        Ok(Some(credentials)) if flags.force => {
            let org = credentials
                .org_name
                .as_ref()
                .map(|name| format!(" for {name}"))
                .unwrap_or_default();
            prefix.push(format!(
                "Replacing saved Primitive CLI credentials{org} after {} because --force was set.",
                flow.action_noun()
            ));
        }
        Ok(Some(credentials)) => {
            let org = credentials
                .org_name
                .as_ref()
                .map(|name| format!(" for {name}"))
                .unwrap_or_default();
            return Err(anyhow!(
                "Already logged in{org}. Run `primitive logout` before {}.",
                flow.action_gerund()
            ));
        }
        Ok(None) => {}
        Err(error) if flags.force => {
            prefix.push(format!(
                "Replacing unreadable Primitive CLI credentials because --force was set: {error}"
            ));
        }
        Err(error) => return Err(error),
    }

    let pending = read_active_pending_signup(io, context)?;
    match decide_pending_start(pending.as_ref(), email, flow, flags.force) {
        PendingStartDecision::ContinueExisting { .. } => {
            let mut output = continue_pending_start_output(
                pending
                    .as_ref()
                    .expect("continue decision includes existing pending"),
                flow,
            );
            output.stderr.splice(0..0, prefix);
            return Ok(output);
        }
        PendingStartDecision::Blocked { message } => return Err(anyhow!("{message}")),
        PendingStartDecision::ReplaceExisting => {
            io.remove_file(&pending_signup_path(&context.config_dir))?;
        }
        PendingStartDecision::StartNew => {}
    }

    let plan = plan_auth_command_request(
        &AuthCommand::StartEmailCode {
            email: Some(email.to_string()),
            flags: flags.clone(),
            flow,
        },
        AuthCommandRequestContext {
            credentials: None,
            fallback_device_name: &context.fallback_device_name,
            pending: None,
        },
    )?;
    let AuthCommandRequestPlan::StartEmailCode(request) = plan else {
        return Err(anyhow!(
            "Internal auth planner returned the wrong start plan."
        ));
    };
    let response = http.send(context, &request)?;
    if !response_has_data(&response) {
        return Err(auth_error_for_response(
            &response,
            "Could not start Primitive email-code auth.",
        ));
    }
    let start: AgentSignupStartResult = parse_response_data(
        &response,
        "Primitive API returned an empty agent signup response.",
    )?;
    let created_at = system_time_to_utc_millis(context.now);
    let expires_at =
        system_time_to_utc_millis(access_token_expires_at(context.now, start.expires_in));
    let pending =
        PendingAgentSignup::from_start(start, &context.api_base_url, &created_at, &expires_at);
    io.write_string(
        &pending_signup_path(&context.config_dir),
        &serialize_pending_signup(&pending)?,
    )?;
    let mut output = start_email_code_output(&pending, flow);
    output.stderr.splice(0..0, prefix);
    Ok(output)
}

fn execute_confirm_email_code(
    flow: EmailCodeFlow,
    email: &str,
    code: &str,
    flags: &ConfirmEmailCodeFlags,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
) -> Result<AuthTextOutput> {
    let positional_code = if has_non_positional_verification_code_source(flags) {
        None
    } else {
        Some(code)
    };
    let resolved_code = resolve_verification_code(positional_code, flags, io)?;
    let pending = read_active_pending_signup(io, context)?;
    let pending = required_pending_for_email(pending.as_ref(), flow, email)?;
    let plan = plan_auth_command_request(
        &AuthCommand::ConfirmEmailCode {
            code: resolved_code,
            email: email.to_string(),
            flags: flags.clone(),
            flow,
        },
        AuthCommandRequestContext {
            credentials: None,
            fallback_device_name: &context.fallback_device_name,
            pending: Some(pending),
        },
    )?;
    let AuthCommandRequestPlan::ConfirmEmailCode(request) = plan else {
        return Err(anyhow!(
            "Internal auth planner returned the wrong confirm plan."
        ));
    };
    let response = http.send(context, &request)?;
    if response_has_data(&response) {
        let signup: AgentSignupVerifyResult = parse_response_data(
            &response,
            "Primitive API returned an empty agent signup verification response.",
        )?;
        let created_at = system_time_to_utc_millis(context.now);
        let expires_at =
            system_time_to_utc_millis(access_token_expires_at(context.now, signup.expires_in));
        let write = plan_signup_credentials_write(
            &context.config_dir,
            &context.api_base_url,
            &signup,
            &created_at,
            &expires_at,
        )?;
        apply_credential_write(io, &context.config_dir, &write)?;
        return Ok(AuthTextOutput::stderr(write.stderr));
    }

    match decide_verify_result(false, response_error_code(&response)) {
        VerifyDecision::InvalidCode => Err(anyhow!(
            "Invalid verification code. Try again, run {}, or run primitive signup status.",
            flow.resend_command(email)
        )),
        VerifyDecision::ClearPendingAndFail => {
            io.remove_file(&pending_signup_path(&context.config_dir))?;
            Err(auth_error_for_response(
                &response,
                "Primitive email-code auth failed while verifying the account.",
            ))
        }
        VerifyDecision::Fail | VerifyDecision::SaveCredentials => Err(auth_error_for_response(
            &response,
            "Primitive email-code auth failed while verifying the account.",
        )),
    }
}

fn execute_resend_email_code(
    flow: EmailCodeFlow,
    email: Option<&str>,
    _flags: &ResendEmailCodeFlags,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
) -> Result<AuthTextOutput> {
    let pending = read_active_pending_signup(io, context)?;
    let pending = match email {
        Some(email) => required_pending_for_email(pending.as_ref(), flow, email)?,
        None => pending.as_ref().ok_or_else(|| {
            anyhow!(
                "No pending {} found. Run `primitive signup status` to inspect pending state.",
                flow.action_noun()
            )
        })?,
    };
    let plan = plan_auth_command_request(
        &AuthCommand::ResendEmailCode {
            email: email.map(str::to_string),
            flags: ResendEmailCodeFlags::default(),
            flow,
        },
        AuthCommandRequestContext {
            credentials: None,
            fallback_device_name: &context.fallback_device_name,
            pending: Some(pending),
        },
    )?;
    let AuthCommandRequestPlan::ResendEmailCode(request) = plan else {
        return Err(anyhow!(
            "Internal auth planner returned the wrong resend plan."
        ));
    };
    let response = http.send(context, &request)?;
    if response_has_data(&response) {
        let resend: AgentSignupResendResult = parse_response_data(
            &response,
            "Primitive API returned an empty agent signup resend response.",
        )?;
        let created_at = system_time_to_utc_millis(context.now);
        let expires_at =
            system_time_to_utc_millis(access_token_expires_at(context.now, resend.expires_in));
        let next = PendingAgentSignup::from_resend(pending, resend, &created_at, &expires_at);
        io.write_string(
            &pending_signup_path(&context.config_dir),
            &serialize_pending_signup(&next)?,
        )?;
        return Ok(resend_email_code_output(&next, true));
    }

    match decide_resend_result(
        false,
        response_error_code(&response),
        retry_after_seconds(&response),
        pending.resend_after,
    ) {
        ResendDecision::Wait {
            retry_after_seconds,
        } => Ok(AuthTextOutput::stderr(vec![format!(
            "Verification email was sent recently. Wait {} before trying again.",
            format_signup_seconds(Some(retry_after_seconds))
        )])),
        ResendDecision::ClearPendingAndFail => {
            io.remove_file(&pending_signup_path(&context.config_dir))?;
            Err(auth_error_for_response(
                &response,
                "Could not resend Primitive email-code verification email.",
            ))
        }
        ResendDecision::Fail | ResendDecision::SavePending => Err(auth_error_for_response(
            &response,
            "Could not resend Primitive email-code verification email.",
        )),
    }
}

fn execute_signup_status(
    email: Option<&str>,
    flags: &SignupStatusFlags,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
) -> Result<AuthTextOutput> {
    let api_base_url = flags
        .api_base_url
        .as_deref()
        .unwrap_or(&context.api_base_url);
    let pending = read_pending_signup_state(io, &context.config_dir)?
        .filter(|pending| pending.api_base_url == api_base_url);
    let status = pending_signup_status(
        pending.as_ref(),
        EmailCodeFlow::Signup,
        email,
        now_epoch_ms(context.now),
    )?;
    signup_status_output(&status, flags.json)
}

fn execute_logout(
    flags: &LogoutFlags,
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
    http: &mut impl AuthRuntimeHttp,
) -> Result<AuthTextOutput> {
    if flags.force {
        return force_logout(context, io);
    }
    let credentials = read_credentials_for_auth(io, &context.config_dir)?.ok_or_else(|| {
        anyhow!("Not logged in. Run `primitive signin` to create saved CLI credentials.")
    })?;
    let logout_context = context.with_api_key_if_missing(&credentials.access_token);
    let plan = plan_auth_command_request(
        &AuthCommand::Logout {
            flags: flags.clone(),
        },
        AuthCommandRequestContext {
            credentials: Some(&credentials),
            fallback_device_name: &context.fallback_device_name,
            pending: None,
        },
    )?;
    let AuthCommandRequestPlan::Logout(request) = plan else {
        return Err(anyhow!(
            "Internal auth planner returned the wrong logout plan."
        ));
    };
    let response = http.send(&logout_context, &request)?;
    if !response_success(&response) {
        if matches!(
            response_error_code(&response),
            Some("unauthorized" | "not_found")
        ) {
            delete_cli_credentials(io, &context.config_dir)?;
        }
        return Err(auth_error_for_response(
            &response,
            "Could not revoke the saved Primitive CLI OAuth grant.",
        ));
    }
    delete_cli_credentials(io, &context.config_dir)?;
    let grant_id = response_data_value(&response)
        .and_then(|data| {
            data.get("oauth_grant_id")
                .or_else(|| data.get("key_id"))
                .and_then(Value::as_str)
        })
        .unwrap_or(&credentials.oauth_grant_id);
    Ok(AuthTextOutput::stderr(vec![format!(
        "Logged out and revoked OAuth grant {grant_id}."
    )]))
}

fn execute_whoami(
    flags: &WhoamiFlags,
    context: &AuthExecutionContext,
    http: &mut impl AuthRuntimeHttp,
) -> Result<AuthTextOutput> {
    let whoami_context = if let Some(api_key) = &flags.api_key {
        let mut next = context.clone();
        next.api_key = Some(api_key.clone());
        next
    } else {
        context.clone()
    };
    let plan = plan_auth_command_request(
        &AuthCommand::Whoami {
            flags: flags.clone(),
        },
        AuthCommandRequestContext {
            credentials: None,
            fallback_device_name: &context.fallback_device_name,
            pending: None,
        },
    )?;
    let AuthCommandRequestPlan::Whoami(request) = plan else {
        return Err(anyhow!(
            "Internal auth planner returned the wrong whoami plan."
        ));
    };
    let response = http.send(&whoami_context, &request)?;
    if !response_has_data(&response) {
        return Err(auth_error_for_response(
            &response,
            "Could not fetch the authenticated Primitive account.",
        ));
    }
    let account = response_data_value(&response)
        .expect("response_has_data ensured account data")
        .clone();
    let managed_inbox_domain = best_effort_managed_inbox_domain(&whoami_context, http);
    let account = account_with_managed_inbox_domain(&account, managed_inbox_domain.as_deref());
    whoami_output(&account, flags.json)
}

fn best_effort_managed_inbox_domain(
    context: &AuthExecutionContext,
    http: &mut impl AuthRuntimeHttp,
) -> Option<String> {
    let request = plan_whoami_domains_request();
    let response = http.send(context, &request).ok()?;
    if !response_has_data(&response) {
        return None;
    }
    response_data_value(&response).and_then(managed_inbox_domain_from_domains)
}

pub fn managed_inbox_domain_from_domains(domains: &Value) -> Option<String> {
    domains.as_array()?.iter().find_map(|row| {
        let verified = row
            .get("verified")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let managed_zone = row.get("managed_zone").filter(|value| !value.is_null());
        let domain = row
            .get("domain")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())?;
        if verified && managed_zone.is_some() {
            Some(domain.to_string())
        } else {
            None
        }
    })
}

pub fn account_with_managed_inbox_domain(account: &Value, managed_domain: Option<&str>) -> Value {
    let mut account = account.clone();
    if let Value::Object(map) = &mut account {
        map.insert(
            "managed_inbox_domain".to_string(),
            managed_domain.map_or(Value::Null, |domain| json!(domain)),
        );
    }
    account
}

pub fn whoami_output(account: &Value, json_output: bool) -> Result<AuthTextOutput> {
    if json_output {
        return Ok(AuthTextOutput::stdout(vec![serde_json::to_string_pretty(
            account,
        )?]));
    }
    let email = account
        .get("email")
        .and_then(Value::as_str)
        .unwrap_or("(unknown email)");
    let id = account
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("(unknown account id)");
    let plan = account
        .get("plan")
        .and_then(Value::as_str)
        .unwrap_or("(unknown plan)");
    let mut lines = vec![
        format!("Authenticated as {email}"),
        format!("Account id: {id}"),
        format!("Plan: {plan}"),
    ];
    if let Some(domain) = account_managed_inbox_domain(account) {
        lines.push(format!("Managed inbox: any-local-part@{domain}"));
    }
    Ok(AuthTextOutput::stdout(lines))
}

fn account_managed_inbox_domain(account: &Value) -> Option<&str> {
    account
        .get("managed_inbox_domain")
        .and_then(Value::as_str)
        .or_else(|| account.get("managed_inbox_address").and_then(Value::as_str))
        .filter(|value| !value.trim().is_empty())
}

fn read_active_pending_signup(
    io: &mut impl AuthRuntimeIo,
    context: &AuthExecutionContext,
) -> Result<Option<PendingAgentSignup>> {
    let Some(mut pending) = read_pending_signup_state(io, &context.config_dir)? else {
        return Ok(None);
    };
    match decide_pending_state(
        Some(&pending),
        &context.api_base_url,
        now_epoch_ms(context.now),
    ) {
        PendingStateDecision::Use { expires_in } => {
            pending.expires_in = expires_in;
            Ok(Some(pending))
        }
        PendingStateDecision::ClearExpired { .. } => {
            io.remove_file(&pending_signup_path(&context.config_dir))?;
            Ok(None)
        }
        PendingStateDecision::IgnoreDifferentApiBaseUrl { .. } | PendingStateDecision::Missing => {
            Ok(None)
        }
    }
}

fn read_pending_signup_state(
    io: &mut impl AuthRuntimeIo,
    config_dir: &str,
) -> Result<Option<PendingAgentSignup>> {
    let path = pending_signup_path(config_dir);
    let Some(contents) = io.read_to_string(&path)? else {
        return Ok(None);
    };
    match serde_json::from_str::<Value>(&contents)
        .ok()
        .and_then(|value| parse_pending_signup(&value))
    {
        Some(pending) => Ok(Some(pending)),
        None => {
            io.remove_file(&path)?;
            Ok(None)
        }
    }
}

fn read_credentials_for_auth(
    io: &mut impl AuthRuntimeIo,
    config_dir: &str,
) -> Result<Option<StoredCliCredentials>> {
    let path = credentials_path(config_dir);
    let Some(contents) = io.read_to_string(&path)? else {
        return Ok(None);
    };
    let credentials = serde_json::from_str(&contents)
        .with_context(|| format!("Stored Primitive CLI credentials are not valid JSON: {path}"))?;
    Ok(Some(credentials))
}

fn apply_credential_write(
    io: &mut impl AuthRuntimeIo,
    config_dir: &str,
    write: &CredentialWritePlan,
) -> Result<()> {
    if write.delete_chat_state {
        io.remove_file(&chat_state_path(config_dir))?;
    }
    io.write_string(&write.credentials_path, &write.credentials_json)?;
    if let Some(path) = &write.delete_pending_path {
        io.remove_file(path)?;
    }
    Ok(())
}

fn delete_cli_credentials(io: &mut impl AuthRuntimeIo, config_dir: &str) -> Result<()> {
    io.remove_file(&credentials_path(config_dir))?;
    io.remove_file(&chat_state_path(config_dir))
}

fn force_logout(
    context: &AuthExecutionContext,
    io: &mut impl AuthRuntimeIo,
) -> Result<AuthTextOutput> {
    let credentials = credentials_path(&context.config_dir);
    let chat_state = chat_state_path(&context.config_dir);
    let pending = pending_signup_path(&context.config_dir);
    let credentials_lock = credentials_lock_path(&context.config_dir);
    let mut removed = Vec::new();
    if io.exists(&credentials) {
        removed.push("local Primitive CLI credentials");
    }
    if io.exists(&chat_state) {
        removed.push("local chat reply state");
    }
    if io.exists(&pending) {
        removed.push("pending email-code auth state");
    }
    if io.exists(&credentials_lock) {
        removed.push("credential lock");
    }
    io.remove_file(&credentials)?;
    io.remove_file(&chat_state)?;
    io.remove_file(&pending)?;
    io.remove_dir_all(&credentials_lock)?;
    if removed.is_empty() {
        return Ok(AuthTextOutput::stderr(vec![
            "No local Primitive CLI auth state was present. Backing OAuth grant was not revoked."
                .to_string(),
        ]));
    }
    Ok(AuthTextOutput::stderr(vec![format!(
        "Removed {}. Backing OAuth grant was not revoked.",
        format_auth_list(&removed)
    )]))
}

fn format_auth_list(values: &[&str]) -> String {
    match values {
        [] => String::new(),
        [value] => (*value).to_string(),
        [first, second] => format!("{first} and {second}"),
        _ => format!(
            "{}, and {}",
            values[..values.len() - 1].join(", "),
            values[values.len() - 1]
        ),
    }
}

fn parse_response_data<T: DeserializeOwned>(
    response: &AuthApiResponse,
    empty_message: &str,
) -> Result<T> {
    let data = response_data_value(response).ok_or_else(|| anyhow!("{empty_message}"))?;
    serde_json::from_value(data.clone()).map_err(Into::into)
}

fn response_data_value(response: &AuthApiResponse) -> Option<&Value> {
    response
        .body
        .as_ref()
        .and_then(|body| body.get("data"))
        .filter(|data| !data.is_null())
}

fn response_has_data(response: &AuthApiResponse) -> bool {
    response.status < 400 && response_data_value(response).is_some()
}

fn response_success(response: &AuthApiResponse) -> bool {
    response.status < 400
        && response
            .body
            .as_ref()
            .and_then(|body| body.get("success"))
            .and_then(Value::as_bool)
            .unwrap_or(true)
}

fn response_error_code(response: &AuthApiResponse) -> Option<&str> {
    response
        .body
        .as_ref()
        .and_then(|body| body.get("error"))
        .and_then(|error| error.get("code"))
        .and_then(Value::as_str)
}

fn retry_after_seconds(response: &AuthApiResponse) -> Option<u64> {
    response
        .headers
        .get("retry-after")
        .or_else(|| response.headers.get("Retry-After"))
        .and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
}

fn auth_error_for_response(response: &AuthApiResponse, fallback: &str) -> anyhow::Error {
    if let Some(body) = &response.body {
        return anyhow!(
            "{}",
            serde_json::to_string_pretty(body).unwrap_or_else(|_| body.to_string())
        );
    }
    if response.status >= 400 {
        return anyhow!("HTTP {}", response.status);
    }
    anyhow!("{fallback}")
}

fn write_auth_text_output(output: &AuthTextOutput) {
    if let Some(url) = &output.open_url {
        open_browser_url(url);
    }
    for line in &output.stderr {
        eprintln!("{line}");
    }
    for line in &output.stdout {
        println!("{line}");
    }
}

fn open_browser_url(url: &str) {
    let mut command = if cfg!(target_os = "macos") {
        let mut command = ProcessCommand::new("open");
        command.arg(url);
        command
    } else if cfg!(target_os = "windows") {
        let mut command = ProcessCommand::new("cmd");
        command.args(["/C", "start", "", url]);
        command
    } else {
        let mut command = ProcessCommand::new("xdg-open");
        command.arg(url);
        command
    };
    let _ = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

fn command_time_enabled(command: &AuthCommand) -> bool {
    matches!(
        command,
        AuthCommand::Whoami {
            flags: WhoamiFlags { time: true, .. }
        }
    )
}

fn fallback_device_name() -> String {
    std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "primitive-rust".to_string())
}

fn system_time_to_utc_millis(time: SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn now_epoch_ms(now: SystemTime) -> i64 {
    match now.duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis().min(i64::MAX as u128) as i64,
        Err(error) => {
            let before_epoch = error.duration().as_millis().min(i64::MAX as u128) as i64;
            -before_epoch
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_string()).collect()
    }

    #[test]
    fn auth_parser_rejects_unknown_flags_per_command() {
        let browser_error = dispatch(&args(&["login", "browser", "--signup-code", "invite"]))
            .expect_err("browser login should reject email-code start flags")
            .to_string();
        assert_eq!(browser_error, "Unknown flag --signup-code");

        let email_code_error = dispatch(&args(&["login", "user@example.com", "--no-browser"]))
            .expect_err("email-code login should reject browser-only flags")
            .to_string();
        assert_eq!(email_code_error, "Unknown flag --no-browser");

        let status_error = dispatch(&args(&["signup", "status", "--accept-terms"]))
            .expect_err("signup status should reject signup start flags")
            .to_string();
        assert_eq!(status_error, "Unknown flag --accept-terms");

        let logout_error = dispatch(&args(&["logout", "--json"]))
            .expect_err("logout should reject display flags")
            .to_string();
        assert_eq!(logout_error, "Unknown flag --json");

        let whoami_error = dispatch(&args(&["whoami", "--force"]))
            .expect_err("whoami should reject logout force")
            .to_string();
        assert_eq!(whoami_error, "Unknown flag --force");
    }

    #[test]
    fn auth_parser_rejects_missing_values_before_following_flags() {
        let start_error = dispatch(&args(&[
            "signup",
            "--signup-code",
            "--accept-terms",
            "user@example.com",
        ]))
        .expect_err("signup-code should require a value before the next flag")
        .to_string();
        assert_eq!(start_error, "Missing value for --signup-code");

        let browser_error = dispatch(&args(&["login", "browser", "--device-name"]))
            .expect_err("device-name should require a value")
            .to_string();
        assert_eq!(browser_error, "Missing value for --device-name");

        let confirm_error = dispatch(&args(&[
            "signup",
            "confirm",
            "user@example.com",
            "--code-from-env",
            "--force",
        ]))
        .expect_err("code-from-env should require a value before the next flag")
        .to_string();
        assert_eq!(confirm_error, "Missing value for --code-from-env");

        let whoami_error = dispatch(&args(&["whoami", "--api-key", "--json"]))
            .expect_err("api-key should require a value before the next flag")
            .to_string();
        assert_eq!(whoami_error, "Missing value for --api-key");
    }

    #[test]
    fn auth_parser_preserves_colon_aliases_and_browser_flags() {
        let command = dispatch_auth_command(
            "login:browser",
            &args(&["--device-name", "work-laptop", "--no-browser", "-f"]),
        )
        .expect("dispatch login browser colon alias");

        assert_eq!(
            command,
            AuthCommand::BrowserLogin {
                verb: BrowserLoginVerb::Login,
                flags: BrowserLoginFlags {
                    device_name: Some("work-laptop".to_string()),
                    force: true,
                    no_browser: true,
                    ..BrowserLoginFlags::default()
                },
            }
        );
    }
}
