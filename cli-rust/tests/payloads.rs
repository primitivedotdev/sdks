pub mod config {
    use std::collections::BTreeMap;

    pub struct ResolvedAuth {
        pub api_key: Option<String>,
        pub api_base_url: String,
    }

    pub fn config_dir() -> std::path::PathBuf {
        std::env::var("PRIMITIVE_CONFIG_DIR")
            .ok()
            .filter(|path| !path.trim().is_empty())
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::PathBuf::from(".primitive"))
    }

    pub fn env_no_proxy_wildcard() -> bool {
        std::env::var("no_proxy")
            .or_else(|_| std::env::var("NO_PROXY"))
            .is_ok_and(|value| value.split(',').any(|entry| entry.trim() == "*"))
    }

    pub fn resolve_auth(flags: &BTreeMap<String, String>) -> anyhow::Result<ResolvedAuth> {
        resolve_auth_without_refresh(flags)
    }

    pub fn resolve_auth_without_refresh(
        flags: &BTreeMap<String, String>,
    ) -> anyhow::Result<ResolvedAuth> {
        Ok(ResolvedAuth {
            api_key: flags
                .get("api-key")
                .cloned()
                .or_else(|| std::env::var("PRIMITIVE_API_KEY").ok()),
            api_base_url: flags
                .get("api-base-url")
                .cloned()
                .or_else(|| std::env::var("PRIMITIVE_API_BASE_URL").ok())
                .unwrap_or_else(|| "https://api.primitive.dev/v1".to_string()),
        })
    }
}

#[path = "../src/payloads.rs"]
pub mod payloads;

pub fn display_bin_name() -> String {
    "primitive-rust".to_string()
}

use payloads::{
    dispatch as dispatch_payloads, encode_manifest, payloads_help_text, EncodeManifestOptions,
    PayloadManifest,
};
use serde::Deserialize;
use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Vector {
    input: VectorInput,
    cek_hex: String,
    object_id_hex: String,
    chunk_size: usize,
    expected_manifest: PayloadManifest,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VectorInput {
    size_bytes: usize,
    recipe: String,
}

#[test]
fn reproduces_payloads_conformance_vector() {
    let vector = load_vector("conformance-vector.json");
    assert_eq!(vector.input.recipe, "byteAt(i) = (i * 31 + 7) & 0xff");
    let input = build_input(vector.input.size_bytes);
    let manifest = encode_manifest(
        &input,
        EncodeManifestOptions {
            chunk_size: Some(vector.chunk_size),
            cek_hex: Some(vector.cek_hex),
            object_id_hex: Some(vector.object_id_hex),
        },
    )
    .expect("encode manifest");

    assert_eq!(manifest, vector.expected_manifest);
}

#[test]
fn reproduces_zero_byte_payloads_conformance_vector() {
    let vector = load_vector("zero-byte-conformance-vector.json");
    assert_eq!(vector.input.recipe, "empty");
    let manifest = encode_manifest(
        &[],
        EncodeManifestOptions {
            chunk_size: Some(vector.chunk_size),
            cek_hex: Some(vector.cek_hex),
            object_id_hex: Some(vector.object_id_hex),
        },
    )
    .expect("encode zero-byte manifest");

    assert_eq!(manifest, vector.expected_manifest);
}

#[test]
fn payloads_leaf_help_documents_command_specific_flags() {
    let push = help_flag_tokens(&payloads_help_text(Some("payloads:push")));
    assert_eq!(
        push,
        expected_flags(&["--api-key", "--concurrency", "--quiet"])
    );
    assert!(!push.contains("--api-base-url"));
    assert!(!push.contains("--cek"));
    assert!(!push.contains("--out"));

    let pull = help_flag_tokens(&payloads_help_text(Some("payloads:pull")));
    assert_eq!(
        pull,
        expected_flags(&["--api-key", "--cek", "--out", "--quiet"])
    );
    assert!(!pull.contains("--api-base-url"));
    assert!(!pull.contains("--concurrency"));
}

#[test]
fn payloads_help_requests_return_before_argument_validation() {
    dispatch_payloads(&["push".to_string(), "--help".to_string()])
        .expect("help request should succeed");
}

fn help_flag_tokens(help: &str) -> BTreeSet<String> {
    let mut tokens = BTreeSet::new();
    for (index, _) in help.match_indices("--") {
        let token: String = help[index..]
            .chars()
            .take_while(|char| char.is_ascii_alphanumeric() || *char == '-')
            .collect();
        if token.len() > 2 {
            tokens.insert(token);
        }
    }
    tokens
}

fn expected_flags(values: &[&str]) -> BTreeSet<String> {
    values.iter().map(|value| (*value).to_string()).collect()
}

fn load_vector(name: &str) -> Vector {
    let path = fixture_path(name);
    let contents = fs::read_to_string(&path).expect("read vector fixture");
    serde_json::from_str(&contents).expect("parse vector fixture")
}

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("test-fixtures")
        .join("payloads")
        .join(name)
}

fn build_input(size: usize) -> Vec<u8> {
    (0..size)
        .map(|index| ((index * 31 + 7) & 0xff) as u8)
        .collect()
}
