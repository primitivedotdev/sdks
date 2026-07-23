use primitive_rust::x402::{
    address_from_private_key, build_exact_evm_payment_payload, build_payment_step_envelope,
    build_payout_registration_message, build_payout_registration_message_bytes, checksum_address,
    compute_payment_validity_window, derive_eip3009_nonce, parse_private_key,
    sign_payout_registration_message, sign_transfer_with_authorization,
    transfer_with_authorization_typed_data, usdc_to_base_units, validate_checksum_address,
    NonceBinding, PaymentValidityWindowParams, PayoutRegistrationMessageInput, TokenDomain,
    TransferAuthorization,
};
use serde_json::json;

const NORMATIVE_NONCE: &str = "0xc955a08812ab83f9e25c92e5162267b913957c3cc8678de1cf1449f77b516c6e";
const TEST_ADDRESS: &str = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const PAYOUT_SIGNATURE: &str = "0xdc3458886b30a1707d8f7520236fd7f540809655596dfaba074cf5497dd3a7142714e7904f50ee17c08616917353fbe2e2847ec9b796e4017189fa645aff9bc91b";
const TRANSFER_SIGNATURE: &str = "0x7b4900f43d7eca503136a94065a333144959683cc1d112352bcfa9eb007e83727316924e11486d35b2a3f16b561971cc3cd07bfd6c30d49b1f0da3ab7deab7e91c";

fn test_key() -> String {
    [
        "0xac0974bec39a17e3",
        "6ba4a6b4d238ff94",
        "4bacb478cbed5efc",
        "ae784d7bf4f2ff80",
    ]
    .join("")
}

fn canonical_binding() -> NonceBinding {
    NonceBinding {
        interaction_id: "a1b2c3d4-0000-0000-0000-000000000001@payer.example".to_string(),
        challenge_step_id: "f00dface-0000-0000-0000-0000000000aa".to_string(),
        challenge_nonce: "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
            .to_string(),
    }
}

fn authorization() -> TransferAuthorization {
    TransferAuthorization {
        from: "0x2222222222222222222222222222222222222222".to_string(),
        to: "0x1111111111111111111111111111111111111111".to_string(),
        value: "10000".to_string(),
        valid_after: "1".to_string(),
        valid_before: "99999".to_string(),
        nonce: NORMATIVE_NONCE.to_string(),
    }
}

#[test]
fn derives_eip3009_nonce_from_node_vector() {
    assert_eq!(
        derive_eip3009_nonce(&canonical_binding()).unwrap(),
        NORMATIVE_NONCE
    );

    let mut uppercase = canonical_binding();
    uppercase.interaction_id = uppercase.interaction_id.to_ascii_uppercase();
    uppercase.challenge_step_id = uppercase.challenge_step_id.to_ascii_uppercase();
    assert_eq!(derive_eip3009_nonce(&uppercase).unwrap(), NORMATIVE_NONCE);
}

#[test]
fn rejects_malformed_challenge_nonce() {
    let mut binding = canonical_binding();
    binding.challenge_nonce = "xyz".to_string();
    assert!(derive_eip3009_nonce(&binding).is_err());

    binding.challenge_nonce =
        "AABBCCDDEEFF00112233445566778899AABBCCDDEEFF00112233445566778899".to_string();
    assert!(derive_eip3009_nonce(&binding).is_err());
}

#[test]
fn converts_human_usdc_to_base_units() {
    assert_eq!(usdc_to_base_units("0.01").unwrap(), "10000");
    assert_eq!(usdc_to_base_units("1").unwrap(), "1000000");
    assert_eq!(usdc_to_base_units("001.2304").unwrap(), "1230400");
    assert_eq!(usdc_to_base_units(".000001").unwrap(), "1");
    assert_eq!(usdc_to_base_units("0.000000").unwrap(), "0");
    assert!(usdc_to_base_units("0.0000001").is_err());
    assert!(usdc_to_base_units("-1").is_err());
}

#[test]
fn parses_private_key_shape_and_range() {
    let key =
        parse_private_key("0x0000000000000000000000000000000000000000000000000000000000000001")
            .unwrap();
    assert_eq!(key.bytes()[31], 1);
    assert_eq!(
        key.to_hex(),
        "0x0000000000000000000000000000000000000000000000000000000000000001"
    );
    assert!(parse_private_key(
        "0x0000000000000000000000000000000000000000000000000000000000000000",
    )
    .is_err());
    assert!(parse_private_key(
        "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
    )
    .is_err());
    assert!(parse_private_key("0x1234").is_err());
}

#[test]
fn computes_eip55_checksum_addresses() {
    assert_eq!(
        checksum_address("0x52908400098527886e0f7030069857d2e4169ee7").unwrap(),
        "0x52908400098527886E0F7030069857D2E4169EE7"
    );
    assert_eq!(
        checksum_address("de709f2102306220921060314715629080e2fb77").unwrap(),
        "0xde709f2102306220921060314715629080e2fb77"
    );
    assert_eq!(
        validate_checksum_address("0x52908400098527886E0F7030069857D2E4169EE7").unwrap(),
        "0x52908400098527886E0F7030069857D2E4169EE7"
    );
    assert!(validate_checksum_address("0x52908400098527886e0F7030069857D2E4169EE7").is_err());
}

#[test]
fn computes_payment_validity_window_like_node() {
    let window = compute_payment_validity_window(PaymentValidityWindowParams {
        challenge_expires_at_sec: 2000,
        now_sec: 1000,
        settlement_margin_sec: Some(300),
        clock_skew_sec: Some(120),
        max_window_sec: None,
        min_headroom_sec: None,
        valid_before_sec: None,
        valid_after_sec: None,
        clamp: None,
    })
    .unwrap();
    assert_eq!(window.valid_after, 880);
    assert_eq!(window.valid_before, 2300);

    let tight = compute_payment_validity_window(PaymentValidityWindowParams {
        challenge_expires_at_sec: 1000,
        now_sec: 100_000,
        settlement_margin_sec: Some(60),
        clock_skew_sec: Some(60),
        max_window_sec: None,
        min_headroom_sec: None,
        valid_before_sec: None,
        valid_after_sec: None,
        clamp: None,
    })
    .unwrap();
    assert_eq!(tight.valid_before, 100_060);

    let rejected = compute_payment_validity_window(PaymentValidityWindowParams {
        challenge_expires_at_sec: 1600,
        now_sec: 1000,
        settlement_margin_sec: None,
        clock_skew_sec: None,
        max_window_sec: None,
        min_headroom_sec: None,
        valid_before_sec: Some(1005),
        valid_after_sec: None,
        clamp: Some(false),
    });
    assert!(rejected
        .unwrap_err()
        .to_string()
        .contains("settlement headroom"));
}

#[test]
fn builds_payout_registration_message_bytes() {
    let msg = build_payout_registration_message(&PayoutRegistrationMessageInput {
        org: "11111111-1111-4111-8111-111111111111".to_string(),
        address: "0xAbCdEf0000000000000000000000000000000000".to_string(),
        network: "base-sepolia".to_string(),
        issued_at: "2026-01-01T00:00:00.000Z".to_string(),
    });
    assert_eq!(
        msg,
        "Primitive x402 payout address authorization\n\nI authorize this address as a payout destination for my Primitive organization.\n\norg: 11111111-1111-4111-8111-111111111111\naddress: 0xabcdef0000000000000000000000000000000000\nnetwork: base-sepolia\nissued: 2026-01-01T00:00:00.000Z"
    );
    assert_eq!(msg.as_bytes()[0], b'P');
    let bytes = build_payout_registration_message_bytes(&PayoutRegistrationMessageInput {
        org: "11111111-1111-4111-8111-111111111111".to_string(),
        address: "0x2222222222222222222222222222222222222222".to_string(),
        network: "base-sepolia".to_string(),
        issued_at: "2026-01-01T00:00:00.000Z".to_string(),
    });
    assert_eq!(bytes[0], b'P');
}

#[test]
fn builds_eip3009_typed_data_shape() {
    let typed = transfer_with_authorization_typed_data(
        TokenDomain {
            name: "USDC".to_string(),
            version: "2".to_string(),
            chain_id: 84532,
            verifying_contract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".to_string(),
        },
        authorization(),
    );
    let value = serde_json::to_value(&typed).unwrap();
    assert_eq!(value["primaryType"], "TransferWithAuthorization");
    assert_eq!(value["domain"]["name"], "USDC");
    assert_eq!(value["domain"]["chainId"], 84532);
    assert_eq!(
        value["types"]["TransferWithAuthorization"],
        json!([
            { "name": "from", "type": "address" },
            { "name": "to", "type": "address" },
            { "name": "value", "type": "uint256" },
            { "name": "validAfter", "type": "uint256" },
            { "name": "validBefore", "type": "uint256" },
            { "name": "nonce", "type": "bytes32" }
        ])
    );
}

#[test]
fn builds_exact_evm_payment_payload_shape() {
    let signature = format!("0x{}", "ab".repeat(65));
    let payment =
        build_exact_evm_payment_payload("base-sepolia", authorization(), &signature).unwrap();
    let value = serde_json::to_value(&payment).unwrap();
    assert_eq!(value["x402Version"], 1);
    assert_eq!(value["scheme"], "exact");
    assert_eq!(value["network"], "base-sepolia");
    assert_eq!(value["payload"]["signature"], signature);
    assert_eq!(value["payload"]["authorization"]["value"], "10000");
    assert_eq!(value["payload"]["authorization"]["nonce"], NORMATIVE_NONCE);
}

#[test]
fn builds_payment_step_envelope_shape() {
    let signature = format!("0x{}", "ab".repeat(65));
    let payment =
        build_exact_evm_payment_payload("base-sepolia", authorization(), &signature).unwrap();
    let envelope = build_payment_step_envelope(
        "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
        "11111111-1111-4111-8111-111111111111",
        "f00dface-0000-0000-0000-0000000000aa",
        payment,
        None,
    )
    .unwrap();
    let value = serde_json::to_value(&envelope).unwrap();
    assert_eq!(value["interaction_version"], 1);
    assert_eq!(value["protocol"], "x402.payment");
    assert_eq!(value["protocol_version"], 1);
    assert_eq!(value["step"], "payment");
    assert_eq!(
        value["prev_step_id"],
        "f00dface-0000-0000-0000-0000000000aa"
    );
    assert_eq!(value["expires_at"], serde_json::Value::Null);
}

#[test]
fn derives_address_and_matches_viem_signatures() {
    let key = parse_private_key(&test_key()).unwrap();
    assert_eq!(address_from_private_key(&key).unwrap(), TEST_ADDRESS);
    let message_input = PayoutRegistrationMessageInput {
        org: "11111111-1111-4111-8111-111111111111".to_string(),
        address: "0x2222222222222222222222222222222222222222".to_string(),
        network: "base-sepolia".to_string(),
        issued_at: "2026-01-01T00:00:00.000Z".to_string(),
    };
    assert_eq!(
        sign_payout_registration_message(&key, &message_input).unwrap(),
        PAYOUT_SIGNATURE
    );

    let typed = transfer_with_authorization_typed_data(
        TokenDomain {
            name: "USDC".to_string(),
            version: "2".to_string(),
            chain_id: 84532,
            verifying_contract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e".to_string(),
        },
        authorization(),
    );
    assert_eq!(
        sign_transfer_with_authorization(&key, &typed).unwrap(),
        TRANSFER_SIGNATURE
    );
}
