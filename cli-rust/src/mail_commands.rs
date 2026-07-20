use crate::{client, config};
use anyhow::{anyhow, Context, Result};
use chrono::{SecondsFormat, Utc};
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{self, IsTerminal, Read};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const SUBJECT_MAX_LENGTH: usize = 200;
const DEFAULT_CHAT_TIMEOUT_SECONDS: u64 = 120;
const DEFAULT_STRICT_PHASE_SECONDS: u64 = 60;
const DEFAULT_EMAIL_POLL_INTERVAL_SECONDS: u64 = 2;
const DEFAULT_EMAIL_POLL_PAGE_SIZE: u64 = 50;
const MAX_EMAIL_POLL_PAGE_SIZE: u64 = 100;
const CHAT_STATE_FILE: &str = "chat-state.json";
const CHAT_STATE_VERSION: u64 = 2;
const MAX_CHAT_CONVERSATIONS: usize = 50;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MessageBodySourceInput {
    pub body: Option<String>,
    pub body_file: Option<String>,
    pub body_stdin: bool,
    pub html: Option<String>,
    pub html_file: Option<String>,
    pub html_stdin: bool,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ResolvedMessageBodies {
    pub body: Option<String>,
    pub html: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Attachment {
    pub content_base64: String,
    pub filename: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SendShortcutInput {
    pub from: Option<String>,
    pub default_from: Option<String>,
    pub to: String,
    pub cc: Vec<String>,
    pub bcc: Vec<String>,
    pub subject: Option<String>,
    pub bodies: ResolvedMessageBodies,
    pub attachments: Option<Vec<Attachment>>,
    pub in_reply_to: Option<String>,
    pub wait: Option<bool>,
    pub wait_timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReplyShortcutInput {
    pub id: String,
    pub from: Option<String>,
    pub bodies: ResolvedMessageBodies,
    pub attachments: Option<Vec<Attachment>>,
    pub wait: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChatSendInput {
    pub recipient: String,
    pub message: String,
    pub from: String,
    pub subject: Option<String>,
    pub in_reply_to: Option<String>,
    pub attachments: Option<Vec<Attachment>>,
    pub reply_to_email_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChatWaitInput {
    pub from: String,
    pub recipient: String,
    pub sent_at_iso: String,
    pub sent_id: String,
    pub strict_only: bool,
    pub page_size: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChatTurnInput {
    pub send: ChatSendInput,
    pub wait: ChatWaitInput,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChatTurnPlan {
    pub send: ApiRequest,
    pub wait_phases: Vec<ChatWaitPhaseRequest>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MailCommandKind {
    Send,
    Reply,
    Chat,
    ChatReply,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct MailCommandIdentification {
    pub kind: MailCommandKind,
    pub consumed_args: usize,
    pub command: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MailOutputShape {
    JsonResult,
    ChatTranscript,
    ChatJsonEnvelope,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct MailRuntimeFlags {
    pub auth: BTreeMap<String, String>,
    pub time: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct MailSingleRequestPlan {
    pub target_operation_id: &'static str,
    pub request: ApiRequest,
    pub output_shape: MailOutputShape,
    pub runtime: MailRuntimeFlags,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ChatReplyContextPlan {
    None,
    Exact { id: String, request: ApiRequest },
    LatestInboundFromRecipient { request: ApiRequest },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatWaitPlan {
    pub timeout_seconds: u64,
    pub strict_phase_seconds: u64,
    pub interval_seconds: u64,
    pub page_size: u64,
    pub phases: Vec<ChatWaitPhaseRequest>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatCommandPlan {
    pub target_operation_id: &'static str,
    pub recipient: String,
    pub from: String,
    pub subject: Option<String>,
    pub message: String,
    pub attachments: Option<Vec<Attachment>>,
    pub reply_mode: bool,
    pub local_chat_id: Option<u64>,
    pub quiet: bool,
    pub send: Option<ApiRequest>,
    pub reply_context: ChatReplyContextPlan,
    pub wait: ChatWaitPlan,
    pub output_shape: MailOutputShape,
    pub runtime: MailRuntimeFlags,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct SavedChatState {
    pub local_id: u64,
    pub recipient: String,
    pub from: String,
    pub last_reply_email_id: String,
    pub timeout_seconds: u64,
    pub strict_phase_seconds: u64,
    pub strict_only: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SavedChatStateInput {
    pub recipient: String,
    pub from: String,
    pub last_reply_email_id: String,
    pub last_reply_received_at: String,
    pub last_sent_email_id: String,
    pub thread_id: Option<String>,
    pub timeout_seconds: u64,
    pub strict_phase_seconds: u64,
    pub strict_only: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct ChatConversationState {
    pub from: String,
    pub last_reply_email_id: String,
    pub last_reply_received_at: String,
    pub last_sent_email_id: String,
    pub local_id: u64,
    pub recipient: String,
    pub strict_only: bool,
    pub strict_phase_seconds: u64,
    pub thread_id: Option<String>,
    pub timeout_seconds: u64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
struct LegacyChatConversationState {
    pub from: String,
    pub last_reply_email_id: String,
    pub last_reply_received_at: String,
    pub last_sent_email_id: String,
    pub recipient: String,
    pub strict_only: bool,
    pub strict_phase_seconds: u64,
    pub thread_id: Option<String>,
    pub timeout_seconds: u64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct ChatStateFile {
    pub active_local_id: Option<u64>,
    pub conversations: Vec<ChatConversationState>,
    #[serde(default)]
    pub next_local_id: u64,
    pub version: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ChatReplyStateLookup {
    Active,
    LocalId { id: u64 },
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatReplyCommandPlan {
    pub state_lookup: ChatReplyStateLookup,
    pub message: Option<String>,
    pub needs_stdin: bool,
    pub forward_args: Option<Vec<String>>,
    pub output_shape: MailOutputShape,
    pub runtime: MailRuntimeFlags,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum MailCommandPlan {
    Send(MailSingleRequestPlan),
    Reply(MailSingleRequestPlan),
    Chat(Box<ChatCommandPlan>),
    ChatReply(ChatReplyCommandPlan),
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChatResponseBodyFormat {
    Empty,
    Html,
    Text,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatResponseBody {
    pub body: String,
    pub format: ChatResponseBodyFormat,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatPlaceholder {
    pub description: String,
    pub token: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatFollowUpCommand {
    pub argv: Vec<String>,
    pub kind: String,
    pub description: String,
    pub command: String,
    pub placeholders: Vec<ChatPlaceholder>,
    pub requires_message: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatCommandOutcome {
    pub sent: Value,
    pub reply: Value,
    pub local_chat_id: Option<u64>,
    pub response_body: String,
    pub response_body_format: ChatResponseBodyFormat,
    pub match_strategy: ChatMatchStrategy,
    pub recipient: String,
    pub from: String,
    pub subject: String,
    pub sent_at_iso: String,
    pub json: bool,
    pub quiet: bool,
    pub strict_only: bool,
    pub strict_phase_seconds: u64,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ApiRequest {
    pub method: String,
    pub path: String,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub query: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

type StdinReader<'a> = Option<&'a mut dyn FnMut() -> Result<String>>;
type LookupRequestExecutor<'a> = Option<&'a mut dyn FnMut(&ApiRequest) -> Result<Value>>;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct ChatWaitPhaseRequest {
    pub strategy: ChatMatchStrategy,
    pub request: ApiRequest,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ChatMatchStrategy {
    Strict,
    Fallback,
}

#[derive(Debug, Default)]
struct ParsedArgs {
    bool_flags: BTreeMap<String, bool>,
    flags: BTreeMap<String, Vec<String>>,
    positionals: Vec<String>,
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if matches!(
        args.first().map(String::as_str),
        Some("--help" | "-h" | "help")
    ) {
        print_help();
        return Ok(());
    }
    let identification = identify_mail_command(args)
        .ok_or_else(|| anyhow!("mail commands require `send`, `reply`, or `chat`"))?;
    let rest = &args[identification.consumed_args..];
    if is_help_request(rest) {
        print!("{}", mail_command_help_text(identification.kind));
        return Ok(());
    }
    match identification.kind {
        MailCommandKind::Send => {
            let plan = build_send_command_plan_from_args_with_default_lookup(rest, |request| {
                let auth = config::resolve_auth(&runtime_flags(rest)?.auth)?;
                execute_mail_request(request, &auth)
            })?;
            execute_single_request_plan(&plan)
        }
        MailCommandKind::Reply => {
            let plan = build_reply_command_plan_from_args(rest)?;
            execute_single_request_plan(&plan)
        }
        MailCommandKind::Chat => {
            let plan = build_chat_command_plan_from_args_with_default_lookup_with_stdin(
                rest,
                "",
                "",
                read_chat_message_stdin,
                |request| {
                    let auth = config::resolve_auth(&runtime_flags(rest)?.auth)?;
                    execute_mail_request(request, &auth)
                },
            )?;
            execute_chat_command_plan(&plan)
        }
        MailCommandKind::ChatReply => {
            let plan = build_chat_reply_command_plan_from_args(rest, None)?;
            execute_chat_reply_command_plan(rest, &plan)
        }
    }
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
}

pub fn is_mail_friendly_command(command: &str) -> bool {
    mail_command_kind(command).is_some()
}

pub fn mail_command_kind(command: &str) -> Option<MailCommandKind> {
    match command {
        "send" => Some(MailCommandKind::Send),
        "reply" => Some(MailCommandKind::Reply),
        "chat" => Some(MailCommandKind::Chat),
        "chat:reply" => Some(MailCommandKind::ChatReply),
        _ => None,
    }
}

pub fn mail_command_target(command: &str) -> Option<&'static str> {
    match mail_command_kind(command)? {
        MailCommandKind::Send | MailCommandKind::Chat => Some("sending:send-email"),
        MailCommandKind::Reply | MailCommandKind::ChatReply => Some("sending:reply-to-email"),
    }
}

pub fn identify_mail_command(args: &[String]) -> Option<MailCommandIdentification> {
    let first = args.first()?;
    if first == "chat" && args.get(1).map(String::as_str) == Some("reply") {
        return Some(MailCommandIdentification {
            kind: MailCommandKind::ChatReply,
            consumed_args: 2,
            command: "chat reply".to_string(),
        });
    }
    let kind = mail_command_kind(first)?;
    Some(MailCommandIdentification {
        kind,
        consumed_args: 1,
        command: first.clone(),
    })
}

pub fn build_mail_command_plan(
    args: &[String],
    default_from: Option<String>,
    sent_at_iso: &str,
    sent_id: &str,
) -> Result<MailCommandPlan> {
    let identification = identify_mail_command(args)
        .ok_or_else(|| anyhow!("mail commands require `send`, `reply`, or `chat`"))?;
    let rest = &args[identification.consumed_args..];
    match identification.kind {
        MailCommandKind::Send => Ok(MailCommandPlan::Send(build_send_command_plan_from_args(
            rest,
            default_from,
        )?)),
        MailCommandKind::Reply => Ok(MailCommandPlan::Reply(build_reply_command_plan_from_args(
            rest,
        )?)),
        MailCommandKind::Chat => Ok(MailCommandPlan::Chat(Box::new(
            build_chat_command_plan_from_args(rest, default_from, sent_at_iso, sent_id)?,
        ))),
        MailCommandKind::ChatReply => Ok(MailCommandPlan::ChatReply(
            build_chat_reply_command_plan_from_args(rest, None)?,
        )),
    }
}

pub fn build_chat_reply_turn_plan_from_args(
    args: &[String],
    state: &SavedChatState,
    sent_at_iso: &str,
    sent_id: &str,
) -> Result<ChatCommandPlan> {
    let reply_plan = build_chat_reply_command_plan_from_args(args, Some(state))?;
    let forward_args = reply_plan.forward_args.ok_or_else(|| {
        anyhow!("No reply body provided. Pass the reply body as a positional argument or pipe it via stdin.")
    })?;
    build_chat_command_plan_from_args(&forward_args, None, sent_at_iso, sent_id)
}

pub fn build_send_command_plan_from_args(
    args: &[String],
    default_from: Option<String>,
) -> Result<MailSingleRequestPlan> {
    Ok(MailSingleRequestPlan {
        target_operation_id: "sending:send-email",
        request: build_send_request_from_args_with_default(args, default_from, None)?,
        output_shape: MailOutputShape::JsonResult,
        runtime: runtime_flags(args)?,
    })
}

pub fn build_send_command_plan_from_args_with_default_lookup(
    args: &[String],
    mut execute_lookup_request: impl FnMut(&ApiRequest) -> Result<Value>,
) -> Result<MailSingleRequestPlan> {
    Ok(MailSingleRequestPlan {
        target_operation_id: "sending:send-email",
        request: build_send_request_from_args_with_default(
            args,
            None,
            Some(&mut execute_lookup_request),
        )?,
        output_shape: MailOutputShape::JsonResult,
        runtime: runtime_flags(args)?,
    })
}

pub fn build_reply_command_plan_from_args(args: &[String]) -> Result<MailSingleRequestPlan> {
    Ok(MailSingleRequestPlan {
        target_operation_id: "sending:reply-to-email",
        request: build_reply_request_from_args(args)?,
        output_shape: MailOutputShape::JsonResult,
        runtime: runtime_flags(args)?,
    })
}

pub fn build_chat_command_plan_from_args(
    args: &[String],
    default_from: Option<String>,
    sent_at_iso: &str,
    sent_id: &str,
) -> Result<ChatCommandPlan> {
    build_chat_command_plan_from_args_internal(args, default_from, sent_at_iso, sent_id, None, None)
}

pub fn build_chat_command_plan_from_args_with_stdin(
    args: &[String],
    default_from: Option<String>,
    sent_at_iso: &str,
    sent_id: &str,
    mut read_stdin: impl FnMut() -> Result<String>,
) -> Result<ChatCommandPlan> {
    build_chat_command_plan_from_args_internal(
        args,
        default_from,
        sent_at_iso,
        sent_id,
        Some(&mut read_stdin),
        None,
    )
}

pub fn build_chat_command_plan_from_args_with_default_lookup(
    args: &[String],
    sent_at_iso: &str,
    sent_id: &str,
    mut execute_lookup_request: impl FnMut(&ApiRequest) -> Result<Value>,
) -> Result<ChatCommandPlan> {
    build_chat_command_plan_from_args_internal(
        args,
        None,
        sent_at_iso,
        sent_id,
        None,
        Some(&mut execute_lookup_request),
    )
}

pub fn build_chat_command_plan_from_args_with_default_lookup_with_stdin(
    args: &[String],
    sent_at_iso: &str,
    sent_id: &str,
    mut read_stdin: impl FnMut() -> Result<String>,
    mut execute_lookup_request: impl FnMut(&ApiRequest) -> Result<Value>,
) -> Result<ChatCommandPlan> {
    build_chat_command_plan_from_args_internal(
        args,
        None,
        sent_at_iso,
        sent_id,
        Some(&mut read_stdin),
        Some(&mut execute_lookup_request),
    )
}

fn build_chat_command_plan_from_args_internal(
    args: &[String],
    default_from: Option<String>,
    sent_at_iso: &str,
    sent_id: &str,
    mut read_stdin: StdinReader<'_>,
    mut execute_lookup_request: LookupRequestExecutor<'_>,
) -> Result<ChatCommandPlan> {
    let parsed = parse_chat_args(args)?;
    let recipient = parsed
        .positionals
        .first()
        .ok_or_else(|| anyhow!("chat requires a recipient"))?
        .clone();
    let positional_message = parsed.positionals.get(1).cloned();
    if parsed.positionals.len() > 2 {
        return Err(crate::usage_err!(
            "Unexpected argument: {}",
            parsed.positionals[2]
        ));
    }

    let reply = flag_one(&parsed, "reply");
    let reply_to_email_id = flag_one(&parsed, "reply-to-email-id");
    let reply_mode = reply.is_some() || reply_to_email_id.is_some();
    if reply.is_some()
        && positional_message
            .as_deref()
            .is_some_and(|value| !value.is_empty())
    {
        return Err(anyhow!(
            "Pass the reply body either as --reply or as the positional message, not both."
        ));
    }
    if reply_mode && flag_one(&parsed, "subject").is_some() {
        return Err(anyhow!(
            "--subject is not used with --reply. Primitive derives the reply subject from the inbound email."
        ));
    }
    if reply_mode && flag_one(&parsed, "in-reply-to").is_some() {
        return Err(anyhow!(
            "Use --reply-to-email-id with --reply instead of raw --in-reply-to."
        ));
    }

    let message = if let Some(reply) = reply {
        reply
    } else if let Some(message) = positional_message.filter(|value| !value.is_empty()) {
        message
    } else if let Some(read_stdin) = read_stdin.as_mut() {
        read_stdin()?
    } else {
        return Err(anyhow!(
            "No message provided. Pass the message as the second positional argument or pipe it via stdin."
        ));
    };
    if message.trim().is_empty() {
        return Err(anyhow!(
            "{}",
            if reply_mode {
                "Reply body is empty."
            } else {
                "Message body is empty."
            }
        ));
    }

    let allow_default_from_lookup = !reply_mode || reply_to_email_id.is_none();
    let from = resolve_outbound_from(
        flag_one(&parsed, "from"),
        default_from,
        allow_default_from_lookup,
        &mut execute_lookup_request,
    )?;
    let attachments = attachments_from_parsed(&parsed)?;
    let timeout_seconds =
        optional_u64_flag(&parsed, "timeout")?.unwrap_or(DEFAULT_CHAT_TIMEOUT_SECONDS);
    let strict_phase_seconds =
        optional_u64_flag(&parsed, "strict-phase-seconds")?.unwrap_or(DEFAULT_STRICT_PHASE_SECONDS);
    let interval_seconds =
        optional_u64_flag(&parsed, "interval")?.unwrap_or(DEFAULT_EMAIL_POLL_INTERVAL_SECONDS);
    let page_size =
        optional_u64_flag(&parsed, "page-size")?.unwrap_or(DEFAULT_EMAIL_POLL_PAGE_SIZE);
    ensure_range("--strict-phase-seconds", strict_phase_seconds, 1, u64::MAX)?;
    ensure_range("--interval", interval_seconds, 1, u64::MAX)?;
    ensure_range("--page-size", page_size, 1, MAX_EMAIL_POLL_PAGE_SIZE)?;
    let local_chat_id = optional_u64_flag(&parsed, "chat-local-id")?;
    let strict_only = parsed.bool_flags.get("strict-only") == Some(&true);
    let output_shape = if parsed.bool_flags.get("json") == Some(&true) {
        MailOutputShape::ChatJsonEnvelope
    } else {
        MailOutputShape::ChatTranscript
    };
    let subject = (!reply_mode)
        .then(|| flag_one(&parsed, "subject").unwrap_or_else(|| derive_subject(&message)));
    let send_input = ChatSendInput {
        recipient: recipient.clone(),
        message: message.clone(),
        from: from.clone(),
        subject: flag_one(&parsed, "subject"),
        in_reply_to: flag_one(&parsed, "in-reply-to"),
        attachments: attachments.clone(),
        reply_to_email_id: reply_to_email_id.clone(),
    };
    let reply_context = if reply_mode {
        match &reply_to_email_id {
            Some(id) => ChatReplyContextPlan::Exact {
                id: id.clone(),
                request: get_email_request(id),
            },
            None => ChatReplyContextPlan::LatestInboundFromRecipient {
                request: latest_inbound_from_recipient_request(&recipient, &from, page_size),
            },
        }
    } else {
        ChatReplyContextPlan::None
    };
    let send = if reply_mode && reply_to_email_id.is_none() {
        None
    } else {
        Some(build_chat_send_request(&send_input)?)
    };

    Ok(ChatCommandPlan {
        target_operation_id: if reply_mode {
            "sending:reply-to-email"
        } else {
            "sending:send-email"
        },
        recipient: recipient.clone(),
        from: from.clone(),
        subject,
        message,
        attachments: attachments.clone(),
        reply_mode,
        local_chat_id,
        quiet: parsed.bool_flags.get("quiet") == Some(&true),
        send,
        reply_context,
        wait: ChatWaitPlan {
            timeout_seconds,
            strict_phase_seconds,
            interval_seconds,
            page_size,
            phases: build_chat_wait_requests(&ChatWaitInput {
                from,
                recipient,
                sent_at_iso: sent_at_iso.to_string(),
                sent_id: sent_id.to_string(),
                strict_only,
                page_size,
            }),
        },
        output_shape,
        runtime: runtime_flags(args)?,
    })
}

pub fn build_chat_reply_command_plan_from_args(
    args: &[String],
    state: Option<&SavedChatState>,
) -> Result<ChatReplyCommandPlan> {
    let parsed_args = expand_attachment_aliases(args);
    let parsed = parse_args(
        &parsed_args,
        &[
            "api-key",
            "api-base-url",
            "id",
            "timeout",
            "strict-phase-seconds",
            "interval",
            "page-size",
        ],
        &["json", "quiet", "strict-only", "time"],
        &["attachment"],
    )?;
    if parsed.positionals.len() > 2 {
        return Err(crate::usage_err!(
            "Unexpected argument: {}",
            parsed.positionals[2]
        ));
    }

    let flag_id = optional_u64_flag(&parsed, "id")?;
    let positional_local_id = if flag_id.is_none() && parsed.positionals.len() == 2 {
        parse_local_chat_id(&parsed.positionals[0]).ok_or_else(|| {
            anyhow!(
                "When passing two positional arguments to `primitive chat reply`, the first must be a local chat id. Use `primitive chat reply '<message>'` for the active chat or `primitive chat reply --id <id> '<message>'` for a specific chat."
            )
        })?
        .into()
    } else {
        None
    };
    if flag_id.is_some() && parsed.positionals.len() == 2 {
        return Err(anyhow!(
            "With --id, pass the reply body as a single positional argument or pipe it via stdin."
        ));
    }

    let state_lookup = flag_id
        .or(positional_local_id)
        .map_or(ChatReplyStateLookup::Active, |id| {
            ChatReplyStateLookup::LocalId { id }
        });
    let message = if parsed.positionals.len() == 2 {
        parsed.positionals.get(1).cloned()
    } else {
        parsed.positionals.first().cloned()
    };
    if message
        .as_deref()
        .is_some_and(|value| value.trim().is_empty())
    {
        return Err(anyhow!("Reply body is empty."));
    }
    let needs_stdin = message.is_none();
    let output_shape = if parsed.bool_flags.get("json") == Some(&true) {
        MailOutputShape::ChatJsonEnvelope
    } else {
        MailOutputShape::ChatTranscript
    };
    let forward_args = match (state, &message) {
        (Some(state), Some(message)) => {
            Some(build_chat_reply_forward_args(&parsed, state, message)?)
        }
        _ => None,
    };

    Ok(ChatReplyCommandPlan {
        state_lookup,
        message,
        needs_stdin,
        forward_args,
        output_shape,
        runtime: runtime_flags(args)?,
    })
}

pub fn chat_state_path(config_dir: &Path) -> PathBuf {
    config_dir.join(CHAT_STATE_FILE)
}

pub fn load_active_chat_state(config_dir: &Path) -> Result<Option<SavedChatState>> {
    let Some(state) = load_chat_state_file(config_dir)? else {
        return Ok(None);
    };
    let Some(active_local_id) = state.active_local_id else {
        return Ok(None);
    };
    Ok(state
        .conversations
        .iter()
        .find(|conversation| conversation.local_id == active_local_id)
        .map(ChatConversationState::to_saved_state))
}

pub fn load_chat_conversation_by_local_id(
    config_dir: &Path,
    local_id: u64,
) -> Result<Option<SavedChatState>> {
    Ok(load_chat_state_file(config_dir)?
        .and_then(|state| {
            state
                .conversations
                .into_iter()
                .find(|conversation| conversation.local_id == local_id)
        })
        .map(|conversation| conversation.to_saved_state()))
}

pub fn save_active_chat_state_at(
    config_dir: &Path,
    input: SavedChatStateInput,
    preferred_local_id: Option<u64>,
    updated_at: &str,
) -> Result<SavedChatState> {
    let existing = load_chat_state_file(config_dir)?.unwrap_or_else(|| ChatStateFile {
        active_local_id: None,
        conversations: Vec::new(),
        next_local_id: 0,
        version: CHAT_STATE_VERSION,
    });
    let existing_by_preferred_id = preferred_local_id.and_then(|id| {
        existing
            .conversations
            .iter()
            .find(|conversation| conversation.local_id == id)
            .map(|conversation| conversation.local_id)
    });
    let existing_by_thread = input.thread_id.as_ref().and_then(|thread_id| {
        existing
            .conversations
            .iter()
            .find(|conversation| conversation.thread_id.as_ref() == Some(thread_id))
            .map(|conversation| conversation.local_id)
    });
    let local_id = existing_by_preferred_id
        .or(existing_by_thread)
        .unwrap_or(existing.next_local_id);
    let conversation = ChatConversationState {
        from: input.from,
        last_reply_email_id: input.last_reply_email_id,
        last_reply_received_at: input.last_reply_received_at,
        last_sent_email_id: input.last_sent_email_id,
        local_id,
        recipient: input.recipient,
        strict_only: input.strict_only,
        strict_phase_seconds: input.strict_phase_seconds,
        thread_id: input.thread_id,
        timeout_seconds: input.timeout_seconds,
        updated_at: updated_at.to_string(),
    };
    if !conversation.is_valid() {
        return Err(anyhow!("Saved chat state is missing required fields."));
    }

    let mut conversations = vec![conversation.clone()];
    conversations.extend(
        existing
            .conversations
            .into_iter()
            .filter(|item| item.local_id != local_id),
    );
    conversations.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    conversations.truncate(MAX_CHAT_CONVERSATIONS);
    let active_local_id = conversations
        .iter()
        .any(|item| item.local_id == local_id)
        .then_some(local_id);
    let next_local_id = conversations
        .iter()
        .map(|item| item.local_id.saturating_add(1))
        .fold(
            existing.next_local_id.max(local_id.saturating_add(1)),
            u64::max,
        );

    save_chat_state_file(
        config_dir,
        &ChatStateFile {
            active_local_id,
            conversations,
            next_local_id,
            version: CHAT_STATE_VERSION,
        },
    )?;
    Ok(conversation.to_saved_state())
}

pub fn auth_flags(args: &[String]) -> Result<BTreeMap<String, String>> {
    let mut flags = BTreeMap::new();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        let Some(raw) = arg.strip_prefix("--") else {
            index += 1;
            continue;
        };
        if raw.starts_with("no-") {
            index += 1;
            continue;
        }
        let (name, inline_value) = raw
            .split_once('=')
            .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));
        if matches!(name, "api-key" | "api-base-url") {
            let value = if let Some(value) = inline_value {
                value
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
            flags.insert(name.to_string(), value);
        }
        index += 1;
    }
    Ok(flags)
}

pub fn has_time_flag(args: &[String]) -> bool {
    args.iter()
        .rev()
        .find_map(|arg| {
            if arg == "--time" || arg == "--time=true" {
                Some(true)
            } else if arg == "--no-time" || arg == "--time=false" {
                Some(false)
            } else {
                None
            }
        })
        .unwrap_or(false)
}

pub fn resolve_chat_response_body(reply: &Value) -> ChatResponseBody {
    let body_text = reply
        .get("body_text")
        .and_then(Value::as_str)
        .map(str::to_string);
    let body_html = reply
        .get("body_html")
        .and_then(Value::as_str)
        .map(str::to_string);
    if body_text.as_deref().is_some_and(|body| !body.is_empty()) {
        return ChatResponseBody {
            body: body_text.unwrap_or_default(),
            format: ChatResponseBodyFormat::Text,
        };
    }
    if body_html.as_deref().is_some_and(|body| !body.is_empty()) {
        return ChatResponseBody {
            body: body_html.unwrap_or_default(),
            format: ChatResponseBodyFormat::Html,
        };
    }
    if let Some(body) = body_text {
        return ChatResponseBody {
            body,
            format: ChatResponseBodyFormat::Text,
        };
    }
    if let Some(body) = body_html {
        return ChatResponseBody {
            body,
            format: ChatResponseBodyFormat::Html,
        };
    }
    ChatResponseBody {
        body: String::new(),
        format: ChatResponseBodyFormat::Empty,
    }
}

pub fn execute_chat_command_plan_with_runtime<RequestFn, NowIsoFn, NowMillisFn, SleepFn>(
    plan: &ChatCommandPlan,
    mut execute_request: RequestFn,
    mut now_iso: NowIsoFn,
    mut now_millis: NowMillisFn,
    mut sleep_seconds: SleepFn,
) -> Result<ChatCommandOutcome>
where
    RequestFn: FnMut(&ApiRequest) -> Result<Value>,
    NowIsoFn: FnMut() -> String,
    NowMillisFn: FnMut() -> u128,
    SleepFn: FnMut(u64) -> Result<()>,
{
    let sent_at_iso = now_iso();
    let send_request = resolve_chat_send_request(plan, &mut execute_request)?;
    let sent = response_object(
        response_data(execute_request(&send_request)?),
        "Send succeeded but the API returned no data.",
    )?;
    let sent_id = required_string_field(&sent, "id", "Send result")?;
    let reply_address = string_field(&sent, "from").unwrap_or_else(|| plan.from.clone());
    let strict_only = plan.wait.phases.len() == 1;
    let reply_match = if sent.get("idempotent_replay").and_then(Value::as_bool) == Some(true) {
        resolve_idempotent_replay_reply(&sent_id, plan.wait.page_size, &mut execute_request)?
            .ok_or_else(|| {
                anyhow!(
                    "Server returned idempotent_replay for sent email {sent_id}, but no prior accepted reply was found. The original send has not received a reply yet. Vary the body or reply to a different inbound email to create a fresh send."
                )
            })?
    } else {
        let wait_phases = build_chat_wait_requests(&ChatWaitInput {
            from: reply_address.clone(),
            recipient: plan.recipient.clone(),
            sent_at_iso: sent_at_iso.clone(),
            sent_id: sent_id.clone(),
            strict_only,
            page_size: plan.wait.page_size,
        });
        wait_for_chat_reply(
            ChatWaitRuntimeInput {
                phases: &wait_phases,
                sent_id: &sent_id,
                timeout_seconds: plan.wait.timeout_seconds,
                strict_phase_seconds: plan.wait.strict_phase_seconds,
                interval_seconds: plan.wait.interval_seconds,
            },
            &mut execute_request,
            &mut now_millis,
            &mut sleep_seconds,
        )?
        .ok_or_else(|| {
            anyhow!(
                "Timed out after {}s waiting for a reply from {}.",
                plan.wait.timeout_seconds,
                plan.recipient
            )
        })?
    };
    let response = resolve_chat_response_body(&reply_match.reply);
    let subject = plan
        .subject
        .clone()
        .or_else(|| string_field(&sent, "subject"))
        .unwrap_or_else(|| derive_subject(&plan.message));

    Ok(ChatCommandOutcome {
        sent,
        reply: reply_match.reply,
        local_chat_id: None,
        response_body: response.body,
        response_body_format: response.format,
        match_strategy: reply_match.match_strategy,
        recipient: plan.recipient.clone(),
        from: reply_address,
        subject,
        sent_at_iso,
        json: plan.output_shape == MailOutputShape::ChatJsonEnvelope,
        quiet: plan.quiet,
        strict_only,
        strict_phase_seconds: plan.wait.strict_phase_seconds,
        timeout_seconds: plan.wait.timeout_seconds,
    })
}

pub fn build_chat_json_envelope(outcome: &ChatCommandOutcome) -> Value {
    let reply_to_sent_email_id = outcome
        .reply
        .get("reply_to_sent_email_id")
        .cloned()
        .unwrap_or(Value::Null);
    json!({
        "sent": outcome.sent.clone(),
        "reply": outcome.reply.clone(),
        "local_chat_id": outcome.local_chat_id,
        "response_body": outcome.response_body.clone(),
        "response_body_format": outcome.response_body_format,
        "match": {
            "description": match_description(outcome.match_strategy),
            "reply_to_sent_email_id": reply_to_sent_email_id,
            "strategy": outcome.match_strategy,
        },
        "follow_up_commands": build_chat_follow_up_commands(outcome),
    })
}

pub fn format_chat_transcript(outcome: &ChatCommandOutcome) -> String {
    let accepted = accepted_recipients(&outcome.sent).unwrap_or_else(|| outcome.recipient.clone());
    let delivery_status = string_field(&outcome.sent, "delivery_status")
        .or_else(|| string_field(&outcome.sent, "status"))
        .unwrap_or_else(|| "unknown".to_string());
    let reply_subject =
        string_field(&outcome.reply, "subject").unwrap_or_else(|| "(no subject)".to_string());
    let response_body = if outcome.response_body.is_empty() {
        "(empty response)".to_string()
    } else {
        outcome.response_body.clone()
    };
    let mut lines = vec![
        "Reply received".to_string(),
        String::new(),
        "Sent".to_string(),
        format!("  To: {accepted}"),
        format!(
            "  From: {}",
            string_field(&outcome.sent, "from").unwrap_or_else(|| outcome.from.clone())
        ),
        format!("  Subject: {}", outcome.subject),
        format!(
            "  Sent email id: {}",
            string_field(&outcome.sent, "id").unwrap_or_else(|| "(unknown)".to_string())
        ),
        format!("  Delivery status: {delivery_status}"),
        String::new(),
        "Reply".to_string(),
        format!(
            "  Email id: {}",
            string_field(&outcome.reply, "id").unwrap_or_else(|| "(unknown)".to_string())
        ),
        format!(
            "  From: {}",
            string_field(&outcome.reply, "from_email").unwrap_or_else(|| "(unknown)".to_string())
        ),
        format!(
            "  To: {}",
            string_field(&outcome.reply, "to_email").unwrap_or_else(|| "(unknown)".to_string())
        ),
        format!("  Subject: {reply_subject}"),
        format!(
            "  Received: {}",
            string_field(&outcome.reply, "received_at").unwrap_or_else(|| "(unknown)".to_string())
        ),
        format!("  Match: {}", match_description(outcome.match_strategy)),
    ];
    if let Some(reply_to_sent_email_id) = string_field(&outcome.reply, "reply_to_sent_email_id") {
        lines.push(format!(
            "  Reply to sent email id: {reply_to_sent_email_id}"
        ));
    }
    if let Some(message_id) = string_field(&outcome.reply, "message_id") {
        lines.push(format!("  Message-Id: {message_id}"));
    }
    lines.extend([
        String::new(),
        "Helpful follow-up commands".to_string(),
        "  Replace <message> before running commands that include it.".to_string(),
    ]);
    for command in build_chat_follow_up_commands(outcome) {
        lines.push(format!("  {}:", command.description));
        lines.push(format!("    {}", command.command));
    }
    lines.extend([
        String::new(),
        format!(
            "Response body ({:?}; use --json for parsing)",
            outcome.response_body_format
        )
        .to_lowercase(),
        "----- BEGIN RESPONSE -----".to_string(),
        response_body,
        "----- END RESPONSE -----".to_string(),
    ]);
    lines.join("\n")
}

pub fn resolve_message_bodies_from_fs(
    input: &MessageBodySourceInput,
) -> Result<ResolvedMessageBodies> {
    resolve_message_bodies(
        input,
        |path| fs::read_to_string(path).with_context(|| format!("Could not read {path}")),
        |_| read_message_body_stdin(),
    )
}

fn read_message_body_stdin() -> Result<String> {
    if io::stdin().is_terminal() {
        return Err(anyhow!(
            "stdin is a TTY; pipe a value into this command or pass a file/string source instead."
        ));
    }
    let mut body = String::new();
    io::stdin()
        .read_to_string(&mut body)
        .context("Could not read from stdin")?;
    Ok(body)
}

pub fn resolve_message_bodies(
    input: &MessageBodySourceInput,
    mut read_file: impl FnMut(&str) -> Result<String>,
    mut read_stdin: impl FnMut(&str) -> Result<String>,
) -> Result<ResolvedMessageBodies> {
    let body_sources = selected_sources([
        ("--body", input.body.is_some()),
        ("--body-file", input.body_file.is_some()),
        ("--body-stdin", input.body_stdin),
    ]);
    if body_sources.len() > 1 {
        return Err(crate::usage_err!(
            "Pass only one plain-text body source (got {}).",
            body_sources.join(", ")
        ));
    }

    let html_sources = selected_sources([
        ("--html", input.html.is_some()),
        ("--html-file", input.html_file.is_some()),
        ("--html-stdin", input.html_stdin),
    ]);
    if html_sources.len() > 1 {
        return Err(crate::usage_err!(
            "Pass only one HTML body source (got {}).",
            html_sources.join(", ")
        ));
    }

    let stdin_sources = selected_sources([
        ("--body-stdin", input.body_stdin),
        ("--html-stdin", input.html_stdin),
    ]);
    if stdin_sources.len() > 1 {
        return Err(crate::usage_err!(
            "Stdin can only be consumed once (got {}).",
            stdin_sources.join(", ")
        ));
    }

    if body_sources.is_empty() && html_sources.is_empty() {
        return Err(crate::usage_err!(
            "Either a plain-text body source or an HTML body source is required."
        ));
    }

    let mut body = input.body.clone();
    let mut html = input.html.clone();
    if let Some(path) = &input.body_file {
        body = Some(read_file(path).with_context(|| format!("Could not read --body-file {path}"))?);
    }
    if input.body_stdin {
        body = Some(read_stdin("--body-stdin").context("Could not read --body-stdin")?);
    }
    if let Some(path) = &input.html_file {
        html = Some(read_file(path).with_context(|| format!("Could not read --html-file {path}"))?);
    }
    if input.html_stdin {
        html = Some(read_stdin("--html-stdin").context("Could not read --html-stdin")?);
    }

    if body.as_deref().is_none_or(str::is_empty) && html.as_deref().is_none_or(str::is_empty) {
        return Err(crate::usage_err!(
            "Either a non-empty plain-text body or a non-empty HTML body is required."
        ));
    }

    Ok(ResolvedMessageBodies { body, html })
}

pub fn read_attachment_files_from_fs(paths: &[String]) -> Result<Option<Vec<Attachment>>> {
    read_attachment_files(paths, |path| {
        fs::read(path).with_context(|| format!("Could not read {path}"))
    })
}

pub fn read_attachment_files(
    paths: &[String],
    mut read_file: impl FnMut(&str) -> Result<Vec<u8>>,
) -> Result<Option<Vec<Attachment>>> {
    if paths.is_empty() {
        return Ok(None);
    }

    let mut attachments = Vec::with_capacity(paths.len());
    for path in paths {
        let filename = attachment_filename(path)?;
        validate_attachment_filename(path, &filename)?;
        let bytes =
            read_file(path).with_context(|| format!("Could not read --attachment {path}"))?;
        if bytes.is_empty() {
            return Err(anyhow!(
                "Attachment file {path} is empty. Attachments must contain at least one byte."
            ));
        }
        attachments.push(Attachment {
            content_base64: base64_encode(&bytes),
            filename,
        });
    }

    Ok(Some(attachments))
}

pub fn derive_subject(body: &str) -> String {
    for line in body.split('\n') {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.chars().count() > SUBJECT_MAX_LENGTH {
            let prefix: String = trimmed.chars().take(SUBJECT_MAX_LENGTH - 3).collect();
            return format!("{prefix}...");
        }
        return trimmed.to_string();
    }
    "Message".to_string()
}

pub fn build_default_from_lookup_request() -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/domains".to_string(),
        query: BTreeMap::new(),
        body: None,
    }
}

pub fn pick_default_from_address(domains_response: &Value) -> Result<String> {
    let rows = domain_rows_from_response(domains_response);
    for row in rows {
        if row.get("is_active").and_then(Value::as_bool) != Some(true) {
            continue;
        }
        if let Some(domain) = row.get("domain").and_then(Value::as_str) {
            return Ok(format!("agent@{domain}"));
        }
    }

    Err(anyhow!(
        "No active verified outbound domain found on this account; pass --from explicitly. To set up outbound, claim a domain via `primitive domains add` and verify it."
    ))
}

pub fn lookup_default_from_address(
    mut execute_lookup_request: impl FnMut(&ApiRequest) -> Result<Value>,
) -> Result<String> {
    let request = build_default_from_lookup_request();
    let response = execute_lookup_request(&request).map_err(|error| {
        anyhow!(
            "Could not look up your verified domains to default --from. Pass --from explicitly. Underlying error: {error}"
        )
    })?;
    pick_default_from_address(&response)
}

pub fn build_send_shortcut_body(input: &SendShortcutInput) -> Result<Value> {
    ensure_has_body(&input.bodies)?;
    let from = input
        .from
        .as_ref()
        .or(input.default_from.as_ref())
        .ok_or_else(|| anyhow!("--from is required. Pass --from explicitly."))?;
    let subject = input.subject.clone().unwrap_or_else(|| {
        input
            .bodies
            .body
            .as_deref()
            .map(derive_subject)
            .unwrap_or_else(|| "Message".to_string())
    });
    let mut body = Map::new();
    insert_string(&mut body, "from", from);
    insert_string(&mut body, "to", &input.to);
    insert_non_empty_strings(&mut body, "cc", &input.cc);
    insert_non_empty_strings(&mut body, "bcc", &input.bcc);
    insert_string(&mut body, "subject", &subject);
    insert_optional_string(&mut body, "body_text", input.bodies.body.as_ref());
    insert_optional_string(&mut body, "body_html", input.bodies.html.as_ref());
    insert_attachments(&mut body, input.attachments.as_ref())?;
    insert_optional_string(&mut body, "in_reply_to", input.in_reply_to.as_ref());
    insert_optional_bool(&mut body, "wait", input.wait);
    insert_optional_u64(&mut body, "wait_timeout_ms", input.wait_timeout_ms);
    Ok(Value::Object(body))
}

pub fn build_send_shortcut_request(input: &SendShortcutInput) -> Result<ApiRequest> {
    Ok(ApiRequest {
        method: "POST".to_string(),
        path: "/send-mail".to_string(),
        query: BTreeMap::new(),
        body: Some(build_send_shortcut_body(input)?),
    })
}

pub fn build_reply_shortcut_body(input: &ReplyShortcutInput) -> Result<Value> {
    ensure_has_body(&input.bodies)?;
    let mut body = Map::new();
    insert_optional_string(&mut body, "body_text", input.bodies.body.as_ref());
    insert_optional_string(&mut body, "body_html", input.bodies.html.as_ref());
    insert_optional_string(&mut body, "from", input.from.as_ref());
    insert_attachments(&mut body, input.attachments.as_ref())?;
    insert_optional_bool(&mut body, "wait", input.wait);
    Ok(Value::Object(body))
}

pub fn build_reply_shortcut_request(input: &ReplyShortcutInput) -> Result<ApiRequest> {
    Ok(ApiRequest {
        method: "POST".to_string(),
        path: format!("/emails/{}/reply", urlencoding::encode(&input.id)),
        query: BTreeMap::new(),
        body: Some(build_reply_shortcut_body(input)?),
    })
}

pub fn build_chat_send_request(input: &ChatSendInput) -> Result<ApiRequest> {
    if input.message.trim().is_empty() {
        return Err(anyhow!(
            "{}",
            if input.reply_to_email_id.is_some() {
                "Reply body is empty."
            } else {
                "Message body is empty."
            }
        ));
    }

    let attachments = input.attachments.as_ref();
    if let Some(parent_id) = &input.reply_to_email_id {
        let mut body = Map::new();
        insert_string(&mut body, "body_text", &input.message);
        insert_string(&mut body, "from", &input.from);
        insert_attachments(&mut body, attachments)?;
        return Ok(ApiRequest {
            method: "POST".to_string(),
            path: format!("/emails/{}/reply", urlencoding::encode(parent_id)),
            query: BTreeMap::new(),
            body: Some(Value::Object(body)),
        });
    }

    let mut body = Map::new();
    insert_string(&mut body, "from", &input.from);
    insert_string(&mut body, "to", &input.recipient);
    let subject = input
        .subject
        .clone()
        .unwrap_or_else(|| derive_subject(&input.message));
    insert_string(&mut body, "subject", &subject);
    insert_string(&mut body, "body_text", &input.message);
    insert_optional_string(&mut body, "in_reply_to", input.in_reply_to.as_ref());
    insert_attachments(&mut body, attachments)?;
    Ok(ApiRequest {
        method: "POST".to_string(),
        path: "/send-mail".to_string(),
        query: BTreeMap::new(),
        body: Some(Value::Object(body)),
    })
}

pub fn build_chat_wait_requests(input: &ChatWaitInput) -> Vec<ChatWaitPhaseRequest> {
    let mut phases = vec![ChatWaitPhaseRequest {
        strategy: ChatMatchStrategy::Strict,
        request: search_emails_request(
            BTreeMap::from([("reply_to_sent_email_id".to_string(), input.sent_id.clone())]),
            input.page_size,
            Some(&input.sent_at_iso),
        ),
    }];
    if !input.strict_only {
        phases.push(ChatWaitPhaseRequest {
            strategy: ChatMatchStrategy::Fallback,
            request: search_emails_request(
                BTreeMap::from([
                    ("from".to_string(), input.recipient.clone()),
                    ("to".to_string(), input.from.clone()),
                ]),
                input.page_size,
                Some(&input.sent_at_iso),
            ),
        });
    }
    phases
}

pub fn build_chat_turn_plan(input: &ChatTurnInput) -> Result<ChatTurnPlan> {
    Ok(ChatTurnPlan {
        send: build_chat_send_request(&input.send)?,
        wait_phases: build_chat_wait_requests(&input.wait),
    })
}

pub fn build_email_search_query(
    filters: BTreeMap<String, String>,
    page_size: u64,
    since: Option<&str>,
    cursor: Option<&str>,
) -> BTreeMap<String, String> {
    let mut query = BTreeMap::from([
        ("include_facets".to_string(), "false".to_string()),
        ("limit".to_string(), page_size.to_string()),
        ("snippet".to_string(), "false".to_string()),
        ("sort".to_string(), "received_at_asc".to_string()),
    ]);
    query.extend(filters);
    if let Some(since) = since {
        query.insert("date_from".to_string(), since.to_string());
    }
    if let Some(cursor) = cursor {
        query.insert("cursor".to_string(), cursor.to_string());
    }
    query
}

fn build_send_request_from_args_with_default(
    args: &[String],
    default_from: Option<String>,
    mut execute_lookup_request: LookupRequestExecutor<'_>,
) -> Result<ApiRequest> {
    let parsed = parse_args(
        args,
        &[
            "api-key",
            "api-base-url",
            "to",
            "from",
            "subject",
            "body",
            "body-file",
            "html",
            "html-file",
            "in-reply-to",
            "wait-timeout-ms",
        ],
        &["body-stdin", "html-stdin", "wait", "time"],
        &["cc", "bcc", "attachment"],
    )?;
    reject_positionals(&parsed)?;
    let bodies = resolve_message_bodies_from_parsed(&parsed)?;
    let attachments = attachments_from_parsed(&parsed)?;
    let explicit_from = flag_one(&parsed, "from");
    let default_from = if explicit_from.is_none() && default_from.is_none() {
        match execute_lookup_request.as_mut() {
            Some(execute_lookup_request) => {
                Some(lookup_default_from_address(&mut **execute_lookup_request)?)
            }
            None => None,
        }
    } else {
        default_from
    };
    build_send_shortcut_request(&SendShortcutInput {
        from: explicit_from,
        default_from,
        to: required_flag(&parsed, "to")?,
        cc: flag_many(&parsed, "cc"),
        bcc: flag_many(&parsed, "bcc"),
        subject: flag_one(&parsed, "subject"),
        bodies,
        attachments,
        in_reply_to: flag_one(&parsed, "in-reply-to"),
        wait: parsed.bool_flags.get("wait").copied(),
        wait_timeout_ms: optional_u64_flag(&parsed, "wait-timeout-ms")?,
    })
}

fn build_reply_request_from_args(args: &[String]) -> Result<ApiRequest> {
    let args = expand_attachment_aliases(args);
    let parsed = parse_args(
        &args,
        &[
            "api-key",
            "api-base-url",
            "id",
            "from",
            "body",
            "body-file",
            "html",
            "html-file",
        ],
        &["body-stdin", "html-stdin", "wait", "time"],
        &["attachment"],
    )?;
    reject_positionals(&parsed)?;
    let bodies = resolve_message_bodies_from_parsed(&parsed)?;
    let attachments = attachments_from_parsed(&parsed)?;
    build_reply_shortcut_request(&ReplyShortcutInput {
        id: required_flag(&parsed, "id")?,
        from: flag_one(&parsed, "from"),
        bodies,
        attachments,
        wait: parsed.bool_flags.get("wait").copied(),
    })
}

fn parse_chat_args(args: &[String]) -> Result<ParsedArgs> {
    let args = expand_attachment_aliases(args);
    parse_args(
        &args,
        &[
            "api-key",
            "api-base-url",
            "from",
            "subject",
            "reply",
            "reply-to-email-id",
            "in-reply-to",
            "timeout",
            "strict-phase-seconds",
            "interval",
            "page-size",
            "chat-local-id",
        ],
        &["strict-only", "json", "quiet", "time"],
        &["attachment"],
    )
}

fn expand_attachment_aliases(args: &[String]) -> Vec<String> {
    args.iter()
        .map(|arg| {
            arg.strip_prefix("-a=")
                .map(|value| format!("--attachment={value}"))
                .unwrap_or_else(|| {
                    if arg == "-a" {
                        "--attachment".to_string()
                    } else {
                        arg.clone()
                    }
                })
        })
        .collect()
}

fn resolve_message_bodies_from_parsed(parsed: &ParsedArgs) -> Result<ResolvedMessageBodies> {
    resolve_message_bodies_from_fs(&MessageBodySourceInput {
        body: flag_one(parsed, "body"),
        body_file: flag_one(parsed, "body-file"),
        body_stdin: parsed.bool_flags.get("body-stdin") == Some(&true),
        html: flag_one(parsed, "html"),
        html_file: flag_one(parsed, "html-file"),
        html_stdin: parsed.bool_flags.get("html-stdin") == Some(&true),
    })
}

fn attachments_from_parsed(parsed: &ParsedArgs) -> Result<Option<Vec<Attachment>>> {
    read_attachment_files_from_fs(&flag_many(parsed, "attachment"))
}

fn runtime_flags(args: &[String]) -> Result<MailRuntimeFlags> {
    Ok(MailRuntimeFlags {
        auth: auth_flags(args)?,
        time: has_time_flag(args),
    })
}

fn build_chat_reply_forward_args(
    parsed: &ParsedArgs,
    state: &SavedChatState,
    message: &str,
) -> Result<Vec<String>> {
    let timeout_seconds = optional_u64_flag(parsed, "timeout")?.unwrap_or(state.timeout_seconds);
    let strict_phase_seconds =
        optional_u64_flag(parsed, "strict-phase-seconds")?.unwrap_or(state.strict_phase_seconds);
    let interval_seconds =
        optional_u64_flag(parsed, "interval")?.unwrap_or(DEFAULT_EMAIL_POLL_INTERVAL_SECONDS);
    let page_size = optional_u64_flag(parsed, "page-size")?.unwrap_or(DEFAULT_EMAIL_POLL_PAGE_SIZE);
    ensure_range("--strict-phase-seconds", strict_phase_seconds, 1, u64::MAX)?;
    ensure_range("--interval", interval_seconds, 1, u64::MAX)?;
    ensure_range("--page-size", page_size, 1, MAX_EMAIL_POLL_PAGE_SIZE)?;

    let mut args = vec![
        state.recipient.clone(),
        "--reply".to_string(),
        message.to_string(),
        "--from".to_string(),
        state.from.clone(),
        "--reply-to-email-id".to_string(),
        state.last_reply_email_id.clone(),
        "--timeout".to_string(),
        timeout_seconds.to_string(),
        "--strict-phase-seconds".to_string(),
        strict_phase_seconds.to_string(),
        "--interval".to_string(),
        interval_seconds.to_string(),
        "--page-size".to_string(),
        page_size.to_string(),
        "--chat-local-id".to_string(),
        state.local_id.to_string(),
    ];

    if let Some(api_key) = flag_one(parsed, "api-key") {
        args.extend(["--api-key".to_string(), api_key]);
    }
    if let Some(api_base_url) = flag_one(parsed, "api-base-url") {
        args.extend(["--api-base-url".to_string(), api_base_url]);
    }
    if parsed.bool_flags.get("json") == Some(&true) {
        args.push("--json".to_string());
    }
    if parsed.bool_flags.get("quiet") == Some(&true) {
        args.push("--quiet".to_string());
    }
    for attachment in flag_many(parsed, "attachment") {
        args.extend(["--attachment".to_string(), attachment]);
    }
    if state.strict_only || parsed.bool_flags.get("strict-only") == Some(&true) {
        args.push("--strict-only".to_string());
    }
    if parsed.bool_flags.get("time") == Some(&true) {
        args.push("--time".to_string());
    }
    Ok(args)
}

fn parse_local_chat_id(value: &str) -> Option<u64> {
    if value == "0" {
        return Some(0);
    }
    let mut chars = value.chars();
    let first = chars.next()?;
    if !matches!(first, '1'..='9') || !chars.all(|character| character.is_ascii_digit()) {
        return None;
    }
    value.parse().ok()
}

fn get_email_request(id: &str) -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: format!("/emails/{}", urlencoding::encode(id)),
        query: BTreeMap::new(),
        body: None,
    }
}

fn latest_inbound_from_recipient_request(
    recipient: &str,
    from: &str,
    page_size: u64,
) -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/emails/search".to_string(),
        query: BTreeMap::from([
            ("from".to_string(), recipient.to_string()),
            ("include_facets".to_string(), "false".to_string()),
            ("limit".to_string(), page_size.to_string()),
            ("snippet".to_string(), "false".to_string()),
            ("sort".to_string(), "received_at_desc".to_string()),
            ("to".to_string(), from.to_string()),
        ]),
        body: None,
    }
}

fn resolve_outbound_from(
    explicit_from: Option<String>,
    provided_default_from: Option<String>,
    allow_lookup: bool,
    execute_lookup_request: &mut LookupRequestExecutor<'_>,
) -> Result<String> {
    if let Some(from) = explicit_from {
        return Ok(from);
    }
    if let Some(from) = provided_default_from {
        return Ok(from);
    }
    if allow_lookup {
        if let Some(execute_lookup_request) = execute_lookup_request.as_mut() {
            return lookup_default_from_address(&mut **execute_lookup_request);
        }
    }
    Err(anyhow!("--from is required. Pass --from explicitly."))
}

fn search_emails_request(
    filters: BTreeMap<String, String>,
    page_size: u64,
    since: Option<&str>,
) -> ApiRequest {
    ApiRequest {
        method: "GET".to_string(),
        path: "/emails/search".to_string(),
        query: build_email_search_query(filters, page_size, since, None),
        body: None,
    }
}

fn domain_rows_from_response(response: &Value) -> &[Value] {
    if let Some(rows) = response.as_array() {
        return rows;
    }
    response
        .get("data")
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn idempotent_replay_reply_search_request(sent_id: &str, page_size: u64) -> ApiRequest {
    search_emails_request(
        BTreeMap::from([("reply_to_sent_email_id".to_string(), sent_id.to_string())]),
        page_size,
        None,
    )
}

fn parse_args(
    args: &[String],
    value_flags: &[&str],
    bool_flags: &[&str],
    repeatable_value_flags: &[&str],
) -> Result<ParsedArgs> {
    let value_flags: BTreeSet<&str> = value_flags.iter().copied().collect();
    let bool_flags: BTreeSet<&str> = bool_flags.iter().copied().collect();
    let repeatable_value_flags: BTreeSet<&str> = repeatable_value_flags.iter().copied().collect();
    let mut parsed = ParsedArgs::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with("--") {
            parsed.positionals.push(arg.clone());
            index += 1;
            continue;
        }

        if let Some(name) = arg.strip_prefix("--no-") {
            if !bool_flags.contains(name) {
                return Err(crate::usage_err!("Unknown boolean flag --no-{name}"));
            }
            parsed.bool_flags.insert(name.to_string(), false);
            index += 1;
            continue;
        }

        let raw = arg.trim_start_matches("--");
        let (name, inline_value) = raw
            .split_once('=')
            .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));
        if bool_flags.contains(name) {
            parsed.bool_flags.insert(
                name.to_string(),
                inline_value.as_deref().unwrap_or("true").parse()?,
            );
            index += 1;
            continue;
        }
        if !value_flags.contains(name) && !repeatable_value_flags.contains(name) {
            return Err(crate::usage_err!("Unknown flag --{name}"));
        }

        let value = if let Some(value) = inline_value {
            value
        } else {
            index += 1;
            args.get(index)
                .ok_or_else(|| crate::usage_err!("Missing value for --{name}"))?
                .clone()
        };
        if repeatable_value_flags.contains(name) {
            parsed
                .flags
                .entry(name.to_string())
                .or_default()
                .push(value);
        } else if parsed.flags.insert(name.to_string(), vec![value]).is_some() {
            return Err(anyhow!("Pass --{name} only once."));
        }
        index += 1;
    }
    Ok(parsed)
}

fn print_help() {
    println!("mail commands: send, reply, chat");
}

fn mail_command_help_text(kind: MailCommandKind) -> String {
    match kind {
        MailCommandKind::Send => send_help_text(),
        MailCommandKind::Reply => reply_help_text(),
        MailCommandKind::Chat => chat_help_text(),
        MailCommandKind::ChatReply => chat_reply_help_text(),
    }
}

pub fn send_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Send an email (simplified, agent-friendly)

USAGE
  {bin} send --to <value> [--api-key <value>] [--from <value>] [--subject <value>] [--body <value>] [--body-file <value>] [--body-stdin] [--html <value>] [--html-file <value>] [--html-stdin] [--attachment <value>...] [--cc <value>...] [--bcc <value>...] [--in-reply-to <value>] [--wait] [--wait-timeout-ms <value>] [--time]

FLAGS
  --api-key <value>
  --attachment <value>...
  --bcc <value>...
  --body <value>
  --body-file <value>
  --body-stdin
  --cc <value>...
  --from <value>
  --html <value>
  --html-file <value>
  --html-stdin
  --in-reply-to <value>
  --subject <value>
  --time
  --to <value>
  --wait
  --wait-timeout-ms <value>

EXAMPLES
  {bin} send --to alice@example.com --body 'Hi Alice!'
"#
    )
}

pub fn reply_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Reply to an inbound email

USAGE
  {bin} reply --id <value> [--api-key <value>] [--body <value>] [--body-file <value>] [--body-stdin] [--html <value>] [--html-file <value>] [--html-stdin] [--from <value>] [-a <value>...] [--wait] [--time]

FLAGS
  -a, --attachment <value>...
  --api-key <value>
  --body <value>
  --body-file <value>
  --body-stdin
  --from <value>
  --html <value>
  --html-file <value>
  --html-stdin
  --id <value>
  --time
  --wait

EXAMPLES
  {bin} reply --id <inbound-email-id> --body 'Thanks, got it.'
"#
    )
}

pub fn chat_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Chat with an agent over email (send and wait for the reply)

USAGE
  {bin} chat RECIPIENT [MESSAGE] [--api-key <value>] [--from <value>] [--reply <value>] [--reply-to-email-id <value>] [--in-reply-to <value>] [-a <value>...] [--json] [--quiet] [--timeout <value>] [--strict-phase-seconds <value>] [--strict-only] [--interval <value>] [--time]

FLAGS
  -a, --attachment <value>...
  --api-key <value>
  --from <value>
  --in-reply-to <value>
  --interval <value>
  --json
  --quiet
  --reply <value>
  --reply-to-email-id <value>
  --strict-only
  --strict-phase-seconds <value>
  --time
  --timeout <value>

COMMANDS
  chat reply

EXAMPLES
  {bin} chat help@agent.acme.dev 'how do I rotate my API key?'
"#
    )
}

pub fn chat_reply_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Reply in the active chat

USAGE
  {bin} chat reply [IDORMESSAGE] [MESSAGE] [--api-key <value>] [--id <value>] [--json] [--quiet] [--timeout <value>] [--strict-phase-seconds <value>] [--strict-only] [-a <value>...] [--interval <value>] [--time]

FLAGS
  -a, --attachment <value>...
  --api-key <value>
  --id <value>
  --interval <value>
  --json
  --quiet
  --strict-only
  --strict-phase-seconds <value>
  --time
  --timeout <value>

EXAMPLES
  {bin} chat reply 'one more thing'
"#
    )
}

fn execute_single_request_plan(plan: &MailSingleRequestPlan) -> Result<()> {
    let start = Instant::now();
    let auth = config::resolve_auth(&plan.runtime.auth)?;
    let envelope = execute_mail_request(&plan.request, &auth)?;
    let data = envelope.get("data").cloned().unwrap_or(Value::Null);
    write_idempotent_replay_banner(&data);
    println!("{}", serde_json::to_string_pretty(&data)?);
    if plan.runtime.time {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

fn execute_chat_command_plan(plan: &ChatCommandPlan) -> Result<()> {
    let start = Instant::now();
    let auth = config::resolve_auth(&plan.runtime.auth)?;
    let monotonic_start = Instant::now();
    let mut outcome = execute_chat_command_plan_with_runtime(
        plan,
        |request| execute_mail_request(request, &auth),
        current_timestamp_iso,
        || monotonic_start.elapsed().as_millis(),
        |seconds| {
            std::thread::sleep(Duration::from_secs(seconds));
            Ok(())
        },
    )?;
    persist_chat_command_outcome(&auth.config_dir, plan, &mut outcome);
    write_idempotent_replay_banner(&outcome.sent);
    print_chat_outcome(&outcome, plan.output_shape)?;
    if plan.runtime.time {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
    Ok(())
}

fn execute_chat_reply_command_plan(args: &[String], plan: &ChatReplyCommandPlan) -> Result<()> {
    let config_dir = config::config_dir();
    let state = match plan.state_lookup {
        ChatReplyStateLookup::Active => {
            load_active_chat_state(&config_dir)?.ok_or_else(|| {
                anyhow!("No open chat. Start one with `primitive chat <email> '<message>'`.")
            })?
        }
        ChatReplyStateLookup::LocalId { id } => load_chat_conversation_by_local_id(&config_dir, id)?
            .ok_or_else(|| {
                anyhow!(
                    "No local chat {id}. Start one with `primitive chat <email> '<message>'` or omit --id to use the active chat."
                )
            })?,
    };
    let effective_args = if plan.needs_stdin {
        let mut effective_args = args.to_vec();
        effective_args.push(read_chat_reply_stdin()?);
        effective_args
    } else {
        args.to_vec()
    };
    let turn_plan = build_chat_reply_turn_plan_from_args(&effective_args, &state, "", "")?;
    execute_chat_command_plan(&turn_plan)
}

fn read_chat_reply_stdin() -> Result<String> {
    if io::stdin().is_terminal() {
        return Err(anyhow!(
            "No reply body provided. Pass the reply body as a positional argument or pipe it via stdin."
        ));
    }
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .context("Could not read reply body from stdin")?;
    if input.trim().is_empty() {
        return Err(anyhow!("Reply body is empty."));
    }
    Ok(input)
}

fn read_chat_message_stdin() -> Result<String> {
    if io::stdin().is_terminal() {
        return Err(anyhow!(
            "No message provided. Pass the message as the second positional argument or pipe it via stdin."
        ));
    }
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .context("Could not read message from stdin")?;
    Ok(input)
}

fn persist_chat_command_outcome(
    config_dir: &Path,
    plan: &ChatCommandPlan,
    outcome: &mut ChatCommandOutcome,
) {
    let input = match saved_chat_state_input_from_outcome(plan, outcome) {
        Ok(input) => input,
        Err(error) => {
            eprintln!("Warning: could not save local chat state: {error}");
            return;
        }
    };
    match save_active_chat_state_at(
        config_dir,
        input,
        plan.local_chat_id,
        &current_timestamp_iso(),
    ) {
        Ok(saved) => outcome.local_chat_id = Some(saved.local_id),
        Err(error) => eprintln!("Warning: could not save local chat state: {error}"),
    }
}

fn saved_chat_state_input_from_outcome(
    plan: &ChatCommandPlan,
    outcome: &ChatCommandOutcome,
) -> Result<SavedChatStateInput> {
    Ok(SavedChatStateInput {
        recipient: outcome.recipient.clone(),
        from: outcome.from.clone(),
        last_reply_email_id: required_string_field(&outcome.reply, "id", "Reply")?,
        last_reply_received_at: required_string_field(&outcome.reply, "received_at", "Reply")?,
        last_sent_email_id: required_string_field(&outcome.sent, "id", "Send result")?,
        thread_id: string_field(&outcome.reply, "thread_id"),
        timeout_seconds: plan.wait.timeout_seconds,
        strict_phase_seconds: plan.wait.strict_phase_seconds,
        strict_only: should_prefer_strict_continuation(plan, outcome.match_strategy),
    })
}

fn should_prefer_strict_continuation(
    plan: &ChatCommandPlan,
    match_strategy: ChatMatchStrategy,
) -> bool {
    plan.wait.phases.len() == 1
        || (match_strategy == ChatMatchStrategy::Strict
            && plan.wait.strict_phase_seconds == DEFAULT_STRICT_PHASE_SECONDS)
}

fn execute_mail_request(request: &ApiRequest, auth: &config::ResolvedAuth) -> Result<Value> {
    let http = client::http_client()?;
    let mut url = format!(
        "{}{}",
        auth.api_base_url.trim_end_matches('/'),
        request.path
    );
    if !request.query.is_empty() {
        let query = request
            .query
            .iter()
            .map(|(key, value)| {
                format!(
                    "{}={}",
                    urlencoding::encode(key),
                    urlencoding::encode(value)
                )
            })
            .collect::<Vec<_>>()
            .join("&");
        url.push('?');
        url.push_str(&query);
    }
    let method: Method = request.method.parse()?;
    let mut builder = http.request(method, url);
    builder = client::apply_headers(builder, auth, true, &[], request.body.is_some())?;
    if let Some(body) = &request.body {
        builder = builder.json(body);
    }
    let response = builder.send()?;
    let (status, bytes, json) = client::parse_response(response)?;
    if status >= 400 {
        return Err(client::error_for_status(status, json.as_ref(), &bytes));
    }
    json.ok_or_else(|| anyhow!("HTTP {status} returned no JSON body"))
}

fn print_chat_outcome(outcome: &ChatCommandOutcome, output_shape: MailOutputShape) -> Result<()> {
    match output_shape {
        MailOutputShape::ChatJsonEnvelope | MailOutputShape::JsonResult => {
            println!(
                "{}",
                serde_json::to_string_pretty(&build_chat_json_envelope(outcome))?
            );
        }
        MailOutputShape::ChatTranscript => {
            println!("{}", format_chat_transcript(outcome));
        }
    }
    Ok(())
}

fn current_timestamp_iso() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

impl ChatConversationState {
    fn is_valid(&self) -> bool {
        non_empty(&self.recipient)
            && non_empty(&self.from)
            && non_empty(&self.last_reply_email_id)
            && non_empty(&self.last_sent_email_id)
            && non_empty(&self.last_reply_received_at)
            && non_empty(&self.updated_at)
            && self.strict_phase_seconds > 0
            && self.thread_id.as_deref().is_none_or(non_empty)
    }

    fn to_saved_state(&self) -> SavedChatState {
        SavedChatState {
            local_id: self.local_id,
            recipient: self.recipient.clone(),
            from: self.from.clone(),
            last_reply_email_id: self.last_reply_email_id.clone(),
            timeout_seconds: self.timeout_seconds,
            strict_phase_seconds: self.strict_phase_seconds,
            strict_only: self.strict_only,
        }
    }
}

impl LegacyChatConversationState {
    fn into_conversation(self) -> ChatConversationState {
        ChatConversationState {
            from: self.from,
            last_reply_email_id: self.last_reply_email_id,
            last_reply_received_at: self.last_reply_received_at,
            last_sent_email_id: self.last_sent_email_id,
            local_id: 0,
            recipient: self.recipient,
            strict_only: self.strict_only,
            strict_phase_seconds: self.strict_phase_seconds,
            thread_id: self.thread_id,
            timeout_seconds: self.timeout_seconds,
            updated_at: self.updated_at,
        }
    }
}

fn non_empty(value: &str) -> bool {
    !value.trim().is_empty()
}

fn load_chat_state_file(config_dir: &Path) -> Result<Option<ChatStateFile>> {
    let path = chat_state_path(config_dir);
    let contents = match fs::read_to_string(&path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(error).with_context(|| format!("Could not read {}", path.display()))
        }
    };
    let value = match serde_json::from_str::<Value>(&contents) {
        Ok(value) => value,
        Err(_) => return Ok(None),
    };
    Ok(parse_chat_state_value(value))
}

fn parse_chat_state_value(value: Value) -> Option<ChatStateFile> {
    match value.get("version").and_then(Value::as_u64) {
        Some(1) => parse_legacy_chat_state_value(value),
        Some(CHAT_STATE_VERSION) => {
            let mut state = serde_json::from_value::<ChatStateFile>(value).ok()?;
            validate_chat_state_file(&mut state).then_some(state)
        }
        _ => None,
    }
}

fn parse_legacy_chat_state_value(value: Value) -> Option<ChatStateFile> {
    let conversation = serde_json::from_value::<LegacyChatConversationState>(value)
        .ok()?
        .into_conversation();
    if !conversation.is_valid() {
        return None;
    }
    Some(ChatStateFile {
        active_local_id: Some(0),
        conversations: vec![conversation],
        next_local_id: 1,
        version: CHAT_STATE_VERSION,
    })
}

fn validate_chat_state_file(state: &mut ChatStateFile) -> bool {
    if state.version != CHAT_STATE_VERSION {
        return false;
    }
    let mut ids = BTreeSet::new();
    for conversation in &state.conversations {
        if !conversation.is_valid() || !ids.insert(conversation.local_id) {
            return false;
        }
    }
    if state
        .active_local_id
        .is_some_and(|active_local_id| !ids.contains(&active_local_id))
    {
        return false;
    }
    let next_from_conversations = state
        .conversations
        .iter()
        .map(|conversation| conversation.local_id.saturating_add(1))
        .max()
        .unwrap_or(0);
    state.next_local_id = state.next_local_id.max(next_from_conversations);
    true
}

fn save_chat_state_file(config_dir: &Path, state: &ChatStateFile) -> Result<()> {
    let path = chat_state_path(config_dir);
    let contents = format!("{}\n", serde_json::to_string_pretty(state)?);
    config::write_private_file_atomic(&path, contents)
}

fn resolve_chat_send_request<RequestFn>(
    plan: &ChatCommandPlan,
    execute_request: &mut RequestFn,
) -> Result<ApiRequest>
where
    RequestFn: FnMut(&ApiRequest) -> Result<Value>,
{
    match &plan.reply_context {
        ChatReplyContextPlan::None => plan
            .send
            .clone()
            .ok_or_else(|| anyhow!("Chat plan is missing its send request.")),
        ChatReplyContextPlan::Exact { id, request } => {
            let parent = response_object(
                response_data(execute_request(request)?),
                &format!("Could not load inbound email {id}: the API returned no email body."),
            )?;
            assert_parent_matches_recipient(&parent, &plan.recipient)?;
            plan.send
                .clone()
                .ok_or_else(|| anyhow!("Chat plan is missing its send request."))
        }
        ChatReplyContextPlan::LatestInboundFromRecipient { request } => {
            let rows = response_array(
                response_data(execute_request(request)?),
                "Could not find a prior chat reply.",
            )?;
            let parent_id = first_accepted_email_id(&rows).ok_or_else(|| {
                anyhow!(
                    "No prior inbound email from {} to {}. Start a new chat with `primitive chat {} <message>`, pass --from, or pass --reply-to-email-id <inbound-email-id>.",
                    plan.recipient,
                    plan.from,
                    plan.recipient
                )
            })?;
            build_chat_send_request(&ChatSendInput {
                recipient: plan.recipient.clone(),
                message: plan.message.clone(),
                from: plan.from.clone(),
                subject: None,
                in_reply_to: None,
                attachments: plan.attachments.clone(),
                reply_to_email_id: Some(parent_id),
            })
        }
    }
}

fn assert_parent_matches_recipient(parent: &Value, recipient: &str) -> Result<()> {
    let parent_from = string_field(parent, "from_email")
        .or_else(|| string_field(parent, "from_header"))
        .or_else(|| string_field(parent, "sender"))
        .ok_or_else(|| anyhow!("Reply context email returned no from_email."))?;
    if normalize_email_address(&parent_from) == normalize_email_address(recipient) {
        return Ok(());
    }
    let parent_id = string_field(parent, "id").unwrap_or_else(|| "(unknown)".to_string());
    Err(anyhow!(
        "Inbound email {parent_id} is from {parent_from}, not {recipient}. Use `primitive chat {parent_from} --reply <message> --reply-to-email-id {parent_id}` or omit --reply-to-email-id to continue the latest inbound from {recipient}."
    ))
}

fn normalize_email_address(value: &str) -> String {
    let trimmed = value.trim();
    if let Some(start) = trimmed.find('<') {
        if let Some(end) = trimmed[start + 1..].find('>') {
            return trimmed[start + 1..start + 1 + end].trim().to_lowercase();
        }
    }
    trimmed.to_lowercase()
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ChatReplyMatch {
    reply: Value,
    match_strategy: ChatMatchStrategy,
}

struct ChatWaitRuntimeInput<'a> {
    phases: &'a [ChatWaitPhaseRequest],
    sent_id: &'a str,
    timeout_seconds: u64,
    strict_phase_seconds: u64,
    interval_seconds: u64,
}

fn resolve_idempotent_replay_reply<RequestFn>(
    sent_id: &str,
    page_size: u64,
    execute_request: &mut RequestFn,
) -> Result<Option<ChatReplyMatch>>
where
    RequestFn: FnMut(&ApiRequest) -> Result<Value>,
{
    let search_request = idempotent_replay_reply_search_request(sent_id, page_size);
    let rows = response_array(
        response_data(execute_request(&search_request)?),
        "Failed to search for replayed chat reply.",
    )?;
    let Some(reply_id) = latest_accepted_email_id(&rows) else {
        return Ok(None);
    };
    let detail_request = get_email_request(&reply_id);
    let detail = response_object(
        response_data(execute_request(&detail_request)?),
        &format!("Idempotent replay: existing reply body could not be loaded (id={reply_id})."),
    )?;
    Ok(Some(ChatReplyMatch {
        reply: detail,
        match_strategy: ChatMatchStrategy::Strict,
    }))
}

fn wait_for_chat_reply<RequestFn, NowMillisFn, SleepFn>(
    input: ChatWaitRuntimeInput<'_>,
    execute_request: &mut RequestFn,
    now_millis: &mut NowMillisFn,
    sleep_seconds: &mut SleepFn,
) -> Result<Option<ChatReplyMatch>>
where
    RequestFn: FnMut(&ApiRequest) -> Result<Value>,
    NowMillisFn: FnMut() -> u128,
    SleepFn: FnMut(u64) -> Result<()>,
{
    let wait_started = now_millis();
    let total_deadline = deadline_after(wait_started, input.timeout_seconds);
    let strict_deadline = if input.phases.len() == 1 {
        total_deadline
    } else {
        let strict_deadline =
            wait_started.saturating_add(u128::from(input.strict_phase_seconds) * 1000);
        Some(total_deadline.map_or(strict_deadline, |deadline| strict_deadline.min(deadline)))
    };
    let mut strict_filter_unsupported = false;

    for phase in input.phases {
        if phase.strategy == ChatMatchStrategy::Strict && strict_filter_unsupported {
            continue;
        }
        let phase_deadline = if phase.strategy == ChatMatchStrategy::Strict {
            strict_deadline
        } else {
            total_deadline
        };
        let mut seen_ids = BTreeSet::new();
        let mut cursor: Option<String> = None;

        loop {
            if reached_deadline(now_millis(), phase_deadline) {
                break;
            }
            if reached_deadline(now_millis(), total_deadline) {
                return Ok(None);
            }

            let request = request_with_cursor(&phase.request, cursor.as_deref());
            let rows = response_array(
                response_data(execute_request(&request)?),
                "Failed to poll for reply.",
            )?;
            let next_cursor = cursor_from_last_accepted_row(&rows);
            let matches = collect_new_accepted_email_rows(&rows, &mut seen_ids);

            for row in matches {
                let id = email_id(row)
                    .ok_or_else(|| anyhow!("Reply search returned an email without an id."))?;
                let detail_request = get_email_request(&id);
                let detail = response_object(
                    response_data(execute_request(&detail_request)?),
                    "Reply landed but the email body could not be loaded.",
                )?;
                if phase.strategy == ChatMatchStrategy::Strict
                    && string_field(&detail, "reply_to_sent_email_id").as_deref()
                        != Some(input.sent_id)
                {
                    strict_filter_unsupported = true;
                    continue;
                }
                return Ok(Some(ChatReplyMatch {
                    reply: detail,
                    match_strategy: phase.strategy,
                }));
            }

            if strict_filter_unsupported && phase.strategy == ChatMatchStrategy::Strict {
                break;
            }
            if let Some(next_cursor) = next_cursor {
                if cursor.as_deref() != Some(next_cursor.as_str()) {
                    cursor = Some(next_cursor);
                    continue;
                }
            }
            if reached_deadline(now_millis(), phase_deadline) {
                break;
            }
            if reached_deadline(now_millis(), total_deadline) {
                return Ok(None);
            }
            sleep_seconds(input.interval_seconds)?;
        }
    }

    Ok(None)
}

fn deadline_after(start_millis: u128, seconds: u64) -> Option<u128> {
    (seconds != 0).then(|| start_millis.saturating_add(u128::from(seconds) * 1000))
}

fn reached_deadline(now_millis: u128, deadline: Option<u128>) -> bool {
    deadline.is_some_and(|deadline| now_millis >= deadline)
}

fn response_data(response: Value) -> Value {
    match response {
        Value::Object(mut object) => object.remove("data").unwrap_or(Value::Object(object)),
        other => other,
    }
}

fn response_object(data: Value, missing_message: &str) -> Result<Value> {
    if data.is_object() {
        Ok(data)
    } else {
        Err(anyhow!("{missing_message}"))
    }
}

fn response_array(data: Value, missing_message: &str) -> Result<Vec<Value>> {
    match data {
        Value::Array(rows) => Ok(rows),
        _ => Err(anyhow!("{missing_message}")),
    }
}

fn request_with_cursor(request: &ApiRequest, cursor: Option<&str>) -> ApiRequest {
    let mut request = request.clone();
    if let Some(cursor) = cursor {
        request
            .query
            .insert("cursor".to_string(), cursor.to_string());
    } else {
        request.query.remove("cursor");
    }
    request
}

fn first_accepted_email_id(rows: &[Value]) -> Option<String> {
    rows.iter()
        .find(|row| is_accepted_email_row(row))
        .and_then(email_id)
}

fn latest_accepted_email_id(rows: &[Value]) -> Option<String> {
    let mut latest: Option<(String, String)> = None;
    for row in rows {
        if !is_accepted_email_row(row) {
            continue;
        }
        let Some(id) = email_id(row) else {
            continue;
        };
        let Some(received_at) = string_field(row, "received_at") else {
            continue;
        };
        let should_replace = match latest.as_ref() {
            Some((_, latest_received_at)) => received_at.as_str() > latest_received_at.as_str(),
            None => true,
        };
        if should_replace {
            latest = Some((id, received_at));
        }
    }
    latest.map(|(id, _)| id)
}

fn collect_new_accepted_email_rows<'a>(
    rows: &'a [Value],
    seen_ids: &mut BTreeSet<String>,
) -> Vec<&'a Value> {
    rows.iter()
        .filter(|row| is_accepted_email_row(row))
        .filter(|row| email_id(row).map(|id| seen_ids.insert(id)).unwrap_or(false))
        .collect()
}

fn cursor_from_last_accepted_row(rows: &[Value]) -> Option<String> {
    rows.iter()
        .rev()
        .find(|row| is_accepted_email_row(row))
        .and_then(encode_received_at_search_cursor)
}

fn encode_received_at_search_cursor(row: &Value) -> Option<String> {
    let id = email_id(row)?;
    let received_at = row.get("received_at").and_then(Value::as_str)?;
    let parsed = chrono::DateTime::parse_from_rfc3339(received_at).ok()?;
    let iso = parsed
        .with_timezone(&Utc)
        .to_rfc3339_opts(SecondsFormat::Millis, true);
    Some(base64_url_encode(format!("r|{iso}|{id}").as_bytes()))
}

fn base64_url_encode(bytes: &[u8]) -> String {
    base64_encode(bytes)
        .trim_end_matches('=')
        .replace('+', "-")
        .replace('/', "_")
}

fn is_accepted_email_row(row: &Value) -> bool {
    matches!(
        row.get("status").and_then(Value::as_str),
        Some("accepted" | "completed")
    )
}

fn email_id(row: &Value) -> Option<String> {
    string_field(row, "id")
}

fn required_string_field(value: &Value, field: &str, context: &str) -> Result<String> {
    string_field(value, field).ok_or_else(|| anyhow!("{context} returned no {field}."))
}

fn string_field(value: &Value, field: &str) -> Option<String> {
    value.get(field).and_then(Value::as_str).map(str::to_string)
}

fn accepted_recipients(sent: &Value) -> Option<String> {
    let recipients = sent
        .get("accepted")?
        .as_array()?
        .iter()
        .filter_map(Value::as_str)
        .collect::<Vec<_>>();
    (!recipients.is_empty()).then(|| recipients.join(", "))
}

fn match_description(strategy: ChatMatchStrategy) -> &'static str {
    match strategy {
        ChatMatchStrategy::Strict => "strict, matched by reply_to_sent_email_id",
        ChatMatchStrategy::Fallback => "fallback, matched by sender/time window",
    }
}

fn build_chat_follow_up_commands(outcome: &ChatCommandOutcome) -> Vec<ChatFollowUpCommand> {
    let mut commands = Vec::new();
    let has_custom_strict_phase = outcome.strict_phase_seconds != DEFAULT_STRICT_PHASE_SECONDS;
    let prefer_strict_continuation = outcome.strict_only
        || (outcome.match_strategy == ChatMatchStrategy::Strict && !has_custom_strict_phase);
    if let Some(local_chat_id) = outcome.local_chat_id {
        let local_chat_id = local_chat_id.to_string();
        let mut local_continue =
            string_args(&["primitive", "chat", "reply", &local_chat_id, "<message>"]);
        add_chat_output_flags(&mut local_continue, outcome);
        commands.push(chat_follow_up_command(
            "continue_chat",
            "Continue this chat",
            local_continue,
            true,
        ));

        let mut active_continue = string_args(&["primitive", "chat", "reply", "<message>"]);
        add_chat_output_flags(&mut active_continue, outcome);
        commands.push(chat_follow_up_command(
            "continue_active_chat",
            "Continue the active chat",
            active_continue,
            true,
        ));
    }
    if let Some(reply_id) = string_field(&outcome.reply, "id") {
        let mut continue_explicit = vec![
            "primitive".to_string(),
            "chat".to_string(),
            outcome.recipient.clone(),
            "--reply".to_string(),
            "<message>".to_string(),
            "--from".to_string(),
            outcome.from.clone(),
            "--reply-to-email-id".to_string(),
            reply_id.clone(),
            "--timeout".to_string(),
            outcome.timeout_seconds.to_string(),
        ];
        add_chat_output_flags(&mut continue_explicit, outcome);
        if prefer_strict_continuation {
            continue_explicit.push("--strict-only".to_string());
        } else if has_custom_strict_phase {
            continue_explicit.push("--strict-phase-seconds".to_string());
            continue_explicit.push(outcome.strict_phase_seconds.to_string());
        }
        commands.push(chat_follow_up_command(
            if outcome.local_chat_id.is_some() {
                "continue_chat_explicit"
            } else {
                "continue_chat"
            },
            if outcome.local_chat_id.is_some() {
                "Continue this chat explicitly"
            } else {
                "Continue this chat"
            },
            continue_explicit,
            true,
        ));
        commands.push(chat_follow_up_command(
            "reply_direct",
            "Reply directly to the inbound email",
            string_args(&[
                "primitive",
                "reply",
                "--id",
                &reply_id,
                "--from",
                &outcome.from,
                "--body",
                "<message>",
            ]),
            true,
        ));
        commands.push(chat_follow_up_command(
            "inspect_reply",
            "Inspect the full inbound email",
            string_args(&["primitive", "emails", "get", "--id", &reply_id]),
            false,
        ));
    }
    if let Some(sent_id) = string_field(&outcome.sent, "id") {
        let since = string_field(&outcome.reply, "received_at")
            .unwrap_or_else(|| outcome.sent_at_iso.clone());
        commands.push(chat_follow_up_command(
            "wait_for_more",
            "Wait for future replies to this send",
            vec![
                "primitive".to_string(),
                "emails".to_string(),
                "wait".to_string(),
                "--reply-to-sent-email-id".to_string(),
                sent_id,
                "--to".to_string(),
                outcome.from.clone(),
                "--since".to_string(),
                since,
                "--timeout".to_string(),
                outcome.timeout_seconds.to_string(),
            ],
            false,
        ));
    }
    commands
}

fn chat_follow_up_command(
    kind: &str,
    description: &str,
    argv: Vec<String>,
    requires_message: bool,
) -> ChatFollowUpCommand {
    let placeholders = if requires_message {
        vec![ChatPlaceholder {
            description: "Replace with the message body before running.".to_string(),
            token: "<message>".to_string(),
        }]
    } else {
        Vec::new()
    };
    ChatFollowUpCommand {
        command: command_from_argv(&argv),
        argv,
        kind: kind.to_string(),
        description: description.to_string(),
        placeholders,
        requires_message,
    }
}

fn string_args(parts: &[&str]) -> Vec<String> {
    parts.iter().map(|part| (*part).to_string()).collect()
}

fn add_chat_output_flags(argv: &mut Vec<String>, outcome: &ChatCommandOutcome) {
    if outcome.json {
        argv.push("--json".to_string());
    }
    if outcome.quiet {
        argv.push("--quiet".to_string());
    }
}

fn command_from_argv(argv: &[String]) -> String {
    argv.iter()
        .map(|part| shell_quote(part.as_str()))
        .collect::<Vec<_>>()
        .join(" ")
}

fn shell_quote(value: &str) -> String {
    if !value.is_empty() && value.chars().all(is_shell_safe_character) {
        return value.to_string();
    }
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn is_shell_safe_character(character: char) -> bool {
    character.is_ascii_alphanumeric()
        || matches!(
            character,
            '_' | '.' | '/' | ':' | '@' | '%' | '+' | '=' | ',' | '-'
        )
}

fn write_idempotent_replay_banner(data: &Value) {
    if data.get("idempotent_replay").and_then(Value::as_bool) != Some(true) {
        return;
    }
    eprintln!("note: idempotent replay. this exact send already happened earlier.");
    eprintln!(
        "      no new MX traffic was generated by this call. nothing new will arrive in any inbox."
    );
    if let Some(id) = data.get("id").and_then(Value::as_str) {
        eprintln!("      cached row id: {id}");
    }
}

fn reject_positionals(parsed: &ParsedArgs) -> Result<()> {
    if let Some(value) = parsed.positionals.first() {
        return Err(crate::usage_err!("Unexpected argument: {value}"));
    }
    Ok(())
}

fn flag_one(parsed: &ParsedArgs, name: &str) -> Option<String> {
    parsed
        .flags
        .get(name)
        .and_then(|values| values.first())
        .cloned()
}

fn flag_many(parsed: &ParsedArgs, name: &str) -> Vec<String> {
    parsed.flags.get(name).cloned().unwrap_or_default()
}

fn required_flag(parsed: &ParsedArgs, name: &str) -> Result<String> {
    flag_one(parsed, name).ok_or_else(|| anyhow!("Missing required --{name}"))
}

fn optional_u64_flag(parsed: &ParsedArgs, name: &str) -> Result<Option<u64>> {
    flag_one(parsed, name)
        .map(|value| {
            value
                .parse()
                .with_context(|| format!("Expected an integer for --{name}"))
        })
        .transpose()
}

fn ensure_range(name: &str, value: u64, min: u64, max: u64) -> Result<()> {
    if value < min || value > max {
        return Err(anyhow!("{name} must be between {min} and {max}."));
    }
    Ok(())
}

fn selected_sources<const N: usize>(sources: [(&'static str, bool); N]) -> Vec<&'static str> {
    sources
        .into_iter()
        .filter_map(|(label, selected)| selected.then_some(label))
        .collect()
}

fn attachment_filename(path: &str) -> Result<String> {
    Path::new(path)
        .file_name()
        .and_then(|filename| filename.to_str())
        .map(str::to_string)
        .filter(|filename| !filename.is_empty())
        .ok_or_else(|| {
            anyhow!("Could not derive an attachment filename from {path}. Pass a file path.")
        })
}

fn validate_attachment_filename(path: &str, filename: &str) -> Result<()> {
    if filename.chars().any(is_control_character) {
        return Err(anyhow!(
            "Attachment filename {filename} contains control characters."
        ));
    }
    if filename.is_empty() {
        return Err(anyhow!(
            "Could not derive an attachment filename from {path}. Pass a file path."
        ));
    }
    Ok(())
}

fn is_control_character(character: char) -> bool {
    let code = character as u32;
    code <= 0x1f || (0x7f..=0x9f).contains(&code)
}

fn ensure_has_body(bodies: &ResolvedMessageBodies) -> Result<()> {
    if bodies
        .body
        .as_deref()
        .is_some_and(|value| !value.is_empty())
        || bodies
            .html
            .as_deref()
            .is_some_and(|value| !value.is_empty())
    {
        return Ok(());
    }
    Err(crate::usage_err!(
        "Either a non-empty plain-text body or a non-empty HTML body is required."
    ))
}

fn insert_string(body: &mut Map<String, Value>, key: &str, value: &str) {
    body.insert(key.to_string(), Value::String(value.to_string()));
}

fn insert_optional_string(body: &mut Map<String, Value>, key: &str, value: Option<&String>) {
    if let Some(value) = value {
        insert_string(body, key, value);
    }
}

fn insert_non_empty_strings(body: &mut Map<String, Value>, key: &str, values: &[String]) {
    if !values.is_empty() {
        body.insert(key.to_string(), json!(values));
    }
}

fn insert_optional_bool(body: &mut Map<String, Value>, key: &str, value: Option<bool>) {
    if let Some(value) = value {
        body.insert(key.to_string(), Value::Bool(value));
    }
}

fn insert_optional_u64(body: &mut Map<String, Value>, key: &str, value: Option<u64>) {
    if let Some(value) = value {
        body.insert(key.to_string(), json!(value));
    }
}

fn insert_attachments(
    body: &mut Map<String, Value>,
    attachments: Option<&Vec<Attachment>>,
) -> Result<()> {
    if let Some(attachments) = attachments {
        body.insert(
            "attachments".to_string(),
            serde_json::to_value(attachments)?,
        );
    }
    Ok(())
}

fn base64_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(bytes.len().div_ceil(3) * 4);
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0];
        let b1 = *chunk.get(1).unwrap_or(&0);
        let b2 = *chunk.get(2).unwrap_or(&0);
        out.push(ALPHABET[(b0 >> 2) as usize] as char);
        out.push(ALPHABET[(((b0 & 0b0000_0011) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[(((b1 & 0b0000_1111) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(b2 & 0b0011_1111) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

impl Default for ChatWaitInput {
    fn default() -> Self {
        Self {
            from: String::new(),
            recipient: String::new(),
            sent_at_iso: String::new(),
            sent_id: String::new(),
            strict_only: false,
            page_size: DEFAULT_EMAIL_POLL_PAGE_SIZE,
        }
    }
}

impl Default for ChatTurnInput {
    fn default() -> Self {
        Self {
            send: ChatSendInput {
                recipient: String::new(),
                message: String::new(),
                from: String::new(),
                subject: None,
                in_reply_to: None,
                attachments: None,
                reply_to_email_id: None,
            },
            wait: ChatWaitInput::default(),
        }
    }
}

pub fn default_chat_timeout_seconds() -> u64 {
    DEFAULT_CHAT_TIMEOUT_SECONDS
}

pub fn default_strict_phase_seconds() -> u64 {
    DEFAULT_STRICT_PHASE_SECONDS
}
