use primitive_rust::{config, friendly};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

static ENV_LOCK: Mutex<()> = Mutex::new(());

fn args(values: &[&str]) -> Vec<String> {
    values.iter().map(|value| value.to_string()).collect()
}

fn temp_config_dir(name: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "primitive-rust-config-{name}-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(&path).expect("create config dir");
    path
}

struct ConfigEnvGuard {
    previous_config_dir: Option<String>,
    previous_api_key: Option<String>,
    previous_api_base_url: Option<String>,
    previous_api_headers: Option<String>,
    _lock: MutexGuard<'static, ()>,
}

impl ConfigEnvGuard {
    fn set(config_dir: &Path) -> Self {
        let lock = ENV_LOCK.lock().expect("env lock");
        let previous_config_dir = std::env::var("PRIMITIVE_CONFIG_DIR").ok();
        let previous_api_key = std::env::var("PRIMITIVE_API_KEY").ok();
        let previous_api_base_url = std::env::var("PRIMITIVE_API_BASE_URL").ok();
        let previous_api_headers = std::env::var("PRIMITIVE_API_HEADERS").ok();
        std::env::set_var("PRIMITIVE_CONFIG_DIR", config_dir);
        std::env::remove_var("PRIMITIVE_API_KEY");
        std::env::remove_var("PRIMITIVE_API_BASE_URL");
        std::env::remove_var("PRIMITIVE_API_HEADERS");
        Self {
            previous_config_dir,
            previous_api_key,
            previous_api_base_url,
            previous_api_headers,
            _lock: lock,
        }
    }

    fn set_with_api_key(config_dir: &Path, api_key: &str) -> Self {
        let guard = Self::set(config_dir);
        std::env::set_var("PRIMITIVE_API_KEY", api_key);
        guard
    }

    fn set_with_api_headers(config_dir: &Path, api_headers: &str) -> Self {
        let guard = Self::set(config_dir);
        std::env::set_var("PRIMITIVE_API_HEADERS", api_headers);
        guard
    }
}

impl Drop for ConfigEnvGuard {
    fn drop(&mut self) {
        if let Some(previous) = &self.previous_config_dir {
            std::env::set_var("PRIMITIVE_CONFIG_DIR", previous);
        } else {
            std::env::remove_var("PRIMITIVE_CONFIG_DIR");
        }
        if let Some(previous) = &self.previous_api_key {
            std::env::set_var("PRIMITIVE_API_KEY", previous);
        } else {
            std::env::remove_var("PRIMITIVE_API_KEY");
        }
        if let Some(previous) = &self.previous_api_base_url {
            std::env::set_var("PRIMITIVE_API_BASE_URL", previous);
        } else {
            std::env::remove_var("PRIMITIVE_API_BASE_URL");
        }
        if let Some(previous) = &self.previous_api_headers {
            std::env::set_var("PRIMITIVE_API_HEADERS", previous);
        } else {
            std::env::remove_var("PRIMITIVE_API_HEADERS");
        }
    }
}

fn write_config(config_dir: &Path, value: Value) {
    fs::write(
        config_dir.join("config.json"),
        format!(
            "{}\n",
            serde_json::to_string_pretty(&value).expect("serialize config")
        ),
    )
    .expect("write config");
}

fn read_config(config_dir: &Path) -> Value {
    let contents = fs::read_to_string(config_dir.join("config.json")).expect("read config");
    serde_json::from_str(&contents).expect("parse config")
}

fn write_auth_files(config_dir: &Path) {
    fs::write(config_dir.join("credentials.json"), "{}\n").expect("write credentials");
    fs::write(config_dir.join("chat-state.json"), "{}\n").expect("write chat state");
    fs::write(config_dir.join("signup.json"), "{}\n").expect("write signup state");
    fs::write(config_dir.join("unrelated.json"), "{}\n").expect("write unrelated");
}

fn write_oauth_credentials(
    config_dir: &Path,
    access_token: &str,
    refresh_token: &str,
    expires_at: &str,
    api_base_url: &str,
) {
    write_oauth_credentials_with_expiry(
        config_dir,
        access_token,
        refresh_token,
        Some(json!(expires_at)),
        api_base_url,
    );
}

fn write_oauth_credentials_with_expiry(
    config_dir: &Path,
    access_token: &str,
    refresh_token: &str,
    expires_at: Option<Value>,
    api_base_url: &str,
) {
    let mut credentials = json!({
        "auth_method": "oauth",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "oauth_grant_id": "grant-id",
        "oauth_client_id": "primitive-cli",
        "org_id": "org-id",
        "org_name": null,
        "api_base_url": api_base_url,
        "created_at": "2026-07-17T12:00:00.000Z"
    });
    if let Some(expires_at) = expires_at {
        credentials["expires_at"] = expires_at;
    }

    fs::write(
        config_dir.join("credentials.json"),
        format!(
            "{}\n",
            serde_json::to_string_pretty(&credentials).expect("serialize credentials")
        ),
    )
    .expect("write credentials");
}

fn start_oauth_refresh_server<F>(handler: F) -> (String, thread::JoinHandle<String>)
where
    F: FnOnce(String) -> (u16, String) + Send + 'static,
{
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind refresh server");
    listener
        .set_nonblocking(true)
        .expect("set refresh server nonblocking");
    let base_url = format!("http://{}/v1", listener.local_addr().expect("server addr"));
    let handle = thread::spawn(move || {
        let deadline = Instant::now() + Duration::from_secs(5);
        let (mut stream, _) = loop {
            match listener.accept() {
                Ok(accepted) => break accepted,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    assert!(
                        Instant::now() < deadline,
                        "timed out waiting for refresh request"
                    );
                    thread::sleep(Duration::from_millis(10));
                }
                Err(error) => panic!("accept refresh request: {error}"),
            }
        };
        stream
            .set_nonblocking(false)
            .expect("set refresh stream blocking");
        let mut buffer = Vec::new();
        loop {
            let mut chunk = [0_u8; 1024];
            let read = stream.read(&mut chunk).expect("read refresh request");
            if read == 0 {
                break;
            }
            buffer.extend_from_slice(&chunk[..read]);
            if let Some(expected) = expected_http_request_length(&buffer) {
                if buffer.len() >= expected {
                    break;
                }
            }
        }
        let request = String::from_utf8_lossy(&buffer).to_string();
        let (status, body) = handler(request.clone());
        let reason = if status < 400 { "OK" } else { "Bad Request" };
        let response = format!(
            "HTTP/1.1 {status} {reason}\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
            body.len()
        );
        stream
            .write_all(response.as_bytes())
            .expect("write refresh response");
        request
    });
    (base_url, handle)
}

fn expected_http_request_length(buffer: &[u8]) -> Option<usize> {
    let request = String::from_utf8_lossy(buffer);
    let (head, _) = request.split_once("\r\n\r\n")?;
    let body_offset = head.len() + 4;
    let content_length = head.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("content-length")
            .then(|| value.trim().parse::<usize>().ok())
            .flatten()
    })?;
    Some(body_offset + content_length)
}

fn assert_refresh_request(request: &str) {
    assert!(
        request.starts_with("POST /oauth/token HTTP/1.1\r\n"),
        "{request}"
    );
    assert!(
        request.contains("content-type: application/x-www-form-urlencoded"),
        "{request}"
    );
    assert!(request.contains("\r\nx-refresh-test: env\r\n"), "{request}");
    assert!(request.contains("client_id=primitive-cli"), "{request}");
    assert!(request.contains("grant_type=refresh_token"), "{request}");
    assert!(request.contains("refresh_token=prim_ort_old"), "{request}");
}

#[test]
fn resolve_auth_with_env_api_key_ignores_malformed_saved_credentials() {
    let config_dir = temp_config_dir("env-key-ignores-bad-credentials");
    {
        let _env = ConfigEnvGuard::set_with_api_key(&config_dir, "prim_env");
        fs::write(config_dir.join("credentials.json"), "{not-json").expect("write credentials");

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");

        assert_eq!(resolved.api_key.as_deref(), Some("prim_env"));
        assert_eq!(resolved.api_base_url, "https://api.primitive.dev/v1");
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_ignores_empty_flag_api_key_and_uses_saved_credentials() {
    let config_dir = temp_config_dir("empty-flag-key-uses-saved");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        fs::write(
            config_dir.join("credentials.json"),
            r#"{
  "access_token": "prim_saved",
  "api_base_url": "https://saved.example/v1"
}
"#,
        )
        .expect("write credentials");

        let resolved = config::resolve_auth(&BTreeMap::from([(
            "api-key".to_string(),
            "   ".to_string(),
        )]))
        .expect("resolve auth");

        assert_eq!(resolved.api_key.as_deref(), Some("prim_saved"));
        assert_eq!(resolved.api_base_url, "https://saved.example/v1");
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_ignores_empty_env_api_key_and_uses_saved_credentials() {
    let config_dir = temp_config_dir("empty-env-key-uses-saved");
    {
        let _env = ConfigEnvGuard::set_with_api_key(&config_dir, "  ");
        fs::write(
            config_dir.join("credentials.json"),
            r#"{
  "access_token": "prim_saved",
  "api_base_url": "https://saved.example/v1"
}
"#,
        )
        .expect("write credentials");

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");

        assert_eq!(resolved.api_key.as_deref(), Some("prim_saved"));
        assert_eq!(resolved.api_base_url, "https://saved.example/v1");
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_accepts_legacy_saved_api_base_url_field() {
    let config_dir = temp_config_dir("legacy-credentials-base-url");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        fs::write(
            config_dir.join("credentials.json"),
            r#"{
  "access_token": "prim_saved",
  "api_base_url_1": "https://www.primitive.dev/api/v1"
}
"#,
        )
        .expect("write credentials");

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");

        assert_eq!(resolved.api_key.as_deref(), Some("prim_saved"));
        assert_eq!(resolved.api_base_url, "https://api.primitive.dev/v1");
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_prefers_second_legacy_saved_api_base_url_field() {
    let config_dir = temp_config_dir("legacy-credentials-base-url-2");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        fs::write(
            config_dir.join("credentials.json"),
            r#"{
  "access_token": "prim_saved",
  "api_base_url_1": "https://old.example/v1",
  "api_base_url_2": "https://primitive-staging-1.com/api/v1"
}
"#,
        )
        .expect("write credentials");

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");

        assert_eq!(resolved.api_key.as_deref(), Some("prim_saved"));
        assert_eq!(
            resolved.api_base_url,
            "https://api.primitive-staging-1.com/v1"
        );
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn pay_email_auth_preference_uses_saved_login_and_base_url_over_env_key() {
    let config_dir = temp_config_dir("pay-email-stored-login");
    {
        let _env = ConfigEnvGuard::set_with_api_key(&config_dir, "prim_env");
        fs::write(
            config_dir.join("credentials.json"),
            r#"{
  "access_token": "prim_saved",
  "api_base_url": "https://saved.example/v1"
}
"#,
        )
        .expect("write credentials");

        let (resolved, used_stored_login) =
            config::resolve_auth_preferring_stored_login_over_env_api_key(&Default::default())
                .expect("resolve auth");

        assert!(used_stored_login);
        assert_eq!(resolved.api_key.as_deref(), Some("prim_saved"));
        assert_eq!(resolved.api_base_url, "https://saved.example/v1");
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_refreshes_expired_saved_oauth_credentials() {
    let config_dir = temp_config_dir("refresh-expired-oauth");
    let (api_base_url, handle) = start_oauth_refresh_server(|_request| {
        (
            200,
            json!({
                "access_token": "prim_oat_new",
                "refresh_token": "prim_ort_new",
                "token_type": "Bearer",
                "expires_in": 120
            })
            .to_string(),
        )
    });
    {
        let _env = ConfigEnvGuard::set_with_api_headers(&config_dir, r#"{"x-refresh-test":"env"}"#);
        write_oauth_credentials(
            &config_dir,
            "prim_oat_old",
            "prim_ort_old",
            "2020-01-01T00:00:00.000Z",
            &api_base_url,
        );

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");
        let request = handle.join().expect("refresh server");
        let credentials: Value = serde_json::from_str(
            &fs::read_to_string(config_dir.join("credentials.json")).expect("read credentials"),
        )
        .expect("parse credentials");

        assert_refresh_request(&request);
        assert_eq!(resolved.api_key.as_deref(), Some("prim_oat_new"));
        assert_eq!(resolved.api_base_url, api_base_url);
        assert_eq!(credentials["access_token"], json!("prim_oat_new"));
        assert_eq!(credentials["refresh_token"], json!("prim_ort_new"));
        assert_eq!(credentials["token_type"], json!("Bearer"));
        assert_eq!(credentials["api_base_url"], json!(api_base_url));
        assert!(
            credentials["expires_at"]
                .as_str()
                .is_some_and(|value| value.ends_with('Z')),
            "{credentials}"
        );
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_refreshes_saved_oauth_credentials_with_missing_expiry() {
    let config_dir = temp_config_dir("refresh-missing-expiry-oauth");
    let (api_base_url, handle) = start_oauth_refresh_server(|_request| {
        (
            200,
            json!({
                "access_token": "prim_oat_new",
                "refresh_token": "prim_ort_new",
                "token_type": "Bearer",
                "expires_in": 120
            })
            .to_string(),
        )
    });
    {
        let _env = ConfigEnvGuard::set_with_api_headers(&config_dir, r#"{"x-refresh-test":"env"}"#);
        write_oauth_credentials_with_expiry(
            &config_dir,
            "prim_oat_old",
            "prim_ort_old",
            None,
            &api_base_url,
        );

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");
        let request = handle.join().expect("refresh server");

        assert_refresh_request(&request);
        assert_eq!(resolved.api_key.as_deref(), Some("prim_oat_new"));
        assert_eq!(resolved.api_base_url, api_base_url);
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_refreshes_saved_oauth_credentials_with_blank_expiry() {
    let config_dir = temp_config_dir("refresh-blank-expiry-oauth");
    let (api_base_url, handle) = start_oauth_refresh_server(|_request| {
        (
            200,
            json!({
                "access_token": "prim_oat_new",
                "refresh_token": "prim_ort_new",
                "token_type": "Bearer",
                "expires_in": 120
            })
            .to_string(),
        )
    });
    {
        let _env = ConfigEnvGuard::set_with_api_headers(&config_dir, r#"{"x-refresh-test":"env"}"#);
        write_oauth_credentials_with_expiry(
            &config_dir,
            "prim_oat_old",
            "prim_ort_old",
            Some(json!("   ")),
            &api_base_url,
        );

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");
        let request = handle.join().expect("refresh server");

        assert_refresh_request(&request);
        assert_eq!(resolved.api_key.as_deref(), Some("prim_oat_new"));
        assert_eq!(resolved.api_base_url, api_base_url);
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_refreshes_against_saved_host_when_config_points_elsewhere() {
    let config_dir = temp_config_dir("refresh-saved-host");
    let (api_base_url, handle) = start_oauth_refresh_server(|_request| {
        (
            200,
            json!({
                "access_token": "prim_oat_new",
                "refresh_token": "prim_ort_new",
                "token_type": "Bearer",
                "expires_in": 120
            })
            .to_string(),
        )
    });
    {
        let _env = ConfigEnvGuard::set_with_api_headers(&config_dir, r#"{"x-refresh-test":"env"}"#);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "staging",
                "environments": {
                    "staging": {
                        "api_base_url": "http://127.0.0.1:9/v1"
                    }
                }
            }),
        );
        write_oauth_credentials(
            &config_dir,
            "prim_oat_old",
            "prim_ort_old",
            "2020-01-01T00:00:00.000Z",
            &api_base_url,
        );

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");
        let request = handle.join().expect("refresh server");

        assert_refresh_request(&request);
        assert_eq!(resolved.api_key.as_deref(), Some("prim_oat_new"));
        assert_eq!(resolved.api_base_url, api_base_url);
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_removes_saved_credentials_on_invalid_grant() {
    let config_dir = temp_config_dir("refresh-invalid-grant");
    let (api_base_url, handle) = start_oauth_refresh_server(|_request| {
        (
            400,
            json!({
                "error": "invalid_grant",
                "error_description": "Refresh token is no longer active"
            })
            .to_string(),
        )
    });
    {
        let _env = ConfigEnvGuard::set_with_api_headers(&config_dir, r#"{"x-refresh-test":"env"}"#);
        write_oauth_credentials(
            &config_dir,
            "prim_oat_old",
            "prim_ort_old",
            "2020-01-01T00:00:00.000Z",
            &api_base_url,
        );
        fs::write(config_dir.join("chat-state.json"), "{}\n").expect("write chat state");

        let error = config::resolve_auth(&Default::default()).expect_err("refresh should fail");
        let request = handle.join().expect("refresh server");

        assert_refresh_request(&request);
        assert!(error.to_string().contains("expired or was revoked"));
        assert!(!config_dir.join("credentials.json").exists());
        assert!(!config_dir.join("chat-state.json").exists());
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_does_not_refresh_fresh_saved_credentials() {
    let config_dir = temp_config_dir("fresh-oauth-no-refresh");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_oauth_credentials(
            &config_dir,
            "prim_oat_current",
            "prim_ort_old",
            "2099-01-01T00:00:00.000Z",
            "http://127.0.0.1:9/v1",
        );

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");

        assert_eq!(resolved.api_key.as_deref(), Some("prim_oat_current"));
        assert_eq!(resolved.api_base_url, "http://127.0.0.1:9/v1");
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn pay_email_auth_preference_refreshes_stored_login_over_env_key() {
    let config_dir = temp_config_dir("pay-email-refresh-stored-login");
    let (api_base_url, handle) = start_oauth_refresh_server(|_request| {
        (
            200,
            json!({
                "access_token": "prim_oat_new",
                "refresh_token": "prim_ort_new",
                "token_type": "Bearer",
                "expires_in": 120
            })
            .to_string(),
        )
    });
    {
        let _env = ConfigEnvGuard::set_with_api_key(&config_dir, "prim_env");
        std::env::set_var("PRIMITIVE_API_HEADERS", r#"{"x-refresh-test":"env"}"#);
        write_oauth_credentials(
            &config_dir,
            "prim_oat_old",
            "prim_ort_old",
            "2020-01-01T00:00:00.000Z",
            &api_base_url,
        );

        let (resolved, used_stored_login) =
            config::resolve_auth_preferring_stored_login_over_env_api_key(&Default::default())
                .expect("resolve auth");
        let request = handle.join().expect("refresh server");

        assert_refresh_request(&request);
        assert!(used_stored_login);
        assert_eq!(resolved.api_key.as_deref(), Some("prim_oat_new"));
        assert_eq!(resolved.api_base_url, api_base_url);
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}

#[test]
fn resolve_auth_rejects_active_non_default_environment_without_api_base_url() {
    let config_dir = temp_config_dir("missing-non-default-base-url");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "staging",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    },
                    "staging": {
                        "headers": {
                            "x-staging": "secret"
                        }
                    }
                }
            }),
        );

        let error =
            config::resolve_auth(&Default::default()).expect_err("missing base URL should fail");

        assert!(error
            .to_string()
            .contains("environment `staging` does not specify an api_base_url"));
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn resolve_auth_merges_api_headers_env_over_stored_headers() {
    let config_dir = temp_config_dir("api-headers-env-merge");
    {
        let _env = ConfigEnvGuard::set_with_api_headers(
            &config_dir,
            r#"{"x-test":"env","x-env-only":"yes"}"#,
        );
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "staging",
                "environments": {
                    "staging": {
                        "api_base_url": "https://api.staging.example/v1",
                        "headers": {
                            "x-test": "stored",
                            "x-stored-only": "yes"
                        }
                    }
                }
            }),
        );

        let resolved = config::resolve_auth(&Default::default()).expect("resolve auth");

        assert_eq!(
            resolved.headers.get("x-test").map(String::as_str),
            Some("env")
        );
        assert_eq!(
            resolved.headers.get("x-stored-only").map(String::as_str),
            Some("yes")
        );
        assert_eq!(
            resolved.headers.get("x-env-only").map(String::as_str),
            Some("yes")
        );
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn resolve_auth_rejects_invalid_api_headers_env() {
    for (name, raw, expected) in [
        ("bad-json", "{not json", "valid JSON object syntax"),
        ("array", "[]", "must be a JSON object"),
        (
            "authorization",
            r#"{"authorization":"Bearer nope"}"#,
            "Authorization header is managed",
        ),
        ("non-string", r#"{"x-test":1}"#, "must be a string"),
        ("empty", r#"{"x-test":""}"#, "value must not be empty"),
        (
            "cr",
            "{\"x-test\":\"bad\\rvalue\"}",
            "must not contain CR, LF, or NUL",
        ),
        (
            "lf",
            "{\"x-test\":\"bad\\nvalue\"}",
            "must not contain CR, LF, or NUL",
        ),
        (
            "nul",
            "{\"x-test\":\"bad\\u0000value\"}",
            "must not contain CR, LF, or NUL",
        ),
    ] {
        let config_dir = temp_config_dir(name);
        {
            let _env = ConfigEnvGuard::set_with_api_headers(&config_dir, raw);

            let error =
                config::resolve_auth(&Default::default()).expect_err("invalid headers should fail");

            assert!(
                error.to_string().contains(expected),
                "expected {expected:?} in {error:?}"
            );
        }
        fs::remove_dir_all(config_dir).ok();
    }
}

#[test]
fn resolve_auth_rejects_invalid_stored_header_values() {
    for (name, value, expected) in [
        ("empty", json!(""), "value must not be empty"),
        ("cr", json!("bad\rvalue"), "must not contain CR, LF, or NUL"),
        ("lf", json!("bad\nvalue"), "must not contain CR, LF, or NUL"),
        (
            "nul",
            json!("bad\0value"),
            "must not contain CR, LF, or NUL",
        ),
    ] {
        let config_dir = temp_config_dir(name);
        {
            let _env = ConfigEnvGuard::set(&config_dir);
            write_config(
                &config_dir,
                json!({
                    "version": 1,
                    "current_environment": "default",
                    "environments": {
                        "default": {
                            "api_base_url": "https://api.default.example/v1",
                            "headers": {
                                "x-test": value
                            }
                        }
                    }
                }),
            );

            let error =
                config::resolve_auth(&Default::default()).expect_err("invalid header should fail");

            assert!(
                error.to_string().contains(expected),
                "expected {expected:?} in {error:?}"
            );
        }
        fs::remove_dir_all(config_dir).ok();
    }
}

#[test]
fn config_set_unsets_header_on_active_environment() {
    let config_dir = temp_config_dir("unset-header");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "staging",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1",
                        "headers": {
                            "x-default": "kept"
                        }
                    },
                    "staging": {
                        "api_base_url": "https://api.staging.example/v1",
                        "headers": {
                            "x-keep": "kept",
                            "x-remove": "removed"
                        }
                    }
                }
            }),
        );

        config::config_set(&args(&["--unset-header", "x-remove"])).expect("unset header");

        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "staging");
        assert_eq!(
            saved["environments"]["staging"]["headers"]["x-keep"],
            "kept"
        );
        assert!(saved["environments"]["staging"]["headers"]
            .get("x-remove")
            .is_none());
        assert_eq!(
            saved["environments"]["default"]["headers"]["x-default"],
            "kept"
        );
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_set_rejects_invalid_header_values() {
    for (name, assignment, expected) in [
        ("empty", "x-test=", "value must not be empty"),
        ("cr", "x-test=bad\rvalue", "must not contain CR, LF, or NUL"),
        ("lf", "x-test=bad\nvalue", "must not contain CR, LF, or NUL"),
        (
            "nul",
            "x-test=bad\0value",
            "must not contain CR, LF, or NUL",
        ),
    ] {
        let config_dir = temp_config_dir(name);
        {
            let _env = ConfigEnvGuard::set(&config_dir);

            let error = config::config_set(&args(&["--header", assignment]))
                .expect_err("invalid header should fail");

            assert!(
                error.to_string().contains(expected),
                "expected {expected:?} in {error:?}"
            );
            assert!(!config_dir.join("config.json").exists());
        }
        fs::remove_dir_all(config_dir).ok();
    }
}

#[test]
fn config_set_clears_credentials_and_chat_state_when_active_host_changes() {
    let config_dir = temp_config_dir("host-change");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    }
                }
            }),
        );
        write_auth_files(&config_dir);

        config::config_set(&args(&["--api-base-url", "https://api.changed.example/v1"]))
            .expect("set api base url");

        let saved = read_config(&config_dir);
        assert_eq!(
            saved["environments"]["default"]["api_base_url"],
            "https://api.changed.example/v1"
        );
        assert!(!config_dir.join("credentials.json").exists());
        assert!(!config_dir.join("chat-state.json").exists());
        assert!(config_dir.join("signup.json").exists());
        assert!(config_dir.join("unrelated.json").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_set_clears_credentials_and_chat_state_when_environment_changes() {
    let config_dir = temp_config_dir("set-env-change");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    },
                    "staging": {
                        "api_base_url": "https://api.staging.example/v1"
                    }
                }
            }),
        );
        write_auth_files(&config_dir);

        config::config_set(&args(&[
            "--environment",
            "staging",
            "--header",
            "x-env=staging",
        ]))
        .expect("set staging");

        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "staging");
        assert_eq!(
            saved["environments"]["staging"]["headers"]["x-env"],
            "staging"
        );
        assert!(!config_dir.join("credentials.json").exists());
        assert!(!config_dir.join("chat-state.json").exists());
        assert!(config_dir.join("signup.json").exists());
        assert!(config_dir.join("unrelated.json").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_set_accepts_short_environment_alias() {
    let config_dir = temp_config_dir("set-short-env");
    {
        let _env = ConfigEnvGuard::set(&config_dir);

        friendly::dispatch(args(&[
            "config",
            "set",
            "-e",
            "staging",
            "--api-base-url",
            "https://api.staging.example/v1",
        ]))
        .expect("set staging with short environment flag");

        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "staging");
        assert_eq!(
            saved["environments"]["staging"]["api_base_url"],
            "https://api.staging.example/v1"
        );
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_set_rejects_no_actual_settings() {
    let config_dir = temp_config_dir("set-empty");
    {
        let _env = ConfigEnvGuard::set(&config_dir);

        let error = config::config_set(&args(&[])).expect_err("empty set should fail");

        assert!(error.to_string().contains("Nothing to set"));
        assert!(!config_dir.join("config.json").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_set_rejects_environment_only_updates() {
    let config_dir = temp_config_dir("set-env-only");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    }
                }
            }),
        );

        let error = config::config_set(&args(&["-e", "staging"]))
            .expect_err("environment only should fail");

        assert!(error.to_string().contains("Nothing to set"));
        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "default");
        assert!(saved["environments"].get("staging").is_none());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_set_rejects_unknown_flags() {
    let config_dir = temp_config_dir("set-unknown-flag");
    {
        let _env = ConfigEnvGuard::set(&config_dir);

        let error = config::config_set(&args(&[
            "--api-base-url",
            "https://api.example/v1",
            "--bogus",
            "value",
        ]))
        .expect_err("unknown flags should fail");

        assert!(error
            .to_string()
            .contains("Unexpected config argument: --bogus"));
        assert!(!config_dir.join("config.json").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_set_rejects_missing_values_before_next_flag() {
    let config_dir = temp_config_dir("set-missing-value");
    {
        let _env = ConfigEnvGuard::set(&config_dir);

        let error = config::config_set(&args(&["--api-base-url", "--header", "x-test=value"]))
            .expect_err("flag values should not consume the next flag");

        assert!(error
            .to_string()
            .contains("--api-base-url requires a value"));
        assert!(!config_dir.join("config.json").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_use_clears_credentials_and_chat_state_when_environment_changes() {
    let config_dir = temp_config_dir("use-change");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    },
                    "staging": {
                        "api_base_url": "https://api.staging.example/v1"
                    }
                }
            }),
        );
        write_auth_files(&config_dir);

        config::config_use("staging").expect("use staging");

        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "staging");
        assert!(!config_dir.join("credentials.json").exists());
        assert!(!config_dir.join("chat-state.json").exists());
        assert!(config_dir.join("signup.json").exists());
        assert!(config_dir.join("unrelated.json").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_use_rejects_extra_arguments() {
    let config_dir = temp_config_dir("use-extra");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    },
                    "staging": {
                        "api_base_url": "https://api.staging.example/v1"
                    }
                }
            }),
        );

        let error = friendly::dispatch(args(&["config", "use", "staging", "--bogus"]))
            .expect_err("extra config use args should fail");

        assert!(error
            .to_string()
            .contains("config:use requires exactly one environment name"));
        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "default");
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_reset_without_environment_still_deletes_config() {
    let config_dir = temp_config_dir("reset-full");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    }
                }
            }),
        );

        let message = config::config_reset(&args(&[])).expect("reset config");

        assert_eq!(message, "Primitive CLI request config reset.");
        assert!(!config_dir.join("config.json").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_reset_rejects_missing_environment_value_before_next_flag() {
    let config_dir = temp_config_dir("reset-missing-value");
    {
        let _env = ConfigEnvGuard::set(&config_dir);

        let error = config::config_reset(&args(&["--environment", "--json"]))
            .expect_err("environment should not consume next flag");

        assert!(error.to_string().contains("--environment requires a value"));
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_reset_environment_removes_only_named_environment() {
    let config_dir = temp_config_dir("reset-one");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    },
                    "staging": {
                        "api_base_url": "https://api.staging.example/v1"
                    }
                }
            }),
        );

        friendly::dispatch(args(&["config", "reset", "--environment", "staging"]))
            .expect("reset staging");

        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "default");
        assert_eq!(
            saved["environments"]["default"]["api_base_url"],
            "https://api.default.example/v1"
        );
        assert!(saved["environments"].get("staging").is_none());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_reset_short_environment_alias_clears_active_environment() {
    let config_dir = temp_config_dir("reset-short-env");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "staging",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    },
                    "staging": {
                        "api_base_url": "https://api.staging.example/v1"
                    }
                }
            }),
        );

        friendly::dispatch(args(&["config", "reset", "-e", "staging"])).expect("reset staging");

        let saved = read_config(&config_dir);
        assert!(saved["current_environment"].is_null());
        assert_eq!(
            saved["environments"]["default"]["api_base_url"],
            "https://api.default.example/v1"
        );
        assert!(saved["environments"].get("staging").is_none());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_reset_missing_environment_preserves_config() {
    let config_dir = temp_config_dir("reset-missing-env");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    }
                }
            }),
        );

        let message =
            config::config_reset(&args(&["--environment", "staging"])).expect("reset missing");

        assert_eq!(
            message,
            "Primitive CLI environment staging was not configured."
        );
        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "default");
        assert_eq!(
            saved["environments"]["default"]["api_base_url"],
            "https://api.default.example/v1"
        );
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_use_does_not_switch_when_credentials_lock_exists() {
    let config_dir = temp_config_dir("held-lock");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1"
                    },
                    "staging": {
                        "api_base_url": "https://api.staging.example/v1"
                    }
                }
            }),
        );
        write_auth_files(&config_dir);
        fs::create_dir(config_dir.join("credentials.lock")).expect("create held lock");

        let error = config::config_use("staging").expect_err("held lock should block switch");

        assert!(error
            .to_string()
            .contains("credential operation is already in progress"));
        let saved = read_config(&config_dir);
        assert_eq!(saved["current_environment"], "default");
        assert!(config_dir.join("credentials.json").exists());
        assert!(config_dir.join("chat-state.json").exists());
        assert!(config_dir.join("credentials.lock").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}

#[test]
fn config_set_preserves_credentials_when_only_headers_change() {
    let config_dir = temp_config_dir("header-change");
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_config(
            &config_dir,
            json!({
                "version": 1,
                "current_environment": "default",
                "environments": {
                    "default": {
                        "api_base_url": "https://api.default.example/v1",
                        "headers": {
                            "x-old": "old"
                        }
                    }
                }
            }),
        );
        write_auth_files(&config_dir);

        config::config_set(&args(&["--header", "x-new=new", "--unset-header=x-old"]))
            .expect("change headers");

        let saved = read_config(&config_dir);
        assert_eq!(saved["environments"]["default"]["headers"]["x-new"], "new");
        assert!(saved["environments"]["default"]["headers"]
            .get("x-old")
            .is_none());
        assert!(config_dir.join("credentials.json").exists());
        assert!(config_dir.join("chat-state.json").exists());
        assert!(config_dir.join("signup.json").exists());
        assert!(config_dir.join("unrelated.json").exists());
    }
    fs::remove_dir_all(config_dir).ok();
}
