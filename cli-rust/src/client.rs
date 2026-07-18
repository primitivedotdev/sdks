use crate::config::ResolvedAuth;
use anyhow::{anyhow, Result};
use reqwest::blocking::{Client, RequestBuilder, Response};
use reqwest::header::{
    HeaderMap, HeaderName, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE, USER_AGENT,
};
use serde_json::Value;

const USER_AGENT_VALUE: &str = concat!("primitive-rust/", env!("CARGO_PKG_VERSION"));

pub fn http_client() -> Result<Client> {
    Client::builder()
        .user_agent(USER_AGENT_VALUE)
        .build()
        .map_err(Into::into)
}

pub fn apply_headers(
    mut request: RequestBuilder,
    auth: &ResolvedAuth,
    include_auth: bool,
    operation_headers: &[(String, String)],
    has_json_body: bool,
) -> Result<RequestBuilder> {
    let mut headers = HeaderMap::new();
    headers.insert(ACCEPT, HeaderValue::from_static("application/json"));
    headers.insert(USER_AGENT, HeaderValue::from_static(USER_AGENT_VALUE));
    if has_json_body {
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    }
    for (name, value) in &auth.headers {
        headers.insert(
            HeaderName::from_bytes(name.as_bytes())?,
            HeaderValue::from_str(value)?,
        );
    }
    if include_auth {
        if let Some(api_key) = &auth.api_key {
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&format!("Bearer {api_key}"))?,
            );
        }
    }
    for (name, value) in operation_headers {
        headers.insert(
            HeaderName::from_bytes(name.as_bytes())?,
            HeaderValue::from_str(value)?,
        );
    }
    request = request.headers(headers);
    Ok(request)
}

pub fn parse_response(response: Response) -> Result<(u16, Vec<u8>, Option<Value>)> {
    let status = response.status().as_u16();
    let bytes = response.bytes()?.to_vec();
    let json = if bytes.is_empty() {
        None
    } else {
        serde_json::from_slice(&bytes).ok()
    };
    Ok((status, bytes, json))
}

pub fn error_for_status(status: u16, json: Option<&Value>, bytes: &[u8]) -> anyhow::Error {
    if let Some(json) = json {
        anyhow!(
            "{}",
            serde_json::to_string_pretty(json).unwrap_or_else(|_| json.to_string())
        )
    } else if bytes.is_empty() {
        anyhow!("HTTP {status}")
    } else {
        anyhow!("{}", String::from_utf8_lossy(bytes))
    }
}
