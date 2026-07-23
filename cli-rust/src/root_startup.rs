use crate::config;
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;
use std::time::Duration;

const CREDENTIALS_FILE: &str = "credentials.json";
const ROOT_AUTH_TIMEOUT: Duration = Duration::from_millis(1_000);

#[derive(Debug, Clone, PartialEq, Eq)]
struct RootCredentials {
    access_token: String,
    api_base_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RootAccount {
    email: String,
    id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RootAccountRequest {
    api_base_url: String,
    api_key: String,
    headers: BTreeMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct RootCredentialsFile {
    auth_method: Option<String>,
    access_token: Option<String>,
    api_base_url: Option<String>,
    api_base_url_1: Option<String>,
}

trait EnvSource {
    fn var(&self, name: &str) -> Option<String>;
}

struct ProcessEnv;

impl EnvSource for ProcessEnv {
    fn var(&self, name: &str) -> Option<String> {
        std::env::var(name).ok()
    }
}

pub fn write_root_auth_context_if_needed(args: &[String]) {
    let Some(message) = root_auth_context_from_process(args) else {
        return;
    };
    print!("{message}");
}

fn root_auth_context_from_process(args: &[String]) -> Option<String> {
    let config_dir = config::config_dir();
    root_auth_context(args, &ProcessEnv, &config_dir, fetch_root_account)
}

fn root_auth_context<F>(
    args: &[String],
    env: &impl EnvSource,
    config_dir: &Path,
    mut fetch_account: F,
) -> Option<String>
where
    F: FnMut(&RootAccountRequest) -> Option<RootAccount>,
{
    if !args.is_empty() {
        return None;
    }

    let explicit_api_key = env_non_empty(env, "PRIMITIVE_API_KEY");
    let request_config = config::resolve_root_request_config(
        config_dir,
        env_non_empty(env, "PRIMITIVE_API_BASE_URL").as_deref(),
    )
    .ok()
    .flatten();

    if let (Some(api_key), Some(request_config)) =
        (explicit_api_key.as_ref(), request_config.as_ref())
    {
        return fetch_account(&RootAccountRequest {
            api_base_url: request_config.api_base_url.clone(),
            api_key: api_key.clone(),
            headers: request_config.headers.clone(),
        })
        .map(|account| root_auth_line(&account));
    }

    if let (Some(credentials), Some(request_config)) =
        (read_root_credentials(config_dir), request_config.as_ref())
    {
        return fetch_account(&RootAccountRequest {
            api_base_url: credentials.api_base_url,
            api_key: credentials.access_token,
            headers: request_config.headers.clone(),
        })
        .map(|account| root_auth_line(&account));
    }

    if explicit_api_key.is_some() || credentials_file_exists(config_dir) {
        return None;
    }

    if env_is_one(env, "PRIMITIVE_HIDE_SIGNUP_HINT") {
        return None;
    }

    Some(logged_out_signup_hint())
}

fn read_root_credentials(config_dir: &Path) -> Option<RootCredentials> {
    let contents = fs::read_to_string(config_dir.join(CREDENTIALS_FILE)).ok()?;
    let parsed: RootCredentialsFile = serde_json::from_str(&contents).ok()?;
    if parsed.auth_method.as_deref() != Some("oauth") {
        return None;
    }
    let access_token = trimmed_non_empty(parsed.access_token.as_deref())?;
    let api_base_url = trimmed_non_empty(parsed.api_base_url.as_deref())
        .or_else(|| trimmed_non_empty(parsed.api_base_url_1.as_deref()))?;
    Some(RootCredentials {
        access_token,
        api_base_url: config::normalize_api_base_url(Some(&api_base_url)),
    })
}

fn credentials_file_exists(config_dir: &Path) -> bool {
    config_dir.join(CREDENTIALS_FILE).exists()
}

fn fetch_root_account(request: &RootAccountRequest) -> Option<RootAccount> {
    let mut builder = reqwest::blocking::Client::builder().timeout(ROOT_AUTH_TIMEOUT);
    if crate::client::env_no_proxy_wildcard() {
        builder = builder.no_proxy();
    }
    let client = builder.build().ok()?;
    let mut request_builder = client.get(account_endpoint(&request.api_base_url));
    for (name, value) in &request.headers {
        request_builder = request_builder.header(name, value);
    }
    let response = request_builder
        .header(reqwest::header::ACCEPT, "application/json")
        .bearer_auth(&request.api_key)
        .send()
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let payload = response.json::<Value>().ok()?;
    parse_root_account(&payload)
}

fn parse_root_account(payload: &Value) -> Option<RootAccount> {
    let account = payload.get("data")?;
    let email = account.get("email").and_then(Value::as_str)?;
    let id = account.get("id").and_then(Value::as_str)?;
    if email.trim().is_empty() || id.trim().is_empty() {
        return None;
    }
    Some(RootAccount {
        email: email.to_string(),
        id: id.to_string(),
    })
}

fn root_auth_line(account: &RootAccount) -> String {
    format!("Signed in as {} (org {})\n\n", account.email, account.id)
}

fn logged_out_signup_hint() -> String {
    [
        "New to Primitive?",
        "  You or your user don't have an account yet?",
        "  Run `primitive signup <email> --accept-terms`",
        "  to create an account and get started.",
        "  Add `--signup-code <code>` if you have one.",
        "",
    ]
    .join("\n")
}

fn account_endpoint(api_base_url: &str) -> String {
    format!("{}/account", api_base_url.trim_end_matches('/'))
}

fn env_non_empty(env: &impl EnvSource, name: &str) -> Option<String> {
    trimmed_non_empty(env.var(name).as_deref())
}

fn env_is_one(env: &impl EnvSource, name: &str) -> bool {
    env.var(name).is_some_and(|value| value == "1")
}

fn trimmed_non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::{root_auth_context, RootAccount, RootAccountRequest};
    use serde_json::json;
    use std::cell::RefCell;
    use std::collections::BTreeMap;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    impl super::EnvSource for BTreeMap<String, String> {
        fn var(&self, name: &str) -> Option<String> {
            self.get(name).cloned()
        }
    }

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    fn temp_config_dir(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "primitive-rust-root-startup-{name}-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("create temp config dir");
        path
    }

    fn account(email: &str, id: &str) -> RootAccount {
        RootAccount {
            email: email.to_string(),
            id: id.to_string(),
        }
    }

    fn root_request(api_base_url: &str, api_key: &str) -> RootAccountRequest {
        RootAccountRequest {
            api_base_url: api_base_url.to_string(),
            api_key: api_key.to_string(),
            headers: BTreeMap::new(),
        }
    }

    #[test]
    fn root_startup_prints_logged_out_hint_without_auth_sources() {
        let config_dir = temp_config_dir("logged-out");
        let env = BTreeMap::new();
        let result = root_auth_context(&args(&[]), &env, &config_dir, |_| {
            panic!("root startup should not fetch without auth")
        });

        assert!(result
            .expect("logged out hint")
            .contains("primitive signup <email> --accept-terms"));
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_suppresses_logged_out_hint_when_hide_env_is_one() {
        let config_dir = temp_config_dir("hidden");
        let env = BTreeMap::from([("PRIMITIVE_HIDE_SIGNUP_HINT".to_string(), "1".to_string())]);

        let result = root_auth_context(&args(&[]), &env, &config_dir, |_| {
            panic!("root startup should not fetch without auth")
        });

        assert_eq!(result, None);
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_does_not_suppress_logged_out_hint_for_other_hide_env_values() {
        let config_dir = temp_config_dir("hide-true");
        let env = BTreeMap::from([("PRIMITIVE_HIDE_SIGNUP_HINT".to_string(), "true".to_string())]);

        let result = root_auth_context(&args(&[]), &env, &config_dir, |_| {
            panic!("root startup should not fetch without auth")
        });

        assert!(result
            .expect("logged out hint")
            .contains("New to Primitive?"));
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_uses_explicit_api_key_before_saved_credentials() {
        let config_dir = temp_config_dir("explicit-key");
        fs::write(
            config_dir.join("credentials.json"),
            json!({
                "auth_method": "oauth",
                "access_token": "prim_oat_should_not_be_used",
                "api_base_url": "https://stored.example.test/v1"
            })
            .to_string(),
        )
        .expect("write credentials");
        let env = BTreeMap::from([
            (
                "PRIMITIVE_API_BASE_URL".to_string(),
                "https://api-key.example.test/v1/".to_string(),
            ),
            (
                "PRIMITIVE_API_KEY".to_string(),
                "prim_explicit_root".to_string(),
            ),
        ]);
        let requests = RefCell::new(Vec::new());

        let result = root_auth_context(&args(&[]), &env, &config_dir, |request| {
            requests.borrow_mut().push(request.clone());
            Some(account("api-key@example.com", "org_api_key"))
        });

        assert_eq!(
            result,
            Some("Signed in as api-key@example.com (org org_api_key)\n\n".to_string())
        );
        assert_eq!(
            requests.into_inner(),
            vec![root_request(
                "https://api-key.example.test/v1",
                "prim_explicit_root"
            )]
        );
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_uses_configured_base_and_headers_for_explicit_api_key() {
        let config_dir = temp_config_dir("explicit-key-config");
        fs::write(
            config_dir.join("config.json"),
            json!({
                "version": 1,
                "current_environment": "staging",
                "environments": {
                    "staging": {
                        "api_base_url": "https://configured.example.test/v1/",
                        "headers": {
                            "x-root-startup": "configured"
                        }
                    }
                }
            })
            .to_string(),
        )
        .expect("write config");
        let env = BTreeMap::from([(
            "PRIMITIVE_API_KEY".to_string(),
            "prim_explicit_root".to_string(),
        )]);
        let requests = RefCell::new(Vec::new());

        let result = root_auth_context(&args(&[]), &env, &config_dir, |request| {
            requests.borrow_mut().push(request.clone());
            Some(account("api-key@example.com", "org_api_key"))
        });

        assert_eq!(
            result,
            Some("Signed in as api-key@example.com (org org_api_key)\n\n".to_string())
        );
        assert_eq!(
            requests.into_inner(),
            vec![RootAccountRequest {
                api_base_url: "https://configured.example.test/v1".to_string(),
                api_key: "prim_explicit_root".to_string(),
                headers: BTreeMap::from([("x-root-startup".to_string(), "configured".to_string())]),
            }]
        );
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_explicit_api_key_defaults_to_production_base_url() {
        let config_dir = temp_config_dir("explicit-key-default-base");
        let env = BTreeMap::from([(
            "PRIMITIVE_API_KEY".to_string(),
            "prim_explicit_root".to_string(),
        )]);
        let requests = RefCell::new(Vec::new());

        let result = root_auth_context(&args(&[]), &env, &config_dir, |request| {
            requests.borrow_mut().push(request.clone());
            None
        });

        assert_eq!(result, None);
        assert_eq!(
            requests.into_inner(),
            vec![root_request(
                "https://api.primitive.dev/v1",
                "prim_explicit_root"
            )]
        );
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_reads_saved_oauth_credentials_with_legacy_base_url() {
        let config_dir = temp_config_dir("saved-oauth");
        fs::write(
            config_dir.join("config.json"),
            json!({
                "version": 1,
                "current_environment": null,
                "environments": {
                    "default": {
                        "headers": {
                            "x-root-startup": "stored"
                        }
                    }
                }
            })
            .to_string(),
        )
        .expect("write config");
        fs::write(
            config_dir.join("credentials.json"),
            json!({
                "auth_method": "oauth",
                "access_token": "prim_oat_root",
                "api_base_url_1": "https://legacy.example.test/v1/"
            })
            .to_string(),
        )
        .expect("write credentials");
        let env = BTreeMap::new();
        let requests = RefCell::new(Vec::new());

        let result = root_auth_context(&args(&[]), &env, &config_dir, |request| {
            requests.borrow_mut().push(request.clone());
            Some(account("agent@example.com", "org_123"))
        });

        assert_eq!(
            result,
            Some("Signed in as agent@example.com (org org_123)\n\n".to_string())
        );
        assert_eq!(
            requests.into_inner(),
            vec![RootAccountRequest {
                api_base_url: "https://legacy.example.test/v1".to_string(),
                api_key: "prim_oat_root".to_string(),
                headers: BTreeMap::from([("x-root-startup".to_string(), "stored".to_string())]),
            }]
        );
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_suppresses_fetch_for_non_default_environment_without_base_url() {
        let config_dir = temp_config_dir("non-default-without-base");
        fs::write(
            config_dir.join("config.json"),
            json!({
                "version": 1,
                "current_environment": "staging",
                "environments": {
                    "staging": {
                        "headers": {
                            "x-root-startup": "stored"
                        }
                    }
                }
            })
            .to_string(),
        )
        .expect("write config");
        fs::write(
            config_dir.join("credentials.json"),
            json!({
                "auth_method": "oauth",
                "access_token": "prim_oat_root",
                "api_base_url": "https://legacy.example.test/v1"
            })
            .to_string(),
        )
        .expect("write credentials");
        let env = BTreeMap::new();

        let result = root_auth_context(&args(&[]), &env, &config_dir, |_| {
            panic!("root startup should not fetch when active environment has no base")
        });

        assert_eq!(result, None);
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_suppresses_hint_when_saved_oauth_fetch_fails() {
        let config_dir = temp_config_dir("saved-oauth-fetch-fails");
        fs::write(
            config_dir.join("credentials.json"),
            json!({
                "auth_method": "oauth",
                "access_token": "prim_oat_root",
                "api_base_url": "https://api.example.test/v1"
            })
            .to_string(),
        )
        .expect("write credentials");
        let env = BTreeMap::new();

        let result = root_auth_context(&args(&[]), &env, &config_dir, |_| None);

        assert_eq!(result, None);
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_suppresses_hint_when_credentials_file_is_not_root_oauth() {
        let config_dir = temp_config_dir("invalid-credentials");
        fs::write(config_dir.join("credentials.json"), "{}").expect("write credentials");
        let env = BTreeMap::new();

        let result = root_auth_context(&args(&[]), &env, &config_dir, |_| {
            panic!("root startup should not fetch invalid root credentials")
        });

        assert_eq!(result, None);
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }

    #[test]
    fn root_startup_does_not_fetch_or_print_for_subcommands() {
        let config_dir = temp_config_dir("subcommand");
        let env = BTreeMap::from([("PRIMITIVE_API_KEY".to_string(), "prim_test".to_string())]);

        let result = root_auth_context(&args(&["whoami"]), &env, &config_dir, |_| {
            panic!("root startup should not fetch for subcommands")
        });

        assert_eq!(result, None);
        fs::remove_dir_all(config_dir).expect("remove temp config dir");
    }
}
