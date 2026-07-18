use primitive_rust::payloads;
use serde_json::{json, Value};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::thread;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

static ENV_LOCK: Mutex<()> = Mutex::new(());

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

fn temp_config_dir(name: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "primitive-rust-payloads-auth-{name}-{}-{nonce}",
        std::process::id()
    ));
    fs::create_dir_all(&path).expect("create config dir");
    path
}

fn write_expired_oauth_credentials(config_dir: &Path, api_base_url: &str) {
    let credentials = json!({
        "auth_method": "oauth",
        "access_token": "prim_oat_old",
        "refresh_token": "prim_ort_old",
        "token_type": "Bearer",
        "expires_at": "2020-01-01T00:00:00.000Z",
        "oauth_grant_id": "grant-id",
        "oauth_client_id": "primitive-cli",
        "org_id": "org-id",
        "org_name": null,
        "api_base_url": api_base_url,
        "created_at": "2026-07-17T12:00:00.000Z"
    });
    fs::write(
        config_dir.join("credentials.json"),
        format!(
            "{}\n",
            serde_json::to_string_pretty(&credentials).expect("serialize credentials")
        ),
    )
    .expect("write credentials");
}

fn start_payload_auth_server() -> (String, thread::JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind payload auth server");
    listener
        .set_nonblocking(true)
        .expect("set payload auth server nonblocking");
    let base_url = format!("http://{}/v1", listener.local_addr().expect("server addr"));
    let handle = thread::spawn(move || {
        let mut requests = Vec::new();
        let (mut stream, request) = accept_request(&listener);
        let body = response_body_for_request(&request);
        write_response(&mut stream, body);
        requests.push(request);
        requests
    });
    (base_url, handle)
}

fn accept_request(listener: &TcpListener) -> (TcpStream, String) {
    let deadline = Instant::now() + Duration::from_secs(5);
    let (mut stream, _) = loop {
        match listener.accept() {
            Ok(accepted) => break accepted,
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                assert!(
                    Instant::now() < deadline,
                    "timed out waiting for payload auth request"
                );
                thread::sleep(Duration::from_millis(10));
            }
            Err(error) => panic!("accept payload auth request: {error}"),
        }
    };
    stream
        .set_nonblocking(false)
        .expect("set payload auth stream blocking");
    let mut buffer = Vec::new();
    loop {
        let mut chunk = [0_u8; 1024];
        let read = stream.read(&mut chunk).expect("read payload auth request");
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if let Some(expected) = complete_http_request_length(&buffer) {
            if buffer.len() >= expected {
                break;
            }
        }
    }
    (stream, String::from_utf8_lossy(&buffer).to_string())
}

fn complete_http_request_length(buffer: &[u8]) -> Option<usize> {
    let request = String::from_utf8_lossy(buffer);
    let (head, _) = request.split_once("\r\n\r\n")?;
    let body_offset = head.len() + 4;
    let content_length = head.lines().find_map(|line| {
        let (name, value) = line.split_once(':')?;
        name.eq_ignore_ascii_case("content-length")
            .then(|| value.trim().parse::<usize>().ok())
            .flatten()
    });
    let content_length = content_length.unwrap_or(0);
    Some(body_offset + content_length)
}

fn response_body_for_request(request: &str) -> Value {
    if request.starts_with(
        "GET /v1/payloads/e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855/manifest HTTP/1.1\r\n",
    ) {
        return json!({
            "data": {
                "manifest": {
                    "version": 1,
                    "objectId": "00000000000000000000000000000000",
                    "chunkSize": 67108864,
                    "totalPlaintextSize": 0,
                    "chunkCount": 0,
                    "chunks": [],
                    "merkleRoot": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                }
            }
        });
    }
    panic!("unexpected request:\n{request}");
}

fn write_response(stream: &mut TcpStream, body: Value) {
    let body = body.to_string();
    let response = format!(
        "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
        body.len()
    );
    stream
        .write_all(response.as_bytes())
        .expect("write payload auth response");
}

#[test]
fn payloads_pull_uses_saved_oauth_access_token_without_refreshing() {
    let config_dir = temp_config_dir("refresh");
    let out_path = config_dir.join("empty.out");
    let (api_base_url, handle) = start_payload_auth_server();
    {
        let _env = ConfigEnvGuard::set(&config_dir);
        write_expired_oauth_credentials(&config_dir, &api_base_url);

        payloads::run_pull(&[
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string(),
            "--out".to_string(),
            out_path.to_string_lossy().to_string(),
            "--cek".to_string(),
            "0000000000000000000000000000000000000000000000000000000000000000".to_string(),
            "--quiet".to_string(),
        ])
        .expect("pull payload");

        let requests = handle.join().expect("payload auth server");
        assert!(
            requests[0].contains("\r\nauthorization: Bearer prim_oat_old\r\n"),
            "{}",
            requests[0]
        );
        assert_eq!(fs::read(&out_path).expect("read output"), b"");
    }
    fs::remove_dir_all(config_dir).expect("remove temp dir");
}
