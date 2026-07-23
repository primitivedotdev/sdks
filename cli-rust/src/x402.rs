use anyhow::{anyhow, bail, Result};
use k256::ecdsa::SigningKey;
use serde::Serialize;
use std::collections::BTreeMap;

const CHALLENGE_NONCE_LEN: usize = 64;
const DEFAULT_MAX_WINDOW_SEC: i64 = 24 * 60 * 60;
const DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC: i64 = 60;
const USDC_DECIMALS: usize = 6;
const SECP256K1_ORDER_HEX: &str =
    "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrivateKey {
    bytes: [u8; 32],
}

impl PrivateKey {
    pub fn bytes(&self) -> &[u8; 32] {
        &self.bytes
    }

    pub fn to_hex(&self) -> String {
        format!("0x{}", encode_hex(&self.bytes))
    }
}

pub fn parse_private_key(input: &str) -> Result<PrivateKey> {
    let hex = input
        .strip_prefix("0x")
        .or_else(|| input.strip_prefix("0X"))
        .unwrap_or(input);
    if hex.len() != 64 || !hex.bytes().all(is_hex_byte) {
        bail!("private key must be exactly 32 bytes as 64 hex chars, with optional 0x prefix");
    }
    if hex.bytes().all(|byte| byte == b'0') {
        bail!("private key must be non-zero");
    }
    let lower = hex.to_ascii_lowercase();
    if lower.as_str() >= SECP256K1_ORDER_HEX {
        bail!("private key must be less than the secp256k1 curve order");
    }
    let mut bytes = [0_u8; 32];
    decode_hex_into(&lower, &mut bytes)?;
    Ok(PrivateKey { bytes })
}

pub fn address_from_private_key(key: &PrivateKey) -> Result<String> {
    let signing_key =
        SigningKey::from_slice(&key.bytes).map_err(|_| anyhow!("invalid secp256k1 private key"))?;
    let verifying_key = signing_key.verifying_key();
    let public_key = verifying_key.to_encoded_point(false);
    let public_key = public_key.as_bytes();
    if public_key.len() != 65 || public_key[0] != 0x04 {
        bail!("unexpected secp256k1 public key encoding");
    }
    let hash = keccak256(&public_key[1..]);
    checksum_address(&format!("0x{}", encode_hex(&hash[12..])))
}

pub fn checksum_address(address: &str) -> Result<String> {
    let raw = normalized_address_hex(address)?;
    let hash = keccak256(raw.as_bytes());
    let mut checksummed = String::with_capacity(42);
    checksummed.push_str("0x");
    for (index, byte) in raw.bytes().enumerate() {
        let nibble = if index % 2 == 0 {
            hash[index / 2] >> 4
        } else {
            hash[index / 2] & 0x0f
        };
        if byte.is_ascii_hexdigit() && byte.is_ascii_alphabetic() && nibble >= 8 {
            checksummed.push((byte as char).to_ascii_uppercase());
        } else {
            checksummed.push(byte as char);
        }
    }
    Ok(checksummed)
}

pub fn validate_checksum_address(address: &str) -> Result<String> {
    let raw = normalized_address_hex(address)?;
    let checksummed = checksum_address(&raw)?;
    let prefixed = format!("0x{raw}");
    let body = address
        .strip_prefix("0x")
        .or_else(|| address.strip_prefix("0X"))
        .unwrap_or(address);

    let is_all_lower = body
        .bytes()
        .all(|byte| !byte.is_ascii_alphabetic() || byte.is_ascii_lowercase());
    let is_all_upper = body
        .bytes()
        .all(|byte| !byte.is_ascii_alphabetic() || byte.is_ascii_uppercase());
    if is_all_lower || is_all_upper || prefixed == checksummed || address == checksummed {
        return Ok(checksummed);
    }
    bail!("address has an invalid EIP-55 checksum");
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NonceBinding {
    pub interaction_id: String,
    pub challenge_step_id: String,
    pub challenge_nonce: String,
}

pub fn derive_eip3009_nonce(input: &NonceBinding) -> Result<String> {
    if input.challenge_nonce.len() != CHALLENGE_NONCE_LEN
        || !input
            .challenge_nonce
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
    {
        bail!("challenge_nonce must be exactly 64 lowercase hex chars (32 bytes), no 0x prefix");
    }

    let mut nonce_bytes = [0_u8; 32];
    decode_hex_into(&input.challenge_nonce, &mut nonce_bytes)?;

    let mut preimage = Vec::with_capacity(
        input.interaction_id.len() + input.challenge_step_id.len() + 2 + nonce_bytes.len(),
    );
    preimage.extend_from_slice(input.interaction_id.to_ascii_lowercase().as_bytes());
    preimage.push(0);
    preimage.extend_from_slice(input.challenge_step_id.to_ascii_lowercase().as_bytes());
    preimage.push(0);
    preimage.extend_from_slice(&nonce_bytes);

    Ok(format!("0x{}", encode_hex(&keccak256(&preimage))))
}

pub fn usdc_to_base_units(amount: &str) -> Result<String> {
    let trimmed = amount.trim();
    if trimmed.is_empty() {
        bail!("USDC amount is required");
    }
    if trimmed.starts_with('-') || trimmed.starts_with('+') {
        bail!("USDC amount must be unsigned");
    }
    let mut pieces = trimmed.split('.');
    let whole = pieces.next().unwrap_or_default();
    let fraction = pieces.next();
    if pieces.next().is_some() {
        bail!("USDC amount must contain at most one decimal point");
    }
    if whole.is_empty() && fraction.is_none() {
        bail!("USDC amount is required");
    }
    if !whole.is_empty() && !whole.bytes().all(|byte| byte.is_ascii_digit()) {
        bail!("USDC amount whole units must be decimal digits");
    }
    let fraction = fraction.unwrap_or_default();
    if !fraction.bytes().all(|byte| byte.is_ascii_digit()) {
        bail!("USDC amount fractional units must be decimal digits");
    }
    if fraction.len() > USDC_DECIMALS {
        bail!("USDC supports at most 6 decimal places");
    }

    let whole_digits = if whole.is_empty() { "0" } else { whole };
    let mut base_units = String::with_capacity(whole_digits.len() + USDC_DECIMALS);
    base_units.push_str(whole_digits.trim_start_matches('0'));
    base_units.push_str(fraction);
    for _ in 0..(USDC_DECIMALS - fraction.len()) {
        base_units.push('0');
    }
    let normalized = base_units.trim_start_matches('0');
    if normalized.is_empty() {
        Ok("0".to_string())
    } else {
        Ok(normalized.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentValidityWindow {
    pub valid_after: u64,
    pub valid_before: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentValidityWindowParams {
    pub challenge_expires_at_sec: i64,
    pub now_sec: i64,
    pub settlement_margin_sec: Option<i64>,
    pub clock_skew_sec: Option<i64>,
    pub max_window_sec: Option<i64>,
    pub min_headroom_sec: Option<i64>,
    pub valid_before_sec: Option<i64>,
    pub valid_after_sec: Option<i64>,
    pub clamp: Option<bool>,
}

pub fn compute_payment_validity_window(
    params: PaymentValidityWindowParams,
) -> Result<PaymentValidityWindow> {
    let margin = params.settlement_margin_sec.unwrap_or(5 * 60);
    let skew = params.clock_skew_sec.unwrap_or(5 * 60);
    let max_window = params.max_window_sec.unwrap_or(DEFAULT_MAX_WINDOW_SEC);
    let min_headroom = params
        .min_headroom_sec
        .unwrap_or(DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC);
    let clamp = params.clamp.unwrap_or(true);

    if max_window < min_headroom {
        bail!(
            "invalid validity window config: max_window_sec ({max_window}) is smaller than min_headroom_sec ({min_headroom})"
        );
    }

    let valid_after = params
        .valid_after_sec
        .unwrap_or(params.now_sec.saturating_sub(skew));
    let raw_valid_before = params
        .valid_before_sec
        .unwrap_or(params.challenge_expires_at_sec.saturating_add(margin));
    let floor = params.now_sec.saturating_add(min_headroom);
    let ceiling = valid_after.saturating_add(max_window);

    let too_tight = raw_valid_before < floor;
    let too_wide = raw_valid_before > ceiling;
    if !clamp && params.valid_before_sec.is_some() {
        if too_tight {
            bail!(
                "invalid validity window: valid_before ({raw_valid_before}) is below the minimum settlement headroom (must be >= now + {min_headroom}s = {floor}); the authorization would be rejected as about to expire"
            );
        }
        if too_wide {
            bail!(
                "invalid validity window: valid_before ({raw_valid_before}) exceeds the {max_window}s window cap (must be <= valid_after + {max_window}s = {ceiling}); the authorization window is too wide"
            );
        }
    }

    let banded_valid_before = if too_tight {
        floor
    } else if too_wide {
        ceiling
    } else {
        raw_valid_before
    };

    if banded_valid_before <= valid_after {
        bail!("invalid validity window: valid_before must be after valid_after");
    }
    if valid_after < 0 || banded_valid_before < 0 {
        bail!("invalid validity window: unix seconds must be non-negative");
    }

    Ok(PaymentValidityWindow {
        valid_after: valid_after as u64,
        valid_before: banded_valid_before as u64,
    })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PayoutRegistrationMessageInput {
    pub org: String,
    pub address: String,
    pub network: String,
    pub issued_at: String,
}

pub fn build_payout_registration_message(input: &PayoutRegistrationMessageInput) -> String {
    [
        "Primitive x402 payout address authorization".to_string(),
        String::new(),
        "I authorize this address as a payout destination for my Primitive organization."
            .to_string(),
        String::new(),
        format!("org: {}", input.org),
        format!("address: {}", input.address.to_ascii_lowercase()),
        format!("network: {}", input.network),
        format!("issued: {}", input.issued_at),
    ]
    .join("\n")
}

pub fn build_payout_registration_message_bytes(input: &PayoutRegistrationMessageInput) -> Vec<u8> {
    build_payout_registration_message(input).into_bytes()
}

pub fn sign_payout_registration_message(
    key: &PrivateKey,
    input: &PayoutRegistrationMessageInput,
) -> Result<String> {
    let message = build_payout_registration_message(input);
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let mut preimage = Vec::with_capacity(prefix.len() + message.len());
    preimage.extend_from_slice(prefix.as_bytes());
    preimage.extend_from_slice(message.as_bytes());
    sign_digest(key, &keccak256(&preimage))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TokenDomain {
    pub name: String,
    pub version: String,
    #[serde(rename = "chainId")]
    pub chain_id: u64,
    #[serde(rename = "verifyingContract")]
    pub verifying_contract: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TransferAuthorization {
    pub from: String,
    pub to: String,
    pub value: String,
    #[serde(rename = "validAfter")]
    pub valid_after: String,
    #[serde(rename = "validBefore")]
    pub valid_before: String,
    pub nonce: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Eip712TypeField {
    pub name: &'static str,
    #[serde(rename = "type")]
    pub type_name: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct TransferWithAuthorizationTypedData {
    pub domain: TokenDomain,
    pub types: BTreeMap<&'static str, Vec<Eip712TypeField>>,
    #[serde(rename = "primaryType")]
    pub primary_type: &'static str,
    pub message: TransferAuthorization,
}

pub fn transfer_with_authorization_typed_data(
    domain: TokenDomain,
    authorization: TransferAuthorization,
) -> TransferWithAuthorizationTypedData {
    let mut types = BTreeMap::new();
    types.insert(
        "TransferWithAuthorization",
        vec![
            Eip712TypeField {
                name: "from",
                type_name: "address",
            },
            Eip712TypeField {
                name: "to",
                type_name: "address",
            },
            Eip712TypeField {
                name: "value",
                type_name: "uint256",
            },
            Eip712TypeField {
                name: "validAfter",
                type_name: "uint256",
            },
            Eip712TypeField {
                name: "validBefore",
                type_name: "uint256",
            },
            Eip712TypeField {
                name: "nonce",
                type_name: "bytes32",
            },
        ],
    );
    TransferWithAuthorizationTypedData {
        domain,
        types,
        primary_type: "TransferWithAuthorization",
        message: authorization,
    }
}

pub fn sign_transfer_with_authorization(
    key: &PrivateKey,
    typed_data: &TransferWithAuthorizationTypedData,
) -> Result<String> {
    sign_digest(key, &eip712_transfer_digest(typed_data)?)
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct X402PaymentPayload {
    #[serde(rename = "x402Version")]
    pub x402_version: u8,
    pub scheme: String,
    pub network: String,
    pub payload: X402PaymentPayloadBody,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct X402PaymentPayloadBody {
    pub signature: String,
    pub authorization: TransferAuthorization,
}

pub fn build_exact_evm_payment_payload(
    network: &str,
    authorization: TransferAuthorization,
    signature: &str,
) -> Result<X402PaymentPayload> {
    if network != "base" && network != "base-sepolia" {
        bail!("unsupported x402 network {network}");
    }
    validate_nonce_hex(&authorization.nonce)?;
    validate_signature_hex(signature)?;
    Ok(X402PaymentPayload {
        x402_version: 1,
        scheme: "exact".to_string(),
        network: network.to_string(),
        payload: X402PaymentPayloadBody {
            signature: signature.to_string(),
            authorization,
        },
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct X402PaymentStepPayload {
    pub payment: X402PaymentPayload,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct InteractionEnvelope<P: Serialize> {
    pub interaction_version: u8,
    pub interaction_id: String,
    pub protocol: String,
    pub protocol_version: u8,
    pub step: String,
    pub step_id: String,
    pub prev_step_id: Option<String>,
    pub expires_at: Option<String>,
    pub payload: P,
}

pub fn build_payment_step_envelope(
    interaction_id: &str,
    step_id: &str,
    prev_step_id: &str,
    payment: X402PaymentPayload,
    expires_at: Option<String>,
) -> Result<InteractionEnvelope<X402PaymentStepPayload>> {
    if !is_wire_interaction_id(interaction_id) {
        bail!("interaction_id must be uuid@domain");
    }
    if !is_uuid(step_id) {
        bail!("step_id must be a uuid");
    }
    if !is_uuid(prev_step_id) {
        bail!("prev_step_id must be a uuid");
    }
    Ok(InteractionEnvelope {
        interaction_version: 1,
        interaction_id: interaction_id.to_string(),
        protocol: "x402.payment".to_string(),
        protocol_version: 1,
        step: "payment".to_string(),
        step_id: step_id.to_string(),
        prev_step_id: Some(prev_step_id.to_string()),
        expires_at,
        payload: X402PaymentStepPayload { payment },
    })
}

fn validate_nonce_hex(value: &str) -> Result<()> {
    let hex = value
        .strip_prefix("0x")
        .ok_or_else(|| anyhow!("nonce must be 0x-prefixed"))?;
    if hex.len() != 64 || !hex.bytes().all(is_hex_byte) {
        bail!("nonce must be a 0x-prefixed 32-byte hex value");
    }
    Ok(())
}

fn validate_signature_hex(value: &str) -> Result<()> {
    let hex = value
        .strip_prefix("0x")
        .ok_or_else(|| anyhow!("signature must be 0x-prefixed"))?;
    if hex.len() != 130 || !hex.bytes().all(is_hex_byte) {
        bail!("signature must be a 0x-prefixed 65-byte EIP signature");
    }
    Ok(())
}

fn sign_digest(key: &PrivateKey, digest: &[u8; 32]) -> Result<String> {
    let signing_key =
        SigningKey::from_slice(&key.bytes).map_err(|_| anyhow!("invalid secp256k1 private key"))?;
    let (signature, recovery_id) = signing_key
        .sign_prehash_recoverable(digest)
        .map_err(|_| anyhow!("failed to sign secp256k1 digest"))?;
    let mut bytes = Vec::with_capacity(65);
    bytes.extend_from_slice(&signature.to_bytes());
    bytes.push(recovery_id.to_byte() + 27);
    Ok(format!("0x{}", encode_hex(&bytes)))
}

fn eip712_transfer_digest(typed_data: &TransferWithAuthorizationTypedData) -> Result<[u8; 32]> {
    let domain_separator = eip712_domain_separator(&typed_data.domain)?;
    let struct_hash = eip712_transfer_struct_hash(&typed_data.message)?;
    let mut digest_input = Vec::with_capacity(66);
    digest_input.extend_from_slice(&[0x19, 0x01]);
    digest_input.extend_from_slice(&domain_separator);
    digest_input.extend_from_slice(&struct_hash);
    Ok(keccak256(&digest_input))
}

fn eip712_domain_separator(domain: &TokenDomain) -> Result<[u8; 32]> {
    let mut encoded = Vec::with_capacity(32 * 5);
    encoded.extend_from_slice(&keccak256(
        b"EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)",
    ));
    encoded.extend_from_slice(&keccak256(domain.name.as_bytes()));
    encoded.extend_from_slice(&keccak256(domain.version.as_bytes()));
    encoded.extend_from_slice(&u64_to_u256(domain.chain_id));
    encoded.extend_from_slice(&address_to_word(&domain.verifying_contract)?);
    Ok(keccak256(&encoded))
}

fn eip712_transfer_struct_hash(auth: &TransferAuthorization) -> Result<[u8; 32]> {
    let mut encoded = Vec::with_capacity(32 * 7);
    encoded.extend_from_slice(&keccak256(
        b"TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)",
    ));
    encoded.extend_from_slice(&address_to_word(&auth.from)?);
    encoded.extend_from_slice(&address_to_word(&auth.to)?);
    encoded.extend_from_slice(&decimal_to_u256(&auth.value)?);
    encoded.extend_from_slice(&decimal_to_u256(&auth.valid_after)?);
    encoded.extend_from_slice(&decimal_to_u256(&auth.valid_before)?);
    encoded.extend_from_slice(&hex32_to_word(&auth.nonce)?);
    Ok(keccak256(&encoded))
}

fn address_to_word(address: &str) -> Result<[u8; 32]> {
    let hex = normalized_address_hex(address)?;
    let bytes = from_hex(&hex)?;
    let mut word = [0_u8; 32];
    word[12..].copy_from_slice(&bytes);
    Ok(word)
}

fn hex32_to_word(value: &str) -> Result<[u8; 32]> {
    let hex = value
        .strip_prefix("0x")
        .ok_or_else(|| anyhow!("bytes32 value must be 0x-prefixed"))?;
    let bytes = from_hex_exact(hex, 32, "bytes32")?;
    let mut word = [0_u8; 32];
    word.copy_from_slice(&bytes);
    Ok(word)
}

fn u64_to_u256(value: u64) -> [u8; 32] {
    let mut word = [0_u8; 32];
    word[24..].copy_from_slice(&value.to_be_bytes());
    word
}

fn decimal_to_u256(value: &str) -> Result<[u8; 32]> {
    let trimmed = value.trim();
    if trimmed.is_empty() || !trimmed.bytes().all(|byte| byte.is_ascii_digit()) {
        bail!("uint256 value must be a decimal integer string");
    }
    let mut word = [0_u8; 32];
    for digit in trimmed.bytes() {
        multiply_u256_small(&mut word, 10)?;
        add_u256_small(&mut word, digit - b'0')?;
    }
    Ok(word)
}

fn multiply_u256_small(word: &mut [u8; 32], factor: u16) -> Result<()> {
    let mut carry = 0_u16;
    for byte in word.iter_mut().rev() {
        let next = (*byte as u16) * factor + carry;
        *byte = (next & 0xff) as u8;
        carry = next >> 8;
    }
    if carry != 0 {
        bail!("uint256 value is too large");
    }
    Ok(())
}

fn add_u256_small(word: &mut [u8; 32], addend: u8) -> Result<()> {
    let mut carry = addend as u16;
    for byte in word.iter_mut().rev() {
        let next = (*byte as u16) + carry;
        *byte = (next & 0xff) as u8;
        carry = next >> 8;
        if carry == 0 {
            return Ok(());
        }
    }
    bail!("uint256 value is too large")
}

fn normalized_address_hex(address: &str) -> Result<String> {
    let hex = address
        .strip_prefix("0x")
        .or_else(|| address.strip_prefix("0X"))
        .unwrap_or(address);
    if hex.len() != 40 || !hex.bytes().all(is_hex_byte) {
        bail!("address must be 20 bytes as 40 hex chars, with optional 0x prefix");
    }
    Ok(hex.to_ascii_lowercase())
}

fn is_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    for (index, byte) in bytes.iter().enumerate() {
        if matches!(index, 8 | 13 | 18 | 23) {
            if *byte != b'-' {
                return false;
            }
        } else if !is_hex_byte(*byte) {
            return false;
        }
    }
    true
}

fn is_wire_interaction_id(value: &str) -> bool {
    let Some((local, domain)) = value.split_once('@') else {
        return false;
    };
    is_uuid(local)
        && !domain.is_empty()
        && !domain
            .bytes()
            .any(|byte| byte.is_ascii_whitespace() || byte == b'@')
}

fn is_hex_byte(byte: u8) -> bool {
    byte.is_ascii_hexdigit()
}

fn decode_hex_into(hex: &str, output: &mut [u8]) -> Result<()> {
    if hex.len() != output.len() * 2 {
        bail!("hex length does not match output length");
    }
    for (index, chunk) in hex.as_bytes().chunks_exact(2).enumerate() {
        output[index] = (hex_nibble(chunk[0])? << 4) | hex_nibble(chunk[1])?;
    }
    Ok(())
}

fn from_hex_exact(hex: &str, expected_len: usize, label: &str) -> Result<Vec<u8>> {
    let bytes = from_hex(hex)?;
    if bytes.len() != expected_len {
        bail!("{label} must be {} hex chars", expected_len * 2);
    }
    Ok(bytes)
}

fn from_hex(hex: &str) -> Result<Vec<u8>> {
    if !hex.len().is_multiple_of(2) {
        bail!("invalid hex: odd length");
    }
    let mut out = Vec::with_capacity(hex.len() / 2);
    for pair in hex.as_bytes().chunks_exact(2) {
        out.push((hex_nibble(pair[0])? << 4) | hex_nibble(pair[1])?);
    }
    Ok(out)
}

fn hex_nibble(byte: u8) -> Result<u8> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => bail!("invalid hex character"),
    }
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

fn keccak256(input: &[u8]) -> [u8; 32] {
    const RATE: usize = 136;
    let mut state = [0_u64; 25];
    let mut chunks = input.chunks_exact(RATE);
    for block in &mut chunks {
        absorb_block(&mut state, block);
        keccak_f1600(&mut state);
    }

    let remainder = chunks.remainder();
    let mut block = [0_u8; RATE];
    block[..remainder.len()].copy_from_slice(remainder);
    block[remainder.len()] ^= 0x01;
    block[RATE - 1] ^= 0x80;
    absorb_block(&mut state, &block);
    keccak_f1600(&mut state);

    let mut out = [0_u8; 32];
    for (index, chunk) in out.chunks_exact_mut(8).enumerate() {
        chunk.copy_from_slice(&state[index].to_le_bytes());
    }
    out
}

fn absorb_block(state: &mut [u64; 25], block: &[u8]) {
    for (index, chunk) in block.chunks_exact(8).enumerate() {
        let mut lane = [0_u8; 8];
        lane.copy_from_slice(chunk);
        state[index] ^= u64::from_le_bytes(lane);
    }
}

fn keccak_f1600(state: &mut [u64; 25]) {
    const ROUNDS: [u64; 24] = [
        0x0000000000000001,
        0x0000000000008082,
        0x800000000000808a,
        0x8000000080008000,
        0x000000000000808b,
        0x0000000080000001,
        0x8000000080008081,
        0x8000000000008009,
        0x000000000000008a,
        0x0000000000000088,
        0x0000000080008009,
        0x000000008000000a,
        0x000000008000808b,
        0x800000000000008b,
        0x8000000000008089,
        0x8000000000008003,
        0x8000000000008002,
        0x8000000000000080,
        0x000000000000800a,
        0x800000008000000a,
        0x8000000080008081,
        0x8000000000008080,
        0x0000000080000001,
        0x8000000080008008,
    ];
    const ROTATION: [u32; 25] = [
        0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56,
        14,
    ];
    const PILN: [usize; 25] = [
        0, 10, 20, 5, 15, 16, 1, 11, 21, 6, 7, 17, 2, 12, 22, 23, 8, 18, 3, 13, 14, 24, 9, 19, 4,
    ];

    for round_constant in ROUNDS {
        let mut c = [0_u64; 5];
        for x in 0..5 {
            c[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
        }
        for x in 0..5 {
            let d = c[(x + 4) % 5] ^ c[(x + 1) % 5].rotate_left(1);
            for y in (0..25).step_by(5) {
                state[x + y] ^= d;
            }
        }

        let mut rotated = [0_u64; 25];
        for index in 0..25 {
            rotated[PILN[index]] = state[index].rotate_left(ROTATION[index]);
        }

        for y in (0..25).step_by(5) {
            for x in 0..5 {
                state[y + x] =
                    rotated[y + x] ^ ((!rotated[y + ((x + 1) % 5)]) & rotated[y + ((x + 2) % 5)]);
            }
        }

        state[0] ^= round_constant;
    }
}
