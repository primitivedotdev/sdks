use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, SecondsFormat, Utc};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE, USER_AGENT};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[cfg(unix)]
use std::os::unix::fs::{DirBuilderExt, OpenOptionsExt, PermissionsExt};

const DEFAULT_API_BASE_URL: &str = "https://api.primitive.dev/v1";
const DEFAULT_ENVIRONMENT: &str = "default";
const API_HEADERS_ENV: &str = "PRIMITIVE_API_HEADERS";
pub const CREDENTIALS_REMOVED_NOTICE: &str =
    "Removed saved Primitive CLI credentials. Run `primitive signin` to authenticate in the active environment.";
const CREDENTIALS_FILE: &str = "credentials.json";
const CHAT_STATE_FILE: &str = "chat-state.json";
const CREDENTIALS_LOCK_DIR: &str = "credentials.lock";
const CREDENTIALS_LOCK_OWNER_FILE: &str = "owner.json";
const CREDENTIALS_LOCK_STALE: Duration = Duration::from_secs(30 * 60);
const OAUTH_REFRESH_SKEW: Duration = Duration::from_secs(60);
const USER_AGENT_VALUE: &str = concat!("primitive-rust/", env!("CARGO_PKG_VERSION"));
const SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE: &str =
    "Saved Primitive CLI OAuth session expired or was revoked. Run `primitive signin` to authenticate again.";
const MALFORMED_CREDENTIALS_HINT: &str = "Run `primitive logout` and then `primitive signin`.";
const LEGACY_API_KEY_CREDENTIALS_REMOVED_MESSAGE: &str = "Removed local Primitive CLI API-key login state. API keys are still valid when passed explicitly, but saved CLI auth now uses OAuth. Run `primitive signin` to create an OAuth session. No API key was revoked.";
const PRIMITIVE_KEY_RENAME_HINT: &str = "PRIMITIVE_KEY is set but the CLI reads PRIMITIVE_API_KEY. Rename your env var, or re-run with PRIMITIVE_API_KEY=$PRIMITIVE_KEY.";

#[derive(Debug, Clone)]
pub struct ResolvedAuth {
    pub api_key: Option<String>,
    pub api_base_url: String,
    pub headers: BTreeMap<String, String>,
    pub config_dir: PathBuf,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedRootRequestConfig {
    pub api_base_url: String,
    pub headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConfigMutationResult {
    pub environment: String,
    pub removed_credentials: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct StoredConfig {
    version: u8,
    current_environment: Option<String>,
    #[serde(default)]
    environments: BTreeMap<String, EnvironmentConfig>,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
struct EnvironmentConfig {
    api_base_url: Option<String>,
    #[serde(default)]
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    headers: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Credentials {
    auth_method: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
    token_type: Option<String>,
    expires_at: Option<String>,
    oauth_grant_id: Option<String>,
    oauth_client_id: Option<String>,
    org_id: Option<String>,
    org_name: Option<String>,
    api_base_url: Option<String>,
    api_base_url_1: Option<String>,
    api_base_url_2: Option<String>,
    created_at: Option<String>,
}

impl Credentials {
    fn api_base_url(&self) -> Option<String> {
        self.api_base_url
            .clone()
            .or_else(|| self.api_base_url_2.clone())
            .or_else(|| self.api_base_url_1.clone())
    }
}

pub fn config_dir() -> PathBuf {
    if let Ok(path) = std::env::var("PRIMITIVE_CONFIG_DIR") {
        if !path.is_empty() {
            return PathBuf::from(path);
        }
    }
    if let Ok(path) = std::env::var("XDG_CONFIG_HOME") {
        if !path.is_empty() {
            return PathBuf::from(path).join("primitive");
        }
    }
    dirs::home_dir()
        .map(|path| path.join(".config").join("primitive"))
        .unwrap_or_else(|| PathBuf::from(".config").join("primitive"))
}

pub fn ensure_private_config_dir(config_dir: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        let mut builder = fs::DirBuilder::new();
        builder.recursive(true).mode(0o700);
        builder
            .create(config_dir)
            .with_context(|| format!("Could not create {}", config_dir.display()))?;
        fs::set_permissions(config_dir, fs::Permissions::from_mode(0o700))
            .with_context(|| format!("Could not secure {}", config_dir.display()))?;
    }

    #[cfg(not(unix))]
    {
        fs::create_dir_all(config_dir)
            .with_context(|| format!("Could not create {}", config_dir.display()))?;
    }

    Ok(())
}

pub fn write_private_file_atomic(path: &Path, contents: impl AsRef<[u8]>) -> Result<()> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| {
            anyhow!(
                "Cannot write {} without a parent directory.",
                path.display()
            )
        })?;
    ensure_private_config_dir(parent)?;

    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| anyhow!("Cannot write path without a file name: {}", path.display()))?;
    let temp_path = parent.join(format!(
        "{file_name}.{}.{}.tmp",
        std::process::id(),
        temporary_file_nonce()
    ));

    let write_result = (|| -> Result<()> {
        let mut options = fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            options.mode(0o600);
        }
        let mut file = options
            .open(&temp_path)
            .with_context(|| format!("Could not write {}", temp_path.display()))?;
        file.write_all(contents.as_ref())
            .with_context(|| format!("Could not write {}", temp_path.display()))?;
        file.sync_all()
            .with_context(|| format!("Could not sync {}", temp_path.display()))?;
        drop(file);
        #[cfg(unix)]
        {
            fs::set_permissions(&temp_path, fs::Permissions::from_mode(0o600))
                .with_context(|| format!("Could not secure {}", temp_path.display()))?;
        }
        fs::rename(&temp_path, path)
            .with_context(|| format!("Could not write {}", path.display()))?;
        #[cfg(unix)]
        {
            fs::set_permissions(path, fs::Permissions::from_mode(0o600))
                .with_context(|| format!("Could not secure {}", path.display()))?;
        }
        Ok(())
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    write_result
}

fn temporary_file_nonce() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}

pub fn normalize_api_base_url(value: Option<&str>) -> String {
    let raw = value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_API_BASE_URL)
        .trim_end_matches('/')
        .to_string();

    if let Ok(mut parsed) = reqwest::Url::parse(&raw) {
        let path = parsed.path().trim_end_matches('/').to_string();
        if path == "/api/v1" {
            if matches!(
                parsed.host_str(),
                Some("primitive.dev" | "www.primitive.dev")
            ) {
                let _ = parsed.set_host(Some("api.primitive.dev"));
                parsed.set_path("/v1");
                return parsed.as_str().trim_end_matches('/').to_string();
            }
            if matches!(parsed.host_str(), Some("primitive-staging-1.com")) {
                let _ = parsed.set_host(Some("api.primitive-staging-1.com"));
                parsed.set_path("/v1");
                return parsed.as_str().trim_end_matches('/').to_string();
            }
        }
    }

    raw
}

pub fn resolve_root_request_config(
    config_dir: &Path,
    env_api_base_url: Option<&str>,
) -> Result<Option<ResolvedRootRequestConfig>> {
    let stored_config = load_config(config_dir)?;
    let environment = stored_config
        .as_ref()
        .and_then(resolve_config_environment_entry);
    let explicit_base_url = trimmed_non_empty_string(env_api_base_url);
    let configured_base_url =
        environment.and_then(|item| trimmed_non_empty_string(item.config.api_base_url.as_deref()));

    if let Some(item) = environment {
        if item.name != DEFAULT_ENVIRONMENT
            && explicit_base_url.is_none()
            && configured_base_url.is_none()
        {
            return Ok(None);
        }
    }

    Ok(Some(ResolvedRootRequestConfig {
        api_base_url: normalize_api_base_url(explicit_base_url.or(configured_base_url).as_deref()),
        headers: environment
            .map(|item| item.config.headers.clone())
            .unwrap_or_default(),
    }))
}

pub fn resolve_request_config(
    config_dir: &Path,
    env_api_base_url: Option<&str>,
) -> Result<ResolvedRootRequestConfig> {
    let stored_config = load_config(config_dir)?;
    let environment = stored_config
        .as_ref()
        .and_then(resolve_config_environment_entry);
    let explicit_base_url = trimmed_non_empty_string(env_api_base_url);
    let configured_base_url =
        environment.and_then(|item| trimmed_non_empty_string(item.config.api_base_url.as_deref()));

    if let Some(item) = environment {
        if item.name != DEFAULT_ENVIRONMENT
            && explicit_base_url.is_none()
            && configured_base_url.is_none()
        {
            return Err(missing_non_default_environment_api_base_url_error(
                item.name,
            ));
        }
    }

    let mut headers = environment
        .map(|item| item.config.headers.clone())
        .unwrap_or_default();
    headers.extend(api_headers_from_env()?);
    Ok(ResolvedRootRequestConfig {
        api_base_url: normalize_api_base_url(explicit_base_url.or(configured_base_url).as_deref()),
        headers,
    })
}

pub fn resolve_auth(flags: &BTreeMap<String, String>) -> Result<ResolvedAuth> {
    resolve_auth_with_options(flags, true, true)
}

pub fn resolve_auth_without_refresh(flags: &BTreeMap<String, String>) -> Result<ResolvedAuth> {
    resolve_auth_with_options(flags, true, false)
}

fn resolve_auth_with_options(
    flags: &BTreeMap<String, String>,
    include_env_api_key: bool,
    refresh_saved_credentials: bool,
) -> Result<ResolvedAuth> {
    let config_dir = config_dir();
    let stored_config = load_config(&config_dir)?;
    let environment = stored_config
        .as_ref()
        .and_then(resolve_config_environment_entry);

    let flag_or_env_api_key = if include_env_api_key {
        flag_api_key(flags).or_else(env_api_key)
    } else {
        flag_api_key(flags)
    };

    let explicit_base_url = trimmed_non_empty_string(flags.get("api-base-url").map(String::as_str))
        .or_else(|| env_non_empty("PRIMITIVE_API_BASE_URL"));
    let configured_base_url =
        environment.and_then(|item| trimmed_non_empty_string(item.config.api_base_url.as_deref()));
    if let Some(item) = environment {
        if item.name != DEFAULT_ENVIRONMENT
            && explicit_base_url.is_none()
            && configured_base_url.is_none()
        {
            return Err(missing_non_default_environment_api_base_url_error(
                item.name,
            ));
        }
    }
    let non_credential_base_url = explicit_base_url.or(configured_base_url);
    let mut headers = environment
        .map(|item| item.config.headers.clone())
        .unwrap_or_default();
    headers.extend(api_headers_from_env()?);
    let credentials = if flag_or_env_api_key.is_none() {
        load_credentials(&config_dir)?
            .map(|credentials| {
                if refresh_saved_credentials {
                    refresh_credentials_if_needed(
                        &config_dir,
                        credentials,
                        &non_credential_base_url,
                        &headers,
                    )
                } else {
                    Ok(credentials)
                }
            })
            .transpose()?
    } else {
        None
    };
    let api_key = flag_or_env_api_key.or_else(|| {
        credentials
            .as_ref()
            .and_then(|item| item.access_token.clone())
    });
    if api_key.is_none()
        && env_non_empty("PRIMITIVE_API_KEY").is_none()
        && env_non_empty("PRIMITIVE_KEY").is_some()
    {
        eprintln!("{PRIMITIVE_KEY_RENAME_HINT}");
    }
    let base_url = credentials
        .as_ref()
        .and_then(Credentials::api_base_url)
        .or(non_credential_base_url);

    Ok(ResolvedAuth {
        api_key,
        api_base_url: normalize_api_base_url(base_url.as_deref()),
        headers,
        config_dir,
    })
}

fn missing_non_default_environment_api_base_url_error(name: &str) -> anyhow::Error {
    anyhow!(
        "The active Primitive CLI environment `{name}` does not specify an api_base_url. Set one with `primitive config set --environment {name} --api-base-url https://...`, or switch to a different environment with `primitive config use <name>`. Refusing to fall back to the production default for a non-default environment."
    )
}

pub fn resolve_auth_preferring_stored_login_over_env_api_key(
    flags: &BTreeMap<String, String>,
) -> Result<(ResolvedAuth, bool)> {
    if flag_api_key(flags).is_some() || env_api_key().is_none() {
        return Ok((resolve_auth(flags)?, false));
    }

    let dir = config_dir();
    let credentials = match load_credentials(&dir) {
        Ok(credentials) => credentials,
        Err(_) => return Ok((resolve_auth(flags)?, false)),
    };
    if credentials
        .as_ref()
        .and_then(|item| item.access_token.as_ref())
        .filter(|value| !value.trim().is_empty())
        .is_none()
    {
        return Ok((resolve_auth(flags)?, false));
    }
    Ok((resolve_auth_with_options(flags, false, true)?, true))
}

fn refresh_credentials_if_needed(
    config_dir: &Path,
    credentials: Credentials,
    fallback_base_url: &Option<String>,
    headers: &BTreeMap<String, String>,
) -> Result<Credentials> {
    if !should_refresh_credentials(&credentials, SystemTime::now()) {
        return Ok(credentials);
    }

    let _guard = acquire_credentials_lock(config_dir)?;
    let Some(mut current) = load_credentials(config_dir)? else {
        return Err(anyhow!(
            "Saved Primitive CLI OAuth session is no longer available. Run `primitive signin` to authenticate again."
        ));
    };
    if !should_refresh_credentials(&current, SystemTime::now()) {
        return Ok(current);
    }

    let api_base_url = current
        .api_base_url()
        .or_else(|| fallback_base_url.clone())
        .unwrap_or_else(|| DEFAULT_API_BASE_URL.to_string());
    let api_base_url = normalize_api_base_url(Some(&api_base_url));
    let client_id = required_oauth_credential_field(&current, "oauth_client_id")?;
    let refresh_token = required_oauth_credential_field(&current, "refresh_token")?;

    let mut request_headers = HeaderMap::new();
    request_headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    for (name, value) in headers {
        request_headers.insert(
            HeaderName::from_bytes(name.as_bytes())?,
            HeaderValue::from_str(value)?,
        );
    }
    request_headers.insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/x-www-form-urlencoded"),
    );

    let body = [
        ("client_id", client_id.as_str()),
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token.as_str()),
    ];
    let response = reqwest::blocking::Client::new()
        .post(oauth_token_endpoint(&api_base_url)?)
        .headers(request_headers)
        .form(&body)
        .send()
        .with_context(|| "Could not refresh saved Primitive CLI OAuth credentials")?;
    let ok = response.status().is_success();
    let payload = response.json::<Value>().unwrap_or(Value::Null);
    if !ok {
        if oauth_error_code(&payload).as_deref() == Some("invalid_grant") {
            delete_credentials_in_dir(config_dir)?;
            return Err(anyhow!("{SAVED_CLI_OAUTH_SESSION_EXPIRED_MESSAGE}"));
        }
        if let Some(description) = oauth_error_description(&payload) {
            return Err(anyhow!(
                "Could not refresh saved Primitive CLI OAuth credentials: {description}"
            ));
        }
        return Err(anyhow!(
            "Could not refresh saved Primitive CLI OAuth credentials."
        ));
    }

    let access_token = oauth_string(&payload, "access_token").ok_or_else(|| {
        anyhow!("Primitive OAuth token endpoint returned an unexpected refresh response.")
    })?;
    let next_refresh_token = oauth_string(&payload, "refresh_token").ok_or_else(|| {
        anyhow!("Primitive OAuth token endpoint returned an unexpected refresh response.")
    })?;
    let token_type = oauth_string(&payload, "token_type").ok_or_else(|| {
        anyhow!("Primitive OAuth token endpoint returned an unexpected refresh response.")
    })?;
    let expires_in = payload
        .get("expires_in")
        .and_then(Value::as_u64)
        .filter(|value| *value > 0)
        .ok_or_else(|| {
            anyhow!("Primitive OAuth token endpoint returned an unexpected refresh response.")
        })?;
    if token_type != "Bearer" {
        return Err(anyhow!(
            "Primitive OAuth token endpoint returned an unexpected refresh response."
        ));
    }

    current.access_token = Some(access_token);
    current.refresh_token = Some(next_refresh_token);
    current.token_type = Some(token_type);
    current.expires_at = Some(system_time_to_utc_millis(
        SystemTime::now() + Duration::from_secs(expires_in),
    ));
    save_credentials(config_dir, &current)?;
    Ok(current)
}

fn should_refresh_credentials(credentials: &Credentials, now: SystemTime) -> bool {
    let Some(expires_at) = trimmed_non_empty_string(credentials.expires_at.as_deref()) else {
        return trimmed_non_empty_string(credentials.refresh_token.as_deref()).is_some();
    };
    let Ok(expires_at) = DateTime::parse_from_rfc3339(&expires_at) else {
        return true;
    };
    let threshold: DateTime<Utc> = (now + OAUTH_REFRESH_SKEW).into();
    expires_at.with_timezone(&Utc) <= threshold
}

fn oauth_token_endpoint(api_base_url: &str) -> Result<String> {
    let mut url = reqwest::Url::parse(api_base_url)
        .with_context(|| format!("Invalid Primitive API base URL: {api_base_url}"))?;
    url.set_path("/oauth/token");
    url.set_query(None);
    url.set_fragment(None);
    Ok(url.to_string())
}

fn required_oauth_credential_field(credentials: &Credentials, field: &str) -> Result<String> {
    let value = match field {
        "oauth_client_id" => credentials.oauth_client_id.as_deref(),
        "refresh_token" => credentials.refresh_token.as_deref(),
        _ => None,
    };
    trimmed_non_empty_string(value).ok_or_else(|| {
        anyhow!(
            "Stored Primitive CLI credentials are missing OAuth refresh metadata. Run `primitive signin` to authenticate again."
        )
    })
}

fn oauth_string(payload: &Value, field: &str) -> Option<String> {
    payload
        .get(field)
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn oauth_error_code(payload: &Value) -> Option<String> {
    oauth_string(payload, "error")
}

fn oauth_error_description(payload: &Value) -> Option<String> {
    payload
        .get("error_description")
        .and_then(Value::as_str)
        .and_then(|value| trimmed_non_empty_string(Some(value)))
}

fn save_credentials(config_dir: &Path, credentials: &Credentials) -> Result<()> {
    write_private_file_atomic(
        &config_dir.join(CREDENTIALS_FILE),
        format!("{}\n", serde_json::to_string_pretty(credentials)?),
    )
}

fn system_time_to_utc_millis(time: SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn load_config(config_dir: &Path) -> Result<Option<StoredConfig>> {
    let path = config_dir.join("config.json");
    let contents = match fs::read_to_string(&path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(error).with_context(|| format!("Could not read {}", path.display()))
        }
    };
    let value = serde_json::from_str(&contents)
        .with_context(|| format!("Primitive CLI config is not valid JSON: {}", path.display()))?;
    validate_stored_config(&value)?;
    Ok(Some(value))
}

fn save_config(config_dir: &Path, config: &StoredConfig) -> Result<()> {
    let path = config_dir.join("config.json");
    write_private_file_atomic(
        &path,
        format!("{}\n", serde_json::to_string_pretty(config)?),
    )?;
    Ok(())
}

fn load_credentials(config_dir: &Path) -> Result<Option<Credentials>> {
    let path = config_dir.join("credentials.json");
    let contents = match fs::read_to_string(&path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(error).with_context(|| format!("Could not read {}", path.display()))
        }
    };
    let raw: Value = serde_json::from_str(&contents).map_err(|_| {
        anyhow!("Stored Primitive CLI credentials are not valid JSON. {MALFORMED_CREDENTIALS_HINT}")
    })?;
    if is_legacy_api_key_credentials(&raw) {
        delete_credentials_in_dir(config_dir)?;
        eprintln!("{LEGACY_API_KEY_CREDENTIALS_REMOVED_MESSAGE}");
        return Ok(None);
    }
    validate_stored_credentials(&raw)?;
    let credentials = serde_json::from_value(raw).with_context(|| {
        format!(
            "Stored Primitive CLI credentials are malformed: {}",
            path.display()
        )
    })?;
    Ok(Some(credentials))
}

fn is_legacy_api_key_credentials(raw: &Value) -> bool {
    let Some(object) = raw.as_object() else {
        return false;
    };
    if object.get("auth_method").and_then(Value::as_str) == Some("oauth") {
        return false;
    }
    ["api_key", "key_id", "base_url"]
        .iter()
        .any(|field| object.get(*field).and_then(Value::as_str).is_some())
}

fn validate_stored_credentials(raw: &Value) -> Result<()> {
    let object = raw.as_object().ok_or_else(|| {
        anyhow!(
            "Stored Primitive CLI credentials are malformed: expected a JSON object. {MALFORMED_CREDENTIALS_HINT}"
        )
    })?;

    if object.get("auth_method").and_then(Value::as_str) != Some("oauth") {
        return Err(malformed_credentials("auth_method must be oauth"));
    }

    match object.get("org_name") {
        Some(Value::Null | Value::String(_)) => {}
        _ => return Err(malformed_credentials("org_name must be a string or null")),
    }

    let token_type = require_stored_credential_string(object, "token_type")?;
    if token_type != "Bearer" {
        return Err(malformed_credentials("token_type must be Bearer"));
    }

    for field in [
        "access_token",
        "refresh_token",
        "expires_at",
        "oauth_grant_id",
        "oauth_client_id",
        "org_id",
        "created_at",
    ] {
        require_stored_credential_string(object, field)?;
    }

    if stored_credential_api_base_url(object).is_none() {
        return Err(malformed_credentials(
            "api_base_url must be a non-empty string",
        ));
    }

    Ok(())
}

fn require_stored_credential_string(
    object: &serde_json::Map<String, Value>,
    field: &str,
) -> Result<String> {
    object
        .get(field)
        .and_then(Value::as_str)
        .and_then(|value| trimmed_non_empty_string(Some(value)))
        .ok_or_else(|| malformed_credentials(&format!("{field} must be a non-empty string")))
}

fn stored_credential_api_base_url(object: &serde_json::Map<String, Value>) -> Option<String> {
    ["api_base_url", "api_base_url_2", "api_base_url_1"]
        .iter()
        .find_map(|field| {
            object
                .get(*field)
                .and_then(Value::as_str)
                .and_then(|value| trimmed_non_empty_string(Some(value)))
        })
}

fn malformed_credentials(detail: &str) -> anyhow::Error {
    anyhow!(
        "Stored Primitive CLI credentials are malformed: {detail}. {MALFORMED_CREDENTIALS_HINT}"
    )
}

#[derive(Debug, Clone, Copy)]
struct ResolvedEnvironment<'a> {
    name: &'a str,
    config: &'a EnvironmentConfig,
}

fn resolve_config_environment_entry(config: &StoredConfig) -> Option<ResolvedEnvironment<'_>> {
    if let Some(current) = &config.current_environment {
        return config
            .environments
            .get(current)
            .map(|environment| ResolvedEnvironment {
                name: current,
                config: environment,
            });
    }
    config
        .environments
        .get(DEFAULT_ENVIRONMENT)
        .map(|environment| ResolvedEnvironment {
            name: DEFAULT_ENVIRONMENT,
            config: environment,
        })
}

fn resolve_config_environment(config: &StoredConfig) -> Option<&EnvironmentConfig> {
    resolve_config_environment_entry(config).map(|item| item.config)
}

fn validate_stored_config(config: &StoredConfig) -> Result<()> {
    if config.version != 1 {
        return Err(anyhow!("Primitive CLI config version must be 1."));
    }
    if let Some(current_environment) = &config.current_environment {
        if !config.environments.contains_key(current_environment) {
            return Err(anyhow!(
                "Primitive CLI config current environment {current_environment} does not exist."
            ));
        }
    }
    for environment in config.environments.values() {
        for (header, value) in &environment.headers {
            validate_header_name(header)?;
            validate_header_value(value, header)?;
        }
    }
    Ok(())
}

pub fn delete_credentials() -> Result<()> {
    let dir = config_dir();
    delete_credentials_in_dir(&dir)
}

pub fn delete_credentials_in_dir(dir: &Path) -> Result<()> {
    remove_file_if_exists(&dir.join(CREDENTIALS_FILE))?;
    delete_chat_state_in_dir(dir)
}

pub fn delete_chat_state_in_dir(dir: &Path) -> Result<()> {
    remove_file_if_exists(&dir.join(CHAT_STATE_FILE))
}

fn remove_file_if_exists(path: &Path) -> Result<()> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error).with_context(|| format!("Could not remove {}", path.display())),
    }
}

pub fn delete_config() -> Result<()> {
    let dir = config_dir();
    let path = dir.join("config.json");
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error).with_context(|| format!("Could not remove {}", path.display())),
    }
}

pub fn config_reset(args: &[String]) -> Result<String> {
    let options = parse_config_reset_flags(args)?;
    let Some(environment) = options.environment else {
        delete_config()?;
        return Ok("Primitive CLI request config reset.".to_string());
    };

    validate_environment_name(&environment)?;
    let dir = config_dir();
    let Some(mut config) = load_config(&dir)? else {
        return Ok(format!(
            "Primitive CLI environment {environment} was not configured."
        ));
    };
    if !config.environments.contains_key(&environment) {
        return Ok(format!(
            "Primitive CLI environment {environment} was not configured."
        ));
    }

    config.environments.remove(&environment);
    if config.current_environment.as_deref() == Some(environment.as_str()) {
        config.current_environment = None;
    }
    if config.environments.is_empty() {
        delete_config()?;
    } else {
        save_config(&dir, &config)?;
    }

    Ok(format!("Primitive CLI environment {environment} removed."))
}

pub fn config_list_json() -> Result<Value> {
    config_list_json_with_options(false)
}

pub fn config_list_output(args: &[String]) -> Result<String> {
    let options = parse_config_list_flags(args)?;
    if options.json {
        return Ok(serde_json::to_string_pretty(
            &config_list_json_with_options(options.show_secrets)?,
        )?);
    }
    config_list_text()
}

fn config_list_json_with_options(show_secrets: bool) -> Result<Value> {
    let dir = config_dir();
    let config = load_or_empty_config(&dir)?;
    let mut value = serde_json::to_value(config)?;
    if !show_secrets {
        redact_config_value(&mut value);
    }
    Ok(value)
}

fn load_or_empty_config(dir: &Path) -> Result<StoredConfig> {
    Ok(load_config(dir)?.unwrap_or(StoredConfig {
        version: 1,
        current_environment: None,
        environments: BTreeMap::new(),
    }))
}

fn redact_config_value(value: &mut Value) {
    if let Some(environments) = value
        .get_mut("environments")
        .and_then(|item| item.as_object_mut())
    {
        for environment in environments.values_mut() {
            if let Some(headers) = environment
                .get_mut("headers")
                .and_then(|item| item.as_object_mut())
            {
                for value in headers.values_mut() {
                    *value = json!("***");
                }
            }
        }
    }
}

fn config_list_text() -> Result<String> {
    let dir = config_dir();
    let config = load_or_empty_config(&dir)?;
    if config.environments.is_empty() {
        return Ok("No Primitive CLI environments configured.".to_string());
    }

    let active_environment = active_environment_name(&config);
    let mut lines = Vec::new();
    for (name, environment) in &config.environments {
        let active = if active_environment == Some(name.as_str()) {
            "*"
        } else {
            " "
        };
        lines.push(format!("{active} {name}"));
        if let Some(api_base_url) = &environment.api_base_url {
            lines.push(format!("    api_base_url: {api_base_url}"));
        }
        let header_names = environment.headers.keys().cloned().collect::<Vec<_>>();
        lines.push(format!(
            "    headers: {}",
            if header_names.is_empty() {
                "(none)".to_string()
            } else {
                header_names.join(", ")
            }
        ));
    }
    Ok(lines.join("\n"))
}

fn active_environment_name(config: &StoredConfig) -> Option<&str> {
    if let Some(current) = &config.current_environment {
        if config.environments.contains_key(current) {
            return Some(current);
        }
    }
    config
        .environments
        .contains_key("default")
        .then_some("default")
}

fn active_environment_api_base_url(config: &StoredConfig) -> Option<String> {
    resolve_config_environment(config)
        .and_then(|environment| environment.api_base_url.as_deref())
        .map(|value| normalize_api_base_url(Some(value)))
}

struct CredentialsLockGuard {
    path: PathBuf,
}

impl Drop for CredentialsLockGuard {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn acquire_credentials_lock(config_dir: &Path) -> Result<CredentialsLockGuard> {
    ensure_private_config_dir(config_dir)?;
    let lock_path = config_dir.join(CREDENTIALS_LOCK_DIR);
    let mut acquired = false;

    for _ in 0..2 {
        match create_credentials_lock_dir(&lock_path) {
            Ok(()) => {
                acquired = true;
                break;
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                if remove_recoverable_credentials_lock(&lock_path)? {
                    continue;
                }
                return Err(anyhow!(
                    "{}",
                    credentials_lock_in_progress_message(&lock_path)
                ));
            }
            Err(error) => {
                return Err(error)
                    .with_context(|| format!("Could not create {}", lock_path.display()));
            }
        }
    }

    if !acquired {
        return Err(anyhow!(
            "{}",
            credentials_lock_in_progress_message(&lock_path)
        ));
    }

    let guard = CredentialsLockGuard { path: lock_path };
    if let Err(error) = write_credentials_lock_owner(&guard.path) {
        drop(guard);
        return Err(error);
    }
    Ok(guard)
}

fn create_credentials_lock_dir(lock_path: &Path) -> std::io::Result<()> {
    #[cfg(unix)]
    {
        let mut builder = fs::DirBuilder::new();
        builder.mode(0o700).create(lock_path)
    }
    #[cfg(not(unix))]
    {
        fs::create_dir(lock_path)
    }
}

fn write_credentials_lock_owner(lock_path: &Path) -> Result<()> {
    write_private_file_atomic(
        &lock_path.join(CREDENTIALS_LOCK_OWNER_FILE),
        format!("{{\n  \"pid\": {}\n}}\n", std::process::id()),
    )
}

fn remove_recoverable_credentials_lock(lock_path: &Path) -> Result<bool> {
    if let Some(pid) = read_credentials_lock_owner(lock_path)? {
        if process_is_running(pid) {
            return Ok(false);
        }
        fs::remove_dir_all(lock_path)
            .with_context(|| format!("Could not remove stale {}", lock_path.display()))?;
        return Ok(true);
    }

    remove_stale_credentials_lock(lock_path, SystemTime::now())
}

fn read_credentials_lock_owner(lock_path: &Path) -> Result<Option<u32>> {
    let path = lock_path.join(CREDENTIALS_LOCK_OWNER_FILE);
    let raw = match fs::read_to_string(&path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(error).with_context(|| format!("Could not read {}", path.display()));
        }
    };
    let Ok(value) = serde_json::from_str::<Value>(&raw) else {
        return Ok(None);
    };
    Ok(value
        .get("pid")
        .and_then(Value::as_u64)
        .filter(|pid| *pid > 0)
        .and_then(|pid| u32::try_from(pid).ok()))
}

fn remove_stale_credentials_lock(lock_path: &Path, now: SystemTime) -> Result<bool> {
    let metadata = match fs::metadata(lock_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(true),
        Err(error) => {
            return Err(error)
                .with_context(|| format!("Could not inspect {}", lock_path.display()));
        }
    };
    let modified = metadata
        .modified()
        .with_context(|| format!("Could not inspect {}", lock_path.display()))?;
    if now.duration_since(modified).unwrap_or_default() < CREDENTIALS_LOCK_STALE {
        return Ok(false);
    }
    fs::remove_dir_all(lock_path)
        .with_context(|| format!("Could not remove stale {}", lock_path.display()))?;
    Ok(true)
}

#[cfg(unix)]
fn process_is_running(pid: u32) -> bool {
    let Ok(pid) = libc::pid_t::try_from(pid) else {
        return true;
    };
    let result = unsafe { libc::kill(pid, 0) };
    if result == 0 {
        return true;
    }
    std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
}

#[cfg(not(unix))]
fn process_is_running(_pid: u32) -> bool {
    true
}

fn credentials_lock_in_progress_message(lock_path: &Path) -> String {
    format!(
        "Another Primitive CLI credential operation is already in progress. Wait for it to finish, then retry. If no Primitive auth command is still running, run `primitive logout --force` to clear local CLI auth state and remove {}.",
        lock_path.display()
    )
}

#[derive(Debug, Clone, Copy, Default)]
struct ConfigListOptions {
    json: bool,
    show_secrets: bool,
}

#[derive(Debug, Clone, Default)]
struct ConfigResetOptions {
    environment: Option<String>,
}

fn parse_config_list_flags(args: &[String]) -> Result<ConfigListOptions> {
    let mut options = ConfigListOptions::default();
    for arg in args {
        match arg.as_str() {
            "--json" => options.json = true,
            "--show-secrets" => options.show_secrets = true,
            "--help" | "-h" | "help" => {}
            other => return Err(anyhow!("Unexpected argument: {other}")),
        }
    }
    Ok(options)
}

fn parse_config_reset_flags(args: &[String]) -> Result<ConfigResetOptions> {
    let mut options = ConfigResetOptions::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if arg == "--environment" || arg == "-e" {
            let value = require_config_value(args, index, arg, "requires a value")?;
            options.environment = Some(value);
            index += 2;
            continue;
        }
        if let Some(value) = arg.strip_prefix("--environment=") {
            options.environment = Some(value.to_string());
            index += 1;
            continue;
        }
        if let Some(value) = arg.strip_prefix("-e=") {
            options.environment = Some(value.to_string());
            index += 1;
            continue;
        }
        if let Some(value) = attached_short_environment_value(arg) {
            options.environment = Some(value.to_string());
            index += 1;
            continue;
        }
        return Err(anyhow!("Unexpected config reset argument: {arg}"));
    }
    Ok(options)
}

pub fn config_set(args: &[String]) -> Result<ConfigMutationResult> {
    let options = parse_config_flags(args)?;
    if !options.has_request_settings() {
        return Err(anyhow!(
            "Nothing to set. Pass an API base URL, --header, or --unset-header."
        ));
    }
    let dir = config_dir();
    let mut config = load_config(&dir)?.unwrap_or(StoredConfig {
        version: 1,
        current_environment: None,
        environments: BTreeMap::new(),
    });
    let previous_environment = active_environment_name(&config).map(str::to_string);
    let previous_api_base_url = active_environment_api_base_url(&config);
    let env_name = options.environment.clone().unwrap_or_else(|| {
        previous_environment
            .clone()
            .unwrap_or_else(|| "default".to_string())
    });
    validate_environment_name(&env_name)?;

    let environment = config
        .environments
        .entry(env_name.clone())
        .or_insert_with(EnvironmentConfig::default);

    if let Some(base_url) = options.api_base_url {
        environment.api_base_url = Some(normalize_api_base_url(Some(&base_url)));
    }
    for (header, value) in options.headers {
        validate_header_name(&header)?;
        validate_header_value(&value, &header)?;
        environment.headers.insert(header, value);
    }
    for header in options.unset_headers {
        validate_header_name(&header)?;
        environment.headers.remove(&header);
    }

    config.current_environment = Some(env_name.clone());
    let next_environment = active_environment_name(&config).map(str::to_string);
    let next_api_base_url = active_environment_api_base_url(&config);
    let should_clear_credentials = dir.join(CREDENTIALS_FILE).exists()
        && (previous_environment != next_environment || previous_api_base_url != next_api_base_url);
    let _credentials_lock = if should_clear_credentials {
        Some(acquire_credentials_lock(&dir)?)
    } else {
        None
    };

    save_config(&dir, &config)?;
    if should_clear_credentials {
        delete_credentials_in_dir(&dir)?;
    }
    Ok(ConfigMutationResult {
        environment: env_name,
        removed_credentials: should_clear_credentials,
    })
}

pub fn config_use(name: &str) -> Result<ConfigMutationResult> {
    validate_environment_name(name)?;
    let dir = config_dir();
    let mut config = load_config(&dir)?.ok_or_else(|| anyhow!("No Primitive CLI config found."))?;
    if !config.environments.contains_key(name) {
        return Err(anyhow!(
            "Primitive CLI environment {name} is not configured."
        ));
    }
    let previous_environment = active_environment_name(&config).map(str::to_string);
    config.current_environment = Some(name.to_string());
    let should_clear_credentials =
        dir.join(CREDENTIALS_FILE).exists() && previous_environment.as_deref() != Some(name);
    let _credentials_lock = if should_clear_credentials {
        Some(acquire_credentials_lock(&dir)?)
    } else {
        None
    };

    save_config(&dir, &config)?;
    if should_clear_credentials {
        delete_credentials_in_dir(&dir)?;
    }
    Ok(ConfigMutationResult {
        environment: name.to_string(),
        removed_credentials: should_clear_credentials,
    })
}

#[derive(Debug, Clone, Default)]
struct ConfigSetOptions {
    environment: Option<String>,
    api_base_url: Option<String>,
    headers: Vec<(String, String)>,
    unset_headers: Vec<String>,
}

impl ConfigSetOptions {
    fn has_request_settings(&self) -> bool {
        self.api_base_url.is_some() || !self.headers.is_empty() || !self.unset_headers.is_empty()
    }
}

fn parse_config_flags(args: &[String]) -> Result<ConfigSetOptions> {
    let mut options = ConfigSetOptions::default();
    let mut index = 0;
    while index < args.len() {
        let arg = &args[index];
        if arg == "--header" {
            let assignment = require_config_value(args, index, "--header", "requires name=value")?;
            let (name, value) = parse_header_assignment(&assignment)?;
            options.headers.push((name, value));
            index += 2;
            continue;
        }
        if let Some(assignment) = arg.strip_prefix("--header=") {
            let (name, value) = parse_header_assignment(assignment)?;
            options.headers.push((name, value));
            index += 1;
            continue;
        }
        if arg == "--unset-header" {
            let header =
                require_config_value(args, index, "--unset-header", "requires a header name")?;
            validate_header_name(&header)?;
            options.unset_headers.push(header);
            index += 2;
            continue;
        }
        if let Some(header) = arg.strip_prefix("--unset-header=") {
            validate_header_name(header)?;
            options.unset_headers.push(header.to_string());
            index += 1;
            continue;
        }
        if arg == "--environment" || arg == "-e" {
            let value = require_config_value(args, index, arg, "requires a value")?;
            options.environment = Some(value);
            index += 2;
            continue;
        }
        if let Some(value) = arg.strip_prefix("--environment=") {
            options.environment = Some(value.to_string());
            index += 1;
            continue;
        }
        if let Some(value) = arg.strip_prefix("-e=") {
            options.environment = Some(value.to_string());
            index += 1;
            continue;
        }
        if let Some(value) = attached_short_environment_value(arg) {
            options.environment = Some(value.to_string());
            index += 1;
            continue;
        }
        if arg == "--api-base-url" {
            let value = require_config_value(args, index, "--api-base-url", "requires a value")?;
            options.api_base_url = Some(value);
            index += 2;
            continue;
        }
        if let Some(value) = arg.strip_prefix("--api-base-url=") {
            options.api_base_url = Some(value.to_string());
            index += 1;
            continue;
        }
        if arg.starts_with('-') {
            return Err(crate::usage_error(format!("Nonexistent flag: {arg}")));
        }
        return Err(crate::usage_error(format!("Unexpected argument: {arg}")));
    }
    Ok(options)
}

fn attached_short_environment_value(arg: &str) -> Option<&str> {
    let value = arg.strip_prefix("-e")?;
    (!value.is_empty() && !value.starts_with('=')).then_some(value)
}

fn require_config_value(
    args: &[String],
    index: usize,
    flag: &str,
    requirement: &str,
) -> Result<String> {
    let value = args
        .get(index + 1)
        .ok_or_else(|| anyhow!("{flag} {requirement}"))?;
    if value.starts_with('-') {
        return Err(anyhow!("{flag} {requirement}"));
    }
    Ok(value.to_string())
}

fn parse_header_assignment(value: &str) -> Result<(String, String)> {
    let Some((name, header_value)) = value.split_once('=') else {
        return Err(anyhow!(
            "Header values must use name=value syntax, for example `x-custom=secret`."
        ));
    };
    validate_header_name(name)?;
    validate_header_value(header_value, name)?;
    Ok((name.to_string(), header_value.to_string()))
}

fn flag_api_key(flags: &BTreeMap<String, String>) -> Option<String> {
    trimmed_non_empty_string(flags.get("api-key").map(String::as_str))
}

fn env_api_key() -> Option<String> {
    env_non_empty("PRIMITIVE_API_KEY")
}

fn env_non_empty(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .and_then(|value| trimmed_non_empty_string(Some(&value)))
}

fn trimmed_non_empty_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn api_headers_from_env() -> Result<BTreeMap<String, String>> {
    let raw = match std::env::var(API_HEADERS_ENV) {
        Ok(raw) => raw,
        Err(std::env::VarError::NotPresent) => return Ok(BTreeMap::new()),
        Err(std::env::VarError::NotUnicode(_)) => {
            return Err(anyhow!("{API_HEADERS_ENV} must be valid Unicode."));
        }
    };
    let raw = raw.trim();
    if raw.is_empty() {
        return Ok(BTreeMap::new());
    }

    let value: Value = serde_json::from_str(raw)
        .with_context(|| format!("{API_HEADERS_ENV} must be valid JSON object syntax"))?;
    let object = value
        .as_object()
        .ok_or_else(|| anyhow!("{API_HEADERS_ENV} must be a JSON object."))?;

    let mut headers = BTreeMap::new();
    for (name, value) in object {
        validate_header_name(name)?;
        let value = value
            .as_str()
            .ok_or_else(|| anyhow!("{API_HEADERS_ENV}.{name} must be a string."))?;
        validate_header_value(value, name)?;
        headers.insert(name.to_string(), value.to_string());
    }
    Ok(headers)
}

fn validate_environment_name(name: &str) -> Result<()> {
    let mut chars = name.chars();
    let Some(first) = chars.next() else {
        return Err(anyhow!("Environment name must be a non-empty string."));
    };
    if !first.is_ascii_alphanumeric()
        || !chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
        || name.len() > 63
    {
        return Err(anyhow!(
            "Environment name must start with a letter or number and may only contain letters, numbers, '.', '_', or '-'."
        ));
    }
    Ok(())
}

fn validate_header_name(name: &str) -> Result<()> {
    if name.is_empty() {
        return Err(anyhow!("Header name must be a non-empty string."));
    }
    if name.eq_ignore_ascii_case("authorization") {
        return Err(anyhow!(
            "The Authorization header is managed by PRIMITIVE_API_KEY or saved OAuth CLI credentials."
        ));
    }
    if !name
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || "!#$%&'*+-.^_`|~".contains(ch))
    {
        return Err(anyhow!("Invalid header name: {name}"));
    }
    Ok(())
}

fn validate_header_value(value: &str, name: &str) -> Result<()> {
    if value.is_empty() {
        return Err(anyhow!("Header {name} value must not be empty."));
    }
    if value.chars().any(|ch| matches!(ch, '\r' | '\n' | '\0')) {
        return Err(anyhow!(
            "Header {name} value must not contain CR, LF, or NUL characters."
        ));
    }
    Ok(())
}
