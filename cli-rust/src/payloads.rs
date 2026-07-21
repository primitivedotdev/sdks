use aes_gcm::aead::{Aead, Payload};
use aes_gcm::{Aes256Gcm, KeyInit, Nonce};
use anyhow::{anyhow, Context, Result};
use hkdf::Hkdf;
use rand::{Rng, RngCore};
use reqwest::blocking::{Client, RequestBuilder, Response};
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

const CHUNK_SIZE: usize = 64 * 1024 * 1024;
const MANIFEST_VERSION: u8 = 1;
const CHUNK_KDF_INFO: &str = "payloads-chunk";
const OBJECT_ID_BYTES: usize = 16;
const CEK_BYTES: usize = 32;
const DEFAULT_CONCURRENCY: usize = 3;
const DEFAULT_MAX_RETRIES: usize = 6;
const RETRYABLE_STATUS: [u16; 5] = [429, 500, 502, 503, 504];
const USER_AGENT_VALUE: &str = concat!("primitive-rust/", env!("CARGO_PKG_VERSION"));

pub type ProgressFn = Arc<dyn Fn(ProgressPhase, u64, u64) + Send + Sync>;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProgressPhase {
    Encrypt,
    Upload,
    Download,
}

impl ProgressPhase {
    fn as_str(self) -> &'static str {
        match self {
            Self::Encrypt => "encrypt",
            Self::Upload => "upload",
            Self::Download => "download",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ChunkDescriptor {
    pub index: u64,
    pub ciphertext_hash: String,
    pub plaintext_size: u64,
    pub ciphertext_size: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PayloadManifest {
    pub version: u8,
    pub object_id: String,
    pub chunk_size: u64,
    pub total_plaintext_size: u64,
    pub chunk_count: u64,
    pub chunks: Vec<ChunkDescriptor>,
    pub merkle_root: String,
}

#[derive(Debug, Clone)]
pub struct PayloadClientOptions {
    pub base_url: String,
    pub api_key: String,
}

#[derive(Clone)]
pub struct PushOptions {
    pub client: PayloadClientOptions,
    pub chunk_size: usize,
    pub concurrency: usize,
    pub on_progress: Option<ProgressFn>,
}

impl PushOptions {
    pub fn new(client: PayloadClientOptions) -> Self {
        Self {
            client,
            chunk_size: CHUNK_SIZE,
            concurrency: DEFAULT_CONCURRENCY,
            on_progress: None,
        }
    }
}

#[derive(Clone)]
pub struct PullOptions {
    pub client: PayloadClientOptions,
    pub cek_hex: String,
    pub on_progress: Option<ProgressFn>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PushResult {
    pub merkle_root: String,
    pub cek: String,
    pub chunk_count: u64,
    pub total_bytes: u64,
}

pub fn dispatch(args: &[String]) -> Result<()> {
    let Some((command, rest)) = args.split_first() else {
        print_help(None);
        return Ok(());
    };
    match command.as_str() {
        "push" | "pull" if is_help_request(rest) => {
            print_help(Some(command.as_str()));
            Ok(())
        }
        "push" => run_push(rest),
        "pull" => run_pull(rest),
        "--help" | "-h" | "help" => {
            print_help(None);
            Ok(())
        }
        other => Err(anyhow!("Unknown payloads command `{other}`")),
    }
}

pub fn run_push(args: &[String]) -> Result<()> {
    let parsed = parse_args(
        args,
        &["api-base-url", "api-key", "concurrency"],
        &["quiet"],
    )?;
    let file = parsed
        .positionals
        .first()
        .ok_or_else(|| anyhow!("payloads push requires a file path"))?;
    if parsed.positionals.len() > 1 {
        return Err(anyhow!("Unexpected argument: {}", parsed.positionals[1]));
    }
    let client = resolve_client(&parsed.flags)?;
    let concurrency = parsed
        .flags
        .get("concurrency")
        .map(|value| parse_positive_usize("--concurrency", value))
        .transpose()?
        .unwrap_or(DEFAULT_CONCURRENCY);
    let quiet = parsed.bool_flags.get("quiet") == Some(&true);
    let mut options = PushOptions::new(client);
    options.concurrency = concurrency;
    options.on_progress = if quiet {
        None
    } else {
        Some(progress_to_stderr())
    };

    let result = push_file(file, options)?;
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "merkle_root": result.merkle_root,
            "cek": result.cek,
            "chunk_count": result.chunk_count,
            "total_bytes": result.total_bytes,
        }))?
    );
    Ok(())
}

pub fn run_pull(args: &[String]) -> Result<()> {
    let parsed = parse_args(args, &["api-base-url", "api-key", "cek", "out"], &["quiet"])?;
    let root = parsed
        .positionals
        .first()
        .ok_or_else(|| anyhow!("payloads pull requires a merkle_root"))?;
    if parsed.positionals.len() > 1 {
        return Err(anyhow!("Unexpected argument: {}", parsed.positionals[1]));
    }
    let out = parsed
        .flags
        .get("out")
        .ok_or_else(|| anyhow!("payloads pull requires --out"))?;
    let cek_hex = parsed
        .flags
        .get("cek")
        .ok_or_else(|| anyhow!("payloads pull requires --cek"))?;
    let client = resolve_client(&parsed.flags)?;
    let quiet = parsed.bool_flags.get("quiet") == Some(&true);
    let options = PullOptions {
        client,
        cek_hex: cek_hex.clone(),
        on_progress: if quiet {
            None
        } else {
            Some(progress_to_stderr())
        },
    };

    let manifest = pull_file(root, out, options)?;
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "merkle_root": root,
            "out": out,
            "chunk_count": manifest.chunk_count,
            "total_bytes": manifest.total_plaintext_size,
        }))?
    );
    Ok(())
}

pub fn push_file(path: impl AsRef<Path>, opts: PushOptions) -> Result<PushResult> {
    if opts.chunk_size == 0 {
        return Err(anyhow!("chunk_size must be greater than zero"));
    }
    let path = path.as_ref();
    let size = fs::metadata(path)
        .with_context(|| format!("Could not stat {}", path.display()))?
        .len();
    let chunk_count = chunk_count(size, opts.chunk_size as u64);
    let cek = random_bytes(CEK_BYTES);
    let object_id = random_bytes(OBJECT_ID_BYTES);

    let mut file =
        File::open(path).with_context(|| format!("Could not open {}", path.display()))?;
    let mut descriptors = Vec::with_capacity(chunk_count as usize);
    for index in 0..chunk_count {
        let position = index * opts.chunk_size as u64;
        let length = usize::try_from((size - position).min(opts.chunk_size as u64))
            .context("chunk length does not fit in memory")?;
        let plaintext = read_window(&mut file, position, length)?;
        let ciphertext = encrypt_chunk(&cek, &object_id, index, &plaintext)?;
        descriptors.push(ChunkDescriptor {
            index,
            ciphertext_hash: content_hash_hex(&ciphertext),
            plaintext_size: length as u64,
            ciphertext_size: ciphertext.len() as u64,
        });
        emit_progress(
            &opts.on_progress,
            ProgressPhase::Encrypt,
            index + 1,
            chunk_count,
        );
    }

    let root = merkle_root(
        &descriptors
            .iter()
            .map(|item| item.ciphertext_hash.as_str())
            .collect::<Vec<_>>(),
    )?;
    let manifest = PayloadManifest {
        version: MANIFEST_VERSION,
        object_id: to_hex(&object_id),
        chunk_size: opts.chunk_size as u64,
        total_plaintext_size: size,
        chunk_count,
        chunks: descriptors,
        merkle_root: root.clone(),
    };

    let http = http_client()?;
    initiate(&http, &opts.client, &manifest)?;
    upload_chunks(path, &opts, &http, &manifest, &cek, &object_id)?;
    finalize(&http, &opts.client, &root)?;

    Ok(PushResult {
        merkle_root: root,
        cek: to_hex(&cek),
        chunk_count,
        total_bytes: size,
    })
}

pub fn pull_file(
    root: &str,
    out_path: impl AsRef<Path>,
    opts: PullOptions,
) -> Result<PayloadManifest> {
    let out_path = out_path.as_ref();
    let http = http_client()?;
    let manifest = fetch_manifest(&http, &opts.client, root)?;
    let computed_root = merkle_root(
        &manifest
            .chunks
            .iter()
            .map(|item| item.ciphertext_hash.as_str())
            .collect::<Vec<_>>(),
    )?;
    if computed_root != root {
        return Err(anyhow!(
            "manifest does not match the requested content address (got {computed_root})"
        ));
    }
    let cek = from_hex_exact(&opts.cek_hex, CEK_BYTES, "cek")?;
    let object_id = from_hex_exact(&manifest.object_id, OBJECT_ID_BYTES, "objectId")?;
    let mut out = File::create(out_path)
        .with_context(|| format!("Could not create {}", out_path.display()))?;

    let result = (|| -> Result<()> {
        for (done, descriptor) in manifest.chunks.iter().enumerate() {
            let ciphertext = get_chunk_bytes(&http, &opts.client, root, descriptor)?;
            if content_hash_hex(&ciphertext) != descriptor.ciphertext_hash {
                return Err(anyhow!("chunk {} failed integrity check", descriptor.index));
            }
            let plaintext = decrypt_chunk(&cek, &object_id, descriptor.index, &ciphertext)?;
            out.write_all(&plaintext)?;
            emit_progress(
                &opts.on_progress,
                ProgressPhase::Download,
                done as u64 + 1,
                manifest.chunk_count,
            );
        }
        out.flush()?;
        Ok(())
    })();

    if let Err(error) = result {
        drop(out);
        let _ = fs::remove_file(out_path);
        return Err(error);
    }
    Ok(manifest)
}

pub fn encode_manifest(bytes: &[u8], opts: EncodeManifestOptions) -> Result<PayloadManifest> {
    let chunk_size = opts.chunk_size.unwrap_or(CHUNK_SIZE);
    if chunk_size == 0 {
        return Err(anyhow!("chunk_size must be greater than zero"));
    }
    let cek = match opts.cek_hex {
        Some(value) => from_hex_exact(&value, CEK_BYTES, "cek")?,
        None => random_bytes(CEK_BYTES),
    };
    let object_id = match opts.object_id_hex {
        Some(value) => from_hex_exact(&value, OBJECT_ID_BYTES, "objectId")?,
        None => random_bytes(OBJECT_ID_BYTES),
    };
    let chunk_count = if bytes.is_empty() {
        0
    } else {
        ((bytes.len() - 1) / chunk_size + 1) as u64
    };
    let mut descriptors = Vec::with_capacity(chunk_count as usize);
    for index in 0..chunk_count {
        let start = index as usize * chunk_size;
        let end = bytes.len().min(start + chunk_size);
        let plaintext = &bytes[start..end];
        let ciphertext = encrypt_chunk(&cek, &object_id, index, plaintext)?;
        descriptors.push(ChunkDescriptor {
            index,
            ciphertext_hash: content_hash_hex(&ciphertext),
            plaintext_size: plaintext.len() as u64,
            ciphertext_size: ciphertext.len() as u64,
        });
    }
    let merkle_root = merkle_root(
        &descriptors
            .iter()
            .map(|item| item.ciphertext_hash.as_str())
            .collect::<Vec<_>>(),
    )?;
    Ok(PayloadManifest {
        version: MANIFEST_VERSION,
        object_id: to_hex(&object_id),
        chunk_size: chunk_size as u64,
        total_plaintext_size: bytes.len() as u64,
        chunk_count,
        chunks: descriptors,
        merkle_root,
    })
}

#[derive(Debug, Clone, Default)]
pub struct EncodeManifestOptions {
    pub chunk_size: Option<usize>,
    pub cek_hex: Option<String>,
    pub object_id_hex: Option<String>,
}

fn upload_chunks(
    path: &Path,
    opts: &PushOptions,
    http: &Client,
    manifest: &PayloadManifest,
    cek: &[u8],
    object_id: &[u8],
) -> Result<()> {
    if manifest.chunks.is_empty() {
        return Ok(());
    }
    let worker_count = opts.concurrency.max(1).min(manifest.chunks.len());
    let next = Arc::new(Mutex::new(0usize));
    let failed = Arc::new(AtomicBool::new(false));
    let uploaded = Arc::new(AtomicU64::new(0));
    let chunks = Arc::new(manifest.chunks.clone());
    let cek = Arc::new(cek.to_vec());
    let object_id = Arc::new(object_id.to_vec());
    let root = manifest.merkle_root.clone();
    let chunk_size = manifest.chunk_size;
    let total = manifest.chunk_count;

    let mut first_error: Option<anyhow::Error> = None;
    thread::scope(|scope| {
        let mut handles = Vec::with_capacity(worker_count);
        for _ in 0..worker_count {
            let next = Arc::clone(&next);
            let failed = Arc::clone(&failed);
            let uploaded = Arc::clone(&uploaded);
            let chunks = Arc::clone(&chunks);
            let cek = Arc::clone(&cek);
            let object_id = Arc::clone(&object_id);
            let client = opts.client.clone();
            let progress = opts.on_progress.clone();
            let http = http.clone();
            let path = path.to_path_buf();
            let root = root.clone();
            handles.push(scope.spawn(move || -> Result<()> {
                let mut file = File::open(&path)
                    .with_context(|| format!("Could not open {}", path.display()))?;
                loop {
                    if failed.load(Ordering::Relaxed) {
                        return Ok(());
                    }
                    let descriptor = {
                        let mut guard = next.lock().expect("payload upload mutex poisoned");
                        if *guard >= chunks.len() {
                            return Ok(());
                        }
                        let item = chunks[*guard].clone();
                        *guard += 1;
                        item
                    };
                    let position = descriptor.index * chunk_size;
                    let plaintext = read_window(
                        &mut file,
                        position,
                        usize::try_from(descriptor.plaintext_size)
                            .context("chunk length does not fit in memory")?,
                    )?;
                    let ciphertext = encrypt_chunk(&cek, &object_id, descriptor.index, &plaintext)?;
                    put_chunk(&http, &client, &root, &descriptor, ciphertext)?;
                    let done = uploaded.fetch_add(1, Ordering::Relaxed) + 1;
                    emit_progress(&progress, ProgressPhase::Upload, done, total);
                }
            }));
        }
        for handle in handles {
            match handle.join() {
                Ok(Ok(())) => {}
                Ok(Err(error)) => {
                    failed.store(true, Ordering::Relaxed);
                    if first_error.is_none() {
                        first_error = Some(error);
                    }
                }
                Err(_) => {
                    failed.store(true, Ordering::Relaxed);
                    if first_error.is_none() {
                        first_error = Some(anyhow!("payload upload worker panicked"));
                    }
                }
            }
        }
    });
    if let Some(error) = first_error {
        return Err(error);
    }
    Ok(())
}

fn initiate(http: &Client, opts: &PayloadClientOptions, manifest: &PayloadManifest) -> Result<()> {
    let url = api_root(&opts.base_url);
    let body = serde_json::to_vec(&json!({ "manifest": manifest }))?;
    let res = retrying_send("initiate", || {
        authorized(http.post(&url), &opts.api_key)
            .header(CONTENT_TYPE, "application/json")
            .body(body.clone())
    })?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let text = res.text().unwrap_or_default();
        return Err(anyhow!("initiate failed: HTTP {status} {text}"));
    }
    drain(res);
    Ok(())
}

fn put_chunk(
    http: &Client,
    opts: &PayloadClientOptions,
    root: &str,
    descriptor: &ChunkDescriptor,
    bytes: Vec<u8>,
) -> Result<()> {
    let url = format!(
        "{}/{}/chunks/{}",
        api_root(&opts.base_url),
        root,
        descriptor.ciphertext_hash
    );
    let label = format!("chunk {} upload", descriptor.index);
    let res = retrying_send(&label, || {
        authorized(http.put(&url), &opts.api_key)
            .header(CONTENT_TYPE, "application/octet-stream")
            .body(bytes.clone())
    })?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let text = res.text().unwrap_or_default();
        return Err(anyhow!(
            "chunk {} upload failed: HTTP {status} {text}",
            descriptor.index
        ));
    }
    drain(res);
    Ok(())
}

fn finalize(http: &Client, opts: &PayloadClientOptions, root: &str) -> Result<()> {
    let url = format!("{}/{root}/finalize", api_root(&opts.base_url));
    let res = retrying_send("finalize", || authorized(http.post(&url), &opts.api_key))?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let text = res.text().unwrap_or_default();
        return Err(anyhow!("finalize failed: HTTP {status} {text}"));
    }
    drain(res);
    Ok(())
}

fn fetch_manifest(
    http: &Client,
    opts: &PayloadClientOptions,
    root: &str,
) -> Result<PayloadManifest> {
    let url = format!("{}/{root}/manifest", api_root(&opts.base_url));
    let res = retrying_send("get manifest", || authorized(http.get(&url), &opts.api_key))?;
    if !res.status().is_success() {
        let status = res.status().as_u16();
        let text = res.text().unwrap_or_default();
        return Err(anyhow!("get manifest failed: HTTP {status} {text}"));
    }
    let body: ManifestEnvelope = res.json()?;
    Ok(body.data.manifest)
}

fn get_chunk_bytes(
    http: &Client,
    opts: &PayloadClientOptions,
    root: &str,
    descriptor: &ChunkDescriptor,
) -> Result<Vec<u8>> {
    let url = format!(
        "{}/{}/chunks/{}",
        api_root(&opts.base_url),
        root,
        descriptor.ciphertext_hash
    );
    let label = format!("get chunk {}", descriptor.index);
    let res = retrying_send(&label, || authorized(http.get(&url), &opts.api_key))?;
    if !res.status().is_success() {
        return Err(anyhow!(
            "get chunk {} failed: HTTP {}",
            descriptor.index,
            res.status().as_u16()
        ));
    }
    Ok(res.bytes()?.to_vec())
}

#[derive(Debug, Deserialize)]
struct ManifestEnvelope {
    data: ManifestData,
}

#[derive(Debug, Deserialize)]
struct ManifestData {
    manifest: PayloadManifest,
}

fn retrying_send<F>(label: &str, build: F) -> Result<Response>
where
    F: Fn() -> RequestBuilder,
{
    for attempt in 0..=DEFAULT_MAX_RETRIES {
        let response = build().send();
        match response {
            Ok(res) if !RETRYABLE_STATUS.contains(&res.status().as_u16()) => return Ok(res),
            Ok(res) if attempt >= DEFAULT_MAX_RETRIES => return Ok(res),
            Ok(res) => {
                drain(res);
            }
            Err(error) if attempt >= DEFAULT_MAX_RETRIES => {
                return Err(anyhow!(
                    "{label}: network error after {attempt} retries: {error}"
                ));
            }
            Err(_) => {}
        }
        let jitter_ms: u64 = rand::thread_rng().gen_range(0..250);
        let backoff_ms =
            (1000u64.saturating_mul(2u64.saturating_pow(attempt as u32))).min(15_000) + jitter_ms;
        thread::sleep(Duration::from_millis(backoff_ms));
    }
    unreachable!("retry loop always returns")
}

fn drain(response: Response) {
    let _ = response.text();
}

fn authorized(request: RequestBuilder, api_key: &str) -> RequestBuilder {
    request.header(AUTHORIZATION, format!("Bearer {api_key}"))
}

fn http_client() -> Result<Client> {
    let mut builder = Client::builder().user_agent(USER_AGENT_VALUE);
    // Local copy of client::env_no_proxy_wildcard: this module is compiled
    // standalone by the include-style integration tests, which stub `config`
    // but not `client`. See client.rs for why NO_PROXY=* needs handling.
    let no_proxy_wildcard = ["NO_PROXY", "no_proxy"].iter().any(|name| {
        std::env::var(name).is_ok_and(|value| value.split(',').any(|entry| entry.trim() == "*"))
    });
    if no_proxy_wildcard {
        builder = builder.no_proxy();
    }
    builder.build().map_err(Into::into)
}

fn api_root(base_url: &str) -> String {
    let trimmed = base_url.trim_end_matches('/');
    let root = trimmed.strip_suffix("/v1").unwrap_or(trimmed);
    format!("{root}/v1/payloads")
}

fn encrypt_chunk(cek: &[u8], object_id: &[u8], index: u64, plaintext: &[u8]) -> Result<Vec<u8>> {
    let key = derive_chunk_key(cek, index)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| anyhow!("invalid AES-256 key"))?;
    cipher
        .encrypt(
            Nonce::from_slice(&chunk_nonce(index)),
            Payload {
                msg: plaintext,
                aad: &chunk_aad(object_id, index),
            },
        )
        .map_err(|_| anyhow!("chunk {index} encryption failed"))
}

fn decrypt_chunk(cek: &[u8], object_id: &[u8], index: u64, ciphertext: &[u8]) -> Result<Vec<u8>> {
    let key = derive_chunk_key(cek, index)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|_| anyhow!("invalid AES-256 key"))?;
    cipher
        .decrypt(
            Nonce::from_slice(&chunk_nonce(index)),
            Payload {
                msg: ciphertext,
                aad: &chunk_aad(object_id, index),
            },
        )
        .map_err(|_| anyhow!("chunk {index} decryption failed"))
}

fn derive_chunk_key(cek: &[u8], index: u64) -> Result<[u8; CEK_BYTES]> {
    if cek.len() != CEK_BYTES {
        return Err(anyhow!("cek must be {CEK_BYTES} bytes"));
    }
    let hk = Hkdf::<Sha256>::new(Some(&[0u8; 32]), cek);
    let mut out = [0u8; CEK_BYTES];
    hk.expand(format!("{CHUNK_KDF_INFO}:{index}").as_bytes(), &mut out)
        .map_err(|_| anyhow!("HKDF expansion failed"))?;
    Ok(out)
}

fn chunk_nonce(index: u64) -> [u8; 12] {
    let mut nonce = [0u8; 12];
    nonce[8..12].copy_from_slice(&(index as u32).to_be_bytes());
    nonce
}

fn chunk_aad(object_id: &[u8], index: u64) -> Vec<u8> {
    let mut aad = Vec::with_capacity(object_id.len() + 4);
    aad.extend_from_slice(object_id);
    aad.extend_from_slice(&(index as u32).to_be_bytes());
    aad
}

fn content_hash_hex(bytes: &[u8]) -> String {
    to_hex(&Sha256::digest(bytes))
}

fn merkle_root(leaf_hashes_hex: &[&str]) -> Result<String> {
    if leaf_hashes_hex.is_empty() {
        return Ok(content_hash_hex(&[]));
    }
    let mut level = leaf_hashes_hex
        .iter()
        .map(|hash| from_hex_exact(hash, 32, "leaf hash"))
        .collect::<Result<Vec<_>>>()?;
    while level.len() > 1 {
        let mut next = Vec::with_capacity(level.len().div_ceil(2));
        for pair in level.chunks(2) {
            let left = &pair[0];
            let right = if pair.len() == 2 { &pair[1] } else { &pair[0] };
            let mut combined = Vec::with_capacity(left.len() + right.len());
            combined.extend_from_slice(left);
            combined.extend_from_slice(right);
            next.push(Sha256::digest(&combined).to_vec());
        }
        level = next;
    }
    Ok(to_hex(&level[0]))
}

fn read_window(file: &mut File, position: u64, length: usize) -> Result<Vec<u8>> {
    let mut buf = vec![0u8; length];
    file.seek(SeekFrom::Start(position))?;
    let mut read = 0;
    while read < length {
        let n = file.read(&mut buf[read..])?;
        if n == 0 {
            break;
        }
        read += n;
    }
    buf.truncate(read);
    Ok(buf)
}

fn chunk_count(size: u64, chunk_size: u64) -> u64 {
    if size == 0 {
        0
    } else {
        ((size - 1) / chunk_size) + 1
    }
}

fn random_bytes(length: usize) -> Vec<u8> {
    let mut out = vec![0u8; length];
    let mut rng = rand::rngs::OsRng;
    rng.fill_bytes(&mut out);
    out
}

fn to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(nibble_to_hex(byte >> 4));
        out.push(nibble_to_hex(byte & 0x0f));
    }
    out
}

fn from_hex_exact(hex: &str, expected_len: usize, label: &str) -> Result<Vec<u8>> {
    let bytes = from_hex(hex)?;
    if bytes.len() != expected_len {
        return Err(anyhow!("{label} must be {} hex chars", expected_len * 2));
    }
    Ok(bytes)
}

fn from_hex(hex: &str) -> Result<Vec<u8>> {
    if !hex.len().is_multiple_of(2) {
        return Err(anyhow!("invalid hex: odd length"));
    }
    let mut out = Vec::with_capacity(hex.len() / 2);
    let bytes = hex.as_bytes();
    for pair in bytes.chunks(2) {
        let high = hex_value(pair[0])?;
        let low = hex_value(pair[1])?;
        out.push((high << 4) | low);
    }
    Ok(out)
}

fn nibble_to_hex(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        10..=15 => (b'a' + value - 10) as char,
        _ => unreachable!("nibble out of range"),
    }
}

fn hex_value(value: u8) -> Result<u8> {
    match value {
        b'0'..=b'9' => Ok(value - b'0'),
        b'a'..=b'f' => Ok(value - b'a' + 10),
        b'A'..=b'F' => Ok(value - b'A' + 10),
        _ => Err(anyhow!("invalid hex: non-hex character")),
    }
}

fn emit_progress(progress: &Option<ProgressFn>, phase: ProgressPhase, done: u64, total: u64) {
    if let Some(progress) = progress {
        progress(phase, done, total);
    }
}

fn progress_to_stderr() -> ProgressFn {
    let last_pct = Arc::new(Mutex::new(None::<u64>));
    Arc::new(move |phase, done, total| {
        let pct = done.saturating_mul(100).checked_div(total).unwrap_or(100);
        let mut last = last_pct.lock().expect("progress mutex poisoned");
        if *last != Some(pct) {
            *last = Some(pct);
            eprint!("\r{}: {done}/{total} ({pct}%)   ", phase.as_str());
            if done == total {
                eprintln!();
            }
        }
    })
}

#[derive(Debug, Default)]
struct ParsedArgs {
    flags: BTreeMap<String, String>,
    bool_flags: BTreeMap<String, bool>,
    positionals: Vec<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum FlagKind {
    Value,
    Bool,
}

fn parse_args(args: &[String], value_flags: &[&str], bool_flags: &[&str]) -> Result<ParsedArgs> {
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
            return Err(anyhow!("Nonexistent flag: --no-{name}"));
        }
        let raw = arg.trim_start_matches("--");
        if let Some((name, value)) = raw.split_once('=') {
            match flag_kind(name, value_flags, bool_flags) {
                Some(FlagKind::Value) => {
                    parsed.flags.insert(name.to_string(), value.to_string());
                }
                Some(FlagKind::Bool) => {
                    parsed
                        .bool_flags
                        .insert(name.to_string(), parse_bool_flag_value(name, value)?);
                }
                None => return Err(anyhow!("Nonexistent flag: --{name}")),
            }
            index += 1;
            continue;
        }
        let name = raw.to_string();
        match flag_kind(&name, value_flags, bool_flags) {
            Some(FlagKind::Bool) => {
                parsed.bool_flags.insert(name, true);
                index += 1;
            }
            Some(FlagKind::Value) => {
                if index + 1 >= args.len() || args[index + 1].starts_with("--") {
                    return Err(anyhow!("Flag --{name} expects a value"));
                }
                parsed.flags.insert(name, args[index + 1].clone());
                index += 2;
            }
            None => return Err(anyhow!("Nonexistent flag: --{name}")),
        }
    }
    Ok(parsed)
}

fn flag_kind(name: &str, value_flags: &[&str], bool_flags: &[&str]) -> Option<FlagKind> {
    if value_flags.contains(&name) {
        Some(FlagKind::Value)
    } else if bool_flags.contains(&name) {
        Some(FlagKind::Bool)
    } else {
        None
    }
}

fn parse_bool_flag_value(name: &str, value: &str) -> Result<bool> {
    value
        .parse()
        .with_context(|| format!("Expected a boolean for --{name}"))
}

fn parse_positive_usize(name: &str, value: &str) -> Result<usize> {
    let parsed: usize = value
        .parse()
        .with_context(|| format!("Expected an integer for {name}"))?;
    if parsed == 0 {
        return Err(anyhow!("{name} must be greater than zero"));
    }
    Ok(parsed)
}

fn resolve_client(flags: &BTreeMap<String, String>) -> Result<PayloadClientOptions> {
    let auth = crate::config::resolve_auth_without_refresh(flags)?;
    let api_key = auth.api_key.ok_or_else(|| {
        anyhow!(
            "Not authenticated: set PRIMITIVE_API_KEY, pass --api-key, or run `primitive login`."
        )
    })?;
    Ok(PayloadClientOptions {
        base_url: auth.api_base_url,
        api_key,
    })
}

pub fn payloads_help_text(command: Option<&str>) -> String {
    let bin = crate::display_bin_name();
    match command.and_then(payload_command_kind) {
        Some(PayloadCommandKind::Push) => format!(
            "Stream-upload a file as an encrypted payload\n\
             \n\
             USAGE\n\
               $ {bin} payloads push FILE [--api-key <value>] [--concurrency <value>] [--quiet]\n\
             \n\
             ARGUMENTS\n\
               FILE  Path to the file to upload\n\
             \n\
             FLAGS\n\
               --api-key=<value>      [env: PRIMITIVE_API_KEY] Primitive API key (defaults to\n\
                                      PRIMITIVE_API_KEY or saved login credentials)\n\
               --concurrency=<value>  [default: 3] Parallel chunk uploads\n\
               --quiet                Suppress progress output\n\
             \n\
             DESCRIPTION\n\
               Stream-upload a file as an encrypted payload\n\
             \n\
               Upload a file as a Primitive Payload \u{2014} a large, content-addressed,\n\
               end-to-end-encrypted object.\n\
             \n\
               The file is chunked and encrypted client-side and streamed up in bounded\n\
               memory (multi-GB files never load fully into RAM). Prints the object's content\n\
               address (merkle_root) and the hex CEK required to download it \u{2014} keep the CEK\n\
               secret; without it the object cannot be decrypted.\n\
             \n\
             EXAMPLES\n\
               $ {bin} payloads push ./big-video.mp4\n"
        ),
        Some(PayloadCommandKind::Pull) => format!(
            "Stream-download and decrypt a payload to a file\n\
             \n\
             USAGE\n\
               $ {bin} payloads pull ROOT --out <value> --cek <value> [--api-key <value>] [--quiet]\n\
             \n\
             ARGUMENTS\n\
               ROOT  Object content address (merkle_root)\n\
             \n\
             FLAGS\n\
               --api-key=<value>  [env: PRIMITIVE_API_KEY] Primitive API key (defaults to\n\
                                  PRIMITIVE_API_KEY or saved login credentials)\n\
               --cek=<value>      (required) Hex content-encryption key from `payloads push`\n\
               --out=<value>      (required) Output file path\n\
               --quiet            Suppress progress output\n\
             \n\
             DESCRIPTION\n\
               Stream-download and decrypt a payload to a file\n\
             \n\
               Download and decrypt a Primitive Payload to a file.\n\
             \n\
               Streams one chunk at a time, verifying each against its content address before\n\
               decryption, so a corrupt or substituted chunk fails loudly. Requires the hex\n\
               CEK printed by `payloads push`.\n\
             \n\
             EXAMPLES\n\
               $ {bin} payloads pull <merkle_root> --cek <hex> --out ./restored.mp4\n"
        ),
        None => format!(
            "Stream-download and decrypt a payload to a file\n\
             \n\
             USAGE\n\
               $ {bin} payloads COMMAND\n\
             \n\
             COMMANDS\n\
               payloads pull  Stream-download and decrypt a payload to a file\n\
               payloads push  Stream-upload a file as an encrypted payload\n"
        ),
    }
}

fn print_help(command: Option<&str>) {
    print!("{}", payloads_help_text(command));
}

fn is_help_request(args: &[String]) -> bool {
    args.iter()
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PayloadCommandKind {
    Push,
    Pull,
}

fn payload_command_kind(command: &str) -> Option<PayloadCommandKind> {
    let normalized = command.split_whitespace().collect::<Vec<_>>().join(":");
    let command = normalized
        .strip_prefix("payloads:")
        .unwrap_or(normalized.as_str());
    match command {
        "push" => Some(PayloadCommandKind::Push),
        "pull" => Some(PayloadCommandKind::Pull),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn payloads_push_parser_rejects_unknown_flags() {
        let error = run_push(&args(&["file.txt", "--bogus", "value"]))
            .expect_err("push should reject unknown flags before auth resolution");

        assert!(error.to_string().contains("Nonexistent flag: --bogus"));
    }

    #[test]
    fn payloads_pull_parser_rejects_unknown_flags() {
        let error = run_pull(&args(&[
            "root",
            "--cek",
            "00",
            "--out",
            "payload.bin",
            "--bogus=value",
        ]))
        .expect_err("pull should reject unknown flags before auth resolution");

        assert!(error.to_string().contains("Nonexistent flag: --bogus"));
    }

    #[test]
    fn payloads_parser_rejects_missing_value_flags() {
        let push_error = run_push(&args(&["file.txt", "--concurrency"]))
            .expect_err("push should reject missing concurrency value");
        assert!(push_error
            .to_string()
            .contains("Flag --concurrency expects a value"));

        let pull_error =
            run_pull(&args(&["root", "--cek"])).expect_err("pull should reject missing cek value");
        assert!(pull_error
            .to_string()
            .contains("Flag --cek expects a value"));
    }

    #[test]
    fn payloads_parser_accepts_documented_flags_and_boolean_values() {
        let push = parse_args(
            &args(&[
                "file.txt",
                "--api-key=key",
                "--api-base-url",
                "https://api.example.test/v1",
                "--concurrency",
                "2",
                "--quiet=false",
            ]),
            &["api-base-url", "api-key", "concurrency"],
            &["quiet"],
        )
        .expect("push flags should parse");

        assert_eq!(push.positionals, vec!["file.txt"]);
        assert_eq!(push.flags.get("api-key").map(String::as_str), Some("key"));
        assert_eq!(push.flags.get("concurrency").map(String::as_str), Some("2"));
        assert_eq!(push.bool_flags.get("quiet"), Some(&false));

        let pull = parse_args(
            &args(&["root", "--cek", "00", "--out=payload.bin", "--quiet"]),
            &["api-base-url", "api-key", "cek", "out"],
            &["quiet"],
        )
        .expect("pull flags should parse");

        assert_eq!(pull.positionals, vec!["root"]);
        assert_eq!(pull.flags.get("cek").map(String::as_str), Some("00"));
        assert_eq!(
            pull.flags.get("out").map(String::as_str),
            Some("payload.bin")
        );
        assert_eq!(pull.bool_flags.get("quiet"), Some(&true));
    }

    #[test]
    fn payloads_help_requests_return_before_argument_validation() {
        dispatch(&args(&["push", "--help", "--json"]))
            .expect("push help should bypass flag validation");
        dispatch(&args(&["pull", "--help", "--json"]))
            .expect("pull help should bypass flag validation");
        dispatch(&args(&["--help", "--json"])).expect("top-level help should bypass validation");
    }
}
