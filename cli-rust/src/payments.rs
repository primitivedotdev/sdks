use crate::api;
use crate::client;
use crate::config::{self, ResolvedAuth};
use crate::x402::{
    address_from_private_key, build_exact_evm_payment_payload, build_payment_step_envelope,
    compute_payment_validity_window, derive_eip3009_nonce, parse_private_key,
    sign_payout_registration_message, sign_transfer_with_authorization,
    transfer_with_authorization_typed_data, validate_checksum_address, NonceBinding,
    PaymentValidityWindowParams, PayoutRegistrationMessageInput, PrivateKey, TokenDomain,
    TransferAuthorization, X402PaymentPayload,
};
use anyhow::{anyhow, bail, Context, Result};
use base64::Engine;
use chrono::{DateTime, SecondsFormat, Utc};
use flate2::read::GzDecoder;
use rand::RngCore;
use reqwest::Method;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::fs;
use std::io::{self, Read};
use std::thread;
use std::time::{Duration, Instant};

const PRIVATE_KEY_ENV: &str = "PRIMITIVE_X402_PRIVATE_KEY";
const INTERACTION_PART_FILENAME: &str = "interaction.json";
const INTERACTION_PART_CONTENT_TYPE: &str = "application/json";
const DEFAULT_PAY_EMAIL_SUBJECT: &str = "x402 payment authorization";
const DEFAULT_PAY_EMAIL_BODY_TEXT: &str = "x402 payment authorization attached (interaction.json).";
const SETTLEMENT_WAIT_NOTICE: &str = "Note: the payment has been SENT, but x402 settlement is asynchronous. --wait only confirms email delivery (SMTP 250), not on-chain settlement. The settle_tx hash arrives in a follow-up x402 settlement interaction email from the payee. Use --wait-settle to poll for it.";
const SETTLEMENT_WAITING_NOTICE: &str =
    "Payment sent. Waiting for the x402 settlement interaction email (settlement is async)...";
const SETTLEMENT_TIMEOUT_NOTICE: &str = "Timed out waiting for the x402 settlement interaction email. The payment was sent; the settle_tx will arrive in a follow-up x402 settlement interaction email from the payee. Re-run with --wait-settle, or check your inbox for an x402 settlement message.";
const PAY_EMAIL_STORED_LOGIN_OVER_ENV_KEY_NOTICE: &str = "PRIMITIVE_API_KEY is set, but pay-email reads the inbound challenge from your logged-in account's inbox, so it is using your saved login for this command. Pass --api-key explicitly to override.";
const PAY_EMAIL_WRONG_ORG_NOT_FOUND_HINT: &str = "The inbound challenge email was not found for the org this API key belongs to. pay-email reads the challenge from the PAYER account's inbox: unset PRIMITIVE_API_KEY (or pass --api-key for the payer's org, or run `primitive signin` as the payer) and retry.";
const DEFAULT_SETTLE_TIMEOUT_SECONDS: u64 = 180;
const DEFAULT_SETTLE_INTERVAL_SECONDS: u64 = 5;
const SETTLEMENT_SEARCH_PAGE_SIZE: u64 = 50;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct X402Challenge {
    pub id: String,
    pub network: String,
    pub amount: String,
    pub pay_to: String,
    pub nonce_binding: X402NonceBinding,
    pub payment_requirements: X402PaymentRequirements,
    pub expires_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct X402EmailChallenge {
    pub interaction_id: String,
    pub challenge_id: Option<String>,
    pub challenge: X402EmailChallengeDetails,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct X402EmailChallengeDetails {
    pub payment_requirements: X402PaymentRequirements,
    pub nonce_binding: X402NonceBinding,
    pub expires_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct X402NonceBinding {
    pub interaction_id: String,
    pub challenge_step_id: String,
    pub challenge_nonce: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct X402PaymentRequirements {
    pub scheme: String,
    pub network: String,
    #[serde(rename = "maxAmountRequired")]
    pub max_amount_required: String,
    #[serde(rename = "payTo")]
    pub pay_to: String,
    pub asset: String,
    pub extra: X402PaymentRequirementsExtra,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct X402PaymentRequirementsExtra {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChargeRequest {
    pub body: Value,
    pub headers: Vec<(String, String)>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct BuiltPaymentStep {
    pub envelope: Value,
    pub json: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettlementReceipt {
    pub email_id: String,
    pub envelope: Value,
    pub settle_tx: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PayEmailCompletionDecision {
    pub print_wait_notice: bool,
    pub print_settlement_receipt: bool,
    pub print_timeout_message: bool,
    pub exit_nonzero: bool,
}

pub fn is_friendly_command(command: &str) -> bool {
    matches!(
        command,
        "payments"
            | "payments:charge"
            | "payments:pay"
            | "payments:pay-challenge"
            | "payments:register-payout"
            | "payments:register-payout-address"
            | "payments:challenge-from-email"
            | "payments:pay-email"
            | "payments:pay-email-step"
    )
}

pub fn dispatch(args: &[String]) -> Result<()> {
    if args.is_empty() || matches!(args[0].as_str(), "--help" | "-h") {
        print_help();
        return Ok(());
    }

    match args[0].as_str() {
        "charge"
        | "pay"
        | "pay-challenge"
        | "register-payout"
        | "register-payout-address"
        | "challenge-from-email"
        | "pay-email"
        | "pay-email-step"
            if is_help_request(&args[1..]) =>
        {
            if let Some(help) = payments_leaf_help_text(&args[0]) {
                print!("{help}");
            } else {
                print_help();
            }
            Ok(())
        }
        "charge" => execute_charge(&args[1..]),
        "pay" | "pay-challenge" => execute_pay(&args[1..]),
        "register-payout" | "register-payout-address" => {
            execute_register_payout_address(&args[1..])
        }
        "challenge-from-email" => execute_challenge_from_email(&args[1..]),
        "pay-email" => execute_pay_email(&args[1..]),
        "pay-email-step" => execute_pay_email_step(&args[1..]),
        other => Err(crate::usage_error(format!(
            "Command payments:{other} not found"
        ))),
    }
}

pub fn challenge_from_json_str(raw: &str) -> Result<X402Challenge> {
    let value = parse_json_source(raw, "challenge")?;
    let value = unwrap_data_envelope(value);
    let challenge: X402Challenge =
        serde_json::from_value(value).context("challenge is missing or malformed")?;
    validate_challenge(&challenge)?;
    Ok(challenge)
}

pub fn email_challenge_from_json_str(raw: &str) -> Result<X402EmailChallenge> {
    let value = parse_json_source(raw, "challenge")?;
    let value = unwrap_data_envelope(value);
    let challenge: X402EmailChallenge =
        serde_json::from_value(value).context("email challenge is missing or malformed")?;
    validate_email_challenge(&challenge)?;
    Ok(challenge)
}

pub fn build_charge_request(args: &[String]) -> Result<ChargeRequest> {
    let invocation = parse_payments_invocation("charge", args)?;
    build_charge_request_from_invocation(&invocation)
}

fn build_charge_request_from_invocation(invocation: &api::Invocation) -> Result<ChargeRequest> {
    let has_amount = invocation.flags.contains_key("amount");
    let has_amount_usdc = invocation.flags.contains_key("amount-usdc");
    if has_amount && has_amount_usdc {
        let amount = invocation.flags.get("amount").map_or("", String::as_str);
        let amount_usdc = invocation
            .flags
            .get("amount-usdc")
            .map_or("", String::as_str);
        return Err(crate::usage_error(format!(
            "The following errors occurred:\n  --amount-usdc={amount_usdc} cannot also be provided when using --amount\n  --amount={amount} cannot also be provided when using --amount-usdc\nSee more help with --help"
        )));
    }

    let amount = if let Some(value) = invocation.flags.get("amount-usdc") {
        let base_units = crate::x402::usdc_to_base_units(value).map_err(|_| {
            anyhow!(
                "Invalid --amount-usdc \"{value}\". Use a positive amount with at most 6 decimals, e.g. 0.01."
            )
        })?;
        if !is_positive_integer_token_amount(&base_units) {
            bail!(
                "Invalid --amount-usdc \"{value}\". Use a positive amount with at most 6 decimals, e.g. 0.01."
            );
        }
        base_units
    } else if let Some(value) = invocation.flags.get("amount") {
        if !is_positive_integer_token_amount(value) {
            bail!(
                "charge() requires `amount` as a positive integer string in token base units (e.g. \"10000\"), or `amountUsdc` as a positive USDC amount with at most 6 decimals (e.g. \"0.01\")"
            );
        }
        value.clone()
    } else {
        bail!("Provide --amount-usdc <usdc> (e.g. 0.01) or --amount <base-units> (e.g. 10000).");
    };

    let network = invocation
        .flags
        .get("network")
        .cloned()
        .unwrap_or_else(|| "base-sepolia".to_string());
    let _ = chain_id(&network)?;

    let mut body = serde_json::Map::new();
    body.insert("amount".to_string(), Value::String(amount));
    body.insert("network".to_string(), Value::String(network));
    if let Some(value) = invocation.flags.get("payer-org") {
        body.insert("payer_org".to_string(), Value::String(value.clone()));
    }
    if let Some(value) = invocation.flags.get("description") {
        body.insert("description".to_string(), Value::String(value.clone()));
    }
    if let Some(value) = invocation.flags.get("resource") {
        body.insert("resource".to_string(), Value::String(value.clone()));
    }
    if let Some(value) = invocation.flags.get("expires-in") {
        let seconds: u64 = value
            .parse()
            .with_context(|| "Expected an integer for --expires-in")?;
        body.insert(
            "expires_in".to_string(),
            Value::Number(serde_json::Number::from(seconds)),
        );
    }

    let mut headers = Vec::new();
    if let Some(value) = invocation.flags.get("idempotency-key") {
        headers.push(("idempotency-key".to_string(), value.clone()));
    }

    Ok(ChargeRequest {
        body: Value::Object(body),
        headers,
    })
}

fn parse_payments_invocation(command: &str, args: &[String]) -> Result<api::Invocation> {
    let (value_flags, bool_flags) = payments_command_flags(command)
        .ok_or_else(|| crate::usage_error(format!("Command {command} not found")))?;
    let value_flags: BTreeSet<&str> = value_flags.iter().copied().collect();
    let bool_flags: BTreeSet<&str> = bool_flags.iter().copied().collect();
    let mut invocation = api::Invocation::default();
    let mut index = 0;

    while index < args.len() {
        let arg = &args[index];
        if !arg.starts_with("--") {
            return Err(crate::usage_error(format!("Unexpected argument: {arg}")));
        }

        if let Some(name) = arg.strip_prefix("--no-") {
            if !bool_flags.contains(name) {
                return Err(crate::usage_error(format!(
                    "Unknown boolean flag --no-{name}"
                )));
            }
            invocation.bool_flags.insert(name.to_string(), false);
            index += 1;
            continue;
        }

        let raw = arg.trim_start_matches("--");
        let (name, inline_value) = raw
            .split_once('=')
            .map_or((raw, None), |(name, value)| (name, Some(value.to_string())));

        if bool_flags.contains(name) {
            let value = inline_value.as_deref().unwrap_or("true").parse()?;
            invocation.bool_flags.insert(name.to_string(), value);
            index += 1;
            continue;
        }

        if !value_flags.contains(name) {
            return Err(crate::usage_error(format!("Unknown flag --{name}")));
        }

        let value = if let Some(value) = inline_value {
            value
        } else {
            index += 1;
            let value = args
                .get(index)
                .ok_or_else(|| crate::usage_error(format!("Flag --{name} expects a value")))?;
            if value.starts_with("--") {
                return Err(crate::usage_error(format!("Flag --{name} expects a value")));
            }
            value.clone()
        };

        if invocation.flags.insert(name.to_string(), value).is_some() {
            return Err(anyhow!("Pass --{name} only once."));
        }
        index += 1;
    }

    Ok(invocation)
}

fn payments_command_flags(
    command: &str,
) -> Option<(&'static [&'static str], &'static [&'static str])> {
    match command {
        "charge" => Some((
            &[
                "api-key",
                "api-base-url",
                "amount-usdc",
                "amount",
                "network",
                "payer-org",
                "description",
                "resource",
                "expires-in",
                "idempotency-key",
            ],
            &["time"],
        )),
        "pay" | "pay-challenge" => Some((
            &[
                "api-key",
                "api-base-url",
                "private-key",
                "challenge",
                "challenge-file",
            ],
            &["json", "time"],
        )),
        "register-payout" | "register-payout-address" => Some((
            &[
                "api-key",
                "api-base-url",
                "private-key",
                "network",
                "label",
                "issued-at",
            ],
            &["json", "time"],
        )),
        "challenge-from-email" => Some((&["api-key", "api-base-url", "id"], &["time"])),
        "pay-email" => Some((
            &[
                "api-key",
                "api-base-url",
                "private-key",
                "challenge",
                "challenge-file",
                "in-reply-to",
                "from",
                "body",
                "settle-timeout",
                "settle-interval",
            ],
            &["wait", "wait-settle", "json", "time"],
        )),
        "pay-email-step" => Some((
            &[
                "api-key",
                "api-base-url",
                "private-key",
                "challenge",
                "challenge-file",
            ],
            &["json", "time"],
        )),
        _ => None,
    }
}

pub fn build_signed_payment_for_challenge_at(
    challenge: &X402Challenge,
    key: &PrivateKey,
    now_sec: i64,
) -> Result<X402PaymentPayload> {
    validate_challenge(challenge)?;
    let chain_id = chain_id(&challenge.network)?;
    if challenge.payment_requirements.network != challenge.network {
        bail!(
            "challenge network mismatch: {} vs payment_requirements {}",
            challenge.network,
            challenge.payment_requirements.network
        );
    }
    sign_payment_details(
        &challenge.network,
        chain_id,
        &challenge.payment_requirements,
        &challenge.nonce_binding,
        &challenge.expires_at,
        key,
        now_sec,
    )
}

pub fn build_signed_payment_step_at(
    challenge: &X402EmailChallenge,
    key: &PrivateKey,
    step_id: &str,
    now_sec: i64,
) -> Result<BuiltPaymentStep> {
    validate_email_challenge(challenge)?;
    let details = &challenge.challenge;
    let network = &details.payment_requirements.network;
    let chain_id = chain_id(network)?;
    let payment = sign_payment_details(
        network,
        chain_id,
        &details.payment_requirements,
        &details.nonce_binding,
        &details.expires_at,
        key,
        now_sec,
    )?;
    let envelope = build_payment_step_envelope(
        &challenge.interaction_id,
        step_id,
        &details.nonce_binding.challenge_step_id,
        payment,
        None,
    )?;
    let envelope_value = serde_json::to_value(envelope)?;
    let json = serde_json::to_string(&envelope_value)?;
    Ok(BuiltPaymentStep {
        envelope: envelope_value,
        json,
    })
}

pub fn parse_email_challenge_from_part_bytes(bytes: &[u8]) -> Result<X402EmailChallenge> {
    let envelope: Value =
        serde_json::from_slice(bytes).context("interaction.json part is not valid JSON")?;
    let object = envelope
        .as_object()
        .ok_or_else(|| invalid_interaction_part("envelope (expected a JSON object)"))?;
    if object.get("interaction_version").and_then(Value::as_u64) != Some(1) {
        return Err(invalid_interaction_part("interaction_version (expected 1)"));
    }
    let interaction_id = object
        .get("interaction_id")
        .and_then(Value::as_str)
        .filter(|value| is_wire_interaction_id(value))
        .ok_or_else(|| invalid_interaction_part("interaction_id (expected uuid@domain)"))?;
    if object.get("protocol").and_then(Value::as_str) != Some("x402.payment") {
        return Err(invalid_interaction_part(
            "protocol (expected \"x402.payment\")",
        ));
    }
    if object.get("protocol_version").and_then(Value::as_u64) != Some(1) {
        return Err(invalid_interaction_part("protocol_version (expected 1)"));
    }
    if object.get("step").and_then(Value::as_str) != Some("challenge") {
        return Err(invalid_interaction_part("step (expected \"challenge\")"));
    }
    let step_id = object
        .get("step_id")
        .and_then(Value::as_str)
        .filter(|value| is_uuid(value))
        .ok_or_else(|| invalid_interaction_part("step_id (expected a uuid)"))?;
    let expires_at = object
        .get("expires_at")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            invalid_interaction_part(
                "expires_at (expected an ISO-8601 timestamp on the challenge step)",
            )
        })?;
    let payload = object
        .get("payload")
        .and_then(Value::as_object)
        .ok_or_else(|| invalid_interaction_part("payload (expected an object)"))?;
    let challenge_nonce = payload
        .get("challenge_nonce")
        .and_then(Value::as_str)
        .filter(|value| is_lower_hex(value, 64))
        .ok_or_else(|| {
            invalid_interaction_part("payload.challenge_nonce (expected 64 lowercase hex chars)")
        })?;
    let payment_requirements = payload
        .get("payment_requirements")
        .cloned()
        .filter(|value| value.is_object())
        .ok_or_else(|| {
            invalid_interaction_part("payload.payment_requirements (expected an object)")
        })?;
    let payment_requirements: X402PaymentRequirements =
        serde_json::from_value(payment_requirements).map_err(|_| {
            invalid_interaction_part("payload.payment_requirements (expected an object)")
        })?;
    let challenge = X402EmailChallenge {
        interaction_id: interaction_id.to_string(),
        challenge_id: Some(String::new()),
        challenge: X402EmailChallengeDetails {
            payment_requirements,
            nonce_binding: X402NonceBinding {
                interaction_id: interaction_id.to_string(),
                challenge_step_id: step_id.to_string(),
                challenge_nonce: challenge_nonce.to_string(),
            },
            expires_at: expires_at.to_string(),
        },
    };
    validate_email_challenge(&challenge)?;
    Ok(challenge)
}

pub fn interaction_tar_path_from_meta(attachments: Option<&Value>) -> Option<String> {
    let array = attachments?.as_array()?;
    let chosen = array
        .iter()
        .find(|item| {
            item.get("filename").and_then(Value::as_str) == Some(INTERACTION_PART_FILENAME)
        })
        .or_else(|| {
            array.iter().find(|item| {
                item.get("content_type").and_then(Value::as_str)
                    == Some(INTERACTION_PART_CONTENT_TYPE)
            })
        })?;
    if let Some(path) = chosen.get("tar_path").and_then(Value::as_str) {
        return Some(path.to_string());
    }
    match (
        chosen.get("part_index").and_then(Value::as_u64),
        chosen.get("filename").and_then(Value::as_str),
    ) {
        (Some(index), Some(filename)) => Some(format!("{index}_{filename}")),
        (_, Some(filename)) => Some(filename.to_string()),
        _ => None,
    }
}

pub fn interaction_json_from_archive(
    gzipped: &[u8],
    tar_path: Option<&str>,
) -> Result<Option<Vec<u8>>> {
    let mut decoder = GzDecoder::new(gzipped);
    let mut tar = Vec::new();
    decoder
        .read_to_end(&mut tar)
        .context("Could not decompress attachments archive")?;
    let entries = read_tar_entries(&tar)?;
    let wanted_base = tar_path
        .and_then(|path| path.rsplit('/').next())
        .filter(|path| !path.is_empty());
    if let Some(wanted) = wanted_base {
        if let Some(entry) = entries.iter().find(|entry| entry.base_name() == wanted) {
            return Ok(Some(entry.bytes.clone()));
        }
    }
    if wanted_base.is_none() {
        if let Some(entry) = entries
            .iter()
            .find(|entry| strip_part_index_prefix(entry.base_name()) == INTERACTION_PART_FILENAME)
        {
            return Ok(Some(entry.bytes.clone()));
        }
    }
    if wanted_base.is_some() {
        if let Some(entry) = entries
            .iter()
            .find(|entry| strip_part_index_prefix(entry.base_name()) == INTERACTION_PART_FILENAME)
        {
            return Ok(Some(entry.bytes.clone()));
        }
    }
    Ok(None)
}

pub fn extract_settle_tx(envelope: &Value) -> Option<&str> {
    envelope
        .get("settle_tx")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .or_else(|| {
            envelope
                .get("payload")
                .and_then(Value::as_object)
                .and_then(|payload| payload.get("settle_tx"))
                .and_then(Value::as_str)
                .filter(|value| !value.is_empty())
        })
}

pub fn parse_interaction_envelope(bytes: &[u8]) -> Option<Value> {
    let envelope: Value = serde_json::from_slice(bytes).ok()?;
    envelope.is_object().then_some(envelope)
}

pub fn is_settlement_receipt_for(envelope: &Value, interaction_id: &str) -> bool {
    if envelope.get("interaction_id").and_then(Value::as_str) != Some(interaction_id) {
        return false;
    }
    !matches!(
        envelope.get("step").and_then(Value::as_str),
        Some("challenge" | "payment")
    )
}

pub fn build_settlement_search_query(
    payee_from: &str,
    since: &str,
    cursor: Option<&str>,
) -> BTreeMap<String, String> {
    let mut query = BTreeMap::from([
        ("from".to_string(), payee_from.to_string()),
        ("has_attachment".to_string(), "true".to_string()),
        ("include_facets".to_string(), "false".to_string()),
        ("limit".to_string(), SETTLEMENT_SEARCH_PAGE_SIZE.to_string()),
        ("snippet".to_string(), "false".to_string()),
        ("sort".to_string(), "received_at_asc".to_string()),
        ("date_from".to_string(), since.to_string()),
    ]);
    if let Some(cursor) = cursor {
        query.insert("cursor".to_string(), cursor.to_string());
    }
    query
}

pub fn decide_pay_email_completion(
    json_output: bool,
    wait_settle: bool,
    replayed: bool,
    settlement_found: bool,
) -> PayEmailCompletionDecision {
    PayEmailCompletionDecision {
        print_wait_notice: !json_output && !wait_settle,
        print_settlement_receipt: !json_output && wait_settle && settlement_found,
        print_timeout_message: wait_settle && !replayed && !settlement_found,
        exit_nonzero: replayed || (wait_settle && !settlement_found),
    }
}

pub fn build_register_payout_address_body(
    org: &str,
    network: &str,
    label: Option<&str>,
    issued_at: &str,
    key: &PrivateKey,
) -> Result<Value> {
    let _ = chain_id(network)?;
    let address = address_from_private_key(key)?;
    let message = PayoutRegistrationMessageInput {
        org: org.to_string(),
        address: address.clone(),
        network: network.to_string(),
        issued_at: issued_at.to_string(),
    };
    let signature = sign_payout_registration_message(key, &message)?;
    let mut body = serde_json::Map::new();
    body.insert("address".to_string(), Value::String(address));
    body.insert("network".to_string(), Value::String(network.to_string()));
    body.insert("signature".to_string(), Value::String(signature));
    body.insert(
        "issued_at".to_string(),
        Value::String(issued_at.to_string()),
    );
    if let Some(label) = label {
        body.insert("label".to_string(), Value::String(label.to_string()));
    }
    Ok(Value::Object(body))
}

fn execute_charge(args: &[String]) -> Result<()> {
    let invocation = parse_payments_invocation("charge", args)?;
    let request = build_charge_request_from_invocation(&invocation)?;
    let auth = config::resolve_auth(&invocation.flags)?;
    require_api_key(&auth)?;
    let start = std::time::Instant::now();
    let challenge = request_json(
        Method::POST,
        &auth,
        "/x402/challenges",
        Some(&request.body),
        request.headers,
    )?;
    if let (Some(id), Some(amount), Some(network)) = (
        challenge.get("id").and_then(Value::as_str),
        challenge.get("amount").and_then(Value::as_str),
        challenge.get("network").and_then(Value::as_str),
    ) {
        eprintln!(
            "Challenge {id} for {} USDC on {network}. Hand the JSON below to the payer; they settle it with `primitive payments pay`.",
            format_usdc(amount)
        );
    }
    println!("{}", serde_json::to_string_pretty(&challenge)?);
    print_time(&invocation, start);
    Ok(())
}

fn execute_pay(args: &[String]) -> Result<()> {
    let invocation = parse_payments_invocation("pay", args)?;
    let auth = config::resolve_auth(&invocation.flags)?;
    require_api_key(&auth)?;
    let key = private_key_from_invocation(&invocation)?;
    let challenge = read_challenge_from_invocation(&invocation)?;
    let start = std::time::Instant::now();
    let payment = build_signed_payment_for_challenge_at(&challenge, &key, Utc::now().timestamp())?;
    let body = json!({ "payment": payment });
    let receipt = request_json(
        Method::POST,
        &auth,
        &format!(
            "/x402/challenges/{}/pay",
            urlencoding::encode(&challenge.id)
        ),
        Some(&body),
        Vec::new(),
    )?;

    if invocation.bool_flags.get("json") == Some(&true) {
        println!("{}", serde_json::to_string_pretty(&receipt)?);
    } else if receipt.get("status").and_then(Value::as_str) == Some("settled") {
        if let Some(tx) = receipt.get("settle_tx").and_then(Value::as_str) {
            println!("Payment settled. Transaction: {tx}");
            if let Some(url) = explorer_tx_url(&challenge.network, tx) {
                println!("{url}");
            }
        } else {
            println!("Payment settled.");
        }
    } else if let Some(status) = receipt.get("status").and_then(Value::as_str) {
        println!("Payment {status}.");
    } else {
        println!("{}", serde_json::to_string_pretty(&receipt)?);
    }
    print_time(&invocation, start);
    Ok(())
}

fn execute_register_payout_address(args: &[String]) -> Result<()> {
    let invocation = parse_payments_invocation("register-payout-address", args)?;
    let auth = config::resolve_auth(&invocation.flags)?;
    require_api_key(&auth)?;
    let key = private_key_from_invocation(&invocation)?;
    let network = invocation
        .flags
        .get("network")
        .cloned()
        .unwrap_or_else(|| "base-sepolia".to_string());
    let issued_at = invocation
        .flags
        .get("issued-at")
        .cloned()
        .unwrap_or_else(current_iso_millis);
    let start = std::time::Instant::now();
    let account = request_json(Method::GET, &auth, "/account", None, Vec::new())?;
    let org = account_org_id(&account)?;
    let body = build_register_payout_address_body(
        org,
        &network,
        invocation.flags.get("label").map(String::as_str),
        &issued_at,
        &key,
    )?;
    let result = request_json(
        Method::POST,
        &auth,
        "/x402/payout-addresses",
        Some(&body),
        Vec::new(),
    )?;
    if invocation.bool_flags.get("json") == Some(&true) {
        println!("{}", serde_json::to_string_pretty(&result)?);
    } else {
        let address = result
            .get("address")
            .and_then(Value::as_str)
            .unwrap_or("<unknown>");
        let network = result
            .get("network")
            .and_then(Value::as_str)
            .unwrap_or(&network);
        println!(
            "Registered {address} as the default payout address for {network}. You can now run `primitive payments charge`."
        );
    }
    print_time(&invocation, start);
    Ok(())
}

fn execute_challenge_from_email(args: &[String]) -> Result<()> {
    let invocation = parse_payments_invocation("challenge-from-email", args)?;
    let email_id = invocation
        .flags
        .get("id")
        .ok_or_else(|| anyhow!("payments challenge-from-email requires --id <inbound-email-id>"))?;
    let auth = config::resolve_auth(&invocation.flags)?;
    require_api_key(&auth)?;
    let start = std::time::Instant::now();
    let challenge = derive_email_challenge_from_inbound(&auth, email_id, None)?;
    println!("{}", serde_json::to_string_pretty(&challenge)?);
    print_time(&invocation, start);
    Ok(())
}

fn execute_pay_email(args: &[String]) -> Result<()> {
    let invocation = parse_payments_invocation("pay-email", args)?;
    let json_output = invocation.bool_flags.get("json") == Some(&true);
    let wait_settle = invocation.bool_flags.get("wait-settle") == Some(&true);
    let settle_timeout_seconds = parse_u64_flag(
        &invocation,
        "settle-timeout",
        DEFAULT_SETTLE_TIMEOUT_SECONDS,
        0,
    )?;
    let settle_interval_seconds = parse_u64_flag(
        &invocation,
        "settle-interval",
        DEFAULT_SETTLE_INTERVAL_SECONDS,
        1,
    )?;
    let in_reply_to = invocation
        .flags
        .get("in-reply-to")
        .cloned()
        .ok_or_else(|| anyhow!("payments pay-email requires --in-reply-to <inbound-email-id>"))?;
    let (auth, used_stored_login_over_env_key) =
        config::resolve_auth_preferring_stored_login_over_env_api_key(&invocation.flags)?;
    if used_stored_login_over_env_key {
        eprintln!("{PAY_EMAIL_STORED_LOGIN_OVER_ENV_KEY_NOTICE}");
    }
    require_api_key(&auth)?;
    let api_key_authenticated_read =
        pay_email_uses_flag_or_env_api_key(&invocation, used_stored_login_over_env_key);
    let key = private_key_from_invocation(&invocation)?;
    let start = std::time::Instant::now();
    let inbound = request_json_with_pay_email_not_found_hint(
        Method::GET,
        &auth,
        &format!("/emails/{}", urlencoding::encode(&in_reply_to)),
        None,
        Vec::new(),
        api_key_authenticated_read,
    )?;
    let inbound = email_detail_from_response(&inbound);
    let challenge = if invocation.flags.contains_key("challenge")
        || invocation.flags.contains_key("challenge-file")
    {
        read_email_challenge_from_invocation(&invocation)?
    } else {
        derive_email_challenge_from_inbound(
            &auth,
            &in_reply_to,
            inbound
                .get("parsed")
                .and_then(|parsed| parsed.get("attachments")),
        )?
    };
    let step_id = random_uuid_v4();
    let built = build_signed_payment_step_at(&challenge, &key, &step_id, Utc::now().timestamp())?;
    let interaction_id = built
        .envelope
        .get("interaction_id")
        .and_then(Value::as_str)
        .unwrap_or(&challenge.interaction_id)
        .to_string();
    let payee_to = first_string_field(inbound, &["from_email", "from"])
        .ok_or_else(|| anyhow!("Inbound challenge email {in_reply_to} has no resolvable sender to address the payment to."))?;
    let derived_from = first_string_field(inbound, &["to_email", "recipient", "to"]);
    let from = invocation
        .flags
        .get("from")
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .or(derived_from)
        .ok_or_else(|| anyhow!("Could not derive the payer From from inbound challenge email {in_reply_to}; pass --from explicitly."))?;
    let body_text = invocation
        .flags
        .get("body")
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(DEFAULT_PAY_EMAIL_BODY_TEXT);
    let mut body = serde_json::Map::new();
    body.insert("from".to_string(), Value::String(from.to_string()));
    body.insert("to".to_string(), Value::String(payee_to.to_string()));
    body.insert(
        "subject".to_string(),
        Value::String(DEFAULT_PAY_EMAIL_SUBJECT.to_string()),
    );
    body.insert(
        "body_text".to_string(),
        Value::String(body_text.to_string()),
    );
    body.insert(
        "attachments".to_string(),
        json!([{
            "filename": INTERACTION_PART_FILENAME,
            "content_type": INTERACTION_PART_CONTENT_TYPE,
            "content_base64": base64::engine::general_purpose::STANDARD.encode(built.json.as_bytes())
        }]),
    );
    if invocation.bool_flags.get("wait") == Some(&true) {
        body.insert("wait".to_string(), Value::Bool(true));
    }
    let send_started_at = current_iso_millis();
    let sent = request_json(
        Method::POST,
        &auth,
        "/send-mail",
        Some(&Value::Object(body)),
        Vec::new(),
    )?;
    let replayed = sent.get("idempotent_replay").and_then(Value::as_bool) == Some(true);
    if replayed {
        write_idempotent_replay_banner(&sent);
    }

    let mut settlement = None;
    if wait_settle && !replayed {
        eprintln!("{SETTLEMENT_WAITING_NOTICE}");
        settlement = poll_for_settlement_interaction(
            &auth,
            &interaction_id,
            payee_to,
            &send_started_at,
            settle_timeout_seconds,
            settle_interval_seconds,
        )?;
        if let Some(receipt) = &settlement {
            if let Some(settle_tx) = &receipt.settle_tx {
                eprintln!("Settled. settle_tx: {settle_tx}");
            } else {
                eprintln!(
                    "Settlement interaction received (no settle_tx field present; full receipt below)."
                );
            }
        }
    }

    let decision =
        decide_pay_email_completion(json_output, wait_settle, replayed, settlement.is_some());
    if decision.print_timeout_message {
        eprintln!("{SETTLEMENT_TIMEOUT_NOTICE}");
    }

    if json_output {
        let mut output = json!({
            "interaction": built.envelope,
            "sent": sent,
            "idempotent_replay": replayed,
        });
        if wait_settle {
            if let Some(object) = output.as_object_mut() {
                object.insert(
                    "settlement".to_string(),
                    settlement
                        .as_ref()
                        .map(|receipt| {
                            json!({
                                "email_id": receipt.email_id.clone(),
                                "settle_tx": receipt.settle_tx.clone(),
                                "receipt": receipt.envelope.clone(),
                            })
                        })
                        .unwrap_or(Value::Null),
                );
            }
        }
        println!("{}", serde_json::to_string_pretty(&output)?);
    } else {
        println!("{}", serde_json::to_string_pretty(&sent)?);
        if decision.print_wait_notice {
            eprintln!("{SETTLEMENT_WAIT_NOTICE}");
        } else if decision.print_settlement_receipt {
            if let Some(receipt) = &settlement {
                println!("{}", serde_json::to_string_pretty(&receipt.envelope)?);
            }
        }
    }
    print_time(&invocation, start);
    if decision.exit_nonzero {
        std::process::exit(1);
    }
    Ok(())
}

fn pay_email_uses_flag_or_env_api_key(
    invocation: &api::Invocation,
    used_stored_login_over_env_key: bool,
) -> bool {
    if used_stored_login_over_env_key {
        return false;
    }
    invocation
        .flags
        .get("api-key")
        .map(String::as_str)
        .is_some_and(|value| !value.trim().is_empty())
        || std::env::var("PRIMITIVE_API_KEY")
            .ok()
            .is_some_and(|value| !value.trim().is_empty())
}

fn execute_pay_email_step(args: &[String]) -> Result<()> {
    let invocation = parse_payments_invocation("pay-email-step", args)?;
    resolve_pay_email_step_request_config(&invocation)?;
    let key = private_key_from_invocation(&invocation)?;
    let challenge = read_email_challenge_from_invocation(&invocation)?;
    let start = std::time::Instant::now();
    let step_id = random_uuid_v4();
    let built = build_signed_payment_step_at(&challenge, &key, &step_id, Utc::now().timestamp())?;
    if invocation.bool_flags.get("json") == Some(&true) {
        println!("{}", serde_json::to_string_pretty(&built.envelope)?);
    } else {
        println!("{}", built.json);
    }
    print_time(&invocation, start);
    Ok(())
}

fn resolve_pay_email_step_request_config(invocation: &api::Invocation) -> Result<()> {
    let env_api_base_url = std::env::var("PRIMITIVE_API_BASE_URL").ok();
    let api_base_url = invocation
        .flags
        .get("api-base-url")
        .map(String::as_str)
        .or(env_api_base_url.as_deref());
    let _ = config::resolve_request_config(&config::config_dir(), api_base_url)?;
    Ok(())
}

fn sign_payment_details(
    network: &str,
    chain_id: u64,
    requirements: &X402PaymentRequirements,
    binding: &X402NonceBinding,
    expires_at: &str,
    key: &PrivateKey,
    now_sec: i64,
) -> Result<X402PaymentPayload> {
    validate_payment_requirements(requirements)?;
    if requirements.scheme != "exact" {
        bail!("unsupported payment scheme: {}", requirements.scheme);
    }

    let expires_at_sec = parse_expires_at_sec(expires_at)?;
    if expires_at_sec <= now_sec {
        bail!("challenge has already expired (expires_at {expires_at}); not signing");
    }
    let window = compute_payment_validity_window(PaymentValidityWindowParams {
        challenge_expires_at_sec: expires_at_sec,
        now_sec,
        settlement_margin_sec: None,
        clock_skew_sec: None,
        max_window_sec: None,
        min_headroom_sec: None,
        valid_before_sec: None,
        valid_after_sec: None,
        clamp: None,
    })?;
    let nonce = derive_eip3009_nonce(&NonceBinding {
        interaction_id: binding.interaction_id.clone(),
        challenge_step_id: binding.challenge_step_id.clone(),
        challenge_nonce: binding.challenge_nonce.clone(),
    })?;
    let authorization = TransferAuthorization {
        from: address_from_private_key(key)?,
        to: validate_checksum_address(&requirements.pay_to)?,
        value: requirements.max_amount_required.clone(),
        valid_after: window.valid_after.to_string(),
        valid_before: window.valid_before.to_string(),
        nonce,
    };
    let typed = transfer_with_authorization_typed_data(
        TokenDomain {
            name: requirements.extra.name.clone(),
            version: requirements.extra.version.clone(),
            chain_id,
            verifying_contract: validate_checksum_address(&requirements.asset)?,
        },
        authorization.clone(),
    );
    let signature = sign_transfer_with_authorization(key, &typed)?;
    build_exact_evm_payment_payload(network, authorization, &signature)
}

fn read_challenge_from_invocation(invocation: &api::Invocation) -> Result<X402Challenge> {
    let raw = read_input_json(
        invocation.flags.get("challenge"),
        invocation.flags.get("challenge-file"),
        "challenge",
    )?;
    challenge_from_json_str(&raw)
}

fn read_email_challenge_from_invocation(
    invocation: &api::Invocation,
) -> Result<X402EmailChallenge> {
    let raw = read_input_json(
        invocation.flags.get("challenge"),
        invocation.flags.get("challenge-file"),
        "email challenge",
    )?;
    email_challenge_from_json_str(&raw)
}

fn read_input_json(inline: Option<&String>, file: Option<&String>, label: &str) -> Result<String> {
    if inline.is_some() && file.is_some() {
        bail!("Use either --challenge or --challenge-file, not both.");
    }
    if let Some(value) = inline {
        return Ok(value.clone());
    }
    if let Some(path) = file {
        return fs::read_to_string(path).with_context(|| format!("Could not read {path}"));
    }
    let mut raw = String::new();
    io::stdin()
        .read_to_string(&mut raw)
        .with_context(|| format!("Could not read {label} JSON from stdin"))?;
    Ok(raw)
}

fn parse_json_source(raw: &str, label: &str) -> Result<Value> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        bail!("no {label} provided; pass --challenge '<json>', --challenge-file <path>, or pipe the {label} JSON on stdin");
    }
    serde_json::from_str(trimmed).with_context(|| format!("{label} is not valid JSON"))
}

fn unwrap_data_envelope(value: Value) -> Value {
    match value {
        Value::Object(mut object) => match object.remove("data") {
            Some(data) => data,
            None => Value::Object(object),
        },
        other => other,
    }
}

fn private_key_from_invocation(invocation: &api::Invocation) -> Result<PrivateKey> {
    let raw = invocation
        .flags
        .get("private-key")
        .cloned()
        .or_else(|| std::env::var(PRIVATE_KEY_ENV).ok())
        .ok_or_else(|| {
            anyhow!(
                "private key must be 32 bytes of hex (64 hex chars, optionally 0x-prefixed); set {PRIVATE_KEY_ENV} or pass --private-key"
            )
        })?;
    parse_private_key(&raw)
}

fn parse_u64_flag(
    invocation: &api::Invocation,
    name: &str,
    default_value: u64,
    minimum: u64,
) -> Result<u64> {
    if invocation.bool_flags.contains_key(name) {
        bail!("Expected an integer for --{name}");
    }
    let Some(value) = invocation.flags.get(name) else {
        return Ok(default_value);
    };
    let parsed: u64 = value
        .parse()
        .with_context(|| format!("Expected an integer for --{name}"))?;
    if parsed < minimum {
        bail!("Expected --{name} to be greater than or equal to {minimum}");
    }
    Ok(parsed)
}

fn request_json(
    method: Method,
    auth: &ResolvedAuth,
    path: &str,
    body: Option<&Value>,
    headers: Vec<(String, String)>,
) -> Result<Value> {
    extract_data(request_json_raw(method, auth, path, body, headers)?)
}

fn request_json_raw(
    method: Method,
    auth: &ResolvedAuth,
    path: &str,
    body: Option<&Value>,
    headers: Vec<(String, String)>,
) -> Result<Value> {
    let http = client::http_client()?;
    let url = format!("{}{}", auth.api_base_url.trim_end_matches('/'), path);
    let mut request = http.request(method, url);
    request = client::apply_headers(request, auth, true, &headers, body.is_some())?;
    if let Some(body) = body {
        request = request.json(body);
    }
    let response = request.send()?;
    let (status, bytes, json) = client::parse_response(response)?;
    if status >= 400 {
        return Err(client::error_for_status_with_hints(
            status,
            json.as_ref(),
            &bytes,
        ));
    }
    let value = json.ok_or_else(|| anyhow!("HTTP {status} returned no JSON body"))?;
    Ok(value)
}

fn request_json_with_pay_email_not_found_hint(
    method: Method,
    auth: &ResolvedAuth,
    path: &str,
    body: Option<&Value>,
    headers: Vec<(String, String)>,
    api_key_authenticated_read: bool,
) -> Result<Value> {
    let http = client::http_client()?;
    let url = format!("{}{}", auth.api_base_url.trim_end_matches('/'), path);
    let mut request = http.request(method, url);
    request = client::apply_headers(request, auth, true, &headers, body.is_some())?;
    if let Some(body) = body {
        request = request.json(body);
    }
    let response = request.send()?;
    let (status, bytes, json) = client::parse_response(response)?;
    if status >= 400 {
        let error = client::error_for_status_with_hints(status, json.as_ref(), &bytes);
        if api_key_authenticated_read
            && crate::api::extract_error_code(json.as_ref()) == Some("not_found")
        {
            return Err(anyhow!("{error}\n{PAY_EMAIL_WRONG_ORG_NOT_FOUND_HINT}"));
        }
        return Err(error);
    }
    let value = json.ok_or_else(|| anyhow!("HTTP {status} returned no JSON body"))?;
    extract_data(value)
}

fn request_bytes(auth: &ResolvedAuth, path: &str) -> Result<Vec<u8>> {
    let http = client::http_client()?;
    let url = format!("{}{}", auth.api_base_url.trim_end_matches('/'), path);
    let request = http.request(Method::GET, url);
    let request = client::apply_headers(request, auth, true, &[], false)?;
    let response = request.send()?;
    let (status, bytes, json) = client::parse_response(response)?;
    if status >= 400 {
        return Err(client::error_for_status_with_hints(
            status,
            json.as_ref(),
            &bytes,
        ));
    }
    Ok(bytes)
}

#[derive(Debug, Clone)]
struct EmailSearchRow {
    id: String,
}

#[derive(Debug, Clone)]
struct EmailSearchPage {
    cursor: Option<String>,
    rows: Vec<EmailSearchRow>,
}

fn poll_for_settlement_interaction(
    auth: &ResolvedAuth,
    interaction_id: &str,
    payee_from: &str,
    since: &str,
    timeout_seconds: u64,
    interval_seconds: u64,
) -> Result<Option<SettlementReceipt>> {
    let deadline =
        (timeout_seconds != 0).then(|| Instant::now() + Duration::from_secs(timeout_seconds));
    let mut checked = HashSet::new();

    loop {
        let mut cursor: Option<String> = None;
        loop {
            let page =
                match fetch_settlement_search_page(auth, payee_from, since, cursor.as_deref()) {
                    Ok(page) => page,
                    Err(_) => break,
                };
            let page_empty = page.rows.is_empty();

            for row in &page.rows {
                if checked.contains(&row.id) {
                    continue;
                }
                let bytes = match fetch_settlement_interaction_json(auth, &row.id) {
                    Ok(Some(bytes)) => bytes,
                    Ok(None) | Err(_) => continue,
                };
                let Some(envelope) = parse_interaction_envelope(&bytes) else {
                    continue;
                };
                checked.insert(row.id.clone());
                if is_settlement_receipt_for(&envelope, interaction_id) {
                    let settle_tx = extract_settle_tx(&envelope).map(str::to_string);
                    return Ok(Some(SettlementReceipt {
                        email_id: row.id.clone(),
                        envelope,
                        settle_tx,
                    }));
                }
            }

            let next_cursor = page.cursor;
            if next_cursor.is_none() || next_cursor == cursor || page_empty {
                break;
            }
            cursor = next_cursor;
        }

        if deadline.is_some_and(|deadline| Instant::now() >= deadline) {
            break;
        }
        thread::sleep(Duration::from_secs(interval_seconds));
    }

    Ok(None)
}

fn fetch_settlement_search_page(
    auth: &ResolvedAuth,
    payee_from: &str,
    since: &str,
    cursor: Option<&str>,
) -> Result<EmailSearchPage> {
    let query = build_settlement_search_query(payee_from, since, cursor);
    let path = path_with_query("/emails/search", &query);
    let response = request_json_raw(Method::GET, auth, &path, None, Vec::new())?;
    email_search_page_from_response(&response)
}

fn email_search_page_from_response(response: &Value) -> Result<EmailSearchPage> {
    if response.get("success") == Some(&Value::Bool(false)) {
        bail!("{}", serde_json::to_string_pretty(response)?);
    }

    let rows_value = response
        .get("data")
        .and_then(Value::as_array)
        .or_else(|| {
            response
                .get("data")
                .and_then(|data| data.get("data"))
                .and_then(Value::as_array)
        })
        .ok_or_else(|| anyhow!("emails search response is missing data rows"))?;
    let rows = rows_value
        .iter()
        .filter_map(|row| {
            row.get("id")
                .and_then(Value::as_str)
                .filter(|id| !id.is_empty())
                .map(|id| EmailSearchRow { id: id.to_string() })
        })
        .collect();
    let cursor = response
        .get("meta")
        .and_then(|meta| meta.get("cursor"))
        .and_then(Value::as_str)
        .or_else(|| {
            response
                .get("data")
                .and_then(|data| data.get("meta"))
                .and_then(|meta| meta.get("cursor"))
                .and_then(Value::as_str)
        })
        .filter(|cursor| !cursor.is_empty())
        .map(str::to_string);

    Ok(EmailSearchPage { cursor, rows })
}

fn path_with_query(path: &str, query: &BTreeMap<String, String>) -> String {
    if query.is_empty() {
        return path.to_string();
    }
    let encoded = query
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
    format!("{path}?{encoded}")
}

fn fetch_settlement_interaction_json(
    auth: &ResolvedAuth,
    email_id: &str,
) -> Result<Option<Vec<u8>>> {
    let archive = request_bytes(
        auth,
        &format!(
            "/emails/{}/attachments.tar.gz",
            urlencoding::encode(email_id)
        ),
    )?;
    interaction_json_from_archive(&archive, None)
}

fn derive_email_challenge_from_inbound(
    auth: &ResolvedAuth,
    email_id: &str,
    attachments: Option<&Value>,
) -> Result<X402EmailChallenge> {
    let bytes = fetch_interaction_json_bytes(auth, email_id, attachments)?;
    parse_email_challenge_from_part_bytes(&bytes)
}

fn fetch_interaction_json_bytes(
    auth: &ResolvedAuth,
    email_id: &str,
    attachments: Option<&Value>,
) -> Result<Vec<u8>> {
    let archive = request_bytes(
        auth,
        &format!(
            "/emails/{}/attachments.tar.gz",
            urlencoding::encode(email_id)
        ),
    )
    .with_context(|| format!("Could not download attachments for inbound email {email_id}"))?;
    let tar_path = interaction_tar_path_from_meta(attachments);
    interaction_json_from_archive(&archive, tar_path.as_deref())?.ok_or_else(|| {
        anyhow!("Inbound email {email_id} has no {INTERACTION_PART_FILENAME} attachment, so it is not an x402 payment request. Pass --challenge / --challenge-file if you have the challenge from another source.")
    })
}

fn extract_data(value: Value) -> Result<Value> {
    if value.get("success") == Some(&Value::Bool(false)) {
        return Err(anyhow!("{}", serde_json::to_string_pretty(&value)?));
    }
    if let Some(data) = value.get("data") {
        return Ok(data.clone());
    }
    Ok(value)
}

fn email_detail_from_response(value: &Value) -> &Value {
    value.get("data").unwrap_or(value)
}

fn first_string_field<'a>(value: &'a Value, fields: &[&str]) -> Option<&'a str> {
    fields
        .iter()
        .find_map(|field| value.get(*field).and_then(Value::as_str))
        .filter(|value| !value.trim().is_empty())
}

fn account_org_id(value: &Value) -> Result<&str> {
    value
        .get("id")
        .and_then(Value::as_str)
        .or_else(|| {
            value
                .get("data")
                .and_then(|data| data.get("id"))
                .and_then(Value::as_str)
        })
        .ok_or_else(|| anyhow!("could not resolve your organization id from /v1/account"))
}

fn validate_challenge(challenge: &X402Challenge) -> Result<()> {
    if challenge.id.is_empty() {
        bail!("challenge is missing or malformed: id");
    }
    if challenge.network.is_empty() {
        bail!("challenge is missing or malformed: network");
    }
    if challenge.expires_at.is_empty() {
        bail!("challenge is missing or malformed: expires_at");
    }
    validate_nonce_binding(&challenge.nonce_binding, "challenge")?;
    validate_payment_requirements(&challenge.payment_requirements)?;
    Ok(())
}

fn validate_email_challenge(challenge: &X402EmailChallenge) -> Result<()> {
    if challenge.interaction_id.is_empty() {
        bail!("email challenge is missing or malformed: interaction_id");
    }
    if challenge.challenge.expires_at.is_empty() {
        bail!("email challenge is missing or malformed: challenge.expires_at");
    }
    validate_nonce_binding(
        &challenge.challenge.nonce_binding,
        "email challenge.challenge",
    )?;
    if challenge.challenge.nonce_binding.interaction_id != challenge.interaction_id {
        bail!(
            "email challenge is missing or malformed: interaction_id (mismatch with challenge.nonce_binding.interaction_id)"
        );
    }
    validate_payment_requirements(&challenge.challenge.payment_requirements)?;
    Ok(())
}

fn validate_nonce_binding(binding: &X402NonceBinding, label: &str) -> Result<()> {
    if binding.interaction_id.is_empty()
        || binding.challenge_step_id.is_empty()
        || binding.challenge_nonce.is_empty()
    {
        bail!("{label} is missing or malformed: nonce_binding");
    }
    Ok(())
}

fn validate_payment_requirements(requirements: &X402PaymentRequirements) -> Result<()> {
    if !is_positive_integer_token_amount(&requirements.max_amount_required) {
        bail!(
            "payment_requirements.maxAmountRequired must be a positive integer string in token base units"
        );
    }
    let _ = validate_checksum_address(&requirements.pay_to)?;
    let _ = validate_checksum_address(&requirements.asset)?;
    if requirements.extra.name.is_empty() || requirements.extra.version.is_empty() {
        bail!("payment_requirements.extra requires name and version");
    }
    Ok(())
}

#[derive(Debug, Clone)]
struct TarEntry {
    name: String,
    bytes: Vec<u8>,
}

impl TarEntry {
    fn base_name(&self) -> &str {
        self.name.rsplit('/').next().unwrap_or(&self.name)
    }
}

fn read_tar_entries(buffer: &[u8]) -> Result<Vec<TarEntry>> {
    const BLOCK: usize = 512;
    let mut offset = 0;
    let mut long_name: Option<String> = None;
    let mut entries = Vec::new();
    while offset + BLOCK <= buffer.len() {
        let header = &buffer[offset..offset + BLOCK];
        if header.iter().all(|byte| *byte == 0) {
            break;
        }
        let size = parse_tar_size(&header[124..136])?;
        let type_flag = header[156];
        let data_start = offset + BLOCK;
        let data_end = data_start.saturating_add(size);
        if data_end > buffer.len() {
            bail!("attachments archive tar entry extends beyond archive boundary");
        }

        if type_flag == b'L' {
            long_name = Some(read_tar_string(&buffer[data_start..data_end]));
        } else if type_flag == b'0' || type_flag == 0 {
            let name = match long_name.take() {
                Some(name) => name,
                None => {
                    let prefix = read_tar_string(&header[345..500]);
                    let base = read_tar_string(&header[0..100]);
                    if prefix.is_empty() {
                        base
                    } else {
                        format!("{prefix}/{base}")
                    }
                }
            };
            entries.push(TarEntry {
                name,
                bytes: buffer[data_start..data_end].to_vec(),
            });
        } else {
            long_name = None;
        }

        let padded = size.div_ceil(BLOCK) * BLOCK;
        offset = data_start + padded;
    }
    Ok(entries)
}

fn parse_tar_size(field: &[u8]) -> Result<usize> {
    let value = read_tar_string(field);
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(0);
    }
    usize::from_str_radix(trimmed, 8)
        .with_context(|| format!("invalid tar size field `{trimmed}` in attachments archive"))
}

fn read_tar_string(bytes: &[u8]) -> String {
    let end = bytes
        .iter()
        .position(|byte| *byte == 0)
        .unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end])
        .trim_end_matches('\0')
        .to_string()
}

fn strip_part_index_prefix(value: &str) -> &str {
    let Some((prefix, rest)) = value.split_once('_') else {
        return value;
    };
    if !prefix.is_empty() && prefix.bytes().all(|byte| byte.is_ascii_digit()) {
        rest
    } else {
        value
    }
}

fn invalid_interaction_part(field: &str) -> anyhow::Error {
    anyhow!("interaction.json part is not a valid x402 challenge: {field}")
}

fn is_wire_interaction_id(value: &str) -> bool {
    let Some((uuid, domain)) = value.split_once('@') else {
        return false;
    };
    is_uuid(uuid)
        && !domain.is_empty()
        && !domain
            .bytes()
            .any(|byte| byte.is_ascii_whitespace() || byte == b'@')
}

fn is_uuid(value: &str) -> bool {
    if value.len() != 36 {
        return false;
    }
    let bytes = value.as_bytes();
    for index in [8, 13, 18, 23] {
        if bytes[index] != b'-' {
            return false;
        }
    }
    bytes
        .iter()
        .enumerate()
        .all(|(index, byte)| matches!(index, 8 | 13 | 18 | 23) || byte.is_ascii_hexdigit())
}

fn is_lower_hex(value: &str, len: usize) -> bool {
    value.len() == len
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn chain_id(network: &str) -> Result<u64> {
    match network {
        "base-sepolia" => Ok(84532),
        "base" => Ok(8453),
        _ => bail!("unsupported network: {network}"),
    }
}

fn is_positive_integer_token_amount(value: &str) -> bool {
    let bytes = value.as_bytes();
    !bytes.is_empty()
        && bytes.len() <= 39
        && matches!(bytes[0], b'1'..=b'9')
        && bytes[1..].iter().all(u8::is_ascii_digit)
}

fn parse_expires_at_sec(value: &str) -> Result<i64> {
    let parsed = DateTime::parse_from_rfc3339(value)
        .with_context(|| format!("challenge has an invalid expires_at: {value}"))?;
    Ok(parsed.timestamp())
}

fn current_iso_millis() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn random_uuid_v4() -> String {
    let mut bytes = [0_u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    format!(
        "{:02x}{:02x}{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        bytes[0],
        bytes[1],
        bytes[2],
        bytes[3],
        bytes[4],
        bytes[5],
        bytes[6],
        bytes[7],
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15]
    )
}

fn format_usdc(base_units: &str) -> String {
    if !base_units.bytes().all(|byte| byte.is_ascii_digit()) {
        return base_units.to_string();
    }
    let padded = if base_units.len() <= 6 {
        format!("{base_units:0>7}")
    } else {
        base_units.to_string()
    };
    let split = padded.len() - 6;
    let whole = &padded[..split];
    let fraction = padded[split..].trim_end_matches('0');
    if fraction.is_empty() {
        whole.to_string()
    } else {
        format!("{whole}.{fraction}")
    }
}

fn explorer_tx_url(network: &str, tx: &str) -> Option<String> {
    let hex = tx.strip_prefix("0x")?;
    if hex.len() != 64 || !hex.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    match network {
        "base" => Some(format!("https://basescan.org/tx/{tx}")),
        "base-sepolia" => Some(format!("https://sepolia.basescan.org/tx/{tx}")),
        _ => None,
    }
}

fn require_api_key(auth: &ResolvedAuth) -> Result<()> {
    if auth.api_key.is_none() {
        bail!("Not signed in. Set PRIMITIVE_API_KEY or run `primitive signin`, then retry.");
    }
    Ok(())
}

fn print_time(invocation: &api::Invocation, start: std::time::Instant) {
    if invocation.bool_flags.get("time") == Some(&true) {
        eprintln!("[time: {:.2}s]", start.elapsed().as_secs_f64());
    }
}

fn print_help() {
    let bin = crate::display_bin_name();
    println!("Primitive Rust CLI payments commands:");
    println!("  {bin} payments charge --amount-usdc <amount>");
    println!("  {bin} payments create-challenge [flags]");
    println!("  {bin} payments get-challenge --id <challenge-id>");
    println!("  {bin} payments pay --challenge-file <path>");
    println!("  {bin} payments register-payout-address");
    println!("  {bin} payments list-payout-addresses");
    println!("  {bin} payments get-spend-policy");
    println!("  {bin} payments update-spend-policy");
    println!("  {bin} payments challenge-from-email --id <inbound-email-id>");
    println!("  {bin} payments pay-email --in-reply-to <inbound-email-id>");
    println!("  {bin} payments pay-email-step --challenge-file <path>");
}

pub fn payments_leaf_help_text(command: &str) -> Option<String> {
    match command {
        "charge" => Some(payments_charge_help_text(command)),
        "pay" | "pay-challenge" => Some(payments_pay_help_text(command)),
        "register-payout" | "register-payout-address" => {
            Some(payments_register_payout_help_text(command))
        }
        "challenge-from-email" => Some(payments_challenge_from_email_help_text()),
        "pay-email" => Some(payments_pay_email_help_text()),
        "pay-email-step" => Some(payments_pay_email_step_help_text()),
        _ => None,
    }
}

pub fn payments_charge_help_text(command: &str) -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Request an x402 payment by creating a challenge

USAGE
  {bin} payments {command} [--api-key <value>] [--amount-usdc <value> | --amount <value>] [--network <value>] [--payer-org <value>] [--description <value>] [--resource <value>] [--expires-in <value>] [--idempotency-key <value>] [--time]

FLAGS
      --amount <value>           Amount to collect in token base units, e.g. 10000.
      --amount-usdc <value>      Amount to collect in USDC, e.g. 0.01.
      --api-key <value>          Primitive API key override.
      --description <value>      Human-readable description of what the payment is for.
      --expires-in <value>       Seconds until the challenge expires.
      --idempotency-key <value>  Retry-safe key for returning the original challenge.
      --network <value>          Chain to collect on. Defaults to base-sepolia.
      --payer-org <value>        Restrict who can pay to this organization id.
      --resource <value>         URL identifying the thing being paid for.
      --time                     Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} payments {command} --amount-usdc 0.01
  {bin} payments {command} --amount 10000 --network base
  {bin} payments {command} --amount-usdc 1.50 > challenge.json
"#
    )
}

pub fn payments_pay_help_text(command: &str) -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Sign and settle an x402 payment challenge

USAGE
  {bin} payments {command} [--api-key <value>] [--private-key <value>] [--challenge <json> | --challenge-file <path>] [--json] [--time]

FLAGS
      --api-key <value>          Primitive API key override.
      --challenge <json>         The challenge object as a JSON string.
      --challenge-file <path>    Path to a file containing the challenge JSON.
      --json                     Print raw receipt JSON instead of a human summary.
      --private-key <value>      Hex private key. Prefer PRIMITIVE_X402_PRIVATE_KEY.
      --time                     Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} payments {command} --challenge-file challenge.json
  cat challenge.json | {bin} payments {command}
"#
    )
}

pub fn payments_register_payout_help_text(command: &str) -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Register a payout address for receiving x402 payments

USAGE
  {bin} payments {command} [--api-key <value>] [--private-key <value>] [--network <value>] [--label <value>] [--issued-at <value>] [--json] [--time]

FLAGS
      --api-key <value>      Primitive API key override.
      --issued-at <value>    ISO-8601 timestamp embedded in the signed message.
      --json                 Print raw payout-address JSON instead of a human summary.
      --label <value>        Optional human-readable label for the address.
      --network <value>      Chain the address receives on. Defaults to base-sepolia.
      --private-key <value>  Hex private key. Prefer PRIMITIVE_X402_PRIVATE_KEY.
      --time                 Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} payments {command}
  {bin} payments {command} --network base --label treasury
"#
    )
}

pub fn payments_challenge_from_email_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Print the email x402 challenge object derived from a received payment-request email

USAGE
  {bin} payments challenge-from-email --id <value> [--api-key <value>] [--time]

FLAGS
      --api-key <value>  Primitive API key override.
      --id <value>       Required inbound payment-request email id.
      --time             Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} payments challenge-from-email --id <inbound-email-id>
  {bin} payments challenge-from-email --id <inbound-email-id> | {bin} payments pay-email-step > interaction.json
"#
    )
}

pub fn payments_pay_email_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Sign an email x402 challenge and send the signed interaction.json

USAGE
  {bin} payments pay-email --in-reply-to <inbound-email-id> [--api-key <value>] [--private-key <value>] [--challenge <json> | --challenge-file <path>] [--from <value>] [--body <value>] [--wait] [--wait-settle] [--settle-timeout <seconds>] [--settle-interval <seconds>] [--json] [--time]

FLAGS
      --api-key <value>         Primitive API key override.
      --body <value>            Plain-text body for the accompanying note.
      --challenge <json>        Override challenge JSON.
      --challenge-file <path>   Override challenge JSON file.
      --from <value>            Optional From header override.
      --in-reply-to <id>        Required inbound challenge email id.
      --json                    Print JSON output.
      --private-key <value>     Hex private key. Prefer PRIMITIVE_X402_PRIVATE_KEY.
      --settle-interval <secs>  Seconds between settlement-email polls. Defaults to 5.
      --settle-timeout <secs>   Seconds to wait for settlement email. Defaults to 180.
      --time                    Print elapsed wall-clock time to stderr.
      --wait                    Wait for email delivery.
      --wait-settle             Poll for the follow-up x402 settlement email.

EXAMPLES
  {bin} payments pay-email --in-reply-to <inbound-email-id>
  {bin} payments pay-email --in-reply-to <inbound-email-id> --wait-settle
  {bin} payments pay-email --challenge-file challenge.json --in-reply-to <inbound-email-id>
"#
    )
}

pub fn payments_pay_email_step_help_text() -> String {
    let bin = crate::display_bin_name();
    format!(
        r#"Sign an email x402 challenge into a payment-step envelope

USAGE
  {bin} payments pay-email-step [--api-key <value>] [--private-key <value>] [--challenge <json> | --challenge-file <path>] [--json] [--time]

FLAGS
      --api-key <value>         Primitive API key override.
      --challenge <json>        The email challenge object as a JSON string.
      --challenge-file <path>   Path to a file containing the email challenge JSON.
      --json                    Print the full signed envelope object.
      --private-key <value>     Hex private key. Prefer PRIMITIVE_X402_PRIVATE_KEY.
      --time                    Print elapsed wall-clock time to stderr.

EXAMPLES
  {bin} payments pay-email-step --challenge-file challenge.json > interaction.json
  cat challenge.json | {bin} payments pay-email-step
"#
    )
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
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
    let status = data.get("status").and_then(Value::as_str);
    let delivery_status = data.get("delivery_status").and_then(Value::as_str);
    if status.is_some() || delivery_status.is_some() {
        let mut parts = Vec::new();
        if let Some(status) = status {
            parts.push(format!("status={status}"));
        }
        if let Some(delivery_status) = delivery_status {
            if Some(delivery_status) != status {
                parts.push(format!("delivery_status={delivery_status}"));
            }
        }
        if !parts.is_empty() {
            eprintln!("      original {}", parts.join(", "));
        }
    }
    eprintln!("      to send a fresh copy: vary any field (subject, body, etc.) or");
    eprintln!("      pass a unique Idempotency-Key on the underlying API call.");
}
